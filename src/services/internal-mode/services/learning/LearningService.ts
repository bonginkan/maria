/**
 * Learning Service - Adaptive Learning and Pattern Recognition Microservice
 * Handles user behavior learning, pattern recognition, and model optimization
 */

import { BaseService } from "../../core/BaseService";
import { ServiceEvent } from "../../core/types";
import { Service } from "../../core/decorators/service.decorator";
import { EventHandler } from "../../core/decorators/event.decorator";

export interface LearningPattern {
  id: string;
  userId: string;
  type:
    | "mode_preference"
    | "timing_pattern"
    | "context_pattern"
    | "transition_pattern";
  pattern: any;
  confidence: number;
  frequency: number;
  lastObserved: number;
  createdAt: number;
  metadata?: any;
}

export interface UserProfile {
  userId: string;
  preferences: {
    preferredModes: string[];
    avoidedModes: string[];
    workingHours: { start: number; end: number };
    sessionDuration: number;
    interruptionTolerance: number;
  };
  patterns: LearningPattern[];
  _adaptationLevel: number;
  learningRate: number;
  lastUpdated: number;
}

export interface PredictionResult {
  recommendedMode: string;
  confidence: number;
  reasoning: string[];
  alternatives: string[];
  basedOnPatterns: string[];
  _expectedDuration: number;
}

export interface OptimizationResult {
  metric: string;
  beforeValue: number;
  afterValue: number;
  improvement: number;
  strategy: string;
}

@Service({
  id: "learning-service",
  version: "1.0.0",
  description: "Adaptive learning and pattern recognition service",
  dependencies: ["history-service"],
  startupOrder: 5,
})
export class LearningService extends BaseService {
  public readonly id = "learning-service";
  public readonly version = "1.0.0";

  private userProfiles: Map<string, UserProfile> = new Map();
  private patterns: Map<string, LearningPattern> = new Map();
  private learningModels: Map<string, any> = new Map();
  private minPatternFrequency = 3;
  private minConfidence = 0.7;
  private adaptationThreshold = 0.8;

  async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing Learning Service...`);
    await this.loadUserProfiles();
    await this.initializeLearningModels();
    console.log(
      `[${this.id}] Learning Service initialized with ${this.userProfiles.size} user profiles`,
    );
  }

  async onStart(): Promise<void> {
    console.log(`[${this.id}] Starting Learning Service...`);
    this.emitServiceEvent("learning:ready", {
      service: this.id,
      totalProfiles: this.userProfiles.size,
      _totalPatterns: this.patterns.size,
    });
  }

  async onStop(): Promise<void> {
    console.log(`[${this.id}] Stopping Learning Service...`);
    await this.saveUserProfiles();
  }

  /**
   * Learn from user behavior and update patterns
   */
  async learn(_userId: string, behavior: unknown): Promise<void> {
    let _profile = this.userProfiles.get(_userId);

    if (!_profile) {
      _profile = await this.createUserProfile(_userId);
    }

    // Extract patterns from behavior
    const _newPatterns = await this.extractPatterns(_userId, behavior);

    // Update _existing patterns or create new ones
    for (const pattern of _newPatterns) {
      await this.updatePattern(pattern);
    }

    // Update user _profile
    _profile.lastUpdated = Date.now();
    profile.adaptationLevel = this.calculateAdaptationLevel(_profile);

    this.userProfiles.set(_userId, _profile);

    this.emitServiceEvent("learning:patterns_updated", {
      userId: "",
      _newPatterns: _newPatterns.length,
      _totalPatterns: _profile.patterns.length,
    });
  }

  /**
   * Predict optimal mode based on learned patterns
   */
  async predict(_userId: string, context: unknown): Promise<PredictionResult> {
    const _profile = this.userProfiles.get(_userId);

    if (!_profile) {
      return this.getDefaultPrediction(context);
    }

    const _relevantPatterns = this.findRelevantPatterns(_profile, context);
    const _modeScores = new Map<string, number>();
    const reasoning: string[] = [];
    const usedPatterns: string[] = [];

    // Score modes based on patterns
    for (const pattern of _relevantPatterns) {
      const _score = this.calculatePatternScore(pattern, context);

      if (_score > this.minConfidence) {
        const _modeId = this.extractModeFromPattern(pattern);
        _modeScores.set(_modeId, (_modeScores.get(_modeId) || 0) + _score);
        reasoning.push(
          `${pattern.type}: ${Math.round(_score * 100)}% confidence`,
        );
        usedPatterns.push(pattern.id);
      }
    }

    // Apply user preferences
    for (const preferredMode of _profile.preferences.preferredModes) {
      _modeScores.set(
        preferredMode,
        (_modeScores.get(preferredMode) || 0) + 0.2,
      );
      reasoning.push(`User preference: ${preferredMode}`);
    }

    // Find best mode
    let bestMode = "thinking";
    let bestScore = 0;
    const alternatives: string[] = [];

    for (const [mode, _score] of _modeScores) {
      if (_score > bestScore) {
        if (bestMode !== "thinking") {
          alternatives.push(bestMode);
        }
        bestMode = mode;
        bestScore = _score;
      } else if (_score > this.minConfidence) {
        alternatives.push(mode);
      }
    }

    const _expectedDuration = this.predictDuration(_userId, bestMode, context);

    return {
      recommendedMode: bestMode,
      confidence: Math.min(bestScore, 1.0),
      reasoning,
      alternatives: alternatives.slice(0, 3),
      basedOnPatterns: usedPatterns,
      _expectedDuration,
    };
  }

  /**
   * Optimize user experience based on learned patterns
   */
  async optimize(userId: string): Promise<OptimizationResult[]> {
    const _profile = this.userProfiles.get(userId);

    if (!_profile) {
      return [];
    }

    const optimizations: OptimizationResult[] = [];

    // Optimize learning rate
    const _learningRateOpt = await this.optimizeLearningRate(_profile);
    if (_learningRateOpt) {
      optimizations.push(_learningRateOpt);
    }

    // Optimize mode transitions
    const _transitionOpt = await this.optimizeTransitions(_profile);
    if (_transitionOpt) {
      optimizations.push(_transitionOpt);
    }

    // Optimize session timing
    const _timingOpt = await this.optimizeTiming(_profile);
    if (_timingOpt) {
      optimizations.push(_timingOpt);
    }

    this.emitServiceEvent("learning:optimization_complete", {
      userId,
      optimizations: optimizations.length,
    });

    return optimizations;
  }

  /**
   * Get user learning statistics
   */
  async getUserLearningStats(userId: string): Promise<unknown> {
    const _profile = this.userProfiles.get(userId);

    if (!_profile) {
      return null;
    }

    const _userPatterns = _profile.patterns;
    const _patternsByType = new Map<string, number>();

    for (const pattern of _userPatterns) {
      _patternsByType.set(
        pattern.type,
        (_patternsByType.get(pattern.type) || 0) + 1,
      );
    }

    return {
      userId,
      _adaptationLevel: _profile.adaptationLevel,
      learningRate: _profile.learningRate,
      _totalPatterns: _userPatterns.length,
      _patternsByType: Object.fromEntries(_patternsByType),
      preferences: _profile.preferences,
      lastUpdated: _profile.lastUpdated,
      profileAge: Date.now() - (_profile.lastUpdated || Date.now()),
    };
  }

  /**
   * Reset user learning data
   */
  async resetUserLearning(userId: string): Promise<void> {
    this.userProfiles.delete(userId);

    // Remove user-specific patterns
    for (const [patternId, pattern] of this.patterns) {
      if (pattern.userId === userId) {
        this.patterns.delete(patternId);
      }
    }

    this.emitServiceEvent("learning:user_reset", { userId });
  }

  /**
   * Create new user _profile
   */
  private async createUserProfile(userId: string): Promise<UserProfile> {
    const _profile: UserProfile = {
      userId,
      preferences: {
        preferredModes: ["thinking"],
        avoidedModes: [],
        workingHours: { start: 9, end: 17 },
        sessionDuration: 30 * 60 * 1000, // 30 minutes
        interruptionTolerance: 0.5,
      },
      patterns: [],
      _adaptationLevel: 0,
      learningRate: 0.1,
      lastUpdated: Date.now(),
    };

    this.userProfiles.set(userId, _profile);
    return _profile;
  }

  /**
   * Extract patterns from user behavior
   */
  private async extractPatterns(
    _userId: string,
    behavior: unknown,
  ): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];

    // Mode preference patterns
    if (behavior.modeUsage) {
      const _modePattern = await this.extractModePreferencePattern(
        _userId,
        behavior.modeUsage,
      );
      if (_modePattern) {
        patterns.push(_modePattern);
      }
    }

    // Timing patterns
    if (behavior.timestamp) {
      const _timingPattern = await this.extractTimingPattern(
        _userId,
        behavior.timestamp,
      );
      if (_timingPattern) {
        patterns.push(_timingPattern);
      }
    }

    // Context patterns
    if (behavior.context) {
      const _contextPattern = await this.extractContextPattern(
        _userId,
        behavior.context,
      );
      if (_contextPattern) {
        patterns.push(_contextPattern);
      }
    }

    // Transition patterns
    if (behavior.transition) {
      const _transitionPattern = await this.extractTransitionPattern(
        _userId,
        behavior.transition,
      );
      if (_transitionPattern) {
        patterns.push(_transitionPattern);
      }
    }

    return patterns;
  }

  /**
   * Extract mode preference pattern
   */
  private async extractModePreferencePattern(
    userId: string,
    modeUsage: unknown,
  ): Promise<LearningPattern | null> {
    return {
      id: this.generatePatternId(),
      userId,
      type: "mode_preference",
      pattern: {
        mode: modeUsage.mode,
        context: modeUsage.context,
        satisfaction: modeUsage.satisfaction || 0.8,
      },
      confidence: 0.8,
      frequency: 1,
      lastObserved: Date.now(),
      createdAt: Date.now(),
    };
  }

  /**
   * Extract timing pattern
   */
  private async extractTimingPattern(
    userId: string,
    timestamp: number,
  ): Promise<LearningPattern | null> {
    const _hour = new Date(timestamp).getHours();
    const _dayOfWeek = new Date(timestamp).getDay();

    return {
      id: this.generatePatternId(),
      userId,
      type: "timing_pattern",
      pattern: {
        _hour,
        _dayOfWeek,
        isWeekend: _dayOfWeek === 0 || _dayOfWeek === 6,
      },
      confidence: 0.7,
      frequency: 1,
      lastObserved: timestamp,
      createdAt: Date.now(),
    };
  }

  /**
   * Extract context pattern
   */
  private async extractContextPattern(
    userId: string,
    context: unknown,
  ): Promise<LearningPattern | null> {
    return {
      id: this.generatePatternId(),
      userId,
      type: "context_pattern",
      pattern: {
        projectType: context.projectType,
        language: context.language,
        errorPresent: context.errorPresent || false,
        fileType: context.fileType,
      },
      confidence: 0.6,
      frequency: 1,
      lastObserved: Date.now(),
      createdAt: Date.now(),
    };
  }

  /**
   * Extract transition pattern
   */
  private async extractTransitionPattern(
    userId: string,
    transition: unknown,
  ): Promise<LearningPattern | null> {
    return {
      id: this.generatePatternId(),
      userId,
      type: "transition_pattern",
      pattern: {
        fromMode: transition.from,
        toMode: transition.to,
        trigger: transition.trigger,
        success: transition.success !== false,
      },
      confidence: 0.75,
      frequency: 1,
      lastObserved: Date.now(),
      createdAt: Date.now(),
    };
  }

  /**
   * Update _existing pattern or create new one
   */
  private async updatePattern(newPattern: LearningPattern): Promise<void> {
    // Find similar _existing pattern
    const _existing = this.findSimilarPattern(newPattern);

    if (_existing) {
      // Update _existing pattern
      _existing.frequency++;
      _existing.lastObserved = newPattern.lastObserved;
      _existing.confidence = Math.min(0.95, _existing.confidence + 0.05);

      // Merge pattern data
      _existing.pattern = { ..._existing.pattern, ...newPattern.pattern };

      this.patterns.set(_existing.id, _existing);
    } else {
      // Create new pattern
      this.patterns.set(newPattern.id, newPattern);
    }
  }

  /**
   * Find similar _existing pattern
   */
  private findSimilarPattern(pattern: LearningPattern): LearningPattern | null {
    for (const _existing of this.patterns.values()) {
      if (
        _existing.userId === pattern.userId &&
        existing.type === pattern.type &&
        this.patternsAreSimilar(_existing.pattern, pattern.pattern)
      ) {
        return _existing;
      }
    }
    return null;
  }

  /**
   * Check if two patterns are similar
   */
  private patternsAreSimilar(_pattern1: unknown, pattern2: unknown): boolean {
    // Simple similarity check - could be more sophisticated
    if (_pattern1.mode && pattern2.mode) {
      return _pattern1.mode === pattern2.mode;
    }

    if (_pattern1.hour !== undefined && pattern2.hour !== undefined) {
      return Math.abs(_pattern1.hour - pattern2.hour) <= 1;
    }

    return JSON.stringify(_pattern1) === JSON.stringify(pattern2);
  }

  /**
   * Find relevant patterns for context
   */
  private findRelevantPatterns(
    _profile: UserProfile,
    context: unknown,
  ): LearningPattern[] {
    const relevant: LearningPattern[] = [];

    for (const pattern of _profile.patterns) {
      if (
        pattern.frequency >= this.minPatternFrequency &&
        pattern.confidence >= this.minConfidence &&
        this.isPatternRelevant(pattern, context)
      ) {
        relevant.push(pattern);
      }
    }

    return relevant.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Check if pattern is relevant to current context
   */
  private isPatternRelevant(
    _pattern: LearningPattern,
    context: unknown,
  ): boolean {
    if (_pattern.type === "timing_pattern") {
      const _hour = new Date().getHours();
      return Math.abs(_pattern._pattern._hour - _hour) <= 2;
    }

    if (_pattern.type === "context_pattern") {
      return (
        _pattern._pattern.projectType === context.projectType ||
        _pattern._pattern.language === context.language
      );
    }

    return true; // Default to relevant
  }

  /**
   * Calculate pattern _score for current context
   */
  private calculatePatternScore(
    _pattern: LearningPattern,
    _context: unknown,
  ): number {
    let _score = _pattern.confidence;

    // Boost _score based on frequency
    _score += Math.min(0.2, _pattern.frequency * 0.02);

    // Boost _score based on recency
    const _daysSinceObserved =
      (Date.now() - _pattern.lastObserved) / (24 * 60 * 60 * 1000);
    if (_daysSinceObserved < 7) {
      _score += 0.1;
    }

    return Math.min(1.0, _score);
  }

  /**
   * Extract mode from pattern
   */
  private extractModeFromPattern(pattern: LearningPattern): string {
    if (pattern.pattern.mode) {
      return pattern.pattern.mode;
    }

    if (pattern.pattern.toMode) {
      return pattern.pattern.toMode;
    }

    return "thinking";
  }

  /**
   * Predict session duration for mode
   */
  private predictDuration(
    _userId: string,
    _modeId: string,
    _context: unknown,
  ): number {
    const _profile = this.userProfiles.get(_userId);

    if (!_profile) {
      return 5 * 60 * 1000; // Default 5 minutes
    }

    // Find historical durations for this mode
    const _modePatterns = _profile.patterns.filter(
      (p) => p.type === "mode_preference" && p.pattern.mode === _modeId,
    );

    if (_modePatterns.length > 0) {
      const _avgDuration =
        _modePatterns.reduce(
          (sum, p) => sum + (p.pattern.duration || 5 * 60 * 1000),
          0,
        ) / modePatterns.length;

      return _avgDuration;
    }

    return _profile.preferences.sessionDuration;
  }

  /**
   * Calculate adaptation level
   */
  private calculateAdaptationLevel(_profile: UserProfile): number {
    const _totalPatterns = _profile.patterns.length;
    const _strongPatterns = _profile.patterns.filter(
      (p) => p.confidence > 0.8,
    ).length;

    if (_totalPatterns === 0) {
      return 0;
    }

    return (_strongPatterns / _totalPatterns) * 100;
  }

  /**
   * Get default prediction when no _profile exists
   */
  private getDefaultPrediction(_context: unknown): PredictionResult {
    return {
      recommendedMode: "thinking",
      confidence: 0.5,
      reasoning: ["No user _profile available", "Using default mode"],
      alternatives: ["brainstorming", "researching"],
      basedOnPatterns: [],
      _expectedDuration: 5 * 60 * 1000,
    };
  }

  /**
   * Optimize learning rate
   */
  private async optimizeLearningRate(
    _profile: UserProfile,
  ): Promise<OptimizationResult | null> {
    const _currentRate = _profile.learningRate;
    const _adaptationLevel = _profile._adaptationLevel;

    let newRate = _currentRate;

    if (_adaptationLevel > 80) {
      newRate = Math.max(0.05, _currentRate * 0.8); // Slow down learning
    } else if (_adaptationLevel < 40) {
      newRate = Math.min(0.3, _currentRate * 1.2); // Speed up learning
    }

    if (newRate !== _currentRate) {
      profile.learningRate = newRate;
      return {
        metric: "learning_rate",
        beforeValue: _currentRate,
        afterValue: newRate,
        improvement: Math.abs(newRate - _currentRate),
        strategy: _adaptationLevel > 80 ? "slow_down" : "speed_up",
      };
    }

    return null;
  }

  /**
   * Optimize transitions
   */
  private async optimizeTransitions(
    _profile: UserProfile,
  ): Promise<OptimizationResult | null> {
    // Placeholder for transition optimization logic
    return null;
  }

  /**
   * Optimize timing
   */
  private async optimizeTiming(
    _profile: UserProfile,
  ): Promise<OptimizationResult | null> {
    // Placeholder for timing optimization logic
    return null;
  }

  /**
   * Generate pattern ID
   */
  private generatePatternId(): string {
    return `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load user profiles from storage
   */
  private async loadUserProfiles(): Promise<void> {
    // Future: Load from persistent storage
    console.log(`[${this.id}] Loading user profiles placeholder`);
  }

  /**
   * Save user profiles to storage
   */
  private async saveUserProfiles(): Promise<void> {
    // Future: Save to persistent storage
    console.log(`[${this.id}] Saving user profiles placeholder`);
  }

  /**
   * Initialize learning models
   */
  private async initializeLearningModels(): Promise<void> {
    // Future: Initialize ML models for pattern recognition
    console.log(`[${this.id}] Initializing learning models placeholder`);
  }

  @EventHandler("mode:transition")
  async handleModeTransition(event: ServiceEvent): Promise<void> {
    const { transition } = event.data;

    await this.learn(transition.userId, {
      transition: {
        from: transition.fromMode,
        to: transition.toMode,
        trigger: transition.reason,
        success: true,
      },
      timestamp: transition.timestamp,
    });
  }

  @EventHandler("history:entry_recorded")
  async handleHistoryEntry(event: ServiceEvent): Promise<void> {
    const { entry } = event.data;

    await this.learn(entry.userId, {
      modeUsage: {
        mode: entry.modeId,
        context: entry.context,
        duration: entry.duration,
      },
      timestamp: entry.timestamp,
    });
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<unknown> {
    return {
      service: this.id,
      totalProfiles: this.userProfiles.size,
      _totalPatterns: this.patterns.size,
      averagePatternsPerUser:
        this.userProfiles.size > 0
          ? this.patterns.size / this.userProfiles.size
          : 0,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}
