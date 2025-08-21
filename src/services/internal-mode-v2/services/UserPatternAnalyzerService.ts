/**
 * User Pattern Analyzer Service
 * Analyzes and learns from user interaction patterns to improve routing accuracy
 */

import { BaseService, Service } from '../core';

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
  preferredLanguage: string;
  preferredCommands: Array<{ command: string; frequency: number }>;
  averageConfidence: number;
  learningTrends: {
    weeklyGrowth: number;
    accuracyImprovement: number;
    commandDiversity: number;
  };
}

export interface LearningRecommendation {
  type: 'phrase_suggestion' | 'command_mapping' | 'confidence_adjustment';
  description: string;
  impact: 'low' | 'medium' | 'high';
  data: Record<string, any>;
}

@Service({
  id: 'user-pattern-analyzer',
  name: 'UserPatternAnalyzerService',
  version: '1.0.0',
  description: 'Analyzes user patterns and provides learning recommendations',
})
export class UserPatternAnalyzerService extends BaseService {
  id = 'user-pattern-analyzer';
  version = '1.0.0';

  // In-memory storage (in production, this would be a database)
  private userPatterns: Map<string, UserPattern[]> = new Map();
  private userAnalytics: Map<string, UserAnalytics> = new Map();

  // Learning parameters
  private readonly PATTERN_RETENTION_DAYS = 30;
  private readonly MIN_PATTERNS_FOR_ANALYSIS = 5;
  private readonly CONFIDENCE_ADJUSTMENT_THRESHOLD = 0.1;

  async onInitialize(): Promise<void> {
    this.logger.info('Initializing User Pattern Analyzer Service...');

    // Load existing patterns (if any)
    await this.loadUserPatterns();
  }

  async onStart(): Promise<void> {
    this.logger.info('Starting User Pattern Analyzer Service...');

    // Start cleanup timer
    this.startCleanupTimer();

    this.emitServiceEvent('user-pattern-analyzer:started', {
      service: this.id,
      totalUsers: this.userAnalytics.size,
    });
  }

  /**
   * Record a user interaction pattern
   */
  async recordPattern(options: {
    userId: string;
    input: string;
    command: string;
    language: string;
    success: boolean;
    confidence?: number;
    context?: Record<string, any>;
  }): Promise<void> {
    const pattern: UserPattern = {
      userId: options.userId,
      input: options.input,
      command: options.command,
      language: options.language,
      success: options.success,
      confidence: options.confidence || 0.5,
      context: options.context,
      timestamp: new Date(),
    };

    // Store pattern
    const userPatterns = this.userPatterns.get(options.userId) || [];
    userPatterns.push(pattern);
    this.userPatterns.set(options.userId, userPatterns);

    // Update analytics
    await this.updateUserAnalytics(options.userId);

    // Emit pattern recorded event
    this.emitServiceEvent('pattern:recorded', {
      userId: options.userId,
      command: options.command,
      success: options.success,
    });

    this.logger.debug(`Recorded pattern for user ${options.userId}: ${options.command}`);
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(options: { userId: string }): Promise<UserAnalytics | null> {
    return this.userAnalytics.get(options.userId) || null;
  }

  /**
   * Get learning recommendations for improving the system
   */
  async getLearningRecommendations(): Promise<LearningRecommendation[]> {
    const recommendations: LearningRecommendation[] = [];

    // Analyze all user patterns for insights
    const allPatterns = Array.from(this.userPatterns.values()).flat();

    // Find commonly misunderstood phrases
    const failedPatterns = allPatterns.filter((p) => !p.success);
    const failedPhrases = this.groupByInput(failedPatterns);

    for (const [phrase, patterns] of failedPhrases.entries()) {
      if (patterns.length >= 3) {
        // Multiple failures for same phrase
        recommendations.push({
          type: 'phrase_suggestion',
          description: `Add mapping for commonly failed phrase: "${phrase}"`,
          impact: 'high',
          data: {
            phrase,
            failureCount: patterns.length,
            intendedCommands: patterns.map((p) => p.command),
          },
        });
      }
    }

    // Find confidence adjustment opportunities
    const lowConfidenceSuccesses = allPatterns.filter((p) => p.success && p.confidence < 0.7);

    if (lowConfidenceSuccesses.length > 10) {
      recommendations.push({
        type: 'confidence_adjustment',
        description: 'Consider lowering confidence threshold for better user experience',
        impact: 'medium',
        data: {
          successfulLowConfidence: lowConfidenceSuccesses.length,
          averageConfidence:
            lowConfidenceSuccesses.reduce((sum, p) => sum + p.confidence, 0) /
            lowConfidenceSuccesses.length,
        },
      });
    }

    // Language-specific command mappings
    const languageStats = this.analyzeLanguageUsage(allPatterns);
    for (const [language, stats] of languageStats.entries()) {
      if (stats.successRate < 0.8 && stats.count > 10) {
        recommendations.push({
          type: 'command_mapping',
          description: `Improve ${language} command mappings (success rate: ${(stats.successRate * 100).toFixed(1)}%)`,
          impact: 'high',
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
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });
  }

  /**
   * Get personalized recommendations for a specific user
   */
  async getPersonalizedRecommendations(options: { userId: string }): Promise<{
    suggestedCommands: string[];
    preferredLanguage: string;
    confidenceBoosts: Record<string, number>;
  }> {
    const userPatterns = this.userPatterns.get(options.userId) || [];
    const analytics = this.userAnalytics.get(options.userId);

    if (!analytics || userPatterns.length < this.MIN_PATTERNS_FOR_ANALYSIS) {
      return {
        suggestedCommands: [],
        preferredLanguage: 'english',
        confidenceBoosts: {},
      };
    }

    // Analyze user's command preferences
    const commandFrequency = this.calculateCommandFrequency(userPatterns);
    const suggestedCommands = Object.entries(commandFrequency)
      .filter(([_, freq]) => freq > 2)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([cmd, _]) => cmd);

    // Calculate confidence boosts based on user success patterns
    const confidenceBoosts: Record<string, number> = {};
    for (const [command, patterns] of this.groupByCommand(userPatterns).entries()) {
      const successfulPatterns = patterns.filter((p) => p.success);
      if (successfulPatterns.length > 0) {
        const avgConfidence =
          successfulPatterns.reduce((sum, p) => sum + p.confidence, 0) / successfulPatterns.length;
        if (avgConfidence < 0.8) {
          confidenceBoosts[command] = Math.min(0.2, 0.8 - avgConfidence);
        }
      }
    }

    return {
      suggestedCommands,
      preferredLanguage: analytics.preferredLanguage,
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
    const allPatterns = Array.from(this.userPatterns.values()).flat();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPatterns = allPatterns.filter((p) => p.timestamp > oneWeekAgo);

    const commandUsage = this.calculateCommandFrequency(allPatterns);
    const languageDistribution: Record<string, number> = {};

    for (const pattern of allPatterns) {
      languageDistribution[pattern.language] = (languageDistribution[pattern.language] || 0) + 1;
    }

    const uniqueRecentUsers = new Set(recentPatterns.map((p) => p.userId)).size;

    return {
      totalUsers: this.userAnalytics.size,
      totalInteractions: allPatterns.length,
      overallSuccessRate:
        allPatterns.length > 0
          ? allPatterns.filter((p) => p.success).length / allPatterns.length
          : 0,
      topCommands: Object.entries(commandUsage)
        .sort(([_, a], [__, b]) => b - a)
        .slice(0, 10)
        .map(([command, usage]) => ({ command, usage })),
      languageDistribution,
      trendsLastWeek: {
        newUsers: uniqueRecentUsers,
        totalInteractions: recentPatterns.length,
        averageSuccessRate:
          recentPatterns.length > 0
            ? recentPatterns.filter((p) => p.success).length / recentPatterns.length
            : 0,
      },
    };
  }

  /**
   * Update analytics for a specific user
   */
  private async updateUserAnalytics(userId: string): Promise<void> {
    const userPatterns = this.userPatterns.get(userId) || [];

    if (userPatterns.length === 0) return;

    const successfulPatterns = userPatterns.filter((p) => p.success);
    const commandFrequency = this.calculateCommandFrequency(userPatterns);
    const languageFrequency: Record<string, number> = {};

    for (const pattern of userPatterns) {
      languageFrequency[pattern.language] = (languageFrequency[pattern.language] || 0) + 1;
    }

    const preferredLanguage =
      Object.entries(languageFrequency).sort(([_, a], [__, b]) => b - a)[0]?.[0] || 'english';

    const preferredCommands = Object.entries(commandFrequency)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([command, frequency]) => ({ command, frequency }));

    const analytics: UserAnalytics = {
      userId,
      totalInteractions: userPatterns.length,
      successRate: successfulPatterns.length / userPatterns.length,
      preferredLanguage,
      preferredCommands,
      averageConfidence:
        userPatterns.reduce((sum, p) => sum + p.confidence, 0) / userPatterns.length,
      learningTrends: {
        weeklyGrowth: this.calculateWeeklyGrowth(userPatterns),
        accuracyImprovement: this.calculateAccuracyImprovement(userPatterns),
        commandDiversity: Object.keys(commandFrequency).length,
      },
    };

    this.userAnalytics.set(userId, analytics);
  }

  /**
   * Load user patterns from persistent storage
   */
  private async loadUserPatterns(): Promise<void> {
    // In production, this would load from database
    this.logger.info('User patterns loaded from storage');
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
    const cutoffDate = new Date(Date.now() - this.PATTERN_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    for (const [userId, patterns] of this.userPatterns.entries()) {
      const filteredPatterns = patterns.filter((p) => p.timestamp > cutoffDate);
      this.userPatterns.set(userId, filteredPatterns);
    }

    this.logger.info('Cleaned up old user patterns');
  }

  /**
   * Helper methods for data analysis
   */
  private groupByInput(patterns: UserPattern[]): Map<string, UserPattern[]> {
    const groups = new Map<string, UserPattern[]>();
    for (const pattern of patterns) {
      const existing = groups.get(pattern.input) || [];
      existing.push(pattern);
      groups.set(pattern.input, existing);
    }
    return groups;
  }

  private groupByCommand(patterns: UserPattern[]): Map<string, UserPattern[]> {
    const groups = new Map<string, UserPattern[]>();
    for (const pattern of patterns) {
      const existing = groups.get(pattern.command) || [];
      existing.push(pattern);
      groups.set(pattern.command, existing);
    }
    return groups;
  }

  private calculateCommandFrequency(patterns: UserPattern[]): Record<string, number> {
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
    const languageStats = new Map();

    for (const pattern of patterns) {
      const stats = languageStats.get(pattern.language) || {
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

      languageStats.set(pattern.language, stats);
    }

    // Convert to final format
    const result = new Map();
    for (const [language, stats] of languageStats.entries()) {
      result.set(language, {
        count: stats.count,
        successRate: stats.successes / stats.count,
        commonFailures: stats.failures.slice(0, 5), // Top 5 failures
      });
    }

    return result;
  }

  private calculateWeeklyGrowth(patterns: UserPattern[]): number {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentPatterns = patterns.filter((p) => p.timestamp > oneWeekAgo);
    return recentPatterns.length;
  }

  private calculateAccuracyImprovement(patterns: UserPattern[]): number {
    if (patterns.length < 10) return 0;

    const sortedPatterns = patterns.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const firstHalf = sortedPatterns.slice(0, Math.floor(patterns.length / 2));
    const secondHalf = sortedPatterns.slice(Math.floor(patterns.length / 2));

    const firstHalfSuccess = firstHalf.filter((p) => p.success).length / firstHalf.length;
    const secondHalfSuccess = secondHalf.filter((p) => p.success).length / secondHalf.length;

    return secondHalfSuccess - firstHalfSuccess;
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
