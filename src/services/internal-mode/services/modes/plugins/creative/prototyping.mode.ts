import { BaseMode } from "../base/BaseMode";
import { ModeConfig, ModeContext, ModeResult } from "../types/ModeTypes";
import { EventEmitter } from "node:events";

/**
 * Prototyping Mode - Rapid prototype development and iterative design
 * Provides systematic prototyping methodologies with rapid iteration and validation
 */
export class PrototypingMode extends BaseMode {
  private prototypeHistory: Map<string, any> = new Map();
  private designIterations: unknown[] = [];
  private prototypingMethods: string[] = [
    "paper_prototyping",
    "digital_mockup",
    "interactive_prototype",
    "functional_prototype",
    "technical_spike",
    "proof_of_concept",
  ];

  constructor(_eventEmitter: EventEmitter) {
    super(_eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: "prototyping",
      name: "Prototyping Mode",
      category: "creative",
      description:
        "Rapid prototyping with iterative design and validation methodologies",
      _keywords: [
        "prototype",
        "mockup",
        "proof of concept",
        "spike",
        "mvp",
        "demo",
        "wireframe",
        "model",
      ],
      triggers: [
        "create prototype",
        "build mockup",
        "prototype this",
        "mvp for",
        "proof of concept",
        "demo",
      ],
      examples: [
        "Create a prototype for the user interface design",
        "Build a proof of concept for the new algorithm",
        "Develop an MVP to validate the business idea",
        "Prototype the integration between these systems",
      ],
      priority: 75,
      timeout: 60000,
      retryAttempts: 3,
      validation: {
        minInputLength: 15,
        maxInputLength: 12000,
        requiredContext: ["prototype_goal", "target_audience"],
      },
    };
  }

  async onActivate(context: ModeContext): Promise<void> {
    this.emit("modeActivated", {
      mode: this.config.id,
      timestamp: Date.now(),
      context: context.id,
    });

    // Initialize prototyping framework
    this.updateMetrics({
      activationTime: Date.now(),
      prototypeComplexity: this.assessPrototypeComplexity(context),
      fidelityLevel: this.determineFidelityLevel(context),
      iterationScope: this.determineIterationScope(context),
    });

    // Prepare prototyping environment
    await this.preparePrototypingEnvironment(context);
  }

  async onDeactivate(): Promise<void> {
    // Save prototype artifacts and lessons learned
    await this.savePrototypeArtifacts();

    this.emit("modeDeactivated", {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      prototypesCreated: this.metrics.prototypeCount || 0,
      iterationsCompleted: this.designIterations.length,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const _startTime = Date.now();

    try {
      // Prototyping Pipeline
      const _prototypingResults =
        await this.executePrototypingPipeline(context);

      const _processingTime = Date.now() - _startTime;

      this.updateMetrics({
        totalProcessingTime: _processingTime,
        prototypeQuality: _prototypingResults.quality.overall,
        prototypeCount: (this.metrics.prototypeCount || 0) + 1,
        validationScore: _prototypingResults.validation.score,
        iterationEffectiveness: _prototypingResults.iterations.effectiveness,
        usabilityScore: _prototypingResults.usability.score,
        lastProcessedAt: Date.now(),
      });

      // Store prototype information
      await this.storePrototypeInfo(_prototypingResults, context);

      return {
        success: true,
        data: _prototypingResults,
        confidence: this.calculateConfidence(context, _prototypingResults),
        _processingTime,
        metadata: {
          prototypingMethod: _prototypingResults.method,
          fidelityLevel: _prototypingResults.fidelity,
          iterationCount: _prototypingResults.iterations.count,
          validationMethods: _prototypingResults.validation.methods.length,
          feedbackIncorporated: _prototypingResults.feedback.incorporated,
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
    confidence += _keywordMatches.length * 0.15;

    // Prototyping intent detection
    const _prototypingPatterns = [
      /create\s+.+\s+prototype/i,
      /build\s+.+\s+mockup/i,
      /prototype\s+.+\s+for/i,
      /proof\s+of\s+concept\s+for/i,
      /mvp\s+for\s+.+/i,
      /demo\s+.+\s+functionality/i,
      /wireframe\s+.+/i,
      /rapid\s+.+\s+development/i,
    ];

    const _patternMatches = _prototypingPatterns.filter((pattern) =>
      pattern.test(_input),
    );
    confidence += _patternMatches.length * 0.18;

    // Development indicators
    const _developmentTerms = [
      "build",
      "create",
      "develop",
      "design",
      "implement",
      "construct",
    ];
    const _developmentMatches = _developmentTerms.filter((term) =>
      _input.includes(term),
    );
    confidence += _developmentMatches.length * 0.08;

    // Validation terms
    const _validationTerms = [
      "test",
      "validate",
      "verify",
      "check",
      "evaluate",
      "assess",
    ];
    const _validationMatches = _validationTerms.filter((term) =>
      _input.includes(term),
    );
    confidence += _validationMatches.length * 0.1;

    // Context indicators
    if (context.metadata?.requiresPrototyping) {
      confidence += 0.25;
    }
    if (context.metadata?.iterativeDesign) {
      confidence += 0.2;
    }
    if (context.metadata?.rapidDevelopment) {
      confidence += 0.15;
    }

    // Fidelity indicators
    const _fidelityTerms = [
      "low-fi",
      "high-fi",
      "wireframe",
      "mockup",
      "interactive",
    ];
    const _fidelityMatches = _fidelityTerms.filter((term) =>
      _input.includes(term),
    );
    confidence += _fidelityMatches.length * 0.12;

    return Math.min(confidence, 1.0);
  }

  private async executePrototypingPipeline(
    context: ModeContext,
  ): Promise<unknown> {
    const _pipeline = {
      conceptualization: await this.conceptualizePrototype(context),
      planning: await this.planPrototype(context),
      design: await this.designPrototype(context),
      development: await this.developPrototype(context),
      testing: await this.testPrototype(context),
      iteration: await this.iteratePrototype(context),
      validation: await this.validatePrototype(context),
      documentation: await this.documentPrototype(context),
    };

    return {
      method: this.selectPrototypingMethod(context),
      fidelity: this.determineFidelityLevel(context),
      concept: _pipeline.conceptualization,
      plan: _pipeline.planning,
      design: _pipeline.design,
      implementation: _pipeline.development,
      testing: _pipeline.testing,
      iterations: _pipeline.iteration,
      validation: _pipeline.validation,
      quality: this.assessPrototypeQuality(_pipeline),
      usability: this.assessUsability(_pipeline),
      feedback: this.collectFeedback(_pipeline),
      documentation: _pipeline.documentation,
      recommendations: this.generatePrototypingRecommendations(_pipeline),
    };
  }

  private async preparePrototypingEnvironment(
    context: ModeContext,
  ): Promise<void> {
    // Set up tools and resources for prototyping
    this.updateMetrics({
      environmentReady: Date.now(),
      toolsAvailable: this.identifyRequiredTools(context).length,
    });
  }

  private async savePrototypeArtifacts(): Promise<void> {
    // Save prototype artifacts and documentation
    // Implementation would persist to storage
  }

  private async storePrototypeInfo(
    _results: unknown,
    context: ModeContext,
  ): Promise<void> {
    const _prototypeKey = this.generatePrototypeKey(_results, context);
    this.prototypeHistory.set(_prototypeKey, {
      ..._results,
      timestamp: Date.now(),
      contextHash: this.hashContext(context),
    });

    // Add to design iterations
    this.designIterations.push({
      timestamp: Date.now(),
      method: _results.method,
      fidelity: _results.fidelity,
      quality: _results.quality.overall,
    });
  }

  private async conceptualizePrototype(context: ModeContext): Promise<unknown> {
    return {
      purpose: this.identifyPrototypePurpose(context.input),
      goals: this.definePrototypeGoals(context.input),
      scope: this.definePrototypeScope(context.input),
      _constraints: this.identifyConstraints(context.input),
      successcriteria: this.defineSuccessCriteria(context.input),
      targetaudience: this.identifyTargetAudience(context.input),
    };
  }

  private async planPrototype(context: ModeContext): Promise<unknown> {
    return {
      approach: this.selectPrototypingApproach(context),
      timeline: this.createPrototypeTimeline(context),
      resources: this.identifyRequiredResources(context),
      milestones: this.defineMilestones(context),
      risks: this.identifyRisks(context),
      mitigation: this.planRiskMitigation(context),
    };
  }

  private async designPrototype(context: ModeContext): Promise<unknown> {
    return {
      architecture: this.designArchitecture(context),
      userinterface: this.designUserInterface(context),
      userexperience: this.designUserExperience(context),
      technicaldesign: this.designTechnicalAspects(context),
      interactiondesign: this.designInteractions(context),
      visualdesign: this.designVisualElements(context),
    };
  }

  private async developPrototype(context: ModeContext): Promise<unknown> {
    return {
      developmentapproach: this.selectDevelopmentApproach(context),
      technologies: this.selectTechnologies(context),
      implementationplan: this.createImplementationPlan(context),
      qualitymeasures: this.defineQualityMeasures(context),
      testingstrategy: this.defineTestingStrategy(context),
      deploymentplan: this.createDeploymentPlan(context),
    };
  }

  private async testPrototype(context: ModeContext): Promise<unknown> {
    return {
      testtypes: this.selectTestTypes(context),
      testscenarios: this.createTestScenarios(context),
      usertesting: this.planUserTesting(context),
      technicaltesting: this.planTechnicalTesting(context),
      results: this.analyzeTestResults(context),
      improvements: this.identifyImprovements(context),
    };
  }

  private async iteratePrototype(context: ModeContext): Promise<unknown> {
    return {
      count: this.calculateIterationCount(context),
      methodology: this.selectIterationMethodology(context),
      feedbackintegration: this.planFeedbackIntegration(context),
      refinements: this.planRefinements(context),
      effectiveness: this.assessIterationEffectiveness(context),
      convergence: this.assessConvergence(context),
    };
  }

  private async validatePrototype(context: ModeContext): Promise<unknown> {
    return {
      score: this.calculateValidationScore(context),
      methods: this.selectValidationMethods(context),
      criteria: this.defineValidationCriteria(context),
      results: this.analyzeValidationResults(context),
      confidence: this.assessValidationConfidence(context),
      recommendations: this.generateValidationRecommendations(context),
    };
  }

  private async documentPrototype(context: ModeContext): Promise<unknown> {
    return {
      specifications: this.createSpecifications(context),
      userguide: this.createUserGuide(context),
      technicaldocs: this.createTechnicalDocumentation(context),
      lessonslearned: this.documentLessonsLearned(context),
      futureiterations: this.planFutureIterations(context),
      handoffguide: this.createHandoffGuide(context),
    };
  }

  private assessPrototypeComplexity(context: ModeContext): string {
    const _complexityIndicators = context.input.toLowerCase();

    if (
      _complexityIndicators.includes("complex") ||
      _complexityIndicators.includes("advanced")
    ) {
      return "high";
    }
    if (
      _complexityIndicators.includes("simple") ||
      _complexityIndicators.includes("basic")
    ) {
      return "low";
    }
    return "medium";
  }

  private determineFidelityLevel(context: ModeContext): string {
    const _input = context._input.toLowerCase();

    if (
      _input.includes("high-fi") ||
      _input.includes("detailed") ||
      _input.includes("polished")
    ) {
      return "high";
    }
    if (
      _input.includes("low-fi") ||
      _input.includes("rough") ||
      _input.includes("sketch")
    ) {
      return "low";
    }
    return "medium";
  }

  private determineIterationScope(context: ModeContext): string {
    const _wordCount = context.input.split(/\s+/).length;
    if (_wordCount > 150) {
      return "extensive";
    }
    if (_wordCount > 75) {
      return "moderate";
    }
    return "focused";
  }

  private calculateConfidence(_context: ModeContext, results: unknown): number {
    let confidence = 0.75;

    if (results.quality.overall > 0.8) {
      confidence += 0.1;
    }
    if (results.validation.score > 0.8) {
      confidence += 0.08;
    }
    if (results.iterations.effectiveness > 0.7) {
      confidence += 0.07;
    }

    return Math.min(confidence, 1.0);
  }

  private selectPrototypingMethod(context: ModeContext): string {
    const _input = context._input.toLowerCase();

    if (_input.includes("paper") || _input.includes("sketch")) {
      return "paper_prototyping";
    }
    if (_input.includes("digital") || _input.includes("interactive")) {
      return "interactive_prototype";
    }
    if (_input.includes("functional") || _input.includes("working")) {
      return "functional_prototype";
    }
    if (_input.includes("proof") || _input.includes("concept")) {
      return "proof_of_concept";
    }

    return this.prototypingMethods[1]; // default to digital_mockup
  }

  private assessPrototypeQuality(_pipeline: unknown): unknown {
    return {
      overall: 0.8,
      dimensions: {
        functionality: 0.85,
        usability: 0.78,
        design: 0.82,
        technical: 0.8,
        validation: 0.75,
      },
    };
  }

  private assessUsability(_pipeline: unknown): unknown {
    return {
      score: 0.78,
      factors: ["ease_of_use", "intuitive_design", "user_satisfaction"],
      improvements: ["navigation_enhancement", "feedback_clarity"],
    };
  }

  private collectFeedback(_pipeline: unknown): unknown {
    return {
      sources: ["user_testing", "stakeholder_review", "expert_evaluation"],
      summary: "Generally positive with specific improvement areas identified",
      incorporated: true,
      pendingitems: ["color_scheme_adjustment", "interaction_refinement"],
    };
  }

  private generatePrototypingRecommendations(_pipeline: unknown): string[] {
    return [
      "Conduct regular user testing throughout iterations",
      "Document design decisions and rationale",
      "Plan for scalability in technical prototypes",
      "Validate assumptions early and often",
      "Maintain clear communication with stakeholders",
    ];
  }

  // Helper methods for prototyping operations
  private identifyRequiredTools(_context: ModeContext): string[] {
    return ["design_software", "development_environment", "testing_tools"];
  }

  private generatePrototypeKey(
    _results: unknown,
    _context: ModeContext,
  ): string {
    return `prototype_${_results.method}_${Date.now()}`;
  }

  private hashContext(context: ModeContext): string {
    return context.input.slice(0, 20).replace(/\s+/g, "_");
  }

  private identifyPrototypePurpose(_input: string): string {
    if (_input.includes("validate")) {
      return "validation";
    }
    if (_input.includes("test")) {
      return "testing";
    }
    if (_input.includes("demo")) {
      return "demonstration";
    }
    return "exploration";
  }

  private definePrototypeGoals(_input: string): string[] {
    return ["validate_concept", "test_usability", "demonstrate_feasibility"];
  }

  private definePrototypeScope(_input: string): string {
    return "core_functionality_and_key_interactions";
  }

  private identifyConstraints(_input: string): string[] {
    const _constraints = [];
    if (_input.includes("time")) {
      _constraints.push("time_constraint");
    }
    if (_input.includes("budget")) {
      _constraints.push("budget_constraint");
    }
    if (_input.includes("resource")) {
      _constraints.push("resource_constraint");
    }
    return _constraints;
  }

  private defineSuccessCriteria(_input: string): string[] {
    return [
      "user_task_completion",
      "positive_feedback",
      "technical_feasibility_proven",
    ];
  }

  private identifyTargetAudience(_input: string): string[] {
    const _audiences = [];
    if (_input.includes("user")) {
      _audiences.push("end_users");
    }
    if (_input.includes("stakeholder")) {
      _audiences.push("stakeholders");
    }
    if (_input.includes("developer")) {
      _audiences.push("developers");
    }
    return _audiences.length > 0 ? _audiences : ["general_users"];
  }

  private selectPrototypingApproach(_context: ModeContext): string {
    return "iterative_design_thinking";
  }

  private createPrototypeTimeline(_context: ModeContext): unknown {
    return {
      phase1: "concept_and_planning (1 week)",
      phase2: "design_and_development (2-3 weeks)",
      phase3: "testing_and_iteration (1-2 weeks)",
      total: "4-6 weeks",
    };
  }

  private identifyRequiredResources(_context: ModeContext): string[] {
    return [
      "design_tools",
      "development_environment",
      "testing_participants",
      "feedback_collection_system",
    ];
  }

  private defineMilestones(_context: ModeContext): string[] {
    return [
      "concept_approved",
      "first_prototype_complete",
      "user_testing_complete",
      "final_iteration_delivered",
    ];
  }

  private identifyRisks(_context: ModeContext): string[] {
    return [
      "technical_feasibility_uncertainty",
      "user_acceptance_risk",
      "timeline_pressure",
    ];
  }

  private planRiskMitigation(_context: ModeContext): unknown {
    return {
      technicalrisk: "early_technical_spike",
      userrisk: "continuous_user_involvement",
      timelinerisk: "phased_delivery_approach",
    };
  }

  private designArchitecture(_context: ModeContext): unknown {
    return {
      structure: "modular_component_based",
      patterns: ["mvc", "observer"],
      scalability: "horizontal_scaling_ready",
    };
  }

  private designUserInterface(_context: ModeContext): unknown {
    return {
      layout: "responsive_grid_layout",
      navigation: "intuitive_hierarchical",
      components: ["header", "content_area", "sidebar", "footer"],
    };
  }

  private designUserExperience(_context: ModeContext): unknown {
    return {
      userjourney: "streamlined_task_flow",
      interactionmodel: "direct_manipulation",
      feedbackmechanisms: [
        "visual_cues",
        "status_indicators",
        "confirmation_messages",
      ],
    };
  }

  private designTechnicalAspects(_context: ModeContext): unknown {
    return {
      technologystack: "modern_web_technologies",
      performancetargets: "sub_second_response_times",
      scalabilityplan: "microservices_architecture",
    };
  }

  private designInteractions(_context: ModeContext): unknown {
    return {
      primaryinteractions: ["click", "drag", "type"],
      secondaryinteractions: ["hover", "scroll", "gesture"],
      feedbacktypes: ["immediate", "progressive", "completion"],
    };
  }

  private designVisualElements(_context: ModeContext): unknown {
    return {
      colorscheme: "accessible_high_contrast",
      typography: "readable_sans_serif",
      iconography: "intuitive_universal_symbols",
    };
  }

  private selectDevelopmentApproach(_context: ModeContext): string {
    return "agile_iterative_development";
  }

  private selectTechnologies(_context: ModeContext): string[] {
    return ["html5", "css3", "javascript", "react", "nodejs"];
  }

  private createImplementationPlan(_context: ModeContext): unknown {
    return {
      sprint1: "core_functionality",
      sprint2: "user_interface",
      sprint3: "integration_and_testing",
    };
  }

  private defineQualityMeasures(_context: ModeContext): string[] {
    return ["code_coverage", "performance_benchmarks", "usability_metrics"];
  }

  private defineTestingStrategy(_context: ModeContext): string {
    return "comprehensive_testing_pyramid";
  }

  private createDeploymentPlan(_context: ModeContext): unknown {
    return {
      environment: "staging_then_production",
      strategy: "blue_green_deployment",
      rollback: "automated_rollback_capability",
    };
  }

  private selectTestTypes(_context: ModeContext): string[] {
    return ["unit_testing", "integration_testing", "user_acceptance_testing"];
  }

  private createTestScenarios(_context: ModeContext): unknown[] {
    return [
      {
        scenario: "user_completes_primary_task",
        expected: "successful_completion",
      },
      { scenario: "error_handling", expected: "graceful_error_recovery" },
    ];
  }

  private planUserTesting(_context: ModeContext): unknown {
    return {
      participants: "representative_user_group",
      methods: ["task_completion", "think_aloud", "post_test_interview"],
      metrics: ["completion_rate", "time_on_task", "satisfaction_score"],
    };
  }

  private planTechnicalTesting(_context: ModeContext): unknown {
    return {
      performance: "load_and_stress_testing",
      security: "vulnerability_assessment",
      compatibility: "cross_browser_testing",
    };
  }

  private analyzeTestResults(_context: ModeContext): unknown {
    return {
      summary: "generally_positive_with_improvement_areas",
      keyfindings: ["navigation_confusion", "performance_bottleneck"],
      recommendations: ["simplify_navigation", "optimize_database_queries"],
    };
  }

  private identifyImprovements(_context: ModeContext): string[] {
    return [
      "user_interface_refinements",
      "performance_optimizations",
      "accessibility_enhancements",
    ];
  }

  private calculateIterationCount(_context: ModeContext): number {
    return 3; // Typical number of iterations
  }

  private selectIterationMethodology(_context: ModeContext): string {
    return "design_sprint_methodology";
  }

  private planFeedbackIntegration(_context: ModeContext): unknown {
    return {
      collection: "continuous_feedback_loops",
      analysis: "thematic_analysis",
      prioritization: "impact_effort_matrix",
    };
  }

  private planRefinements(_context: ModeContext): string[] {
    return [
      "user_interface_polish",
      "interaction_smoothing",
      "content_optimization",
    ];
  }

  private assessIterationEffectiveness(_context: ModeContext): number {
    return 0.85;
  }

  private assessConvergence(_context: ModeContext): unknown {
    return {
      status: "converging_toward_optimal_solution",
      confidence: 0.8,
      remainingiterations: 1,
    };
  }

  private calculateValidationScore(_context: ModeContext): number {
    return 0.82;
  }

  private selectValidationMethods(_context: ModeContext): string[] {
    return [
      "user_testing",
      "expert_review",
      "heuristic_evaluation",
      "a_b_testing",
    ];
  }

  private defineValidationCriteria(_context: ModeContext): string[] {
    return [
      "usability_score_above_threshold",
      "task_completion_rate",
      "user_satisfaction",
    ];
  }

  private analyzeValidationResults(_context: ModeContext): unknown {
    return {
      usabilityscore: 0.8,
      completionrate: 0.9,
      satisfaction: 0.75,
      overall: "validation_successful_with_minor_improvements_needed",
    };
  }

  private assessValidationConfidence(_context: ModeContext): number {
    return 0.85;
  }

  private generateValidationRecommendations(_context: ModeContext): string[] {
    return [
      "conduct_additional_user_testing",
      "refine_interaction_design",
      "enhance_visual_feedback",
    ];
  }

  private createSpecifications(_context: ModeContext): unknown {
    return {
      functional: "detailed_feature_specifications",
      technical: "architecture_and_implementation_details",
      design: "visual_and_interaction_guidelines",
    };
  }

  private createUserGuide(_context: ModeContext): string {
    return "comprehensive_user_guide_with_screenshots_and_tutorials";
  }

  private createTechnicalDocumentation(_context: ModeContext): unknown {
    return {
      apidocumentation: "complete_api_reference",
      deploymentguide: "step_by_step_deployment_instructions",
      maintenanceguide: "ongoing_maintenance_procedures",
    };
  }

  private documentLessonsLearned(_context: ModeContext): string[] {
    return [
      "early_user_involvement_critical",
      "iterative_approach_effective",
      "technical_constraints_impact_design",
    ];
  }

  private planFutureIterations(_context: ModeContext): unknown {
    return {
      shortterm: "address_current_feedback",
      mediumterm: "add_advanced_features",
      longterm: "scale_for_enterprise_use",
    };
  }

  private createHandoffGuide(_context: ModeContext): string {
    return "complete_handoff_documentation_for_development_team";
  }
}
