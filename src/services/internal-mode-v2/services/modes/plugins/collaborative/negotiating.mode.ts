import { BaseMode } from '../base/BaseMode';
import { ModeContext, ModeResult, ModeConfig } from '../types/ModeTypes';
import { EventEmitter } from 'events';

/**
 * Negotiating Mode - Conflict resolution and compromise facilitation
 * Provides systematic negotiation frameworks and consensus-building capabilities
 */
export class NegotiatingMode extends BaseMode {
  private negotiationHistory: Map<string, any> = new Map();
  private stakeholderProfiles: Map<string, any> = new Map();

  constructor(eventEmitter: EventEmitter) {
    super(eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: 'negotiating',
      name: 'Negotiating Mode',
      category: 'collaborative',
      description:
        'Advanced negotiation and conflict resolution with stakeholder consensus building',
      keywords: [
        'negotiate',
        'resolve',
        'compromise',
        'mediate',
        'consensus',
        'agreement',
        'conflict',
        'dispute',
      ],
      triggers: [
        'negotiate with',
        'resolve conflict',
        'find compromise',
        'build consensus',
        'mediate between',
      ],
      examples: [
        'Negotiate requirements between stakeholders',
        'Resolve conflict between technical and business teams',
        'Find compromise on resource allocation',
        'Build consensus on architecture decisions',
      ],
      priority: 75,
      timeout: 60000,
      retryAttempts: 3,
      validation: {
        minInputLength: 20,
        maxInputLength: 12000,
        requiredContext: ['stakeholders', 'conflict_area'],
      },
    };
  }

  async onActivate(context: ModeContext): Promise<void> {
    this.emit('modeActivated', {
      mode: this.config.id,
      timestamp: Date.now(),
      context: context.id,
    });

    // Initialize negotiation framework
    this.updateMetrics({
      activationTime: Date.now(),
      stakeholderCount: this.identifyStakeholderCount(context),
      conflictComplexity: this.assessConflictComplexity(context),
      negotiationScope: this.determineNegotiationScope(context),
    });

    // Load relevant negotiation history
    await this.loadNegotiationHistory(context);
  }

  async onDeactivate(): Promise<void> {
    // Save negotiation outcomes and lessons learned
    await this.persistNegotiationOutcomes();

    this.emit('modeDeactivated', {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      agreementsReached: this.metrics.agreementsCount || 0,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const startTime = Date.now();

    try {
      // Negotiation Pipeline
      const negotiationResults = await this.executeNegotiationPipeline(context);

      const processingTime = Date.now() - startTime;

      this.updateMetrics({
        totalProcessingTime: processingTime,
        negotiationEffectiveness: negotiationResults.effectiveness,
        consensusLevel: negotiationResults.consensus.level,
        stakeholderSatisfaction: negotiationResults.satisfaction.average,
        agreementsCount: negotiationResults.agreements.length,
        lastProcessedAt: Date.now(),
      });

      // Store negotiation outcomes
      await this.storeNegotiationOutcomes(negotiationResults);

      return {
        success: true,
        data: negotiationResults,
        confidence: this.calculateConfidence(context, negotiationResults),
        processingTime,
        metadata: {
          negotiationStrategy: negotiationResults.strategy.type,
          stakeholdersInvolved: negotiationResults.stakeholders.length,
          agreementsReached: negotiationResults.agreements.length,
          consensusLevel: negotiationResults.consensus.level,
          satisfactionScore: negotiationResults.satisfaction.average,
        },
      };
    } catch (error) {
      this.handleError(error as Error, context);
      return {
        success: false,
        error: (error as Error).message,
        confidence: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  onCanHandle(context: ModeContext): number {
    let confidence = 0.1;

    // Keyword matching
    const keywords = this.config.keywords;
    const input = context.input.toLowerCase();
    const keywordMatches = keywords.filter((keyword) => input.includes(keyword));
    confidence += keywordMatches.length * 0.12;

    // Negotiation intent detection
    const negotiationPatterns = [
      /negotiate\s+.+\s+between/i,
      /resolve\s+.+\s+conflict/i,
      /find\s+.+\s+compromise/i,
      /build\s+consensus\s+on/i,
      /mediate\s+between\s+.+/i,
      /agreement\s+on\s+.+/i,
      /dispute\s+over\s+.+/i,
      /stakeholder\s+.+\s+disagreement/i,
    ];

    const patternMatches = negotiationPatterns.filter((pattern) => pattern.test(input));
    confidence += patternMatches.length * 0.15;

    // Multi-stakeholder indicators
    const stakeholderIndicators = [
      'team',
      'teams',
      'department',
      'group',
      'stakeholder',
      'party',
      'parties',
    ];
    const stakeholderMatches = stakeholderIndicators.filter((indicator) =>
      input.includes(indicator),
    );
    confidence += stakeholderMatches.length * 0.1;

    // Conflict indicators
    const conflictIndicators = [
      'disagree',
      'conflict',
      'dispute',
      'tension',
      'issue',
      'problem',
      'challenge',
    ];
    const conflictMatches = conflictIndicators.filter((indicator) => input.includes(indicator));
    confidence += conflictMatches.length * 0.12;

    // Context indicators
    if (context.metadata?.requiresNegotiation) confidence += 0.25;
    if (context.metadata?.multipleStakeholders) confidence += 0.2;
    if (context.metadata?.hasConflict) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  private async executeNegotiationPipeline(context: ModeContext): Promise<unknown> {
    const pipeline = {
      situationAnalysis: await this.analyzeSituation(context),
      stakeholderMapping: await this.mapStakeholders(context),
      interestIdentification: await this.identifyInterests(context),
      strategyDevelopment: await this.developNegotiationStrategy(context),
      processDesign: await this.designNegotiationProcess(context),
      facilitation: await this.facilitateNegotiation(context),
      consensusBuilding: await this.buildConsensus(context),
      agreementFormulation: await this.formulateAgreements(context),
    };

    return {
      strategy: pipeline.strategyDevelopment,
      stakeholders: pipeline.stakeholderMapping,
      interests: pipeline.interestIdentification,
      process: pipeline.processDesign,
      consensus: pipeline.consensusBuilding,
      agreements: pipeline.agreementFormulation,
      satisfaction: this.assessStakeholderSatisfaction(pipeline),
      effectiveness: this.calculateEffectiveness(pipeline),
      recommendations: this.generateRecommendations(pipeline),
    };
  }

  private async analyzeSituation(context: ModeContext): Promise<unknown> {
    return {
      conflictType: this.identifyConflictType(context.input),
      urgency: this.assessNegotiationUrgency(context.input),
      complexity: this.assessNegotiationComplexity(context.input),
      scope: this.determineNegotiationScope(context),
      constraints: this.identifyConstraints(context.input),
      opportunities: this.identifyOpportunities(context.input),
    };
  }

  private async mapStakeholders(context: ModeContext): Promise<unknown[]> {
    const stakeholders = this.extractStakeholders(context.input);

    return stakeholders.map((stakeholder) => ({
      name: stakeholder,
      role: this.identifyStakeholderRole(stakeholder, context.input),
      influence: this.assessInfluence(stakeholder, context.input),
      interests: this.inferStakeholderInterests(stakeholder, context.input),
      negotiationStyle: this.inferNegotiationStyle(stakeholder, context.input),
      priorities: this.identifyPriorities(stakeholder, context.input),
    }));
  }

  private async identifyInterests(context: ModeContext): Promise<unknown> {
    return {
      shared: this.identifySharedInterests(context.input),
      competing: this.identifyCompetingInterests(context.input),
      hidden: this.identifyHiddenInterests(context.input),
      negotiable: this.identifyNegotiableInterests(context.input),
      nonNegotiable: this.identifyNonNegotiableInterests(context.input),
    };
  }

  private async developNegotiationStrategy(context: ModeContext): Promise<unknown> {
    const situation = await this.analyzeSituation(context);

    return {
      type: this.selectNegotiationStrategy(situation),
      approach: this.defineNegotiationApproach(situation),
      tactics: this.identifyNegotiationTactics(situation),
      fallbackOptions: this.developFallbackOptions(situation),
      timeline: this.planNegotiationTimeline(situation),
    };
  }

  private async designNegotiationProcess(context: ModeContext): Promise<unknown> {
    return {
      phases: this.defineNegotiationPhases(),
      structure: this.designMeetingStructure(),
      rules: this.establishGroundRules(),
      facilitationApproach: this.selectFacilitationApproach(),
      communication: this.designCommunicationProtocol(),
      decisionMaking: this.establishDecisionMakingProcess(),
    };
  }

  private async facilitateNegotiation(context: ModeContext): Promise<unknown> {
    return {
      openingFramework: this.createOpeningFramework(),
      dialogueGuides: this.developDialogueGuides(),
      conflictResolution: this.designConflictResolutionMethods(),
      momentumMaintenance: this.createMomentumMaintenance(),
      breakdownPrevention: this.designBreakdownPrevention(),
    };
  }

  private async buildConsensus(context: ModeContext): Promise<unknown> {
    return {
      level: this.assessConsensusLevel(context),
      techniques: this.selectConsensusBuilding(),
      barriers: this.identifyConsensusBarriers(context),
      facilitators: this.identifyConsensusFacilitators(context),
      timeline: this.estimateConsensusTimeline(context),
    };
  }

  private async formulateAgreements(context: ModeContext): Promise<unknown[]> {
    return [
      {
        type: 'framework_agreement',
        description: 'High-level framework for collaboration',
        terms: this.generateFrameworkTerms(context),
        stakeholders: 'all',
        status: 'draft',
      },
      {
        type: 'operational_agreement',
        description: 'Specific operational procedures',
        terms: this.generateOperationalTerms(context),
        stakeholders: 'implementation_teams',
        status: 'draft',
      },
    ];
  }

  private async loadNegotiationHistory(context: ModeContext): Promise<void> {
    // Load relevant historical negotiations
    const relevantKeys = Array.from(this.negotiationHistory.keys()).filter((key) =>
      this.isRelevantToContext(key, context),
    );

    this.updateMetrics({
      historicalNegotiations: relevantKeys.length,
    });
  }

  private async persistNegotiationOutcomes(): Promise<void> {
    // Persist negotiation outcomes for future reference
    // Implementation would save to persistent storage
  }

  private async storeNegotiationOutcomes(results: unknown): Promise<void> {
    const key = this.generateNegotiationKey(results);
    this.negotiationHistory.set(key, {
      ...results,
      timestamp: Date.now(),
      success_rate: results.effectiveness,
    });
  }

  private identifyStakeholderCount(context: ModeContext): number {
    const stakeholderTerms = ['team', 'department', 'group', 'stakeholder', 'party'];
    return stakeholderTerms.filter((term) => context.input.includes(term)).length;
  }

  private assessConflictComplexity(context: ModeContext): string {
    const complexityIndicators = context.input.toLowerCase();

    if (complexityIndicators.includes('multiple') || complexityIndicators.includes('complex')) {
      return 'high';
    }
    if (
      complexityIndicators.includes('simple') ||
      complexityIndicators.includes('straightforward')
    ) {
      return 'low';
    }
    return 'medium';
  }

  private calculateConfidence(context: ModeContext, results: unknown): number {
    let confidence = 0.7;

    if (results.consensus.level > 0.7) confidence += 0.1;
    if (results.satisfaction.average > 0.8) confidence += 0.1;
    if (results.agreements.length > 1) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  // Helper methods for negotiation operations
  private identifyConflictType(input: string): string {
    if (input.includes('resource')) return 'resource_allocation';
    if (input.includes('technical')) return 'technical_approach';
    if (input.includes('timeline')) return 'scheduling';
    if (input.includes('priority')) return 'prioritization';
    return 'general_disagreement';
  }

  private assessNegotiationUrgency(input: string): string {
    if (input.includes('urgent') || input.includes('critical')) return 'high';
    if (input.includes('soon') || input.includes('important')) return 'medium';
    return 'low';
  }

  private assessNegotiationComplexity(input: string): string {
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 150) return 'high';
    if (wordCount > 75) return 'medium';
    return 'low';
  }

  private extractStakeholders(input: string): string[] {
    // Simplified stakeholder extraction
    const stakeholders = [];
    if (input.includes('team')) stakeholders.push('development_team');
    if (input.includes('business')) stakeholders.push('business_team');
    if (input.includes('management')) stakeholders.push('management');
    if (input.includes('customer')) stakeholders.push('customer');
    return stakeholders;
  }

  private identifyStakeholderRole(stakeholder: string, input: string): string {
    return `${stakeholder}_role`;
  }

  private assessInfluence(stakeholder: string, input: string): string {
    if (stakeholder.includes('management')) return 'high';
    if (stakeholder.includes('customer')) return 'high';
    return 'medium';
  }

  private inferStakeholderInterests(stakeholder: string, input: string): string[] {
    return ['quality', 'timeline', 'budget'];
  }

  private inferNegotiationStyle(stakeholder: string, input: string): string {
    return 'collaborative';
  }

  private identifyPriorities(stakeholder: string, input: string): string[] {
    return ['delivery', 'quality', 'cost'];
  }

  private identifySharedInterests(input: string): string[] {
    return ['project success', 'quality delivery', 'team satisfaction'];
  }

  private identifyCompetingInterests(input: string): string[] {
    return ['timeline vs quality', 'cost vs features', 'stability vs innovation'];
  }

  private identifyHiddenInterests(input: string): string[] {
    return ['career advancement', 'resource control', 'technical preferences'];
  }

  private identifyNegotiableInterests(input: string): string[] {
    return ['timeline flexibility', 'feature prioritization', 'resource allocation'];
  }

  private identifyNonNegotiableInterests(input: string): string[] {
    return ['safety requirements', 'regulatory compliance', 'core functionality'];
  }

  private selectNegotiationStrategy(situation: unknown): string {
    if (situation.urgency === 'high') return 'collaborative_expedited';
    if (situation.complexity === 'high') return 'structured_facilitated';
    return 'collaborative_consensus';
  }

  private defineNegotiationApproach(situation: unknown): string {
    return 'interest_based_problem_solving';
  }

  private identifyNegotiationTactics(situation: unknown): string[] {
    return ['active_listening', 'reframing', 'option_generation', 'objective_criteria'];
  }

  private developFallbackOptions(situation: unknown): string[] {
    return ['escalation_to_management', 'external_mediation', 'phased_implementation'];
  }

  private planNegotiationTimeline(situation: unknown): unknown {
    return {
      preparation: '1 week',
      negotiation: '2-3 sessions',
      agreement: '1 week',
      implementation: '2-4 weeks',
    };
  }

  private defineNegotiationPhases(): string[] {
    return ['preparation', 'opening', 'exploration', 'bargaining', 'closure'];
  }

  private designMeetingStructure(): unknown {
    return {
      duration: '2-3 hours per session',
      frequency: 'weekly',
      format: 'structured_agenda',
      participation: 'all_stakeholders',
    };
  }

  private establishGroundRules(): string[] {
    return [
      'respectful communication',
      'focus on interests not positions',
      'confidentiality agreement',
      'decision-making process clarity',
    ];
  }

  private selectFacilitationApproach(): string {
    return 'neutral_facilitation';
  }

  private designCommunicationProtocol(): unknown {
    return {
      channels: ['meetings', 'email', 'documentation'],
      frequency: 'regular_updates',
      format: 'structured_reporting',
    };
  }

  private establishDecisionMakingProcess(): string {
    return 'consensus_with_fallback_voting';
  }

  private createOpeningFramework(): unknown {
    return {
      agenda_setting: 'collaborative',
      expectation_alignment: 'explicit',
      ground_rules: 'agreed_upon',
    };
  }

  private developDialogueGuides(): string[] {
    return ['open_ended_questions', 'reflective_listening', 'summarization_techniques'];
  }

  private designConflictResolutionMethods(): string[] {
    return ['reframing', 'perspective_taking', 'option_generation', 'criteria_development'];
  }

  private createMomentumMaintenance(): string[] {
    return ['progress_tracking', 'quick_wins', 'milestone_celebration'];
  }

  private designBreakdownPrevention(): string[] {
    return ['early_warning_indicators', 'cooling_off_periods', 'alternative_formats'];
  }

  private assessConsensusLevel(context: ModeContext): number {
    return 0.75; // Simplified assessment
  }

  private selectConsensusBuilding(): string[] {
    return ['facilitated_discussion', 'option_ranking', 'trade_off_analysis'];
  }

  private identifyConsensusBarriers(context: ModeContext): string[] {
    return ['conflicting_priorities', 'resource_constraints', 'time_pressure'];
  }

  private identifyConsensusFacilitators(context: ModeContext): string[] {
    return ['shared_goals', 'mutual_respect', 'clear_communication'];
  }

  private estimateConsensusTimeline(context: ModeContext): string {
    return '2-3 weeks';
  }

  private generateFrameworkTerms(context: ModeContext): string[] {
    return ['collaboration_principles', 'communication_protocols', 'decision_making_process'];
  }

  private generateOperationalTerms(context: ModeContext): string[] {
    return ['role_definitions', 'process_workflows', 'quality_standards'];
  }

  private assessStakeholderSatisfaction(pipeline: unknown): unknown {
    return {
      individual: [0.8, 0.75, 0.85, 0.9],
      average: 0.825,
      distribution: 'generally_positive',
    };
  }

  private calculateEffectiveness(pipeline: unknown): number {
    return 0.8; // Simplified calculation
  }

  private generateRecommendations(pipeline: unknown): string[] {
    return [
      'Document agreed-upon decisions clearly',
      'Establish regular follow-up meetings',
      'Create escalation procedures for future conflicts',
      'Build relationship maintenance into process',
    ];
  }

  private isRelevantToContext(key: string, context: ModeContext): boolean {
    return (
      key.includes(context.metadata?.domain || '') ||
      key.includes(context.metadata?.stakeholders || '')
    );
  }

  private generateNegotiationKey(results: unknown): string {
    return `negotiation_${results.strategy.type}_${Date.now()}`;
  }
}
