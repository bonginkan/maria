/**
 * Hysteresis Health Checker - Prevents oscillation in health status
 * Uses hysteresis to provide stable health transitions with configurable thresholds
 */

import { EventEmitter } from 'events';

export interface HealthMetric {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface HysteresisConfig {
  /** Threshold to transition from unhealthy to healthy */
  healthyThreshold: number;
  /** Threshold to transition from healthy to unhealthy */
  unhealthyThreshold: number;
  /** Minimum duration to stay in current state before transition */
  minStayDurationMs: number;
  /** Window size for metric aggregation */
  windowSizeMs: number;
  /** Minimum samples needed for reliable assessment */
  minSamples: number;
}

export interface HealthState {
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
  lastTransitionAt: Date;
  canTransition: boolean;
  transitionReason?: string;
  metricHistory: HealthMetric[];
  stabilityScore: number; // 0-1, higher means more stable
}

export interface ProviderHealthAssessment {
  providerId: string;
  modelId?: string;
  healthState: HealthState;
  trends: {
    improving: boolean;
    degrading: boolean;
    stable: boolean;
    confidenceLevel: number;
  };
  recommendations: {
    action: 'continue' | 'monitor' | 'reduce_load' | 'circuit_break';
    reason: string;
    confidence: number;
  };
}

export class HysteresisHealthChecker extends EventEmitter {
  private readonly healthStates = new Map<string, HealthState>();
  private readonly cleanupTimer: NodeJS.Timeout;
  
  constructor(
    private readonly config: HysteresisConfig = {
      healthyThreshold: 0.8,
      unhealthyThreshold: 0.4,
      minStayDurationMs: 30000, // 30 seconds
      windowSizeMs: 300000, // 5 minutes
      minSamples: 5
    }
  ) {
    super();
    
    // Validate configuration
    if (config.healthyThreshold <= config.unhealthyThreshold) {
      throw new Error('healthyThreshold must be greater than unhealthyThreshold for proper hysteresis');
    }
    
    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleStates();
    }, this.config.windowSizeMs);
  }

  /**
   * Record a health metric for a provider/model
   */
  recordMetric(
    providerId: string, 
    metric: Omit<HealthMetric, 'timestamp'>,
    modelId?: string
  ): void {
    const key = modelId ? `${providerId}:${modelId}` : providerId;
    const healthMetric: HealthMetric = {
      ...metric,
      timestamp: new Date()
    };

    const state = this.getOrCreateHealthState(key);
    
    // Add metric to history
    state.metricHistory.push(healthMetric);
    this.trimMetricHistory(state);

    // Calculate new health score
    const newScore = this.calculateAggregatedScore(state.metricHistory);
    const previousScore = state.score;
    const previousStatus = state.status;
    
    state.score = newScore;
    state.stabilityScore = this.calculateStabilityScore(state.metricHistory);

    // Check for state transition with hysteresis
    const canTransition = this.canTransitionState(state);
    state.canTransition = canTransition;
    
    if (canTransition) {
      const newStatus = this.determineHealthStatus(newScore, state.status);
      
      if (newStatus !== previousStatus) {
        const transitionReason = `Score changed from ${previousScore.toFixed(3)} to ${newScore.toFixed(3)}`;
        state.status = newStatus;
        state.lastTransitionAt = new Date();
        state.transitionReason = transitionReason;

        this.emit('healthTransition', {
          providerId,
          modelId,
          from: previousStatus,
          to: newStatus,
          score: newScore,
          reason: transitionReason,
          stabilityScore: state.stabilityScore
        });
      }
    }

    this.emit('metricRecorded', {
      providerId,
      modelId,
      metric: healthMetric,
      newScore,
      status: state.status,
      canTransition
    });
  }

  /**
   * Get current health assessment for a provider/model
   */
  getHealthAssessment(providerId: string, modelId?: string): ProviderHealthAssessment | null {
    const key = modelId ? `${providerId}:${modelId}` : providerId;
    const state = this.healthStates.get(key);
    
    if (!state || state.metricHistory.length < this.config.minSamples) {
      return null;
    }

    const trends = this.analyzeTrends(state.metricHistory);
    const recommendations = this.generateRecommendations(state, trends);

    return {
      providerId,
      modelId,
      healthState: { ...state },
      trends,
      recommendations
    };
  }

  /**
   * Get all health states
   */
  getAllHealthStates(): Map<string, ProviderHealthAssessment> {
    const assessments = new Map<string, ProviderHealthAssessment>();
    
    for (const [key, state] of this.healthStates.entries()) {
      if (state.metricHistory.length >= this.config.minSamples) {
        const [providerId, modelId] = key.split(':');
        const assessment = this.getHealthAssessment(providerId, modelId);
        if (assessment) {
          assessments.set(key, assessment);
        }
      }
    }
    
    return assessments;
  }

  /**
   * Force a health state transition (for testing/emergency)
   */
  forceTransition(
    providerId: string, 
    newStatus: HealthState['status'],
    reason: string,
    modelId?: string
  ): void {
    const key = modelId ? `${providerId}:${modelId}` : providerId;
    const state = this.getOrCreateHealthState(key);
    
    const previousStatus = state.status;
    state.status = newStatus;
    state.lastTransitionAt = new Date();
    state.transitionReason = `Force transition: ${reason}`;
    state.canTransition = true;

    this.emit('forcedTransition', {
      providerId,
      modelId,
      from: previousStatus,
      to: newStatus,
      reason,
      forced: true
    });
  }

  /**
   * Get health summary across all providers
   */
  getHealthSummary(): {
    totalProviders: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    averageScore: number;
    averageStability: number;
    unstableProviders: string[];
  } {
    const states = Array.from(this.healthStates.values());
    const validStates = states.filter(s => s.metricHistory.length >= this.config.minSamples);
    
    if (validStates.length === 0) {
      return {
        totalProviders: 0,
        healthyCount: 0,
        degradedCount: 0,
        unhealthyCount: 0,
        averageScore: 0,
        averageStability: 0,
        unstableProviders: []
      };
    }

    const healthyCount = validStates.filter(s => s.status === 'healthy').length;
    const degradedCount = validStates.filter(s => s.status === 'degraded').length;
    const unhealthyCount = validStates.filter(s => s.status === 'unhealthy').length;
    
    const averageScore = validStates.reduce((sum, s) => sum + s.score, 0) / validStates.length;
    const averageStability = validStates.reduce((sum, s) => sum + s.stabilityScore, 0) / validStates.length;
    
    const unstableProviders = Array.from(this.healthStates.entries())
      .filter(([_, state]) => state.stabilityScore < 0.5)
      .map(([key, _]) => key);

    return {
      totalProviders: validStates.length,
      healthyCount,
      degradedCount,
      unhealthyCount,
      averageScore,
      averageStability,
      unstableProviders
    };
  }

  /**
   * Private methods
   */

  private getOrCreateHealthState(key: string): HealthState {
    if (!this.healthStates.has(key)) {
      this.healthStates.set(key, {
        status: 'healthy', // Start optimistic
        score: 1.0,
        lastTransitionAt: new Date(),
        canTransition: true,
        metricHistory: [],
        stabilityScore: 1.0
      });
    }
    return this.healthStates.get(key)!;
  }

  private trimMetricHistory(state: HealthState): void {
    const cutoffTime = new Date(Date.now() - this.config.windowSizeMs);
    state.metricHistory = state.metricHistory.filter(
      metric => metric.timestamp >= cutoffTime
    );
  }

  private calculateAggregatedScore(metrics: HealthMetric[]): number {
    if (metrics.length === 0) return 1.0;

    // Use weighted average with more recent metrics having higher weight
    const now = Date.now();
    let weightedSum = 0;
    let totalWeight = 0;

    for (const metric of metrics) {
      const age = now - metric.timestamp.getTime();
      const weight = Math.exp(-age / (this.config.windowSizeMs / 4)); // Exponential decay
      
      weightedSum += metric.value * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 1.0;
  }

  private calculateStabilityScore(metrics: HealthMetric[]): number {
    if (metrics.length < 3) return 1.0;

    // Calculate coefficient of variation (CV = std dev / mean)
    const values = metrics.map(m => m.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const cv = mean > 0 ? stdDev / mean : 0;
    
    // Convert CV to stability score (lower CV = higher stability)
    return Math.max(0, Math.min(1, 1 - cv));
  }

  private canTransitionState(state: HealthState): boolean {
    const timeSinceLastTransition = Date.now() - state.lastTransitionAt.getTime();
    return timeSinceLastTransition >= this.config.minStayDurationMs;
  }

  private determineHealthStatus(score: number, currentStatus: HealthState['status']): HealthState['status'] {
    switch (currentStatus) {
      case 'healthy':
        // Can only transition down if below unhealthy threshold
        if (score < this.config.unhealthyThreshold) {
          return score < this.config.unhealthyThreshold * 0.5 ? 'unhealthy' : 'degraded';
        }
        return 'healthy';
        
      case 'degraded':
        // Can transition up if above healthy threshold
        if (score >= this.config.healthyThreshold) {
          return 'healthy';
        }
        // Can transition down if below unhealthy threshold
        if (score < this.config.unhealthyThreshold) {
          return 'unhealthy';
        }
        return 'degraded';
        
      case 'unhealthy':
        // Can only transition up if above healthy threshold (hysteresis gap)
        if (score >= this.config.healthyThreshold) {
          return 'healthy';
        }
        if (score >= this.config.unhealthyThreshold) {
          return 'degraded';
        }
        return 'unhealthy';
        
      default:
        return currentStatus;
    }
  }

  private analyzeTrends(metrics: HealthMetric[]): ProviderHealthAssessment['trends'] {
    if (metrics.length < 3) {
      return {
        improving: false,
        degrading: false,
        stable: true,
        confidenceLevel: 0.5
      };
    }

    // Simple linear regression to detect trend
    const n = metrics.length;
    const x = metrics.map((_, i) => i);
    const y = metrics.map(m => m.value);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate correlation coefficient for confidence
    const meanX = sumX / n;
    const meanY = sumY / n;
    
    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
    const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));
    
    const correlation = denomX * denomY > 0 ? numerator / (denomX * denomY) : 0;
    const confidenceLevel = Math.abs(correlation);
    
    const improving = slope > 0.01 && confidenceLevel > 0.6;
    const degrading = slope < -0.01 && confidenceLevel > 0.6;
    const stable = !improving && !degrading;

    return {
      improving,
      degrading,
      stable,
      confidenceLevel
    };
  }

  private generateRecommendations(
    state: HealthState, 
    trends: ProviderHealthAssessment['trends']
  ): ProviderHealthAssessment['recommendations'] {
    // Emergency conditions
    if (state.status === 'unhealthy' && trends.degrading && trends.confidenceLevel > 0.8) {
      return {
        action: 'circuit_break',
        reason: 'Health critically low and degrading rapidly',
        confidence: 0.9
      };
    }

    // Degraded conditions
    if (state.status === 'degraded' || (state.status === 'healthy' && trends.degrading)) {
      return {
        action: 'reduce_load',
        reason: 'Health showing signs of degradation',
        confidence: 0.7
      };
    }

    // Monitoring conditions
    if (state.stabilityScore < 0.5 || (state.status !== 'healthy' && !trends.improving)) {
      return {
        action: 'monitor',
        reason: 'Health status unstable or not improving',
        confidence: 0.6
      };
    }

    // Normal operation
    return {
      action: 'continue',
      reason: 'Health status stable and acceptable',
      confidence: 0.8
    };
  }

  private cleanupStaleStates(): void {
    const cutoffTime = new Date(Date.now() - this.config.windowSizeMs * 2);
    
    for (const [key, state] of this.healthStates.entries()) {
      const lastMetric = state.metricHistory[state.metricHistory.length - 1];
      
      if (!lastMetric || lastMetric.timestamp < cutoffTime) {
        this.healthStates.delete(key);
        this.emit('stateCleanup', { key, lastMetricAt: lastMetric?.timestamp });
      }
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.healthStates.clear();
    this.emit('cleanup');
  }
}