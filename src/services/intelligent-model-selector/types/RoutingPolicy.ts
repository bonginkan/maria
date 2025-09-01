/**
 * Policy-driven routing configuration types
 */

export interface RoutingPolicy {
  /** Policy identifier */
  id: string;
  
  /** Version for change tracking and reproducibility */
  version: string;
  
  /** Human-readable description */
  description: string;
  
  /** When this policy was created */
  createdAt: Date;
  
  /** Task-specific default configurations */
  taskMatrix: {
    [taskKind: string]: TaskConfiguration;
  };
  
  /** Dynamic routing rules (evaluated in order) */
  rules: RoutingRule[];
  
  /** A/B testing configurations */
  abTests?: ABTestConfiguration[];
  
  /** Emergency overrides */
  emergencyOverrides?: EmergencyOverride[];
}

export interface TaskConfiguration {
  /** Default latency budget for this task type */
  latencyBudgetMs: number;
  
  /** Default cost tier */
  costTier: 'low' | 'mid' | 'high';
  
  /** Whether this task type requires long context by default */
  requireLongWindow?: boolean;
  
  /** Default quality vs speed preference */
  qualityPreference?: 'fast' | 'balanced' | 'quality';
  
  /** Maximum tokens allowed for this task type */
  maxTokensLimit?: number;
}

export interface RoutingRule {
  /** Rule identifier for debugging */
  id: string;
  
  /** Condition to evaluate */
  when: RuleCondition;
  
  /** Actions to take when condition matches */
  then: RuleAction;
  
  /** Rule priority (higher number = higher priority) */
  priority: number;
  
  /** Whether this rule is currently active */
  enabled: boolean;
}

export interface RuleCondition {
  /** Task kind matching */
  'task.kind'?: string | string[];
  
  /** Task subtype matching */
  'task.subtype'?: string | string[];
  
  /** User plan matching */
  'session.plan'?: string | string[];
  
  /** Token count conditions */
  'task.tokensIn'?: {
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
  };
  
  /** Time-based conditions */
  timeOfDay?: {
    start: string; // HH:mm format
    end: string;
    timezone?: string;
  };
  
  /** Usage-based conditions */
  'session.currentUsage'?: {
    tokensUsed?: { gt?: number; gte?: number; lt?: number; lte?: number };
    percentOfQuota?: { gt?: number; gte?: number; lt?: number; lte?: number };
  };
  
  /** Custom conditions */
  custom?: Record<string, any>;
}

export interface RuleAction {
  /** Override pool to use */
  usePool?: string;
  
  /** Override cost tier */
  costTier?: 'low' | 'mid' | 'high';
  
  /** Override latency budget */
  latencyBudgetMs?: number;
  
  /** Override quality preference */
  qualityPreference?: 'fast' | 'balanced' | 'quality';
  
  /** Require specific model capabilities */
  requireCapabilities?: string[];
  
  /** Generation parameter overrides */
  generationParams?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    stop?: string[];
  };
}

export interface ABTestConfiguration {
  /** A/B test name */
  name: string;
  
  /** Percentage of traffic to include (0-1) */
  trafficPercent: number;
  
  /** Whether this is shadow-only (don't return results to user) */
  shadowOnly: boolean;
  
  /** Override rules for test group */
  override: Partial<RuleAction>;
  
  /** Success criteria for promotion */
  promotionCriteria: {
    successRateThreshold: number;
    costIncreaseLimit: number;
    ttfbDegradationLimit: number;
  };
  
  /** Test start and end dates */
  startDate: Date;
  endDate: Date;
  
  /** Whether test is currently active */
  active: boolean;
}

export interface EmergencyOverride {
  /** Override identifier */
  id: string;
  
  /** Override type */
  type: 'kill_switch' | 'force_pool' | 'disable_provider';
  
  /** Override configuration */
  config: {
    /** Force all traffic to specific pool */
    forcePool?: string;
    
    /** Disable specific providers */
    disabledProviders?: string[];
    
    /** Emergency message to users */
    userMessage?: string;
  };
  
  /** When this override expires */
  expiresAt: Date;
  
  /** Who activated this override */
  activatedBy: string;
  
  /** Why this override was activated */
  reason: string;
  
  /** Whether this override is currently active */
  active: boolean;
}