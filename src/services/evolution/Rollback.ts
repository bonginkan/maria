/**
 * Rollback Manager - Handles configuration rollback and recovery
 */

import * as fs from "fs/promises";
import * as path from "path";
import { StateStore } from "./StateStore";

export interface RollbackPoint {
  version: string;
  timestamp: number;
  config: any;
  params: any;
}

export class Rollback {
  private backupDir = path.join(
    process.cwd(),
    ".maria",
    "evolution",
    "backups",
  );
  private configPaths = [
    "config/search-config.json",
    "config/language-config.json",
    "config/model-config.json",
    "config/analyzer-config.json",
  ];

  constructor(private store: StateStore) {}

  /**
   * Create a backup point before experiments
   */
  async createBackup(version: string): Promise<void> {
    const backupPath = path.join(this.backupDir, `${version}_${Date.now()}`);
    await fs.mkdir(backupPath, { recursive: true });

    // Backup all configuration files
    for (const configPath of this.configPaths) {
      const fullPath = path.join(process.cwd(), configPath);
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const backupFile = path.join(backupPath, path.basename(configPath));
        await fs.writeFile(backupFile, content);
      } catch (error) {
        // Skip if file doesn't exist
      }
    }

    // Save backup metadata
    const metadata: RollbackPoint = {
      version,
      timestamp: Date.now(),
      config: await this.getCurrentConfig(),
      params: this.store.getCurrentParams(),
    };

    await fs.writeFile(
      path.join(backupPath, "metadata.json"),
      JSON.stringify(metadata, null, 2),
    );
  }

  /**
   * Revert to a specific version
   */
  async revertTo(version: string): Promise<void> {
    // Find the backup for this version
    const backups = await this.listBackups();
    const backup = backups.find((b) => b.version === version);

    if (!backup) {
      throw new Error(`No backup found for version ${version}`);
    }

    await this.restoreBackup(backup);
  }

  /**
   * Emergency rollback to last stable version
   */
  async emergency(): Promise<void> {
    const lastStable = this.store.getLastStableVersion();
    await this.revertTo(lastStable);
  }

  /**
   * List available rollback points
   */
  async listBackups(): Promise<RollbackPoint[]> {
    try {
      const dirs = await fs.readdir(this.backupDir);
      const backups: RollbackPoint[] = [];

      for (const dir of dirs) {
        const metadataPath = path.join(this.backupDir, dir, "metadata.json");
        try {
          const content = await fs.readFile(metadataPath, "utf-8");
          backups.push(JSON.parse(content));
        } catch (error) {
          // Skip invalid backups
        }
      }

      // Sort by timestamp descending
      backups.sort((a, b) => b.timestamp - a.timestamp);
      return backups;
    } catch (error) {
      return [];
    }
  }

  /**
   * Clean old backups (keep last 30 days)
   */
  async cleanup(): Promise<void> {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const backups = await this.listBackups();

    for (const backup of backups) {
      if (backup.timestamp < cutoff) {
        const backupDir = path.join(
          this.backupDir,
          `${backup.version}_${backup.timestamp}`,
        );
        await fs.rm(backupDir, { recursive: true, force: true });
      }
    }
  }

  private async restoreBackup(backup: RollbackPoint): Promise<void> {
    const backupPath = path.join(
      this.backupDir,
      `${backup.version}_${backup.timestamp}`,
    );

    // Restore configuration files
    for (const configPath of this.configPaths) {
      const backupFile = path.join(backupPath, path.basename(configPath));
      const targetPath = path.join(process.cwd(), configPath);

      try {
        const content = await fs.readFile(backupFile, "utf-8");
        const dir = path.dirname(targetPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(targetPath, content);
      } catch (error) {
        // Skip if backup file doesn't exist
      }
    }
  }

  private async getCurrentConfig(): Promise<any> {
    const config: any = {};

    for (const configPath of this.configPaths) {
      const fullPath = path.join(process.cwd(), configPath);
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        config[path.basename(configPath, ".json")] = JSON.parse(content);
      } catch (error) {
        // Skip if file doesn't exist
      }
    }

    return config;
  }
}
