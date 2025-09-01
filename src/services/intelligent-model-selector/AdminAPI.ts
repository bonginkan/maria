/**
 * Admin API - RBAC-protected administrative interface for IMS management
 * Provides secure access to system management, monitoring, and debugging capabilities
 */

import { EventEmitter } from 'events';
import type { CompleteRoutingLog, TTFBBreakdown } from './types/DecisionLog.js';
import type { CompleteDecisionLogger } from './CompleteDecisionLogger.js';
import type { TTFBAuditor, TTFBAnalytics } from './TTFBAuditor.js';
import type { HysteresisHealthChecker } from './HysteresisHealthChecker.js';
import type { RunawayPreventionCircuitBreaker } from './RunawayPreventionCircuitBreaker.js';
import type { IMSRouter } from './IMSRouter.js';
import type { AdvancedTTFBMonitor, TTFBHeatmapData, TTFBTrendAnalysis } from './AdvancedTTFBMonitor.js';
import type { GoldenDatasetMonitor, DailyReproductionReport, GoldenTestCase } from './GoldenDatasetMonitor.js';

export type AdminRole = 'ims.viewer' | 'ims.operator' | 'ims.admin';

export interface AdminUser {
  userId: string;
  email: string;
  roles: AdminRole[];
  permissions: string[];
  lastLoginAt?: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface AdminAPIConfig {
  enableRBAC: boolean;
  enableAuditLogging: boolean;
  sessionTimeoutMs: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

export interface DecisionDetailsResponse {
  decision: CompleteRoutingLog;
  selectedModel: {
    id: string;
    providerId: string;
    confidence: number;
  };
  explanation: {
    whySelected: string[];
    whyOthersRejected: string[];
    riskFactors: string[];
    optimizationSuggestions: string[];
  };
  reproductionTest?: {
    canReproduce: boolean;
    differences?: any;
  };
}

export interface TTFBBreakdownResponse {
  timeRange: { start: Date; end: Date };
  breakdown: TTFBAnalytics;
  budgetCompliance: {
    overall: number;
    byComponent: Record<string, number>;
    trends: {
      improving: boolean;
      degrading: boolean;
      recommendations: string[];
    };
  };
  recommendations: {
    urgency: 'low' | 'medium' | 'high' | 'critical';
    actions: string[];
    bottlenecks: string[];
  };
}

export interface KillSwitchRequest {
  mode: 'low-tier-only' | 'emergency-model-only' | 'maintenance';
  durationMs: number;
  reason: string;
}

export interface KillSwitchResponse {
  status: 'activated' | 'deactivated';
  mode?: string;
  expiresAt?: Date;
  reason?: string;
  activatedBy: string;
}

export interface ReproductionTestRequest {
  traceId: string;
  validateGenerationParams?: boolean;
}

export interface ReproductionTestResponse {
  originalDecision: {
    modelId: string;
    generationParams: any;
    reasons: string[];
  };
  reproducedDecision: {
    modelId: string;
    generationParams: any;
    reasons: string[];
  };
  exactMatch: boolean;
  differences: {
    modelChanged: boolean;
    parametersDifferent: boolean;
    reasonsDifferent: boolean;
    details: any;
  };
  reproductionScore: number; // 0-1, 1 = perfect reproduction
}

export interface GoldenDatasetResponse {
  testCases: GoldenTestCase[];
  totalCount: number;
  activeCount: number;
  categories: string[];
}

export interface DailyReproductionSummary {
  date: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageScore: number;
  failedTestCases: string[];
  trends: {
    scoreChange: number;
    passRateChange: number;
    recommendations: string[];
  };
}

export interface TTFBHeatmapResponse {
  heatmapData: TTFBHeatmapData;
  visualization: {
    timeSlots: string[];
    components: string[];
    values: number[][];
    alerts: Array<{
      component: string;
      severity: 'warning' | 'critical';
      message: string;
    }>;
  };
  trendAnalysis: TTFBTrendAnalysis[];
}

/**
 * Decorator for role-based access control
 */
export function RequireRole(role: AdminRole) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const req = args[0]; // Assume first argument is request object
      
      if (!req.user || !req.user.roles.includes(role)) {
        throw new Error(`Insufficient permissions. Required role: ${role}`);
      }
      
      return method.apply(this, args);
    };
  };
}

export class AdminAPI extends EventEmitter {
  constructor(
    private readonly config: AdminAPIConfig,
    private readonly dependencies: {
      imRouter: IMSRouter;
      decisionLogger: CompleteDecisionLogger;
      ttfbAuditor: TTFBAuditor;
      healthChecker: HysteresisHealthChecker;
      circuitBreaker: RunawayPreventionCircuitBreaker;
      advancedTTFBMonitor: AdvancedTTFBMonitor;
      goldenDatasetMonitor: GoldenDatasetMonitor;
    }
  ) {
    super();
  }

  /**
   * Get detailed information about a routing decision
   * Requires: ims.viewer role
   */
  @RequireRole('ims.viewer')
  async getDecisionDetails(req: any): Promise<DecisionDetailsResponse> {
    const { traceId } = req.params;
    const decision = await this.dependencies.decisionLogger.getDecisionLog(traceId);
    
    if (!decision) {
      throw new Error(`Decision not found for traceId: ${traceId}`);
    }

    const explanation = this.generateHumanReadableExplanation(decision);
    
    // Optional reproduction test
    let reproductionTest;
    if (req.query.testReproduction === 'true') {
      try {
        reproductionTest = await this.dependencies.decisionLogger.testReproduction(
          traceId,
          this.dependencies.imRouter
        );
      } catch (error) {
        reproductionTest = {
          canReproduce: false,
          error: error.message
        };
      }
    }

    // Audit log access
    this.logAdminAction(req.user, 'VIEW_DECISION_DETAILS', { traceId });

    return {
      decision,
      selectedModel: {
        id: decision.selected.modelId,
        providerId: decision.selected.providerId || 'unknown',
        confidence: decision.selected.confidence || 0
      },
      explanation,
      reproductionTest
    };
  }

  /**
   * Get TTFB breakdown analysis
   * Requires: ims.operator role
   */
  @RequireRole('ims.operator')
  async getTTFBBreakdown(req: any): Promise<TTFBBreakdownResponse> {
    const { timeRange } = req.query;
    const timeRangeMs = this.parseTimeRange(timeRange);
    
    const breakdown = this.dependencies.ttfbAuditor.getAnalytics(timeRangeMs);
    const budgetCompliance = this.calculateBudgetCompliance(breakdown);
    const recommendations = this.generateOptimizationRecommendations(breakdown);

    this.logAdminAction(req.user, 'VIEW_TTFB_BREAKDOWN', { timeRange });

    return {
      timeRange: {
        start: new Date(Date.now() - timeRangeMs),
        end: new Date()
      },
      breakdown,
      budgetCompliance,
      recommendations
    };
  }

  /**
   * Activate kill switch (emergency stop)
   * Requires: ims.admin role
   */
  @RequireRole('ims.admin')
  async activateKillSwitch(req: any): Promise<KillSwitchResponse> {
    const killSwitchConfig: KillSwitchRequest = req.body;
    
    // Validate request
    if (!killSwitchConfig.reason || killSwitchConfig.reason.length < 10) {
      throw new Error('Kill switch activation requires a detailed reason (min 10 characters)');
    }

    await this.dependencies.imRouter.activateKillSwitch({
      mode: killSwitchConfig.mode,
      durationMs: killSwitchConfig.durationMs,
      reason: killSwitchConfig.reason,
      activatedBy: req.user.userId
    });

    // Critical audit log
    this.logAdminAction(req.user, 'KILL_SWITCH_ACTIVATED', killSwitchConfig, 'CRITICAL');

    return {
      status: 'activated',
      mode: killSwitchConfig.mode,
      expiresAt: new Date(Date.now() + killSwitchConfig.durationMs),
      reason: killSwitchConfig.reason,
      activatedBy: req.user.userId
    };
  }

  /**
   * Deactivate kill switch
   * Requires: ims.admin role
   */
  @RequireRole('ims.admin')
  async deactivateKillSwitch(req: any): Promise<KillSwitchResponse> {
    this.dependencies.imRouter.deactivateKillSwitch();
    
    this.logAdminAction(req.user, 'KILL_SWITCH_DEACTIVATED', {}, 'CRITICAL');

    return {
      status: 'deactivated',
      activatedBy: req.user.userId
    };
  }

  /**
   * Run reproduction test for a specific decision
   * Requires: ims.viewer role
   */
  @RequireRole('ims.viewer')
  async reproduceDecision(req: any): Promise<ReproductionTestResponse> {
    const { traceId } = req.params;
    const options: ReproductionTestRequest = req.body || {};
    
    const originalLog = await this.dependencies.decisionLogger.getDecisionLog(traceId);
    if (!originalLog) {
      throw new Error(`Decision log not found for traceId: ${traceId}`);
    }

    // Run reproduction
    const reproduced = await this.dependencies.imRouter.reproduceDecision({
      task: {
        traceId: originalLog.traceId,
        idempotencyKey: originalLog.idempotencyKey,
        task: originalLog.task,
        cleanContent: { text: 'reproduction_test' },
        piiRedactionReport: [],
        hints: {
          priority: 'balanced',
          latencyBudgetMs: originalLog.task.latencyBudgetMs,
          costTier: originalLog.task.costTier
        },
        session: {
          userId: 'reproduction_test',
          plan: 'pro',
          currentUsage: { inputTokens: 0, outputTokens: 0, monthStart: new Date() },
          requestedAt: new Date()
        }
      },
      policySnapshot: originalLog.policySnapshot,
      poolSnapshot: originalLog.poolSnapshot,
      healthSnapshot: originalLog.healthSnapshot
    });

    // Compare results
    const exactMatch = this.compareDecisions(originalLog, reproduced);
    const differences = this.calculateReproductionDifferences(originalLog, reproduced);
    const reproductionScore = this.calculateReproductionScore(differences);

    this.logAdminAction(req.user, 'REPRODUCTION_TEST', { traceId, exactMatch });

    return {
      originalDecision: {
        modelId: originalLog.selected.modelId,
        generationParams: originalLog.selected.generationParams,
        reasons: originalLog.selected.reasons
      },
      reproducedDecision: {
        modelId: reproduced.trace.traceId, // This would need to be extracted properly
        generationParams: reproduced.generationParams,
        reasons: []
      },
      exactMatch,
      differences,
      reproductionScore
    };
  }

  /**
   * Get TTFB heatmap data with real-time visualization
   * Requires: ims.operator role
   */
  @RequireRole('ims.operator')
  async getTTFBHeatmap(req: any): Promise<TTFBHeatmapResponse> {
    const { timeRange = '1h' } = req.query;
    const timeRangeMs = this.parseTimeRange(timeRange);
    
    const heatmapData = this.dependencies.advancedTTFBMonitor.getHeatmapData(timeRangeMs);
    const trendAnalysis = this.dependencies.advancedTTFBMonitor.getTrendAnalysis();
    
    // Transform heatmap data for visualization
    const visualization = this.transformHeatmapForVisualization(heatmapData);

    this.logAdminAction(req.user, 'VIEW_TTFB_HEATMAP', { timeRange });

    return {
      heatmapData,
      visualization,
      trendAnalysis
    };
  }

  /**
   * Get golden dataset test cases
   * Requires: ims.viewer role
   */
  @RequireRole('ims.viewer')
  async getGoldenDataset(req: any): Promise<GoldenDatasetResponse> {
    const { category, active } = req.query;
    
    const testCases = this.dependencies.goldenDatasetMonitor.getTestCases(category);
    const filteredCases = active === 'true' ? 
      testCases.filter(tc => tc.isActive) : 
      testCases;

    const categories = [...new Set(testCases.map(tc => tc.category))];

    this.logAdminAction(req.user, 'VIEW_GOLDEN_DATASET', { category, active });

    return {
      testCases: filteredCases,
      totalCount: testCases.length,
      activeCount: testCases.filter(tc => tc.isActive).length,
      categories
    };
  }

  /**
   * Run golden dataset reproduction tests
   * Requires: ims.operator role
   */
  @RequireRole('ims.operator')
  async runGoldenDatasetTests(req: any): Promise<DailyReproductionReport> {
    const { category, testCaseIds } = req.body;
    
    let report: DailyReproductionReport;
    
    if (testCaseIds && Array.isArray(testCaseIds)) {
      // Run specific test cases
      report = await this.dependencies.goldenDatasetMonitor.runSpecificTests(testCaseIds);
    } else if (category) {
      // Run tests for specific category
      report = await this.dependencies.goldenDatasetMonitor.runCategoryTests(category);
    } else {
      // Run full daily test suite
      report = await this.dependencies.goldenDatasetMonitor.runDailyReproductionTests();
    }

    this.logAdminAction(req.user, 'RUN_GOLDEN_DATASET_TESTS', { 
      category, 
      testCaseIds: testCaseIds?.length || 'all',
      passRate: report.summary.passRate
    });

    return report;
  }

  /**
   * Get daily reproduction report
   * Requires: ims.viewer role
   */
  @RequireRole('ims.viewer')
  async getDailyReproductionReport(req: any): Promise<DailyReproductionSummary> {
    const { date } = req.params;
    const report = this.dependencies.goldenDatasetMonitor.getDailyReport(date);
    
    if (!report) {
      throw new Error(`No reproduction report found for date: ${date}`);
    }

    // Calculate trends by comparing with previous day
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousReport = this.dependencies.goldenDatasetMonitor.getDailyReport(
      previousDate.toISOString().split('T')[0]
    );

    const trends = this.calculateReproductionTrends(report, previousReport);

    this.logAdminAction(req.user, 'VIEW_REPRODUCTION_REPORT', { date });

    return {
      date,
      totalTests: report.summary.totalTests,
      passedTests: report.summary.passedTests,
      failedTests: report.summary.failedTests,
      averageScore: report.summary.averageScore,
      failedTestCases: report.failedTests.map(ft => ft.testCaseId),
      trends
    };
  }

  /**
   * Get reproduction trend analysis
   * Requires: ims.viewer role
   */
  @RequireRole('ims.viewer')
  async getReproductionTrends(req: any) {
    const { days = 30, testCaseId } = req.query;
    
    let trendData;
    if (testCaseId) {
      // Get trends for specific test case
      trendData = this.dependencies.goldenDatasetMonitor.getTestCaseHistory(testCaseId, parseInt(days));
    } else {
      // Get overall trends
      trendData = this.dependencies.goldenDatasetMonitor.getReproductionTrends(parseInt(days));
    }

    this.logAdminAction(req.user, 'VIEW_REPRODUCTION_TRENDS', { days, testCaseId });

    return {
      timeRange: { days: parseInt(days) },
      testCaseId: testCaseId || 'all',
      trends: trendData,
      summary: {
        averageScore: trendData.reduce((acc, t) => acc + t.reproductionScore, 0) / trendData.length,
        passRate: trendData.filter(t => t.reproductionScore >= 0.95).length / trendData.length,
        improving: this.isScoreTrendImproving(trendData),
        recommendations: this.generateTrendRecommendations(trendData)
      }
    };
  }

  /**
   * Get system health status
   * Requires: ims.viewer role
   */
  @RequireRole('ims.viewer')
  async getSystemHealth(req: any) {
    const healthStatus = await this.dependencies.imRouter.getHealthStatus();
    const circuitBreakerStats = this.dependencies.circuitBreaker.getCircuitBreakerSummary();
    const ttfbSummary = this.dependencies.ttfbAuditor.getRealTimeSummary();

    this.logAdminAction(req.user, 'VIEW_SYSTEM_HEALTH');

    return {
      overall: healthStatus.status,
      components: healthStatus.components,
      metrics: healthStatus.metrics,
      circuitBreaker: {
        openCircuits: circuitBreakerStats.openCircuits,
        totalCircuits: circuitBreakerStats.totalCircuits,
        globalCircuitOpen: circuitBreakerStats.globalCircuitOpen
      },
      performance: {
        recentAverage: ttfbSummary.recentAverage,
        budgetCompliance: ttfbSummary.budgetComplianceRate,
        status: ttfbSummary.status
      }
    };
  }

  /**
   * Private utility methods
   */

  private generateHumanReadableExplanation(decision: CompleteRoutingLog): DecisionDetailsResponse['explanation'] {
    return {
      whySelected: [
        `Selected ${decision.selected.modelId} with ${(decision.selected.confidence * 100).toFixed(1)}% confidence`,
        ...decision.selected.reasons
      ],
      whyOthersRejected: [
        'Other candidates had lower selection scores',
        'Some candidates failed health checks'
      ],
      riskFactors: [
        ...(decision.fallbackChain.length > 0 ? ['Had to use fallback models'] : []),
        ...(decision.ttfbBreakdown.budgetCompliance.total ? [] : ['Exceeded TTFB budget'])
      ],
      optimizationSuggestions: this.generateOptimizationSuggestions(decision)
    };
  }

  private generateOptimizationSuggestions(decision: CompleteRoutingLog): string[] {
    const suggestions: string[] = [];
    
    if (decision.ttfbBreakdown.authMs > 40) {
      suggestions.push('Consider optimizing authentication flow');
    }
    
    if (decision.ttfbBreakdown.cacheMs > 20) {
      suggestions.push('Review cache configuration');
    }
    
    if (decision.fallbackChain.length > 0) {
      suggestions.push('Investigate primary model failures');
    }

    return suggestions;
  }

  private parseTimeRange(timeRange?: string): number {
    if (!timeRange) return 3600000; // Default 1 hour
    
    const match = timeRange.match(/^(\d+)([mhd])$/);
    if (!match) return 3600000;
    
    const [, value, unit] = match;
    const multiplier = { m: 60000, h: 3600000, d: 86400000 }[unit] || 3600000;
    
    return parseInt(value) * multiplier;
  }

  private calculateBudgetCompliance(breakdown: TTFBAnalytics): TTFBBreakdownResponse['budgetCompliance'] {
    return {
      overall: breakdown.budgetCompliance.overallRate,
      byComponent: breakdown.budgetCompliance.byComponent,
      trends: {
        improving: breakdown.trends.improving,
        degrading: breakdown.trends.degrading,
        recommendations: breakdown.recommendations.actions
      }
    };
  }

  private generateOptimizationRecommendations(breakdown: TTFBAnalytics): TTFBBreakdownResponse['recommendations'] {
    return {
      urgency: breakdown.recommendations.urgency,
      actions: breakdown.recommendations.actions,
      bottlenecks: breakdown.recommendations.bottlenecks
    };
  }

  private compareDecisions(original: CompleteRoutingLog, reproduced: any): boolean {
    // This is a simplified comparison - would need proper implementation
    return original.selected.modelId === reproduced.trace?.traceId; // Placeholder
  }

  private calculateReproductionDifferences(original: CompleteRoutingLog, reproduced: any): ReproductionTestResponse['differences'] {
    return {
      modelChanged: false, // Placeholder
      parametersDifferent: false,
      reasonsDifferent: false,
      details: {}
    };
  }

  private calculateReproductionScore(differences: ReproductionTestResponse['differences']): number {
    let score = 1.0;
    
    if (differences.modelChanged) score -= 0.4;
    if (differences.parametersDifferent) score -= 0.3;
    if (differences.reasonsDifferent) score -= 0.3;
    
    return Math.max(0, score);
  }

  private transformHeatmapForVisualization(heatmapData: TTFBHeatmapData): TTFBHeatmapResponse['visualization'] {
    const timeSlots = heatmapData.timeSlots.map(ts => new Date(ts.startTime).toISOString());
    const components = Object.keys(heatmapData.timeSlots[0]?.componentBreakdown || {});
    const values = heatmapData.timeSlots.map(ts => 
      components.map(component => ts.componentBreakdown[component] || 0)
    );

    const alerts = heatmapData.alerts.map(alert => ({
      component: alert.component,
      severity: alert.severity as 'warning' | 'critical',
      message: alert.message
    }));

    return {
      timeSlots,
      components,
      values,
      alerts
    };
  }

  private calculateReproductionTrends(
    current: DailyReproductionReport, 
    previous: DailyReproductionReport | null
  ): DailyReproductionSummary['trends'] {
    if (!previous) {
      return {
        scoreChange: 0,
        passRateChange: 0,
        recommendations: ['Baseline established - monitor trends over time']
      };
    }

    const scoreChange = current.summary.averageScore - previous.summary.averageScore;
    const passRateChange = current.summary.passRate - previous.summary.passRate;

    const recommendations: string[] = [];
    if (scoreChange < -0.05) {
      recommendations.push('Reproduction scores declining - investigate model changes');
    }
    if (passRateChange < -0.1) {
      recommendations.push('Pass rate dropped significantly - review failed test cases');
    }
    if (current.summary.passRate < 0.8) {
      recommendations.push('Pass rate below target - consider golden dataset updates');
    }

    return {
      scoreChange,
      passRateChange,
      recommendations: recommendations.length > 0 ? recommendations : ['Trends stable - continue monitoring']
    };
  }

  private isScoreTrendImproving(trendData: any[]): boolean {
    if (trendData.length < 2) return false;
    
    const recentScores = trendData.slice(-7).map(t => t.reproductionScore);
    const earlierScores = trendData.slice(-14, -7).map(t => t.reproductionScore);
    
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const earlierAvg = earlierScores.reduce((a, b) => a + b, 0) / earlierScores.length;
    
    return recentAvg > earlierAvg + 0.01; // Consider improving if 1% better
  }

  private generateTrendRecommendations(trendData: any[]): string[] {
    const recommendations: string[] = [];
    
    if (trendData.length === 0) return ['No data available'];
    
    const latestScore = trendData[trendData.length - 1]?.reproductionScore || 0;
    const averageScore = trendData.reduce((acc, t) => acc + t.reproductionScore, 0) / trendData.length;
    
    if (latestScore < 0.8) {
      recommendations.push('Recent reproduction quality low - investigate model behavior');
    }
    
    if (averageScore < 0.9) {
      recommendations.push('Overall reproduction quality below target - review golden dataset');
    }
    
    const failureRate = trendData.filter(t => t.reproductionScore < 0.95).length / trendData.length;
    if (failureRate > 0.2) {
      recommendations.push('High failure rate detected - consider updating test expectations');
    }
    
    return recommendations.length > 0 ? recommendations : ['Reproduction trends healthy'];
  }

  private logAdminAction(
    user: AdminUser, 
    action: string, 
    details: any = {}, 
    severity: 'INFO' | 'WARN' | 'CRITICAL' = 'INFO'
  ): void {
    if (!this.config.enableAuditLogging) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: user.userId,
      email: user.email,
      action,
      details,
      severity,
      ip: 'unknown', // Would be extracted from request
      userAgent: 'unknown'
    };

    this.emit('adminAction', logEntry);
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.emit('cleanup');
  }
}