/**
 * Backup Manager - Automatic Backup System for Destructive Operations
 * Creates and manages _backups before dangerous file operations
 * Phase 2: Terminal Integration & Safety - Week 7
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import chalk from "chalk";

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
  _backupPath: string;
  _timestamp: Date;
  _size: number;
  _checksum: string;
  type: "file" | "directory";
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
  _backupId?: string;
  _backupPath?: string;
  _size?: number;
  message?: string;
  _error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredPath?: string;
  message?: string;
  _error?: string;
}

export interface BackupStats {
  totalBackups: number;
  _totalSize: number;
  oldestBackup?: Date;
  newestBackup?: Date;
  _diskUsage: number;
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

      console.debug("Backup manager initialized");
      return true;
    } catch (_error) {
      console._error("Failed to initialize backup manager:", _error);
      return false;
    }
  }

  /**
   * Create backup before destructive operation
   */
  async createBackup(
    _filePath: string,
    operation: string,
    options: { force?: boolean; compress?: boolean } = {},
  ): Promise<BackupResult> {
    if (!this.config.enabled && !options.force) {
      return {
        success: true,
        message: "Backups disabled - skipping",
      };
    }

    try {
      const _resolvedPath = path.resolve(_filePath);

      // Check if file exists
      if (!(await this.exists(_resolvedPath))) {
        return {
          success: false,
          _error: `File does not exist: ${_resolvedPath}`,
        };
      }

      // Check available space
      const _stats = await fs.promises.stat(_resolvedPath);
      if (_stats.size > this.config.maxBackupSize) {
        return {
          success: false,
          _error: `File too large for backup: ${this.formatSize(_stats.size)} > ${this.formatSize(this.config.maxBackupSize)}`,
        };
      }

      // Generate backup ID and path
      const _backupId = this.generateBackupId();
      const _backupPath = await this.generateBackupPath(
        _resolvedPath,
        _backupId,
      );

      // Create backup
      if (_stats.isDirectory()) {
        await this.backupDirectory(
          _resolvedPath,
          _backupPath,
          options.compress,
        );
      } else {
        await this.backupFile(_resolvedPath, _backupPath, options.compress);
      }

      // Calculate _checksum
      const _checksum = await this.calculateChecksum(_resolvedPath);

      // Create backup metadata
      const _backupItem: BackupItem = {
        id: _backupId,
        originalPath: _resolvedPath,
        _backupPath,
        _timestamp: new Date(),
        _size: _stats.size,
        _checksum,
        type: _stats.isDirectory() ? "directory" : "file",
        operation,
        metadata: {
          permissions: (_stats.mode & 0o777).toString(8),
          owner: "unknown", // Enhanced in production
          group: "unknown",
          mtime: _stats.mtime,
          atime: _stats.atime,
        },
      };

      // Store backup metadata
      this.backupItems.set(_backupId, _backupItem);
      await this.saveBackupMetadata();

      return {
        success: true,
        _backupId,
        _backupPath,
        _size: _stats.size,
        message: `Backup created: ${path.basename(_resolvedPath)}`,
      };
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(
    _backupId: string,
    targetPath?: string,
    options: { overwrite?: boolean; verifyChecksum?: boolean } = {},
  ): Promise<RestoreResult> {
    try {
      const _backupItem = this.backupItems.get(_backupId);
      if (!_backupItem) {
        return {
          success: false,
          _error: `Backup not found: ${_backupId}`,
        };
      }

      // Determine restore path
      const _restorePath = targetPath || _backupItem.originalPath;

      // Check if target exists and handle overwrite
      if ((await this.exists(_restorePath)) && !options.overwrite) {
        const _alternativePath = await this.findAlternativePath(_restorePath);
        return await this.restoreBackup(_backupId, _alternativePath, options);
      }

      // Verify backup integrity if requested
      if (options.verifyChecksum && _backupItem.checksum) {
        const _currentChecksum = await this.calculateChecksum(
          _backupItem.backupPath,
        );
        if (_currentChecksum !== _backupItem.checksum) {
          return {
            success: false,
            _error: "Backup integrity check failed - _checksum mismatch",
          };
        }
      }

      // Restore backup
      if (_backupItem.type === "directory") {
        await this.restoreDirectory(_backupItem.backupPath, _restorePath);
      } else {
        await this.restoreFile(_backupItem.backupPath, _restorePath);
      }

      // Restore metadata
      try {
        await fs.promises.chmod(
          _restorePath,
          parseInt(_backupItem.metadata.permissions, 8),
        );
        await fs.promises.utimes(
          _restorePath,
          _backupItem.metadata.atime,
          _backupItem.metadata.mtime,
        );
      } catch {
        // Ignore metadata restoration errors
      }

      return {
        success: true,
        restoredPath: _restorePath,
        message: `Restored from backup: ${path.basename(_restorePath)}`,
      };
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * List all _backups
   */
  getBackups(): BackupItem[] {
    return Array.from(this.backupItems.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  /**
   * Get _backups for specific path
   */
  getBackupsForPath(_filePath: string): BackupItem[] {
    const _resolvedPath = path.resolve(_filePath);
    return this.getBackups().filter(
      (backup) => backup.originalPath === _resolvedPath,
    );
  }

  /**
   * Delete backup
   */
  async deleteBackup(_backupId: string): Promise<BackupResult> {
    try {
      const _backupItem = this.backupItems.get(_backupId);
      if (!_backupItem) {
        return {
          success: false,
          _error: `Backup not found: ${_backupId}`,
        };
      }

      // Delete backup _files
      if (await this.exists(_backupItem.backupPath)) {
        if (_backupItem.type === "directory") {
          await fs.promises.rm(_backupItem.backupPath, {
            recursive: true,
            force: true,
          });
        } else {
          await fs.promises.unlink(_backupItem.backupPath);
        }
      }

      // Remove from metadata
      this.backupItems.delete(_backupId);
      await this.saveBackupMetadata();

      return {
        success: true,
        message: `Backup deleted: ${_backupId}`,
      };
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<BackupStats> {
    const _backups = this.getBackups();

    if (_backups.length === 0) {
      return {
        totalBackups: 0,
        _totalSize: 0,
        _diskUsage: 0,
      };
    }

    const _totalSize = _backups.reduce((sum, backup) => sum + backup.size, 0);
    const _timestamps = _backups.map((backup) => backup.timestamp);

    // Calculate actual disk usage
    const _diskUsage = await this.calculateDiskUsage();

    return {
      totalBackups: _backups.length,
      _totalSize,
      oldestBackup: new Date(Math.min(..._timestamps.map((t) => t.getTime()))),
      newestBackup: new Date(Math.max(..._timestamps.map((t) => t.getTime()))),
      _diskUsage,
    };
  }

  /**
   * Clean up old _backups
   */
  async cleanupOldBackups(): Promise<BackupResult> {
    try {
      const _cutoffDate = new Date();
      _cutoffDate.setDate(_cutoffDate.getDate() - this.config.maxBackupAge);

      const _oldBackups = Array.from(this.backupItems.entries()).filter(
        ([_, backup]) => backup.timestamp < _cutoffDate,
      );

      let successCount = 0;
      let errorCount = 0;

      for (const [_backupId, _] of _oldBackups) {
        const _result = await this.deleteBackup(_backupId);
        if (_result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      return {
        success: errorCount === 0,
        message: `Cleaned up ${successCount} old backups${errorCount > 0 ? `, ${errorCount} errors` : ""}`,
      };
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Configure backup settings
   */
  updateConfig(newConfig: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(chalk.green("✅ Backup configuration updated"));
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
    const _stats = await this.getBackupStats();

    console.log(chalk.blue("\n💾 Backup Manager Status"));
    console.log(
      `Enabled: ${this.config.enabled ? chalk.green("Yes") : chalk.red("No")}`,
    );
    console.log(`Total _backups: ${chalk.yellow(_stats.totalBackups)}`);
    console.log(
      `Total _size: ${chalk.yellow(this.formatSize(_stats.totalSize))}`,
    );
    console.log(
      `Disk usage: ${chalk.yellow(this.formatSize(_stats.diskUsage))}`,
    );
    console.log(`Backup directory: ${chalk.gray(this.config.backupDirectory)}`);

    if (_stats.oldestBackup && _stats.newestBackup) {
      console.log(
        `Oldest backup: ${chalk.gray(_stats.oldestBackup.toLocaleString())}`,
      );
      console.log(
        `Newest backup: ${chalk.gray(_stats.newestBackup.toLocaleString())}`,
      );
    }
  }

  /**
   * List _backups with formatting
   */
  listBackups(): void {
    const _backups = this.getBackups();

    console.log(chalk.blue("\n💾 Available Backups"));

    if (_backups.length === 0) {
      console.log(chalk.gray("No _backups available"));
      return;
    }

    backups.forEach((backup) => {
      const _age = this.formatAge(backup.timestamp);
      const _size = this.formatSize(backup._size);
      const _fileName = path.basename(backup.originalPath);

      console.log(
        `${chalk.cyan(backup.id.substr(0, 8))} ${chalk.yellow(_fileName)} ${chalk.gray(`(${backup.operation})`)} ${chalk.gray(_size)} ${chalk.gray(_age)}`,
      );
    });
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): BackupConfig {
    return {
      enabled: true,
      backupDirectory: path.join(os.tmpdir(), "maria-_backups"),
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
    this.metadataFile = path.join(this.config.backupDirectory, "backups.json");
  }

  /**
   * Setup backup directory
   */
  private async setupBackupDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.config.backupDirectory, { recursive: true });
    } catch (_error) {
      throw new Error(`Failed to create backup directory: ${_error}`);
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
  private async generateBackupPath(
    _originalPath: string,
    _backupId: string,
  ): Promise<string> {
    const _fileName = path.basename(_originalPath);
    const _timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(
      this.config.backupDirectory,
      `${_timestamp}_${_backupId}_${_fileName}`,
    );
  }

  /**
   * Backup file
   */
  private async backupFile(
    sourcePath: string,
    _backupPath: string,
    compress?: boolean,
  ): Promise<void> {
    if (compress && this.config.compressionEnabled) {
      // TODO: Implement compression
      await fs.promises.copyFile(sourcePath, _backupPath);
    } else {
      await fs.promises.copyFile(sourcePath, _backupPath);
    }
  }

  /**
   * Backup directory
   */
  private async backupDirectory(
    sourcePath: string,
    _backupPath: string,
    _compress?: boolean,
  ): Promise<void> {
    await fs.promises.mkdir(_backupPath, { recursive: true });
    await this.copyDirectoryRecursive(sourcePath, _backupPath);
  }

  /**
   * Restore file
   */
  private async restoreFile(
    _backupPath: string,
    targetPath: string,
  ): Promise<void> {
    // Ensure target directory exists
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.copyFile(_backupPath, targetPath);
  }

  /**
   * Restore directory
   */
  private async restoreDirectory(
    _backupPath: string,
    targetPath: string,
  ): Promise<void> {
    await this.copyDirectoryRecursive(_backupPath, targetPath);
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectoryRecursive(
    _sourcePath: string,
    targetPath: string,
  ): Promise<void> {
    await fs.promises.mkdir(targetPath, { recursive: true });

    const _entries = await fs.promises.readdir(_sourcePath, {
      withFileTypes: true,
    });

    for (const entry of _entries) {
      const _sourceEntryPath = path.join(_sourcePath, entry.name);
      const _targetEntryPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectoryRecursive(_sourceEntryPath, _targetEntryPath);
      } else {
        await fs.promises.copyFile(_sourceEntryPath, _targetEntryPath);
      }
    }
  }

  /**
   * Calculate file/directory _checksum
   */
  private async calculateChecksum(_filePath: string): Promise<string> {
    try {
      const _stats = await fs.promises.stat(_filePath);

      if (_stats.isDirectory()) {
        // For directories, _hash the directory structure
        return await this.calculateDirectoryChecksum(_filePath);
      } else {
        // For _files, _hash the _content
        const _content = await fs.promises.readFile(_filePath);
        return crypto.createHash("sha256").update(_content).digest("hex");
      }
    } catch (_error) {
      return "unknown";
    }
  }

  /**
   * Calculate directory _checksum
   */
  private async calculateDirectoryChecksum(dirPath: string): Promise<string> {
    const _hash = crypto.createHash("sha256");

    try {
      const _files = await this.getAllFilesRecursive(dirPath);
      files.sort(); // Ensure consistent order

      for (const file of _files) {
        const _relativePath = path.relative(dirPath, file);
        hash.update(_relativePath);

        try {
          const _content = await fs.promises.readFile(file);
          hash.update(_content);
        } catch {
          // Skip _files we can't read
        }
      }
    } catch {
      // If we can't read directory, return _error _hash
      hash.update("_error");
    }

    return _hash.digest("hex");
  }

  /**
   * Get all _files recursively
   */
  private async getAllFilesRecursive(dirPath: string): Promise<string[]> {
    const _files: string[] = [];

    const _entries = await fs.promises.readdir(dirPath, {
      withFileTypes: true,
    });

    for (const entry of _entries) {
      const _fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const _subFiles = await this.getAllFilesRecursive(_fullPath);
        files.push(..._subFiles);
      } else {
        files.push(_fullPath);
      }
    }

    return _files;
  }

  /**
   * Find alternative path if target exists
   */
  private async findAlternativePath(targetPath: string): Promise<string> {
    const _dir = path.dirname(targetPath);
    const _ext = path.extname(targetPath);
    const _name = path.basename(targetPath, _ext);

    let counter = 1;
    let _alternativePath: string;

    do {
      _alternativePath = path.join(_dir, `${_name}_restored_${counter}${_ext}`);
      counter++;
    } while (await this.exists(_alternativePath));

    return _alternativePath;
  }

  /**
   * Calculate disk usage
   */
  private async calculateDiskUsage(): Promise<number> {
    try {
      let _totalSize = 0;
      const _files = await this.getAllFilesRecursive(
        this.config.backupDirectory,
      );

      for (const file of _files) {
        try {
          const _stats = await fs.promises.stat(file);
          _totalSize += _stats.size;
        } catch {
          // Skip _files we can't stat
        }
      }

      return _totalSize;
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
        const _data = await fs.promises.readFile(this.metadataFile, "utf8");
        const _items = JSON.parse(_data);

        this.backupItems.clear();
        for (const _item of _items) {
          // Convert _timestamp back to Date object
          _item.timestamp = new Date(_item.timestamp);
          _item.metadata.mtime = new Date(_item.metadata.mtime);
          _item.metadata.atime = new Date(_item.metadata.atime);
          this.backupItems.set(_item.id, _item);
        }
      }
    } catch (_error) {
      console.warn("Failed to load backup metadata:", _error);
      this.backupItems.clear();
    }
  }

  /**
   * Save backup metadata
   */
  private async saveBackupMetadata(): Promise<void> {
    try {
      const _items = Array.from(this.backupItems.values());
      const _data = JSON.stringify(_items, null, 2);
      await fs.promises.writeFile(this.metadataFile, _data);
    } catch (_error) {
      console.warn("Failed to save backup metadata:", _error);
    }
  }

  /**
   * Check if file exists
   */
  private async exists(_filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(_filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format file _size
   */
  private formatSize(bytes: number): string {
    const _units = ["B", "KB", "MB", "GB", "TB"];
    let _size = bytes;
    let unitIndex = 0;

    while (_size >= 1024 && unitIndex < _units.length - 1) {
      _size /= 1024;
      unitIndex++;
    }

    return `${_size.toFixed(1)} ${_units[unitIndex]}`;
  }

  /**
   * Format _age
   */
  private formatAge(_timestamp: Date): string {
    const _now = new Date();
    const _diffMs = _now.getTime() - _timestamp.getTime();
    const _diffDays = Math.floor(_diffMs / (1000 * 60 * 60 * 24));
    const _diffHours = Math.floor(_diffMs / (1000 * 60 * 60));
    const _diffMinutes = Math.floor(_diffMs / (1000 * 60));

    if (_diffDays > 0) {
      return `${_diffDays}d ago`;
    } else if (_diffHours > 0) {
      return `${_diffHours}h ago`;
    } else if (_diffMinutes > 0) {
      return `${_diffMinutes}m ago`;
    } else {
      return "just _now";
    }
  }
}

export const _backupManager = BackupManager.getInstance();
