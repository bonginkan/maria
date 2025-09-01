import { EventEmitter } from "node:events";
import { Counter, Gauge, Histogram } from "prom-client";

export type MetricType = "counter" | "gauge" | "histogram" | "summary";

export interface MetricDefinition {
  name: string;
  type: MetricType;
  help: string;
  labels?: string[];
  buckets?: number[]; // For histograms
  percentiles?: number[]; // For summaries
  aggregation?: "_sum" | "avg" | "max" | "min" | "last";
}

export interface CustomMetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

export interface MetricSnapshot {
  name: string;
  type: MetricType;
  values: CustomMetricValue[];
  statistics?: {
    count: number;
    _sum: number;
    mean: number;
    min: number;
    max: number;
    p50?: number;
    p95?: number;
    p99?: number;
  };
}

export class CustomMetricsFramework extends EventEmitter {
  private metrics: Map<string, any>;
  private definitions: Map<string, MetricDefinition>;
  private snapshots: Map<string, CustomMetricValue[]>;
  private aggregators: Map<string, (values: number[]) => number>;
  private flushInterval: number;
  private flushTimer?: NodeJS.Timeout;
  private maxSnapshotSize: number;

  constructor(
    config: { flushInterval?: number; maxSnapshotSize?: number } = {},
  ) {
    super();

    this.metrics = new Map();
    this.definitions = new Map();
    this.snapshots = new Map();
    this.aggregators = new Map();
    this.flushInterval = config.flushInterval || 60000; // 1 minute
    this.maxSnapshotSize = config.maxSnapshotSize || 10000;

    this.initializeAggregators();
    this.startFlushTimer();
  }

  private initializeAggregators(): void {
    this.aggregators.set("_sum", (values) => values.reduce((a, b) => a + b, 0));
    this.aggregators.set(
      "avg",
      (values) => values.reduce((a, b) => a + b, 0) / values.length,
    );
    this.aggregators.set("max", (values) => Math.max(...values));
    this.aggregators.set("min", (values) => Math.min(...values));
    this.aggregators.set("last", (values) => values[values.length - 1]);
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  public registerMetric(definition: MetricDefinition): void {
    if (this.definitions.has(definition.name)) {
      throw new Error(`Metric ${definition.name} already registered`);
    }

    this.definitions.set(definition.name, definition);
    this.snapshots.set(definition.name, []);

    // Create Prometheus metric if needed
    let metric: any;

    switch (definition.type) {
      case "counter":
        metric = new Counter({
          name: definition.name,
          help: definition.help,
          labelNames: definition.labels || [],
        });
        break;

      case "gauge":
        metric = new Gauge({
          name: definition.name,
          help: definition.help,
          labelNames: definition.labels || [],
        });
        break;

      case "histogram":
        metric = new Histogram({
          name: definition.name,
          help: definition.help,
          labelNames: definition.labels || [],
          buckets: definition.buckets || [0.1, 0.5, 1, 2, 5, 10],
        });
        break;

      default:
        // Custom implementation for summary and other types
        metric = {
          type: definition.type,
          observe: (value: number, labels?: Record<string, string>) => {
            this.recordValue(definition.name, { value, labels });
          },
        };
    }

    this.metrics.set(definition.name, metric);
    this.emit("metricRegistered", definition);
  }

  public recordValue(metricName: string, value: CustomMetricValue): void {
    const definition = this.definitions.get(metricName);

    if (!definition) {
      throw new Error(`Metric ${metricName} not registered`);
    }

    const metric = this.metrics.get(metricName);
    const snapshot = this.snapshots.get(metricName)!;

    // Add timestamp if not provided
    if (!value.timestamp) {
      value.timestamp = Date.now();
    }

    // Record in Prometheus metric
    if (metric && typeof metric.observe === "function") {
      if (value.labels) {
        metric.observe(value.labels, value.value);
      } else {
        metric.observe(value.value);
      }
    } else if (metric && typeof metric.inc === "function") {
      // Counter
      if (value.labels) {
        metric.inc(value.labels, value.value);
      } else {
        metric.inc(value.value);
      }
    } else if (metric && typeof metric.set === "function") {
      // Gauge
      if (value.labels) {
        metric.set(value.labels, value.value);
      } else {
        metric.set(value.value);
      }
    }

    // Store in snapshot
    snapshot.push(value);

    // Limit snapshot size
    if (snapshot.length > this.maxSnapshotSize) {
      snapshot.splice(0, snapshot.length - this.maxSnapshotSize);
    }

    this.emit("valueRecorded", { metric: metricName, value });
  }

  public increment(
    metricName: string,
    amount: number = 1,
    labels?: Record<string, string>,
  ): void {
    const definition = this.definitions.get(metricName);

    if (!definition) {
      throw new Error(`Metric ${metricName} not registered`);
    }

    if (definition.type !== "counter") {
      throw new Error(`Metric ${metricName} is not a counter`);
    }

    this.recordValue(metricName, { value: amount, labels });
  }

  public gauge(
    metricName: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const definition = this.definitions.get(metricName);

    if (!definition) {
      throw new Error(`Metric ${metricName} not registered`);
    }

    if (definition.type !== "gauge") {
      throw new Error(`Metric ${metricName} is not a gauge`);
    }

    this.recordValue(metricName, { value, labels });
  }

  public observe(
    metricName: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const definition = this.definitions.get(metricName);

    if (!definition) {
      throw new Error(`Metric ${metricName} not registered`);
    }

    if (definition.type !== "histogram" && definition.type !== "summary") {
      throw new Error(`Metric ${metricName} is not a histogram or summary`);
    }

    this.recordValue(metricName, { value, labels });
  }

  public getSnapshot(metricName: string): MetricSnapshot | undefined {
    const definition = this.definitions.get(metricName);
    const snapshot = this.snapshots.get(metricName);

    if (!definition || !snapshot) {
      return undefined;
    }

    const values = [...snapshot];
    const statistics = this.calculateStatistics(values);

    return {
      name: metricName,
      type: definition.type,
      values,
      statistics,
    };
  }

  private calculateStatistics(values: CustomMetricValue[]): {
    count: number;
    _sum: number;
    mean: number;
    min: number;
    max: number;
    p50?: number;
    p95?: number;
    p99?: number;
  } {
    if (values.length === 0) {
      return {
        count: 0,
        _sum: 0,
        mean: 0,
        min: 0,
        max: 0,
      };
    }

    const numbers = values.map((v) => v.value).sort((a, b) => a - b);
    const count = numbers.length;
    const _sum = numbers.reduce((a, b) => a + b, 0);
    const mean = _sum / count;
    const min = numbers[0];
    const max = numbers[count - 1];

    // Calculate percentiles
    const p50 = this.percentile(numbers, 0.5);
    const p95 = this.percentile(numbers, 0.95);
    const p99 = this.percentile(numbers, 0.99);

    return {
      count,
      _sum,
      mean,
      min,
      max,
      p50,
      p95,
      p99,
    };
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil(p * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  public aggregate(
    metricName: string,
    windowMs: number = 60000,
  ): number | undefined {
    const definition = this.definitions.get(metricName);
    const snapshot = this.snapshots.get(metricName);

    if (!definition || !snapshot) {
      return undefined;
    }

    const now = Date.now();
    const windowValues = snapshot
      .filter((v) => v.timestamp && now - v.timestamp <= windowMs)
      .map((v) => v.value);

    if (windowValues.length === 0) {
      return undefined;
    }

    const aggregator = this.aggregators.get(definition.aggregation || "last");
    return aggregator
      ? aggregator(windowValues)
      : windowValues[windowValues.length - 1];
  }

  public query(options: {
    metric?: string;
    labels?: Record<string, string>;
    startTime?: number;
    endTime?: number;
    aggregation?: string;
  }): CustomMetricValue[] {
    const results: CustomMetricValue[] = [];

    // Get metrics to query
    const metricsToQuery = options.metric
      ? [options.metric]
      : Array.from(this.snapshots.keys());

    for (const metric of metricsToQuery) {
      const snapshot = this.snapshots.get(metric);

      if (!snapshot) continue;

      let filtered = [...snapshot];

      // Filter by time range
      if (options.startTime) {
        filtered = filtered.filter(
          (v) => v.timestamp && v.timestamp >= options.startTime!,
        );
      }

      if (options.endTime) {
        filtered = filtered.filter(
          (v) => v.timestamp && v.timestamp <= options.endTime!,
        );
      }

      // Filter by labels
      if (options.labels) {
        filtered = filtered.filter((v) => {
          if (!v.labels) return false;

          for (const [key, value] of Object.entries(options.labels!)) {
            if (v.labels[key] !== value) return false;
          }

          return true;
        });
      }

      results.push(...filtered);
    }

    return results;
  }

  public createDerivedMetric(options: {
    name: string;
    help: string;
    sourceMetrics: string[];
    calculation: (values: Record<string, number>) => number;
    type?: MetricType;
  }): void {
    const definition: MetricDefinition = {
      name: options.name,
      type: options.type || "gauge",
      help: options.help,
    };

    this.registerMetric(definition);

    // Calculate derived metric periodically
    setInterval(() => {
      const sourceValues: Record<string, number> = {};

      for (const sourceMetric of options.sourceMetrics) {
        const value = this.aggregate(sourceMetric);
        if (value !== undefined) {
          sourceValues[sourceMetric] = value;
        }
      }

      if (Object.keys(sourceValues).length === options.sourceMetrics.length) {
        const derivedValue = options.calculation(sourceValues);
        this.recordValue(options.name, { value: derivedValue });
      }
    }, 5000); // Calculate every 5 seconds
  }

  public registerAlert(options: {
    metric: string;
    condition: (value: number) => boolean;
    message: string;
    severity?: "info" | "warning" | "error" | "critical";
    cooldown?: number;
  }): void {
    let lastAlertTime = 0;
    const cooldown = options.cooldown || 60000; // 1 minute default

    this.on("valueRecorded", (event) => {
      if (event.metric === options.metric) {
        const now = Date.now();

        if (
          now - lastAlertTime >= cooldown &&
          options.condition(event.value.value)
        ) {
          this.emit("alert", {
            metric: options.metric,
            value: event.value.value,
            message: options.message,
            severity: options.severity || "warning",
            timestamp: now,
          });

          lastAlertTime = now;
        }
      }
    });
  }

  public export(format: "json" | "prometheus" | "csv" = "json"): string {
    const allSnapshots: MetricSnapshot[] = [];

    for (const metricName of this.definitions.keys()) {
      const snapshot = this.getSnapshot(metricName);
      if (snapshot) {
        allSnapshots.push(snapshot);
      }
    }

    switch (format) {
      case "prometheus":
        return this.exportPrometheus(allSnapshots);

      case "csv":
        return this.exportCSV(allSnapshots);

      case "json":
      default:
        return JSON.stringify(allSnapshots, null, 2);
    }
  }

  private exportPrometheus(snapshots: MetricSnapshot[]): string {
    const lines: string[] = [];

    for (const snapshot of snapshots) {
      lines.push(
        `# HELP ${snapshot.name} ${this.definitions.get(snapshot.name)?.help || ""}`,
      );
      lines.push(`# TYPE ${snapshot.name} ${snapshot.type}`);

      for (const value of snapshot.values) {
        let _line = snapshot.name;

        if (value.labels && Object.keys(value.labels).length > 0) {
          const labelPairs = Object.entries(value.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(",");
          _line += `{${labelPairs}}`;
        }

        _line += ` ${value.value}`;

        if (value.timestamp) {
          _line += ` ${value.timestamp}`;
        }

        lines.push(_line);
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  private exportCSV(snapshots: MetricSnapshot[]): string {
    const rows: string[] = ["metric,timestamp,value,labels"];

    for (const snapshot of snapshots) {
      for (const value of snapshot.values) {
        const labels = value.labels ? JSON.stringify(value.labels) : "";
        rows.push(
          `${snapshot.name},${value.timestamp || ""},${value.value},"${labels}"`,
        );
      }
    }

    return rows.join("\n");
  }

  private flush(): void {
    const now = Date.now();
    const cutoffTime = now - this.flushInterval * 10; // Keep 10 intervals of data

    for (const snapshot of this.snapshots.values()) {
      const originalLength = snapshot.length;
      const filtered = snapshot.filter(
        (v) => !v.timestamp || v.timestamp > cutoffTime,
      );

      if (filtered.length < originalLength) {
        snapshot.splice(0, originalLength, ...filtered);
      }
    }

    this.emit("flushed", { timestamp: now });
  }

  public dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.metrics.clear();
    this.definitions.clear();
    this.snapshots.clear();
    this.removeAllListeners();
  }
}

// Singleton instance with default metrics
let frameworkInstance: CustomMetricsFramework | null = null;

export function getCustomMetricsFramework(): CustomMetricsFramework {
  if (!frameworkInstance) {
    frameworkInstance = new CustomMetricsFramework();

    // Register default custom metrics
    frameworkInstance.registerMetric({
      name: "maria_custom_command_usage",
      type: "counter",
      help: "Custom command usage counter",
      labels: ["command", "user"],
    });

    frameworkInstance.registerMetric({
      name: "maria_custom_memory_usage",
      type: "gauge",
      help: "Custom memory usage gauge",
      labels: ["type"],
    });

    frameworkInstance.registerMetric({
      name: "maria_custom_processing_time",
      type: "histogram",
      help: "Custom processing time histogram",
      labels: ["operation"],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    });

    // Register derived metric example
    frameworkInstance.createDerivedMetric({
      name: "maria_custom_efficiency_ratio",
      help: "Efficiency ratio (success / total)",
      sourceMetrics: ["maria_custom_success_count", "maria_custom_total_count"],
      calculation: (values) => {
        const success = values["maria_custom_success_count"] || 0;
        const total = values["maria_custom_total_count"] || 1;
        return success / total;
      },
    });
  }

  return frameworkInstance;
}
