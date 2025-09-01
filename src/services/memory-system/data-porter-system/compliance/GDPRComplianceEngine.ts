/**
 * GDPR Compliance Engine
 *
 * Implements General Data Protection Regulation compliance checks
 */

import { EventEmitter } from "node:events";
import {
  ComplianceRule,
  ComplianceResult,
  ComplianceViolation,
  GDPRConfig,
} from "../types/porter-types";

export interface ComplianceContext {
  requestId: string;
  userId: string;
  correlationId: string;
  timestamp: number;
  operation: "export" | "import" | "access" | "modify" | "delete";
  dataClassification: string;
  metadata: Record<string, any>;
}

export class GDPRComplianceEngine extends EventEmitter {
  readonly framework = "GDPR";
  readonly version = "1.0.0";
  readonly enabled: boolean;

  private config: GDPRConfig;
  private readonly personalDataFields = new Set([
    "email",
    "name",
    "firstName",
    "lastName",
    "phone",
    "address",
    "dateOfBirth",
    "birthDate",
    "ssn",
    "nationalId",
    "passport",
    "ip",
    "ipAddress",
    "location",
    "coordinates",
    "userId",
  ]);

  private readonly sensitiveDataFields = new Set([
    "health",
    "medical",
    "religion",
    "political",
    "sexual",
    "ethnic",
    "biometric",
    "genetic",
    "criminal",
    "conviction",
  ]);

  constructor(config: GDPRConfig) {
    super();
    this.config = config;
    this.enabled = config.enabled;
  }

  /**
   * Validate data for GDPR compliance
   */
  async validate(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceResult> {
    try {
      const violations: ComplianceViolation[] = [];

      // Check data subject rights compliance
      if (this.config.dataSubjectRights) {
        const rightsViolations = await this.checkDataSubjectRights(
          data,
          context,
        );
        violations.push(...rightsViolations);
      }

      // Check consent tracking
      if (this.config.consentTracking) {
        const consentViolations = await this.checkConsentRequirements(
          data,
          context,
        );
        violations.push(...consentViolations);
      }

      // Check data portability
      if (this.config.dataPortability) {
        const portabilityViolations = await this.checkDataPortability(
          data,
          context,
        );
        violations.push(...portabilityViolations);
      }

      // Check right to erasure
      if (this.config.rightToErasure) {
        const erasureViolations = await this.checkRightToErasure(data, context);
        violations.push(...erasureViolations);
      }

      // Check data minimization
      const minimizationViolations = await this.checkDataMinimization(
        data,
        context,
      );
      violations.push(...minimizationViolations);

      // Check purpose limitation
      const purposeViolations = await this.checkPurposeLimitation(
        data,
        context,
      );
      violations.push(...purposeViolations);

      // Check personal data handling
      const personalDataViolations = await this.checkPersonalDataHandling(
        data,
        context,
      );
      violations.push(...personalDataViolations);

      this.emit("validation_complete", {
        context,
        violationCount: violations.length,
        compliant: violations.length === 0,
      });

      return {
        gdpr: violations.filter((v) => v.severity === "critical").length === 0,
        hipaa: true, // Not applicable
        sox: true, // Not applicable
        customRules: violations.length === 0,
        violations,
      };
    } catch (error) {
      this.emit("validation_error", {
        context,
        error: error.message,
      });

      throw new Error(`GDPR validation failed: ${error.message}`);
    }
  }

  /**
   * Check specific compliance rule
   */
  async checkRule(
    rule: ComplianceRule,
    data: any,
    context: ComplianceContext,
  ): Promise<boolean> {
    try {
      switch (rule.id) {
        case "gdpr_consent_required":
          return this.hasValidConsent(data, context);
        case "gdpr_data_minimization":
          return this.isDataMinimized(data, context);
        case "gdpr_purpose_limitation":
          return this.isPurposeLimited(data, context);
        case "gdpr_right_to_erasure":
          return this.supportsErasure(data, context);
        case "gdpr_data_portability":
          return this.supportsPortability(data, context);
        default:
          return true; // Unknown rules pass
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Get GDPR violations for data
   */
  async getViolations(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const result = await this.validate(data, context);
    return result.violations;
  }

  /**
   * Check data subject rights compliance
   */
  private async checkDataSubjectRights(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check if data supports required subject rights
    const requiredRights = [
      "access",
      "rectification",
      "erasure",
      "portability",
      "restriction",
    ];

    for (const right of requiredRights) {
      const supported = context.metadata[`supports_${right}`];

      if (supported === false) {
        violations.push({
          ruleId: `gdpr_subject_right_${right}`,
          framework: "GDPR",
          severity: "high",
          description: `Data processing does not support subject right: ${right}`,
          recommendation: `Implement ${right} capability in data processing system`,
        });
      }
    }

    return violations;
  }

  /**
   * Check consent requirements
   */
  private async checkConsentRequirements(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check for personal data without consent
    const hasPersonalData = this.detectPersonalData(data);
    const hasConsent =
      context.metadata.consent || context.metadata.consentStatus;

    if (hasPersonalData && !hasConsent) {
      violations.push({
        ruleId: "gdpr_missing_consent",
        framework: "GDPR",
        severity: "critical",
        description: "Personal data processing without valid consent",
        recommendation:
          "Obtain explicit consent before processing personal data",
      });
    }

    // Check consent specificity
    if (hasConsent && context.metadata.consentPurpose) {
      const currentPurpose = context.metadata.processingPurpose;
      const consentedPurpose = context.metadata.consentPurpose;

      if (currentPurpose && currentPurpose !== consentedPurpose) {
        violations.push({
          ruleId: "gdpr_purpose_mismatch",
          framework: "GDPR",
          severity: "high",
          description: "Data processing purpose differs from consented purpose",
          recommendation:
            "Obtain new consent for different processing purposes",
        });
      }
    }

    // Check consent withdrawal capability
    if (hasConsent && !context.metadata.withdrawalSupported) {
      violations.push({
        ruleId: "gdpr_withdrawal_not_supported",
        framework: "GDPR",
        severity: "medium",
        description: "Consent withdrawal mechanism not available",
        recommendation: "Implement easy consent withdrawal process",
      });
    }

    return violations;
  }

  /**
   * Check data portability requirements
   */
  private async checkDataPortability(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const hasPersonalData = this.detectPersonalData(data);
    const isPortable = context.metadata.portabilitySupported;
    const isStructured = this.isDataStructured(data);

    if (hasPersonalData && !isPortable) {
      violations.push({
        ruleId: "gdpr_portability_not_supported",
        framework: "GDPR",
        severity: "medium",
        description: "Personal data not available in portable format",
        recommendation:
          "Implement data export in structured, commonly used format",
      });
    }

    if (hasPersonalData && isPortable && !isStructured) {
      violations.push({
        ruleId: "gdpr_unstructured_data",
        framework: "GDPR",
        severity: "low",
        description: "Data not in structured format for portability",
        recommendation: "Provide data in structured, machine-readable format",
      });
    }

    return violations;
  }

  /**
   * Check right to erasure
   */
  private async checkRightToErasure(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const hasPersonalData = this.detectPersonalData(data);
    const erasureSupported = context.metadata.erasureSupported;
    const hasLegalBasis = context.metadata.legalBasis;

    if (hasPersonalData && !erasureSupported) {
      violations.push({
        ruleId: "gdpr_erasure_not_supported",
        framework: "GDPR",
        severity: "high",
        description: "Right to erasure not implemented for personal data",
        recommendation: "Implement secure data deletion capabilities",
      });
    }

    // Check for legitimate interest vs. erasure rights
    if (hasPersonalData && hasLegalBasis === "legitimate_interest") {
      const balancingTest = context.metadata.balancingTestPerformed;

      if (!balancingTest) {
        violations.push({
          ruleId: "gdpr_balancing_test_missing",
          framework: "GDPR",
          severity: "medium",
          description:
            "Balancing test not performed for legitimate interest processing",
          recommendation:
            "Document balancing test weighing interests and rights",
        });
      }
    }

    return violations;
  }

  /**
   * Check data minimization principle
   */
  private async checkDataMinimization(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const processingPurpose = context.metadata.processingPurpose;
    const necessaryFields = context.metadata.necessaryFields || [];

    if (typeof data === "object" && data !== null && processingPurpose) {
      const actualFields = Object.keys(data);
      const unnecessaryFields = actualFields.filter(
        (field) =>
          !necessaryFields.includes(field) &&
          !this.isFieldNecessary(field, processingPurpose),
      );

      if (unnecessaryFields.length > 0) {
        violations.push({
          ruleId: "gdpr_excessive_data",
          framework: "GDPR",
          severity: "medium",
          description: `Processing unnecessary data fields: ${unnecessaryFields.join(", ")}`,
          recommendation:
            "Remove unnecessary data fields or update processing purpose",
        });
      }
    }

    return violations;
  }

  /**
   * Check purpose limitation
   */
  private async checkPurposeLimitation(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const currentPurpose = context.metadata.processingPurpose;
    const originalPurpose = context.metadata.originalPurpose;
    const purposeCompatible = context.metadata.purposeCompatible;

    if (
      currentPurpose &&
      originalPurpose &&
      currentPurpose !== originalPurpose
    ) {
      if (purposeCompatible !== true) {
        violations.push({
          ruleId: "gdpr_incompatible_purpose",
          framework: "GDPR",
          severity: "high",
          description:
            "Data used for purpose incompatible with original collection",
          recommendation:
            "Perform compatibility assessment or obtain new consent",
        });
      }
    }

    return violations;
  }

  /**
   * Check personal data handling
   */
  private async checkPersonalDataHandling(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    // Check for sensitive personal data
    const hasSensitiveData = this.detectSensitiveData(data);
    const hasExplicitConsent = context.metadata.explicitConsent;

    if (hasSensitiveData && !hasExplicitConsent) {
      violations.push({
        ruleId: "gdpr_sensitive_data_no_consent",
        framework: "GDPR",
        severity: "critical",
        description:
          "Sensitive personal data processed without explicit consent",
        recommendation: "Obtain explicit consent for sensitive data processing",
      });
    }

    // Check data retention
    const retentionPeriod = context.metadata.retentionPeriod;
    const dataAge = context.metadata.dataAge;

    if (retentionPeriod && dataAge && dataAge > retentionPeriod) {
      violations.push({
        ruleId: "gdpr_retention_exceeded",
        framework: "GDPR",
        severity: "high",
        description: "Data retention period exceeded",
        recommendation: "Delete or anonymize data beyond retention period",
      });
    }

    return violations;
  }

  /**
   * Detect personal data in dataset
   */
  private detectPersonalData(data: any): boolean {
    if (typeof data !== "object" || data === null) {
      return false;
    }

    if (Array.isArray(data)) {
      return data.some((item) => this.detectPersonalData(item));
    }

    const fields = Object.keys(data);
    return fields.some(
      (field) =>
        this.personalDataFields.has(field.toLowerCase()) ||
        this.containsPersonalDataPattern(field, data[field]),
    );
  }

  /**
   * Detect sensitive personal data
   */
  private detectSensitiveData(data: any): boolean {
    if (typeof data !== "object" || data === null) {
      return false;
    }

    if (Array.isArray(data)) {
      return data.some((item) => this.detectSensitiveData(item));
    }

    const fields = Object.keys(data);
    return fields.some(
      (field) =>
        this.sensitiveDataFields.has(field.toLowerCase()) ||
        this.containsSensitiveDataPattern(field, data[field]),
    );
  }

  /**
   * Check if data is structured for portability
   */
  private isDataStructured(data: any): boolean {
    if (typeof data === "object" && data !== null) {
      return true; // JSON is structured
    }
    return false;
  }

  /**
   * Check if field contains personal data pattern
   */
  private containsPersonalDataPattern(field: string, value: any): boolean {
    if (typeof value !== "string") return false;

    const patterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone (US format)
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IP Address
    ];

    return patterns.some((pattern) => pattern.test(value));
  }

  /**
   * Check if field contains sensitive data pattern
   */
  private containsSensitiveDataPattern(field: string, value: any): boolean {
    if (typeof value !== "string") return false;

    const sensitiveKeywords = [
      "health",
      "medical",
      "diagnosis",
      "treatment",
      "prescription",
      "religion",
      "religious",
      "political",
      "party",
      "union",
      "sexual",
      "orientation",
      "preference",
      "ethnic",
      "race",
    ];

    const fieldLower = field.toLowerCase();
    const valueLower = value.toLowerCase();

    return sensitiveKeywords.some(
      (keyword) => fieldLower.includes(keyword) || valueLower.includes(keyword),
    );
  }

  /**
   * Check if field is necessary for processing purpose
   */
  private isFieldNecessary(field: string, purpose: string): boolean {
    // This would typically be configurable based on business rules
    const necessaryFieldsByPurpose: Record<string, string[]> = {
      authentication: ["email", "password", "userId"],
      communication: ["email", "name", "phone"],
      billing: ["name", "address", "payment", "tax"],
      analytics: ["userId", "timestamp", "action"],
    };

    const necessaryFields = necessaryFieldsByPurpose[purpose] || [];
    return necessaryFields.includes(field.toLowerCase());
  }

  /**
   * Check if data has valid consent
   */
  private hasValidConsent(data: any, context: ComplianceContext): boolean {
    const consent = context.metadata.consent;
    if (!consent) return false;

    // Check consent validity criteria
    const isSpecific = consent.specific !== false;
    const isInformed = consent.informed !== false;
    const isFreelyGiven = consent.freelyGiven !== false;
    const isUnambiguous = consent.unambiguous !== false;

    return isSpecific && isInformed && isFreelyGiven && isUnambiguous;
  }

  /**
   * Check if data is minimized
   */
  private isDataMinimized(data: any, context: ComplianceContext): boolean {
    const purpose = context.metadata.processingPurpose;
    const necessaryFields = context.metadata.necessaryFields || [];

    if (typeof data === "object" && data !== null && purpose) {
      const actualFields = Object.keys(data);
      const unnecessaryFields = actualFields.filter(
        (field) =>
          !necessaryFields.includes(field) &&
          !this.isFieldNecessary(field, purpose),
      );

      return unnecessaryFields.length === 0;
    }

    return true;
  }

  /**
   * Check if processing is purpose limited
   */
  private isPurposeLimited(data: any, context: ComplianceContext): boolean {
    const currentPurpose = context.metadata.processingPurpose;
    const originalPurpose = context.metadata.originalPurpose;
    const purposeCompatible = context.metadata.purposeCompatible;

    if (
      currentPurpose &&
      originalPurpose &&
      currentPurpose !== originalPurpose
    ) {
      return purposeCompatible === true;
    }

    return true;
  }

  /**
   * Check if data supports erasure
   */
  private supportsErasure(data: any, context: ComplianceContext): boolean {
    return context.metadata.erasureSupported === true;
  }

  /**
   * Check if data supports portability
   */
  private supportsPortability(data: any, context: ComplianceContext): boolean {
    return (
      context.metadata.portabilitySupported === true &&
      this.isDataStructured(data)
    );
  }

  /**
   * Update GDPR engine configuration
   */
  updateConfig(newConfig: Partial<GDPRConfig>): void {
    Object.assign(this.config, newConfig);

    this.emit("config_updated", {
      timestamp: Date.now(),
      config: this.config,
    });
  }

  /**
   * Get GDPR engine health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  } {
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (!this.enabled) {
      status = "degraded";
    }

    // Check if critical features are enabled
    const criticalFeatures = [
      this.config.dataSubjectRights,
      this.config.consentTracking,
      this.config.rightToErasure,
    ];

    const enabledCriticalFeatures = criticalFeatures.filter(Boolean).length;
    if (enabledCriticalFeatures < 2) {
      status = "degraded";
    }

    return {
      status,
      details: {
        enabled: this.enabled,
        framework: this.framework,
        version: this.version,
        config: this.config,
        personalDataFields: this.personalDataFields.size,
        sensitiveDataFields: this.sensitiveDataFields.size,
      },
    };
  }
}
