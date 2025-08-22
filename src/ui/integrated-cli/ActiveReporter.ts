/**
 * ActiveReporter Component
 * アクティブレポーティングシステム - リアルタイム進捗表示
 */

import chalk from 'chalk';
import { InternalMode } from './ModeIndicator.js';
import { DESIGN_CONSTANTS } from '../optimized-design-system.js';

/**
 * タスク状態
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'skipped';

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
  estimatedTime?: number; // minutes
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
  tasks: Task[];
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
  private project: Project | null = null;
  private config: ReportConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private updateCallbacks: Array<(project: Project) => void> = [];
  private isActive: boolean = false;

  constructor(config: Partial<ReportConfig> = {}) {
    this.config = {
      showProgress: true,
      showTimestamps: true,
      showEstimates: true,
      autoRefresh: false,
      refreshInterval: 1000,
      maxDisplayTasks: 10,
      compactMode: false,
      ...config,
    };
  }

  /**
   * プロジェクトを開始
   */
  startProject(project: Omit<Project, 'startTime'>): void {
    this.project = {
      ...project,
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
  addTask(task: Omit<Task, 'id'>): string {
    if (!this.project) {
      throw new Error('No active project. Call startProject() first.');
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTask: Task = {
      id: taskId,
      ...task,
    };

    this.project.tasks.push(newTask);
    this.notifyUpdate();

    return taskId;
  }

  /**
   * タスクを更新
   */
  updateTask(taskId: string, updates: Partial<Task>): void {
    if (!this.project) {return;}

    const task = this.project.tasks.find((t) => t.id === taskId);
    if (!task) {return;}

    // 状態変化の追跡
    if (updates.status && updates.status !== task.status) {
      if (updates.status === 'in_progress' && !task.startTime) {
        updates.startTime = new Date();
      } else if (['completed', 'error', 'skipped'].includes(updates.status) && !task.endTime) {
        updates.endTime = new Date();
      }
    }

    Object.assign(task, updates);
    this.notifyUpdate();
  }

  /**
   * タスクを開始
   */
  startTask(taskId: string): void {
    this.updateTask(taskId, {
      status: 'in_progress',
      startTime: new Date(),
    });
  }

  /**
   * タスクを完了
   */
  completeTask(taskId: string): void {
    this.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      endTime: new Date(),
    });
  }

  /**
   * タスクでエラー発生
   */
  errorTask(taskId: string, error: string): void {
    this.updateTask(taskId, {
      status: 'error',
      error,
      endTime: new Date(),
    });
  }

  /**
   * タスク進捗を更新
   */
  updateProgress(taskId: string, progress: number): void {
    this.updateTask(taskId, { progress: Math.max(0, Math.min(100, progress)) });
  }

  /**
   * フェーズを変更
   */
  setPhase(phase: string): void {
    if (this.project) {
      this.project.currentPhase = phase;
      this.notifyUpdate();
    }
  }

  /**
   * レポートをレンダリング
   */
  render(): string {
    if (!this.project || !this.isActive) {
      return chalk.gray('No active project');
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
    if (!this.project) {return '';}

    const output: string[] = [];
    const stats = this.calculateStats();

    // ヘッダー
    output.push(chalk.cyan.bold(`📊 ${this.project.name}`));
    output.push(chalk.gray('═'.repeat(60)));

    if (this.project.description) {
      output.push(chalk.gray(this.project.description));
      output.push('');
    }

    // 現在のフェーズ
    if (this.project.currentPhase) {
      output.push(chalk.blue(`📋 Current Phase: ${this.project.currentPhase}`));
      output.push('');
    }

    // 統計情報
    output.push(chalk.yellow('📈 Progress Overview:'));
    output.push(`  ● Total Tasks: ${stats.totalTasks}`);
    output.push(`  ● Completed: ${chalk.green(stats.completedTasks)} (${stats.completionRate}%)`);
    output.push(`  ● In Progress: ${chalk.yellow(stats.inProgressTasks)}`);
    output.push(`  ● Pending: ${chalk.gray(stats.pendingTasks)}`);

    if (stats.errorTasks > 0) {
      output.push(`  ● Errors: ${chalk.red(stats.errorTasks)}`);
    }

    // 時間情報
    if (this.config.showTimestamps || this.config.showEstimates) {
      output.push('');
      output.push(chalk.yellow('⏱ Time Information:'));

      if (this.config.showTimestamps) {
        output.push(`  ● Started: ${this.project.startTime.toLocaleString()}`);
        output.push(
          `  ● Elapsed: ${this.formatDuration(Date.now() - this.project.startTime.getTime())}`,
        );
      }

      if (this.config.showEstimates && stats.estimatedTimeRemaining) {
        output.push(
          `  ● Estimated Remaining: ${this.formatDuration(stats.estimatedTimeRemaining * 60 * 1000)}`,
        );
      }
    }

    // プログレスバー
    if (this.config.showProgress) {
      output.push('');
      output.push(this.renderProgressBar(stats.completionRate));
    }

    // アクティブタスク
    const activeTasks = this.project.tasks
      .filter((t) => t.status === 'in_progress')
      .slice(0, this.config.maxDisplayTasks);

    if (activeTasks.length > 0) {
      output.push('');
      output.push(chalk.yellow('🔄 Active Tasks:'));
      activeTasks.forEach((task) => {
        output.push(this.renderTask(task, '  '));
      });
    }

    // 最近完了したタスク
    const recentlyCompleted = this.project.tasks
      .filter((t) => t.status === 'completed' && t.endTime)
      .sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime())
      .slice(0, 3);

    if (recentlyCompleted.length > 0) {
      output.push('');
      output.push(chalk.green('✅ Recently Completed:'));
      recentlyCompleted.forEach((task) => {
        output.push(this.renderTask(task, '  '));
      });
    }

    // エラーがあるタスク
    const errorTasks = this.project.tasks.filter((t) => t.status === 'error');
    if (errorTasks.length > 0) {
      output.push('');
      output.push(chalk.red('❌ Tasks with Errors:'));
      errorTasks.forEach((task) => {
        output.push(this.renderTask(task, '  '));
        if (task.error) {
          output.push(chalk.red(`    Error: ${task.error}`));
        }
      });
    }

    output.push(chalk.gray('═'.repeat(60)));

    return output.join('\n');
  }

  /**
   * コンパクトレポートをレンダリング
   */
  private renderCompact(): string {
    if (!this.project) {return '';}

    const stats = this.calculateStats();
    const activeTask = this.project.tasks.find((t) => t.status === 'in_progress');

    const statusIcon = activeTask ? '🔄' : stats.completionRate === 100 ? '✅' : '⏸';
    const phaseText = this.project.currentPhase ? ` [${this.project.currentPhase}]` : '';

    return `${statusIcon} ${this.project.name}${phaseText} - ${stats.completionRate}% (${stats.completedTasks}/${stats.totalTasks})`;
  }

  /**
   * タスクを1行でレンダリング
   */
  private renderTask(task: Task, indent: string = ''): string {
    const statusIcon = this.getStatusIcon(task.status);
    const statusColor = this.getStatusColor(task.status);

    let line = `${indent}${statusColor(statusIcon)} ${task.title}`;

    // 進捗表示
    if (task.progress !== undefined && this.config.showProgress) {
      line += ` ${chalk.gray(`(${task.progress}%)`)}`;
    }

    // 時間情報
    if (this.config.showTimestamps) {
      if (task.startTime && task.status === 'in_progress') {
        const elapsed = Date.now() - task.startTime.getTime();
        line += ` ${chalk.gray(`[${this.formatDuration(elapsed)}]`)}`;
      } else if (task.endTime) {
        line += ` ${chalk.gray(`[${task.endTime.toLocaleTimeString()}]`)}`;
      }
    }

    // モード表示
    if (task.mode) {
      line += ` ${chalk.dim(`[${task.mode}]`)}`;
    }

    return line;
  }

  /**
   * プログレスバーをレンダリング
   */
  private renderProgressBar(percentage: number, width: number = 40): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `Progress: [${bar}] ${percentage}%`;
  }

  /**
   * 統計を計算
   */
  private calculateStats() {
    if (!this.project) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        pendingTasks: 0,
        errorTasks: 0,
        completionRate: 0,
        estimatedTimeRemaining: 0,
      };
    }

    const tasks = this.project.tasks;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
    const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
    const errorTasks = tasks.filter((t) => t.status === 'error').length;

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const estimatedTimeRemaining = tasks
      .filter((t) => t.status === 'pending' && t.estimatedTime)
      .reduce((sum, t) => sum + (t.estimatedTime || 0), 0);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      errorTasks,
      completionRate,
      estimatedTimeRemaining,
    };
  }

  /**
   * ステータスアイコンを取得
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

  /**
   * ステータス色を取得
   */
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

  /**
   * 時間をフォーマット
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 自動更新を開始
   */
  private startAutoRefresh(): void {
    if (this.refreshTimer) {return;}

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
  onUpdate(callback: (project: Project) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * 更新コールバックを削除
   */
  offUpdate(callback: (project: Project) => void): void {
    const index = this.updateCallbacks.indexOf(callback);
    if (index > -1) {
      this.updateCallbacks.splice(index, 1);
    }
  }

  /**
   * 更新を通知
   */
  private notifyUpdate(): void {
    if (this.project) {
      this.updateCallbacks.forEach((callback) => callback(this.project!));
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
    this.project = null;
    this.updateCallbacks = [];
  }

  /**
   * 現在のプロジェクトを取得
   */
  getCurrentProject(): Project | null {
    return this.project;
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
    return this.project ? [...this.project.tasks] : [];
  }

  /**
   * タスクを取得
   */
  getTask(taskId: string): Task | undefined {
    return this.project?.tasks.find((task) => task.id === taskId);
  }

  /**
   * プロジェクト統計を取得
   */
  getProjectStats(): {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    overallProgress: number;
  } {
    if (!this.project) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        pendingTasks: 0,
        overallProgress: 0,
      };
    }

    const tasks = this.project.tasks;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
    const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
    const overallProgress =
      totalTasks > 0 ? tasks.reduce((sum, task) => sum + task.progress, 0) / totalTasks : 0;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      overallProgress,
    };
  }
}

export default ActiveReporter;
