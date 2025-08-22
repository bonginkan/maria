/**
 * Atomic Operation Manager - Transactional File Operations with Rollback
 * Ensures file operations are atomic and can be rolled back on failure
 * Phase 2: Terminal Integration & Safety - Week 8
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { operationLogger } from '../logging/OperationLogger';
import { backupManager } from './BackupManager';

export interface AtomicOperation {
  id: string;
  type: 'create' | 'write' | 'delete' | 'move' | 'copy' | 'chmod' | 'mkdir' | 'rmdir' | 'batch';
  timestamp: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'rolled_back';
  originalState: OperationState;
  targetState: OperationState;
  rollbackActions: RollbackAction[];
  metadata: {
    description: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    timeout: number;
    retryCount: number;
    dependencies: string[];
  };
}

export interface OperationState {
  files: Array<{
    path: string;
    exists: boolean;
    content?: Buffer;
    stats?: {
      mode: number;
      size: number;
      mtime: Date;
      atime: Date;
    };
    checksum?: string;
  }>;
  directories: Array<{
    path: string;
    exists: boolean;
    contents?: string[];
    permissions?: string;
  }>;
}

export interface RollbackAction {
  type:
    | 'restore_file'
    | 'delete_file'
    | 'restore_directory'
    | 'delete_directory'
    | 'restore_content'
    | 'restore_permissions';
  path: string;
  data?: Buffer;
  stats?: fs.Stats;
  permissions?: number;
  originalPath?: string;
}

export interface AtomicResult {
  success: boolean;
  operationId: string;
  operations: number;
  duration: number;
  message?: string;
  error?: string;
  rollbackPerformed?: boolean;
}

export interface TransactionOptions {
  timeout?: number;
  retryCount?: number;
  backup?: boolean;
  dryRun?: boolean;
  priority?: AtomicOperation['metadata']['priority'];
  dependencies?: string[];
  rollbackOnFailure?: boolean;
}

export class AtomicOperationManager {
  private static instance: AtomicOperationManager;
  private activeOperations: Map<string, AtomicOperation> = new Map();
  private completedOperations: Map<string, AtomicOperation> = new Map();
  private tempDirectory: string;
  private maxHistorySize: number = 1000;

  public static getInstance(): AtomicOperationManager {
    if (!AtomicOperationManager.instance) {
      AtomicOperationManager.instance = new AtomicOperationManager();
    }
    return AtomicOperationManager.instance;
  }

  private constructor() {
    this.initializeTempDirectory();
  }

  /**
   * Initialize atomic operation manager
   */
  async initialize(): Promise<boolean> {
    try {
      await this.setupTempDirectory();
      await this.recoverIncompleteOperations();

      console.debug('Atomic operation manager initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize atomic operation manager:', error);
      return false;
    }
  }

  /**
   * Execute atomic file write
   */
  async atomicWrite(
    filePath: string,
    content: string | Buffer,
    options: TransactionOptions = {},
  ): Promise<AtomicResult> {
    const operationId = this.generateOperationId();
    const startTime = performance.now();

    try {
      // Create atomic operation
      const operation = await this.createAtomicOperation(
        operationId,
        'write',
        'Atomic write operation',
        options,
      );

      // Capture original state
      operation.originalState = await this.captureState([filePath], []);

      // Create backup if requested
      if (options.backup && (await this.exists(filePath))) {
        await backupManager.createBackup(filePath, 'atomic_write');
      }

      // Execute operation atomically
      await this.executeAtomicWrite(filePath, content, operation);

      // Capture target state
      operation.targetState = await this.captureState([filePath], []);

      // Complete operation
      operation.status = 'completed';
      this.completeOperation(operationId);

      const duration = performance.now() - startTime;

      await operationLogger.logOperation(
        'atomic_write',
        'completed',
        [{ path: filePath, action: 'write', size: content.length }],
        { duration },
      );

      return {
        success: true,
        operationId,
        operations: 1,
        duration,
        message: `Atomic write completed: ${path.basename(filePath)}`,
      };
    } catch (error) {
      return await this.handleOperationFailure(operationId, error, startTime);
    }
  }

  /**
   * Execute atomic file move
   */
  async atomicMove(
    sourcePath: string,
    targetPath: string,
    options: TransactionOptions = {},
  ): Promise<AtomicResult> {
    const operationId = this.generateOperationId();
    const startTime = performance.now();

    try {
      const operation = await this.createAtomicOperation(
        operationId,
        'move',
        'Atomic move operation',
        options,
      );

      // Capture original state
      operation.originalState = await this.captureState([sourcePath, targetPath], []);

      // Create backup if requested
      if (options.backup) {
        if (await this.exists(sourcePath)) {
          await backupManager.createBackup(sourcePath, 'atomic_move_source');
        }
        if (await this.exists(targetPath)) {
          await backupManager.createBackup(targetPath, 'atomic_move_target');
        }
      }

      // Execute operation atomically
      await this.executeAtomicMove(sourcePath, targetPath, operation);

      // Complete operation
      operation.status = 'completed';
      operation.targetState = await this.captureState([sourcePath, targetPath], []);
      this.completeOperation(operationId);

      const duration = performance.now() - startTime;

      await operationLogger.logOperation(
        'atomic_move',
        'completed',
        [
          { path: sourcePath, action: 'move' },
          { path: targetPath, action: 'create' },
        ],
        { duration },
      );

      return {
        success: true,
        operationId,
        operations: 1,
        duration,
        message: `Atomic move completed: ${path.basename(sourcePath)} → ${path.basename(targetPath)}`,
      };
    } catch (error) {
      return await this.handleOperationFailure(operationId, error, startTime);
    }
  }

  /**
   * Execute batch atomic operations
   */
  async atomicBatch(
    operations: Array<{
      type: 'write' | 'move' | 'copy' | 'delete' | 'mkdir';
      source?: string;
      target: string;
      content?: string | Buffer;
    }>,
    options: TransactionOptions = {},
  ): Promise<AtomicResult> {
    const operationId = this.generateOperationId();
    const startTime = performance.now();

    try {
      const operation = await this.createAtomicOperation(
        operationId,
        'batch',
        `Atomic batch operation (${operations.length} operations)`,
        options,
      );

      // Collect all paths for state capture
      const allPaths: string[] = [];
      operations.forEach((op) => {
        allPaths.push(op.target);
        if (op.source) {allPaths.push(op.source);}
      });

      // Capture original state
      operation.originalState = await this.captureState(allPaths, []);

      // Create backups if requested
      if (options.backup) {
        for (const op of operations) {
          if (op.source && (await this.exists(op.source))) {
            await backupManager.createBackup(op.source, 'atomic_batch');
          }
          if (await this.exists(op.target)) {
            await backupManager.createBackup(op.target, 'atomic_batch');
          }
        }
      }

      // Execute all operations atomically
      await this.executeBatchOperations(operations, operation);

      // Complete operation
      operation.status = 'completed';
      operation.targetState = await this.captureState(allPaths, []);
      this.completeOperation(operationId);

      const duration = performance.now() - startTime;

      await operationLogger.logOperation(
        'atomic_batch',
        'completed',
        operations.map((op) => ({
          path: op.target,
          action: op.type as any,
        })),
        { duration, context: { operationCount: operations.length } },
      );

      return {
        success: true,
        operationId,
        operations: operations.length,
        duration,
        message: `Atomic batch completed: ${operations.length} operations`,
      };
    } catch (error) {
      return await this.handleOperationFailure(operationId, error, startTime);
    }
  }

  /**
   * Rollback operation
   */
  async rollbackOperation(operationId: string): Promise<AtomicResult> {
    const startTime = performance.now();

    try {
      const operation =
        this.activeOperations.get(operationId) || this.completedOperations.get(operationId);

      if (!operation) {
        return {
          success: false,
          operationId,
          operations: 0,
          duration: 0,
          error: `Operation not found: ${operationId}`,
        };
      }

      if (operation.status === 'rolled_back') {
        return {
          success: false,
          operationId,
          operations: 0,
          duration: 0,
          error: 'Operation already rolled back',
        };
      }

      // Execute rollback actions
      await this.executeRollback(operation);

      operation.status = 'rolled_back';
      const duration = performance.now() - startTime;

      await operationLogger.logOperation('atomic_rollback', 'completed', [], {
        duration,
        context: {
          originalOperation: operation.type,
          rollbackActions: operation.rollbackActions.length,
        },
      });

      return {
        success: true,
        operationId,
        operations: operation.rollbackActions.length,
        duration,
        message: `Operation rolled back: ${operation.metadata.description}`,
        rollbackPerformed: true,
      };
    } catch (error) {
      const duration = performance.now() - startTime;

      await operationLogger.logOperation('atomic_rollback', 'failed', [], {
        duration,
        error: {
          code: 'ROLLBACK_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
      });

      return {
        success: false,
        operationId,
        operations: 0,
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get operation status
   */
  getOperationStatus(operationId: string): AtomicOperation | null {
    return (
      this.activeOperations.get(operationId) || this.completedOperations.get(operationId) || null
    );
  }

  /**
   * List active operations
   */
  getActiveOperations(): AtomicOperation[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * List completed operations
   */
  getCompletedOperations(): AtomicOperation[] {
    return Array.from(this.completedOperations.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  /**
   * Cancel active operation
   */
  async cancelOperation(operationId: string): Promise<AtomicResult> {
    const operation = this.activeOperations.get(operationId);

    if (!operation) {
      return {
        success: false,
        operationId,
        operations: 0,
        duration: 0,
        error: 'Operation not found or already completed',
      };
    }

    if (operation.status === 'executing') {
      // Can't cancel executing operation - try rollback instead
      return await this.rollbackOperation(operationId);
    }

    operation.status = 'failed';
    this.activeOperations.delete(operationId);

    return {
      success: true,
      operationId,
      operations: 0,
      duration: 0,
      message: 'Operation cancelled',
    };
  }

  /**
   * Clean up old operations
   */
  async cleanup(olderThanHours: number = 24): Promise<void> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

    // Clean up completed operations
    const toRemove: string[] = [];
    for (const [id, operation] of this.completedOperations) {
      if (operation.timestamp < cutoffTime) {
        toRemove.push(id);
      }
    }

    toRemove.forEach((id) => this.completedOperations.delete(id));

    console.debug(`Cleaned up ${toRemove.length} old atomic operations`);
  }

  /**
   * Initialize temp directory
   */
  private initializeTempDirectory(): void {
    this.tempDirectory = path.join(os.tmpdir(), 'maria-atomic-ops');
  }

  /**
   * Setup temp directory
   */
  private async setupTempDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.tempDirectory, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create temp directory: ${error}`);
    }
  }

  /**
   * Create atomic operation
   */
  private async createAtomicOperation(
    operationId: string,
    type: AtomicOperation['type'],
    description: string,
    options: TransactionOptions,
  ): Promise<AtomicOperation> {
    const operation: AtomicOperation = {
      id: operationId,
      type,
      timestamp: new Date(),
      status: 'pending',
      originalState: { files: [], directories: [] },
      targetState: { files: [], directories: [] },
      rollbackActions: [],
      metadata: {
        description,
        priority: options.priority || 'normal',
        timeout: options.timeout || 30000,
        retryCount: options.retryCount || 0,
        dependencies: options.dependencies || [],
      },
    };

    this.activeOperations.set(operationId, operation);
    return operation;
  }

  /**
   * Capture file system state
   */
  private async captureState(filePaths: string[], dirPaths: string[]): Promise<OperationState> {
    const state: OperationState = {
      files: [],
      directories: [],
    };

    // Capture file states
    for (const filePath of filePaths) {
      try {
        const exists = await this.exists(filePath);
        const fileState: OperationState['files'][0] = {
          path: filePath,
          exists,
        };

        if (exists) {
          const stats = await fs.promises.stat(filePath);
          if (stats.isFile()) {
            fileState.content = await fs.promises.readFile(filePath);
            fileState.stats = {
              mode: stats.mode,
              size: stats.size,
              mtime: stats.mtime,
              atime: stats.atime,
            };
          }
        }

        state.files.push(fileState);
      } catch (error) {
        // Skip files we can't access
        console.debug(`Failed to capture state for ${filePath}:`, error);
      }
    }

    // Capture directory states
    for (const dirPath of dirPaths) {
      try {
        const exists = await this.exists(dirPath);
        const dirState: OperationState['directories'][0] = {
          path: dirPath,
          exists,
        };

        if (exists) {
          const stats = await fs.promises.stat(dirPath);
          if (stats.isDirectory()) {
            dirState.contents = await fs.promises.readdir(dirPath);
            dirState.permissions = (stats.mode & 0o777).toString(8);
          }
        }

        state.directories.push(dirState);
      } catch (error) {
        console.debug(`Failed to capture state for ${dirPath}:`, error);
      }
    }

    return state;
  }

  /**
   * Execute atomic write
   */
  private async executeAtomicWrite(
    filePath: string,
    content: string | Buffer,
    operation: AtomicOperation,
  ): Promise<void> {
    operation.status = 'executing';

    const tempFile = path.join(
      this.tempDirectory,
      `write_${operation.id}_${path.basename(filePath)}`,
    );

    try {
      // Write to temporary file first
      await fs.promises.writeFile(tempFile, content);

      // Prepare rollback actions
      if (await this.exists(filePath)) {
        const originalContent = await fs.promises.readFile(filePath);
        const originalStats = await fs.promises.stat(filePath);
        operation.rollbackActions.push({
          type: 'restore_content',
          path: filePath,
          data: originalContent,
          stats: originalStats,
        });
      } else {
        operation.rollbackActions.push({
          type: 'delete_file',
          path: filePath,
        });
      }

      // Atomic move from temp to target
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.rename(tempFile, filePath);
    } finally {
      // Clean up temp file if it still exists
      try {
        await fs.promises.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Execute atomic move
   */
  private async executeAtomicMove(
    sourcePath: string,
    targetPath: string,
    operation: AtomicOperation,
  ): Promise<void> {
    operation.status = 'executing';

    // Prepare rollback actions
    if (await this.exists(targetPath)) {
      const backupPath = path.join(
        this.tempDirectory,
        `backup_${operation.id}_${path.basename(targetPath)}`,
      );
      await fs.promises.rename(targetPath, backupPath);
      operation.rollbackActions.push({
        type: 'restore_file',
        path: targetPath,
        originalPath: backupPath,
      });
    }

    operation.rollbackActions.push({
      type: 'restore_file',
      path: sourcePath,
      originalPath: targetPath,
    });

    // Execute the move
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.rename(sourcePath, targetPath);
  }

  /**
   * Execute batch operations
   */
  private async executeBatchOperations(
    operations: Array<{
      type: 'write' | 'move' | 'copy' | 'delete' | 'mkdir';
      source?: string;
      target: string;
      content?: string | Buffer;
    }>,
    operation: AtomicOperation,
  ): Promise<void> {
    operation.status = 'executing';

    for (const [index, op] of operations.entries()) {
      try {
        switch (op.type) {
          case 'write':
            if (op.content !== undefined) {
              await this.executeBatchWrite(op.target, op.content, operation);
            }
            break;
          case 'move':
            if (op.source) {
              await this.executeBatchMove(op.source, op.target, operation);
            }
            break;
          case 'copy':
            if (op.source) {
              await this.executeBatchCopy(op.source, op.target, operation);
            }
            break;
          case 'delete':
            await this.executeBatchDelete(op.target, operation);
            break;
          case 'mkdir':
            await this.executeBatchMkdir(op.target, operation);
            break;
        }
      } catch (error) {
        // Rollback completed operations
        await this.executeRollback(operation);
        throw new Error(`Batch operation failed at step ${index + 1}: ${error}`);
      }
    }
  }

  /**
   * Execute batch write
   */
  private async executeBatchWrite(
    filePath: string,
    content: string | Buffer,
    operation: AtomicOperation,
  ): Promise<void> {
    if (await this.exists(filePath)) {
      const originalContent = await fs.promises.readFile(filePath);
      const originalStats = await fs.promises.stat(filePath);
      operation.rollbackActions.push({
        type: 'restore_content',
        path: filePath,
        data: originalContent,
        stats: originalStats,
      });
    } else {
      operation.rollbackActions.push({
        type: 'delete_file',
        path: filePath,
      });
    }

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content);
  }

  /**
   * Execute batch move
   */
  private async executeBatchMove(
    sourcePath: string,
    targetPath: string,
    operation: AtomicOperation,
  ): Promise<void> {
    if (await this.exists(targetPath)) {
      const backupPath = path.join(
        this.tempDirectory,
        `backup_${operation.id}_${Date.now()}_${path.basename(targetPath)}`,
      );
      await fs.promises.rename(targetPath, backupPath);
      operation.rollbackActions.push({
        type: 'restore_file',
        path: targetPath,
        originalPath: backupPath,
      });
    }

    operation.rollbackActions.push({
      type: 'restore_file',
      path: sourcePath,
      originalPath: targetPath,
    });

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.rename(sourcePath, targetPath);
  }

  /**
   * Execute batch copy
   */
  private async executeBatchCopy(
    sourcePath: string,
    targetPath: string,
    operation: AtomicOperation,
  ): Promise<void> {
    if (await this.exists(targetPath)) {
      const backupPath = path.join(
        this.tempDirectory,
        `backup_${operation.id}_${Date.now()}_${path.basename(targetPath)}`,
      );
      await fs.promises.rename(targetPath, backupPath);
      operation.rollbackActions.push({
        type: 'restore_file',
        path: targetPath,
        originalPath: backupPath,
      });
    } else {
      operation.rollbackActions.push({
        type: 'delete_file',
        path: targetPath,
      });
    }

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.copyFile(sourcePath, targetPath);
  }

  /**
   * Execute batch delete
   */
  private async executeBatchDelete(filePath: string, operation: AtomicOperation): Promise<void> {
    if (await this.exists(filePath)) {
      const backupPath = path.join(
        this.tempDirectory,
        `backup_${operation.id}_${Date.now()}_${path.basename(filePath)}`,
      );
      await fs.promises.rename(filePath, backupPath);
      operation.rollbackActions.push({
        type: 'restore_file',
        path: filePath,
        originalPath: backupPath,
      });
    }
  }

  /**
   * Execute batch mkdir
   */
  private async executeBatchMkdir(dirPath: string, operation: AtomicOperation): Promise<void> {
    if (!(await this.exists(dirPath))) {
      operation.rollbackActions.push({
        type: 'delete_directory',
        path: dirPath,
      });
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Execute rollback
   */
  private async executeRollback(operation: AtomicOperation): Promise<void> {
    // Execute rollback actions in reverse order
    for (const action of operation.rollbackActions.reverse()) {
      try {
        await this.executeRollbackAction(action);
      } catch (error) {
        console.warn(`Rollback action failed:`, error);
      }
    }
  }

  /**
   * Execute single rollback action
   */
  private async executeRollbackAction(action: RollbackAction): Promise<void> {
    switch (action.type) {
      case 'restore_file':
        if (action.originalPath) {
          await fs.promises.rename(action.originalPath, action.path);
        }
        break;

      case 'delete_file':
        if (await this.exists(action.path)) {
          await fs.promises.unlink(action.path);
        }
        break;

      case 'restore_content':
        if (action.data) {
          await fs.promises.writeFile(action.path, action.data);
          if (action.stats) {
            await fs.promises.utimes(action.path, action.stats.atime, action.stats.mtime);
          }
        }
        break;

      case 'restore_permissions':
        if (action.permissions) {
          await fs.promises.chmod(action.path, action.permissions);
        }
        break;

      case 'delete_directory':
        if (await this.exists(action.path)) {
          await fs.promises.rmdir(action.path);
        }
        break;
    }
  }

  /**
   * Handle operation failure
   */
  private async handleOperationFailure(
    operationId: string,
    error: unknown,
    startTime: number,
  ): Promise<AtomicResult> {
    const operation = this.activeOperations.get(operationId);
    const duration = performance.now() - startTime;

    if (operation) {
      operation.status = 'failed';

      // Attempt rollback
      try {
        await this.executeRollback(operation);
        operation.status = 'rolled_back';
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }

      this.activeOperations.delete(operationId);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    await operationLogger.logOperation('atomic_operation', 'failed', [], {
      duration,
      error: { code: 'ATOMIC_OPERATION_FAILED', message: errorMessage },
    });

    return {
      success: false,
      operationId,
      operations: 0,
      duration,
      error: errorMessage,
      rollbackPerformed: operation?.status === 'rolled_back',
    };
  }

  /**
   * Complete operation
   */
  private completeOperation(operationId: string): void {
    const operation = this.activeOperations.get(operationId);
    if (operation) {
      this.activeOperations.delete(operationId);
      this.completedOperations.set(operationId, operation);

      // Maintain history size
      if (this.completedOperations.size > this.maxHistorySize) {
        const oldestId = Array.from(this.completedOperations.keys())[0];
        this.completedOperations.delete(oldestId);
      }
    }
  }

  /**
   * Recover incomplete operations
   */
  private async recoverIncompleteOperations(): Promise<void> {
    // In a production system, this would read from persistent storage
    // and attempt to complete or rollback incomplete operations
    console.debug('Checking for incomplete operations...');
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
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `atomic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const atomicOperationManager = AtomicOperationManager.getInstance();
