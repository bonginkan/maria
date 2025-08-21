/**
 * Undo/Redo Manager - File Operation History and Reversal System
 * Provides comprehensive undo/redo functionality for file operations
 * Phase 2: Terminal Integration & Safety - Week 7
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface OperationState {
  id: string;
  type: 'create' | 'delete' | 'move' | 'copy' | 'write' | 'chmod' | 'mkdir' | 'rmdir';
  timestamp: Date;
  reversible: boolean;
  metadata: {
    originalPath?: string;
    targetPath?: string;
    backupPath?: string;
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
  operation: OperationState;
  message?: string;
  error?: string;
}

export interface RedoResult {
  success: boolean;
  operation: OperationState;
  message?: string;
  error?: string;
}

export interface HistoryStats {
  totalOperations: number;
  undoableOperations: number;
  redoableOperations: number;
  currentPosition: number;
  memoryUsage: number;
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
   * Record a file operation for undo/redo
   */
  async recordOperation(
    type: OperationState['type'],
    originalPath: string,
    targetPath?: string,
    description?: string,
  ): Promise<string> {
    try {
      const operationId = this.generateOperationId();
      const operation: OperationState = {
        id: operationId,
        type,
        timestamp: new Date(),
        reversible: true,
        metadata: {},
        description: description || this.generateDescription(type, originalPath, targetPath),
      };

      // Capture state before operation for undo capability
      await this.captureOperationState(operation, originalPath, targetPath);

      // Clear any redo history when new operation is recorded
      this.operationHistory = this.operationHistory.slice(0, this.currentPosition + 1);

      // Add new operation
      this.operationHistory.push(operation);
      this.currentPosition = this.operationHistory.length - 1;

      // Maintain history size limit
      await this.maintainHistorySize();

      console.debug(`Recorded operation: ${operation.description}`);
      return operationId;
    } catch (error) {
      console.error('Failed to record operation:', error);
      throw error;
    }
  }

  /**
   * Undo the last operation
   */
  async undo(): Promise<UndoResult> {
    if (!this.canUndo()) {
      return {
        success: false,
        operation: {} as OperationState,
        error: 'No operations to undo',
      };
    }

    const operation = this.operationHistory[this.currentPosition];

    try {
      if (!operation.reversible) {
        return {
          success: false,
          operation,
          error: 'Operation is not reversible',
        };
      }

      await this.executeUndo(operation);
      this.currentPosition--;

      return {
        success: true,
        operation,
        message: `Undone: ${operation.description}`,
      };
    } catch (error) {
      return {
        success: false,
        operation,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Redo the next operation
   */
  async redo(): Promise<RedoResult> {
    if (!this.canRedo()) {
      return {
        success: false,
        operation: {} as OperationState,
        error: 'No operations to redo',
      };
    }

    const operation = this.operationHistory[this.currentPosition + 1];

    try {
      await this.executeRedo(operation);
      this.currentPosition++;

      return {
        success: true,
        operation,
        message: `Redone: ${operation.description}`,
      };
    } catch (error) {
      return {
        success: false,
        operation,
        error: error instanceof Error ? error.message : String(error),
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
   * Get operation history
   */
  getHistory(): OperationState[] {
    return [...this.operationHistory];
  }

  /**
   * Get history statistics
   */
  getHistoryStats(): HistoryStats {
    const memoryUsage = this.calculateMemoryUsage();

    return {
      totalOperations: this.operationHistory.length,
      undoableOperations: this.currentPosition + 1,
      redoableOperations: this.operationHistory.length - this.currentPosition - 1,
      currentPosition: this.currentPosition,
      memoryUsage,
    };
  }

  /**
   * Clear operation history
   */
  async clearHistory(): Promise<void> {
    try {
      // Clean up backup files
      await this.cleanupBackupFiles();

      this.operationHistory = [];
      this.currentPosition = -1;

      console.log(chalk.green('✅ Operation history cleared'));
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
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
   * Get specific operation by ID
   */
  getOperation(operationId: string): OperationState | null {
    return this.operationHistory.find((op) => op.id === operationId) || null;
  }

  /**
   * Mark operation as non-reversible
   */
  markOperationNonReversible(operationId: string): void {
    const operation = this.getOperation(operationId);
    if (operation) {
      operation.reversible = false;
    }
  }

  /**
   * Show operation history with formatting
   */
  showHistory(): void {
    console.log(chalk.blue('\n📜 Operation History'));

    if (this.operationHistory.length === 0) {
      console.log(chalk.gray('No operations recorded'));
      return;
    }

    this.operationHistory.forEach((operation, index) => {
      const isCurrent = index === this.currentPosition;
      const isActive = index <= this.currentPosition;

      const prefix = isCurrent ? chalk.cyan('→') : isActive ? chalk.green('✓') : chalk.gray('○');
      const status = operation.reversible ? '' : chalk.red(' (irreversible)');
      const time = operation.timestamp.toLocaleTimeString();

      console.log(
        `${prefix} ${chalk.cyan(operation.type)} ${operation.description}${status} ${chalk.gray(`(${time})`)}`,
      );
    });

    const stats = this.getHistoryStats();
    console.log(
      chalk.gray(
        `\nPosition: ${stats.currentPosition + 1}/${stats.totalOperations}, Memory: ${this.formatSize(stats.memoryUsage)}`,
      ),
    );
  }

  /**
   * Initialize backup directory
   */
  private initializeBackupDirectory(): void {
    const os = require('os');
    this.backupDirectory = path.join(os.tmpdir(), 'maria-undo-backups');

    try {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
    } catch (error) {
      console.warn('Failed to create backup directory:', error);
    }
  }

  /**
   * Capture operation state for undo capability
   */
  private async captureOperationState(
    operation: OperationState,
    originalPath: string,
    targetPath?: string,
  ): Promise<void> {
    operation.metadata.originalPath = originalPath;
    operation.metadata.targetPath = targetPath;

    try {
      // Capture original file/directory state if it exists
      if (await this.exists(originalPath)) {
        const stats = await fs.promises.stat(originalPath);
        operation.metadata.originalStats = {
          mode: stats.mode,
          size: stats.size,
          mtime: stats.mtime,
          atime: stats.atime,
        };

        // For write operations, backup original content
        if (operation.type === 'write' && stats.isFile()) {
          const backupPath = await this.createBackup(originalPath, operation.id);
          operation.metadata.backupPath = backupPath;
        }

        // For directory operations, capture contents
        if (operation.type === 'rmdir' && stats.isDirectory()) {
          operation.metadata.directoryContents = await this.captureDirectoryContents(originalPath);
        }
      }
    } catch (error) {
      console.debug('Failed to capture operation state:', error);
      operation.reversible = false;
    }
  }

  /**
   * Execute undo operation
   */
  private async executeUndo(operation: OperationState): Promise<void> {
    const { type, metadata } = operation;

    switch (type) {
      case 'create':
        // Undo create: delete the created file
        if (metadata.originalPath && (await this.exists(metadata.originalPath))) {
          await fs.promises.unlink(metadata.originalPath);
        }
        break;

      case 'delete':
        // Undo delete: restore from backup (not implemented for safety)
        throw new Error('File deletion cannot be undone - use trash instead');

      case 'write':
        // Undo write: restore original content
        if (metadata.backupPath && metadata.originalPath) {
          await fs.promises.copyFile(metadata.backupPath, metadata.originalPath);

          // Restore original stats if available
          if (metadata.originalStats) {
            await fs.promises.utimes(
              metadata.originalPath,
              metadata.originalStats.atime,
              metadata.originalStats.mtime,
            );
            await fs.promises.chmod(metadata.originalPath, metadata.originalStats.mode);
          }
        }
        break;

      case 'move':
        // Undo move: move back to original location
        if (
          metadata.targetPath &&
          metadata.originalPath &&
          (await this.exists(metadata.targetPath))
        ) {
          await fs.promises.rename(metadata.targetPath, metadata.originalPath);
        }
        break;

      case 'copy':
        // Undo copy: delete the copied file
        if (metadata.targetPath && (await this.exists(metadata.targetPath))) {
          await fs.promises.unlink(metadata.targetPath);
        }
        break;

      case 'mkdir':
        // Undo mkdir: remove the created directory
        if (metadata.originalPath && (await this.exists(metadata.originalPath))) {
          await fs.promises.rmdir(metadata.originalPath);
        }
        break;

      case 'chmod':
        // Undo chmod: restore original permissions
        if (metadata.originalPath && metadata.originalStats) {
          await fs.promises.chmod(metadata.originalPath, metadata.originalStats.mode);
        }
        break;

      default:
        throw new Error(`Undo not implemented for operation type: ${type}`);
    }
  }

  /**
   * Execute redo operation
   */
  private async executeRedo(operation: OperationState): Promise<void> {
    const { type, metadata } = operation;

    switch (type) {
      case 'create':
        // Redo create: recreate the file (empty)
        if (metadata.originalPath) {
          await fs.promises.writeFile(metadata.originalPath, '');
        }
        break;

      case 'write':
        // Redo write: reapply the changes (complex - would need to store new content)
        throw new Error('Write redo requires storing new content - not implemented');

      case 'move':
        // Redo move: move back to target location
        if (
          metadata.originalPath &&
          metadata.targetPath &&
          (await this.exists(metadata.originalPath))
        ) {
          await fs.promises.rename(metadata.originalPath, metadata.targetPath);
        }
        break;

      case 'copy':
        // Redo copy: copy again
        if (
          metadata.originalPath &&
          metadata.targetPath &&
          (await this.exists(metadata.originalPath))
        ) {
          await fs.promises.copyFile(metadata.originalPath, metadata.targetPath);
        }
        break;

      case 'mkdir':
        // Redo mkdir: recreate directory
        if (metadata.originalPath) {
          await fs.promises.mkdir(metadata.originalPath, { recursive: true });
        }
        break;

      default:
        throw new Error(`Redo not implemented for operation type: ${type}`);
    }
  }

  /**
   * Create backup of file
   */
  private async createBackup(filePath: string, operationId: string): Promise<string> {
    const fileName = path.basename(filePath);
    const backupPath = path.join(this.backupDirectory, `${operationId}_${fileName}`);

    await fs.promises.copyFile(filePath, backupPath);
    return backupPath;
  }

  /**
   * Capture directory contents recursively
   */
  private async captureDirectoryContents(dirPath: string): Promise<string[]> {
    const contents: string[] = [];

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        contents.push(fullPath);

        if (entry.isDirectory()) {
          const subContents = await this.captureDirectoryContents(fullPath);
          contents.push(...subContents);
        }
      }
    } catch (error) {
      console.debug('Failed to capture directory contents:', error);
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

    const excessCount = this.operationHistory.length - this.maxHistorySize;
    const removedOperations = this.operationHistory.splice(0, excessCount);

    // Clean up backup files for removed operations
    for (const operation of removedOperations) {
      if (operation.metadata.backupPath) {
        try {
          await fs.promises.unlink(operation.metadata.backupPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    this.currentPosition = Math.max(-1, this.currentPosition - excessCount);
  }

  /**
   * Calculate memory usage of stored operations
   */
  private calculateMemoryUsage(): number {
    let size = 0;

    for (const operation of this.operationHistory) {
      size += JSON.stringify(operation).length * 2; // Approximate bytes (UTF-16)
    }

    return size;
  }

  /**
   * Clean up backup files
   */
  private async cleanupBackupFiles(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.backupDirectory);

      for (const file of files) {
        const filePath = path.join(this.backupDirectory, file);
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      console.debug('Failed to cleanup backup files:', error);
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate operation description
   */
  private generateDescription(
    type: OperationState['type'],
    originalPath: string,
    targetPath?: string,
  ): string {
    const fileName = path.basename(originalPath);

    switch (type) {
      case 'create':
        return `Create file: ${fileName}`;
      case 'delete':
        return `Delete file: ${fileName}`;
      case 'write':
        return `Write to file: ${fileName}`;
      case 'move':
        return `Move ${fileName} to ${targetPath ? path.basename(targetPath) : 'unknown'}`;
      case 'copy':
        return `Copy ${fileName} to ${targetPath ? path.basename(targetPath) : 'unknown'}`;
      case 'mkdir':
        return `Create directory: ${fileName}`;
      case 'rmdir':
        return `Remove directory: ${fileName}`;
      case 'chmod':
        return `Change permissions: ${fileName}`;
      default:
        return `${type}: ${fileName}`;
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
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

export const undoRedoManager = UndoRedoManager.getInstance();
