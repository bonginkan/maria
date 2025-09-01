/**
 * Model Selector v2 - Type Definitions
 * Shared interfaces and types for v2 architecture
 */

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  latencyMs: number;
  price: PricingInfo;
  capabilities: Capability[];
  availability: AvailabilityStatus;
  metadata?: Record<string, unknown>;
}

export interface PricingInfo {
  input: number;
  output: number;
  currency: string;
}

export type Capability =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "function_call"
  | "code_execution"
  | "web_search"
  | "file_analysis";

export type AvailabilityStatus = "healthy" | "degraded" | "unavailable";

export interface ModelFilter {
  provider?: string;
  capability?: Capability;
  maxLatency?: number;
  maxCost?: number;
  minQuality?: number;
}

export interface RecommendationContext {
  task?: string;
  budget?: "low" | "medium" | "high";
  latencyRequirement?: "low" | "medium" | "high";
  qualityRequirement?: "low" | "medium" | "high";
  history?: ModelUsageHistory[];
  candidates: ModelInfo[];
  userId?: string;
  sessionId?: string;
}

export interface ModelUsageHistory {
  modelId: string;
  success: boolean;
  task: string;
  timestamp: Date;
  latency?: number;
  cost?: number;
  rating?: number;
}

export interface ModelRecommendation extends ModelInfo {
  confidence: number;
  reason: string;
  rank: number;
}

export interface RegistryHealth {
  providers: string[];
  totalModels: number;
  healthyProviders: number;
  latency: {
    p50: number;
    p95: number;
  };
  lastUpdate: Date;
}

export interface ProviderAdapter {
  id: string;
  getModels(): Promise<ModelInfo[]>;
  validateApiKey(): Promise<boolean>;
  estimateCost(usage: UsageMetrics): Promise<CostEstimate>;
  getCapabilities(): Capability[];
  health(): Promise<HealthStatus>;
}

export interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

export interface CostEstimate {
  total: number;
  breakdown: {
    input: number;
    output: number;
    requests: number;
  };
  currency: string;
}

export interface HealthStatus {
  status: AvailabilityStatus;
  latencyMs: number;
  lastCheck?: Date;
  errorRate?: number;
}

// Legacy compatibility types
export interface LegacyOptions {
  filters?: Record<string, any>;
  task?: string;
  timeout?: number;
}

// Events
export interface ModelSelectorEvent {
  type: "select" | "list" | "recommend" | "health_check";
  modelId?: string;
  filters?: ModelFilter;
  context?: RecommendationContext;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: string;
}

export interface AuditEvent {
  event: string;
  userId?: string;
  modelId?: string;
  provider?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Configuration
export interface RecommendationConfig {
  historyWeight: number;
  latencyWeight: number;
  costWeight: number;
  qualityWeight: number;
}

export interface ModelSelectorConfig {
  recommendation: RecommendationConfig;
  cache: {
    enabled: boolean;
    ttl: number;
    maxEntries: number;
  };
  security: {
    rbacEnabled: boolean;
    auditEnabled: boolean;
  };
}
