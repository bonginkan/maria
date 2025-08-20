/**
 * Performance Optimizer
 * Monitors and optimizes system performance based on usage patterns
 */

import { EventEmitter } from 'events';
import { AdaptiveLearningEngine } from './adaptive-learning-engine.js';
import { ProcessManager } from './process-manager.js';
import { UIStateManager } from './ui-state-manager.js';
import { logger } from '../utils/logger.js';

export interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
    trend: 'stable' | 'increasing' | 'decreasing';
  };
  cpu: {
    usage: number;
    trend: 'stable' | 'increasing' | 'decreasing';
  };
  responseTime: {
    average: number;
    p95: number;
    p99: number;
    trend: 'improving' | 'degrading' | 'stable';
  };
  throughput: {
    commandsPerMinute: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  userExperience: {
    errorRate: number;
    satisfactionScore: number;
    usabilityScore: number;
  };
}

export interface OptimizationRecommendation {
  id: string;
  category: 'memory' | 'cpu' | 'ui' | 'workflow' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  autoApplicable: boolean;
  action?: () => Promise<void>;
  estimatedImprovement: number; // percentage
}

export interface SystemHealth {
  overall: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  score: number; // 0-100
  components: {
    memory: number;
    cpu: number;
    responseTime: number;
    userExperience: number;
  };
  recommendations: OptimizationRecommendation[];
  lastChecked: number;
}

export class PerformanceOptimizer extends EventEmitter {
  private static instance: PerformanceOptimizer;
  private learningEngine: AdaptiveLearningEngine;
  private processManager: ProcessManager;
  private uiStateManager: UIStateManager;

  private metrics: PerformanceMetrics;
  private metricHistory: PerformanceMetrics[] = [];
  private recommendations: OptimizationRecommendation[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private responseTimeSamples: number[] = [];
  private commandTimestamps: number[] = [];
  private maxHistorySize = 1000;

  private constructor() {
    super();
    this.learningEngine = AdaptiveLearningEngine.getInstance();
    this.processManager = ProcessManager.getInstance();
    this.uiStateManager = UIStateManager.getInstance();

    this.metrics = this.initializeMetrics();
    this.setupEventListeners();
  }

  public static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * Initialize default metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
        trend: 'stable',
      },
      cpu: {
        usage: 0,
        trend: 'stable',
      },
      responseTime: {
        average: 0,
        p95: 0,
        p99: 0,
        trend: 'stable',
      },
      throughput: {
        commandsPerMinute: 0,
        trend: 'stable',
      },
      userExperience: {
        errorRate: 0,
        satisfactionScore: 100,
        usabilityScore: 100,
      },
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Track command execution times
    this.processManager.on('commandCompleted', (event) => {
      this.recordCommandExecution(event.duration);
    });

    this.processManager.on('commandFailed', () => {
      this.recordError();
    });

    // Track learning progress for UX metrics
    this.learningEngine.on('commandLearned', (data) => {
      this.updateUserExperienceMetrics(data.success);
    });

    // Track UI state changes for responsiveness
    this.uiStateManager.on('stateUpdated', (event) => {
      this.trackUIPerformance(event);
    });
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(interval: number = 30000): void {
    // Default 30 seconds
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
      this.generateRecommendations();
    }, interval);

    logger.info('Performance monitoring started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Performance monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Memory metrics
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        this.metrics.memory = {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
          trend: this.calculateTrend('memory'),
        };
      }

      // CPU metrics (simplified - would need more sophisticated measurement in production)
      this.metrics.cpu = {
        usage: this.estimateCPUUsage(),
        trend: this.calculateTrend('cpu'),
      };

      // Response time metrics
      if (this.responseTimeSamples.length > 0) {
        const sorted = [...this.responseTimeSamples].sort((a, b) => a - b);
        const average =
          this.responseTimeSamples.reduce((a, b) => a + b, 0) / this.responseTimeSamples.length;
        const p95Index = Math.floor(sorted.length * 0.95);
        const p99Index = Math.floor(sorted.length * 0.99);

        this.metrics.responseTime = {
          average,
          p95: sorted[p95Index] || 0,
          p99: sorted[p99Index] || 0,
          trend: this.calculateTrend('responseTime'),
        };
      }

      // Throughput metrics
      const now = Date.now();
      const recentCommands = this.commandTimestamps.filter((ts) => now - ts < 60000); // Last minute
      this.metrics.throughput = {
        commandsPerMinute: recentCommands.length,
        trend: this.calculateTrend('throughput'),
      };

      // Add to history
      this.metricHistory.push({ ...this.metrics });
      if (this.metricHistory.length > this.maxHistorySize) {
        this.metricHistory.shift();
      }

      this.emit('metricsCollected', this.metrics);
    } catch (error: unknown) {
      logger.error('Error collecting metrics:', error);
    }
  }

  /**
   * Estimate CPU usage based on system activity
   */
  private estimateCPUUsage(): number {
    const backgroundTasks = this.processManager.getStats().runningProcesses;
    const recentActivity = this.commandTimestamps.filter((ts) => Date.now() - ts < 10000).length;

    // Simplified CPU estimation
    let usage = backgroundTasks * 15; // Each background task adds ~15% CPU estimate
    usage += recentActivity * 5; // Recent activity adds CPU load

    return Math.min(100, Math.max(0, usage));
  }

  /**
   * Calculate trend for a metric
   */
  private calculateTrend(metricType: string): string {
    if (this.metricHistory.length < 3) {
      return 'stable';
    }

    const recent = this.metricHistory.slice(-3);
    const values = recent.map((m) => {
      switch (metricType) {
        case 'memory':
          return m.memory.percentage;
        case 'cpu':
          return m.cpu.usage;
        case 'responseTime':
          return m.responseTime.average;
        case 'throughput':
          return m.throughput.commandsPerMinute;
        default:
          return 0;
      }
    });

    const trend = values[2] - values[0];
    const threshold =
      metricType === 'responseTime'
        ? -50 // Lower is better for response time
        : metricType === 'throughput'
          ? 2
          : 5;

    if (Math.abs(trend) < threshold) return 'stable';

    if (metricType === 'responseTime') {
      return trend < 0 ? 'improving' : 'degrading';
    } else if (metricType === 'throughput') {
      return trend > 0 ? 'increasing' : 'decreasing';
    } else {
      return trend > 0 ? 'increasing' : 'decreasing';
    }
  }

  /**
   * Record command execution time
   */
  recordCommandExecution(duration: number): void {
    this.responseTimeSamples.push(duration);
    if (this.responseTimeSamples.length > this.maxHistorySize) {
      this.responseTimeSamples.shift();
    }

    this.commandTimestamps.push(Date.now());
    if (this.commandTimestamps.length > this.maxHistorySize) {
      this.commandTimestamps.shift();
    }
  }

  /**
   * Record error occurrence
   */
  private recordError(): void {
    const totalCommands = this.commandTimestamps.length;
    if (totalCommands > 0) {
      // Simple error rate calculation
      this.metrics.userExperience.errorRate = Math.min(
        100,
        this.metrics.userExperience.errorRate + 1,
      );
    }
  }

  /**
   * Update user experience metrics
   */
  private updateUserExperienceMetrics(_success: boolean): void {
    const learningStats = this.learningEngine.getLearningStats();

    this.metrics.userExperience.satisfactionScore = learningStats.successRate * 100;
    this.metrics.userExperience.usabilityScore = Math.min(100, learningStats.learningProgress);

    // Decay error rate over time
    this.metrics.userExperience.errorRate = Math.max(
      0,
      this.metrics.userExperience.errorRate * 0.99,
    );
  }

  /**
   * Track UI performance
   */
  private trackUIPerformance(_event: unknown): void {
    // This would track UI responsiveness and state change performance
    // For now, we'll use a simple metric based on state updates
    this.recordCommandExecution(50); // Assume UI operations take ~50ms
  }

  /**
   * Analyze performance and identify issues
   */
  private analyzePerformance(): void {
    const health = this.getSystemHealth();

    if (health.score < 70) {
      this.emit('performanceDegradation', {
        health,
        severity: health.score < 40 ? 'critical' : health.score < 55 ? 'high' : 'medium',
      });
    }

    // Auto-apply critical optimizations
    this.recommendations
      .filter((rec) => rec.priority === 'critical' && rec.autoApplicable)
      .forEach((rec) => {
        if (rec.action) {
          rec.action().catch((error) => {
            logger.error('Failed to auto-apply optimization:', error);
          });
        }
      });
  }

  /**
   * Generate performance optimization recommendations
   */
  private generateRecommendations(): void {
    this.recommendations = [];

    // Memory optimizations
    if (this.metrics.memory.percentage > 80) {
      this.recommendations.push({
        id: 'memory_cleanup',
        category: 'memory',
        priority: this.metrics.memory.percentage > 90 ? 'critical' : 'high',
        title: 'High Memory Usage Detected',
        description: 'System memory usage is high. Clean up background processes and cached data.',
        impact: 'Improved responsiveness and stability',
        effort: 'low',
        autoApplicable: true,
        estimatedImprovement: 15,
        action: async () => {
          // Clean up old background tasks
          this.processManager.cleanupCompletedProcesses();
          // Clean up old UI states
          this.uiStateManager.cleanupOldSessions();
          logger.info('Automatic memory cleanup completed');
        },
      });
    }

    // Response time optimizations
    if (this.metrics.responseTime.average > 2000) {
      this.recommendations.push({
        id: 'response_time_optimization',
        category: 'cpu',
        priority: 'high',
        title: 'Slow Response Times',
        description:
          'Average response time is above optimal threshold. Consider reducing concurrent operations.',
        impact: 'Faster command execution and better user experience',
        effort: 'medium',
        autoApplicable: true,
        estimatedImprovement: 25,
        action: async () => {
          // Reduce max concurrent background processes
          const currentMax = this.processManager.getStats().maxConcurrentProcesses;
          if (currentMax > 1) {
            // Reduce by 1 but not below 1
            const newMax = Math.max(1, currentMax - 1);
            this.processManager.setMaxConcurrentProcesses(newMax);
            logger.info(`Reduced max concurrent processes to ${newMax} for performance`);
          }
        },
      });
    }

    // UI performance optimizations
    if (this.metrics.userExperience.usabilityScore < 60) {
      this.recommendations.push({
        id: 'ui_optimization',
        category: 'ui',
        priority: 'medium',
        title: 'UI Performance Optimization',
        description: 'User interface could be more responsive. Enable performance mode.',
        impact: 'Smoother animations and faster UI interactions',
        effort: 'low',
        autoApplicable: false, // Requires user preference
        estimatedImprovement: 20,
      });
    }

    // Workflow optimizations
    const learningStats = this.learningEngine.getLearningStats();
    if (learningStats.totalCommands > 50 && this.metrics.throughput.commandsPerMinute < 2) {
      this.recommendations.push({
        id: 'workflow_efficiency',
        category: 'workflow',
        priority: 'medium',
        title: 'Workflow Efficiency Improvement',
        description: 'Based on your usage patterns, creating shortcuts could improve efficiency.',
        impact: 'Faster task completion and reduced cognitive load',
        effort: 'medium',
        autoApplicable: false,
        estimatedImprovement: 30,
      });
    }

    // Configuration optimizations
    if (this.metrics.memory.trend === 'increasing' && this.metricHistory.length > 10) {
      this.recommendations.push({
        id: 'config_tuning',
        category: 'configuration',
        priority: 'low',
        title: 'System Configuration Tuning',
        description: 'Adjust system settings for better resource utilization.',
        impact: 'Optimized resource usage and better long-term stability',
        effort: 'high',
        autoApplicable: true,
        estimatedImprovement: 10,
        action: async () => {
          // Reduce history sizes to save memory
          this.maxHistorySize = Math.max(500, this.maxHistorySize * 0.8);
          logger.info('Adjusted system configuration for better performance');
        },
      });
    }

    this.emit('recommendationsUpdated', this.recommendations);
  }

  /**
   * Get current system health assessment
   */
  getSystemHealth(): SystemHealth {
    const components = {
      memory: this.calculateComponentScore('memory'),
      cpu: this.calculateComponentScore('cpu'),
      responseTime: this.calculateComponentScore('responseTime'),
      userExperience: this.calculateComponentScore('userExperience'),
    };

    const overallScore = Object.values(components).reduce((a, b) => a + b, 0) / 4;

    let overall: SystemHealth['overall'];
    if (overallScore >= 90) overall = 'excellent';
    else if (overallScore >= 75) overall = 'good';
    else if (overallScore >= 60) overall = 'fair';
    else if (overallScore >= 40) overall = 'poor';
    else overall = 'critical';

    return {
      overall,
      score: overallScore,
      components,
      recommendations: this.recommendations,
      lastChecked: Date.now(),
    };
  }

  /**
   * Calculate component health score (0-100)
   */
  private calculateComponentScore(component: string): number {
    switch (component) {
      case 'memory': {
        return Math.max(0, 100 - this.metrics.memory.percentage);
      }

      case 'cpu': {
        return Math.max(0, 100 - this.metrics.cpu.usage);
      }

      case 'responseTime': {
        // Score based on response time (lower is better)
        const responseScore = Math.max(0, 100 - this.metrics.responseTime.average / 50);
        return Math.min(100, responseScore);
      }

      case 'userExperience': {
        const errorScore = Math.max(0, 100 - this.metrics.userExperience.errorRate * 2);
        const satisfactionScore = this.metrics.userExperience.satisfactionScore;
        const usabilityScore = this.metrics.userExperience.usabilityScore;
        return (errorScore + satisfactionScore + usabilityScore) / 3;
      }

      default:
        return 50;
    }
  }

  /**
   * Apply optimization recommendation
   */
  async applyRecommendation(recommendationId: string): Promise<boolean> {
    const recommendation = this.recommendations.find((r) => r.id === recommendationId);
    if (!recommendation) {
      return false;
    }

    try {
      if (recommendation.action) {
        await recommendation.action();

        // Remove applied recommendation
        this.recommendations = this.recommendations.filter((r) => r.id !== recommendationId);

        this.emit('recommendationApplied', recommendation);
        return true;
      }
      return false;
    } catch (error: unknown) {
      logger.error('Failed to apply recommendation:', error);
      return false;
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricHistory];
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const health = this.getSystemHealth();

    return {
      currentHealth: health.overall,
      healthScore: health.score,
      recommendationsCount: this.recommendations.length,
      criticalRecommendations: this.recommendations.filter((r) => r.priority === 'critical').length,
      averageResponseTime: this.metrics.responseTime.average,
      memoryUsage: this.metrics.memory.percentage,
      cpuUsage: this.metrics.cpu.usage,
      throughput: this.metrics.throughput.commandsPerMinute,
      isMonitoring: this.isMonitoring,
    };
  }

  /**
   * Reset performance data
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.metricHistory = [];
    this.recommendations = [];
    this.responseTimeSamples = [];
    this.commandTimestamps = [];

    this.emit('performanceReset');
    logger.info('Performance optimizer reset');
  }
}

export const performanceOptimizer = PerformanceOptimizer.getInstance();
