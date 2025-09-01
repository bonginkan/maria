/**
 * TTFB (Time To First Byte) Auditor - Monitors and analyzes response time performance
 * Provides detailed breakdown of latency sources and budget compliance tracking
 */

import { EventEmitter } from 'events';

export interface TTFBBreakdown {
  authMs: number;
  cacheMs: number;
  rulesMs: number;
  selectMs: number;
  flushMs: number;
  totalMs: number;
  budgetCompliance: {
    auth: boolean;
    cache: boolean;
    rules: boolean;
    select: boolean;
    flush: boolean;
    total: boolean;
  };
}

export interface TTFBBudget {
  authMaxMs: number;
  cacheMaxMs: number;
  rulesMaxMs: number;
  selectMaxMs: number;
  flushMaxMs: number;
  totalMaxMs: number;
}

export interface TTFBMeasurement {
  traceId: string;
  providerId?: string;
  modelId?: string;
  timestamp: Date;
  breakdown: TTFBBreakdown;
  metadata: {
    requestType: string;
    userPlan: string;
    complexity: 'low' | 'medium' | 'high';
    retryAttempt?: number;
  };
}

export interface TTFBAnalytics {
  measurements: number;
  averages: TTFBBreakdown;
  percentiles: {
    p50: TTFBBreakdown;
    p95: TTFBBreakdown;
    p99: TTFBBreakdown;
  };
  budgetCompliance: {
    overallRate: number;
    byComponent: Record<keyof TTFBBreakdown['budgetCompliance'], number>;
  };
  trends: {
    improving: boolean;
    degrading: boolean;
    stable: boolean;
    slope: number; // positive = improving (decreasing latency)
  };
  outliers: TTFBMeasurement[];
  recommendations: {
    urgency: 'low' | 'medium' | 'high' | 'critical';
    actions: string[];
    bottlenecks: string[];
  };
}

export interface TTFBAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  component: keyof TTFBBreakdown['budgetCompliance'] | 'global';
  threshold: number;
  actual: number;
  message: string;
  traceId: string;
  timestamp: Date;
}

export class TTFBAuditor extends EventEmitter {
  private readonly measurements: TTFBMeasurement[] = [];
  private readonly maxMeasurements = 10000;
  private readonly alertThresholds: Map<string, number> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly budget: TTFBBudget = {
      authMaxMs: 40,
      cacheMaxMs: 20,
      rulesMaxMs: 10,
      selectMaxMs: 10,
      flushMaxMs: 120,
      totalMaxMs: 500
    },
    private readonly options: {
      enableRealTimeAlerts: boolean;
      retentionMs: number;
      alertCooldownMs: number;
      outlierThreshold: number; // multiplier for outlier detection
    } = {
      enableRealTimeAlerts: true,
      retentionMs: 24 * 60 * 60 * 1000, // 24 hours
      alertCooldownMs: 300000, // 5 minutes
      outlierThreshold: 3.0 // 3x average is considered outlier
    }
  ) {
    super();
    
    // Set up default alert thresholds
    this.setupDefaultAlertThresholds();
    
    // Start periodic maintenance
    this.cleanupInterval = setInterval(() => {
      this.performMaintenance();
    }, 60000); // Every minute
  }

  /**
   * Record a TTFB measurement with detailed breakdown
   */
  recordMeasurement(measurement: TTFBMeasurement): void {
    // Validate measurement
    if (!this.validateMeasurement(measurement)) {
      this.emit('measurementValidationFailed', {
        traceId: measurement.traceId,
        reason: 'Invalid measurement data'
      });
      return;
    }

    // Add to measurements
    this.measurements.push(measurement);
    
    // Ensure we don't exceed max measurements
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift(); // Remove oldest
    }

    // Check for budget compliance violations
    if (this.options.enableRealTimeAlerts) {
      this.checkBudgetCompliance(measurement);
    }

    // Check for outliers
    this.checkForOutliers(measurement);
    
    this.emit('measurementRecorded', {
      traceId: measurement.traceId,
      totalMs: measurement.breakdown.totalMs,
      compliant: measurement.breakdown.budgetCompliance.total,
      measurementsCount: this.measurements.length
    });
  }

  /**
   * Get current TTFB analytics and insights
   */
  getAnalytics(timeRangeMs?: number): TTFBAnalytics {
    const cutoffTime = timeRangeMs ? new Date(Date.now() - timeRangeMs) : null;
    const relevantMeasurements = cutoffTime 
      ? this.measurements.filter(m => m.timestamp >= cutoffTime)
      : this.measurements;

    if (relevantMeasurements.length === 0) {
      return this.createEmptyAnalytics();
    }

    const averages = this.calculateAverages(relevantMeasurements);
    const percentiles = this.calculatePercentiles(relevantMeasurements);
    const budgetCompliance = this.calculateBudgetCompliance(relevantMeasurements);
    const trends = this.analyzeTrends(relevantMeasurements);
    const outliers = this.findOutliers(relevantMeasurements);
    const recommendations = this.generateRecommendations(averages, budgetCompliance, trends, outliers);

    return {
      measurements: relevantMeasurements.length,
      averages,
      percentiles,
      budgetCompliance,
      trends,
      outliers,
      recommendations
    };
  }

  /**
   * Get real-time performance summary
   */
  getRealTimeSummary(): {
    recentAverage: number;
    budgetComplianceRate: number;
    activeAlerts: TTFBAlert[];
    status: 'healthy' | 'warning' | 'critical';
  } {
    // Get last 10 measurements
    const recent = this.measurements.slice(-10);
    
    if (recent.length === 0) {
      return {
        recentAverage: 0,
        budgetComplianceRate: 1.0,
        activeAlerts: [],
        status: 'healthy'
      };
    }

    const recentAverage = recent.reduce((sum, m) => sum + m.breakdown.totalMs, 0) / recent.length;
    const compliantCount = recent.filter(m => m.breakdown.budgetCompliance.total).length;
    const budgetComplianceRate = compliantCount / recent.length;
    
    // Get recent alerts (last 5 minutes)
    const recentAlerts = this.getRecentAlerts(300000);
    
    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (budgetComplianceRate < 0.8 || recentAverage > this.budget.totalMaxMs * 1.5) {
      status = 'critical';
    } else if (budgetComplianceRate < 0.95 || recentAverage > this.budget.totalMaxMs) {
      status = 'warning';
    }

    return {
      recentAverage,
      budgetComplianceRate,
      activeAlerts: recentAlerts,
      status
    };
  }

  /**
   * Get component-specific performance breakdown
   */
  getComponentBreakdown(timeRangeMs = 3600000): { // Default 1 hour
    [K in keyof TTFBBreakdown['budgetCompliance']]: {
      average: number;
      p95: number;
      budgetMs: number;
      complianceRate: number;
      worstOffenders: Array<{ traceId: string; value: number; timestamp: Date }>;
    };
  } {
    const cutoffTime = new Date(Date.now() - timeRangeMs);
    const relevantMeasurements = this.measurements.filter(m => m.timestamp >= cutoffTime);

    const components: (keyof TTFBBreakdown['budgetCompliance'])[] = [
      'auth', 'cache', 'rules', 'select', 'flush', 'total'
    ];

    const result = {} as any;

    for (const component of components) {
      const values = relevantMeasurements.map(m => ({
        value: this.getComponentValue(m.breakdown, component),
        traceId: m.traceId,
        timestamp: m.timestamp,
        compliant: m.breakdown.budgetCompliance[component]
      }));

      if (values.length === 0) {
        result[component] = {
          average: 0,
          p95: 0,
          budgetMs: this.getComponentBudget(component),
          complianceRate: 1.0,
          worstOffenders: []
        };
        continue;
      }

      values.sort((a, b) => a.value - b.value);
      const average = values.reduce((sum, v) => sum + v.value, 0) / values.length;
      const p95Index = Math.floor(values.length * 0.95);
      const p95 = values[p95Index]?.value || values[values.length - 1].value;
      
      const compliantCount = values.filter(v => v.compliant).length;
      const complianceRate = compliantCount / values.length;
      
      // Get worst offenders (top 5)
      const worstOffenders = values
        .slice(-5)
        .reverse()
        .map(v => ({
          traceId: v.traceId,
          value: v.value,
          timestamp: v.timestamp
        }));

      result[component] = {
        average,
        p95,
        budgetMs: this.getComponentBudget(component),
        complianceRate,
        worstOffenders
      };
    }

    return result;
  }

  /**
   * Set custom alert threshold for a component
   */
  setAlertThreshold(component: string, thresholdMs: number): void {
    this.alertThresholds.set(component, thresholdMs);
    
    this.emit('alertThresholdUpdated', {
      component,
      thresholdMs,
      timestamp: new Date()
    });
  }

  /**
   * Private methods
   */

  private validateMeasurement(measurement: TTFBMeasurement): boolean {
    const breakdown = measurement.breakdown;
    
    // Check for negative values
    if (breakdown.authMs < 0 || breakdown.cacheMs < 0 || breakdown.rulesMs < 0 ||
        breakdown.selectMs < 0 || breakdown.flushMs < 0 || breakdown.totalMs < 0) {
      return false;
    }

    // Check for impossibly high values (>10 seconds)
    if (breakdown.totalMs > 10000) {
      return false;
    }

    // Check if total roughly equals sum of parts (allow 10% variance)
    const calculatedTotal = breakdown.authMs + breakdown.cacheMs + breakdown.rulesMs + 
                           breakdown.selectMs + breakdown.flushMs;
    const variance = Math.abs(calculatedTotal - breakdown.totalMs) / breakdown.totalMs;
    
    return variance < 0.1; // 10% tolerance
  }

  private checkBudgetCompliance(measurement: TTFBMeasurement): void {
    const breakdown = measurement.breakdown;
    const compliance = breakdown.budgetCompliance;
    
    // Check each component
    if (!compliance.auth && breakdown.authMs > this.budget.authMaxMs) {
      this.emitAlert('warning', 'auth', this.budget.authMaxMs, breakdown.authMs, measurement.traceId);
    }
    
    if (!compliance.cache && breakdown.cacheMs > this.budget.cacheMaxMs) {
      this.emitAlert('warning', 'cache', this.budget.cacheMaxMs, breakdown.cacheMs, measurement.traceId);
    }
    
    if (!compliance.rules && breakdown.rulesMs > this.budget.rulesMaxMs) {
      this.emitAlert('warning', 'rules', this.budget.rulesMaxMs, breakdown.rulesMs, measurement.traceId);
    }
    
    if (!compliance.select && breakdown.selectMs > this.budget.selectMaxMs) {
      this.emitAlert('warning', 'select', this.budget.selectMaxMs, breakdown.selectMs, measurement.traceId);
    }
    
    if (!compliance.flush && breakdown.flushMs > this.budget.flushMaxMs) {
      this.emitAlert('error', 'flush', this.budget.flushMaxMs, breakdown.flushMs, measurement.traceId);
    }
    
    if (!compliance.total && breakdown.totalMs > this.budget.totalMaxMs) {
      const level = breakdown.totalMs > this.budget.totalMaxMs * 2 ? 'critical' : 'error';
      this.emitAlert(level, 'global', this.budget.totalMaxMs, breakdown.totalMs, measurement.traceId);
    }
  }

  private checkForOutliers(measurement: TTFBMeasurement): void {
    if (this.measurements.length < 10) return; // Need baseline

    const recent = this.measurements.slice(-50); // Last 50 measurements
    const average = recent.reduce((sum, m) => sum + m.breakdown.totalMs, 0) / recent.length;
    
    if (measurement.breakdown.totalMs > average * this.options.outlierThreshold) {
      this.emit('outlierDetected', {
        traceId: measurement.traceId,
        actualMs: measurement.breakdown.totalMs,
        averageMs: average,
        multiplier: measurement.breakdown.totalMs / average
      });
    }
  }

  private calculateAverages(measurements: TTFBMeasurement[]): TTFBBreakdown {
    const sums = measurements.reduce((acc, m) => ({
      authMs: acc.authMs + m.breakdown.authMs,
      cacheMs: acc.cacheMs + m.breakdown.cacheMs,
      rulesMs: acc.rulesMs + m.breakdown.rulesMs,
      selectMs: acc.selectMs + m.breakdown.selectMs,
      flushMs: acc.flushMs + m.breakdown.flushMs,
      totalMs: acc.totalMs + m.breakdown.totalMs
    }), { authMs: 0, cacheMs: 0, rulesMs: 0, selectMs: 0, flushMs: 0, totalMs: 0 });

    const count = measurements.length;
    
    return {
      authMs: sums.authMs / count,
      cacheMs: sums.cacheMs / count,
      rulesMs: sums.rulesMs / count,
      selectMs: sums.selectMs / count,
      flushMs: sums.flushMs / count,
      totalMs: sums.totalMs / count,
      budgetCompliance: {
        auth: (sums.authMs / count) <= this.budget.authMaxMs,
        cache: (sums.cacheMs / count) <= this.budget.cacheMaxMs,
        rules: (sums.rulesMs / count) <= this.budget.rulesMaxMs,
        select: (sums.selectMs / count) <= this.budget.selectMaxMs,
        flush: (sums.flushMs / count) <= this.budget.flushMaxMs,
        total: (sums.totalMs / count) <= this.budget.totalMaxMs
      }
    };
  }

  private calculatePercentiles(measurements: TTFBMeasurement[]): TTFBAnalytics['percentiles'] {
    const sorted = {
      auth: measurements.map(m => m.breakdown.authMs).sort((a, b) => a - b),
      cache: measurements.map(m => m.breakdown.cacheMs).sort((a, b) => a - b),
      rules: measurements.map(m => m.breakdown.rulesMs).sort((a, b) => a - b),
      select: measurements.map(m => m.breakdown.selectMs).sort((a, b) => a - b),
      flush: measurements.map(m => m.breakdown.flushMs).sort((a, b) => a - b),
      total: measurements.map(m => m.breakdown.totalMs).sort((a, b) => a - b)
    };

    const getPercentile = (arr: number[], p: number) => {
      const index = Math.floor(arr.length * p);
      return arr[Math.min(index, arr.length - 1)] || 0;
    };

    return {
      p50: {
        authMs: getPercentile(sorted.auth, 0.5),
        cacheMs: getPercentile(sorted.cache, 0.5),
        rulesMs: getPercentile(sorted.rules, 0.5),
        selectMs: getPercentile(sorted.select, 0.5),
        flushMs: getPercentile(sorted.flush, 0.5),
        totalMs: getPercentile(sorted.total, 0.5),
        budgetCompliance: {} as any // Not applicable for percentiles
      },
      p95: {
        authMs: getPercentile(sorted.auth, 0.95),
        cacheMs: getPercentile(sorted.cache, 0.95),
        rulesMs: getPercentile(sorted.rules, 0.95),
        selectMs: getPercentile(sorted.select, 0.95),
        flushMs: getPercentile(sorted.flush, 0.95),
        totalMs: getPercentile(sorted.total, 0.95),
        budgetCompliance: {} as any
      },
      p99: {
        authMs: getPercentile(sorted.auth, 0.99),
        cacheMs: getPercentile(sorted.cache, 0.99),
        rulesMs: getPercentile(sorted.rules, 0.99),
        selectMs: getPercentile(sorted.select, 0.99),
        flushMs: getPercentile(sorted.flush, 0.99),
        totalMs: getPercentile(sorted.total, 0.99),
        budgetCompliance: {} as any
      }
    };
  }

  private calculateBudgetCompliance(measurements: TTFBMeasurement[]): TTFBAnalytics['budgetCompliance'] {
    const compliantCounts = {
      auth: 0, cache: 0, rules: 0, select: 0, flush: 0, total: 0
    };

    for (const measurement of measurements) {
      const compliance = measurement.breakdown.budgetCompliance;
      if (compliance.auth) compliantCounts.auth++;
      if (compliance.cache) compliantCounts.cache++;
      if (compliance.rules) compliantCounts.rules++;
      if (compliance.select) compliantCounts.select++;
      if (compliance.flush) compliantCounts.flush++;
      if (compliance.total) compliantCounts.total++;
    }

    const count = measurements.length;
    const overallRate = Object.values(compliantCounts).reduce((sum, c) => sum + c, 0) / (count * 6);

    return {
      overallRate,
      byComponent: {
        auth: compliantCounts.auth / count,
        cache: compliantCounts.cache / count,
        rules: compliantCounts.rules / count,
        select: compliantCounts.select / count,
        flush: compliantCounts.flush / count,
        total: compliantCounts.total / count
      }
    };
  }

  private analyzeTrends(measurements: TTFBMeasurement[]): TTFBAnalytics['trends'] {
    if (measurements.length < 5) {
      return { improving: false, degrading: false, stable: true, slope: 0 };
    }

    // Simple linear regression on total TTFB
    const values = measurements.map((m, i) => ({ x: i, y: m.breakdown.totalMs }));
    const n = values.length;
    
    const sumX = values.reduce((sum, v) => sum + v.x, 0);
    const sumY = values.reduce((sum, v) => sum + v.y, 0);
    const sumXY = values.reduce((sum, v) => sum + v.x * v.y, 0);
    const sumXX = values.reduce((sum, v) => sum + v.x * v.x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    const improving = slope < -1; // Decreasing TTFB is improving
    const degrading = slope > 1; // Increasing TTFB is degrading
    const stable = Math.abs(slope) <= 1;

    return { improving, degrading, stable, slope };
  }

  private findOutliers(measurements: TTFBMeasurement[]): TTFBMeasurement[] {
    if (measurements.length < 10) return [];

    const totalTimes = measurements.map(m => m.breakdown.totalMs);
    const mean = totalTimes.reduce((sum, t) => sum + t, 0) / totalTimes.length;
    const stdDev = Math.sqrt(
      totalTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / totalTimes.length
    );

    return measurements.filter(m => 
      Math.abs(m.breakdown.totalMs - mean) > stdDev * 2 // 2 standard deviations
    );
  }

  private generateRecommendations(
    averages: TTFBBreakdown,
    budgetCompliance: TTFBAnalytics['budgetCompliance'],
    trends: TTFBAnalytics['trends'],
    outliers: TTFBMeasurement[]
  ): TTFBAnalytics['recommendations'] {
    const actions: string[] = [];
    const bottlenecks: string[] = [];
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check compliance rates
    if (budgetCompliance.overallRate < 0.7) {
      urgency = 'critical';
      actions.push('Immediate performance optimization required');
    } else if (budgetCompliance.overallRate < 0.9) {
      urgency = 'high';
      actions.push('Performance tuning needed');
    }

    // Check trends
    if (trends.degrading && Math.abs(trends.slope) > 5) {
      urgency = Math.max(urgency, 'high') as any;
      actions.push('Investigate performance degradation trend');
    }

    // Identify bottlenecks
    if (averages.authMs > this.budget.authMaxMs) {
      bottlenecks.push('Authentication/authorization');
      actions.push('Optimize authentication flow');
    }
    
    if (averages.cacheMs > this.budget.cacheMaxMs) {
      bottlenecks.push('Cache access');
      actions.push('Review cache configuration and hit rates');
    }
    
    if (averages.rulesMs > this.budget.rulesMaxMs) {
      bottlenecks.push('Rules evaluation');
      actions.push('Optimize policy evaluation logic');
    }
    
    if (averages.selectMs > this.budget.selectMaxMs) {
      bottlenecks.push('Model selection');
      actions.push('Optimize model selection algorithms');
    }
    
    if (averages.flushMs > this.budget.flushMaxMs) {
      bottlenecks.push('Response preparation');
      actions.push('Optimize response preparation and flush operations');
    }

    // Check for outliers
    if (outliers.length > this.measurements.length * 0.05) { // More than 5% outliers
      actions.push('Investigate frequent performance outliers');
      urgency = Math.max(urgency, 'medium') as any;
    }

    return { urgency, actions, bottlenecks };
  }

  private createEmptyAnalytics(): TTFBAnalytics {
    const emptyBreakdown: TTFBBreakdown = {
      authMs: 0, cacheMs: 0, rulesMs: 0, selectMs: 0, flushMs: 0, totalMs: 0,
      budgetCompliance: { auth: true, cache: true, rules: true, select: true, flush: true, total: true }
    };

    return {
      measurements: 0,
      averages: emptyBreakdown,
      percentiles: { p50: emptyBreakdown, p95: emptyBreakdown, p99: emptyBreakdown },
      budgetCompliance: { overallRate: 1.0, byComponent: { auth: 1, cache: 1, rules: 1, select: 1, flush: 1, total: 1 } },
      trends: { improving: false, degrading: false, stable: true, slope: 0 },
      outliers: [],
      recommendations: { urgency: 'low', actions: [], bottlenecks: [] }
    };
  }

  private setupDefaultAlertThresholds(): void {
    this.alertThresholds.set('auth', this.budget.authMaxMs * 1.5);
    this.alertThresholds.set('cache', this.budget.cacheMaxMs * 1.5);
    this.alertThresholds.set('rules', this.budget.rulesMaxMs * 1.5);
    this.alertThresholds.set('select', this.budget.selectMaxMs * 1.5);
    this.alertThresholds.set('flush', this.budget.flushMaxMs * 1.5);
    this.alertThresholds.set('total', this.budget.totalMaxMs * 1.5);
  }

  private emitAlert(
    level: TTFBAlert['level'],
    component: TTFBAlert['component'],
    threshold: number,
    actual: number,
    traceId: string
  ): void {
    const alert: TTFBAlert = {
      level,
      component,
      threshold,
      actual,
      message: `${component} TTFB exceeded threshold: ${actual}ms > ${threshold}ms`,
      traceId,
      timestamp: new Date()
    };

    this.emit('ttfbAlert', alert);
  }

  private getComponentValue(breakdown: TTFBBreakdown, component: keyof TTFBBreakdown['budgetCompliance']): number {
    switch (component) {
      case 'auth': return breakdown.authMs;
      case 'cache': return breakdown.cacheMs;
      case 'rules': return breakdown.rulesMs;
      case 'select': return breakdown.selectMs;
      case 'flush': return breakdown.flushMs;
      case 'total': return breakdown.totalMs;
      default: return 0;
    }
  }

  private getComponentBudget(component: keyof TTFBBreakdown['budgetCompliance']): number {
    switch (component) {
      case 'auth': return this.budget.authMaxMs;
      case 'cache': return this.budget.cacheMaxMs;
      case 'rules': return this.budget.rulesMaxMs;
      case 'select': return this.budget.selectMaxMs;
      case 'flush': return this.budget.flushMaxMs;
      case 'total': return this.budget.totalMaxMs;
      default: return 0;
    }
  }

  private getRecentAlerts(timeRangeMs: number): TTFBAlert[] {
    // This would typically query from a persistent store
    // For now, return empty array as alerts are not persisted
    return [];
  }

  private performMaintenance(): void {
    // Remove old measurements
    const cutoffTime = new Date(Date.now() - this.options.retentionMs);
    const beforeCount = this.measurements.length;
    
    for (let i = this.measurements.length - 1; i >= 0; i--) {
      if (this.measurements[i].timestamp < cutoffTime) {
        this.measurements.splice(i, 1);
      }
    }

    const removedCount = beforeCount - this.measurements.length;
    if (removedCount > 0) {
      this.emit('maintenanceCompleted', {
        removedMeasurements: removedCount,
        remainingMeasurements: this.measurements.length,
        timestamp: new Date()
      });
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.measurements.length = 0;
    this.alertThresholds.clear();
    this.emit('cleanup');
  }
}