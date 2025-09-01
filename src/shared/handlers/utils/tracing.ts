/**
 * Tracing and Observability Utils
 * Provides command execution tracing and metrics
 */

import type {
  TraceSpan,
  TraceContext,
  CommandContext,
  CommandResult,
} from "../../types/enhanced-context";

/**
 * Simple UUID generator for trace/span IDs
 */
function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

/**
 * Global trace store (simple in-memory implementation)
 */
class TraceStore {
  private traces = new Map<string, TraceContext>();
  private maxTraces = 1000;

  store(trace: TraceContext): void {
    this.traces.set(trace.traceId, trace);

    // Cleanup old traces
    if (this.traces.size > this.maxTraces) {
      const oldestKey = this.traces.keys().next().value;
      this.traces.delete(oldestKey);
    }
  }

  get(traceId: string): TraceContext | undefined {
    return this.traces.get(traceId);
  }

  getAll(): TraceContext[] {
    return Array.from(this.traces.values());
  }

  clear(): void {
    this.traces.clear();
  }
}

const traceStore = new TraceStore();

/**
 * Tracer for command execution
 */
export class CommandTracer {
  private context: TraceContext;
  private currentSpan: TraceSpan | null = null;

  constructor(commandContext: CommandContext) {
    this.context = {
      traceId: commandContext.traceId || generateId(),
      spans: [],
      startTime: Date.now(),
      userId: commandContext.options.userId,
      command: commandContext.command,
    };
  }

  /**
   * Start a new span
   */
  startSpan(operation: string, metadata?: Record<string, any>): TraceSpan {
    const span: TraceSpan = {
      traceId: this.context.traceId,
      spanId: generateId(),
      parentSpanId: this.currentSpan?.spanId,
      operation,
      startTime: Date.now(),
      status: "pending",
      metadata,
    };

    this.context.spans.push(span);
    this.currentSpan = span;

    return span;
  }

  /**
   * End the current span
   */
  endSpan(
    status: "success" | "error" = "success",
    error?: string,
    metadata?: Record<string, any>,
  ): void {
    if (!this.currentSpan) return;

    const now = Date.now();
    this.currentSpan.endTime = now;
    this.currentSpan.duration = now - this.currentSpan.startTime;
    this.currentSpan.status = status;

    if (error) {
      this.currentSpan.error = error;
    }

    if (metadata) {
      this.currentSpan.metadata = { ...this.currentSpan.metadata, ...metadata };
    }

    // Find parent span
    this.currentSpan =
      this.context.spans.find(
        (s) => s.spanId === this.currentSpan?.parentSpanId,
      ) || null;
  }

  /**
   * Add metadata to current span
   */
  addMetadata(metadata: Record<string, any>): void {
    if (this.currentSpan) {
      this.currentSpan.metadata = { ...this.currentSpan.metadata, ...metadata };
    }
  }

  /**
   * Complete the trace
   */
  complete(result: CommandResult): TraceContext {
    const now = Date.now();
    this.context.endTime = now;

    // Add final metadata
    this.addMetadata({
      success: result.success,
      error: result.error,
      messageCount: result.messages?.length || 0,
      duration: now - this.context.startTime,
    });

    // End any open spans
    while (this.currentSpan) {
      this.endSpan(result.success ? "success" : "error", result.error);
    }

    // Store trace
    traceStore.store(this.context);

    return this.context;
  }

  /**
   * Get trace ID
   */
  getTraceId(): string {
    return this.context.traceId;
  }

  /**
   * Get current span
   */
  getCurrentSpan(): TraceSpan | null {
    return this.currentSpan;
  }

  /**
   * Get trace context
   */
  getContext(): TraceContext {
    return this.context;
  }
}

/**
 * Tracer-aware wrapper for async operations
 */
export async function traced<T>(
  tracer: CommandTracer,
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>,
): Promise<T> {
  const span = tracer.startSpan(operation, metadata);

  try {
    const result = await fn();
    tracer.endSpan("success");
    return result;
  } catch (error) {
    tracer.endSpan(
      "error",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

/**
 * Metrics collector
 */
export class MetricsCollector {
  private metrics = {
    commandsExecuted: 0,
    totalDuration: 0,
    errors: 0,
    timeouts: 0,
    providerCalls: 0,
    memoryOperations: 0,
    uiUpdates: 0,
  };

  recordCommand(trace: TraceContext): void {
    this.metrics.commandsExecuted++;
    this.metrics.totalDuration +=
      (trace.endTime || Date.now()) - trace.startTime;

    // Analyze spans for detailed metrics
    for (const span of trace.spans) {
      if (span.status === "error") {
        this.metrics.errors++;

        if (span.error?.toLowerCase().includes("timeout")) {
          this.metrics.timeouts++;
        }
      }

      // Count operation types
      if (span.operation.includes("provider")) {
        this.metrics.providerCalls++;
      } else if (span.operation.includes("memory")) {
        this.metrics.memoryOperations++;
      } else if (span.operation.includes("ui")) {
        this.metrics.uiUpdates++;
      }
    }
  }

  getMetrics(): typeof this.metrics & {
    averageDuration: number;
    errorRate: number;
  } {
    return {
      ...this.metrics,
      averageDuration:
        this.metrics.commandsExecuted > 0
          ? this.metrics.totalDuration / this.metrics.commandsExecuted
          : 0,
      errorRate:
        this.metrics.commandsExecuted > 0
          ? this.metrics.errors / this.metrics.commandsExecuted
          : 0,
    };
  }

  reset(): void {
    this.metrics = {
      commandsExecuted: 0,
      totalDuration: 0,
      errors: 0,
      timeouts: 0,
      providerCalls: 0,
      memoryOperations: 0,
      uiUpdates: 0,
    };
  }
}

/**
 * Global metrics collector instance
 */
export const globalMetrics = new MetricsCollector();

/**
 * Trace utilities
 */
export const TraceUtils = {
  /**
   * Get all traces
   */
  getAllTraces(): TraceContext[] {
    return traceStore.getAll();
  },

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): TraceContext | undefined {
    return traceStore.get(traceId);
  },

  /**
   * Clear all traces
   */
  clearTraces(): void {
    traceStore.clear();
  },

  /**
   * Get traces by command
   */
  getTracesByCommand(command: string): TraceContext[] {
    return traceStore.getAll().filter((t) => t.command === command);
  },

  /**
   * Get traces by user
   */
  getTracesByUser(userId: string): TraceContext[] {
    return traceStore.getAll().filter((t) => t.userId === userId);
  },

  /**
   * Get recent traces
   */
  getRecentTraces(minutes = 60): TraceContext[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return traceStore.getAll().filter((t) => t.startTime >= cutoff);
  },

  /**
   * Generate trace report
   */
  generateReport(traces?: TraceContext[]): {
    totalTraces: number;
    successRate: number;
    averageDuration: number;
    slowestCommand: string | null;
    mostErrors: string | null;
    timeRange: { start: number; end: number } | null;
  } {
    const targetTraces = traces || traceStore.getAll();

    if (targetTraces.length === 0) {
      return {
        totalTraces: 0,
        successRate: 0,
        averageDuration: 0,
        slowestCommand: null,
        mostErrors: null,
        timeRange: null,
      };
    }

    const successful = targetTraces.filter(
      (t) => !t.spans.some((s) => s.status === "error"),
    ).length;

    const durations = targetTraces.map(
      (t) => (t.endTime || Date.now()) - t.startTime,
    );

    const averageDuration =
      durations.reduce((a, b) => a + b, 0) / durations.length;

    // Find slowest command
    const slowestTrace = targetTraces.reduce((slowest, current) => {
      const currentDuration =
        (current.endTime || Date.now()) - current.startTime;
      const slowestDuration =
        (slowest.endTime || Date.now()) - slowest.startTime;
      return currentDuration > slowestDuration ? current : slowest;
    });

    // Count errors by command
    const errorCounts = new Map<string, number>();
    for (const trace of targetTraces) {
      if (trace.spans.some((s) => s.status === "error")) {
        errorCounts.set(
          trace.command || "unknown",
          (errorCounts.get(trace.command || "unknown") || 0) + 1,
        );
      }
    }

    const mostErrors =
      errorCounts.size > 0
        ? Array.from(errorCounts.entries()).reduce((a, b) =>
            a[1] > b[1] ? a : b,
          )[0]
        : null;

    const times = targetTraces.map((t) => t.startTime).sort((a, b) => a - b);

    return {
      totalTraces: targetTraces.length,
      successRate: successful / targetTraces.length,
      averageDuration,
      slowestCommand: slowestTrace.command || null,
      mostErrors,
      timeRange:
        times.length > 0
          ? { start: times[0], end: times[times.length - 1] }
          : null,
    };
  },
};
