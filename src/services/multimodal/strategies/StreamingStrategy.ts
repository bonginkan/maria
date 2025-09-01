/**
 * Streaming Strategy Implementation
 * Automatic fallback mechanism for optimal processing mode selection
 *
 * Features:
 * - Dynamic mode selection based on data size and complexity
 * - Automatic fallback on streaming failures
 * - Memory pressure detection and mitigation
 * - Performance optimization based on historical data
 */

import {
  ProcessingMode,
  ProcessingComplexity,
  StreamingStrategy,
  MultimodalInput,
} from "../core/types.js";

export interface StreamingStrategyOptions {
  readonly streamingThreshold: number; // bytes - under this, prefer streaming
  readonly chunkingThreshold: number; // bytes - over this, use chunking
  readonly batchThreshold: number; // bytes - over this, use batch processing
  readonly memoryPressureThreshold: number; // 0-1 - when to avoid streaming
  readonly maxRetryAttempts: number;
  readonly fallbackDelayMs: number;
  readonly performanceHistory: boolean;
}

export interface PerformanceMetrics {
  readonly mode: ProcessingMode;
  readonly dataSize: number;
  readonly complexity: ProcessingComplexity;
  readonly processingTime: number;
  readonly memoryUsed: number;
  readonly success: boolean;
  readonly timestamp: Date;
}

export class AdaptiveStreamingStrategy implements StreamingStrategy {
  private readonly options: StreamingStrategyOptions;
  private readonly performanceHistory: PerformanceMetrics[] = [];
  private readonly maxHistorySize = 1000;

  // Default thresholds based on common usage patterns
  private static readonly DEFAULT_OPTIONS: StreamingStrategyOptions = {
    streamingThreshold: 100 * 1024 * 1024, // 100MB
    chunkingThreshold: 1024 * 1024 * 1024, // 1GB
    batchThreshold: 5 * 1024 * 1024 * 1024, // 5GB
    memoryPressureThreshold: 0.8, // 80% memory usage
    maxRetryAttempts: 3,
    fallbackDelayMs: 1000,
    performanceHistory: true,
  };

  constructor(options?: Partial<StreamingStrategyOptions>) {
    this.options = { ...AdaptiveStreamingStrategy.DEFAULT_OPTIONS, ...options };
  }

  /**
   * Select optimal processing mode based on input characteristics
   */
  selectProcessingMode(
    dataSize: number,
    complexity: ProcessingComplexity,
    memoryAvailable: number,
  ): ProcessingMode {
    const memoryPressure = 1 - memoryAvailable;

    // Check memory pressure first
    if (memoryPressure > this.options.memoryPressureThreshold) {
      return this.selectMemoryConstrainedMode(dataSize);
    }

    // Use historical data if available
    if (this.options.performanceHistory) {
      const historicalRecommendation = this.getHistoricalRecommendation(
        dataSize,
        complexity,
      );
      if (historicalRecommendation) {
        return historicalRecommendation;
      }
    }

    // Default rule-based selection
    return this.selectBasedOnSize(dataSize, complexity);
  }

  /**
   * Determine if fallback is needed and return new mode
   */
  shouldFallback(
    currentMode: ProcessingMode,
    error: Error,
    attemptCount: number,
  ): ProcessingMode | null {
    // No more retries
    if (attemptCount >= this.options.maxRetryAttempts) {
      return null;
    }

    // Determine fallback based on error type and current mode
    const errorMessage = error.message.toLowerCase();

    // Memory-related errors
    if (errorMessage.includes("memory") || errorMessage.includes("oom")) {
      return this.getFallbackForMemoryError(currentMode);
    }

    // Streaming-specific errors (backpressure, timeout)
    if (
      errorMessage.includes("backpressure") ||
      errorMessage.includes("stream")
    ) {
      return this.getFallbackForStreamingError(currentMode);
    }

    // Timeout errors
    if (errorMessage.includes("timeout")) {
      return this.getFallbackForTimeoutError(currentMode);
    }

    // Generic fallback progression
    return this.getGenericFallback(currentMode);
  }

  /**
   * Calculate optimal chunk size for given data size and mode
   */
  getChunkSize(dataSize: number, mode: ProcessingMode): number {
    switch (mode) {
      case "streaming":
        // Smaller chunks for streaming (64KB - 4MB)
        return Math.max(64 * 1024, Math.min(dataSize / 100, 4 * 1024 * 1024));

      case "chunked":
        // Medium chunks (64MB default)
        return Math.max(
          64 * 1024 * 1024,
          Math.min(dataSize / 10, 256 * 1024 * 1024),
        );

      case "batch":
        // Large chunks or entire file
        return dataSize;

      default:
        return 64 * 1024 * 1024; // 64MB default
    }
  }

  /**
   * Estimate memory usage for processing
   */
  estimateMemoryUsage(input: MultimodalInput, mode: ProcessingMode): number {
    const baseSize = this.getInputDataSize(input);

    // Memory multipliers based on processing mode and type
    const modeMultipliers = {
      streaming: 1.5, // Streaming buffers
      chunked: 2.0, // Chunk processing overhead
      batch: 3.0, // Full data in memory
    };

    const modalityMultipliers = {
      text: 1.0,
      code: 1.2,
      image: 2.5, // Image processing overhead
      audio: 1.8,
      video: 4.0, // Video processing is memory intensive
      document: 1.5,
      structured: 1.1,
      diagram: 2.0,
      screenshot: 2.5,
    };

    const modeMultiplier = modeMultipliers[mode];
    const modalityMultiplier = modalityMultipliers[input.type];

    return Math.ceil(baseSize * modeMultiplier * modalityMultiplier);
  }

  /**
   * Record performance metrics for future optimization
   */
  recordPerformance(
    mode: ProcessingMode,
    dataSize: number,
    complexity: ProcessingComplexity,
    processingTime: number,
    memoryUsed: number,
    success: boolean,
  ): void {
    if (!this.options.performanceHistory) return;

    const metric: PerformanceMetrics = {
      mode,
      dataSize,
      complexity,
      processingTime,
      memoryUsed,
      success,
      timestamp: new Date(),
    };

    this.performanceHistory.push(metric);

    // Keep history size manageable
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Get performance statistics for analysis
   */
  getPerformanceStats(): {
    totalRecords: number;
    successRate: number;
    averageProcessingTime: number;
    modeDistribution: Record<ProcessingMode, number>;
  } {
    const total = this.performanceHistory.length;
    if (total === 0) {
      return {
        totalRecords: 0,
        successRate: 0,
        averageProcessingTime: 0,
        modeDistribution: { streaming: 0, chunked: 0, batch: 0 },
      };
    }

    const successful = this.performanceHistory.filter((m) => m.success).length;
    const avgTime =
      this.performanceHistory.reduce((sum, m) => sum + m.processingTime, 0) /
      total;

    const modeDistribution = this.performanceHistory.reduce(
      (acc, m) => {
        acc[m.mode] = (acc[m.mode] || 0) + 1;
        return acc;
      },
      {} as Record<ProcessingMode, number>,
    );

    // Normalize to percentages
    Object.keys(modeDistribution).forEach((mode) => {
      modeDistribution[mode as ProcessingMode] =
        modeDistribution[mode as ProcessingMode] / total;
    });

    return {
      totalRecords: total,
      successRate: successful / total,
      averageProcessingTime: avgTime,
      modeDistribution,
    };
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.performanceHistory.length = 0;
  }

  // Private helper methods

  private selectMemoryConstrainedMode(dataSize: number): ProcessingMode {
    // Under memory pressure, prefer batch processing for smaller files
    // and chunked for larger files to minimize memory footprint
    if (dataSize < this.options.streamingThreshold) {
      return "batch"; // Small enough to process in one go
    } else if (dataSize < this.options.chunkingThreshold) {
      return "chunked"; // Medium files - chunk processing
    } else {
      return "batch"; // Very large files - batch with disk spill
    }
  }

  private selectBasedOnSize(
    dataSize: number,
    complexity: ProcessingComplexity,
  ): ProcessingMode {
    // Size-based selection with complexity modifier
    const complexityMultiplier = {
      low: 1.0,
      medium: 0.7, // Medium complexity makes streaming less attractive
      high: 0.5, // High complexity strongly favors chunked/batch
    }[complexity];

    const effectiveThreshold =
      this.options.streamingThreshold * complexityMultiplier;

    if (dataSize < effectiveThreshold) {
      return "streaming";
    } else if (dataSize < this.options.chunkingThreshold) {
      return "chunked";
    } else {
      return "batch";
    }
  }

  private getHistoricalRecommendation(
    dataSize: number,
    complexity: ProcessingComplexity,
  ): ProcessingMode | null {
    // Find similar historical data points
    const similarMetrics = this.performanceHistory.filter((m) => {
      const sizeRatio =
        Math.max(dataSize, m.dataSize) / Math.min(dataSize, m.dataSize);
      return sizeRatio <= 2.0 && m.complexity === complexity && m.success;
    });

    if (similarMetrics.length < 3) {
      return null; // Not enough data
    }

    // Find the mode with the best performance
    const modePerformance = similarMetrics.reduce(
      (acc, m) => {
        if (!acc[m.mode]) {
          acc[m.mode] = { totalTime: 0, count: 0, totalMemory: 0 };
        }
        acc[m.mode].totalTime += m.processingTime;
        acc[m.mode].totalMemory += m.memoryUsed;
        acc[m.mode].count += 1;
        return acc;
      },
      {} as Record<
        ProcessingMode,
        { totalTime: number; count: number; totalMemory: number }
      >,
    );

    // Calculate average performance and select best
    let bestMode: ProcessingMode = "streaming";
    let bestScore = Infinity;

    Object.entries(modePerformance).forEach(([mode, stats]) => {
      const avgTime = stats.totalTime / stats.count;
      const avgMemory = stats.totalMemory / stats.count;
      // Score combines time and memory (weighted)
      const score = avgTime + avgMemory / (1024 * 1024); // Add MB as milliseconds

      if (score < bestScore) {
        bestScore = score;
        bestMode = mode as ProcessingMode;
      }
    });

    return bestMode;
  }

  private getFallbackForMemoryError(
    currentMode: ProcessingMode,
  ): ProcessingMode | null {
    switch (currentMode) {
      case "batch":
        return "chunked"; // Reduce memory footprint
      case "streaming":
        return "chunked"; // More predictable memory usage
      case "chunked":
        return null; // Already the most memory-efficient
      default:
        return "chunked";
    }
  }

  private getFallbackForStreamingError(
    currentMode: ProcessingMode,
  ): ProcessingMode | null {
    switch (currentMode) {
      case "streaming":
        return "chunked"; // Streaming failed, try chunked
      case "chunked":
        return "batch"; // Chunked failed, try batch
      case "batch":
        return null; // Already simplest mode
      default:
        return "batch";
    }
  }

  private getFallbackForTimeoutError(
    currentMode: ProcessingMode,
  ): ProcessingMode | null {
    switch (currentMode) {
      case "batch":
        return "chunked"; // Break down large batch
      case "streaming":
        return "batch"; // Streaming timeout, try simpler batch
      case "chunked":
        return "batch"; // Try different approach
      default:
        return "batch";
    }
  }

  private getGenericFallback(
    currentMode: ProcessingMode,
  ): ProcessingMode | null {
    // Generic fallback progression: streaming -> chunked -> batch -> null
    switch (currentMode) {
      case "streaming":
        return "chunked";
      case "chunked":
        return "batch";
      case "batch":
        return null; // No more options
      default:
        return "batch";
    }
  }

  private getInputDataSize(input: MultimodalInput): number {
    // Estimate data size based on input metadata
    if (input.metadata.size) {
      return input.metadata.size;
    }

    // Fallback estimation based on data type
    if (typeof input.data === "string") {
      return Buffer.byteLength(input.data, "utf8");
    }

    if (Buffer.isBuffer(input.data)) {
      return input.data.length;
    }

    if (Array.isArray(input.data)) {
      return input.data.length * 1024; // Rough estimate
    }

    // Default estimate for unknown types
    return 64 * 1024; // 64KB default
  }
}

/**
 * Factory function to create a streaming strategy with common configurations
 */
export function createStreamingStrategy(
  profile: "conservative" | "balanced" | "aggressive" = "balanced",
): StreamingStrategy {
  const profiles = {
    conservative: {
      streamingThreshold: 50 * 1024 * 1024, // 50MB
      chunkingThreshold: 500 * 1024 * 1024, // 500MB
      memoryPressureThreshold: 0.6, // 60%
      maxRetryAttempts: 5,
    },
    balanced: {
      streamingThreshold: 100 * 1024 * 1024, // 100MB
      chunkingThreshold: 1024 * 1024 * 1024, // 1GB
      memoryPressureThreshold: 0.8, // 80%
      maxRetryAttempts: 3,
    },
    aggressive: {
      streamingThreshold: 200 * 1024 * 1024, // 200MB
      chunkingThreshold: 2 * 1024 * 1024 * 1024, // 2GB
      memoryPressureThreshold: 0.9, // 90%
      maxRetryAttempts: 2,
    },
  };

  return new AdaptiveStreamingStrategy(profiles[profile]);
}
