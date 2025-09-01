/**
 * Summarizing Mode Plugin - Information synthesis and condensation mode
 * Specialized for creating concise, structured summaries from complex information
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from "../BaseMode";

export default class SummarizingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: "summarizing",
      name: "Summarizing",
      category: "analytical",
      symbol: "📋",
      color: "cyan",
      description: "要約・統合モード - 複雑な情報を簡潔に構造化",
      keywords: [
        "summarize",
        "_summary",
        "brief",
        "overview",
        "main points",
        "key findings",
        "digest",
        "abstract",
        "condensed",
        "synopsis",
      ],
      triggers: [
        "summarize",
        "give me a _summary",
        "main points",
        "overview",
        "brief explanation",
        "key takeaways",
        "digest",
        "in _summary",
      ],
      examples: [
        "Summarize this document for me",
        "Give me the main points of this discussion",
        "Create a brief overview of the findings",
        "What are the key takeaways?",
        "Provide a condensed version of this information",
      ],
      enabled: true,
      priority: 8,
      timeout: 90000, // 1.5 minutes
      maxConcurrentSessions: 12,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(
      `[${this.config.id}] Activating summarizing mode for session ${context.sessionId}`,
    );

    this.emit("display:update", {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: "Summarizing...",
      color: this.config.color,
      sessionId: context.sessionId,
    });

    this.emit("analytics:event", {
      type: "mode_activation",
      mode: this.config.id,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      _metadata: {
        previousMode: context.previousMode,
        confidence: context.confidence,
      },
    });
  }

  protected async onDeactivate(sessionId: string): Promise<void> {
    console.log(
      `[${this.config.id}] Deactivating summarizing mode for session ${sessionId}`,
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
      `[${this.config.id}] Processing summarization request: "${_input.substring(0, 50)}..."`,
    );

    // Summarization process pipeline
    const _contentAnalysis = await this.analyzeContent(_input, context);
    const _keyPoints = await this.extractKeyPoints(_input, _contentAnalysis);
    const _structure = await this.determineSummaryStructure(_input, _keyPoints);
    const _summary = await this.generateSummary(_input, _keyPoints, _structure);
    const _metadata = await this.generateSummaryMetadata(_input, _summary);

    const _suggestions = await this.generateSummarySuggestions(
      _input,
      _summary,
    );
    const _nextMode = await this.determineNextMode(_input, _summary);

    return {
      success: true,
      output: _summary,
      _suggestions,
      nextRecommendedMode: _nextMode,
      confidence: 0.88,
      _metadata: {
        _contentAnalysis,
        keyPointsCount: _keyPoints.length,
        summaryStructure: _structure,
        compressionRatio: this.calculateCompressionRatio(_input, _summary),
        readabilityScore: this.calculateReadabilityScore(_summary),
        processedAt: Date.now(),
        ..._metadata,
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.2;

    const _inputLower = input.toLowerCase();

    // Direct summarization requests
    const _summaryKeywords = [
      "summarize",
      "_summary",
      "brief",
      "overview",
      "main points",
      "key takeaways",
      "digest",
      "abstract",
      "condensed",
      "synopsis",
    ];

    const _summaryMatches = _summaryKeywords.filter((keyword) =>
      _inputLower.includes(keyword),
    );
    if (_summaryMatches.length > 0) {
      confidence += 0.5;
      reasoning.push(
        `Direct summarization keywords: ${_summaryMatches.join(", ")}`,
      );
    }

    // Phrases that suggest summarization
    const _summaryPhrases = [
      "give me the main",
      "what are the key",
      "in a nutshell",
      "bottom line",
      "to sum up",
      "in _summary",
      "key findings",
    ];

    const _phraseMatches = _summaryPhrases.filter((phrase) =>
      _inputLower.includes(phrase),
    );
    if (_phraseMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(
        `Summarization phrases detected: ${_phraseMatches.length} matches`,
      );
    }

    // Long input suggests need for _summary
    const _wordCount = input.split(/\s+/).length;
    if (_wordCount > 50) {
      confidence += 0.2;
      reasoning.push("Long input suggests summarization need");
    }

    // Multiple _sentences/paragraphs
    const _sentenceCount = input.split(/[.!?]+/).length;
    if (_sentenceCount > 3) {
      confidence += 0.15;
      reasoning.push("Multiple _sentences suggest _summary opportunity");
    }

    // Context from previous modes
    if (context.previousMode === "researching") {
      confidence += 0.2;
      reasoning.push("Good follow-up to research mode");
    }

    if (context.previousMode === "analyzing") {
      confidence += 0.15;
      reasoning.push("Natural progression from _analysis");
    }

    // Information density indicators
    const _densityIndicators = [
      "data",
      "results",
      "findings",
      "report",
      "document",
    ];
    const _densityMatches = _densityIndicators.filter((indicator) =>
      _inputLower.includes(indicator),
    );
    if (_densityMatches.length > 0) {
      confidence += Math.min(0.2, _densityMatches.length * 0.1);
      reasoning.push(
        `Information density indicators: ${_densityMatches.join(", ")}`,
      );
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze content _structure and complexity
   */
  private async analyzeContent(
    _input: string,
    _context: ModeContext,
  ): Promise<unknown> {
    const _analysis = {
      length: _input.length,
      _wordCount: _input.split(/\s+/).length,
      _sentenceCount: _input.split(/[.!?]+/).filter((s) => s.trim().length > 0)
        .length,
      paragraphCount: _input.split(/\n\s*\n/).length,
      complexity: this.assessContentComplexity(_input),
      _topic: this.identifyMainTopic(_input),
      contentType: this.classifyContentType(_input),
      structuralElements: this.identifyStructuralElements(_input),
    };

    return _analysis;
  }

  /**
   * Extract key points from content
   */
  private async extractKeyPoints(
    _input: string,
    _analysis: unknown,
  ): Promise<string[]> {
    const _keyPoints: string[] = [];

    // Extract _sentences that likely contain key information
    const _sentences = _input
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 10);

    for (const sentence of _sentences) {
      const _importance = this.calculateSentenceImportance(
        sentence.trim(),
        _input,
      );
      if (_importance > 0.6) {
        keyPoints.push(sentence.trim());
      }
    }

    // Ensure we have at least a few key points
    if (_keyPoints.length < 3 && _sentences.length >= 3) {
      const _topSentences = _sentences
        .map((s) => ({
          text: s.trim(),
          _importance: this.calculateSentenceImportance(s.trim(), _input),
        }))
        .sort((a, b) => b._importance - a._importance)
        .slice(0, 3)
        .map((s) => s.text);

      _keyPoints.push(..._topSentences.filter((s) => !_keyPoints.includes(s)));
    }

    return _keyPoints;
  }

  /**
   * Determine the best _structure for the _summary
   */
  private async determineSummaryStructure(
    _input: string,
    _keyPoints: string[],
  ): Promise<string> {
    const _wordCount = _input.split(/\s+/).length;

    if (_wordCount < 50) {
      return "brief";
    }
    if (_wordCount < 200) {
      return "structured";
    }
    if (_wordCount < 500) {
      return "detailed";
    }
    return "comprehensive";
  }

  /**
   * Generate the actual _summary
   */
  private async generateSummary(
    input: string,
    _keyPoints: string[],
    _structure: string,
  ): Promise<string> {
    const _topic = this.identifyMainTopic(input);
    const _wordCount = input.split(/\s+/).length;

    let _summary: string[] = [];

    switch (_structure) {
      case "brief":
        _summary = this.generateBriefSummary(input, _keyPoints, _topic);
        break;
      case "structured":
        _summary = this.generateStructuredSummary(input, _keyPoints, _topic);
        break;
      case "detailed":
        _summary = this.generateDetailedSummary(input, _keyPoints, _topic);
        break;
      case "comprehensive":
        _summary = this.generateComprehensiveSummary(input, _keyPoints, _topic);
        break;
    }

    return _summary.join("\n");
  }

  /**
   * Generate brief _summary (1-2 _sentences)
   */
  private generateBriefSummary(
    _input: string,
    _keyPoints: string[],
    _topic: string,
  ): string[] {
    return [
      `Summary: ${_topic}`,
      "",
      `${_keyPoints[0] || "Main point extracted from the content."}`,
    ];
  }

  /**
   * Generate structured _summary (bullet points)
   */
  private generateStructuredSummary(
    _input: string,
    _keyPoints: string[],
    _topic: string,
  ): string[] {
    const _summary = [`Summary: ${_topic}`, "=".repeat(20), "", "Key Points:"];

    keyPoints.slice(0, 5).forEach((point, _index) => {
      summary.push(`${_index + 1}. ${point}`);
    });

    return _summary;
  }

  /**
   * Generate detailed _summary (paragraphs with sections)
   */
  private generateDetailedSummary(
    _input: string,
    _keyPoints: string[],
    _topic: string,
  ): string[] {
    const _summary = [
      `Detailed Summary: ${_topic}`,
      "=".repeat(30),
      "",
      "Overview:",
      this.generateOverview(_input, _keyPoints),
      "",
      "Key Findings:",
      ...keyPoints.slice(0, 4).map((point, _index) => `• ${point}`),
      "",
      "Conclusion:",
      this.generateConclusion(_input, _keyPoints),
    ];

    return _summary;
  }

  /**
   * Generate comprehensive _summary (full _structure)
   */
  private generateComprehensiveSummary(
    input: string,
    _keyPoints: string[],
    _topic: string,
  ): string[] {
    const _summary = [
      `Comprehensive Summary: ${_topic}`,
      "=".repeat(40),
      "",
      "Executive Summary:",
      this.generateExecutiveSummary(input, _keyPoints),
      "",
      "Main Points:",
      ...keyPoints
        .slice(0, 6)
        .map((point, _index) => `${_index + 1}. ${point}`),
      "",
      "Analysis:",
      this.generateAnalysis(input, _keyPoints),
      "",
      "Implications:",
      this.generateImplications(input, _keyPoints),
      "",
      "Recommendations:",
      ...this.generateRecommendations(input, _keyPoints),
    ];

    return _summary;
  }

  /**
   * Generate _summary-specific _suggestions
   */
  private async generateSummarySuggestions(
    _input: string,
    _summary: string,
  ): Promise<string[]> {
    const _suggestions: string[] = [];

    suggestions.push("Review _summary for accuracy and completeness");

    if (this.isLongContent(_input)) {
      suggestions.push("Consider creating different _summary lengths");
    }

    if (this.hasTechnicalContent(_input)) {
      suggestions.push("Verify technical accuracy of _summary");
    }

    if (this.hasActionableItems(_input)) {
      suggestions.push("Extract action items for follow-up");
    }

    return _suggestions.slice(0, 3);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(
    _input: string,
    _summary: string,
  ): Promise<string | undefined> {
    const _inputLower = _input.toLowerCase();

    if (_inputLower.includes("action") || _inputLower.includes("implement")) {
      return "optimizing";
    }

    if (_inputLower.includes("detail") || _inputLower.includes("analyze")) {
      return "analyzing";
    }

    if (_inputLower.includes("question") || _inputLower.includes("unclear")) {
      return "thinking";
    }

    return undefined;
  }

  // Helper methods
  private assessContentComplexity(input: string): string {
    const _avgWordsPerSentence =
      input.split(/\s+/).length / input.split(/[.!?]+/).length;

    if (_avgWordsPerSentence < 10) {
      return "simple";
    }
    if (_avgWordsPerSentence < 20) {
      return "moderate";
    }
    return "complex";
  }

  private identifyMainTopic(input: string): string {
    // Simple _topic extraction - in a real implementation, this would be more sophisticated
    const _words = input.toLowerCase().split(/\s+/);
    const _commonWords = new Set([
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
    ]);
    const _significantWords = _words.filter(
      (word) => word.length > 3 && !_commonWords.has(word),
    );

    return _significantWords.slice(0, 3).join(" ") || "General Topic";
  }

  private classifyContentType(input: string): string {
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("research") || _inputLower.includes("study")) {
      return "research";
    }
    if (_inputLower.includes("report") || _inputLower.includes("_analysis")) {
      return "report";
    }
    if (_inputLower.includes("discussion") || _inputLower.includes("meeting")) {
      return "discussion";
    }
    if (_inputLower.includes("document") || _inputLower.includes("article")) {
      return "document";
    }

    return "general";
  }

  private identifyStructuralElements(input: string): string[] {
    const elements: string[] = [];

    if (input.includes("\n\n")) {
      elements.push("paragraphs");
    }
    if (input.match(/^\d+\./m)) {
      elements.push("numbered_list");
    }
    if (input.match(/^[-*]/m)) {
      elements.push("bullet_list");
    }
    if (input.match(/^#+/m)) {
      elements.push("headings");
    }

    return elements;
  }

  private calculateSentenceImportance(
    _sentence: string,
    fullText: string,
  ): number {
    let _importance = 0.5; // Base _importance

    // Length factor
    const _words = _sentence.split(/\s+/).length;
    if (_words > 5 && _words < 25) {
      _importance += 0.1;
    }

    // Position factor (first and last _sentences are often important)
    const _sentences = fullText
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    const _position = _sentences.findIndex((s) => s.trim() === _sentence);
    if (_position === 0 || _position === _sentences.length - 1) {
      _importance += 0.2;
    }

    // Keyword density
    const _keywordIndicators = [
      "important",
      "key",
      "main",
      "significant",
      "crucial",
      "essential",
    ];
    const _hasKeywords = _keywordIndicators.some((keyword) =>
      sentence.toLowerCase().includes(keyword),
    );
    if (_hasKeywords) {
      _importance += 0.2;
    }

    return Math.min(_importance, 1.0);
  }

  private calculateCompressionRatio(
    _original: string,
    _summary: string,
  ): number {
    return _summary.length / _original.length;
  }

  private calculateReadabilityScore(text: string): number {
    // Simplified readability calculation
    const _words = text.split(/\s+/).length;
    const _sentences = text
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0).length;
    const _avgWordsPerSentence = _words / _sentences;

    // Lower numbers = more readable
    if (_avgWordsPerSentence < 15) {
      return 0.9;
    }
    if (_avgWordsPerSentence < 25) {
      return 0.7;
    }
    return 0.5;
  }

  private generateSummaryMetadata(_input: string, _summary: string): unknown {
    return {
      originalLength: _input.length,
      summaryLength: summary.length,
      compressionRatio: this.calculateCompressionRatio(_input, _summary),
      summaryType: this.classifyContentType(_input),
      structuralComplexity: this.assessContentComplexity(_input),
    };
  }

  private generateOverview(_input: string, _keyPoints: string[]): string {
    return `This content covers ${this.identifyMainTopic(_input)} with ${_keyPoints.length} key points identified.`;
  }

  private generateConclusion(_input: string, _keyPoints: string[]): string {
    return "The _analysis provides comprehensive insights that can inform decision-making and next steps.";
  }

  private generateExecutiveSummary(
    _input: string,
    _keyPoints: string[],
  ): string {
    return `Executive overview of ${this.identifyMainTopic(_input)} highlighting critical findings and implications.`;
  }

  private generateAnalysis(_input: string, _keyPoints: string[]): string {
    return "Detailed _analysis reveals patterns and relationships that support the main conclusions.";
  }

  private generateImplications(_input: string, _keyPoints: string[]): string {
    return "The findings have significant implications for strategy, implementation, and future planning.";
  }

  private generateRecommendations(
    _input: string,
    _keyPoints: string[],
  ): string[] {
    return [
      "• Review and validate key findings",
      "• Develop action plan based on insights",
      "• Monitor progress and outcomes",
      "• Consider additional research if needed",
    ];
  }

  private isLongContent(input: string): boolean {
    return input.split(/\s+/).length > 200;
  }

  private hasTechnicalContent(input: string): boolean {
    const _technicalTerms = [
      "algorithm",
      "implementation",
      "architecture",
      "framework",
      "api",
    ];
    return _technicalTerms.some((term) => input.toLowerCase().includes(term));
  }

  private hasActionableItems(input: string): boolean {
    const _actionWords = [
      "should",
      "must",
      "recommend",
      "suggest",
      "action",
      "implement",
    ];
    return _actionWords.some((word) => input.toLowerCase().includes(word));
  }
}
