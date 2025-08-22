/**
 * Risk Assessment Engine
 * Evaluates the risk level of proposed actions and determines approval requirements
 */

import {
  ApprovalCategory,
  ProposedAction,
  RiskAssessmentResult,
  RiskLevel,
  TaskContext,
  TrustLevel,
} from './types';

interface RiskFactor {
  category: string;
  risk: RiskLevel;
  description: string;
  weight: number;
  score: number;
}

interface RiskWeights {
  fileCount: number;
  criticalFiles: number;
  securityImpact: number;
  databaseChanges: number;
  apiChanges: number;
  dependencyChanges: number;
  reversibility: number;
  testCoverage: number;
}

export class RiskAssessment {
  private static readonly riskWeights: RiskWeights = {
    fileCount: 0.1,
    criticalFiles: 0.25,
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
    context: TaskContext,
    proposedActions: ProposedAction[],
    category?: ApprovalCategory,
  ): Promise<RiskAssessmentResult> {
    const factors: RiskFactor[] = [];

    // Analyze file impact
    const fileRisk = this.assessFileImpact(proposedActions);
    factors.push(fileRisk);

    // Analyze security impact
    const securityRisk = this.assessSecurityImpact(context, proposedActions);
    factors.push(securityRisk);

    // Analyze reversibility
    const reversibilityRisk = this.assessReversibility(proposedActions);
    factors.push(reversibilityRisk);

    // Analyze dependency impact
    const dependencyRisk = this.assessDependencyImpact(proposedActions);
    factors.push(dependencyRisk);

    // Analyze database impact
    const databaseRisk = this.assessDatabaseImpact(proposedActions);
    factors.push(databaseRisk);

    // Analyze API impact
    const apiRisk = this.assessAPIImpact(proposedActions);
    factors.push(apiRisk);

    // Calculate overall risk score
    const overallScore = this.calculateOverallRisk(factors);
    const overallRisk = this.scoreToRiskLevel(overallScore);

    // Determine if approval is required
    const requiresApproval = this.determineApprovalRequirement(
      overallRisk,
      context.userTrustLevel,
      category,
    );

    // Check auto-approval eligibility
    const autoApprovalEligible = this.checkAutoApprovalEligibility(
      overallRisk,
      factors,
      context.userTrustLevel,
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, overallRisk);

    return {
      overallRisk,
      factors,
      recommendations,
      requiresApproval,
      autoApprovalEligible,
    };
  }

  /**
   * Assess file modification impact
   */
  private static assessFileImpact(proposedActions: ProposedAction[]): RiskFactor {
    const allFiles = proposedActions.flatMap((action) => action.files);
    const fileCount = allFiles.length;

    const criticalFiles = allFiles.filter((file) =>
      this.criticalFilePatterns.some((pattern) => pattern.test(file)),
    );

    let score = Math.min(fileCount * 0.2, 3); // Base score from file count
    score += criticalFiles.length * 2; // Heavy penalty for critical files

    return {
      category: 'File Impact',
      risk: this.scoreToRiskLevel(score),
      description: `Modifying ${fileCount} files (${criticalFiles.length} critical)`,
      weight: this.riskWeights.fileCount + this.riskWeights.criticalFiles,
      score,
    };
  }

  /**
   * Assess security-related impact
   */
  private static assessSecurityImpact(
    context: TaskContext,
    proposedActions: ProposedAction[],
  ): RiskFactor {
    let score = 0;
    const securityIndicators: string[] = [];

    // Check user input for security keywords
    if (this.securitySensitivePatterns.some((pattern) => pattern.test(context.userInput))) {
      score += 2;
      securityIndicators.push('security-related request');
    }

    // Check proposed actions for security impact
    const securityActions = proposedActions.filter(
      (action) =>
        action.description &&
        this.securitySensitivePatterns.some((pattern) => pattern.test(action.description)),
    );

    score += securityActions.length * 1.5;

    // Check files for security sensitivity
    const allFiles = proposedActions.flatMap((action) => action.files);
    const securityFiles = allFiles.filter((file) =>
      this.securitySensitivePatterns.some((pattern) => pattern.test(file)),
    );

    score += securityFiles.length * 2;

    const description =
      securityIndicators.length > 0
        ? `Security-sensitive changes detected: ${securityIndicators.join(', ')}`
        : 'No significant security impact detected';

    return {
      category: 'Security Impact',
      risk: this.scoreToRiskLevel(score),
      description,
      weight: this.riskWeights.securityImpact,
      score,
    };
  }

  /**
   * Assess action reversibility
   */
  private static assessReversibility(proposedActions: ProposedAction[]): RiskFactor {
    const irreversibleActions = proposedActions.filter((action) => !action.reversible);
    const score = irreversibleActions.length * 2;

    return {
      category: 'Reversibility',
      risk: this.scoreToRiskLevel(score),
      description: `${irreversibleActions.length} irreversible actions`,
      weight: this.riskWeights.reversibility,
      score,
    };
  }

  /**
   * Assess dependency modification impact
   */
  private static assessDependencyImpact(proposedActions: ProposedAction[]): RiskFactor {
    const dependencyFiles = proposedActions
      .flatMap((action) => action.files)
      .filter((file) => /package\.json$|requirements\.txt$|cargo\.toml$|go\.mod$/i.test(file));

    const score = dependencyFiles.length * 1.5;

    return {
      category: 'Dependency Changes',
      risk: this.scoreToRiskLevel(score),
      description: `${dependencyFiles.length} dependency files affected`,
      weight: this.riskWeights.dependencyChanges,
      score,
    };
  }

  /**
   * Assess database-related impact
   */
  private static assessDatabaseImpact(proposedActions: ProposedAction[]): RiskFactor {
    const databaseActions = proposedActions.filter(
      (action) =>
        /database|migration|schema|sql/i.test(action.description || '') ||
        action.files.some((file) => /migration|schema|\.sql$/i.test(file)),
    );

    const score = databaseActions.length * 3; // Database changes are high risk

    return {
      category: 'Database Impact',
      risk: this.scoreToRiskLevel(score),
      description: `${databaseActions.length} database-related changes`,
      weight: this.riskWeights.databaseChanges,
      score,
    };
  }

  /**
   * Assess API modification impact
   */
  private static assessAPIImpact(proposedActions: ProposedAction[]): RiskFactor {
    const apiActions = proposedActions.filter(
      (action) =>
        /api|endpoint|route|controller/i.test(action.description || '') ||
        action.files.some((file) => /api|route|controller/i.test(file)),
    );

    const score = apiActions.length * 2; // API changes affect external systems

    return {
      category: 'API Impact',
      risk: this.scoreToRiskLevel(score),
      description: `${apiActions.length} API-related changes`,
      weight: this.riskWeights.apiChanges,
      score,
    };
  }

  /**
   * Calculate weighted overall risk score
   */
  private static calculateOverallRisk(factors: RiskFactor[]): number {
    return factors.reduce((total, factor) => {
      return total + factor.score * factor.weight;
    }, 0);
  }

  /**
   * Convert risk score to risk level
   */
  private static scoreToRiskLevel(score: number): RiskLevel {
    if (score >= this.riskThresholds.critical) {return 'critical';}
    if (score >= this.riskThresholds.high) {return 'high';}
    if (score >= this.riskThresholds.medium) {return 'medium';}
    return 'low';
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
    if (category === 'security' && riskLevel !== 'low') {
      return true;
    }

    // Architecture category always requires approval for high+ risk
    if (category === 'architecture' && (riskLevel === 'high' || riskLevel === 'critical')) {
      return true;
    }

    // Trust level based requirements
    switch (trustLevel) {
      case TrustLevel.NOVICE:
        return true; // All changes require approval

      case TrustLevel.LEARNING:
        return riskLevel !== 'low'; // Medium+ requires approval

      case TrustLevel.COLLABORATIVE:
        return riskLevel === 'high' || riskLevel === 'critical'; // High+ requires approval

      case TrustLevel.TRUSTED:
        return riskLevel === 'critical'; // Only critical requires approval

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
    if (riskLevel === 'critical') {return false;}

    // Never auto-approve if security factors are present
    const hasSecurityFactors = factors.some(
      (factor) => factor.category === 'Security Impact' && factor.risk !== 'low',
    );
    if (hasSecurityFactors) {return false;}

    // Trust level based auto-approval
    switch (trustLevel) {
      case TrustLevel.NOVICE:
        return false; // No auto-approval for novices

      case TrustLevel.LEARNING:
        return riskLevel === 'low'; // Only low risk auto-approval

      case TrustLevel.COLLABORATIVE:
      case TrustLevel.TRUSTED:
      case TrustLevel.AUTONOMOUS:
        return riskLevel === 'low' || riskLevel === 'medium'; // Low-medium auto-approval

      default:
        return false;
    }
  }

  /**
   * Generate actionable recommendations based on risk assessment
   */
  private static generateRecommendations(factors: RiskFactor[], overallRisk: RiskLevel): string[] {
    const recommendations: string[] = [];

    // Overall risk recommendations
    switch (overallRisk) {
      case 'critical':
        recommendations.push('Consider breaking this into smaller, safer changes');
        recommendations.push('Perform comprehensive testing in staging environment');
        recommendations.push('Prepare rollback plan before proceeding');
        break;

      case 'high':
        recommendations.push('Test thoroughly before deployment');
        recommendations.push('Consider phased rollout approach');
        break;

      case 'medium':
        recommendations.push('Add regression tests for affected components');
        break;
    }

    // Factor-specific recommendations
    factors.forEach((factor) => {
      if (factor.risk === 'high' || factor.risk === 'critical') {
        switch (factor.category) {
          case 'Security Impact':
            recommendations.push('Perform security review before implementation');
            recommendations.push('Validate all input and sanitize outputs');
            break;

          case 'Database Impact':
            recommendations.push('Create database backup before applying changes');
            recommendations.push('Test migration scripts in development environment');
            break;

          case 'API Impact':
            recommendations.push('Maintain backward compatibility when possible');
            recommendations.push('Update API documentation and client libraries');
            break;

          case 'File Impact':
            recommendations.push('Review all critical file changes carefully');
            break;
        }
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Get risk level explanation for users
   */
  static getRiskLevelExplanation(riskLevel: RiskLevel): string {
    switch (riskLevel) {
      case 'low':
        return 'Low risk - minimal impact, easily reversible changes';
      case 'medium':
        return 'Medium risk - moderate impact, requires testing';
      case 'high':
        return 'High risk - significant impact, requires careful review';
      case 'critical':
        return 'Critical risk - major impact, requires thorough planning and approval';
      default:
        return 'Unknown risk level';
    }
  }
}
