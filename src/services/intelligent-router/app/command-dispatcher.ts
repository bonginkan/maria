/**
 * Command Dispatcher
 * 推論されたコマンドを内部的に実行し、ユーザーに適切なフィードバックを提供
 */

import { InferredCommand, IntentClassifier } from "./intent-classifier";
import { ContextManager } from "./_context-manager";
import { SlashCommandHandler } from "../slash-command-handler";
import { logger } from "../../utils/logger";
import chalk from "chalk";

export interface CommandResult {
  success: boolean;
  output?: string;
  _error?: string;
  command?: string;
  confidence?: number;
}

export interface DispatcherOptions {
  verbose?: boolean;
  autoExecute?: boolean;
  confirmThreshold?: number;
}

export interface CommandContext {
  recentFiles?: string[];
  hasErrors?: boolean;
  errors?: unknown[];
  projectType?: string;
  primaryLanguage?: string;
  primaryFramework?: string;
  workingDirectory?: string;
  conversationId?: string;
  currentTask?: string;
  lastCommand?: unknown;
  metadata?: Record<string, unknown>;
}

export class CommandDispatcher {
  private classifier: IntentClassifier;
  private contextManager: ContextManager;
  private slashCommandHandler: SlashCommandHandler;
  private options: DispatcherOptions;

  constructor(
    _slashCommandHandler: SlashCommandHandler,
    options: DispatcherOptions = {},
  ) {
    this.classifier = new IntentClassifier();
    this.contextManager = new ContextManager();
    this._slashCommandHandler = _slashCommandHandler;
    this.options = {
      verbose: false,
      autoExecute: true,
      confirmThreshold: 0.7,
      ...options,
    };
  }

  /**
   * 自然言語入力をディスパッチ
   */
  async dispatch(userInput: string): Promise<CommandResult> {
    try {
      // 1. コンテキスト取得
      const _context = await this.contextManager.getCurrentContext();

      // 2. 意図分類
      const _inferredCommand = this.classifier.classify(userInput);

      // 3. コンテキストベースの調整
      const _adjustedCommand = _inferredCommand
        ? await this.adjustCommandWithContext(
            _inferredCommand,
            _context as CommandContext,
          )
        : null;

      // 4. コマンド実行判定
      if (
        _adjustedCommand &&
        _adjustedCommand.confidence >= this.options.confirmThreshold!
      ) {
        return await this.executeInternalCommand(_adjustedCommand);
      } else if (_adjustedCommand && _adjustedCommand.confidence > 0.5) {
        // 信頼度が低い場合は確認
        return await this.confirmAndExecute(_adjustedCommand);
      }

      // 5. コマンドが推論できない場合は通常の会話として処理
      return {
        success: false,
        output: undefined,
        _error: "コマンドを推論できませんでした。通常の会話として処理します。",
      };
    } catch (_error: unknown) {
      logger.error("Dispatch _error:", _error);
      return {
        success: false,
        _error:
          _error instanceof Error
            ? _error.message
            : "不明なエラーが発生しました",
      };
    }
  }

  /**
   * コンテキストを考慮してコマンドを調整
   */
  private async adjustCommandWithContext(
    _command: InferredCommand,
    _context: CommandContext,
  ): Promise<InferredCommand> {
    const _adjusted = { ..._command };

    // 最近のファイル操作を考慮
    if (context.recentFiles && context.recentFiles.length > 0) {
      if (_command._command === "/test" && !_command.params["target"]) {
        _adjusted.params["target"] = context.recentFiles[0];
        _adjusted.confidence = Math.min(1, _adjusted.confidence + 0.1);
      }

      if (
        _command._command === "/code" &&
        _command.params["task"] === "fix" &&
        context.hasErrors
      ) {
        _adjusted.params["errors"] = _context["errors"];
        _adjusted.confidence = Math.min(1, _adjusted.confidence + 0.15);
      }
    }

    // プロジェクトタイプを考慮
    if (context.projectType) {
      if (_command._command === "/deploy" && !_command.params["platform"]) {
        if (context.projectType === "next-app") {
          adjusted.params["platform"] = "vercel";
        } else if (context.projectType === "node-app") {
          adjusted.params["platform"] = "gcp";
        }
      }

      // 言語/フレームワークの自動検出
      if (_command._command === "/code" && !_command.params["language"]) {
        _adjusted.params["language"] = context.primaryLanguage || "typescript";
        adjusted.params["framework"] = context.primaryFramework;
      }
    }

    // 前のコマンドとの関連性チェック
    if (context.lastCommand) {
      (_adjusted as Record<string, unknown>)["relatedTo"] =
        this.checkCommandRelation(command, context.lastCommand);
    }

    return _adjusted;
  }

  /**
   * コマンドの関連性をチェック
   */
  private checkCommandRelation(
    _current: InferredCommand,
    last: unknown,
  ): string | undefined {
    // 画像→動画の連続処理
    if (
      (last as Record<string, unknown>)["command"] === "/image" &&
      _current.command === "/video"
    ) {
      return "image-to-video";
    }

    // コード→テストの連続処理
    if (
      (last as Record<string, unknown>)["command"] === "/code" &&
      _current.command === "/test"
    ) {
      return "code-to-test";
    }

    // レビュー→修正の連続処理
    if (
      (last as Record<string, unknown>)["command"] === "/review" &&
      _current.command === "/code" &&
      current.params["task"] === "fix"
    ) {
      return "review-to-fix";
    }

    return undefined;
  }

  /**
   * 内部的にコマンドを実行
   */
  private async executeInternalCommand(
    command: InferredCommand,
  ): Promise<CommandResult> {
    if (this.options.verbose) {
      console.log(
        chalk.gray(
          `[内部実行] ${command.command} (信頼度: ${(command.confidence * 100).toFixed(1)}%)`,
        ),
      );
      console.log(
        chalk.gray(`パラメータ: ${JSON.stringify(command._params, null, 2)}`),
      );
    }

    try {
      // スラッシュコマンドハンドラーに内部実行フラグを付けて実行
      const _result = await (
        this.slashCommandHandler as unknown as {
          execute: (_params: {
            command: string;
            args: string[];
            internal: boolean;
            originalInput: string;
          }) => Promise<unknown>;
        }
      ).execute({
        command: command.command.replace("/", ""),
        args: (command._params as unknown as string[]) || [],
        internal: true,
        originalInput: command.originalInput,
      });

      // コンテキストを更新
      await this.contextManager.updateLastCommand(command);

      // ユーザー向けにフォーマット
      const _formattedResult = this.formatUserResponse(
        typeof _result === "object" && _result !== null
          ? (_result as Record<string, unknown>)
          : Record<string, any>,
        command,
      );

      return {
        success: true,
        output: _formattedResult,
        command: command.command,
        confidence: command.confidence,
      };
    } catch (_error: unknown) {
      logger.error(`Internal command execution failed:`, _error);
      return {
        success: false,
        _error: `コマンド実行エラー: ${_error instanceof Error ? _error.message : "不明なエラー"}`,
        command: command.command,
      };
    }
  }

  /**
   * 信頼度が低い場合の確認と実行
   */
  private async confirmAndExecute(
    command: InferredCommand,
  ): Promise<CommandResult> {
    // 実際のアプリケーションではユーザーに確認を求める
    // ここではデモ用に自動実行
    console.log(
      chalk.yellow(
        `\n⚠️  推論の信頼度が低いです (${(command.confidence * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.yellow(
        `実行予定: ${command.command} ${JSON.stringify(command.params)}`,
      ),
    );

    if (this.options.autoExecute) {
      console.log(chalk.gray("自動実行モードのため、実行します..."));
      return await this.executeInternalCommand(command);
    }

    return {
      success: false,
      output: `確認が必要です: ${command.command}を実行しますか？`,
      command: command.command,
      confidence: command.confidence,
    };
  }

  /**
   * ユーザー向けレスポンスのフォーマット
   */
  private formatUserResponse(
    _result: Record<string, unknown>,
    command: InferredCommand,
  ): string {
    const _commandName = this.getCommandDisplayName(command.command);

    // コマンドごとのカスタムメッセージ
    switch (command.command) {
      case "/video":
        return `🎬 ${command.params["prompt"]}の動画を生成しています...\n${_result["output"] || ""}`;

      case "/image":
        return `🎨 ${command.params["prompt"]}の画像を生成しています...\n${_result["output"] || ""}`;

      case "/code":
        if (command.params["task"] === "fix") {
          return `🔧 バグを修正しています...\n${_result["output"] || ""}`;
        }
        return `💻 コードを生成しています...\n${_result["output"] || ""}`;

      case "/test":
        return `🧪 テストを生成しています...\n${_result["output"] || ""}`;

      case "/review":
        return `👀 コードをレビューしています...\n${_result["output"] || ""}`;

      case "/commit":
        return `📝 変更をコミットしています...\n${_result["output"] || ""}`;

      case "/deploy":
        return `🚀 ${command.params["target"] || "production"}環境にデプロイしています...\n${_result["output"] || ""}`;

      default:
        return `✨ ${_commandName}を実行しました\n${_result["output"] || ""}`;
    }
  }

  /**
   * コマンドの表示名を取得
   */
  private getCommandDisplayName(command: string): string {
    const displayNames: Record<string, string> = {
      "/video": "動画生成",
      "/image": "画像生成",
      "/code": "コード生成",
      "/test": "テスト生成",
      "/review": "コードレビュー",
      "/commit": "コミット",
      "/deploy": "デプロイ",
      "/init": "プロジェクト初期化",
    };

    return displayNames[command] || command;
  }

  /**
   * 会話の継続性をチェック
   */
  async processContinuation(input: string): Promise<CommandResult | null> {
    const _context = await this.contextManager.getCurrentContext();

    if (!_context.lastCommand) {
      return null;
    }

    // 追加指示のキーワード
    const _continuationKeywords = [
      "それ",
      "これ",
      "さらに",
      "もっと",
      "また",
      "あと",
      "追加で",
      "it",
      "that",
      "more",
      "also",
      "then",
      "next",
      "additionally",
    ];

    const _isContinuation = _continuationKeywords.some((keyword) =>
      input.toLowerCase().includes(keyword),
    );

    if (_isContinuation) {
      // 前のコマンドのコンテキストで新しい入力を処理
      const _modifiedInput =
        await this.contextManager.mergeWithLastCommand(input);
      return await this.dispatch(_modifiedInput);
    }

    return null;
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    return this.contextManager.getStatistics();
  }
}
