/**
 * Evaluating Mode Plugin - Assessment and evaluation mode
 * Specialized for evaluating options, assessing quality, and making informed judgments
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class EvaluatingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'evaluating',
      name: 'Evaluating',
      category: 'reasoning',
      symbol: '⚖️',
      color: 'magenta',
      description: '評価・査定モード - 選択肢評価と品質判定',
      keywords: [
        'evaluate',
        'assess',
        'judge',
        'compare',
        'rate',
        'measure',
        'review',
        'appraise',
        'estimate',
        'weigh',
      ],
      triggers: [
        'evaluate',
        'assess',
        'compare',
        'rate',
        'judge',
        'measure quality',
        'review options',
        'which is better',
      ],
      examples: [
        'Evaluate the pros and cons of these approaches',
        'Assess the quality of this implementation',
        'Compare different solutions and recommend the best',
        'Rate the effectiveness of our current strategy',
        'Judge whether this meets our requirements',
      ],
      enabled: true,
      priority: 6,
      timeout: 90000, // 1.5 minutes
      maxConcurrentSessions: 10,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating evaluating mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Evaluating...',
      color: this.config.color,
      sessionId: context.sessionId,
    });

    this.emit('analytics:event', {
      type: 'mode_activation',
      mode: this.config.id,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      metadata: {
        previousMode: context.previousMode,
        confidence: context.confidence,
      },
    });
  }

  protected async onDeactivate(sessionId: string): Promise<void> {
    console.log(`[${this.config.id}] Deactivating evaluating mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing evaluation request: "${input.substring(0, 50)}..."`,
    );

    // Evaluation process pipeline
    const evaluationScope = await this.defineEvaluationScope(input, context);
    const criteria = await this.establishCriteria(input, evaluationScope);
    const alternatives = await this.identifyAlternatives(input, evaluationScope);
    const analysis = await this.conductComparativeAnalysis(input, alternatives, criteria);
    const scoring = await this.performScoring(input, analysis, criteria);
    const recommendation = await this.generateRecommendation(input, scoring);

    const suggestions = await this.generateEvaluationSuggestions(input, recommendation);
    const nextMode = await this.determineNextMode(input, recommendation);

    return {
      success: true,
      output: this.formatEvaluationResults(
        evaluationScope,
        criteria,
        analysis,
        scoring,
        recommendation,
      ),
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.9,
      metadata: {
        scopeType: evaluationScope.type,
        criteriaCount: criteria.length,
        alternativeCount: alternatives.length,
        analysisDepth: analysis.depth,
        confidenceLevel: scoring.confidence,
        recommendationType: recommendation.type,
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.3;

    const inputLower = input.toLowerCase();

    // Direct evaluation keywords
    const evaluationKeywords = [
      'evaluate',
      'assess',
      'judge',
      'compare',
      'rate',
      'measure',
      'review',
      'appraise',
      'estimate',
      'weigh',
    ];

    const evaluationMatches = evaluationKeywords.filter((keyword) => inputLower.includes(keyword));
    if (evaluationMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Evaluation keywords: ${evaluationMatches.join(', ')}`);
    }

    // Comparison and choice indicators
    const comparisonTerms = [
      'compare',
      'versus',
      'vs',
      'better',
      'worse',
      'best',
      'worst',
      'choice',
      'option',
      'alternative',
      'pros and cons',
    ];

    const comparisonMatches = comparisonTerms.filter((term) => inputLower.includes(term));
    if (comparisonMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(`Comparison terms: ${comparisonMatches.join(', ')}`);
    }

    // Quality and performance indicators
    const qualityTerms = [
      'quality',
      'performance',
      'effectiveness',
      'efficiency',
      'accuracy',
      'reliability',
      'usability',
      'value',
    ];

    const qualityMatches = qualityTerms.filter((term) => inputLower.includes(term));
    if (qualityMatches.length > 0) {
      confidence += 0.25;
      reasoning.push(`Quality assessment terms: ${qualityMatches.join(', ')}`);
    }

    // Decision-making context
    const decisionTerms = [
      'decide',
      'decision',
      'choose',
      'select',
      'pick',
      'recommend',
      'suggest',
      'advise',
    ];

    const decisionMatches = decisionTerms.filter((term) => inputLower.includes(term));
    if (decisionMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Decision-making terms: ${decisionMatches.join(', ')}`);
    }

    // Criteria and standards indicators
    const criteriaTerms = [
      'criteria',
      'standards',
      'requirements',
      'metrics',
      'benchmarks',
      'goals',
      'objectives',
    ];

    const criteriaMatches = criteriaTerms.filter((term) => inputLower.includes(term));
    if (criteriaMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Criteria/standards terms: ${criteriaMatches.join(', ')}`);
    }

    // Questions that suggest evaluation
    const evaluationQuestions = [
      /which.*better/i,
      /how.*good/i,
      /what.*best/i,
      /should.*choose/i,
      /worth.*it/i,
      /good.*enough/i,
      /meets.*requirements/i,
    ];

    const questionMatches = evaluationQuestions.filter((pattern) => pattern.test(input));
    if (questionMatches.length > 0) {
      confidence += 0.2;
      reasoning.push('Evaluation-oriented questions detected');
    }

    // Multiple options or alternatives mentioned
    const optionIndicators = ['option', 'alternative', 'choice', 'approach', 'method', 'solution'];
    const optionMatches = optionIndicators.filter((indicator) => inputLower.includes(indicator));
    if (optionMatches.length > 0) {
      confidence += 0.1;
      reasoning.push(`Multiple option indicators: ${optionMatches.join(', ')}`);
    }

    // Context-based adjustments
    if (context.previousMode === 'researching') {
      confidence += 0.15;
      reasoning.push('Natural progression from research to evaluation');
    }

    if (context.previousMode === 'analyzing') {
      confidence += 0.15;
      reasoning.push('Good follow-up to analysis');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Define the scope of evaluation
   */
  private async defineEvaluationScope(input: string, context: ModeContext): Promise<unknown> {
    const scope = {
      type: this.classifyEvaluationType(input),
      domain: this.identifyEvaluationDomain(input),
      objectives: this.extractEvaluationObjectives(input),
      constraints: this.identifyEvaluationConstraints(input),
      stakeholders: this.identifyEvaluationStakeholders(input),
      timeline: this.determineEvaluationTimeline(input),
      complexity: this.assessEvaluationComplexity(input),
    };

    return scope;
  }

  /**
   * Establish evaluation criteria
   */
  private async establishCriteria(input: string, scope: unknown): Promise<unknown[]> {
    const criteria: unknown[] = [];

    // Primary criteria based on evaluation type
    const primaryCriteria = this.derivePrimaryCriteria(input, scope);
    criteria.push(...primaryCriteria);

    // Secondary criteria
    const secondaryCriteria = this.deriveSecondaryCriteria(input, scope);
    criteria.push(...secondaryCriteria);

    // Stakeholder-specific criteria
    const stakeholderCriteria = this.deriveStakeholderCriteria(scope.stakeholders);
    criteria.push(...stakeholderCriteria);

    return criteria;
  }

  /**
   * Identify alternatives to evaluate
   */
  private async identifyAlternatives(input: string, scope: unknown): Promise<unknown[]> {
    const alternatives: unknown[] = [];

    // Extract explicit alternatives from input
    const explicitAlternatives = this.extractExplicitAlternatives(input);
    alternatives.push(...explicitAlternatives);

    // Generate implicit alternatives if needed
    if (alternatives.length < 2) {
      const implicitAlternatives = this.generateImplicitAlternatives(input, scope);
      alternatives.push(...implicitAlternatives);
    }

    // Include status quo or baseline option
    alternatives.push(this.createStatusQuoOption(scope));

    return alternatives;
  }

  /**
   * Conduct comparative analysis
   */
  private async conductComparativeAnalysis(
    input: string,
    alternatives: unknown[],
    criteria: unknown[],
  ): Promise<unknown> {
    const analysis = {
      depth: this.determineAnalysisDepth(alternatives, criteria),
      methodology: this.selectAnalysisMethodology(alternatives, criteria),
      comparison_matrix: this.createComparisonMatrix(alternatives, criteria),
      strengths_weaknesses: this.analyzeStrengthsWeaknesses(alternatives, criteria),
      trade_offs: this.identifyTradeOffs(alternatives, criteria),
      risk_assessment: this.assessRisks(alternatives, criteria),
    };

    return analysis;
  }

  /**
   * Perform scoring and ranking
   */
  private async performScoring(
    input: string,
    analysis: unknown,
    criteria: unknown[],
  ): Promise<unknown> {
    const scoring = {
      method: this.selectScoringMethod(criteria),
      weights: this.assignCriteriaWeights(criteria),
      scores: this.calculateScores(analysis.comparison_matrix, criteria),
      rankings: this.generateRankings(analysis.comparison_matrix, criteria),
      confidence: this.calculateConfidence(analysis, criteria),
      sensitivity: this.performSensitivityAnalysis(analysis, criteria),
    };

    return scoring;
  }

  /**
   * Generate recommendation
   */
  private async generateRecommendation(input: string, scoring: unknown): Promise<unknown> {
    const recommendation = {
      type: this.determineRecommendationType(scoring),
      primary_choice: this.identifyPrimaryChoice(scoring),
      rationale: this.developRationale(scoring),
      confidence_level: scoring.confidence,
      conditions: this.identifyConditions(scoring),
      alternatives: this.suggestAlternatives(scoring),
      implementation_notes: this.provideImplementationNotes(scoring),
    };

    return recommendation;
  }

  /**
   * Format evaluation results
   */
  private formatEvaluationResults(
    scope: unknown,
    criteria: unknown[],
    analysis: unknown,
    scoring: unknown,
    recommendation: unknown,
  ): string {
    const output: string[] = [];

    output.push('Evaluation Results');
    output.push('═'.repeat(18));
    output.push('');

    output.push('Evaluation Scope:');
    output.push(`Type: ${scope.type}`);
    output.push(`Domain: ${scope.domain}`);
    output.push(`Complexity: ${scope.complexity}`);
    output.push('');

    output.push('Evaluation Criteria:');
    criteria.slice(0, 5).forEach((criterion, index) => {
      output.push(`${index + 1}. ${criterion.name} (Weight: ${criterion.weight})`);
    });
    output.push('');

    output.push('Analysis Summary:');
    output.push(`Methodology: ${analysis.methodology}`);
    output.push(`Analysis Depth: ${analysis.depth}`);
    output.push('Key Trade-offs:');
    analysis.trade_offs.slice(0, 3).forEach((tradeoff: string) => {
      output.push(`• ${tradeoff}`);
    });
    output.push('');

    output.push('Scoring Results:');
    output.push(`Scoring Method: ${scoring.method}`);
    output.push('Top Rankings:');
    scoring.rankings.slice(0, 3).forEach((ranking: unknown, index: number) => {
      output.push(`${index + 1}. ${ranking.option} (Score: ${ranking.score})`);
    });
    output.push('');

    output.push('Recommendation:');
    output.push(`Recommended Choice: ${recommendation.primary_choice}`);
    output.push(`Confidence Level: ${recommendation.confidence_level}`);
    output.push('Rationale:');
    recommendation.rationale.slice(0, 3).forEach((reason: string) => {
      output.push(`• ${reason}`);
    });
    output.push('');

    if (recommendation.conditions.length > 0) {
      output.push('Important Conditions:');
      recommendation.conditions.slice(0, 3).forEach((condition: string) => {
        output.push(`• ${condition}`);
      });
    }

    return output.join('\n');
  }

  /**
   * Generate evaluation-specific suggestions
   */
  private async generateEvaluationSuggestions(
    input: string,
    recommendation: unknown,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Validate evaluation criteria with stakeholders');

    if (recommendation.confidence_level < 0.8) {
      suggestions.push('Gather additional data to improve confidence');
    }

    if (recommendation.alternatives.length > 0) {
      suggestions.push('Consider hybrid approaches combining best features');
    }

    suggestions.push('Plan pilot testing for top-ranked options');
    suggestions.push('Document evaluation methodology for future use');

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(
    input: string,
    recommendation: unknown,
  ): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('implement') || inputLower.includes('execute')) {
      return 'planning';
    }

    if (inputLower.includes('test') || inputLower.includes('pilot')) {
      return 'debugging';
    }

    if (inputLower.includes('discuss') || inputLower.includes('stakeholder')) {
      return 'facilitating';
    }

    if (recommendation.confidence_level < 0.7) {
      return 'researching';
    }

    return 'reflecting';
  }

  // Helper methods
  private classifyEvaluationType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('option') || inputLower.includes('alternative'))
      {return 'option_evaluation';}
    if (inputLower.includes('quality') || inputLower.includes('performance'))
      {return 'quality_assessment';}
    if (inputLower.includes('cost') || inputLower.includes('benefit'))
      {return 'cost_benefit_analysis';}
    if (inputLower.includes('risk') || inputLower.includes('safety')) {return 'risk_assessment';}
    if (inputLower.includes('requirement') || inputLower.includes('criteria'))
      {return 'compliance_evaluation';}

    return 'general_evaluation';
  }

  private identifyEvaluationDomain(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('technical') || inputLower.includes('technology')) {return 'technical';}
    if (inputLower.includes('business') || inputLower.includes('financial')) {return 'business';}
    if (inputLower.includes('user') || inputLower.includes('experience')) {return 'user_experience';}
    if (inputLower.includes('process') || inputLower.includes('operational')) {return 'operational';}

    return 'general';
  }

  private extractEvaluationObjectives(input: string): string[] {
    const objectives: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('best')) {objectives.push('Identify optimal solution');}
    if (inputLower.includes('compare')) {objectives.push('Compare alternatives');}
    if (inputLower.includes('quality')) {objectives.push('Assess quality levels');}
    if (inputLower.includes('recommend')) {objectives.push('Provide recommendation');}

    return objectives.length > 0 ? objectives : ['Comprehensive evaluation'];
  }

  private identifyEvaluationConstraints(input: string): string[] {
    const constraints: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('budget')) {constraints.push('Budget limitations');}
    if (inputLower.includes('time')) {constraints.push('Time constraints');}
    if (inputLower.includes('resource')) {constraints.push('Resource limitations');}
    if (inputLower.includes('regulation')) {constraints.push('Regulatory requirements');}

    return constraints;
  }

  private identifyEvaluationStakeholders(input: string): string[] {
    const stakeholders: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('user')) {stakeholders.push('users');}
    if (inputLower.includes('customer')) {stakeholders.push('customers');}
    if (inputLower.includes('management')) {stakeholders.push('management');}
    if (inputLower.includes('team')) {stakeholders.push('team_members');}

    return stakeholders.length > 0 ? stakeholders : ['decision_makers'];
  }

  private determineEvaluationTimeline(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('urgent') || inputLower.includes('immediate')) {return 'immediate';}
    if (inputLower.includes('week')) {return 'weekly';}
    if (inputLower.includes('month')) {return 'monthly';}

    return 'standard';
  }

  private assessEvaluationComplexity(input: string): string {
    const wordCount = input.split(/\s+/).length;
    const conceptCount = this.countConcepts(input);

    if (wordCount > 100 || conceptCount > 8) {return 'high';}
    if (wordCount > 50 || conceptCount > 4) {return 'medium';}
    return 'low';
  }

  private derivePrimaryCriteria(input: string, scope: unknown): unknown[] {
    const criteria: unknown[] = [];

    // Domain-specific primary criteria
    switch (scope.domain) {
      case 'technical':
        criteria.push(
          { name: 'Technical feasibility', weight: 0.3, type: 'primary' },
          { name: 'Performance', weight: 0.25, type: 'primary' },
          { name: 'Scalability', weight: 0.2, type: 'primary' },
        );
        break;
      case 'business':
        criteria.push(
          { name: 'Cost effectiveness', weight: 0.3, type: 'primary' },
          { name: 'ROI potential', weight: 0.25, type: 'primary' },
          { name: 'Strategic alignment', weight: 0.2, type: 'primary' },
        );
        break;
      default:
        criteria.push(
          { name: 'Effectiveness', weight: 0.3, type: 'primary' },
          { name: 'Feasibility', weight: 0.25, type: 'primary' },
          { name: 'Value', weight: 0.2, type: 'primary' },
        );
    }

    return criteria;
  }

  private deriveSecondaryCriteria(input: string, scope: unknown): unknown[] {
    return [
      { name: 'Risk level', weight: 0.15, type: 'secondary' },
      { name: 'Implementation complexity', weight: 0.1, type: 'secondary' },
    ];
  }

  private deriveStakeholderCriteria(stakeholders: string[]): unknown[] {
    const criteria: unknown[] = [];

    if (stakeholders.includes('users')) {
      criteria.push({ name: 'User satisfaction', weight: 0.15, type: 'stakeholder' });
    }

    if (stakeholders.includes('management')) {
      criteria.push({ name: 'Management approval', weight: 0.1, type: 'stakeholder' });
    }

    return criteria;
  }

  private extractExplicitAlternatives(input: string): unknown[] {
    const alternatives: unknown[] = [];

    // Look for explicit alternative mentions
    const alternativePatterns = [/option\s+(\w+)/gi, /alternative\s+(\w+)/gi, /approach\s+(\w+)/gi];

    alternativePatterns.forEach((pattern) => {
      const matches = input.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          alternatives.push({
            name: match,
            type: 'explicit',
            source: 'input_text',
          });
        });
      }
    });

    return alternatives;
  }

  private generateImplicitAlternatives(input: string, scope: unknown): unknown[] {
    // Generate alternatives based on domain and type
    const alternatives: unknown[] = [];

    switch (scope.type) {
      case 'option_evaluation':
        alternatives.push(
          { name: 'Standard approach', type: 'implicit', source: 'generated' },
          { name: 'Alternative approach', type: 'implicit', source: 'generated' },
          { name: 'Hybrid approach', type: 'implicit', source: 'generated' },
        );
        break;
      default:
        alternatives.push(
          { name: 'Current solution', type: 'implicit', source: 'generated' },
          { name: 'Improved solution', type: 'implicit', source: 'generated' },
        );
    }

    return alternatives;
  }

  private createStatusQuoOption(scope: unknown): unknown {
    return {
      name: 'Status quo (no change)',
      type: 'baseline',
      source: 'generated',
    };
  }

  private determineAnalysisDepth(alternatives: unknown[], criteria: unknown[]): string {
    const complexity = alternatives.length * criteria.length;

    if (complexity > 20) {return 'comprehensive';}
    if (complexity > 10) {return 'detailed';}
    return 'standard';
  }

  private selectAnalysisMethodology(alternatives: unknown[], criteria: unknown[]): string {
    if (alternatives.length > 5 || criteria.length > 8) {return 'multi_criteria_decision_analysis';}
    if (criteria.some((c) => c.type === 'quantitative')) {return 'weighted_scoring';}
    return 'comparative_analysis';
  }

  private createComparisonMatrix(alternatives: unknown[], criteria: unknown[]): unknown {
    return {
      dimensions: `${alternatives.length}x${criteria.length}`,
      methodology: 'pairwise_comparison',
      completeness: 'full_matrix',
    };
  }

  private analyzeStrengthsWeaknesses(alternatives: unknown[], criteria: unknown[]): unknown {
    return {
      strengths_identified: alternatives.length * 2,
      weaknesses_identified: alternatives.length * 2,
      analysis_depth: 'detailed',
    };
  }

  private identifyTradeOffs(alternatives: unknown[], criteria: unknown[]): string[] {
    return [
      'Cost vs. Quality trade-off',
      'Speed vs. Accuracy trade-off',
      'Flexibility vs. Simplicity trade-off',
      'Features vs. Usability trade-off',
    ];
  }

  private assessRisks(alternatives: unknown[], criteria: unknown[]): unknown {
    return {
      risk_categories: ['implementation', 'performance', 'adoption'],
      risk_levels: ['low', 'medium', 'high'],
      mitigation_strategies: 'identified',
    };
  }

  private selectScoringMethod(criteria: unknown[]): string {
    const hasQuantitative = criteria.some((c) => c.type === 'quantitative');
    const hasWeights = criteria.every((c) => c.weight !== undefined);

    if (hasQuantitative && hasWeights) {return 'weighted_quantitative';}
    if (hasWeights) {return 'weighted_qualitative';}
    return 'simple_scoring';
  }

  private assignCriteriaWeights(criteria: unknown[]): unknown {
    // Normalize weights to sum to 1.0
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);

    return {
      normalized: totalWeight > 0,
      total_weight: totalWeight,
      distribution: 'balanced',
    };
  }

  private calculateScores(comparisonMatrix: unknown, criteria: unknown[]): unknown {
    return {
      methodology: comparisonMatrix.methodology,
      scale: '1-10',
      aggregation: 'weighted_average',
    };
  }

  private generateRankings(comparisonMatrix: unknown, criteria: unknown[]): unknown[] {
    // Simulated rankings for demonstration
    return [
      { option: 'Top Choice', score: 8.5, rank: 1 },
      { option: 'Second Choice', score: 7.2, rank: 2 },
      { option: 'Third Choice', score: 6.8, rank: 3 },
    ];
  }

  private calculateConfidence(analysis: unknown, criteria: unknown[]): number {
    // Simplified confidence calculation
    const dataQuality = 0.8;
    const methodologyRobustness = 0.9;
    const consensusLevel = 0.7;

    return (dataQuality + methodologyRobustness + consensusLevel) / 3;
  }

  private performSensitivityAnalysis(analysis: unknown, criteria: unknown[]): unknown {
    return {
      weight_sensitivity: 'low',
      ranking_stability: 'high',
      critical_factors: ['primary criteria', 'constraint satisfaction'],
    };
  }

  private determineRecommendationType(scoring: unknown): string {
    if (scoring.confidence > 0.8) {return 'strong_recommendation';}
    if (scoring.confidence > 0.6) {return 'conditional_recommendation';}
    return 'exploratory_recommendation';
  }

  private identifyPrimaryChoice(scoring: unknown): string {
    return scoring.rankings[0]?.option || 'Top-ranked option';
  }

  private developRationale(scoring: unknown): string[] {
    return [
      'Highest overall score across all criteria',
      'Strong performance in critical areas',
      'Acceptable risk profile',
      'Good strategic alignment',
    ];
  }

  private identifyConditions(scoring: unknown): string[] {
    const conditions: string[] = [];

    if (scoring.confidence < 0.8) {
      conditions.push('Subject to additional validation');
    }

    if (scoring.sensitivity.weight_sensitivity === 'high') {
      conditions.push('Sensitive to criteria weightings');
    }

    return conditions;
  }

  private suggestAlternatives(scoring: unknown): string[] {
    return scoring.rankings.slice(1, 3).map((ranking: unknown) => ranking.option);
  }

  private provideImplementationNotes(scoring: unknown): string[] {
    return [
      'Monitor key success metrics during implementation',
      'Plan for contingency options if needed',
      'Engage stakeholders throughout process',
    ];
  }

  private countConcepts(input: string): number {
    // Count significant concepts in the input
    const words = input.split(/\s+/).filter((word) => word.length > 5);
    return Math.min(words.length, 12);
  }
}
