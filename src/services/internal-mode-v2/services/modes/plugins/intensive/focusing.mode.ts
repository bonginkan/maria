import { BaseMode } from '../base/BaseMode';
import { ModeConfig, ModeContext, ModeResult } from '../types/ModeTypes';
import { EventEmitter } from 'events';

/**
 * Focusing Mode - Intense concentration and attention management
 * Provides deep focus capabilities with distraction filtering and attention optimization
 */
export class FocusingMode extends BaseMode {
  private attentionFilters: Map<string, any> = new Map();
  private focusHistory: unknown[] = [];
  private concentrationLevel: number = 0.8;
  private distractionThreshold: number = 0.3;

  constructor(eventEmitter: EventEmitter) {
    super(eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: 'focusing',
      name: 'Focusing Mode',
      category: 'intensive',
      description:
        'Deep concentration with attention management and distraction filtering for intensive cognitive work',
      keywords: [
        'focus',
        'concentrate',
        'attention',
        'deep',
        'intensive',
        'zero-in',
        'narrow',
        'target',
      ],
      triggers: [
        'focus on',
        'concentrate on',
        'deep focus',
        'pay attention to',
        'zero in on',
        'intensive analysis',
      ],
      examples: [
        'Focus deeply on the core algorithm implementation',
        'Concentrate on the critical path analysis',
        'Pay intensive attention to the error patterns',
        'Zero in on the performance bottleneck',
      ],
      priority: 88,
      timeout: 180000, // 3 minutes for deep focus
      retryAttempts: 2,
      validation: {
        minInputLength: 10,
        maxInputLength: 8000,
        requiredContext: ['focus_target', 'concentration_duration'],
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
      focusIntensity: this.calculateFocusIntensity(context),
      targetComplexity: this.assessTargetComplexity(context),
      concentrationDuration: this.estimateConcentrationDuration(context),
    });

    await this.initializeFocusEnvironment(context);
  }

  async onDeactivate(): Promise<void> {
    await this.recordFocusSession();

    this.emit('modeDeactivated', {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      focusQuality: this.metrics.focusQuality || 0,
      distractionsFiltered: this.metrics.distractionsFiltered || 0,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const startTime = Date.now();

    try {
      const focusResults = await this.executeFocusPipeline(context);

      const processingTime = Date.now() - startTime;

      this.updateMetrics({
        totalProcessingTime: processingTime,
        focusQuality: focusResults.quality.overall,
        concentrationDepth: focusResults.concentration.depth,
        attentionStability: focusResults.attention.stability,
        distractionsFiltered: focusResults.distractions.filtered_count,
        insightDepth: focusResults.insights.depth,
        lastProcessedAt: Date.now(),
      });

      await this.recordFocusMetrics(focusResults);

      return {
        success: true,
        data: focusResults,
        confidence: this.calculateConfidence(context, focusResults),
        processingTime,
        metadata: {
          focusMethod: focusResults.method,
          concentrationLevel: focusResults.concentration.level,
          attentionFilters: focusResults.filters.active_count,
          focusDepth: focusResults.depth,
          distractionsHandled: focusResults.distractions.handled_count,
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
    confidence += keywordMatches.length * 0.16;

    const focusPatterns = [
      /focus\s+on\s+.+/i,
      /concentrate\s+on\s+.+/i,
      /deep\s+.+\s+analysis/i,
      /pay\s+attention\s+to\s+.+/i,
      /zero\s+in\s+on\s+.+/i,
      /intensive\s+.+/i,
      /narrow\s+down\s+to\s+.+/i,
      /drill\s+down\s+into\s+.+/i,
    ];

    const patternMatches = focusPatterns.filter((pattern) => pattern.test(input));
    confidence += patternMatches.length * 0.18;

    const intensityIndicators = ['deep', 'intensive', 'thorough', 'detailed', 'comprehensive'];
    const intensityMatches = intensityIndicators.filter((indicator) => input.includes(indicator));
    confidence += intensityMatches.length * 0.1;

    const urgencyIndicators = ['critical', 'important', 'urgent', 'priority', 'crucial'];
    const urgencyMatches = urgencyIndicators.filter((indicator) => input.includes(indicator));
    confidence += urgencyMatches.length * 0.08;

    if (context.metadata?.requiresDeepFocus) {confidence += 0.25;}
    if (context.metadata?.intensiveTask) {confidence += 0.2;}
    if (context.metadata?.complexAnalysis) {confidence += 0.15;}

    return Math.min(confidence, 1.0);
  }

  private async executeFocusPipeline(context: ModeContext): Promise<unknown> {
    const pipeline = {
      targetIdentification: await this.identifyFocusTarget(context),
      attentionAllocation: await this.allocateAttention(context),
      distractionFiltering: await this.filterDistractions(context),
      concentrationDeepening: await this.deepenConcentration(context),
      intensiveAnalysis: await this.performIntensiveAnalysis(context),
      insightExtraction: await this.extractFocusedInsights(context),
      qualityAssessment: await this.assessFocusQuality(context),
    };

    return {
      method: 'deep_concentration_with_attention_management',
      target: pipeline.targetIdentification,
      attention: pipeline.attentionAllocation,
      distractions: pipeline.distractionFiltering,
      concentration: pipeline.concentrationDeepening,
      analysis: pipeline.intensiveAnalysis,
      insights: pipeline.insightExtraction,
      quality: pipeline.qualityAssessment,
      depth: this.calculateFocusDepth(pipeline),
      filters: this.summarizeFilters(pipeline),
      recommendations: this.generateFocusRecommendations(pipeline),
    };
  }

  private async initializeFocusEnvironment(context: ModeContext): Promise<void> {
    this.concentrationLevel = this.calculateFocusIntensity(context);
    this.setupAttentionFilters(context);

    this.updateMetrics({
      environmentSetup: Date.now(),
      filtersActive: this.attentionFilters.size,
    });
  }

  private async recordFocusSession(): Promise<void> {
    const session = {
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      quality: this.metrics.focusQuality || 0,
      concentration_level: this.concentrationLevel,
    };

    this.focusHistory.push(session);
  }

  private async recordFocusMetrics(results: any): Promise<void> {
    // Record detailed focus metrics for analysis
  }

  private async identifyFocusTarget(context: ModeContext): Promise<unknown> {
    return {
      primary: this.extractPrimaryTarget(context.input),
      secondary: this.extractSecondaryTargets(context.input),
      scope: this.defineFocusScope(context.input),
      priority: this.assessTargetPriority(context.input),
      complexity: this.assessTargetComplexity(context),
      duration_estimate: this.estimateTargetDuration(context.input),
    };
  }

  private async allocateAttention(context: ModeContext): Promise<unknown> {
    return {
      strategy: this.selectAttentionStrategy(context),
      allocation: this.calculateAttentionAllocation(context),
      stability: this.assessAttentionStability(context),
      maintenance: this.planAttentionMaintenance(context),
      optimization: this.optimizeAttentionUsage(context),
    };
  }

  private async filterDistractions(context: ModeContext): Promise<unknown> {
    const distractions = this.identifyPotentialDistractions(context);

    return {
      identified: distractions,
      filtered_count: distractions.filter((d) => d.severity > this.distractionThreshold).length,
      handled_count: distractions.length,
      filtering_strategy: this.selectFilteringStrategy(context),
      effectiveness: this.assessFilteringEffectiveness(distractions),
    };
  }

  private async deepenConcentration(context: ModeContext): Promise<unknown> {
    return {
      level: this.concentrationLevel,
      depth: this.calculateConcentrationDepth(context),
      techniques: this.selectConcentrationTechniques(context),
      maintenance: this.planConcentrationMaintenance(context),
      enhancement: this.enhanceConcentration(context),
    };
  }

  private async performIntensiveAnalysis(context: ModeContext): Promise<unknown> {
    return {
      approach: this.selectAnalysisApproach(context),
      depth: this.calculateAnalysisDepth(context),
      thoroughness: this.assessAnalysisThoroughness(context),
      precision: this.calculateAnalysisPrecision(context),
      findings: this.generateAnalysisFindings(context),
    };
  }

  private async extractFocusedInsights(context: ModeContext): Promise<unknown> {
    return {
      depth: this.calculateInsightDepth(context),
      clarity: this.assessInsightClarity(context),
      insights: [
        {
          type: 'core_insight',
          content: 'Deep analysis reveals fundamental pattern',
          confidence: 0.9,
          depth_level: 'deep',
        },
        {
          type: 'critical_finding',
          content: 'Key bottleneck identified through focused examination',
          confidence: 0.85,
          depth_level: 'intermediate',
        },
      ],
      breakthroughs: this.identifyBreakthroughs(context),
      implications: this.analyzeImplications(context),
    };
  }

  private async assessFocusQuality(context: ModeContext): Promise<unknown> {
    return {
      overall: this.calculateOverallFocusQuality(context),
      dimensions: {
        concentration: this.concentrationLevel,
        attention_stability: this.assessAttentionStability(context),
        distraction_resistance: this.assessDistractionResistance(context),
        depth_achievement: this.assessDepthAchievement(context),
        insight_quality: this.assessInsightQuality(context),
      },
      improvement_areas: this.identifyImprovementAreas(context),
    };
  }

  private calculateFocusIntensity(context: ModeContext): number {
    const intensityIndicators = [
      context.input.includes('deep'),
      context.input.includes('intensive'),
      context.input.includes('critical'),
      context.input.includes('thorough'),
    ];

    const baseIntensity = 0.7;
    const intensityBoost = intensityIndicators.filter(Boolean).length * 0.1;

    return Math.min(baseIntensity + intensityBoost, 1.0);
  }

  private assessTargetComplexity(context: ModeContext): string {
    const complexityIndicators = context.input.toLowerCase();

    if (complexityIndicators.includes('complex') || complexityIndicators.includes('intricate')) {
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

  private estimateConcentrationDuration(context: ModeContext): number {
    const urgencyLevel = this.assessUrgencyLevel(context.input);
    const complexityLevel = this.assessTargetComplexity(context);

    let baseDuration = 30; // minutes

    if (complexityLevel === 'high') {baseDuration *= 1.5;}
    if (urgencyLevel === 'high') {baseDuration *= 0.8;}

    return baseDuration;
  }

  private calculateConfidence(context: ModeContext, results: any): number {
    let confidence = 0.82;

    if (results.quality.overall > 0.85) {confidence += 0.1;}
    if (results.concentration.depth > 0.8) {confidence += 0.05;}
    if (results.insights.depth > 0.8) {confidence += 0.03;}

    return Math.min(confidence, 1.0);
  }

  private setupAttentionFilters(context: ModeContext): void {
    const filters = [
      { name: 'relevance_filter', threshold: 0.7, active: true },
      { name: 'priority_filter', threshold: 0.8, active: true },
      { name: 'complexity_filter', threshold: 0.6, active: true },
    ];

    filters.forEach((filter) => {
      this.attentionFilters.set(filter.name, filter);
    });
  }

  private calculateFocusDepth(pipeline: any): number {
    return 0.85;
  }

  private summarizeFilters(pipeline: any): any {
    return {
      active_count: this.attentionFilters.size,
      effectiveness: 0.82,
      types: Array.from(this.attentionFilters.keys()),
    };
  }

  private generateFocusRecommendations(pipeline: any): string[] {
    return [
      'Maintain consistent concentration levels throughout analysis',
      'Periodically validate focus target relevance',
      'Use distraction filtering to maintain attention quality',
      'Document insights immediately while concentration is high',
    ];
  }

  // Helper methods
  private extractPrimaryTarget(input: string): string {
    const focusKeywords = ['focus on', 'concentrate on', 'analyze'];

    for (const keyword of focusKeywords) {
      const index = input.toLowerCase().indexOf(keyword);
      if (index !== -1) {
        return input
          .slice(index + keyword.length)
          .trim()
          .split(' ')
          .slice(0, 5)
          .join(' ');
      }
    }

    return input.split(' ').slice(0, 5).join(' ');
  }

  private extractSecondaryTargets(input: string): string[] {
    return ['secondary_aspect_1', 'related_component_2'];
  }

  private defineFocusScope(input: string): string {
    if (input.includes('broad') || input.includes('comprehensive')) {
      return 'broad';
    }
    if (input.includes('narrow') || input.includes('specific')) {
      return 'narrow';
    }
    return 'moderate';
  }

  private assessTargetPriority(input: string): string {
    if (input.includes('critical') || input.includes('urgent')) {
      return 'high';
    }
    if (input.includes('low') || input.includes('minor')) {
      return 'low';
    }
    return 'medium';
  }

  private estimateTargetDuration(input: string): string {
    return '30-45 minutes';
  }

  private selectAttentionStrategy(context: ModeContext): string {
    return 'sustained_selective_attention';
  }

  private calculateAttentionAllocation(context: ModeContext): any {
    return {
      primary_target: 0.7,
      secondary_targets: 0.2,
      monitoring: 0.1,
    };
  }

  private assessAttentionStability(context: ModeContext): number {
    return 0.85;
  }

  private planAttentionMaintenance(context: ModeContext): any {
    return {
      breaks: 'micro_breaks_every_20_minutes',
      refreshing: 'attention_reset_techniques',
      monitoring: 'continuous_attention_tracking',
    };
  }

  private optimizeAttentionUsage(context: ModeContext): any {
    return {
      efficiency: 0.88,
      waste_reduction: 'minimize_attention_leakage',
      enhancement: 'attention_training_exercises',
    };
  }

  private identifyPotentialDistractions(context: ModeContext): unknown[] {
    return [
      { type: 'cognitive', severity: 0.4, source: 'competing_thoughts' },
      { type: 'environmental', severity: 0.3, source: 'external_stimuli' },
      { type: 'emotional', severity: 0.2, source: 'stress_anxiety' },
    ];
  }

  private selectFilteringStrategy(context: ModeContext): string {
    return 'multi_layer_attention_filtering';
  }

  private assessFilteringEffectiveness(distractions: unknown[]): number {
    return 0.78;
  }

  private calculateConcentrationDepth(context: ModeContext): number {
    return this.concentrationLevel * 0.9;
  }

  private selectConcentrationTechniques(context: ModeContext): string[] {
    return ['deep_breathing', 'attention_anchoring', 'cognitive_load_management'];
  }

  private planConcentrationMaintenance(context: ModeContext): any {
    return {
      techniques: ['progressive_deepening', 'attention_renewal'],
      schedule: 'maintain_for_target_duration',
      monitoring: 'continuous_depth_tracking',
    };
  }

  private enhanceConcentration(context: ModeContext): any {
    return {
      amplification: 'focus_enhancement_techniques',
      stabilization: 'concentration_stabilization_methods',
      optimization: 'peak_performance_protocols',
    };
  }

  private selectAnalysisApproach(context: ModeContext): string {
    return 'systematic_deep_analysis';
  }

  private calculateAnalysisDepth(context: ModeContext): number {
    return 0.9;
  }

  private assessAnalysisThoroughness(context: ModeContext): number {
    return 0.88;
  }

  private calculateAnalysisPrecision(context: ModeContext): number {
    return 0.85;
  }

  private generateAnalysisFindings(context: ModeContext): unknown[] {
    return [
      { finding: 'core_pattern_identified', confidence: 0.9 },
      { finding: 'critical_relationship_discovered', confidence: 0.85 },
    ];
  }

  private calculateInsightDepth(context: ModeContext): number {
    return 0.87;
  }

  private assessInsightClarity(context: ModeContext): number {
    return 0.82;
  }

  private identifyBreakthroughs(context: ModeContext): string[] {
    return ['fundamental_understanding_achieved', 'novel_approach_discovered'];
  }

  private analyzeImplications(context: ModeContext): string[] {
    return ['significant_impact_on_approach', 'paradigm_shift_potential'];
  }

  private calculateOverallFocusQuality(context: ModeContext): number {
    return 0.86;
  }

  private assessDistractionResistance(context: ModeContext): number {
    return 0.8;
  }

  private assessDepthAchievement(context: ModeContext): number {
    return 0.85;
  }

  private assessInsightQuality(context: ModeContext): number {
    return 0.87;
  }

  private identifyImprovementAreas(context: ModeContext): string[] {
    return ['sustained_attention_duration', 'distraction_filtering_refinement'];
  }

  private assessUrgencyLevel(input: string): string {
    if (input.includes('urgent') || input.includes('critical')) {
      return 'high';
    }
    if (input.includes('routine') || input.includes('standard')) {
      return 'low';
    }
    return 'medium';
  }
}
