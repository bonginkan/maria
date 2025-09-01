/**
 * Rolling Conversation Summarizer
 * Maintains concise but comprehensive conversation context for AI models
 */

import { TurnMeta, _ConversationContext } from "./TurnManager";

export interface ConversationSummary {
  id: string;
  topicId: string;
  _summary: string;
  _keyPoints: string[];
  lastUpdated: number;
  tokenCount: number;
  turnCount: number;
  _priority: "high" | "medium" | "low";
}

export interface SummaryOptions {
  maxTokens: number;
  windowSize: number;
  preserveCodeSnippets: boolean;
  preserveFilenames: boolean;
  includeMetadata: boolean;
}

export class ConversationSummarizer {
  private static instance: ConversationSummarizer;
  private summaryCache: Map<string, ConversationSummary> = new Map();
  private defaultOptions: SummaryOptions = {
    maxTokens: 400,
    windowSize: 6,
    preserveCodeSnippets: true,
    preserveFilenames: true,
    includeMetadata: true,
  };

  private constructor() {
    // Constructor implementation
  }

  public static getInstance(): ConversationSummarizer {
    if (!ConversationSummarizer.instance) {
      ConversationSummarizer.instance = new ConversationSummarizer();
    }
    return ConversationSummarizer.instance;
  }

  /**
   * Summarize recent conversation turns with intelligent _content preservation
   */
  public summarizeRecentTurns(
    _turns: TurnMeta[],
    options?: Partial<SummaryOptions>,
  ): string {
    const _opts = { ...this.defaultOptions, ...options };
    const _recentTurns = _turns.slice(-_opts.windowSize);

    if (_recentTurns.length === 0) return "";

    const _summary = this.buildTurnSummary(_recentTurns, _opts);

    // Check if we need to compress further
    if (this.estimateTokenCount(_summary) > _opts.maxTokens) {
      return this.compressSummary(_summary, _opts.maxTokens);
    }

    return _summary;
  }

  /**
   * Build context prompt for AI with conversation history
   */
  public buildContextPrompt(
    _turns: TurnMeta[],
    currentInput: string,
    options?: Partial<SummaryOptions>,
  ): string {
    const _opts = { ...this.defaultOptions, ...options };

    if (_turns.length === 0) return "";

    const _summary = this.summarizeRecentTurns(_turns, _opts);
    const _lastTurn = _turns[_turns.length - 1];

    let contextPrompt = "";

    // Add conversation _summary
    if (_summary) {
      contextPrompt += `## Recent Conversation Context\n${_summary}\n\n`;
    }

    // Add last AI response for immediate reference
    if (
      _lastTurn?.aiOutput &&
      this.shouldIncludeLastOutput(_lastTurn.aiOutput, currentInput)
    ) {
      const _truncatedOutput = this.intelligentTruncate(
        _lastTurn.aiOutput,
        1800,
      );
      contextPrompt += `## Last AI Response (for reference)\n${_truncatedOutput}\n\n`;
    }

    // Add current context if available
    if (_lastTurn?.context?.lastGeneratedContent) {
      const _content = _lastTurn.context.lastGeneratedContent;
      contextPrompt += `## Available Generated Content\n`;
      contextPrompt += `Type: ${_content.type}\n`;
      contextPrompt += `Suggested filename: ${_content.suggestedFilename}\n`;
      if (_content.language)
        contextPrompt += `Language: ${_content.language}\n`;
      if (_content.framework)
        contextPrompt += `Framework: ${_content.framework}\n`;
      contextPrompt += "\n";
    }

    return contextPrompt;
  }

  /**
   * Create topic-based _summary for long conversations
   */
  public createTopicSummary(
    _topicId: string,
    turns: TurnMeta[],
  ): ConversationSummary {
    const _topicTurns = turns.filter((turn) => turn._topicId === _topicId);
    if (_topicTurns.length === 0) {
      throw new Error(`No turns found for topic: ${_topicId}`);
    }

    const _keyPoints = this.extractKeyPoints(_topicTurns);
    const _summary = this.generateTopicNarrative(_topicTurns, _keyPoints);
    const _priority = this.calculatePriority(_topicTurns);

    const conversationSummary: ConversationSummary = {
      id: `summary_${_topicId}`,
      topicId: "",
      _summary,
      _keyPoints,
      lastUpdated: Date.now(),
      tokenCount: this.estimateTokenCount(_summary),
      turnCount: _topicTurns.length,
      _priority,
    };

    this.summaryCache.set(_topicId, conversationSummary);
    return conversationSummary;
  }

  /**
   * Update existing _summary with new turns
   */
  public updateTopicSummary(
    _topicId: string,
    newTurns: TurnMeta[],
  ): ConversationSummary {
    const _existingSummary = this.summaryCache.get(_topicId);

    if (!_existingSummary) {
      return this.createTopicSummary(_topicId, newTurns);
    }

    // Merge new information
    const _additionalKeyPoints = this.extractKeyPoints(newTurns);
    const _mergedKeyPoints = this.mergeKeyPoints(
      _existingSummary.keyPoints,
      _additionalKeyPoints,
    );

    const _updatedSummary = this.regenerateSummary(
      _existingSummary,
      newTurns,
      _mergedKeyPoints,
    );

    this.summaryCache.set(_topicId, _updatedSummary);
    return _updatedSummary;
  }

  /**
   * Get conversation _themes and patterns
   */
  public extractConversationThemes(turns: TurnMeta[]): string[] {
    const _themes = new Map<string, number>();

    turns.forEach((turn) => {
      const _userThemes = this.extractThemesFromText(turn.userInput);
      const _aiThemes = turn.aiOutput
        ? this.extractThemesFromText(turn.aiOutput)
        : [];

      [..._userThemes, ..._aiThemes].forEach((theme) => {
        _themes.set(theme, (_themes.get(theme) || 0) + 1);
      });
    });

    // Return _themes sorted by frequency
    return Array.from(_themes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);
  }

  /**
   * Build turn _summary with intelligent _content selection
   */
  private buildTurnSummary(
    _turns: TurnMeta[],
    options: SummaryOptions,
  ): string {
    const summaryParts: string[] = [];

    turns.forEach((turn, _index) => {
      const _isLast = _index === _turns.length - 1;
      const _userSummary = this.summarizeUserInput(turn.userInput, options);
      const _aiSummary = turn.aiOutput
        ? this.summarizeAIOutput(turn.aiOutput, options, _isLast)
        : null;

      let turnSummary = `**Turn ${_index + 1}**\nUser: ${_userSummary}`;
      if (_aiSummary) {
        turnSummary += `\nAI: ${_aiSummary}`;
      }

      // Add executed _actions if available
      if (turn.actions && turn.actions.length > 0) {
        const _actionSummary = turn.actions
          .map((action) => `${action.type}: ${action.command || "executed"}`)
          .join(", ");
        turnSummary += `\nActions: ${_actionSummary}`;
      }

      summaryParts.push(turnSummary);
    });

    return summaryParts.join("\n\n");
  }

  /**
   * Intelligent user input summarization
   */
  private summarizeUserInput(_input: string, options: SummaryOptions): string {
    // Preserve short inputs as-is
    if (_input.length <= 100) return _input;

    // Extract and preserve important elements
    const _preserved = this.extractPreservedElements(_input, options);
    let _summary = this.truncateIntelligently(_input, 120);

    // Add back _preserved elements if they were truncated
    preserved.forEach((element) => {
      if (!_summary.includes(element)) {
        _summary += ` [${element}]`;
      }
    });

    return _summary;
  }

  /**
   * AI output summarization with _content type awareness
   */
  private summarizeAIOutput(
    _output: string,
    options: SummaryOptions,
    isLastTurn: boolean,
  ): string {
    // For last turn, provide more detail
    const _maxLength = isLastTurn ? 200 : 150;

    if (_output.length <= _maxLength) return _output;

    // Detect _content type and summarize accordingly
    const _contentType = this.detectContentType(_output);

    switch (_contentType) {
      case "code":
        return this.summarizeCodeOutput(_output, options);
      case "document":
        return this.summarizeDocumentOutput(_output, options);
      case "explanation":
        return this.summarizeExplanationOutput(_output, _maxLength);
      default:
        return this.truncateIntelligently(_output, _maxLength);
    }
  }

  /**
   * Code output summarization
   */
  private summarizeCodeOutput(
    _output: string,
    options: SummaryOptions,
  ): string {
    // Extract code block information
    const _codeBlockMatch = _output.match(/```(\w+)?\s*\n([\s\S]*?)```/);
    if (_codeBlockMatch) {
      const _language = _codeBlockMatch[1] || "code";
      const _codeLength = _codeBlockMatch[2].length;
      let _summary = `Generated ${_language} (${Math.round(_codeLength / 100) * 100}+ chars)`;

      // Add _preserved _snippet if enabled
      if (options.preserveCodeSnippets && _codeLength > 0) {
        const _snippet = _codeBlockMatch[2].trim().split("\n")[0];
        if (_snippet.length > 0) {
          _summary += ` - starts with: ${_snippet.substring(0, 50)}${_snippet.length > 50 ? "..." : ""}`;
        }
      }

      return _summary;
    }

    return this.truncateIntelligently(_output, 150);
  }

  /**
   * Document output summarization
   */
  private summarizeDocumentOutput(
    _output: string,
    _options: SummaryOptions,
  ): string {
    if (_output.includes("Statement of Work") || _output.includes("SOW")) {
      return "Generated SOW document with project requirements and timeline";
    }

    if (_output.includes("# ") || _output.includes("## ")) {
      const _titleMatch = _output.match(/^# (.+?)$/m);
      if (_titleMatch) {
        return `Generated document: "${_titleMatch[1]}"`;
      }
    }

    return this.truncateIntelligently(_output, 150);
  }

  /**
   * Explanation output summarization
   */
  private summarizeExplanationOutput(
    _output: string,
    _maxLength: number,
  ): string {
    // Try to preserve the first sentence
    const _firstSentence = _output.match(/^([^.!?]+[.!?])/);
    if (_firstSentence && _firstSentence[1].length <= _maxLength) {
      return _firstSentence[1].trim();
    }

    return this.truncateIntelligently(_output, _maxLength);
  }

  /**
   * Extract key points from conversation turns
   */
  private extractKeyPoints(turns: TurnMeta[]): string[] {
    const _keyPoints: string[] = [];

    turns.forEach((turn) => {
      // Extract from user input
      const _userKeyPoints = this.extractKeyPointsFromText(turn.userInput);
      keyPoints.push(..._userKeyPoints);

      // Extract from AI output
      if (turn.aiOutput) {
        const _aiKeyPoints = this.extractKeyPointsFromText(turn.aiOutput);
        keyPoints.push(..._aiKeyPoints);
      }

      // Extract from _actions
      if (turn.actions) {
        turn.actions.forEach((action) => {
          if (action.command) {
            keyPoints.push(`Executed: ${action.command}`);
          }
        });
      }
    });

    return this.deduplicateKeyPoints(_keyPoints);
  }

  /**
   * Extract key points from text
   */
  private extractKeyPointsFromText(text: string): string[] {
    const _keyPoints: string[] = [];

    // File operations
    const _fileOps = text.match(
      /(作成|生成|保存|削除)\s*[「"']?([^「"'\s]+\.[^「"'\s]+)[「"']?/g,
    );
    if (_fileOps) {
      keyPoints.push(..._fileOps);
    }

    // Technologies mentioned
    const _technologies = this.extractTechnologies(text);
    keyPoints.push(..._technologies.map((tech) => `Technology: ${tech}`));

    // Important _actions
    const _actions = text.match(
      /(deploy|デプロイ|test|テスト|review|レビュー|create|作成)/gi,
    );
    if (_actions) {
      keyPoints.push(
        ..._actions.map((action) => `Action: ${action.toLowerCase()}`),
      );
    }

    return _keyPoints;
  }

  /**
   * Utility methods
   */
  private extractPreservedElements(
    _text: string,
    options: SummaryOptions,
  ): string[] {
    const _preserved: string[] = [];

    if (options.preserveFilenames) {
      const _filenames = _text.match(/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+/g);
      if (_filenames) _preserved.push(..._filenames);
    }

    // Preserve technical terms
    const _techTerms = this.extractTechnologies(_text);
    preserved.push(..._techTerms);

    return _preserved;
  }

  private extractTechnologies(text: string): string[] {
    const _techPatterns = [
      /React/gi,
      /TypeScript/gi,
      /JavaScript/gi,
      /HTML/gi,
      /CSS/gi,
      /Node\.js/gi,
      /Express/gi,
      /Vue/gi,
      /Angular/gi,
      /Python/gi,
      /GCP/gi,
      /AWS/gi,
      /Docker/gi,
      /Kubernetes/gi,
    ];

    const _technologies: string[] = [];
    techPatterns.forEach((pattern) => {
      const _matches = text.match(pattern);
      if (_matches) {
        technologies.push(
          ..._matches.map(
            (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase(),
          ),
        );
      }
    });

    return [...new Set(_technologies)]; // Remove duplicates
  }

  private detectContentType(
    output: string,
  ): "code" | "document" | "explanation" | "other" {
    if (output.includes("```")) return "code";
    if (
      output.includes("Statement of Work") ||
      output.includes("# ") ||
      output.includes("## ")
    )
      return "document";
    if (
      output.includes("explanation") ||
      output.includes("説明") ||
      output.length > 500
    )
      return "explanation";
    return "other";
  }

  private shouldIncludeLastOutput(
    _output: string,
    currentInput: string,
  ): boolean {
    // Include if current input references previous output
    const _referentialPatterns = [
      /(これ|それ|上記|this|that|it)/i,
      /(保存|save|store)/i,
      /(修正|変更|update|modify)/i,
    ];

    return (
      _referentialPatterns.some((pattern) => pattern.test(currentInput)) ||
      _output.includes("```") || // Include code blocks
      output.includes("Statement of Work")
    ); // Include important documents
  }

  private intelligentTruncate(_text: string, _maxLength: number): string {
    if (_text.length <= _maxLength) return _text;

    // Try to truncate at sentence boundaries
    const _sentences = _text.split(/[.!?]/);
    let truncated = "";

    for (const sentence of _sentences) {
      if ((truncated + sentence).length > _maxLength - 3) break;
      truncated += sentence + ".";
    }

    if (truncated.length > 10) {
      return truncated.slice(0, -1); // Remove extra period
    }

    // Fallback to simple truncation
    return _text.substring(0, _maxLength - 3) + "...";
  }

  private truncateIntelligently(_text: string, _maxLength: number): string {
    return this.intelligentTruncate(_text, _maxLength);
  }

  private compressSummary(_summary: string, maxTokens: number): string {
    // Estimate current tokens and calculate compression ratio
    const _currentTokens = this.estimateTokenCount(_summary);
    if (_currentTokens <= maxTokens) return _summary;

    const _compressionRatio = maxTokens / _currentTokens;
    const _targetLength = Math.floor(summary.length * _compressionRatio * 0.9); // 90% to be safe

    return this.intelligentTruncate(_summary, _targetLength);
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for mixed English/Japanese
    return Math.ceil(text.length / 4);
  }

  private generateTopicNarrative(
    _turns: TurnMeta[],
    _keyPoints: string[],
  ): string {
    const _firstTurn = _turns[0];
    const _lastTurn = _turns[_turns.length - 1];

    let narrative = `Conversation started with: ${this.summarizeUserInput(_firstTurn.userInput, this.defaultOptions)}\n`;
    narrative += `Key developments: ${_keyPoints.slice(0, 3).join(", ")}\n`;
    narrative += `Latest: ${this.summarizeUserInput(_lastTurn.userInput, this.defaultOptions)}`;

    return narrative;
  }

  private calculatePriority(turns: TurnMeta[]): "high" | "medium" | "low" {
    const _hasCodeGeneration = turns.some(
      (turn) =>
        turn.aiOutput?.includes("```") ||
        turn.actions?.some((action) => action.type === "ai_generation"),
    );

    const _hasFileOperations = turns.some((turn) =>
      turn.actions?.some((action) => action.type === "file_save"),
    );

    if (_hasCodeGeneration && _hasFileOperations) return "high";
    if (_hasCodeGeneration || _hasFileOperations) return "medium";
    return "low";
  }

  private mergeKeyPoints(_existing: string[], additional: string[]): string[] {
    const _merged = [..._existing, ...additional];
    return this.deduplicateKeyPoints(_merged);
  }

  private deduplicateKeyPoints(_keyPoints: string[]): string[] {
    const _seen = new Set<string>();
    return _keyPoints.filter((point) => {
      const _normalized = point.toLowerCase().trim();
      if (_seen.has(_normalized)) return false;
      seen.add(_normalized);
      return true;
    });
  }

  private regenerateSummary(
    _existingSummary: ConversationSummary,
    newTurns: TurnMeta[],
    _keyPoints: string[],
  ): ConversationSummary {
    const _allTurns = [...newTurns]; // In real implementation, would need to get all turns
    const _newSummary = this.generateTopicNarrative(_allTurns, _keyPoints);

    return {
      ..._existingSummary,
      _summary: _newSummary,
      _keyPoints,
      lastUpdated: Date.now(),
      tokenCount: this.estimateTokenCount(_newSummary),
      turnCount: _existingSummary.turnCount + newTurns.length,
    };
  }

  private extractThemesFromText(text: string): string[] {
    const _themes: string[] = [];
    const _lowerText = text.toLowerCase();

    // Technical _themes
    if (_lowerText.includes("code") || _lowerText.includes("コード"))
      _themes.push("coding");
    if (_lowerText.includes("test") || _lowerText.includes("テスト"))
      _themes.push("testing");
    if (_lowerText.includes("deploy") || _lowerText.includes("デプロイ"))
      _themes.push("deployment");
    if (_lowerText.includes("file") || _lowerText.includes("ファイル"))
      _themes.push("files");
    if (_lowerText.includes("project") || _lowerText.includes("プロジェクト"))
      _themes.push("project");

    return _themes;
  }

  /**
   * Public utility methods
   */
  public getSummaryCache(): Map<string, ConversationSummary> {
    return new Map(this.summaryCache);
  }

  public clearSummaryCache(): void {
    this.summaryCache.clear();
  }

  public getEstimatedTokens(text: string): number {
    return this.estimateTokenCount(text);
  }
}
