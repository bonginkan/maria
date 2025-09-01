/**
 * Learning Engine Service
 * ユーザーの使用パターンを学習し、個人に最適化された体験を提供
 * Phase 3: Adaptive Learning System
 */
// Complex type interactions - gradually adding types

import { EventEmitter } from "node:events";
import { logger } from "../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export interface CommandParameter {
  name: string;
  value: string | number | boolean;
  type?: "string" | "number" | "boolean" | "array" | "object";
}

export interface UsagePattern {
  command: string;
  frequency: number;
  lastUsed: Date;
  averageExecutionTime: number;
  successRate: number;
  contexts: string[];
  parameters: CommandParameter[];
  timeOfDay: number[]; // Hour distribution
  errorPatterns: ErrorPattern[];
}

export interface ErrorPattern {
  _error: string;
  count: number;
  lastOccurred: Date;
  resolution?: string;
  autoFixAvailable: boolean;
}

export interface UserProfile {
  userId: string;
  createdAt: Date;
  lastActive: Date;
  _totalCommands: number;
  favoriteCommands: string[];
  preferredLanguage: string;
  codingStyle: CodingStyle;
  productivityMetrics: ProductivityMetrics;
  learningProgress: LearningProgress;
}

export interface CodingStyle {
  indentation: "tabs" | "spaces";
  indentSize: number;
  quotes: "single" | "double";
  semicolons: boolean;
  lineEndings: "lf" | "crlf";
  namingConvention: "camelCase" | "snake_case" | "kebab-case";
  commentStyle: "inline" | "block" | "jsdoc";
  preferredFrameworks: string[];
  preferredLibraries: string[];
}

export interface ProductivityMetrics {
  peakHours: number[];
  averageSessionDuration: number;
  commandsPerSession: number;
  errorRate: number;
  completionRate: number;
  timeToResolution: number;
  mostProductiveDay: string;
}

export interface LearningProgress {
  level: number;
  experience: number;
  achievements: Achievement[];
  skills: Map<string, SkillLevel>;
  tutorials: Map<string, boolean>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt: Date;
  icon: string;
}

export interface SkillLevel {
  name: string;
  level: number;
  experience: number;
  lastPracticed: Date;
}

export interface PredictedAction {
  command: string;
  confidence: number;
  reasoning: string;
  parameters?: Record<string, unknown>;
}

export class LearningEngine extends EventEmitter {
  private usagePatterns: Map<string, UsagePattern> = new Map();
  private userProfile: UserProfile;
  private errorHistory: ErrorPattern[] = [];
  private sessionData: SessionData[] = [];
  private dataPath: string;
  private saveInterval: NodeJS.Timeout | null = null;

  constructor(_userId: string = "default") {
    super();

    this.dataPath = path.join(os.homedir(), ".maria", "learning");
    this.userProfile = this.createDefaultProfile(_userId);

    this.initialize();
  }

  /**
   * Initialize learning engine
   */
  //  - Complex async type handling
  private async initialize() {
    try {
      // Create _data directory
      await fs.mkdir(this.dataPath, { recursive: true });

      // Load existing _data
      await this.loadData();

      // Start auto-save interval
      this.saveInterval = setInterval(() => {
        this.saveData().catch((_error) => {
          logger.error("Failed to auto-save learning _data:", _error);
        });
      }, 60000); // Save every minute

      logger.info("Learning engine initialized");
    } catch (_error: unknown) {
      logger.error("Failed to initialize learning engine:", _error);
    }
  }

  /**
   * Create default user profile
   */
  //  - Complex async type handling
  private createDefaultProfile(userId: string): UserProfile {
    return {
      userId,
      createdAt: new Date(),
      lastActive: new Date(),
      _totalCommands: 0,
      favoriteCommands: [],
      preferredLanguage: "en",
      codingStyle: {
        indentation: "spaces",
        indentSize: 2,
        quotes: "single",
        semicolons: true,
        lineEndings: "lf",
        namingConvention: "camelCase",
        commentStyle: "jsdoc",
        preferredFrameworks: [],
        preferredLibraries: [],
      },
      productivityMetrics: {
        peakHours: [],
        averageSessionDuration: 0,
        commandsPerSession: 0,
        errorRate: 0,
        completionRate: 0,
        timeToResolution: 0,
        mostProductiveDay: "Monday",
      },
      learningProgress: {
        level: 1,
        experience: 0,
        achievements: [],
        skills: new Map(),
        tutorials: new Map(),
      },
    };
  }

  /**
   * Record command usage
   */
  //  - Complex async type handling
  recordUsage(_command: string, context: CommandContext): void {
    const _pattern = this.usagePatterns.get(_command) || {
      command: "",
      frequency: 0,
      lastUsed: new Date(),
      averageExecutionTime: 0,
      successRate: 1,
      contexts: [],
      parameters: [],
      timeOfDay: new Array(24).fill(0),
      errorPatterns: [],
    };

    // Update frequency
    _pattern.frequency++;
    _pattern.lastUsed = new Date();

    // Update execution time
    pattern.averageExecutionTime =
      (_pattern.averageExecutionTime * (_pattern.frequency - 1) +
        context.executionTime) /
      pattern.frequency;

    // Update success rate
    if (!context.success) {
      _pattern.successRate =
        (_pattern.successRate * (_pattern.frequency - 1) + 0) /
        _pattern.frequency;
    } else {
      _pattern.successRate =
        (_pattern.successRate * (_pattern.frequency - 1) + 1) /
        _pattern.frequency;
    }

    // Record context
    if (context.context && !_pattern.contexts.includes(context.context)) {
      pattern.contexts.push(context.context);
    }

    // Record parameters
    if (context.parameters) {
      pattern.parameters.push(context.parameters);
    }

    // Update time of day distribution
    const _hour = new Date().getHours();
    pattern.timeOfDay[_hour]++;

    // Record _error if any
    if (context.error) {
      this.recordError(_command, context.error);
    }

    this.usagePatterns.set(_command, _pattern);

    // Update user profile
    this.userProfile.totalCommands++;
    this.userProfile.lastActive = new Date();

    // Update favorite commands
    this.updateFavoriteCommands();

    // Check for achievements
    this.checkAchievements(_command, context);

    // Emit usage event
    this.emit("usage:recorded", { _command, _pattern, context });
  }

  /**
   * Record _error _pattern
   */
  //  - Complex async type handling
  private recordError(_command: string, _error: string): void {
    const _existingError = this.errorHistory.find((e) => e.error === _error);

    if (_existingError) {
      _existingError.count++;
      existingError.lastOccurred = new Date();
    } else {
      this.errorHistory.push({
        _error,
        count: 1,
        lastOccurred: new Date(),
        autoFixAvailable: this.checkAutoFix(_error),
      });
    }

    // Add to command's _error patterns
    const _pattern = this.usagePatterns.get(_command);
    if (_pattern) {
      const _cmdError = _pattern.errorPatterns.find((e) => e.error === _error);
      if (_cmdError) {
        _cmdError.count++;
        cmdError.lastOccurred = new Date();
      } else {
        pattern.errorPatterns.push({
          _error,
          count: 1,
          lastOccurred: new Date(),
          autoFixAvailable: this.checkAutoFix(_error),
        });
      }
    }

    // Detect frequent errors
    if (this.errorHistory.length > 10) {
      const _frequentErrors = this.errorHistory
        .filter((e) => e.count > 3)
        .sort((a, b) => b.count - a.count);

      if (_frequentErrors.length > 0) {
        this.emit("frequent:errors", _frequentErrors);
      }
    }
  }

  /**
   * Check if auto-fix is available for _error
   */
  //  - Complex async type handling
  private checkAutoFix(_error: string): boolean {
    const _autoFixablePatterns = [
      /module not found/i,
      /cannot find/i,
      /undefined variable/i,
      /syntax _error/i,
      /type _error/i,
    ];

    return _autoFixablePatterns.some((_pattern) => _pattern.test(_error));
  }

  /**
   * Update favorite commands based on usage
   */
  //  - Complex async type handling
  private updateFavoriteCommands(): void {
    const _sorted = Array.from(this.usagePatterns.entries())
      .sort((a, b) => b[1].frequency - a[1].frequency)
      .slice(0, 10)
      .map(([cmd]) => cmd);

    this.userProfile.favoriteCommands = _sorted;
  }

  /**
   * Predict next action
   */
  //  - Complex async type handling
  predictNextAction(currentContext: string): PredictedAction[] {
    const _predictions: PredictedAction[] = [];
    const _hour = new Date().getHours();

    // Analyze patterns for current context
    for (const [command, _pattern] of this.usagePatterns) {
      let confidence = 0;
      const reasons: string[] = [];

      // Context matching
      if (pattern.contexts.includes(currentContext)) {
        confidence += 0.3;
        reasons.push("Context match");
      }

      // Time of day matching
      const _timeScore =
        pattern.timeOfDay[_hour] / Math.max(...pattern.timeOfDay);
      if (_timeScore > 0.5) {
        confidence += _timeScore * 0.2;
        reasons.push("Time _pattern match");
      }

      // Frequency score
      const _freqScore = Math.min(pattern.frequency / 100, 1);
      confidence += _freqScore * 0.2;
      if (_freqScore > 0.5) {
        reasons.push("Frequently used");
      }

      // Recency score
      const _daysSinceUse =
        (Date.now() - pattern.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (_daysSinceUse < 1) {
        confidence += 0.2;
        reasons.push("Recently used");
      } else if (_daysSinceUse < 7) {
        confidence += 0.1;
      }

      // Success rate factor
      confidence *= pattern.successRate;

      if (confidence > 0.3) {
        predictions.push({
          command,
          confidence,
          reasoning: reasons.join(", "),
          parameters: this.predictParameters(_pattern),
        });
      }
    }

    // Sort by confidence
    predictions.sort((a, b) => b.confidence - a.confidence);

    return _predictions.slice(0, 5);
  }

  /**
   * Predict parameters for command
   */
  //  - Complex async type handling
  private predictParameters(
    _pattern: UsagePattern,
  ): Record<string, unknown> | undefined {
    if (_pattern.parameters.length === 0) {
      return undefined;
    }

    // Find most common parameters
    const _paramCounts = new Map<string, number>();

    for (const params of _pattern.parameters) {
      const _key = JSON.stringify(params);
      _paramCounts.set(_key, (_paramCounts.get(_key) || 0) + 1);
    }

    // Get most common parameter set
    const _mostCommon = Array.from(_paramCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];

    if (_mostCommon) {
      return JSON.parse(_mostCommon[0]) as Record<string, unknown>;
    }

    return undefined;
  }

  /**
   * Get personalized suggestions
   */
  //  - Complex async type handling
  getSuggestions(context: string): string[] {
    const _predictions = this.predictNextAction(context);
    return _predictions.map((p) => p.command);
  }

  /**
   * Learn from user feedback
   */
  //  - Complex async type handling
  learnFromFeedback(_command: string, feedback: UserFeedback): void {
    const _pattern = this.usagePatterns.get(_command);
    if (!_pattern) {
      return;
    }

    if (feedback.wasHelpful) {
      // Increase weight for this command
      pattern.frequency += 0.5;
    } else {
      // Decrease success rate slightly
      pattern.successRate *= 0.95;
    }

    // Store feedback for future analysis
    this.emit("feedback:received", { _command, feedback });
  }

  /**
   * Check and unlock achievements
   */
  //  - Complex async type handling
  private checkAchievements(_command: string, _context: CommandContext): void {
    const achievements: Achievement[] = [];

    // Check various achievement conditions
    if (this.userProfile.totalCommands === 100) {
      achievements.push({
        id: "century",
        name: "Century",
        description: "Execute 100 commands",
        unlockedAt: new Date(),
        icon: "💯",
      });
    }

    if (this.userProfile.totalCommands === 1000) {
      achievements.push({
        id: "veteran",
        name: "Veteran",
        description: "Execute 1000 commands",
        unlockedAt: new Date(),
        icon: "🎖️",
      });
    }

    // Check _error-free streak
    const _recentPatterns = Array.from(this.usagePatterns.values()).slice(-10);
    if (_recentPatterns.every((p) => p.successRate === 1)) {
      achievements.push({
        id: "flawless",
        name: "Flawless",
        description: "10 commands without errors",
        unlockedAt: new Date(),
        icon: "✨",
      });
    }

    // Add new achievements
    for (const achievement of achievements) {
      if (
        !this.userProfile.learningProgress.achievements.find(
          (a) => a.id === achievement.id,
        )
      ) {
        this.userProfile.learningProgress.achievements.push(achievement);
        this.emit("achievement:unlocked", achievement);
      }
    }
  }

  /**
   * Get productivity insights
   */
  //  - Complex async type handling
  getProductivityInsights(): ProductivityInsights {
    const insights: ProductivityInsights = {
      peakHour: 0,
      mostUsedCommand: "",
      errorRate: 0,
      suggestions: [],
      trends: [],
    };

    // Calculate peak _hour
    const _hourlyUsage = new Array(24).fill(0);
    for (const _pattern of this.usagePatterns.values()) {
      for (let i = 0; i < 24; i++) {
        _hourlyUsage[i] += _pattern.timeOfDay[i];
      }
    }
    insights.peakHour = _hourlyUsage.indexOf(Math.max(..._hourlyUsage));

    // Most used command
    const [mostUsed] = Array.from(this.usagePatterns.entries()).sort(
      (a, b) => b[1].frequency - a[1].frequency,
    );
    if (mostUsed) {
      insights.mostUsedCommand = mostUsed[0];
    }

    // Calculate _error rate
    const _totalCommands = Array.from(this.usagePatterns.values()).reduce(
      (sum, p) => sum + p.frequency,
      0,
    );
    const _totalErrors = this.errorHistory.reduce((sum, e) => sum + e.count, 0);
    insights.errorRate = _totalCommands > 0 ? _totalErrors / _totalCommands : 0;

    // Generate suggestions
    if (insights.errorRate > 0.2) {
      insights.suggestions.push(
        "Consider reviewing _error patterns to improve success rate",
      );
    }

    if (insights.peakHour >= 22 || insights.peakHour <= 2) {
      insights.suggestions.push(
        "Late night coding detected - ensure adequate rest",
      );
    }

    // Detect trends
    const _recentUsage = this.sessionData.slice(-7);
    if (_recentUsage.length >= 7) {
      const _trend = this.detectTrend(_recentUsage.map((s) => s.commandCount));
      insights.trends.push(_trend);
    }

    return insights;
  }

  /**
   * Detect usage _trend
   */
  //  - Complex async type handling
  private detectTrend(values: number[]): string {
    const _avg = values.reduce((a, b) => a + b, 0) / values.length;
    const _recent = values.slice(-3).reduce((a, b) => a + b, 0) / 3;

    if (_recent > _avg * 1.2) {
      return "Increasing productivity 📈";
    }
    if (_recent < _avg * 0.8) {
      return "Decreasing activity 📉";
    }
    return "Stable usage _pattern ➡️";
  }

  /**
   * Save learning _data
   */
  //  - Complex async type handling
  async saveData(): Promise<void> {
    try {
      const _data = {
        userProfile: this.userProfile,
        usagePatterns: Array.from(this.usagePatterns.entries()),
        errorHistory: this.errorHistory,
        sessionData: this.sessionData,
      };

      const _filePath = path.join(this.dataPath, "learning-data.json");
      await fs.writeFile(_filePath, JSON.stringify(_data, null, 2));

      logger.debug("Learning _data saved");
    } catch (_error: unknown) {
      logger.error("Failed to save learning _data:", _error);
    }
  }

  /**
   * Load learning _data
   */
  //  - Complex async type handling
  async loadData(): Promise<void> {
    try {
      const _filePath = path.join(this.dataPath, "learning-data.json");
      const _data = await fs.readFile(_filePath, "utf8");
      const _parsed = JSON.parse(_data) as Record<string, unknown>;

      if (_parsed.userProfile) {
        this.userProfile = {
          ..._parsed.userProfile,
          createdAt: new Date(_parsed.userProfile.createdAt),
          lastActive: new Date(_parsed.userProfile.lastActive),
        };
      }

      if (_parsed.usagePatterns) {
        this.usagePatterns = new Map(_parsed.usagePatterns);
      }

      if (_parsed.errorHistory) {
        this.errorHistory = _parsed.errorHistory;
      }

      if (_parsed.sessionData) {
        this.sessionData = _parsed.sessionData;
      }

      logger.info("Learning _data loaded");
    } catch (_error: unknown) {
      if ((_error as unknown).code !== "ENOENT") {
        logger.error("Failed to load learning _data:", _error);
      }
    }
  }

  /**
   * Cleanup
   */
  //  - Complex async type handling
  async cleanup(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    await this.saveData();
  }
}

// Types
interface CommandContext {
  executionTime: number;
  success: boolean;
  _error?: string;
  context?: string;
  parameters?: Record<string, unknown>;
}

interface SessionData {
  date: Date;
  duration: number;
  commandCount: number;
  errorCount: number;
}

interface UserFeedback {
  wasHelpful: boolean;
  rating?: number;
  comment?: string;
}

interface ProductivityInsights {
  peakHour: number;
  mostUsedCommand: string;
  errorRate: number;
  suggestions: string[];
  trends: string[];
}

// Export singleton instance
export const _learningEngine = new LearningEngine();
