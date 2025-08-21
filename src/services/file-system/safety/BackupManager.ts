/**
 * Backup Manager - Automatic Backup System for Destructive Operations
 * Creates and manages backups before dangerous file operations
 * Phase 2: Terminal Integration & Safety - Week 7
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import chalk from 'chalk';

export interface BackupConfig {
  enabled: boolean;
  backupDirectory: string;
  maxBackupSize: number; // in bytes
  maxBackupAge: number; // in days
  compressionEnabled: boolean;
  incrementalBackups: boolean;
  autoCleanup: boolean;
}

export interface BackupItem {
  id: string;
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  size: number;
  checksum: string;
  type: 'file' | 'directory';
  operation: string;
  metadata: {
    permissions: string;
    owner: string;
    group: string;
    mtime: Date;
    atime: Date;
  };
}

export interface BackupResult {
  success: boolean;
  backupId?: string;
  backupPath?: string;
  size?: number;
  message?: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredPath?: string;
  message?: string;
  error?: string;
}

export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  oldestBackup?: Date;
  newestBackup?: Date;
  diskUsage: number;
}

export class BackupManager {
  private static instance: BackupManager;
  private config: BackupConfig;
  private backupItems: Map<string, BackupItem> = new Map();
  private metadataFile: string;

  public static getInstance(): BackupManager {
    if (!BackupManager.instance) {
      BackupManager.instance = new BackupManager();
    }
    return BackupManager.instance;
  }

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializeBackupDirectory();
  }

  /**
   * Initialize backup manager
   */
  async initialize(): Promise<boolean> {
    try {
      await this.loadBackupMetadata();
      await this.setupBackupDirectory();

      if (this.config.autoCleanup) {
        await this.cleanupOldBackups();
      }

      console.debug('Backup manager initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize backup manager:', error);
      return false;
    }
  }

  /**
   * Create backup before destructive operation
   */
  async createBackup(
    filePath: string,
    operation: string,
    options: { force?: boolean; compress?: boolean } = {},
  ): Promise<BackupResult> {
    if (!this.config.enabled && !options.force) {
      return {
        success: true,
        message: 'Backups disabled - skipping',
      };
    }

    try {
      const resolvedPath = path.resolve(filePath);

      // Check if file exists
      if (!(await this.exists(resolvedPath))) {
        return {
          success: false,
          error: `File does not exist: ${resolvedPath}`,
        };
      }

      // Check available space
      const stats = await fs.promises.stat(resolvedPath);
      if (stats.size > this.config.maxBackupSize) {
        return {
          success: false,
          error: `File too large for backup: ${this.formatSize(stats.size)} > ${this.formatSize(this.config.maxBackupSize)}`,
        };
      }

      // Generate backup ID and path
      const backupId = this.generateBackupId();
      const backupPath = await this.generateBackupPath(resolvedPath, backupId);

      // Create backup
      if (stats.isDirectory()) {
        await this.backupDirectory(resolvedPath, backupPath, options.compress);
      } else {
        await this.backupFile(resolvedPath, backupPath, options.compress);
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(resolvedPath);

      // Create backup metadata
      const backupItem: BackupItem = {
        id: backupId,
        originalPath: resolvedPath,
        backupPath,
        timestamp: new Date(),
        size: stats.size,
        checksum,
        type: stats.isDirectory() ? 'directory' : 'file',
        operation,
        metadata: {
          permissions: (stats.mode & 0o777).toString(8),
          owner: 'unknown', // Enhanced in production
          group: 'unknown',
          mtime: stats.mtime,
          atime: stats.atime,
        },
      };

      // Store backup metadata
      this.backupItems.set(backupId, backupItem);
      await this.saveBackupMetadata();

      return {
        success: true,
        backupId,
        backupPath,
        size: stats.size,
        message: `Backup created: ${path.basename(resolvedPath)}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(
    backupId: string,
    targetPath?: string,
    options: { overwrite?: boolean; verifyChecksum?: boolean } = {},
  ): Promise<RestoreResult> {
    try {
      const backupItem = this.backupItems.get(backupId);
      if (!backupItem) {
        return {
          success: false,
          error: `Backup not found: ${backupId}`,
        };
      }

      // Determine restore path
      const restorePath = targetPath || backupItem.originalPath;

      // Check if target exists and handle overwrite
      if ((await this.exists(restorePath)) && !options.overwrite) {
        const alternativePath = await this.findAlternativePath(restorePath);
        return await this.restoreBackup(backupId, alternativePath, options);
      }

      // Verify backup integrity if requested
      if (options.verifyChecksum && backupItem.checksum) {
        const currentChecksum = await this.calculateChecksum(backupItem.backupPath);
        if (currentChecksum !== backupItem.checksum) {
          return {
            success: false,
            error: 'Backup integrity check failed - checksum mismatch',
          };
        }
      }

      // Restore backup
      if (backupItem.type === 'directory') {
        await this.restoreDirectory(backupItem.backupPath, restorePath);
      } else {
        await this.restoreFile(backupItem.backupPath, restorePath);
      }

      // Restore metadata
      try {
        await fs.promises.chmod(restorePath, parseInt(backupItem.metadata.permissions, 8));
        await fs.promises.utimes(restorePath, backupItem.metadata.atime, backupItem.metadata.mtime);
      } catch {
        // Ignore metadata restoration errors
      }

      return {
        success: true,
        restoredPath: restorePath,
        message: `Restored from backup: ${path.basename(restorePath)}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List all backups
   */
  getBackups(): BackupItem[] {
    return Array.from(this.backupItems.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  /**
   * Get backups for specific path
   */
  getBackupsForPath(filePath: string): BackupItem[] {
    const resolvedPath = path.resolve(filePath);
    return this.getBackups().filter((backup) => backup.originalPath === resolvedPath);
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<BackupResult> {
    try {
      const backupItem = this.backupItems.get(backupId);
      if (!backupItem) {
        return {
          success: false,
          error: `Backup not found: ${backupId}`,
        };
      }

      // Delete backup files
      if (await this.exists(backupItem.backupPath)) {
        if (backupItem.type === 'directory') {
          await fs.promises.rm(backupItem.backupPath, { recursive: true, force: true });
        } else {
          await fs.promises.unlink(backupItem.backupPath);
        }
      }

      // Remove from metadata
      this.backupItems.delete(backupId);
      await this.saveBackupMetadata();

      return {
        success: true,
        message: `Backup deleted: ${backupId}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<BackupStats> {
    const backups = this.getBackups();

    if (backups.length === 0) {
      return {
        totalBackups: 0,
        totalSize: 0,
        diskUsage: 0,
      };
    }

    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    const timestamps = backups.map((backup) => backup.timestamp);

    // Calculate actual disk usage
    const diskUsage = await this.calculateDiskUsage();

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: new Date(Math.min(...timestamps.map((t) => t.getTime()))),
      newestBackup: new Date(Math.max(...timestamps.map((t) => t.getTime()))),
      diskUsage,
    };
  }

  /**
   * Clean up old backups
   */
  async cleanupOldBackups(): Promise<BackupResult> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.maxBackupAge);

      const oldBackups = Array.from(this.backupItems.entries()).filter(
        ([_, backup]) => backup.timestamp < cutoffDate,
      );

      let successCount = 0;
      let errorCount = 0;

      for (const [backupId, _] of oldBackups) {
        const result = await this.deleteBackup(backupId);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      return {
        success: errorCount === 0,
        message: `Cleaned up ${successCount} old backups${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Configure backup settings
   */
  updateConfig(newConfig: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(chalk.green('✅ Backup configuration updated'));
  }

  /**
   * Get current configuration
   */
  getConfig(): BackupConfig {
    return { ...this.config };
  }

  /**
   * Show backup status
   */
  async showStatus(): Promise<void> {
    const stats = await this.getBackupStats();

    console.log(chalk.blue('\n💾 Backup Manager Status'));
    console.log(`Enabled: ${this.config.enabled ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`Total backups: ${chalk.yellow(stats.totalBackups)}`);
    console.log(`Total size: ${chalk.yellow(this.formatSize(stats.totalSize))}`);
    console.log(`Disk usage: ${chalk.yellow(this.formatSize(stats.diskUsage))}`);
    console.log(`Backup directory: ${chalk.gray(this.config.backupDirectory)}`);

    if (stats.oldestBackup && stats.newestBackup) {
      console.log(`Oldest backup: ${chalk.gray(stats.oldestBackup.toLocaleString())}`);
      console.log(`Newest backup: ${chalk.gray(stats.newestBackup.toLocaleString())}`);
    }
  }

  /**
   * List backups with formatting
   */
  listBackups(): void {
    const backups = this.getBackups();

    console.log(chalk.blue('\n💾 Available Backups'));

    if (backups.length === 0) {
      console.log(chalk.gray('No backups available'));
      return;
    }

    backups.forEach((backup) => {
      const age = this.formatAge(backup.timestamp);
      const size = this.formatSize(backup.size);
      const fileName = path.basename(backup.originalPath);

      console.log(
        `${chalk.cyan(backup.id.substr(0, 8))} ${chalk.yellow(fileName)} ${chalk.gray(`(${backup.operation})`)} ${chalk.gray(size)} ${chalk.gray(age)}`,
      );
    });
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): BackupConfig {
    return {
      enabled: true,
      backupDirectory: path.join(os.tmpdir(), 'maria-backups'),
      maxBackupSize: 100 * 1024 * 1024, // 100MB
      maxBackupAge: 7, // 7 days
      compressionEnabled: false,
      incrementalBackups: false,
      autoCleanup: true,
    };
  }

  /**
   * Initialize backup directory
   */
  private initializeBackupDirectory(): void {
    this.metadataFile = path.join(this.config.backupDirectory, 'backups.json');
  }

  /**
   * Setup backup directory
   */
  private async setupBackupDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.config.backupDirectory, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create backup directory: ${error}`);
    }
  }

  /**
   * Generate backup ID
   */
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate backup path
   */
  private async generateBackupPath(originalPath: string, backupId: string): Promise<string> {
    const fileName = path.basename(originalPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.config.backupDirectory, `${timestamp}_${backupId}_${fileName}`);
  }

  /**
   * Backup file
   */
  private async backupFile(
    sourcePath: string,
    backupPath: string,
    compress?: boolean,
  ): Promise<void> {
    if (compress && this.config.compressionEnabled) {
      // TODO: Implement compression
      await fs.promises.copyFile(sourcePath, backupPath);
    } else {
      await fs.promises.copyFile(sourcePath, backupPath);
    }
  }

  /**
   * Backup directory
   */
  private async backupDirectory(
    sourcePath: string,
    backupPath: string,
    compress?: boolean,
  ): Promise<void> {
    await fs.promises.mkdir(backupPath, { recursive: true });
    await this.copyDirectoryRecursive(sourcePath, backupPath);
  }

  /**
   * Restore file
   */
  private async restoreFile(backupPath: string, targetPath: string): Promise<void> {
    // Ensure target directory exists
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.copyFile(backupPath, targetPath);
  }

  /**
   * Restore directory
   */
  private async restoreDirectory(backupPath: string, targetPath: string): Promise<void> {
    await this.copyDirectoryRecursive(backupPath, targetPath);
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectoryRecursive(sourcePath: string, targetPath: string): Promise<void> {
    await fs.promises.mkdir(targetPath, { recursive: true });

    const entries = await fs.promises.readdir(sourcePath, { withFileTypes: true });

    for (const entry of entries) {
      const sourceEntryPath = path.join(sourcePath, entry.name);
      const targetEntryPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectoryRecursive(sourceEntryPath, targetEntryPath);
      } else {
        await fs.promises.copyFile(sourceEntryPath, targetEntryPath);
      }
    }
  }

  /**
   * Calculate file/directory checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const stats = await fs.promises.stat(filePath);

      if (stats.isDirectory()) {
        // For directories, hash the directory structure
        return await this.calculateDirectoryChecksum(filePath);
      } else {
        // For files, hash the content
        const content = await fs.promises.readFile(filePath);
        return crypto.createHash('sha256').update(content).digest('hex');
      }
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Calculate directory checksum
   */
  private async calculateDirectoryChecksum(dirPath: string): Promise<string> {
    const hash = crypto.createHash('sha256');

    try {
      const files = await this.getAllFilesRecursive(dirPath);
      files.sort(); // Ensure consistent order

      for (const file of files) {
        const relativePath = path.relative(dirPath, file);
        hash.update(relativePath);

        try {
          const content = await fs.promises.readFile(file);
          hash.update(content);
        } catch {
          // Skip files we can't read
        }
      }
    } catch {
      // If we can't read directory, return error hash
      hash.update('error');
    }

    return hash.digest('hex');
  }

  /**
   * Get all files recursively
   */
  private async getAllFilesRecursive(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.getAllFilesRecursive(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Find alternative path if target exists
   */
  private async findAlternativePath(targetPath: string): Promise<string> {
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const name = path.basename(targetPath, ext);

    let counter = 1;
    let alternativePath: string;

    do {
      alternativePath = path.join(dir, `${name}_restored_${counter}${ext}`);
      counter++;
    } while (await this.exists(alternativePath));

    return alternativePath;
  }

  /**
   * Calculate disk usage
   */
  private async calculateDiskUsage(): Promise<number> {
    try {
      let totalSize = 0;
      const files = await this.getAllFilesRecursive(this.config.backupDirectory);

      for (const file of files) {
        try {
          const stats = await fs.promises.stat(file);
          totalSize += stats.size;
        } catch {
          // Skip files we can't stat
        }
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Load backup metadata
   */
  private async loadBackupMetadata(): Promise<void> {
    try {
      if (await this.exists(this.metadataFile)) {
        const data = await fs.promises.readFile(this.metadataFile, 'utf8');
        const items = JSON.parse(data);

        this.backupItems.clear();
        for (const item of items) {
          // Convert timestamp back to Date object
          item.timestamp = new Date(item.timestamp);
          item.metadata.mtime = new Date(item.metadata.mtime);
          item.metadata.atime = new Date(item.metadata.atime);
          this.backupItems.set(item.id, item);
        }
      }
    } catch (error) {
      console.warn('Failed to load backup metadata:', error);
      this.backupItems.clear();
    }
  }

  /**
   * Save backup metadata
   */
  private async saveBackupMetadata(): Promise<void> {
    try {
      const items = Array.from(this.backupItems.values());
      const data = JSON.stringify(items, null, 2);
      await fs.promises.writeFile(this.metadataFile, data);
    } catch (error) {
      console.warn('Failed to save backup metadata:', error);
    }
  }

  /**
   * Check if file exists
   */
  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format age
   */
  private formatAge(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`;
    } else {
      return 'just now';
    }
  }
}

export const backupManager = BackupManager.getInstance();
