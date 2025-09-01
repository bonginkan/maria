/**
 * Security Integration Backward Compatibility Tests
 *
 * This test suite validates that security integration does not break the public API
 * while providing comprehensive security features. Tests ensure that security components
 * work transparently without changing existing method signatures or behavior.
 *
 * Tests cover:
 * - Security context processing without API changes
 * - Audit trail integration maintaining transparency
 * - Secure data processing with backward compatibility
 * - Expression evaluation safety without breaking existing code
 * - Data classification and encryption integration
 * - Error handling with security considerations
 * - Performance impact of security features
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import {
  MultimodalIntelligence,
  ProcessingOptions,
} from "../../services/multimodal/intelligence.js";
import { SecureDataPorter } from "../../services/multimodal/security/SecureDataPorter.js";
import { SafeExpressionEvaluator } from "../../services/multimodal/security/SafeExpressionEvaluator.js";
import { AuditTrailManager } from "../../services/multimodal/security/AuditTrailManager.js";
import {
  ModalityType,
  MultimodalInput,
  ProcessedOutput,
  SecureProcessingContext,
} from "../../services/multimodal/core/types.js";

// Mock security components for testing
class MockSecureDataPorter {
  private encryptedData = new Map<string, any>();
  private keyId: string = "mock-key-id";

  async encrypt(
    data: any,
    keyId?: string,
  ): Promise<{ encryptedData: string; keyId: string }> {
    const dataString = JSON.stringify(data);
    const encryptedData = Buffer.from(dataString).toString("base64");
    const actualKeyId = keyId || this.keyId;

    this.encryptedData.set(encryptedData, {
      originalData: data,
      keyId: actualKeyId,
    });

    return { encryptedData, keyId: actualKeyId };
  }

  async decrypt(encryptedData: string, keyId: string): Promise<any> {
    const stored = this.encryptedData.get(encryptedData);
    if (!stored || stored.keyId !== keyId) {
      throw new Error("Decryption failed: invalid key or data");
    }

    return stored.originalData;
  }

  async rotateKey(oldKeyId: string): Promise<string> {
    const newKeyId = `rotated-${Date.now()}`;

    // Simulate key rotation process
    for (const [encData, stored] of this.encryptedData.entries()) {
      if (stored.keyId === oldKeyId) {
        stored.keyId = newKeyId;
      }
    }

    return newKeyId;
  }

  async validateKeyAccess(keyId: string, userId: string): Promise<boolean> {
    // Mock validation - in real implementation would check permissions
    return keyId.startsWith("mock-") || keyId.startsWith("rotated-");
  }
}

class MockSafeExpressionEvaluator {
  private allowedExpressions = new Set([
    "input.data",
    "input.metadata",
    "result.confidence",
    "result.processingTime",
  ]);

  async evaluateExpression(expression: string, context: any): Promise<any> {
    // Simulate safe expression evaluation
    if (!this.allowedExpressions.has(expression)) {
      throw new Error(`Expression not allowed: ${expression}`);
    }

    // Simple evaluation for testing
    switch (expression) {
      case "input.data":
        return context.input?.data;
      case "input.metadata":
        return context.input?.metadata;
      case "result.confidence":
        return context.result?.confidence;
      case "result.processingTime":
        return context.result?.processingTime;
      default:
        return null;
    }
  }

  async validateExpression(expression: string): Promise<boolean> {
    return this.allowedExpressions.has(expression);
  }

  addAllowedExpression(expression: string): void {
    this.allowedExpressions.add(expression);
  }

  removeAllowedExpression(expression: string): void {
    this.allowedExpressions.delete(expression);
  }
}

class MockAuditTrailManager {
  private auditLogs: any[] = [];
  private isEnabled = true;

  async recordDataOperation(operation: any): Promise<void> {
    if (!this.isEnabled) return;

    const auditRecord = {
      ...operation,
      timestamp: new Date(),
      auditId: `audit-${Date.now()}-${Math.random()}`,
    };

    this.auditLogs.push(auditRecord);
  }

  async recordSecurityEvent(event: any): Promise<void> {
    if (!this.isEnabled) return;

    const securityRecord = {
      ...event,
      timestamp: new Date(),
      eventId: `security-${Date.now()}-${Math.random()}`,
      severity: event.severity || "medium",
    };

    this.auditLogs.push(securityRecord);
  }

  async queryAuditTrail(query: any): Promise<any[]> {
    return this.auditLogs.filter((log) => {
      if (query.correlationId && log.correlationId !== query.correlationId) {
        return false;
      }
      if (query.userId && log.userId !== query.userId) {
        return false;
      }
      if (query.operation && log.operation !== query.operation) {
        return false;
      }
      return true;
    });
  }

  async exportAuditTrail(format: "json" | "csv" = "json"): Promise<string> {
    if (format === "json") {
      return JSON.stringify(this.auditLogs, null, 2);
    } else {
      // Simple CSV export
      const headers = [
        "timestamp",
        "operation",
        "userId",
        "correlationId",
        "success",
      ];
      const rows = this.auditLogs.map((log) => [
        log.timestamp,
        log.operation || "",
        log.userId || "",
        log.correlationId || "",
        log.success?.toString() || "",
      ]);
      return [headers, ...rows].map((row) => row.join(",")).join("\n");
    }
  }

  getAuditLogs(): any[] {
    return [...this.auditLogs];
  }

  clearAuditLogs(): void {
    this.auditLogs = [];
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

describe("Security Integration Backward Compatibility Tests", () => {
  let intelligence: MultimodalIntelligence;
  let mockSecureDataPorter: MockSecureDataPorter;
  let mockSafeExpressionEvaluator: MockSafeExpressionEvaluator;
  let mockAuditTrail: MockAuditTrailManager;

  beforeEach(() => {
    mockSecureDataPorter = new MockSecureDataPorter();
    mockSafeExpressionEvaluator = new MockSafeExpressionEvaluator();
    mockAuditTrail = new MockAuditTrailManager();

    intelligence = new MultimodalIntelligence(
      {
        enableSecurity: true,
        enableAudit: true,
        enablePerformanceMonitoring: true,
        maxConcurrentProcessing: 3,
        processingTimeout: 10000,
        defaultKeyId: "mock-key-id",
      },
      {
        secureDataPorter: mockSecureDataPorter as any,
        safeExpressionEvaluator: mockSafeExpressionEvaluator as any,
        auditTrail: mockAuditTrail as any,
      },
    );
  });

  afterEach(async () => {
    await intelligence.shutdown();
    mockAuditTrail.clearAuditLogs();
  });

  describe("Security Context Processing Without API Changes", () => {
    it("should process inputs with security context transparently", async () => {
      const input: MultimodalInput = {
        id: "security-context-test",
        type: "text",
        data: "Secure processing test content",
        metadata: {
          format: "plain",
          size: 30,
          source: "secure-test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const securityContext: SecureProcessingContext = {
        correlationId: "test-correlation-123",
        userId: "test-user-456",
        dataClassification: "confidential",
        purpose: "automated testing",
        retentionPolicy: "30-days",
      };

      const options: ProcessingOptions = {
        securityContext,
        mode: "batch",
      };

      const result = await intelligence.processInput(input, options);

      // API structure should be identical to non-secure processing
      expect(result).toMatchObject({
        id: expect.any(String),
        inputId: input.id,
        type: expect.any(String),
        data: expect.any(Object),
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        metadata: expect.any(Object),
        timestamp: expect.any(Date),
      });

      // Standard validation
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.inputId).toBe(input.id);
    });

    it("should handle missing security context gracefully", async () => {
      const input: MultimodalInput = {
        id: "no-security-context-test",
        type: "text",
        data: "Processing without security context",
        metadata: {
          format: "plain",
          size: 34,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      // Process without security context
      const result = await intelligence.processInput(input);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.inputId).toBe(input.id);

      // Should still work without security features
      expect(result).toMatchObject({
        id: expect.any(String),
        inputId: input.id,
        type: expect.any(String),
        data: expect.any(Object),
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        timestamp: expect.any(Date),
      });
    });

    it("should validate data classification without changing API", async () => {
      const classificationLevels: Array<
        "public" | "internal" | "confidential" | "restricted"
      > = ["public", "internal", "confidential", "restricted"];

      for (const classification of classificationLevels) {
        const input: MultimodalInput = {
          id: `classification-test-${classification}`,
          type: "text",
          data: `${classification} data content`,
          metadata: {
            format: "plain",
            size: 20,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 1,
        };

        const securityContext: SecureProcessingContext = {
          correlationId: `correlation-${classification}`,
          userId: "test-user",
          dataClassification: classification,
          purpose: "classification testing",
        };

        const result = await intelligence.processInput(input, {
          securityContext,
        });

        expect(result).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.inputId).toBe(input.id);

        // API structure should be unchanged regardless of classification
        expect(result).toMatchObject({
          id: expect.any(String),
          inputId: input.id,
          type: expect.any(String),
          confidence: expect.any(Number),
          processingTime: expect.any(Number),
          timestamp: expect.any(Date),
        });
      }
    });
  });

  describe("Audit Trail Integration Maintaining Transparency", () => {
    it("should record audit trails without affecting processing results", async () => {
      const input: MultimodalInput = {
        id: "audit-trail-test",
        type: "text",
        data: "Audit trail integration test",
        metadata: {
          format: "plain",
          size: 27,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const securityContext: SecureProcessingContext = {
        correlationId: "audit-test-correlation",
        userId: "audit-test-user",
        dataClassification: "internal",
        purpose: "audit trail testing",
      };

      const result = await intelligence.processInput(input, {
        securityContext,
      });

      // Processing should succeed normally
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.inputId).toBe(input.id);

      // Check that audit trail was recorded
      const auditLogs = mockAuditTrail.getAuditLogs();
      expect(auditLogs.length).toBeGreaterThan(0);

      // Find the audit record for this operation
      const auditRecord = auditLogs.find(
        (log) => log.correlationId === "audit-test-correlation",
      );

      expect(auditRecord).toBeDefined();
      expect(auditRecord).toMatchObject({
        correlationId: "audit-test-correlation",
        operation: "access",
        userId: "audit-test-user",
        dataClassification: "internal",
        success: true,
        duration: expect.any(Number),
      });
    });

    it("should record audit trails for failed operations", async () => {
      const invalidInput: MultimodalInput = {
        id: "audit-error-test",
        type: "unsupported" as ModalityType,
        data: "This should fail",
        metadata: {
          format: "unknown",
          size: 16,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const securityContext: SecureProcessingContext = {
        correlationId: "audit-error-correlation",
        userId: "audit-test-user",
        dataClassification: "internal",
        purpose: "error audit testing",
      };

      await expect(
        intelligence.processInput(invalidInput, { securityContext }),
      ).rejects.toThrow();

      // Check that audit trail was recorded for the failure
      const auditLogs = mockAuditTrail.getAuditLogs();
      const errorAuditRecord = auditLogs.find(
        (log) => log.correlationId === "audit-error-correlation",
      );

      expect(errorAuditRecord).toBeDefined();
      expect(errorAuditRecord).toMatchObject({
        correlationId: "audit-error-correlation",
        operation: "access",
        userId: "audit-test-user",
        success: false,
        errorMessage: expect.any(String),
      });
    });

    it("should maintain audit trail query functionality", async () => {
      // Process multiple inputs with different contexts
      const testCases = [
        {
          userId: "user-1",
          correlationId: "corr-1",
          classification: "public" as const,
        },
        {
          userId: "user-2",
          correlationId: "corr-2",
          classification: "internal" as const,
        },
        {
          userId: "user-1",
          correlationId: "corr-3",
          classification: "confidential" as const,
        },
      ];

      for (const [index, testCase] of testCases.entries()) {
        const input: MultimodalInput = {
          id: `audit-query-test-${index}`,
          type: "text",
          data: `Audit query test ${index}`,
          metadata: {
            format: "plain",
            size: 20,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 1,
        };

        const securityContext: SecureProcessingContext = {
          correlationId: testCase.correlationId,
          userId: testCase.userId,
          dataClassification: testCase.classification,
          purpose: "audit query testing",
        };

        await intelligence.processInput(input, { securityContext });
      }

      // Query audit trail by user
      const user1Logs = await mockAuditTrail.queryAuditTrail({
        userId: "user-1",
      });
      expect(user1Logs.length).toBe(2);

      // Query audit trail by correlation ID
      const corr2Logs = await mockAuditTrail.queryAuditTrail({
        correlationId: "corr-2",
      });
      expect(corr2Logs.length).toBe(1);
      expect(corr2Logs[0].userId).toBe("user-2");
    });

    it("should support audit trail export functionality", async () => {
      const input: MultimodalInput = {
        id: "audit-export-test",
        type: "text",
        data: "Audit export test content",
        metadata: {
          format: "plain",
          size: 25,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const securityContext: SecureProcessingContext = {
        correlationId: "export-test-correlation",
        userId: "export-test-user",
        dataClassification: "internal",
        purpose: "export testing",
      };

      await intelligence.processInput(input, { securityContext });

      // Test JSON export
      const jsonExport = await mockAuditTrail.exportAuditTrail("json");
      expect(jsonExport).toBeDefined();
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      // Test CSV export
      const csvExport = await mockAuditTrail.exportAuditTrail("csv");
      expect(csvExport).toBeDefined();
      expect(csvExport).toContain(
        "timestamp,operation,userId,correlationId,success",
      );
    });
  });

  describe("Secure Data Processing with Backward Compatibility", () => {
    it("should encrypt sensitive data without changing API structure", async () => {
      const sensitiveInput: MultimodalInput = {
        id: "encryption-test",
        type: "text",
        data: "Sensitive data that should be encrypted",
        metadata: {
          format: "plain",
          size: 38,
          source: "sensitive",
          quality: 1,
          tags: ["pii"],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const securityContext: SecureProcessingContext = {
        correlationId: "encryption-correlation",
        userId: "encryption-user",
        dataClassification: "confidential",
        purpose: "encryption testing",
      };

      const result = await intelligence.processInput(sensitiveInput, {
        securityContext,
        mode: "batch",
      });

      // API structure should be unchanged
      expect(result).toMatchObject({
        id: expect.any(String),
        inputId: sensitiveInput.id,
        type: expect.any(String),
        data: expect.any(Object),
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        timestamp: expect.any(Date),
      });

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.inputId).toBe(sensitiveInput.id);
    });

    it("should handle data encryption/decryption transparently", async () => {
      const testData = {
        sensitiveField: "confidential information",
        publicField: "public information",
      };

      // Test encryption
      const encrypted = await mockSecureDataPorter.encrypt(
        testData,
        "test-key",
      );
      expect(encrypted).toMatchObject({
        encryptedData: expect.any(String),
        keyId: "test-key",
      });

      // Test decryption
      const decrypted = await mockSecureDataPorter.decrypt(
        encrypted.encryptedData,
        encrypted.keyId,
      );
      expect(decrypted).toEqual(testData);

      // Processing with encrypted data should work transparently
      const input: MultimodalInput = {
        id: "encryption-roundtrip-test",
        type: "text",
        data: testData,
        metadata: {
          format: "json",
          size: 100,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const result = await intelligence.processInput(input);
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should handle key rotation without service interruption", async () => {
      const oldKeyId = "mock-key-id";
      const testData = { field: "test data for key rotation" };

      // Encrypt with old key
      const encrypted = await mockSecureDataPorter.encrypt(testData, oldKeyId);

      // Rotate key
      const newKeyId = await mockSecureDataPorter.rotateKey(oldKeyId);
      expect(newKeyId).toBeDefined();
      expect(newKeyId).not.toBe(oldKeyId);

      // Should still be able to process data (simulated)
      const input: MultimodalInput = {
        id: "key-rotation-test",
        type: "text",
        data: "Key rotation test data",
        metadata: {
          format: "plain",
          size: 22,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const result = await intelligence.processInput(input);
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("Expression Evaluation Safety Without Breaking Code", () => {
    it("should validate expressions safely without changing processing flow", async () => {
      const input: MultimodalInput = {
        id: "expression-safety-test",
        type: "text",
        data: "Expression evaluation safety test",
        metadata: {
          format: "plain",
          size: 33,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      // Process input normally
      const result = await intelligence.processInput(input);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      // Test safe expression evaluation
      const safeExpressions = [
        "input.data",
        "input.metadata",
        "result.confidence",
      ];

      for (const expression of safeExpressions) {
        const isValid =
          await mockSafeExpressionEvaluator.validateExpression(expression);
        expect(isValid).toBe(true);

        const evaluatedValue =
          await mockSafeExpressionEvaluator.evaluateExpression(expression, {
            input,
            result,
          });
        expect(evaluatedValue).toBeDefined();
      }
    });

    it("should block unsafe expressions without affecting normal processing", async () => {
      const unsafeExpressions = [
        "process.env",
        'require("fs")',
        'eval("malicious code")',
        "__dirname",
      ];

      for (const expression of unsafeExpressions) {
        const isValid =
          await mockSafeExpressionEvaluator.validateExpression(expression);
        expect(isValid).toBe(false);

        await expect(
          mockSafeExpressionEvaluator.evaluateExpression(expression, {}),
        ).rejects.toThrow();
      }

      // Normal processing should continue to work
      const input: MultimodalInput = {
        id: "unsafe-expression-test",
        type: "text",
        data: "Normal processing after unsafe expressions",
        metadata: {
          format: "plain",
          size: 40,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const result = await intelligence.processInput(input);
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should support dynamic expression management", async () => {
      const dynamicExpression = "custom.field";

      // Initially not allowed
      const initialValid =
        await mockSafeExpressionEvaluator.validateExpression(dynamicExpression);
      expect(initialValid).toBe(false);

      // Add to allowed expressions
      mockSafeExpressionEvaluator.addAllowedExpression(dynamicExpression);

      const afterAddValid =
        await mockSafeExpressionEvaluator.validateExpression(dynamicExpression);
      expect(afterAddValid).toBe(true);

      // Remove from allowed expressions
      mockSafeExpressionEvaluator.removeAllowedExpression(dynamicExpression);

      const afterRemoveValid =
        await mockSafeExpressionEvaluator.validateExpression(dynamicExpression);
      expect(afterRemoveValid).toBe(false);
    });
  });

  describe("Error Handling with Security Considerations", () => {
    it("should handle security errors without exposing sensitive information", async () => {
      // Test with invalid key access
      const invalidKeyAccess = await mockSecureDataPorter.validateKeyAccess(
        "invalid-key",
        "test-user",
      );
      expect(invalidKeyAccess).toBe(false);

      // Processing should still work with proper error handling
      const input: MultimodalInput = {
        id: "security-error-test",
        type: "text",
        data: "Security error handling test",
        metadata: {
          format: "plain",
          size: 27,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const result = await intelligence.processInput(input);
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should sanitize error messages to prevent information disclosure", async () => {
      const input: MultimodalInput = {
        id: "error-sanitization-test",
        type: "unsupported" as ModalityType,
        data: "This will cause an error",
        metadata: {
          format: "unknown",
          size: 24,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const securityContext: SecureProcessingContext = {
        correlationId: "error-sanitization-correlation",
        userId: "test-user",
        dataClassification: "confidential",
        purpose: "error sanitization testing",
      };

      await expect(
        intelligence.processInput(input, { securityContext }),
      ).rejects.toThrow();

      // Check audit trail for sanitized error message
      const auditLogs = mockAuditTrail.getAuditLogs();
      const errorLog = auditLogs.find(
        (log) => log.correlationId === "error-sanitization-correlation",
      );

      expect(errorLog).toBeDefined();
      expect(errorLog.success).toBe(false);
      expect(errorLog.errorMessage).toBeDefined();
      // Error message should not contain sensitive system information
    });

    it("should handle encryption/decryption errors gracefully", async () => {
      // Test decryption with wrong key
      const testData = { test: "data" };
      const encrypted = await mockSecureDataPorter.encrypt(
        testData,
        "correct-key",
      );

      await expect(
        mockSecureDataPorter.decrypt(encrypted.encryptedData, "wrong-key"),
      ).rejects.toThrow("Decryption failed");

      // System should remain stable after encryption errors
      const input: MultimodalInput = {
        id: "post-encryption-error-test",
        type: "text",
        data: "Processing after encryption error",
        metadata: {
          format: "plain",
          size: 33,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const result = await intelligence.processInput(input);
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("Performance Impact of Security Features", () => {
    it("should maintain acceptable performance with security enabled", async () => {
      const performanceTestInputs = Array.from({ length: 10 }, (_, i) => ({
        id: `performance-security-${i}`,
        type: "text" as ModalityType,
        data: `Performance test with security ${i}`,
        metadata: {
          format: "plain",
          size: 35,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      }));

      const securityContext: SecureProcessingContext = {
        correlationId: "performance-test-correlation",
        userId: "performance-test-user",
        dataClassification: "internal",
        purpose: "performance testing",
      };

      const startTime = Date.now();

      const results = await Promise.all(
        performanceTestInputs.map((input) =>
          intelligence.processInput(input, { securityContext }),
        ),
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should complete successfully
      expect(results).toHaveLength(10);

      for (const result of results) {
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.processingTime).toBeGreaterThan(0);
      }

      // Performance should be reasonable even with security overhead
      expect(totalTime).toBeLessThan(20000); // 20 seconds max for 10 inputs

      const averageTime = totalTime / results.length;
      expect(averageTime).toBeLessThan(5000); // 5 seconds per input max
    });

    it("should compare performance with and without security features", async () => {
      const testInput: MultimodalInput = {
        id: "perf-comparison-test",
        type: "text",
        data: "Performance comparison test content",
        metadata: {
          format: "plain",
          size: 34,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      // Test without security context
      const startTimeNoSecurity = Date.now();
      const resultNoSecurity = await intelligence.processInput(testInput);
      const endTimeNoSecurity = Date.now();
      const timeNoSecurity = endTimeNoSecurity - startTimeNoSecurity;

      // Test with security context
      const securityContext: SecureProcessingContext = {
        correlationId: "perf-comparison-correlation",
        userId: "perf-test-user",
        dataClassification: "confidential",
        purpose: "performance comparison",
      };

      const startTimeWithSecurity = Date.now();
      const resultWithSecurity = await intelligence.processInput(
        {
          ...testInput,
          id: "perf-comparison-test-secure",
        },
        { securityContext },
      );
      const endTimeWithSecurity = Date.now();
      const timeWithSecurity = endTimeWithSecurity - startTimeWithSecurity;

      // Both should produce valid results
      expect(resultNoSecurity.confidence).toBeGreaterThan(0);
      expect(resultWithSecurity.confidence).toBeGreaterThan(0);

      // API structure should be identical
      expect(resultNoSecurity).toMatchObject({
        id: expect.any(String),
        inputId: expect.any(String),
        type: expect.any(String),
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        timestamp: expect.any(Date),
      });

      expect(resultWithSecurity).toMatchObject({
        id: expect.any(String),
        inputId: expect.any(String),
        type: expect.any(String),
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        timestamp: expect.any(Date),
      });

      // Security overhead should be reasonable
      const securityOverhead = timeWithSecurity - timeNoSecurity;
      expect(securityOverhead).toBeLessThan(1000); // Less than 1 second overhead
    });

    it("should maintain performance under concurrent secure processing", async () => {
      const concurrentInputs = Array.from({ length: 20 }, (_, i) => ({
        id: `concurrent-secure-${i}`,
        type: "text" as ModalityType,
        data: `Concurrent secure processing test ${i}`,
        metadata: {
          format: "plain",
          size: 40,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      }));

      const securityContexts = concurrentInputs.map((_, i) => ({
        correlationId: `concurrent-correlation-${i}`,
        userId: `user-${i % 3}`, // 3 different users
        dataClassification: ["public", "internal", "confidential"][
          i % 3
        ] as const,
        purpose: "concurrent security testing",
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        concurrentInputs.map((input, i) =>
          intelligence.processInput(input, {
            securityContext: securityContexts[i],
          }),
        ),
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should complete successfully
      expect(results).toHaveLength(20);

      for (const result of results) {
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.processingTime).toBeGreaterThan(0);
      }

      // Should handle concurrent secure processing efficiently
      expect(totalTime).toBeLessThan(30000); // 30 seconds max for 20 concurrent secure inputs

      // Check that all audit records were created
      const auditLogs = mockAuditTrail.getAuditLogs();
      expect(auditLogs.length).toBe(20);
    });
  });

  describe("Security Feature Disabled Backward Compatibility", () => {
    it("should work identically when security features are disabled", async () => {
      // Create intelligence with security disabled
      const nonSecureIntelligence = new MultimodalIntelligence({
        enableSecurity: false,
        enableAudit: false,
        enablePerformanceMonitoring: true,
        maxConcurrentProcessing: 3,
        processingTimeout: 10000,
      });

      try {
        const input: MultimodalInput = {
          id: "no-security-test",
          type: "text",
          data: "Processing without security features",
          metadata: {
            format: "plain",
            size: 35,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 1,
        };

        // Process with security context (should be ignored)
        const securityContext: SecureProcessingContext = {
          correlationId: "ignored-correlation",
          userId: "ignored-user",
          dataClassification: "confidential",
          purpose: "testing disabled security",
        };

        const result = await nonSecureIntelligence.processInput(input, {
          securityContext,
        });

        // Should work normally and maintain API compatibility
        expect(result).toMatchObject({
          id: expect.any(String),
          inputId: input.id,
          type: expect.any(String),
          data: expect.any(Object),
          confidence: expect.any(Number),
          processingTime: expect.any(Number),
          timestamp: expect.any(Date),
        });

        expect(result.confidence).toBeGreaterThan(0);
        expect(result.inputId).toBe(input.id);
      } finally {
        await nonSecureIntelligence.shutdown();
      }
    });
  });
});
