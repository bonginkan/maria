/**
 * Operation Logger - Comprehensive File System Operation Logging
 * Tracks all file operations with detailed metadata and security audit trail
 * Phase 2: Terminal Integration & Safety - Week 8
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'security';
  operation: string;
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  duration?: number;
  metadata: {
    user: string;
    process: string;
    pid: number;
    platform: string;
    workingDirectory: string;
    terminalType?: string;
    sessionId?: string;
  };
  files: Array<{
    path: string;
    action: 'read' | 'write' | 'delete' | 'create' | 'move' | 'copy' | 'chmod' | 'stat';
    size?: number;
    permissions?: string;
    checksum?: string;
  }>;
  security: {
    elevationRequired: boolean;
    confirmationRequired: boolean;
    backupCreated: boolean;
    trashUsed: boolean;
  };
  performance: {
    startTime: number;
    endTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
}

export interface LogFilter {
  level?: LogEntry['level'][];
  operation?: string[];
  status?: LogEntry['status'][];
  timeRange?: {
    start: Date;
    end: Date;
  };
  user?: string;
  files?: string[];
  securityOnly?: boolean;
}

export interface LogStats {
  totalEntries: number;
  entriesByLevel: Record<LogEntry['level'], number>;
  entriesByStatus: Record<LogEntry['status'], number>;
  commonOperations: Array<{ operation: string; count: number }>;
  securityEvents: number;
  errorRate: number;
  averageDuration: number;
  diskUsage: number;
}

export interface LoggerConfig {
  enabled: boolean;
  logLevel: LogEntry['level'];
  logDirectory: string;
  maxLogSize: number; // in bytes
  maxLogAge: number; // in days
  rotationEnabled: boolean;
  compressionEnabled: boolean;
  securityLogging: boolean;
  performanceLogging: boolean;
  auditTrail: boolean;
}

export class OperationLogger {
  private static instance: OperationLogger;
  private config: LoggerConfig;
  private logFile: string;
  private securityLogFile: string;
  private activeOperations: Map<string, LogEntry> = new Map();
  private logBuffer: LogEntry[] = [];
  private bufferFlushTimer: NodeJS.Timeout | null = null;

  public static getInstance(): OperationLogger {
    if (!OperationLogger.instance) {
      OperationLogger.instance = new OperationLogger();
    }
    return OperationLogger.instance;
  }

  private constructor() {
    this.config = this.getDefaultConfig();
    this.initializeLogging();
  }

  /**
   * Initialize logger
   */
  async initialize(): Promise<boolean> {
    try {
      await this.setupLogDirectory();
      await this.setupLogRotation();
      this.startBufferFlushTimer();

      // Log initialization
      await this.logOperation('logger', 'started', [], {
        context: { config: this.config },
      });

      console.debug('Operation logger initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize operation logger:', error);
      return false;
    }
  }

  /**
   * Start logging an operation
   */
  async startOperation(
    operation: string,
    files: LogEntry['files'],
    options: {
      level?: LogEntry['level'];
      security?: Partial<LogEntry['security']>;
      context?: Record<string, unknown>;
    } = {},
  ): Promise<string> {
    const operationId = this.generateOperationId();
    const startTime = performance.now();

    const logEntry: LogEntry = {
      id: operationId,
      timestamp: new Date(),
      level: options.level || 'info',
      operation,
      status: 'started',
      metadata: await this.gatherMetadata(),
      files,
      security: {
        elevationRequired: false,
        confirmationRequired: false,
        backupCreated: false,
        trashUsed: false,
        ...options.security,
      },
      performance: {
        startTime,
        memoryUsage: process.memoryUsage().heapUsed,
      },
      context: options.context,
    };

    this.activeOperations.set(operationId, logEntry);
    await this.writeLogEntry(logEntry);

    return operationId;
  }

  /**
   * Complete an operation
   */
  async completeOperation(
    operationId: string,
    status: 'completed' | 'failed' | 'cancelled',
    error?: { code: string; message: string; stack?: string },
    context?: Record<string, unknown>,
  ): Promise<void> {
    const logEntry = this.activeOperations.get(operationId);
    if (!logEntry) {
      console.warn(`Operation not found: ${operationId}`);
      return;
    }

    const endTime = performance.now();
    logEntry.status = status;
    logEntry.duration = endTime - logEntry.performance.startTime;
    logEntry.performance.endTime = endTime;
    logEntry.performance.cpuUsage = process.cpuUsage().user;

    if (error) {
      logEntry.error = error;
      logEntry.level = 'error';
    }

    if (context) {
      logEntry.context = { ...logEntry.context, ...context };
    }

    await this.writeLogEntry(logEntry);
    this.activeOperations.delete(operationId);
  }

  /**
   * Log a simple operation (start and complete immediately)
   */
  async logOperation(
    operation: string,
    status: LogEntry['status'],
    files: LogEntry['files'],
    options: {
      level?: LogEntry['level'];
      duration?: number;
      security?: Partial<LogEntry['security']>;
      error?: LogEntry['error'];
      context?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    const logEntry: LogEntry = {
      id: this.generateOperationId(),
      timestamp: new Date(),
      level: options.level || 'info',
      operation,
      status,
      duration: options.duration,
      metadata: await this.gatherMetadata(),
      files,
      security: {
        elevationRequired: false,
        confirmationRequired: false,
        backupCreated: false,
        trashUsed: false,
        ...options.security,
      },
      performance: {
        startTime: performance.now(),
        endTime: performance.now(),
        memoryUsage: process.memoryUsage().heapUsed,
      },
      error: options.error,
      context: options.context,
    };

    await this.writeLogEntry(logEntry);
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    event: string,
    details: {
      severity: 'low' | 'medium' | 'high' | 'critical';
      files?: LogEntry['files'];
      action: string;
      result: 'allowed' | 'denied' | 'elevated';
      context?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.logOperation(event, 'completed', details.files || [], {
      level: 'security',
      context: {
        securityEvent: true,
        severity: details.severity,
        action: details.action,
        result: details.result,
        ...details.context,
      },
    });

    // Also write to security log
    if (this.config.securityLogging) {
      const securityEntry = {
        timestamp: new Date().toISOString(),
        event,
        severity: details.severity,
        action: details.action,
        result: details.result,
        files: details.files?.map((f) => f.path) || [],
        metadata: await this.gatherMetadata(),
        context: details.context,
      };

      await this.writeSecurityLog(securityEntry);
    }
  }

  /**
   * Get filtered log entries
   */
  async getLogEntries(filter: LogFilter = {}, limit: number = 100): Promise<LogEntry[]> {
    try {
      const logContent = await fs.promises.readFile(this.logFile, 'utf8');
      const lines = logContent.split('\n').filter((line) => line.trim());

      let entries: LogEntry[] = [];

      for (const line of lines.slice(-limit * 2)) {
        // Get more than needed for filtering
        try {
          const entry = JSON.parse(line);
          entry.timestamp = new Date(entry.timestamp);
          entries.push(entry);
        } catch {
          // Skip invalid lines
        }
      }

      // Apply filters
      entries = this.applyLogFilter(entries, filter);

      // Sort by timestamp (newest first) and limit
      return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
    } catch (error) {
      console.warn('Failed to read log entries:', error);
      return [];
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<LogStats> {
    const entries = await this.getLogEntries({}, 10000); // Get large sample

    const stats: LogStats = {
      totalEntries: entries.length,
      entriesByLevel: { debug: 0, info: 0, warn: 0, error: 0, security: 0 },
      entriesByStatus: { started: 0, completed: 0, failed: 0, cancelled: 0 },
      commonOperations: [],
      securityEvents: 0,
      errorRate: 0,
      averageDuration: 0,
      diskUsage: 0,
    };

    const operationCounts: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const entry of entries) {
      // Count by level
      stats.entriesByLevel[entry.level]++;

      // Count by status
      stats.entriesByStatus[entry.status]++;

      // Count operations
      operationCounts[entry.operation] = (operationCounts[entry.operation] || 0) + 1;

      // Security events
      if (entry.level === 'security') {
        stats.securityEvents++;
      }

      // Duration
      if (entry.duration) {
        totalDuration += entry.duration;
        durationCount++;
      }
    }

    // Calculate derived stats
    stats.errorRate = entries.length > 0 ? stats.entriesByLevel.error / entries.length : 0;
    stats.averageDuration = durationCount > 0 ? totalDuration / durationCount : 0;

    // Common operations
    stats.commonOperations = Object.entries(operationCounts)
      .map(([operation, count]) => ({ operation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Disk usage
    stats.diskUsage = await this.calculateLogDiskUsage();

    return stats;
  }

  /**
   * Export logs
   */
  async exportLogs(
    outputPath: string,
    filter: LogFilter = {},
    format: 'json' | 'csv' | 'txt' = 'json',
  ): Promise<void> {
    const entries = await this.getLogEntries(filter, 10000);

    let content: string;

    switch (format) {
      case 'csv':
        content = this.formatAsCSV(entries);
        break;
      case 'txt':
        content = this.formatAsText(entries);
        break;
      default:
        content = JSON.stringify(entries, null, 2);
    }

    await fs.promises.writeFile(outputPath, content);
  }

  /**
   * Clear logs
   */
  async clearLogs(olderThanDays?: number): Promise<void> {
    try {
      if (olderThanDays) {
        // Selective clearing based on age
        const entries = await this.getLogEntries({}, 100000);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const filteredEntries = entries.filter((entry) => entry.timestamp >= cutoffDate);

        // Rewrite log file with filtered entries
        const content = filteredEntries.map((entry) => JSON.stringify(entry)).join('\n');
        await fs.promises.writeFile(this.logFile, content);
      } else {
        // Clear all logs
        await fs.promises.writeFile(this.logFile, '');
        if (this.config.securityLogging) {
          await fs.promises.writeFile(this.securityLogFile, '');
        }
      }

      console.log(chalk.green('✅ Logs cleared'));
    } catch (error) {
      console.error('Failed to clear logs:', error);
      throw error;
    }
  }

  /**
   * Show log summary
   */
  async showLogSummary(): Promise<void> {
    const stats = await this.getLogStats();
    const recentEntries = await this.getLogEntries({}, 10);

    console.log(chalk.blue('\n📊 Operation Log Summary'));
    console.log(`Total entries: ${chalk.yellow(stats.totalEntries)}`);
    console.log(`Error rate: ${chalk.yellow((stats.errorRate * 100).toFixed(1))}%`);
    console.log(`Security events: ${chalk.yellow(stats.securityEvents)}`);
    console.log(`Average duration: ${chalk.yellow(stats.averageDuration.toFixed(1))}ms`);
    console.log(`Disk usage: ${chalk.yellow(this.formatSize(stats.diskUsage))}`);

    console.log(chalk.blue('\nBy Level:'));
    Object.entries(stats.entriesByLevel).forEach(([level, count]) => {
      if (count > 0) {
        const color =
          level === 'error' ? chalk.red : level === 'security' ? chalk.magenta : chalk.gray;
        console.log(`  ${color(level)}: ${count}`);
      }
    });

    console.log(chalk.blue('\nCommon Operations:'));
    stats.commonOperations.slice(0, 5).forEach(({ operation, count }) => {
      console.log(`  ${chalk.cyan(operation)}: ${count}`);
    });

    if (recentEntries.length > 0) {
      console.log(chalk.blue('\nRecent Entries:'));
      recentEntries.slice(0, 5).forEach((entry) => {
        const color =
          entry.level === 'error'
            ? chalk.red
            : entry.level === 'security'
              ? chalk.magenta
              : chalk.gray;
        const time = entry.timestamp.toLocaleTimeString();
        console.log(
          `  ${color(entry.level)} ${chalk.cyan(entry.operation)} ${entry.status} ${chalk.gray(`(${time})`)}`,
        );
      });
    }
  }

  /**
   * Configure logger
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(chalk.green('✅ Logger configuration updated'));
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Flush log buffer immediately
   */
  async flushBuffer(): Promise<void> {
    if (this.logBuffer.length > 0) {
      await this.writeBatchEntries(this.logBuffer);
      this.logBuffer = [];
    }
  }

  /**
   * Initialize logging system
   */
  private initializeLogging(): void {
    this.logFile = path.join(this.config.logDirectory, 'operations.log');
    this.securityLogFile = path.join(this.config.logDirectory, 'security.log');
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): LoggerConfig {
    return {
      enabled: true,
      logLevel: 'info',
      logDirectory: path.join(os.tmpdir(), 'maria-logs'),
      maxLogSize: 10 * 1024 * 1024, // 10MB
      maxLogAge: 30, // 30 days
      rotationEnabled: true,
      compressionEnabled: false,
      securityLogging: true,
      performanceLogging: true,
      auditTrail: true,
    };
  }

  /**
   * Setup log directory
   */
  private async setupLogDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.config.logDirectory, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create log directory: ${error}`);
    }
  }

  /**
   * Setup log rotation
   */
  private async setupLogRotation(): Promise<void> {
    if (!this.config.rotationEnabled) {
      return;
    }

    try {
      const stats = await fs.promises.stat(this.logFile);
      if (stats.size > this.config.maxLogSize) {
        await this.rotateLog();
      }
    } catch {
      // Log file doesn't exist yet
    }
  }

  /**
   * Rotate log file
   */
  private async rotateLog(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = path.join(this.config.logDirectory, `operations_${timestamp}.log`);

      await fs.promises.rename(this.logFile, rotatedFile);

      // Compress if enabled
      if (this.config.compressionEnabled) {
        // TODO: Implement compression
      }

      console.debug('Log file rotated');
    } catch (error) {
      console.warn('Failed to rotate log file:', error);
    }
  }

  /**
   * Gather system metadata
   */
  private async gatherMetadata(): Promise<LogEntry['metadata']> {
    return {
      user: os.userInfo().username,
      process: process.title,
      pid: process.pid,
      platform: process.platform,
      workingDirectory: process.cwd(),
      terminalType: process.env.TERM_PROGRAM || 'unknown',
      sessionId: process.env.TERM_SESSION_ID || undefined,
    };
  }

  /**
   * Write log entry
   */
  private async writeLogEntry(entry: LogEntry): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (this.shouldBuffer()) {
      this.logBuffer.push(entry);
    } else {
      await this.writeDirectly(entry);
    }
  }

  /**
   * Write entry directly to file
   */
  private async writeDirectly(entry: LogEntry): Promise<void> {
    try {
      const line = `${JSON.stringify(entry)  }\n`;
      await fs.promises.appendFile(this.logFile, line);
    } catch (error) {
      console.warn('Failed to write log entry:', error);
    }
  }

  /**
   * Write security log
   */
  private async writeSecurityLog(entry: Record<string, unknown>): Promise<void> {
    try {
      const line = `${JSON.stringify(entry)  }\n`;
      await fs.promises.appendFile(this.securityLogFile, line);
    } catch (error) {
      console.warn('Failed to write security log:', error);
    }
  }

  /**
   * Write batch entries
   */
  private async writeBatchEntries(entries: LogEntry[]): Promise<void> {
    try {
      const content = `${entries.map((entry) => JSON.stringify(entry)).join('\n')  }\n`;
      await fs.promises.appendFile(this.logFile, content);
    } catch (error) {
      console.warn('Failed to write batch entries:', error);
    }
  }

  /**
   * Should buffer entries
   */
  private shouldBuffer(): boolean {
    return this.logBuffer.length < 10; // Buffer up to 10 entries
  }

  /**
   * Start buffer flush timer
   */
  private startBufferFlushTimer(): void {
    this.bufferFlushTimer = setInterval(async () => {
      await this.flushBuffer();
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Apply log filter
   */
  private applyLogFilter(entries: LogEntry[], filter: LogFilter): LogEntry[] {
    return entries.filter((entry) => {
      // Level filter
      if (filter.level && !filter.level.includes(entry.level)) {
        return false;
      }

      // Operation filter
      if (filter.operation && !filter.operation.includes(entry.operation)) {
        return false;
      }

      // Status filter
      if (filter.status && !filter.status.includes(entry.status)) {
        return false;
      }

      // Time range filter
      if (filter.timeRange) {
        if (entry.timestamp < filter.timeRange.start || entry.timestamp > filter.timeRange.end) {
          return false;
        }
      }

      // User filter
      if (filter.user && entry.metadata.user !== filter.user) {
        return false;
      }

      // Files filter
      if (filter.files && filter.files.length > 0) {
        const hasMatchingFile = entry.files.some((file) =>
          filter.files!.some((filterFile) => file.path.includes(filterFile)),
        );
        if (!hasMatchingFile) {
          return false;
        }
      }

      // Security only filter
      if (filter.securityOnly && entry.level !== 'security') {
        return false;
      }

      return true;
    });
  }

  /**
   * Calculate log disk usage
   */
  private async calculateLogDiskUsage(): Promise<number> {
    try {
      let totalSize = 0;
      const files = await fs.promises.readdir(this.config.logDirectory);

      for (const file of files) {
        const filePath = path.join(this.config.logDirectory, file);
        const stats = await fs.promises.stat(filePath);
        totalSize += stats.size;
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Format entries as CSV
   */
  private formatAsCSV(entries: LogEntry[]): string {
    const headers = [
      'timestamp',
      'level',
      'operation',
      'status',
      'duration',
      'user',
      'files',
      'error',
    ];

    const rows = entries.map((entry) => [
      entry.timestamp.toISOString(),
      entry.level,
      entry.operation,
      entry.status,
      entry.duration || '',
      entry.metadata.user,
      entry.files.map((f) => f.path).join(';'),
      entry.error?.message || '',
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  /**
   * Format entries as text
   */
  private formatAsText(entries: LogEntry[]): string {
    return entries
      .map((entry) => {
        const time = entry.timestamp.toISOString();
        const duration = entry.duration ? `${entry.duration}ms` : '';
        const files = entry.files.map((f) => f.path).join(', ');
        const error = entry.error ? ` ERROR: ${entry.error.message}` : '';

        return `[${time}] ${entry.level.toUpperCase()} ${entry.operation} ${entry.status} ${duration} ${files}${error}`;
      })
      .join('\n');
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

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const operationLogger = OperationLogger.getInstance();
