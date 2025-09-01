/**
 * Processing Engine with cancellation support and metrics
 */

import { EventEmitter } from "node:events";
import type {
  MultimodalInput,
  ProcessedOutput,
  ProcessorPort,
  QueuedTask,
  StoragePort,
  MonitoringPort,
  ProcessingStats,
} from "./types";
import { ObservableFairQueue } from "./queue";
import {
  withCancellation,
  runWithCancellation,
  CancellationError,
} from "../utils/cancellation.js";
import { safeAverage, safePercentile } from "../utils/math.js";
import { settleTask, resolveTask, rejectTask } from "./types";

export interface EngineOptions {
  queue?: ObservableFairQueue;
  storage?: StoragePort;
  monitoring?: MonitoringPort;
  processors: Map<string, ProcessorPort>;
  maxConcurrent?: number;
  defaultTimeoutMs?: number;
  persistKeys?: {
    outputs?: string;
    stats?: string;
  };
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
}

export interface EngineEvents {
  "processing.started": { input: MultimodalInput; taskId: string };
  "processing.completed": { output: ProcessedOutput; duration: number };
  "processing.failed": { input: MultimodalInput; error: Error; reason: string };
  "processing.cancelled": {
    taskId: string;
    reason: "deadline" | "abort" | "manual";
  };
  "queue.pressure": { size: number; inFlight: number; capacity: number };
  "metrics.updated": { stats: ProcessingStats };
}

export interface EngineMetrics {
  totalProcessed: number;
  totalFailed: number;
  totalCancelled: number;
  currentInFlight: number;
  currentQueueSize: number;
  avgProcessingTimeMs: number;
  p50ProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  p99ProcessingTimeMs: number;
  successRate: number;
  errorRate: number;
  cancelRate: number;
}

/**
 * Core processing engine with queue management and cancellation
 */
export class Engine extends EventEmitter {
  private readonly queue: ObservableFairQueue;
  private readonly processors: Map<string, ProcessorPort>;
  private readonly storage?: StoragePort;
  private readonly monitoring?: MonitoringPort;

  // Processing state
  private inFlight = 0;
  private readonly maxConcurrent: number;
  private readonly defaultTimeoutMs: number;
  private stopped = false;

  // Output storage
  private outputs = new Map<string, ProcessedOutput>();

  // Metrics
  private totalProcessed = 0;
  private totalFailed = 0;
  private totalCancelled = 0;
  private processingTimes: number[] = [];
  private readonly maxProcessingTimeSamples = 1000;

  // Round-robin counter for task IDs
  private rrCounter = 0;

  // Auto-save timer
  private autoSaveTimer?: NodeJS.Timeout;

  constructor(private readonly options: EngineOptions) {
    super();

    this.queue =
      options.queue ?? new ObservableFairQueue(100, { enableMetrics: true });
    this.processors = options.processors;
    this.storage = options.storage;
    this.monitoring = options.monitoring;
    this.maxConcurrent = options.maxConcurrent ?? 3;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30000; // 30 seconds

    // Set up queue event forwarding
    this.setupQueueEvents();

    // Start auto-save if enabled
    if (options.enableAutoSave && options.autoSaveInterval) {
      this.startAutoSave(options.autoSaveInterval);
    }
  }

  /**
   * Initialize engine and restore state
   */
  async init(): Promise<void> {
    if (this.storage && this.options.persistKeys?.outputs) {
      try {
        const saved = await this.storage.load<Record<string, ProcessedOutput>>(
          this.options.persistKeys.outputs,
        );
        if (saved) {
          this.outputs = new Map(Object.entries(saved));
        }
      } catch (error) {
        console.error("Failed to restore outputs:", error);
      }
    }

    // Start processing pump
    this.pump();
  }

  /**
   * Stop the engine
   */
  async stop(): Promise<void> {
    this.stopped = true;

    // Stop auto-save
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }

    // Clear queue
    const { cancelled, errors } = this.queue.clear();
    if (errors.length > 0) {
      console.error("Errors during queue clear:", errors);
    }

    // Wait for in-flight tasks
    await this.waitForInFlight();

    // Final save
    await this.saveOutputs();
  }

  /**
   * Process an input with optional cancellation
   */
  async processInput(
    input: MultimodalInput,
    options?: {
      signal?: AbortSignal;
      deadlineMs?: number;
      priority?: number;
    },
  ): Promise<ProcessedOutput> {
    if (this.stopped) {
      throw new Error("Engine is stopped");
    }

    return new Promise<ProcessedOutput>((resolve, reject) => {
      // Create abort controller for this task
      const abortController = new AbortController();

      // Chain external signal if provided
      if (options?.signal) {
        const onAbort = () => abortController.abort();
        options.signal.addEventListener("abort", onAbort, { once: true });

        if (options.signal.aborted) {
          abortController.abort();
        }
      }

      // Create queued task
      const task: QueuedTask = {
        id: this.generateTaskId(),
        input,
        enqueuedAt: Date.now(),
        rr: ++this.rrCounter,
        priority: options?.priority ?? input.priority ?? 0,
        abortController,
        resolve: (output) => {
          if (settleTask(task, () => resolve(output))) {
            this.recordSuccess(output);
          }
        },
        reject: (error) => {
          if (settleTask(task, () => reject(error))) {
            this.recordFailure(input, error);
          }
        },
      };

      // Try to enqueue
      try {
        this.queue.enqueue(task);
        this.pump(); // Trigger processing
      } catch (error) {
        // Queue is full, reject immediately
        rejectTask(task, error);
      }
    });
  }

  /**
   * Process multiple inputs in parallel
   */
  async processMultiple(
    inputs: MultimodalInput[],
    options?: {
      signal?: AbortSignal;
      deadlineMs?: number;
    },
  ): Promise<ProcessedOutput[]> {
    const promises = inputs.map((input) => this.processInput(input, options));

    return Promise.all(promises);
  }

  /**
   * Get a processed output by ID
   */
  getOutput(outputId: string): ProcessedOutput | undefined {
    return this.outputs.get(outputId);
  }

  /**
   * Get engine metrics
   */
  getMetrics(): EngineMetrics {
    const queueMetrics = this.queue.getQueueMetrics();
    const total = this.totalProcessed + this.totalFailed + this.totalCancelled;

    return {
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      totalCancelled: this.totalCancelled,
      currentInFlight: this.inFlight,
      currentQueueSize: queueMetrics.size,
      avgProcessingTimeMs: safeAverage(this.processingTimes),
      p50ProcessingTimeMs: safePercentile(this.processingTimes, 50),
      p95ProcessingTimeMs: safePercentile(this.processingTimes, 95),
      p99ProcessingTimeMs: safePercentile(this.processingTimes, 99),
      successRate: total > 0 ? this.totalProcessed / total : 0,
      errorRate: total > 0 ? this.totalFailed / total : 0,
      cancelRate: total > 0 ? this.totalCancelled / total : 0,
    };
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    const metrics = this.getMetrics();
    const queueMetrics = this.queue.getQueueMetrics();

    return {
      totalProcessed: metrics.totalProcessed,
      totalErrors: metrics.totalFailed,
      totalCancelled: metrics.totalCancelled,
      averageProcessingTime: metrics.avgProcessingTimeMs,
      averageQueueTime: queueMetrics.avgQueueTimeMs,
      p50ProcessingTime: metrics.p50ProcessingTimeMs,
      p95ProcessingTime: metrics.p95ProcessingTimeMs,
      p99ProcessingTime: metrics.p99ProcessingTimeMs,
      currentQueueSize: queueMetrics.size,
      currentInFlight: this.inFlight,
    };
  }

  /**
   * Process tasks from queue
   */
  private pump(): void {
    if (this.stopped) return;

    while (this.inFlight < this.maxConcurrent) {
      const task = this.queue.dequeue();
      if (!task) break;

      this.runTask(task);
    }

    // Check queue pressure
    this.checkQueuePressure();
  }

  /**
   * Run a single task
   */
  private async runTask(task: QueuedTask): Promise<void> {
    this.inFlight++;
    const startTime = Date.now();

    try {
      // Emit start event
      this.emit("processing.started", {
        input: task.input,
        taskId: task.id,
      });

      // Select processor
      const processor = this.selectProcessor(task.input);
      if (!processor) {
        throw new Error(`No processor for modality: ${task.input.type}`);
      }

      // Run with cancellation
      const result = await runWithCancellation(
        (signal) =>
          processor.process(task.input, {
            signal,
            deadlineAt: startTime + this.defaultTimeoutMs,
          }),
        {
          signal: task.abortController?.signal,
          deadlineMs: this.defaultTimeoutMs,
        },
      );

      if (result.reason === "completed" && result.value) {
        // Success
        const output = result.value;
        this.outputs.set(output.id, output);

        // Record processing time
        const duration = Date.now() - startTime;
        this.recordProcessingTime(duration);

        // Emit completion
        this.emit("processing.completed", { output, duration });

        // Resolve task
        resolveTask(task, output);

        // Monitor if configured
        if (this.monitoring) {
          this.monitoring.recordSuccess("process");
          this.monitoring.recordLatency("process", duration);
        }
      } else if (result.reason === "deadline" || result.reason === "abort") {
        // Cancelled
        this.totalCancelled++;
        this.emit("processing.cancelled", {
          taskId: task.id,
          reason: result.reason,
        });

        rejectTask(task, new CancellationError(result.reason));

        if (this.monitoring) {
          this.monitoring.recordError("process", new Error(result.reason));
        }
      } else {
        // Error
        throw result.error || new Error("Unknown error");
      }
    } catch (error) {
      // Failed
      const err = error as Error;
      this.emit("processing.failed", {
        input: task.input,
        error: err,
        reason: err.message,
      });

      rejectTask(task, err);

      if (this.monitoring) {
        this.monitoring.recordError("process", err);
      }
    } finally {
      this.inFlight--;

      // Save outputs periodically
      if (this.totalProcessed % 10 === 0) {
        await this.saveOutputs();
      }

      // Continue processing
      this.pump();
    }
  }

  /**
   * Select processor for input
   */
  private selectProcessor(input: MultimodalInput): ProcessorPort | undefined {
    // Try exact match first
    const processor = this.processors.get(input.type);
    if (processor && processor.canHandle(input)) {
      return processor;
    }

    // Try other processors
    for (const p of this.processors.values()) {
      if (p.canHandle(input)) {
        return p;
      }
    }

    return undefined;
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Record successful processing
   */
  private recordSuccess(output: ProcessedOutput): void {
    this.totalProcessed++;
    this.outputs.set(output.id, output);
  }

  /**
   * Record failed processing
   */
  private recordFailure(input: MultimodalInput, error: unknown): void {
    this.totalFailed++;
    console.error(`Processing failed for ${input.id}:`, error);
  }

  /**
   * Record processing time
   */
  private recordProcessingTime(timeMs: number): void {
    this.processingTimes.push(timeMs);

    // Keep only recent samples
    if (this.processingTimes.length > this.maxProcessingTimeSamples) {
      this.processingTimes = this.processingTimes.slice(
        -this.maxProcessingTimeSamples,
      );
    }
  }

  /**
   * Check and emit queue pressure events
   */
  private checkQueuePressure(): void {
    const queueSize = this.queue.size();
    const capacity = this.queue.capacity();
    const utilization = queueSize / capacity;

    if (utilization > 0.8) {
      this.emit("queue.pressure", {
        size: queueSize,
        inFlight: this.inFlight,
        capacity,
      });
    }
  }

  /**
   * Wait for all in-flight tasks to complete
   */
  private async waitForInFlight(timeoutMs = 5000): Promise<void> {
    const startTime = Date.now();

    while (this.inFlight > 0) {
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`Timed out waiting for ${this.inFlight} in-flight tasks`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Save outputs to storage
   */
  private async saveOutputs(): Promise<void> {
    if (!this.storage || !this.options.persistKeys?.outputs) {
      return;
    }

    try {
      const data = Object.fromEntries(this.outputs);
      await this.storage.save(this.options.persistKeys.outputs, data);
    } catch (error) {
      console.error("Failed to save outputs:", error);
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(intervalMs: number): void {
    this.autoSaveTimer = setInterval(() => {
      this.saveOutputs();
      this.emit("metrics.updated", { stats: this.getStats() });
    }, intervalMs);

    // Don't keep process alive
    if (typeof this.autoSaveTimer.unref === "function") {
      this.autoSaveTimer.unref();
    }
  }

  /**
   * Set up queue event forwarding
   */
  private setupQueueEvents(): void {
    this.queue.on("metrics", ({ metrics }) => {
      if (this.monitoring) {
        this.monitoring.recordQueueSize(metrics.size);
        this.monitoring.recordInFlight(this.inFlight);
      }
    });
  }

  // Type-safe event emitter overrides
  on<K extends keyof EngineEvents>(
    event: K,
    listener: (data: EngineEvents[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof EngineEvents>(
    event: K,
    listener: (data: EngineEvents[K]) => void,
  ): this {
    return super.off(event, listener);
  }

  emit<K extends keyof EngineEvents>(event: K, data: EngineEvents[K]): boolean {
    return super.emit(event, data);
  }
}
