/**
 * BaseMode - Base class for all cognitive mode plugins
 * Provides common functionality and lifecycle management for mode plugins
 */

import { EventEmitter } from "node:events";
import { _ServiceEvent } from "../../../core/types";

export interface ModeContext {
  sessionId: string;
  userId: string;
  input?: string;
  previousMode?: string;
  confidence?: number;
  metadata?: any;
  timestamp: number;
}

export interface ModeResult {
  success: boolean;
  output?: string;
  suggestions?: string[];
  nextRecommendedMode?: string;
  confidence?: number;
  _duration?: number;
  metadata?: any;
}

export interface ModeConfig {
  id: string;
  name: string;
  category: string;
  symbol: string;
  color: string;
  description: string;
  keywords: string[];
  triggers: string[];
  examples: string[];
  enabled?: boolean;
  priority?: number;
  _timeout?: number; // milliseconds
  maxConcurrentSessions?: number;
}

export interface ModeMetrics {
  activations: number;
  totalDuration: number;
  averageDuration: number;
  successRate: number;
  lastUsed: number;
  averageConfidence: number;
  errorCount: number;
}

export abstract class BaseMode extends EventEmitter {
  public readonly config: ModeConfig;
  protected activeSessions: Set<string> = new Set();
  protected metrics: ModeMetrics;
  protected _startTime: Date = new Date();

  constructor(_config: ModeConfig) {
    super();
    this._config = {
      enabled: true,
      priority: 5,
      _timeout: 30000, // 30 seconds default
      maxConcurrentSessions: 10,
      ..._config,
    };

    this.metrics = {
      activations: 0,
      totalDuration: 0,
      averageDuration: 0,
      successRate: 1.0,
      lastUsed: 0,
      averageConfidence: 0.8,
      errorCount: 0,
    };
  }

  /**
   * Activate the mode for a session
   */
  async activate(context: ModeContext): Promise<void> {
    try {
      // Check concurrent session limit
      if (this.activeSessions.size >= this.config.maxConcurrentSessions!) {
        throw new Error(
          `Maximum concurrent sessions (${this.config.maxConcurrentSessions}) exceeded for mode ${this.config.id}`,
        );
      }

      // Check if mode is enabled
      if (!this.config.enabled) {
        throw new Error(`Mode ${this.config.id} is disabled`);
      }

      this.activeSessions.add(context.sessionId);
      this.metrics.activations++;
      this.metrics.lastUsed = context.timestamp;

      // Emit activation event
      this.emit("mode:activated", {
        mode: this.config.id,
        sessionId: context.sessionId,
        context,
      });

      // Mode-specific activation
      await this.onActivate(context);
    } catch (_error) {
      this.metrics.errorCount++;
      this.emit("mode:_error", {
        mode: this.config.id,
        sessionId: context.sessionId,
        _error,
        phase: "activation",
      });
      throw _error;
    }
  }

  /**
   * Deactivate the mode for a session
   */
  async deactivate(sessionId: string): Promise<void> {
    try {
      if (this.activeSessions.has(sessionId)) {
        this.activeSessions.delete(sessionId);

        // Emit deactivation event
        this.emit("mode:deactivated", {
          mode: this.config.id,
          sessionId,
        });

        // Mode-specific deactivation
        await this.onDeactivate(sessionId);
      }
    } catch (_error) {
      this.metrics.errorCount++;
      this.emit("mode:_error", {
        mode: this.config.id,
        sessionId,
        _error,
        phase: "deactivation",
      });
      throw _error;
    }
  }

  /**
   * Process input in this mode
   */
  async process(_input: string, context: ModeContext): Promise<ModeResult> {
    const _startTime = Date.now();

    try {
      // Check if session is active
      if (!this.activeSessions.has(context.sessionId)) {
        throw new Error(
          `Session ${context.sessionId} is not active for mode ${this.config.id}`,
        );
      }

      // Set up _timeout
      const _timeout = this.config._timeout!;
      const _timeoutPromise = new Promise<never>((_resolve, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `Mode ${this.config.id} processing _timeout after ${_timeout}ms`,
              ),
            ),
          _timeout,
        );
      });

      // Process with _timeout
      const _result = await Promise.race([
        this.onProcess(_input, context),
        _timeoutPromise,
      ]);

      // Update metrics
      const _duration = Date.now() - _startTime;
      this.updateMetrics(_duration, _result.success, _result.confidence || 0.8);

      // Emit processing event
      this.emit("mode:processed", {
        mode: this.config.id,
        sessionId: context.sessionId,
        input: "",
        _result,
        _duration,
      });

      return _result;
    } catch (_error) {
      const _duration = Date.now() - _startTime;
      this.metrics.errorCount++;
      this.updateMetrics(_duration, false, 0);

      this.emit("mode:_error", {
        mode: this.config.id,
        sessionId: context.sessionId,
        _error,
        phase: "processing",
        input: "",
      });

      return {
        success: false,
        output: `Error in ${this.config.name}: ${_error instanceof Error ? _error.message : String(_error)}`,
        confidence: 0,
        _duration,
      };
    }
  }

  /**
   * Check if mode can handle the given input
   */
  async canHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ canHandle: boolean; confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0;

    // Check keywords
    const _inputLower = input.toLowerCase();
    const _keywordMatches = this.config.keywords.filter((keyword) =>
      inputLower.includes(keyword.toLowerCase()),
    );

    if (_keywordMatches.length > 0) {
      confidence += Math.min(0.4, _keywordMatches.length * 0.1);
      reasoning.push(`Keywords matched: ${_keywordMatches.join(", ")}`);
    }

    // Check triggers
    const _triggerMatches = this.config.triggers.filter((trigger) =>
      inputLower.includes(trigger.toLowerCase()),
    );

    if (_triggerMatches.length > 0) {
      confidence += Math.min(0.3, _triggerMatches.length * 0.1);
      reasoning.push(`Triggers matched: ${_triggerMatches.join(", ")}`);
    }

    // Mode-specific matching logic
    const _customResult = await this.onCanHandle(input, context);
    confidence += _customResult.confidence;
    reasoning.push(..._customResult.reasoning);

    // Apply priority bonus
    confidence += (this.config.priority || 5) * 0.02;
    reasoning.push(`Priority bonus: ${this.config.priority || 5}`);

    return {
      canHandle: confidence > 0.3,
      confidence: Math.min(confidence, 1.0),
      reasoning,
    };
  }

  /**
   * Get mode status and metrics
   */
  getStatus(): {
    config: ModeConfig;
    metrics: ModeMetrics;
    activeSessions: number;
    uptime: number;
  } {
    return {
      config: this.config,
      metrics: this.metrics,
      activeSessions: this.activeSessions.size,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Update mode configuration
   */
  updateConfig(updates: Partial<ModeConfig>): void {
    Object.assign(this.config, updates);

    this.emit("mode:config_updated", {
      mode: this.config.id,
      updates,
    });
  }

  /**
   * Reset mode metrics
   */
  resetMetrics(): void {
    this.metrics = {
      activations: 0,
      totalDuration: 0,
      averageDuration: 0,
      successRate: 1.0,
      lastUsed: 0,
      averageConfidence: 0.8,
      errorCount: 0,
    };

    this.emit("mode:metrics_reset", {
      mode: this.config.id,
    });
  }

  /**
   * Update metrics after processing
   */
  private updateMetrics(
    _duration: number,
    success: boolean,
    confidence: number,
  ): void {
    this.metrics.totalDuration += _duration;
    this.metrics.averageDuration =
      this.metrics.totalDuration / this.metrics.activations;

    // Update success rate (exponential moving average)
    const _alpha = 0.1;
    this.metrics.successRate =
      (1 - _alpha) * this.metrics.successRate + _alpha * (success ? 1 : 0);

    // Update average confidence (exponential moving average)
    this.metrics.averageConfidence =
      (1 - _alpha) * this.metrics.averageConfidence + _alpha * confidence;
  }

  // Abstract methods to be implemented by mode plugins

  /**
   * Mode-specific activation logic
   */
  protected abstract onActivate(_context: ModeContext): Promise<void>;

  /**
   * Mode-specific deactivation logic
   */
  protected abstract onDeactivate(_sessionId: string): Promise<void>;

  /**
   * Mode-specific processing logic
   */
  protected abstract onProcess(
    _input: string,
    _context: ModeContext,
  ): Promise<ModeResult>;

  /**
   * Mode-specific matching logic
   */
  protected abstract onCanHandle(
    _input: string,
    _context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }>;
}
