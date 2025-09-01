/**
 * SOX Compliance Engine
 *
 * Implements Sarbanes-Oxley Act compliance checks for financial data
 */

import { EventEmitter } from "node:events";
import {
  ComplianceRule,
  ComplianceResult,
  ComplianceViolation,
  SOXConfig,
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

export class SOXComplianceEngine extends EventEmitter {
  readonly framework = "SOX";
  readonly version = "1.0.0";
  readonly enabled: boolean;

  private config: SOXConfig;
  private readonly financialDataFields = new Set([
    "revenue",
    "expenses",
    "profit",
    "loss",
    "assets",
    "liabilities",
    "equity",
    "cashFlow",
    "accountBalance",
    "transaction",
    "payment",
    "invoice",
    "receipt",
    "budget",
    "forecast",
    "audit",
    "tax",
    "accountNumber",
    "routingNumber",
    "bankAccount",
    "creditCard",
    "financialStatement",
    "balanceSheet",
    "incomeStatement",
    "cashFlowStatement",
  ]);

  private readonly sensitiveFinancialFields = new Set([
    "executiveCompensation",
    "bonuses",
    "stockOptions",
    "insider",
    "materialWeakness",
    "deficiency",
    "fraud",
    "misstatement",
    "restatement",
    "writeDown",
    "goodwillImpairment",
  ]);

  constructor(config: SOXConfig) {
    super();
    this.config = config;
    this.enabled = config.enabled;
  }

  /**
   * Validate data for SOX compliance
   */
  async validate(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceResult> {
    try {
      const violations: ComplianceViolation[] = [];

      // Check financial data protection
      if (this.config.financialDataProtection) {
        const protectionViolations = await this.checkFinancialDataProtection(
          data,
          context,
        );
        violations.push(...protectionViolations);
      }

      // Check change tracking
      if (this.config.changeTracking) {
        const changeTrackingViolations = await this.checkChangeTracking(
          data,
          context,
        );
        violations.push(...changeTrackingViolations);
      }

      // Check approval workflow
      if (this.config.approvalWorkflow) {
        const approvalViolations = await this.checkApprovalWorkflow(
          data,
          context,
        );
        violations.push(...approvalViolations);
      }

      // Check internal controls
      const controlsViolations = await this.checkInternalControls(
        data,
        context,
      );
      violations.push(...controlsViolations);

      // Check data integrity and accuracy
      const integrityViolations = await this.checkDataIntegrity(data, context);
      violations.push(...integrityViolations);

      // Check segregation of duties
      const segregationViolations = await this.checkSegregationOfDuties(
        data,
        context,
      );
      violations.push(...segregationViolations);

      // Check retention requirements
      const retentionViolations = await this.checkRetentionRequirements(
        data,
        context,
      );
      violations.push(...retentionViolations);

      this.emit("validation_complete", {
        context,
        violationCount: violations.length,
        compliant:
          violations.filter((v) => v.severity === "critical").length === 0,
      });

      return {
        gdpr: true, // Not applicable
        hipaa: true, // Not applicable
        sox: violations.filter((v) => v.severity === "critical").length === 0,
        customRules: violations.length === 0,
        violations,
      };
    } catch (error) {
      this.emit("validation_error", {
        context,
        error: error.message,
      });

      throw new Error(`SOX validation failed: ${error.message}`);
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
        case "sox_change_tracking":
          return this.hasChangeTracking(data, context);
        case "sox_approval_required":
          return this.hasRequiredApproval(data, context);
        case "sox_segregation_duties":
          return this.hasProperSegregation(data, context);
        case "sox_data_integrity":
          return this.hasDataIntegrity(data, context);
        case "sox_retention_compliance":
          return this.meetsRetentionRequirements(data, context);
        default:
          return true; // Unknown rules pass
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Get SOX violations for data
   */
  async getViolations(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const result = await this.validate(data, context);
    return result.violations;
  }

  /**
   * Check financial data protection
   */
  private async checkFinancialDataProtection(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsFinancialData = this.detectFinancialData(data);
    const isEncrypted = context.metadata.encrypted;
    const hasAccessControl = context.metadata.accessControlEnabled;
    const hasBackup = context.metadata.backupEnabled;

    if (containsFinancialData) {
      // Financial data should be encrypted
      if (!isEncrypted) {
        violations.push({
          ruleId: "sox_financial_data_not_encrypted",
          framework: "SOX",
          severity: "high",
          description: "Financial data is not encrypted",
          recommendation: "Encrypt all financial data in transit and at rest",
        });
      }

      // Financial data should have access controls
      if (!hasAccessControl) {
        violations.push({
          ruleId: "sox_financial_no_access_control",
          framework: "SOX",
          severity: "critical",
          description: "Financial data lacks proper access controls",
          recommendation:
            "Implement role-based access controls for financial data",
        });
      }

      // Financial data should be backed up
      if (!hasBackup) {
        violations.push({
          ruleId: "sox_financial_no_backup",
          framework: "SOX",
          severity: "medium",
          description: "Financial data backup not verified",
          recommendation: "Ensure regular backups of financial data",
        });
      }

      // Check for sensitive financial data exposure
      const hasSensitiveData = this.detectSensitiveFinancialData(data);
      const hasExecutiveApproval = context.metadata.executiveApproval;

      if (hasSensitiveData && !hasExecutiveApproval) {
        violations.push({
          ruleId: "sox_sensitive_financial_no_approval",
          framework: "SOX",
          severity: "high",
          description:
            "Sensitive financial data access without executive approval",
          recommendation:
            "Require executive approval for sensitive financial data access",
        });
      }
    }

    return violations;
  }

  /**
   * Check change tracking requirements
   */
  private async checkChangeTracking(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsFinancialData = this.detectFinancialData(data);
    const hasChangeLog = context.metadata.changeTracking;
    const hasApprovalTrail = context.metadata.approvalTrail;

    if (containsFinancialData) {
      if (!hasChangeLog) {
        violations.push({
          ruleId: "sox_no_change_tracking",
          framework: "SOX",
          severity: "critical",
          description: "Financial data changes not properly tracked",
          recommendation:
            "Implement comprehensive change tracking for financial data",
        });
      }

      // Check if changes are properly documented
      if (hasChangeLog && context.operation === "modify") {
        const changeDetails = context.metadata.changeDetails;

        if (
          !changeDetails ||
          !changeDetails.reason ||
          !changeDetails.approver
        ) {
          violations.push({
            ruleId: "sox_incomplete_change_documentation",
            framework: "SOX",
            severity: "high",
            description: "Financial data changes lack proper documentation",
            recommendation:
              "Document reason and approver for all financial data changes",
          });
        }
      }

      // Check for approval trail
      if (!hasApprovalTrail && context.operation !== "access") {
        violations.push({
          ruleId: "sox_no_approval_trail",
          framework: "SOX",
          severity: "high",
          description: "No approval trail for financial data operations",
          recommendation:
            "Maintain approval trail for all financial data operations",
        });
      }
    }

    return violations;
  }

  /**
   * Check approval workflow requirements
   */
  private async checkApprovalWorkflow(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsFinancialData = this.detectFinancialData(data);
    const requiresApproval = this.requiresApprovalWorkflow(data, context);
    const hasApproval = context.metadata.approved;
    const approver = context.metadata.approver;

    if (containsFinancialData && requiresApproval) {
      if (!hasApproval) {
        violations.push({
          ruleId: "sox_missing_approval",
          framework: "SOX",
          severity: "critical",
          description:
            "Financial operation requires approval but none provided",
          recommendation:
            "Obtain required approvals before processing financial data",
        });
      }

      if (hasApproval && (!approver || approver === context.userId)) {
        violations.push({
          ruleId: "sox_self_approval",
          framework: "SOX",
          severity: "critical",
          description: "Financial operation cannot be self-approved",
          recommendation: "Ensure segregation of duties in approval process",
        });
      }

      // Check approval authority level
      const approvalLevel = context.metadata.approvalLevel;
      const requiredLevel = this.getRequiredApprovalLevel(data, context);

      if (approvalLevel && requiredLevel && approvalLevel < requiredLevel) {
        violations.push({
          ruleId: "sox_insufficient_approval_level",
          framework: "SOX",
          severity: "high",
          description: `Approval level ${approvalLevel} insufficient for required level ${requiredLevel}`,
          recommendation:
            "Obtain approval from authorized personnel with sufficient authority",
        });
      }
    }

    return violations;
  }

  /**
   * Check internal controls
   */
  private async checkInternalControls(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsFinancialData = this.detectFinancialData(data);

    if (containsFinancialData) {
      // Check for proper authorization
      const hasAuthorization = context.metadata.authorized;
      if (!hasAuthorization) {
        violations.push({
          ruleId: "sox_no_authorization",
          framework: "SOX",
          severity: "critical",
          description: "Financial operation lacks proper authorization",
          recommendation:
            "Ensure all financial operations are properly authorized",
        });
      }

      // Check for dual control requirements
      const requiresDualControl = this.requiresDualControl(data, context);
      const hasDualControl = context.metadata.dualControl;

      if (requiresDualControl && !hasDualControl) {
        violations.push({
          ruleId: "sox_missing_dual_control",
          framework: "SOX",
          severity: "critical",
          description: "High-value financial operation requires dual control",
          recommendation:
            "Implement dual control for high-value financial transactions",
        });
      }

      // Check for transaction limits
      const transactionAmount =
        context.metadata.amount || this.extractAmount(data);
      const userLimit = context.metadata.userTransactionLimit;

      if (transactionAmount && userLimit && transactionAmount > userLimit) {
        violations.push({
          ruleId: "sox_transaction_limit_exceeded",
          framework: "SOX",
          severity: "high",
          description: `Transaction amount ${transactionAmount} exceeds user limit ${userLimit}`,
          recommendation:
            "Obtain higher-level approval for transactions exceeding user limits",
        });
      }
    }

    return violations;
  }

  /**
   * Check data integrity and accuracy
   */
  private async checkDataIntegrity(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsFinancialData = this.detectFinancialData(data);

    if (containsFinancialData) {
      // Check for data validation
      const isValidated = context.metadata.validated;
      if (!isValidated) {
        violations.push({
          ruleId: "sox_data_not_validated",
          framework: "SOX",
          severity: "high",
          description:
            "Financial data not validated for accuracy and completeness",
          recommendation: "Implement validation checks for financial data",
        });
      }

      // Check for reconciliation
      const isReconciled = context.metadata.reconciled;
      if (!isReconciled && this.requiresReconciliation(data, context)) {
        violations.push({
          ruleId: "sox_data_not_reconciled",
          framework: "SOX",
          severity: "medium",
          description: "Financial data not reconciled with source systems",
          recommendation: "Perform regular reconciliation of financial data",
        });
      }

      // Check for mathematical accuracy
      const mathErrors = this.validateMathematicalAccuracy(data);
      if (mathErrors.length > 0) {
        violations.push({
          ruleId: "sox_mathematical_errors",
          framework: "SOX",
          severity: "high",
          description: `Mathematical errors detected: ${mathErrors.join(", ")}`,
          recommendation:
            "Correct mathematical errors in financial calculations",
        });
      }
    }

    return violations;
  }

  /**
   * Check segregation of duties
   */
  private async checkSegregationOfDuties(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsFinancialData = this.detectFinancialData(data);
    const userRole = context.metadata.userRole;
    const operation = context.operation;

    if (containsFinancialData && userRole) {
      // Check for conflicting roles
      const hasConflictingRole = this.hasConflictingRole(
        userRole,
        operation,
        data,
      );
      if (hasConflictingRole) {
        violations.push({
          ruleId: "sox_conflicting_duties",
          framework: "SOX",
          severity: "critical",
          description: `User role ${userRole} has conflicting duties for operation ${operation}`,
          recommendation:
            "Separate conflicting duties among different personnel",
        });
      }

      // Check for maker-checker requirement
      const requiresMakerChecker = this.requiresMakerChecker(data, context);
      const hasChecker = context.metadata.checker;

      if (requiresMakerChecker && !hasChecker) {
        violations.push({
          ruleId: "sox_missing_maker_checker",
          framework: "SOX",
          severity: "high",
          description: "Financial operation requires maker-checker control",
          recommendation:
            "Implement maker-checker control for financial operations",
        });
      }

      if (hasChecker && hasChecker === context.userId) {
        violations.push({
          ruleId: "sox_self_checker",
          framework: "SOX",
          severity: "critical",
          description: "User cannot check their own work",
          recommendation: "Ensure different person performs checking function",
        });
      }
    }

    return violations;
  }

  /**
   * Check retention requirements
   */
  private async checkRetentionRequirements(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const containsFinancialData = this.detectFinancialData(data);

    if (containsFinancialData) {
      const retentionPeriod = context.metadata.retentionPeriod;
      const requiredRetention = this.getRequiredRetentionPeriod(data, context);

      // SOX requires minimum 7 years retention for most financial records
      if (!retentionPeriod || retentionPeriod < requiredRetention) {
        violations.push({
          ruleId: "sox_insufficient_retention",
          framework: "SOX",
          severity: "medium",
          description: `Retention period ${retentionPeriod || 0} years insufficient for required ${requiredRetention} years`,
          recommendation: `Set retention period to minimum ${requiredRetention} years for SOX compliance`,
        });
      }

      // Check for proper archival
      const isArchived = context.metadata.archived;
      const dataAge = context.metadata.dataAge;

      if (dataAge && dataAge > 2 * 365 * 24 * 60 * 60 * 1000 && !isArchived) {
        violations.push({
          ruleId: "sox_data_not_archived",
          framework: "SOX",
          severity: "low",
          description: "Financial data older than 2 years not archived",
          recommendation:
            "Archive financial data older than active operational period",
        });
      }
    }

    return violations;
  }

  /**
   * Detect financial data in dataset
   */
  private detectFinancialData(data: any): boolean {
    if (typeof data !== "object" || data === null) {
      return false;
    }

    if (Array.isArray(data)) {
      return data.some((item) => this.detectFinancialData(item));
    }

    const fields = Object.keys(data);
    return fields.some(
      (field) =>
        this.financialDataFields.has(field.toLowerCase()) ||
        this.containsFinancialPattern(field, data[field]),
    );
  }

  /**
   * Detect sensitive financial data
   */
  private detectSensitiveFinancialData(data: any): boolean {
    if (typeof data !== "object" || data === null) {
      return false;
    }

    if (Array.isArray(data)) {
      return data.some((item) => this.detectSensitiveFinancialData(item));
    }

    const fields = Object.keys(data);
    return fields.some((field) =>
      this.sensitiveFinancialFields.has(field.toLowerCase()),
    );
  }

  /**
   * Check if field contains financial data pattern
   */
  private containsFinancialPattern(field: string, value: any): boolean {
    if (typeof value !== "string" && typeof value !== "number") return false;

    const fieldLower = field.toLowerCase();
    const valueStr = String(value).toLowerCase();

    // Financial field patterns
    const financialKeywords = [
      "amount",
      "total",
      "balance",
      "cost",
      "price",
      "fee",
      "charge",
      "revenue",
      "income",
      "expense",
      "profit",
      "loss",
      "asset",
      "liability",
    ];

    return financialKeywords.some(
      (keyword) => fieldLower.includes(keyword) || valueStr.includes(keyword),
    );
  }

  /**
   * Check if operation requires approval workflow
   */
  private requiresApprovalWorkflow(
    data: any,
    context: ComplianceContext,
  ): boolean {
    // High-value transactions or sensitive operations require approval
    const amount = context.metadata.amount || this.extractAmount(data);
    const approvalThreshold = 10000; // $10,000 threshold

    return (
      (amount && amount > approvalThreshold) ||
      context.operation === "modify" ||
      context.operation === "delete" ||
      this.detectSensitiveFinancialData(data)
    );
  }

  /**
   * Get required approval level
   */
  private getRequiredApprovalLevel(
    data: any,
    context: ComplianceContext,
  ): number {
    const amount = context.metadata.amount || this.extractAmount(data);

    if (amount) {
      if (amount > 1000000) return 4; // CEO level
      if (amount > 100000) return 3; // CFO level
      if (amount > 10000) return 2; // Manager level
      return 1; // Supervisor level
    }

    return this.detectSensitiveFinancialData(data) ? 3 : 1;
  }

  /**
   * Check if operation requires dual control
   */
  private requiresDualControl(data: any, context: ComplianceContext): boolean {
    const amount = context.metadata.amount || this.extractAmount(data);
    const dualControlThreshold = 50000; // $50,000 threshold

    return (
      (amount && amount > dualControlThreshold) ||
      this.detectSensitiveFinancialData(data)
    );
  }

  /**
   * Extract monetary amount from data
   */
  private extractAmount(data: any): number | null {
    if (typeof data === "number") return data;
    if (typeof data !== "object" || data === null) return null;

    const amountFields = [
      "amount",
      "total",
      "value",
      "balance",
      "cost",
      "price",
    ];

    for (const field of amountFields) {
      if (field in data && typeof data[field] === "number") {
        return data[field];
      }
    }

    return null;
  }

  /**
   * Check if data requires reconciliation
   */
  private requiresReconciliation(
    data: any,
    context: ComplianceContext,
  ): boolean {
    // Financial statements and high-value transactions require reconciliation
    const amount = this.extractAmount(data);
    const reconciliationThreshold = 1000;

    return (
      (amount && amount > reconciliationThreshold) ||
      context.metadata.dataType === "financialStatement"
    );
  }

  /**
   * Validate mathematical accuracy
   */
  private validateMathematicalAccuracy(data: any): string[] {
    const errors: string[] = [];

    if (typeof data === "object" && data !== null) {
      // Check basic arithmetic relationships
      if ("subtotal" in data && "tax" in data && "total" in data) {
        const expectedTotal = (data.subtotal || 0) + (data.tax || 0);
        if (Math.abs((data.total || 0) - expectedTotal) > 0.01) {
          errors.push("Total does not equal subtotal + tax");
        }
      }

      if ("assets" in data && "liabilities" in data && "equity" in data) {
        const expectedEquity = (data.assets || 0) - (data.liabilities || 0);
        if (Math.abs((data.equity || 0) - expectedEquity) > 0.01) {
          errors.push("Assets do not equal liabilities + equity");
        }
      }
    }

    return errors;
  }

  /**
   * Check if user role has conflicting duties
   */
  private hasConflictingRole(
    userRole: string,
    operation: string,
    data: any,
  ): boolean {
    // Define conflicting role combinations
    const conflicts: Record<string, string[]> = {
      cashier: ["accountant", "auditor"],
      accountant: ["cashier", "auditor"],
      auditor: ["cashier", "accountant", "preparer"],
    };

    const userRoles = userRole
      .toLowerCase()
      .split(",")
      .map((r) => r.trim());

    for (const role of userRoles) {
      const conflictingRoles = conflicts[role] || [];
      if (userRoles.some((r) => conflictingRoles.includes(r))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if operation requires maker-checker
   */
  private requiresMakerChecker(data: any, context: ComplianceContext): boolean {
    const amount = this.extractAmount(data);
    const threshold = 5000; // $5,000 threshold

    return (
      (amount && amount > threshold) ||
      context.operation === "modify" ||
      context.operation === "delete"
    );
  }

  /**
   * Get required retention period in years
   */
  private getRequiredRetentionPeriod(
    data: any,
    context: ComplianceContext,
  ): number {
    // SOX Section 802 requires 7 years for most financial records
    if (this.detectSensitiveFinancialData(data)) {
      return 7; // Sensitive financial data
    }

    const dataType = context.metadata.dataType;
    const retentionPeriods: Record<string, number> = {
      financialStatement: 7,
      auditRecord: 7,
      taxRecord: 7,
      corporateRecord: 7,
      transaction: 5,
      invoice: 3,
      receipt: 3,
    };

    return retentionPeriods[dataType] || 7; // Default to 7 years
  }

  /**
   * Helper methods for rule checking
   */
  private hasChangeTracking(data: any, context: ComplianceContext): boolean {
    const containsFinancialData = this.detectFinancialData(data);
    if (!containsFinancialData) return true;

    return context.metadata.changeTracking === true;
  }

  private hasRequiredApproval(data: any, context: ComplianceContext): boolean {
    const requiresApproval = this.requiresApprovalWorkflow(data, context);
    if (!requiresApproval) return true;

    return context.metadata.approved === true;
  }

  private hasProperSegregation(data: any, context: ComplianceContext): boolean {
    const userRole = context.metadata.userRole;
    if (!userRole) return false;

    return !this.hasConflictingRole(userRole, context.operation, data);
  }

  private hasDataIntegrity(data: any, context: ComplianceContext): boolean {
    const containsFinancialData = this.detectFinancialData(data);
    if (!containsFinancialData) return true;

    return context.metadata.validated === true;
  }

  private meetsRetentionRequirements(
    data: any,
    context: ComplianceContext,
  ): boolean {
    const containsFinancialData = this.detectFinancialData(data);
    if (!containsFinancialData) return true;

    const retentionPeriod = context.metadata.retentionPeriod || 0;
    const requiredRetention = this.getRequiredRetentionPeriod(data, context);

    return retentionPeriod >= requiredRetention;
  }

  /**
   * Update SOX engine configuration
   */
  updateConfig(newConfig: Partial<SOXConfig>): void {
    Object.assign(this.config, newConfig);

    this.emit("config_updated", {
      timestamp: Date.now(),
      config: this.config,
    });
  }

  /**
   * Get SOX engine health status
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
      this.config.financialDataProtection,
      this.config.changeTracking,
    ];

    const enabledCriticalFeatures = criticalFeatures.filter(Boolean).length;
    if (enabledCriticalFeatures < 1) {
      status = "degraded";
    }

    return {
      status,
      details: {
        enabled: this.enabled,
        framework: this.framework,
        version: this.version,
        config: this.config,
        financialDataFields: this.financialDataFields.size,
        sensitiveFinancialFields: this.sensitiveFinancialFields.size,
      },
    };
  }
}
