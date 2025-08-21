/**
 * Approval Context Analyzer
 * Analyzes user tasks to identify approval points and appropriate themes
 */

import {
  TaskContext,
  ApprovalTheme,
  ApprovalPoint,
  ApprovalCategory,
  RiskLevel,
  TrustLevel,
} from './types';
import { ApprovalThemeRegistry } from './ApprovalThemeRegistry';

interface AnalysisResult {
  recommendedThemes: ApprovalTheme[];
  approvalPoints: ApprovalPoint[];
  suggestedCategory: ApprovalCategory;
  confidence: number;
  reasoning: string[];
}

interface KeywordPattern {
  keywords: string[];
  category: ApprovalCategory;
  weight: number;
  riskIndicator?: RiskLevel;
}

export class ApprovalContextAnalyzer {
  private static readonly categoryPatterns: KeywordPattern[] = [
    // Architecture patterns
    {
      keywords: [
        'api',
        'endpoint',
        'route',
        'service',
        'microservice',
        'architecture',
        'design',
        'schema',
        'database',
        'migration',
      ],
      category: 'architecture',
      weight: 1.0,
      riskIndicator: 'high',
    },
    {
      keywords: ['new service', 'create service', 'add service', 'service design'],
      category: 'architecture',
      weight: 1.2,
      riskIndicator: 'critical',
    },

    // Implementation patterns
    {
      keywords: ['implement', 'add feature', 'create function', 'build', 'develop', 'code'],
      category: 'implementation',
      weight: 0.8,
      riskIndicator: 'medium',
    },
    {
      keywords: ['bug fix', 'fix bug', 'resolve issue', 'patch', 'hotfix'],
      category: 'implementation',
      weight: 0.6,
      riskIndicator: 'low',
    },
    {
      keywords: ['integrate', 'integration', 'third party', 'external api', 'library'],
      category: 'implementation',
      weight: 1.0,
      riskIndicator: 'high',
    },

    // Refactoring patterns
    {
      keywords: ['refactor', 'optimize', 'improve', 'restructure', 'cleanup', 'reorganize'],
      category: 'refactoring',
      weight: 0.7,
      riskIndicator: 'medium',
    },
    {
      keywords: ['performance', 'speed up', 'faster', 'optimize performance', 'bottleneck'],
      category: 'refactoring',
      weight: 0.8,
      riskIndicator: 'medium',
    },
    {
      keywords: ['update dependencies', 'upgrade', 'dependency update', 'package update'],
      category: 'refactoring',
      weight: 0.9,
      riskIndicator: 'medium',
    },

    // Security patterns
    {
      keywords: [
        'security',
        'auth',
        'authentication',
        'authorization',
        'permission',
        'encrypt',
        'decrypt',
      ],
      category: 'security',
      weight: 1.5,
      riskIndicator: 'critical',
    },
    {
      keywords: ['password', 'token', 'jwt', 'oauth', 'ssl', 'tls', 'certificate'],
      category: 'security',
      weight: 1.4,
      riskIndicator: 'critical',
    },
    {
      keywords: [
        'vulnerability',
        'security fix',
        'patch security',
        'exploit',
        'xss',
        'sql injection',
      ],
      category: 'security',
      weight: 1.6,
      riskIndicator: 'critical',
    },

    // Performance patterns
    {
      keywords: ['cache', 'caching', 'redis', 'memcached', 'performance cache'],
      category: 'performance',
      weight: 0.8,
      riskIndicator: 'medium',
    },
    {
      keywords: ['scale', 'scaling', 'load balancer', 'horizontal scaling', 'vertical scaling'],
      category: 'performance',
      weight: 1.1,
      riskIndicator: 'high',
    },
    {
      keywords: ['database optimization', 'query optimization', 'index', 'performance tuning'],
      category: 'performance',
      weight: 0.9,
      riskIndicator: 'medium',
    },
  ];

  private static readonly riskKeywords = {
    critical: [
      'critical',
      'production',
      'live',
      'security',
      'authentication',
      'database schema',
      'migration',
    ],
    high: ['api', 'integration', 'service', 'architecture', 'breaking change', 'major'],
    medium: ['feature', 'enhancement', 'refactor', 'optimization', 'update'],
    low: ['bug fix', 'typo', 'comment', 'documentation', 'style', 'formatting'],
  };

  private static readonly urgencyKeywords = [
    'urgent',
    'emergency',
    'critical',
    'asap',
    'immediately',
    'hotfix',
    'quick fix',
  ];

  /**
   * Analyze task context to determine approval requirements
   */
  static async analyzeTaskForApproval(context: TaskContext): Promise<AnalysisResult> {
    const userInput = context.userInput.toLowerCase();

    // Analyze category
    const categoryAnalysis = this.analyzeCategoryFromInput(userInput);

    // Analyze risk indicators
    const riskAnalysis = this.analyzeRiskIndicators(userInput);

    // Get recommended themes based on analysis
    const recommendedThemes = this.getRecommendedThemes(
      categoryAnalysis.category,
      riskAnalysis,
      context,
    );

    // Identify specific approval points
    const approvalPoints = this.identifyApprovalPoints(
      userInput,
      categoryAnalysis.category,
      context,
    );

    // Generate reasoning
    const reasoning = this.generateReasoning(
      categoryAnalysis,
      riskAnalysis,
      context,
      recommendedThemes.length,
    );

    return {
      recommendedThemes,
      approvalPoints,
      suggestedCategory: categoryAnalysis.category,
      confidence: categoryAnalysis.confidence,
      reasoning,
    };
  }

  /**
   * Analyze category from user input
   */
  private static analyzeCategoryFromInput(input: string): {
    category: ApprovalCategory;
    confidence: number;
  } {
    const categoryScores: Record<ApprovalCategory, number> = {
      architecture: 0,
      implementation: 0,
      refactoring: 0,
      security: 0,
      performance: 0,
    };

    // Score each category based on keyword matches
    for (const pattern of this.categoryPatterns) {
      for (const keyword of pattern.keywords) {
        if (input.includes(keyword)) {
          categoryScores[pattern.category] += pattern.weight;
        }
      }
    }

    // Find the category with highest score
    const topCategory = Object.entries(categoryScores).reduce((a, b) =>
      categoryScores[a[0] as ApprovalCategory] > categoryScores[b[0] as ApprovalCategory] ? a : b,
    )[0] as ApprovalCategory;

    const topScore = categoryScores[topCategory];
    const totalScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);

    // Calculate confidence (0-1)
    const confidence = totalScore > 0 ? Math.min(topScore / totalScore, 1.0) : 0;

    return {
      category: topCategory,
      confidence,
    };
  }

  /**
   * Analyze risk indicators in user input
   */
  private static analyzeRiskIndicators(input: string): { risk: RiskLevel; factors: string[] } {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Check for each risk level
    for (const [level, keywords] of Object.entries(this.riskKeywords)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          riskFactors.push(`${level}: ${keyword}`);

          // Add to risk score
          switch (level) {
            case 'critical':
              riskScore += 4;
              break;
            case 'high':
              riskScore += 3;
              break;
            case 'medium':
              riskScore += 2;
              break;
            case 'low':
              riskScore += 1;
              break;
          }
        }
      }
    }

    // Check for urgency indicators
    const hasUrgency = this.urgencyKeywords.some((keyword) => input.includes(keyword));
    if (hasUrgency) {
      riskScore += 2;
      riskFactors.push('urgency indicator detected');
    }

    // Determine overall risk level
    let risk: RiskLevel;
    if (riskScore >= 8) risk = 'critical';
    else if (riskScore >= 5) risk = 'high';
    else if (riskScore >= 3) risk = 'medium';
    else risk = 'low';

    return { risk, factors: riskFactors };
  }

  /**
   * Get recommended themes based on analysis
   */
  private static getRecommendedThemes(
    category: ApprovalCategory,
    riskAnalysis: { risk: RiskLevel; factors: string[] },
    context: TaskContext,
  ): ApprovalTheme[] {
    // Get themes for the identified category
    let themes = ApprovalThemeRegistry.getThemesByCategory(category);

    // Filter by risk level if appropriate
    if (riskAnalysis.risk === 'critical') {
      // For critical risk, only show critical/high impact themes
      themes = themes.filter((theme) => theme.impact === 'critical' || theme.impact === 'high');
    }

    // Consider trust level
    if (context.userTrustLevel === TrustLevel.NOVICE) {
      // For novice users, show all relevant themes
      return themes;
    } else if (context.userTrustLevel === TrustLevel.AUTONOMOUS) {
      // For autonomous users, only show critical themes
      return themes.filter((theme) => theme.impact === 'critical');
    }

    // For other trust levels, filter based on what requires confirmation
    return themes.filter((theme) => {
      if (theme.impact === 'critical') return true;
      if (theme.impact === 'high' && context.userTrustLevel !== TrustLevel.TRUSTED) return true;
      if (theme.requiresConfirmation && context.userTrustLevel === TrustLevel.LEARNING) return true;
      return false;
    });
  }

  /**
   * Identify specific approval points
   */
  private static identifyApprovalPoints(
    input: string,
    category: ApprovalCategory,
    _context: TaskContext,
  ): ApprovalPoint[] {
    const points: ApprovalPoint[] = [];

    // Database-related approval points
    if (input.includes('database') || input.includes('migration') || input.includes('schema')) {
      points.push({
        id: 'database-changes',
        category: 'architecture',
        description: 'Database schema or data changes detected',
        triggerConditions: ['database modification', 'schema change', 'migration'],
        priority: 1,
        mandatory: true,
      });
    }

    // Security-related approval points
    if (category === 'security' || this.hasSecurityKeywords(input)) {
      points.push({
        id: 'security-review',
        category: 'security',
        description: 'Security-sensitive changes require review',
        triggerConditions: ['authentication', 'authorization', 'encryption', 'security'],
        priority: 1,
        mandatory: true,
      });
    }

    // API-related approval points
    if (input.includes('api') || input.includes('endpoint') || input.includes('route')) {
      points.push({
        id: 'api-changes',
        category: 'architecture',
        description: 'API modifications may affect external systems',
        triggerConditions: ['api change', 'endpoint modification', 'route update'],
        priority: 2,
        mandatory: category === 'architecture',
      });
    }

    // Dependency-related approval points
    if (input.includes('dependency') || input.includes('package') || input.includes('library')) {
      points.push({
        id: 'dependency-update',
        category: 'refactoring',
        description: 'Dependency changes may introduce compatibility issues',
        triggerConditions: ['dependency update', 'package change', 'library modification'],
        priority: 3,
        mandatory: false,
      });
    }

    // Production/deployment approval points
    if (input.includes('production') || input.includes('deploy') || input.includes('live')) {
      points.push({
        id: 'production-deployment',
        category: 'architecture',
        description: 'Production deployment requires careful review',
        triggerConditions: ['production change', 'deployment', 'live environment'],
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
    const securityKeywords = [
      'auth',
      'security',
      'password',
      'token',
      'encrypt',
      'decrypt',
      'oauth',
      'jwt',
      'ssl',
      'tls',
      'permission',
      'access control',
    ];

    return securityKeywords.some((keyword) => input.includes(keyword));
  }

  /**
   * Generate human-readable reasoning for the analysis
   */
  private static generateReasoning(
    categoryAnalysis: { category: ApprovalCategory; confidence: number },
    riskAnalysis: { risk: RiskLevel; factors: string[] },
    context: TaskContext,
    themeCount: number,
  ): string[] {
    const reasoning: string[] = [];

    // Category reasoning
    if (categoryAnalysis.confidence > 0.7) {
      reasoning.push(
        `High confidence (${Math.round(categoryAnalysis.confidence * 100)}%) this is a ${categoryAnalysis.category} task`,
      );
    } else if (categoryAnalysis.confidence > 0.4) {
      reasoning.push(
        `Moderate confidence (${Math.round(categoryAnalysis.confidence * 100)}%) this is a ${categoryAnalysis.category} task`,
      );
    } else {
      reasoning.push(
        `Low confidence in category classification, defaulting to ${categoryAnalysis.category}`,
      );
    }

    // Risk reasoning
    if (riskAnalysis.risk === 'critical') {
      reasoning.push('Critical risk detected - requires mandatory approval');
    } else if (riskAnalysis.risk === 'high') {
      reasoning.push('High risk detected - approval recommended');
    } else if (riskAnalysis.risk === 'medium') {
      reasoning.push('Medium risk detected - consider approval based on trust level');
    } else {
      reasoning.push('Low risk detected - may proceed with minimal oversight');
    }

    // Risk factors
    if (riskAnalysis.factors.length > 0) {
      reasoning.push(`Risk factors: ${riskAnalysis.factors.join(', ')}`);
    }

    // Trust level considerations
    switch (context.userTrustLevel) {
      case TrustLevel.NOVICE:
        reasoning.push('Novice trust level - all changes require approval');
        break;
      case TrustLevel.LEARNING:
        reasoning.push('Learning trust level - medium+ risk changes require approval');
        break;
      case TrustLevel.COLLABORATIVE:
        reasoning.push('Collaborative trust level - high+ risk changes require approval');
        break;
      case TrustLevel.TRUSTED:
        reasoning.push('Trusted level - only critical changes require approval');
        break;
      case TrustLevel.AUTONOMOUS:
        reasoning.push('Autonomous level - minimal approval requirements');
        break;
    }

    // Theme recommendations
    if (themeCount > 0) {
      reasoning.push(`${themeCount} relevant approval theme(s) identified`);
    } else {
      reasoning.push('No specific approval themes required for this task');
    }

    return reasoning;
  }

  /**
   * Quick risk assessment for simple use cases
   */
  static quickRiskAssessment(input: string): RiskLevel {
    const analysis = this.analyzeRiskIndicators(input.toLowerCase());
    return analysis.risk;
  }

  /**
   * Quick category detection for simple use cases
   */
  static quickCategoryDetection(input: string): ApprovalCategory {
    const analysis = this.analyzeCategoryFromInput(input.toLowerCase());
    return analysis.category;
  }

  /**
   * Check if approval is likely needed based on quick analysis
   */
  static shouldRequestApproval(input: string, trustLevel: TrustLevel): boolean {
    const risk = this.quickRiskAssessment(input);
    const category = this.quickCategoryDetection(input);

    // Security always requires approval for medium+ risk
    if (category === 'security' && risk !== 'low') {
      return true;
    }

    // Trust level based decisions
    switch (trustLevel) {
      case TrustLevel.NOVICE:
        return true;
      case TrustLevel.LEARNING:
        return risk !== 'low';
      case TrustLevel.COLLABORATIVE:
        return risk === 'high' || risk === 'critical';
      case TrustLevel.TRUSTED:
        return risk === 'critical';
      case TrustLevel.AUTONOMOUS:
        return false;
      default:
        return true;
    }
  }
}
