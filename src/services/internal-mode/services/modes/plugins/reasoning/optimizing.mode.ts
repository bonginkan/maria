/**
 * Optimizing Mode Plugin - Performance optimization and improvement mode
 * Specialized for analyzing and improving efficiency, performance, and quality
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from "../BaseMode";

export default class OptimizingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: "optimizing",
      name: "Optimizing",
      category: "reasoning",
      symbol: "⚡",
      color: "yellow",
      description:
        "処理や出力の効率化・改善を行う - パフォーマンス最適化とクオリティ向上専門モード",
      keywords: [
        "optimize",
        "improve",
        "enhance",
        "performance",
        "efficiency",
        "speed",
        "faster",
        "better",
        "refactor",
        "streamline",
        "reduce",
        "minimize",
        "maximize",
        "quality",
        "upgrade",
      ],
      triggers: [
        "optimize",
        "improve",
        "make it faster",
        "make it better",
        "enhance",
        "performance",
        "efficiency",
        "speed up",
        "reduce time",
        "save memory",
        "less resources",
      ],
      examples: [
        "Optimize this code for better performance",
        "How can I improve the efficiency of this algorithm?",
        "Make this process faster",
        "Enhance the quality of this output",
        "Reduce the memory usage of this function",
      ],
      enabled: true,
      priority: 7,
      timeout: 90000, // 1.5 minutes for thorough optimization _analysis
      maxConcurrentSessions: 8,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(
      `[${this.config.id}] Activating optimization mode for session ${context.sessionId}`,
    );

    this.emit("display:update", {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: "Optimizing...",
      color: this.config.color,
      sessionId: context.sessionId,
      animation: "pulse",
    });

    this.emit("analytics:event", {
      type: "mode_activation",
      mode: this.config.id,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      metadata: {
        previousMode: context.previousMode,
        optimizationTarget: this.identifyOptimizationTarget(
          context.input || "",
        ),
      },
    });
  }

  protected async onDeactivate(sessionId: string): Promise<void> {
    console.log(
      `[${this.config.id}] Deactivating optimization mode for session ${sessionId}`,
    );

    this.emit("analytics:event", {
      type: "mode_deactivation",
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(
    _input: string,
    context: ModeContext,
  ): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing optimization request: "${_input.substring(0, 50)}..."`,
    );

    // Multi-phase optimization _analysis
    const _currentState = await this.analyzeCurrentState(_input, context);
    const _optimizationOpportunities =
      await this.identifyOptimizationOpportunities(input, _currentState);
    const _optimizationPlan = await this.createOptimizationPlan(
      _optimizationOpportunities,
    );
    const _recommendations =
      await this.generateRecommendations(_optimizationPlan);

    // Calculate _confidence based on _analysis depth
    const _confidence = this.calculateOptimizationConfidence(
      _optimizationOpportunities,
      _input,
    );

    return {
      success: true,
      output: this.formatOptimizationReport(
        _currentState,
        _optimizationPlan,
        _recommendations,
      ),
      suggestions: this.generateActionableSuggestions(_optimizationPlan),
      nextRecommendedMode: this.determineNextMode(_optimizationPlan),
      _confidence,
      metadata: {
        _currentState,
        opportunitiesFound: _optimizationOpportunities.length,
        _optimizationPlan,
        analysisDepth: this.calculateAnalysisDepth(_input),
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    _context: ModeContext,
  ): Promise<{ _confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let _confidence = 0;

    const _inputLower = input.toLowerCase();

    // Strong optimization _indicators
    const _strongIndicators = [
      "optimize",
      "improve",
      "enhance",
      "performance",
      "faster",
      "efficient",
      "speed up",
      "make better",
      "reduce",
    ];

    const _strongMatches = _strongIndicators.filter((indicator) =>
      _inputLower.includes(indicator),
    );
    if (_strongMatches.length > 0) {
      _confidence += Math.min(0.6, _strongMatches.length * 0.2);
      reasoning.push(
        `Strong optimization _indicators: ${_strongMatches.join(", ")}`,
      );
    }

    // Performance-related keywords
    const _performanceKeywords = [
      "slow",
      "memory",
      "cpu",
      "resource",
      "bottleneck",
      "latency",
      "throughput",
      "scalability",
      "load",
      "cache",
      "database",
    ];

    const _perfMatches = _performanceKeywords.filter((keyword) =>
      _inputLower.includes(keyword),
    );
    if (_perfMatches.length > 0) {
      _confidence += Math.min(0.3, _perfMatches.length * 0.1);
      reasoning.push(`Performance keywords found: ${_perfMatches.join(", ")}`);
    }

    // Quality improvement _indicators
    const _qualityIndicators = [
      "better",
      "cleaner",
      "refactor",
      "restructure",
      "quality",
    ];
    const _qualityMatches = _qualityIndicators.filter((indicator) =>
      _inputLower.includes(indicator),
    );
    if (_qualityMatches.length > 0) {
      _confidence += Math.min(0.2, _qualityMatches.length * 0.1);
      reasoning.push(
        `Quality improvement _indicators: ${_qualityMatches.join(", ")}`,
      );
    }

    // Code-related optimization
    if (this.containsCode(input)) {
      _confidence += 0.15;
      reasoning.push("Code detected - optimization mode highly relevant");
    }

    // Numeric/metric mentions suggest measurable optimization
    if (this.containsMetrics(input)) {
      _confidence += 0.1;
      reasoning.push("Metrics mentioned - quantifiable optimization possible");
    }

    return { _confidence: Math.min(_confidence, 1.0), reasoning };
  }

  /**
   * Analyze current state for optimization opportunities
   */
  private async analyzeCurrentState(
    _input: string,
    _context: ModeContext,
  ): Promise<unknown> {
    const _analysis = {
      type: this.classifyOptimizationType(_input),
      complexity: this.assessComplexity(_input),
      domain: this.identifyDomain(_input),
      currentMetrics: this.extractCurrentMetrics(_input),
      constraints: this.identifyConstraints(_input),
      codePresent: this.containsCode(_input),
      dataPresent: this.containsData(_input),
    };

    return _analysis;
  }

  /**
   * Identify optimization opportunities
   */
  private async identifyOptimizationOpportunities(
    _input: string,
    _currentState: unknown,
  ): Promise<unknown[]> {
    const opportunities: unknown[] = [];

    // Performance optimization opportunities
    if (_currentState.type === "performance") {
      opportunities.push({
        category: "performance",
        type: "algorithm_optimization",
        description: "Optimize algorithms for better time complexity",
        impact: "high",
        effort: "medium",
      });

      opportunities.push({
        category: "performance",
        type: "memory_optimization",
        description: "Reduce memory usage and improve garbage collection",
        impact: "medium",
        effort: "medium",
      });
    }

    // Code quality opportunities
    if (_currentState.codePresent) {
      opportunities.push({
        category: "quality",
        type: "code_refactoring",
        description: "Refactor code for better readability and maintainability",
        impact: "medium",
        effort: "low",
      });

      opportunities.push({
        category: "quality",
        type: "design_patterns",
        description: "Apply design patterns for better architecture",
        impact: "high",
        effort: "high",
      });
    }

    // Process optimization opportunities
    if (_currentState.type === "process") {
      opportunities.push({
        category: "process",
        type: "workflow_streamlining",
        description: "Streamline workflow to reduce unnecessary steps",
        impact: "medium",
        effort: "low",
      });
    }

    // Resource optimization opportunities
    opportunities.push({
      category: "resource",
      type: "resource_utilization",
      description: "Optimize resource allocation and usage",
      impact: "medium",
      effort: "medium",
    });

    return opportunities;
  }

  /**
   * Create optimization plan
   */
  private async createOptimizationPlan(
    opportunities: unknown[],
  ): Promise<unknown> {
    // Sort opportunities by impact/effort ratio
    const _prioritizedOpportunities = opportunities
      .map((opp) => ({
        ...opp,
        priority: this.calculatePriority(opp.impact, opp.effort),
      }))
      .sort((a, b) => b.priority - a.priority);

    return {
      phase1: _prioritizedOpportunities.slice(0, 2), // Quick wins
      phase2: _prioritizedOpportunities.slice(2, 4), // Medium-term improvements
      phase3: _prioritizedOpportunities.slice(4), // Long-term optimizations
      estimatedImpact: this.calculateOverallImpact(_prioritizedOpportunities),
      timeline: this.estimateTimeline(_prioritizedOpportunities),
    };
  }

  /**
   * Generate optimization _recommendations
   */
  private async generateRecommendations(
    _optimizationPlan: unknown,
  ): Promise<string[]> {
    const _recommendations: string[] = [];

    // Phase 1 _recommendations (immediate actions)
    if (_optimizationPlan.phase1.length > 0) {
      recommendations.push("Immediate optimizations:");
      optimizationPlan.phase1.forEach((_opp: unknown, index: number) => {
        recommendations.push(
          `${index + 1}. ${_opp.description} (${_opp.impact} impact, ${_opp.effort} effort)`,
        );
      });
    }

    // Phase 2 _recommendations (medium-term)
    if (_optimizationPlan.phase2.length > 0) {
      _recommendations.push("");
      recommendations.push("Medium-term improvements:");
      optimizationPlan.phase2.forEach((_opp: unknown, index: number) => {
        recommendations.push(
          `${index + 1}. ${_opp.description} (${_opp.impact} impact, ${_opp.effort} effort)`,
        );
      });
    }

    // General optimization principles
    _recommendations.push("");
    _recommendations.push("General optimization principles:");
    _recommendations.push("• Measure before optimizing");
    _recommendations.push("• Focus on bottlenecks first");
    _recommendations.push("• Consider trade-offs between different metrics");
    recommendations.push("• Test optimizations thoroughly");

    return _recommendations;
  }

  /**
   * Format optimization _report
   */
  private formatOptimizationReport(
    _currentState: unknown,
    _optimizationPlan: unknown,
    _recommendations: string[],
  ): string {
    const _report = [
      "⚡ OPTIMIZATION ANALYSIS REPORT",
      "================================",
      "",
      `Analysis Type: ${_currentState.type}`,
      `Domain: ${_currentState.domain}`,
      `Complexity: ${_currentState.complexity}`,
      "",
      `Optimization Opportunities Found: ${_optimizationPlan.phase1.length + _optimizationPlan.phase2.length + _optimizationPlan.phase3.length}`,
      `Estimated Overall Impact: ${_optimizationPlan.estimatedImpact}`,
      `Estimated Timeline: ${_optimizationPlan.timeline}`,
      "",
      ..._recommendations,
      "",
      "Remember: Optimization is an iterative process. Measure, optimize, and validate results.",
    ];

    return _report.join("\n");
  }

  /**
   * Generate actionable suggestions
   */
  private generateActionableSuggestions(_optimizationPlan: unknown): string[] {
    const suggestions: string[] = [];

    if (_optimizationPlan.phase1.length > 0) {
      suggestions.push(
        `Start with ${_optimizationPlan.phase1[0].description.toLowerCase()}`,
      );
    }

    suggestions.push(
      "Profile and measure current performance before optimizing",
    );
    suggestions.push(
      "Consider switching to debugging mode if issues are found",
    );
    suggestions.push("Use researching mode to explore optimization techniques");

    return suggestions;
  }

  /**
   * Classify optimization type
   */
  private classifyOptimizationType(input: string): string {
    const _inputLower = input.toLowerCase();

    if (
      _inputLower.includes("performance") ||
      _inputLower.includes("speed") ||
      inputLower.includes("fast")
    ) {
      return "performance";
    }

    if (_inputLower.includes("memory") || _inputLower.includes("resource")) {
      return "resource";
    }

    if (
      _inputLower.includes("quality") ||
      _inputLower.includes("clean") ||
      inputLower.includes("refactor")
    ) {
      return "quality";
    }

    if (_inputLower.includes("process") || _inputLower.includes("workflow")) {
      return "process";
    }

    return "general";
  }

  /**
   * Assess optimization complexity
   */
  private assessComplexity(input: string): string {
    const _indicators = {
      simple: ["variable", "function", "loop"],
      moderate: ["algorithm", "database", "api", "structure"],
      complex: ["architecture", "system", "distributed", "scalability"],
      advanced: [
        "microservices",
        "cluster",
        "optimization",
        "performance tuning",
      ],
    };

    const _inputLower = input.toLowerCase();

    for (const [level, keywords] of Object.entries(_indicators)) {
      if (keywords.some((keyword) => _inputLower.includes(keyword))) {
        return level;
      }
    }

    return "simple";
  }

  /**
   * Identify optimization domain
   */
  private identifyDomain(input: string): string {
    const _domains = {
      code: ["function", "algorithm", "code", "programming"],
      database: ["query", "database", "sql", "index"],
      system: ["system", "server", "infrastructure"],
      process: ["process", "workflow", "procedure"],
      ui: ["interface", "user experience", "frontend"],
    };

    const _inputLower = input.toLowerCase();

    for (const [domain, keywords] of Object.entries(_domains)) {
      if (keywords.some((keyword) => _inputLower.includes(keyword))) {
        return domain;
      }
    }

    return "general";
  }

  /**
   * Extract current metrics from input
   */
  private extractCurrentMetrics(input: string): unknown {
    const metrics: unknown = {};

    // Look for time-related metrics
    const _timeMatch = input.match(
      /(\d+(?:\.\d+)?)\s*(ms|milliseconds|seconds|minutes)/i,
    );
    if (_timeMatch) {
      metrics.currentTime = _timeMatch[0];
    }

    // Look for memory metrics
    const _memoryMatch = input.match(/(\d+(?:\.\d+)?)\s*(mb|gb|kb|bytes)/i);
    if (_memoryMatch) {
      metrics.currentMemory = _memoryMatch[0];
    }

    // Look for percentage metrics
    const _percentMatch = input.match(/(\d+(?:\.\d+)?)%/);
    if (_percentMatch) {
      metrics.currentPercentage = _percentMatch[0];
    }

    return metrics;
  }

  /**
   * Identify constraints
   */
  private identifyConstraints(input: string): string[] {
    const constraints: string[] = [];
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("budget") || _inputLower.includes("cost")) {
      constraints.push("budget");
    }

    if (_inputLower.includes("time") || _inputLower.includes("deadline")) {
      constraints.push("time");
    }

    if (
      _inputLower.includes("compatibility") ||
      _inputLower.includes("legacy")
    ) {
      constraints.push("compatibility");
    }

    if (_inputLower.includes("security")) {
      constraints.push("security");
    }

    return constraints;
  }

  /**
   * Check if input contains code
   */
  private containsCode(input: string): boolean {
    const _codeIndicators = [
      "function",
      "class",
      "def",
      "var",
      "let",
      "const",
      "{",
      "}",
      "()",
      "=>",
      "return",
      "if",
      "for",
      "while",
    ];

    return _codeIndicators.some((indicator) => input.includes(indicator));
  }

  /**
   * Check if input contains data/metrics
   */
  private containsData(input: string): boolean {
    return (
      /\d+/.test(input) &&
      (input.includes("%") ||
        input.includes("ms") ||
        input.includes("mb") ||
        input.includes("gb") ||
        input.includes("seconds"))
    );
  }

  /**
   * Check if input contains metrics
   */
  private containsMetrics(input: string): boolean {
    const _metricKeywords = [
      "time",
      "speed",
      "memory",
      "cpu",
      "performance",
      "latency",
      "throughput",
      "response time",
    ];

    const _inputLower = input.toLowerCase();
    return (
      metricKeywords.some((keyword) => _inputLower.includes(keyword)) ||
      /\d+\s*(ms|mb|gb|%|seconds|minutes)/.test(input)
    );
  }

  /**
   * Calculate optimization priority
   */
  private calculatePriority(_impact: string, effort: string): number {
    const _impactScore = { high: 3, medium: 2, low: 1 }[_impact] || 1;
    const _effortScore = { low: 3, medium: 2, high: 1 }[effort] || 1;
    return _impactScore * _effortScore;
  }

  /**
   * Calculate overall optimization impact
   */
  private calculateOverallImpact(opportunities: unknown[]): string {
    const _highImpactCount = opportunities.filter(
      (opp) => opp.impact === "high",
    ).length;
    const _totalCount = opportunities.length;

    if (_highImpactCount / _totalCount > 0.6) {
      return "High";
    }
    if (_highImpactCount / _totalCount > 0.3) {
      return "Medium-High";
    }
    return "Medium";
  }

  /**
   * Estimate implementation timeline
   */
  private estimateTimeline(opportunities: unknown[]): string {
    const _effortCounts = {
      low: opportunities.filter((opp) => opp.effort === "low").length,
      medium: opportunities.filter((opp) => opp.effort === "medium").length,
      high: opportunities.filter((opp) => opp.effort === "high").length,
    };

    const _totalEffort =
      _effortCounts.low * 1 + _effortCounts.medium * 3 + _effortCounts.high * 8;

    if (_totalEffort <= 5) {
      return "1-2 weeks";
    }
    if (_totalEffort <= 15) {
      return "2-4 weeks";
    }
    if (_totalEffort <= 30) {
      return "1-2 months";
    }
    return "2+ months";
  }

  /**
   * Calculate optimization _confidence
   */
  private calculateOptimizationConfidence(
    _opportunities: unknown[],
    input: string,
  ): number {
    let _confidence = 0.7; // Base _confidence

    // More opportunities = higher _confidence
    _confidence += Math.min(0.2, _opportunities.length * 0.05);

    // Presence of metrics increases _confidence
    if (this.containsMetrics(input)) {
      _confidence += 0.1;
    }

    // Code presence increases _confidence for code optimization
    if (this.containsCode(input)) {
      _confidence += 0.1;
    }

    return Math.min(_confidence, 0.95);
  }

  /**
   * Calculate _analysis depth
   */
  private calculateAnalysisDepth(input: string): number {
    let depth = 1;

    if (this.containsCode(input)) {
      depth++;
    }
    if (this.containsMetrics(input)) {
      depth++;
    }
    if (input.length > 100) {
      depth++;
    }
    if (this.identifyConstraints(input).length > 0) {
      depth++;
    }

    return depth;
  }

  /**
   * Identify optimization target
   */
  private identifyOptimizationTarget(input: string): string {
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("algorithm")) {
      return "algorithm";
    }
    if (_inputLower.includes("database")) {
      return "database";
    }
    if (_inputLower.includes("ui") || _inputLower.includes("interface")) {
      return "user_interface";
    }
    if (_inputLower.includes("api")) {
      return "api";
    }
    if (_inputLower.includes("system")) {
      return "system";
    }

    return "general";
  }

  /**
   * Determine next recommended mode
   */
  private determineNextMode(_optimizationPlan: unknown): string | undefined {
    // If many opportunities found, might need research
    if (_optimizationPlan.phase1.length + _optimizationPlan.phase2.length > 4) {
      return "researching";
    }

    // If code refactoring needed, might switch to reviewing
    const _hasCodeQuality = _optimizationPlan.phase1.some(
      (_opp: unknown) => _opp.category === "quality",
    );
    if (_hasCodeQuality) {
      return "reviewing";
    }

    return undefined;
  }
}
