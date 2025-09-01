/**
 * Internal Mode Service - Main Orchestrator
 *
 * Central service for managing MARIA CODE's internal mode system.
 * Integrates with Intelligent Router for real-time mode _recognition and switching.
 */

import { EventEmitter } from "node:events";
import chalk from "chalk";
import {
  ModeConfig,
  ModeContext,
  ModeDefinition,
  ModeHistoryEntry,
  ModeRecognitionResult,
  ModeTransition,
  ModeTriggerType,
  UserPattern,
} from "./types";
import {
  getModeRegistry,
  ModeDefinitionRegistry,
} from "./ModeDefinitionRegistry";
import { ModeRecognitionEngine } from "./ModeRecognitionEngine";
import { ModeDisplayManager } from "./ModeDisplayManager";
import { ModeHistoryTracker } from "./ModeHistoryTracker";

export class InternalModeService extends EventEmitter {
  private modeRegistry: ModeDefinitionRegistry;
  private recognitionEngine: ModeRecognitionEngine;
  private displayManager: ModeDisplayManager;
  private historyTracker: ModeHistoryTracker;

  private currentMode: ModeDefinition | null = null;
  private config: ModeConfig;
  private initialized: boolean = false;
  private recognitionInProgress: boolean = false;

  constructor(_config: Partial<ModeConfig> = {}) {
    super();

    this._config = {
      confidenceThreshold: 0.85,
      autoSwitchEnabled: true,
      confirmationRequired: false,
      showTransitions: true,
      animationEnabled: true,
      colorEnabled: true,
      learningEnabled: true,
      patternTrackingEnabled: true,
      feedbackEnabled: true,
      defaultLanguage: "en",
      supportedLanguages: ["en", "ja", "cn", "ko", "vn"],
      maxHistoryEntries: 1000,
      maxPatterns: 500,
      recognitionTimeout: 200,
      ..._config,
    };

    this.modeRegistry = getModeRegistry();
    this.recognitionEngine = new ModeRecognitionEngine(
      this.modeRegistry,
      this._config,
    );
    this.displayManager = new ModeDisplayManager(this._config);
    this.historyTracker = new ModeHistoryTracker(this._config);

    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Internal Mode Service quietly

      // Initialize all components
      await Promise.all([
        this.modeRegistry.initialize(),
        this.recognitionEngine.initialize(),
        this.displayManager.initialize(),
        this.historyTracker.initialize(),
      ]);

      // Set initial mode to "Thinking"
      const _thinkingMode = this.modeRegistry.getModeById("thinking");
      if (_thinkingMode) {
        await this.setMode(_thinkingMode, "manual", true);
      }

      this.initialized = true;
      this.emit("initialized");

      // Internal Mode Service initialized
      // Modes loaded
    } catch (_error) {
      console._error(
        chalk.red("Failed to initialize Internal Mode Service:"),
        _error,
      );
      throw _error;
    }
  }

  /**
   * Recognize and potentially switch mode based on user input
   */
  async recognizeMode(
    userInput: string,
    context: Partial<ModeContext> = {},
  ): Promise<ModeRecognitionResult | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.recognitionInProgress) {
      return null; // Avoid concurrent _recognition
    }

    this.recognitionInProgress = true;

    try {
      const fullContext: ModeContext = {
        currentMode: this.currentMode || undefined,
        previousModes: this.historyTracker.getRecentModes(5),
        userInput,
        language: context.language || this.config.defaultLanguage,
        commandHistory: context.commandHistory || [],
        projectContext: context.projectContext,
        errorState: context.errorState,
        userPatterns: this.historyTracker.getUserPatterns(),
        timestamp: new Date(),
        ...context,
      };

      const _recognition =
        await this.recognitionEngine.recognizeMode(fullContext);
      this.emit("_recognition:completed", _recognition);

      if (
        _recognition &&
        _recognition.confidence >= this.config.confidenceThreshold
      ) {
        if (this.config.autoSwitchEnabled) {
          const _shouldConfirm =
            this.config.confirmationRequired && _recognition.confidence < 0.95;

          if (_shouldConfirm) {
            this.emit("mode:suggested", _recognition);
          } else {
            await this.switchToMode(_recognition.mode, "intent");
          }
        } else {
          this.emit("mode:suggested", _recognition);
        }
      }

      return _recognition;
    } catch (_error) {
      console._error(chalk.red("Mode _recognition _error:"), _error);
      this.emit("mode:_error", _error as Error);
      return null;
    } finally {
      this.recognitionInProgress = false;
    }
  }

  /**
   * Manually set a specific mode
   */
  async setMode(
    _mode: ModeDefinition | string,
    trigger: "manual" | "intent" | "context" = "manual",
    isInitial: boolean = false,
  ): Promise<boolean> {
    try {
      const _modeDefinition =
        typeof _mode === "string"
          ? this.modeRegistry.getModeById(_mode)
          : _mode;

      if (!_modeDefinition) {
        throw new Error(`Mode not found: ${_mode}`);
      }

      return await this.switchToMode(_modeDefinition, trigger, isInitial);
    } catch (_error) {
      console._error(chalk.red("Failed to set mode:"), _error);
      this.emit("mode:_error", _error as Error);
      return false;
    }
  }

  /**
   * Get current mode
   */
  getCurrentMode(): ModeDefinition | null {
    return this.currentMode;
  }

  /**
   * Get all available modes
   */
  getAllModes(): ModeDefinition[] {
    return this.modeRegistry.getAllModes();
  }

  /**
   * Search modes by query
   */
  searchModes(_query: string, language?: string): ModeDefinition[] {
    return this.modeRegistry.searchModes(
      _query,
      language || this.config.defaultLanguage,
    );
  }

  /**
   * Get mode by ID
   */
  getModeById(id: string): ModeDefinition | undefined {
    return this.modeRegistry.getModeById(id);
  }

  /**
   * Get mode _history
   */
  getModeHistory(): ModeHistoryEntry[] {
    return this.historyTracker.getHistory();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ModeConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update component configs
    this.recognitionEngine.updateConfig(this.config);
    this.displayManager.updateConfig(this.config);
    this.historyTracker.updateConfig(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ModeConfig {
    return { ...this.config };
  }

  /**
   * Provide feedback on mode accuracy
   */
  async provideFeedback(
    _modeId: string,
    wasCorrect: boolean,
    userInput?: string,
  ): Promise<void> {
    if (!this.config.feedbackEnabled) {
      return;
    }

    try {
      await this.historyTracker.recordFeedback(_modeId, wasCorrect, userInput);

      // Update _recognition engine with feedback
      if (userInput) {
        await this.recognitionEngine.updateFromFeedback(
          userInput,
          _modeId,
          wasCorrect,
        );
      }

      this.emit("learning:updated", this.historyTracker.getUserPatterns());
    } catch (_error) {
      console._error(chalk.red("Failed to record feedback:"), _error);
    }
  }

  /**
   * Get mode statistics
   */
  getStatistics(): {
    totalModes: number;
    currentMode: string | null;
    modeChanges: number;
    averageConfidence: number;
    _mostUsedModes: Array<{ mode: string; count: number }>;
  } {
    const _history = this.historyTracker.getHistory();
    const _modeUsage = new Map<string, number>();

    const _totalConfidence = 0;
    const _confidenceCount = 0;

    history.forEach((entry) => {
      const _currentCount = _modeUsage.get(entry.mode.id) || 0;
      modeUsage.set(entry.mode.id, _currentCount + 1);
    });

    // Calculate average confidence from recent recognitions
    // This would need to be tracked separately in a real implementation

    const _mostUsedModes = Array.from(_modeUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mode, count]) => ({ mode, count }));

    return {
      totalModes: this.modeRegistry.getModeCount(),
      currentMode: this.currentMode?.id || null,
      modeChanges: _history.length,
      averageConfidence:
        _confidenceCount > 0 ? _totalConfidence / _confidenceCount : 0,
      _mostUsedModes,
    };
  }

  /**
   * Export mode data for backup/transfer
   */
  async exportData(): Promise<{
    config: ModeConfig;
    _history: ModeHistoryEntry[];
    patterns: unknown[];
  }> {
    return {
      config: this.config,
      _history: this.historyTracker.getHistory(),
      patterns: this.historyTracker.getUserPatterns(),
    };
  }

  /**
   * Import mode data from backup
   */
  async importData(data: {
    config?: Partial<ModeConfig>;
    _history?: ModeHistoryEntry[];
    patterns?: unknown[];
  }): Promise<void> {
    if (data.config) {
      this.updateConfig(data.config);
    }

    if (data.history) {
      await this.historyTracker.importHistory(data.history);
    }

    if (data.patterns) {
      await this.historyTracker.importPatterns(data.patterns as UserPattern[]);
    }
  }

  /**
   * Reset to default state
   */
  async reset(): Promise<void> {
    this.currentMode = null;
    await this.historyTracker.clear();

    // Reset to thinking mode
    const _thinkingMode = this.modeRegistry.getModeById("thinking");
    if (_thinkingMode) {
      await this.setMode(_thinkingMode, "manual", true);
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.removeAllListeners();
    this.initialized = false;
    this.currentMode = null;
  }

  // Private methods

  private async switchToMode(
    _mode: ModeDefinition,
    trigger: "manual" | "intent" | "context",
    isInitial: boolean = false,
  ): Promise<boolean> {
    const _previousMode = this.currentMode;

    // Don't switch if it's the same mode (unless initial)
    if (!isInitial && _previousMode && _previousMode.id === _mode.id) {
      return true;
    }

    try {
      // Create transition record
      const transition: ModeTransition = {
        from: _previousMode?.id || "",
        to: _mode.id,
        trigger: trigger as ModeTriggerType,
        confidence: 1.0, // Would be from _recognition result in real implementation
        automatic: trigger !== "manual",
        timestamp: new Date(),
      };

      // Update current mode
      this.currentMode = _mode;

      // Record in _history
      await this.historyTracker.recordTransition(transition);

      // Display mode change (skip initial mode to keep startup clean)
      if (this.config.showTransitions && !isInitial) {
        await this.displayManager.showModeTransition(
          _mode,
          _previousMode || undefined,
        );
      }
      // Skip display for initial mode to prevent startup noise

      // Emit events
      this.emit("mode:changed", transition);

      return true;
    } catch (_error) {
      console._error(chalk.red("Failed to switch mode:"), _error);
      this.emit("mode:_error", _error as Error);
      return false;
    }
  }

  private setupEventListeners(): void {
    // Handle _recognition engine events
    this.recognitionEngine.on(
      "_recognition:completed",
      (_result: ModeRecognitionResult) => {
        this.emit("_recognition:completed", _result);
      },
    );

    this.recognitionEngine.on("_error", (_error: Error) => {
      this.emit("mode:_error", _error);
    });

    // Handle _history tracker events
    this.historyTracker.on("pattern:learned", (patterns) => {
      this.emit("learning:updated", patterns);
    });
  }
}

// Singleton instance
let modeServiceInstance: InternalModeService | null = null;

export function getInternalModeService(
  config?: Partial<ModeConfig>,
): InternalModeService {
  if (!modeServiceInstance) {
    modeServiceInstance = new InternalModeService(config);
  }
  return modeServiceInstance;
}

export function resetInternalModeService(): void {
  if (modeServiceInstance) {
    modeServiceInstance.dispose();
    modeServiceInstance = null;
  }
}
