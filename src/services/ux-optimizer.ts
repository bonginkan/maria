/**
 * UX Optimizer Service
 * Automatically optimizes user experience based on learned patterns and performance metrics
 */

import { EventEmitter } from 'events';
import { AdaptiveLearningEngine } from './adaptive-learning-engine.js';
import { PersonalizationSystem } from './personalization-system.js';
import { ABTestingFramework } from './ab-testing-framework.js';
import { PerformanceOptimizer } from './performance-optimizer.js';
import { logger } from '../utils/logger.js';

export interface UXOptimization {
  id: string;
  type: 'ui' | 'workflow' | 'performance' | 'personalization';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number; // 0-1
  automatable: boolean;
  implementation: OptimizationImplementation;
  rollbackPlan: OptimizationRollback;
  metrics: OptimizationMetrics;
  createdAt: number;
}

export interface OptimizationImplementation {
  action: string;
  parameters: Record<string, unknown>;
  preconditions: string[];
  estimatedTime: number; // milliseconds
}

export interface OptimizationRollback {
  action: string;
  parameters: Record<string, unknown>;
  conditions: string[];
}

export interface OptimizationMetrics {
  before: Record<string, number>;
  after?: Record<string, number>;
  improvement?: number; // percentage
  userSatisfaction?: number; // 0-1
}

export interface UXOptimizerConfig {
  enableAutoImplementation: boolean;
  minimumConfidence: number; // 0-1
  maxAutoOptimizationsPerHour: number;
  rollbackThreshold: number; // 0-1, performance drop threshold
  testDuration: number; // milliseconds for A/B testing
}

export class UXOptimizer extends EventEmitter {
  private static instance: UXOptimizer;
  private config: UXOptimizerConfig;
  private adaptiveLearning: AdaptiveLearningEngine;
  private _personalization: PersonalizationSystem;
  private abTesting: ABTestingFramework;
  private performance: PerformanceOptimizer;
  private activeOptimizations: Map<string, UXOptimization>;
  private optimizationHistory: UXOptimization[];
  private lastOptimizationTime: number;
  private optimizationCount: number;

  private constructor() {
    super();
    this.config = this.getDefaultConfig();
    this.adaptiveLearning = AdaptiveLearningEngine.getInstance();
    this._personalization = PersonalizationSystem.getInstance();
    this.abTesting = ABTestingFramework.getInstance();
    this.performance = PerformanceOptimizer.getInstance();
    this.activeOptimizations = new Map();
    this.optimizationHistory = [];
    this.lastOptimizationTime = 0;
    this.optimizationCount = 0;

    this.setupEventListeners();
    this.startOptimizationCycle();
  }

  public static getInstance(): UXOptimizer {
    if (!UXOptimizer.instance) {
      UXOptimizer.instance = new UXOptimizer();
    }
    return UXOptimizer.instance;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): UXOptimizerConfig {
    return {
      enableAutoImplementation: true,
      minimumConfidence: 0.8,
      maxAutoOptimizationsPerHour: 3,
      rollbackThreshold: 0.1, // 10% performance drop
      testDuration: 300000, // 5 minutes
    };
  }

  /**
   * Setup event listeners for optimization triggers
   */
  private setupEventListeners(): void {
    // Listen for learning insights that could trigger optimizations
    this.adaptiveLearning.on('patternDetected', (pattern) => {
      this.analyzePatternForOptimization(pattern);
    });

    // Listen for performance issues
    this.performance.on('performanceIssue', (issue) => {
      this.createPerformanceOptimization(issue);
    });

    // Listen for user behavior changes
    this.adaptiveLearning.on('behaviorChanged', (behavior) => {
      this.adaptPersonalizationForBehavior(behavior);
    });

    // Listen for A/B test results
    this.abTesting.on('testCompleted', (result) => {
      this.processABTestResult(result);
    });
  }

  /**
   * Start the continuous optimization cycle
   */
  private startOptimizationCycle(): void {
    setInterval(() => {
      this.runOptimizationCycle();
    }, 60000); // Run every minute
  }

  /**
   * Run optimization analysis cycle
   */
  private async runOptimizationCycle(): Promise<void> {
    try {
      // Check if we can perform more optimizations this hour
      if (!this.canPerformOptimization()) {
        return;
      }

      // Analyze current state
      const optimizations = await this.identifyOptimizations();

      // Filter by confidence threshold
      const highConfidenceOptimizations = optimizations.filter(
        (opt) => opt.confidence >= this.config.minimumConfidence,
      );

      if (highConfidenceOptimizations.length === 0) {
        return;
      }

      // Select the best optimization
      const bestOptimization = this.selectBestOptimization(highConfidenceOptimizations);

      if (bestOptimization && this.config.enableAutoImplementation) {
        await this.implementOptimization(bestOptimization);
      }

      this.emit('optimizationCycleCompleted', {
        analyzed: optimizations.length,
        candidates: highConfidenceOptimizations.length,
        implemented: bestOptimization ? 1 : 0,
      });
    } catch (error) {
      logger.error('Error in optimization cycle:', error);
      this.emit('optimizationError', error);
    }
  }

  /**
   * Check if we can perform more optimizations
   */
  private canPerformOptimization(): boolean {
    const now = Date.now();
    const hourAgo = now - 3600000; // 1 hour

    // Reset count if hour has passed
    if (this.lastOptimizationTime < hourAgo) {
      this.optimizationCount = 0;
    }

    return this.optimizationCount < this.config.maxAutoOptimizationsPerHour;
  }

  /**
   * Identify potential optimizations
   */
  private async identifyOptimizations(): Promise<UXOptimization[]> {
    const optimizations: UXOptimization[] = [];

    // UI optimizations based on usage patterns
    const uiOptimizations = await this.identifyUIOptimizations();
    optimizations.push(...uiOptimizations);

    // Workflow optimizations
    const workflowOptimizations = await this.identifyWorkflowOptimizations();
    optimizations.push(...workflowOptimizations);

    // Performance optimizations
    const performanceOptimizations = await this.identifyPerformanceOptimizations();
    optimizations.push(...performanceOptimizations);

    // Personalization optimizations
    const personalizationOptimizations = await this.identifyPersonalizationOptimizations();
    optimizations.push(...personalizationOptimizations);

    return optimizations;
  }

  /**
   * Identify UI optimizations
   */
  private async identifyUIOptimizations(): Promise<UXOptimization[]> {
    const optimizations: UXOptimization[] = [];
    const userProfile = this.adaptiveLearning.getUserProfile();

    // Frequently used features should be more accessible
    if (
      userProfile?.statistics?.favoriteFeatures?.length &&
      userProfile.statistics.favoriteFeatures.length > 0
    ) {
      const topFeatures = userProfile.statistics.favoriteFeatures.slice(0, 3);

      optimizations.push({
        id: `ui-shortcuts-${Date.now()}`,
        type: 'ui',
        title: 'Add Quick Access Shortcuts',
        description: `Create shortcuts for frequently used features: ${topFeatures?.join(', ') || 'none'}`,
        impact: 'medium',
        confidence: 0.85,
        automatable: true,
        implementation: {
          action: 'addQuickAccess',
          parameters: { features: topFeatures },
          preconditions: ['user_has_used_features'],
          estimatedTime: 1000,
        },
        rollbackPlan: {
          action: 'removeQuickAccess',
          parameters: { features: topFeatures },
          conditions: ['performance_degraded', 'user_feedback_negative'],
        },
        metrics: {
          before: { accessTime: 5000, clicksRequired: 3 },
        },
        createdAt: Date.now(),
      });
    }

    // Adaptive dashboard visibility based on usage
    const dashboardUsage = this.getFeatureUsage('adaptive_dashboard');
    if (dashboardUsage > 0.3) {
      // Used more than 30% of sessions
      optimizations.push({
        id: `ui-dashboard-default-${Date.now()}`,
        type: 'ui',
        title: 'Show Adaptive Dashboard by Default',
        description: 'Auto-show adaptive dashboard for frequent users',
        impact: 'medium',
        confidence: 0.9,
        automatable: true,
        implementation: {
          action: 'setDefaultVisibility',
          parameters: { component: 'adaptive_dashboard', visible: true },
          preconditions: ['high_usage_detected'],
          estimatedTime: 500,
        },
        rollbackPlan: {
          action: 'setDefaultVisibility',
          parameters: { component: 'adaptive_dashboard', visible: false },
          conditions: ['user_dismisses_frequently'],
        },
        metrics: {
          before: { dashboardOpenTime: 2000, featuresDiscovered: 2 },
        },
        createdAt: Date.now(),
      });
    }

    return optimizations;
  }

  /**
   * Identify workflow optimizations
   */
  private async identifyWorkflowOptimizations(): Promise<UXOptimization[]> {
    const optimizations: UXOptimization[] = [];
    const patterns: { frequency: number; commandSequence: string[] }[] = []; // TODO: Implement getUsagePatterns

    // Find command sequences that could be automated
    const frequentSequences = patterns.filter(
      (p: { frequency: number; commandSequence: string[] }) =>
        p.frequency > 5 && p.commandSequence.length > 2,
    );

    for (const sequence of frequentSequences) {
      optimizations.push({
        id: `workflow-sequence-${Date.now()}-${Math.random()}`,
        type: 'workflow',
        title: 'Create Command Sequence Shortcut',
        description: `Automate frequently used sequence: ${sequence.commandSequence.join(' → ')}`,
        impact: 'high',
        confidence: Math.min(0.95, 0.5 + sequence.frequency / 20),
        automatable: true,
        implementation: {
          action: 'createCommandSequence',
          parameters: {
            sequence: sequence.commandSequence,
            name: `auto_sequence_${sequence.commandSequence[0]}`,
          },
          preconditions: ['sequence_used_frequently'],
          estimatedTime: 2000,
        },
        rollbackPlan: {
          action: 'removeCommandSequence',
          parameters: { name: `auto_sequence_${sequence.commandSequence[0]}` },
          conditions: ['sequence_not_used', 'user_preference_change'],
        },
        metrics: {
          before: {
            commandsRequired: sequence.commandSequence.length,
            timeRequired: sequence.commandSequence.length * 3000,
          },
        },
        createdAt: Date.now(),
      });
    }

    return optimizations;
  }

  /**
   * Identify performance optimizations
   */
  private async identifyPerformanceOptimizations(): Promise<UXOptimization[]> {
    const optimizations: UXOptimization[] = [];
    // TODO: Implement getSystemMetrics
    const performanceMetrics = {
      memory: { usage: 0.5 },
      cpu: { usage: 0.3 },
      responseTime: { average: 1000 },
    };

    // Memory optimization
    if (performanceMetrics.memory.usage > 0.8) {
      optimizations.push({
        id: `perf-memory-${Date.now()}`,
        type: 'performance',
        title: 'Optimize Memory Usage',
        description: 'Clean up unused resources and optimize memory allocation',
        impact: 'high',
        confidence: 0.9,
        automatable: true,
        implementation: {
          action: 'optimizeMemory',
          parameters: { aggressiveness: 'moderate' },
          preconditions: ['high_memory_usage'],
          estimatedTime: 3000,
        },
        rollbackPlan: {
          action: 'restoreMemorySettings',
          parameters: {},
          conditions: ['functionality_impaired'],
        },
        metrics: {
          before: { memoryUsage: performanceMetrics.memory.usage },
        },
        createdAt: Date.now(),
      });
    }

    // Response time optimization
    if (performanceMetrics.responseTime.average > 2000) {
      optimizations.push({
        id: `perf-response-${Date.now()}`,
        type: 'performance',
        title: 'Improve Response Times',
        description: 'Optimize processing pipeline for faster responses',
        impact: 'high',
        confidence: 0.85,
        automatable: true,
        implementation: {
          action: 'optimizeResponseTime',
          parameters: { techniques: ['caching', 'preloading', 'parallel_processing'] },
          preconditions: ['slow_response_detected'],
          estimatedTime: 5000,
        },
        rollbackPlan: {
          action: 'restoreDefaultProcessing',
          parameters: {},
          conditions: ['accuracy_decreased'],
        },
        metrics: {
          before: { averageResponseTime: performanceMetrics.responseTime.average },
        },
        createdAt: Date.now(),
      });
    }

    return optimizations;
  }

  /**
   * Identify personalization optimizations
   */
  private async identifyPersonalizationOptimizations(): Promise<UXOptimization[]> {
    const optimizations: UXOptimization[] = [];
    const userProfile = this.adaptiveLearning.getUserProfile();

    // Productivity peak optimization
    if (
      userProfile?.preferences?.productivityPeaks?.length &&
      userProfile.preferences.productivityPeaks.length > 0
    ) {
      const peakHour = userProfile.preferences.productivityPeaks[0];
      const currentHour = new Date().getHours();

      if (peakHour !== undefined && Math.abs(currentHour - peakHour) <= 1) {
        // Within peak time
        optimizations.push({
          id: `personal-peak-${Date.now()}`,
          type: 'personalization',
          title: 'Peak Time Optimization',
          description: 'Optimize interface for peak productivity hours',
          impact: 'medium',
          confidence: 0.8,
          automatable: true,
          implementation: {
            action: 'activatePeakMode',
            parameters: {
              focusMode: true,
              reduceAnimations: true,
              prioritizePerformance: true,
            },
            preconditions: ['within_peak_hours'],
            estimatedTime: 1000,
          },
          rollbackPlan: {
            action: 'deactivatePeakMode',
            parameters: {},
            conditions: ['outside_peak_hours'],
          },
          metrics: {
            before: { distractionLevel: 5, focusScore: 7 },
          },
          createdAt: Date.now(),
        });
      }
    }

    return optimizations;
  }

  /**
   * Select the best optimization to implement
   */
  private selectBestOptimization(optimizations: UXOptimization[]): UXOptimization | null {
    if (optimizations.length === 0) {return null;}

    // Score optimizations based on impact, confidence, and type priority
    const scored = optimizations.map((opt) => ({
      optimization: opt,
      score: this.calculateOptimizationScore(opt),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored[0]?.optimization || null;
  }

  /**
   * Calculate optimization score
   */
  private calculateOptimizationScore(optimization: UXOptimization): number {
    const impactScore =
      optimization.impact === 'high' ? 3 : optimization.impact === 'medium' ? 2 : 1;
    const confidenceScore = optimization.confidence;
    const typeScore = this.getTypeScore(optimization.type);
    const urgencyScore = this.getUrgencyScore(optimization);

    return impactScore * 0.4 + confidenceScore * 0.3 + typeScore * 0.2 + urgencyScore * 0.1;
  }

  /**
   * Get type priority score
   */
  private getTypeScore(type: UXOptimization['type']): number {
    const scores = {
      performance: 1.0,
      workflow: 0.9,
      ui: 0.8,
      personalization: 0.7,
    };
    return scores[type] || 0.5;
  }

  /**
   * Get urgency score based on current conditions
   */
  private getUrgencyScore(optimization: UXOptimization): number {
    // Performance optimizations are more urgent during high usage
    if (optimization.type === 'performance') {
      // TODO: Implement getSystemMetrics
      const performanceMetrics = {
        memory: { usage: 0.5 },
        cpu: { usage: 0.3 },
        responseTime: { average: 1000 },
      };
      return Math.min(1.0, performanceMetrics.cpu.usage + performanceMetrics.memory.usage) / 2;
    }

    return 0.5; // Default urgency
  }

  /**
   * Implement an optimization
   */
  private async implementOptimization(optimization: UXOptimization): Promise<void> {
    try {
      logger.info(`Implementing optimization: ${optimization.title}`);

      // Check preconditions
      if (!this.checkPreconditions(optimization.implementation.preconditions)) {
        logger.warn(`Preconditions not met for optimization: ${optimization.id}`);
        return;
      }

      // Record baseline metrics
      const beforeMetrics = await this.captureMetrics(optimization);
      optimization.metrics.before = beforeMetrics;

      // Start A/B test if needed
      if (optimization.impact === 'high') {
        await this.startOptimizationABTest(optimization);
      } else {
        // Direct implementation for low/medium impact changes
        await this.executeOptimization(optimization);
      }

      // Track the optimization
      this.activeOptimizations.set(optimization.id, optimization);
      this.optimizationCount++;
      this.lastOptimizationTime = Date.now();

      // Schedule rollback check
      this.scheduleRollbackCheck(optimization);

      this.emit('optimizationImplemented', optimization);
    } catch (error) {
      logger.error(`Failed to implement optimization ${optimization.id}:`, error);
      this.emit('optimizationFailed', { optimization, error });
    }
  }

  /**
   * Check if preconditions are met
   */
  private checkPreconditions(preconditions: string[]): boolean {
    for (const condition of preconditions) {
      if (!this.evaluatePrecondition(condition)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a specific precondition
   */
  private evaluatePrecondition(condition: string): boolean {
    switch (condition) {
      case 'user_has_used_features':
        return (this.adaptiveLearning.getUserProfile()?.statistics?.totalCommands ?? 0) > 10;
      case 'high_usage_detected':
        return this.getFeatureUsage('adaptive_dashboard') > 0.3;
      case 'sequence_used_frequently':
        return true; // Already filtered in identification
      case 'high_memory_usage':
        return false; // TODO: Implement getSystemMetrics
      case 'slow_response_detected':
        return false; // TODO: Implement getSystemMetrics
      case 'within_peak_hours': {
        const peakHours = this.adaptiveLearning.getUserProfile()?.preferences.productivityPeaks;
        const currentHour = new Date().getHours();
        return peakHours?.some((hour) => Math.abs(currentHour - hour) <= 1) ?? false;
      }
      default:
        logger.warn(`Unknown precondition: ${condition}`);
        return false;
    }
  }

  /**
   * Get feature usage percentage
   */
  private getFeatureUsage(feature: string): number {
    // This would typically query actual usage data
    // For now, return a mock value based on feature name
    const mockUsage: Record<string, number> = {
      adaptive_dashboard: 0.4,
      background_processing: 0.6,
      hotkeys: 0.8,
    };
    return mockUsage[feature] || 0.1;
  }

  /**
   * Start A/B test for optimization
   */
  private async startOptimizationABTest(optimization: UXOptimization): Promise<void> {
    const testId = this.abTesting.createTest({
      name: `opt_${optimization.id}`,
      description: optimization.description,
      hypothesis: 'This optimization will improve user experience',
      variants: [
        {
          name: 'Current Implementation',
          description: 'Current implementation without optimization',
          config: {},
          weight: 0.5,
          enabled: true,
        },
        {
          name: 'Optimized Implementation',
          description: 'Optimized implementation with UX improvements',
          config: {},
          weight: 0.5,
          enabled: true,
        },
      ],
      duration: 7, // 7 days
      targetMetrics: ['user_satisfaction', 'task_completion_rate'],
      successCriteria: {
        primaryMetric: 'user_satisfaction',
        minimumImprovement: 10, // 10% improvement
        confidenceLevel: 0.95,
      },
    }).id;

    // Implement for test group
    // TODO: Fix method call - use getTestResultsForUser or similar available method
    await this.executeOptimization(optimization);

    logger.info(`Started A/B test ${testId} for optimization ${optimization.id}`);
  }

  /**
   * Execute the actual optimization
   */
  private async executeOptimization(optimization: UXOptimization): Promise<void> {
    const { action, parameters } = optimization.implementation;

    switch (action) {
      case 'addQuickAccess':
        await this.implementQuickAccess(parameters);
        break;
      case 'setDefaultVisibility':
        await this.setDefaultVisibility(parameters);
        break;
      case 'createCommandSequence':
        await this.createCommandSequence(parameters);
        break;
      case 'optimizeMemory':
        await this.optimizeMemory(parameters);
        break;
      case 'optimizeResponseTime':
        await this.optimizeResponseTime(parameters);
        break;
      case 'activatePeakMode':
        await this.activatePeakMode(parameters);
        break;
      default:
        throw new Error(`Unknown optimization action: ${action}`);
    }
  }

  /**
   * Implementation methods for different optimization types
   */
  private async implementQuickAccess(parameters: Record<string, unknown>): Promise<void> {
    const features = parameters['features'] as string[];
    // Implementation would update UI configuration
    logger.info(`Added quick access for features: ${features.join(', ')}`);
  }

  private async setDefaultVisibility(parameters: Record<string, unknown>): Promise<void> {
    const component = parameters['component'] as string;
    const visible = parameters['visible'] as boolean;
    // Implementation would update default UI state
    logger.info(`Set ${component} default visibility to ${visible}`);
  }

  private async createCommandSequence(parameters: Record<string, unknown>): Promise<void> {
    const sequence = parameters['sequence'] as string[];
    const name = parameters['name'] as string;
    // Implementation would create a new command or macro
    logger.info(`Created command sequence '${name}': ${sequence.join(' → ')}`);
  }

  private async optimizeMemory(parameters: Record<string, unknown>): Promise<void> {
    const aggressiveness = parameters['aggressiveness'] as string;
    // Implementation would run memory optimization
    logger.info(`Optimized memory with ${aggressiveness} aggressiveness`);
  }

  private async optimizeResponseTime(parameters: Record<string, unknown>): Promise<void> {
    const techniques = parameters['techniques'] as string[];
    // Implementation would apply performance optimizations
    logger.info(`Applied response time optimizations: ${techniques.join(', ')}`);
  }

  private async activatePeakMode(parameters: Record<string, unknown>): Promise<void> {
    const focusMode = parameters['focusMode'] as boolean;
    // Implementation would activate peak productivity mode
    logger.info(`Activated peak mode with focus: ${focusMode}`);
  }

  /**
   * Capture metrics before/after optimization
   */
  private async captureMetrics(optimization: UXOptimization): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};

    // Capture relevant metrics based on optimization type
    switch (optimization.type) {
      case 'ui':
        metrics['accessTime'] = 3000; // Mock data
        metrics['clicksRequired'] = 2;
        break;
      case 'workflow':
        metrics['commandsRequired'] = 3;
        metrics['timeRequired'] = 9000;
        break;
      case 'performance': {
        // TODO: Implement getSystemMetrics or use available methods
        metrics['memoryUsage'] = 0.5; // Mock data
        metrics['responseTime'] = 1000; // Mock data
        break;
      }
      case 'personalization':
        metrics['distractionLevel'] = 5;
        metrics['focusScore'] = 7;
        break;
    }

    return metrics;
  }

  /**
   * Schedule rollback check
   */
  private scheduleRollbackCheck(optimization: UXOptimization): void {
    setTimeout(async () => {
      await this.checkForRollback(optimization);
    }, this.config.testDuration);
  }

  /**
   * Check if optimization should be rolled back
   */
  private async checkForRollback(optimization: UXOptimization): Promise<void> {
    try {
      const currentMetrics = await this.captureMetrics(optimization);
      optimization.metrics.after = currentMetrics;

      // Calculate improvement
      const improvement = this.calculateImprovement(optimization.metrics);
      optimization.metrics.improvement = improvement;

      // Check rollback conditions
      if (improvement < -this.config.rollbackThreshold * 100) {
        await this.rollbackOptimization(optimization);
        logger.warn(
          `Rolled back optimization ${optimization.id} due to negative impact: ${improvement}%`,
        );
      } else {
        // Optimization successful
        this.optimizationHistory.push(optimization);
        this.activeOptimizations.delete(optimization.id);

        logger.info(`Optimization ${optimization.id} successful with ${improvement}% improvement`);
        this.emit('optimizationSuccessful', { optimization, improvement });
      }
    } catch (error) {
      logger.error(`Error checking rollback for optimization ${optimization.id}:`, error);
    }
  }

  /**
   * Calculate improvement percentage
   */
  private calculateImprovement(metrics: OptimizationMetrics): number {
    if (!metrics.before || !metrics.after) {return 0;}

    const beforeValues = Object.values(metrics.before);
    const afterValues = Object.values(metrics.after);

    if (beforeValues.length !== afterValues.length) {return 0;}

    let totalImprovement = 0;
    for (let i = 0; i < beforeValues.length; i++) {
      const before = beforeValues[i];
      const after = afterValues[i];
      if (before !== undefined && after !== undefined && before > 0) {
        totalImprovement += ((after - before) / before) * 100;
      }
    }

    return totalImprovement / beforeValues.length;
  }

  /**
   * Rollback an optimization
   */
  private async rollbackOptimization(optimization: UXOptimization): Promise<void> {
    try {
      const { action } = optimization.rollbackPlan;

      // Execute rollback action
      switch (action) {
        case 'removeQuickAccess':
        case 'setDefaultVisibility':
        case 'removeCommandSequence':
        case 'restoreMemorySettings':
        case 'restoreDefaultProcessing':
        case 'deactivatePeakMode':
          // Implementation would reverse the optimization
          logger.info(`Rolled back optimization ${optimization.id} using action: ${action}`);
          break;
        default:
          logger.warn(`Unknown rollback action: ${action}`);
      }

      this.activeOptimizations.delete(optimization.id);
      this.emit('optimizationRolledBack', optimization);
    } catch (error) {
      logger.error(`Failed to rollback optimization ${optimization.id}:`, error);
      this.emit('rollbackFailed', { optimization, error });
    }
  }

  /**
   * Handle pattern analysis for optimization opportunities
   */
  private analyzePatternForOptimization(pattern: unknown): void {
    logger.debug('Analyzing pattern for optimization opportunities:', pattern);
    // Trigger optimization analysis when significant patterns are detected
    this.runOptimizationCycle();
  }

  /**
   * Create optimization for performance issues
   */
  private createPerformanceOptimization(issue: unknown): void {
    logger.debug('Creating optimization for performance issue:', issue);
    // Immediately create and queue performance optimization
    this.runOptimizationCycle();
  }

  /**
   * Adapt personalization based on behavior changes
   */
  private adaptPersonalizationForBehavior(behavior: unknown): void {
    logger.debug('Adapting personalization for behavior change:', behavior);
    // Update personalization settings based on behavior changes
  }

  /**
   * Process A/B test results
   */
  private processABTestResult(result: unknown): void {
    logger.debug('Processing A/B test result for optimization:', result);
    // Use A/B test results to make permanent optimization decisions
  }

  /**
   * Get optimization statistics
   */
  public getOptimizationStats(): {
    activeOptimizations: number;
    totalOptimizations: number;
    successRate: number;
    averageImprovement: number;
    optimizationsByType: Record<string, number>;
  } {
    const successful = this.optimizationHistory.filter(
      (opt) => opt.metrics.improvement && opt.metrics.improvement > 0,
    );

    const averageImprovement =
      successful.length > 0
        ? successful.reduce((sum, opt) => sum + (opt.metrics.improvement || 0), 0) /
          successful.length
        : 0;

    const optimizationsByType = this.optimizationHistory.reduce(
      (acc, opt) => {
        acc[opt.type] = (acc[opt.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      activeOptimizations: this.activeOptimizations.size,
      totalOptimizations: this.optimizationHistory.length,
      successRate:
        this.optimizationHistory.length > 0
          ? successful.length / this.optimizationHistory.length
          : 0,
      averageImprovement,
      optimizationsByType,
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<UXOptimizerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('UX Optimizer configuration updated:', newConfig);
  }

  /**
   * Get current active optimizations
   */
  public getActiveOptimizations(): UXOptimization[] {
    return Array.from(this.activeOptimizations.values());
  }

  /**
   * Get optimization history
   */
  public getOptimizationHistory(): UXOptimization[] {
    return [...this.optimizationHistory];
  }

  /**
   * Force run optimization cycle (for testing or manual trigger)
   */
  public async forceOptimizationCycle(): Promise<void> {
    await this.runOptimizationCycle();
  }
}

export const uxOptimizer = UXOptimizer.getInstance();
