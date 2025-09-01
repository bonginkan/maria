/**
 * ConfigPortAdapter
 *
 * MARIA設定システムとの統合アダプター
 * ✅ 既存ConfigCommandとの互換性
 * ✅ 階層設定管理 (global/user/project/runtime)
 * ✅ スキーマ検証 & バックアップ
 * ✅ テンプレートシステム
 * ✅ 履歴管理 & ロールバック
 */

import {
  ConfigPort,
  SetOptions,
  ConfigLayer,
  LayeredConfig,
  ConfigTemplate,
  ConfigHistoryEntry,
  JSONSchema,
  TemplateOptions,
  ConfigValidationError,
} from "../ports/ConfigPort";
import {
  ValidationResult,
  MigrationResult,
} from "../contracts/SystemCommandContract";
import { logger } from "../../../utils/logger";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

export class ConfigPortAdapter implements ConfigPort {
  private readonly globalConfigPath: string;
  private readonly userConfigPath: string;
  private readonly projectConfigPath: string;
  private readonly historyPath: string;
  private readonly templatesPath: string;
  private readonly configCache = new Map<
    string,
    { value: any; timestamp: number; layer: ConfigLayer }
  >();
  private readonly CACHE_TTL = 300000; // 5 minutes

  // Configuration schema definitions
  private readonly configSchemas: Record<string, JSONSchema> = {
    defaultModel: {
      type: "string",
      enum: ["claude-3-sonnet", "claude-3-haiku", "gpt-4", "gpt-3.5-turbo"],
      description: "Default AI model to use",
    },
    temperature: {
      type: "number",
      minimum: 0,
      maximum: 2,
      description: "AI temperature setting",
    },
    maxTokens: {
      type: "number",
      minimum: 1,
      maximum: 100000,
      description: "Maximum tokens per request",
    },
    theme: {
      type: "string",
      enum: ["dark", "light", "auto"],
      description: "UI theme setting",
    },
    debug: {
      type: "boolean",
      description: "Enable debug mode",
    },
  };

  // Default configuration values
  private readonly defaultConfig: Record<string, any> = {
    defaultModel: "claude-3-sonnet",
    temperature: 0.7,
    maxTokens: 4000,
    streamResponse: true,
    theme: "dark",
    colors: true,
    animations: true,
    language: "en",
    debug: false,
    verbose: false,
    telemetry: false,
    logLevel: "info",
    autoSave: false,
    autoFormat: true,
    backupCount: 5,
  };

  constructor() {
    this.globalConfigPath = path.join(os.homedir(), ".maria", "config.json");
    this.userConfigPath = path.join(os.homedir(), ".maria", "user-config.json");
    this.projectConfigPath = path.join(process.cwd(), ".maria-config.json");
    this.historyPath = path.join(os.homedir(), ".maria", "config-history.json");
    this.templatesPath = path.join(os.homedir(), ".maria", "templates");
  }

  async get<T = any>(key: string): Promise<T | undefined> {
    const layered = await this.getLayered<T>(key);
    return layered?.value;
  }

  async getLayered<T = any>(
    key: string,
  ): Promise<LayeredConfig<T> | undefined> {
    // Check cache first
    const cacheKey = `layered:${key}`;
    const cached = this.getCached<LayeredConfig<T>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Load all layers
      const layers = {
        global: await this.getFromLayer("global", key),
        user: await this.getFromLayer("user", key),
        project: await this.getFromLayer("project", key),
        runtime: await this.getFromLayer("runtime", key),
      };

      // Determine effective value based on layer priority
      // Priority: runtime > project > user > global > default
      let value: T | undefined;
      let source: ConfigLayer = "global";
      let merged = false;

      if (layers.runtime !== undefined) {
        value = layers.runtime;
        source = "runtime";
      } else if (layers.project !== undefined) {
        value = layers.project;
        source = "project";
      } else if (layers.user !== undefined) {
        value = layers.user;
        source = "user";
      } else if (layers.global !== undefined) {
        value = layers.global;
        source = "global";
      } else {
        value = this.defaultConfig[key] as T;
        source = "global";
      }

      if (!value) {
        return undefined;
      }

      // Check if value is merged from multiple sources
      const nonEmptyLayers = Object.values(layers).filter(
        (v) => v !== undefined,
      );
      merged = nonEmptyLayers.length > 1;

      const result: LayeredConfig<T> = {
        value,
        layers: layers as any,
        source,
        merged,
      };

      // Cache the result
      this.setCached(cacheKey, result);

      return result;
    } catch (error) {
      logger.error(`Failed to get layered config for key ${key}:`, error);
      return undefined;
    }
  }

  async set(key: string, value: any, options: SetOptions = {}): Promise<void> {
    const {
      validate = true,
      layer = "user",
      backup = true,
      dryRun = false,
    } = options;

    try {
      // Validate if requested
      if (validate) {
        const validationResult = await this.validate({ [key]: value });
        if (!validationResult.ok) {
          throw new Error(
            `Validation failed: ${validationResult.errors?.join(", ")}`,
          );
        }
      }

      if (dryRun) {
        logger.info(
          `DRY RUN: Would set ${key} = ${JSON.stringify(value)} in ${layer} layer`,
        );
        return;
      }

      // Create backup if requested
      if (backup) {
        await this.createHistoryEntry(
          "set",
          key,
          layer,
          await this.get(key),
          value,
        );
      }

      // Set in the specified layer
      await this.setInLayer(layer, key, value);

      // Invalidate cache
      this.invalidateCache(key);

      logger.info(
        `Configuration ${key} set to ${JSON.stringify(value)} in ${layer} layer`,
      );
    } catch (error) {
      logger.error(`Failed to set configuration ${key}:`, error);
      throw error;
    }
  }

  async setLayer(layer: ConfigLayer, key: string, value: any): Promise<void> {
    await this.set(key, value, { layer });
  }

  async delete(key: string): Promise<boolean> {
    try {
      // Check all layers for the key
      const layers: ConfigLayer[] = ["runtime", "project", "user", "global"];
      let deleted = false;

      for (const layer of layers) {
        const config = await this.loadLayerConfig(layer);
        if (config && key in config) {
          // Create history entry before deletion
          await this.createHistoryEntry(
            "delete",
            key,
            layer,
            config[key],
            undefined,
          );

          delete config[key];
          await this.saveLayerConfig(layer, config);
          deleted = true;
        }
      }

      if (deleted) {
        this.invalidateCache(key);
      }

      return deleted;
    } catch (error) {
      logger.error(`Failed to delete configuration ${key}:`, error);
      return false;
    }
  }

  async list(prefix?: string): Promise<Record<string, any>> {
    try {
      const result: Record<string, any> = {};

      // Get all keys from all layers
      const allKeys = new Set<string>();
      const layers: ConfigLayer[] = ["global", "user", "project", "runtime"];

      for (const layer of layers) {
        const config = await this.loadLayerConfig(layer);
        if (config) {
          Object.keys(config).forEach((key) => allKeys.add(key));
        }
      }

      // Add default keys
      Object.keys(this.defaultConfig).forEach((key) => allKeys.add(key));

      // Get effective values for all keys
      for (const key of allKeys) {
        if (!prefix || key.startsWith(prefix)) {
          const layered = await this.getLayered(key);
          if (layered) {
            result[key] = layered.value;
          }
        }
      }

      return result;
    } catch (error) {
      logger.error("Failed to list configurations:", error);
      return {};
    }
  }

  async validate(config: any, schema?: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      for (const [key, value] of Object.entries(config)) {
        const keySchema = this.configSchemas[key];

        if (!keySchema) {
          warnings.push(`No schema defined for key: ${key}`);
          continue;
        }

        const validationError = this.validateValue(value, keySchema, key);
        if (validationError) {
          errors.push(validationError);
        }
      }

      return {
        ok: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        dryRun: false,
      };
    } catch (error) {
      return {
        ok: false,
        errors: [
          `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }

  async migrate(
    fromVersion: string,
    toVersion: string,
    dryRun: boolean = false,
  ): Promise<MigrationResult> {
    try {
      const changes: string[] = [];
      const rollbackData: any = {};

      // Simple migration logic (would be more complex in real implementation)
      if (fromVersion === "3.4.0" && toVersion === "3.5.0") {
        // Example migration: rename 'model' to 'defaultModel'
        const currentConfig = await this.list();

        if ("model" in currentConfig && !("defaultModel" in currentConfig)) {
          changes.push("Migrate: model -> defaultModel");

          if (!dryRun) {
            rollbackData["defaultModel"] = await this.get("defaultModel");
            await this.set("defaultModel", currentConfig["model"]);
            await this.delete("model");
          }
        }
      }

      return {
        ok: true,
        fromVersion,
        toVersion,
        changes,
        rollbackData: dryRun ? undefined : rollbackData,
      };
    } catch (error) {
      return {
        ok: false,
        fromVersion,
        toVersion,
        changes: [
          `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }

  async applyTemplate(
    templateId: string,
    options: TemplateOptions = {},
  ): Promise<void> {
    const { overwrite = false, dryRun = false, variables = {} } = options;

    try {
      const template = await this.loadTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const processedConfig = this.processTemplateVariables(
        template.config,
        variables,
      );

      for (const [key, value] of Object.entries(processedConfig)) {
        const currentValue = await this.get(key);

        if (currentValue !== undefined && !overwrite) {
          logger.warn(
            `Skipping ${key} (already exists, use overwrite=true to replace)`,
          );
          continue;
        }

        if (dryRun) {
          logger.info(`DRY RUN: Would set ${key} = ${JSON.stringify(value)}`);
        } else {
          await this.set(key, value);
        }
      }
    } catch (error) {
      logger.error(`Failed to apply template ${templateId}:`, error);
      throw error;
    }
  }

  async listTemplates(): Promise<ConfigTemplate[]> {
    try {
      await fs.mkdir(this.templatesPath, { recursive: true });
      const files = await fs.readdir(this.templatesPath);
      const templates: ConfigTemplate[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const templatePath = path.join(this.templatesPath, file);
            const content = await fs.readFile(templatePath, "utf-8");
            const template = JSON.parse(content);
            templates.push(template);
          } catch (error) {
            logger.warn(`Failed to load template ${file}:`, error);
          }
        }
      }

      return templates;
    } catch (error) {
      logger.error("Failed to list templates:", error);
      return [];
    }
  }

  async getHistory(
    key?: string,
    limit: number = 50,
  ): Promise<ConfigHistoryEntry[]> {
    try {
      const historyContent = await fs
        .readFile(this.historyPath, "utf-8")
        .catch(() => "[]");
      const allHistory: ConfigHistoryEntry[] = JSON.parse(historyContent);

      let filteredHistory = allHistory;

      if (key) {
        filteredHistory = allHistory.filter((entry) => entry.key === key);
      }

      return filteredHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch (error) {
      logger.error("Failed to get configuration history:", error);
      return [];
    }
  }

  async rollback(entryId: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const entry = history.find((h) => h.id === entryId);

      if (!entry) {
        throw new Error(`History entry not found: ${entryId}`);
      }

      if (entry.action === "set" && entry.oldValue !== undefined) {
        await this.setInLayer(entry.layer, entry.key, entry.oldValue);
      } else if (entry.action === "delete" && entry.oldValue !== undefined) {
        await this.setInLayer(entry.layer, entry.key, entry.oldValue);
      }

      // Create rollback history entry
      await this.createHistoryEntry(
        "rollback",
        entry.key,
        entry.layer,
        entry.newValue,
        entry.oldValue,
        `Rollback to ${entryId}`,
      );

      this.invalidateCache(entry.key);
    } catch (error) {
      logger.error(`Failed to rollback to entry ${entryId}:`, error);
      throw error;
    }
  }

  async getSchema(key: string): Promise<JSONSchema | undefined> {
    return this.configSchemas[key];
  }

  async getVersion(): Promise<string> {
    // Return MARIA version or config schema version
    return "3.5.0";
  }

  // Private helper methods
  private async getFromLayer(layer: ConfigLayer, key: string): Promise<any> {
    const config = await this.loadLayerConfig(layer);
    return config?.[key];
  }

  private async setInLayer(
    layer: ConfigLayer,
    key: string,
    value: any,
  ): Promise<void> {
    const config = (await this.loadLayerConfig(layer)) || {};
    config[key] = value;
    await this.saveLayerConfig(layer, config);
  }

  private async loadLayerConfig(
    layer: ConfigLayer,
  ): Promise<Record<string, any> | null> {
    try {
      const configPath = this.getLayerConfigPath(layer);
      const content = await fs.readFile(configPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      return null; // File doesn't exist or invalid JSON
    }
  }

  private async saveLayerConfig(
    layer: ConfigLayer,
    config: Record<string, any>,
  ): Promise<void> {
    const configPath = this.getLayerConfigPath(layer);
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  private getLayerConfigPath(layer: ConfigLayer): string {
    switch (layer) {
      case "global":
        return this.globalConfigPath;
      case "user":
        return this.userConfigPath;
      case "project":
        return this.projectConfigPath;
      case "runtime":
        return path.join(os.tmpdir(), "maria-runtime-config.json");
      default:
        return this.userConfigPath;
    }
  }

  private validateValue(
    value: any,
    schema: JSONSchema,
    key: string,
  ): string | null {
    // Type validation
    if (schema.type && typeof value !== schema.type) {
      return `${key}: expected ${schema.type}, got ${typeof value}`;
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      return `${key}: value must be one of: ${schema.enum.join(", ")}`;
    }

    // Number validation
    if (schema.type === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) {
        return `${key}: value must be >= ${schema.minimum}`;
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return `${key}: value must be <= ${schema.maximum}`;
      }
    }

    // String validation
    if (schema.type === "string") {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return `${key}: string too short (min: ${schema.minLength})`;
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return `${key}: string too long (max: ${schema.maxLength})`;
      }
    }

    return null;
  }

  private async createHistoryEntry(
    action: "set" | "delete" | "migrate" | "rollback",
    key: string,
    layer: ConfigLayer,
    oldValue?: any,
    newValue?: any,
    reason?: string,
  ): Promise<void> {
    const entry: ConfigHistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      key,
      action,
      oldValue,
      newValue,
      layer,
      user: os.userInfo().username,
      reason,
      checksum: this.calculateChecksum({
        key,
        action,
        oldValue,
        newValue,
        layer,
      }),
    };

    try {
      const historyContent = await fs
        .readFile(this.historyPath, "utf-8")
        .catch(() => "[]");
      const history: ConfigHistoryEntry[] = JSON.parse(historyContent);

      history.push(entry);

      // Keep only last 1000 entries
      const trimmedHistory = history.slice(-1000);

      await fs.mkdir(path.dirname(this.historyPath), { recursive: true });
      await fs.writeFile(
        this.historyPath,
        JSON.stringify(trimmedHistory, null, 2),
        "utf-8",
      );
    } catch (error) {
      logger.error("Failed to create history entry:", error);
    }
  }

  private async loadTemplate(
    templateId: string,
  ): Promise<ConfigTemplate | null> {
    try {
      const templatePath = path.join(this.templatesPath, `${templateId}.json`);
      const content = await fs.readFile(templatePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private processTemplateVariables(
    config: any,
    variables: Record<string, any>,
  ): any {
    const processedConfig = JSON.parse(JSON.stringify(config));

    const processValue = (value: any): any => {
      if (typeof value === "string") {
        // Replace template variables like {{variableName}}
        return value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
          return variables[varName] !== undefined ? variables[varName] : match;
        });
      } else if (Array.isArray(value)) {
        return value.map(processValue);
      } else if (typeof value === "object" && value !== null) {
        const processed: any = {};
        for (const [k, v] of Object.entries(value)) {
          processed[k] = processValue(v);
        }
        return processed;
      }
      return value;
    };

    return processValue(processedConfig);
  }

  private calculateChecksum(data: any): string {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex")
      .substring(0, 16);
  }

  private getCached<T>(key: string): T | undefined {
    const cached = this.configCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.value as T;
    }
    return undefined;
  }

  private setCached<T>(
    key: string,
    value: T,
    layer: ConfigLayer = "user",
  ): void {
    this.configCache.set(key, {
      value,
      timestamp: Date.now(),
      layer,
    });
  }

  private invalidateCache(key: string): void {
    // Remove specific key and related layered cache entries
    const keysToRemove: string[] = [];

    for (const cacheKey of this.configCache.keys()) {
      if (cacheKey === key || cacheKey.startsWith(`layered:${key}`)) {
        keysToRemove.push(cacheKey);
      }
    }

    keysToRemove.forEach((k) => this.configCache.delete(k));
  }
}
