import { BaseMode } from "../base/BaseMode";
import { ModeConfig, ModeContext, ModeResult } from "../types/ModeTypes";
import { EventEmitter } from "node:events";

/**
 * Exploring Mode - Curious investigation and knowledge discovery
 * Provides systematic exploration methodologies with discovery-oriented learning
 */
export class ExploringMode extends BaseMode {
  private explorationHistory: Map<string, any> = new Map();
  private discoveryPatterns: unknown[] = [];
  private curiosityLevel: number = 0.8;

  constructor(_eventEmitter: EventEmitter) {
    super(_eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: "exploring",
      name: "Exploring Mode",
      category: "learning",
      description:
        "Curious investigation and systematic knowledge discovery with exploration-driven learning",
      _keywords: [
        "explore",
        "discover",
        "investigate",
        "examine",
        "probe",
        "search",
        "uncover",
        "venture",
      ],
      triggers: [
        "explore this",
        "discover how",
        "investigate",
        "what happens if",
        "let me check",
        "examine",
      ],
      examples: [
        "Explore the possibilities of this new technology",
        "Discover how this system works internally",
        "Investigate the relationship between these components",
        "Examine what happens when we change this parameter",
      ],
      priority: 70,
      timeout: 75000,
      retryAttempts: 3,
      validation: {
        minInputLength: 15,
        maxInputLength: 10000,
        requiredContext: ["exploration_target", "discovery_goal"],
      },
    };
  }

  async onActivate(context: ModeContext): Promise<void> {
    this.emit("modeActivated", {
      mode: this.config.id,
      timestamp: Date.now(),
      context: context.id,
    });

    this.updateMetrics({
      activationTime: Date.now(),
      explorationScope: this.determineExplorationScope(context),
      curiosityIndex: this.calculateCuriosityIndex(context),
      discoveryPotential: this.assessDiscoveryPotential(context),
    });

    await this.initializeExplorationFramework(context);
  }

  async onDeactivate(): Promise<void> {
    await this.catalogDiscoveries();

    this.emit("modeDeactivated", {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      discoveriesMade: this.metrics.discoveryCount || 0,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const _startTime = Date.now();

    try {
      const _explorationResults =
        await this.executeExplorationPipeline(context);

      const _processingTime = Date.now() - _startTime;

      this.updateMetrics({
        totalProcessingTime: _processingTime,
        explorationDepth: _explorationResults.depth,
        discoveryCount: _explorationResults.discoveries.length,
        insightQuality: _explorationResults.insights.quality,
        knowledgeExpansion: _explorationResults.expansion.scope,
        lastProcessedAt: Date.now(),
      });

      return {
        success: true,
        data: _explorationResults,
        confidence: this.calculateConfidence(context, _explorationResults),
        _processingTime,
        metadata: {
          explorationMethod: _explorationResults.method,
          discoveriesFound: _explorationResults.discoveries.length,
          pathsExplored: _explorationResults.paths.length,
          curiosityLevel: this.curiosityLevel,
          knowledgeGained: _explorationResults.knowledge.gained,
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

    const _keywords = this.config._keywords;
    const _input = context._input.toLowerCase();
    const _keywordMatches = _keywords.filter((keyword) =>
      _input.includes(keyword),
    );
    confidence += _keywordMatches.length * 0.14;

    const _explorationPatterns = [
      /explore\s+.+/i,
      /discover\s+.+/i,
      /investigate\s+.+/i,
      /what\s+happens\s+if\s+.+/i,
      /let\s+me\s+check\s+.+/i,
      /examine\s+.+/i,
      /probe\s+.+/i,
      /venture\s+into\s+.+/i,
    ];

    const _patternMatches = _explorationPatterns.filter((pattern) =>
      pattern.test(_input),
    );
    confidence += _patternMatches.length * 0.17;

    const _curiosityIndicators = [
      "what",
      "how",
      "why",
      "where",
      "when",
      "curious",
      "wonder",
    ];
    const _curiosityMatches = _curiosityIndicators.filter((indicator) =>
      _input.includes(indicator),
    );
    confidence += _curiosityMatches.length * 0.08;

    if (context.metadata?.requiresExploration) {
      confidence += 0.25;
    }
    if (context.metadata?.unknownTerritory) {
      confidence += 0.2;
    }
    if (context.metadata?.discoveryOpportunity) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  private async executeExplorationPipeline(
    context: ModeContext,
  ): Promise<unknown> {
    const _pipeline = {
      scopeDefinition: await this.defineExplorationScope(context),
      pathMapping: await this.mapExplorationPaths(context),
      systematicExploration: await this.conductSystematicExploration(context),
      discoveryProcessing: await this.processDiscoveries(context),
      insightExtraction: await this.extractInsights(context),
      knowledgeIntegration: await this.integrateKnowledge(context),
      curiosityRefinement: await this.refineCuriosity(context),
    };

    return {
      method: "systematic_curiosity_driven_exploration",
      scope: _pipeline.scopeDefinition,
      paths: _pipeline.pathMapping,
      exploration: _pipeline.systematicExploration,
      discoveries: _pipeline.discoveryProcessing,
      insights: _pipeline.insightExtraction,
      knowledge: _pipeline.knowledgeIntegration,
      expansion: this.assessKnowledgeExpansion(_pipeline),
      depth: this.calculateExplorationDepth(_pipeline),
      recommendations: this.generateExplorationRecommendations(_pipeline),
    };
  }

  private async initializeExplorationFramework(
    context: ModeContext,
  ): Promise<void> {
    this.curiosityLevel = this.calculateCuriosityIndex(context);
    this.updateMetrics({ frameworkInitialized: Date.now() });
  }

  private async catalogDiscoveries(): Promise<void> {
    // Catalog discoveries for future reference
  }

  private async defineExplorationScope(context: ModeContext): Promise<unknown> {
    return {
      target: this.identifyExplorationTarget(context.input),
      boundaries: this.defineBoundaries(context.input),
      constraints: this.identifyConstraints(context.input),
      objectives: this.defineObjectives(context.input),
      depthlimits: this.determineDepthLimits(context.input),
    };
  }

  private async mapExplorationPaths(_context: ModeContext): Promise<unknown[]> {
    return [
      {
        id: "primary_path",
        direction: "direct_investigation",
        priority: "high",
        estimatedeffort: "medium",
        discoverypotential: "high",
      },
      {
        id: "lateral_path",
        direction: "lateral_thinking",
        priority: "medium",
        estimatedeffort: "low",
        discoverypotential: "medium",
      },
      {
        id: "deep_dive_path",
        direction: "deep_investigation",
        priority: "medium",
        estimatedeffort: "high",
        discoverypotential: "very_high",
      },
    ];
  }

  private async conductSystematicExploration(
    context: ModeContext,
  ): Promise<unknown> {
    return {
      methodology: "breadth_first_with_selective_depth",
      coverage: this.calculateCoverage(context),
      thoroughness: this.assessThoroughness(context),
      serendipityallowance: this.calculateSerendipityFactor(context),
      progresstracking: this.trackExplorationProgress(context),
    };
  }

  private async processDiscoveries(_context: ModeContext): Promise<unknown[]> {
    return [
      {
        type: "factual_discovery",
        content: "New factual information uncovered",
        significance: "medium",
        verificationstatus: "pending",
        implications: ["affects_understanding", "opens_new_questions"],
      },
      {
        type: "pattern_discovery",
        content: "Recurring pattern identified",
        significance: "high",
        verificationstatus: "confirmed",
        implications: ["predictive_value", "generalizable_principle"],
      },
      {
        type: "connection_discovery",
        content: "Unexpected connection found",
        significance: "high",
        verificationstatus: "provisional",
        implications: ["paradigm_shift", "new_research_direction"],
      },
    ];
  }

  private async extractInsights(context: ModeContext): Promise<unknown> {
    return {
      quality: 0.82,
      insights: [
        {
          type: "structural_insight",
          content: "System exhibits emergent properties at scale",
          confidence: 0.85,
        },
        {
          type: "behavioral_insight",
          content: "Component interactions follow predictable patterns",
          confidence: 0.78,
        },
      ],
      novelperspectives: this.identifyNovelPerspectives(context),
      paradigmshifts: this.identifyParadigmShifts(context),
    };
  }

  private async integrateKnowledge(context: ModeContext): Promise<unknown> {
    return {
      gained: this.calculateKnowledgeGained(context),
      integrationquality: 0.8,
      knowledgegaps_filled: this.identifyFilledGaps(context),
      newquestions_generated: this.generateNewQuestions(context),
      conceptualframeworks_updated: this.updateConceptualFrameworks(context),
    };
  }

  private async refineCuriosity(context: ModeContext): Promise<unknown> {
    return {
      enhancedareas: this.identifyEnhancedCuriosity(context),
      newinterests: this.identifyNewInterests(context),
      questionrefinement: this.refineQuestions(context),
      explorationpriorities: this.updateExplorationPriorities(context),
    };
  }

  private determineExplorationScope(context: ModeContext): string {
    const _wordCount = context.input.split(/\s+/).length;
    if (_wordCount > 150) {
      return "comprehensive";
    }
    if (_wordCount > 75) {
      return "moderate";
    }
    return "focused";
  }

  private calculateCuriosityIndex(context: ModeContext): number {
    const _curiosityIndicators = [
      context.input.includes("?"),
      context.input.includes("wonder"),
      context.input.includes("curious"),
      context.input.includes("what if"),
      context.input.includes("how about"),
    ];
    return (
      _curiosityIndicators.filter(Boolean).length / _curiosityIndicators.length
    );
  }

  private assessDiscoveryPotential(_context: ModeContext): number {
    return 0.75 + Math.random() * 0.2;
  }

  private calculateConfidence(_context: ModeContext, results: unknown): number {
    let confidence = 0.72;

    if (results.discoveries.length > 2) {
      confidence += 0.1;
    }
    if (results.insights.quality > 0.8) {
      confidence += 0.08;
    }
    if (results.depth > 0.7) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private generateExplorationRecommendations(_pipeline: unknown): string[] {
    return [
      "Continue exploring high-potential paths identified",
      "Document discoveries for future reference",
      "Validate findings through independent verification",
      "Share insights with relevant stakeholders",
    ];
  }

  // Helper methods
  private identifyExplorationTarget(_input: string): string {
    return _input.split(" ").slice(0, 5).join(" ");
  }

  private defineBoundaries(_input: string): string[] {
    return ["scope_limitations", "resource_constraints", "time_boundaries"];
  }

  private identifyConstraints(_input: string): string[] {
    return [
      "ethical_considerations",
      "technical_limitations",
      "access_restrictions",
    ];
  }

  private defineObjectives(_input: string): string[] {
    return [
      "knowledge_acquisition",
      "pattern_identification",
      "insight_generation",
    ];
  }

  private determineDepthLimits(_input: string): unknown {
    return {
      maximumdepth: "detailed_investigation",
      stoppingcriteria: "diminishing_returns_or_time_limit",
    };
  }

  private calculateCoverage(_context: ModeContext): number {
    return 0.75;
  }

  private assessThoroughness(_context: ModeContext): number {
    return 0.8;
  }

  private calculateSerendipityFactor(_context: ModeContext): number {
    return this.curiosityLevel * 0.5;
  }

  private trackExplorationProgress(_context: ModeContext): unknown {
    return {
      milestonesreached: 3,
      pathscompleted: 2,
      discoveriesmade: 5,
      insightsgenerated: 3,
    };
  }

  private identifyNovelPerspectives(_context: ModeContext): string[] {
    return ["alternative_viewpoint_1", "unconventional_angle_2"];
  }

  private identifyParadigmShifts(_context: ModeContext): string[] {
    return ["fundamental_assumption_challenged"];
  }

  private calculateKnowledgeGained(_context: ModeContext): unknown {
    return {
      factual: "significant_new_facts",
      conceptual: "enhanced_understanding",
      procedural: "improved_methods",
      meta: "learning_about_learning",
    };
  }

  private identifyFilledGaps(_context: ModeContext): string[] {
    return ["knowledge_gap_1", "understanding_gap_2"];
  }

  private generateNewQuestions(_context: ModeContext): string[] {
    return [
      "How does this scale to larger systems?",
      "What are the long-term implications?",
      "Are there similar patterns elsewhere?",
    ];
  }

  private updateConceptualFrameworks(_context: ModeContext): unknown {
    return {
      frameworksmodified: 2,
      newframeworks_created: 1,
      integrationquality: 0.85,
    };
  }

  private identifyEnhancedCuriosity(_context: ModeContext): string[] {
    return ["system_dynamics", "emergent_properties", "scaling_behaviors"];
  }

  private identifyNewInterests(_context: ModeContext): string[] {
    return ["related_domain_1", "adjacent_field_2"];
  }

  private refineQuestions(_context: ModeContext): string[] {
    return [
      "More specific question about mechanism",
      "Deeper inquiry into relationships",
      "Broader question about implications",
    ];
  }

  private updateExplorationPriorities(_context: ModeContext): unknown {
    return {
      highpriority: ["follow_up_on_key_discovery"],
      mediumpriority: ["investigate_side_findings"],
      lowpriority: ["explore_tangential_areas"],
    };
  }

  private assessKnowledgeExpansion(_pipeline: unknown): unknown {
    return {
      scope: "significant_expansion",
      depth: "moderate_to_deep",
      breadth: "lateral_connections_made",
      integration: "well_integrated_with_existing_knowledge",
    };
  }

  private calculateExplorationDepth(_pipeline: unknown): number {
    return 0.78;
  }
}
