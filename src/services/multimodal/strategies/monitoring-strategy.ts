import { EventEmitter } from "node:events";

export interface SystemHealth {
  overall: HealthStatus;
  components: {
    queue: ComponentHealth;
    engine: ComponentHealth;
    storage: ComponentHealth;
    network: ComponentHealth;
    memory: ComponentHealth;
  };
  timestamp: Date;
}

export interface ComponentHealth {
  status: HealthStatus;
  metrics: {
    availability: number; // 0-1
    responseTime: number; // ms
    errorRate: number; // 0-1
    throughput: number; // ops/sec
  };
  details: {
    lastCheck: Date;
    consecutiveFailures: number;
    lastFailure?: Date;
    customMetrics?: Record<string, unknown>;
  };
}

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface HealthThresholds {
  availability: { degraded: number; unhealthy: number }; // e.g., { degraded: 0.95, unhealthy: 0.90 }
  responseTime: { degraded: number; unhealthy: number }; // e.g., { degraded: 1000, unhealthy: 5000 }
  errorRate: { degraded: number; unhealthy: number }; // e.g., { degraded: 0.05, unhealthy: 0.10 }
  throughput: { degraded: number; unhealthy: number }; // e.g., { degraded: 10, unhealthy: 5 }
}

export interface MonitoringAlert {
  id: string;
  level: "info" | "warning" | "error" | "critical";
  component: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: Date;
  resolved?: Date;
}

export interface MonitoringStrategyOptions {
  checkInterval: number; // ms
  alertThresholds: HealthThresholds;
  retentionHours: number;
  enablePredictiveAlerts: boolean;
  alertCooldown: number; // ms
}

export class MonitoringStrategy extends EventEmitter {
  private readonly _options: MonitoringStrategyOptions;
  private readonly _healthHistory = new Map<string, ComponentHealth[]>();
  private readonly _activeAlerts = new Map<string, MonitoringAlert>();
  private readonly _alertHistory: MonitoringAlert[] = [];
  private _monitoringInterval?: NodeJS.Timeout;
  private _isMonitoring = false;

  constructor(options: Partial<MonitoringStrategyOptions> = {}) {
    super();

    this._options = {
      checkInterval: 30000, // 30 seconds
      alertThresholds: {
        availability: { degraded: 0.95, unhealthy: 0.9 },
        responseTime: { degraded: 1000, unhealthy: 5000 },
        errorRate: { degraded: 0.05, unhealthy: 0.1 },
        throughput: { degraded: 10, unhealthy: 5 },
      },
      retentionHours: 24,
      enablePredictiveAlerts: true,
      alertCooldown: 300000, // 5 minutes
      ...options,
    };
  }

  startMonitoring(): void {
    if (this._isMonitoring) return;

    this._isMonitoring = true;
    this._monitoringInterval = setInterval(() => {
      this._performHealthCheck().catch((error) => {
        this.emit("monitoring_error", error);
      });
    }, this._options.checkInterval);

    this.emit("monitoring_started");
  }

  stopMonitoring(): void {
    if (!this._isMonitoring) return;

    this._isMonitoring = false;
    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval);
      this._monitoringInterval = undefined;
    }

    this.emit("monitoring_stopped");
  }

  async getCurrentHealth(): Promise<SystemHealth> {
    const components = {
      queue: await this._checkQueueHealth(),
      engine: await this._checkEngineHealth(),
      storage: await this._checkStorageHealth(),
      network: await this._checkNetworkHealth(),
      memory: await this._checkMemoryHealth(),
    };

    const overallStatus = this._calculateOverallHealth(components);

    const health: SystemHealth = {
      overall: overallStatus,
      components,
      timestamp: new Date(),
    };

    // Store in history
    this._storeHealthHistory(health);

    return health;
  }

  getHealthHistory(component?: string, hours: number = 1): ComponentHealth[] {
    if (component) {
      return (
        this._healthHistory.get(component)?.slice(-Math.ceil(hours * 120)) || []
      );
    }

    // Return combined history for all components
    const allHistory: ComponentHealth[] = [];
    for (const history of this._healthHistory.values()) {
      allHistory.push(...history.slice(-Math.ceil(hours * 120)));
    }

    return allHistory.sort(
      (a, b) => a.details.lastCheck.getTime() - b.details.lastCheck.getTime(),
    );
  }

  getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this._activeAlerts.values());
  }

  getAlertHistory(hours: number = 24): MonitoringAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this._alertHistory.filter((alert) => alert.timestamp >= cutoff);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this._activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = new Date();
      this._activeAlerts.delete(alertId);
      this.emit("alert_acknowledged", alert);
      return true;
    }
    return false;
  }

  getMonitoringStats(): {
    uptime: number;
    totalAlerts: number;
    criticalAlerts: number;
    avgResponseTime: number;
    systemReliability: number;
  } {
    const totalAlerts = this._alertHistory.length;
    const criticalAlerts = this._alertHistory.filter(
      (a) => a.level === "critical",
    ).length;

    // Calculate average response time from recent history
    const recentHealths = this.getHealthHistory(undefined, 1);
    const avgResponseTime =
      recentHealths.length > 0
        ? recentHealths.reduce((sum, h) => sum + h.metrics.responseTime, 0) /
          recentHealths.length
        : 0;

    // Calculate system reliability (availability over last 24 hours)
    const dayHistory = this.getHealthHistory(undefined, 24);
    const systemReliability =
      dayHistory.length > 0
        ? dayHistory.reduce((sum, h) => sum + h.metrics.availability, 0) /
          dayHistory.length
        : 1;

    return {
      uptime: this._isMonitoring
        ? Date.now() - (this._monitoringInterval ? 0 : Date.now())
        : 0,
      totalAlerts,
      criticalAlerts,
      avgResponseTime,
      systemReliability,
    };
  }

  private async _performHealthCheck(): Promise<void> {
    try {
      const health = await this.getCurrentHealth();

      // Check for alerts
      await this._checkForAlerts(health);

      // Predictive alerting
      if (this._options.enablePredictiveAlerts) {
        await this._checkPredictiveAlerts(health);
      }

      this.emit("health_check_completed", health);
    } catch (error) {
      this.emit("health_check_error", error);
    }
  }

  private async _checkQueueHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Simulate queue health check
      // In real implementation, this would check actual queue metrics
      const metrics = {
        availability: 0.99,
        responseTime: Date.now() - startTime,
        errorRate: 0.01,
        throughput: 50,
      };

      return {
        status: this._determineHealthStatus("queue", metrics),
        metrics,
        details: {
          lastCheck: new Date(),
          consecutiveFailures: 0,
          customMetrics: {
            queueSize: 12,
            avgWaitTime: 45,
          },
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        metrics: {
          availability: 0,
          responseTime: Date.now() - startTime,
          errorRate: 1,
          throughput: 0,
        },
        details: {
          lastCheck: new Date(),
          consecutiveFailures: 1,
          lastFailure: new Date(),
          customMetrics: { error: String(error) },
        },
      };
    }
  }

  private async _checkEngineHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const metrics = {
        availability: 0.98,
        responseTime: Date.now() - startTime,
        errorRate: 0.02,
        throughput: 35,
      };

      return {
        status: this._determineHealthStatus("engine", metrics),
        metrics,
        details: {
          lastCheck: new Date(),
          consecutiveFailures: 0,
          customMetrics: {
            activeOperations: 5,
            completedOperations: 1247,
          },
        },
      };
    } catch (error) {
      return this._createUnhealthyComponent("engine", startTime, error);
    }
  }

  private async _checkStorageHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const metrics = {
        availability: 1.0,
        responseTime: Date.now() - startTime,
        errorRate: 0,
        throughput: 100,
      };

      return {
        status: this._determineHealthStatus("storage", metrics),
        metrics,
        details: {
          lastCheck: new Date(),
          consecutiveFailures: 0,
          customMetrics: {
            diskUsage: "45%",
            lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          },
        },
      };
    } catch (error) {
      return this._createUnhealthyComponent("storage", startTime, error);
    }
  }

  private async _checkNetworkHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Simulate network latency check
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));

      const metrics = {
        availability: 0.997,
        responseTime: Date.now() - startTime,
        errorRate: 0.003,
        throughput: 200,
      };

      return {
        status: this._determineHealthStatus("network", metrics),
        metrics,
        details: {
          lastCheck: new Date(),
          consecutiveFailures: 0,
          customMetrics: {
            bandwidth: "100 Mbps",
            packetLoss: "0.1%",
          },
        },
      };
    } catch (error) {
      return this._createUnhealthyComponent("network", startTime, error);
    }
  }

  private async _checkMemoryHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      const memUsage = process.memoryUsage();
      const metrics = {
        availability: 1.0,
        responseTime: Date.now() - startTime,
        errorRate: 0,
        throughput: 1000, // Operations per second
      };

      return {
        status: this._determineHealthStatus("memory", metrics),
        metrics,
        details: {
          lastCheck: new Date(),
          consecutiveFailures: 0,
          customMetrics: {
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
          },
        },
      };
    } catch (error) {
      return this._createUnhealthyComponent("memory", startTime, error);
    }
  }

  private _createUnhealthyComponent(
    component: string,
    startTime: number,
    error: unknown,
  ): ComponentHealth {
    return {
      status: "unhealthy",
      metrics: {
        availability: 0,
        responseTime: Date.now() - startTime,
        errorRate: 1,
        throughput: 0,
      },
      details: {
        lastCheck: new Date(),
        consecutiveFailures: 1,
        lastFailure: new Date(),
        customMetrics: { error: String(error) },
      },
    };
  }

  private _determineHealthStatus(
    component: string,
    metrics: ComponentHealth["metrics"],
  ): HealthStatus {
    const thresholds = this._options.alertThresholds;

    // Check availability
    if (metrics.availability < thresholds.availability.unhealthy)
      return "unhealthy";
    if (metrics.availability < thresholds.availability.degraded)
      return "degraded";

    // Check response time
    if (metrics.responseTime > thresholds.responseTime.unhealthy)
      return "unhealthy";
    if (metrics.responseTime > thresholds.responseTime.degraded)
      return "degraded";

    // Check error rate
    if (metrics.errorRate > thresholds.errorRate.unhealthy) return "unhealthy";
    if (metrics.errorRate > thresholds.errorRate.degraded) return "degraded";

    // Check throughput
    if (metrics.throughput < thresholds.throughput.unhealthy)
      return "unhealthy";
    if (metrics.throughput < thresholds.throughput.degraded) return "degraded";

    return "healthy";
  }

  private _calculateOverallHealth(
    components: SystemHealth["components"],
  ): HealthStatus {
    const statuses = Object.values(components).map((c) => c.status);

    if (statuses.some((s) => s === "unhealthy")) return "unhealthy";
    if (statuses.some((s) => s === "degraded")) return "degraded";
    if (statuses.some((s) => s === "unknown")) return "unknown";

    return "healthy";
  }

  private _storeHealthHistory(health: SystemHealth): void {
    for (const [component, componentHealth] of Object.entries(
      health.components,
    )) {
      const history = this._healthHistory.get(component) || [];
      history.push(componentHealth);

      // Maintain retention limit
      const maxEntries = Math.ceil(this._options.retentionHours * 120); // 30s intervals
      if (history.length > maxEntries) {
        history.splice(0, history.length - maxEntries);
      }

      this._healthHistory.set(component, history);
    }
  }

  private async _checkForAlerts(health: SystemHealth): Promise<void> {
    for (const [component, componentHealth] of Object.entries(
      health.components,
    )) {
      const alertId = `${component}-${componentHealth.status}`;

      if (
        componentHealth.status === "unhealthy" ||
        componentHealth.status === "degraded"
      ) {
        if (!this._activeAlerts.has(alertId)) {
          const alert: MonitoringAlert = {
            id: alertId,
            level:
              componentHealth.status === "unhealthy" ? "critical" : "warning",
            component,
            message: `Component ${component} is ${componentHealth.status}`,
            details: {
              metrics: componentHealth.metrics,
              customMetrics: componentHealth.details.customMetrics,
            },
            timestamp: new Date(),
          };

          this._activeAlerts.set(alertId, alert);
          this._alertHistory.push(alert);
          this.emit("alert_raised", alert);
        }
      } else {
        // Component is healthy, resolve any active alerts
        if (this._activeAlerts.has(alertId)) {
          const alert = this._activeAlerts.get(alertId)!;
          alert.resolved = new Date();
          this._activeAlerts.delete(alertId);
          this.emit("alert_resolved", alert);
        }
      }
    }
  }

  private async _checkPredictiveAlerts(health: SystemHealth): Promise<void> {
    // Simple predictive alerting based on trends
    for (const [component, componentHealth] of Object.entries(
      health.components,
    )) {
      const history = this._healthHistory.get(component) || [];

      if (history.length < 10) continue; // Need sufficient history

      const recentHistory = history.slice(-10);
      const trend = this._calculateTrend(recentHistory);

      // Predict if component will become unhealthy in next 30 minutes
      if (
        trend.availability < -0.01 ||
        trend.errorRate > 0.01 ||
        trend.responseTime > 100
      ) {
        const predictiveAlertId = `${component}-predictive`;

        if (!this._activeAlerts.has(predictiveAlertId)) {
          const alert: MonitoringAlert = {
            id: predictiveAlertId,
            level: "warning",
            component,
            message: `Predictive alert: ${component} showing degrading trends`,
            details: {
              trend,
              prediction: "Component may become unhealthy within 30 minutes",
            },
            timestamp: new Date(),
          };

          this._activeAlerts.set(predictiveAlertId, alert);
          this._alertHistory.push(alert);
          this.emit("predictive_alert_raised", alert);
        }
      }
    }
  }

  private _calculateTrend(history: ComponentHealth[]): {
    availability: number;
    responseTime: number;
    errorRate: number;
    throughput: number;
  } {
    if (history.length < 2) {
      return { availability: 0, responseTime: 0, errorRate: 0, throughput: 0 };
    }

    const first = history[0].metrics;
    const last = history[history.length - 1].metrics;
    const timespan = history.length;

    return {
      availability: (last.availability - first.availability) / timespan,
      responseTime: (last.responseTime - first.responseTime) / timespan,
      errorRate: (last.errorRate - first.errorRate) / timespan,
      throughput: (last.throughput - first.throughput) / timespan,
    };
  }
}
