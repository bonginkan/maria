/**
 * Command Dispatcher
 * 推論されたコマンドを内部的に実行し、ユーザーに適切なフィードバックを提供
 */

import { IntentClassifier, InferredCommand } from './intent-classifier';
import { ContextManager } from './context-manager';
import { SlashCommandHandler } from '../slash-command-handler';
import { logger } from '../../utils/logger';
import chalk from 'chalk';

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
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

  constructor(slashCommandHandler: SlashCommandHandler, options: DispatcherOptions = {}) {
    this.classifier = new IntentClassifier();
    this.contextManager = new ContextManager();
    this.slashCommandHandler = slashCommandHandler;
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
      const context = await this.contextManager.getCurrentContext();

      // 2. 意図分類
      const inferredCommand = this.classifier.classify(userInput);

      // 3. コンテキストベースの調整
      const adjustedCommand = inferredCommand
        ? await this.adjustCommandWithContext(inferredCommand, context as CommandContext)
        : null;

      // 4. コマンド実行判定
      if (adjustedCommand && adjustedCommand.confidence >= this.options.confirmThreshold!) {
        return await this.executeInternalCommand(adjustedCommand);
      } else if (adjustedCommand && adjustedCommand.confidence > 0.5) {
        // 信頼度が低い場合は確認
        return await this.confirmAndExecute(adjustedCommand);
      }

      // 5. コマンドが推論できない場合は通常の会話として処理
      return {
        success: false,
        output: undefined,
        error: 'コマンドを推論できませんでした。通常の会話として処理します。',
      };
    } catch (error: unknown) {
      logger.error('Dispatch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラーが発生しました',
      };
    }
  }

  /**
   * コンテキストを考慮してコマンドを調整
   */
  private async adjustCommandWithContext(
    command: InferredCommand,
    context: CommandContext,
  ): Promise<InferredCommand> {
    const adjusted = { ...command };

    // 最近のファイル操作を考慮
    if (context.recentFiles && context.recentFiles.length > 0) {
      if (command.command === '/test' && !command.params['target']) {
        adjusted.params['target'] = context.recentFiles[0];
        adjusted.confidence = Math.min(1, adjusted.confidence + 0.1);
      }

      if (command.command === '/code' && command.params['task'] === 'fix' && context.hasErrors) {
        adjusted.params['errors'] = context['errors'];
        adjusted.confidence = Math.min(1, adjusted.confidence + 0.15);
      }
    }

    // プロジェクトタイプを考慮
    if (context.projectType) {
      if (command.command === '/deploy' && !command.params['platform']) {
        if (context.projectType === 'next-app') {
          adjusted.params['platform'] = 'vercel';
        } else if (context.projectType === 'node-app') {
          adjusted.params['platform'] = 'gcp';
        }
      }

      // 言語/フレームワークの自動検出
      if (command.command === '/code' && !command.params['language']) {
        adjusted.params['language'] = context.primaryLanguage || 'typescript';
        adjusted.params['framework'] = context.primaryFramework;
      }
    }

    // 前のコマンドとの関連性チェック
    if (context.lastCommand) {
      (adjusted as Record<string, unknown>).relatedTo = this.checkCommandRelation(
        command,
        context.lastCommand,
      );
    }

    return adjusted;
  }

  /**
   * コマンドの関連性をチェック
   */
  private checkCommandRelation(current: InferredCommand, last: unknown): string | undefined {
    // 画像→動画の連続処理
    if ((last as Record<string, unknown>).command === '/image' && current.command === '/video') {
      return 'image-to-video';
    }

    // コード→テストの連続処理
    if ((last as Record<string, unknown>).command === '/code' && current.command === '/test') {
      return 'code-to-test';
    }

    // レビュー→修正の連続処理
    if (
      (last as Record<string, unknown>).command === '/review' &&
      current.command === '/code' &&
      current.params['task'] === 'fix'
    ) {
      return 'review-to-fix';
    }

    return undefined;
  }

  /**
   * 内部的にコマンドを実行
   */
  private async executeInternalCommand(command: InferredCommand): Promise<CommandResult> {
    if (this.options.verbose) {
      console.log(
        chalk.gray(
          `[内部実行] ${command.command} (信頼度: ${(command.confidence * 100).toFixed(1)}%)`,
        ),
      );
      console.log(chalk.gray(`パラメータ: ${JSON.stringify(command.params, null, 2)}`));
    }

    try {
      // スラッシュコマンドハンドラーに内部実行フラグを付けて実行
      const result = await (this.slashCommandHandler as Record<string, unknown>).execute({
        command: command.command.replace('/', ''),
        args: command.params,
        internal: true,
        originalInput: command.originalInput,
      });

      // コンテキストを更新
      await this.contextManager.updateLastCommand(command);

      // ユーザー向けにフォーマット
      const formattedResult = this.formatUserResponse(result, command);

      return {
        success: true,
        output: formattedResult,
        command: command.command,
        confidence: command.confidence,
      };
    } catch (error: unknown) {
      logger.error(`Internal command execution failed:`, error);
      return {
        success: false,
        error: `コマンド実行エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        command: command.command,
      };
    }
  }

  /**
   * 信頼度が低い場合の確認と実行
   */
  private async confirmAndExecute(command: InferredCommand): Promise<CommandResult> {
    // 実際のアプリケーションではユーザーに確認を求める
    // ここではデモ用に自動実行
    console.log(
      chalk.yellow(`\n⚠️  推論の信頼度が低いです (${(command.confidence * 100).toFixed(1)}%)`),
    );
    console.log(chalk.yellow(`実行予定: ${command.command} ${JSON.stringify(command.params)}`));

    if (this.options.autoExecute) {
      console.log(chalk.gray('自動実行モードのため、実行します...'));
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
  private formatUserResponse(result: Record<string, unknown>, command: InferredCommand): string {
    const commandName = this.getCommandDisplayName(command.command);

    // コマンドごとのカスタムメッセージ
    switch (command.command) {
      case '/video':
        return `🎬 ${command.params['prompt']}の動画を生成しています...\n${result['output'] || ''}`;

      case '/image':
        return `🎨 ${command.params['prompt']}の画像を生成しています...\n${result['output'] || ''}`;

      case '/code':
        if (command.params['task'] === 'fix') {
          return `🔧 バグを修正しています...\n${result['output'] || ''}`;
        }
        return `💻 コードを生成しています...\n${result['output'] || ''}`;

      case '/test':
        return `🧪 テストを生成しています...\n${result['output'] || ''}`;

      case '/review':
        return `👀 コードをレビューしています...\n${result['output'] || ''}`;

      case '/commit':
        return `📝 変更をコミットしています...\n${result['output'] || ''}`;

      case '/deploy':
        return `🚀 ${command.params['target'] || 'production'}環境にデプロイしています...\n${result['output'] || ''}`;

      default:
        return `✨ ${commandName}を実行しました\n${result['output'] || ''}`;
    }
  }

  /**
   * コマンドの表示名を取得
   */
  private getCommandDisplayName(command: string): string {
    const displayNames: Record<string, string> = {
      '/video': '動画生成',
      '/image': '画像生成',
      '/code': 'コード生成',
      '/test': 'テスト生成',
      '/review': 'コードレビュー',
      '/commit': 'コミット',
      '/deploy': 'デプロイ',
      '/init': 'プロジェクト初期化',
    };

    return displayNames[command] || command;
  }

  /**
   * 会話の継続性をチェック
   */
  async processContinuation(input: string): Promise<CommandResult | null> {
    const context = await this.contextManager.getCurrentContext();

    if (!context.lastCommand) {
      return null;
    }

    // 追加指示のキーワード
    const continuationKeywords = [
      'それ',
      'これ',
      'さらに',
      'もっと',
      'また',
      'あと',
      '追加で',
      'it',
      'that',
      'more',
      'also',
      'then',
      'next',
      'additionally',
    ];

    const isContinuation = continuationKeywords.some((keyword) =>
      input.toLowerCase().includes(keyword),
    );

    if (isContinuation) {
      // 前のコマンドのコンテキストで新しい入力を処理
      const modifiedInput = await this.contextManager.mergeWithLastCommand(input);
      return await this.dispatch(modifiedInput);
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
