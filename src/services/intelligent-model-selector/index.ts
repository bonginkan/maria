/**
 * Intelligent Model Selector (IMS) - Main Export
 * Provides clean public API for the complete IMS system
 */

// Main router
export { IMSRouter } from './IMSRouter.js';
export type { IMSRouterConfig, RouteResult, ProviderCallInfo } from './IMSRouter.js';

// Core types for external consumers
export type { TaskInput, ProcessedTaskInput } from './types/TaskInput.js';
export type { CompleteRoutingLog, TTFBBreakdown, ActualPerformanceMetrics } from './types/DecisionLog.js';
export type { RoutingPolicy, RoutingRule, ABTestConfiguration } from './types/RoutingPolicy.js';
export type { ModelPool, ModelDefinition, ProviderHealthStatus } from './types/ModelPool.js';

// Individual components (for advanced usage)
export { PolicyEngine } from './PolicyEngine.js';
export { ModelPoolManager } from './ModelPoolManager.js';
export { RoutingDecisionEngine } from './RoutingDecision.js';
export { CompleteDecisionLogger } from './CompleteDecisionLogger.js';
export { CompletePIIRedactor } from './CompletePIIRedactor.js';

// New Phase 1 components (v2.1 SOW implementation)
export { HysteresisHealthChecker } from './HysteresisHealthChecker.js';
export { RunawayPreventionCircuitBreaker } from './RunawayPreventionCircuitBreaker.js';
export { PreciseCostCalculator } from './PreciseCostCalculator.js';
export { TTFBAuditor } from './TTFBAuditor.js';
export { IdempotencyManager } from './IdempotencyManager.js';
export { HotCache } from './HotCache.js';

// Component configuration types
export type { PolicyEvaluationResult } from './PolicyEngine.js';
export type { ModelSelectionCandidate, CircuitBreakerState } from './ModelPoolManager.js';
export type { RoutingDecisionResult, SelectionCriteria } from './RoutingDecision.js';
export type { PIIRedactionResult, PIIRedactionReport } from './CompletePIIRedactor.js';
export type { LogQueryOptions, LogAnalytics } from './CompleteDecisionLogger.js';

// New component types
export type { 
  HealthMetric, 
  HysteresisConfig, 
  HealthState, 
  ProviderHealthAssessment 
} from './HysteresisHealthChecker.js';
export type { 
  CircuitBreakerState as RunawayCircuitState,
  RunawayPreventionConfig,
  ModelCandidate,
  RunawayPreventionMetrics 
} from './RunawayPreventionCircuitBreaker.js';
export type { 
  PricingType,
  ProviderCostModel,
  CostEstimate,
  ActualCost,
  CostPrediction 
} from './PreciseCostCalculator.js';
export type { 
  TTFBBreakdown,
  TTFBBudget,
  TTFBMeasurement,
  TTFBAnalytics,
  TTFBAlert 
} from './TTFBAuditor.js';
export type { 
  IdempotentRequest,
  IdempotentResponse,
  IdempotencyConfig,
  DuplicateRequestInfo 
} from './IdempotencyManager.js';
export type { 
  CacheEntry,
  CacheConfig,
  CacheStats 
} from './HotCache.js';