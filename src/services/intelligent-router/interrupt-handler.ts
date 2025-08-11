/**
 * Interrupt Handler
 * AI処理中でも新しい指示を即座に受け付け、優先度に基づいて処理を切り替える
 */

import { EventEmitter } from 'events';
import chalk from 'chalk';
import { logger } from '../../utils/logger';

export interface InterruptEvent {
  id: string;
  timestamp: Date;
  input: string;
  priority: 'high' | 'normal' | 'low';
  type: 'override' | 'addition' | 'cancel';
}

export interface ProcessingTask {
  id: string;
  startTime: Date;
  status: 'running' | 'interrupted' | 'completed' | 'failed';
  command?: string;
  interruptible: boolean;
  cleanup?: () => Promise<void>;
}

export class InterruptHandler extends EventEmitter {
  private currentTask: ProcessingTask | null = null;
  private taskQueue: ProcessingTask[] = [];
  private interruptQueue: InterruptEvent[] = [];
  private isProcessing: boolean = false;
  private processingTimeout: NodeJS.Timeout | null = null;
  private contextBuffer: string[] = [];

  constructor() {
    super();
    this.setupSignalHandlers();
  }

  /**
   * シグナルハンドラーの設定
   */
  private setupSignalHandlers() {
    // Ctrl+C (SIGINT) のハンドリング
    process.on('SIGINT', async () => {
      if (this.isProcessing && this.currentTask) {
        console.log(chalk.yellow('\n⚠️  処理を中断しています...'));
        await this.interruptCurrentTask('user-cancel');
      } else {
        console.log(chalk.gray('\n終了します...'));
        process.exit(0);
      }
    });

    // プロセス終了時のクリーンアップ
    process.on('beforeExit', async () => {
      await this.cleanup();
    });
  }

  /**
   * タスクの開始
   */
  async startTask(
    id: string,
    command?: string,
    interruptible: boolean = true,
    cleanup?: () => Promise<void>
  ): Promise<void> {
    this.currentTask = {
      id,
      startTime: new Date(),
      status: 'running',
      command,
      interruptible,
      cleanup
    };

    this.isProcessing = true;
    this.emit('task:start', this.currentTask);

    // タイムアウトの設定（デフォルト30秒）
    this.processingTimeout = setTimeout(() => {
      if (this.currentTask?.id === id) {
        this.handleTimeout(id);
      }
    }, 30000);
  }

  /**
   * タスクの完了
   */
  async completeTask(id: string): Promise<void> {
    if (this.currentTask?.id === id) {
      this.currentTask.status = 'completed';
      this.isProcessing = false;
      
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
        this.processingTimeout = null;
      }

      this.emit('task:complete', this.currentTask);
      this.currentTask = null;

      // キューに次のタスクがあれば処理
      await this.processNextInQueue();
    }
  }

  /**
   * 新しい入力による割り込み
   */
  async handleInterrupt(input: string): Promise<InterruptEvent> {
    const interruptEvent: InterruptEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      input,
      priority: this.determinePriority(input),
      type: this.determineInterruptType(input)
    };

    // 現在処理中のタスクがある場合
    if (this.isProcessing && this.currentTask) {
      console.log(chalk.yellow('\n[Interrupted - Processing new request]'));
      
      if (interruptEvent.type === 'override') {
        console.log(chalk.gray('[Overriding previous request]'));
        await this.interruptCurrentTask('override');
      } else if (interruptEvent.type === 'addition') {
        console.log(chalk.gray('[Treating as additional information]'));
        this.contextBuffer.push(input);
      } else if (interruptEvent.type === 'cancel') {
        console.log(chalk.red('[Cancelling current task]'));
        await this.interruptCurrentTask('cancel');
        return interruptEvent;
      }
    }

    // 割り込みイベントをキューに追加
    if (interruptEvent.priority === 'high') {
      this.interruptQueue.unshift(interruptEvent);
    } else {
      this.interruptQueue.push(interruptEvent);
    }

    this.emit('interrupt', interruptEvent);
    return interruptEvent;
  }

  /**
   * 現在のタスクを中断
   */
  private async interruptCurrentTask(reason: string): Promise<void> {
    if (!this.currentTask || !this.currentTask.interruptible) {
      return;
    }

    const task = this.currentTask;
    task.status = 'interrupted';
    this.isProcessing = false;

    // タイムアウトをクリア
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }

    // クリーンアップ処理を実行
    if (task.cleanup) {
      try {
        await task.cleanup();
      } catch (error) {
        logger.error('Cleanup failed:', error);
      }
    }

    this.emit('task:interrupt', { task, reason });
    this.currentTask = null;
  }

  /**
   * 優先度の判定
   */
  private determinePriority(input: string): 'high' | 'normal' | 'low' {
    // 緊急キーワード
    const urgentKeywords = ['今すぐ', '緊急', 'urgent', 'immediately', 'now', 'stop', '止めて'];
    if (urgentKeywords.some(keyword => input.toLowerCase().includes(keyword))) {
      return 'high';
    }

    // 追加情報キーワード
    const additionalKeywords = ['また', 'さらに', 'あと', 'also', 'additionally', 'more'];
    if (additionalKeywords.some(keyword => input.toLowerCase().includes(keyword))) {
      return 'low';
    }

    return 'normal';
  }

  /**
   * 割り込みタイプの判定
   */
  private determineInterruptType(input: string): 'override' | 'addition' | 'cancel' {
    // キャンセルキーワード
    const cancelKeywords = ['キャンセル', 'cancel', '中止', 'stop', '止めて', 'やめて'];
    if (cancelKeywords.some(keyword => input.toLowerCase().includes(keyword))) {
      return 'cancel';
    }

    // 追加情報キーワード
    const additionalKeywords = [
      'また', 'さらに', 'それに', 'あと', '追加で',
      'also', 'additionally', 'furthermore', 'moreover', 'and'
    ];
    if (additionalKeywords.some(keyword => input.toLowerCase().includes(keyword))) {
      return 'addition';
    }

    // デフォルトは上書き
    return 'override';
  }

  /**
   * コンテキストバッファの取得と統合
   */
  getAndClearContextBuffer(): string {
    const combined = this.contextBuffer.join(' ');
    this.contextBuffer = [];
    return combined;
  }

  /**
   * タイムアウト処理
   */
  private handleTimeout(taskId: string) {
    if (this.currentTask?.id === taskId) {
      console.log(chalk.yellow('\n⏱️  タスクがタイムアウトしました'));
      this.interruptCurrentTask('timeout');
    }
  }

  /**
   * 次のキュータスクを処理
   */
  private async processNextInQueue(): Promise<void> {
    if (this.taskQueue.length > 0) {
      const nextTask = this.taskQueue.shift();
      if (nextTask) {
        await this.startTask(
          nextTask.id,
          nextTask.command,
          nextTask.interruptible,
          nextTask.cleanup
        );
      }
    } else if (this.interruptQueue.length > 0) {
      const nextInterrupt = this.interruptQueue.shift();
      if (nextInterrupt) {
        this.emit('process:interrupt', nextInterrupt);
      }
    }
  }

  /**
   * タスクをキューに追加
   */
  queueTask(task: Omit<ProcessingTask, 'startTime' | 'status'>): void {
    this.taskQueue.push({
      ...task,
      startTime: new Date(),
      status: 'running'
    });
  }

  /**
   * 処理状態の確認
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * 現在のタスク情報を取得
   */
  getCurrentTask(): ProcessingTask | null {
    return this.currentTask;
  }

  /**
   * キュー情報を取得
   */
  getQueueStatus() {
    return {
      currentTask: this.currentTask,
      taskQueue: this.taskQueue.length,
      interruptQueue: this.interruptQueue.length,
      isProcessing: this.isProcessing,
      contextBuffer: this.contextBuffer.length
    };
  }

  /**
   * IDの生成
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * クリーンアップ処理
   */
  private async cleanup(): Promise<void> {
    // 現在のタスクをクリーンアップ
    if (this.currentTask) {
      await this.interruptCurrentTask('cleanup');
    }

    // タイムアウトをクリア
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }

    // キューをクリア
    this.taskQueue = [];
    this.interruptQueue = [];
    this.contextBuffer = [];
  }

  /**
   * 優先度付きタスクの実行
   */
  async executePriorityTask(
    task: () => Promise<any>,
    options: {
      id?: string;
      command?: string;
      interruptible?: boolean;
      timeout?: number;
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): Promise<any> {
    const taskId = options.id || this.generateId();
    const priority = options.priority || 'normal';

    // 高優先度の場合は現在のタスクを中断
    if (priority === 'high' && this.isProcessing) {
      await this.interruptCurrentTask('high-priority');
    }

    try {
      await this.startTask(
        taskId,
        options.command,
        options.interruptible ?? true
      );

      // カスタムタイムアウトの設定
      if (options.timeout) {
        if (this.processingTimeout) {
          clearTimeout(this.processingTimeout);
        }
        this.processingTimeout = setTimeout(() => {
          this.handleTimeout(taskId);
        }, options.timeout);
      }

      const result = await task();
      await this.completeTask(taskId);
      return result;
    } catch (error) {
      if (this.currentTask?.id === taskId) {
        this.currentTask.status = 'failed';
        this.isProcessing = false;
        if (this.processingTimeout) {
          clearTimeout(this.processingTimeout);
          this.processingTimeout = null;
        }
      }
      throw error;
    }
  }
}