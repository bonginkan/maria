/**
 * Mode History Tracker - Learning and Pattern Analysis
 *
 * Tracks mode usage patterns, user preferences, and learning data
 * to improve future mode recognition accuracy.
 */

import { EventEmitter } from 'events';
import { ModeConfig, ModeHistoryEntry, ModeTransition, UserPattern } from './types';

export class ModeHistoryTracker extends EventEmitter {
  private config: ModeConfig;
  private history: ModeHistoryEntry[] = [];
  private userPatterns: UserPattern[] = [];
  private initialized: boolean = false;

  // Performance tracking
  private sessionStartTime: Date = new Date();
  private totalModeChanges: number = 0;
  private recognitionAccuracy: Array<{ predicted: string; actual: string; correct: boolean }> = [];

  constructor(config: ModeConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load persisted data if available
    await this.loadPersistedData();

    this.initialized = true;
  }

  /**
   * Record a mode transition
   */
  async recordTransition(transition: ModeTransition): Promise<void> {
    // Update previous mode end time if exists
    if (this.history.length > 0) {
      const lastEntry = this.history[this.history.length - 1];
      if (!lastEntry.endTime) {
        lastEntry.endTime = transition.timestamp;
        lastEntry.duration = lastEntry.endTime.getTime() - lastEntry.startTime.getTime();
      }
    }

    // Find mode definition (in real implementation, would have access to registry)
    // For now, create a basic entry
    const historyEntry: ModeHistoryEntry = {
      mode: {
        id: transition.to,
        name: transition.to,
        symbol: '🧠',
        category: 'reasoning',
        intensity: 'normal',
        description: '',
        purpose: '',
        useCases: [],
        triggers: [],
        display: { color: 'cyan', animation: true, duration: 2000, prefix: '✽', suffix: '…' },
        i18n: {},
        metadata: {
          version: '1.0.0',
          author: 'MARIA',
          created: new Date(),
          updated: new Date(),
          tags: [],
          experimental: false,
          deprecated: false,
        },
      },
      startTime: transition.timestamp,
      trigger: transition.trigger,
    };

    this.history.push(historyEntry);
    this.totalModeChanges++;

    // Trim history if too large
    if (this.history.length > this.config.maxHistoryEntries) {
      this.history.shift();
    }

    // Update patterns
    await this.updateUserPatterns();

    // Persist data periodically
    if (this.totalModeChanges % 10 === 0) {
      await this.persistData();
    }
  }

  /**
   * Record user feedback on mode accuracy
   */
  async recordFeedback(modeId: string, wasCorrect: boolean, userInput?: string): Promise<void> {
    // Record accuracy for analysis
    this.recognitionAccuracy.push({
      predicted: modeId,
      actual: modeId, // In real implementation, would track what user actually wanted
      correct: wasCorrect,
    });

    // Trim accuracy history
    if (this.recognitionAccuracy.length > 100) {
      this.recognitionAccuracy.shift();
    }

    // Update user patterns based on feedback
    if (userInput) {
      await this.updatePatternFromFeedback(userInput, modeId, wasCorrect);
    }

    this.emit('feedback:recorded', { modeId, wasCorrect, userInput });
  }

  /**
   * Get recent mode history
   */
  getRecentModes(limit: number = 5): ModeHistoryEntry[] {
    return this.history.slice(-limit).reverse();
  }

  /**
   * Get full history
   */
  getHistory(): ModeHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Get user patterns for mode prediction
   */
  getUserPatterns(): UserPattern[] {
    return [...this.userPatterns];
  }

  /**
   * Get mode usage statistics
   */
  getUsageStatistics(): {
    totalSessions: number;
    totalModeChanges: number;
    averageSessionDuration: number;
    mostUsedModes: Array<{ modeId: string; count: number; percentage: number }>;
    modeSequences: Array<{ sequence: string[]; frequency: number }>;
    recognitionAccuracy: number;
  } {
    const modeUsage = new Map<string, number>();
    const sequences = new Map<string, number>();

    // Count mode usage
    this.history.forEach((entry) => {
      const currentCount = modeUsage.get(entry.mode.id) || 0;
      modeUsage.set(entry.mode.id, currentCount + 1);
    });

    // Extract sequences
    for (let i = 0; i < this.history.length - 2; i++) {
      const sequence = [
        this.history[i].mode.id,
        this.history[i + 1].mode.id,
        this.history[i + 2].mode.id,
      ];
      const sequenceKey = sequence.join('→');
      const currentCount = sequences.get(sequenceKey) || 0;
      sequences.set(sequenceKey, currentCount + 1);
    }

    // Calculate most used modes
    const mostUsedModes = Array.from(modeUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([modeId, count]) => ({
        modeId,
        count,
        percentage: (count / this.history.length) * 100,
      }));

    // Calculate common sequences
    const modeSequences = Array.from(sequences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sequence, frequency]) => ({
        sequence: sequence.split('→'),
        frequency,
      }));

    // Calculate recognition accuracy
    const accuracySum = this.recognitionAccuracy.reduce(
      (sum, entry) => sum + (entry.correct ? 1 : 0),
      0,
    );
    const recognitionAccuracy =
      this.recognitionAccuracy.length > 0
        ? (accuracySum / this.recognitionAccuracy.length) * 100
        : 0;

    // Calculate session info
    const sessionDuration = Date.now() - this.sessionStartTime.getTime();
    const averageSessionDuration = sessionDuration / Math.max(1, this.totalModeChanges);

    return {
      totalSessions: 1, // Single session for now
      totalModeChanges: this.totalModeChanges,
      averageSessionDuration,
      mostUsedModes,
      modeSequences,
      recognitionAccuracy,
    };
  }

  /**
   * Export history data
   */
  async exportHistory(): Promise<{
    history: ModeHistoryEntry[];
    patterns: UserPattern[];
    statistics: unknown;
  }> {
    return {
      history: this.getHistory(),
      patterns: this.getUserPatterns(),
      statistics: this.getUsageStatistics(),
    };
  }

  /**
   * Import history data
   */
  async importHistory(historyData: ModeHistoryEntry[]): Promise<void> {
    this.history = historyData.slice(0, this.config.maxHistoryEntries);
    await this.updateUserPatterns();
    await this.persistData();
  }

  /**
   * Import patterns data
   */
  async importPatterns(patternsData: UserPattern[]): Promise<void> {
    this.userPatterns = patternsData.slice(0, this.config.maxPatterns);
    await this.persistData();
  }

  /**
   * Clear all history and patterns
   */
  async clear(): Promise<void> {
    this.history = [];
    this.userPatterns = [];
    this.recognitionAccuracy = [];
    this.totalModeChanges = 0;
    this.sessionStartTime = new Date();

    await this.persistData();
  }

  /**
   * Update configuration
   */
  updateConfig(config: ModeConfig): void {
    this.config = config;
  }

  // Private methods

  private async updateUserPatterns(): Promise<void> {
    if (!this.config.patternTrackingEnabled || this.history.length < 3) {
      return;
    }

    // Extract patterns from recent history
    const recentHistory = this.history.slice(-10); // Last 10 mode changes
    const newPatterns: UserPattern[] = [];

    // Look for sequences of 2-4 modes
    for (let sequenceLength = 2; sequenceLength <= 4; sequenceLength++) {
      for (let i = 0; i <= recentHistory.length - sequenceLength; i++) {
        const sequence = recentHistory.slice(i, i + sequenceLength).map((entry) => entry.mode.id);

        // Check if this pattern already exists
        const existingPattern = this.userPatterns.find(
          (p) =>
            p.sequence.length === sequence.length &&
            p.sequence.every((mode, idx) => mode === sequence[idx]),
        );

        if (existingPattern) {
          existingPattern.frequency++;
          existingPattern.lastUsed = new Date();
        } else {
          newPatterns.push({
            sequence,
            frequency: 1,
            lastUsed: new Date(),
            success: 0.8, // Default success rate
          });
        }
      }
    }

    // Add new patterns
    this.userPatterns.push(...newPatterns);

    // Trim patterns if too many
    if (this.userPatterns.length > this.config.maxPatterns) {
      // Sort by frequency and recency, keep most valuable
      this.userPatterns.sort((a, b) => {
        const aScore = a.frequency * 0.7 + ((Date.now() - a.lastUsed.getTime()) / 86400000) * 0.3;
        const bScore = b.frequency * 0.7 + ((Date.now() - b.lastUsed.getTime()) / 86400000) * 0.3;
        return bScore - aScore;
      });

      this.userPatterns = this.userPatterns.slice(0, this.config.maxPatterns);
    }

    this.emit('pattern:learned', this.userPatterns);
  }

  private async updatePatternFromFeedback(
    userInput: string,
    modeId: string,
    wasCorrect: boolean,
  ): Promise<void> {
    // Find recent patterns that led to this mode
    const _recentModes = this.getRecentModes(3).map((entry) => entry.mode.id);

    for (const pattern of this.userPatterns) {
      if (pattern.sequence.length > 0 && pattern.sequence[pattern.sequence.length - 1] === modeId) {
        // Update success rate based on feedback
        const currentSuccess = pattern.success;
        const newSuccess = wasCorrect ? currentSuccess * 0.9 + 0.1 : currentSuccess * 0.9;
        pattern.success = Math.max(0.1, Math.min(1.0, newSuccess));
      }
    }
  }

  private async loadPersistedData(): Promise<void> {
    // In a real implementation, this would load from file system or database
    // For now, start with empty data
    this.history = [];
    this.userPatterns = [];
    this.recognitionAccuracy = [];
  }

  private async persistData(): Promise<void> {
    // In a real implementation, this would save to file system or database
    // For now, just emit an event for external persistence handling
    this.emit('data:persist', {
      history: this.history,
      patterns: this.userPatterns,
      accuracy: this.recognitionAccuracy,
    });
  }

  /**
   * Analyze mode effectiveness
   */
  analyzeModeEffectiveness(): Array<{
    modeId: string;
    totalUsage: number;
    averageDuration: number;
    userSatisfaction: number;
    triggers: Array<{ type: string; count: number }>;
  }> {
    const modeAnalysis = new Map<
      string,
      {
        usageCount: number;
        totalDuration: number;
        satisfactionSum: number;
        satisfactionCount: number;
        triggers: Map<string, number>;
      }
    >();

    // Analyze each history entry
    this.history.forEach((entry) => {
      const analysis = modeAnalysis.get(entry.mode.id) || {
        usageCount: 0,
        totalDuration: 0,
        satisfactionSum: 0,
        satisfactionCount: 0,
        triggers: new Map(),
      };

      analysis.usageCount++;

      if (entry.duration) {
        analysis.totalDuration += entry.duration;
      }

      if (entry.userFeedback) {
        const satisfactionValue =
          entry.userFeedback === 'positive' ? 1 : entry.userFeedback === 'negative' ? 0 : 0.5;
        analysis.satisfactionSum += satisfactionValue;
        analysis.satisfactionCount++;
      }

      const triggerCount = analysis.triggers.get(entry.trigger) || 0;
      analysis.triggers.set(entry.trigger, triggerCount + 1);

      modeAnalysis.set(entry.mode.id, analysis);
    });

    // Convert to result format
    return Array.from(modeAnalysis.entries()).map(([modeId, analysis]) => ({
      modeId,
      totalUsage: analysis.usageCount,
      averageDuration: analysis.usageCount > 0 ? analysis.totalDuration / analysis.usageCount : 0,
      userSatisfaction:
        analysis.satisfactionCount > 0
          ? analysis.satisfactionSum / analysis.satisfactionCount
          : 0.5,
      triggers: Array.from(analysis.triggers.entries()).map(([type, count]) => ({ type, count })),
    }));
  }

  /**
   * Get mode recommendations based on current context
   */
  getRecommendations(currentContext: {
    time: Date;
    recentModes: string[];
    errorState: boolean;
  }): Array<{ modeId: string; confidence: number; reason: string }> {
    const recommendations: Array<{ modeId: string; confidence: number; reason: string }> = [];

    // Analyze patterns for recommendations
    this.userPatterns.forEach((pattern) => {
      if (pattern.sequence.length >= 2) {
        const lastInSequence = pattern.sequence[pattern.sequence.length - 1];
        const patternStart = pattern.sequence.slice(0, -1);

        // Check if current context matches pattern start
        if (currentContext.recentModes.length >= patternStart.length) {
          const recentSlice = currentContext.recentModes.slice(-patternStart.length);

          if (patternStart.every((mode, idx) => mode === recentSlice[idx])) {
            const confidence = (pattern.frequency / 10) * pattern.success;
            recommendations.push({
              modeId: lastInSequence,
              confidence: Math.min(confidence, 0.9),
              reason: `Pattern match: ${pattern.sequence.join(' → ')} (used ${pattern.frequency} times)`,
            });
          }
        }
      }
    });

    // Sort by confidence
    return recommendations.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }
}
