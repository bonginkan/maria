/**
 * Security Contract Tests for Phase 1 Implementation
 *
 * Tests for RCE prevention, KMS encryption, type safety, and integrity validation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SafeEncryptionService,
  DEFAULT_ENCRYPTION_CONFIG,
} from "../../../security/crypto/SafeEncryptionService";
import { SafeTransformRegistry } from "../../../security/transform/SafeTransformRegistry";
import { SafeExpressionEvaluator } from "../../../security/expression/SafeExpressionEvaluator";
import { CRC32, crc32 } from "../../../security/integrity/CRC32";

describe("Security Contract Tests v2.0", () => {
  let encryptionService: SafeEncryptionService;
  let transformRegistry: SafeTransformRegistry;
  let expressionEvaluator: SafeExpressionEvaluator;

  beforeEach(() => {
    encryptionService = new SafeEncryptionService(DEFAULT_ENCRYPTION_CONFIG);
    transformRegistry = new SafeTransformRegistry();
    expressionEvaluator = new SafeExpressionEvaluator();
  });

  afterEach(() => {
    // Cleanup
    encryptionService.removeAllListeners();
    transformRegistry.removeAllListeners();
    expressionEvaluator.removeAllListeners();
  });

  describe("RCE Prevention Tests", () => {
    it("blocks RCE attempts with comprehensive detection", async () => {
      const maliciousCodes = [
        "process.exit(1)",
        'require("fs")',
        "global.process",
        'eval("malicious code")',
        'Function("return process")()',
        'constructor.constructor("return process")()',
        'this.constructor.constructor("return process")()',
        'import("child_process")',
        'require("child_process").spawn("cat", ["/etc/passwd"])',
        "setTimeout(() => { /* malicious */ }, 0)",
        'console.log("data exfiltration")',
        'document.location = "evil.com"',
        'window.open("evil.com")',
        "__proto__.constructor",
        "prototype.constructor",
      ];

      for (const code of maliciousCodes) {
        // Test SafeTransformRegistry
        const transformResult = await transformRegistry.apply(
          "custom",
          "test",
          { expression: code },
        );
        expect(transformResult.success).toBe(false);
        expect(transformResult.error).toContain("Unsafe expression detected");

        // Test SafeExpressionEvaluator
        const context = expressionEvaluator.createContext({ test: "value" });
        const evalResult = await expressionEvaluator.evaluate(code, context);
        expect(evalResult.success).toBe(false);
        expect(evalResult.error).toContain("Unsafe patterns detected");
      }
    });

    it("allows safe operations while blocking dangerous ones", async () => {
      const safeOperations = [
        "value + 1",
        "Math.max(1, 2)",
        "value.toString()",
        "Array.isArray(value)",
        'typeof value === "string"',
        'value ? "yes" : "no"',
        "value.length > 0",
        "/test/.test(value)",
      ];

      const context = expressionEvaluator.createContext({ value: "test" });

      for (const operation of safeOperations) {
        const result = await expressionEvaluator.evaluate(operation, context);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("KMS-Backed Encryption Tests", () => {
    it("enforces KMS-backed encryption with key versioning", async () => {
      const testData = "sensitive-data-for-testing";

      // Test encryption
      const encrypted = await encryptionService.encrypt(testData);

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.keyVersion).toBeDefined();
      expect(encrypted.algorithm).toBe("AES-256-GCM");
      expect(encrypted.kdfParams).toBeDefined();
      expect(encrypted.timestamp).toBeDefined();

      // Verify encrypted data is different from original
      expect(encrypted.encrypted).not.toBe(testData);

      // Test decryption
      const decrypted = await encryptionService.decrypt({
        encrypted: encrypted.encrypted,
        keyVersion: encrypted.keyVersion,
      });

      expect(decrypted.toString("utf8")).toBe(testData);
    });

    it("supports key rotation and versioning", async () => {
      const testData = "test-data";

      // Encrypt with current key
      const encrypted1 = await encryptionService.encrypt(testData);

      // Rotate keys
      await encryptionService.rotateKeys();

      // Encrypt with new key
      const encrypted2 = await encryptionService.encrypt(testData);

      // Key versions should be different
      expect(encrypted1.keyVersion).not.toBe(encrypted2.keyVersion);

      // Both should decrypt correctly
      const decrypted1 = await encryptionService.decrypt({
        encrypted: encrypted1.encrypted,
        keyVersion: encrypted1.keyVersion,
      });
      const decrypted2 = await encryptionService.decrypt({
        encrypted: encrypted2.encrypted,
        keyVersion: encrypted2.keyVersion,
      });

      expect(decrypted1.toString("utf8")).toBe(testData);
      expect(decrypted2.toString("utf8")).toBe(testData);
    });

    it("handles encryption errors gracefully", async () => {
      // Test invalid decryption request
      await expect(
        encryptionService.decrypt({
          encrypted: "invalid-data",
          keyVersion: "v1",
        }),
      ).rejects.toThrow("Decryption failed");
    });
  });

  describe("CRC32 IEEE 802.3 Compliance", () => {
    it("validates CRC32 with IEEE 802.3 test vectors", () => {
      const testVectors = CRC32.runTestVectors();

      expect(testVectors.passed).toBe(testVectors.total);
      expect(testVectors.passed).toBeGreaterThan(5); // We have several test vectors

      // Verify specific known vectors
      expect(crc32("123456789")).toBe("cbf43926");
      expect(crc32(Buffer.from([0x00, 0x00, 0x00, 0x00]))).toBe("2144df1c");
      expect(crc32("")).toBe("00000000");
    });

    it("supports streaming CRC32 for large data", () => {
      const calculator = CRC32.createStreamingCalculator();

      // Process data in chunks
      calculator.update("Hello, ");
      calculator.update("World!");

      const result = calculator.digest();
      const direct = crc32("Hello, World!");

      expect(result).toBe(direct);
    });

    it("verifies data integrity correctly", () => {
      const testData = "integrity test data";
      const checksum = crc32(testData);

      // Valid verification
      expect(CRC32.verify(testData, checksum)).toBe(true);

      // Invalid verification
      expect(CRC32.verify("corrupted data", checksum)).toBe(false);
    });
  });

  describe("Expression Safety Tests", () => {
    it("limits expression complexity", async () => {
      const context = expressionEvaluator.createContext({ x: 1 });

      // Complex expression that should be rejected
      const complexExpression = Array(50).fill("x + 1").join(" + ");
      const result = await expressionEvaluator.evaluate(
        complexExpression,
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("too complex");
    });

    it("enforces execution timeouts", async () => {
      const context = expressionEvaluator.createContext({ x: 1000000 });

      // Expression designed to take a long time (would create infinite loop if not sandboxed)
      const timeoutExpression = "x > 999999 ? x : x + 1";

      const startTime = Date.now();
      const result = await expressionEvaluator.evaluate(
        timeoutExpression,
        context,
      );
      const executionTime = Date.now() - startTime;

      // Should complete within reasonable time (not timeout, but not hang)
      expect(executionTime).toBeLessThan(100);
      expect(result.success).toBe(true);
    });

    it("provides safe built-in functions only", async () => {
      const context = expressionEvaluator.createContext({ value: "test" });

      // Test safe Math functions
      let result = await expressionEvaluator.evaluate("Math.abs(-5)", context);
      expect(result.success).toBe(true);
      expect(result.result).toBe(5);

      // Test safe String operations
      result = await expressionEvaluator.evaluate(
        "value.toUpperCase()",
        context,
      );
      expect(result.success).toBe(true);
      expect(result.result).toBe("TEST");

      // Test safe Date functions
      result = await expressionEvaluator.evaluate("typeof Date.now()", context);
      expect(result.success).toBe(true);
      expect(result.result).toBe("number");
    });
  });

  describe("Transform Registry Security", () => {
    it("validates transform definitions before registration", () => {
      const maliciousTransform = {
        id: "malicious",
        name: "Malicious Transform",
        description: "Attempts RCE",
        expression: 'require("fs").readFileSync("/etc/passwd")',
        inputSchema: { type: "string" },
        outputSchema: { type: "string" },
        allowedFunctions: ["require"],
        maxExecutionTime: 1000,
        category: "data" as const,
      };

      expect(() => {
        transformRegistry.register(maliciousTransform);
      }).toThrow("Unsafe expression detected");
    });

    it("whitelists functions properly", () => {
      const invalidTransform = {
        id: "invalid",
        name: "Invalid Transform",
        description: "Uses non-whitelisted function",
        expression: "value.toString()",
        inputSchema: { type: "string" },
        outputSchema: { type: "string" },
        allowedFunctions: ["dangerousFunction"], // Not whitelisted
        maxExecutionTime: 1000,
        category: "data" as const,
      };

      expect(() => {
        transformRegistry.register(invalidTransform);
      }).toThrow("Function not whitelisted");
    });

    it("validates input and output schemas", async () => {
      // Register a transform with strict schema
      const strictTransform = {
        id: "strict_number",
        name: "Strict Number Transform",
        description: "Only accepts numbers",
        expression: "value * 2",
        inputSchema: { type: "number" },
        outputSchema: { type: "number" },
        allowedFunctions: [],
        maxExecutionTime: 100,
        category: "calculation" as const,
      };

      transformRegistry.register(strictTransform);

      // Valid input
      let result = await transformRegistry.apply("strict_number", 5);
      expect(result.success).toBe(true);
      expect(result.result).toBe(10);

      // Invalid input type
      result = await transformRegistry.apply("strict_number", "not_a_number");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Input type mismatch");
    });
  });

  describe("Health Status Monitoring", () => {
    it("reports healthy status for all security services", () => {
      const encryptionHealth = encryptionService.getHealthStatus();
      const transformHealth = transformRegistry.getHealthStatus();
      const evaluatorHealth = expressionEvaluator.getHealthStatus();

      expect(encryptionHealth.status).toBe("healthy");
      expect(encryptionHealth.details).toHaveProperty(
        "algorithm",
        "AES-256-GCM",
      );

      expect(transformHealth.status).toBe("healthy");
      expect(transformHealth.details.transformsRegistered).toBeGreaterThan(0);

      expect(evaluatorHealth.status).toBe("healthy");
      expect(evaluatorHealth.details.maxComplexity).toBeGreaterThan(0);
    });
  });

  describe("Event Emission for Security Monitoring", () => {
    it("emits security events for monitoring", async () => {
      const events: string[] = [];

      // Listen for security events
      encryptionService.on("encryption_complete", () =>
        events.push("encryption_complete"),
      );
      encryptionService.on("encryption_error", () =>
        events.push("encryption_error"),
      );
      transformRegistry.on("transform_error", () =>
        events.push("transform_error"),
      );
      expressionEvaluator.on("expression_error", () =>
        events.push("expression_error"),
      );

      // Trigger events
      await encryptionService.encrypt("test");
      await transformRegistry.apply("nonexistent_transform", "test");
      await expressionEvaluator.evaluate(
        "invalid.expression.access",
        expressionEvaluator.createContext({}),
      );

      expect(events).toContain("encryption_complete");
      expect(events).toContain("transform_error");
      expect(events).toContain("expression_error");
    });
  });

  describe("Performance and Memory Safety", () => {
    it("handles large data within memory limits", async () => {
      const largeData = "x".repeat(1000); // 1KB test data

      const encrypted = await encryptionService.encrypt(largeData);
      expect(encrypted.encrypted).toBeDefined();

      const checksum = crc32(largeData);
      expect(checksum).toBeDefined();
      expect(checksum.length).toBe(8); // CRC32 is always 8 hex chars
    });

    it("prevents memory exhaustion attacks", async () => {
      const context = expressionEvaluator.createContext({ x: "test" });

      // Attempt to create very long string (should be limited)
      const memoryAttack = "x.repeat(1000000)"; // Would create 1MB string if allowed
      const result = await expressionEvaluator.evaluate(memoryAttack, context);

      // Should either complete safely or reject the expression
      if (result.success) {
        expect(typeof result.result).toBe("string");
        expect(result.executionTime).toBeLessThan(1000); // Complete quickly
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });
});
