/**
 * Advanced AI Learning Engine - Core of Phase 4
 * Implements _pattern recognition, context evolution, and self-optimization
 */

import { EventEmitter } from "node:events";
import * as fs from "fs/promises";
import * as path from "path";
import { reportingEngine } from "../active-reporting/ReportingEngine";

// Types
export interface DeveloperPattern {
  id: string;
  type:
    | "command_sequence"
    | "code_style"
    | "workflow"
    | "preference"
    | "error_pattern";
  _pattern: any;
  frequency: number;
  successRate: number;
  context: PatternContext;
  metadata: {
    developer?: string;
    project?: string;
    firstSeen: number;
    lastSeen: number;
    confidence: number;
    reinforcements: number;
  };
}

export interface PatternContext {
  language?: string;
  framework?: string;
  projectType?: string;
  timeOfDay?: string;
  sessionDuration?: number;
  previousActions?: string[];
}

export interface LearningMetrics {
  patternsLearned: number;
  recognitionAccuracy: number;
  predictionSuccess: number;
  adaptationRate: number;
  memoryUsage: number;
  learningVelocity: number;
}

export interface Prediction {
  action: string;
  confidence: number;
  reasoning: string;
  alternatives: Array<{ action: string; confidence: number }>;
  basedOnPatterns: string[];
}

export interface OptimizationResult {
  parameter: string;
  oldValue: any;
  _newValue: any;
  improvement: number;
  reasoning: string;
}

/**
 * Main Learning Engine implementing advanced AI learning capabilities
 */
export class LearningEngine extends EventEmitter {
  private static instance: LearningEngine;
  private _patterns: Map<string, DeveloperPattern> = new Map();
  private contextHistory: PatternContext[] = [];
  private metrics: LearningMetrics;
  private isLearning: boolean = true;
  private readonly storagePath: string;
  private readonly maxPatterns: number = 10000;
  private readonly minConfidence: number = 0.6;
  private optimizationParameters: Map<string, any> = new Map();

  private constructor() {
    super();
    this.storagePath = path.join(process.env.HOME || "", ".maria", "learning");
    this.metrics = {
      patternsLearned: 0,
      recognitionAccuracy: 0,
      predictionSuccess: 0,
      adaptationRate: 0,
      memoryUsage: 0,
      learningVelocity: 0,
    };
    this.initializeParameters();
    this.loadPatterns();
  }

  public static getInstance(): LearningEngine {
    if (!LearningEngine.instance) {
      LearningEngine.instance = new LearningEngine();
    }
    return LearningEngine.instance;
  }

  /**
   * Learn a new _pattern from developer actions
   */
  public async learnPattern(
    actions: string[],
    outcome: { success: boolean; duration?: number; error?: string },
  ): Promise<DeveloperPattern | null> {
    if (!this.isLearning || actions.length === 0) {
      return null;
    }

    // Extract _pattern from actions
    const _pattern = this.extractPattern(actions);
    if (!_pattern) {
      return null;
    }

    // Check if _pattern exists
    const _existingPattern = this.findSimilarPattern(_pattern);

    if (_existingPattern) {
      // Reinforce _existing _pattern
      this.reinforcePattern(_existingPattern, outcome);
      await this.savePattern(_existingPattern);

      reportingEngine.communicate({
        type: "info",
        message: `🧠 Pattern reinforced: ${_existingPattern.type} (confidence: ${_existingPattern.metadata.confidence.toFixed(2)})`,
        priority: "low",
      });

      return _existingPattern;
    } else {
      // Create new _pattern
      const _newPattern = this.createPattern(_pattern, actions, outcome);

      if (_newPattern.metadata.confidence >= this.minConfidence) {
        this.patterns.set(_newPattern.id, _newPattern);
        this.metrics.patternsLearned++;
        await this.savePattern(_newPattern);

        reportingEngine.communicate({
          type: "success",
          message: `🎯 New _pattern learned: ${_newPattern.type}`,
          priority: "medium",
        });

        this.emit("_pattern:learned", _newPattern);
        return _newPattern;
      }
    }

    return null;
  }

  /**
   * Recognize _patterns in _current context
   */
  public recognizePatterns(
    _context: PatternContext,
    actions?: string[],
  ): DeveloperPattern[] {
    const recognized: DeveloperPattern[] = [];

    for (const _pattern of this.patterns.values()) {
      const _similarity = this.calculateContextSimilarity(
        _context,
        _pattern._context,
      );

      if (_similarity > 0.7) {
        // Check if actions match _pattern
        if (actions && _pattern.type === "command_sequence") {
          const _actionMatch = this.matchActionSequence(
            actions,
            _pattern._pattern,
          );
          if (_actionMatch > 0.8) {
            recognized.push(_pattern);
          }
        } else if (!actions) {
          // Context-only matching
          recognized.push(_pattern);
        }
      }
    }

    // Sort by confidence and frequency
    return recognized.sort((a, b) => {
      const _scoreA = a.metadata.confidence * a.frequency;
      const _scoreB = b.metadata.confidence * b.frequency;
      return _scoreB - _scoreA;
    });
  }

  /**
   * Predict next developer action
   */
  public async predictNextAction(
    context: PatternContext,
    recentActions: string[],
  ): Promise<Prediction> {
    // Find relevant _patterns
    const _relevantPatterns = this.recognizePatterns(context);

    if (_relevantPatterns.length === 0) {
      return {
        action: "unknown",
        confidence: 0,
        reasoning: "No matching _patterns found",
        alternatives: [],
        basedOnPatterns: [],
      };
    }

    // Analyze sequences
    const _predictions = this.analyzeSequences(
      _relevantPatterns,
      recentActions,
    );

    // Weight _predictions
    const _weightedPredictions = this.weightPredictions(_predictions, context);

    // Select _best prediction
    const _best = _weightedPredictions[0];

    return {
      action: _best.action,
      confidence: _best.confidence,
      reasoning: this.generateReasoning(_best, _relevantPatterns),
      alternatives: _weightedPredictions.slice(1, 4).map((p) => ({
        action: p.action,
        confidence: p.confidence,
      })),
      basedOnPatterns: _relevantPatterns.slice(0, 3).map((p) => p.id),
    };
  }

  /**
   * Self-optimize based on performance metrics
   */
  public async selfOptimize(): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    reportingEngine.reportStatus({
      operation: "self_optimization",
      status: "started",
      details: { currentMetrics: this.metrics },
    });

    // Optimize confidence threshold
    const _confidenceOpt = this.optimizeConfidenceThreshold();
    if (_confidenceOpt) results.push(_confidenceOpt);

    // Optimize _pattern retention
    const _retentionOpt = await this.optimizePatternRetention();
    if (_retentionOpt) results.push(_retentionOpt);

    // Optimize context weights
    const _contextOpt = this.optimizeContextWeights();
    if (_contextOpt) results.push(_contextOpt);

    // Update learning rate
    const _learningRateOpt = this.optimizeLearningRate();
    if (_learningRateOpt) results.push(_learningRateOpt);

    reportingEngine.reportStatus({
      operation: "self_optimization",
      status: "completed",
      details: {
        optimizations: results.length,
        improvements: results.map((r) => r.improvement),
      },
    });

    this.emit("optimization:complete", results);
    return results;
  }

  /**
   * Track context evolution
   */
  public trackContextEvolution(context: PatternContext): void {
    this.contextHistory.push({
      ...context,
      timeOfDay: new Date().getHours().toString(),
    });

    // Keep only _recent history
    if (this.contextHistory.length > 1000) {
      this.contextHistory = this.contextHistory.slice(-1000);
    }

    // Analyze evolution
    this.analyzeContextEvolution();
  }

  /**
   * Get learning metrics
   */
  public getMetrics(): LearningMetrics {
    // Update memory usage
    this.metrics.memoryUsage = this.calculateMemoryUsage();

    // Calculate learning velocity
    this.metrics.learningVelocity = this.calculateLearningVelocity();

    return { ...this.metrics };
  }

  /**
   * Export learned _patterns for sharing
   */
  public async exportPatterns(
    filter?: Partial<DeveloperPattern>,
  ): Promise<DeveloperPattern[]> {
    let _patterns = Array.from(this._patterns.values());

    if (filter) {
      _patterns = _patterns.filter((p) => {
        for (const [key, value] of Object.entries(filter)) {
          if (p[key as keyof DeveloperPattern] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return _patterns;
  }

  /**
   * Import _patterns from external source
   */
  public async importPatterns(_patterns: DeveloperPattern[]): Promise<number> {
    let imported = 0;

    for (const _pattern of _patterns) {
      // Validate _pattern
      if (this.validatePattern(_pattern)) {
        // Check for conflicts
        const _existing = this.patterns.get(_pattern.id);
        if (
          !_existing ||
          _existing.metadata.confidence < _pattern.metadata.confidence
        ) {
          this.patterns.set(_pattern.id, _pattern);
          imported++;
        }
      }
    }

    if (imported > 0) {
      await this.saveAllPatterns();
      reportingEngine.communicate({
        type: "success",
        message: `📥 Imported ${imported} _patterns successfully`,
        priority: "medium",
      });
    }

    return imported;
  }

  /**
   * Private helper methods
   */
  private initializeParameters(): void {
    this.optimizationParameters.set("confidenceThreshold", 0.6);
    this.optimizationParameters.set("learningRate", 0.1);
    this.optimizationParameters.set("_contextWeight", 0.3);
    this.optimizationParameters.set("_frequencyWeight", 0.4);
    this.optimizationParameters.set("_successWeight", 0.3);
  }

  private async loadPatterns(): Promise<void> {
    try {
      const _patternsFile = path.join(this.storagePath, "patterns.json");
      const _data = await fs.readFile(_patternsFile, "utf-8");
      const _patterns = JSON.parse(_data) as DeveloperPattern[];

      for (const _pattern of _patterns) {
        this._patterns.set(_pattern.id, _pattern);
      }

      this.metrics.patternsLearned = _patterns.length;
    } catch (error) {
      // No _existing _patterns or error reading
      await this.ensureStorageDirectory();
    }
  }

  private async savePattern(_pattern: DeveloperPattern): Promise<void> {
    await this.ensureStorageDirectory();
    const _patternsFile = path.join(this.storagePath, "patterns.json");

    try {
      const _patterns = Array.from(this._patterns.values());
      await fs.writeFile(_patternsFile, JSON.stringify(_patterns, null, 2));
    } catch (innerError) {
      console.error("Failed to save _pattern:", error);
    }
  }

  private async saveAllPatterns(): Promise<void> {
    await this.ensureStorageDirectory();
    const _patternsFile = path.join(this.storagePath, "patterns.json");

    const _patterns = Array.from(this._patterns.values());
    await fs.writeFile(_patternsFile, JSON.stringify(_patterns, null, 2));
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private extractPattern(actions: string[]): unknown {
    if (actions.length < 2) return null;

    // Simple _sequence _pattern extraction
    return {
      _sequence: actions,
      length: actions.length,
      uniqueActions: new Set(actions).size,
      repetitions: this.findRepetitions(actions),
    };
  }

  private findRepetitions(actions: string[]): number {
    const _counts = new Map<string, number>();
    for (const action of actions) {
      _counts.set(action, (_counts.get(action) || 0) + 1);
    }
    return Math.max(..._counts.values());
  }

  private findSimilarPattern(_pattern: unknown): DeveloperPattern | null {
    for (const _existing of this.patterns.values()) {
      if (_existing.type === "command_sequence") {
        const _similarity = this.calculatePatternSimilarity(
          _pattern,
          _existing.pattern,
        );
        if (_similarity > 0.8) {
          return _existing;
        }
      }
    }
    return null;
  }

  private calculatePatternSimilarity(
    _pattern1: unknown,
    pattern2: unknown,
  ): number {
    if (!_pattern1.sequence || !pattern2.sequence) return 0;

    const _seq1 = _pattern1.sequence;
    const _seq2 = pattern2.sequence;

    if (_seq1.length !== _seq2.length) {
      return 0;
    }

    let matches = 0;
    for (let i = 0; i < _seq1.length; i++) {
      if (_seq1[i] === _seq2[i]) matches++;
    }

    return matches / _seq1.length;
  }

  private reinforcePattern(_pattern: DeveloperPattern, outcome: unknown): void {
    // Update frequency
    pattern.frequency++;

    // Update success rate
    const _totalAttempts = _pattern.frequency;
    const _currentSuccesses = _pattern.successRate * (_totalAttempts - 1);
    pattern.successRate =
      (_currentSuccesses + (outcome.success ? 1 : 0)) / _totalAttempts;

    // Update confidence
    if (outcome.success) {
      _pattern.metadata.confidence = Math.min(
        1,
        _pattern.metadata.confidence * 1.1,
      );
    } else {
      _pattern.metadata.confidence = Math.max(
        0.1,
        _pattern.metadata.confidence * 0.9,
      );
    }

    // Update metadata
    _pattern.metadata.lastSeen = Date.now();
    pattern.metadata.reinforcements++;
  }

  private createPattern(
    _pattern: unknown,
    _actions: string[],
    outcome: unknown,
  ): DeveloperPattern {
    return {
      id: this.generateId(),
      type: "command_sequence",
      _pattern,
      frequency: 1,
      successRate: outcome.success ? 1 : 0,
      context: this.getCurrentContext(),
      metadata: {
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        confidence: outcome.success ? 0.7 : 0.3,
        reinforcements: 0,
      },
    };
  }

  private getCurrentContext(): PatternContext {
    return {
      timeOfDay: new Date().getHours().toString(),
      sessionDuration:
        Date.now() -
        (this.contextHistory[0]?.timeOfDay
          ? parseInt(this.contextHistory[0].timeOfDay)
          : Date.now()),
      previousActions: this.contextHistory
        .slice(-5)
        .map((c) => c.previousActions?.[0] || "")
        .filter(Boolean),
    };
  }

  private calculateContextSimilarity(
    _context1: PatternContext,
    context2: PatternContext,
  ): number {
    let _similarity = 0;
    let factors = 0;

    // Time of day _similarity
    if (_context1.timeOfDay && context2.timeOfDay) {
      const _diff = Math.abs(
        parseInt(_context1.timeOfDay) - parseInt(context2.timeOfDay),
      );
      _similarity += 1 - _diff / 12;
      factors++;
    }

    // Language _similarity
    if (_context1.language && context2.language) {
      _similarity += _context1.language === context2.language ? 1 : 0;
      factors++;
    }

    // Framework _similarity
    if (_context1.framework && context2.framework) {
      _similarity += _context1.framework === context2.framework ? 1 : 0;
      factors++;
    }

    return factors > 0 ? _similarity / factors : 0;
  }

  private matchActionSequence(_actions: string[], _pattern: unknown): number {
    if (!_pattern.sequence) return 0;

    const _patternSeq = _pattern.sequence;
    let maxMatch = 0;

    // Sliding window matching
    for (let i = 0; i <= _actions.length - _patternSeq.length; i++) {
      let matches = 0;
      for (let j = 0; j < _patternSeq.length; j++) {
        if (_actions[i + j] === _patternSeq[j]) matches++;
      }
      maxMatch = Math.max(maxMatch, matches / _patternSeq.length);
    }

    return maxMatch;
  }

  private analyzeSequences(
    _patterns: DeveloperPattern[],
    recentActions: string[],
  ): any[] {
    const _predictions: any[] = [];

    for (const _pattern of _patterns) {
      if (_pattern.type === "command_sequence" && _pattern._pattern._sequence) {
        const _sequence = _pattern._pattern._sequence;

        // Find position in _sequence
        for (let i = 0; i < _sequence.length - 1; i++) {
          if (_sequence[i] === recentActions[recentActions.length - 1]) {
            predictions.push({
              action: _sequence[i + 1],
              confidence: _pattern.metadata.confidence * _pattern.successRate,
              patternId: _pattern.id,
            });
          }
        }
      }
    }

    return _predictions;
  }

  private weightPredictions(
    _predictions: any[],
    context: PatternContext,
  ): any[] {
    const _contextWeight = this.optimizationParameters.get("_contextWeight");
    const _frequencyWeight =
      this.optimizationParameters.get("_frequencyWeight");
    const _successWeight = this.optimizationParameters.get("_successWeight");

    return _predictions
      .map((pred) => {
        const _pattern = this.patterns.get(pred.patternId);
        if (!_pattern) return pred;

        const _contextSim = this.calculateContextSimilarity(
          context,
          _pattern.context,
        );
        const _freqScore = Math.min(1, _pattern.frequency / 100);
        const _successScore = _pattern.successRate;

        pred.confidence =
          pred.confidence *
          (_contextSim * _contextWeight +
            _freqScore * _frequencyWeight +
            _successScore * _successWeight);

        return pred;
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  private generateReasoning(
    _prediction: unknown,
    _patterns: DeveloperPattern[],
  ): string {
    const _pattern = this._patterns.get(_prediction.patternId);
    if (!_pattern) return "Based on general _patterns";

    return `Based on ${_pattern.type} _pattern seen ${_pattern.frequency} times with ${(_pattern.successRate * 100).toFixed(0)}% success rate`;
  }

  private analyzeContextEvolution(): void {
    if (this.contextHistory.length < 10) return;

    // Analyze trends
    const _recent = this.contextHistory.slice(-10);
    const _languages = new Set(_recent.map((c) => c.language).filter(Boolean));
    const _frameworks = new Set(
      _recent.map((c) => c.framework).filter(Boolean),
    );

    // Detect focus areas
    if (_languages.size === 1) {
      this.emit("context:focus", {
        type: "language",
        value: Array.from(_languages)[0],
      });
    }
    if (_frameworks.size === 1) {
      this.emit("context:focus", {
        type: "framework",
        value: Array.from(_frameworks)[0],
      });
    }
  }

  private optimizeConfidenceThreshold(): OptimizationResult | null {
    const _current = this.optimizationParameters.get("confidenceThreshold");

    // Analyze _pattern performance
    const _highConfPatterns = Array.from(this.patterns.values()).filter(
      (p) => p.metadata.confidence > _current,
    );
    const _avgSuccess =
      _highConfPatterns.reduce((sum, p) => sum + p.successRate, 0) /
      _highConfPatterns.length;

    if (_avgSuccess > 0.9 && _current < 0.8) {
      const _newValue = Math.min(0.8, _current + 0.1);
      this.optimizationParameters.set("confidenceThreshold", _newValue);

      return {
        parameter: "confidenceThreshold",
        oldValue: _current,
        _newValue,
        improvement: (_newValue - _current) / _current,
        reasoning: "High success rate allows for stricter confidence threshold",
      };
    }

    return null;
  }

  private async optimizePatternRetention(): Promise<OptimizationResult | null> {
    if (this.patterns.size < this.maxPatterns * 0.9) {
      return null;
    }

    // Remove low-performing _patterns
    const toRemove: string[] = [];
    for (const [id, _pattern] of this.patterns) {
      if (
        pattern.metadata.confidence < 0.3 ||
        (pattern.frequency < 3 &&
          Date.now() - pattern.metadata.lastSeen > 7 * 24 * 60 * 60 * 1000)
      ) {
        toRemove.push(id);
      }
    }

    const _removed = toRemove.length;
    for (const id of toRemove) {
      this.patterns.delete(id);
    }

    if (_removed > 0) {
      await this.saveAllPatterns();

      return {
        parameter: "patternRetention",
        oldValue: this.patterns.size + _removed,
        _newValue: this.patterns.size,
        improvement: _removed / (this.patterns.size + _removed),
        reasoning: `Removed ${_removed} low-performing _patterns`,
      };
    }

    return null;
  }

  private optimizeContextWeights(): OptimizationResult | null {
    // This would require more sophisticated analysis
    // Placeholder for now
    return null;
  }

  private optimizeLearningRate(): OptimizationResult | null {
    const _current = this.optimizationParameters.get("learningRate");

    // Adjust based on _recent learning velocity
    if (this.metrics.learningVelocity > 10) {
      // Learning fast, can reduce rate
      const _newValue = Math.max(0.05, _current * 0.9);
      this.optimizationParameters.set("learningRate", _newValue);

      return {
        parameter: "learningRate",
        oldValue: _current,
        _newValue,
        improvement: 0.1,
        reasoning: "Reducing learning rate due to high velocity",
      };
    }

    return null;
  }

  private calculateMemoryUsage(): number {
    // Rough estimation in MB
    const _patternSize = JSON.stringify(
      Array.from(this.patterns.values()),
    ).length;
    const _contextSize = JSON.stringify(this.contextHistory).length;
    return (_patternSize + _contextSize) / (1024 * 1024);
  }

  private calculateLearningVelocity(): number {
    // Patterns learned per hour
    const _hoursSinceStart =
      (Date.now() -
        (this.patterns.values().next().value?.metadata.firstSeen ||
          Date.now())) /
      (1000 * 60 * 60);
    return _hoursSinceStart > 0
      ? this.metrics.patternsLearned / _hoursSinceStart
      : 0;
  }

  private validatePattern(_pattern: DeveloperPattern): boolean {
    return !!(
      _pattern.id &&
      _pattern.type &&
      _pattern.frequency >= 0 &&
      _pattern.successRate >= 0 &&
      _pattern.successRate <= 1 &&
      _pattern.metadata &&
      _pattern.metadata.confidence >= 0 &&
      pattern.metadata.confidence <= 1
    );
  }

  private generateId(): string {
    return `pat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const _learningEngine = LearningEngine.getInstance();
