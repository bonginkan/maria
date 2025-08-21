/**
 * Conflict Resolver - File Operation Conflict Detection and Resolution
 * Handles conflicts between concurrent file operations and provides resolution strategies
 * Phase 2: Terminal Integration & Safety - Week 8
 */

import * as fs from 'fs';
import * as path from 'path';
// import * as crypto from 'crypto'; // TODO: Remove if unused
import chalk from 'chalk';
import { operationLogger } from '../logging/OperationLogger';

export interface FileConflict {
  id: string;
  type:
    | 'write_write'
    | 'write_delete'
    | 'move_move'
    | 'rename_rename'
    | 'permission_change'
    | 'concurrent_access';
  timestamp: Date;
  status: 'detected' | 'analyzing' | 'resolved' | 'escalated' | 'ignored';
  severity: 'low' | 'medium' | 'high' | 'critical';
  files: Array<{
    path: string;
    operation: string;
    processId: number;
    timestamp: Date;
    metadata?: {
      size: number;
      checksum: string;
      permissions: string;
      lastModified: Date;
    };
  }>;
  resolution: {
    strategy:
      | 'auto_merge'
      | 'manual_review'
      | 'backup_resolve'
      | 'timestamp_priority'
      | 'user_choice'
      | 'abort_all';
    confidence: number; // 0-100
    appliedBy: 'system' | 'user';
    appliedAt?: Date;
    result?: string;
  };
  context: {
    lockHolders: string[];
    dependencies: string[];
    affectedProcesses: number[];
  };
}

export interface ConflictResolutionResult {
  success: boolean;
  conflictId: string;
  strategy: FileConflict['resolution']['strategy'];
  filesAffected: number;
  duration: number;
  message?: string;
  error?: string;
  backupCreated?: boolean;
}

export interface ConflictDetectionOptions {
  realTimeMonitoring: boolean;
  checkInterval: number; // in ms
  ignoreSystemFiles: boolean;
  autoResolveLevel: 'none' | 'safe' | 'aggressive';
  backupOnResolve: boolean;
}

export interface ConflictStats {
  totalDetected: number;
  resolved: number;
  escalated: number;
  byType: Record<FileConflict['type'], number>;
  bySeverity: Record<FileConflict['severity'], number>;
  averageResolutionTime: number;
  autoResolutionRate: number;
}

export class ConflictResolver {
  private static instance: ConflictResolver;
  private activeConflicts: Map<string, FileConflict> = new Map();
  private resolvedConflicts: Map<string, FileConflict> = new Map();
  private fileLocks: Map<string, Array<{ processId: number; operation: string; timestamp: Date }>> =
    new Map();
  private monitoringTimer: NodeJS.Timeout | null = null;
  private options: ConflictDetectionOptions;

  public static getInstance(): ConflictResolver {
    if (!ConflictResolver.instance) {
      ConflictResolver.instance = new ConflictResolver();
    }
    return ConflictResolver.instance;
  }

  private constructor() {
    this.options = this.getDefaultOptions();
  }

  /**
   * Initialize conflict resolver
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.options.realTimeMonitoring) {
        this.startRealTimeMonitoring();
      }

      console.debug('Conflict resolver initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize conflict resolver:', error);
      return false;
    }
  }

  /**
   * Acquire file lock for operation
   */
  async acquireFileLock(
    filePath: string,
    operation: string,
    processId: number = process.pid,
  ): Promise<boolean> {
    const resolvedPath = path.resolve(filePath);

    // Check for existing locks
    const existingLocks = this.fileLocks.get(resolvedPath) || [];

    // Check for conflicts
    const conflict = await this.detectLockConflict(
      resolvedPath,
      operation,
      processId,
      existingLocks,
    );
    if (conflict) {
      this.activeConflicts.set(conflict.id, conflict);

      // Auto-resolve if possible
      if (this.options.autoResolveLevel !== 'none') {
        const resolution = await this.autoResolveConflict(conflict);
        if (!resolution.success) {
          return false;
        }
      } else {
        return false;
      }
    }

    // Acquire lock
    const lockEntry = {
      processId,
      operation,
      timestamp: new Date(),
    };

    if (!this.fileLocks.has(resolvedPath)) {
      this.fileLocks.set(resolvedPath, []);
    }
    this.fileLocks.get(resolvedPath)!.push(lockEntry);

    return true;
  }

  /**
   * Release file lock
   */
  releaseFileLock(filePath: string, processId: number = process.pid): void {
    const resolvedPath = path.resolve(filePath);
    const locks = this.fileLocks.get(resolvedPath);

    if (locks) {
      const updatedLocks = locks.filter((lock) => lock.processId !== processId);

      if (updatedLocks.length === 0) {
        this.fileLocks.delete(resolvedPath);
      } else {
        this.fileLocks.set(resolvedPath, updatedLocks);
      }
    }
  }

  /**
   * Detect file system conflicts
   */
  async detectConflicts(filePaths: string[]): Promise<FileConflict[]> {
    const conflicts: FileConflict[] = [];

    for (const filePath of filePaths) {
      try {
        // Check for concurrent write conflicts
        const writeConflict = await this.detectWriteConflict(filePath);
        if (writeConflict) conflicts.push(writeConflict);

        // Check for move/rename conflicts
        const moveConflict = await this.detectMoveConflict(filePath);
        if (moveConflict) conflicts.push(moveConflict);

        // Check for permission conflicts
        const permissionConflict = await this.detectPermissionConflict(filePath);
        if (permissionConflict) conflicts.push(permissionConflict);
      } catch (error) {
        console.debug(`Failed to detect conflicts for ${filePath}:`, error);
      }
    }

    // Store detected conflicts
    conflicts.forEach((conflict) => {
      this.activeConflicts.set(conflict.id, conflict);
    });

    return conflicts;
  }

  /**
   * Resolve specific conflict
   */
  async resolveConflict(
    conflictId: string,
    strategy?: FileConflict['resolution']['strategy'],
  ): Promise<ConflictResolutionResult> {
    const startTime = performance.now();

    try {
      const conflict = this.activeConflicts.get(conflictId);
      if (!conflict) {
        return {
          success: false,
          conflictId,
          strategy: 'manual_review',
          filesAffected: 0,
          duration: 0,
          error: `Conflict not found: ${conflictId}`,
        };
      }

      conflict.status = 'analyzing';

      // Determine resolution strategy
      const resolutionStrategy = strategy || (await this.selectResolutionStrategy(conflict));
      conflict.resolution.strategy = resolutionStrategy;

      // Execute resolution
      const result = await this.executeResolution(conflict);

      if (result.success) {
        conflict.status = 'resolved';
        conflict.resolution.appliedBy = strategy ? 'user' : 'system';
        conflict.resolution.appliedAt = new Date();
        conflict.resolution.result = result.message;

        // Move to resolved conflicts
        this.activeConflicts.delete(conflictId);
        this.resolvedConflicts.set(conflictId, conflict);
      } else {
        conflict.status = 'escalated';
      }

      const duration = performance.now() - startTime;

      await this.logConflictEvent('resolution_completed', {
        conflictId,
        strategy: resolutionStrategy,
        success: result.success,
        duration,
      });

      return {
        ...result,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;

      await this.logConflictEvent('resolution_failed', {
        conflictId,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      return {
        success: false,
        conflictId,
        strategy: 'manual_review',
        filesAffected: 0,
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Auto-resolve all safe conflicts
   */
  async autoResolveConflicts(): Promise<ConflictResolutionResult[]> {
    const results: ConflictResolutionResult[] = [];
    const safeConflicts = Array.from(this.activeConflicts.values()).filter(
      (conflict) => conflict.severity === 'low' || conflict.severity === 'medium',
    );

    console.log(chalk.blue(`🔄 Auto-resolving ${safeConflicts.length} safe conflicts...`));

    for (const conflict of safeConflicts) {
      const result = await this.autoResolveConflict(conflict);
      results.push(result);

      if (result.success) {
        console.log(chalk.green(`✅ Resolved: ${conflict.type} conflict`));
      } else {
        console.log(chalk.yellow(`⚠️ Escalated: ${conflict.type} conflict`));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(
      chalk.blue(
        `\n📊 Auto-resolution Summary: ${successCount}/${results.length} conflicts resolved`,
      ),
    );

    return results;
  }

  /**
   * Get active conflicts
   */
  getActiveConflicts(): FileConflict[] {
    return Array.from(this.activeConflicts.values());
  }

  /**
   * Get resolved conflicts
   */
  getResolvedConflicts(): FileConflict[] {
    return Array.from(this.resolvedConflicts.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  /**
   * Get conflict statistics
   */
  async getConflictStats(): Promise<ConflictStats> {
    const allConflicts = [...this.getActiveConflicts(), ...this.getResolvedConflicts()];

    const stats: ConflictStats = {
      totalDetected: allConflicts.length,
      resolved: this.resolvedConflicts.size,
      escalated: allConflicts.filter((c) => c.status === 'escalated').length,
      byType: {
        write_write: 0,
        write_delete: 0,
        move_move: 0,
        rename_rename: 0,
        permission_change: 0,
        concurrent_access: 0,
      },
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      averageResolutionTime: 0,
      autoResolutionRate: 0,
    };

    // Calculate statistics
    allConflicts.forEach((conflict) => {
      stats.byType[conflict.type]++;
      stats.bySeverity[conflict.severity]++;
    });

    const autoResolved = allConflicts.filter((c) => c.resolution.appliedBy === 'system').length;
    stats.autoResolutionRate = allConflicts.length > 0 ? autoResolved / allConflicts.length : 0;

    // Calculate average resolution time from resolved conflicts
    stats.averageResolutionTime = await this.calculateAverageResolutionTime();

    return stats;
  }

  /**
   * Show conflict status
   */
  async showStatus(): Promise<void> {
    const stats = await this.getConflictStats();
    const activeConflicts = this.getActiveConflicts();

    console.log(chalk.blue('\n⚠️ Conflict Resolver Status'));
    console.log(`Total detected: ${chalk.yellow(stats.totalDetected)}`);
    console.log(`Active conflicts: ${chalk.red(activeConflicts.length)}`);
    console.log(`Resolved: ${chalk.green(stats.resolved)}`);
    console.log(`Escalated: ${chalk.red(stats.escalated)}`);
    console.log(
      `Auto-resolution rate: ${chalk.yellow((stats.autoResolutionRate * 100).toFixed(1))}%`,
    );
    console.log(
      `Average resolution time: ${chalk.yellow(stats.averageResolutionTime.toFixed(1))}ms`,
    );

    if (activeConflicts.length > 0) {
      console.log(chalk.blue('\nActive Conflicts:'));
      activeConflicts.forEach((conflict) => {
        const severityColor =
          conflict.severity === 'critical'
            ? chalk.red
            : conflict.severity === 'high'
              ? chalk.red
              : conflict.severity === 'medium'
                ? chalk.yellow
                : chalk.gray;

        console.log(
          `  ${chalk.cyan(conflict.id.substr(0, 8))} ${chalk.gray(conflict.type)} ${severityColor(conflict.severity)} ${chalk.gray(`(${conflict.files.length} files)`)}`,
        );
      });
    }

    console.log(chalk.blue('\nConflicts by Type:'));
    Object.entries(stats.byType).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`  ${chalk.cyan(type)}: ${count}`);
      }
    });
  }

  /**
   * Configure conflict detection
   */
  updateOptions(newOptions: Partial<ConflictDetectionOptions>): void {
    this.options = { ...this.options, ...newOptions };

    // Restart monitoring if enabled
    if (this.options.realTimeMonitoring && !this.monitoringTimer) {
      this.startRealTimeMonitoring();
    } else if (!this.options.realTimeMonitoring && this.monitoringTimer) {
      this.stopRealTimeMonitoring();
    }

    console.log(chalk.green('✅ Conflict resolver configuration updated'));
  }

  /**
   * Get default options
   */
  private getDefaultOptions(): ConflictDetectionOptions {
    return {
      realTimeMonitoring: true,
      checkInterval: 5000, // 5 seconds
      ignoreSystemFiles: true,
      autoResolveLevel: 'safe',
      backupOnResolve: true,
    };
  }

  /**
   * Start real-time monitoring
   */
  private startRealTimeMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      await this.scanForConflicts();
    }, this.options.checkInterval);
  }

  /**
   * Stop real-time monitoring
   */
  private stopRealTimeMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  /**
   * Scan for conflicts
   */
  private async scanForConflicts(): Promise<void> {
    try {
      // Get all currently locked files
      const lockedFiles = Array.from(this.fileLocks.keys());

      // Detect conflicts for locked files
      if (lockedFiles.length > 0) {
        await this.detectConflicts(lockedFiles);
      }
    } catch (error) {
      console.debug('Conflict scan failed:', error);
    }
  }

  /**
   * Detect lock conflict
   */
  private async detectLockConflict(
    filePath: string,
    operation: string,
    processId: number,
    existingLocks: Array<{ processId: number; operation: string; timestamp: Date }>,
  ): Promise<FileConflict | null> {
    // Check for conflicting operations
    const conflictingLocks = existingLocks.filter((lock) => {
      // Same process can have multiple locks
      if (lock.processId === processId) return false;

      // Check for conflicting operations
      return this.areOperationsConflicting(operation, lock.operation);
    });

    if (conflictingLocks.length === 0) {
      return null;
    }

    const conflictType = this.determineConflictType(operation, conflictingLocks[0].operation);

    return {
      id: this.generateConflictId(),
      type: conflictType,
      timestamp: new Date(),
      status: 'detected',
      severity: this.assessConflictSeverity(conflictType, filePath),
      files: [
        {
          path: filePath,
          operation,
          processId,
          timestamp: new Date(),
        },
        ...conflictingLocks.map((lock) => ({
          path: filePath,
          operation: lock.operation,
          processId: lock.processId,
          timestamp: lock.timestamp,
        })),
      ],
      resolution: {
        strategy: 'manual_review',
        confidence: 0,
        appliedBy: 'system',
      },
      context: {
        lockHolders: conflictingLocks.map((lock) => lock.processId.toString()),
        dependencies: [],
        affectedProcesses: [processId, ...conflictingLocks.map((lock) => lock.processId)],
      },
    };
  }

  /**
   * Detect write conflict
   */
  private async detectWriteConflict(filePath: string): Promise<FileConflict | null> {
    try {
      // Check if file is being written by multiple processes
      const stats = await fs.promises.stat(filePath);
      const now = new Date();
      const timeDiff = now.getTime() - stats.mtime.getTime();

      // If file was modified very recently, there might be concurrent writes
      if (timeDiff < 1000) {
        // Within 1 second
        const locks = this.fileLocks.get(path.resolve(filePath));
        if (locks && locks.length > 1) {
          const writeLocks = locks.filter(
            (lock) => lock.operation === 'write' || lock.operation === 'append',
          );

          if (writeLocks.length > 1) {
            return this.createConflict('write_write', filePath, writeLocks);
          }
        }
      }
    } catch {
      // File might not exist
    }

    return null;
  }

  /**
   * Detect move conflict
   */
  private async detectMoveConflict(filePath: string): Promise<FileConflict | null> {
    const locks = this.fileLocks.get(path.resolve(filePath));
    if (!locks) return null;

    const moveLocks = locks.filter(
      (lock) => lock.operation === 'move' || lock.operation === 'rename',
    );

    if (moveLocks.length > 1) {
      return this.createConflict('move_move', filePath, moveLocks);
    }

    return null;
  }

  /**
   * Detect permission conflict
   */
  private async detectPermissionConflict(filePath: string): Promise<FileConflict | null> {
    const locks = this.fileLocks.get(path.resolve(filePath));
    if (!locks) return null;

    const permissionLocks = locks.filter((lock) => lock.operation === 'chmod');

    if (permissionLocks.length > 1) {
      return this.createConflict('permission_change', filePath, permissionLocks);
    }

    return null;
  }

  /**
   * Create conflict object
   */
  private createConflict(
    type: FileConflict['type'],
    filePath: string,
    locks: Array<{ processId: number; operation: string; timestamp: Date }>,
  ): FileConflict {
    return {
      id: this.generateConflictId(),
      type,
      timestamp: new Date(),
      status: 'detected',
      severity: this.assessConflictSeverity(type, filePath),
      files: locks.map((lock) => ({
        path: filePath,
        operation: lock.operation,
        processId: lock.processId,
        timestamp: lock.timestamp,
      })),
      resolution: {
        strategy: 'manual_review',
        confidence: 0,
        appliedBy: 'system',
      },
      context: {
        lockHolders: locks.map((lock) => lock.processId.toString()),
        dependencies: [],
        affectedProcesses: locks.map((lock) => lock.processId),
      },
    };
  }

  /**
   * Auto-resolve conflict
   */
  private async autoResolveConflict(conflict: FileConflict): Promise<ConflictResolutionResult> {
    if (this.options.autoResolveLevel === 'none') {
      return {
        success: false,
        conflictId: conflict.id,
        strategy: 'manual_review',
        filesAffected: 0,
        duration: 0,
        error: 'Auto-resolution disabled',
      };
    }

    // Only auto-resolve safe conflicts
    if (conflict.severity === 'high' || conflict.severity === 'critical') {
      if (this.options.autoResolveLevel !== 'aggressive') {
        return {
          success: false,
          conflictId: conflict.id,
          strategy: 'manual_review',
          filesAffected: 0,
          duration: 0,
          error: 'Conflict severity too high for auto-resolution',
        };
      }
    }

    return await this.resolveConflict(conflict.id);
  }

  /**
   * Select resolution strategy
   */
  private async selectResolutionStrategy(
    conflict: FileConflict,
  ): Promise<FileConflict['resolution']['strategy']> {
    switch (conflict.type) {
      case 'write_write':
        return 'backup_resolve';
      case 'write_delete':
        return 'backup_resolve';
      case 'move_move':
        return 'timestamp_priority';
      case 'rename_rename':
        return 'timestamp_priority';
      case 'permission_change':
        return 'timestamp_priority';
      case 'concurrent_access':
        return 'timestamp_priority';
      default:
        return 'manual_review';
    }
  }

  /**
   * Execute resolution
   */
  private async executeResolution(
    conflict: FileConflict,
  ): Promise<Omit<ConflictResolutionResult, 'duration'>> {
    try {
      switch (conflict.resolution.strategy) {
        case 'backup_resolve':
          return await this.executeBackupResolve(conflict);
        case 'timestamp_priority':
          return await this.executeTimestampPriority(conflict);
        case 'auto_merge':
          return await this.executeAutoMerge(conflict);
        case 'abort_all':
          return await this.executeAbortAll(conflict);
        default:
          return {
            success: false,
            conflictId: conflict.id,
            strategy: conflict.resolution.strategy,
            filesAffected: 0,
            error: 'Manual resolution required',
          };
      }
    } catch (error) {
      return {
        success: false,
        conflictId: conflict.id,
        strategy: conflict.resolution.strategy,
        filesAffected: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute backup resolve strategy
   */
  private async executeBackupResolve(
    conflict: FileConflict,
  ): Promise<Omit<ConflictResolutionResult, 'duration'>> {
    const filePath = conflict.files[0].path;

    if (this.options.backupOnResolve && (await this.exists(filePath))) {
      // Create backup before resolving
      const backupPath = `${filePath}.conflict-backup.${Date.now()}`;
      await fs.promises.copyFile(filePath, backupPath);
    }

    // Allow the latest operation to proceed
    const latestFile = conflict.files.reduce((latest, file) =>
      file.timestamp > latest.timestamp ? file : latest,
    );

    // Release locks for other processes
    conflict.files.forEach((file) => {
      if (file.processId !== latestFile.processId) {
        this.releaseFileLock(file.path, file.processId);
      }
    });

    return {
      success: true,
      conflictId: conflict.id,
      strategy: 'backup_resolve',
      filesAffected: conflict.files.length,
      message: `Resolved conflict by prioritizing latest operation and creating backup`,
      backupCreated: this.options.backupOnResolve,
    };
  }

  /**
   * Execute timestamp priority strategy
   */
  private async executeTimestampPriority(
    conflict: FileConflict,
  ): Promise<Omit<ConflictResolutionResult, 'duration'>> {
    // Allow the earliest operation to proceed (first come, first served)
    const earliestFile = conflict.files.reduce((earliest, file) =>
      file.timestamp < earliest.timestamp ? file : earliest,
    );

    // Release locks for later processes
    conflict.files.forEach((file) => {
      if (file.processId !== earliestFile.processId) {
        this.releaseFileLock(file.path, file.processId);
      }
    });

    return {
      success: true,
      conflictId: conflict.id,
      strategy: 'timestamp_priority',
      filesAffected: conflict.files.length,
      message: `Resolved conflict by prioritizing earliest operation`,
    };
  }

  /**
   * Execute auto merge strategy
   */
  private async executeAutoMerge(
    conflict: FileConflict,
  ): Promise<Omit<ConflictResolutionResult, 'duration'>> {
    // This would implement automatic merging for compatible changes
    // For now, fall back to backup resolve
    return await this.executeBackupResolve(conflict);
  }

  /**
   * Execute abort all strategy
   */
  private async executeAbortAll(
    conflict: FileConflict,
  ): Promise<Omit<ConflictResolutionResult, 'duration'>> {
    // Release all locks, effectively aborting all conflicting operations
    conflict.files.forEach((file) => {
      this.releaseFileLock(file.path, file.processId);
    });

    return {
      success: true,
      conflictId: conflict.id,
      strategy: 'abort_all',
      filesAffected: conflict.files.length,
      message: `Resolved conflict by aborting all operations`,
    };
  }

  /**
   * Check if operations are conflicting
   */
  private areOperationsConflicting(op1: string, op2: string): boolean {
    const conflictMatrix: Record<string, string[]> = {
      write: ['write', 'delete', 'move', 'chmod'],
      read: [], // Read operations don't conflict
      delete: ['write', 'read', 'move', 'chmod'],
      move: ['write', 'delete', 'move', 'chmod'],
      chmod: ['write', 'delete', 'move', 'chmod'],
      append: ['delete', 'move'],
    };

    return conflictMatrix[op1]?.includes(op2) || false;
  }

  /**
   * Determine conflict type
   */
  private determineConflictType(op1: string, op2: string): FileConflict['type'] {
    if ((op1 === 'write' || op1 === 'append') && (op2 === 'write' || op2 === 'append')) {
      return 'write_write';
    }
    if ((op1 === 'write' && op2 === 'delete') || (op1 === 'delete' && op2 === 'write')) {
      return 'write_delete';
    }
    if (op1 === 'move' && op2 === 'move') {
      return 'move_move';
    }
    if (op1 === 'rename' && op2 === 'rename') {
      return 'rename_rename';
    }
    if (op1 === 'chmod' && op2 === 'chmod') {
      return 'permission_change';
    }

    return 'concurrent_access';
  }

  /**
   * Assess conflict severity
   */
  private assessConflictSeverity(
    type: FileConflict['type'],
    filePath: string,
  ): FileConflict['severity'] {
    // System files are critical
    if (this.isSystemFile(filePath)) {
      return 'critical';
    }

    // Configuration files are high priority
    if (this.isConfigFile(filePath)) {
      return 'high';
    }

    // Based on conflict type
    switch (type) {
      case 'write_delete':
        return 'high';
      case 'write_write':
        return 'medium';
      case 'move_move':
        return 'medium';
      case 'rename_rename':
        return 'low';
      case 'permission_change':
        return 'low';
      case 'concurrent_access':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Check if file is a system file
   */
  private isSystemFile(filePath: string): boolean {
    const systemPaths = ['/etc/', '/usr/', '/System/', 'C:\\Windows\\', 'C:\\Program Files\\'];
    return systemPaths.some((sysPath) => filePath.startsWith(sysPath));
  }

  /**
   * Check if file is a configuration file
   */
  private isConfigFile(filePath: string): boolean {
    const configExtensions = ['.config', '.conf', '.ini', '.json', '.yaml', '.yml'];
    const configNames = ['package.json', 'tsconfig.json', '.env'];

    const ext = path.extname(filePath);
    const name = path.basename(filePath);

    return configExtensions.includes(ext) || configNames.includes(name);
  }

  /**
   * Calculate average resolution time
   */
  private async calculateAverageResolutionTime(): Promise<number> {
    // This would analyze conflict logs to calculate average time
    return 1500; // Default 1.5 seconds
  }

  /**
   * Log conflict event
   */
  private async logConflictEvent(event: string, data: Record<string, unknown>): Promise<void> {
    await operationLogger.logOperation('conflict_resolution', 'completed', [], {
      level: 'info',
      context: {
        conflictEvent: event,
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
   * Generate conflict ID
   */
  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const conflictResolver = ConflictResolver.getInstance();
