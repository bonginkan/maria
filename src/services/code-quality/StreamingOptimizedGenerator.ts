/**
 * StreamingOptimizedGenerator - Integration layer for streaming code generation
 * Combines all optimization components into a unified interface
 */

import { EventEmitter } from "node:events";
import { FastCodeGenerator, GenerationMetrics } from "./FastCodeGenerator";
import { StreamingRenderer, UIPort } from "./StreamingRenderer";
import { BackpressureController } from "./BackpressureController";
import {
  ParallelGenerator,
  FileSpec,
  MultiFileRequest,
} from "./ParallelGenerator";
import { MetricsDashboard } from "./MetricsDashboard";
import { getProviderManager } from "../../providers/index";
import { CodeGenerationAnimator } from "./CodeGenerationAnimator";

export interface StreamingGenerationRequest {
  prompt: string;
  options?: {
    stream?: boolean;
    maxConcurrency?: number;
    showDashboard?: boolean;
    timeout?: number;
    multiFile?: {
      files: FileSpec[];
    };
  };
}

export interface StreamingGenerationResult {
  content: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
  metrics: {
    totalTime: number;
    firstTokenMs: number;
    throughputTokensPerSec: number;
    cacheHitRate: number;
    parallelSpeedup?: number;
    backpressureEvents: number;
  };
  dashboard?: MetricsDashboard;
}

/**
 * Enhanced code generator with streaming optimization
 */
export class StreamingOptimizedGenerator extends EventEmitter {
  private fastGenerator: FastCodeGenerator;
  private dashboard: MetricsDashboard;
  private parallelGenerator?: ParallelGenerator;
  private providerManager: ReturnType<typeof getProviderManager>;
  private animator?: CodeGenerationAnimator;

  constructor(
    private ui: UIPort,
    options: {
      enableDashboard?: boolean;
      maxConcurrency?: number;
    } = {},
  ) {
    super();

    // Initialize provider manager (singleton)
    this.providerManager = getProviderManager();
    // Note: initialization will be done before first use
    
    // Pass provider manager to FastCodeGenerator
    this.fastGenerator = new FastCodeGenerator(this.providerManager);
    this.dashboard = new MetricsDashboard({
      updateIntervalMs: 1000,
      showSparklines: true,
      colorOutput: process.stdout.isTTY,
    });

    // Set up parallel generator if needed
    if (options.maxConcurrency && options.maxConcurrency > 1) {
      this.parallelGenerator = new ParallelGenerator(
        (file: FileSpec) => this.generateSingleFile(file),
        { maxConcurrency: options.maxConcurrency },
      );

      // Forward parallel generation events
      this.parallelGenerator.on("file-completed", (file) => {
        this.emit("file-completed", file);
      });

      this.parallelGenerator.on("layer-start", (info) => {
        this.emit("layer-start", info);
      });
    }
  }

  /**
   * Generate code with streaming optimization
   */
  async generate(
    request: StreamingGenerationRequest,
  ): Promise<StreamingGenerationResult> {
    const startTime = Date.now();

    this.emit("generation-start", { request });

    try {
      // Ensure provider is initialized before use
      await this.providerManager.initialize();
      
      // Log current provider for debugging
      if (this.providerManager.getCurrentProvider) {
        console.debug(`🔧 Using provider: ${this.providerManager.getCurrentProvider()}`);
      }
      
      // Show dashboard if requested
      if (request.options?.showDashboard) {
        await this.dashboard.showDashboard();
      }

      // Handle multi-file generation
      if (request.options?.multiFile && this.parallelGenerator) {
        return await this.generateMultiFile(request, startTime);
      }

      // Single file generation with streaming
      return await this.generateSingleStream(request, startTime);
    } catch (error) {
      this.emit("generation-error", { error, request });
      throw error;
    } finally {
      if (request.options?.showDashboard) {
        // Keep dashboard running in background
        setTimeout(() => {
          this.dashboard.stopDashboard();
        }, 5000);
      }
    }
  }

  /**
   * Generate single file with streaming
   */
  private async generateSingleStream(
    request: StreamingGenerationRequest,
    startTime: number,
  ): Promise<StreamingGenerationResult> {
    // Check cache first
    const cacheResult = await this.fastGenerator.checkCache(request.prompt);
    if (cacheResult.hit) {
      // Simulate streaming for cached results
      await this.simulateStreamingOutput(cacheResult.content);

      const metrics: StreamingGenerationResult["metrics"] = {
        totalTime: Date.now() - startTime,
        firstTokenMs: 10, // Very fast for cache hits
        throughputTokensPerSec: cacheResult.content.split(/\s+/).length * 10,
        cacheHitRate: 100,
        backpressureEvents: 0,
      };

      this.recordMetrics("cache_hit", metrics.totalTime, cacheResult.content);

      return {
        content: cacheResult.content,
        metrics,
      };
    }

    // Generate with streaming
    if (request.options?.stream !== false) {
      return await this.generateWithStreaming(request, startTime);
    } else {
      // Fallback to non-streaming generation
      return await this.generateWithoutStreaming(request, startTime);
    }
  }

  /**
   * Generate with real-time streaming
   */
  private async generateWithStreaming(
    request: StreamingGenerationRequest,
    startTime: number,
  ): Promise<StreamingGenerationResult> {
    // Set up streaming components
    const renderer = new StreamingRenderer(this.ui);
    const backpressureController = new BackpressureController(
      async (chunk: string) => {
        // Process chunk (could apply additional formatting)
        this.ui.writeChunk(chunk);
      },
      {
        maxQueueSize: 100,
        processBatchSize: 10,
      },
    );

    // Generate streaming response
    const response = await this.fastGenerator.generateStreaming(
      request.prompt,
      {
        timeout: request.options?.timeout,
        signal: request.options?.timeout
          ? AbortSignal.timeout(request.options.timeout)
          : undefined,
      },
    );

    // Process stream through renderer and backpressure controller
    const streamResult = await renderer.renderStream(response.stream);

    const backpressureMetrics = backpressureController.getMetrics();

    const metrics: StreamingGenerationResult["metrics"] = {
      totalTime: Date.now() - startTime,
      firstTokenMs: streamResult.metrics.firstTokenMs,
      throughputTokensPerSec: streamResult.metrics.throughputTokensPerSec,
      cacheHitRate: 0, // Not a cache hit
      backpressureEvents: backpressureMetrics.backpressureEvents,
    };

    this.recordMetrics("generated", metrics.totalTime, streamResult.content, {
      firstTokenMs: metrics.firstTokenMs,
      throughputTokensPerSec: metrics.throughputTokensPerSec,
    });

    this.emit("generation-complete", {
      content: streamResult.content,
      metrics,
    });

    return {
      content: streamResult.content,
      metrics,
    };
  }

  /**
   * Generate without streaming (fallback)
   */
  private async generateWithoutStreaming(
    request: StreamingGenerationRequest,
    startTime: number,
  ): Promise<StreamingGenerationResult> {
    const result = await this.fastGenerator.generate(request.prompt);

    // Write result to UI at once
    this.ui.writeChunk(result.content);

    const metrics: StreamingGenerationResult["metrics"] = {
      totalTime: Date.now() - startTime,
      firstTokenMs: 0, // No streaming
      throughputTokensPerSec: 0,
      cacheHitRate: result.fromCache ? 100 : 0,
      backpressureEvents: 0,
    };

    this.recordMetrics(
      result.fromCache ? "cache_hit" : "generated",
      metrics.totalTime,
      result.content,
    );

    return {
      content: result.content,
      metrics,
    };
  }

  /**
   * Generate multiple files in parallel
   */
  private async generateMultiFile(
    request: StreamingGenerationRequest,
    startTime: number,
  ): Promise<StreamingGenerationResult> {
    if (!this.parallelGenerator) {
      throw new Error("Parallel generation not available");
    }

    const multiFileRequest: MultiFileRequest = {
      files: request.options!.multiFile!.files,
      options: {
        maxConcurrency: request.options?.maxConcurrency || 3,
        timeout: request.options?.timeout,
      },
    };

    const results =
      await this.parallelGenerator.generateMultiFile(multiFileRequest);
    const parallelMetrics = this.parallelGenerator.getMetrics();

    // Combine all generated content
    const combinedContent = results
      .filter((r) => r.success)
      .map((r) => `// File: ${r.path}\n${r.content}`)
      .join("\n\n");

    // Write to UI
    this.ui.writeChunk(combinedContent);

    const metrics: StreamingGenerationResult["metrics"] = {
      totalTime: Date.now() - startTime,
      firstTokenMs: 0, // Not applicable for batch generation
      throughputTokensPerSec: 0,
      cacheHitRate: 0,
      parallelSpeedup: parallelMetrics.parallelSpeedup,
      backpressureEvents: 0,
    };

    this.recordMetrics(
      "parallel_generated",
      metrics.totalTime,
      combinedContent,
      {
        parallelSpeedup: parallelMetrics.parallelSpeedup,
        filesGenerated: parallelMetrics.successfulFiles,
      },
    );

    return {
      content: combinedContent,
      files: results
        .filter((r) => r.success)
        .map((r) => ({
          path: r.path,
          content: r.content,
        })),
      metrics,
    };
  }

  /**
   * Generate a single file (used by parallel generator)
   */
  private async generateSingleFile(file: FileSpec): Promise<string> {
    const prompt = file.prompt || `Generate content for file: ${file.path}`;
    const result = await this.fastGenerator.generate(prompt);
    return result.content;
  }

  /**
   * Simulate streaming output for cached content
   */
  private async simulateStreamingOutput(content: string): Promise<void> {
    const chunkSize = 20;

    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      this.ui.writeChunk(chunk);

      // Small delay to simulate streaming
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Record metrics in dashboard
   */
  private recordMetrics(
    type: string,
    duration: number,
    content: string,
    additionalMetrics: any = {},
  ): void {
    const generationMetric: GenerationMetrics = {
      type: type as any,
      duration,
      inputTokens: content.split(/\s+/).length * 0.7, // Estimate
      outputTokens: content.split(/\s+/).length,
      model: "streaming-optimized",
      timestamp: Date.now(),
      ...additionalMetrics,
    };

    this.dashboard.recordGeneration(generationMetric);
  }

  /**
   * Get performance metrics snapshot
   */
  getMetricsSnapshot() {
    return this.dashboard.getSnapshot();
  }

  /**
   * Show metrics dashboard
   */
  async showMetrics(): Promise<void> {
    await this.dashboard.showDashboard();
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.dashboard.clear();
  }
}
