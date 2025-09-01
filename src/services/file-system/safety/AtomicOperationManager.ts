/**
 * Atomic Operation Manager - Transactional File Operations with Rollback
 * Ensures file operations are atomic and can be rolled back on failure
 * Phase 2: Terminal Integration & Safety - Week 8
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import _chalk from "chalk";
import { operationLogger } from "../logging/OperationLogger";
import { backupManager } from "./BackupManager";

export interface AtomicOperation {
  id: string;
  type:
    | "create"
    | "write"
    | "delete"
    | "move"
    | "copy"
    | "chmod"
    | "mkdir"
    | "rmdir"
    | "batch";
  timestamp: Date;
  status: "pending" | "executing" | "completed" | "failed" | "rolled_back";
  originalState: OperationState;
  targetState: OperationState;
  rollbackActions: RollbackAction[];
  metadata: {
    description: string;
    priority: "low" | "normal" | "high" | "critical";
    timeout: number;
    retryCount: number;
    dependencies: string[];
  };
}

export interface OperationState {
  files: Array<{
    _path: string;
    _exists: boolean;
    content?: Buffer;
    _stats?: {
      mode: number;
      size: number;
      mtime: Date;
      atime: Date;
    };
    checksum?: string;
  }>;
  directories: Array<{
    _path: string;
    _exists: boolean;
    contents?: string[];
    permissions?: string;
  }>;
}

export interface RollbackAction {
  type:
    | "restore_file"
    | "delete_file"
    | "restore_directory"
    | "delete_directory"
    | "restore_content"
    | "restore_permissions";
  _path: string;
  data?: Buffer;
  _stats?: fs.Stats;
  permissions?: number;
  originalPath?: string;
}

export interface AtomicResult {
  success: boolean;
  _operationId: string;
  operations: number;
  _duration: number;
  message?: string;
  _error?: string;
  rollbackPerformed?: boolean;
}

export interface TransactionOptions {
  timeout?: number;
  retryCount?: number;
  backup?: boolean;
  dryRun?: boolean;
  priority?: AtomicOperation["metadata"]["priority"];
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
   * Initialize atomic _operation manager
   */
  async initialize(): Promise<boolean> {
    try {
      await this.setupTempDirectory();
      await this.recoverIncompleteOperations();

      console.debug("Atomic _operation manager initialized");
      return true;
    } catch (_error) {
      console._error("Failed to initialize atomic _operation manager:", _error);
      return false;
    }
  }

  /**
   * Execute atomic file write
   */
  async atomicWrite(
    _filePath: string,
    content: string | Buffer,
    options: TransactionOptions = {},
  ): Promise<AtomicResult> {
    const _operationId = this.generateOperationId();
    const _startTime = performance.now();

    try {
      // Create atomic _operation
      const _operation = await this.createAtomicOperation(
        _operationId,
        "write",
        "Atomic write _operation",
        options,
      );

      // Capture original state
      operation.originalState = await this.captureState([_filePath], []);

      // Create backup if requested
      if (options.backup && (await this.exists(_filePath))) {
        await backupManager.createBackup(_filePath, "atomic_write");
      }

      // Execute _operation atomically
      await this.executeAtomicWrite(_filePath, content, _operation);

      // Capture target state
      _operation.targetState = await this.captureState([_filePath], []);

      // Complete _operation
      operation.status = "completed";
      this.completeOperation(_operationId);

      const _duration = performance.now() - _startTime;

      await operationLogger.logOperation(
        "atomic_write",
        "completed",
        [{ _path: _filePath, action: "write", size: content.length }],
        { _duration },
      );

      return {
        success: true,
        _operationId,
        operations: 1,
        _duration,
        message: `Atomic write completed: ${path.basename(_filePath)}`,
      };
    } catch (_error) {
      return await this.handleOperationFailure(
        _operationId,
        _error,
        _startTime,
      );
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
    const _operationId = this.generateOperationId();
    const _startTime = performance.now();

    try {
      const _operation = await this.createAtomicOperation(
        _operationId,
        "move",
        "Atomic move _operation",
        options,
      );

      // Capture original state
      operation.originalState = await this.captureState(
        [sourcePath, targetPath],
        [],
      );

      // Create backup if requested
      if (options.backup) {
        if (await this.exists(sourcePath)) {
          await backupManager.createBackup(sourcePath, "atomic_move_source");
        }
        if (await this.exists(targetPath)) {
          await backupManager.createBackup(targetPath, "atomic_move_target");
        }
      }

      // Execute _operation atomically
      await this.executeAtomicMove(sourcePath, targetPath, _operation);

      // Complete _operation
      _operation.status = "completed";
      operation.targetState = await this.captureState(
        [sourcePath, targetPath],
        [],
      );
      this.completeOperation(_operationId);

      const _duration = performance.now() - _startTime;

      await operationLogger.logOperation(
        "atomic_move",
        "completed",
        [
          { _path: sourcePath, action: "move" },
          { _path: targetPath, action: "create" },
        ],
        { _duration },
      );

      return {
        success: true,
        _operationId,
        operations: 1,
        _duration,
        message: `Atomic move completed: ${path.basename(sourcePath)} → ${path.basename(targetPath)}`,
      };
    } catch (_error) {
      return await this.handleOperationFailure(
        _operationId,
        _error,
        _startTime,
      );
    }
  }

  /**
   * Execute batch atomic operations
   */
  async atomicBatch(
    operations: Array<{
      type: "write" | "move" | "copy" | "delete" | "mkdir";
      source?: string;
      target: string;
      content?: string | Buffer;
    }>,
    options: TransactionOptions = {},
  ): Promise<AtomicResult> {
    const _operationId = this.generateOperationId();
    const _startTime = performance.now();

    try {
      const _operation = await this.createAtomicOperation(
        _operationId,
        "batch",
        `Atomic batch _operation (${operations.length} operations)`,
        options,
      );

      // Collect all paths for state capture
      const allPaths: string[] = [];
      operations.forEach((op) => {
        allPaths.push(op.target);
        if (op.source) {
          allPaths.push(op.source);
        }
      });

      // Capture original state
      operation.originalState = await this.captureState(allPaths, []);

      // Create backups if requested
      if (options.backup) {
        for (const op of operations) {
          if (op.source && (await this.exists(op.source))) {
            await backupManager.createBackup(op.source, "atomic_batch");
          }
          if (await this.exists(op.target)) {
            await backupManager.createBackup(op.target, "atomic_batch");
          }
        }
      }

      // Execute all operations atomically
      await this.executeBatchOperations(operations, _operation);

      // Complete _operation
      _operation.status = "completed";
      operation.targetState = await this.captureState(allPaths, []);
      this.completeOperation(_operationId);

      const _duration = performance.now() - _startTime;

      await operationLogger.logOperation(
        "atomic_batch",
        "completed",
        operations.map((op) => ({
          _path: op.target,
          action: op.type as any,
        })),
        { _duration, context: { operationCount: operations.length } },
      );

      return {
        success: true,
        _operationId,
        operations: operations.length,
        _duration,
        message: `Atomic batch completed: ${operations.length} operations`,
      };
    } catch (_error) {
      return await this.handleOperationFailure(
        _operationId,
        _error,
        _startTime,
      );
    }
  }

  /**
   * Rollback _operation
   */
  async rollbackOperation(_operationId: string): Promise<AtomicResult> {
    const _startTime = performance.now();

    try {
      const _operation =
        this.activeOperations.get(_operationId) ||
        this.completedOperations.get(_operationId);

      if (!_operation) {
        return {
          success: false,
          _operationId,
          operations: 0,
          _duration: 0,
          _error: `Operation not found: ${_operationId}`,
        };
      }

      if (_operation.status === "rolled_back") {
        return {
          success: false,
          _operationId,
          operations: 0,
          _duration: 0,
          _error: "Operation already rolled back",
        };
      }

      // Execute rollback actions
      await this.executeRollback(_operation);

      operation.status = "rolled_back";
      const _duration = performance.now() - _startTime;

      await operationLogger.logOperation("atomic_rollback", "completed", [], {
        _duration,
        context: {
          originalOperation: _operation.type,
          rollbackActions: _operation.rollbackActions.length,
        },
      });

      return {
        success: true,
        _operationId,
        operations: _operation.rollbackActions.length,
        _duration,
        message: `Operation rolled back: ${_operation.metadata.description}`,
        rollbackPerformed: true,
      };
    } catch (_error) {
      const _duration = performance.now() - _startTime;

      await operationLogger.logOperation("atomic_rollback", "failed", [], {
        _duration,
        _error: {
          code: "ROLLBACK_FAILED",
          message: _error instanceof Error ? _error.message : String(_error),
        },
      });

      return {
        success: false,
        _operationId,
        operations: 0,
        _duration,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Get _operation status
   */
  getOperationStatus(_operationId: string): AtomicOperation | null {
    return (
      this.activeOperations.get(_operationId) ||
      this.completedOperations.get(_operationId) ||
      null
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
   * Cancel active _operation
   */
  async cancelOperation(_operationId: string): Promise<AtomicResult> {
    const _operation = this.activeOperations.get(_operationId);

    if (!_operation) {
      return {
        success: false,
        _operationId,
        operations: 0,
        _duration: 0,
        _error: "Operation not found or already completed",
      };
    }

    if (_operation.status === "executing") {
      // Can't cancel executing _operation - try rollback instead
      return await this.rollbackOperation(_operationId);
    }

    operation.status = "failed";
    this.activeOperations.delete(_operationId);

    return {
      success: true,
      _operationId,
      operations: 0,
      _duration: 0,
      message: "Operation cancelled",
    };
  }

  /**
   * Clean up old operations
   */
  async cleanup(olderThanHours: number = 24): Promise<void> {
    const _cutoffTime = new Date();
    _cutoffTime.setHours(_cutoffTime.getHours() - olderThanHours);

    // Clean up completed operations
    const toRemove: string[] = [];
    for (const [id, _operation] of this.completedOperations) {
      if (operation.timestamp < _cutoffTime) {
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
    this.tempDirectory = path.join(os.tmpdir(), "maria-atomic-ops");
  }

  /**
   * Setup temp directory
   */
  private async setupTempDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.tempDirectory, { recursive: true });
    } catch (_error) {
      throw new Error(`Failed to create temp directory: ${_error}`);
    }
  }

  /**
   * Create atomic _operation
   */
  private async createAtomicOperation(
    _operationId: string,
    type: AtomicOperation["type"],
    description: string,
    options: TransactionOptions,
  ): Promise<AtomicOperation> {
    const _operation: AtomicOperation = {
      id: _operationId,
      type,
      timestamp: new Date(),
      status: "pending",
      originalState: { files: [], directories: [] },
      targetState: { files: [], directories: [] },
      rollbackActions: [],
      metadata: {
        description,
        priority: options.priority || "normal",
        timeout: options.timeout || 30000,
        retryCount: options.retryCount || 0,
        dependencies: options.dependencies || [],
      },
    };

    this.activeOperations.set(_operationId, _operation);
    return _operation;
  }

  /**
   * Capture file system state
   */
  private async captureState(
    _filePaths: string[],
    dirPaths: string[],
  ): Promise<OperationState> {
    const state: OperationState = {
      files: [],
      directories: [],
    };

    // Capture file states
    for (const _filePath of _filePaths) {
      try {
        const _exists = await this._exists(_filePath);
        const fileState: OperationState["files"][0] = {
          _path: _filePath,
          _exists,
        };

        if (_exists) {
          const _stats = await fs.promises.stat(_filePath);
          if (_stats.isFile()) {
            fileState.content = await fs.promises.readFile(_filePath);
            fileState._stats = {
              mode: _stats.mode,
              size: _stats.size,
              mtime: _stats.mtime,
              atime: _stats.atime,
            };
          }
        }

        state.files.push(fileState);
      } catch (_error) {
        // Skip files we can't access
        console.debug(`Failed to capture state for ${_filePath}:`, _error);
      }
    }

    // Capture directory states
    for (const dirPath of dirPaths) {
      try {
        const _exists = await this._exists(dirPath);
        const dirState: OperationState["directories"][0] = {
          _path: dirPath,
          _exists,
        };

        if (_exists) {
          const _stats = await fs.promises.stat(dirPath);
          if (_stats.isDirectory()) {
            dirState.contents = await fs.promises.readdir(dirPath);
            dirState.permissions = (_stats.mode & 0o777).toString(8);
          }
        }

        state.directories.push(dirState);
      } catch (_error) {
        console.debug(`Failed to capture state for ${dirPath}:`, _error);
      }
    }

    return state;
  }

  /**
   * Execute atomic write
   */
  private async executeAtomicWrite(
    _filePath: string,
    content: string | Buffer,
    _operation: AtomicOperation,
  ): Promise<void> {
    operation.status = "executing";

    const _tempFile = path.join(
      this.tempDirectory,
      `write_${_operation.id}_${path.basename(_filePath)}`,
    );

    try {
      // Write to temporary file first
      await fs.promises.writeFile(_tempFile, content);

      // Prepare rollback actions
      if (await this.exists(_filePath)) {
        const _originalContent = await fs.promises.readFile(_filePath);
        const _originalStats = await fs.promises.stat(_filePath);
        operation.rollbackActions.push({
          type: "restore_content",
          _path: _filePath,
          data: _originalContent,
          _stats: _originalStats,
        });
      } else {
        operation.rollbackActions.push({
          type: "delete_file",
          _path: _filePath,
        });
      }

      // Atomic move from temp to target
      await fs.promises.mkdir(path.dirname(_filePath), { recursive: true });
      await fs.promises.rename(_tempFile, _filePath);
    } finally {
      // Clean up temp file if it still _exists
      try {
        await fs.promises.unlink(_tempFile);
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
    _operation: AtomicOperation,
  ): Promise<void> {
    operation.status = "executing";

    // Prepare rollback actions
    if (await this.exists(targetPath)) {
      const _backupPath = path.join(
        this.tempDirectory,
        `backup_${_operation.id}_${path.basename(targetPath)}`,
      );
      await fs.promises.rename(targetPath, _backupPath);
      operation.rollbackActions.push({
        type: "restore_file",
        _path: targetPath,
        originalPath: _backupPath,
      });
    }

    operation.rollbackActions.push({
      type: "restore_file",
      _path: sourcePath,
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
      type: "write" | "move" | "copy" | "delete" | "mkdir";
      source?: string;
      target: string;
      content?: string | Buffer;
    }>,
    _operation: AtomicOperation,
  ): Promise<void> {
    operation.status = "executing";

    for (const [index, op] of operations.entries()) {
      try {
        switch (op.type) {
          case "write":
            if (op.content !== undefined) {
              await this.executeBatchWrite(op.target, op.content, _operation);
            }
            break;
          case "move":
            if (op.source) {
              await this.executeBatchMove(op.source, op.target, _operation);
            }
            break;
          case "copy":
            if (op.source) {
              await this.executeBatchCopy(op.source, op.target, _operation);
            }
            break;
          case "delete":
            await this.executeBatchDelete(op.target, _operation);
            break;
          case "mkdir":
            await this.executeBatchMkdir(op.target, _operation);
            break;
        }
      } catch (_error) {
        // Rollback completed operations
        await this.executeRollback(_operation);
        throw new Error(
          `Batch _operation failed at step ${index + 1}: ${_error}`,
        );
      }
    }
  }

  /**
   * Execute batch write
   */
  private async executeBatchWrite(
    _filePath: string,
    content: string | Buffer,
    _operation: AtomicOperation,
  ): Promise<void> {
    if (await this.exists(_filePath)) {
      const _originalContent = await fs.promises.readFile(_filePath);
      const _originalStats = await fs.promises.stat(_filePath);
      operation.rollbackActions.push({
        type: "restore_content",
        _path: _filePath,
        data: _originalContent,
        _stats: _originalStats,
      });
    } else {
      operation.rollbackActions.push({
        type: "delete_file",
        _path: _filePath,
      });
    }

    await fs.promises.mkdir(path.dirname(_filePath), { recursive: true });
    await fs.promises.writeFile(_filePath, content);
  }

  /**
   * Execute batch move
   */
  private async executeBatchMove(
    sourcePath: string,
    targetPath: string,
    _operation: AtomicOperation,
  ): Promise<void> {
    if (await this.exists(targetPath)) {
      const _backupPath = path.join(
        this.tempDirectory,
        `backup_${_operation.id}_${Date.now()}_${path.basename(targetPath)}`,
      );
      await fs.promises.rename(targetPath, _backupPath);
      operation.rollbackActions.push({
        type: "restore_file",
        _path: targetPath,
        originalPath: _backupPath,
      });
    }

    operation.rollbackActions.push({
      type: "restore_file",
      _path: sourcePath,
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
    _operation: AtomicOperation,
  ): Promise<void> {
    if (await this.exists(targetPath)) {
      const _backupPath = path.join(
        this.tempDirectory,
        `backup_${_operation.id}_${Date.now()}_${path.basename(targetPath)}`,
      );
      await fs.promises.rename(targetPath, _backupPath);
      operation.rollbackActions.push({
        type: "restore_file",
        _path: targetPath,
        originalPath: _backupPath,
      });
    } else {
      operation.rollbackActions.push({
        type: "delete_file",
        _path: targetPath,
      });
    }

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.copyFile(sourcePath, targetPath);
  }

  /**
   * Execute batch delete
   */
  private async executeBatchDelete(
    _filePath: string,
    _operation: AtomicOperation,
  ): Promise<void> {
    if (await this.exists(_filePath)) {
      const _backupPath = path.join(
        this.tempDirectory,
        `backup_${_operation.id}_${Date.now()}_${path.basename(_filePath)}`,
      );
      await fs.promises.rename(_filePath, _backupPath);
      operation.rollbackActions.push({
        type: "restore_file",
        _path: _filePath,
        originalPath: _backupPath,
      });
    }
  }

  /**
   * Execute batch mkdir
   */
  private async executeBatchMkdir(
    _dirPath: string,
    _operation: AtomicOperation,
  ): Promise<void> {
    if (!(await this.exists(_dirPath))) {
      operation.rollbackActions.push({
        type: "delete_directory",
        _path: _dirPath,
      });
      await fs.promises.mkdir(_dirPath, { recursive: true });
    }
  }

  /**
   * Execute rollback
   */
  private async executeRollback(_operation: AtomicOperation): Promise<void> {
    // Execute rollback actions in reverse order
    for (const action of _operation.rollbackActions.reverse()) {
      try {
        await this.executeRollbackAction(action);
      } catch (_error) {
        console.warn(`Rollback action failed:`, _error);
      }
    }
  }

  /**
   * Execute single rollback action
   */
  private async executeRollbackAction(action: RollbackAction): Promise<void> {
    switch (action.type) {
      case "restore_file":
        if (action.originalPath) {
          await fs.promises.rename(action.originalPath, action._path);
        }
        break;

      case "delete_file":
        if (await this.exists(action._path)) {
          await fs.promises.unlink(action._path);
        }
        break;

      case "restore_content":
        if (action.data) {
          await fs.promises.writeFile(action._path, action.data);
          if (action.stats) {
            await fs.promises.utimes(
              action._path,
              action.stats.atime,
              action.stats.mtime,
            );
          }
        }
        break;

      case "restore_permissions":
        if (action.permissions) {
          await fs.promises.chmod(action._path, action.permissions);
        }
        break;

      case "delete_directory":
        if (await this.exists(action._path)) {
          await fs.promises.rmdir(action._path);
        }
        break;
    }
  }

  /**
   * Handle _operation failure
   */
  private async handleOperationFailure(
    _operationId: string,
    _error: unknown,
    _startTime: number,
  ): Promise<AtomicResult> {
    const _operation = this.activeOperations.get(_operationId);
    const _duration = performance.now() - _startTime;

    if (_operation) {
      operation.status = "failed";

      // Attempt rollback
      try {
        await this.executeRollback(_operation);
        operation.status = "rolled_back";
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }

      this.activeOperations.delete(_operationId);
    }

    const _errorMessage =
      _error instanceof Error ? error.message : String(_error);

    await operationLogger.logOperation("atomic_operation", "failed", [], {
      _duration,
      _error: { code: "ATOMIC_OPERATION_FAILED", message: _errorMessage },
    });

    return {
      success: false,
      _operationId,
      operations: 0,
      _duration,
      _error: _errorMessage,
      rollbackPerformed: _operation?.status === "rolled_back",
    };
  }

  /**
   * Complete _operation
   */
  private completeOperation(_operationId: string): void {
    const _operation = this.activeOperations.get(_operationId);
    if (_operation) {
      this.activeOperations.delete(_operationId);
      this.completedOperations.set(_operationId, _operation);

      // Maintain history size
      if (this.completedOperations.size > this.maxHistorySize) {
        const _oldestId = Array.from(this.completedOperations.keys())[0];
        this.completedOperations.delete(_oldestId);
      }
    }
  }

  /**
   * Recover incomplete operations
   */
  private async recoverIncompleteOperations(): Promise<void> {
    // In a production system, this would read from persistent storage
    // and attempt to complete or rollback incomplete operations
    console.debug("Checking for incomplete operations...");
  }

  /**
   * Check if file _exists
   */
  private async _exists(_filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(_filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate _operation ID
   */
  private generateOperationId(): string {
    return `atomic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const _atomicOperationManager = AtomicOperationManager.getInstance();
