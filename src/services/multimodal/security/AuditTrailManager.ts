/**
 * Audit Trail Manager - GDPR/HIPAA Compliant Logging
 * Comprehensive audit logging system for security and compliance
 *
 * Compliance Features:
 * - GDPR Article 30 (Record of processing activities)
 * - GDPR Article 17 (Right to erasure)
 * - HIPAA Security Rule (§164.308)
 * - SOC 2 Type II audit requirements
 * - Correlation ID tracking across all operations
 */

export interface AuditTrail {
  readonly id: string;
  readonly correlationId: string;
  readonly timestamp: Date;
  readonly userId?: string;
  readonly userRole?: string;
  readonly sessionId?: string;
  readonly operation: string;
  readonly resource: string;
  readonly dataClassification:
    | "public"
    | "internal"
    | "confidential"
    | "restricted";
  readonly legalBasis?:
    | "consent"
    | "contract"
    | "legal_obligation"
    | "legitimate_interest"
    | "vital_interests"
    | "public_task";
  readonly purpose: string;
  readonly dataSubjectId?: string; // For GDPR compliance
  readonly success: boolean;
  readonly errorMessage?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly geolocation?: {
    country: string;
    region?: string;
    city?: string;
  };
  readonly retentionPolicy: string;
  readonly metadata: Record<string, unknown>;
}

export interface DataOperationAudit {
  readonly correlationId: string;
  readonly operation:
    | "encrypt"
    | "decrypt"
    | "access"
    | "modify"
    | "delete"
    | "export"
    | "anonymize";
  readonly dataSize: number;
  readonly dataClassification:
    | "public"
    | "internal"
    | "confidential"
    | "restricted";
  readonly userId?: string;
  readonly keyId?: string;
  readonly success: boolean;
  readonly duration: number; // milliseconds
  readonly errorMessage?: string;
  readonly metadata: Record<string, unknown>;
}

export interface ExpressionEvaluationAudit {
  readonly correlationId: string;
  readonly expressionHash: string;
  readonly userId?: string;
  readonly purpose: string;
  readonly dataClassification: string;
  readonly success: boolean;
  readonly executionTime: number;
  readonly resultType?: string;
  readonly errorMessage?: string;
  readonly metadata: Record<string, unknown>;
}

export interface AccessControlAudit {
  readonly correlationId: string;
  readonly userId: string;
  readonly resource: string;
  readonly action: string;
  readonly decision: "allow" | "deny";
  readonly reason: string;
  readonly policyVersion: string;
  readonly contextData: Record<string, unknown>;
}

export interface ComplianceReport {
  readonly reportId: string;
  readonly reportType:
    | "gdpr_record"
    | "hipaa_audit"
    | "data_retention"
    | "access_summary";
  readonly period: {
    start: Date;
    end: Date;
  };
  readonly generatedAt: Date;
  readonly dataSubject?: string;
  readonly summary: {
    totalOperations: number;
    byOperation: Record<string, number>;
    byClassification: Record<string, number>;
    byUser: Record<string, number>;
    errors: number;
  };
  readonly details: AuditTrail[];
}

export interface AuditTrailManagerOptions {
  readonly storage: AuditStorage;
  readonly retention: RetentionPolicy;
  readonly encryption: boolean;
  readonly anonymization: AnonymizationConfig;
  readonly alerting: AlertingConfig;
}

export interface AuditStorage {
  store(audit: AuditTrail): Promise<void>;
  query(filters: AuditQueryFilters): Promise<AuditTrail[]>;
  delete(criteria: DeletionCriteria): Promise<number>; // Returns count of deleted records
  export(criteria: ExportCriteria): Promise<Buffer>; // GDPR export format
}

export interface AuditQueryFilters {
  readonly correlationId?: string;
  readonly userId?: string;
  readonly dataSubjectId?: string;
  readonly operation?: string;
  readonly resource?: string;
  readonly timeRange?: {
    start: Date;
    end: Date;
  };
  readonly classification?: string;
  readonly success?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface DeletionCriteria {
  readonly dataSubjectId: string;
  readonly reason:
    | "retention_expired"
    | "erasure_request"
    | "data_subject_request";
  readonly confirmedBy: string;
  readonly deletionDate: Date;
}

export interface ExportCriteria {
  readonly dataSubjectId: string;
  readonly format: "json" | "xml" | "csv";
  readonly includeMetadata: boolean;
  readonly requestedBy: string;
}

export interface RetentionPolicy {
  readonly defaultRetention: number; // days
  readonly byClassification: Record<string, number>;
  readonly legalHoldOverride: boolean;
}

export interface AnonymizationConfig {
  readonly enabled: boolean;
  readonly fieldsToAnonymize: string[];
  readonly anonymizationMethod: "hash" | "random" | "remove";
  readonly preserveAnalytics: boolean;
}

export interface AlertingConfig {
  readonly enabled: boolean;
  readonly thresholds: {
    errorRate: number; // percentage
    suspiciousActivity: number; // operations per minute
    dataVolumeSpike: number; // percentage increase
  };
  readonly webhooks: string[];
  readonly emailNotifications: string[];
}

export class AuditTrailManager {
  private readonly storage: AuditStorage;
  private readonly options: AuditTrailManagerOptions;

  constructor(options: AuditTrailManagerOptions) {
    this.options = options;
    this.storage = options.storage;
    this.validateOptions();
  }

  /**
   * Records a data operation audit entry
   */
  async recordDataOperation(audit: DataOperationAudit): Promise<void> {
    const auditTrail = this.createAuditTrail({
      correlationId: audit.correlationId,
      operation: `data_${audit.operation}`,
      resource: `data:${audit.dataClassification}`,
      dataClassification: audit.dataClassification,
      userId: audit.userId,
      success: audit.success,
      errorMessage: audit.errorMessage,
      purpose: `Data ${audit.operation} operation`,
      metadata: {
        ...audit.metadata,
        dataSize: audit.dataSize,
        duration: audit.duration,
        keyId: audit.keyId,
      },
    });

    await this.storeAudit(auditTrail);
    await this.checkAlerts(auditTrail);
  }

  /**
   * Records an expression evaluation audit entry
   */
  async recordExpressionEvaluation(
    audit: ExpressionEvaluationAudit,
  ): Promise<void> {
    const auditTrail = this.createAuditTrail({
      correlationId: audit.correlationId,
      operation: "expression_eval",
      resource: `expression:${audit.expressionHash}`,
      dataClassification: audit.dataClassification as any,
      userId: audit.userId,
      success: audit.success,
      errorMessage: audit.errorMessage,
      purpose: audit.purpose,
      metadata: {
        ...audit.metadata,
        expressionHash: audit.expressionHash,
        executionTime: audit.executionTime,
        resultType: audit.resultType,
      },
    });

    await this.storeAudit(auditTrail);
  }

  /**
   * Records an access control decision
   */
  async recordAccessControl(audit: AccessControlAudit): Promise<void> {
    const auditTrail = this.createAuditTrail({
      correlationId: audit.correlationId,
      operation: "access_control",
      resource: audit.resource,
      dataClassification: this.inferDataClassification(audit.resource),
      userId: audit.userId,
      success: audit.decision === "allow",
      purpose: `Access control for ${audit.action} on ${audit.resource}`,
      metadata: {
        action: audit.action,
        decision: audit.decision,
        reason: audit.reason,
        policyVersion: audit.policyVersion,
        contextData: audit.contextData,
      },
    });

    await this.storeAudit(auditTrail);

    // Alert on denied access attempts
    if (audit.decision === "deny") {
      await this.alertAccessDenied(auditTrail);
    }
  }

  /**
   * Queries audit trails with filtering
   */
  async queryAuditTrail(filters: AuditQueryFilters): Promise<AuditTrail[]> {
    return await this.storage.query(filters);
  }

  /**
   * Generates compliance report
   */
  async generateComplianceReport(
    reportType: ComplianceReport["reportType"],
    period: { start: Date; end: Date },
    dataSubject?: string,
  ): Promise<ComplianceReport> {
    const filters: AuditQueryFilters = {
      timeRange: period,
      ...(dataSubject && { dataSubjectId: dataSubject }),
    };

    const auditTrails = await this.storage.query(filters);

    const summary = this.calculateSummary(auditTrails);

    return {
      reportId: this.generateId(),
      reportType,
      period,
      generatedAt: new Date(),
      dataSubject,
      summary,
      details: auditTrails,
    };
  }

  /**
   * Handles GDPR erasure request (Right to be forgotten)
   */
  async handleErasureRequest(
    dataSubjectId: string,
    confirmedBy: string,
    reason: string = "data_subject_request",
  ): Promise<{
    deleted: number;
    anonymized: number;
    retained: number;
    retentionReason: string[];
  }> {
    const criteria: DeletionCriteria = {
      dataSubjectId,
      reason: reason as any,
      confirmedBy,
      deletionDate: new Date(),
    };

    // Check for legal holds
    const legalHolds = await this.checkLegalHolds(dataSubjectId);
    if (legalHolds.length > 0 && !this.options.retention.legalHoldOverride) {
      return {
        deleted: 0,
        anonymized: 0,
        retained: await this.countRecords(dataSubjectId),
        retentionReason: legalHolds,
      };
    }

    // Perform deletion
    const deleted = await this.storage.delete(criteria);

    // Log the erasure operation itself
    await this.recordDataOperation({
      correlationId: this.generateId(),
      operation: "delete",
      dataSize: 0,
      dataClassification: "restricted",
      userId: confirmedBy,
      success: true,
      duration: 0,
      metadata: {
        erasureRequest: true,
        dataSubjectId,
        deletedRecords: deleted,
      },
    });

    return {
      deleted,
      anonymized: 0,
      retained: 0,
      retentionReason: [],
    };
  }

  /**
   * Exports audit data for GDPR compliance
   */
  async exportAuditData(criteria: ExportCriteria): Promise<Buffer> {
    // Log the export request
    await this.recordDataOperation({
      correlationId: this.generateId(),
      operation: "export",
      dataSize: 0,
      dataClassification: "restricted",
      userId: criteria.requestedBy,
      success: true,
      duration: 0,
      metadata: {
        exportRequest: true,
        dataSubjectId: criteria.dataSubjectId,
        format: criteria.format,
      },
    });

    return await this.storage.export(criteria);
  }

  /**
   * Performs automatic retention policy cleanup
   */
  async performRetentionCleanup(): Promise<{
    evaluated: number;
    deleted: number;
    retained: number;
  }> {
    let evaluated = 0;
    let deleted = 0;
    let retained = 0;

    const now = new Date();

    // Check each classification's retention policy
    for (const [classification, retentionDays] of Object.entries(
      this.options.retention.byClassification,
    )) {
      const cutoffDate = new Date(
        now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
      );

      const filters: AuditQueryFilters = {
        classification,
        timeRange: { start: new Date(0), end: cutoffDate },
      };

      const expiredTrails = await this.storage.query(filters);
      evaluated += expiredTrails.length;

      for (const trail of expiredTrails) {
        if (trail.dataSubjectId) {
          const legalHolds = await this.checkLegalHolds(trail.dataSubjectId);
          if (legalHolds.length > 0) {
            retained++;
            continue;
          }
        }

        await this.storage.delete({
          dataSubjectId: trail.dataSubjectId || "system",
          reason: "retention_expired",
          confirmedBy: "system",
          deletionDate: now,
        });
        deleted++;
      }
    }

    return { evaluated, deleted, retained };
  }

  private createAuditTrail(
    partial: Partial<AuditTrail> & {
      correlationId: string;
      operation: string;
      resource: string;
      dataClassification: AuditTrail["dataClassification"];
      success: boolean;
      purpose: string;
    },
  ): AuditTrail {
    return {
      id: this.generateId(),
      timestamp: new Date(),
      retentionPolicy: this.getRetentionPolicy(partial.dataClassification),
      legalBasis: this.inferLegalBasis(partial.operation),
      metadata: {},
      ...partial,
    };
  }

  private async storeAudit(audit: AuditTrail): Promise<void> {
    await this.storage.store(audit);
  }

  private async checkAlerts(audit: AuditTrail): Promise<void> {
    if (!this.options.alerting.enabled) return;

    // Check error rate
    if (!audit.success) {
      // Implementation would check recent error rate and alert if threshold exceeded
    }

    // Check for suspicious activity patterns
    if (audit.userId) {
      // Implementation would check for unusual access patterns
    }
  }

  private async alertAccessDenied(audit: AuditTrail): Promise<void> {
    // Implementation would send alerts for access denied events
    console.warn(
      `Access denied: ${audit.userId} attempted ${audit.operation} on ${audit.resource}`,
    );
  }

  private calculateSummary(
    auditTrails: AuditTrail[],
  ): ComplianceReport["summary"] {
    const summary = {
      totalOperations: auditTrails.length,
      byOperation: {} as Record<string, number>,
      byClassification: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      errors: 0,
    };

    for (const trail of auditTrails) {
      // Count by operation
      summary.byOperation[trail.operation] =
        (summary.byOperation[trail.operation] || 0) + 1;

      // Count by classification
      summary.byClassification[trail.dataClassification] =
        (summary.byClassification[trail.dataClassification] || 0) + 1;

      // Count by user
      if (trail.userId) {
        summary.byUser[trail.userId] = (summary.byUser[trail.userId] || 0) + 1;
      }

      // Count errors
      if (!trail.success) {
        summary.errors++;
      }
    }

    return summary;
  }

  private async checkLegalHolds(dataSubjectId: string): Promise<string[]> {
    // Implementation would check for legal holds on the data subject
    // Return empty array for now (no legal holds)
    return [];
  }

  private async countRecords(dataSubjectId: string): Promise<number> {
    const records = await this.storage.query({ dataSubjectId });
    return records.length;
  }

  private inferDataClassification(
    resource: string,
  ): AuditTrail["dataClassification"] {
    if (resource.includes("public")) return "public";
    if (resource.includes("confidential")) return "confidential";
    if (resource.includes("restricted")) return "restricted";
    return "internal";
  }

  private getRetentionPolicy(
    classification: AuditTrail["dataClassification"],
  ): string {
    const days =
      this.options.retention.byClassification[classification] ||
      this.options.retention.defaultRetention;
    return `${days} days`;
  }

  private inferLegalBasis(operation: string): AuditTrail["legalBasis"] {
    if (operation.includes("consent")) return "consent";
    if (operation.includes("contract")) return "contract";
    if (operation.includes("legal")) return "legal_obligation";
    return "legitimate_interest";
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateOptions(): void {
    if (!this.options.storage) {
      throw new Error("Audit storage implementation is required");
    }

    if (!this.options.retention) {
      throw new Error("Retention policy is required");
    }

    if (this.options.retention.defaultRetention <= 0) {
      throw new Error("Default retention period must be positive");
    }
  }
}
