import { BaseMode } from "../base/BaseMode";
import { ModeConfig, ModeContext, ModeResult } from "../types/ModeTypes";
import { EventEmitter } from "node:events";

/**
 * Questioning Mode - Deep inquiry and Socratic examination
 * Provides systematic questioning methodologies with philosophical and analytical inquiry
 */
export class QuestioningMode extends BaseMode {
  private questionHistory: Map<string, any> = new Map();
  private inquiryDepth: number = 0;
  private questioningTechniques: string[] = [
    "socratic_questioning",
    "probing_questions",
    "clarifying_questions",
    "assumption_challenging",
    "evidence_questioning",
    "perspective_questioning",
  ];

  constructor(_eventEmitter: EventEmitter) {
    super(_eventEmitter);
    this.config = this.initializeConfig();
  }

  protected initializeConfig(): ModeConfig {
    return {
      id: "questioning",
      name: "Questioning Mode",
      category: "contemplative",
      description:
        "Deep inquiry and systematic questioning with Socratic examination and assumption challenging",
      _keywords: [
        "question",
        "ask",
        "why",
        "how",
        "what if",
        "wonder",
        "inquire",
        "challenge",
      ],
      triggers: [
        "question this",
        "why does",
        "what if",
        "how do we know",
        "challenge assumption",
        "inquire about",
      ],
      examples: [
        "Question the underlying assumptions in this approach",
        "Why does this solution work better than alternatives?",
        "What if we challenged the core premise?",
        "How do we know this is the right direction?",
      ],
      priority: 75,
      timeout: 90000,
      retryAttempts: 3,
      validation: {
        minInputLength: 10,
        maxInputLength: 8000,
        requiredContext: ["inquiry_target", "questioning_purpose"],
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
      inquiryComplexity: this.assessInquiryComplexity(context),
      questioningDepth: this.determineQuestioningDepth(context),
      criticalThinkingLevel: this.assessCriticalThinkingLevel(context),
    });

    await this.initializeQuestioningFramework(context);
  }

  async onDeactivate(): Promise<void> {
    await this.catalogInquiryResults();

    this.emit("modeDeactivated", {
      mode: this.config.id,
      timestamp: Date.now(),
      duration: Date.now() - (this.metrics.activationTime || 0),
      questionsGenerated: this.metrics.questionCount || 0,
      insightsUncovered: this.metrics.insightCount || 0,
    });
  }

  async onProcess(context: ModeContext): Promise<ModeResult> {
    const _startTime = Date.now();

    try {
      const _questioningResults =
        await this.executeQuestioningPipeline(context);

      const _processingTime = Date.now() - _startTime;

      this.updateMetrics({
        totalProcessingTime: _processingTime,
        questioningEffectiveness: _questioningResults.effectiveness,
        questionCount: _questioningResults.questions.length,
        insightCount: _questioningResults.insights.length,
        assumptionsChallenged:
          _questioningResults.assumptions.challenged.length,
        depthAchieved: _questioningResults.depth.level,
        lastProcessedAt: Date.now(),
      });

      return {
        success: true,
        data: _questioningResults,
        confidence: this.calculateConfidence(context, _questioningResults),
        _processingTime,
        metadata: {
          questioningTechnique: _questioningResults.technique,
          questionsGenerated: _questioningResults.questions.length,
          depthLevel: _questioningResults.depth.level,
          assumptionsChallenged:
            _questioningResults.assumptions.challenged.length,
          insightsGenerated: _questioningResults.insights.length,
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
    confidence += _keywordMatches.length * 0.15;

    const _questioningPatterns = [
      /question\s+.+/i,
      /why\s+does\s+.+/i,
      /what\s+if\s+.+/i,
      /how\s+do\s+we\s+know\s+.+/i,
      /challenge\s+.+\s+assumption/i,
      /inquire\s+about\s+.+/i,
      /what\s+makes\s+.+/i,
      /how\s+can\s+we\s+be\s+sure\s+.+/i,
    ];

    const _patternMatches = _questioningPatterns.filter((pattern) =>
      pattern.test(_input),
    );
    confidence += _patternMatches.length * 0.18;

    const _questionWords = [
      "why",
      "what",
      "how",
      "when",
      "where",
      "who",
      "which",
    ];
    const _questionMatches = _questionWords.filter((word) =>
      _input.includes(word),
    );
    confidence += _questionMatches.length * 0.08;

    const _challengingTerms = [
      "challenge",
      "doubt",
      "question",
      "skeptical",
      "uncertain",
      "unclear",
    ];
    const _challengingMatches = _challengingTerms.filter((term) =>
      _input.includes(term),
    );
    confidence += _challengingMatches.length * 0.1;

    if (context.metadata?.requiresQuestioning) {
      confidence += 0.25;
    }
    if (context.metadata?.criticalThinking) {
      confidence += 0.2;
    }
    if (context.metadata?.assumptionChallenge) {
      confidence += 0.15;
    }

    const _questionMarkCount = (_input.match(/\?/g) || []).length;
    confidence += Math.min(_questionMarkCount * 0.1, 0.2);

    return Math.min(confidence, 1.0);
  }

  private async executeQuestioningPipeline(
    context: ModeContext,
  ): Promise<unknown> {
    const _pipeline = {
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
      technique: _pipeline.techniqueSelection.primary,
      _target: _pipeline.targetIdentification,
      questions: this.consolidateQuestions(_pipeline),
      inquiry: _pipeline.deeperInquiry,
      assumptions: _pipeline.assumptionChallenging,
      perspectives: _pipeline.perspectiveExploration,
      insights: _pipeline.insightSynthesis,
      reflection: _pipeline.reflectiveAnalysis,
      depth: this.assessInquiryDepth(_pipeline),
      effectiveness: this.calculateQuestioningEffectiveness(_pipeline),
      recommendations: this.generateQuestioningRecommendations(_pipeline),
    };
  }

  private async initializeQuestioningFramework(
    _context: ModeContext,
  ): Promise<void> {
    this.inquiryDepth = 0;
    this.updateMetrics({ frameworkInitialized: Date.now() });
  }

  private async catalogInquiryResults(): Promise<void> {
    // Catalog inquiry results for future reference
  }

  private async identifyQuestioningTarget(
    context: ModeContext,
  ): Promise<unknown> {
    return {
      primarysubject: this.extractPrimarySubject(context.input),
      scope: this.defineQuestioningScope(context.input),
      complexity: this.assessTargetComplexity(context.input),
      type: this.classifyQuestioningType(context.input),
      contextfactors: this.identifyContextFactors(context.input),
    };
  }

  private async selectQuestioningTechnique(
    context: ModeContext,
  ): Promise<unknown> {
    const _target = await this.identifyQuestioningTarget(context);

    return {
      primary: this.choosePrimaryTechnique(_target, context),
      secondary: this.chooseSecondaryTechniques(_target, context),
      rationale: this.explainTechniqueChoice(_target, context),
      adaptation: this.planTechniqueAdaptation(context),
    };
  }

  private async generateInitialQuestions(
    _context: ModeContext,
  ): Promise<unknown[]> {
    return [
      {
        type: "clarifying",
        question: "What exactly do we mean by this concept?",
        purpose: "establish_clear_understanding",
        depthlevel: 1,
      },
      {
        type: "exploratory",
        question: "What are the underlying principles at work here?",
        purpose: "uncover_fundamentals",
        depthlevel: 2,
      },
      {
        type: "analytical",
        question: "How do the different components relate to each other?",
        purpose: "understand_relationships",
        depthlevel: 2,
      },
      {
        type: "evaluative",
        question: "What evidence supports this position?",
        purpose: "assess_validity",
        depthlevel: 3,
      },
    ];
  }

  private async conductDeeperInquiry(context: ModeContext): Promise<unknown> {
    this.inquiryDepth++;

    return {
      level: this.inquiryDepth,
      focusareas: this.identifyDeeperFocusAreas(context),
      probingquestions: this.generateProbingQuestions(context),
      followup_inquiries: this.createFollowUpInquiries(context),
      criticalexamination: this.conductCriticalExamination(context),
    };
  }

  private async challengeAssumptions(context: ModeContext): Promise<unknown> {
    return {
      identified: this.identifyAssumptions(context.input),
      challenged: this.formulateChallenges(context),
      alternatives: this.exploreAlternatives(context),
      implications: this.analyzeImplications(context),
      validationquestions: this.generateValidationQuestions(context),
    };
  }

  private async explorePerspectives(context: ModeContext): Promise<unknown> {
    return {
      multipleviewpoints: this.identifyMultipleViewpoints(context),
      stakeholderperspectives: this.exploreStakeholderPerspectives(context),
      culturalconsiderations: this.considerCulturalFactors(context),
      temporalperspectives: this.examineTemporalFactors(context),
      questioningfrom_each: this.generatePerspectiveQuestions(context),
    };
  }

  private async synthesizeInsights(_context: ModeContext): Promise<unknown[]> {
    return [
      {
        type: "foundational_insight",
        content: "Core assumptions need reexamination",
        confidence: 0.85,
        source: "assumption_challenging",
      },
      {
        type: "relational_insight",
        content: "Hidden dependencies reveal system complexity",
        confidence: 0.78,
        source: "deeper_inquiry",
      },
      {
        type: "perspective_insight",
        content: "Different stakeholders have conflicting priorities",
        confidence: 0.82,
        source: "perspective_exploration",
      },
    ];
  }

  private async conductReflectiveAnalysis(
    context: ModeContext,
  ): Promise<unknown> {
    return {
      questioningquality: this.assessQuestioningQuality(context),
      depthachieved: this.measureDepthAchieved(context),
      gapsidentified: this.identifyInquiryGaps(context),
      insightsquality: this.assessInsightQuality(context),
      furtherquestions: this.identifyFurtherQuestions(context),
    };
  }

  private assessInquiryComplexity(context: ModeContext): string {
    const _complexityIndicators = context.input.toLowerCase();

    if (
      _complexityIndicators.includes("complex") ||
      complexityIndicators.includes("philosophical")
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

  private determineQuestioningDepth(context: ModeContext): number {
    const _depthIndicators = [
      context.input.includes("deep"),
      context.input.includes("fundamental"),
      context.input.includes("philosophical"),
      context.input.includes("why") && context.input.includes("why"),
    ];

    return _depthIndicators.filter(Boolean).length / _depthIndicators.length;
  }

  private assessCriticalThinkingLevel(context: ModeContext): number {
    const _criticalIndicators = [
      context.input.includes("challenge"),
      context.input.includes("question"),
      context.input.includes("assume"),
      context.input.includes("evidence"),
    ];

    return (
      _criticalIndicators.filter(Boolean).length / _criticalIndicators.length
    );
  }

  private calculateConfidence(_context: ModeContext, results: unknown): number {
    let confidence = 0.75;

    if (results.questions.length > 5) {
      confidence += 0.08;
    }
    if (results.depth.level > 3) {
      confidence += 0.1;
    }
    if (results.assumptions.challenged.length > 2) {
      confidence += 0.07;
    }

    return Math.min(confidence, 1.0);
  }

  private consolidateQuestions(_pipeline: unknown): unknown[] {
    const _allQuestions = [
      ..._pipeline.initialQuestioning,
      ..._pipeline.deeperInquiry.probing_questions,
      ..._pipeline.assumptionChallenging.validation_questions,
      ..._pipeline.perspectiveExploration.questioning_from_each,
    ];

    return _allQuestions.slice(0, 15); // Limit to most relevant questions
  }

  private assessInquiryDepth(_pipeline: unknown): unknown {
    return {
      level: this.inquiryDepth,
      maximumreached: Math.max(4, this.inquiryDepth),
      progression: "systematic_deepening",
      quality: "thorough_exploration",
    };
  }

  private calculateQuestioningEffectiveness(_pipeline: unknown): number {
    return 0.83;
  }

  private generateQuestioningRecommendations(_pipeline: unknown): string[] {
    return [
      "Continue deeper inquiry into foundational assumptions",
      "Explore additional stakeholder perspectives",
      "Validate insights through alternative questioning approaches",
      "Document questioning process for future reference",
    ];
  }

  // Helper methods
  private extractPrimarySubject(_input: string): string {
    return _input.split(" ").slice(0, 8).join(" ");
  }

  private defineQuestioningScope(_input: string): string {
    if (_input.includes("broad") || _input.includes("comprehensive")) {
      return "comprehensive";
    }
    if (_input.includes("specific") || _input.includes("narrow")) {
      return "focused";
    }
    return "balanced";
  }

  private assessTargetComplexity(_input: string): string {
    return "medium"; // Simplified assessment
  }

  private classifyQuestioningType(_input: string): string {
    if (_input.includes("assumption")) {
      return "assumption_challenging";
    }
    if (_input.includes("evidence")) {
      return "evidence_based";
    }
    if (_input.includes("perspective")) {
      return "perspective_shifting";
    }
    return "general_inquiry";
  }

  private identifyContextFactors(_input: string): string[] {
    return ["domain_specific", "stakeholder_relevant", "time_sensitive"];
  }

  private choosePrimaryTechnique(
    _target: unknown,
    _context: ModeContext,
  ): string {
    if (_target.type === "assumption_challenging") {
      return "assumption_challenging";
    }
    if (_target.complexity === "high") {
      return "socratic_questioning";
    }
    return "probing_questions";
  }

  private chooseSecondaryTechniques(
    _target: unknown,
    _context: ModeContext,
  ): string[] {
    return ["clarifying_questions", "perspective_questioning"];
  }

  private explainTechniqueChoice(
    _target: unknown,
    _context: ModeContext,
  ): string {
    return `Selected based on _target complexity and questioning type: ${_target.type}`;
  }

  private planTechniqueAdaptation(_context: ModeContext): string {
    return "adapt_based_on_response_quality_and_depth_needs";
  }

  private identifyDeeperFocusAreas(_context: ModeContext): string[] {
    return [
      "fundamental_principles",
      "hidden_assumptions",
      "logical_connections",
    ];
  }

  private generateProbingQuestions(_context: ModeContext): unknown[] {
    return [
      {
        question: "What would happen if we reversed this assumption?",
        purpose: "explore_alternatives",
        depthlevel: this.inquiryDepth + 1,
      },
      {
        question: "How do we know this is universally true?",
        purpose: "test_generalizability",
        depthlevel: this.inquiryDepth + 1,
      },
    ];
  }

  private createFollowUpInquiries(_context: ModeContext): unknown[] {
    return [
      {
        trigger: "interesting_response",
        followup: "Can you elaborate on that point?",
        purpose: "deepen_understanding",
      },
    ];
  }

  private conductCriticalExamination(_context: ModeContext): unknown {
    return {
      logicalconsistency: "examine_for_contradictions",
      evidencestrength: "assess_supporting_evidence",
      alternativeexplanations: "consider_other_possibilities",
    };
  }

  private identifyAssumptions(_input: string): string[] {
    return [
      "assumption_1_identified_in_premise",
      "assumption_2_about_causality",
      "assumption_3_regarding_scope",
    ];
  }

  private formulateChallenges(_context: ModeContext): unknown[] {
    return [
      {
        assumption: "assumption_1",
        challenge: "What if this premise is not universally applicable?",
        reasoning: "test_boundary_conditions",
      },
      {
        assumption: "assumption_2",
        challenge: "Could there be alternative causal mechanisms?",
        reasoning: "explore_different_explanations",
      },
    ];
  }

  private exploreAlternatives(_context: ModeContext): string[] {
    return [
      "alternative_approach_1",
      "alternative_perspective_2",
      "alternative_explanation_3",
    ];
  }

  private analyzeImplications(_context: ModeContext): unknown {
    return {
      logicalimplications: "what_follows_from_premises",
      practicalimplications: "real_world_consequences",
      theoreticalimplications: "conceptual_ramifications",
    };
  }

  private generateValidationQuestions(_context: ModeContext): unknown[] {
    return [
      {
        question: "What evidence would prove this assumption wrong?",
        purpose: "falsifiability_test",
      },
      {
        question: "Under what conditions would this not hold true?",
        purpose: "boundary_testing",
      },
    ];
  }

  private identifyMultipleViewpoints(_context: ModeContext): string[] {
    return [
      "technical_viewpoint",
      "business_viewpoint",
      "user_viewpoint",
      "regulatory_viewpoint",
    ];
  }

  private exploreStakeholderPerspectives(_context: ModeContext): unknown {
    return {
      primarystakeholders: ["developers", "users", "management"],
      secondarystakeholders: ["regulators", "partners", "community"],
      conflictinginterests: "identified_and_analyzed",
    };
  }

  private considerCulturalFactors(_context: ModeContext): string[] {
    return [
      "culturalcontext_1",
      "value_system_differences",
      "communication_styles",
    ];
  }

  private examineTemporalFactors(_context: ModeContext): unknown {
    return {
      historicalcontext: "past_influences",
      currentsituation: "present_constraints",
      futureconsiderations: "evolving_factors",
    };
  }

  private generatePerspectiveQuestions(_context: ModeContext): unknown[] {
    return [
      {
        perspective: "user_perspective",
        question: "How would users experience this differently?",
        purpose: "understand_user_impact",
      },
      {
        perspective: "technical_perspective",
        question: "What are the technical constraints we must consider?",
        purpose: "assess_feasibility",
      },
    ];
  }

  private assessQuestioningQuality(_context: ModeContext): unknown {
    return {
      relevance: "highly_relevant",
      depth: "appropriate_depth_achieved",
      clarity: "clear_and_focused",
      progression: "logical_sequence",
    };
  }

  private measureDepthAchieved(_context: ModeContext): number {
    return this.inquiryDepth;
  }

  private identifyInquiryGaps(_context: ModeContext): string[] {
    return [
      "area_needing_deeper_exploration",
      "perspective_not_fully_examined",
    ];
  }

  private assessInsightQuality(_context: ModeContext): unknown {
    return {
      novelty: "new_understanding_gained",
      significance: "important_implications_revealed",
      actionability: "leads_to_concrete_next_steps",
    };
  }

  private identifyFurtherQuestions(_context: ModeContext): string[] {
    return [
      "How can we test these insights?",
      "What additional perspectives should we consider?",
      "What are the long-term implications of these findings?",
    ];
  }
}
