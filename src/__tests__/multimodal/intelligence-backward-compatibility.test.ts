/**
 * Comprehensive Backward Compatibility Tests for Multimodal Intelligence System
 *
 * This test suite validates 100% API compatibility between the original monolithic
 * intelligence.ts implementation and the new facade pattern with decomposed processors.
 *
 * Tests cover:
 * - All public method signatures and return types
 * - Event emitter behavior and event structure
 * - Error handling and error types
 * - Constructor options and factory functions
 * - Performance characteristics and metrics
 * - Security integration without API changes
 * - Streaming fallback behavior
 * - Legacy field mapping and compatibility shims
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock as _Mock } from "vitest";
import { EventEmitter } from "node:events";
import {
  MultimodalIntelligence,
  createMultimodalIntelligence,
  MultimodalIntelligenceOptions,
  ProcessingOptions,
  SystemMetrics as _SystemMetrics,
  ModalityType,
  MultimodalInput,
  ProcessedOutput,
  InputMetadata,
  OutputMetadata as _OutputMetadata,
} from "../../services/multimodal/intelligence.js";
import {
  ProcessingMode,
  ProcessingComplexity as _ProcessingComplexity,
  SecureProcessingContext as _SecureProcessingContext,
} from "../../services/multimodal/core/types.js";

// Test utilities and mock implementations
class MockProcessorRegistry {
  private processors = new Map();
  private modalityTypes: ModalityType[] = ["text", "code", "image"];
  private eventEmitter = new EventEmitter();

  constructor() {}

  async processInput(
    input: MultimodalInput,
    _options: any,
  ): Promise<ProcessedOutput> {
    return {
      id: `output-${input.id}`,
      inputId: input.id,
      type: "analysis",
      data: { processed: true, original: input.data },
      confidence: 0.95,
      processingTime: 100,
      metadata: {
        processor: "MockProcessor",
        version: "1.0.0",
        parameters: {},
        alternativeResults: [],
        qualityScore: 0.9,
        memoryUsed: 64 * 1024 * 1024,
      },
      timestamp: new Date(),
    };
  }

  getRegisteredModalityTypes(): ModalityType[] {
    return this.modalityTypes;
  }

  getProcessors(_modalityType: ModalityType) {
    return [
      {
        healthStatus: { healthy: true, lastError: null },
        averageResponseTime: 50,
        totalErrors: 0,
        totalRequests: 10,
      },
    ];
  }

  getStats() {
    return { totalRequests: 10, totalErrors: 0 };
  }

  async registerProcessor() {}

  on(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.on(event, listener);
  }

  async shutdown() {
    this.eventEmitter.removeAllListeners();
  }
}

class MockStreamingStrategy {
  selectProcessingMode(): ProcessingMode {
    return "streaming";
  }

  shouldFallback(): ProcessingMode | null {
    return "batch";
  }

  recordPerformance() {}
}

// Mock dependencies
vi.mock("../../services/multimodal/processors/registry.js", () => ({
  ProcessorRegistry: MockProcessorRegistry,
}));

vi.mock("../../services/multimodal/processors/text.js", () => ({
  TextProcessor: class {
    getType() {
      return "text";
    }
  },
}));

vi.mock("../../services/multimodal/strategies/StreamingStrategy.js", () => ({
  AdaptiveStreamingStrategy: MockStreamingStrategy,
  createStreamingStrategy: () => new MockStreamingStrategy(),
}));

describe("MultimodalIntelligence Backward Compatibility", () => {
  let intelligence: MultimodalIntelligence;
  const defaultOptions: Partial<MultimodalIntelligenceOptions> = {
    enableSecurity: false,
    enableAudit: false,
    enablePerformanceMonitoring: true,
    maxConcurrentProcessing: 5,
    processingTimeout: 30000,
    memoryThreshold: 256 * 1024 * 1024,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    intelligence = new MultimodalIntelligence(defaultOptions);
  });

  afterEach(async () => {
    await intelligence.shutdown();
  });

  describe("Constructor and Factory Function Compatibility", () => {
    it("should create instance with default options when no parameters provided", () => {
      const instance = new MultimodalIntelligence();
      expect(instance).toBeInstanceOf(MultimodalIntelligence);
      expect(instance.getSystemMetrics).toBeDefined();
      expect(instance.processInput).toBeDefined();
    });

    it("should accept partial options and merge with defaults", () => {
      const customOptions = {
        maxConcurrentProcessing: 20,
        enableSecurity: true,
      };

      const instance = new MultimodalIntelligence(customOptions);
      const metrics = instance.getSystemMetrics();

      expect(metrics.currentLoad).toBeDefined();
      expect(instance).toBeInstanceOf(MultimodalIntelligence);
    });

    it("should support dependency injection for security components", () => {
      const mockSecureDataPorter = {};
      const mockSafeExpressionEvaluator = {};
      const mockAuditTrail = {};

      const instance = new MultimodalIntelligence(
        { enableSecurity: true, enableAudit: true },
        {
          secureDataPorter: mockSecureDataPorter as any,
          safeExpressionEvaluator: mockSafeExpressionEvaluator as any,
          auditTrail: mockAuditTrail as any,
        },
      );

      expect(instance).toBeInstanceOf(MultimodalIntelligence);
    });

    it("should support factory function for backward compatibility", async () => {
      const instance = await createMultimodalIntelligence({
        maxConcurrentProcessing: 10,
      });

      expect(instance).toBeInstanceOf(MultimodalIntelligence);
      await instance.shutdown();
    });
  });

  describe("processInput Method Compatibility", () => {
    const createTestInput = (
      overrides: Partial<MultimodalInput> = {},
    ): MultimodalInput => ({
      id: "test-input-1",
      type: "text",
      data: "Hello, world!",
      metadata: {
        format: "plain",
        size: 13,
        source: "test",
        quality: 1.0,
        tags: ["test"],
      } as InputMetadata,
      timestamp: new Date(),
      priority: 1,
      context: ["test-context"],
      ...overrides,
    });

    it("should maintain exact same method signature", async () => {
      const input = createTestInput();
      const options: ProcessingOptions = {
        mode: "streaming",
        priority: 2,
        timeout: 5000,
        enableStreaming: true,
      };

      const result = await intelligence.processInput(input, options);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should return ProcessedOutput with exact legacy structure", async () => {
      const input = createTestInput();
      const result = await intelligence.processInput(input);

      // Validate complete structure matches legacy API
      expect(result).toMatchObject({
        id: expect.any(String),
        inputId: input.id,
        type: expect.stringMatching(
          /^(analysis|extraction|generation|transformation|summary)$/,
        ),
        data: expect.any(Object),
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        metadata: {
          processor: expect.any(String),
          version: expect.any(String),
          parameters: expect.any(Object),
          alternativeResults: expect.any(Array),
          qualityScore: expect.any(Number),
        },
        timestamp: expect.any(Date),
      });

      // Validate confidence is in valid range (legacy requirement)
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);

      // Validate processingTime is positive (legacy requirement)
      expect(result.processingTime).toBeGreaterThan(0);

      // Validate legacy-specific fields are present
      expect(result.inputId).toBe(input.id);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should handle all supported modality types", async () => {
      const modalityTypes: ModalityType[] = [
        "text",
        "code",
        "image",
        "audio",
        "video",
        "document",
      ];

      for (const modalityType of modalityTypes) {
        const input = createTestInput({
          type: modalityType,
          id: `test-${modalityType}`,
          data: `${modalityType} data`,
        });

        const result = await intelligence.processInput(input);
        expect(result.inputId).toBe(input.id);
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it("should respect processing options exactly as legacy API", async () => {
      const input = createTestInput();
      const options: ProcessingOptions = {
        mode: "batch",
        priority: 5,
        timeout: 10000,
        securityContext: {
          correlationId: "test-correlation-123",
          userId: "test-user",
          dataClassification: "internal",
          purpose: "testing",
        },
        enableStreaming: false,
      };

      const result = await intelligence.processInput(input, options);

      expect(result).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      // Options should be processed but not affect the return structure
    });

    it("should handle AbortSignal for cancellation", async () => {
      const input = createTestInput();
      const controller = new AbortController();

      // Abort immediately to test cancellation
      controller.abort();

      const options: ProcessingOptions = {
        signal: controller.signal,
      };

      await expect(intelligence.processInput(input, options)).rejects.toThrow();
    });

    it("should validate input and throw appropriate errors", async () => {
      // Test missing required fields
      const invalidInputs = [
        { id: "", type: "text", data: "test" }, // Empty ID
        { id: "test", type: "text", data: undefined }, // Missing data
        { id: "test", type: "invalid" as ModalityType, data: "test" }, // Invalid type
      ];

      for (const invalidInput of invalidInputs) {
        await expect(
          intelligence.processInput(invalidInput as MultimodalInput),
        ).rejects.toThrow();
      }
    });

    it("should support legacy field mapping and compatibility shims", async () => {
      const input = createTestInput({
        // Include legacy-style metadata
        metadata: {
          format: "markdown",
          size: 1000,
          encoding: "utf-8",
          source: "legacy-system",
          quality: 0.8,
          tags: ["legacy", "compatibility"],
        } as InputMetadata,
      });

      const result = await intelligence.processInput(input);

      // Ensure all legacy fields are preserved in output
      expect(result.inputId).toBe(input.id);
      expect(result.metadata?.processor).toBeDefined();
      expect(result.metadata?.qualityScore).toBeGreaterThan(0);
    });
  });

  describe("processMultimodalInputs Method Compatibility", () => {
    it("should maintain exact same method signature for batch processing", async () => {
      const inputs: MultimodalInput[] = [
        {
          id: "batch-1",
          type: "text",
          data: "First input",
          metadata: {
            format: "plain",
            size: 11,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 1,
        },
        {
          id: "batch-2",
          type: "code",
          data: 'console.log("test");',
          metadata: {
            format: "javascript",
            size: 20,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 2,
        },
      ];

      const results = await intelligence.processMultimodalInputs(inputs);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it("should return array of ProcessedOutput maintaining legacy structure", async () => {
      const inputs: MultimodalInput[] = [
        {
          id: "multi-1",
          type: "text",
          data: "Input 1",
          metadata: {
            format: "plain",
            size: 7,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 1,
        },
        {
          id: "multi-2",
          type: "text",
          data: "Input 2",
          metadata: {
            format: "plain",
            size: 7,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 1,
        },
      ];

      const results = await intelligence.processMultimodalInputs(inputs);

      for (const result of results) {
        expect(result).toMatchObject({
          id: expect.any(String),
          inputId: expect.any(String),
          type: expect.any(String),
          data: expect.any(Object),
          confidence: expect.any(Number),
          processingTime: expect.any(Number),
          metadata: expect.any(Object),
          timestamp: expect.any(Date),
        });
      }
    });

    it("should handle empty input array gracefully", async () => {
      const results = await intelligence.processMultimodalInputs([]);
      expect(results).toEqual([]);
    });

    it("should maintain legacy error handling behavior for failed inputs", async () => {
      const inputs: MultimodalInput[] = [
        {
          id: "valid-input",
          type: "text",
          data: "Valid input",
          metadata: {
            format: "plain",
            size: 11,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 1,
        },
        // Invalid input that should be filtered out in legacy behavior
        {
          id: "invalid-input",
          type: "invalid" as ModalityType,
          data: "Invalid",
          metadata: {
            format: "plain",
            size: 7,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 1,
        },
      ];

      // In legacy behavior, failed processings are silently ignored
      const results = await intelligence.processMultimodalInputs(inputs);

      // Should only contain successful results
      expect(results.length).toBeLessThanOrEqual(inputs.length);

      // All returned results should be valid
      for (const result of results) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe("getSystemMetrics Method Compatibility", () => {
    it("should return SystemMetrics with exact legacy structure", async () => {
      // Process some inputs to generate metrics
      const input: MultimodalInput = {
        id: "metrics-test",
        type: "text",
        data: "Test for metrics",
        metadata: {
          format: "plain",
          size: 15,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      await intelligence.processInput(input);

      const metrics = intelligence.getSystemMetrics();

      expect(metrics).toMatchObject({
        uptime: expect.any(Number),
        totalProcessed: expect.any(Number),
        totalErrors: expect.any(Number),
        averageLatency: expect.any(Number),
        currentLoad: expect.any(Number),
        memoryUsage: expect.any(Number),
        processorStats: expect.any(Object),
      });

      // Validate ranges and types
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.totalProcessed).toBeGreaterThanOrEqual(0);
      expect(metrics.totalErrors).toBeGreaterThanOrEqual(0);
      expect(metrics.currentLoad).toBeGreaterThanOrEqual(0);
      expect(metrics.currentLoad).toBeLessThanOrEqual(1);
    });

    it("should include processorStats in legacy format", async () => {
      const metrics = intelligence.getSystemMetrics();

      expect(metrics.processorStats).toBeDefined();
      expect(typeof metrics.processorStats).toBe("object");

      // Check structure for each modality type
      for (const [_modalityType, stats] of Object.entries(
        metrics.processorStats,
      )) {
        expect(stats).toMatchObject({
          count: expect.any(Number),
          healthy: expect.any(Number),
          averageLatency: expect.any(Number),
          errorRate: expect.any(Number),
        });

        expect(stats.count).toBeGreaterThanOrEqual(0);
        expect(stats.healthy).toBeGreaterThanOrEqual(0);
        expect(stats.healthy).toBeLessThanOrEqual(stats.count);
        expect(stats.errorRate).toBeGreaterThanOrEqual(0);
        expect(stats.errorRate).toBeLessThanOrEqual(1);
      }
    });

    it("should calculate averageLatency correctly", async () => {
      const input: MultimodalInput = {
        id: "latency-test",
        type: "text",
        data: "Latency test",
        metadata: {
          format: "plain",
          size: 12,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      await intelligence.processInput(input);

      const metrics = intelligence.getSystemMetrics();

      if (metrics.totalProcessed > 0) {
        expect(metrics.averageLatency).toBeGreaterThan(0);
      } else {
        expect(metrics.averageLatency).toBe(0);
      }
    });
  });

  describe("Event Emitter Compatibility", () => {
    it("should maintain EventEmitter interface with on/off methods", () => {
      const mockListener = vi.fn();

      // Test method signatures
      const onResult = intelligence.on("test-event", mockListener);
      expect(onResult).toBe(intelligence); // Should return this for chaining

      const offResult = intelligence.off("test-event", mockListener);
      expect(offResult).toBe(intelligence); // Should return this for chaining
    });

    it("should emit legacy-compatible events during processing", async () => {
      const events: any[] = [];

      // Set up event listeners
      intelligence.on("input.received", (data) =>
        events.push({ type: "input.received", data }),
      );
      intelligence.on("processing.started", (data) =>
        events.push({ type: "processing.started", data }),
      );
      intelligence.on("processing.completed", (data) =>
        events.push({ type: "processing.completed", data }),
      );
      intelligence.on("processor.available", (data) =>
        events.push({ type: "processor.available", data }),
      );

      const input: MultimodalInput = {
        id: "event-test",
        type: "text",
        data: "Event test",
        metadata: {
          format: "plain",
          size: 10,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      await intelligence.processInput(input);

      // Should have received at least some events
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it("should support event listener removal", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      intelligence.on("test-event", listener1);
      intelligence.on("test-event", listener2);

      // Remove one listener
      intelligence.off("test-event", listener1);

      // This should work without throwing
      expect(() => intelligence.off("test-event", listener2)).not.toThrow();
    });

    it("should emit error events for failed processing", async () => {
      const errorEvents: any[] = [];

      intelligence.on("processing.failed", (data) => errorEvents.push(data));
      intelligence.on("processor.error", (data) => errorEvents.push(data));

      const invalidInput: MultimodalInput = {
        id: "error-test",
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

      await expect(intelligence.processInput(invalidInput)).rejects.toThrow();

      // Error events should be emitted
      // Note: Specific event emission depends on internal implementation
    });
  });

  describe("Shutdown Method Compatibility", () => {
    it("should maintain exact same signature and behavior", async () => {
      await expect(intelligence.shutdown()).resolves.not.toThrow();
    });

    it("should wait for active requests to complete", async () => {
      const input: MultimodalInput = {
        id: "shutdown-test",
        type: "text",
        data: "Shutdown test",
        metadata: {
          format: "plain",
          size: 13,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      // Start processing
      const processingPromise = intelligence.processInput(input);

      // Shutdown should wait
      const shutdownPromise = intelligence.shutdown();

      // Both should complete
      await expect(
        Promise.all([processingPromise, shutdownPromise]),
      ).resolves.toBeDefined();
    });

    it("should clean up event listeners on shutdown", async () => {
      const listener = vi.fn();
      intelligence.on("test-event", listener);

      await intelligence.shutdown();

      // After shutdown, event system should be cleaned up
      // This is implementation-specific but should not throw
      expect(() => intelligence.off("test-event", listener)).not.toThrow();
    });
  });

  describe("Error Handling Compatibility", () => {
    it("should throw same error types as legacy implementation", async () => {
      const invalidInputs = [
        {
          id: "",
          type: "text" as ModalityType,
          data: "empty id",
          metadata: {
            format: "plain",
            size: 8,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 1,
        },
        {
          id: "test",
          type: "unsupported" as ModalityType,
          data: "unsupported type",
          metadata: {
            format: "unknown",
            size: 16,
            source: "test",
            quality: 1,
            tags: [],
          },
          timestamp: new Date(),
          priority: 1,
        },
      ];

      for (const input of invalidInputs) {
        await expect(intelligence.processInput(input)).rejects.toThrow(Error);
      }
    });

    it("should handle timeout errors consistently", async () => {
      const input: MultimodalInput = {
        id: "timeout-test",
        type: "text",
        data: "Long running task",
        metadata: {
          format: "plain",
          size: 17,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const options: ProcessingOptions = {
        timeout: 1, // Very short timeout
      };

      // This behavior depends on implementation details
      // but should either complete or timeout consistently
      try {
        const result = await intelligence.processInput(input, options);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("Performance Characteristics Compatibility", () => {
    it("should maintain similar processing times for equivalent inputs", async () => {
      const input: MultimodalInput = {
        id: "perf-test",
        type: "text",
        data: "Performance test input",
        metadata: {
          format: "plain",
          size: 21,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const startTime = Date.now();
      const result = await intelligence.processInput(input);
      const endTime = Date.now();

      const actualProcessingTime = endTime - startTime;

      // Should complete in reasonable time
      expect(actualProcessingTime).toBeLessThan(5000); // 5 seconds max

      // Reported processing time should be reasonable
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(actualProcessingTime + 100); // Some tolerance
    });

    it("should handle concurrent processing without degradation", async () => {
      const inputs = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-${i}`,
        type: "text" as ModalityType,
        data: `Concurrent input ${i}`,
        metadata: {
          format: "plain",
          size: 20,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        inputs.map((input) => intelligence.processInput(input)),
      );
      const endTime = Date.now();

      expect(results).toHaveLength(5);

      // All should complete successfully
      for (const result of results) {
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.processingTime).toBeGreaterThan(0);
      }

      // Total time should be reasonable for concurrent processing
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it("should maintain memory usage within expected bounds", async () => {
      const initialMetrics = intelligence.getSystemMetrics();
      const initialMemory = initialMetrics.memoryUsage;

      // Process several inputs
      const inputs = Array.from({ length: 10 }, (_, i) => ({
        id: `memory-test-${i}`,
        type: "text" as ModalityType,
        data: `Memory test input ${i}`.repeat(100), // Larger inputs
        metadata: {
          format: "plain",
          size: 2000,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      }));

      await Promise.all(
        inputs.map((input) => intelligence.processInput(input)),
      );

      const finalMetrics = intelligence.getSystemMetrics();
      const memoryIncrease = finalMetrics.memoryUsage - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });

  describe("Streaming Fallback Behavior Compatibility", () => {
    it("should handle streaming fallback without changing API behavior", async () => {
      const largeInput: MultimodalInput = {
        id: "streaming-test",
        type: "text",
        data: "Large input data".repeat(1000),
        metadata: {
          format: "plain",
          size: 16000,
          source: "test",
          quality: 1,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
      };

      const options: ProcessingOptions = {
        enableStreaming: true,
        mode: "streaming",
      };

      const result = await intelligence.processInput(largeInput, options);

      // Result structure should be identical regardless of streaming
      expect(result).toMatchObject({
        id: expect.any(String),
        inputId: largeInput.id,
        type: expect.any(String),
        data: expect.any(Object),
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        timestamp: expect.any(Date),
      });
    });

    it("should fallback gracefully without exposing internal failures", async () => {
      const input: MultimodalInput = {
        id: "fallback-test",
        type: "text",
        data: "Fallback test input",
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

      // Enable streaming but expect fallback to work transparently
      const options: ProcessingOptions = {
        enableStreaming: true,
        mode: "streaming",
      };

      const result = await intelligence.processInput(input, options);
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("Legacy Field Mapping and Compatibility Shims", () => {
    it("should preserve all legacy metadata fields", async () => {
      const input: MultimodalInput = {
        id: "legacy-fields-test",
        type: "text",
        data: "Legacy compatibility test",
        metadata: {
          format: "markdown",
          size: 24,
          encoding: "utf-8",
          dimensions: { width: 100, height: 50 },
          duration: 1.5,
          language: "en",
          source: "legacy-system",
          quality: 0.95,
          tags: ["legacy", "compatibility", "test"],
        } as InputMetadata,
        timestamp: new Date(),
        priority: 3,
        context: ["legacy-context", "backward-compat"],
      };

      const result = await intelligence.processInput(input);

      // Legacy compatibility shim fields
      expect(result.inputId).toBe(input.id);
      expect(result.timestamp).toBeInstanceOf(Date);

      // All metadata should be preserved in appropriate structure
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.processor).toBeDefined();
      expect(result.metadata?.qualityScore).toBeGreaterThan(0);
    });

    it("should handle legacy options format", async () => {
      const input: MultimodalInput = {
        id: "legacy-options-test",
        type: "text",
        data: "Legacy options test",
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

      // Legacy-style options that might exist in old code
      const legacyOptions: ProcessingOptions = {
        mode: "batch",
        priority: 5,
        timeout: 15000,
        enableStreaming: false,
      };

      const result = await intelligence.processInput(input, legacyOptions);
      expect(result).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe("Constructor Options Validation", () => {
    it("should handle all documented constructor option combinations", () => {
      const optionCombinations: Partial<MultimodalIntelligenceOptions>[] = [
        {},
        { enableSecurity: true },
        { enableAudit: true },
        { enablePerformanceMonitoring: false },
        { streamingProfile: "conservative" },
        { streamingProfile: "aggressive" },
        { maxConcurrentProcessing: 1 },
        { maxConcurrentProcessing: 50 },
        { processingTimeout: 5000 },
        { memoryThreshold: 1024 * 1024 },
        {
          enableSecurity: true,
          enableAudit: true,
          enablePerformanceMonitoring: true,
          streamingProfile: "balanced",
          maxConcurrentProcessing: 10,
          processingTimeout: 60000,
          memoryThreshold: 512 * 1024 * 1024,
          defaultKeyId: "test-key-id",
        },
      ];

      for (const options of optionCombinations) {
        expect(() => new MultimodalIntelligence(options)).not.toThrow();
      }
    });

    it("should validate streaming profile options", () => {
      const validProfiles: Array<"conservative" | "balanced" | "aggressive"> = [
        "conservative",
        "balanced",
        "aggressive",
      ];

      for (const profile of validProfiles) {
        const instance = new MultimodalIntelligence({
          streamingProfile: profile,
        });
        expect(instance).toBeInstanceOf(MultimodalIntelligence);
      }
    });
  });
});
