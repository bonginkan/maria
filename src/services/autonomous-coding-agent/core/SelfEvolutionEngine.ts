/**
 * Self-Evolution Engine
 * Continuous learning and optimization system for autonomous coding agent
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  LearningPattern,
  ErrorPattern,
  OptimizationSuggestion,
  Task,
  CodingMode,
  ExecutionContext,
} from '../types';

export interface EvolutionMetrics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  errorReductionRate: number;
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

  constructor(dataPath: string = './data/evolution') {
    super();
    this.dataPath = dataPath;
    this.initializeDataStructures();
  }

  /**
   * Learn from execution pattern
   */
  async learn(pattern: LearningPattern): Promise<void> {
    if (!this.learningEnabled) return;

    // Store learning pattern
    this.learningPatterns.push(pattern);

    // Limit patterns to prevent memory issues
    if (this.learningPatterns.length > this.maxPatterns) {
      this.learningPatterns = this.learningPatterns.slice(-this.maxPatterns);
    }

    // Update error patterns if execution failed
    if (!pattern.success && pattern.errorPatterns) {
      for (const errorPattern of pattern.errorPatterns) {
        await this.updateErrorPattern(errorPattern);
      }
    }

    // Update performance baseline
    await this.updatePerformanceBaseline(pattern);

    // Generate optimization suggestions
    await this.generateOptimizations(pattern);

    // Update user preferences
    if (pattern.userFeedback) {
      await this.updateUserPreferences(pattern);
    }

    // Persist learning data
    await this.persistLearningData();

    this.emit('patternLearned', pattern);
  }

  /**
   * Predict optimal modes for a task
   */
  async predictOptimalModes(task: Task, context: ExecutionContext): Promise<CodingMode[]> {
    // Find similar patterns
    const similarPatterns = this.findSimilarPatterns(task, context);

    if (similarPatterns.length === 0) {
      // No patterns found, return default modes
      return this.getDefaultModesForTaskType(task);
    }

    // Analyze successful patterns
    const successfulPatterns = similarPatterns.filter((p) => p.success);

    if (successfulPatterns.length === 0) {
      // No successful patterns, learn from failures
      const failedPatterns = similarPatterns.filter((p) => !p.success);
      return this.generateAlternativeModes(failedPatterns);
    }

    // Extract most effective mode combinations
    const modeFrequency = new Map<string, number>();
    const modeSuccess = new Map<string, number>();

    for (const pattern of successfulPatterns) {
      for (const mode of pattern.modes) {
        const key = `${mode.category}:${mode.name}`;
        modeFrequency.set(key, (modeFrequency.get(key) || 0) + 1);
        modeSuccess.set(key, (modeSuccess.get(key) || 0) + (pattern.success ? 1 : 0));
      }
    }

    // Sort by effectiveness (success rate * frequency)
    const sortedModes = Array.from(modeFrequency.entries())
      .map(([key, frequency]) => {
        const success = modeSuccess.get(key) || 0;
        const effectiveness = (success / frequency) * Math.log(frequency + 1);
        return { key, effectiveness, frequency, success };
      })
      .sort((a, b) => b.effectiveness - a.effectiveness);

    // Convert back to CodingMode objects
    const predictedModes: CodingMode[] = [];
    for (const { key } of sortedModes) {
      const mode = this.findModeByKey(key, successfulPatterns);
      if (mode) {
        predictedModes.push(mode);
      }
    }

    this.emit('modesPredict', { task, predictedModes });
    return predictedModes;
  }

  /**
   * Get optimization suggestions for current context
   */
  getOptimizationSuggestions(context: ExecutionContext): OptimizationSuggestion[] {
    return this.optimizationSuggestions
      .filter((suggestion) => this.isApplicable(suggestion, context))
      .sort((a, b) => b.expectedGain - a.expectedGain)
      .slice(0, 5); // Top 5 suggestions
  }

  /**
   * Get evolution metrics
   */
  getEvolutionMetrics(): EvolutionMetrics {
    const totalExecutions = this.learningPatterns.length;
    const successfulExecutions = this.learningPatterns.filter((p) => p.success).length;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    const avgExecutionTime =
      totalExecutions > 0
        ? this.learningPatterns.reduce((sum, p) => sum + p.executionTime, 0) / totalExecutions
        : 0;

    const recentPatterns = this.learningPatterns.slice(-100);
    const oldPatterns = this.learningPatterns.slice(-200, -100);

    const recentSuccessRate =
      recentPatterns.length > 0
        ? recentPatterns.filter((p) => p.success).length / recentPatterns.length
        : 0;

    const oldSuccessRate =
      oldPatterns.length > 0 ? oldPatterns.filter((p) => p.success).length / oldPatterns.length : 0;

    const errorReductionRate =
      oldSuccessRate > 0 ? ((recentSuccessRate - oldSuccessRate) / oldSuccessRate) * 100 : 0;

    return {
      totalExecutions,
      successRate,
      averageExecutionTime: avgExecutionTime,
      errorReductionRate,
      optimizationGains: this.calculateOptimizationGains(),
      patternAccuracy: this.calculatePatternAccuracy(),
    };
  }

  /**
   * Check if recovery strategy exists for error
   */
  hasRecoveryStrategy(error: string): boolean {
    return this.errorPatterns.has(error);
  }

  /**
   * Get recovery strategy for error
   */
  getRecoveryStrategy(error: string): string | null {
    const pattern = this.errorPatterns.get(error);
    return pattern ? pattern.resolution : null;
  }

  /**
   * Initialize data structures
   */
  private async initializeDataStructures(): Promise<void> {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.loadPersistedData();
    } catch (error) {
      console.warn('Could not initialize evolution data structures:', error);
    }
  }

  /**
   * Load persisted learning data
   */
  private async loadPersistedData(): Promise<void> {
    try {
      const patternsPath = path.join(this.dataPath, 'patterns.json');
      const errorsPath = path.join(this.dataPath, 'errors.json');
      const preferencesPath = path.join(this.dataPath, 'preferences.json');

      // Load patterns
      try {
        const patternsData = await fs.readFile(patternsPath, 'utf-8');
        this.learningPatterns = JSON.parse(patternsData);
      } catch (error) {
        // File doesn't exist or is corrupted, start fresh
        this.learningPatterns = [];
      }

      // Load error patterns
      try {
        const errorsData = await fs.readFile(errorsPath, 'utf-8');
        const errorsArray = JSON.parse(errorsData);
        this.errorPatterns = new Map(errorsArray);
      } catch (error) {
        this.errorPatterns = new Map();
      }

      // Load user preferences
      try {
        const preferencesData = await fs.readFile(preferencesPath, 'utf-8');
        const preferencesArray = JSON.parse(preferencesData);
        this.userPreferences = new Map(preferencesArray);
      } catch (error) {
        this.userPreferences = new Map();
      }
    } catch (error) {
      console.warn('Could not load persisted learning data:', error);
    }
  }

  /**
   * Persist learning data to disk
   */
  private async persistLearningData(): Promise<void> {
    try {
      const patternsPath = path.join(this.dataPath, 'patterns.json');
      const errorsPath = path.join(this.dataPath, 'errors.json');
      const preferencesPath = path.join(this.dataPath, 'preferences.json');

      // Save patterns (only recent ones to manage file size)
      const recentPatterns = this.learningPatterns.slice(-500);
      await fs.writeFile(patternsPath, JSON.stringify(recentPatterns, null, 2));

      // Save error patterns
      const errorsArray = Array.from(this.errorPatterns.entries());
      await fs.writeFile(errorsPath, JSON.stringify(errorsArray, null, 2));

      // Save user preferences
      const preferencesArray = Array.from(this.userPreferences.entries());
      await fs.writeFile(preferencesPath, JSON.stringify(preferencesArray, null, 2));
    } catch (error) {
      console.warn('Could not persist learning data:', error);
    }
  }

  /**
   * Update error pattern knowledge
   */
  private async updateErrorPattern(errorPattern: ErrorPattern): Promise<void> {
    const existing = this.errorPatterns.get(errorPattern.error);

    if (existing) {
      existing.frequency += 1;
      // Update resolution if new one is provided
      if (errorPattern.resolution && errorPattern.resolution !== existing.resolution) {
        existing.resolution = errorPattern.resolution;
      }
    } else {
      this.errorPatterns.set(errorPattern.error, { ...errorPattern, frequency: 1 });
    }
  }

  /**
   * Update performance baseline
   */
  private async updatePerformanceBaseline(pattern: LearningPattern): Promise<void> {
    const key = `${pattern.task.type || 'default'}:${pattern.modes.map((m) => m.name).join('+')}`;
    const existing = this.performanceBaseline.get(key);

    if (existing) {
      // Use exponential moving average
      const alpha = 0.1;
      this.performanceBaseline.set(key, alpha * pattern.executionTime + (1 - alpha) * existing);
    } else {
      this.performanceBaseline.set(key, pattern.executionTime);
    }
  }

  /**
   * Generate optimization suggestions
   */
  private async generateOptimizations(pattern: LearningPattern): Promise<void> {
    // Find similar successful patterns that were faster
    const similarPatterns = this.learningPatterns.filter(
      (p) => p.success && p.context === pattern.context && p.executionTime < pattern.executionTime,
    );

    for (const fasterPattern of similarPatterns) {
      const timeSaved = pattern.executionTime - fasterPattern.executionTime;
      const improvement = (timeSaved / pattern.executionTime) * 100;

      if (improvement > 10) {
        // Only suggest if >10% improvement
        const suggestion: OptimizationSuggestion = {
          pattern: `Using ${fasterPattern.modes.map((m) => m.name).join(' + ')}`,
          improvement: `${improvement.toFixed(1)}% faster execution`,
          expectedGain: improvement,
          confidence: Math.min(0.9, 0.5 + improvement / 100),
        };

        // Check if we already have this suggestion
        const exists = this.optimizationSuggestions.some((s) => s.pattern === suggestion.pattern);
        if (!exists) {
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
  private async updateUserPreferences(pattern: LearningPattern): Promise<void> {
    const modeNames = pattern.modes.map((m) => m.name);

    for (const modeName of modeNames) {
      const key = `mode_preference:${modeName}`;
      const currentRating = this.userPreferences.get(key) || 3; // Default neutral

      // Update rating using weighted average
      const weight = 0.2;
      const newRating = weight * (pattern.userFeedback || 3) + (1 - weight) * currentRating;
      this.userPreferences.set(key, newRating);
    }

    // Update task type preferences
    if (pattern.task.type) {
      const taskKey = `task_preference:${pattern.task.type}`;
      const currentRating = this.userPreferences.get(taskKey) || 3;
      const weight = 0.15;
      const newRating = weight * (pattern.userFeedback || 3) + (1 - weight) * currentRating;
      this.userPreferences.set(taskKey, newRating);
    }
  }

  /**
   * Find similar patterns for prediction
   */
  private findSimilarPatterns(task: Task, context: ExecutionContext): LearningPattern[] {
    return this.learningPatterns.filter((pattern) => {
      // Task similarity
      const taskSimilarity = this.calculateTaskSimilarity(task, pattern.task);

      // Context similarity
      const contextSimilarity = this.calculateContextSimilarity(context, pattern);

      // Combined similarity threshold
      return (taskSimilarity + contextSimilarity) / 2 > 0.6;
    });
  }

  /**
   * Calculate task similarity score
   */
  private calculateTaskSimilarity(task1: Task, task2: Task): number {
    let similarity = 0;

    // Title similarity (simple word overlap)
    const words1 = task1.title.toLowerCase().split(' ');
    const words2 = task2.title.toLowerCase().split(' ');
    const overlap = words1.filter((word) => words2.includes(word)).length;
    const titleSimilarity = overlap / Math.max(words1.length, words2.length);

    similarity += titleSimilarity * 0.4;

    // Priority similarity
    if (task1.priority === task2.priority) similarity += 0.2;

    // Type similarity (if available)
    if (task1.assignee === task2.assignee) similarity += 0.2;

    // Description similarity (basic)
    const desc1 = task1.description.toLowerCase();
    const desc2 = task2.description.toLowerCase();
    const descSimilarity =
      desc1.includes(desc2.substring(0, 20)) || desc2.includes(desc1.substring(0, 20)) ? 0.2 : 0;
    similarity += descSimilarity;

    return Math.min(1, similarity);
  }

  /**
   * Calculate context similarity score
   */
  private calculateContextSimilarity(context: ExecutionContext, pattern: LearningPattern): number {
    let similarity = 0;

    // Basic context matching (simplified for this implementation)
    if (pattern.context.includes('project') && context.projectPath) similarity += 0.3;
    if (pattern.context.includes('test') && context.currentTask?.title.includes('test'))
      similarity += 0.3;
    if (pattern.context.includes('deploy') && context.currentTask?.title.includes('deploy'))
      similarity += 0.4;

    return Math.min(1, similarity);
  }

  /**
   * Get default modes for task type
   */
  private getDefaultModesForTaskType(task: Task): CodingMode[] {
    // This would be more sophisticated in a real implementation
    const defaults: CodingMode[] = [
      { name: 'Planning', symbol: '📋', category: 'planning' },
      { name: 'Executing', symbol: '⚡', category: 'code_development' },
      { name: 'Validating', symbol: '✅', category: 'analysis' },
    ];

    return defaults;
  }

  /**
   * Generate alternative modes when patterns failed
   */
  private generateAlternativeModes(failedPatterns: LearningPattern[]): CodingMode[] {
    // Analyze failed modes and suggest alternatives
    const failedModes = failedPatterns.flatMap((p) => p.modes);
    const alternatives: CodingMode[] = [];

    // Simple alternative logic (would be more sophisticated in real implementation)
    for (const mode of failedModes) {
      if (mode.category === 'code_development') {
        alternatives.push({
          name: 'AlternativeGeneration',
          symbol: '🔄',
          category: 'code_development',
        });
      }
    }

    return alternatives.length > 0
      ? alternatives
      : this.getDefaultModesForTaskType({ title: 'fallback' } as Task);
  }

  /**
   * Find mode by key in patterns
   */
  private findModeByKey(key: string, patterns: LearningPattern[]): CodingMode | null {
    for (const pattern of patterns) {
      for (const mode of pattern.modes) {
        if (`${mode.category}:${mode.name}` === key) {
          return mode;
        }
      }
    }
    return null;
  }

  /**
   * Check if optimization suggestion is applicable
   */
  private isApplicable(suggestion: OptimizationSuggestion, context: ExecutionContext): boolean {
    // Simple applicability check (would be more sophisticated in real implementation)
    return suggestion.confidence > 0.6;
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
   * Calculate pattern accuracy
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
    this.emit('learningToggled', enabled);
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
    this.emit('dataCleared');
  }
}

export default SelfEvolutionEngine;
