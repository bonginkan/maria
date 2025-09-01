/**
 * Advanced Rubric Evaluator
 * AI-powered assessment system for subjective quality metrics
 */

import { EventEmitter } from "node:events";
import {
  Episode,
  RubricScores,
  Rubric,
  RubricCriterion,
  ScoringScale,
} from "./types";
import { readFile, writeFile } from "fs/promises";
import * as path from "path";
import * as os from "os";

export interface RubricConfig {
  name: string;
  description: string;
  version: string;
  categories: RubricCategory[];
  customRubrics?: CustomRubric[];
}

export interface RubricCategory {
  id: string;
  name: string;
  weight: number;
  rubrics: Rubric[];
}

export interface CustomRubric extends Rubric {
  domain: string; // e.g., 'typescript', 'react', 'python'
  tags: string[]; // e.g., ['performance', 'security', 'style']
  createdBy: string;
  updatedAt: Date;
}

export interface EvaluationContext {
  _code?: string;
  language?: string;
  framework?: string;
  domain?: string;
  userQuery?: string;
  previousContext?: string[];
}

export interface EvaluationResult {
  rubricId: string;
  score: number; // 0-100
  _confidence: number; // 0-1
  _reasoning: string;
  evidence: string[];
  _suggestions: string[];
  timestamp: Date;
}

export class RubricEvaluator extends EventEmitter {
  private config: RubricConfig;
  private configPath: string;
  private aiEvaluator: AIEvaluator;
  private ruleEvaluator: RuleEvaluator;
  private cache: Map<string, EvaluationResult[]> = new Map();

  constructor() {
    super();
    this.configPath = path.join(
      os.homedir(),
      ".maria",
      "rubrics",
      "config.json",
    );
    this.aiEvaluator = new AIEvaluator();
    this.ruleEvaluator = new RuleEvaluator();
    this.config = this.getDefaultConfig();
  }

  /**
   * Initialize rubric evaluator
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      this.emit("initialized", { rubrics: this.getTotalRubricCount() });
    } catch (_error) {
      // Use default config if loading fails
      await this.saveConfig();
      this.emit("initialized", { rubrics: this.getTotalRubricCount() });
    }
  }

  /**
   * Evaluate episode using all applicable rubrics
   */
  async evaluateEpisode(
    _episode: Episode,
    context?: EvaluationContext,
  ): Promise<RubricScores> {
    const _cacheKey = this.generateCacheKey(_episode, context);

    // Check cache first
    if (this.cache.has(_cacheKey)) {
      return this.aggregateResults(this.cache.get(_cacheKey)!);
    }

    const evaluationContext: EvaluationContext = {
      _code: _episode.action.generatedCode,
      language: _episode.context.projectInfo?.language,
      framework: _episode.context.projectInfo?.framework,
      userQuery: _episode.context.userQuery,
      ...context,
    };

    const _applicableRubrics = this.getApplicableRubrics(evaluationContext);
    const results: EvaluationResult[] = [];

    this.emit("evaluation:started", {
      _episode: _episode.id,
      rubrics: _applicableRubrics.length,
    });

    for (const rubric of _applicableRubrics) {
      try {
        const _result = await this.evaluateWithRubric(
          rubric,
          evaluationContext,
          _episode,
        );
        results.push(_result);

        this.emit("rubric:evaluated", {
          rubricId: rubric.id,
          score: _result.score,
          _confidence: _result.confidence,
        });
      } catch (_error) {
        this.emit("rubric:_error", {
          rubricId: rubric.id,
          _error: _error instanceof Error ? _error.message : "Unknown _error",
        });
      }
    }

    // Cache results
    this.cache.set(_cacheKey, results);

    const _scores = this.aggregateResults(results);

    this.emit("evaluation:completed", {
      _episode: _episode.id,
      _scores,
      evaluations: results.length,
    });

    return _scores;
  }

  /**
   * Evaluate with a specific rubric
   */
  private async evaluateWithRubric(
    rubric: Rubric,
    context: EvaluationContext,
    episode: Episode,
  ): Promise<EvaluationResult> {
    const criteriaResults: Array<{
      _criterion: RubricCriterion;
      score: number;
      _confidence: number;
      _reasoning: string;
      evidence: string[];
    }> = [];

    // Evaluate each _criterion
    for (const _criterion of rubric.criteria) {
      let _result;

      switch (_criterion.evaluationType) {
        case "ai":
          _result = await this.aiEvaluator.evaluate(
            _criterion,
            context,
            episode,
          );
          break;
        case "rule":
          _result = this.ruleEvaluator.evaluate(_criterion, context, episode);
          break;
        case "hybrid":
        default:
          {
            const _aiResult = await this.aiEvaluator.evaluate(
              _criterion,
              context,
              episode,
            );
            const _ruleResult = this.ruleEvaluator.evaluate(
              _criterion,
              context,
              episode,
            );

            // Combine AI and rule-based results
            _result = {
              score: (_aiResult.score + _ruleResult.score) / 2,
              _confidence: Math.min(
                _aiResult.confidence,
                _ruleResult.confidence,
              ),
              _reasoning: `AI: ${_aiResult.reasoning} | Rule: ${_ruleResult.reasoning}`,
              evidence: [..._aiResult.evidence, ..._ruleResult.evidence],
            };
          }
          break;
      }

      criteriaResults.push({
        _criterion,
        ..._result,
      });
    }

    // Aggregate _criterion _scores
    const _weightedScore =
      criteriaResults.reduce(
        (sum, _result) => sum + _result.score * _result._criterion.weight,
        0,
      ) /
      criteriaResults.reduce(
        (sum, _result) => sum + _result._criterion.weight,
        0,
      );

    const _avgConfidence =
      criteriaResults.reduce((sum, _result) => sum + _result.confidence, 0) /
      criteriaResults.length;

    const _aggregatedReasoning = criteriaResults
      .map((r) => `${r._criterion.name}: ${r.reasoning}`)
      .join("; ");

    const _allEvidence = criteriaResults.flatMap((r) => r.evidence);

    const _suggestions = this.generateSuggestions(
      rubric,
      criteriaResults,
      context,
    );

    return {
      rubricId: rubric.id,
      score: this.applyScoring(_weightedScore, rubric.scoringScale),
      _confidence: _avgConfidence,
      _reasoning: _aggregatedReasoning,
      evidence: _allEvidence,
      _suggestions,
      timestamp: new Date(),
    };
  }

  /**
   * Get applicable rubrics based on context
   */
  private getApplicableRubrics(context: EvaluationContext): Rubric[] {
    const rubrics: Rubric[] = [];

    for (const _category of this.config.categories) {
      for (const rubric of _category.rubrics) {
        if (this.isRubricApplicable(rubric, context)) {
          rubrics.push(rubric);
        }
      }
    }

    // Add applicable custom rubrics
    if (this.config.customRubrics) {
      for (const customRubric of this.config.customRubrics) {
        if (this.isCustomRubricApplicable(customRubric, context)) {
          rubrics.push(customRubric);
        }
      }
    }

    return rubrics;
  }

  /**
   * Check if rubric is applicable to context
   */
  private isRubricApplicable(
    _rubric: Rubric,
    context: EvaluationContext,
  ): boolean {
    // Always applicable core rubrics
    const _coreRubrics = ["code_quality", "documentation", "user_satisfaction"];
    if (_coreRubrics.includes(_rubric.id)) {
      return true;
    }

    // Language-specific rubrics
    if (
      _rubric.id.includes("typescript") &&
      context.language === "typescript"
    ) {
      return true;
    }
    if (_rubric.id.includes("python") && context.language === "python") {
      return true;
    }
    if (_rubric.id.includes("react") && context.framework === "react") {
      return true;
    }

    // Content-based applicability
    if (context.code && _rubric.id.includes("performance")) {
      return (
        context.code.includes("performance") ||
        context.code.includes("optimize")
      );
    }

    return false;
  }

  /**
   * Check if custom rubric is applicable
   */
  private isCustomRubricApplicable(
    _rubric: CustomRubric,
    context: EvaluationContext,
  ): boolean {
    // Domain matching
    if (_rubric.domain && _rubric.domain !== context.domain) {
      return false;
    }

    // Language matching
    if (
      context.language &&
      _rubric.domain &&
      _rubric.domain !== context.language
    ) {
      return false;
    }

    // Tag-based matching
    if (context.code) {
      const _hasRelevantTag = _rubric.tags.some(
        (tag) =>
          context.code!.toLowerCase().includes(tag.toLowerCase()) ||
          context.userQuery?.toLowerCase().includes(tag.toLowerCase()),
      );
      return _hasRelevantTag;
    }

    return true;
  }

  /**
   * Apply scoring scale to raw score
   */
  private applyScoring(_rawScore: number, scale: ScoringScale): number {
    const _clampedScore = Math.max(0, Math.min(100, _rawScore));

    if (_clampedScore >= scale.excellent[0]) {
      return Math.min(
        100,
        scale.excellent[0] +
          ((_clampedScore - scale.excellent[0]) *
            (scale.excellent[1] - scale.excellent[0])) /
            (100 - scale.excellent[0]),
      );
    } else if (_clampedScore >= scale.good[0]) {
      return (
        scale.good[0] +
        ((_clampedScore - scale.good[0]) * (scale.good[1] - scale.good[0])) /
          (scale.excellent[0] - scale.good[0])
      );
    } else if (_clampedScore >= scale.needsImprovement[0]) {
      return (
        scale.needsImprovement[0] +
        ((_clampedScore - scale.needsImprovement[0]) *
          (scale.needsImprovement[1] - scale.needsImprovement[0])) /
          (scale.good[0] - scale.needsImprovement[0])
      );
    } else {
      return (
        scale.poor[0] +
        ((_clampedScore - 0) * (scale.poor[1] - scale.poor[0])) /
          scale.needsImprovement[0]
      );
    }
  }

  /**
   * Generate improvement _suggestions
   */
  private generateSuggestions(
    _rubric: Rubric,
    results: Array<{
      _criterion: RubricCriterion;
      score: number;
      _reasoning: string;
    }>,
    context: EvaluationContext,
  ): string[] {
    const _suggestions: string[] = [];
    const _lowScoring = results.filter((r) => r.score < 60);

    for (const _result of _lowScoring) {
      const _criterion = _result._criterion;

      switch (_criterion.name) {
        case "clear_naming":
          suggestions.push("Use more _descriptive variable and function names");
          break;
        case "consistent_style":
          suggestions.push("Apply consistent formatting and _code style");
          break;
        case "appropriate_comments":
          suggestions.push(
            "Add comments for complex logic and public interfaces",
          );
          break;
        case "modular_design":
          suggestions.push(
            "Break down large functions into smaller, focused modules",
          );
          break;
        case "error_handling":
          suggestions.push(
            "Add comprehensive _error handling with try-catch blocks",
          );
          break;
        case "type_safety":
          if (context.language === "typescript") {
            suggestions.push(
              "Add explicit type annotations and avoid any types",
            );
          }
          break;
        case "performance_optimization":
          suggestions.push(
            "Consider algorithmic improvements and avoid unnecessary operations",
          );
          break;
      }
    }

    // Domain-specific _suggestions
    if (
      context.language === "typescript" &&
      results.some((r) => r.score < 70)
    ) {
      suggestions.push("Consider using TypeScript strict mode features");
    }

    if (context.framework === "react" && results.some((r) => r.score < 70)) {
      suggestions.push(
        "Follow React best practices: use hooks properly, avoid prop drilling",
      );
    }

    return _suggestions.slice(0, 5); // Limit to top 5 _suggestions
  }

  /**
   * Aggregate multiple evaluation results into final _scores
   */
  private aggregateResults(results: EvaluationResult[]): RubricScores {
    const _categoryScores = new Map<
      string,
      { _total: number; weight: number; count: number }
    >();

    // Group by _category
    for (const _result of results) {
      const _category = this.getRubricCategory(_result.rubricId);
      if (!_categoryScores.has(_category)) {
        categoryScores.set(_category, { _total: 0, weight: 0, count: 0 });
      }

      const _categoryData = _categoryScores.get(_category)!;
      _categoryData.total += _result.score * _result.confidence;
      _categoryData.weight += _result.confidence;
      categoryData.count++;
    }

    // Calculate weighted averages
    const _scores: RubricScores = {
      codeQuality: 50, // Default values
      documentation: 50,
      userSatisfaction: 50,
      innovativeness: 50,
      efficiency: 50,
    };

    for (const [_category, data] of _categoryScores.entries()) {
      if (data.weight > 0) {
        const _avgScore = data.total / data.weight;

        switch (_category) {
          case "quality":
            scores.codeQuality = _avgScore;
            break;
          case "documentation":
            scores.documentation = _avgScore;
            break;
          case "satisfaction":
            scores.userSatisfaction = _avgScore;
            break;
          case "innovation":
            scores.innovativeness = _avgScore;
            break;
          case "performance":
            scores.efficiency = _avgScore;
            break;
        }
      }
    }

    return _scores;
  }

  /**
   * Get rubric _category
   */
  private getRubricCategory(rubricId: string): string {
    for (const _category of this.config.categories) {
      if (_category.rubrics.some((r) => r.id === rubricId)) {
        return _category.id;
      }
    }
    return "general";
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    _episode: Episode,
    context?: EvaluationContext,
  ): string {
    const _contextStr = context ? JSON.stringify(context) : "";
    const _episodeStr =
      _episode.action.command + (_episode.action.generatedCode || "");
    return `${_episode.id}_${Buffer.from(_episodeStr + _contextStr).toString("base64")}`;
  }

  /**
   * Get _total rubric count
   */
  private getTotalRubricCount(): number {
    let count = 0;
    for (const _category of this.config.categories) {
      count += _category.rubrics.length;
    }
    return count + (this.config.customRubrics?.length || 0);
  }

  /**
   * Load config from file
   */
  private async loadConfig(): Promise<void> {
    try {
      const _configData = await readFile(this.configPath, "utf-8");
      this.config = JSON.parse(_configData);
    } catch (_error) {
      throw new Error(`Failed to load rubric config: ${_error}`);
    }
  }

  /**
   * Save config to file
   */
  private async saveConfig(): Promise<void> {
    try {
      const _dir = path.dirname(this.configPath);
      await import("fs/promises").then((fs) =>
        fs.mkdir(_dir, { recursive: true }),
      );
      await writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (_error) {
      throw new Error(`Failed to save rubric config: ${_error}`);
    }
  }

  /**
   * Get default rubric configuration
   */
  private getDefaultConfig(): RubricConfig {
    return {
      name: "MARIA Default Rubrics",
      description: "Default rubric set for _code quality assessment",
      version: "1.0.0",
      categories: [
        {
          id: "quality",
          name: "Code Quality",
          weight: 0.3,
          rubrics: [
            {
              id: "code_quality",
              name: "Code Quality",
              weight: 1.0,
              criteria: [
                {
                  name: "clear_naming",
                  description:
                    "Variables and functions have _descriptive names",
                  weight: 0.3,
                  evaluationType: "hybrid",
                },
                {
                  name: "consistent_style",
                  description: "Code follows consistent formatting",
                  weight: 0.2,
                  evaluationType: "rule",
                },
                {
                  name: "appropriate_comments",
                  description: "Complex logic is well-documented",
                  weight: 0.25,
                  evaluationType: "ai",
                },
                {
                  name: "modular_design",
                  description: "Code is properly modularized",
                  weight: 0.25,
                  evaluationType: "hybrid",
                },
              ],
              scoringScale: {
                excellent: [90, 100],
                good: [70, 89],
                needsImprovement: [50, 69],
                poor: [0, 49],
              },
            },
          ],
        },
        {
          id: "documentation",
          name: "Documentation",
          weight: 0.2,
          rubrics: [
            {
              id: "documentation_quality",
              name: "Documentation Quality",
              weight: 1.0,
              criteria: [
                {
                  name: "clarity",
                  description: "Documentation is clear and understandable",
                  weight: 0.4,
                  evaluationType: "ai",
                },
                {
                  name: "completeness",
                  description: "All necessary information is provided",
                  weight: 0.3,
                  evaluationType: "hybrid",
                },
                {
                  name: "examples",
                  description: "Includes relevant examples",
                  weight: 0.3,
                  evaluationType: "rule",
                },
              ],
              scoringScale: {
                excellent: [85, 100],
                good: [70, 84],
                needsImprovement: [50, 69],
                poor: [0, 49],
              },
            },
          ],
        },
      ],
    };
  }

  /**
   * Add custom rubric
   */
  async addCustomRubric(rubric: CustomRubric): Promise<void> {
    if (!this.config.customRubrics) {
      this.config.customRubrics = [];
    }

    this.config.customRubrics.push(rubric);
    await this.saveConfig();

    this.emit("rubric:added", { rubricId: rubric.id });
  }

  /**
   * Remove custom rubric
   */
  async removeCustomRubric(rubricId: string): Promise<void> {
    if (this.config.customRubrics) {
      this.config.customRubrics = this.config.customRubrics.filter(
        (r) => r.id !== rubricId,
      );
      await this.saveConfig();

      this.emit("rubric:removed", { rubricId });
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.emit("cache:cleared");
  }
}

/**
 * AI-powered evaluator
 */
class AIEvaluator {
  async evaluate(
    _criterion: RubricCriterion,
    context: EvaluationContext,
    _episode: Episode,
  ): Promise<{
    score: number;
    _confidence: number;
    _reasoning: string;
    evidence: string[];
  }> {
    // Simplified AI evaluation - in practice would use actual AI model
    const _code = context._code || "";
    const _query = context.userQuery || "";

    let score = 50;
    let _confidence = 0.7;
    let _reasoning = "AI analysis";
    let evidence: string[] = [];

    switch (_criterion.name) {
      case "clear_naming":
        {
          const _hasDescriptiveNames = this._hasDescriptiveNames(_code);
          score = _hasDescriptiveNames ? 85 : 40;
          _confidence = 0.8;
          _reasoning = _hasDescriptiveNames
            ? "Good naming conventions found"
            : "Names could be more _descriptive";
          evidence = this.extractNamingEvidence(_code);
        }
        break;

      case "appropriate_comments":
        {
          const _commentRatio = this.calculateCommentRatio(_code);
          score = Math.min(90, _commentRatio * 100);
          _confidence = 0.9;
          _reasoning = `Comment ratio: ${(_commentRatio * 100).toFixed(1)}%`;
          evidence = [`${this.countComments(_code)} comments found`];
        }
        break;

      case "clarity":
        {
          const _clarityScore = this.assessClarity(_query, _code);
          score = _clarityScore;
          _confidence = 0.75;
          _reasoning = "Clarity assessed based on explanation quality";
          evidence = ["Analyzed explanation structure and terminology"];
        }
        break;
    }

    return { score, _confidence, _reasoning, evidence };
  }

  private _hasDescriptiveNames(_code: string): boolean {
    const _varNames =
      _code.match(/(?:let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
    const _funcNames =
      _code.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];

    const _allNames = [..._varNames, ..._funcNames];
    const _descriptive = _allNames.filter((name) => {
      const _cleanName = name.split(/\s+/).pop() || "";
      return (
        _cleanName.length > 3 &&
        !["temp", "tmp", "x", "y", "z"].includes(_cleanName)
      );
    });

    return _descriptive.length / Math.max(_allNames.length, 1) > 0.7;
  }

  private extractNamingEvidence(_code: string): string[] {
    const _varNames =
      _code.match(/(?:let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
    return _varNames.slice(0, 3).map((match) => `Variable: ${match}`);
  }

  private calculateCommentRatio(_code: string): number {
    const _lines = _code.split("\n");
    const _codeLines = _lines.filter((line) => line.trim().length > 0).length;
    const _commentLines = _lines.filter(
      (line) => line.trim().startsWith("//") || line.includes("/*"),
    ).length;

    return _codeLines > 0 ? _commentLines / _codeLines : 0;
  }

  private countComments(_code: string): number {
    const _singleLine = (_code.match(/\/\//g) || []).length;
    const _multiLine = (_code.match(/\/\*/g) || []).length;
    return _singleLine + _multiLine;
  }

  private assessClarity(_query: string, _code: string): number {
    // Simple clarity heuristics
    let score = 50;

    // Has clear structure
    if (_query.includes("?")) score += 10;
    if (_query.length > 20 && _query.length < 200) score += 10;

    // Code organization
    if (_code.includes("function") || _code.includes("class")) score += 10;
    if (_code.includes("interface") || _code.includes("type")) score += 10;

    return Math.min(95, score);
  }
}

/**
 * Rule-based evaluator
 */
class RuleEvaluator {
  evaluate(
    _criterion: RubricCriterion,
    context: EvaluationContext,
    _episode: Episode,
  ): {
    score: number;
    _confidence: number;
    _reasoning: string;
    evidence: string[];
  } {
    const _code = context._code || "";
    let score = 50;
    const _confidence = 0.9; // Rules are more confident
    let _reasoning = "Rule-based analysis";
    let evidence: string[] = [];

    switch (_criterion.name) {
      case "consistent_style":
        {
          const _styleScore = this.checkCodeStyle(_code);
          score = _styleScore.score;
          _reasoning = _styleScore._reasoning;
          evidence = _styleScore.evidence;
        }
        break;

      case "examples":
        {
          const _hasExamples = this.hasCodeExamples(_code);
          score = _hasExamples ? 80 : 30;
          _reasoning = _hasExamples
            ? "Code examples found"
            : "No _code examples";
          evidence = _hasExamples
            ? ["Examples detected in _code"]
            : ["No examples found"];
        }
        break;

      case "error_handling":
        {
          const _errorHandling = this.checkErrorHandling(_code);
          score = _errorHandling.score;
          _reasoning = _errorHandling._reasoning;
          evidence = _errorHandling.evidence;
        }
        break;
    }

    return { score, _confidence, _reasoning, evidence };
  }

  private checkCodeStyle(_code: string): {
    score: number;
    _reasoning: string;
    evidence: string[];
  } {
    let score = 50;
    const evidence: string[] = [];
    const issues: string[] = [];

    // Check indentation consistency
    const _lines = _code.split("\n").filter((line) => line.trim().length > 0);
    const _indentations = _lines.map(
      (line) => line.match(/^\s*/)?.[0].length || 0,
    );
    const _uniqueIndents = [...new Set(_indentations)].sort();

    if (_uniqueIndents.length <= 3) {
      score += 20;
      evidence.push("Consistent indentation");
    } else {
      issues.push("Inconsistent indentation");
    }

    // Check for consistent quote usage
    const _singleQuotes = (_code.match(/'/g) || []).length;
    const _doubleQuotes = (_code.match(/"/g) || []).length;
    const _total = _singleQuotes + _doubleQuotes;

    if (
      _total === 0 ||
      Math.abs(_singleQuotes - _doubleQuotes) / _total < 0.2
    ) {
      score += 15;
      evidence.push("Consistent quote usage");
    } else {
      issues.push("Mixed quote styles");
    }

    // Check semicolon consistency
    const _withSemicolon = (_code.match(/;$/gm) || []).length;
    const _codeLines = _code
      .split("\n")
      .filter(
        (line) => line.trim().length > 0 && !line.trim().startsWith("//"),
      ).length;

    if (_withSemicolon === 0 || _withSemicolon / _codeLines > 0.8) {
      score += 15;
      evidence.push("Consistent semicolon usage");
    } else {
      issues.push("Inconsistent semicolons");
    }

    const _reasoning =
      issues.length > 0
        ? `Style issues: ${issues.join(", ")}`
        : "Good _code style consistency";

    return { score: Math.min(100, score), _reasoning, evidence };
  }

  private hasCodeExamples(_code: string): boolean {
    // Look for example patterns
    const _exampleKeywords = ["example", "demo", "sample", "usage"];
    const _hasKeywords = _exampleKeywords.some((keyword) =>
      code.toLowerCase().includes(keyword),
    );

    // Look for function calls or usage patterns
    const _hasFunctionCalls = _code.includes("(") && _code.includes(")");

    return _hasKeywords || _hasFunctionCalls;
  }

  private checkErrorHandling(_code: string): {
    score: number;
    _reasoning: string;
    evidence: string[];
  } {
    let score = 30; // Base score
    const evidence: string[] = [];

    // Check for try-catch blocks
    const _tryBlocks = (_code.match(/try\s*{/g) || []).length;
    const _catchBlocks = (_code.match(/catch\s*\(/g) || []).length;

    if (_tryBlocks > 0 && _catchBlocks > 0) {
      score += 40;
      evidence.push(`${_tryBlocks} try-catch blocks found`);
    }

    // Check for _error checking patterns
    if (_code.includes("throw new Error") || _code.includes("throw Error")) {
      score += 20;
      evidence.push("Explicit _error throwing");
    }

    // Check for validation
    if (
      _code.includes("if") &&
      (_code.includes("null") || _code.includes("undefined"))
    ) {
      score += 10;
      evidence.push("Null/undefined checks");
    }

    const _reasoning =
      evidence.length > 0
        ? "Good _error handling practices"
        : "Limited _error handling";

    return { score: Math.min(100, score), _reasoning, evidence };
  }
}
