/**
 * Advanced TTFB Monitor - Phase 3 Enhanced Monitoring Component
 * Real-time TTFB breakdown monitoring with heatmaps and performance analytics
 * Provides comprehensive performance observability and budget compliance tracking
 */

import { EventEmitter } from 'events';
import type { TTFBBreakdown, TTFBMeasurement } from './TTFBAuditor.js';

export interface TTFBBudgetConfig {
  auth: number;          // Authentication budget (default: 40ms)
  cache: number;         // Cache lookup budget (default: 20ms)
  rules: number;         // Rules evaluation budget (default: 10ms)
  select: number;        // Model selection budget (default: 10ms)
  flush: number;         // Response preparation budget (default: 120ms)
  total: number;         // Total TTFB budget (default: 500ms)
}

export interface TTFBHeatmapData {
  timeSlots: Array<{
    timestamp: number;
    auth: number[];
    cache: number[];
    rules: number[];
    select: number[];
    flush: number[];
    total: number[];
  }>;
  statistics: {
    p50: TTFBBreakdown;
    p95: TTFBBreakdown;
    p99: TTFBBreakdown;
    budgetViolations: {
      auth: number;
      cache: number;
      rules: number;
      select: number;
      flush: number;
      total: number;
    };
  };
}

export interface TTFBAlert {
  alertId: string;
  severity: 'info' | 'warning' | 'critical';
  component: 'auth' | 'cache' | 'rules' | 'select' | 'flush' | 'total';
  message: string;
  currentValue: number;
  budgetValue: number;
  exceedsBy: number;
  timestamp: Date;
  recommendations: string[];
}

export interface TTFBTrendAnalysis {
  component: 'auth' | 'cache' | 'rules' | 'select' | 'flush' | 'total';
  timeRange: { start: Date; end: Date };
  trend: 'improving' | 'stable' | 'degrading';
  changePercent: number;
  currentAverage: number;
  previousAverage: number;
  recommendations: string[];
  seasonalPattern?: {
    detected: boolean;
    peakHours: number[];
    lowHours: number[];
  };
}

export interface AdvancedTTFBMonitorConfig {
  budgets: TTFBBudgetConfig;
  monitoring: {
    enabled: boolean;
    heatmapResolutionMs: number; // Time slot duration for heatmap (default: 60000ms)
    maxDataPoints: number;       // Maximum data points to keep (default: 1000)
    alertThresholds: {
      warningMultiplier: number;  // Trigger warning at X times budget (default: 1.2)
      criticalMultiplier: number; // Trigger critical at X times budget (default: 1.5)
    };
  };
  analytics: {
    trendAnalysisIntervalMs: number; // How often to analyze trends (default: 300000ms)
    seasonalDetectionEnabled: boolean;
    performanceBaselineEnabled: boolean;
  };
}

export class AdvancedTTFBMonitor extends EventEmitter {
  private readonly measurements = new Map<string, TTFBMeasurement[]>();
  private readonly heatmapData: TTFBHeatmapData['timeSlots'] = [];
  private readonly alerts: TTFBAlert[] = [];
  private readonly trendHistory: TTFBTrendAnalysis[] = [];
  
  private trendAnalysisTimer?: NodeJS.Timeout;
  private alertCheckTimer?: NodeJS.Timeout;

  constructor(private readonly config: AdvancedTTFBMonitorConfig) {
    super();
    
    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }
    
    if (this.config.analytics.trendAnalysisIntervalMs > 0) {
      this.startTrendAnalysis();
    }
  }

  /**
   * Record a TTFB measurement
   */
  recordMeasurement(measurement: TTFBMeasurement): void {
    const modelKey = `${measurement.providerId}:${measurement.modelId}`;
    
    if (!this.measurements.has(modelKey)) {
      this.measurements.set(modelKey, []);
    }
    
    const modelMeasurements = this.measurements.get(modelKey)!;
    modelMeasurements.push(measurement);
    
    // Keep only recent measurements
    if (modelMeasurements.length > this.config.monitoring.maxDataPoints) {
      modelMeasurements.shift();
    }
    
    // Update heatmap data
    this.updateHeatmapData(measurement);
    
    // Check for alerts
    this.checkForAlerts(measurement);
    
    // Emit real-time event
    this.emit('measurementRecorded', {
      traceId: measurement.traceId,
      modelId: measurement.modelId,
      totalTTFBMs: measurement.totalTTFBMs,
      budgetCompliant: this.isBudgetCompliant(measurement.breakdown)
    });
  }

  /**
   * Get real-time heatmap data
   */
  getHeatmapData(timeRangeMs: number = 3600000): TTFBHeatmapData {
    const cutoff = Date.now() - timeRangeMs;
    const recentSlots = this.heatmapData.filter(slot => slot.timestamp > cutoff);
    
    if (recentSlots.length === 0) {
      return this.getEmptyHeatmapData();
    }

    // Calculate statistics
    const allMeasurements = recentSlots.flatMap(slot => 
      slot.auth.map((auth, i) => ({
        auth,
        cache: slot.cache[i],
        rules: slot.rules[i],
        select: slot.select[i],
        flush: slot.flush[i],
        total: slot.total[i]
      }))
    );

    const statistics = this.calculateHeatmapStatistics(allMeasurements);

    return {
      timeSlots: recentSlots,
      statistics
    };
  }

  /**
   * Get performance trends analysis
   */
  getTrendAnalysis(component?: 'auth' | 'cache' | 'rules' | 'select' | 'flush' | 'total'): TTFBTrendAnalysis[] {
    if (component) {
      return this.trendHistory.filter(trend => trend.component === component);
    }
    return this.trendHistory;
  }

  /**
   * Get current alerts
   */
  getCurrentAlerts(): TTFBAlert[] {
    // Return only recent alerts (last 24 hours)
    const cutoff = Date.now() - 86400000;
    return this.alerts.filter(alert => alert.timestamp.getTime() > cutoff);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(timeRangeMs: number = 3600000): {
    overall: {
      averageLatency: number;
      budgetComplianceRate: number;
      totalMeasurements: number;
    };
    byComponent: Record<string, {
      averageLatency: number;
      budgetComplianceRate: number;
      trend: 'improving' | 'stable' | 'degrading';
    }>;
    topBottlenecks: Array<{
      component: string;
      impact: number;
      recommendations: string[];
    }>;
  } {
    const cutoff = Date.now() - timeRangeMs;
    const allMeasurements = Array.from(this.measurements.values())
      .flat()
      .filter(m => m.timestamp > cutoff);

    if (allMeasurements.length === 0) {
      return this.getEmptyPerformanceSummary();
    }

    // Overall metrics
    const totalLatencies = allMeasurements.map(m => m.totalTTFBMs);
    const averageLatency = totalLatencies.reduce((sum, lat) => sum + lat, 0) / totalLatencies.length;
    const budgetCompliant = allMeasurements.filter(m => this.isBudgetCompliant(m.breakdown)).length;
    const budgetComplianceRate = budgetCompliant / allMeasurements.length;

    // By component analysis
    const components = ['auth', 'cache', 'rules', 'select', 'flush'] as const;
    const byComponent: Record<string, any> = {};
    
    for (const component of components) {
      const componentLatencies = allMeasurements.map(m => m.breakdown[`${component}Ms`]);
      const componentAverage = componentLatencies.reduce((sum, lat) => sum + lat, 0) / componentLatencies.length;
      const componentBudget = this.config.budgets[component];
      const componentCompliant = componentLatencies.filter(lat => lat <= componentBudget).length;
      const componentComplianceRate = componentCompliant / componentLatencies.length;
      
      // Get recent trend
      const recentTrends = this.trendHistory
        .filter(t => t.component === component)
        .sort((a, b) => b.timeRange.end.getTime() - a.timeRange.end.getTime());
      const trend = recentTrends[0]?.trend || 'stable';

      byComponent[component] = {
        averageLatency: componentAverage,
        budgetComplianceRate: componentComplianceRate,
        trend
      };
    }

    // Identify bottlenecks
    const topBottlenecks = this.identifyBottlenecks(allMeasurements);

    return {
      overall: {
        averageLatency,
        budgetComplianceRate,
        totalMeasurements: allMeasurements.length
      },
      byComponent,
      topBottlenecks
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations(): {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  } {
    const recommendations = {
      immediate: [] as string[],
      shortTerm: [] as string[],
      longTerm: [] as string[]
    };

    const summary = this.getPerformanceSummary();
    
    // Immediate recommendations based on current alerts
    const criticalAlerts = this.getCurrentAlerts().filter(a => a.severity === 'critical');
    for (const alert of criticalAlerts) {
      recommendations.immediate.push(...alert.recommendations);
    }

    // Short-term recommendations based on component performance
    for (const [component, metrics] of Object.entries(summary.byComponent)) {
      if (metrics.budgetComplianceRate < 0.8) { // Less than 80% compliance
        switch (component) {
          case 'auth':
            recommendations.shortTerm.push('Optimize authentication flow - consider caching tokens');
            break;
          case 'cache':
            recommendations.shortTerm.push('Review cache configuration - increase cache size or TTL');
            break;
          case 'rules':
            recommendations.shortTerm.push('Optimize policy evaluation - consider pre-computed rule results');
            break;
          case 'select':
            recommendations.shortTerm.push('Optimize model selection algorithm - consider parallel evaluation');
            break;
          case 'flush':
            recommendations.shortTerm.push('Optimize response serialization - consider streaming responses');
            break;
        }
      }
    }

    // Long-term recommendations based on trends
    const degradingTrends = this.trendHistory
      .filter(t => t.trend === 'degrading')
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
      
    for (const trend of degradingTrends.slice(0, 3)) { // Top 3 degrading components
      recommendations.longTerm.push(
        `Address long-term degradation in ${trend.component} component (${trend.changePercent.toFixed(1)}% worse)`
      );
    }

    // Add capacity planning recommendations
    if (summary.overall.budgetComplianceRate < 0.9) {
      recommendations.longTerm.push('Consider increasing TTFB budgets or infrastructure capacity');
    }

    return recommendations;
  }

  /**
   * Private methods
   */

  private startMonitoring(): void {
    // Check for alerts every 30 seconds
    this.alertCheckTimer = setInterval(() => {
      this.cleanupOldAlerts();
    }, 30000);
  }

  private startTrendAnalysis(): void {
    this.trendAnalysisTimer = setInterval(() => {
      this.performTrendAnalysis();
    }, this.config.analytics.trendAnalysisIntervalMs);
  }

  private updateHeatmapData(measurement: TTFBMeasurement): void {
    const slotDuration = this.config.monitoring.heatmapResolutionMs;
    const slotTimestamp = Math.floor(measurement.timestamp / slotDuration) * slotDuration;
    
    let slot = this.heatmapData.find(s => s.timestamp === slotTimestamp);
    
    if (!slot) {
      slot = {
        timestamp: slotTimestamp,
        auth: [],
        cache: [],
        rules: [],
        select: [],
        flush: [],
        total: []
      };
      this.heatmapData.push(slot);
      
      // Keep only recent slots
      const cutoff = Date.now() - (24 * 3600000); // 24 hours
      this.heatmapData.splice(0, this.heatmapData.findIndex(s => s.timestamp > cutoff));
    }
    
    slot.auth.push(measurement.breakdown.authMs);
    slot.cache.push(measurement.breakdown.cacheMs);
    slot.rules.push(measurement.breakdown.rulesMs);
    slot.select.push(measurement.breakdown.selectMs);
    slot.flush.push(measurement.breakdown.flushMs);
    slot.total.push(measurement.totalTTFBMs);
  }

  private checkForAlerts(measurement: TTFBMeasurement): void {
    const budgets = this.config.budgets;
    const thresholds = this.config.monitoring.alertThresholds;
    
    const checks = [
      { component: 'auth' as const, value: measurement.breakdown.authMs, budget: budgets.auth },
      { component: 'cache' as const, value: measurement.breakdown.cacheMs, budget: budgets.cache },
      { component: 'rules' as const, value: measurement.breakdown.rulesMs, budget: budgets.rules },
      { component: 'select' as const, value: measurement.breakdown.selectMs, budget: budgets.select },
      { component: 'flush' as const, value: measurement.breakdown.flushMs, budget: budgets.flush },
      { component: 'total' as const, value: measurement.totalTTFBMs, budget: budgets.total }
    ];

    for (const check of checks) {
      const warningThreshold = check.budget * thresholds.warningMultiplier;
      const criticalThreshold = check.budget * thresholds.criticalMultiplier;
      
      if (check.value > criticalThreshold) {
        this.createAlert(check.component, 'critical', check.value, check.budget, measurement);
      } else if (check.value > warningThreshold) {
        this.createAlert(check.component, 'warning', check.value, check.budget, measurement);
      }
    }
  }

  private createAlert(
    component: TTFBAlert['component'],
    severity: TTFBAlert['severity'],
    currentValue: number,
    budgetValue: number,
    measurement: TTFBMeasurement
  ): void {
    const alert: TTFBAlert = {
      alertId: `${component}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      severity,
      component,
      message: `${component.toUpperCase()} component exceeded ${severity} threshold`,
      currentValue,
      budgetValue,
      exceedsBy: currentValue - budgetValue,
      timestamp: new Date(),
      recommendations: this.getComponentRecommendations(component, currentValue, budgetValue)
    };

    this.alerts.push(alert);
    
    // Emit alert event
    this.emit('alertTriggered', alert);
    
    // Keep only recent alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }
  }

  private getComponentRecommendations(
    component: TTFBAlert['component'],
    currentValue: number,
    budgetValue: number
  ): string[] {
    const exceedsBy = ((currentValue / budgetValue) - 1) * 100;
    
    const baseRecommendations: Record<string, string[]> = {
      auth: [
        'Check authentication service response times',
        'Consider implementing token caching',
        'Review authentication middleware performance'
      ],
      cache: [
        'Check cache hit rates and eviction policies',
        'Consider increasing cache memory allocation',
        'Review cache key design for optimal distribution'
      ],
      rules: [
        'Optimize policy evaluation logic',
        'Consider pre-computing rule results',
        'Review rule complexity and nesting'
      ],
      select: [
        'Optimize model selection algorithm',
        'Consider parallel candidate evaluation',
        'Review health check implementation'
      ],
      flush: [
        'Optimize response serialization',
        'Consider response streaming',
        'Review data transformation efficiency'
      ],
      total: [
        'Review overall system architecture',
        'Consider horizontal scaling',
        'Analyze end-to-end request flow'
      ]
    };

    const recommendations = [...baseRecommendations[component]];
    
    if (exceedsBy > 50) {
      recommendations.unshift('URGENT: Performance degradation requires immediate attention');
    }
    
    return recommendations;
  }

  private performTrendAnalysis(): void {
    const components = ['auth', 'cache', 'rules', 'select', 'flush', 'total'] as const;
    const now = new Date();
    const currentPeriod = { start: new Date(now.getTime() - 3600000), end: now }; // Last hour
    const previousPeriod = { start: new Date(now.getTime() - 7200000), end: new Date(now.getTime() - 3600000) }; // Previous hour

    for (const component of components) {
      const trendAnalysis = this.analyzeTrendForComponent(component, currentPeriod, previousPeriod);
      this.trendHistory.push(trendAnalysis);
      
      // Keep only recent trends
      if (this.trendHistory.length > 100) {
        this.trendHistory.shift();
      }
      
      if (trendAnalysis.trend === 'degrading') {
        this.emit('trendDegradation', trendAnalysis);
      }
    }
  }

  private analyzeTrendForComponent(
    component: TTFBAlert['component'],
    currentPeriod: { start: Date; end: Date },
    previousPeriod: { start: Date; end: Date }
  ): TTFBTrendAnalysis {
    const currentMeasurements = this.getMeasurementsInPeriod(currentPeriod);
    const previousMeasurements = this.getMeasurementsInPeriod(previousPeriod);

    const currentValues = currentMeasurements.map(m => this.getComponentValue(m, component));
    const previousValues = previousMeasurements.map(m => this.getComponentValue(m, component));

    const currentAverage = currentValues.reduce((sum, val) => sum + val, 0) / currentValues.length || 0;
    const previousAverage = previousValues.reduce((sum, val) => sum + val, 0) / previousValues.length || 0;

    const changePercent = previousAverage > 0 ? ((currentAverage - previousAverage) / previousAverage) * 100 : 0;
    
    let trend: TTFBTrendAnalysis['trend'];
    if (Math.abs(changePercent) < 5) {
      trend = 'stable';
    } else if (changePercent < 0) {
      trend = 'improving';
    } else {
      trend = 'degrading';
    }

    const seasonalPattern = this.config.analytics.seasonalDetectionEnabled ? 
      this.detectSeasonalPattern(component) : undefined;

    return {
      component,
      timeRange: currentPeriod,
      trend,
      changePercent,
      currentAverage,
      previousAverage,
      recommendations: this.getTrendRecommendations(component, trend, changePercent),
      seasonalPattern
    };
  }

  private getMeasurementsInPeriod(period: { start: Date; end: Date }): TTFBMeasurement[] {
    return Array.from(this.measurements.values())
      .flat()
      .filter(m => m.timestamp >= period.start.getTime() && m.timestamp <= period.end.getTime());
  }

  private getComponentValue(measurement: TTFBMeasurement, component: TTFBAlert['component']): number {
    switch (component) {
      case 'auth': return measurement.breakdown.authMs;
      case 'cache': return measurement.breakdown.cacheMs;
      case 'rules': return measurement.breakdown.rulesMs;
      case 'select': return measurement.breakdown.selectMs;
      case 'flush': return measurement.breakdown.flushMs;
      case 'total': return measurement.totalTTFBMs;
      default: return 0;
    }
  }

  private getTrendRecommendations(
    component: TTFBAlert['component'],
    trend: TTFBTrendAnalysis['trend'],
    changePercent: number
  ): string[] {
    if (trend === 'stable') {
      return [`${component.toUpperCase()} component performance is stable`];
    }
    
    if (trend === 'improving') {
      return [
        `${component.toUpperCase()} component showing improvement (${Math.abs(changePercent).toFixed(1)}% better)`,
        'Continue current optimization efforts'
      ];
    }
    
    // Degrading trend
    const recommendations = [
      `${component.toUpperCase()} component degrading by ${changePercent.toFixed(1)}%`
    ];
    
    if (changePercent > 20) {
      recommendations.push('Significant degradation detected - investigate immediately');
    } else if (changePercent > 10) {
      recommendations.push('Moderate degradation - monitor closely');
    }
    
    return recommendations;
  }

  private detectSeasonalPattern(component: TTFBAlert['component']): TTFBTrendAnalysis['seasonalPattern'] {
    // Simplified seasonal pattern detection
    // In a real implementation, this would analyze historical data more thoroughly
    const measurements = Array.from(this.measurements.values()).flat();
    const hourlyAverages = new Array(24).fill(0).map((_, hour) => {
      const hourlyMeasurements = measurements.filter(m => {
        const measurementHour = new Date(m.timestamp).getHours();
        return measurementHour === hour;
      });
      
      if (hourlyMeasurements.length === 0) return 0;
      
      const hourlyValues = hourlyMeasurements.map(m => this.getComponentValue(m, component));
      return hourlyValues.reduce((sum, val) => sum + val, 0) / hourlyValues.length;
    });

    const maxValue = Math.max(...hourlyAverages);
    const minValue = Math.min(...hourlyAverages);
    const variation = (maxValue - minValue) / maxValue;
    
    if (variation < 0.2) { // Less than 20% variation
      return { detected: false, peakHours: [], lowHours: [] };
    }

    const peakThreshold = maxValue * 0.8;
    const lowThreshold = minValue * 1.2;
    
    const peakHours = hourlyAverages
      .map((avg, hour) => ({ avg, hour }))
      .filter(({ avg }) => avg > peakThreshold)
      .map(({ hour }) => hour);
      
    const lowHours = hourlyAverages
      .map((avg, hour) => ({ avg, hour }))
      .filter(({ avg }) => avg < lowThreshold)
      .map(({ hour }) => hour);

    return {
      detected: true,
      peakHours,
      lowHours
    };
  }

  private calculateHeatmapStatistics(measurements: any[]): TTFBHeatmapData['statistics'] {
    if (measurements.length === 0) {
      return this.getEmptyHeatmapStatistics();
    }

    const components = ['auth', 'cache', 'rules', 'select', 'flush', 'total'] as const;
    const p50: any = {};
    const p95: any = {};
    const p99: any = {};
    const budgetViolations: any = {};

    for (const component of components) {
      const values = measurements.map(m => m[component]).sort((a, b) => a - b);
      const budget = this.config.budgets[component === 'total' ? 'total' : component];
      
      p50[`${component}Ms`] = this.getPercentile(values, 0.5);
      p95[`${component}Ms`] = this.getPercentile(values, 0.95);
      p99[`${component}Ms`] = this.getPercentile(values, 0.99);
      
      budgetViolations[component] = values.filter(v => v > budget).length;
    }

    return { p50, p95, p99, budgetViolations };
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = Math.floor(sortedValues.length * percentile);
    return sortedValues[index] || 0;
  }

  private identifyBottlenecks(measurements: TTFBMeasurement[]): Array<{
    component: string;
    impact: number;
    recommendations: string[];
  }> {
    const components = ['auth', 'cache', 'rules', 'select', 'flush'] as const;
    const bottlenecks = [];

    for (const component of components) {
      const componentValues = measurements.map(m => this.getComponentValue(m, component));
      const average = componentValues.reduce((sum, val) => sum + val, 0) / componentValues.length;
      const budget = this.config.budgets[component];
      const impact = Math.max(0, (average / budget) - 1); // How much it exceeds budget
      
      if (impact > 0.1) { // More than 10% over budget
        bottlenecks.push({
          component,
          impact,
          recommendations: this.getComponentRecommendations(component, average, budget)
        });
      }
    }

    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  private isBudgetCompliant(breakdown: TTFBBreakdown): boolean {
    return breakdown.budgetCompliance.total;
  }

  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - 86400000; // 24 hours
    const originalLength = this.alerts.length;
    
    for (let i = this.alerts.length - 1; i >= 0; i--) {
      if (this.alerts[i].timestamp.getTime() < cutoff) {
        this.alerts.splice(i, 1);
      }
    }
    
    if (this.alerts.length < originalLength) {
      this.emit('alertsCleanedUp', { removed: originalLength - this.alerts.length });
    }
  }

  private getEmptyHeatmapData(): TTFBHeatmapData {
    return {
      timeSlots: [],
      statistics: this.getEmptyHeatmapStatistics()
    };
  }

  private getEmptyHeatmapStatistics(): TTFBHeatmapData['statistics'] {
    const emptyBreakdown = {
      authMs: 0, cacheMs: 0, rulesMs: 0, selectMs: 0, flushMs: 0, totalMs: 0,
      budgetCompliance: { auth: true, cache: true, rules: true, select: true, flush: true, total: true }
    };
    
    return {
      p50: emptyBreakdown,
      p95: emptyBreakdown,
      p99: emptyBreakdown,
      budgetViolations: { auth: 0, cache: 0, rules: 0, select: 0, flush: 0, total: 0 }
    };
  }

  private getEmptyPerformanceSummary(): ReturnType<AdvancedTTFBMonitor['getPerformanceSummary']> {
    return {
      overall: {
        averageLatency: 0,
        budgetComplianceRate: 1.0,
        totalMeasurements: 0
      },
      byComponent: {
        auth: { averageLatency: 0, budgetComplianceRate: 1.0, trend: 'stable' },
        cache: { averageLatency: 0, budgetComplianceRate: 1.0, trend: 'stable' },
        rules: { averageLatency: 0, budgetComplianceRate: 1.0, trend: 'stable' },
        select: { averageLatency: 0, budgetComplianceRate: 1.0, trend: 'stable' },
        flush: { averageLatency: 0, budgetComplianceRate: 1.0, trend: 'stable' }
      },
      topBottlenecks: []
    };
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.trendAnalysisTimer) {
      clearInterval(this.trendAnalysisTimer);
      this.trendAnalysisTimer = undefined;
    }
    
    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer);
      this.alertCheckTimer = undefined;
    }
    
    this.measurements.clear();
    this.heatmapData.length = 0;
    this.alerts.length = 0;
    this.trendHistory.length = 0;
    
    this.emit('cleanup');
  }
}