/**
 * MARIA Memory System - Core Type Definitions
 *
 * Comprehensive memory interfaces based on Cipher's dual-layer architecture
 * System 1: Fast, intuitive memory patterns
 * System 2: Deliberate reasoning and quality traces
 */

export interface MemoryEvent {
  id: string;
  type: MemoryEventType;
  timestamp: Date;
  userId: string;
  sessionId: string;
  data: unknown;
  reasoning?: ReasoningTrace;
  metadata: EventMetadata;
}

export type MemoryEventType =
  | 'code_generation'
  | 'bug_fix'
  | 'quality_improvement'
  | 'team_interaction'
  | 'learning_update'
  | 'pattern_recognition'
  | 'mode_change';

export interface EventMetadata {
  confidence: number;
  source: 'user_input' | 'ai_generated' | 'system_inferred';
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  projectId?: string;
  teamId?: string;
}

// System 1 Memory: Fast, intuitive patterns
export interface System1Memory {
  programmingConcepts: KnowledgeNode[];
  businessLogic: ConceptGraph;
  pastInteractions: InteractionHistory;
  codePatterns: PatternLibrary;
  userPreferences: UserPreferenceSet;
}

export interface KnowledgeNode {
  id: string;
  type: 'function' | 'class' | 'module' | 'concept' | 'pattern';
  name: string;
  content: string;
  embedding: number[];
  confidence: number;
  lastAccessed: Date;
  accessCount: number;
  metadata: NodeMetadata;
}

export interface NodeMetadata {
  language?: string;
  framework?: string;
  domain?: string;
  complexity: 'low' | 'medium' | 'high';
  quality: number; // 0-1 score
  relevance: number; // 0-1 score
}

export interface ConceptGraph {
  nodes: Map<string, KnowledgeNode>;
  edges: Map<string, ConceptEdge>;
  clusters: ConceptCluster[];
}

export interface ConceptEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'depends_on' | 'implements' | 'uses' | 'similar_to' | 'extends';
  weight: number;
  confidence: number;
}

export interface ConceptCluster {
  id: string;
  name: string;
  nodeIds: string[];
  centroid: number[];
  coherence: number;
}

export interface InteractionHistory {
  sessions: SessionRecord[];
  commands: CommandHistory[];
  patterns: UsagePattern[];
}

export interface SessionRecord {
  id: string;
  startTime: Date;
  endTime?: Date;
  userId: string;
  commands: string[];
  outcomes: SessionOutcome[];
  satisfaction?: number; // 1-5 rating
}

export interface CommandHistory {
  command: string;
  frequency: number;
  lastUsed: Date;
  successRate: number;
  averageExecutionTime: number;
  userSatisfaction: number;
}

export interface UsagePattern {
  id: string;
  type: 'temporal' | 'sequential' | 'contextual';
  pattern: string;
  frequency: number;
  confidence: number;
  conditions: PatternCondition[];
}

export interface PatternCondition {
  type: 'time_of_day' | 'project_type' | 'team_size' | 'complexity';
  value: string | number;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
}

export interface PatternLibrary {
  codePatterns: CodePattern[];
  antiPatterns: AntiPattern[];
  bestPractices: BestPractice[];
  templates: CodeTemplate[];
}

export interface CodePattern {
  id: string;
  name: string;
  description: string;
  code: string;
  language: string;
  framework?: string;
  useCase: string;
  complexity: 'beginner' | 'intermediate' | 'advanced';
  performance: PerformanceMetrics;
  examples: CodeExample[];
}

export interface AntiPattern {
  id: string;
  name: string;
  description: string;
  problem: string;
  solution: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectionRules: DetectionRule[];
}

export interface DetectionRule {
  type: 'syntax' | 'semantic' | 'performance' | 'security';
  pattern: string;
  confidence: number;
}

export interface BestPractice {
  id: string;
  name: string;
  description: string;
  category: string;
  applicability: ApplicabilityRule[];
  benefits: string[];
  implementation: ImplementationGuide;
}

export interface ApplicabilityRule {
  condition: string;
  context: string[];
  priority: number;
}

export interface ImplementationGuide {
  steps: string[];
  examples: CodeExample[];
  tools: string[];
  estimatedTime: number; // minutes
}

export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: TemplateVariable[];
  language: string;
  framework?: string;
  category: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  default?: unknown;
  description: string;
  required: boolean;
}

export interface CodeExample {
  id: string;
  title: string;
  code: string;
  language: string;
  explanation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface PerformanceMetrics {
  timeComplexity: string;
  spaceComplexity: string;
  benchmarks?: BenchmarkResult[];
}

export interface BenchmarkResult {
  environment: string;
  executionTime: number; // milliseconds
  memoryUsage: number; // bytes
  throughput?: number; // operations per second
}

// System 2 Memory: Deliberate reasoning and quality traces
export interface System2Memory {
  reasoningSteps: ReasoningTrace[];
  qualityEvaluation: QualityMetrics;
  decisionContext: DecisionTree;
  improvementSuggestions: Enhancement[];
  reflectionData: ReflectionEntry[];
}

export interface ReasoningTrace {
  id: string;
  timestamp: Date;
  context: ReasoningContext;
  steps: ReasoningStep[];
  conclusion: string;
  confidence: number;
  alternatives: AlternativeReasoning[];
  metadata: ReasoningMetadata;
}

export interface ReasoningContext {
  problem: string;
  goals: string[];
  constraints: string[];
  assumptions: string[];
  availableResources: string[];
}

export interface ReasoningStep {
  id: string;
  type: 'analysis' | 'synthesis' | 'evaluation' | 'inference';
  description: string;
  input: string;
  output: string;
  confidence: number;
  duration: number; // milliseconds
  dependencies: string[]; // step IDs
}

export interface AlternativeReasoning {
  id: string;
  description: string;
  steps: ReasoningStep[];
  pros: string[];
  cons: string[];
  confidence: number;
  rejected: boolean;
  rejectionReason?: string;
}

export interface ReasoningMetadata {
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  domain: string;
  techniques: string[];
  qualityScore: number; // 0-1
  reviewRequired: boolean;
}

export interface QualityMetrics {
  codeQuality: CodeQualityMetrics;
  reasoningQuality: ReasoningQualityMetrics;
  userSatisfaction: SatisfactionMetrics;
  systemPerformance: PerformanceMetrics;
}

export interface CodeQualityMetrics {
  maintainability: number; // 0-100
  readability: number; // 0-100
  testability: number; // 0-100
  performance: number; // 0-100
  security: number; // 0-100
  bugDensity: number; // bugs per 1000 lines
  complexity: number; // cyclomatic complexity
}

export interface ReasoningQualityMetrics {
  coherence: number; // 0-1
  completeness: number; // 0-1
  accuracy: number; // 0-1
  efficiency: number; // 0-1
  creativity: number; // 0-1
}

export interface SatisfactionMetrics {
  userRating: number; // 1-5
  taskCompletion: number; // 0-1
  timeToSolution: number; // minutes
  iterationCount: number;
  userFeedback: string[];
}

export interface DecisionTree {
  id: string;
  rootNode: DecisionNode;
  metadata: DecisionTreeMetadata;
}

export interface DecisionNode {
  id: string;
  type: 'condition' | 'action' | 'outcome';
  description: string;
  children: DecisionNode[];
  confidence: number;
  evidence: Evidence[];
  alternatives: DecisionNode[];
}

export interface Evidence {
  type: 'empirical' | 'theoretical' | 'heuristic' | 'user_feedback';
  description: string;
  strength: number; // 0-1
  source: string;
  timestamp: Date;
}

export interface DecisionTreeMetadata {
  domain: string;
  complexity: number;
  accuracy: number;
  lastUpdated: Date;
  usageCount: number;
}

export interface Enhancement {
  id: string;
  type: 'performance' | 'quality' | 'usability' | 'feature';
  description: string;
  impact: ImpactAssessment;
  implementation: ImplementationPlan;
  priority: number; // 1-10
  status: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'rejected';
}

export interface ImpactAssessment {
  benefitScore: number; // 0-10
  effortScore: number; // 0-10
  riskScore: number; // 0-10
  affectedUsers: number;
  affectedComponents: string[];
}

export interface ImplementationPlan {
  phases: ImplementationPhase[];
  timeline: number; // days
  resources: RequiredResource[];
  dependencies: string[];
  risks: Risk[];
}

export interface ImplementationPhase {
  id: string;
  name: string;
  description: string;
  duration: number; // days
  deliverables: string[];
  dependencies: string[];
}

export interface RequiredResource {
  type: 'developer' | 'designer' | 'infrastructure' | 'tool';
  quantity: number;
  duration: number; // days
  cost?: number;
}

export interface Risk {
  id: string;
  description: string;
  probability: number; // 0-1
  impact: number; // 0-10
  mitigation: string;
  contingency: string;
}

export interface ReflectionEntry {
  id: string;
  timestamp: Date;
  trigger: string;
  observation: string;
  analysis: string;
  insight: string;
  actionItems: ActionItem[];
  confidence: number;
}

export interface ActionItem {
  id: string;
  description: string;
  priority: number; // 1-10
  dueDate?: Date;
  assignee?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
}

// User Preferences and Learning
export interface UserPreferenceSet {
  developmentStyle: DevelopmentStyle;
  communicationPreferences: CommunicationPreferences;
  toolPreferences: ToolPreferences;
  learningStyle: LearningStyle;
  qualityStandards: QualityStandards;
}

export interface DevelopmentStyle {
  approach: 'test-driven' | 'prototype-first' | 'documentation-heavy' | 'iterative';
  preferredLanguages: LanguagePreference[];
  architecturalPatterns: ArchitecturalPattern[];
  problemSolvingStyle: 'systematic' | 'intuitive' | 'collaborative' | 'experimental';
  workPace: 'fast' | 'moderate' | 'thorough';
}

export interface LanguagePreference {
  language: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  frequency: number; // 0-1
  preference: number; // 1-5
}

export interface ArchitecturalPattern {
  name: string;
  familiarity: number; // 0-1
  preference: number; // 1-5
  usageFrequency: number; // 0-1
}

export interface CommunicationPreferences {
  verbosity: 'minimal' | 'moderate' | 'detailed' | 'comprehensive';
  explanationDepth: 'surface' | 'intermediate' | 'deep';
  codeCommentStyle: 'none' | 'inline' | 'docstring' | 'comprehensive';
  feedbackStyle: 'direct' | 'constructive' | 'encouraging' | 'detailed';
}

export interface ToolPreferences {
  ide: string[];
  frameworks: FrameworkPreference[];
  libraries: LibraryPreference[];
  buildTools: string[];
  testingTools: string[];
}

export interface FrameworkPreference {
  name: string;
  category: string;
  proficiency: number; // 0-1
  preference: number; // 1-5
}

export interface LibraryPreference {
  name: string;
  category: string;
  proficiency: number; // 0-1
  preference: number; // 1-5
}

export interface LearningStyle {
  preferredMethods: LearningMethod[];
  pace: 'slow' | 'moderate' | 'fast';
  complexity: 'simple_to_complex' | 'complex_first' | 'example_driven';
  feedback: 'immediate' | 'milestone' | 'completion';
}

export interface LearningMethod {
  type: 'visual' | 'auditory' | 'kinesthetic' | 'reading' | 'hands_on';
  effectiveness: number; // 0-1
  preference: number; // 1-5
}

export interface QualityStandards {
  codeQuality: QualityThreshold[];
  testCoverage: number; // 0-100
  documentation: DocumentationStandard;
  performance: PerformanceStandard;
  security: SecurityStandard;
}

export interface QualityThreshold {
  metric: string;
  threshold: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface DocumentationStandard {
  required: boolean;
  style: 'minimal' | 'standard' | 'comprehensive';
  formats: string[];
}

export interface PerformanceStandard {
  responseTime: number; // milliseconds
  throughput: number; // requests per second
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
}

export interface SecurityStandard {
  requirements: SecurityRequirement[];
  compliance: ComplianceStandard[];
  scanningEnabled: boolean;
}

export interface SecurityRequirement {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mandatory: boolean;
}

export interface ComplianceStandard {
  name: string;
  version: string;
  requirements: string[];
}

// Session and Context Management
export interface SessionOutcome {
  type: 'success' | 'partial_success' | 'failure' | 'cancelled';
  description: string;
  metrics: SessionMetrics;
  feedback: UserFeedback[];
}

export interface SessionMetrics {
  duration: number; // minutes
  commandsExecuted: number;
  errorsEncountered: number;
  linesOfCodeGenerated: number;
  bugsFixed: number;
  qualityImprovements: number;
}

export interface UserFeedback {
  type: 'rating' | 'comment' | 'suggestion' | 'complaint';
  content: string;
  timestamp: Date;
  sentiment: 'positive' | 'neutral' | 'negative';
  actionable: boolean;
}

// Memory System Configuration
export interface MemorySystemConfig {
  system1Config: System1Config;
  system2Config: System2Config;
  coordinatorConfig: CoordinatorConfig;
  performanceConfig: PerformanceConfig;
}

export interface System1Config {
  maxKnowledgeNodes: number;
  embeddingDimension: number;
  cacheSize: number;
  compressionThreshold: number;
  accessDecayRate: number;
}

export interface System2Config {
  maxReasoningTraces: number;
  qualityThreshold: number;
  reflectionFrequency: number; // hours
  enhancementEvaluationInterval: number; // hours
}

export interface CoordinatorConfig {
  syncInterval: number; // milliseconds
  conflictResolutionStrategy: 'system1_priority' | 'system2_priority' | 'balanced';
  learningRate: number; // 0-1
  adaptationThreshold: number; // 0-1
}

export interface PerformanceConfig {
  lazyLoadingEnabled: boolean;
  cacheStrategy: 'lru' | 'lfu' | 'adaptive';
  batchSize: number;
  timeout: number; // milliseconds
  memoryLimit: number; // MB
}
