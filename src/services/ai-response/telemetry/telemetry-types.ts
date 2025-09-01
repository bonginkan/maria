/**
 * Telemetry Types and Interfaces
 * Defines metrics and events for AI response monitoring
 */

export interface TelemetryEvent {
  timestamp: number;
  eventType: TelemetryEventType;
  sessionId?: string;
  userId?: string;
  data: Record<string, any>;
}

export type TelemetryEventType =
  | "intent_decided"
  | "response_generated"
  | "provider_called"
  | "fallback_triggered"
  | "safety_violation"
  | "error_occurred"
  | "user_feedback";

export interface IntentMetric {
  type: string;
  confidence: number;
  language: "ja" | "en";
  timestamp: number;
}

export interface ResponseMetric {
  provider: string;
  model?: string;
  latencyMs: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  success: boolean;
  fallback: boolean;
  timestamp: number;
}

export interface SafetyMetric {
  violationType: "pii" | "injection" | "size" | "content";
  blocked: boolean;
  timestamp: number;
}

export interface UserFeedbackMetric {
  rating: "positive" | "negative" | "neutral";
  responseId: string;
  comment?: string;
  timestamp: number;
}

export interface AggregatedMetrics {
  period: "minute" | "hour" | "day";
  startTime: number;
  endTime: number;

  // Intent metrics
  intentCounts: Record<string, number>;
  intentAccuracy: number;
  languageDistribution: Record<string, number>;

  // Response metrics
  totalResponses: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  providerDistribution: Record<string, number>;
  fallbackRate: number;
  errorRate: number;

  // Token usage
  totalTokens: number;
  averageTokensPerRequest: number;

  // Safety metrics
  safetyViolations: number;
  violationTypes: Record<string, number>;

  // User satisfaction
  satisfactionRate: number;
  feedbackCount: number;
  feedbackDistribution: Record<string, number>;
}

export interface DashboardData {
  currentMetrics: AggregatedMetrics;
  historicalMetrics: AggregatedMetrics[];
  alerts: Alert[];
  systemStatus: SystemStatus;
}

export interface Alert {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  type: AlertType;
  message: string;
  timestamp: number;
  resolved: boolean;
}

export type AlertType =
  | "high_latency"
  | "high_error_rate"
  | "low_satisfaction"
  | "provider_failure"
  | "safety_breach"
  | "token_limit";

export interface SystemStatus {
  healthy: boolean;
  providers: Record<string, ProviderStatus>;
  uptime: number;
  lastError?: string;
  lastErrorTime?: number;
}

export interface ProviderStatus {
  available: boolean;
  latency: number;
  errorRate: number;
  lastCheck: number;
}
