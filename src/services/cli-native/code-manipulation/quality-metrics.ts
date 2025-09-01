/**
 * Code Quality Metrics System
 * MARIA v2.1.9 - Comprehensive code quality analysis
 */

import { EventEmitter } from "node:events";
import * as _ts from "typescript";
import { ASTEngine, ASTNode } from "./_ast-engine";

export interface QualityMetrics {
  overall: QualityScore;
  maintainability: MaintainabilityMetrics;
  reliability: ReliabilityMetrics;
  security: SecurityMetrics;
  performance: PerformanceMetrics;
  testability: TestabilityMetrics;
  documentation: DocumentationMetrics;
  _complexity: ComplexityMetrics;
  duplication: DuplicationMetrics;
}

export interface QualityScore {
  score: number; // 0-100
  _grade: "A" | "B" | "C" | "D" | "F";
  _trend: "improving" | "stable" | "declining";
  _issues: QualityIssue[];
}

export interface MaintainabilityMetrics {
  _maintainabilityIndex: number;
  _technicalDebt: number; // in hours
  _codeChurn: number;
  _modularity: number;
  coupling: number;
  _cohesion: number;
}

export interface ReliabilityMetrics {
  _bugProbability: number;
  _errorHandling: number;
  _nullSafety: number;
  _typeStrength: number;
  _assertionDensity: number;
}

export interface SecurityMetrics {
  vulnerabilities: SecurityVulnerability[];
  securityScore: number;
  _inputValidation: number;
  _authentication: number;
  _authorization: number;
  _encryption: number;
}

export interface PerformanceMetrics {
  algorithmicComplexity: number;
  _memoryLeakRisk: number;
  _asyncPatterns: number;
  _cacheUtilization: number;
  _queryOptimization: number;
}

export interface TestabilityMetrics {
  _testCoverage: number;
  _mockability: number;
  _assertionCount: number;
  _testToCodeRatio: number;
  _integrationTestCoverage: number;
}

export interface DocumentationMetrics {
  _commentDensity: number;
  _apiDocumentation: number;
  _inlineComments: number;
  _readmeCompleteness: number;
  _exampleCount: number;
}

export interface ComplexityMetrics {
  _cyclomaticComplexity: number;
  _cognitiveComplexity: number;
  _nestingDepth: number;
  parameterCount: number;
  _lineCount: number;
  _statementCount: number;
}

export interface DuplicationMetrics {
  _duplicatedLines: number;
  _duplicatedBlocks: number;
  _duplicatedFiles: number;
  _duplicationPercentage: number;
  _similarityIndex: number;
}

export interface QualityIssue {
  id: string;
  type: IssueType;
  severity: "info" | "warning" | "error" | "critical";
  category: string;
  message: string;
  location: IssueLocation;
  suggestion?: string;
  autoFixable: boolean;
}

export type IssueType =
  | "_complexity"
  | "duplication"
  | "security"
  | "performance"
  | "maintainability"
  | "documentation"
  | "testing"
  | "style"
  | "bug-risk";

export interface IssueLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface SecurityVulnerability {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  cwe: string;
  description: string;
  location: IssueLocation;
  remediation: string;
}

export interface QualityConfig {
  enabledChecks?: string[];
  customRules?: CustomRule[];
  thresholds?: QualityThresholds;
  ignorePatterns?: string[];
}

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  check: (_ast: ASTNode, code: string) => QualityIssue[];
}

export interface QualityThresholds {
  minMaintainabilityIndex?: number;
  maxComplexity?: number;
  minTestCoverage?: number;
  maxDuplication?: number;
  maxTechnicalDebt?: number;
}

export class CodeQualityAnalyzer extends EventEmitter {
  private astEngine: ASTEngine;
  private config: QualityConfig;
  private _history: Map<string, QualityMetrics[]> = new Map();
  private rules: Map<string, CustomRule> = new Map();

  constructor(_config: QualityConfig = {}) {
    super();
    this.astEngine = new ASTEngine();
    this._config = _config;
    this.registerBuiltInRules();
    this.registerCustomRules(_config.customRules || []);
  }

  private registerBuiltInRules(): void {
    // Complexity rules
    this.registerRule({
      id: "high-_complexity",
      name: "High Complexity",
      description: "Detects _functions with high cyclomatic _complexity",
      check: this.checkHighComplexity.bind(this),
    });

    // Security rules
    this.registerRule({
      id: "sql-injection",
      name: "SQL Injection Risk",
      description: "Detects potential SQL injection vulnerabilities",
      check: this.checkSQLInjection.bind(this),
    });

    // Performance rules
    this.registerRule({
      id: "inefficient-loop",
      name: "Inefficient Loop",
      description: "Detects inefficient loop patterns",
      check: this.checkInefficientLoops.bind(this),
    });

    // Documentation rules
    this.registerRule({
      id: "missing-docs",
      name: "Missing Documentation",
      description: "Detects public APIs without documentation",
      check: this.checkMissingDocumentation.bind(this),
    });
  }

  private registerCustomRules(rules: CustomRule[]): void {
    rules.forEach((rule) => this.registerRule(rule));
  }

  private registerRule(rule: CustomRule): void {
    this.rules.set(rule.id, rule);
  }

  async analyzeCode(
    _code: string,
    fileName: string = "temp.ts",
  ): Promise<QualityMetrics> {
    const _ast = this.astEngine.parseCode(_code, fileName);

    const _metrics: QualityMetrics = {
      overall: await this.calculateOverallScore(_ast, _code),
      maintainability: this.calculateMaintainability(_ast, _code),
      reliability: this.calculateReliability(_ast, _code),
      security: this.calculateSecurity(_ast, _code),
      performance: this.calculatePerformance(_ast, _code),
      testability: this.calculateTestability(_ast, _code),
      documentation: this.calculateDocumentation(_ast, _code),
      _complexity: this.calculateComplexity(_ast, _code),
      duplication: this.calculateDuplication(_ast, _code),
    };

    // Store in _history for _trend analysis
    if (!this.history.has(fileName)) {
      this.history.set(fileName, []);
    }
    this.history.get(fileName)!.push(_metrics);

    this.emit("analysis:complete", _metrics);
    return _metrics;
  }

  private async calculateOverallScore(
    _ast: ASTNode,
    code: string,
  ): Promise<QualityScore> {
    const _issues: QualityIssue[] = [];

    // Run all registered rules
    for (const rule of this.rules.values()) {
      const _ruleIssues = rule.check(_ast, code);
      issues.push(..._ruleIssues);
    }

    // Calculate score based on _issues
    let score = 100;
    issues.forEach((issue) => {
      switch (issue.severity) {
        case "critical":
          score -= 20;
          break;
        case "error":
          score -= 10;
          break;
        case "warning":
          score -= 5;
          break;
        case "info":
          score -= 1;
          break;
      }
    });

    score = Math.max(0, score);

    const _grade = this.getGrade(score);
    const _trend = this.getTrend(_ast.metadata?.fileName || "unknown");

    return { score, _grade, _trend, _issues };
  }

  private calculateMaintainability(
    _ast: ASTNode,
    code: string,
  ): MaintainabilityMetrics {
    const _complexity = this.calculateComplexity(_ast, code);
    const _loc = code.split("\n").length;

    // Maintainability Index = 171 - 5.2 * ln(V) - 0.23 * CC - 16.2 * ln(LOC)
    // Simplified version
    const _maintainabilityIndex = Math.max(
      0,
      Math.min(
        100,
        171 -
          5.2 * Math.log(_complexity.statementCount + 1) -
          0.23 * _complexity.cyclomaticComplexity -
          16.2 * Math.log(_loc),
      ),
    );

    // Technical debt estimation (hours)
    const _issues = this.rules.get("high-_complexity")?.check(_ast, code) || [];
    const _technicalDebt = _issues.length * 2; // 2 hours per issue

    // Code churn (simplified - would need git _history)
    const _codeChurn = 0;

    // Modularity, coupling, _cohesion from AST analysis
    const _metrics = this.astEngine.calculateMetrics(_ast);

    return {
      _maintainabilityIndex,
      _technicalDebt,
      _codeChurn,
      _modularity: this.calculateModularity(_ast),
      coupling: _metrics.dependencies.length,
      _cohesion: this.calculateCohesion(_ast),
    };
  }

  private calculateReliability(
    _ast: ASTNode,
    code: string,
  ): ReliabilityMetrics {
    const _functions = this.astEngine.findNodesByType(
      _ast,
      "FunctionDeclaration",
    );
    const _tryStatements = this.astEngine.findNodesByType(_ast, "TryStatement");
    const _assertions = this.findAssertions(_ast);

    // Bug probability based on _complexity and size
    const _complexity = this.calculateComplexity(_ast, code);
    const _bugProbability = Math.min(1, _complexity.cyclomaticComplexity / 50);

    // Error handling coverage
    const _errorHandling =
      _functions.length > 0 ? _tryStatements.length / _functions.length : 0;

    // Null safety (check for null checks)
    const _nullChecks = this.astEngine.findNodes(
      _ast,
      (node) =>
        node.type === "BinaryExpression" &&
        (node.metadata?.operator === "===" ||
          node.metadata?.operator === "!==") &&
        (node.metadata?.right === "null" ||
          node.metadata?.right === "undefined"),
    );
    const _nullSafety = _nullChecks.length / Math.max(1, _functions.length);

    // Type strength (for TypeScript)
    const _typeAnnotations = this.astEngine.findNodes(
      _ast,
      (node) => node.metadata?.typeAnnotation !== undefined,
    );
    const _typeStrength =
      _typeAnnotations.length / Math.max(1, _functions.length);

    // Assertion density
    const _assertionDensity =
      _assertions.length / Math.max(1, code.split("\n").length / 100);

    return {
      _bugProbability,
      _errorHandling,
      _nullSafety,
      _typeStrength,
      _assertionDensity,
    };
  }

  private calculateSecurity(_ast: ASTNode, code: string): SecurityMetrics {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for common vulnerabilities
    vulnerabilities.push(
      ...this.checkSQLInjection(_ast, code).map((issue) => ({
        id: issue.id,
        type: "SQL Injection",
        severity: issue.severity as SecurityVulnerability["severity"],
        cwe: "CWE-89",
        description: issue.message,
        location: issue.location,
        remediation: "Use parameterized queries",
      })),
    );

    vulnerabilities.push(...this.checkXSS(_ast, code));
    vulnerabilities.push(...this.checkInsecureRandom(_ast, code));
    vulnerabilities.push(...this.checkHardcodedCredentials(_ast, code));

    // Calculate security score
    let securityScore = 100;
    vulnerabilities.forEach((vuln) => {
      switch (vuln.severity) {
        case "critical":
          securityScore -= 25;
          break;
        case "high":
          securityScore -= 15;
          break;
        case "medium":
          securityScore -= 10;
          break;
        case "low":
          securityScore -= 5;
          break;
      }
    });

    securityScore = Math.max(0, securityScore);

    // Input validation score
    const _inputValidation = this.calculateInputValidation(_ast, code);

    // Authentication/Authorization (simplified)
    const _authentication = code.includes("authenticate") ? 1 : 0;
    const _authorization = code.includes("authorize") ? 1 : 0;

    // Encryption usage
    const _encryption =
      code.includes("crypto") || code.includes("encrypt") ? 1 : 0;

    return {
      vulnerabilities,
      securityScore,
      _inputValidation,
      _authentication,
      _authorization,
      _encryption,
    };
  }

  private calculatePerformance(
    _ast: ASTNode,
    code: string,
  ): PerformanceMetrics {
    // Algorithmic _complexity
    const _loops = [
      ...this.astEngine.findNodesByType(_ast, "ForStatement"),
      ...this.astEngine.findNodesByType(_ast, "WhileStatement"),
      ...this.astEngine.findNodesByType(_ast, "DoStatement"),
    ];

    let algorithmicComplexity = 1;
    loops.forEach((loop) => {
      // Check for nested _loops
      const _nestedLoops =
        this.astEngine.findNodes(loop, (node) =>
          ["ForStatement", "WhileStatement", "DoStatement"].includes(node.type),
        ).length - 1;

      algorithmicComplexity *= Math.pow(2, _nestedLoops + 1);
    });

    // Memory leak risk
    const _memoryLeakRisk = this.calculateMemoryLeakRisk(_ast, code);

    // Async patterns
    const _asyncFunctions = this.astEngine.findNodes(
      _ast,
      (node) => node.metadata?.async === true,
    );
    const _asyncPatterns =
      _asyncFunctions.length /
      Math.max(
        1,
        this.astEngine.findNodesByType(_ast, "FunctionDeclaration").length,
      );

    // Cache utilization (simplified)
    const _cacheUtilization =
      code.includes("cache") || code.includes("memo") ? 1 : 0;

    // Query optimization (simplified)
    const _queryOptimization =
      code.includes("index") || code.includes("optimize") ? 1 : 0;

    return {
      algorithmicComplexity,
      _memoryLeakRisk,
      _asyncPatterns,
      _cacheUtilization,
      _queryOptimization,
    };
  }

  private calculateTestability(
    _ast: ASTNode,
    code: string,
  ): TestabilityMetrics {
    // Test coverage (would need actual test results)
    const _testCoverage = 0; // Placeholder

    // Mockability - check for dependency injection
    const _constructors = this.astEngine.findNodesByType(_ast, "Constructor");
    const _mockability =
      _constructors.length > 0
        ? _constructors.filter((c) => c.metadata?.parameters?.length > 0)
            .length / _constructors.length
        : 0;

    // Assertion count
    const _assertions = this.findAssertions(_ast);
    const _assertionCount = _assertions.length;

    // Test to code ratio (simplified)
    const _isTestFile =
      code.includes("describe") || code.includes("test") || code.includes("it");
    const _testToCodeRatio = _isTestFile ? 1 : 0;

    // Integration test coverage (placeholder)
    const _integrationTestCoverage = 0;

    return {
      _testCoverage,
      _mockability,
      _assertionCount,
      _testToCodeRatio,
      _integrationTestCoverage,
    };
  }

  private calculateDocumentation(
    _ast: ASTNode,
    code: string,
  ): DocumentationMetrics {
    const _lines = code.split("\n");
    const _commentLines = _lines.filter(
      (line) =>
        line.trim().startsWith("//") ||
        line.trim().startsWith("/*") ||
        line.trim().startsWith("*"),
    );

    // Comment density
    const _commentDensity =
      _lines.length > 0 ? _commentLines.length / _lines.length : 0;

    // API documentation (JSDoc/TSDoc)
    const _apiDocs = code.match(/\/\*\*[\s\S]*?\*\//g) || [];
    const _functions = this.astEngine.findNodesByType(
      _ast,
      "FunctionDeclaration",
    );
    const _apiDocumentation =
      _functions.length > 0 ? _apiDocs.length / _functions.length : 0;

    // Inline comments
    const _inlineComments =
      _lines.filter(
        (line) => line.includes("//") && !line.trim().startsWith("//"),
      ).length / Math.max(1, _lines.length);

    // README completeness (would need to check README file)
    const _readmeCompleteness = 0;

    // Example count
    const _exampleCount = (code.match(/example|Example|EXAMPLE/g) || []).length;

    return {
      _commentDensity,
      _apiDocumentation,
      _inlineComments,
      _readmeCompleteness,
      _exampleCount,
    };
  }

  private calculateComplexity(_ast: ASTNode, code: string): ComplexityMetrics {
    const _metrics = this.astEngine.calculateMetrics(_ast);
    const _functions = this.astEngine.findNodesByType(
      _ast,
      "FunctionDeclaration",
    );

    // Cyclomatic _complexity
    const _cyclomaticComplexity = _metrics.complexity;

    // Cognitive _complexity (simplified)
    const _cognitiveComplexity = this.calculateCognitiveComplexity(_ast);

    // Nesting depth
    const _nestingDepth = this.calculateMaxNestingDepth(_ast);

    // Parameter count
    const _maxParams = Math.max(
      0,
      ..._functions.map((f) => f.metadata?.parameters?.length || 0),
    );

    // Line and statement counts
    const _lineCount = code.split("\n").length;
    const _statementCount = this.astEngine.findNodes(_ast, (node) =>
      node.type.includes("Statement"),
    ).length;

    return {
      _cyclomaticComplexity,
      _cognitiveComplexity,
      _nestingDepth,
      parameterCount: _maxParams,
      _lineCount,
      _statementCount,
    };
  }

  private calculateDuplication(
    _ast: ASTNode,
    code: string,
  ): DuplicationMetrics {
    const _lines = code.split("\n");
    const _blocks = this.findDuplicateBlocks(_lines);

    const _duplicatedLines = _blocks.reduce(
      (sum, block) => sum + block.length,
      0,
    );
    const _duplicatedBlocks = _blocks.length;
    const _duplicatedFiles = 0; // Would need multi-file analysis
    const _duplicationPercentage =
      _lines.length > 0 ? (_duplicatedLines / _lines.length) * 100 : 0;

    // Similarity index (simplified)
    const _similarityIndex = this.calculateSimilarityIndex(_blocks, _lines);

    return {
      _duplicatedLines,
      _duplicatedBlocks,
      _duplicatedFiles,
      _duplicationPercentage,
      _similarityIndex,
    };
  }

  private checkHighComplexity(_ast: ASTNode, code: string): QualityIssue[] {
    const _issues: QualityIssue[] = [];
    const _functions = this.astEngine.findNodesByType(
      _ast,
      "FunctionDeclaration",
    );
    const _threshold = this.config.thresholds?.maxComplexity || 10;

    functions.forEach((func) => {
      const _metrics = this.astEngine.calculateMetrics(func);
      if (_metrics.complexity > _threshold) {
        issues.push({
          id: `_complexity-${func.id}`,
          type: "_complexity",
          severity: _metrics.complexity > _threshold * 2 ? "error" : "warning",
          category: "maintainability",
          message: `Function "${func.name}" has cyclomatic _complexity of ${_metrics.complexity} (_threshold: ${_threshold})`,
          location: this.getLocation(func, code),
          suggestion:
            "Consider breaking this function into smaller, more focused _functions",
          autoFixable: false,
        });
      }
    });

    return _issues;
  }

  private checkSQLInjection(_ast: ASTNode, code: string): QualityIssue[] {
    const _issues: QualityIssue[] = [];
    const _templates = this.astEngine.findNodesByType(
      _ast,
      "TemplateExpression",
    );

    templates.forEach((template) => {
      const _content = code.substring(template.pos, template.end).toLowerCase();
      if (
        _content.includes("select") ||
        _content.includes("insert") ||
        _content.includes("update") ||
        _content.includes("delete")
      ) {
        issues.push({
          id: `sql-injection-${template.id}`,
          type: "security",
          severity: "critical",
          category: "security",
          message: "Potential SQL injection vulnerability detected",
          location: this.getLocation(template, code),
          suggestion: "Use parameterized queries or prepared statements",
          autoFixable: false,
        });
      }
    });

    return _issues;
  }

  private checkInefficientLoops(_ast: ASTNode, code: string): QualityIssue[] {
    const _issues: QualityIssue[] = [];
    const _loops = this.astEngine.findNodesByType(_ast, "ForStatement");

    loops.forEach((loop) => {
      // Check for array operations inside _loops
      const _arrayOps = this.astEngine.findNodes(
        loop,
        (node) =>
          node.type === "CallExpression" &&
          ["push", "unshift", "splice"].includes(node.metadata?.method || ""),
      );

      if (_arrayOps.length > 0) {
        issues.push({
          id: `inefficient-loop-${loop.id}`,
          type: "performance",
          severity: "warning",
          category: "performance",
          message: "Array mutation inside loop detected",
          location: this.getLocation(loop, code),
          suggestion:
            "Consider using array _methods like map, filter, or reduce",
          autoFixable: true,
        });
      }
    });

    return _issues;
  }

  private checkMissingDocumentation(
    _ast: ASTNode,
    code: string,
  ): QualityIssue[] {
    const _issues: QualityIssue[] = [];
    const _publicFunctions = this.astEngine.findNodes(
      _ast,
      (node) =>
        node.type === "FunctionDeclaration" && node.metadata?.exported === true,
    );

    publicFunctions.forEach((func) => {
      const _lines = code.split("\n");
      const _funcLine = this.getLocation(func, code).line;

      // Check if there's a JSDoc comment before the function
      if (_funcLine > 0 && !_lines[_funcLine - 2]?.includes("/**")) {
        issues.push({
          id: `missing-docs-${func.id}`,
          type: "documentation",
          severity: "info",
          category: "documentation",
          message: `Public function "${func.name}" lacks documentation`,
          location: this.getLocation(func, code),
          suggestion: "Add JSDoc/TSDoc comments to describe the function",
          autoFixable: true,
        });
      }
    });

    return _issues;
  }

  private checkXSS(_ast: ASTNode, code: string): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for innerHTML usage
    const _innerHTMLUsage = this.astEngine.findNodes(
      _ast,
      (node) =>
        node.type === "PropertyAccessExpression" &&
        node.metadata?.property === "innerHTML",
    );

    innerHTMLUsage.forEach((usage) => {
      vulnerabilities.push({
        id: `xss-${usage.id}`,
        type: "Cross-Site Scripting",
        severity: "high",
        cwe: "CWE-79",
        description: "Direct innerHTML manipulation can lead to XSS",
        location: this.getLocation(usage, code),
        remediation: "Use textContent or sanitize HTML input",
      });
    });

    return vulnerabilities;
  }

  private checkInsecureRandom(
    _ast: ASTNode,
    code: string,
  ): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for Math.random() in security-sensitive contexts
    const _randomUsage = this.astEngine.findNodes(
      _ast,
      (node) =>
        node.type === "CallExpression" &&
        node.metadata?.function === "Math.random",
    );

    randomUsage.forEach((usage) => {
      const _context = code.substring(
        Math.max(0, usage.pos - 50),
        usage.end + 50,
      );
      if (
        _context.includes("token") ||
        _context.includes("password") ||
        _context.includes("key") ||
        _context.includes("secret")
      ) {
        vulnerabilities.push({
          id: `insecure-random-${usage.id}`,
          type: "Insecure Randomness",
          severity: "medium",
          cwe: "CWE-330",
          description: "Math.random() is not cryptographically secure",
          location: this.getLocation(usage, code),
          remediation:
            "Use crypto.getRandomValues() or similar secure random generator",
        });
      }
    });

    return vulnerabilities;
  }

  private checkHardcodedCredentials(
    _ast: ASTNode,
    code: string,
  ): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    const _strings = this.astEngine.findNodesByType(_ast, "StringLiteral");

    strings.forEach((str) => {
      const _value = str.metadata?._value || "";
      // Simple check for potential credentials
      if (_value.length > 10 && /^[a-zA-Z0-9+/=]+$/.test(_value)) {
        const _context = code.substring(Math.max(0, str.pos - 50), str.end);
        if (
          _context.includes("password") ||
          _context.includes("apiKey") ||
          _context.includes("secret") ||
          _context.includes("token")
        ) {
          vulnerabilities.push({
            id: `hardcoded-credential-${str.id}`,
            type: "Hardcoded Credentials",
            severity: "high",
            cwe: "CWE-798",
            description: "Potential hardcoded credential detected",
            location: this.getLocation(str, code),
            remediation:
              "Use environment variables or secure configuration management",
          });
        }
      }
    });

    return vulnerabilities;
  }

  private calculateInputValidation(_ast: ASTNode, code: string): number {
    // Check for validation patterns
    const _validationPatterns = [
      "validate",
      "sanitize",
      "escape",
      "check",
      "verify",
      "isValid",
      "test",
      "match",
    ];

    let validationCount = 0;
    validationPatterns.forEach((pattern) => {
      if (code.includes(pattern)) {
        validationCount++;
      }
    });

    return Math.min(1, validationCount / 5);
  }

  private calculateMemoryLeakRisk(_ast: ASTNode, code: string): number {
    let risk = 0;

    // Check for event listeners without cleanup
    if (
      code.includes("addEventListener") &&
      !code.includes("removeEventListener")
    ) {
      risk += 0.3;
    }

    // Check for timers without cleanup
    if (
      (code.includes("setInterval") || code.includes("setTimeout")) &&
      !code.includes("clearInterval") &&
      !code.includes("clearTimeout")
    ) {
      risk += 0.3;
    }

    // Check for circular references
    const _assignments = this.astEngine.findNodesByType(
      _ast,
      "AssignmentExpression",
    );
    assignments.forEach((assignment) => {
      const _left = code.substring(assignment.pos, assignment.pos + 20);
      const _right = code.substring(assignment.end - 20, assignment.end);
      if (
        _left.includes(".") &&
        _right.includes(".") &&
        _left.includes(_right.split(".")[0])
      ) {
        risk += 0.2;
      }
    });

    return Math.min(1, risk);
  }

  private findAssertions(_ast: ASTNode): ASTNode[] {
    return this.astEngine.findNodes(
      _ast,
      (node) =>
        node.type === "CallExpression" &&
        (node.metadata?.function?.includes("assert") ||
          node.metadata?.function?.includes("expect") ||
          node.metadata?.function?.includes("should")),
    );
  }

  private calculateModularity(_ast: ASTNode): number {
    const _classes = this.astEngine.findNodesByType(_ast, "ClassDeclaration");
    const _functions = this.astEngine.findNodesByType(
      _ast,
      "FunctionDeclaration",
    );
    const _modules = _classes.length + _functions.length;

    if (_modules === 0) return 0;

    // Check for single responsibility
    const _avgMethodsPerClass =
      _classes.length > 0
        ? this.astEngine.findNodesByType(_ast, "MethodDeclaration").length /
          _classes.length
        : 0;

    // Good _modularity: many small _modules
    const _modularity =
      Math.min(1, _modules / 10) * (1 - Math.min(1, _avgMethodsPerClass / 10));

    return _modularity;
  }

  private calculateCohesion(_ast: ASTNode): number {
    // Simplified _cohesion calculation
    // High _cohesion = _methods in a class work with same data
    const _classes = this.astEngine.findNodesByType(_ast, "ClassDeclaration");

    if (_classes.length === 0) return 1;

    let totalCohesion = 0;
    classes.forEach((cls) => {
      const _methods = this.astEngine.findNodesByType(cls, "MethodDeclaration");
      const _properties = this.astEngine.findNodesByType(
        cls,
        "PropertyDeclaration",
      );

      if (_methods.length === 0 || _properties.length === 0) {
        totalCohesion += 1;
        return;
      }

      // Check how many _methods use each property
      let usageCount = 0;
      methods.forEach((method) => {
        properties.forEach((prop) => {
          if (prop.name && method.metadata?.code?.includes(prop.name)) {
            usageCount++;
          }
        });
      });

      const _maxUsage = _methods.length * _properties.length;
      const _cohesion = _maxUsage > 0 ? usageCount / _maxUsage : 0;
      totalCohesion += _cohesion;
    });

    return totalCohesion / _classes.length;
  }

  private calculateCognitiveComplexity(_ast: ASTNode): number {
    let _complexity = 0;

    const _traverse = (_node: ASTNode, depth: number = 0) => {
      // Add _complexity for control flow
      if (
        [
          "IfStatement",
          "SwitchStatement",
          "ForStatement",
          "WhileStatement",
          "DoStatement",
        ].includes(_node.type)
      ) {
        _complexity += 1 + depth; // Nesting increases _complexity
      }

      // Add _complexity for logical operators
      if (
        _node.type === "BinaryExpression" &&
        ["&&", "||"].includes(_node.metadata?.operator || "")
      ) {
        _complexity += 1;
      }

      // Recursively _traverse children
      node.children.forEach((child) => {
        const _newDepth = [
          "IfStatement",
          "ForStatement",
          "WhileStatement",
        ].includes(_node.type)
          ? depth + 1
          : depth;
        _traverse(child, _newDepth);
      });
    };

    _traverse(_ast);
    return _complexity;
  }

  private calculateMaxNestingDepth(_ast: ASTNode): number {
    let maxDepth = 0;

    const _traverse = (_node: ASTNode, depth: number = 0) => {
      maxDepth = Math.max(maxDepth, depth);

      const _isNestingNode = [
        "IfStatement",
        "ForStatement",
        "WhileStatement",
        "DoStatement",
        "TryStatement",
      ].includes(_node.type);

      node.children.forEach((child) => {
        _traverse(child, _isNestingNode ? depth + 1 : depth);
      });
    };

    _traverse(_ast);
    return maxDepth;
  }

  private findDuplicateBlocks(_lines: string[]): string[][] {
    const _blocks: string[][] = [];
    const _minBlockSize = 5;

    for (let i = 0; i < lines.length - _minBlockSize; i++) {
      for (let j = i + _minBlockSize; j < lines.length - _minBlockSize; j++) {
        if (_lines[i] === _lines[j] && _lines[i].trim() !== "") {
          // Found potential duplicate block
          const block: string[] = [_lines[i]];
          let k = 1;

          while (
            i + k < lines.length &&
            j + k < lines.length &&
            _lines[i + k] === _lines[j + k] &&
            k < _minBlockSize * 2
          ) {
            block.push(_lines[i + k]);
            k++;
          }

          if (block.length >= _minBlockSize) {
            blocks.push(block);
            j += block.length; // Skip past this block
          }
        }
      }
    }

    return _blocks;
  }

  private calculateSimilarityIndex(
    _blocks: string[][],
    _lines: string[],
  ): number {
    if (blocks.length === 0) return 0;

    // Calculate average _similarity between _blocks
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < blocks.length - 1; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const _similarity = this.calculateBlockSimilarity(
          _blocks[i],
          _blocks[j],
        );
        totalSimilarity += _similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculateBlockSimilarity(
    _block1: string[],
    block2: string[],
  ): number {
    const _set1 = new Set(_block1);
    const _set2 = new Set(block2);

    const _intersection = new Set([..._set1].filter((x) => _set2.has(x)));
    const _union = new Set([..._set1, ..._set2]);

    return _union.size > 0 ? _intersection.size / _union.size : 0;
  }

  private getLocation(_node: ASTNode, code: string): IssueLocation {
    const _lines = code.split("\n");
    let currentPos = 0;

    for (let i = 0; i < _lines.length; i++) {
      const _lineLength = _lines[i].length + 1;

      if (currentPos <= _node.pos && _node.pos < currentPos + _lineLength) {
        return {
          file: _node.metadata?.fileName || "unknown",
          line: i + 1,
          column: _node.pos - currentPos + 1,
          endLine: i + 1,
          endColumn: _node.end - currentPos + 1,
        };
      }

      currentPos += _lineLength;
    }

    return {
      file: _node.metadata?.fileName || "unknown",
      line: 1,
      column: 1,
    };
  }

  private getGrade(score: number): QualityScore["_grade"] {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  private getTrend(fileName: string): QualityScore["_trend"] {
    const _history = this._history.get(fileName) || [];

    if (_history.length < 2) return "stable";

    const _recent = _history.slice(-5);
    const _scores = _recent.map((m) => m.overall.score);

    const _avgRecent = _scores.slice(-2).reduce((a, b) => a + b, 0) / 2;
    const _avgPrevious =
      _scores.slice(0, -2).reduce((a, b) => a + b, 0) /
      Math.max(1, _scores.length - 2);

    if (_avgRecent > _avgPrevious + 5) return "improving";
    if (_avgRecent < _avgPrevious - 5) return "declining";
    return "stable";
  }

  generateReport(_metrics: QualityMetrics): string {
    const report: string[] = [
      "# Code Quality Report",
      "",
      `## Overall Score: ${_metrics.overall.score}/100 (${_metrics.overall.grade})`,
      `Trend: ${_metrics.overall.trend}`,
      "",
      "## Metrics Summary",
      "",
      "### Maintainability",
      `- Maintainability Index: ${_metrics.maintainability.maintainabilityIndex.toFixed(1)}`,
      `- Technical Debt: ${_metrics.maintainability.technicalDebt} hours`,
      `- Modularity: ${(_metrics.maintainability.modularity * 100).toFixed(1)}%`,
      "",
      "### Reliability",
      `- Bug Probability: ${(_metrics.reliability.bugProbability * 100).toFixed(1)}%`,
      `- Error Handling: ${(_metrics.reliability.errorHandling * 100).toFixed(1)}%`,
      `- Type Strength: ${(_metrics.reliability.typeStrength * 100).toFixed(1)}%`,
      "",
      "### Security",
      `- Security Score: ${_metrics.security.securityScore}/100`,
      `- Vulnerabilities: ${_metrics.security.vulnerabilities.length}`,
      "",
      "### Performance",
      `- Algorithmic Complexity: O(n^${Math.log2(_metrics.performance.algorithmicComplexity).toFixed(0)})`,
      `- Memory Leak Risk: ${(_metrics.performance.memoryLeakRisk * 100).toFixed(1)}%`,
      "",
      "### Complexity",
      `- Cyclomatic: ${_metrics.complexity.cyclomaticComplexity}`,
      `- Cognitive: ${_metrics.complexity.cognitiveComplexity}`,
      `- Max Nesting: ${_metrics.complexity.nestingDepth}`,
      "",
      "### Issues",
      `- Critical: ${_metrics.overall.issues.filter((i) => i.severity === "critical").length}`,
      `- Errors: ${_metrics.overall.issues.filter((i) => i.severity === "error").length}`,
      `- Warnings: ${_metrics.overall.issues.filter((i) => i.severity === "warning").length}`,
      `- Info: ${_metrics.overall.issues.filter((i) => i.severity === "info").length}`,
    ];

    return report.join("\n");
  }
}

export const _qualityAnalyzer = new CodeQualityAnalyzer();
