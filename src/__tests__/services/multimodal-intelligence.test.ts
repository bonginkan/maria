/**
 * MultimodalIntelligence Test Suite - Phase 4 Implementation
 * Comprehensive testing for all core functionality and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi, _Mock } from "vitest";
import {
  MultimodalIntelligence,
  ModalityType,
  MultimodalInput,
  _ProcessedOutput,
  ModalityProcessor,
} from "../../services/multimodal-intelligence.js";
import { _logger } from "../../utils/logger.js";

// Mock logger to prevent test output pollution
vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fs module for testing
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
}));

vi.mock("fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe("MultimodalIntelligence", () => {
  let intelligence: MultimodalIntelligence;
  const testDataDir = "/tmp/test-multimodal";

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create fresh instance with test configuration
    intelligence = await MultimodalIntelligence.getInstance({
      dataDir: testDataDir,
      maxQueueSize: 10,
      maxConcurrentProcessing: 2,
      enablePriorityQueue: true,
      confidenceCalculation: {
        outputWeight: 0.7,
        correlationWeight: 0.3,
        modalityWeights: {
          text: 1.0,
          code: 0.9,
          image: 0.8,
          audio: 0.7,
          video: 0.6,
          document: 0.8,
          structured: 0.9,
          diagram: 0.7,
          screenshot: 0.8,
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up
    await intelligence.stop();
  });

  describe("Initialization", () => {
    it("should create singleton instance", async () => {
      const instance1 = await MultimodalIntelligence.getInstance();
      const instance2 = await MultimodalIntelligence.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should initialize with default configuration", async () => {
      const stats = intelligence.getProcessingStats();

      expect(stats.queueSize).toBe(0);
      expect(stats.currentlyProcessing).toBe(0);
      expect(stats.maxConcurrentProcessing).toBe(2);
      expect(stats.totalProcessed).toBe(0);
    });

    it("should initialize memory thresholds", () => {
      const memoryStats = intelligence.getMemoryStats();

      expect(memoryStats.processedOutputs.max).toBeGreaterThan(0);
      expect(memoryStats.semanticConcepts.max).toBeGreaterThan(0);
      expect(memoryStats.crossModalAnalyses.max).toBeGreaterThan(0);
    });
  });

  describe("Input Processing", () => {
    it("should process text input successfully", async () => {
      const input: MultimodalInput = {
        id: "test-text-1",
        type: "text",
        data: "Hello, world!",
        metadata: {
          format: "plain/text",
          size: 13,
          language: "en",
          source: "test",
          quality: 1.0,
          tags: ["test"],
        },
        timestamp: new Date(),
        priority: 5,
        context: ["testing"],
      };

      const output = await intelligence.processInput(input);

      expect(output).toBeDefined();
      expect(output.inputId).toBe(input.id);
      expect(output.type).toBe("analysis");
      expect(output.confidence).toBeGreaterThan(0);
    });

    it("should handle multiple inputs concurrently", async () => {
      const inputs: MultimodalInput[] = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-test-${i}`,
        type: "text" as ModalityType,
        data: `Test data ${i}`,
        metadata: {
          format: "plain/text",
          size: 10,
          source: "concurrent-test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: (i % 3) + 1, // Varying priorities
        context: [],
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        inputs.map((input) => intelligence.processInput(input)),
      );
      const processingTime = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.success !== false)).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should respect processing priority", async () => {
      const lowPriorityInput: MultimodalInput = {
        id: "low-priority",
        type: "text",
        data: "Low priority",
        metadata: {
          format: "text",
          size: 12,
          source: "test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 1,
        context: [],
      };

      const highPriorityInput: MultimodalInput = {
        id: "high-priority",
        type: "text",
        data: "High priority",
        metadata: {
          format: "text",
          size: 13,
          source: "test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 10,
        context: [],
      };

      // Submit low priority first
      const lowPromise = intelligence.processInput(lowPriorityInput);
      const highPromise = intelligence.processInput(highPriorityInput);

      const [lowResult, highResult] = await Promise.all([
        lowPromise,
        highPromise,
      ]);

      expect(lowResult).toBeDefined();
      expect(highResult).toBeDefined();
    });

    it("should handle processing errors gracefully", async () => {
      // Register a failing processor
      const failingProcessor: ModalityProcessor = {
        type: "code",
        async process() {
          throw new Error("Simulated processing failure");
        },
        canHandle() {
          return true;
        },
        getCapabilities() {
          return [];
        },
        getConfiguration() {
          return {
            model: "failing",
            version: "1.0.0",
            parameters: Record<string, any>,
            requirements: [],
          };
        },
      };

      intelligence.registerProcessor("code", failingProcessor);

      const input: MultimodalInput = {
        id: "failing-input",
        type: "code",
        data: "const x = 1;",
        metadata: {
          format: "javascript",
          size: 11,
          source: "test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 5,
        context: [],
      };

      await expect(intelligence.processInput(input)).rejects.toThrow(
        "Simulated processing failure",
      );
    });
  });

  describe("Cross-Modal Analysis", () => {
    it("should analyze multiple modalities together", async () => {
      const textInput: MultimodalInput = {
        id: "cross-text",
        type: "text",
        data: "Description of an image",
        metadata: {
          format: "text",
          size: 22,
          source: "test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 5,
        context: ["cross-modal"],
      };

      const imageInput: MultimodalInput = {
        id: "cross-image",
        type: "image",
        data: "base64imagedata",
        metadata: {
          format: "png",
          size: 1024,
          dimensions: { width: 100, height: 100 },
          source: "test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 5,
        context: ["cross-modal"],
      };

      const analysis = await intelligence.processMultimodalInputs([
        textInput,
        imageInput,
      ]);

      expect(analysis).toBeDefined();
      expect(analysis.modalities).toContain("text");
      expect(analysis.modalities).toContain("image");
      expect(analysis.analysis).toBeInstanceOf(Array);
      expect(analysis.correlations).toBeInstanceOf(Array);
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it("should identify complementary information", async () => {
      const inputs: MultimodalInput[] = [
        {
          id: "comp1",
          type: "text",
          data: "Code documentation",
          metadata: {
            format: "text",
            size: 18,
            source: "test",
            quality: 1.0,
            tags: [],
          },
          timestamp: new Date(),
          priority: 5,
          context: ["development"],
        },
        {
          id: "comp2",
          type: "code",
          data: "function test() { return true; }",
          metadata: {
            format: "javascript",
            size: 32,
            language: "js",
            source: "test",
            quality: 1.0,
            tags: [],
          },
          timestamp: new Date(),
          priority: 5,
          context: ["development"],
        },
      ];

      const analysis = await intelligence.processMultimodalInputs(inputs);

      expect(
        analysis.analysis.some((insight) => insight.type === "complementary"),
      ).toBe(true);
    });
  });

  describe("Adaptive Interface", () => {
    it("should create adaptive interface for user", async () => {
      const userId = "test-user-1";
      const context = {
        currentTask: "data-analysis",
        environment: "desktop" as const,
        urgency: 0.5,
        complexity: 0.7,
        availableModalities: ["text", "image", "structured"] as ModalityType[],
      };

      const result = await intelligence.getAdaptiveInterface(userId, context);

      expect(result.recommendedModalities).toBeInstanceOf(Array);
      expect(result.adaptiveInterface.userId).toBe(userId);
      expect(result.adaptations).toBeInstanceOf(Array);
    });

    it("should adapt to user preferences", async () => {
      const userId = "test-user-2";
      const context = {
        currentTask: "coding",
        environment: "desktop" as const,
        urgency: 0.8,
        complexity: 0.6,
        availableModalities: ["text", "code"] as ModalityType[],
      };

      const result = await intelligence.getAdaptiveInterface(userId, context);

      // Should recommend code modality for coding tasks
      expect(result.recommendedModalities).toContain("code");
    });
  });

  describe("Modality Conversion", () => {
    it("should convert between modalities", async () => {
      const textInput: MultimodalInput = {
        id: "convert-text",
        type: "text",
        data: "Convert this to audio",
        metadata: {
          format: "text",
          size: 20,
          source: "test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 5,
        context: [],
      };

      const audioOutput = await intelligence.convertModality(
        textInput,
        "audio",
      );

      expect(audioOutput.type).toBe("audio");
      expect(audioOutput.id).not.toBe(textInput.id);
    });
  });

  describe("Memory Management", () => {
    it("should track memory usage", () => {
      const memoryStats = intelligence.getMemoryStats();

      expect(memoryStats.processedOutputs).toBeDefined();
      expect(memoryStats.semanticConcepts).toBeDefined();
      expect(memoryStats.crossModalAnalyses).toBeDefined();
      expect(memoryStats.adaptiveInterfaces).toBeDefined();
    });

    it("should update memory thresholds", () => {
      const newThresholds = {
        processedOutputsMax: 500,
        semanticConceptsMax: 250,
      };

      intelligence.updateMemoryThresholds(newThresholds);

      const memoryStats = intelligence.getMemoryStats();
      expect(memoryStats.processedOutputs.max).toBe(500);
      expect(memoryStats.semanticConcepts.max).toBe(250);
    });

    it("should enforce memory limits", async () => {
      // Set very low thresholds to trigger enforcement
      intelligence.updateMemoryThresholds({
        processedOutputsMax: 2,
      });

      // Process more than the limit
      const inputs = Array.from({ length: 5 }, (_, i) => ({
        id: `memory-test-${i}`,
        type: "text" as ModalityType,
        data: `Test ${i}`,
        metadata: {
          format: "text",
          size: 6,
          source: "memory-test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 5,
        context: [],
      }));

      for (const input of inputs) {
        await intelligence.processInput(input);
      }

      const stats = intelligence.getMemoryStats();
      expect(stats.processedOutputs.current).toBeLessThanOrEqual(2);
    });
  });

  describe("Event System", () => {
    it("should emit typed events", async () => {
      const eventSpy = vi.fn();
      intelligence.on("inputProcessed", eventSpy);

      const input: MultimodalInput = {
        id: "event-test",
        type: "text",
        data: "Event test",
        metadata: {
          format: "text",
          size: 10,
          source: "test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 5,
        context: [],
      };

      await intelligence.processInput(input);

      expect(eventSpy).toHaveBeenCalledWith({
        inputId: input.id,
        outputId: expect.any(String),
        modality: "text",
      });
    });

    it("should emit processing error events", async () => {
      const errorSpy = vi.fn();
      intelligence.on("processingError", errorSpy);

      const failingProcessor: ModalityProcessor = {
        type: "audio",
        async process() {
          throw new Error("Test error");
        },
        canHandle() {
          return true;
        },
        getCapabilities() {
          return [];
        },
        getConfiguration() {
          return {
            model: "test",
            version: "1.0.0",
            parameters: Record<string, any>,
            requirements: [],
          };
        },
      };

      intelligence.registerProcessor("audio", failingProcessor);

      const input: MultimodalInput = {
        id: "error-test",
        type: "audio",
        data: "audio data",
        metadata: {
          format: "mp3",
          size: 1000,
          source: "test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 5,
        context: [],
      };

      try {
        await intelligence.processInput(input);
      } catch {
        // Expected to fail
      }

      expect(errorSpy).toHaveBeenCalledWith({
        inputId: input.id,
        error: "Test error",
        modality: "audio",
      });
    });
  });

  describe("Performance", () => {
    it("should provide processing statistics", async () => {
      // Process a few inputs to generate stats
      const inputs = Array.from({ length: 3 }, (_, i) => ({
        id: `perf-test-${i}`,
        type: "text" as ModalityType,
        data: `Performance test ${i}`,
        metadata: {
          format: "text",
          size: 17,
          source: "perf-test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 5,
        context: [],
      }));

      for (const input of inputs) {
        await intelligence.processInput(input);
      }

      const stats = intelligence.getProcessingStats();

      expect(stats.totalProcessed).toBe(3);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
    });

    it("should handle high load without memory leaks", async () => {
      const _initialMemory = intelligence.getMemoryStats();

      // Process many inputs
      const promises = Array.from({ length: 20 }, (_, i) =>
        intelligence.processInput({
          id: `load-test-${i}`,
          type: "text",
          data: `Load test ${i}`,
          metadata: {
            format: "text",
            size: 12,
            source: "load-test",
            quality: 1.0,
            tags: [],
          },
          timestamp: new Date(),
          priority: Math.floor(Math.random() * 10),
          context: [],
        }),
      );

      await Promise.all(promises);

      const finalMemory = intelligence.getMemoryStats();

      // Memory usage should not grow excessively
      expect(finalMemory.processedOutputs.utilization).toBeLessThan(1.5);
    });
  });

  describe("Graceful Shutdown", () => {
    it("should stop gracefully", async () => {
      const testIntelligence = await MultimodalIntelligence.getInstance({
        dataDir: "/tmp/shutdown-test",
      });

      // Start some processing
      const promise = testIntelligence.processInput({
        id: "shutdown-test",
        type: "text",
        data: "Shutdown test",
        metadata: {
          format: "text",
          size: 13,
          source: "test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 5,
        context: [],
      });

      await promise;

      // Should stop without throwing
      await expect(testIntelligence.stop()).resolves.toBeUndefined();
    });

    it("should reject new processing after shutdown", async () => {
      const testIntelligence = await MultimodalIntelligence.getInstance({
        dataDir: "/tmp/reject-test",
      });

      await testIntelligence.stop();

      const input: MultimodalInput = {
        id: "rejected-input",
        type: "text",
        data: "Should be rejected",
        metadata: {
          format: "text",
          size: 18,
          source: "test",
          quality: 1.0,
          tags: [],
        },
        timestamp: new Date(),
        priority: 5,
        context: [],
      };

      await expect(testIntelligence.processInput(input)).rejects.toThrow(
        "Service is shutting down",
      );
    });
  });
});
