export { createCLI } from './cli.js';
import { EventEmitter } from 'events';
import 'commander';

/**
 * MARIA Memory System - Core Type Definitions
 *
 * Comprehensive memory interfaces based on Cipher's dual-layer architecture
 * System 1: Fast, intuitive memory patterns
 * System 2: Deliberate reasoning and quality traces
 */
interface MemoryEvent {
    id: string;
    type: MemoryEventType;
    timestamp: Date;
    userId: string;
    sessionId: string;
    data: unknown;
    reasoning?: ReasoningTrace;
    metadata: EventMetadata;
}
type MemoryEventType = 'code_generation' | 'bug_fix' | 'quality_improvement' | 'team_interaction' | 'learning_update' | 'pattern_recognition' | 'mode_change';
interface EventMetadata {
    confidence: number;
    source: 'user_input' | 'ai_generated' | 'system_inferred';
    priority: 'low' | 'medium' | 'high' | 'critical';
    tags: string[];
    projectId?: string;
    teamId?: string;
}
interface System1Memory {
    programmingConcepts: KnowledgeNode[];
    businessLogic: ConceptGraph;
    pastInteractions: InteractionHistory;
    codePatterns: PatternLibrary;
    userPreferences: UserPreferenceSet;
}
interface KnowledgeNode {
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
interface NodeMetadata {
    language?: string;
    framework?: string;
    domain?: string;
    complexity: 'low' | 'medium' | 'high';
    quality: number;
    relevance: number;
}
interface ConceptGraph {
    nodes: Map<string, KnowledgeNode>;
    edges: Map<string, ConceptEdge>;
    clusters: ConceptCluster[];
}
interface ConceptEdge {
    id: string;
    sourceId: string;
    targetId: string;
    type: 'depends_on' | 'implements' | 'uses' | 'similar_to' | 'extends';
    weight: number;
    confidence: number;
}
interface ConceptCluster {
    id: string;
    name: string;
    nodeIds: string[];
    centroid: number[];
    coherence: number;
}
interface InteractionHistory {
    sessions: SessionRecord[];
    commands: CommandHistory[];
    patterns: UsagePattern[];
}
interface SessionRecord {
    id: string;
    startTime: Date;
    endTime?: Date;
    userId: string;
    commands: string[];
    outcomes: SessionOutcome[];
    satisfaction?: number;
}
interface CommandHistory {
    command: string;
    frequency: number;
    lastUsed: Date;
    successRate: number;
    averageExecutionTime: number;
    userSatisfaction: number;
}
interface UsagePattern {
    id: string;
    type: 'temporal' | 'sequential' | 'contextual';
    pattern: string;
    frequency: number;
    confidence: number;
    conditions: PatternCondition[];
}
interface PatternCondition {
    type: 'time_of_day' | 'project_type' | 'team_size' | 'complexity';
    value: string | number;
    operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
}
interface PatternLibrary {
    codePatterns: CodePattern[];
    antiPatterns: AntiPattern[];
    bestPractices: BestPractice[];
    templates: CodeTemplate[];
}
interface CodePattern {
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
interface AntiPattern {
    id: string;
    name: string;
    description: string;
    problem: string;
    solution: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    detectionRules: DetectionRule[];
}
interface DetectionRule {
    type: 'syntax' | 'semantic' | 'performance' | 'security';
    pattern: string;
    confidence: number;
}
interface BestPractice {
    id: string;
    name: string;
    description: string;
    category: string;
    applicability: ApplicabilityRule[];
    benefits: string[];
    implementation: ImplementationGuide;
}
interface ApplicabilityRule {
    condition: string;
    context: string[];
    priority: number;
}
interface ImplementationGuide {
    steps: string[];
    examples: CodeExample[];
    tools: string[];
    estimatedTime: number;
}
interface CodeTemplate {
    id: string;
    name: string;
    description: string;
    template: string;
    variables: TemplateVariable[];
    language: string;
    framework?: string;
    category: string;
}
interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    default?: unknown;
    description: string;
    required: boolean;
}
interface CodeExample {
    id: string;
    title: string;
    code: string;
    language: string;
    explanation: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
}
interface PerformanceMetrics {
    timeComplexity: string;
    spaceComplexity: string;
    benchmarks?: BenchmarkResult[];
}
interface BenchmarkResult {
    environment: string;
    executionTime: number;
    memoryUsage: number;
    throughput?: number;
}
interface System2Memory {
    reasoningSteps: ReasoningTrace[];
    qualityEvaluation: QualityMetrics;
    decisionContext: DecisionTree;
    improvementSuggestions: Enhancement[];
    reflectionData: ReflectionEntry[];
}
interface ReasoningTrace {
    id: string;
    timestamp: Date;
    context: ReasoningContext;
    steps: ReasoningStep[];
    conclusion: string;
    confidence: number;
    alternatives: AlternativeReasoning[];
    metadata: ReasoningMetadata;
}
interface ReasoningContext {
    problem: string;
    goals: string[];
    constraints: string[];
    assumptions: string[];
    availableResources: string[];
}
interface ReasoningStep {
    id: string;
    type: 'analysis' | 'synthesis' | 'evaluation' | 'inference';
    description: string;
    input: string;
    output: string;
    confidence: number;
    duration: number;
    dependencies: string[];
}
interface AlternativeReasoning {
    id: string;
    description: string;
    steps: ReasoningStep[];
    pros: string[];
    cons: string[];
    confidence: number;
    rejected: boolean;
    rejectionReason?: string;
}
interface ReasoningMetadata {
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    domain: string;
    techniques: string[];
    qualityScore: number;
    reviewRequired: boolean;
}
interface QualityMetrics {
    codeQuality: CodeQualityMetrics;
    reasoningQuality: ReasoningQualityMetrics;
    userSatisfaction: SatisfactionMetrics;
    systemPerformance: PerformanceMetrics;
}
interface CodeQualityMetrics {
    maintainability: number;
    readability: number;
    testability: number;
    performance: number;
    security: number;
    bugDensity: number;
    complexity: number;
}
interface ReasoningQualityMetrics {
    coherence: number;
    completeness: number;
    accuracy: number;
    efficiency: number;
    creativity: number;
}
interface SatisfactionMetrics {
    userRating: number;
    taskCompletion: number;
    timeToSolution: number;
    iterationCount: number;
    userFeedback: string[];
}
interface DecisionTree {
    id: string;
    rootNode: DecisionNode;
    metadata: DecisionTreeMetadata;
}
interface DecisionNode {
    id: string;
    type: 'condition' | 'action' | 'outcome';
    description: string;
    children: DecisionNode[];
    confidence: number;
    evidence: Evidence[];
    alternatives: DecisionNode[];
}
interface Evidence {
    type: 'empirical' | 'theoretical' | 'heuristic' | 'user_feedback';
    description: string;
    strength: number;
    source: string;
    timestamp: Date;
}
interface DecisionTreeMetadata {
    domain: string;
    complexity: number;
    accuracy: number;
    lastUpdated: Date;
    usageCount: number;
}
interface Enhancement {
    id: string;
    type: 'performance' | 'quality' | 'usability' | 'feature';
    description: string;
    impact: ImpactAssessment;
    implementation: ImplementationPlan;
    priority: number;
    status: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'rejected';
}
interface ImpactAssessment {
    benefitScore: number;
    effortScore: number;
    riskScore: number;
    affectedUsers: number;
    affectedComponents: string[];
}
interface ImplementationPlan {
    phases: ImplementationPhase[];
    timeline: number;
    resources: RequiredResource[];
    dependencies: string[];
    risks: Risk[];
}
interface ImplementationPhase {
    id: string;
    name: string;
    description: string;
    duration: number;
    deliverables: string[];
    dependencies: string[];
}
interface RequiredResource {
    type: 'developer' | 'designer' | 'infrastructure' | 'tool';
    quantity: number;
    duration: number;
    cost?: number;
}
interface Risk {
    id: string;
    description: string;
    probability: number;
    impact: number;
    mitigation: string;
    contingency: string;
}
interface ReflectionEntry {
    id: string;
    timestamp: Date;
    trigger: string;
    observation: string;
    analysis: string;
    insight: string;
    actionItems: ActionItem[];
    confidence: number;
}
interface ActionItem {
    id: string;
    description: string;
    priority: number;
    dueDate?: Date;
    assignee?: string;
    status: 'open' | 'in_progress' | 'completed' | 'cancelled';
}
interface UserPreferenceSet {
    developmentStyle: DevelopmentStyle;
    communicationPreferences: CommunicationPreferences;
    toolPreferences: ToolPreferences;
    learningStyle: LearningStyle;
    qualityStandards: QualityStandards;
}
interface DevelopmentStyle {
    approach: 'test-driven' | 'prototype-first' | 'documentation-heavy' | 'iterative';
    preferredLanguages: LanguagePreference[];
    architecturalPatterns: ArchitecturalPattern[];
    problemSolvingStyle: 'systematic' | 'intuitive' | 'collaborative' | 'experimental';
    workPace: 'fast' | 'moderate' | 'thorough';
}
interface LanguagePreference {
    language: string;
    proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    frequency: number;
    preference: number;
}
interface ArchitecturalPattern {
    name: string;
    familiarity: number;
    preference: number;
    usageFrequency: number;
}
interface CommunicationPreferences {
    verbosity: 'minimal' | 'moderate' | 'detailed' | 'comprehensive';
    explanationDepth: 'surface' | 'intermediate' | 'deep';
    codeCommentStyle: 'none' | 'inline' | 'docstring' | 'comprehensive';
    feedbackStyle: 'direct' | 'constructive' | 'encouraging' | 'detailed';
}
interface ToolPreferences {
    ide: string[];
    frameworks: FrameworkPreference[];
    libraries: LibraryPreference[];
    buildTools: string[];
    testingTools: string[];
}
interface FrameworkPreference {
    name: string;
    category: string;
    proficiency: number;
    preference: number;
}
interface LibraryPreference {
    name: string;
    category: string;
    proficiency: number;
    preference: number;
}
interface LearningStyle {
    preferredMethods: LearningMethod[];
    pace: 'slow' | 'moderate' | 'fast';
    complexity: 'simple_to_complex' | 'complex_first' | 'example_driven';
    feedback: 'immediate' | 'milestone' | 'completion';
}
interface LearningMethod {
    type: 'visual' | 'auditory' | 'kinesthetic' | 'reading' | 'hands_on';
    effectiveness: number;
    preference: number;
}
interface QualityStandards {
    codeQuality: QualityThreshold[];
    testCoverage: number;
    documentation: DocumentationStandard;
    performance: PerformanceStandard;
    security: SecurityStandard;
}
interface QualityThreshold {
    metric: string;
    threshold: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
}
interface DocumentationStandard {
    required: boolean;
    style: 'minimal' | 'standard' | 'comprehensive';
    formats: string[];
}
interface PerformanceStandard {
    responseTime: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
}
interface SecurityStandard {
    requirements: SecurityRequirement[];
    compliance: ComplianceStandard[];
    scanningEnabled: boolean;
}
interface SecurityRequirement {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    mandatory: boolean;
}
interface ComplianceStandard {
    name: string;
    version: string;
    requirements: string[];
}
interface SessionOutcome {
    type: 'success' | 'partial_success' | 'failure' | 'cancelled';
    description: string;
    metrics: SessionMetrics;
    feedback: UserFeedback[];
}
interface SessionMetrics {
    duration: number;
    commandsExecuted: number;
    errorsEncountered: number;
    linesOfCodeGenerated: number;
    bugsFixed: number;
    qualityImprovements: number;
}
interface UserFeedback {
    type: 'rating' | 'comment' | 'suggestion' | 'complaint';
    content: string;
    timestamp: Date;
    sentiment: 'positive' | 'neutral' | 'negative';
    actionable: boolean;
}
interface System1Config {
    maxKnowledgeNodes: number;
    embeddingDimension: number;
    cacheSize: number;
    compressionThreshold: number;
    accessDecayRate: number;
}
interface System2Config {
    maxReasoningTraces: number;
    qualityThreshold: number;
    reflectionFrequency: number;
    enhancementEvaluationInterval: number;
}
interface CoordinatorConfig {
    syncInterval: number;
    conflictResolutionStrategy: 'system1_priority' | 'system2_priority' | 'balanced';
    learningRate: number;
    adaptationThreshold: number;
}
interface PerformanceConfig {
    lazyLoadingEnabled: boolean;
    cacheStrategy: 'lru' | 'lfu' | 'adaptive';
    batchSize: number;
    timeout: number;
    memoryLimit: number;
}

/**
 * MARIA Memory System - Dual Memory Engine
 *
 * Core integration logic for System 1 (fast, intuitive) and System 2 (deliberate, analytical) memory
 * Orchestrates memory operations, layer selection, and cross-system optimization
 */

interface DualMemoryEngineConfig {
    system1: System1Config;
    system2: System2Config;
    coordinator: CoordinatorConfig;
    performance: PerformanceConfig;
}
interface MemoryQuery {
    type: 'knowledge' | 'pattern' | 'reasoning' | 'quality' | 'preference';
    query: string;
    context?: Record<string, unknown>;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    embedding?: number[];
    limit?: number;
}
interface MemoryResponse<T = unknown> {
    data: T;
    source: 'system1' | 'system2' | 'both';
    confidence: number;
    latency: number;
    cached: boolean;
    suggestions?: Enhancement[];
}
interface MemoryOperationMetrics {
    totalOperations: number;
    system1Operations: number;
    system2Operations: number;
    averageLatency: number;
    cacheHitRate: number;
    errorRate: number;
    lastReset: Date;
}
declare class DualMemoryEngine {
    private system1;
    private system2;
    private config;
    private operationMetrics;
    private eventQueue;
    private processingLock;
    private performanceCache;
    constructor(config: DualMemoryEngineConfig);
    query<T = unknown>(memoryQuery: MemoryQuery): Promise<MemoryResponse<T>>;
    store(event: MemoryEvent): Promise<void>;
    learn(input: string, output: string, context: Record<string, unknown>, success: boolean): Promise<void>;
    findKnowledge(query: string, embedding?: number[], limit?: number): Promise<MemoryResponse<KnowledgeNode[]>>;
    findPatterns(language?: string, framework?: string, useCase?: string, limit?: number): Promise<MemoryResponse<CodePattern[]>>;
    getReasoning(domain?: string, complexity?: string, minQuality?: number): Promise<MemoryResponse<ReasoningTrace[]>>;
    getQualityInsights(): Promise<MemoryResponse<QualityMetrics>>;
    getUserPreferences(): Promise<MemoryResponse<UserPreferenceSet>>;
    recall(options: {
        query: string;
        type: string;
        limit?: number;
    }): Promise<unknown[]>;
    clearMemory(): Promise<void>;
    private selectMemoryStrategy;
    private getUrgencyScore;
    private assessQueryComplexity;
    private getTypePreference;
    private getCacheStatus;
    private calculateSystem1Score;
    private calculateSystem2Score;
    private executeMemoryOperation;
    private executeSystem1Operation;
    private executeSystem2Operation;
    private executeCombinedOperation;
    private combineResults;
    private generateCombinedSuggestions;
    private processEvent;
    private determineEventRouting;
    private adaptFromEvent;
    private startBackgroundProcessing;
    private processEventQueue;
    private cleanupCache;
    private optimizeMemory;
    private generateCacheKey;
    private isCacheValid;
    private updateOperationMetrics;
    private initializeMetrics;
    getMetrics(): MemoryOperationMetrics;
    resetMetrics(): void;
    getCacheSize(): number;
    getQueueSize(): number;
    initialize(): Promise<void>;
    updateConfig(newConfig: Partial<DualMemoryEngineConfig>): void;
    getConfig(): DualMemoryEngineConfig;
    getStatistics(): Promise<{
        system1: {
            totalNodes: number;
            patterns: number;
            preferences: number;
            cacheHitRate: number;
        };
        system2: {
            reasoningTraces: number;
            decisionTrees: number;
            activeSessions: number;
            memoryUsage: number;
        };
    }>;
}

/**
 * MARIA Memory System - Memory Coordinator
 *
 * Cross-layer coordination and optimization between System 1 and System 2 memory
 * Manages synchronization, performance optimization, and adaptive learning
 */

interface CoordinationMetrics {
    syncOperations: number;
    optimizationRuns: number;
    adaptationEvents: number;
    crossLayerTransfers: number;
    performanceImprovements: number;
    lastOptimization: Date;
    averageSyncTime: number;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
}
interface OptimizationRecommendation {
    id: string;
    type: 'performance' | 'memory' | 'learning' | 'synchronization';
    priority: number;
    description: string;
    impact: {
        performance: number;
        memory: number;
        latency: number;
    };
    implementation: {
        effort: 'low' | 'medium' | 'high';
        risk: 'low' | 'medium' | 'high';
        timeline: number;
    };
    automated: boolean;
}
interface SynchronizationReport {
    system1State: {
        knowledgeNodes: number;
        patterns: number;
        interactions: number;
        cacheHitRate: number;
    };
    system2State: {
        reasoningTraces: number;
        qualityMetrics: QualityMetrics;
        enhancements: number;
        reflections: number;
    };
    synchronizationPoints: SyncPoint[];
    conflictResolutions: ConflictResolution[];
    recommendations: OptimizationRecommendation[];
}
interface SyncPoint {
    id: string;
    timestamp: Date;
    type: 'knowledge_transfer' | 'pattern_learning' | 'quality_feedback' | 'user_adaptation';
    source: 'system1' | 'system2';
    target: 'system1' | 'system2';
    data: unknown;
    success: boolean;
    latency: number;
}
interface ConflictResolution {
    id: string;
    timestamp: Date;
    conflictType: 'data_inconsistency' | 'preference_mismatch' | 'quality_threshold' | 'performance_tradeoff';
    description: string;
    resolution: string;
    confidence: number;
    impact: 'low' | 'medium' | 'high';
}
declare class MemoryCoordinator {
    private system1;
    private system2;
    private dualEngine;
    private config;
    private metrics;
    private syncPoints;
    private conflicts;
    private recommendations;
    private optimizationTimer?;
    private syncTimer?;
    constructor(dualEngine: DualMemoryEngine, config?: CoordinatorConfig);
    synchronizeSystems(): Promise<SynchronizationReport>;
    optimizePerformance(): Promise<OptimizationRecommendation[]>;
    adaptToUserBehavior(event: MemoryEvent): Promise<void>;
    resolveConflicts(): Promise<ConflictResolution[]>;
    private performCrossLayerSync;
    private syncKnowledgeToReasoning;
    private syncQualityToPatterns;
    private syncUserPreferences;
    private syncLearningData;
    private analyzePerformance;
    private generateOptimizationRecommendations;
    private applyAutomatedOptimizations;
    private applyOptimization;
    private detectConflicts;
    private resolveConflict;
    private analyzeBehaviorPattern;
    private determineAdaptation;
    private performCrossLayerAdaptation;
    private getSystem1State;
    private getSystem2State;
    private getRecentSyncPoints;
    private getRecentConflicts;
    private recordSyncPoint;
    private getDefaultConfig;
    private startCoordination;
    private initializeMetrics;
    private transferKnowledgeToReasoning;
    private updatePatternsForMaintainability;
    private updatePatternsForSecurity;
    private adaptReasoningForTDD;
    private adaptReasoningForSystematicApproach;
    private integratePatternLearning;
    private identifyBottlenecks;
    private identifyOptimizationOpportunities;
    private optimizePerformanceSettings;
    private optimizeMemoryUsage;
    private optimizeLearningSettings;
    private optimizeSynchronizationSettings;
    private adjustQualityThresholds;
    private optimizeSystem2Performance;
    private adaptSystem1ForCodeGeneration;
    private adaptSystem2ForQuality;
    private updateAdaptiveLearning;
    getMetrics(): CoordinationMetrics;
    getRecommendations(): OptimizationRecommendation[];
    forceOptimization(): Promise<OptimizationRecommendation[]>;
    forceSynchronization(): Promise<SynchronizationReport>;
    updateConfig(newConfig: Partial<CoordinatorConfig>): void;
    destroy(): void;
}

/**
 * MARIA Memory System - System 1 Memory Implementation
 *
 * Fast, intuitive memory patterns for immediate responses
 * Handles programming concepts, code patterns, and user preferences
 */

declare class System1MemoryManager implements System1Memory {
    private knowledgeNodes;
    userPreferences: UserPreferenceSet;
    private conceptGraph;
    private interactionHistory;
    private patternLibrary;
    private config;
    private cache;
    private lastAccessTimes;
    constructor(config: System1Config);
    get programmingConcepts(): KnowledgeNode[];
    get businessLogic(): ConceptGraph;
    get pastInteractions(): InteractionHistory;
    get codePatterns(): PatternLibrary;
    addKnowledgeNode(type: KnowledgeNode['type'], name: string, content: string, embedding: number[], metadata?: Partial<NodeMetadata>): Promise<KnowledgeNode>;
    getKnowledgeNode(id: string): Promise<KnowledgeNode | null>;
    searchKnowledgeNodes(query: string, queryEmbedding: number[], limit?: number): Promise<KnowledgeNode[]>;
    updateKnowledgeNode(id: string, updates: Partial<KnowledgeNode>): Promise<boolean>;
    addConceptEdge(sourceId: string, targetId: string, type: ConceptEdge['type'], weight?: number, confidence?: number): Promise<ConceptEdge>;
    getRelatedConcepts(nodeId: string, maxDepth?: number): Promise<KnowledgeNode[]>;
    addCodePattern(pattern: Omit<CodePattern, 'id'>): Promise<CodePattern>;
    findCodePatterns(language?: string, framework?: string, useCase?: string, limit?: number): Promise<CodePattern[]>;
    addAntiPattern(antiPattern: Omit<AntiPattern, 'id'>): Promise<AntiPattern>;
    detectAntiPatterns(code: string): Promise<AntiPattern[]>;
    recordSession(session: SessionRecord): Promise<void>;
    updateCommandHistory(command: string): Promise<void>;
    getFrequentCommands(limit?: number): Promise<CommandHistory[]>;
    getRecentCommands(limit?: number): Promise<CommandHistory[]>;
    updateUserPreferences(updates: Partial<UserPreferenceSet>): Promise<void>;
    getUserPreference<K extends keyof UserPreferenceSet>(key: K): Promise<UserPreferenceSet[K]>;
    processMemoryEvent(event: MemoryEvent): Promise<void>;
    cleanupLeastUsedNodes(): Promise<void>;
    compressMemory(): Promise<void>;
    private generateNodeId;
    private generatePatternId;
    private calculateCosineSimilarity;
    private applyAccessDecay;
    private calculateUsageScore;
    private invalidateCache;
    private detectUsagePatterns;
    private processCodeGenerationEvent;
    private processPatternRecognitionEvent;
    private processLearningUpdateEvent;
    private extractCodePatterns;
    private adaptUserPreferences;
    private mergeimilarPatterns;
    private calculatePatternSimilarity;
    private mergePatterns;
    private initializeDefaultPreferences;
}

/**
 * MARIA Memory System - System 2 Memory Implementation
 *
 * Deliberate reasoning and quality traces for complex decision making
 * Handles reasoning steps, quality evaluation, and improvement suggestions
 */

declare class System2MemoryManager implements System2Memory {
    private reasoningTraces;
    private qualityMetrics;
    private decisionTrees;
    private enhancements;
    private reflectionEntries;
    private config;
    private analysisCache;
    constructor(config: System2Config);
    get reasoningSteps(): ReasoningTrace[];
    get qualityEvaluation(): QualityMetrics;
    get decisionContext(): DecisionTree;
    get improvementSuggestions(): Enhancement[];
    get reflectionData(): ReflectionEntry[];
    startReasoningTrace(context: ReasoningContext, initialStep?: string): Promise<ReasoningTrace>;
    addReasoningStep(traceId: string, stepData: Omit<ReasoningStep, 'id' | 'confidence' | 'duration' | 'dependencies'>): Promise<ReasoningStep>;
    completeReasoningTrace(traceId: string, conclusion: string, confidence: number): Promise<ReasoningTrace>;
    addAlternativeReasoning(traceId: string, alternative: Omit<AlternativeReasoning, 'id'>): Promise<AlternativeReasoning>;
    getReasoningTrace(traceId: string): Promise<ReasoningTrace | null>;
    searchReasoningTraces(query: {
        domain?: string;
        complexity?: string;
        minQuality?: number;
        timeframe?: {
            start: Date;
            end: Date;
        };
    }, limit?: number): Promise<ReasoningTrace[]>;
    createDecisionTree(domain: string, initialCondition: string): Promise<DecisionTree>;
    addDecisionNode(treeId: string, parentNodeId: string, node: Omit<DecisionNode, 'id'>): Promise<DecisionNode>;
    addEvidence(treeId: string, nodeId: string, evidence: Evidence): Promise<void>;
    queryDecisionTree(treeId: string, context: Record<string, unknown>): Promise<DecisionNode[]>;
    proposeEnhancement(enhancement: Omit<Enhancement, 'id' | 'status'>): Promise<Enhancement>;
    updateEnhancementStatus(enhancementId: string, status: Enhancement['status'], feedback?: string): Promise<boolean>;
    getEnhancementsByType(type: Enhancement['type']): Promise<Enhancement[]>;
    addReflectionEntry(trigger: string, observation: string, analysis: string, insight: string, confidence?: number): Promise<ReflectionEntry>;
    addActionItem(reflectionId: string, actionItem: Omit<ActionItem, 'id' | 'status'>): Promise<ActionItem>;
    getReflectionInsights(timeframe?: {
        start: Date;
        end: Date;
    }, minConfidence?: number): Promise<ReflectionEntry[]>;
    processMemoryEvent(event: MemoryEvent): Promise<void>;
    assessCodeQuality(code: string, _language: string, context?: Record<string, unknown>): Promise<CodeQualityMetrics>;
    updateQualityMetrics(metrics: Partial<QualityMetrics>): Promise<void>;
    private generateTraceId;
    private generateStepId;
    private generateAlternativeId;
    private generateDecisionTreeId;
    private generateNodeId;
    private generateEnhancementId;
    private generateReflectionId;
    private generateActionItemId;
    private assessComplexity;
    private identifyDomain;
    private calculateStepConfidence;
    private identifyDependencies;
    private updateTraceQuality;
    private calculateReasoningQuality;
    private calculateCoherence;
    private calculateCompleteness;
    private calculateAccuracy;
    private calculateEfficiency;
    private calculateCreativity;
    private generateImprovementSuggestions;
    private updateGlobalQualityMetrics;
    private createEmptyDecisionTree;
    private findDecisionNode;
    private calculateTreeComplexity;
    private calculateNodeConfidence;
    private traverseDecisionTree;
    private evaluateCondition;
    private shouldAutoApprove;
    private evaluateEnhancementImpact;
    private generateActionItems;
    private processCodeGenerationEvent;
    private processBugFixEvent;
    private processQualityImprovementEvent;
    private processGenericEvent;
    private manageTraceLimit;
    private calculateMaintainability;
    private calculateReadability;
    private calculateTestability;
    private calculatePerformance;
    private calculateSecurity;
    private calculateBugDensity;
    private calculateCyclomaticComplexity;
    private calculateBasicComplexity;
    private hashCode;
    private initializeQualityMetrics;
}

/**
 * Internal Mode System - Type Definitions
 *
 * Comprehensive type system for MARIA CODE's internal mode functionality.
 * Integrates with existing Intelligent Router Service for real-time mode switching.
 */
type ModeCategory = 'reasoning' | 'creative' | 'analytical' | 'structural' | 'validation' | 'contemplative' | 'intensive' | 'learning' | 'collaborative';
type ModeIntensity = 'light' | 'normal' | 'deep' | 'ultra';
type ModeTriggerType = 'intent' | 'context' | 'situation' | 'pattern' | 'manual';
interface ModeDefinition {
    id: string;
    name: string;
    symbol: string;
    category: ModeCategory;
    intensity: ModeIntensity;
    description: string;
    purpose: string;
    useCases: string[];
    triggers: ModeTrigger[];
    display: ModeDisplay;
    i18n: Record<string, ModeI18n>;
    metadata: ModeMetadata;
}
interface ModeTrigger {
    type: ModeTriggerType;
    conditions: TriggerCondition[];
    weight: number;
    confidence: number;
}
interface TriggerCondition {
    field: string;
    operator: 'contains' | 'equals' | 'matches' | 'startsWith' | 'endsWith';
    value: string | string[] | RegExp;
    weight: number;
}
interface ModeDisplay {
    color: string;
    animation: boolean;
    duration: number;
    prefix: string;
    suffix: string;
}
interface ModeI18n {
    name: string;
    description: string;
    purpose: string;
    useCases: string[];
}
interface ModeMetadata {
    version: string;
    author: string;
    created: Date;
    updated: Date;
    tags: string[];
    experimental: boolean;
    deprecated: boolean;
}
interface ModeRecognitionResult {
    mode: ModeDefinition;
    confidence: number;
    reasoning: string;
    alternatives: Array<{
        mode: ModeDefinition;
        confidence: number;
    }>;
    triggers: Array<{
        type: ModeTriggerType;
        score: number;
        details: string;
    }>;
}
interface ModeContext {
    currentMode?: ModeDefinition;
    previousModes: ModeHistoryEntry[];
    userInput: string;
    language: string;
    commandHistory: string[];
    projectContext?: ProjectContext;
    errorState?: ErrorContext;
    userPatterns: UserPattern[];
    timestamp: Date;
}
interface ModeHistoryEntry {
    mode: ModeDefinition;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    trigger: ModeTriggerType;
    userFeedback?: 'positive' | 'negative' | 'neutral';
}
interface ProjectContext {
    type: 'code' | 'documentation' | 'configuration' | 'media' | 'other';
    files: string[];
    languages: string[];
    frameworks: string[];
    hasErrors: boolean;
    hasTests: boolean;
}
interface ErrorContext {
    type: 'syntax' | 'runtime' | 'build' | 'lint' | 'test' | 'network';
    message: string;
    location?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
interface UserPattern {
    sequence: string[];
    frequency: number;
    lastUsed: Date;
    success: number;
}
interface ModeConfig {
    confidenceThreshold: number;
    autoSwitchEnabled: boolean;
    confirmationRequired: boolean;
    showTransitions: boolean;
    animationEnabled: boolean;
    colorEnabled: boolean;
    learningEnabled: boolean;
    patternTrackingEnabled: boolean;
    feedbackEnabled: boolean;
    defaultLanguage: string;
    supportedLanguages: string[];
    maxHistoryEntries: number;
    maxPatterns: number;
    recognitionTimeout: number;
}

/**
 * Internal Mode Service - Main Orchestrator
 *
 * Central service for managing MARIA CODE's internal mode system.
 * Integrates with Intelligent Router for real-time mode recognition and switching.
 */

declare class InternalModeService extends EventEmitter {
    private modeRegistry;
    private recognitionEngine;
    private displayManager;
    private historyTracker;
    private currentMode;
    private config;
    private initialized;
    private recognitionInProgress;
    constructor(config?: Partial<ModeConfig>);
    initialize(): Promise<void>;
    /**
     * Recognize and potentially switch mode based on user input
     */
    recognizeMode(userInput: string, context?: Partial<ModeContext>): Promise<ModeRecognitionResult | null>;
    /**
     * Manually set a specific mode
     */
    setMode(mode: ModeDefinition | string, trigger?: 'manual' | 'intent' | 'context', isInitial?: boolean): Promise<boolean>;
    /**
     * Get current mode
     */
    getCurrentMode(): ModeDefinition | null;
    /**
     * Get all available modes
     */
    getAllModes(): ModeDefinition[];
    /**
     * Search modes by query
     */
    searchModes(query: string, language?: string): ModeDefinition[];
    /**
     * Get mode by ID
     */
    getModeById(id: string): ModeDefinition | undefined;
    /**
     * Get mode history
     */
    getModeHistory(): ModeHistoryEntry[];
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ModeConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): ModeConfig;
    /**
     * Provide feedback on mode accuracy
     */
    provideFeedback(modeId: string, wasCorrect: boolean, userInput?: string): Promise<void>;
    /**
     * Get mode statistics
     */
    getStatistics(): {
        totalModes: number;
        currentMode: string | null;
        modeChanges: number;
        averageConfidence: number;
        mostUsedModes: Array<{
            mode: string;
            count: number;
        }>;
    };
    /**
     * Export mode data for backup/transfer
     */
    exportData(): Promise<{
        config: ModeConfig;
        history: ModeHistoryEntry[];
        patterns: unknown[];
    }>;
    /**
     * Import mode data from backup
     */
    importData(data: {
        config?: Partial<ModeConfig>;
        history?: ModeHistoryEntry[];
        patterns?: unknown[];
    }): Promise<void>;
    /**
     * Reset to default state
     */
    reset(): Promise<void>;
    /**
     * Dispose and cleanup
     */
    dispose(): void;
    private switchToMode;
    private setupEventListeners;
}
declare function getInternalModeService(config?: Partial<ModeConfig>): InternalModeService;

/**
 * MARIA - Intelligent CLI Assistant
 * Entry point for the library
 */

declare const VERSION = "1.1.0";

export { DualMemoryEngine, InternalModeService, MemoryCoordinator, type MemoryEvent, type MemoryResponse, type ModeConfig, type ModeContext, type ModeDefinition, type ModeRecognitionResult, type QualityMetrics, type ReasoningTrace, System1MemoryManager as System1Memory, System2MemoryManager as System2Memory, type UserPreferenceSet, VERSION, getInternalModeService };
