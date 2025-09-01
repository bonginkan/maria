/**
 * Memory-Aware Internal Mode Service
 *
 * Enhanced Internal Mode Service that integrates with MARIA's dual-layer memory system
 * Provides memory-aware cognitive _mode switching and cross-session learning
 */

import { EventEmitter } from "node:events";
import { InternalModeService } from "./InternalModeService";
import { DualMemoryEngine } from "../memory-system/dual-memory-engine";
import { MemoryCoordinator } from "../memory-system/memory-coordinator";
import type {
  ModeConfig,
  ModeContext,
  ModeDefinition,
  _ModeHistoryEntry,
  ModeRecognitionResult,
  ModeTransition,
} from "./types";
import type {
  AdaptationRecord,
  CognitivePattern,
  MemoryAwareCognitiveMode,
  MemoryInsight,
  ModeMemoryState,
  _PatternRecognitionResult,
} from "../memory-system/types/cognitive-patterns";
import type {
  MemoryEvent,
  _QualityMetrics,
  _ReasoningTrace,
  UserPreferenceSet,
} from "../memory-system/types/memory-interfaces";

export interface MemoryAwareModeConfig extends ModeConfig {
  memoryIntegrationEnabled: boolean;
  adaptiveLearningEnabled: boolean;
  crossSessionMemoryEnabled: boolean;
  memoryInfluenceWeight: number; // 0-1, how much memory influences _mode selection
  qualityFeedbackEnabled: boolean;
  personalizedModesEnabled: boolean;
}

export interface ModeMemoryMetrics {
  modeUsageFrequency: Map<string, number>;
  modeSuccessRates: Map<string, number>;
  averageModeLatency: Map<string, number>;
  userSatisfactionRatings: Map<string, number>;
  memoryInfluencedDecisions: number;
  adaptationSuccessRate: number;
  crossSessionContinuity: number;
  lastMemorySync: Date;
}

export interface MemoryEnhancedModeResult extends ModeRecognitionResult {
  _memoryInsights: MemoryInsight[];
  _recommendedAdaptations: AdaptationRecord[];
  _qualityPrediction: number;
  _personalizedConfidence: number;
  _crossSessionContext?: {
    similarPastSessions: string[];
    learnedPreferences: Partial<UserPreferenceSet>;
    predictedUserNeeds: string[];
  };
}

export class MemoryAwareModeService extends EventEmitter {
  private baseModeService: InternalModeService;
  private memoryEngine: DualMemoryEngine;
  private memoryCoordinator: MemoryCoordinator;
  private config: MemoryAwareModeConfig;
  private memoryMetrics: ModeMemoryMetrics;
  private memoryAwareModes: Map<string, MemoryAwareCognitiveMode> = new Map();
  private currentMemoryState: ModeMemoryState | null = null;
  private adaptationHistory: AdaptationRecord[] = [];

  constructor(
    baseModeService: InternalModeService,
    memoryEngine: DualMemoryEngine,
    memoryCoordinator: MemoryCoordinator,
    config: Partial<MemoryAwareModeConfig> = {},
  ) {
    super();

    this.baseModeService = baseModeService;
    this.memoryEngine = memoryEngine;
    this.memoryCoordinator = memoryCoordinator;

    this.config = {
      ...this.getDefaultConfig(),
      ...config,
    };

    this.memoryMetrics = this.initializeMemoryMetrics();

    // Initialize memory-aware modes
    this.initializeMemoryAwareModes();

    // Setup event listeners
    this.setupEventListeners();
  }

  // ========== Enhanced Mode Recognition ==========

  async recognizeMode(
    input: string,
    context: ModeContext,
    includeMemoryInsights: boolean = true,
  ): Promise<MemoryEnhancedModeResult> {
    const _startTime = Date.now();

    try {
      // Get base _mode recognition
      const _baseResult = await this.baseModeService.recognizeMode(
        input,
        context,
      );

      if (!this.config.memoryIntegrationEnabled || !includeMemoryInsights) {
        return this.wrapBaseResult(_baseResult);
      }

      // Enhance with memory insights
      const _memoryEnhanced = await this.enhanceWithMemory(
        _baseResult,
        input,
        context,
      );

      // Update metrics
      this.updateRecognitionMetrics(_memoryEnhanced, Date.now() - _startTime);

      // Store recognition event for learning
      await this.storeRecognitionEvent(input, context, _memoryEnhanced);

      return _memoryEnhanced;
    } catch (_error) {
      console._error("Memory-aware _mode recognition failed:", _error);
      // Fallback to base service
      const _baseResult = await this.baseModeService.recognizeMode(
        input,
        context,
      );
      return this.wrapBaseResult(_baseResult);
    }
  }

  async switchMode(
    targetModeId: string,
    context: ModeContext,
    reason?: string,
  ): Promise<ModeTransition> {
    try {
      // Check if target _mode is memory-aware
      const _memoryAwareMode = this.memoryAwareModes.get(targetModeId);

      if (_memoryAwareMode && this.config.memoryIntegrationEnabled) {
        return this.switchToMemoryAwareMode(_memoryAwareMode, context, reason);
      }

      // Fallback to base service
      return this.baseModeService.switchMode(targetModeId, context, reason);
    } catch (_error) {
      console._error("Memory-aware _mode switch failed:", _error);
      return this.baseModeService.switchMode(targetModeId, context, reason);
    }
  }

  // ========== Memory Integration Methods ==========

  private async enhanceWithMemory(
    _baseResult: ModeRecognitionResult,
    input: string,
    context: ModeContext,
  ): Promise<MemoryEnhancedModeResult> {
    // Get memory insights
    const _memoryInsights = await this.getMemoryInsights(input, context);

    // Get user _preferences and adapt confidence
    const _userPreferences = await this.memoryEngine.getUserPreferences();
    const _personalizedConfidence = this.calculatePersonalizedConfidence(
      _baseResult,
      userPreferences.data,
    );

    // Get cross-session context
    const _crossSessionContext = await this.getCrossSessionContext(
      input,
      context,
    );

    // Get quality prediction based on past performance
    const _qualityPrediction = await this.predictQualityOutcome(
      baseResult.selectedMode,
    );

    // Generate adaptation recommendations
    const _recommendedAdaptations =
      await this.generateAdaptationRecommendations(
        _baseResult,
        _memoryInsights,
      );

    // Apply memory influence to _mode selection
    const _memoryInfluencedMode = await this.applyMemoryInfluence(
      _baseResult,
      _memoryInsights,
      userPreferences.data,
    );

    return {
      ...baseResult,
      selectedMode: _memoryInfluencedMode || baseResult.selectedMode,
      confidence: this.blendConfidence(
        baseResult.confidence,
        _personalizedConfidence,
      ),
      _memoryInsights,
      _recommendedAdaptations,
      _qualityPrediction,
      _personalizedConfidence,
      _crossSessionContext,
    };
  }

  private async getMemoryInsights(
    _input: string,
    _context: ModeContext,
  ): Promise<MemoryInsight[]> {
    const insights: MemoryInsight[] = [];

    try {
      // Search for similar past interactions
      const _similarInteractions = await this.memoryEngine.findKnowledge(
        _input,
        undefined,
        5,
      );

      if (_similarInteractions.data.length > 0) {
        insights.push({
          type: "pattern",
          insight: `Found ${_similarInteractions.data.length} similar past interactions`,
          confidence: _similarInteractions.confidence,
          actionable: true,
          priority: 7,
          suggestedActions: ["Use learned patterns for _mode selection"],
        });
      }

      // Check for quality patterns
      const _qualityInsights = await this.memoryEngine.getQualityInsights();
      if (_qualityInsights.data.codeQuality.maintainability < 70) {
        insights.push({
          type: "performance",
          insight:
            "Recent code quality trends suggest focusing on maintainability",
          confidence: 0.8,
          actionable: true,
          priority: 6,
          suggestedActions: [
            "Prioritize refactoring modes",
            "Increase code review emphasis",
          ],
        });
      }

      // User preference insights
      const _preferences = await this.memoryEngine.getUserPreferences();
      if (_preferences.data.developmentStyle.approach === "test-driven") {
        insights.push({
          type: "preference",
          insight: "User prefers test-driven development approach",
          confidence: 0.9,
          actionable: true,
          priority: 8,
          suggestedActions: [
            "Prioritize testing-related modes",
            "Suggest TDD patterns",
          ],
        });
      }
    } catch (_error) {
      console._error("Failed to get memory insights:", _error);
    }

    return insights;
  }

  private async getCrossSessionContext(
    input: string,
    context: ModeContext,
  ): Promise<MemoryEnhancedModeResult["_crossSessionContext"]> {
    if (!this.config.crossSessionMemoryEnabled) {
      return undefined;
    }

    try {
      // Find similar past sessions
      const _similarSessions = await this.findSimilarPastSessions(
        input,
        context,
      );

      // Get learned _preferences
      const _userPreferences = await this.memoryEngine.getUserPreferences();

      // Predict user needs based on context
      const _predictedNeeds = await this.predictUserNeeds(context);

      return {
        similarPastSessions: _similarSessions,
        learnedPreferences: _userPreferences.data,
        predictedUserNeeds: _predictedNeeds,
      };
    } catch (_error) {
      console._error("Failed to get cross-session context:", _error);
      return undefined;
    }
  }

  private async switchToMemoryAwareMode(
    _memoryAwareMode: MemoryAwareCognitiveMode,
    context: ModeContext,
    reason?: string,
  ): Promise<ModeTransition> {
    const _startTime = Date.now();

    try {
      // Update memory state for the _mode
      await this.updateModeMemoryState(_memoryAwareMode, context);

      // Perform base _mode switch
      const _baseTransition = await this.baseModeService.switchMode(
        memoryAwareMode.id,
        context,
        reason,
      );

      // Enhanced transition with memory insights
      const enhancedTransition: ModeTransition = {
        ..._baseTransition,
        metadata: {
          ..._baseTransition.metadata,
          _memoryEnhanced: true,
          memoryLatency: Date.now() - _startTime,
          adaptationApplied: this.adaptationHistory.length > 0,
        },
      };

      // Store transition for learning
      await this.storeTransitionEvent(enhancedTransition, _memoryAwareMode);

      // Update current memory state
      this.currentMemoryState = memoryAwareMode.memoryState;

      return enhancedTransition;
    } catch (_error) {
      console._error("Memory-aware _mode switch failed:", _error);
      throw _error;
    }
  }

  // ========== Learning and Adaptation ==========

  async learnFromUserFeedback(
    modeId: string,
    feedback: {
      satisfaction: number; // 1-5
      effectiveness: number; // 1-5
      suggestions?: string[];
    },
  ): Promise<void> {
    if (!this.config.adaptiveLearningEnabled) {
      return;
    }

    try {
      // Update _mode success rates
      this.memoryMetrics.userSatisfactionRatings.set(
        modeId,
        feedback.satisfaction,
      );

      // Create learning event
      const learningEvent: MemoryEvent = {
        id: `feedback-${modeId}-${Date.now()}`,
        type: "learning_update",
        timestamp: new Date(),
        userId: "current-user", // Would be dynamic in production
        sessionId: "current-session",
        data: { modeId, feedback },
        metadata: {
          confidence: 0.9,
          source: "user_input",
          priority: "high",
          tags: ["feedback", "_mode-learning", modeId],
        },
      };

      // Store in memory system
      await this.memoryEngine.store(learningEvent);

      // Adapt _mode if needed
      if (feedback.satisfaction < 3) {
        await this.adaptModeBasedOnFeedback(modeId, feedback);
      }
    } catch (_error) {
      console._error("Failed to learn from user feedback:", _error);
    }
  }

  async adaptModeConfiguration(
    modeId: string,
    adaptationData: {
      triggerAdjustments?: Record<string, number>;
      memoryWeightAdjustments?: Record<string, number>;
      performanceTargets?: Record<string, number>;
    },
  ): Promise<boolean> {
    try {
      const _memoryAwareMode = this.memoryAwareModes.get(modeId);
      if (!_memoryAwareMode) {
        return false;
      }

      // Apply adaptations
      if (adaptationData.triggerAdjustments) {
        await this.adjustModeTriggers(
          _memoryAwareMode,
          adaptationData.triggerAdjustments,
        );
      }

      if (adaptationData.memoryWeightAdjustments) {
        await this.adjustMemoryWeights(
          _memoryAwareMode,
          adaptationData.memoryWeightAdjustments,
        );
      }

      // Record adaptation
      const adaptation: AdaptationRecord = {
        timestamp: new Date(),
        trigger: "manual_configuration",
        changeMade: JSON.stringify(adaptationData),
        impact: {
          performanceChange: 0,
          userSatisfactionChange: 0,
          efficiencyChange: 0,
          accuracyChange: 0,
        },
        success: true,
      };

      this.adaptationHistory.push(adaptation);
      memoryAwareMode.adaptationHistory.push(adaptation);

      return true;
    } catch (_error) {
      console._error("Mode adaptation failed:", _error);
      return false;
    }
  }

  // ========== Utility Methods ==========

  private wrapBaseResult(
    _baseResult: ModeRecognitionResult,
  ): MemoryEnhancedModeResult {
    return {
      ..._baseResult,
      _memoryInsights: [],
      _recommendedAdaptations: [],
      _qualityPrediction: 0.8,
      _personalizedConfidence: _baseResult.confidence,
    };
  }

  private calculatePersonalizedConfidence(
    _baseResult: ModeRecognitionResult,
    _userPreferences: UserPreferenceSet,
  ): number {
    let _personalizedConfidence = _baseResult.confidence;

    // Adjust based on user's communication _preferences
    if (
      userPreferences.communicationPreferences.verbosity === "minimal" &&
      baseResult.selectedMode.name.includes("Detailed")
    ) {
      _personalizedConfidence *= 0.8;
    }

    // Adjust based on development style
    if (
      userPreferences.developmentStyle.approach === "test-driven" &&
      baseResult.selectedMode.name.includes("Testing")
    ) {
      _personalizedConfidence *= 1.2;
    }

    return Math.min(1.0, _personalizedConfidence);
  }

  private blendConfidence(
    _baseConfidence: number,
    _personalizedConfidence: number,
  ): number {
    const _weight = this.config.memoryInfluenceWeight;
    return _baseConfidence * (1 - _weight) + _personalizedConfidence * _weight;
  }

  private async applyMemoryInfluence(
    _baseResult: ModeRecognitionResult,
    _memoryInsights: MemoryInsight[],
    _userPreferences: UserPreferenceSet,
  ): Promise<ModeDefinition | null> {
    // If memory insights strongly suggest a different _mode, consider switching
    const _strongInsights = _memoryInsights.filter(
      (insight) => insight.confidence > 0.8 && insight.priority >= 7,
    );

    if (_strongInsights.length > 0) {
      // Logic to select alternative _mode based on insights
      // This would be more sophisticated in production
      return null; // For now, stick with base result
    }

    return null;
  }

  private async predictQualityOutcome(_mode: ModeDefinition): Promise<number> {
    try {
      const _modeUsageData = this.memoryMetrics.modeSuccessRates.get(_mode.id);
      const _qualityData = await this.memoryEngine.getQualityInsights();

      if (_modeUsageData && _qualityData.data) {
        // Simple prediction based on past success and current quality trends
        return (
          (_modeUsageData +
            _qualityData.data.codeQuality.maintainability / 100) /
          2
        );
      }

      return 0.8; // Default prediction
    } catch (_error) {
      return 0.8;
    }
  }

  private async generateAdaptationRecommendations(
    _baseResult: ModeRecognitionResult,
    _memoryInsights: MemoryInsight[],
  ): Promise<AdaptationRecord[]> {
    const recommendations: AdaptationRecord[] = [];

    // Generate recommendations based on insights
    for (const insight of _memoryInsights) {
      if (insight.actionable && insight.priority >= 6) {
        recommendations.push({
          timestamp: new Date(),
          trigger: `memory_insight_${insight.type}`,
          changeMade: insight.suggestedActions.join("; "),
          impact: {
            performanceChange: 0.1,
            userSatisfactionChange: 0.05,
            efficiencyChange: 0.08,
            accuracyChange: 0.03,
          },
          success: true,
          feedback: insight.insight,
        });
      }
    }

    return recommendations;
  }

  private async findSimilarPastSessions(
    _input: string,
    _context: ModeContext,
  ): Promise<string[]> {
    // Simplified implementation - would use more sophisticated similarity in production
    return [
      `session-${Date.now() - 86400000}`,
      `session-${Date.now() - 172800000}`,
    ];
  }

  private async predictUserNeeds(context: ModeContext): Promise<string[]> {
    const needs: string[] = [];

    // Simple prediction based on context
    if (context.projectType?.includes("web")) {
      needs.push("Frontend optimization", "API integration");
    }

    if (context.urgency === "high") {
      needs.push("Quick solutions", "Efficient debugging");
    }

    return needs;
  }

  private async updateModeMemoryState(
    _mode: MemoryAwareCognitiveMode,
    _context: ModeContext,
  ): Promise<void> {
    // Update _mode's memory state based on current context
    _mode.memoryState.lastUsed = new Date();
    mode.memoryState.usageFrequency++;

    // Update learning state if applicable
    if (this.config.adaptiveLearningEnabled) {
      mode.memoryState.learningState.learningProgress += 0.01;
    }
  }

  private async storeRecognitionEvent(
    input: string,
    context: ModeContext,
    result: MemoryEnhancedModeResult,
  ): Promise<void> {
    const event: MemoryEvent = {
      id: `recognition-${Date.now()}`,
      type: "mode_change",
      timestamp: new Date(),
      userId: "current-user",
      sessionId: "current-session",
      data: { input, context, result },
      metadata: {
        confidence: result.confidence,
        source: "ai_generated",
        priority: "medium",
        tags: ["_mode-recognition", result.selectedMode.id],
      },
    };

    await this.memoryEngine.store(event);
  }

  private async storeTransitionEvent(
    transition: ModeTransition,
    _mode: MemoryAwareCognitiveMode,
  ): Promise<void> {
    const event: MemoryEvent = {
      id: `transition-${Date.now()}`,
      type: "mode_change",
      timestamp: new Date(),
      userId: "current-user",
      sessionId: "current-session",
      data: { transition, _mode },
      metadata: {
        confidence: 0.9,
        source: "system_inferred",
        priority: "medium",
        tags: ["_mode-transition", mode.id],
      },
    };

    await this.memoryEngine.store(event);
  }

  private updateRecognitionMetrics(
    _result: MemoryEnhancedModeResult,
    latency: number,
  ): void {
    this.memoryMetrics.averageModeLatency.set(_result.selectedMode.id, latency);

    if (_result.memoryInsights.length > 0) {
      this.memoryMetrics.memoryInfluencedDecisions++;
    }
  }

  private async adaptModeBasedOnFeedback(
    _modeId: string,
    feedback: unknown,
  ): Promise<void> {
    // Implement _mode adaptation logic based on feedback
    console.log(`Adapting _mode ${_modeId} based on feedback:`, feedback);
  }

  private async adjustModeTriggers(
    _mode: MemoryAwareCognitiveMode,
    adjustments: Record<string, number>,
  ): Promise<void> {
    // Implement trigger adjustment logic
    console.log(`Adjusting triggers for _mode ${_mode.id}:`, adjustments);
  }

  private async adjustMemoryWeights(
    _mode: MemoryAwareCognitiveMode,
    adjustments: Record<string, number>,
  ): Promise<void> {
    // Implement memory _weight adjustment logic
    console.log(`Adjusting memory weights for _mode ${_mode.id}:`, adjustments);
  }

  private initializeMemoryAwareModes(): void {
    // Initialize memory-aware versions of existing modes
    // This would load from the cognitive patterns defined earlier
    const _baseModes = this.baseModeService.getAllModes();

    for (const baseMode of _baseModes) {
      const _memoryAwareMode: MemoryAwareCognitiveMode = {
        ...baseMode,
        memoryPattern: this.createCognitivePattern(baseMode),
        memoryState: this.createInitialMemoryState(),
        adaptationHistory: [],
        performance: this.createInitialPerformanceMetrics(),
      };

      this.memoryAwareModes.set(baseMode.id, _memoryAwareMode);
    }
  }

  private createCognitivePattern(_mode: ModeDefinition): CognitivePattern {
    // Create a cognitive pattern based on the _mode definition
    return {
      id: mode.id,
      name: mode.name,
      category: this.mapModeToCategory(_mode),
      description: mode.description,
      triggers: [],
      memoryRequirements: this.createMemoryRequirements(),
      performance: {
        accuracy: 0.8,
        latency: 100,
        memoryEfficiency: 0.7,
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
    };
  }

  private mapModeToCategory(_mode: ModeDefinition): unknown {
    // Map _mode to cognitive category based on its characteristics
    if (_mode.name.includes("Debug")) {
      return "validation";
    }
    if (_mode.name.includes("Think")) {
      return "reasoning";
    }
    if (_mode.name.includes("Creative")) {
      return "creative";
    }
    return "reasoning"; // Default
  }

  private createMemoryRequirements(): unknown {
    return {
      system1Usage: {
        patternMatching: true,
        knowledgeRetrieval: true,
        preferenceAccess: true,
        quickDecisions: true,
        contextualMemory: true,
        estimatedLatency: 50,
      },
      system2Usage: {
        reasoningTraces: true,
        qualityAnalysis: true,
        reflectiveThinking: true,
        complexDecisions: true,
        improvementSuggestions: true,
        estimatedLatency: 150,
      },
      learningIntegration: {
        patternLearning: true,
        preferenceLearning: true,
        adaptiveBehavior: true,
        crossSessionContinuity: true,
        teamLearning: false,
      },
      performanceImpact: {
        memoryFootprint: "medium",
        computationCost: "medium",
        latencyIncrease: 75,
        throughputImpact: 15,
      },
    };
  }

  private createInitialMemoryState(): unknown {
    return {
      system1Cache: {
        relevantPatterns: [],
        cachedKnowledge: [],
        _userPreferences: [],
        contextualMemory: [],
        cacheHitRate: 0.0,
      },
      system2Context: {
        activeReasoningTraces: [],
        qualityContext: {
          currentQualityScore: 0.8,
          qualityTrend: "stable",
          qualityFactors: [],
          recommendedImprovements: [],
        },
        reflectionQueue: [],
        improvementOpportunities: [],
        complexityLevel: 5,
      },
      learningState: {
        learningProgress: 0.0,
        learningGoals: [],
        knowledgeGaps: [],
        adaptationNeeds: [],
        competencyLevel: 5,
      },
      lastUsed: new Date(),
      usageFrequency: 0,
      successRate: 0.8,
    };
  }

  private createInitialPerformanceMetrics(): unknown {
    return {
      activationAccuracy: 0.8,
      responseTime: 100,
      userSatisfaction: 0.8,
      taskCompletionRate: 0.85,
      errorRate: 0.1,
      adaptationSuccess: 0.7,
    };
  }

  private setupEventListeners(): void {
    // Listen to base _mode service events
    this.baseModeService.on("modeChanged", (data) => {
      this.emit("memoryAwareModeChanged", {
        ...data,
        _memoryEnhanced: true,
        adaptationApplied: this.adaptationHistory.length > 0,
      });
    });

    // Listen to memory coordinator events
    this.memoryCoordinator.on("optimizationComplete", (data) => {
      this.emit("memoryOptimizationComplete", data);
    });
  }

  private getDefaultConfig(): MemoryAwareModeConfig {
    return {
      // Base config
      confidenceThreshold: 0.85,
      autoSwitchEnabled: true,
      confirmationRequired: false,
      showTransitions: true,
      animationEnabled: true,
      colorEnabled: true,
      learningEnabled: true,
      patternTrackingEnabled: true,
      feedbackEnabled: true,
      defaultLanguage: "en",
      supportedLanguages: ["en", "ja", "cn", "ko", "vn"],
      maxHistoryEntries: 1000,

      // Memory-specific config
      memoryIntegrationEnabled: true,
      adaptiveLearningEnabled: true,
      crossSessionMemoryEnabled: true,
      memoryInfluenceWeight: 0.3,
      qualityFeedbackEnabled: true,
      personalizedModesEnabled: true,
    };
  }

  private initializeMemoryMetrics(): ModeMemoryMetrics {
    return {
      modeUsageFrequency: new Map(),
      modeSuccessRates: new Map(),
      averageModeLatency: new Map(),
      userSatisfactionRatings: new Map(),
      memoryInfluencedDecisions: 0,
      adaptationSuccessRate: 0.8,
      crossSessionContinuity: 0.9,
      lastMemorySync: new Date(),
    };
  }

  // ========== Public API ==========

  getCurrentMemoryState(): ModeMemoryState | null {
    return this.currentMemoryState;
  }

  getMemoryMetrics(): ModeMemoryMetrics {
    return { ...this.memoryMetrics };
  }

  getAdaptationHistory(): AdaptationRecord[] {
    return [...this.adaptationHistory];
  }

  async getMemoryInsightsForMode(modeId: string): Promise<MemoryInsight[]> {
    const _mode = this.memoryAwareModes.get(modeId);
    if (!_mode) {
      return [];
    }

    return this.getMemoryInsights(`_mode:${modeId}`, { modeId });
  }

  async optimizeMemoryPerformance(): Promise<void> {
    await this.memoryCoordinator.forceOptimization();
  }

  updateMemoryConfig(config: Partial<MemoryAwareModeConfig>): void {
    Object.assign(this.config, config);
  }
}
