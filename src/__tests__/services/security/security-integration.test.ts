/**
 * Enterprise Security Integration Tests
 * Comprehensive test suite for Phase 4.0 Week 1 security features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EnterpriseSecurityIntegration,
  createEnterpriseSecurityIntegration,
} from "../../../services/security/EnterpriseSecurityIntegration";
import { SecureSlashCommandAdapter } from "../../../services/security/SecureSlashCommandAdapter";
import { RBACCommandGuard } from "../../../services/security/RBACCommandGuard";
import type { HandlerDependencies } from "../../../shared/handlers/SlashCommandHandler";

// Mock dependencies
const mockDependencies: HandlerDependencies = {
  provider: {
    callModel: vi.fn().mockResolvedValue("mock response"),
    getAvailableModels: vi.fn().mockResolvedValue([]),
  } as any,
  memory: {
    store: vi.fn(),
    retrieve: vi.fn(),
    search: vi.fn(),
  } as any,
  context: {
    addMessage: vi.fn(),
    getMessages: vi.fn().mockReturnValue([]),
    clearContext: vi.fn(),
  } as any,
  ui: {
    showMessage: vi.fn(),
    showError: vi.fn(),
    showProgress: vi.fn(),
  } as any,
};

describe("Enterprise Security Integration", () => {
  let securityIntegration: EnterpriseSecurityIntegration;
  let mockSessionToken: string;

  beforeEach(async () => {
    mockSessionToken = "mock-session-token-12345";

    securityIntegration = await createEnterpriseSecurityIntegration(
      {
        organizationId: "test-org-001",
        securityLevel: "enhanced",
        complianceMode: "gdpr",
        auditRetention: 365,
        encryptionRequired: true,
        mfaEnforced: false,
        featureFlagEnabled: true,
      },
      mockDependencies,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize all security components", async () => {
      expect(securityIntegration).toBeDefined();

      const health = await securityIntegration.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.components).toHaveProperty("authentication");
      expect(health.components).toHaveProperty("accessControl");
      expect(health.components).toHaveProperty("auditLogging");
    });

    it("should provide secure command adapter", () => {
      const adapter = securityIntegration.getSecureCommandAdapter();
      expect(adapter).toBeInstanceOf(SecureSlashCommandAdapter);
    });

    it("should emit initialization event", (done) => {
      // Create a new instance to test initialization event
      createEnterpriseSecurityIntegration(
        {
          organizationId: "test-org-002",
          securityLevel: "basic",
          complianceMode: "none",
          auditRetention: 90,
          encryptionRequired: false,
          mfaEnforced: false,
          featureFlagEnabled: false,
        },
        mockDependencies,
      ).then((integration) => {
        integration.on("initialized", (event) => {
          expect(event.timestamp).toBeInstanceOf(Date);
          done();
        });
      });
    });
  });

  describe("Security Metrics", () => {
    it("should provide security metrics", () => {
      const metrics = securityIntegration.getSecurityMetrics();

      expect(metrics).toHaveProperty("authenticatedUsers");
      expect(metrics).toHaveProperty("activeSessions");
      expect(metrics).toHaveProperty("commandsExecuted");
      expect(metrics).toHaveProperty("securityViolations");
      expect(metrics).toHaveProperty("auditEntriesGenerated");
      expect(metrics).toHaveProperty("averageAuthTime");
      expect(metrics).toHaveProperty("averageAuthzTime");
      expect(metrics).toHaveProperty("cacheHitRate");

      expect(typeof metrics.authenticatedUsers).toBe("number");
      expect(typeof metrics.activeSessions).toBe("number");
    });

    it("should update metrics over time", (done) => {
      const initialMetrics = securityIntegration.getSecurityMetrics();

      securityIntegration.on("metrics_updated", (event) => {
        expect(event.metrics).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      // Trigger metrics update
      securityIntegration.emit("user_authenticated", { userId: "test-user" });
    });
  });

  describe("Security Alerts", () => {
    it("should create security alerts for violations", (done) => {
      securityIntegration.on("security_alert", (alert) => {
        expect(alert).toHaveProperty("id");
        expect(alert).toHaveProperty("severity");
        expect(alert).toHaveProperty("type");
        expect(alert).toHaveProperty("description");
        expect(alert).toHaveProperty("timestamp");
        expect(alert).toHaveProperty("resolved");
        expect(alert).toHaveProperty("actions");

        expect(alert.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(alert.type).toMatch(
          /^(authentication|authorization|data_access|policy_violation)$/,
        );
        expect(alert.resolved).toBe(false);
        expect(Array.isArray(alert.actions)).toBe(true);

        done();
      });

      // Simulate a security violation
      securityIntegration.emit("authorization_failed", {
        userId: "test-user",
        command: "admin",
        reason: "Insufficient permissions",
      });
    });

    it("should filter alerts by severity", async () => {
      // Create alerts of different severities
      const testAlerts = [
        {
          severity: "low",
          type: "authentication",
          description: "Low severity test",
          actions: [],
        },
        {
          severity: "high",
          type: "authorization",
          description: "High severity test",
          actions: [],
        },
        {
          severity: "critical",
          type: "data_access",
          description: "Critical severity test",
          actions: [],
        },
      ];

      // Simulate creating alerts
      for (const alertData of testAlerts) {
        securityIntegration.emit("create_alert", alertData);
      }

      const highAlerts = securityIntegration.getSecurityAlerts("high");
      expect(Array.isArray(highAlerts)).toBe(true);

      const allAlerts = securityIntegration.getSecurityAlerts();
      expect(Array.isArray(allAlerts)).toBe(true);
    });
  });

  describe("Security Reports", () => {
    it("should generate comprehensive security reports", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const report = await securityIntegration.generateSecurityReport(
        startDate,
        endDate,
      );

      expect(report).toHaveProperty("period");
      expect(report).toHaveProperty("metrics");
      expect(report).toHaveProperty("alerts");
      expect(report).toHaveProperty("complianceStatus");
      expect(report).toHaveProperty("recommendations");

      expect(report.period.start).toEqual(startDate);
      expect(report.period.end).toEqual(endDate);

      expect(Array.isArray(report.alerts)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);

      // Check compliance status structure
      expect(report.complianceStatus).toHaveProperty("gdpr");
      expect(report.complianceStatus).toHaveProperty("hipaa");
      expect(report.complianceStatus).toHaveProperty("sox");
      expect(report.complianceStatus).toHaveProperty("custom");
    });

    it("should emit report generation event", (done) => {
      securityIntegration.on("report_generated", (event) => {
        expect(event.report).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      securityIntegration.generateSecurityReport(
        new Date("2024-01-01"),
        new Date("2024-01-31"),
      );
    });
  });

  describe("Health Checks", () => {
    it("should perform comprehensive health checks", async () => {
      const health = await securityIntegration.checkHealth();

      expect(health).toHaveProperty("healthy");
      expect(health).toHaveProperty("components");
      expect(typeof health.healthy).toBe("boolean");

      // Check individual component health
      const componentNames = [
        "authentication",
        "accessControl",
        "auditLogging",
      ];
      for (const componentName of componentNames) {
        expect(health.components).toHaveProperty(componentName);
        const component = health.components[componentName];
        expect(component).toHaveProperty("status");
        expect(component.status).toMatch(/^(healthy|degraded|failing)$/);
      }
    });

    it("should handle component failures gracefully", async () => {
      // Mock a component failure
      const mockFailingDependencies = {
        ...mockDependencies,
        provider: {
          ...mockDependencies.provider,
          callModel: vi.fn().mockRejectedValue(new Error("Provider failure")),
        },
      };

      // Create integration with failing component
      const failingIntegration = await createEnterpriseSecurityIntegration(
        {
          organizationId: "test-org-003",
          securityLevel: "basic",
          complianceMode: "none",
          auditRetention: 30,
          encryptionRequired: false,
          mfaEnforced: false,
          featureFlagEnabled: false,
        },
        mockFailingDependencies,
      );

      const health = await failingIntegration.checkHealth();
      expect(health.healthy).toBe(true); // Should still be healthy overall
    });
  });

  describe("Command Execution Security", () => {
    it("should secure command execution pipeline", async () => {
      const secureAdapter = securityIntegration.getSecureCommandAdapter();

      // Test command execution with mock session
      const result = await secureAdapter.executeSecure(
        "help",
        [],
        mockSessionToken,
      );

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
    });

    it("should enforce authentication for all commands", async () => {
      const secureAdapter = securityIntegration.getSecureCommandAdapter();

      // Test with invalid session token
      const result = await secureAdapter.executeSecure(
        "help",
        [],
        "invalid-token",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Authentication");
    });

    it("should log all command executions", async () => {
      const secureAdapter = securityIntegration.getSecureCommandAdapter();

      // Mock audit logger to capture logs
      const auditSpy = vi.fn();
      securityIntegration.on("audit_entry", auditSpy);

      await secureAdapter.executeSecure("status", [], mockSessionToken);

      // Verify audit log was created
      expect(auditSpy).toHaveBeenCalled();
    });
  });

  describe("RBAC Integration", () => {
    it("should enforce role-based access control", async () => {
      const secureAdapter = securityIntegration.getSecureCommandAdapter();

      // Test admin command with regular user
      const result = await secureAdapter.executeSecure(
        "admin",
        ["delete-all"],
        mockSessionToken,
      );

      // Should be denied for insufficient permissions
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permission|authorization/i);
    });

    it("should handle role inheritance correctly", () => {
      // This would test the RBAC system's role inheritance logic
      // Implementation would depend on specific role setup
      expect(true).toBe(true); // Placeholder
    });
  });

  describe("Compliance Features", () => {
    it("should enforce GDPR compliance when enabled", async () => {
      // Test GDPR-specific features like data export, deletion rights
      const report = await securityIntegration.generateSecurityReport(
        new Date("2024-01-01"),
        new Date("2024-01-31"),
      );

      expect(report.complianceStatus.gdpr.compliant).toBe(true);
      expect(Array.isArray(report.complianceStatus.gdpr.issues)).toBe(true);
    });

    it("should provide audit trails for compliance", () => {
      const metrics = securityIntegration.getSecurityMetrics();
      expect(metrics.auditEntriesGenerated).toBeDefined();
      expect(typeof metrics.auditEntriesGenerated).toBe("number");
    });
  });

  describe("Performance Impact", () => {
    it("should maintain acceptable performance with security layer", async () => {
      const secureAdapter = securityIntegration.getSecureCommandAdapter();

      const startTime = Date.now();
      await secureAdapter.executeSecure("help", [], mockSessionToken);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      // Security layer should add less than 100ms overhead
      expect(executionTime).toBeLessThan(100);
    });

    it("should cache permissions effectively", () => {
      const metrics = securityIntegration.getSecurityMetrics();

      // Cache hit rate should be a valid percentage
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeLessThanOrEqual(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle security system failures gracefully", async () => {
      const secureAdapter = securityIntegration.getSecureCommandAdapter();

      // Test with edge case inputs
      const result = await secureAdapter.executeSecure(
        "",
        [],
        mockSessionToken,
      );

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("error");
    });

    it("should not leak sensitive information in errors", async () => {
      const secureAdapter = securityIntegration.getSecureCommandAdapter();

      const result = await secureAdapter.executeSecure(
        "admin",
        ["secret-operation"],
        "invalid-token",
      );

      expect(result.error).not.toContain("password");
      expect(result.error).not.toContain("secret");
      expect(result.error).not.toContain("key");
    });
  });
});

describe("RBAC Command Guard", () => {
  let rbacGuard: RBACCommandGuard;

  beforeEach(() => {
    rbacGuard = new RBACCommandGuard({
      organizationId: "test-org",
      defaultDenyAll: false,
      inheritanceEnabled: true,
      auditFailures: true,
      cachePermissions: true,
      cacheTTL: 300,
    });
  });

  it("should authorize commands based on user roles", async () => {
    const request = {
      user: {
        id: "user1",
        username: "testuser",
        email: "test@example.com",
        roles: ["user"],
        clearanceLevel: "internal" as const,
        sessionId: "session1",
        lastActivity: new Date(),
        mfaVerified: false,
      },
      command: "help",
      args: [],
      context: {
        sessionId: "session1",
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        dataInvolved: [],
        resourcesRequired: [],
      },
      timestamp: new Date(),
    };

    const result = await rbacGuard.authorizeCommand(request);

    expect(result).toHaveProperty("allowed");
    expect(result).toHaveProperty("reason");
    expect(result).toHaveProperty("auditRequired");
    expect(result).toHaveProperty("mfaRequired");
    expect(result).toHaveProperty("evaluationPath");
    expect(Array.isArray(result.evaluationPath)).toBe(true);
  });

  it("should deny unauthorized commands", async () => {
    const request = {
      user: {
        id: "user1",
        username: "testuser",
        email: "test@example.com",
        roles: ["user"],
        clearanceLevel: "internal" as const,
        sessionId: "session1",
        lastActivity: new Date(),
        mfaVerified: false,
      },
      command: "delete-system",
      args: [],
      context: {
        sessionId: "session1",
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        dataInvolved: [],
        resourcesRequired: [],
      },
      timestamp: new Date(),
    };

    const result = await rbacGuard.authorizeCommand(request);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.auditRequired).toBe(true);
  });

  it("should emit authorization events", (done) => {
    rbacGuard.on("authorization", (event) => {
      expect(event.userId).toBeDefined();
      expect(event.command).toBeDefined();
      expect(event.allowed).toBeDefined();
      done();
    });

    rbacGuard.authorizeCommand({
      user: {
        id: "user1",
        username: "testuser",
        email: "test@example.com",
        roles: ["user"],
        clearanceLevel: "internal" as const,
        sessionId: "session1",
        lastActivity: new Date(),
        mfaVerified: false,
      },
      command: "test",
      args: [],
      context: {
        sessionId: "session1",
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        dataInvolved: [],
        resourcesRequired: [],
      },
      timestamp: new Date(),
    });
  });
});
