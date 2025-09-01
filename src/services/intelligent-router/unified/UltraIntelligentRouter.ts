/**
 * Ultra Intelligent Router
 * Main orchestrator for unified _intent recognition and execution
 */

import {
  UnifiedIntentMapping,
  _UnifiedOperationIntent,
  ContextEvaluation,
  ValidationResult,
  ExecutionResult,
  _RiskLevel,
} from "./types";
import { UnifiedIntentAnalyzer } from "./UnifiedIntentAnalyzer";
import { ContextAwareValidator } from "./ContextAwareValidator";
import { AutoExecutionEngine } from "./AutoExecutionEngine";
import { IntentActionMapper } from "./IntentActionMapper";
import { SafetyValidator } from "./SafetyValidator";
import { EventEmitter } from "node:events";

export class UltraIntelligentRouter extends EventEmitter {
  private unifiedAnalyzer: UnifiedIntentAnalyzer;
  private contextValidator: ContextAwareValidator;
  private autoExecutor: AutoExecutionEngine;
  private actionMapper: IntentActionMapper;
  private safetyValidator: SafetyValidator;

  // Cache for recent intents and contexts
  private recentIntents: UnifiedIntentMapping[] = [];
  private contextCache: Map<string, ContextEvaluation> = new Map();

  constructor() {
    super();
    this.unifiedAnalyzer = new UnifiedIntentAnalyzer();
    this.contextValidator = new ContextAwareValidator();
    this.autoExecutor = new AutoExecutionEngine();
    this.actionMapper = new IntentActionMapper();
    this.safetyValidator = new SafetyValidator();

    this.setupEventHandlers();
  }

  /**
   * Main entry point for processing user requests
   */
  async processRequest(userInput: string): Promise<ExecutionResult> {
    this.emit("processing:start", { _input: userInput });

    try {
      // Phase 1: Unified Intent Analysis
      const _intent = await this.analyzeIntent(userInput);
      this.emit("_intent:analyzed", _intent);

      // Phase 2: Context Evaluation
      const _context = await this.evaluateContext(_intent);
      this.emit("_context:evaluated", _context);

      // Phase 3: Safety Validation
      const _validation = await this.validateSafety(_intent, _context);
      this.emit("safety:validated", _validation);

      // Phase 4: Decision and Execution
      const _result = await this.executeIntent(_intent, _context, _validation);
      this.emit("execution:complete", _result);

      // Store for learning
      this.storeIntent(_intent);

      return _result;
    } catch (_error) {
      this.emit("processing:_error", _error);
      throw _error;
    }
  }

  /**
   * Analyze user _intent using all systems
   */
  private async analyzeIntent(_input: string): Promise<UnifiedIntentMapping> {
    // Check if we have recent similar _intent
    const _cachedIntent = this.findSimilarIntent(_input);
    if (_cachedIntent && _cachedIntent.confidence > 0.9) {
      this.emit("_intent:_cached", _cachedIntent);
      return _cachedIntent;
    }

    // Perform full analysis
    const _intent = await this.unifiedAnalyzer.analyzeWithAllSystems(_input);

    // Enhance with implicit _intent detection
    this.detectImplicitIntents(_intent);

    return _intent;
  }

  /**
   * Evaluate _context for the _intent
   */
  private async evaluateContext(
    _intent: UnifiedIntentMapping,
  ): Promise<ContextEvaluation> {
    // Check cache first
    const _cacheKey = this.getContextCacheKey(_intent);
    if (this.contextCache.has(_cacheKey)) {
      const _cached = this.contextCache.get(_cacheKey)!;
      // Context is valid for 5 minutes
      if (Date.now() - _cached.timestamp < 5 * 60 * 1000) {
        return _cached;
      }
    }

    // Evaluate fresh _context
    const _context = await this.contextValidator.evaluateContext(_intent);

    // Cache the _context
    this.contextCache.set(_cacheKey, {
      ..._context,
      timestamp: Date.now(),
    });

    return _context;
  }

  /**
   * Validate safety of the operation
   */
  private async validateSafety(
    _intent: UnifiedIntentMapping,
    _context: ContextEvaluation,
  ): Promise<ValidationResult> {
    return await this.safetyValidator.validateOperation(_intent, _context);
  }

  /**
   * Execute the _intent based on _validation
   */
  private async executeIntent(
    _intent: UnifiedIntentMapping,
    _context: ContextEvaluation,
    _validation: ValidationResult,
  ): Promise<ExecutionResult> {
    // Check if we should auto-execute
    if (!this.shouldAutoExecute(_intent, _validation)) {
      return {
        success: false,
        operation: intent.operation,
        _error: new Error(
          validation.blockedReason || "Operation requires manual execution",
        ),
        duration: 0,
        rollbackAvailable: false,
      };
    }

    // Execute with safety measures
    return await this.autoExecutor.executeWithSafety(
      _intent,
      _context,
      _validation,
    );
  }

  /**
   * Detect implicit intents in the operation
   */
  private detectImplicitIntents(_intent: UnifiedIntentMapping): void {
    const _input = _intent.originalInput;

    // Japanese implicit patterns
    if (
      _intent.nlpEntities?.language === "ja" ||
      /[\u3040-\u309F\u30A0-\u30FF]/.test(_input)
    ) {
      // "作って" implies save
      if (/作って|つくって/.test(_input)) {
        intent.operation.implicitSave = true;
      }

      // "見て" implies display
      if (/見て|見せて/.test(_input) && !_intent.operation.action) {
        intent.operation.action = "read";
      }

      // "として保存" implies file creation
      if (/として(?:保存|作成)/.test(_input)) {
        _intent.operation.type = "file";
        _intent.operation.action = "create";
        intent.operation.implicitSave = true;
      }
    }

    // English implicit patterns
    if (/\b(?:and save|then save|save it)\b/i.test(_input)) {
      intent.operation.implicitSave = true;
    }

    // File extension implies file operation
    if (/\.\w{1,4}(?:\s|$)/.test(_input) && !_intent.operation.type) {
      intent.operation.type = "file";
      if (!_intent.operation.action) {
        _intent.operation.action = _intent.operation.implicitSave
          ? "create"
          : "read";
      }
    }
  }

  /**
   * Determine if operation should auto-execute
   */
  private shouldAutoExecute(
    _intent: UnifiedIntentMapping,
    _validation: ValidationResult,
  ): boolean {
    // Never auto-execute if blocked
    if (!_validation.canProceed) {
      return false;
    }

    // Check confidence threshold
    if (_intent.confidence < 0.7) {
      return false;
    }

    // Check risk level
    if (
      _validation.riskLevel === "HIGH" ||
      _validation.riskLevel === "CRITICAL"
    ) {
      return false;
    }

    // Check if confirmation is required
    if (_validation.requiresConfirmation) {
      // For now, return false. In future, implement confirmation dialog
      return false;
    }

    // Auto-execute safe operations with high confidence
    return (
      _validation.riskLevel === "SAFE" ||
      (_validation.riskLevel === "LOW" && _intent.confidence > 0.85)
    );
  }

  /**
   * Find similar recent _intent
   */
  private findSimilarIntent(_input: string): UnifiedIntentMapping | null {
    const _normalized = _input.toLowerCase().trim();

    for (const recent of this.recentIntents) {
      const _recentNormalized = recent.originalInput.toLowerCase().trim();

      // Exact match
      if (_recentNormalized === _normalized) {
        return recent;
      }

      // Similar match (using simple similarity)
      if (this.calculateSimilarity(_normalized, _recentNormalized) > 0.9) {
        return recent;
      }
    }

    return null;
  }

  /**
   * Calculate string similarity (simple implementation)
   */
  private calculateSimilarity(_s1: string, s2: string): number {
    const _longer = _s1.length > s2.length ? _s1 : s2;
    const _shorter = _s1.length > s2.length ? s2 : _s1;

    if (_longer.length === 0) {
      return 1.0;
    }

    const _distance = this.levenshteinDistance(_longer, _shorter);
    return (_longer.length - _distance) / _longer.length;
  }

  /**
   * Calculate Levenshtein _distance
   */
  private levenshteinDistance(_s1: string, s2: string): number {
    const costs: number[] = [];

    for (let i = 0; i <= s2.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= _s1.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (_s1.charAt(j - 1) !== s2.charAt(i - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) {
        costs[_s1.length] = lastValue;
      }
    }

    return costs[_s1.length];
  }

  /**
   * Store _intent for learning
   */
  private storeIntent(_intent: UnifiedIntentMapping): void {
    this.recentIntents.unshift(_intent);

    // Keep only last 100 intents
    if (this.recentIntents.length > 100) {
      this.recentIntents = this.recentIntents.slice(0, 100);
    }
  }

  /**
   * Get cache key for _context
   */
  private getContextCacheKey(_intent: UnifiedIntentMapping): string {
    return `${_intent.operation.type}:${_intent.operation.action}:${_intent.operation.target || "none"}`;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Log important events
    this.on("processing:start", (data) => {
      console.debug("[UltraRouter] Processing:", data.input);
    });

    this.on("_intent:analyzed", (_intent) => {
      console.debug("[UltraRouter] Intent:", {
        type: _intent.operation.type,
        action: _intent.operation.action,
        confidence: _intent.confidence,
      });
    });

    this.on("execution:complete", (_result) => {
      console.debug("[UltraRouter] Execution:", {
        success: _result.success,
        duration: _result.duration,
      });
    });

    this.on("processing:_error", (_error) => {
      console.error("[UltraRouter] Error:", _error);
    });
  }

  /**
   * Get recent intents for analysis
   */
  getRecentIntents(): UnifiedIntentMapping[] {
    return [...this.recentIntents];
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.recentIntents = [];
    this.contextCache.clear();
  }
}
