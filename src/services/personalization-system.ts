/**
 * Personalization System
 * Provides adaptive UI customization and intelligent user experience optimization
 */

import { EventEmitter } from "node:events";
import {
  AdaptiveLearningEngine,
  UserProfile,
} from "./adaptive-learning-engine.js";
import { UIStateManager } from "./ui-state-manager.js";
import { HotkeyManager } from "./hotkey-manager.js";
import { logger } from "../utils/logger.js";

export interface PersonalizationSettings {
  theme: "auto" | "light" | "dark" | "custom";
  uiDensity: "compact" | "comfortable" | "spacious";
  animationLevel: "none" | "reduced" | "full";
  autoSuggestions: boolean;
  proactiveHelp: boolean;
  contextualHints: boolean;
  adaptiveHotkeys: boolean;
  smartDefaults: boolean;
}

export interface UIPersonalization {
  layout: "standard" | "minimal" | "power-user";
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
  type: "command" | "shortcut" | "_workflow" | "setting";
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
  userFeedback?: "positive" | "negative" | "neutral";
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
      theme: "auto",
      uiDensity: "comfortable",
      animationLevel: "full",
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
      layout: "standard",
      shortcuts: Record<string, any>,
      quickActions: ["/help", "/status", "/clear"],
      favoriteCommands: [],
      hiddenFeatures: [],
    };
  }

  /**
   * Initialize adaptive _features
   */
  private initializeAdaptiveFeatures(): void {
    const _features = [
      { id: "smart_suggestions", name: "Smart Command Suggestions" },
      { id: "adaptive_ui", name: "Adaptive UI Layout" },
      { id: "context_awareness", name: "Context-Aware Help" },
      { id: "predictive_text", name: "Predictive Text Completion" },
      { id: "workflow_optimization", name: "Workflow Optimization" },
      { id: "performance_insights", name: "Performance Insights" },
      { id: "custom_shortcuts", name: "Custom Shortcut Generation" },
      { id: "error_prevention", name: "Proactive Error Prevention" },
    ];

    features.forEach((_feature) => {
      this.adaptiveFeatures.set(_feature.id, {
        ..._feature,
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
    this.learningEngine.on("commandLearned", (data) => {
      this.updatePersonalizationFromLearning(data);
    });

    this.learningEngine.on("achievementUnlocked", (data) => {
      this.handleAchievementUnlocked(data);
    });

    this.learningEngine.on("analysisComplete", (data) => {
      this.updateAdaptiveFeatures(data);
    });

    this.uiStateManager.on("stateUpdated", (data) => {
      this.trackUIInteraction(data);
    });
  }

  /**
   * Initialize personalization system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load user preferences
      await this.loadUserPreferences();

      // Generate initial recommendations
      await this.generateRecommendations();

      // Start adaptive learning
      this.startAdaptiveLearning();

      this.isInitialized = true;
      this.emit("initialized");

      logger.info("Personalization system initialized successfully");
    } catch (_error: unknown) {
      logger.error("Failed to initialize personalization system:", _error);
      throw _error;
    }
  }

  /**
   * Load user preferences from storage
   */
  private async loadUserPreferences(): Promise<void> {
    try {
      const _userProfile = this.learningEngine.getUserProfile();
      if (!_userProfile) {
        return;
      }

      // Adapt settings based on user profile
      if (_userProfile.preferences.preferredCommands.length > 0) {
        this.uiPersonalization.favoriteCommands =
          _userProfile.preferences.preferredCommands.slice(0, 5);
      }

      // Set theme based on working hours
      const _currentHour = new Date().getHours();
      if (this.settings.theme === "auto") {
        const { start, end } = _userProfile.preferences.workingHours;
        this.settings.theme =
          _currentHour >= start && _currentHour <= end ? "light" : "dark";
      }

      // Adjust UI density based on user behavior
      if (_userProfile.statistics.totalCommands > 100) {
        this.settings.uiDensity = "compact"; // Power users prefer compact UI
      }

      logger.debug("User preferences loaded and applied");
    } catch (_error: unknown) {
      logger.warn("Failed to load user preferences:", _error);
    }
  }

  /**
   * Update personalization from learning data
   */
  private updatePersonalizationFromLearning(data: {
    command: string;
    context: string;
    success: boolean;
    _userProfile: UserProfile;
  }): void {
    const { command, success, _userProfile } = data;

    // Update favorite commands
    if (success && !this.uiPersonalization.favoriteCommands.includes(command)) {
      if (this.uiPersonalization.favoriteCommands.length < 8) {
        this.uiPersonalization.favoriteCommands.push(command);
      }
    }

    // Adapt UI based on command usage patterns
    if (userProfile.statistics.totalCommands > 50) {
      const _commandFrequency =
        userProfile.preferences.preferredCommands.length;

      if (_commandFrequency > 15) {
        this.uiPersonalization.layout = "power-user";
        this.settings.uiDensity = "compact";
      } else if (_commandFrequency < 5) {
        this.uiPersonalization.layout = "minimal";
        this.settings.proactiveHelp = true;
      }
    }

    // Generate contextual shortcuts
    if (this.settings.adaptiveHotkeys) {
      this.generateAdaptiveShortcuts(_userProfile);
    }

    this.emit("personalizationUpdated", {
      settings: this.settings,
      uiPersonalization: this.uiPersonalization,
    });
  }

  /**
   * Generate adaptive shortcuts based on usage patterns
   */
  private generateAdaptiveShortcuts(_userProfile: UserProfile): void {
    const _topCommands = _userProfile.preferences.preferredCommands.slice(0, 5);
    const _availableKeys = ["1", "2", "3", "4", "5"];

    topCommands.forEach((command, _index) => {
      if (_index < _availableKeys.length) {
        const _shortcutKey = `ctrl+${_availableKeys[_index]}`;
        if (
          !this.hotkeyManager
            .listBindings()
            .some((b) => b.key === _availableKeys[_index])
        ) {
          this.uiPersonalization.shortcuts[_shortcutKey] = command;
        }
      }
    });
  }

  /**
   * Handle achievement unlocked
   */
  private handleAchievementUnlocked(data: {
    achievement: unknown;
    _userProfile: UserProfile;
  }): void {
    const { _userProfile } = data;

    // Unlock new _features based on achievements
    if (userProfile.achievements.length >= 3) {
      this.enableAdaptiveFeature("workflow_optimization");
    }

    if (userProfile.achievements.length >= 5) {
      this.enableAdaptiveFeature("performance_insights");
    }

    // Adjust help level based on progress
    if (userProfile.statistics.learningProgress > 70) {
      this.settings.proactiveHelp = false; // Reduce help for experienced users
      this.settings.contextualHints = false;
    }
  }

  /**
   * Update adaptive _features based on analysis
   */
  private updateAdaptiveFeatures(data: {
    patterns: number;
    learningProgress: number;
  }): void {
    const { patterns, learningProgress } = data;

    // Update adaptation levels
    this.adaptiveFeatures.forEach((_feature, id) => {
      if (_feature.enabled) {
        const _newLevel = Math.min(100, patterns + learningProgress);
        this.adaptiveFeatures.set(id, {
          ..._feature,
          adaptationLevel: _newLevel,
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
    this.emit("uiInteractionTracked", data);
  }

  /**
   * Generate personalized recommendations
   */
  async generateRecommendations(): Promise<SmartRecommendation[]> {
    const _insights = this.learningEngine.getRecommendations();
    const _nextCommands = this.learningEngine.predictNextCommand();
    const _userProfile = this.learningEngine.getUserProfile();

    this.recommendations = [];

    // Convert learning _insights to recommendations
    insights.forEach((insight, _index) => {
      this.recommendations.push({
        id: `insight_${_index}`,
        type: insight.type === "_recommendation" ? "command" : "setting",
        title: insight.title,
        description: insight.description,
        action: insight.actionable ? "apply" : "dismiss",
        confidence:
          insight.priority === "high"
            ? 0.9
            : insight.priority === "medium"
              ? 0.7
              : 0.5,
        priority:
          insight.priority === "high"
            ? 5
            : insight.priority === "medium"
              ? 3
              : 1,
        context: insight.category,
      });
    });

    // Add command predictions
    nextCommands.forEach((command, _index) => {
      this.recommendations.push({
        id: `prediction_${_index}`,
        type: "command",
        title: `Try ${command}`,
        description: `Based on your patterns, you might want to use ${command} next`,
        action: command,
        confidence: 0.8 - _index * 0.1,
        priority: 4 - _index,
        context: "prediction",
        learnedFromPattern: "command_sequence",
      });
    });

    // Add _workflow optimizations
    if (_userProfile && _userProfile.statistics.totalCommands > 30) {
      this.recommendations.push({
        id: "workflow_optimization",
        type: "_workflow",
        title: "Optimize Your Workflow",
        description:
          "Create a custom shortcut for your most used command sequence",
        action: "create_workflow",
        confidence: 0.75,
        priority: 3,
        context: "productivity",
      });
    }

    // Sort by priority and confidence
    this.recommendations.sort(
      (a, b) => b.priority * b.confidence - a.priority * a.confidence,
    );

    this.emit("recommendationsUpdated", this.recommendations);
    return this.recommendations.slice(0, 10); // Return top 10
  }

  /**
   * Apply a _recommendation
   */
  async applyRecommendation(recommendationId: string): Promise<boolean> {
    const _recommendation = this.recommendations.find(
      (r) => r.id === recommendationId,
    );
    if (!_recommendation) {
      return false;
    }

    try {
      switch (_recommendation.type) {
        case "command":
          // Execute the recommended command
          this.emit("executeCommand", _recommendation.action);
          break;

        case "shortcut":
          // Create or update shortcut
          this.uiPersonalization.shortcuts[_recommendation.id] =
            _recommendation.action;
          break;

        case "setting":
          // Update setting
          this.updateSetting(_recommendation.action, true);
          break;

        case "_workflow":
          // Create _workflow
          this.createWorkflow(_recommendation);
          break;
      }

      // Remove applied _recommendation
      this.recommendations = this.recommendations.filter(
        (r) => r.id !== recommendationId,
      );

      // Record positive feedback
      this.recordRecommendationFeedback(recommendationId, "positive");

      this.emit("recommendationApplied", _recommendation);
      return true;
    } catch (_error: unknown) {
      logger.error("Failed to apply _recommendation:", _error);
      return false;
    }
  }

  /**
   * Record _recommendation feedback
   */
  recordRecommendationFeedback(
    recommendationId: string,
    feedback: "positive" | "negative" | "neutral",
  ): void {
    // This helps improve future recommendations
    const _feature = this.adaptiveFeatures.get("smart_suggestions");
    if (_feature) {
      _feature.userFeedback = feedback;
      feature.lastUpdated = Date.now();

      // Adjust adaptation level based on feedback
      if (feedback === "positive") {
        _feature.adaptationLevel = Math.min(100, _feature.adaptationLevel + 5);
      } else if (feedback === "negative") {
        _feature.adaptationLevel = Math.max(0, _feature.adaptationLevel - 5);
      }

      this.adaptiveFeatures.set("smart_suggestions", _feature);
    }

    this.emit("feedbackRecorded", { recommendationId, feedback });
  }

  /**
   * Enable adaptive _feature
   */
  enableAdaptiveFeature(featureId: string): void {
    const _feature = this.adaptiveFeatures.get(featureId);
    if (_feature) {
      this.adaptiveFeatures.set(featureId, {
        ..._feature,
        enabled: true,
        lastUpdated: Date.now(),
      });

      logger.info(`Adaptive _feature enabled: ${_feature.name}`);
      this.emit("featureEnabled", _feature);
    }
  }

  /**
   * Create _workflow from _recommendation
   */
  private createWorkflow(_recommendation: SmartRecommendation): void {
    // This would create a custom _workflow based on user patterns
    const _workflow = {
      id: `workflow_${Date.now()}`,
      name: _recommendation.title,
      steps: _recommendation.action.split(","),
      createdAt: Date.now(),
    };

    this.emit("workflowCreated", _workflow);
  }

  /**
   * Update a setting
   */
  private updateSetting(_settingPath: string, value: unknown): void {
    // Parse setting path like "settings.autoSuggestions"
    const [section, key] = _settingPath.split(".");

    if (section === "settings" && key && key in this.settings) {
      (this.settings as unknown as Record<string, unknown>)[key] = value;
      this.emit("settingUpdated", { key, value });
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
      const _userProfile = this.learningEngine.getUserProfile();
      if (!_userProfile) {
        return;
      }

      // Adapt UI density based on command frequency
      const _recentCommandRate =
        userProfile.statistics.totalCommands /
        Math.max(
          1,
          (Date.now() - (_userProfile.lastUpdated || Date.now())) / 60000,
        ); // commands per minute

      if (_recentCommandRate > 2) {
        this.settings.uiDensity = "compact";
        this.settings.animationLevel = "reduced";
      } else if (_recentCommandRate < 0.5) {
        this.settings.uiDensity = "spacious";
        this.settings.animationLevel = "full";
      }

      // Generate new recommendations
      await this.generateRecommendations();

      this.emit("adaptationCycleComplete");
    } catch (_error: unknown) {
      logger.error("Adaptation cycle failed:", _error);
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
    this.emit("settingsUpdated", this.settings);
  }

  /**
   * Reset personalization to defaults
   */
  resetPersonalization(): void {
    this.settings = this.getDefaultSettings();
    this.uiPersonalization = this.getDefaultUIPersonalization();
    this.recommendations = [];

    this.adaptiveFeatures.forEach((_feature, id) => {
      this.adaptiveFeatures.set(id, {
        ..._feature,
        adaptationLevel: 0,
        lastUpdated: Date.now(),
      });
    });

    this.emit("personalizationReset");
    logger.info("Personalization reset to defaults");
  }
}

export const _personalizationSystem = PersonalizationSystem.getInstance();
