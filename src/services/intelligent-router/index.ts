/**
 * Intelligent Router Module
 * 自然言語からコマンドへの自動変換とリアルタイム処理を提供
 */

export { IntentClassifier, type InferredCommand, type CommandPattern } from './intent-classifier';
export { CommandDispatcher, type CommandResult, type DispatcherOptions } from './command-dispatcher';
export { ContextManager, type ConversationContext, type UserProfile, type Message } from './context-manager';
export { InterruptHandler, type InterruptEvent, type ProcessingTask } from './interrupt-handler';
export { PriorityQueue, type QueuedTask, type QueueStatistics } from './priority-queue';
export { StreamProcessor, type StreamChunk, type StreamProgress } from './stream-processor';

// 統合されたインテリジェントルーターシステム
import { IntentClassifier } from './intent-classifier';
import { CommandDispatcher } from './command-dispatcher';
import { ContextManager } from './context-manager';
import { InterruptHandler } from './interrupt-handler';
import { PriorityQueue } from './priority-queue';
import { StreamProcessor } from './stream-processor';
import { SlashCommandHandler } from '../slash-command-handler';

export interface IntelligentRouterConfig {
  maxConcurrentTasks?: number;
  confirmThreshold?: number;
  autoExecute?: boolean;
  verbose?: boolean;
  streamingEnabled?: boolean;
  backpressureThreshold?: number;
}

export class IntelligentRouter {
  private dispatcher: CommandDispatcher;
  private interruptHandler: InterruptHandler;
  private priorityQueue: PriorityQueue;
  private streamProcessor: StreamProcessor;
  private contextManager: ContextManager;

  constructor(
    slashCommandHandler: SlashCommandHandler,
    config: IntelligentRouterConfig = {}
  ) {
    // コンポーネントの初期化
    this.contextManager = new ContextManager();
    this.dispatcher = new CommandDispatcher(slashCommandHandler, {
      verbose: config.verbose,
      autoExecute: config.autoExecute,
      confirmThreshold: config.confirmThreshold
    });
    this.interruptHandler = new InterruptHandler();
    this.priorityQueue = new PriorityQueue(config.maxConcurrentTasks);
    this.streamProcessor = new StreamProcessor(config.backpressureThreshold);

    // イベントリスナーの設定
    this.setupEventListeners();
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners() {
    // 割り込みイベントの処理
    this.interruptHandler.on('interrupt', async (event) => {
      await this.handleInterruptEvent(event);
    });

    // タスク完了イベント
    this.priorityQueue.on('task:completed', (task) => {
      this.contextManager.updateLastCommand(task.params as any);
    });

    // ストリーミングチャンク
    this.streamProcessor.on('chunk', (chunk) => {
      // チャンクをコンテキストに記録
      if (chunk.type === 'error') {
        this.contextManager.updateErrorState(true, [chunk.content]);
      }
    });
  }

  /**
   * 自然言語入力を処理
   */
  async processInput(input: string): Promise<any> {
    // 現在処理中の場合は割り込み処理
    if (this.interruptHandler.isCurrentlyProcessing()) {
      const interruptEvent = await this.interruptHandler.handleInterrupt(input);
      
      if (interruptEvent.type === 'cancel') {
        return { cancelled: true };
      }
      
      if (interruptEvent.type === 'addition') {
        // 追加情報として既存のコンテキストにマージ
        const mergedInput = await this.contextManager.mergeWithLastCommand(input);
        input = mergedInput;
      }
    }

    // コンテキストにユーザーメッセージを追加
    this.contextManager.addUserMessage(input);

    // 会話の継続性チェック
    const continuation = await this.dispatcher.processContinuation(input);
    if (continuation) {
      return continuation;
    }

    // タスクをキューに追加
    const taskId = this.priorityQueue.enqueue({
      priority: 5, // デフォルト優先度
      command: 'process-input',
      params: { input },
      maxRetries: 1,
      execute: async () => {
        // ストリーミングが有効な場合
        if (this.streamProcessor.isCurrentlyStreaming()) {
          return await this.processWithStreaming(input);
        }
        
        // 通常のディスパッチ処理
        return await this.dispatcher.dispatch(input);
      }
    });

    // タスクの実行結果を待つ
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const task = this.priorityQueue.getTaskStatus(taskId);
        if (task) {
          if (task.status === 'completed') {
            clearInterval(checkInterval);
            resolve(task.result);
          } else if (task.status === 'failed') {
            clearInterval(checkInterval);
            reject(task.error);
          }
        }
      }, 100);
    });
  }

  /**
   * ストリーミング処理
   */
  private async processWithStreaming(input: string): Promise<any> {
    // ストリーミングジェネレーターを作成
    const generator = this.createResponseGenerator(input);
    
    // ストリーミング処理を開始
    await this.streamProcessor.startStreaming(generator, {
      chunkSize: 100,
      progressCallback: (progress) => {
        // プログレス更新
        console.log(`\rProcessing: ${progress.percentage.toFixed(1)}%`);
      }
    });

    // 最終結果を返す
    return {
      success: true,
      output: this.streamProcessor.getPartialResult(),
      chunks: this.streamProcessor.getChunks()
    };
  }

  /**
   * レスポンスジェネレーターを作成
   */
  private async *createResponseGenerator(input: string): AsyncGenerator<string> {
    // ディスパッチ処理をチャンクに分割
    const result = await this.dispatcher.dispatch(input);
    
    if (result.output) {
      // 出力を小さなチャンクに分割
      const chunks = result.output.match(/.{1,50}/g) || [];
      for (const chunk of chunks) {
        yield chunk;
        // 少し遅延を入れてストリーミング効果を演出
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * 割り込みイベントを処理
   */
  private async handleInterruptEvent(event: any) {
    // 高優先度タスクとして実行
    await this.priorityQueue.executeImmediate({
      command: 'interrupt',
      params: { event },
      maxRetries: 1,
      execute: async () => {
        return await this.dispatcher.dispatch(event.input);
      }
    });
  }

  /**
   * 高優先度コマンドを実行
   */
  async executeHighPriority(command: string, params: Record<string, any> = {}): Promise<any> {
    return await this.interruptHandler.executePriorityTask(
      async () => {
        // 直接スラッシュコマンドを実行
        const result = await this.dispatcher.dispatch(`/${command} ${JSON.stringify(params)}`);
        return result;
      },
      {
        command,
        priority: 'high',
        interruptible: false,
        timeout: 30000
      }
    );
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    return {
      dispatcher: this.dispatcher.getStatistics(),
      queue: this.priorityQueue.getQueueStatus(),
      stream: this.streamProcessor.getStatistics(),
      interrupt: this.interruptHandler.getQueueStatus()
    };
  }

  /**
   * システムをシャットダウン
   */
  async shutdown() {
    this.priorityQueue.stop();
    this.streamProcessor.abort();
    this.contextManager.clearSession();
  }
}