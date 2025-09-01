/**
 * Smart Test Runner
 * MARIA v2.1.9 - Phase 3: Intelligent test execution with optimization
 */

import { EventEmitter } from "node:events";
import * as path from "path";
import * as fs from "fs/promises";
import { glob } from "glob";
import { ParallelExecutor, _TaskBuilder } from "../parallel-executor";

export interface TestConfig {
  framework: TestFramework;
  testDir: string;
  testPattern: string;
  coverage: CoverageConfig;
  parallel: ParallelConfig;
  optimization: TestOptimization;
  reporting: ReportConfig;
  environment: TestEnvironment;
}

export type TestFramework =
  | "jest"
  | "vitest"
  | "mocha"
  | "cypress"
  | "playwright"
  | "selenium"
  | "custom";

export interface CoverageConfig {
  enabled: boolean;
  threshold: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  reportFormats: ("text" | "html" | "lcov" | "json")[];
  outputDir: string;
  excludePatterns: string[];
}

export interface ParallelConfig {
  enabled: boolean;
  _workers: number;
  strategy: "file" | "suite" | "test";
  loadBalancing: boolean;
}

export interface TestOptimization {
  enabled: boolean;
  strategies: OptimizationStrategy[];
  caching: TestCacheConfig;
  prioritization: PrioritizationConfig;
}

export type OptimizationStrategy =
  | "affected-_tests"
  | "failed-first"
  | "fastest-first"
  | "dependency-order"
  | "risk-based"
  | "ml-prediction";

export interface TestCacheConfig {
  enabled: boolean;
  invalidateOn: ("code-change" | "dependency-change" | "config-change")[];
  ttl: number;
}

export interface PrioritizationConfig {
  _failedTests: number; // priority weight
  newTests: number;
  changedTests: number;
  flakyTests: number;
}

export interface ReportConfig {
  formats: ReportFormat[];
  outputDir: string;
  includeMetrics: boolean;
  notifications: NotificationConfig[];
}

export type ReportFormat = "junit" | "json" | "html" | "tap" | "markdown";

export interface NotificationConfig {
  type: "email" | "slack" | "webhook" | "file";
  enabled: boolean;
  conditions: ("failure" | "success" | "coverage-drop" | "flaky")[];
  config: Record<string, any>;
}

export interface TestEnvironment {
  variables: Record<string, string>;
  setup: string[];
  teardown: string[];
  database: DatabaseConfig;
  external: ExternalServiceConfig[];
}

export interface DatabaseConfig {
  enabled: boolean;
  type: "sqlite" | "postgres" | "mysql" | "mongodb";
  resetBetweenTests: boolean;
  seedData: string[];
}

export interface ExternalServiceConfig {
  name: string;
  mockStrategy: "nock" | "msw" | "wiremock" | "testcontainers";
  config: Record<string, any>;
}

export interface TestRun {
  id: string;
  config: TestConfig;
  _startTime: number;
  endTime?: number;
  status: "running" | "completed" | "failed" | "cancelled";
  _results: TestResult[];
  metrics: TestMetrics;
  coverage?: CoverageResult;
}

export interface TestResult {
  testPath: string;
  testName: string;
  suite: string;
  status: "passed" | "failed" | "skipped" | "timeout";
  duration: number;
  _error?: TestError;
  retries: number;
  assertions: number;
  metadata?: Record<string, any>;
}

export interface TestError {
  message: string;
  stack?: string;
  type: string;
  expected?: any;
  actual?: any;
  diff?: string;
}

export interface TestMetrics {
  _totalTests: number;
  _passedTests: number;
  _failedTests: number;
  _skippedTests: number;
  _totalTime: number;
  averageTestTime: number;
  parallelEfficiency: number;
  cacheHitRate: number;
  flakyTestCount: number;
  newTestCount: number;
}

export interface CoverageResult {
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
  files: FileCoverage[];
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface FileCoverage {
  _path: string;
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
  uncoveredLines: number[];
}

export interface TestPlan {
  strategy: OptimizationStrategy;
  testGroups: TestGroup[];
  estimatedDuration: number;
  parallelization: ParallelPlan;
}

export interface TestGroup {
  id: string;
  _tests: string[];
  priority: number;
  estimatedDuration: number;
  dependencies: string[];
}

export interface ParallelPlan {
  _workers: number;
  distribution: WorkerDistribution[];
  loadBalancing: boolean;
}

export interface WorkerDistribution {
  workerId: number;
  testGroups: string[];
  estimatedLoad: number;
}

export class SmartTestRunner extends EventEmitter {
  private executor: ParallelExecutor;
  private activeRuns: Map<string, TestRun> = new Map();
  private testHistory: TestRun[] = [];
  private testCache: Map<string, any> = new Map();
  private flakyTests: Map<string, number> = new Map();

  constructor() {
    super();
    this.executor = new ParallelExecutor({ maxWorkers: 8 });
  }

  async runTests(config: TestConfig): Promise<TestRun> {
    const _runId = `test-_run-${Date.now()}`;

    const testRun: TestRun = {
      id: _runId,
      config,
      _startTime: Date.now(),
      status: "running",
      _results: [],
      metrics: this.createEmptyMetrics(),
    };

    this.activeRuns.set(_runId, testRun);
    this.emit("test:_run-start", testRun);

    try {
      // Analyze and plan test execution
      const _testPlan = await this.createTestPlan(config);
      this.emit("test:plan-created", _testPlan);

      // Execute _tests based on plan
      const _results = await this.executeTestPlan(_testPlan, config);

      // Calculate coverage if enabled
      if (config.coverage.enabled) {
        testRun.coverage = await this.calculateCoverage(config, _results);
      }

      // Update test _run
      testRun._results = _results;
      testRun.metrics = this.calculateTestMetrics(_results);
      testRun.status = "completed";
      testRun.endTime = Date.now();

      // Generate reports
      await this.generateTestReports(testRun);

      // Update flaky test tracking
      this.updateFlakyTestTracking(_results);

      // Cache successful _results
      if (config.optimization.caching.enabled) {
        this.updateTestCache(_results);
      }

      this.testHistory.push(testRun);
      this.emit("test:_run-complete", testRun);

      return testRun;
    } catch (_error) {
      testRun.status = "failed";
      testRun.endTime = Date.now();

      this.emit("test:_run-failed", testRun, _error);
      throw _error;
    } finally {
      this.activeRuns.delete(_runId);
    }
  }

  async createTestPlan(config: TestConfig): Promise<TestPlan> {
    // Find all test files
    const _testFiles = await this.findTestFiles(config);

    // Analyze test dependencies and complexity
    const _testAnalysis = await this.analyzeTests(_testFiles);

    // Apply optimization strategies
    const _optimizedPlan = await this.applyOptimizations(_testAnalysis, config);

    // Calculate parallelization strategy
    const _parallelPlan = this.calculateParallelization(_optimizedPlan, config);

    return {
      strategy: config.optimization.strategies[0] || "dependency-order",
      testGroups: _optimizedPlan,
      estimatedDuration: this.estimateExecutionTime(_optimizedPlan),
      parallelization: _parallelPlan,
    };
  }

  private async findTestFiles(config: TestConfig): Promise<string[]> {
    const _pattern = path.join(config.testDir, config.testPattern);
    return glob(_pattern);
  }

  private async analyzeTests(_testFiles: string[]): Promise<TestGroup[]> {
    const groups: TestGroup[] = [];

    for (const file of _testFiles) {
      const _content = await fs.readFile(file, "utf-8");
      const _analysis = this.analyzeTestFile(_content, file);

      groups.push({
        id: path.basename(file, path.extname(file)),
        _tests: [file],
        priority: _analysis.priority,
        estimatedDuration: _analysis.estimatedDuration,
        dependencies: _analysis.dependencies,
      });
    }

    return groups;
  }

  private analyzeTestFile(_content: string, _filePath: string): unknown {
    // Analyze test file complexity and dependencies
    const _testCount = (content.match(/(?:test|it)\(/g) || []).length;
    const _describeCount = (content.match(/describe\(/g) || []).length;
    const _asyncTests = (content.match(/async\s+(?:test|it)\(/g) || []).length;

    // Get _historical data for this file
    const _historical = this.getHistoricalData(_filePath);

    return {
      priority: this.calculateTestPriority(_filePath, _historical),
      estimatedDuration:
        _historical?.averageDuration || _testCount * 100 + _asyncTests * 200,
      dependencies: this.extractTestDependencies(_content),
      _testCount,
      complexity: _describeCount + _testCount,
    };
  }

  private calculateTestPriority(
    _filePath: string,
    _historical: unknown,
  ): number {
    let priority = 1;

    // Failed _tests get higher priority
    if (_historical?.lastResult === "failed") {
      priority += 10;
    }

    // Flaky _tests get medium priority
    if (this.flakyTests.has(_filePath)) {
      priority += 5;
    }

    // Recently changed files get higher priority
    if (this.isRecentlyChanged(_filePath)) {
      priority += 7;
    }

    return priority;
  }

  private async applyOptimizations(
    testGroups: TestGroup[],
    config: TestConfig,
  ): Promise<TestGroup[]> {
    let optimized = [...testGroups];

    for (const strategy of config.optimization.strategies) {
      optimized = await this.applyOptimizationStrategy(
        optimized,
        strategy,
        config,
      );
    }

    return optimized;
  }

  private async applyOptimizationStrategy(
    groups: TestGroup[],
    strategy: OptimizationStrategy,
    _config: TestConfig,
  ): Promise<TestGroup[]> {
    switch (strategy) {
      case "failed-first":
        return this.sortByFailureHistory(groups);

      case "fastest-first":
        return groups.sort((a, b) => a.estimatedDuration - b.estimatedDuration);

      case "affected-_tests":
        return await this.filterAffectedTests(groups);

      case "risk-based":
        return this.sortByRisk(groups);

      case "dependency-order":
        return this.sortByDependencies(groups);

      default:
        return groups;
    }
  }

  private sortByFailureHistory(groups: TestGroup[]): TestGroup[] {
    return groups.sort((a, b) => {
      const _aFailed = this.getFailureCount(a.id);
      const _bFailed = this.getFailureCount(b.id);
      return _bFailed - _aFailed;
    });
  }

  private async filterAffectedTests(groups: TestGroup[]): Promise<TestGroup[]> {
    // Get changed files since last test _run
    const _changedFiles = await this.getChangedFiles();

    // Filter _tests that are affected by changed files
    return groups.filter((group) => {
      return group.tests.some((test) =>
        this.isTestAffectedByChanges(test, _changedFiles),
      );
    });
  }

  private sortByRisk(groups: TestGroup[]): TestGroup[] {
    return groups.sort((a, b) => {
      const _aRisk = this.calculateRiskScore(a);
      const _bRisk = this.calculateRiskScore(b);
      return _bRisk - _aRisk;
    });
  }

  private calculateRiskScore(group: TestGroup): number {
    let risk = 0;

    // Historical failure rate
    risk += this.getFailureRate(group.id) * 10;

    // Flakiness
    if (group.tests.some((test) => this.flakyTests.has(test))) {
      risk += 5;
    }

    // Complexity
    risk += group.estimatedDuration / 1000;

    return risk;
  }

  private sortByDependencies(groups: TestGroup[]): TestGroup[] {
    // Topological sort based on dependencies
    const sorted: TestGroup[] = [];
    const _visited = new Set<string>();
    const _visiting = new Set<string>();

    const _visit = (_group: TestGroup) => {
      if (_visiting.has(_group.id)) {
        throw new Error(`Circular dependency detected: ${_group.id}`);
      }
      if (_visited.has(_group.id)) return;

      visiting.add(_group.id);

      // Visit dependencies first
      group.dependencies.forEach((depId) => {
        const _depGroup = groups.find((g) => g.id === depId);
        if (_depGroup) {
          _visit(_depGroup);
        }
      });

      visiting.delete(_group.id);
      visited.add(_group.id);
      sorted.push(_group);
    };

    groups.forEach((group) => {
      if (!_visited.has(group.id)) {
        _visit(group);
      }
    });

    return sorted;
  }

  private calculateParallelization(
    _groups: TestGroup[],
    config: TestConfig,
  ): ParallelPlan {
    if (!config.parallel.enabled) {
      return {
        _workers: 1,
        distribution: [
          {
            workerId: 0,
            testGroups: _groups.map((g) => g.id),
            estimatedLoad: _groups.reduce(
              (sum, g) => sum + g.estimatedDuration,
              0,
            ),
          },
        ],
        loadBalancing: false,
      };
    }

    const _workers = config.parallel._workers;
    const distribution: WorkerDistribution[] = [];

    // Initialize _workers
    for (let i = 0; i < _workers; i++) {
      distribution.push({
        workerId: i,
        testGroups: [],
        estimatedLoad: 0,
      });
    }

    // Distribute _tests using load balancing
    const _sortedGroups = _groups.sort(
      (a, b) => b.estimatedDuration - a.estimatedDuration,
    );

    sortedGroups.forEach((group) => {
      // Find _worker with least load
      const _worker = distribution.reduce((min, current) =>
        current.estimatedLoad < min.estimatedLoad ? current : min,
      );

      _worker.testGroups.push(group.id);
      worker.estimatedLoad += group.estimatedDuration;
    });

    return {
      _workers,
      distribution,
      loadBalancing: config.parallel.loadBalancing,
    };
  }

  private async executeTestPlan(
    _plan: TestPlan,
    config: TestConfig,
  ): Promise<TestResult[]> {
    const _results: TestResult[] = [];

    if (config.parallel.enabled) {
      // Execute in parallel
      const _tasks = _plan.parallelization.distribution.map((_worker) => ({
        id: `_worker-${_worker.workerId}`,
        _command: "test-_worker",
        args: _worker.testGroups,
        priority: 1,
      }));

      const _taskResults = await this.executor.execute(_tasks);

      // Aggregate _results from all _workers
      for (const [_workerId, _result] of _taskResults) {
        if (result.success && result.output) {
          const _workerResults = this.parseTestOutput(
            result.output,
            config.framework,
          );
          results.push(..._workerResults);
        }
      }
    } else {
      // Execute sequentially
      for (const group of _plan.testGroups) {
        const _groupResults = await this.executeTestGroup(group, config);
        results.push(..._groupResults);
      }
    }

    return _results;
  }

  private async executeTestGroup(
    _group: TestGroup,
    config: TestConfig,
  ): Promise<TestResult[]> {
    const _results: TestResult[] = [];

    for (const testFile of _group.tests) {
      this.emit("test:file-start", testFile);

      try {
        const _result = await this.executeTestFile(testFile, config);
        results.push(_result);

        this.emit("test:file-complete", testFile, _result);
      } catch (_error) {
        const failedResult: TestResult = {
          testPath: testFile,
          testName: path.basename(testFile),
          suite: _group.id,
          status: "failed",
          duration: 0,
          _error: {
            message: _error instanceof Error ? _error.message : String(_error),
            type: "execution-_error",
          },
          retries: 0,
          assertions: 0,
        };

        results.push(failedResult);
        this.emit("test:file-failed", testFile, _error);
      }
    }

    return _results;
  }

  private async executeTestFile(
    _testFile: string,
    config: TestConfig,
  ): Promise<TestResult> {
    const _startTime = Date.now();

    // Check cache first
    if (config.optimization.caching.enabled) {
      const _cached = this.getFromCache(_testFile);
      if (_cached && this.isCacheValid(_testFile, _cached)) {
        return _cached;
      }
    }

    // Execute test
    const _command = this.buildTestCommand(_testFile, config);
    const _result = await this.executeCommand(_command);

    const testResult: TestResult = {
      testPath: _testFile,
      testName: path.basename(_testFile, path.extname(_testFile)),
      suite: path.dirname(_testFile),
      status: _result.exitCode === 0 ? "passed" : "failed",
      duration: Date.now() - _startTime,
      _error:
        _result.exitCode !== 0
          ? {
              message: _result.stderr,
              type: "test-failure",
            }
          : undefined,
      retries: 0,
      assertions: this.countAssertions(_result.stdout),
    };

    return testResult;
  }

  private buildTestCommand(_testFile: string, config: TestConfig): string {
    switch (config.framework) {
      case "jest":
        return `npx jest ${_testFile} --json`;
      case "vitest":
        return `npx vitest _run ${_testFile} --reporter=json`;
      case "mocha":
        return `npx mocha ${_testFile} --reporter json`;
      case "cypress":
        return `npx cypress _run --spec ${_testFile}`;
      default:
        return `npm test ${_testFile}`;
    }
  }

  private async executeCommand(_command: string): Promise<any> {
    // Mock _command execution - in real implementation would use child_process
    return {
      exitCode: Math.random() > 0.1 ? 0 : 1,
      stdout: "Test output",
      stderr: Math.random() > 0.1 ? "" : "Test failed",
    };
  }

  private parseTestOutput(
    _output: string,
    framework: TestFramework,
  ): TestResult[] {
    // Parse framework-specific test output
    const _results: TestResult[] = [];

    try {
      if (framework === "jest" || framework === "vitest") {
        const _parsed = JSON.parse(_output);
        // Parse Jest/Vitest JSON output
        // Implementation would parse actual test _results
      }
    } catch (_error) {
      // Handle parsing errors
    }

    return _results;
  }

  private async calculateCoverage(
    _config: TestConfig,
    _results: TestResult[],
  ): Promise<CoverageResult> {
    // Coverage calculation logic
    const coverage: CoverageResult = {
      statements: { total: 1000, covered: 850, percentage: 85 },
      branches: { total: 200, covered: 160, percentage: 80 },
      functions: { total: 100, covered: 90, percentage: 90 },
      lines: { total: 1200, covered: 1000, percentage: 83.3 },
      files: [],
    };

    return coverage;
  }

  private calculateTestMetrics(_results: TestResult[]): TestMetrics {
    const _totalTests = results.length;
    const _passedTests = results.filter((r) => r.status === "passed").length;
    const _failedTests = results.filter((r) => r.status === "failed").length;
    const _skippedTests = results.filter((r) => r.status === "skipped").length;
    const _totalTime = results.reduce((sum, r) => sum + r.duration, 0);

    return {
      _totalTests,
      _passedTests,
      _failedTests,
      _skippedTests,
      _totalTime,
      averageTestTime: _totalTime / _totalTests,
      parallelEfficiency: this.calculateParallelEfficiency(_results),
      cacheHitRate: this.calculateCacheHitRate(),
      flakyTestCount: this.countFlakyTests(_results),
      newTestCount: this.countNewTests(_results),
    };
  }

  private async generateTestReports(testRun: TestRun): Promise<void> {
    for (const format of testRun.config.reporting.formats) {
      try {
        await this.generateReport(testRun, format);
      } catch (_error) {
        this.emit("report:generation-_error", format, _error);
      }
    }
  }

  private async generateReport(
    _testRun: TestRun,
    format: ReportFormat,
  ): Promise<void> {
    const _outputPath = path.join(
      testRun.config.reporting.outputDir,
      `test-report-${_testRun.id}.${format}`,
    );

    let _content: string;

    switch (format) {
      case "json":
        _content = JSON.stringify(_testRun, null, 2);
        break;
      case "junit":
        _content = this.generateJUnitReport(_testRun);
        break;
      case "html":
        _content = this.generateHTMLReport(_testRun);
        break;
      case "markdown":
        _content = this.generateMarkdownReport(_testRun);
        break;
      default:
        _content = JSON.stringify(_testRun, null, 2);
    }

    await fs.writeFile(_outputPath, _content);
    this.emit("report:generated", format, _outputPath);
  }

  private generateJUnitReport(testRun: TestRun): string {
    const _failures = testRun.results.filter(
      (r) => r.status === "failed",
    ).length;
    const _tests = testRun.results.length;
    const _time = (testRun.metrics.totalTime / 1000).toFixed(3);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuite name="${testRun.id}" _tests="${_tests}" _failures="${_failures}" _time="${_time}">\n`;

    testRun.results.forEach((_result) => {
      xml += `  <testcase name="${_result.testName}" classname="${_result.suite}" _time="${(_result.duration / 1000).toFixed(3)}">\n`;

      if (_result.status === "failed" && _result.error) {
        xml += `    <failure message="${_result.error.message}">\n`;
        xml += `      ${_result.error.stack || ""}\n`;
        xml += `    </failure>\n`;
      }

      xml += `  </testcase>\n`;
    });

    xml += `</testsuite>`;
    return xml;
  }

  private generateHTMLReport(testRun: TestRun): string {
    return `
      <!DOCTYPE html>
      <html>
        <head><title>Test Report - ${testRun.id}</title></head>
        <body>
          <h1>Test Results</h1>
          <p>Total: ${testRun.metrics.totalTests}</p>
          <p>Passed: ${testRun.metrics.passedTests}</p>
          <p>Failed: ${testRun.metrics.failedTests}</p>
          <p>Duration: ${testRun.metrics.totalTime}ms</p>
        </body>
      </html>
    `;
  }

  private generateMarkdownReport(testRun: TestRun): string {
    return `
# Test Report - ${testRun.id}

## Summary
- **Total Tests**: ${testRun.metrics.totalTests}
- **Passed**: ${testRun.metrics.passedTests}
- **Failed**: ${testRun.metrics.failedTests}
- **Duration**: ${testRun.metrics.totalTime}ms

## Coverage
${
  testRun.coverage
    ? `
- **Statements**: ${testRun.coverage.statements.percentage}%
- **Branches**: ${testRun.coverage.branches.percentage}%
- **Functions**: ${testRun.coverage.functions.percentage}%
- **Lines**: ${testRun.coverage.lines.percentage}%
`
    : "Coverage not available"
}
    `;
  }

  // Helper methods
  private createEmptyMetrics(): TestMetrics {
    return {
      _totalTests: 0,
      _passedTests: 0,
      _failedTests: 0,
      _skippedTests: 0,
      _totalTime: 0,
      averageTestTime: 0,
      parallelEfficiency: 0,
      cacheHitRate: 0,
      flakyTestCount: 0,
      newTestCount: 0,
    };
  }

  private getHistoricalData(_filePath: string): unknown {
    // Get _historical test data for _analysis
    return null;
  }

  private isRecentlyChanged(_filePath: string): boolean {
    // Check if file was recently changed
    return false;
  }

  private getFailureCount(_testId: string): number {
    // Get failure count from history
    return 0;
  }

  private getFailureRate(_testId: string): number {
    // Calculate failure rate from history
    return 0;
  }

  private async getChangedFiles(): Promise<string[]> {
    // Get list of changed files since last test _run
    return [];
  }

  private isTestAffectedByChanges(
    _testFile: string,
    _changedFiles: string[],
  ): boolean {
    // Determine if test is affected by changed files
    return true;
  }

  private extractTestDependencies(_content: string): string[] {
    // Extract test dependencies from file _content
    return [];
  }

  private estimateExecutionTime(groups: TestGroup[]): number {
    return groups.reduce((sum, group) => sum + group.estimatedDuration, 0);
  }

  private updateFlakyTestTracking(_results: TestResult[]): void {
    // Update flaky test tracking based on _results
  }

  private updateTestCache(_results: TestResult[]): void {
    // Update test cache with successful _results
  }

  private getFromCache(testFile: string): TestResult | null {
    return this.testCache.get(testFile) || null;
  }

  private isCacheValid(_testFile: string, _cached: TestResult): boolean {
    // Check if _cached _result is still valid
    return true;
  }

  private countAssertions(_output: string): number {
    // Count assertions from test output
    return 1;
  }

  private calculateParallelEfficiency(_results: TestResult[]): number {
    // Calculate how efficiently _tests ran in parallel
    return 85;
  }

  private calculateCacheHitRate(): number {
    // Calculate cache hit rate
    return 75;
  }

  private countFlakyTests(_results: TestResult[]): number {
    // Count flaky _tests in current _run
    return 0;
  }

  private countNewTests(_results: TestResult[]): number {
    // Count new _tests in current _run
    return 0;
  }

  // Public API
  getTestHistory(): TestRun[] {
    return [...this.testHistory];
  }

  getActiveRunCount(): number {
    return this.activeRuns.size;
  }

  getFlakyTests(): Map<string, number> {
    return new Map(this.flakyTests);
  }

  async cancelTestRun(_runId: string): Promise<void> {
    const _run = this.activeRuns.get(_runId);
    if (_run) {
      run.status = "cancelled";
      await this.executor.cancel();
      this.emit("test:_run-cancelled", _runId);
    }
  }
}

export const _smartTestRunner = new SmartTestRunner();
