/**
 * ResponseRenderer Component
 * AI応答を内部モードと共に表示
 */

import chalk from "chalk";
import { InternalMode } from "./ModeIndicator.js";
import { OptimizedAnimations } from "../animations/OptimizedAnimations.js";
import {
  TEXT_HIERARCHY,
  _UNIFIED_COLORS,
} from "../design-system/UnifiedColorPalette.js";
import { OptimizedProgress } from "../components/OptimizedProgress.js";

/**
 * レスポンス設定
 */
export interface ResponseConfig {
  showMode?: boolean;
  showTimestamp?: boolean;
  showProgress?: boolean;
  animateText?: boolean;
  maxWidth?: number;
}

/**
 * タスク進捗情報
 */
export interface TaskProgress {
  taskName: string;
  current: number;
  total: number;
  status: "pending" | "running" | "completed" | "error";
  detail?: string;
}

/**
 * レスポンスレンダラークラス
 */
export class ResponseRenderer {
  private currentMode: InternalMode = "✽ Thinking...";
  private config: ResponseConfig;
  private activeTask: TaskProgress | null = null;
  private messageHistory: Array<{
    mode: InternalMode;
    content: string;
    _timestamp: Date;
  }> = [];

  constructor(_config: ResponseConfig = {}) {
    this._config = {
      showMode: _config.showMode !== false,
      showTimestamp: _config.showTimestamp !== false,
      showProgress: _config.showProgress !== false,
      animateText: _config.animateText || false,
      maxWidth: _config.maxWidth || 124,
    };
  }

  /**
   * モードと共にレスポンスを表示
   */
  async renderWithMode(
    content: string,
    mode?: InternalMode,
    options: {
      animate?: boolean;
      _color?: typeof chalk;
      section?: boolean;
    } = {},
  ): Promise<void> {
    const _displayMode = mode || this.currentMode;

    // Update current mode
    if (mode) {
      this.currentMode = mode;
    }

    // Add to history
    this.messageHistory.push({
      mode: _displayMode,
      content,
      _timestamp: new Date(),
    });

    // Render header with mode
    if (this.config.showMode) {
      this.renderModeHeader(_displayMode);
    }

    // Render content
    if (options.section) {
      this.renderSection(content, options.color);
    } else if (options.animate && this.config.animateText) {
      await this.renderAnimated(content, options.color);
    } else {
      this.renderPlain(content, options.color);
    }

    // Render progress if active
    if (this.config.showProgress && this.activeTask) {
      this.renderTaskProgress();
    }

    // Add spacing
    console.log();
  }

  /**
   * モードヘッダーを表示
   */
  private renderModeHeader(mode: InternalMode): void {
    const _modeColor = this.getModeColor(mode);
    const _modeDisplay = _modeColor(`[${mode}]`);

    let header = _modeDisplay;

    if (this.config.showTimestamp) {
      const _timestamp = chalk.gray(new Date().toLocaleTimeString());
      header += ` ${_timestamp}`;
    }

    console.log(header);
  }

  /**
   * セクションとして表示
   */
  private renderSection(_content: string, _color?: typeof chalk): void {
    const _divider = chalk.gray("━".repeat(60));
    console.log(_divider);
    console.log((_color || TEXT_HIERARCHY.BODY)(_content));
    console.log(_divider);
  }

  /**
   * アニメーション付きで表示
   */
  private async renderAnimated(
    _content: string,
    _color?: typeof chalk,
  ): Promise<void> {
    await OptimizedAnimations.typewriter(_content, {
      speed: 30,
      _color: _color || TEXT_HIERARCHY.BODY,
    });
  }

  /**
   * プレーンテキストとして表示
   */
  private renderPlain(_content: string, _color?: typeof chalk): void {
    console.log((_color || TEXT_HIERARCHY.BODY)(_content));
  }

  /**
   * タスク進捗を表示
   */
  private renderTaskProgress(): void {
    if (!this.activeTask) {
      return;
    }

    const { taskName, current, total, status, detail } = this.activeTask;

    // Status _icon
    const _statusIcon = this.getStatusIcon(status);

    // Progress bar
    OptimizedProgress.renderBar(current, total, {
      label: `${_statusIcon} ${taskName}`,
      showPercentage: true,
      width: 50,
    });

    // Detail if provided
    if (detail) {
      console.log(chalk.gray(`  └─ ${detail}`));
    }
  }

  /**
   * タスクリストを表示
   */
  renderTaskList(
    tasks: Array<{ name: string; status: "pending" | "completed" | "skipped" }>,
  ): void {
    console.log(chalk.bold("\n📋 Task Breakdown:"));
    console.log(chalk.gray("━".repeat(60)));

    tasks.forEach((task, _index) => {
      const _icon = this.getTaskIcon(task.status);
      const _color = this.getTaskColor(task.status);
      console.log(`  ${_index + 1}. ${_icon} ${_color(task.name)}`);
    });

    console.log(chalk.gray("━".repeat(60)));
  }

  /**
   * コードブロックを表示
   */
  renderCodeBlock(_code: string, language: string = "typescript"): void {
    console.log(chalk.gray(`\`\`\`\${language}`));
    console.log(chalk.cyan(_code));
    console.log(chalk.gray("```"));
  }

  /**
   * エラーメッセージを表示
   */
  renderError(_error: string, details?: string): void {
    console.log(chalk.red.bold("\n❌ Error:"), chalk.red(_error));
    if (details) {
      console.log(chalk.gray("Details:"), chalk.gray(details));
    }
  }

  /**
   * 成功メッセージを表示
   */
  renderSuccess(_message: string, summary?: string[]): void {
    console.log(chalk.green.bold("\n✓ Success:"), chalk.green(_message));

    if (summary && summary.length > 0) {
      console.log(chalk.gray("\nSummary:"));
      summary.forEach((_item) => {
        console.log(chalk.gray("  •"), _item);
      });
    }
  }

  /**
   * 警告メッセージを表示
   */
  renderWarning(warning: string): void {
    console.log(chalk.yellow.bold("\n⚠ Warning:"), chalk.yellow(warning));
  }

  /**
   * 情報メッセージを表示
   */
  renderInfo(info: string): void {
    console.log(chalk.blue.bold("\nℹ Info:"), chalk.blue(info));
  }

  /**
   * 思考プロセスを表示
   */
  async renderThinkingProcess(steps: string[]): Promise<void> {
    for (const step of steps) {
      const _spinner = OptimizedAnimations._spinner(step);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      spinner.stop(true);
    }
  }

  /**
   * 分析結果を表示
   */
  renderAnalysis(
    _title: string,
    sections: Array<{ heading: string; content: string[] }>,
  ): void {
    console.log(chalk.bold.cyan(`\n📊 ${_title}`));
    console.log(chalk.gray("═".repeat(60)));

    sections.forEach((section) => {
      console.log(chalk.bold(`\n${section.heading}:`));
      section.content.forEach((_item) => {
        console.log(`  • ${_item}`);
      });
    });

    console.log(chalk.gray("═".repeat(60)));
  }

  /**
   * モードに応じた色を取得
   */
  private getModeColor(mode: InternalMode): typeof chalk {
    const modeColors: Record<string, typeof chalk> = {
      Thinking: chalk.yellow,
      "Ultra Thinking": chalk.yellowBright,
      Coding: chalk.cyan,
      Debugging: chalk.red,
      Optimizing: chalk.green,
      Testing: chalk.blue,
      Planning: chalk.magenta,
      Researching: chalk.blueBright,
      Reviewing: chalk.greenBright,
      Documenting: chalk.gray,
    };

    // Extract base mode name (remove ✽ and ...)
    const _baseMode = mode.replace(/^✽\s*/, "").replace(/...$2.$/, "");
    return modeColors[_baseMode] || chalk.yellow;
  }

  /**
   * ステータスアイコンを取得
   */
  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: "○",
      running: "◉",
      completed: "✓",
      error: "✗",
    };
    return icons[status] || "•";
  }

  /**
   * タスクアイコンを取得
   */
  private getTaskIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: "☐",
      completed: "☑",
      skipped: "⊘",
    };
    return icons[status] || "○";
  }

  /**
   * タスク色を取得
   */
  private getTaskColor(status: string): typeof chalk {
    const colors: Record<string, typeof chalk> = {
      pending: chalk.gray,
      completed: chalk.green,
      skipped: chalk.yellow,
    };
    return colors[status] || chalk.white;
  }

  /**
   * アクティブタスクを設定
   */
  setActiveTask(task: TaskProgress | null): void {
    this.activeTask = task;
  }

  /**
   * 現在のモードを取得
   */
  getCurrentMode(): InternalMode {
    return this.currentMode;
  }

  /**
   * モードを更新
   */
  updateMode(mode: InternalMode): void {
    this.currentMode = mode;
  }

  /**
   * 履歴をクリア
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * 履歴を取得
   */
  getHistory(): Array<{
    mode: InternalMode;
    content: string;
    _timestamp: Date;
  }> {
    return [...this.messageHistory];
  }

  /**
   * コンテンツを追加
   */
  addContent(content: string): void {
    this.messageHistory.push({
      mode: this.currentMode,
      content,
      _timestamp: new Date(),
    });
  }

  /**
   * モードを設定
   */
  setMode(mode: InternalMode): void {
    this.currentMode = mode;
  }

  /**
   * レスポンスをレンダリング
   */
  render(): string {
    if (this.messageHistory.length === 0) {
      return chalk.gray("No responses yet");
    }

    const output: string[] = [];

    // ヘッダー
    output.push(chalk.cyan("Response History:"));
    output.push(chalk.gray("─".repeat(50)));

    // メッセージ履歴を表示
    this.messageHistory.forEach((message, _index) => {
      const _modeColor = this.getModeColor(message.mode);
      const _timestamp = chalk.gray(
        `[${message._timestamp.toLocaleTimeString()}]`,
      );
      output.push(
        `${_timestamp} ${_modeColor(message.mode)}: ${message.content}`,
      );
    });

    return output.join("\n");
  }
}

export default ResponseRenderer;
