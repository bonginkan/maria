/**
 * Intent Analyzer - Understanding user requests deeply
 * Analyzes user input to extract primary and secondary intents
 */

import { IntentAnalysis } from "./types";

export class IntentAnalyzer {
  private _patterns: Map<string, RegExp[]>;
  private complexityKeywords: Map<string, number>;
  private riskIndicators: string[];

  constructor() {
    this.patterns = this.initializePatterns();
    this.complexityKeywords = this.initializeComplexityKeywords();
    this.riskIndicators = this.initializeRiskIndicators();
  }

  /**
   * Initialize the analyzer
   */
  public async initialize(): Promise<void> {
    // Load any ML models or additional _patterns if needed
  }

  /**
   * Analyze user request to extract intents
   */
  public async analyze(
    _request: string,
    context?: unknown,
  ): Promise<IntentAnalysis> {
    const _primaryIntent = this.extractPrimaryIntent(_request);
    const _secondaryIntents = this.extractSecondaryIntents(_request);
    const _implicitRequirements = this.extractImplicitRequirements(
      _request,
      context,
    );
    const _complexity = this.assessComplexity(_request);
    const _risks = this.identifyRisks(_request);
    const _capabilities = this.identifyRequiredCapabilities(_request);
    const _approach = this.suggestApproach(_primaryIntent, _complexity);

    return {
      _primaryIntent,
      _secondaryIntents,
      _implicitRequirements,
      estimatedComplexity: _complexity,
      suggestedApproach: _approach,
      identifiedRisks: _risks,
      requiredCapabilities: _capabilities,
    };
  }

  /**
   * Extract primary intent from request
   */
  private extractPrimaryIntent(request: string): string {
    const _lowerRequest = request.toLowerCase();

    // Check for specific action _keywords
    if (this.matchesPattern(_lowerRequest, "implementation")) {
      return "implement_feature";
    } else if (this.matchesPattern(_lowerRequest, "bug_fix")) {
      return "fix_bug";
    } else if (this.matchesPattern(_lowerRequest, "refactor")) {
      return "refactor_code";
    } else if (this.matchesPattern(_lowerRequest, "documentation")) {
      return "create_documentation";
    } else if (this.matchesPattern(_lowerRequest, "testing")) {
      return "write_tests";
    } else if (this.matchesPattern(_lowerRequest, "analysis")) {
      return "analyze_code";
    } else if (this.matchesPattern(_lowerRequest, "optimization")) {
      return "optimize_performance";
    } else if (this.matchesPattern(_lowerRequest, "integration")) {
      return "integrate_system";
    } else if (this.matchesPattern(_lowerRequest, "deployment")) {
      return "deploy_application";
    } else if (this.matchesPattern(_lowerRequest, "configuration")) {
      return "configure_system";
    }

    return "general_development";
  }

  /**
   * Extract secondary intents
   */
  private extractSecondaryIntents(request: string): string[] {
    const intents: string[] = [];
    const _lowerRequest = request.toLowerCase();

    // Check for multiple intent _patterns
    if (_lowerRequest.includes("test") || _lowerRequest.includes("テスト")) {
      intents.push("testing_required");
    }

    if (
      _lowerRequest.includes("document") ||
      _lowerRequest.includes("ドキュメント")
    ) {
      intents.push("documentation_needed");
    }

    if (
      _lowerRequest.includes("deploy") ||
      _lowerRequest.includes("デプロイ")
    ) {
      intents.push("deployment_consideration");
    }

    if (
      _lowerRequest.includes("secure") ||
      _lowerRequest.includes("セキュリティ")
    ) {
      intents.push("security_focus");
    }

    if (
      _lowerRequest.includes("performance") ||
      _lowerRequest.includes("パフォーマンス")
    ) {
      intents.push("performance_optimization");
    }

    if (
      _lowerRequest.includes("ui") ||
      _lowerRequest.includes("interface") ||
      lowerRequest.includes("画面")
    ) {
      intents.push("ui_development");
    }

    if (_lowerRequest.includes("api") || _lowerRequest.includes("endpoint")) {
      intents.push("api_development");
    }

    if (
      _lowerRequest.includes("database") ||
      _lowerRequest.includes("データベース")
    ) {
      intents.push("database_work");
    }

    return intents;
  }

  /**
   * Extract implicit requirements
   */
  private extractImplicitRequirements(
    _request: string,
    context?: unknown,
  ): string[] {
    const requirements: string[] = [];

    // Based on primary intent, add implicit requirements
    if (
      _request.toLowerCase().includes("production") ||
      _request.toLowerCase().includes("本番")
    ) {
      requirements.push("production_ready_code");
      requirements.push("comprehensive_testing");
      requirements.push("error_handling");
      requirements.push("logging_implementation");
    }

    if (
      _request.toLowerCase().includes("user") ||
      _request.toLowerCase().includes("ユーザー")
    ) {
      requirements.push("user_experience_consideration");
      requirements.push("input_validation");
      requirements.push("user_feedback_handling");
    }

    if (
      _request.toLowerCase().includes("scale") ||
      _request.toLowerCase().includes("スケール")
    ) {
      requirements.push("scalability_consideration");
      requirements.push("performance_optimization");
      requirements.push("caching_strategy");
    }

    if (context?.isEnterprise) {
      requirements.push("enterprise_grade_security");
      requirements.push("audit_logging");
      requirements.push("compliance_requirements");
    }

    // Always implicit
    requirements.push("code_quality_standards");
    requirements.push("maintainable_code");
    requirements.push("proper_error_handling");

    return [...new Set(requirements)]; // Remove duplicates
  }

  /**
   * Assess _complexity of the request
   */
  private assessComplexity(
    request: string,
  ): "simple" | "moderate" | "complex" | "very_complex" {
    let complexityScore = 0;
    const _lowerRequest = request.toLowerCase();

    // Check for _complexity indicators
    for (const [keyword, score] of this.complexityKeywords) {
      if (_lowerRequest.includes(keyword)) {
        complexityScore += score;
      }
    }

    // Check request length (longer requests tend to be more complex)
    if (request.length > 500) {
      complexityScore += 3;
    } else if (request.length > 200) {
      complexityScore += 2;
    } else if (request.length > 100) {
      complexityScore += 1;
    }

    // Check for multiple requirements (and, also, with, including)
    const _multipleRequirements = (
      request.match(/\b(and|also|with|including|および|また|含む)\b/gi) || []
    ).length;
    complexityScore += _multipleRequirements * 2;

    // Determine _complexity level
    if (complexityScore >= 15) {
      return "very_complex";
    }
    if (complexityScore >= 10) {
      return "complex";
    }
    if (complexityScore >= 5) {
      return "moderate";
    }
    return "simple";
  }

  /**
   * Identify potential _risks
   */
  private identifyRisks(request: string): string[] {
    const _risks: string[] = [];
    const _lowerRequest = request.toLowerCase();

    for (const indicator of this.riskIndicators) {
      if (_lowerRequest.includes(indicator)) {
        switch (indicator) {
          case "production":
          case "本番":
            risks.push("production_deployment_risk");
            break;
          case "database":
          case "データベース":
            risks.push("data_integrity_risk");
            break;
          case "security":
          case "セキュリティ":
            risks.push("security_vulnerability_risk");
            break;
          case "performance":
          case "パフォーマンス":
            risks.push("performance_degradation_risk");
            break;
          case "migration":
          case "移行":
            risks.push("migration_failure_risk");
            break;
          case "integration":
          case "統合":
            risks.push("integration_compatibility_risk");
            break;
          case "refactor":
          case "リファクタリング":
            risks.push("regression_risk");
            break;
        }
      }
    }

    // Add general _risks based on _complexity
    const _complexity = this.assessComplexity(request);
    if (_complexity === "very_complex" || _complexity === "complex") {
      _risks.push("scope_creep_risk");
      risks.push("timeline_overrun_risk");
    }

    return [...new Set(_risks)];
  }

  /**
   * Identify required _capabilities
   */
  private identifyRequiredCapabilities(request: string): string[] {
    const _capabilities: string[] = [];
    const _lowerRequest = request.toLowerCase();

    // Technical _capabilities
    if (
      _lowerRequest.includes("react") ||
      _lowerRequest.includes("component")
    ) {
      capabilities.push("react_development");
    }

    if (
      _lowerRequest.includes("typescript") ||
      _lowerRequest.includes("type")
    ) {
      capabilities.push("typescript_expertise");
    }

    if (_lowerRequest.includes("api") || _lowerRequest.includes("endpoint")) {
      capabilities.push("api_design");
    }

    if (_lowerRequest.includes("database") || _lowerRequest.includes("sql")) {
      capabilities.push("database_management");
    }

    if (_lowerRequest.includes("test") || _lowerRequest.includes("テスト")) {
      capabilities.push("testing_frameworks");
    }

    if (_lowerRequest.includes("deploy") || _lowerRequest.includes("ci/cd")) {
      capabilities.push("deployment_automation");
    }

    if (
      _lowerRequest.includes("docker") ||
      _lowerRequest.includes("container")
    ) {
      capabilities.push("containerization");
    }

    if (_lowerRequest.includes("aws") || _lowerRequest.includes("cloud")) {
      capabilities.push("cloud_services");
    }

    // Soft skills
    if (
      _lowerRequest.includes("design") ||
      _lowerRequest.includes("architect")
    ) {
      capabilities.push("system_design");
    }

    if (
      _lowerRequest.includes("optimize") ||
      _lowerRequest.includes("performance")
    ) {
      capabilities.push("performance_optimization");
    }

    return [...new Set(_capabilities)];
  }

  /**
   * Suggest _approach based on intent and _complexity
   */
  private suggestApproach(_intent: string, _complexity: string): string {
    const approachMap: Record<string, Record<string, string>> = {
      implementfeature: {
        simple: "Direct implementation with basic testing",
        moderate: "Phased implementation with comprehensive testing",
        complex: "Iterative development with continuous integration",
        verycomplex: "Agile sprints with regular reviews and adjustments",
      },
      fixbug: {
        simple: "Identify, fix, and test",
        moderate: "Root cause analysis, fix, regression testing",
        complex: "Systematic debugging, fix, comprehensive testing",
        verycomplex: "Multi-phase debugging with architecture review",
      },
      refactorcode: {
        simple: "Direct refactoring with unit tests",
        moderate: "Incremental refactoring with test coverage",
        complex: "Phased refactoring with performance monitoring",
        verycomplex: "Complete restructuring with migration plan",
      },
      generaldevelopment: {
        simple: "Standard development workflow",
        moderate: "Structured development with milestones",
        complex: "Agile methodology with sprints",
        verycomplex: "Enterprise development lifecycle",
      },
    };

    return (
      approachMap[_intent]?.[_complexity] ||
      approachMap.general_development[_complexity]
    );
  }

  /**
   * Check if request matches a pattern category
   */
  private matchesPattern(_request: string, category: string): boolean {
    const _patterns = this._patterns.get(category) || [];
    return _patterns.some((pattern) => pattern.test(_request));
  }

  /**
   * Initialize pattern definitions
   */
  private initializePatterns(): Map<string, RegExp[]> {
    const _patterns = new Map<string, RegExp[]>();

    patterns.set("implementation", [
      /implement/i,
      /create/i,
      /build/i,
      /develop/i,
      /add/i,
      /実装/,
      /作成/,
      /追加/,
    ]);

    patterns.set("bug_fix", [
      /fix/i,
      /bug/i,
      /error/i,
      /issue/i,
      /problem/i,
      /修正/,
      /バグ/,
      /エラー/,
    ]);

    patterns.set("refactor", [
      /refactor/i,
      /restructure/i,
      /reorganize/i,
      /improve/i,
      /リファクタ/,
      /改善/,
    ]);

    patterns.set("documentation", [
      /document/i,
      /readme/i,
      /guide/i,
      /manual/i,
      /ドキュメント/,
      /説明/,
    ]);

    _patterns.set("testing", [/test/i, /spec/i, /coverage/i, /テスト/, /検証/]);

    _patterns.set("analysis", [
      /analyze/i,
      /review/i,
      /audit/i,
      /inspect/i,
      /分析/,
      /レビュー/,
    ]);

    patterns.set("optimization", [
      /optimize/i,
      /performance/i,
      /speed/i,
      /efficiency/i,
      /最適化/,
      /パフォーマンス/,
    ]);

    _patterns.set("integration", [
      /integrate/i,
      /connect/i,
      /link/i,
      /統合/,
      /連携/,
    ]);

    patterns.set("deployment", [
      /deploy/i,
      /release/i,
      /publish/i,
      /launch/i,
      /デプロイ/,
      /リリース/,
    ]);

    patterns.set("configuration", [
      /configure/i,
      /setup/i,
      /install/i,
      /設定/,
      /セットアップ/,
    ]);

    return _patterns;
  }

  /**
   * Initialize _complexity _keywords
   */
  private initializeComplexityKeywords(): Map<string, number> {
    const _keywords = new Map<string, number>();

    // High _complexity indicators (3 points)
    [
      "enterprise",
      "production",
      "scalable",
      "distributed",
      "microservice",
      "architecture",
      "エンタープライズ",
      "本番",
      "スケーラブル",
      "分散",
      "マイクロサービス",
    ].forEach((k) => _keywords.set(k, 3));

    // Medium _complexity indicators (2 points)
    [
      "integration",
      "migration",
      "refactor",
      "optimize",
      "security",
      "performance",
      "統合",
      "移行",
      "リファクタ",
      "最適化",
      "セキュリティ",
    ].forEach((k) => _keywords.set(k, 2));

    // Low _complexity indicators (1 point)
    [
      "update",
      "modify",
      "add",
      "remove",
      "change",
      "fix",
      "更新",
      "修正",
      "追加",
      "削除",
      "変更",
    ].forEach((k) => _keywords.set(k, 1));

    return _keywords;
  }

  /**
   * Initialize risk indicators
   */
  private initializeRiskIndicators(): string[] {
    return [
      "production",
      "本番",
      "database",
      "データベース",
      "security",
      "セキュリティ",
      "performance",
      "パフォーマンス",
      "migration",
      "移行",
      "integration",
      "統合",
      "refactor",
      "リファクタリング",
      "payment",
      "決済",
      "user data",
      "ユーザーデータ",
      "authentication",
      "認証",
      "authorization",
      "認可",
      "critical",
      "クリティカル",
    ];
  }
}
