/**
 * Self-Evolution Engine
 * Continuous learning and optimization system for autonomous coding agent
 */

import { EventEmitter } from "node:events";
import * as fs from "fs/promises";
import * as path from "path";
import {
  CodingMode,
  ErrorPattern,
  ExecutionContext,
  LearningPattern,
  OptimizationSuggestion,
  Task,
} from "../types";

export interface EvolutionMetrics {
  _totalExecutions: number;
  _successRate: number;
  averageExecutionTime: number;
  _errorReductionRate: number;
  optimizationGains: number;
  patternAccuracy: number;
}

export class SelfEvolutionEngine extends EventEmitter {
  private learningPatterns: LearningPattern[] = [];
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private optimizationSuggestions: OptimizationSuggestion[] = [];
  private performanceBaseline: Map<string, number> = new Map();
  private userPreferences: Map<string, any> = new Map();
  private dataPath: string;
  private learningEnabled: boolean = true;
  private maxPatterns: number = 1000;

  constructor(_dataPath: string = "./data/evolution") {
    super();
    this._dataPath = _dataPath;
    this.initializeDataStructures();
  }

  /**
   * Learn from execution _pattern
   */
  async learn(_pattern: LearningPattern): Promise<void> {
    if (!this.learningEnabled) {
      return;
    }

    // Store learning _pattern
    this.learningPatterns.push(_pattern);

    // Limit patterns to prevent memory issues
    if (this.learningPatterns.length > this.maxPatterns) {
      this.learningPatterns = this.learningPatterns.slice(-this.maxPatterns);
    }

    // Update _error patterns if execution failed
    if (!pattern.success && pattern.errorPatterns) {
      for (const errorPattern of pattern.errorPatterns) {
        await this.updateErrorPattern(errorPattern);
      }
    }

    // Update performance baseline
    await this.updatePerformanceBaseline(_pattern);

    // Generate optimization suggestions
    await this.generateOptimizations(_pattern);

    // Update user preferences
    if (pattern.userFeedback) {
      await this.updateUserPreferences(_pattern);
    }

    // Persist learning data
    await this.persistLearningData();

    this.emit("patternLearned", _pattern);
  }

  /**
   * Predict optimal modes for a task
   */
  async predictOptimalModes(
    _task: Task,
    context: ExecutionContext,
  ): Promise<CodingMode[]> {
    // Find similar patterns
    const _similarPatterns = this.findSimilarPatterns(_task, context);

    if (_similarPatterns.length === 0) {
      // No patterns found, return default modes
      return this.getDefaultModesForTaskType(_task);
    }

    // Analyze successful patterns
    const _successfulPatterns = _similarPatterns.filter((p) => p.success);

    if (_successfulPatterns.length === 0) {
      // No successful patterns, learn from failures
      const _failedPatterns = _similarPatterns.filter((p) => !p.success);
      return this.generateAlternativeModes(_failedPatterns);
    }

    // Extract most effective _mode combinations
    const _modeFrequency = new Map<string, number>();
    const _modeSuccess = new Map<string, number>();

    for (const _pattern of _successfulPatterns) {
      for (const _mode of _pattern.modes) {
        const _key = `${_mode.category}:${_mode.name}`;
        _modeFrequency.set(_key, (_modeFrequency.get(_key) || 0) + 1);
        _modeSuccess.set(
          _key,
          (_modeSuccess.get(_key) || 0) + (_pattern.success ? 1 : 0),
        );
      }
    }

    // Sort by _effectiveness (_success rate * frequency)
    const _sortedModes = Array.from(_modeFrequency.entries())
      .map(([_key, frequency]) => {
        const _success = _modeSuccess.get(_key) || 0;
        const _effectiveness = (_success / frequency) * Math.log(frequency + 1);
        return { _key, _effectiveness, frequency, _success };
      })
      .sort((a, b) => b.effectiveness - a.effectiveness);

    // Convert back to CodingMode objects
    const predictedModes: CodingMode[] = [];
    for (const { _key } of _sortedModes) {
      const _mode = this.findModeByKey(_key, _successfulPatterns);
      if (_mode) {
        predictedModes.push(_mode);
      }
    }

    this.emit("modesPredict", { _task, predictedModes });
    return predictedModes;
  }

  /**
   * Get optimization suggestions for current context
   */
  getOptimizationSuggestions(
    context: ExecutionContext,
  ): OptimizationSuggestion[] {
    return this.optimizationSuggestions
      .filter((suggestion) => this.isApplicable(suggestion, context))
      .sort((a, b) => b.expectedGain - a.expectedGain)
      .slice(0, 5); // Top 5 suggestions
  }

  /**
   * Get evolution metrics
   */
  getEvolutionMetrics(): EvolutionMetrics {
    const _totalExecutions = this.learningPatterns.length;
    const _successfulExecutions = this.learningPatterns.filter(
      (p) => p.success,
    ).length;
    const _successRate =
      _totalExecutions > 0
        ? (_successfulExecutions / _totalExecutions) * 100
        : 0;

    const _avgExecutionTime =
      _totalExecutions > 0
        ? this.learningPatterns.reduce((sum, p) => sum + p.executionTime, 0) /
          _totalExecutions
        : 0;

    const _recentPatterns = this.learningPatterns.slice(-100);
    const _oldPatterns = this.learningPatterns.slice(-200, -100);

    const _recentSuccessRate =
      recentPatterns.length > 0
        ? _recentPatterns.filter((p) => p.success).length /
          _recentPatterns.length
        : 0;

    const _oldSuccessRate =
      _oldPatterns.length > 0
        ? _oldPatterns.filter((p) => p.success).length / _oldPatterns.length
        : 0;

    const _errorReductionRate =
      _oldSuccessRate > 0
        ? ((_recentSuccessRate - _oldSuccessRate) / _oldSuccessRate) * 100
        : 0;

    return {
      _totalExecutions,
      _successRate,
      averageExecutionTime: _avgExecutionTime,
      _errorReductionRate,
      optimizationGains: this.calculateOptimizationGains(),
      patternAccuracy: this.calculatePatternAccuracy(),
    };
  }

  /**
   * Check if recovery strategy _exists for _error
   */
  hasRecoveryStrategy(_error: string): boolean {
    return this.errorPatterns.has(_error);
  }

  /**
   * Get recovery strategy for _error
   */
  getRecoveryStrategy(_error: string): string | null {
    const _pattern = this.errorPatterns.get(_error);
    return _pattern ? _pattern.resolution : null;
  }

  /**
   * Initialize data structures
   */
  private async initializeDataStructures(): Promise<void> {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.loadPersistedData();
    } catch (_error) {
      console.warn("Could not initialize evolution data structures:", _error);
    }
  }

  /**
   * Load persisted learning data
   */
  private async loadPersistedData(): Promise<void> {
    try {
      const _patternsPath = path.join(this.dataPath, "patterns.json");
      const _errorsPath = path.join(this.dataPath, "errors.json");
      const _preferencesPath = path.join(this.dataPath, "preferences.json");

      // Load patterns
      try {
        const _patternsData = await fs.readFile(_patternsPath, "utf-8");
        this.learningPatterns = JSON.parse(_patternsData);
      } catch (_error) {
        // File doesn't exist or is corrupted, start fresh
        this.learningPatterns = [];
      }

      // Load _error patterns
      try {
        const _errorsData = await fs.readFile(_errorsPath, "utf-8");
        const _errorsArray = JSON.parse(_errorsData);
        this.errorPatterns = new Map(_errorsArray);
      } catch (_error) {
        this.errorPatterns = new Map();
      }

      // Load user preferences
      try {
        const _preferencesData = await fs.readFile(_preferencesPath, "utf-8");
        const _preferencesArray = JSON.parse(_preferencesData);
        this.userPreferences = new Map(_preferencesArray);
      } catch (_error) {
        this.userPreferences = new Map();
      }
    } catch (_error) {
      console.warn("Could not load persisted learning data:", _error);
    }
  }

  /**
   * Persist learning data to disk
   */
  private async persistLearningData(): Promise<void> {
    try {
      const _patternsPath = path.join(this.dataPath, "patterns.json");
      const _errorsPath = path.join(this.dataPath, "errors.json");
      const _preferencesPath = path.join(this.dataPath, "preferences.json");

      // Save patterns (only recent ones to manage file size)
      const _recentPatterns = this.learningPatterns.slice(-500);
      await fs.writeFile(
        _patternsPath,
        JSON.stringify(_recentPatterns, null, 2),
      );

      // Save _error patterns
      const _errorsArray = Array.from(this.errorPatterns.entries());
      await fs.writeFile(_errorsPath, JSON.stringify(_errorsArray, null, 2));

      // Save user preferences
      const _preferencesArray = Array.from(this.userPreferences.entries());
      await fs.writeFile(
        _preferencesPath,
        JSON.stringify(_preferencesArray, null, 2),
      );
    } catch (_error) {
      console.warn("Could not persist learning data:", _error);
    }
  }

  /**
   * Update _error _pattern knowledge
   */
  private async updateErrorPattern(errorPattern: ErrorPattern): Promise<void> {
    const _existing = this.errorPatterns.get(errorPattern.error);

    if (_existing) {
      existing.frequency += 1;
      // Update resolution if new one is provided
      if (
        errorPattern.resolution &&
        errorPattern.resolution !== _existing.resolution
      ) {
        existing.resolution = errorPattern.resolution;
      }
    } else {
      this.errorPatterns.set(errorPattern.error, {
        ...errorPattern,
        frequency: 1,
      });
    }
  }

  /**
   * Update performance baseline
   */
  private async updatePerformanceBaseline(
    _pattern: LearningPattern,
  ): Promise<void> {
    const _key = `${_pattern.task.type || "default"}:${_pattern.modes.map((m) => m.name).join("+")}`;
    const _existing = this.performanceBaseline.get(_key);

    if (_existing) {
      // Use exponential moving average
      const _alpha = 0.1;
      this.performanceBaseline.set(
        _key,
        _alpha * _pattern.executionTime + (1 - _alpha) * _existing,
      );
    } else {
      this.performanceBaseline.set(_key, _pattern.executionTime);
    }
  }

  /**
   * Generate optimization suggestions
   */
  private async generateOptimizations(
    _pattern: LearningPattern,
  ): Promise<void> {
    // Find similar successful patterns that were faster
    const _similarPatterns = this.learningPatterns.filter(
      (p) =>
        p.success &&
        p.context === pattern.context &&
        p.executionTime < pattern.executionTime,
    );

    for (const fasterPattern of _similarPatterns) {
      const _timeSaved = pattern.executionTime - fasterPattern.executionTime;
      const _improvement = (_timeSaved / pattern.executionTime) * 100;

      if (_improvement > 10) {
        // Only suggest if >10% _improvement
        const suggestion: OptimizationSuggestion = {
          _pattern: `Using ${fasterPattern.modes.map((m) => m.name).join(" + ")}`,
          _improvement: `${_improvement.toFixed(1)}% faster execution`,
          expectedGain: _improvement,
          confidence: Math.min(0.9, 0.5 + _improvement / 100),
        };

        // Check if we already have this suggestion
        const _exists = this.optimizationSuggestions.some(
          (s) => s.pattern === suggestion.pattern,
        );
        if (!_exists) {
          this.optimizationSuggestions.push(suggestion);
        }
      }
    }

    // Limit suggestions to prevent memory bloat
    this.optimizationSuggestions = this.optimizationSuggestions
      .sort((a, b) => b.expectedGain - a.expectedGain)
      .slice(0, 50);
  }

  /**
   * Update user preferences
   */
  private async updateUserPreferences(
    _pattern: LearningPattern,
  ): Promise<void> {
    const _modeNames = _pattern.modes.map((m) => m.name);

    for (const modeName of _modeNames) {
      const _key = `modepreference: ${modeName}`;
      const _currentRating = this.userPreferences.get(_key) || 3; // Default neutral

      // Update rating using weighted average
      const _weight = 0.2;
      const _newRating =
        _weight * (_pattern.userFeedback || 3) + (1 - _weight) * _currentRating;
      this.userPreferences.set(_key, _newRating);
    }

    // Update task type preferences
    if (_pattern.task.type) {
      const _taskKey = `taskpreference: ${_pattern.task.type}`;
      const _currentRating = this.userPreferences.get(_taskKey) || 3;
      const _weight = 0.15;
      const _newRating =
        _weight * (_pattern.userFeedback || 3) + (1 - _weight) * _currentRating;
      this.userPreferences.set(_taskKey, _newRating);
    }
  }

  /**
   * Find similar patterns for prediction
   */
  private findSimilarPatterns(
    _task: Task,
    context: ExecutionContext,
  ): LearningPattern[] {
    return this.learningPatterns.filter((_pattern) => {
      // Task similarity
      const _taskSimilarity = this.calculateTaskSimilarity(
        _task,
        pattern._task,
      );

      // Context similarity
      const _contextSimilarity = this.calculateContextSimilarity(
        context,
        _pattern,
      );

      // Combined similarity threshold
      return (_taskSimilarity + _contextSimilarity) / 2 > 0.6;
    });
  }

  /**
   * Calculate task similarity score
   */
  private calculateTaskSimilarity(_task1: Task, task2: Task): number {
    let similarity = 0;

    // Title similarity (simple word _overlap)
    const _words1 = _task1.title.toLowerCase().split(" ");
    const _words2 = task2.title.toLowerCase().split(" ");
    const _overlap = _words1.filter((word) => _words2.includes(word)).length;
    const _titleSimilarity =
      _overlap / Math.max(_words1.length, _words2.length);

    similarity += _titleSimilarity * 0.4;

    // Priority similarity
    if (_task1.priority === task2.priority) {
      similarity += 0.2;
    }

    // Type similarity (if available)
    if (_task1.assignee === task2.assignee) {
      similarity += 0.2;
    }

    // Description similarity (basic)
    const _desc1 = _task1.description.toLowerCase();
    const _desc2 = task2.description.toLowerCase();
    const _descSimilarity =
      _desc1.includes(_desc2.substring(0, 20)) ||
      _desc2.includes(_desc1.substring(0, 20))
        ? 0.2
        : 0;
    similarity += _descSimilarity;

    return Math.min(1, similarity);
  }

  /**
   * Calculate context similarity score
   */
  private calculateContextSimilarity(
    _context: ExecutionContext,
    _pattern: LearningPattern,
  ): number {
    let similarity = 0;

    // Basic context matching (simplified for this implementation)
    if (_pattern._context.includes("project") && _context.projectPath) {
      similarity += 0.3;
    }
    if (
      _pattern._context.includes("test") &&
      _context.currentTask?.title.includes("test")
    ) {
      similarity += 0.3;
    }
    if (
      _pattern._context.includes("deploy") &&
      _context.currentTask?.title.includes("deploy")
    ) {
      similarity += 0.4;
    }

    return Math.min(1, similarity);
  }

  /**
   * Get default modes for task type
   */
  private getDefaultModesForTaskType(_task: Task): CodingMode[] {
    // This would be more sophisticated in a real implementation
    const defaults: CodingMode[] = [
      { name: "Planning", symbol: "📋", category: "planning" },
      { name: "Executing", symbol: "⚡", category: "code_development" },
      { name: "Validating", symbol: "✅", category: "analysis" },
    ];

    return defaults;
  }

  /**
   * Generate alternative modes when patterns failed
   */
  private generateAlternativeModes(
    _failedPatterns: LearningPattern[],
  ): CodingMode[] {
    // Analyze failed modes and suggest alternatives
    const _failedModes = _failedPatterns.flatMap((p) => p.modes);
    const alternatives: CodingMode[] = [];

    // Simple alternative logic (would be more sophisticated in real implementation)
    for (const _mode of _failedModes) {
      if (_mode.category === "code_development") {
        alternatives.push({
          name: "AlternativeGeneration",
          symbol: "🔄",
          category: "code_development",
        });
      }
    }

    return alternatives.length > 0
      ? alternatives
      : this.getDefaultModesForTaskType({ title: "fallback" } as Task);
  }

  /**
   * Find _mode by _key in patterns
   */
  private findModeByKey(
    _key: string,
    patterns: LearningPattern[],
  ): CodingMode | null {
    for (const _pattern of patterns) {
      for (const _mode of _pattern.modes) {
        if (`${_mode.category}:${_mode.name}` === _key) {
          return _mode;
        }
      }
    }
    return null;
  }

  /**
   * Check if optimization suggestion is applicable
   */
  private isApplicable(
    _suggestion: OptimizationSuggestion,
    _context: ExecutionContext,
  ): boolean {
    // Simple applicability check (would be more sophisticated in real implementation)
    return _suggestion.confidence > 0.6;
  }

  /**
   * Calculate optimization gains
   */
  private calculateOptimizationGains(): number {
    return (
      this.optimizationSuggestions.reduce((sum, s) => sum + s.expectedGain, 0) /
        this.optimizationSuggestions.length || 0
    );
  }

  /**
   * Calculate _pattern accuracy
   */
  private calculatePatternAccuracy(): number {
    // This would measure how often our predictions were correct
    // For now, return a placeholder value
    return 85.5;
  }

  /**
   * Enable/disable learning
   */
  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
    this.emit("learningToggled", enabled);
  }

  /**
   * Get learning status
   */
  isLearningEnabled(): boolean {
    return this.learningEnabled;
  }

  /**
   * Clear all learning data
   */
  async clearLearningData(): Promise<void> {
    this.learningPatterns = [];
    this.errorPatterns.clear();
    this.optimizationSuggestions = [];
    this.performanceBaseline.clear();
    this.userPreferences.clear();

    await this.persistLearningData();
    this.emit("dataCleared");
  }
}

export default SelfEvolutionEngine;
