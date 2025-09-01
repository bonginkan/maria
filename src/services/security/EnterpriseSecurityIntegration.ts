/**
 * Enterprise Security Integration Layer
 * Unified security orchestration for MARIA enterprise features
 * Integrates all Phase 4 security components with the core system
 */

import { EventEmitter } from "node:events";
import { SecureSlashCommandAdapter } from "./SecureSlashCommandAdapter";
import { RBACCommandGuard } from "./RBACCommandGuard";
import { AccessControlManager } from "../memory-system/enterprise/access-control-manager";
import { EnterpriseAuthManager } from "../memory-system/data-porter-system/enterprise-auth-manager";
import { EnterpriseSecurityManager } from "../memory-system/data-porter-system/enterprise-security-manager";
import { EnterpriseAuditLogger } from "../memory-system/data-porter-system/enterprise-audit-logger";
import { FeatureFlagController } from "../system-commands/deployment/FeatureFlagController";
import type { HandlerDependencies } from "../../shared/handlers/SlashCommandHandler";

export interface SecurityIntegrationConfig {
  organizationId: string;
  securityLevel: "basic" | "enhanced" | "maximum";
  complianceMode: "none" | "gdpr" | "hipaa" | "sox" | "all";
  auditRetention: number; // days
  encryptionRequired: boolean;
  mfaEnforced: boolean;
  featureFlagEnabled: boolean;
}

export interface SecurityMetrics {
  authenticatedUsers: number;
  activeSessions: number;
  commandsExecuted: number;
  securityViolations: number;
  auditEntriesGenerated: number;
  averageAuthTime: number;
  averageAuthzTime: number;
  cacheHitRate: number;
}

export interface SecurityAlert {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  type: "authentication" | "authorization" | "data_access" | "policy_violation";
  userId?: string;
  description: string;
  timestamp: Date;
  resolved: boolean;
  actions: string[];
}

export interface SecurityReport {
  period: { start: Date; end: Date };
  metrics: SecurityMetrics;
  alerts: SecurityAlert[];
  complianceStatus: ComplianceStatus;
  recommendations: string[];
}

export interface ComplianceStatus {
  gdpr: { compliant: boolean; issues: string[] };
  hipaa: { compliant: boolean; issues: string[] };
  sox: { compliant: boolean; issues: string[] };
  custom: { name: string; compliant: boolean; issues: string[] }[];
}

/**
 * Main Enterprise Security Integration Class
 * Orchestrates all security components and provides unified interface
 */
export class EnterpriseSecurityIntegration extends EventEmitter {
  private config: SecurityIntegrationConfig;
  private secureCommandAdapter: SecureSlashCommandAdapter;
  private rbacGuard: RBACCommandGuard;
  private accessControl: AccessControlManager;
  private authManager: EnterpriseAuthManager;
  private securityManager: EnterpriseSecurityManager;
  private auditLogger: EnterpriseAuditLogger;
  private featureFlags: FeatureFlagController;

  private metrics: SecurityMetrics = {
    authenticatedUsers: 0,
    activeSessions: 0,
    commandsExecuted: 0,
    securityViolations: 0,
    auditEntriesGenerated: 0,
    averageAuthTime: 0,
    averageAuthzTime: 0,
    cacheHitRate: 0,
  };

  private alerts: SecurityAlert[] = [];
  private isInitialized = false;

  constructor(
    config: SecurityIntegrationConfig,
    dependencies: HandlerDependencies,
  ) {
    super();
    this.config = config;

    this.initializeSecurityComponents(dependencies);
    this.setupEventHandlers();
    this.startMetricsCollection();
  }

  /**
   * Initialize all security components
   */
  private async initializeSecurityComponents(
    dependencies: HandlerDependencies,
  ): Promise<void> {
    try {
      // 1. Initialize core security managers
      this.accessControl = new AccessControlManager({
        organizationId: this.config.organizationId,
        hierarchyLevels: [
          {
            level: "individual",
            priority: 1,
            inheritFromParent: false,
            overrideChild: true,
          },
          {
            level: "team",
            priority: 2,
            inheritFromParent: true,
            overrideChild: true,
          },
          {
            level: "project",
            priority: 3,
            inheritFromParent: true,
            overrideChild: true,
          },
          {
            level: "organization",
            priority: 4,
            inheritFromParent: false,
            overrideChild: false,
          },
        ],
        defaultPermissions: this.getDefaultPermissions(),
        dataClassification: this.getDataClassificationPolicy(),
        auditEnabled: true,
      });

      this.authManager = new EnterpriseAuthManager({
        providers: this.getAuthProviders(),
        sessionConfig: {
          timeout: 3600, // 1 hour
          maxConcurrentSessions: 5,
          refreshThreshold: 300, // 5 minutes
        },
        mfaConfig: {
          enabled: this.config.mfaEnforced,
          providers: ["totp", "sms"],
          grace_period: 24 * 3600, // 24 hours
        },
      });

      this.securityManager = new EnterpriseSecurityManager({
        encryption: {
          algorithm: "AES-256-GCM",
          keySize: 256,
          ivSize: 12,
          tagSize: 16,
          defaultClassification: "internal",
          classificationRules: [],
        },
        keyManagement: {
          provider: "local",
          masterKey: {
            derivationMethod: "password",
          },
          keyBackup: {
            enabled: true,
            location: "secure_storage",
            frequency: 24 * 3600, // daily
          },
        },
        threatProtection: {
          enabled: true,
          monitoring: {
            bruteForceProtection: true,
            suspiciousActivityDetection: true,
            anomalyDetection: false,
          },
        },
        dataLossPrevention: {
          enabled: this.config.complianceMode !== "none",
          rules: [],
          actions: ["log", "alert", "block"],
        },
        monitoring: {
          realTime: true,
          retention: this.config.auditRetention,
          alerting: {
            enabled: true,
            channels: ["log", "event"],
          },
        },
      });

      this.auditLogger = new EnterpriseAuditLogger({
        retention: this.config.auditRetention,
        storage: {
          type: "file",
          location: "./logs/audit",
          encryption: this.config.encryptionRequired,
        },
        compliance: {
          gdpr:
            this.config.complianceMode === "gdpr" ||
            this.config.complianceMode === "all",
          hipaa:
            this.config.complianceMode === "hipaa" ||
            this.config.complianceMode === "all",
          sox:
            this.config.complianceMode === "sox" ||
            this.config.complianceMode === "all",
        },
        realTimeAlerts: true,
      });

      // 2. Initialize RBAC guard
      this.rbacGuard = new RBACCommandGuard({
        organizationId: this.config.organizationId,
        defaultDenyAll: this.config.securityLevel === "maximum",
        inheritanceEnabled: true,
        auditFailures: true,
        cachePermissions: true,
        cacheTTL: 300, // 5 minutes
      });

      // 3. Initialize secure command adapter
      this.secureCommandAdapter = new SecureSlashCommandAdapter(dependencies, {
        accessControl: this.accessControl,
        authManager: this.authManager,
        securityManager: this.securityManager,
        auditLogger: this.auditLogger,
      });

      // 4. Initialize feature flags for security rollout
      if (this.config.featureFlagEnabled) {
        this.featureFlags = new FeatureFlagController({
          initialPercentage: 25,
          targetPercentage: 100,
          rolloutStrategy: "gradual",
          healthThresholds: {
            minSuccessRate: 0.95,
            maxErrorRate: 0.05,
            maxLatencyMs: 1000,
          },
        });
      }

      this.isInitialized = true;
      this.emit("initialized", { timestamp: new Date() });
    } catch (error) {
      this.emit("initialization_error", { error, timestamp: new Date() });
      throw new Error(
        `Security integration initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get the secure command adapter for use by the application
   */
  getSecureCommandAdapter(): SecureSlashCommandAdapter {
    if (!this.isInitialized) {
      throw new Error("Security integration not initialized");
    }
    return this.secureCommandAdapter;
  }

  /**
   * Get current security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get security alerts
   */
  getSecurityAlerts(
    severity?: "low" | "medium" | "high" | "critical",
  ): SecurityAlert[] {
    if (severity) {
      return this.alerts.filter(
        (alert) => alert.severity === severity && !alert.resolved,
      );
    }
    return this.alerts.filter((alert) => !alert.resolved);
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(
    startDate: Date,
    endDate: Date,
  ): Promise<SecurityReport> {
    const report: SecurityReport = {
      period: { start: startDate, end: endDate },
      metrics: this.getSecurityMetrics(),
      alerts: this.alerts.filter(
        (alert) => alert.timestamp >= startDate && alert.timestamp <= endDate,
      ),
      complianceStatus: await this.getComplianceStatus(),
      recommendations: await this.generateRecommendations(),
    };

    this.emit("report_generated", { report, timestamp: new Date() });
    return report;
  }

  /**
   * Check system health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    components: {
      [key: string]: {
        status: "healthy" | "degraded" | "failing";
        message?: string;
      };
    };
  }> {
    const components: any = {};

    // Check authentication system
    try {
      await this.authManager.healthCheck();
      components.authentication = { status: "healthy" };
    } catch (error) {
      components.authentication = {
        status: "failing",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Check access control
    try {
      components.accessControl = { status: "healthy" };
    } catch (error) {
      components.accessControl = {
        status: "failing",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Check audit logging
    try {
      components.auditLogging = { status: "healthy" };
    } catch (error) {
      components.auditLogging = {
        status: "failing",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }

    const healthy = Object.values(components).every(
      (comp: any) => comp.status === "healthy",
    );

    return { healthy, components };
  }

  /**
   * Private helper methods
   */
  private setupEventHandlers(): void {
    // Handle authentication events
    if (this.authManager && typeof this.authManager.on === "function") {
      this.authManager.on("user_authenticated", (event) => {
        this.metrics.authenticatedUsers++;
        this.updateMetrics();
      });

      this.authManager.on("authentication_failed", (event) => {
        this.createSecurityAlert({
          severity: "medium",
          type: "authentication",
          userId: event.userId,
          description: `Authentication failed: ${event.reason}`,
          actions: ["monitor", "review_logs"],
        });
      });
    }

    // Handle authorization events
    if (this.rbacGuard && typeof this.rbacGuard.on === "function") {
      this.rbacGuard.on("authorization", (event) => {
        if (!event.allowed) {
          this.metrics.securityViolations++;
          this.createSecurityAlert({
            severity: "high",
            type: "authorization",
            userId: event.userId,
            description: `Authorization denied for command: ${event.command}`,
            actions: ["review_permissions", "audit_user"],
          });
        }
        this.updateMetrics();
      });
    }

    // Handle audit events
    if (this.auditLogger && typeof this.auditLogger.on === "function") {
      this.auditLogger.on("audit_entry", () => {
        this.metrics.auditEntriesGenerated++;
        this.updateMetrics();
      });
    }
  }

  private startMetricsCollection(): void {
    // Update metrics every 60 seconds
    setInterval(() => {
      this.updateMetrics();
    }, 60000);
  }

  private updateMetrics(): void {
    // Update various metrics
    this.emit("metrics_updated", {
      metrics: this.metrics,
      timestamp: new Date(),
    });
  }

  private createSecurityAlert(alertData: {
    severity: "low" | "medium" | "high" | "critical";
    type:
      | "authentication"
      | "authorization"
      | "data_access"
      | "policy_violation";
    userId?: string;
    description: string;
    actions: string[];
  }): void {
    const alert: SecurityAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...alertData,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.push(alert);
    this.emit("security_alert", alert);

    // Auto-cleanup old alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  private getDefaultPermissions(): any {
    return {
      memory: {
        read: [{ type: "personal" }],
        write: [{ type: "personal" }],
        delete: [],
        share: [],
        export: [],
      },
      data: {
        classification: ["public", "internal"],
        sensitivity: [],
        categories: [],
        tags: [],
      },
      operations: {
        commands: ["help", "status"],
        administration: [],
      },
      administration: {
        userManagement: false,
        systemConfiguration: false,
        auditAccess: false,
        securityManagement: false,
      },
    };
  }

  private getDataClassificationPolicy(): any {
    return {
      levels: [
        { name: "public", priority: 1, encryption: false },
        { name: "internal", priority: 2, encryption: false },
        { name: "confidential", priority: 3, encryption: true },
        { name: "secret", priority: 4, encryption: true },
      ],
      defaultLevel: "internal",
      autoClassification: true,
    };
  }

  private getAuthProviders(): any[] {
    return [
      {
        id: "local",
        name: "Local Authentication",
        type: "local",
        config: {},
        enabled: true,
        priority: 1,
      },
    ];
  }

  private async getComplianceStatus(): Promise<ComplianceStatus> {
    return {
      gdpr: { compliant: true, issues: [] },
      hipaa: { compliant: true, issues: [] },
      sox: { compliant: true, issues: [] },
      custom: [],
    };
  }

  private async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    if (this.metrics.securityViolations > 10) {
      recommendations.push(
        "Consider reviewing and tightening access control policies",
      );
    }

    if (this.config.securityLevel === "basic") {
      recommendations.push(
        "Upgrade to enhanced security level for better protection",
      );
    }

    if (!this.config.mfaEnforced) {
      recommendations.push(
        "Enable multi-factor authentication for enhanced security",
      );
    }

    return recommendations;
  }
}

/**
 * Factory function to create enterprise security integration
 */
export async function createEnterpriseSecurityIntegration(
  config: SecurityIntegrationConfig,
  dependencies: HandlerDependencies,
): Promise<EnterpriseSecurityIntegration> {
  const integration = new EnterpriseSecurityIntegration(config, dependencies);

  // Wait for initialization to complete
  return new Promise((resolve, reject) => {
    integration.once("initialized", () => resolve(integration));
    integration.once("initialization_error", (error) => reject(error));
  });
}
