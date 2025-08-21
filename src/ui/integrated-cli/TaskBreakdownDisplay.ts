/**
 * TaskBreakdownDisplay Component
 * タスクブレークダウン表示システム - 階層的タスク可視化
 */

import chalk from 'chalk';
import { Task, TaskStatus } from './ActiveReporter.js';
import { SubTask, ExtendedTask } from './ProgressTracker.js';
import { InternalMode } from './ModeIndicator.js';

/**
 * タスク階層
 */
export interface TaskHierarchy {
  id: string;
  title: string;
  level: number;
  status: TaskStatus;
  progress: number;
  children: TaskHierarchy[];
  parent?: string;
  dependencies?: string[];
  blockers?: string[];
  estimatedTime?: number;
  actualTime?: number;
  mode?: InternalMode;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 表示設定
 */
export interface DisplayConfig {
  maxDepth: number;
  showProgress: boolean;
  showDependencies: boolean;
  showBlockers: boolean;
  showTimestamps: boolean;
  showModes: boolean;
  showTags: boolean;
  showPriority: boolean;
  compactMode: boolean;
  indentSize: number;
  useTreeChars: boolean;
  colorByStatus: boolean;
  colorByPriority: boolean;
  animateChanges: boolean;
}

/**
 * フィルター設定
 */
export interface FilterConfig {
  status?: TaskStatus[];
  priority?: ('low' | 'medium' | 'high' | 'critical')[];
  tags?: string[];
  modes?: InternalMode[];
  showCompleted: boolean;
  showBlocked: boolean;
  textFilter?: string;
}

/**
 * TaskBreakdownDisplayクラス
 */
export class TaskBreakdownDisplay {
  private hierarchy: Map<string, TaskHierarchy> = new Map();
  private config: DisplayConfig;
  private filter: FilterConfig;
  private rootTasks: Set<string> = new Set();

  constructor(config: Partial<DisplayConfig> = {}, filter: Partial<FilterConfig> = {}) {
    this.config = {
      maxDepth: 5,
      showProgress: true,
      showDependencies: false,
      showBlockers: true,
      showTimestamps: false,
      showModes: true,
      showTags: true,
      showPriority: true,
      compactMode: false,
      indentSize: 2,
      useTreeChars: true,
      colorByStatus: true,
      colorByPriority: false,
      animateChanges: false,
      ...config,
    };

    this.filter = {
      showCompleted: true,
      showBlocked: true,
      ...filter,
    };
  }

  /**
   * タスクを追加
   */
  addTask(
    task: ExtendedTask,
    parentId?: string,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    tags: string[] = [],
  ): void {
    const hierarchy: TaskHierarchy = {
      id: task.id,
      title: task.title,
      level: parentId ? (this.hierarchy.get(parentId)?.level || 0) + 1 : 0,
      status: task.status,
      progress: task.progress || 0,
      children: [],
      parent: parentId,
      dependencies: task.dependencies,
      blockers: task.blockers,
      estimatedTime: task.estimatedTime,
      mode: task.mode,
      tags,
      priority,
      actualTime:
        task.endTime && task.startTime
          ? (task.endTime.getTime() - task.startTime.getTime()) / (1000 * 60)
          : undefined,
    };

    this.hierarchy.set(task.id, hierarchy);

    if (parentId) {
      const parent = this.hierarchy.get(parentId);
      if (parent) {
        parent.children.push(hierarchy);
      }
    } else {
      this.rootTasks.add(task.id);
    }

    // サブタスクを追加
    task.subTasks.forEach((subTask) => {
      this.addSubTaskAsChild(task.id, subTask);
    });
  }

  /**
   * サブタスクを子として追加
   */
  private addSubTaskAsChild(parentId: string, subTask: SubTask): void {
    const hierarchy: TaskHierarchy = {
      id: subTask.id,
      title: subTask.title,
      level: (this.hierarchy.get(parentId)?.level || 0) + 1,
      status: subTask.status,
      progress: subTask.progress,
      children: [],
      parent: parentId,
      dependencies: subTask.dependencies,
      estimatedTime: subTask.estimatedTime,
      priority: 'medium',
    };

    this.hierarchy.set(subTask.id, hierarchy);

    const parent = this.hierarchy.get(parentId);
    if (parent) {
      parent.children.push(hierarchy);
    }
  }

  /**
   * タスクを更新
   */
  updateTask(taskId: string, updates: Partial<TaskHierarchy>): void {
    const task = this.hierarchy.get(taskId);
    if (task) {
      Object.assign(task, updates);
    }
  }

  /**
   * 階層を表示
   */
  render(): string {
    const filteredRoots = Array.from(this.rootTasks)
      .map((id) => this.hierarchy.get(id)!)
      .filter((task) => this.passesFilter(task));

    if (filteredRoots.length === 0) {
      return chalk.gray('No tasks match current filters');
    }

    const output: string[] = [];

    // ヘッダー
    output.push(chalk.cyan.bold('📋 Task Breakdown'));
    output.push(chalk.gray('═'.repeat(60)));

    // 統計情報
    const stats = this.calculateHierarchyStats();
    output.push(this.renderStats(stats));
    output.push('');

    // フィルター情報
    if (this.hasActiveFilters()) {
      output.push(this.renderFilterInfo());
      output.push('');
    }

    // ルートタスクを表示
    filteredRoots.forEach((task, index) => {
      output.push(this.renderTaskHierarchy(task, '', index === filteredRoots.length - 1));
    });

    // 依存関係グラフ
    if (this.config.showDependencies) {
      output.push('');
      output.push(this.renderDependencyGraph());
    }

    output.push(chalk.gray('═'.repeat(60)));

    return output.join('\n');
  }

  /**
   * タスク階層をレンダリング
   */
  private renderTaskHierarchy(
    task: TaskHierarchy,
    prefix: string = '',
    isLast: boolean = true,
    depth: number = 0,
  ): string {
    if (depth >= this.config.maxDepth) {
      return '';
    }

    const output: string[] = [];

    // 現在のタスクをレンダリング
    output.push(this.renderTask(task, prefix, isLast));

    // 子タスクをレンダリング
    if (task.children.length > 0) {
      const filteredChildren = task.children.filter((child) => this.passesFilter(child));

      filteredChildren.forEach((child, index) => {
        const isChildLast = index === filteredChildren.length - 1;
        const childPrefix = this.config.useTreeChars
          ? prefix + (isLast ? '    ' : '│   ')
          : prefix + ' '.repeat(this.config.indentSize);

        const childOutput = this.renderTaskHierarchy(child, childPrefix, isChildLast, depth + 1);
        if (childOutput) {
          output.push(childOutput);
        }
      });
    }

    return output.join('\n');
  }

  /**
   * 単一タスクをレンダリング
   */
  private renderTask(task: TaskHierarchy, prefix: string, isLast: boolean): string {
    const parts: string[] = [];

    // ツリー文字
    if (this.config.useTreeChars && prefix) {
      parts.push(prefix + (isLast ? '└── ' : '├── '));
    } else if (prefix) {
      parts.push(prefix);
    }

    // ステータスアイコン
    const statusIcon = this.getStatusIcon(task.status);
    const statusColor = this.getStatusColor(task.status, task.priority);
    parts.push(statusColor(statusIcon));

    // 優先度インジケーター
    if (this.config.showPriority && task.priority) {
      parts.push(this.getPriorityIndicator(task.priority));
    }

    // タスクタイトル
    const titleColor = this.config.colorByStatus
      ? this.getStatusColor(task.status, task.priority)
      : this.config.colorByPriority
        ? this.getPriorityColor(task.priority)
        : chalk.white;

    parts.push(titleColor(task.title));

    // 進捗バー
    if (this.config.showProgress) {
      parts.push(this.renderMiniProgressBar(task.progress));
    }

    // モード表示
    if (this.config.showModes && task.mode) {
      parts.push(chalk.dim(`[${task.mode}]`));
    }

    // タグ表示
    if (this.config.showTags && task.tags && task.tags.length > 0) {
      const tagStr = task.tags.map((tag) => chalk.blue(`#${tag}`)).join(' ');
      parts.push(tagStr);
    }

    // 時間情報
    if (this.config.showTimestamps) {
      if (task.estimatedTime) {
        parts.push(chalk.gray(`(est: ${task.estimatedTime}m)`));
      }
      if (task.actualTime) {
        parts.push(chalk.gray(`(actual: ${Math.round(task.actualTime)}m)`));
      }
    }

    // ブロッカー表示
    if (this.config.showBlockers && task.blockers && task.blockers.length > 0) {
      parts.push(chalk.red(`🚫 ${task.blockers.length} blocker(s)`));
    }

    // 依存関係表示
    if (this.config.showDependencies && task.dependencies && task.dependencies.length > 0) {
      parts.push(chalk.yellow(`⏳ ${task.dependencies.length} dependency(s)`));
    }

    let result = parts.join(' ');

    // コンパクトモードでない場合、追加情報を次の行に表示
    if (!this.config.compactMode) {
      const additionalInfo: string[] = [];

      // ブロッカー詳細
      if (this.config.showBlockers && task.blockers && task.blockers.length > 0) {
        task.blockers.forEach((blocker) => {
          additionalInfo.push(`${prefix}    ${chalk.red('▶')} ${blocker}`);
        });
      }

      // 依存関係詳細
      if (this.config.showDependencies && task.dependencies && task.dependencies.length > 0) {
        task.dependencies.forEach((dep) => {
          const depTask = this.hierarchy.get(dep);
          const depTitle = depTask ? depTask.title : dep;
          additionalInfo.push(`${prefix}    ${chalk.yellow('◀')} ${depTitle}`);
        });
      }

      if (additionalInfo.length > 0) {
        result += '\n' + additionalInfo.join('\n');
      }
    }

    return result;
  }

  /**
   * ミニプログレスバーをレンダリング
   */
  private renderMiniProgressBar(progress: number, width: number = 10): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `[${bar}] ${progress.toFixed(0)}%`;
  }

  /**
   * 統計情報をレンダリング
   */
  private renderStats(stats: unknown): string {
    const output: string[] = [];

    output.push(chalk.yellow('📊 Hierarchy Statistics:'));
    output.push(`  Total Tasks: ${stats.total}`);
    output.push(`  Max Depth: ${stats.maxDepth}`);
    output.push(`  Completed: ${chalk.green(stats.completed)} (${stats.completionRate}%)`);
    output.push(`  In Progress: ${chalk.yellow(stats.inProgress)}`);
    output.push(`  Blocked: ${chalk.red(stats.blocked)}`);

    if (stats.avgProgressByLevel) {
      output.push('');
      output.push(chalk.yellow('📈 Progress by Level:'));
      stats.avgProgressByLevel.forEach((progress: number, level: number) => {
        if (progress >= 0) {
          output.push(`  Level ${level}: ${progress.toFixed(1)}%`);
        }
      });
    }

    return output.join('\n');
  }

  /**
   * フィルター情報をレンダリング
   */
  private renderFilterInfo(): string {
    const filters: string[] = [];

    if (this.filter.status && this.filter.status.length > 0) {
      filters.push(`Status: ${this.filter.status.join(', ')}`);
    }

    if (this.filter.priority && this.filter.priority.length > 0) {
      filters.push(`Priority: ${this.filter.priority.join(', ')}`);
    }

    if (this.filter.tags && this.filter.tags.length > 0) {
      filters.push(`Tags: ${this.filter.tags.map((t) => `#${t}`).join(', ')}`);
    }

    if (this.filter.textFilter) {
      filters.push(`Text: "${this.filter.textFilter}"`);
    }

    return chalk.blue('🔍 Active Filters: ') + chalk.gray(filters.join(' | '));
  }

  /**
   * 依存関係グラフをレンダリング
   */
  private renderDependencyGraph(): string {
    const output: string[] = [];
    output.push(chalk.yellow('🔗 Dependency Graph:'));

    const tasksWithDeps = Array.from(this.hierarchy.values()).filter(
      (task) => task.dependencies && task.dependencies.length > 0,
    );

    if (tasksWithDeps.length === 0) {
      output.push(chalk.gray('  No dependencies found'));
      return output.join('\n');
    }

    tasksWithDeps.forEach((task) => {
      output.push(`  ${task.title}:`);
      task.dependencies!.forEach((depId) => {
        const depTask = this.hierarchy.get(depId);
        const depTitle = depTask ? depTask.title : depId;
        const depStatus = depTask ? this.getStatusIcon(depTask.status) : '?';
        output.push(`    ← ${depStatus} ${depTitle}`);
      });
    });

    return output.join('\n');
  }

  /**
   * 階層統計を計算
   */
  private calculateHierarchyStats() {
    const allTasks = Array.from(this.hierarchy.values());
    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.status === 'completed').length;
    const inProgress = allTasks.filter((t) => t.status === 'in_progress').length;
    const blocked = allTasks.filter((t) => t.blockers && t.blockers.length > 0).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const maxDepth = Math.max(...allTasks.map((t) => t.level), 0);

    // レベル別平均進捗
    const avgProgressByLevel: number[] = [];
    for (let level = 0; level <= maxDepth; level++) {
      const tasksAtLevel = allTasks.filter((t) => t.level === level);
      if (tasksAtLevel.length > 0) {
        const avgProgress =
          tasksAtLevel.reduce((sum, t) => sum + t.progress, 0) / tasksAtLevel.length;
        avgProgressByLevel[level] = avgProgress;
      } else {
        avgProgressByLevel[level] = -1; // No tasks at this level
      }
    }

    return {
      total,
      completed,
      inProgress,
      blocked,
      completionRate,
      maxDepth,
      avgProgressByLevel,
    };
  }

  /**
   * フィルターをチェック
   */
  private passesFilter(task: TaskHierarchy): boolean {
    // ステータスフィルター
    if (this.filter.status && !this.filter.status.includes(task.status)) {
      return false;
    }

    // 優先度フィルター
    if (this.filter.priority && task.priority && !this.filter.priority.includes(task.priority)) {
      return false;
    }

    // タグフィルター
    if (this.filter.tags && this.filter.tags.length > 0) {
      const hasMatchingTag = task.tags?.some((tag) => this.filter.tags!.includes(tag));
      if (!hasMatchingTag) return false;
    }

    // モードフィルター
    if (this.filter.modes && task.mode && !this.filter.modes.includes(task.mode)) {
      return false;
    }

    // 完了タスク表示設定
    if (!this.filter.showCompleted && task.status === 'completed') {
      return false;
    }

    // ブロックタスク表示設定
    if (!this.filter.showBlocked && task.blockers && task.blockers.length > 0) {
      return false;
    }

    // テキストフィルター
    if (this.filter.textFilter) {
      const searchText = this.filter.textFilter.toLowerCase();
      const titleMatch = task.title.toLowerCase().includes(searchText);
      const tagMatch = task.tags?.some((tag) => tag.toLowerCase().includes(searchText));
      if (!titleMatch && !tagMatch) return false;
    }

    return true;
  }

  /**
   * アクティブフィルターがあるかチェック
   */
  private hasActiveFilters(): boolean {
    return !!(
      this.filter.status?.length ||
      this.filter.priority?.length ||
      this.filter.tags?.length ||
      this.filter.modes?.length ||
      this.filter.textFilter ||
      !this.filter.showCompleted ||
      !this.filter.showBlocked
    );
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

  private getStatusColor(status: TaskStatus, priority?: string): typeof chalk {
    if (this.config.colorByPriority && priority) {
      return this.getPriorityColor(priority);
    }

    const colors: Record<TaskStatus, typeof chalk> = {
      pending: chalk.gray,
      in_progress: chalk.yellow,
      completed: chalk.green,
      error: chalk.red,
      skipped: chalk.blue,
    };
    return colors[status];
  }

  private getPriorityIndicator(priority: string): string {
    const indicators: Record<string, string> = {
      low: chalk.gray('◇'),
      medium: chalk.yellow('◆'),
      high: chalk.yellowBright('◆'),
      critical: chalk.red('◆'),
    };
    return indicators[priority] || '';
  }

  private getPriorityColor(priority?: string): typeof chalk {
    if (!priority) return chalk.white;

    const colors: Record<string, typeof chalk> = {
      low: chalk.gray,
      medium: chalk.yellow,
      high: chalk.yellowBright,
      critical: chalk.red,
    };
    return colors[priority] || chalk.white;
  }

  /**
   * 設定とフィルターの更新
   */
  updateConfig(config: Partial<DisplayConfig>): void {
    this.config = { ...this.config, ...config };
  }

  updateFilter(filter: Partial<FilterConfig>): void {
    this.filter = { ...this.filter, ...filter };
  }

  /**
   * 検索
   */
  search(query: string): TaskHierarchy[] {
    const searchTerm = query.toLowerCase();
    return Array.from(this.hierarchy.values()).filter(
      (task) =>
        task.title.toLowerCase().includes(searchTerm) ||
        task.tags?.some((tag) => tag.toLowerCase().includes(searchTerm)),
    );
  }

  /**
   * パス取得
   */
  getTaskPath(taskId: string): string[] {
    const path: string[] = [];
    let current = this.hierarchy.get(taskId);

    while (current) {
      path.unshift(current.title);
      current = current.parent ? this.hierarchy.get(current.parent) : undefined;
    }

    return path;
  }

  /**
   * リセット
   */
  reset(): void {
    this.hierarchy.clear();
    this.rootTasks.clear();
  }

  /**
   * データ取得
   */
  getHierarchy(): Map<string, TaskHierarchy> {
    return new Map(this.hierarchy);
  }

  getRootTasks(): TaskHierarchy[] {
    return Array.from(this.rootTasks).map((id) => this.hierarchy.get(id)!);
  }
}

export default TaskBreakdownDisplay;
