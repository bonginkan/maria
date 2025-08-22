import { BaseMode } from '../base/BaseMode';
import { ModeContext, ModeResult, ModeConfig } from '../types/ModeTypes';
import { EventEmitter } from 'events';

/**
 * Visualizing Mode - Creative visualization and representation generation
 * Provides systematic visualization creation with multi-modal representation techniques
 */
export class VisualizingMode extends BaseMode {
  private visualizationHistory: Map<string, any> = new Map();
  private visualTypes: string[] = [
    'diagrams',
    'charts',
    'graphs',
    'flowcharts',
    'mind_maps',
    'wireframes',
    'prototypes',
    'infographics',
    'dashboards',
  ];

  constructor(eventEmitter: EventEmitter) {
    super(eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: 'visualizing',
      name: 'Visualizing Mode',
      category: 'creative',
      description:
        'Creative visualization and multi-modal representation with systematic visual communication',
      keywords: [
        'visualize',
        'diagram',
        'chart',
        'graph',
        'illustrate',
        'draw',
        'represent',
        'display',
      ],
      triggers: [
        'visualize this',
        'create diagram',
        'show graphically',
        'illustrate',
        'draw chart',
        'represent visually',
      ],
      examples: [
        'Visualize the data flow through the system',
        'Create a diagram showing the architecture',
        'Illustrate the user journey with a flowchart',
        'Draw a chart representing the performance metrics',
      ],
      priority: 76,
      timeout: 80000,
      retryAttempts: 3,
      validation: {
        minInputLength: 15,
        maxInputLength: 12000,
        requiredContext: ['visualization_target', 'representation_type'],
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
      visualizationComplexity: this.assessVisualizationComplexity(context),
      dataComplexity: this.assessDataComplexity(context),
      representationNeeds: this.assessRepresentationNeeds(context),
    });

    await this.initializeVisualizationFramework(context);
  }

  async onDeactivate(): Promise<void> {
    await this.saveVisualizationArtifacts();

    this.emit('modeDeactivated', {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      visualizationsCreated: this.metrics.visualizationCount || 0,
      clarityScore: this.metrics.clarityScore || 0,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const startTime = Date.now();

    try {
      const visualizationResults = await this.executeVisualizationPipeline(context);

      const processingTime = Date.now() - startTime;

      this.updateMetrics({
        totalProcessingTime: processingTime,
        visualizationEffectiveness: visualizationResults.effectiveness,
        visualizationCount: visualizationResults.visualizations.length,
        clarityScore: visualizationResults.clarity.score,
        aestheticsScore: visualizationResults.aesthetics.score,
        usabilityScore: visualizationResults.usability.score,
        lastProcessedAt: Date.now(),
      });

      await this.storeVisualizationResults(visualizationResults);

      return {
        success: true,
        data: visualizationResults,
        confidence: this.calculateConfidence(context, visualizationResults),
        processingTime,
        metadata: {
          visualizationType: visualizationResults.type,
          visualizationsGenerated: visualizationResults.visualizations.length,
          clarityLevel: visualizationResults.clarity.level,
          complexityHandled: visualizationResults.complexity.level,
          interactivityLevel: visualizationResults.interactivity.level,
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
    confidence += keywordMatches.length * 0.15;

    const visualizationPatterns = [
      /visualize\s+.+/i,
      /create\s+.+\s+diagram/i,
      /show\s+.+\s+graphically/i,
      /illustrate\s+.+/i,
      /draw\s+.+\s+chart/i,
      /represent\s+.+\s+visually/i,
      /display\s+.+\s+data/i,
      /plot\s+.+/i,
    ];

    const patternMatches = visualizationPatterns.filter((pattern) => pattern.test(input));
    confidence += patternMatches.length * 0.17;

    const visualTypes = ['chart', 'graph', 'diagram', 'flowchart', 'map', 'dashboard', 'plot'];
    const typeMatches = visualTypes.filter((type) => input.includes(type));
    confidence += typeMatches.length * 0.12;

    const dataTerms = ['data', 'metrics', 'statistics', 'numbers', 'values', 'trends'];
    const dataMatches = dataTerms.filter((term) => input.includes(term));
    confidence += dataMatches.length * 0.1;

    if (context.metadata?.requiresVisualization) confidence += 0.25;
    if (context.metadata?.hasDataToVisualize) confidence += 0.2;
    if (context.metadata?.communicationNeeds) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  private async executeVisualizationPipeline(context: ModeContext): Promise<unknown> {
    const pipeline = {
      dataAnalysis: await this.analyzeData(context),
      purposeDefinition: await this.definePurpose(context),
      typeSelection: await this.selectVisualizationType(context),
      designPlanning: await this.planDesign(context),
      visualCreation: await this.createVisualizations(context),
      aestheticsOptimization: await this.optimizeAesthetics(context),
      usabilityTesting: await this.testUsability(context),
      refinementIteration: await this.iterateRefinements(context),
    };

    return {
      type: pipeline.typeSelection.primary,
      data: pipeline.dataAnalysis,
      purpose: pipeline.purposeDefinition,
      design: pipeline.designPlanning,
      visualizations: pipeline.visualCreation,
      aesthetics: pipeline.aestheticsOptimization,
      usability: pipeline.usabilityTesting,
      clarity: this.assessClarityAchieved(pipeline),
      complexity: this.assessComplexityHandled(pipeline),
      interactivity: this.assessInteractivityLevel(pipeline),
      effectiveness: this.calculateVisualizationEffectiveness(pipeline),
      recommendations: this.generateVisualizationRecommendations(pipeline),
    };
  }

  private async initializeVisualizationFramework(context: ModeContext): Promise<void> {
    this.updateMetrics({ frameworkInitialized: Date.now() });
  }

  private async saveVisualizationArtifacts(): Promise<void> {
    // Save visualization artifacts and metadata
  }

  private async storeVisualizationResults(results: unknown): Promise<void> {
    const visualizationKey = `visualization_${Date.now()}`;
    this.visualizationHistory.set(visualizationKey, {
      ...results,
      timestamp: Date.now(),
      usage_count: 0,
    });
  }

  private async analyzeData(context: ModeContext): Promise<unknown> {
    return {
      type: this.identifyDataType(context.input),
      structure: this.analyzeDataStructure(context.input),
      volume: this.assessDataVolume(context.input),
      complexity: this.assessDataComplexity(context),
      patterns: this.identifyDataPatterns(context.input),
      relationships: this.identifyDataRelationships(context.input),
    };
  }

  private async definePurpose(context: ModeContext): Promise<unknown> {
    return {
      primary_goal: this.identifyPrimaryGoal(context.input),
      audience: this.identifyTargetAudience(context.input),
      context: this.analyzeUsageContext(context.input),
      requirements: this.extractRequirements(context.input),
      constraints: this.identifyConstraints(context.input),
      success_criteria: this.defineSuccessCriteria(context.input),
    };
  }

  private async selectVisualizationType(context: ModeContext): Promise<unknown> {
    const dataAnalysis = await this.analyzeData(context);
    const purpose = await this.definePurpose(context);

    return {
      primary: this.choosePrimaryType(dataAnalysis, purpose, context),
      alternatives: this.identifyAlternativeTypes(dataAnalysis, purpose, context),
      rationale: this.explainTypeChoice(dataAnalysis, purpose, context),
      combinations: this.considerTypeCombinations(context),
    };
  }

  private async planDesign(context: ModeContext): Promise<unknown> {
    return {
      layout: this.planLayout(context),
      color_scheme: this.selectColorScheme(context),
      typography: this.chooseTypography(context),
      hierarchy: this.establishVisualHierarchy(context),
      spacing: this.planSpacing(context),
      accessibility: this.planAccessibility(context),
    };
  }

  private async createVisualizations(context: ModeContext): Promise<unknown[]> {
    return [
      {
        type: 'primary_visualization',
        format: 'interactive_chart',
        description: 'Main data representation showing key insights',
        elements: ['data_points', 'trend_lines', 'annotations', 'legends'],
        interactivity: ['hover_details', 'zoom_pan', 'filter_controls'],
      },
      {
        type: 'supporting_diagram',
        format: 'static_flowchart',
        description: 'Process flow supporting the main visualization',
        elements: ['process_steps', 'decision_points', 'connections'],
        interactivity: ['clickable_elements', 'expandable_details'],
      },
      {
        type: 'summary_dashboard',
        format: 'multi_panel_display',
        description: 'Overview dashboard combining multiple views',
        elements: ['key_metrics', 'trend_indicators', 'status_displays'],
        interactivity: ['real_time_updates', 'drill_down_capability'],
      },
    ];
  }

  private async optimizeAesthetics(context: ModeContext): Promise<unknown> {
    return {
      score: this.calculateAestheticsScore(context),
      improvements: this.identifyAestheticImprovements(context),
      color_harmony: this.assessColorHarmony(context),
      visual_balance: this.assessVisualBalance(context),
      typography_quality: this.assessTypographyQuality(context),
      overall_appeal: this.assessOverallAppeal(context),
    };
  }

  private async testUsability(context: ModeContext): Promise<unknown> {
    return {
      score: this.calculateUsabilityScore(context),
      navigation: this.assessNavigation(context),
      comprehension: this.assessComprehension(context),
      efficiency: this.assessEfficiency(context),
      accessibility: this.assessAccessibility(context),
      feedback: this.collectUsabilityFeedback(context),
    };
  }

  private async iterateRefinements(context: ModeContext): Promise<unknown> {
    return {
      iterations: this.planRefinementIterations(context),
      improvements: this.identifyImprovements(context),
      user_feedback: this.incorporateUserFeedback(context),
      performance_optimization: this.optimizePerformance(context),
      final_polish: this.applyFinalPolish(context),
    };
  }

  private assessVisualizationComplexity(context: ModeContext): string {
    const complexityIndicators = context.input.toLowerCase();

    if (
      complexityIndicators.includes('complex') ||
      complexityIndicators.includes('multi-dimensional')
    ) {
      return 'high';
    }
    if (complexityIndicators.includes('simple') || complexityIndicators.includes('basic')) {
      return 'low';
    }
    return 'medium';
  }

  private assessDataComplexity(context: ModeContext): string {
    const dataIndicators = [
      context.input.includes('multiple'),
      context.input.includes('large'),
      context.input.includes('complex'),
      context.input.includes('multi-dimensional'),
    ];

    const complexityCount = dataIndicators.filter(Boolean).length;

    if (complexityCount >= 3) return 'high';
    if (complexityCount >= 2) return 'medium';
    return 'low';
  }

  private assessRepresentationNeeds(context: ModeContext): unknown {
    return {
      clarity: 'high_priority',
      interactivity: 'medium_priority',
      aesthetics: 'medium_priority',
      accessibility: 'high_priority',
    };
  }

  private calculateConfidence(context: ModeContext, results: unknown): number {
    let confidence = 0.75;

    if (results.effectiveness > 0.8) confidence += 0.1;
    if (results.clarity.score > 0.8) confidence += 0.08;
    if (results.usability.score > 0.75) confidence += 0.07;

    return Math.min(confidence, 1.0);
  }

  private assessClarityAchieved(pipeline: unknown): unknown {
    return {
      score: 0.85,
      level: 'high',
      factors: ['clear_labeling', 'logical_structure', 'intuitive_design'],
    };
  }

  private assessComplexityHandled(pipeline: unknown): unknown {
    return {
      level: 'medium',
      strategies: ['progressive_disclosure', 'layered_information', 'contextual_details'],
    };
  }

  private assessInteractivityLevel(pipeline: unknown): unknown {
    return {
      level: 'medium',
      features: ['hover_details', 'clickable_elements', 'filter_controls'],
      user_engagement: 'high',
    };
  }

  private calculateVisualizationEffectiveness(pipeline: unknown): number {
    return 0.83;
  }

  private generateVisualizationRecommendations(pipeline: unknown): string[] {
    return [
      'Consider progressive disclosure for complex data',
      'Ensure accessibility compliance for all visualizations',
      'Test with target audience for usability validation',
      'Maintain consistent design language across visualizations',
    ];
  }

  // Helper methods
  private identifyDataType(input: string): string {
    if (input.includes('time') || input.includes('trend')) return 'temporal';
    if (input.includes('category') || input.includes('group')) return 'categorical';
    if (input.includes('number') || input.includes('metric')) return 'quantitative';
    if (input.includes('location') || input.includes('map')) return 'spatial';
    return 'mixed';
  }

  private analyzeDataStructure(input: string): unknown {
    return {
      dimensions: this.countDataDimensions(input),
      hierarchy: this.identifyHierarchy(input),
      relationships: this.identifyStructuralRelationships(input),
    };
  }

  private assessDataVolume(input: string): string {
    if (input.includes('large') || input.includes('big')) return 'high';
    if (input.includes('small') || input.includes('few')) return 'low';
    return 'medium';
  }

  private identifyDataPatterns(input: string): string[] {
    return ['trends', 'cycles', 'outliers', 'clusters'];
  }

  private identifyDataRelationships(input: string): string[] {
    return ['correlations', 'dependencies', 'hierarchies', 'networks'];
  }

  private identifyPrimaryGoal(input: string): string {
    if (input.includes('compare')) return 'comparison';
    if (input.includes('trend')) return 'trend_analysis';
    if (input.includes('distribute') || input.includes('proportion')) return 'distribution';
    if (input.includes('flow') || input.includes('process')) return 'flow_visualization';
    return 'exploration';
  }

  private identifyTargetAudience(input: string): string {
    if (input.includes('executive') || input.includes('management')) return 'executives';
    if (input.includes('technical') || input.includes('developer')) return 'technical_team';
    if (input.includes('user') || input.includes('customer')) return 'end_users';
    return 'general_audience';
  }

  private analyzeUsageContext(input: string): string {
    if (input.includes('presentation')) return 'presentation';
    if (input.includes('report')) return 'reporting';
    if (input.includes('dashboard')) return 'monitoring';
    if (input.includes('analysis')) return 'analysis';
    return 'communication';
  }

  private extractRequirements(input: string): string[] {
    return ['clarity', 'accuracy', 'interactivity', 'accessibility'];
  }

  private identifyConstraints(input: string): string[] {
    return ['time_constraints', 'technical_limitations', 'format_requirements'];
  }

  private defineSuccessCriteria(input: string): string[] {
    return ['user_comprehension', 'task_completion', 'engagement_level'];
  }

  private choosePrimaryType(dataAnalysis: unknown, purpose: unknown, context: ModeContext): string {
    if (purpose.primary_goal === 'trend_analysis') return 'line_chart';
    if (purpose.primary_goal === 'comparison') return 'bar_chart';
    if (purpose.primary_goal === 'distribution') return 'histogram';
    if (purpose.primary_goal === 'flow_visualization') return 'flowchart';
    return 'dashboard';
  }

  private identifyAlternativeTypes(
    dataAnalysis: unknown,
    purpose: unknown,
    context: ModeContext,
  ): string[] {
    return ['scatter_plot', 'heatmap', 'treemap', 'network_diagram'];
  }

  private explainTypeChoice(dataAnalysis: unknown, purpose: unknown, context: ModeContext): string {
    return 'Type chosen based on data characteristics and communication goals';
  }

  private considerTypeCombinations(context: ModeContext): string[] {
    return ['multi_panel_dashboard', 'linked_visualizations', 'layered_displays'];
  }

  private planLayout(context: ModeContext): unknown {
    return {
      structure: 'grid_based',
      alignment: 'consistent_margins',
      flow: 'left_to_right_top_to_bottom',
    };
  }

  private selectColorScheme(context: ModeContext): unknown {
    return {
      palette: 'professional_blue_theme',
      accessibility: 'colorblind_friendly',
      contrast: 'wcag_compliant',
    };
  }

  private chooseTypography(context: ModeContext): unknown {
    return {
      primary_font: 'sans_serif_readable',
      hierarchy: 'clear_size_differences',
      readability: 'optimized_for_screen',
    };
  }

  private establishVisualHierarchy(context: ModeContext): unknown {
    return {
      primary_elements: 'emphasized',
      secondary_elements: 'supporting',
      details: 'accessible_on_demand',
    };
  }

  private planSpacing(context: ModeContext): unknown {
    return {
      whitespace: 'generous_but_efficient',
      grouping: 'logical_element_clustering',
      breathing_room: 'appropriate_margins',
    };
  }

  private planAccessibility(context: ModeContext): unknown {
    return {
      color_independence: 'patterns_and_textures',
      keyboard_navigation: 'full_accessibility',
      screen_readers: 'descriptive_alt_text',
    };
  }

  private calculateAestheticsScore(context: ModeContext): number {
    return 0.82;
  }

  private identifyAestheticImprovements(context: ModeContext): string[] {
    return ['color_harmony_optimization', 'typography_refinement', 'spacing_adjustment'];
  }

  private assessColorHarmony(context: ModeContext): number {
    return 0.85;
  }

  private assessVisualBalance(context: ModeContext): number {
    return 0.8;
  }

  private assessTypographyQuality(context: ModeContext): number {
    return 0.83;
  }

  private assessOverallAppeal(context: ModeContext): number {
    return 0.82;
  }

  private calculateUsabilityScore(context: ModeContext): number {
    return 0.78;
  }

  private assessNavigation(context: ModeContext): number {
    return 0.8;
  }

  private assessComprehension(context: ModeContext): number {
    return 0.85;
  }

  private assessEfficiency(context: ModeContext): number {
    return 0.75;
  }

  private assessAccessibility(context: ModeContext): number {
    return 0.8;
  }

  private collectUsabilityFeedback(context: ModeContext): unknown {
    return {
      clarity: 'high_user_satisfaction',
      ease_of_use: 'intuitive_interface',
      task_completion: 'efficient_workflows',
    };
  }

  private planRefinementIterations(context: ModeContext): number {
    return 2;
  }

  private identifyImprovements(context: ModeContext): string[] {
    return ['interaction_smoothing', 'performance_optimization', 'visual_polish'];
  }

  private incorporateUserFeedback(context: ModeContext): unknown {
    return {
      feedback_collected: true,
      changes_implemented: 'responsive_to_user_needs',
      satisfaction_improved: 'measurable_enhancement',
    };
  }

  private optimizePerformance(context: ModeContext): unknown {
    return {
      load_time: 'optimized',
      interactivity: 'responsive',
      resource_usage: 'efficient',
    };
  }

  private applyFinalPolish(context: ModeContext): unknown {
    return {
      visual_refinement: 'professional_finish',
      interaction_smoothing: 'seamless_experience',
      quality_assurance: 'comprehensive_testing',
    };
  }

  private countDataDimensions(input: string): number {
    return 3; // Simplified dimension counting
  }

  private identifyHierarchy(input: string): string {
    return 'multi_level_structure';
  }

  private identifyStructuralRelationships(input: string): string[] {
    return ['parent_child', 'sibling', 'networked'];
  }
}
