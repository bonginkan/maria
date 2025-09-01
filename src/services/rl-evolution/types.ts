/**
 * RL Evolution System Type Definitions
 * Core types for reinforcement learning and self-evolution
 */

// Reward signal types
export interface VerifiableRewards {
  testPassRate: number; // 0-1 scale
  buildSuccess: boolean;
  typeCheckPass: boolean;
  lintErrors: number;
  performanceMetrics: {
    executionTime: number; // milliseconds
    memoryUsage: number; // bytes
    bundleSize?: number; // bytes
  };
}

export interface RubricScores {
  codeQuality: number; // 0-100 scale
  documentation: number; // 0-100 scale
  userSatisfaction: number; // 0-100 scale
  innovativeness: number; // 0-100 scale
  efficiency: number; // 0-100 scale
}

export interface UserSignals {
  thumbsUp: boolean;
  thumbsDown: boolean;
  acceptanceRate: number; // 0-1 scale
  modificationRate: number; // 0-1 scale
  sessionDuration: number; // milliseconds
}

export interface Penalties {
  regressionCount: number;
  errorFrequency: number;
  securityIssues: number;
  performanceDegradation: number;
}

export interface RewardSignals {
  verifiable: VerifiableRewards;
  rubricScores: RubricScores;
  userSignals: UserSignals;
  penalties: Penalties;
  timestamp: Date;
  totalReward?: number;
}

// Episode types for experience replay
export interface Episode {
  id: string;
  timestamp: Date;
  context: EpisodeContext;
  action: EpisodeAction;
  outcome: EpisodeOutcome;
  metadata: EpisodeMetadata;
}

export interface EpisodeContext {
  userQuery: string;
  systemState: {
    mode: string;
    memoryUsage: number;
    activeServices: string[];
  };
  projectInfo?: {
    language: string;
    framework?: string;
    dependencies?: string[];
  };
}

export interface EpisodeAction {
  command: string;
  generatedCode?: string;
  executionPath: string[];
  parameters?: Record<string, unknown>;
}

export interface EpisodeOutcome {
  rewards: RewardSignals;
  errors: Error[];
  userFeedback?: {
    rating?: number;
    comment?: string;
  };
  finalState: Record<string, unknown>;
}

export interface EpisodeMetadata {
  sessionId: string;
  userId?: string;
  projectContext?: string;
  duration: number;
}

// Learning configuration
export interface RLConfig {
  learningRate: number;
  discountFactor: number;
  explorationRate: number;
  batchSize: number;
  replayBufferSize: number;
  updateFrequency: "on-demand" | "hourly" | "daily";
  safetyThresholds: {
    maxRegressionRate: number;
    minTestPassRate: number;
    rollbackThreshold: number;
  };
}

// Policy types
export interface Policy {
  id: string;
  version: number;
  weights: Float32Array | number[];
  performance: PolicyPerformance;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyPerformance {
  avgReward: number;
  successRate: number;
  errorRate: number;
  userSatisfaction: number;
  episodeCount: number;
}

// Evolution modes
export enum RLEvolutionMode {
  CODE_RLVR = "code_rlvr",
  RUBRIC_RL = "rubric_rl",
  BANDIT_ROUTER = "bandit_router",
  MEMORY_CONSOLIDATION = "memory_consolidation",
  ERROR_RECOVERY = "error_recovery",
  PERFORMANCE_TUNING = "performance_tuning",
  USER_ADAPTATION = "user_adaptation",
  SAFETY_VALIDATION = "safety_validation",
}

// Rubric types
export interface Rubric {
  id: string;
  name: string;
  weight: number;
  criteria: RubricCriterion[];
  scoringScale: ScoringScale;
}

export interface RubricCriterion {
  name: string;
  description: string;
  weight: number;
  evaluationType: "ai" | "rule" | "hybrid";
}

export interface ScoringScale {
  excellent: [number, number];
  good: [number, number];
  needsImprovement: [number, number];
  poor: [number, number];
}

// Experience buffer types
export interface ExperienceBuffer {
  episodes: Episode[];
  maxSize: number;
  priorityQueue: PriorityQueue<Episode>;

  add(episode: Episode): void;
  getPrioritizedBatch(size: number): Episode[];
  getFailureClusters(): FailureCluster[];
  clear(): void;
}

export interface PriorityQueue<T> {
  enqueue(_item: T, priority: number): void;
  dequeue(): T | undefined;
  peek(): T | undefined;
  size(): number;
}

export interface FailureCluster {
  id: string;
  errorType: string;
  episodes: Episode[];
  commonPattern?: string;
  suggestedFix?: string;
}

// Evolution report types
export interface EvolutionReport {
  timestamp: Date;
  metrics: {
    totalEpisodes: number;
    avgReward: number;
    improvementRate: number;
    regressionRate: number;
  };
  learnings: Learning[];
  recommendations: string[];
  policyVersion: number;
}

export interface Learning {
  type: "pattern" | "antipattern" | "optimization";
  description: string;
  impact: "high" | "medium" | "low";
  examples: string[];
}

// Safety validation types
export interface ValidationResult {
  passed: boolean;
  checks: SafetyCheck[];
  recommendation: "deploy" | "review" | "rollback";
  details?: string;
}

export interface SafetyCheck {
  name: string;
  passed: boolean;
  score?: number;
  threshold?: number;
  message?: string;
}

// Skill graph types (for memory integration)
export interface SkillNode {
  id: string;
  skillName: string;
  category: string;
  metrics: {
    successRate: number;
    avgExecutionTime: number;
    testPassRate: number;
    userSatisfaction: number;
  };
  evolution: {
    version: number;
    lastUpdated: Date;
    improvementRate: number;
    regressionCount: number;
  };
  patterns: CodePattern[];
  antiPatterns: AntiPattern[];
  policyWeights?: Float32Array;
}

export interface CodePattern {
  id: string;
  pattern: string;
  frequency: number;
  successRate: number;
  example?: string;
}

export interface AntiPattern {
  id: string;
  pattern: string;
  errorRate: number;
  avoidanceStrategy?: string;
  example?: string;
}
