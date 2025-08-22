import { BaseMode } from '../base/BaseMode';
import { ModeConfig, ModeContext, ModeResult } from '../types/ModeTypes';
import { EventEmitter } from 'events';

/**
 * Prototyping Mode - Rapid prototype development and iterative design
 * Provides systematic prototyping methodologies with rapid iteration and validation
 */
export class PrototypingMode extends BaseMode {
  private prototypeHistory: Map<string, any> = new Map();
  private designIterations: unknown[] = [];
  private prototypingMethods: string[] = [
    'paper_prototyping',
    'digital_mockup',
    'interactive_prototype',
    'functional_prototype',
    'technical_spike',
    'proof_of_concept',
  ];

  constructor(eventEmitter: EventEmitter) {
    super(eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: 'prototyping',
      name: 'Prototyping Mode',
      category: 'creative',
      description: 'Rapid prototyping with iterative design and validation methodologies',
      keywords: [
        'prototype',
        'mockup',
        'proof of concept',
        'spike',
        'mvp',
        'demo',
        'wireframe',
        'model',
      ],
      triggers: [
        'create prototype',
        'build mockup',
        'prototype this',
        'mvp for',
        'proof of concept',
        'demo',
      ],
      examples: [
        'Create a prototype for the user interface design',
        'Build a proof of concept for the new algorithm',
        'Develop an MVP to validate the business idea',
        'Prototype the integration between these systems',
      ],
      priority: 75,
      timeout: 60000,
      retryAttempts: 3,
      validation: {
        minInputLength: 15,
        maxInputLength: 12000,
        requiredContext: ['prototype_goal', 'target_audience'],
      },
    };
  }

  async onActivate(context: ModeContext): Promise<void> {
    this.emit('modeActivated', {
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

    this.emit('modeDeactivated', {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      prototypesCreated: this.metrics.prototypeCount || 0,
      iterationsCompleted: this.designIterations.length,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const startTime = Date.now();

    try {
      // Prototyping Pipeline
      const prototypingResults = await this.executePrototypingPipeline(context);

      const processingTime = Date.now() - startTime;

      this.updateMetrics({
        totalProcessingTime: processingTime,
        prototypeQuality: prototypingResults.quality.overall,
        prototypeCount: (this.metrics.prototypeCount || 0) + 1,
        validationScore: prototypingResults.validation.score,
        iterationEffectiveness: prototypingResults.iterations.effectiveness,
        usabilityScore: prototypingResults.usability.score,
        lastProcessedAt: Date.now(),
      });

      // Store prototype information
      await this.storePrototypeInfo(prototypingResults, context);

      return {
        success: true,
        data: prototypingResults,
        confidence: this.calculateConfidence(context, prototypingResults),
        processingTime,
        metadata: {
          prototypingMethod: prototypingResults.method,
          fidelityLevel: prototypingResults.fidelity,
          iterationCount: prototypingResults.iterations.count,
          validationMethods: prototypingResults.validation.methods.length,
          feedbackIncorporated: prototypingResults.feedback.incorporated,
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
    confidence += keywordMatches.length * 0.15;

    // Prototyping intent detection
    const prototypingPatterns = [
      /create\s+.+\s+prototype/i,
      /build\s+.+\s+mockup/i,
      /prototype\s+.+\s+for/i,
      /proof\s+of\s+concept\s+for/i,
      /mvp\s+for\s+.+/i,
      /demo\s+.+\s+functionality/i,
      /wireframe\s+.+/i,
      /rapid\s+.+\s+development/i,
    ];

    const patternMatches = prototypingPatterns.filter((pattern) => pattern.test(input));
    confidence += patternMatches.length * 0.18;

    // Development indicators
    const developmentTerms = ['build', 'create', 'develop', 'design', 'implement', 'construct'];
    const developmentMatches = developmentTerms.filter((term) => input.includes(term));
    confidence += developmentMatches.length * 0.08;

    // Validation terms
    const validationTerms = ['test', 'validate', 'verify', 'check', 'evaluate', 'assess'];
    const validationMatches = validationTerms.filter((term) => input.includes(term));
    confidence += validationMatches.length * 0.1;

    // Context indicators
    if (context.metadata?.requiresPrototyping) {confidence += 0.25;}
    if (context.metadata?.iterativeDesign) {confidence += 0.2;}
    if (context.metadata?.rapidDevelopment) {confidence += 0.15;}

    // Fidelity indicators
    const fidelityTerms = ['low-fi', 'high-fi', 'wireframe', 'mockup', 'interactive'];
    const fidelityMatches = fidelityTerms.filter((term) => input.includes(term));
    confidence += fidelityMatches.length * 0.12;

    return Math.min(confidence, 1.0);
  }

  private async executePrototypingPipeline(context: ModeContext): Promise<unknown> {
    const pipeline = {
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
      concept: pipeline.conceptualization,
      plan: pipeline.planning,
      design: pipeline.design,
      implementation: pipeline.development,
      testing: pipeline.testing,
      iterations: pipeline.iteration,
      validation: pipeline.validation,
      quality: this.assessPrototypeQuality(pipeline),
      usability: this.assessUsability(pipeline),
      feedback: this.collectFeedback(pipeline),
      documentation: pipeline.documentation,
      recommendations: this.generatePrototypingRecommendations(pipeline),
    };
  }

  private async preparePrototypingEnvironment(context: ModeContext): Promise<void> {
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

  private async storePrototypeInfo(results: any, context: ModeContext): Promise<void> {
    const prototypeKey = this.generatePrototypeKey(results, context);
    this.prototypeHistory.set(prototypeKey, {
      ...results,
      timestamp: Date.now(),
      contextHash: this.hashContext(context),
    });

    // Add to design iterations
    this.designIterations.push({
      timestamp: Date.now(),
      method: results.method,
      fidelity: results.fidelity,
      quality: results.quality.overall,
    });
  }

  private async conceptualizePrototype(context: ModeContext): Promise<unknown> {
    return {
      purpose: this.identifyPrototypePurpose(context.input),
      goals: this.definePrototypeGoals(context.input),
      scope: this.definePrototypeScope(context.input),
      constraints: this.identifyConstraints(context.input),
      success_criteria: this.defineSuccessCriteria(context.input),
      target_audience: this.identifyTargetAudience(context.input),
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
      user_interface: this.designUserInterface(context),
      user_experience: this.designUserExperience(context),
      technical_design: this.designTechnicalAspects(context),
      interaction_design: this.designInteractions(context),
      visual_design: this.designVisualElements(context),
    };
  }

  private async developPrototype(context: ModeContext): Promise<unknown> {
    return {
      development_approach: this.selectDevelopmentApproach(context),
      technologies: this.selectTechnologies(context),
      implementation_plan: this.createImplementationPlan(context),
      quality_measures: this.defineQualityMeasures(context),
      testing_strategy: this.defineTestingStrategy(context),
      deployment_plan: this.createDeploymentPlan(context),
    };
  }

  private async testPrototype(context: ModeContext): Promise<unknown> {
    return {
      test_types: this.selectTestTypes(context),
      test_scenarios: this.createTestScenarios(context),
      user_testing: this.planUserTesting(context),
      technical_testing: this.planTechnicalTesting(context),
      results: this.analyzeTestResults(context),
      improvements: this.identifyImprovements(context),
    };
  }

  private async iteratePrototype(context: ModeContext): Promise<unknown> {
    return {
      count: this.calculateIterationCount(context),
      methodology: this.selectIterationMethodology(context),
      feedback_integration: this.planFeedbackIntegration(context),
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
      user_guide: this.createUserGuide(context),
      technical_docs: this.createTechnicalDocumentation(context),
      lessons_learned: this.documentLessonsLearned(context),
      future_iterations: this.planFutureIterations(context),
      handoff_guide: this.createHandoffGuide(context),
    };
  }

  private assessPrototypeComplexity(context: ModeContext): string {
    const complexityIndicators = context.input.toLowerCase();

    if (complexityIndicators.includes('complex') || complexityIndicators.includes('advanced')) {
      return 'high';
    }
    if (complexityIndicators.includes('simple') || complexityIndicators.includes('basic')) {
      return 'low';
    }
    return 'medium';
  }

  private determineFidelityLevel(context: ModeContext): string {
    const input = context.input.toLowerCase();

    if (input.includes('high-fi') || input.includes('detailed') || input.includes('polished')) {
      return 'high';
    }
    if (input.includes('low-fi') || input.includes('rough') || input.includes('sketch')) {
      return 'low';
    }
    return 'medium';
  }

  private determineIterationScope(context: ModeContext): string {
    const wordCount = context.input.split(/\s+/).length;
    if (wordCount > 150) {return 'extensive';}
    if (wordCount > 75) {return 'moderate';}
    return 'focused';
  }

  private calculateConfidence(context: ModeContext, results: any): number {
    let confidence = 0.75;

    if (results.quality.overall > 0.8) {confidence += 0.1;}
    if (results.validation.score > 0.8) {confidence += 0.08;}
    if (results.iterations.effectiveness > 0.7) {confidence += 0.07;}

    return Math.min(confidence, 1.0);
  }

  private selectPrototypingMethod(context: ModeContext): string {
    const input = context.input.toLowerCase();

    if (input.includes('paper') || input.includes('sketch')) {
      return 'paper_prototyping';
    }
    if (input.includes('digital') || input.includes('interactive')) {
      return 'interactive_prototype';
    }
    if (input.includes('functional') || input.includes('working')) {
      return 'functional_prototype';
    }
    if (input.includes('proof') || input.includes('concept')) {
      return 'proof_of_concept';
    }

    return this.prototypingMethods[1]; // default to digital_mockup
  }

  private assessPrototypeQuality(pipeline: any): any {
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

  private assessUsability(pipeline: any): any {
    return {
      score: 0.78,
      factors: ['ease_of_use', 'intuitive_design', 'user_satisfaction'],
      improvements: ['navigation_enhancement', 'feedback_clarity'],
    };
  }

  private collectFeedback(pipeline: any): any {
    return {
      sources: ['user_testing', 'stakeholder_review', 'expert_evaluation'],
      summary: 'Generally positive with specific improvement areas identified',
      incorporated: true,
      pending_items: ['color_scheme_adjustment', 'interaction_refinement'],
    };
  }

  private generatePrototypingRecommendations(pipeline: any): string[] {
    return [
      'Conduct regular user testing throughout iterations',
      'Document design decisions and rationale',
      'Plan for scalability in technical prototypes',
      'Validate assumptions early and often',
      'Maintain clear communication with stakeholders',
    ];
  }

  // Helper methods for prototyping operations
  private identifyRequiredTools(context: ModeContext): string[] {
    return ['design_software', 'development_environment', 'testing_tools'];
  }

  private generatePrototypeKey(results: any, context: ModeContext): string {
    return `prototype_${results.method}_${Date.now()}`;
  }

  private hashContext(context: ModeContext): string {
    return context.input.slice(0, 20).replace(/\s+/g, '_');
  }

  private identifyPrototypePurpose(input: string): string {
    if (input.includes('validate')) {return 'validation';}
    if (input.includes('test')) {return 'testing';}
    if (input.includes('demo')) {return 'demonstration';}
    return 'exploration';
  }

  private definePrototypeGoals(input: string): string[] {
    return ['validate_concept', 'test_usability', 'demonstrate_feasibility'];
  }

  private definePrototypeScope(input: string): string {
    return 'core_functionality_and_key_interactions';
  }

  private identifyConstraints(input: string): string[] {
    const constraints = [];
    if (input.includes('time')) {constraints.push('time_constraint');}
    if (input.includes('budget')) {constraints.push('budget_constraint');}
    if (input.includes('resource')) {constraints.push('resource_constraint');}
    return constraints;
  }

  private defineSuccessCriteria(input: string): string[] {
    return ['user_task_completion', 'positive_feedback', 'technical_feasibility_proven'];
  }

  private identifyTargetAudience(input: string): string[] {
    const audiences = [];
    if (input.includes('user')) {audiences.push('end_users');}
    if (input.includes('stakeholder')) {audiences.push('stakeholders');}
    if (input.includes('developer')) {audiences.push('developers');}
    return audiences.length > 0 ? audiences : ['general_users'];
  }

  private selectPrototypingApproach(context: ModeContext): string {
    return 'iterative_design_thinking';
  }

  private createPrototypeTimeline(context: ModeContext): any {
    return {
      phase1: 'concept_and_planning (1 week)',
      phase2: 'design_and_development (2-3 weeks)',
      phase3: 'testing_and_iteration (1-2 weeks)',
      total: '4-6 weeks',
    };
  }

  private identifyRequiredResources(context: ModeContext): string[] {
    return [
      'design_tools',
      'development_environment',
      'testing_participants',
      'feedback_collection_system',
    ];
  }

  private defineMilestones(context: ModeContext): string[] {
    return [
      'concept_approved',
      'first_prototype_complete',
      'user_testing_complete',
      'final_iteration_delivered',
    ];
  }

  private identifyRisks(context: ModeContext): string[] {
    return ['technical_feasibility_uncertainty', 'user_acceptance_risk', 'timeline_pressure'];
  }

  private planRiskMitigation(context: ModeContext): any {
    return {
      technical_risk: 'early_technical_spike',
      user_risk: 'continuous_user_involvement',
      timeline_risk: 'phased_delivery_approach',
    };
  }

  private designArchitecture(context: ModeContext): any {
    return {
      structure: 'modular_component_based',
      patterns: ['mvc', 'observer'],
      scalability: 'horizontal_scaling_ready',
    };
  }

  private designUserInterface(context: ModeContext): any {
    return {
      layout: 'responsive_grid_layout',
      navigation: 'intuitive_hierarchical',
      components: ['header', 'content_area', 'sidebar', 'footer'],
    };
  }

  private designUserExperience(context: ModeContext): any {
    return {
      user_journey: 'streamlined_task_flow',
      interaction_model: 'direct_manipulation',
      feedback_mechanisms: ['visual_cues', 'status_indicators', 'confirmation_messages'],
    };
  }

  private designTechnicalAspects(context: ModeContext): any {
    return {
      technology_stack: 'modern_web_technologies',
      performance_targets: 'sub_second_response_times',
      scalability_plan: 'microservices_architecture',
    };
  }

  private designInteractions(context: ModeContext): any {
    return {
      primary_interactions: ['click', 'drag', 'type'],
      secondary_interactions: ['hover', 'scroll', 'gesture'],
      feedback_types: ['immediate', 'progressive', 'completion'],
    };
  }

  private designVisualElements(context: ModeContext): any {
    return {
      color_scheme: 'accessible_high_contrast',
      typography: 'readable_sans_serif',
      iconography: 'intuitive_universal_symbols',
    };
  }

  private selectDevelopmentApproach(context: ModeContext): string {
    return 'agile_iterative_development';
  }

  private selectTechnologies(context: ModeContext): string[] {
    return ['html5', 'css3', 'javascript', 'react', 'nodejs'];
  }

  private createImplementationPlan(context: ModeContext): any {
    return {
      sprint1: 'core_functionality',
      sprint2: 'user_interface',
      sprint3: 'integration_and_testing',
    };
  }

  private defineQualityMeasures(context: ModeContext): string[] {
    return ['code_coverage', 'performance_benchmarks', 'usability_metrics'];
  }

  private defineTestingStrategy(context: ModeContext): string {
    return 'comprehensive_testing_pyramid';
  }

  private createDeploymentPlan(context: ModeContext): any {
    return {
      environment: 'staging_then_production',
      strategy: 'blue_green_deployment',
      rollback: 'automated_rollback_capability',
    };
  }

  private selectTestTypes(context: ModeContext): string[] {
    return ['unit_testing', 'integration_testing', 'user_acceptance_testing'];
  }

  private createTestScenarios(context: ModeContext): unknown[] {
    return [
      { scenario: 'user_completes_primary_task', expected: 'successful_completion' },
      { scenario: 'error_handling', expected: 'graceful_error_recovery' },
    ];
  }

  private planUserTesting(context: ModeContext): any {
    return {
      participants: 'representative_user_group',
      methods: ['task_completion', 'think_aloud', 'post_test_interview'],
      metrics: ['completion_rate', 'time_on_task', 'satisfaction_score'],
    };
  }

  private planTechnicalTesting(context: ModeContext): any {
    return {
      performance: 'load_and_stress_testing',
      security: 'vulnerability_assessment',
      compatibility: 'cross_browser_testing',
    };
  }

  private analyzeTestResults(context: ModeContext): any {
    return {
      summary: 'generally_positive_with_improvement_areas',
      key_findings: ['navigation_confusion', 'performance_bottleneck'],
      recommendations: ['simplify_navigation', 'optimize_database_queries'],
    };
  }

  private identifyImprovements(context: ModeContext): string[] {
    return [
      'user_interface_refinements',
      'performance_optimizations',
      'accessibility_enhancements',
    ];
  }

  private calculateIterationCount(context: ModeContext): number {
    return 3; // Typical number of iterations
  }

  private selectIterationMethodology(context: ModeContext): string {
    return 'design_sprint_methodology';
  }

  private planFeedbackIntegration(context: ModeContext): any {
    return {
      collection: 'continuous_feedback_loops',
      analysis: 'thematic_analysis',
      prioritization: 'impact_effort_matrix',
    };
  }

  private planRefinements(context: ModeContext): string[] {
    return ['user_interface_polish', 'interaction_smoothing', 'content_optimization'];
  }

  private assessIterationEffectiveness(context: ModeContext): number {
    return 0.85;
  }

  private assessConvergence(context: ModeContext): any {
    return {
      status: 'converging_toward_optimal_solution',
      confidence: 0.8,
      remaining_iterations: 1,
    };
  }

  private calculateValidationScore(context: ModeContext): number {
    return 0.82;
  }

  private selectValidationMethods(context: ModeContext): string[] {
    return ['user_testing', 'expert_review', 'heuristic_evaluation', 'a_b_testing'];
  }

  private defineValidationCriteria(context: ModeContext): string[] {
    return ['usability_score_above_threshold', 'task_completion_rate', 'user_satisfaction'];
  }

  private analyzeValidationResults(context: ModeContext): any {
    return {
      usability_score: 0.8,
      completion_rate: 0.9,
      satisfaction: 0.75,
      overall: 'validation_successful_with_minor_improvements_needed',
    };
  }

  private assessValidationConfidence(context: ModeContext): number {
    return 0.85;
  }

  private generateValidationRecommendations(context: ModeContext): string[] {
    return [
      'conduct_additional_user_testing',
      'refine_interaction_design',
      'enhance_visual_feedback',
    ];
  }

  private createSpecifications(context: ModeContext): any {
    return {
      functional: 'detailed_feature_specifications',
      technical: 'architecture_and_implementation_details',
      design: 'visual_and_interaction_guidelines',
    };
  }

  private createUserGuide(context: ModeContext): string {
    return 'comprehensive_user_guide_with_screenshots_and_tutorials';
  }

  private createTechnicalDocumentation(context: ModeContext): any {
    return {
      api_documentation: 'complete_api_reference',
      deployment_guide: 'step_by_step_deployment_instructions',
      maintenance_guide: 'ongoing_maintenance_procedures',
    };
  }

  private documentLessonsLearned(context: ModeContext): string[] {
    return [
      'early_user_involvement_critical',
      'iterative_approach_effective',
      'technical_constraints_impact_design',
    ];
  }

  private planFutureIterations(context: ModeContext): any {
    return {
      short_term: 'address_current_feedback',
      medium_term: 'add_advanced_features',
      long_term: 'scale_for_enterprise_use',
    };
  }

  private createHandoffGuide(context: ModeContext): string {
    return 'complete_handoff_documentation_for_development_team';
  }
}
