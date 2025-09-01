import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";
import express from "express";
import { EventEmitter } from "node:events";

export interface PrometheusConfig {
  port?: number;
  metricsPath?: string;
  defaultLabels?: Record<string, string>;
  collectDefaultMetrics?: boolean;
}

export class PrometheusExporter extends EventEmitter {
  private registry: Registry;
  private app: express.Application;
  private port: number;
  private metricsPath: string;

  // Core metrics
  private responseCounter: Counter;
  private responseHistogram: Histogram;
  private intentAccuracyGauge: Gauge;
  private satisfactionGauge: Gauge;
  private errorRateGauge: Gauge;
  private activeProvidersGauge: Gauge;
  private tokenUsageCounter: Counter;
  private fallbackRateGauge: Gauge;

  constructor(config: PrometheusConfig = {}) {
    super();

    this.registry = new Registry();
    this.port = config.port || 9090;
    this.metricsPath = config.metricsPath || "/metrics";
    this.app = express();

    // Set default labels if provided
    if (config.defaultLabels) {
      this.registry.setDefaultLabels(config.defaultLabels);
    }

    // Collect default Node.js metrics
    if (config.collectDefaultMetrics !== false) {
      collectDefaultMetrics({ register: this.registry });
    }

    this.initializeMetrics();
    this.setupRoutes();
  }

  private initializeMetrics(): void {
    // Response counter
    this.responseCounter = new Counter({
      name: "maria_ai_responses_total",
      help: "Total number of AI responses",
      labelNames: ["provider", "intent", "language", "status"],
      registers: [this.registry],
    });

    // Response time histogram
    this.responseHistogram = new Histogram({
      name: "maria_response_duration_seconds",
      help: "Response latency in seconds",
      labelNames: ["provider", "intent"],
      buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // Intent accuracy gauge
    this.intentAccuracyGauge = new Gauge({
      name: "maria_intent_accuracy_ratio",
      help: "Intent detection accuracy ratio",
      labelNames: ["intent_type"],
      registers: [this.registry],
    });

    // User satisfaction gauge
    this.satisfactionGauge = new Gauge({
      name: "maria_user_satisfaction_ratio",
      help: "User satisfaction ratio",
      registers: [this.registry],
    });

    // Error rate gauge
    this.errorRateGauge = new Gauge({
      name: "maria_error_rate_ratio",
      help: "Error rate ratio",
      labelNames: ["provider"],
      registers: [this.registry],
    });

    // Active providers gauge
    this.activeProvidersGauge = new Gauge({
      name: "maria_active_providers_count",
      help: "Number of active AI providers",
      registers: [this.registry],
    });

    // Token usage counter
    this.tokenUsageCounter = new Counter({
      name: "maria_tokens_total",
      help: "Total tokens consumed",
      labelNames: ["provider", "type"], // type: input|output
      registers: [this.registry],
    });

    // Fallback rate gauge
    this.fallbackRateGauge = new Gauge({
      name: "maria_fallback_rate_ratio",
      help: "Template fallback usage ratio",
      registers: [this.registry],
    });
  }

  private setupRoutes(): void {
    // Metrics endpoint
    this.app.get(this.metricsPath, async (_req, res) => {
      try {
        res.set("Content-Type", this.registry.contentType);
        res.end(await this.registry.metrics());
      } catch (error) {
        res
          .status(500)
          .end(error instanceof Error ? error.message : "Unknown error");
      }
    });

    // Health check endpoint
    this.app.get("/health", (_req, res) => {
      res.json({ status: "healthy", uptime: process.uptime() });
    });
  }

  public updateMetrics(telemetryData: any): void {
    try {
      // Update response counter
      if (telemetryData.provider && telemetryData.intent) {
        this.responseCounter.inc({
          provider: telemetryData.provider,
          intent: telemetryData.intent,
          language: telemetryData.language || "unknown",
          status: telemetryData.success ? "success" : "failure",
        });
      }

      // Update response histogram
      if (telemetryData.latency) {
        this.responseHistogram.observe(
          {
            provider: telemetryData.provider || "unknown",
            intent: telemetryData.intent || "unknown",
          },
          telemetryData.latency / 1000, // Convert to seconds
        );
      }

      // Update gauges
      if (telemetryData.intentAccuracy !== undefined) {
        this.intentAccuracyGauge.set(
          { intent_type: telemetryData.intent || "unknown" },
          telemetryData.intentAccuracy,
        );
      }

      if (telemetryData.satisfaction !== undefined) {
        this.satisfactionGauge.set(telemetryData.satisfaction);
      }

      if (telemetryData.errorRate !== undefined) {
        this.errorRateGauge.set(
          { provider: telemetryData.provider || "unknown" },
          telemetryData.errorRate,
        );
      }

      if (telemetryData.activeProviders !== undefined) {
        this.activeProvidersGauge.set(telemetryData.activeProviders);
      }

      if (telemetryData.fallbackRate !== undefined) {
        this.fallbackRateGauge.set(telemetryData.fallbackRate);
      }

      // Update token usage
      if (telemetryData.tokens) {
        if (telemetryData.tokens.input) {
          this.tokenUsageCounter.inc(
            {
              provider: telemetryData.provider || "unknown",
              type: "input",
            },
            telemetryData.tokens.input,
          );
        }
        if (telemetryData.tokens.output) {
          this.tokenUsageCounter.inc(
            {
              provider: telemetryData.provider || "unknown",
              type: "output",
            },
            telemetryData.tokens.output,
          );
        }
      }

      this.emit("metricsUpdated", telemetryData);
    } catch (innerError) {
      this.emit("error", error);
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      const server = this.app
        .listen(this.port, () => {
          console.log(
            `🎯 Prometheus metrics available at http://localhost:${this.port}${this.metricsPath}`,
          );
          this.emit("started", { port: this.port, _path: this.metricsPath });
          resolve();
        })
        .on("error", reject);

      // Graceful shutdown
      process.on("SIGTERM", () => {
        server.close(() => {
          console.log("Prometheus exporter shut down gracefully");
        });
      });
    });
  }

  public getRegistry(): Registry {
    return this.registry;
  }

  // Custom metric registration
  public registerCustomMetric(metric: Counter | Gauge | Histogram): void {
    // Metric is automatically registered when created with registers option
    this.emit("customMetricRegistered", metric);
  }
}

// Singleton instance
let exporterInstance: PrometheusExporter | null = null;

export function getPrometheusExporter(
  config?: PrometheusConfig,
): PrometheusExporter {
  if (!exporterInstance) {
    exporterInstance = new PrometheusExporter(config);
  }
  return exporterInstance;
}
