/**
 * Dashboard Service
 * Provides API endpoints and real-time monitoring for telemetry data
 */

import { TelemetryCollector } from "./telemetry-collector";
import { AlertManager } from "./alert-manager";
import type {
  DashboardData,
  AggregatedMetrics,
  SystemStatus,
  ProviderStatus,
} from "./telemetry-types";
import { AIProviderFactory } from "../providers/provider-factory";

export class DashboardService {
  private static instance: DashboardService;
  private telemetry: TelemetryCollector;
  private alertManager: AlertManager;
  private providerFactory: AIProviderFactory;
  private startTime: number;

  private constructor() {
    this.telemetry = TelemetryCollector.getInstance();
    this.alertManager = AlertManager.getInstance();
    this.providerFactory = AIProviderFactory.getInstance();
    this.startTime = Date.now();
  }

  static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  /**
   * Get complete dashboard data
   */
  getDashboardData(): DashboardData {
    const currentMetrics =
      this.telemetry.getCurrentMetrics() || this.getEmptyMetrics();
    const historicalMetrics = this.telemetry.getHistoricalMetrics("hour", 24);
    const alerts = this.alertManager.getActiveAlerts();
    const systemStatus = this.getSystemStatus();

    // Check for alerts based on current metrics
    this.checkMetricAlerts(currentMetrics);

    return {
      currentMetrics,
      historicalMetrics,
      alerts,
      systemStatus,
    };
  }

  /**
   * Get system status
   */
  private getSystemStatus(): SystemStatus {
    const providers = this.providerFactory.getAvailableProviders();
    const providerStatuses: Record<string, ProviderStatus> = {};

    providers.forEach((providerType) => {
      const provider = this.providerFactory.getProvider(providerType);
      if (provider) {
        providerStatuses[providerType] = {
          available: provider.isAvailable(),
          latency: 0, // Would need to track this
          errorRate: 0, // Would need to track this
          lastCheck: Date.now(),
        };
      }
    });

    return {
      healthy: providers.length > 0,
      providers: providerStatuses,
      uptime: Date.now() - this.startTime,
      lastError: undefined,
      lastErrorTime: undefined,
    };
  }

  /**
   * Check metrics and create alerts if needed
   */
  private checkMetricAlerts(metrics: AggregatedMetrics): void {
    // High latency alert
    if (metrics.p95Latency > 2000) {
      this.alertManager.createAlert({
        type: "high_latency",
        severity: "warning",
        message: `P95 latency is ${Math.round(metrics.p95Latency)}ms (threshold: 2000ms)`,
      });
    }

    // High error rate alert
    if (metrics.errorRate > 0.1) {
      this.alertManager.createAlert({
        type: "high_error_rate",
        severity: "error",
        message: `Error rate is ${Math.round(metrics.errorRate * 100)}% (threshold: 10%)`,
      });
    }

    // Low satisfaction alert
    if (metrics.feedbackCount > 10 && metrics.satisfactionRate < 0.7) {
      this.alertManager.createAlert({
        type: "low_satisfaction",
        severity: "warning",
        message: `Satisfaction rate is ${Math.round(metrics.satisfactionRate * 100)}% (threshold: 70%)`,
      });
    }

    // High fallback rate alert
    if (metrics.fallbackRate > 0.3) {
      this.alertManager.createAlert({
        type: "provider_failure",
        severity: "warning",
        message: `Fallback rate is ${Math.round(metrics.fallbackRate * 100)}% (threshold: 30%)`,
      });
    }
  }

  /**
   * Get metrics summary for CLI display
   */
  getMetricsSummary(): string {
    const data = this.getDashboardData();
    const metrics = data.currentMetrics;
    const status = data.systemStatus;

    const lines = [
      "📊 AI Response Dashboard",
      "========================",
      "",
      "🎯 Intent Analysis",
      `  Total: ${Object.values(metrics.intentCounts).reduce((a, b) => a + b, 0)} requests`,
      `  Distribution: ${JSON.stringify(metrics.intentCounts)}`,
      `  Languages: ${JSON.stringify(metrics.languageDistribution)}`,
      "",
      "⚡ Performance",
      `  Responses: ${metrics.totalResponses}`,
      `  Avg Latency: ${Math.round(metrics.averageLatency)}ms`,
      `  P95 Latency: ${Math.round(metrics.p95Latency)}ms`,
      `  P99 Latency: ${Math.round(metrics.p99Latency)}ms`,
      "",
      "🔄 Providers",
      `  Distribution: ${JSON.stringify(metrics.providerDistribution)}`,
      `  Fallback Rate: ${Math.round(metrics.fallbackRate * 100)}%`,
      `  Error Rate: ${Math.round(metrics.errorRate * 100)}%`,
      "",
      "💰 Token Usage",
      `  Total: ${metrics.totalTokens}`,
      `  Avg/Request: ${Math.round(metrics.averageTokensPerRequest)}`,
      "",
      "😊 User Satisfaction",
      `  Rate: ${Math.round(metrics.satisfactionRate * 100)}%`,
      `  Feedback Count: ${metrics.feedbackCount}`,
      `  Distribution: ${JSON.stringify(metrics.feedbackDistribution)}`,
      "",
      "🛡️ Safety",
      `  Violations: ${metrics.safetyViolations}`,
      `  Types: ${JSON.stringify(metrics.violationTypes)}`,
      "",
      "💚 System Status",
      `  Health: ${status.healthy ? "✓ Healthy" : "✗ Unhealthy"}`,
      `  Uptime: ${Math.round(status.uptime / 1000 / 60)}min`,
      `  Active Providers: ${Object.keys(status.providers)
        .filter((p) => status.providers[p].available)
        .join(", ")}`,
      "",
    ];

    // Add alerts if any
    if (data.alerts.length > 0) {
      lines.push("⚠️ Active Alerts");
      data.alerts.forEach((alert) => {
        const icon =
          alert.severity === "critical"
            ? "🔴"
            : alert.severity === "error"
              ? "🟠"
              : alert.severity === "warning"
                ? "🟡"
                : "ℹ️";
        lines.push(`  ${icon} ${alert.message}`);
      });
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Get metrics for specific period
   */
  getMetricsByPeriod(
    period: "minute" | "hour" | "day",
    count: number = 10,
  ): AggregatedMetrics[] {
    return this.telemetry.getHistoricalMetrics(period, count);
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    const data = this.getDashboardData();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Get empty metrics object
   */
  private getEmptyMetrics(): AggregatedMetrics {
    return {
      period: "minute",
      startTime: Date.now() - 60000,
      endTime: Date.now(),
      intentCounts: Record<string, any>,
      intentAccuracy: 0,
      languageDistribution: Record<string, any>,
      totalResponses: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      providerDistribution: Record<string, any>,
      fallbackRate: 0,
      errorRate: 0,
      totalTokens: 0,
      averageTokensPerRequest: 0,
      safetyViolations: 0,
      violationTypes: Record<string, any>,
      satisfactionRate: 0,
      feedbackCount: 0,
      feedbackDistribution: Record<string, any>,
    };
  }

  /**
   * Reset all metrics (for testing)
   */
  resetMetrics(): void {
    this.alertManager.clearAlerts();
    // Telemetry collector would need a reset method
    console.log("[Dashboard] Metrics reset");
  }
}
