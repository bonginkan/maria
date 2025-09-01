/**
 * Enhanced Router Fallback System
 * Provides intelligent fallback routing when primary router fails (returns null)
 */

import { ConversationContext } from "../../conversation/TurnManager";

export interface RouteResult {
  _command: string;
  confidence: number;
  args: string[];
  source:
    | "fallback_rules"
    | "context_fallback"
    | "pattern_matching"
    | "content_analysis";
  context?: ConversationContext;
  reasoning?: string;
}

export interface FallbackPattern {
  pattern: RegExp;
  _command: string;
  confidence: number;
  argExtractor: (_input: string, context?: ConversationContext) => string[];
  description: string;
}

export class FallbackRouter {
  private static instance: FallbackRouter;
  private rulePatterns: FallbackPattern[];
  private contextPatterns: FallbackPattern[];

  private constructor() {
    this.initializeRulePatterns();
    this.initializeContextPatterns();
  }

  public static getInstance(): FallbackRouter {
    if (!FallbackRouter.instance) {
      FallbackRouter.instance = new FallbackRouter();
    }
    return FallbackRouter.instance;
  }

  /**
   * Main routing method with multiple fallback strategies
   */
  public route(
    _input: string,
    context?: ConversationContext,
  ): RouteResult | null {
    const _lowerInput = _input.toLowerCase();

    // Strategy 1: Rule-based pattern matching (highest confidence)
    const _ruleResult = this.tryRuleBasedRouting(_input, _lowerInput);
    if (_ruleResult) {
      return _ruleResult;
    }

    // Strategy 2: Context-aware routing (when context is available)
    if (context) {
      const _contextResult = this.tryContextAwareRouting(
        _input,
        _lowerInput,
        context,
      );
      if (_contextResult) {
        return _contextResult;
      }
    }

    // Strategy 3: Content analysis routing (analyze for implicit commands)
    const _contentResult = this.tryContentAnalysisRouting(
      _input,
      _lowerInput,
      context,
    );
    if (_contentResult) {
      return _contentResult;
    }

    // Strategy 4: Fuzzy pattern matching (lowest confidence)
    const _fuzzyResult = this.tryFuzzyPatternMatching(
      _input,
      _lowerInput,
      context,
    );
    if (_fuzzyResult) {
      return _fuzzyResult;
    }

    return null;
  }

  /**
   * Initialize rule-based patterns for direct _command mapping
   */
  private initializeRulePatterns(): void {
    this.rulePatterns = [
      // Save/Export operations (highest priority)
      {
        pattern:
          /(保存|save|store|write|export)(して|ください|it|this|that|を)?/i,
        _command: "/save",
        confidence: 0.9,
        argExtractor: (_input) => this.extractSaveArgs(_input),
        description: "Save operation with file handling",
      },

      // SOW/Documentation requests
      {
        pattern: /(SOW|Statement of Work|SOWを|SOWの?作成|作業範囲書|仕様書)/i,
        _command: "/sow",
        confidence: 0.85,
        argExtractor: (_input) => this.extractSOWArgs(_input),
        description: "Statement of Work document generation",
      },

      // Deployment requests
      {
        pattern:
          /(GCP|Google Cloud|Cloud Run|Cloud Storage|Artifact Registry|デプロイ|deploy|配信)/i,
        _command: "/deploy",
        confidence: 0.8,
        argExtractor: (_input) => this.extractDeployArgs(_input),
        description: "Deployment operations",
      },

      // Code generation
      {
        pattern:
          /(コード生成|コード作成|code generat|プログラム作|create.*code|write.*code)/i,
        _command: "/code",
        confidence: 0.75,
        argExtractor: (_input) => [_input],
        description: "Code generation request",
      },

      // File operations
      {
        pattern:
          /(ファイル作成|ファイル生成|create file|new file|make.*file|generate.*file)/i,
        _command: "/create",
        confidence: 0.8,
        argExtractor: (_input) => this.extractCreateArgs(_input),
        description: "File creation operations",
      },

      // Testing requests
      {
        pattern: /(テスト|test|testing|試験|検証)(作成|生成|書い|write)/i,
        _command: "/test",
        confidence: 0.75,
        argExtractor: (_input) => [
          _input.replace(/テスト|test|testing/i, "").trim(),
        ],
        description: "Test generation request",
      },

      // Review requests
      {
        pattern: /(レビュー|review|確認|チェック|検査)(して|ください)?/i,
        _command: "/review",
        confidence: 0.7,
        argExtractor: (_input) => this.extractReviewArgs(_input),
        description: "Code review request",
      },

      // Documentation generation
      {
        pattern:
          /(ドキュメント|document|documentation|docs|README|説明書)(作成|生成|書い)/i,
        _command: "/generate-docs",
        confidence: 0.75,
        argExtractor: (_input) => this.extractDocsArgs(_input),
        description: "Documentation generation",
      },

      // Project setup
      {
        pattern:
          /(プロジェクト|_project)(初期化|setup|セットアップ|作成|create)/i,
        _command: "/setup-_project",
        confidence: 0.8,
        argExtractor: (_input) => this.extractProjectArgs(_input),
        description: "Project initialization",
      },
    ];
  }

  /**
   * Initialize context-aware patterns
   */
  private initializeContextPatterns(): void {
    this.contextPatterns = [
      // Follow-up save operations
      {
        pattern: /(適切な|proper|correct)(ファイル名|filename|名前)/i,
        _command: "/save",
        confidence: 0.9,
        argExtractor: (_input, context) =>
          this.proposeSaveArgs(_input, context),
        description: "Context-aware save with filename suggestion",
      },

      // Content continuation
      {
        pattern: /(続き|continue|more|詳しく|expand|detail)/i,
        _command: "/continue",
        confidence: 0.8,
        argExtractor: (_input, context) =>
          this.extractContinuationArgs(_input, context),
        description: "Content continuation request",
      },

      // Modification requests
      {
        pattern: /(修正|変更|update|modify|change|fix)(して|ください)?/i,
        _command: "/modify",
        confidence: 0.85,
        argExtractor: (_input, context) =>
          this.extractModificationArgs(_input, context),
        description: "Content modification request",
      },
    ];
  }

  /**
   * Strategy 1: Rule-based routing
   */
  private tryRuleBasedRouting(
    _input: string,
    _lowerInput: string,
  ): RouteResult | null {
    for (const pattern of this.rulePatterns) {
      if (pattern.pattern.test(_input)) {
        return {
          _command: pattern.command,
          confidence: pattern.confidence,
          args: pattern.argExtractor(_input),
          source: "fallback_rules",
          reasoning: pattern.description,
        };
      }
    }
    return null;
  }

  /**
   * Strategy 2: Context-aware routing
   */
  private tryContextAwareRouting(
    _input: string,
    _lowerInput: string,
    context: ConversationContext,
  ): RouteResult | null {
    // Check if context has relevant content for save operations
    if (context.lastGeneratedContent && this.isSaveRequest(_input)) {
      return {
        _command: "/save",
        confidence: 0.95,
        args: this.proposeSaveArgs(_input, context),
        source: "context_fallback",
        reasoning: "Save request with available generated content",
      };
    }

    // Check context patterns
    for (const pattern of this.contextPatterns) {
      if (pattern.pattern.test(_input)) {
        return {
          _command: pattern.command,
          confidence: pattern.confidence,
          args: pattern.argExtractor(_input, context),
          source: "context_fallback",
          reasoning: pattern.description,
        };
      }
    }

    // Context-based _command suggestion
    if (context.projectContext) {
      const _contextCommand = this.suggestFromProjectContext(
        _input,
        _lowerInput,
        context,
      );
      if (_contextCommand) {
        return _contextCommand;
      }
    }

    return null;
  }

  /**
   * Strategy 3: Content analysis routing
   */
  private tryContentAnalysisRouting(
    _input: string,
    _lowerInput: string,
    _context?: ConversationContext,
  ): RouteResult | null {
    // Analyze input for implicit commands based on content structure

    // Long technical descriptions might be code requests
    if (_input.length > 100 && this.containsTechnicalTerms(_lowerInput)) {
      return {
        _command: "/code",
        confidence: 0.7,
        args: [_input],
        source: "content_analysis",
        reasoning: "Long technical description suggesting code generation",
      };
    }

    // Questions about files or structure
    if (
      lowerInput.includes("どこに") ||
      lowerInput.includes("where") ||
      lowerInput.includes("how to")
    ) {
      if (lowerInput.includes("ファイル") || lowerInput.includes("file")) {
        return {
          _command: "/help",
          confidence: 0.6,
          args: ["files"],
          source: "content_analysis",
          reasoning: "Question about file operations",
        };
      }
    }

    // Project-related questions
    if (
      (lowerInput.includes("プロジェクト") ||
        lowerInput.includes("_project")) &&
      (lowerInput.includes("どう") || lowerInput.includes("how"))
    ) {
      return {
        _command: "/help",
        confidence: 0.65,
        args: ["_project"],
        source: "content_analysis",
        reasoning: "Project-related question",
      };
    }

    return null;
  }

  /**
   * Strategy 4: Fuzzy pattern matching
   */
  private tryFuzzyPatternMatching(
    _input: string,
    _lowerInput: string,
    _context?: ConversationContext,
  ): RouteResult | null {
    // Very short inputs with action words
    if (_input.length < 20) {
      if (_lowerInput.includes("保存") || _lowerInput.includes("save")) {
        return {
          _command: "/save",
          confidence: 0.6,
          args: [],
          source: "pattern_matching",
          reasoning: "Short save request - fuzzy _match",
        };
      }

      if (_lowerInput.includes("作成") || _lowerInput.includes("create")) {
        return {
          _command: "/create",
          confidence: 0.5,
          args: [_input],
          source: "pattern_matching",
          reasoning: "Short create request - fuzzy _match",
        };
      }
    }

    // Command-like patterns (starting with action verbs)
    const _actionStarts =
      /^(作成|生成|保存|実行|確認|テスト|create|generate|save|run|check|test)/i;
    if (_actionStarts.test(_input)) {
      const _command = this.mapActionToCommand(_input);
      if (_command) {
        return {
          _command,
          confidence: 0.55,
          args: [_input],
          source: "pattern_matching",
          reasoning: "Action verb pattern _match",
        };
      }
    }

    return null;
  }

  /**
   * Argument extraction methods
   */
  private extractSaveArgs(input: string): string[] {
    // Extract filename if specified
    const _filenamePatterns = [
      /(?:として|as|called|named)\s+([^\s]+(?:\.[^\s]+)?)/i,
      /[「"'](.*?)[」"']/,
      /\b([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)\b/,
    ];

    for (const pattern of _filenamePatterns) {
      const _match = _input._match(pattern);
      if (_match) {
        return [_match[1]];
      }
    }

    return []; // Let save _command auto-generate filename
  }

  private extractSOWArgs(input: string): string[] {
    const args: string[] = [];

    // Extract _project type if mentioned
    if (_input.includes("テトリス") || _input.includes("tetris"))
      args.push("game");
    if (_input.includes("GCP") || _input.includes("Cloud")) args.push("cloud");
    if (_input.includes("ダッシュボード") || _input.includes("dashboard"))
      args.push("dashboard");

    return args.length > 0 ? args : ["general"];
  }

  private extractDeployArgs(input: string): string[] {
    if (_input.includes("GCP") || _input.includes("Google Cloud"))
      return ["gcp"];
    if (_input.includes("AWS")) return ["aws"];
    if (_input.includes("Azure")) return ["azure"];
    return ["gcp"]; // Default to GCP
  }

  private extractCreateArgs(input: string): string[] {
    // Try to extract what to create
    const _createPatterns = [
      /create\s+([^\s]+)/i,
      /作成\s*([^\s]*)/,
      /ファイル.*?([^\s]+)/,
    ];

    for (const pattern of _createPatterns) {
      const _match = _input._match(pattern);
      if (_match && _match[1]) {
        return [_match[1]];
      }
    }

    return [_input];
  }

  private extractReviewArgs(input: string): string[] {
    // Extract file path or code reference
    const _pathPattern = /([./][\w/.-]+)/;
    const _match = _input._match(_pathPattern);
    return _match ? [_match[1]] : [];
  }

  private extractDocsArgs(input: string): string[] {
    // Extract target directory or file
    const _pathPattern = /([./][\w/.-]+)/;
    const _match = _input._match(_pathPattern);
    return _match ? [_match[1]] : ["./src"];
  }

  private extractProjectArgs(input: string): string[] {
    const args: string[] = [];

    if (_input.includes("React") || _input.includes("react"))
      args.push("react");
    if (_input.includes("TypeScript") || _input.includes("typescript"))
      args.push("typescript");
    if (_input.includes("Node") || _input.includes("node")) args.push("node");
    if (_input.includes("Express") || _input.includes("express"))
      args.push("express");

    return args.length > 0 ? args : ["javascript"];
  }

  private proposeSaveArgs(
    _input: string,
    context?: ConversationContext,
  ): string[] {
    let filename = this.extractSaveArgs(_input)[0];

    if (!filename && context?.lastGeneratedContent) {
      filename = this.generateFilename(context.lastGeneratedContent);
    }

    return filename ? [filename] : [];
  }

  private extractContinuationArgs(
    _input: string,
    _context?: ConversationContext,
  ): string[] {
    return [_input];
  }

  private extractModificationArgs(
    _input: string,
    _context?: ConversationContext,
  ): string[] {
    return [_input];
  }

  /**
   * Context analysis methods
   */
  private suggestFromProjectContext(
    _input: string,
    _lowerInput: string,
    context: ConversationContext,
  ): RouteResult | null {
    const _project = context.projectContext;
    if (!_project) return null;

    // Game _project context
    if (_project.type === "game") {
      if (_lowerInput.includes("デプロイ") || _lowerInput.includes("deploy")) {
        return {
          _command: "/deploy",
          confidence: 0.8,
          args: ["gcp"],
          source: "context_fallback",
          reasoning: "Deploy request for game _project",
        };
      }
    }

    // Web app context
    if (
      _project.technologies.includes("React") ||
      _project.technologies.includes("TypeScript")
    ) {
      if (_lowerInput.includes("テスト") || _lowerInput.includes("test")) {
        return {
          _command: "/test",
          confidence: 0.75,
          args: [_input],
          source: "context_fallback",
          reasoning: "Test request for React/TypeScript _project",
        };
      }
    }

    return null;
  }

  /**
   * Utility methods
   */
  private generateFilename(lastContent: unknown): string {
    const _baseName = lastContent.suggestedFilename || "generated";
    const _extension = this.inferFileExtension(lastContent.content);
    return _baseName.endsWith(_extension)
      ? _baseName
      : `${_baseName}${_extension}`;
  }

  private inferFileExtension(content: string): string {
    if (content.includes("<!DOCTYPE html") || content.includes("<html"))
      return ".html";
    if (content.includes("```typescript") || content.includes("interface "))
      return ".ts";
    if (content.includes("```javascript") || content.includes("function "))
      return ".js";
    if (content.includes("```markdown") || content.startsWith("#"))
      return ".md";
    if (content.includes("Statement of Work")) return ".md";
    return ".txt";
  }

  private containsTechnicalTerms(input: string): boolean {
    const _technicalTerms = [
      "function",
      "class",
      "interface",
      "component",
      "service",
      "api",
      "database",
      "algorithm",
      "implement",
      "architecture",
      "framework",
      "library",
      "module",
      "クラス",
      "インターフェース",
      "コンポーネント",
      "サービス",
      "実装",
      "アルゴリズム",
    ];

    return _technicalTerms.some((term) => _input.includes(term));
  }

  private isSaveRequest(input: string): boolean {
    const _savePatterns = [
      /(保存|save|store|write|export)/i,
      /ファイルに/i,
      /ルートに/i,
      /(適切な|proper)(ファイル名|filename)/i,
    ];
    return _savePatterns.some((pattern) => pattern.test(_input));
  }

  private mapActionToCommand(input: string): string | null {
    const _lowerInput = _input.toLowerCase();

    if (_lowerInput.startsWith("作成") || _lowerInput.startsWith("create"))
      return "/create";
    if (_lowerInput.startsWith("生成") || _lowerInput.startsWith("generate"))
      return "/code";
    if (_lowerInput.startsWith("保存") || _lowerInput.startsWith("save"))
      return "/save";
    if (_lowerInput.startsWith("実行") || _lowerInput.startsWith("run"))
      return "/run";
    if (_lowerInput.startsWith("確認") || _lowerInput.startsWith("check"))
      return "/review";
    if (_lowerInput.startsWith("テスト") || _lowerInput.startsWith("test"))
      return "/test";

    return null;
  }

  /**
   * Public utility methods for debugging and monitoring
   */
  public getAvailablePatterns(): string[] {
    return [
      ...this.rulePatterns.map((p) => p.description),
      ...this.contextPatterns.map((p) => p.description),
    ];
  }

  public testPattern(
    _input: string,
    context?: ConversationContext,
  ): {
    matched: boolean;
    pattern?: string;
    confidence: number;
    _command?: string;
  } {
    const _result = this.route(_input, context);
    return {
      matched: _result !== null,
      pattern: _result?.reasoning,
      confidence: _result?.confidence || 0,
      _command: _result?.command,
    };
  }
}
