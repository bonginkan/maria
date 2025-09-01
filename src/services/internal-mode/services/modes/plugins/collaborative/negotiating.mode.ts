import { BaseMode } from "../base/BaseMode";
import { ModeConfig, ModeContext, ModeResult } from "../types/ModeTypes";
import { EventEmitter } from "node:events";

/**
 * Negotiating Mode - Conflict resolution and compromise facilitation
 * Provides systematic negotiation frameworks and consensus-building capabilities
 */
export class NegotiatingMode extends BaseMode {
  private negotiationHistory: Map<string, any> = new Map();
  private stakeholderProfiles: Map<string, any> = new Map();

  constructor(_eventEmitter: EventEmitter) {
    super(_eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: "negotiating",
      name: "Negotiating Mode",
      category: "collaborative",
      description:
        "Advanced negotiation and conflict resolution with stakeholder consensus building",
      _keywords: [
        "negotiate",
        "resolve",
        "compromise",
        "mediate",
        "consensus",
        "agreement",
        "conflict",
        "dispute",
      ],
      triggers: [
        "negotiate with",
        "resolve conflict",
        "find compromise",
        "build consensus",
        "mediate between",
      ],
      examples: [
        "Negotiate requirements between _stakeholders",
        "Resolve conflict between technical and business teams",
        "Find compromise on resource allocation",
        "Build consensus on architecture decisions",
      ],
      priority: 75,
      timeout: 60000,
      retryAttempts: 3,
      validation: {
        minInputLength: 20,
        maxInputLength: 12000,
        requiredContext: ["_stakeholders", "conflict_area"],
      },
    };
  }

  async onActivate(context: ModeContext): Promise<void> {
    this.emit("modeActivated", {
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

    this.emit("modeDeactivated", {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      agreementsReached: this.metrics.agreementsCount || 0,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const _startTime = Date.now();

    try {
      // Negotiation Pipeline
      const _negotiationResults =
        await this.executeNegotiationPipeline(context);

      const _processingTime = Date.now() - _startTime;

      this.updateMetrics({
        totalProcessingTime: _processingTime,
        negotiationEffectiveness: _negotiationResults.effectiveness,
        consensusLevel: _negotiationResults.consensus.level,
        stakeholderSatisfaction: _negotiationResults.satisfaction.average,
        agreementsCount: _negotiationResults.agreements.length,
        lastProcessedAt: Date.now(),
      });

      // Store negotiation outcomes
      await this.storeNegotiationOutcomes(_negotiationResults);

      return {
        success: true,
        data: _negotiationResults,
        confidence: this.calculateConfidence(context, _negotiationResults),
        _processingTime,
        metadata: {
          negotiationStrategy: _negotiationResults.strategy.type,
          stakeholdersInvolved: _negotiationResults.stakeholders.length,
          agreementsReached: _negotiationResults.agreements.length,
          consensusLevel: _negotiationResults.consensus.level,
          satisfactionScore: _negotiationResults.satisfaction.average,
        },
      };
    } catch (_error) {
      this.handleError(_error as Error, context);
      return {
        success: false,
        _error: (_error as Error).message,
        confidence: 0,
        _processingTime: Date.now() - _startTime,
      };
    }
  }

  onCanHandle(context: ModeContext): number {
    let confidence = 0.1;

    // Keyword matching
    const _keywords = this.config._keywords;
    const _input = context._input.toLowerCase();
    const _keywordMatches = _keywords.filter((keyword) =>
      _input.includes(keyword),
    );
    confidence += _keywordMatches.length * 0.12;

    // Negotiation intent detection
    const _negotiationPatterns = [
      /negotiate\s+.+\s+between/i,
      /resolve\s+.+\s+conflict/i,
      /find\s+.+\s+compromise/i,
      /build\s+consensus\s+on/i,
      /mediate\s+between\s+.+/i,
      /agreement\s+on\s+.+/i,
      /dispute\s+over\s+.+/i,
      /stakeholder\s+.+\s+disagreement/i,
    ];

    const _patternMatches = _negotiationPatterns.filter((pattern) =>
      pattern.test(_input),
    );
    confidence += _patternMatches.length * 0.15;

    // Multi-stakeholder indicators
    const _stakeholderIndicators = [
      "team",
      "teams",
      "department",
      "group",
      "stakeholder",
      "party",
      "parties",
    ];
    const _stakeholderMatches = _stakeholderIndicators.filter((indicator) =>
      input.includes(indicator),
    );
    confidence += _stakeholderMatches.length * 0.1;

    // Conflict indicators
    const _conflictIndicators = [
      "disagree",
      "conflict",
      "dispute",
      "tension",
      "issue",
      "problem",
      "challenge",
    ];
    const _conflictMatches = _conflictIndicators.filter((indicator) =>
      _input.includes(indicator),
    );
    confidence += _conflictMatches.length * 0.12;

    // Context indicators
    if (context.metadata?.requiresNegotiation) {
      confidence += 0.25;
    }
    if (context.metadata?.multipleStakeholders) {
      confidence += 0.2;
    }
    if (context.metadata?.hasConflict) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  private async executeNegotiationPipeline(
    context: ModeContext,
  ): Promise<unknown> {
    const _pipeline = {
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
      strategy: _pipeline.strategyDevelopment,
      _stakeholders: _pipeline.stakeholderMapping,
      interests: _pipeline.interestIdentification,
      process: _pipeline.processDesign,
      consensus: _pipeline.consensusBuilding,
      agreements: _pipeline.agreementFormulation,
      satisfaction: this.assessStakeholderSatisfaction(_pipeline),
      effectiveness: this.calculateEffectiveness(_pipeline),
      recommendations: this.generateRecommendations(_pipeline),
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
    const _stakeholders = this.extractStakeholders(context.input);

    return _stakeholders.map((stakeholder) => ({
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

  private async developNegotiationStrategy(
    context: ModeContext,
  ): Promise<unknown> {
    const _situation = await this.analyzeSituation(context);

    return {
      type: this.selectNegotiationStrategy(_situation),
      approach: this.defineNegotiationApproach(_situation),
      tactics: this.identifyNegotiationTactics(_situation),
      fallbackOptions: this.developFallbackOptions(_situation),
      timeline: this.planNegotiationTimeline(_situation),
    };
  }

  private async designNegotiationProcess(
    _context: ModeContext,
  ): Promise<unknown> {
    return {
      phases: this.defineNegotiationPhases(),
      structure: this.designMeetingStructure(),
      rules: this.establishGroundRules(),
      facilitationApproach: this.selectFacilitationApproach(),
      communication: this.designCommunicationProtocol(),
      decisionMaking: this.establishDecisionMakingProcess(),
    };
  }

  private async facilitateNegotiation(_context: ModeContext): Promise<unknown> {
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
        type: "framework_agreement",
        description: "High-level framework for collaboration",
        terms: this.generateFrameworkTerms(context),
        _stakeholders: "all",
        status: "draft",
      },
      {
        type: "operational_agreement",
        description: "Specific operational procedures",
        terms: this.generateOperationalTerms(context),
        _stakeholders: "implementation_teams",
        status: "draft",
      },
    ];
  }

  private async loadNegotiationHistory(context: ModeContext): Promise<void> {
    // Load relevant historical negotiations
    const _relevantKeys = Array.from(this.negotiationHistory.keys()).filter(
      (_key) => this.isRelevantToContext(_key, context),
    );

    this.updateMetrics({
      historicalNegotiations: _relevantKeys.length,
    });
  }

  private async persistNegotiationOutcomes(): Promise<void> {
    // Persist negotiation outcomes for future reference
    // Implementation would save to persistent storage
  }

  private async storeNegotiationOutcomes(results: unknown): Promise<void> {
    const _key = this.generateNegotiationKey(results);
    this.negotiationHistory.set(_key, {
      ...results,
      timestamp: Date.now(),
      successrate: results.effectiveness,
    });
  }

  private identifyStakeholderCount(context: ModeContext): number {
    const _stakeholderTerms = [
      "team",
      "department",
      "group",
      "stakeholder",
      "party",
    ];
    return _stakeholderTerms.filter((term) => context.input.includes(term))
      .length;
  }

  private assessConflictComplexity(context: ModeContext): string {
    const _complexityIndicators = context.input.toLowerCase();

    if (
      _complexityIndicators.includes("multiple") ||
      _complexityIndicators.includes("complex")
    ) {
      return "high";
    }
    if (
      _complexityIndicators.includes("simple") ||
      complexityIndicators.includes("straightforward")
    ) {
      return "low";
    }
    return "medium";
  }

  private calculateConfidence(_context: ModeContext, results: unknown): number {
    let confidence = 0.7;

    if (results.consensus.level > 0.7) {
      confidence += 0.1;
    }
    if (results.satisfaction.average > 0.8) {
      confidence += 0.1;
    }
    if (results.agreements.length > 1) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  // Helper methods for negotiation operations
  private identifyConflictType(_input: string): string {
    if (_input.includes("resource")) {
      return "resource_allocation";
    }
    if (_input.includes("technical")) {
      return "technical_approach";
    }
    if (_input.includes("timeline")) {
      return "scheduling";
    }
    if (_input.includes("priority")) {
      return "prioritization";
    }
    return "general_disagreement";
  }

  private assessNegotiationUrgency(_input: string): string {
    if (_input.includes("urgent") || _input.includes("critical")) {
      return "high";
    }
    if (_input.includes("soon") || _input.includes("important")) {
      return "medium";
    }
    return "low";
  }

  private assessNegotiationComplexity(_input: string): string {
    const _wordCount = _input.split(/\s+/).length;
    if (_wordCount > 150) {
      return "high";
    }
    if (_wordCount > 75) {
      return "medium";
    }
    return "low";
  }

  private extractStakeholders(_input: string): string[] {
    // Simplified stakeholder extraction
    const _stakeholders = [];
    if (_input.includes("team")) {
      _stakeholders.push("development_team");
    }
    if (_input.includes("business")) {
      _stakeholders.push("business_team");
    }
    if (_input.includes("management")) {
      _stakeholders.push("management");
    }
    if (_input.includes("customer")) {
      _stakeholders.push("customer");
    }
    return _stakeholders;
  }

  private identifyStakeholderRole(
    _stakeholder: string,
    _input: string,
  ): string {
    return `${_stakeholder}_role`;
  }

  private assessInfluence(_stakeholder: string, _input: string): string {
    if (_stakeholder.includes("management")) {
      return "high";
    }
    if (_stakeholder.includes("customer")) {
      return "high";
    }
    return "medium";
  }

  private inferStakeholderInterests(
    _stakeholder: string,
    _input: string,
  ): string[] {
    return ["quality", "timeline", "budget"];
  }

  private inferNegotiationStyle(_stakeholder: string, _input: string): string {
    return "collaborative";
  }

  private identifyPriorities(_stakeholder: string, _input: string): string[] {
    return ["delivery", "quality", "cost"];
  }

  private identifySharedInterests(_input: string): string[] {
    return ["project success", "quality delivery", "team satisfaction"];
  }

  private identifyCompetingInterests(_input: string): string[] {
    return [
      "timeline vs quality",
      "cost vs features",
      "stability vs innovation",
    ];
  }

  private identifyHiddenInterests(_input: string): string[] {
    return ["career advancement", "resource control", "technical preferences"];
  }

  private identifyNegotiableInterests(_input: string): string[] {
    return [
      "timeline flexibility",
      "feature prioritization",
      "resource allocation",
    ];
  }

  private identifyNonNegotiableInterests(_input: string): string[] {
    return [
      "safety requirements",
      "regulatory compliance",
      "core functionality",
    ];
  }

  private selectNegotiationStrategy(_situation: unknown): string {
    if (_situation.urgency === "high") {
      return "collaborative_expedited";
    }
    if (_situation.complexity === "high") {
      return "structured_facilitated";
    }
    return "collaborative_consensus";
  }

  private defineNegotiationApproach(_situation: unknown): string {
    return "interest_based_problem_solving";
  }

  private identifyNegotiationTactics(_situation: unknown): string[] {
    return [
      "active_listening",
      "reframing",
      "option_generation",
      "objective_criteria",
    ];
  }

  private developFallbackOptions(_situation: unknown): string[] {
    return [
      "escalation_to_management",
      "external_mediation",
      "phased_implementation",
    ];
  }

  private planNegotiationTimeline(_situation: unknown): unknown {
    return {
      preparation: "1 week",
      negotiation: "2-3 sessions",
      agreement: "1 week",
      implementation: "2-4 weeks",
    };
  }

  private defineNegotiationPhases(): string[] {
    return ["preparation", "opening", "exploration", "bargaining", "closure"];
  }

  private designMeetingStructure(): unknown {
    return {
      duration: "2-3 hours per session",
      frequency: "weekly",
      format: "structured_agenda",
      participation: "all_stakeholders",
    };
  }

  private establishGroundRules(): string[] {
    return [
      "respectful communication",
      "focus on interests not positions",
      "confidentiality agreement",
      "decision-making process clarity",
    ];
  }

  private selectFacilitationApproach(): string {
    return "neutral_facilitation";
  }

  private designCommunicationProtocol(): unknown {
    return {
      channels: ["meetings", "email", "documentation"],
      frequency: "regular_updates",
      format: "structured_reporting",
    };
  }

  private establishDecisionMakingProcess(): string {
    return "consensus_with_fallback_voting";
  }

  private createOpeningFramework(): unknown {
    return {
      agendasetting: "collaborative",
      expectationalignment: "explicit",
      groundrules: "agreed_upon",
    };
  }

  private developDialogueGuides(): string[] {
    return [
      "open_ended_questions",
      "reflective_listening",
      "summarization_techniques",
    ];
  }

  private designConflictResolutionMethods(): string[] {
    return [
      "reframing",
      "perspective_taking",
      "option_generation",
      "criteria_development",
    ];
  }

  private createMomentumMaintenance(): string[] {
    return ["progress_tracking", "quick_wins", "milestone_celebration"];
  }

  private designBreakdownPrevention(): string[] {
    return [
      "early_warning_indicators",
      "cooling_off_periods",
      "alternative_formats",
    ];
  }

  private assessConsensusLevel(_context: ModeContext): number {
    return 0.75; // Simplified assessment
  }

  private selectConsensusBuilding(): string[] {
    return ["facilitated_discussion", "option_ranking", "trade_off_analysis"];
  }

  private identifyConsensusBarriers(_context: ModeContext): string[] {
    return ["conflicting_priorities", "resource_constraints", "time_pressure"];
  }

  private identifyConsensusFacilitators(_context: ModeContext): string[] {
    return ["shared_goals", "mutual_respect", "clear_communication"];
  }

  private estimateConsensusTimeline(_context: ModeContext): string {
    return "2-3 weeks";
  }

  private generateFrameworkTerms(_context: ModeContext): string[] {
    return [
      "collaboration_principles",
      "communication_protocols",
      "decision_making_process",
    ];
  }

  private generateOperationalTerms(_context: ModeContext): string[] {
    return ["role_definitions", "process_workflows", "quality_standards"];
  }

  private assessStakeholderSatisfaction(_pipeline: unknown): unknown {
    return {
      individual: [0.8, 0.75, 0.85, 0.9],
      average: 0.825,
      distribution: "generally_positive",
    };
  }

  private calculateEffectiveness(_pipeline: unknown): number {
    return 0.8; // Simplified calculation
  }

  private generateRecommendations(_pipeline: unknown): string[] {
    return [
      "Document agreed-upon decisions clearly",
      "Establish regular follow-up meetings",
      "Create escalation procedures for future conflicts",
      "Build relationship maintenance into process",
    ];
  }

  private isRelevantToContext(_key: string, context: ModeContext): boolean {
    return (
      _key.includes(context.metadata?.domain || "") ||
      key.includes(context.metadata?.stakeholders || "")
    );
  }

  private generateNegotiationKey(results: unknown): string {
    return `negotiation_${results.strategy.type}_${Date.now()}`;
  }
}
