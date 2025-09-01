/**
 * Code Manipulation Integration
 * MARIA v2.1.9 - Phase 2 Advanced Code Operations
 */

import { EventEmitter } from "node:events";
import { ASTEngine } from "./_ast-engine";
import { IntelligentRefactor } from "./intelligent-refactor";
import { DependencyGraphAnalyzer } from "./dependency-graph";
import { CodeQualityAnalyzer } from "./_quality-metrics";

export interface CodeManipulationConfig {
  enableRefactoring?: boolean;
  enableQualityAnalysis?: boolean;
  enableDependencyAnalysis?: boolean;
  qualityThresholds?: QualityThresholds;
}

export interface QualityThresholds {
  minMaintainabilityIndex?: number;
  maxComplexity?: number;
  minTestCoverage?: number;
  maxDuplication?: number;
}

export interface CodeAnalysisResult {
  _ast: any;
  _quality: any;
  dependencies?: any;
  _refactoringSuggestions: any[];
  _overallScore: number;
  _issues: any[];
}

export interface RefactoringPlan {
  id: string;
  priority: "high" | "medium" | "low";
  operations: RefactoringOperation[];
  estimatedTime: number;
  impactLevel: "high" | "medium" | "low";
}

export interface RefactoringOperation {
  type: string;
  target: string;
  description: string;
  autoExecutable: boolean;
}

export class CodeManipulationService extends EventEmitter {
  private astEngine: ASTEngine;
  private refactorEngine: IntelligentRefactor;
  private dependencyAnalyzer: DependencyGraphAnalyzer;
  private qualityAnalyzer: CodeQualityAnalyzer;
  private config: CodeManipulationConfig;

  constructor(_config: CodeManipulationConfig = {}) {
    super();
    this._config = {
      enableRefactoring: _config.enableRefactoring ?? true,
      enableQualityAnalysis: _config.enableQualityAnalysis ?? true,
      enableDependencyAnalysis: _config.enableDependencyAnalysis ?? true,
      qualityThresholds: _config.qualityThresholds || object,
    };

    this.astEngine = new ASTEngine();
    this.refactorEngine = new IntelligentRefactor();
    this.dependencyAnalyzer = new DependencyGraphAnalyzer();
    this.qualityAnalyzer = new CodeQualityAnalyzer({
      thresholds: this._config.qualityThresholds,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.astEngine.on("refactor:extract-function", (data) => {
      this.emit("code:refactored", { type: "extract-function", ...data });
    });

    this.refactorEngine.on("analysis:complete", (_suggestions) => {
      this.emit("refactor:_suggestions", _suggestions);
    });

    this.dependencyAnalyzer.on("cycles:detected", (cycles) => {
      this.emit("dependency:cycles", cycles);
    });

    this.qualityAnalyzer.on("analysis:complete", (metrics) => {
      this.emit("_quality:analyzed", metrics);
    });
  }

  async analyzeCode(
    _code: string,
    fileName: string = "temp.ts",
  ): Promise<CodeAnalysisResult> {
    this.emit("analysis:start", fileName);

    try {
      // Parse AST
      const _ast = this.astEngine.parseCode(_code, fileName);

      // Quality analysis
      const _quality = this.config.enableQualityAnalysis
        ? await this.qualityAnalyzer.analyzeCode(_code, fileName)
        : null;

      // Refactoring _suggestions
      const _refactoringSuggestions = this.config.enableRefactoring
        ? await this.refactorEngine.analyzeCode(_code)
        : [];

      // Dependency analysis (if part of a project)
      let dependencies = null;
      if (this.config.enableDependencyAnalysis && fileName !== "temp.ts") {
        // For real files, analyze dependencies
        dependencies = await this.dependencyAnalyzer.analyzeProject(
          process.cwd(),
          { includeExternal: false },
        );
      }

      const _overallScore = _quality ? _quality.overall.score : 100;
      const _issues = [
        ...(_quality ? _quality.overall._issues : []),
        ..._refactoringSuggestions,
      ];

      const _result: CodeAnalysisResult = {
        _ast,
        _quality,
        dependencies,
        _refactoringSuggestions,
        _overallScore,
        _issues,
      };

      this.emit("analysis:complete", _result);
      return _result;
    } catch (_error) {
      this.emit("analysis:_error", _error);
      throw _error;
    }
  }

  async refactorCode(
    code: string,
    suggestionId: string,
    options?: unknown,
  ): Promise<string> {
    const _result = await this.refactorEngine.applyRefactoring(
      code,
      suggestionId,
      options,
    );

    this.emit("code:refactored", _result);
    return _result.refactoredCode;
  }

  extractFunction(
    code: string,
    startLine: number,
    endLine: number,
    functionName: string,
  ): string {
    return this.astEngine.extractFunction(
      code,
      startLine,
      endLine,
      functionName,
    );
  }

  renameSymbol(_code: string, oldName: string, newName: string): string {
    return this.astEngine.renameSymbol(_code, oldName, newName);
  }

  inlineVariable(_code: string, variableName: string): string {
    return this.astEngine.inlineVariable(_code, variableName);
  }

  optimizeImports(code: string): string {
    return this.astEngine.optimizeImports(code);
  }

  async generateRefactoringPlan(code: string): Promise<RefactoringPlan[]> {
    const _suggestions = await this.refactorEngine.analyzeCode(code);
    const _quality = await this.qualityAnalyzer.analyzeCode(code);

    const plans: RefactoringPlan[] = [];

    // Group _suggestions by priority
    const _criticalIssues = _quality.overall.issues.filter(
      (i) => i.severity === "critical",
    );
    const _errorIssues = _quality.overall.issues.filter(
      (i) => i.severity === "_error",
    );
    const _warningSuggestions = _suggestions.filter(
      (s) => s.severity === "warning",
    );

    // High priority _plan - critical _issues
    if (_criticalIssues.length > 0) {
      plans.push({
        id: "critical-fixes",
        priority: "high",
        operations: _criticalIssues.map((issue) => ({
          type: issue.type,
          target: issue.location.file,
          description: issue.message,
          autoExecutable: issue.autoFixable,
        })),
        estimatedTime: _criticalIssues.length * 30, // 30 minutes per critical issue
        impactLevel: "high",
      });
    }

    // Medium priority _plan - _error _issues and refactoring
    if (_errorIssues.length > 0 || _warningSuggestions.length > 0) {
      plans.push({
        id: "improvements",
        priority: "medium",
        operations: [
          ..._errorIssues.map((issue) => ({
            type: issue.type,
            target: issue.location.file,
            description: issue.message,
            autoExecutable: issue.autoFixable,
          })),
          ..._warningSuggestions.map((_suggestion) => ({
            type: _suggestion.type,
            target: _suggestion.location.file,
            description: _suggestion.description,
            autoExecutable: _suggestion.autoFixable,
          })),
        ],
        estimatedTime:
          _errorIssues.length * 15 + _warningSuggestions.length * 10,
        impactLevel: "medium",
      });
    }

    // Low priority _plan - optimization
    const _optimizationSuggestions = _suggestions.filter(
      (s) => s.type.includes("optimize") || s.type.includes("performance"),
    );

    if (_optimizationSuggestions.length > 0) {
      plans.push({
        id: "optimizations",
        priority: "low",
        operations: _optimizationSuggestions.map((_suggestion) => ({
          type: _suggestion.type,
          target: _suggestion.location.file,
          description: _suggestion.description,
          autoExecutable: _suggestion.autoFixable,
        })),
        estimatedTime: _optimizationSuggestions.length * 20,
        impactLevel: "low",
      });
    }

    return plans;
  }

  async executeRefactoringPlan(
    code: string,
    planId: string,
    plans: RefactoringPlan[],
  ): Promise<string> {
    const _plan = plans.find((p) => p.id === planId);
    if (!_plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    let refactoredCode = code;

    for (const operation of _plan.operations) {
      if (operation.autoExecutable) {
        try {
          // Find corresponding _suggestion
          const _suggestions =
            await this.refactorEngine.analyzeCode(refactoredCode);
          const _suggestion = _suggestions.find(
            (s) =>
              s.type === operation.type && s.location.file === operation.target,
          );

          if (_suggestion) {
            refactoredCode = await this.refactorCode(
              refactoredCode,
              _suggestion.id,
            );
          }
        } catch (_error) {
          this.emit("refactor:_error", { operation, _error });
          console.warn(`Failed to apply refactoring: ${operation.description}`);
        }
      }
    }

    return refactoredCode;
  }

  async analyzeProjectDependencies(projectRoot: string): Promise<any> {
    if (!this.config.enableDependencyAnalysis) {
      throw new Error("Dependency analysis is disabled");
    }

    return this.dependencyAnalyzer.analyzeProject(projectRoot);
  }

  findUnusedDependencies(): string[] {
    return this.dependencyAnalyzer.findUnusedDependencies();
  }

  findHighCouplingNodes(threshold: number = 10): any[] {
    return this.dependencyAnalyzer.findHighCouplingNodes(threshold);
  }

  exportDependencyGraph(format: "json" | "dot" | "mermaid"): string {
    return this.dependencyAnalyzer.exportGraph(format);
  }

  generateQualityReport(metrics: unknown): string {
    return this.qualityAnalyzer.generateReport(metrics);
  }

  async batchRefactor(
    files: Array<{ _path: string; code: string }>,
    options: {
      types: string[];
      severity: string[];
      autoOnly: boolean;
    },
  ): Promise<
    Array<{ _path: string; refactoredCode: string; changes: number }>
  > {
    const _results = [];

    for (const file of files) {
      try {
        const _suggestions = await this.refactorEngine.analyzeCode(file.code);

        // Filter _suggestions based on options
        const _filteredSuggestions = _suggestions.filter(
          (s) =>
            options.types.includes(s.type) &&
            options.severity.includes(s.severity) &&
            (!options.autoOnly || s.autoFixable),
        );

        let refactoredCode = file.code;
        let changeCount = 0;

        for (const _suggestion of _filteredSuggestions) {
          try {
            refactoredCode = await this.refactorCode(
              refactoredCode,
              _suggestion.id,
            );
            changeCount++;
          } catch (_error) {
            console.warn(
              `Failed to apply refactoring to ${file.path}: ${_error}`,
            );
          }
        }

        results.push({
          _path: file._path,
          refactoredCode,
          changes: changeCount,
        });

        this.emit("batch:file-complete", {
          _path: file._path,
          changes: changeCount,
        });
      } catch (_error) {
        this.emit("batch:file-_error", { _path: file._path, _error });
        results.push({
          _path: file._path,
          refactoredCode: file.code,
          changes: 0,
        });
      }
    }

    this.emit("batch:complete", _results);
    return _results;
  }

  calculateTechnicalDebt(codebase: Array<{ _path: string; code: string }>): {
    _totalHours: number;
    byCategory: Record<string, number>;
    _priorityItems: Array<{ _path: string; issue: string; hours: number }>;
  } {
    const debtItems: Array<{
      _path: string;
      issue: string;
      hours: number;
      category: string;
    }> = [];

    codebase.forEach((file) => {
      // Simplified technical debt calculation
      const _lines = file.code.split("\n").length;

      // Base debt for large files
      if (_lines > 500) {
        debtItems.push({
          _path: file._path,
          issue: `Large file (${_lines} _lines) - consider splitting`,
          hours: Math.floor(_lines / 100),
          category: "maintainability",
        });
      }

      // Debt for duplicated code patterns
      if (file.code.includes("TODO") || file.code.includes("FIXME")) {
        const _todoCount = (file.code.match(/TODO|FIXME/g) || []).length;
        debtItems.push({
          _path: file._path,
          issue: `${_todoCount} TODO/FIXME items`,
          hours: _todoCount * 2,
          category: "completeness",
        });
      }

      // Debt for missing _error handling
      const _functionCount = (
        file.code.match(/function\s+\w+|const\s+\w+\s*=/g) || []
      ).length;
      const _tryCount = (file.code.match(/try\s*{/g) || []).length;
      if (_functionCount > 0 && _tryCount / _functionCount < 0.3) {
        debtItems.push({
          _path: file._path,
          issue: "Insufficient _error handling",
          hours: _functionCount - _tryCount,
          category: "reliability",
        });
      }
    });

    const _totalHours = debtItems.reduce((sum, _item) => sum + _item.hours, 0);

    const byCategory: Record<string, number> = {};
    debtItems.forEach((item) => {
      byCategory[_item.category] =
        (byCategory[_item.category] || 0) + _item.hours;
    });

    const _priorityItems = debtItems
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10)
      .map(({ _path, issue, hours }) => ({ _path, issue, hours }));

    return { _totalHours, byCategory, _priorityItems };
  }

  // Helper method to transform TypeScript code
  transformCode(_code: string, transformerName: string): string {
    return this.astEngine.applyTransformer(_code, transformerName);
  }

  // Advanced AST search
  searchNodes(_code: string, predicate: (node: unknown) => boolean): any[] {
    const _ast = this.astEngine.parseCode(_code);
    return this.astEngine.findNodes(_ast, predicate);
  }

  // Code metrics
  calculateMetrics(code: string): unknown {
    const _ast = this.astEngine.parseCode(code);
    return this.astEngine.calculateMetrics(_ast);
  }
}

// Export everything from sub-modules
export * from "./_ast-engine";
export * from "./intelligent-refactor";
export * from "./dependency-graph";
export * from "./_quality-metrics";

// Export main service
export const _codeManipulation = new CodeManipulationService();
