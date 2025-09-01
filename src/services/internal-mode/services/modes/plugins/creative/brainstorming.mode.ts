/**
 * Brainstorming Mode Plugin - Creative ideation and concept generation mode
 * Specialized for generating diverse ideas, exploring possibilities, and creative thinking
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from "../BaseMode";

export default class BrainstormingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: "brainstorming",
      name: "Brainstorming",
      category: "creative",
      symbol: "💡",
      color: "green",
      description:
        "制約を緩めて多様な発想生成 - 創造的アイデア創出とコンセプト開発専門モード",
      keywords: [
        "idea",
        "ideas",
        "brainstorm",
        "creative",
        "think",
        "concept",
        "innovative",
        "original",
        "unique",
        "alternative",
        "possibility",
        "inspiration",
        "imagination",
        "design",
        "invent",
        "explore",
      ],
      triggers: [
        "brainstorm",
        "ideas",
        "think of",
        "come up with",
        "creative",
        "innovative",
        "what if",
        "alternatives",
        "possibilities",
        "inspire",
        "imagine",
        "design ideas",
        "concepts",
      ],
      examples: [
        "Brainstorm ideas for a new mobile app",
        "What are some creative solutions for this problem?",
        "Generate concepts for improving user experience",
        "Think of innovative ways to approach this challenge",
        "Come up with alternative designs for this feature",
      ],
      enabled: true,
      priority: 6,
      timeout: 120000, // 2 minutes for thorough ideation
      maxConcurrentSessions: 12,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(
      `[${this.config.id}] Activating brainstorming mode for session ${context.sessionId}`,
    );

    this.emit("display:update", {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: "Brainstorming...",
      color: this.config.color,
      sessionId: context.sessionId,
      animation: "typewriter",
    });

    this.emit("analytics:event", {
      type: "mode_activation",
      mode: this.config.id,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      metadata: {
        previousMode: context.previousMode,
        ideationTarget: this.identifyIdeationTarget(context.input || ""),
      },
    });
  }

  protected async onDeactivate(sessionId: string): Promise<void> {
    console.log(
      `[${this.config.id}] Deactivating brainstorming mode for session ${sessionId}`,
    );

    this.emit("analytics:event", {
      type: "mode_deactivation",
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(
    _input: string,
    context: ModeContext,
  ): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing brainstorming request: "${_input.substring(0, 50)}..."`,
    );

    // Multi-phase creative ideation process
    const _ideationContext = await this.analyzeIdeationContext(_input, context);
    const _rawIdeas = await this.generateRawIdeas(_input, _ideationContext);
    const _refinedIdeas = await this.refineAndCategorizeIdeas(
      _rawIdeas,
      _ideationContext,
    );
    const _evaluatedIdeas = await this.evaluateIdeas(
      _refinedIdeas,
      _ideationContext,
    );

    const _confidence = this.calculateCreativityConfidence(
      _refinedIdeas,
      _input,
    );

    return {
      success: true,
      output: this.formatBrainstormingReport(_ideationContext, _evaluatedIdeas),
      suggestions: this.generateCreativeSuggestions(
        _evaluatedIdeas,
        _ideationContext,
      ),
      nextRecommendedMode: this.determineNextMode(_evaluatedIdeas),
      _confidence,
      metadata: {
        _ideationContext,
        totalIdeas: _rawIdeas.length,
        categorizedIdeas: _refinedIdeas.length,
        topIdeas: _evaluatedIdeas.slice(0, 5),
        creativityScore: this.calculateCreativityScore(_refinedIdeas),
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    _context: ModeContext,
  ): Promise<{ _confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let _confidence = 0;

    const _inputLower = input.toLowerCase();

    // Strong brainstorming indicators
    const _strongIndicators = [
      "brainstorm",
      "ideas",
      "creative",
      "innovative",
      "think of",
      "come up with",
      "alternatives",
      "possibilities",
    ];

    const _strongMatches = _strongIndicators.filter((indicator) =>
      _inputLower.includes(indicator),
    );
    if (_strongMatches.length > 0) {
      _confidence += Math.min(0.7, _strongMatches.length * 0.25);
      reasoning.push(
        `Strong brainstorming indicators: ${_strongMatches.join(", ")}`,
      );
    }

    // Creative thinking keywords
    const _creativeKeywords = [
      "design",
      "concept",
      "solution",
      "approach",
      "method",
      "way",
      "style",
      "strategy",
      "plan",
      "vision",
    ];

    const _creativeMatches = _creativeKeywords.filter((keyword) =>
      _inputLower.includes(keyword),
    );
    if (_creativeMatches.length > 0) {
      _confidence += Math.min(0.3, _creativeMatches.length * 0.1);
      reasoning.push(
        `Creative thinking keywords: ${_creativeMatches.join(", ")}`,
      );
    }

    // Question _words that suggest ideation
    const _questionWords = ["what", "how", "why", "when", "where"];
    const _questionMatches = _questionWords.filter((word) =>
      _inputLower.includes(word),
    );
    if (_questionMatches.length > 0 && _inputLower.includes("could")) {
      _confidence += 0.2;
      reasoning.push("Open-ended questions detected - good for brainstorming");
    }

    // Multiple options/alternatives mentioned
    if (
      _inputLower.includes("different") ||
      _inputLower.includes("various") ||
      inputLower.includes("multiple")
    ) {
      _confidence += 0.15;
      reasoning.push("Request for multiple options detected");
    }

    // Problem-solving context
    if (
      _inputLower.includes("problem") ||
      _inputLower.includes("challenge") ||
      inputLower.includes("issue")
    ) {
      _confidence += 0.1;
      reasoning.push(
        "Problem-solving context - suitable for creative solutions",
      );
    }

    // Innovation context
    if (
      _inputLower.includes("new") ||
      _inputLower.includes("novel") ||
      inputLower.includes("original")
    ) {
      _confidence += 0.1;
      reasoning.push("Innovation context detected");
    }

    return { _confidence: Math.min(_confidence, 1.0), reasoning };
  }

  /**
   * Analyze the context for ideation
   */
  private async analyzeIdeationContext(
    _input: string,
    _context: ModeContext,
  ): Promise<unknown> {
    return {
      target: this.identifyIdeationTarget(_input),
      domain: this.identifyDomain(_input),
      constraints: this.identifyConstraints(_input),
      objectives: this.extractObjectives(_input),
      audience: this.identifyTargetAudience(_input),
      creativitylevel: this.assessRequiredCreativity(_input),
      scope: this.determineScope(_input),
      inspirationsources: this.identifyInspirationSources(_input),
    };
  }

  /**
   * Generate initial raw ideas
   */
  private async generateRawIdeas(
    _input: string,
    context: unknown,
  ): Promise<unknown[]> {
    const ideas: unknown[] = [];

    // Use different ideation _techniques
    const _techniques = [
      "associative_thinking",
      "analogical_reasoning",
      "reverse_thinking",
      "scamper_method",
      "morphological_analysis",
      "random_stimulation",
    ];

    for (const technique of _techniques) {
      const _techniqueIdeas = await this.applyIdeationTechnique(
        technique,
        _input,
        context,
      );
      ideas.push(..._techniqueIdeas);
    }

    return ideas;
  }

  /**
   * Apply specific ideation technique
   */
  private async applyIdeationTechnique(
    technique: string,
    input: string,
    context: unknown,
  ): Promise<unknown[]> {
    const ideas: unknown[] = [];

    switch (technique) {
      case "associative_thinking":
        ideas.push(...this.generateAssociativeIdeas(input, context));
        break;

      case "analogical_reasoning":
        ideas.push(...this.generateAnalogicalIdeas(input, context));
        break;

      case "reverse_thinking":
        ideas.push(...this.generateReverseIdeas(input, context));
        break;

      case "scamper_method":
        ideas.push(...this.generateScamperIdeas(input, context));
        break;

      case "morphological_analysis":
        ideas.push(...this.generateMorphologicalIdeas(input, context));
        break;

      case "random_stimulation":
        ideas.push(...this.generateRandomStimulationIdeas(input, context));
        break;
    }

    return ideas.map((idea) => ({
      ...idea,
      technique,
      generatedat: Date.now(),
    }));
  }

  /**
   * Generate ideas through associative thinking
   */
  private generateAssociativeIdeas(
    _input: string,
    _context: unknown,
  ): unknown[] {
    const ideas: unknown[] = [];
    const _associations = this.getKeywordAssociations(_input);

    associations.forEach((association) => {
      ideas.push({
        title: `${association}-inspired solution`,
        description: `Drawing inspiration from ${association} concepts`,
        type: "associative",
        originality: Math.random() * 0.3 + 0.4,
        feasibility: Math.random() * 0.4 + 0.5,
      });
    });

    return ideas.slice(0, 3); // Limit per technique
  }

  /**
   * Generate ideas through analogical reasoning
   */
  private generateAnalogicalIdeas(_input: string, context: unknown): unknown[] {
    const ideas: unknown[] = [];
    const _analogies = this.getAnalogies(context.domain);

    analogies.forEach((analogy) => {
      ideas.push({
        title: `${analogy} approach`,
        description: `Applying principles from ${analogy} to solve this challenge`,
        type: "analogical",
        originality: Math.random() * 0.4 + 0.5,
        feasibility: Math.random() * 0.3 + 0.4,
      });
    });

    return ideas.slice(0, 3);
  }

  /**
   * Generate ideas through reverse thinking
   */
  private generateReverseIdeas(_input: string, _context: unknown): unknown[] {
    const ideas: unknown[] = [];

    // Create opposite/reverse concepts
    ideas.push({
      title: "Reverse approach solution",
      description: "Instead of traditional approach, try doing the opposite",
      type: "reverse",
      originality: Math.random() * 0.5 + 0.4,
      feasibility: Math.random() * 0.3 + 0.3,
    });

    ideas.push({
      title: "Constraint elimination",
      description: "Remove common constraints and see what becomes possible",
      type: "reverse",
      originality: Math.random() * 0.4 + 0.5,
      feasibility: Math.random() * 0.2 + 0.4,
    });

    return ideas;
  }

  /**
   * Generate ideas using SCAMPER method
   */
  private generateScamperIdeas(_input: string, _context: unknown): unknown[] {
    const ideas: unknown[] = [];
    const _scamperActions = [
      "Substitute",
      "Combine",
      "Adapt",
      "Modify",
      "Put to other uses",
      "Eliminate",
      "Reverse",
    ];

    scamperActions.forEach((action) => {
      ideas.push({
        title: `${action} solution`,
        description: `Apply ${action.toLowerCase()} technique to existing approaches`,
        type: "scamper",
        scamperaction: action.toLowerCase(),
        originality: Math.random() * 0.4 + 0.4,
        feasibility: Math.random() * 0.4 + 0.5,
      });
    });

    return ideas.slice(0, 3);
  }

  /**
   * Generate ideas using morphological analysis
   */
  private generateMorphologicalIdeas(
    _input: string,
    context: unknown,
  ): unknown[] {
    const ideas: unknown[] = [];

    // Create combinations of different _parameters
    const _parameters = this.identifyMorphologicalParameters(_input, context);

    for (let i = 0; i < Math.min(3, _parameters.length); i++) {
      ideas.push({
        title: `Parameter combination ${i + 1}`,
        description: `Combining different parameter values in novel ways`,
        type: "morphological",
        _parameters: _parameters[i],
        originality: Math.random() * 0.3 + 0.6,
        feasibility: Math.random() * 0.5 + 0.4,
      });
    }

    return ideas;
  }

  /**
   * Generate ideas using random stimulation
   */
  private generateRandomStimulationIdeas(
    _input: string,
    _context: unknown,
  ): unknown[] {
    const ideas: unknown[] = [];
    const _randomWords = [
      "butterfly",
      "mountain",
      "clock",
      "ocean",
      "library",
      "garden",
    ];

    randomWords.slice(0, 2).forEach((word) => {
      ideas.push({
        title: `${word}-inspired concept`,
        description: `Creative solution inspired by characteristics of ${word}`,
        type: "random_stimulation",
        stimulus: word,
        originality: Math.random() * 0.6 + 0.3,
        feasibility: Math.random() * 0.3 + 0.3,
      });
    });

    return ideas;
  }

  /**
   * Refine and categorize generated ideas
   */
  private async refineAndCategorizeIdeas(
    _rawIdeas: unknown[],
    context: unknown,
  ): Promise<unknown[]> {
    const _refined = _rawIdeas.map((idea) => ({
      ...idea,
      category: this.categorizeIdea(idea, context),
      refineddescription: this.refineDescription(idea, context),
      potentialimpact: this.estimateImpact(idea, context),
      implementationeffort: this.estimateEffort(idea, context),
    }));

    // Remove duplicates and very low-quality ideas
    return _refined.filter(
      (idea, index, array) =>
        array.findIndex(
          (other) => this.calculateSimilarity(idea, other) > 0.8,
        ) === index && idea.originality > 0.3,
    );
  }

  /**
   * Evaluate and score ideas
   */
  private async evaluateIdeas(
    _ideas: unknown[],
    context: unknown,
  ): Promise<unknown[]> {
    const _evaluated = _ideas.map((idea) => ({
      ...idea,
      overallscore: this.calculateOverallScore(idea),
      pros: this.identifyPros(idea, context),
      cons: this.identifycons(idea, context),
      nextsteps: this.suggestNextSteps(idea, context),
    }));

    // Sort by overall score
    return _evaluated.sort((a, b) => b.overall_score - a.overall_score);
  }

  /**
   * Format brainstorming _report
   */
  private formatBrainstormingReport(
    _context: unknown,
    _evaluatedIdeas: unknown[],
  ): string {
    const _report = [
      "💡 BRAINSTORMING SESSION REPORT",
      "=================================",
      "",
      `Target: ${_context.target}`,
      `Domain: ${_context.domain}`,
      `Creativity Level: ${_context.creativity_level}`,
      `Total Ideas Generated: ${_evaluatedIdeas.length}`,
      "",
      "🏆 TOP IDEAS:",
      "",
    ];

    // Add top 5 ideas
    evaluatedIdeas.slice(0, 5).forEach((idea, _index) => {
      _report.push(`${_index + 1}. ${idea.title}`);
      _report.push(`   ${idea.refined_description}`);
      report.push(
        `   Originality: ${Math.round(idea.originality * 100)}% | Feasibility: ${Math.round(idea.feasibility * 100)}%`,
      );
      _report.push(`   Score: ${Math.round(idea.overall_score * 100)}/100`);
      report.push("");
    });

    // Add _categories summary
    const _categories = [
      ...new Set(_evaluatedIdeas.map((idea) => idea.category)),
    ];
    report.push("📊 IDEAS BY CATEGORY:");
    categories.forEach((category) => {
      const _count = _evaluatedIdeas.filter(
        (idea) => idea.category === category,
      ).length;
      report.push(`• ${category}: ${_count} ideas`);
    });

    _report.push("");
    report.push(
      "💭 Remember: The best ideas often come from combining and iterating on initial concepts!",
    );

    return _report.join("\n");
  }

  /**
   * Generate creative suggestions
   */
  private generateCreativeSuggestions(
    _ideas: unknown[],
    context: unknown,
  ): string[] {
    const suggestions: string[] = [];

    if (_ideas.length > 0) {
      suggestions.push(`Explore the "${_ideas[0].title}" concept further`);
    }

    suggestions.push("Try combining elements from different ideas");
    suggestions.push("Consider the reverse or opposite approach");
    suggestions.push("Look for inspiration from other _domains or industries");

    if (context.creativity_level === "high") {
      suggestions.push("Push boundaries - think beyond conventional solutions");
    }

    return suggestions.slice(0, 4);
  }

  // Helper methods

  private identifyIdeationTarget(input: string): string {
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("app") || _inputLower.includes("application")) {
      return "mobile_app";
    }
    if (_inputLower.includes("website") || _inputLower.includes("web")) {
      return "website";
    }
    if (_inputLower.includes("product") || _inputLower.includes("service")) {
      return "product_service";
    }
    if (_inputLower.includes("business") || _inputLower.includes("company")) {
      return "business";
    }
    if (_inputLower.includes("process") || _inputLower.includes("workflow")) {
      return "process";
    }
    if (
      _inputLower.includes("feature") ||
      _inputLower.includes("functionality")
    ) {
      return "feature";
    }

    return "general";
  }

  private identifyDomain(input: string): string {
    const _inputLower = input.toLowerCase();

    const _domains = {
      technology: [
        "tech",
        "software",
        "app",
        "digital",
        "ai",
        "machine learning",
      ],
      business: ["business", "marketing", "sales", "strategy", "management"],
      design: ["design", "ui", "ux", "interface", "visual", "aesthetic"],
      education: ["education", "learning", "teaching", "course", "training"],
      healthcare: ["health", "medical", "wellness", "fitness", "therapy"],
    };

    for (const [domain, keywords] of Object.entries(_domains)) {
      if (keywords.some((keyword) => _inputLower.includes(keyword))) {
        return domain;
      }
    }

    return "general";
  }

  private identifyConstraints(input: string): string[] {
    const constraints: string[] = [];
    const _inputLower = input.toLowerCase();

    if (
      _inputLower.includes("budget") ||
      _inputLower.includes("cheap") ||
      inputLower.includes("cost")
    ) {
      constraints.push("budget");
    }

    if (
      _inputLower.includes("time") ||
      _inputLower.includes("quick") ||
      inputLower.includes("fast")
    ) {
      constraints.push("time");
    }

    if (_inputLower.includes("simple") || _inputLower.includes("easy")) {
      constraints.push("simplicity");
    }

    return constraints;
  }

  private extractObjectives(input: string): string[] {
    const objectives: string[] = [];
    const _inputLower = input.toLowerCase();

    if (
      _inputLower.includes("increase") ||
      _inputLower.includes("improve") ||
      inputLower.includes("boost")
    ) {
      objectives.push("improvement");
    }

    if (
      _inputLower.includes("reduce") ||
      _inputLower.includes("decrease") ||
      inputLower.includes("minimize")
    ) {
      objectives.push("reduction");
    }

    if (
      _inputLower.includes("solve") ||
      _inputLower.includes("fix") ||
      inputLower.includes("address")
    ) {
      objectives.push("problem_solving");
    }

    return objectives;
  }

  private identifyTargetAudience(input: string): string {
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("user") || _inputLower.includes("customer")) {
      return "users_customers";
    }
    if (_inputLower.includes("student") || _inputLower.includes("learner")) {
      return "students";
    }
    if (_inputLower.includes("business") || _inputLower.includes("company")) {
      return "businesses";
    }
    if (
      _inputLower.includes("developer") ||
      _inputLower.includes("programmer")
    ) {
      return "developers";
    }

    return "general";
  }

  private assessRequiredCreativity(input: string): string {
    const _inputLower = input.toLowerCase();

    if (
      _inputLower.includes("innovative") ||
      _inputLower.includes("revolutionary") ||
      inputLower.includes("groundbreaking")
    ) {
      return "high";
    }

    if (
      _inputLower.includes("creative") ||
      _inputLower.includes("unique") ||
      inputLower.includes("original")
    ) {
      return "medium";
    }

    return "low";
  }

  private determineScope(input: string): string {
    const _wordCount = input.split(/\s+/).length;

    if (_wordCount < 10) {
      return "narrow";
    }
    if (_wordCount < 25) {
      return "medium";
    }
    return "broad";
  }

  private identifyInspirationSources(_input: string): string[] {
    return ["nature", "technology", "art", "science", "everyday_life"];
  }

  private getKeywordAssociations(input: string): string[] {
    // Simplified association logic
    const _words = input.toLowerCase().split(/\s+/);
    return [
      "innovation",
      "efficiency",
      "simplicity",
      "connection",
      "growth",
    ].slice(0, 3);
  }

  private getAnalogies(domain: string): string[] {
    const analogyMap: Record<string, string[]> = {
      technology: ["nature", "music", "architecture"],
      business: ["sports", "military", "gardening"],
      design: ["cooking", "storytelling", "dance"],
      general: ["nature", "sports", "cooking"],
    };

    return analogyMap[domain] || analogyMap["general"];
  }

  private identifyMorphologicalParameters(
    _input: string,
    _context: unknown,
  ): unknown[] {
    // Simplified parameter identification
    return [
      { approach: "automated", scale: "small", target: "individuals" },
      { approach: "manual", scale: "medium", target: "teams" },
      { approach: "hybrid", scale: "large", target: "organizations" },
    ];
  }

  private categorizeIdea(_idea: unknown, _context: unknown): string {
    if (_idea.type === "reverse") {
      return "disruptive";
    }
    if (_idea.originality > 0.7) {
      return "highly_original";
    }
    if (_idea.feasibility > 0.7) {
      return "practical";
    }
    return "balanced";
  }

  private refineDescription(_idea: unknown, context: unknown): string {
    return `${_idea.description} - tailored for ${context.target} in ${context.domain} domain.`;
  }

  private estimateImpact(_idea: unknown, _context: unknown): string {
    if (_idea.originality > 0.6 && _idea.feasibility > 0.5) {
      return "high";
    }
    if (_idea.originality > 0.4 || _idea.feasibility > 0.6) {
      return "medium";
    }
    return "low";
  }

  private estimateEffort(_idea: unknown, _context: unknown): string {
    if (_idea.feasibility > 0.7) {
      return "low";
    }
    if (_idea.feasibility > 0.4) {
      return "medium";
    }
    return "high";
  }

  private calculateSimilarity(_idea1: unknown, idea2: unknown): number {
    // Simplified similarity calculation
    if (_idea1.title === idea2.title) {
      return 1.0;
    }
    if (_idea1.type === idea2.type && _idea1.category === idea2.category) {
      return 0.6;
    }
    return 0.1;
  }

  private calculateOverallScore(idea: unknown): number {
    return (
      idea.originality * 0.4 +
      idea.feasibility * 0.4 +
      (idea.potential_impact === "high"
        ? 0.8
        : idea.potential_impact === "medium"
          ? 0.5
          : 0.2) *
        0.2
    );
  }

  private identifyPros(_idea: unknown, _context: unknown): string[] {
    const pros: string[] = [];

    if (_idea.originality > 0.6) {
      pros.push("Highly original approach");
    }
    if (_idea.feasibility > 0.6) {
      pros.push("Feasible to implement");
    }
    if (_idea.potential_impact === "high") {
      pros.push("High potential impact");
    }

    return pros;
  }

  private identifycons(_idea: unknown, _context: unknown): string[] {
    const cons: string[] = [];

    if (_idea.originality < 0.4) {
      cons.push("Limited originality");
    }
    if (_idea.feasibility < 0.4) {
      cons.push("Implementation challenges");
    }
    if (_idea.implementation_effort === "high") {
      cons.push("High implementation effort");
    }

    return cons;
  }

  private suggestNextSteps(_idea: unknown, _context: unknown): string[] {
    const steps: string[] = [];

    steps.push("Develop a detailed concept proposal");
    steps.push("Identify potential challenges and solutions");
    steps.push("Create a prototype or proof of concept");

    return steps;
  }

  private calculateCreativityScore(ideas: unknown[]): number {
    if (ideas.length === 0) {
      return 0;
    }

    const _avgOriginality =
      ideas.reduce((sum, idea) => sum + idea.originality, 0) / ideas.length;
    const _diversityBonus = Math.min(ideas.length / 10, 0.3);

    return Math.min(_avgOriginality + _diversityBonus, 1.0);
  }

  private calculateCreativityConfidence(
    _ideas: unknown[],
    input: string,
  ): number {
    let _confidence = 0.6; // Base _confidence

    // More ideas = higher _confidence
    _confidence += Math.min(0.3, _ideas.length * 0.03);

    // Creative keywords boost _confidence
    const _creativeKeywords = ["creative", "innovative", "original", "unique"];
    const _inputLower = input.toLowerCase();
    const _matches = _creativeKeywords.filter((keyword) =>
      _inputLower.includes(keyword),
    ).length;
    _confidence += _matches * 0.05;

    return Math.min(_confidence, 0.9);
  }

  private determineNextMode(ideas: unknown[]): string | undefined {
    // Check if ideas need further development
    const _highOriginalityIdeas = ideas.filter(
      (idea) => idea.originality > 0.7,
    );

    if (_highOriginalityIdeas.length > 2) {
      return "designing"; // Move to design/prototyping
    }

    // If many practical ideas, might need evaluation
    const _practicalIdeas = ideas.filter((idea) => idea.feasibility > 0.7);
    if (_practicalIdeas.length > 3) {
      return "analyzing"; // Move to analysis mode
    }

    return undefined;
  }
}
