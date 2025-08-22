import { BaseMode } from '../base/BaseMode';
import { ModeConfig, ModeContext, ModeResult } from '../types/ModeTypes';
import { EventEmitter } from 'events';

/**
 * Exploring Mode - Curious investigation and knowledge discovery
 * Provides systematic exploration methodologies with discovery-oriented learning
 */
export class ExploringMode extends BaseMode {
  private explorationHistory: Map<string, any> = new Map();
  private discoveryPatterns: unknown[] = [];
  private curiosityLevel: number = 0.8;

  constructor(eventEmitter: EventEmitter) {
    super(eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: 'exploring',
      name: 'Exploring Mode',
      category: 'learning',
      description:
        'Curious investigation and systematic knowledge discovery with exploration-driven learning',
      keywords: [
        'explore',
        'discover',
        'investigate',
        'examine',
        'probe',
        'search',
        'uncover',
        'venture',
      ],
      triggers: [
        'explore this',
        'discover how',
        'investigate',
        'what happens if',
        'let me check',
        'examine',
      ],
      examples: [
        'Explore the possibilities of this new technology',
        'Discover how this system works internally',
        'Investigate the relationship between these components',
        'Examine what happens when we change this parameter',
      ],
      priority: 70,
      timeout: 75000,
      retryAttempts: 3,
      validation: {
        minInputLength: 15,
        maxInputLength: 10000,
        requiredContext: ['exploration_target', 'discovery_goal'],
      },
    };
  }

  async onActivate(context: ModeContext): Promise<void> {
    this.emit('modeActivated', {
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

    this.emit('modeDeactivated', {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      discoveriesMade: this.metrics.discoveryCount || 0,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const startTime = Date.now();

    try {
      const explorationResults = await this.executeExplorationPipeline(context);

      const processingTime = Date.now() - startTime;

      this.updateMetrics({
        totalProcessingTime: processingTime,
        explorationDepth: explorationResults.depth,
        discoveryCount: explorationResults.discoveries.length,
        insightQuality: explorationResults.insights.quality,
        knowledgeExpansion: explorationResults.expansion.scope,
        lastProcessedAt: Date.now(),
      });

      return {
        success: true,
        data: explorationResults,
        confidence: this.calculateConfidence(context, explorationResults),
        processingTime,
        metadata: {
          explorationMethod: explorationResults.method,
          discoveriesFound: explorationResults.discoveries.length,
          pathsExplored: explorationResults.paths.length,
          curiosityLevel: this.curiosityLevel,
          knowledgeGained: explorationResults.knowledge.gained,
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

    const keywords = this.config.keywords;
    const input = context.input.toLowerCase();
    const keywordMatches = keywords.filter((keyword) => input.includes(keyword));
    confidence += keywordMatches.length * 0.14;

    const explorationPatterns = [
      /explore\s+.+/i,
      /discover\s+.+/i,
      /investigate\s+.+/i,
      /what\s+happens\s+if\s+.+/i,
      /let\s+me\s+check\s+.+/i,
      /examine\s+.+/i,
      /probe\s+.+/i,
      /venture\s+into\s+.+/i,
    ];

    const patternMatches = explorationPatterns.filter((pattern) => pattern.test(input));
    confidence += patternMatches.length * 0.17;

    const curiosityIndicators = ['what', 'how', 'why', 'where', 'when', 'curious', 'wonder'];
    const curiosityMatches = curiosityIndicators.filter((indicator) => input.includes(indicator));
    confidence += curiosityMatches.length * 0.08;

    if (context.metadata?.requiresExploration) {confidence += 0.25;}
    if (context.metadata?.unknownTerritory) {confidence += 0.2;}
    if (context.metadata?.discoveryOpportunity) {confidence += 0.15;}

    return Math.min(confidence, 1.0);
  }

  private async executeExplorationPipeline(context: ModeContext): Promise<unknown> {
    const pipeline = {
      scopeDefinition: await this.defineExplorationScope(context),
      pathMapping: await this.mapExplorationPaths(context),
      systematicExploration: await this.conductSystematicExploration(context),
      discoveryProcessing: await this.processDiscoveries(context),
      insightExtraction: await this.extractInsights(context),
      knowledgeIntegration: await this.integrateKnowledge(context),
      curiosityRefinement: await this.refineCuriosity(context),
    };

    return {
      method: 'systematic_curiosity_driven_exploration',
      scope: pipeline.scopeDefinition,
      paths: pipeline.pathMapping,
      exploration: pipeline.systematicExploration,
      discoveries: pipeline.discoveryProcessing,
      insights: pipeline.insightExtraction,
      knowledge: pipeline.knowledgeIntegration,
      expansion: this.assessKnowledgeExpansion(pipeline),
      depth: this.calculateExplorationDepth(pipeline),
      recommendations: this.generateExplorationRecommendations(pipeline),
    };
  }

  private async initializeExplorationFramework(context: ModeContext): Promise<void> {
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
      depth_limits: this.determineDepthLimits(context.input),
    };
  }

  private async mapExplorationPaths(context: ModeContext): Promise<unknown[]> {
    return [
      {
        id: 'primary_path',
        direction: 'direct_investigation',
        priority: 'high',
        estimated_effort: 'medium',
        discovery_potential: 'high',
      },
      {
        id: 'lateral_path',
        direction: 'lateral_thinking',
        priority: 'medium',
        estimated_effort: 'low',
        discovery_potential: 'medium',
      },
      {
        id: 'deep_dive_path',
        direction: 'deep_investigation',
        priority: 'medium',
        estimated_effort: 'high',
        discovery_potential: 'very_high',
      },
    ];
  }

  private async conductSystematicExploration(context: ModeContext): Promise<unknown> {
    return {
      methodology: 'breadth_first_with_selective_depth',
      coverage: this.calculateCoverage(context),
      thoroughness: this.assessThoroughness(context),
      serendipity_allowance: this.calculateSerendipityFactor(context),
      progress_tracking: this.trackExplorationProgress(context),
    };
  }

  private async processDiscoveries(context: ModeContext): Promise<unknown[]> {
    return [
      {
        type: 'factual_discovery',
        content: 'New factual information uncovered',
        significance: 'medium',
        verification_status: 'pending',
        implications: ['affects_understanding', 'opens_new_questions'],
      },
      {
        type: 'pattern_discovery',
        content: 'Recurring pattern identified',
        significance: 'high',
        verification_status: 'confirmed',
        implications: ['predictive_value', 'generalizable_principle'],
      },
      {
        type: 'connection_discovery',
        content: 'Unexpected connection found',
        significance: 'high',
        verification_status: 'provisional',
        implications: ['paradigm_shift', 'new_research_direction'],
      },
    ];
  }

  private async extractInsights(context: ModeContext): Promise<unknown> {
    return {
      quality: 0.82,
      insights: [
        {
          type: 'structural_insight',
          content: 'System exhibits emergent properties at scale',
          confidence: 0.85,
        },
        {
          type: 'behavioral_insight',
          content: 'Component interactions follow predictable patterns',
          confidence: 0.78,
        },
      ],
      novel_perspectives: this.identifyNovelPerspectives(context),
      paradigm_shifts: this.identifyParadigmShifts(context),
    };
  }

  private async integrateKnowledge(context: ModeContext): Promise<unknown> {
    return {
      gained: this.calculateKnowledgeGained(context),
      integration_quality: 0.8,
      knowledge_gaps_filled: this.identifyFilledGaps(context),
      new_questions_generated: this.generateNewQuestions(context),
      conceptual_frameworks_updated: this.updateConceptualFrameworks(context),
    };
  }

  private async refineCuriosity(context: ModeContext): Promise<unknown> {
    return {
      enhanced_areas: this.identifyEnhancedCuriosity(context),
      new_interests: this.identifyNewInterests(context),
      question_refinement: this.refineQuestions(context),
      exploration_priorities: this.updateExplorationPriorities(context),
    };
  }

  private determineExplorationScope(context: ModeContext): string {
    const wordCount = context.input.split(/\s+/).length;
    if (wordCount > 150) {return 'comprehensive';}
    if (wordCount > 75) {return 'moderate';}
    return 'focused';
  }

  private calculateCuriosityIndex(context: ModeContext): number {
    const curiosityIndicators = [
      context.input.includes('?'),
      context.input.includes('wonder'),
      context.input.includes('curious'),
      context.input.includes('what if'),
      context.input.includes('how about'),
    ];
    return curiosityIndicators.filter(Boolean).length / curiosityIndicators.length;
  }

  private assessDiscoveryPotential(context: ModeContext): number {
    return 0.75 + Math.random() * 0.2;
  }

  private calculateConfidence(context: ModeContext, results: any): number {
    let confidence = 0.72;

    if (results.discoveries.length > 2) {confidence += 0.1;}
    if (results.insights.quality > 0.8) {confidence += 0.08;}
    if (results.depth > 0.7) {confidence += 0.1;}

    return Math.min(confidence, 1.0);
  }

  private generateExplorationRecommendations(pipeline: any): string[] {
    return [
      'Continue exploring high-potential paths identified',
      'Document discoveries for future reference',
      'Validate findings through independent verification',
      'Share insights with relevant stakeholders',
    ];
  }

  // Helper methods
  private identifyExplorationTarget(input: string): string {
    return input.split(' ').slice(0, 5).join(' ');
  }

  private defineBoundaries(input: string): string[] {
    return ['scope_limitations', 'resource_constraints', 'time_boundaries'];
  }

  private identifyConstraints(input: string): string[] {
    return ['ethical_considerations', 'technical_limitations', 'access_restrictions'];
  }

  private defineObjectives(input: string): string[] {
    return ['knowledge_acquisition', 'pattern_identification', 'insight_generation'];
  }

  private determineDepthLimits(input: string): any {
    return {
      maximum_depth: 'detailed_investigation',
      stopping_criteria: 'diminishing_returns_or_time_limit',
    };
  }

  private calculateCoverage(context: ModeContext): number {
    return 0.75;
  }

  private assessThoroughness(context: ModeContext): number {
    return 0.8;
  }

  private calculateSerendipityFactor(context: ModeContext): number {
    return this.curiosityLevel * 0.5;
  }

  private trackExplorationProgress(context: ModeContext): any {
    return {
      milestones_reached: 3,
      paths_completed: 2,
      discoveries_made: 5,
      insights_generated: 3,
    };
  }

  private identifyNovelPerspectives(context: ModeContext): string[] {
    return ['alternative_viewpoint_1', 'unconventional_angle_2'];
  }

  private identifyParadigmShifts(context: ModeContext): string[] {
    return ['fundamental_assumption_challenged'];
  }

  private calculateKnowledgeGained(context: ModeContext): any {
    return {
      factual: 'significant_new_facts',
      conceptual: 'enhanced_understanding',
      procedural: 'improved_methods',
      meta: 'learning_about_learning',
    };
  }

  private identifyFilledGaps(context: ModeContext): string[] {
    return ['knowledge_gap_1', 'understanding_gap_2'];
  }

  private generateNewQuestions(context: ModeContext): string[] {
    return [
      'How does this scale to larger systems?',
      'What are the long-term implications?',
      'Are there similar patterns elsewhere?',
    ];
  }

  private updateConceptualFrameworks(context: ModeContext): any {
    return {
      frameworks_modified: 2,
      new_frameworks_created: 1,
      integration_quality: 0.85,
    };
  }

  private identifyEnhancedCuriosity(context: ModeContext): string[] {
    return ['system_dynamics', 'emergent_properties', 'scaling_behaviors'];
  }

  private identifyNewInterests(context: ModeContext): string[] {
    return ['related_domain_1', 'adjacent_field_2'];
  }

  private refineQuestions(context: ModeContext): string[] {
    return [
      'More specific question about mechanism',
      'Deeper inquiry into relationships',
      'Broader question about implications',
    ];
  }

  private updateExplorationPriorities(context: ModeContext): any {
    return {
      high_priority: ['follow_up_on_key_discovery'],
      medium_priority: ['investigate_side_findings'],
      low_priority: ['explore_tangential_areas'],
    };
  }

  private assessKnowledgeExpansion(pipeline: any): any {
    return {
      scope: 'significant_expansion',
      depth: 'moderate_to_deep',
      breadth: 'lateral_connections_made',
      integration: 'well_integrated_with_existing_knowledge',
    };
  }

  private calculateExplorationDepth(pipeline: any): number {
    return 0.78;
  }
}
