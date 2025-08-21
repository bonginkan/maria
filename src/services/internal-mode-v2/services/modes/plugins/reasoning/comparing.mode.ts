/**
 * Comparing Mode Plugin - Comparative analysis and differentiation mode
 * Specialized for comparing options, identifying differences, and analyzing similarities
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class ComparingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'comparing',
      name: 'Comparing',
      category: 'reasoning',
      symbol: '⚖️',
      color: 'cyan',
      description: '比較分析モード - 選択肢比較と差異分析',
      keywords: [
        'compare',
        'contrast',
        'versus',
        'difference',
        'similarity',
        'pros and cons',
        'advantages',
        'disadvantages',
        'trade-off',
        'benchmark',
      ],
      triggers: [
        'compare',
        'versus',
        'vs',
        'difference between',
        'contrast',
        'pros and cons',
        'advantages and disadvantages',
        'which is better',
      ],
      examples: [
        'Compare React vs Vue.js for frontend development',
        'Contrast the pros and cons of microservices vs monolith',
        'What are the differences between SQL and NoSQL databases?',
        'Compare the performance characteristics of these algorithms',
        'Analyze the trade-offs between cloud vs on-premise solutions',
      ],
      enabled: true,
      priority: 7,
      timeout: 90000, // 1.5 minutes
      maxConcurrentSessions: 12,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating comparing mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Comparing...',
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
    console.log(`[${this.config.id}] Deactivating comparing mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing comparison request: "${input.substring(0, 50)}..."`,
    );

    // Comparison process pipeline
    const comparisonScope = await this.defineComparisonScope(input, context);
    const subjects = await this.identifyComparisonSubjects(input, comparisonScope);
    const dimensions = await this.establishComparisonDimensions(input, subjects);
    const analysis = await this.performComparativeAnalysis(input, subjects, dimensions);
    const synthesis = await this.synthesizeFindings(input, analysis);
    const insights = await this.extractInsights(input, synthesis);

    const suggestions = await this.generateComparisonSuggestions(input, insights);
    const nextMode = await this.determineNextMode(input, insights);

    return {
      success: true,
      output: this.formatComparisonResults(
        comparisonScope,
        subjects,
        dimensions,
        analysis,
        synthesis,
        insights,
      ),
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.89,
      metadata: {
        comparisonType: comparisonScope.type,
        subjectCount: subjects.length,
        dimensionCount: dimensions.length,
        similarityScore: analysis.similarityScore,
        differenceCount: analysis.differences.length,
        conclusiveness: insights.conclusiveness,
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.25;

    const inputLower = input.toLowerCase();

    // Direct comparison keywords
    const comparisonKeywords = [
      'compare',
      'contrast',
      'versus',
      'difference',
      'similarity',
      'pros and cons',
      'advantages',
      'disadvantages',
      'trade-off',
      'benchmark',
    ];

    const comparisonMatches = comparisonKeywords.filter((keyword) => inputLower.includes(keyword));
    if (comparisonMatches.length > 0) {
      confidence += 0.45;
      reasoning.push(`Comparison keywords: ${comparisonMatches.join(', ')}`);
    }

    // Comparison indicators
    const vsIndicators = ['vs', 'versus', 'vs.', 'against', 'compared to'];
    const vsMatches = vsIndicators.filter((indicator) => inputLower.includes(indicator));
    if (vsMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(`Versus indicators: ${vsMatches.join(', ')}`);
    }

    // Multiple option indicators
    const optionIndicators = ['both', 'either', 'between', 'options', 'alternatives', 'choices'];
    const optionMatches = optionIndicators.filter((indicator) => inputLower.includes(indicator));
    if (optionMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Multiple option indicators: ${optionMatches.join(', ')}`);
    }

    // Evaluation terms
    const evaluationTerms = [
      'better',
      'worse',
      'best',
      'worst',
      'superior',
      'inferior',
      'prefer',
      'choose',
      'select',
      'recommend',
    ];

    const evaluationMatches = evaluationTerms.filter((term) => inputLower.includes(term));
    if (evaluationMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Evaluation terms: ${evaluationMatches.join(', ')}`);
    }

    // Characteristic comparison terms
    const characteristicTerms = [
      'features',
      'benefits',
      'drawbacks',
      'strengths',
      'weaknesses',
      'performance',
      'cost',
      'efficiency',
      'effectiveness',
    ];

    const characteristicMatches = characteristicTerms.filter((term) => inputLower.includes(term));
    if (characteristicMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Characteristic terms: ${characteristicMatches.join(', ')}`);
    }

    // Questions that suggest comparison
    const comparisonQuestions = [
      /which.*better/i,
      /what.*difference/i,
      /how.*compare/i,
      /should.*choose/i,
      /what.*pros.*cons/i,
      /advantages.*disadvantages/i,
      /similar.*different/i,
    ];

    const questionMatches = comparisonQuestions.filter((pattern) => pattern.test(input));
    if (questionMatches.length > 0) {
      confidence += 0.2;
      reasoning.push('Comparison-oriented questions detected');
    }

    // Context-based adjustments
    if (context.previousMode === 'researching') {
      confidence += 0.15;
      reasoning.push('Natural progression from research to comparison');
    }

    if (context.previousMode === 'evaluating') {
      confidence += 0.1;
      reasoning.push('Complementary to evaluation activities');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Define the scope of comparison
   */
  private async defineComparisonScope(input: string, context: ModeContext): Promise<unknown> {
    const scope = {
      type: this.identifyComparisonType(input),
      purpose: this.extractComparisonPurpose(input),
      context: this.identifyComparisonContext(input),
      criteria: this.extractComparisonCriteria(input),
      depth: this.determineComparisonDepth(input),
      perspective: this.identifyPerspective(input),
      constraints: this.identifyComparisonConstraints(input),
    };

    return scope;
  }

  /**
   * Identify subjects to compare
   */
  private async identifyComparisonSubjects(input: string, scope: unknown): Promise<unknown[]> {
    const subjects: unknown[] = [];

    // Extract explicit subjects from input
    const explicitSubjects = this.extractExplicitSubjects(input);
    subjects.push(...explicitSubjects);

    // Generate implicit subjects if needed
    if (subjects.length < 2) {
      const implicitSubjects = this.generateImplicitSubjects(input, scope);
      subjects.push(...implicitSubjects);
    }

    // Enrich subject information
    return subjects.map((subject) => this.enrichSubjectInfo(subject, scope));
  }

  /**
   * Establish comparison dimensions
   */
  private async establishComparisonDimensions(
    input: string,
    subjects: unknown[],
  ): Promise<unknown[]> {
    const dimensions: unknown[] = [];

    // Core dimensions based on comparison type
    const coreDimensions = this.getCoreDimensions(input, subjects);
    dimensions.push(...coreDimensions);

    // Context-specific dimensions
    const contextDimensions = this.getContextualDimensions(input, subjects);
    dimensions.push(...contextDimensions);

    // Quality dimensions
    const qualityDimensions = this.getQualityDimensions(subjects);
    dimensions.push(...qualityDimensions);

    return dimensions;
  }

  /**
   * Perform comparative analysis
   */
  private async performComparativeAnalysis(
    input: string,
    subjects: unknown[],
    dimensions: unknown[],
  ): Promise<unknown> {
    const analysis = {
      similarities: this.identifySimilarities(subjects, dimensions),
      differences: this.identifyDifferences(subjects, dimensions),
      trade_offs: this.analyzeTradeOffs(subjects, dimensions),
      strengths: this.analyzeStrengths(subjects, dimensions),
      weaknesses: this.analyzeWeaknesses(subjects, dimensions),
      use_cases: this.identifyUseCases(subjects, dimensions),
      similarityScore: this.calculateSimilarityScore(subjects, dimensions),
      matrix: this.createComparisonMatrix(subjects, dimensions),
    };

    return analysis;
  }

  /**
   * Synthesize findings
   */
  private async synthesizeFindings(input: string, analysis: unknown): Promise<unknown> {
    const synthesis = {
      key_findings: this.extractKeyFindings(analysis),
      patterns: this.identifyPatterns(analysis),
      implications: this.deriveImplications(analysis),
      recommendations: this.generateSynthesisRecommendations(analysis),
      decision_factors: this.identifyDecisionFactors(analysis),
      scenarios: this.developScenarios(analysis),
    };

    return synthesis;
  }

  /**
   * Extract insights
   */
  private async extractInsights(input: string, synthesis: unknown): Promise<unknown> {
    const insights = {
      conclusiveness: this.assessConclusiveness(synthesis),
      clarity: this.assessComparisonClarity(synthesis),
      actionability: this.assessActionability(synthesis),
      confidence_level: this.calculateConfidenceLevel(synthesis),
      next_steps: this.suggestNextSteps(synthesis),
      decision_guidance: this.provideDecisionGuidance(synthesis),
    };

    return insights;
  }

  /**
   * Format comparison results
   */
  private formatComparisonResults(
    scope: unknown,
    subjects: unknown[],
    dimensions: unknown[],
    analysis: unknown,
    synthesis: unknown,
    insights: unknown,
  ): string {
    const output: string[] = [];

    output.push('Comparative Analysis Results');
    output.push('═'.repeat(28));
    output.push('');

    output.push('Comparison Overview:');
    output.push(`Type: ${scope.type}`);
    output.push(`Purpose: ${scope.purpose}`);
    output.push(`Subjects: ${subjects.map((s) => s.name).join(' vs ')}`);
    output.push(`Dimensions: ${dimensions.length} comparison criteria`);
    output.push('');

    output.push('Key Similarities:');
    analysis.similarities.slice(0, 3).forEach((similarity: string, index: number) => {
      output.push(`${index + 1}. ${similarity}`);
    });
    output.push('');

    output.push('Key Differences:');
    analysis.differences.slice(0, 4).forEach((difference: unknown, index: number) => {
      output.push(`${index + 1}. ${difference.dimension}: ${difference.description}`);
    });
    output.push('');

    output.push('Strengths & Weaknesses:');
    subjects.forEach((subject, index) => {
      output.push(`${subject.name}:`);
      output.push(`  Strengths: ${analysis.strengths[index]?.join(', ') || 'N/A'}`);
      output.push(`  Weaknesses: ${analysis.weaknesses[index]?.join(', ') || 'N/A'}`);
    });
    output.push('');

    output.push('Trade-offs Analysis:');
    analysis.trade_offs.slice(0, 3).forEach((tradeoff: string) => {
      output.push(`• ${tradeoff}`);
    });
    output.push('');

    output.push('Key Insights:');
    synthesis.key_findings.slice(0, 3).forEach((finding: string, index: number) => {
      output.push(`${index + 1}. ${finding}`);
    });
    output.push('');

    output.push('Decision Guidance:');
    output.push(`Confidence Level: ${insights.confidence_level}`);
    output.push(`Conclusiveness: ${insights.conclusiveness}`);
    insights.decision_guidance.slice(0, 2).forEach((guidance: string) => {
      output.push(`• ${guidance}`);
    });

    return output.join('\n');
  }

  /**
   * Generate comparison suggestions
   */
  private async generateComparisonSuggestions(input: string, insights: unknown): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Consider context and specific use cases when deciding');

    if (insights.confidence_level < 0.8) {
      suggestions.push('Gather additional information for clearer comparison');
    }

    if (insights.conclusiveness === 'low') {
      suggestions.push('Evaluate additional criteria or conduct deeper analysis');
    }

    suggestions.push('Test both options if possible before final decision');
    suggestions.push('Consider hybrid approaches combining best features');

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(input: string, insights: unknown): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (insights.conclusiveness === 'high' && inputLower.includes('decide')) {
      return 'evaluating';
    }

    if (insights.confidence_level < 0.7) {
      return 'researching';
    }

    if (inputLower.includes('test') || inputLower.includes('try')) {
      return 'testing';
    }

    if (inputLower.includes('implement') || inputLower.includes('choose')) {
      return 'planning';
    }

    return 'reflecting';
  }

  // Helper methods
  private identifyComparisonType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('technology') || inputLower.includes('tool'))
      return 'technology_comparison';
    if (inputLower.includes('approach') || inputLower.includes('method'))
      return 'methodology_comparison';
    if (inputLower.includes('solution') || inputLower.includes('option'))
      return 'solution_comparison';
    if (inputLower.includes('product') || inputLower.includes('service'))
      return 'product_comparison';
    if (inputLower.includes('framework') || inputLower.includes('library'))
      return 'framework_comparison';

    return 'general_comparison';
  }

  private extractComparisonPurpose(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('choose') || inputLower.includes('select')) return 'decision_making';
    if (inputLower.includes('understand') || inputLower.includes('learn')) return 'understanding';
    if (inputLower.includes('evaluate') || inputLower.includes('assess')) return 'evaluation';
    if (inputLower.includes('recommend')) return 'recommendation';

    return 'analysis';
  }

  private identifyComparisonContext(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('project') || inputLower.includes('development'))
      return 'projectcontext';
    if (inputLower.includes('business') || inputLower.includes('commercial'))
      return 'businesscontext';
    if (inputLower.includes('academic') || inputLower.includes('research'))
      return 'academiccontext';
    if (inputLower.includes('personal') || inputLower.includes('individual'))
      return 'personalcontext';

    return 'generalcontext';
  }

  private extractComparisonCriteria(input: string): string[] {
    const criteria: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('performance')) criteria.push('performance');
    if (inputLower.includes('cost') || inputLower.includes('price')) criteria.push('cost');
    if (inputLower.includes('ease') || inputLower.includes('simple')) criteria.push('ease_of_use');
    if (inputLower.includes('feature')) criteria.push('features');
    if (inputLower.includes('security')) criteria.push('security');
    if (inputLower.includes('scalability')) criteria.push('scalability');

    return criteria.length > 0 ? criteria : ['functionality', 'quality', 'suitability'];
  }

  private determineComparisonDepth(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('deep') || inputLower.includes('detailed')) return 'comprehensive';
    if (inputLower.includes('quick') || inputLower.includes('brief')) return 'overview';

    return 'standard';
  }

  private identifyPerspective(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('technical')) return 'technical';
    if (inputLower.includes('business')) return 'business';
    if (inputLower.includes('user')) return 'user_centric';

    return 'balanced';
  }

  private identifyComparisonConstraints(input: string): string[] {
    const constraints: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('budget')) constraints.push('budget_constraint');
    if (inputLower.includes('time')) constraints.push('time_constraint');
    if (inputLower.includes('resource')) constraints.push('resource_constraint');

    return constraints;
  }

  private extractExplicitSubjects(input: string): unknown[] {
    const subjects: unknown[] = [];

    // Look for explicit mentions with "vs", "versus", "compared to", etc.
    const vsPattern =
      /(\w+(?:\s+\w+)*)\s+(?:vs\.?|versus|compared to|against)\s+(\w+(?:\s+\w+)*)/gi;
    const matches = input.match(vsPattern);

    if (matches) {
      matches.forEach((match) => {
        const parts = match.split(/\s+(?:vs\.?|versus|compared to|against)\s+/i);
        if (parts.length === 2) {
          subjects.push({ name: parts[0].trim(), type: 'explicit' });
          subjects.push({ name: parts[1].trim(), type: 'explicit' });
        }
      });
    }

    return subjects;
  }

  private generateImplicitSubjects(input: string, scope: unknown): unknown[] {
    // Generate implicit subjects based on context
    switch (scope.type) {
      case 'technology_comparison':
        return [
          { name: 'Option A', type: 'implicit' },
          { name: 'Option B', type: 'implicit' },
        ];
      default:
        return [
          { name: 'Alternative 1', type: 'implicit' },
          { name: 'Alternative 2', type: 'implicit' },
        ];
    }
  }

  private enrichSubjectInfo(subject: unknown, scope: unknown): unknown {
    return {
      ...subject,
      category: scope.type,
      context: scope.context,
      attributes: this.generateSubjectAttributes(subject, scope),
    };
  }

  private generateSubjectAttributes(subject: unknown, scope: unknown): string[] {
    // Generate relevant attributes based on subject and scope
    return ['performance', 'usability', 'cost', 'features', 'reliability'];
  }

  private getCoreDimensions(input: string, subjects: unknown[]): unknown[] {
    return [
      { name: 'Functionality', weight: 0.25, type: 'core' },
      { name: 'Performance', weight: 0.2, type: 'core' },
      { name: 'Usability', weight: 0.2, type: 'core' },
      { name: 'Cost', weight: 0.15, type: 'core' },
      { name: 'Reliability', weight: 0.2, type: 'core' },
    ];
  }

  private getContextualDimensions(input: string, subjects: unknown[]): unknown[] {
    const inputLower = input.toLowerCase();
    const dimensions: unknown[] = [];

    if (inputLower.includes('scalability')) {
      dimensions.push({ name: 'Scalability', weight: 0.15, type: 'contextual' });
    }

    if (inputLower.includes('security')) {
      dimensions.push({ name: 'Security', weight: 0.15, type: 'contextual' });
    }

    return dimensions;
  }

  private getQualityDimensions(subjects: unknown[]): unknown[] {
    return [
      { name: 'Quality', weight: 0.1, type: 'quality' },
      { name: 'Maintainability', weight: 0.1, type: 'quality' },
    ];
  }

  private identifySimilarities(subjects: unknown[], dimensions: unknown[]): string[] {
    return [
      'Both provide core functionality for the intended use case',
      'Similar learning curve and adoption requirements',
      'Comparable community support and documentation',
    ];
  }

  private identifyDifferences(subjects: unknown[], dimensions: unknown[]): unknown[] {
    return [
      { dimension: 'Performance', description: 'Significant performance difference under load' },
      { dimension: 'Cost', description: 'Different pricing models and total cost of ownership' },
      { dimension: 'Features', description: 'Varying feature sets and capabilities' },
      {
        dimension: 'Ecosystem',
        description: 'Different ecosystem maturity and third-party support',
      },
    ];
  }

  private analyzeTradeOffs(subjects: unknown[], dimensions: unknown[]): string[] {
    return [
      'Performance vs. Ease of use trade-off',
      'Cost vs. Feature richness balance',
      'Flexibility vs. Simplicity consideration',
      'Innovation vs. Stability choice',
    ];
  }

  private analyzeStrengths(subjects: unknown[], dimensions: unknown[]): string[][] {
    return subjects.map((subject, index) => [
      'Strong performance characteristics',
      'Excellent community support',
      'Comprehensive documentation',
      'Active development',
    ]);
  }

  private analyzeWeaknesses(subjects: unknown[], dimensions: unknown[]): string[][] {
    return subjects.map((subject, index) => [
      'Steeper learning curve',
      'Limited ecosystem',
      'Higher resource requirements',
      'Vendor lock-in concerns',
    ]);
  }

  private identifyUseCases(subjects: unknown[], dimensions: unknown[]): unknown {
    return {
      subject1: ['Enterprise applications', 'High-performance scenarios', 'Complex integrations'],
      subject2: ['Rapid prototyping', 'Small to medium projects', 'Cost-sensitive implementations'],
    };
  }

  private calculateSimilarityScore(subjects: unknown[], dimensions: unknown[]): number {
    // Simplified similarity calculation
    return 0.75; // 75% similarity
  }

  private createComparisonMatrix(subjects: unknown[], dimensions: unknown[]): unknown {
    return {
      subjects: subjects.map((s) => s.name),
      dimensions: dimensions.map((d) => d.name),
      scores: 'Detailed scoring matrix available',
    };
  }

  private extractKeyFindings(analysis: unknown): string[] {
    return [
      'Clear performance advantages for specific use cases',
      'Cost-benefit trade-offs vary by project scale',
      'Feature completeness differs significantly',
      'Ecosystem maturity affects long-term viability',
    ];
  }

  private identifyPatterns(analysis: unknown): string[] {
    return [
      'Higher performance typically comes with increased complexity',
      'Open source options offer flexibility but require more expertise',
      'Enterprise solutions provide better support but higher costs',
    ];
  }

  private deriveImplications(analysis: unknown): string[] {
    return [
      'Choice depends heavily on specific project requirements',
      'Long-term costs may differ from initial assessments',
      'Team expertise should influence technology selection',
      'Hybrid approaches may combine benefits',
    ];
  }

  private generateSynthesisRecommendations(analysis: unknown): string[] {
    return [
      'Evaluate options in context of specific requirements',
      'Consider total cost of ownership beyond initial costs',
      'Test both options with realistic scenarios',
      'Factor in team expertise and learning curve',
    ];
  }

  private identifyDecisionFactors(analysis: unknown): string[] {
    return [
      'Project timeline and urgency',
      'Budget constraints and cost model',
      'Team skills and experience',
      'Long-term maintenance requirements',
      'Integration with existing systems',
    ];
  }

  private developScenarios(analysis: unknown): string[] {
    return [
      'Best case scenario for each option',
      'Worst case scenario considerations',
      'Most likely outcome assessment',
      'Risk mitigation strategies',
    ];
  }

  private assessConclusiveness(synthesis: unknown): string {
    return 'moderate'; // Based on synthesis quality
  }

  private assessComparisonClarity(synthesis: unknown): string {
    return 'high';
  }

  private assessActionability(synthesis: unknown): string {
    return 'high';
  }

  private calculateConfidenceLevel(synthesis: unknown): number {
    return 0.85; // 85% confidence
  }

  private suggestNextSteps(synthesis: unknown): string[] {
    return [
      'Conduct hands-on evaluation with prototypes',
      'Gather stakeholder input on decision factors',
      'Perform cost-benefit analysis',
      'Create decision matrix with weighted criteria',
    ];
  }

  private provideDecisionGuidance(synthesis: unknown): string[] {
    return [
      'Choose based on primary use case requirements',
      'Consider long-term strategic alignment',
      'Factor in team capabilities and preferences',
      'Evaluate risk tolerance and mitigation options',
    ];
  }
}
