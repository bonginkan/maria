/**
 * Adaptive Learning Engine
 * Learns from user behavior patterns and provides personalized recommendations
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface UserProfile {
  userId: string;
  preferences: {
    preferredCommands: string[];
    codingStyle: 'functional' | 'object-oriented' | 'procedural' | 'mixed';
    primaryLanguages: string[];
    workingHours: {
      start: number; // hour 0-23
      end: number; // hour 0-23
      timezone: string;
    };
    productivityPeaks: number[]; // hours when user is most productive
    preferredComplexity: 'simple' | 'moderate' | 'complex';
  };
  statistics: {
    totalCommands: number;
    successRate: number;
    averageSessionLength: number;
    favoriteFeatures: string[];
    learningProgress: number; // 0-100
  };
  achievements: Achievement[];
  lastUpdated: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: number;
  category: 'productivity' | 'learning' | 'creativity' | 'efficiency';
}

export interface UsagePattern {
  commandSequence: string[];
  frequency: number;
  context: string;
  timeOfDay: number;
  projectType?: string;
  success: boolean;
  duration: number;
}

export interface LearningInsight {
  type: 'recommendation' | 'warning' | 'tip' | 'achievement';
  title: string;
  description: string;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  data?: unknown;
}

export interface PersonalizationConfig {
  adaptiveHotkeys: boolean;
  intelligentSuggestions: boolean;
  contextAwareness: boolean;
  productivityTracking: boolean;
  achievementSystem: boolean;
  learningMode: 'passive' | 'active' | 'guided';
}

export class AdaptiveLearningEngine extends EventEmitter {
  private static instance: AdaptiveLearningEngine;
  private userProfile: UserProfile | null = null;
  private usagePatterns: UsagePattern[] = [];
  private recentCommands: string[] = [];
  private sessionStartTime: number = Date.now();
  private config: PersonalizationConfig;
  private dataPath: string;
  private maxPatterns = 1000; // Limit stored patterns for performance

  private constructor() {
    super();
    this.dataPath = join(homedir(), '.maria', 'learning');
    this.config = this.getDefaultConfig();
    this.ensureDataDirectory();
    this.loadUserData();
    this.startPeriodicAnalysis();
  }

  public static getInstance(): AdaptiveLearningEngine {
    if (!AdaptiveLearningEngine.instance) {
      AdaptiveLearningEngine.instance = new AdaptiveLearningEngine();
    }
    return AdaptiveLearningEngine.instance;
  }

  /**
   * Get default personalization configuration
   */
  private getDefaultConfig(): PersonalizationConfig {
    return {
      adaptiveHotkeys: true,
      intelligentSuggestions: true,
      contextAwareness: true,
      productivityTracking: true,
      achievementSystem: true,
      learningMode: 'active',
    };
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    if (!existsSync(this.dataPath)) {
      mkdirSync(this.dataPath, { recursive: true });
    }
  }

  /**
   * Load user data from storage
   */
  private loadUserData(): void {
    try {
      const profilePath = join(this.dataPath, 'profile.json');
      const patternsPath = join(this.dataPath, 'patterns.json');

      if (existsSync(profilePath)) {
        const data = readFileSync(profilePath, 'utf-8');
        this.userProfile = JSON.parse(data);
      } else {
        this.userProfile = this.createDefaultProfile();
      }

      if (existsSync(patternsPath)) {
        const data = readFileSync(patternsPath, 'utf-8');
        this.usagePatterns = JSON.parse(data);
      }

      logger.info('Adaptive learning data loaded successfully');
    } catch (error: unknown) {
      logger.warn('Failed to load learning data, using defaults:', error);
      this.userProfile = this.createDefaultProfile();
      this.usagePatterns = [];
    }
  }

  /**
   * Save user data to storage
   */
  private saveUserData(): void {
    try {
      const profilePath = join(this.dataPath, 'profile.json');
      const patternsPath = join(this.dataPath, 'patterns.json');

      if (this.userProfile) {
        this.userProfile.lastUpdated = Date.now();
        writeFileSync(profilePath, JSON.stringify(this.userProfile, null, 2));
      }

      // Limit stored patterns to prevent excessive storage usage
      const recentPatterns = this.usagePatterns
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, this.maxPatterns);

      writeFileSync(patternsPath, JSON.stringify(recentPatterns, null, 2));

      logger.debug('Adaptive learning data saved');
    } catch (error: unknown) {
      logger.error('Failed to save learning data:', error);
    }
  }

  /**
   * Create default user profile
   */
  private createDefaultProfile(): UserProfile {
    return {
      userId: `user_${Date.now()}`,
      preferences: {
        preferredCommands: [],
        codingStyle: 'mixed',
        primaryLanguages: [],
        workingHours: {
          start: 9,
          end: 17,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        productivityPeaks: [],
        preferredComplexity: 'moderate',
      },
      statistics: {
        totalCommands: 0,
        successRate: 1.0,
        averageSessionLength: 0,
        favoriteFeatures: [],
        learningProgress: 0,
      },
      achievements: [],
      lastUpdated: Date.now(),
    };
  }

  /**
   * Record command usage for learning
   */
  recordCommandUsage(
    command: string,
    _args: string[] = [],
    context: string = 'chat',
    success: boolean = true,
    duration: number = 0,
  ): void {
    if (!this.userProfile || !this.config.productivityTracking) {
      return;
    }

    // Update statistics
    this.userProfile.statistics.totalCommands++;
    this.userProfile.statistics.successRate =
      (this.userProfile.statistics.successRate * (this.userProfile.statistics.totalCommands - 1) +
        (success ? 1 : 0)) /
      this.userProfile.statistics.totalCommands;

    // Track recent commands for sequence detection
    this.recentCommands.push(command);
    if (this.recentCommands.length > 10) {
      this.recentCommands.shift();
    }

    // Update preferred commands
    const commandIndex = this.userProfile.preferences.preferredCommands.indexOf(command);
    if (commandIndex === -1) {
      this.userProfile.preferences.preferredCommands.push(command);
    }

    // Record usage pattern
    const pattern: UsagePattern = {
      commandSequence: [...this.recentCommands],
      frequency: 1,
      context,
      timeOfDay: new Date().getHours(),
      success,
      duration,
    };

    // Check for existing similar pattern
    const existingPattern = this.usagePatterns.find(
      (p) =>
        p.commandSequence.slice(-3).join(',') === pattern.commandSequence.slice(-3).join(',') &&
        p.context === context,
    );

    if (existingPattern) {
      existingPattern.frequency++;
    } else {
      this.usagePatterns.push(pattern);
    }

    // Update productivity peaks
    this.updateProductivityPeaks(new Date().getHours(), success);

    // Check for achievements
    this.checkAchievements();

    // Emit learning event
    this.emit('commandLearned', {
      command,
      context,
      success,
      userProfile: this.userProfile,
    });

    // Periodic save
    if (this.userProfile.statistics.totalCommands % 10 === 0) {
      this.saveUserData();
    }
  }

  /**
   * Update productivity peaks based on success patterns
   */
  private updateProductivityPeaks(hour: number, success: boolean): void {
    if (!this.userProfile || !success) return;

    const peaks = this.userProfile.preferences.productivityPeaks;
    const existingIndex = peaks.indexOf(hour);

    if (existingIndex === -1) {
      peaks.push(hour);
    }

    // Keep top 6 productive hours
    if (peaks.length > 6) {
      peaks.sort((a, b) => this.getHourSuccessRate(b) - this.getHourSuccessRate(a));
      this.userProfile.preferences.productivityPeaks = peaks.slice(0, 6);
    }
  }

  /**
   * Get success rate for a specific hour
   */
  private getHourSuccessRate(hour: number): number {
    const hourPatterns = this.usagePatterns.filter((p) => p.timeOfDay === hour);
    if (hourPatterns.length === 0) return 0;

    const successCount = hourPatterns.filter((p) => p.success).length;
    return successCount / hourPatterns.length;
  }

  /**
   * Check and award achievements
   */
  private checkAchievements(): void {
    if (!this.userProfile || !this.config.achievementSystem) return;

    const stats = this.userProfile.statistics;
    const newAchievements: Achievement[] = [];

    // First Command Achievement
    if (stats.totalCommands === 1 && !this.hasAchievement('first_command')) {
      newAchievements.push({
        id: 'first_command',
        title: 'First Steps',
        description: 'Executed your first command with MARIA',
        icon: '🚀',
        unlockedAt: Date.now(),
        category: 'learning',
      });
    }

    // Command Master Achievement
    if (stats.totalCommands >= 100 && !this.hasAchievement('command_master')) {
      newAchievements.push({
        id: 'command_master',
        title: 'Command Master',
        description: 'Executed 100 commands successfully',
        icon: '🎯',
        unlockedAt: Date.now(),
        category: 'productivity',
      });
    }

    // Perfectionist Achievement
    if (
      stats.successRate >= 0.95 &&
      stats.totalCommands >= 50 &&
      !this.hasAchievement('perfectionist')
    ) {
      newAchievements.push({
        id: 'perfectionist',
        title: 'Perfectionist',
        description: 'Maintained 95% success rate over 50 commands',
        icon: '💎',
        unlockedAt: Date.now(),
        category: 'efficiency',
      });
    }

    // Night Owl Achievement
    const nightPatterns = this.usagePatterns.filter((p) => p.timeOfDay >= 22 || p.timeOfDay <= 6);
    if (nightPatterns.length >= 20 && !this.hasAchievement('night_owl')) {
      newAchievements.push({
        id: 'night_owl',
        title: 'Night Owl',
        description: 'Active coding sessions during night hours',
        icon: '🦉',
        unlockedAt: Date.now(),
        category: 'productivity',
      });
    }

    // Add new achievements
    if (newAchievements.length > 0) {
      this.userProfile.achievements.push(...newAchievements);

      newAchievements.forEach((achievement) => {
        this.emit('achievementUnlocked', { achievement, userProfile: this.userProfile });
        logger.info(`Achievement unlocked: ${achievement.title}`);
      });
    }
  }

  /**
   * Check if user has specific achievement
   */
  private hasAchievement(achievementId: string): boolean {
    return this.userProfile?.achievements.some((a) => a.id === achievementId) || false;
  }

  /**
   * Get personalized recommendations
   */
  getRecommendations(): LearningInsight[] {
    if (!this.userProfile || !this.config.intelligentSuggestions) {
      return [];
    }

    const insights: LearningInsight[] = [];
    const stats = this.userProfile.statistics;

    // Command efficiency recommendations
    if (stats.totalCommands > 20) {
      // const _mostUsedCommands = this.getMostUsedCommands(5); // Used for future feature recommendations
      const underutilizedFeatures = this.getUnderutilizedFeatures();

      if (underutilizedFeatures.length > 0) {
        insights.push({
          type: 'recommendation',
          title: 'Explore New Features',
          description: `Try these powerful features: ${underutilizedFeatures.slice(0, 3).join(', ')}`,
          actionable: true,
          priority: 'medium',
          category: 'productivity',
          data: { features: underutilizedFeatures },
        });
      }
    }

    // Productivity timing recommendations
    if (this.userProfile.preferences.productivityPeaks.length > 0) {
      const currentHour = new Date().getHours();
      const isPeakTime = this.userProfile.preferences.productivityPeaks.includes(currentHour);

      if (isPeakTime) {
        insights.push({
          type: 'tip',
          title: 'Peak Productivity Time',
          description:
            "You're most productive during this hour. Consider tackling complex tasks now.",
          actionable: true,
          priority: 'high',
          category: 'productivity',
        });
      }
    }

    // Success rate improvements
    if (stats.successRate < 0.8) {
      insights.push({
        type: 'warning',
        title: 'Success Rate Alert',
        description: 'Your success rate could be improved. Try using /help for command guidance.',
        actionable: true,
        priority: 'high',
        category: 'learning',
      });
    }

    // Achievement progress
    const nextAchievement = this.getNextAchievement();
    if (nextAchievement) {
      insights.push({
        type: 'achievement',
        title: 'Next Achievement',
        description: nextAchievement.description,
        actionable: false,
        priority: 'low',
        category: 'achievement',
        data: nextAchievement,
      });
    }

    return insights.sort(
      (a, b) => this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority),
    );
  }

  /**
   * Get most used commands
   */
  // private _getMostUsedCommands(limit: number): string[] {
  //   const commandCounts = new Map<string, number>();
  //
  //   this.usagePatterns.forEach((pattern) => {
  //     pattern.commandSequence.forEach((cmd) => {
  //       commandCounts.set(cmd, (commandCounts.get(cmd) || 0) + pattern.frequency);
  //     });
  //   });
  //
  //   return Array.from(commandCounts.entries())
  //     .sort((a, b) => b[1] - a[1])
  //     .slice(0, limit)
  //     .map(([cmd]) => cmd);
  // }

  /**
   * Get underutilized features
   */
  private getUnderutilizedFeatures(): string[] {
    const allFeatures = [
      '/code',
      '/test',
      '/review',
      '/image',
      '/video',
      '/commit',
      '/bug',
      '/config',
    ];
    const usedCommands = new Set(this.usagePatterns.flatMap((p) => p.commandSequence));

    return allFeatures.filter((feature) => !usedCommands.has(feature));
  }

  /**
   * Get next achievable achievement
   */
  private getNextAchievement(): Achievement | null {
    if (!this.userProfile) return null;

    const stats = this.userProfile.statistics;

    // Command milestones
    if (stats.totalCommands < 10) {
      return {
        id: 'getting_started',
        title: 'Getting Started',
        description: `Execute ${10 - stats.totalCommands} more commands to unlock this achievement`,
        icon: '🌟',
        unlockedAt: 0,
        category: 'learning',
      };
    }

    if (stats.totalCommands < 50 && !this.hasAchievement('regular_user')) {
      return {
        id: 'regular_user',
        title: 'Regular User',
        description: `Execute ${50 - stats.totalCommands} more commands to unlock this achievement`,
        icon: '⭐',
        unlockedAt: 0,
        category: 'productivity',
      };
    }

    return null;
  }

  /**
   * Get priority score for sorting
   */
  private getPriorityScore(priority: string): number {
    const scores = { high: 3, medium: 2, low: 1 };
    return scores[priority as keyof typeof scores] || 0;
  }

  /**
   * Predict next likely command
   */
  predictNextCommand(): string[] {
    if (this.recentCommands.length === 0 || !this.config.contextAwareness) {
      return [];
    }

    const recentSequence = this.recentCommands.slice(-2).join(',');
    const matchingPatterns = this.usagePatterns.filter(
      (pattern) => pattern.commandSequence.slice(-3, -1).join(',') === recentSequence,
    );

    if (matchingPatterns.length === 0) return [];

    // Get next commands from matching patterns
    const nextCommands = new Map<string, number>();

    matchingPatterns.forEach((pattern) => {
      const lastIndex = pattern.commandSequence.length - 1;
      const nextCommand = pattern.commandSequence[lastIndex];
      if (nextCommand) {
        nextCommands.set(nextCommand, (nextCommands.get(nextCommand) || 0) + pattern.frequency);
      }
    });

    return Array.from(nextCommands.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cmd]) => cmd);
  }

  /**
   * Get user profile
   */
  getUserProfile(): UserProfile | null {
    return this.userProfile;
  }

  /**
   * Update user preferences
   */
  updatePreferences(updates: Partial<UserProfile['preferences']>): void {
    if (!this.userProfile) return;

    Object.assign(this.userProfile.preferences, updates);
    this.userProfile.lastUpdated = Date.now();
    this.saveUserData();

    this.emit('preferencesUpdated', { preferences: this.userProfile.preferences });
  }

  /**
   * Get learning statistics
   */
  getLearningStats() {
    if (!this.userProfile) {
      return {
        totalCommands: 0,
        successRate: 1,
        achievements: 0,
        learningProgress: 0,
        patterns: 0,
      };
    }

    return {
      totalCommands: this.userProfile.statistics.totalCommands,
      successRate: this.userProfile.statistics.successRate,
      achievements: this.userProfile.achievements.length,
      learningProgress: this.userProfile.statistics.learningProgress,
      patterns: this.usagePatterns.length,
      productivityPeaks: this.userProfile.preferences.productivityPeaks,
    };
  }

  /**
   * Reset learning data
   */
  resetLearningData(): void {
    this.userProfile = this.createDefaultProfile();
    this.usagePatterns = [];
    this.recentCommands = [];
    this.saveUserData();

    this.emit('learningReset');
    logger.info('Learning data reset');
  }

  /**
   * Start periodic analysis
   */
  private startPeriodicAnalysis(): void {
    // Run analysis every 5 minutes
    setInterval(
      () => {
        this.analyzeUsagePatterns();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Analyze usage patterns and update learning progress
   */
  private analyzeUsagePatterns(): void {
    if (!this.userProfile || this.usagePatterns.length === 0) return;

    // Update learning progress based on pattern diversity and success rate
    const uniqueCommands = new Set(this.usagePatterns.flatMap((p) => p.commandSequence)).size;
    const progressScore = Math.min(
      100,
      uniqueCommands * 5 + this.userProfile.statistics.successRate * 20,
    );

    this.userProfile.statistics.learningProgress = Math.max(
      this.userProfile.statistics.learningProgress,
      progressScore,
    );

    // Update session length
    const sessionLength = (Date.now() - this.sessionStartTime) / 60000; // minutes
    this.userProfile.statistics.averageSessionLength =
      (this.userProfile.statistics.averageSessionLength + sessionLength) / 2;

    this.emit('analysisComplete', {
      patterns: this.usagePatterns.length,
      learningProgress: this.userProfile.statistics.learningProgress,
    });
  }

  /**
   * Export learning data
   */
  exportLearningData() {
    return {
      userProfile: this.userProfile,
      usagePatterns: this.usagePatterns,
      config: this.config,
      exportedAt: Date.now(),
    };
  }
}

export const adaptiveLearningEngine = AdaptiveLearningEngine.getInstance();
