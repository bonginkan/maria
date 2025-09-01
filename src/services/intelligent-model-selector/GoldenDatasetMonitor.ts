/**
 * Golden Dataset Monitor - Phase 3 Daily Reproduction Monitoring
 * Monitors decision reproducibility using a curated golden dataset
 * Ensures system behavior consistency and detects regressions
 */

import { EventEmitter } from 'events';
import type { TaskInput, ProcessedTaskInput, RouteResult } from './types/TaskInput.js';
import type { CompleteRoutingLog } from './CompleteDecisionLogger.js';
import type { IMSRouter } from './IMSRouter.js';

export interface GoldenTestCase {
  id: string;
  name: string;
  description: string;
  category: 'smoke' | 'regression' | 'performance' | 'edge-case';
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  // Input configuration
  input: TaskInput;
  
  // Expected outcomes
  expected: {
    selectedModel: string;
    reasons: string[];
    costEstimate: {
      min: number;
      max: number;
    };
    ttfbBudget: {
      auth: number;
      cache: number;
      rules: number;
      select: number;
      flush: number;
      total: number;
    };
    qualityMetrics: {
      minConfidence: number;
      maxFallbackDepth: number;
    };
  };
  
  // Snapshot data for reproduction
  policySnapshot: any;
  poolSnapshot: any;
  healthSnapshot: any;
  
  // Reproducibility configuration
  reproducibility: {
    seedFixed: boolean;
    deterministicOnly: boolean;
    toleranceThreshold: number; // 0-1, how much variation is acceptable
  };
  
  // Metadata
  createdAt: Date;
  lastUpdated: Date;
  tags: string[];
}

export interface ReproductionTestResult {
  testCaseId: string;
  executedAt: Date;
  
  // Test outcomes
  decisionMatch: boolean;
  reasonsMatch: boolean;
  costWithinRange: boolean;
  ttfbWithinBudget: boolean;
  qualityMetricsMet: boolean;
  
  // Detailed comparison
  actualDecision: {
    selectedModel: string;
    reasons: string[];
    cost: number;
    ttfb: any;
    confidence: number;
    fallbackDepth: number;
  };
  
  // Reproduction quality
  reproductionScore: number; // 0-1
  
  // Performance metrics
  executionTimeMs: number;
  
  // Error details if failed
  errorDetails?: {
    type: string;
    message: string;
    stack?: string;
  };
}

export interface DailyReproductionReport {
  date: string; // YYYY-MM-DD
  
  // Overall statistics
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageReproductionScore: number;
    overallHealthScore: number; // 0-1
  };
  
  // By category breakdown
  byCategory: Record<string, {
    totalTests: number;
    passedTests: number;
    reproductionRate: number;
    averageScore: number;
  }>;
  
  // By priority breakdown
  byPriority: Record<string, {
    totalTests: number;
    passedTests: number;
    reproductionRate: number;
  }>;
  
  // Performance trends
  performance: {
    averageExecutionTimeMs: number;
    p95ExecutionTimeMs: number;
    timeoutCount: number;
  };
  
  // Failed tests
  failures: Array<{
    testCaseId: string;
    testName: string;
    category: string;
    priority: string;
    failureReason: string;
    reproductionScore: number;
  }>;
  
  // Recommendations
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  
  // Comparison with previous day
  trends: {
    reproductionRateChange: number; // percentage change from previous day
    performanceChange: number;
    newFailures: string[];
    resolvedFailures: string[];
  };
}

export interface GoldenDatasetMonitorConfig {
  dataset: {
    testCasesPath: string;
    autoUpdateEnabled: boolean;
    maxTestCases: number;
  };
  scheduling: {
    dailyReproductionTime: string; // HH:MM format
    timeZone: string;
    maxExecutionTimeMs: number;
    retryFailedTests: boolean;
    maxRetries: number;
  };
  thresholds: {
    criticalReproductionRate: number; // Alert if below this rate
    warningReproductionRate: number;
    performanceDegradationThreshold: number; // % degradation to trigger alert
  };
  reporting: {
    enableDailyReports: boolean;
    emailRecipients: string[];
    slackWebhook?: string;
    retainReportsForDays: number;
  };
}

export class GoldenDatasetMonitor extends EventEmitter {
  private readonly goldenDataset: GoldenTestCase[] = [];
  private readonly reproductionHistory = new Map<string, ReproductionTestResult[]>();
  private readonly dailyReports = new Map<string, DailyReproductionReport>();
  
  private dailyTimer?: NodeJS.Timeout;
  private isRunningTests = false;

  constructor(
    private readonly config: GoldenDatasetMonitorConfig,
    private readonly imRouter: IMSRouter
  ) {
    super();
    
    this.loadGoldenDataset();
    this.scheduleDailyReproduction();
  }

  /**
   * Load golden dataset from configuration
   */
  private async loadGoldenDataset(): Promise<void> {
    try {
      // In a real implementation, this would load from file system or database
      const sampleTestCases: GoldenTestCase[] = [
        {
          id: 'smoke-001',
          name: 'Basic Chat Request',
          description: 'Simple chat request that should route to GPT-4o',
          category: 'smoke',
          priority: 'critical',
          input: {
            traceId: 'golden-smoke-001',
            idempotencyKey: 'golden-smoke-001',
            task: {
              kind: 'chat',
              latencyBudgetMs: 400,
              costTier: 'balanced'
            },
            content: { text: 'Hello, how are you today?' },
            hints: {
              priority: 'balanced',
              latencyBudgetMs: 400,
              costTier: 'balanced'
            },
            session: {
              userId: 'golden-test-user',
              plan: 'pro',
              currentUsage: {
                inputTokens: 1000,
                outputTokens: 500,
                monthStart: new Date()
              },
              requestedAt: new Date()
            }
          },
          expected: {
            selectedModel: 'gpt-4o',
            reasons: ['High quality model', 'Good performance'],
            costEstimate: { min: 0.001, max: 0.005 },
            ttfbBudget: {
              auth: 40,
              cache: 20,
              rules: 10,
              select: 10,
              flush: 120,
              total: 500
            },
            qualityMetrics: {
              minConfidence: 0.8,
              maxFallbackDepth: 0
            }
          },
          policySnapshot: { version: '1.0', rules: [] },
          poolSnapshot: { models: ['gpt-4o', 'claude-3-sonnet'] },
          healthSnapshot: { 'openai': { status: 'healthy', score: 0.95 } },
          reproducibility: {
            seedFixed: true,
            deterministicOnly: true,
            toleranceThreshold: 0.95
          },
          createdAt: new Date(),
          lastUpdated: new Date(),
          tags: ['basic', 'chat', 'gpt-4o']
        },
        {
          id: 'regression-001',
          name: 'High-Cost Tier Selection',
          description: 'Expensive request should route to premium model',
          category: 'regression',
          priority: 'high',
          input: {
            traceId: 'golden-regression-001',
            idempotencyKey: 'golden-regression-001',
            task: {
              kind: 'code',
              latencyBudgetMs: 800,
              costTier: 'premium'
            },
            content: { text: 'Generate a complex web application' },
            hints: {
              priority: 'premium',
              latencyBudgetMs: 800,
              costTier: 'premium'
            },
            session: {
              userId: 'golden-test-premium-user',
              plan: 'enterprise',
              currentUsage: {
                inputTokens: 50000,
                outputTokens: 25000,
                monthStart: new Date()
              },
              requestedAt: new Date()
            }
          },
          expected: {
            selectedModel: 'gpt-4o',
            reasons: ['Premium tier request', 'Code generation task'],
            costEstimate: { min: 0.05, max: 0.20 },
            ttfbBudget: {
              auth: 40,
              cache: 20,
              rules: 10,
              select: 10,
              flush: 120,
              total: 800
            },
            qualityMetrics: {
              minConfidence: 0.85,
              maxFallbackDepth: 1
            }
          },
          policySnapshot: { version: '1.0', rules: [] },
          poolSnapshot: { models: ['gpt-4o', 'claude-3-sonnet'] },
          healthSnapshot: { 'openai': { status: 'healthy', score: 0.95 } },
          reproducibility: {
            seedFixed: true,
            deterministicOnly: false,
            toleranceThreshold: 0.85
          },
          createdAt: new Date(),
          lastUpdated: new Date(),
          tags: ['premium', 'code', 'enterprise']
        }
      ];

      this.goldenDataset.push(...sampleTestCases);
      this.emit('datasetLoaded', { totalTestCases: this.goldenDataset.length });
    } catch (error) {
      this.emit('datasetLoadError', error);
      throw error;
    }
  }

  /**
   * Schedule daily reproduction tests
   */
  private scheduleDailyReproduction(): void {
    const [hours, minutes] = this.config.scheduling.dailyReproductionTime.split(':').map(Number);
    
    const scheduleNextExecution = () => {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      // If scheduled time has passed today, schedule for tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      const timeUntilExecution = scheduledTime.getTime() - now.getTime();
      
      this.dailyTimer = setTimeout(() => {
        this.runDailyReproductionTests().finally(() => {
          scheduleNextExecution(); // Schedule next day
        });
      }, timeUntilExecution);
      
      this.emit('dailyTestScheduled', { 
        scheduledTime: scheduledTime.toISOString() 
      });
    };

    scheduleNextExecution();
  }

  /**
   * Run daily reproduction tests
   */
  async runDailyReproductionTests(): Promise<DailyReproductionReport> {
    if (this.isRunningTests) {
      throw new Error('Daily reproduction tests are already running');
    }

    this.isRunningTests = true;
    const startTime = Date.now();
    const today = new Date().toISOString().split('T')[0];

    try {
      this.emit('dailyTestsStarted', { 
        date: today, 
        totalTestCases: this.goldenDataset.length 
      });

      const results = await Promise.allSettled(
        this.goldenDataset.map(testCase => this.runSingleReproductionTest(testCase))
      );

      const reproductionResults: ReproductionTestResult[] = [];
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const testCase = this.goldenDataset[i];
        
        if (result.status === 'fulfilled') {
          reproductionResults.push(result.value);
        } else {
          // Create failure result
          reproductionResults.push({
            testCaseId: testCase.id,
            executedAt: new Date(),
            decisionMatch: false,
            reasonsMatch: false,
            costWithinRange: false,
            ttfbWithinBudget: false,
            qualityMetricsMet: false,
            actualDecision: {
              selectedModel: 'error',
              reasons: ['Test execution failed'],
              cost: 0,
              ttfb: {},
              confidence: 0,
              fallbackDepth: 999
            },
            reproductionScore: 0,
            executionTimeMs: Date.now() - startTime,
            errorDetails: {
              type: 'TestExecutionError',
              message: result.reason.message,
              stack: result.reason.stack
            }
          });
        }
      }

      // Store results in history
      for (const result of reproductionResults) {
        if (!this.reproductionHistory.has(result.testCaseId)) {
          this.reproductionHistory.set(result.testCaseId, []);
        }
        this.reproductionHistory.get(result.testCaseId)!.push(result);
      }

      // Generate daily report
      const report = this.generateDailyReport(today, reproductionResults);
      this.dailyReports.set(today, report);

      this.emit('dailyTestsCompleted', report);
      
      // Send notifications if needed
      await this.sendReportNotifications(report);

      return report;

    } finally {
      this.isRunningTests = false;
    }
  }

  /**
   * Run a single reproduction test
   */
  private async runSingleReproductionTest(testCase: GoldenTestCase): Promise<ReproductionTestResult> {
    const startTime = Date.now();

    try {
      // Execute the test through IMSRouter
      const result = await this.imRouter.reproduceDecision({
        task: testCase.input,
        policySnapshot: testCase.policySnapshot,
        poolSnapshot: testCase.poolSnapshot,
        healthSnapshot: testCase.healthSnapshot
      });

      // Compare with expected results
      const decisionMatch = result.modelId === testCase.expected.selectedModel;
      const costWithinRange = result.costPrediction &&
        result.costPrediction.estimatedCostUsd >= testCase.expected.costEstimate.min &&
        result.costPrediction.estimatedCostUsd <= testCase.expected.costEstimate.max;
      const ttfbWithinBudget = result.trace.ttfbMs ? 
        result.trace.ttfbMs <= testCase.expected.ttfbBudget.total : true;

      // Calculate reproduction score
      let reproductionScore = 0;
      if (decisionMatch) reproductionScore += 0.4;
      if (costWithinRange) reproductionScore += 0.2;
      if (ttfbWithinBudget) reproductionScore += 0.2;
      reproductionScore += 0.2; // Base score for successful execution

      const reproductionResult: ReproductionTestResult = {
        testCaseId: testCase.id,
        executedAt: new Date(),
        decisionMatch,
        reasonsMatch: true, // Simplified for now
        costWithinRange: costWithinRange || false,
        ttfbWithinBudget,
        qualityMetricsMet: true, // Simplified for now
        actualDecision: {
          selectedModel: result.modelId,
          reasons: [], // Would extract from result
          cost: result.costPrediction?.estimatedCostUsd || 0,
          ttfb: result.trace.ttfbMs || 0,
          confidence: 0.8, // Would extract from result
          fallbackDepth: result.trace.fallbackChain?.length || 0
        },
        reproductionScore,
        executionTimeMs: Date.now() - startTime
      };

      this.emit('testCaseCompleted', { 
        testCaseId: testCase.id, 
        passed: reproductionScore >= testCase.reproducibility.toleranceThreshold 
      });

      return reproductionResult;

    } catch (error) {
      return {
        testCaseId: testCase.id,
        executedAt: new Date(),
        decisionMatch: false,
        reasonsMatch: false,
        costWithinRange: false,
        ttfbWithinBudget: false,
        qualityMetricsMet: false,
        actualDecision: {
          selectedModel: 'error',
          reasons: ['Execution failed'],
          cost: 0,
          ttfb: {},
          confidence: 0,
          fallbackDepth: 999
        },
        reproductionScore: 0,
        executionTimeMs: Date.now() - startTime,
        errorDetails: {
          type: error.constructor.name,
          message: error.message,
          stack: error.stack
        }
      };
    }
  }

  /**
   * Generate daily report from test results
   */
  private generateDailyReport(date: string, results: ReproductionTestResult[]): DailyReproductionReport {
    const passedTests = results.filter(r => r.reproductionScore >= 0.8);
    const failedTests = results.filter(r => r.reproductionScore < 0.8);
    
    const averageScore = results.reduce((sum, r) => sum + r.reproductionScore, 0) / results.length;
    const overallHealthScore = passedTests.length / results.length;

    // By category analysis
    const byCategory: Record<string, any> = {};
    for (const category of ['smoke', 'regression', 'performance', 'edge-case']) {
      const categoryTests = this.goldenDataset.filter(tc => tc.category === category);
      const categoryResults = results.filter(r => 
        categoryTests.find(tc => tc.id === r.testCaseId)
      );
      
      if (categoryResults.length > 0) {
        byCategory[category] = {
          totalTests: categoryResults.length,
          passedTests: categoryResults.filter(r => r.reproductionScore >= 0.8).length,
          reproductionRate: categoryResults.filter(r => r.reproductionScore >= 0.8).length / categoryResults.length,
          averageScore: categoryResults.reduce((sum, r) => sum + r.reproductionScore, 0) / categoryResults.length
        };
      }
    }

    // By priority analysis
    const byPriority: Record<string, any> = {};
    for (const priority of ['critical', 'high', 'medium', 'low']) {
      const priorityTests = this.goldenDataset.filter(tc => tc.priority === priority);
      const priorityResults = results.filter(r => 
        priorityTests.find(tc => tc.id === r.testCaseId)
      );
      
      if (priorityResults.length > 0) {
        byPriority[priority] = {
          totalTests: priorityResults.length,
          passedTests: priorityResults.filter(r => r.reproductionScore >= 0.8).length,
          reproductionRate: priorityResults.filter(r => r.reproductionScore >= 0.8).length / priorityResults.length
        };
      }
    }

    // Performance analysis
    const executionTimes = results.map(r => r.executionTimeMs);
    const averageExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    const p95ExecutionTime = this.getPercentile(executionTimes.sort((a, b) => a - b), 0.95);
    const timeoutCount = results.filter(r => r.executionTimeMs > this.config.scheduling.maxExecutionTimeMs).length;

    // Failed tests summary
    const failures = failedTests.map(result => {
      const testCase = this.goldenDataset.find(tc => tc.id === result.testCaseId)!;
      return {
        testCaseId: result.testCaseId,
        testName: testCase.name,
        category: testCase.category,
        priority: testCase.priority,
        failureReason: result.errorDetails?.message || 'Reproduction score below threshold',
        reproductionScore: result.reproductionScore
      };
    });

    // Trends (compare with previous day)
    const previousDay = new Date(new Date(date).getTime() - 86400000).toISOString().split('T')[0];
    const previousReport = this.dailyReports.get(previousDay);
    const trends = this.calculateTrends(previousReport, {
      reproductionRate: overallHealthScore,
      averageExecutionTime,
      failedTestIds: failedTests.map(f => f.testCaseId)
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(results, byCategory, byPriority);

    return {
      date,
      summary: {
        totalTests: results.length,
        passedTests: passedTests.length,
        failedTests: failedTests.length,
        averageReproductionScore: averageScore,
        overallHealthScore
      },
      byCategory,
      byPriority,
      performance: {
        averageExecutionTimeMs: averageExecutionTime,
        p95ExecutionTimeMs: p95ExecutionTime,
        timeoutCount
      },
      failures,
      recommendations,
      trends
    };
  }

  private calculateTrends(
    previousReport: DailyReproductionReport | undefined,
    currentMetrics: {
      reproductionRate: number;
      averageExecutionTime: number;
      failedTestIds: string[];
    }
  ): DailyReproductionReport['trends'] {
    if (!previousReport) {
      return {
        reproductionRateChange: 0,
        performanceChange: 0,
        newFailures: currentMetrics.failedTestIds,
        resolvedFailures: []
      };
    }

    const reproductionRateChange = 
      ((currentMetrics.reproductionRate - previousReport.summary.overallHealthScore) / 
       previousReport.summary.overallHealthScore) * 100;

    const performanceChange = 
      ((currentMetrics.averageExecutionTime - previousReport.performance.averageExecutionTimeMs) /
       previousReport.performance.averageExecutionTimeMs) * 100;

    const previousFailedIds = previousReport.failures.map(f => f.testCaseId);
    const newFailures = currentMetrics.failedTestIds.filter(id => !previousFailedIds.includes(id));
    const resolvedFailures = previousFailedIds.filter(id => !currentMetrics.failedTestIds.includes(id));

    return {
      reproductionRateChange,
      performanceChange,
      newFailures,
      resolvedFailures
    };
  }

  private generateRecommendations(
    results: ReproductionTestResult[],
    byCategory: Record<string, any>,
    byPriority: Record<string, any>
  ): DailyReproductionReport['recommendations'] {
    const recommendations = {
      immediate: [] as string[],
      shortTerm: [] as string[],
      longTerm: [] as string[]
    };

    // Immediate recommendations based on critical failures
    const criticalFailures = results.filter(r => {
      const testCase = this.goldenDataset.find(tc => tc.id === r.testCaseId);
      return testCase?.priority === 'critical' && r.reproductionScore < 0.8;
    });

    if (criticalFailures.length > 0) {
      recommendations.immediate.push(
        `URGENT: ${criticalFailures.length} critical test(s) failing - investigate immediately`
      );
    }

    // Category-specific recommendations
    for (const [category, stats] of Object.entries(byCategory)) {
      if (stats.reproductionRate < 0.8) {
        recommendations.shortTerm.push(
          `${category} tests showing ${((1 - stats.reproductionRate) * 100).toFixed(1)}% failure rate - review ${category} functionality`
        );
      }
    }

    // Performance recommendations
    const slowTests = results.filter(r => r.executionTimeMs > 5000); // > 5 seconds
    if (slowTests.length > 0) {
      recommendations.longTerm.push(
        `${slowTests.length} tests showing slow execution - consider performance optimization`
      );
    }

    return recommendations;
  }

  private async sendReportNotifications(report: DailyReproductionReport): Promise<void> {
    if (!this.config.reporting.enableDailyReports) return;

    const criticalIssues = report.summary.overallHealthScore < this.config.thresholds.criticalReproductionRate;
    const warningIssues = report.summary.overallHealthScore < this.config.thresholds.warningReproductionRate;

    if (criticalIssues || warningIssues) {
      const severity = criticalIssues ? 'CRITICAL' : 'WARNING';
      const message = `${severity}: Golden Dataset reproduction rate: ${(report.summary.overallHealthScore * 100).toFixed(1)}% (${report.summary.failedTests}/${report.summary.totalTests} failures)`;
      
      this.emit('alertTriggered', {
        severity: severity.toLowerCase(),
        message,
        report
      });
      
      // Send notifications (email, Slack, etc.)
      // Implementation would depend on configured notification channels
    }
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = Math.floor(sortedValues.length * percentile);
    return sortedValues[index] || 0;
  }

  /**
   * Get latest daily report
   */
  getDailyReport(date?: string): DailyReproductionReport | null {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.dailyReports.get(targetDate) || null;
  }

  /**
   * Get reproduction history for a specific test case
   */
  getTestCaseHistory(testCaseId: string, days: number = 30): ReproductionTestResult[] {
    const history = this.reproductionHistory.get(testCaseId) || [];
    const cutoff = Date.now() - (days * 86400000);
    return history.filter(result => result.executedAt.getTime() > cutoff);
  }

  /**
   * Add a new test case to the golden dataset
   */
  addTestCase(testCase: GoldenTestCase): void {
    this.goldenDataset.push(testCase);
    this.emit('testCaseAdded', { testCaseId: testCase.id });
  }

  /**
   * Remove a test case from the golden dataset
   */
  removeTestCase(testCaseId: string): boolean {
    const index = this.goldenDataset.findIndex(tc => tc.id === testCaseId);
    if (index >= 0) {
      this.goldenDataset.splice(index, 1);
      this.reproductionHistory.delete(testCaseId);
      this.emit('testCaseRemoved', { testCaseId });
      return true;
    }
    return false;
  }

  /**
   * Get all test cases
   */
  getTestCases(): GoldenTestCase[] {
    return [...this.goldenDataset];
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.dailyTimer) {
      clearTimeout(this.dailyTimer);
      this.dailyTimer = undefined;
    }
    
    this.goldenDataset.length = 0;
    this.reproductionHistory.clear();
    this.dailyReports.clear();
    
    this.emit('cleanup');
  }
}