/**
 * Lightweight Metrics Collector
 * Tracks usage and deprecation metrics for MARIA Memory System
 */

interface MetricData {
  [key: string]: any;
  timestamp?: string;
}

interface DeprecationMetric extends MetricData {
  key: string;
  component: string;
  version: string;
  replacement?: string;
}

// In-memory store for metrics (production would use external service)
const metrics: Array<{ event: string; data: MetricData; timestamp: Date }> = [];

/**
 * Track a metrics event
 */
export function track(event: string, data: MetricData = {}): void {
  try {
    const timestamp = new Date();

    // Add to in-memory store
    metrics.push({
      event,
      data: {
        ...data,
        timestamp: timestamp.toISOString(),
      },
      timestamp,
    });

    // Keep only last 1000 metrics to prevent memory leaks
    if (metrics.length > 1000) {
      metrics.shift();
    }

    // Send to external metrics service if configured
    if (process.env.METRICS_ENDPOINT) {
      sendToExternalService(event, data);
    }

    // Log in development
    if (process.env.NODE_ENV === "development") {
      console.debug(`[METRICS] ${event}:`, data);
    }
  } catch (error) {
    // Metrics should never break the application
    console.debug("Metrics collection failed:", error);
  }
}

/**
 * Get metrics by event type
 */
export function getMetrics(
  eventType?: string,
): Array<{ event: string; data: MetricData; timestamp: Date }> {
  if (eventType) {
    return metrics.filter((m) => m.event === eventType);
  }
  return [...metrics];
}

/**
 * Get deprecation usage statistics
 */
export function getDeprecationStats(): {
  totalWarnings: number;
  uniqueFeatures: number;
  topDeprecated: Array<{ key: string; count: number }>;
} {
  const deprecationMetrics = metrics.filter(
    (m) => m.event === "deprecation.warning",
  );

  const featureCounts = new Map<string, number>();
  deprecationMetrics.forEach((m) => {
    const key = (m.data as DeprecationMetric).key;
    featureCounts.set(key, (featureCounts.get(key) || 0) + 1);
  });

  const topDeprecated = Array.from(featureCounts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalWarnings: deprecationMetrics.length,
    uniqueFeatures: featureCounts.size,
    topDeprecated,
  };
}

/**
 * Clear metrics (for testing)
 */
export function clearMetrics(): void {
  metrics.length = 0;
}

/**
 * Send metrics to external service (Prometheus, DataDog, etc.)
 */
async function sendToExternalService(
  event: string,
  _data: MetricData,
): Promise<void> {
  try {
    const endpoint = process.env.METRICS_ENDPOINT;
    if (!endpoint) return;

    // Simple HTTP POST to metrics endpoint
    if (typeof fetch !== "undefined") {
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event,
          data: "",
          timestamp: new Date().toISOString(),
          service: "maria-memory-system",
        }),
      });
    }
  } catch (innerError) {
    // External service failures should not affect the application
    console.debug("Failed to send metrics to external service:", error);
  }
}

/**
 * Generate metrics report
 */
export function generateReport(since?: Date): {
  totalEvents: number;
  eventTypes: Record<string, number>;
  deprecationStats: ReturnType<typeof getDeprecationStats>;
  recentEvents: Array<{ event: string; data: MetricData; timestamp: Date }>;
} {
  const sinceTime = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

  const recentMetrics = metrics.filter((m) => m.timestamp >= sinceTime);

  const eventTypes: Record<string, number> = {};
  recentMetrics.forEach((m) => {
    eventTypes[m.event] = (eventTypes[m.event] || 0) + 1;
  });

  return {
    totalEvents: recentMetrics.length,
    eventTypes,
    deprecationStats: getDeprecationStats(),
    recentEvents: recentMetrics.slice(-20), // Last 20 events
  };
}

/**
 * Track feature usage
 */
export function trackFeatureUsage(feature: string, userId?: string): void {
  track("feature.usage", {
    feature,
    userId,
    sessionId: process.env.SESSION_ID,
  });
}

/**
 * Track performance metrics
 */
export function trackPerformance(
  operation: string,
  duration: number,
  metadata?: MetricData,
): void {
  track("performance.timing", {
    operation,
    duration,
    ...metadata,
  });
}

/**
 * Track errors
 */
export function trackError(error: Error, context?: MetricData): void {
  track("error.occurred", {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
  });
}

// Periodic cleanup to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    if (metrics.length > 500) {
      metrics.splice(0, metrics.length - 500);
    }
  }, 60000); // Cleanup every minute
}
