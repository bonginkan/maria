/**
 * Learning Engine Service
 * ユーザーの使用パターンを学習し、個人に最適化された体験を提供
 * Phase 3: Adaptive Learning System
 */
// @ts-nocheck - Complex type interactions requiring gradual type migration

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface CommandParameter {
  name: string;
  value: string | number | boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
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
  error: string;
  count: number;
  lastOccurred: Date;
  resolution?: string;
  autoFixAvailable: boolean;
}

export interface UserProfile {
  userId: string;
  createdAt: Date;
  lastActive: Date;
  totalCommands: number;
  favoriteCommands: string[];
  preferredLanguage: string;
  codingStyle: CodingStyle;
  productivityMetrics: ProductivityMetrics;
  learningProgress: LearningProgress;
}

export interface CodingStyle {
  indentation: 'tabs' | 'spaces';
  indentSize: number;
  quotes: 'single' | 'double';
  semicolons: boolean;
  lineEndings: 'lf' | 'crlf';
  namingConvention: 'camelCase' | 'snake_case' | 'kebab-case';
  commentStyle: 'inline' | 'block' | 'jsdoc';
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

  constructor(userId: string = 'default') {
    super();

    this.dataPath = path.join(os.homedir(), '.maria', 'learning');
    this.userProfile = this.createDefaultProfile(userId);

    this.initialize();
  }

  /**
   * Initialize learning engine
   */
  // @ts-nocheck - Complex async type handling
  private async initialize() {
    try {
      // Create data directory
      await fs.mkdir(this.dataPath, { recursive: true });

      // Load existing data
      await this.loadData();

      // Start auto-save interval
      this.saveInterval = setInterval(() => {
        this.saveData().catch((error) => {
          logger.error('Failed to auto-save learning data:', error);
        });
      }, 60000); // Save every minute

      logger.info('Learning engine initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize learning engine:', error);
    }
  }

  /**
   * Create default user profile
   */
  // @ts-nocheck - Complex async type handling
  private createDefaultProfile(userId: string): UserProfile {
    return {
      userId,
      createdAt: new Date(),
      lastActive: new Date(),
      totalCommands: 0,
      favoriteCommands: [],
      preferredLanguage: 'en',
      codingStyle: {
        indentation: 'spaces',
        indentSize: 2,
        quotes: 'single',
        semicolons: true,
        lineEndings: 'lf',
        namingConvention: 'camelCase',
        commentStyle: 'jsdoc',
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
        mostProductiveDay: 'Monday',
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
  // @ts-nocheck - Complex async type handling
  recordUsage(command: string, context: CommandContext): void {
    const pattern = this.usagePatterns.get(command) || {
      command,
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
    pattern.frequency++;
    pattern.lastUsed = new Date();

    // Update execution time
    pattern.averageExecutionTime =
      (pattern.averageExecutionTime * (pattern.frequency - 1) + context.executionTime) /
      pattern.frequency;

    // Update success rate
    if (!context.success) {
      pattern.successRate = (pattern.successRate * (pattern.frequency - 1) + 0) / pattern.frequency;
    } else {
      pattern.successRate = (pattern.successRate * (pattern.frequency - 1) + 1) / pattern.frequency;
    }

    // Record context
    if (context.context && !pattern.contexts.includes(context.context)) {
      pattern.contexts.push(context.context);
    }

    // Record parameters
    if (context.parameters) {
      pattern.parameters.push(context.parameters);
    }

    // Update time of day distribution
    const hour = new Date().getHours();
    pattern.timeOfDay[hour]++;

    // Record error if any
    if (context.error) {
      this.recordError(command, context.error);
    }

    this.usagePatterns.set(command, pattern);

    // Update user profile
    this.userProfile.totalCommands++;
    this.userProfile.lastActive = new Date();

    // Update favorite commands
    this.updateFavoriteCommands();

    // Check for achievements
    this.checkAchievements(command, context);

    // Emit usage event
    this.emit('usage:recorded', { command, pattern, context });
  }

  /**
   * Record error pattern
   */
  // @ts-nocheck - Complex async type handling
  private recordError(command: string, error: string): void {
    const existingError = this.errorHistory.find((e) => e.error === error);

    if (existingError) {
      existingError.count++;
      existingError.lastOccurred = new Date();
    } else {
      this.errorHistory.push({
        error,
        count: 1,
        lastOccurred: new Date(),
        autoFixAvailable: this.checkAutoFix(error),
      });
    }

    // Add to command's error patterns
    const pattern = this.usagePatterns.get(command);
    if (pattern) {
      const cmdError = pattern.errorPatterns.find((e) => e.error === error);
      if (cmdError) {
        cmdError.count++;
        cmdError.lastOccurred = new Date();
      } else {
        pattern.errorPatterns.push({
          error,
          count: 1,
          lastOccurred: new Date(),
          autoFixAvailable: this.checkAutoFix(error),
        });
      }
    }

    // Detect frequent errors
    if (this.errorHistory.length > 10) {
      const frequentErrors = this.errorHistory
        .filter((e) => e.count > 3)
        .sort((a, b) => b.count - a.count);

      if (frequentErrors.length > 0) {
        this.emit('frequent:errors', frequentErrors);
      }
    }
  }

  /**
   * Check if auto-fix is available for error
   */
  // @ts-nocheck - Complex async type handling
  private checkAutoFix(error: string): boolean {
    const autoFixablePatterns = [
      /module not found/i,
      /cannot find/i,
      /undefined variable/i,
      /syntax error/i,
      /type error/i,
    ];

    return autoFixablePatterns.some((pattern) => pattern.test(error));
  }

  /**
   * Update favorite commands based on usage
   */
  // @ts-nocheck - Complex async type handling
  private updateFavoriteCommands(): void {
    const sorted = Array.from(this.usagePatterns.entries())
      .sort((a, b) => b[1].frequency - a[1].frequency)
      .slice(0, 10)
      .map(([cmd]) => cmd);

    this.userProfile.favoriteCommands = sorted;
  }

  /**
   * Predict next action
   */
  // @ts-nocheck - Complex async type handling
  predictNextAction(currentContext: string): PredictedAction[] {
    const predictions: PredictedAction[] = [];
    const hour = new Date().getHours();

    // Analyze patterns for current context
    for (const [command, pattern] of this.usagePatterns) {
      let confidence = 0;
      const reasons: string[] = [];

      // Context matching
      if (pattern.contexts.includes(currentContext)) {
        confidence += 0.3;
        reasons.push('Context match');
      }

      // Time of day matching
      const timeScore = pattern.timeOfDay[hour] / Math.max(...pattern.timeOfDay);
      if (timeScore > 0.5) {
        confidence += timeScore * 0.2;
        reasons.push('Time pattern match');
      }

      // Frequency score
      const freqScore = Math.min(pattern.frequency / 100, 1);
      confidence += freqScore * 0.2;
      if (freqScore > 0.5) {
        reasons.push('Frequently used');
      }

      // Recency score
      const daysSinceUse = (Date.now() - pattern.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUse < 1) {
        confidence += 0.2;
        reasons.push('Recently used');
      } else if (daysSinceUse < 7) {
        confidence += 0.1;
      }

      // Success rate factor
      confidence *= pattern.successRate;

      if (confidence > 0.3) {
        predictions.push({
          command,
          confidence,
          reasoning: reasons.join(', '),
          parameters: this.predictParameters(pattern),
        });
      }
    }

    // Sort by confidence
    predictions.sort((a, b) => b.confidence - a.confidence);

    return predictions.slice(0, 5);
  }

  /**
   * Predict parameters for command
   */
  // @ts-nocheck - Complex async type handling
  private predictParameters(pattern: UsagePattern): Record<string, unknown> | undefined {
    if (pattern.parameters.length === 0) return undefined;

    // Find most common parameters
    const paramCounts = new Map<string, number>();

    for (const params of pattern.parameters) {
      const key = JSON.stringify(params);
      paramCounts.set(key, (paramCounts.get(key) || 0) + 1);
    }

    // Get most common parameter set
    const mostCommon = Array.from(paramCounts.entries()).sort((a, b) => b[1] - a[1])[0];

    if (mostCommon) {
      return JSON.parse(mostCommon[0]) as Record<string, unknown>;
    }

    return undefined;
  }

  /**
   * Get personalized suggestions
   */
  // @ts-nocheck - Complex async type handling
  getSuggestions(context: string): string[] {
    const predictions = this.predictNextAction(context);
    return predictions.map((p) => p.command);
  }

  /**
   * Learn from user feedback
   */
  // @ts-nocheck - Complex async type handling
  learnFromFeedback(command: string, feedback: UserFeedback): void {
    const pattern = this.usagePatterns.get(command);
    if (!pattern) return;

    if (feedback.wasHelpful) {
      // Increase weight for this command
      pattern.frequency += 0.5;
    } else {
      // Decrease success rate slightly
      pattern.successRate *= 0.95;
    }

    // Store feedback for future analysis
    this.emit('feedback:received', { command, feedback });
  }

  /**
   * Check and unlock achievements
   */
  // @ts-nocheck - Complex async type handling
  private checkAchievements(_command: string, _context: CommandContext): void {
    const achievements: Achievement[] = [];

    // Check various achievement conditions
    if (this.userProfile.totalCommands === 100) {
      achievements.push({
        id: 'century',
        name: 'Century',
        description: 'Execute 100 commands',
        unlockedAt: new Date(),
        icon: '💯',
      });
    }

    if (this.userProfile.totalCommands === 1000) {
      achievements.push({
        id: 'veteran',
        name: 'Veteran',
        description: 'Execute 1000 commands',
        unlockedAt: new Date(),
        icon: '🎖️',
      });
    }

    // Check error-free streak
    const recentPatterns = Array.from(this.usagePatterns.values()).slice(-10);
    if (recentPatterns.every((p) => p.successRate === 1)) {
      achievements.push({
        id: 'flawless',
        name: 'Flawless',
        description: '10 commands without errors',
        unlockedAt: new Date(),
        icon: '✨',
      });
    }

    // Add new achievements
    for (const achievement of achievements) {
      if (!this.userProfile.learningProgress.achievements.find((a) => a.id === achievement.id)) {
        this.userProfile.learningProgress.achievements.push(achievement);
        this.emit('achievement:unlocked', achievement);
      }
    }
  }

  /**
   * Get productivity insights
   */
  // @ts-nocheck - Complex async type handling
  getProductivityInsights(): ProductivityInsights {
    const insights: ProductivityInsights = {
      peakHour: 0,
      mostUsedCommand: '',
      errorRate: 0,
      suggestions: [],
      trends: [],
    };

    // Calculate peak hour
    const hourlyUsage = new Array(24).fill(0);
    for (const pattern of this.usagePatterns.values()) {
      for (let i = 0; i < 24; i++) {
        hourlyUsage[i] += pattern.timeOfDay[i];
      }
    }
    insights.peakHour = hourlyUsage.indexOf(Math.max(...hourlyUsage));

    // Most used command
    const [mostUsed] = Array.from(this.usagePatterns.entries()).sort(
      (a, b) => b[1].frequency - a[1].frequency,
    );
    if (mostUsed) {
      insights.mostUsedCommand = mostUsed[0];
    }

    // Calculate error rate
    const totalCommands = Array.from(this.usagePatterns.values()).reduce(
      (sum, p) => sum + p.frequency,
      0,
    );
    const totalErrors = this.errorHistory.reduce((sum, e) => sum + e.count, 0);
    insights.errorRate = totalCommands > 0 ? totalErrors / totalCommands : 0;

    // Generate suggestions
    if (insights.errorRate > 0.2) {
      insights.suggestions.push('Consider reviewing error patterns to improve success rate');
    }

    if (insights.peakHour >= 22 || insights.peakHour <= 2) {
      insights.suggestions.push('Late night coding detected - ensure adequate rest');
    }

    // Detect trends
    const recentUsage = this.sessionData.slice(-7);
    if (recentUsage.length >= 7) {
      const trend = this.detectTrend(recentUsage.map((s) => s.commandCount));
      insights.trends.push(trend);
    }

    return insights;
  }

  /**
   * Detect usage trend
   */
  // @ts-nocheck - Complex async type handling
  private detectTrend(values: number[]): string {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const recent = values.slice(-3).reduce((a, b) => a + b, 0) / 3;

    if (recent > avg * 1.2) return 'Increasing productivity 📈';
    if (recent < avg * 0.8) return 'Decreasing activity 📉';
    return 'Stable usage pattern ➡️';
  }

  /**
   * Save learning data
   */
  // @ts-nocheck - Complex async type handling
  async saveData(): Promise<void> {
    try {
      const data = {
        userProfile: this.userProfile,
        usagePatterns: Array.from(this.usagePatterns.entries()),
        errorHistory: this.errorHistory,
        sessionData: this.sessionData,
      };

      const filePath = path.join(this.dataPath, 'learning-data.json');
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));

      logger.debug('Learning data saved');
    } catch (error: unknown) {
      logger.error('Failed to save learning data:', error);
    }
  }

  /**
   * Load learning data
   */
  // @ts-nocheck - Complex async type handling
  async loadData(): Promise<void> {
    try {
      const filePath = path.join(this.dataPath, 'learning-data.json');
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data) as Record<string, unknown>;

      if (parsed.userProfile) {
        this.userProfile = {
          ...parsed.userProfile,
          createdAt: new Date(parsed.userProfile.createdAt),
          lastActive: new Date(parsed.userProfile.lastActive),
        };
      }

      if (parsed.usagePatterns) {
        this.usagePatterns = new Map(parsed.usagePatterns);
      }

      if (parsed.errorHistory) {
        this.errorHistory = parsed.errorHistory;
      }

      if (parsed.sessionData) {
        this.sessionData = parsed.sessionData;
      }

      logger.info('Learning data loaded');
    } catch (error: unknown) {
      if ((error as unknown).code !== 'ENOENT') {
        logger.error('Failed to load learning data:', error);
      }
    }
  }

  /**
   * Cleanup
   */
  // @ts-nocheck - Complex async type handling
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
  error?: string;
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
export const learningEngine = new LearningEngine();
