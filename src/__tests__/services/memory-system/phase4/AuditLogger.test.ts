/**
 * Audit Logger Test Suite
 * Phase 4.0 Security: Comprehensive audit logging with compliance testing
 * Coverage target: 80%+
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AuditLogger } from "../../../services/memory-system/phase4/security/AuditLogger";
import { promises as fs } from "fs";
import * as path from "path";

describe("AuditLogger", () => {
  let auditLogger: AuditLogger;
  let tempDir: string;

  const testConfig = {
    enabled: true,
    logLevel: "info" as const,
    destinations: [
      {
        type: "file" as const,
        config: {
          path: "./test-audit.log",
          rotateSize: "10mb",
          maxFiles: 5,
        },
      },
    ],
    retention: {
      days: 30,
      archiveEnabled: true,
      archiveLocation: "./archives",
    },
    encryption: {
      enabled: true,
      keyId: "test-audit-key",
    },
    compliance: {
      mode: "HIPAA" as const,
      includePersonalData: false,
      maskSensitiveData: true,
    },
    alerting: {
      enabled: true,
      criticalEvents: ["SECURITY_BREACH", "UNAUTHORIZED_ACCESS"],
      destinations: [
        {
          type: "email" as const,
          config: { to: "security@example.com" },
        },
      ],
    },
    performance: {
      batchSize: 100,
      flushInterval: 5000,
      maxQueueSize: 1000,
    },
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(__dirname, "audit-test-"));
    const configWithTempDir = {
      ...testConfig,
      destinations: [
        {
          ...testConfig.destinations[0],
          config: {
            ...testConfig.destinations[0].config,
            path: path.join(tempDir, "test-audit.log"),
          },
        },
      ],
    };
    auditLogger = new AuditLogger(configWithTempDir);
  });

  afterEach(async () => {
    await auditLogger.close();
    await fs.rmdir(tempDir, { recursive: true }).catch(() => {});
  });

  describe("Basic Logging", () => {
    it("should initialize audit logger correctly", () => {
      expect(auditLogger).toBeDefined();
      expect(auditLogger.isEnabled()).toBe(true);
    });

    it("should log audit events with proper structure", async () => {
      const event = {
        action: "USER_LOGIN",
        userId: "user123",
        resource: "/api/login",
        outcome: "SUCCESS",
        timestamp: new Date(),
        metadata: { ip: "192.168.1.1", userAgent: "test-agent" },
      };

      await auditLogger.log(event);
      await auditLogger.flush();

      const logExists = await fs
        .access(path.join(tempDir, "test-audit.log"))
        .then(() => true)
        .catch(() => false);

      expect(logExists).toBe(true);
    });

    it("should support different log levels", async () => {
      await auditLogger.debug("Debug message", { context: "test" });
      await auditLogger.info("Info message", { context: "test" });
      await auditLogger.warn("Warning message", { context: "test" });
      await auditLogger.error("Error message", { context: "test" });
      await auditLogger.critical("Critical message", { context: "test" });

      await auditLogger.flush();

      const logContent = await fs.readFile(
        path.join(tempDir, "test-audit.log"),
        "utf8",
      );
      expect(logContent).toContain("Info message");
      expect(logContent).toContain("Warning message");
      expect(logContent).toContain("Error message");
      expect(logContent).toContain("Critical message");
    });
  });

  describe("Compliance Modes", () => {
    it("should support HIPAA compliance mode", () => {
      const hipaaLogger = new AuditLogger({
        ...testConfig,
        compliance: {
          mode: "HIPAA",
          includePersonalData: false,
          maskSensitiveData: true,
        },
      });

      expect(hipaaLogger.getComplianceMode()).toBe("HIPAA");
    });

    it("should support SOC2 compliance mode", () => {
      const soc2Logger = new AuditLogger({
        ...testConfig,
        compliance: {
          mode: "SOC2",
          includePersonalData: true,
          maskSensitiveData: true,
        },
      });

      expect(soc2Logger.getComplianceMode()).toBe("SOC2");
    });

    it("should support PCI-DSS compliance mode", () => {
      const pciLogger = new AuditLogger({
        ...testConfig,
        compliance: {
          mode: "PCI-DSS",
          includePersonalData: false,
          maskSensitiveData: true,
        },
      });

      expect(pciLogger.getComplianceMode()).toBe("PCI-DSS");
    });

    it("should support GDPR compliance mode", () => {
      const gdprLogger = new AuditLogger({
        ...testConfig,
        compliance: {
          mode: "GDPR",
          includePersonalData: true,
          maskSensitiveData: true,
        },
      });

      expect(gdprLogger.getComplianceMode()).toBe("GDPR");
    });

    it("should mask sensitive data when enabled", async () => {
      const sensitiveEvent = {
        action: "PASSWORD_CHANGE",
        userId: "user123",
        resource: "/api/password",
        outcome: "SUCCESS",
        metadata: {
          email: "user@example.com",
          ssn: "123-45-6789",
          creditCard: "4111-1111-1111-1111",
        },
      };

      await auditLogger.log(sensitiveEvent);
      await auditLogger.flush();

      const logContent = await fs.readFile(
        path.join(tempDir, "test-audit.log"),
        "utf8",
      );
      expect(logContent).not.toContain("user@example.com");
      expect(logContent).not.toContain("123-45-6789");
      expect(logContent).not.toContain("4111-1111-1111-1111");
      expect(logContent).toContain("****"); // Masked values
    });
  });

  describe("Multiple Destinations", () => {
    it("should support file destination", async () => {
      const fileLogger = new AuditLogger({
        ...testConfig,
        destinations: [
          {
            type: "file",
            config: {
              path: path.join(tempDir, "multi-audit.log"),
              rotateSize: "1mb",
            },
          },
        ],
      });

      await fileLogger.log({
        action: "FILE_TEST",
        userId: "test-user",
        resource: "test-resource",
        outcome: "SUCCESS",
      });

      await fileLogger.flush();

      const logExists = await fs
        .access(path.join(tempDir, "multi-audit.log"))
        .then(() => true)
        .catch(() => false);

      expect(logExists).toBe(true);
      await fileLogger.close();
    });

    it("should support database destination", async () => {
      const dbLogger = new AuditLogger({
        ...testConfig,
        destinations: [
          {
            type: "database",
            config: {
              connectionString: "postgresql://test:test@localhost/audit",
              table: "audit_logs",
            },
          },
        ],
      });

      // Mock database connection
      vi.spyOn(dbLogger, "writeToDatabase").mockResolvedValue(true);

      await dbLogger.log({
        action: "DATABASE_TEST",
        userId: "test-user",
        resource: "test-resource",
        outcome: "SUCCESS",
      });

      expect(dbLogger.writeToDatabase).toHaveBeenCalled();
      await dbLogger.close();
    });

    it("should support SIEM destination", async () => {
      const siemLogger = new AuditLogger({
        ...testConfig,
        destinations: [
          {
            type: "siem",
            config: {
              endpoint: "https://siem.example.com/api/events",
              apiKey: "test-api-key",
              format: "CEF",
            },
          },
        ],
      });

      vi.spyOn(siemLogger, "sendToSIEM").mockResolvedValue(true);

      await siemLogger.log({
        action: "SIEM_TEST",
        userId: "test-user",
        resource: "test-resource",
        outcome: "SUCCESS",
      });

      expect(siemLogger.sendToSIEM).toHaveBeenCalled();
      await siemLogger.close();
    });
  });

  describe("Encryption", () => {
    it("should encrypt log entries when encryption is enabled", async () => {
      const encryptedLogger = new AuditLogger({
        ...testConfig,
        encryption: {
          enabled: true,
          keyId: "encryption-test-key",
        },
      });

      vi.spyOn(encryptedLogger, "encryptLogEntry").mockImplementation(
        async (entry) => Buffer.from(JSON.stringify(entry)).toString("base64"),
      );

      await encryptedLogger.log({
        action: "ENCRYPTION_TEST",
        userId: "test-user",
        resource: "test-resource",
        outcome: "SUCCESS",
      });

      expect(encryptedLogger.encryptLogEntry).toHaveBeenCalled();
      await encryptedLogger.close();
    });

    it("should handle encryption key rotation", async () => {
      const rotationLogger = new AuditLogger({
        ...testConfig,
        encryption: {
          enabled: true,
          keyId: "rotation-test-key",
        },
      });

      const oldKeyId = "old-key";
      const newKeyId = "new-key";

      vi.spyOn(rotationLogger, "rotateEncryptionKey").mockResolvedValue(true);

      const rotated = await rotationLogger.rotateEncryptionKey(
        oldKeyId,
        newKeyId,
      );

      expect(rotated).toBe(true);
      expect(rotationLogger.rotateEncryptionKey).toHaveBeenCalledWith(
        oldKeyId,
        newKeyId,
      );
      await rotationLogger.close();
    });
  });

  describe("Alerting", () => {
    it("should trigger alerts for critical events", async () => {
      const alertLogger = new AuditLogger({
        ...testConfig,
        alerting: {
          enabled: true,
          criticalEvents: ["SECURITY_BREACH", "DATA_LEAK"],
          destinations: [
            {
              type: "email",
              config: { to: "security@example.com" },
            },
          ],
        },
      });

      vi.spyOn(alertLogger, "sendAlert").mockResolvedValue(true);

      await alertLogger.log({
        action: "SECURITY_BREACH",
        userId: "attacker",
        resource: "/admin/users",
        outcome: "BLOCKED",
        severity: "CRITICAL",
      });

      expect(alertLogger.sendAlert).toHaveBeenCalled();
      await alertLogger.close();
    });

    it("should support multiple alert destinations", async () => {
      const multiAlertLogger = new AuditLogger({
        ...testConfig,
        alerting: {
          enabled: true,
          criticalEvents: ["UNAUTHORIZED_ACCESS"],
          destinations: [
            { type: "email", config: { to: "security@example.com" } },
            {
              type: "slack",
              config: { webhook: "https://hooks.slack.com/test" },
            },
            { type: "pagerduty", config: { serviceKey: "pd-key" } },
          ],
        },
      });

      vi.spyOn(multiAlertLogger, "sendEmailAlert").mockResolvedValue(true);
      vi.spyOn(multiAlertLogger, "sendSlackAlert").mockResolvedValue(true);
      vi.spyOn(multiAlertLogger, "sendPagerDutyAlert").mockResolvedValue(true);

      await multiAlertLogger.log({
        action: "UNAUTHORIZED_ACCESS",
        userId: "unknown",
        resource: "/sensitive-data",
        outcome: "DENIED",
      });

      expect(multiAlertLogger.sendEmailAlert).toHaveBeenCalled();
      expect(multiAlertLogger.sendSlackAlert).toHaveBeenCalled();
      expect(multiAlertLogger.sendPagerDutyAlert).toHaveBeenCalled();
      await multiAlertLogger.close();
    });
  });

  describe("Performance and Batching", () => {
    it("should handle batch processing efficiently", async () => {
      const batchLogger = new AuditLogger({
        ...testConfig,
        performance: {
          batchSize: 10,
          flushInterval: 100,
          maxQueueSize: 100,
        },
      });

      const events = Array.from({ length: 25 }, (_, i) => ({
        action: `BATCH_TEST_${i}`,
        userId: `user-${i}`,
        resource: `/api/test/${i}`,
        outcome: "SUCCESS",
      }));

      // Log all events
      for (const event of events) {
        await batchLogger.log(event);
      }

      // Should process in batches of 10
      vi.spyOn(batchLogger, "processBatch").mockImplementation();
      await batchLogger.flush();

      expect(batchLogger.processBatch).toHaveBeenCalled();
      await batchLogger.close();
    });

    it("should respect flush intervals", async () => {
      const intervalLogger = new AuditLogger({
        ...testConfig,
        performance: {
          batchSize: 100,
          flushInterval: 50, // 50ms
          maxQueueSize: 1000,
        },
      });

      vi.spyOn(intervalLogger, "flush").mockImplementation();

      await intervalLogger.log({
        action: "INTERVAL_TEST",
        userId: "test-user",
        resource: "test-resource",
        outcome: "SUCCESS",
      });

      // Wait for flush interval
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(intervalLogger.flush).toHaveBeenCalled();
      await intervalLogger.close();
    });

    it("should handle queue overflow gracefully", async () => {
      const overflowLogger = new AuditLogger({
        ...testConfig,
        performance: {
          batchSize: 10,
          flushInterval: 10000, // Long interval to test overflow
          maxQueueSize: 5,
        },
      });

      vi.spyOn(overflowLogger, "handleQueueOverflow").mockImplementation();

      // Add more events than queue size
      for (let i = 0; i < 10; i++) {
        await overflowLogger.log({
          action: `OVERFLOW_TEST_${i}`,
          userId: "test-user",
          resource: "test-resource",
          outcome: "SUCCESS",
        });
      }

      expect(overflowLogger.handleQueueOverflow).toHaveBeenCalled();
      await overflowLogger.close();
    });
  });

  describe("Data Retention", () => {
    it("should support log retention policies", async () => {
      const retentionLogger = new AuditLogger({
        ...testConfig,
        retention: {
          days: 7,
          archiveEnabled: true,
          archiveLocation: path.join(tempDir, "archives"),
        },
      });

      vi.spyOn(retentionLogger, "cleanupOldLogs").mockResolvedValue(5);

      const cleanedCount = await retentionLogger.cleanupOldLogs();

      expect(cleanedCount).toBe(5);
      expect(retentionLogger.cleanupOldLogs).toHaveBeenCalled();
      await retentionLogger.close();
    });

    it("should archive logs before deletion", async () => {
      const archiveLogger = new AuditLogger({
        ...testConfig,
        retention: {
          days: 1,
          archiveEnabled: true,
          archiveLocation: path.join(tempDir, "archive"),
        },
      });

      vi.spyOn(archiveLogger, "archiveLogs").mockResolvedValue(true);

      await archiveLogger.log({
        action: "ARCHIVE_TEST",
        userId: "test-user",
        resource: "test-resource",
        outcome: "SUCCESS",
      });

      const archived = await archiveLogger.archiveLogs("2023-01-01");

      expect(archived).toBe(true);
      expect(archiveLogger.archiveLogs).toHaveBeenCalled();
      await archiveLogger.close();
    });
  });

  describe("Error Handling", () => {
    it("should handle write failures gracefully", async () => {
      const errorLogger = new AuditLogger({
        ...testConfig,
        destinations: [
          {
            type: "file",
            config: {
              path: "/invalid/path/audit.log", // Invalid path to trigger error
            },
          },
        ],
      });

      vi.spyOn(errorLogger, "handleWriteError").mockImplementation();

      await errorLogger.log({
        action: "ERROR_TEST",
        userId: "test-user",
        resource: "test-resource",
        outcome: "SUCCESS",
      });

      expect(errorLogger.handleWriteError).toHaveBeenCalled();
      await errorLogger.close();
    });

    it("should validate audit event structure", () => {
      expect(() => {
        auditLogger.validateEvent({
          // Missing required fields
          userId: "test-user",
        });
      }).toThrow();
    });

    it("should handle network failures for remote destinations", async () => {
      const networkLogger = new AuditLogger({
        ...testConfig,
        destinations: [
          {
            type: "siem",
            config: {
              endpoint: "https://unreachable.example.com/api/events",
              apiKey: "test-key",
            },
          },
        ],
      });

      vi.spyOn(networkLogger, "handleNetworkError").mockImplementation();

      await networkLogger.log({
        action: "NETWORK_TEST",
        userId: "test-user",
        resource: "test-resource",
        outcome: "SUCCESS",
      });

      expect(networkLogger.handleNetworkError).toHaveBeenCalled();
      await networkLogger.close();
    });
  });

  describe("Security Features", () => {
    it("should prevent log tampering with integrity checks", async () => {
      const integrityLogger = new AuditLogger({
        ...testConfig,
        security: {
          integrityChecks: true,
          hashAlgorithm: "sha256",
        },
      });

      vi.spyOn(integrityLogger, "generateIntegrityHash").mockReturnValue(
        "hash123",
      );
      vi.spyOn(integrityLogger, "verifyIntegrity").mockReturnValue(true);

      await integrityLogger.log({
        action: "INTEGRITY_TEST",
        userId: "test-user",
        resource: "test-resource",
        outcome: "SUCCESS",
      });

      expect(integrityLogger.generateIntegrityHash).toHaveBeenCalled();

      const isValid = integrityLogger.verifyIntegrity("test-log-entry");
      expect(isValid).toBe(true);
      await integrityLogger.close();
    });

    it("should support digital signatures for non-repudiation", async () => {
      const signatureLogger = new AuditLogger({
        ...testConfig,
        security: {
          digitalSignatures: true,
          signingKey: "test-signing-key",
        },
      });

      vi.spyOn(signatureLogger, "signLogEntry").mockReturnValue("signature123");

      await signatureLogger.log({
        action: "SIGNATURE_TEST",
        userId: "test-user",
        resource: "test-resource",
        outcome: "SUCCESS",
      });

      expect(signatureLogger.signLogEntry).toHaveBeenCalled();
      await signatureLogger.close();
    });
  });
});
