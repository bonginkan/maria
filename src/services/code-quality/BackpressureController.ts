/**
 * BackpressureController - Manages flow control for streaming data
 * Prevents memory overload and ensures smooth output rendering
 */

export interface BackpressureMetrics {
  queueSize: number;
  maxQueueSize: number;
  droppedChunks: number;
  backpressureEvents: number;
  processingRate: number;
}

export interface ProcessorFunction {
  (chunk: string): Promise<void>;
}

/**
 * Controls data flow to prevent overwhelming the renderer
 */
export class BackpressureController {
  private queue: string[] = [];
  private processing = false;
  private readonly MAX_QUEUE_SIZE: number;
  private readonly PROCESS_BATCH_SIZE: number;
  private readonly PROCESS_INTERVAL_MS: number;

  private metrics: BackpressureMetrics = {
    queueSize: 0,
    maxQueueSize: 0,
    droppedChunks: 0,
    backpressureEvents: 0,
    processingRate: 0,
  };

  private processedCount = 0;
  private lastProcessTime = Date.now();
  private waitingResolvers: Array<() => void> = [];

  constructor(
    private processor: ProcessorFunction,
    options: {
      maxQueueSize?: number;
      processBatchSize?: number;
      processIntervalMs?: number;
    } = {},
  ) {
    this.MAX_QUEUE_SIZE = options.maxQueueSize || 100;
    this.PROCESS_BATCH_SIZE = options.processBatchSize || 10;
    this.PROCESS_INTERVAL_MS = options.processIntervalMs || 10;
  }

  /**
   * Add a chunk to the processing queue with backpressure handling
   */
  async handle(chunk: string, options?: { priority?: boolean }): Promise<void> {
    // Update metrics
    this.metrics.queueSize = this.queue.length;
    if (this.queue.length > this.metrics.maxQueueSize) {
      this.metrics.maxQueueSize = this.queue.length;
    }

    // Check if queue is at capacity
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.metrics.backpressureEvents++;

      // Priority chunks wait for capacity
      if (options?.priority === true) {
        await this.waitForCapacity();
      } else {
        // Non-priority chunks are dropped immediately if queue is full
        this.metrics.droppedChunks++;
        return;
      }
    }

    // Add to queue
    this.queue.push(chunk);
    this.metrics.queueSize = this.queue.length;

    // Start processing if not already running
    if (!this.processing) {
      // Use setImmediate to ensure async behavior
      setImmediate(() => this.startProcessing());
    }
  }

  /**
   * Process queued chunks in batches
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;

    this.processing = true;

    while (this.queue.length > 0 || this.waitingResolvers.length > 0) {
      const startTime = Date.now();

      // Process a batch
      const batch = this.queue.splice(0, this.PROCESS_BATCH_SIZE);

      if (batch.length > 0) {
        const combined = batch.join("");

        try {
          await this.processor(combined);
          this.processedCount += batch.length;
        } catch (error) {
          console.error("Error processing chunk batch:", error);
        }
      }

      // Update processing rate
      const elapsed = Date.now() - this.lastProcessTime;
      if (elapsed > 1000) {
        this.metrics.processingRate = (this.processedCount * 1000) / elapsed;
        this.processedCount = 0;
        this.lastProcessTime = Date.now();
      }

      // Update queue size metric
      this.metrics.queueSize = this.queue.length;

      // Notify waiting producers if we have capacity
      if (
        this.queue.length < this.MAX_QUEUE_SIZE &&
        this.waitingResolvers.length > 0
      ) {
        const resolver = this.waitingResolvers.shift();
        if (resolver) resolver();
      }

      // Yield to event loop for smooth UI
      const processingTime = Date.now() - startTime;
      const waitTime = Math.max(0, this.PROCESS_INTERVAL_MS - processingTime);

      if (waitTime > 0 || batch.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.processing = false;
  }

  /**
   * Wait for queue capacity to become available
   */
  private async waitForCapacity(): Promise<void> {
    // If there's already capacity, return immediately
    if (this.queue.length < this.MAX_QUEUE_SIZE) {
      return Promise.resolve();
    }

    // Wait for capacity to become available
    return new Promise<void>((resolve) => {
      this.waitingResolvers.push(resolve);

      // Start processing if not already running to free up space
      if (!this.processing) {
        setImmediate(() => this.startProcessing());
      }
    });
  }

  /**
   * Flush all remaining chunks immediately
   */
  async flush(): Promise<void> {
    // Stop regular processing
    const wasProcessing = this.processing;
    this.processing = false;

    // Process all remaining chunks in order
    const allChunks = [...this.queue];
    this.queue = [];
    this.metrics.queueSize = 0;

    // Process each chunk
    for (const chunk of allChunks) {
      try {
        await this.processor(chunk);
      } catch (error) {
        console.error("Error flushing chunk:", error);
      }
    }

    // Clear any waiting resolvers
    for (const resolver of this.waitingResolvers) {
      resolver();
    }
    this.waitingResolvers = [];

    // Restore processing state if needed
    if (wasProcessing && this.queue.length > 0) {
      this.startProcessing();
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): BackpressureMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current queue size
   */
  get queueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if controller is currently processing
   */
  get isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Clear the queue without processing
   */
  clear(): void {
    const dropped = this.queue.length;
    this.queue = [];
    this.metrics.droppedChunks += dropped;
    this.metrics.queueSize = 0;

    // Notify any waiting producers
    for (const resolver of this.waitingResolvers) {
      resolver();
    }
    this.waitingResolvers = [];
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = {
      queueSize: this.queue.length,
      maxQueueSize: this.queue.length,
      droppedChunks: 0,
      backpressureEvents: 0,
      processingRate: 0,
    };
    this.processedCount = 0;
    this.lastProcessTime = Date.now();
  }
}
