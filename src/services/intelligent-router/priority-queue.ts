/**
 * Priority Queue System
 * タスクの優先度管理と並列実行制御
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

export interface QueuedTask {
  id: string;
  priority: number; // 0-10, 10が最高優先度
  command: string;
  params: Record<string, any>;
  createdAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  timeout?: number;
  dependencies?: string[]; // 他のタスクIDへの依存
  result?: any;
  error?: Error;
  execute: () => Promise<any>;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
}

export interface QueueStatistics {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageWaitTime: number;
  averageExecutionTime: number;
}

export class PriorityQueue extends EventEmitter {
  private queue: QueuedTask[] = [];
  private runningTasks: Map<string, QueuedTask> = new Map();
  private completedTasks: Map<string, QueuedTask> = new Map();
  private maxConcurrent: number;
  private isProcessing: boolean = false;
  private statistics: QueueStatistics;
  private taskExecutionTimes: Map<string, number> = new Map();
  private taskWaitTimes: Map<string, number> = new Map();

  constructor(maxConcurrent: number = 3) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.statistics = this.initializeStatistics();
    this.startProcessing();
  }

  /**
   * タスクをキューに追加
   */
  enqueue(task: Omit<QueuedTask, 'id' | 'createdAt' | 'status' | 'retryCount'>): string {
    const taskId = this.generateTaskId();
    const queuedTask: QueuedTask = {
      ...task,
      id: taskId,
      createdAt: new Date(),
      status: 'pending',
      retryCount: 0,
      maxRetries: task.maxRetries || 3
    };

    // 優先度順に挿入
    const insertIndex = this.findInsertIndex(queuedTask.priority);
    this.queue.splice(insertIndex, 0, queuedTask);

    this.statistics.totalTasks++;
    this.statistics.pendingTasks++;
    
    this.emit('task:enqueued', queuedTask);
    this.processNext();

    return taskId;
  }

  /**
   * 高優先度タスクを即座に実行
   */
  async executeImmediate(
    task: Omit<QueuedTask, 'id' | 'createdAt' | 'status' | 'retryCount' | 'priority'>
  ): Promise<any> {
    const taskId = this.enqueue({
      ...task,
      priority: 10, // 最高優先度
      maxRetries: 1
    });

    // 現在実行中のタスクが最大数に達している場合、低優先度タスクを一時停止
    if (this.runningTasks.size >= this.maxConcurrent) {
      await this.pauseLowPriorityTask();
    }

    return this.waitForTask(taskId);
  }

  /**
   * タスクの完了を待機
   */
  private waitForTask(taskId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const task = this.completedTasks.get(taskId) || 
                    Array.from(this.runningTasks.values()).find(t => t.id === taskId);
        
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

      // タイムアウト設定
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Task execution timeout'));
      }, 60000); // 60秒のタイムアウト
    });
  }

  /**
   * 低優先度タスクを一時停止
   */
  private async pauseLowPriorityTask(): Promise<void> {
    let lowestPriorityTask: QueuedTask | null = null;
    let lowestPriority = 11;

    this.runningTasks.forEach(task => {
      if (task.priority < lowestPriority) {
        lowestPriority = task.priority;
        lowestPriorityTask = task;
      }
    });

    if (lowestPriorityTask) {
      // タスクを一時的にキューに戻す
      this.runningTasks.delete(lowestPriorityTask.id);
      lowestPriorityTask.status = 'pending';
      this.queue.unshift(lowestPriorityTask);
      this.emit('task:paused', lowestPriorityTask);
    }
  }

  /**
   * 挿入位置を見つける
   */
  private findInsertIndex(priority: number): number {
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < priority) {
        return i;
      }
    }
    return this.queue.length;
  }

  /**
   * 処理を開始
   */
  private startProcessing() {
    if (!this.isProcessing) {
      this.isProcessing = true;
      this.processLoop();
    }
  }

  /**
   * 処理ループ
   */
  private async processLoop() {
    while (this.isProcessing) {
      await this.processNext();
      await this.delay(100); // 100msごとにチェック
    }
  }

  /**
   * 次のタスクを処理
   */
  private async processNext() {
    // 同時実行数の制限チェック
    if (this.runningTasks.size >= this.maxConcurrent) {
      return;
    }

    // 実行可能なタスクを探す
    const executableTask = this.findExecutableTask();
    if (!executableTask) {
      return;
    }

    // キューから削除して実行中に移動
    const index = this.queue.indexOf(executableTask);
    if (index > -1) {
      this.queue.splice(index, 1);
    }

    executableTask.status = 'running';
    this.runningTasks.set(executableTask.id, executableTask);
    this.statistics.pendingTasks--;
    this.statistics.runningTasks++;

    // 待機時間を記録
    const waitTime = Date.now() - executableTask.createdAt.getTime();
    this.taskWaitTimes.set(executableTask.id, waitTime);

    this.emit('task:started', executableTask);

    // タスクを実行
    try {
      const startTime = Date.now();
      const result = await this.executeTask(executableTask);
      const executionTime = Date.now() - startTime;
      
      this.taskExecutionTimes.set(executableTask.id, executionTime);
      executableTask.result = result;
      executableTask.status = 'completed';
      
      this.handleTaskCompletion(executableTask);
      
      if (executableTask.onComplete) {
        executableTask.onComplete(result);
      }
    } catch (error) {
      await this.handleTaskError(executableTask, error as Error);
    }
  }

  /**
   * 実行可能なタスクを探す
   */
  private findExecutableTask(): QueuedTask | null {
    for (const task of this.queue) {
      // 依存関係チェック
      if (task.dependencies && task.dependencies.length > 0) {
        const allDependenciesCompleted = task.dependencies.every(depId => {
          const dep = this.completedTasks.get(depId);
          return dep && dep.status === 'completed';
        });
        
        if (!allDependenciesCompleted) {
          continue;
        }
      }

      return task;
    }
    return null;
  }

  /**
   * タスクを実行
   */
  private async executeTask(task: QueuedTask): Promise<any> {
    // タイムアウト設定
    if (task.timeout) {
      return Promise.race([
        task.execute(),
        this.createTimeout(task.timeout)
      ]);
    }
    
    return task.execute();
  }

  /**
   * タイムアウトを作成
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Task execution timeout')), ms);
    });
  }

  /**
   * タスク完了処理
   */
  private handleTaskCompletion(task: QueuedTask) {
    this.runningTasks.delete(task.id);
    this.completedTasks.set(task.id, task);
    this.statistics.runningTasks--;
    this.statistics.completedTasks++;
    
    this.updateStatistics();
    this.emit('task:completed', task);
    
    // 古い完了タスクをクリーンアップ（最大100件保持）
    if (this.completedTasks.size > 100) {
      const oldestTask = Array.from(this.completedTasks.values())
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      this.completedTasks.delete(oldestTask.id);
    }
  }

  /**
   * タスクエラー処理
   */
  private async handleTaskError(task: QueuedTask, error: Error) {
    task.error = error;
    task.retryCount++;

    if (task.retryCount < task.maxRetries) {
      // リトライ
      logger.warn(`Task ${task.id} failed, retrying (${task.retryCount}/${task.maxRetries})`);
      task.status = 'pending';
      
      // 優先度を少し下げてキューに戻す
      task.priority = Math.max(0, task.priority - 1);
      const insertIndex = this.findInsertIndex(task.priority);
      this.queue.splice(insertIndex, 0, task);
      
      this.runningTasks.delete(task.id);
      this.statistics.runningTasks--;
      this.statistics.pendingTasks++;
      
      this.emit('task:retry', task);
    } else {
      // 最大リトライ回数に達した
      task.status = 'failed';
      this.runningTasks.delete(task.id);
      this.completedTasks.set(task.id, task);
      this.statistics.runningTasks--;
      this.statistics.failedTasks++;
      
      this.emit('task:failed', task);
      
      if (task.onError) {
        task.onError(error);
      }
    }
  }

  /**
   * 統計情報を更新
   */
  private updateStatistics() {
    // 平均待機時間
    const waitTimes = Array.from(this.taskWaitTimes.values());
    if (waitTimes.length > 0) {
      this.statistics.averageWaitTime = 
        waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
    }

    // 平均実行時間
    const execTimes = Array.from(this.taskExecutionTimes.values());
    if (execTimes.length > 0) {
      this.statistics.averageExecutionTime = 
        execTimes.reduce((a, b) => a + b, 0) / execTimes.length;
    }
  }

  /**
   * タスクをキャンセル
   */
  cancelTask(taskId: string): boolean {
    // キュー内のタスクをキャンセル
    const queueIndex = this.queue.findIndex(t => t.id === taskId);
    if (queueIndex > -1) {
      const task = this.queue[queueIndex];
      task.status = 'cancelled';
      this.queue.splice(queueIndex, 1);
      this.statistics.pendingTasks--;
      this.emit('task:cancelled', task);
      return true;
    }

    // 実行中のタスクはキャンセルできない（将来的に実装可能）
    if (this.runningTasks.has(taskId)) {
      logger.warn(`Cannot cancel running task: ${taskId}`);
      return false;
    }

    return false;
  }

  /**
   * 全タスクをクリア
   */
  clearAll() {
    // ペンディングタスクをクリア
    this.queue.forEach(task => {
      task.status = 'cancelled';
      this.emit('task:cancelled', task);
    });
    this.queue = [];
    
    // 実行中のタスクは完了を待つ
    logger.info(`Cleared ${this.queue.length} pending tasks`);
  }

  /**
   * キューの状態を取得
   */
  getQueueStatus(): {
    queue: QueuedTask[];
    running: QueuedTask[];
    statistics: QueueStatistics;
  } {
    return {
      queue: [...this.queue],
      running: Array.from(this.runningTasks.values()),
      statistics: { ...this.statistics }
    };
  }

  /**
   * タスクの状態を取得
   */
  getTaskStatus(taskId: string): QueuedTask | undefined {
    return this.queue.find(t => t.id === taskId) ||
           this.runningTasks.get(taskId) ||
           this.completedTasks.get(taskId);
  }

  /**
   * 優先度を変更
   */
  changePriority(taskId: string, newPriority: number): boolean {
    const taskIndex = this.queue.findIndex(t => t.id === taskId);
    if (taskIndex > -1) {
      const task = this.queue[taskIndex];
      this.queue.splice(taskIndex, 1);
      task.priority = newPriority;
      const newIndex = this.findInsertIndex(newPriority);
      this.queue.splice(newIndex, 0, task);
      this.emit('task:priority-changed', task);
      return true;
    }
    return false;
  }

  /**
   * 統計情報を初期化
   */
  private initializeStatistics(): QueueStatistics {
    return {
      totalTasks: 0,
      pendingTasks: 0,
      runningTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageWaitTime: 0,
      averageExecutionTime: 0
    };
  }

  /**
   * タスクIDを生成
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 遅延を作成
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 処理を停止
   */
  stop() {
    this.isProcessing = false;
  }

  /**
   * デッドロック検出
   */
  detectDeadlock(): string[] {
    const deadlockedTasks: string[] = [];
    
    this.queue.forEach(task => {
      if (task.dependencies) {
        // 循環依存をチェック
        const visited = new Set<string>();
        const stack = new Set<string>();
        
        if (this.hasCycle(task.id, visited, stack)) {
          deadlockedTasks.push(task.id);
        }
      }
    });

    return deadlockedTasks;
  }

  /**
   * 循環依存チェック
   */
  private hasCycle(taskId: string, visited: Set<string>, stack: Set<string>): boolean {
    visited.add(taskId);
    stack.add(taskId);

    const task = this.getTaskStatus(taskId);
    if (task?.dependencies) {
      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          if (this.hasCycle(depId, visited, stack)) {
            return true;
          }
        } else if (stack.has(depId)) {
          return true;
        }
      }
    }

    stack.delete(taskId);
    return false;
  }
}