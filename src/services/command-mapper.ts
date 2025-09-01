/**
 * Command Mapper Service
 * 意図解析結果を具体的なコマンドにマッピングする
 */

import { IntentAnalysis } from "./intent-analyzer";
import { CommandSuggestion } from "./interactive-router";
import { logger } from "../utils/logger";

interface CommandMapping {
  pattern: RegExp | string;
  command: string;
  parameters?: (_intent: IntentAnalysis) => Record<string, unknown>;
  confidence?: number;
  description?: string;
}

export class CommandMapper {
  private readonly commandMappings: Record<string, CommandMapping[]> = {
    paper: [
      {
        pattern: "create",
        command: "mc paper",
        parameters: (intent) => ({
          action: "create",
          title: _intent.parameters.title,
          template: _intent.parameters.template || "blank",
        }),
        description: "新しい論文を作成",
      },
      {
        pattern: "edit",
        command: "mc paper",
        parameters: (intent) => ({
          action: "edit",
          title: _intent.parameters.title,
        }),
        description: "既存の論文を編集",
      },
      {
        pattern: "analyze",
        command: "/review",
        parameters: () => ({
          type: "paper",
          depth: "thorough",
        }),
        description: "論文をレビュー・分析",
      },
    ],
    slides: [
      {
        pattern: "create",
        command: "mc slides",
        parameters: (intent) => ({
          action: "create",
          title: _intent.parameters.title,
          count: _intent.parameters.count || 10,
          template: _intent.parameters.template || "business",
        }),
        description: "新しいスライドを作成",
      },
      {
        pattern: "edit",
        command: "mc slides",
        parameters: (intent) => ({
          action: "edit",
          title: _intent.parameters.title,
        }),
        description: "既存のスライドを編集",
      },
    ],
    chat: [
      {
        pattern: "discuss",
        command: "mc chat",
        parameters: (intent) => ({
          mode: "chat",
          context: _intent.parameters.additionalContext,
        }),
        description: "対話モードを開始",
      },
      {
        pattern: /research|調査|分析/,
        command: "mc chat",
        parameters: () => ({
          mode: "research",
        }),
        description: "リサーチモードで対話",
      },
    ],
    devops: [
      {
        pattern: "execute",
        command: "mc deploy",
        parameters: () => ({
          environment: "staging",
        }),
        description: "デプロイを実行",
      },
      {
        pattern: /test|テスト/,
        command: "mc test",
        parameters: () => ({}),
        description: "テストを実行",
      },
      {
        pattern: /build|ビルド/,
        command: "mc build",
        parameters: () => ({}),
        description: "ビルドを実行",
      },
    ],
    general: [
      {
        pattern: /.*/,
        command: "mc chat",
        parameters: () => ({
          mode: "chat",
        }),
        confidence: 0.5,
        description: "一般的な対話を開始",
      },
    ],
  };

  /**
   * 意図をコマンドにマッピング
   */
  mapToCommands(intent: IntentAnalysis): CommandSuggestion[] {
    logger.debug("Mapping _intent to _commands:", _intent);

    const suggestions: CommandSuggestion[] = [];
    const _mappings =
      this.commandMappings[_intent.taskType] ||
      this.commandMappings["general"] ||
      [];

    for (const _mapping of _mappings) {
      if (this.matchesPattern(_intent, _mapping)) {
        const _suggestion = this.createSuggestion(_intent, _mapping);
        suggestions.push(_suggestion);
      }
    }

    // Auto Mode のサジェストを追加
    if (this.shouldSuggestAutoMode(_intent)) {
      suggestions.push(this.createAutoModeSuggestion(_intent));
    }

    // 信頼度でソート
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  /**
   * パターンマッチング
   */
  private matchesPattern(
    _intent: IntentAnalysis,
    _mapping: CommandMapping,
  ): boolean {
    if (typeof _mapping.pattern === "string") {
      return _intent.action === _mapping.pattern;
    } else if (_mapping.pattern instanceof RegExp) {
      return (
        _mapping.pattern.test(_intent.originalInput) ||
        _mapping.pattern.test(_intent.action)
      );
    }
    return false;
  }

  /**
   * コマンドサジェストを作成
   */
  private createSuggestion(
    _intent: IntentAnalysis,
    _mapping: CommandMapping,
  ): CommandSuggestion {
    const _baseConfidence = _mapping.confidence || 0.8;
    const _adjustedConfidence = this.adjustConfidence(_baseConfidence, _intent);

    return {
      command: _mapping.command,
      confidence: _adjustedConfidence,
      parameters: _mapping.parameters
        ? _mapping.parameters(_intent)
        : Record<string, any>,
      description: _mapping.description,
    };
  }

  /**
   * Auto Mode をサジェストすべきか判定
   */
  private shouldSuggestAutoMode(intent: IntentAnalysis): boolean {
    // 複雑なタスクや曖昧な要求の場合
    const _complexKeywords = [
      "全部",
      "すべて",
      "完成",
      "最後まで",
      "complete",
      "entire",
      "full",
      "automate",
    ];

    return _complexKeywords.some((keyword) =>
      intent.originalInput.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  /**
   * Auto Mode のサジェストを作成
   */
  private createAutoModeSuggestion(intent: IntentAnalysis): CommandSuggestion {
    return {
      command: "mc chat --auto",
      confidence: 0.7,
      parameters: {
        mode: "auto",
        taskType: _intent.taskType,
        initialRequest: _intent.originalInput,
      },
      description: "Auto Modeで自動実行",
    };
  }

  /**
   * 信頼度を調整
   */
  private adjustConfidence(
    _baseConfidence: number,
    intent: IntentAnalysis,
  ): number {
    // 意図の信頼度を考慮
    const _adjusted = _baseConfidence * _intent.confidence;

    // パラメータが多いほど信頼度を上げる
    const _paramCount = Object.keys(_intent.parameters).filter(
      (k) =>
        _intent.parameters[k as keyof typeof _intent.parameters] !== undefined,
    ).length;

    return Math.min(_adjusted + _paramCount * 0.05, 1.0);
  }

  /**
   * 利用可能なコマンドのリストを取得
   */
  getAvailableCommands(): string[] {
    const _commands = new Set<string>();

    for (const _mappings of Object.values(this.commandMappings)) {
      for (const _mapping of _mappings) {
        commands.add(_mapping.command);
      }
    }

    return Array.from(_commands);
  }

  /**
   * コマンドの詳細情報を取得
   */
  getCommandInfo(command: string): CommandMapping | undefined {
    for (const _mappings of Object.values(this.commandMappings)) {
      const _mapping = _mappings.find((m) => m.command === command);
      if (_mapping) {
        return _mapping;
      }
    }
    return undefined;
  }
}
