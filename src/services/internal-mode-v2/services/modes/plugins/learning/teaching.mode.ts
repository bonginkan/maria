/**
 * Teaching Mode Plugin - Educational instruction and knowledge transfer mode
 * Specialized for explaining concepts, providing guidance, and facilitating learning
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class TeachingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'teaching',
      name: 'Teaching',
      category: 'learning',
      symbol: '🎓',
      color: 'green',
      description: '教育指導モード - 概念説明と知識伝達',
      keywords: [
        'teach',
        'explain',
        'instruct',
        'educate',
        'guide',
        'show',
        'demonstrate',
        'clarify',
        'illustrate',
        'tutor',
      ],
      triggers: [
        'teach me',
        'explain how',
        'show me',
        'help me understand',
        'guide me through',
        'instruct',
        'demonstrate',
        'clarify',
      ],
      examples: [
        'Teach me the fundamentals of this concept',
        'Explain how this algorithm works step by step',
        'Show me the best practices for implementation',
        'Help me understand the underlying principles',
        'Guide me through the learning process',
      ],
      enabled: true,
      priority: 6,
      timeout: 100000, // 1.67 minutes for teaching sessions
      maxConcurrentSessions: 10,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating teaching mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Teaching...',
      color: this.config.color,
      sessionId: context.sessionId,
    });

    this.emit('analytics:event', {
      type: 'mode_activation',
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
    console.log(`[${this.config.id}] Deactivating teaching mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(`[${this.config.id}] Processing teaching request: "${input.substring(0, 50)}..."`);

    // Teaching process pipeline
    const learnerAssessment = await this.assessLearner(input, context);
    const topicAnalysis = await this.analyzeTopic(input, learnerAssessment);
    const instructionalDesign = await this.designInstruction(input, topicAnalysis);
    const contentDelivery = await this.deliverContent(input, instructionalDesign);
    const practiceActivities = await this.createPracticeActivities(input, topicAnalysis);
    const assessment = await this.designAssessment(input, topicAnalysis);

    const suggestions = await this.generateTeachingSuggestions(input, assessment);
    const nextMode = await this.determineNextMode(input, assessment);

    return {
      success: true,
      output: this.formatTeachingResults(
        topicAnalysis,
        instructionalDesign,
        contentDelivery,
        practiceActivities,
      ),
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.87,
      metadata: {
        learnerLevel: learnerAssessment.level,
        topicComplexity: topicAnalysis.complexity,
        instructionalStrategy: instructionalDesign.strategy,
        contentLength: contentDelivery.length,
        practiceCount: practiceActivities.length,
        assessmentType: assessment.type,
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.25;

    const inputLower = input.toLowerCase();

    // Direct teaching keywords
    const teachingKeywords = [
      'teach',
      'explain',
      'instruct',
      'educate',
      'guide',
      'show',
      'demonstrate',
      'clarify',
      'illustrate',
      'tutor',
    ];

    const teachingMatches = teachingKeywords.filter((keyword) => inputLower.includes(keyword));
    if (teachingMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Teaching keywords: ${teachingMatches.join(', ')}`);
    }

    // Learning request phrases
    const learningPhrases = [
      'teach me',
      'explain how',
      'show me',
      'help me understand',
      'guide me through',
      'walk me through',
      'break down for me',
    ];

    const learningMatches = learningPhrases.filter((phrase) => inputLower.includes(phrase));
    if (learningMatches.length > 0) {
      confidence += 0.35;
      reasoning.push(`Learning request phrases: ${learningMatches.length} found`);
    }

    // Knowledge-seeking questions
    const knowledgeQuestions = [
      /how.*work/i,
      /what.*mean/i,
      /why.*happen/i,
      /how.*do/i,
      /what.*is/i,
      /how.*can/i,
      /what.*should/i,
      /how.*best/i,
    ];

    const questionMatches = knowledgeQuestions.filter((pattern) => pattern.test(input));
    if (questionMatches.length > 0) {
      confidence += 0.25;
      reasoning.push('Knowledge-seeking questions detected');
    }

    // Educational context terms
    const educationalTerms = [
      'learn',
      'understand',
      'concept',
      'principle',
      'theory',
      'practice',
      'example',
      'tutorial',
      'lesson',
      'course',
    ];

    const eduMatches = educationalTerms.filter((term) => inputLower.includes(term));
    if (eduMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Educational terms: ${eduMatches.join(', ')}`);
    }

    // Skill development indicators
    const skillTerms = [
      'skill',
      'technique',
      'method',
      'approach',
      'best practice',
      'pattern',
      'strategy',
      'framework',
      'methodology',
    ];

    const skillMatches = skillTerms.filter((term) => inputLower.includes(term));
    if (skillMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Skill development terms: ${skillMatches.join(', ')}`);
    }

    // Step-by-step indicators
    const stepIndicators = [
      'step by step',
      'step-by-step',
      'gradually',
      'systematically',
      'progressively',
      'incrementally',
      'bit by bit',
    ];

    const stepMatches = stepIndicators.filter((indicator) => inputLower.includes(indicator));
    if (stepMatches.length > 0) {
      confidence += 0.15;
      reasoning.push('Step-by-step learning indicators detected');
    }

    // Beginner/learning level indicators
    const levelIndicators = [
      'beginner',
      'new to',
      'unfamiliar',
      'starting',
      'basic',
      'fundamental',
      'introduction',
      'getting started',
    ];

    const levelMatches = levelIndicators.filter((indicator) => inputLower.includes(indicator));
    if (levelMatches.length > 0) {
      confidence += 0.1;
      reasoning.push('Learning level indicators suggest teaching need');
    }

    // Context-based adjustments
    if (context.previousMode === 'researching') {
      confidence += 0.1;
      reasoning.push('Teaching follows research appropriately');
    }

    if (context.previousMode === 'analyzing') {
      confidence += 0.1;
      reasoning.push('Teaching can explain analysis results');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Assess the learner's background and needs
   */
  private async assessLearner(input: string, context: ModeContext): Promise<unknown> {
    const assessment = {
      level: this.determineLearnerLevel(input),
      background: this.assessLearnerBackground(input),
      learning_style: this.identifyLearningStyle(input),
      motivation: this.assessLearnerMotivation(input),
      constraints: this.identifyLearningConstraints(input),
      goals: this.extractLearningGoals(input),
      prior_knowledge: this.assessPriorKnowledge(input),
    };

    return assessment;
  }

  /**
   * Analyze the topic to be taught
   */
  private async analyzeTopic(input: string, learnerAssessment: unknown): Promise<unknown> {
    const analysis = {
      subject: this.identifySubject(input),
      complexity: this.assessTopicComplexity(input),
      scope: this.defineTopicScope(input),
      prerequisites: this.identifyPrerequisites(input),
      learning_objectives: this.defineLearningObjectives(input),
      key_concepts: this.extractKeyConcepts(input),
      applications: this.identifyApplications(input),
    };

    return analysis;
  }

  /**
   * Design instructional approach
   */
  private async designInstruction(input: string, topicAnalysis: unknown): Promise<unknown> {
    const design = {
      strategy: this.selectInstructionalStrategy(topicAnalysis),
      sequence: this.designLearningSequence(topicAnalysis),
      methods: this.chooseTeachingMethods(topicAnalysis),
      materials: this.selectLearningMaterials(topicAnalysis),
      pacing: this.determinePacing(topicAnalysis),
      scaffolding: this.planScaffolding(topicAnalysis),
    };

    return design;
  }

  /**
   * Deliver educational content
   */
  private async deliverContent(input: string, instructionalDesign: unknown): Promise<unknown> {
    const content = {
      introduction: this.createIntroduction(input, instructionalDesign),
      main_content: this.developMainContent(input, instructionalDesign),
      examples: this.provideExamples(input, instructionalDesign),
      demonstrations: this.createDemonstrations(input, instructionalDesign),
      explanations: this.provideExplanations(input, instructionalDesign),
      length: this.calculateContentLength(instructionalDesign),
    };

    return content;
  }

  /**
   * Create practice activities
   */
  private async createPracticeActivities(
    input: string,
    topicAnalysis: unknown,
  ): Promise<unknown[]> {
    const activities: unknown[] = [];

    // Basic practice exercises
    activities.push({
      type: 'guided_practice',
      name: 'Step-by-step guided exercises',
      description: 'Structured practice with guidance',
      difficulty: 'beginner',
      estimated_time: '15-20 minutes',
    });

    // Independent practice
    activities.push({
      type: 'independent_practice',
      name: 'Self-directed practice problems',
      description: 'Apply concepts independently',
      difficulty: 'intermediate',
      estimated_time: '20-30 minutes',
    });

    // Application exercises
    if (topicAnalysis.complexity !== 'low') {
      activities.push({
        type: 'application',
        name: 'Real-world application scenarios',
        description: 'Apply learning to practical situations',
        difficulty: 'advanced',
        estimated_time: '30-45 minutes',
      });
    }

    return activities;
  }

  /**
   * Design assessment strategy
   */
  private async designAssessment(input: string, topicAnalysis: unknown): Promise<unknown> {
    const assessment = {
      type: this.selectAssessmentType(topicAnalysis),
      formative: this.designFormativeAssessment(topicAnalysis),
      summative: this.designSummativeAssessment(topicAnalysis),
      feedback_strategy: this.planFeedbackStrategy(topicAnalysis),
      success_criteria: this.defineSuccessCriteria(topicAnalysis),
    };

    return assessment;
  }

  /**
   * Format teaching results
   */
  private formatTeachingResults(
    topicAnalysis: unknown,
    instructionalDesign: unknown,
    contentDelivery: unknown,
    practiceActivities: unknown[],
  ): string {
    const output: string[] = [];

    output.push('Teaching Session Plan');
    output.push('═'.repeat(21));
    output.push('');

    output.push('Topic Overview:');
    output.push(`Subject: ${topicAnalysis.subject}`);
    output.push(`Complexity: ${topicAnalysis.complexity}`);
    output.push(`Scope: ${topicAnalysis.scope}`);
    output.push('');

    output.push('Learning Objectives:');
    topicAnalysis.learning_objectives.slice(0, 3).forEach((objective: string, index: number) => {
      output.push(`${index + 1}. ${objective}`);
    });
    output.push('');

    output.push('Key Concepts:');
    topicAnalysis.key_concepts.slice(0, 4).forEach((concept: string) => {
      output.push(`• ${concept}`);
    });
    output.push('');

    output.push('Instructional Approach:');
    output.push(`Strategy: ${instructionalDesign.strategy}`);
    output.push(`Teaching Methods: ${instructionalDesign.methods.join(', ')}`);
    output.push(`Pacing: ${instructionalDesign.pacing}`);
    output.push('');

    output.push('Content Structure:');
    output.push('1. Introduction and Context Setting');
    output.push('2. Core Concept Explanation');
    output.push('3. Examples and Demonstrations');
    output.push('4. Guided Practice');
    output.push('5. Independent Application');
    output.push('');

    output.push('Practice Activities:');
    practiceActivities.forEach((activity, index) => {
      output.push(`${index + 1}. ${activity.name} (${activity.difficulty})`);
      output.push(`   Time: ${activity.estimated_time}`);
    });
    output.push('');

    output.push('Examples and Demonstrations:');
    contentDelivery.examples.slice(0, 3).forEach((example: string, index: number) => {
      output.push(`${index + 1}. ${example}`);
    });

    return output.join('\n');
  }

  /**
   * Generate teaching-specific suggestions
   */
  private async generateTeachingSuggestions(input: string, assessment: unknown): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Check for understanding frequently during instruction');
    suggestions.push('Provide multiple examples and non-examples');

    if (assessment.type === 'complex_topic') {
      suggestions.push('Break complex concepts into smaller chunks');
    }

    suggestions.push('Encourage active participation and questions');
    suggestions.push('Provide constructive feedback on practice attempts');

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(input: string, assessment: unknown): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('practice') || inputLower.includes('exercise')) {
      return 'adapting';
    }

    if (inputLower.includes('question') || inputLower.includes('clarify')) {
      return 'thinking';
    }

    if (inputLower.includes('apply') || inputLower.includes('implement')) {
      return 'optimizing';
    }

    if (inputLower.includes('test') || inputLower.includes('check')) {
      return 'debugging';
    }

    return 'reflecting';
  }

  // Helper methods
  private determineLearnerLevel(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('beginner') || inputLower.includes('new to')) return 'beginner';
    if (inputLower.includes('intermediate') || inputLower.includes('some experience'))
      return 'intermediate';
    if (inputLower.includes('advanced') || inputLower.includes('experienced')) return 'advanced';
    if (inputLower.includes('expert') || inputLower.includes('professional')) return 'expert';

    return 'intermediate'; // Default assumption
  }

  private assessLearnerBackground(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('technical') || inputLower.includes('programming')) return 'technical';
    if (inputLower.includes('business') || inputLower.includes('management')) return 'business';
    if (inputLower.includes('academic') || inputLower.includes('research')) return 'academic';

    return 'general';
  }

  private identifyLearningStyle(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('visual') || inputLower.includes('diagram')) return 'visual';
    if (inputLower.includes('hands-on') || inputLower.includes('practice')) return 'kinesthetic';
    if (inputLower.includes('step by step') || inputLower.includes('detailed')) return 'sequential';

    return 'multimodal';
  }

  private assessLearnerMotivation(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('urgent') || inputLower.includes('quickly')) return 'high';
    if (inputLower.includes('interested') || inputLower.includes('curious')) return 'medium';

    return 'medium';
  }

  private identifyLearningConstraints(input: string): string[] {
    const constraints: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('time') || inputLower.includes('quick'))
      constraints.push('time_constraint');
    if (inputLower.includes('simple') || inputLower.includes('basic'))
      constraints.push('complexity_constraint');

    return constraints;
  }

  private extractLearningGoals(input: string): string[] {
    return [
      'Understand core concepts clearly',
      'Apply knowledge to practical situations',
      'Build confidence in the subject area',
      'Develop problem-solving skills',
    ];
  }

  private assessPriorKnowledge(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('no experience') || inputLower.includes('never')) return 'none';
    if (inputLower.includes('some') || inputLower.includes('little')) return 'limited';
    if (inputLower.includes('familiar') || inputLower.includes('know')) return 'moderate';

    return 'unknown';
  }

  private identifySubject(input: string): string {
    // Extract the main subject from the input
    const subjects = {
      programming: ['code', 'programming', 'algorithm', 'software'],
      mathematics: ['math', 'calculation', 'formula', 'equation'],
      science: ['science', 'theory', 'research', 'experiment'],
      business: ['business', 'strategy', 'management', 'process'],
      technology: ['technology', 'system', 'technical', 'digital'],
    };

    const inputLower = input.toLowerCase();

    for (const [subject, keywords] of Object.entries(subjects)) {
      if (keywords.some((keyword) => inputLower.includes(keyword))) {
        return subject;
      }
    }

    return 'general knowledge';
  }

  private assessTopicComplexity(input: string): string {
    const complexityIndicators = ['complex', 'advanced', 'difficult', 'sophisticated'];
    const simplicityIndicators = ['simple', 'basic', 'easy', 'fundamental'];
    const inputLower = input.toLowerCase();

    const complexCount = complexityIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    ).length;
    const simpleCount = simplicityIndicators.filter((indicator) =>
      inputLower.includes(indicator),
    ).length;

    if (complexCount > simpleCount) return 'high';
    if (simpleCount > complexCount) return 'low';
    return 'medium';
  }

  private defineTopicScope(input: string): string {
    const wordCount = input.split(/\s+/).length;

    if (wordCount > 50) return 'comprehensive';
    if (wordCount > 25) return 'moderate';
    return 'focused';
  }

  private identifyPrerequisites(input: string): string[] {
    const prerequisites: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('programming')) prerequisites.push('Basic programming concepts');
    if (inputLower.includes('math')) prerequisites.push('Basic mathematics');
    if (inputLower.includes('technical')) prerequisites.push('Technical literacy');

    return prerequisites.length > 0 ? prerequisites : ['General knowledge'];
  }

  private defineLearningObjectives(input: string): string[] {
    const subject = this.identifySubject(input);

    return [
      `Understand the fundamental concepts of ${subject}`,
      `Apply ${subject} principles to solve problems`,
      `Demonstrate proficiency in ${subject} techniques`,
      `Analyze and evaluate ${subject} applications`,
    ];
  }

  private extractKeyConcepts(input: string): string[] {
    // Extract key concepts based on the subject area
    const subject = this.identifySubject(input);

    const conceptMaps = {
      programming: ['Variables', 'Functions', 'Data structures', 'Algorithms'],
      mathematics: ['Equations', 'Functions', 'Logic', 'Problem solving'],
      science: ['Hypothesis', 'Methodology', 'Analysis', 'Conclusion'],
      business: ['Strategy', 'Process', 'Analysis', 'Decision making'],
      technology: ['Systems', 'Architecture', 'Implementation', 'Optimization'],
    };

    return (
      conceptMaps[subject] || ['Core principles', 'Key methods', 'Best practices', 'Applications']
    );
  }

  private identifyApplications(input: string): string[] {
    return [
      'Real-world problem solving',
      'Practical implementation scenarios',
      'Case study analysis',
      'Project-based applications',
    ];
  }

  private selectInstructionalStrategy(topicAnalysis: unknown): string {
    switch (topicAnalysis.complexity) {
      case 'high':
        return 'scaffolded_instruction';
      case 'low':
        return 'direct_instruction';
      default:
        return 'guided_discovery';
    }
  }

  private designLearningSequence(topicAnalysis: unknown): string[] {
    return [
      'Activate prior knowledge',
      'Introduce new concepts',
      'Provide examples and demonstrations',
      'Guided practice',
      'Independent application',
      'Assessment and feedback',
    ];
  }

  private chooseTeachingMethods(topicAnalysis: unknown): string[] {
    const methods = ['Explanation', 'Demonstration', 'Examples'];

    if (topicAnalysis.complexity === 'high') {
      methods.push('Scaffolding', 'Modeling');
    }

    methods.push('Practice', 'Feedback');
    return methods;
  }

  private selectLearningMaterials(topicAnalysis: unknown): string[] {
    return [
      'Clear explanations and definitions',
      'Visual aids and diagrams',
      'Practical examples',
      'Practice exercises',
      'Reference materials',
    ];
  }

  private determinePacing(topicAnalysis: unknown): string {
    switch (topicAnalysis.complexity) {
      case 'high':
        return 'slow_and_thorough';
      case 'low':
        return 'moderate_pace';
      default:
        return 'adaptive_pacing';
    }
  }

  private planScaffolding(topicAnalysis: unknown): string[] {
    return [
      'Break complex concepts into smaller parts',
      'Provide temporary support structures',
      'Gradually reduce assistance',
      'Encourage independent thinking',
    ];
  }

  private createIntroduction(input: string, design: unknown): string {
    return `Introduction to ${this.identifySubject(input)} using ${design.strategy} approach`;
  }

  private developMainContent(input: string, design: unknown): string[] {
    return [
      'Core concept explanation with clear definitions',
      'Logical progression from simple to complex',
      'Multiple perspectives and approaches',
      'Connections to prior knowledge',
    ];
  }

  private provideExamples(input: string, design: unknown): string[] {
    return [
      'Simple introductory example',
      'Step-by-step worked example',
      'Real-world application example',
      'Common mistake example (what not to do)',
    ];
  }

  private createDemonstrations(input: string, design: unknown): string[] {
    return [
      'Live demonstration of process',
      'Think-aloud modeling',
      'Problem-solving demonstration',
      'Best practice showcase',
    ];
  }

  private provideExplanations(input: string, design: unknown): string[] {
    return [
      'Clear, jargon-free explanations',
      'Multiple ways of explaining concepts',
      'Analogies and metaphors',
      'Visual and verbal explanations',
    ];
  }

  private calculateContentLength(design: unknown): string {
    return design.strategy === 'scaffolded_instruction' ? 'comprehensive' : 'focused';
  }

  private selectAssessmentType(topicAnalysis: unknown): string {
    switch (topicAnalysis.complexity) {
      case 'high':
        return 'complex_topic';
      case 'low':
        return 'simple_topic';
      default:
        return 'standard_topic';
    }
  }

  private designFormativeAssessment(topicAnalysis: unknown): string[] {
    return [
      'Frequent comprehension checks',
      'Practice problem feedback',
      'Question and answer sessions',
      'Peer discussion and explanation',
    ];
  }

  private designSummativeAssessment(topicAnalysis: unknown): string[] {
    return [
      'Knowledge application test',
      'Problem-solving assessment',
      'Project-based evaluation',
      'Reflection and self-assessment',
    ];
  }

  private planFeedbackStrategy(topicAnalysis: unknown): string {
    return 'Immediate, specific, and constructive feedback on understanding and performance';
  }

  private defineSuccessCriteria(topicAnalysis: unknown): string[] {
    return [
      'Demonstrates clear understanding of key concepts',
      'Can apply knowledge to new situations',
      'Shows improvement from initial assessment',
      'Expresses confidence in the subject area',
    ];
  }
}
