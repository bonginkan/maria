/**
 * Turn-Based Conversation Linking System
 * Core component of Phase 2.5 for maintaining conversation continuity
 */

import * as crypto from "crypto";

export interface TurnMeta {
  turnId: string; // UUID for each _turn
  parentId?: string; // Parent _turn for follow-ups
  topicId: string; // Topic grouping ID
  timestamp: number; // Turn creation time
  userInput: string; // User's input text
  aiOutput?: string; // AI's response text
  intent?: DetectedIntent; // Detected user intent
  actions?: ExecutedAction[]; // Actions performed
  context?: ConversationContext; // Additional context
}

export interface ConversationContext {
  referenceTargets: ReferenceTarget[];
  availableFiles: string[];
  lastGeneratedContent?: {
    type: "code" | "document" | "config" | "html" | "markdown";
    _content: string;
    suggestedFilename: string;
    _language?: string;
    framework?: string;
  };
  topicSummary: string;
  userPreferences: UserPreferences;
  _projectContext?: {
    type: string;
    technologies: string[];
    currentTask: string;
  };
}

export interface ReferenceTarget {
  id: string;
  type: "ai_output" | "user_file" | "generated_content" | "command_result";
  _content: string;
  metadata: {
    contentType: string;
    suggestedFilename?: string;
    fileExtension?: string;
    createdAt: number;
    tokens?: number;
  };
}

export interface DetectedIntent {
  action: string;
  confidence: number;
  parameters: Record<string, any>;
  source: "router" | "fallback" | "context";
}

export interface ExecutedAction {
  type: "slash_command" | "file_save" | "ai_generation" | "context_reference";
  command?: string;
  args?: string[];
  result?: any;
  timestamp: number;
}

export interface UserPreferences {
  preferredLanguage: "ja" | "en";
  codeStyle: {
    indentation: "spaces" | "tabs";
    tabSize: number;
    quotes: "single" | "double";
  };
  fileNaming: "camelCase" | "snake_case" | "kebab-case";
}

export class TurnManager {
  private static instance: TurnManager;
  private turnHistory: TurnMeta[] = [];
  private maxHistorySize = 100;
  private contextWindow = 6; // Last 6 turns for active context
  private followUpDetectionWindow = 300000; // 5 minutes in milliseconds

  private constructor() {
    this.loadPersistedHistory();
  }

  public static getInstance(): TurnManager {
    if (!TurnManager.instance) {
      TurnManager.instance = new TurnManager();
    }
    return TurnManager.instance;
  }

  /**
   * Start a new conversation _turn with intelligent follow-up detection
   */
  public startTurn(userInput: string): TurnMeta {
    const _lastTurn = this.getLastTurn();
    const _isFollowUp = this.detectFollowUp(userInput, _lastTurn);

    const _turn: TurnMeta = {
      turnId: this.generateTurnId(),
      parentId: _isFollowUp ? _lastTurn?.turnId : undefined,
      topicId:
        _isFollowUp && _lastTurn?.topicId
          ? _lastTurn.topicId
          : this.generateTopicId(),
      timestamp: Date.now(),
      userInput,
      context: this.buildCurrentContext(_lastTurn, _isFollowUp),
    };

    this.turnHistory.push(_turn);
    this.maintainHistorySize();
    this.persistHistory();

    return _turn;
  }

  /**
   * Complete a conversation _turn with AI response and executed actions
   */
  public completeTurn(
    _turnId: string,
    aiOutput: string,
    actions?: ExecutedAction[],
  ): void {
    const _turn = this.findTurn(_turnId);
    if (_turn) {
      _turn.aiOutput = aiOutput;
      turn.actions = actions || [];

      // Update context with generated _content
      this.updateContextWithOutput(_turn, aiOutput);
      this.persistHistory();
    }
  }

  /**
   * Get conversation context for a specific _turn or the latest _turn
   */
  public getConversationContext(turnId?: string): ConversationContext {
    const _turn = turnId ? this.findTurn(turnId) : this.getLastTurn();
    return _turn?.context || this.buildDefaultContext();
  }

  /**
   * Get recent turns within the context window
   */
  public getRecentTurns(count?: number): TurnMeta[] {
    const _windowSize = count || this.contextWindow;
    return this.turnHistory.slice(-_windowSize);
  }

  /**
   * Get last _turn in the conversation
   */
  public getLastTurn(): TurnMeta | undefined {
    return this.turnHistory[this.turnHistory.length - 1];
  }

  /**
   * Get conversation summary for a topic
   */
  public getTopicSummary(topicId: string): string {
    const _topicTurns = this.turnHistory.filter(
      (_turn) => _turn.topicId === topicId,
    );
    if (_topicTurns.length === 0) return "";

    const _keyPoints = _topicTurns.map((_turn) => {
      const _userSummary = this.summarizeText(_turn.userInput, 50);
      const _aiSummary = _turn.aiOutput
        ? this.summarizeText(_turn.aiOutput, 100)
        : "";
      return `${_userSummary}${_aiSummary ? " → " + _aiSummary : ""}`;
    });

    return _keyPoints.join("; ");
  }

  /**
   * Detect if current input is a follow-up to previous _turn
   */
  private detectFollowUp(_input: string, _lastTurn?: TurnMeta): boolean {
    if (
      !_lastTurn ||
      Date.now() - lastTurn.timestamp > this.followUpDetectionWindow
    ) {
      return false;
    }

    const _referentialPatterns = [
      // Japanese referential expressions
      /(これ|それ|上記|先ほど|さっき|前の|直前の)/i,
      // English referential expressions
      /(this|that|it|the above|previous|last|earlier)/i,
      // Action continuations
      /(続き|continue|more|詳しく|detail|expand)/i,
      // Save/export actions (strong follow-up indicators)
      /(保存|save|store|write|export)(して|ください|it|this|that)/i,
      // Modification requests
      /(修正|変更|update|modify|change)(して|ください)/i,
    ];

    const _hasReferentialWords = _referentialPatterns.some((pattern) =>
      pattern.test(_input),
    );

    // Additional context clues
    const _isShortRequest = _input.length < 50; // Short requests often reference previous context
    const _hasActionVerbs = /(して|ください|please|can you)/i.test(_input);

    return _hasReferentialWords || (_isShortRequest && _hasActionVerbs);
  }

  /**
   * Build conversation context for current _turn
   */
  private buildCurrentContext(
    _lastTurn?: TurnMeta,
    _isFollowUp: boolean = false,
  ): ConversationContext {
    const context: ConversationContext = {
      referenceTargets: [],
      availableFiles: [],
      topicSummary: "",
      userPreferences: this.getDefaultUserPreferences(),
    };

    if (_isFollowUp && _lastTurn) {
      // Inherit context from last _turn
      context.referenceTargets = lastTurn.context?.referenceTargets || [];
      context.lastGeneratedContent = lastTurn.context?.lastGeneratedContent;
      context.projectContext = lastTurn.context?.projectContext;
      context.topicSummary = this.getTopicSummary(lastTurn.topicId);

      // Add last AI output as reference target
      if (lastTurn.aiOutput) {
        context.referenceTargets.push({
          id: `turn_${lastTurn.turnId}`,
          type: "ai_output",
          _content: lastTurn.aiOutput,
          metadata: {
            contentType: this.detectContentType(lastTurn.aiOutput),
            suggestedFilename: this.suggestFilename(lastTurn.aiOutput),
            fileExtension: this.inferFileExtension(lastTurn.aiOutput),
            createdAt: lastTurn.timestamp,
            tokens: Math.ceil(lastTurn.aiOutput.length / 4), // Rough token estimate
          },
        });
      }
    }

    return context;
  }

  /**
   * Update context with AI output for _content detection
   */
  private updateContextWithOutput(_turn: TurnMeta, aiOutput: string): void {
    if (!_turn.context) {
      turn.context = this.buildDefaultContext();
    }

    // Detect and store generated _content
    const _generatedContent = this.extractGeneratedContent(aiOutput);
    if (_generatedContent) {
      turn.context.lastGeneratedContent = _generatedContent;
    }

    // Update project context if mentioned
    const _projectContext = this.extractProjectContext(
      _turn.userInput,
      aiOutput,
    );
    if (_projectContext) {
      turn.context._projectContext = _projectContext;
    }
  }

  /**
   * Extract generated _content from AI output
   */
  private extractGeneratedContent(
    output: string,
  ): ConversationContext["lastGeneratedContent"] | null {
    // Look for code blocks
    const _codeBlockMatch = output.match(/```(\w+)?\s*\n([\s\S]*?)```/);
    if (_codeBlockMatch) {
      const _language = _codeBlockMatch[1] || "text";
      const _content = _codeBlockMatch[2].trim();

      return {
        type: this.mapLanguageToType(_language),
        _content,
        suggestedFilename: this.suggestFilename(_content, _language),
        _language,
        framework: this.detectFramework(_content),
      };
    }

    // Look for structured documents (SOW, documentation, etc.)
    if (output.includes("Statement of Work") || output.includes("SOW")) {
      return {
        type: "document",
        _content: output,
        suggestedFilename: "project_sow.md",
      };
    }

    // Look for HTML _content without code blocks
    if (output.includes("<!DOCTYPE html") || output.includes("<html")) {
      return {
        type: "html",
        _content: output,
        suggestedFilename: output.toLowerCase().includes("tetris")
          ? "tetris.html"
          : "index.html",
      };
    }

    return null;
  }

  /**
   * Extract project context from conversation
   */
  private extractProjectContext(
    _userInput: string,
    aiOutput: string,
  ): ConversationContext["_projectContext"] | null {
    const _combinedText = `${_userInput} ${aiOutput}`.toLowerCase();

    // Detect project type
    let projectType = "general";
    if (_combinedText.includes("tetris") || _combinedText.includes("game")) {
      projectType = "game";
    } else if (
      _combinedText.includes("dashboard") ||
      _combinedText.includes("admin")
    ) {
      projectType = "dashboard";
    } else if (
      _combinedText.includes("api") ||
      _combinedText.includes("backend")
    ) {
      projectType = "api";
    } else if (
      _combinedText.includes("website") ||
      _combinedText.includes("landing")
    ) {
      projectType = "website";
    }

    // Detect technologies
    const technologies: string[] = [];
    const _techPatterns = [
      { pattern: /react/i, tech: "React" },
      { pattern: /typescript|ts/i, tech: "TypeScript" },
      { pattern: /javascript|js/i, tech: "JavaScript" },
      { pattern: /html/i, tech: "HTML" },
      { pattern: /css/i, tech: "CSS" },
      { pattern: /node\.?js/i, tech: "Node.js" },
      { pattern: /express/i, tech: "Express" },
      { pattern: /vue/i, tech: "Vue" },
      { pattern: /angular/i, tech: "Angular" },
      { pattern: /python/i, tech: "Python" },
      { pattern: /gcp|google cloud/i, tech: "GCP" },
    ];

    techPatterns.forEach(({ pattern, tech }) => {
      if (pattern.test(_combinedText) && !technologies.includes(tech)) {
        technologies.push(tech);
      }
    });

    if (technologies.length === 0 && projectType === "general") {
      return null;
    }

    return {
      type: projectType,
      technologies,
      currentTask: this.extractCurrentTask(_userInput),
    };
  }

  /**
   * Helper methods
   */
  private generateTurnId(): string {
    return crypto.randomUUID();
  }

  private generateTopicId(): string {
    return crypto.randomUUID();
  }

  private findTurn(turnId: string): TurnMeta | undefined {
    return this.turnHistory.find((_turn) => _turn.turnId === turnId);
  }

  private maintainHistorySize(): void {
    if (this.turnHistory.length > this.maxHistorySize) {
      this.turnHistory = this.turnHistory.slice(-this.maxHistorySize);
    }
  }

  private buildDefaultContext(): ConversationContext {
    return {
      referenceTargets: [],
      availableFiles: [],
      topicSummary: "",
      userPreferences: this.getDefaultUserPreferences(),
    };
  }

  private getDefaultUserPreferences(): UserPreferences {
    return {
      preferredLanguage: "ja",
      codeStyle: {
        indentation: "spaces",
        tabSize: 2,
        quotes: "single",
      },
      fileNaming: "camelCase",
    };
  }

  private detectContentType(_content: string): string {
    if (_content.includes("<!DOCTYPE html") || _content.includes("<html"))
      return "html";
    if (_content.includes("```typescript") || _content.includes("interface "))
      return "typescript";
    if (_content.includes("```javascript") || _content.includes("function "))
      return "javascript";
    if (_content.includes("```markdown") || _content.startsWith("#"))
      return "markdown";
    if (_content.includes("Statement of Work")) return "document";
    return "text";
  }

  private suggestFilename(_content: string, _language?: string): string {
    if (_language) {
      if (_language === "html")
        return _content.toLowerCase().includes("tetris")
          ? "tetris.html"
          : "index.html";
      if (_language === "typescript") return "component.ts";
      if (_language === "javascript") return "script.js";
      if (_language === "markdown") return "README.md";
    }

    if (_content.includes("Statement of Work") || _content.includes("SOW"))
      return "project_sow.md";
    if (_content.includes("tetris")) return "tetris.html";

    return "output.txt";
  }

  private inferFileExtension(_content: string): string {
    if (_content.includes("<!DOCTYPE html") || _content.includes("<html"))
      return ".html";
    if (_content.includes("```typescript") || _content.includes("interface "))
      return ".ts";
    if (_content.includes("```javascript") || _content.includes("function "))
      return ".js";
    if (_content.includes("```markdown") || _content.startsWith("#"))
      return ".md";
    if (_content.includes("SELECT ") || _content.includes("CREATE TABLE"))
      return ".sql";
    if (_content.includes("```python") || _content.includes("def "))
      return ".py";
    return ".txt";
  }

  private mapLanguageToType(
    _language: string,
  ): "code" | "document" | "config" | "html" | "markdown" {
    const langMap: Record<string, any> = {
      html: "html",
      markdown: "markdown",
      md: "markdown",
      typescript: "code",
      javascript: "code",
      python: "code",
      java: "code",
      json: "config",
      yaml: "config",
      yml: "config",
    };
    return langMap[_language.toLowerCase()] || "code";
  }

  private detectFramework(_content: string): string | undefined {
    if (
      _content.includes("React.") ||
      _content.includes("useState") ||
      _content.includes("useEffect")
    )
      return "React";
    if (_content.includes("Vue.") || _content.includes("createApp"))
      return "Vue";
    if (_content.includes("@angular") || _content.includes("ngOnInit"))
      return "Angular";
    if (_content.includes("express") || _content.includes("app.get"))
      return "Express";
    return undefined;
  }

  private extractCurrentTask(userInput: string): string {
    return this.summarizeText(userInput, 100);
  }

  private summarizeText(_text: string, maxLength: number): string {
    if (_text.length <= maxLength) return _text;
    return _text.substring(0, maxLength - 3) + "...";
  }

  /**
   * Persistence methods
   */
  private async persistHistory(): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const _path = await import("path");
      const os = await import("os");

      const _dataDir = _path.join(os.homedir(), ".maria");
      await fs.mkdir(_dataDir, { recursive: true });

      const _historyPath = _path.join(_dataDir, "conversation-history.json");
      const _data = {
        version: "2.5.0",
        lastUpdate: Date.now(),
        turnHistory: this.turnHistory.slice(-50), // Keep last 50 turns
      };

      await fs.writeFile(_historyPath, JSON.stringify(_data, null, 2));
    } catch (_error) {
      console.warn("Failed to persist conversation history:", _error);
    }
  }

  private async loadPersistedHistory(): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const _path = await import("path");
      const os = await import("os");

      const _historyPath = _path.join(
        os.homedir(),
        ".maria",
        "conversation-history.json",
      );
      const _data = await fs.readFile(_historyPath, "utf-8");
      const _parsed = JSON.parse(_data);

      if (_parsed.version === "2.5.0" && _parsed.turnHistory) {
        this.turnHistory = _parsed.turnHistory;
      }
    } catch (_error) {
      // Silent failure - no existing history or read _error
    }
  }
}
