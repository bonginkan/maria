/**
 * Undo/Redo Manager - File Operation History and Reversal System
 * Provides comprehensive undo/redo functionality for file operations
 * Phase 2: Terminal Integration & Safety - Week 7
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

export interface OperationState {
  id: string;
  type:
    | "create"
    | "delete"
    | "move"
    | "copy"
    | "write"
    | "chmod"
    | "mkdir"
    | "rmdir";
  timestamp: Date;
  reversible: boolean;
  metadata: {
    originalPath?: string;
    targetPath?: string;
    _backupPath?: string;
    originalContent?: Buffer;
    originalStats?: {
      mode: number;
      size: number;
      mtime: Date;
      atime: Date;
    };
    directoryContents?: string[];
  };
  description: string;
}

export interface UndoResult {
  success: boolean;
  _operation: OperationState;
  message?: string;
  _error?: string;
}

export interface RedoResult {
  success: boolean;
  _operation: OperationState;
  message?: string;
  _error?: string;
}

export interface HistoryStats {
  totalOperations: number;
  undoableOperations: number;
  redoableOperations: number;
  currentPosition: number;
  _memoryUsage: number;
}

export class UndoRedoManager {
  private static instance: UndoRedoManager;
  private operationHistory: OperationState[] = [];
  private currentPosition: number = -1;
  private maxHistorySize: number = 100;
  private backupDirectory: string;
  private maxBackupSize: number = 100 * 1024 * 1024; // 100MB

  public static getInstance(): UndoRedoManager {
    if (!UndoRedoManager.instance) {
      UndoRedoManager.instance = new UndoRedoManager();
    }
    return UndoRedoManager.instance;
  }

  private constructor() {
    this.initializeBackupDirectory();
  }

  /**
   * Record a file _operation for undo/redo
   */
  async recordOperation(
    type: OperationState["type"],
    originalPath: string,
    targetPath?: string,
    description?: string,
  ): Promise<string> {
    try {
      const _operationId = this.generateOperationId();
      const _operation: OperationState = {
        id: _operationId,
        type,
        timestamp: new Date(),
        reversible: true,
        metadata: Record<string, any>,
        description:
          description ||
          this.generateDescription(type, originalPath, targetPath),
      };

      // Capture state before _operation for undo capability
      await this.captureOperationState(_operation, originalPath, targetPath);

      // Clear any redo history when new _operation is recorded
      this.operationHistory = this.operationHistory.slice(
        0,
        this.currentPosition + 1,
      );

      // Add new _operation
      this.operationHistory.push(_operation);
      this.currentPosition = this.operationHistory.length - 1;

      // Maintain history size limit
      await this.maintainHistorySize();

      console.debug(`Recorded _operation: ${_operation.description}`);
      return _operationId;
    } catch (_error) {
      console._error("Failed to record _operation:", _error);
      throw _error;
    }
  }

  /**
   * Undo the last _operation
   */
  async undo(): Promise<UndoResult> {
    if (!this.canUndo()) {
      return {
        success: false,
        _operation: Record<string, any> as OperationState,
        _error: "No operations to undo",
      };
    }

    const _operation = this.operationHistory[this.currentPosition];

    try {
      if (!_operation.reversible) {
        return {
          success: false,
          _operation,
          _error: "Operation is not reversible",
        };
      }

      await this.executeUndo(_operation);
      this.currentPosition--;

      return {
        success: true,
        _operation,
        message: `Undone: ${_operation.description}`,
      };
    } catch (_error) {
      return {
        success: false,
        _operation,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Redo the next _operation
   */
  async redo(): Promise<RedoResult> {
    if (!this.canRedo()) {
      return {
        success: false,
        _operation: Record<string, any> as OperationState,
        _error: "No operations to redo",
      };
    }

    const _operation = this.operationHistory[this.currentPosition + 1];

    try {
      await this.executeRedo(_operation);
      this.currentPosition++;

      return {
        success: true,
        _operation,
        message: `Redone: ${_operation.description}`,
      };
    } catch (_error) {
      return {
        success: false,
        _operation,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return (
      this.currentPosition >= 0 &&
      this.currentPosition < this.operationHistory.length &&
      this.operationHistory[this.currentPosition]?.reversible
    );
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.currentPosition + 1 < this.operationHistory.length;
  }

  /**
   * Get _operation history
   */
  getHistory(): OperationState[] {
    return [...this.operationHistory];
  }

  /**
   * Get history statistics
   */
  getHistoryStats(): HistoryStats {
    const _memoryUsage = this.calculateMemoryUsage();

    return {
      totalOperations: this.operationHistory.length,
      undoableOperations: this.currentPosition + 1,
      redoableOperations:
        this.operationHistory.length - this.currentPosition - 1,
      currentPosition: this.currentPosition,
      _memoryUsage,
    };
  }

  /**
   * Clear _operation history
   */
  async clearHistory(): Promise<void> {
    try {
      // Clean up backup _files
      await this.cleanupBackupFiles();

      this.operationHistory = [];
      this.currentPosition = -1;

      console.log(chalk.green("✅ Operation history cleared"));
    } catch (_error) {
      console._error("Failed to clear history:", _error);
      throw _error;
    }
  }

  /**
   * Set maximum history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(1, size);
    this.maintainHistorySize();
  }

  /**
   * Get specific _operation by ID
   */
  getOperation(_operationId: string): OperationState | null {
    return this.operationHistory.find((op) => op.id === _operationId) || null;
  }

  /**
   * Mark _operation as non-reversible
   */
  markOperationNonReversible(_operationId: string): void {
    const _operation = this.getOperation(_operationId);
    if (_operation) {
      operation.reversible = false;
    }
  }

  /**
   * Show _operation history with formatting
   */
  showHistory(): void {
    console.log(chalk.blue("\n📜 Operation History"));

    if (this.operationHistory.length === 0) {
      console.log(chalk.gray("No operations recorded"));
      return;
    }

    this.operationHistory.forEach((_operation, _index) => {
      const _isCurrent = _index === this.currentPosition;
      const _isActive = _index <= this.currentPosition;

      const _prefix = _isCurrent
        ? chalk.cyan("→")
        : _isActive
          ? chalk.green("✓")
          : chalk.gray("○");
      const _status = _operation.reversible ? "" : chalk.red(" (irreversible)");
      const _time = _operation.timestamp.toLocaleTimeString();

      console.log(
        `${_prefix} ${chalk.cyan(_operation.type)} ${_operation.description}${_status} ${chalk.gray(`(${_time})`)}`,
      );
    });

    const _stats = this.getHistoryStats();
    console.log(
      chalk.gray(
        `\nPosition: ${_stats.currentPosition + 1}/${_stats.totalOperations}, Memory: ${this.formatSize(_stats.memoryUsage)}`,
      ),
    );
  }

  /**
   * Initialize backup directory
   */
  private initializeBackupDirectory(): void {
    const os = require("os");
    this.backupDirectory = path.join(os.tmpdir(), "maria-undo-backups");

    try {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
    } catch (_error) {
      console.warn("Failed to create backup directory:", _error);
    }
  }

  /**
   * Capture _operation state for undo capability
   */
  private async captureOperationState(
    _operation: OperationState,
    originalPath: string,
    targetPath?: string,
  ): Promise<void> {
    _operation.metadata.originalPath = originalPath;
    operation.metadata.targetPath = targetPath;

    try {
      // Capture original file/directory state if it exists
      if (await this.exists(originalPath)) {
        const _stats = await fs.promises.stat(originalPath);
        operation.metadata.originalStats = {
          mode: _stats.mode,
          size: _stats.size,
          mtime: _stats.mtime,
          atime: _stats.atime,
        };

        // For write operations, backup original content
        if (_operation.type === "write" && _stats.isFile()) {
          const _backupPath = await this.createBackup(
            originalPath,
            _operation.id,
          );
          operation.metadata._backupPath = _backupPath;
        }

        // For directory operations, capture contents
        if (_operation.type === "rmdir" && _stats.isDirectory()) {
          operation.metadata.directoryContents =
            await this.captureDirectoryContents(originalPath);
        }
      }
    } catch (_error) {
      console.debug("Failed to capture _operation state:", _error);
      operation.reversible = false;
    }
  }

  /**
   * Execute undo _operation
   */
  private async executeUndo(_operation: OperationState): Promise<void> {
    const { type, metadata } = _operation;

    switch (type) {
      case "create":
        // Undo create: delete the created file
        if (
          metadata.originalPath &&
          (await this.exists(metadata.originalPath))
        ) {
          await fs.promises.unlink(metadata.originalPath);
        }
        break;

      case "delete":
        // Undo delete: restore from backup (not implemented for safety)
        throw new Error("File deletion cannot be undone - use trash instead");

      case "write":
        // Undo write: restore original content
        if (metadata.backupPath && metadata.originalPath) {
          await fs.promises.copyFile(
            metadata.backupPath,
            metadata.originalPath,
          );

          // Restore original _stats if available
          if (metadata.originalStats) {
            await fs.promises.utimes(
              metadata.originalPath,
              metadata.originalStats.atime,
              metadata.originalStats.mtime,
            );
            await fs.promises.chmod(
              metadata.originalPath,
              metadata.originalStats.mode,
            );
          }
        }
        break;

      case "move":
        // Undo move: move back to original location
        if (
          metadata.targetPath &&
          metadata.originalPath &&
          (await this.exists(metadata.targetPath))
        ) {
          await fs.promises.rename(metadata.targetPath, metadata.originalPath);
        }
        break;

      case "copy":
        // Undo copy: delete the copied file
        if (metadata.targetPath && (await this.exists(metadata.targetPath))) {
          await fs.promises.unlink(metadata.targetPath);
        }
        break;

      case "mkdir":
        // Undo mkdir: remove the created directory
        if (
          metadata.originalPath &&
          (await this.exists(metadata.originalPath))
        ) {
          await fs.promises.rmdir(metadata.originalPath);
        }
        break;

      case "chmod":
        // Undo chmod: restore original permissions
        if (metadata.originalPath && metadata.originalStats) {
          await fs.promises.chmod(
            metadata.originalPath,
            metadata.originalStats.mode,
          );
        }
        break;

      default:
        throw new Error(`Undo not implemented for _operation type: ${type}`);
    }
  }

  /**
   * Execute redo _operation
   */
  private async executeRedo(_operation: OperationState): Promise<void> {
    const { type, metadata } = _operation;

    switch (type) {
      case "create":
        // Redo create: recreate the file (empty)
        if (metadata.originalPath) {
          await fs.promises.writeFile(metadata.originalPath, "");
        }
        break;

      case "write":
        // Redo write: reapply the changes (complex - would need to store new content)
        throw new Error(
          "Write redo requires storing new content - not implemented",
        );

      case "move":
        // Redo move: move back to target location
        if (
          metadata.originalPath &&
          metadata.targetPath &&
          (await this.exists(metadata.originalPath))
        ) {
          await fs.promises.rename(metadata.originalPath, metadata.targetPath);
        }
        break;

      case "copy":
        // Redo copy: copy again
        if (
          metadata.originalPath &&
          metadata.targetPath &&
          (await this.exists(metadata.originalPath))
        ) {
          await fs.promises.copyFile(
            metadata.originalPath,
            metadata.targetPath,
          );
        }
        break;

      case "mkdir":
        // Redo mkdir: recreate directory
        if (metadata.originalPath) {
          await fs.promises.mkdir(metadata.originalPath, { recursive: true });
        }
        break;

      default:
        throw new Error(`Redo not implemented for _operation type: ${type}`);
    }
  }

  /**
   * Create backup of file
   */
  private async createBackup(
    _filePath: string,
    _operationId: string,
  ): Promise<string> {
    const _fileName = path.basename(_filePath);
    const _backupPath = path.join(
      this.backupDirectory,
      `${_operationId}_${_fileName}`,
    );

    await fs.promises.copyFile(_filePath, _backupPath);
    return _backupPath;
  }

  /**
   * Capture directory contents recursively
   */
  private async captureDirectoryContents(dirPath: string): Promise<string[]> {
    const contents: string[] = [];

    try {
      const _entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });

      for (const entry of _entries) {
        const _fullPath = path.join(dirPath, entry.name);
        contents.push(_fullPath);

        if (entry.isDirectory()) {
          const _subContents = await this.captureDirectoryContents(_fullPath);
          contents.push(..._subContents);
        }
      }
    } catch (_error) {
      console.debug("Failed to capture directory contents:", _error);
    }

    return contents;
  }

  /**
   * Maintain history size limit
   */
  private async maintainHistorySize(): Promise<void> {
    if (this.operationHistory.length <= this.maxHistorySize) {
      return;
    }

    const _excessCount = this.operationHistory.length - this.maxHistorySize;
    const _removedOperations = this.operationHistory.splice(0, _excessCount);

    // Clean up backup _files for removed operations
    for (const _operation of _removedOperations) {
      if (_operation.metadata.backupPath) {
        try {
          await fs.promises.unlink(_operation.metadata.backupPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    this.currentPosition = Math.max(-1, this.currentPosition - _excessCount);
  }

  /**
   * Calculate memory usage of stored operations
   */
  private calculateMemoryUsage(): number {
    let size = 0;

    for (const _operation of this.operationHistory) {
      size += JSON.stringify(_operation).length * 2; // Approximate bytes (UTF-16)
    }

    return size;
  }

  /**
   * Clean up backup _files
   */
  private async cleanupBackupFiles(): Promise<void> {
    try {
      const _files = await fs.promises.readdir(this.backupDirectory);

      for (const file of _files) {
        const _filePath = path.join(this.backupDirectory, file);
        await fs.promises.unlink(_filePath);
      }
    } catch (_error) {
      console.debug("Failed to cleanup backup _files:", _error);
    }
  }

  /**
   * Generate unique _operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate _operation description
   */
  private generateDescription(
    type: OperationState["type"],
    originalPath: string,
    targetPath?: string,
  ): string {
    const _fileName = path.basename(originalPath);

    switch (type) {
      case "create":
        return `Create file: ${_fileName}`;
      case "delete":
        return `Delete file: ${_fileName}`;
      case "write":
        return `Write to file: ${_fileName}`;
      case "move":
        return `Move ${_fileName} to ${targetPath ? path.basename(targetPath) : "unknown"}`;
      case "copy":
        return `Copy ${_fileName} to ${targetPath ? path.basename(targetPath) : "unknown"}`;
      case "mkdir":
        return `Create directory: ${_fileName}`;
      case "rmdir":
        return `Remove directory: ${_fileName}`;
      case "chmod":
        return `Change permissions: ${_fileName}`;
      default:
        return `${type}: ${_fileName}`;
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
   * Format file size
   */
  private formatSize(bytes: number): string {
    const _units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < _units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${_units[unitIndex]}`;
  }
}

export const _undoRedoManager = UndoRedoManager.getInstance();
