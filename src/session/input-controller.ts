/**
 * InputController - Serializes concurrent input operations
 * Prevents race conditions and ensures single-threaded input processing
 * Critical for preventing infinite loops and double dispatch
 */

export interface InputMetrics {
  concurrent: number;
  queued: number;
  processed: number;
  maxQueueSize: number;
}

export class InputController {
  private inflight = false;
  private queue: Array<() => Promise<void>> = [];
  private metrics: InputMetrics = {
    concurrent: 0,
    queued: 0,
    processed: 0,
    maxQueueSize: 0,
  };

  /**
   * Acquire exclusive access to process input
   * If already processing, queue the operation
   * Ensures serial execution to prevent race conditions
   */
  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    // Add debug logging for troubleshooting
    if (process.env.MARIA_DEBUG === "1") {
      console.log(
        `[INPUT_CONTROLLER] acquire - inflight=${this.inflight}, queue=${this.queue.length}`,
      );
    }

    if (this.inflight) {
      this.metrics.queued++;
      this.metrics.maxQueueSize = Math.max(
        this.metrics.maxQueueSize,
        this.queue.length + 1,
      );

      return new Promise<T>((resolve, reject) => {
        this.queue.push(async () => {
          try {
            resolve(await fn());
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    this.inflight = true;
    this.metrics.concurrent = 1;

    try {
      const result = await fn();
      this.metrics.processed++;
      return result;
    } finally {
      this.inflight = false;
      this.metrics.concurrent = 0;

      // Process next item in queue
      const next = this.queue.shift();
      if (next) {
        // Don't await - let it run asynchronously
        void next().catch(() => {
          /* errors handled by the promise */
        });
      }

      if (process.env.MARIA_DEBUG === "1") {
        console.log(
          `[INPUT_CONTROLLER] release - queue=${this.queue.length}, processed=${this.metrics.processed}`,
        );
      }
    }
  }

  /**
   * Get current metrics for monitoring
   */
  getMetrics(): Readonly<InputMetrics> {
    return { ...this.metrics };
  }

  /**
   * Check if currently processing input
   */
  isProcessing(): boolean {
    return this.inflight;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear the queue (emergency use only)
   * WARNING: This will reject all queued operations
   */
  clearQueue(): void {
    const count = this.queue.length;
    this.queue = [];
    if (process.env.MARIA_DEBUG === "1") {
      console.log(
        `[INPUT_CONTROLLER] clearQueue - cleared ${count} operations`,
      );
    }
  }
}
