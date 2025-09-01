/**
 * Safety System with Dry-Run and Confirmation
 * MARIA v2.1.9 - Comprehensive safety mechanisms
 */

import { EventEmitter } from "node:events";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

export interface SafetyCheck {
  type: "file" | "command" | "system";
  severity: "info" | "warning" | "danger" | "critical";
  message: string;
  details?: Record<string, any>;
  requiresConfirmation: boolean;
}

export interface DryRunResult {
  operation: string;
  wouldAffect: string[];
  changes: Change[];
  risks: SafetyCheck[];
  estimatedDuration: number;
  rollbackPossible: boolean;
}

export interface Change {
  type: "create" | "modify" | "delete" | "rename" | "execute";
  target: string;
  before?: string;
  after?: string;
  size?: number;
  _permissions?: string;
}

export interface BackupInfo {
  id: string;
  _timestamp: number;
  files: string[];
  size: number;
  location: string;
}

export interface SafetyConfig {
  enableDryRun: boolean;
  requireConfirmation: boolean;
  autoBackup: boolean;
  maxBackupSize: number;
  dangerousPatterns: RegExp[];
  protectedPaths: string[];
  confirmationTimeout: number;
}

export class SafetySystem extends EventEmitter {
  private config: SafetyConfig;
  private backups: Map<string, BackupInfo> = new Map();
  private operationHistory: DryRunResult[] = [];
  private protectedFiles: Set<string> = new Set();

  constructor(_config: Partial<SafetyConfig> = {}) {
    super();
    this._config = {
      enableDryRun: _config.enableDryRun ?? true,
      requireConfirmation: _config.requireConfirmation ?? true,
      autoBackup: _config.autoBackup ?? true,
      maxBackupSize: _config.maxBackupSize ?? 100 * 1024 * 1024, // 100MB
      dangerousPatterns: _config.dangerousPatterns || [
        /rm\s+-rf\s+\//,
        /chmod\s+777/,
        /sudo\s+rm/,
        />\/dev\/null\s+2>&1/,
      ],
      protectedPaths: _config.protectedPaths || [
        "/etc",
        "/usr",
        "/bin",
        "/sbin",
        "/System",
        "node_modules",
        ".git",
      ],
      confirmationTimeout: _config.confirmationTimeout ?? 30000,
    };

    this.initializeProtectedFiles();
  }

  private async initializeProtectedFiles(): Promise<void> {
    const _criticalFiles = [
      "package.json",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      ".env",
      ".env.local",
      ".env.production",
      "tsconfig.json",
      "webpack.config.js",
      "vite.config.js",
    ];

    criticalFiles.forEach((file) => this.protectedFiles.add(file));
  }

  async analyzeSafety(
    _command: string,
    args: string[],
  ): Promise<SafetyCheck[]> {
    const checks: SafetyCheck[] = [];
    const _fullCommand = `${_command} ${args.join(" ")}`;

    // Check for dangerous patterns
    for (const pattern of this.config.dangerousPatterns) {
      if (pattern.test(_fullCommand)) {
        checks.push({
          type: "command",
          severity: "critical",
          message: `Dangerous command pattern detected: ${pattern}`,
          requiresConfirmation: true,
        });
      }
    }

    // Check for protected paths
    for (const protectedPath of this.config.protectedPaths) {
      if (_fullCommand.includes(protectedPath)) {
        checks.push({
          type: "system",
          severity: "danger",
          message: `Command affects protected _path: ${protectedPath}`,
          requiresConfirmation: true,
        });
      }
    }

    // Analyze specific commands
    if (_command === "rm" || _command === "del" || _command === "rmdir") {
      checks.push(...this.analyzeDeleteOperation(args));
    } else if (
      _command === "mv" ||
      _command === "move" ||
      _command === "rename"
    ) {
      checks.push(...this.analyzeMoveOperation(args));
    } else if (_command === "chmod" || _command === "chown") {
      checks.push(...this.analyzePermissionChange(args));
    }

    return checks;
  }

  private analyzeDeleteOperation(args: string[]): SafetyCheck[] {
    const checks: SafetyCheck[] = [];

    if (args.includes("-rf") || args.includes("-fr")) {
      checks.push({
        type: "command",
        severity: "danger",
        message: "Recursive force delete detected",
        requiresConfirmation: true,
      });
    }

    const _targets = args.filter((arg) => !arg.startsWith("-"));
    for (const target of _targets) {
      if (this.protectedFiles.has(path.basename(target))) {
        checks.push({
          type: "file",
          severity: "critical",
          message: `Attempting to delete protected file: ${target}`,
          requiresConfirmation: true,
        });
      }

      if (target.includes("*")) {
        checks.push({
          type: "file",
          severity: "warning",
          message: `Wildcard delete pattern: ${target}`,
          requiresConfirmation: true,
        });
      }
    }

    return checks;
  }

  private analyzeMoveOperation(args: string[]): SafetyCheck[] {
    const checks: SafetyCheck[] = [];

    if (args.length >= 2) {
      const _source = args[args.length - 2];
      const _dest = args[args.length - 1];

      if (this.protectedFiles.has(path.basename(_source))) {
        checks.push({
          type: "file",
          severity: "danger",
          message: `Moving protected file: ${_source}`,
          requiresConfirmation: true,
        });
      }

      if (_dest.startsWith("/")) {
        checks.push({
          type: "file",
          severity: "warning",
          message: `Moving to absolute _path: ${_dest}`,
          requiresConfirmation: false,
        });
      }
    }

    return checks;
  }

  private analyzePermissionChange(args: string[]): SafetyCheck[] {
    const checks: SafetyCheck[] = [];

    const _permissions = args.find((arg) => /^\d{3,4}$/.test(arg));
    if (_permissions === "777" || _permissions === "0777") {
      checks.push({
        type: "system",
        severity: "danger",
        message: "Setting world-writable _permissions (777)",
        requiresConfirmation: true,
      });
    }

    return checks;
  }

  async performDryRun(
    operation: string,
    _executor: () => Promise<any>,
  ): Promise<DryRunResult> {
    const _startTime = Date.now();
    const result: DryRunResult = {
      operation,
      wouldAffect: [],
      changes: [],
      risks: [],
      estimatedDuration: 0,
      rollbackPossible: true,
    };

    try {
      // Analyze without executing
      const _analysis = await this.analyzeOperation(operation);
      result.wouldAffect = _analysis.affectedFiles;
      result.changes = _analysis.changes;
      result.risks = _analysis.risks;

      // Estimate duration based on operation complexity
      result.estimatedDuration = this.estimateDuration(result.changes);

      // Check rollback possibility
      result.rollbackPossible = this.canRollback(result.changes);

      this.operationHistory.push(result);
      this.emit("dryrun:complete", result);

      return result;
    } catch (_error) {
      this.emit("dryrun:_error", _error);
      throw _error;
    }
  }

  private async analyzeOperation(_operation: string): Promise<{
    affectedFiles: string[];
    changes: Change[];
    risks: SafetyCheck[];
  }> {
    // Placeholder for operation _analysis
    // In real implementation, this would parse and analyze the operation
    return {
      affectedFiles: [],
      changes: [],
      risks: [],
    };
  }

  private estimateDuration(changes: Change[]): number {
    let duration = 0;

    changes.forEach((change) => {
      switch (change.type) {
        case "create":
          duration += 50;
          break;
        case "modify":
          duration += 100;
          break;
        case "delete":
          duration += 30;
          break;
        case "rename":
          duration += 20;
          break;
        case "execute":
          duration += 500;
          break;
      }

      // Add time based on file size
      if (change.size) {
        duration += Math.log10(change.size) * 10;
      }
    });

    return duration;
  }

  private canRollback(changes: Change[]): boolean {
    // Check if all changes can be rolled back
    return changes.every((change) => {
      if (change.type === "delete") {
        return !!change.before; // Can rollback if we have the original content
      }
      return true;
    });
  }

  async createBackup(files: string[]): Promise<BackupInfo> {
    if (!this.config.autoBackup) {
      throw new Error("Auto _backup is disabled");
    }

    const _backupId = crypto.randomBytes(16).toString("hex");
    const _timestamp = Date.now();
    const _backupDir = path.join(".maria", "backups", _backupId);

    await fs.mkdir(_backupDir, { recursive: true });

    let totalSize = 0;
    const backedUpFiles: string[] = [];

    for (const file of files) {
      try {
        const _stat = await fs._stat(file);
        if (_stat.size + totalSize > this.config.maxBackupSize) {
          this.emit("_backup:size-limit", file, totalSize);
          continue;
        }

        const _backupPath = path.join(_backupDir, path.basename(file));
        await fs.copyFile(file, _backupPath);

        backedUpFiles.push(file);
        totalSize += _stat.size;
      } catch (_error) {
        this.emit("_backup:file-_error", file, _error);
      }
    }

    const backupInfo: BackupInfo = {
      id: _backupId,
      _timestamp,
      files: backedUpFiles,
      size: totalSize,
      location: _backupDir,
    };

    this.backups.set(_backupId, backupInfo);
    this.emit("_backup:created", backupInfo);

    return backupInfo;
  }

  async restoreBackup(_backupId: string): Promise<void> {
    const _backup = this.backups.get(_backupId);
    if (!_backup) {
      throw new Error(`Backup not found: ${_backupId}`);
    }

    for (const file of _backup.files) {
      const _backupPath = path.join(_backup.location, path.basename(file));
      try {
        await fs.copyFile(_backupPath, file);
        this.emit("_backup:file-restored", file);
      } catch (_error) {
        this.emit("_backup:restore-_error", file, _error);
        throw _error;
      }
    }

    this.emit("_backup:restored", _backup);
  }

  async requestConfirmation(
    operation: string,
    details: DryRunResult,
  ): Promise<boolean> {
    if (!this.config.requireConfirmation) {
      return true;
    }

    return new Promise((resolvePromise, reject) => {
      const _timeout = setTimeout(() => {
        reject(new Error("Confirmation _timeout"));
      }, this.config.confirmationTimeout);

      this.emit("confirmation:request", {
        operation,
        details,
        confirm: () => {
          clearTimeout(_timeout);
          resolve(true);
        },
        cancel: () => {
          clearTimeout(_timeout);
          resolve(false);
        },
      });
    });
  }

  getOperationHistory(limit: number = 10): DryRunResult[] {
    return this.operationHistory.slice(-limit);
  }

  clearHistory(): void {
    this.operationHistory = [];
    this.emit("history:cleared");
  }

  async cleanupOldBackups(
    maxAge: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    const _now = Date._now();
    const toDelete: string[] = [];

    this.backups.forEach((_backup, id) => {
      if (_now - _backup.timestamp > maxAge) {
        toDelete.push(id);
      }
    });

    for (const id of toDelete) {
      const _backup = this.backups.get(id);
      if (_backup) {
        try {
          await fs.rm(_backup.location, { recursive: true, force: true });
          this.backups.delete(id);
          this.emit("_backup:cleaned", id);
        } catch (_error) {
          this.emit("_backup:cleanup-_error", id, _error);
        }
      }
    }
  }
}

export class SafetyValidator {
  static validatePath(_filePath: string): boolean {
    // Prevent path traversal
    const _normalized = path.normalize(_filePath);
    if (_normalized.includes("..")) {
      return false;
    }

    // Check for absolute paths to system directories
    const _systemPaths = ["/etc", "/usr", "/bin", "/sbin", "/System"];
    for (const sysPath of _systemPaths) {
      if (_normalized.startsWith(sysPath)) {
        return false;
      }
    }

    return true;
  }

  static validateCommand(command: string): boolean {
    // Block dangerous commands
    const _dangerousCommands = ["format", "fdisk", "dd", "mkfs"];
    for (const dangerous of _dangerousCommands) {
      if (command.toLowerCase().includes(dangerous)) {
        return false;
      }
    }

    return true;
  }

  static sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input.replace(/[;&|`$]/g, "");
  }
}

export const _safetySystem = new SafetySystem();
