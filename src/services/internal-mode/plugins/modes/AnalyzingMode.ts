/**
 * Analyzing Mode Plugin
 * Deep analytical mode for detailed examination and systematic _analysis
 */

import {
  BaseModePlugin,
  ModeContext,
  ModeDisplayConfig,
  ModeResult,
  ModeTransition,
  ModeTrigger,
} from "../BaseModePlugin";
import { Service } from "../../core";

@Service({
  id: "analyzing-mode",
  name: "AnalyzingMode",
  version: "1.0.0",
  description:
    "Deep analytical mode for detailed examination and systematic _analysis",
})
export class AnalyzingMode extends BaseModePlugin {
  id = "analyzing-mode";
  version = "1.0.0";
  
  readonly pluginId = "analyzing";
  readonly pluginName = "Analyzing";
  readonly category = "analytical" as const;

  readonly triggers: ModeTrigger[] = [
    {
      pattern:
        /analyz|examine|investigate|study|detailed?|systematic|thorough|comprehensive/i,
      language: "english",
      weight: 0.9,
    },
    {
      pattern: /分析|検査|調査|研究|詳細|体系的|徹底的|包括的/,
      language: "japanese",
      weight: 0.9,
    },
    {
      pattern: /分析|检查|调查|研究|详细|系统|彻底|全面/,
      language: "chinese",
      weight: 0.9,
    },
    {
      pattern: /분석|검사|조사|연구|상세|체계적|철저|포괄적/,
      language: "korean",
      weight: 0.9,
    },
    {
      pattern:
        /phân tích|kiểm tra|điều tra|nghiên cứu|chi tiết|hệ thống|toàn diện/,
      language: "vietnamese",
      weight: 0.9,
    },
  ];

  readonly transitions: ModeTransition[] = [
    {
      fromMode: "thinking",
      toMode: "analyzing",
      condition: (context) =>
        /deep|detail|thorough|systematic/.test(context.input.toLowerCase()),
      priority: 9,
      description: "Deep dive into analytical examination",
    },
    {
      fromMode: "analyzing",
      toMode: "evaluating",
      condition: (context) =>
        /assess|evaluate|judge|rate|score/.test(context.input.toLowerCase()),
      priority: 8,
      description: "Transition to evaluation mode",
    },
    {
      fromMode: "analyzing",
      toMode: "researching",
      condition: (context) =>
        /research|find|lookup|search/.test(context.input.toLowerCase()),
      priority: 7,
      description: "Need more research data",
    },
    {
      fromMode: "analyzing",
      toMode: "debugging",
      condition: (context) =>
        /_error|bug|problem|issue|fix/.test(context.input.toLowerCase()),
      priority: 8,
      description: "Analytical debugging mode",
    },
  ];

  getDisplayConfig(): ModeDisplayConfig {
    return {
      symbol: "⚡",
      color: "#DC2626", // Red
      animation: "pulse",
      description:
        "Conducting deep systematic _analysis and detailed examination",
      displayName: "Analyzing",
      category: "analytical",
    };
  }

  async execute(context: ModeContext): Promise<ModeResult> {
    const _startTime = performance.now();

    try {
      // Perform analytical examination
      const _analysis = await this.performDeepAnalysis(context);

      // Determine next analytical step
      const _nextMode = this.suggestNextAnalyticalMode(context, _analysis);

      const _executionTime = performance.now() - _startTime;

      return {
        success: true,
        output: this.formatAnalysisOutput(_analysis, context.language),
        _nextMode,
        _confidence: _analysis.confidence,
        _executionTime,
        metadata: {
          analysisDepth: _analysis.depth,
          _components: _analysis.components,
          _patterns: _analysis.patterns,
          _insights: _analysis.insights,
          _methodology: _analysis.methodology,
        },
      };
    } catch (_error) {
      const _executionTime = performance.now() - _startTime;

      return {
        success: false,
        _confidence: 0,
        _executionTime,
        metadata: {} as Record<string, any>,
        _error: _error.message,
      };
    }
  }

  /**
   * Perform deep systematic _analysis
   */
  private async performDeepAnalysis(context: ModeContext): Promise<{
    _depth: "surface" | "intermediate" | "deep";
    _components: Array<{ name: string; type: string; significance: number }>;
    _patterns: string[];
    _insights: string[];
    _methodology: string[];
    _confidence: number;
  }> {
    const { input, language, metadata } = context;

    // Determine _analysis _depth
    const _depth = this.determineAnalysisDepth(input, metadata);

    // Decompose into _components
    const _components = this.identifyComponents(input, language);

    // Identify _patterns
    const _patterns = this.identifyPatterns(input, _components);

    // Generate _insights
    const _insights = this.generateAnalyticalInsights(
      input,
      _components,
      _patterns,
    );

    // Define _methodology
    const _methodology = this.defineAnalyticalMethodology(
      _depth,
      _components.length,
    );

    // Calculate _confidence
    const _confidence = this.calculateAnalysisConfidence(
      input,
      _components,
      _patterns,
      _insights,
    );

    return {
      _depth,
      _components,
      _patterns,
      _insights,
      _methodology,
      _confidence,
    };
  }

  /**
   * Determine the _depth of _analysis required
   */
  private determineAnalysisDepth(
    input: string,
    metadata: unknown,
  ): "surface" | "intermediate" | "deep" {
    let score = 0;

    // Input length factor
    if (input.length > 500) {
      score += 3;
    } else if (input.length > 200) {
      score += 2;
    } else if (input.length > 100) {
      score += 1;
    }

    // Complexity indicators
    if (
      /systematic|comprehensive|thorough|detailed|exhaustive/.test(
        input.toLowerCase(),
      )
    ) {
      score += 3;
    }
    if (/analyze|examine|investigate|study/.test(input.toLowerCase())) {
      score += 2;
    }

    // Technical content
    if (
      /algorithm|architecture|structure|pattern|framework/.test(
        input.toLowerCase(),
      )
    ) {
      score += 2;
    }

    // Previous context
    if (metadata?.previousMode === "thinking") {
      score += 1;
    }

    if (score >= 6) {
      return "deep";
    }
    if (score >= 3) {
      return "intermediate";
    }
    return "surface";
  }

  /**
   * Identify key _components for _analysis
   */
  private identifyComponents(
    input: string,
    _language: string,
  ): Array<{
    name: string;
    type: string;
    significance: number;
  }> {
    const _components: Array<{
      name: string;
      type: string;
      significance: number;
    }> = [];

    // Extract technical entities
    const _technicalTerms =
      input.match(
        /\b(function|class|method|algorithm|database|api|server|client|user|data|code|system|application|service|component|module|library|framework)\w*\b/gi,
      ) || [];
    _technicalTerms.forEach((term) => {
      if (term.length > 3) {
        _components.push({
          name: term,
          type: "technical",
          significance: this.calculateTermSignificance(term, input),
        });
      }
    });

    // Extract business entities
    const _businessTerms =
      input.match(
        /\b(requirement|feature|user\s+story|workflow|process|business|customer|market|product|service|goal|objective|strategy)\w*\b/gi,
      ) || [];
    _businessTerms.forEach((term) => {
      _components.push({
        name: term,
        type: "business",
        significance: this.calculateTermSignificance(term, input),
      });
    });

    // Extract data entities
    const _dataTerms =
      input.match(
        /\b(data|information|record|table|field|column|row|entity|attribute|relationship)\w*\b/gi,
      ) || [];
    _dataTerms.forEach((term) => {
      _components.push({
        name: term,
        type: "data",
        significance: this.calculateTermSignificance(term, input),
      });
    });

    // Remove duplicates and sort by significance
    const _uniqueComponents = Array.from(
      new Map(_components.map((c) => [c.name.toLowerCase(), c])).values(),
    );

    return _uniqueComponents
      .sort((a, b) => b.significance - a.significance)
      .slice(0, 10); // Top 10 _components
  }

  /**
   * Calculate significance of a term
   */
  private calculateTermSignificance(_term: string, input: string): number {
    const _termLower = _term.toLowerCase();
    const _inputLower = input.toLowerCase();

    // Count _occurrences
    const _occurrences = (_inputLower.match(new RegExp(_termLower, "g")) || [])
      .length;

    // Base significance from frequency
    let significance = Math.min(_occurrences * 0.2, 1.0);

    // Boost for _position (early terms are more significant)
    const _position = _inputLower.indexOf(_termLower);
    if (_position >= 0) {
      const _positionFactor = 1.0 - _position / input.length;
      significance += _positionFactor * 0.3;
    }

    // Boost for term length (longer terms often more specific)
    significance += Math.min(_term.length * 0.02, 0.3);

    return Math.min(significance, 1.0);
  }

  /**
   * Identify _patterns in the input and _components
   */
  private identifyPatterns(_input: string, _components: unknown[]): string[] {
    const _patterns: string[] = [];

    // Structural _patterns
    if ((_components as any).filter((c: any) => c.type === "technical").length > 3) {
      _patterns.push("Technical architecture focus detected");
    }

    if ((_components as any).filter((c: any) => c.type === "business").length > 2) {
      _patterns.push("Business process _analysis required");
    }

    if ((_components as any).filter((c: any) => c.type === "data").length > 2) {
      _patterns.push("Data modeling and structure _analysis needed");
    }

    // Complexity _patterns
    const _sentences = _input
      .split(/[.!?]/)
      .filter((s) => s.trim().length > 10);
    if (_sentences.length > 5) {
      _patterns.push("Multi-faceted _analysis with multiple dimensions");
    }

    // Question _patterns
    const _questions = _input.match(/[?？]/g);
    if (_questions && _questions.length > 2) {
      _patterns.push("Multiple inquiry points requiring systematic examination");
    }

    // Conditional _patterns
    if (
      /if|when|unless|provided|given that|assuming/.test(_input.toLowerCase())
    ) {
      _patterns.push("Conditional _analysis with dependency considerations");
    }

    return _patterns;
  }

  /**
   * Generate analytical _insights
   */
  private generateAnalyticalInsights(
    input: string,
    _components: unknown[],
    _patterns: string[],
  ): string[] {
    const _insights: string[] = [];

    // Component-based _insights
    const _techComponents = (_components as any).filter((c: any) => c.type === "technical");
    if (_techComponents.length > 0) {
      const _avgSignificance =
        _techComponents.reduce((sum, c) => sum + c.significance, 0) /
        _techComponents.length;
      if (_avgSignificance > 0.6) {
        _insights.push(
          "High technical complexity requiring systematic decomposition",
        );
      }
    }

    // Pattern-based _insights
    if (_patterns.length > 3) {
      _insights.push(
        "Multiple analytical dimensions identified - comprehensive approach required",
      );
    }

    // Input structure _insights
    if (
      input.includes("however") ||
      input.includes("but") ||
      input.includes("although")
    ) {
      _insights.push(
        "Contradictory elements present - comparative _analysis needed",
      );
    }

    if (
      input.includes("because") ||
      input.includes("due to") ||
      input.includes("since")
    ) {
      _insights.push(
        "Causal relationships identified - root cause _analysis applicable",
      );
    }

    // Scope _insights
    if (input.length > 300) {
      _insights.push(
        "Extensive scope requiring structured analytical _methodology",
      );
    }

    return _insights.slice(0, 5); // Top 5 _insights
  }

  /**
   * Define analytical _methodology
   */
  private defineAnalyticalMethodology(
    _depth: string,
    _componentCount: number,
  ): string[] {
    const _methodology: string[] = [];

    switch (_depth) {
      case "deep":
        _methodology.push("Systematic decomposition into core _components");
        _methodology.push("Multi-dimensional pattern _analysis");
        _methodology.push("Cross-component relationship mapping");
        _methodology.push("Comprehensive impact assessment");
        _methodology.push("Synthesis of findings with actionable _insights");
        break;

      case "intermediate":
        _methodology.push("Component identification and categorization");
        _methodology.push("Pattern recognition and significance assessment");
        _methodology.push("Relationship _analysis between key elements");
        _methodology.push("Summary of findings and recommendations");
        break;

      default: // surface
        _methodology.push("Initial component identification");
        _methodology.push("Basic pattern recognition");
        _methodology.push("High-level assessment and overview");
        break;
    }

    return _methodology;
  }

  /**
   * Calculate _confidence in analytical results
   */
  private calculateAnalysisConfidence(
    input: string,
    _components: unknown[],
    _patterns: string[],
    _insights: string[],
  ): number {
    let _confidence = 0.6; // Base _confidence for analytical mode

    // Component quality factor
    if (_components.length > 5) {
      _confidence += 0.15;
    }
    if (_components.length > 8) {
      _confidence += 0.1;
    }

    // Pattern detection factor
    _confidence += Math.min(_patterns.length * 0.05, 0.15);

    // Insight generation factor
    _confidence += Math.min(_insights.length * 0.04, 0.12);

    // Input structure factor
    if (input.length > 200) {
      _confidence += 0.1;
    }
    if (input.includes("analyze") || input.includes("examine")) {
      _confidence += 0.08;
    }

    // High-significance _components boost
    const _highSigComponents = (_components as any).filter((c: any) => c.significance > 0.7);
    if (_highSigComponents.length > 0) {
      _confidence += Math.min(_highSigComponents.length * 0.03, 0.1);
    }

    return Math.min(Math.max(_confidence, 0.2), 0.95);
  }

  /**
   * Suggest next analytical mode
   */
  private suggestNextAnalyticalMode(
    _context: ModeContext,
    _analysis: unknown,
  ): string | undefined {
    const { input } = _context;
    const _normalizedInput = input.toLowerCase();

    // Suggest evaluation if assessment is needed
    if (/assess|evaluate|rate|score|judge|measure/.test(_normalizedInput)) {
      return "evaluating";
    }

    // Suggest comparison if multiple options are present
    if (/compare|versus|vs|alternative|option|choice/.test(_normalizedInput)) {
      return "comparing";
    }

    // Suggest research if more data is needed
    if (
      (_analysis as any).components.length < 3 ||
      /research|find|lookup|search/.test(_normalizedInput)
    ) {
      return "researching";
    }

    // Suggest debugging if errors are found
    if (/_error|bug|problem|issue|fail|wrong/.test(_normalizedInput)) {
      return "debugging";
    }

    return undefined; // Continue analyzing
  }

  /**
   * Format _analysis output
   */
  private formatAnalysisOutput(_analysis: unknown, language: string): string {
    const { _depth, _components, _patterns, _insights, _methodology } =
      _analysis as any;

    let output = "";

    // Add _analysis indicator
    switch (language) {
      case "japanese":
        output += "分析中... ";
        break;
      case "chinese":
        output += "分析中... ";
        break;
      case "korean":
        output += "분석 중... ";
        break;
      case "vietnamese":
        output += "Đang phân tích... ";
        break;
      default:
        output += "Analyzing... ";
    }

    output += `[${_depth} _analysis]\n\n`;

    // Components section
    if (_components.length > 0) {
      output += "Key Components Identified:\n";
      _components.forEach((comp: any, _index: number) => {
        output += `${_index + 1}. ${comp.name} (${comp.type}) - Significance: ${(comp.significance * 100).toFixed(0)}%\n`;
      });
      output += "\n";
    }

    // Patterns section
    if (_patterns.length > 0) {
      output += "Patterns Detected:\n";
      _patterns.forEach((pattern: any, _index: number) => {
        output += `• ${pattern}\n`;
      });
      output += "\n";
    }

    // Insights section
    if (_insights.length > 0) {
      output += "Analytical Insights:\n";
      _insights.forEach((insight: any, _index: number) => {
        output += `→ ${insight}\n`;
      });
      output += "\n";
    }

    // Methodology section
    output += "Analysis Methodology:\n";
    _methodology.forEach((step: any, _index: number) => {
      output += `${_index + 1}. ${step}\n`;
    });

    return output.trim();
  }
}
