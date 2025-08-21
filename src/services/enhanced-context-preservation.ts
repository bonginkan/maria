/**
 * Enhanced Context Preservation System
 * Advanced context management with deep learning patterns, cross-session persistence,
 * and intelligent context compression for Phase 4 implementation.
 */

import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ConversationContext, ConversationMessage } from '../types/conversation.js';
import { logger } from '../utils/logger.js';

export interface ContextSnapshot {
  id: string;
  timestamp: Date;
  sessionId: string;
  contextState: DeepContextState;
  metadata: ContextMetadata;
  importance: number; // 0-1 scale
  compressionLevel: 'none' | 'light' | 'medium' | 'heavy';
}

export interface DeepContextState {
  conversationFlow: ConversationFlowState;
  projectContext: ProjectContextState;
  userBehavior: UserBehaviorState;
  knowledgeGraph: KnowledgeGraphState;
  taskContext: TaskContextState;
  emotionalContext: EmotionalContextState;
}

export interface ConversationFlowState {
  topics: TopicState[];
  transitions: TopicTransition[];
  currentFocus: string;
  intentionChain: IntentionNode[];
  conversationMomentum: number;
}

export interface TopicState {
  id: string;
  name: string;
  keywords: string[];
  relevance: number;
  firstMentioned: Date;
  lastMentioned: Date;
  frequency: number;
  depth: number; // How deeply discussed
}

export interface TopicTransition {
  fromTopic: string;
  toTopic: string;
  triggerPhrase: string;
  timestamp: Date;
  transitionType: 'natural' | 'forced' | 'interrupted';
}

export interface IntentionNode {
  intention: string;
  confidence: number;
  parentIntention?: string;
  childIntentions: string[];
  timestamp: Date;
  fulfilled: boolean;
}

export interface EmotionalContextState {
  emotion: string;
  intensity: number;
  timestamp: Date;
  frustrationLevel?: number;
  engagementLevel?: number;
}

export interface CodePatternKnowledge {
  pattern: string;
  usage: number;
  effectiveness: number;
  lastUsed?: Date;
  examples?: string[];
}

export interface ProjectContextState {
  architecture: ArchitectureKnowledge;
  codePatterns: CodePatternKnowledge;
  dependencies: DependencyKnowledge;
  workflowState: WorkflowStateKnowledge;
}

export interface ArchitectureKnowledge {
  patterns: string[];
  components: ComponentKnowledge[];
  dataFlow: DataFlowKnowledge[];
  designPrinciples: string[];
}

export interface ComponentKnowledge {
  name: string;
  type: string;
  purpose: string;
  relationships: string[];
  lastModified: Date;
  complexity: number;
}

export interface DataFlowKnowledge {
  source: string;
  destination: string;
  dataType: string;
  frequency: 'realtime' | 'batch' | 'ondemand';
}

export interface DependencyKnowledge {
  packages: PackageKnowledge[];
  internalDependencies: InternalDependencyKnowledge[];
  externalAPIs: ExternalAPIKnowledge[];
}

export interface PackageKnowledge {
  name: string;
  version: string;
  purpose: string;
  criticality: 'high' | 'medium' | 'low';
  lastUpdated: Date;
}

export interface InternalDependencyKnowledge {
  module: string;
  dependsOn: string[];
  dependents: string[];
  coupling: number;
}

export interface ExternalAPIKnowledge {
  name: string;
  endpoint: string;
  purpose: string;
  reliability: number;
  lastUsed: Date;
}

export interface WorkflowStateKnowledge {
  currentPhase: string;
  completedTasks: TaskKnowledge[];
  pendingTasks: TaskKnowledge[];
  blockedTasks: TaskKnowledge[];
  workflowPattern: string;
}

export interface TaskKnowledge {
  id: string;
  description: string;
  priority: number;
  estimatedTime: number;
  actualTime?: number;
  dependencies: string[];
  tags: string[];
}

export interface UserBehaviorState {
  preferenceProfile: PreferenceProfile;
  workingStyle: WorkingStyleProfile;
  communicationPattern: CommunicationPattern;
  skillLevel: SkillAssessment;
}

export interface PreferenceProfile {
  codeStyle: string;
  toolPreferences: Record<string, number>;
  languagePreferences: Record<string, number>;
  frameworkPreferences: Record<string, number>;
  verbosityLevel: number;
}

export interface WorkingStyleProfile {
  peakHours: number[];
  sessionLength: number;
  breakFrequency: number;
  multitaskingLevel: number;
  planningVsImproving: number; // -1 to 1 scale
}

export interface CommunicationPattern {
  questioningStyle: 'direct' | 'exploratory' | 'confirmatory';
  feedbackStyle: 'immediate' | 'batched' | 'minimal';
  explanationPreference: 'detailed' | 'concise' | 'example-based';
}

export interface SkillAssessment {
  overallLevel: number;
  domainSkills: Record<string, number>;
  learningVelocity: number;
  confidenceLevel: number;
}

export interface KnowledgeGraphState {
  concepts: ConceptNode[];
  relationships: ConceptRelationship[];
  clusterings: ConceptCluster[];
  inferredKnowledge: InferredKnowledge[];
}

export interface ConceptNode {
  id: string;
  name: string;
  type: 'technical' | 'business' | 'personal' | 'contextual';
  confidence: number;
  lastReinforced: Date;
  decayRate: number;
}

export interface ConceptRelationship {
  fromConcept: string;
  toConcept: string;
  relationship: string;
  strength: number;
  evidenceCount: number;
}

export interface ConceptCluster {
  id: string;
  concepts: string[];
  theme: string;
  cohesion: number;
}

export interface InferredKnowledge {
  premise: string[];
  conclusion: string;
  confidence: number;
  inferenceType: 'deductive' | 'inductive' | 'abductive';
}

export interface TaskContextState {
  currentGoal: GoalState;
  goalHierarchy: GoalHierarchy;
  progressTracking: ProgressState;
  obstaclePattern: ObstaclePattern[];
}

export interface GoalState {
  primary: string;
  secondary: string[];
  implicit: string[];
  timeHorizon: 'immediate' | 'short' | 'medium' | 'long';
}

export interface GoalHierarchy {
  parentGoal?: string;
  childGoals: string[];
  siblingGoals: string[];
  dependentGoals: string[];
}

export interface ProgressState {
  overall: number;
  milestones: MilestoneState[];
  velocity: number;
  blockers: string[];
}

export interface MilestoneState {
  name: string;
  progress: number;
  estimatedCompletion: Date;
  dependencies: string[];
}

export interface ObstaclePattern {
  obstacleType: string;
  frequency: number;
  avgResolutionTime: number;
  successfulStrategies: string[];
}

export interface EmotionalContext {
  frustrationLevel: number;
  confidenceLevel: number;
  engagementLevel: number;
  satisfactionLevel: number;
  stressIndicators: string[];
}

export interface ContextMetadata {
  compressionRatio: number;
  originalSize: number;
  retentionPriority: number;
  accessFrequency: number;
  lastAccessed: Date;
  expiryDate?: Date;
}

export interface ContextCompressionStrategy {
  name: string;
  compressionFunction: (context: DeepContextState) => DeepContextState;
  expansionFunction: (compressed: DeepContextState) => DeepContextState;
  compressionRatio: number;
  fidelityLoss: number;
}

export class EnhancedContextPreservation extends EventEmitter {
  private static instance: EnhancedContextPreservation;
  private contextSnapshots: Map<string, ContextSnapshot> = new Map();
  private ___crossSessionMemory: Map<string, unknown> = new Map();
  private compressionStrategies: Map<string, ContextCompressionStrategy> = new Map();
  private dataDir: string;
  private maxSnapshotsPerSession = 100;
  private ___maxCrossSessionEntries = 1000;

  private constructor() {
    super();
    this.dataDir = join(homedir(), '.maria', 'enhanced-context');
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    this.initializeCompressionStrategies();
    this.loadPersistedData();
    this.startMaintenanceTasks();
  }

  public static getInstance(): EnhancedContextPreservation {
    if (!EnhancedContextPreservation.instance) {
      EnhancedContextPreservation.instance = new EnhancedContextPreservation();
    }
    return EnhancedContextPreservation.instance;
  }

  /**
   * Initialize compression strategies for different context preservation levels
   */
  private initializeCompressionStrategies(): void {
    // Light compression - preserve most information
    this.compressionStrategies.set('light', {
      name: 'light',
      compressionFunction: this.lightCompression.bind(this),
      expansionFunction: this.lightExpansion.bind(this),
      compressionRatio: 0.8,
      fidelityLoss: 0.05,
    });

    // Medium compression - balance between size and fidelity
    this.compressionStrategies.set('medium', {
      name: 'medium',
      compressionFunction: this.mediumCompression.bind(this),
      expansionFunction: this.mediumExpansion.bind(this),
      compressionRatio: 0.5,
      fidelityLoss: 0.15,
    });

    // Heavy compression - aggressive compression for long-term storage
    this.compressionStrategies.set('heavy', {
      name: 'heavy',
      compressionFunction: this.heavyCompression.bind(this),
      expansionFunction: this.heavyExpansion.bind(this),
      compressionRatio: 0.2,
      fidelityLoss: 0.35,
    });
  }

  /**
   * Create a comprehensive context snapshot
   */
  async captureContextSnapshot(
    sessionId: string,
    context: ConversationContext,
    importance: number = 0.5,
  ): Promise<string> {
    const snapshotId = this.generateSnapshotId();

    try {
      const deepContextState = await this.buildDeepContextState(context);
      const compressionLevel = this.determineCompressionLevel(importance, deepContextState);

      const snapshot: ContextSnapshot = {
        id: snapshotId,
        timestamp: new Date(),
        sessionId,
        contextState: await this.compressContext(deepContextState, compressionLevel),
        metadata: {
          compressionRatio: this.compressionStrategies.get(compressionLevel)?.compressionRatio || 1,
          originalSize: JSON.stringify(deepContextState).length,
          retentionPriority: importance,
          accessFrequency: 0,
          lastAccessed: new Date(),
        },
        importance,
        compressionLevel,
      };

      this.contextSnapshots.set(snapshotId, snapshot);
      this.emit('snapshotCaptured', { snapshotId, sessionId, importance });

      // Persist to storage
      await this.persistSnapshot(snapshot);

      // Cleanup old snapshots if needed
      await this.cleanupSnapshots(sessionId);

      logger.info(`Context snapshot captured: ${snapshotId} (compression: ${compressionLevel})`);
      return snapshotId;
    } catch (error) {
      logger.error('Failed to capture context snapshot:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive deep context state from conversation context
   */
  private async buildDeepContextState(context: ConversationContext): Promise<DeepContextState> {
    const [
      conversationFlow,
      projectContext,
      userBehavior,
      knowledgeGraph,
      taskContext,
      emotionalContext,
    ] = await Promise.all([
      this.analyzeConversationFlow(context),
      this.analyzeProjectContext(context),
      this.analyzeUserBehavior(context),
      this.buildKnowledgeGraph(context),
      this.analyzeTaskContext(context),
      this.analyzeEmotionalContext(context),
    ]);

    return {
      conversationFlow,
      projectContext,
      userBehavior,
      knowledgeGraph,
      taskContext,
      emotionalContext,
    };
  }

  /**
   * Analyze conversation flow patterns
   */
  private async analyzeConversationFlow(
    context: ConversationContext,
  ): Promise<ConversationFlowState> {
    const topics = this.extractTopics(context.messages);
    const transitions = this.analyzeTopicTransitions(context.messages);
    const intentionChain = this.buildIntentionChain(context.messages);

    return {
      topics,
      transitions,
      currentFocus: topics[topics.length - 1]?.name || '',
      intentionChain,
      conversationMomentum: this.calculateConversationMomentum(context.messages),
    };
  }

  /**
   * Extract topics from conversation messages
   */
  private extractTopics(messages: ConversationMessage[]): TopicState[] {
    const topicMap = new Map<string, TopicState>();

    messages.forEach((message, index) => {
      const keywords = this.extractKeywords(message.content);
      keywords.forEach((keyword) => {
        if (topicMap.has(keyword)) {
          const topic = topicMap.get(keyword)!;
          topic.frequency++;
          topic.lastMentioned = message.timestamp;
          topic.depth += this.calculateMessageDepth(message, index);
        } else {
          topicMap.set(keyword, {
            id: keyword,
            name: keyword,
            keywords: [keyword],
            relevance: this.calculateTopicRelevance(keyword, messages),
            firstMentioned: message.timestamp,
            lastMentioned: message.timestamp,
            frequency: 1,
            depth: this.calculateMessageDepth(message, index),
          });
        }
      });
    });

    return Array.from(topicMap.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 20); // Keep top 20 topics
  }

  /**
   * Extract keywords from message content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter((word) => !this.isStopWord(word));

    return [...new Set(words)];
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'and',
      'but',
      'for',
      'are',
      'that',
      'this',
      'with',
      'have',
      'will',
      'you',
      'can',
      'not',
      'how',
      'what',
      'when',
      'where',
      'why',
      'would',
      'could',
    ]);
    return stopWords.has(word);
  }

  /**
   * Calculate topic relevance score
   */
  private calculateTopicRelevance(keyword: string, messages: ConversationMessage[]): number {
    const frequency = messages.filter((m) => m.content.toLowerCase().includes(keyword)).length;
    const recency = this.calculateRecencyScore(keyword, messages);
    const contextualImportance = this.calculateContextualImportance(keyword, messages);

    return frequency * 0.4 + recency * 0.3 + contextualImportance * 0.3;
  }

  /**
   * Calculate recency score for a keyword
   */
  private calculateRecencyScore(keyword: string, messages: ConversationMessage[]): number {
    const lastMention = messages.filter((m) => m.content.toLowerCase().includes(keyword)).pop();

    if (!lastMention) return 0;

    const timeSinceLastMention = Date.now() - lastMention.timestamp.getTime();
    const hoursSince = timeSinceLastMention / (1000 * 60 * 60);

    // Exponential decay over 24 hours
    return Math.exp(-hoursSince / 24);
  }

  /**
   * Calculate contextual importance of a keyword
   */
  private calculateContextualImportance(keyword: string, messages: ConversationMessage[]): number {
    // Check if keyword appears in commands, questions, or emphasis
    let importance = 0;

    messages.forEach((message) => {
      if (message.content.toLowerCase().includes(keyword)) {
        if (message.content.includes('?')) importance += 0.2; // Questions are important
        if (message.content.includes('/')) importance += 0.3; // Commands are important
        if (message.content.includes('!')) importance += 0.1; // Emphasis
        if (message.role === 'user') importance += 0.2; // User messages are important
      }
    });

    return Math.min(importance, 1);
  }

  /**
   * Calculate message depth (how detailed the discussion is)
   */
  private calculateMessageDepth(message: ConversationMessage, _index: number): number {
    const length = message.content.length;
    const codeBlocks = (message.content.match(/```/g) || []).length / 2;
    const questions = (message.content.match(/\?/g) || []).length;
    const technicalTerms = this.countTechnicalTerms(message.content);

    return Math.min(length / 100 + codeBlocks * 2 + questions * 0.5 + technicalTerms * 0.3, 10);
  }

  /**
   * Count technical terms in content
   */
  private countTechnicalTerms(content: string): number {
    const technicalPatterns = [
      /\b\w+\(\)/g, // Function calls
      /\b[A-Z][a-z]*[A-Z]\w*/g, // CamelCase
      /\b\w+\.\w+/g, // Dot notation
      /\b(function|class|interface|type|const|let|var|import|export)\b/g, // Keywords
    ];

    let count = 0;
    technicalPatterns.forEach((pattern) => {
      count += (content.match(pattern) || []).length;
    });

    return count;
  }

  /**
   * Analyze topic transitions in conversation
   */
  private analyzeTopicTransitions(messages: ConversationMessage[]): TopicTransition[] {
    const transitions: TopicTransition[] = [];
    let currentTopic = '';

    messages.forEach((message, index) => {
      const topics = this.extractKeywords(message.content);
      const primaryTopic = topics[0] || '';

      if (primaryTopic && primaryTopic !== currentTopic && currentTopic) {
        transitions.push({
          fromTopic: currentTopic,
          toTopic: primaryTopic,
          triggerPhrase: this.extractTriggerPhrase(message.content),
          timestamp: message.timestamp,
          transitionType: this.classifyTransitionType(message, index),
        });
      }

      if (primaryTopic) {
        currentTopic = primaryTopic;
      }
    });

    return transitions;
  }

  /**
   * Extract trigger phrase that caused topic transition
   */
  private extractTriggerPhrase(content: string): string {
    const triggerPatterns = [
      /but\s+\w+/gi,
      /however\s+\w+/gi,
      /now\s+\w+/gi,
      /also\s+\w+/gi,
      /what\s+about\s+\w+/gi,
    ];

    for (const pattern of triggerPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return content.substring(0, 20) + '...';
  }

  /**
   * Classify type of topic transition
   */
  private classifyTransitionType(
    message: ConversationMessage,
    _index: number,
  ): 'natural' | 'forced' | 'interrupted' {
    const content = message.content.toLowerCase();

    if (content.includes('anyway') || content.includes('but') || content.includes('however')) {
      return 'forced';
    }

    if (content.includes('wait') || content.includes('actually') || content.includes('sorry')) {
      return 'interrupted';
    }

    return 'natural';
  }

  /**
   * Build intention chain from messages
   */
  private buildIntentionChain(messages: ConversationMessage[]): IntentionNode[] {
    const intentions: IntentionNode[] = [];

    messages.forEach((message) => {
      const _intention = this.extractIntention(message.content);
      if (_intention) {
        const node: IntentionNode = {
          intention: _intention.text,
          confidence: _intention.confidence,
          parentIntention: this.findParentIntention(_intention.text, intentions),
          childIntentions: [],
          timestamp: message.timestamp,
          fulfilled: this.isIntentionFulfilled(_intention.text, messages, message.timestamp),
        };
        intentions.push(node);

        // Update parent's children
        if (node.parentIntention) {
          const parent = intentions.find((i) => i.intention === node.parentIntention);
          if (parent) {
            parent.childIntentions.push(node.intention);
          }
        }
      }
    });

    return intentions;
  }

  /**
   * Extract intention from message content
   */
  private extractIntention(content: string): { text: string; confidence: number } | null {
    const intentionPatterns = [
      { pattern: /i want to\s+(.*)/i, confidence: 0.9 },
      { pattern: /i need to\s+(.*)/i, confidence: 0.9 },
      { pattern: /can you\s+(.*)/i, confidence: 0.8 },
      { pattern: /help me\s+(.*)/i, confidence: 0.8 },
      { pattern: /how do i\s+(.*)/i, confidence: 0.7 },
      { pattern: /let's\s+(.*)/i, confidence: 0.7 },
    ];

    for (const { pattern, confidence } of intentionPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return {
          text: match[1].trim(),
          confidence,
        };
      }
    }

    return null;
  }

  /**
   * Find parent intention in chain
   */
  private findParentIntention(
    intention: string,
    previousIntentions: IntentionNode[],
  ): string | undefined {
    // Simple heuristic - find most recent unfulfilled intention that this could be related to
    const recentUnfulfilled = previousIntentions
      .filter((i) => !i.fulfilled)
      .reverse()
      .find((i) => this.calculateIntentionSimilarity(intention, i.intention) > 0.6);

    return recentUnfulfilled?.intention;
  }

  /**
   * Calculate similarity between two intentions
   */
  private calculateIntentionSimilarity(intention1: string, intention2: string): number {
    const words1 = new Set(intention1.toLowerCase().split(/\s+/));
    const words2 = new Set(intention2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Check if intention was fulfilled in subsequent messages
   */
  private isIntentionFulfilled(
    _intention: string,
    messages: ConversationMessage[],
    intentionTime: Date,
  ): boolean {
    const subsequentMessages = messages.filter((m) => m.timestamp > intentionTime);
    const fulfillmentPatterns = [/done/i, /completed/i, /finished/i, /here\s+is/i, /i\s+have/i];

    return subsequentMessages.some((message) =>
      fulfillmentPatterns.some((pattern) => pattern.test(message.content)),
    );
  }

  /**
   * Calculate conversation momentum
   */
  private calculateConversationMomentum(messages: ConversationMessage[]): number {
    if (messages.length < 2) return 0;

    const recentMessages = messages.slice(-10); // Last 10 messages
    const timeSpans = recentMessages
      .slice(1)
      .map(
        (msg, index) => msg.timestamp.getTime() - (recentMessages[index]?.timestamp.getTime() ?? 0),
      );

    const avgTimeSpan = timeSpans.reduce((sum, span) => sum + span, 0) / timeSpans.length;
    const messageLength =
      recentMessages.reduce((sum, msg) => sum + msg.content.length, 0) / recentMessages.length;

    // Higher momentum = faster responses + longer messages
    const timeComponent = Math.max(0, 1 - avgTimeSpan / (1000 * 60 * 5)); // 5 minutes baseline
    const lengthComponent = Math.min(messageLength / 200, 1); // 200 chars baseline

    return (timeComponent + lengthComponent) / 2;
  }

  // Placeholder methods for other analysis functions
  private async analyzeProjectContext(context: ConversationContext): Promise<ProjectContextState> {
    // Implementation would analyze project structure, dependencies, etc.
    return {
      architecture: { patterns: [], components: [], dataFlow: [], designPrinciples: [] },
      codePatterns: { pattern: '', usage: '', effectiveness: 0 } as unknown as CodePatternKnowledge,
      dependencies: { packages: [], internalDependencies: [], externalAPIs: [] },
      workflowState: {
        currentPhase: '',
        completedTasks: [],
        pendingTasks: [],
        blockedTasks: [],
        workflowPattern: '',
      },
    };
  }

  private async analyzeUserBehavior(context: ConversationContext): Promise<UserBehaviorState> {
    // Implementation would analyze user patterns, preferences, etc.
    return {
      preferenceProfile: {
        codeStyle: '',
        toolPreferences: {},
        languagePreferences: {},
        frameworkPreferences: {},
        verbosityLevel: 0.5,
      },
      workingStyle: {
        peakHours: [],
        sessionLength: 0,
        breakFrequency: 0,
        multitaskingLevel: 0,
        planningVsImproving: 0,
      },
      communicationPattern: {
        questioningStyle: 'direct',
        feedbackStyle: 'immediate',
        explanationPreference: 'detailed',
      },
      skillLevel: {
        overallLevel: 0.5,
        domainSkills: {},
        learningVelocity: 0.5,
        confidenceLevel: 0.5,
      },
    };
  }

  private async buildKnowledgeGraph(context: ConversationContext): Promise<KnowledgeGraphState> {
    // Implementation would build knowledge graph from conversation
    return {
      concepts: [],
      relationships: [],
      clusterings: [],
      inferredKnowledge: [],
    };
  }

  private async analyzeTaskContext(context: ConversationContext): Promise<TaskContextState> {
    // Implementation would analyze current tasks and goals
    return {
      currentGoal: { primary: '', secondary: [], implicit: [], timeHorizon: 'immediate' },
      goalHierarchy: { childGoals: [], siblingGoals: [], dependentGoals: [] },
      progressTracking: { overall: 0, milestones: [], velocity: 0, blockers: [] },
      obstaclePattern: [],
    };
  }

  private async analyzeEmotionalContext(
    context: ConversationContext,
  ): Promise<EmotionalContextState> {
    // Implementation would analyze emotional indicators
    return {
      emotion: 'neutral',
      intensity: 0.5,
      timestamp: new Date(),
      frustrationLevel: 0,
      engagementLevel: 0.5,
    };
  }

  /**
   * Determine appropriate compression level based on importance and context size
   */
  private determineCompressionLevel(
    importance: number,
    context: DeepContextState,
  ): 'none' | 'light' | 'medium' | 'heavy' {
    const contextSize = JSON.stringify(context).length;

    if (importance > 0.8) return 'none';
    if (importance > 0.6 && contextSize < 50000) return 'light';
    if (importance > 0.4 && contextSize < 100000) return 'medium';
    return 'heavy';
  }

  /**
   * Compress context using specified strategy
   */
  private async compressContext(
    context: DeepContextState,
    level: 'none' | 'light' | 'medium' | 'heavy',
  ): Promise<DeepContextState> {
    if (level === 'none') return context;

    const strategy = this.compressionStrategies.get(level);
    if (!strategy) return context;

    return strategy.compressionFunction(context);
  }

  /**
   * Light compression - preserve most information, remove redundancies
   */
  private lightCompression(context: DeepContextState): DeepContextState {
    return {
      ...context,
      conversationFlow: {
        ...context.conversationFlow,
        topics: context.conversationFlow.topics.slice(0, 15), // Keep top 15 topics
        transitions: context.conversationFlow.transitions.slice(-20), // Keep last 20 transitions
      },
    };
  }

  /**
   * Light expansion - restore light compression
   */
  private lightExpansion(context: DeepContextState): DeepContextState {
    // For light compression, no significant expansion needed
    return context;
  }

  /**
   * Medium compression - significant reduction while preserving key information
   */
  private mediumCompression(context: DeepContextState): DeepContextState {
    return {
      ...context,
      conversationFlow: {
        ...context.conversationFlow,
        topics: context.conversationFlow.topics.slice(0, 10),
        transitions: context.conversationFlow.transitions.slice(-10),
        intentionChain: context.conversationFlow.intentionChain.filter((i) => i.confidence > 0.7),
      },
      knowledgeGraph: {
        ...context.knowledgeGraph,
        concepts: context.knowledgeGraph.concepts.filter((c) => c.confidence > 0.6),
        relationships: context.knowledgeGraph.relationships.filter((r) => r.strength > 0.5),
      },
    };
  }

  /**
   * Medium expansion - add back medium-priority information
   */
  private mediumExpansion(context: DeepContextState): DeepContextState {
    // Expansion would typically involve inference or retrieval from other sources
    return context;
  }

  /**
   * Heavy compression - aggressive compression for long-term storage
   */
  private heavyCompression(context: DeepContextState): DeepContextState {
    return {
      ...context,
      conversationFlow: {
        topics: context.conversationFlow.topics.slice(0, 5),
        transitions: [],
        currentFocus: context.conversationFlow.currentFocus,
        intentionChain: context.conversationFlow.intentionChain.filter((i) => i.confidence > 0.8),
        conversationMomentum: context.conversationFlow.conversationMomentum,
      },
      knowledgeGraph: {
        concepts: context.knowledgeGraph.concepts.filter((c) => c.confidence > 0.8),
        relationships: context.knowledgeGraph.relationships.filter((r) => r.strength > 0.7),
        clusterings: [],
        inferredKnowledge: context.knowledgeGraph.inferredKnowledge.filter(
          (k) => k.confidence > 0.8,
        ),
      },
      taskContext: {
        currentGoal: context.taskContext.currentGoal,
        goalHierarchy: { childGoals: [], siblingGoals: [], dependentGoals: [] },
        progressTracking: {
          overall: context.taskContext.progressTracking.overall,
          milestones: [],
          velocity: 0,
          blockers: [],
        },
        obstaclePattern: [],
      },
    };
  }

  /**
   * Heavy expansion - restore heavily compressed context
   */
  private heavyExpansion(context: DeepContextState): DeepContextState {
    // Heavy expansion would require significant inference and reconstruction
    return context;
  }

  /**
   * Retrieve and expand context snapshot
   */
  async retrieveContext(snapshotId: string): Promise<DeepContextState | null> {
    const snapshot = this.contextSnapshots.get(snapshotId);
    if (!snapshot) {
      logger.warn(`Context snapshot not found: ${snapshotId}`);
      return null;
    }

    // Update access metadata
    snapshot.metadata.accessFrequency++;
    snapshot.metadata.lastAccessed = new Date();

    // Expand compressed context
    const strategy = this.compressionStrategies.get(snapshot.compressionLevel);
    if (strategy && snapshot.compressionLevel !== 'none') {
      return strategy.expansionFunction(snapshot.contextState);
    }

    return snapshot.contextState;
  }

  /**
   * Generate unique snapshot ID
   */
  private generateSnapshotId(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Persist snapshot to storage
   */
  private async persistSnapshot(snapshot: ContextSnapshot): Promise<void> {
    try {
      const filePath = join(this.dataDir, `${snapshot.id}.json`);
      writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
    } catch (error) {
      logger.error(`Failed to persist snapshot ${snapshot.id}:`, error);
    }
  }

  /**
   * Load persisted data
   */
  private loadPersistedData(): void {
    try {
      // Load context snapshots
      const snapshotsFile = join(this.dataDir, 'snapshots-index.json');
      if (existsSync(snapshotsFile)) {
        const snapshotIds = JSON.parse(readFileSync(snapshotsFile, 'utf-8'));
        snapshotIds.forEach((id: string) => {
          const snapshotFile = join(this.dataDir, `${id}.json`);
          if (existsSync(snapshotFile)) {
            const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf-8'));
            this.contextSnapshots.set(id, snapshot);
          }
        });
      }

      // Load cross-session memory
      const memoryFile = join(this.dataDir, 'cross-session-memory.json');
      if (existsSync(memoryFile)) {
        const memory = JSON.parse(readFileSync(memoryFile, 'utf-8'));
        this.___crossSessionMemory = new Map(Object.entries(memory));
      }
    } catch (error) {
      logger.error('Failed to load persisted data:', error);
    }
  }

  /**
   * Cleanup old snapshots to manage storage
   */
  private async cleanupSnapshots(sessionId: string): Promise<void> {
    const sessionSnapshots = Array.from(this.contextSnapshots.values())
      .filter((s) => s.sessionId === sessionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (sessionSnapshots.length > this.maxSnapshotsPerSession) {
      const toRemove = sessionSnapshots.slice(this.maxSnapshotsPerSession);
      toRemove.forEach((snapshot) => {
        this.contextSnapshots.delete(snapshot.id);
        // Remove file
        const filePath = join(this.dataDir, `${snapshot.id}.json`);
        if (existsSync(filePath)) {
          try {
            unlinkSync(filePath);
          } catch (error) {
            logger.error(`Failed to remove snapshot file ${snapshot.id}:`, error);
          }
        }
      });
    }
  }

  /**
   * Start maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // Periodic cleanup every hour
    setInterval(
      () => {
        this.performMaintenance();
      },
      60 * 60 * 1000,
    );
  }

  /**
   * Perform maintenance tasks
   */
  private performMaintenance(): void {
    // Remove expired snapshots
    const now = Date.now();
    for (const [id, snapshot] of this.contextSnapshots) {
      if (snapshot.metadata.expiryDate && snapshot.metadata.expiryDate.getTime() < now) {
        this.contextSnapshots.delete(id);
      }
    }

    // Compress old, low-access snapshots
    for (const [_id, snapshot] of this.contextSnapshots) {
      const age = now - snapshot.timestamp.getTime();
      const daysSinceCreation = age / (1000 * 60 * 60 * 24);

      if (
        daysSinceCreation > 7 &&
        snapshot.compressionLevel === 'none' &&
        snapshot.importance < 0.7
      ) {
        // Auto-compress old snapshots
        this.compressContext(snapshot.contextState, 'medium').then((compressed) => {
          snapshot.contextState = compressed;
          snapshot.compressionLevel = 'medium';
        });
      }
    }

    logger.info('Context preservation maintenance completed');
  }

  /**
   * Get system statistics
   */
  getStatistics(): {
    totalSnapshots: number;
    snapshotsBySession: Record<string, number>;
    compressionDistribution: Record<string, number>;
    storageUsed: number;
    averageImportance: number;
  } {
    const snapshots = Array.from(this.contextSnapshots.values());
    const compressionDistribution = { none: 0, light: 0, medium: 0, heavy: 0 };

    snapshots.forEach((s) => {
      compressionDistribution[s.compressionLevel]++;
    });

    const snapshotsBySession: Record<string, number> = {};
    snapshots.forEach((s) => {
      snapshotsBySession[s.sessionId] = (snapshotsBySession[s.sessionId] || 0) + 1;
    });

    const storageUsed = snapshots.reduce((total, s) => total + s.metadata.originalSize, 0);
    const averageImportance =
      snapshots.reduce((total, s) => total + s.importance, 0) / snapshots.length;

    return {
      totalSnapshots: snapshots.length,
      snapshotsBySession,
      compressionDistribution,
      storageUsed,
      averageImportance: averageImportance || 0,
    };
  }
}

export const _enhancedContextPreservation = EnhancedContextPreservation.getInstance();
