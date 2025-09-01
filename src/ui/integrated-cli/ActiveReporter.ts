/**
 * ActiveReporter Component
 * アクティブレポーティングシステム - リアルタイム進捗表示
 */

import chalk from "chalk";
import { InternalMode } from "./ModeIndicator.js";
import { _DESIGN_CONSTANTS } from "../optimized-design-system.js";

/**
 * タスク状態
 */
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "error"
  | "skipped";

/**
 * タスク定義
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  progress?: number; // 0-100
  dependencies?: string[];
  estimatedTime?: number; // _minutes
  startTime?: Date;
  endTime?: Date;
  error?: string;
  mode?: InternalMode;
}

/**
 * プロジェクト情報
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  _tasks: Task[];
  startTime: Date;
  estimatedDuration?: number;
  currentPhase?: string;
}

/**
 * レポート設定
 */
export interface ReportConfig {
  showProgress: boolean;
  showTimestamps: boolean;
  showEstimates: boolean;
  autoRefresh: boolean;
  refreshInterval: number; // ms
  maxDisplayTasks: number;
  compactMode: boolean;
}

/**
 * ActiveReporterクラス
 */
export class ActiveReporter {
  private _project: Project | null = null;
  private config: ReportConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private updateCallbacks: Array<(_project: Project) => void> = [];
  private isActive: boolean = false;

  constructor(_config: Partial<ReportConfig> = {}) {
    this._config = {
      showProgress: true,
      showTimestamps: true,
      showEstimates: true,
      autoRefresh: false,
      refreshInterval: 1000,
      maxDisplayTasks: 10,
      compactMode: false,
      ..._config,
    };
  }

  /**
   * プロジェクトを開始
   */
  startProject(_project: Omit<Project, "startTime">): void {
    this._project = {
      ..._project,
      startTime: new Date(),
    };

    this.isActive = true;

    if (this.config.autoRefresh) {
      this.startAutoRefresh();
    }

    this.notifyUpdate();
  }

  /**
   * タスクを追加
   */
  addTask(_task: Omit<Task, "id">): string {
    if (!this._project) {
      throw new Error("No active project. Call startProject() first.");
    }

    const _taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTask: Task = {
      id: _taskId,
      ..._task,
    };

    this._project.tasks.push(newTask);
    this.notifyUpdate();

    return _taskId;
  }

  /**
   * タスクを更新
   */
  updateTask(_taskId: string, updates: Partial<Task>): void {
    if (!this._project) {
      return;
    }

    const _task = this._project.tasks.find((t) => t.id === _taskId);
    if (!_task) {
      return;
    }

    // 状態変化の追跡
    if (updates.status && updates.status !== _task.status) {
      if (updates.status === "in_progress" && !_task.startTime) {
        updates.startTime = new Date();
      } else if (
        ["completed", "error", "skipped"].includes(updates.status) &&
        !_task.endTime
      ) {
        updates.endTime = new Date();
      }
    }

    Object.assign(_task, updates);
    this.notifyUpdate();
  }

  /**
   * タスクを開始
   */
  startTask(_taskId: string): void {
    this.updateTask(_taskId, {
      status: "in_progress",
      startTime: new Date(),
    });
  }

  /**
   * タスクを完了
   */
  completeTask(_taskId: string): void {
    this.updateTask(_taskId, {
      status: "completed",
      progress: 100,
      endTime: new Date(),
    });
  }

  /**
   * タスクでエラー発生
   */
  errorTask(_taskId: string, error: string): void {
    this.updateTask(_taskId, {
      status: "error",
      error,
      endTime: new Date(),
    });
  }

  /**
   * タスク進捗を更新
   */
  updateProgress(_taskId: string, progress: number): void {
    this.updateTask(_taskId, {
      progress: Math.max(0, Math.min(100, progress)),
    });
  }

  /**
   * フェーズを変更
   */
  setPhase(phase: string): void {
    if (this._project) {
      this._project.currentPhase = phase;
      this.notifyUpdate();
    }
  }

  /**
   * レポートをレンダリング
   */
  render(): string {
    if (!this._project || !this.isActive) {
      return chalk.gray("No active project");
    }

    if (this.config.compactMode) {
      return this.renderCompact();
    }

    return this.renderDetailed();
  }

  /**
   * 詳細レポートをレンダリング
   */
  private renderDetailed(): string {
    if (!this._project) {
      return "";
    }

    const output: string[] = [];
    const _stats = this.calculateStats();

    // ヘッダー
    output.push(chalk.cyan.bold(`📊 ${this._project.name}`));
    output.push(chalk.gray("═".repeat(60)));

    if (this._project.description) {
      output.push(chalk.gray(this._project.description));
      output.push("");
    }

    // 現在のフェーズ
    if (this._project.currentPhase) {
      output.push(
        chalk.blue(`📋 Current Phase: ${this._project.currentPhase}`),
      );
      output.push("");
    }

    // 統計情報
    output.push(chalk.yellow("📈 Progress Overview:"));
    output.push(`  ● Total Tasks: ${_stats.totalTasks}`);
    output.push(
      `  ● Completed: ${chalk.green(_stats.completedTasks)} (${_stats.completionRate}%)`,
    );
    output.push(`  ● In Progress: ${chalk.yellow(_stats.inProgressTasks)}`);
    output.push(`  ● Pending: ${chalk.gray(_stats.pendingTasks)}`);

    if (_stats._errorTasks > 0) {
      output.push(`  ● Errors: ${chalk.red(_stats._errorTasks)}`);
    }

    // 時間情報
    if (this.config.showTimestamps || this.config.showEstimates) {
      output.push("");
      output.push(chalk.yellow("⏱ Time Information:"));

      if (this.config.showTimestamps) {
        output.push(`  ● Started: ${this._project.startTime.toLocaleString()}`);
        output.push(
          `  ● Elapsed: ${this.formatDuration(Date.now() - this._project.startTime.getTime())}`,
        );
      }

      if (this.config.showEstimates && _stats.estimatedTimeRemaining) {
        output.push(
          `  ● Estimated Remaining: ${this.formatDuration(_stats.estimatedTimeRemaining * 60 * 1000)}`,
        );
      }
    }

    // プログレスバー
    if (this.config.showProgress) {
      output.push("");
      output.push(this.renderProgressBar(_stats.completionRate));
    }

    // アクティブタスク
    const _activeTasks = this._project.tasks
      .filter((t) => t.status === "in_progress")
      .slice(0, this.config.maxDisplayTasks);

    if (_activeTasks.length > 0) {
      output.push("");
      output.push(chalk.yellow("🔄 Active Tasks:"));
      activeTasks.forEach((_task) => {
        output.push(this.renderTask(_task, "  "));
      });
    }

    // 最近完了したタスク
    const _recentlyCompleted = this._project.tasks
      .filter((t) => t.status === "completed" && t.endTime)
      .sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime())
      .slice(0, 3);

    if (_recentlyCompleted.length > 0) {
      output.push("");
      output.push(chalk.green("✅ Recently Completed:"));
      recentlyCompleted.forEach((_task) => {
        output.push(this.renderTask(_task, "  "));
      });
    }

    // エラーがあるタスク
    const _errorTasks = this._project.tasks.filter((t) => t.status === "error");
    if (_errorTasks.length > 0) {
      output.push("");
      output.push(chalk.red("❌ Tasks with Errors:"));
      errorTasks.forEach((_task) => {
        output.push(this.renderTask(_task, "  "));
        if (task.error) {
          output.push(chalk.red(`    Error: ${task.error}`));
        }
      });
    }

    output.push(chalk.gray("═".repeat(60)));

    return output.join("\n");
  }

  /**
   * コンパクトレポートをレンダリング
   */
  private renderCompact(): string {
    if (!this._project) {
      return "";
    }

    const _stats = this.calculateStats();
    const _activeTask = this._project.tasks.find(
      (t) => t.status === "in_progress",
    );

    const _statusIcon = _activeTask
      ? "🔄"
      : _stats.completionRate === 100
        ? "✅"
        : "⏸";
    const _phaseText = this._project.currentPhase
      ? ` [${this._project.currentPhase}]`
      : "";

    return `${_statusIcon} ${this._project.name}${_phaseText} - ${_stats.completionRate}% (${_stats.completedTasks}/${_stats.totalTasks})`;
  }

  /**
   * タスクを1行でレンダリング
   */
  private renderTask(_task: Task, indent: string = ""): string {
    const _statusIcon = this.getStatusIcon(_task.status);
    const _statusColor = this.getStatusColor(_task.status);

    let line = `${indent}${_statusColor(_statusIcon)} ${_task.title}`;

    // 進捗表示
    if (_task.progress !== undefined && this.config.showProgress) {
      line += ` ${chalk.gray(`(${_task.progress}%)`)}`;
    }

    // 時間情報
    if (this.config.showTimestamps) {
      if (_task.startTime && _task.status === "in_progress") {
        const _elapsed = Date.now() - _task.startTime.getTime();
        line += ` ${chalk.gray(`[${this.formatDuration(_elapsed)}]`)}`;
      } else if (_task.endTime) {
        line += ` ${chalk.gray(`[${_task.endTime.toLocaleTimeString()}]`)}`;
      }
    }

    // モード表示
    if (_task.mode) {
      line += ` ${chalk.dim(`[${_task.mode}]`)}`;
    }

    return line;
  }

  /**
   * プログレスバーをレンダリング
   */
  private renderProgressBar(_percentage: number, width: number = 40): string {
    const _filled = Math.round((_percentage / 100) * width);
    const _empty = width - _filled;

    const _bar =
      chalk.green("█".repeat(_filled)) + chalk.gray("░".repeat(_empty));
    return `Progress: [${_bar}] ${_percentage}%`;
  }

  /**
   * 統計を計算
   */
  private calculateStats() {
    if (!this._project) {
      return {
        _totalTasks: 0,
        _completedTasks: 0,
        _inProgressTasks: 0,
        _pendingTasks: 0,
        _errorTasks: 0,
        _completionRate: 0,
        _estimatedTimeRemaining: 0,
      };
    }

    const _tasks = this._project._tasks;
    const _totalTasks = _tasks.length;
    const _completedTasks = _tasks.filter(
      (t) => t.status === "completed",
    ).length;
    const _inProgressTasks = _tasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const _pendingTasks = _tasks.filter((t) => t.status === "pending").length;
    const _errorTasks = _tasks.filter((t) => t.status === "error").length;

    const _completionRate =
      _totalTasks > 0 ? Math.round((_completedTasks / _totalTasks) * 100) : 0;

    const _estimatedTimeRemaining = _tasks
      .filter((t) => t.status === "pending" && t.estimatedTime)
      .reduce((sum, t) => sum + (t.estimatedTime || 0), 0);

    return {
      _totalTasks,
      _completedTasks,
      _inProgressTasks,
      _pendingTasks,
      _errorTasks,
      _completionRate,
      _estimatedTimeRemaining,
    };
  }

  /**
   * ステータスアイコンを取得
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

  /**
   * ステータス色を取得
   */
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

  /**
   * 時間をフォーマット
   */
  private formatDuration(ms: number): string {
    const _seconds = Math.floor(ms / 1000);
    const _minutes = Math.floor(_seconds / 60);
    const _hours = Math.floor(_minutes / 60);

    if (_hours > 0) {
      return `${_hours}h ${_minutes % 60}m`;
    } else if (_minutes > 0) {
      return `${_minutes}m ${_seconds % 60}s`;
    } else {
      return `${_seconds}s`;
    }
  }

  /**
   * 自動更新を開始
   */
  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      this.notifyUpdate();
    }, this.config.refreshInterval);
  }

  /**
   * 自動更新を停止
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * 更新コールバックを登録
   */
  onUpdate(_callback: (project: Project) => void): void {
    this.updateCallbacks.push(_callback);
  }

  /**
   * 更新コールバックを削除
   */
  offUpdate(_callback: (project: Project) => void): void {
    const _index = this.updateCallbacks.indexOf(_callback);
    if (_index > -1) {
      this.updateCallbacks.splice(_index, 1);
    }
  }

  /**
   * 更新を通知
   */
  private notifyUpdate(): void {
    if (this._project) {
      this.updateCallbacks.forEach((callback) => callback(this._project!));
    }
  }

  /**
   * プロジェクトを停止
   */
  stop(): void {
    this.isActive = false;
    this.stopAutoRefresh();
  }

  /**
   * プロジェクトをリセット
   */
  reset(): void {
    this.stop();
    this._project = null;
    this.updateCallbacks = [];
  }

  /**
   * 現在のプロジェクトを取得
   */
  getCurrentProject(): Project | null {
    return this._project;
  }

  /**
   * アクティブかチェック
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<ReportConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.autoRefresh && !this.refreshTimer) {
      this.startAutoRefresh();
    } else if (!this.config.autoRefresh && this.refreshTimer) {
      this.stopAutoRefresh();
    }
  }

  /**
   * 設定を取得
   */
  getConfig(): ReportConfig {
    return { ...this.config };
  }

  /**
   * 全タスクを取得
   */
  getAllTasks(): Task[] {
    return this._project ? [...this._project.tasks] : [];
  }

  /**
   * タスクを取得
   */
  getTask(_taskId: string): Task | undefined {
    return this._project?.tasks.find((_task) => _task.id === _taskId);
  }

  /**
   * プロジェクト統計を取得
   */
  getProjectStats(): {
    _totalTasks: number;
    _completedTasks: number;
    _inProgressTasks: number;
    _pendingTasks: number;
    _overallProgress: number;
  } {
    if (!this._project) {
      return {
        _totalTasks: 0,
        _completedTasks: 0,
        _inProgressTasks: 0,
        _pendingTasks: 0,
        _overallProgress: 0,
      };
    }

    const _tasks = this._project._tasks;
    const _totalTasks = _tasks.length;
    const _completedTasks = _tasks.filter(
      (t) => t.status === "completed",
    ).length;
    const _inProgressTasks = _tasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const _pendingTasks = _tasks.filter((t) => t.status === "pending").length;
    const _overallProgress =
      _totalTasks > 0
        ? _tasks.reduce((sum, _task) => sum + _task.progress, 0) / _totalTasks
        : 0;

    return {
      _totalTasks,
      _completedTasks,
      _inProgressTasks,
      _pendingTasks,
      _overallProgress,
    };
  }
}

export default ActiveReporter;
