/**
 * Model Selector v2 - Security Hooks System
 * Comprehensive RBAC, audit logging, and compliance integration
 */

import { EventEmitter } from "node:events";
import crypto from "crypto";
import type { ModelInfo, AuditEvent, ModelSelectorEvent } from "../types/index";

export interface SecurityConfig {
  rbac: {
    enabled: boolean;
    strictMode: boolean;
    defaultRole: string;
    roles: Record<string, RoleDefinition>;
  };
  audit: {
    enabled: boolean;
    logLevel: "basic" | "detailed" | "verbose";
    retention: {
      enabled: boolean;
      days: number;
    };
    storage: {
      type: "memory" | "file" | "database";
      path?: string;
      encrypted: boolean;
    };
  };
  compliance: {
    standards: ("GDPR" | "HIPAA" | "SOX" | "PCI")[];
    dataClassification: boolean;
    anonymization: boolean;
    retention: {
      personalData: number; // days
      auditLogs: number; // days
      metrics: number; // days
    };
  };
  encryption: {
    algorithm: string;
    keyRotation: {
      enabled: boolean;
      intervalDays: number;
    };
  };
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
    byUser: boolean;
  };
}

export interface RoleDefinition {
  name: string;
  permissions: Permission[];
  restrictions: ModelRestriction[];
  inherits?: string[];
}

export interface Permission {
  resource: "model" | "provider" | "session" | "metrics" | "admin";
  actions: ("read" | "write" | "execute" | "delete" | "admin")[];
  conditions?: PermissionCondition[];
}

export interface ModelRestriction {
  type: "provider" | "model" | "cost" | "capability" | "region";
  operator: "allow" | "deny" | "limit";
  value: any;
  reason?: string;
}

export interface PermissionCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "in" | "contains";
  value: any;
}

export interface SecurityContext {
  userId: string;
  sessionId: string;
  roles: string[];
  permissions: Permission[];
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface SecurityViolation {
  type:
    | "access_denied"
    | "rate_limit"
    | "invalid_operation"
    | "data_breach"
    | "compliance_violation";
  severity: "low" | "medium" | "high" | "critical";
  userId: string;
  operation: string;
  reason: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class SecurityHooks extends EventEmitter {
  private config: SecurityConfig;
  private auditLog: AuditEvent[] = [];
  private violations: SecurityViolation[] = [];
  private rateLimitTracker: Map<string, { count: number; resetTime: number }> =
    new Map();
  private encryptionKey: Buffer;
  private keyRotationTimer?: NodeJS.Timeout;

  constructor(config: Partial<SecurityConfig> = {}) {
    super();

    this.config = this.mergeDefaultConfig(config);
    this.encryptionKey = this.generateEncryptionKey();

    this.setupKeyRotation();
    this.setupCleanupSchedule();

    this.emit("security_initialized", {
      config: this.sanitizeConfig(this.config),
      timestamp: new Date(),
    });
  }

  /**
   * Check if user has permission to perform an operation
   */
  async checkPermission(
    context: SecurityContext,
    resource: string,
    action: string,
    targetData?: any,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    restrictions?: ModelRestriction[];
  }> {
    if (!this.config.rbac.enabled) {
      return { allowed: true };
    }

    try {
      // Rate limiting check
      if (this.config.rateLimit.enabled) {
        const rateLimitResult = this.checkRateLimit(context.userId);
        if (!rateLimitResult.allowed) {
          await this.logViolation({
            type: "rate_limit",
            severity: "medium",
            userId: context.userId,
            operation: `${resource}:${action}`,
            reason: rateLimitResult.reason || "Rate limit exceeded",
            timestamp: new Date(),
          });

          return { allowed: false, reason: rateLimitResult.reason };
        }
      }

      // Check user permissions
      const hasPermission = this.evaluatePermissions(
        context,
        resource,
        action,
        targetData,
      );

      if (!hasPermission.allowed) {
        await this.logViolation({
          type: "access_denied",
          severity: "high",
          userId: context.userId,
          operation: `${resource}:${action}`,
          reason: hasPermission.reason || "Insufficient permissions",
          timestamp: new Date(),
          metadata: { targetData },
        });
      }

      // Audit the permission check
      await this.auditPermissionCheck(
        context,
        resource,
        action,
        hasPermission.allowed,
      );

      return hasPermission;
    } catch (error) {
      await this.logViolation({
        type: "invalid_operation",
        severity: "medium",
        userId: context.userId,
        operation: `${resource}:${action}`,
        reason: `Permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      });

      // Fail secure - deny access on error
      return {
        allowed: false,
        reason: "Security check failed - access denied",
      };
    }
  }

  /**
   * Check if user can access specific model
   */
  async checkModelAccess(
    context: SecurityContext,
    model: ModelInfo,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    restrictions?: ModelRestriction[];
  }> {
    if (!this.config.rbac.enabled) {
      return { allowed: true };
    }

    const userRoles = context.roles;
    const restrictions: ModelRestriction[] = [];

    // Collect all restrictions from user roles
    for (const roleName of userRoles) {
      const role = this.config.rbac.roles[roleName];
      if (role?.restrictions) {
        restrictions.push(...role.restrictions);
      }
    }

    // Evaluate restrictions against the model
    for (const restriction of restrictions) {
      const violation = this.evaluateRestriction(restriction, model);
      if (violation) {
        await this.auditModelAccess(context, model, false, violation);
        return {
          allowed: false,
          reason: violation,
          restrictions: [restriction],
        };
      }
    }

    await this.auditModelAccess(context, model, true);
    return { allowed: true, restrictions };
  }

  /**
   * Filter models based on user access rights
   */
  async filterModelsForUser(
    context: SecurityContext,
    models: ModelInfo[],
  ): Promise<ModelInfo[]> {
    if (!this.config.rbac.enabled) {
      return models;
    }

    const filteredModels: ModelInfo[] = [];

    for (const model of models) {
      const access = await this.checkModelAccess(context, model);
      if (access.allowed) {
        filteredModels.push(model);
      }
    }

    // Audit the filtering operation
    await this.auditModelFilter(context, models.length, filteredModels.length);

    return filteredModels;
  }

  /**
   * Log security-related events
   */
  async logSecurityEvent(
    event: ModelSelectorEvent,
    context: SecurityContext,
  ): Promise<void> {
    if (!this.config.audit.enabled) return;

    const auditEvent: AuditEvent = {
      event: `security.${event.type}`,
      userId: context.userId,
      modelId: event.modelId,
      timestamp: event.timestamp,
      metadata: {
        sessionId: context.sessionId,
        duration: event.duration,
        success: event.success,
        ipAddress: context.ipAddress
          ? this.hashPII(context.ipAddress)
          : undefined,
        userAgent: context.userAgent
          ? this.hashPII(context.userAgent)
          : undefined,
        error: event.error,
      },
    };

    await this.recordAuditEvent(auditEvent);
  }

  /**
   * Validate data for compliance requirements
   */
  validateCompliance(
    data: any,
    classification: "public" | "internal" | "confidential" | "restricted",
  ): {
    valid: boolean;
    violations: string[];
    sanitizedData?: any;
  } {
    const violations: string[] = [];
    let sanitizedData = { ...data };

    // GDPR compliance checks
    if (this.config.compliance.standards.includes("GDPR")) {
      const gdprViolations = this.checkGDPRCompliance(data);
      violations.push(...gdprViolations);

      if (this.config.compliance.anonymization && classification !== "public") {
        sanitizedData = this.anonymizePersonalData(sanitizedData);
      }
    }

    // HIPAA compliance checks
    if (this.config.compliance.standards.includes("HIPAA")) {
      const hipaaViolations = this.checkHIPAACompliance(data);
      violations.push(...hipaaViolations);
    }

    // SOX compliance checks
    if (this.config.compliance.standards.includes("SOX")) {
      const soxViolations = this.checkSOXCompliance(data);
      violations.push(...soxViolations);
    }

    return {
      valid: violations.length === 0,
      violations,
      sanitizedData: violations.length === 0 ? data : sanitizedData,
    };
  }

  /**
   * Get security metrics and audit summary
   */
  getSecurityMetrics(): {
    auditEvents: number;
    violations: number;
    violationsByType: Record<string, number>;
    rateLimitHits: number;
    complianceStatus: Record<string, boolean>;
    encryptionStatus: {
      keyAge: number;
      nextRotation?: Date;
    };
  } {
    const violationsByType: Record<string, number> = {};
    for (const violation of this.violations) {
      violationsByType[violation.type] =
        (violationsByType[violation.type] || 0) + 1;
    }

    return {
      auditEvents: this.auditLog.length,
      violations: this.violations.length,
      violationsByType,
      rateLimitHits: Array.from(this.rateLimitTracker.values()).length,
      complianceStatus: this.getComplianceStatus(),
      encryptionStatus: this.getEncryptionStatus(),
    };
  }

  /**
   * Export audit logs with encryption
   */
  async exportAuditLogs(startDate?: Date, endDate?: Date): Promise<string> {
    let logs = this.auditLog;

    if (startDate || endDate) {
      logs = this.auditLog.filter((log) => {
        const logTime = log.timestamp.getTime();
        if (startDate && logTime < startDate.getTime()) return false;
        if (endDate && logTime > endDate.getTime()) return false;
        return true;
      });
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalEvents: logs.length,
      events: logs,
      compliance: {
        standards: this.config.compliance.standards,
        anonymized: this.config.compliance.anonymization,
      },
    };

    const jsonData = JSON.stringify(exportData, null, 2);

    if (this.config.audit.storage.encrypted) {
      return this.encrypt(jsonData);
    }

    return jsonData;
  }

  /**
   * Cleanup old audit logs and violations based on retention policy
   */
  async cleanup(): Promise<{
    auditLogsRemoved: number;
    violationsRemoved: number;
  }> {
    const now = new Date();
    const auditRetentionMs =
      this.config.compliance.retention.auditLogs * 24 * 60 * 60 * 1000;
    const auditCutoff = new Date(now.getTime() - auditRetentionMs);

    const initialAuditCount = this.auditLog.length;
    this.auditLog = this.auditLog.filter((log) => log.timestamp >= auditCutoff);
    const auditLogsRemoved = initialAuditCount - this.auditLog.length;

    const initialViolationCount = this.violations.length;
    this.violations = this.violations.filter(
      (violation) => violation.timestamp >= auditCutoff,
    );
    const violationsRemoved = initialViolationCount - this.violations.length;

    this.emit("cleanup_completed", {
      auditLogsRemoved,
      violationsRemoved,
      timestamp: now,
    });

    return { auditLogsRemoved, violationsRemoved };
  }

  // Private methods

  private mergeDefaultConfig(config: Partial<SecurityConfig>): SecurityConfig {
    const defaultConfig: SecurityConfig = {
      rbac: {
        enabled: false,
        strictMode: false,
        defaultRole: "user",
        roles: {
          admin: {
            name: "Administrator",
            permissions: [
              {
                resource: "model",
                actions: ["read", "write", "execute", "delete", "admin"],
              },
              {
                resource: "provider",
                actions: ["read", "write", "execute", "admin"],
              },
              {
                resource: "session",
                actions: ["read", "write", "admin"],
              },
              {
                resource: "metrics",
                actions: ["read", "admin"],
              },
            ],
            restrictions: [],
          },
          user: {
            name: "Regular User",
            permissions: [
              {
                resource: "model",
                actions: ["read", "execute"],
              },
              {
                resource: "session",
                actions: ["read", "write"],
              },
            ],
            restrictions: [],
          },
        },
      },
      audit: {
        enabled: true,
        logLevel: "basic",
        retention: {
          enabled: true,
          days: 90,
        },
        storage: {
          type: "memory",
          encrypted: true,
        },
      },
      compliance: {
        standards: [],
        dataClassification: false,
        anonymization: false,
        retention: {
          personalData: 30,
          auditLogs: 90,
          metrics: 365,
        },
      },
      encryption: {
        algorithm: "aes-256-gcm",
        keyRotation: {
          enabled: false,
          intervalDays: 90,
        },
      },
      rateLimit: {
        enabled: false,
        maxRequests: 100,
        windowMs: 60000,
        byUser: true,
      },
    };

    return this.deepMerge(defaultConfig, config);
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  private evaluatePermissions(
    context: SecurityContext,
    resource: string,
    action: string,
    targetData?: any,
  ): { allowed: boolean; reason?: string } {
    for (const permission of context.permissions) {
      if (
        permission.resource === resource &&
        permission.actions.includes(action as any)
      ) {
        // Check conditions if any
        if (permission.conditions) {
          for (const condition of permission.conditions) {
            if (!this.evaluateCondition(condition, targetData)) {
              continue;
            }
          }
        }

        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `No permission for ${action} on ${resource}`,
    };
  }

  private evaluateCondition(
    condition: PermissionCondition,
    data: any,
  ): boolean {
    if (!data || !data[condition.field]) {
      return false;
    }

    const fieldValue = data[condition.field];
    const conditionValue = condition.value;

    switch (condition.operator) {
      case "eq":
        return fieldValue === conditionValue;
      case "neq":
        return fieldValue !== conditionValue;
      case "gt":
        return fieldValue > conditionValue;
      case "lt":
        return fieldValue < conditionValue;
      case "in":
        return (
          Array.isArray(conditionValue) && conditionValue.includes(fieldValue)
        );
      case "contains":
        return String(fieldValue).includes(String(conditionValue));
      default:
        return false;
    }
  }

  private evaluateRestriction(
    restriction: ModelRestriction,
    model: ModelInfo,
  ): string | null {
    switch (restriction.type) {
      case "provider":
        if (
          restriction.operator === "deny" &&
          model.provider === restriction.value
        ) {
          return (
            restriction.reason || `Provider ${restriction.value} is restricted`
          );
        }
        if (
          restriction.operator === "allow" &&
          model.provider !== restriction.value
        ) {
          return (
            restriction.reason ||
            `Only provider ${restriction.value} is allowed`
          );
        }
        break;

      case "model":
        if (restriction.operator === "deny" && model.id === restriction.value) {
          return (
            restriction.reason || `Model ${restriction.value} is restricted`
          );
        }
        break;

      case "cost":
        const totalCost = model.price.input + model.price.output;
        if (restriction.operator === "limit" && totalCost > restriction.value) {
          return (
            restriction.reason ||
            `Model cost exceeds limit of ${restriction.value}`
          );
        }
        break;

      case "capability":
        if (
          restriction.operator === "deny" &&
          model.capabilities.includes(restriction.value)
        ) {
          return (
            restriction.reason ||
            `Capability ${restriction.value} is restricted`
          );
        }
        break;
    }

    return null;
  }

  private checkRateLimit(userId: string): {
    allowed: boolean;
    reason?: string;
  } {
    if (!this.config.rateLimit.enabled) {
      return { allowed: true };
    }

    const key = this.config.rateLimit.byUser ? userId : "global";
    const now = Date.now();
    const windowStart = now - this.config.rateLimit.windowMs;

    let tracker = this.rateLimitTracker.get(key);
    if (!tracker || tracker.resetTime < windowStart) {
      tracker = { count: 0, resetTime: now + this.config.rateLimit.windowMs };
      this.rateLimitTracker.set(key, tracker);
    }

    tracker.count++;

    if (tracker.count > this.config.rateLimit.maxRequests) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${tracker.count}/${this.config.rateLimit.maxRequests} requests`,
      };
    }

    return { allowed: true };
  }

  private async recordAuditEvent(event: AuditEvent): Promise<void> {
    this.auditLog.push(event);

    // Limit audit log size in memory
    if (this.auditLog.length > 10000) {
      this.auditLog.shift();
    }

    this.emit("audit_event", event);
  }

  private async logViolation(violation: SecurityViolation): Promise<void> {
    this.violations.push(violation);

    // Limit violations in memory
    if (this.violations.length > 1000) {
      this.violations.shift();
    }

    this.emit("security_violation", violation);

    // Auto-escalate critical violations
    if (violation.severity === "critical") {
      this.emit("critical_security_violation", violation);
    }
  }

  private async auditPermissionCheck(
    context: SecurityContext,
    resource: string,
    action: string,
    allowed: boolean,
  ): Promise<void> {
    await this.recordAuditEvent({
      event: "security.permission_check",
      userId: context.userId,
      timestamp: new Date(),
      metadata: {
        resource,
        action,
        allowed,
        sessionId: context.sessionId,
      },
    });
  }

  private async auditModelAccess(
    context: SecurityContext,
    model: ModelInfo,
    allowed: boolean,
    reason?: string,
  ): Promise<void> {
    await this.recordAuditEvent({
      event: "security.model_access",
      userId: context.userId,
      modelId: model.id,
      provider: model.provider,
      timestamp: new Date(),
      metadata: {
        allowed,
        reason,
        sessionId: context.sessionId,
      },
    });
  }

  private async auditModelFilter(
    context: SecurityContext,
    totalModels: number,
    filteredModels: number,
  ): Promise<void> {
    await this.recordAuditEvent({
      event: "security.model_filter",
      userId: context.userId,
      timestamp: new Date(),
      metadata: {
        totalModels,
        filteredModels,
        filtered: totalModels - filteredModels,
        sessionId: context.sessionId,
      },
    });
  }

  private checkGDPRCompliance(data: any): string[] {
    const violations: string[] = [];

    // Check for potential personal data
    const personalDataFields = ["email", "name", "phone", "address", "ip"];
    for (const field of personalDataFields) {
      if (data[field] && !this.isAnonymized(data[field])) {
        violations.push(
          `Personal data field '${field}' requires anonymization for GDPR compliance`,
        );
      }
    }

    return violations;
  }

  private checkHIPAACompliance(data: any): string[] {
    const violations: string[] = [];

    // Check for potential health information
    const healthFields = ["medical", "health", "diagnosis", "treatment"];
    for (const field of healthFields) {
      if (data[field]) {
        violations.push(
          `Health-related field '${field}' requires special handling for HIPAA compliance`,
        );
      }
    }

    return violations;
  }

  private checkSOXCompliance(data: any): string[] {
    const violations: string[] = [];

    // Check for financial data
    if (data.financial || data.revenue || data.cost) {
      violations.push("Financial data requires audit trail for SOX compliance");
    }

    return violations;
  }

  private anonymizePersonalData(data: any): any {
    const anonymized = { ...data };
    const personalFields = ["email", "name", "phone", "address", "ip"];

    for (const field of personalFields) {
      if (anonymized[field]) {
        anonymized[field] = this.hashPII(anonymized[field]);
      }
    }

    return anonymized;
  }

  private hashPII(data: string): string {
    return (
      crypto.createHash("sha256").update(data).digest("hex").substring(0, 16) +
      "..."
    );
  }

  private isAnonymized(data: string): boolean {
    return data.endsWith("...") && data.length <= 19;
  }

  private generateEncryptionKey(): Buffer {
    return crypto.randomBytes(32);
  }

  private encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(
      this.config.encryption.algorithm,
      this.encryptionKey,
    );
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  private setupKeyRotation(): void {
    if (!this.config.encryption.keyRotation.enabled) return;

    const intervalMs =
      this.config.encryption.keyRotation.intervalDays * 24 * 60 * 60 * 1000;

    this.keyRotationTimer = setInterval(() => {
      this.rotateEncryptionKey();
    }, intervalMs);
  }

  private rotateEncryptionKey(): void {
    const oldKey = this.encryptionKey;
    this.encryptionKey = this.generateEncryptionKey();

    this.emit("key_rotated", {
      timestamp: new Date(),
      oldKeyHash: crypto
        .createHash("sha256")
        .update(oldKey)
        .digest("hex")
        .substring(0, 16),
    });
  }

  private setupCleanupSchedule(): void {
    // Run cleanup every 24 hours
    setInterval(
      () => {
        this.cleanup();
      },
      24 * 60 * 60 * 1000,
    );
  }

  private getComplianceStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};

    for (const standard of this.config.compliance.standards) {
      switch (standard) {
        case "GDPR":
          status.GDPR =
            this.config.compliance.anonymization && this.config.audit.enabled;
          break;
        case "HIPAA":
          status.HIPAA =
            this.config.audit.storage.encrypted && this.config.rbac.enabled;
          break;
        case "SOX":
          status.SOX =
            this.config.audit.enabled && this.config.audit.retention.enabled;
          break;
        case "PCI":
          status.PCI =
            this.config.audit.storage.encrypted &&
            this.config.encryption.keyRotation.enabled;
          break;
      }
    }

    return status;
  }

  private getEncryptionStatus(): { keyAge: number; nextRotation?: Date } {
    const keyAge = Date.now() - this.startTime.getTime();
    let nextRotation: Date | undefined;

    if (this.config.encryption.keyRotation.enabled) {
      const intervalMs =
        this.config.encryption.keyRotation.intervalDays * 24 * 60 * 60 * 1000;
      nextRotation = new Date(this.startTime.getTime() + intervalMs);
    }

    return { keyAge, nextRotation };
  }

  private sanitizeConfig(config: SecurityConfig): any {
    // Remove sensitive information from config for logging
    const sanitized = JSON.parse(JSON.stringify(config));

    // Remove encryption keys, secrets, etc.
    delete sanitized.encryption;

    return sanitized;
  }

  private startTime = new Date();
}

export default SecurityHooks;
