/**
 * Model pool and provider configuration types
 */

export interface ModelPool {
  /** Pool identifier */
  id: string;
  
  /** Version for change tracking */
  version: string;
  
  /** Human-readable name */
  name: string;
  
  /** Pool description */
  description: string;
  
  /** When this pool configuration was created */
  createdAt: Date;
  
  /** Available models in this pool */
  models: ModelDefinition[];
  
  /** Pool-wide constraints */
  constraints: PoolConstraints;
  
  /** Fallback strategy */
  fallbackStrategy: FallbackStrategy;
}

export interface ModelDefinition {
  /** Unique model identifier (provider:model-name) */
  id: string;
  
  /** Provider identifier */
  providerId: string;
  
  /** Model name within provider */
  modelName: string;
  
  /** Supported modalities */
  modality: 'text' | 'vision' | 'audio' | 'video' | 'multimodal';
  
  /** Context window size in tokens */
  contextWindow: number;
  
  /** Performance characteristics */
  performance: {
    /** Estimated time to first byte (ms) */
    estimatedTTFBMs: number;
    
    /** Estimated tokens per second */
    estimatedThroughput: number;
    
    /** Quality score (0-1, higher is better) */
    qualityScore: number;
  };
  
  /** Cost model */
  cost: ModelCostDefinition;
  
  /** Model capabilities */
  capabilities: ModelCapabilities;
  
  /** Default generation parameters */
  defaultParams: GenerationParameters;
}

export interface ModelCostDefinition {
  /** Cost per million input tokens (USD) */
  inputTokensPPM: number;
  
  /** Cost per million output tokens (USD) */
  outputTokensPPM: number;
  
  /** Fixed cost per request (USD) */
  fixedCostPerRequest?: number;
  
  /** Provider-specific cost model reference */
  providerCostModelId?: string;
}

export interface ModelCapabilities {
  /** Supported languages */
  languages: string[];
  
  /** Function calling support */
  functionCalling: boolean;
  
  /** Tool use support */
  toolUse: boolean;
  
  /** Code execution support */
  codeExecution: boolean;
  
  /** Vision capabilities */
  vision?: {
    imageFormats: string[];
    maxImageSize: number;
    videoSupport: boolean;
  };
  
  /** Audio capabilities */
  audio?: {
    inputFormats: string[];
    outputFormats: string[];
    voiceCloning: boolean;
  };
  
  /** Streaming support */
  streaming: boolean;
  
  /** Maximum output tokens */
  maxOutputTokens: number;
}

export interface GenerationParameters {
  /** Sampling temperature (0-2) */
  temperature: number;
  
  /** Top-p sampling (0-1) */
  topP: number;
  
  /** Top-k sampling */
  topK?: number;
  
  /** Random seed for reproducibility */
  seed?: number;
  
  /** Maximum tokens to generate */
  maxTokens: number;
  
  /** Stop sequences */
  stop?: string[];
  
  /** Presence penalty */
  presencePenalty?: number;
  
  /** Frequency penalty */
  frequencyPenalty?: number;
}

export interface PoolConstraints {
  /** Maximum cost per request (USD) */
  maxCostPerRequest: number;
  
  /** Maximum latency budget (ms) */
  maxLatencyMs: number;
  
  /** Minimum quality score required */
  minQualityScore: number;
  
  /** Required capabilities */
  requiredCapabilities?: string[];
  
  /** Excluded providers */
  excludedProviders?: string[];
}

export interface FallbackStrategy {
  /** Maximum number of fallback attempts */
  maxFallbacks: number;
  
  /** Fallback selection strategy */
  strategy: 'health_score' | 'cost_optimal' | 'latency_optimal' | 'quality_optimal';
  
  /** Whether to allow cross-modality fallbacks */
  allowCrossModality: boolean;
  
  /** Time budget for fallback attempts (ms) */
  fallbackTimeoutMs: number;
  
  /** Minimum time between fallback attempts (ms) */
  minFallbackIntervalMs: number;
}

export interface ProviderHealthStatus {
  /** Provider identifier */
  providerId: string;
  
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /** Health score (0-1) */
  healthScore: number;
  
  /** Current latency percentiles */
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  
  /** Error rates */
  errorRates: {
    last5min: number;
    last1hour: number;
    last24hours: number;
  };
  
  /** Circuit breaker state */
  circuitBreakerState: 'closed' | 'open' | 'half_open';
  
  /** Last health check time */
  lastCheckedAt: Date;
  
  /** Detailed metrics per model */
  modelMetrics: Record<string, ModelHealthMetrics>;
}

export interface ModelHealthMetrics {
  /** Model identifier */
  modelId: string;
  
  /** Request count in last hour */
  requestCount: number;
  
  /** Success rate (0-1) */
  successRate: number;
  
  /** Average latency (ms) */
  avgLatencyMs: number;
  
  /** Average cost per request */
  avgCostPerRequest: number;
  
  /** Last successful request */
  lastSuccessAt: Date;
  
  /** Last error details */
  lastError?: {
    timestamp: Date;
    errorType: string;
    errorMessage: string;
  };
}