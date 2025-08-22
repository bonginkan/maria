/**
 * Internal Mode Service - Main Orchestrator
 *
 * Central service for managing MARIA CODE's internal mode system.
 * Integrates with Intelligent Router for real-time mode recognition and switching.
 */

import { EventEmitter } from 'events';
import chalk from 'chalk';
import {
  ModeDefinition,
  ModeContext,
  ModeRecognitionResult,
  ModeTransition,
  ModeConfig,
  ModeServiceEvents,
  ModeHistoryEntry,
} from './types';
import { ModeDefinitionRegistry, getModeRegistry } from './ModeDefinitionRegistry';
import { ModeRecognitionEngine } from './ModeRecognitionEngine';
import { ModeDisplayManager } from './ModeDisplayManager';
import { ModeHistoryTracker } from './ModeHistoryTracker';

export class InternalModeService extends EventEmitter {
  private modeRegistry: ModeDefinitionRegistry;
  private recognitionEngine: ModeRecognitionEngine;
  private displayManager: ModeDisplayManager;
  private historyTracker: ModeHistoryTracker;

  private currentMode: ModeDefinition | null = null;
  private config: ModeConfig;
  private initialized: boolean = false;
  private recognitionInProgress: boolean = false;

  constructor(config: Partial<ModeConfig> = {}) {
    super();

    this.config = {
      confidenceThreshold: 0.85,
      autoSwitchEnabled: true,
      confirmationRequired: false,
      showTransitions: true,
      animationEnabled: true,
      colorEnabled: true,
      learningEnabled: true,
      patternTrackingEnabled: true,
      feedbackEnabled: true,
      defaultLanguage: 'en',
      supportedLanguages: ['en', 'ja', 'cn', 'ko', 'vn'],
      maxHistoryEntries: 1000,
      maxPatterns: 500,
      recognitionTimeout: 200,
      ...config,
    };

    this.modeRegistry = getModeRegistry();
    this.recognitionEngine = new ModeRecognitionEngine(this.modeRegistry, this.config);
    this.displayManager = new ModeDisplayManager(this.config);
    this.historyTracker = new ModeHistoryTracker(this.config);

    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log(chalk.cyan('🧠 Initializing Internal Mode Service...'));

      // Initialize all components
      await Promise.all([
        this.modeRegistry.initialize(),
        this.recognitionEngine.initialize(),
        this.displayManager.initialize(),
        this.historyTracker.initialize(),
      ]);

      // Set initial mode to "Thinking"
      const thinkingMode = this.modeRegistry.getModeById('thinking');
      if (thinkingMode) {
        await this.setMode(thinkingMode, 'manual', true);
      }

      this.initialized = true;
      this.emit('initialized');

      console.log(chalk.green('✅ Internal Mode Service initialized successfully'));
      console.log(chalk.gray(`📊 Loaded ${this.modeRegistry.getModeCount()} modes`));
    } catch (error) {
      console.error(chalk.red('Failed to initialize Internal Mode Service:'), error);
      throw error;
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
      return null; // Avoid concurrent recognition
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

      const recognition = await this.recognitionEngine.recognizeMode(fullContext);
      this.emit('recognition:completed', recognition);

      if (recognition && recognition.confidence >= this.config.confidenceThreshold) {
        if (this.config.autoSwitchEnabled) {
          const shouldConfirm = this.config.confirmationRequired && recognition.confidence < 0.95;

          if (shouldConfirm) {
            this.emit('mode:suggested', recognition);
          } else {
            await this.switchToMode(recognition.mode, 'intent');
          }
        } else {
          this.emit('mode:suggested', recognition);
        }
      }

      return recognition;
    } catch (error) {
      console.error(chalk.red('Mode recognition error:'), error);
      this.emit('mode:error', error as Error);
      return null;
    } finally {
      this.recognitionInProgress = false;
    }
  }

  /**
   * Manually set a specific mode
   */
  async setMode(
    mode: ModeDefinition | string,
    trigger: 'manual' | 'intent' | 'context' = 'manual',
    isInitial: boolean = false,
  ): Promise<boolean> {
    try {
      const modeDefinition = typeof mode === 'string' ? this.modeRegistry.getModeById(mode) : mode;

      if (!modeDefinition) {
        throw new Error(`Mode not found: ${mode}`);
      }

      return await this.switchToMode(modeDefinition, trigger, isInitial);
    } catch (error) {
      console.error(chalk.red('Failed to set mode:'), error);
      this.emit('mode:error', error as Error);
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
  searchModes(query: string, language?: string): ModeDefinition[] {
    return this.modeRegistry.searchModes(query, language || this.config.defaultLanguage);
  }

  /**
   * Get mode by ID
   */
  getModeById(id: string): ModeDefinition | undefined {
    return this.modeRegistry.getModeById(id);
  }

  /**
   * Get mode history
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
  async provideFeedback(modeId: string, wasCorrect: boolean, userInput?: string): Promise<void> {
    if (!this.config.feedbackEnabled) return;

    try {
      await this.historyTracker.recordFeedback(modeId, wasCorrect, userInput);

      // Update recognition engine with feedback
      if (userInput) {
        await this.recognitionEngine.updateFromFeedback(userInput, modeId, wasCorrect);
      }

      this.emit('learning:updated', this.historyTracker.getUserPatterns());
    } catch (error) {
      console.error(chalk.red('Failed to record feedback:'), error);
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
    mostUsedModes: Array<{ mode: string; count: number }>;
  } {
    const history = this.historyTracker.getHistory();
    const modeUsage = new Map<string, number>();

    const totalConfidence = 0;
    const confidenceCount = 0;

    history.forEach((entry) => {
      const currentCount = modeUsage.get(entry.mode.id) || 0;
      modeUsage.set(entry.mode.id, currentCount + 1);
    });

    // Calculate average confidence from recent recognitions
    // This would need to be tracked separately in a real implementation

    const mostUsedModes = Array.from(modeUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mode, count]) => ({ mode, count }));

    return {
      totalModes: this.modeRegistry.getModeCount(),
      currentMode: this.currentMode?.id || null,
      modeChanges: history.length,
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      mostUsedModes,
    };
  }

  /**
   * Export mode data for backup/transfer
   */
  async exportData(): Promise<{
    config: ModeConfig;
    history: ModeHistoryEntry[];
    patterns: unknown[];
  }> {
    return {
      config: this.config,
      history: this.historyTracker.getHistory(),
      patterns: this.historyTracker.getUserPatterns(),
    };
  }

  /**
   * Import mode data from backup
   */
  async importData(data: {
    config?: Partial<ModeConfig>;
    history?: ModeHistoryEntry[];
    patterns?: unknown[];
  }): Promise<void> {
    if (data.config) {
      this.updateConfig(data.config);
    }

    if (data.history) {
      await this.historyTracker.importHistory(data.history);
    }

    if (data.patterns) {
      await this.historyTracker.importPatterns(data.patterns);
    }
  }

  /**
   * Reset to default state
   */
  async reset(): Promise<void> {
    this.currentMode = null;
    await this.historyTracker.clear();

    // Reset to thinking mode
    const thinkingMode = this.modeRegistry.getModeById('thinking');
    if (thinkingMode) {
      await this.setMode(thinkingMode, 'manual', true);
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
    mode: ModeDefinition,
    trigger: 'manual' | 'intent' | 'context',
    isInitial: boolean = false,
  ): Promise<boolean> {
    const previousMode = this.currentMode;

    // Don't switch if it's the same mode (unless initial)
    if (!isInitial && previousMode && previousMode.id === mode.id) {
      return true;
    }

    try {
      // Create transition record
      const transition: ModeTransition = {
        from: previousMode?.id || '',
        to: mode.id,
        trigger: trigger as unknown,
        confidence: 1.0, // Would be from recognition result in real implementation
        automatic: trigger !== 'manual',
        timestamp: new Date(),
      };

      // Update current mode
      this.currentMode = mode;

      // Record in history
      await this.historyTracker.recordTransition(transition);

      // Display mode change
      if (this.config.showTransitions && !isInitial) {
        await this.displayManager.showModeTransition(mode, previousMode);
      } else if (isInitial) {
        await this.displayManager.showMode(mode);
      }

      // Emit events
      this.emit('mode:changed', transition);

      return true;
    } catch (error) {
      console.error(chalk.red('Failed to switch mode:'), error);
      this.emit('mode:error', error as Error);
      return false;
    }
  }

  private setupEventListeners(): void {
    // Handle recognition engine events
    this.recognitionEngine.on('recognition:completed', (result: ModeRecognitionResult) => {
      this.emit('recognition:completed', result);
    });

    this.recognitionEngine.on('error', (error: Error) => {
      this.emit('mode:error', error);
    });

    // Handle history tracker events
    this.historyTracker.on('pattern:learned', (patterns) => {
      this.emit('learning:updated', patterns);
    });
  }
}

// Singleton instance
let modeServiceInstance: InternalModeService | null = null;

export function getInternalModeService(config?: Partial<ModeConfig>): InternalModeService {
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
