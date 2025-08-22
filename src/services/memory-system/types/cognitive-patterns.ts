/**
 * MARIA Memory System - Cognitive Pattern Classifications
 *
 * Integration with MARIA's Internal Mode System (50 cognitive modes)
 * Memory-aware cognitive pattern recognition and adaptation
 */

import type { InternalMode } from '../../internal-mode/types';

export interface CognitivePattern {
  id: string;
  name: string;
  category: CognitiveCategory;
  description: string;
  triggers: PatternTrigger[];
  memoryRequirements: MemoryRequirement;
  performance: PatternPerformance;
  adaptation: AdaptationStrategy;
}

export type CognitiveCategory =
  | 'reasoning' // 🧠 Reasoning modes
  | 'creative' // 💡 Creative modes
  | 'analytical' // 📊 Analytical modes
  | 'structural' // 📐 Structural modes
  | 'validation' // 🔍 Validation modes
  | 'contemplative' // 🤔 Contemplative modes
  | 'intensive' // 💪 Intensive modes
  | 'learning' // 📚 Learning modes
  | 'collaborative'; // 🤝 Collaborative modes

export interface PatternTrigger {
  type: TriggerType;
  condition: string;
  confidence: number; // 0-1
  context: TriggerContext;
  memoryDependency: MemoryDependency;
}

export type TriggerType =
  | 'keyword' // Specific keywords in user input
  | 'intent' // Detected user intent
  | 'context' // Current session context
  | 'history' // Historical pattern
  | 'performance' // System performance metrics
  | 'user_preference' // User preference patterns
  | 'team_activity' // Team collaboration signals
  | 'code_complexity' // Code complexity analysis
  | 'error_pattern' // Error or bug patterns
  | 'learning_state'; // User learning progression

export interface TriggerContext {
  projectType?: string;
  codebase?: CodebaseContext;
  team?: TeamContext;
  session?: SessionContext;
  userState?: UserState;
}

export interface CodebaseContext {
  language: string;
  framework?: string;
  size: 'small' | 'medium' | 'large' | 'enterprise';
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  qualityScore: number; // 0-100
}

export interface TeamContext {
  size: number;
  experience: 'junior' | 'mixed' | 'senior' | 'expert';
  collaboration: 'individual' | 'pair' | 'team' | 'distributed';
  timezone: 'single' | 'multiple';
}

export interface SessionContext {
  duration: number; // minutes
  commandCount: number;
  errorCount: number;
  successRate: number; // 0-1
  mood: 'productive' | 'exploratory' | 'debugging' | 'learning';
}

export interface UserState {
  focus: 'high' | 'medium' | 'low';
  experience: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  fatigue: 'fresh' | 'moderate' | 'tired' | 'exhausted';
  confidence: 'uncertain' | 'moderate' | 'confident' | 'very_confident';
}

export interface MemoryDependency {
  system1Required: boolean;
  system2Required: boolean;
  historicalDataDepth: number; // days
  patternMatchingNeeded: boolean;
  learningDataRequired: boolean;
}

export interface MemoryRequirement {
  system1Usage: System1Usage;
  system2Usage: System2Usage;
  learningIntegration: LearningIntegration;
  performanceImpact: PerformanceImpact;
}

export interface System1Usage {
  patternMatching: boolean;
  knowledgeRetrieval: boolean;
  preferenceAccess: boolean;
  quickDecisions: boolean;
  contextualMemory: boolean;
  estimatedLatency: number; // milliseconds
}

export interface System2Usage {
  reasoningTraces: boolean;
  qualityAnalysis: boolean;
  reflectiveThinking: boolean;
  complexDecisions: boolean;
  improvementSuggestions: boolean;
  estimatedLatency: number; // milliseconds
}

export interface LearningIntegration {
  patternLearning: boolean;
  preferenceLearning: boolean;
  adaptiveBehavior: boolean;
  crossSessionContinuity: boolean;
  teamLearning: boolean;
}

export interface PerformanceImpact {
  memoryFootprint: 'low' | 'medium' | 'high';
  computationCost: 'low' | 'medium' | 'high';
  latencyIncrease: number; // milliseconds
  throughputImpact: number; // percentage
}

export interface PatternPerformance {
  accuracy: number; // 0-1
  latency: number; // milliseconds
  memoryEfficiency: number; // 0-1
  userSatisfaction: number; // 0-1
  adaptationSpeed: number; // 0-1
}

export interface AdaptationStrategy {
  learningRate: number; // 0-1
  adaptationThreshold: number; // 0-1
  forgettingRate: number; // 0-1
  reinforcementStrategy: ReinforcementStrategy;
  contextSensitivity: ContextSensitivity;
}

export interface ReinforcementStrategy {
  positiveReinforcement: boolean;
  negativeReinforcement: boolean;
  neutralDecay: boolean;
  feedbackIntegration: boolean;
  automaticAdjustment: boolean;
}

export interface ContextSensitivity {
  projectAware: boolean;
  teamAware: boolean;
  temporalAware: boolean;
  userStateAware: boolean;
  performanceAware: boolean;
}

// Cognitive Mode Integration with Memory System
export interface MemoryAwareCognitiveMode extends InternalMode {
  memoryPattern: CognitivePattern;
  memoryState: ModeMemoryState;
  adaptationHistory: AdaptationRecord[];
  performance: ModePerformanceMetrics;
}

export interface ModeMemoryState {
  system1Cache: System1CacheState;
  system2Context: System2ContextState;
  learningState: LearningState;
  lastUsed: Date;
  usageFrequency: number;
  successRate: number;
}

export interface System1CacheState {
  relevantPatterns: string[]; // pattern IDs
  cachedKnowledge: string[]; // knowledge node IDs
  userPreferences: string[]; // preference keys
  contextualMemory: string[]; // memory chunk IDs
  cacheHitRate: number; // 0-1
}

export interface System2ContextState {
  activeReasoningTraces: string[]; // reasoning trace IDs
  qualityContext: QualityContext;
  reflectionQueue: string[]; // reflection entry IDs
  improvementOpportunities: string[]; // enhancement IDs
  complexityLevel: number; // 1-10
}

export interface QualityContext {
  currentQualityScore: number; // 0-1
  qualityTrend: 'improving' | 'stable' | 'declining';
  qualityFactors: QualityFactor[];
  recommendedImprovements: string[];
}

export interface QualityFactor {
  name: string;
  value: number; // 0-1
  weight: number; // 0-1
  trend: 'improving' | 'stable' | 'declining';
}

export interface LearningState {
  learningProgress: number; // 0-1
  learningGoals: LearningGoal[];
  knowledgeGaps: KnowledgeGap[];
  adaptationNeeds: AdaptationNeed[];
  competencyLevel: number; // 1-10
}

export interface LearningGoal {
  id: string;
  description: string;
  priority: number; // 1-10
  progress: number; // 0-1
  targetDate?: Date;
  dependencies: string[];
}

export interface KnowledgeGap {
  area: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  impact: string;
  suggestedLearning: string[];
  priority: number; // 1-10
}

export interface AdaptationNeed {
  type: 'preference' | 'behavior' | 'pattern' | 'performance';
  description: string;
  confidence: number; // 0-1
  urgency: 'low' | 'medium' | 'high' | 'critical';
  suggestedChanges: string[];
}

export interface AdaptationRecord {
  timestamp: Date;
  trigger: string;
  changeMade: string;
  impact: AdaptationImpact;
  success: boolean;
  feedback?: string;
}

export interface AdaptationImpact {
  performanceChange: number; // -1 to 1
  userSatisfactionChange: number; // -1 to 1
  efficiencyChange: number; // -1 to 1
  accuracyChange: number; // -1 to 1
}

export interface ModePerformanceMetrics {
  activationAccuracy: number; // 0-1
  responseTime: number; // milliseconds
  userSatisfaction: number; // 0-1
  taskCompletionRate: number; // 0-1
  errorRate: number; // 0-1
  adaptationSuccess: number; // 0-1
}

// Cognitive Pattern Recognition Engine
export interface PatternRecognitionConfig {
  recognitionThreshold: number; // 0-1
  adaptationEnabled: boolean;
  learningEnabled: boolean;
  memoryIntegrationEnabled: boolean;
  performanceMonitoring: boolean;
  confidenceThreshold: number; // 0-1
}

export interface PatternRecognitionResult {
  recommendedMode: MemoryAwareCognitiveMode;
  confidence: number; // 0-1
  reasoning: PatternReasoning;
  alternatives: AlternativeMode[];
  memoryInsights: MemoryInsight[];
}

export interface PatternReasoning {
  primaryFactors: ReasoningFactor[];
  memoryFactors: MemoryFactor[];
  contextFactors: ContextFactor[];
  confidence: number; // 0-1
  explanation: string;
}

export interface ReasoningFactor {
  name: string;
  weight: number; // 0-1
  value: number; // 0-1
  contribution: number; // 0-1
  source: 'input' | 'context' | 'history' | 'memory';
}

export interface MemoryFactor {
  type: 'system1' | 'system2' | 'learning';
  name: string;
  relevance: number; // 0-1
  confidence: number; // 0-1
  memoryAge: number; // hours
  accessFrequency: number; // 0-1
}

export interface ContextFactor {
  type: 'project' | 'team' | 'session' | 'user';
  name: string;
  influence: number; // 0-1
  stability: number; // 0-1
  predictive: boolean;
}

export interface AlternativeMode {
  mode: MemoryAwareCognitiveMode;
  confidence: number; // 0-1
  reasoning: string;
  pros: string[];
  cons: string[];
  recommendationScore: number; // 0-1
}

export interface MemoryInsight {
  type: 'pattern' | 'preference' | 'learning' | 'performance';
  insight: string;
  confidence: number; // 0-1
  actionable: boolean;
  priority: number; // 1-10
  suggestedActions: string[];
}

// Predefined Cognitive Patterns for MARIA's 50 Modes
export const COGNITIVE_PATTERNS: Record<string, CognitivePattern> = {
  // Reasoning Category (🧠)
  thinking: {
    id: 'thinking',
    name: '🧠 Thinking',
    category: 'reasoning',
    description: 'General problem-solving and analytical thinking',
    triggers: [
      {
        type: 'keyword',
        condition: 'think|analyze|consider|evaluate',
        confidence: 0.8,
        context: {},
        memoryDependency: {
          system1Required: true,
          system2Required: true,
          historicalDataDepth: 7,
          patternMatchingNeeded: true,
          learningDataRequired: true,
        },
      },
    ],
    memoryRequirements: {
      system1Usage: {
        patternMatching: true,
        knowledgeRetrieval: true,
        preferenceAccess: true,
        quickDecisions: false,
        contextualMemory: true,
        estimatedLatency: 50,
      },
      system2Usage: {
        reasoningTraces: true,
        qualityAnalysis: true,
        reflectiveThinking: true,
        complexDecisions: true,
        improvementSuggestions: true,
        estimatedLatency: 200,
      },
      learningIntegration: {
        patternLearning: true,
        preferenceLearning: true,
        adaptiveBehavior: true,
        crossSessionContinuity: true,
        teamLearning: false,
      },
      performanceImpact: {
        memoryFootprint: 'medium',
        computationCost: 'medium',
        latencyIncrease: 100,
        throughputImpact: 15,
      },
    },
    performance: {
      accuracy: 0.85,
      latency: 150,
      memoryEfficiency: 0.75,
      userSatisfaction: 0.8,
      adaptationSpeed: 0.7,
    },
    adaptation: {
      learningRate: 0.1,
      adaptationThreshold: 0.7,
      forgettingRate: 0.05,
      reinforcementStrategy: {
        positiveReinforcement: true,
        negativeReinforcement: true,
        neutralDecay: true,
        feedbackIntegration: true,
        automaticAdjustment: true,
      },
      contextSensitivity: {
        projectAware: true,
        teamAware: false,
        temporalAware: true,
        userStateAware: true,
        performanceAware: true,
      },
    },
  },

  debugging: {
    id: 'debugging',
    name: '🐛 Debugging',
    category: 'validation',
    description: 'Bug identification and error resolution',
    triggers: [
      {
        type: 'keyword',
        condition: 'bug|error|fix|debug|broken',
        confidence: 0.9,
        context: {},
        memoryDependency: {
          system1Required: true,
          system2Required: true,
          historicalDataDepth: 30,
          patternMatchingNeeded: true,
          learningDataRequired: true,
        },
      },
    ],
    memoryRequirements: {
      system1Usage: {
        patternMatching: true,
        knowledgeRetrieval: true,
        preferenceAccess: false,
        quickDecisions: true,
        contextualMemory: true,
        estimatedLatency: 30,
      },
      system2Usage: {
        reasoningTraces: true,
        qualityAnalysis: true,
        reflectiveThinking: false,
        complexDecisions: true,
        improvementSuggestions: true,
        estimatedLatency: 150,
      },
      learningIntegration: {
        patternLearning: true,
        preferenceLearning: false,
        adaptiveBehavior: true,
        crossSessionContinuity: true,
        teamLearning: true,
      },
      performanceImpact: {
        memoryFootprint: 'high',
        computationCost: 'medium',
        latencyIncrease: 75,
        throughputImpact: 10,
      },
    },
    performance: {
      accuracy: 0.9,
      latency: 100,
      memoryEfficiency: 0.8,
      userSatisfaction: 0.85,
      adaptationSpeed: 0.8,
    },
    adaptation: {
      learningRate: 0.15,
      adaptationThreshold: 0.6,
      forgettingRate: 0.03,
      reinforcementStrategy: {
        positiveReinforcement: true,
        negativeReinforcement: true,
        neutralDecay: false,
        feedbackIntegration: true,
        automaticAdjustment: true,
      },
      contextSensitivity: {
        projectAware: true,
        teamAware: true,
        temporalAware: false,
        userStateAware: true,
        performanceAware: true,
      },
    },
  },

  optimizing: {
    id: 'optimizing',
    name: '⚡ Optimizing',
    category: 'validation',
    description: 'Performance optimization and improvement',
    triggers: [
      {
        type: 'keyword',
        condition: 'optimize|performance|improve|faster|efficient',
        confidence: 0.85,
        context: {},
        memoryDependency: {
          system1Required: true,
          system2Required: true,
          historicalDataDepth: 14,
          patternMatchingNeeded: true,
          learningDataRequired: true,
        },
      },
    ],
    memoryRequirements: {
      system1Usage: {
        patternMatching: true,
        knowledgeRetrieval: true,
        preferenceAccess: true,
        quickDecisions: false,
        contextualMemory: true,
        estimatedLatency: 40,
      },
      system2Usage: {
        reasoningTraces: true,
        qualityAnalysis: true,
        reflectiveThinking: true,
        complexDecisions: true,
        improvementSuggestions: true,
        estimatedLatency: 180,
      },
      learningIntegration: {
        patternLearning: true,
        preferenceLearning: true,
        adaptiveBehavior: true,
        crossSessionContinuity: true,
        teamLearning: true,
      },
      performanceImpact: {
        memoryFootprint: 'medium',
        computationCost: 'high',
        latencyIncrease: 120,
        throughputImpact: 20,
      },
    },
    performance: {
      accuracy: 0.8,
      latency: 180,
      memoryEfficiency: 0.7,
      userSatisfaction: 0.85,
      adaptationSpeed: 0.75,
    },
    adaptation: {
      learningRate: 0.12,
      adaptationThreshold: 0.65,
      forgettingRate: 0.04,
      reinforcementStrategy: {
        positiveReinforcement: true,
        negativeReinforcement: true,
        neutralDecay: true,
        feedbackIntegration: true,
        automaticAdjustment: true,
      },
      contextSensitivity: {
        projectAware: true,
        teamAware: true,
        temporalAware: true,
        userStateAware: true,
        performanceAware: true,
      },
    },
  },

  brainstorming: {
    id: 'brainstorming',
    name: '💡 Brainstorming',
    category: 'creative',
    description: 'Creative ideation and solution generation',
    triggers: [
      {
        type: 'keyword',
        condition: 'brainstorm|ideas|creative|generate|innovative',
        confidence: 0.9,
        context: {},
        memoryDependency: {
          system1Required: true,
          system2Required: false,
          historicalDataDepth: 7,
          patternMatchingNeeded: true,
          learningDataRequired: true,
        },
      },
    ],
    memoryRequirements: {
      system1Usage: {
        patternMatching: true,
        knowledgeRetrieval: true,
        preferenceAccess: true,
        quickDecisions: true,
        contextualMemory: true,
        estimatedLatency: 60,
      },
      system2Usage: {
        reasoningTraces: false,
        qualityAnalysis: false,
        reflectiveThinking: true,
        complexDecisions: false,
        improvementSuggestions: true,
        estimatedLatency: 100,
      },
      learningIntegration: {
        patternLearning: true,
        preferenceLearning: true,
        adaptiveBehavior: true,
        crossSessionContinuity: false,
        teamLearning: true,
      },
      performanceImpact: {
        memoryFootprint: 'medium',
        computationCost: 'low',
        latencyIncrease: 50,
        throughputImpact: 8,
      },
    },
    performance: {
      accuracy: 0.75,
      latency: 80,
      memoryEfficiency: 0.85,
      userSatisfaction: 0.9,
      adaptationSpeed: 0.9,
    },
    adaptation: {
      learningRate: 0.2,
      adaptationThreshold: 0.5,
      forgettingRate: 0.1,
      reinforcementStrategy: {
        positiveReinforcement: true,
        negativeReinforcement: false,
        neutralDecay: true,
        feedbackIntegration: true,
        automaticAdjustment: false,
      },
      contextSensitivity: {
        projectAware: false,
        teamAware: true,
        temporalAware: false,
        userStateAware: true,
        performanceAware: false,
      },
    },
  },

  // Additional cognitive patterns would be defined here for all 50 modes
  // Following the same structure and adapting memory requirements accordingly
};
