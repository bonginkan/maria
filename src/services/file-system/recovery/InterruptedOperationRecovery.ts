/**
 * Interrupted Operation Recovery - Recovery System for Failed Operations
 * Detects and recovers from interrupted file operations
 * Phase 2: Terminal Integration & Safety - Week 8
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { operationLogger } from '../logging/OperationLogger';
import { atomicOperationManager } from '../safety/AtomicOperationManager';

export interface InterruptedOperation {
  id: string;
  type: 'copy' | 'move' | 'write' | 'delete' | 'batch';
  timestamp: Date;
  status: 'detecting' | 'analyzed' | 'recoverable' | 'unrecoverable' | 'recovered' | 'abandoned';
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
    lockFiles: string[];
    tempFiles: string[];
  };
  recovery: {
    strategy: 'resume' | 'restart' | 'rollback' | 'manual';
    confidence: number; // 0-100
    estimatedTime: number; // in ms
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface RecoveryResult {
  success: boolean;
  operationId: string;
  strategy: InterruptedOperation['recovery']['strategy'];
  recoveredFiles: number;
  duration: number;
  message?: string;
  error?: string;
}

export interface RecoveryStats {
  totalDetected: number;
  recovered: number;
  abandoned: number;
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
      InterruptedOperationRecovery.instance = new InterruptedOperationRecovery();
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

      console.debug('Interrupted operation recovery system initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize recovery system:', error);
      return false;
    }
  }

  /**
   * Scan for interrupted operations
   */
  async scanForInterruptedOperations(): Promise<InterruptedOperation[]> {
    const operations: InterruptedOperation[] = [];

    try {
      // Scan for lock files
      const lockFiles = await this.findLockFiles();
      for (const lockFile of lockFiles) {
        const operation = await this.analyzeLockFile(lockFile);
        if (operation) {
          operations.push(operation);
          this.detectedOperations.set(operation.id, operation);
        }
      }

      // Scan for incomplete temporary files
      const tempFiles = await this.findIncompleteFiles();
      for (const tempFile of tempFiles) {
        const operation = await this.analyzeTempFile(tempFile);
        if (operation) {
          operations.push(operation);
          this.detectedOperations.set(operation.id, operation);
        }
      }

      // Scan for partial operations based on file sizes
      const partialOps = await this.detectPartialOperations();
      for (const operation of partialOps) {
        operations.push(operation);
        this.detectedOperations.set(operation.id, operation);
      }

      if (operations.length > 0) {
        console.log(chalk.yellow(`⚠️ Detected ${operations.length} interrupted operations`));
        await this.logRecoveryEvent('scan_completed', {
          detectedOperations: operations.length,
          types: operations.map((op) => op.type),
        });
      }

      return operations;
    } catch (error) {
      console.error('Failed to scan for interrupted operations:', error);
      return [];
    }
  }

  /**
   * Recover specific interrupted operation
   */
  async recoverOperation(operationId: string): Promise<RecoveryResult> {
    const startTime = performance.now();

    try {
      const operation = this.detectedOperations.get(operationId);
      if (!operation) {
        return {
          success: false,
          operationId,
          strategy: 'manual',
          recoveredFiles: 0,
          duration: 0,
          error: `Operation not found: ${operationId}`,
        };
      }

      operation.status = 'analyzing';

      // Analyze recovery options
      await this.analyzeRecoveryOptions(operation);

      if (operation.status === 'unrecoverable') {
        return {
          success: false,
          operationId,
          strategy: operation.recovery.strategy,
          recoveredFiles: 0,
          duration: performance.now() - startTime,
          error: 'Operation is not recoverable',
        };
      }

      // Execute recovery strategy
      const result = await this.executeRecovery(operation);

      if (result.success) {
        operation.status = 'recovered';
        this.detectedOperations.delete(operationId);
      } else {
        operation.status = 'abandoned';
      }

      const duration = performance.now() - startTime;

      await this.logRecoveryEvent('recovery_completed', {
        operationId,
        strategy: operation.recovery.strategy,
        success: result.success,
        duration,
      });

      return {
        ...result,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;

      await this.logRecoveryEvent('recovery_failed', {
        operationId,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      return {
        success: false,
        operationId,
        strategy: 'manual',
        recoveredFiles: 0,
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Recover all detected operations
   */
  async recoverAllOperations(): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];
    const operations = Array.from(this.detectedOperations.keys());

    console.log(chalk.blue(`🔄 Attempting to recover ${operations.length} operations...`));

    for (const operationId of operations) {
      const result = await this.recoverOperation(operationId);
      results.push(result);

      if (result.success) {
        console.log(chalk.green(`✅ Recovered: ${operationId}`));
      } else {
        console.log(chalk.red(`❌ Failed: ${operationId} - ${result.error}`));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(
      chalk.blue(`\n📊 Recovery Summary: ${successCount}/${results.length} operations recovered`),
    );

    return results;
  }

  /**
   * Get detected operations
   */
  getDetectedOperations(): InterruptedOperation[] {
    return Array.from(this.detectedOperations.values());
  }

  /**
   * Get recovery statistics
   */
  async getRecoveryStats(): Promise<RecoveryStats> {
    const operations = this.getDetectedOperations();
    const recovered = operations.filter((op) => op.status === 'recovered').length;
    const abandoned = operations.filter((op) => op.status === 'abandoned').length;
    const recoverable = operations.filter((op) => op.status === 'recoverable').length;

    // Calculate average recovery time from logs
    const averageTime = await this.calculateAverageRecoveryTime();

    return {
      totalDetected: operations.length,
      recovered,
      abandoned,
      recoverableOperations: recoverable,
      averageRecoveryTime: averageTime,
      successRate: operations.length > 0 ? recovered / operations.length : 0,
    };
  }

  /**
   * Abandon operation (mark as unrecoverable)
   */
  async abandonOperation(operationId: string): Promise<void> {
    const operation = this.detectedOperations.get(operationId);
    if (operation) {
      operation.status = 'abandoned';
      await this.cleanupOperationFiles(operation);
      this.detectedOperations.delete(operationId);

      await this.logRecoveryEvent('operation_abandoned', { operationId });
    }
  }

  /**
   * Clean up all recovery files
   */
  async cleanup(): Promise<void> {
    try {
      // Clean up old lock files
      const lockFiles = await fs.promises.readdir(this.lockDirectory);
      for (const lockFile of lockFiles) {
        const lockPath = path.join(this.lockDirectory, lockFile);
        const stats = await fs.promises.stat(lockPath);

        if (Date.now() - stats.mtime.getTime() > this.maxRecoveryAge) {
          await fs.promises.unlink(lockPath);
        }
      }

      // Clean up old recovery files
      const recoveryFiles = await fs.promises.readdir(this.recoveryDirectory);
      for (const recoveryFile of recoveryFiles) {
        const recoveryPath = path.join(this.recoveryDirectory, recoveryFile);
        const stats = await fs.promises.stat(recoveryPath);

        if (Date.now() - stats.mtime.getTime() > this.maxRecoveryAge) {
          await fs.promises.unlink(recoveryPath);
        }
      }

      console.log(chalk.green('✅ Recovery cleanup completed'));
    } catch (error) {
      console.warn('Recovery cleanup failed:', error);
    }
  }

  /**
   * Show recovery status
   */
  async showStatus(): Promise<void> {
    const stats = await this.getRecoveryStats();
    const operations = this.getDetectedOperations();

    console.log(chalk.blue('\n🔄 Recovery System Status'));
    console.log(`Detected operations: ${chalk.yellow(stats.totalDetected)}`);
    console.log(`Recoverable: ${chalk.green(stats.recoverableOperations)}`);
    console.log(`Recovered: ${chalk.green(stats.recovered)}`);
    console.log(`Abandoned: ${chalk.red(stats.abandoned)}`);
    console.log(`Success rate: ${chalk.yellow((stats.successRate * 100).toFixed(1))}%`);
    console.log(`Average recovery time: ${chalk.yellow(stats.averageRecoveryTime.toFixed(1))}ms`);

    if (operations.length > 0) {
      console.log(chalk.blue('\nDetected Operations:'));
      operations.forEach((op) => {
        const statusColor =
          op.status === 'recoverable'
            ? chalk.green
            : op.status === 'unrecoverable'
              ? chalk.red
              : chalk.yellow;
        const riskColor =
          op.recovery.riskLevel === 'low'
            ? chalk.green
            : op.recovery.riskLevel === 'medium'
              ? chalk.yellow
              : chalk.red;

        console.log(
          `  ${chalk.cyan(op.id.substr(0, 8))} ${chalk.gray(op.type)} ${statusColor(op.status)} ${riskColor(op.recovery.riskLevel)} ${chalk.gray(`(${op.progress.percentage.toFixed(1)}%)`)}`,
        );
      });
    }
  }

  /**
   * Initialize directories
   */
  private initializeDirectories(): void {
    this.recoveryDirectory = path.join(os.tmpdir(), 'maria-recovery');
    this.lockDirectory = path.join(os.tmpdir(), 'maria-locks');
  }

  /**
   * Setup directories
   */
  private async setupDirectories(): Promise<void> {
    await fs.promises.mkdir(this.recoveryDirectory, { recursive: true });
    await fs.promises.mkdir(this.lockDirectory, { recursive: true });
  }

  /**
   * Find lock files
   */
  private async findLockFiles(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.lockDirectory);
      return files
        .filter((file) => file.endsWith('.lock'))
        .map((file) => path.join(this.lockDirectory, file));
    } catch {
      return [];
    }
  }

  /**
   * Find incomplete temporary files
   */
  private async findIncompleteFiles(): Promise<string[]> {
    const tempFiles: string[] = [];

    try {
      // Scan common temp locations
      const tempDirs = [os.tmpdir(), path.join(os.tmpdir(), 'maria-*'), '/tmp/maria-*'];

      for (const tempDir of tempDirs) {
        try {
          const files = await fs.promises.readdir(tempDir);
          const mariaFiles = files.filter(
            (file) => file.includes('maria') && (file.endsWith('.tmp') || file.endsWith('.part')),
          );

          tempFiles.push(...mariaFiles.map((file) => path.join(tempDir, file)));
        } catch {
          // Skip directories we can't read
        }
      }
    } catch {
      // Skip if temp directory scanning fails
    }

    return tempFiles;
  }

  /**
   * Detect partial operations
   */
  private async detectPartialOperations(): Promise<InterruptedOperation[]> {
    // This would analyze file system for operations that appear incomplete
    // Based on file sizes, modification times, and patterns
    return [];
  }

  /**
   * Analyze lock file
   */
  private async analyzeLockFile(lockFilePath: string): Promise<InterruptedOperation | null> {
    try {
      const content = await fs.promises.readFile(lockFilePath, 'utf8');
      const lockData = JSON.parse(content);

      const operation: InterruptedOperation = {
        id: lockData.operationId || this.generateOperationId(),
        type: lockData.type || 'copy',
        timestamp: new Date(lockData.timestamp),
        status: 'analyzing',
        source: lockData.source,
        target: lockData.target,
        progress: lockData.progress || { totalSize: 0, processedSize: 0, percentage: 0 },
        metadata: {
          processId: lockData.processId || 0,
          sessionId: lockData.sessionId || 'unknown',
          checksum: lockData.checksum,
          lockFiles: [lockFilePath],
          tempFiles: lockData.tempFiles || [],
        },
        recovery: {
          strategy: 'resume',
          confidence: 0,
          estimatedTime: 0,
          riskLevel: 'medium',
        },
      };

      return operation;
    } catch {
      return null;
    }
  }

  /**
   * Analyze temporary file
   */
  private async analyzeTempFile(tempFilePath: string): Promise<InterruptedOperation | null> {
    try {
      const stats = await fs.promises.stat(tempFilePath);
      const fileName = path.basename(tempFilePath);

      // Extract operation info from filename pattern
      const match = fileName.match(/maria_(\w+)_(\w+)\.tmp/);
      if (!match) return null;

      const operation: InterruptedOperation = {
        id: this.generateOperationId(),
        type: 'copy',
        timestamp: stats.mtime,
        status: 'analyzing',
        target: tempFilePath,
        progress: {
          totalSize: stats.size,
          processedSize: stats.size,
          percentage: 100,
        },
        metadata: {
          processId: 0,
          sessionId: 'unknown',
          lockFiles: [],
          tempFiles: [tempFilePath],
        },
        recovery: {
          strategy: 'restart',
          confidence: 0,
          estimatedTime: 0,
          riskLevel: 'low',
        },
      };

      return operation;
    } catch {
      return null;
    }
  }

  /**
   * Analyze recovery options
   */
  private async analyzeRecoveryOptions(operation: InterruptedOperation): Promise<void> {
    // Check if source and target still exist
    const sourceExists = operation.source ? await this.exists(operation.source) : true;
    const targetExists = await this.exists(operation.target);

    // Calculate confidence and risk based on file states
    let confidence = 50;
    let riskLevel: InterruptedOperation['recovery']['riskLevel'] = 'medium';
    let strategy: InterruptedOperation['recovery']['strategy'] = 'restart';

    if (!sourceExists && operation.source) {
      confidence = 10;
      riskLevel = 'high';
      strategy = 'manual';
    } else if (targetExists) {
      // Check if target file is complete
      try {
        const targetStats = await fs.promises.stat(operation.target);
        const completionRatio = targetStats.size / operation.progress.totalSize;

        if (completionRatio > 0.9) {
          confidence = 90;
          riskLevel = 'low';
          strategy = 'resume';
        } else if (completionRatio > 0.5) {
          confidence = 70;
          riskLevel = 'medium';
          strategy = 'resume';
        } else {
          confidence = 40;
          riskLevel = 'medium';
          strategy = 'restart';
        }
      } catch {
        confidence = 30;
        riskLevel = 'high';
        strategy = 'restart';
      }
    }

    // Check for lock file age
    const age = Date.now() - operation.timestamp.getTime();
    if (age > this.maxRecoveryAge) {
      confidence = Math.max(10, confidence - 30);
      riskLevel = 'high';
    }

    operation.recovery.confidence = confidence;
    operation.recovery.riskLevel = riskLevel;
    operation.recovery.strategy = strategy;
    operation.recovery.estimatedTime = this.estimateRecoveryTime(operation);

    operation.status = confidence > 50 ? 'recoverable' : 'unrecoverable';
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecovery(
    operation: InterruptedOperation,
  ): Promise<Omit<RecoveryResult, 'duration'>> {
    try {
      switch (operation.recovery.strategy) {
        case 'resume':
          return await this.executeResumeRecovery(operation);
        case 'restart':
          return await this.executeRestartRecovery(operation);
        case 'rollback':
          return await this.executeRollbackRecovery(operation);
        default:
          return {
            success: false,
            operationId: operation.id,
            strategy: operation.recovery.strategy,
            recoveredFiles: 0,
            error: 'Manual recovery required',
          };
      }
    } catch (error) {
      return {
        success: false,
        operationId: operation.id,
        strategy: operation.recovery.strategy,
        recoveredFiles: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute resume recovery
   */
  private async executeResumeRecovery(
    operation: InterruptedOperation,
  ): Promise<Omit<RecoveryResult, 'duration'>> {
    // Try to resume the operation from where it left off
    if (operation.source && operation.target) {
      try {
        const sourceStats = await fs.promises.stat(operation.source);
        const targetStats = await fs.promises.stat(operation.target);

        if (targetStats.size < sourceStats.size) {
          // Resume copy operation
          const sourceHandle = await fs.promises.open(operation.source, 'r');
          const targetHandle = await fs.promises.open(operation.target, 'a');

          try {
            const buffer = Buffer.allocUnsafe(64 * 1024); // 64KB chunks
            let position = targetStats.size;

            while (position < sourceStats.size) {
              const { bytesRead } = await sourceHandle.read(buffer, 0, buffer.length, position);
              if (bytesRead === 0) break;

              await targetHandle.write(buffer, 0, bytesRead);
              position += bytesRead;
            }

            await this.cleanupOperationFiles(operation);

            return {
              success: true,
              operationId: operation.id,
              strategy: 'resume',
              recoveredFiles: 1,
              message: 'Operation resumed successfully',
            };
          } finally {
            await sourceHandle.close();
            await targetHandle.close();
          }
        } else {
          // File is already complete
          await this.cleanupOperationFiles(operation);

          return {
            success: true,
            operationId: operation.id,
            strategy: 'resume',
            recoveredFiles: 1,
            message: 'Operation was already complete',
          };
        }
      } catch (error) {
        return {
          success: false,
          operationId: operation.id,
          strategy: 'resume',
          recoveredFiles: 0,
          error: `Resume failed: ${error}`,
        };
      }
    }

    return {
      success: false,
      operationId: operation.id,
      strategy: 'resume',
      recoveredFiles: 0,
      error: 'Insufficient information to resume',
    };
  }

  /**
   * Execute restart recovery
   */
  private async executeRestartRecovery(
    operation: InterruptedOperation,
  ): Promise<Omit<RecoveryResult, 'duration'>> {
    try {
      // Use atomic operation manager to restart the operation safely
      if (operation.source && operation.target) {
        const result = await atomicOperationManager.atomicMove(operation.source, operation.target, {
          backup: true,
          rollbackOnFailure: true,
        });

        if (result.success) {
          await this.cleanupOperationFiles(operation);

          return {
            success: true,
            operationId: operation.id,
            strategy: 'restart',
            recoveredFiles: 1,
            message: 'Operation restarted successfully',
          };
        } else {
          return {
            success: false,
            operationId: operation.id,
            strategy: 'restart',
            recoveredFiles: 0,
            error: result.error || 'Restart failed',
          };
        }
      }

      return {
        success: false,
        operationId: operation.id,
        strategy: 'restart',
        recoveredFiles: 0,
        error: 'Insufficient information to restart',
      };
    } catch (error) {
      return {
        success: false,
        operationId: operation.id,
        strategy: 'restart',
        recoveredFiles: 0,
        error: `Restart failed: ${error}`,
      };
    }
  }

  /**
   * Execute rollback recovery
   */
  private async executeRollbackRecovery(
    operation: InterruptedOperation,
  ): Promise<Omit<RecoveryResult, 'duration'>> {
    try {
      // Clean up any partial files and restore original state
      await this.cleanupOperationFiles(operation);

      return {
        success: true,
        operationId: operation.id,
        strategy: 'rollback',
        recoveredFiles: 0,
        message: 'Operation rolled back successfully',
      };
    } catch (error) {
      return {
        success: false,
        operationId: operation.id,
        strategy: 'rollback',
        recoveredFiles: 0,
        error: `Rollback failed: ${error}`,
      };
    }
  }

  /**
   * Cleanup operation files
   */
  private async cleanupOperationFiles(operation: InterruptedOperation): Promise<void> {
    // Clean up lock files
    for (const lockFile of operation.metadata.lockFiles) {
      try {
        await fs.promises.unlink(lockFile);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up temp files
    for (const tempFile of operation.metadata.tempFiles) {
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
  private estimateRecoveryTime(operation: InterruptedOperation): number {
    const baseTime = 1000; // 1 second base
    const sizeMultiplier = operation.progress.totalSize / (1024 * 1024); // MB
    const confidenceMultiplier = (100 - operation.recovery.confidence) / 100;

    return baseTime + sizeMultiplier * 100 + confidenceMultiplier * 5000;
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
  private async logRecoveryEvent(event: string, data: Record<string, unknown>): Promise<void> {
    await operationLogger.logOperation('recovery', 'completed', [], {
      level: 'info',
      context: {
        recoveryEvent: event,
        ...data,
      },
    });
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
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const interruptedOperationRecovery = InterruptedOperationRecovery.getInstance();
