/**
 * RouterService - インテリジェントルーティングサービス
 *
 * ユーザー入力の意図解析とルーティング
 * IntelligentRouterServiceとの統合
 */

import { IntelligentRouterService } from "../../intelligent-router/index.js";
import type { IMaria } from "@/types/maria.types";

export interface RouteResult {
  type: "command" | "query" | "conversation" | "action" | "unknown";
  confidence: number;
  command?: {
    name: string;
    args: string[];
    raw: string;
  };
  intent?: {
    primary: string;
    secondary?: string;
    entities: Record<string, any>;
  };
  suggestions?: string[];
  metadata?: Record<string, any>;
}

export interface RouterConfig {
  confidenceThreshold: number;
  enableSmartSuggestions: boolean;
  enableContextualRouting: boolean;
  maxSuggestions: number;
  fuzzyMatchThreshold: number;
}

export class RouterService {
  private _router: IntelligentRouterService | null = null;
  private _config: RouterConfig;
  private _contextHistory: string[] = [];
  private _commandPatterns: Map<string, RegExp> = new Map();

  constructor(config?: Partial<RouterConfig>) {
    this._config = {
      confidenceThreshold: 0.7,
      enableSmartSuggestions: true,
      enableContextualRouting: true,
      maxSuggestions: 5,
      fuzzyMatchThreshold: 0.8,
      ...config,
    };

    this.initializePatterns();
  }

  /**
   * ルーターの初期化
   */
  async initialize(maria: IMaria): Promise<void> {
    // IntelligentRouterServiceのインスタンス化
    this._router = new IntelligentRouterService({
      maria,
      confidenceThreshold: this._config.confidenceThreshold,
    });

    await this._router.initialize();
  }

  /**
   * 入力のルーティング
   */
  async route(input: string): Promise<RouteResult> {
    // 空入力のチェック
    if (!input || input.trim().length === 0) {
      return {
        type: "unknown",
        confidence: 0,
        suggestions: this.getDefaultSuggestions(),
      };
    }

    const trimmedInput = input.trim();

    // コマンドパターンの確認
    if (this.isCommand(trimmedInput)) {
      return this.routeCommand(trimmedInput);
    }

    // 質問パターンの確認
    if (this.isQuestion(trimmedInput)) {
      return this.routeQuery(trimmedInput);
    }

    // アクションパターンの確認
    if (this.isAction(trimmedInput)) {
      return this.routeAction(trimmedInput);
    }

    // IntelligentRouterを使用した高度な解析
    if (this._router && this._config.enableContextualRouting) {
      return await this.intelligentRoute(trimmedInput);
    }

    // デフォルトは会話として処理
    return {
      type: "conversation",
      confidence: 0.5,
      intent: {
        primary: "conversation",
        entities: { text: trimmedInput },
      },
    };
  }

  /**
   * コマンドとしてルーティング
   */
  private routeCommand(input: string): RouteResult {
    // スラッシュコマンドの解析
    if (input.startsWith("/")) {
      const parts = input.slice(1).split(/\s+/);
      const commandName = parts[0];
      const args = parts.slice(1);

      return {
        type: "command",
        confidence: 1.0,
        command: {
          name: commandName,
          args,
          raw: input,
        },
      };
    }

    // ローカルコマンドの解析
    const localCommand = this.parseLocalCommand(input);
    if (localCommand) {
      return {
        type: "command",
        confidence: 0.9,
        command: localCommand,
      };
    }

    return {
      type: "unknown",
      confidence: 0,
    };
  }

  /**
   * クエリとしてルーティング
   */
  private routeQuery(input: string): RouteResult {
    const queryIntent = this.analyzeQueryIntent(input);

    return {
      type: "query",
      confidence: queryIntent.confidence,
      intent: {
        primary: "query",
        secondary: queryIntent.type,
        entities: queryIntent.entities,
      },
      suggestions: this.getQuerySuggestions(queryIntent.type),
    };
  }

  /**
   * アクションとしてルーティング
   */
  private routeAction(input: string): RouteResult {
    const actionIntent = this.analyzeActionIntent(input);

    return {
      type: "action",
      confidence: actionIntent.confidence,
      intent: {
        primary: "action",
        secondary: actionIntent.type,
        entities: actionIntent.entities,
      },
    };
  }

  /**
   * インテリジェントルーティング
   */
  private async intelligentRoute(input: string): Promise<RouteResult> {
    if (!this._router) {
      return {
        type: "unknown",
        confidence: 0,
      };
    }

    try {
      // コンテキストを含めた解析
      const context = this.buildContext();
      const analysis = await this._router.analyze(input, context);

      // 解析結果をRouteResultに変換
      return {
        type: this.mapAnalysisToType(analysis.intent),
        confidence: analysis.confidence,
        intent: {
          primary: analysis.intent,
          secondary: analysis.subIntent,
          entities: analysis.entities,
        },
        suggestions: analysis.suggestions?.slice(
          0,
          this._config.maxSuggestions,
        ),
        metadata: analysis.metadata,
      };
    } catch (error) {
      console.warn("Intelligent routing failed:", error);
      return {
        type: "conversation",
        confidence: 0.3,
      };
    }
  }

  /**
   * コマンドパターンの初期化
   */
  private initializePatterns(): void {
    // よく使われるローカルコマンドパターン
    this._commandPatterns.set("help", /^(help|h|\?)$/i);
    this._commandPatterns.set("status", /^(status|s|stat)$/i);
    this._commandPatterns.set("clear", /^(clear|cls|c)$/i);
    this._commandPatterns.set("exit", /^(exit|quit|q|bye)$/i);
    this._commandPatterns.set("models", /^(models|m|list models)$/i);
    this._commandPatterns.set("history", /^(history|hist|h)$/i);
    this._commandPatterns.set("settings", /^(settings|config|preferences)$/i);
  }

  /**
   * コマンドかどうかの判定
   */
  private isCommand(input: string): boolean {
    // スラッシュコマンド
    if (input.startsWith("/")) return true;

    // ローカルコマンドパターン
    for (const pattern of this._commandPatterns.values()) {
      if (pattern.test(input)) return true;
    }

    return false;
  }

  /**
   * 質問かどうかの判定
   */
  private isQuestion(input: string): boolean {
    const questionPatterns = [
      /^(what|when|where|who|why|how|is|are|can|could|would|should|do|does|did)\s/i,
      /\?$/,
      /^explain\s/i,
      /^describe\s/i,
      /^tell me about\s/i,
    ];

    return questionPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * アクションかどうかの判定
   */
  private isAction(input: string): boolean {
    const actionPatterns = [
      /^(create|make|build|generate|write|implement|add|update|modify|delete|remove)\s/i,
      /^(run|execute|perform|start|stop|restart)\s/i,
      /^(analyze|check|test|validate|verify)\s/i,
      /^(show|display|list|get|fetch)\s/i,
    ];

    return actionPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * ローカルコマンドの解析
   */
  private parseLocalCommand(input: string): RouteResult["command"] | null {
    for (const [name, pattern] of this._commandPatterns.entries()) {
      if (pattern.test(input)) {
        return {
          name,
          args: [],
          raw: input,
        };
      }
    }

    return null;
  }

  /**
   * クエリ意図の解析
   */
  private analyzeQueryIntent(input: string): {
    type: string;
    confidence: number;
    entities: Record<string, any>;
  } {
    // 簡易的な意図解析
    if (/status|health|memory/i.test(input)) {
      return {
        type: "status_query",
        confidence: 0.8,
        entities: { target: "system" },
      };
    }

    if (/model|provider|ai/i.test(input)) {
      return {
        type: "model_query",
        confidence: 0.8,
        entities: { target: "models" },
      };
    }

    if (/command|help|usage/i.test(input)) {
      return {
        type: "help_query",
        confidence: 0.8,
        entities: { target: "commands" },
      };
    }

    return {
      type: "general_query",
      confidence: 0.5,
      entities: { text: input },
    };
  }

  /**
   * アクション意図の解析
   */
  private analyzeActionIntent(input: string): {
    type: string;
    confidence: number;
    entities: Record<string, any>;
  } {
    const words = input.toLowerCase().split(/\s+/);
    const action = words[0];

    const actionMap: Record<string, string> = {
      create: "creation",
      make: "creation",
      build: "creation",
      generate: "generation",
      write: "writing",
      implement: "implementation",
      add: "addition",
      update: "modification",
      modify: "modification",
      delete: "deletion",
      remove: "deletion",
      run: "execution",
      execute: "execution",
      analyze: "analysis",
      check: "validation",
      test: "testing",
    };

    const actionType = actionMap[action] || "generic_action";

    return {
      type: actionType,
      confidence: 0.7,
      entities: {
        action,
        target: words.slice(1).join(" "),
      },
    };
  }

  /**
   * 解析結果をタイプにマップ
   */
  private mapAnalysisToType(intent: string): RouteResult["type"] {
    const typeMap: Record<string, RouteResult["type"]> = {
      command: "command",
      query: "query",
      question: "query",
      action: "action",
      conversation: "conversation",
      chat: "conversation",
    };

    return typeMap[intent] || "unknown";
  }

  /**
   * コンテキストの構築
   */
  private buildContext(): Record<string, any> {
    return {
      history: this._contextHistory.slice(-5),
      timestamp: new Date().toISOString(),
      sessionId: process.pid,
    };
  }

  /**
   * デフォルトサジェスチョンの取得
   */
  private getDefaultSuggestions(): string[] {
    return [
      "Type /help for available commands",
      "Type a question to ask",
      'Start with "/" for commands',
      'Type "status" to see system status',
      'Type "exit" to quit',
    ];
  }

  /**
   * クエリサジェスチョンの取得
   */
  private getQuerySuggestions(queryType: string): string[] {
    const suggestions: Record<string, string[]> = {
      status_query: [
        "/status - Show detailed system status",
        "/memory - Show memory usage",
        "/health - Check system health",
      ],
      model_query: [
        "/models - List available models",
        "/provider - Show current provider",
        "/switch <provider> - Switch provider",
      ],
      help_query: [
        "/help - Show all commands",
        "/help <command> - Get help for specific command",
        "/commands - List all commands",
      ],
    };

    return suggestions[queryType] || [];
  }

  /**
   * 履歴の追加
   */
  addToHistory(input: string): void {
    this._contextHistory.push(input);
    if (this._contextHistory.length > 20) {
      this._contextHistory.shift();
    }
  }

  /**
   * 履歴のクリア
   */
  clearHistory(): void {
    this._contextHistory = [];
  }

  /**
   * ルーターのシャットダウン
   */
  async shutdown(): Promise<void> {
    if (this._router) {
      await this._router.shutdown();
      this._router = null;
    }
    this._contextHistory = [];
  }
}
