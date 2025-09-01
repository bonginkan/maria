/**
 * Model Selector v2 - Telemetry Collector
 * Comprehensive metrics collection and analysis system
 */

import { EventEmitter } from "node:events";
import type {
  ModelInfo,
  ModelSelectorEvent,
  AuditEvent,
  AvailabilityStatus,
} from "../types/index";

export interface TelemetryMetrics {
  // Performance Metrics
  performance: {
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    responseTimes: number[];
    slowOperations: number;
  };

  // Usage Metrics
  usage: {
    totalOperations: number;
    operationsByType: Record<string, number>;
    uniqueUsers: number;
    activeSessions: number;
    modelSelections: number;
    recommendations: number;
    searches: number;
  };

  // Model Metrics
  models: {
    totalModels: number;
    availableModels: number;
    modelUsage: Record<string, number>;
    providerUsage: Record<string, number>;
    averageLatency: Record<string, number>;
    successRates: Record<string, number>;
  };

  // Error Metrics
  errors: {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorRate: number;
    recentErrors: Array<{
      timestamp: Date;
      type: string;
      message: string;
      operation?: string;
    }>;
  };

  // System Metrics
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cacheStats: {
      hitRate: number;
      totalRequests: number;
      cacheSize: number;
    };
  };
}

export interface TelemetryEvent {
  type: "performance" | "usage" | "error" | "system";
  timestamp: Date;
  data: any;
  sessionId?: string;
  userId?: string;
  operationId?: string;
}

export interface TelemetryConfig {
  enabled: boolean;
  flushInterval: number; // milliseconds
  retentionDays: number;
  maxEvents: number;
  enableDetailedLogging: boolean;
  exportFormats: ("json" | "csv" | "prometheus")[];
  storage: {
    type: "memory" | "file" | "database";
    path?: string;
    connectionString?: string;
  };
}

export class TelemetryCollector extends EventEmitter {
  private config: TelemetryConfig;
  private metrics: TelemetryMetrics;
  private events: TelemetryEvent[] = [];
  private startTime: Date;
  private flushTimer?: NodeJS.Timeout;

  // Cache tracking
  private cacheRequests = 0;
  private cacheHits = 0;

  // Performance tracking
  private operationTimers: Map<string, number> = new Map();

  constructor(config: Partial<TelemetryConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      flushInterval: 60000, // 1 minute
      retentionDays: 7,
      maxEvents: 10000,
      enableDetailedLogging: false,
      exportFormats: ["json"],
      storage: {
        type: "memory",
      },
      ...config,
    };

    this.startTime = new Date();
    this.metrics = this.initializeMetrics();

    if (this.config.enabled) {
      this.startCollection();
    }
  }

  /**
   * Record a model selector operation
   */
  recordOperation(event: ModelSelectorEvent): void {
    if (!this.config.enabled) return;

    try {
      // Update usage metrics
      this.metrics.usage.totalOperations++;
      this.metrics.usage.operationsByType[event.type] =
        (this.metrics.usage.operationsByType[event.type] || 0) + 1;

      // Update performance metrics
      if (event.duration) {
        this.updatePerformanceMetrics(event.duration);

        // Check for slow operations (>1000ms)
        if (event.duration > 1000) {
          this.metrics.performance.slowOperations++;

          this.recordEvent({
            type: "performance",
            timestamp: event.timestamp,
            data: {
              operation: event.type,
              duration: event.duration,
              warning: "Slow operation detected",
            },
          });
        }
      }

      // Update error metrics if operation failed
      if (!event.success && event.error) {
        this.recordError(event.type, event.error, event.timestamp);
      }

      // Record specific operation types
      switch (event.type) {
        case "select":
          this.recordModelSelection(event);
          break;
        case "recommend":
          this.metrics.usage.recommendations++;
          break;
        case "list":
          this.recordSearch(event);
          break;
      }

      // Record telemetry event
      this.recordEvent({
        type: "usage",
        timestamp: event.timestamp,
        data: event,
      });
    } catch (error) {
      this.emit("telemetry_error", {
        operation: "record_operation",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Record model usage statistics
   */
  recordModelUsage(
    modelId: string,
    success: boolean,
    latency?: number,
    provider?: string,
  ): void {
    if (!this.config.enabled) return;

    try {
      // Update model usage count
      this.metrics.models.modelUsage[modelId] =
        (this.metrics.models.modelUsage[modelId] || 0) + 1;

      // Update provider usage
      if (provider) {
        this.metrics.models.providerUsage[provider] =
          (this.metrics.models.providerUsage[provider] || 0) + 1;
      }

      // Update latency tracking
      if (latency) {
        const currentAvg = this.metrics.models.averageLatency[modelId] || 0;
        const currentCount = this.metrics.models.modelUsage[modelId];

        this.metrics.models.averageLatency[modelId] =
          (currentAvg * (currentCount - 1) + latency) / currentCount;
      }

      // Update success rate
      const currentSuccesses = this.metrics.models.successRates[modelId] || 0;
      const totalUses = this.metrics.models.modelUsage[modelId];

      if (success) {
        this.metrics.models.successRates[modelId] =
          (currentSuccesses * (totalUses - 1) + 1) / totalUses;
      } else {
        this.metrics.models.successRates[modelId] =
          (currentSuccesses * (totalUses - 1)) / totalUses;
      }

      this.recordEvent({
        type: "usage",
        timestamp: new Date(),
        data: {
          modelId,
          success,
          latency,
          provider,
        },
      });
    } catch (error) {
      this.emit("telemetry_error", {
        operation: "record_model_usage",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Record user session activity
   */
  recordSessionActivity(
    sessionId: string,
    userId: string,
    action: string,
    data?: any,
  ): void {
    if (!this.config.enabled) return;

    try {
      this.recordEvent({
        type: "usage",
        timestamp: new Date(),
        sessionId,
        userId,
        data: {
          action,
          ...data,
        },
      });
    } catch (error) {
      this.emit("telemetry_error", {
        operation: "record_session_activity",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Record cache performance
   */
  recordCacheHit(hit: boolean): void {
    this.cacheRequests++;
    if (hit) {
      this.cacheHits++;
    }

    this.updateCacheStats();
  }

  /**
   * Record audit events
   */
  recordAudit(event: AuditEvent): void {
    if (!this.config.enabled) return;

    this.recordEvent({
      type: "system",
      timestamp: event.timestamp,
      userId: event.userId,
      data: {
        event: event.event,
        modelId: event.modelId,
        provider: event.provider,
        metadata: event.metadata,
      },
    });
  }

  /**
   * Start operation timing
   */
  startTimer(operationId: string): void {
    this.operationTimers.set(operationId, performance.now());
  }

  /**
   * End operation timing and record
   */
  endTimer(
    operationId: string,
    operation: string,
    success: boolean = true,
  ): number | undefined {
    const startTime = this.operationTimers.get(operationId);
    if (!startTime) return undefined;

    const duration = performance.now() - startTime;
    this.operationTimers.delete(operationId);

    // Record the timing
    this.recordOperation({
      type: operation as any,
      timestamp: new Date(),
      duration,
      success,
    });

    return duration;
  }

  /**
   * Get current metrics
   */
  getMetrics(): TelemetryMetrics {
    // Update system metrics
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  /**
   * Get metrics for a specific time range
   */
  getMetricsRange(startDate: Date, endDate: Date): TelemetryEvent[] {
    return this.events.filter(
      (event) => event.timestamp >= startDate && event.timestamp <= endDate,
    );
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    avgResponseTime: number;
    slowOperations: number;
    errorRate: number;
    cacheHitRate: number;
    topModels: Array<{ modelId: string; usage: number; avgLatency: number }>;
  } {
    // Get top 5 models by usage
    const topModels = Object.entries(this.metrics.models.modelUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([modelId, usage]) => ({
        modelId,
        usage,
        avgLatency: this.metrics.models.averageLatency[modelId] || 0,
      }));

    return {
      avgResponseTime: this.metrics.performance.averageResponseTime,
      slowOperations: this.metrics.performance.slowOperations,
      errorRate: this.metrics.errors.errorRate,
      cacheHitRate: this.metrics.system.cacheStats.hitRate,
      topModels,
    };
  }

  /**
   * Export metrics in specified format
   */
  async exportMetrics(
    format: "json" | "csv" | "prometheus" = "json",
  ): Promise<string> {
    const metrics = this.getMetrics();

    switch (format) {
      case "json":
        return JSON.stringify(metrics, null, 2);

      case "csv":
        return this.convertToCSV(metrics);

      case "prometheus":
        return this.convertToPrometheus(metrics);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Clear metrics data
   */
  clearMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.events = [];
    this.cacheRequests = 0;
    this.cacheHits = 0;

    this.emit("metrics_cleared", {
      timestamp: new Date(),
    });
  }

  /**
   * Flush metrics to storage
   */
  async flush(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      switch (this.config.storage.type) {
        case "file":
          await this.flushToFile();
          break;

        case "database":
          await this.flushToDatabase();
          break;

        case "memory":
        default:
          // Keep in memory, just emit event
          this.emit("metrics_flushed", {
            eventCount: this.events.length,
            timestamp: new Date(),
          });
          break;
      }

      // Clean old events
      this.cleanOldEvents();
    } catch (error) {
      this.emit("flush_error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Stop telemetry collection
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Final flush
    this.flush();

    this.emit("telemetry_stopped", {
      totalEvents: this.events.length,
      uptime: Date.now() - this.startTime.getTime(),
    });
  }

  // Private methods

  private initializeMetrics(): TelemetryMetrics {
    return {
      performance: {
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        responseTimes: [],
        slowOperations: 0,
      },
      usage: {
        totalOperations: 0,
        operationsByType: {},
        uniqueUsers: 0,
        activeSessions: 0,
        modelSelections: 0,
        recommendations: 0,
        searches: 0,
      },
      models: {
        totalModels: 0,
        availableModels: 0,
        modelUsage: {},
        providerUsage: {},
        averageLatency: {},
        successRates: {},
      },
      errors: {
        totalErrors: 0,
        errorsByType: {},
        errorRate: 0,
        recentErrors: [],
      },
      system: {
        uptime: 0,
        memoryUsage: process.memoryUsage(),
        cacheStats: {
          hitRate: 0,
          totalRequests: 0,
          cacheSize: 0,
        },
      },
    };
  }

  private startCollection(): void {
    // Start flush timer
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    // Track unique users and sessions
    this.on("telemetry_event", (event: TelemetryEvent) => {
      if (event.userId && event.sessionId) {
        // Could track unique users/sessions here
      }
    });

    this.emit("telemetry_started", {
      config: this.config,
      startTime: this.startTime,
    });
  }

  private recordEvent(event: TelemetryEvent): void {
    // Add to events array
    this.events.push(event);

    // Limit event count
    if (this.events.length > this.config.maxEvents) {
      this.events.shift();
    }

    this.emit("telemetry_event", event);
  }

  private recordModelSelection(event: ModelSelectorEvent): void {
    this.metrics.usage.modelSelections++;

    if (event.modelId) {
      this.metrics.models.modelUsage[event.modelId] =
        (this.metrics.models.modelUsage[event.modelId] || 0) + 1;
    }
  }

  private recordSearch(event: ModelSelectorEvent): void {
    this.metrics.usage.searches++;
  }

  private recordError(operation: string, error: string, timestamp: Date): void {
    this.metrics.errors.totalErrors++;
    this.metrics.errors.errorsByType[operation] =
      (this.metrics.errors.errorsByType[operation] || 0) + 1;

    // Update error rate
    this.metrics.errors.errorRate =
      this.metrics.errors.totalErrors / this.metrics.usage.totalOperations;

    // Add to recent errors
    this.metrics.errors.recentErrors.unshift({
      timestamp,
      type: operation,
      message: error,
      operation,
    });

    // Keep only last 50 errors
    if (this.metrics.errors.recentErrors.length > 50) {
      this.metrics.errors.recentErrors = this.metrics.errors.recentErrors.slice(
        0,
        50,
      );
    }
  }

  private updatePerformanceMetrics(duration: number): void {
    this.metrics.performance.responseTimes.push(duration);

    // Keep only last 1000 response times
    if (this.metrics.performance.responseTimes.length > 1000) {
      this.metrics.performance.responseTimes.shift();
    }

    const times = [...this.metrics.performance.responseTimes].sort(
      (a, b) => a - b,
    );
    const length = times.length;

    // Calculate percentiles
    this.metrics.performance.averageResponseTime =
      times.reduce((a, b) => a + b, 0) / length;

    this.metrics.performance.p50ResponseTime = times[Math.floor(length * 0.5)];
    this.metrics.performance.p95ResponseTime = times[Math.floor(length * 0.95)];
    this.metrics.performance.p99ResponseTime = times[Math.floor(length * 0.99)];
  }

  private updateSystemMetrics(): void {
    this.metrics.system.uptime = Date.now() - this.startTime.getTime();
    this.metrics.system.memoryUsage = process.memoryUsage();
    this.updateCacheStats();
  }

  private updateCacheStats(): void {
    this.metrics.system.cacheStats.totalRequests = this.cacheRequests;
    this.metrics.system.cacheStats.hitRate =
      this.cacheRequests > 0 ? this.cacheHits / this.cacheRequests : 0;
  }

  private cleanOldEvents(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    this.events = this.events.filter((event) => event.timestamp >= cutoffDate);
  }

  private async flushToFile(): Promise<void> {
    if (!this.config.storage.path) {
      throw new Error("File path not configured for storage");
    }

    const fs = await import("fs").then((m) => m.promises);
    const path = await import("path");

    const filePath = path.resolve(this.config.storage.path);
    const data = JSON.stringify(
      {
        metrics: this.metrics,
        events: this.events,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );

    await fs.writeFile(filePath, data, "utf8");
  }

  private async flushToDatabase(): Promise<void> {
    // TODO: Implement database storage
    throw new Error("Database storage not yet implemented");
  }

  private convertToCSV(metrics: TelemetryMetrics): string {
    let csv = "metric,value,timestamp\n";
    csv += `average_response_time,${metrics.performance.averageResponseTime},${new Date().toISOString()}\n`;
    csv += `total_operations,${metrics.usage.totalOperations},${new Date().toISOString()}\n`;
    csv += `error_rate,${metrics.errors.errorRate},${new Date().toISOString()}\n`;
    csv += `cache_hit_rate,${metrics.system.cacheStats.hitRate},${new Date().toISOString()}\n`;

    return csv;
  }

  private convertToPrometheus(metrics: TelemetryMetrics): string {
    let prometheus =
      "# HELP model_selector_response_time_seconds Response time in seconds\n";
    prometheus += "# TYPE model_selector_response_time_seconds gauge\n";
    prometheus += `model_selector_response_time_seconds ${metrics.performance.averageResponseTime / 1000}\n\n`;

    prometheus +=
      "# HELP model_selector_operations_total Total number of operations\n";
    prometheus += "# TYPE model_selector_operations_total counter\n";
    prometheus += `model_selector_operations_total ${metrics.usage.totalOperations}\n\n`;

    prometheus += "# HELP model_selector_errors_total Total number of errors\n";
    prometheus += "# TYPE model_selector_errors_total counter\n";
    prometheus += `model_selector_errors_total ${metrics.errors.totalErrors}\n\n`;

    return prometheus;
  }
}

export default TelemetryCollector;
