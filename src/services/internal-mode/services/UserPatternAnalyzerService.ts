/**
 * User Pattern Analyzer Service
 * Analyzes and learns from user interaction patterns to improve routing accuracy
 */

import { BaseService, Service } from "../core";

export interface UserPattern {
  userId: string;
  input: string;
  command: string;
  language: string;
  timestamp: Date;
  success: boolean;
  confidence: number;
  context?: Record<string, any>;
}

export interface UserAnalytics {
  userId: string;
  totalInteractions: number;
  successRate: number;
  _preferredLanguage: string;
  _preferredCommands: Array<{ command: string; frequency: number }>;
  averageConfidence: number;
  learningTrends: {
    weeklyGrowth: number;
    accuracyImprovement: number;
    commandDiversity: number;
  };
}

export interface LearningRecommendation {
  type: "phrase_suggestion" | "command_mapping" | "confidence_adjustment";
  description: string;
  impact: "low" | "medium" | "high";
  data: Record<string, any>;
}

@Service({
  id: "user-pattern-analyzer",
  name: "UserPatternAnalyzerService",
  version: "1.0.0",
  description: "Analyzes user patterns and provides learning recommendations",
})
export class UserPatternAnalyzerService extends BaseService {
  id = "user-pattern-analyzer";
  version = "1.0.0";

  // In-memory storage (in production, this would be a database)
  private _userPatterns: Map<string, UserPattern[]> = new Map();
  private userAnalytics: Map<string, UserAnalytics> = new Map();

  // Learning parameters
  private readonly PATTERN_RETENTION_DAYS = 30;
  private readonly MIN_PATTERNS_FOR_ANALYSIS = 5;
  private readonly CONFIDENCE_ADJUSTMENT_THRESHOLD = 0.1;

  async onInitialize(): Promise<void> {
    this.logger.info("Initializing User Pattern Analyzer Service...");

    // Load _existing patterns (if any)
    await this.loadUserPatterns();
  }

  async onStart(): Promise<void> {
    this.logger.info("Starting User Pattern Analyzer Service...");

    // Start cleanup timer
    this.startCleanupTimer();

    this.emitServiceEvent("user-pattern-analyzer:started", {
      service: this.id,
      totalUsers: this.userAnalytics.size,
    });
  }

  /**
   * Record a user interaction pattern
   */
  async recordPattern(_options: {
    userId: string;
    input: string;
    command: string;
    language: string;
    success: boolean;
    confidence?: number;
    context?: Record<string, any>;
  }): Promise<void> {
    const pattern: UserPattern = {
      userId: _options.userId,
      input: _options.input,
      command: _options.command,
      language: _options.language,
      success: _options.success,
      confidence: _options.confidence || 0.5,
      context: _options.context,
      timestamp: new Date(),
    };

    // Store pattern
    const _userPatterns = this._userPatterns.get(_options.userId) || [];
    userPatterns.push(pattern);
    this._userPatterns.set(_options.userId, _userPatterns);

    // Update _analytics
    await this.updateUserAnalytics(_options.userId);

    // Emit pattern recorded event
    this.emitServiceEvent("pattern:recorded", {
      userId: _options.userId,
      command: _options.command,
      success: _options.success,
    });

    this.logger.debug(
      `Recorded pattern for user ${_options.userId}: ${_options.command}`,
    );
  }

  /**
   * Get user _analytics
   */
  async getUserAnalytics(options: {
    userId: string;
  }): Promise<UserAnalytics | null> {
    return this.userAnalytics.get(options.userId) || null;
  }

  /**
   * Get learning recommendations for improving the system
   */
  async getLearningRecommendations(): Promise<LearningRecommendation[]> {
    const recommendations: LearningRecommendation[] = [];

    // Analyze all user patterns for insights
    const _allPatterns = Array.from(this.userPatterns.values()).flat();

    // Find commonly misunderstood phrases
    const _failedPatterns = _allPatterns.filter((p) => !p.success);
    const _failedPhrases = this.groupByInput(_failedPatterns);

    for (const [phrase, patterns] of _failedPhrases.entries()) {
      if (patterns.length >= 3) {
        // Multiple failures for same phrase
        recommendations.push({
          type: "phrase_suggestion",
          description: `Add mapping for commonly failed phrase: "${phrase}"`,
          impact: "high",
          data: {
            phrase,
            failureCount: patterns.length,
            intendedCommands: patterns.map((p) => p.command),
          },
        });
      }
    }

    // Find confidence adjustment opportunities
    const _lowConfidenceSuccesses = _allPatterns.filter(
      (p) => p.success && p.confidence < 0.7,
    );

    if (_lowConfidenceSuccesses.length > 10) {
      recommendations.push({
        type: "confidence_adjustment",
        description:
          "Consider lowering confidence threshold for better user experience",
        impact: "medium",
        data: {
          successfulLowConfidence: _lowConfidenceSuccesses.length,
          averageConfidence:
            _lowConfidenceSuccesses.reduce((sum, p) => sum + p.confidence, 0) /
            lowConfidenceSuccesses.length,
        },
      });
    }

    // Language-specific command mappings
    const _languageStats = this.analyzeLanguageUsage(_allPatterns);
    for (const [language, _stats] of _languageStats.entries()) {
      if (stats.successRate < 0.8 && stats.count > 10) {
        recommendations.push({
          type: "command_mapping",
          description: `Improve ${language} command mappings (success rate: ${(stats.successRate * 100).toFixed(1)}%)`,
          impact: "high",
          data: {
            language,
            successRate: stats.successRate,
            totalInteractions: stats.count,
            commonFailures: stats.commonFailures,
          },
        });
      }
    }

    return recommendations.sort((a, b) => {
      const _impactOrder = { high: 3, medium: 2, low: 1 };
      return _impactOrder[b.impact] - _impactOrder[a.impact];
    });
  }

  /**
   * Get personalized recommendations for a specific user
   */
  async getPersonalizedRecommendations(options: { userId: string }): Promise<{
    _suggestedCommands: string[];
    _preferredLanguage: string;
    confidenceBoosts: Record<string, number>;
  }> {
    const _userPatterns = this._userPatterns.get(options.userId) || [];
    const _analytics = this.userAnalytics.get(options.userId);

    if (!_analytics || _userPatterns.length < this.MIN_PATTERNS_FOR_ANALYSIS) {
      return {
        _suggestedCommands: [],
        _preferredLanguage: "english",
        confidenceBoosts: Record<string, any>,
      };
    }

    // Analyze user's command preferences
    const _commandFrequency = this.calculateCommandFrequency(_userPatterns);
    const _suggestedCommands = Object.entries(_commandFrequency)
      .filter(([_, freq]) => freq > 2)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([cmd, _]) => cmd);

    // Calculate confidence boosts based on user success patterns
    const confidenceBoosts: Record<string, number> = {};
    for (const [command, patterns] of this.groupByCommand(
      _userPatterns,
    ).entries()) {
      const _successfulPatterns = patterns.filter((p) => p.success);
      if (_successfulPatterns.length > 0) {
        const _avgConfidence =
          _successfulPatterns.reduce((sum, p) => sum + p.confidence, 0) /
          _successfulPatterns.length;
        if (_avgConfidence < 0.8) {
          confidenceBoosts[command] = Math.min(0.2, 0.8 - _avgConfidence);
        }
      }
    }

    return {
      _suggestedCommands,
      _preferredLanguage: _analytics.preferredLanguage,
      confidenceBoosts,
    };
  }

  /**
   * Get system-wide usage statistics
   */
  async getSystemStats(): Promise<{
    totalUsers: number;
    totalInteractions: number;
    overallSuccessRate: number;
    topCommands: Array<{ command: string; usage: number }>;
    languageDistribution: Record<string, number>;
    trendsLastWeek: {
      newUsers: number;
      totalInteractions: number;
      averageSuccessRate: number;
    };
  }> {
    const _allPatterns = Array.from(this.userPatterns.values()).flat();
    const _oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const _recentPatterns = _allPatterns.filter(
      (p) => p.timestamp > _oneWeekAgo,
    );

    const _commandUsage = this.calculateCommandFrequency(_allPatterns);
    const languageDistribution: Record<string, number> = {};

    for (const pattern of _allPatterns) {
      languageDistribution[pattern.language] =
        (languageDistribution[pattern.language] || 0) + 1;
    }

    const _uniqueRecentUsers = new Set(_recentPatterns.map((p) => p.userId))
      .size;

    return {
      totalUsers: this.userAnalytics.size,
      totalInteractions: _allPatterns.length,
      overallSuccessRate:
        allPatterns.length > 0
          ? _allPatterns.filter((p) => p.success).length / _allPatterns.length
          : 0,
      topCommands: Object.entries(_commandUsage)
        .sort(([_, a], [__, b]) => b - a)
        .slice(0, 10)
        .map(([command, usage]) => ({ command, usage })),
      languageDistribution,
      trendsLastWeek: {
        newUsers: _uniqueRecentUsers,
        totalInteractions: _recentPatterns.length,
        averageSuccessRate:
          recentPatterns.length > 0
            ? _recentPatterns.filter((p) => p.success).length /
              _recentPatterns.length
            : 0,
      },
    };
  }

  /**
   * Update _analytics for a specific user
   */
  private async updateUserAnalytics(userId: string): Promise<void> {
    const _userPatterns = this._userPatterns.get(userId) || [];

    if (_userPatterns.length === 0) {
      return;
    }

    const _successfulPatterns = _userPatterns.filter((p) => p.success);
    const _commandFrequency = this.calculateCommandFrequency(_userPatterns);
    const languageFrequency: Record<string, number> = {};

    for (const pattern of _userPatterns) {
      languageFrequency[pattern.language] =
        (languageFrequency[pattern.language] || 0) + 1;
    }

    const _preferredLanguage =
      Object.entries(languageFrequency).sort(
        ([_, a], [__, b]) => b - a,
      )[0]?.[0] || "english";

    const _preferredCommands = Object.entries(_commandFrequency)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([command, frequency]) => ({ command, frequency }));

    const _analytics: UserAnalytics = {
      userId,
      totalInteractions: _userPatterns.length,
      successRate: _successfulPatterns.length / _userPatterns.length,
      _preferredLanguage,
      _preferredCommands,
      averageConfidence:
        _userPatterns.reduce((sum, p) => sum + p.confidence, 0) /
        _userPatterns.length,
      learningTrends: {
        weeklyGrowth: this.calculateWeeklyGrowth(_userPatterns),
        accuracyImprovement: this.calculateAccuracyImprovement(_userPatterns),
        commandDiversity: Object.keys(_commandFrequency).length,
      },
    };

    this.userAnalytics.set(userId, _analytics);
  }

  /**
   * Load user patterns from persistent storage
   */
  private async loadUserPatterns(): Promise<void> {
    // In production, this would load from database
    this.logger.info("User patterns loaded from storage");
  }

  /**
   * Start cleanup timer to remove old patterns
   */
  private startCleanupTimer(): void {
    setInterval(
      () => {
        this.cleanupOldPatterns();
      },
      24 * 60 * 60 * 1000,
    ); // Run daily
  }

  /**
   * Remove patterns older than retention period
   */
  private cleanupOldPatterns(): void {
    const _cutoffDate = new Date(
      Date.now() - this.PATTERN_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    for (const [userId, patterns] of this.userPatterns.entries()) {
      const _filteredPatterns = patterns.filter(
        (p) => p.timestamp > _cutoffDate,
      );
      this.userPatterns.set(userId, _filteredPatterns);
    }

    this.logger.info("Cleaned up old user patterns");
  }

  /**
   * Helper methods for data analysis
   */
  private groupByInput(patterns: UserPattern[]): Map<string, UserPattern[]> {
    const _groups = new Map<string, UserPattern[]>();
    for (const pattern of patterns) {
      const _existing = _groups.get(pattern.input) || [];
      existing.push(pattern);
      groups.set(pattern.input, _existing);
    }
    return _groups;
  }

  private groupByCommand(patterns: UserPattern[]): Map<string, UserPattern[]> {
    const _groups = new Map<string, UserPattern[]>();
    for (const pattern of patterns) {
      const _existing = _groups.get(pattern.command) || [];
      existing.push(pattern);
      groups.set(pattern.command, _existing);
    }
    return _groups;
  }

  private calculateCommandFrequency(
    patterns: UserPattern[],
  ): Record<string, number> {
    const frequency: Record<string, number> = {};
    for (const pattern of patterns) {
      frequency[pattern.command] = (frequency[pattern.command] || 0) + 1;
    }
    return frequency;
  }

  private analyzeLanguageUsage(patterns: UserPattern[]): Map<
    string,
    {
      count: number;
      successRate: number;
      commonFailures: string[];
    }
  > {
    const _languageStats = new Map();

    for (const pattern of patterns) {
      const _stats = _languageStats.get(pattern.language) || {
        count: 0,
        successes: 0,
        failures: [],
      };

      stats.count++;
      if (pattern.success) {
        stats.successes++;
      } else {
        stats.failures.push(pattern.input);
      }

      languageStats.set(pattern.language, _stats);
    }

    // Convert to final format
    const _result = new Map();
    for (const [language, _stats] of _languageStats.entries()) {
      result.set(language, {
        count: _stats.count,
        successRate: _stats.successes / _stats.count,
        commonFailures: _stats.failures.slice(0, 5), // Top 5 failures
      });
    }

    return _result;
  }

  private calculateWeeklyGrowth(patterns: UserPattern[]): number {
    const _oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const _recentPatterns = patterns.filter((p) => p.timestamp > _oneWeekAgo);
    return _recentPatterns.length;
  }

  private calculateAccuracyImprovement(patterns: UserPattern[]): number {
    if (patterns.length < 10) {
      return 0;
    }

    const _sortedPatterns = patterns.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    const _firstHalf = _sortedPatterns.slice(
      0,
      Math.floor(patterns.length / 2),
    );
    const _secondHalf = _sortedPatterns.slice(Math.floor(patterns.length / 2));

    const _firstHalfSuccess =
      _firstHalf.filter((p) => p.success).length / _firstHalf.length;
    const _secondHalfSuccess =
      _secondHalf.filter((p) => p.success).length / _secondHalf.length;

    return _secondHalfSuccess - _firstHalfSuccess;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      totalUsers: this.userAnalytics.size,
      totalPatterns: Array.from(this.userPatterns.values()).reduce(
        (sum, patterns) => sum + patterns.length,
        0,
      ),
      retentionDays: this.PATTERN_RETENTION_DAYS,
      minPatternsForAnalysis: this.MIN_PATTERNS_FOR_ANALYSIS,
    };
  }
}
