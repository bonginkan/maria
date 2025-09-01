/**
 * TaskBreakdownDisplay Component
 * タスクブレークダウン表示システム - 階層的タスク可視化
 */

import chalk from "chalk";
import { Task as _Task, TaskStatus } from "./ActiveReporter.js";
import { ExtendedTask, SubTask } from "./ProgressTracker.js";
import { InternalMode } from "./ModeIndicator.js";

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
  _parent?: string;
  dependencies?: string[];
  blockers?: string[];
  estimatedTime?: number;
  actualTime?: number;
  mode?: InternalMode;
  tags?: string[];
  priority?: "low" | "medium" | "high" | "critical";
}

/**
 * 表示設定
 */
export interface DisplayConfig {
  _maxDepth: number;
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
  priority?: ("low" | "medium" | "high" | "critical")[];
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

  constructor(
    _config: Partial<DisplayConfig> = {},
    filter: Partial<FilterConfig> = {},
  ) {
    this._config = {
      _maxDepth: 5,
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
      ..._config,
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
    _task: ExtendedTask,
    parentId?: string,
    priority: "low" | "medium" | "high" | "critical" = "medium",
    tags: string[] = [],
  ): void {
    const hierarchy: TaskHierarchy = {
      id: _task.id,
      title: _task.title,
      level: parentId ? (this.hierarchy.get(parentId)?.level || 0) + 1 : 0,
      status: _task.status,
      progress: _task.progress || 0,
      children: [],
      _parent: parentId,
      dependencies: _task.dependencies,
      blockers: _task.blockers,
      estimatedTime: _task.estimatedTime,
      mode: _task.mode,
      tags,
      priority,
      actualTime:
        _task.endTime && _task.startTime
          ? (_task.endTime.getTime() - _task.startTime.getTime()) / (1000 * 60)
          : undefined,
    };

    this.hierarchy.set(_task.id, hierarchy);

    if (parentId) {
      const _parent = this.hierarchy.get(parentId);
      if (_parent) {
        parent.children.push(hierarchy);
      }
    } else {
      this.rootTasks.add(_task.id);
    }

    // サブタスクを追加
    task.subTasks.forEach((subTask) => {
      this.addSubTaskAsChild(_task.id, subTask);
    });
  }

  /**
   * サブタスクを子として追加
   */
  private addSubTaskAsChild(_parentId: string, subTask: SubTask): void {
    const hierarchy: TaskHierarchy = {
      id: subTask.id,
      title: subTask.title,
      level: (this.hierarchy.get(_parentId)?.level || 0) + 1,
      status: subTask.status,
      progress: subTask.progress,
      children: [],
      _parent: _parentId,
      dependencies: subTask.dependencies,
      estimatedTime: subTask.estimatedTime,
      priority: "medium",
    };

    this.hierarchy.set(subTask.id, hierarchy);

    const _parent = this.hierarchy.get(_parentId);
    if (_parent) {
      parent.children.push(hierarchy);
    }
  }

  /**
   * タスクを更新
   */
  updateTask(_taskId: string, updates: Partial<TaskHierarchy>): void {
    const _task = this.hierarchy.get(_taskId);
    if (_task) {
      Object.assign(_task, updates);
    }
  }

  /**
   * 階層を表示
   */
  render(): string {
    const _filteredRoots = Array.from(this.rootTasks)
      .map((id) => this.hierarchy.get(id)!)
      .filter((_task) => this.passesFilter(_task));

    if (_filteredRoots.length === 0) {
      return chalk.gray("No tasks match current filters");
    }

    const output: string[] = [];

    // ヘッダー
    output.push(chalk.cyan.bold("📋 Task Breakdown"));
    output.push(chalk.gray("═".repeat(60)));

    // 統計情報
    const _stats = this.calculateHierarchyStats();
    output.push(this.renderStats(_stats));
    output.push("");

    // フィルター情報
    if (this.hasActiveFilters()) {
      output.push(this.renderFilterInfo());
      output.push("");
    }

    // ルートタスクを表示
    filteredRoots.forEach((_task, _index) => {
      output.push(
        this.renderTaskHierarchy(
          _task,
          "",
          _index === _filteredRoots.length - 1,
        ),
      );
    });

    // 依存関係グラフ
    if (this.config.showDependencies) {
      output.push("");
      output.push(this.renderDependencyGraph());
    }

    output.push(chalk.gray("═".repeat(60)));

    return output.join("\n");
  }

  /**
   * タスク階層をレンダリング
   */
  private renderTaskHierarchy(
    _task: TaskHierarchy,
    prefix: string = "",
    isLast: boolean = true,
    depth: number = 0,
  ): string {
    if (depth >= this.config.maxDepth) {
      return "";
    }

    const output: string[] = [];

    // 現在のタスクをレンダリング
    output.push(this.renderTask(_task, prefix, isLast));

    // 子タスクをレンダリング
    if (task.children.length > 0) {
      const _filteredChildren = task.children.filter((child) =>
        this.passesFilter(child),
      );

      filteredChildren.forEach((child, _index) => {
        const _isChildLast = _index === _filteredChildren.length - 1;
        const _childPrefix = this.config.useTreeChars
          ? prefix + (isLast ? "    " : "│   ")
          : prefix + " ".repeat(this.config.indentSize);

        const _childOutput = this.renderTaskHierarchy(
          child,
          _childPrefix,
          _isChildLast,
          depth + 1,
        );
        if (_childOutput) {
          output.push(_childOutput);
        }
      });
    }

    return output.join("\n");
  }

  /**
   * 単一タスクをレンダリング
   */
  private renderTask(
    _task: TaskHierarchy,
    prefix: string,
    isLast: boolean,
  ): string {
    const parts: string[] = [];

    // ツリー文字
    if (this.config.useTreeChars && prefix) {
      parts.push(prefix + (isLast ? "└── " : "├── "));
    } else if (prefix) {
      parts.push(prefix);
    }

    // ステータスアイコン
    const _statusIcon = this.getStatusIcon(_task.status);
    const _statusColor = this.getStatusColor(_task.status, _task.priority);
    parts.push(_statusColor(_statusIcon));

    // 優先度インジケーター
    if (this.config.showPriority && _task.priority) {
      parts.push(this.getPriorityIndicator(_task.priority));
    }

    // タスクタイトル
    const _titleColor = this.config.colorByStatus
      ? this.getStatusColor(_task.status, _task.priority)
      : this.config.colorByPriority
        ? this.getPriorityColor(_task.priority)
        : chalk.white;

    parts.push(_titleColor(_task.title));

    // 進捗バー
    if (this.config.showProgress) {
      parts.push(this.renderMiniProgressBar(_task.progress));
    }

    // モード表示
    if (this.config.showModes && _task.mode) {
      parts.push(chalk.dim(`[${_task.mode}]`));
    }

    // タグ表示
    if (this.config.showTags && _task.tags && _task.tags.length > 0) {
      const _tagStr = _task.tags.map((tag) => chalk.blue(`#${tag}`)).join(" ");
      parts.push(_tagStr);
    }

    // 時間情報
    if (this.config.showTimestamps) {
      if (_task.estimatedTime) {
        parts.push(chalk.gray(`(est: ${_task.estimatedTime}m)`));
      }
      if (_task.actualTime) {
        parts.push(chalk.gray(`(actual: ${Math.round(_task.actualTime)}m)`));
      }
    }

    // ブロッカー表示
    if (
      this.config.showBlockers &&
      _task.blockers &&
      _task.blockers.length > 0
    ) {
      parts.push(chalk.red(`🚫 ${_task.blockers.length} blocker(s)`));
    }

    // 依存関係表示
    if (
      this.config.showDependencies &&
      _task.dependencies &&
      _task.dependencies.length > 0
    ) {
      parts.push(chalk.yellow(`⏳ ${_task.dependencies.length} dependency(s)`));
    }

    let result = parts.join(" ");

    // コンパクトモードでない場合、追加情報を次の行に表示
    if (!this.config.compactMode) {
      const additionalInfo: string[] = [];

      // ブロッカー詳細
      if (
        this.config.showBlockers &&
        _task.blockers &&
        _task.blockers.length > 0
      ) {
        task.blockers.forEach((blocker) => {
          additionalInfo.push(`${prefix}    ${chalk.red("▶")} ${blocker}`);
        });
      }

      // 依存関係詳細
      if (
        this.config.showDependencies &&
        _task.dependencies &&
        _task.dependencies.length > 0
      ) {
        task.dependencies.forEach((dep) => {
          const _depTask = this.hierarchy.get(dep);
          const _depTitle = _depTask ? _depTask.title : dep;
          additionalInfo.push(
            `${prefix}    ${chalk.yellow("◀")} ${_depTitle}`,
          );
        });
      }

      if (additionalInfo.length > 0) {
        result += `\n${additionalInfo.join("\n")}`;
      }
    }

    return result;
  }

  /**
   * ミニプログレスバーをレンダリング
   */
  private renderMiniProgressBar(_progress: number, width: number = 10): string {
    const _filled = Math.round((_progress / 100) * width);
    const _empty = width - _filled;

    const _bar =
      chalk.green("█".repeat(_filled)) + chalk.gray("░".repeat(_empty));
    return `[${_bar}] ${_progress.toFixed(0)}%`;
  }

  /**
   * 統計情報をレンダリング
   */
  private renderStats(_stats: unknown): string {
    const output: string[] = [];

    output.push(chalk.yellow("📊 Hierarchy Statistics:"));
    output.push(`  Total Tasks: ${_stats.total}`);
    output.push(`  Max Depth: ${_stats.maxDepth}`);
    output.push(
      `  Completed: ${chalk.green(_stats.completed)} (${_stats.completionRate}%)`,
    );
    output.push(`  In Progress: ${chalk.yellow(_stats.inProgress)}`);
    output.push(`  Blocked: ${chalk.red(_stats.blocked)}`);

    if (_stats.avgProgressByLevel) {
      output.push("");
      output.push(chalk.yellow("📈 Progress by Level:"));
      stats.avgProgressByLevel.forEach((_progress: number, level: number) => {
        if (_progress >= 0) {
          output.push(`  Level ${level}: ${_progress.toFixed(1)}%`);
        }
      });
    }

    return output.join("\n");
  }

  /**
   * フィルター情報をレンダリング
   */
  private renderFilterInfo(): string {
    const filters: string[] = [];

    if (this.filter.status && this.filter.status.length > 0) {
      filters.push(`Status: ${this.filter.status.join(", ")}`);
    }

    if (this.filter.priority && this.filter.priority.length > 0) {
      filters.push(`Priority: ${this.filter.priority.join(", ")}`);
    }

    if (this.filter.tags && this.filter.tags.length > 0) {
      filters.push(`Tags: ${this.filter.tags.map((t) => `#${t}`).join(", ")}`);
    }

    if (this.filter.textFilter) {
      filters.push(`Text: "${this.filter.textFilter}"`);
    }

    return chalk.blue("🔍 Active Filters: ") + chalk.gray(filters.join(" | "));
  }

  /**
   * 依存関係グラフをレンダリング
   */
  private renderDependencyGraph(): string {
    const output: string[] = [];
    output.push(chalk.yellow("🔗 Dependency Graph:"));

    const _tasksWithDeps = Array.from(this.hierarchy.values()).filter(
      (_task) => _task.dependencies && _task.dependencies.length > 0,
    );

    if (_tasksWithDeps.length === 0) {
      output.push(chalk.gray("  No dependencies found"));
      return output.join("\n");
    }

    tasksWithDeps.forEach((_task) => {
      output.push(`  ${_task.title}:`);
      task.dependencies!.forEach((depId) => {
        const _depTask = this.hierarchy.get(depId);
        const _depTitle = _depTask ? _depTask.title : depId;
        const _depStatus = _depTask ? this.getStatusIcon(_depTask.status) : "?";
        output.push(`    ← ${_depStatus} ${_depTitle}`);
      });
    });

    return output.join("\n");
  }

  /**
   * 階層統計を計算
   */
  private calculateHierarchyStats() {
    const _allTasks = Array.from(this.hierarchy.values());
    const _total = _allTasks.length;
    const _completed = _allTasks.filter(
      (t) => t.status === "_completed",
    ).length;
    const _inProgress = _allTasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const _blocked = _allTasks.filter(
      (t) => t.blockers && t.blockers.length > 0,
    ).length;
    const _completionRate =
      _total > 0 ? Math.round((_completed / _total) * 100) : 0;

    const _maxDepth = Math.max(..._allTasks.map((t) => t.level), 0);

    // レベル別平均進捗
    const avgProgressByLevel: number[] = [];
    for (let level = 0; level <= _maxDepth; level++) {
      const _tasksAtLevel = _allTasks.filter((t) => t.level === level);
      if (_tasksAtLevel.length > 0) {
        const _avgProgress =
          _tasksAtLevel.reduce((sum, t) => sum + t.progress, 0) /
          _tasksAtLevel.length;
        avgProgressByLevel[level] = _avgProgress;
      } else {
        avgProgressByLevel[level] = -1; // No tasks at this level
      }
    }

    return {
      _total,
      _completed,
      _inProgress,
      _blocked,
      _completionRate,
      _maxDepth,
      avgProgressByLevel,
    };
  }

  /**
   * フィルターをチェック
   */
  private passesFilter(_task: TaskHierarchy): boolean {
    // ステータスフィルター
    if (this.filter.status && !this.filter.status.includes(_task.status)) {
      return false;
    }

    // 優先度フィルター
    if (
      this.filter.priority &&
      _task.priority &&
      !this.filter.priority.includes(_task.priority)
    ) {
      return false;
    }

    // タグフィルター
    if (this.filter.tags && this.filter.tags.length > 0) {
      const _hasMatchingTag = _task.tags?.some((tag) =>
        this.filter.tags!.includes(tag),
      );
      if (!_hasMatchingTag) {
        return false;
      }
    }

    // モードフィルター
    if (
      this.filter.modes &&
      _task.mode &&
      !this.filter.modes.includes(_task.mode)
    ) {
      return false;
    }

    // 完了タスク表示設定
    if (!this.filter.showCompleted && _task.status === "_completed") {
      return false;
    }

    // ブロックタスク表示設定
    if (
      !this.filter.showBlocked &&
      _task.blockers &&
      _task.blockers.length > 0
    ) {
      return false;
    }

    // テキストフィルター
    if (this.filter.textFilter) {
      const _searchText = this.filter.textFilter.toLowerCase();
      const _titleMatch = _task.title.toLowerCase().includes(_searchText);
      const _tagMatch = _task.tags?.some((tag) =>
        tag.toLowerCase().includes(_searchText),
      );
      if (!_titleMatch && !_tagMatch) {
        return false;
      }
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
      pending: "○",
      inprogress: "◉",
      _completed: "✓",
      error: "✗",
      skipped: "⊘",
    };
    return icons[status];
  }

  private getStatusColor(_status: TaskStatus, priority?: string): typeof chalk {
    if (this.config.colorByPriority && priority) {
      return this.getPriorityColor(priority);
    }

    const colors: Record<TaskStatus, typeof chalk> = {
      pending: chalk.gray,
      inprogress: chalk.yellow,
      _completed: chalk.green,
      error: chalk.red,
      skipped: chalk.blue,
    };
    return colors[_status];
  }

  private getPriorityIndicator(priority: string): string {
    const indicators: Record<string, string> = {
      low: chalk.gray("◇"),
      medium: chalk.yellow("◆"),
      high: chalk.yellowBright("◆"),
      critical: chalk.red("◆"),
    };
    return indicators[priority] || "";
  }

  private getPriorityColor(priority?: string): typeof chalk {
    if (!priority) {
      return chalk.white;
    }

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
    const _searchTerm = query.toLowerCase();
    return Array.from(this.hierarchy.values()).filter(
      (_task) =>
        _task.title.toLowerCase().includes(_searchTerm) ||
        task.tags?.some((tag) => tag.toLowerCase().includes(_searchTerm)),
    );
  }

  /**
   * パス取得
   */
  getTaskPath(taskId: string): string[] {
    const _path: string[] = [];
    let current = this.hierarchy.get(taskId);

    while (current) {
      path.unshift(current.title);
      current = current.parent ? this.hierarchy.get(current.parent) : undefined;
    }

    return _path;
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
