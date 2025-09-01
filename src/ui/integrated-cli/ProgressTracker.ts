/**
 * ProgressTracker Component
 * プログレストラッキングシステム - 詳細進捗管理
 */

import chalk from "chalk";
import { Task, TaskStatus } from "./ActiveReporter.js";
import { InternalMode } from "./ModeIndicator.js";

/**
 * 進捗イベント
 */
export interface ProgressEvent {
  taskId: string;
  type: "start" | "progress" | "complete" | "error" | "pause" | "resume";
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
  _velocity?: number; // _tasks per minute
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
  _overallProgress: number;
  _velocity: number;
  _eta: Date | null;
  _timeSpent: number;
  _timeRemaining: number;
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
  private _tasks: Map<string, ExtendedTask> = new Map();
  private config: VisualizationConfig;
  private startTime: Date = new Date();
  private eventListeners: Map<string, Array<(event: ProgressEvent) => void>> =
    new Map();
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(_config: Partial<VisualizationConfig> = {}) {
    this._config = {
      showVelocity: true,
      showETA: true,
      showSubTasks: true,
      showDependencies: false,
      showBlockers: true,
      animateProgress: false,
      progressBarWidth: 30,
      updateInterval: 1000,
      ..._config,
    };
  }

  /**
   * タスクを追加
   */
  addTask(_task: Task, subTasks: SubTask[] = []): void {
    const extendedTask: ExtendedTask = {
      ..._task,
      subTasks,
      totalWeight: subTasks.reduce((sum, st) => sum + st.weight, 1),
      lastUpdate: new Date(),
      events: [],
      _velocity: 0,
    };

    this.tasks.set(_task.id, extendedTask);
    this.emitEvent(_task.id, "start", 0, "Task added");
  }

  /**
   * サブタスクを追加
   */
  addSubTask(_taskId: string, _subTask: SubTask): void {
    const _task = this.tasks.get(_taskId);
    if (!_task) {
      return;
    }

    _task.subTasks.push(_subTask);
    _task.totalWeight += subTask.weight;
    task.lastUpdate = new Date();

    this.updateTaskProgress(_taskId);
  }

  /**
   * タスク進捗を更新
   */
  updateProgress(_taskId: string, progress: number, message?: string): void {
    const _task = this.tasks.get(_taskId);
    if (!_task) {
      return;
    }

    const _oldProgress = _task.progress || 0;
    _task.progress = Math.max(0, Math.min(100, progress));
    task.lastUpdate = new Date();

    this.calculateVelocity(_task, _oldProgress);
    this.emitEvent(_taskId, "progress", progress, message);
  }

  /**
   * サブタスク進捗を更新
   */
  updateSubTaskProgress(
    _taskId: string,
    subTaskId: string,
    progress: number,
  ): void {
    const _task = this.tasks.get(_taskId);
    if (!_task) {
      return;
    }

    const _subTask = _task.subTasks.find((st) => st.id === subTaskId);
    if (!_subTask) {
      return;
    }

    subTask.progress = Math.max(0, Math.min(100, progress));
    if (progress >= 100) {
      subTask.status = "completed";
    } else if (progress > 0) {
      subTask.status = "in_progress";
    }

    this.updateTaskProgress(_taskId);
  }

  /**
   * タスクの全体進捗を計算
   */
  private updateTaskProgress(taskId: string): void {
    const _task = this.tasks.get(taskId);
    if (!_task) {
      return;
    }

    if (_task.subTasks.length === 0) {
      return;
    }

    // 重み付き平均で進捗を計算
    const _weightedProgress = _task.subTasks.reduce((sum, _subTask) => {
      return sum + _subTask.progress * _subTask.weight;
    }, 0);

    const _totalProgress = _weightedProgress / _task.totalWeight;
    this.updateProgress(taskId, _totalProgress);
  }

  /**
   * タスクを完了
   */
  completeTask(_taskId: string, message?: string): void {
    const _task = this.tasks.get(_taskId);
    if (!_task) {
      return;
    }

    _task.status = "completed";
    _task.progress = 100;
    _task.endTime = new Date();
    _task.lastUpdate = new Date();

    // すべてのサブタスクを完了に
    task.subTasks.forEach((_subTask) => {
      _subTask.status = "completed";
      subTask.progress = 100;
    });

    this.emitEvent(_taskId, "complete", 100, message || "Task completed");
  }

  /**
   * タスクでエラー発生
   */
  errorTask(_taskId: string, message: string): void {
    const _task = this.tasks.get(_taskId);
    if (!_task) {
      return;
    }

    _task.status = "error";
    _task.error = message;
    _task.endTime = new Date();
    task.lastUpdate = new Date();

    this.emitEvent(_taskId, "error", _task.progress, message);
  }

  /**
   * ブロッカーを追加
   */
  addBlocker(_taskId: string, blocker: string): void {
    const _task = this.tasks.get(_taskId);
    if (!_task) {
      return;
    }

    if (!_task.blockers) {
      _task.blockers = [];
    }
    _task.blockers.push(blocker);
    task.lastUpdate = new Date();
  }

  /**
   * ブロッカーを削除
   */
  removeBlocker(_taskId: string, blocker: string): void {
    const _task = this.tasks.get(_taskId);
    if (!_task || !_task.blockers) {
      return;
    }

    const _index = _task.blockers.indexOf(blocker);
    if (_index > -1) {
      _task.blockers.splice(_index, 1);
      task.lastUpdate = new Date();
    }
  }

  /**
   * 全体統計を計算
   */
  calculateStats(): ProgressStats {
    const _tasks = Array.from(this._tasks.values());
    const _totalTasks = _tasks.length;
    const _completedTasks = _tasks.filter(
      (t) => t.status === "completed",
    ).length;
    const _inProgressTasks = _tasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const _pendingTasks = _tasks.filter((t) => t.status === "pending").length;
    const _blockedTasks = _tasks.filter(
      (t) => t.blockers && t.blockers.length > 0,
    ).length;

    const _overallProgress =
      _totalTasks > 0
        ? _tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / _totalTasks
        : 0;

    const _velocity = this.calculateOverallVelocity();
    const _timeSpent = Date.now() - this.startTime.getTime();
    const _timeRemaining =
      _velocity > 0 ? ((100 - _overallProgress) / _velocity) * 60 * 1000 : 0;
    const _eta = _velocity > 0 ? new Date(Date.now() + _timeRemaining) : null;

    return {
      tasksTotal: _totalTasks,
      tasksCompleted: _completedTasks,
      tasksInProgress: _inProgressTasks,
      tasksPending: _pendingTasks,
      tasksBlocked: _blockedTasks,
      _overallProgress: Math.round(_overallProgress),
      _velocity,
      _eta,
      _timeSpent,
      _timeRemaining,
    };
  }

  /**
   * 進捗を可視化
   */
  render(): string {
    const _stats = this.calculateStats();
    const output: string[] = [];

    // ヘッダー
    output.push(chalk.cyan.bold("📊 Progress Tracker"));
    output.push(chalk.gray("═".repeat(60)));

    // 全体統計
    output.push(chalk.yellow("📈 Overall Statistics:"));
    output.push(`  Total Tasks: ${_stats.tasksTotal}`);
    output.push(
      `  Completed: ${chalk.green(_stats.tasksCompleted)} (${Math.round((_stats.tasksCompleted / _stats.tasksTotal) * 100)}%)`,
    );
    output.push(`  In Progress: ${chalk.yellow(_stats.tasksInProgress)}`);
    output.push(`  Pending: ${chalk.gray(_stats.tasksPending)}`);

    if (_stats.tasksBlocked > 0) {
      output.push(`  Blocked: ${chalk.red(_stats.tasksBlocked)}`);
    }

    // 全体進捗バー
    output.push("");
    output.push(
      this.renderProgressBar(
        stats.overallProgress,
        this.config.progressBarWidth,
        "Overall Progress",
      ),
    );

    // 速度とETA
    if (this.config.showVelocity) {
      output.push("");
      output.push(chalk.yellow("⚡ Performance:"));
      output.push(`  Velocity: ${_stats.velocity.toFixed(2)} points/min`);

      if (this.config.showETA && _stats.eta) {
        output.push(`  ETA: ${_stats.eta.toLocaleString()}`);
        output.push(
          `  Time Remaining: ${this.formatDuration(_stats.timeRemaining)}`,
        );
      }

      output.push(`  Time Spent: ${this.formatDuration(_stats.timeSpent)}`);
    }

    // アクティブタスク
    const _activeTasks = Array.from(this.tasks.values())
      .filter((t) => t.status === "in_progress")
      .sort((a, b) => b.lastUpdate.getTime() - a.lastUpdate.getTime());

    if (_activeTasks.length > 0) {
      output.push("");
      output.push(chalk.yellow("🔄 Active Tasks:"));

      activeTasks.forEach((_task) => {
        output.push(this.renderTaskDetails(_task));

        if (this.config.showSubTasks && task.subTasks.length > 0) {
          task.subTasks.forEach((_subTask) => {
            output.push(this.renderSubTask(_subTask, "    "));
          });
        }
      });
    }

    // ブロックされたタスク
    if (this.config.showBlockers) {
      const _blockedTasks = Array.from(this.tasks.values()).filter(
        (t) => t.blockers && t.blockers.length > 0,
      );

      if (_blockedTasks.length > 0) {
        output.push("");
        output.push(chalk.red("🚫 Blocked Tasks:"));

        blockedTasks.forEach((_task) => {
          output.push(this.renderTaskDetails(_task));
          task.blockers!.forEach((blocker) => {
            output.push(`    ${chalk.red("▶")} ${blocker}`);
          });
        });
      }
    }

    // 最近の活動
    output.push("");
    output.push(chalk.yellow("📝 Recent Activity:"));
    const _recentEvents = this.getRecentEvents(5);
    recentEvents.forEach((event) => {
      output.push(this.renderEvent(event));
    });

    output.push(chalk.gray("═".repeat(60)));

    return output.join("\n");
  }

  /**
   * タスク詳細をレンダリング
   */
  private renderTaskDetails(_task: ExtendedTask): string {
    const _statusIcon = this.getStatusIcon(_task.status);
    const _statusColor = this.getStatusColor(_task.status);
    const _progressBar = this.renderProgressBar(_task.progress || 0, 20);

    let line = `  ${_statusColor(_statusIcon)} ${_task.title}`;

    if (_task.mode) {
      line += ` ${chalk.dim(`[${_task.mode}]`)}`;
    }

    line += `\n    ${_progressBar}`;

    if (_task.velocity && this.config.showVelocity) {
      line += ` ${chalk.gray(`(${_task.velocity.toFixed(1)} pts/min)`)}`;
    }

    return line;
  }

  /**
   * サブタスクをレンダリング
   */
  private renderSubTask(_subTask: SubTask, indent: string): string {
    const _statusIcon = this.getStatusIcon(_subTask.status);
    const _statusColor = this.getStatusColor(_subTask.status);
    const _progressBar = this.renderProgressBar(_subTask.progress, 15);

    return `${indent}${_statusColor(_statusIcon)} ${_subTask.title} ${_progressBar}`;
  }

  /**
   * プログレスバーをレンダリング
   */
  private renderProgressBar(
    _progress: number,
    width: number,
    label?: string,
  ): string {
    const _filled = Math.round((_progress / 100) * width);
    const _empty = width - _filled;

    const _bar =
      chalk.green("█".repeat(_filled)) + chalk.gray("░".repeat(_empty));
    const _percentage = `${_progress.toFixed(1)}%`;

    if (label) {
      return `${label}: [${_bar}] ${_percentage}`;
    }

    return `[${_bar}] ${_percentage}`;
  }

  /**
   * イベントをレンダリング
   */
  private renderEvent(event: ProgressEvent): string {
    const _time = event.timestamp.toLocaleTimeString();
    const _typeColor =
      event.type === "error"
        ? chalk.red
        : event.type === "complete"
          ? chalk.green
          : chalk.yellow;

    const _currentLine = `  ${chalk.gray(_time)} ${_typeColor(event.type.toUpperCase())}`;

    const _task = this.tasks.get(event.taskId);
    if (_task) {
      line += ` ${_task.title}`;
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
  private calculateVelocity(_task: ExtendedTask, _oldProgress: number): void {
    const _progressDelta = (_task.progress || 0) - _oldProgress;
    const _timeDelta = (Date.now() - _task.lastUpdate.getTime()) / (1000 * 60); // _minutes

    if (_timeDelta > 0) {
      task.velocity = _progressDelta / _timeDelta;
    }
  }

  /**
   * 全体速度を計算
   */
  private calculateOverallVelocity(): number {
    const _activeTasks = Array.from(this.tasks.values()).filter(
      (t) => t.status === "in_progress" && t.velocity,
    );

    if (_activeTasks.length === 0) {
      return 0;
    }

    return (
      _activeTasks.reduce((sum, t) => sum + (t.velocity || 0), 0) /
      _activeTasks.length
    );
  }

  /**
   * 最近のイベントを取得
   */
  private getRecentEvents(count: number): ProgressEvent[] {
    const allEvents: ProgressEvent[] = [];

    this.tasks.forEach((_task) => {
      allEvents.push(..._task.events);
    });

    return allEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, count);
  }

  /**
   * イベントを発行
   */
  private emitEvent(
    taskId: string,
    type: ProgressEvent["type"],
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

    const _task = this.tasks.get(taskId);
    if (_task) {
      task.events.push(event);

      // イベント履歴を制限
      if (_task.events.length > 50) {
        _task.events = _task.events.slice(-50);
      }
    }

    // リスナーに通知
    const _listeners = this.eventListeners.get(type) || [];
    listeners.forEach((listener) => listener(event));
  }

  /**
   * イベントリスナーを追加
   */
  addEventListener(
    _type: ProgressEvent["type"],
    listener: (event: ProgressEvent) => void,
  ): void {
    if (!this.eventListeners.has(_type)) {
      this.eventListeners.set(_type, []);
    }
    this.eventListeners.get(_type)!.push(listener);
  }

  /**
   * イベントリスナーを削除
   */
  removeEventListener(
    _type: ProgressEvent["type"],
    listener: (event: ProgressEvent) => void,
  ): void {
    const _listeners = this.eventListeners.get(_type);
    if (_listeners) {
      const _index = _listeners.indexOf(listener);
      if (_index > -1) {
        listeners.splice(_index, 1);
      }
    }
  }

  /**
   * ユーティリティメソッド
   */
  private getStatusIcon(status: TaskStatus): string {
    const icons: Record<TaskStatus, string> = {
      pending: "○",
      inprogress: "◉",
      completed: "✓",
      error: "✗",
      skipped: "⊘",
    };
    return icons[status];
  }

  private getStatusColor(status: TaskStatus): typeof chalk {
    const colors: Record<TaskStatus, typeof chalk> = {
      pending: chalk.gray,
      inprogress: chalk.yellow,
      completed: chalk.green,
      error: chalk.red,
      skipped: chalk.blue,
    };
    return colors[status];
  }

  private formatDuration(ms: number): string {
    const _minutes = Math.floor(ms / (1000 * 60));
    const _hours = Math.floor(_minutes / 60);
    const _days = Math.floor(_hours / 24);

    if (_days > 0) {
      return `${_days}d ${_hours % 24}h ${_minutes % 60}m`;
    } else if (_hours > 0) {
      return `${_hours}h ${_minutes % 60}m`;
    } else {
      return `${_minutes}m`;
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
