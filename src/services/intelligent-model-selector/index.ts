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

// Component configuration types
export type { PolicyEvaluationResult } from './PolicyEngine.js';
export type { ModelSelectionCandidate, CircuitBreakerState } from './ModelPoolManager.js';
export type { RoutingDecisionResult, SelectionCriteria } from './RoutingDecision.js';
export type { PIIRedactionResult, PIIRedactionReport } from './CompletePIIRedactor.js';
export type { LogQueryOptions, LogAnalytics } from './CompleteDecisionLogger.js';