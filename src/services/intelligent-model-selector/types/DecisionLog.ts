/**
 * Complete decision logging types for reproducibility and observability
 */

export interface CompleteRoutingLog {
  /** Unique trace identifier */
  traceId: string;
  
  /** Hashed user identifier for privacy */
  userIdHash?: string;
  
  /** Idempotency key */
  idempotencyKey: string;
  
  /** Task specification at decision time */
  task: {
    kind: string;
    subtype?: string;
    tokensIn: number;
    longContext: boolean;
    modality: string;
    latencyBudgetMs: number;
    costTier: 'low' | 'mid' | 'high';
  };
  
  /** Complete policy snapshot for reproducibility */
  policySnapshot: PolicySnapshot;
  
  /** Complete pool snapshot for reproducibility */
  poolSnapshot: PoolSnapshot;
  
  /** Provider health snapshot at decision time */
  healthSnapshot: Record<string, ProviderHealthSnapshot>;
  
  /** All evaluated candidate models */
  candidateModels: CandidateEvaluation[];
  
  /** Final selection details */
  selected: {
    modelId: string;
    providerId: string;
    reasons: string[];
    confidence: number;
    generationParams: GenerationParameters;
  };
  
  /** Fallback chain if primary failed */
  fallbackChain: FallbackAttempt[];
  
  /** Detailed TTFB breakdown for monitoring */
  ttfbBreakdown: TTFBBreakdown;
  
  /** Cost calculation details */
  costCalculation: CostCalculationDetails;
  
  /** A/B test information if applicable */
  abTestInfo?: ABTestExecution;
  
  /** PII redaction summary */
  piiRedactionSummary: PIIRedactionSummary;
  
  /** Decision timestamp */
  routedAt: string; // ISO string
  
  /** Actual performance metrics (filled after execution) */
  actualMetrics?: ActualPerformanceMetrics;
}

export interface PolicySnapshot {
  id: string;
  version: string;
  taskMatrix: Record<string, any>;
  rules: any[];
  abTests?: any[];
  emergencyOverrides?: any[];
  snapshotTakenAt: string;
}

export interface PoolSnapshot {
  id: string;
  version: string;
  models: ModelDefinitionSnapshot[];
  constraints: any;
  fallbackStrategy: any;
  snapshotTakenAt: string;
}

export interface ModelDefinitionSnapshot {
  id: string;
  providerId: string;
  modelName: string;
  modality: string;
  contextWindow: number;
  performance: any;
  cost: any;
  capabilities: any;
  defaultParams: any;
}

export interface ProviderHealthSnapshot {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  healthScore: number;
  latencyP95Ms: number;
  errorRate5min: number;
  circuitBreakerState: 'closed' | 'open' | 'half_open';
  snapshotTakenAt: string;
}

export interface CandidateEvaluation {
  modelId: string;
  providerId: string;
  
  /** Calculated score for selection */
  score: number;
  
  /** Detailed scoring breakdown */
  scoring: {
    latencyScore: number;
    costScore: number;
    qualityScore: number;
    healthScore: number;
    capabilityScore: number;
  };
  
  /** Human-readable reasons for score */
  reasons: string[];
  
  /** Estimated performance */
  estimates: {
    ttfbMs: number;
    costUsd: number;
    qualityScore: number;
  };
  
  /** Why this candidate was/wasn't selected */
  selectionStatus: 'selected' | 'backup' | 'filtered_out' | 'unavailable';
  
  /** Detailed filtering reasons if applicable */
  filterReasons?: string[];
}

export interface FallbackAttempt {
  /** Model that was attempted */
  modelId: string;
  
  /** Why the fallback was needed */
  reason: 'primary_failed' | 'timeout' | 'circuit_breaker' | 'rate_limit' | 'quota_exceeded';
  
  /** Detailed failure reason */
  failureDetails: {
    errorCode?: string;
    errorMessage?: string;
    httpStatus?: number;
    retryAfterMs?: number;
  };
  
  /** When this attempt was made */
  attemptedAt: string;
  
  /** How long this attempt took */
  durationMs: number;
  
  /** Whether this attempt succeeded */
  succeeded: boolean;
}

export interface TTFBBreakdown {
  /** Authentication and authorization time */
  authMs: number;
  
  /** Policy and pool cache lookup time */
  cacheMs: number;
  
  /** Rule evaluation time */
  rulesMs: number;
  
  /** Model selection calculation time */
  selectMs: number;
  
  /** SSE headers flush time */
  flushMs: number;
  
  /** Total TTFB time */
  totalMs: number;
  
  /** Whether each stage met its budget */
  budgetCompliance: {
    auth: boolean;    // ≤40ms
    cache: boolean;   // ≤20ms
    rules: boolean;   // ≤10ms
    select: boolean;  // ≤10ms
    flush: boolean;   // ≤120ms
    total: boolean;   // ≤500ms
  };
}

export interface CostCalculationDetails {
  /** Estimated cost breakdown */
  estimated: {
    inputTokensCost: number;
    outputTokensCost: number;
    fixedCost: number;
    totalCostUsd: number;
  };
  
  /** Actual cost (filled after execution) */
  actual?: {
    inputTokens: number;
    outputTokens: number;
    actualCostUsd: number;
  };
  
  /** Cost tier used for calculation */
  tierUsed: 'low' | 'mid' | 'high';
  
  /** Free quota applied */
  freeQuotaApplied: {
    inputTokens: number;
    outputTokens: number;
    totalSavedUsd: number;
  };
  
  /** User's quota status after this request */
  quotaStatus: {
    remainingInputTokens: number;
    remainingOutputTokens: number;
    quotaResetDate: string;
  };
}

export interface ABTestExecution {
  /** A/B test name */
  testName: string;
  
  /** User's test group */
  testGroup: 'control' | 'treatment';
  
  /** Whether this was shadow-only */
  shadowOnly: boolean;
  
  /** Test configuration snapshot */
  testConfig: any;
  
  /** Control group decision (if treatment was selected) */
  controlDecision?: {
    modelId: string;
    reasons: string[];
    estimatedCost: number;
  };
}

export interface PIIRedactionSummary {
  /** Total PII items detected and redacted */
  totalRedacted: number;
  
  /** Breakdown by PII type */
  breakdown: {
    emails: number;
    phones: number;
    creditCards: number;
    ssns: number;
    apiKeys: number;
    other: number;
  };
  
  /** Where PII was found */
  locations: Array<{
    location: 'headers' | 'body' | 'metadata';
    type: string;
    count: number;
  }>;
  
  /** Whether any PII redaction failed */
  redactionFailures: boolean;
}

export interface ActualPerformanceMetrics {
  /** Actual time to first byte */
  actualTTFBMs: number;
  
  /** Total request duration */
  totalDurationMs: number;
  
  /** Tokens actually consumed */
  actualTokens: {
    input: number;
    output: number;
  };
  
  /** Final cost charged */
  finalCostUsd: number;
  
  /** Whether request succeeded */
  success: boolean;
  
  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    httpStatus: number;
    retryable: boolean;
  };
  
  /** Quality metrics if available */
  quality?: {
    userSatisfaction?: number; // 0-1
    outputQualityScore?: number; // 0-1
  };
}