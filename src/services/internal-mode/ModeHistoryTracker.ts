/**
 * Mode History Tracker - Learning and Pattern Analysis
 *
 * Tracks mode usage patterns, user preferences, and learning data
 * to improve future mode recognition accuracy.
 */

import { EventEmitter } from "node:events";
import {
  ModeConfig,
  ModeHistoryEntry,
  ModeTransition,
  UserPattern,
} from "./types";

export class ModeHistoryTracker extends EventEmitter {
  private config: ModeConfig;
  private history: ModeHistoryEntry[] = [];
  private userPatterns: UserPattern[] = [];
  private initialized: boolean = false;

  // Performance tracking
  private sessionStartTime: Date = new Date();
  private totalModeChanges: number = 0;
  private _recognitionAccuracy: Array<{
    predicted: string;
    actual: string;
    correct: boolean;
  }> = [];

  constructor(_config: ModeConfig) {
    super();
    this._config = _config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

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
      const _lastEntry = this.history[this.history.length - 1];
      if (!_lastEntry.endTime) {
        _lastEntry.endTime = transition.timestamp;
        _lastEntry.duration =
          _lastEntry.endTime.getTime() - _lastEntry.startTime.getTime();
      }
    }

    // Find mode definition (in real implementation, would have access to registry)
    // For now, create a basic entry
    const historyEntry: ModeHistoryEntry = {
      mode: {
        id: transition.to,
        name: transition.to,
        symbol: "🧠",
        category: "reasoning",
        intensity: "normal",
        description: "",
        purpose: "",
        useCases: [],
        triggers: [],
        display: {
          color: "cyan",
          animation: true,
          duration: 2000,
          prefix: "✽",
          suffix: "…",
        },
        i18n: Record<string, any>,
        metadata: {
          version: "1.0.0",
          author: "MARIA",
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
  async recordFeedback(
    _modeId: string,
    wasCorrect: boolean,
    userInput?: string,
  ): Promise<void> {
    // Record accuracy for _analysis
    this.recognitionAccuracy.push({
      predicted: _modeId,
      actual: _modeId, // In real implementation, would track what user actually wanted
      correct: wasCorrect,
    });

    // Trim accuracy history
    if (this.recognitionAccuracy.length > 100) {
      this.recognitionAccuracy.shift();
    }

    // Update user patterns based on feedback
    if (userInput) {
      await this.updatePatternFromFeedback(userInput, _modeId, wasCorrect);
    }

    this.emit("feedback:recorded", { _modeId, wasCorrect, userInput });
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
    _averageSessionDuration: number;
    _mostUsedModes: Array<{
      modeId: string;
      count: number;
      percentage: number;
    }>;
    _modeSequences: Array<{ _sequence: string[]; frequency: number }>;
    _recognitionAccuracy: number;
  } {
    const _modeUsage = new Map<string, number>();
    const _sequences = new Map<string, number>();

    // Count mode usage
    this.history.forEach((entry) => {
      const _currentCount = _modeUsage.get(entry.mode.id) || 0;
      modeUsage.set(entry.mode.id, _currentCount + 1);
    });

    // Extract _sequences
    for (let i = 0; i < this.history.length - 2; i++) {
      const _sequence = [
        this.history[i].mode.id,
        this.history[i + 1].mode.id,
        this.history[i + 2].mode.id,
      ];
      const _sequenceKey = _sequence.join("→");
      const _currentCount = _sequences.get(_sequenceKey) || 0;
      sequences.set(_sequenceKey, _currentCount + 1);
    }

    // Calculate most used modes
    const _mostUsedModes = Array.from(_modeUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([modeId, count]) => ({
        modeId,
        count,
        percentage: (count / this.history.length) * 100,
      }));

    // Calculate common _sequences
    const _modeSequences = Array.from(_sequences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([_sequence, frequency]) => ({
        _sequence: _sequence.split("→"),
        frequency,
      }));

    // Calculate recognition accuracy
    const _accuracySum = this._recognitionAccuracy.reduce(
      (sum, entry) => sum + (entry.correct ? 1 : 0),
      0,
    );
    const _recognitionAccuracy =
      this._recognitionAccuracy.length > 0
        ? (_accuracySum / this._recognitionAccuracy.length) * 100
        : 0;

    // Calculate session info
    const _sessionDuration = Date.now() - this.sessionStartTime.getTime();
    const _averageSessionDuration =
      _sessionDuration / Math.max(1, this.totalModeChanges);

    return {
      totalSessions: 1, // Single session for now
      totalModeChanges: this.totalModeChanges,
      _averageSessionDuration,
      _mostUsedModes,
      _modeSequences,
      _recognitionAccuracy,
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
    const _recentHistory = this.history.slice(-10); // Last 10 mode changes
    const newPatterns: UserPattern[] = [];

    // Look for _sequences of 2-4 modes
    for (let sequenceLength = 2; sequenceLength <= 4; sequenceLength++) {
      for (let i = 0; i <= _recentHistory.length - sequenceLength; i++) {
        const _sequence = _recentHistory
          .slice(i, i + sequenceLength)
          .map((entry) => entry.mode.id);

        // Check if this pattern already exists
        const _existingPattern = this.userPatterns.find(
          (p) =>
            p._sequence.length === _sequence.length &&
            p._sequence.every((mode, _idx) => mode === _sequence[_idx]),
        );

        if (_existingPattern) {
          _existingPattern.frequency++;
          existingPattern.lastUsed = new Date();
        } else {
          newPatterns.push({
            _sequence,
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
        const _aScore =
          a.frequency * 0.7 +
          ((Date.now() - a.lastUsed.getTime()) / 86400000) * 0.3;
        const _bScore =
          b.frequency * 0.7 +
          ((Date.now() - b.lastUsed.getTime()) / 86400000) * 0.3;
        return _bScore - _aScore;
      });

      this.userPatterns = this.userPatterns.slice(0, this.config.maxPatterns);
    }

    this.emit("pattern:learned", this.userPatterns);
  }

  private async updatePatternFromFeedback(
    _userInput: string,
    modeId: string,
    wasCorrect: boolean,
  ): Promise<void> {
    // Find recent patterns that led to this mode
    const _recentModes = this.getRecentModes(3).map((entry) => entry.mode.id);

    for (const pattern of this.userPatterns) {
      if (
        pattern.sequence.length > 0 &&
        pattern.sequence[pattern.sequence.length - 1] === modeId
      ) {
        // Update success rate based on feedback
        const _currentSuccess = pattern.success;
        const _newSuccess = wasCorrect
          ? _currentSuccess * 0.9 + 0.1
          : _currentSuccess * 0.9;
        pattern.success = Math.max(0.1, Math.min(1.0, _newSuccess));
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
    this.emit("data:persist", {
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
    const _modeAnalysis = new Map<
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
      const _analysis = _modeAnalysis.get(entry.mode.id) || {
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
        const _satisfactionValue =
          entry.userFeedback === "positive"
            ? 1
            : entry.userFeedback === "negative"
              ? 0
              : 0.5;
        _analysis.satisfactionSum += _satisfactionValue;
        analysis.satisfactionCount++;
      }

      const _triggerCount = _analysis.triggers.get(entry.trigger) || 0;
      analysis.triggers.set(entry.trigger, _triggerCount + 1);

      modeAnalysis.set(entry.mode.id, _analysis);
    });

    // Convert to result format
    return Array.from(_modeAnalysis.entries()).map(([modeId, _analysis]) => ({
      modeId,
      totalUsage: analysis.usageCount,
      averageDuration:
        analysis.usageCount > 0
          ? analysis.totalDuration / analysis.usageCount
          : 0,
      userSatisfaction:
        analysis.satisfactionCount > 0
          ? analysis.satisfactionSum / analysis.satisfactionCount
          : 0.5,
      triggers: Array.from(analysis.triggers.entries()).map(
        ([type, count]) => ({ type, count }),
      ),
    }));
  }

  /**
   * Get mode recommendations based on current context
   */
  getRecommendations(currentContext: {
    time: Date;
    _recentModes: string[];
    errorState: boolean;
  }): Array<{ modeId: string; _confidence: number; reason: string }> {
    const recommendations: Array<{
      modeId: string;
      _confidence: number;
      reason: string;
    }> = [];

    // Analyze patterns for recommendations
    this.userPatterns.forEach((pattern) => {
      if (pattern.sequence.length >= 2) {
        const _lastInSequence = pattern.sequence[pattern.sequence.length - 1];
        const _patternStart = pattern.sequence.slice(0, -1);

        // Check if current context matches pattern start
        if (currentContext.recentModes.length >= _patternStart.length) {
          const _recentSlice = currentContext.recentModes.slice(
            -_patternStart.length,
          );

          if (
            _patternStart.every((mode, _idx) => mode === _recentSlice[_idx])
          ) {
            const _confidence = (pattern.frequency / 10) * pattern.success;
            recommendations.push({
              modeId: _lastInSequence,
              _confidence: Math.min(_confidence, 0.9),
              reason: `Pattern match: ${pattern.sequence.join(" → ")} (used ${pattern.frequency} times)`,
            });
          }
        }
      }
    });

    // Sort by _confidence
    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }
}
