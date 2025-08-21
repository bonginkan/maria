/**
 * Base Mode Plugin - Abstract foundation for all cognitive mode plugins
 * Provides standard interface and lifecycle management for mode plugins
 */

import { BaseService, Service, ServiceEvent } from '../core';

export type ModeCategory =
  | 'reasoning'
  | 'creative'
  | 'analytical'
  | 'structural'
  | 'validation'
  | 'contemplative'
  | 'intensive'
  | 'learning'
  | 'collaborative';

export interface ModeContext {
  sessionId: string;
  userId?: string;
  input: string;
  language: string;
  previousMode?: string;
  confidence: number;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface ModeResult {
  success: boolean;
  output?: string;
  nextMode?: string;
  confidence: number;
  executionTime: number;
  metadata: Record<string, any>;
  error?: string;
}

export interface ModeDisplayConfig {
  symbol: string;
  color: string;
  animation?: 'pulse' | 'rotate' | 'bounce' | 'glow' | 'fade';
  description: string;
  displayName: string;
  category: ModeCategory;
}

export interface ModeTrigger {
  pattern: string | RegExp;
  language: string;
  weight: number;
  contextRequirements?: string[];
}

export interface ModeTransition {
  fromMode: string;
  toMode: string;
  condition: (context: ModeContext) => boolean;
  priority: number;
  description: string;
}

/**
 * Abstract base class for all mode plugins
 */
export abstract class BaseModePlugin extends BaseService {
  // Plugin identification
  abstract readonly pluginId: string;
  abstract readonly pluginName: string;
  abstract readonly category: ModeCategory;
  abstract readonly version: string;

  // Mode configuration
  abstract readonly triggers: ModeTrigger[];
  abstract readonly transitions: ModeTransition[];

  // Plugin metadata
  protected startTime = Date.now();
  protected executionCount = 0;
  protected successCount = 0;
  protected averageExecutionTime = 0;
  protected lastExecution?: Date;

  // Plugin lifecycle hooks
  async onPluginLoad(): Promise<void> {
    this.logger.info(`Loading mode plugin: ${this.pluginName}`);
  }

  async onPluginUnload(): Promise<void> {
    this.logger.info(`Unloading mode plugin: ${this.pluginName}`);
  }

  /**
   * Main execution method - must be implemented by each mode plugin
   */
  abstract execute(context: ModeContext): Promise<ModeResult>;

  /**
   * Get display configuration for UI rendering
   */
  abstract getDisplayConfig(): ModeDisplayConfig;

  /**
   * Check if this mode can handle the given context
   */
  async canHandle(context: ModeContext): Promise<number> {
    let confidence = 0;

    // Check triggers against input
    for (const trigger of this.triggers) {
      const match = this.matchTrigger(trigger, context);
      if (match > 0) {
        confidence += match * trigger.weight;
      }
    }

    // Apply language-specific confidence adjustments
    confidence = this.adjustConfidenceForLanguage(confidence, context.language);

    // Apply context-specific boosts
    confidence = this.adjustConfidenceForContext(confidence, context);

    return Math.min(confidence, 1.0);
  }

  /**
   * Check if transition to target mode is allowed
   */
  canTransitionTo(targetModeId: string, context: ModeContext): boolean {
    // Find relevant transition rules
    const relevantTransitions = this.transitions.filter(
      (t) => t.toMode === targetModeId || t.toMode === '*',
    );

    if (relevantTransitions.length === 0) {
      // Allow transition if no specific rules defined
      return true;
    }

    // Check if any transition condition is met
    return relevantTransitions.some((transition) => transition.condition(context));
  }

  /**
   * Get transition priority to target mode
   */
  getTransitionPriority(targetModeId: string): number {
    const transition = this.transitions.find((t) => t.toMode === targetModeId || t.toMode === '*');
    return transition?.priority || 0;
  }

  /**
   * Validate mode execution context
   */
  protected validateContext(context: ModeContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!context.sessionId) {
      errors.push('Session ID is required');
    }
    if (!context.input?.trim()) {
      errors.push('Input is required');
    }
    if (!context.language) {
      errors.push('Language is required');
    }
    if (context.confidence < 0 || context.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute mode with error handling and metrics tracking
   */
  async executeWithTracking(context: ModeContext): Promise<ModeResult> {
    const startTime = performance.now();
    this.executionCount++;
    this.lastExecution = new Date();

    try {
      // Validate context
      const validation = this.validateContext(context);
      if (!validation.valid) {
        throw new Error(`Context validation failed: ${validation.errors.join(', ')}`);
      }

      // Execute mode logic
      const result = await this.execute(context);

      // Update metrics
      const executionTime = performance.now() - startTime;
      this.updateExecutionMetrics(executionTime, true);

      // Emit success event
      this.emitServiceEvent('mode:executed', {
        pluginId: this.pluginId,
        sessionId: context.sessionId,
        success: true,
        executionTime,
      });

      return {
        ...result,
        executionTime,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updateExecutionMetrics(executionTime, false);

      this.logger.error(`Mode execution failed for ${this.pluginId}:`, error);

      // Emit error event
      this.emitServiceEvent('mode:error', {
        pluginId: this.pluginId,
        sessionId: context.sessionId,
        error: error.message,
        executionTime,
      });

      return {
        success: false,
        confidence: 0,
        executionTime,
        metadata: {},
        error: error.message,
      };
    }
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    return {
      pluginId: this.pluginId,
      pluginName: this.pluginName,
      category: this.category,
      version: this.version,
      uptime: Date.now() - this.startTime,
      executionCount: this.executionCount,
      successCount: this.successCount,
      successRate: this.executionCount > 0 ? (this.successCount / this.executionCount) * 100 : 0,
      averageExecutionTime: this.averageExecutionTime,
      lastExecution: this.lastExecution,
      triggers: this.triggers.length,
      transitions: this.transitions.length,
    };
  }

  /**
   * Get health status with mode-specific metrics
   */
  async health() {
    const baseHealth = await super.health();

    return {
      ...baseHealth,
      plugin: {
        id: this.pluginId,
        category: this.category,
        executionCount: this.executionCount,
        successRate: this.executionCount > 0 ? (this.successCount / this.executionCount) * 100 : 0,
        averageExecutionTime: this.averageExecutionTime,
      },
    };
  }

  /**
   * Helper methods for trigger and confidence calculation
   */
  private matchTrigger(trigger: ModeTrigger, context: ModeContext): number {
    const { pattern, language } = trigger;
    const { input, language: contextLang } = context;

    // Skip if language doesn't match (unless trigger is for all languages)
    if (language !== '*' && language !== contextLang) {
      return 0;
    }

    if (typeof pattern === 'string') {
      // Simple string matching
      const normalizedInput = input.toLowerCase();
      const normalizedPattern = pattern.toLowerCase();

      if (normalizedInput.includes(normalizedPattern)) {
        return 1.0;
      }

      // Partial word matching
      const words = normalizedPattern.split(/\s+/);
      const matchedWords = words.filter((word) => normalizedInput.includes(word));

      return matchedWords.length / words.length;
    } else {
      // Regex pattern matching
      const match = input.match(pattern);
      return match ? 1.0 : 0;
    }
  }

  private adjustConfidenceForLanguage(confidence: number, language: string): number {
    // Override in subclasses for language-specific adjustments
    return confidence;
  }

  private adjustConfidenceForContext(confidence: number, context: ModeContext): number {
    // Previous mode context boost
    if (context.previousMode) {
      const prevModeBoost = this.getPreviousModeBoost(context.previousMode);
      confidence += prevModeBoost;
    }

    // User-specific confidence boost
    if (context.userId && context.metadata.userPreferences) {
      const userBoost = this.getUserPreferenceBoost(context.metadata.userPreferences);
      confidence += userBoost;
    }

    return confidence;
  }

  private getPreviousModeBoost(previousMode: string): number {
    // Find transition from previous mode
    const transition = this.transitions.find((t) => t.fromMode === previousMode);
    return transition ? 0.1 : 0;
  }

  private getUserPreferenceBoost(preferences: unknown): number {
    // Check if user prefers this category
    if (preferences.preferredCategories?.includes(this.category)) {
      return 0.15;
    }
    return 0;
  }

  private updateExecutionMetrics(executionTime: number, success: boolean): void {
    if (success) {
      this.successCount++;
    }

    // Update average execution time (exponential moving average)
    if (this.averageExecutionTime === 0) {
      this.averageExecutionTime = executionTime;
    } else {
      this.averageExecutionTime = this.averageExecutionTime * 0.9 + executionTime * 0.1;
    }
  }
}
