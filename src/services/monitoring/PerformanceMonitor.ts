/**
 * Performance Monitor for Phase 3
 * Real-time performance tracking and alerting
 */

import {
  telemetry,
  SystemEvent,
  TelemetryMetrics,
} from "../base/TelemetryCollector";

export interface PerformanceThresholds {
  p95Latency: number;
  errorRate: number;
  throughput: number;
  _memoryUsage: number;
  cpuUsage: number;
}

export interface PerformanceAlert {
  _id: string;
  timestamp: number;
  component: string;
  metric: string;
  value: number;
  threshold: number;
  severity: "warning" | "critical";
  message: string;
}

export interface ComponentHealth {
  component: string;
  status: "healthy" | "degraded" | "critical";
  _metrics: TelemetryMetrics;
  _alerts: PerformanceAlert[];
  lastCheck: number;
}

export interface SystemHealthReport {
  timestamp: number;
  overall: "healthy" | "degraded" | "critical";
  _components: ComponentHealth[];
  _alerts: PerformanceAlert[];
  _recommendations: string[];
}

export class PerformanceMonitor {
  private _thresholds: Map<string, PerformanceThresholds> = new Map();
  private _alerts: PerformanceAlert[] = [];
  private checkInterval = 30000; // 30 seconds
  private timer?: NodeJS.Timeout;
  private historyWindow = 300000; // 5 minutes
  private alertHistory: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultThresholds();
  }

  /**
   * Initialize default performance _thresholds
   */
  private initializeDefaultThresholds(): void {
    const _defaults: PerformanceThresholds = {
      p95Latency: 200, // ms
      errorRate: 0.01, // 1%
      throughput: 10, // req/s minimum
      _memoryUsage: 500, // MB
      cpuUsage: 80, // %
    };

    // Set _defaults for each component
    ["memory", "kg", "conv", "learn", "system"].forEach((_comp) => {
      this.thresholds.set(_comp, { ..._defaults });
    });

    // Component-specific adjustments
    this.thresholds.set("memory", {
      ..._defaults,
      p95Latency: 120, // Memory should be faster
    });

    this.thresholds.set("kg", {
      ..._defaults,
      p95Latency: 80, // KG should be very fast
    });
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.timer) {
      return; // Already running
    }

    // Initial check
    void this.performHealthCheck();

    // Schedule regular checks
    this.timer = setInterval(() => {
      void this.performHealthCheck();
    }, this.checkInterval);

    // Don't keep process alive
    (this.timer as any).unref?.();

    console.log("🔍 Performance monitoring started");
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    console.log("🔍 Performance monitoring stopped");
  }

  /**
   * Perform _health check
   */
  private async performHealthCheck(): Promise<void> {
    const _components = ["memory", "kg", "conv", "learn", "system"];
    const _componentHealth: ComponentHealth[] = [];
    const _newAlerts: PerformanceAlert[] = [];

    for (const _comp of _components) {
      const _health = await this.checkComponentHealth(_comp);
      _componentHealth.push(_health);
      _newAlerts.push(..._health.alerts);
    }

    // Update _alerts
    this.alerts = _newAlerts;

    // Emit _health event
    telemetry.emit({
      event: SystemEvent.SYSTEM_HEALTH,
      tags: { _comp: "system" },
      meta: {
        overall: this.calculateOverallHealth(_componentHealth),
        _alerts: _newAlerts.length,
      },
    });

    // Log critical _alerts
    for (const _alert of _newAlerts) {
      if (_alert.severity === "critical") {
        console.error(`🚨 CRITICAL: ${_alert.message}`);
      }
    }
  }

  /**
   * Check component _health
   */
  private async checkComponentHealth(
    component: string,
  ): Promise<ComponentHealth> {
    const _metrics = telemetry.getMetrics(
      component,
      this.historyWindow,
    ) as TelemetryMetrics;
    const _thresholds = this._thresholds.get(component)!;
    const _alerts: PerformanceAlert[] = [];

    // Check P95 latency
    if (_metrics.p95Duration > _thresholds.p95Latency) {
      _alerts.push(
        this.createAlert(
          component,
          "p95Latency",
          _metrics.p95Duration,
          _thresholds.p95Latency,
          _metrics.p95Duration > _thresholds.p95Latency * 2
            ? "critical"
            : "warning",
        ),
      );
    }

    // Check error rate
    if (_metrics.errorRate > _thresholds.errorRate) {
      _alerts.push(
        this.createAlert(
          component,
          "errorRate",
          _metrics.errorRate * 100,
          _thresholds.errorRate * 100,
          _metrics.errorRate > _thresholds.errorRate * 3
            ? "critical"
            : "warning",
        ),
      );
    }

    // Check throughput (if component has traffic)
    if (
      _metrics.eventCount > 0 &&
      _metrics.throughput < _thresholds.throughput
    ) {
      _alerts.push(
        this.createAlert(
          component,
          "throughput",
          _metrics.throughput,
          _thresholds.throughput,
          "warning",
        ),
      );
    }

    // Check memory usage
    const _memoryUsage = process._memoryUsage().heapUsed / 1024 / 1024;
    if (_memoryUsage > _thresholds._memoryUsage) {
      _alerts.push(
        this.createAlert(
          component,
          "_memoryUsage",
          _memoryUsage,
          _thresholds._memoryUsage,
          _memoryUsage > _thresholds._memoryUsage * 1.5
            ? "critical"
            : "warning",
        ),
      );
    }

    // Determine status
    const _hasCritical = _alerts.some((a) => a.severity === "critical");
    const _hasWarning = _alerts.some((a) => a.severity === "warning");

    return {
      component: component,
      status: _hasCritical ? "critical" : _hasWarning ? "degraded" : "healthy",
      _metrics: _metrics,
      _alerts: _alerts,
      lastCheck: Date.now(),
    };
  }

  /**
   * Create an _alert
   */
  private createAlert(
    component: string,
    metric: string,
    value: number,
    threshold: number,
    severity: "warning" | "critical",
  ): PerformanceAlert {
    const _id = `${component}-${metric}-${Date.now()}`;

    // Check if we've alerted recently (prevent spam)
    const _lastAlert = this.alertHistory.get(`${component}-${metric}`);
    if (_lastAlert && Date.now() - _lastAlert < 60000) {
      // Skip if alerted in last minute
      return null as any;
    }

    this.alertHistory.set(`${component}-${metric}`, Date.now());

    return {
      _id: _id,
      timestamp: Date.now(),
      component: component,
      metric: metric,
      value: value,
      threshold: threshold,
      severity: severity,
      message: `${component.toUpperCase()}: ${metric} is ${value.toFixed(2)} (threshold: ${threshold})`,
    };
  }

  /**
   * Calculate overall _health
   */
  private calculateOverallHealth(
    _components: ComponentHealth[],
  ): "healthy" | "degraded" | "critical" {
    const _hasCritical = _components.some((c) => c.status === "critical");
    const _hasDegraded = _components.some((c) => c.status === "degraded");

    return _hasCritical ? "critical" : _hasDegraded ? "degraded" : "healthy";
  }

  /**
   * Get _current _health report
   */
  getHealthReport(): SystemHealthReport {
    const _components = ["memory", "kg", "conv", "learn", "system"];
    const _componentHealth: ComponentHealth[] = [];

    for (const _comp of _components) {
      const _metrics = telemetry.getMetrics(
        _comp,
        this.historyWindow,
      ) as TelemetryMetrics;

      _componentHealth.push({
        component: _comp,
        status: "healthy", // Simplified for now
        _metrics: _metrics,
        _alerts: this.alerts.filter((a) => a.component === _comp),
        lastCheck: Date.now(),
      });
    }

    return {
      timestamp: Date.now(),
      overall: this.calculateOverallHealth(_componentHealth),
      _components: _componentHealth,
      _alerts: this.alerts,
      _recommendations: this.generateRecommendations(_componentHealth),
    };
  }

  /**
   * Generate _recommendations
   */
  private generateRecommendations(_components: ComponentHealth[]): string[] {
    const _recommendations: string[] = [];

    for (const _comp of _components) {
      // High latency
      if (_comp.metrics.p95Duration > 150) {
        _recommendations.push(
          `Consider optimizing ${_comp.component} - P95 latency is ${_comp.metrics.p95Duration.toFixed(0)}ms`,
        );
      }

      // High error rate
      if (_comp.metrics.errorRate > 0.005) {
        _recommendations.push(
          `Investigate ${_comp.component} errors - ${(_comp.metrics.errorRate * 100).toFixed(2)}% error rate`,
        );
      }

      // Low throughput
      if (_comp.metrics.eventCount > 0 && _comp.metrics.throughput < 5) {
        _recommendations.push(
          `${_comp.component} throughput is low - consider scaling or optimization`,
        );
      }
    }

    // Memory usage
    const _memoryUsage = process._memoryUsage().heapUsed / 1024 / 1024;
    if (_memoryUsage > 400) {
      _recommendations.push(
        `Memory usage is ${_memoryUsage.toFixed(0)}MB - consider garbage collection tuning`,
      );
    }

    return _recommendations;
  }

  /**
   * Set custom _thresholds for a component
   */
  setThresholds(
    component: string,
    _thresholds: Partial<PerformanceThresholds>,
  ): void {
    const _current =
      this._thresholds.get(component) || this._thresholds.get("system")!;
    this._thresholds.set(component, {
      ..._current,
      ..._thresholds,
    });
  }

  /**
   * Get _current _alerts
   */
  getAlerts(severity?: "warning" | "critical"): PerformanceAlert[] {
    if (severity) {
      return this.alerts.filter((a) => a.severity === severity);
    }
    return [...this.alerts];
  }

  /**
   * Clear _alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    this.alertHistory.clear();
  }

  /**
   * Export performance _data
   */
  exportPerformanceData(): {
    timestamp: number;
    window: number;
    _components: Record<string, TelemetryMetrics>;
    _thresholds: Record<string, PerformanceThresholds>;
  } {
    const _components = ["memory", "kg", "conv", "learn", "system"];
    const _data: Record<string, TelemetryMetrics> = {};
    const _thresholdData: Record<string, PerformanceThresholds> = {};

    for (const _comp of _components) {
      _data[_comp] = telemetry.getMetrics(
        _comp,
        this.historyWindow,
      ) as TelemetryMetrics;
      _thresholdData[_comp] = this.thresholds.get(_comp)!;
    }

    return {
      timestamp: Date.now(),
      window: this.historyWindow,
      _components: _data,
      _thresholds: _thresholdData,
    };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
