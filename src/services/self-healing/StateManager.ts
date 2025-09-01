/**
 * State Manager
 * Manages checkpoints and rollback functionality for self-healing
 */

import { logger } from "../../utils/logger";
import { FixAction, HealResult } from "./types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export interface Checkpoint {
  id: string;
  timestamp: number;
  description: string;
  backups: BackupEntry[];
  configSnapshots: ConfigSnapshot[];
  metadata: {
    planId: string;
    actions: FixAction[];
    riskScore: number;
  };
}

export interface BackupEntry {
  originalPath: string;
  backupPath: string;
  type: "file" | "directory";
  size: number;
  checksum?: string;
}

export interface ConfigSnapshot {
  configPath: string;
  content: string;
  checksum: string;
}

export interface RollbackOptions {
  dryRun?: boolean;
  selective?: string[]; // Only rollback specific file patterns
  preserveChanges?: boolean; // Try to preserve user changes made after checkpoint
}

export class StateManager {
  private readonly checkpointsDir: string;
  private readonly maxCheckpoints = 10;
  private readonly maxCheckpointAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    this.checkpointsDir = path.join(os.homedir(), ".maria", "checkpoints");
  }

  /**
   * Initialize checkpoints directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.checkpointsDir, { recursive: true });
      logger.debug(
        `StateManager: Initialized checkpoints directory at ${this.checkpointsDir}`,
      );
    } catch (error) {
      logger.error(
        "StateManager: Failed to initialize checkpoints directory:",
        error,
      );
      throw error;
    }
  }

  /**
   * Create a checkpoint before applying changes
   */
  async createCheckpoint(
    planId: string,
    description: string,
    actions: FixAction[],
    riskScore: number,
  ): Promise<string> {
    const checkpointId = `${planId}_${Date.now()}`;
    const timestamp = Date.now();

    try {
      // Create checkpoint directory
      const checkpointPath = path.join(this.checkpointsDir, checkpointId);
      await fs.mkdir(checkpointPath, { recursive: true });

      // Create backups for files that will be modified
      const backups = await this.createBackups(actions, checkpointPath);

      // Create config snapshots
      const configSnapshots = await this.createConfigSnapshots(
        actions,
        checkpointPath,
      );

      const checkpoint: Checkpoint = {
        id: checkpointId,
        timestamp,
        description,
        backups,
        configSnapshots,
        metadata: {
          planId,
          actions,
          riskScore,
        },
      };

      // Save checkpoint metadata
      const metadataPath = path.join(checkpointPath, "checkpoint.json");
      await fs.writeFile(
        metadataPath,
        JSON.stringify(checkpoint, null, 2),
        "utf-8",
      );

      logger.info(
        `StateManager: Created checkpoint ${checkpointId} - ${description}`,
      );

      // Clean up old checkpoints
      await this.cleanupOldCheckpoints();

      return checkpointId;
    } catch (error) {
      logger.error(
        `StateManager: Failed to create checkpoint ${checkpointId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Rollback to a specific checkpoint
   */
  async rollback(
    checkpointId: string,
    options: RollbackOptions = {},
  ): Promise<HealResult> {
    try {
      const checkpoint = await this.loadCheckpoint(checkpointId);
      const results: any[] = [];

      if (options.dryRun) {
        // Preview what would be rolled back
        for (const backup of checkpoint.backups) {
          if (this.shouldRollbackFile(backup.originalPath, options.selective)) {
            results.push({
              action: "would_restore",
              file: backup.originalPath,
              size: backup.size,
            });
          }
        }

        for (const config of checkpoint.configSnapshots) {
          if (this.shouldRollbackFile(config.configPath, options.selective)) {
            results.push({
              action: "would_restore_config",
              file: config.configPath,
            });
          }
        }

        return {
          success: true,
          message: `Rollback preview for checkpoint ${checkpointId}`,
          details: {
            actions: results,
            recipesApplied: [],
            recipesFailed: [],
            recipesSkipped: [],
            duration: 0,
          },
        };
      }

      // Perform actual rollback
      logger.info(
        `StateManager: Starting rollback to checkpoint ${checkpointId}`,
      );

      // Restore files
      for (const backup of checkpoint.backups) {
        if (this.shouldRollbackFile(backup.originalPath, options.selective)) {
          try {
            await this.restoreFile(backup, options.preserveChanges);
            results.push({
              action: "restored",
              file: backup.originalPath,
              success: true,
            });
          } catch (error) {
            logger.warn(
              `StateManager: Failed to restore ${backup.originalPath}:`,
              error,
            );
            results.push({
              action: "restore_failed",
              file: backup.originalPath,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      }

      // Restore configurations
      for (const config of checkpoint.configSnapshots) {
        if (this.shouldRollbackFile(config.configPath, options.selective)) {
          try {
            await this.restoreConfig(config);
            results.push({
              action: "restored_config",
              file: config.configPath,
              success: true,
            });
          } catch (error) {
            logger.warn(
              `StateManager: Failed to restore config ${config.configPath}:`,
              error,
            );
            results.push({
              action: "restore_config_failed",
              file: config.configPath,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success && r.error).length;

      logger.info(
        `StateManager: Rollback completed - ${successCount} restored, ${failureCount} failed`,
      );

      return {
        success: failureCount === 0,
        message: `Rollback completed: ${successCount} items restored, ${failureCount} failed`,
        details: {
          checkpointId: checkpoint.id,
          actions: results,
          recipesApplied: [],
          recipesFailed: [],
          recipesSkipped: [],
          duration: 0,
        },
      };
    } catch (error) {
      logger.error(
        `StateManager: Rollback failed for checkpoint ${checkpointId}:`,
        error,
      );
      return {
        success: false,
        message: `Rollback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        details: {
          checkpointId: checkpointId,
          actions: [],
          recipesApplied: [],
          recipesFailed: [],
          recipesSkipped: [],
          duration: 0,
        },
      };
    }
  }

  /**
   * List available checkpoints
   */
  async listCheckpoints(): Promise<Checkpoint[]> {
    try {
      const entries = await fs.readdir(this.checkpointsDir, {
        withFileTypes: true,
      });
      const checkpoints: Checkpoint[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const checkpoint = await this.loadCheckpoint(entry.name);
            checkpoints.push(checkpoint);
          } catch (error) {
            logger.warn(
              `StateManager: Failed to load checkpoint ${entry.name}:`,
              error,
            );
          }
        }
      }

      // Sort by timestamp (newest first)
      return checkpoints.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error("StateManager: Failed to list checkpoints:", error);
      return [];
    }
  }

  /**
   * Remove a specific checkpoint
   */
  async removeCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      const checkpointPath = path.join(this.checkpointsDir, checkpointId);
      await fs.rm(checkpointPath, { recursive: true, force: true });
      logger.info(`StateManager: Removed checkpoint ${checkpointId}`);
      return true;
    } catch (error) {
      logger.error(
        `StateManager: Failed to remove checkpoint ${checkpointId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get checkpoint details
   */
  async getCheckpointDetails(checkpointId: string): Promise<Checkpoint | null> {
    try {
      return await this.loadCheckpoint(checkpointId);
    } catch (error) {
      logger.warn(
        `StateManager: Failed to get checkpoint details for ${checkpointId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Create backups for files that will be modified
   */
  private async createBackups(
    actions: FixAction[],
    checkpointPath: string,
  ): Promise<BackupEntry[]> {
    const backups: BackupEntry[] = [];
    const backupDir = path.join(checkpointPath, "backups");
    await fs.mkdir(backupDir, { recursive: true });

    for (const action of actions) {
      const filesToBackup = this.extractFilePathsFromAction(action);

      for (const filePath of filesToBackup) {
        try {
          // Resolve path
          const resolvedPath = this.resolvePath(filePath);

          // Check if file exists
          const stats = await fs.stat(resolvedPath);

          // Create backup
          const backupFileName = this.sanitizeFileName(resolvedPath);
          const backupPath = path.join(backupDir, backupFileName);

          await fs.copyFile(resolvedPath, backupPath);

          backups.push({
            originalPath: resolvedPath,
            backupPath,
            type: stats.isDirectory() ? "directory" : "file",
            size: stats.size,
            checksum: await this.calculateChecksum(resolvedPath),
          });
        } catch (error) {
          // File doesn't exist, skip backup
          logger.debug(
            `StateManager: Skipping backup for non-existent file: ${filePath}`,
          );
        }
      }
    }

    return backups;
  }

  /**
   * Create config snapshots
   */
  private async createConfigSnapshots(
    actions: FixAction[],
    checkpointPath: string,
  ): Promise<ConfigSnapshot[]> {
    const snapshots: ConfigSnapshot[] = [];
    const configDir = path.join(checkpointPath, "configs");
    await fs.mkdir(configDir, { recursive: true });

    const configPaths = new Set<string>();

    // Extract config paths from actions
    for (const action of actions) {
      if (action.type.startsWith("config:") && action.args.configPath) {
        configPaths.add(action.args.configPath);
      }
    }

    for (const configPath of Array.from(configPaths)) {
      try {
        const resolvedPath = this.resolvePath(configPath);
        const content = await fs.readFile(resolvedPath, "utf-8");
        const checksum = this.calculateStringChecksum(content);

        snapshots.push({
          configPath: resolvedPath,
          content,
          checksum,
        });
      } catch (error) {
        // Config doesn't exist, create empty snapshot
        logger.debug(`StateManager: Config file doesn't exist: ${configPath}`);
        snapshots.push({
          configPath: this.resolvePath(configPath),
          content: "",
          checksum: this.calculateStringChecksum(""),
        });
      }
    }

    return snapshots;
  }

  /**
   * Load checkpoint from disk
   */
  private async loadCheckpoint(checkpointId: string): Promise<Checkpoint> {
    const metadataPath = path.join(
      this.checkpointsDir,
      checkpointId,
      "checkpoint.json",
    );
    const content = await fs.readFile(metadataPath, "utf-8");
    return JSON.parse(content) as Checkpoint;
  }

  /**
   * Extract file paths from action
   */
  private extractFilePathsFromAction(action: FixAction): string[] {
    const paths: string[] = [];

    if (action.args.path) paths.push(action.args.path);
    if (action.args.configPath) paths.push(action.args.configPath);
    if (action.args.backupPath) paths.push(action.args.backupPath);
    if (action.args.paths && Array.isArray(action.args.paths)) {
      paths.push(...action.args.paths);
    }

    return paths.filter(Boolean);
  }

  /**
   * Resolve tilde and relative paths
   */
  private resolvePath(filePath: string): string {
    if (filePath.startsWith("~/")) {
      return path.join(os.homedir(), filePath.slice(2));
    }
    return path.resolve(filePath);
  }

  /**
   * Sanitize filename for backup storage
   */
  private sanitizeFileName(filePath: string): string {
    return filePath.replace(/[/\\:*?"<>|]/g, "_");
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = require("crypto");
    const content = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Calculate string checksum
   */
  private calculateStringChecksum(content: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
  }

  /**
   * Check if file should be rolled back based on selective patterns
   */
  private shouldRollbackFile(filePath: string, selective?: string[]): boolean {
    if (!selective || selective.length === 0) return true;

    for (const pattern of selective) {
      if (filePath.includes(pattern)) return true;
    }

    return false;
  }

  /**
   * Restore a file from backup
   */
  private async restoreFile(
    backup: BackupEntry,
    preserveChanges?: boolean,
  ): Promise<void> {
    if (preserveChanges) {
      // Check if original file was modified after checkpoint
      try {
        const currentChecksum = await this.calculateChecksum(
          backup.originalPath,
        );
        if (currentChecksum !== backup.checksum) {
          logger.warn(
            `StateManager: File ${backup.originalPath} was modified after checkpoint, preserving changes`,
          );
          return;
        }
      } catch {
        // File doesn't exist anymore, proceed with restore
      }
    }

    await fs.copyFile(backup.backupPath, backup.originalPath);
    logger.debug(`StateManager: Restored ${backup.originalPath} from backup`);
  }

  /**
   * Restore configuration from snapshot
   */
  private async restoreConfig(config: ConfigSnapshot): Promise<void> {
    if (config.content === "") {
      // Original config was empty, remove if exists
      try {
        await fs.unlink(config.configPath);
      } catch {
        // Ignore if doesn't exist
      }
    } else {
      // Ensure directory exists
      await fs.mkdir(path.dirname(config.configPath), { recursive: true });
      await fs.writeFile(config.configPath, config.content, "utf-8");
    }

    logger.debug(`StateManager: Restored config ${config.configPath}`);
  }

  /**
   * Clean up old checkpoints
   */
  private async cleanupOldCheckpoints(): Promise<void> {
    try {
      const checkpoints = await this.listCheckpoints();
      const now = Date.now();

      // Remove checkpoints older than maxCheckpointAge
      const toRemove = checkpoints.filter(
        (cp) => now - cp.timestamp > this.maxCheckpointAge,
      );

      // If we still have too many, remove oldest ones
      if (checkpoints.length > this.maxCheckpoints) {
        const excess = checkpoints.length - this.maxCheckpoints;
        toRemove.push(...checkpoints.slice(-excess));
      }

      for (const checkpoint of toRemove) {
        await this.removeCheckpoint(checkpoint.id);
        logger.debug(
          `StateManager: Cleaned up old checkpoint ${checkpoint.id}`,
        );
      }
    } catch (error) {
      logger.warn("StateManager: Failed to cleanup old checkpoints:", error);
    }
  }
}
