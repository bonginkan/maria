/**
 * Interrupted Operation Recovery - Recovery System for Failed Operations
 * Detects and recovers from interrupted file _operations
 * Phase 2: Terminal Integration & Safety - Week 8
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import chalk from "chalk";
import { operationLogger } from "../logging/OperationLogger";
import { atomicOperationManager } from "../safety/AtomicOperationManager";

export interface InterruptedOperation {
  id: string;
  type: "copy" | "move" | "write" | "delete" | "batch";
  timestamp: Date;
  status:
    | "detecting"
    | "analyzed"
    | "_recoverable"
    | "unrecoverable"
    | "_recovered"
    | "_abandoned";
  source?: string;
  target: string;
  progress: {
    totalSize: number;
    processedSize: number;
    percentage: number;
  };
  metadata: {
    processId: number;
    sessionId: string;
    checksum?: string;
    _lockFiles: string[];
    _tempFiles: string[];
  };
  recovery: {
    strategy: "resume" | "restart" | "rollback" | "manual";
    confidence: number; // 0-100
    estimatedTime: number; // in ms
    riskLevel: "low" | "medium" | "high" | "critical";
  };
}

export interface RecoveryResult {
  success: boolean;
  operationId: string;
  strategy: InterruptedOperation["recovery"]["strategy"];
  recoveredFiles: number;
  _duration: number;
  message?: string;
  _error?: string;
}

export interface RecoveryStats {
  totalDetected: number;
  _recovered: number;
  _abandoned: number;
  recoverableOperations: number;
  averageRecoveryTime: number;
  successRate: number;
}

export class InterruptedOperationRecovery {
  private static instance: InterruptedOperationRecovery;
  private detectedOperations: Map<string, InterruptedOperation> = new Map();
  private recoveryDirectory: string;
  private lockDirectory: string;
  private scanInterval: NodeJS.Timeout | null = null;
  private maxRecoveryAge: number = 24 * 60 * 60 * 1000; // 24 hours

  public static getInstance(): InterruptedOperationRecovery {
    if (!InterruptedOperationRecovery.instance) {
      InterruptedOperationRecovery.instance =
        new InterruptedOperationRecovery();
    }
    return InterruptedOperationRecovery.instance;
  }

  private constructor() {
    this.initializeDirectories();
  }

  /**
   * Initialize recovery system
   */
  async initialize(): Promise<boolean> {
    try {
      await this.setupDirectories();
      await this.scanForInterruptedOperations();
      this.startPeriodicScanning();

      console.debug("Interrupted _operation recovery system initialized");
      return true;
    } catch (_error) {
      console._error("Failed to initialize recovery system:", _error);
      return false;
    }
  }

  /**
   * Scan for interrupted _operations
   */
  async scanForInterruptedOperations(): Promise<InterruptedOperation[]> {
    const _operations: InterruptedOperation[] = [];

    try {
      // Scan for lock _files
      const _lockFiles = await this.findLockFiles();
      for (const lockFile of _lockFiles) {
        const _operation = await this.analyzeLockFile(lockFile);
        if (_operation) {
          operations.push(_operation);
          this.detectedOperations.set(_operation.id, _operation);
        }
      }

      // Scan for incomplete temporary _files
      const _tempFiles = await this.findIncompleteFiles();
      for (const tempFile of _tempFiles) {
        const _operation = await this.analyzeTempFile(tempFile);
        if (_operation) {
          operations.push(_operation);
          this.detectedOperations.set(_operation.id, _operation);
        }
      }

      // Scan for partial _operations based on file sizes
      const _partialOps = await this.detectPartialOperations();
      for (const _operation of _partialOps) {
        operations.push(_operation);
        this.detectedOperations.set(_operation.id, _operation);
      }

      if (_operations.length > 0) {
        console.log(
          chalk.yellow(
            `⚠️ Detected ${_operations.length} interrupted _operations`,
          ),
        );
        await this.logRecoveryEvent("scan_completed", {
          detectedOperations: _operations.length,
          types: _operations.map((op) => op.type),
        });
      }

      return _operations;
    } catch (_error) {
      console._error("Failed to scan for interrupted _operations:", _error);
      return [];
    }
  }

  /**
   * Recover specific interrupted _operation
   */
  async recoverOperation(operationId: string): Promise<RecoveryResult> {
    const _startTime = performance.now();

    try {
      const _operation = this.detectedOperations.get(operationId);
      if (!_operation) {
        return {
          success: false,
          operationId,
          strategy: "manual",
          recoveredFiles: 0,
          _duration: 0,
          _error: `Operation not found: ${operationId}`,
        };
      }

      operation.status = "analyzing";

      // Analyze recovery options
      await this.analyzeRecoveryOptions(_operation);

      if (_operation.status === "unrecoverable") {
        return {
          success: false,
          operationId,
          strategy: _operation.recovery.strategy,
          recoveredFiles: 0,
          _duration: performance.now() - _startTime,
          _error: "Operation is not _recoverable",
        };
      }

      // Execute recovery strategy
      const _result = await this.executeRecovery(_operation);

      if (_result.success) {
        operation.status = "_recovered";
        this.detectedOperations.delete(operationId);
      } else {
        operation.status = "_abandoned";
      }

      const _duration = performance.now() - _startTime;

      await this.logRecoveryEvent("recovery_completed", {
        operationId,
        strategy: _operation.recovery.strategy,
        success: _result.success,
        _duration,
      });

      return {
        ..._result,
        _duration,
      };
    } catch (_error) {
      const _duration = performance.now() - _startTime;

      await this.logRecoveryEvent("recovery_failed", {
        operationId,
        _error: _error instanceof Error ? _error.message : String(_error),
        _duration,
      });

      return {
        success: false,
        operationId,
        strategy: "manual",
        recoveredFiles: 0,
        _duration,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Recover all detected _operations
   */
  async recoverAllOperations(): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];
    const _operations = Array.from(this.detectedOperations.keys());

    console.log(
      chalk.blue(
        `🔄 Attempting to recover ${_operations.length} _operations...`,
      ),
    );

    for (const operationId of _operations) {
      const _result = await this.recoverOperation(operationId);
      results.push(_result);

      if (_result.success) {
        console.log(chalk.green(`✅ Recovered: ${operationId}`));
      } else {
        console.log(chalk.red(`❌ Failed: ${operationId} - ${_result.error}`));
      }
    }

    const _successCount = results.filter((r) => r.success).length;
    console.log(
      chalk.blue(
        `\n📊 Recovery Summary: ${_successCount}/${results.length} _operations _recovered`,
      ),
    );

    return results;
  }

  /**
   * Get detected _operations
   */
  getDetectedOperations(): InterruptedOperation[] {
    return Array.from(this.detectedOperations.values());
  }

  /**
   * Get recovery statistics
   */
  async getRecoveryStats(): Promise<RecoveryStats> {
    const _operations = this.getDetectedOperations();
    const _recovered = _operations.filter(
      (op) => op.status === "_recovered",
    ).length;
    const _abandoned = _operations.filter(
      (op) => op.status === "_abandoned",
    ).length;
    const _recoverable = _operations.filter(
      (op) => op.status === "_recoverable",
    ).length;

    // Calculate average recovery time from logs
    const _averageTime = await this.calculateAverageRecoveryTime();

    return {
      totalDetected: _operations.length,
      _recovered,
      _abandoned,
      recoverableOperations: _recoverable,
      averageRecoveryTime: _averageTime,
      successRate: _operations.length > 0 ? _recovered / _operations.length : 0,
    };
  }

  /**
   * Abandon _operation (mark as unrecoverable)
   */
  async abandonOperation(operationId: string): Promise<void> {
    const _operation = this.detectedOperations.get(operationId);
    if (_operation) {
      operation.status = "_abandoned";
      await this.cleanupOperationFiles(_operation);
      this.detectedOperations.delete(operationId);

      await this.logRecoveryEvent("operation_abandoned", { operationId });
    }
  }

  /**
   * Clean up all recovery _files
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up old lock _files
      const _lockFiles = await fs.promises.readdir(this.lockDirectory);
      for (const lockFile of _lockFiles) {
        const _lockPath = path.join(this.lockDirectory, lockFile);
        const _stats = await fs.promises.stat(_lockPath);

        if (Date.now() - _stats.mtime.getTime() > this.maxRecoveryAge) {
          await fs.promises.unlink(_lockPath);
        }
      }

      // Clean up old recovery _files
      const _recoveryFiles = await fs.promises.readdir(this.recoveryDirectory);
      for (const recoveryFile of _recoveryFiles) {
        const _recoveryPath = path.join(this.recoveryDirectory, recoveryFile);
        const _stats = await fs.promises.stat(_recoveryPath);

        if (Date.now() - _stats.mtime.getTime() > this.maxRecoveryAge) {
          await fs.promises.unlink(_recoveryPath);
        }
      }

      console.log(chalk.green("✅ Recovery cleanup completed"));
    } catch (_error) {
      console.warn("Recovery cleanup failed:", _error);
    }
  }

  /**
   * Show recovery status
   */
  async showStatus(): Promise<void> {
    const _stats = await this.getRecoveryStats();
    const _operations = this.getDetectedOperations();

    console.log(chalk.blue("\n🔄 Recovery System Status"));
    console.log(`Detected _operations: ${chalk.yellow(_stats.totalDetected)}`);
    console.log(`Recoverable: ${chalk.green(_stats.recoverableOperations)}`);
    console.log(`Recovered: ${chalk.green(_stats.recovered)}`);
    console.log(`Abandoned: ${chalk.red(_stats.abandoned)}`);
    console.log(
      `Success rate: ${chalk.yellow((_stats.successRate * 100).toFixed(1))}%`,
    );
    console.log(
      `Average recovery time: ${chalk.yellow(_stats.averageRecoveryTime.toFixed(1))}ms`,
    );

    if (_operations.length > 0) {
      console.log(chalk.blue("\nDetected Operations:"));
      operations.forEach((op) => {
        const _statusColor =
          op.status === "_recoverable"
            ? chalk.green
            : op.status === "unrecoverable"
              ? chalk.red
              : chalk.yellow;
        const _riskColor =
          op.recovery.riskLevel === "low"
            ? chalk.green
            : op.recovery.riskLevel === "medium"
              ? chalk.yellow
              : chalk.red;

        console.log(
          `  ${chalk.cyan(op.id.substr(0, 8))} ${chalk.gray(op.type)} ${_statusColor(op.status)} ${_riskColor(op.recovery.riskLevel)} ${chalk.gray(`(${op.progress.percentage.toFixed(1)}%)`)}`,
        );
      });
    }
  }

  /**
   * Initialize directories
   */
  private initializeDirectories(): void {
    this.recoveryDirectory = path.join(os.tmpdir(), "maria-recovery");
    this.lockDirectory = path.join(os.tmpdir(), "maria-locks");
  }

  /**
   * Setup directories
   */
  private async setupDirectories(): Promise<void> {
    await fs.promises.mkdir(this.recoveryDirectory, { recursive: true });
    await fs.promises.mkdir(this.lockDirectory, { recursive: true });
  }

  /**
   * Find lock _files
   */
  private async findLockFiles(): Promise<string[]> {
    try {
      const _files = await fs.promises.readdir(this.lockDirectory);
      return _files
        .filter((file) => file.endsWith(".lock"))
        .map((file) => path.join(this.lockDirectory, file));
    } catch {
      return [];
    }
  }

  /**
   * Find incomplete temporary _files
   */
  private async findIncompleteFiles(): Promise<string[]> {
    const _tempFiles: string[] = [];

    try {
      // Scan common temp locations
      const _tempDirs = [
        os.tmpdir(),
        path.join(os.tmpdir(), "maria-*"),
        "/tmp/maria-*",
      ];

      for (const tempDir of _tempDirs) {
        try {
          const _files = await fs.promises.readdir(tempDir);
          const _mariaFiles = _files.filter(
            (file) =>
              file.includes("maria") &&
              (file.endsWith(".tmp") || file.endsWith(".part")),
          );

          tempFiles.push(
            ..._mariaFiles.map((file) => path.join(tempDir, file)),
          );
        } catch {
          // Skip directories we can't read
        }
      }
    } catch {
      // Skip if temp directory scanning fails
    }

    return _tempFiles;
  }

  /**
   * Detect partial _operations
   */
  private async detectPartialOperations(): Promise<InterruptedOperation[]> {
    // This would analyze file system for _operations that appear incomplete
    // Based on file sizes, modification times, and patterns
    return [];
  }

  /**
   * Analyze lock file
   */
  private async analyzeLockFile(
    lockFilePath: string,
  ): Promise<InterruptedOperation | null> {
    try {
      const _content = await fs.promises.readFile(lockFilePath, "utf8");
      const _lockData = JSON.parse(_content);

      const _operation: InterruptedOperation = {
        id: _lockData.operationId || this.generateOperationId(),
        type: _lockData.type || "copy",
        timestamp: new Date(_lockData.timestamp),
        status: "analyzing",
        source: _lockData.source,
        target: _lockData.target,
        progress: _lockData.progress || {
          totalSize: 0,
          processedSize: 0,
          percentage: 0,
        },
        metadata: {
          processId: _lockData.processId || 0,
          sessionId: _lockData.sessionId || "unknown",
          checksum: _lockData.checksum,
          _lockFiles: [lockFilePath],
          _tempFiles: _lockData.tempFiles || [],
        },
        recovery: {
          strategy: "resume",
          confidence: 0,
          estimatedTime: 0,
          riskLevel: "medium",
        },
      };

      return _operation;
    } catch {
      return null;
    }
  }

  /**
   * Analyze temporary file
   */
  private async analyzeTempFile(
    tempFilePath: string,
  ): Promise<InterruptedOperation | null> {
    try {
      const _stats = await fs.promises.stat(tempFilePath);
      const _fileName = path.basename(tempFilePath);

      // Extract _operation info from filename pattern
      const _match = _fileName._match(/maria_(\w+)_(\w+)\.tmp/);
      if (!_match) {
        return null;
      }

      const _operation: InterruptedOperation = {
        id: this.generateOperationId(),
        type: "copy",
        timestamp: _stats.mtime,
        status: "analyzing",
        target: tempFilePath,
        progress: {
          totalSize: _stats.size,
          processedSize: _stats.size,
          percentage: 100,
        },
        metadata: {
          processId: 0,
          sessionId: "unknown",
          _lockFiles: [],
          _tempFiles: [tempFilePath],
        },
        recovery: {
          strategy: "restart",
          confidence: 0,
          estimatedTime: 0,
          riskLevel: "low",
        },
      };

      return _operation;
    } catch {
      return null;
    }
  }

  /**
   * Analyze recovery options
   */
  private async analyzeRecoveryOptions(
    _operation: InterruptedOperation,
  ): Promise<void> {
    // Check if source and target still exist
    const _sourceExists = operation.source
      ? await this.exists(operation.source)
      : true;
    const _targetExists = await this.exists(operation.target);

    // Calculate confidence and risk based on file states
    let confidence = 50;
    let riskLevel: InterruptedOperation["recovery"]["riskLevel"] = "medium";
    let strategy: InterruptedOperation["recovery"]["strategy"] = "restart";

    if (!_sourceExists && operation.source) {
      confidence = 10;
      riskLevel = "high";
      strategy = "manual";
    } else if (_targetExists) {
      // Check if target file is complete
      try {
        const _targetStats = await fs.promises.stat(operation.target);
        const _completionRatio =
          _targetStats.size / operation.progress.totalSize;

        if (_completionRatio > 0.9) {
          confidence = 90;
          riskLevel = "low";
          strategy = "resume";
        } else if (_completionRatio > 0.5) {
          confidence = 70;
          riskLevel = "medium";
          strategy = "resume";
        } else {
          confidence = 40;
          riskLevel = "medium";
          strategy = "restart";
        }
      } catch {
        confidence = 30;
        riskLevel = "high";
        strategy = "restart";
      }
    }

    // Check for lock file _age
    const _age = Date.now() - operation.timestamp.getTime();
    if (_age > this.maxRecoveryAge) {
      confidence = Math.max(10, confidence - 30);
      riskLevel = "high";
    }

    operation.recovery.confidence = confidence;
    operation.recovery.riskLevel = riskLevel;
    operation.recovery.strategy = strategy;
    operation.recovery.estimatedTime = this.estimateRecoveryTime(_operation);

    operation.status = confidence > 50 ? "_recoverable" : "unrecoverable";
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecovery(
    _operation: InterruptedOperation,
  ): Promise<Omit<RecoveryResult, "_duration">> {
    try {
      switch (operation.recovery.strategy) {
        case "resume":
          return await this.executeResumeRecovery(_operation);
        case "restart":
          return await this.executeRestartRecovery(_operation);
        case "rollback":
          return await this.executeRollbackRecovery(_operation);
        default:
          return {
            success: false,
            operationId: operation.id,
            strategy: operation.recovery.strategy,
            recoveredFiles: 0,
            _error: "Manual recovery required",
          };
      }
    } catch (_error) {
      return {
        success: false,
        operationId: operation.id,
        strategy: operation.recovery.strategy,
        recoveredFiles: 0,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Execute resume recovery
   */
  private async executeResumeRecovery(
    _operation: InterruptedOperation,
  ): Promise<Omit<RecoveryResult, "_duration">> {
    // Try to resume the _operation from where it left off
    if (operation.source && operation.target) {
      try {
        const _sourceStats = await fs.promises.stat(operation.source);
        const _targetStats = await fs.promises.stat(operation.target);

        if (_targetStats.size < _sourceStats.size) {
          // Resume copy _operation
          const _sourceHandle = await fs.promises.open(operation.source, "r");
          const _targetHandle = await fs.promises.open(operation.target, "a");

          try {
            const _buffer = Buffer.allocUnsafe(64 * 1024); // 64KB chunks
            let position = _targetStats.size;

            while (position < _sourceStats.size) {
              const { bytesRead } = await _sourceHandle.read(
                _buffer,
                0,
                _buffer.length,
                position,
              );
              if (bytesRead === 0) {
                break;
              }

              await _targetHandle.write(_buffer, 0, bytesRead);
              position += bytesRead;
            }

            await this.cleanupOperationFiles(_operation);

            return {
              success: true,
              operationId: operation.id,
              strategy: "resume",
              recoveredFiles: 1,
              message: "Operation resumed successfully",
            };
          } finally {
            await _sourceHandle.close();
            await _targetHandle.close();
          }
        } else {
          // File is already complete
          await this.cleanupOperationFiles(_operation);

          return {
            success: true,
            operationId: operation.id,
            strategy: "resume",
            recoveredFiles: 1,
            message: "Operation was already complete",
          };
        }
      } catch (_error) {
        return {
          success: false,
          operationId: operation.id,
          strategy: "resume",
          recoveredFiles: 0,
          _error: `Resume failed: ${_error}`,
        };
      }
    }

    return {
      success: false,
      operationId: operation.id,
      strategy: "resume",
      recoveredFiles: 0,
      _error: "Insufficient information to resume",
    };
  }

  /**
   * Execute restart recovery
   */
  private async executeRestartRecovery(
    _operation: InterruptedOperation,
  ): Promise<Omit<RecoveryResult, "_duration">> {
    try {
      // Use atomic _operation manager to restart the _operation safely
      if (operation.source && operation.target) {
        const _result = await atomicOperationManager.atomicMove(
          operation.source,
          operation.target,
          {
            backup: true,
            rollbackOnFailure: true,
          },
        );

        if (_result.success) {
          await this.cleanupOperationFiles(_operation);

          return {
            success: true,
            operationId: operation.id,
            strategy: "restart",
            recoveredFiles: 1,
            message: "Operation restarted successfully",
          };
        } else {
          return {
            success: false,
            operationId: operation.id,
            strategy: "restart",
            recoveredFiles: 0,
            _error: _result._error || "Restart failed",
          };
        }
      }

      return {
        success: false,
        operationId: operation.id,
        strategy: "restart",
        recoveredFiles: 0,
        _error: "Insufficient information to restart",
      };
    } catch (_error) {
      return {
        success: false,
        operationId: operation.id,
        strategy: "restart",
        recoveredFiles: 0,
        _error: `Restart failed: ${_error}`,
      };
    }
  }

  /**
   * Execute rollback recovery
   */
  private async executeRollbackRecovery(
    _operation: InterruptedOperation,
  ): Promise<Omit<RecoveryResult, "_duration">> {
    try {
      // Clean up any partial _files and restore original state
      await this.cleanupOperationFiles(_operation);

      return {
        success: true,
        operationId: operation.id,
        strategy: "rollback",
        recoveredFiles: 0,
        message: "Operation rolled back successfully",
      };
    } catch (_error) {
      return {
        success: false,
        operationId: operation.id,
        strategy: "rollback",
        recoveredFiles: 0,
        _error: `Rollback failed: ${_error}`,
      };
    }
  }

  /**
   * Cleanup _operation _files
   */
  private async cleanupOperationFiles(
    _operation: InterruptedOperation,
  ): Promise<void> {
    // Clean up lock _files
    for (const lockFile of _operation.metadata.lockFiles) {
      try {
        await fs.promises.unlink(lockFile);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up temp _files
    for (const tempFile of _operation.metadata.tempFiles) {
      try {
        await fs.promises.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Estimate recovery time
   */
  private estimateRecoveryTime(_operation: InterruptedOperation): number {
    const _baseTime = 1000; // 1 second base
    const _sizeMultiplier = _operation.progress.totalSize / (1024 * 1024); // MB
    const _confidenceMultiplier = (100 - _operation.recovery.confidence) / 100;

    return _baseTime + _sizeMultiplier * 100 + _confidenceMultiplier * 5000;
  }

  /**
   * Calculate average recovery time
   */
  private async calculateAverageRecoveryTime(): Promise<number> {
    // This would analyze recovery logs to calculate average time
    return 2500; // Default 2.5 seconds
  }

  /**
   * Start periodic scanning
   */
  private startPeriodicScanning(): void {
    this.scanInterval = setInterval(async () => {
      await this.scanForInterruptedOperations();
    }, 60000); // Scan every minute
  }

  /**
   * Log recovery event
   */
  private async logRecoveryEvent(
    event: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await operationLogger.logOperation("recovery", "completed", [], {
      level: "info",
      context: {
        recoveryEvent: event,
        ...data,
      },
    });
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
   * Generate _operation ID
   */
  private generateOperationId(): string {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const _interruptedOperationRecovery =
  InterruptedOperationRecovery.getInstance();
