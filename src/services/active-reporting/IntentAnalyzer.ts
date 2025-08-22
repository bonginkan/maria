/**
 * Intent Analyzer - Understanding user requests deeply
 * Analyzes user input to extract primary and secondary intents
 */

import { IntentAnalysis } from './types';

export class IntentAnalyzer {
  private patterns: Map<string, RegExp[]>;
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
    // Load any ML models or additional patterns if needed
  }

  /**
   * Analyze user request to extract intents
   */
  public async analyze(request: string, context?: unknown): Promise<IntentAnalysis> {
    const primaryIntent = this.extractPrimaryIntent(request);
    const secondaryIntents = this.extractSecondaryIntents(request);
    const implicitRequirements = this.extractImplicitRequirements(request, context);
    const complexity = this.assessComplexity(request);
    const risks = this.identifyRisks(request);
    const capabilities = this.identifyRequiredCapabilities(request);
    const approach = this.suggestApproach(primaryIntent, complexity);

    return {
      primaryIntent,
      secondaryIntents,
      implicitRequirements,
      estimatedComplexity: complexity,
      suggestedApproach: approach,
      identifiedRisks: risks,
      requiredCapabilities: capabilities,
    };
  }

  /**
   * Extract primary intent from request
   */
  private extractPrimaryIntent(request: string): string {
    const lowerRequest = request.toLowerCase();

    // Check for specific action keywords
    if (this.matchesPattern(lowerRequest, 'implementation')) {
      return 'implement_feature';
    } else if (this.matchesPattern(lowerRequest, 'bug_fix')) {
      return 'fix_bug';
    } else if (this.matchesPattern(lowerRequest, 'refactor')) {
      return 'refactor_code';
    } else if (this.matchesPattern(lowerRequest, 'documentation')) {
      return 'create_documentation';
    } else if (this.matchesPattern(lowerRequest, 'testing')) {
      return 'write_tests';
    } else if (this.matchesPattern(lowerRequest, 'analysis')) {
      return 'analyze_code';
    } else if (this.matchesPattern(lowerRequest, 'optimization')) {
      return 'optimize_performance';
    } else if (this.matchesPattern(lowerRequest, 'integration')) {
      return 'integrate_system';
    } else if (this.matchesPattern(lowerRequest, 'deployment')) {
      return 'deploy_application';
    } else if (this.matchesPattern(lowerRequest, 'configuration')) {
      return 'configure_system';
    }

    return 'general_development';
  }

  /**
   * Extract secondary intents
   */
  private extractSecondaryIntents(request: string): string[] {
    const intents: string[] = [];
    const lowerRequest = request.toLowerCase();

    // Check for multiple intent patterns
    if (lowerRequest.includes('test') || lowerRequest.includes('テスト')) {
      intents.push('testing_required');
    }

    if (lowerRequest.includes('document') || lowerRequest.includes('ドキュメント')) {
      intents.push('documentation_needed');
    }

    if (lowerRequest.includes('deploy') || lowerRequest.includes('デプロイ')) {
      intents.push('deployment_consideration');
    }

    if (lowerRequest.includes('secure') || lowerRequest.includes('セキュリティ')) {
      intents.push('security_focus');
    }

    if (lowerRequest.includes('performance') || lowerRequest.includes('パフォーマンス')) {
      intents.push('performance_optimization');
    }

    if (
      lowerRequest.includes('ui') ||
      lowerRequest.includes('interface') ||
      lowerRequest.includes('画面')
    ) {
      intents.push('ui_development');
    }

    if (lowerRequest.includes('api') || lowerRequest.includes('endpoint')) {
      intents.push('api_development');
    }

    if (lowerRequest.includes('database') || lowerRequest.includes('データベース')) {
      intents.push('database_work');
    }

    return intents;
  }

  /**
   * Extract implicit requirements
   */
  private extractImplicitRequirements(request: string, context?: unknown): string[] {
    const requirements: string[] = [];

    // Based on primary intent, add implicit requirements
    if (request.toLowerCase().includes('production') || request.toLowerCase().includes('本番')) {
      requirements.push('production_ready_code');
      requirements.push('comprehensive_testing');
      requirements.push('error_handling');
      requirements.push('logging_implementation');
    }

    if (request.toLowerCase().includes('user') || request.toLowerCase().includes('ユーザー')) {
      requirements.push('user_experience_consideration');
      requirements.push('input_validation');
      requirements.push('user_feedback_handling');
    }

    if (request.toLowerCase().includes('scale') || request.toLowerCase().includes('スケール')) {
      requirements.push('scalability_consideration');
      requirements.push('performance_optimization');
      requirements.push('caching_strategy');
    }

    if (context?.isEnterprise) {
      requirements.push('enterprise_grade_security');
      requirements.push('audit_logging');
      requirements.push('compliance_requirements');
    }

    // Always implicit
    requirements.push('code_quality_standards');
    requirements.push('maintainable_code');
    requirements.push('proper_error_handling');

    return [...new Set(requirements)]; // Remove duplicates
  }

  /**
   * Assess complexity of the request
   */
  private assessComplexity(request: string): 'simple' | 'moderate' | 'complex' | 'very_complex' {
    let complexityScore = 0;
    const lowerRequest = request.toLowerCase();

    // Check for complexity indicators
    for (const [keyword, score] of this.complexityKeywords) {
      if (lowerRequest.includes(keyword)) {
        complexityScore += score;
      }
    }

    // Check request length (longer requests tend to be more complex)
    if (request.length > 500) complexityScore += 3;
    else if (request.length > 200) complexityScore += 2;
    else if (request.length > 100) complexityScore += 1;

    // Check for multiple requirements (and, also, with, including)
    const multipleRequirements = (
      request.match(/\b(and|also|with|including|および|また|含む)\b/gi) || []
    ).length;
    complexityScore += multipleRequirements * 2;

    // Determine complexity level
    if (complexityScore >= 15) return 'very_complex';
    if (complexityScore >= 10) return 'complex';
    if (complexityScore >= 5) return 'moderate';
    return 'simple';
  }

  /**
   * Identify potential risks
   */
  private identifyRisks(request: string): string[] {
    const risks: string[] = [];
    const lowerRequest = request.toLowerCase();

    for (const indicator of this.riskIndicators) {
      if (lowerRequest.includes(indicator)) {
        switch (indicator) {
          case 'production':
          case '本番':
            risks.push('production_deployment_risk');
            break;
          case 'database':
          case 'データベース':
            risks.push('data_integrity_risk');
            break;
          case 'security':
          case 'セキュリティ':
            risks.push('security_vulnerability_risk');
            break;
          case 'performance':
          case 'パフォーマンス':
            risks.push('performance_degradation_risk');
            break;
          case 'migration':
          case '移行':
            risks.push('migration_failure_risk');
            break;
          case 'integration':
          case '統合':
            risks.push('integration_compatibility_risk');
            break;
          case 'refactor':
          case 'リファクタリング':
            risks.push('regression_risk');
            break;
        }
      }
    }

    // Add general risks based on complexity
    const complexity = this.assessComplexity(request);
    if (complexity === 'very_complex' || complexity === 'complex') {
      risks.push('scope_creep_risk');
      risks.push('timeline_overrun_risk');
    }

    return [...new Set(risks)];
  }

  /**
   * Identify required capabilities
   */
  private identifyRequiredCapabilities(request: string): string[] {
    const capabilities: string[] = [];
    const lowerRequest = request.toLowerCase();

    // Technical capabilities
    if (lowerRequest.includes('react') || lowerRequest.includes('component')) {
      capabilities.push('react_development');
    }

    if (lowerRequest.includes('typescript') || lowerRequest.includes('type')) {
      capabilities.push('typescript_expertise');
    }

    if (lowerRequest.includes('api') || lowerRequest.includes('endpoint')) {
      capabilities.push('api_design');
    }

    if (lowerRequest.includes('database') || lowerRequest.includes('sql')) {
      capabilities.push('database_management');
    }

    if (lowerRequest.includes('test') || lowerRequest.includes('テスト')) {
      capabilities.push('testing_frameworks');
    }

    if (lowerRequest.includes('deploy') || lowerRequest.includes('ci/cd')) {
      capabilities.push('deployment_automation');
    }

    if (lowerRequest.includes('docker') || lowerRequest.includes('container')) {
      capabilities.push('containerization');
    }

    if (lowerRequest.includes('aws') || lowerRequest.includes('cloud')) {
      capabilities.push('cloud_services');
    }

    // Soft skills
    if (lowerRequest.includes('design') || lowerRequest.includes('architect')) {
      capabilities.push('system_design');
    }

    if (lowerRequest.includes('optimize') || lowerRequest.includes('performance')) {
      capabilities.push('performance_optimization');
    }

    return [...new Set(capabilities)];
  }

  /**
   * Suggest approach based on intent and complexity
   */
  private suggestApproach(intent: string, complexity: string): string {
    const approachMap: Record<string, Record<string, string>> = {
      implement_feature: {
        simple: 'Direct implementation with basic testing',
        moderate: 'Phased implementation with comprehensive testing',
        complex: 'Iterative development with continuous integration',
        very_complex: 'Agile sprints with regular reviews and adjustments',
      },
      fix_bug: {
        simple: 'Identify, fix, and test',
        moderate: 'Root cause analysis, fix, regression testing',
        complex: 'Systematic debugging, fix, comprehensive testing',
        very_complex: 'Multi-phase debugging with architecture review',
      },
      refactor_code: {
        simple: 'Direct refactoring with unit tests',
        moderate: 'Incremental refactoring with test coverage',
        complex: 'Phased refactoring with performance monitoring',
        very_complex: 'Complete restructuring with migration plan',
      },
      general_development: {
        simple: 'Standard development workflow',
        moderate: 'Structured development with milestones',
        complex: 'Agile methodology with sprints',
        very_complex: 'Enterprise development lifecycle',
      },
    };

    return approachMap[intent]?.[complexity] || approachMap.general_development[complexity];
  }

  /**
   * Check if request matches a pattern category
   */
  private matchesPattern(request: string, category: string): boolean {
    const patterns = this.patterns.get(category) || [];
    return patterns.some((pattern) => pattern.test(request));
  }

  /**
   * Initialize pattern definitions
   */
  private initializePatterns(): Map<string, RegExp[]> {
    const patterns = new Map<string, RegExp[]>();

    patterns.set('implementation', [
      /implement/i,
      /create/i,
      /build/i,
      /develop/i,
      /add/i,
      /実装/,
      /作成/,
      /追加/,
    ]);

    patterns.set('bug_fix', [
      /fix/i,
      /bug/i,
      /error/i,
      /issue/i,
      /problem/i,
      /修正/,
      /バグ/,
      /エラー/,
    ]);

    patterns.set('refactor', [
      /refactor/i,
      /restructure/i,
      /reorganize/i,
      /improve/i,
      /リファクタ/,
      /改善/,
    ]);

    patterns.set('documentation', [
      /document/i,
      /readme/i,
      /guide/i,
      /manual/i,
      /ドキュメント/,
      /説明/,
    ]);

    patterns.set('testing', [/test/i, /spec/i, /coverage/i, /テスト/, /検証/]);

    patterns.set('analysis', [/analyze/i, /review/i, /audit/i, /inspect/i, /分析/, /レビュー/]);

    patterns.set('optimization', [
      /optimize/i,
      /performance/i,
      /speed/i,
      /efficiency/i,
      /最適化/,
      /パフォーマンス/,
    ]);

    patterns.set('integration', [/integrate/i, /connect/i, /link/i, /統合/, /連携/]);

    patterns.set('deployment', [
      /deploy/i,
      /release/i,
      /publish/i,
      /launch/i,
      /デプロイ/,
      /リリース/,
    ]);

    patterns.set('configuration', [/configure/i, /setup/i, /install/i, /設定/, /セットアップ/]);

    return patterns;
  }

  /**
   * Initialize complexity keywords
   */
  private initializeComplexityKeywords(): Map<string, number> {
    const keywords = new Map<string, number>();

    // High complexity indicators (3 points)
    [
      'enterprise',
      'production',
      'scalable',
      'distributed',
      'microservice',
      'architecture',
      'エンタープライズ',
      '本番',
      'スケーラブル',
      '分散',
      'マイクロサービス',
    ].forEach((k) => keywords.set(k, 3));

    // Medium complexity indicators (2 points)
    [
      'integration',
      'migration',
      'refactor',
      'optimize',
      'security',
      'performance',
      '統合',
      '移行',
      'リファクタ',
      '最適化',
      'セキュリティ',
    ].forEach((k) => keywords.set(k, 2));

    // Low complexity indicators (1 point)
    [
      'update',
      'modify',
      'add',
      'remove',
      'change',
      'fix',
      '更新',
      '修正',
      '追加',
      '削除',
      '変更',
    ].forEach((k) => keywords.set(k, 1));

    return keywords;
  }

  /**
   * Initialize risk indicators
   */
  private initializeRiskIndicators(): string[] {
    return [
      'production',
      '本番',
      'database',
      'データベース',
      'security',
      'セキュリティ',
      'performance',
      'パフォーマンス',
      'migration',
      '移行',
      'integration',
      '統合',
      'refactor',
      'リファクタリング',
      'payment',
      '決済',
      'user data',
      'ユーザーデータ',
      'authentication',
      '認証',
      'authorization',
      '認可',
      'critical',
      'クリティカル',
    ];
  }
}
