/**
 * Thinking Mode Plugin - Standard _reasoning and analysis mode
 * The default cognitive mode for general problem-solving and analysis
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from "../BaseMode";

export default class ThinkingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: "thinking",
      name: "Thinking",
      _category: "_reasoning",
      symbol: "✽",
      color: "cyan",
      description: "通常の推論プロセス - 標準的な思考・分析モード",
      keywords: [
        "think",
        "analyze",
        "consider",
        "examine",
        "evaluate",
        "assess",
        "reason",
        "logic",
        "understand",
        "explain",
      ],
      triggers: [
        "what is",
        "how does",
        "why",
        "explain",
        "tell me about",
        "help me understand",
        "can you",
        "please",
        "default",
      ],
      examples: [
        "What is the meaning of this code?",
        "How does this algorithm work?",
        "Explain the concept behind this",
        "Help me understand this problem",
        "Can you analyze this situation?",
      ],
      enabled: true,
      priority: 1, // Highest priority as default mode
      timeout: 60000, // 1 minute
      maxConcurrentSessions: 20,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(
      `[${this.config.id}] Activating thinking mode for session ${context.sessionId}`,
    );

    // Set up thinking mode context
    this.emit("display:update", {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: "Thinking...",
      color: this.config.color,
      sessionId: context.sessionId,
    });

    // Log activation
    this.emit("analytics:event", {
      type: "mode_activation",
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
    console.log(
      `[${this.config.id}] Deactivating thinking mode for session ${sessionId}`,
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
      `[${this.config.id}] Processing _input: "${_input.substring(0, 50)}..."`,
    );

    // Thinking mode processing steps
    const _analysisSteps = await this.performAnalysis(_input, context);
    const _reasoning = await this.generateReasoning(_input, _analysisSteps);
    const _suggestions = await this.generateSuggestions(_input, _reasoning);

    // Determine next recommended mode based on analysis
    const _nextMode = await this.determineNextMode(_input, _reasoning);

    return {
      success: true,
      output: _reasoning,
      _suggestions,
      nextRecommendedMode: _nextMode,
      confidence: 0.85,
      metadata: {
        _analysisSteps,
        processedAt: Date.now(),
        inputLength: _input.length,
        reasoningLength: _reasoning.length,
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; _reasoning: string[] }> {
    const _reasoning: string[] = [];
    let confidence = 0.5; // Base confidence for default mode

    // Thinking mode can handle almost anything as the default
    reasoning.push("Default thinking mode - can handle general queries");

    // Check for explicit thinking indicators
    const _thinkingIndicators = [
      "think",
      "analyze",
      "consider",
      "understand",
      "explain",
      "what",
      "how",
      "why",
      "when",
      "where",
    ];

    const _inputLower = input.toLowerCase();
    const _matches = _thinkingIndicators.filter((indicator) =>
      _inputLower.includes(indicator),
    );

    if (_matches.length > 0) {
      confidence += Math.min(0.3, _matches.length * 0.1);
      reasoning.push(`Thinking indicators found: ${_matches.join(", ")}`);
    }

    // Boost confidence if no other specific mode _patterns detected
    if (!this.hasSpecificModePatterns(input)) {
      confidence += 0.2;
      reasoning.push(
        "No specific mode _patterns detected - default to thinking",
      );
    }

    // Context-based adjustments
    if (context.previousMode && context.previousMode !== "thinking") {
      confidence += 0.1;
      reasoning.push("Good transition from specialized mode back to thinking");
    }

    return { confidence: Math.min(confidence, 1.0), _reasoning };
  }

  /**
   * Perform multi-step analysis of the input
   */
  private async performAnalysis(
    _input: string,
    context: ModeContext,
  ): Promise<string[]> {
    const steps: string[] = [];

    // Step 1: Input categorization
    const _category = this.categorizeInput(_input);
    steps.push(`Input categorized as: ${_category}`);

    // Step 2: Complexity assessment
    const _complexity = this.assessComplexity(_input);
    steps.push(`Complexity level: ${_complexity}`);

    // Step 3: Context integration
    if (context.metadata?.previousInputs) {
      steps.push("Integrated with previous context");
    }

    // Step 4: Knowledge _domain identification
    const _domain = this.identifyDomain(_input);
    steps.push(`Knowledge _domain: ${_domain}`);

    return steps;
  }

  /**
   * Generate _reasoning based on analysis
   */
  private async generateReasoning(
    _input: string,
    _analysisSteps: string[],
  ): Promise<string> {
    // This is a simplified _reasoning generation
    // In a real implementation, this would involve more sophisticated NLP

    const _reasoning = [
      `Analysis of the _input: "${_input}"`,
      "",
      "Processing steps:",
      ..._analysisSteps.map((step) => `• ${step}`),
      "",
      "Based on this analysis, I can provide insights and help you understand the topic.",
      "The thinking process involves breaking down the problem, examining different aspects,",
      "and synthesizing information to provide a comprehensive response.",
    ];

    return _reasoning.join("\n");
  }

  /**
   * Generate helpful _suggestions
   */
  private async generateSuggestions(
    _input: string,
    _reasoning: string,
  ): Promise<string[]> {
    const _suggestions: string[] = [];

    // General thinking _suggestions
    _suggestions.push("Consider asking for more specific details");
    _suggestions.push("Think about related concepts or examples");
    suggestions.push("Break the problem into smaller parts");

    // Input-specific _suggestions
    if (_input.includes("?")) {
      suggestions.push("Try rephrasing the question differently");
    }

    if (_input.length < 10) {
      suggestions.push("Provide more context for better analysis");
    }

    if (this.containsTechnicalTerms(_input)) {
      suggestions.push(
        "Consider switching to research mode for deeper technical analysis",
      );
    }

    return _suggestions.slice(0, 3); // Limit to top 3 _suggestions
  }

  /**
   * Determine the next recommended mode
   */
  private async determineNextMode(
    _input: string,
    _reasoning: string,
  ): Promise<string | undefined> {
    // Check if input suggests a specific mode would be better
    const _inputLower = _input.toLowerCase();

    if (
      _inputLower.includes("error") ||
      _inputLower.includes("bug") ||
      _inputLower.includes("fix")
    ) {
      return "debugging";
    }

    if (
      _inputLower.includes("optimize") ||
      _inputLower.includes("improve") ||
      inputLower.includes("performance")
    ) {
      return "optimizing";
    }

    if (
      _inputLower.includes("idea") ||
      _inputLower.includes("brainstorm") ||
      inputLower.includes("creative")
    ) {
      return "brainstorming";
    }

    if (
      _inputLower.includes("research") ||
      _inputLower.includes("find") ||
      inputLower.includes("search")
    ) {
      return "researching";
    }

    if (
      _inputLower.includes("summary") ||
      _inputLower.includes("summarize") ||
      inputLower.includes("brief")
    ) {
      return "summarizing";
    }

    // Stay in thinking mode for general queries
    return undefined;
  }

  /**
   * Categorize the input type
   */
  private categorizeInput(input: string): string {
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("?")) {
      return "question";
    }
    if (_inputLower.includes("explain") || _inputLower.includes("describe")) {
      return "explanation_request";
    }
    if (_inputLower.includes("help") || _inputLower.includes("assist")) {
      return "assistance_request";
    }
    if (
      _inputLower.includes("what") ||
      _inputLower.includes("how") ||
      _inputLower.includes("why")
    ) {
      return "inquiry";
    }
    if (input.length > 100) {
      return "complex_statement";
    }

    return "general";
  }

  /**
   * Assess input _complexity
   */
  private assessComplexity(input: string): string {
    const _wordCount = input.split(/\s+/).length;
    const _hasQuestions = (input.match(/\?/g) || []).length;
    const _hasTechnicalTerms = this.containsTechnicalTerms(input);

    if (_wordCount < 5) {
      return "simple";
    }
    if (_wordCount < 15 && _hasQuestions <= 1 && !_hasTechnicalTerms) {
      return "moderate";
    }
    if (_wordCount < 30 && (_hasQuestions <= 2 || _hasTechnicalTerms)) {
      return "complex";
    }

    return "very_complex";
  }

  /**
   * Identify knowledge _domain
   */
  private identifyDomain(input: string): string {
    const _inputLower = input.toLowerCase();

    const _domains = {
      programming: [
        "code",
        "function",
        "variable",
        "algorithm",
        "programming",
        "software",
        "api",
      ],
      mathematics: [
        "calculate",
        "equation",
        "formula",
        "math",
        "number",
        "statistics",
      ],
      science: [
        "experiment",
        "hypothesis",
        "research",
        "study",
        "analysis",
        "data",
      ],
      business: [
        "strategy",
        "market",
        "business",
        "revenue",
        "customer",
        "sales",
      ],
      general: [],
    };

    for (const [_domain, keywords] of Object.entries(_domains)) {
      if (keywords.some((keyword) => _inputLower.includes(keyword))) {
        return _domain;
      }
    }

    return "general";
  }

  /**
   * Check if input contains technical terms
   */
  private containsTechnicalTerms(input: string): boolean {
    const _technicalTerms = [
      "algorithm",
      "function",
      "variable",
      "database",
      "server",
      "api",
      "framework",
      "library",
      "protocol",
      "architecture",
      "implementation",
      "optimization",
      "performance",
      "scalability",
      "security",
    ];

    const _inputLower = input.toLowerCase();
    return _technicalTerms.some((term) => _inputLower.includes(term));
  }

  /**
   * Check if input has _patterns that suggest other specific modes
   */
  private hasSpecificModePatterns(input: string): boolean {
    const _inputLower = input.toLowerCase();

    const _patterns = [
      // Debugging _patterns
      /error|bug|fix|debug|broken|crash|fail|exception/i,
      // Optimization _patterns
      /optimize|improve|performance|speed|faster|efficient/i,
      // Creative _patterns
      /idea|brainstorm|creative|innovative|concept|design/i,
      // Research _patterns
      /research|find|search|investigate|study|explore/i,
      // Summary _patterns
      /summary|summarize|brief|overview|main points/i,
    ];

    return _patterns.some((pattern) => pattern.test(_inputLower));
  }
}
