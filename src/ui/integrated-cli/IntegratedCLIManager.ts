/**
 * IntegratedCLIManager
 * 統合CLIシステムのメインマネージャー
 */

import chalk from "chalk";
import { InputBox } from "./InputBox.js";
import { ResponseRenderer } from "./ResponseRenderer.js";
import { InternalMode, ModeIndicator } from "./ModeIndicator.js";
import { LayoutEngine, LayoutZone } from "./LayoutEngine.js";

/**
 * 統合CLI設定
 */
export interface IntegratedCLIConfig {
  _input?: {
    promptSymbol?: string;
    multilineMode?: boolean;
  };
  response?: {
    showInternalMode?: boolean;
    showProgressBar?: boolean;
    showTimestamp?: boolean;
    animateText?: boolean;
  };
  layout?: {
    _width?: number;
    responsive?: boolean;
  };
}

/**
 * CLIイベント
 */
export interface CLIEvent {
  type:
    | "_input"
    | "mode_change"
    | "task_start"
    | "task_complete"
    | "error"
    | "response";
  data: Record<string, unknown>;
  timestamp: Date;
}

/**
 * 統合CLIマネージャークラス
 */
export class IntegratedCLIManager {
  private inputBox: InputBox;
  private responseRenderer: ResponseRenderer;
  private modeIndicator: ModeIndicator;
  private layoutEngine: LayoutEngine;
  private config: IntegratedCLIConfig;
  private isActive: boolean = false;
  private eventHandlers: Map<string, Array<(event: CLIEvent) => void>> =
    new Map();
  private commandHistory: string[] = [];
  private historyIndex: number = 0;
  private inputPrompt?: string;

  constructor(_config: IntegratedCLIConfig = {}) {
    this._config = _config;

    // Initialize components
    this.layoutEngine = new LayoutEngine({
      _width: _config.layout?.width,
      responsive: _config.layout?.responsive,
    });

    this.inputBox = new InputBox({
      promptSymbol: _config.input?.promptSymbol,
      multiline: _config.input?.multilineMode,
    });

    this.responseRenderer = new ResponseRenderer({
      showMode: _config.response?.showInternalMode,
      showTimestamp: _config.response?.showTimestamp,
      showProgress: _config.response?.showProgressBar,
      animateText: _config.response?.animateText,
    });

    this.modeIndicator = new ModeIndicator();

    // Setup mode update callback
    this.modeIndicator.onUpdate((mode) => {
      this.emitEvent({
        type: "mode_change",
        data: { mode },
        timestamp: new Date(),
      });
    });
  }

  /**
   * CLIを初期化
   */
  async initialize(): Promise<void> {
    // Comprehensive screen clear to prevent artifacts
    process.stdout.write("\u001b[2J\u001b[H"); // Clear entire screen and move to top
    process.stdout.write("\u001b[3J"); // Clear scrollback buffer

    // Clear screen
    this.layoutEngine.clearScreen();

    // Show welcome message
    this.showWelcome();

    // Set initial mode
    await this.setMode("✽ Thinking...");

    this.isActive = true;
  }

  /**
   * ウェルカムメッセージを表示
   */
  private showWelcome(): void {
    const _width = this.layoutEngine.getAvailableWidth();
    const _border = chalk.cyan("═".repeat(_width));

    console.log(chalk.cyan(`╔${_border.substring(2)}╗`));
    console.log(
      chalk.cyan("║") +
        this.centerText("MARIA CODE", _width - 2, chalk.bold.magenta) +
        chalk.cyan("║"),
    );
    console.log(
      chalk.cyan("║") +
        this.centerText("Integrated CLI System v1.0", _width - 2, chalk.gray) +
        chalk.cyan("║"),
    );
    console.log(chalk.cyan(`╚${_border.substring(2)}╝`));
    console.log();
  }

  /**
   * ユーザー入力を取得
   */
  async getUserInput(): Promise<string> {
    // Place _input box in its zone
    this.layoutEngine.moveCursorToZone(LayoutZone.INPUT);

    // Render and activate _input box
    const _input = await this.inputBox.activate();

    // Add to history
    if (_input && _input.trim()) {
      this.commandHistory.push(_input);
      this.historyIndex = this.commandHistory.length;
    }

    // Emit _input event
    this.emitEvent({
      type: "_input",
      data: { _input },
      timestamp: new Date(),
    });

    return _input;
  }

  /**
   * AI応答を表示
   */
  async displayResponse(
    content: string,
    mode?: InternalMode,
    options: {
      animate?: boolean;
      section?: boolean;
      color?: typeof chalk;
    } = {},
  ): Promise<void> {
    // Update mode if provided
    if (mode) {
      await this.setMode(mode);
    }

    // Move to response zone
    this.layoutEngine.moveCursorToZone(LayoutZone.RESPONSE);

    // Render response with current mode
    await this.responseRenderer.renderWithMode(
      content,
      mode || this.modeIndicator.getCurrentMode(),
      options,
    );
  }

  /**
   * モードを設定
   */
  async setMode(_mode: InternalMode, animate: boolean = true): Promise<void> {
    // Transition to new mode
    await this.modeIndicator.transitionTo(_mode, animate);

    // Update mode display
    this.layoutEngine.moveCursorToZone(LayoutZone.MODE);
    this.modeIndicator.display(true);

    // Update response renderer's mode
    this.responseRenderer.updateMode(_mode);
  }

  /**
   * タスクリストを表示
   */
  displayTaskList(
    tasks: Array<{ name: string; status: "pending" | "completed" | "skipped" }>,
  ): void {
    this.responseRenderer.renderTaskList(tasks);
  }

  /**
   * 進捗を表示
   */
  displayProgress(
    _taskName: string,
    current: number,
    total: number,
    detail?: string,
  ): void {
    this.responseRenderer.setActiveTask({
      taskName: "",
      current,
      total,
      status: "running",
      detail,
    });

    // Move to progress zone and render
    this.layoutEngine.moveCursorToZone(LayoutZone.PROGRESS);
    this.responseRenderer.renderWithMode(
      "",
      this.modeIndicator.getCurrentMode(),
    );
  }

  /**
   * コードブロックを表示
   */
  displayCode(_code: string, language: string = "typescript"): void {
    this.responseRenderer.renderCodeBlock(_code, language);
  }

  /**
   * エラーを表示
   */
  displayError(_error: string, details?: string): void {
    this.responseRenderer.renderError(_error, details);

    this.emitEvent({
      type: "error",
      data: { _error, details },
      timestamp: new Date(),
    });
  }

  /**
   * 成功メッセージを表示
   */
  displaySuccess(_message: string, summary?: string[]): void {
    this.responseRenderer.renderSuccess(_message, summary);
  }

  /**
   * 警告を表示
   */
  displayWarning(warning: string): void {
    this.responseRenderer.renderWarning(warning);
  }

  /**
   * 情報を表示
   */
  displayInfo(info: string): void {
    this.responseRenderer.renderInfo(info);
  }

  /**
   * レスポンスを追加
   */
  addResponse(content: string): void {
    this.responseRenderer.addContent(content);
    this.emitEvent({
      type: "response",
      data: { content },
      timestamp: new Date(),
    });
  }

  /**
   * 入力プロンプトを設定
   */
  setInputPrompt(prompt: string): void {
    this.inputPrompt = prompt;
    this.inputBox.setPlaceholder(prompt);
  }

  /**
   * 思考プロセスを表示
   */
  async displayThinkingProcess(steps: string[]): Promise<void> {
    await this.setMode("✽ Thinking...");
    await this.responseRenderer.renderThinkingProcess(steps);
  }

  /**
   * 分析結果を表示
   */
  displayAnalysis(
    _title: string,
    sections: Array<{ heading: string; content: string[] }>,
  ): void {
    this.responseRenderer.renderAnalysis(_title, sections);
  }

  /**
   * セッションをクリア
   */
  clearSession(): void {
    this.layoutEngine.clearScreen();
    this.responseRenderer.clearHistory();
    this.modeIndicator.reset();
    this.inputBox.clear();
  }

  /**
   * ゾーンをクリア
   */
  clearZone(zone: LayoutZone): void {
    this.layoutEngine.clearZone(zone);
  }

  /**
   * イベントハンドラーを登録
   */
  on(_eventType: string, handler: (event: CLIEvent) => void): void {
    if (!this.eventHandlers.has(_eventType)) {
      this.eventHandlers.set(_eventType, []);
    }
    this.eventHandlers.get(_eventType)?.push(handler);
  }

  /**
   * イベントハンドラーを削除
   */
  off(_eventType: string, handler: (event: CLIEvent) => void): void {
    const _handlers = this.eventHandlers.get(_eventType);
    if (_handlers) {
      const _index = _handlers.indexOf(handler);
      if (_index > -1) {
        handlers.splice(_index, 1);
      }
    }
  }

  /**
   * イベントを発行
   */
  private emitEvent(event: CLIEvent): void {
    const _handlers = this.eventHandlers.get(event.type);
    if (_handlers) {
      handlers.forEach((handler) => handler(event));
    }
  }

  /**
   * テキストを中央揃え
   */
  private centerText(
    _text: string,
    _width: number,
    colorFn?: (text: string) => string,
  ): string {
    const _padding = Math.max(0, Math.floor((_width - _text.length) / 2));
    const _rightPadding = Math.max(0, _width - _text.length - _padding);
    const _coloredText = colorFn ? colorFn(_text) : _text;
    return " ".repeat(_padding) + _coloredText + " ".repeat(_rightPadding);
  }

  /**
   * 履歴を取得
   */
  getHistory(): string[] {
    return [...this.commandHistory];
  }

  /**
   * 現在のモードを取得
   */
  getCurrentMode(): InternalMode {
    return this.modeIndicator.getCurrentMode();
  }

  /**
   * モード履歴を取得
   */
  getModeHistory(): Array<{ mode: InternalMode; timestamp: Date }> {
    return this.modeIndicator.getHistory();
  }

  /**
   * レスポンス履歴を取得
   */
  getResponseHistory(): Array<{
    mode: InternalMode;
    content: string;
    timestamp: Date;
  }> {
    return this.responseRenderer.getHistory();
  }

  /**
   * アクティブかチェック
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * シャットダウン
   */
  shutdown(): void {
    this.isActive = false;
    this.inputBox.deactivate();
    this.clearSession();
    console.log(chalk.gray("\nCLI session ended."));
  }

  /**
   * デバッグ情報を表示
   */
  debug(): void {
    console.log(chalk.yellow("\n=== Debug Information ==="));
    console.log(
      chalk.gray("Current Mode:"),
      this.modeIndicator.getCurrentMode(),
    );
    console.log(
      chalk.gray("Command History:"),
      this.commandHistory.length,
      "commands",
    );
    console.log(chalk.gray("Active:"), this.isActive);
    this.layoutEngine.debug();
    console.log(chalk.yellow("========================\n"));
  }

  /**
   * CLI全体をレンダリング
   */
  render(): string {
    const output: string[] = [];

    // ヘッダー
    output.push(chalk.cyan.bold("MARIA Integrated CLI Manager Status:"));
    output.push(chalk.gray("═".repeat(60)));

    // 現在の状態
    output.push(`Current Mode: ${this.modeIndicator.render()}`);
    output.push(
      `Active: ${this.isActive ? chalk.green("Yes") : chalk.red("No")}`,
    );
    output.push(`Commands in History: ${this.commandHistory.length}`);
    output.push(
      `Responses in History: ${this.responseRenderer.getHistory().length}`,
    );

    // 区切り線
    output.push(chalk.gray("─".repeat(60)));

    // 入力プロンプト状態
    if (this.inputPrompt) {
      output.push(`Input Prompt: "${this.inputPrompt}"`);
    }

    // レイアウト情報
    output.push("\nLayout Engine:");
    output.push(this.layoutEngine.render());

    return output.join("\n");
  }
}

export default IntegratedCLIManager;
