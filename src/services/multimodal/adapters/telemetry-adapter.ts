import { EventEmitter } from "node:events";
import {
  SystemHealth,
  MonitoringAlert,
} from "../strategies/monitoring-strategy";
import { ConfidenceScore } from "../strategies/confidence-strategy";
import { StorageMetrics } from "../strategies/storage-strategy";

export interface TelemetryData {
  timestamp: Date;
  source: string;
  type: "metric" | "event" | "trace" | "log";
  data: unknown;
  tags: Record<string, string>;
}

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
}

export interface TelemetryEvent {
  name: string;
  properties: Record<string, unknown>;
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error";
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  tags: Record<string, string>;
  logs: Array<{
    timestamp: Date;
    fields: Record<string, unknown>;
  }>;
}

export interface TelemetryExport {
  format: "json" | "prometheus" | "opentelemetry" | "custom";
  destination: string; // URL or file path
  interval: number; // ms
  batchSize: number;
  compression: boolean;
}

export interface TelemetryAdapterOptions {
  bufferSize: number;
  flushInterval: number; // ms
  exports: TelemetryExport[];
  enableCompression: boolean;
  enableSampling: boolean;
  samplingRate: number; // 0-1
}

export class TelemetryAdapter extends EventEmitter {
  private readonly _options: TelemetryAdapterOptions;
  private readonly _buffer: TelemetryData[] = [];
  private readonly _metrics = new Map<string, MetricPoint[]>();
  private readonly _events: TelemetryEvent[] = [];
  private readonly _traces = new Map<string, TraceSpan[]>();
  private _flushTimer?: NodeJS.Timeout;
  private _isStarted = false;

  constructor(options: Partial<TelemetryAdapterOptions> = {}) {
    super();

    this._options = {
      bufferSize: 10000,
      flushInterval: 30000, // 30 seconds
      exports: [],
      enableCompression: true,
      enableSampling: false,
      samplingRate: 0.1,
      ...options,
    };
  }

  start(): void {
    if (this._isStarted) return;

    this._isStarted = true;
    this._startFlushTimer();
    this.emit("telemetry_started");
  }

  stop(): void {
    if (!this._isStarted) return;

    this._isStarted = false;
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = undefined;
    }

    // Final flush
    this._flush().catch((error) => this.emit("flush_error", error));
    this.emit("telemetry_stopped");
  }

  // Health metrics ingestion
  ingestHealthMetrics(health: SystemHealth): void {
    const timestamp = health.timestamp;
    const tags = { source: "monitoring", type: "health" };

    // Overall health score
    this._recordMetric(
      "system.health.overall",
      this._healthToScore(health.overall),
      timestamp,
      tags,
    );

    // Component metrics
    for (const [component, componentHealth] of Object.entries(
      health.components,
    )) {
      const componentTags = { ...tags, component };

      this._recordMetric(
        `system.health.${component}.status`,
        this._healthToScore(componentHealth.status),
        timestamp,
        componentTags,
      );
      this._recordMetric(
        `system.health.${component}.availability`,
        componentHealth.metrics.availability,
        timestamp,
        componentTags,
      );
      this._recordMetric(
        `system.health.${component}.response_time`,
        componentHealth.metrics.responseTime,
        timestamp,
        componentTags,
      );
      this._recordMetric(
        `system.health.${component}.error_rate`,
        componentHealth.metrics.errorRate,
        timestamp,
        componentTags,
      );
      this._recordMetric(
        `system.health.${component}.throughput`,
        componentHealth.metrics.throughput,
        timestamp,
        componentTags,
      );
    }

    // Add to buffer
    this._addToBuffer({
      timestamp,
      source: "monitoring",
      type: "metric",
      data: health,
      tags,
    });
  }

  // Alert ingestion
  ingestAlert(alert: MonitoringAlert): void {
    const event: TelemetryEvent = {
      name: "system.alert",
      properties: {
        alertId: alert.id,
        level: alert.level,
        component: alert.component,
        message: alert.message,
        details: alert.details,
        resolved: alert.resolved,
      },
      timestamp: alert.timestamp,
      level: alert.level === "critical" ? "error" : "warn",
    };

    this._recordEvent(event);

    // Also record as metric
    this._recordMetric("system.alerts.count", 1, alert.timestamp, {
      level: alert.level,
      component: alert.component,
      source: "monitoring",
    });

    this._addToBuffer({
      timestamp: alert.timestamp,
      source: "monitoring",
      type: "event",
      data: alert,
      tags: { level: alert.level, component: alert.component },
    });
  }

  // Confidence metrics ingestion
  ingestConfidenceMetrics(
    context: { operation: string; provider: string },
    score: ConfidenceScore,
  ): void {
    const timestamp = new Date();
    const tags = {
      source: "confidence",
      operation: context.operation,
      provider: context.provider,
    };

    this._recordMetric("ai.confidence.score", score.value, timestamp, tags);
    this._recordMetric(
      "ai.confidence.historical_factor",
      score.factors.historical,
      timestamp,
      tags,
    );
    this._recordMetric(
      "ai.confidence.contextual_factor",
      score.factors.contextual,
      timestamp,
      tags,
    );
    this._recordMetric(
      "ai.confidence.technical_factor",
      score.factors.technical,
      timestamp,
      tags,
    );
    this._recordMetric(
      "ai.confidence.temporal_factor",
      score.factors.temporal,
      timestamp,
      tags,
    );
    this._recordMetric(
      "ai.confidence.sample_size",
      score.metadata.sampleSize,
      timestamp,
      tags,
    );
    this._recordMetric(
      "ai.confidence.variance",
      score.metadata.variance,
      timestamp,
      tags,
    );

    this._addToBuffer({
      timestamp,
      source: "confidence",
      type: "metric",
      data: { context, score },
      tags,
    });
  }

  // Storage metrics ingestion
  ingestStorageMetrics(metrics: StorageMetrics): void {
    const timestamp = new Date();
    const tags = { source: "storage" };

    this._recordMetric(
      "storage.total_records",
      metrics.totalRecords,
      timestamp,
      tags,
    );
    this._recordMetric(
      "storage.size_bytes",
      metrics.storageSize,
      timestamp,
      tags,
    );
    this._recordMetric(
      "storage.avg_execution_time",
      metrics.avgExecutionTime,
      timestamp,
      tags,
    );
    this._recordMetric(
      "storage.success_rate",
      metrics.successRate,
      timestamp,
      tags,
    );

    // Top operations
    metrics.topOperations.forEach((op, index) => {
      this._recordMetric("storage.operation_count", op.count, timestamp, {
        ...tags,
        operation: op.operation,
        rank: (index + 1).toString(),
      });
    });

    // Top providers
    metrics.topProviders.forEach((provider, index) => {
      this._recordMetric("storage.provider_count", provider.count, timestamp, {
        ...tags,
        provider: provider.provider,
        rank: (index + 1).toString(),
      });
    });

    this._addToBuffer({
      timestamp,
      source: "storage",
      type: "metric",
      data: metrics,
      tags,
    });
  }

  // Queue metrics ingestion
  ingestQueueMetrics(metrics: {
    totalEnqueued: number;
    totalDequeued: number;
    currentSize: number;
    avgWaitTime: number;
    p50WaitTime: number;
    p95WaitTime: number;
    p99WaitTime: number;
  }): void {
    const timestamp = new Date();
    const tags = { source: "queue" };

    this._recordMetric(
      "queue.total_enqueued",
      metrics.totalEnqueued,
      timestamp,
      tags,
    );
    this._recordMetric(
      "queue.total_dequeued",
      metrics.totalDequeued,
      timestamp,
      tags,
    );
    this._recordMetric(
      "queue.current_size",
      metrics.currentSize,
      timestamp,
      tags,
    );
    this._recordMetric(
      "queue.avg_wait_time",
      metrics.avgWaitTime,
      timestamp,
      tags,
    );
    this._recordMetric(
      "queue.p50_wait_time",
      metrics.p50WaitTime,
      timestamp,
      tags,
    );
    this._recordMetric(
      "queue.p95_wait_time",
      metrics.p95WaitTime,
      timestamp,
      tags,
    );
    this._recordMetric(
      "queue.p99_wait_time",
      metrics.p99WaitTime,
      timestamp,
      tags,
    );

    this._addToBuffer({
      timestamp,
      source: "queue",
      type: "metric",
      data: metrics,
      tags,
    });
  }

  // Custom metrics
  recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {},
  ): void {
    this._recordMetric(name, value, new Date(), { ...tags, source: "custom" });
  }

  recordEvent(
    name: string,
    properties: Record<string, unknown> = {},
    level: TelemetryEvent["level"] = "info",
  ): void {
    const event: TelemetryEvent = {
      name,
      properties,
      timestamp: new Date(),
      level,
    };

    this._recordEvent(event);
  }

  startTrace(operationName: string, parentSpanId?: string): TraceSpan {
    const traceId = this._generateId();
    const spanId = this._generateId();

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: new Date(),
      tags: {},
      logs: [],
    };

    const traces = this._traces.get(traceId) || [];
    traces.push(span);
    this._traces.set(traceId, traces);

    return span;
  }

  finishTrace(span: TraceSpan): void {
    span.endTime = new Date();

    const duration = span.endTime.getTime() - span.startTime.getTime();
    this._recordMetric("trace.duration", duration, span.endTime, {
      operation: span.operationName,
      trace_id: span.traceId,
      span_id: span.spanId,
      source: "tracing",
    });

    this._addToBuffer({
      timestamp: span.endTime,
      source: "tracing",
      type: "trace",
      data: span,
      tags: { operation: span.operationName },
    });
  }

  // Export data in various formats
  async exportData(
    format: TelemetryExport["format"],
    timeRange?: { start: Date; end: Date },
  ): Promise<string> {
    let data: TelemetryData[];

    if (timeRange) {
      data = this._buffer.filter(
        (item) =>
          item.timestamp >= timeRange.start && item.timestamp <= timeRange.end,
      );
    } else {
      data = [...this._buffer];
    }

    switch (format) {
      case "json":
        return this._exportAsJson(data);
      case "prometheus":
        return this._exportAsPrometheus(data);
      case "opentelemetry":
        return this._exportAsOpenTelemetry(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  // Get aggregated metrics
  getMetrics(
    namePattern?: string,
    tags?: Record<string, string>,
  ): MetricPoint[] {
    const allMetrics: MetricPoint[] = [];

    for (const [name, points] of this._metrics.entries()) {
      if (namePattern && !name.includes(namePattern)) continue;

      const filteredPoints = points.filter((point) => {
        if (!tags) return true;
        return Object.entries(tags).every(
          ([key, value]) => point.tags[key] === value,
        );
      });

      allMetrics.push(...filteredPoints);
    }

    return allMetrics.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  getTelemetryStats(): {
    bufferSize: number;
    totalMetrics: number;
    totalEvents: number;
    totalTraces: number;
    memoryUsage: number; // bytes
  } {
    let totalMetrics = 0;
    for (const points of this._metrics.values()) {
      totalMetrics += points.length;
    }

    const memoryUsage = JSON.stringify({
      buffer: this._buffer,
      metrics: Array.from(this._metrics.entries()),
      events: this._events,
      traces: Array.from(this._traces.entries()),
    }).length;

    return {
      bufferSize: this._buffer.length,
      totalMetrics,
      totalEvents: this._events.length,
      totalTraces: this._traces.size,
      memoryUsage,
    };
  }

  private _recordMetric(
    name: string,
    value: number,
    timestamp: Date,
    tags: Record<string, string>,
  ): void {
    const point: MetricPoint = { name, value, timestamp, tags };

    const points = this._metrics.get(name) || [];
    points.push(point);

    // Maintain reasonable history size
    if (points.length > 10000) {
      points.splice(0, points.length - 10000);
    }

    this._metrics.set(name, points);
  }

  private _recordEvent(event: TelemetryEvent): void {
    this._events.push(event);

    // Maintain reasonable history size
    if (this._events.length > 5000) {
      this._events.splice(0, this._events.length - 5000);
    }
  }

  private _addToBuffer(data: TelemetryData): void {
    if (this._shouldSample()) {
      this._buffer.push(data);

      // Maintain buffer size
      if (this._buffer.length > this._options.bufferSize) {
        this._buffer.splice(0, this._buffer.length - this._options.bufferSize);
      }
    }
  }

  private _shouldSample(): boolean {
    if (!this._options.enableSampling) return true;
    return Math.random() < this._options.samplingRate;
  }

  private _startFlushTimer(): void {
    this._flushTimer = setInterval(() => {
      this._flush().catch((error) => this.emit("flush_error", error));
    }, this._options.flushInterval);
  }

  private async _flush(): Promise<void> {
    if (this._buffer.length === 0) return;

    try {
      for (const exportConfig of this._options.exports) {
        const batch = this._buffer.slice(0, exportConfig.batchSize);
        await this._exportBatch(batch, exportConfig);
      }

      // Clear processed items
      const maxBatchSize = Math.max(
        ...this._options.exports.map((e) => e.batchSize),
        0,
      );
      if (maxBatchSize > 0) {
        this._buffer.splice(0, maxBatchSize);
      }

      this.emit("flush_completed", { itemsProcessed: maxBatchSize });
    } catch (error) {
      this.emit("flush_error", error);
    }
  }

  private async _exportBatch(
    batch: TelemetryData[],
    config: TelemetryExport,
  ): Promise<void> {
    const exportData = await this.exportData(config.format);

    if (config.destination.startsWith("http")) {
      // HTTP export
      const response = await fetch(config.destination, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.compression ? { "Content-Encoding": "gzip" } : {}),
        },
        body: exportData,
      });

      if (!response.ok) {
        throw new Error(
          `Export failed: ${response.status} ${response.statusText}`,
        );
      }
    } else {
      // File export
      const fs = await import("fs/promises");
      await fs.writeFile(config.destination, exportData, "utf8");
    }
  }

  private _exportAsJson(data: TelemetryData[]): string {
    return JSON.stringify(data, null, 2);
  }

  private _exportAsPrometheus(data: TelemetryData[]): string {
    const lines: string[] = [];

    for (const [name, points] of this._metrics.entries()) {
      const metricName = name.replace(/[^a-zA-Z0-9_]/g, "_");

      for (const point of points) {
        const labels = Object.entries(point.tags)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",");

        lines.push(
          `${metricName}{${labels}} ${point.value} ${point.timestamp.getTime()}`,
        );
      }
    }

    return lines.join("\n");
  }

  private _exportAsOpenTelemetry(data: TelemetryData[]): string {
    // Simplified OpenTelemetry format
    const otlpData = {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              {
                key: "service.name",
                value: { stringValue: "maria-multimodal" },
              },
              { key: "service.version", value: { stringValue: "3.5.0" } },
            ],
          },
          instrumentationLibraryMetrics: [
            {
              instrumentationLibrary: { name: "maria-telemetry" },
              metrics: data
                .filter((d) => d.type === "metric")
                .map((d) => ({
                  name: String(d.data),
                  unit: "ms",
                  sum: {
                    dataPoints: [
                      {
                        timeUnixNano: d.timestamp.getTime() * 1000000,
                        asDouble: 0,
                        attributes: Object.entries(d.tags).map(([k, v]) => ({
                          key: k,
                          value: { stringValue: v },
                        })),
                      },
                    ],
                  },
                })),
            },
          ],
        },
      ],
    };

    return JSON.stringify(otlpData, null, 2);
  }

  private _healthToScore(status: string): number {
    switch (status) {
      case "healthy":
        return 1;
      case "degraded":
        return 0.5;
      case "unhealthy":
        return 0;
      default:
        return -1;
    }
  }

  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
