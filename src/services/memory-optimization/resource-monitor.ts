/**
 * Resource Monitor - Phase 4.1 Memory Optimization
 *
 * Monitors system resources (memory, CPU) and records _metrics for performance analysis.
 * Helps identify memory leaks and optimize resource _usage patterns.
 */

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import chalk from "chalk";

export interface ResourceMetric {
  ts: string;
  rss: number; // Resident Set Size in MB
  heapUsed: number; // Used heap memory in MB
  heapTotal: number; // Total heap memory in MB
  external: number; // External memory in MB
  arrayBuffers: number; // Array buffer memory in MB
  uptime: number; // Process uptime in seconds
}

export interface ResourceAlert {
  type: "memory" | "heap" | "external";
  severity: "warning" | "critical";
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export interface ResourceThresholds {
  memoryWarningMB: number;
  memoryCriticalMB: number;
  heapWarningMB: number;
  heapCriticalMB: number;
  externalWarningMB: number;
  externalCriticalMB: number;
}

export class ResourceMonitor {
  private interval?: NodeJS.Timeout;
  private metricsFile: string;
  private alertsFile: string;
  private startTime: number;
  private alertCallbacks: ((_alert: ResourceAlert) => void)[] = [];

  private thresholds: ResourceThresholds = {
    memoryWarningMB: 150, // Phase 4.1 target: <150MB _baseline
    memoryCriticalMB: 200,
    heapWarningMB: 100,
    heapCriticalMB: 150,
    externalWarningMB: 50,
    externalCriticalMB: 75,
  };

  constructor(outputDir = "artifacts/phase41") {
    this.metricsFile = path.join(outputDir, "mem.jsonl");
    this.alertsFile = path.join(outputDir, "mem-alerts.jsonl");
    this.startTime = performance.now();

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(this.metricsFile), { recursive: true });
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMs = 5000): void {
    if (this.interval) {
      console.warn(chalk.yellow("⚠️ Resource monitoring already active"));
      return;
    }

    console.log(
      chalk.blue(`📊 Starting resource monitoring (interval: ${intervalMs}ms)`),
    );

    // Record initial _baseline
    this.recordMetric();

    this.interval = setInterval(() => {
      this.recordMetric();
    }, intervalMs);

    // Handle graceful shutdown
    process.on("exit", () => this.stopMonitoring());
    process.on("SIGINT", () => this.stopMonitoring());
    process.on("SIGTERM", () => this.stopMonitoring());
  }

  /**
   * Stop monitoring and cleanup
   */
  stopMonitoring(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
      console.log(chalk.gray("📊 Resource monitoring stopped"));
    }
  }

  /**
   * Record _current resource _usage
   */
  recordMetric(): ResourceMetric {
    const _usage = process.memoryUsage();
    const _currentTime = performance.now();

    const metric: ResourceMetric = {
      ts: new Date().toISOString(),
      rss: Math.round(_usage.rss / 1024 / 1024), // Convert to MB
      heapUsed: Math.round(_usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(_usage.heapTotal / 1024 / 1024),
      external: Math.round(_usage.external / 1024 / 1024),
      arrayBuffers: Math.round(_usage.arrayBuffers / 1024 / 1024),
      uptime: Math.round((_currentTime - this.startTime) / 1000), // Convert to seconds
    };

    // Write metric to file
    try {
      fs.appendFileSync(this.metricsFile, JSON.stringify(metric) + "\n");
    } catch (error) {
      console.error(chalk.red("❌ Failed to write memory metric:"), error);
    }

    // Check for _alerts
    this.checkThresholds(metric);

    return metric;
  }

  /**
   * Check resource thresholds and generate _alerts
   */
  private checkThresholds(metric: ResourceMetric): void {
    const _alerts: ResourceAlert[] = [];

    // Memory (RSS) checks
    if (metric.rss >= this.thresholds.memoryCriticalMB) {
      alerts.push({
        type: "memory",
        severity: "critical",
        message: `Critical memory _usage: ${metric.rss}MB (threshold: ${this.thresholds.memoryCriticalMB}MB)`,
        value: metric.rss,
        threshold: this.thresholds.memoryCriticalMB,
        timestamp: metric.ts,
      });
    } else if (metric.rss >= this.thresholds.memoryWarningMB) {
      alerts.push({
        type: "memory",
        severity: "warning",
        message: `High memory _usage: ${metric.rss}MB (threshold: ${this.thresholds.memoryWarningMB}MB)`,
        value: metric.rss,
        threshold: this.thresholds.memoryWarningMB,
        timestamp: metric.ts,
      });
    }

    // Heap checks
    if (metric.heapUsed >= this.thresholds.heapCriticalMB) {
      alerts.push({
        type: "heap",
        severity: "critical",
        message: `Critical heap _usage: ${metric.heapUsed}MB (threshold: ${this.thresholds.heapCriticalMB}MB)`,
        value: metric.heapUsed,
        threshold: this.thresholds.heapCriticalMB,
        timestamp: metric.ts,
      });
    } else if (metric.heapUsed >= this.thresholds.heapWarningMB) {
      alerts.push({
        type: "heap",
        severity: "warning",
        message: `High heap _usage: ${metric.heapUsed}MB (threshold: ${this.thresholds.heapWarningMB}MB)`,
        value: metric.heapUsed,
        threshold: this.thresholds.heapWarningMB,
        timestamp: metric.ts,
      });
    }

    // External memory checks
    if (metric.external >= this.thresholds.externalCriticalMB) {
      alerts.push({
        type: "external",
        severity: "critical",
        message: `Critical external memory: ${metric.external}MB (threshold: ${this.thresholds.externalCriticalMB}MB)`,
        value: metric.external,
        threshold: this.thresholds.externalCriticalMB,
        timestamp: metric.ts,
      });
    } else if (metric.external >= this.thresholds.externalWarningMB) {
      alerts.push({
        type: "external",
        severity: "warning",
        message: `High external memory: ${metric.external}MB (threshold: ${this.thresholds.externalWarningMB}MB)`,
        value: metric.external,
        threshold: this.thresholds.externalWarningMB,
        timestamp: metric.ts,
      });
    }

    // Process _alerts
    for (const alert of _alerts) {
      this.handleAlert(_alert);
    }
  }

  /**
   * Handle resource alert
   */
  private handleAlert(alert: ResourceAlert): void {
    // Log alert
    const _color = _alert.severity === "critical" ? chalk.red : chalk.yellow;
    console.warn(_color(`🚨 Resource Alert: ${_alert.message}`));

    // Write alert to file
    try {
      fs.appendFileSync(this.alertsFile, JSON.stringify(_alert) + "\n");
    } catch (innerError) {
      console.error(chalk.red("❌ Failed to write alert:"), error);
    }

    // Notify callbacks
    this.alertCallbacks.forEach((callback) => {
      try {
        callback(_alert);
      } catch (error) {
        console.error(chalk.red("❌ Alert callback failed:"), error);
      }
    });
  }

  /**
   * Subscribe to resource _alerts
   */
  onAlert(_callback: (alert: ResourceAlert) => void): void {
    this.alertCallbacks.push(_callback);
  }

  /**
   * Update resource thresholds
   */
  setThresholds(newThresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log(chalk.blue("📊 Resource thresholds updated:"), this.thresholds);
  }

  /**
   * Get _current resource _usage
   */
  getCurrentUsage(): ResourceMetric {
    return this.recordMetric();
  }

  /**
   * Read all recorded _metrics from file
   */
  readMetrics(): ResourceMetric[] {
    if (!fs.existsSync(this.metricsFile)) {
      return [];
    }

    try {
      const _content = fs.readFileSync(this.metricsFile, "utf-8").trim();
      if (!_content) return [];

      return _content.split("\n").map((line) => JSON.parse(line));
    } catch (innerError) {
      console.error(chalk.red("❌ Failed to read _metrics:"), error);
      return [];
    }
  }

  /**
   * Read all _alerts from file
   */
  readAlerts(): ResourceAlert[] {
    if (!fs.existsSync(this.alertsFile)) {
      return [];
    }

    try {
      const _content = fs.readFileSync(this.alertsFile, "utf-8").trim();
      if (!_content) return [];

      return _content.split("\n").map((line) => JSON.parse(line));
    } catch (error) {
      console.error(chalk.red("❌ Failed to read _alerts:"), error);
      return [];
    }
  }

  /**
   * Generate performance summary
   */
  generateSummary(): {
    baselineUsage: { rss: number; heapUsed: number; external: number };
    currentUsage: { rss: number; heapUsed: number; external: number };
    peakUsage: { rss: number; heapUsed: number; external: number };
    averageUsage: { rss: number; heapUsed: number; external: number };
    totalAlerts: number;
    criticalAlerts: number;
    uptimeSeconds: number;
  } {
    const _metrics = this.readMetrics();
    const _alerts = this.readAlerts();
    const _current = this.getCurrentUsage();

    if (_metrics.length === 0) {
      return {
        baselineUsage: {
          rss: _current.rss,
          heapUsed: _current.heapUsed,
          external: _current.external,
        },
        currentUsage: {
          rss: _current.rss,
          heapUsed: _current.heapUsed,
          external: _current.external,
        },
        peakUsage: {
          rss: _current.rss,
          heapUsed: _current.heapUsed,
          external: _current.external,
        },
        averageUsage: {
          rss: _current.rss,
          heapUsed: _current.heapUsed,
          external: _current.external,
        },
        totalAlerts: _alerts.length,
        criticalAlerts: _alerts.filter((a) => a.severity === "critical").length,
        uptimeSeconds: _current.uptime,
      };
    }

    const _baseline = _metrics[0];
    const _peakRss = Math.max(..._metrics.map((m) => m.rss));
    const _peakHeap = Math.max(..._metrics.map((m) => m.heapUsed));
    const _peakExternal = Math.max(..._metrics.map((m) => m.external));

    const _avgRss = Math.round(
      _metrics.reduce((sum, m) => sum + m.rss, 0) / _metrics.length,
    );
    const _avgHeap = Math.round(
      _metrics.reduce((sum, m) => sum + m.heapUsed, 0) / _metrics.length,
    );
    const _avgExternal = Math.round(
      _metrics.reduce((sum, m) => sum + m.external, 0) / _metrics.length,
    );

    return {
      baselineUsage: {
        rss: _baseline.rss,
        heapUsed: _baseline.heapUsed,
        external: _baseline.external,
      },
      currentUsage: {
        rss: _current.rss,
        heapUsed: _current.heapUsed,
        external: _current.external,
      },
      peakUsage: {
        rss: _peakRss,
        heapUsed: _peakHeap,
        external: _peakExternal,
      },
      averageUsage: {
        rss: _avgRss,
        heapUsed: _avgHeap,
        external: _avgExternal,
      },
      totalAlerts: _alerts.length,
      criticalAlerts: _alerts.filter((a) => a.severity === "critical").length,
      uptimeSeconds: _current.uptime,
    };
  }

  /**
   * Trigger garbage collection (for testing/debugging)
   */
  forceGarbageCollection(): boolean {
    if (global.gc) {
      console.log(chalk.gray("♻️ Forcing garbage collection..."));
      global.gc();
      return true;
    } else {
      console.warn(
        chalk.yellow(
          "⚠️ Garbage collection not exposed (run with --expose-gc)",
        ),
      );
      return false;
    }
  }
}

// Singleton instance
let resourceMonitorInstance: ResourceMonitor | null = null;

export function getResourceMonitor(): ResourceMonitor {
  if (!resourceMonitorInstance) {
    resourceMonitorInstance = new ResourceMonitor();
  }
  return resourceMonitorInstance;
}
