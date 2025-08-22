/**
 * Brainstorming Mode Plugin - Creative ideation and concept generation mode
 * Specialized for generating diverse ideas, exploring possibilities, and creative thinking
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class BrainstormingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'brainstorming',
      name: 'Brainstorming',
      category: 'creative',
      symbol: '💡',
      color: 'green',
      description: '制約を緩めて多様な発想生成 - 創造的アイデア創出とコンセプト開発専門モード',
      keywords: [
        'idea',
        'ideas',
        'brainstorm',
        'creative',
        'think',
        'concept',
        'innovative',
        'original',
        'unique',
        'alternative',
        'possibility',
        'inspiration',
        'imagination',
        'design',
        'invent',
        'explore',
      ],
      triggers: [
        'brainstorm',
        'ideas',
        'think of',
        'come up with',
        'creative',
        'innovative',
        'what if',
        'alternatives',
        'possibilities',
        'inspire',
        'imagine',
        'design ideas',
        'concepts',
      ],
      examples: [
        'Brainstorm ideas for a new mobile app',
        'What are some creative solutions for this problem?',
        'Generate concepts for improving user experience',
        'Think of innovative ways to approach this challenge',
        'Come up with alternative designs for this feature',
      ],
      enabled: true,
      priority: 6,
      timeout: 120000, // 2 minutes for thorough ideation
      maxConcurrentSessions: 12,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(
      `[${this.config.id}] Activating brainstorming mode for session ${context.sessionId}`,
    );

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Brainstorming...',
      color: this.config.color,
      sessionId: context.sessionId,
      animation: 'typewriter',
    });

    this.emit('analytics:event', {
      type: 'mode_activation',
      mode: this.config.id,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      metadata: {
        previousMode: context.previousMode,
        ideationTarget: this.identifyIdeationTarget(context.input || ''),
      },
    });
  }

  protected async onDeactivate(sessionId: string): Promise<void> {
    console.log(`[${this.config.id}] Deactivating brainstorming mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing brainstorming request: "${input.substring(0, 50)}..."`,
    );

    // Multi-phase creative ideation process
    const ideationContext = await this.analyzeIdeationContext(input, context);
    const rawIdeas = await this.generateRawIdeas(input, ideationContext);
    const refinedIdeas = await this.refineAndCategorizeIdeas(rawIdeas, ideationContext);
    const evaluatedIdeas = await this.evaluateIdeas(refinedIdeas, ideationContext);

    const confidence = this.calculateCreativityConfidence(refinedIdeas, input);

    return {
      success: true,
      output: this.formatBrainstormingReport(ideationContext, evaluatedIdeas),
      suggestions: this.generateCreativeSuggestions(evaluatedIdeas, ideationContext),
      nextRecommendedMode: this.determineNextMode(evaluatedIdeas),
      confidence,
      metadata: {
        ideationContext,
        totalIdeas: rawIdeas.length,
        categorizedIdeas: refinedIdeas.length,
        topIdeas: evaluatedIdeas.slice(0, 5),
        creativityScore: this.calculateCreativityScore(refinedIdeas),
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0;

    const inputLower = input.toLowerCase();

    // Strong brainstorming indicators
    const strongIndicators = [
      'brainstorm',
      'ideas',
      'creative',
      'innovative',
      'think of',
      'come up with',
      'alternatives',
      'possibilities',
    ];

    const strongMatches = strongIndicators.filter((indicator) => inputLower.includes(indicator));
    if (strongMatches.length > 0) {
      confidence += Math.min(0.7, strongMatches.length * 0.25);
      reasoning.push(`Strong brainstorming indicators: ${strongMatches.join(', ')}`);
    }

    // Creative thinking keywords
    const creativeKeywords = [
      'design',
      'concept',
      'solution',
      'approach',
      'method',
      'way',
      'style',
      'strategy',
      'plan',
      'vision',
    ];

    const creativeMatches = creativeKeywords.filter((keyword) => inputLower.includes(keyword));
    if (creativeMatches.length > 0) {
      confidence += Math.min(0.3, creativeMatches.length * 0.1);
      reasoning.push(`Creative thinking keywords: ${creativeMatches.join(', ')}`);
    }

    // Question words that suggest ideation
    const questionWords = ['what', 'how', 'why', 'when', 'where'];
    const questionMatches = questionWords.filter((word) => inputLower.includes(word));
    if (questionMatches.length > 0 && inputLower.includes('could')) {
      confidence += 0.2;
      reasoning.push('Open-ended questions detected - good for brainstorming');
    }

    // Multiple options/alternatives mentioned
    if (
      inputLower.includes('different') ||
      inputLower.includes('various') ||
      inputLower.includes('multiple')
    ) {
      confidence += 0.15;
      reasoning.push('Request for multiple options detected');
    }

    // Problem-solving context
    if (
      inputLower.includes('problem') ||
      inputLower.includes('challenge') ||
      inputLower.includes('issue')
    ) {
      confidence += 0.1;
      reasoning.push('Problem-solving context - suitable for creative solutions');
    }

    // Innovation context
    if (
      inputLower.includes('new') ||
      inputLower.includes('novel') ||
      inputLower.includes('original')
    ) {
      confidence += 0.1;
      reasoning.push('Innovation context detected');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze the context for ideation
   */
  private async analyzeIdeationContext(input: string, context: ModeContext): Promise<unknown> {
    return {
      target: this.identifyIdeationTarget(input),
      domain: this.identifyDomain(input),
      constraints: this.identifyConstraints(input),
      objectives: this.extractObjectives(input),
      audience: this.identifyTargetAudience(input),
      creativity_level: this.assessRequiredCreativity(input),
      scope: this.determineScope(input),
      inspiration_sources: this.identifyInspirationSources(input),
    };
  }

  /**
   * Generate initial raw ideas
   */
  private async generateRawIdeas(input: string, context: unknown): Promise<unknown[]> {
    const ideas: unknown[] = [];

    // Use different ideation techniques
    const techniques = [
      'associative_thinking',
      'analogical_reasoning',
      'reverse_thinking',
      'scamper_method',
      'morphological_analysis',
      'random_stimulation',
    ];

    for (const technique of techniques) {
      const techniqueIdeas = await this.applyIdeationTechnique(technique, input, context);
      ideas.push(...techniqueIdeas);
    }

    return ideas;
  }

  /**
   * Apply specific ideation technique
   */
  private async applyIdeationTechnique(
    technique: string,
    input: string,
    context: unknown,
  ): Promise<unknown[]> {
    const ideas: unknown[] = [];

    switch (technique) {
      case 'associative_thinking':
        ideas.push(...this.generateAssociativeIdeas(input, context));
        break;

      case 'analogical_reasoning':
        ideas.push(...this.generateAnalogicalIdeas(input, context));
        break;

      case 'reverse_thinking':
        ideas.push(...this.generateReverseIdeas(input, context));
        break;

      case 'scamper_method':
        ideas.push(...this.generateScamperIdeas(input, context));
        break;

      case 'morphological_analysis':
        ideas.push(...this.generateMorphologicalIdeas(input, context));
        break;

      case 'random_stimulation':
        ideas.push(...this.generateRandomStimulationIdeas(input, context));
        break;
    }

    return ideas.map((idea) => ({
      ...idea,
      technique,
      generated_at: Date.now(),
    }));
  }

  /**
   * Generate ideas through associative thinking
   */
  private generateAssociativeIdeas(input: string, context: unknown): unknown[] {
    const ideas: unknown[] = [];
    const associations = this.getKeywordAssociations(input);

    associations.forEach((association) => {
      ideas.push({
        title: `${association}-inspired solution`,
        description: `Drawing inspiration from ${association} concepts`,
        type: 'associative',
        originality: Math.random() * 0.3 + 0.4,
        feasibility: Math.random() * 0.4 + 0.5,
      });
    });

    return ideas.slice(0, 3); // Limit per technique
  }

  /**
   * Generate ideas through analogical reasoning
   */
  private generateAnalogicalIdeas(input: string, context: unknown): unknown[] {
    const ideas: unknown[] = [];
    const analogies = this.getAnalogies(context.domain);

    analogies.forEach((analogy) => {
      ideas.push({
        title: `${analogy} approach`,
        description: `Applying principles from ${analogy} to solve this challenge`,
        type: 'analogical',
        originality: Math.random() * 0.4 + 0.5,
        feasibility: Math.random() * 0.3 + 0.4,
      });
    });

    return ideas.slice(0, 3);
  }

  /**
   * Generate ideas through reverse thinking
   */
  private generateReverseIdeas(input: string, context: unknown): unknown[] {
    const ideas: unknown[] = [];

    // Create opposite/reverse concepts
    ideas.push({
      title: 'Reverse approach solution',
      description: 'Instead of traditional approach, try doing the opposite',
      type: 'reverse',
      originality: Math.random() * 0.5 + 0.4,
      feasibility: Math.random() * 0.3 + 0.3,
    });

    ideas.push({
      title: 'Constraint elimination',
      description: 'Remove common constraints and see what becomes possible',
      type: 'reverse',
      originality: Math.random() * 0.4 + 0.5,
      feasibility: Math.random() * 0.2 + 0.4,
    });

    return ideas;
  }

  /**
   * Generate ideas using SCAMPER method
   */
  private generateScamperIdeas(input: string, context: unknown): unknown[] {
    const ideas: unknown[] = [];
    const scamperActions = [
      'Substitute',
      'Combine',
      'Adapt',
      'Modify',
      'Put to other uses',
      'Eliminate',
      'Reverse',
    ];

    scamperActions.forEach((action) => {
      ideas.push({
        title: `${action} solution`,
        description: `Apply ${action.toLowerCase()} technique to existing approaches`,
        type: 'scamper',
        scamper_action: action.toLowerCase(),
        originality: Math.random() * 0.4 + 0.4,
        feasibility: Math.random() * 0.4 + 0.5,
      });
    });

    return ideas.slice(0, 3);
  }

  /**
   * Generate ideas using morphological analysis
   */
  private generateMorphologicalIdeas(input: string, context: unknown): unknown[] {
    const ideas: unknown[] = [];

    // Create combinations of different parameters
    const parameters = this.identifyMorphologicalParameters(input, context);

    for (let i = 0; i < Math.min(3, parameters.length); i++) {
      ideas.push({
        title: `Parameter combination ${i + 1}`,
        description: `Combining different parameter values in novel ways`,
        type: 'morphological',
        parameters: parameters[i],
        originality: Math.random() * 0.3 + 0.6,
        feasibility: Math.random() * 0.5 + 0.4,
      });
    }

    return ideas;
  }

  /**
   * Generate ideas using random stimulation
   */
  private generateRandomStimulationIdeas(input: string, context: unknown): unknown[] {
    const ideas: unknown[] = [];
    const randomWords = ['butterfly', 'mountain', 'clock', 'ocean', 'library', 'garden'];

    randomWords.slice(0, 2).forEach((word) => {
      ideas.push({
        title: `${word}-inspired concept`,
        description: `Creative solution inspired by characteristics of ${word}`,
        type: 'random_stimulation',
        stimulus: word,
        originality: Math.random() * 0.6 + 0.3,
        feasibility: Math.random() * 0.3 + 0.3,
      });
    });

    return ideas;
  }

  /**
   * Refine and categorize generated ideas
   */
  private async refineAndCategorizeIdeas(
    rawIdeas: unknown[],
    context: unknown,
  ): Promise<unknown[]> {
    const refined = rawIdeas.map((idea) => ({
      ...idea,
      category: this.categorizeIdea(idea, context),
      refined_description: this.refineDescription(idea, context),
      potential_impact: this.estimateImpact(idea, context),
      implementation_effort: this.estimateEffort(idea, context),
    }));

    // Remove duplicates and very low-quality ideas
    return refined.filter(
      (idea, index, array) =>
        array.findIndex((other) => this.calculateSimilarity(idea, other) > 0.8) === index &&
        idea.originality > 0.3,
    );
  }

  /**
   * Evaluate and score ideas
   */
  private async evaluateIdeas(ideas: unknown[], context: unknown): Promise<unknown[]> {
    const evaluated = ideas.map((idea) => ({
      ...idea,
      overall_score: this.calculateOverallScore(idea),
      pros: this.identifyPros(idea, context),
      cons: this.identifycons(idea, context),
      next_steps: this.suggestNextSteps(idea, context),
    }));

    // Sort by overall score
    return evaluated.sort((a, b) => b.overall_score - a.overall_score);
  }

  /**
   * Format brainstorming report
   */
  private formatBrainstormingReport(context: unknown, evaluatedIdeas: unknown[]): string {
    const report = [
      '💡 BRAINSTORMING SESSION REPORT',
      '=================================',
      '',
      `Target: ${context.target}`,
      `Domain: ${context.domain}`,
      `Creativity Level: ${context.creativity_level}`,
      `Total Ideas Generated: ${evaluatedIdeas.length}`,
      '',
      '🏆 TOP IDEAS:',
      '',
    ];

    // Add top 5 ideas
    evaluatedIdeas.slice(0, 5).forEach((idea, index) => {
      report.push(`${index + 1}. ${idea.title}`);
      report.push(`   ${idea.refined_description}`);
      report.push(
        `   Originality: ${Math.round(idea.originality * 100)}% | Feasibility: ${Math.round(idea.feasibility * 100)}%`,
      );
      report.push(`   Score: ${Math.round(idea.overall_score * 100)}/100`);
      report.push('');
    });

    // Add categories summary
    const categories = [...new Set(evaluatedIdeas.map((idea) => idea.category))];
    report.push('📊 IDEAS BY CATEGORY:');
    categories.forEach((category) => {
      const count = evaluatedIdeas.filter((idea) => idea.category === category).length;
      report.push(`• ${category}: ${count} ideas`);
    });

    report.push('');
    report.push(
      '💭 Remember: The best ideas often come from combining and iterating on initial concepts!',
    );

    return report.join('\n');
  }

  /**
   * Generate creative suggestions
   */
  private generateCreativeSuggestions(ideas: unknown[], context: unknown): string[] {
    const suggestions: string[] = [];

    if (ideas.length > 0) {
      suggestions.push(`Explore the "${ideas[0].title}" concept further`);
    }

    suggestions.push('Try combining elements from different ideas');
    suggestions.push('Consider the reverse or opposite approach');
    suggestions.push('Look for inspiration from other domains or industries');

    if (context.creativity_level === 'high') {
      suggestions.push('Push boundaries - think beyond conventional solutions');
    }

    return suggestions.slice(0, 4);
  }

  // Helper methods

  private identifyIdeationTarget(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('app') || inputLower.includes('application')) {return 'mobile_app';}
    if (inputLower.includes('website') || inputLower.includes('web')) {return 'website';}
    if (inputLower.includes('product') || inputLower.includes('service')) {return 'product_service';}
    if (inputLower.includes('business') || inputLower.includes('company')) {return 'business';}
    if (inputLower.includes('process') || inputLower.includes('workflow')) {return 'process';}
    if (inputLower.includes('feature') || inputLower.includes('functionality')) {return 'feature';}

    return 'general';
  }

  private identifyDomain(input: string): string {
    const inputLower = input.toLowerCase();

    const domains = {
      technology: ['tech', 'software', 'app', 'digital', 'ai', 'machine learning'],
      business: ['business', 'marketing', 'sales', 'strategy', 'management'],
      design: ['design', 'ui', 'ux', 'interface', 'visual', 'aesthetic'],
      education: ['education', 'learning', 'teaching', 'course', 'training'],
      healthcare: ['health', 'medical', 'wellness', 'fitness', 'therapy'],
    };

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some((keyword) => inputLower.includes(keyword))) {
        return domain;
      }
    }

    return 'general';
  }

  private identifyConstraints(input: string): string[] {
    const constraints: string[] = [];
    const inputLower = input.toLowerCase();

    if (
      inputLower.includes('budget') ||
      inputLower.includes('cheap') ||
      inputLower.includes('cost')
    ) {
      constraints.push('budget');
    }

    if (
      inputLower.includes('time') ||
      inputLower.includes('quick') ||
      inputLower.includes('fast')
    ) {
      constraints.push('time');
    }

    if (inputLower.includes('simple') || inputLower.includes('easy')) {
      constraints.push('simplicity');
    }

    return constraints;
  }

  private extractObjectives(input: string): string[] {
    const objectives: string[] = [];
    const inputLower = input.toLowerCase();

    if (
      inputLower.includes('increase') ||
      inputLower.includes('improve') ||
      inputLower.includes('boost')
    ) {
      objectives.push('improvement');
    }

    if (
      inputLower.includes('reduce') ||
      inputLower.includes('decrease') ||
      inputLower.includes('minimize')
    ) {
      objectives.push('reduction');
    }

    if (
      inputLower.includes('solve') ||
      inputLower.includes('fix') ||
      inputLower.includes('address')
    ) {
      objectives.push('problem_solving');
    }

    return objectives;
  }

  private identifyTargetAudience(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('user') || inputLower.includes('customer')) {return 'users_customers';}
    if (inputLower.includes('student') || inputLower.includes('learner')) {return 'students';}
    if (inputLower.includes('business') || inputLower.includes('company')) {return 'businesses';}
    if (inputLower.includes('developer') || inputLower.includes('programmer')) {return 'developers';}

    return 'general';
  }

  private assessRequiredCreativity(input: string): string {
    const inputLower = input.toLowerCase();

    if (
      inputLower.includes('innovative') ||
      inputLower.includes('revolutionary') ||
      inputLower.includes('groundbreaking')
    ) {
      return 'high';
    }

    if (
      inputLower.includes('creative') ||
      inputLower.includes('unique') ||
      inputLower.includes('original')
    ) {
      return 'medium';
    }

    return 'low';
  }

  private determineScope(input: string): string {
    const wordCount = input.split(/\s+/).length;

    if (wordCount < 10) {return 'narrow';}
    if (wordCount < 25) {return 'medium';}
    return 'broad';
  }

  private identifyInspirationSources(input: string): string[] {
    return ['nature', 'technology', 'art', 'science', 'everyday_life'];
  }

  private getKeywordAssociations(input: string): string[] {
    // Simplified association logic
    const words = input.toLowerCase().split(/\s+/);
    return ['innovation', 'efficiency', 'simplicity', 'connection', 'growth'].slice(0, 3);
  }

  private getAnalogies(domain: string): string[] {
    const analogyMap: Record<string, string[]> = {
      technology: ['nature', 'music', 'architecture'],
      business: ['sports', 'military', 'gardening'],
      design: ['cooking', 'storytelling', 'dance'],
      general: ['nature', 'sports', 'cooking'],
    };

    return analogyMap[domain] || analogyMap['general'];
  }

  private identifyMorphologicalParameters(input: string, context: unknown): unknown[] {
    // Simplified parameter identification
    return [
      { approach: 'automated', scale: 'small', target: 'individuals' },
      { approach: 'manual', scale: 'medium', target: 'teams' },
      { approach: 'hybrid', scale: 'large', target: 'organizations' },
    ];
  }

  private categorizeIdea(idea: unknown, context: unknown): string {
    if (idea.type === 'reverse') {return 'disruptive';}
    if (idea.originality > 0.7) {return 'highly_original';}
    if (idea.feasibility > 0.7) {return 'practical';}
    return 'balanced';
  }

  private refineDescription(idea: unknown, context: unknown): string {
    return `${idea.description} - tailored for ${context.target} in ${context.domain} domain.`;
  }

  private estimateImpact(idea: unknown, context: unknown): string {
    if (idea.originality > 0.6 && idea.feasibility > 0.5) {return 'high';}
    if (idea.originality > 0.4 || idea.feasibility > 0.6) {return 'medium';}
    return 'low';
  }

  private estimateEffort(idea: unknown, context: unknown): string {
    if (idea.feasibility > 0.7) {return 'low';}
    if (idea.feasibility > 0.4) {return 'medium';}
    return 'high';
  }

  private calculateSimilarity(idea1: unknown, idea2: unknown): number {
    // Simplified similarity calculation
    if (idea1.title === idea2.title) {return 1.0;}
    if (idea1.type === idea2.type && idea1.category === idea2.category) {return 0.6;}
    return 0.1;
  }

  private calculateOverallScore(idea: unknown): number {
    return (
      idea.originality * 0.4 +
      idea.feasibility * 0.4 +
      (idea.potential_impact === 'high' ? 0.8 : idea.potential_impact === 'medium' ? 0.5 : 0.2) *
        0.2
    );
  }

  private identifyPros(idea: unknown, context: unknown): string[] {
    const pros: string[] = [];

    if (idea.originality > 0.6) {pros.push('Highly original approach');}
    if (idea.feasibility > 0.6) {pros.push('Feasible to implement');}
    if (idea.potential_impact === 'high') {pros.push('High potential impact');}

    return pros;
  }

  private identifycons(idea: unknown, context: unknown): string[] {
    const cons: string[] = [];

    if (idea.originality < 0.4) {cons.push('Limited originality');}
    if (idea.feasibility < 0.4) {cons.push('Implementation challenges');}
    if (idea.implementation_effort === 'high') {cons.push('High implementation effort');}

    return cons;
  }

  private suggestNextSteps(idea: unknown, context: unknown): string[] {
    const steps: string[] = [];

    steps.push('Develop a detailed concept proposal');
    steps.push('Identify potential challenges and solutions');
    steps.push('Create a prototype or proof of concept');

    return steps;
  }

  private calculateCreativityScore(ideas: unknown[]): number {
    if (ideas.length === 0) {return 0;}

    const avgOriginality = ideas.reduce((sum, idea) => sum + idea.originality, 0) / ideas.length;
    const diversityBonus = Math.min(ideas.length / 10, 0.3);

    return Math.min(avgOriginality + diversityBonus, 1.0);
  }

  private calculateCreativityConfidence(ideas: unknown[], input: string): number {
    let confidence = 0.6; // Base confidence

    // More ideas = higher confidence
    confidence += Math.min(0.3, ideas.length * 0.03);

    // Creative keywords boost confidence
    const creativeKeywords = ['creative', 'innovative', 'original', 'unique'];
    const inputLower = input.toLowerCase();
    const matches = creativeKeywords.filter((keyword) => inputLower.includes(keyword)).length;
    confidence += matches * 0.05;

    return Math.min(confidence, 0.9);
  }

  private determineNextMode(ideas: unknown[]): string | undefined {
    // Check if ideas need further development
    const highOriginalityIdeas = ideas.filter((idea) => idea.originality > 0.7);

    if (highOriginalityIdeas.length > 2) {
      return 'designing'; // Move to design/prototyping
    }

    // If many practical ideas, might need evaluation
    const practicalIdeas = ideas.filter((idea) => idea.feasibility > 0.7);
    if (practicalIdeas.length > 3) {
      return 'analyzing'; // Move to analysis mode
    }

    return undefined;
  }
}
