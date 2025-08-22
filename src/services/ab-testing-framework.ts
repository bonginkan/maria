/**
 * A/B Testing Framework
 * Enables controlled experiments for UX optimization and feature testing
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  weight: number; // 0-1, determines traffic allocation
  enabled: boolean;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  variants: ABTestVariant[];
  metrics: string[]; // Metrics to track
  startDate: number;
  endDate?: number;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  targetAudience?: {
    userSegment?: string;
    percentage?: number;
    conditions?: Record<string, unknown>;
  };
}

export interface ABTestResult {
  testId: string;
  variantId: string;
  userId: string;
  sessionId: string;
  metrics: Record<string, number | boolean | string>;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface ABTestAnalytics {
  testId: string;
  variants: {
    [variantId: string]: {
      participants: number;
      conversions: number;
      conversionRate: number;
      averageValue: number;
      confidenceLevel: number;
      significance: boolean;
    };
  };
  winner?: string;
  confidence: number;
  totalParticipants: number;
  lastUpdated: number;
}

export interface ExperimentConfig {
  name: string;
  description: string;
  hypothesis: string;
  variants: Omit<ABTestVariant, 'id'>[];
  duration: number; // days
  targetMetrics: string[];
  successCriteria: {
    primaryMetric: string;
    minimumImprovement: number; // percentage
    confidenceLevel: number; // 0.9, 0.95, 0.99
  };
}

export class ABTestingFramework extends EventEmitter {
  private static instance: ABTestingFramework;
  private tests = new Map<string, ABTest>();
  private results: ABTestResult[] = [];
  private userAssignments = new Map<string, Map<string, string>>(); // userId -> testId -> variantId
  private analytics = new Map<string, ABTestAnalytics>();
  private dataPath: string;
  private maxResults = 10000; // Limit stored results for performance

  private constructor() {
    super();
    this.dataPath = join(homedir(), '.maria', 'ab-testing');
    this.ensureDataDirectory();
    this.loadTestingData();
    this.startAnalyticsEngine();
  }

  public static getInstance(): ABTestingFramework {
    if (!ABTestingFramework.instance) {
      ABTestingFramework.instance = new ABTestingFramework();
    }
    return ABTestingFramework.instance;
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    if (!existsSync(this.dataPath)) {
      mkdirSync(this.dataPath, { recursive: true });
    }
  }

  /**
   * Load testing data from storage
   */
  private loadTestingData(): void {
    try {
      const testsPath = join(this.dataPath, 'tests.json');
      const resultsPath = join(this.dataPath, 'results.json');
      const assignmentsPath = join(this.dataPath, 'assignments.json');

      if (existsSync(testsPath)) {
        const data = readFileSync(testsPath, 'utf-8');
        const testsArray = JSON.parse(data) as ABTest[];
        testsArray.forEach((test) => {
          this.tests.set(test.id, test);
        });
      }

      if (existsSync(resultsPath)) {
        const data = readFileSync(resultsPath, 'utf-8');
        this.results = JSON.parse(data);
      }

      if (existsSync(assignmentsPath)) {
        const data = readFileSync(assignmentsPath, 'utf-8');
        const assignmentsObj = JSON.parse(data);
        for (const [userId, assignments] of Object.entries(assignmentsObj)) {
          this.userAssignments.set(
            userId,
            new Map(Object.entries(assignments as Record<string, string>)),
          );
        }
      }

      logger.info(`Loaded ${this.tests.size} A/B tests and ${this.results.length} results`);
    } catch (error: unknown) {
      logger.warn('Failed to load A/B testing data:', error);
    }
  }

  /**
   * Save testing data to storage
   */
  private saveTestingData(): void {
    try {
      const testsPath = join(this.dataPath, 'tests.json');
      const resultsPath = join(this.dataPath, 'results.json');
      const assignmentsPath = join(this.dataPath, 'assignments.json');

      // Save tests
      const testsArray = Array.from(this.tests.values());
      writeFileSync(testsPath, JSON.stringify(testsArray, null, 2));

      // Save results (limit to recent results)
      const recentResults = this.results
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxResults);
      writeFileSync(resultsPath, JSON.stringify(recentResults, null, 2));

      // Save assignments
      const assignmentsObj: Record<string, Record<string, string>> = {};
      for (const [userId, assignments] of this.userAssignments.entries()) {
        assignmentsObj[userId] = Object.fromEntries(assignments);
      }
      writeFileSync(assignmentsPath, JSON.stringify(assignmentsObj, null, 2));

      logger.debug('A/B testing data saved');
    } catch (error: unknown) {
      logger.error('Failed to save A/B testing data:', error);
    }
  }

  /**
   * Create a new A/B test
   */
  createTest(config: ExperimentConfig): ABTest {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const variants: ABTestVariant[] = config.variants.map((variant, index) => ({
      ...variant,
      id: `${testId}_variant_${index}`,
      weight: variant.weight || 1 / config.variants.length,
      enabled: true,
    }));

    const test: ABTest = {
      id: testId,
      name: config.name,
      description: config.description,
      hypothesis: config.hypothesis,
      variants,
      metrics: config.targetMetrics,
      startDate: Date.now(),
      endDate: Date.now() + config.duration * 24 * 60 * 60 * 1000,
      status: 'draft',
    };

    this.tests.set(testId, test);
    this.saveTestingData();

    logger.info(`Created A/B test: ${config.name} (${testId})`);
    this.emit('testCreated', test);

    return test;
  }

  /**
   * Start running a test
   */
  startTest(testId: string): boolean {
    const test = this.tests.get(testId);
    if (!test) {
      logger.warn(`Test not found: ${testId}`);
      return false;
    }

    if (test.status !== 'draft' && test.status !== 'paused') {
      logger.warn(`Test ${testId} cannot be started from status: ${test.status}`);
      return false;
    }

    test.status = 'running';
    test.startDate = Date.now();

    this.tests.set(testId, test);
    this.saveTestingData();

    logger.info(`Started A/B test: ${test.name} (${testId})`);
    this.emit('testStarted', test);

    return true;
  }

  /**
   * Stop a running test
   */
  stopTest(testId: string, reason: 'completed' | 'cancelled' = 'completed'): boolean {
    const test = this.tests.get(testId);
    if (!test) {
      return false;
    }

    test.status = reason;
    test.endDate = Date.now();

    this.tests.set(testId, test);
    this.saveTestingData();

    // Generate final analytics
    this.generateAnalytics(testId);

    logger.info(`Stopped A/B test: ${test.name} (${testId}) - ${reason}`);
    this.emit('testStopped', { test, reason });

    return true;
  }

  /**
   * Get variant assignment for a user
   */
  getVariantForUser(testId: string, userId: string, sessionId: string): ABTestVariant | null {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') {
      return null;
    }

    // Check if user is already assigned to this test
    const userAssignments = this.userAssignments.get(userId);
    if (userAssignments?.has(testId)) {
      const variantId = userAssignments.get(testId)!;
      return test.variants.find((v) => v.id === variantId) || null;
    }

    // Check if test has ended
    if (test.endDate && Date.now() > test.endDate) {
      this.stopTest(testId, 'completed');
      return null;
    }

    // Assign user to variant based on weights
    const variant = this.assignUserToVariant(test, userId);
    if (!variant) {
      return null;
    }

    // Store assignment
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }
    this.userAssignments.get(userId)!.set(testId, variant.id);

    // Record participation
    this.recordResult({
      testId,
      variantId: variant.id,
      userId,
      sessionId,
      metrics: { participated: true },
      timestamp: Date.now(),
    });

    this.emit('userAssigned', { testId, userId, variant });
    return variant;
  }

  /**
   * Assign user to variant using weighted random selection
   */
  private assignUserToVariant(test: ABTest, userId: string): ABTestVariant | null {
    const enabledVariants = test.variants.filter((v) => v.enabled);
    if (enabledVariants.length === 0) {
      return null;
    }

    // Create deterministic but random assignment based on userId and testId
    const hash = this.hashString(`${userId}_${test.id}`);
    const random = (hash % 10000) / 10000; // 0-1

    // Select variant based on weights
    let cumulativeWeight = 0;
    for (const variant of enabledVariants) {
      cumulativeWeight += variant.weight;
      if (random < cumulativeWeight) {
        return variant;
      }
    }

    // Fallback to first variant
    return enabledVariants[0] || null;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Record experiment result/metric
   */
  recordResult(result: ABTestResult): void {
    // Validate test exists and is running
    const test = this.tests.get(result.testId);
    if (!test || test.status !== 'running') {
      return;
    }

    this.results.push(result);

    // Trigger analytics update for this test
    this.generateAnalytics(result.testId);

    this.emit('resultRecorded', result);

    // Periodic save
    if (this.results.length % 50 === 0) {
      this.saveTestingData();
    }
  }

  /**
   * Record conversion event
   */
  recordConversion(
    testId: string,
    userId: string,
    sessionId: string,
    conversionValue: number = 1,
    additionalMetrics?: Record<string, unknown>,
  ): void {
    const assignment = this.userAssignments.get(userId);
    if (!assignment || !assignment.has(testId)) {
      return; // User not in this test
    }

    const variantId = assignment.get(testId)!;

    this.recordResult({
      testId,
      variantId,
      userId,
      sessionId,
      metrics: {
        conversion: true,
        conversionValue,
        ...additionalMetrics,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Generate analytics for a test
   */
  generateAnalytics(testId: string): ABTestAnalytics | null {
    const test = this.tests.get(testId);
    if (!test) {
      return null;
    }

    const testResults = this.results.filter((r) => r.testId === testId);
    const analytics: ABTestAnalytics = {
      testId,
      variants: {},
      confidence: 0,
      totalParticipants: 0,
      lastUpdated: Date.now(),
    };

    // Calculate metrics for each variant
    test.variants.forEach((variant) => {
      const variantResults = testResults.filter((r) => r.variantId === variant.id);
      const participants = new Set(variantResults.map((r) => r.userId)).size;

      const conversions = variantResults.filter((r) => r.metrics['conversion'] === true).length;
      const conversionRate = participants > 0 ? conversions / participants : 0;

      const conversionValues = variantResults
        .filter((r) => r.metrics['conversion'] === true)
        .map((r) => Number(r.metrics['conversionValue']) || 1);
      const averageValue =
        conversionValues.length > 0
          ? conversionValues.reduce((a, b) => a + b, 0) / conversionValues.length
          : 0;

      analytics.variants[variant.id] = {
        participants,
        conversions,
        conversionRate,
        averageValue,
        confidenceLevel: 0, // Will be calculated below
        significance: false,
      };

      analytics.totalParticipants += participants;
    });

    // Calculate statistical significance (simplified)
    const variantIds = Object.keys(analytics.variants);
    if (variantIds.length === 2) {
      const [variantA, variantB] = variantIds;
      const a = variantA ? analytics.variants[variantA] : undefined;
      const b = variantB ? analytics.variants[variantB] : undefined;

      if (a && b && a.participants > 30 && b.participants > 30) {
        const { zScore: _zScore, pValue } = this.calculateZTest(
          a.conversions,
          a.participants,
          b.conversions,
          b.participants,
        );

        const confidenceLevel = 1 - pValue;
        a.confidenceLevel = confidenceLevel;
        b.confidenceLevel = confidenceLevel;
        a.significance = pValue < 0.05;
        b.significance = pValue < 0.05;

        analytics.confidence = confidenceLevel;

        // Determine winner
        if (a.significance) {
          analytics.winner = a.conversionRate > b.conversionRate ? variantA : variantB;
        }
      }
    }

    this.analytics.set(testId, analytics);
    this.emit('analyticsUpdated', analytics);

    return analytics;
  }

  /**
   * Calculate Z-test for two proportions
   */
  private calculateZTest(
    x1: number,
    n1: number,
    x2: number,
    n2: number,
  ): { zScore: number; pValue: number } {
    const p1 = x1 / n1;
    const p2 = x2 / n2;
    const pPooled = (x1 + x2) / (n1 + n2);

    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
    const zScore = Math.abs(p1 - p2) / se;

    // Approximate p-value using normal distribution
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    return { zScore, pValue };
  }

  /**
   * Approximate normal cumulative distribution function
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Get test analytics
   */
  getAnalytics(testId: string): ABTestAnalytics | null {
    return this.analytics.get(testId) || null;
  }

  /**
   * Get all active tests
   */
  getActiveTests(): ABTest[] {
    return Array.from(this.tests.values()).filter((test) => test.status === 'running');
  }

  /**
   * Get all tests
   */
  getAllTests(): ABTest[] {
    return Array.from(this.tests.values());
  }

  /**
   * Delete a test and its data
   */
  deleteTest(testId: string): boolean {
    const test = this.tests.get(testId);
    if (!test) {
      return false;
    }

    // Remove test
    this.tests.delete(testId);

    // Remove results
    this.results = this.results.filter((r) => r.testId !== testId);

    // Remove analytics
    this.analytics.delete(testId);

    // Remove user assignments
    for (const assignments of this.userAssignments.values()) {
      assignments.delete(testId);
    }

    this.saveTestingData();

    logger.info(`Deleted A/B test: ${test.name} (${testId})`);
    this.emit('testDeleted', testId);

    return true;
  }

  /**
   * Get user's test assignments
   */
  getUserAssignments(userId: string): Map<string, string> {
    return this.userAssignments.get(userId) || new Map();
  }

  /**
   * Start analytics engine
   */
  private startAnalyticsEngine(): void {
    // Update analytics every 5 minutes for running tests
    setInterval(
      () => {
        const activeTests = this.getActiveTests();
        activeTests.forEach((test) => {
          this.generateAnalytics(test.id);
        });

        // Auto-complete tests that have reached their end date
        activeTests.forEach((test) => {
          if (test.endDate && Date.now() > test.endDate) {
            this.stopTest(test.id, 'completed');
          }
        });

        // Save data periodically
        this.saveTestingData();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Export test data
   */
  exportTestData(testId: string) {
    const test = this.tests.get(testId);
    if (!test) {
      return null;
    }

    const testResults = this.results.filter((r) => r.testId === testId);
    const analytics = this.analytics.get(testId);

    return {
      test,
      results: testResults,
      analytics,
      exportedAt: Date.now(),
    };
  }

  /**
   * Get framework statistics
   */
  getStats() {
    const activeTests = this.getActiveTests().length;
    const completedTests = Array.from(this.tests.values()).filter(
      (t) => t.status === 'completed',
    ).length;
    const totalResults = this.results.length;
    const totalUsers = this.userAssignments.size;

    return {
      activeTests,
      completedTests,
      totalTests: this.tests.size,
      totalResults,
      totalUsers,
      averageResultsPerTest: this.tests.size > 0 ? totalResults / this.tests.size : 0,
    };
  }
}

export const abTestingFramework = ABTestingFramework.getInstance();
