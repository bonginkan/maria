/**
 * Approval Context Analyzer
 * Analyzes user tasks to identify approval points and appropriate themes
 */

import {
  ApprovalCategory,
  ApprovalPoint,
  ApprovalTheme,
  _RiskLevel,
  TaskContext,
  TrustLevel,
} from "./types";
import { ApprovalThemeRegistry } from "./ApprovalThemeRegistry";

interface AnalysisResult {
  _recommendedThemes: ApprovalTheme[];
  _approvalPoints: ApprovalPoint[];
  suggestedCategory: ApprovalCategory;
  _confidence: number;
  _reasoning: string[];
}

interface KeywordPattern {
  keywords: string[];
  _category: ApprovalCategory;
  weight: number;
  riskIndicator?: RiskLevel;
}

export class ApprovalContextAnalyzer {
  private static readonly categoryPatterns: KeywordPattern[] = [
    // Architecture patterns
    {
      keywords: [
        "api",
        "endpoint",
        "route",
        "service",
        "microservice",
        "architecture",
        "design",
        "schema",
        "database",
        "migration",
      ],
      _category: "architecture",
      weight: 1.0,
      riskIndicator: "high",
    },
    {
      keywords: [
        "new service",
        "create service",
        "add service",
        "service design",
      ],
      _category: "architecture",
      weight: 1.2,
      riskIndicator: "critical",
    },

    // Implementation patterns
    {
      keywords: [
        "implement",
        "add feature",
        "create function",
        "build",
        "develop",
        "code",
      ],
      _category: "implementation",
      weight: 0.8,
      riskIndicator: "medium",
    },
    {
      keywords: ["bug fix", "fix bug", "resolve issue", "patch", "hotfix"],
      _category: "implementation",
      weight: 0.6,
      riskIndicator: "low",
    },
    {
      keywords: [
        "integrate",
        "integration",
        "third party",
        "external api",
        "library",
      ],
      _category: "implementation",
      weight: 1.0,
      riskIndicator: "high",
    },

    // Refactoring patterns
    {
      keywords: [
        "refactor",
        "optimize",
        "improve",
        "restructure",
        "cleanup",
        "reorganize",
      ],
      _category: "refactoring",
      weight: 0.7,
      riskIndicator: "medium",
    },
    {
      keywords: [
        "performance",
        "speed up",
        "faster",
        "optimize performance",
        "bottleneck",
      ],
      _category: "refactoring",
      weight: 0.8,
      riskIndicator: "medium",
    },
    {
      keywords: [
        "update dependencies",
        "upgrade",
        "dependency update",
        "package update",
      ],
      _category: "refactoring",
      weight: 0.9,
      riskIndicator: "medium",
    },

    // Security patterns
    {
      keywords: [
        "security",
        "auth",
        "authentication",
        "authorization",
        "permission",
        "encrypt",
        "decrypt",
      ],
      _category: "security",
      weight: 1.5,
      riskIndicator: "critical",
    },
    {
      keywords: [
        "password",
        "token",
        "jwt",
        "oauth",
        "ssl",
        "tls",
        "certificate",
      ],
      _category: "security",
      weight: 1.4,
      riskIndicator: "critical",
    },
    {
      keywords: [
        "vulnerability",
        "security fix",
        "patch security",
        "exploit",
        "xss",
        "sql injection",
      ],
      _category: "security",
      weight: 1.6,
      riskIndicator: "critical",
    },

    // Performance patterns
    {
      keywords: ["cache", "caching", "redis", "memcached", "performance cache"],
      _category: "performance",
      weight: 0.8,
      riskIndicator: "medium",
    },
    {
      keywords: [
        "scale",
        "scaling",
        "load balancer",
        "horizontal scaling",
        "vertical scaling",
      ],
      _category: "performance",
      weight: 1.1,
      riskIndicator: "high",
    },
    {
      keywords: [
        "database optimization",
        "query optimization",
        "index",
        "performance tuning",
      ],
      _category: "performance",
      weight: 0.9,
      riskIndicator: "medium",
    },
  ];

  private static readonly riskKeywords = {
    critical: [
      "critical",
      "production",
      "live",
      "security",
      "authentication",
      "database schema",
      "migration",
    ],
    high: [
      "api",
      "integration",
      "service",
      "architecture",
      "breaking change",
      "major",
    ],
    medium: ["feature", "enhancement", "refactor", "optimization", "update"],
    low: ["bug fix", "typo", "comment", "documentation", "style", "formatting"],
  };

  private static readonly urgencyKeywords = [
    "urgent",
    "emergency",
    "critical",
    "asap",
    "immediately",
    "hotfix",
    "quick fix",
  ];

  /**
   * Analyze task context to determine approval requirements
   */
  static async analyzeTaskForApproval(
    context: TaskContext,
  ): Promise<AnalysisResult> {
    const _userInput = context._userInput.toLowerCase();

    // Analyze _category
    const _categoryAnalysis = this.analyzeCategoryFromInput(_userInput);

    // Analyze _risk indicators
    const _riskAnalysis = this.analyzeRiskIndicators(_userInput);

    // Get recommended themes based on _analysis
    const _recommendedThemes = this.getRecommendedThemes(
      categoryAnalysis.category,
      _riskAnalysis,
      context,
    );

    // Identify specific approval points
    const _approvalPoints = this.identifyApprovalPoints(
      _userInput,
      categoryAnalysis.category,
      context,
    );

    // Generate _reasoning
    const _reasoning = this.generateReasoning(
      _categoryAnalysis,
      _riskAnalysis,
      context,
      recommendedThemes.length,
    );

    return {
      _recommendedThemes,
      _approvalPoints,
      suggestedCategory: _categoryAnalysis.category,
      _confidence: _categoryAnalysis.confidence,
      _reasoning,
    };
  }

  /**
   * Analyze _category from user input
   */
  private static analyzeCategoryFromInput(input: string): {
    _category: ApprovalCategory;
    _confidence: number;
  } {
    const categoryScores: Record<ApprovalCategory, number> = {
      architecture: 0,
      implementation: 0,
      refactoring: 0,
      security: 0,
      performance: 0,
    };

    // Score each _category based on keyword matches
    for (const pattern of this.categoryPatterns) {
      for (const keyword of pattern.keywords) {
        if (input.includes(keyword)) {
          categoryScores[pattern.category] += pattern.weight;
        }
      }
    }

    // Find the _category with highest score
    const _topCategory = Object.entries(categoryScores).reduce((a, b) =>
      categoryScores[a[0] as ApprovalCategory] >
      categoryScores[b[0] as ApprovalCategory]
        ? a
        : b,
    )[0] as ApprovalCategory;

    const _topScore = categoryScores[_topCategory];
    const _totalScore = Object.values(categoryScores).reduce(
      (sum, score) => sum + score,
      0,
    );

    // Calculate _confidence (0-1)
    const _confidence =
      _totalScore > 0 ? Math.min(_topScore / _totalScore, 1.0) : 0;

    return {
      _category: _topCategory,
      _confidence,
    };
  }

  /**
   * Analyze _risk indicators in user input
   */
  private static analyzeRiskIndicators(input: string): {
    _risk: RiskLevel;
    factors: string[];
  } {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Check for each _risk level
    for (const [level, keywords] of Object.entries(this.riskKeywords)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          riskFactors.push(`${level}: ${keyword}`);

          // Add to _risk score
          switch (level) {
            case "critical":
              riskScore += 4;
              break;
            case "high":
              riskScore += 3;
              break;
            case "medium":
              riskScore += 2;
              break;
            case "low":
              riskScore += 1;
              break;
          }
        }
      }
    }

    // Check for urgency indicators
    const _hasUrgency = this.urgencyKeywords.some((keyword) =>
      input.includes(keyword),
    );
    if (_hasUrgency) {
      riskScore += 2;
      riskFactors.push("urgency indicator detected");
    }

    // Determine overall _risk level
    let _risk: RiskLevel;
    if (riskScore >= 8) {
      _risk = "critical";
    } else if (riskScore >= 5) {
      _risk = "high";
    } else if (riskScore >= 3) {
      _risk = "medium";
    } else {
      _risk = "low";
    }

    return { _risk, factors: riskFactors };
  }

  /**
   * Get recommended themes based on _analysis
   */
  private static getRecommendedThemes(
    _category: ApprovalCategory,
    _riskAnalysis: { _risk: RiskLevel; factors: string[] },
    context: TaskContext,
  ): ApprovalTheme[] {
    // Get themes for the identified _category
    let themes = ApprovalThemeRegistry.getThemesByCategory(_category);

    // Filter by _risk level if appropriate
    if (_riskAnalysis.risk === "critical") {
      // For critical _risk, only show critical/high impact themes
      themes = themes.filter(
        (theme) => theme.impact === "critical" || theme.impact === "high",
      );
    }

    // Consider trust level
    if (context.userTrustLevel === TrustLevel.NOVICE) {
      // For novice users, show all relevant themes
      return themes;
    } else if (context.userTrustLevel === TrustLevel.AUTONOMOUS) {
      // For autonomous users, only show critical themes
      return themes.filter((theme) => theme.impact === "critical");
    }

    // For other trust levels, filter based on what requires confirmation
    return themes.filter((theme) => {
      if (theme.impact === "critical") {
        return true;
      }
      if (
        theme.impact === "high" &&
        context.userTrustLevel !== TrustLevel.TRUSTED
      ) {
        return true;
      }
      if (
        theme.requiresConfirmation &&
        context.userTrustLevel === TrustLevel.LEARNING
      ) {
        return true;
      }
      return false;
    });
  }

  /**
   * Identify specific approval points
   */
  private static identifyApprovalPoints(
    input: string,
    _category: ApprovalCategory,
    _context: TaskContext,
  ): ApprovalPoint[] {
    const points: ApprovalPoint[] = [];

    // Database-related approval points
    if (
      input.includes("database") ||
      input.includes("migration") ||
      input.includes("schema")
    ) {
      points.push({
        id: "database-changes",
        _category: "architecture",
        description: "Database schema or data changes detected",
        triggerConditions: [
          "database modification",
          "schema change",
          "migration",
        ],
        priority: 1,
        mandatory: true,
      });
    }

    // Security-related approval points
    if (_category === "security" || this.hasSecurityKeywords(input)) {
      points.push({
        id: "security-review",
        _category: "security",
        description: "Security-sensitive changes require review",
        triggerConditions: [
          "authentication",
          "authorization",
          "encryption",
          "security",
        ],
        priority: 1,
        mandatory: true,
      });
    }

    // API-related approval points
    if (
      input.includes("api") ||
      input.includes("endpoint") ||
      input.includes("route")
    ) {
      points.push({
        id: "api-changes",
        _category: "architecture",
        description: "API modifications may affect external systems",
        triggerConditions: [
          "api change",
          "endpoint modification",
          "route update",
        ],
        priority: 2,
        mandatory: _category === "architecture",
      });
    }

    // Dependency-related approval points
    if (
      input.includes("dependency") ||
      input.includes("package") ||
      input.includes("library")
    ) {
      points.push({
        id: "dependency-update",
        _category: "refactoring",
        description: "Dependency changes may introduce compatibility issues",
        triggerConditions: [
          "dependency update",
          "package change",
          "library modification",
        ],
        priority: 3,
        mandatory: false,
      });
    }

    // Production/deployment approval points
    if (
      input.includes("production") ||
      input.includes("deploy") ||
      input.includes("live")
    ) {
      points.push({
        id: "production-deployment",
        _category: "architecture",
        description: "Production deployment requires careful review",
        triggerConditions: [
          "production change",
          "deployment",
          "live environment",
        ],
        priority: 1,
        mandatory: true,
      });
    }

    return points.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if input contains security-related keywords
   */
  private static hasSecurityKeywords(input: string): boolean {
    const _securityKeywords = [
      "auth",
      "security",
      "password",
      "token",
      "encrypt",
      "decrypt",
      "oauth",
      "jwt",
      "ssl",
      "tls",
      "permission",
      "access control",
    ];

    return _securityKeywords.some((keyword) => input.includes(keyword));
  }

  /**
   * Generate human-readable _reasoning for the _analysis
   */
  private static generateReasoning(
    _categoryAnalysis: { _category: ApprovalCategory; _confidence: number },
    _riskAnalysis: { _risk: RiskLevel; factors: string[] },
    context: TaskContext,
    themeCount: number,
  ): string[] {
    const _reasoning: string[] = [];

    // Category _reasoning
    if (_categoryAnalysis.confidence > 0.7) {
      reasoning.push(
        `High _confidence (${Math.round(_categoryAnalysis.confidence * 100)}%) this is a ${_categoryAnalysis.category} task`,
      );
    } else if (_categoryAnalysis.confidence > 0.4) {
      reasoning.push(
        `Moderate _confidence (${Math.round(_categoryAnalysis.confidence * 100)}%) this is a ${_categoryAnalysis.category} task`,
      );
    } else {
      reasoning.push(
        `Low _confidence in _category classification, defaulting to ${_categoryAnalysis.category}`,
      );
    }

    // Risk _reasoning
    if (_riskAnalysis.risk === "critical") {
      reasoning.push("Critical _risk detected - requires mandatory approval");
    } else if (_riskAnalysis.risk === "high") {
      reasoning.push("High _risk detected - approval recommended");
    } else if (_riskAnalysis.risk === "medium") {
      reasoning.push(
        "Medium _risk detected - consider approval based on trust level",
      );
    } else {
      reasoning.push("Low _risk detected - may proceed with minimal oversight");
    }

    // Risk factors
    if (_riskAnalysis.factors.length > 0) {
      reasoning.push(`Risk factors: ${_riskAnalysis.factors.join(", ")}`);
    }

    // Trust level considerations
    switch (context.userTrustLevel) {
      case TrustLevel.NOVICE:
        reasoning.push("Novice trust level - all changes require approval");
        break;
      case TrustLevel.LEARNING:
        reasoning.push(
          "Learning trust level - medium+ _risk changes require approval",
        );
        break;
      case TrustLevel.COLLABORATIVE:
        reasoning.push(
          "Collaborative trust level - high+ _risk changes require approval",
        );
        break;
      case TrustLevel.TRUSTED:
        reasoning.push(
          "Trusted level - only critical changes require approval",
        );
        break;
      case TrustLevel.AUTONOMOUS:
        reasoning.push("Autonomous level - minimal approval requirements");
        break;
    }

    // Theme recommendations
    if (themeCount > 0) {
      reasoning.push(`${themeCount} relevant approval theme(s) identified`);
    } else {
      reasoning.push("No specific approval themes required for this task");
    }

    return _reasoning;
  }

  /**
   * Quick _risk assessment for simple use cases
   */
  static quickRiskAssessment(input: string): RiskLevel {
    const _analysis = this.analyzeRiskIndicators(input.toLowerCase());
    return _analysis.risk;
  }

  /**
   * Quick _category detection for simple use cases
   */
  static quickCategoryDetection(input: string): ApprovalCategory {
    const _analysis = this.analyzeCategoryFromInput(input.toLowerCase());
    return _analysis.category;
  }

  /**
   * Check if approval is likely needed based on quick _analysis
   */
  static shouldRequestApproval(
    _input: string,
    trustLevel: TrustLevel,
  ): boolean {
    const _risk = this.quickRiskAssessment(_input);
    const _category = this.quickCategoryDetection(_input);

    // Security always requires approval for medium+ _risk
    if (_category === "security" && _risk !== "low") {
      return true;
    }

    // Trust level based decisions
    switch (trustLevel) {
      case TrustLevel.NOVICE:
        return true;
      case TrustLevel.LEARNING:
        return _risk !== "low";
      case TrustLevel.COLLABORATIVE:
        return _risk === "high" || _risk === "critical";
      case TrustLevel.TRUSTED:
        return _risk === "critical";
      case TrustLevel.AUTONOMOUS:
        return false;
      default:
        return true;
    }
  }
}
