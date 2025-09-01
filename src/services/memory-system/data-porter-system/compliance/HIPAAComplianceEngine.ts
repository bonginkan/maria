/**
 * HIPAA Compliance Engine
 *
 * Implements Health Insurance Portability and Accountability Act compliance checks
 */

import { EventEmitter } from "node:events";
import {
  ComplianceRule,
  ComplianceResult,
  ComplianceViolation,
  HIPAAConfig,
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

export class HIPAAComplianceEngine extends EventEmitter {
  readonly framework = "HIPAA";
  readonly version = "1.0.0";
  readonly enabled: boolean;

  private config: HIPAAConfig;
  private readonly phiIdentifiers = new Set([
    "name",
    "firstName",
    "lastName",
    "address",
    "phone",
    "fax",
    "email",
    "ssn",
    "socialSecurityNumber",
    "medicalRecordNumber",
    "mrn",
    "healthPlanNumber",
    "accountNumber",
    "certificateNumber",
    "licenseNumber",
    "vehicleIdentifier",
    "deviceIdentifier",
    "webUrl",
    "ipAddress",
    "biometricIdentifier",
    "fullFacePhoto",
    "comparableImage",
    "dateOfBirth",
    "birthDate",
    "deathDate",
    "admissionDate",
    "dischargeDate",
  ]);

  private readonly medicalDataFields = new Set([
    "diagnosis",
    "treatment",
    "medication",
    "procedure",
    "condition",
    "symptom",
    "vital",
    "lab",
    "test",
    "result",
    "prescription",
    "allergy",
    "immunization",
    "surgery",
    "therapy",
    "consultation",
  ]);

  constructor(config: HIPAAConfig) {
    super();
    this.config = config;
    this.enabled = config.enabled;
  }

  /**
   * Validate data for HIPAA compliance
   */
  async validate(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceResult> {
    try {
      const violations: ComplianceViolation[] = [];

      // Check PHI detection
      if (this.config.phiDetection) {
        const phiViolations = await this.checkPHIHandling(data, context);
        violations.push(...phiViolations);
      }

      // Check access logging
      if (this.config.accessLogging) {
        const loggingViolations = await this.checkAccessLogging(data, context);
        violations.push(...loggingViolations);
      }

      // Check encryption requirements
      if (this.config.encryptionRequired) {
        const encryptionViolations = await this.checkEncryptionRequirements(
          data,
          context,
        );
        violations.push(...encryptionViolations);
      }

      // Check audit trail
      if (this.config.auditTrail) {
        const auditViolations = await this.checkAuditTrail(data, context);
        violations.push(...auditViolations);
      }

      // Check minimum necessary standard
      const minimumNecessaryViolations = await this.checkMinimumNecessary(
        data,
        context,
      );
      violations.push(...minimumNecessaryViolations);

      // Check administrative safeguards
      const administrativeViolations = await this.checkAdministrativeSafeguards(
        data,
        context,
      );
      violations.push(...administrativeViolations);

      // Check physical safeguards
      const physicalViolations = await this.checkPhysicalSafeguards(
        data,
        context,
      );
      violations.push(...physicalViolations);

      // Check technical safeguards
      const technicalViolations = await this.checkTechnicalSafeguards(
        data,
        context,
      );
      violations.push(...technicalViolations);

      this.emit("validation_complete", {
        context,
        violationCount: violations.length,
        compliant:
          violations.filter((v) => v.severity === "critical").length === 0,
      });

      return {
        gdpr: true, // Not applicable
        hipaa: violations.filter((v) => v.severity === "critical").length === 0,
        sox: true, // Not applicable
        customRules: violations.length === 0,
        violations,
      };
    } catch (error) {
      this.emit("validation_error", {
        context,
        error: error.message,
      });

      throw new Error(`HIPAA validation failed: ${error.message}`);
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
        case "hipaa_phi_encryption":
          return this.isPHIEncrypted(data, context);
        case "hipaa_minimum_necessary":
          return this.isMinimumNecessary(data, context);
        case "hipaa_access_control":
          return this.hasProperAccessControl(data, context);
        case "hipaa_audit_logs":
          return this.hasAuditLogs(data, context);
        case "hipaa_user_authentication":
          return this.hasUserAuthentication(data, context);
        default:
          return true; // Unknown rules pass
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Get HIPAA violations for data
   */
  async getViolations(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const result = await this.validate(data, context);
    return result.violations;
  }

  /**
   * Check PHI handling requirements
   */
  private async checkPHIHandling(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsPHI = this.detectPHI(data);
    const isEncrypted = context.metadata.encrypted;
    const hasAccessControl = context.metadata.accessControlEnabled;

    if (containsPHI) {
      // PHI must be encrypted
      if (!isEncrypted) {
        violations.push({
          ruleId: "hipaa_phi_not_encrypted",
          framework: "HIPAA",
          severity: "critical",
          description: "Protected Health Information (PHI) is not encrypted",
          recommendation: "Encrypt all PHI data in transit and at rest",
        });
      }

      // PHI must have access controls
      if (!hasAccessControl) {
        violations.push({
          ruleId: "hipaa_phi_no_access_control",
          framework: "HIPAA",
          severity: "critical",
          description: "PHI lacks proper access controls",
          recommendation: "Implement role-based access controls for PHI",
        });
      }

      // Check for specific PHI identifiers that should be limited
      const directIdentifiers = this.getDirectIdentifiers(data);
      if (directIdentifiers.length > 0 && !context.metadata.deIdentified) {
        violations.push({
          ruleId: "hipaa_direct_identifiers",
          framework: "HIPAA",
          severity: "high",
          description: `Direct PHI identifiers present: ${directIdentifiers.join(", ")}`,
          recommendation:
            "Consider de-identification or implement additional safeguards",
        });
      }
    }

    return violations;
  }

  /**
   * Check access logging requirements
   */
  private async checkAccessLogging(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsPHI = this.detectPHI(data);
    const hasAuditLog = context.metadata.auditLogged;
    const logRetention = context.metadata.logRetentionPeriod;

    if (containsPHI) {
      if (!hasAuditLog) {
        violations.push({
          ruleId: "hipaa_missing_audit_log",
          framework: "HIPAA",
          severity: "high",
          description: "PHI access not properly logged",
          recommendation:
            "Implement comprehensive audit logging for PHI access",
        });
      }

      // Audit logs must be retained for 6 years
      if (logRetention && logRetention < 6 * 365 * 24 * 60 * 60 * 1000) {
        violations.push({
          ruleId: "hipaa_insufficient_log_retention",
          framework: "HIPAA",
          severity: "medium",
          description: "Audit log retention period less than required 6 years",
          recommendation: "Set audit log retention to minimum 6 years",
        });
      }
    }

    return violations;
  }

  /**
   * Check encryption requirements
   */
  private async checkEncryptionRequirements(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsPHI = this.detectPHI(data);
    const encryptionAtRest = context.metadata.encryptionAtRest;
    const encryptionInTransit = context.metadata.encryptionInTransit;
    const encryptionAlgorithm = context.metadata.encryptionAlgorithm;

    if (containsPHI) {
      // Check encryption at rest
      if (!encryptionAtRest) {
        violations.push({
          ruleId: "hipaa_no_encryption_at_rest",
          framework: "HIPAA",
          severity: "critical",
          description: "PHI not encrypted at rest",
          recommendation: "Implement AES-256 encryption for PHI storage",
        });
      }

      // Check encryption in transit
      if (!encryptionInTransit) {
        violations.push({
          ruleId: "hipaa_no_encryption_in_transit",
          framework: "HIPAA",
          severity: "critical",
          description: "PHI not encrypted in transit",
          recommendation: "Use TLS 1.2 or higher for PHI transmission",
        });
      }

      // Check encryption algorithm strength
      if (
        encryptionAlgorithm &&
        !this.isApprovedEncryption(encryptionAlgorithm)
      ) {
        violations.push({
          ruleId: "hipaa_weak_encryption",
          framework: "HIPAA",
          severity: "high",
          description: `Weak encryption algorithm: ${encryptionAlgorithm}`,
          recommendation: "Use AES-256 or other NIST-approved encryption",
        });
      }
    }

    return violations;
  }

  /**
   * Check audit trail requirements
   */
  private async checkAuditTrail(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsPHI = this.detectPHI(data);
    const auditDetails = context.metadata.auditDetails;

    if (containsPHI && auditDetails) {
      // Required audit trail elements
      const requiredElements = [
        "userId",
        "timestamp",
        "action",
        "resource",
        "result",
      ];

      const missingElements = requiredElements.filter(
        (element) => !(element in auditDetails),
      );

      if (missingElements.length > 0) {
        violations.push({
          ruleId: "hipaa_incomplete_audit_trail",
          framework: "HIPAA",
          severity: "medium",
          description: `Audit trail missing elements: ${missingElements.join(", ")}`,
          recommendation: "Include all required elements in audit logs",
        });
      }
    }

    return violations;
  }

  /**
   * Check minimum necessary standard
   */
  private async checkMinimumNecessary(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsPHI = this.detectPHI(data);
    const purpose = context.metadata.accessPurpose;
    const userRole = context.metadata.userRole;

    if (containsPHI && purpose && userRole) {
      const necessaryFields = this.getNecessaryFields(purpose, userRole);

      if (typeof data === "object" && data !== null) {
        const actualFields = Object.keys(data).filter(
          (field) =>
            this.phiIdentifiers.has(field.toLowerCase()) ||
            this.medicalDataFields.has(field.toLowerCase()),
        );

        const unnecessaryFields = actualFields.filter(
          (field) => !necessaryFields.includes(field.toLowerCase()),
        );

        if (unnecessaryFields.length > 0) {
          violations.push({
            ruleId: "hipaa_minimum_necessary_violation",
            framework: "HIPAA",
            severity: "medium",
            description: `Accessing PHI beyond minimum necessary: ${unnecessaryFields.join(", ")}`,
            recommendation:
              "Limit PHI access to minimum necessary for the purpose",
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check administrative safeguards
   */
  private async checkAdministrativeSafeguards(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsPHI = this.detectPHI(data);
    const hasSecurityOfficer = context.metadata.securityOfficerAssigned;
    const hasTraining = context.metadata.hipaaTrainingCompleted;
    const hasIncidentProcedures =
      context.metadata.incidentProceduresImplemented;

    if (containsPHI) {
      if (!hasSecurityOfficer) {
        violations.push({
          ruleId: "hipaa_no_security_officer",
          framework: "HIPAA",
          severity: "high",
          description: "No assigned security officer for PHI handling",
          recommendation: "Designate a HIPAA security officer",
        });
      }

      if (!hasTraining) {
        violations.push({
          ruleId: "hipaa_no_training",
          framework: "HIPAA",
          severity: "medium",
          description: "HIPAA training not completed for PHI access",
          recommendation: "Complete HIPAA security awareness training",
        });
      }

      if (!hasIncidentProcedures) {
        violations.push({
          ruleId: "hipaa_no_incident_procedures",
          framework: "HIPAA",
          severity: "medium",
          description: "Security incident procedures not implemented",
          recommendation: "Establish security incident response procedures",
        });
      }
    }

    return violations;
  }

  /**
   * Check physical safeguards
   */
  private async checkPhysicalSafeguards(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsPHI = this.detectPHI(data);
    const hasPhysicalAccess = context.metadata.physicalAccessControl;
    const hasWorkstationSecurity = context.metadata.workstationSecurity;
    const hasMediaControls = context.metadata.mediaControls;

    if (containsPHI) {
      if (!hasPhysicalAccess) {
        violations.push({
          ruleId: "hipaa_no_physical_access_control",
          framework: "HIPAA",
          severity: "medium",
          description:
            "Physical access controls not implemented for PHI systems",
          recommendation:
            "Implement physical access restrictions to PHI systems",
        });
      }

      if (!hasWorkstationSecurity) {
        violations.push({
          ruleId: "hipaa_no_workstation_security",
          framework: "HIPAA",
          severity: "medium",
          description: "Workstation security controls not implemented",
          recommendation: "Secure workstations that access PHI",
        });
      }

      if (!hasMediaControls) {
        violations.push({
          ruleId: "hipaa_no_media_controls",
          framework: "HIPAA",
          severity: "low",
          description: "Media handling controls not implemented",
          recommendation: "Establish controls for PHI-containing media",
        });
      }
    }

    return violations;
  }

  /**
   * Check technical safeguards
   */
  private async checkTechnicalSafeguards(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsPHI = this.detectPHI(data);
    const hasAccessControl = context.metadata.technicalAccessControl;
    const hasUserAuth = context.metadata.userAuthentication;
    const hasIntegrityControl = context.metadata.integrityControl;
    const hasTransmissionSecurity = context.metadata.transmissionSecurity;

    if (containsPHI) {
      if (!hasAccessControl) {
        violations.push({
          ruleId: "hipaa_no_technical_access_control",
          framework: "HIPAA",
          severity: "critical",
          description: "Technical access controls not implemented for PHI",
          recommendation:
            "Implement role-based access controls and user authentication",
        });
      }

      if (!hasUserAuth) {
        violations.push({
          ruleId: "hipaa_no_user_authentication",
          framework: "HIPAA",
          severity: "critical",
          description: "User authentication not required for PHI access",
          recommendation: "Implement strong user authentication mechanisms",
        });
      }

      if (!hasIntegrityControl) {
        violations.push({
          ruleId: "hipaa_no_integrity_control",
          framework: "HIPAA",
          severity: "high",
          description: "PHI integrity controls not implemented",
          recommendation: "Implement data integrity verification mechanisms",
        });
      }

      if (!hasTransmissionSecurity) {
        violations.push({
          ruleId: "hipaa_no_transmission_security",
          framework: "HIPAA",
          severity: "critical",
          description: "Transmission security not implemented for PHI",
          recommendation: "Use end-to-end encryption for PHI transmission",
        });
      }
    }

    return violations;
  }

  /**
   * Detect PHI in data
   */
  private detectPHI(data: any): boolean {
    if (typeof data !== "object" || data === null) {
      return false;
    }

    if (Array.isArray(data)) {
      return data.some((item) => this.detectPHI(item));
    }

    const fields = Object.keys(data);
    return fields.some(
      (field) =>
        this.phiIdentifiers.has(field.toLowerCase()) ||
        this.medicalDataFields.has(field.toLowerCase()) ||
        this.containsPHIPattern(field, data[field]),
    );
  }

  /**
   * Get direct identifiers from data
   */
  private getDirectIdentifiers(data: any): string[] {
    const directIdentifiers = [];

    if (typeof data === "object" && data !== null) {
      const fields = Object.keys(data);
      for (const field of fields) {
        if (this.phiIdentifiers.has(field.toLowerCase())) {
          directIdentifiers.push(field);
        }
      }
    }

    return directIdentifiers;
  }

  /**
   * Check if field contains PHI pattern
   */
  private containsPHIPattern(field: string, value: any): boolean {
    if (typeof value !== "string") return false;

    const patterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IP Address
    ];

    return patterns.some((pattern) => pattern.test(value));
  }

  /**
   * Get necessary fields for purpose and role
   */
  private getNecessaryFields(purpose: string, role: string): string[] {
    // This would be configurable based on organizational policies
    const necessaryFieldsByPurposeAndRole: Record<
      string,
      Record<string, string[]>
    > = {
      treatment: {
        physician: [
          "name",
          "dateOfBirth",
          "diagnosis",
          "treatment",
          "medication",
        ],
        nurse: ["name", "medication", "vital", "allergy"],
        technician: ["name", "test", "procedure"],
      },
      payment: {
        billing: [
          "name",
          "address",
          "healthPlanNumber",
          "diagnosis",
          "procedure",
        ],
        insurance: ["healthPlanNumber", "diagnosis", "treatment"],
      },
      operations: {
        administrator: ["name", "dateOfBirth", "diagnosis"],
        quality: ["diagnosis", "treatment", "result"],
      },
    };

    return necessaryFieldsByPurposeAndRole[purpose]?.[role] || [];
  }

  /**
   * Check if encryption algorithm is approved
   */
  private isApprovedEncryption(algorithm: string): boolean {
    const approvedAlgorithms = [
      "AES-256",
      "AES-192",
      "AES-128",
      "AES-256-GCM",
      "AES-256-CBC",
      "ChaCha20-Poly1305",
    ];

    return approvedAlgorithms.some((approved) =>
      algorithm.toUpperCase().includes(approved),
    );
  }

  /**
   * Check if PHI is encrypted
   */
  private isPHIEncrypted(data: any, context: ComplianceContext): boolean {
    const containsPHI = this.detectPHI(data);
    if (!containsPHI) return true;

    return context.metadata.encrypted === true;
  }

  /**
   * Check if minimum necessary standard is met
   */
  private isMinimumNecessary(data: any, context: ComplianceContext): boolean {
    const containsPHI = this.detectPHI(data);
    if (!containsPHI) return true;

    const purpose = context.metadata.accessPurpose;
    const userRole = context.metadata.userRole;

    if (!purpose || !userRole) return false;

    const violations = this.checkMinimumNecessary(data, context);
    return violations.then((v) => v.length === 0);
  }

  /**
   * Check if proper access control is implemented
   */
  private hasProperAccessControl(
    data: any,
    context: ComplianceContext,
  ): boolean {
    const containsPHI = this.detectPHI(data);
    if (!containsPHI) return true;

    return (
      context.metadata.accessControlEnabled === true &&
      context.metadata.userAuthentication === true
    );
  }

  /**
   * Check if audit logs are present
   */
  private hasAuditLogs(data: any, context: ComplianceContext): boolean {
    const containsPHI = this.detectPHI(data);
    if (!containsPHI) return true;

    return context.metadata.auditLogged === true;
  }

  /**
   * Check if user authentication is implemented
   */
  private hasUserAuthentication(
    data: any,
    context: ComplianceContext,
  ): boolean {
    return context.metadata.userAuthentication === true;
  }

  /**
   * Update HIPAA engine configuration
   */
  updateConfig(newConfig: Partial<HIPAAConfig>): void {
    Object.assign(this.config, newConfig);

    this.emit("config_updated", {
      timestamp: Date.now(),
      config: this.config,
    });
  }

  /**
   * Get HIPAA engine health status
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
      this.config.phiDetection,
      this.config.encryptionRequired,
      this.config.accessLogging,
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
        phiIdentifiers: this.phiIdentifiers.size,
        medicalDataFields: this.medicalDataFields.size,
      },
    };
  }
}
