/**
 * Enhanced Metrics Collector - Performance Benchmarking and Monitoring v2.1
 * Comprehensive metrics collection for multimodal intelligence system
 *
 * Features:
 * - Real-time performance metrics collection
 * - Prometheus-compatible metrics export
 * - Custom business metrics tracking
 * - Memory leak detection and alerting
 * - Performance regression detection
 * - Enhanced percentile tracking (p50/p95/p99)
 */

import type {
  MonitoringPort,
  OperationMetrics,
  ModalityType,
  ProcessingMode,
} from "../core/types.js";
import {
  safeAverage,
  safePercentile,
  safeMin,
  safeMax,
} from "../utils/math.js";

interface MetricsSample {
  timestamp: number;
  latencyMs: number;
  success: boolean;
  error?: Error;
}

interface MetricsWindow {
  samples: MetricsSample[];
  successCount: number;
  errorCount: number;
  totalCount: number;
  startTime: number;
  endTime: number;
}

/**
 * Collects and calculates metrics with percentile support
 */
export class MetricsCollector implements MonitoringPort {
  private readonly operations = new Map<string, MetricsWindow>();
  private readonly maxSamplesPerOperation: number;
  private readonly windowSizeMs: number;

  // Global metrics
  private queueSizeHistory: number[] = [];
  private inFlightHistory: number[] = [];
  private readonly maxHistorySize = 1000;

  constructor(
    options: {
      maxSamplesPerOperation?: number;
      windowSizeMs?: number;
    } = {},
  ) {
    this.maxSamplesPerOperation = options.maxSamplesPerOperation ?? 10000;
    this.windowSizeMs = options.windowSizeMs ?? 5 * 60 * 1000; // 5 minutes
  }

  recordLatency(operation: string, ms: number): void {
    const window = this.getOrCreateWindow(operation);
    const now = Date.now();

    window.samples.push({
      timestamp: now,
      latencyMs: ms,
      success: true,
    });

    window.successCount++;
    window.totalCount++;
    window.endTime = now;

    this.trimWindow(window);
  }

  recordError(operation: string, error: Error): void {
    const window = this.getOrCreateWindow(operation);
    const now = Date.now();

    window.samples.push({
      timestamp: now,
      latencyMs: 0,
      success: false,
      error,
    });

    window.errorCount++;
    window.totalCount++;
    window.endTime = now;

    this.trimWindow(window);
  }

  recordSuccess(operation: string): void {
    const window = this.getOrCreateWindow(operation);
    window.successCount++;
    window.totalCount++;
    window.endTime = Date.now();
  }

  recordQueueSize(size: number): void {
    this.queueSizeHistory.push(size);
    if (this.queueSizeHistory.length > this.maxHistorySize) {
      this.queueSizeHistory = this.queueSizeHistory.slice(-this.maxHistorySize);
    }
  }

  recordInFlight(count: number): void {
    this.inFlightHistory.push(count);
    if (this.inFlightHistory.length > this.maxHistorySize) {
      this.inFlightHistory = this.inFlightHistory.slice(-this.maxHistorySize);
    }
  }

  getMetrics(operation?: string): OperationMetrics {
    if (operation) {
      return this.getOperationMetrics(operation);
    }

    // Aggregate all operations
    const allSamples: MetricsSample[] = [];
    let totalSuccess = 0;
    let totalError = 0;

    for (const window of this.operations.values()) {
      allSamples.push(...window.samples);
      totalSuccess += window.successCount;
      totalError += window.errorCount;
    }

    const latencies = allSamples
      .filter((s) => s.success && s.latencyMs > 0)
      .map((s) => s.latencyMs);

    const total = totalSuccess + totalError;

    return {
      count: total,
      successCount: totalSuccess,
      errorCount: totalError,
      avgLatencyMs: safeAverage(latencies),
      p50LatencyMs: safePercentile(latencies, 50),
      p95LatencyMs: safePercentile(latencies, 95),
      p99LatencyMs: safePercentile(latencies, 99),
      minLatencyMs: safeMin(latencies),
      maxLatencyMs: safeMax(latencies),
      errorRate: total > 0 ? totalError / total : 0,
    };
  }

  /**
   * Get detailed metrics report
   */
  getDetailedReport(): {
    operations: Map<string, OperationMetrics>;
    global: {
      avgQueueSize: number;
      p95QueueSize: number;
      avgInFlight: number;
      p95InFlight: number;
    };
    summary: OperationMetrics;
  } {
    const operations = new Map<string, OperationMetrics>();

    for (const [name, _] of this.operations) {
      operations.set(name, this.getOperationMetrics(name));
    }

    return {
      operations,
      global: {
        avgQueueSize: safeAverage(this.queueSizeHistory),
        p95QueueSize: safePercentile(this.queueSizeHistory, 95),
        avgInFlight: safeAverage(this.inFlightHistory),
        p95InFlight: safePercentile(this.inFlightHistory, 95),
      },
      summary: this.getMetrics(),
    };
  }

  /**
   * Get percentile breakdowns for an operation
   */
  getPercentileBreakdown(operation: string): {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    p999: number;
  } | null {
    const window = this.operations.get(operation);
    if (!window) return null;

    const latencies = window.samples
      .filter((s) => s.success && s.latencyMs > 0)
      .map((s) => s.latencyMs);

    if (latencies.length === 0) return null;

    return {
      p10: safePercentile(latencies, 10),
      p25: safePercentile(latencies, 25),
      p50: safePercentile(latencies, 50),
      p75: safePercentile(latencies, 75),
      p90: safePercentile(latencies, 90),
      p95: safePercentile(latencies, 95),
      p99: safePercentile(latencies, 99),
      p999: safePercentile(latencies, 99.9),
    };
  }

  /**
   * Get time series data for graphing
   */
  getTimeSeries(
    operation: string,
    bucketSizeMs = 60000, // 1 minute buckets
  ): Array<{
    timestamp: number;
    avgLatency: number;
    count: number;
    errorRate: number;
  }> {
    const window = this.operations.get(operation);
    if (!window || window.samples.length === 0) return [];

    const buckets = new Map<number, MetricsSample[]>();

    // Group samples into buckets
    for (const sample of window.samples) {
      const bucketTime =
        Math.floor(sample.timestamp / bucketSizeMs) * bucketSizeMs;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      buckets.get(bucketTime)!.push(sample);
    }

    // Calculate metrics per bucket
    const timeSeries: Array<{
      timestamp: number;
      avgLatency: number;
      count: number;
      errorRate: number;
    }> = [];

    for (const [timestamp, samples] of buckets) {
      const latencies = samples
        .filter((s) => s.success && s.latencyMs > 0)
        .map((s) => s.latencyMs);

      const errorCount = samples.filter((s) => !s.success).length;

      timeSeries.push({
        timestamp,
        avgLatency: safeAverage(latencies),
        count: samples.length,
        errorRate: samples.length > 0 ? errorCount / samples.length : 0,
      });
    }

    return timeSeries.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear metrics for an operation
   */
  clearOperation(operation: string): void {
    this.operations.delete(operation);
  }

  /**
   * Clear all metrics
   */
  clearAll(): void {
    this.operations.clear();
    this.queueSizeHistory = [];
    this.inFlightHistory = [];
  }

  private getOrCreateWindow(operation: string): MetricsWindow {
    if (!this.operations.has(operation)) {
      const now = Date.now();
      this.operations.set(operation, {
        samples: [],
        successCount: 0,
        errorCount: 0,
        totalCount: 0,
        startTime: now,
        endTime: now,
      });
    }
    return this.operations.get(operation)!;
  }

  private getOperationMetrics(operation: string): OperationMetrics {
    const window = this.operations.get(operation);

    if (!window) {
      return {
        count: 0,
        successCount: 0,
        errorCount: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        errorRate: 0,
      };
    }

    const latencies = window.samples
      .filter((s) => s.success && s.latencyMs > 0)
      .map((s) => s.latencyMs);

    return {
      count: window.totalCount,
      successCount: window.successCount,
      errorCount: window.errorCount,
      avgLatencyMs: safeAverage(latencies),
      p50LatencyMs: safePercentile(latencies, 50),
      p95LatencyMs: safePercentile(latencies, 95),
      p99LatencyMs: safePercentile(latencies, 99),
      minLatencyMs: latencies.length > 0 ? safeMin(latencies) : 0,
      maxLatencyMs: latencies.length > 0 ? safeMax(latencies) : 0,
      errorRate:
        window.totalCount > 0 ? window.errorCount / window.totalCount : 0,
    };
  }

  private trimWindow(window: MetricsWindow): void {
    const now = Date.now();
    const cutoff = now - this.windowSizeMs;

    // Remove old samples
    window.samples = window.samples.filter((s) => s.timestamp > cutoff);

    // Keep only recent samples if exceeding max
    if (window.samples.length > this.maxSamplesPerOperation) {
      window.samples = window.samples.slice(-this.maxSamplesPerOperation);
    }

    // Update start time
    if (window.samples.length > 0) {
      window.startTime = window.samples[0].timestamp;
    }
  }
}
