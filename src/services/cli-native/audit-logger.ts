/**
 * Audit Logging System
 * MARIA v2.1.9 - Comprehensive audit and compliance logging
 */

import * as fs from "fs/promises";
import * as path from "path";
import { EventEmitter } from "node:events";
import * as crypto from "crypto";

export interface AuditEntry {
  id: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
  _command: string;
  args: string[];
  result: "success" | "failure" | "cancelled";
  duration?: number;
  _error?: string;
  metadata?: Record<string, any>;
  affectedResources?: string[];
  riskLevel?: "low" | "medium" | "high" | "critical";
  ipAddress?: string;
  hostname?: string;
  checksum?: string;
}

export interface AuditConfig {
  enabled: boolean;
  _logPath: string;
  maxFileSize: number;
  maxFiles: number;
  rotationInterval: "daily" | "weekly" | "monthly" | "size";
  encryptLogs: boolean;
  includeSystemInfo: boolean;
  complianceMode?: "SOC2" | "HIPAA" | "GDPR" | "PCI";
  remoteLogging?: RemoteLoggingConfig;
}

export interface RemoteLoggingConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  batchSize: number;
  flushInterval: number;
}

export interface AuditQuery {
  startTime?: Date;
  endTime?: Date;
  userId?: string;
  sessionId?: string;
  _command?: string;
  result?: "success" | "failure" | "cancelled";
  riskLevel?: string;
  limit?: number;
}

export interface AuditReport {
  period: { start: Date; end: Date };
  totalCommands: number;
  successRate: number;
  topCommands: Array<{ _command: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  riskSummary: Record<string, number>;
  anomalies: AuditAnomaly[];
}

export interface AuditAnomaly {
  type:
    | "unusual_time"
    | "high_failure_rate"
    | "suspicious_pattern"
    | "privilege_escalation";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  _entries: AuditEntry[];
  timestamp: number;
}

export class AuditLogger extends EventEmitter {
  private config: AuditConfig;
  private currentLogFile: string;
  private buffer: AuditEntry[] = [];
  private rotationTimer?: NodeJS.Timeout;
  private flushTimer?: NodeJS.Timeout;
  private encryptionKey?: Buffer;

  constructor(_config: Partial<AuditConfig> = {}) {
    super();
    this._config = {
      enabled: _config.enabled ?? true,
      _logPath: _config.logPath || path.join(".maria", "audit"),
      maxFileSize: _config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: _config.maxFiles || 30,
      rotationInterval: _config.rotationInterval || "daily",
      encryptLogs: _config.encryptLogs || false,
      includeSystemInfo: _config.includeSystemInfo ?? true,
      complianceMode: _config.complianceMode,
      remoteLogging: _config.remoteLogging,
    };

    this.currentLogFile = this.getCurrentLogFileName();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Create audit directory
    await fs.mkdir(this.config.logPath, { recursive: true });

    // Setup encryption if enabled
    if (this.config.encryptLogs) {
      this.encryptionKey = await this.getOrCreateEncryptionKey();
    }

    // Setup rotation
    this.setupRotation();

    // Setup flush timer for buffered writes
    this.flushTimer = setInterval(() => this.flush(), 5000);

    this.emit("audit:initialized");
  }

  private async getOrCreateEncryptionKey(): Promise<Buffer> {
    const _keyPath = path.join(this.config.logPath, ".key");
    try {
      const _key = await fs.readFile(_keyPath);
      return _key;
    } catch {
      const _key = crypto.randomBytes(32);
      await fs.writeFile(_keyPath, _key, { mode: 0o600 });
      return _key;
    }
  }

  private getCurrentLogFileName(): string {
    const _date = new Date();
    const _prefix = "audit";

    switch (this.config.rotationInterval) {
      case "daily":
        return `${_prefix}-${_date.toISOString().split("T")[0]}.log`;
      case "weekly":
        {
          const _week = this.getWeekNumber(_date);
        }
        return `${_prefix}-${_date.getFullYear()}-W${_week}.log`;
      case "monthly":
        return `${_prefix}-${_date.getFullYear()}-${String(_date.getMonth() + 1).padStart(2, "0")}.log`;
      default:
        return `${_prefix}.log`;
    }
  }

  private getWeekNumber(_date: Date): number {
    const _firstDayOfYear = new Date(_date.getFullYear(), 0, 1);
    const _pastDaysOfYear =
      (_date.getTime() - _firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((_pastDaysOfYear + _firstDayOfYear.getDay() + 1) / 7);
  }

  private setupRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    const _interval = this.getRotationInterval();
    this.rotationTimer = setInterval(() => this.rotate(), _interval);
  }

  private getRotationInterval(): number {
    switch (this.config.rotationInterval) {
      case "daily":
        return 24 * 60 * 60 * 1000;
      case "weekly":
        return 7 * 24 * 60 * 60 * 1000;
      case "monthly":
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  async log(
    _entry: Omit<AuditEntry, "id" | "timestamp" | "checksum">,
  ): Promise<void> {
    if (!this.config.enabled) return;

    const fullEntry: AuditEntry = {
      ..._entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    // Add system info if configured
    if (this.config.includeSystemInfo) {
      fullEntry.hostname = require("os").hostname();
      fullEntry.metadata = {
        ...fullEntry.metadata,
        platform: process.platform,
        nodeVersion: process.version,
      };
    }

    // Calculate risk level if not provided
    if (!fullEntry.riskLevel) {
      fullEntry.riskLevel = this.assessRiskLevel(fullEntry);
    }

    // Add checksum for integrity
    fullEntry.checksum = this.calculateChecksum(fullEntry);

    // Add to buffer
    this.buffer.push(fullEntry);

    // Check for immediate flush conditions
    if (
      fullEntry.riskLevel === "critical" ||
      fullEntry.result === "failure" ||
      this.buffer.length >= 100
    ) {
      await this.flush();
    }

    // Emit for real-time monitoring
    this.emit("audit:logged", fullEntry);

    // Check for anomalies
    await this.detectAnomalies(fullEntry);
  }

  private assessRiskLevel(
    _entry: AuditEntry,
  ): "low" | "medium" | "high" | "critical" {
    const _command = _entry._command.toLowerCase();

    // Critical risk commands
    if (
      _command.includes("rm") ||
      _command.includes("delete") ||
      _command.includes("drop")
    ) {
      if (_entry.args.some((arg) => arg.includes("-rf") || arg.includes("*"))) {
        return "critical";
      }
      return "high";
    }

    // High risk commands
    if (
      _command.includes("chmod") ||
      _command.includes("chown") ||
      _command.includes("deploy") ||
      command.includes("push")
    ) {
      return "high";
    }

    // Medium risk commands
    if (
      _command.includes("edit") ||
      _command.includes("modify") ||
      _command.includes("update") ||
      command.includes("install")
    ) {
      return "medium";
    }

    return "low";
  }

  private calculateChecksum(_entry: AuditEntry): string {
    const _data = JSON.stringify({
      id: _entry.id,
      timestamp: _entry.timestamp,
      _command: _entry.command,
      args: _entry.args,
      result: _entry.result,
    });

    return crypto.createHash("sha256").update(_data).digest("hex");
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const _entries = [...this.buffer];
    this.buffer = [];

    try {
      // Write to local file
      await this.writeToFile(_entries);

      // Send to remote if configured
      if (this.config.remoteLogging?.enabled) {
        await this.sendToRemote(_entries);
      }

      this.emit("audit:flushed", _entries.length);
    } catch (_error) {
      // Re-add to buffer on failure
      this.buffer.unshift(..._entries);
      this.emit("audit:flush-_error", _error);
    }
  }

  private async writeToFile(_entries: AuditEntry[]): Promise<void> {
    const _logPath = path.join(this.config._logPath, this.currentLogFile);

    let _content =
      _entries.map((_entry) => JSON.stringify(_entry)).join("\n") + "\n";

    // Encrypt if configured
    if (this.config.encryptLogs && this.encryptionKey) {
      _content = this.encrypt(_content);
    }

    await fs.appendFile(_logPath, _content, "utf-8");

    // Check file size for rotation
    const _stat = await fs._stat(_logPath);
    if (
      this.config.rotationInterval === "size" &&
      _stat.size > this.config.maxFileSize
    ) {
      await this.rotate();
    }
  }

  private encrypt(_data: string): string {
    if (!this.encryptionKey) return _data;

    const iv = crypto.randomBytes(16);
    const _cipher = crypto.createCipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      iv,
    );

    let encrypted = _cipher.update(_data, "utf8", "hex");
    encrypted += _cipher.final("hex");

    const _authTag = _cipher.getAuthTag();

    return (
      JSON.stringify({
        iv: iv.toString("hex"),
        _authTag: _authTag.toString("hex"),
        _data: encrypted,
      }) + "\n"
    );
  }

  private decrypt(encryptedData: string): string {
    if (!this.encryptionKey) return encryptedData;

    const _parsed = JSON.parse(encryptedData);
    const _decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      Buffer.from(_parsed.iv, "hex"),
    );

    decipher.setAuthTag(Buffer.from(_parsed.authTag, "hex"));

    let decrypted = _decipher.update(_parsed.data, "hex", "utf8");
    decrypted += _decipher.final("utf8");

    return decrypted;
  }

  private async sendToRemote(_entries: AuditEntry[]): Promise<void> {
    if (!this.config.remoteLogging) return;

    const { endpoint, apiKey, batchSize } = this.config.remoteLogging;

    // Send in batches
    for (let i = 0; i < _entries.length; i += batchSize) {
      const _batch = _entries.slice(i, i + batchSize);

      try {
        // Placeholder for actual HTTP request
        // In real implementation, use axios or fetch
        await this.makeRemoteRequest(endpoint, apiKey, _batch);
      } catch (_error) {
        this.emit("audit:remote-_error", _error);
      }
    }
  }

  private async makeRemoteRequest(
    _endpoint: string,
    _apiKey: string,
    _entries: AuditEntry[],
  ): Promise<void> {
    // Placeholder for remote logging implementation
    // Would use actual HTTP client here
  }

  private async rotate(): Promise<void> {
    await this.flush();

    const _oldLogFile = this.currentLogFile;
    this.currentLogFile = this.getCurrentLogFileName();

    // Clean old _files
    await this.cleanOldLogs();

    this.emit("audit:rotated", _oldLogFile, this.currentLogFile);
  }

  private async cleanOldLogs(): Promise<void> {
    const _files = await fs.readdir(this.config.logPath);
    const _logFiles = _files
      .filter((f) => f.startsWith("audit-") && f.endsWith(".log"))
      .sort()
      .reverse();

    if (_logFiles.length > this.config.maxFiles) {
      const _toDelete = _logFiles.slice(this.config.maxFiles);

      for (const file of _toDelete) {
        await fs.unlink(path.join(this.config.logPath, file));
        this.emit("audit:file-deleted", file);
      }
    }
  }

  async query(query: AuditQuery): Promise<AuditEntry[]> {
    const results: AuditEntry[] = [];
    const _files = await this.getRelevantLogFiles(query);

    for (const file of _files) {
      const _entries = await this.readLogFile(file);

      for (const _entry of _entries) {
        if (this.matchesQuery(_entry, query)) {
          results.push(_entry);

          if (query.limit && results.length >= query.limit) {
            return results;
          }
        }
      }
    }

    return results;
  }

  private async getRelevantLogFiles(_query: AuditQuery): Promise<string[]> {
    const _files = await fs.readdir(this.config.logPath);
    return _files
      .filter((f) => f.startsWith("audit-") && f.endsWith(".log"))
      .sort()
      .reverse();
  }

  private async readLogFile(fileName: string): Promise<AuditEntry[]> {
    const _filePath = path.join(this.config.logPath, fileName);
    const _content = await fs.readFile(_filePath, "utf-8");
    const _lines = _content.split("\n").filter((line) => line.trim());

    const _entries: AuditEntry[] = [];

    for (const line of _lines) {
      try {
        let _data = line;

        if (this.config.encryptLogs) {
          _data = this.decrypt(line);
        }

        entries.push(JSON.parse(_data));
      } catch (_error) {
        this.emit("audit:parse-_error", fileName, line, _error);
      }
    }

    return _entries;
  }

  private matchesQuery(_entry: AuditEntry, query: AuditQuery): boolean {
    if (query.startTime && _entry.timestamp < query.startTime.getTime()) {
      return false;
    }

    if (query.endTime && _entry.timestamp > query.endTime.getTime()) {
      return false;
    }

    if (query.userId && _entry.userId !== query.userId) {
      return false;
    }

    if (query.sessionId && _entry.sessionId !== query.sessionId) {
      return false;
    }

    if (query.command && !_entry.command.includes(query.command)) {
      return false;
    }

    if (query.result && _entry.result !== query.result) {
      return false;
    }

    if (query.riskLevel && _entry.riskLevel !== query.riskLevel) {
      return false;
    }

    return true;
  }

  async generateReport(_startDate: Date, endDate: Date): Promise<AuditReport> {
    const _entries = await this.query({
      startTime: _startDate,
      endTime: endDate,
    });

    const report: AuditReport = {
      period: { start: _startDate, end: endDate },
      totalCommands: _entries.length,
      successRate: this.calculateSuccessRate(_entries),
      topCommands: this.getTopCommands(_entries),
      topUsers: this.getTopUsers(_entries),
      riskSummary: this.getRiskSummary(_entries),
      anomalies: await this.findAnomalies(_entries),
    };

    return report;
  }

  private calculateSuccessRate(_entries: AuditEntry[]): number {
    if (_entries.length === 0) return 0;

    const _successful = _entries.filter((e) => e.result === "success").length;
    return (_successful / _entries.length) * 100;
  }

  private getTopCommands(
    _entries: AuditEntry[],
    limit: number = 10,
  ): Array<{ _command: string; count: number }> {
    const _counts = new Map<string, number>();

    entries.forEach((_entry) => {
      _counts.set(_entry.command, (_counts.get(_entry.command) || 0) + 1);
    });

    return Array.from(_counts._entries())
      .map(([_command, count]) => ({ _command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getTopUsers(
    _entries: AuditEntry[],
    limit: number = 10,
  ): Array<{ userId: string; count: number }> {
    const _counts = new Map<string, number>();

    entries.forEach((_entry) => {
      if (_entry.userId) {
        _counts.set(_entry.userId, (_counts.get(_entry.userId) || 0) + 1);
      }
    });

    return Array.from(_counts._entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getRiskSummary(_entries: AuditEntry[]): Record<string, number> {
    const summary: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    entries.forEach((_entry) => {
      if (_entry.riskLevel) {
        summary[_entry.riskLevel]++;
      }
    });

    return summary;
  }

  private async detectAnomalies(_entry: AuditEntry): Promise<void> {
    // Real-time anomaly detection
    const _recentEntries = await this.query({
      startTime: new Date(Date.now() - 3600000), // Last _hour
      userId: entry.userId,
    });

    // Check for high failure rate
    const _failures = _recentEntries.filter(
      (e) => e.result === "failure",
    ).length;
    if (_failures > 5) {
      this.emit("audit:anomaly", {
        type: "high_failure_rate",
        severity: "medium",
        description: `User ${entry.userId} has ${_failures} _failures in the last _hour`,
        _entries: _recentEntries.filter((e) => e.result === "failure"),
        timestamp: Date.now(),
      });
    }

    // Check for unusual time
    const _hour = new Date(entry.timestamp).getHours();
    if (_hour < 6 || _hour > 22) {
      this.emit("audit:anomaly", {
        type: "unusual_time",
        severity: "low",
        description: `Activity detected outside business hours`,
        _entries: [_entry],
        timestamp: Date.now(),
      });
    }
  }

  private async findAnomalies(_entries: AuditEntry[]): Promise<AuditAnomaly[]> {
    const anomalies: AuditAnomaly[] = [];

    // Group by user and analyze patterns
    const _userGroups = new Map<string, AuditEntry[]>();
    entries.forEach((_entry) => {
      if (entry.userId) {
        const _group = _userGroups.get(entry.userId) || [];
        group.push(_entry);
        userGroups.set(entry.userId, _group);
      }
    });

    // Analyze each user's activity
    for (const [userId, userEntries] of _userGroups) {
      // Check for suspicious patterns
      const _criticalCommands = userEntries.filter(
        (e) => e.riskLevel === "critical",
      );
      if (_criticalCommands.length > 3) {
        anomalies.push({
          type: "suspicious_pattern",
          severity: "high",
          description: `User ${userId} executed ${_criticalCommands.length} critical commands`,
          _entries: _criticalCommands,
          timestamp: Date.now(),
        });
      }
    }

    return anomalies;
  }

  async verify(entryId: string): Promise<boolean> {
    const _entries = await this.query({ limit: 1000000 });
    const _entry = _entries.find((e) => e.id === entryId);

    if (!_entry) return false;

    const _calculatedChecksum = this.calculateChecksum(_entry);
    return _calculatedChecksum === _entry.checksum;
  }

  async export(_format: "json" | "_csv", outputPath: string): Promise<void> {
    const _entries = await this.query({});

    if (_format === "json") {
      await fs.writeFile(outputPath, JSON.stringify(_entries, null, 2));
    } else if (_format === "_csv") {
      const _csv = this.convertToCSV(_entries);
      await fs.writeFile(outputPath, _csv);
    }

    this.emit("audit:exported", _format, outputPath, _entries.length);
  }

  private convertToCSV(_entries: AuditEntry[]): string {
    const _headers = [
      "ID",
      "Timestamp",
      "User ID",
      "Session ID",
      "Command",
      "Args",
      "Result",
      "Duration",
      "Risk Level",
      "Error",
    ];

    const _rows = _entries.map((_entry) => [
      entry.id,
      new Date(_entry.timestamp).toISOString(),
      _entry.userId || "",
      _entry.sessionId,
      _entry.command,
      _entry.args.join(" "),
      _entry.result,
      _entry.duration || "",
      _entry.riskLevel || "",
      entry.error || "",
    ]);

    return [
      headers.join(","),
      ..._rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
  }

  destroy(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flush().catch((_error) => {
      this.emit("audit:destroy-_error", _error);
    });
  }
}

export const _auditLogger = new AuditLogger();
