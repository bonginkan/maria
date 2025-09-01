/**
 * Base Mode Plugin - Abstract foundation for all cognitive mode plugins
 * Provides standard interface and lifecycle management for mode plugins
 */

import { BaseService, _Service, _ServiceEvent } from "../core";

export type ModeCategory =
  | "reasoning"
  | "creative"
  | "analytical"
  | "structural"
  | "_validation"
  | "contemplative"
  | "intensive"
  | "learning"
  | "collaborative";

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
  _executionTime: number;
  metadata: Record<string, any>;
  _error?: string;
}

export interface ModeDisplayConfig {
  symbol: string;
  color: string;
  animation?: "pulse" | "rotate" | "bounce" | "glow" | "fade";
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
  condition: (_context: ModeContext) => boolean;
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
  protected _startTime = Date.now();
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
  abstract execute(_context: ModeContext): Promise<ModeResult>;

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
      const _match = this.matchTrigger(trigger, _context);
      if (_match > 0) {
        confidence += _match * trigger.weight;
      }
    }

    // Apply language-specific confidence adjustments
    confidence = this.adjustConfidenceForLanguage(
      confidence,
      _context.language,
    );

    // Apply context-specific boosts
    confidence = this.adjustConfidenceForContext(confidence, _context);

    return Math.min(confidence, 1.0);
  }

  /**
   * Check if _transition to target mode is allowed
   */
  canTransitionTo(_targetModeId: string, context: ModeContext): boolean {
    // Find relevant _transition rules
    const _relevantTransitions = this.transitions.filter(
      (t) => t.toMode === _targetModeId || t.toMode === "*",
    );

    if (_relevantTransitions.length === 0) {
      // Allow _transition if no specific rules defined
      return true;
    }

    // Check if any _transition condition is met
    return _relevantTransitions.some((_transition) =>
      _transition.condition(_context),
    );
  }

  /**
   * Get _transition priority to target mode
   */
  getTransitionPriority(targetModeId: string): number {
    const _transition = this.transitions.find(
      (t) => t.toMode === targetModeId || t.toMode === "*",
    );
    return _transition?.priority || 0;
  }

  /**
   * Validate mode execution context
   */
  protected validateContext(context: ModeContext): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!_context.sessionId) {
      errors.push("Session ID is required");
    }
    if (!_context.input?.trim()) {
      errors.push("Input is required");
    }
    if (!_context.language) {
      errors.push("Language is required");
    }
    if (_context.confidence < 0 || _context.confidence > 1) {
      errors.push("Confidence must be between 0 and 1");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute mode with _error handling and metrics tracking
   */
  async executeWithTracking(context: ModeContext): Promise<ModeResult> {
    const _startTime = performance.now();
    this.executionCount++;
    this.lastExecution = new Date();

    try {
      // Validate context
      const _validation = this.validateContext(_context);
      if (!_validation.valid) {
        throw new Error(
          `Context _validation failed: ${_validation.errors.join(", ")}`,
        );
      }

      // Execute mode logic
      const _result = await this.execute(_context);

      // Update metrics
      const _executionTime = performance.now() - _startTime;
      this.updateExecutionMetrics(_executionTime, true);

      // Emit success event
      this.emitServiceEvent("mode:executed", {
        pluginId: this.pluginId,
        sessionId: _context.sessionId,
        success: true,
        _executionTime,
      });

      return {
        ..._result,
        _executionTime,
      };
    } catch (_error) {
      const _executionTime = performance.now() - _startTime;
      this.updateExecutionMetrics(_executionTime, false);

      this.logger.error(`Mode execution failed for ${this.pluginId}:`, _error);

      // Emit _error event
      this.emitServiceEvent("mode:_error", {
        pluginId: this.pluginId,
        sessionId: _context.sessionId,
        _error: _error.message,
        _executionTime,
      });

      return {
        success: false,
        confidence: 0,
        _executionTime,
        metadata: Record<string, any>,
        _error: _error.message,
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
      successRate:
        this.executionCount > 0
          ? (this.successCount / this.executionCount) * 100
          : 0,
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
    const _baseHealth = await super.health();

    return {
      ..._baseHealth,
      plugin: {
        id: this.pluginId,
        category: this.category,
        executionCount: this.executionCount,
        successRate:
          this.executionCount > 0
            ? (this.successCount / this.executionCount) * 100
            : 0,
        averageExecutionTime: this.averageExecutionTime,
      },
    };
  }

  /**
   * Helper methods for trigger and confidence calculation
   */
  private matchTrigger(_trigger: ModeTrigger, context: ModeContext): number {
    const { pattern, language } = trigger;
    const { input, language: contextLang } = context;

    // Skip if language doesn't _match (unless trigger is for all languages)
    if (language !== "*" && language !== contextLang) {
      return 0;
    }

    if (typeof pattern === "string") {
      // Simple string matching
      const _normalizedInput = input.toLowerCase();
      const _normalizedPattern = pattern.toLowerCase();

      if (_normalizedInput.includes(_normalizedPattern)) {
        return 1.0;
      }

      // Partial word matching
      const _words = _normalizedPattern.split(/\s+/);
      const _matchedWords = _words.filter((word) =>
        _normalizedInput.includes(word),
      );

      return _matchedWords.length / _words.length;
    } else {
      // Regex pattern matching
      const _match = input._match(pattern);
      return _match ? 1.0 : 0;
    }
  }

  private adjustConfidenceForLanguage(
    _confidence: number,
    _language: string,
  ): number {
    // Override in subclasses for language-specific adjustments
    return _confidence;
  }

  private adjustConfidenceForContext(
    _confidence: number,
    context: ModeContext,
  ): number {
    // Previous mode context boost
    if (_context.previousMode) {
      const _prevModeBoost = this.getPreviousModeBoost(_context.previousMode);
      confidence += _prevModeBoost;
    }

    // User-specific confidence boost
    if (_context.userId && _context.metadata.userPreferences) {
      const _userBoost = this.getUserPreferenceBoost(
        _context.metadata.userPreferences,
      );
      confidence += _userBoost;
    }

    return _confidence;
  }

  private getPreviousModeBoost(previousMode: string): number {
    // Find _transition from previous mode
    const _transition = this.transitions.find(
      (t) => t.fromMode === previousMode,
    );
    return _transition ? 0.1 : 0;
  }

  private getUserPreferenceBoost(preferences: unknown): number {
    // Check if user prefers this category
    if (preferences.preferredCategories?.includes(this.category)) {
      return 0.15;
    }
    return 0;
  }

  private updateExecutionMetrics(
    _executionTime: number,
    success: boolean,
  ): void {
    if (success) {
      this.successCount++;
    }

    // Update average execution time (exponential moving average)
    if (this.averageExecutionTime === 0) {
      this.averageExecutionTime = _executionTime;
    } else {
      this.averageExecutionTime =
        this.averageExecutionTime * 0.9 + _executionTime * 0.1;
    }
  }
}
