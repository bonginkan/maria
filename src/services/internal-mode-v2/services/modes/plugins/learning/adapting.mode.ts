/**
 * Adapting Mode Plugin - Adaptive learning and adjustment mode
 * Specialized for learning from feedback, adjusting approaches, and continuous improvement
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class AdaptingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'adapting',
      name: 'Adapting',
      category: 'learning',
      symbol: '🔄',
      color: 'yellow',
      description: '適応学習モード - フィードバック学習と継続的改善',
      keywords: [
        'adapt',
        'adjust',
        'modify',
        'improve',
        'learn',
        'feedback',
        'iterate',
        'refine',
        'evolve',
        'change',
        'update',
      ],
      triggers: [
        'adapt to',
        'adjust based on',
        'learn from',
        'improve based on',
        'modify approach',
        'change strategy',
        'iterate on',
        'refine',
      ],
      examples: [
        'Adapt the approach based on user feedback',
        'Learn from these results and improve',
        'Adjust the strategy given new information',
        'Modify the solution based on constraints',
        'Iterate on this design with improvements',
      ],
      enabled: true,
      priority: 5,
      timeout: 75000, // 1.25 minutes
      maxConcurrentSessions: 8,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating adapting mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Adapting...',
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
    console.log(`[${this.config.id}] Deactivating adapting mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing adaptation request: "${input.substring(0, 50)}..."`,
    );

    // Adaptation process pipeline
    const currentState = await this.assessCurrentState(input, context);
    const changeRequirements = await this.analyzeChangeRequirements(input, currentState);
    const adaptationStrategy = await this.developAdaptationStrategy(input, changeRequirements);
    const modifications = await this.implementModifications(input, adaptationStrategy);
    const validation = await this.validateAdaptations(modifications, changeRequirements);
    const learningInsights = await this.extractLearningInsights(input, modifications, validation);

    const suggestions = await this.generateAdaptationSuggestions(input, learningInsights);
    const nextMode = await this.determineNextMode(input, learningInsights);

    return {
      success: true,
      output: this.formatAdaptationResults(modifications, learningInsights, validation),
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.84,
      metadata: {
        currentState,
        changeRequirements,
        adaptationStrategy: adaptationStrategy.type,
        modificationsCount: modifications.length,
        validationScore: validation.score,
        learningCategory: learningInsights.category,
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

    // Direct adaptation keywords
    const adaptationKeywords = [
      'adapt',
      'adjust',
      'modify',
      'improve',
      'learn',
      'change',
      'iterate',
      'refine',
      'evolve',
      'update',
      'revise',
    ];

    const adaptMatches = adaptationKeywords.filter((keyword) => inputLower.includes(keyword));
    if (adaptMatches.length > 0) {
      confidence += 0.35;
      reasoning.push(`Adaptation keywords: ${adaptMatches.join(', ')}`);
    }

    // Feedback and learning indicators
    const feedbackIndicators = [
      'feedback',
      'based on',
      'given that',
      'considering',
      'in light of',
      'after reviewing',
      'lessons learned',
      'experience shows',
    ];

    const feedbackMatches = feedbackIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    );
    if (feedbackMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(`Feedback/learning indicators: ${feedbackMatches.length} found`);
    }

    // Change requirement phrases
    const changePhases = [
      'need to change',
      'should modify',
      'must adapt',
      'requires adjustment',
      'better approach',
      'different strategy',
      'new method',
    ];

    const changeMatches = changePhases.filter((phrase) => inputLower.includes(phrase));
    if (changeMatches.length > 0) {
      confidence += 0.25;
      reasoning.push(`Change requirement phrases detected`);
    }

    // Iterative language
    const iterativeTerms = ['version', 'iteration', 'round', 'cycle', 'phase'];
    const iterativeMatches = iterativeTerms.filter((term) => inputLower.includes(term));
    if (iterativeMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Iterative process terms: ${iterativeMatches.join(', ')}`);
    }

    // Context-based adaptation signals
    if (
      context.previousMode &&
      ['debugging', 'optimizing', 'testing'].includes(context.previousMode)
    ) {
      confidence += 0.2;
      reasoning.push('Good context for adaptation from previous mode');
    }

    // Conditional statements that suggest adaptation
    const conditionalPatterns = [/if.*then/i, /when.*should/i, /given.*need/i, /since.*must/i];

    const conditionalMatches = conditionalPatterns.filter((pattern) => pattern.test(input));
    if (conditionalMatches.length > 0) {
      confidence += 0.1;
      reasoning.push('Conditional statements suggest adaptation logic');
    }

    // Error or failure context
    if (
      inputLower.includes('error') ||
      inputLower.includes('failed') ||
      inputLower.includes('problem')
    ) {
      confidence += 0.15;
      reasoning.push('Error/failure context suggests need for adaptation');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Assess the current state that needs adaptation
   */
  private async assessCurrentState(input: string, context: ModeContext): Promise<unknown> {
    const state = {
      domain: this.identifyDomain(input),
      currentApproach: this.extractCurrentApproach(input),
      constraints: this.identifyConstraints(input),
      performance: this.assessCurrentPerformance(input),
      context: this.analyzeContextualFactors(input, context),
      stakeholders: this.identifyStakeholders(input),
    };

    return state;
  }

  /**
   * Analyze what changes are required
   */
  private async analyzeChangeRequirements(input: string, currentState: unknown): Promise<unknown> {
    const requirements = {
      type: this.classifyChangeType(input),
      scope: this.determineChangeScope(input),
      urgency: this.assessChangeUrgency(input),
      drivers: this.identifyChangDrivers(input),
      success_criteria: this.defineSuccessCriteria(input),
      risks: this.identifyAdaptationRisks(input),
    };

    return requirements;
  }

  /**
   * Develop strategy for adaptation
   */
  private async developAdaptationStrategy(input: string, requirements: unknown): Promise<unknown> {
    const strategies = {
      incremental: 'Small, gradual changes to minimize risk',
      radical: 'Fundamental changes to address core issues',
      experimental: 'Try new approaches with ability to rollback',
      hybrid: 'Combination of proven and innovative methods',
      conservative: 'Minimal changes to maintain stability',
      aggressive: 'Bold changes to achieve breakthrough results',
    };

    const strategyType = this.selectAdaptationStrategy(requirements);

    return {
      type: strategyType,
      description: strategies[strategyType] || strategies['incremental'],
      phases: this.planAdaptationPhases(requirements, strategyType),
      timeline: this.estimateAdaptationTimeline(requirements),
      resources: this.identifyRequiredResources(requirements),
    };
  }

  /**
   * Implement the modifications
   */
  private async implementModifications(input: string, strategy: unknown): Promise<unknown[]> {
    const modifications: unknown[] = [];

    // Generate specific modifications based on strategy
    switch (strategy.type) {
      case 'incremental':
        modifications.push(...this.generateIncrementalChanges(input));
        break;
      case 'radical':
        modifications.push(...this.generateRadicalChanges(input));
        break;
      case 'experimental':
        modifications.push(...this.generateExperimentalChanges(input));
        break;
      default:
        modifications.push(...this.generateDefaultChanges(input));
    }

    return modifications;
  }

  /**
   * Validate the adaptations
   */
  private async validateAdaptations(
    modifications: unknown[],
    requirements: unknown,
  ): Promise<unknown> {
    const validation = {
      score: this.calculateAdaptationScore(modifications, requirements),
      coverage: this.assessRequirementsCoverage(modifications, requirements),
      risks: this.evaluateAdaptationRisks(modifications),
      benefits: this.projectAdaptationBenefits(modifications),
      recommendations: this.generateValidationRecommendations(modifications, requirements),
    };

    return validation;
  }

  /**
   * Extract learning insights from the adaptation process
   */
  private async extractLearningInsights(
    input: string,
    modifications: unknown[],
    validation: unknown,
  ): Promise<unknown> {
    const insights = {
      category: this.categorizeLearning(input, modifications),
      patterns: this.identifyLearningPatterns(modifications, validation),
      principles: this.extractLearningPrinciples(modifications),
      future_applications: this.identifyFutureApplications(modifications),
      knowledge_gaps: this.identifyKnowledgeGaps(validation),
      best_practices: this.deriveBestPractices(modifications, validation),
    };

    return insights;
  }

  /**
   * Format the adaptation results
   */
  private formatAdaptationResults(
    modifications: unknown[],
    insights: unknown,
    validation: unknown,
  ): string {
    const output: string[] = [];

    output.push('Adaptation Analysis Results');
    output.push('='.repeat(28));
    output.push('');

    output.push('Key Modifications:');
    modifications.slice(0, 5).forEach((mod, index) => {
      output.push(`${index + 1}. ${mod.description || mod.title || 'Modification'}`);
      output.push(`   Impact: ${mod.impact || 'Medium'}`);
      output.push(`   Effort: ${mod.effort || 'Moderate'}`);
      output.push('');
    });

    output.push('Learning Insights:');
    output.push(`Category: ${insights.category}`);
    output.push('Key Patterns:');
    insights.patterns.slice(0, 3).forEach((pattern: string) => {
      output.push(`• ${pattern}`);
    });
    output.push('');

    output.push('Validation Results:');
    output.push(`Adaptation Score: ${validation.score}/10`);
    output.push(`Requirements Coverage: ${validation.coverage}%`);
    output.push('');

    output.push('Recommendations:');
    validation.recommendations.slice(0, 3).forEach((rec: string) => {
      output.push(`• ${rec}`);
    });

    return output.join('\n');
  }

  /**
   * Generate adaptation-specific suggestions
   */
  private async generateAdaptationSuggestions(input: string, insights: unknown): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Monitor adaptation results closely');
    suggestions.push('Document lessons learned for future reference');

    if (insights.category === 'technical') {
      suggestions.push('Consider A/B testing for technical changes');
    }

    if (insights.category === 'process') {
      suggestions.push('Train team on new processes and procedures');
    }

    if (insights.knowledge_gaps.length > 0) {
      suggestions.push('Address identified knowledge gaps through training');
    }

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(input: string, insights: unknown): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('test') || inputLower.includes('validate')) {
      return 'testing';
    }

    if (inputLower.includes('optimize') || inputLower.includes('improve')) {
      return 'optimizing';
    }

    if (inputLower.includes('implement') || inputLower.includes('execute')) {
      return 'implementing';
    }

    if (insights.knowledge_gaps.length > 0) {
      return 'researching';
    }

    return 'reflecting';
  }

  // Helper methods
  private identifyDomain(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('code') || inputLower.includes('software')) {return 'technical';}
    if (inputLower.includes('process') || inputLower.includes('workflow')) {return 'process';}
    if (inputLower.includes('business') || inputLower.includes('strategy')) {return 'business';}
    if (inputLower.includes('design') || inputLower.includes('user')) {return 'design';}

    return 'general';
  }

  private extractCurrentApproach(input: string): string {
    // Extract description of current approach from input
    const sentences = input.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    return sentences[0]?.trim() || 'Current approach not specified';
  }

  private identifyConstraints(input: string): string[] {
    const constraints: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('budget')) {constraints.push('budget');}
    if (inputLower.includes('time')) {constraints.push('time');}
    if (inputLower.includes('resource')) {constraints.push('resources');}
    if (inputLower.includes('technical')) {constraints.push('technical');}
    if (inputLower.includes('regulation')) {constraints.push('regulatory');}

    return constraints;
  }

  private assessCurrentPerformance(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('poor') || inputLower.includes('bad')) {return 'poor';}
    if (inputLower.includes('excellent') || inputLower.includes('great')) {return 'excellent';}
    if (inputLower.includes('good')) {return 'good';}

    return 'average';
  }

  private analyzeContextualFactors(input: string, context: ModeContext): unknown {
    return {
      sessionHistory: context.previousMode ? `Previous: ${context.previousMode}` : 'New session',
      urgency: this.assessUrgency(input),
      complexity: this.assessComplexity(input),
    };
  }

  private identifyStakeholders(input: string): string[] {
    const stakeholders: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('user')) {stakeholders.push('users');}
    if (inputLower.includes('team')) {stakeholders.push('team');}
    if (inputLower.includes('customer')) {stakeholders.push('customers');}
    if (inputLower.includes('management')) {stakeholders.push('management');}

    return stakeholders;
  }

  private classifyChangeType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('small') || inputLower.includes('minor')) {return 'incremental';}
    if (inputLower.includes('major') || inputLower.includes('significant')) {return 'radical';}
    if (inputLower.includes('experiment') || inputLower.includes('try')) {return 'experimental';}

    return 'incremental';
  }

  private determineChangeScope(input: string): string {
    const wordCount = input.split(/\s+/).length;

    if (wordCount > 100) {return 'broad';}
    if (wordCount > 50) {return 'moderate';}
    return 'narrow';
  }

  private assessChangeUrgency(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('urgent') || inputLower.includes('asap')) {return 'high';}
    if (inputLower.includes('soon') || inputLower.includes('quickly')) {return 'medium';}

    return 'low';
  }

  private identifyChangDrivers(input: string): string[] {
    const drivers: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('feedback')) {drivers.push('user feedback');}
    if (inputLower.includes('performance')) {drivers.push('performance issues');}
    if (inputLower.includes('requirement')) {drivers.push('new requirements');}
    if (inputLower.includes('competition')) {drivers.push('competitive pressure');}

    return drivers;
  }

  private defineSuccessCriteria(input: string): string[] {
    return [
      'Improved performance metrics',
      'Positive stakeholder feedback',
      'Reduced issues and errors',
      'Meeting new requirements',
    ];
  }

  private identifyAdaptationRisks(input: string): string[] {
    return [
      'Disruption to existing processes',
      'Learning curve for stakeholders',
      'Potential for new issues',
      'Resource allocation challenges',
    ];
  }

  private selectAdaptationStrategy(requirements: unknown): string {
    if (requirements.urgency === 'high') {return 'aggressive';}
    if (requirements.scope === 'broad') {return 'incremental';}
    if (requirements.type === 'experimental') {return 'experimental';}

    return 'incremental';
  }

  private planAdaptationPhases(requirements: unknown, strategyType: string): string[] {
    const phases = ['Analysis', 'Planning', 'Implementation', 'Validation'];

    if (strategyType === 'incremental') {
      phases.splice(2, 0, 'Pilot Testing');
    }

    return phases;
  }

  private estimateAdaptationTimeline(requirements: unknown): string {
    if (requirements.urgency === 'high') {return '1-2 weeks';}
    if (requirements.scope === 'broad') {return '1-2 months';}
    return '2-4 weeks';
  }

  private identifyRequiredResources(requirements: unknown): string[] {
    return ['Development time', 'Testing resources', 'Training materials', 'Monitoring tools'];
  }

  private generateIncrementalChanges(input: string): unknown[] {
    return [
      { description: 'Small adjustment to current approach', impact: 'Low', effort: 'Low' },
      { description: 'Gradual improvement in key areas', impact: 'Medium', effort: 'Low' },
    ];
  }

  private generateRadicalChanges(input: string): unknown[] {
    return [
      { description: 'Complete redesign of approach', impact: 'High', effort: 'High' },
      { description: 'Fundamental shift in methodology', impact: 'High', effort: 'High' },
    ];
  }

  private generateExperimentalChanges(input: string): unknown[] {
    return [
      { description: 'Pilot new experimental approach', impact: 'Medium', effort: 'Medium' },
      { description: 'A/B test alternative methods', impact: 'Low', effort: 'Medium' },
    ];
  }

  private generateDefaultChanges(input: string): unknown[] {
    return [{ description: 'Standard improvement measures', impact: 'Medium', effort: 'Medium' }];
  }

  private calculateAdaptationScore(modifications: unknown[], requirements: unknown): number {
    // Simplified scoring - in reality this would be more sophisticated
    return Math.min(10, modifications.length * 2 + 6);
  }

  private assessRequirementsCoverage(modifications: unknown[], requirements: unknown): number {
    // Simplified coverage calculation
    return Math.min(100, modifications.length * 25);
  }

  private evaluateAdaptationRisks(modifications: unknown[]): string[] {
    return ['Implementation complexity', 'Change resistance', 'Technical challenges'];
  }

  private projectAdaptationBenefits(modifications: unknown[]): string[] {
    return ['Improved performance', 'Better user experience', 'Reduced maintenance'];
  }

  private generateValidationRecommendations(
    modifications: unknown[],
    requirements: unknown,
  ): string[] {
    return [
      'Implement changes incrementally',
      'Monitor key metrics closely',
      'Gather stakeholder feedback regularly',
      'Have rollback plan ready',
    ];
  }

  private categorizeLearning(input: string, modifications: unknown[]): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('code') || inputLower.includes('technical')) {return 'technical';}
    if (inputLower.includes('process') || inputLower.includes('workflow')) {return 'process';}
    if (inputLower.includes('user') || inputLower.includes('experience')) {return 'user experience';}

    return 'general';
  }

  private identifyLearningPatterns(modifications: unknown[], validation: unknown): string[] {
    return [
      'Small changes can have significant impact',
      'User feedback drives effective adaptations',
      'Iterative approach reduces risk',
    ];
  }

  private extractLearningPrinciples(modifications: unknown[]): string[] {
    return [
      'Measure before and after changes',
      'Involve stakeholders in adaptation process',
      'Document lessons learned',
    ];
  }

  private identifyFutureApplications(modifications: unknown[]): string[] {
    return [
      'Apply similar adaptation strategies to related areas',
      'Use insights for future change management',
      'Develop adaptation playbooks',
    ];
  }

  private identifyKnowledgeGaps(validation: unknown): string[] {
    if (validation.score < 7) {
      return ['Need better understanding of requirements', 'Insufficient domain knowledge'];
    }
    return [];
  }

  private deriveBestPractices(modifications: unknown[], validation: unknown): string[] {
    return [
      'Start with small, measurable changes',
      'Maintain clear communication throughout process',
      'Build in feedback loops for continuous improvement',
    ];
  }

  private assessUrgency(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('urgent') || inputLower.includes('critical')) {return 'high';}
    if (inputLower.includes('soon') || inputLower.includes('important')) {return 'medium';}

    return 'low';
  }

  private assessComplexity(input: string): string {
    const wordCount = input.split(/\s+/).length;

    if (wordCount > 100) {return 'high';}
    if (wordCount > 50) {return 'medium';}
    return 'low';
  }
}
