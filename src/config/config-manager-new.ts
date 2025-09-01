/**
 * Configuration Manager v2.0 - Phase 2 Implementation
 * Enterprise-ready configuration management with comprehensive validation
 */

import { z } from "zod";
import { _Config, PriorityMode } from "../types";
import { MariaAIConfig } from "../maria-ai";

// ===== PHASE 2: COMPREHENSIVE SCHEMA & VALIDATION =====

// Provider/Model validation mappings
const PROVIDER_MODELS: Record<string, string[]> = {
  openai: [
    "gpt-5-mini-2025-08-07",
    "gpt-5-mini",
    "gpt-5",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "o1-preview",
    "o1-mini",
  ],
  anthropic: [
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
    "claude-3-5-sonnet-20241022",
  ],
  google: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
  groq: [
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
  ],
  grok: ["grok-beta", "grok-vision-beta"],
  lmstudio: ["*"], // Local models - accept any
  ollama: ["*"], // Local models - accept any
  vllm: ["*"], // Local models - accept any
};

// Custom error classes for better error handling
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown,
    public suggestion?: string,
  ) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "ConfigLoadError";
  }
}

// Comprehensive Zod schema
const PriorityModeSchema = z
  .enum(["privacy-first", "performance", "cost-effective", "auto"])
  .default("privacy-first");

const ApiKeysSchema = z
  .object({
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    GROK_API_KEY: z.string().optional(),
  })
  .partial()
  .default({});

const LocalProvidersSchema = z
  .object({
    lmstudio: z.boolean().default(false),
    ollama: z.boolean().default(false),
    vllm: z.boolean().default(false),
  })
  .default({ lmstudio: false, ollama: false, vllm: false });

const ProviderConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    apiKey: z.string().optional(),
    apiBase: z.string().url().optional(),
    models: z.record(z.any()).default({}),
  })
  .default({ enabled: false, models: Record<string, any> });

// Main configuration schema
export const ConfigSchema = z
  .object({
    priority: PriorityModeSchema,
    providers: z.record(ProviderConfigSchema).default({}),
    autoStart: z.boolean().default(true),
    healthMonitoring: z.boolean().default(true),
    language: z.string().default("auto"),
    offlineMode: z.boolean().default(false),

    // Extended configuration
    model: z.string().default("gpt-5-mini"),
    provider: z.string().default("openai"),
    apiKeys: ApiKeysSchema.optional(),
    localProviders: LocalProvidersSchema.optional(),
    enabledProviders: z.array(z.string()).optional(),

    // Advanced settings
    maxRetries: z.number().min(0).max(10).default(3),
    timeout: z.number().min(1000).max(300000).default(30000), // 30s default
    concurrentRequests: z.number().min(1).max(20).default(5),
    cacheEnabled: z.boolean().default(true),
    logLevel: z.enum(["error", "warn", "info", "debug"]).default("info"),
    telemetryEnabled: z.boolean().default(true),
  })
  .strip(); // Remove unknown fields

// Configuration source tracking
export type ConfigSource = "defaults" | "file" | "env" | "cli";
export type SourceMap = Partial<Record<keyof ValidatedConfig, ConfigSource>>;

export type ValidatedConfig = z.infer<typeof ConfigSchema>;

// Type utilities for deep merging
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Deep merge utility function
function deepMerge<T extends Record<string, any>>(
  target: T,
  source: DeepPartial<T>,
): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] === undefined) continue;

    const sourceValue = source[key];
    const targetValue = result[key];

    if (Array.isArray(sourceValue)) {
      // Arrays are replaced, not merged
      result[key] = [...sourceValue] as any;
    } else if (
      sourceValue &&
      typeof sourceValue === "object" &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      // Deep merge objects
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      // Replace primitive values
      result[key] = sourceValue as any;
    }
  }

  return result;
}

export class ConfigManager {
  private config: ValidatedConfig;
  private sourceMap: SourceMap;

  constructor(
    initialConfig: MariaAIConfig = {},
    source: ConfigSource = "defaults",
  ) {
    try {
      // Start with validated defaults
      this.config = this.validateAndTransform(this.loadDefaultConfig());
      this.sourceMap = this.initializeSourceMap();

      // Merge and validate initial config
      if (Object.keys(initialConfig).length > 0) {
        this.mergeAndValidate(initialConfig, source);
      }
    } catch (error) {
      throw new ConfigLoadError(
        `Failed to initialize ConfigManager: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // Utility function for parsing boolean values from environment variables
  private static parseBool(value?: string, defaultValue = false): boolean {
    if (!value) return defaultValue;
    return /^(1|true|yes|on)$/i.test(value.trim());
  }

  private static parseNumber(
    value?: string,
    defaultValue?: number,
  ): number | undefined {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private loadDefaultConfig(): DeepPartial<ValidatedConfig> {
    return {
      priority: "privacy-first",
      providers: {} as Record<string, any>,
      autoStart: true,
      healthMonitoring: true,
      language: "auto",
      offlineMode: false,
      model: "gpt-5-mini",
      provider: "openai",
      maxRetries: 3,
      timeout: 30000,
      concurrentRequests: 5,
      cacheEnabled: true,
      logLevel: "info",
      telemetryEnabled: true,
    };
  }

  private initializeSourceMap(): SourceMap {
    const keys = Object.keys(this.config) as (keyof ValidatedConfig)[];
    return keys.reduce(
      (map, key) => ({ ...map, [key]: "defaults" as ConfigSource }),
      {},
    );
  }

  // Validate and transform configuration using Zod schema
  private validateAndTransform(config: unknown): ValidatedConfig {
    try {
      const validated = ConfigSchema.parse(config);

      // Additional custom validation
      this.validateProviderModelConsistency(validated);

      return validated;
    } catch (innerError) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        throw new ConfigValidationError(
          `Configuration validation failed: ${firstError.message}`,
          firstError.path.join("."),
          firstError.received,
          this.getSuggestionForError(firstError),
        );
      }
      throw error;
    }
  }

  // Custom provider/model consistency validation
  private validateProviderModelConsistency(config: ValidatedConfig): void {
    const { provider, model } = config;

    if (provider && model) {
      const allowedModels = PROVIDER_MODELS[provider];
      if (
        allowedModels &&
        !allowedModels.includes("*") &&
        !allowedModels.includes(model)
      ) {
        throw new ConfigValidationError(
          `Model "${model}" is not supported by provider "${provider}"`,
          "model",
          model,
          `Available models for ${provider}: ${allowedModels.join(", ")}`,
        );
      }
    }
  }

  // Provide helpful suggestions for validation errors
  private getSuggestionForError(error: z.ZodIssue): string {
    switch (error.code) {
      case "invalid_enum_value":
        return `Valid options: ${error.options.join(", ")}`;
      case "too_small":
        return `Minimum value: ${error.minimum}`;
      case "too_big":
        return `Maximum value: ${error.maximum}`;
      case "invalid_type":
        return `Expected ${error.expected}, got ${error.received}`;
      case "invalid_string":
        if (error.validation === "url") {
          return "Must be a valid URL (e.g., https://api.example.com)";
        }
        return "Invalid string format";
      default:
        return "Please check the configuration documentation";
    }
  }

  // Phase 2: Advanced merge with validation and source tracking
  private mergeAndValidate(
    newConfig: unknown,
    source: ConfigSource = "defaults",
  ): void {
    try {
      // Deep merge the configurations
      const mergedConfig = deepMerge(
        this.config,
        newConfig as DeepPartial<ValidatedConfig>,
      );

      // Validate the merged result
      const validatedConfig = this.validateAndTransform(mergedConfig);

      // Update source map for changed fields
      this.updateSourceMap(newConfig as Record<string, any>, source);

      // Apply validated config
      this.config = validatedConfig;
    } catch (error) {
      throw new ConfigValidationError(
        `Failed to merge configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
        "merge",
        newConfig,
        "Check configuration format and values",
      );
    }
  }

  private updateSourceMap(
    newConfig: Record<string, any>,
    source: ConfigSource,
  ): void {
    for (const key of Object.keys(newConfig)) {
      if (key in this.sourceMap) {
        this.sourceMap[key as keyof ValidatedConfig] = source;
      }
    }
  }

  // Phase 2: Enhanced type-safe methods with validation
  get<K extends keyof ValidatedConfig>(_key: K): ValidatedConfig[K];
  get<K extends keyof ValidatedConfig, T>(
    _key: K,
    _defaultValue: T,
  ): ValidatedConfig[K] | T;
  get<K extends keyof ValidatedConfig, T>(
    key: K,
    defaultValue?: T,
  ): ValidatedConfig[K] | T | undefined {
    const value = this.config[key];
    return value !== undefined ? value : defaultValue;
  }

  // Type-safe set method with validation
  set<K extends keyof ValidatedConfig>(
    key: K,
    value: ValidatedConfig[K],
    source: ConfigSource = "manual",
  ): void {
    try {
      const updatedConfig = { ...this.config, [key]: value };
      const validatedConfig = this.validateAndTransform(updatedConfig);

      this.config = validatedConfig;
      this.sourceMap[key] = source;
    } catch (innerError) {
      throw new ConfigValidationError(
        `Failed to set ${String(key)}: ${error instanceof Error ? error.message : "Invalid value"}`,
        String(key),
        value,
        error instanceof ConfigValidationError ? error.suggestion : undefined,
      );
    }
  }

  // Bulk update with validation
  update(
    updates: DeepPartial<ValidatedConfig>,
    source: ConfigSource = "manual",
  ): void {
    this.mergeAndValidate(updates, source);
  }

  // Get configuration source information
  getSource<K extends keyof ValidatedConfig>(key: K): ConfigSource | undefined {
    return this.sourceMap[key];
  }

  // Get all source mappings
  getSourceMap(): Readonly<SourceMap> {
    return { ...this.sourceMap };
  }

  // Validate current configuration
  validate(): { isValid: boolean; errors: string[] } {
    try {
      this.validateAndTransform(this.config);
      return { isValid: true, errors: [] };
    } catch (error) {
      const errors = [];
      if (error instanceof ConfigValidationError) {
        errors.push(`${error.field}: ${error.message}`);
      } else {
        errors.push(
          error instanceof Error ? error.message : "Unknown validation error",
        );
      }
      return { isValid: false, errors };
    }
  }

  getAll(options?: {
    maskSensitive?: boolean;
    includeSourceMap?: boolean;
    format?: "object" | "json" | "yaml";
  }):
    | ValidatedConfig
    | { config: ValidatedConfig; sources: SourceMap }
    | string {
    const configCopy = { ...this.config };

    // Mask sensitive data if requested
    if (options?.maskSensitive && configCopy.apiKeys) {
      configCopy.apiKeys = Object.fromEntries(
        Object.entries(configCopy.apiKeys).map(([key, value]) => [
          key,
          value ? "***MASKED***" : value,
        ]),
      ) as any;
    }

    const result = options?.includeSourceMap
      ? { config: configCopy, sources: this.sourceMap }
      : configCopy;

    // Format output if requested
    if (options?.format) {
      switch (options.format) {
        case "json":
          return JSON.stringify(result, null, 2);
        case "yaml":
          // Simple YAML-like format (full YAML would require additional dependency)
          return this.toYamlLike(result);
        default:
          return result;
      }
    }

    return result;
  }

  private toYamlLike(obj: any, indent = 0): string {
    const spaces = "  ".repeat(indent);
    let result = "";

    for (const [key, value] of Object.entries(obj)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        result += `${spaces}${key}:\n${this.toYamlLike(value, indent + 1)}`;
      } else if (Array.isArray(value)) {
        result += `${spaces}${key}:\n`;
        for (const _item of value) {
          result += `${spaces}  - ${_item}\n`;
        }
      } else {
        result += `${spaces}${key}: ${value}\n`;
      }
    }

    return result;
  }

  // Phase 2: Enhanced environment loading with comprehensive hierarchy
  static fromEnvironment(): ConfigManager {
    const envConfig: DeepPartial<ValidatedConfig> = {
      priority: (process.env["MARIA_PRIORITY"] as PriorityMode) || undefined,
      provider:
        process.env["MARIA_PROVIDER"] || process.env["PROVIDER"] || undefined,
      model: process.env["MARIA_MODEL"] || process.env["MODEL"] || undefined,
      language:
        process.env["MARIA_LANGUAGE"] || process.env["LANGUAGE"] || undefined,
      offlineMode: ConfigManager.parseBool(process.env["MARIA_OFFLINE_MODE"]),

      apiKeys: {
        OPENAI_API_KEY: process.env["OPENAI_API_KEY"] || undefined,
        ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"] || undefined,
        GOOGLE_API_KEY:
          process.env["GOOGLE_AI_API_KEY"] ||
          process.env["GOOGLE_API_KEY"] ||
          process.env["GEMINI_API_KEY"] ||
          undefined,
        GROQ_API_KEY: process.env["GROQ_API_KEY"] || undefined,
        GROK_API_KEY:
          process.env["GROK_API_KEY"] ||
          process.env["XAI_API_KEY"] ||
          undefined,
      },

      localProviders: {
        lmstudio: ConfigManager.parseBool(
          process.env["LMSTUDIO_ENABLED"],
          true,
        ),
        ollama: ConfigManager.parseBool(process.env["OLLAMA_ENABLED"], true),
        vllm: ConfigManager.parseBool(process.env["VLLM_ENABLED"], true),
      },

      autoStart: ConfigManager.parseBool(
        process.env["AUTO_START_LLMS"],
        true,
      ),
      healthMonitoring: ConfigManager.parseBool(
        process.env["HEALTH_MONITORING"],
        true,
      ),

      // Advanced environment settings
      maxRetries: ConfigManager.parseNumber(process.env["MARIA_MAX_RETRIES"]),
      timeout: ConfigManager.parseNumber(process.env["MARIA_TIMEOUT"]),
      concurrentRequests: ConfigManager.parseNumber(
        process.env["MARIA_CONCURRENT_REQUESTS"],
      ),
      cacheEnabled: ConfigManager.parseBool(
        process.env["MARIA_CACHE_ENABLED"],
      ),
      logLevel:
        (process.env["MARIA_LOG_LEVEL"] as any) ||
        (process.env["LOG_LEVEL"] as any) ||
        undefined,
      telemetryEnabled: ConfigManager.parseBool(
        process.env["MARIA_TELEMETRY"],
        true,
      ),
    };

    // Remove undefined values to let defaults take precedence
    const cleanedConfig = ConfigManager.removeUndefined(envConfig);

    return new ConfigManager(cleanedConfig, "env");
  }

  // Configuration hierarchy: defaults < file < env < CLI
  static async loadHierarchical(
    options: {
      configPath?: string;
      cliOptions?: DeepPartial<ValidatedConfig>;
    } = {},
  ): Promise<ConfigManager> {
    try {
      // 1. Start with defaults
      const manager = new ConfigManager({}, "defaults");

      // 2. Layer file configuration
      try {
        const fileConfig = await ConfigManager.loadFromFile(
          options.configPath,
        );
        if (fileConfig) {
          manager.mergeAndValidate(fileConfig, "file");
        }
      } catch (innerError) {
        // File loading errors are not fatal - continue with env/cli
        console.warn(
          `Warning: Could not load config file - ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      // 3. Layer environment configuration
      const envManager = ConfigManager.fromEnvironment();
      manager.mergeAndValidate(envManager.config, "env");

      // 4. Layer CLI options (highest priority)
      if (options.cliOptions && Object.keys(options.cliOptions).length > 0) {
        manager.mergeAndValidate(options.cliOptions, "cli");
      }

      return manager;
    } catch (error) {
      throw new ConfigLoadError(
        `Failed to load hierarchical configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private static removeUndefined(obj: any): any {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          const nested = ConfigManager.removeUndefined(value);
          if (Object.keys(nested).length > 0) {
            result[key] = nested;
          }
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }

  private static async loadFromFile(
    configPath?: string,
  ): Promise<DeepPartial<ValidatedConfig> | null> {
    const { importNodeBuiltin } = await import("../utils/import-helper.js");
    const fs = (await importNodeBuiltin("fs")) as typeof import("fs");
    const _path = (await importNodeBuiltin("path")) as typeof import("path");
    const os = (await importNodeBuiltin("os")) as typeof import("os");

    const targetPath =
      configPath || _path.join(os.homedir(), ".maria", "config.json");

    try {
      const data = await fs.promises.readFile(targetPath, "utf-8");
      return JSON.parse(data);
    } catch (innerError) {
      if ((error as any)?.code === "ENOENT") {
        return null; // File doesn't exist - not an error
      }
      throw new ConfigLoadError(
        `Failed to load config from ${targetPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async save(
    configPath?: string,
    options?: {
      maskSensitive?: boolean;
      includeSourceMap?: boolean;
      backup?: boolean;
    },
  ): Promise<void> {
    const { importNodeBuiltin } = await import("../utils/import-helper.js");
    const fs = (await importNodeBuiltin("fs")) as typeof import("fs");
    const _path = (await importNodeBuiltin("path")) as typeof import("path");
    const os = (await importNodeBuiltin("os")) as typeof import("os");

    const targetPath =
      configPath || _path.join(os.homedir(), ".maria", "config.json");

    try {
      // Create backup if requested
      if (options?.backup) {
        try {
          await fs.promises.access(targetPath);
          const backupPath = `${targetPath}.backup.${Date.now()}`;
          await fs.promises.copyFile(targetPath, backupPath);
        } catch {
          // Backup failed or original doesn't exist - continue
        }
      }

      // Ensure directory exists
      await fs.promises.mkdir(_path.dirname(targetPath), { recursive: true });

      // Prepare data to save
      const dataToSave = this.getAll({
        maskSensitive: options?.maskSensitive ?? true,
        includeSourceMap: options?.includeSourceMap ?? false,
      });

      // Save configuration with secure permissions (owner read/write only)
      await fs.promises.writeFile(
        targetPath,
        JSON.stringify(dataToSave, null, 2),
        { mode: 0o600 },
      );

      console.log(`✅ Configuration saved to ${targetPath}`);
    } catch (error) {
      throw new ConfigLoadError(
        `Failed to save configuration to ${targetPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  // Enhanced loading with automatic fallback chain
  static async load(configPath?: string): Promise<ConfigManager> {
    try {
      // Try hierarchical loading first
      return await ConfigManager.loadHierarchical({ configPath });
    } catch (innerError) {
      console.warn(
        "Hierarchical config loading failed, falling back to environment:",
        error,
      );
      // Fallback to environment-only config
      return ConfigManager.fromEnvironment();
    }
  }

  // Export configuration in various formats
  async export(
    format: "json" | "yaml" | "env",
    outputPath?: string,
  ): Promise<string> {
    const config = this.getAll({ maskSensitive: false });
    let content: string;

    switch (format) {
      case "json":
        content = JSON.stringify(config, null, 2);
        break;
      case "yaml":
        content = this.toYamlLike(config);
        break;
      case "env":
        content = this.toEnvFormat(config);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    if (outputPath) {
      const { importNodeBuiltin } = await import("../utils/import-helper.js");
      const fs = (await importNodeBuiltin("fs")) as typeof import("fs");
      const _path = (await importNodeBuiltin(
        "path",
      )) as typeof import("path");

      await fs.promises.mkdir(_path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, content, "utf-8");
      console.log(`✅ Configuration exported to ${outputPath}`);
    }

    return content;
  }

  private toEnvFormat(config: ValidatedConfig): string {
    const envVars: string[] = [];

    // Simple flattening for environment variables
    const flatten = (obj: any, prefix = ""): void => {
      for (const [key, value] of Object.entries(obj)) {
        const envKey = prefix
          ? `${prefix}_${key.toUpperCase()}`
          : key.toUpperCase();

        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          flatten(value, envKey);
        } else if (Array.isArray(value)) {
          envVars.push(`${envKey}=${value.join(",")}`);
        } else {
          envVars.push(`${envKey}=${value}`);
        }
      }
    };

    flatten(config, "MARIA");
    return envVars.join("\n");
  }

  // Configuration diff and merge preview
  previewMerge(newConfig: DeepPartial<ValidatedConfig>): {
    changes: Array<{
      field: string;
      current: any;
      new: any;
      action: "add" | "update" | "remove";
    }>;
    warnings: string[];
  } {
    const changes: any[] = [];
    const warnings: string[] = [];

    try {
      const mergedConfig = deepMerge(this.config, newConfig);

      // Compare configurations to identify changes
      const compareObjects = (current: any, updated: any, _path = ""): void => {
        const allKeys = new Set([
          ...Object.keys(current || object),
          ...Object.keys(updated || object),
        ]);

        for (const key of allKeys) {
          const fieldPath = _path ? `${_path}.${key}` : key;
          const currentValue = current?.[key];
          const updatedValue = updated?.[key];

          if (currentValue === undefined && updatedValue !== undefined) {
            changes.push({
              field: fieldPath,
              current: undefined,
              new: updatedValue,
              action: "add",
            });
          } else if (currentValue !== undefined && updatedValue === undefined) {
            changes.push({
              field: fieldPath,
              current: currentValue,
              new: undefined,
              action: "remove",
            });
          } else if (
            JSON.stringify(currentValue) !== JSON.stringify(updatedValue)
          ) {
            if (
              typeof currentValue === "object" &&
              typeof updatedValue === "object"
            ) {
              compareObjects(currentValue, updatedValue, fieldPath);
            } else {
              changes.push({
                field: fieldPath,
                current: currentValue,
                new: updatedValue,
                action: "update",
              });
            }
          }
        }
      };

      compareObjects(this.config, mergedConfig);

      // Validate merged config to catch potential issues
      try {
        this.validateAndTransform(mergedConfig);
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          warnings.push(`Validation warning: ${error.message}`);
        }
      }
    } catch (innerError) {
      warnings.push(
        `Merge preview failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return { changes, warnings };
  }
}
