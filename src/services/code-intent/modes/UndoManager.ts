/**
 * Undo Manager
 * Provides undo functionality for file operations
 */

import { SaveOperation } from '../types/filename-inference.types';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface UndoableOperation {
  id: string;
  timestamp: number;
  type: 'create' | 'overwrite' | 'rename';
  targetPath: string;
  backupPath?: string;
  originalContent?: string;
  metadata: {
    size: number;
    planId: string;
    prompt?: string;
  };
}

export interface UndoResult {
  success: boolean;
  operation?: UndoableOperation;
  error?: string;
  recoveredFiles: string[];
}

export class UndoManager {
  private operations: UndoableOperation[] = [];
  private readonly maxOperations = 10; // Keep last 10 operations
  private readonly backupDir = '.maria-backups';

  /**
   * Records a file operation for potential undo
   */
  async recordOperation(
    operation: SaveOperation,
    operationType: 'create' | 'overwrite' | 'rename' = 'create'
  ): Promise<string> {
    const id = this.generateOperationId();
    const targetPath = path.resolve(operation.filepath || operation.path);
    
    let backupPath: string | undefined;
    let originalContent: string | undefined;

    // If file exists, create backup
    if (fs.existsSync(targetPath)) {
      operationType = 'overwrite';
      backupPath = await this.createBackup(targetPath, id);
      try {
        originalContent = fs.readFileSync(targetPath, 'utf-8');
      } catch {
        // Binary file or read error - backup file will be used
      }
    }

    const undoableOp: UndoableOperation = {
      id,
      timestamp: Date.now(),
      type: operationType,
      targetPath,
      backupPath,
      originalContent,
      metadata: {
        size: operation.content.length,
        planId: operation.planId,
        prompt: undefined // Could be added from context
      }
    };

    // Add to operations list
    this.operations.unshift(undoableOp);
    
    // Keep only recent operations
    if (this.operations.length > this.maxOperations) {
      const removed = this.operations.splice(this.maxOperations);
      // Clean up old backups
      for (const op of removed) {
        if (op.backupPath) {
          this.cleanupBackup(op.backupPath);
        }
      }
    }

    return id;
  }

  /**
   * Undoes the most recent operation
   */
  async undo(): Promise<UndoResult> {
    const operation = this.operations[0];
    if (!operation) {
      return {
        success: false,
        error: 'No operations to undo',
        recoveredFiles: []
      };
    }

    return this.undoOperation(operation.id);
  }

  /**
   * Undoes a specific operation by ID
   */
  async undoOperation(operationId: string): Promise<UndoResult> {
    const operationIndex = this.operations.findIndex(op => op.id === operationId);
    if (operationIndex === -1) {
      return {
        success: false,
        error: 'Operation not found or already expired',
        recoveredFiles: []
      };
    }

    const operation = this.operations[operationIndex];
    const recoveredFiles: string[] = [];

    try {
      switch (operation.type) {
        case 'create':
          // Remove the created file
          if (fs.existsSync(operation.targetPath)) {
            fs.unlinkSync(operation.targetPath);
            recoveredFiles.push(`Deleted: ${operation.targetPath}`);
          }
          break;

        case 'overwrite':
          // Restore from backup
          if (operation.backupPath && fs.existsSync(operation.backupPath)) {
            fs.copyFileSync(operation.backupPath, operation.targetPath);
            recoveredFiles.push(`Restored: ${operation.targetPath}`);
          } else if (operation.originalContent !== undefined) {
            fs.writeFileSync(operation.targetPath, operation.originalContent, 'utf-8');
            recoveredFiles.push(`Restored: ${operation.targetPath}`);
          } else {
            throw new Error('No backup available for overwritten file');
          }
          break;

        case 'rename':
          // Implementation for rename undo would go here
          throw new Error('Rename undo not yet implemented');

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      // Remove from operations list
      this.operations.splice(operationIndex, 1);

      // Clean up backup
      if (operation.backupPath) {
        this.cleanupBackup(operation.backupPath);
      }

      return {
        success: true,
        operation,
        recoveredFiles
      };

    } catch (error) {
      return {
        success: false,
        error: `Undo failed: ${(error as Error).message}`,
        recoveredFiles
      };
    }
  }

  /**
   * Lists all undoable operations
   */
  getUndoableOperations(): UndoableOperation[] {
    return [...this.operations];
  }

  /**
   * Gets the most recent operation
   */
  getLastOperation(): UndoableOperation | undefined {
    return this.operations[0];
  }

  /**
   * Clears all stored operations and backups
   */
  async clearHistory(): Promise<void> {
    // Clean up all backups
    for (const operation of this.operations) {
      if (operation.backupPath) {
        this.cleanupBackup(operation.backupPath);
      }
    }

    this.operations = [];

    // Remove backup directory if empty
    try {
      if (fs.existsSync(this.backupDir)) {
        const files = fs.readdirSync(this.backupDir);
        if (files.length === 0) {
          fs.rmdirSync(this.backupDir);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Creates a backup of a file
   */
  private async createBackup(filePath: string, operationId: string): Promise<string> {
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const backupName = `${operationId}-${fileName}`;
    const backupPath = path.join(this.backupDir, backupName);

    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  }

  /**
   * Cleans up a backup file
   */
  private cleanupBackup(backupPath: string): void {
    try {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup backup ${backupPath}:`, error);
    }
  }

  /**
   * Generates a unique operation ID
   */
  private generateOperationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${random}`;
  }

  /**
   * Formats operation for display
   */
  formatOperation(operation: UndoableOperation): string {
    const time = new Date(operation.timestamp).toLocaleTimeString();
    const fileName = path.basename(operation.targetPath);
    const size = this.formatSize(operation.metadata.size);
    
    switch (operation.type) {
      case 'create':
        return `${time} - Created ${fileName} (${size})`;
      case 'overwrite':
        return `${time} - Overwrote ${fileName} (${size})`;
      case 'rename':
        return `${time} - Renamed to ${fileName}`;
      default:
        return `${time} - ${operation.type} ${fileName}`;
    }
  }

  /**
   * Displays undo history
   */
  displayHistory(): void {
    if (this.operations.length === 0) {
      console.log('📭 No operations to undo');
      return;
    }

    console.log('📋 Recent operations (newest first):');
    console.log('');

    this.operations.forEach((operation, index) => {
      const formatted = this.formatOperation(operation);
      const number = `${index + 1}.`.padStart(3);
      console.log(`   ${number} ${formatted}`);
    });

    console.log('');
    console.log('💡 Use /undo to undo the most recent operation');
  }

  /**
   * Displays undo result
   */
  displayUndoResult(result: UndoResult): void {
    if (result.success) {
      console.log('✅ Undo successful');
      
      if (result.operation) {
        const formatted = this.formatOperation(result.operation);
        console.log(`   Undid: ${formatted}`);
      }

      if (result.recoveredFiles.length > 0) {
        result.recoveredFiles.forEach(file => {
          console.log(`   ${file}`);
        });
      }
    } else {
      console.log(`❌ Undo failed: ${result.error}`);
    }
  }

  /**
   * Checks if undo is available
   */
  canUndo(): boolean {
    return this.operations.length > 0;
  }

  /**
   * Gets statistics about operations
   */
  getStats(): {
    operationCount: number;
    oldestOperation?: Date;
    backupCount: number;
    backupSizeEstimate: string;
  } {
    const backupCount = this.operations.filter(op => op.backupPath).length;
    const totalSize = this.operations.reduce((sum, op) => sum + op.metadata.size, 0);

    return {
      operationCount: this.operations.length,
      oldestOperation: this.operations.length > 0 
        ? new Date(this.operations[this.operations.length - 1].timestamp)
        : undefined,
      backupCount,
      backupSizeEstimate: this.formatSize(totalSize)
    };
  }

  /**
   * Formats file size
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}