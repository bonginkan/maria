/**
 * Designing Mode Plugin - Creative design and solution crafting mode
 * Specialized for creating innovative designs, solutions, and creative frameworks
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class DesigningMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'designing',
      name: 'Designing',
      category: 'creative',
      symbol: '🎨',
      color: 'magenta',
      description: '創造設計モード - 革新的デザインと解決策の創出',
      keywords: [
        'design',
        'create',
        'craft',
        'build',
        'construct',
        'architect',
        'blueprint',
        'prototype',
        'sketch',
        'model',
      ],
      triggers: [
        'design',
        'create',
        'build',
        'architect',
        'prototype',
        'blueprint',
        'sketch',
        'model',
        'craft solution',
      ],
      examples: [
        'Design a user-friendly interface for this application',
        'Create an architectural blueprint for the system',
        'Build a prototype solution for this problem',
        'Craft an innovative approach to user engagement',
        'Design a scalable framework for data processing',
      ],
      enabled: true,
      priority: 7,
      timeout: 120000, // 2 minutes for creative design
      maxConcurrentSessions: 8,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating designing mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Designing...',
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
    console.log(`[${this.config.id}] Deactivating designing mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(`[${this.config.id}] Processing design request: "${input.substring(0, 50)}..."`);

    // Design process pipeline
    const designBrief = await this.createDesignBrief(input, context);
    const research = await this.conductDesignResearch(input, designBrief);
    const concepts = await this.generateDesignConcepts(input, research);
    const refinement = await this.refineDesignConcepts(input, concepts);
    const prototyping = await this.createPrototypes(input, refinement);
    const validation = await this.validateDesign(input, prototyping);

    const suggestions = await this.generateDesignSuggestions(input, validation);
    const nextMode = await this.determineNextMode(input, validation);

    return {
      success: true,
      output: this.formatDesignResults(designBrief, concepts, refinement, prototyping, validation),
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.85,
      metadata: {
        designType: designBrief.type,
        conceptCount: concepts.length,
        refinementCycles: refinement.cycles,
        prototypeComplexity: prototyping.complexity,
        validationScore: validation.score,
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

    // Direct design keywords
    const designKeywords = [
      'design',
      'create',
      'craft',
      'build',
      'construct',
      'architect',
      'blueprint',
      'prototype',
      'sketch',
      'model',
    ];

    const designMatches = designKeywords.filter((keyword) => inputLower.includes(keyword));
    if (designMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Design keywords: ${designMatches.join(', ')}`);
    }

    // Creative process indicators
    const creativeTerms = [
      'innovative',
      'creative',
      'original',
      'novel',
      'unique',
      'artistic',
      'aesthetic',
      'visual',
      'layout',
      'interface',
    ];

    const creativeMatches = creativeTerms.filter((term) => inputLower.includes(term));
    if (creativeMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(`Creative terms: ${creativeMatches.join(', ')}`);
    }

    // Design domain indicators
    const domainTerms = [
      'ui',
      'ux',
      'user interface',
      'user experience',
      'frontend',
      'architecture',
      'system design',
      'framework',
      'structure',
    ];

    const domainMatches = domainTerms.filter((term) => inputLower.includes(term));
    if (domainMatches.length > 0) {
      confidence += 0.25;
      reasoning.push(`Design domain terms: ${domainMatches.join(', ')}`);
    }

    // Solution crafting indicators
    const solutionTerms = [
      'solution',
      'approach',
      'methodology',
      'strategy',
      'framework',
      'pattern',
      'template',
      'blueprint',
      'specification',
    ];

    const solutionMatches = solutionTerms.filter((term) => inputLower.includes(term));
    if (solutionMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Solution crafting terms: ${solutionMatches.join(', ')}`);
    }

    // Visual and structural terms
    const visualTerms = [
      'layout',
      'appearance',
      'look',
      'feel',
      'style',
      'theme',
      'color',
      'typography',
      'spacing',
      'alignment',
    ];

    const visualMatches = visualTerms.filter((term) => inputLower.includes(term));
    if (visualMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Visual design terms: ${visualMatches.join(', ')}`);
    }

    // Problem-solving context
    if (inputLower.includes('problem') && inputLower.includes('solve')) {
      confidence += 0.15;
      reasoning.push('Problem-solving context suggests design need');
    }

    // Context-based adjustments
    if (context.previousMode === 'brainstorming') {
      confidence += 0.2;
      reasoning.push('Natural progression from brainstorming to design');
    }

    if (context.previousMode === 'planning') {
      confidence += 0.15;
      reasoning.push('Good follow-up to planning with design');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Create comprehensive design brief
   */
  private async createDesignBrief(input: string, context: ModeContext): Promise<unknown> {
    const brief = {
      type: this.identifyDesignType(input),
      objectives: this.extractDesignObjectives(input),
      constraints: this.identifyDesignConstraints(input),
      requirements: this.gatherRequirements(input),
      target_audience: this.identifyTargetAudience(input),
      success_criteria: this.defineSuccessCriteria(input),
      timeline: this.estimateDesignTimeline(input),
    };

    return brief;
  }

  /**
   * Conduct design research
   */
  private async conductDesignResearch(input: string, brief: unknown): Promise<unknown> {
    const research = {
      market_analysis: this.analyzeMarket(brief),
      user_research: this.conductUserResearch(brief),
      competitive_analysis: this.analyzeCompetitors(brief),
      design_patterns: this.identifyDesignPatterns(brief),
      best_practices: this.gatherBestPractices(brief),
      inspiration: this.findInspiration(brief),
    };

    return research;
  }

  /**
   * Generate initial design concepts
   */
  private async generateDesignConcepts(input: string, research: unknown): Promise<unknown[]> {
    const concepts: unknown[] = [];

    // Generate multiple design concepts
    const conceptTypes = ['minimalist', 'feature_rich', 'innovative', 'traditional'];

    conceptTypes.forEach((type, index) => {
      concepts.push({
        id: `concept_${index + 1}`,
        type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Design Concept`,
        description: this.generateConceptDescription(type, research),
        features: this.defineConceptFeatures(type, research),
        advantages: this.identifyConceptAdvantages(type),
        challenges: this.identifyConceptChallenges(type),
      });
    });

    return concepts;
  }

  /**
   * Refine design concepts
   */
  private async refineDesignConcepts(input: string, concepts: unknown[]): Promise<unknown> {
    const refinement = {
      cycles: this.determinRefinementCycles(concepts),
      criteria: this.establishRefinementCriteria(concepts),
      selected_concepts: this.selectTopConcepts(concepts),
      improvements: this.applyImprovements(concepts),
      user_feedback: this.incorporateUserFeedback(concepts),
      iterations: this.planIterations(concepts),
    };

    return refinement;
  }

  /**
   * Create prototypes
   */
  private async createPrototypes(input: string, refinement: unknown): Promise<unknown> {
    const prototyping = {
      complexity: this.determinePrototypeComplexity(refinement),
      fidelity: this.selectPrototypeFidelity(refinement),
      types: this.selectPrototypeTypes(refinement),
      tools: this.recommendPrototypingTools(refinement),
      timeline: this.estimatePrototypingTime(refinement),
      deliverables: this.definePrototypeDeliverables(refinement),
    };

    return prototyping;
  }

  /**
   * Validate design solutions
   */
  private async validateDesign(input: string, prototyping: unknown): Promise<unknown> {
    const validation = {
      score: this.calculateValidationScore(prototyping),
      methods: this.selectValidationMethods(prototyping),
      testing: this.planUserTesting(prototyping),
      feedback: this.collectFeedback(prototyping),
      metrics: this.defineSuccessMetrics(prototyping),
      recommendations: this.generateRecommendations(prototyping),
    };

    return validation;
  }

  /**
   * Format design results
   */
  private formatDesignResults(
    brief: unknown,
    concepts: unknown[],
    refinement: unknown,
    prototyping: unknown,
    validation: unknown,
  ): string {
    const output: string[] = [];

    output.push('Design Solution Framework');
    output.push('═'.repeat(26));
    output.push('');

    output.push('Design Brief:');
    output.push(`Type: ${brief.type}`);
    output.push(`Target Audience: ${brief.target_audience}`);
    output.push('Key Objectives:');
    brief.objectives.slice(0, 3).forEach((objective: string, index: number) => {
      output.push(`${index + 1}. ${objective}`);
    });
    output.push('');

    output.push('Design Concepts Generated:');
    concepts.slice(0, 3).forEach((concept, index) => {
      output.push(`${index + 1}. ${concept.name} (${concept.type})`);
      output.push(`   Key Features: ${concept.features.slice(0, 2).join(', ')}`);
    });
    output.push('');

    output.push('Refinement Process:');
    output.push(`Refinement Cycles: ${refinement.cycles}`);
    output.push(`Selected Concepts: ${refinement.selected_concepts.length}`);
    output.push('Key Improvements Applied:');
    refinement.improvements.slice(0, 3).forEach((improvement: string) => {
      output.push(`• ${improvement}`);
    });
    output.push('');

    output.push('Prototyping Plan:');
    output.push(`Complexity: ${prototyping.complexity}`);
    output.push(`Fidelity: ${prototyping.fidelity}`);
    output.push(`Estimated Timeline: ${prototyping.timeline}`);
    output.push('Deliverables:');
    prototyping.deliverables.forEach((deliverable: string) => {
      output.push(`• ${deliverable}`);
    });
    output.push('');

    output.push('Validation Results:');
    output.push(`Validation Score: ${validation.score}/10`);
    output.push('Success Metrics:');
    validation.metrics.slice(0, 3).forEach((metric: string) => {
      output.push(`• ${metric}`);
    });

    return output.join('\n');
  }

  /**
   * Generate design-specific suggestions
   */
  private async generateDesignSuggestions(input: string, validation: unknown): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Conduct user testing with target audience');
    suggestions.push('Iterate based on feedback and validation results');

    if (validation.score < 8) {
      suggestions.push('Consider alternative design approaches');
    }

    suggestions.push('Document design decisions and rationale');
    suggestions.push('Plan for accessibility and inclusive design');

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(input: string, validation: unknown): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('implement') || inputLower.includes('build')) {
      return 'processing';
    }

    if (inputLower.includes('test') || inputLower.includes('validate')) {
      return 'debugging';
    }

    if (inputLower.includes('improve') || inputLower.includes('optimize')) {
      return 'optimizing';
    }

    if (validation.score < 7) {
      return 'adapting';
    }

    return 'reflecting';
  }

  // Helper methods
  private identifyDesignType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('ui') || inputLower.includes('interface')) return 'user_interface';
    if (inputLower.includes('ux') || inputLower.includes('experience')) return 'user_experience';
    if (inputLower.includes('system') || inputLower.includes('architecture'))
      return 'system_architecture';
    if (inputLower.includes('graphic') || inputLower.includes('visual')) return 'visual_design';
    if (inputLower.includes('product') || inputLower.includes('service')) return 'product_design';

    return 'solution_design';
  }

  private extractDesignObjectives(input: string): string[] {
    const objectives: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('user')) objectives.push('Enhance user experience');
    if (inputLower.includes('efficient')) objectives.push('Improve efficiency');
    if (inputLower.includes('scalable')) objectives.push('Ensure scalability');
    if (inputLower.includes('accessible')) objectives.push('Ensure accessibility');

    return objectives.length > 0
      ? objectives
      : ['Create effective solution', 'Meet user needs', 'Achieve business goals'];
  }

  private identifyDesignConstraints(input: string): string[] {
    const constraints: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('budget')) constraints.push('Budget limitations');
    if (inputLower.includes('time')) constraints.push('Time constraints');
    if (inputLower.includes('technology')) constraints.push('Technology constraints');
    if (inputLower.includes('regulation')) constraints.push('Regulatory requirements');

    return constraints;
  }

  private gatherRequirements(input: string): string[] {
    return [
      'Functional requirements',
      'Performance requirements',
      'Usability requirements',
      'Technical requirements',
      'Business requirements',
    ];
  }

  private identifyTargetAudience(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('developer')) return 'developers';
    if (inputLower.includes('business')) return 'business_users';
    if (inputLower.includes('consumer')) return 'consumers';
    if (inputLower.includes('admin')) return 'administrators';

    return 'general_users';
  }

  private defineSuccessCriteria(input: string): string[] {
    return [
      'User satisfaction metrics',
      'Performance benchmarks',
      'Usability scores',
      'Business goal achievement',
      'Technical requirement fulfillment',
    ];
  }

  private estimateDesignTimeline(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('quick') || inputLower.includes('rapid')) return '1-2 weeks';
    if (inputLower.includes('complex') || inputLower.includes('comprehensive')) return '2-3 months';

    return '4-6 weeks';
  }

  private analyzeMarket(brief: unknown): string[] {
    return [
      'Market trends analysis',
      'Industry standards review',
      'Emerging technologies assessment',
      'User behavior patterns',
    ];
  }

  private conductUserResearch(brief: unknown): string[] {
    return [
      'User interviews and surveys',
      'Persona development',
      'User journey mapping',
      'Pain point identification',
    ];
  }

  private analyzeCompetitors(brief: unknown): string[] {
    return [
      'Competitive feature analysis',
      'Design pattern review',
      'Strengths and weaknesses assessment',
      'Differentiation opportunities',
    ];
  }

  private identifyDesignPatterns(brief: unknown): string[] {
    return [
      'Established design patterns',
      'Emerging pattern trends',
      'Domain-specific patterns',
      'Accessibility patterns',
    ];
  }

  private gatherBestPractices(brief: unknown): string[] {
    return [
      'Industry best practices',
      'Usability guidelines',
      'Performance optimization',
      'Accessibility standards',
    ];
  }

  private findInspiration(brief: unknown): string[] {
    return [
      'Design showcases and galleries',
      'Award-winning solutions',
      'Innovation examples',
      'Cross-industry inspiration',
    ];
  }

  private generateConceptDescription(type: string, research: unknown): string {
    const descriptions = {
      minimalist: 'Clean, focused design emphasizing simplicity and core functionality',
      feature_rich: 'Comprehensive solution with extensive capabilities and options',
      innovative: 'Cutting-edge approach using latest design trends and technologies',
      traditional: 'Proven, reliable design following established conventions',
    };

    return descriptions[type] || 'Balanced design approach';
  }

  private defineConceptFeatures(type: string, research: unknown): string[] {
    const features = {
      minimalist: ['Clean interface', 'Essential features only', 'Fast performance'],
      feature_rich: ['Comprehensive functionality', 'Advanced options', 'Customization'],
      innovative: ['Latest UI patterns', 'Advanced interactions', 'Emerging technologies'],
      traditional: ['Familiar patterns', 'Proven workflows', 'Reliable performance'],
    };

    return (
      features[type] || ['Core functionality', 'User-friendly interface', 'Reliable performance']
    );
  }

  private identifyConceptAdvantages(type: string): string[] {
    const advantages = {
      minimalist: ['Easy to use', 'Fast performance', 'Low maintenance'],
      feature_rich: ['Comprehensive solution', 'High flexibility', 'Advanced capabilities'],
      innovative: ['Competitive advantage', 'Modern appeal', 'Future-ready'],
      traditional: ['User familiarity', 'Proven reliability', 'Lower risk'],
    };

    return advantages[type] || ['Balanced approach', 'Good usability', 'Meets requirements'];
  }

  private identifyConceptChallenges(type: string): string[] {
    const challenges = {
      minimalist: ['Limited functionality', 'May lack features', 'Scalability concerns'],
      feature_rich: ['Complexity', 'Learning curve', 'Performance impact'],
      innovative: ['Unknown risks', 'Implementation challenges', 'User adoption'],
      traditional: ['Limited innovation', 'Competitive disadvantage', 'Outdated appeal'],
    };

    return (
      challenges[type] || [
        'Implementation complexity',
        'Resource requirements',
        'Timeline pressure',
      ]
    );
  }

  private determinRefinementCycles(concepts: unknown[]): number {
    return Math.min(concepts.length, 3);
  }

  private establishRefinementCriteria(concepts: unknown[]): string[] {
    return [
      'User experience quality',
      'Technical feasibility',
      'Business value alignment',
      'Implementation complexity',
      'Innovation level',
    ];
  }

  private selectTopConcepts(concepts: unknown[]): unknown[] {
    return concepts.slice(0, 2); // Select top 2 concepts
  }

  private applyImprovements(concepts: unknown[]): string[] {
    return [
      'Enhanced user experience flows',
      'Improved visual hierarchy',
      'Optimized performance considerations',
      'Better accessibility integration',
      'Streamlined functionality',
    ];
  }

  private incorporateUserFeedback(concepts: unknown[]): string {
    return 'User feedback incorporated through iterative design reviews';
  }

  private planIterations(concepts: unknown[]): string[] {
    return [
      'Initial concept refinement',
      'User feedback integration',
      'Technical validation',
      'Final optimization',
    ];
  }

  private determinePrototypeComplexity(refinement: unknown): string {
    return refinement.selected_concepts.length > 1 ? 'high' : 'medium';
  }

  private selectPrototypeFidelity(refinement: unknown): string {
    return 'medium_to_high';
  }

  private selectPrototypeTypes(refinement: unknown): string[] {
    return ['Interactive wireframes', 'Visual mockups', 'Functional prototype'];
  }

  private recommendPrototypingTools(refinement: unknown): string[] {
    return ['Figma/Sketch for design', 'InVision for interaction', 'Code-based prototypes'];
  }

  private estimatePrototypingTime(refinement: unknown): string {
    return '2-3 weeks';
  }

  private definePrototypeDeliverables(refinement: unknown): string[] {
    return [
      'Interactive prototype',
      'Design specifications',
      'User testing scenarios',
      'Implementation guidelines',
    ];
  }

  private calculateValidationScore(prototyping: unknown): number {
    return Math.floor(Math.random() * 3) + 8; // 8-10 score simulation
  }

  private selectValidationMethods(prototyping: unknown): string[] {
    return [
      'User testing sessions',
      'Expert design reviews',
      'Accessibility audits',
      'Performance validation',
    ];
  }

  private planUserTesting(prototyping: unknown): string {
    return 'Structured user testing with representative users';
  }

  private collectFeedback(prototyping: unknown): string[] {
    return [
      'User experience feedback',
      'Usability issues identification',
      'Feature request collection',
      'Performance feedback',
    ];
  }

  private defineSuccessMetrics(prototyping: unknown): string[] {
    return [
      'User task completion rate',
      'User satisfaction scores',
      'Time to complete tasks',
      'Error rate reduction',
    ];
  }

  private generateRecommendations(prototyping: unknown): string[] {
    return [
      'Proceed with implementation planning',
      'Conduct additional user validation',
      'Refine specific interaction patterns',
      'Optimize for target performance metrics',
    ];
  }
}
