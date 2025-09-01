/**
 * Facilitating Mode Plugin - Team facilitation and collaboration mode
 * Specialized for guiding group discussions, mediating conflicts, and enabling effective collaboration
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from "../BaseMode";

export default class FacilitatingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: "facilitating",
      name: "Facilitating",
      category: "collaborative",
      symbol: "🤝",
      color: "green",
      description: "ファシリテーションモード - チーム促進と協働支援",
      keywords: [
        "facilitate",
        "guide",
        "moderate",
        "coordinate",
        "mediate",
        "enable",
        "support",
        "help team",
        "collaboration",
        "discussion",
      ],
      triggers: [
        "facilitate",
        "help the team",
        "guide discussion",
        "coordinate",
        "moderate meeting",
        "enable collaboration",
        "team needs",
      ],
      examples: [
        "Facilitate a team discussion about priorities",
        "Help coordinate the project planning session",
        "Guide the team through decision making",
        "Moderate a conflict resolution meeting",
        "Enable effective collaboration between departments",
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

    this.emit("display:update", {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: "Facilitating...",
      color: this.config.color,
      sessionId: context.sessionId,
    });

    this.emit("analytics:event", {
      type: "mode_activation",
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
    console.log(
      `[${this.config.id}] Deactivating facilitating mode for session ${sessionId}`,
    );

    this.emit("analytics:event", {
      type: "mode_deactivation",
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(
    _input: string,
    context: ModeContext,
  ): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing facilitation request: "${_input.substring(0, 50)}..."`,
    );

    // Facilitation _process pipeline
    const _situationAnalysis = await this.analyzeSituation(_input, context);
    const _stakeholderMap = await this.mapStakeholders(
      _input,
      _situationAnalysis,
    );
    const _facilitationStrategy = await this.designFacilitationStrategy(
      _input,
      _stakeholderMap,
    );
    const _processDesign = await this.designCollaborativeProcess(
      _input,
      _facilitationStrategy,
    );
    const _interventions = await this.planInterventions(_input, _processDesign);
    const _outcomes = await this.projectOutcomes(_input, _interventions);

    const _suggestions = await this.generateFacilitationSuggestions(
      _input,
      _outcomes,
    );
    const _nextMode = await this.determineNextMode(_input, _outcomes);

    return {
      success: true,
      output: this.formatFacilitationPlan(
        _situationAnalysis,
        _processDesign,
        _interventions,
        _outcomes,
      ),
      _suggestions,
      nextRecommendedMode: _nextMode,
      confidence: 0.89,
      metadata: {
        situationType: _situationAnalysis.type,
        _stakeholderCount: _stakeholderMap.count,
        _strategyType: _facilitationStrategy.type,
        interventionCount: _interventions.length,
        processComplexity: _processDesign.complexity,
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    _context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.2;

    const _inputLower = input.toLowerCase();

    // Direct facilitation keywords
    const _facilitationKeywords = [
      "facilitate",
      "guide",
      "moderate",
      "coordinate",
      "mediate",
      "enable",
      "support",
      "help team",
      "collaboration",
    ];

    const _facilitationMatches = _facilitationKeywords.filter((keyword) =>
      inputLower.includes(keyword),
    );
    if (_facilitationMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(
        `Facilitation keywords: ${_facilitationMatches.join(", ")}`,
      );
    }

    // Team and group indicators
    const _teamIndicators = [
      "team",
      "group",
      "meeting",
      "discussion",
      "session",
      "workshop",
      "collaboration",
      "_stakeholders",
    ];

    const _teamMatches = _teamIndicators.filter((indicator) =>
      _inputLower.includes(indicator),
    );
    if (_teamMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(`Team/group indicators: ${_teamMatches.join(", ")}`);
    }

    // Process and structure words
    const _processWords = [
      "_process",
      "structure",
      "framework",
      "agenda",
      "organize",
      "plan",
      "schedule",
      "coordinate",
      "manage",
    ];

    const _processMatches = _processWords.filter((word) =>
      _inputLower.includes(word),
    );
    if (_processMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Process structure words: ${_processMatches.join(", ")}`);
    }

    // Conflict or challenge indicators
    const _challengeIndicators = [
      "conflict",
      "disagreement",
      "tension",
      "challenge",
      "difficult",
      "stuck",
      "blocked",
      "deadlock",
      "issue",
    ];

    const _challengeMatches = _challengeIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    );
    if (_challengeMatches.length > 0) {
      confidence += 0.25;
      reasoning.push(`Challenge/conflict indicators suggest facilitation need`);
    }

    // Decision-making context
    const _decisionIndicators = [
      "decide",
      "choice",
      "option",
      "alternative",
      "consensus",
      "agreement",
      "vote",
      "select",
    ];

    const _decisionMatches = _decisionIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    );
    if (_decisionMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Decision-making context detected`);
    }

    // Multiple people/perspectives mentioned
    const _peopleIndicators = ["we", "us", "everyone", "all", "both", "each"];
    const _peopleMatches = _peopleIndicators.filter((indicator) =>
      _inputLower.includes(indicator),
    );
    if (_peopleMatches.length > 0) {
      confidence += 0.1;
      reasoning.push("Multiple perspectives context");
    }

    // Questions that suggest facilitation need
    const _facilitationQuestions = [
      /how.*get.*team/i,
      /how.*coordinate/i,
      /how.*manage.*meeting/i,
      /how.*resolve.*conflict/i,
      /how.*reach.*consensus/i,
    ];

    const _questionMatches = _facilitationQuestions.filter((pattern) =>
      pattern.test(input),
    );
    if (_questionMatches.length > 0) {
      confidence += 0.2;
      reasoning.push("Facilitation-oriented questions detected");
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze the collaborative situation
   */
  private async analyzeSituation(
    _input: string,
    _context: ModeContext,
  ): Promise<unknown> {
    const _analysis = {
      type: this.classifySituationType(_input),
      complexity: this.assessSituationComplexity(_input),
      urgency: this.assessUrgency(_input),
      scope: this.determineSituationScope(_input),
      constraints: this.identifyConstraints(_input),
      opportunities: this.identifyOpportunities(_input),
      risks: this.assessCollaborationRisks(_input),
    };

    return _analysis;
  }

  /**
   * Map _stakeholders and their interests
   */
  private async mapStakeholders(
    _input: string,
    _situation: unknown,
  ): Promise<unknown> {
    const _stakeholders = this.identifyStakeholders(_input);

    const _stakeholderMap = {
      count: _stakeholders.length,
      primary: _stakeholders.filter((s) => s.influence === "high"),
      secondary: _stakeholders.filter((s) => s.influence === "medium"),
      interests: this.mapStakeholderInterests(_stakeholders),
      relationships: this.analyzeStakeholderRelationships(_stakeholders),
      powerdynamics: this.assessPowerDynamics(_stakeholders),
    };

    return _stakeholderMap;
  }

  /**
   * Design facilitation strategy
   */
  private async designFacilitationStrategy(
    input: string,
    _stakeholderMap: unknown,
  ): Promise<unknown> {
    const _strategies = {
      directive: "Lead with clear structure and guidance",
      collaborative: "Enable equal participation and shared decision-making",
      consultative: "Gather input and provide expert recommendations",
      delegative: "Empower team to self-organize and decide",
      mediative: "Focus on conflict resolution and consensus building",
    };

    const _strategyType = this.selectFacilitationStrategy(
      input,
      _stakeholderMap,
    );

    return {
      type: _strategyType,
      description: _strategies[_strategyType],
      _principles: this.defineFacilitationPrinciples(_strategyType),
      _techniques: this.selectFacilitationTechniques(_strategyType),
      tools: this.recommendFacilitationTools(_strategyType),
    };
  }

  /**
   * Design collaborative _process
   */
  private async designCollaborativeProcess(
    _input: string,
    strategy: unknown,
  ): Promise<unknown> {
    const _process = {
      phases: this.designProcessPhases(_input, strategy),
      timeline: this.estimateProcessTimeline(_input),
      structure: this.defineProcessStructure(_input, strategy),
      complexity: this.assessProcessComplexity(_input),
      checkpoints: this.defineProcessCheckpoints(_input),
      deliverables: this.identifyProcessDeliverables(_input),
    };

    return _process;
  }

  /**
   * Plan specific _interventions
   */
  private async planInterventions(
    _input: string,
    _processDesign: unknown,
  ): Promise<unknown[]> {
    const _interventions: unknown[] = [];

    // Opening _interventions
    interventions.push({
      type: "opening",
      name: "Set Context and Expectations",
      timing: "start",
      description: "Establish purpose, agenda, and ground rules",
      _techniques: ["check-in", "agenda review", "ground rules setting"],
    });

    // Process _interventions
    if (this.needsStructure(_input)) {
      interventions.push({
        type: "structure",
        name: "Provide Process Structure",
        timing: "ongoing",
        description: "Guide through structured decision-making _process",
        _techniques: ["timeboxing", "parking lot", "_process checks"],
      });
    }

    if (this.hasConflict(_input)) {
      interventions.push({
        type: "conflict",
        name: "Address Conflicts Constructively",
        timing: "as-needed",
        description: "Mediate disagreements and find common ground",
        _techniques: [
          "reframing",
          "perspective taking",
          "interest identification",
        ],
      });
    }

    // Participation _interventions
    interventions.push({
      type: "participation",
      name: "Ensure Inclusive Participation",
      timing: "ongoing",
      description: "Draw out quiet voices and manage dominant participants",
      _techniques: [
        "round robin",
        "silent brainstorming",
        "nominal group technique",
      ],
    });

    // Closing _interventions
    interventions.push({
      type: "closing",
      name: "Synthesize and Close",
      timing: "end",
      description: "Summarize _outcomes and plan next steps",
      _techniques: ["synthesis", "action planning", "check-out"],
    });

    return _interventions;
  }

  /**
   * Project expected _outcomes
   */
  private async projectOutcomes(
    _input: string,
    _interventions: unknown[],
  ): Promise<unknown> {
    const _outcomes = {
      primary: this.identifyPrimaryOutcomes(_input),
      secondary: this.identifySecondaryOutcomes(_input),
      successindicators: this.defineSuccessIndicators(_input),
      potentialchallenges: this.anticipateChallenges(_input, _interventions),
      followup_actions: this.planFollowUpActions(_input),
      learningopportunities: this.identifyLearningOpportunities(_input),
    };

    return _outcomes;
  }

  /**
   * Format facilitation plan
   */
  private formatFacilitationPlan(
    situation: unknown,
    _process: unknown,
    _interventions: unknown[],
    _outcomes: unknown,
  ): string {
    const output: string[] = [];

    output.push("Facilitation Plan");
    output.push("═".repeat(17));
    output.push("");

    output.push("Situation Analysis:");
    output.push(`Type: ${situation.type}`);
    output.push(`Complexity: ${situation.complexity}`);
    output.push(`Urgency: ${situation.urgency}`);
    output.push("");

    output.push("Process Design:");
    output.push("Phases:");
    process.phases.forEach((_phase: string, index: number) => {
      output.push(`${index + 1}. ${_phase}`);
    });
    output.push(`Timeline: ${_process.timeline}`);
    output.push("");

    output.push("Key Interventions:");
    interventions.slice(0, 4).forEach((intervention, _index) => {
      output.push(`${_index + 1}. ${intervention.name}`);
      output.push(`   Purpose: ${intervention.description}`);
      output.push(`   Timing: ${intervention.timing}`);
      output.push("");
    });

    output.push("Expected Outcomes:");
    outcomes.primary.forEach((_outcome: string) => {
      output.push(`• ${_outcome}`);
    });
    output.push("");

    output.push("Success Indicators:");
    outcomes.success_indicators.slice(0, 3).forEach((_indicator: string) => {
      output.push(`• ${_indicator}`);
    });

    return output.join("\n");
  }

  /**
   * Generate facilitation _suggestions
   */
  private async generateFacilitationSuggestions(
    input: string,
    _outcomes: unknown,
  ): Promise<string[]> {
    const _suggestions: string[] = [];

    _suggestions.push("Prepare detailed agenda with time allocations");
    suggestions.push("Set clear ground rules for participation");

    if (this.hasConflict(input)) {
      suggestions.push("Prepare conflict resolution _techniques");
    }

    if (this.hasComplexDecision(input)) {
      suggestions.push("Use structured decision-making frameworks");
    }

    suggestions.push("Plan for follow-up and accountability");

    return _suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(
    _input: string,
    _outcomes: unknown,
  ): Promise<string | undefined> {
    const _inputLower = _input.toLowerCase();

    if (_inputLower.includes("implement") || _inputLower.includes("execute")) {
      return "organizing";
    }

    if (_inputLower.includes("document") || _inputLower.includes("record")) {
      return "summarizing";
    }

    if (
      _inputLower.includes("follow up") ||
      _inputLower.includes("next steps")
    ) {
      return "planning";
    }

    return "reflecting";
  }

  // Helper methods
  private classifySituationType(input: string): string {
    const _inputLower = input.toLowerCase();

    if (
      _inputLower.includes("conflict") ||
      _inputLower.includes("disagreement")
    ) {
      return "conflict_resolution";
    }
    if (_inputLower.includes("decision") || _inputLower.includes("choose")) {
      return "decision_making";
    }
    if (
      _inputLower.includes("brainstorm") ||
      _inputLower.includes("creative")
    ) {
      return "creative_collaboration";
    }
    if (_inputLower.includes("plan") || _inputLower.includes("strategy")) {
      return "planning_session";
    }
    if (_inputLower.includes("problem") || _inputLower.includes("solve")) {
      return "problem_solving";
    }

    return "general_collaboration";
  }

  private assessSituationComplexity(input: string): string {
    const _wordCount = input.split(/\s+/).length;
    const _stakeholderCount = this.countStakeholderReferences(input);

    if (_wordCount > 100 || _stakeholderCount > 5) {
      return "high";
    }
    if (_wordCount > 50 || _stakeholderCount > 3) {
      return "medium";
    }
    return "low";
  }

  private assessUrgency(input: string): string {
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("urgent") || _inputLower.includes("asap")) {
      return "high";
    }
    if (_inputLower.includes("soon") || _inputLower.includes("quickly")) {
      return "medium";
    }
    return "low";
  }

  private determineSituationScope(input: string): string {
    const _inputLower = input.toLowerCase();

    if (
      _inputLower.includes("department") ||
      _inputLower.includes("organization")
    ) {
      return "organizational";
    }
    if (_inputLower.includes("project") || _inputLower.includes("initiative")) {
      return "project";
    }
    if (_inputLower.includes("team") || _inputLower.includes("group")) {
      return "team";
    }
    return "individual";
  }

  private identifyConstraints(input: string): string[] {
    const constraints: string[] = [];
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("time")) {
      constraints.push("time limitations");
    }
    if (_inputLower.includes("budget")) {
      constraints.push("budget constraints");
    }
    if (_inputLower.includes("resource")) {
      constraints.push("resource limitations");
    }
    if (_inputLower.includes("remote")) {
      constraints.push("remote collaboration");
    }

    return constraints;
  }

  private identifyOpportunities(_input: string): string[] {
    return [
      "Build stronger team relationships",
      "Improve collaboration processes",
      "Develop shared understanding",
      "Create alignment on goals",
    ];
  }

  private assessCollaborationRisks(input: string): string[] {
    const risks: string[] = [];
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("conflict")) {
      risks.push("unresolved conflicts");
    }
    if (_inputLower.includes("deadline")) {
      risks.push("time pressure");
    }
    if (_inputLower.includes("complex")) {
      risks.push("_process complexity");
    }

    risks.push("participant disengagement");
    return risks;
  }

  private identifyStakeholders(input: string): unknown[] {
    const _stakeholders: unknown[] = [];
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("team")) {
      stakeholders.push({
        name: "Team Members",
        influence: "high",
        interest: "high",
      });
    }
    if (_inputLower.includes("manager")) {
      stakeholders.push({
        name: "Management",
        influence: "high",
        interest: "medium",
      });
    }
    if (_inputLower.includes("customer")) {
      stakeholders.push({
        name: "Customers",
        influence: "medium",
        interest: "high",
      });
    }

    // Default _stakeholders if none identified
    if (_stakeholders.length === 0) {
      stakeholders.push({
        name: "Participants",
        influence: "high",
        interest: "high",
      });
    }

    return _stakeholders;
  }

  private mapStakeholderInterests(_stakeholders: unknown[]): unknown {
    return _stakeholders.reduce((interests, stakeholder) => {
      interests[stakeholder.name] = [
        "successful _outcomes",
        "efficient _process",
      ];
      return interests;
    }, {});
  }

  private analyzeStakeholderRelationships(_stakeholders: unknown[]): string[] {
    return ["cooperative", "collaborative", "potentially competitive"];
  }

  private assessPowerDynamics(_stakeholders: unknown[]): string {
    const _highInfluence = _stakeholders.filter(
      (s) => s.influence === "high",
    ).length;

    if (_highInfluence > 2) {
      return "complex";
    }
    if (_highInfluence > 1) {
      return "moderate";
    }
    return "simple";
  }

  private selectFacilitationStrategy(
    _input: string,
    _stakeholderMap: unknown,
  ): string {
    const _inputLower = _input.toLowerCase();

    if (_inputLower.includes("conflict")) {
      return "mediative";
    }
    if (_stakeholderMap.power_dynamics === "complex") {
      return "consultative";
    }
    if (
      _inputLower.includes("creative") ||
      _inputLower.includes("brainstorm")
    ) {
      return "collaborative";
    }
    if (_inputLower.includes("urgent")) {
      return "directive";
    }

    return "collaborative";
  }

  private defineFacilitationPrinciples(_strategyType: string): string[] {
    const _principles = {
      directive: [
        "Clear leadership",
        "Structured _process",
        "Efficient _outcomes",
      ],
      collaborative: [
        "Equal participation",
        "Shared ownership",
        "Consensus building",
      ],
      consultative: [
        "Expert guidance",
        "Informed decisions",
        "Stakeholder input",
      ],
      delegative: ["Self-organization", "Empowerment", "Autonomy"],
      mediative: ["Neutral stance", "Conflict resolution", "Win-win solutions"],
    };

    return _principles[_strategyType] || _principles["collaborative"];
  }

  private selectFacilitationTechniques(_strategyType: string): string[] {
    const _techniques = {
      directive: ["Agenda management", "Time boxing", "Decision forcing"],
      collaborative: ["Open discussion", "Consensus building", "Brainstorming"],
      consultative: [
        "Expert input",
        "Options _analysis",
        "Recommendation synthesis",
      ],
      delegative: [
        "Self-facilitation",
        "Minimal intervention",
        "Support on request",
      ],
      mediative: ["Active listening", "Reframing", "Interest identification"],
    };

    return _techniques[_strategyType] || _techniques["collaborative"];
  }

  private recommendFacilitationTools(_strategyType: string): string[] {
    return [
      "Shared agenda",
      "Decision matrix",
      "Action _item tracker",
      "Ground rules charter",
    ];
  }

  private designProcessPhases(_input: string, strategy: unknown): string[] {
    const _basePhases = [
      "Opening & Context Setting",
      "Information Gathering",
      "Analysis & Discussion",
      "Decision Making",
      "Action Planning",
      "Closing & Next Steps",
    ];

    if (strategy.type === "mediative") {
      basePhases.splice(2, 0, "Conflict Exploration");
    }

    return _basePhases;
  }

  private estimateProcessTimeline(input: string): string {
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("quick") || _inputLower.includes("brief")) {
      return "30-60 minutes";
    }
    if (_inputLower.includes("workshop") || _inputLower.includes("session")) {
      return "2-4 hours";
    }
    if (_inputLower.includes("retreat") || _inputLower.includes("intensive")) {
      return "1-2 days";
    }

    return "1-2 hours";
  }

  private defineProcessStructure(_input: string, strategy: unknown): string {
    return strategy.type === "directive"
      ? "highly structured"
      : "flexible with guidelines";
  }

  private assessProcessComplexity(input: string): string {
    return this.assessSituationComplexity(input);
  }

  private defineProcessCheckpoints(_input: string): string[] {
    return ["Mid-point check", "Decision confirmation", "Action review"];
  }

  private identifyProcessDeliverables(_input: string): string[] {
    return [
      "Meeting summary",
      "Decision record",
      "Action _item list",
      "Next steps plan",
    ];
  }

  private needsStructure(input: string): boolean {
    const _inputLower = input.toLowerCase();
    return (
      _inputLower.includes("complex") ||
      _inputLower.includes("organize") ||
      inputLower.includes("structure")
    );
  }

  private hasConflict(input: string): boolean {
    const _inputLower = input.toLowerCase();
    return (
      _inputLower.includes("conflict") ||
      _inputLower.includes("disagreement") ||
      inputLower.includes("tension")
    );
  }

  private hasComplexDecision(input: string): boolean {
    const _inputLower = input.toLowerCase();
    return (
      inputLower.includes("decision") &&
      (_inputLower.includes("complex") || _inputLower.includes("difficult"))
    );
  }

  private identifyPrimaryOutcomes(input: string): string[] {
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("decision")) {
      return ["Clear decision made", "Stakeholder buy-in achieved"];
    }
    if (_inputLower.includes("plan")) {
      return ["Actionable plan created", "Roles and responsibilities defined"];
    }
    if (_inputLower.includes("problem")) {
      return ["Problem clearly defined", "Solution options identified"];
    }

    return ["Clear _outcomes achieved", "Team alignment established"];
  }

  private identifySecondaryOutcomes(_input: string): string[] {
    return [
      "Improved team communication",
      "Enhanced collaboration skills",
      "Stronger working relationships",
      "Better _process understanding",
    ];
  }

  private defineSuccessIndicators(_input: string): string[] {
    return [
      "All participants actively engaged",
      "Clear decisions and next steps documented",
      "Positive participant feedback",
      "Objectives achieved within timeframe",
    ];
  }

  private anticipateChallenges(
    _input: string,
    _interventions: unknown[],
  ): string[] {
    return [
      "Managing different perspectives",
      "Keeping discussion focused",
      "Ensuring equal participation",
      "Making decisions within time constraints",
    ];
  }

  private planFollowUpActions(_input: string): string[] {
    return [
      "Send meeting summary to all participants",
      "Schedule follow-up check-ins",
      "Monitor progress on action items",
      "Gather feedback on _process effectiveness",
    ];
  }

  private identifyLearningOpportunities(_input: string): string[] {
    return [
      "Team collaboration skills development",
      "Process improvement insights",
      "Stakeholder relationship building",
      "Conflict resolution capabilities",
    ];
  }

  private countStakeholderReferences(input: string): number {
    const _stakeholderTerms = [
      "team",
      "group",
      "people",
      "members",
      "participants",
      "_stakeholders",
    ];
    return _stakeholderTerms.filter((term) =>
      input.toLowerCase().includes(term),
    ).length;
  }
}
