/**
 * Telemetry Collector Service
 * Collects and stores metrics for AI response monitoring
 */

import type {
  TelemetryEvent,
  IntentMetric,
  ResponseMetric,
  SafetyMetric,
  UserFeedbackMetric,
  AggregatedMetrics,
} from "./telemetry-types";

export class TelemetryCollector {
  private static instance: TelemetryCollector;
  private events: TelemetryEvent[] = [];
  private sessionId: string;
  private flushInterval: NodeJS.Timeout | null = null;
  private aggregationInterval: NodeJS.Timeout | null = null;
  private metricsBuffer: Map<string, AggregatedMetrics> = new Map();

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startCollection();
  }

  static getInstance(): TelemetryCollector {
    if (!TelemetryCollector.instance) {
      TelemetryCollector.instance = new TelemetryCollector();
    }
    return TelemetryCollector.instance;
  }

  /**
   * Start collecting metrics
   */
  private startCollection(): void {
    // Flush events every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushEvents();
    }, 30000);

    // Aggregate metrics every minute
    this.aggregationInterval = setInterval(() => {
      this.aggregateMetrics("minute");
    }, 60000);

    // Silent telemetry start
  }

  /**
   * Track intent decision
   */
  trackIntent(metric: IntentMetric): void {
    this.addEvent({
      timestamp: Date.now(),
      eventType: "intent_decided",
      sessionId: this.sessionId,
      data: metric,
    });
  }

  /**
   * Track response generation
   */
  trackResponse(metric: ResponseMetric): void {
    this.addEvent({
      timestamp: Date.now(),
      eventType: "response_generated",
      sessionId: this.sessionId,
      data: metric,
    });

    // Track provider call separately
    if (!metric.fallback) {
      this.addEvent({
        timestamp: Date.now(),
        eventType: "provider_called",
        sessionId: this.sessionId,
        data: {
          provider: metric.provider,
          success: metric.success,
        },
      });
    }
  }

  /**
   * Track safety violations
   */
  trackSafetyViolation(metric: SafetyMetric): void {
    this.addEvent({
      timestamp: Date.now(),
      eventType: "safety_violation",
      sessionId: this.sessionId,
      data: metric,
    });
  }

  /**
   * Track user feedback
   */
  trackUserFeedback(metric: UserFeedbackMetric): void {
    this.addEvent({
      timestamp: Date.now(),
      eventType: "user_feedback",
      sessionId: this.sessionId,
      data: metric,
    });
  }

  /**
   * Track errors
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.addEvent({
      timestamp: Date.now(),
      eventType: "error_occurred",
      sessionId: this.sessionId,
      data: {
        message: error.message,
        stack: error.stack,
        ...context,
      },
    });
  }

  /**
   * Add event to buffer
   */
  private addEvent(event: TelemetryEvent): void {
    this.events.push(event);

    // Auto-flush if buffer is getting large
    if (this.events.length >= 100) {
      this.flushEvents();
    }
  }

  /**
   * Flush events to storage/API
   */
  private async flushEvents(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToFlush = [...this.events];
    this.events = [];

    try {
      // In production, send to telemetry endpoint
      if (process.env.TELEMETRY_ENDPOINT) {
        await this.sendToEndpoint(eventsToFlush);
      } else {
        // For development, store locally
        this.storeLocally(eventsToFlush);
      }
    } catch (error) {
      console.error("[Telemetry] Failed to flush events:", error);
      // Re-add events to buffer
      this.events.unshift(...eventsToFlush);
    }
  }

  /**
   * Send events to telemetry endpoint
   */
  private async sendToEndpoint(events: TelemetryEvent[]): Promise<void> {
    const endpoint = process.env.TELEMETRY_ENDPOINT;
    const apiKey = process.env.TELEMETRY_API_KEY;

    if (!endpoint) return;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      throw new Error(`Telemetry endpoint returned ${response.status}`);
    }
  }

  /**
   * Store events locally (for development)
   */
  private storeLocally(events: TelemetryEvent[]): void {
    // Store in memory for now
    const key = `metrics_${Date.now()}`;
    this.metricsBuffer.set(key, this.calculateMetrics(events));

    // Keep only last 100 metric sets
    if (this.metricsBuffer.size > 100) {
      const keys = Array.from(this.metricsBuffer.keys());
      this.metricsBuffer.delete(keys[0]);
    }
  }

  /**
   * Calculate metrics from events
   */
  private calculateMetrics(events: TelemetryEvent[]): AggregatedMetrics {
    const now = Date.now();
    const metrics: AggregatedMetrics = {
      period: "minute",
      startTime: now - 60000,
      endTime: now,

      // Intent metrics
      intentCounts: {},
      intentAccuracy: 0,
      languageDistribution: {},

      // Response metrics
      totalResponses: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      providerDistribution: {},
      fallbackRate: 0,
      errorRate: 0,

      // Token usage
      totalTokens: 0,
      averageTokensPerRequest: 0,

      // Safety metrics
      safetyViolations: 0,
      violationTypes: {},

      // User satisfaction
      satisfactionRate: 0,
      feedbackCount: 0,
      feedbackDistribution: {},
    };

    // Process events
    const latencies: number[] = [];
    let totalTokens = 0;
    let feedbackPositive = 0;
    let feedbackTotal = 0;

    events.forEach((event) => {
      switch (event.eventType) {
        case "intent_decided":
          {
            const intent = event.data as IntentMetric;
            metrics.intentCounts[intent.type] =
              (metrics.intentCounts[intent.type] || 0) + 1;
            metrics.languageDistribution[intent.language] =
              (metrics.languageDistribution[intent.language] || 0) + 1;
          }
          break;

        case "response_generated":
          {
            const response = event.data as ResponseMetric;
            metrics.totalResponses++;
            latencies.push(response.latencyMs);
            metrics.providerDistribution[response.provider] =
              (metrics.providerDistribution[response.provider] || 0) + 1;
            if (response.fallback) metrics.fallbackRate++;
            if (!response.success) metrics.errorRate++;
            if (response.tokenUsage) {
              totalTokens += response.tokenUsage.total;
            }
          }
          break;

        case "safety_violation":
          {
            const safety = event.data as SafetyMetric;
            metrics.safetyViolations++;
            metrics.violationTypes[safety.violationType] =
              (metrics.violationTypes[safety.violationType] || 0) + 1;
          }
          break;

        case "user_feedback":
          {
            const feedback = event.data as UserFeedbackMetric;
            feedbackTotal++;
            if (feedback.rating === "positive") feedbackPositive++;
            metrics.feedbackDistribution[feedback.rating] =
              (metrics.feedbackDistribution[feedback.rating] || 0) + 1;
          }
          break;
      }
    });

    // Calculate aggregates
    if (latencies.length > 0) {
      latencies.sort((a, b) => a - b);
      metrics.averageLatency =
        latencies.reduce((a, b) => a + b, 0) / latencies.length;
      metrics.p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
      metrics.p99Latency = latencies[Math.floor(latencies.length * 0.99)] || 0;
    }

    if (metrics.totalResponses > 0) {
      metrics.fallbackRate = metrics.fallbackRate / metrics.totalResponses;
      metrics.errorRate = metrics.errorRate / metrics.totalResponses;
      metrics.averageTokensPerRequest = totalTokens / metrics.totalResponses;
    }

    if (feedbackTotal > 0) {
      metrics.satisfactionRate = feedbackPositive / feedbackTotal;
    }

    metrics.feedbackCount = feedbackTotal;
    metrics.totalTokens = totalTokens;

    return metrics;
  }

  /**
   * Aggregate metrics by period
   */
  private aggregateMetrics(period: "minute" | "hour" | "day"): void {
    const recentEvents = this.getRecentEvents(period);
    const metrics = this.calculateMetrics(recentEvents);

    // Store aggregated metrics
    const key = `${period}_${Date.now()}`;
    this.metricsBuffer.set(key, metrics);

    // console.log(`[Telemetry] Aggregated ${period} metrics:`, {
    //   responses: metrics.totalResponses,
    //   avgLatency: Math.round(metrics.averageLatency),
    //   satisfaction: Math.round(metrics.satisfactionRate * 100) + '%'
    // });
  }

  /**
   * Get recent events by period
   */
  private getRecentEvents(period: "minute" | "hour" | "day"): TelemetryEvent[] {
    const now = Date.now();
    const duration =
      period === "minute" ? 60000 : period === "hour" ? 3600000 : 86400000;

    return this.events.filter((e) => e.timestamp > now - duration);
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): AggregatedMetrics | null {
    const keys = Array.from(this.metricsBuffer.keys())
      .filter((k) => k.startsWith("minute_"))
      .sort();

    if (keys.length === 0) return null;

    return this.metricsBuffer.get(keys[keys.length - 1]) || null;
  }

  /**
   * Get historical metrics
   */
  getHistoricalMetrics(
    period: "minute" | "hour" | "day",
    count: number = 10,
  ): AggregatedMetrics[] {
    const prefix = `${period}_`;
    const keys = Array.from(this.metricsBuffer.keys())
      .filter((k) => k.startsWith(prefix))
      .sort()
      .slice(-count);

    return keys.map((k) => this.metricsBuffer.get(k)!).filter(Boolean);
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stop collection
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }

    this.flushEvents();
    // Silent telemetry stop
  }
}
