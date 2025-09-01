/**
 * Compliance Engine Registry
 *
 * Central registry for all compliance frameworks with pluggable engines
 */

import { EventEmitter } from "node:events";
import {
  ComplianceRule,
  ComplianceResult,
  ComplianceViolation,
} from "../types/porter-types";
import { GDPRComplianceEngine } from "./GDPRComplianceEngine";
import { HIPAAComplianceEngine } from "./HIPAAComplianceEngine";
import { SOXComplianceEngine } from "./SOXComplianceEngine";

export interface ComplianceContext {
  requestId: string;
  userId: string;
  correlationId: string;
  timestamp: number;
  operation: "export" | "import" | "access" | "modify" | "delete";
  dataClassification: string;
  metadata: Record<string, any>;
}

export interface IComplianceEngine {
  readonly framework: string;
  readonly version: string;
  readonly enabled: boolean;

  validate(data: any, context: ComplianceContext): Promise<ComplianceResult>;
  checkRule(
    rule: ComplianceRule,
    data: any,
    context: ComplianceContext,
  ): Promise<boolean>;
  getViolations(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceViolation[]>;
  updateConfig(config: any): void;
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  };
}

export interface ComplianceReport {
  overall: ComplianceResult;
  frameworks: Record<string, ComplianceResult>;
  violations: ComplianceViolation[];
  recommendations: Array<{
    framework: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    action: string;
  }>;
  executionTime: number;
  context: ComplianceContext;
}

export class ComplianceEngineRegistry extends EventEmitter {
  private readonly engines = new Map<string, IComplianceEngine>();
  private readonly config: Record<string, any> = {};

  constructor() {
    super();
    this.registerBuiltInEngines();
  }

  /**
   * Register built-in compliance engines
   */
  private registerBuiltInEngines(): void {
    // GDPR Engine
    const gdprEngine = new GDPRComplianceEngine({
      enabled: true,
      dataSubjectRights: true,
      consentTracking: true,
      dataPortability: true,
      rightToErasure: true,
    });
    this.register("GDPR", gdprEngine);

    // HIPAA Engine
    const hipaaEngine = new HIPAAComplianceEngine({
      enabled: true,
      phiDetection: true,
      accessLogging: true,
      encryptionRequired: true,
      auditTrail: true,
    });
    this.register("HIPAA", hipaaEngine);

    // SOX Engine
    const soxEngine = new SOXComplianceEngine({
      enabled: true,
      financialDataProtection: true,
      changeTracking: true,
      approvalWorkflow: false,
    });
    this.register("SOX", soxEngine);
  }

  /**
   * Register a compliance engine
   */
  register(framework: string, engine: IComplianceEngine): void {
    this.engines.set(framework, engine);
    this.config[framework] = { enabled: engine.enabled };

    // Forward engine events
    engine.on?.("violation_detected", (event: any) => {
      this.emit("violation_detected", {
        framework,
        ...event,
      });
    });

    engine.on?.("compliance_check", (event: any) => {
      this.emit("compliance_check", {
        framework,
        ...event,
      });
    });

    this.emit("engine_registered", {
      framework,
      version: engine.version,
      enabled: engine.enabled,
    });
  }

  /**
   * Unregister a compliance engine
   */
  unregister(framework: string): boolean {
    const engine = this.engines.get(framework);
    if (engine) {
      this.engines.delete(framework);
      delete this.config[framework];

      this.emit("engine_unregistered", {
        framework,
        timestamp: Date.now(),
      });

      return true;
    }
    return false;
  }

  /**
   * Get compliance engine
   */
  getEngine(framework: string): IComplianceEngine | undefined {
    return this.engines.get(framework);
  }

  /**
   * List all registered frameworks
   */
  listFrameworks(): Array<{
    framework: string;
    version: string;
    enabled: boolean;
    description?: string;
  }> {
    const frameworks: Array<{
      framework: string;
      version: string;
      enabled: boolean;
      description?: string;
    }> = [];

    for (const [name, engine] of this.engines.entries()) {
      frameworks.push({
        framework: name,
        version: engine.version,
        enabled: engine.enabled,
        description: this.getFrameworkDescription(name),
      });
    }

    return frameworks;
  }

  /**
   * Comprehensive compliance validation
   */
  async validate(
    data: any,
    context: ComplianceContext,
  ): Promise<ComplianceReport> {
    const startTime = Date.now();

    try {
      const frameworkResults: Record<string, ComplianceResult> = {};
      const allViolations: ComplianceViolation[] = [];
      let overallCompliant = true;

      this.emit("validation_started", {
        context,
        activeFrameworks: this.getActiveFrameworks().length,
      });

      // Run all active engines
      const activeEngines = Array.from(this.engines.entries()).filter(
        ([_, engine]) => engine.enabled,
      );

      for (const [framework, engine] of activeEngines) {
        try {
          const result = await engine.validate(data, context);
          frameworkResults[framework] = result;

          if (!result.gdpr && framework === "GDPR") overallCompliant = false;
          if (!result.hipaa && framework === "HIPAA") overallCompliant = false;
          if (!result.sox && framework === "SOX") overallCompliant = false;

          // Collect violations
          const violations = await engine.getViolations(data, context);
          allViolations.push(...violations);

          this.emit("framework_validated", {
            context,
            framework,
            compliant: this.getFrameworkCompliance(result, framework),
            violationCount: violations.length,
          });
        } catch (error) {
          // Framework validation failure
          frameworkResults[framework] = {
            gdpr: framework !== "GDPR",
            hipaa: framework !== "HIPAA",
            sox: framework !== "SOX",
            customRules: true,
            violations: [
              {
                ruleId: `${framework.toLowerCase()}_engine_error`,
                framework,
                severity: "critical",
                description: `${framework} compliance validation failed: ${error.message}`,
                recommendation: `Review ${framework} engine configuration and data format`,
              },
            ],
          };

          overallCompliant = false;

          this.emit("framework_error", {
            context,
            framework,
            error: error.message,
          });
        }
      }

      // Generate overall compliance result
      const overallResult: ComplianceResult = {
        gdpr: frameworkResults.GDPR?.gdpr ?? true,
        hipaa: frameworkResults.HIPAA?.hipaa ?? true,
        sox: frameworkResults.SOX?.sox ?? true,
        customRules: Object.values(frameworkResults).every(
          (r) => r.customRules,
        ),
        violations: allViolations,
      };

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        frameworkResults,
        allViolations,
      );

      const report: ComplianceReport = {
        overall: overallResult,
        frameworks: frameworkResults,
        violations: allViolations,
        recommendations,
        executionTime: Date.now() - startTime,
        context,
      };

      this.emit("validation_complete", {
        context,
        report: {
          overallCompliant,
          frameworkCount: Object.keys(frameworkResults).length,
          violationCount: allViolations.length,
          executionTime: report.executionTime,
        },
      });

      return report;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.emit("validation_error", {
        context,
        error: error.message,
        executionTime,
      });

      throw new Error(`Compliance validation failed: ${error.message}`);
    }
  }

  /**
   * Check specific compliance rule across all frameworks
   */
  async checkRule(
    rule: ComplianceRule,
    data: any,
    context: ComplianceContext,
  ): Promise<
    {
      framework: string;
      compliant: boolean;
      details?: any;
    }[]
  > {
    const results: {
      framework: string;
      compliant: boolean;
      details?: any;
    }[] = [];

    const targetEngines =
      rule.framework === "CUSTOM"
        ? Array.from(this.engines.entries())
        : [[rule.framework, this.engines.get(rule.framework)]].filter(
            ([_, engine]) => engine,
          );

    for (const [framework, engine] of targetEngines as [
      string,
      IComplianceEngine,
    ][]) {
      if (!engine.enabled) continue;

      try {
        const compliant = await engine.checkRule(rule, data, context);
        results.push({
          framework,
          compliant,
          details: { rule: rule.id, condition: rule.condition },
        });

        this.emit("rule_checked", {
          context,
          framework,
          rule: rule.id,
          compliant,
        });
      } catch (error) {
        results.push({
          framework,
          compliant: false,
          details: { error: error.message },
        });
      }
    }

    return results;
  }

  /**
   * Get active compliance frameworks
   */
  getActiveFrameworks(): string[] {
    return Array.from(this.engines.entries())
      .filter(([_, engine]) => engine.enabled)
      .map(([name, _]) => name);
  }

  /**
   * Update framework configuration
   */
  updateFrameworkConfig(framework: string, config: any): void {
    const engine = this.engines.get(framework);
    if (engine) {
      engine.updateConfig(config);
      this.config[framework] = { ...this.config[framework], ...config };

      this.emit("config_updated", {
        framework,
        config,
        timestamp: Date.now(),
      });
    } else {
      throw new Error(`Framework not found: ${framework}`);
    }
  }

  /**
   * Enable/disable framework
   */
  setFrameworkEnabled(framework: string, enabled: boolean): void {
    const engine = this.engines.get(framework);
    if (engine) {
      engine.updateConfig({ enabled });
      this.config[framework] = { ...this.config[framework], enabled };

      this.emit("framework_toggled", {
        framework,
        enabled,
        timestamp: Date.now(),
      });
    } else {
      throw new Error(`Framework not found: ${framework}`);
    }
  }

  /**
   * Get compliance statistics
   */
  getStatistics(): {
    totalFrameworks: number;
    activeFrameworks: number;
    recentViolations: number;
    complianceRate: number;
  } {
    const totalFrameworks = this.engines.size;
    const activeFrameworks = this.getActiveFrameworks().length;

    // This would typically be collected from metrics
    return {
      totalFrameworks,
      activeFrameworks,
      recentViolations: 0,
      complianceRate: 1.0,
    };
  }

  /**
   * Test compliance engine
   */
  async test(
    framework?: string,
    testData?: any,
  ): Promise<{
    success: boolean;
    error?: string;
    results?: Record<string, any>;
  }> {
    try {
      const testContext: ComplianceContext = {
        requestId: "compliance-test",
        userId: "system",
        correlationId: "test-run",
        timestamp: Date.now(),
        operation: "export",
        dataClassification: "internal",
        metadata: { test: true },
      };

      const data = testData || {
        userId: "test-user",
        email: "test@example.com",
        personalData: "test data",
        phi: false,
      };

      let results: Record<string, any> = {};

      if (framework) {
        const engine = this.engines.get(framework);
        if (!engine) {
          throw new Error(`Framework not found: ${framework}`);
        }

        results[framework] = await engine.validate(data, testContext);
      } else {
        const report = await this.validate(data, testContext);
        results = report.frameworks;
      }

      return {
        success: true,
        results,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get registry health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  } {
    const engineHealths = new Map<string, any>();
    let unhealthyCount = 0;
    let degradedCount = 0;

    for (const [name, engine] of this.engines.entries()) {
      const health = engine.getHealthStatus();
      engineHealths.set(name, health);

      if (health.status === "unhealthy") {
        unhealthyCount++;
      } else if (health.status === "degraded") {
        degradedCount++;
      }
    }

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (unhealthyCount > 0) {
      status = "unhealthy";
    } else if (degradedCount > 1) {
      status = "unhealthy";
    } else if (degradedCount > 0) {
      status = "degraded";
    }

    if (this.engines.size === 0) {
      status = "unhealthy";
    }

    return {
      status,
      details: {
        totalEngines: this.engines.size,
        activeEngines: this.getActiveFrameworks().length,
        engineHealths: Object.fromEntries(engineHealths),
        statistics: this.getStatistics(),
      },
    };
  }

  /**
   * Generate compliance recommendations
   */
  private generateRecommendations(
    results: Record<string, ComplianceResult>,
    violations: ComplianceViolation[],
  ): Array<{
    framework: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    action: string;
  }> {
    const recommendations: Array<{
      framework: string;
      severity: "low" | "medium" | "high" | "critical";
      message: string;
      action: string;
    }> = [];

    // Framework-specific recommendations
    for (const [framework, result] of Object.entries(results)) {
      const frameworkViolations = violations.filter(
        (v) => v.framework === framework,
      );

      if (frameworkViolations.length > 0) {
        const criticalCount = frameworkViolations.filter(
          (v) => v.severity === "critical",
        ).length;
        const highCount = frameworkViolations.filter(
          (v) => v.severity === "high",
        ).length;

        if (criticalCount > 0) {
          recommendations.push({
            framework,
            severity: "critical",
            message: `${criticalCount} critical ${framework} violations detected`,
            action: "Immediate remediation required before data processing",
          });
        }

        if (highCount > 0) {
          recommendations.push({
            framework,
            severity: "high",
            message: `${highCount} high-severity ${framework} violations found`,
            action: "Address violations within compliance review cycle",
          });
        }
      }
    }

    // General recommendations
    if (violations.length > 10) {
      recommendations.push({
        framework: "general",
        severity: "high",
        message: "High volume of compliance violations detected",
        action:
          "Review data governance policies and implement preventive controls",
      });
    }

    return recommendations;
  }

  /**
   * Get framework compliance status
   */
  private getFrameworkCompliance(
    result: ComplianceResult,
    framework: string,
  ): boolean {
    switch (framework) {
      case "GDPR":
        return result.gdpr;
      case "HIPAA":
        return result.hipaa;
      case "SOX":
        return result.sox;
      default:
        return result.customRules;
    }
  }

  /**
   * Get framework description
   */
  private getFrameworkDescription(framework: string): string {
    const descriptions: Record<string, string> = {
      GDPR: "General Data Protection Regulation - EU privacy and data protection",
      HIPAA:
        "Health Insurance Portability and Accountability Act - US healthcare privacy",
      SOX: "Sarbanes-Oxley Act - US financial reporting and corporate governance",
      PCI: "Payment Card Industry Data Security Standard",
      ISO27001: "Information Security Management System standard",
    };

    return descriptions[framework] || `${framework} compliance framework`;
  }
}
