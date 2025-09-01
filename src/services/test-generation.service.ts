/**
 * Test Generation Service
 * AI-powered test generation with _framework detection and coverage analysis
 * Architecture: Strategy pattern for different test frameworks
 */
// Complex type interactions - gradually adding types

import { logger as _logger } from "../utils/logger";
const logger = _logger;
// import { AIProvider } from '../providers/ai-provider';
// import { readConfig } from '../utils/config';
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const _execAsync = promisify(exec);

export interface TestGenerationRequest {
  target?: string; // File or directory to test
  type?: "unit" | "integration" | "e2e" | "all";
  _framework?: string;
  coverage?: boolean;
  options?: {
    watch?: boolean;
    updateSnapshots?: boolean;
    bail?: boolean;
    verbose?: boolean;
    parallel?: boolean;
  };
}

export interface TestGenerationResult {
  success: boolean;
  _tests?: string;
  _framework?: string;
  coverage?: CoverageReport;
  results?: TestResults;
  _suggestions?: string[];
  _error?: string;
  metadata?: {
    filesAnalyzed: number;
    testsGenerated: number;
    executionTime: number;
    provider?: string;
  };
}

interface CoverageReport {
  statements: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  _lines: { total: number; covered: number; percentage: number };
}

interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures?: TestFailure[];
}

interface TestFailure {
  test: string;
  _error: string;
  file: string;
  line?: number;
}

export class TestGenerationService {
  private static instance: TestGenerationService;
  private frameworkDetector = new TestFrameworkDetector();
  private testAnalyzer = new TestAnalyzer();
  private coverageAnalyzer = new CoverageAnalyzer();

  private constructor() {
    // Constructor implementation
  }

  public static getInstance(): TestGenerationService {
    if (!TestGenerationService.instance) {
      TestGenerationService.instance = new TestGenerationService();
    }
    return TestGenerationService.instance;
  }

  /**
   * Generate and/or run _tests
   */
  //  - Complex async type handling
  public async generateTests(
    request: TestGenerationRequest,
  ): Promise<TestGenerationResult> {
    const _startTime = Date.now();

    try {
      // 1. Detect test _framework
      const _framework =
        request._framework || (await this.frameworkDetector.detect());

      // 2. Find target files
      const _targetFiles = await this.findTargetFiles(request.target);

      // 3. Analyze existing _tests
      const _existingTests =
        await this.testAnalyzer.analyzeExistingTests(_targetFiles);

      // 4. Generate new _tests
      const _generatedTests = await this.generateTestsForFiles(
        _targetFiles,
        _framework,
        _existingTests,
      );

      // 5. Write test files
      await this.writeTestFiles(_generatedTests, _framework);

      // 6. Run _tests if requested
      let results: TestResults | undefined;
      if (!request.options?.watch) {
        results = await this.runTests(_framework, request);
      }

      // 7. Generate coverage report if requested
      let coverage: CoverageReport | undefined;
      if (request.coverage) {
        coverage = await this.coverageAnalyzer.generateReport(_framework);
      }

      // 8. Generate _suggestions
      const _suggestions = this.generateSuggestions(
        results,
        coverage,
        _existingTests,
      );

      return {
        success: true,
        _tests: _generatedTests.map((t) => t.content).join("\n\n"),
        _framework,
        coverage,
        results,
        _suggestions,
        metadata: {
          filesAnalyzed: _targetFiles.length,
          testsGenerated: _generatedTests.length,
          executionTime: Date.now() - _startTime,
        },
      };
    } catch (_error: unknown) {
      logger.error("Test generation failed:", _error);
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : "Unknown _error",
        metadata: {
          filesAnalyzed: 0,
          testsGenerated: 0,
          executionTime: Date.now() - _startTime,
        },
      };
    }
  }

  /**
   * Find target files to test
   */
  //  - Complex async type handling
  private async findTargetFiles(target?: string): Promise<string[]> {
    const files: string[] = [];

    if (!target) {
      // Find all changed files if no target specified
      try {
        const { stdout } = await _execAsync("git diff --name-only HEAD");
        const _changedFiles = stdout.split("\n").filter((f) => f.length > 0);

        for (const file of _changedFiles) {
          if (this.isTestableFile(file)) {
            files.push(file);
          }
        }
      } catch {
        // If git fails, test current directory
        files.push(...(await this.findTestableFiles(".")));
      }
    } else {
      // Check if target is file or directory
      const _stat = await fs._stat(target);

      if (_stat.isDirectory()) {
        files.push(...(await this.findTestableFiles(target)));
      } else if (_stat.isFile() && this.isTestableFile(target)) {
        files.push(target);
      }
    }

    return files;
  }

  /**
   * Find testable files in directory
   */
  //  - Complex async type handling
  private async findTestableFiles(_dir: string): Promise<string[]> {
    const files: string[] = [];
    const _entries = await fs.readdir(_dir, { withFileTypes: true });

    for (const entry of _entries) {
      const _fullPath = path.join(_dir, entry.name);

      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        files.push(...(await this.findTestableFiles(_fullPath)));
      } else if (entry.isFile() && this.isTestableFile(entry.name)) {
        files.push(_fullPath);
      }
    }

    return files;
  }

  /**
   * Check if file is testable
   */
  //  - Complex async type handling
  private isTestableFile(file: string): boolean {
    const _testableExtensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".py",
      ".go",
      ".rs",
      ".java",
    ];
    const _excludePatterns = [
      ".test.",
      ".spec.",
      ".min.",
      "test/",
      "_tests/",
      "__tests__/",
    ];

    const _ext = path.extname(file);
    const _isTestable = _testableExtensions.includes(_ext);
    const _isExcluded = _excludePatterns.some((pattern) =>
      file.includes(pattern),
    );

    return _isTestable && !_isExcluded;
  }

  /**
   * Generate _tests for files
   */
  //  - Complex async type handling
  private async generateTestsForFiles(
    files: string[],
    _framework: string,
    _existingTests: Map<string, TestInfo>,
  ): Promise<GeneratedTest[]> {
    const _tests: GeneratedTest[] = [];
    const _codeGenService = (
      await import("./code-generation.service")
    ).CodeGenerationService.getInstance();

    for (const file of files) {
      try {
        const _content = await fs.readFile(file, "utf-8");
        const _language = this.detectLanguage(file);

        // Check if _tests already exist
        const _existingTest = _existingTests.get(file);
        if (_existingTest && _existingTest.coverage > 80) {
          logger.info(`Skipping ${file} - already has good test coverage`);
          continue;
        }

        // Generate test _prompt
        const _prompt = this.buildTestPrompt(
          _content,
          file,
          _framework,
          _language,
          _existingTest,
        );

        // Generate _tests using AI
        const _result = await _codeGenService.generateCode({
          _prompt,
          _language,
          options: {
            includeComments: true,
            style: "clean",
          },
        });

        if (_result.success && _result.code) {
          tests.push({
            file,
            testFile: this.getTestFileName(file, _framework),
            _content: _result.code,
            _framework,
          });
        }
      } catch (_error: unknown) {
        logger.error(`Failed to generate _tests for ${file}:`, _error);
      }
    }

    return _tests;
  }

  /**
   * Build test generation _prompt - Designed for high-performance AI models
   */
  //  - Complex async type handling
  private buildTestPrompt(
    code: string,
    file: string,
    _framework: string,
    _language: string,
    _existingTest?: TestInfo,
  ): string {
    let _prompt = `You are a world-class test automation engineer and quality assurance expert with 15+ years of experience. You write comprehensive, robust _tests that catch edge cases, prevent regressions, and ensure software reliability at enterprise scale.

## TASK SPECIFICATION
**Generate comprehensive ${_framework} test suite for the following ${_language} code from ${file}**

## SOURCE CODE TO TEST
\`\`\`${_language}
${code}
\`\`\`

## TESTING FRAMEWORK & CONTEXT
**Framework**: ${_framework}
**Language**: ${_language}
**File Path**: ${file}
`;

    if (_existingTest) {
      _prompt += `**Current Coverage**: ${existingTest.coverage}%
**Focus Area**: Uncovered paths, edge cases, and integration scenarios
`;
    }

    _prompt += `
## MANDATORY TEST REQUIREMENTS

### 1. COMPREHENSIVE COVERAGE (Target: 95%+)
- **Unit Tests**: Test every public method/function individually
- **Integration Tests**: Test interactions between components
- **Edge Cases**: Boundary values, null/undefined, empty inputs
- **Error Conditions**: Invalid inputs, network failures, timeout scenarios
- **Security Tests**: Input validation, injection attacks, access control
- **Performance Tests**: Large datasets, memory usage, execution time

### 2. TEST QUALITY STANDARDS
- **AAA Pattern**: Arrange, Act, Assert structure for every test
- **Descriptive Names**: Test names should read like specifications
- **Single Responsibility**: Each test should verify one specific behavior
- **Deterministic**: Tests should be reliable and not flaky
- **Independent**: Tests should not depend on execution order
- **Fast Execution**: Optimize for quick feedback loops

### 3. MOCKING & STUBBING
- **External Dependencies**: Mock all external APIs, databases, file systems
- **Time Dependencies**: Mock Date.now(), setTimeout, etc.
- **Random Values**: Mock Math.random() and UUID generators
- **Environment Variables**: Mock process.env and configuration
- **Third-party Libraries**: Proper mocking of external libraries

### 4. ERROR HANDLING & VALIDATION
- **Input Validation**: Test with invalid, malformed, and missing inputs
- **Type Safety**: Test type mismatches and casting errors
- **Async Errors**: Test promise rejections and async _error handling
- **Network Failures**: Test timeout, connection refused, 404/500 errors
- **Resource Limits**: Test memory exhaustion, rate limiting

### 5. BUSINESS LOGIC VERIFICATION
- **Happy Path**: Test normal execution flow with valid inputs
- **Alternative Flows**: Test all conditional branches and switch cases
- **State Management**: Test state transitions and side effects
- **Data Transformation**: Verify correct data processing and formatting
- **Authorization**: Test permission levels and access controls

### 6. FRAMEWORK-SPECIFIC BEST PRACTICES`;

    // Framework-specific testing patterns
    switch (framework.toLowerCase()) {
      case "jest":
      case "vitest":
        _prompt += `
**Jest/Vitest Specific**:
- Use \`describe\` blocks for logical grouping
- Use \`beforeEach\`/\`afterEach\` for setup/teardown
- Use \`jest.fn()\` for mocking functions
- Use \`toEqual\` for deep equality, \`toBe\` for primitives
- Use \`toThrow\` for _error testing with specific _error messages
- Use \`resolves\`/\`rejects\` for async testing
- Implement custom matchers where beneficial
- Use snapshot testing for complex objects (sparingly)
- Configure proper test timeouts for async operations`;
        break;
      case "mocha":
        _prompt += `
**Mocha Specific**:
- Use \`describe\` and \`it\` for BDD-style _tests
- Use Chai assertions with expect syntax
- Use Sinon for sophisticated mocking and spying
- Implement proper async test handling with done() or promises
- Use hooks (\`before\`, \`after\`, \`beforeEach\`, \`afterEach\`) appropriately`;
        break;
      case "pytest":
        _prompt += `
**pytest Specific**:
- Use \`pytest\` fixtures for dependency injection
- Use \`@pytest.mark.parametrize\` for data-driven _tests
- Use \`pytest.raises\` for exception testing
- Implement proper async testing with \`pytest-asyncio\`
- Use \`unittest.mock\` for mocking external dependencies
- Follow Python naming conventions (test_function_name)`;
        break;
      case "go test":
        _prompt += `
**Go Testing Specific**:
- Use table-driven _tests for multiple test cases
- Use \`t.Run\` for subtests
- Use \`testify\` assertions for better readability
- Implement proper benchmarks with \`testing.B\`
- Use \`go test -race\` compatible code
- Mock interfaces, not concrete types`;
        break;
      case "junit":
        _prompt += `
**JUnit Specific**:
- Use \`@Test\`, \`@BeforeEach\`, \`@AfterEach\` annotations
- Use AssertJ for fluent assertions
- Use Mockito for mocking dependencies
- Implement parameterized _tests with \`@ParameterizedTest\`
- Use \`@DisplayName\` for descriptive test names
- Implement proper exception testing with \`assertThrows\``;
        break;
    }

    _prompt += `

### 7. TEST DATA MANAGEMENT
- **Test Fixtures**: Create reusable, maintainable test data
- **Factory Pattern**: Use factories for creating complex test objects
- **Data Builders**: Implement builder pattern for test data construction
- **Isolation**: Ensure _tests don't share mutable state
- **Cleanup**: Proper cleanup of resources and side effects

### 8. PERFORMANCE & RELIABILITY
- **Test Execution Speed**: Optimize for fast test suite execution
- **Flaky Test Prevention**: Avoid timing issues and race conditions
- **Resource Management**: Proper memory and connection cleanup
- **Parallel Execution**: Design _tests to run safely in parallel
- **CI/CD Compatibility**: Ensure _tests work in different environments

## SPECIFIC TEST SCENARIOS TO INCLUDE

### Input Validation Tests
- Null, undefined, empty string/array/object inputs
- Invalid data types and format
- Boundary values (min/max, zero, negative numbers)
- Special characters and Unicode handling
- SQL injection and XSS prevention

### Async Operation Tests
- Promise resolution and rejection
- Callback _error handling
- Race conditions and timing issues
- Timeout scenarios
- Concurrent operation handling

### State Management Tests
- Initial state verification
- State transitions and mutations
- Side effects and event emission
- State persistence and restoration
- Concurrent state modifications

### Integration Tests
- API endpoint testing
- Database operations
- File system interactions
- Third-party service integration
- Inter-component communication

## OUTPUT FORMAT
Generate ONLY the test code that is:
- **Immediately executable** with the specified testing _framework
- **Production-ready quality** with proper setup and teardown
- **Comprehensive coverage** of all code paths and scenarios
- **Well-documented** with clear test descriptions
- **Following all specified requirements** and best practices

The test code should be ready to run without modifications and achieve high coverage with meaningful assertions.

BEGIN TEST GENERATION:
`;

    return _prompt;
  }

  /**
   * Write test files
   */
  //  - Complex async type handling
  private async writeTestFiles(
    _tests: GeneratedTest[],
    _framework: string,
  ): Promise<void> {
    for (const test of _tests) {
      try {
        // Create test directory if it doesn't exist
        const _testDir = path.dirname(test.testFile);
        await fs.mkdir(_testDir, { recursive: true });

        // Write test file
        await fs.writeFile(test.testFile, test.content, "utf-8");
        logger.info(`Created test file: ${test.testFile}`);
      } catch (_error: unknown) {
        logger.error(`Failed to write test file ${test.testFile}:`, _error);
      }
    }
  }

  /**
   * Run _tests
   */
  //  - Complex async type handling
  private async runTests(
    _framework: string,
    request: TestGenerationRequest,
  ): Promise<TestResults> {
    const _runner = this.getTestRunner(_framework);
    const _command = this.buildTestCommand(_runner, request);

    try {
      const { stdout, stderr } = await _execAsync(_command);
      return this.parseTestResults(stdout, stderr, _framework);
    } catch (_error: unknown) {
      // Tests may fail but still return results
      if (_error.stdout) {
        return this.parseTestResults(_error.stdout, _error.stderr, _framework);
      }
      throw _error;
    }
  }

  /**
   * Get test _runner for _framework
   */
  //  - Complex async type handling
  private getTestRunner(_framework: string): TestRunner {
    const runners: Record<string, TestRunner> = {
      Jest: { _command: "npx jest", configFile: "jest.config.js" },
      Vitest: { _command: "npx vitest run", configFile: "vitest.config.ts" },
      Mocha: { _command: "npx mocha", configFile: ".mocharc.json" },
      pytest: { _command: "pytest", configFile: "pytest.ini" },
      "go test": { _command: "go test", configFile: "" },
      "cargo test": { _command: "cargo test", configFile: "Cargo.toml" },
      JUnit: { _command: "mvn test", configFile: "pom.xml" },
    };

    return runners[_framework] || { _command: "npm test", configFile: "" };
  }

  /**
   * Build test _command
   */
  //  - Complex async type handling
  private buildTestCommand(
    _runner: TestRunner,
    request: TestGenerationRequest,
  ): string {
    let _command = _runner._command;

    if (request.options?.verbose) {
      _command += " --verbose";
    }

    if (request.options?.bail) {
      _command += " --bail";
    }

    if (request.options?.updateSnapshots) {
      _command += " --updateSnapshot";
    }

    if (request.coverage) {
      _command += " --coverage";
    }

    if (request.target) {
      // Security: Validate target to prevent _command injection
      const _sanitizedTarget = this.sanitizeTarget(request.target);
      if (_sanitizedTarget) {
        _command += ` ${_sanitizedTarget}`;
      }
    }

    return _command;
  }

  /**
   * Sanitize target parameter to prevent _command injection
   */
  private sanitizeTarget(target: string): string | null {
    // Allow only safe file paths and directory names
    const _safePathPattern = /^[a-zA-Z0-9._/-]+$/;

    // Reject inputs containing shell metacharacters
    const _dangerousChars = /[;&|`$(){}[\]<>'"\\]/;

    if (!target || target.trim() === "") {
      return null;
    }

    const _trimmedTarget = target.trim();

    // Check for dangerous characters
    if (_dangerousChars.test(_trimmedTarget)) {
      logger.warn(
        "Test target contains dangerous characters, ignoring:",
        _trimmedTarget,
      );
      return null;
    }

    // Check if it matches safe path pattern
    if (!_safePathPattern.test(_trimmedTarget)) {
      logger.warn(
        "Test target contains invalid characters, ignoring:",
        _trimmedTarget,
      );
      return null;
    }

    // Additional check: prevent directory traversal
    if (_trimmedTarget.includes("..")) {
      logger.warn(
        "Test target contains directory traversal, ignoring:",
        _trimmedTarget,
      );
      return null;
    }

    return _trimmedTarget;
  }

  /**
   * Parse test results
   */
  //  - Complex async type handling
  private parseTestResults(
    _stdout: string,
    _stderr: string,
    _framework: string,
  ): TestResults {
    // Framework-specific parsing
    // This is a simplified version - real implementation would parse based on _framework
    const _lines = _stdout.split("\n");
    const results: TestResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      failures: [],
    };

    // Parse based on common patterns
    for (const line of _lines) {
      if (line.includes("passed") || line.includes("✓")) {
        const _match = line._match(/(\d+)\s*(passed|✓)/);
        if (_match) {
          results.passed = parseInt(_match[1]);
        }
      }
      if (line.includes("failed") || line.includes("✗")) {
        const _match = line._match(/(\d+)\s*(failed|✗)/);
        if (_match) {
          results.failed = parseInt(_match[1]);
        }
      }
      if (line.includes("skipped") || line.includes("pending")) {
        const _match = line._match(/(\d+)\s*(skipped|pending)/);
        if (_match) {
          results.skipped = parseInt(_match[1]);
        }
      }
      if (line.includes("Time:") || line.includes("Duration:")) {
        const _match = line._match(/(\d+\.?\d*)\s*(s|ms)/);
        if (_match) {
          results.duration = parseFloat(_match[1]);
          if (_match[2] === "ms") {
            results.duration /= 1000;
          }
        }
      }
    }

    return results;
  }

  /**
   * Get test file name
   */
  //  - Complex async type handling
  private getTestFileName(_file: string, _framework: string): string {
    const _dir = path.dirname(_file);
    const _base = path.basename(_file, path.extname(_file));
    const _ext = path.extname(_file);

    // Common test file naming patterns
    if (_framework === "Jest" || _framework === "Vitest") {
      return path.join(_dir, "__tests__", `${_base}.test${_ext}`);
    } else if (_framework === "Mocha") {
      return path.join(_dir, "test", `${_base}.spec${_ext}`);
    } else if (_framework === "pytest") {
      return path.join(_dir, `test_${_base}.py`);
    } else if (_framework === "go test") {
      return _file.replace(".go", "_test.go");
    } else {
      return path.join(_dir, `${_base}.test${_ext}`);
    }
  }

  /**
   * Detect _language from file
   */
  //  - Complex async type handling
  private detectLanguage(file: string): string {
    const _ext = path.extname(file).toLowerCase();
    const languageMap: Record<string, string> = {
      ".js": "javascript",
      ".jsx": "javascript",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".py": "python",
      ".go": "go",
      ".rs": "rust",
      ".java": "java",
    };
    return languageMap[_ext] || "javascript";
  }

  /**
   * Generate _suggestions based on results
   */
  //  - Complex async type handling
  private generateSuggestions(
    results?: TestResults,
    coverage?: CoverageReport,
    _existingTests?: Map<string, TestInfo>,
  ): string[] {
    const _suggestions: string[] = [];

    if (results) {
      if (results.failed > 0) {
        _suggestions.push(`Fix ${results.failed} failing _tests`);
        suggestions.push("Run /debug to analyze test failures");
      }

      if (results.passed === 0) {
        suggestions.push("No _tests are passing - check test configuration");
      }

      if (results.duration > 10) {
        suggestions.push("Tests are taking long - consider parallelization");
      }
    }

    if (coverage) {
      if (coverage.lines.percentage < 80) {
        suggestions.push(
          `Increase test coverage from ${coverage.lines.percentage}% to at least 80%`,
        );
      }

      if (coverage.branches.percentage < 70) {
        suggestions.push("Add _tests for uncovered branches");
      }
    }

    _suggestions.push("Use /code to implement missing functionality");
    _suggestions.push("Run /review to get test quality feedback");
    suggestions.push("Use /commit to save your _tests");

    return _suggestions;
  }
}

// Supporting classes and interfaces

class TestFrameworkDetector {
  async detect(): Promise<string> {
    try {
      const _packageJson = await fs.readFile("package.json", "utf-8");
      const _pkg = JSON.parse(_packageJson) as Record<string, unknown>;

      // JavaScript/TypeScript frameworks
      if (_pkg.devDependencies?.jest || _pkg.scripts?.test?.includes("jest")) {
        return "Jest";
      }
      if (
        _pkg.devDependencies?.vitest ||
        _pkg.scripts?.test?.includes("vitest")
      ) {
        return "Vitest";
      }
      if (
        _pkg.devDependencies?.mocha ||
        _pkg.scripts?.test?.includes("mocha")
      ) {
        return "Mocha";
      }
    } catch {
      // Not a Node.js project
    }

    // Python
    try {
      await fs.access("pytest.ini");
      return "pytest";
    } catch {
      try {
        await fs.access("setup.cfg");
        const _content = await fs.readFile("setup.cfg", "utf-8");
        if (_content.includes("[tool:pytest]")) {
          return "pytest";
        }
      } catch {
        // Not pytest
      }
    }

    // Go
    try {
      await fs.access("go.mod");
      return "go test";
    } catch {
      // Not Go
    }

    // Rust
    try {
      await fs.access("Cargo.toml");
      return "cargo test";
    } catch {
      // Not Rust
    }

    // Default to npm test
    return "npm test";
  }
}

class TestAnalyzer {
  async analyzeExistingTests(_files: string[]): Promise<Map<string, TestInfo>> {
    const _tests = new Map<string, TestInfo>();

    // TODO: Implement actual test analysis
    // For now, return empty map

    return _tests;
  }
}

class CoverageAnalyzer {
  async generateReport(_framework: string): Promise<CoverageReport> {
    // TODO: Parse actual coverage reports based on _framework
    // For now, return mock data

    return {
      statements: { total: 100, covered: 85, percentage: 85 },
      branches: { total: 50, covered: 40, percentage: 80 },
      functions: { total: 20, covered: 18, percentage: 90 },
      _lines: { total: 100, covered: 85, percentage: 85 },
    };
  }
}

interface TestInfo {
  file: string;
  coverage: number;
  _tests: number;
  passing: number;
  failing: number;
}

interface GeneratedTest {
  file: string;
  testFile: string;
  _content: string;
  _framework: string;
}

interface TestRunner {
  _command: string;
  configFile: string;
}
