/**
 * Learning Service - Adaptive Learning and Pattern Recognition Microservice
 * Handles user behavior learning, pattern recognition, and model optimization
 */

import { BaseService } from '../../core/BaseService.js';
import { ServiceEvent } from '../../core/types.js';
import { Service } from '../../core/decorators/service.decorator.js';
import { EventHandler } from '../../core/decorators/event.decorator.js';

export interface LearningPattern {
  id: string;
  userId: string;
  type: 'mode_preference' | 'timing_pattern' | 'context_pattern' | 'transition_pattern';
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
  adaptationLevel: number;
  learningRate: number;
  lastUpdated: number;
}

export interface PredictionResult {
  recommendedMode: string;
  confidence: number;
  reasoning: string[];
  alternatives: string[];
  basedOnPatterns: string[];
  expectedDuration: number;
}

export interface OptimizationResult {
  metric: string;
  beforeValue: number;
  afterValue: number;
  improvement: number;
  strategy: string;
}

@Service({
  id: 'learning-service',
  version: '1.0.0',
  description: 'Adaptive learning and pattern recognition service',
  dependencies: ['history-service'],
  startupOrder: 5,
})
export class LearningService extends BaseService {
  public readonly id = 'learning-service';
  public readonly version = '1.0.0';

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
    this.emitServiceEvent('learning:ready', {
      service: this.id,
      totalProfiles: this.userProfiles.size,
      totalPatterns: this.patterns.size,
    });
  }

  async onStop(): Promise<void> {
    console.log(`[${this.id}] Stopping Learning Service...`);
    await this.saveUserProfiles();
  }

  /**
   * Learn from user behavior and update patterns
   */
  async learn(userId: string, behavior: unknown): Promise<void> {
    let profile = this.userProfiles.get(userId);

    if (!profile) {
      profile = await this.createUserProfile(userId);
    }

    // Extract patterns from behavior
    const newPatterns = await this.extractPatterns(userId, behavior);

    // Update existing patterns or create new ones
    for (const pattern of newPatterns) {
      await this.updatePattern(pattern);
    }

    // Update user profile
    profile.lastUpdated = Date.now();
    profile.adaptationLevel = this.calculateAdaptationLevel(profile);

    this.userProfiles.set(userId, profile);

    this.emitServiceEvent('learning:patterns_updated', {
      userId,
      newPatterns: newPatterns.length,
      totalPatterns: profile.patterns.length,
    });
  }

  /**
   * Predict optimal mode based on learned patterns
   */
  async predict(userId: string, context: unknown): Promise<PredictionResult> {
    const profile = this.userProfiles.get(userId);

    if (!profile) {
      return this.getDefaultPrediction(context);
    }

    const relevantPatterns = this.findRelevantPatterns(profile, context);
    const modeScores = new Map<string, number>();
    const reasoning: string[] = [];
    const usedPatterns: string[] = [];

    // Score modes based on patterns
    for (const pattern of relevantPatterns) {
      const score = this.calculatePatternScore(pattern, context);

      if (score > this.minConfidence) {
        const modeId = this.extractModeFromPattern(pattern);
        modeScores.set(modeId, (modeScores.get(modeId) || 0) + score);
        reasoning.push(`${pattern.type}: ${Math.round(score * 100)}% confidence`);
        usedPatterns.push(pattern.id);
      }
    }

    // Apply user preferences
    for (const preferredMode of profile.preferences.preferredModes) {
      modeScores.set(preferredMode, (modeScores.get(preferredMode) || 0) + 0.2);
      reasoning.push(`User preference: ${preferredMode}`);
    }

    // Find best mode
    let bestMode = 'thinking';
    let bestScore = 0;
    const alternatives: string[] = [];

    for (const [mode, score] of modeScores) {
      if (score > bestScore) {
        if (bestMode !== 'thinking') {
          alternatives.push(bestMode);
        }
        bestMode = mode;
        bestScore = score;
      } else if (score > this.minConfidence) {
        alternatives.push(mode);
      }
    }

    const expectedDuration = this.predictDuration(userId, bestMode, context);

    return {
      recommendedMode: bestMode,
      confidence: Math.min(bestScore, 1.0),
      reasoning,
      alternatives: alternatives.slice(0, 3),
      basedOnPatterns: usedPatterns,
      expectedDuration,
    };
  }

  /**
   * Optimize user experience based on learned patterns
   */
  async optimize(userId: string): Promise<OptimizationResult[]> {
    const profile = this.userProfiles.get(userId);

    if (!profile) {
      return [];
    }

    const optimizations: OptimizationResult[] = [];

    // Optimize learning rate
    const learningRateOpt = await this.optimizeLearningRate(profile);
    if (learningRateOpt) {
      optimizations.push(learningRateOpt);
    }

    // Optimize mode transitions
    const transitionOpt = await this.optimizeTransitions(profile);
    if (transitionOpt) {
      optimizations.push(transitionOpt);
    }

    // Optimize session timing
    const timingOpt = await this.optimizeTiming(profile);
    if (timingOpt) {
      optimizations.push(timingOpt);
    }

    this.emitServiceEvent('learning:optimization_complete', {
      userId,
      optimizations: optimizations.length,
    });

    return optimizations;
  }

  /**
   * Get user learning statistics
   */
  async getUserLearningStats(userId: string): Promise<unknown> {
    const profile = this.userProfiles.get(userId);

    if (!profile) {
      return null;
    }

    const userPatterns = profile.patterns;
    const patternsByType = new Map<string, number>();

    for (const pattern of userPatterns) {
      patternsByType.set(pattern.type, (patternsByType.get(pattern.type) || 0) + 1);
    }

    return {
      userId,
      adaptationLevel: profile.adaptationLevel,
      learningRate: profile.learningRate,
      totalPatterns: userPatterns.length,
      patternsByType: Object.fromEntries(patternsByType),
      preferences: profile.preferences,
      lastUpdated: profile.lastUpdated,
      profileAge: Date.now() - (profile.lastUpdated || Date.now()),
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

    this.emitServiceEvent('learning:user_reset', { userId });
  }

  /**
   * Create new user profile
   */
  private async createUserProfile(userId: string): Promise<UserProfile> {
    const profile: UserProfile = {
      userId,
      preferences: {
        preferredModes: ['thinking'],
        avoidedModes: [],
        workingHours: { start: 9, end: 17 },
        sessionDuration: 30 * 60 * 1000, // 30 minutes
        interruptionTolerance: 0.5,
      },
      patterns: [],
      adaptationLevel: 0,
      learningRate: 0.1,
      lastUpdated: Date.now(),
    };

    this.userProfiles.set(userId, profile);
    return profile;
  }

  /**
   * Extract patterns from user behavior
   */
  private async extractPatterns(userId: string, behavior: unknown): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];

    // Mode preference patterns
    if (behavior.modeUsage) {
      const modePattern = await this.extractModePreferencePattern(userId, behavior.modeUsage);
      if (modePattern) {patterns.push(modePattern);}
    }

    // Timing patterns
    if (behavior.timestamp) {
      const timingPattern = await this.extractTimingPattern(userId, behavior.timestamp);
      if (timingPattern) {patterns.push(timingPattern);}
    }

    // Context patterns
    if (behavior.context) {
      const contextPattern = await this.extractContextPattern(userId, behavior.context);
      if (contextPattern) {patterns.push(contextPattern);}
    }

    // Transition patterns
    if (behavior.transition) {
      const transitionPattern = await this.extractTransitionPattern(userId, behavior.transition);
      if (transitionPattern) {patterns.push(transitionPattern);}
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
      type: 'mode_preference',
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
    const hour = new Date(timestamp).getHours();
    const dayOfWeek = new Date(timestamp).getDay();

    return {
      id: this.generatePatternId(),
      userId,
      type: 'timing_pattern',
      pattern: {
        hour,
        dayOfWeek,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
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
      type: 'context_pattern',
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
      type: 'transition_pattern',
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
   * Update existing pattern or create new one
   */
  private async updatePattern(newPattern: LearningPattern): Promise<void> {
    // Find similar existing pattern
    const existing = this.findSimilarPattern(newPattern);

    if (existing) {
      // Update existing pattern
      existing.frequency++;
      existing.lastObserved = newPattern.lastObserved;
      existing.confidence = Math.min(0.95, existing.confidence + 0.05);

      // Merge pattern data
      existing.pattern = { ...existing.pattern, ...newPattern.pattern };

      this.patterns.set(existing.id, existing);
    } else {
      // Create new pattern
      this.patterns.set(newPattern.id, newPattern);
    }
  }

  /**
   * Find similar existing pattern
   */
  private findSimilarPattern(pattern: LearningPattern): LearningPattern | null {
    for (const existing of this.patterns.values()) {
      if (
        existing.userId === pattern.userId &&
        existing.type === pattern.type &&
        this.patternsAreSimilar(existing.pattern, pattern.pattern)
      ) {
        return existing;
      }
    }
    return null;
  }

  /**
   * Check if two patterns are similar
   */
  private patternsAreSimilar(pattern1: unknown, pattern2: unknown): boolean {
    // Simple similarity check - could be more sophisticated
    if (pattern1.mode && pattern2.mode) {
      return pattern1.mode === pattern2.mode;
    }

    if (pattern1.hour !== undefined && pattern2.hour !== undefined) {
      return Math.abs(pattern1.hour - pattern2.hour) <= 1;
    }

    return JSON.stringify(pattern1) === JSON.stringify(pattern2);
  }

  /**
   * Find relevant patterns for context
   */
  private findRelevantPatterns(profile: UserProfile, context: unknown): LearningPattern[] {
    const relevant: LearningPattern[] = [];

    for (const pattern of profile.patterns) {
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
  private isPatternRelevant(pattern: LearningPattern, context: unknown): boolean {
    if (pattern.type === 'timing_pattern') {
      const hour = new Date().getHours();
      return Math.abs(pattern.pattern.hour - hour) <= 2;
    }

    if (pattern.type === 'context_pattern') {
      return (
        pattern.pattern.projectType === context.projectType ||
        pattern.pattern.language === context.language
      );
    }

    return true; // Default to relevant
  }

  /**
   * Calculate pattern score for current context
   */
  private calculatePatternScore(pattern: LearningPattern, context: unknown): number {
    let score = pattern.confidence;

    // Boost score based on frequency
    score += Math.min(0.2, pattern.frequency * 0.02);

    // Boost score based on recency
    const daysSinceObserved = (Date.now() - pattern.lastObserved) / (24 * 60 * 60 * 1000);
    if (daysSinceObserved < 7) {
      score += 0.1;
    }

    return Math.min(1.0, score);
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

    return 'thinking';
  }

  /**
   * Predict session duration for mode
   */
  private predictDuration(userId: string, modeId: string, context: unknown): number {
    const profile = this.userProfiles.get(userId);

    if (!profile) {
      return 5 * 60 * 1000; // Default 5 minutes
    }

    // Find historical durations for this mode
    const modePatterns = profile.patterns.filter(
      (p) => p.type === 'mode_preference' && p.pattern.mode === modeId,
    );

    if (modePatterns.length > 0) {
      const avgDuration =
        modePatterns.reduce((sum, p) => sum + (p.pattern.duration || 5 * 60 * 1000), 0) /
        modePatterns.length;

      return avgDuration;
    }

    return profile.preferences.sessionDuration;
  }

  /**
   * Calculate adaptation level
   */
  private calculateAdaptationLevel(profile: UserProfile): number {
    const totalPatterns = profile.patterns.length;
    const strongPatterns = profile.patterns.filter((p) => p.confidence > 0.8).length;

    if (totalPatterns === 0) {return 0;}

    return (strongPatterns / totalPatterns) * 100;
  }

  /**
   * Get default prediction when no profile exists
   */
  private getDefaultPrediction(context: unknown): PredictionResult {
    return {
      recommendedMode: 'thinking',
      confidence: 0.5,
      reasoning: ['No user profile available', 'Using default mode'],
      alternatives: ['brainstorming', 'researching'],
      basedOnPatterns: [],
      expectedDuration: 5 * 60 * 1000,
    };
  }

  /**
   * Optimize learning rate
   */
  private async optimizeLearningRate(profile: UserProfile): Promise<OptimizationResult | null> {
    const currentRate = profile.learningRate;
    const adaptationLevel = profile.adaptationLevel;

    let newRate = currentRate;

    if (adaptationLevel > 80) {
      newRate = Math.max(0.05, currentRate * 0.8); // Slow down learning
    } else if (adaptationLevel < 40) {
      newRate = Math.min(0.3, currentRate * 1.2); // Speed up learning
    }

    if (newRate !== currentRate) {
      profile.learningRate = newRate;
      return {
        metric: 'learning_rate',
        beforeValue: currentRate,
        afterValue: newRate,
        improvement: Math.abs(newRate - currentRate),
        strategy: adaptationLevel > 80 ? 'slow_down' : 'speed_up',
      };
    }

    return null;
  }

  /**
   * Optimize transitions
   */
  private async optimizeTransitions(profile: UserProfile): Promise<OptimizationResult | null> {
    // Placeholder for transition optimization logic
    return null;
  }

  /**
   * Optimize timing
   */
  private async optimizeTiming(profile: UserProfile): Promise<OptimizationResult | null> {
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

  @EventHandler('mode:transition')
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

  @EventHandler('history:entry_recorded')
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
      totalPatterns: this.patterns.size,
      averagePatternsPerUser:
        this.userProfiles.size > 0 ? this.patterns.size / this.userProfiles.size : 0,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}
