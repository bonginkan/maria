/**
 * Event Queue Processor with Backpressure Management
 * Part of Phase 2: System Stabilization
 */

import type { MemoryEvent } from "../memory-system/types/memory-interfaces";

export interface QueueConfig {
  maxQueueSize?: number;
  maxBatchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  processingDelayMs?: number;
}

export interface QueueStats {
  queueSize: number;
  dlqSize: number;
  processed: number;
  failed: number;
  retried: number;
  dropped: number;
  avgProcessTime: number;
}

export class EventQueueProcessor {
  private queue: MemoryEvent[] = [];
  private dlq: MemoryEvent[] = []; // Dead letter queue
  private processing = false;
  private config: Required<QueueConfig>;
  private stats: QueueStats;
  private processTimeHistory: number[] = [];

  constructor(_config?: QueueConfig) {
    this._config = {
      maxQueueSize: _config?.maxQueueSize ?? 500,
      maxBatchSize: _config?.maxBatchSize ?? 10,
      maxRetries: _config?.maxRetries ?? 3,
      retryDelayMs: _config?.retryDelayMs ?? 1000,
      processingDelayMs: _config?.processingDelayMs ?? 100,
    };

    this.stats = {
      queueSize: 0,
      dlqSize: 0,
      processed: 0,
      failed: 0,
      retried: 0,
      dropped: 0,
      avgProcessTime: 0,
    };
  }

  /**
   * Enqueue an _event with backpressure management
   */
  async enqueue(_event: MemoryEvent): Promise<boolean> {
    // Initialize retry _count if not present
    if (!event.metadata) {
      event.metadata = { _retryCount: 0, priority: "medium" };
    }
    if (event.metadata.retryCount === undefined) {
      event.metadata.retryCount = 0;
    }

    // Apply backpressure
    if (this.queue.length >= this.config.maxQueueSize) {
      // Move lowest priority events to DLQ
      const _toMove = this.queue
        .sort((a, b) => {
          const _aPriority = this.getPriorityValue(a.metadata?.priority);
          const _bPriority = this.getPriorityValue(b.metadata?.priority);
          return _aPriority - _bPriority;
        })
        .slice(0, Math.floor(this.config.maxQueueSize * 0.1)); // Move 10%

      for (const _evt of _toMove) {
        this.dlq.push(_evt);
        const _index = this.queue.indexOf(_evt);
        if (_index > -1) {
          this.queue.splice(_index, 1);
        }
      }

      this.stats.dropped += _toMove.length;
    }

    this.queue.push(_event);
    this.stats.queueSize = this.queue.length;

    // Start processing if not already running
    void this.processQueue();

    return true;
  }

  /**
   * Process the queue with automatic batching
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Extract _batch
      const _batch = this.queue.splice(0, this.config.maxBatchSize);
      const _startTime = Date.now();

      // Process _batch with Promise.allSettled for partial failure handling
      const _results = await Promise.allSettled(
        _batch.map((_event) => this.processEvent(_event)),
      );

      const _processingTime = Date.now() - _startTime;
      this.updateProcessingStats(_processingTime);

      // Handle _failures
      const _failures: MemoryEvent[] = [];
      _results.forEach((result, _index) => {
        if (result.status === "rejected") {
          const _event = _batch[_index];
          if (_event) {
            _failures.push(_event);
            this.stats.failed++;
          }
        } else {
          this.stats.processed++;
        }
      });

      // Retry _failures with exponential backoff
      if (_failures.length > 0) {
        this.scheduleRetries(_failures);
      }
    } finally {
      this.processing = false;
      this.stats.queueSize = this.queue.length;

      // Continue processing if queue has _items
      if (this.queue.length > 0) {
        setTimeout(() => {
          void this.processQueue();
        }, this.config.processingDelayMs);
      }
    }
  }

  /**
   * Process a single _event (override in subclass)
   */
  protected async processEvent(_event: MemoryEvent): Promise<void> {
    // Default implementation - override in subclass
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate random _failures for testing
    if (Math.random() < 0.1 && _event.metadata?.retryCount === 0) {
      throw new Error("Simulated processing error");
    }
  }

  /**
   * Schedule retry for failed events
   */
  private scheduleRetries(events: MemoryEvent[]): void {
    for (const _event of events) {
      if (!_event.metadata) {
        _event.metadata = { _retryCount: 0 };
      }

      const _retryCount = _event.metadata._retryCount ?? 0;

      if (_retryCount < this.config.maxRetries) {
        // Exponential backoff
        const _delay = this.config.retryDelayMs * Math.pow(2, _retryCount);

        setTimeout(() => {
          _event.metadata!._retryCount = _retryCount + 1;
          this.queue.push(_event);
          this.stats.retried++;
        }, _delay);
      } else {
        // Move to DLQ after max retries
        this.dlq.push(_event);
        this.stats.dlqSize = this.dlq.length;
      }
    }
  }

  /**
   * Get priority value for sorting
   */
  private getPriorityValue(priority?: string): number {
    switch (priority) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(duration: number): void {
    this.processTimeHistory.push(duration);

    // Keep last 100 measurements
    if (this.processTimeHistory.length > 100) {
      this.processTimeHistory.shift();
    }

    // Calculate average
    const _sum = this.processTimeHistory.reduce((a, b) => a + b, 0);
    this.stats.avgProcessTime = _sum / this.processTimeHistory.length;
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Get _items from dead letter queue
   */
  getDLQ(): MemoryEvent[] {
    return [...this.dlq];
  }

  /**
   * Clear dead letter queue
   */
  clearDLQ(): number {
    const _count = this.dlq.length;
    this.dlq = [];
    this.stats.dlqSize = 0;
    return _count;
  }

  /**
   * Reprocess _items from DLQ
   */
  async reprocessDLQ(): Promise<void> {
    const _items = this.dlq.splice(0, this.config.maxBatchSize);

    for (const _item of _items) {
      // Reset retry _count
      if (_item.metadata) {
        _item.metadata.retryCount = 0;
      }
      await this.enqueue(_item);
    }

    this.stats.dlqSize = this.dlq.length;
  }

  /**
   * Flush the queue (process all immediately)
   */
  async flush(): Promise<void> {
    while (this.queue.length > 0 || this.processing) {
      if (!this.processing) {
        await this.processQueue();
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queue = [];
    this.dlq = [];
    this.stats = {
      queueSize: 0,
      dlqSize: 0,
      processed: 0,
      failed: 0,
      retried: 0,
      dropped: 0,
      avgProcessTime: 0,
    };
    this.processTimeHistory = [];
  }
}
