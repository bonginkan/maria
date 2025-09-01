/**
 * Risk Assessment Engine
 * Evaluates the risk level of proposed actions and determines approval requirements
 */

import {
  ApprovalCategory,
  ProposedAction,
  RiskAssessmentResult,
  _RiskLevel,
  TaskContext,
  TrustLevel,
} from "./types";

interface RiskFactor {
  category: string;
  risk: RiskLevel;
  _description: string;
  weight: number;
  _score: number;
}

interface RiskWeights {
  _fileCount: number;
  _criticalFiles: number;
  securityImpact: number;
  databaseChanges: number;
  apiChanges: number;
  dependencyChanges: number;
  reversibility: number;
  testCoverage: number;
}

export class RiskAssessment {
  private static readonly riskWeights: RiskWeights = {
    _fileCount: 0.1,
    _criticalFiles: 0.25,
    securityImpact: 0.3,
    databaseChanges: 0.25,
    apiChanges: 0.2,
    dependencyChanges: 0.15,
    reversibility: 0.1,
    testCoverage: 0.05,
  };

  private static readonly riskThresholds = {
    low: 2.0,
    medium: 4.0,
    high: 6.0,
    critical: 8.0,
  };

  private static readonly criticalFilePatterns = [
    /package\.json$/,
    /tsconfig\.json$/,
    /\.env$/,
    /database.*migration/i,
    /auth.*config/i,
    /security/i,
    /config.*prod/i,
    /docker.*compose/i,
    /k8s.*yaml$/,
    /helm.*yaml$/,
  ];

  private static readonly securitySensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /auth/i,
    /security/i,
    /crypto/i,
    /encrypt/i,
    /permission/i,
    /access.*control/i,
    /oauth/i,
    /jwt/i,
    /ssl/i,
    /tls/i,
  ];

  /**
   * Perform comprehensive risk assessment
   */
  static async assessRisk(
    _context: TaskContext,
    proposedActions: ProposedAction[],
    category?: ApprovalCategory,
  ): Promise<RiskAssessmentResult> {
    const factors: RiskFactor[] = [];

    // Analyze file impact
    const _fileRisk = this.assessFileImpact(proposedActions);
    factors.push(_fileRisk);

    // Analyze security impact
    const _securityRisk = this.assessSecurityImpact(_context, proposedActions);
    factors.push(_securityRisk);

    // Analyze reversibility
    const _reversibilityRisk = this.assessReversibility(proposedActions);
    factors.push(_reversibilityRisk);

    // Analyze dependency impact
    const _dependencyRisk = this.assessDependencyImpact(proposedActions);
    factors.push(_dependencyRisk);

    // Analyze database impact
    const _databaseRisk = this.assessDatabaseImpact(proposedActions);
    factors.push(_databaseRisk);

    // Analyze API impact
    const _apiRisk = this.assessAPIImpact(proposedActions);
    factors.push(_apiRisk);

    // Calculate overall risk _score
    const _overallScore = this.calculateOverallRisk(factors);
    const _overallRisk = this.scoreToRiskLevel(_overallScore);

    // Determine if approval is required
    const _requiresApproval = this.determineApprovalRequirement(
      _overallRisk,
      context.userTrustLevel,
      category,
    );

    // Check auto-approval eligibility
    const _autoApprovalEligible = this.checkAutoApprovalEligibility(
      _overallRisk,
      factors,
      context.userTrustLevel,
    );

    // Generate _recommendations
    const _recommendations = this.generateRecommendations(
      factors,
      _overallRisk,
    );

    return {
      _overallRisk,
      factors,
      _recommendations,
      _requiresApproval,
      _autoApprovalEligible,
    };
  }

  /**
   * Assess file modification impact
   */
  private static assessFileImpact(
    proposedActions: ProposedAction[],
  ): RiskFactor {
    const _allFiles = proposedActions.flatMap((action) => action.files);
    const _fileCount = _allFiles.length;

    const _criticalFiles = _allFiles.filter((file) =>
      this.criticalFilePatterns.some((pattern) => pattern.test(file)),
    );

    let _score = Math.min(_fileCount * 0.2, 3); // Base _score from file count
    _score += _criticalFiles.length * 2; // Heavy penalty for critical files

    return {
      category: "File Impact",
      risk: this.scoreToRiskLevel(_score),
      _description: `Modifying ${_fileCount} files (${_criticalFiles.length} critical)`,
      weight: this.riskWeights._fileCount + this.riskWeights._criticalFiles,
      _score,
    };
  }

  /**
   * Assess security-related impact
   */
  private static assessSecurityImpact(
    _context: TaskContext,
    proposedActions: ProposedAction[],
  ): RiskFactor {
    let _score = 0;
    const securityIndicators: string[] = [];

    // Check user input for security keywords
    if (
      this.securitySensitivePatterns.some((pattern) =>
        pattern.test(_context.userInput),
      )
    ) {
      _score += 2;
      securityIndicators.push("security-related request");
    }

    // Check proposed actions for security impact
    const _securityActions = proposedActions.filter(
      (action) =>
        action._description &&
        this.securitySensitivePatterns.some((pattern) =>
          pattern.test(action._description),
        ),
    );

    _score += _securityActions.length * 1.5;

    // Check files for security sensitivity
    const _allFiles = proposedActions.flatMap((action) => action.files);
    const _securityFiles = _allFiles.filter((file) =>
      this.securitySensitivePatterns.some((pattern) => pattern.test(file)),
    );

    _score += _securityFiles.length * 2;

    const _description =
      securityIndicators.length > 0
        ? `Security-sensitive changes detected: ${securityIndicators.join(", ")}`
        : "No significant security impact detected";

    return {
      category: "Security Impact",
      risk: this.scoreToRiskLevel(_score),
      _description,
      weight: this.riskWeights.securityImpact,
      _score,
    };
  }

  /**
   * Assess action reversibility
   */
  private static assessReversibility(
    proposedActions: ProposedAction[],
  ): RiskFactor {
    const _irreversibleActions = proposedActions.filter(
      (action) => !action.reversible,
    );
    const _score = _irreversibleActions.length * 2;

    return {
      category: "Reversibility",
      risk: this.scoreToRiskLevel(_score),
      _description: `${_irreversibleActions.length} irreversible actions`,
      weight: this.riskWeights.reversibility,
      _score,
    };
  }

  /**
   * Assess dependency modification impact
   */
  private static assessDependencyImpact(
    proposedActions: ProposedAction[],
  ): RiskFactor {
    const _dependencyFiles = proposedActions
      .flatMap((action) => action.files)
      .filter((file) =>
        /package\.json$|requirements\.txt$|cargo\.toml$|go\.mod$/i.test(file),
      );

    const _score = _dependencyFiles.length * 1.5;

    return {
      category: "Dependency Changes",
      risk: this.scoreToRiskLevel(_score),
      _description: `${_dependencyFiles.length} dependency files affected`,
      weight: this.riskWeights.dependencyChanges,
      _score,
    };
  }

  /**
   * Assess database-related impact
   */
  private static assessDatabaseImpact(
    proposedActions: ProposedAction[],
  ): RiskFactor {
    const _databaseActions = proposedActions.filter(
      (action) =>
        /database|migration|schema|sql/i.test(action.description || "") ||
        action.files.some((file) => /migration|schema|\.sql$/i.test(file)),
    );

    const _score = _databaseActions.length * 3; // Database changes are high risk

    return {
      category: "Database Impact",
      risk: this.scoreToRiskLevel(_score),
      _description: `${_databaseActions.length} database-related changes`,
      weight: this.riskWeights.databaseChanges,
      _score,
    };
  }

  /**
   * Assess API modification impact
   */
  private static assessAPIImpact(
    proposedActions: ProposedAction[],
  ): RiskFactor {
    const _apiActions = proposedActions.filter(
      (action) =>
        /api|endpoint|route|controller/i.test(action.description || "") ||
        action.files.some((file) => /api|route|controller/i.test(file)),
    );

    const _score = _apiActions.length * 2; // API changes affect external systems

    return {
      category: "API Impact",
      risk: this.scoreToRiskLevel(_score),
      _description: `${_apiActions.length} API-related changes`,
      weight: this.riskWeights.apiChanges,
      _score,
    };
  }

  /**
   * Calculate weighted overall risk _score
   */
  private static calculateOverallRisk(factors: RiskFactor[]): number {
    return factors.reduce((total, factor) => {
      return total + factor.score * factor.weight;
    }, 0);
  }

  /**
   * Convert risk _score to risk level
   */
  private static scoreToRiskLevel(_score: number): RiskLevel {
    if (_score >= this.riskThresholds.critical) {
      return "critical";
    }
    if (_score >= this.riskThresholds.high) {
      return "high";
    }
    if (_score >= this.riskThresholds.medium) {
      return "medium";
    }
    return "low";
  }

  /**
   * Determine if approval is required based on risk and trust level
   */
  private static determineApprovalRequirement(
    riskLevel: RiskLevel,
    trustLevel: TrustLevel,
    category?: ApprovalCategory,
  ): boolean {
    // Security category always requires approval for medium+ risk
    if (category === "security" && riskLevel !== "low") {
      return true;
    }

    // Architecture category always requires approval for high+ risk
    if (
      category === "architecture" &&
      (riskLevel === "high" || riskLevel === "critical")
    ) {
      return true;
    }

    // Trust level based requirements
    switch (trustLevel) {
      case TrustLevel.NOVICE:
        return true; // All changes require approval

      case TrustLevel.LEARNING:
        return riskLevel !== "low"; // Medium+ requires approval

      case TrustLevel.COLLABORATIVE:
        return riskLevel === "high" || riskLevel === "critical"; // High+ requires approval

      case TrustLevel.TRUSTED:
        return riskLevel === "critical"; // Only critical requires approval

      case TrustLevel.AUTONOMOUS:
        return false; // No approval required (emergency override available)

      default:
        return true; // Default to requiring approval
    }
  }

  /**
   * Check if action is eligible for auto-approval
   */
  private static checkAutoApprovalEligibility(
    riskLevel: RiskLevel,
    factors: RiskFactor[],
    trustLevel: TrustLevel,
  ): boolean {
    // Never auto-approve critical risk
    if (riskLevel === "critical") {
      return false;
    }

    // Never auto-approve if security factors are present
    const _hasSecurityFactors = factors.some(
      (factor) =>
        factor.category === "Security Impact" && factor.risk !== "low",
    );
    if (_hasSecurityFactors) {
      return false;
    }

    // Trust level based auto-approval
    switch (trustLevel) {
      case TrustLevel.NOVICE:
        return false; // No auto-approval for novices

      case TrustLevel.LEARNING:
        return riskLevel === "low"; // Only low risk auto-approval

      case TrustLevel.COLLABORATIVE:
      case TrustLevel.TRUSTED:
      case TrustLevel.AUTONOMOUS:
        return riskLevel === "low" || riskLevel === "medium"; // Low-medium auto-approval

      default:
        return false;
    }
  }

  /**
   * Generate actionable _recommendations based on risk assessment
   */
  private static generateRecommendations(
    _factors: RiskFactor[],
    _overallRisk: RiskLevel,
  ): string[] {
    const _recommendations: string[] = [];

    // Overall risk _recommendations
    switch (_overallRisk) {
      case "critical":
        _recommendations.push(
          "Consider breaking this into smaller, safer changes",
        );
        _recommendations.push(
          "Perform comprehensive testing in staging environment",
        );
        recommendations.push("Prepare rollback plan before proceeding");
        break;

      case "high":
        _recommendations.push("Test thoroughly before deployment");
        recommendations.push("Consider phased rollout approach");
        break;

      case "medium":
        recommendations.push("Add regression tests for affected components");
        break;
    }

    // Factor-specific _recommendations
    factors.forEach((factor) => {
      if (factor.risk === "high" || factor.risk === "critical") {
        switch (factor.category) {
          case "Security Impact":
            _recommendations.push(
              "Perform security review before implementation",
            );
            recommendations.push("Validate all input and sanitize outputs");
            break;

          case "Database Impact":
            _recommendations.push(
              "Create database backup before applying changes",
            );
            recommendations.push(
              "Test migration scripts in development environment",
            );
            break;

          case "API Impact":
            _recommendations.push(
              "Maintain backward compatibility when possible",
            );
            recommendations.push(
              "Update API documentation and client libraries",
            );
            break;

          case "File Impact":
            recommendations.push("Review all critical file changes carefully");
            break;
        }
      }
    });

    return [...new Set(_recommendations)]; // Remove duplicates
  }

  /**
   * Get risk level explanation for users
   */
  static getRiskLevelExplanation(riskLevel: RiskLevel): string {
    switch (riskLevel) {
      case "low":
        return "Low risk - minimal impact, easily reversible changes";
      case "medium":
        return "Medium risk - moderate impact, requires testing";
      case "high":
        return "High risk - significant impact, requires careful review";
      case "critical":
        return "Critical risk - major impact, requires thorough planning and approval";
      default:
        return "Unknown risk level";
    }
  }
}
