/**
 * MetricsDashboard - Real-time metrics visualization for code generation
 * Provides live performance monitoring and trend analysis
 */

import chalk from "chalk";
import { GenerationMetrics } from "./FastCodeGenerator";

export interface DashboardMetrics {
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  hitRates: {
    template: number;
    cache: number;
    generated: number;
  };
  streaming: {
    firstTokenMs: number;
    chunksPerSec: number;
    avgChunkSize: number;
    throughputTokensPerSec: number;
  };
  volume: {
    totalRequests: number;
    requestsPerMinute: number;
    successRate: number;
  };
}

export interface Metric {
  type: string;
  value: number;
  timestamp: number;
  metadata?: any;
}

/**
 * Live metrics dashboard for code generation performance
 */
export class MetricsDashboard {
  private metrics: Map<string, Metric[]> = new Map();
  private readonly MAX_HISTORY = 100;
  private dashboardActive = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private generationMetrics: GenerationMetrics[] = [];

  constructor(
    private options: {
      updateIntervalMs?: number;
      showSparklines?: boolean;
      colorOutput?: boolean;
    } = {},
  ) {
    this.options.updateIntervalMs = options.updateIntervalMs || 1000;
    this.options.showSparklines = options.showSparklines ?? true;
    this.options.colorOutput = options.colorOutput ?? process.stdout.isTTY;
  }

  /**
   * Record a metric data point
   */
  record(metric: Metric): void {
    const key = metric.type;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const history = this.metrics.get(key)!;
    history.push({
      ...metric,
      timestamp: metric.timestamp || Date.now(),
    });

    // Keep only recent history
    if (history.length > this.MAX_HISTORY) {
      history.shift();
    }
  }

  /**
   * Record generation metrics
   */
  recordGeneration(metric: GenerationMetrics): void {
    this.generationMetrics.push(metric);

    // Convert to dashboard metrics
    this.record({
      type: "latency",
      value: metric.duration,
      timestamp: Date.now(),
    });

    if (metric.firstTokenMs) {
      this.record({
        type: "first_token",
        value: metric.firstTokenMs,
        timestamp: Date.now(),
      });
    }

    if (metric.throughputTokensPerSec) {
      this.record({
        type: "throughput",
        value: metric.throughputTokensPerSec,
        timestamp: Date.now(),
      });
    }

    // Keep only last 100 generation metrics
    if (this.generationMetrics.length > 100) {
      this.generationMetrics = this.generationMetrics.slice(-100);
    }
  }

  /**
   * Start the live dashboard
   */
  async showDashboard(): Promise<void> {
    if (this.dashboardActive) return;

    this.dashboardActive = true;
    this.startTime = Date.now();

    // Clear screen and setup
    if (this.options.colorOutput) {
      console.clear();
    }

    // Initial render
    this.renderDashboard();

    // Update loop
    this.updateInterval = setInterval(() => {
      if (!this.dashboardActive) {
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
        }
        return;
      }

      this.renderDashboard();
    }, this.options.updateIntervalMs!);

    // Handle exit gracefully
    const exitHandler = () => {
      this.stopDashboard();
      process.exit(0);
    };

    process.on("SIGINT", exitHandler);
    process.on("SIGTERM", exitHandler);
  }

  /**
   * Stop the dashboard
   */
  stopDashboard(): void {
    this.dashboardActive = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Clear screen
    if (this.options.colorOutput) {
      console.clear();
    }
  }

  /**
   * Render the dashboard
   */
  private renderDashboard(): void {
    const output: string[] = [];

    // Clear and reposition cursor
    if (this.options.colorOutput) {
      output.push("\x1b[2J\x1b[H");
    }

    // Header
    const header = this.options.colorOutput
      ? chalk.bold.cyan("📊 Code Generation Metrics Dashboard")
      : "📊 Code Generation Metrics Dashboard";
    output.push(header);
    output.push(this.formatSeparator());

    // Uptime
    const uptimeMs = Date.now() - this.startTime;
    const uptime = this.formatDuration(uptimeMs);
    output.push(`⏱️  Uptime: ${uptime}`);
    output.push("");

    // Performance metrics
    const latencies = this.getLatencies();
    output.push(this.formatSection("⚡ Performance"));
    output.push(`  P50 Latency:  ${this.formatLatency(latencies.p50)}`);
    output.push(`  P95 Latency:  ${this.formatLatency(latencies.p95)}`);
    output.push(`  P99 Latency:  ${this.formatLatency(latencies.p99)}`);
    output.push(`  Avg Latency:  ${this.formatLatency(latencies.avg)}`);

    // Hit rates
    const rates = this.getHitRates();
    output.push("");
    output.push(this.formatSection("🎯 Cache Performance"));
    output.push(`  Template Hits:  ${this.formatPercent(rates.template)}`);
    output.push(`  Cache Hits:     ${this.formatPercent(rates.cache)}`);
    output.push(`  AI Generated:   ${this.formatPercent(rates.generated)}`);

    // Streaming stats
    const streaming = this.getStreamingStats();
    if (streaming.firstTokenMs > 0) {
      output.push("");
      output.push(this.formatSection("📡 Streaming Performance"));
      output.push(
        `  First Token:    ${this.formatLatency(streaming.firstTokenMs)}`,
      );
      output.push(
        `  Throughput:     ${streaming.throughputTokensPerSec.toFixed(1)} tokens/sec`,
      );
      output.push(`  Chunks/sec:     ${streaming.chunksPerSec.toFixed(1)}`);
    }

    // Volume stats
    const volume = this.getVolumeStats();
    output.push("");
    output.push(this.formatSection("📈 Request Volume"));
    output.push(`  Total Requests:    ${volume.totalRequests}`);
    output.push(`  Requests/min:      ${volume.requestsPerMinute.toFixed(1)}`);
    output.push(
      `  Success Rate:      ${this.formatPercent(volume.successRate)}`,
    );

    // Sparkline chart
    if (this.options.showSparklines) {
      output.push("");
      output.push(this.formatSection("📉 Latency Trend"));
      const sparkline = this.renderSparkline();
      output.push(`  ${sparkline}`);
    }

    // Model usage
    const modelUsage = this.getModelUsage();
    if (Object.keys(modelUsage).length > 0) {
      output.push("");
      output.push(this.formatSection("🤖 Model Usage"));
      for (const [model, count] of Object.entries(modelUsage)) {
        const percent = (count / volume.totalRequests) * 100;
        output.push(`  ${model}: ${count} (${percent.toFixed(1)}%)`);
      }
    }

    // Footer
    output.push("");
    output.push(this.formatSeparator());
    output.push("Press Ctrl+C to exit");

    // Print everything at once to reduce flicker
    console.log(output.join("\n"));
  }

  /**
   * Calculate latency percentiles
   */
  private getLatencies(): DashboardMetrics["latency"] {
    const latencyMetrics = this.metrics.get("latency") || [];
    const values = latencyMetrics.map((m) => m.value).filter((v) => v > 0);

    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0 };
    }

    // Sort for percentile calculation
    values.sort((a, b) => a - b);

    const p50Index = Math.floor(values.length * 0.5);
    const p95Index = Math.floor(values.length * 0.95);
    const p99Index = Math.floor(values.length * 0.99);

    const sum = values.reduce((a, b) => a + b, 0);

    return {
      p50: values[p50Index] || 0,
      p95: values[p95Index] || 0,
      p99: values[p99Index] || 0,
      avg: sum / values.length,
    };
  }

  /**
   * Calculate cache hit rates
   */
  private getHitRates(): DashboardMetrics["hitRates"] {
    const total = this.generationMetrics.length;
    if (total === 0) {
      return { template: 0, cache: 0, generated: 0 };
    }

    const templateHits = this.generationMetrics.filter(
      (m) => m.type === "template_hit",
    ).length;
    const cacheHits = this.generationMetrics.filter(
      (m) => m.type === "cache_hit",
    ).length;
    const generated = this.generationMetrics.filter(
      (m) => m.type === "generated",
    ).length;

    return {
      template: (templateHits / total) * 100,
      cache: (cacheHits / total) * 100,
      generated: (generated / total) * 100,
    };
  }

  /**
   * Get streaming statistics
   */
  private getStreamingStats(): DashboardMetrics["streaming"] {
    const firstTokenMetrics = this.metrics.get("first_token") || [];
    const throughputMetrics = this.metrics.get("throughput") || [];

    const avgFirstToken =
      firstTokenMetrics.length > 0
        ? firstTokenMetrics.reduce((sum, m) => sum + m.value, 0) /
          firstTokenMetrics.length
        : 0;

    const avgThroughput =
      throughputMetrics.length > 0
        ? throughputMetrics.reduce((sum, m) => sum + m.value, 0) /
          throughputMetrics.length
        : 0;

    return {
      firstTokenMs: avgFirstToken,
      chunksPerSec: avgThroughput / 10, // Estimate chunks from tokens
      avgChunkSize: 10, // Estimate
      throughputTokensPerSec: avgThroughput,
    };
  }

  /**
   * Get volume statistics
   */
  private getVolumeStats(): DashboardMetrics["volume"] {
    const total = this.generationMetrics.length;
    const uptimeMinutes = (Date.now() - this.startTime) / 60000;
    const requestsPerMinute = uptimeMinutes > 0 ? total / uptimeMinutes : 0;

    // Count successful requests (not failed)
    const successful = this.generationMetrics.filter(
      (m) => m.duration < 30000,
    ).length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      totalRequests: total,
      requestsPerMinute,
      successRate,
    };
  }

  /**
   * Get model usage statistics
   */
  private getModelUsage(): Record<string, number> {
    const usage: Record<string, number> = {};

    for (const metric of this.generationMetrics) {
      if (metric.model) {
        usage[metric.model] = (usage[metric.model] || 0) + 1;
      }
    }

    return usage;
  }

  /**
   * Render a sparkline chart
   */
  private renderSparkline(): string {
    const history = this.metrics.get("latency") || [];
    const values = history.slice(-30).map((m) => m.value); // Last 30 points

    if (values.length === 0) {
      return "No data";
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const chars = "▁▂▃▄▅▆▇█";

    const sparkline = values
      .map((v) => {
        const normalized = (v - min) / range;
        const index = Math.floor(normalized * (chars.length - 1));
        return chars[index];
      })
      .join("");

    return `${sparkline} (${min.toFixed(0)}-${max.toFixed(0)}ms)`;
  }

  /**
   * Format helpers
   */
  private formatSection(title: string): string {
    return this.options.colorOutput ? chalk.yellow(title) : title;
  }

  private formatLatency(ms: number): string {
    const formatted = `${ms.toFixed(0)}ms`;
    if (!this.options.colorOutput) return formatted;

    if (ms < 100) return chalk.green(formatted);
    if (ms < 1000) return chalk.yellow(formatted);
    return chalk.red(formatted);
  }

  private formatPercent(percent: number): string {
    const formatted = `${percent.toFixed(1)}%`;
    if (!this.options.colorOutput) return formatted;

    if (percent > 50) return chalk.green(formatted);
    if (percent > 20) return chalk.yellow(formatted);
    return chalk.gray(formatted);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  private formatSeparator(): string {
    return "─".repeat(50);
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): DashboardMetrics {
    return {
      latency: this.getLatencies(),
      hitRates: this.getHitRates(),
      streaming: this.getStreamingStats(),
      volume: this.getVolumeStats(),
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.generationMetrics = [];
  }
}
