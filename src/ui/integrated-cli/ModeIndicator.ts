/**
 * BrainIndicator Component
 * 🧠 50種類の内部脳モード管理と表示
 */

import chalk from "chalk";

/**
 * 🧠 内部脳モード型定義
 */
export type InternalBrainMode =
  // 🧠 基本推論系 (10)
  | "🧠 Thinking..."
  | "🧠 Ultra Thinking..."
  | "🧠 Deep Thinking..."
  | "🧠 Researching..."
  | "🧠 Analyzing..."
  | "🧠 Evaluating..."
  | "🧠 Reasoning..."
  | "🧠 Contemplating..."
  | "🧠 Reflecting..."
  | "🧠 Processing..."
  // 🧠 創造系 (10)
  | "🧠 Creating..."
  | "🧠 Brainstorming..."
  | "🧠 Inventing..."
  | "🧠 Designing..."
  | "🧠 Drafting..."
  | "🧠 Imagining..."
  | "🧠 Conceptualizing..."
  | "🧠 Innovating..."
  | "🧠 Ideating..."
  | "🧠 Synthesizing..."
  // 🧠 実装系 (10)
  | "🧠 Coding..."
  | "🧠 Building..."
  | "🧠 Implementing..."
  | "🧠 Developing..."
  | "🧠 Programming..."
  | "🧠 Constructing..."
  | "🧠 Architecting..."
  | "🧠 Engineering..."
  | "🧠 Assembling..."
  | "🧠 Integrating..."
  // 🧠 検証系 (10)
  | "🧠 Testing..."
  | "🧠 Debugging..."
  | "🧠 Validating..."
  | "🧠 Reviewing..."
  | "🧠 Checking..."
  | "🧠 Verifying..."
  | "🧠 Inspecting..."
  | "🧠 Auditing..."
  | "🧠 Examining..."
  | "🧠 Troubleshooting..."
  // 🧠 最適化系 (10)
  | "🧠 Optimizing..."
  | "🧠 Refactoring..."
  | "🧠 Improving..."
  | "🧠 Enhancing..."
  | "🧠 Streamlining..."
  | "🧠 Polishing..."
  | "🧠 Tuning..."
  | "🧠 Perfecting..."
  | "🧠 Documenting..."
  | "🧠 Planning..."
  // 🧠 新規追加脳モード (8) - v2.0.0で追加
  | "🔬 DeepResearch..."
  | "🎯 PrecisionCoding..."
  | "🌊 FlowState..."
  | "🔮 Predictive..."
  | "🎨 CreativeFlow..."
  | "🏗️ Architectural..."
  | "🔍 Forensic..."
  | "⚡ RapidPrototype...";

/**
 * 🧠 脳モードカテゴリー
 */
export enum BrainCategory {
  REASONING = "reasoning",
  CREATIVE = "creative",
  IMPLEMENTATION = "implementation",
  VALIDATION = "validation",
  OPTIMIZATION = "optimization",
}

/**
 * 内部モード型の別名(後方互換性のため)
 */
export type InternalMode = InternalBrainMode;

/**
 * モードカテゴリ型の別名(後方互換性のため)
 */
export type ModeCategory = BrainCategory;

/**
 * 🧠 脳モード情報
 */
interface BrainInfo {
  mode: InternalBrainMode;
  category: BrainCategory;
  intensity: "low" | "medium" | "high" | "maximum";
  color: typeof chalk;
}

/**
 * 🧠 脳インジケータークラス
 */
export class BrainIndicator {
  private currentBrainMode: InternalBrainMode = "🧠 Thinking...";
  private brainHistory: Array<{ _mode: InternalBrainMode; timestamp: Date }> =
    [];
  private brainTransitions: Map<InternalBrainMode, InternalBrainMode[]> =
    new Map();
  private isAnimating: boolean = false;
  private updateCallbacks: Array<(_mode: InternalBrainMode) => void> = [];
  private loopAnimationInterval: NodeJS.Timeout | null = null;
  private currentDots: number = 0;

  // 🧠 脳モード情報マッピング
  private brainInfo: Map<InternalBrainMode, BrainInfo> = new Map([
    // 🧠 Reasoning brain modes
    [
      "🧠 Thinking...",
      {
        mode: "🧠 Thinking...",
        category: BrainCategory.REASONING,
        intensity: "medium",
        color: chalk.yellow,
      },
    ],
    [
      "🧠 Ultra Thinking...",
      {
        mode: "🧠 Ultra Thinking...",
        category: BrainCategory.REASONING,
        intensity: "high",
        color: chalk.yellowBright,
      },
    ],
    [
      "🧠 Deep Thinking...",
      {
        mode: "🧠 Deep Thinking...",
        category: BrainCategory.REASONING,
        intensity: "high",
        color: chalk.yellow.bold,
      },
    ],
    [
      "🧠 Researching...",
      {
        mode: "🧠 Researching...",
        category: BrainCategory.REASONING,
        intensity: "medium",
        color: chalk.blue,
      },
    ],
    [
      "🧠 Analyzing...",
      {
        mode: "🧠 Analyzing...",
        category: BrainCategory.REASONING,
        intensity: "medium",
        color: chalk.blueBright,
      },
    ],
    [
      "🧠 Evaluating...",
      {
        mode: "🧠 Evaluating...",
        category: BrainCategory.REASONING,
        intensity: "medium",
        color: chalk.cyan,
      },
    ],
    [
      "🧠 Reasoning...",
      {
        mode: "🧠 Reasoning...",
        category: BrainCategory.REASONING,
        intensity: "medium",
        color: chalk.yellow,
      },
    ],
    [
      "🧠 Contemplating...",
      {
        mode: "🧠 Contemplating...",
        category: BrainCategory.REASONING,
        intensity: "low",
        color: chalk.gray,
      },
    ],
    [
      "🧠 Reflecting...",
      {
        mode: "🧠 Reflecting...",
        category: BrainCategory.REASONING,
        intensity: "low",
        color: chalk.dim.yellow,
      },
    ],
    [
      "🧠 Processing...",
      {
        mode: "🧠 Processing...",
        category: BrainCategory.REASONING,
        intensity: "medium",
        color: chalk.white,
      },
    ],

    // 🧠 Creative brain modes
    [
      "🧠 Creating...",
      {
        mode: "🧠 Creating...",
        category: BrainCategory.CREATIVE,
        intensity: "high",
        color: chalk.magenta,
      },
    ],
    [
      "🧠 Brainstorming...",
      {
        mode: "🧠 Brainstorming...",
        category: BrainCategory.CREATIVE,
        intensity: "high",
        color: chalk.magentaBright,
      },
    ],
    [
      "🧠 Inventing...",
      {
        mode: "🧠 Inventing...",
        category: BrainCategory.CREATIVE,
        intensity: "high",
        color: chalk.magenta.bold,
      },
    ],
    [
      "🧠 Designing...",
      {
        mode: "🧠 Designing...",
        category: BrainCategory.CREATIVE,
        intensity: "medium",
        color: chalk.magenta,
      },
    ],
    [
      "🧠 Drafting...",
      {
        mode: "🧠 Drafting...",
        category: BrainCategory.CREATIVE,
        intensity: "low",
        color: chalk.dim.magenta,
      },
    ],
    [
      "🧠 Imagining...",
      {
        mode: "🧠 Imagining...",
        category: BrainCategory.CREATIVE,
        intensity: "medium",
        color: chalk.magenta,
      },
    ],
    [
      "🧠 Conceptualizing...",
      {
        mode: "🧠 Conceptualizing...",
        category: BrainCategory.CREATIVE,
        intensity: "high",
        color: chalk.magentaBright,
      },
    ],
    [
      "🧠 Innovating...",
      {
        mode: "🧠 Innovating...",
        category: BrainCategory.CREATIVE,
        intensity: "high",
        color: chalk.magenta.bold,
      },
    ],
    [
      "🧠 Ideating...",
      {
        mode: "🧠 Ideating...",
        category: BrainCategory.CREATIVE,
        intensity: "medium",
        color: chalk.magenta,
      },
    ],
    [
      "🧠 Synthesizing...",
      {
        mode: "🧠 Synthesizing...",
        category: BrainCategory.CREATIVE,
        intensity: "high",
        color: chalk.magentaBright,
      },
    ],

    // 🧠 Implementation brain modes
    [
      "🧠 Coding...",
      {
        mode: "🧠 Coding...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.cyan,
      },
    ],
    [
      "🧠 Building...",
      {
        mode: "🧠 Building...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.cyanBright,
      },
    ],
    [
      "🧠 Implementing...",
      {
        mode: "🧠 Implementing...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.cyan.bold,
      },
    ],
    [
      "🧠 Developing...",
      {
        mode: "🧠 Developing...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "medium",
        color: chalk.cyan,
      },
    ],
    [
      "🧠 Programming...",
      {
        mode: "🧠 Programming...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.cyanBright,
      },
    ],
    [
      "🧠 Constructing...",
      {
        mode: "🧠 Constructing...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "medium",
        color: chalk.cyan,
      },
    ],
    [
      "🧠 Architecting...",
      {
        mode: "🧠 Architecting...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.cyan.bold,
      },
    ],
    [
      "🧠 Engineering...",
      {
        mode: "🧠 Engineering...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.cyanBright,
      },
    ],
    [
      "🧠 Assembling...",
      {
        mode: "🧠 Assembling...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "medium",
        color: chalk.cyan,
      },
    ],
    [
      "🧠 Integrating...",
      {
        mode: "🧠 Integrating...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "medium",
        color: chalk.cyan,
      },
    ],

    // 🧠 Validation brain modes
    [
      "🧠 Testing...",
      {
        mode: "🧠 Testing...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.green,
      },
    ],
    [
      "🧠 Debugging...",
      {
        mode: "🧠 Debugging...",
        category: BrainCategory.VALIDATION,
        intensity: "high",
        color: chalk.red,
      },
    ],
    [
      "🧠 Validating...",
      {
        mode: "🧠 Validating...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.green,
      },
    ],
    [
      "🧠 Reviewing...",
      {
        mode: "🧠 Reviewing...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.greenBright,
      },
    ],
    [
      "🧠 Checking...",
      {
        mode: "🧠 Checking...",
        category: BrainCategory.VALIDATION,
        intensity: "low",
        color: chalk.green,
      },
    ],
    [
      "🧠 Verifying...",
      {
        mode: "🧠 Verifying...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.greenBright,
      },
    ],
    [
      "🧠 Inspecting...",
      {
        mode: "🧠 Inspecting...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.green,
      },
    ],
    [
      "🧠 Auditing...",
      {
        mode: "🧠 Auditing...",
        category: BrainCategory.VALIDATION,
        intensity: "high",
        color: chalk.green.bold,
      },
    ],
    [
      "🧠 Examining...",
      {
        mode: "🧠 Examining...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.green,
      },
    ],
    [
      "🧠 Troubleshooting...",
      {
        mode: "🧠 Troubleshooting...",
        category: BrainCategory.VALIDATION,
        intensity: "high",
        color: chalk.redBright,
      },
    ],

    // 🧠 Optimization brain modes
    [
      "🧠 Optimizing...",
      {
        mode: "🧠 Optimizing...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "high",
        color: chalk.greenBright,
      },
    ],
    [
      "🧠 Refactoring...",
      {
        mode: "🧠 Refactoring...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "high",
        color: chalk.green.bold,
      },
    ],
    [
      "🧠 Improving...",
      {
        mode: "🧠 Improving...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "medium",
        color: chalk.green,
      },
    ],
    [
      "🧠 Enhancing...",
      {
        mode: "🧠 Enhancing...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "medium",
        color: chalk.greenBright,
      },
    ],
    [
      "🧠 Streamlining...",
      {
        mode: "🧠 Streamlining...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "high",
        color: chalk.green.bold,
      },
    ],
    [
      "🧠 Polishing...",
      {
        mode: "🧠 Polishing...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "low",
        color: chalk.green,
      },
    ],
    [
      "🧠 Tuning...",
      {
        mode: "🧠 Tuning...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "medium",
        color: chalk.greenBright,
      },
    ],
    [
      "🧠 Perfecting...",
      {
        mode: "🧠 Perfecting...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "high",
        color: chalk.green.bold,
      },
    ],
    [
      "🧠 Documenting...",
      {
        mode: "🧠 Documenting...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "low",
        color: chalk.gray,
      },
    ],
    [
      "🧠 Planning...",
      {
        mode: "🧠 Planning...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "medium",
        color: chalk.magenta,
      },
    ],
    // 🧠 新規追加特殊脳モード (8) - v2.0.0で追加
    [
      "🔬 DeepResearch...",
      {
        mode: "🔬 DeepResearch...",
        category: BrainCategory.REASONING,
        intensity: "maximum",
        color: chalk.cyan,
      },
    ],
    [
      "🎯 PrecisionCoding...",
      {
        mode: "🎯 PrecisionCoding...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.green,
      },
    ],
    [
      "🌊 FlowState...",
      {
        mode: "🌊 FlowState...",
        category: BrainCategory.CREATIVE,
        intensity: "high",
        color: chalk.blue,
      },
    ],
    [
      "🔮 Predictive...",
      {
        mode: "🔮 Predictive...",
        category: BrainCategory.REASONING,
        intensity: "high",
        color: chalk.magenta,
      },
    ],
    [
      "🎨 CreativeFlow...",
      {
        mode: "🎨 CreativeFlow...",
        category: BrainCategory.CREATIVE,
        intensity: "maximum",
        color: chalk.yellow,
      },
    ],
    [
      "🏗️ Architectural...",
      {
        mode: "🏗️ Architectural...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "maximum",
        color: chalk.cyan,
      },
    ],
    [
      "🔍 Forensic...",
      {
        mode: "🔍 Forensic...",
        category: BrainCategory.VALIDATION,
        intensity: "maximum",
        color: chalk.red,
      },
    ],
    [
      "⚡ RapidPrototype...",
      {
        mode: "⚡ RapidPrototype...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "maximum",
        color: chalk.yellow,
      },
    ],
  ]);

  constructor() {
    this.initializeBrainTransitions();
  }

  /**
   * 🧠 脳モード遷移を初期化
   */
  private initializeBrainTransitions(): void {
    // Define natural transitions between brain modes
    this.brainTransitions.set("🧠 Thinking...", [
      "🧠 Ultra Thinking...",
      "🧠 Researching...",
      "🧠 Planning...",
    ]);
    this.brainTransitions.set("🧠 Planning...", [
      "🧠 Designing...",
      "🧠 Architecting...",
      "🧠 Coding...",
    ]);
    this.brainTransitions.set("🧠 Coding...", [
      "🧠 Testing...",
      "🧠 Debugging...",
      "🧠 Optimizing...",
    ]);
    this.brainTransitions.set("🧠 Debugging...", [
      "🧠 Troubleshooting...",
      "🧠 Analyzing...",
      "🧠 Coding...",
    ]);
    this.brainTransitions.set("🧠 Testing...", [
      "🧠 Validating...",
      "🧠 Reviewing...",
      "🧠 Documenting...",
    ]);
  }

  /**
   * 現在のモードを取得
   */
  getCurrentMode(): InternalMode {
    return this.currentMode;
  }

  /**
   * 現在のモードを設定(同期版)
   */
  setCurrentMode(mode: InternalMode): void {
    if (this.isValidMode(_mode)) {
      this.currentMode = _mode;
      this.modeHistory.push({
        mode,
        timestamp: new Date(),
      });
      this.notifyUpdate(_mode);
      this.startLoopAnimation();
    }
  }

  /**
   * 有効なモードかチェック
   */
  private isValidMode(mode: InternalMode): boolean {
    return this.modeInfo.has(_mode);
  }

  /**
   * モードインジケーターをレンダリング
   */
  render(): string {
    const _modeInfo = this._modeInfo.get(this.currentMode);

    if (!_modeInfo) {
      return chalk.gray(`[${this.currentMode}]`);
    }

    const _coloredMode = _modeInfo.color(`[${_modeInfo._mode}]`);
    const _intensityIndicator = this.getIntensityIndicator(_modeInfo.intensity);

    return `${_coloredMode} ${_intensityIndicator}`;
  }

  /**
   * 強度インジケーターを取得
   */
  private getIntensityIndicator(
    intensity: "low" | "medium" | "high" | "maximum",
  ): string {
    switch (intensity) {
      case "low":
        return chalk.dim("●");
      case "medium":
        return chalk.yellow("●●");
      case "high":
        return chalk.red("●●●");
      case "maximum":
        return chalk.magenta("●●●●");
      default:
        return "";
    }
  }

  /**
   * モードを遷移
   */
  async transitionTo(
    _newMode: InternalMode,
    animate: boolean = true,
  ): Promise<void> {
    if (this.isAnimating) {
      return;
    }

    const _oldMode = this.currentMode;

    // Add to _history
    this.modeHistory.push({
      mode: _newMode,
      timestamp: new Date(),
    });

    // Animate transition if requested
    if (animate) {
      await this.animateTransition(_oldMode, _newMode);
    }

    // Update current mode
    this.currentMode = _newMode;

    // Notify callbacks
    this.notifyUpdate(_newMode);
  }

  /**
   * モード遷移をアニメーション
   */
  private async animateTransition(
    _from: InternalMode,
    to: InternalMode,
  ): Promise<void> {
    this.isAnimating = true;

    const _fromInfo = this.modeInfo.get(_from);
    const _toInfo = this.modeInfo.get(to);

    if (!_fromInfo || !_toInfo) {
      this.isAnimating = false;
      return;
    }

    // Smooth transition with color fade
    const _steps = 5;
    for (let i = 0; i <= _steps; i++) {
      const _progress = i / _steps;

      // Clear line and redraw
      process.stdout.write(`\r${" ".repeat(80)}\r`);

      if (_progress < 0.5) {
        // Fade out old mode
        process.stdout.write(chalk.dim(_fromInfo.color(`[${_from}]`)));
      } else {
        // Fade in new mode
        process.stdout.write(_toInfo.color(`[${to}]`));
      }

      await this.delay(50);
    }

    // Clear the animation line
    process.stdout.write(`\r${" ".repeat(80)}\r`);

    this.isAnimating = false;
  }

  /**
   * モードを表示
   */
  display(inline: boolean = false): void {
    const _info = this.modeInfo.get(this.currentMode);
    if (!_info) {
      return;
    }

    const _modeDisplay = _info.color(`[${this.currentMode}]`);

    if (inline) {
      process.stdout.write(`${_modeDisplay} `);
    } else {
      console.log(_modeDisplay);
    }
  }

  /**
   * フローティング表示
   */
  displayFloating(_x: number = 0, y: number = 0): void {
    const _info = this.modeInfo.get(this.currentMode);
    if (!_info) {
      return;
    }

    // Save cursor position
    process.stdout.write("\u001b[s");

    // Move to position
    process.stdout.write(`\u001b[${y};${_x}H`);

    // Display mode
    process.stdout.write(_info.color(`[${this.currentMode}]`));

    // Restore cursor position
    process.stdout.write("\u001b[u");
  }

  /**
   * モードカテゴリーを取得
   */
  getCategory(): ModeCategory {
    const _info = this.modeInfo.get(this.currentMode);
    return _info ? _info._category : ModeCategory.REASONING;
  }

  /**
   * モード強度を取得
   */
  getIntensity(): "low" | "medium" | "high" | "maximum" {
    const _info = this.modeInfo.get(this.currentMode);
    return _info ? _info.intensity : "medium";
  }

  /**
   * 次の推奨モードを取得
   */
  getSuggestedNextModes(): InternalMode[] {
    return this.modeTransitions.get(this.currentMode) || [];
  }

  /**
   * モード履歴を取得
   */
  getHistory(): Array<{ _mode: InternalMode; timestamp: Date }> {
    return [...this.modeHistory];
  }

  /**
   * モード履歴を取得(別名)
   */
  getModeHistory(): Array<{ _mode: InternalMode; timestamp: Date }> {
    return this.getHistory();
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    currentMode: InternalMode;
    totalTransitions: number;
    activeSince?: Date;
    categoriesUsed: string[];
    mostUsedMode: InternalMode;
  } {
    const _history = this.modeHistory;
    const _modeCount = new Map<InternalMode, number>();
    const _categoriesSet = new Set<string>();

    // Count mode usage
    history.forEach((entry) => {
      const _count = _modeCount.get(entry._mode) || 0;
      modeCount.set(entry._mode, _count + 1);

      const _info = this.modeInfo.get(entry._mode);
      if (_info) {
        categoriesSet.add(_info.category);
      }
    });

    // Find most used mode
    let mostUsedMode: InternalMode = this.currentMode;
    let maxCount = 0;
    modeCount.forEach((_count, mode) => {
      if (_count > maxCount) {
        maxCount = _count;
        mostUsedMode = _mode;
      }
    });

    return {
      currentMode: this.currentMode,
      totalTransitions: _history.length,
      activeSince: _history.length > 0 ? _history[0]?.timestamp : undefined,
      categoriesUsed: Array.from(_categoriesSet),
      mostUsedMode,
    };
  }

  /**
   * 最近のモードを取得
   */
  getRecentModes(_count: number = 5): InternalMode[] {
    return this.modeHistory.slice(-_count).map((entry) => entry._mode);
  }

  /**
   * 更新コールバックを登録
   */
  onUpdate(_callback: (mode: InternalMode) => void): void {
    this.updateCallbacks.push(_callback);
  }

  /**
   * 更新を通知
   */
  private notifyUpdate(mode: InternalMode): void {
    this.updateCallbacks.forEach((callback) => callback(_mode));
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * ループアニメーションを開始
   */
  startLoopAnimation(): void {
    this.stopLoopAnimation();
    this.currentDots = 0;

    this.loopAnimationInterval = setInterval(() => {
      this.currentDots = (this.currentDots + 1) % 4; // 0, 1, 2, 3をループ
      this.displayAnimatedMode();
    }, 200); // 200msごとに更新
  }

  /**
   * ループアニメーションを停止
   */
  stopLoopAnimation(): void {
    if (this.loopAnimationInterval) {
      clearInterval(this.loopAnimationInterval);
      this.loopAnimationInterval = null;
    }
  }

  /**
   * アニメーション付きモードを表示
   */
  private displayAnimatedMode(): void {
    const _info = this.modeInfo.get(this.currentMode);
    if (!_info) return;

    // モード名から"..."を取り除いて基本テキストを取得
    const _baseMode = this.currentMode.replace(/\.+$/, "");
    const _dots = ".".repeat(this.currentDots);
    const _paddedText = `${_baseMode}${_dots}`.padEnd(
      _baseMode.length + 3,
      " ",
    );

    // カーソルを行頭に戻して表示を更新
    process.stdout.write(`\r${_info.color(`[${_paddedText}]`)} `);
  }

  /**
   * モードをリセット
   */
  reset(): void {
    this.stopLoopAnimation();
    this.currentMode = "✽ Thinking...";
    this.modeHistory = [];
    this.isAnimating = false;
  }

  /**
   * 全モードリストを取得
   */
  static getAllModes(): InternalMode[] {
    return [
      // Reasoning
      "✽ Thinking...",
      "✽ Ultra Thinking...",
      "✽ Deep Thinking...",
      "✽ Researching...",
      "✽ Analyzing...",
      "✽ Evaluating...",
      "✽ Reasoning...",
      "✽ Contemplating...",
      "✽ Reflecting...",
      "✽ Processing...",
      // Creative
      "✽ Creating...",
      "✽ Brainstorming...",
      "✽ Inventing...",
      "✽ Designing...",
      "✽ Drafting...",
      "✽ Imagining...",
      "✽ Conceptualizing...",
      "✽ Innovating...",
      "✽ Ideating...",
      "✽ Synthesizing...",
      // Implementation
      "✽ Coding...",
      "✽ Building...",
      "✽ Implementing...",
      "✽ Developing...",
      "✽ Programming...",
      "✽ Constructing...",
      "✽ Architecting...",
      "✽ Engineering...",
      "✽ Assembling...",
      "✽ Integrating...",
      // Validation
      "✽ Testing...",
      "✽ Debugging...",
      "✽ Validating...",
      "✽ Reviewing...",
      "✽ Checking...",
      "✽ Verifying...",
      "✽ Inspecting...",
      "✽ Auditing...",
      "✽ Examining...",
      "✽ Troubleshooting...",
      // Optimization
      "✽ Optimizing...",
      "✽ Refactoring...",
      "✽ Improving...",
      "✽ Enhancing...",
      "✽ Streamlining...",
      "✽ Polishing...",
      "✽ Tuning...",
      "✽ Perfecting...",
      "✽ Documenting...",
      "✽ Planning...",
    ];
  }
}

export default ModeIndicator;
