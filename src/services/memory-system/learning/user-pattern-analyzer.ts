/**
 * User Pattern Analyzer
 *
 * Analyzes user development patterns and behaviors for personalized AI adaptation.
 * Recognizes coding styles, problem-solving approaches, and preferences.
 */

import { EventEmitter } from 'events';
import type { MemoryEvent } from '../types/memory-interfaces';

export interface UserPattern {
  userId: string;
  developmentStyle: DevelopmentStyle;
  problemSolvingApproach: ProblemSolvingApproach;
  codeQualityPreferences: CodeQualityPreferences;
  communicationStyle: CommunicationStyle;
  workingPatterns: WorkingPatterns;
  learningProfile: LearningProfile;
  toolPreferences: ToolPreferences;
}

export interface DevelopmentStyle {
  approach: 'test-driven' | 'prototype-first' | 'documentation-heavy' | 'iterative' | 'waterfall';
  codeOrganization: 'modular' | 'monolithic' | 'microservices' | 'layered';
  refactoringFrequency: 'continuous' | 'periodic' | 'minimal';
  debuggingStyle: 'systematic' | 'intuitive' | 'tool-heavy' | 'print-debugging';
  testingPhilosophy: 'comprehensive' | 'critical-path' | 'minimal' | 'exploratory';
  documentationLevel: 'extensive' | 'essential' | 'minimal' | 'inline-heavy';
  confidence: number; // 0-1 confidence in this classification
}

export interface ProblemSolvingApproach {
  strategy:
    | 'top-down'
    | 'bottom-up'
    | 'divide-conquer'
    | 'iterative-refinement'
    | 'pattern-matching';
  researchDepth: 'thorough' | 'quick-reference' | 'trial-error' | 'documentation-first';
  planningLevel: 'detailed' | 'high-level' | 'minimal' | 'adaptive';
  experimentationRate: number; // 0-1, how often they try different approaches
  reusePreference: 'high' | 'moderate' | 'low'; // tendency to reuse existing solutions
  abstractionLevel: 'high' | 'practical' | 'concrete'; // preference for abstraction
  parallelTasks: number; // average number of parallel tasks
}

export interface CodeQualityPreferences {
  namingConventions: NamingStyle;
  commentingStyle: CommentingStyle;
  errorHandling: ErrorHandlingStyle;
  performanceConsideration: 'optimize-first' | 'functional-first' | 'balanced';
  securityAwareness: 'paranoid' | 'standard' | 'minimal';
  codeReviewExpectation: 'thorough' | 'quick' | 'automated-only';
  refactoringThreshold: number; // complexity threshold before refactoring
  testCoverageTarget: number; // preferred test coverage percentage
}

export interface NamingStyle {
  caseStyle: 'camelCase' | 'snake_case' | 'PascalCase' | 'kebab-case' | 'mixed';
  verbosity: 'descriptive' | 'concise' | 'abbreviated';
  prefixUsage: boolean;
  hungarianNotation: boolean;
  consistency: number; // 0-1, how consistent they are
}

export interface CommentingStyle {
  frequency: 'extensive' | 'moderate' | 'minimal' | 'none';
  type: 'explanatory' | 'documentary' | 'todo-heavy' | 'warning-focused';
  location: 'inline' | 'block' | 'header' | 'mixed';
  language: 'technical' | 'plain' | 'humorous' | 'formal';
  codeToCommentRatio: number; // lines of code per comment
}

export interface ErrorHandlingStyle {
  strategy: 'defensive' | 'optimistic' | 'fail-fast' | 'graceful-degradation';
  exceptionUsage: 'liberal' | 'conservative' | 'avoided';
  validationLevel: 'paranoid' | 'standard' | 'trusting';
  loggingVerbosity: 'everything' | 'errors-only' | 'critical-only' | 'debug-heavy';
  recoveryApproach: 'retry' | 'fallback' | 'abort' | 'ignore';
}

export interface CommunicationStyle {
  responseLength: 'verbose' | 'concise' | 'minimal';
  explanationDepth: 'detailed' | 'high-level' | 'assumption-based';
  questioningStyle: 'specific' | 'exploratory' | 'confirmatory';
  feedbackPreference: 'continuous' | 'milestone-based' | 'final-only';
  collaborationLevel: 'highly-interactive' | 'periodic-sync' | 'independent';
  technicalLevel: 'expert' | 'intermediate' | 'beginner-friendly';
  preferredChannels: CommunicationChannel[];
}

export interface CommunicationChannel {
  type: 'chat' | 'comments' | 'documentation' | 'meetings' | 'async';
  frequency: 'constant' | 'regular' | 'occasional' | 'rare';
  preference: number; // 0-1
}

export interface WorkingPatterns {
  sessionDuration: SessionPattern;
  focusTime: FocusPattern;
  breakFrequency: BreakPattern;
  taskSwitching: TaskSwitchingPattern;
  productivityPeaks: ProductivityPattern[];
  preferredHours: TimePreference;
}

export interface SessionPattern {
  averageDuration: number; // minutes
  distribution: 'consistent' | 'variable' | 'burst';
  sessionsPerDay: number;
  deepWorkRatio: number; // ratio of uninterrupted work
}

export interface FocusPattern {
  averageFocusDuration: number; // minutes
  distractionResistance: 'high' | 'medium' | 'low';
  contextSwitchCost: number; // minutes to regain focus
  preferredEnvironment: 'quiet' | 'background-noise' | 'music' | 'variable';
}

export interface BreakPattern {
  averageInterval: number; // minutes between breaks
  breakDuration: number; // average break length in minutes
  breakType: 'complete-disconnect' | 'light-activity' | 'context-switch';
  consistency: number; // 0-1, how regular their breaks are
}

export interface TaskSwitchingPattern {
  frequency: 'single-focus' | 'occasional' | 'frequent' | 'constant';
  switchTrigger: 'completion' | 'blocker' | 'time-based' | 'mood-based';
  parallelTasks: number; // average number of parallel tasks
  contextRetention: 'excellent' | 'good' | 'poor';
}

export interface ProductivityPattern {
  timeOfDay: string; // "09:00-11:00"
  dayOfWeek: string[];
  productivityLevel: number; // 0-1
  taskTypes: string[]; // types of tasks they prefer during this time
}

export interface TimePreference {
  timezone: string;
  workingHours: { start: string; end: string };
  preferredDays: string[];
  flexibilityLevel: 'strict' | 'flexible' | 'any-time';
}

export interface LearningProfile {
  learningStyle: LearningStyle;
  knowledgeAcquisition: KnowledgeAcquisition;
  skillProgression: SkillProgression;
  retentionPattern: RetentionPattern;
  preferredResources: ResourcePreference[];
}

export interface LearningStyle {
  primary: 'visual' | 'reading' | 'hands-on' | 'auditory';
  secondary: string[];
  examplePreference: 'many-examples' | 'few-examples' | 'abstract';
  conceptualDepth: 'surface' | 'thorough' | 'deep-dive';
  practiceRatio: number; // theory vs practice preference
}

export interface KnowledgeAcquisition {
  speed: 'fast' | 'moderate' | 'methodical';
  breadthVsDepth: 'broad' | 'balanced' | 'specialized';
  curiosityLevel: 'high' | 'selective' | 'task-focused';
  experimentationRate: number; // 0-1
  documentationReliance: 'heavy' | 'moderate' | 'minimal';
}

export interface SkillProgression {
  growthRate: number; // skill improvement rate
  plateauHandling: 'persistent' | 'pivot' | 'external-help';
  challengePreference: 'stretch' | 'comfortable' | 'easy';
  masteryApproach: 'perfectionist' | 'good-enough' | 'continuous';
}

export interface RetentionPattern {
  shortTermRetention: 'excellent' | 'good' | 'poor';
  longTermRetention: 'excellent' | 'good' | 'poor';
  refreshFrequency: number; // days between needing refresh
  noteTaking: 'extensive' | 'key-points' | 'minimal' | 'none';
}

export interface ResourcePreference {
  type: 'documentation' | 'tutorials' | 'videos' | 'forums' | 'ai-assistance' | 'mentorship';
  trustLevel: number; // 0-1
  usageFrequency: number; // 0-1
}

export interface ToolPreferences {
  ide: IDEPreference;
  versionControl: VersionControlPreference;
  debugging: DebuggingPreference;
  testing: TestingPreference;
  deployment: DeploymentPreference;
  aiAssistance: AIAssistancePreference;
}

export interface IDEPreference {
  preferred: string[];
  featureUsage: {
    autoComplete: number; // 0-1
    refactoring: number;
    debugging: number;
    navigation: number;
    snippets: number;
  };
  customization: 'heavy' | 'moderate' | 'minimal';
  keyboardShortcuts: 'extensive' | 'common' | 'minimal';
}

export interface VersionControlPreference {
  commitFrequency: 'continuous' | 'feature-complete' | 'daily' | 'irregular';
  commitSize: 'atomic' | 'feature' | 'large';
  branchingStrategy: 'feature-branch' | 'trunk' | 'gitflow';
  messageStyle: 'detailed' | 'conventional' | 'brief';
  collaborationStyle: 'pull-request' | 'direct-push' | 'paired';
}

export interface DebuggingPreference {
  primaryMethod: 'debugger' | 'logging' | 'unit-tests' | 'repl';
  toolUsage: {
    breakpoints: number; // 0-1
    watches: number;
    profiler: number;
    memoryAnalyzer: number;
  };
  systematicness: 'methodical' | 'intuitive' | 'random';
}

export interface TestingPreference {
  testWriting: 'before' | 'during' | 'after' | 'never';
  testTypes: {
    unit: number; // 0-1 preference
    integration: number;
    e2e: number;
    performance: number;
  };
  mockingUsage: 'extensive' | 'moderate' | 'minimal';
  assertionStyle: 'detailed' | 'basic' | 'minimal';
}

export interface DeploymentPreference {
  frequency: 'continuous' | 'daily' | 'weekly' | 'release-based';
  automation: 'full' | 'partial' | 'manual';
  monitoring: 'comprehensive' | 'basic' | 'minimal';
  rollbackStrategy: 'immediate' | 'careful' | 'forward-only';
}

export interface AIAssistancePreference {
  usageLevel: 'heavy' | 'moderate' | 'minimal' | 'none';
  trustLevel: number; // 0-1
  verificationBehavior: 'always-verify' | 'trust-but-verify' | 'trust-completely';
  interactionStyle: 'conversational' | 'command-based' | 'suggestion-only';
  scopePreference: 'full-solution' | 'guidance' | 'syntax-only';
}

export interface PatternAnalysis {
  pattern: UserPattern;
  confidence: number;
  evidence: PatternEvidence[];
  predictions: PatternPrediction[];
  recommendations: PatternRecommendation[];
}

export interface PatternEvidence {
  type: string;
  occurrences: number;
  strength: number; // 0-1
  examples: string[];
  lastObserved: Date;
}

export interface PatternPrediction {
  aspect: string;
  prediction: string;
  confidence: number;
  timeframe: string;
}

export interface PatternRecommendation {
  category: string;
  recommendation: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  expectedImpact: string;
}

export interface PatternMetrics {
  totalEvents: number;
  analyzedEvents: number;
  patternStrength: number;
  consistency: number;
  evolution: PatternEvolution[];
}

export interface PatternEvolution {
  timestamp: Date;
  aspect: string;
  oldValue: unknown;
  newValue: unknown;
  confidence: number;
}

export class UserPatternAnalyzer extends EventEmitter {
  private patterns: Map<string, UserPattern>;
  private eventHistory: Map<string, MemoryEvent[]>;
  private analysisCache: Map<string, PatternAnalysis>;
  private metricsCache: Map<string, PatternMetrics>;
  private updateInterval?: NodeJS.Timeout;

  constructor() {
    super();

    this.patterns = new Map();
    this.eventHistory = new Map();
    this.analysisCache = new Map();
    this.metricsCache = new Map();

    this.startAnalysis();
  }

  // ========== Pattern Analysis ==========

  async analyzeUserEvent(userId: string, event: MemoryEvent): Promise<void> {
    // Store event in history
    const history = this.eventHistory.get(userId) || [];
    history.push(event);

    // Keep only recent history (last 1000 events)
    if (history.length > 1000) {
      history.shift();
    }
    this.eventHistory.set(userId, history);

    // Update pattern analysis
    await this.updatePatternAnalysis(userId, event);

    // Check for pattern evolution
    await this.detectPatternEvolution(userId);

    this.emit('eventAnalyzed', { userId, event });
  }

  private async updatePatternAnalysis(userId: string, event: MemoryEvent): Promise<void> {
    const currentPattern = this.patterns.get(userId) || this.createDefaultPattern(userId);

    // Analyze different aspects based on event type
    switch (event.type) {
      case 'code-generation':
        await this.analyzeCodeGeneration(currentPattern, event);
        break;
      case 'debugging':
        await this.analyzeDebugging(currentPattern, event);
        break;
      case 'testing':
        await this.analyzeTesting(currentPattern, event);
        break;
      case 'communication':
        await this.analyzeCommunication(currentPattern, event);
        break;
      case 'learning':
        await this.analyzeLearning(currentPattern, event);
        break;
    }

    // Update confidence scores
    this.updateConfidence(currentPattern);

    this.patterns.set(userId, currentPattern);

    // Generate new analysis
    const analysis = await this.generateAnalysis(currentPattern);
    this.analysisCache.set(userId, analysis);

    this.emit('patternUpdated', { userId, pattern: currentPattern, analysis });
  }

  private async analyzeCodeGeneration(pattern: UserPattern, event: MemoryEvent): Promise<void> {
    const codeData = event.data as any;

    // Analyze development style
    if (codeData.tests && codeData.tests.writtenFirst) {
      this.adjustDevelopmentStyle(pattern, 'test-driven', 0.1);
    } else if (codeData.prototype) {
      this.adjustDevelopmentStyle(pattern, 'prototype-first', 0.1);
    }

    // Analyze code organization
    if (codeData.structure) {
      const moduleCount = codeData.structure.modules?.length || 0;
      const fileSize = codeData.structure.averageFileSize || 0;

      if (moduleCount > 10 && fileSize < 200) {
        this.adjustCodeOrganization(pattern, 'modular', 0.1);
      } else if (moduleCount < 3 && fileSize > 500) {
        this.adjustCodeOrganization(pattern, 'monolithic', 0.1);
      }
    }

    // Analyze naming conventions
    if (codeData.identifiers) {
      this.analyzeNamingStyle(pattern, codeData.identifiers);
    }

    // Analyze commenting style
    if (codeData.comments) {
      this.analyzeCommentingStyle(pattern, codeData.comments);
    }

    // Analyze error handling
    if (codeData.errorHandling) {
      this.analyzeErrorHandling(pattern, codeData.errorHandling);
    }
  }

  private async analyzeDebugging(pattern: UserPattern, event: MemoryEvent): Promise<void> {
    const debugData = event.data as any;

    // Analyze debugging style
    if (debugData.method === 'systematic') {
      pattern.developmentStyle.debuggingStyle = 'systematic';
    } else if (debugData.method === 'logging') {
      pattern.developmentStyle.debuggingStyle = 'print-debugging';
    }

    // Analyze tool preferences
    if (debugData.toolsUsed) {
      this.updateToolPreferences(pattern, debugData.toolsUsed);
    }
  }

  private async analyzeTesting(pattern: UserPattern, event: MemoryEvent): Promise<void> {
    const testData = event.data as any;

    // Analyze testing philosophy
    if (testData.coverage > 80) {
      pattern.developmentStyle.testingPhilosophy = 'comprehensive';
    } else if (testData.coverage > 50) {
      pattern.developmentStyle.testingPhilosophy = 'critical-path';
    } else {
      pattern.developmentStyle.testingPhilosophy = 'minimal';
    }

    // Update test coverage target
    pattern.codeQualityPreferences.testCoverageTarget =
      testData.targetCoverage || testData.coverage;

    // Analyze test types
    if (testData.testTypes) {
      this.updateTestingPreferences(pattern, testData.testTypes);
    }
  }

  private async analyzeCommunication(pattern: UserPattern, event: MemoryEvent): Promise<void> {
    const commData = event.data as any;

    // Analyze response length
    if (commData.messageLength) {
      if (commData.messageLength > 500) {
        pattern.communicationStyle.responseLength = 'verbose';
      } else if (commData.messageLength < 100) {
        pattern.communicationStyle.responseLength = 'minimal';
      } else {
        pattern.communicationStyle.responseLength = 'concise';
      }
    }

    // Analyze technical level
    if (commData.technicalTerms) {
      const termDensity = commData.technicalTerms / (commData.wordCount || 100);
      if (termDensity > 0.2) {
        pattern.communicationStyle.technicalLevel = 'expert';
      } else if (termDensity < 0.05) {
        pattern.communicationStyle.technicalLevel = 'beginner-friendly';
      }
    }
  }

  private async analyzeLearning(pattern: UserPattern, event: MemoryEvent): Promise<void> {
    const learningData = event.data as any;

    // Analyze learning style
    if (learningData.resourceType === 'video') {
      pattern.learningProfile.learningStyle.primary = 'visual';
    } else if (learningData.resourceType === 'documentation') {
      pattern.learningProfile.learningStyle.primary = 'reading';
    } else if (learningData.resourceType === 'tutorial') {
      pattern.learningProfile.learningStyle.primary = 'hands-on';
    }

    // Analyze knowledge acquisition
    if (learningData.completionTime) {
      const expectedTime = learningData.estimatedTime || learningData.completionTime;
      const ratio = learningData.completionTime / expectedTime;

      if (ratio < 0.7) {
        pattern.learningProfile.knowledgeAcquisition.speed = 'fast';
      } else if (ratio > 1.3) {
        pattern.learningProfile.knowledgeAcquisition.speed = 'methodical';
      } else {
        pattern.learningProfile.knowledgeAcquisition.speed = 'moderate';
      }
    }
  }

  // ========== Pattern Evolution Detection ==========

  private async detectPatternEvolution(userId: string): Promise<void> {
    const history = this.eventHistory.get(userId) || [];
    if (history.length < 50) return; // Need sufficient history

    const pattern = this.patterns.get(userId);
    if (!pattern) return;

    const metrics = this.metricsCache.get(userId) || this.createDefaultMetrics();

    // Analyze recent vs historical patterns
    const recentEvents = history.slice(-50);
    const historicalEvents = history.slice(-200, -50);

    const recentPatterns = this.extractPatterns(recentEvents);
    const historicalPatterns = this.extractPatterns(historicalEvents);

    // Detect significant changes
    const evolutions: PatternEvolution[] = [];

    for (const [key, recentValue] of Object.entries(recentPatterns)) {
      const historicalValue = historicalPatterns[key];
      if (this.isSignificantChange(historicalValue, recentValue)) {
        evolutions.push({
          timestamp: new Date(),
          aspect: key,
          oldValue: historicalValue,
          newValue: recentValue,
          confidence: this.calculateChangeConfidence(historicalValue, recentValue),
        });
      }
    }

    if (evolutions.length > 0) {
      metrics.evolution = evolutions;
      this.metricsCache.set(userId, metrics);

      this.emit('patternEvolved', { userId, evolutions });
    }
  }

  private extractPatterns(events: MemoryEvent[]): Record<string, unknown> {
    // Simplified pattern extraction
    const patterns: Record<string, unknown> = {};

    // Extract various pattern indicators
    patterns.testFirst =
      events.filter((e) => e.type === 'code-generation' && (e.data as any).tests?.writtenFirst)
        .length / events.length;

    patterns.averageSessionLength =
      events.reduce((sum, e) => sum + ((e.data as any).duration || 0), 0) / events.length;

    patterns.errorRate =
      events.filter((e) => e.type === 'error' || (e.data as any).error).length / events.length;

    return patterns;
  }

  private isSignificantChange(oldValue: unknown, newValue: unknown): boolean {
    if (typeof oldValue === 'number' && typeof newValue === 'number') {
      const change = Math.abs(oldValue - newValue) / Math.max(oldValue, 0.01);
      return change > 0.2; // 20% change threshold
    }
    return oldValue !== newValue;
  }

  private calculateChangeConfidence(oldValue: unknown, newValue: unknown): number {
    // Simplified confidence calculation
    return 0.7;
  }

  // ========== Pattern Analysis Generation ==========

  private async generateAnalysis(pattern: UserPattern): Promise<PatternAnalysis> {
    const evidence = this.collectEvidence(pattern);
    const predictions = this.generatePredictions(pattern);
    const recommendations = this.generateRecommendations(pattern);

    return {
      pattern,
      confidence: this.calculateOverallConfidence(pattern),
      evidence,
      predictions,
      recommendations,
    };
  }

  private collectEvidence(pattern: UserPattern): PatternEvidence[] {
    const evidence: PatternEvidence[] = [];
    const history = this.eventHistory.get(pattern.userId) || [];

    // Collect evidence for development style
    const testFirstEvents = history.filter(
      (e) => e.type === 'code-generation' && (e.data as any).tests?.writtenFirst,
    );

    if (testFirstEvents.length > 0) {
      evidence.push({
        type: 'development-style',
        occurrences: testFirstEvents.length,
        strength: testFirstEvents.length / Math.max(history.length, 1),
        examples: testFirstEvents.slice(-3).map((e) => e.description || ''),
        lastObserved: testFirstEvents[testFirstEvents.length - 1].timestamp,
      });
    }

    return evidence;
  }

  private generatePredictions(pattern: UserPattern): PatternPrediction[] {
    const predictions: PatternPrediction[] = [];

    // Predict based on development style
    if (pattern.developmentStyle.approach === 'test-driven') {
      predictions.push({
        aspect: 'testing',
        prediction: 'User will likely write tests before implementation',
        confidence: pattern.developmentStyle.confidence,
        timeframe: 'next-task',
      });
    }

    // Predict based on working patterns
    if (pattern.workingPatterns.productivityPeaks.length > 0) {
      const peak = pattern.workingPatterns.productivityPeaks[0];
      predictions.push({
        aspect: 'productivity',
        prediction: `Peak productivity expected during ${peak.timeOfDay}`,
        confidence: 0.7,
        timeframe: 'daily',
      });
    }

    // Predict based on learning profile
    if (pattern.learningProfile.knowledgeAcquisition.speed === 'fast') {
      predictions.push({
        aspect: 'learning',
        prediction: 'User will quickly adapt to new technologies',
        confidence: 0.6,
        timeframe: 'ongoing',
      });
    }

    return predictions;
  }

  private generateRecommendations(pattern: UserPattern): PatternRecommendation[] {
    const recommendations: PatternRecommendation[] = [];

    // Recommendations based on development style
    if (pattern.developmentStyle.testingPhilosophy === 'minimal') {
      recommendations.push({
        category: 'quality',
        recommendation: 'Consider increasing test coverage for critical paths',
        rationale: 'Low test coverage detected in recent sessions',
        priority: 'medium',
        expectedImpact: 'Reduced bug rate and increased confidence',
      });
    }

    // Recommendations based on problem-solving approach
    if (pattern.problemSolvingApproach.experimentationRate < 0.3) {
      recommendations.push({
        category: 'efficiency',
        recommendation: 'Try exploring alternative solutions more frequently',
        rationale: 'Low experimentation rate may miss optimal solutions',
        priority: 'low',
        expectedImpact: 'Discover more efficient implementations',
      });
    }

    // Recommendations based on working patterns
    if (pattern.workingPatterns.sessionDuration.averageDuration > 180) {
      recommendations.push({
        category: 'health',
        recommendation: 'Consider taking more frequent breaks',
        rationale: 'Long sessions without breaks can reduce productivity',
        priority: 'medium',
        expectedImpact: 'Improved focus and reduced fatigue',
      });
    }

    return recommendations;
  }

  // ========== Utility Methods ==========

  private createDefaultPattern(userId: string): UserPattern {
    return {
      userId,
      developmentStyle: {
        approach: 'iterative',
        codeOrganization: 'modular',
        refactoringFrequency: 'periodic',
        debuggingStyle: 'systematic',
        testingPhilosophy: 'critical-path',
        documentationLevel: 'essential',
        confidence: 0.5,
      },
      problemSolvingApproach: {
        strategy: 'divide-conquer',
        researchDepth: 'quick-reference',
        planningLevel: 'high-level',
        experimentationRate: 0.5,
        reusePreference: 'moderate',
        abstractionLevel: 'practical',
        parallelTasks: 2,
      },
      codeQualityPreferences: {
        namingConventions: {
          caseStyle: 'camelCase',
          verbosity: 'descriptive',
          prefixUsage: false,
          hungarianNotation: false,
          consistency: 0.8,
        },
        commentingStyle: {
          frequency: 'moderate',
          type: 'explanatory',
          location: 'mixed',
          language: 'technical',
          codeToCommentRatio: 10,
        },
        errorHandling: {
          strategy: 'defensive',
          exceptionUsage: 'conservative',
          validationLevel: 'standard',
          loggingVerbosity: 'errors-only',
          recoveryApproach: 'fallback',
        },
        performanceConsideration: 'balanced',
        securityAwareness: 'standard',
        codeReviewExpectation: 'quick',
        refactoringThreshold: 10,
        testCoverageTarget: 70,
      },
      communicationStyle: {
        responseLength: 'concise',
        explanationDepth: 'high-level',
        questioningStyle: 'specific',
        feedbackPreference: 'milestone-based',
        collaborationLevel: 'periodic-sync',
        technicalLevel: 'intermediate',
        preferredChannels: [],
      },
      workingPatterns: {
        sessionDuration: {
          averageDuration: 120,
          distribution: 'consistent',
          sessionsPerDay: 2,
          deepWorkRatio: 0.6,
        },
        focusTime: {
          averageFocusDuration: 45,
          distractionResistance: 'medium',
          contextSwitchCost: 5,
          preferredEnvironment: 'quiet',
        },
        breakFrequency: {
          averageInterval: 90,
          breakDuration: 10,
          breakType: 'light-activity',
          consistency: 0.7,
        },
        taskSwitching: {
          frequency: 'occasional',
          switchTrigger: 'completion',
          parallelTasks: 2,
          contextRetention: 'good',
        },
        productivityPeaks: [],
        preferredHours: {
          timezone: 'UTC',
          workingHours: { start: '09:00', end: '17:00' },
          preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          flexibilityLevel: 'flexible',
        },
      },
      learningProfile: {
        learningStyle: {
          primary: 'reading',
          secondary: ['hands-on'],
          examplePreference: 'few-examples',
          conceptualDepth: 'thorough',
          practiceRatio: 0.6,
        },
        knowledgeAcquisition: {
          speed: 'moderate',
          breadthVsDepth: 'balanced',
          curiosityLevel: 'selective',
          experimentationRate: 0.5,
          documentationReliance: 'moderate',
        },
        skillProgression: {
          growthRate: 0.5,
          plateauHandling: 'persistent',
          challengePreference: 'comfortable',
          masteryApproach: 'good-enough',
        },
        retentionPattern: {
          shortTermRetention: 'good',
          longTermRetention: 'good',
          refreshFrequency: 30,
          noteTaking: 'key-points',
        },
        preferredResources: [],
      },
      toolPreferences: this.createDefaultToolPreferences(),
    };
  }

  private createDefaultToolPreferences(): ToolPreferences {
    return {
      ide: {
        preferred: [],
        featureUsage: {
          autoComplete: 0.8,
          refactoring: 0.5,
          debugging: 0.6,
          navigation: 0.7,
          snippets: 0.4,
        },
        customization: 'moderate',
        keyboardShortcuts: 'common',
      },
      versionControl: {
        commitFrequency: 'feature-complete',
        commitSize: 'feature',
        branchingStrategy: 'feature-branch',
        messageStyle: 'conventional',
        collaborationStyle: 'pull-request',
      },
      debugging: {
        primaryMethod: 'debugger',
        toolUsage: {
          breakpoints: 0.7,
          watches: 0.5,
          profiler: 0.3,
          memoryAnalyzer: 0.2,
        },
        systematicness: 'methodical',
      },
      testing: {
        testWriting: 'after',
        testTypes: {
          unit: 0.8,
          integration: 0.5,
          e2e: 0.3,
          performance: 0.2,
        },
        mockingUsage: 'moderate',
        assertionStyle: 'basic',
      },
      deployment: {
        frequency: 'daily',
        automation: 'partial',
        monitoring: 'basic',
        rollbackStrategy: 'careful',
      },
      aiAssistance: {
        usageLevel: 'moderate',
        trustLevel: 0.7,
        verificationBehavior: 'trust-but-verify',
        interactionStyle: 'conversational',
        scopePreference: 'guidance',
      },
    };
  }

  private createDefaultMetrics(): PatternMetrics {
    return {
      totalEvents: 0,
      analyzedEvents: 0,
      patternStrength: 0,
      consistency: 0,
      evolution: [],
    };
  }

  private adjustDevelopmentStyle(pattern: UserPattern, style: string, weight: number): void {
    const currentConfidence = pattern.developmentStyle.confidence;
    const newConfidence = Math.min(1, currentConfidence + weight);

    if (pattern.developmentStyle.approach !== style) {
      // Gradually shift to new style if confidence is high enough
      if (newConfidence > 0.7) {
        pattern.developmentStyle.approach = style as any;
        pattern.developmentStyle.confidence = 0.7; // Reset confidence for new classification
      }
    } else {
      // Increase confidence in current classification
      pattern.developmentStyle.confidence = newConfidence;
    }
  }

  private adjustCodeOrganization(pattern: UserPattern, org: string, weight: number): void {
    if (pattern.developmentStyle.codeOrganization !== org) {
      pattern.developmentStyle.codeOrganization = org as any;
    }
  }

  private analyzeNamingStyle(pattern: UserPattern, identifiers: string[]): void {
    // Analyze case style
    const camelCount = identifiers.filter((id) => /^[a-z][a-zA-Z0-9]*$/.test(id)).length;
    const snakeCount = identifiers.filter((id) => /^[a-z_]+$/.test(id)).length;
    const pascalCount = identifiers.filter((id) => /^[A-Z][a-zA-Z0-9]*$/.test(id)).length;

    const total = identifiers.length;
    if (total > 0) {
      if (camelCount / total > 0.6) {
        pattern.codeQualityPreferences.namingConventions.caseStyle = 'camelCase';
      } else if (snakeCount / total > 0.6) {
        pattern.codeQualityPreferences.namingConventions.caseStyle = 'snake_case';
      } else if (pascalCount / total > 0.6) {
        pattern.codeQualityPreferences.namingConventions.caseStyle = 'PascalCase';
      }

      // Analyze verbosity
      const avgLength = identifiers.reduce((sum, id) => sum + id.length, 0) / total;
      if (avgLength > 15) {
        pattern.codeQualityPreferences.namingConventions.verbosity = 'descriptive';
      } else if (avgLength < 5) {
        pattern.codeQualityPreferences.namingConventions.verbosity = 'abbreviated';
      } else {
        pattern.codeQualityPreferences.namingConventions.verbosity = 'concise';
      }
    }
  }

  private analyzeCommentingStyle(pattern: UserPattern, comments: unknown): void {
    if (comments.ratio) {
      pattern.codeQualityPreferences.commentingStyle.codeToCommentRatio = comments.ratio;

      if (comments.ratio < 5) {
        pattern.codeQualityPreferences.commentingStyle.frequency = 'extensive';
      } else if (comments.ratio > 20) {
        pattern.codeQualityPreferences.commentingStyle.frequency = 'minimal';
      } else {
        pattern.codeQualityPreferences.commentingStyle.frequency = 'moderate';
      }
    }

    if (comments.type) {
      pattern.codeQualityPreferences.commentingStyle.type = comments.type;
    }
  }

  private analyzeErrorHandling(pattern: UserPattern, errorHandling: unknown): void {
    if (errorHandling.strategy) {
      pattern.codeQualityPreferences.errorHandling.strategy = errorHandling.strategy;
    }

    if (errorHandling.validation) {
      pattern.codeQualityPreferences.errorHandling.validationLevel = errorHandling.validation;
    }
  }

  private updateToolPreferences(pattern: UserPattern, toolsUsed: unknown): void {
    if (toolsUsed.debugger) {
      pattern.toolPreferences.debugging.primaryMethod = 'debugger';
      pattern.toolPreferences.debugging.toolUsage.breakpoints = Math.min(
        1,
        pattern.toolPreferences.debugging.toolUsage.breakpoints + 0.1,
      );
    }

    if (toolsUsed.profiler) {
      pattern.toolPreferences.debugging.toolUsage.profiler = Math.min(
        1,
        pattern.toolPreferences.debugging.toolUsage.profiler + 0.1,
      );
    }
  }

  private updateTestingPreferences(pattern: UserPattern, testTypes: unknown): void {
    if (testTypes.unit) {
      pattern.toolPreferences.testing.testTypes.unit = Math.min(
        1,
        pattern.toolPreferences.testing.testTypes.unit + 0.1,
      );
    }

    if (testTypes.integration) {
      pattern.toolPreferences.testing.testTypes.integration = Math.min(
        1,
        pattern.toolPreferences.testing.testTypes.integration + 0.1,
      );
    }

    if (testTypes.e2e) {
      pattern.toolPreferences.testing.testTypes.e2e = Math.min(
        1,
        pattern.toolPreferences.testing.testTypes.e2e + 0.1,
      );
    }
  }

  private updateConfidence(pattern: UserPattern): void {
    const history = this.eventHistory.get(pattern.userId) || [];
    const eventCount = history.length;

    // Increase confidence based on event count
    const baseConfidence = Math.min(1, eventCount / 100);

    // Adjust confidence based on consistency
    const consistency = this.calculateConsistency(pattern, history);

    pattern.developmentStyle.confidence = baseConfidence * consistency;
  }

  private calculateConsistency(pattern: UserPattern, history: MemoryEvent[]): number {
    // Simplified consistency calculation
    if (history.length < 10) return 0.5;

    // Check how consistent recent events are with the pattern
    const recentEvents = history.slice(-20);
    let consistentCount = 0;

    for (const event of recentEvents) {
      if (this.isEventConsistent(event, pattern)) {
        consistentCount++;
      }
    }

    return consistentCount / recentEvents.length;
  }

  private isEventConsistent(event: MemoryEvent, pattern: UserPattern): boolean {
    // Simplified consistency check
    if (event.type === 'code-generation') {
      const data = event.data as any;
      if (pattern.developmentStyle.approach === 'test-driven' && data.tests?.writtenFirst) {
        return true;
      }
    }

    return Math.random() > 0.3; // Placeholder
  }

  private calculateOverallConfidence(pattern: UserPattern): number {
    const confidences = [
      pattern.developmentStyle.confidence,
      pattern.codeQualityPreferences.namingConventions.consistency,
      0.7, // Base confidence
    ];

    return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  }

  private startAnalysis(): void {
    this.updateInterval = setInterval(() => {
      // Periodic pattern analysis for all users
      for (const userId of this.patterns.keys()) {
        this.detectPatternEvolution(userId);
      }
    }, 60000); // Every minute
  }

  // ========== Public API ==========

  getUserPattern(userId: string): UserPattern | undefined {
    return this.patterns.get(userId);
  }

  getAnalysis(userId: string): PatternAnalysis | undefined {
    return this.analysisCache.get(userId);
  }

  getMetrics(userId: string): PatternMetrics | undefined {
    return this.metricsCache.get(userId);
  }

  async exportPatterns(): Promise<string> {
    return JSON.stringify(
      {
        patterns: Array.from(this.patterns.entries()),
        analyses: Array.from(this.analysisCache.entries()),
        metrics: Array.from(this.metricsCache.entries()),
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  async importPatterns(data: string): Promise<void> {
    const imported = JSON.parse(data);

    if (imported.patterns) {
      this.patterns = new Map(imported.patterns);
    }

    if (imported.analyses) {
      this.analysisCache = new Map(imported.analyses);
    }

    if (imported.metrics) {
      this.metricsCache = new Map(imported.metrics);
    }

    this.emit('patternsImported', { importedAt: new Date() });
  }

  dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.removeAllListeners();
  }
}

export default UserPatternAnalyzer;
