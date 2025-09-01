/**
 * Intelligent Refactoring System
 * MARIA v2.1.9 - AI-powered code refactoring
 */

import { EventEmitter } from "node:events";
import * as ts from "typescript";
import { ASTEngine, ASTNode } from "./_ast-engine";

export interface RefactorSuggestion {
  id: string;
  type: RefactorType;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  location: CodeLocation;
  impact: RefactorImpact;
  autoFixable: boolean;
  suggestedCode?: string;
}

export type RefactorType =
  | "extract-method"
  | "extract-variable"
  | "inline-variable"
  | "rename-symbol"
  | "convert-to-async"
  | "simplify-conditional"
  | "remove-dead-code"
  | "optimize-imports"
  | "convert-to-arrow"
  | "destructure-assignment"
  | "combine-declarations"
  | "extract-interface"
  | "introduce-parameter-_object"
  | "replace-magic-number"
  | "extract-constant";

export interface CodeLocation {
  file: string;
  _startLine: number;
  _endLine: number;
  startColumn: number;
  endColumn: number;
}

export interface RefactorImpact {
  affectedFiles: string[];
  affectedLines: number;
  complexity: "low" | "medium" | "high";
  testsCoverage: boolean;
  breakingChange: boolean;
}

export interface RefactorContext {
  projectRoot: string;
  tsConfig?: ts.CompilerOptions;
  eslintConfig?: any;
  prettierConfig?: any;
  targetVersion?: string;
}

export interface RefactorResult {
  success: boolean;
  originalCode: string;
  _refactoredCode: string;
  changes: CodeChange[];
  rollbackId: string;
  _metrics: RefactorMetrics;
}

export interface CodeChange {
  type: "add" | "remove" | "modify";
  location: CodeLocation;
  before: string;
  after: string;
}

export interface RefactorMetrics {
  complexityBefore: number;
  complexityAfter: number;
  linesBefore: number;
  linesAfter: number;
  performanceImpact: number;
  readabilityScore: number;
}

export class IntelligentRefactor extends EventEmitter {
  private astEngine: ASTEngine;
  private _suggestions: Map<string, RefactorSuggestion[]> = new Map();
  private history: RefactorResult[] = [];
  private patterns: Map<RefactorType, RefactorPattern> = new Map();

  constructor() {
    super();
    this.astEngine = new ASTEngine();
    this.registerPatterns();
  }

  private registerPatterns(): void {
    // Register refactoring patterns
    this.patterns.set("extract-method", {
      detect: this.detectExtractMethod.bind(this),
      apply: this.applyExtractMethod.bind(this),
    });

    this.patterns.set("simplify-conditional", {
      detect: this.detectComplexConditional.bind(this),
      apply: this.applySimplifyConditional.bind(this),
    });

    this.patterns.set("remove-dead-code", {
      detect: this.detectDeadCode.bind(this),
      apply: this.applyRemoveDeadCode.bind(this),
    });

    this.patterns.set("convert-to-async", {
      detect: this.detectPromiseChain.bind(this),
      apply: this.applyConvertToAsync.bind(this),
    });

    this.patterns.set("destructure-assignment", {
      detect: this.detectDestructureOpportunity.bind(this),
      apply: this.applyDestructuring.bind(this),
    });
  }

  async analyzeCode(
    _code: string,
    _context?: RefactorContext,
  ): Promise<RefactorSuggestion[]> {
    const _ast = this.astEngine.parseCode(_code);
    const _suggestions: RefactorSuggestion[] = [];

    // Run all _pattern detectors
    for (const [_type, _pattern] of this.patterns) {
      const _detected = pattern.detect(_ast, _code);
      suggestions.push(..._detected);
    }

    // Additional analysis
    _suggestions.push(...this.detectCodeSmells(_ast, _code));
    _suggestions.push(...this.detectPerformanceIssues(_ast, _code));
    _suggestions.push(...this.detectSecurityIssues(_ast, _code));

    // Sort by severity and impact
    suggestions.sort((a, b) => {
      const _severityOrder = { critical: 0, warning: 1, info: 2 };
      return _severityOrder[a.severity] - _severityOrder[b.severity];
    });

    this._suggestions.set(_code, _suggestions);
    this.emit("analysis:complete", _suggestions);

    return _suggestions;
  }

  private detectExtractMethod(
    _ast: ASTNode,
    code: string,
  ): RefactorSuggestion[] {
    const _suggestions: RefactorSuggestion[] = [];
    const _functions = this.astEngine.findNodesByType(
      _ast,
      "FunctionDeclaration",
    );

    functions.forEach((func) => {
      const _metrics = this.astEngine.calculateMetrics(func);

      // Check for long methods
      if (_metrics.linesOfCode > 20) {
        suggestions.push({
          id: `extract-method-${func.id}`,
          type: "extract-method",
          severity: "warning",
          title: "Long method _detected",
          description: `Method "${func.name}" has ${_metrics.linesOfCode} lines. Consider extracting smaller methods.`,
          location: this.getLocation(func, code),
          impact: {
            affectedFiles: [func.metadata?.fileName || "unknown"],
            affectedLines: _metrics.linesOfCode,
            complexity: "medium",
            testsCoverage: false,
            breakingChange: false,
          },
          autoFixable: true,
        });
      }

      // Check for high complexity
      if (_metrics.complexity > 10) {
        suggestions.push({
          id: `complex-method-${func.id}`,
          type: "extract-method",
          severity: "critical",
          title: "High complexity method",
          description: `Method "${func.name}" has cyclomatic complexity of ${_metrics.complexity}. Split into smaller functions.`,
          location: this.getLocation(func, code),
          impact: {
            affectedFiles: [func.metadata?.fileName || "unknown"],
            affectedLines: _metrics.linesOfCode,
            complexity: "high",
            testsCoverage: false,
            breakingChange: false,
          },
          autoFixable: true,
        });
      }
    });

    return _suggestions;
  }

  private detectComplexConditional(
    _ast: ASTNode,
    code: string,
  ): RefactorSuggestion[] {
    const _suggestions: RefactorSuggestion[] = [];
    const _conditionals = this.astEngine.findNodesByType(_ast, "IfStatement");

    conditionals.forEach((cond) => {
      // Count nested if statements
      const _nestedIfs =
        this.astEngine.findNodesByType(cond, "IfStatement").length - 1;

      if (_nestedIfs > 2) {
        suggestions.push({
          id: `complex-conditional-${cond.id}`,
          type: "simplify-conditional",
          severity: "warning",
          title: "Complex nested _conditionals",
          description: `Found ${_nestedIfs} levels of nested if statements. Consider using early _returns or switch statements.`,
          location: this.getLocation(cond, code),
          impact: {
            affectedFiles: [cond.metadata?.fileName || "unknown"],
            affectedLines: cond.end - cond.pos,
            complexity: "medium",
            testsCoverage: false,
            breakingChange: false,
          },
          autoFixable: true,
          suggestedCode: this.suggestSimplifiedConditional(cond, code),
        });
      }
    });

    return _suggestions;
  }

  private detectDeadCode(_ast: ASTNode, code: string): RefactorSuggestion[] {
    const _suggestions: RefactorSuggestion[] = [];

    // Find unused _variables
    const _variables = this.astEngine.findNodesByType(
      _ast,
      "VariableDeclaration",
    );
    const _identifiers = this.astEngine.findNodesByType(_ast, "Identifier");

    const _usedNames = new Set(
      _identifiers.map((id) => id.name).filter(Boolean),
    );

    variables.forEach((varDecl) => {
      if (varDecl.name && !_usedNames.has(varDecl.name)) {
        suggestions.push({
          id: `unused-var-${varDecl.id}`,
          type: "remove-dead-code",
          severity: "info",
          title: "Unused variable",
          description: `Variable "${varDecl.name}" is declared but never used.`,
          location: this.getLocation(varDecl, code),
          impact: {
            affectedFiles: [varDecl.metadata?.fileName || "unknown"],
            affectedLines: 1,
            complexity: "low",
            testsCoverage: false,
            breakingChange: false,
          },
          autoFixable: true,
        });
      }
    });

    // Find unreachable code after return statements
    const _returns = this.astEngine.findNodesByType(_ast, "ReturnStatement");
    returns.forEach((ret) => {
      if (ret.parent && ret.parent.children) {
        const _index = ret.parent.children.indexOf(ret);
        if (_index < ret.parent.children.length - 1) {
          suggestions.push({
            id: `unreachable-${ret.id}`,
            type: "remove-dead-code",
            severity: "warning",
            title: "Unreachable code",
            description: "Code after return statement will never execute.",
            location: this.getLocation(ret.parent.children[_index + 1], code),
            impact: {
              affectedFiles: [ret.metadata?.fileName || "unknown"],
              affectedLines: 1,
              complexity: "low",
              testsCoverage: false,
              breakingChange: false,
            },
            autoFixable: true,
          });
        }
      }
    });

    return _suggestions;
  }

  private detectPromiseChain(
    _ast: ASTNode,
    code: string,
  ): RefactorSuggestion[] {
    const _suggestions: RefactorSuggestion[] = [];
    const _calls = this.astEngine.findNodesByType(_ast, "CallExpression");

    calls.forEach((call) => {
      // Look for .then() chains
      if (call.metadata?.method === "then") {
        const _chainLength = this.countPromiseChain(call);
        if (_chainLength > 2) {
          suggestions.push({
            id: `promise-chain-${call.id}`,
            type: "convert-to-async",
            severity: "info",
            title: "Long Promise chain",
            description: `Promise chain with ${_chainLength} .then() calls. Consider using async/await.`,
            location: this.getLocation(call, code),
            impact: {
              affectedFiles: [call.metadata?.fileName || "unknown"],
              affectedLines: call.end - call.pos,
              complexity: "low",
              testsCoverage: false,
              breakingChange: false,
            },
            autoFixable: true,
            suggestedCode: this.suggestAsyncAwait(call, code),
          });
        }
      }
    });

    return _suggestions;
  }

  private detectDestructureOpportunity(
    _ast: ASTNode,
    code: string,
  ): RefactorSuggestion[] {
    const _suggestions: RefactorSuggestion[] = [];
    const _assignments = this.astEngine.findNodesByType(
      _ast,
      "VariableDeclaration",
    );

    assignments.forEach((assign) => {
      // Look for multiple _property _accesses from same _object
      if (assign.parent && assign.parent.children) {
        const _siblings = assign.parent.children;
        const _objectAccesses = this.findObjectPropertyAccesses(_siblings);

        objectAccesses.forEach((properties, objectName) => {
          if (properties.size > 2) {
            suggestions.push({
              id: `destructure-${assign.id}`,
              type: "destructure-assignment",
              severity: "info",
              title: "Destructuring opportunity",
              description: `Multiple properties accessed from "${objectName}". Consider destructuring.`,
              location: this.getLocation(assign, code),
              impact: {
                affectedFiles: [assign.metadata?.fileName || "unknown"],
                affectedLines: properties.size,
                complexity: "low",
                testsCoverage: false,
                breakingChange: false,
              },
              autoFixable: true,
              suggestedCode: this.suggestDestructuring(
                objectName,
                properties,
                code,
              ),
            });
          }
        });
      }
    });

    return _suggestions;
  }

  private detectCodeSmells(_ast: ASTNode, code: string): RefactorSuggestion[] {
    const _suggestions: RefactorSuggestion[] = [];

    // Magic numbers
    const _literals = this.astEngine.findNodesByType(_ast, "NumericLiteral");
    literals.forEach((lit) => {
      const _value = lit.metadata?._value;
      if (_value && _value !== 0 && _value !== 1 && _value !== -1) {
        suggestions.push({
          id: `magic-number-${lit.id}`,
          type: "replace-magic-number",
          severity: "info",
          title: "Magic number _detected",
          description: `Magic number ${_value} should be extracted to a named constant.`,
          location: this.getLocation(lit, code),
          impact: {
            affectedFiles: [lit.metadata?.fileName || "unknown"],
            affectedLines: 1,
            complexity: "low",
            testsCoverage: false,
            breakingChange: false,
          },
          autoFixable: true,
        });
      }
    });

    // Long parameter lists
    const _functions = this.astEngine.findNodesByType(
      _ast,
      "FunctionDeclaration",
    );
    functions.forEach((func) => {
      const _paramCount = func.metadata?.parameters?.length || 0;
      if (_paramCount > 4) {
        suggestions.push({
          id: `long-params-${func.id}`,
          type: "introduce-parameter-_object",
          severity: "warning",
          title: "Too many parameters",
          description: `Function "${func.name}" has ${_paramCount} parameters. Consider using a parameter object.`,
          location: this.getLocation(func, code),
          impact: {
            affectedFiles: [func.metadata?.fileName || "unknown"],
            affectedLines: 1,
            complexity: "medium",
            testsCoverage: false,
            breakingChange: true,
          },
          autoFixable: false,
        });
      }
    });

    return _suggestions;
  }

  private detectPerformanceIssues(
    _ast: ASTNode,
    code: string,
  ): RefactorSuggestion[] {
    const _suggestions: RefactorSuggestion[] = [];

    // Inefficient array operations in _loops
    const _loops = [
      ...this.astEngine.findNodesByType(_ast, "ForStatement"),
      ...this.astEngine.findNodesByType(_ast, "WhileStatement"),
      ...this.astEngine.findNodesByType(_ast, "DoStatement"),
    ];

    loops.forEach((loop) => {
      const _arrayMethods = this.astEngine.findNodes(
        loop,
        (node) =>
          node.type === "CallExpression" &&
          ["map", "filter", "reduce", "forEach"].includes(
            node.metadata?.method || "",
          ),
      );

      if (_arrayMethods.length > 1) {
        suggestions.push({
          id: `chain-array-ops-${loop.id}`,
          type: "extract-variable",
          severity: "warning",
          title: "Multiple array operations in loop",
          description:
            "Consider chaining array operations or using a single loop.",
          location: this.getLocation(loop, code),
          impact: {
            affectedFiles: [loop.metadata?.fileName || "unknown"],
            affectedLines: loop.end - loop.pos,
            complexity: "medium",
            testsCoverage: false,
            breakingChange: false,
          },
          autoFixable: true,
        });
      }
    });

    return _suggestions;
  }

  private detectSecurityIssues(
    _ast: ASTNode,
    code: string,
  ): RefactorSuggestion[] {
    const _suggestions: RefactorSuggestion[] = [];

    // SQL injection risks
    const _templates = this.astEngine.findNodesByType(
      _ast,
      "TemplateExpression",
    );
    templates.forEach((template) => {
      const _content = code.substring(template.pos, template.end).toLowerCase();
      if (
        _content.includes("select") ||
        _content.includes("insert") ||
        _content.includes("update")
      ) {
        suggestions.push({
          id: `sql-injection-${template.id}`,
          type: "extract-variable",
          severity: "critical",
          title: "Potential SQL injection",
          description:
            "SQL query with string interpolation detected. Use parameterized queries.",
          location: this.getLocation(template, code),
          impact: {
            affectedFiles: [template.metadata?.fileName || "unknown"],
            affectedLines: 1,
            complexity: "high",
            testsCoverage: false,
            breakingChange: false,
          },
          autoFixable: false,
        });
      }
    });

    // eval() usage
    const _calls = this.astEngine.findNodesByType(_ast, "CallExpression");
    calls.forEach((call) => {
      if (call.metadata?.function === "eval") {
        suggestions.push({
          id: `eval-usage-${call.id}`,
          type: "remove-dead-code",
          severity: "critical",
          title: "eval() usage _detected",
          description:
            "eval() is dangerous and should be avoided. Find an alternative approach.",
          location: this.getLocation(call, code),
          impact: {
            affectedFiles: [call.metadata?.fileName || "unknown"],
            affectedLines: 1,
            complexity: "high",
            testsCoverage: false,
            breakingChange: true,
          },
          autoFixable: false,
        });
      }
    });

    return _suggestions;
  }

  async applyRefactoring(
    code: string,
    suggestionId: string,
    options?: unknown,
  ): Promise<RefactorResult> {
    const _suggestions = this._suggestions.get(code) || [];
    const _suggestion = _suggestions.find((s) => s.id === suggestionId);

    if (!_suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`);
    }

    const _pattern = this.patterns.get(_suggestion.type);
    if (!_pattern) {
      throw new Error(`No _pattern registered for ${_suggestion.type}`);
    }

    const _ast = this.astEngine.parseCode(code);
    const _result = _pattern(...code, _suggestion, options);

    // Store in history for rollback
    this.history.push(_result);

    this.emit("refactor:applied", _result);
    return _result;
  }

  private applyExtractMethod(
    _ast: ASTNode,
    code: string,
    _suggestion: RefactorSuggestion,
    options?: unknown,
  ): RefactorResult {
    const _functionName = options?._functionName || "extractedFunction";
    const _startLine = _suggestion.location._startLine;
    const _endLine = _suggestion.location._endLine;

    const _refactoredCode = this.astEngine.extractFunction(
      code,
      _startLine,
      _endLine,
      _functionName,
    );

    return {
      success: true,
      originalCode: code,
      _refactoredCode,
      changes: [
        {
          type: "modify",
          location: _suggestion.location,
          before: code
            .split("\n")
            .slice(_startLine - 1, _endLine)
            .join("\n"),
          after: `${_functionName}();`,
        },
      ],
      rollbackId: `rollback-${Date.now()}`,
      _metrics: this.calculateMetrics(code, _refactoredCode),
    };
  }

  private applySimplifyConditional(
    _ast: ASTNode,
    code: string,
    _suggestion: RefactorSuggestion,
    _options?: unknown,
  ): RefactorResult {
    // Simplified implementation
    const _refactoredCode = _suggestion.suggestedCode || code;

    return {
      success: true,
      originalCode: code,
      _refactoredCode,
      changes: [],
      rollbackId: `rollback-${Date.now()}`,
      _metrics: this.calculateMetrics(code, _refactoredCode),
    };
  }

  private applyRemoveDeadCode(
    _ast: ASTNode,
    code: string,
    _suggestion: RefactorSuggestion,
    _options?: unknown,
  ): RefactorResult {
    const _lines = code.split("\n");
    const { _startLine, _endLine } = _suggestion.location;

    // Remove the dead code _lines
    lines.splice(_startLine - 1, _endLine - _startLine + 1);
    const _refactoredCode = _lines.join("\n");

    return {
      success: true,
      originalCode: code,
      _refactoredCode,
      changes: [
        {
          type: "remove",
          location: _suggestion.location,
          before: code
            .split("\n")
            .slice(_startLine - 1, _endLine)
            .join("\n"),
          after: "",
        },
      ],
      rollbackId: `rollback-${Date.now()}`,
      _metrics: this.calculateMetrics(code, _refactoredCode),
    };
  }

  private applyConvertToAsync(
    _ast: ASTNode,
    code: string,
    _suggestion: RefactorSuggestion,
    _options?: unknown,
  ): RefactorResult {
    const _refactoredCode = _suggestion.suggestedCode || code;

    return {
      success: true,
      originalCode: code,
      _refactoredCode,
      changes: [],
      rollbackId: `rollback-${Date.now()}`,
      _metrics: this.calculateMetrics(code, _refactoredCode),
    };
  }

  private applyDestructuring(
    _ast: ASTNode,
    code: string,
    _suggestion: RefactorSuggestion,
    _options?: unknown,
  ): RefactorResult {
    const _refactoredCode = _suggestion.suggestedCode || code;

    return {
      success: true,
      originalCode: code,
      _refactoredCode,
      changes: [],
      rollbackId: `rollback-${Date.now()}`,
      _metrics: this.calculateMetrics(code, _refactoredCode),
    };
  }

  private getLocation(_node: ASTNode, code: string): CodeLocation {
    const _lines = code.split("\n");
    let currentPos = 0;
    let _startLine = 1;
    let _endLine = 1;
    let startColumn = 1;
    let endColumn = 1;

    for (let i = 0; i < _lines.length; i++) {
      const _lineLength = _lines[i].length + 1; // +1 for newline

      if (currentPos <= _node.pos && _node.pos < currentPos + _lineLength) {
        _startLine = i + 1;
        startColumn = _node.pos - currentPos + 1;
      }

      if (currentPos <= _node.end && _node.end < currentPos + _lineLength) {
        _endLine = i + 1;
        endColumn = _node.end - currentPos + 1;
        break;
      }

      currentPos += _lineLength;
    }

    return {
      file: _node.metadata?.fileName || "unknown",
      _startLine,
      _endLine,
      startColumn,
      endColumn,
    };
  }

  private countPromiseChain(node: ASTNode): number {
    let count = 0;
    let current = node;

    while (current && current.metadata?.method === "then") {
      count++;
      current = current.parent!;
    }

    return count;
  }

  private findObjectPropertyAccesses(
    nodes: ASTNode[],
  ): Map<string, Set<string>> {
    const _accesses = new Map<string, Set<string>>();

    nodes.forEach((node) => {
      if (node.type === "PropertyAccessExpression") {
        const _object = node.metadata?._object;
        const _property = node.metadata?._property;

        if (_object && _property) {
          if (!_accesses.has(_object)) {
            accesses.set(_object, new Set());
          }
          accesses.get(_object)!.add(_property);
        }
      }
    });

    return _accesses;
  }

  private suggestSimplifiedConditional(_node: ASTNode, _code: string): string {
    // Simplified _suggestion - would need more complex logic in production
    return "// Use early _returns or switch statement";
  }

  private suggestAsyncAwait(_node: ASTNode, _code: string): string {
    // Simplified _suggestion
    return "// Convert to async/await _pattern";
  }

  private suggestDestructuring(
    _objectName: string,
    properties: Set<string>,
    _code: string,
  ): string {
    const _props = Array.from(properties).join(", ");
    return `const { ${_props} } = ${_objectName};`;
  }

  private calculateMetrics(
    _originalCode: string,
    _refactoredCode: string,
  ): RefactorMetrics {
    const _originalAst = this.astEngine.parseCode(_originalCode);
    const _refactoredAst = this.astEngine.parseCode(_refactoredCode);

    const _originalMetrics = this.astEngine.calculateMetrics(_originalAst);
    const _refactoredMetrics = this.astEngine.calculateMetrics(_refactoredAst);

    return {
      complexityBefore: _originalMetrics.complexity,
      complexityAfter: _refactoredMetrics.complexity,
      linesBefore: _originalCode.split("\n").length,
      linesAfter: refactoredCode.split("\n").length,
      performanceImpact: 0, // Would need benchmarking
      readabilityScore: this.calculateReadabilityScore(_refactoredCode),
    };
  }

  private calculateReadabilityScore(code: string): number {
    // Simplified readability calculation
    const _lines = code.split("\n");
    const _avgLineLength =
      _lines.reduce((sum, line) => sum + line.length, 0) / _lines.length;
    const _score = Math.max(0, Math.min(100, 100 - (_avgLineLength - 80)));
    return _score;
  }

  rollback(rollbackId: string): RefactorResult | undefined {
    const _result = this.history.find((r) => r.rollbackId === rollbackId);
    if (_result) {
      // Swap original and refactored code for rollback
      return {
        ..._result,
        _refactoredCode: _result.originalCode,
        originalCode: _result.refactoredCode,
        changes: _result.changes.map((c) => ({
          ...c,
          before: c.after,
          after: c.before,
        })),
      };
    }
    return undefined;
  }

  getSuggestions(code: string): RefactorSuggestion[] {
    return this.suggestions.get(code) || [];
  }

  clearHistory(): void {
    this.history = [];
    this.suggestions.clear();
  }
}

interface RefactorPattern {
  detect: (_ast: ASTNode, code: string) => RefactorSuggestion[];
  apply: (
    _ast: ASTNode,
    code: string,
    _suggestion: RefactorSuggestion,
    options?: unknown,
  ) => RefactorResult;
}

export const _intelligentRefactor = new IntelligentRefactor();
