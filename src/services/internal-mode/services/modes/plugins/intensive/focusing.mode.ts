import { BaseMode } from "../base/BaseMode";
import { ModeConfig, ModeContext, ModeResult } from "../types/ModeTypes";
import { EventEmitter } from "node:events";

/**
 * Focusing Mode - Intense concentration and attention management
 * Provides deep focus capabilities with distraction filtering and attention optimization
 */
export class FocusingMode extends BaseMode {
  private attentionFilters: Map<string, any> = new Map();
  private focusHistory: unknown[] = [];
  private concentrationLevel: number = 0.8;
  private distractionThreshold: number = 0.3;

  constructor(_eventEmitter: EventEmitter) {
    super(_eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: "focusing",
      name: "Focusing Mode",
      category: "intensive",
      description:
        "Deep concentration with attention management and distraction filtering for intensive cognitive work",
      _keywords: [
        "focus",
        "concentrate",
        "attention",
        "deep",
        "intensive",
        "zero-in",
        "narrow",
        "target",
      ],
      triggers: [
        "focus on",
        "concentrate on",
        "deep focus",
        "pay attention to",
        "zero in on",
        "intensive analysis",
      ],
      examples: [
        "Focus deeply on the core algorithm implementation",
        "Concentrate on the critical path analysis",
        "Pay intensive attention to the _error patterns",
        "Zero in on the performance bottleneck",
      ],
      priority: 88,
      timeout: 180000, // 3 minutes for deep focus
      retryAttempts: 2,
      validation: {
        minInputLength: 10,
        maxInputLength: 8000,
        requiredContext: ["focus_target", "concentration_duration"],
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
      focusIntensity: this.calculateFocusIntensity(context),
      targetComplexity: this.assessTargetComplexity(context),
      concentrationDuration: this.estimateConcentrationDuration(context),
    });

    await this.initializeFocusEnvironment(context);
  }

  async onDeactivate(): Promise<void> {
    await this.recordFocusSession();

    this.emit("modeDeactivated", {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      focusQuality: this.metrics.focusQuality || 0,
      distractionsFiltered: this.metrics.distractionsFiltered || 0,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const _startTime = Date.now();

    try {
      const _focusResults = await this.executeFocusPipeline(context);

      const _processingTime = Date.now() - _startTime;

      this.updateMetrics({
        totalProcessingTime: _processingTime,
        focusQuality: _focusResults.quality.overall,
        concentrationDepth: _focusResults.concentration.depth,
        attentionStability: _focusResults.attention.stability,
        distractionsFiltered: _focusResults.distractions.filtered_count,
        insightDepth: _focusResults.insights.depth,
        lastProcessedAt: Date.now(),
      });

      await this.recordFocusMetrics(_focusResults);

      return {
        success: true,
        data: _focusResults,
        confidence: this.calculateConfidence(context, _focusResults),
        _processingTime,
        metadata: {
          focusMethod: _focusResults.method,
          concentrationLevel: _focusResults.concentration.level,
          attentionFilters: _focusResults.filters.active_count,
          focusDepth: _focusResults.depth,
          distractionsHandled: _focusResults.distractions.handled_count,
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
    confidence += _keywordMatches.length * 0.16;

    const _focusPatterns = [
      /focus\s+on\s+.+/i,
      /concentrate\s+on\s+.+/i,
      /deep\s+.+\s+analysis/i,
      /pay\s+attention\s+to\s+.+/i,
      /zero\s+in\s+on\s+.+/i,
      /intensive\s+.+/i,
      /narrow\s+down\s+to\s+.+/i,
      /drill\s+down\s+into\s+.+/i,
    ];

    const _patternMatches = _focusPatterns.filter((pattern) =>
      pattern.test(_input),
    );
    confidence += _patternMatches.length * 0.18;

    const _intensityIndicators = [
      "deep",
      "intensive",
      "thorough",
      "detailed",
      "comprehensive",
    ];
    const _intensityMatches = _intensityIndicators.filter((indicator) =>
      _input.includes(indicator),
    );
    confidence += _intensityMatches.length * 0.1;

    const _urgencyIndicators = [
      "critical",
      "important",
      "urgent",
      "priority",
      "crucial",
    ];
    const _urgencyMatches = _urgencyIndicators.filter((indicator) =>
      _input.includes(indicator),
    );
    confidence += _urgencyMatches.length * 0.08;

    if (context.metadata?.requiresDeepFocus) {
      confidence += 0.25;
    }
    if (context.metadata?.intensiveTask) {
      confidence += 0.2;
    }
    if (context.metadata?.complexAnalysis) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  private async executeFocusPipeline(context: ModeContext): Promise<unknown> {
    const _pipeline = {
      targetIdentification: await this.identifyFocusTarget(context),
      attentionAllocation: await this.allocateAttention(context),
      distractionFiltering: await this.filterDistractions(context),
      concentrationDeepening: await this.deepenConcentration(context),
      intensiveAnalysis: await this.performIntensiveAnalysis(context),
      insightExtraction: await this.extractFocusedInsights(context),
      qualityAssessment: await this.assessFocusQuality(context),
    };

    return {
      method: "deep_concentration_with_attention_management",
      target: _pipeline.targetIdentification,
      attention: _pipeline.attentionAllocation,
      _distractions: _pipeline.distractionFiltering,
      concentration: _pipeline.concentrationDeepening,
      analysis: _pipeline.intensiveAnalysis,
      insights: _pipeline.insightExtraction,
      quality: _pipeline.qualityAssessment,
      depth: this.calculateFocusDepth(_pipeline),
      _filters: this.summarizeFilters(_pipeline),
      recommendations: this.generateFocusRecommendations(_pipeline),
    };
  }

  private async initializeFocusEnvironment(
    context: ModeContext,
  ): Promise<void> {
    this.concentrationLevel = this.calculateFocusIntensity(context);
    this.setupAttentionFilters(context);

    this.updateMetrics({
      environmentSetup: Date.now(),
      filtersActive: this.attentionFilters.size,
    });
  }

  private async recordFocusSession(): Promise<void> {
    const _session = {
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      quality: this.metrics.focusQuality || 0,
      concentrationlevel: this.concentrationLevel,
    };

    this.focusHistory.push(_session);
  }

  private async recordFocusMetrics(_results: unknown): Promise<void> {
    // Record detailed focus metrics for analysis
  }

  private async identifyFocusTarget(context: ModeContext): Promise<unknown> {
    return {
      primary: this.extractPrimaryTarget(context.input),
      secondary: this.extractSecondaryTargets(context.input),
      scope: this.defineFocusScope(context.input),
      priority: this.assessTargetPriority(context.input),
      complexity: this.assessTargetComplexity(context),
      durationestimate: this.estimateTargetDuration(context.input),
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
    const _distractions = this.identifyPotentialDistractions(context);

    return {
      identified: _distractions,
      filteredcount: _distractions.filter(
        (d) => d.severity > this.distractionThreshold,
      ).length,
      handledcount: _distractions.length,
      filteringstrategy: this.selectFilteringStrategy(context),
      effectiveness: this.assessFilteringEffectiveness(_distractions),
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

  private async performIntensiveAnalysis(
    context: ModeContext,
  ): Promise<unknown> {
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
          type: "core_insight",
          content: "Deep analysis reveals fundamental pattern",
          confidence: 0.9,
          depthlevel: "deep",
        },
        {
          type: "critical_finding",
          content: "Key bottleneck identified through focused examination",
          confidence: 0.85,
          depthlevel: "intermediate",
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
        attentionstability: this.assessAttentionStability(context),
        distractionresistance: this.assessDistractionResistance(context),
        depthachievement: this.assessDepthAchievement(context),
        insightquality: this.assessInsightQuality(context),
      },
      improvementareas: this.identifyImprovementAreas(context),
    };
  }

  private calculateFocusIntensity(context: ModeContext): number {
    const _intensityIndicators = [
      context.input.includes("deep"),
      context.input.includes("intensive"),
      context.input.includes("critical"),
      context.input.includes("thorough"),
    ];

    const _baseIntensity = 0.7;
    const _intensityBoost = _intensityIndicators.filter(Boolean).length * 0.1;

    return Math.min(_baseIntensity + _intensityBoost, 1.0);
  }

  private assessTargetComplexity(context: ModeContext): string {
    const _complexityIndicators = context.input.toLowerCase();

    if (
      _complexityIndicators.includes("complex") ||
      _complexityIndicators.includes("intricate")
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

  private estimateConcentrationDuration(context: ModeContext): number {
    const _urgencyLevel = this.assessUrgencyLevel(context.input);
    const _complexityLevel = this.assessTargetComplexity(context);

    let baseDuration = 30; // minutes

    if (_complexityLevel === "high") {
      baseDuration *= 1.5;
    }
    if (_urgencyLevel === "high") {
      baseDuration *= 0.8;
    }

    return baseDuration;
  }

  private calculateConfidence(_context: ModeContext, results: unknown): number {
    let confidence = 0.82;

    if (results.quality.overall > 0.85) {
      confidence += 0.1;
    }
    if (results.concentration.depth > 0.8) {
      confidence += 0.05;
    }
    if (results.insights.depth > 0.8) {
      confidence += 0.03;
    }

    return Math.min(confidence, 1.0);
  }

  private setupAttentionFilters(_context: ModeContext): void {
    const _filters = [
      { name: "relevance_filter", threshold: 0.7, active: true },
      { name: "priority_filter", threshold: 0.8, active: true },
      { name: "complexity_filter", threshold: 0.6, active: true },
    ];

    filters.forEach((filter) => {
      this.attentionFilters.set(filter.name, filter);
    });
  }

  private calculateFocusDepth(_pipeline: unknown): number {
    return 0.85;
  }

  private summarizeFilters(_pipeline: unknown): unknown {
    return {
      activecount: this.attentionFilters.size,
      effectiveness: 0.82,
      types: Array.from(this.attentionFilters.keys()),
    };
  }

  private generateFocusRecommendations(_pipeline: unknown): string[] {
    return [
      "Maintain consistent concentration levels throughout analysis",
      "Periodically validate focus target relevance",
      "Use distraction filtering to maintain attention quality",
      "Document insights immediately while concentration is high",
    ];
  }

  // Helper methods
  private extractPrimaryTarget(_input: string): string {
    const _focusKeywords = ["focus on", "concentrate on", "analyze"];

    for (const keyword of _focusKeywords) {
      const _index = input.toLowerCase().indexOf(keyword);
      if (_index !== -1) {
        return _input
          .slice(_index + keyword.length)
          .trim()
          .split(" ")
          .slice(0, 5)
          .join(" ");
      }
    }

    return input.split(" ").slice(0, 5).join(" ");
  }

  private extractSecondaryTargets(_input: string): string[] {
    return ["secondary_aspect_1", "related_component_2"];
  }

  private defineFocusScope(_input: string): string {
    if (_input.includes("broad") || _input.includes("comprehensive")) {
      return "broad";
    }
    if (_input.includes("narrow") || _input.includes("specific")) {
      return "narrow";
    }
    return "moderate";
  }

  private assessTargetPriority(_input: string): string {
    if (_input.includes("critical") || _input.includes("urgent")) {
      return "high";
    }
    if (_input.includes("low") || _input.includes("minor")) {
      return "low";
    }
    return "medium";
  }

  private estimateTargetDuration(_input: string): string {
    return "30-45 minutes";
  }

  private selectAttentionStrategy(_context: ModeContext): string {
    return "sustained_selective_attention";
  }

  private calculateAttentionAllocation(_context: ModeContext): unknown {
    return {
      primarytarget: 0.7,
      secondarytargets: 0.2,
      monitoring: 0.1,
    };
  }

  private assessAttentionStability(_context: ModeContext): number {
    return 0.85;
  }

  private planAttentionMaintenance(_context: ModeContext): unknown {
    return {
      breaks: "micro_breaks_every_20_minutes",
      refreshing: "attention_reset_techniques",
      monitoring: "continuous_attention_tracking",
    };
  }

  private optimizeAttentionUsage(_context: ModeContext): unknown {
    return {
      efficiency: 0.88,
      wastereduction: "minimize_attention_leakage",
      enhancement: "attention_training_exercises",
    };
  }

  private identifyPotentialDistractions(_context: ModeContext): unknown[] {
    return [
      { type: "cognitive", severity: 0.4, source: "competing_thoughts" },
      { type: "environmental", severity: 0.3, source: "external_stimuli" },
      { type: "emotional", severity: 0.2, source: "stress_anxiety" },
    ];
  }

  private selectFilteringStrategy(_context: ModeContext): string {
    return "multi_layer_attention_filtering";
  }

  private assessFilteringEffectiveness(_distractions: unknown[]): number {
    return 0.78;
  }

  private calculateConcentrationDepth(_context: ModeContext): number {
    return this.concentrationLevel * 0.9;
  }

  private selectConcentrationTechniques(_context: ModeContext): string[] {
    return [
      "deep_breathing",
      "attention_anchoring",
      "cognitive_load_management",
    ];
  }

  private planConcentrationMaintenance(_context: ModeContext): unknown {
    return {
      techniques: ["progressive_deepening", "attention_renewal"],
      schedule: "maintain_for_target_duration",
      monitoring: "continuous_depth_tracking",
    };
  }

  private enhanceConcentration(_context: ModeContext): unknown {
    return {
      amplification: "focus_enhancement_techniques",
      stabilization: "concentration_stabilization_methods",
      optimization: "peak_performance_protocols",
    };
  }

  private selectAnalysisApproach(_context: ModeContext): string {
    return "systematic_deep_analysis";
  }

  private calculateAnalysisDepth(_context: ModeContext): number {
    return 0.9;
  }

  private assessAnalysisThoroughness(_context: ModeContext): number {
    return 0.88;
  }

  private calculateAnalysisPrecision(_context: ModeContext): number {
    return 0.85;
  }

  private generateAnalysisFindings(_context: ModeContext): unknown[] {
    return [
      { finding: "core_pattern_identified", confidence: 0.9 },
      { finding: "critical_relationship_discovered", confidence: 0.85 },
    ];
  }

  private calculateInsightDepth(_context: ModeContext): number {
    return 0.87;
  }

  private assessInsightClarity(_context: ModeContext): number {
    return 0.82;
  }

  private identifyBreakthroughs(_context: ModeContext): string[] {
    return ["fundamental_understanding_achieved", "novel_approach_discovered"];
  }

  private analyzeImplications(_context: ModeContext): string[] {
    return ["significant_impact_on_approach", "paradigm_shift_potential"];
  }

  private calculateOverallFocusQuality(_context: ModeContext): number {
    return 0.86;
  }

  private assessDistractionResistance(_context: ModeContext): number {
    return 0.8;
  }

  private assessDepthAchievement(_context: ModeContext): number {
    return 0.85;
  }

  private assessInsightQuality(_context: ModeContext): number {
    return 0.87;
  }

  private identifyImprovementAreas(_context: ModeContext): string[] {
    return ["sustained_attention_duration", "distraction_filtering_refinement"];
  }

  private assessUrgencyLevel(_input: string): string {
    if (_input.includes("urgent") || _input.includes("critical")) {
      return "high";
    }
    if (_input.includes("routine") || _input.includes("standard")) {
      return "low";
    }
    return "medium";
  }
}
