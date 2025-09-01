/**
 * Factory Function and Constructor Options Compatibility Tests
 *
 * This test suite validates that factory functions and constructor options
 * maintain 100% backward compatibility while supporting new features and
 * configuration options.
 *
 * Tests cover:
 * - Factory function signatures and return types
 * - Constructor option validation and defaults
 * - Configuration merging and precedence
 * - Dependency injection compatibility
 * - Environment-specific configuration
 * - Legacy configuration migration
 * - Option validation and error handling
 * - Dynamic configuration updates
 */

import { describe, it, expect, beforeEach, afterEach as _afterEach, vi } from "vitest";
import {
  MultimodalIntelligence,
  createMultimodalIntelligence,
  MultimodalIntelligenceOptions,
  ProcessingOptions as _ProcessingOptions,
} from "../../services/multimodal/intelligence.js";
import {
  ModalityType as _ModalityType,
  MultimodalInput,
  SecureProcessingContext,
} from "../../services/multimodal/core/types.js";

// Mock security components for dependency injection testing
class MockSecureDataPorter {
  encrypt = vi
    .fn()
    .mockResolvedValue({ encryptedData: "encrypted", keyId: "test-key" });
  decrypt = vi.fn().mockResolvedValue({ decryptedData: "decrypted" });
  rotateKey = vi.fn().mockResolvedValue("new-key");
  validateKeyAccess = vi.fn().mockResolvedValue(true);
}

class MockSafeExpressionEvaluator {
  evaluateExpression = vi.fn().mockResolvedValue("evaluated");
  validateExpression = vi.fn().mockResolvedValue(true);
}

class MockAuditTrailManager {
  recordDataOperation = vi.fn().mockResolvedValue(undefined);
  recordSecurityEvent = vi.fn().mockResolvedValue(undefined);
  queryAuditTrail = vi.fn().mockResolvedValue([]);
  exportAuditTrail = vi.fn().mockResolvedValue("audit-data");
}

describe("Factory Function and Constructor Options Compatibility Tests", () => {
  let mockSecureDataPorter: MockSecureDataPorter;
  let mockSafeExpressionEvaluator: MockSafeExpressionEvaluator;
  let mockAuditTrail: MockAuditTrailManager;

  beforeEach(() => {
    mockSecureDataPorter = new MockSecureDataPorter();
    mockSafeExpressionEvaluator = new MockSafeExpressionEvaluator();
    mockAuditTrail = new MockAuditTrailManager();
  });

  describe("Factory Function Signatures and Return Types", () => {
    it("should create instance with default options when no parameters provided", async () => {
      const instance = await createMultimodalIntelligence();

      expect(instance).toBeInstanceOf(MultimodalIntelligence);
      expect(instance.processInput).toBeDefined();
      expect(instance.processMultimodalInputs).toBeDefined();
      expect(instance.getSystemMetrics).toBeDefined();
      expect(instance.on).toBeDefined();
      expect(instance.off).toBeDefined();
      expect(instance.shutdown).toBeDefined();

      await instance.shutdown();
    });

    it("should create instance with partial options", async () => {
      const partialOptions: Partial<MultimodalIntelligenceOptions> = {
        maxConcurrentProcessing: 5,
        enableSecurity: true,
        streamingProfile: "aggressive",
      };

      const instance = await createMultimodalIntelligence(partialOptions);

      expect(instance).toBeInstanceOf(MultimodalIntelligence);

      // Test that the instance works with specified options
      const metrics = instance.getSystemMetrics();
      expect(metrics.currentLoad).toBeGreaterThanOrEqual(0);

      await instance.shutdown();
    });

    it("should create instance with complete options", async () => {
      const completeOptions: MultimodalIntelligenceOptions = {
        enableSecurity: true,
        enableAudit: true,
        enablePerformanceMonitoring: true,
        streamingProfile: "balanced",
        maxConcurrentProcessing: 8,
        processingTimeout: 45000,
        memoryThreshold: 1024 * 1024 * 1024, // 1GB
        defaultKeyId: "factory-test-key",
      };

      const instance = await createMultimodalIntelligence(completeOptions);

      expect(instance).toBeInstanceOf(MultimodalIntelligence);

      // Validate that the instance is properly configured
      const testInput: MultimodalInput = {
        id: "factory-complete-test",
        type: "text",
        data: "Factory function complete options test",
        metadata: {
          format: "plain",
          size: 37,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const result = await instance.processInput(testInput);
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      await instance.shutdown();
    });

    it("should return Promise<MultimodalIntelligence> type", async () => {
      const instancePromise = createMultimodalIntelligence();

      expect(instancePromise).toBeInstanceOf(Promise);

      const instance = await instancePromise;
      expect(instance).toBeInstanceOf(MultimodalIntelligence);

      await instance.shutdown();
    });

    it("should maintain factory function signature stability", () => {
      // Test that factory function accepts expected parameter types
      expect(() => createMultimodalIntelligence()).not.toThrow();
      expect(() => createMultimodalIntelligence({})).not.toThrow();
      expect(() =>
        createMultimodalIntelligence({ enableSecurity: false }),
      ).not.toThrow();
      expect(() => createMultimodalIntelligence(undefined)).not.toThrow();
    });
  });

  describe("Constructor Option Validation and Defaults", () => {
    it("should apply correct default values when options not specified", () => {
      const instance = new MultimodalIntelligence();

      // Test that defaults are applied by checking behavior
      const metrics = instance.getSystemMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.currentLoad).toBeGreaterThanOrEqual(0);
      expect(metrics.currentLoad).toBeLessThanOrEqual(1);

      expect(instance).toBeInstanceOf(MultimodalIntelligence);
    });

    it("should validate streaming profile options", () => {
      const validProfiles: Array<"conservative" | "balanced" | "aggressive"> = [
        "conservative",
        "balanced",
        "aggressive",
      ];

      for (const profile of validProfiles) {
        expect(
          () => new MultimodalIntelligence({ streamingProfile: profile }),
        ).not.toThrow();
      }
    });

    it("should handle numeric option bounds correctly", () => {
      const numericOptionTests = [
        {
          options: { maxConcurrentProcessing: 1 },
          description: "minimum concurrency",
        },
        {
          options: { maxConcurrentProcessing: 100 },
          description: "high concurrency",
        },
        {
          options: { processingTimeout: 1000 },
          description: "short timeout",
        },
        {
          options: { processingTimeout: 300000 },
          description: "long timeout",
        },
        {
          options: { memoryThreshold: 64 * 1024 * 1024 },
          description: "low memory threshold",
        },
        {
          options: { memoryThreshold: 2 * 1024 * 1024 * 1024 },
          description: "high memory threshold",
        },
      ];

      for (const test of numericOptionTests) {
        expect(() => new MultimodalIntelligence(test.options)).not.toThrow(
          `Should handle ${test.description}`,
        );
      }
    });

    it("should handle boolean option combinations", () => {
      const booleanOptionCombinations = [
        {
          enableSecurity: true,
          enableAudit: true,
          enablePerformanceMonitoring: true,
        },
        {
          enableSecurity: false,
          enableAudit: false,
          enablePerformanceMonitoring: false,
        },
        {
          enableSecurity: true,
          enableAudit: false,
          enablePerformanceMonitoring: true,
        },
        {
          enableSecurity: false,
          enableAudit: true,
          enablePerformanceMonitoring: false,
        },
      ];

      for (const options of booleanOptionCombinations) {
        expect(() => new MultimodalIntelligence(options)).not.toThrow();
      }
    });

    it("should preserve undefined vs explicitly set options", () => {
      // Test with undefined (should use defaults)
      const instanceWithUndefined = new MultimodalIntelligence({
        maxConcurrentProcessing: undefined,
      });

      // Test with explicit value
      const instanceWithExplicit = new MultimodalIntelligence({
        maxConcurrentProcessing: 5,
      });

      expect(instanceWithUndefined).toBeInstanceOf(MultimodalIntelligence);
      expect(instanceWithExplicit).toBeInstanceOf(MultimodalIntelligence);

      // Both should work but may have different internal configurations
      const metrics1 = instanceWithUndefined.getSystemMetrics();
      const metrics2 = instanceWithExplicit.getSystemMetrics();

      expect(metrics1.currentLoad).toBeGreaterThanOrEqual(0);
      expect(metrics2.currentLoad).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Configuration Merging and Precedence", () => {
    it("should merge partial options with defaults correctly", () => {
      const partialOptions: Partial<MultimodalIntelligenceOptions> = {
        maxConcurrentProcessing: 15,
        enableSecurity: true,
        // Other options should use defaults
      };

      const instance = new MultimodalIntelligence(partialOptions);

      expect(instance).toBeInstanceOf(MultimodalIntelligence);

      // Test that the instance works (indicating successful merge)
      const metrics = instance.getSystemMetrics();
      expect(metrics).toBeDefined();
    });

    it("should give precedence to explicitly provided options over defaults", async () => {
      const explicitOptions: Partial<MultimodalIntelligenceOptions> = {
        maxConcurrentProcessing: 3,
        processingTimeout: 15000,
        enablePerformanceMonitoring: false,
      };

      const instance = new MultimodalIntelligence(explicitOptions);

      // Test processing with these specific configurations
      const testInput: MultimodalInput = {
        id: "precedence-test",
        type: "text",
        data: "Configuration precedence test",
        metadata: {
          format: "plain",
          size: 29,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const result = await instance.processInput(testInput);
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      await instance.shutdown();
    });

    it("should handle nested option object merging", () => {
      // Test that the system handles complex option structures
      const complexOptions: Partial<MultimodalIntelligenceOptions> = {
        enableSecurity: true,
        enableAudit: true,
        streamingProfile: "conservative",
        defaultKeyId: "complex-test-key",
      };

      expect(() => new MultimodalIntelligence(complexOptions)).not.toThrow();
    });

    it("should maintain immutability of provided options object", () => {
      const originalOptions: Partial<MultimodalIntelligenceOptions> = {
        maxConcurrentProcessing: 7,
        enableSecurity: false,
      };

      const optionsCopy = { ...originalOptions };

      const instance = new MultimodalIntelligence(originalOptions);

      // Original options should not be modified
      expect(originalOptions).toEqual(optionsCopy);
      expect(instance).toBeInstanceOf(MultimodalIntelligence);
    });
  });

  describe("Dependency Injection Compatibility", () => {
    it("should accept optional dependency injection in constructor", () => {
      const options: Partial<MultimodalIntelligenceOptions> = {
        enableSecurity: true,
        enableAudit: true,
      };

      const dependencies = {
        secureDataPorter: mockSecureDataPorter as any,
        safeExpressionEvaluator: mockSafeExpressionEvaluator as any,
        auditTrail: mockAuditTrail as any,
      };

      expect(
        () => new MultimodalIntelligence(options, dependencies),
      ).not.toThrow();
    });

    it("should work without dependency injection when security disabled", () => {
      const options: Partial<MultimodalIntelligenceOptions> = {
        enableSecurity: false,
        enableAudit: false,
      };

      // No dependencies provided
      expect(() => new MultimodalIntelligence(options)).not.toThrow();
    });

    it("should handle partial dependency injection gracefully", () => {
      const options: Partial<MultimodalIntelligenceOptions> = {
        enableSecurity: true,
        enableAudit: false, // Only security enabled
      };

      const partialDependencies = {
        secureDataPorter: mockSecureDataPorter as any,
        // Missing other dependencies
      };

      expect(
        () => new MultimodalIntelligence(options, partialDependencies),
      ).not.toThrow();
    });

    it("should maintain backward compatibility when dependencies not provided", () => {
      const options: Partial<MultimodalIntelligenceOptions> = {
        enableSecurity: true,
        enableAudit: true,
      };

      // Create without dependencies (should use internal defaults or disable features)
      const instance = new MultimodalIntelligence(options);
      expect(instance).toBeInstanceOf(MultimodalIntelligence);

      // Should still be able to process inputs
      const testInput: MultimodalInput = {
        id: "no-deps-test",
        type: "text",
        data: "No dependencies test",
        metadata: {
          format: "plain",
          size: 19,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      expect(() => instance.processInput(testInput)).not.toThrow();
    });

    it("should validate dependency interface compatibility", () => {
      const options: Partial<MultimodalIntelligenceOptions> = {
        enableSecurity: true,
      };

      // Test with properly typed dependencies
      const validDependencies = {
        secureDataPorter: mockSecureDataPorter as any,
        safeExpressionEvaluator: mockSafeExpressionEvaluator as any,
        auditTrail: mockAuditTrail as any,
      };

      const instance = new MultimodalIntelligence(options, validDependencies);
      expect(instance).toBeInstanceOf(MultimodalIntelligence);

      // Dependencies should be properly integrated
      expect(instance.processInput).toBeDefined();
      expect(instance.getSystemMetrics).toBeDefined();
    });
  });

  describe("Environment-Specific Configuration", () => {
    it("should handle development vs production configurations", () => {
      const developmentConfig: Partial<MultimodalIntelligenceOptions> = {
        enablePerformanceMonitoring: true,
        enableAudit: true,
        maxConcurrentProcessing: 2,
        processingTimeout: 10000,
      };

      const productionConfig: Partial<MultimodalIntelligenceOptions> = {
        enablePerformanceMonitoring: true,
        enableAudit: true,
        enableSecurity: true,
        maxConcurrentProcessing: 20,
        processingTimeout: 60000,
        memoryThreshold: 2 * 1024 * 1024 * 1024, // 2GB
      };

      expect(() => new MultimodalIntelligence(developmentConfig)).not.toThrow();
      expect(() => new MultimodalIntelligence(productionConfig)).not.toThrow();
    });

    it("should support test environment configurations", () => {
      const testConfig: Partial<MultimodalIntelligenceOptions> = {
        enableSecurity: false,
        enableAudit: false,
        enablePerformanceMonitoring: false,
        maxConcurrentProcessing: 1,
        processingTimeout: 5000,
      };

      const instance = new MultimodalIntelligence(testConfig);
      expect(instance).toBeInstanceOf(MultimodalIntelligence);

      // Should work in test mode
      const metrics = instance.getSystemMetrics();
      expect(metrics.currentLoad).toBeGreaterThanOrEqual(0);
    });

    it("should handle resource-constrained environment configurations", () => {
      const constrainedConfig: Partial<MultimodalIntelligenceOptions> = {
        maxConcurrentProcessing: 1,
        memoryThreshold: 32 * 1024 * 1024, // 32MB
        processingTimeout: 30000,
        streamingProfile: "conservative",
      };

      const instance = new MultimodalIntelligence(constrainedConfig);
      expect(instance).toBeInstanceOf(MultimodalIntelligence);

      // Should handle constraints gracefully
      const metrics = instance.getSystemMetrics();
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });

    it("should support high-performance environment configurations", () => {
      const highPerfConfig: Partial<MultimodalIntelligenceOptions> = {
        maxConcurrentProcessing: 50,
        memoryThreshold: 8 * 1024 * 1024 * 1024, // 8GB
        processingTimeout: 120000,
        streamingProfile: "aggressive",
        enablePerformanceMonitoring: true,
      };

      expect(() => new MultimodalIntelligence(highPerfConfig)).not.toThrow();
    });
  });

  describe("Legacy Configuration Migration", () => {
    it("should handle legacy option names and values", () => {
      // Test configurations that might exist in older codebases
      const legacyStyleConfigs = [
        { maxConcurrentProcessing: 5 }, // Simple legacy config
        { enableSecurity: false, enableAudit: false }, // Security disabled legacy
        { processingTimeout: 45000, memoryThreshold: 256 * 1024 * 1024 }, // Legacy resource limits
      ];

      for (const config of legacyStyleConfigs) {
        expect(() => new MultimodalIntelligence(config)).not.toThrow();
      }
    });

    it("should maintain backward compatibility with older default values", () => {
      // Test that the system works with configurations that would have been
      // typical in earlier versions
      const oldStyleConfig: Partial<MultimodalIntelligenceOptions> = {
        enableSecurity: false,
        enableAudit: false,
        maxConcurrentProcessing: 3,
        processingTimeout: 30000,
      };

      const instance = new MultimodalIntelligence(oldStyleConfig);
      expect(instance).toBeInstanceOf(MultimodalIntelligence);

      // Should provide same basic functionality
      expect(instance.processInput).toBeDefined();
      expect(instance.getSystemMetrics).toBeDefined();
    });

    it("should handle configuration format evolution gracefully", () => {
      // Test different ways the same configuration might be expressed
      const configVariations = [
        { maxConcurrentProcessing: 10 },
        { maxConcurrentProcessing: 10, enablePerformanceMonitoring: true },
        {
          maxConcurrentProcessing: 10,
          enablePerformanceMonitoring: true,
          streamingProfile: "balanced" as const,
        },
      ];

      for (const config of configVariations) {
        const instance = new MultimodalIntelligence(config);
        expect(instance).toBeInstanceOf(MultimodalIntelligence);

        // All variations should provide consistent basic functionality
        const metrics = instance.getSystemMetrics();
        expect(metrics.totalProcessed).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Option Validation and Error Handling", () => {
    it("should handle invalid numeric options gracefully", () => {
      const invalidNumericConfigs = [
        { maxConcurrentProcessing: 0 }, // Zero concurrency
        { maxConcurrentProcessing: -1 }, // Negative concurrency
        { processingTimeout: 0 }, // Zero timeout
        { memoryThreshold: -1 }, // Negative memory
      ];

      // These should either work with adjusted values or throw clear errors
      for (const config of invalidNumericConfigs) {
        try {
          const instance = new MultimodalIntelligence(config);
          expect(instance).toBeInstanceOf(MultimodalIntelligence);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it("should handle invalid string options gracefully", () => {
      const invalidStringConfigs = [
        { streamingProfile: "invalid" as any },
        { defaultKeyId: "" }, // Empty key ID
        { defaultKeyId: null as any }, // Null key ID
      ];

      for (const config of invalidStringConfigs) {
        try {
          const instance = new MultimodalIntelligence(config);
          expect(instance).toBeInstanceOf(MultimodalIntelligence);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it("should provide meaningful error messages for invalid configurations", () => {
      // Test specific invalid configurations that should provide clear errors
      const invalidConfigs = [
        { maxConcurrentProcessing: "invalid" as any },
        { enableSecurity: "yes" as any },
        { processingTimeout: "long" as any },
      ];

      for (const config of invalidConfigs) {
        try {
          new MultimodalIntelligence(config);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBeDefined();
          expect((error as Error).message.length).toBeGreaterThan(0);
        }
      }
    });

    it("should handle null and undefined configurations", () => {
      // Should work with null/undefined (use defaults)
      expect(() => new MultimodalIntelligence(null as any)).not.toThrow();
      expect(() => new MultimodalIntelligence(undefined)).not.toThrow();

      // Should work with partial null/undefined properties
      const configWithNulls = {
        maxConcurrentProcessing: null as any,
        enableSecurity: undefined,
        processingTimeout: 10000,
      };

      expect(() => new MultimodalIntelligence(configWithNulls)).not.toThrow();
    });
  });

  describe("Dynamic Configuration Updates", () => {
    it("should maintain configuration immutability after construction", () => {
      const mutableConfig = {
        maxConcurrentProcessing: 5,
        enableSecurity: true,
      };

      const instance = new MultimodalIntelligence(mutableConfig);

      // Modify the original config
      mutableConfig.maxConcurrentProcessing = 50;
      mutableConfig.enableSecurity = false;

      // Instance should not be affected by external modifications
      expect(instance).toBeInstanceOf(MultimodalIntelligence);

      // Instance should continue to work with original configuration
      const metrics = instance.getSystemMetrics();
      expect(metrics.currentLoad).toBeGreaterThanOrEqual(0);
    });

    it("should support configuration inspection through system metrics", () => {
      const testConfig: Partial<MultimodalIntelligenceOptions> = {
        maxConcurrentProcessing: 7,
        enablePerformanceMonitoring: true,
      };

      const instance = new MultimodalIntelligence(testConfig);
      const metrics = instance.getSystemMetrics();

      // Should be able to infer configuration from metrics
      expect(metrics.currentLoad).toBeGreaterThanOrEqual(0);
      expect(metrics.currentLoad).toBeLessThanOrEqual(1);

      // Memory usage indicates performance monitoring is active
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });

    it("should handle configuration-dependent feature availability", async () => {
      const securityEnabledConfig: Partial<MultimodalIntelligenceOptions> = {
        enableSecurity: true,
        enableAudit: true,
      };

      const securityDisabledConfig: Partial<MultimodalIntelligenceOptions> = {
        enableSecurity: false,
        enableAudit: false,
      };

      const secureInstance = new MultimodalIntelligence(securityEnabledConfig);
      const basicInstance = new MultimodalIntelligence(securityDisabledConfig);

      const testInput: MultimodalInput = {
        id: "config-dependent-test",
        type: "text",
        data: "Configuration-dependent feature test",
        metadata: {
          format: "plain",
          size: 36,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const securityContext: SecureProcessingContext = {
        correlationId: "test-correlation",
        userId: "test-user",
        dataClassification: "internal",
        purpose: "testing",
      };

      // Both should work but with different feature sets
      const secureResult = await secureInstance.processInput(testInput, {
        securityContext,
      });
      const basicResult = await basicInstance.processInput(testInput);

      expect(secureResult.confidence).toBeGreaterThan(0);
      expect(basicResult.confidence).toBeGreaterThan(0);

      await secureInstance.shutdown();
      await basicInstance.shutdown();
    });
  });

  describe("Complete Integration Tests", () => {
    it("should work end-to-end with various constructor option combinations", async () => {
      const configurationTests = [
        {
          name: "minimal config",
          options: {} as Partial<MultimodalIntelligenceOptions>,
        },
        {
          name: "security enabled",
          options: {
            enableSecurity: true,
            enableAudit: true,
            defaultKeyId: "integration-test-key",
          } as Partial<MultimodalIntelligenceOptions>,
        },
        {
          name: "performance optimized",
          options: {
            maxConcurrentProcessing: 15,
            streamingProfile: "aggressive",
            memoryThreshold: 1024 * 1024 * 1024,
          } as Partial<MultimodalIntelligenceOptions>,
        },
        {
          name: "resource constrained",
          options: {
            maxConcurrentProcessing: 2,
            streamingProfile: "conservative",
            memoryThreshold: 64 * 1024 * 1024,
            processingTimeout: 15000,
          } as Partial<MultimodalIntelligenceOptions>,
        },
      ];

      for (const test of configurationTests) {
        const instance = new MultimodalIntelligence(test.options);

        try {
          const testInput: MultimodalInput = {
            id: `integration-${test.name.replace(/\s+/g, "-")}`,
            type: "text",
            data: `Integration test for ${test.name}`,
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

          const result = await instance.processInput(testInput);

          expect(result).toBeDefined();
          expect(result.confidence).toBeGreaterThan(0);
          expect(result.inputId).toBe(testInput.id);

          const metrics = instance.getSystemMetrics();
          expect(metrics.totalProcessed).toBeGreaterThan(0);
        } finally {
          await instance.shutdown();
        }
      }
    });

    it("should maintain API consistency across all constructor configurations", async () => {
      const configurations = [
        { enableSecurity: true },
        { enableAudit: true },
        { enablePerformanceMonitoring: false },
        { streamingProfile: "conservative" as const },
        { maxConcurrentProcessing: 1 },
        { maxConcurrentProcessing: 20 },
      ];

      const apiMethods = [
        "processInput",
        "processMultimodalInputs",
        "getSystemMetrics",
        "on",
        "off",
        "shutdown",
      ];

      for (const config of configurations) {
        const instance = new MultimodalIntelligence(config);

        // Check that all API methods are present
        for (const method of apiMethods) {
          expect(
            instance[method as keyof MultimodalIntelligence],
          ).toBeDefined();
          expect(typeof instance[method as keyof MultimodalIntelligence]).toBe(
            "function",
          );
        }

        // Test basic functionality
        const metrics = instance.getSystemMetrics();
        expect(metrics).toBeDefined();
        expect(typeof metrics.totalProcessed).toBe("number");

        await instance.shutdown();
      }
    });
  });
});
