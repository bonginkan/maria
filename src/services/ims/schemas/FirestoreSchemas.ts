/**
 * Firestore Schema Definitions for IMS v1.0
 * Complete schema definitions for policies, pools, and configurations
 * Phase 2 implementation
 */

import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Collections structure:
 * - /ims_policies/{policyId} - Routing policies
 * - /ims_model_pools/{poolId} - Model pool configurations
 * - /ims_health_status/{modelId} - Real-time health status
 * - /ims_audit_logs/{logId} - Audit trail
 * - /ims_feature_flags/{flagId} - Feature toggles
 */

// ============================================================================
// Policy Collection: /ims_policies/{policyId}
// ============================================================================

export interface FirestorePolicyDocument {
  /** Policy unique identifier */
  policyId: string;
  
  /** Policy version for A/B testing */
  version: string;
  
  /** Human-readable policy name */
  name: string;
  
  /** Policy description */
  description: string;
  
  /** Is this policy active? */
  enabled: boolean;
  
  /** Priority order (lower = higher priority) */
  priority: number;
  
  /** Policy rules configuration */
  rules: PolicyRules;
  
  /** Model preferences and biases */
  modelPreferences: ModelPreferences;
  
  /** Cost optimization settings */
  costOptimization: CostOptimization;
  
  /** Performance requirements */
  performanceRequirements: PerformanceRequirements;
  
  /** Metadata */
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
    updatedBy: string;
    tags: string[];
    environment: 'production' | 'staging' | 'development';
  };
}

export interface PolicyRules {
  /** Routing rules based on conditions */
  conditions: RoutingCondition[];
  
  /** Default action if no conditions match */
  defaultAction: 'route_to_default' | 'reject' | 'queue';
  
  /** Fallback strategy */
  fallbackStrategy: 'sequential' | 'parallel' | 'weighted' | 'none';
  
  /** Max fallback attempts */
  maxFallbackAttempts: number;
}

export interface RoutingCondition {
  /** Condition ID */
  id: string;
  
  /** Condition expression (evaluated at runtime) */
  expression: {
    field: 'userTier' | 'promptLength' | 'complexity' | 'latency' | 'cost' | 'custom';
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'regex';
    value: unknown;
  };
  
  /** Action to take when condition matches */
  action: {
    type: 'route_to_model' | 'route_to_pool' | 'reject' | 'transform';
    target?: string; // Model or pool ID
    parameters?: Record<string, unknown>;
  };
}

export interface ModelPreferences {
  /** Preferred models in order */
  preferredModels: string[];
  
  /** Models to avoid */
  blockedModels: string[];
  
  /** Model-specific overrides */
  modelOverrides: Record<string, {
    weight: number; // 0-100
    maxTokens?: number;
    temperature?: number;
    costMultiplier?: number;
  }>;
}

export interface CostOptimization {
  /** Enable cost optimization */
  enabled: boolean;
  
  /** Maximum cost per request in cents */
  maxCostPerRequest: number;
  
  /** Daily budget in dollars */
  dailyBudget: number;
  
  /** Monthly budget in dollars */
  monthlyBudget: number;
  
  /** Cost tracking granularity */
  trackingGranularity: 'user' | 'team' | 'organization' | 'global';
}

export interface PerformanceRequirements {
  /** Maximum acceptable latency in ms */
  maxLatencyMs: number;
  
  /** Target success rate (0-1) */
  targetSuccessRate: number;
  
  /** Minimum tokens per second */
  minTokensPerSecond?: number;
  
  /** TTFB budget in ms */
  ttfbBudgetMs: number;
}

// ============================================================================
// Model Pool Collection: /ims_model_pools/{poolId}
// ============================================================================

export interface FirestoreModelPoolDocument {
  /** Pool unique identifier */
  poolId: string;
  
  /** Pool name */
  name: string;
  
  /** Pool description */
  description: string;
  
  /** Is this pool active? */
  enabled: boolean;
  
  /** Models in this pool */
  models: PoolModel[];
  
  /** Load balancing configuration */
  loadBalancing: LoadBalancingConfig;
  
  /** Health check configuration */
  healthCheck: HealthCheckConfig;
  
  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfig;
  
  /** Metadata */
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
    tags: string[];
  };
}

export interface PoolModel {
  /** Model identifier (e.g., "openai:gpt-4") */
  modelId: string;
  
  /** Model weight for weighted distribution */
  weight: number;
  
  /** Model-specific configuration */
  config: {
    maxConcurrent: number;
    timeout: number;
    retryCount: number;
    priority: number;
  };
  
  /** Cost per 1K tokens */
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

export interface LoadBalancingConfig {
  /** Strategy for load distribution */
  strategy: 'round_robin' | 'weighted' | 'least_connections' | 'random' | 'sticky';
  
  /** Sticky session duration in seconds */
  stickySessionDuration?: number;
  
  /** Health-based routing */
  healthBasedRouting: boolean;
  
  /** Latency-based routing */
  latencyBasedRouting: boolean;
}

export interface HealthCheckConfig {
  /** Enable health checks */
  enabled: boolean;
  
  /** Health check interval in seconds */
  intervalSeconds: number;
  
  /** Health check timeout in ms */
  timeoutMs: number;
  
  /** Consecutive failures before marking unhealthy */
  failureThreshold: number;
  
  /** Consecutive successes before marking healthy */
  successThreshold: number;
  
  /** Health check method */
  method: 'ping' | 'simple_prompt' | 'custom';
  
  /** Custom health check prompt */
  customPrompt?: string;
}

export interface CircuitBreakerConfig {
  /** Enable circuit breaker */
  enabled: boolean;
  
  /** Failure threshold percentage (0-100) */
  failureThreshold: number;
  
  /** Time window for failure calculation in seconds */
  windowSeconds: number;
  
  /** Cool down period in seconds */
  cooldownSeconds: number;
  
  /** Half-open trial requests */
  halfOpenRequests: number;
}

// ============================================================================
// Health Status Collection: /ims_health_status/{modelId}
// ============================================================================

export interface FirestoreHealthStatusDocument {
  /** Model identifier */
  modelId: string;
  
  /** Current health status */
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  
  /** Circuit breaker state */
  circuitBreakerState: 'closed' | 'open' | 'half_open';
  
  /** Real-time metrics */
  metrics: {
    /** Average latency in last 5 minutes */
    avgLatencyMs: number;
    
    /** P95 latency in last 5 minutes */
    p95LatencyMs: number;
    
    /** P99 latency in last 5 minutes */
    p99LatencyMs: number;
    
    /** Success rate in last 5 minutes */
    successRate: number;
    
    /** Total requests in last 5 minutes */
    requestCount: number;
    
    /** Error count in last 5 minutes */
    errorCount: number;
    
    /** Average tokens per second */
    avgTokensPerSecond: number;
  };
  
  /** Last health check result */
  lastHealthCheck: {
    timestamp: Timestamp;
    success: boolean;
    latencyMs: number;
    error?: string;
  };
  
  /** Historical data points (last 24 hours) */
  history: HealthDataPoint[];
  
  /** Last updated timestamp */
  updatedAt: Timestamp;
}

export interface HealthDataPoint {
  timestamp: Timestamp;
  latencyMs: number;
  successRate: number;
  requestCount: number;
  errorCount: number;
}

// ============================================================================
// Audit Log Collection: /ims_audit_logs/{logId}
// ============================================================================

export interface FirestoreAuditLogDocument {
  /** Log entry ID */
  logId: string;
  
  /** Trace ID for correlation */
  traceId: string;
  
  /** Event type */
  eventType: 'routing_decision' | 'fallback_used' | 'policy_change' | 'pool_change' | 'error' | 'warning';
  
  /** Event severity */
  severity: 'info' | 'warning' | 'error' | 'critical';
  
  /** Event details */
  event: {
    /** What happened */
    action: string;
    
    /** Who initiated it */
    actor: {
      type: 'user' | 'system' | 'api';
      id: string;
      metadata?: Record<string, unknown>;
    };
    
    /** What was affected */
    resource: {
      type: 'policy' | 'pool' | 'model' | 'request';
      id: string;
    };
    
    /** Additional context */
    context: Record<string, unknown>;
  };
  
  /** Timestamp */
  timestamp: Timestamp;
  
  /** TTL for auto-deletion (optional) */
  expiresAt?: Timestamp;
}

// ============================================================================
// Feature Flags Collection: /ims_feature_flags/{flagId}
// ============================================================================

export interface FirestoreFeatureFlagDocument {
  /** Flag identifier */
  flagId: string;
  
  /** Flag name */
  name: string;
  
  /** Flag description */
  description: string;
  
  /** Is flag enabled globally? */
  enabled: boolean;
  
  /** Flag type */
  type: 'boolean' | 'percentage' | 'variant' | 'json';
  
  /** Flag value */
  value: unknown;
  
  /** Targeting rules */
  targeting?: {
    /** User segments */
    segments?: string[];
    
    /** Percentage rollout */
    percentage?: number;
    
    /** Specific user IDs */
    userIds?: string[];
    
    /** Custom rules */
    customRules?: Array<{
      condition: string;
      value: unknown;
    }>;
  };
  
  /** Metadata */
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
    tags: string[];
  };
}

// ============================================================================
// Helper Types for Firestore Operations
// ============================================================================

export interface FirestoreQuery<T> {
  collection: string;
  where?: Array<{
    field: keyof T;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'array-contains';
    value: unknown;
  }>;
  orderBy?: {
    field: keyof T;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  startAfter?: unknown;
}

export interface FirestoreBatch<T> {
  operations: Array<{
    type: 'create' | 'update' | 'delete';
    document: Partial<T>;
    id: string;
  }>;
}

// ============================================================================
// Indexes Required (firestore.indexes.json)
// ============================================================================

export const REQUIRED_INDEXES = [
  {
    collectionGroup: 'ims_policies',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'enabled', order: 'ASCENDING' },
      { fieldPath: 'priority', order: 'ASCENDING' },
      { fieldPath: 'metadata.updatedAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'ims_model_pools',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'enabled', order: 'ASCENDING' },
      { fieldPath: 'metadata.updatedAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'ims_health_status',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'ims_audit_logs',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'traceId', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' }
    ]
  }
];