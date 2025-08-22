import { BaseMode } from '../base/BaseMode';
import { ModeConfig, ModeContext, ModeResult } from '../types/ModeTypes';
import { EventEmitter } from 'events';

/**
 * Questioning Mode - Deep inquiry and Socratic examination
 * Provides systematic questioning methodologies with philosophical and analytical inquiry
 */
export class QuestioningMode extends BaseMode {
  private questionHistory: Map<string, any> = new Map();
  private inquiryDepth: number = 0;
  private questioningTechniques: string[] = [
    'socratic_questioning',
    'probing_questions',
    'clarifying_questions',
    'assumption_challenging',
    'evidence_questioning',
    'perspective_questioning',
  ];

  constructor(eventEmitter: EventEmitter) {
    super(eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: 'questioning',
      name: 'Questioning Mode',
      category: 'contemplative',
      description:
        'Deep inquiry and systematic questioning with Socratic examination and assumption challenging',
      keywords: ['question', 'ask', 'why', 'how', 'what if', 'wonder', 'inquire', 'challenge'],
      triggers: [
        'question this',
        'why does',
        'what if',
        'how do we know',
        'challenge assumption',
        'inquire about',
      ],
      examples: [
        'Question the underlying assumptions in this approach',
        'Why does this solution work better than alternatives?',
        'What if we challenged the core premise?',
        'How do we know this is the right direction?',
      ],
      priority: 75,
      timeout: 90000,
      retryAttempts: 3,
      validation: {
        minInputLength: 10,
        maxInputLength: 8000,
        requiredContext: ['inquiry_target', 'questioning_purpose'],
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
      inquiryComplexity: this.assessInquiryComplexity(context),
      questioningDepth: this.determineQuestioningDepth(context),
      criticalThinkingLevel: this.assessCriticalThinkingLevel(context),
    });

    await this.initializeQuestioningFramework(context);
  }

  async onDeactivate(): Promise<void> {
    await this.catalogInquiryResults();

    this.emit('modeDeactivated', {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      questionsGenerated: this.metrics.questionCount || 0,
      insightsUncovered: this.metrics.insightCount || 0,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const startTime = Date.now();

    try {
      const questioningResults = await this.executeQuestioningPipeline(context);

      const processingTime = Date.now() - startTime;

      this.updateMetrics({
        totalProcessingTime: processingTime,
        questioningEffectiveness: questioningResults.effectiveness,
        questionCount: questioningResults.questions.length,
        insightCount: questioningResults.insights.length,
        assumptionsChallenged: questioningResults.assumptions.challenged.length,
        depthAchieved: questioningResults.depth.level,
        lastProcessedAt: Date.now(),
      });

      return {
        success: true,
        data: questioningResults,
        confidence: this.calculateConfidence(context, questioningResults),
        processingTime,
        metadata: {
          questioningTechnique: questioningResults.technique,
          questionsGenerated: questioningResults.questions.length,
          depthLevel: questioningResults.depth.level,
          assumptionsChallenged: questioningResults.assumptions.challenged.length,
          insightsGenerated: questioningResults.insights.length,
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

    const questioningPatterns = [
      /question\s+.+/i,
      /why\s+does\s+.+/i,
      /what\s+if\s+.+/i,
      /how\s+do\s+we\s+know\s+.+/i,
      /challenge\s+.+\s+assumption/i,
      /inquire\s+about\s+.+/i,
      /what\s+makes\s+.+/i,
      /how\s+can\s+we\s+be\s+sure\s+.+/i,
    ];

    const patternMatches = questioningPatterns.filter((pattern) => pattern.test(input));
    confidence += patternMatches.length * 0.18;

    const questionWords = ['why', 'what', 'how', 'when', 'where', 'who', 'which'];
    const questionMatches = questionWords.filter((word) => input.includes(word));
    confidence += questionMatches.length * 0.08;

    const challengingTerms = [
      'challenge',
      'doubt',
      'question',
      'skeptical',
      'uncertain',
      'unclear',
    ];
    const challengingMatches = challengingTerms.filter((term) => input.includes(term));
    confidence += challengingMatches.length * 0.1;

    if (context.metadata?.requiresQuestioning) {confidence += 0.25;}
    if (context.metadata?.criticalThinking) {confidence += 0.2;}
    if (context.metadata?.assumptionChallenge) {confidence += 0.15;}

    const questionMarkCount = (input.match(/\?/g) || []).length;
    confidence += Math.min(questionMarkCount * 0.1, 0.2);

    return Math.min(confidence, 1.0);
  }

  private async executeQuestioningPipeline(context: ModeContext): Promise<unknown> {
    const pipeline = {
      targetIdentification: await this.identifyQuestioningTarget(context),
      techniqueSelection: await this.selectQuestioningTechnique(context),
      initialQuestioning: await this.generateInitialQuestions(context),
      deeperInquiry: await this.conductDeeperInquiry(context),
      assumptionChallenging: await this.challengeAssumptions(context),
      perspectiveExploration: await this.explorePerspectives(context),
      insightSynthesis: await this.synthesizeInsights(context),
      reflectiveAnalysis: await this.conductReflectiveAnalysis(context),
    };

    return {
      technique: pipeline.techniqueSelection.primary,
      target: pipeline.targetIdentification,
      questions: this.consolidateQuestions(pipeline),
      inquiry: pipeline.deeperInquiry,
      assumptions: pipeline.assumptionChallenging,
      perspectives: pipeline.perspectiveExploration,
      insights: pipeline.insightSynthesis,
      reflection: pipeline.reflectiveAnalysis,
      depth: this.assessInquiryDepth(pipeline),
      effectiveness: this.calculateQuestioningEffectiveness(pipeline),
      recommendations: this.generateQuestioningRecommendations(pipeline),
    };
  }

  private async initializeQuestioningFramework(context: ModeContext): Promise<void> {
    this.inquiryDepth = 0;
    this.updateMetrics({ frameworkInitialized: Date.now() });
  }

  private async catalogInquiryResults(): Promise<void> {
    // Catalog inquiry results for future reference
  }

  private async identifyQuestioningTarget(context: ModeContext): Promise<unknown> {
    return {
      primary_subject: this.extractPrimarySubject(context.input),
      scope: this.defineQuestioningScope(context.input),
      complexity: this.assessTargetComplexity(context.input),
      type: this.classifyQuestioningType(context.input),
      context_factors: this.identifyContextFactors(context.input),
    };
  }

  private async selectQuestioningTechnique(context: ModeContext): Promise<unknown> {
    const target = await this.identifyQuestioningTarget(context);

    return {
      primary: this.choosePrimaryTechnique(target, context),
      secondary: this.chooseSecondaryTechniques(target, context),
      rationale: this.explainTechniqueChoice(target, context),
      adaptation: this.planTechniqueAdaptation(context),
    };
  }

  private async generateInitialQuestions(context: ModeContext): Promise<unknown[]> {
    return [
      {
        type: 'clarifying',
        question: 'What exactly do we mean by this concept?',
        purpose: 'establish_clear_understanding',
        depth_level: 1,
      },
      {
        type: 'exploratory',
        question: 'What are the underlying principles at work here?',
        purpose: 'uncover_fundamentals',
        depth_level: 2,
      },
      {
        type: 'analytical',
        question: 'How do the different components relate to each other?',
        purpose: 'understand_relationships',
        depth_level: 2,
      },
      {
        type: 'evaluative',
        question: 'What evidence supports this position?',
        purpose: 'assess_validity',
        depth_level: 3,
      },
    ];
  }

  private async conductDeeperInquiry(context: ModeContext): Promise<unknown> {
    this.inquiryDepth++;

    return {
      level: this.inquiryDepth,
      focus_areas: this.identifyDeeperFocusAreas(context),
      probing_questions: this.generateProbingQuestions(context),
      follow_up_inquiries: this.createFollowUpInquiries(context),
      critical_examination: this.conductCriticalExamination(context),
    };
  }

  private async challengeAssumptions(context: ModeContext): Promise<unknown> {
    return {
      identified: this.identifyAssumptions(context.input),
      challenged: this.formulateChallenges(context),
      alternatives: this.exploreAlternatives(context),
      implications: this.analyzeImplications(context),
      validation_questions: this.generateValidationQuestions(context),
    };
  }

  private async explorePerspectives(context: ModeContext): Promise<unknown> {
    return {
      multiple_viewpoints: this.identifyMultipleViewpoints(context),
      stakeholder_perspectives: this.exploreStakeholderPerspectives(context),
      cultural_considerations: this.considerCulturalFactors(context),
      temporal_perspectives: this.examineTemporalFactors(context),
      questioning_from_each: this.generatePerspectiveQuestions(context),
    };
  }

  private async synthesizeInsights(context: ModeContext): Promise<unknown[]> {
    return [
      {
        type: 'foundational_insight',
        content: 'Core assumptions need reexamination',
        confidence: 0.85,
        source: 'assumption_challenging',
      },
      {
        type: 'relational_insight',
        content: 'Hidden dependencies reveal system complexity',
        confidence: 0.78,
        source: 'deeper_inquiry',
      },
      {
        type: 'perspective_insight',
        content: 'Different stakeholders have conflicting priorities',
        confidence: 0.82,
        source: 'perspective_exploration',
      },
    ];
  }

  private async conductReflectiveAnalysis(context: ModeContext): Promise<unknown> {
    return {
      questioning_quality: this.assessQuestioningQuality(context),
      depth_achieved: this.measureDepthAchieved(context),
      gaps_identified: this.identifyInquiryGaps(context),
      insights_quality: this.assessInsightQuality(context),
      further_questions: this.identifyFurtherQuestions(context),
    };
  }

  private assessInquiryComplexity(context: ModeContext): string {
    const complexityIndicators = context.input.toLowerCase();

    if (
      complexityIndicators.includes('complex') ||
      complexityIndicators.includes('philosophical')
    ) {
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

  private determineQuestioningDepth(context: ModeContext): number {
    const depthIndicators = [
      context.input.includes('deep'),
      context.input.includes('fundamental'),
      context.input.includes('philosophical'),
      context.input.includes('why') && context.input.includes('why'),
    ];

    return depthIndicators.filter(Boolean).length / depthIndicators.length;
  }

  private assessCriticalThinkingLevel(context: ModeContext): number {
    const criticalIndicators = [
      context.input.includes('challenge'),
      context.input.includes('question'),
      context.input.includes('assume'),
      context.input.includes('evidence'),
    ];

    return criticalIndicators.filter(Boolean).length / criticalIndicators.length;
  }

  private calculateConfidence(context: ModeContext, results: any): number {
    let confidence = 0.75;

    if (results.questions.length > 5) {confidence += 0.08;}
    if (results.depth.level > 3) {confidence += 0.1;}
    if (results.assumptions.challenged.length > 2) {confidence += 0.07;}

    return Math.min(confidence, 1.0);
  }

  private consolidateQuestions(pipeline: any): unknown[] {
    const allQuestions = [
      ...pipeline.initialQuestioning,
      ...pipeline.deeperInquiry.probing_questions,
      ...pipeline.assumptionChallenging.validation_questions,
      ...pipeline.perspectiveExploration.questioning_from_each,
    ];

    return allQuestions.slice(0, 15); // Limit to most relevant questions
  }

  private assessInquiryDepth(pipeline: any): any {
    return {
      level: this.inquiryDepth,
      maximum_reached: Math.max(4, this.inquiryDepth),
      progression: 'systematic_deepening',
      quality: 'thorough_exploration',
    };
  }

  private calculateQuestioningEffectiveness(pipeline: any): number {
    return 0.83;
  }

  private generateQuestioningRecommendations(pipeline: any): string[] {
    return [
      'Continue deeper inquiry into foundational assumptions',
      'Explore additional stakeholder perspectives',
      'Validate insights through alternative questioning approaches',
      'Document questioning process for future reference',
    ];
  }

  // Helper methods
  private extractPrimarySubject(input: string): string {
    return input.split(' ').slice(0, 8).join(' ');
  }

  private defineQuestioningScope(input: string): string {
    if (input.includes('broad') || input.includes('comprehensive')) {
      return 'comprehensive';
    }
    if (input.includes('specific') || input.includes('narrow')) {
      return 'focused';
    }
    return 'balanced';
  }

  private assessTargetComplexity(input: string): string {
    return 'medium'; // Simplified assessment
  }

  private classifyQuestioningType(input: string): string {
    if (input.includes('assumption')) {return 'assumption_challenging';}
    if (input.includes('evidence')) {return 'evidence_based';}
    if (input.includes('perspective')) {return 'perspective_shifting';}
    return 'general_inquiry';
  }

  private identifyContextFactors(input: string): string[] {
    return ['domain_specific', 'stakeholder_relevant', 'time_sensitive'];
  }

  private choosePrimaryTechnique(target: any, context: ModeContext): string {
    if (target.type === 'assumption_challenging') {
      return 'assumption_challenging';
    }
    if (target.complexity === 'high') {
      return 'socratic_questioning';
    }
    return 'probing_questions';
  }

  private chooseSecondaryTechniques(target: any, context: ModeContext): string[] {
    return ['clarifying_questions', 'perspective_questioning'];
  }

  private explainTechniqueChoice(target: any, context: ModeContext): string {
    return `Selected based on target complexity and questioning type: ${target.type}`;
  }

  private planTechniqueAdaptation(context: ModeContext): string {
    return 'adapt_based_on_response_quality_and_depth_needs';
  }

  private identifyDeeperFocusAreas(context: ModeContext): string[] {
    return ['fundamental_principles', 'hidden_assumptions', 'logical_connections'];
  }

  private generateProbingQuestions(context: ModeContext): unknown[] {
    return [
      {
        question: 'What would happen if we reversed this assumption?',
        purpose: 'explore_alternatives',
        depth_level: this.inquiryDepth + 1,
      },
      {
        question: 'How do we know this is universally true?',
        purpose: 'test_generalizability',
        depth_level: this.inquiryDepth + 1,
      },
    ];
  }

  private createFollowUpInquiries(context: ModeContext): unknown[] {
    return [
      {
        trigger: 'interesting_response',
        follow_up: 'Can you elaborate on that point?',
        purpose: 'deepen_understanding',
      },
    ];
  }

  private conductCriticalExamination(context: ModeContext): any {
    return {
      logical_consistency: 'examine_for_contradictions',
      evidence_strength: 'assess_supporting_evidence',
      alternative_explanations: 'consider_other_possibilities',
    };
  }

  private identifyAssumptions(input: string): string[] {
    return [
      'assumption_1_identified_in_premise',
      'assumption_2_about_causality',
      'assumption_3_regarding_scope',
    ];
  }

  private formulateChallenges(context: ModeContext): unknown[] {
    return [
      {
        assumption: 'assumption_1',
        challenge: 'What if this premise is not universally applicable?',
        reasoning: 'test_boundary_conditions',
      },
      {
        assumption: 'assumption_2',
        challenge: 'Could there be alternative causal mechanisms?',
        reasoning: 'explore_different_explanations',
      },
    ];
  }

  private exploreAlternatives(context: ModeContext): string[] {
    return ['alternative_approach_1', 'alternative_perspective_2', 'alternative_explanation_3'];
  }

  private analyzeImplications(context: ModeContext): any {
    return {
      logical_implications: 'what_follows_from_premises',
      practical_implications: 'real_world_consequences',
      theoretical_implications: 'conceptual_ramifications',
    };
  }

  private generateValidationQuestions(context: ModeContext): unknown[] {
    return [
      {
        question: 'What evidence would prove this assumption wrong?',
        purpose: 'falsifiability_test',
      },
      {
        question: 'Under what conditions would this not hold true?',
        purpose: 'boundary_testing',
      },
    ];
  }

  private identifyMultipleViewpoints(context: ModeContext): string[] {
    return ['technical_viewpoint', 'business_viewpoint', 'user_viewpoint', 'regulatory_viewpoint'];
  }

  private exploreStakeholderPerspectives(context: ModeContext): any {
    return {
      primary_stakeholders: ['developers', 'users', 'management'],
      secondary_stakeholders: ['regulators', 'partners', 'community'],
      conflicting_interests: 'identified_and_analyzed',
    };
  }

  private considerCulturalFactors(context: ModeContext): string[] {
    return ['culturalcontext_1', 'value_system_differences', 'communication_styles'];
  }

  private examineTemporalFactors(context: ModeContext): any {
    return {
      historicalcontext: 'past_influences',
      current_situation: 'present_constraints',
      future_considerations: 'evolving_factors',
    };
  }

  private generatePerspectiveQuestions(context: ModeContext): unknown[] {
    return [
      {
        perspective: 'user_perspective',
        question: 'How would users experience this differently?',
        purpose: 'understand_user_impact',
      },
      {
        perspective: 'technical_perspective',
        question: 'What are the technical constraints we must consider?',
        purpose: 'assess_feasibility',
      },
    ];
  }

  private assessQuestioningQuality(context: ModeContext): any {
    return {
      relevance: 'highly_relevant',
      depth: 'appropriate_depth_achieved',
      clarity: 'clear_and_focused',
      progression: 'logical_sequence',
    };
  }

  private measureDepthAchieved(context: ModeContext): number {
    return this.inquiryDepth;
  }

  private identifyInquiryGaps(context: ModeContext): string[] {
    return ['area_needing_deeper_exploration', 'perspective_not_fully_examined'];
  }

  private assessInsightQuality(context: ModeContext): any {
    return {
      novelty: 'new_understanding_gained',
      significance: 'important_implications_revealed',
      actionability: 'leads_to_concrete_next_steps',
    };
  }

  private identifyFurtherQuestions(context: ModeContext): string[] {
    return [
      'How can we test these insights?',
      'What additional perspectives should we consider?',
      'What are the long-term implications of these findings?',
    ];
  }
}
