/**
 * Facilitating Mode Plugin - Team facilitation and collaboration mode
 * Specialized for guiding group discussions, mediating conflicts, and enabling effective collaboration
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class FacilitatingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'facilitating',
      name: 'Facilitating',
      category: 'collaborative',
      symbol: '🤝',
      color: 'green',
      description: 'ファシリテーションモード - チーム促進と協働支援',
      keywords: [
        'facilitate',
        'guide',
        'moderate',
        'coordinate',
        'mediate',
        'enable',
        'support',
        'help team',
        'collaboration',
        'discussion',
      ],
      triggers: [
        'facilitate',
        'help the team',
        'guide discussion',
        'coordinate',
        'moderate meeting',
        'enable collaboration',
        'team needs',
      ],
      examples: [
        'Facilitate a team discussion about priorities',
        'Help coordinate the project planning session',
        'Guide the team through decision making',
        'Moderate a conflict resolution meeting',
        'Enable effective collaboration between departments',
      ],
      enabled: true,
      priority: 4,
      timeout: 120000, // 2 minutes for collaborative processes
      maxConcurrentSessions: 6,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(
      `[${this.config.id}] Activating facilitating mode for session ${context.sessionId}`,
    );

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Facilitating...',
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
    console.log(`[${this.config.id}] Deactivating facilitating mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing facilitation request: "${input.substring(0, 50)}..."`,
    );

    // Facilitation process pipeline
    const situationAnalysis = await this.analyzeSituation(input, context);
    const stakeholderMap = await this.mapStakeholders(input, situationAnalysis);
    const facilitationStrategy = await this.designFacilitationStrategy(input, stakeholderMap);
    const processDesign = await this.designCollaborativeProcess(input, facilitationStrategy);
    const interventions = await this.planInterventions(input, processDesign);
    const outcomes = await this.projectOutcomes(input, interventions);

    const suggestions = await this.generateFacilitationSuggestions(input, outcomes);
    const nextMode = await this.determineNextMode(input, outcomes);

    return {
      success: true,
      output: this.formatFacilitationPlan(
        situationAnalysis,
        processDesign,
        interventions,
        outcomes,
      ),
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.89,
      metadata: {
        situationType: situationAnalysis.type,
        stakeholderCount: stakeholderMap.count,
        strategyType: facilitationStrategy.type,
        interventionCount: interventions.length,
        processComplexity: processDesign.complexity,
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.2;

    const inputLower = input.toLowerCase();

    // Direct facilitation keywords
    const facilitationKeywords = [
      'facilitate',
      'guide',
      'moderate',
      'coordinate',
      'mediate',
      'enable',
      'support',
      'help team',
      'collaboration',
    ];

    const facilitationMatches = facilitationKeywords.filter((keyword) =>
      inputLower.includes(keyword),
    );
    if (facilitationMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Facilitation keywords: ${facilitationMatches.join(', ')}`);
    }

    // Team and group indicators
    const teamIndicators = [
      'team',
      'group',
      'meeting',
      'discussion',
      'session',
      'workshop',
      'collaboration',
      'stakeholders',
    ];

    const teamMatches = teamIndicators.filter((indicator) => inputLower.includes(indicator));
    if (teamMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(`Team/group indicators: ${teamMatches.join(', ')}`);
    }

    // Process and structure words
    const processWords = [
      'process',
      'structure',
      'framework',
      'agenda',
      'organize',
      'plan',
      'schedule',
      'coordinate',
      'manage',
    ];

    const processMatches = processWords.filter((word) => inputLower.includes(word));
    if (processMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Process structure words: ${processMatches.join(', ')}`);
    }

    // Conflict or challenge indicators
    const challengeIndicators = [
      'conflict',
      'disagreement',
      'tension',
      'challenge',
      'difficult',
      'stuck',
      'blocked',
      'deadlock',
      'issue',
    ];

    const challengeMatches = challengeIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    );
    if (challengeMatches.length > 0) {
      confidence += 0.25;
      reasoning.push(`Challenge/conflict indicators suggest facilitation need`);
    }

    // Decision-making context
    const decisionIndicators = [
      'decide',
      'choice',
      'option',
      'alternative',
      'consensus',
      'agreement',
      'vote',
      'select',
    ];

    const decisionMatches = decisionIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    );
    if (decisionMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Decision-making context detected`);
    }

    // Multiple people/perspectives mentioned
    const peopleIndicators = ['we', 'us', 'everyone', 'all', 'both', 'each'];
    const peopleMatches = peopleIndicators.filter((indicator) => inputLower.includes(indicator));
    if (peopleMatches.length > 0) {
      confidence += 0.1;
      reasoning.push('Multiple perspectives context');
    }

    // Questions that suggest facilitation need
    const facilitationQuestions = [
      /how.*get.*team/i,
      /how.*coordinate/i,
      /how.*manage.*meeting/i,
      /how.*resolve.*conflict/i,
      /how.*reach.*consensus/i,
    ];

    const questionMatches = facilitationQuestions.filter((pattern) => pattern.test(input));
    if (questionMatches.length > 0) {
      confidence += 0.2;
      reasoning.push('Facilitation-oriented questions detected');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze the collaborative situation
   */
  private async analyzeSituation(input: string, context: ModeContext): Promise<unknown> {
    const analysis = {
      type: this.classifySituationType(input),
      complexity: this.assessSituationComplexity(input),
      urgency: this.assessUrgency(input),
      scope: this.determineSituationScope(input),
      constraints: this.identifyConstraints(input),
      opportunities: this.identifyOpportunities(input),
      risks: this.assessCollaborationRisks(input),
    };

    return analysis;
  }

  /**
   * Map stakeholders and their interests
   */
  private async mapStakeholders(input: string, situation: unknown): Promise<unknown> {
    const stakeholders = this.identifyStakeholders(input);

    const stakeholderMap = {
      count: stakeholders.length,
      primary: stakeholders.filter((s) => s.influence === 'high'),
      secondary: stakeholders.filter((s) => s.influence === 'medium'),
      interests: this.mapStakeholderInterests(stakeholders),
      relationships: this.analyzeStakeholderRelationships(stakeholders),
      power_dynamics: this.assessPowerDynamics(stakeholders),
    };

    return stakeholderMap;
  }

  /**
   * Design facilitation strategy
   */
  private async designFacilitationStrategy(
    input: string,
    stakeholderMap: unknown,
  ): Promise<unknown> {
    const strategies = {
      directive: 'Lead with clear structure and guidance',
      collaborative: 'Enable equal participation and shared decision-making',
      consultative: 'Gather input and provide expert recommendations',
      delegative: 'Empower team to self-organize and decide',
      mediative: 'Focus on conflict resolution and consensus building',
    };

    const strategyType = this.selectFacilitationStrategy(input, stakeholderMap);

    return {
      type: strategyType,
      description: strategies[strategyType],
      principles: this.defineFacilitationPrinciples(strategyType),
      techniques: this.selectFacilitationTechniques(strategyType),
      tools: this.recommendFacilitationTools(strategyType),
    };
  }

  /**
   * Design collaborative process
   */
  private async designCollaborativeProcess(input: string, strategy: unknown): Promise<unknown> {
    const process = {
      phases: this.designProcessPhases(input, strategy),
      timeline: this.estimateProcessTimeline(input),
      structure: this.defineProcessStructure(input, strategy),
      complexity: this.assessProcessComplexity(input),
      checkpoints: this.defineProcessCheckpoints(input),
      deliverables: this.identifyProcessDeliverables(input),
    };

    return process;
  }

  /**
   * Plan specific interventions
   */
  private async planInterventions(input: string, processDesign: unknown): Promise<unknown[]> {
    const interventions: unknown[] = [];

    // Opening interventions
    interventions.push({
      type: 'opening',
      name: 'Set Context and Expectations',
      timing: 'start',
      description: 'Establish purpose, agenda, and ground rules',
      techniques: ['check-in', 'agenda review', 'ground rules setting'],
    });

    // Process interventions
    if (this.needsStructure(input)) {
      interventions.push({
        type: 'structure',
        name: 'Provide Process Structure',
        timing: 'ongoing',
        description: 'Guide through structured decision-making process',
        techniques: ['timeboxing', 'parking lot', 'process checks'],
      });
    }

    if (this.hasConflict(input)) {
      interventions.push({
        type: 'conflict',
        name: 'Address Conflicts Constructively',
        timing: 'as-needed',
        description: 'Mediate disagreements and find common ground',
        techniques: ['reframing', 'perspective taking', 'interest identification'],
      });
    }

    // Participation interventions
    interventions.push({
      type: 'participation',
      name: 'Ensure Inclusive Participation',
      timing: 'ongoing',
      description: 'Draw out quiet voices and manage dominant participants',
      techniques: ['round robin', 'silent brainstorming', 'nominal group technique'],
    });

    // Closing interventions
    interventions.push({
      type: 'closing',
      name: 'Synthesize and Close',
      timing: 'end',
      description: 'Summarize outcomes and plan next steps',
      techniques: ['synthesis', 'action planning', 'check-out'],
    });

    return interventions;
  }

  /**
   * Project expected outcomes
   */
  private async projectOutcomes(input: string, interventions: unknown[]): Promise<unknown> {
    const outcomes = {
      primary: this.identifyPrimaryOutcomes(input),
      secondary: this.identifySecondaryOutcomes(input),
      success_indicators: this.defineSuccessIndicators(input),
      potential_challenges: this.anticipateChallenges(input, interventions),
      follow_up_actions: this.planFollowUpActions(input),
      learning_opportunities: this.identifyLearningOpportunities(input),
    };

    return outcomes;
  }

  /**
   * Format facilitation plan
   */
  private formatFacilitationPlan(
    situation: unknown,
    process: unknown,
    interventions: unknown[],
    outcomes: unknown,
  ): string {
    const output: string[] = [];

    output.push('Facilitation Plan');
    output.push('═'.repeat(17));
    output.push('');

    output.push('Situation Analysis:');
    output.push(`Type: ${situation.type}`);
    output.push(`Complexity: ${situation.complexity}`);
    output.push(`Urgency: ${situation.urgency}`);
    output.push('');

    output.push('Process Design:');
    output.push('Phases:');
    process.phases.forEach((phase: string, index: number) => {
      output.push(`${index + 1}. ${phase}`);
    });
    output.push(`Timeline: ${process.timeline}`);
    output.push('');

    output.push('Key Interventions:');
    interventions.slice(0, 4).forEach((intervention, index) => {
      output.push(`${index + 1}. ${intervention.name}`);
      output.push(`   Purpose: ${intervention.description}`);
      output.push(`   Timing: ${intervention.timing}`);
      output.push('');
    });

    output.push('Expected Outcomes:');
    outcomes.primary.forEach((outcome: string) => {
      output.push(`• ${outcome}`);
    });
    output.push('');

    output.push('Success Indicators:');
    outcomes.success_indicators.slice(0, 3).forEach((indicator: string) => {
      output.push(`• ${indicator}`);
    });

    return output.join('\n');
  }

  /**
   * Generate facilitation suggestions
   */
  private async generateFacilitationSuggestions(
    input: string,
    outcomes: unknown,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Prepare detailed agenda with time allocations');
    suggestions.push('Set clear ground rules for participation');

    if (this.hasConflict(input)) {
      suggestions.push('Prepare conflict resolution techniques');
    }

    if (this.hasComplexDecision(input)) {
      suggestions.push('Use structured decision-making frameworks');
    }

    suggestions.push('Plan for follow-up and accountability');

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(input: string, outcomes: unknown): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('implement') || inputLower.includes('execute')) {
      return 'organizing';
    }

    if (inputLower.includes('document') || inputLower.includes('record')) {
      return 'summarizing';
    }

    if (inputLower.includes('follow up') || inputLower.includes('next steps')) {
      return 'planning';
    }

    return 'reflecting';
  }

  // Helper methods
  private classifySituationType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('conflict') || inputLower.includes('disagreement'))
      return 'conflict_resolution';
    if (inputLower.includes('decision') || inputLower.includes('choose')) return 'decision_making';
    if (inputLower.includes('brainstorm') || inputLower.includes('creative'))
      return 'creative_collaboration';
    if (inputLower.includes('plan') || inputLower.includes('strategy')) return 'planning_session';
    if (inputLower.includes('problem') || inputLower.includes('solve')) return 'problem_solving';

    return 'general_collaboration';
  }

  private assessSituationComplexity(input: string): string {
    const wordCount = input.split(/\s+/).length;
    const stakeholderCount = this.countStakeholderReferences(input);

    if (wordCount > 100 || stakeholderCount > 5) return 'high';
    if (wordCount > 50 || stakeholderCount > 3) return 'medium';
    return 'low';
  }

  private assessUrgency(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('urgent') || inputLower.includes('asap')) return 'high';
    if (inputLower.includes('soon') || inputLower.includes('quickly')) return 'medium';
    return 'low';
  }

  private determineSituationScope(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('department') || inputLower.includes('organization'))
      return 'organizational';
    if (inputLower.includes('project') || inputLower.includes('initiative')) return 'project';
    if (inputLower.includes('team') || inputLower.includes('group')) return 'team';
    return 'individual';
  }

  private identifyConstraints(input: string): string[] {
    const constraints: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('time')) constraints.push('time limitations');
    if (inputLower.includes('budget')) constraints.push('budget constraints');
    if (inputLower.includes('resource')) constraints.push('resource limitations');
    if (inputLower.includes('remote')) constraints.push('remote collaboration');

    return constraints;
  }

  private identifyOpportunities(input: string): string[] {
    return [
      'Build stronger team relationships',
      'Improve collaboration processes',
      'Develop shared understanding',
      'Create alignment on goals',
    ];
  }

  private assessCollaborationRisks(input: string): string[] {
    const risks: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('conflict')) risks.push('unresolved conflicts');
    if (inputLower.includes('deadline')) risks.push('time pressure');
    if (inputLower.includes('complex')) risks.push('process complexity');

    risks.push('participant disengagement');
    return risks;
  }

  private identifyStakeholders(input: string): unknown[] {
    const stakeholders: unknown[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('team')) {
      stakeholders.push({ name: 'Team Members', influence: 'high', interest: 'high' });
    }
    if (inputLower.includes('manager')) {
      stakeholders.push({ name: 'Management', influence: 'high', interest: 'medium' });
    }
    if (inputLower.includes('customer')) {
      stakeholders.push({ name: 'Customers', influence: 'medium', interest: 'high' });
    }

    // Default stakeholders if none identified
    if (stakeholders.length === 0) {
      stakeholders.push({ name: 'Participants', influence: 'high', interest: 'high' });
    }

    return stakeholders;
  }

  private mapStakeholderInterests(stakeholders: unknown[]): unknown {
    return stakeholders.reduce((interests, stakeholder) => {
      interests[stakeholder.name] = ['successful outcomes', 'efficient process'];
      return interests;
    }, {});
  }

  private analyzeStakeholderRelationships(stakeholders: unknown[]): string[] {
    return ['cooperative', 'collaborative', 'potentially competitive'];
  }

  private assessPowerDynamics(stakeholders: unknown[]): string {
    const highInfluence = stakeholders.filter((s) => s.influence === 'high').length;

    if (highInfluence > 2) return 'complex';
    if (highInfluence > 1) return 'moderate';
    return 'simple';
  }

  private selectFacilitationStrategy(input: string, stakeholderMap: unknown): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('conflict')) return 'mediative';
    if (stakeholderMap.power_dynamics === 'complex') return 'consultative';
    if (inputLower.includes('creative') || inputLower.includes('brainstorm'))
      return 'collaborative';
    if (inputLower.includes('urgent')) return 'directive';

    return 'collaborative';
  }

  private defineFacilitationPrinciples(strategyType: string): string[] {
    const principles = {
      directive: ['Clear leadership', 'Structured process', 'Efficient outcomes'],
      collaborative: ['Equal participation', 'Shared ownership', 'Consensus building'],
      consultative: ['Expert guidance', 'Informed decisions', 'Stakeholder input'],
      delegative: ['Self-organization', 'Empowerment', 'Autonomy'],
      mediative: ['Neutral stance', 'Conflict resolution', 'Win-win solutions'],
    };

    return principles[strategyType] || principles['collaborative'];
  }

  private selectFacilitationTechniques(strategyType: string): string[] {
    const techniques = {
      directive: ['Agenda management', 'Time boxing', 'Decision forcing'],
      collaborative: ['Open discussion', 'Consensus building', 'Brainstorming'],
      consultative: ['Expert input', 'Options analysis', 'Recommendation synthesis'],
      delegative: ['Self-facilitation', 'Minimal intervention', 'Support on request'],
      mediative: ['Active listening', 'Reframing', 'Interest identification'],
    };

    return techniques[strategyType] || techniques['collaborative'];
  }

  private recommendFacilitationTools(strategyType: string): string[] {
    return ['Shared agenda', 'Decision matrix', 'Action item tracker', 'Ground rules charter'];
  }

  private designProcessPhases(input: string, strategy: unknown): string[] {
    const basePhases = [
      'Opening & Context Setting',
      'Information Gathering',
      'Analysis & Discussion',
      'Decision Making',
      'Action Planning',
      'Closing & Next Steps',
    ];

    if (strategy.type === 'mediative') {
      basePhases.splice(2, 0, 'Conflict Exploration');
    }

    return basePhases;
  }

  private estimateProcessTimeline(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('quick') || inputLower.includes('brief')) return '30-60 minutes';
    if (inputLower.includes('workshop') || inputLower.includes('session')) return '2-4 hours';
    if (inputLower.includes('retreat') || inputLower.includes('intensive')) return '1-2 days';

    return '1-2 hours';
  }

  private defineProcessStructure(input: string, strategy: unknown): string {
    return strategy.type === 'directive' ? 'highly structured' : 'flexible with guidelines';
  }

  private assessProcessComplexity(input: string): string {
    return this.assessSituationComplexity(input);
  }

  private defineProcessCheckpoints(input: string): string[] {
    return ['Mid-point check', 'Decision confirmation', 'Action review'];
  }

  private identifyProcessDeliverables(input: string): string[] {
    return ['Meeting summary', 'Decision record', 'Action item list', 'Next steps plan'];
  }

  private needsStructure(input: string): boolean {
    const inputLower = input.toLowerCase();
    return (
      inputLower.includes('complex') ||
      inputLower.includes('organize') ||
      inputLower.includes('structure')
    );
  }

  private hasConflict(input: string): boolean {
    const inputLower = input.toLowerCase();
    return (
      inputLower.includes('conflict') ||
      inputLower.includes('disagreement') ||
      inputLower.includes('tension')
    );
  }

  private hasComplexDecision(input: string): boolean {
    const inputLower = input.toLowerCase();
    return (
      inputLower.includes('decision') &&
      (inputLower.includes('complex') || inputLower.includes('difficult'))
    );
  }

  private identifyPrimaryOutcomes(input: string): string[] {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('decision'))
      return ['Clear decision made', 'Stakeholder buy-in achieved'];
    if (inputLower.includes('plan'))
      return ['Actionable plan created', 'Roles and responsibilities defined'];
    if (inputLower.includes('problem'))
      return ['Problem clearly defined', 'Solution options identified'];

    return ['Clear outcomes achieved', 'Team alignment established'];
  }

  private identifySecondaryOutcomes(input: string): string[] {
    return [
      'Improved team communication',
      'Enhanced collaboration skills',
      'Stronger working relationships',
      'Better process understanding',
    ];
  }

  private defineSuccessIndicators(input: string): string[] {
    return [
      'All participants actively engaged',
      'Clear decisions and next steps documented',
      'Positive participant feedback',
      'Objectives achieved within timeframe',
    ];
  }

  private anticipateChallenges(input: string, interventions: unknown[]): string[] {
    return [
      'Managing different perspectives',
      'Keeping discussion focused',
      'Ensuring equal participation',
      'Making decisions within time constraints',
    ];
  }

  private planFollowUpActions(input: string): string[] {
    return [
      'Send meeting summary to all participants',
      'Schedule follow-up check-ins',
      'Monitor progress on action items',
      'Gather feedback on process effectiveness',
    ];
  }

  private identifyLearningOpportunities(input: string): string[] {
    return [
      'Team collaboration skills development',
      'Process improvement insights',
      'Stakeholder relationship building',
      'Conflict resolution capabilities',
    ];
  }

  private countStakeholderReferences(input: string): number {
    const stakeholderTerms = ['team', 'group', 'people', 'members', 'participants', 'stakeholders'];
    return stakeholderTerms.filter((term) => input.toLowerCase().includes(term)).length;
  }
}
