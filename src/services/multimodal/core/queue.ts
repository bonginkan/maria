/**
 * Observable Fair Priority Queue with metrics and round-robin fairness
 */

import { EventEmitter } from "node:events";
import type { QueuedTask } from "./types";
import { settleTask } from "./types";
import { safeAverage, safePercentile } from "../utils/math.js";

export interface QueueMetrics {
  size: number;
  capacity: number;
  utilization: number;
  enqueuedCount: number;
  dequeuedCount: number;
  evictedCount: number;
  cancelledCount: number;
  avgQueueTimeMs: number;
  p50QueueTimeMs: number;
  p95QueueTimeMs: number;
  p99QueueTimeMs: number;
  oldestTaskAgeMs: number;
  throughput: number; // tasks per second
}

export interface QueueEvents {
  enqueue: { task: QueuedTask; queueSize: number };
  dequeue: { task: QueuedTask; queueTime: number };
  evict: { task: QueuedTask; reason: string };
  clear: { cancelledCount: number };
  metrics: { metrics: QueueMetrics };
}

export interface ProcessingQueue {
  enqueue(task: QueuedTask): void;
  dequeue(): QueuedTask | undefined;
  removeLowest(): QueuedTask | undefined;
  size(): number;
  capacity(): number;
  isFull(): boolean;
  clear(): { cancelled: number; errors: Error[] };
}

export interface ObservableQueue extends ProcessingQueue {
  timeInQueue(taskId: string): number | undefined;
  getQueueMetrics(): QueueMetrics;
  on<K extends keyof QueueEvents>(
    event: K,
    listener: (data: QueueEvents[K]) => void,
  ): void;
  off<K extends keyof QueueEvents>(
    event: K,
    listener: (data: QueueEvents[K]) => void,
  ): void;
}

/**
 * Fair Priority Queue with round-robin within same priority
 * Prevents starvation while respecting priorities
 */
export class ObservableFairQueue
  extends EventEmitter
  implements ObservableQueue
{
  // Priority buckets (priority -> tasks)
  private buckets = new Map<number, QueuedTask[]>();

  // Sorted priorities (descending)
  private prioritiesDesc: number[] = [];

  // Round-robin index per priority
  private rrIndex = new Map<number, number>();

  // Task tracking for metrics
  private taskMap = new Map<string, { task: QueuedTask; enqueuedAt: number }>();

  // Queue times for percentile calculation
  private queueTimes: number[] = [];
  private readonly maxQueueTimeSamples = 1000;

  // Metrics
  private _size = 0;
  private enqueuedCount = 0;
  private dequeuedCount = 0;
  private evictedCount = 0;
  private cancelledCount = 0;
  private lastThroughputTime = Date.now();
  private lastThroughputCount = 0;

  constructor(
    private readonly maxSize = 100,
    private readonly options: {
      enableMetrics?: boolean;
      metricsInterval?: number;
    } = {},
  ) {
    super();

    if (options.enableMetrics !== false) {
      this.startMetricsCollection();
    }
  }

  capacity(): number {
    return this.maxSize;
  }

  size(): number {
    return this._size;
  }

  isFull(): boolean {
    return this._size >= this.maxSize;
  }

  enqueue(task: QueuedTask): void {
    if (this.isFull()) {
      // Try to evict lowest priority task
      const evicted = this.removeLowest();
      if (evicted) {
        this.evictedCount++;
        this.emit("evict", { task: evicted, reason: "queue_full" });
        settleTask(evicted, () =>
          evicted.reject(new Error("Evicted due to queue pressure")),
        );
      } else {
        throw new Error(`Queue is full (max=${this.maxSize})`);
      }
    }

    const priority = task.priority;

    // Initialize bucket if needed
    if (!this.buckets.has(priority)) {
      this.buckets.set(priority, []);
      this.rrIndex.set(priority, 0);
      this.updatePriorities();
    }

    // Add task to bucket
    this.buckets.get(priority)!.push(task);
    this._size++;
    this.enqueuedCount++;

    // Track for metrics
    const now = Date.now();
    task.enqueuedAt = now;
    this.taskMap.set(task.id, { task, enqueuedAt: now });

    // Emit event
    this.emit("enqueue", { task, queueSize: this._size });
  }

  dequeue(): QueuedTask | undefined {
    if (this._size === 0) return undefined;

    // Iterate through priorities (highest first)
    for (const priority of this.prioritiesDesc) {
      const bucket = this.buckets.get(priority);
      if (!bucket || bucket.length === 0) continue;

      // Round-robin within bucket
      const idx = this.rrIndex.get(priority)! % bucket.length;
      const [task] = bucket.splice(idx, 1);

      // Update round-robin index (stays at same position due to splice)
      this.rrIndex.set(priority, idx);

      // Clean up empty bucket
      if (bucket.length === 0) {
        this.buckets.delete(priority);
        this.rrIndex.delete(priority);
        this.updatePriorities();
      }

      // Update metrics
      this._size--;
      this.dequeuedCount++;
      const now = Date.now();
      task.dequeuedAt = now;

      // Calculate queue time
      const queueTime = now - task.enqueuedAt;
      this.recordQueueTime(queueTime);

      // Clean up tracking
      this.taskMap.delete(task.id);

      // Emit event
      this.emit("dequeue", { task, queueTime });

      return task;
    }

    return undefined;
  }

  removeLowest(): QueuedTask | undefined {
    if (this._size === 0) return undefined;

    // Get lowest priority (last in sorted array)
    const lowestPriority = this.prioritiesDesc[this.prioritiesDesc.length - 1];
    const bucket = this.buckets.get(lowestPriority);

    if (!bucket || bucket.length === 0) return undefined;

    // Remove last task in bucket (oldest with lowest priority)
    const task = bucket.pop();
    if (!task) return undefined;

    this._size--;

    // Clean up empty bucket
    if (bucket.length === 0) {
      this.buckets.delete(lowestPriority);
      this.rrIndex.delete(lowestPriority);
      this.updatePriorities();
    }

    // Clean up tracking
    this.taskMap.delete(task.id);

    return task;
  }

  clear(): { cancelled: number; errors: Error[] } {
    const errors: Error[] = [];
    let cancelled = 0;

    // Collect all tasks
    const allTasks: QueuedTask[] = [];
    for (const bucket of this.buckets.values()) {
      allTasks.push(...bucket);
    }

    // Cancel each task
    for (const task of allTasks) {
      if (!task.settled) {
        task.settled = true;
        cancelled++;

        try {
          task.reject(new Error("Queue cleared"));
        } catch (error) {
          errors.push(error as Error);
        }

        try {
          task.abortController?.abort();
        } catch (error) {
          errors.push(error as Error);
        }
      }
    }

    // Clear all data structures
    this.buckets.clear();
    this.rrIndex.clear();
    this.prioritiesDesc = [];
    this.taskMap.clear();
    this._size = 0;
    this.cancelledCount += cancelled;

    // Emit event
    this.emit("clear", { cancelledCount: cancelled });

    return { cancelled, errors };
  }

  timeInQueue(taskId: string): number | undefined {
    const entry = this.taskMap.get(taskId);
    if (!entry) return undefined;
    return Date.now() - entry.enqueuedAt;
  }

  getQueueMetrics(): QueueMetrics {
    const now = Date.now();

    // Calculate throughput
    const timeDiff = (now - this.lastThroughputTime) / 1000; // seconds
    const countDiff = this.dequeuedCount - this.lastThroughputCount;
    const throughput = timeDiff > 0 ? countDiff / timeDiff : 0;

    // Find oldest task
    let oldestTaskAge = 0;
    for (const entry of this.taskMap.values()) {
      const age = now - entry.enqueuedAt;
      if (age > oldestTaskAge) {
        oldestTaskAge = age;
      }
    }

    return {
      size: this._size,
      capacity: this.maxSize,
      utilization: this._size / this.maxSize,
      enqueuedCount: this.enqueuedCount,
      dequeuedCount: this.dequeuedCount,
      evictedCount: this.evictedCount,
      cancelledCount: this.cancelledCount,
      avgQueueTimeMs: safeAverage(this.queueTimes),
      p50QueueTimeMs: safePercentile(this.queueTimes, 50),
      p95QueueTimeMs: safePercentile(this.queueTimes, 95),
      p99QueueTimeMs: safePercentile(this.queueTimes, 99),
      oldestTaskAgeMs: oldestTaskAge,
      throughput,
    };
  }

  /**
   * Get detailed queue state for debugging
   */
  getDetailedState(): {
    priorityBuckets: Array<{
      priority: number;
      count: number;
      rrIndex: number;
    }>;
    taskList: Array<{ id: string; priority: number; ageMs: number }>;
  } {
    const now = Date.now();

    const priorityBuckets = this.prioritiesDesc.map((priority) => ({
      priority,
      count: this.buckets.get(priority)?.length ?? 0,
      rrIndex: this.rrIndex.get(priority) ?? 0,
    }));

    const taskList = Array.from(this.taskMap.entries()).map(([id, entry]) => ({
      id,
      priority: entry.task.priority,
      ageMs: now - entry.enqueuedAt,
    }));

    return { priorityBuckets, taskList };
  }

  private updatePriorities(): void {
    this.prioritiesDesc = Array.from(this.buckets.keys()).sort((a, b) => b - a);
  }

  private recordQueueTime(timeMs: number): void {
    this.queueTimes.push(timeMs);

    // Keep only recent samples
    if (this.queueTimes.length > this.maxQueueTimeSamples) {
      this.queueTimes = this.queueTimes.slice(-this.maxQueueTimeSamples);
    }
  }

  private startMetricsCollection(): void {
    if (this.options.metricsInterval) {
      const interval = setInterval(() => {
        const metrics = this.getQueueMetrics();
        this.emit("metrics", { metrics });

        // Update throughput baseline
        this.lastThroughputTime = Date.now();
        this.lastThroughputCount = this.dequeuedCount;
      }, this.options.metricsInterval);

      // Don't keep process alive
      if (typeof interval.unref === "function") {
        interval.unref();
      }
    }
  }

  // Override EventEmitter methods for type safety
  on<K extends keyof QueueEvents>(
    event: K,
    listener: (data: QueueEvents[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof QueueEvents>(
    event: K,
    listener: (data: QueueEvents[K]) => void,
  ): this {
    return super.off(event, listener);
  }

  emit<K extends keyof QueueEvents>(event: K, data: QueueEvents[K]): boolean {
    return super.emit(event, data);
  }
}
