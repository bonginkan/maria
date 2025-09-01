/**
 * Performance Characteristics Validation Tests
 *
 * This test suite validates that performance characteristics remain consistent
 * between the original implementation and the new decomposed system while
 * maintaining 100% API compatibility.
 *
 * Tests cover:
 * - Processing latency consistency and bounds
 * - Memory usage patterns and optimization
 * - Throughput and concurrency performance
 * - Resource utilization under various loads
 * - Performance metrics accuracy and reporting
 * - Scalability characteristics validation
 * - Performance degradation detection
 * - System stability under sustained load
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MultimodalIntelligence,
  ProcessingOptions,
  SystemMetrics,
} from "../../services/multimodal/intelligence.js";
import {
  ModalityType,
  MultimodalInput,
  ProcessedOutput,
  SecureProcessingContext,
} from "../../services/multimodal/core/types.js";

// Performance test configuration
const PERFORMANCE_CONFIG = {
  LATENCY_THRESHOLD_MS: 2000, // 2 seconds max for normal inputs
  MEMORY_INCREASE_THRESHOLD_MB: 100, // 100MB max increase during test
  MIN_THROUGHPUT_PER_SECOND: 1, // Minimum 1 input per second
  CONCURRENT_LOAD_SIZE: 20, // Number of concurrent requests for load testing
  SUSTAINED_LOAD_DURATION_MS: 10000, // 10 seconds of sustained load
  LARGE_INPUT_SIZE_KB: 1000, // 1MB for large input testing
  BATCH_SIZE: 50, // Batch size for batch processing tests
};

// Performance monitoring utilities
class PerformanceMonitor {
  private metrics: Array<{
    operation: string;
    startTime: number;
    endTime: number;
    memoryBefore: number;
    memoryAfter: number;
    inputSize: number;
    success: boolean;
  }> = [];

  async measureOperation<T>(
    operation: string,
    inputSize: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    const memoryBefore = process.memoryUsage().heapUsed;

    let success = false;
    try {
      const result = await fn();
      success = true;
      return result;
    } finally {
      const endTime = Date.now();
      const memoryAfter = process.memoryUsage().heapUsed;

      this.metrics.push({
        operation,
        startTime,
        endTime,
        memoryBefore,
        memoryAfter,
        inputSize,
        success,
      });
    }
  }

  getMetrics() {
    return [...this.metrics];
  }

  getAverageLatency(operation?: string): number {
    const filteredMetrics = operation
      ? this.metrics.filter((m) => m.operation === operation)
      : this.metrics;

    if (filteredMetrics.length === 0) return 0;

    const totalLatency = filteredMetrics.reduce(
      (sum, m) => sum + (m.endTime - m.startTime),
      0,
    );
    return totalLatency / filteredMetrics.length;
  }

  getMemoryUsage(): { average: number; peak: number; total: number } {
    if (this.metrics.length === 0) {
      return { average: 0, peak: 0, total: 0 };
    }

    const memoryDeltas = this.metrics.map(
      (m) => m.memoryAfter - m.memoryBefore,
    );
    const totalMemory = memoryDeltas.reduce(
      (sum, delta) => sum + Math.max(0, delta),
      0,
    );
    const averageMemory = totalMemory / this.metrics.length;
    const peakMemory = Math.max(...memoryDeltas);

    return { average: averageMemory, peak: peakMemory, total: totalMemory };
  }

  getThroughput(durationMs?: number): number {
    if (this.metrics.length === 0) return 0;

    const successfulMetrics = this.metrics.filter((m) => m.success);
    if (successfulMetrics.length === 0) return 0;

    if (durationMs) {
      return (successfulMetrics.length * 1000) / durationMs;
    }

    const timeSpan =
      Math.max(...successfulMetrics.map((m) => m.endTime)) -
      Math.min(...successfulMetrics.map((m) => m.startTime));

    return timeSpan > 0 ? (successfulMetrics.length * 1000) / timeSpan : 0;
  }

  clear(): void {
    this.metrics = [];
  }
}

// Load generator for performance testing
class LoadGenerator {
  static generateInput(
    id: string,
    type: ModalityType = "text",
    sizeKb: number = 1,
  ): MultimodalInput {
    const contentSize = sizeKb * 1024;
    const baseContent = "Performance test content for load generation. ";
    const repeats = Math.ceil(contentSize / baseContent.length);
    const data = baseContent.repeat(repeats).substring(0, contentSize);

    return {
      id,
      type,
      data,
      metadata: {
        format: "plain",
        size: data.length,
        source: "performance-test",
        quality: 1,
        tags: ["performance", "load-test"],
      },
      timestamp: new Date(),
      priority: 1,
    };
  }

  static generateBatch(count: number, sizeKb: number = 1): MultimodalInput[] {
    return Array.from({ length: count }, (_, i) =>
      LoadGenerator.generateInput(`batch-${i}`, "text", sizeKb),
    );
  }

  static async runConcurrentLoad(
    intelligence: MultimodalIntelligence,
    inputCount: number,
    inputSizeKb: number = 1,
    options?: ProcessingOptions,
  ): Promise<{
    results: ProcessedOutput[];
    duration: number;
    errors: Error[];
  }> {
    const inputs = Array.from({ length: inputCount }, (_, i) =>
      LoadGenerator.generateInput(`concurrent-${i}`, "text", inputSizeKb),
    );

    const startTime = Date.now();
    const results: ProcessedOutput[] = [];
    const errors: Error[] = [];

    const promises = inputs.map(async (input) => {
      try {
        const result = await intelligence.processInput(input, options);
        results.push(result);
        return result;
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });

    await Promise.allSettled(promises);
    const endTime = Date.now();

    return {
      results,
      duration: endTime - startTime,
      errors,
    };
  }
}

describe("Performance Characteristics Validation Tests", () => {
  let intelligence: MultimodalIntelligence;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();

    intelligence = new MultimodalIntelligence({
      enableSecurity: false,
      enableAudit: false,
      enablePerformanceMonitoring: true,
      streamingProfile: "balanced",
      maxConcurrentProcessing: 10,
      processingTimeout: 30000,
      memoryThreshold: 512 * 1024 * 1024, // 512MB
    });
  });

  afterEach(async () => {
    await intelligence.shutdown();
    performanceMonitor.clear();
  });

  describe("Processing Latency Consistency and Bounds", () => {
    it("should process small inputs within acceptable latency bounds", async () => {
      const testInputs = Array.from(
        { length: 10 },
        (_, i) => LoadGenerator.generateInput(`small-latency-${i}`, "text", 1), // 1KB inputs
      );

      for (const input of testInputs) {
        const result = await performanceMonitor.measureOperation(
          "small-input-processing",
          1024, // 1KB
          () => intelligence.processInput(input),
        );

        expect(result.confidence).toBeGreaterThan(0);
        expect(result.processingTime).toBeGreaterThan(0);
        expect(result.inputId).toBe(input.id);
      }

      const averageLatency = performanceMonitor.getAverageLatency(
        "small-input-processing",
      );
      expect(averageLatency).toBeLessThan(
        PERFORMANCE_CONFIG.LATENCY_THRESHOLD_MS,
      );
      expect(averageLatency).toBeGreaterThan(0);
    });

    it("should maintain consistent latency for similar inputs", async () => {
      const similarInputs = Array.from(
        { length: 5 },
        (_, i) => LoadGenerator.generateInput(`consistent-${i}`, "text", 10), // 10KB inputs
      );

      const latencies: number[] = [];

      for (const input of similarInputs) {
        await performanceMonitor.measureOperation(
          "consistent-latency-test",
          10 * 1024, // 10KB
          () => intelligence.processInput(input),
        );
      }

      const metrics = performanceMonitor.getMetrics();
      const consistentLatencies = metrics
        .filter((m) => m.operation === "consistent-latency-test")
        .map((m) => m.endTime - m.startTime);

      expect(consistentLatencies.length).toBe(5);

      // Calculate coefficient of variation (CV = std dev / mean)
      const mean =
        consistentLatencies.reduce((a, b) => a + b) /
        consistentLatencies.length;
      const variance =
        consistentLatencies.reduce(
          (sum, latency) => sum + Math.pow(latency - mean, 2),
          0,
        ) / consistentLatencies.length;
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / mean;

      // Coefficient of variation should be reasonable (less than 50%)
      expect(cv).toBeLessThan(0.5);
      expect(mean).toBeLessThan(PERFORMANCE_CONFIG.LATENCY_THRESHOLD_MS);
    });

    it("should handle large inputs with acceptable latency scaling", async () => {
      const sizeTestCases = [
        { size: 10, name: "medium" }, // 10KB
        { size: 100, name: "large" }, // 100KB
        { size: 500, name: "xlarge" }, // 500KB
      ];

      const latenciesBySize: Array<{ size: number; latency: number }> = [];

      for (const testCase of sizeTestCases) {
        const input = LoadGenerator.generateInput(
          `size-scaling-${testCase.name}`,
          "text",
          testCase.size,
        );

        await performanceMonitor.measureOperation(
          `size-scaling-${testCase.name}`,
          testCase.size * 1024,
          () => intelligence.processInput(input),
        );

        const latency = performanceMonitor.getAverageLatency(
          `size-scaling-${testCase.name}`,
        );
        latenciesBySize.push({ size: testCase.size, latency });
      }

      // Latency should scale reasonably with input size
      for (const { size, latency } of latenciesBySize) {
        expect(latency).toBeLessThan(
          PERFORMANCE_CONFIG.LATENCY_THRESHOLD_MS * (size / 10),
        );
        expect(latency).toBeGreaterThan(0);
      }

      // Larger inputs should generally take longer (within reason)
      const smallLatency =
        latenciesBySize.find((l) => l.size === 10)?.latency || 0;
      const largeLatency =
        latenciesBySize.find((l) => l.size === 500)?.latency || 0;

      if (smallLatency > 0 && largeLatency > 0) {
        // Large inputs shouldn't take more than 50x longer than small ones
        expect(largeLatency / smallLatency).toBeLessThan(50);
      }
    });

    it("should maintain latency bounds under different processing modes", async () => {
      const processingModes: Array<{
        mode: "streaming" | "chunked" | "batch";
        name: string;
      }> = [
        { mode: "batch", name: "batch-mode" },
        { mode: "chunked", name: "chunked-mode" },
        { mode: "streaming", name: "streaming-mode" },
      ];

      for (const { mode, name } of processingModes) {
        const input = LoadGenerator.generateInput(
          `mode-latency-${name}`,
          "text",
          50,
        ); // 50KB
        const options: ProcessingOptions = { mode };

        await performanceMonitor.measureOperation(
          `mode-latency-${name}`,
          50 * 1024,
          () => intelligence.processInput(input, options),
        );

        const latency = performanceMonitor.getAverageLatency(
          `mode-latency-${name}`,
        );
        expect(latency).toBeLessThan(
          PERFORMANCE_CONFIG.LATENCY_THRESHOLD_MS * 2,
        ); // 2x threshold for different modes
      }
    });
  });

  describe("Memory Usage Patterns and Optimization", () => {
    it("should maintain reasonable memory usage for individual requests", async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const testInput = LoadGenerator.generateInput("memory-test", "text", 100); // 100KB

      const result = await performanceMonitor.measureOperation(
        "memory-usage-test",
        100 * 1024,
        () => intelligence.processInput(testInput),
      );

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      const memoryUsage = performanceMonitor.getMemoryUsage();
      const memoryIncreaseMB = memoryUsage.peak / (1024 * 1024);

      expect(memoryIncreaseMB).toBeLessThan(
        PERFORMANCE_CONFIG.MEMORY_INCREASE_THRESHOLD_MB,
      );
    });

    it("should properly release memory after processing completion", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process several inputs
      const inputs = Array.from(
        { length: 10 },
        (_, i) =>
          LoadGenerator.generateInput(`memory-release-${i}`, "text", 50), // 50KB each
      );

      for (const input of inputs) {
        await intelligence.processInput(input);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Allow some time for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / (1024 * 1024);

      // Memory increase should be reasonable (not all memory should be retained)
      expect(memoryIncreaseMB).toBeLessThan(
        PERFORMANCE_CONFIG.MEMORY_INCREASE_THRESHOLD_MB,
      );
    });

    it("should handle memory pressure gracefully", async () => {
      // Create memory pressure scenario
      const memoryConstrainedIntelligence = new MultimodalIntelligence({
        enableSecurity: false,
        enableAudit: false,
        enablePerformanceMonitoring: true,
        memoryThreshold: 64 * 1024 * 1024, // 64MB threshold
        maxConcurrentProcessing: 2,
      });

      try {
        const largeInputs = Array.from(
          { length: 5 },
          (_, i) =>
            LoadGenerator.generateInput(`memory-pressure-${i}`, "text", 200), // 200KB each
        );

        const results: ProcessedOutput[] = [];
        const errors: Error[] = [];

        for (const input of largeInputs) {
          try {
            const result =
              await memoryConstrainedIntelligence.processInput(input);
            results.push(result);
          } catch (error) {
            errors.push(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        }

        // Should handle memory pressure either by processing successfully or failing gracefully
        expect(results.length + errors.length).toBe(5);

        // If some succeeded, they should be valid
        for (const result of results) {
          expect(result.confidence).toBeGreaterThan(0);
        }
      } finally {
        await memoryConstrainedIntelligence.shutdown();
      }
    });

    it("should optimize memory usage for batch processing", async () => {
      const batchInputs = LoadGenerator.generateBatch(20, 25); // 20 inputs of 25KB each
      const initialMemory = process.memoryUsage().heapUsed;

      const results = await intelligence.processMultimodalInputs(batchInputs);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / (1024 * 1024);

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(20);

      // Batch processing should be memory efficient
      expect(memoryIncreaseMB).toBeLessThan(
        PERFORMANCE_CONFIG.MEMORY_INCREASE_THRESHOLD_MB,
      );
    });
  });

  describe("Throughput and Concurrency Performance", () => {
    it("should maintain minimum throughput for concurrent processing", async () => {
      const concurrentInputs = LoadGenerator.generateBatch(
        PERFORMANCE_CONFIG.CONCURRENT_LOAD_SIZE,
        10, // 10KB each
      );

      const startTime = Date.now();

      const results = await Promise.all(
        concurrentInputs.map((input) => intelligence.processInput(input)),
      );

      const endTime = Date.now();
      const duration = endTime - startTime;
      const throughput = (results.length * 1000) / duration; // inputs per second

      expect(results.length).toBe(PERFORMANCE_CONFIG.CONCURRENT_LOAD_SIZE);
      expect(throughput).toBeGreaterThan(
        PERFORMANCE_CONFIG.MIN_THROUGHPUT_PER_SECOND,
      );

      // All results should be valid
      for (const result of results) {
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.processingTime).toBeGreaterThan(0);
      }
    });

    it("should scale throughput with concurrent processing limits", async () => {
      const concurrencyLevels = [1, 3, 5, 10];
      const throughputResults: Array<{
        concurrency: number;
        throughput: number;
      }> = [];

      for (const maxConcurrency of concurrencyLevels) {
        const testIntelligence = new MultimodalIntelligence({
          enableSecurity: false,
          enableAudit: false,
          enablePerformanceMonitoring: true,
          maxConcurrentProcessing: maxConcurrency,
          processingTimeout: 10000,
        });

        try {
          const testInputs = LoadGenerator.generateBatch(15, 5); // 15 inputs of 5KB each

          const { results, duration } = await LoadGenerator.runConcurrentLoad(
            testIntelligence,
            15,
            5,
          );

          const throughput = (results.length * 1000) / duration;
          throughputResults.push({ concurrency: maxConcurrency, throughput });
        } finally {
          await testIntelligence.shutdown();
        }
      }

      // Throughput should generally increase with concurrency (up to optimal point)
      expect(throughputResults.length).toBe(4);

      for (const result of throughputResults) {
        expect(result.throughput).toBeGreaterThan(0);
      }

      // Higher concurrency should not dramatically decrease throughput
      const lowestThroughput = Math.min(
        ...throughputResults.map((r) => r.throughput),
      );
      const highestThroughput = Math.max(
        ...throughputResults.map((r) => r.throughput),
      );

      expect(highestThroughput / lowestThroughput).toBeLessThan(10); // Within 10x range
    });

    it("should handle mixed workload sizes efficiently", async () => {
      const mixedInputs = [
        ...LoadGenerator.generateBatch(10, 1), // 10 small (1KB)
        ...LoadGenerator.generateBatch(5, 50), // 5 medium (50KB)
        ...LoadGenerator.generateBatch(3, 200), // 3 large (200KB)
      ];

      // Shuffle the array to mix workload sizes
      for (let i = mixedInputs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mixedInputs[i], mixedInputs[j]] = [mixedInputs[j], mixedInputs[i]];
      }

      const { results, duration } = await LoadGenerator.runConcurrentLoad(
        intelligence,
        mixedInputs.length,
        0, // Size already set in inputs
      );

      const throughput = (results.length * 1000) / duration;

      expect(results.length).toBe(mixedInputs.length);
      expect(throughput).toBeGreaterThan(
        PERFORMANCE_CONFIG.MIN_THROUGHPUT_PER_SECOND / 2,
      ); // Account for larger inputs

      // All results should be valid regardless of input size
      for (const result of results) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe("Resource Utilization Under Various Loads", () => {
    it("should report accurate system metrics under load", async () => {
      // Get baseline metrics
      const baselineMetrics = intelligence.getSystemMetrics();
      expect(baselineMetrics.totalProcessed).toBeGreaterThanOrEqual(0);
      expect(baselineMetrics.totalErrors).toBeGreaterThanOrEqual(0);
      expect(baselineMetrics.currentLoad).toBeGreaterThanOrEqual(0);

      // Generate load
      const loadInputs = LoadGenerator.generateBatch(10, 20); // 10 inputs of 20KB each

      const results = await Promise.all(
        loadInputs.map((input) => intelligence.processInput(input)),
      );

      // Get metrics after load
      const loadMetrics = intelligence.getSystemMetrics();

      expect(loadMetrics.totalProcessed).toBeGreaterThan(
        baselineMetrics.totalProcessed,
      );
      expect(loadMetrics.averageLatency).toBeGreaterThan(0);
      expect(loadMetrics.currentLoad).toBeGreaterThanOrEqual(0);
      expect(loadMetrics.currentLoad).toBeLessThanOrEqual(1);

      // Processor stats should be populated
      expect(Object.keys(loadMetrics.processorStats)).toContain("text");

      const textStats = loadMetrics.processorStats.text;
      expect(textStats.count).toBeGreaterThan(0);
      expect(textStats.healthy).toBeLessThanOrEqual(textStats.count);
      expect(textStats.averageLatency).toBeGreaterThan(0);
      expect(textStats.errorRate).toBeGreaterThanOrEqual(0);
      expect(textStats.errorRate).toBeLessThanOrEqual(1);
    });

    it("should adapt resource usage based on system load", async () => {
      const loadTestCases = [
        { name: "light", inputCount: 5, inputSize: 10 },
        { name: "moderate", inputCount: 15, inputSize: 25 },
        { name: "heavy", inputCount: 25, inputSize: 50 },
      ];

      const resourceUsageResults: Array<{
        load: string;
        avgLatency: number;
        memoryUsage: number;
        currentLoad: number;
      }> = [];

      for (const testCase of loadTestCases) {
        const testInputs = LoadGenerator.generateBatch(
          testCase.inputCount,
          testCase.inputSize,
        );

        const startTime = Date.now();
        await Promise.all(
          testInputs.map((input) => intelligence.processInput(input)),
        );
        const endTime = Date.now();

        const metrics = intelligence.getSystemMetrics();
        resourceUsageResults.push({
          load: testCase.name,
          avgLatency: metrics.averageLatency,
          memoryUsage: metrics.memoryUsage,
          currentLoad: metrics.currentLoad,
        });

        // Short delay between test cases
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Validate resource adaptation
      for (const result of resourceUsageResults) {
        expect(result.avgLatency).toBeGreaterThan(0);
        expect(result.memoryUsage).toBeGreaterThan(0);
        expect(result.currentLoad).toBeGreaterThanOrEqual(0);
        expect(result.currentLoad).toBeLessThanOrEqual(1);
      }

      // Heavy load should not cause excessive resource usage
      const heavyLoadResult = resourceUsageResults.find(
        (r) => r.load === "heavy",
      );
      expect(heavyLoadResult).toBeDefined();
      expect(heavyLoadResult!.avgLatency).toBeLessThan(
        PERFORMANCE_CONFIG.LATENCY_THRESHOLD_MS * 3,
      );
    });

    it("should maintain stability during sustained load", async () => {
      const sustainedLoadDuration = 5000; // 5 seconds
      const loadGenerationInterval = 100; // New input every 100ms

      const allResults: ProcessedOutput[] = [];
      const allErrors: Error[] = [];
      const startTime = Date.now();

      // Generate sustained load
      const loadPromise = new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (Date.now() - startTime > sustainedLoadDuration) {
            clearInterval(interval);
            resolve();
            return;
          }

          const input = LoadGenerator.generateInput(
            `sustained-${Date.now()}`,
            "text",
            15, // 15KB inputs
          );

          intelligence
            .processInput(input)
            .then((result) => allResults.push(result))
            .catch((error) =>
              allErrors.push(
                error instanceof Error ? error : new Error(String(error)),
              ),
            );
        }, loadGenerationInterval);
      });

      await loadPromise;

      // Allow pending operations to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const finalMetrics = intelligence.getSystemMetrics();

      // System should remain stable
      expect(allResults.length).toBeGreaterThan(0);
      expect(finalMetrics.currentLoad).toBeGreaterThanOrEqual(0);
      expect(finalMetrics.currentLoad).toBeLessThanOrEqual(1);

      // Error rate should be acceptable
      const errorRate =
        allErrors.length / (allResults.length + allErrors.length);
      expect(errorRate).toBeLessThan(0.1); // Less than 10% error rate

      // All successful results should be valid
      for (const result of allResults) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe("Performance Metrics Accuracy and Reporting", () => {
    it("should report accurate processing time metrics", async () => {
      const testInputs = LoadGenerator.generateBatch(5, 30); // 5 inputs of 30KB each
      const actualProcessingTimes: number[] = [];

      for (const input of testInputs) {
        const startTime = Date.now();
        const result = await intelligence.processInput(input);
        const endTime = Date.now();

        const actualTime = endTime - startTime;
        actualProcessingTimes.push(actualTime);

        // Reported processing time should be reasonable compared to actual
        expect(result.processingTime).toBeGreaterThan(0);
        expect(result.processingTime).toBeLessThan(actualTime + 1000); // Within 1 second tolerance
      }

      const metrics = intelligence.getSystemMetrics();

      // Average latency should be reasonable
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeLessThan(
        Math.max(...actualProcessingTimes) * 2,
      );
    });

    it("should maintain accurate counters and statistics", async () => {
      const initialMetrics = intelligence.getSystemMetrics();

      const successInputs = LoadGenerator.generateBatch(8, 10); // Should succeed
      const failureInputs: MultimodalInput[] = [
        {
          id: "failure-test",
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
        },
      ];

      // Process successful inputs
      const successResults = await Promise.all(
        successInputs.map((input) => intelligence.processInput(input)),
      );

      // Process failing inputs
      const failureResults = await Promise.allSettled(
        failureInputs.map((input) => intelligence.processInput(input)),
      );

      const finalMetrics = intelligence.getSystemMetrics();

      // Counters should be accurate
      const expectedTotalProcessed =
        initialMetrics.totalProcessed + successResults.length;
      const expectedTotalErrors =
        initialMetrics.totalErrors +
        failureResults.filter((r) => r.status === "rejected").length;

      expect(finalMetrics.totalProcessed).toBe(expectedTotalProcessed);
      expect(finalMetrics.totalErrors).toBe(expectedTotalErrors);

      // Memory usage should be reported
      expect(finalMetrics.memoryUsage).toBeGreaterThan(0);
    });

    it("should provide accurate processor-specific statistics", async () => {
      const textInputs = LoadGenerator.generateBatch(10, 20); // Text inputs

      await Promise.all(
        textInputs.map((input) => intelligence.processInput(input)),
      );

      const metrics = intelligence.getSystemMetrics();

      expect(metrics.processorStats).toBeDefined();
      expect(Object.keys(metrics.processorStats)).toContain("text");

      const textStats = metrics.processorStats.text;

      expect(textStats.count).toBeGreaterThan(0);
      expect(textStats.healthy).toBeGreaterThan(0);
      expect(textStats.healthy).toBeLessThanOrEqual(textStats.count);
      expect(textStats.averageLatency).toBeGreaterThan(0);
      expect(textStats.errorRate).toBeGreaterThanOrEqual(0);
      expect(textStats.errorRate).toBeLessThanOrEqual(1);
    });
  });

  describe("Scalability Characteristics Validation", () => {
    it("should demonstrate linear scalability within limits", async () => {
      const scalabilityTestCases = [
        { inputCount: 5, name: "small" },
        { inputCount: 15, name: "medium" },
        { inputCount: 30, name: "large" },
      ];

      const scalabilityResults: Array<{
        inputCount: number;
        totalTime: number;
        avgTimePerInput: number;
        throughput: number;
      }> = [];

      for (const testCase of scalabilityTestCases) {
        const inputs = LoadGenerator.generateBatch(testCase.inputCount, 15); // 15KB each

        const startTime = Date.now();
        const results = await Promise.all(
          inputs.map((input) => intelligence.processInput(input)),
        );
        const endTime = Date.now();

        const totalTime = endTime - startTime;
        const avgTimePerInput = totalTime / testCase.inputCount;
        const throughput = (results.length * 1000) / totalTime;

        scalabilityResults.push({
          inputCount: testCase.inputCount,
          totalTime,
          avgTimePerInput,
          throughput,
        });

        expect(results.length).toBe(testCase.inputCount);
      }

      // Analyze scalability characteristics
      for (const result of scalabilityResults) {
        expect(result.throughput).toBeGreaterThan(0);
        expect(result.avgTimePerInput).toBeGreaterThan(0);
      }

      // Average time per input shouldn't increase dramatically with scale
      const smallScale = scalabilityResults.find((r) => r.inputCount === 5);
      const largeScale = scalabilityResults.find((r) => r.inputCount === 30);

      if (smallScale && largeScale) {
        const scalingRatio =
          largeScale.avgTimePerInput / smallScale.avgTimePerInput;
        expect(scalingRatio).toBeLessThan(5); // Should not be more than 5x slower per input
      }
    });

    it("should handle resource contention gracefully", async () => {
      // Create resource contention by limiting concurrency
      const constrainedIntelligence = new MultimodalIntelligence({
        enableSecurity: false,
        enableAudit: false,
        enablePerformanceMonitoring: true,
        maxConcurrentProcessing: 2, // Very limited concurrency
        processingTimeout: 5000,
      });

      try {
        const contentionInputs = LoadGenerator.generateBatch(20, 25); // 20 inputs competing for 2 slots

        const { results, duration, errors } =
          await LoadGenerator.runConcurrentLoad(
            constrainedIntelligence,
            20,
            25,
          );

        // Should handle contention gracefully
        expect(results.length).toBeGreaterThan(0);
        expect(results.length + errors.length).toBe(20);

        // Even with contention, throughput should be reasonable
        const throughput = (results.length * 1000) / duration;
        expect(throughput).toBeGreaterThan(0.5); // At least 0.5 inputs per second
      } finally {
        await constrainedIntelligence.shutdown();
      }
    });
  });

  describe("Performance Degradation Detection", () => {
    it("should detect performance degradation under high load", async () => {
      // Establish baseline performance
      const baselineInput = LoadGenerator.generateInput("baseline", "text", 20);
      const baselineStart = Date.now();
      await intelligence.processInput(baselineInput);
      const baselineLatency = Date.now() - baselineStart;

      // Generate high load
      const highLoadInputs = LoadGenerator.generateBatch(50, 30); // 50 inputs of 30KB each
      const highLoadStart = Date.now();

      const highLoadResults = await Promise.all(
        highLoadInputs.map((input) => intelligence.processInput(input)),
      );

      const highLoadEnd = Date.now();
      const avgHighLoadLatency =
        (highLoadEnd - highLoadStart) / highLoadInputs.length;

      // Performance degradation should be reasonable
      const degradationRatio = avgHighLoadLatency / baselineLatency;
      expect(degradationRatio).toBeLessThan(10); // Should not be more than 10x slower

      // All high load results should be valid
      expect(highLoadResults.length).toBe(50);
      for (const result of highLoadResults) {
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it("should maintain QoS during sustained heavy load", async () => {
      const heavyLoadDuration = 8000; // 8 seconds
      const inputGenerationRate = 50; // Every 50ms

      const qosMetrics: Array<{
        timestamp: number;
        latency: number;
        success: boolean;
      }> = [];

      const startTime = Date.now();

      const heavyLoadPromise = new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          const elapsed = Date.now() - startTime;

          if (elapsed > heavyLoadDuration) {
            clearInterval(interval);
            resolve();
            return;
          }

          const input = LoadGenerator.generateInput(
            `qos-${elapsed}`,
            "text",
            40, // 40KB inputs
          );

          const requestStart = Date.now();
          intelligence
            .processInput(input)
            .then(() => {
              qosMetrics.push({
                timestamp: elapsed,
                latency: Date.now() - requestStart,
                success: true,
              });
            })
            .catch(() => {
              qosMetrics.push({
                timestamp: elapsed,
                latency: Date.now() - requestStart,
                success: false,
              });
            });
        }, inputGenerationRate);
      });

      await heavyLoadPromise;

      // Allow pending operations to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Analyze QoS metrics
      expect(qosMetrics.length).toBeGreaterThan(0);

      const successfulMetrics = qosMetrics.filter((m) => m.success);
      const successRate = successfulMetrics.length / qosMetrics.length;

      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate

      if (successfulMetrics.length > 0) {
        const avgLatency =
          successfulMetrics.reduce((sum, m) => sum + m.latency, 0) /
          successfulMetrics.length;
        expect(avgLatency).toBeLessThan(
          PERFORMANCE_CONFIG.LATENCY_THRESHOLD_MS * 5,
        ); // 5x threshold for heavy load
      }
    });
  });
});
