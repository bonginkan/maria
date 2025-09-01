/**
 * Operation Logger - Comprehensive File System Operation Logging
 * Tracks all file operations with detailed metadata and security audit trail
 * Phase 2: Terminal Integration & Safety - Week 8
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import chalk from "chalk";

export interface LogEntry {
  id: string;
  _timestamp: Date;
  level: "debug" | "info" | "warn" | "_error" | "security";
  operation: string;
  status: "started" | "completed" | "failed" | "cancelled";
  _duration?: number;
  metadata: {
    user: string;
    process: string;
    pid: number;
    platform: string;
    workingDirectory: string;
    terminalType?: string;
    sessionId?: string;
  };
  _files: Array<{
    _path: string;
    action:
      | "read"
      | "write"
      | "delete"
      | "create"
      | "move"
      | "copy"
      | "chmod"
      | "stat";
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
    _startTime: number;
    _endTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
  _error?: {
    code: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
}

export interface LogFilter {
  level?: LogEntry["level"][];
  operation?: string[];
  status?: LogEntry["status"][];
  timeRange?: {
    start: Date;
    end: Date;
  };
  user?: string;
  _files?: string[];
  securityOnly?: boolean;
}

export interface LogStats {
  totalEntries: number;
  entriesByLevel: Record<LogEntry["level"], number>;
  entriesByStatus: Record<LogEntry["status"], number>;
  commonOperations: Array<{ operation: string; count: number }>;
  securityEvents: number;
  errorRate: number;
  averageDuration: number;
  diskUsage: number;
}

export interface LoggerConfig {
  enabled: boolean;
  logLevel: LogEntry["level"];
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
      await this.logOperation("logger", "started", [], {
        context: { config: this.config },
      });

      console.debug("Operation logger initialized");
      return true;
    } catch (_error) {
      console._error("Failed to initialize operation logger:", _error);
      return false;
    }
  }

  /**
   * Start logging an operation
   */
  async startOperation(
    operation: string,
    _files: LogEntry["_files"],
    options: {
      level?: LogEntry["level"];
      security?: Partial<LogEntry["security"]>;
      context?: Record<string, unknown>;
    } = {},
  ): Promise<string> {
    const _operationId = this.generateOperationId();
    const _startTime = performance.now();

    const _logEntry: LogEntry = {
      id: _operationId,
      _timestamp: new Date(),
      level: options.level || "info",
      operation,
      status: "started",
      metadata: await this.gatherMetadata(),
      _files,
      security: {
        elevationRequired: false,
        confirmationRequired: false,
        backupCreated: false,
        trashUsed: false,
        ...options.security,
      },
      performance: {
        _startTime,
        memoryUsage: process.memoryUsage().heapUsed,
      },
      context: options.context,
    };

    this.activeOperations.set(_operationId, _logEntry);
    await this.writeLogEntry(_logEntry);

    return _operationId;
  }

  /**
   * Complete an operation
   */
  async completeOperation(
    _operationId: string,
    status: "completed" | "failed" | "cancelled",
    _error?: { code: string; message: string; stack?: string },
    context?: Record<string, unknown>,
  ): Promise<void> {
    const _logEntry = this.activeOperations.get(_operationId);
    if (!_logEntry) {
      console.warn(`Operation not found: ${_operationId}`);
      return;
    }

    const _endTime = performance.now();
    _logEntry.status = status;
    _logEntry.duration = _endTime - _logEntry.performance.startTime;
    _logEntry.performance._endTime = _endTime;
    logEntry.performance.cpuUsage = process.cpuUsage().user;

    if (_error) {
      _logEntry.error = _error;
      logEntry.level = "_error";
    }

    if (context) {
      _logEntry.context = { ..._logEntry.context, ...context };
    }

    await this.writeLogEntry(_logEntry);
    this.activeOperations.delete(_operationId);
  }

  /**
   * Log a simple operation (start and complete immediately)
   */
  async logOperation(
    operation: string,
    status: LogEntry["status"],
    _files: LogEntry["_files"],
    options: {
      level?: LogEntry["level"];
      _duration?: number;
      security?: Partial<LogEntry["security"]>;
      _error?: LogEntry["_error"];
      context?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    const _logEntry: LogEntry = {
      id: this.generateOperationId(),
      _timestamp: new Date(),
      level: options.level || "info",
      operation,
      status,
      _duration: options.duration,
      metadata: await this.gatherMetadata(),
      _files,
      security: {
        elevationRequired: false,
        confirmationRequired: false,
        backupCreated: false,
        trashUsed: false,
        ...options.security,
      },
      performance: {
        _startTime: performance.now(),
        _endTime: performance.now(),
        memoryUsage: process.memoryUsage().heapUsed,
      },
      _error: options.error,
      context: options.context,
    };

    await this.writeLogEntry(_logEntry);
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    event: string,
    details: {
      severity: "low" | "medium" | "high" | "critical";
      _files?: LogEntry["_files"];
      action: string;
      result: "allowed" | "denied" | "elevated";
      context?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.logOperation(event, "completed", details.files || [], {
      level: "security",
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
      const _securityEntry = {
        _timestamp: new Date().toISOString(),
        event,
        severity: details.severity,
        action: details.action,
        result: details.result,
        _files: details.files?.map((f) => f._path) || [],
        metadata: await this.gatherMetadata(),
        context: details.context,
      };

      await this.writeSecurityLog(_securityEntry);
    }
  }

  /**
   * Get filtered log _entries
   */
  async getLogEntries(
    _filter: LogFilter = {},
    limit: number = 100,
  ): Promise<LogEntry[]> {
    try {
      const _logContent = await fs.promises.readFile(this.logFile, "utf8");
      const _lines = _logContent.split("\n")._filter((_line) => _line.trim());

      let _entries: LogEntry[] = [];

      for (const _line of _lines.slice(-limit * 2)) {
        // Get more than needed for filtering
        try {
          const _entry = JSON.parse(_line);
          _entry.timestamp = new Date(_entry.timestamp);
          entries.push(_entry);
        } catch {
          // Skip invalid _lines
        }
      }

      // Apply filters
      _entries = this.applyLogFilter(_entries, _filter);

      // Sort by _timestamp (newest first) and limit
      return _entries
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
    } catch (_error) {
      console.warn("Failed to read log _entries:", _error);
      return [];
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<LogStats> {
    const _entries = await this.getLogEntries({}, 10000); // Get large sample

    const _stats: LogStats = {
      totalEntries: _entries.length,
      entriesByLevel: { debug: 0, info: 0, warn: 0, _error: 0, security: 0 },
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

    for (const _entry of _entries) {
      // Count by level
      _stats.entriesByLevel[_entry.level]++;

      // Count by status
      stats.entriesByStatus[_entry.status]++;

      // Count operations
      operationCounts[_entry.operation] =
        (operationCounts[_entry.operation] || 0) + 1;

      // Security events
      if (_entry.level === "security") {
        stats.securityEvents++;
      }

      // Duration
      if (_entry.duration) {
        totalDuration += _entry.duration;
        durationCount++;
      }
    }

    // Calculate derived _stats
    _stats.errorRate =
      _entries.length > 0 ? _stats.entriesByLevel.error / _entries.length : 0;
    _stats.averageDuration =
      durationCount > 0 ? totalDuration / durationCount : 0;

    // Common operations
    stats.commonOperations = Object._entries(operationCounts)
      .map(([operation, count]) => ({ operation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Disk usage
    stats.diskUsage = await this.calculateLogDiskUsage();

    return _stats;
  }

  /**
   * Export logs
   */
  async exportLogs(
    outputPath: string,
    filter: LogFilter = {},
    format: "json" | "csv" | "txt" = "json",
  ): Promise<void> {
    const _entries = await this.getLogEntries(filter, 10000);

    let _content: string;

    switch (format) {
      case "csv":
        _content = this.formatAsCSV(_entries);
        break;
      case "txt":
        _content = this.formatAsText(_entries);
        break;
      default:
        _content = JSON.stringify(_entries, null, 2);
    }

    await fs.promises.writeFile(outputPath, _content);
  }

  /**
   * Clear logs
   */
  async clearLogs(olderThanDays?: number): Promise<void> {
    try {
      if (olderThanDays) {
        // Selective clearing based on age
        const _entries = await this.getLogEntries({}, 100000);
        const _cutoffDate = new Date();
        _cutoffDate.setDate(_cutoffDate.getDate() - olderThanDays);

        const _filteredEntries = _entries.filter(
          (_entry) => _entry.timestamp >= _cutoffDate,
        );

        // Rewrite log file with filtered _entries
        const _content = _filteredEntries
          .map((_entry) => JSON.stringify(_entry))
          .join("\n");
        await fs.promises.writeFile(this.logFile, _content);
      } else {
        // Clear all logs
        await fs.promises.writeFile(this.logFile, "");
        if (this.config.securityLogging) {
          await fs.promises.writeFile(this.securityLogFile, "");
        }
      }

      console.log(chalk.green("✅ Logs cleared"));
    } catch (_error) {
      console._error("Failed to clear logs:", _error);
      throw _error;
    }
  }

  /**
   * Show log summary
   */
  async showLogSummary(): Promise<void> {
    const _stats = await this.getLogStats();
    const _recentEntries = await this.getLogEntries({}, 10);

    console.log(chalk.blue("\n📊 Operation Log Summary"));
    console.log(`Total _entries: ${chalk.yellow(_stats.totalEntries)}`);
    console.log(
      `Error rate: ${chalk.yellow((_stats.errorRate * 100).toFixed(1))}%`,
    );
    console.log(`Security events: ${chalk.yellow(_stats.securityEvents)}`);
    console.log(
      `Average _duration: ${chalk.yellow(_stats.averageDuration.toFixed(1))}ms`,
    );
    console.log(
      `Disk usage: ${chalk.yellow(this.formatSize(_stats.diskUsage))}`,
    );

    console.log(chalk.blue("\nBy Level:"));
    Object.entries(_stats.entriesByLevel).forEach(([level, count]) => {
      if (count > 0) {
        const _color =
          level === "_error"
            ? chalk.red
            : level === "security"
              ? chalk.magenta
              : chalk.gray;
        console.log(`  ${_color(level)}: ${count}`);
      }
    });

    console.log(chalk.blue("\nCommon Operations:"));
    stats.commonOperations.slice(0, 5).forEach(({ operation, count }) => {
      console.log(`  ${chalk.cyan(operation)}: ${count}`);
    });

    if (_recentEntries.length > 0) {
      console.log(chalk.blue("\nRecent Entries:"));
      recentEntries.slice(0, 5).forEach((_entry) => {
        const _color =
          entry.level === "_error"
            ? chalk.red
            : _entry.level === "security"
              ? chalk.magenta
              : chalk.gray;
        const _time = _entry.timestamp.toLocaleTimeString();
        console.log(
          `  ${_color(_entry.level)} ${chalk.cyan(_entry.operation)} ${_entry.status} ${chalk.gray(`(${_time})`)}`,
        );
      });
    }
  }

  /**
   * Configure logger
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(chalk.green("✅ Logger configuration updated"));
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
    this.logFile = path.join(this.config.logDirectory, "operations.log");
    this.securityLogFile = path.join(this.config.logDirectory, "security.log");
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): LoggerConfig {
    return {
      enabled: true,
      logLevel: "info",
      logDirectory: path.join(os.tmpdir(), "maria-logs"),
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
    } catch (_error) {
      throw new Error(`Failed to create log directory: ${_error}`);
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
      const _stats = await fs.promises.stat(this.logFile);
      if (_stats.size > this.config.maxLogSize) {
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
      const _timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const _rotatedFile = path.join(
        this.config.logDirectory,
        `operations_${_timestamp}.log`,
      );

      await fs.promises.rename(this.logFile, _rotatedFile);

      // Compress if enabled
      if (this.config.compressionEnabled) {
        // TODO: Implement compression
      }

      console.debug("Log file rotated");
    } catch (_error) {
      console.warn("Failed to rotate log file:", _error);
    }
  }

  /**
   * Gather system metadata
   */
  private async gatherMetadata(): Promise<LogEntry["metadata"]> {
    return {
      user: os.userInfo().username,
      process: process.title,
      pid: process.pid,
      platform: process.platform,
      workingDirectory: process.cwd(),
      terminalType: process.env.TERM_PROGRAM || "unknown",
      sessionId: process.env.TERM_SESSION_ID || undefined,
    };
  }

  /**
   * Write log _entry
   */
  private async writeLogEntry(_entry: LogEntry): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (this.shouldBuffer()) {
      this.logBuffer.push(_entry);
    } else {
      await this.writeDirectly(_entry);
    }
  }

  /**
   * Write _entry directly to file
   */
  private async writeDirectly(_entry: LogEntry): Promise<void> {
    try {
      const _line = `${JSON.stringify(_entry)}\n`;
      await fs.promises.appendFile(this.logFile, _line);
    } catch (_error) {
      console.warn("Failed to write log _entry:", _error);
    }
  }

  /**
   * Write security log
   */
  private async writeSecurityLog(
    _entry: Record<string, unknown>,
  ): Promise<void> {
    try {
      const _line = `${JSON.stringify(_entry)}\n`;
      await fs.promises.appendFile(this.securityLogFile, _line);
    } catch (_error) {
      console.warn("Failed to write security log:", _error);
    }
  }

  /**
   * Write batch _entries
   */
  private async writeBatchEntries(_entries: LogEntry[]): Promise<void> {
    try {
      const _content = `${_entries.map((_entry) => JSON.stringify(_entry)).join("\n")}\n`;
      await fs.promises.appendFile(this.logFile, _content);
    } catch (_error) {
      console.warn("Failed to write batch _entries:", _error);
    }
  }

  /**
   * Should buffer _entries
   */
  private shouldBuffer(): boolean {
    return this.logBuffer.length < 10; // Buffer up to 10 _entries
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
  private applyLogFilter(_entries: LogEntry[], filter: LogFilter): LogEntry[] {
    return _entries.filter((_entry) => {
      // Level filter
      if (filter.level && !filter.level.includes(_entry.level)) {
        return false;
      }

      // Operation filter
      if (filter.operation && !filter.operation.includes(_entry.operation)) {
        return false;
      }

      // Status filter
      if (filter.status && !filter.status.includes(_entry.status)) {
        return false;
      }

      // Time range filter
      if (filter.timeRange) {
        if (
          _entry.timestamp < filter.timeRange.start ||
          _entry.timestamp > filter.timeRange.end
        ) {
          return false;
        }
      }

      // User filter
      if (filter.user && _entry.metadata.user !== filter.user) {
        return false;
      }

      // Files filter
      if (filter.files && filter.files.length > 0) {
        const _hasMatchingFile = _entry.files.some((file) =>
          filter.files!.some((filterFile) => file._path.includes(filterFile)),
        );
        if (!_hasMatchingFile) {
          return false;
        }
      }

      // Security only filter
      if (filter.securityOnly && _entry.level !== "security") {
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
      const _files = await fs.promises.readdir(this.config.logDirectory);

      for (const file of _files) {
        const _filePath = path.join(this.config.logDirectory, file);
        const _stats = await fs.promises.stat(_filePath);
        totalSize += _stats.size;
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Format _entries as CSV
   */
  private formatAsCSV(_entries: LogEntry[]): string {
    const _headers = [
      "_timestamp",
      "level",
      "operation",
      "status",
      "_duration",
      "user",
      "_files",
      "_error",
    ];

    const _rows = _entries.map((_entry) => [
      _entry.timestamp.toISOString(),
      _entry.level,
      _entry.operation,
      _entry.status,
      _entry.duration || "",
      _entry.metadata.user,
      _entry.files.map((f) => f._path).join(";"),
      entry.error?.message || "",
    ]);

    return [_headers, ..._rows].map((row) => row.join(",")).join("\n");
  }

  /**
   * Format _entries as text
   */
  private formatAsText(_entries: LogEntry[]): string {
    return _entries
      .map((_entry) => {
        const _time = _entry.timestamp.toISOString();
        const _duration = _entry._duration ? `${_entry._duration}ms` : "";
        const _files = _entry._files.map((f) => f._path).join(", ");
        const _error = _entry._error ? ` ERROR: ${_entry._error.message}` : "";

        return `[${_time}] ${_entry.level.toUpperCase()} ${_entry.operation} ${_entry.status} ${_duration} ${_files}${_error}`;
      })
      .join("\n");
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

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const _operationLogger = OperationLogger.getInstance();
