/**
 * ProgressTracker Component
 * プログレストラッキングシステム - 詳細進捗管理
 */

import chalk from 'chalk';
import { Task, TaskStatus } from './ActiveReporter.js';
import { InternalMode } from './ModeIndicator.js';

/**
 * 進捗イベント
 */
export interface ProgressEvent {
  taskId: string;
  type: 'start' | 'progress' | 'complete' | 'error' | 'pause' | 'resume';
  progress?: number;
  message?: string;
  timestamp: Date;
  mode?: InternalMode;
}

/**
 * サブタスク定義
 */
export interface SubTask {
  id: string;
  title: string;
  status: TaskStatus;
  progress: number;
  weight: number; // 親タスクでの重み (0-1)
  estimatedTime?: number;
  dependencies?: string[];
}

/**
 * 拡張タスク定義
 */
export interface ExtendedTask extends Task {
  subTasks: SubTask[];
  totalWeight: number;
  lastUpdate: Date;
  events: ProgressEvent[];
  velocity?: number; // tasks per minute
  blockers?: string[];
}

/**
 * 進捗統計
 */
export interface ProgressStats {
  tasksTotal: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksPending: number;
  tasksBlocked: number;
  overallProgress: number;
  velocity: number;
  eta: Date | null;
  timeSpent: number;
  timeRemaining: number;
}

/**
 * 可視化設定
 */
export interface VisualizationConfig {
  showVelocity: boolean;
  showETA: boolean;
  showSubTasks: boolean;
  showDependencies: boolean;
  showBlockers: boolean;
  animateProgress: boolean;
  progressBarWidth: number;
  updateInterval: number;
}

/**
 * ProgressTrackerクラス
 */
export class ProgressTracker {
  private tasks: Map<string, ExtendedTask> = new Map();
  private config: VisualizationConfig;
  private startTime: Date = new Date();
  private eventListeners: Map<string, Array<(event: ProgressEvent) => void>> = new Map();
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<VisualizationConfig> = {}) {
    this.config = {
      showVelocity: true,
      showETA: true,
      showSubTasks: true,
      showDependencies: false,
      showBlockers: true,
      animateProgress: false,
      progressBarWidth: 30,
      updateInterval: 1000,
      ...config,
    };
  }

  /**
   * タスクを追加
   */
  addTask(task: Task, subTasks: SubTask[] = []): void {
    const extendedTask: ExtendedTask = {
      ...task,
      subTasks,
      totalWeight: subTasks.reduce((sum, st) => sum + st.weight, 1),
      lastUpdate: new Date(),
      events: [],
      velocity: 0,
    };

    this.tasks.set(task.id, extendedTask);
    this.emitEvent(task.id, 'start', 0, 'Task added');
  }

  /**
   * サブタスクを追加
   */
  addSubTask(taskId: string, subTask: SubTask): void {
    const task = this.tasks.get(taskId);
    if (!task) {return;}

    task.subTasks.push(subTask);
    task.totalWeight += subTask.weight;
    task.lastUpdate = new Date();

    this.updateTaskProgress(taskId);
  }

  /**
   * タスク進捗を更新
   */
  updateProgress(taskId: string, progress: number, message?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {return;}

    const oldProgress = task.progress || 0;
    task.progress = Math.max(0, Math.min(100, progress));
    task.lastUpdate = new Date();

    this.calculateVelocity(task, oldProgress);
    this.emitEvent(taskId, 'progress', progress, message);
  }

  /**
   * サブタスク進捗を更新
   */
  updateSubTaskProgress(taskId: string, subTaskId: string, progress: number): void {
    const task = this.tasks.get(taskId);
    if (!task) {return;}

    const subTask = task.subTasks.find((st) => st.id === subTaskId);
    if (!subTask) {return;}

    subTask.progress = Math.max(0, Math.min(100, progress));
    if (progress >= 100) {
      subTask.status = 'completed';
    } else if (progress > 0) {
      subTask.status = 'in_progress';
    }

    this.updateTaskProgress(taskId);
  }

  /**
   * タスクの全体進捗を計算
   */
  private updateTaskProgress(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {return;}

    if (task.subTasks.length === 0) {return;}

    // 重み付き平均で進捗を計算
    const weightedProgress = task.subTasks.reduce((sum, subTask) => {
      return sum + subTask.progress * subTask.weight;
    }, 0);

    const totalProgress = weightedProgress / task.totalWeight;
    this.updateProgress(taskId, totalProgress);
  }

  /**
   * タスクを完了
   */
  completeTask(taskId: string, message?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {return;}

    task.status = 'completed';
    task.progress = 100;
    task.endTime = new Date();
    task.lastUpdate = new Date();

    // すべてのサブタスクを完了に
    task.subTasks.forEach((subTask) => {
      subTask.status = 'completed';
      subTask.progress = 100;
    });

    this.emitEvent(taskId, 'complete', 100, message || 'Task completed');
  }

  /**
   * タスクでエラー発生
   */
  errorTask(taskId: string, message: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {return;}

    task.status = 'error';
    task.error = message;
    task.endTime = new Date();
    task.lastUpdate = new Date();

    this.emitEvent(taskId, 'error', task.progress, message);
  }

  /**
   * ブロッカーを追加
   */
  addBlocker(taskId: string, blocker: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {return;}

    if (!task.blockers) {task.blockers = [];}
    task.blockers.push(blocker);
    task.lastUpdate = new Date();
  }

  /**
   * ブロッカーを削除
   */
  removeBlocker(taskId: string, blocker: string): void {
    const task = this.tasks.get(taskId);
    if (!task || !task.blockers) {return;}

    const index = task.blockers.indexOf(blocker);
    if (index > -1) {
      task.blockers.splice(index, 1);
      task.lastUpdate = new Date();
    }
  }

  /**
   * 全体統計を計算
   */
  calculateStats(): ProgressStats {
    const tasks = Array.from(this.tasks.values());
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
    const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
    const blockedTasks = tasks.filter((t) => t.blockers && t.blockers.length > 0).length;

    const overallProgress =
      totalTasks > 0 ? tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks : 0;

    const velocity = this.calculateOverallVelocity();
    const timeSpent = Date.now() - this.startTime.getTime();
    const timeRemaining = velocity > 0 ? ((100 - overallProgress) / velocity) * 60 * 1000 : 0;
    const eta = velocity > 0 ? new Date(Date.now() + timeRemaining) : null;

    return {
      tasksTotal: totalTasks,
      tasksCompleted: completedTasks,
      tasksInProgress: inProgressTasks,
      tasksPending: pendingTasks,
      tasksBlocked: blockedTasks,
      overallProgress: Math.round(overallProgress),
      velocity,
      eta,
      timeSpent,
      timeRemaining,
    };
  }

  /**
   * 進捗を可視化
   */
  render(): string {
    const stats = this.calculateStats();
    const output: string[] = [];

    // ヘッダー
    output.push(chalk.cyan.bold('📊 Progress Tracker'));
    output.push(chalk.gray('═'.repeat(60)));

    // 全体統計
    output.push(chalk.yellow('📈 Overall Statistics:'));
    output.push(`  Total Tasks: ${stats.tasksTotal}`);
    output.push(
      `  Completed: ${chalk.green(stats.tasksCompleted)} (${Math.round((stats.tasksCompleted / stats.tasksTotal) * 100)}%)`,
    );
    output.push(`  In Progress: ${chalk.yellow(stats.tasksInProgress)}`);
    output.push(`  Pending: ${chalk.gray(stats.tasksPending)}`);

    if (stats.tasksBlocked > 0) {
      output.push(`  Blocked: ${chalk.red(stats.tasksBlocked)}`);
    }

    // 全体進捗バー
    output.push('');
    output.push(
      this.renderProgressBar(
        stats.overallProgress,
        this.config.progressBarWidth,
        'Overall Progress',
      ),
    );

    // 速度とETA
    if (this.config.showVelocity) {
      output.push('');
      output.push(chalk.yellow('⚡ Performance:'));
      output.push(`  Velocity: ${stats.velocity.toFixed(2)} points/min`);

      if (this.config.showETA && stats.eta) {
        output.push(`  ETA: ${stats.eta.toLocaleString()}`);
        output.push(`  Time Remaining: ${this.formatDuration(stats.timeRemaining)}`);
      }

      output.push(`  Time Spent: ${this.formatDuration(stats.timeSpent)}`);
    }

    // アクティブタスク
    const activeTasks = Array.from(this.tasks.values())
      .filter((t) => t.status === 'in_progress')
      .sort((a, b) => b.lastUpdate.getTime() - a.lastUpdate.getTime());

    if (activeTasks.length > 0) {
      output.push('');
      output.push(chalk.yellow('🔄 Active Tasks:'));

      activeTasks.forEach((task) => {
        output.push(this.renderTaskDetails(task));

        if (this.config.showSubTasks && task.subTasks.length > 0) {
          task.subTasks.forEach((subTask) => {
            output.push(this.renderSubTask(subTask, '    '));
          });
        }
      });
    }

    // ブロックされたタスク
    if (this.config.showBlockers) {
      const blockedTasks = Array.from(this.tasks.values()).filter(
        (t) => t.blockers && t.blockers.length > 0,
      );

      if (blockedTasks.length > 0) {
        output.push('');
        output.push(chalk.red('🚫 Blocked Tasks:'));

        blockedTasks.forEach((task) => {
          output.push(this.renderTaskDetails(task));
          task.blockers!.forEach((blocker) => {
            output.push(`    ${chalk.red('▶')} ${blocker}`);
          });
        });
      }
    }

    // 最近の活動
    output.push('');
    output.push(chalk.yellow('📝 Recent Activity:'));
    const recentEvents = this.getRecentEvents(5);
    recentEvents.forEach((event) => {
      output.push(this.renderEvent(event));
    });

    output.push(chalk.gray('═'.repeat(60)));

    return output.join('\n');
  }

  /**
   * タスク詳細をレンダリング
   */
  private renderTaskDetails(task: ExtendedTask): string {
    const statusIcon = this.getStatusIcon(task.status);
    const statusColor = this.getStatusColor(task.status);
    const progressBar = this.renderProgressBar(task.progress || 0, 20);

    let line = `  ${statusColor(statusIcon)} ${task.title}`;

    if (task.mode) {
      line += ` ${chalk.dim(`[${task.mode}]`)}`;
    }

    line += `\n    ${progressBar}`;

    if (task.velocity && this.config.showVelocity) {
      line += ` ${chalk.gray(`(${task.velocity.toFixed(1)} pts/min)`)}`;
    }

    return line;
  }

  /**
   * サブタスクをレンダリング
   */
  private renderSubTask(subTask: SubTask, indent: string): string {
    const statusIcon = this.getStatusIcon(subTask.status);
    const statusColor = this.getStatusColor(subTask.status);
    const progressBar = this.renderProgressBar(subTask.progress, 15);

    return `${indent}${statusColor(statusIcon)} ${subTask.title} ${progressBar}`;
  }

  /**
   * プログレスバーをレンダリング
   */
  private renderProgressBar(progress: number, width: number, label?: string): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percentage = `${progress.toFixed(1)}%`;

    if (label) {
      return `${label}: [${bar}] ${percentage}`;
    }

    return `[${bar}] ${percentage}`;
  }

  /**
   * イベントをレンダリング
   */
  private renderEvent(event: ProgressEvent): string {
    const time = event.timestamp.toLocaleTimeString();
    const typeColor =
      event.type === 'error' ? chalk.red : event.type === 'complete' ? chalk.green : chalk.yellow;

    let line = `  ${chalk.gray(time)} ${typeColor(event.type.toUpperCase())}`;

    const task = this.tasks.get(event.taskId);
    if (task) {
      line += ` ${task.title}`;
    }

    if (event.message) {
      line += ` - ${event.message}`;
    }

    if (event.progress !== undefined) {
      line += ` (${event.progress.toFixed(1)}%)`;
    }

    return line;
  }

  /**
   * 速度を計算
   */
  private calculateVelocity(task: ExtendedTask, oldProgress: number): void {
    const progressDelta = (task.progress || 0) - oldProgress;
    const timeDelta = (Date.now() - task.lastUpdate.getTime()) / (1000 * 60); // minutes

    if (timeDelta > 0) {
      task.velocity = progressDelta / timeDelta;
    }
  }

  /**
   * 全体速度を計算
   */
  private calculateOverallVelocity(): number {
    const activeTasks = Array.from(this.tasks.values()).filter(
      (t) => t.status === 'in_progress' && t.velocity,
    );

    if (activeTasks.length === 0) {return 0;}

    return activeTasks.reduce((sum, t) => sum + (t.velocity || 0), 0) / activeTasks.length;
  }

  /**
   * 最近のイベントを取得
   */
  private getRecentEvents(count: number): ProgressEvent[] {
    const allEvents: ProgressEvent[] = [];

    this.tasks.forEach((task) => {
      allEvents.push(...task.events);
    });

    return allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, count);
  }

  /**
   * イベントを発行
   */
  private emitEvent(
    taskId: string,
    type: ProgressEvent['type'],
    progress?: number,
    message?: string,
  ): void {
    const event: ProgressEvent = {
      taskId,
      type,
      progress,
      message,
      timestamp: new Date(),
      mode: this.tasks.get(taskId)?.mode,
    };

    const task = this.tasks.get(taskId);
    if (task) {
      task.events.push(event);

      // イベント履歴を制限
      if (task.events.length > 50) {
        task.events = task.events.slice(-50);
      }
    }

    // リスナーに通知
    const listeners = this.eventListeners.get(type) || [];
    listeners.forEach((listener) => listener(event));
  }

  /**
   * イベントリスナーを追加
   */
  addEventListener(type: ProgressEvent['type'], listener: (event: ProgressEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  /**
   * イベントリスナーを削除
   */
  removeEventListener(type: ProgressEvent['type'], listener: (event: ProgressEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * ユーティリティメソッド
   */
  private getStatusIcon(status: TaskStatus): string {
    const icons: Record<TaskStatus, string> = {
      pending: '○',
      in_progress: '◉',
      completed: '✓',
      error: '✗',
      skipped: '⊘',
    };
    return icons[status];
  }

  private getStatusColor(status: TaskStatus): typeof chalk {
    const colors: Record<TaskStatus, typeof chalk> = {
      pending: chalk.gray,
      in_progress: chalk.yellow,
      completed: chalk.green,
      error: chalk.red,
      skipped: chalk.blue,
    };
    return colors[status];
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<VisualizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * リセット
   */
  reset(): void {
    this.tasks.clear();
    this.eventListeners.clear();
    this.startTime = new Date();

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * タスク取得
   */
  getTask(taskId: string): ExtendedTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 全タスク取得
   */
  getAllTasks(): ExtendedTask[] {
    return Array.from(this.tasks.values());
  }
}

export default ProgressTracker;
