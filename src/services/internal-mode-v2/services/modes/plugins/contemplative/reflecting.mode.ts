/**
 * Reflecting Mode Plugin - Deep reflection and introspection mode
 * Specialized for thoughtful analysis, learning extraction, and wisdom development
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class ReflectingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'reflecting',
      name: 'Reflecting',
      category: 'contemplative',
      symbol: '🤔',
      color: 'blue',
      description: '内省・熟考モード - 深い反省と洞察の獲得',
      keywords: [
        'reflect',
        'think deeply',
        'contemplate',
        'ponder',
        'consider',
        'introspect',
        'meditate',
        'examine',
        'evaluate',
        'review',
      ],
      triggers: [
        'reflect on',
        'think about',
        'contemplate',
        'look back',
        'what can we learn',
        'lessons learned',
        'deep dive',
        'introspect',
      ],
      examples: [
        'Reflect on the project outcomes and lessons learned',
        'Think deeply about the implications of this decision',
        'Contemplate the long-term consequences',
        'What insights can we gain from this experience?',
        'Let me reflect on the deeper meaning here',
      ],
      enabled: true,
      priority: 3,
      timeout: 90000, // 1.5 minutes for deep reflection
      maxConcurrentSessions: 8,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating reflecting mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Reflecting...',
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
    console.log(`[${this.config.id}] Deactivating reflecting mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing reflection request: "${input.substring(0, 50)}..."`,
    );

    // Reflection process pipeline
    const subjectAnalysis = await this.analyzeReflectionSubject(input, context);
    const perspectives = await this.gatherMultiplePerspectives(input, subjectAnalysis);
    const deepAnalysis = await this.conductDeepAnalysis(input, perspectives);
    const insights = await this.extractInsights(input, deepAnalysis);
    const wisdom = await this.distillWisdom(input, insights);
    const implications = await this.exploreImplications(input, wisdom);

    const suggestions = await this.generateReflectionSuggestions(input, wisdom);
    const nextMode = await this.determineNextMode(input, implications);

    return {
      success: true,
      output: this.formatReflectionResults(subjectAnalysis, insights, wisdom, implications),
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.86,
      metadata: {
        subjectType: subjectAnalysis.type,
        perspectiveCount: perspectives.length,
        insightDepth: insights.depth,
        wisdomCategory: wisdom.category,
        implicationScope: implications.scope,
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

    // Direct reflection keywords
    const reflectionKeywords = [
      'reflect',
      'think deeply',
      'contemplate',
      'ponder',
      'consider',
      'introspect',
      'meditate',
      'examine',
      'evaluate',
    ];

    const reflectionMatches = reflectionKeywords.filter((keyword) => inputLower.includes(keyword));
    if (reflectionMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Reflection keywords: ${reflectionMatches.join(', ')}`);
    }

    // Learning and insight phrases
    const learningPhrases = [
      'lessons learned',
      'what can we learn',
      'insights',
      'takeaways',
      'meaning',
      'significance',
      'deeper understanding',
      'wisdom',
    ];

    const learningMatches = learningPhrases.filter((phrase) => inputLower.includes(phrase));
    if (learningMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(`Learning/insight phrases: ${learningMatches.length} found`);
    }

    // Retrospective indicators
    const retrospectiveIndicators = [
      'look back',
      'in hindsight',
      'looking at',
      'reviewing',
      'after',
      'post',
      'outcome',
      'result',
      'experience',
    ];

    const retroMatches = retrospectiveIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    );
    if (retroMatches.length > 0) {
      confidence += 0.25;
      reasoning.push(`Retrospective indicators: ${retroMatches.join(', ')}`);
    }

    // Philosophical and deep thinking indicators
    const philosophicalTerms = [
      'why',
      'purpose',
      'meaning',
      'deeper',
      'underlying',
      'fundamental',
      'essence',
      'core',
      'nature',
      'philosophy',
      'principle',
    ];

    const philMatches = philosophicalTerms.filter((term) => inputLower.includes(term));
    if (philMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Philosophical thinking indicators: ${philMatches.join(', ')}`);
    }

    // Evaluative questions
    const evaluativePatterns = [
      /what.*mean/i,
      /why.*happen/i,
      /how.*feel/i,
      /what.*learn/i,
      /significance.*of/i,
      /impact.*of/i,
      /value.*of/i,
    ];

    const evalMatches = evaluativePatterns.filter((pattern) => pattern.test(input));
    if (evalMatches.length > 0) {
      confidence += 0.15;
      reasoning.push('Evaluative questions suggest reflection need');
    }

    // Temporal context suggesting reflection
    const temporalIndicators = ['after', 'since', 'following', 'post', 'now that'];
    const temporalMatches = temporalIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    );
    if (temporalMatches.length > 0) {
      confidence += 0.1;
      reasoning.push('Temporal context suggests reflective analysis');
    }

    // Context-based reflection triggers
    if (
      context.previousMode &&
      ['implementing', 'debugging', 'optimizing'].includes(context.previousMode)
    ) {
      confidence += 0.15;
      reasoning.push('Good context for reflection after action-oriented mode');
    }

    // Complexity suggests value of reflection
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 30) {
      confidence += 0.1;
      reasoning.push('Complex input benefits from reflective analysis');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze what is being reflected upon
   */
  private async analyzeReflectionSubject(input: string, context: ModeContext): Promise<unknown> {
    const analysis = {
      type: this.classifyReflectionType(input),
      scope: this.determineReflectionScope(input),
      timeframe: this.identifyTimeframe(input),
      stakeholders: this.identifyReflectionStakeholders(input),
      domain: this.identifyReflectionDomain(input),
      complexity: this.assessSubjectComplexity(input),
      emotional_weight: this.assessEmotionalWeight(input),
    };

    return analysis;
  }

  /**
   * Gather multiple perspectives on the subject
   */
  private async gatherMultiplePerspectives(input: string, subject: unknown): Promise<unknown[]> {
    const perspectives: unknown[] = [];

    // Analytical perspective
    perspectives.push({
      type: 'analytical',
      viewpoint: 'Objective analysis of facts and data',
      focus: 'What happened and why',
      insights: this.generateAnalyticalInsights(input),
    });

    // Emotional perspective
    perspectives.push({
      type: 'emotional',
      viewpoint: 'Human impact and feelings',
      focus: 'How people were affected',
      insights: this.generateEmotionalInsights(input),
    });

    // Strategic perspective
    perspectives.push({
      type: 'strategic',
      viewpoint: 'Long-term implications and opportunities',
      focus: 'Future direction and planning',
      insights: this.generateStrategicInsights(input),
    });

    // Ethical perspective
    perspectives.push({
      type: 'ethical',
      viewpoint: 'Values and principles involved',
      focus: 'Right and wrong, fairness',
      insights: this.generateEthicalInsights(input),
    });

    // Learning perspective
    perspectives.push({
      type: 'learning',
      viewpoint: 'Knowledge and skill development',
      focus: 'What was learned and how to improve',
      insights: this.generateLearningInsights(input),
    });

    return perspectives;
  }

  /**
   * Conduct deep analysis across perspectives
   */
  private async conductDeepAnalysis(input: string, perspectives: unknown[]): Promise<unknown> {
    const analysis = {
      patterns: this.identifyPatterns(perspectives),
      tensions: this.identifyTensions(perspectives),
      convergences: this.identifyConvergences(perspectives),
      gaps: this.identifyGaps(perspectives),
      surprises: this.identifySurprises(perspectives),
      confirmations: this.identifyConfirmations(perspectives),
    };

    return analysis;
  }

  /**
   * Extract meaningful insights
   */
  private async extractInsights(input: string, analysis: unknown): Promise<unknown> {
    const insights = {
      depth: this.assessInsightDepth(analysis),
      categories: this.categorizeInsights(analysis),
      novel: this.identifyNovelInsights(analysis),
      actionable: this.identifyActionableInsights(analysis),
      meta: this.identifyMetaInsights(analysis),
      universal: this.identifyUniversalInsights(analysis),
    };

    return insights;
  }

  /**
   * Distill wisdom from insights
   */
  private async distillWisdom(input: string, insights: unknown): Promise<unknown> {
    const wisdom = {
      category: this.categorizeWisdom(insights),
      principles: this.extractPrinciples(insights),
      heuristics: this.developHeuristics(insights),
      frameworks: this.createFrameworks(insights),
      questions: this.formulateWisdomQuestions(insights),
      paradoxes: this.identifyParadoxes(insights),
    };

    return wisdom;
  }

  /**
   * Explore implications of the reflection
   */
  private async exploreImplications(input: string, wisdom: unknown): Promise<unknown> {
    const implications = {
      scope: this.determineImplicationScope(wisdom),
      immediate: this.identifyImmediateImplications(wisdom),
      long_term: this.identifyLongTermImplications(wisdom),
      personal: this.identifyPersonalImplications(wisdom),
      professional: this.identifyProfessionalImplications(wisdom),
      societal: this.identifysocietalImplications(wisdom),
    };

    return implications;
  }

  /**
   * Format reflection results
   */
  private formatReflectionResults(
    subject: unknown,
    insights: unknown,
    wisdom: unknown,
    implications: unknown,
  ): string {
    const output: string[] = [];

    output.push('Reflection Analysis');
    output.push('='.repeat(19));
    output.push('');

    output.push('Subject Overview:');
    output.push(`Type: ${subject.type}`);
    output.push(`Scope: ${subject.scope}`);
    output.push(`Domain: ${subject.domain}`);
    output.push('');

    output.push('Key Insights:');
    if (insights.actionable && insights.actionable.length > 0) {
      insights.actionable.slice(0, 3).forEach((insight: string, index: number) => {
        output.push(`${index + 1}. ${insight}`);
      });
    } else {
      output.push('• Deeper understanding of the situation');
      output.push('• Recognition of patterns and relationships');
      output.push('• Awareness of multiple perspectives');
    }
    output.push('');

    output.push('Wisdom Extracted:');
    output.push(`Category: ${wisdom.category}`);
    output.push('Core Principles:');
    wisdom.principles.slice(0, 3).forEach((principle: string) => {
      output.push(`• ${principle}`);
    });
    output.push('');

    output.push('Key Questions for Further Reflection:');
    wisdom.questions.slice(0, 3).forEach((question: string) => {
      output.push(`• ${question}`);
    });
    output.push('');

    output.push('Implications:');
    output.push(`Scope: ${implications.scope}`);
    output.push('Immediate considerations:');
    implications.immediate.slice(0, 2).forEach((implication: string) => {
      output.push(`• ${implication}`);
    });

    return output.join('\n');
  }

  /**
   * Generate reflection-specific suggestions
   */
  private async generateReflectionSuggestions(input: string, wisdom: unknown): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Document key insights for future reference');
    suggestions.push('Share learnings with relevant stakeholders');

    if (wisdom.category === 'personal_growth') {
      suggestions.push('Consider how insights apply to future situations');
    }

    if (wisdom.category === 'process_improvement') {
      suggestions.push('Develop action plan based on learnings');
    }

    suggestions.push('Schedule regular reflection sessions');

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(
    input: string,
    implications: unknown,
  ): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (implications.scope === 'actionable') {
      return 'planning';
    }

    if (inputLower.includes('share') || inputLower.includes('communicate')) {
      return 'summarizing';
    }

    if (inputLower.includes('apply') || inputLower.includes('implement')) {
      return 'adapting';
    }

    if (implications.long_term.length > 0) {
      return 'thinking';
    }

    return undefined;
  }

  // Helper methods
  private classifyReflectionType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('project') || inputLower.includes('outcome'))
      {return 'project_reflection';}
    if (inputLower.includes('decision') || inputLower.includes('choice'))
      {return 'decision_reflection';}
    if (inputLower.includes('experience') || inputLower.includes('journey'))
      {return 'experience_reflection';}
    if (inputLower.includes('relationship') || inputLower.includes('interaction'))
      {return 'relationship_reflection';}
    if (inputLower.includes('learning') || inputLower.includes('growth'))
      {return 'learning_reflection';}

    return 'general_reflection';
  }

  private determineReflectionScope(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('team') || inputLower.includes('organization')) {return 'collective';}
    if (inputLower.includes('personal') || inputLower.includes('individual')) {return 'personal';}
    if (inputLower.includes('system') || inputLower.includes('process')) {return 'systemic';}

    return 'contextual';
  }

  private identifyTimeframe(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('recent') || inputLower.includes('just')) {return 'recent';}
    if (inputLower.includes('past year') || inputLower.includes('months')) {return 'medium_term';}
    if (inputLower.includes('career') || inputLower.includes('life')) {return 'long_term';}

    return 'unspecified';
  }

  private identifyReflectionStakeholders(input: string): string[] {
    const stakeholders: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('team')) {stakeholders.push('team members');}
    if (inputLower.includes('customer')) {stakeholders.push('customers');}
    if (inputLower.includes('management')) {stakeholders.push('management');}
    if (inputLower.includes('user')) {stakeholders.push('users');}

    return stakeholders;
  }

  private identifyReflectionDomain(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('technical') || inputLower.includes('code')) {return 'technical';}
    if (inputLower.includes('business') || inputLower.includes('strategy')) {return 'business';}
    if (inputLower.includes('personal') || inputLower.includes('career')) {return 'personal';}
    if (inputLower.includes('relationship') || inputLower.includes('social'))
      {return 'interpersonal';}

    return 'general';
  }

  private assessSubjectComplexity(input: string): string {
    const wordCount = input.split(/\s+/).length;
    const conceptCount = this.countConcepts(input);

    if (wordCount > 100 || conceptCount > 5) {return 'high';}
    if (wordCount > 50 || conceptCount > 3) {return 'medium';}
    return 'low';
  }

  private assessEmotionalWeight(input: string): string {
    const emotionalTerms = [
      'difficult',
      'challenging',
      'successful',
      'failed',
      'disappointed',
      'excited',
    ];
    const inputLower = input.toLowerCase();

    const emotionalCount = emotionalTerms.filter((term) => inputLower.includes(term)).length;

    if (emotionalCount > 2) {return 'high';}
    if (emotionalCount > 0) {return 'medium';}
    return 'low';
  }

  private generateAnalyticalInsights(input: string): string[] {
    return [
      'Objective analysis reveals key patterns',
      'Data-driven insights support conclusions',
      'Logical cause-and-effect relationships identified',
    ];
  }

  private generateEmotionalInsights(input: string): string[] {
    return [
      'Human impact considerations are significant',
      'Emotional responses provide valuable feedback',
      'Relationship dynamics influence outcomes',
    ];
  }

  private generateStrategicInsights(input: string): string[] {
    return [
      'Long-term implications need consideration',
      'Strategic opportunities may be available',
      'Future planning should incorporate learnings',
    ];
  }

  private generateEthicalInsights(input: string): string[] {
    return [
      'Ethical considerations frame the analysis',
      'Values alignment is important for sustainability',
      'Fairness and justice perspectives matter',
    ];
  }

  private generateLearningInsights(input: string): string[] {
    return [
      'Significant learning opportunities identified',
      'Knowledge gaps reveal development needs',
      'Skill building areas become apparent',
    ];
  }

  private identifyPatterns(perspectives: unknown[]): string[] {
    return [
      'Consistent themes across multiple perspectives',
      'Recurring challenges and opportunities',
      'Predictable response patterns',
    ];
  }

  private identifyTensions(perspectives: unknown[]): string[] {
    return [
      'Competing priorities create tension',
      'Different stakeholder needs conflict',
      'Short-term vs long-term trade-offs',
    ];
  }

  private identifyConvergences(perspectives: unknown[]): string[] {
    return [
      'Common ground found across viewpoints',
      'Shared values and objectives',
      'Mutual understanding opportunities',
    ];
  }

  private identifyGaps(perspectives: unknown[]): string[] {
    return [
      'Missing stakeholder perspectives',
      'Unexplored aspects of the situation',
      'Information or insight deficits',
    ];
  }

  private identifySurprises(perspectives: unknown[]): string[] {
    return [
      'Unexpected outcomes or reactions',
      'Surprising connections or patterns',
      'Unanticipated consequences',
    ];
  }

  private identifyConfirmations(perspectives: unknown[]): string[] {
    return [
      'Expected outcomes materialized',
      'Assumptions proved correct',
      'Planned strategies worked as intended',
    ];
  }

  private assessInsightDepth(analysis: unknown): string {
    return 'deep'; // Simplified for this implementation
  }

  private categorizeInsights(analysis: unknown): string[] {
    return ['process insights', 'relationship insights', 'strategic insights'];
  }

  private identifyNovelInsights(analysis: unknown): string[] {
    return ['New understanding of system dynamics', 'Innovative approach possibilities'];
  }

  private identifyActionableInsights(analysis: unknown): string[] {
    return [
      'Process improvements can be implemented immediately',
      'Communication strategies need refinement',
      'Resource allocation requires adjustment',
    ];
  }

  private identifyMetaInsights(analysis: unknown): string[] {
    return ['Insights about the process of gaining insights', 'Learning about learning'];
  }

  private identifyUniversalInsights(analysis: unknown): string[] {
    return ['Principles applicable across contexts', 'Timeless wisdom elements'];
  }

  private categorizeWisdom(insights: unknown): string {
    if (insights.categories.includes('process insights')) {return 'process_improvement';}
    if (insights.categories.includes('relationship insights')) {return 'interpersonal_wisdom';}
    if (insights.categories.includes('strategic insights')) {return 'strategic_wisdom';}
    return 'personal_growth';
  }

  private extractPrinciples(insights: unknown): string[] {
    return [
      'Balance analysis with intuition',
      'Consider multiple perspectives before concluding',
      'Learning requires honest self-examination',
    ];
  }

  private developHeuristics(insights: unknown): string[] {
    return [
      'When in doubt, gather more perspectives',
      'Trust patterns that appear consistently',
      'Question assumptions regularly',
    ];
  }

  private createFrameworks(insights: unknown): string[] {
    return [
      'Multi-perspective analysis framework',
      'Continuous reflection methodology',
      'Wisdom distillation process',
    ];
  }

  private formulateWisdomQuestions(insights: unknown): string[] {
    return [
      'What would I do differently knowing what I know now?',
      'How can these insights be applied to future situations?',
      "What questions should I be asking that I'm not asking?",
    ];
  }

  private identifyParadoxes(insights: unknown): string[] {
    return [
      'Success and failure often contain elements of each other',
      "The more we know, the more we realize we don't know",
    ];
  }

  private determineImplicationScope(wisdom: unknown): string {
    return wisdom.principles.length > 2 ? 'broad' : 'focused';
  }

  private identifyImmediateImplications(wisdom: unknown): string[] {
    return [
      'Adjust current approaches based on insights',
      'Share learnings with relevant stakeholders',
    ];
  }

  private identifyLongTermImplications(wisdom: unknown): string[] {
    return [
      'Develop systematic reflection practices',
      'Build wisdom-based decision making capabilities',
    ];
  }

  private identifyPersonalImplications(wisdom: unknown): string[] {
    return [
      'Personal growth and development opportunities',
      'Enhanced self-awareness and insight capabilities',
    ];
  }

  private identifyProfessionalImplications(wisdom: unknown): string[] {
    return [
      'Improved professional practices and outcomes',
      'Enhanced leadership and collaboration skills',
    ];
  }

  private identifysocietalImplications(wisdom: unknown): string[] {
    return [
      'Broader applications for community benefit',
      'Contribution to collective wisdom and knowledge',
    ];
  }

  private countConcepts(input: string): number {
    // Simplified concept counting
    const conceptWords = input.split(/\s+/).filter((word) => word.length > 6);
    return Math.min(conceptWords.length, 10);
  }
}
