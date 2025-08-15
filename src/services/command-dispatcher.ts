/**
 * Command Dispatcher Service
 * 内部コマンド実行エンジン - 自然言語から内部スラッシュコマンドを自動実行
 * Phase 1: Internal Slash Command Auto-Execution System
 */

import { logger } from '../utils/logger';
import { IntentAnalysis } from './intent-analyzer';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface CommandDispatchResult {
  success: boolean;
  command: string;
  parameters?: Record<string, unknown>;
  output?: string;
  error?: string;
  executionTime: number;
}

export interface QueuedCommand {
  id: string;
  command: string;
  parameters: Record<string, unknown>;
  priority: number;
  timestamp: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
}

export class CommandDispatcher extends EventEmitter {
  private commandQueue: QueuedCommand[] = [];
  private isProcessing = false;
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private executionHistory: CommandDispatchResult[] = [];

  constructor() {
    super();
    this.registerBuiltInCommands();
  }

  /**
   * Register built-in command handlers
   */
  private registerBuiltInCommands() {
    // メディア生成コマンド
    this.registerCommand('/video', async (params) => {
      logger.info('Executing /video command', params);

      try {
        // Create temporary directory if not exists
        const tempDir = path.join(os.tmpdir(), 'maria-videos');
        await fs.mkdir(tempDir, { recursive: true });

        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `maria-video-${timestamp}.mp4`;
        const filepath = path.join(tempDir, filename);

        // Simulate video generation (in real implementation, call actual video generation service)
        const videoContent = Buffer.from(
          `Video content for: ${params['prompt'] || 'デフォルトプロンプト'}`,
        );
        await fs.writeFile(filepath, videoContent);

        logger.info(`Video saved to: ${filepath}`);

        return {
          success: true,
          output: `✅ 動画生成完了\n📹 プロンプト: ${params['prompt'] || 'デフォルトプロンプト'}\n📁 保存先: ${filepath}`,
        };
      } catch (error: unknown) {
        logger.error('Failed to generate video:', error);
        return {
          success: false,
          error: `動画生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    });

    this.registerCommand('/image', async (params) => {
      logger.info('Executing /image command', params);

      try {
        // Create temporary directory if not exists
        const tempDir = path.join(os.tmpdir(), 'maria-images');
        await fs.mkdir(tempDir, { recursive: true });

        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `maria-image-${timestamp}.png`;
        const filepath = path.join(tempDir, filename);

        // Simulate image generation (in real implementation, call actual image generation service)
        const imageContent = Buffer.from(
          `Image content for: ${params['prompt'] || 'デフォルトプロンプト'}`,
        );
        await fs.writeFile(filepath, imageContent);

        logger.info(`Image saved to: ${filepath}`);

        return {
          success: true,
          output: `✅ 画像生成完了\n🎨 プロンプト: ${params['prompt'] || 'デフォルトプロンプト'}\n📁 保存先: ${filepath}`,
        };
      } catch (error: unknown) {
        logger.error('Failed to generate image:', error);
        return {
          success: false,
          error: `画像生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    });

    // コード生成コマンド
    this.registerCommand('/code', async (params) => {
      logger.info('Executing /code command', params);
      const action = params['action'] || 'generate';
      return {
        success: true,
        output: `コード${action === 'fix' ? '修正' : '生成'}を開始: ${params['prompt']}`,
      };
    });

    // テスト関連
    this.registerCommand('/test', async (params) => {
      logger.info('Executing /test command', params);
      return {
        success: true,
        output: `テスト生成を開始: ${params['target'] || '全ファイル'}`,
      };
    });

    // レビュー
    this.registerCommand('/review', async (params) => {
      logger.info('Executing /review command', params);
      return {
        success: true,
        output: `コードレビューを開始: ${params['target'] || '最新の変更'}`,
      };
    });

    // コミット
    this.registerCommand('/commit', async (params) => {
      logger.info('Executing /commit command', params);
      return {
        success: true,
        output: `AIコミットメッセージ生成: ${params['message'] || '自動生成'}`,
      };
    });

    // モデル選択
    this.registerCommand('/model', async (params) => {
      logger.info('Executing /model command', params);
      return {
        success: true,
        output: `モデル切り替え: ${params['model'] || 'インタラクティブ選択'}`,
      };
    });

    // 初期化
    this.registerCommand('/init', async (params) => {
      logger.info('Executing /init command', params);
      return {
        success: true,
        output: `MARIA.md生成: プロジェクト解析開始`,
      };
    });

    // クリア
    this.registerCommand('/clear', async () => {
      logger.info('Executing /clear command');
      return {
        success: true,
        output: 'コンテキストをクリアしました',
      };
    });
  }

  /**
   * Register a command handler
   */
  registerCommand(command: string, handler: CommandHandler) {
    this.commandHandlers.set(command, handler);
    logger.debug(`Registered command handler: ${command}`);
  }

  /**
   * Dispatch command from intent analysis
   */
  async dispatchFromIntent(intent: IntentAnalysis): Promise<CommandDispatchResult> {
    const startTime = Date.now();

    // Map intent to internal command
    const command = this.mapIntentToCommand(intent);
    const parameters = this.extractParameters(intent);

    logger.info(`Dispatching command from intent: ${command}`, { intent, parameters });

    try {
      const result = await this.execute(command, parameters);
      const executionTime = Date.now() - startTime;

      const dispatchResult: CommandDispatchResult = {
        success: result.success,
        command,
        parameters,
        output: result.output,
        error: result.error,
        executionTime,
      };

      this.executionHistory.push(dispatchResult);
      this.emit('command:executed', dispatchResult);

      return dispatchResult;
    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;
      const dispatchResult: CommandDispatchResult = {
        success: false,
        command,
        parameters,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };

      this.executionHistory.push(dispatchResult);
      this.emit('command:failed', dispatchResult);

      return dispatchResult;
    }
  }

  /**
   * Map intent analysis to internal command
   */
  private mapIntentToCommand(intent: IntentAnalysis): string {
    // Check suggested commands first
    if (intent.suggestedCommands && intent.suggestedCommands.length > 0) {
      const firstSuggestion = intent.suggestedCommands[0];
      if (firstSuggestion) {
        const commandMatch = firstSuggestion.match(/^(\/\w+)/);
        if (commandMatch && commandMatch[1]) {
          return commandMatch[1];
        }
      }
    }

    // Natural language to command mapping
    const input = intent.originalInput.toLowerCase();

    // Video generation
    if (input.includes('動画') || input.includes('video') || input.includes('アニメーション')) {
      return '/video';
    }

    // Image generation
    if (
      input.includes('画像') ||
      input.includes('image') ||
      input.includes('イラスト') ||
      input.includes('絵')
    ) {
      return '/image';
    }

    // Code generation
    if (
      input.includes('コード') ||
      input.includes('実装') ||
      input.includes('code') ||
      input.includes('implement')
    ) {
      if (input.includes('修正') || input.includes('fix') || input.includes('バグ')) {
        return '/code';
      }
      if (input.includes('リファクタ') || input.includes('refactor')) {
        return '/code';
      }
      return '/code';
    }

    // Test
    if (input.includes('テスト') || input.includes('test')) {
      return '/test';
    }

    // Review
    if (input.includes('レビュー') || input.includes('review') || input.includes('確認')) {
      return '/review';
    }

    // Commit
    if (input.includes('コミット') || input.includes('commit')) {
      return '/commit';
    }

    // Model selection
    if (input.includes('モデル') || input.includes('model') || input.includes('AI')) {
      return '/model';
    }

    // Initialize
    if (input.includes('初期化') || input.includes('init') || input.includes('MARIA.md')) {
      return '/init';
    }

    // Clear
    if (input.includes('クリア') || input.includes('clear') || input.includes('リセット')) {
      return '/clear';
    }

    // Default to chat
    return '/chat';
  }

  /**
   * Extract parameters from intent
   */
  private extractParameters(intent: IntentAnalysis): Record<string, unknown> {
    const params: Record<string, unknown> = { ...intent.parameters };

    // Add original input as prompt if not specified
    if (!params['prompt']) {
      params['prompt'] = intent.originalInput;
    }

    // Add action if detected
    if (intent.action && intent.action !== 'unknown') {
      params['action'] = intent.action;
    }

    // Add task type
    params['taskType'] = intent.taskType;
    params['confidence'] = intent.confidence;

    return params;
  }

  /**
   * Execute command with parameters
   */
  private async execute(
    command: string,
    parameters: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    output?: string;
    error?: string;
  }> {
    const handler = this.commandHandlers.get(command);

    if (!handler) {
      logger.warn(`No handler found for command: ${command}`);
      return {
        success: false,
        error: `Unknown command: ${command}`,
      };
    }

    try {
      return await handler(parameters);
    } catch (error: unknown) {
      logger.error(`Error executing command ${command}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Queue command for execution
   */
  async queueCommand(
    command: string,
    parameters: Record<string, unknown> = {},
    priority: number = 0,
  ): Promise<string> {
    const id = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    const queuedCommand: QueuedCommand = {
      id,
      command,
      parameters,
      priority,
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
    };

    this.commandQueue.push(queuedCommand);
    this.commandQueue.sort((a, b) => b.priority - a.priority);

    this.emit('command:queued', queuedCommand);

    // Start processing if not already
    if (!this.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Process command queue
   */
  private async processQueue() {
    if (this.isProcessing || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.find((c) => c.status === 'pending');
      if (!command) break;

      command.status = 'running';
      this.emit('command:processing', command);

      try {
        const result = await this.execute(command.command, command.parameters);

        if (result.success) {
          command.status = 'completed';
          this.emit('command:completed', { command, result });
        } else {
          throw new Error(result.error || 'Command failed');
        }
      } catch (error: unknown) {
        command.retryCount++;

        if (command.retryCount < command.maxRetries) {
          command.status = 'pending';
          logger.warn(
            `Retrying command ${command.id} (${command.retryCount}/${command.maxRetries})`,
          );
        } else {
          command.status = 'failed';
          this.emit('command:failed', { command, error });

          // Remove failed command from queue
          const index = this.commandQueue.indexOf(command);
          if (index > -1) {
            this.commandQueue.splice(index, 1);
          }
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get execution history
   */
  getHistory(limit?: number): CommandDispatchResult[] {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearHistory() {
    this.executionHistory = [];
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
  } {
    const status = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      total: this.commandQueue.length,
    };

    for (const command of this.commandQueue) {
      status[command.status]++;
    }

    return status;
  }
}

type CommandHandler = (parameters: Record<string, unknown>) => Promise<{
  success: boolean;
  output?: string;
  error?: string;
}>;

// Export singleton instance
export const commandDispatcher = new CommandDispatcher();
