/**
 * Config Action Executor
 * Handles configuration file operations for self-healing
 */

import { FixAction } from "../types";
import { logger } from "../../../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export class ConfigActionExecutor {
  private readonly DEFAULT_CONFIG_PATH = path.join(
    os.homedir(),
    ".maria",
    "config.json",
  );

  /**
   * Execute config action
   */
  async execute(action: FixAction, options: { dryRun: boolean }): Promise<any> {
    const { type, args } = action;
    const [, operation] = type.split(":");

    switch (operation) {
      case "backup":
        return this.backupConfig(args.configPath, args.key, options);

      case "setDefault":
        return this.setDefault(
          args.configPath,
          args.key,
          args.candidateOrder || args.value,
          options,
        );

      case "restore":
        return this.restoreConfig(
          args.configPath,
          args.key,
          args.backupPath,
          options,
        );

      default:
        throw new Error(`Unknown config operation: ${operation}`);
    }
  }

  /**
   * Backup configuration
   */
  private async backupConfig(
    configPath: string | undefined,
    key: string,
    options: { dryRun: boolean },
  ): Promise<any> {
    const resolvedPath = this.resolveConfigPath(configPath);
    const backupPath = `${resolvedPath}.bak`;

    if (options.dryRun) {
      return {
        action: "would_backup_config",
        configPath: resolvedPath,
        backupPath,
        key,
      };
    }

    try {
      // Ensure config directory exists
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      let config = {};
      try {
        const content = await fs.readFile(resolvedPath, "utf-8");
        config = JSON.parse(content);
      } catch {
        // Config doesn't exist, create empty one
        config = {};
      }

      // Create backup
      await fs.writeFile(backupPath, JSON.stringify(config, null, 2), "utf-8");

      logger.info(`Backed up config ${key} to ${backupPath}`);

      return {
        action: "backed_up_config",
        configPath: resolvedPath,
        backupPath,
        key,
      };
    } catch (error) {
      logger.error(`Failed to backup config ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set default configuration value
   */
  private async setDefault(
    configPath: string | undefined,
    key: string,
    valueOrCandidates: any,
    options: { dryRun: boolean },
  ): Promise<any> {
    const resolvedPath = this.resolveConfigPath(configPath);

    if (options.dryRun) {
      return {
        action: "would_set_default",
        configPath: resolvedPath,
        key,
        value: valueOrCandidates,
      };
    }

    try {
      // Ensure config directory exists
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      let config = {};
      try {
        const content = await fs.readFile(resolvedPath, "utf-8");
        config = JSON.parse(content);
      } catch {
        // Config doesn't exist, create empty one
        config = {};
      }

      // Determine the value to set
      let newValue: any;

      if (Array.isArray(valueOrCandidates)) {
        // Choose from candidate order (e.g., for model selection)
        newValue = await this.selectFromCandidates(valueOrCandidates, key);
      } else {
        newValue = valueOrCandidates;
      }

      // Set the value
      this.setNestedValue(config, key, newValue);

      // Write back to file
      await fs.writeFile(
        resolvedPath,
        JSON.stringify(config, null, 2),
        "utf-8",
      );

      logger.info(`Set config ${key} to ${newValue}`);

      return {
        action: "set_default",
        configPath: resolvedPath,
        key,
        value: newValue,
      };
    } catch (error) {
      logger.error(`Failed to set config ${key}:`, error);
      throw error;
    }
  }

  /**
   * Restore configuration from backup
   */
  private async restoreConfig(
    configPath: string | undefined,
    key: string,
    backupPath: string | undefined,
    options: { dryRun: boolean },
  ): Promise<any> {
    const resolvedPath = this.resolveConfigPath(configPath);
    const resolvedBackupPath = backupPath || `${resolvedPath}.bak`;

    if (options.dryRun) {
      return {
        action: "would_restore_config",
        configPath: resolvedPath,
        backupPath: resolvedBackupPath,
        key,
      };
    }

    try {
      // Read backup
      const backupContent = await fs.readFile(resolvedBackupPath, "utf-8");
      const backupConfig = JSON.parse(backupContent);

      // Write back to original
      await fs.writeFile(
        resolvedPath,
        JSON.stringify(backupConfig, null, 2),
        "utf-8",
      );

      // Clean up backup
      try {
        await fs.unlink(resolvedBackupPath);
      } catch {
        // Ignore cleanup errors
      }

      logger.info(`Restored config ${key} from backup`);

      return {
        action: "restored_config",
        configPath: resolvedPath,
        backupPath: resolvedBackupPath,
        key,
      };
    } catch (error) {
      logger.error(`Failed to restore config ${key}:`, error);
      throw error;
    }
  }

  /**
   * Select best candidate from list (e.g., for model selection)
   */
  private async selectFromCandidates(
    candidates: string[],
    key: string,
  ): Promise<string> {
    // For model selection, we'd typically check availability
    // For now, just return the first candidate

    if (key === "defaultModel") {
      // Simulate model availability check
      for (const candidate of candidates) {
        if (await this.isModelAvailable(candidate)) {
          return candidate;
        }
      }
    }

    // Fallback to first candidate
    return candidates[0] || "gpt-4o";
  }

  /**
   * Check if a model is available (simplified)
   */
  private async isModelAvailable(modelId: string): Promise<boolean> {
    // This would typically check with provider APIs
    // For now, implement basic logic

    const cloudModels = ["gpt-4o", "claude-3-opus", "gemini-pro"];
    const localModels = ["llama-3", "mistral-7b"];

    if (cloudModels.includes(modelId)) {
      // Would check API keys and connectivity
      return true; // Simplified
    }

    if (localModels.includes(modelId)) {
      // Would check local model server availability
      return false; // Simplified - assume local not running
    }

    return false;
  }

  /**
   * Set nested configuration value using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Resolve configuration file path
   */
  private resolveConfigPath(configPath?: string): string {
    if (configPath) {
      if (configPath.startsWith("~/")) {
        return path.join(os.homedir(), configPath.slice(2));
      }
      return path.resolve(configPath);
    }

    return this.DEFAULT_CONFIG_PATH;
  }
}
