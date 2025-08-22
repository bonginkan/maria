/**
 * ResponseRenderer Component
 * AI応答を内部モードと共に表示
 */

import chalk from 'chalk';
import { InternalMode } from './ModeIndicator.js';
import { OptimizedAnimations } from '../animations/OptimizedAnimations.js';
import { TEXT_HIERARCHY, UNIFIED_COLORS } from '../design-system/UnifiedColorPalette.js';
import { OptimizedProgress } from '../components/OptimizedProgress.js';

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
  status: 'pending' | 'running' | 'completed' | 'error';
  detail?: string;
}

/**
 * レスポンスレンダラークラス
 */
export class ResponseRenderer {
  private currentMode: InternalMode = '✽ Thinking...';
  private config: ResponseConfig;
  private activeTask: TaskProgress | null = null;
  private messageHistory: Array<{ mode: InternalMode; content: string; timestamp: Date }> = [];

  constructor(config: ResponseConfig = {}) {
    this.config = {
      showMode: config.showMode !== false,
      showTimestamp: config.showTimestamp !== false,
      showProgress: config.showProgress !== false,
      animateText: config.animateText || false,
      maxWidth: config.maxWidth || 124,
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
      color?: typeof chalk;
      section?: boolean;
    } = {},
  ): Promise<void> {
    const displayMode = mode || this.currentMode;

    // Update current mode
    if (mode) {
      this.currentMode = mode;
    }

    // Add to history
    this.messageHistory.push({
      mode: displayMode,
      content,
      timestamp: new Date(),
    });

    // Render header with mode
    if (this.config.showMode) {
      this.renderModeHeader(displayMode);
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
    const modeColor = this.getModeColor(mode);
    const modeDisplay = modeColor(`[${mode}]`);

    let header = modeDisplay;

    if (this.config.showTimestamp) {
      const timestamp = chalk.gray(new Date().toLocaleTimeString());
      header += ` ${timestamp}`;
    }

    console.log(header);
  }

  /**
   * セクションとして表示
   */
  private renderSection(content: string, color?: typeof chalk): void {
    const divider = chalk.gray('━'.repeat(60));
    console.log(divider);
    console.log((color || TEXT_HIERARCHY.BODY)(content));
    console.log(divider);
  }

  /**
   * アニメーション付きで表示
   */
  private async renderAnimated(content: string, color?: typeof chalk): Promise<void> {
    await OptimizedAnimations.typewriter(content, {
      speed: 30,
      color: color || TEXT_HIERARCHY.BODY,
    });
  }

  /**
   * プレーンテキストとして表示
   */
  private renderPlain(content: string, color?: typeof chalk): void {
    console.log((color || TEXT_HIERARCHY.BODY)(content));
  }

  /**
   * タスク進捗を表示
   */
  private renderTaskProgress(): void {
    if (!this.activeTask) {return;}

    const { taskName, current, total, status, detail } = this.activeTask;

    // Status icon
    const statusIcon = this.getStatusIcon(status);

    // Progress bar
    OptimizedProgress.renderBar(current, total, {
      label: `${statusIcon} ${taskName}`,
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
    tasks: Array<{ name: string; status: 'pending' | 'completed' | 'skipped' }>,
  ): void {
    console.log(chalk.bold('\n📋 Task Breakdown:'));
    console.log(chalk.gray('━'.repeat(60)));

    tasks.forEach((task, index) => {
      const icon = this.getTaskIcon(task.status);
      const color = this.getTaskColor(task.status);
      console.log(`  ${index + 1}. ${icon} ${color(task.name)}`);
    });

    console.log(chalk.gray('━'.repeat(60)));
  }

  /**
   * コードブロックを表示
   */
  renderCodeBlock(code: string, language: string = 'typescript'): void {
    console.log(chalk.gray(`\`\`\`${language}`));
    console.log(chalk.cyan(code));
    console.log(chalk.gray('```'));
  }

  /**
   * エラーメッセージを表示
   */
  renderError(error: string, details?: string): void {
    console.log(chalk.red.bold('\n❌ Error:'), chalk.red(error));
    if (details) {
      console.log(chalk.gray('Details:'), chalk.gray(details));
    }
  }

  /**
   * 成功メッセージを表示
   */
  renderSuccess(message: string, summary?: string[]): void {
    console.log(chalk.green.bold('\n✓ Success:'), chalk.green(message));

    if (summary && summary.length > 0) {
      console.log(chalk.gray('\nSummary:'));
      summary.forEach((item) => {
        console.log(chalk.gray('  •'), item);
      });
    }
  }

  /**
   * 警告メッセージを表示
   */
  renderWarning(warning: string): void {
    console.log(chalk.yellow.bold('\n⚠ Warning:'), chalk.yellow(warning));
  }

  /**
   * 情報メッセージを表示
   */
  renderInfo(info: string): void {
    console.log(chalk.blue.bold('\nℹ Info:'), chalk.blue(info));
  }

  /**
   * 思考プロセスを表示
   */
  async renderThinkingProcess(steps: string[]): Promise<void> {
    for (const step of steps) {
      const spinner = OptimizedAnimations.spinner(step);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      spinner.stop(true);
    }
  }

  /**
   * 分析結果を表示
   */
  renderAnalysis(title: string, sections: Array<{ heading: string; content: string[] }>): void {
    console.log(chalk.bold.cyan(`\n📊 ${title}`));
    console.log(chalk.gray('═'.repeat(60)));

    sections.forEach((section) => {
      console.log(chalk.bold(`\n${section.heading}:`));
      section.content.forEach((item) => {
        console.log(`  • ${item}`);
      });
    });

    console.log(chalk.gray('═'.repeat(60)));
  }

  /**
   * モードに応じた色を取得
   */
  private getModeColor(mode: InternalMode): typeof chalk {
    const modeColors: Record<string, typeof chalk> = {
      Thinking: chalk.yellow,
      'Ultra Thinking': chalk.yellowBright,
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
    const baseMode = mode.replace(/^✽\s*/, '').replace(/\.\.\.$/, '');
    return modeColors[baseMode] || chalk.yellow;
  }

  /**
   * ステータスアイコンを取得
   */
  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: '○',
      running: '◉',
      completed: '✓',
      error: '✗',
    };
    return icons[status] || '•';
  }

  /**
   * タスクアイコンを取得
   */
  private getTaskIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: '☐',
      completed: '☑',
      skipped: '⊘',
    };
    return icons[status] || '○';
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
  getHistory(): Array<{ mode: InternalMode; content: string; timestamp: Date }> {
    return [...this.messageHistory];
  }

  /**
   * コンテンツを追加
   */
  addContent(content: string): void {
    this.messageHistory.push({
      mode: this.currentMode,
      content,
      timestamp: new Date(),
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
      return chalk.gray('No responses yet');
    }

    const output: string[] = [];

    // ヘッダー
    output.push(chalk.cyan('Response History:'));
    output.push(chalk.gray('─'.repeat(50)));

    // メッセージ履歴を表示
    this.messageHistory.forEach((message, index) => {
      const modeColor = this.getModeColor(message.mode);
      const timestamp = chalk.gray(`[${message.timestamp.toLocaleTimeString()}]`);
      output.push(`${timestamp} ${modeColor(message.mode)}: ${message.content}`);
    });

    return output.join('\n');
  }
}

export default ResponseRenderer;
