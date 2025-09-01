/**
 * Metrics Aggregation System
 * Phase 4.0 Week 2: High-performance metrics collection and aggregation
 * Features: Time-series data, statistical analysis, efficient storage
 */

import { EventEmitter } from "node:events";
import * as fs from "fs/promises";
import * as path from "path";

export interface MetricsConfig {
  aggregationInterval: number; // milliseconds
  retentionPolicy: {
    raw: number; // hours
    hourly: number; // days
    daily: number; // months
    monthly: number; // years
  };
  storage: {
    type: "memory" | "file" | "database";
    path?: string;
    maxMemoryUsage?: number; // bytes
  };
  aggregationRules: AggregationRule[];
  enableCompression: boolean;
}

export interface AggregationRule {
  name: string;
  pattern: string; // metric name pattern
  functions: ("sum" | "avg" | "min" | "max" | "count" | "p95" | "p99")[];
  groupBy?: string[];
  interval: number; // seconds
}

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags?: { [key: string]: string };
  labels?: { [key: string]: string };
}

export interface AggregatedMetric {
  name: string;
  function: string;
  value: number;
  count: number;
  min: number;
  max: number;
  sum: number;
  timestamp: Date;
  interval: number;
  tags?: { [key: string]: string };
}

export interface MetricsQuery {
  name?: string;
  pattern?: string;
  startTime?: Date;
  endTime?: Date;
  tags?: { [key: string]: string };
  functions?: string[];
  groupBy?: string[];
  limit?: number;
  resolution?: "raw" | "minute" | "hour" | "day";
}

export interface MetricsQueryResult {
  metrics: AggregatedMetric[];
  totalCount: number;
  executionTime: number;
  resolution: string;
}

export interface StatisticalSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  standardDeviation: number;
  variance: number;
}

/**
 * Metrics Aggregator
 * Efficient collection and aggregation of time-series metrics
 */
export class MetricsAggregator extends EventEmitter {
  private config: MetricsConfig;
  private rawMetrics: Map<string, MetricPoint[]> = new Map();
  private aggregatedMetrics: Map<string, Map<number, AggregatedMetric[]>> =
    new Map();
  private aggregationTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Statistical buffers for efficient calculation
  private statisticsBuffer: Map<string, number[]> = new Map();
  private lastAggregation = new Date();

  constructor(config: MetricsConfig) {
    super();
    this.config = this.validateConfig(config);
  }

  /**
   * Start metrics aggregation
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    // Load existing data if file storage
    if (this.config.storage.type === "file") {
      await this.loadStoredMetrics();
    }

    // Start aggregation timer
    this.aggregationTimer = setInterval(
      () => this.performAggregation(),
      this.config.aggregationInterval,
    );

    this.emit("aggregator_started", {
      interval: this.config.aggregationInterval,
      storage: this.config.storage.type,
    });
  }

  /**
   * Stop metrics aggregation
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Stop aggregation timer
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    // Perform final aggregation
    await this.performAggregation();

    // Save data if file storage
    if (this.config.storage.type === "file") {
      await this.saveMetrics();
    }

    this.emit("aggregator_stopped");
  }

  /**
   * Record a metric point
   */
  recordMetric(metric: MetricPoint): void {
    const key = this.getMetricKey(metric.name, metric.tags);

    // Add to raw metrics
    let rawSeries = this.rawMetrics.get(key);
    if (!rawSeries) {
      rawSeries = [];
      this.rawMetrics.set(key, rawSeries);
    }
    rawSeries.push(metric);

    // Add to statistics buffer for real-time stats
    let buffer = this.statisticsBuffer.get(key);
    if (!buffer) {
      buffer = [];
      this.statisticsBuffer.set(key, buffer);
    }
    buffer.push(metric.value);

    // Limit buffer size for memory management
    if (buffer.length > 10000) {
      buffer.splice(0, buffer.length - 10000);
    }

    this.emit("metric_recorded", { key, value: metric.value });
  }

  /**
   * Record multiple metrics at once
   */
  recordMetrics(metrics: MetricPoint[]): void {
    for (const metric of metrics) {
      this.recordMetric(metric);
    }
  }

  /**
   * Query metrics
   */
  async queryMetrics(query: MetricsQuery): Promise<MetricsQueryResult> {
    const startTime = Date.now();
    const results: AggregatedMetric[] = [];

    try {
      // Determine data source based on time range and resolution
      const useRawData = this.shouldUseRawData(query);

      if (useRawData) {
        // Query raw metrics
        const rawResults = await this.queryRawMetrics(query);
        results.push(...this.aggregateQueryResults(rawResults, query));
      } else {
        // Query aggregated metrics
        const aggResults = await this.queryAggregatedMetrics(query);
        results.push(...aggResults);
      }

      return {
        metrics: results,
        totalCount: results.length,
        executionTime: Date.now() - startTime,
        resolution: query.resolution || "auto",
      };
    } catch (error) {
      this.emit("query_error", { query, error });
      throw error;
    }
  }

  /**
   * Get statistical summary for a metric
   */
  getStatistics(
    metricName: string,
    tags?: { [key: string]: string },
  ): StatisticalSummary | null {
    const key = this.getMetricKey(metricName, tags);
    const buffer = this.statisticsBuffer.get(key);

    if (!buffer || buffer.length === 0) {
      return null;
    }

    return this.calculateStatistics(buffer);
  }

  /**
   * Get current metrics count
   */
  getMetricsCount(): {
    rawMetrics: number;
    aggregatedMetrics: number;
    memoryUsage: number;
  } {
    let rawCount = 0;
    let aggCount = 0;

    for (const series of this.rawMetrics.values()) {
      rawCount += series.length;
    }

    for (const timeSeriesMap of this.aggregatedMetrics.values()) {
      for (const series of timeSeriesMap.values()) {
        aggCount += series.length;
      }
    }

    const memoryUsage = this.estimateMemoryUsage();

    return { rawMetrics: rawCount, aggregatedMetrics: aggCount, memoryUsage };
  }

  /**
   * Cleanup old metrics based on retention policy
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;

    // Clean raw metrics
    const rawRetentionMs = this.config.retentionPolicy.raw * 60 * 60 * 1000;
    for (const [key, series] of this.rawMetrics) {
      const originalLength = series.length;
      this.rawMetrics.set(
        key,
        series.filter(
          (point) => now.getTime() - point.timestamp.getTime() < rawRetentionMs,
        ),
      );
      cleanedCount += originalLength - this.rawMetrics.get(key)!.length;
    }

    // Clean aggregated metrics based on retention policy
    for (const [key, timeSeriesMap] of this.aggregatedMetrics) {
      for (const [interval, series] of timeSeriesMap) {
        const retentionMs = this.getRetentionForInterval(interval);
        const originalLength = series.length;
        timeSeriesMap.set(
          interval,
          series.filter(
            (metric) =>
              now.getTime() - metric.timestamp.getTime() < retentionMs,
          ),
        );
        cleanedCount += originalLength - timeSeriesMap.get(interval)!.length;
      }
    }

    this.emit("metrics_cleaned", { cleanedCount });
  }

  /**
   * Export metrics to various formats
   */
  async exportMetrics(
    format: "json" | "csv" | "prometheus",
    query?: MetricsQuery,
  ): Promise<string> {
    const queryResult = await this.queryMetrics(query || {});

    switch (format) {
      case "json":
        return JSON.stringify(queryResult, null, 2);
      case "csv":
        return this.toCsv(queryResult.metrics);
      case "prometheus":
        return this.toPrometheusFormat(queryResult.metrics);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Private methods
   */
  private async performAggregation(): Promise<void> {
    const startTime = Date.now();

    try {
      // Process each aggregation rule
      for (const rule of this.config.aggregationRules) {
        await this.processAggregationRule(rule);
      }

      // Cleanup old metrics
      await this.cleanup();

      this.lastAggregation = new Date();

      this.emit("aggregation_completed", {
        duration: Date.now() - startTime,
        rulesProcessed: this.config.aggregationRules.length,
      });
    } catch (error) {
      this.emit("aggregation_error", error);
    }
  }

  private async processAggregationRule(rule: AggregationRule): Promise<void> {
    const now = new Date();
    const intervalMs = rule.interval * 1000;
    const windowStart = new Date(
      Math.floor(now.getTime() / intervalMs) * intervalMs,
    );

    // Find matching metrics
    const matchingKeys = Array.from(this.rawMetrics.keys()).filter((key) =>
      this.matchesPattern(key, rule.pattern),
    );

    for (const key of matchingKeys) {
      const rawSeries = this.rawMetrics.get(key);
      if (!rawSeries) continue;

      // Filter metrics in the current window
      const windowMetrics = rawSeries.filter(
        (metric) => metric.timestamp >= windowStart && metric.timestamp < now,
      );

      if (windowMetrics.length === 0) continue;

      // Group metrics if needed
      const groups = this.groupMetrics(windowMetrics, rule.groupBy);

      for (const [groupKey, groupMetrics] of groups) {
        // Calculate aggregation functions
        for (const func of rule.functions) {
          const aggregated = this.calculateAggregation(
            groupMetrics,
            func,
            rule.interval,
            windowStart,
          );
          this.storeAggregatedMetric(key, rule.interval, aggregated);
        }
      }
    }
  }

  private calculateAggregation(
    metrics: MetricPoint[],
    func: string,
    interval: number,
    timestamp: Date,
  ): AggregatedMetric {
    const values = metrics.map((m) => m.value);
    let value: number;

    switch (func) {
      case "sum":
        value = values.reduce((a, b) => a + b, 0);
        break;
      case "avg":
        value = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case "min":
        value = Math.min(...values);
        break;
      case "max":
        value = Math.max(...values);
        break;
      case "count":
        value = values.length;
        break;
      case "p95":
        value = this.percentile(values, 0.95);
        break;
      case "p99":
        value = this.percentile(values, 0.99);
        break;
      default:
        value = 0;
    }

    return {
      name: metrics[0].name,
      function: func,
      value,
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      sum: values.reduce((a, b) => a + b, 0),
      timestamp,
      interval,
      tags: metrics[0].tags,
    };
  }

  private storeAggregatedMetric(
    key: string,
    interval: number,
    metric: AggregatedMetric,
  ): void {
    let timeSeriesMap = this.aggregatedMetrics.get(key);
    if (!timeSeriesMap) {
      timeSeriesMap = new Map();
      this.aggregatedMetrics.set(key, timeSeriesMap);
    }

    let series = timeSeriesMap.get(interval);
    if (!series) {
      series = [];
      timeSeriesMap.set(interval, series);
    }

    series.push(metric);
  }

  private calculateStatistics(values: number[]): StatisticalSummary {
    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    // Calculate variance and standard deviation
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);

    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      mean,
      median: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      standardDeviation,
      variance,
    };
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = (sortedValues.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private getMetricKey(name: string, tags?: { [key: string]: string }): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }

    const sortedTags = Object.keys(tags)
      .sort()
      .map((key) => `${key}=${tags[key]}`)
      .join(",");
    return `${name}{${sortedTags}}`;
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return regex.test(key);
  }

  private groupMetrics(
    metrics: MetricPoint[],
    groupBy?: string[],
  ): Map<string, MetricPoint[]> {
    if (!groupBy || groupBy.length === 0) {
      return new Map([["default", metrics]]);
    }

    const groups = new Map<string, MetricPoint[]>();

    for (const metric of metrics) {
      const groupKey = groupBy
        .map(
          (field) =>
            metric.tags?.[field] || metric.labels?.[field] || "unknown",
        )
        .join(",");

      let group = groups.get(groupKey);
      if (!group) {
        group = [];
        groups.set(groupKey, group);
      }
      group.push(metric);
    }

    return groups;
  }

  private shouldUseRawData(query: MetricsQuery): boolean {
    if (query.resolution === "raw") return true;
    if (query.resolution && query.resolution !== "raw") return false;

    // Auto-determine based on time range
    if (query.startTime && query.endTime) {
      const rangeMs = query.endTime.getTime() - query.startTime.getTime();
      const hourMs = 60 * 60 * 1000;
      return rangeMs < hourMs; // Use raw data for queries < 1 hour
    }

    return true;
  }

  private async queryRawMetrics(query: MetricsQuery): Promise<MetricPoint[]> {
    const results: MetricPoint[] = [];

    for (const [key, series] of this.rawMetrics) {
      if (query.name && !key.startsWith(query.name)) continue;
      if (query.pattern && !this.matchesPattern(key, query.pattern)) continue;

      let filteredSeries = series;

      if (query.startTime) {
        filteredSeries = filteredSeries.filter(
          (m) => m.timestamp >= query.startTime!,
        );
      }

      if (query.endTime) {
        filteredSeries = filteredSeries.filter(
          (m) => m.timestamp <= query.endTime!,
        );
      }

      if (query.tags) {
        filteredSeries = filteredSeries.filter((m) =>
          this.tagsMatch(m.tags || {}, query.tags!),
        );
      }

      results.push(...filteredSeries);
    }

    if (query.limit) {
      results.splice(query.limit);
    }

    return results;
  }

  private async queryAggregatedMetrics(
    query: MetricsQuery,
  ): Promise<AggregatedMetric[]> {
    const results: AggregatedMetric[] = [];

    for (const [key, timeSeriesMap] of this.aggregatedMetrics) {
      if (query.name && !key.startsWith(query.name)) continue;
      if (query.pattern && !this.matchesPattern(key, query.pattern)) continue;

      for (const [interval, series] of timeSeriesMap) {
        let filteredSeries = series;

        if (query.startTime) {
          filteredSeries = filteredSeries.filter(
            (m) => m.timestamp >= query.startTime!,
          );
        }

        if (query.endTime) {
          filteredSeries = filteredSeries.filter(
            (m) => m.timestamp <= query.endTime!,
          );
        }

        if (query.functions) {
          filteredSeries = filteredSeries.filter((m) =>
            query.functions!.includes(m.function),
          );
        }

        results.push(...filteredSeries);
      }
    }

    return results;
  }

  private aggregateQueryResults(
    rawMetrics: MetricPoint[],
    query: MetricsQuery,
  ): AggregatedMetric[] {
    // Convert raw metrics to aggregated format for consistent response
    const grouped = this.groupMetrics(rawMetrics, query.groupBy);
    const results: AggregatedMetric[] = [];

    for (const [groupKey, groupMetrics] of grouped) {
      const functions = query.functions || ["avg", "count"];

      for (const func of functions) {
        const aggregated = this.calculateAggregation(
          groupMetrics,
          func,
          60, // Default 1-minute interval
          new Date(),
        );
        results.push(aggregated);
      }
    }

    return results;
  }

  private tagsMatch(
    metricTags: { [key: string]: string },
    queryTags: { [key: string]: string },
  ): boolean {
    for (const [key, value] of Object.entries(queryTags)) {
      if (metricTags[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private getRetentionForInterval(interval: number): number {
    // Map interval to retention policy
    if (interval < 60) return this.config.retentionPolicy.raw * 60 * 60 * 1000;
    if (interval < 3600)
      return this.config.retentionPolicy.hourly * 24 * 60 * 60 * 1000;
    if (interval < 86400)
      return this.config.retentionPolicy.daily * 30 * 24 * 60 * 60 * 1000;
    return this.config.retentionPolicy.monthly * 365 * 24 * 60 * 60 * 1000;
  }

  private estimateMemoryUsage(): number {
    // Rough estimate based on metric counts
    const rawCount = Array.from(this.rawMetrics.values()).reduce(
      (sum, series) => sum + series.length,
      0,
    );
    const aggCount = Array.from(this.aggregatedMetrics.values()).reduce(
      (sum, timeSeriesMap) =>
        sum +
        Array.from(timeSeriesMap.values()).reduce(
          (innerSum, series) => innerSum + series.length,
          0,
        ),
      0,
    );

    // Estimate ~100 bytes per metric point
    return (rawCount + aggCount) * 100;
  }

  private async loadStoredMetrics(): Promise<void> {
    if (!this.config.storage.path) return;

    try {
      const filePath = path.join(this.config.storage.path, "metrics.json");
      const data = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(data);

      // Restore raw metrics
      if (parsed.rawMetrics) {
        this.rawMetrics = new Map(parsed.rawMetrics);
      }

      // Restore aggregated metrics
      if (parsed.aggregatedMetrics) {
        this.aggregatedMetrics = new Map(parsed.aggregatedMetrics);
      }
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      this.emit("load_error", error);
    }
  }

  private async saveMetrics(): Promise<void> {
    if (!this.config.storage.path) return;

    try {
      const data = {
        rawMetrics: Array.from(this.rawMetrics.entries()),
        aggregatedMetrics: Array.from(this.aggregatedMetrics.entries()),
        savedAt: new Date(),
      };

      const filePath = path.join(this.config.storage.path, "metrics.json");
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.emit("save_error", error);
    }
  }

  private toCsv(metrics: AggregatedMetric[]): string {
    const headers = ["name", "function", "value", "timestamp", "tags"];
    const rows = metrics.map((m) => [
      m.name,
      m.function,
      m.value.toString(),
      m.timestamp.toISOString(),
      JSON.stringify(m.tags || {}),
    ]);

    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  }

  private toPrometheusFormat(metrics: AggregatedMetric[]): string {
    return metrics
      .map((m) => {
        const metricName = `${m.name}_${m.function}`;
        const labels = m.tags
          ? Object.entries(m.tags)
              .map(([k, v]) => `${k}="${v}"`)
              .join(",")
          : "";
        const labelStr = labels ? `{${labels}}` : "";
        return `${metricName}${labelStr} ${m.value} ${m.timestamp.getTime()}`;
      })
      .join("\n");
  }

  private validateConfig(config: MetricsConfig): MetricsConfig {
    return {
      ...config,
      aggregationInterval: Math.max(config.aggregationInterval, 1000), // Min 1 second
      retentionPolicy: {
        raw: Math.max(config.retentionPolicy.raw, 1), // Min 1 hour
        hourly: Math.max(config.retentionPolicy.hourly, 1), // Min 1 day
        daily: Math.max(config.retentionPolicy.daily, 1), // Min 1 month
        monthly: Math.max(config.retentionPolicy.monthly, 1), // Min 1 year
      },
    };
  }
}

/**
 * Factory function to create metrics aggregator
 */
export function createMetricsAggregator(
  config: MetricsConfig,
): MetricsAggregator {
  return new MetricsAggregator(config);
}
