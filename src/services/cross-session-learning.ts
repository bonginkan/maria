/**
 * Cross-Session Learning System
 * Advanced learning system that maintains knowledge and patterns across multiple sessions,
 * enabling the AI to improve and adapt over time through accumulated experience.
 */

import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { _enhancedContextPreservation, DeepContextState } from './enhanced-context-preservation.js';
import { logger } from '../utils/logger.js';

export interface LearningPattern {
  id: string;
  type: 'behavioral' | 'preference' | 'skill' | 'workflow' | 'error' | 'success';
  pattern: string;
  frequency: number;
  confidence: number;
  firstObserved: Date;
  lastObserved: Date;
  contexts: string[]; // Context IDs where this pattern was observed
  outcomes: LearningOutcome[];
  metadata: Record<string, unknown>;
}

export interface LearningOutcome {
  type: 'success' | 'failure' | 'partial' | 'interrupted';
  timestamp: Date;
  contextId: string;
  measuredValue?: number;
  feedback?: string;
}

export interface UserKnowledgeProfile {
  userId: string;
  skillDomains: Map<string, SkillDomain>;
  preferences: Map<string, PreferenceWeight>;
  workflowPatterns: Map<string, WorkflowPattern>;
  learningTrajectory: LearningTrajectoryPoint[];
  personalityTraits: PersonalityProfile;
  adaptationStrategies: Map<string, AdaptationStrategy>;
}

export interface SkillDomain {
  domain: string;
  currentLevel: number; // 0-1 scale
  learningVelocity: number;
  plateauIndicators: PlateauIndicator[];
  expertiseAreas: string[];
  knowledgeGaps: string[];
  lastAssessment: Date;
}

export interface PreferenceWeight {
  preference: string;
  weight: number; // -1 to 1 scale (negative = dislike, positive = like)
  confidence: number;
  contextDependency: Record<string, number>;
  stability: number; // How stable this preference is over time
}

export interface WorkflowPattern {
  pattern: string;
  frequency: number;
  efficiency: number;
  contextSuitability: Record<string, number>;
  variations: WorkflowVariation[];
  optimizationPotential: number;
}

export interface WorkflowVariation {
  variation: string;
  deltaEfficiency: number;
  conditions: string[];
  adoptionRate: number;
}

export interface LearningTrajectoryPoint {
  timestamp: Date;
  skill: string;
  level: number;
  learningEvent: LearningEvent;
  momentum: number;
}

export interface LearningEvent {
  type: 'discovery' | 'practice' | 'mastery' | 'teaching' | 'error' | 'insight';
  description: string;
  impact: number;
  contextId: string;
}

export interface PersonalityProfile {
  traits: Map<string, number>; // Big Five + additional traits
  communicationStyle: CommunicationStyle;
  learningStyle: LearningStyle;
  motivationFactors: MotivationFactor[];
  stressPattern: StressPattern;
}

export interface CommunicationStyle {
  formality: number; // 0-1 (informal to formal)
  directness: number; // 0-1 (indirect to direct)
  verbosity: number; // 0-1 (concise to verbose)
  questioningStyle: 'convergent' | 'divergent' | 'evaluative';
  feedbackReceptivity: number;
}

export interface LearningStyle {
  modalityPreferences: Map<string, number>; // visual, auditory, kinesthetic, etc.
  pacePreference: 'fast' | 'moderate' | 'slow' | 'adaptive';
  structurePreference: number; // 0-1 (flexible to structured)
  depthVsBreadth: number; // -1 to 1 (breadth to depth)
}

export interface MotivationFactor {
  factor: string;
  strength: number;
  context: string[];
  triggers: string[];
}

export interface StressPattern {
  stressTriggers: string[];
  stressIndicators: string[];
  copingStrategies: string[];
  optimalChallengeLevel: number;
}

export interface PlateauIndicator {
  indicator: string;
  strength: number;
  duration: number;
  breakThroughStrategies: string[];
}

export interface AdaptationStrategy {
  strategy: string;
  effectiveness: number;
  applicableContexts: string[];
  prerequisites: string[];
  sideEffects: string[];
}

export interface SessionTransferableLearning {
  sessionId: string;
  timestamp: Date;
  keyLearnings: KeyLearning[];
  transferablePatterns: TransferablePattern[];
  improvementOpportunities: ImprovementOpportunity[];
  successFactors: SuccessFactor[];
}

export interface KeyLearning {
  learning: string;
  type: 'skill' | 'pattern' | 'preference' | 'strategy';
  confidence: number;
  transferability: number;
  evidenceStrength: number;
}

export interface TransferablePattern {
  pattern: string;
  sourceContext: string;
  applicableContexts: string[];
  adaptationRequired: number;
  successProbability: number;
}

export interface ImprovementOpportunity {
  area: string;
  currentState: string;
  targetState: string;
  actionPlan: string[];
  estimatedTimeframe: number;
  priority: number;
}

export interface SuccessFactor {
  factor: string;
  importance: number;
  context: string;
  reproducibility: number;
}

export interface CrossSessionInsight {
  id: string;
  type: 'trend' | 'correlation' | 'anomaly' | 'opportunity' | 'risk';
  insight: string;
  confidence: number;
  impact: number;
  evidenceSessions: string[];
  actionable: boolean;
  recommendations: string[];
  timestamp: Date;
}

export class CrossSessionLearning extends EventEmitter {
  private static instance: CrossSessionLearning;
  private userProfiles: Map<string, UserKnowledgeProfile> = new Map();
  private learningPatterns: Map<string, LearningPattern> = new Map();
  private sessionLearnings: Map<string, SessionTransferableLearning> = new Map();
  private crossSessionInsights: Map<string, CrossSessionInsight> = new Map();
  private dataDir: string;
  private currentUserId: string = 'default';

  private constructor() {
    super();
    this.dataDir = join(homedir(), '.maria', 'learning');
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    this.loadPersistedData();
    this.startLearningEngine();
  }

  public static getInstance(): CrossSessionLearning {
    if (!CrossSessionLearning.instance) {
      CrossSessionLearning.instance = new CrossSessionLearning();
    }
    return CrossSessionLearning.instance;
  }

  /**
   * Process session completion and extract learnings
   */
  async processSessionCompletion(
    sessionId: string,
    contextSnapshots: string[],
    sessionMetrics: SessionMetrics,
  ): Promise<SessionTransferableLearning> {
    try {
      logger.info(`Processing session completion for learning extraction: ${sessionId}`);

      // Retrieve context states from snapshots
      const contextStates = await Promise.all(
        contextSnapshots.map((id) => _enhancedContextPreservation.retrieveContext(id)),
      );

      const validContexts = contextStates.filter((ctx) => ctx !== null) as DeepContextState[];

      // Extract key learnings from the session
      const keyLearnings = await this.extractKeyLearnings(validContexts, sessionMetrics);
      const transferablePatterns = await this.identifyTransferablePatterns(validContexts);
      const improvementOpportunities = await this.identifyImprovementOpportunities(
        validContexts,
        sessionMetrics,
      );
      const successFactors = await this.identifySuccessFactors(validContexts, sessionMetrics);

      const sessionLearning: SessionTransferableLearning = {
        sessionId,
        timestamp: new Date(),
        keyLearnings,
        transferablePatterns,
        improvementOpportunities,
        successFactors,
      };

      this.sessionLearnings.set(sessionId, sessionLearning);

      // Update user profile with new learnings
      await this.updateUserProfile(sessionLearning);

      // Generate cross-session insights
      await this.generateCrossSessionInsights();

      // Persist the learning data
      await this.persistLearningData();

      this.emit('sessionLearningExtracted', { sessionId, learningCount: keyLearnings.length });

      logger.info(
        `Session learning extraction completed: ${keyLearnings.length} key learnings identified`,
      );
      return sessionLearning;
    } catch (error) {
      logger.error(`Failed to process session completion: ${error}`);
      throw error;
    }
  }

  /**
   * Extract key learnings from context states
   */
  private async extractKeyLearnings(
    _contexts: DeepContextState[],
    _metrics: SessionMetrics,
  ): Promise<KeyLearning[]> {
    const learnings: KeyLearning[] = [];

    // Analyze skill development patterns
    const skillLearnings = this.analyzeSkillDevelopment(contexts, metrics);
    learnings.push(...skillLearnings);

    // Analyze preference patterns
    const preferenceLearnings = this.analyzePreferencePatterns(contexts);
    learnings.push(...preferenceLearnings);

    // Analyze workflow patterns
    const workflowLearnings = this.analyzeWorkflowPatterns(contexts, metrics);
    learnings.push(...workflowLearnings);

    // Analyze strategy effectiveness
    const strategyLearnings = this.analyzeStrategyEffectiveness(contexts, metrics);
    learnings.push(...strategyLearnings);

    return learnings.sort(
      (a, b) => b.confidence * b.transferability - a.confidence * a.transferability,
    );
  }

  /**
   * Analyze skill development from conversation patterns
   */
  private analyzeSkillDevelopment(
    _contexts: DeepContextState[],
    _metrics: SessionMetrics,
  ): KeyLearning[] {
    const learnings: KeyLearning[] = [];

    contexts.forEach((context) => {
      // Analyze technical depth progression
      const topicDepths = context.conversationFlow.topics.map((t) => t.depth);
      if (topicDepths.length > 1) {
        const depthProgression = this.calculateProgression(topicDepths);
        if (depthProgression > 0.2) {
          learnings.push({
            learning: `Demonstrated increasing technical depth in ${context.conversationFlow.currentFocus}`,
            type: 'skill',
            confidence: Math.min(depthProgression, 0.9),
            transferability: 0.7,
            evidenceStrength: topicDepths.length / 10,
          });
        }
      }

      // Analyze question evolution
      const questionTypes = this.categorizeQuestions(context);
      if (questionTypes.basic < questionTypes.advanced) {
        learnings.push({
          learning: 'Progressed from basic to advanced questioning patterns',
          type: 'skill',
          confidence: 0.8,
          transferability: 0.9,
          evidenceStrength: (questionTypes.advanced - questionTypes.basic) / questionTypes.total,
        });
      }
    });

    return learnings;
  }

  /**
   * Calculate progression trend from a series of values
   */
  private calculateProgression(values: number[]): number {
    if (values.length < 2) return 0;

    let progression = 0;
    for (let i = 1; i < values.length; i++) {
      progression += (values[i] - values[i - 1]) / values[i - 1];
    }

    return progression / (values.length - 1);
  }

  /**
   * Categorize questions by complexity
   */
  private categorizeQuestions(context: DeepContextState): {
    basic: number;
    intermediate: number;
    advanced: number;
    total: number;
  } {
    const categories = { basic: 0, intermediate: 0, advanced: 0, total: 0 };

    context.conversationFlow.intentionChain.forEach((intention) => {
      if (intention.intention.includes('how') || intention.intention.includes('what')) {
        if (intention.intention.length < 50) {
          categories.basic++;
        } else if (intention.intention.length < 100) {
          categories.intermediate++;
        } else {
          categories.advanced++;
        }
        categories.total++;
      }
    });

    return categories;
  }

  /**
   * Analyze preference patterns from user behavior
   */
  private analyzePreferencePatterns(contexts: DeepContextState[]): KeyLearning[] {
    const learnings: KeyLearning[] = [];

    // Analyze communication preferences
    const communicationPattern = this.analyzeCommunicationPreferences(contexts);
    if (communicationPattern.confidence > 0.6) {
      learnings.push({
        learning: `Prefers ${communicationPattern.style} communication style`,
        type: 'preference',
        confidence: communicationPattern.confidence,
        transferability: 0.95,
        evidenceStrength: communicationPattern.evidenceCount / 10,
      });
    }

    // Analyze tool preferences
    const toolPreferences = this.analyzeToolPreferences(contexts);
    toolPreferences.forEach((pref) => {
      if (pref.confidence > 0.7) {
        learnings.push({
          learning: `Shows preference for ${pref.tool} in ${pref.context} contexts`,
          type: 'preference',
          confidence: pref.confidence,
          transferability: 0.8,
          evidenceStrength: pref.usage / 5,
        });
      }
    });

    return learnings;
  }

  /**
   * Analyze communication preferences from context
   */
  private analyzeCommunicationPreferences(contexts: DeepContextState[]): {
    style: string;
    confidence: number;
    evidenceCount: number;
  } {
    let formalityScore = 0;
    let directnessScore = 0;
    let verbosityScore = 0;
    let evidenceCount = 0;

    contexts.forEach((context) => {
      context.conversationFlow.topics.forEach((topic) => {
        // Analyze formality from language patterns
        if (topic.name.includes('please') || topic.name.includes('could')) {
          formalityScore += 0.1;
        }
        if (topic.name.includes('help') || topic.name.includes('fix')) {
          directnessScore += 0.1;
        }
        if (topic.keywords.length > 5) {
          verbosityScore += 0.1;
        }
        evidenceCount++;
      });
    });

    const maxScore = Math.max(formalityScore, directnessScore, verbosityScore);
    let style = 'balanced';
    if (maxScore === formalityScore) style = 'formal';
    else if (maxScore === directnessScore) style = 'direct';
    else if (maxScore === verbosityScore) style = 'verbose';

    return {
      style,
      confidence: maxScore / evidenceCount,
      evidenceCount,
    };
  }

  /**
   * Analyze tool preferences from usage patterns
   */
  private analyzeToolPreferences(
    _contexts: DeepContextState[],
  ): Array<{ tool: string; context: string; confidence: number; usage: number }> {
    const preferences: Array<{ tool: string; context: string; confidence: number; usage: number }> =
      [];

    // This would analyze actual tool usage from project context
    // For now, return empty array as placeholder
    return preferences;
  }

  /**
   * Analyze workflow patterns
   */
  private analyzeWorkflowPatterns(
    _contexts: DeepContextState[],
    _metrics: SessionMetrics,
  ): KeyLearning[] {
    const learnings: KeyLearning[] = [];

    // Analyze task sequencing patterns
    const sequencePatterns = this.analyzeTaskSequencing(contexts);
    sequencePatterns.forEach((pattern) => {
      if (pattern.efficiency > 0.8) {
        learnings.push({
          learning: `Effective workflow pattern: ${pattern.sequence}`,
          type: 'pattern',
          confidence: pattern.confidence,
          transferability: 0.85,
          evidenceStrength: pattern.frequency / 5,
        });
      }
    });

    // Analyze interruption handling
    const interruptionHandling = this.analyzeInterruptionHandling(contexts);
    if (interruptionHandling.effectiveness > 0.7) {
      learnings.push({
        learning: `Effective interruption handling strategy: ${interruptionHandling.strategy}`,
        type: 'strategy',
        confidence: interruptionHandling.confidence,
        transferability: 0.8,
        evidenceStrength: interruptionHandling.instances / 3,
      });
    }

    return learnings;
  }

  /**
   * Analyze task sequencing patterns
   */
  private analyzeTaskSequencing(
    _contexts: DeepContextState[],
  ): Array<{ sequence: string; efficiency: number; confidence: number; frequency: number }> {
    const patterns: Array<{
      sequence: string;
      efficiency: number;
      confidence: number;
      frequency: number;
    }> = [];

    // Analyze goal transitions and their effectiveness
    contexts.forEach((context) => {
      if (context.taskContext.progressTracking.overall > 0.8) {
        patterns.push({
          sequence: context.taskContext.currentGoal.primary,
          efficiency: context.taskContext.progressTracking.overall,
          confidence: 0.7,
          frequency: 1,
        });
      }
    });

    return patterns;
  }

  /**
   * Analyze interruption handling effectiveness
   */
  private analyzeInterruptionHandling(contexts: DeepContextState[]): {
    strategy: string;
    effectiveness: number;
    confidence: number;
    instances: number;
  } {
    let interruptions = 0;
    let effectiveHandling = 0;

    contexts.forEach((context) => {
      const interruptedTransitions = context.conversationFlow.transitions.filter(
        (t) => t.transitionType === 'interrupted',
      );
      interruptions += interruptedTransitions.length;

      // If conversation momentum remained high after interruptions, handling was effective
      if (context.conversationFlow.conversationMomentum > 0.6) {
        effectiveHandling += interruptedTransitions.length;
      }
    });

    return {
      strategy: 'context-preserving',
      effectiveness: interruptions > 0 ? effectiveHandling / interruptions : 0,
      confidence: Math.min(interruptions / 5, 1),
      instances: interruptions,
    };
  }

  /**
   * Analyze strategy effectiveness
   */
  private analyzeStrategyEffectiveness(
    _contexts: DeepContextState[],
    _metrics: SessionMetrics,
  ): KeyLearning[] {
    const learnings: KeyLearning[] = [];

    // Analyze problem-solving strategies
    const problemSolvingStrategies = this.analyzeProblemSolvingStrategies(contexts);
    problemSolvingStrategies.forEach((strategy) => {
      if (strategy.successRate > 0.8) {
        learnings.push({
          learning: `Effective problem-solving strategy: ${strategy.name}`,
          type: 'strategy',
          confidence: strategy.confidence,
          transferability: 0.9,
          evidenceStrength: strategy.instances / 3,
        });
      }
    });

    return learnings;
  }

  /**
   * Analyze problem-solving strategies
   */
  private analyzeProblemSolvingStrategies(
    _contexts: DeepContextState[],
  ): Array<{ name: string; successRate: number; confidence: number; instances: number }> {
    const strategies: Array<{
      name: string;
      successRate: number;
      confidence: number;
      instances: number;
    }> = [];

    // Analyze if user asks clarifying questions before diving into solutions
    let clarifyingInstances = 0;
    let directInstances = 0;
    let clarifyingSuccesses = 0;
    let directSuccesses = 0;

    contexts.forEach((context) => {
      const hasQuestions = context.conversationFlow.intentionChain.some((i) =>
        i.intention.includes('?'),
      );
      const hasProgress = context.taskContext.progressTracking.overall > 0.5;

      if (hasQuestions) {
        clarifyingInstances++;
        if (hasProgress) clarifyingSuccesses++;
      } else {
        directInstances++;
        if (hasProgress) directSuccesses++;
      }
    });

    if (clarifyingInstances > 0) {
      strategies.push({
        name: 'clarification-first',
        successRate: clarifyingSuccesses / clarifyingInstances,
        confidence: Math.min(clarifyingInstances / 3, 1),
        instances: clarifyingInstances,
      });
    }

    if (directInstances > 0) {
      strategies.push({
        name: 'direct-action',
        successRate: directSuccesses / directInstances,
        confidence: Math.min(directInstances / 3, 1),
        instances: directInstances,
      });
    }

    return strategies;
  }

  /**
   * Identify transferable patterns across contexts
   */
  private async identifyTransferablePatterns(
    _contexts: DeepContextState[],
  ): Promise<TransferablePattern[]> {
    const patterns: TransferablePattern[] = [];

    // Identify knowledge graph patterns that could transfer
    contexts.forEach((context) => {
      context.knowledgeGraph.clusterings.forEach((cluster) => {
        if (cluster.cohesion > 0.8) {
          patterns.push({
            pattern: `Knowledge cluster: ${cluster.theme}`,
            sourceContext: 'current',
            applicableContexts: ['similar-domain', 'related-technology'],
            adaptationRequired: 0.3,
            successProbability: cluster.cohesion,
          });
        }
      });
    });

    return patterns;
  }

  /**
   * Identify improvement opportunities
   */
  private async identifyImprovementOpportunities(
    _contexts: DeepContextState[],
    _metrics: SessionMetrics,
  ): Promise<ImprovementOpportunity[]> {
    const opportunities: ImprovementOpportunity[] = [];

    // Identify areas where user struggled
    contexts.forEach((context) => {
      if (context.emotionalContext.frustrationLevel > 0.6) {
        opportunities.push({
          area: 'frustration-management',
          currentState: 'High frustration during complex tasks',
          targetState: 'Maintained calm and systematic approach',
          actionPlan: [
            'Break down complex tasks into smaller steps',
            'Provide more frequent progress indicators',
            'Offer alternative approaches when stuck',
          ],
          estimatedTimeframe: 3, // sessions
          priority: 0.8,
        });
      }

      // Identify knowledge gaps
      if (context.userBehavior.skillLevel.confidenceLevel < 0.5) {
        const domains = Object.keys(context.userBehavior.skillLevel.domainSkills);
        domains.forEach((domain) => {
          if (context.userBehavior.skillLevel.domainSkills[domain] < 0.6) {
            opportunities.push({
              area: `skill-development-${domain}`,
              currentState: `Beginner level in ${domain}`,
              targetState: `Intermediate proficiency in ${domain}`,
              actionPlan: [
                `Provide more structured learning in ${domain}`,
                `Offer practice exercises`,
                `Connect to existing knowledge`,
              ],
              estimatedTimeframe: 10,
              priority: 0.7,
            });
          }
        });
      }
    });

    return opportunities.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Identify success factors from session
   */
  private async identifySuccessFactors(
    _contexts: DeepContextState[],
    _metrics: SessionMetrics,
  ): Promise<SuccessFactor[]> {
    const factors: SuccessFactor[] = [];

    // Identify what led to high engagement
    contexts.forEach((context) => {
      if (context.emotionalContext.engagementLevel > 0.8) {
        factors.push({
          factor: 'high-momentum-conversation',
          importance: 0.9,
          context: 'interactive-session',
          reproducibility: 0.8,
        });
      }

      if (context.taskContext.progressTracking.overall > 0.8) {
        factors.push({
          factor: 'clear-goal-definition',
          importance: 0.85,
          context: 'task-execution',
          reproducibility: 0.9,
        });
      }
    });

    return factors;
  }

  /**
   * Update user profile with session learnings
   */
  private async updateUserProfile(sessionLearning: SessionTransferableLearning): Promise<void> {
    let profile = this.userProfiles.get(this.currentUserId);
    if (!profile) {
      profile = this.createNewUserProfile(this.currentUserId);
      this.userProfiles.set(this.currentUserId, profile);
    }

    // Update skill domains
    sessionLearning.keyLearnings.forEach((learning) => {
      if (learning.type === 'skill') {
        this.updateSkillDomain(profile!, learning);
      } else if (learning.type === 'preference') {
        this.updatePreference(profile!, learning);
      } else if (learning.type === 'pattern') {
        this.updateWorkflowPattern(profile!, learning);
      }
    });

    // Add to learning trajectory
    const trajectoryPoint: LearningTrajectoryPoint = {
      timestamp: new Date(),
      skill: 'general',
      level: this.calculateOverallSkillLevel(profile),
      learningEvent: {
        type: 'practice',
        description: `Session with ${sessionLearning.keyLearnings.length} key learnings`,
        impact:
          sessionLearning.keyLearnings.reduce((sum, l) => sum + l.confidence, 0) /
          sessionLearning.keyLearnings.length,
        contextId: sessionLearning.sessionId,
      },
      momentum: this.calculateLearningMomentum(profile),
    };

    profile.learningTrajectory.push(trajectoryPoint);

    // Keep only last 100 trajectory points
    if (profile.learningTrajectory.length > 100) {
      profile.learningTrajectory = profile.learningTrajectory.slice(-100);
    }

    this.emit('userProfileUpdated', {
      userId: this.currentUserId,
      learningsApplied: sessionLearning.keyLearnings.length,
    });
  }

  /**
   * Update skill domain in user profile
   */
  private updateSkillDomain(profile: UserKnowledgeProfile, learning: KeyLearning): void {
    const skillName = this.extractSkillFromLearning(learning.learning);
    let skillDomain = profile.skillDomains.get(skillName);

    if (!skillDomain) {
      skillDomain = {
        domain: skillName,
        currentLevel: 0.1,
        learningVelocity: 0,
        plateauIndicators: [],
        expertiseAreas: [],
        knowledgeGaps: [],
        lastAssessment: new Date(),
      };
      profile.skillDomains.set(skillName, skillDomain);
    }

    // Update skill level
    const improvementRate = learning.confidence * learning.transferability * 0.1;
    skillDomain.currentLevel = Math.min(skillDomain.currentLevel + improvementRate, 1);
    skillDomain.lastAssessment = new Date();

    // Update learning velocity
    const timeSinceLastUpdate = Date.now() - skillDomain.lastAssessment.getTime();
    const hoursElapsed = timeSinceLastUpdate / (1000 * 60 * 60);
    skillDomain.learningVelocity = improvementRate / Math.max(hoursElapsed, 1);
  }

  /**
   * Extract skill name from learning description
   */
  private extractSkillFromLearning(learning: string): string {
    // Simple extraction - can be enhanced with NLP
    const skillKeywords = [
      'programming',
      'debugging',
      'testing',
      'design',
      'architecture',
      'analysis',
    ];

    for (const keyword of skillKeywords) {
      if (learning.toLowerCase().includes(keyword)) {
        return keyword;
      }
    }

    return 'general';
  }

  /**
   * Update preference in user profile
   */
  private updatePreference(profile: UserKnowledgeProfile, learning: KeyLearning): void {
    const preferenceName = this.extractPreferenceFromLearning(learning.learning);
    let preference = profile.preferences.get(preferenceName);

    if (!preference) {
      preference = {
        preference: preferenceName,
        weight: 0,
        confidence: 0,
        contextDependency: {},
        stability: 0.5,
      };
      profile.preferences.set(preferenceName, preference);
    }

    // Update preference weight and confidence
    const weight = learning.learning.includes('prefer') ? 0.5 : -0.5;
    preference.weight = (preference.weight + weight * learning.confidence) / 2;
    preference.confidence = Math.max(preference.confidence, learning.confidence);
    preference.stability = (preference.stability + 0.8) / 2; // Preferences become more stable over time
  }

  /**
   * Extract preference name from learning description
   */
  private extractPreferenceFromLearning(learning: string): string {
    // Extract the main subject of the preference
    if (learning.includes('communication')) return 'communication-style';
    if (learning.includes('tool')) return 'tool-preference';
    if (learning.includes('format')) return 'format-preference';

    return 'general-preference';
  }

  /**
   * Update workflow pattern in user profile
   */
  private updateWorkflowPattern(profile: UserKnowledgeProfile, learning: KeyLearning): void {
    const patternName = this.extractPatternFromLearning(learning.learning);
    let pattern = profile.workflowPatterns.get(patternName);

    if (!pattern) {
      pattern = {
        pattern: patternName,
        frequency: 0,
        efficiency: 0,
        contextSuitability: {},
        variations: [],
        optimizationPotential: 1,
      };
      profile.workflowPatterns.set(patternName, pattern);
    }

    pattern.frequency++;
    pattern.efficiency = (pattern.efficiency + learning.confidence) / 2;
    pattern.optimizationPotential = Math.max(0, pattern.optimizationPotential - 0.1);
  }

  /**
   * Extract pattern name from learning description
   */
  private extractPatternFromLearning(learning: string): string {
    if (learning.includes('sequence')) return 'task-sequencing';
    if (learning.includes('workflow')) return 'workflow-pattern';
    if (learning.includes('approach')) return 'problem-approach';

    return 'general-pattern';
  }

  /**
   * Calculate overall skill level for user
   */
  private calculateOverallSkillLevel(profile: UserKnowledgeProfile): number {
    const skillLevels = Array.from(profile.skillDomains.values()).map((s) => s.currentLevel);
    return skillLevels.length > 0
      ? skillLevels.reduce((sum, level) => sum + level, 0) / skillLevels.length
      : 0;
  }

  /**
   * Calculate learning momentum
   */
  private calculateLearningMomentum(profile: UserKnowledgeProfile): number {
    const recentPoints = profile.learningTrajectory.slice(-5);
    if (recentPoints.length < 2) return 0;

    const momentum = recentPoints.slice(1).reduce((sum, point, index) => {
      return sum + (point.level - recentPoints[index].level);
    }, 0);

    return momentum / (recentPoints.length - 1);
  }

  /**
   * Create new user profile
   */
  private createNewUserProfile(userId: string): UserKnowledgeProfile {
    return {
      userId,
      skillDomains: new Map(),
      preferences: new Map(),
      workflowPatterns: new Map(),
      learningTrajectory: [],
      personalityTraits: {
        traits: new Map([
          ['openness', 0.5],
          ['conscientiousness', 0.5],
          ['extraversion', 0.5],
          ['agreeableness', 0.5],
          ['neuroticism', 0.5],
        ]),
        communicationStyle: {
          formality: 0.5,
          directness: 0.5,
          verbosity: 0.5,
          questioningStyle: 'convergent',
          feedbackReceptivity: 0.7,
        },
        learningStyle: {
          modalityPreferences: new Map([
            ['visual', 0.33],
            ['auditory', 0.33],
            ['kinesthetic', 0.33],
          ]),
          pacePreference: 'adaptive',
          structurePreference: 0.5,
          depthVsBreadth: 0,
        },
        motivationFactors: [],
        stressPattern: {
          stressTriggers: [],
          stressIndicators: [],
          copingStrategies: [],
          optimalChallengeLevel: 0.7,
        },
      },
      adaptationStrategies: new Map(),
    };
  }

  /**
   * Generate cross-session insights
   */
  private async generateCrossSessionInsights(): Promise<void> {
    const profile = this.userProfiles.get(this.currentUserId);
    if (!profile) return;

    // Analyze learning trends
    const trendInsights = this.analyzeLearningTrends(profile);
    trendInsights.forEach((insight) => {
      this.crossSessionInsights.set(insight.id, insight);
    });

    // Analyze skill correlations
    const correlationInsights = this.analyzeSkillCorrelations(profile);
    correlationInsights.forEach((insight) => {
      this.crossSessionInsights.set(insight.id, insight);
    });

    // Identify optimization opportunities
    const optimizationInsights = this.identifyOptimizationOpportunities(profile);
    optimizationInsights.forEach((insight) => {
      this.crossSessionInsights.set(insight.id, insight);
    });

    this.emit('crossSessionInsightsGenerated', {
      insightCount: trendInsights.length + correlationInsights.length + optimizationInsights.length,
    });
  }

  /**
   * Analyze learning trends across sessions
   */
  private analyzeLearningTrends(profile: UserKnowledgeProfile): CrossSessionInsight[] {
    const insights: CrossSessionInsight[] = [];

    // Analyze learning velocity trends
    const recentTrajectory = profile.learningTrajectory.slice(-10);
    if (recentTrajectory.length >= 5) {
      const momentum = this.calculateLearningMomentum(profile);

      if (momentum > 0.1) {
        insights.push({
          id: `trend-${Date.now()}-acceleration`,
          type: 'trend',
          insight: 'Learning velocity is accelerating - user is building momentum',
          confidence: 0.8,
          impact: 0.9,
          evidenceSessions: recentTrajectory.map((p) => p.contextId),
          actionable: true,
          recommendations: [
            'Maintain current pace and gradually increase complexity',
            'Introduce more challenging problems to sustain growth',
          ],
          timestamp: new Date(),
        });
      } else if (momentum < -0.05) {
        insights.push({
          id: `trend-${Date.now()}-plateau`,
          type: 'trend',
          insight: 'Learning appears to be plateauing - consider new approaches',
          confidence: 0.7,
          impact: 0.8,
          evidenceSessions: recentTrajectory.map((p) => p.contextId),
          actionable: true,
          recommendations: [
            'Introduce new problem types or domains',
            'Vary the learning approach or methodology',
            'Focus on deeper understanding rather than breadth',
          ],
          timestamp: new Date(),
        });
      }
    }

    return insights;
  }

  /**
   * Analyze correlations between different skills
   */
  private analyzeSkillCorrelations(profile: UserKnowledgeProfile): CrossSessionInsight[] {
    const insights: CrossSessionInsight[] = [];

    const skills = Array.from(profile.skillDomains.entries());

    // Find skills that tend to improve together
    for (let i = 0; i < skills.length; i++) {
      for (let j = i + 1; j < skills.length; j++) {
        const correlation = this.calculateSkillCorrelation(skills[i][1], skills[j][1], profile);

        if (correlation > 0.7) {
          insights.push({
            id: `correlation-${Date.now()}-${i}-${j}`,
            type: 'correlation',
            insight: `Strong positive correlation between ${skills[i][0]} and ${skills[j][0]} skills`,
            confidence: correlation,
            impact: 0.7,
            evidenceSessions: [],
            actionable: true,
            recommendations: [
              `Focus on developing ${skills[i][0]} to boost ${skills[j][0]}`,
              'Leverage this connection for accelerated learning',
            ],
            timestamp: new Date(),
          });
        }
      }
    }

    return insights;
  }

  /**
   * Calculate correlation between two skills based on learning trajectory
   */
  private calculateSkillCorrelation(
    skill1: SkillDomain,
    skill2: SkillDomain,
    profile: UserKnowledgeProfile,
  ): number {
    // Simple correlation based on simultaneous improvements
    // In a full implementation, this would use statistical correlation
    const commonImprovements = profile.learningTrajectory.filter(
      (point) =>
        point.learningEvent.description.includes(skill1.domain) ||
        point.learningEvent.description.includes(skill2.domain),
    );

    return Math.min(commonImprovements.length / 10, 1);
  }

  /**
   * Identify optimization opportunities
   */
  private identifyOptimizationOpportunities(profile: UserKnowledgeProfile): CrossSessionInsight[] {
    const insights: CrossSessionInsight[] = [];

    // Identify underutilized skills
    const underutilizedSkills = Array.from(profile.skillDomains.values()).filter(
      (skill) => skill.currentLevel > 0.7 && skill.learningVelocity < 0.1,
    );

    underutilizedSkills.forEach((skill) => {
      insights.push({
        id: `opportunity-${Date.now()}-${skill.domain}`,
        type: 'opportunity',
        insight: `High skill in ${skill.domain} could be leveraged more effectively`,
        confidence: 0.8,
        impact: 0.6,
        evidenceSessions: [],
        actionable: true,
        recommendations: [
          `Apply ${skill.domain} skills to new problem domains`,
          `Consider teaching or mentoring in ${skill.domain}`,
          `Use ${skill.domain} as a foundation for learning related skills`,
        ],
        timestamp: new Date(),
      });
    });

    return insights;
  }

  /**
   * Get cross-session recommendations for current session
   */
  async getCrossSessionRecommendations(): Promise<{
    skillRecommendations: string[];
    workflowRecommendations: string[];
    personalizedSuggestions: string[];
  }> {
    const profile = this.userProfiles.get(this.currentUserId);
    if (!profile) {
      return { skillRecommendations: [], workflowRecommendations: [], personalizedSuggestions: [] };
    }

    const skillRecommendations = this.generateSkillRecommendations(profile);
    const workflowRecommendations = this.generateWorkflowRecommendations(profile);
    const personalizedSuggestions = this.generatePersonalizedSuggestions(profile);

    return {
      skillRecommendations,
      workflowRecommendations,
      personalizedSuggestions,
    };
  }

  /**
   * Generate skill-based recommendations
   */
  private generateSkillRecommendations(profile: UserKnowledgeProfile): string[] {
    const recommendations: string[] = [];

    // Recommend focusing on high-velocity skills
    const highVelocitySkills = Array.from(profile.skillDomains.values())
      .filter((skill) => skill.learningVelocity > 0.2)
      .sort((a, b) => b.learningVelocity - a.learningVelocity);

    if (highVelocitySkills.length > 0) {
      recommendations.push(
        `Focus on ${highVelocitySkills[0].domain} - you're learning this rapidly`,
      );
    }

    // Recommend addressing knowledge gaps
    const skillsWithGaps = Array.from(profile.skillDomains.values()).filter(
      (skill) => skill.knowledgeGaps.length > 0,
    );

    if (skillsWithGaps.length > 0) {
      recommendations.push(`Address knowledge gaps in ${skillsWithGaps[0].domain}`);
    }

    return recommendations;
  }

  /**
   * Generate workflow-based recommendations
   */
  private generateWorkflowRecommendations(profile: UserKnowledgeProfile): string[] {
    const recommendations: string[] = [];

    // Recommend high-efficiency patterns
    const efficientPatterns = Array.from(profile.workflowPatterns.values())
      .filter((pattern) => pattern.efficiency > 0.8)
      .sort((a, b) => b.efficiency - a.efficiency);

    if (efficientPatterns.length > 0) {
      recommendations.push(
        `Continue using ${efficientPatterns[0].pattern} - it's highly effective for you`,
      );
    }

    // Recommend optimizing low-efficiency patterns
    const inefficientPatterns = Array.from(profile.workflowPatterns.values()).filter(
      (pattern) => pattern.efficiency < 0.5 && pattern.frequency > 2,
    );

    if (inefficientPatterns.length > 0) {
      recommendations.push(
        `Consider optimizing ${inefficientPatterns[0].pattern} - it's frequently used but inefficient`,
      );
    }

    return recommendations;
  }

  /**
   * Generate personalized suggestions based on preferences and personality
   */
  private generatePersonalizedSuggestions(profile: UserKnowledgeProfile): string[] {
    const suggestions: string[] = [];

    // Suggestions based on communication style
    const commStyle = profile.personalityTraits.communicationStyle;
    if (commStyle.verbosity > 0.7) {
      suggestions.push(
        "I notice you prefer detailed explanations - I'll provide comprehensive responses",
      );
    } else if (commStyle.verbosity < 0.3) {
      suggestions.push("I'll keep responses concise as you prefer brief interactions");
    }

    if (commStyle.directness > 0.7) {
      suggestions.push("I'll be direct and to-the-point in my responses");
    }

    // Suggestions based on learning style
    const learnStyle = profile.personalityTraits.learningStyle;
    if (learnStyle.depthVsBreadth > 0.5) {
      suggestions.push("I'll focus on deep dives into topics rather than broad overviews");
    } else if (learnStyle.depthVsBreadth < -0.5) {
      suggestions.push("I'll provide broader perspectives and connections across topics");
    }

    return suggestions;
  }

  /**
   * Get learning analytics for user
   */
  getLearningAnalytics(): {
    skillProgression: Map<string, number[]>;
    learningVelocity: number;
    strengthAreas: string[];
    improvementAreas: string[];
    recentInsights: CrossSessionInsight[];
  } {
    const profile = this.userProfiles.get(this.currentUserId);
    if (!profile) {
      return {
        skillProgression: new Map(),
        learningVelocity: 0,
        strengthAreas: [],
        improvementAreas: [],
        recentInsights: [],
      };
    }

    const skillProgression = new Map<string, number[]>();
    profile.skillDomains.forEach((skill, domain) => {
      // Get progression from learning trajectory
      const skillPoints = profile.learningTrajectory
        .filter(
          (point) => point.skill === domain || point.learningEvent.description.includes(domain),
        )
        .map((point) => point.level);
      skillProgression.set(domain, skillPoints);
    });

    const learningVelocity = this.calculateLearningMomentum(profile);

    const strengthAreas = Array.from(profile.skillDomains.entries())
      .filter(([_, skill]) => skill.currentLevel > 0.7)
      .map(([domain, _]) => domain);

    const improvementAreas = Array.from(profile.skillDomains.entries())
      .filter(([_, skill]) => skill.currentLevel < 0.4)
      .map(([domain, _]) => domain);

    const recentInsights = Array.from(this.crossSessionInsights.values())
      .filter((insight) => Date.now() - insight.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000) // Last 7 days
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5);

    return {
      skillProgression,
      learningVelocity,
      strengthAreas,
      improvementAreas,
      recentInsights,
    };
  }

  /**
   * Start the learning engine background process
   */
  private startLearningEngine(): void {
    // Periodic analysis every 30 minutes
    setInterval(
      () => {
        this.performPeriodicAnalysis();
      },
      30 * 60 * 1000,
    );

    logger.info('Cross-session learning engine started');
  }

  /**
   * Perform periodic analysis and insights generation
   */
  private async performPeriodicAnalysis(): Promise<void> {
    try {
      const profile = this.userProfiles.get(this.currentUserId);
      if (profile) {
        await this.generateCrossSessionInsights();
        await this.persistLearningData();
      }
    } catch (error) {
      logger.error('Error in periodic learning analysis:', error);
    }
  }

  /**
   * Persist learning data to storage
   */
  private async persistLearningData(): Promise<void> {
    try {
      // Persist user profiles
      const profilesData = Object.fromEntries(
        Array.from(this.userProfiles.entries()).map(([id, profile]) => [
          id,
          {
            ...profile,
            skillDomains: Object.fromEntries(profile.skillDomains),
            preferences: Object.fromEntries(profile.preferences),
            workflowPatterns: Object.fromEntries(profile.workflowPatterns),
            personalityTraits: {
              ...profile.personalityTraits,
              traits: Object.fromEntries(profile.personalityTraits.traits),
              learningStyle: {
                ...profile.personalityTraits.learningStyle,
                modalityPreferences: Object.fromEntries(
                  profile.personalityTraits.learningStyle.modalityPreferences,
                ),
              },
            },
            adaptationStrategies: Object.fromEntries(profile.adaptationStrategies),
          },
        ]),
      );

      writeFileSync(
        join(this.dataDir, 'user-profiles.json'),
        JSON.stringify(profilesData, null, 2),
      );

      // Persist session learnings
      const sessionLearningsData = Object.fromEntries(this.sessionLearnings);
      writeFileSync(
        join(this.dataDir, 'session-learnings.json'),
        JSON.stringify(sessionLearningsData, null, 2),
      );

      // Persist cross-session insights
      const insightsData = Object.fromEntries(this.crossSessionInsights);
      writeFileSync(
        join(this.dataDir, 'cross-session-insights.json'),
        JSON.stringify(insightsData, null, 2),
      );
    } catch (error) {
      logger.error('Failed to persist learning data:', error);
    }
  }

  /**
   * Load persisted learning data
   */
  private loadPersistedData(): void {
    try {
      // Load user profiles
      const profilesFile = join(this.dataDir, 'user-profiles.json');
      if (existsSync(profilesFile)) {
        const profilesData = JSON.parse(readFileSync(profilesFile, 'utf-8'));
        Object.entries(profilesData).forEach(([id, profileData]: [string, any]) => {
          const profile: UserKnowledgeProfile = {
            ...profileData,
            skillDomains: new Map(Object.entries(profileData.skillDomains)),
            preferences: new Map(Object.entries(profileData.preferences)),
            workflowPatterns: new Map(Object.entries(profileData.workflowPatterns)),
            personalityTraits: {
              ...profileData.personalityTraits,
              traits: new Map(Object.entries(profileData.personalityTraits.traits)),
              learningStyle: {
                ...profileData.personalityTraits.learningStyle,
                modalityPreferences: new Map(
                  Object.entries(profileData.personalityTraits.learningStyle.modalityPreferences),
                ),
              },
            },
            adaptationStrategies: new Map(Object.entries(profileData.adaptationStrategies)),
          };
          this.userProfiles.set(id, profile);
        });
      }

      // Load session learnings
      const sessionLearningsFile = join(this.dataDir, 'session-learnings.json');
      if (existsSync(sessionLearningsFile)) {
        const sessionLearningsData = JSON.parse(readFileSync(sessionLearningsFile, 'utf-8'));
        this.sessionLearnings = new Map(Object.entries(sessionLearningsData));
      }

      // Load cross-session insights
      const insightsFile = join(this.dataDir, 'cross-session-insights.json');
      if (existsSync(insightsFile)) {
        const insightsData = JSON.parse(readFileSync(insightsFile, 'utf-8'));
        this.crossSessionInsights = new Map(Object.entries(insightsData));
      }
    } catch (error) {
      logger.error('Failed to load persisted learning data:', error);
    }
  }
}

// Interface for session metrics (to be implemented based on actual metrics system)
interface SessionMetrics {
  duration: number;
  commandCount: number;
  successRate: number;
  errorCount: number;
  userSatisfaction?: number;
  taskCompletionRate: number;
}

export const _crossSessionLearning = CrossSessionLearning.getInstance();
