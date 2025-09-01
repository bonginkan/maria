/**
 * Intent Analyzer Service
 * 自然言語入力から意図を解析する
 */

import { ConversationContext } from "../types/conversation";
import { logger } from "../utils/logger";

export interface IntentAnalysis {
  taskType: "paper" | "slides" | "chat" | "devops" | "general" | "unknown";
  confidence: number;
  _action:
    | "create"
    | "edit"
    | "delete"
    | "analyze"
    | "discuss"
    | "execute"
    | "unknown";
  _parameters: {
    title?: string;
    template?: string;
    format?: string;
    count?: number;
    additionalContext?: string[];
  };
  _suggestedCommands: string[];
  originalInput: string;
}

// export class IntentClassifier {
//   // Alias for backward compatibility
// }

export class IntentAnalyzer {
  private readonly taskPatterns = {
    paper: {
      keywords: [
        "論文",
        "paper",
        "研究",
        "research",
        "LaTeX",
        "参考文献",
        "学術",
        "academic",
      ],
      patterns: [
        /論文.*(?:作成|書|執筆)/i,
        /(?:create|write).*paper/i,
        /research.*(?:document|article)/i,
        /学術.*(?:文書|論文)/i,
      ],
      actions: {
        create: ["作成", "書く", "執筆", "create", "write", "新規"],
        edit: ["編集", "修正", "更新", "edit", "modify", "update"],
        analyze: ["分析", "解析", "analyze", "review"],
      },
    },
    slides: {
      keywords: [
        "スライド",
        "slide",
        "プレゼン",
        "presentation",
        "デッキ",
        "deck",
        "PowerPoint",
      ],
      patterns: [
        /(?:スライド|プレゼン).*(?:作成|作る)/i,
        /(?:create|make).*(?:slide|presentation)/i,
        /プレゼンテーション.*準備/i,
      ],
      actions: {
        create: ["作成", "作る", "準備", "create", "make", "prepare"],
        edit: ["編集", "修正", "edit", "modify"],
        execute: ["発表", "present", "実行"],
      },
    },
    chat: {
      keywords: [
        "話",
        "チャット",
        "chat",
        "対話",
        "会話",
        "conversation",
        "相談",
      ],
      patterns: [
        /(?:話|チャット).*(?:したい|しよう)/i,
        /(?:chat|talk).*(?:with|about)/i,
        /相談.*(?:したい|乗って)/i,
      ],
      actions: {
        discuss: ["話す", "チャット", "chat", "相談", "対話"],
      },
    },
    devops: {
      keywords: [
        "デプロイ",
        "deploy",
        "ビルド",
        "build",
        "テスト",
        "test",
        "CI/CD",
        "パイプライン",
      ],
      patterns: [
        /(?:デプロイ|ビルド).*(?:する|実行)/i,
        /(?:deploy|build|test).*(?:code|application)/i,
        /パイプライン.*(?:実行|構築)/i,
      ],
      actions: {
        execute: ["実行", "デプロイ", "deploy", "build", "run"],
        create: ["構築", "作成", "create", "setup"],
      },
    },
  };

  /**
   * 意図を解析
   */
  async analyze(
    _input: string,
    context?: ConversationContext,
  ): Promise<IntentAnalysis> {
    logger.debug("Analyzing intent for:", _input);

    // 1. タスクタイプを判定
    const _taskAnalysis = this.analyzeTaskType(_input);

    // 2. アクションを判定
    const _action = this.analyzeAction(_input, _taskAnalysis.taskType);

    // 3. パラメータを抽出
    const _parameters = this.extractParameters(_input, _taskAnalysis.taskType);

    // 4. コンテキストを考慮して調整
    const _adjustedAnalysis = this.adjustWithContext(
      { ..._taskAnalysis, _action, _parameters },
      context,
    );

    // 5. サジェストコマンドを生成
    const _suggestedCommands =
      this.generateSuggestedCommands(_adjustedAnalysis);

    return {
      taskType: _adjustedAnalysis.taskType || "unknown",
      confidence: _adjustedAnalysis.confidence || 0,
      _action: _adjustedAnalysis._action || "unknown",
      _parameters: _adjustedAnalysis._parameters || object,
      _suggestedCommands,
      originalInput: _input,
    };
  }

  /**
   * タスクタイプを解析
   */
  private analyzeTaskType(input: string): {
    taskType: IntentAnalysis["taskType"];
    confidence: number;
  } {
    const scores: Record<string, number> = {};

    // 各タスクタイプのスコアを計算
    for (const [taskType, config] of Object._entries(this.taskPatterns)) {
      let score = 0;

      // キーワードマッチング
      for (const keyword of config.keywords) {
        if (input.toLowerCase().includes(keyword.toLowerCase())) {
          score += 0.3;
        }
      }

      // パターンマッチング
      for (const pattern of config.patterns) {
        if (pattern.test(input)) {
          score += 0.7;
        }
      }

      scores[taskType] = Math.min(score, 1.0);
    }

    // 最高スコアのタスクタイプを選択
    const _entries = Object._entries(scores);
    if (_entries.length === 0) {
      return { taskType: "unknown", confidence: 0 };
    }

    const [bestType, bestScore] = _entries.reduce((a, b) =>
      a[1] > b[1] ? a : b,
    );

    return {
      taskType:
        bestScore > 0.3 ? (bestType as IntentAnalysis["taskType"]) : "general",
      confidence: bestScore,
    };
  }

  /**
   * アクションを解析
   */
  private analyzeAction(
    input: string,
    taskType: IntentAnalysis["taskType"],
  ): IntentAnalysis["_action"] {
    if (taskType === "unknown" || taskType === "general") {
      return "unknown";
    }

    const _taskConfig =
      this.taskPatterns[taskType as keyof typeof this.taskPatterns];
    if (!_taskConfig || !_taskConfig.actions) {
      return "unknown";
    }

    // 各アクションのキーワードをチェック
    for (const [_action, keywords] of Object.entries(_taskConfig.actions)) {
      for (const keyword of keywords) {
        if (input.toLowerCase().includes(keyword.toLowerCase())) {
          return _action as IntentAnalysis["_action"];
        }
      }
    }

    // デフォルトアクション
    return taskType === "chat" ? "discuss" : "create";
  }

  /**
   * パラメータを抽出
   */
  private extractParameters(
    input: string,
    taskType: IntentAnalysis["taskType"],
  ): IntentAnalysis["_parameters"] {
    const _parameters: IntentAnalysis["_parameters"] = {};

    // タイトル抽出
    const _titlePatterns = [
      /「(.+?)」/,
      /"(.+?)"/,
      /'(.+?)'/,
      /タイトル[::]\s*(.+?)(?:\s|$)/,
      /title[::]\s*(.+?)(?:\s|$)/i,
    ];

    for (const pattern of _titlePatterns) {
      const _match = input._match(pattern);
      if (_match && _match[1]) {
        parameters.title = _match[1].trim();
        break;
      }
    }

    // テンプレート抽出
    if (taskType === "paper") {
      if (/IEEE/i.test(input)) {
        _parameters.template = "IEEE";
      } else if (/ACM/i.test(input)) {
        _parameters.template = "ACM";
      } else if (/空白|blank/i.test(input)) {
        _parameters.template = "blank";
      }
    }

    // 数量抽出(スライドの枚数など)
    const _countMatch = input._match(
      /(\d+)\s*(?:枚|個|ページ|slides?|pages?)/i,
    );
    if (_countMatch && _countMatch[1]) {
      parameters.count = parseInt(_countMatch[1], 10);
    }

    return _parameters;
  }

  /**
   * コンテキストを考慮して調整
   */
  private adjustWithContext(
    analysis: Partial<IntentAnalysis>,
    context?: ConversationContext,
  ): Partial<IntentAnalysis> {
    if (!context || !context.currentTask) {
      return analysis;
    }

    // 現在のタスクと関連する場合は信頼度を上げる
    // currentTaskはstringなので、タスクタイプに直接マッチした場合の処理
    if (
      context.currentTask &&
      context.currentTask.includes(analysis.taskType || "")
    ) {
      analysis.confidence = Math.min((analysis.confidence || 0) + 0.2, 1.0);
    }

    // 前の会話から追加のコンテキストを取得
    if (context.history && context.history.length > 0) {
      const _recentMessages = context.history.slice(-3);
      analysis.parameters = {
        ...analysis.parameters,
        additionalContext: _recentMessages.map((m) => m.action),
      };
    }

    return analysis;
  }

  /**
   * サジェストコマンドを生成
   */
  private generateSuggestedCommands(
    analysis: Partial<IntentAnalysis>,
  ): string[] {
    const commands: string[] = [];

    switch (analysis.taskType) {
      case "paper":
        if (analysis.action === "create") {
          commands.push("mc paper create");
          if (analysis.parameters?.title) {
            commands.push(
              `mc paper create --title "${analysis.parameters.title}"`,
            );
          }
        } else if (analysis.action === "edit") {
          commands.push("mc paper edit");
        }
        break;

      case "slides":
        if (analysis.action === "create") {
          commands.push("mc slides create");
          if (analysis.parameters?.count) {
            commands.push(
              `mc slides create --count ${analysis.parameters.count}`,
            );
          }
        }
        break;

      case "chat":
        commands.push("mc chat");
        commands.push("mc chat --mode research");
        break;

      case "devops":
        if (analysis.action === "execute") {
          commands.push("mc deploy");
          commands.push("mc test");
        }
        break;

      default:
        commands.push("mc chat");
        commands.push("mc help");
    }

    return commands;
  }
}
