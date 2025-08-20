/**
 * Personalization System
 * Provides adaptive UI customization and intelligent user experience optimization
 */

import { EventEmitter } from 'events';
import { AdaptiveLearningEngine, UserProfile } from './adaptive-learning-engine.js';
import { UIStateManager } from './ui-state-manager.js';
import { HotkeyManager } from './hotkey-manager.js';
import { logger } from '../utils/logger.js';

export interface PersonalizationSettings {
  theme: 'auto' | 'light' | 'dark' | 'custom';
  uiDensity: 'compact' | 'comfortable' | 'spacious';
  animationLevel: 'none' | 'reduced' | 'full';
  autoSuggestions: boolean;
  proactiveHelp: boolean;
  contextualHints: boolean;
  adaptiveHotkeys: boolean;
  smartDefaults: boolean;
}

export interface UIPersonalization {
  layout: 'standard' | 'minimal' | 'power-user';
  shortcuts: Record<string, string>;
  quickActions: string[];
  favoriteCommands: string[];
  hiddenFeatures: string[];
  customColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface SmartRecommendation {
  id: string;
  type: 'command' | 'shortcut' | 'workflow' | 'setting';
  title: string;
  description: string;
  action: string;
  confidence: number; // 0-1
  priority: number; // 1-5
  context: string;
  learnedFromPattern?: string;
}

export interface AdaptiveFeature {
  id: string;
  name: string;
  enabled: boolean;
  adaptationLevel: number; // 0-100
  lastUpdated: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
}

export class PersonalizationSystem extends EventEmitter {
  private static instance: PersonalizationSystem;
  private learningEngine: AdaptiveLearningEngine;
  private uiStateManager: UIStateManager;
  private hotkeyManager: HotkeyManager;

  private settings: PersonalizationSettings;
  private uiPersonalization: UIPersonalization;
  private adaptiveFeatures: Map<string, AdaptiveFeature> = new Map();
  private recommendations: SmartRecommendation[] = [];

  private isInitialized = false;
  private lastPersonalizationUpdate = 0;

  private constructor() {
    super();
    this.learningEngine = AdaptiveLearningEngine.getInstance();
    this.uiStateManager = UIStateManager.getInstance();
    this.hotkeyManager = HotkeyManager.getInstance();

    this.settings = this.getDefaultSettings();
    this.uiPersonalization = this.getDefaultUIPersonalization();

    this.initializeAdaptiveFeatures();
    this.setupEventListeners();
  }

  public static getInstance(): PersonalizationSystem {
    if (!PersonalizationSystem.instance) {
      PersonalizationSystem.instance = new PersonalizationSystem();
    }
    return PersonalizationSystem.instance;
  }

  /**
   * Get default personalization settings
   */
  private getDefaultSettings(): PersonalizationSettings {
    return {
      theme: 'auto',
      uiDensity: 'comfortable',
      animationLevel: 'full',
      autoSuggestions: true,
      proactiveHelp: true,
      contextualHints: true,
      adaptiveHotkeys: true,
      smartDefaults: true,
    };
  }

  /**
   * Get default UI personalization
   */
  private getDefaultUIPersonalization(): UIPersonalization {
    return {
      layout: 'standard',
      shortcuts: {},
      quickActions: ['/help', '/status', '/clear'],
      favoriteCommands: [],
      hiddenFeatures: [],
    };
  }

  /**
   * Initialize adaptive features
   */
  private initializeAdaptiveFeatures(): void {
    const features = [
      { id: 'smart_suggestions', name: 'Smart Command Suggestions' },
      { id: 'adaptive_ui', name: 'Adaptive UI Layout' },
      { id: 'context_awareness', name: 'Context-Aware Help' },
      { id: 'predictive_text', name: 'Predictive Text Completion' },
      { id: 'workflow_optimization', name: 'Workflow Optimization' },
      { id: 'performance_insights', name: 'Performance Insights' },
      { id: 'custom_shortcuts', name: 'Custom Shortcut Generation' },
      { id: 'error_prevention', name: 'Proactive Error Prevention' },
    ];

    features.forEach((feature) => {
      this.adaptiveFeatures.set(feature.id, {
        ...feature,
        enabled: true,
        adaptationLevel: 0,
        lastUpdated: Date.now(),
      });
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.learningEngine.on('commandLearned', (data) => {
      this.updatePersonalizationFromLearning(data);
    });

    this.learningEngine.on('achievementUnlocked', (data) => {
      this.handleAchievementUnlocked(data);
    });

    this.learningEngine.on('analysisComplete', (data) => {
      this.updateAdaptiveFeatures(data);
    });

    this.uiStateManager.on('stateUpdated', (data) => {
      this.trackUIInteraction(data);
    });
  }

  /**
   * Initialize personalization system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load user preferences
      await this.loadUserPreferences();

      // Generate initial recommendations
      await this.generateRecommendations();

      // Start adaptive learning
      this.startAdaptiveLearning();

      this.isInitialized = true;
      this.emit('initialized');

      logger.info('Personalization system initialized successfully');
    } catch (error: unknown) {
      logger.error('Failed to initialize personalization system:', error);
      throw error;
    }
  }

  /**
   * Load user preferences from storage
   */
  private async loadUserPreferences(): Promise<void> {
    try {
      const userProfile = this.learningEngine.getUserProfile();
      if (!userProfile) return;

      // Adapt settings based on user profile
      if (userProfile.preferences.preferredCommands.length > 0) {
        this.uiPersonalization.favoriteCommands = userProfile.preferences.preferredCommands.slice(
          0,
          5,
        );
      }

      // Set theme based on working hours
      const currentHour = new Date().getHours();
      if (this.settings.theme === 'auto') {
        const { start, end } = userProfile.preferences.workingHours;
        this.settings.theme = currentHour >= start && currentHour <= end ? 'light' : 'dark';
      }

      // Adjust UI density based on user behavior
      if (userProfile.statistics.totalCommands > 100) {
        this.settings.uiDensity = 'compact'; // Power users prefer compact UI
      }

      logger.debug('User preferences loaded and applied');
    } catch (error: unknown) {
      logger.warn('Failed to load user preferences:', error);
    }
  }

  /**
   * Update personalization from learning data
   */
  private updatePersonalizationFromLearning(data: {
    command: string;
    context: string;
    success: boolean;
    userProfile: UserProfile;
  }): void {
    const { command, success, userProfile } = data;

    // Update favorite commands
    if (success && !this.uiPersonalization.favoriteCommands.includes(command)) {
      if (this.uiPersonalization.favoriteCommands.length < 8) {
        this.uiPersonalization.favoriteCommands.push(command);
      }
    }

    // Adapt UI based on command usage patterns
    if (userProfile.statistics.totalCommands > 50) {
      const commandFrequency = userProfile.preferences.preferredCommands.length;

      if (commandFrequency > 15) {
        this.uiPersonalization.layout = 'power-user';
        this.settings.uiDensity = 'compact';
      } else if (commandFrequency < 5) {
        this.uiPersonalization.layout = 'minimal';
        this.settings.proactiveHelp = true;
      }
    }

    // Generate contextual shortcuts
    if (this.settings.adaptiveHotkeys) {
      this.generateAdaptiveShortcuts(userProfile);
    }

    this.emit('personalizationUpdated', {
      settings: this.settings,
      uiPersonalization: this.uiPersonalization,
    });
  }

  /**
   * Generate adaptive shortcuts based on usage patterns
   */
  private generateAdaptiveShortcuts(userProfile: UserProfile): void {
    const topCommands = userProfile.preferences.preferredCommands.slice(0, 5);
    const availableKeys = ['1', '2', '3', '4', '5'];

    topCommands.forEach((command, index) => {
      if (index < availableKeys.length) {
        const shortcutKey = `ctrl+${availableKeys[index]}`;
        if (!this.hotkeyManager.listBindings().some((b) => b.key === availableKeys[index])) {
          this.uiPersonalization.shortcuts[shortcutKey] = command;
        }
      }
    });
  }

  /**
   * Handle achievement unlocked
   */
  private handleAchievementUnlocked(data: {
    achievement: unknown;
    userProfile: UserProfile;
  }): void {
    const { userProfile } = data;

    // Unlock new features based on achievements
    if (userProfile.achievements.length >= 3) {
      this.enableAdaptiveFeature('workflow_optimization');
    }

    if (userProfile.achievements.length >= 5) {
      this.enableAdaptiveFeature('performance_insights');
    }

    // Adjust help level based on progress
    if (userProfile.statistics.learningProgress > 70) {
      this.settings.proactiveHelp = false; // Reduce help for experienced users
      this.settings.contextualHints = false;
    }
  }

  /**
   * Update adaptive features based on analysis
   */
  private updateAdaptiveFeatures(data: { patterns: number; learningProgress: number }): void {
    const { patterns, learningProgress } = data;

    // Update adaptation levels
    this.adaptiveFeatures.forEach((feature, id) => {
      if (feature.enabled) {
        const newLevel = Math.min(100, patterns + learningProgress);
        this.adaptiveFeatures.set(id, {
          ...feature,
          adaptationLevel: newLevel,
          lastUpdated: Date.now(),
        });
      }
    });

    // Generate new recommendations based on adaptation progress
    if (Date.now() - this.lastPersonalizationUpdate > 300000) {
      // 5 minutes
      this.generateRecommendations();
      this.lastPersonalizationUpdate = Date.now();
    }
  }

  /**
   * Track UI interaction for learning
   */
  private trackUIInteraction(data: unknown): void {
    // This would track how users interact with different UI elements
    // to further optimize the interface
    this.emit('uiInteractionTracked', data);
  }

  /**
   * Generate personalized recommendations
   */
  async generateRecommendations(): Promise<SmartRecommendation[]> {
    const insights = this.learningEngine.getRecommendations();
    const nextCommands = this.learningEngine.predictNextCommand();
    const userProfile = this.learningEngine.getUserProfile();

    this.recommendations = [];

    // Convert learning insights to recommendations
    insights.forEach((insight, index) => {
      this.recommendations.push({
        id: `insight_${index}`,
        type: insight.type === 'recommendation' ? 'command' : 'setting',
        title: insight.title,
        description: insight.description,
        action: insight.actionable ? 'apply' : 'dismiss',
        confidence: insight.priority === 'high' ? 0.9 : insight.priority === 'medium' ? 0.7 : 0.5,
        priority: insight.priority === 'high' ? 5 : insight.priority === 'medium' ? 3 : 1,
        context: insight.category,
      });
    });

    // Add command predictions
    nextCommands.forEach((command, index) => {
      this.recommendations.push({
        id: `prediction_${index}`,
        type: 'command',
        title: `Try ${command}`,
        description: `Based on your patterns, you might want to use ${command} next`,
        action: command,
        confidence: 0.8 - index * 0.1,
        priority: 4 - index,
        context: 'prediction',
        learnedFromPattern: 'command_sequence',
      });
    });

    // Add workflow optimizations
    if (userProfile && userProfile.statistics.totalCommands > 30) {
      this.recommendations.push({
        id: 'workflow_optimization',
        type: 'workflow',
        title: 'Optimize Your Workflow',
        description: 'Create a custom shortcut for your most used command sequence',
        action: 'create_workflow',
        confidence: 0.75,
        priority: 3,
        context: 'productivity',
      });
    }

    // Sort by priority and confidence
    this.recommendations.sort((a, b) => b.priority * b.confidence - a.priority * a.confidence);

    this.emit('recommendationsUpdated', this.recommendations);
    return this.recommendations.slice(0, 10); // Return top 10
  }

  /**
   * Apply a recommendation
   */
  async applyRecommendation(recommendationId: string): Promise<boolean> {
    const recommendation = this.recommendations.find((r) => r.id === recommendationId);
    if (!recommendation) {
      return false;
    }

    try {
      switch (recommendation.type) {
        case 'command':
          // Execute the recommended command
          this.emit('executeCommand', recommendation.action);
          break;

        case 'shortcut':
          // Create or update shortcut
          this.uiPersonalization.shortcuts[recommendation.id] = recommendation.action;
          break;

        case 'setting':
          // Update setting
          this.updateSetting(recommendation.action, true);
          break;

        case 'workflow':
          // Create workflow
          this.createWorkflow(recommendation);
          break;
      }

      // Remove applied recommendation
      this.recommendations = this.recommendations.filter((r) => r.id !== recommendationId);

      // Record positive feedback
      this.recordRecommendationFeedback(recommendationId, 'positive');

      this.emit('recommendationApplied', recommendation);
      return true;
    } catch (error: unknown) {
      logger.error('Failed to apply recommendation:', error);
      return false;
    }
  }

  /**
   * Record recommendation feedback
   */
  recordRecommendationFeedback(
    recommendationId: string,
    feedback: 'positive' | 'negative' | 'neutral',
  ): void {
    // This helps improve future recommendations
    const feature = this.adaptiveFeatures.get('smart_suggestions');
    if (feature) {
      feature.userFeedback = feedback;
      feature.lastUpdated = Date.now();

      // Adjust adaptation level based on feedback
      if (feedback === 'positive') {
        feature.adaptationLevel = Math.min(100, feature.adaptationLevel + 5);
      } else if (feedback === 'negative') {
        feature.adaptationLevel = Math.max(0, feature.adaptationLevel - 5);
      }

      this.adaptiveFeatures.set('smart_suggestions', feature);
    }

    this.emit('feedbackRecorded', { recommendationId, feedback });
  }

  /**
   * Enable adaptive feature
   */
  enableAdaptiveFeature(featureId: string): void {
    const feature = this.adaptiveFeatures.get(featureId);
    if (feature) {
      this.adaptiveFeatures.set(featureId, {
        ...feature,
        enabled: true,
        lastUpdated: Date.now(),
      });

      logger.info(`Adaptive feature enabled: ${feature.name}`);
      this.emit('featureEnabled', feature);
    }
  }

  /**
   * Create workflow from recommendation
   */
  private createWorkflow(recommendation: SmartRecommendation): void {
    // This would create a custom workflow based on user patterns
    const workflow = {
      id: `workflow_${Date.now()}`,
      name: recommendation.title,
      steps: recommendation.action.split(','),
      createdAt: Date.now(),
    };

    this.emit('workflowCreated', workflow);
  }

  /**
   * Update a setting
   */
  private updateSetting(settingPath: string, value: unknown): void {
    // Parse setting path like "settings.autoSuggestions"
    const [section, key] = settingPath.split('.');

    if (section === 'settings' && key in this.settings) {
      (this.settings as Record<string, unknown>)[key] = value;
      this.emit('settingUpdated', { key, value });
    }
  }

  /**
   * Start adaptive learning cycle
   */
  private startAdaptiveLearning(): void {
    // Run adaptation cycle every 10 minutes
    setInterval(
      () => {
        this.runAdaptationCycle();
      },
      10 * 60 * 1000,
    );
  }

  /**
   * Run adaptation cycle
   */
  private async runAdaptationCycle(): Promise<void> {
    try {
      // Update personalization based on recent activity
      const userProfile = this.learningEngine.getUserProfile();
      if (!userProfile) return;

      // Adapt UI density based on command frequency
      const recentCommandRate =
        userProfile.statistics.totalCommands /
        Math.max(1, (Date.now() - (userProfile.lastUpdated || Date.now())) / 60000); // commands per minute

      if (recentCommandRate > 2) {
        this.settings.uiDensity = 'compact';
        this.settings.animationLevel = 'reduced';
      } else if (recentCommandRate < 0.5) {
        this.settings.uiDensity = 'spacious';
        this.settings.animationLevel = 'full';
      }

      // Generate new recommendations
      await this.generateRecommendations();

      this.emit('adaptationCycleComplete');
    } catch (error: unknown) {
      logger.error('Adaptation cycle failed:', error);
    }
  }

  /**
   * Get current personalization state
   */
  getPersonalizationState() {
    return {
      settings: this.settings,
      uiPersonalization: this.uiPersonalization,
      adaptiveFeatures: Array.from(this.adaptiveFeatures.entries()),
      recommendations: this.recommendations,
      stats: this.learningEngine.getLearningStats(),
    };
  }

  /**
   * Update personalization settings
   */
  updateSettings(updates: Partial<PersonalizationSettings>): void {
    Object.assign(this.settings, updates);
    this.emit('settingsUpdated', this.settings);
  }

  /**
   * Reset personalization to defaults
   */
  resetPersonalization(): void {
    this.settings = this.getDefaultSettings();
    this.uiPersonalization = this.getDefaultUIPersonalization();
    this.recommendations = [];

    this.adaptiveFeatures.forEach((feature, id) => {
      this.adaptiveFeatures.set(id, {
        ...feature,
        adaptationLevel: 0,
        lastUpdated: Date.now(),
      });
    });

    this.emit('personalizationReset');
    logger.info('Personalization reset to defaults');
  }
}

export const personalizationSystem = PersonalizationSystem.getInstance();
