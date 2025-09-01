import { EventEmitter } from "node:events";
import { getPrometheusExporter } from "./prometheus-exporter";
import { getAnomalyDetector } from "./anomaly-detector";
import { getPredictiveAnalytics } from "./predictive-analytics";
import { getCustomMetricsFramework } from "./custom-metrics";

export interface TelemetryIntegrationConfig {
  prometheusPort?: number;
  enableAnomalyDetection?: boolean;
  enablePredictiveAnalytics?: boolean;
  enableCustomMetrics?: boolean;
  alertWebhook?: string;
}

export class TelemetryIntegration extends EventEmitter {
  private prometheusExporter: ReturnType<typeof getPrometheusExporter>;
  private anomalyDetector: ReturnType<typeof getAnomalyDetector>;
  private predictiveAnalytics: ReturnType<typeof getPredictiveAnalytics>;
  private customMetrics: ReturnType<typeof getCustomMetricsFramework>;
  private config: TelemetryIntegrationConfig;
  private metricsBuffer: Map<string, any[]>;

  constructor(config: TelemetryIntegrationConfig = {}) {
    super();

    this.config = config;
    this.metricsBuffer = new Map();

    // Initialize components
    this.prometheusExporter = getPrometheusExporter({
      port: config.prometheusPort,
    });
    this.anomalyDetector = getAnomalyDetector();
    this.predictiveAnalytics = getPredictiveAnalytics();
    this.customMetrics = getCustomMetricsFramework();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Anomaly detection events
    if (this.config.enableAnomalyDetection) {
      this.anomalyDetector.on("anomaly", async (result) => {
        console.warn("🚨 Anomaly detected:", result);

        // Send alert if configured
        if (this.config.alertWebhook) {
          await this.sendAlert({
            type: "anomaly",
            severity: result.severity,
            metric: result.metric,
            details: result,
          });
        }

        // Record anomaly in custom metrics
        this.customMetrics.increment("maria_anomaly_detected_total", 1, {
          metric: result.metric,
          severity: result.severity,
        });

        this.emit("anomaly", result);
      });
    }

    // Predictive analytics events
    if (this.config.enablePredictiveAnalytics) {
      this.predictiveAnalytics.on("forecastGenerated", (event) => {
        console.log("📈 Forecast generated for", event.metric);

        // Record forecast accuracy
        this.predictiveAnalytics
          .evaluateAccuracy(event.metric)
          .then((accuracy) => {
            this.customMetrics.gauge(
              "maria_forecast_accuracy_mae",
              accuracy.mae,
              {
                metric: event.metric,
              },
            );
          })
          .catch(console.error);

        this.emit("forecast", event);
      });

      this.predictiveAnalytics.on("trendUpdate", (event) => {
        console.log(
          "📊 Trend update for",
          event.metric,
          ":",
          event.trend.direction,
        );

        // Record trend in custom metrics
        this.customMetrics.gauge("maria_trend_strength", event.trend.strength, {
          metric: event.metric,
          direction: event.trend.direction,
        });

        this.emit("trend", event);
      });
    }

    // Custom metrics alerts
    if (this.config.enableCustomMetrics) {
      this.customMetrics.on("alert", async (alert) => {
        console.warn("⚠️ Metric alert:", alert);

        if (this.config.alertWebhook) {
          await this.sendAlert({
            type: "metric",
            severity: alert.severity,
            metric: alert.metric,
            details: alert,
          });
        }

        this.emit("alert", alert);
      });
    }
  }

  public async recordTelemetry(data: any): Promise<void> {
    try {
      // Update Prometheus metrics
      this.prometheusExporter.updateMetrics(data);

      // Anomaly detection
      if (this.config.enableAnomalyDetection && data.latency) {
        await this.anomalyDetector.addDataPoint("response_latency", {
          timestamp: Date.now(),
          value: data.latency,
          metadata: { provider: data.provider, intent: data.intent },
        });
      }

      // Predictive analytics
      if (this.config.enablePredictiveAnalytics) {
        if (data.latency) {
          await this.predictiveAnalytics.addDataPoint("response_latency", {
            timestamp: Date.now(),
            value: data.latency,
          });
        }

        if (data.satisfaction !== undefined) {
          await this.predictiveAnalytics.addDataPoint("user_satisfaction", {
            timestamp: Date.now(),
            value: data.satisfaction,
          });
        }
      }

      // Custom metrics
      if (this.config.enableCustomMetrics) {
        if (data.command) {
          this.customMetrics.increment("maria_custom_command_usage", 1, {
            command: data.command,
            user: data.user || "anonymous",
          });
        }

        if (data.processingTime) {
          this.customMetrics.observe(
            "maria_custom_processing_time",
            data.processingTime,
            {
              operation: data.operation || "unknown",
            },
          );
        }
      }

      // Buffer for batch processing
      const metric = data.metric || "default";
      if (!this.metricsBuffer.has(metric)) {
        this.metricsBuffer.set(metric, []);
      }
      this.metricsBuffer.get(metric)!.push(data);

      this.emit("telemetryRecorded", data);
    } catch (error) {
      console.error("Error recording telemetry:", error);
      this.emit("error", error);
    }
  }

  public async generateInsights(): Promise<any> {
    const insights: any = {
      timestamp: Date.now(),
      anomalies: Record<string, any>,
      forecasts: Record<string, any>,
      trends: Record<string, any>,
      customMetrics: Record<string, any>,
    };

    // Collect anomalies
    if (this.config.enableAnomalyDetection) {
      const anomalies = await this.anomalyDetector.evaluateMetrics();
      insights.anomalies = Object.fromEntries(anomalies);
    }

    // Collect forecasts
    if (this.config.enablePredictiveAnalytics) {
      for (const metric of ["response_latency", "user_satisfaction"]) {
        try {
          const forecast =
            await this.predictiveAnalytics.generateForecast(metric);
          insights.forecasts[metric] = forecast.slice(0, 5); // Next 5 predictions
        } catch (innerError) {
          // Metric might not have enough data yet
        }

        const trend = this.predictiveAnalytics.getTrend(metric);
        if (trend) {
          insights.trends[metric] = trend;
        }
      }
    }

    // Collect custom metrics
    if (this.config.enableCustomMetrics) {
      const commandUsage = this.customMetrics.getSnapshot(
        "maria_custom_command_usage",
      );
      const processingTime = this.customMetrics.getSnapshot(
        "maria_custom_processing_time",
      );

      if (commandUsage) {
        insights.customMetrics.commandUsage = commandUsage.statistics;
      }

      if (processingTime) {
        insights.customMetrics.processingTime = processingTime.statistics;
      }
    }

    return insights;
  }

  public async start(): Promise<void> {
    console.log("🚀 Starting Telemetry Integration...");

    // Start Prometheus exporter
    await this.prometheusExporter.start();

    // Register custom metrics alerts
    if (this.config.enableCustomMetrics) {
      // High latency alert
      this.customMetrics.registerAlert({
        metric: "maria_custom_processing_time",
        condition: (value) => value > 5000,
        message: "Processing time exceeded 5 seconds",
        severity: "warning",
      });

      // Low satisfaction alert
      this.customMetrics.registerAlert({
        metric: "maria_user_satisfaction",
        condition: (value) => value < 0.7,
        message: "User satisfaction below 70%",
        severity: "error",
      });
    }

    console.log("✅ Telemetry Integration started successfully");
    this.emit("started");
  }

  private async sendAlert(alert: any): Promise<void> {
    if (!this.config.alertWebhook) return;

    try {
      const response = await fetch(this.config.alertWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 MARIA Alert: ${alert.type}`,
          attachments: [
            {
              color:
                alert.severity === "critical"
                  ? "danger"
                  : alert.severity === "error"
                    ? "warning"
                    : "good",
              fields: [
                {
                  title: "Severity",
                  value: alert.severity,
                  short: true,
                },
                {
                  title: "Metric",
                  value: alert.metric,
                  short: true,
                },
                {
                  title: "Details",
                  value: JSON.stringify(alert.details, null, 2),
                  short: false,
                },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Alert webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to send alert:", error);
    }
  }

  public exportMetrics(format: "json" | "prometheus" | "csv" = "json"): string {
    return this.customMetrics.export(format);
  }

  public async stop(): Promise<void> {
    console.log("Stopping Telemetry Integration...");

    // Cleanup resources
    this.anomalyDetector.dispose();
    this.predictiveAnalytics.dispose();
    this.customMetrics.dispose();

    this.removeAllListeners();
    console.log("Telemetry Integration stopped");
  }
}

// Create and export singleton instance
let integrationInstance: TelemetryIntegration | null = null;

export function getTelemetryIntegration(
  config?: TelemetryIntegrationConfig,
): TelemetryIntegration {
  if (!integrationInstance) {
    integrationInstance = new TelemetryIntegration(config);
  }
  return integrationInstance;
}

// Export convenient start function
export async function startTelemetry(
  config?: TelemetryIntegrationConfig,
): Promise<TelemetryIntegration> {
  const integration = getTelemetryIntegration(config);
  await integration.start();
  return integration;
}
