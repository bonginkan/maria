/**
 * A/B Testing Framework
 * Enables controlled experiments for UX optimization and feature testing
 */

import { EventEmitter } from "node:events";
import { logger } from "../utils/logger.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

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
  status: "draft" | "running" | "paused" | "completed" | "cancelled";
  targetAudience?: {
    userSegment?: string;
    percentage?: number;
    conditions?: Record<string, unknown>;
  };
}

export interface ABTestResult {
  _testId: string;
  _variantId: string;
  userId: string;
  sessionId: string;
  metrics: Record<string, number | boolean | string>;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface ABTestAnalytics {
  _testId: string;
  variants: {
    [_variantId: string]: {
      _participants: number;
      _conversions: number;
      _conversionRate: number;
      _averageValue: number;
      _confidenceLevel: number;
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
  variants: Omit<ABTestVariant, "id">[];
  duration: number; // days
  targetMetrics: string[];
  successCriteria: {
    primaryMetric: string;
    minimumImprovement: number; // percentage
    _confidenceLevel: number; // 0.9, 0.95, 0.99
  };
}

export class ABTestingFramework extends EventEmitter {
  private static instance: ABTestingFramework;
  private tests = new Map<string, ABTest>();
  private results: ABTestResult[] = [];
  private _userAssignments = new Map<string, Map<string, string>>(); // userId -> _testId -> _variantId
  private _analytics = new Map<string, ABTestAnalytics>();
  private dataPath: string;
  private maxResults = 10000; // Limit stored results for performance

  private constructor() {
    super();
    this.dataPath = join(homedir(), ".maria", "ab-testing");
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
   * Ensure _data directory exists
   */
  private ensureDataDirectory(): void {
    if (!existsSync(this.dataPath)) {
      mkdirSync(this.dataPath, { recursive: true });
    }
  }

  /**
   * Load testing _data from storage
   */
  private loadTestingData(): void {
    try {
      const _testsPath = join(this.dataPath, "tests.json");
      const _resultsPath = join(this.dataPath, "results.json");
      const _assignmentsPath = join(this.dataPath, "assignments.json");

      if (existsSync(_testsPath)) {
        const _data = readFileSync(_testsPath, "utf-8");
        const _testsArray = JSON.parse(_data) as ABTest[];
        testsArray.forEach((_test) => {
          this.tests.set(test.id, _test);
        });
      }

      if (existsSync(_resultsPath)) {
        const _data = readFileSync(_resultsPath, "utf-8");
        this.results = JSON.parse(_data);
      }

      if (existsSync(_assignmentsPath)) {
        const _data = readFileSync(_assignmentsPath, "utf-8");
        const _assignmentsObj = JSON.parse(_data);
        for (const [userId, assignments] of Object.entries(_assignmentsObj)) {
          this.userAssignments.set(
            userId,
            new Map(Object.entries(assignments as Record<string, string>)),
          );
        }
      }

      logger.info(
        `Loaded ${this.tests.size} A/B tests and ${this.results.length} results`,
      );
    } catch (_error: unknown) {
      logger.warn("Failed to load A/B testing _data:", _error);
    }
  }

  /**
   * Save testing _data to storage
   */
  private saveTestingData(): void {
    try {
      const _testsPath = join(this.dataPath, "tests.json");
      const _resultsPath = join(this.dataPath, "results.json");
      const _assignmentsPath = join(this.dataPath, "assignments.json");

      // Save tests
      const _testsArray = Array.from(this.tests.values());
      writeFileSync(_testsPath, JSON.stringify(_testsArray, null, 2));

      // Save results (limit to recent results)
      const _recentResults = this.results
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxResults);
      writeFileSync(_resultsPath, JSON.stringify(_recentResults, null, 2));

      // Save assignments
      const _assignmentsObj: Record<string, Record<string, string>> = {};
      for (const [userId, assignments] of this.userAssignments.entries()) {
        _assignmentsObj[userId] = Object.fromEntries(assignments);
      }
      writeFileSync(_assignmentsPath, JSON.stringify(_assignmentsObj, null, 2));

      logger.debug("A/B testing _data saved");
    } catch (_error: unknown) {
      logger.error("Failed to save A/B testing _data:", _error);
    }
  }

  /**
   * Create a new A/B _test
   */
  createTest(config: ExperimentConfig): ABTest {
    const _testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const variants: ABTestVariant[] = config.variants.map(
      (_variant, _index) => ({
        ..._variant,
        id: `${_testId}_variant_${_index}`,
        weight: _variant.weight || 1 / config.variants.length,
        enabled: true,
      }),
    );

    const _test: ABTest = {
      id: _testId,
      name: config.name,
      description: config.description,
      hypothesis: config.hypothesis,
      variants,
      metrics: config.targetMetrics,
      startDate: Date.now(),
      endDate: Date.now() + config.duration * 24 * 60 * 60 * 1000,
      status: "draft",
    };

    this.tests.set(_testId, _test);
    this.saveTestingData();

    logger.info(`Created A/B _test: ${config.name} (${_testId})`);
    this.emit("testCreated", _test);

    return _test;
  }

  /**
   * Start running a _test
   */
  startTest(_testId: string): boolean {
    const _test = this.tests.get(_testId);
    if (!_test) {
      logger.warn(`Test not found: ${_testId}`);
      return false;
    }

    if (_test.status !== "draft" && _test.status !== "paused") {
      logger.warn(
        `Test ${_testId} cannot be started from status: ${_test.status}`,
      );
      return false;
    }

    _test.status = "running";
    test.startDate = Date.now();

    this.tests.set(_testId, _test);
    this.saveTestingData();

    logger.info(`Started A/B _test: ${_test.name} (${_testId})`);
    this.emit("testStarted", _test);

    return true;
  }

  /**
   * Stop a running _test
   */
  stopTest(
    _testId: string,
    reason: "completed" | "cancelled" = "completed",
  ): boolean {
    const _test = this.tests.get(_testId);
    if (!_test) {
      return false;
    }

    _test.status = reason;
    test.endDate = Date.now();

    this.tests.set(_testId, _test);
    this.saveTestingData();

    // Generate final _analytics
    this.generateAnalytics(_testId);

    logger.info(`Stopped A/B _test: ${_test.name} (${_testId}) - ${reason}`);
    this.emit("testStopped", { _test, reason });

    return true;
  }

  /**
   * Get _variant _assignment for a user
   */
  getVariantForUser(
    _testId: string,
    userId: string,
    sessionId: string,
  ): ABTestVariant | null {
    const _test = this.tests.get(_testId);
    if (!_test || _test.status !== "running") {
      return null;
    }

    // Check if user is already assigned to this _test
    const _userAssignments = this._userAssignments.get(userId);
    if (_userAssignments?.has(_testId)) {
      const _variantId = _userAssignments.get(_testId)!;
      return _test.variants.find((v) => v.id === _variantId) || null;
    }

    // Check if _test has ended
    if (_test.endDate && Date.now() > _test.endDate) {
      this.stopTest(_testId, "completed");
      return null;
    }

    // Assign user to _variant based on weights
    const _variant = this.assignUserToVariant(_test, userId);
    if (!_variant) {
      return null;
    }

    // Store _assignment
    if (!this._userAssignments.has(userId)) {
      this._userAssignments.set(userId, new Map());
    }
    this._userAssignments.get(userId)!.set(_testId, _variant.id);

    // Record participation
    this.recordResult({
      _testId,
      _variantId: _variant.id,
      userId,
      sessionId,
      metrics: { participated: true },
      timestamp: Date.now(),
    });

    this.emit("userAssigned", { _testId, userId, _variant });
    return _variant;
  }

  /**
   * Assign user to _variant using weighted _random selection
   */
  private assignUserToVariant(
    _test: ABTest,
    userId: string,
  ): ABTestVariant | null {
    const _enabledVariants = _test.variants.filter((v) => v.enabled);
    if (_enabledVariants.length === 0) {
      return null;
    }

    // Create deterministic but _random _assignment based on userId and _testId
    const _hash = this.hashString(`${userId}_${_test.id}`);
    const _random = (_hash % 10000) / 10000; // 0-1

    // Select _variant based on weights
    let cumulativeWeight = 0;
    for (const _variant of _enabledVariants) {
      cumulativeWeight += _variant.weight;
      if (_random < cumulativeWeight) {
        return _variant;
      }
    }

    // Fallback to first _variant
    return _enabledVariants[0] || null;
  }

  /**
   * Simple string _hash function
   */
  private hashString(str: string): number {
    let _hash = 0;
    for (let i = 0; i < str.length; i++) {
      const _char = str.charCodeAt(i);
      _hash = (_hash << 5) - _hash + _char;
      _hash = _hash & _hash; // Convert to 32-bit integer
    }
    return Math.abs(_hash);
  }

  /**
   * Record experiment result/metric
   */
  recordResult(result: ABTestResult): void {
    // Validate _test exists and is running
    const _test = this.tests.get(result.testId);
    if (!_test || _test.status !== "running") {
      return;
    }

    this.results.push(result);

    // Trigger _analytics update for this _test
    this.generateAnalytics(result.testId);

    this.emit("resultRecorded", result);

    // Periodic save
    if (this.results.length % 50 === 0) {
      this.saveTestingData();
    }
  }

  /**
   * Record conversion event
   */
  recordConversion(
    _testId: string,
    userId: string,
    sessionId: string,
    conversionValue: number = 1,
    additionalMetrics?: Record<string, unknown>,
  ): void {
    const _assignment = this.userAssignments.get(userId);
    if (!_assignment || !_assignment.has(_testId)) {
      return; // User not in this _test
    }

    const _variantId = _assignment.get(_testId)!;

    this.recordResult({
      _testId,
      _variantId,
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
   * Generate _analytics for a _test
   */
  generateAnalytics(_testId: string): ABTestAnalytics | null {
    const _test = this.tests.get(_testId);
    if (!_test) {
      return null;
    }

    const _testResults = this.results.filter((r) => r.testId === _testId);
    const _analytics: ABTestAnalytics = {
      _testId,
      variants: Record<string, any>,
      confidence: 0,
      totalParticipants: 0,
      lastUpdated: Date.now(),
    };

    // Calculate metrics for each _variant
    test.variants.forEach((_variant) => {
      const _variantResults = _testResults.filter(
        (r) => r._variantId === _variant.id,
      );
      const _participants = new Set(_variantResults.map((r) => r.userId)).size;

      const _conversions = _variantResults.filter(
        (r) => r.metrics["conversion"] === true,
      ).length;
      const _conversionRate =
        _participants > 0 ? _conversions / _participants : 0;

      const _conversionValues = _variantResults
        .filter((r) => r.metrics["conversion"] === true)
        .map((r) => Number(r.metrics["conversionValue"]) || 1);
      const _averageValue =
        conversionValues.length > 0
          ? _conversionValues.reduce((a, b) => a + b, 0) /
            _conversionValues.length
          : 0;

      analytics.variants[_variant.id] = {
        _participants,
        _conversions,
        _conversionRate,
        _averageValue,
        _confidenceLevel: 0, // Will be calculated below
        significance: false,
      };

      analytics.totalParticipants += _participants;
    });

    // Calculate statistical significance (simplified)
    const _variantIds = Object.keys(_analytics.variants);
    if (_variantIds.length === 2) {
      const [variantA, variantB] = _variantIds;
      const a = variantA ? _analytics.variants[variantA] : undefined;
      const b = variantB ? _analytics.variants[variantB] : undefined;

      if (a && b && a.participants > 30 && b.participants > 30) {
        const { _zScore: _zScore, _pValue } = this.calculateZTest(
          a.conversions,
          a.participants,
          b.conversions,
          b.participants,
        );

        const _confidenceLevel = 1 - _pValue;
        a._confidenceLevel = _confidenceLevel;
        b._confidenceLevel = _confidenceLevel;
        a.significance = _pValue < 0.05;
        b.significance = _pValue < 0.05;

        analytics.confidence = _confidenceLevel;

        // Determine winner
        if (a.significance) {
          analytics.winner =
            a.conversionRate > b.conversionRate ? variantA : variantB;
        }
      }
    }

    this._analytics.set(_testId, _analytics);
    this.emit("analyticsUpdated", _analytics);

    return _analytics;
  }

  /**
   * Calculate Z-_test for two proportions
   */
  private calculateZTest(
    x1: number,
    n1: number,
    x2: number,
    n2: number,
  ): { _zScore: number; _pValue: number } {
    const p1 = x1 / n1;
    const p2 = x2 / n2;
    const _pPooled = (x1 + x2) / (n1 + n2);

    const se = Math.sqrt(_pPooled * (1 - _pPooled) * (1 / n1 + 1 / n2));
    const _zScore = Math.abs(p1 - p2) / se;

    // Approximate p-value using normal distribution
    const _pValue = 2 * (1 - this.normalCDF(Math.abs(_zScore)));

    return { _zScore, _pValue };
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

    const _sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return _sign * y;
  }

  /**
   * Get _test _analytics
   */
  getAnalytics(_testId: string): ABTestAnalytics | null {
    return this.analytics.get(_testId) || null;
  }

  /**
   * Get all active tests
   */
  getActiveTests(): ABTest[] {
    return Array.from(this.tests.values()).filter(
      (_test) => _test.status === "running",
    );
  }

  /**
   * Get all tests
   */
  getAllTests(): ABTest[] {
    return Array.from(this.tests.values());
  }

  /**
   * Delete a _test and its _data
   */
  deleteTest(_testId: string): boolean {
    const _test = this.tests.get(_testId);
    if (!_test) {
      return false;
    }

    // Remove _test
    this.tests.delete(_testId);

    // Remove results
    this.results = this.results.filter((r) => r.testId !== _testId);

    // Remove _analytics
    this.analytics.delete(_testId);

    // Remove user assignments
    for (const assignments of this.userAssignments.values()) {
      assignments.delete(_testId);
    }

    this.saveTestingData();

    logger.info(`Deleted A/B _test: ${_test.name} (${_testId})`);
    this.emit("testDeleted", _testId);

    return true;
  }

  /**
   * Get user's _test assignments
   */
  getUserAssignments(userId: string): Map<string, string> {
    return this.userAssignments.get(userId) || new Map();
  }

  /**
   * Start _analytics engine
   */
  private startAnalyticsEngine(): void {
    // Update _analytics every 5 minutes for running tests
    setInterval(
      () => {
        const _activeTests = this.getActiveTests();
        activeTests.forEach((_test) => {
          this.generateAnalytics(_test.id);
        });

        // Auto-complete tests that have reached their end date
        activeTests.forEach((_test) => {
          if (_test.endDate && Date.now() > _test.endDate) {
            this.stopTest(_test.id, "completed");
          }
        });

        // Save _data periodically
        this.saveTestingData();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Export _test _data
   */
  exportTestData(_testId: string) {
    const _test = this.tests.get(_testId);
    if (!_test) {
      return null;
    }

    const _testResults = this.results.filter((r) => r.testId === _testId);
    const _analytics = this._analytics.get(_testId);

    return {
      _test,
      results: _testResults,
      _analytics,
      exportedAt: Date.now(),
    };
  }

  /**
   * Get framework statistics
   */
  getStats() {
    const _activeTests = this.getActiveTests().length;
    const _completedTests = Array.from(this.tests.values()).filter(
      (t) => t.status === "completed",
    ).length;
    const _totalResults = this.results.length;
    const _totalUsers = this.userAssignments.size;

    return {
      _activeTests,
      _completedTests,
      totalTests: this.tests.size,
      _totalResults,
      _totalUsers,
      averageResultsPerTest:
        this.tests.size > 0 ? _totalResults / this.tests.size : 0,
    };
  }
}

export const _abTestingFramework = ABTestingFramework.getInstance();
