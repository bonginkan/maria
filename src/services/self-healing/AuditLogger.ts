/**
 * Audit Logger
 * Secure logging for self-healing operations with sensitive data masking
 */

import { logger } from "../../utils/logger";
import { HealingPlan, Issue, HealResult, FixAction } from "./types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export interface AuditEntry {
  id: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  operation: "diagnose" | "plan" | "execute" | "rollback" | "validate";
  status: "started" | "completed" | "failed" | "aborted";
  details: AuditDetails;
  metadata: {
    version: string;
    environment: string;
    riskScore?: number;
    executionTime?: number;
  };
}

export interface AuditDetails {
  // Diagnosis phase
  issues?: Issue[];
  diagnostics?: any;

  // Planning phase
  plan?: Partial<HealingPlan>; // Sanitized version
  recipesUsed?: string[];

  // Execution phase
  actions?: Partial<FixAction>[]; // Sanitized versions
  results?: any[];
  checkpointId?: string;

  // Error information
  error?: string;
  stackTrace?: string;

  // User interaction
  userApproval?: boolean;
  userOverrides?: string[];
}

export interface AuditLogOptions {
  logDir?: string;
  maxLogSize?: number; // Max size per log file (bytes)
  maxLogFiles?: number; // Max number of log files to keep
  rotateDaily?: boolean; // Rotate logs daily
  sensitiveFields?: string[]; // Additional fields to mask
}

const DEFAULT_SENSITIVE_FIELDS = [
  "apiKey",
  "api_key",
  "token",
  "password",
  "secret",
  "auth",
  "key",
  "credential",
  "bearer",
  "authorization",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "GROQ_API_KEY",
  "XAI_API_KEY",
];

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{32,}/g, // OpenAI API keys
  /sk-ant-[a-zA-Z0-9-]{95}/g, // Anthropic API keys
  /AIza[a-zA-Z0-9-_]{35}/g, // Google API keys
  /gsk_[a-zA-Z0-9]{52}/g, // Groq API keys
  /xai-[a-zA-Z0-9]{64}/g, // xAI API keys
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email addresses
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
];

export class AuditLogger {
  private options: Required<AuditLogOptions>;
  private sessionId: string;
  private logFilePath: string;
  private currentLogSize = 0;

  constructor(sessionId: string, options: AuditLogOptions = {}) {
    this.sessionId = sessionId;
    this.options = {
      logDir: path.join(os.homedir(), ".maria", "audit"),
      maxLogSize: 10 * 1024 * 1024, // 10MB
      maxLogFiles: 30, // 30 files
      rotateDaily: true,
      sensitiveFields: DEFAULT_SENSITIVE_FIELDS,
      ...options,
    };

    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    this.logFilePath = path.join(this.options.logDir, `audit-${date}.jsonl`);
  }

  /**
   * Initialize audit logging
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.options.logDir, { recursive: true });

      // Check current log file size
      try {
        const stats = await fs.stat(this.logFilePath);
        this.currentLogSize = stats.size;
      } catch {
        // Log file doesn't exist yet
        this.currentLogSize = 0;
      }

      logger.debug(`AuditLogger: Initialized for session ${this.sessionId}`);
    } catch (error) {
      logger.error("AuditLogger: Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Log diagnosis operation
   */
  async logDiagnosis(
    operation: "started" | "completed" | "failed",
    details: {
      issues?: Issue[];
      diagnostics?: any;
      error?: string;
      executionTime?: number;
    },
  ): Promise<void> {
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      operation: "diagnose",
      status: operation,
      details: {
        issues: details.issues
          ? this.sanitizeIssues(details.issues)
          : undefined,
        diagnostics: details.diagnostics
          ? this.sanitizeData(details.diagnostics)
          : undefined,
        error: details.error,
      },
      metadata: {
        version: this.getVersion(),
        environment: this.getEnvironment(),
        executionTime: details.executionTime,
      },
    };

    await this.writeAuditEntry(entry);
  }

  /**
   * Log planning operation
   */
  async logPlanning(
    operation: "started" | "completed" | "failed",
    details: {
      issues?: Issue[];
      plan?: HealingPlan;
      recipesUsed?: string[];
      error?: string;
      executionTime?: number;
    },
  ): Promise<void> {
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      operation: "plan",
      status: operation,
      details: {
        issues: details.issues
          ? this.sanitizeIssues(details.issues)
          : undefined,
        plan: details.plan ? this.sanitizePlan(details.plan) : undefined,
        recipesUsed: details.recipesUsed,
        error: details.error,
      },
      metadata: {
        version: this.getVersion(),
        environment: this.getEnvironment(),
        riskScore: details.plan?.risk.score,
        executionTime: details.executionTime,
      },
    };

    await this.writeAuditEntry(entry);
  }

  /**
   * Log execution operation
   */
  async logExecution(
    operation: "started" | "completed" | "failed" | "aborted",
    details: {
      plan?: HealingPlan;
      actions?: FixAction[];
      results?: any[];
      checkpointId?: string;
      userApproval?: boolean;
      userOverrides?: string[];
      error?: string;
      executionTime?: number;
    },
  ): Promise<void> {
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      operation: "execute",
      status: operation,
      details: {
        plan: details.plan ? this.sanitizePlan(details.plan) : undefined,
        actions: details.actions
          ? this.sanitizeActions(details.actions)
          : undefined,
        results: details.results
          ? this.sanitizeData(details.results)
          : undefined,
        checkpointId: details.checkpointId,
        userApproval: details.userApproval,
        userOverrides: details.userOverrides,
        error: details.error,
      },
      metadata: {
        version: this.getVersion(),
        environment: this.getEnvironment(),
        riskScore: details.plan?.risk.score,
        executionTime: details.executionTime,
      },
    };

    await this.writeAuditEntry(entry);
  }

  /**
   * Log rollback operation
   */
  async logRollback(
    operation: "started" | "completed" | "failed",
    details: {
      checkpointId: string;
      results?: HealResult;
      selective?: string[];
      error?: string;
      executionTime?: number;
    },
  ): Promise<void> {
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      operation: "rollback",
      status: operation,
      details: {
        checkpointId: details.checkpointId,
        results: details.results
          ? this.sanitizeData(details.results)
          : undefined,
        userOverrides: details.selective,
        error: details.error,
      },
      metadata: {
        version: this.getVersion(),
        environment: this.getEnvironment(),
        executionTime: details.executionTime,
      },
    };

    await this.writeAuditEntry(entry);
  }

  /**
   * Log validation operation
   */
  async logValidation(
    operation: "started" | "completed" | "failed",
    details: {
      type: string;
      target: string;
      result?: any;
      error?: string;
      executionTime?: number;
    },
  ): Promise<void> {
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      operation: "validate",
      status: operation,
      details: {
        diagnostics: {
          type: details.type,
          target: details.target,
          result: details.result
            ? this.sanitizeData(details.result)
            : undefined,
        },
        error: details.error,
      },
      metadata: {
        version: this.getVersion(),
        environment: this.getEnvironment(),
        executionTime: details.executionTime,
      },
    };

    await this.writeAuditEntry(entry);
  }

  /**
   * Get audit summary for session
   */
  async getSessionSummary(): Promise<{
    entries: number;
    operations: Record<string, number>;
    errors: number;
    totalExecutionTime: number;
  }> {
    try {
      const entries = await this.readAuditEntries();
      const sessionEntries = entries.filter(
        (e) => e.sessionId === this.sessionId,
      );

      const operations: Record<string, number> = {};
      let errors = 0;
      let totalExecutionTime = 0;

      for (const entry of sessionEntries) {
        operations[entry.operation] = (operations[entry.operation] || 0) + 1;
        if (entry.status === "failed") errors++;
        if (entry.metadata.executionTime) {
          totalExecutionTime += entry.metadata.executionTime;
        }
      }

      return {
        entries: sessionEntries.length,
        operations,
        errors,
        totalExecutionTime,
      };
    } catch (error) {
      logger.error("AuditLogger: Failed to get session summary:", error);
      return { entries: 0, operations: {}, errors: 0, totalExecutionTime: 0 };
    }
  }

  /**
   * Write audit entry to log file
   */
  private async writeAuditEntry(entry: AuditEntry): Promise<void> {
    try {
      const logLine = JSON.stringify(entry) + "\n";

      // Check if we need to rotate log
      if (this.shouldRotateLog(logLine.length)) {
        await this.rotateLog();
      }

      await fs.appendFile(this.logFilePath, logLine, "utf-8");
      this.currentLogSize += logLine.length;

      logger.debug(
        `AuditLogger: Logged ${entry.operation} operation (${entry.status})`,
      );
    } catch (error) {
      logger.error("AuditLogger: Failed to write audit entry:", error);
      // Don't throw - audit logging should not break operations
    }
  }

  /**
   * Sanitize issues array
   */
  private sanitizeIssues(issues: Issue[]): any[] {
    return issues.map((issue) => ({
      id: issue.id,
      type: issue.type,
      severity: issue.severity,
      category: issue.category || "general",
      title: issue.title,
      // Don't log full details which might contain sensitive data
      detailsPreview: this.sanitizeString(
        JSON.stringify(issue.details || {}).substring(0, 100),
      ),
    }));
  }

  /**
   * Sanitize healing plan
   */
  private sanitizePlan(plan: HealingPlan): any {
    return {
      id: plan.id,
      issueIds: plan.issueIds,
      recipeIds: plan.recipeIds,
      risk: plan.risk,
      estimatedDuration: plan.estimatedDuration,
      requiresApproval: plan.requiresApproval,
      actions: this.sanitizeActions(plan.actions),
    };
  }

  /**
   * Sanitize actions array
   */
  private sanitizeActions(actions: FixAction[]): any[] {
    return actions.map((action) => ({
      type: action.type,
      args: this.sanitizeData(action.args),
    }));
  }

  /**
   * Sanitize data object recursively
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) return data;

    if (typeof data === "string") {
      return this.sanitizeString(data);
    }

    if (typeof data === "object") {
      if (Array.isArray(data)) {
        return data.map((item) => this.sanitizeData(item));
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveField(key)) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Sanitize string content
   */
  private sanitizeString(str: string): string {
    let sanitized = str;

    // Apply sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }

    return sanitized;
  }

  /**
   * Check if field name is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerName = fieldName.toLowerCase();
    return this.options.sensitiveFields.some((sensitive) =>
      lowerName.includes(sensitive.toLowerCase()),
    );
  }

  /**
   * Check if log should be rotated
   */
  private shouldRotateLog(newContentSize: number): boolean {
    return this.currentLogSize + newContentSize > this.options.maxLogSize;
  }

  /**
   * Rotate log file
   */
  private async rotateLog(): Promise<void> {
    try {
      const date = new Date().toISOString().split("T")[0];
      const timestamp = Date.now();
      const archivePath = path.join(
        this.options.logDir,
        `audit-${date}-${timestamp}.jsonl`,
      );

      await fs.rename(this.logFilePath, archivePath);
      this.currentLogSize = 0;

      // Clean up old log files
      await this.cleanupOldLogs();

      logger.debug(`AuditLogger: Rotated log file to ${archivePath}`);
    } catch (error) {
      logger.warn("AuditLogger: Failed to rotate log file:", error);
    }
  }

  /**
   * Read audit entries from current log
   */
  private async readAuditEntries(): Promise<AuditEntry[]> {
    try {
      const content = await fs.readFile(this.logFilePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      return lines
        .map((line) => {
          try {
            return JSON.parse(line) as AuditEntry;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as AuditEntry[];
    } catch {
      return [];
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const entries = await fs.readdir(this.options.logDir);
      const logFiles = entries
        .filter((name) => name.startsWith("audit-") && name.endsWith(".jsonl"))
        .sort()
        .reverse(); // Newest first

      if (logFiles.length > this.options.maxLogFiles) {
        const toRemove = logFiles.slice(this.options.maxLogFiles);

        for (const file of toRemove) {
          const filePath = path.join(this.options.logDir, file);
          await fs.unlink(filePath);
          logger.debug(`AuditLogger: Removed old log file ${file}`);
        }
      }
    } catch (error) {
      logger.warn("AuditLogger: Failed to cleanup old logs:", error);
    }
  }

  /**
   * Generate unique ID for audit entry
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current version
   */
  private getVersion(): string {
    try {
      const packageJson = require("../../../package.json");
      return packageJson.version || "unknown";
    } catch {
      return "unknown";
    }
  }

  /**
   * Get current environment
   */
  private getEnvironment(): string {
    return process.env.NODE_ENV || "development";
  }
}
