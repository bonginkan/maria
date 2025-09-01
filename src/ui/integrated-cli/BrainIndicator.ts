/**
 * BrainIndicator Component
 * 50種類の内部脳モード管理と表示
 */

import chalk from "chalk";

/**
 * 内部脳モード型定義
 */
export type InternalBrainMode =
  // 基本推論系 (10)
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
  // 創造系 (10)
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
  // 実装系 (10)
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
  // 検証系 (10)
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
  // 最適化系 (10)
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
  // 新規追加脳モード (8) - v2.0.0で追加
  | "🔬 DeepResearch..."
  | "🎯 PrecisionCoding..."
  | "🌊 FlowState..."
  | "🔮 Predictive..."
  | "🎨 CreativeFlow..."
  | "🏗️ Architectural..."
  | "🔍 Forensic..."
  | "⚡ RapidPrototype...";

/**
 * 脳モードカテゴリー
 */
export enum BrainCategory {
  REASONING = "reasoning",
  CREATIVE = "creative",
  IMPLEMENTATION = "implementation",
  VALIDATION = "validation",
  OPTIMIZATION = "optimization",
}

/**
 * 脳モード情報
 */
interface BrainInfo {
  mode: InternalBrainMode;
  category: BrainCategory;
  intensity: "low" | "medium" | "high" | "maximum";
  color: typeof chalk;
}

/**
 * 脳インジケータークラス
 */
export class BrainIndicator {
  private currentBrainMode: InternalBrainMode = "🧠 Thinking...";
  private brainModeHistory: Array<{
    _mode: InternalBrainMode;
    timestamp: Date;
  }> = [];
  private brainModeTransitions: Map<InternalBrainMode, InternalBrainMode[]> =
    new Map();
  private isAnimating: boolean = false;
  private updateCallbacks: Array<(_mode: InternalBrainMode) => void> = [];
  private loopAnimationInterval: NodeJS.Timeout | null = null;
  private currentDots: number = 0;

  // 脳モード情報マッピング
  private _brainInfo: Map<InternalBrainMode, BrainInfo> = new Map([
    // Reasoning brain modes
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
    // Creative brain modes
    [
      "🧠 Creating...",
      {
        mode: "🧠 Creating...",
        category: BrainCategory.CREATIVE,
        intensity: "medium",
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
        color: chalk.cyan,
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
        color: chalk.rainbow,
      },
    ],
    [
      "🧠 Conceptualizing...",
      {
        mode: "🧠 Conceptualizing...",
        category: BrainCategory.CREATIVE,
        intensity: "high",
        color: chalk.cyanBright,
      },
    ],
    [
      "🧠 Innovating...",
      {
        mode: "🧠 Innovating...",
        category: BrainCategory.CREATIVE,
        intensity: "maximum",
        color: chalk.magenta.bold.underline,
      },
    ],
    [
      "🧠 Ideating...",
      {
        mode: "🧠 Ideating...",
        category: BrainCategory.CREATIVE,
        intensity: "medium",
        color: chalk.yellow,
      },
    ],
    [
      "🧠 Synthesizing...",
      {
        mode: "🧠 Synthesizing...",
        category: BrainCategory.CREATIVE,
        intensity: "high",
        color: chalk.green.bold,
      },
    ],
    // Implementation brain modes
    [
      "🧠 Coding...",
      {
        mode: "🧠 Coding...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "medium",
        color: chalk.green,
      },
    ],
    [
      "🧠 Building...",
      {
        mode: "🧠 Building...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.greenBright,
      },
    ],
    [
      "🧠 Implementing...",
      {
        mode: "🧠 Implementing...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.green.bold,
      },
    ],
    [
      "🧠 Developing...",
      {
        mode: "🧠 Developing...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "medium",
        color: chalk.blue,
      },
    ],
    [
      "🧠 Programming...",
      {
        mode: "🧠 Programming...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "medium",
        color: chalk.green,
      },
    ],
    [
      "🧠 Constructing...",
      {
        mode: "🧠 Constructing...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.yellow.bold,
      },
    ],
    [
      "🧠 Architecting...",
      {
        mode: "🧠 Architecting...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "maximum",
        color: chalk.blue.bold.underline,
      },
    ],
    [
      "🧠 Engineering...",
      {
        mode: "🧠 Engineering...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "high",
        color: chalk.blueBright,
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
        intensity: "high",
        color: chalk.green.bold,
      },
    ],
    // Validation brain modes
    [
      "🧠 Testing...",
      {
        mode: "🧠 Testing...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.red,
      },
    ],
    [
      "🧠 Debugging...",
      {
        mode: "🧠 Debugging...",
        category: BrainCategory.VALIDATION,
        intensity: "high",
        color: chalk.redBright,
      },
    ],
    [
      "🧠 Validating...",
      {
        mode: "🧠 Validating...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.yellow,
      },
    ],
    [
      "🧠 Reviewing...",
      {
        mode: "🧠 Reviewing...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.cyan,
      },
    ],
    [
      "🧠 Checking...",
      {
        mode: "🧠 Checking...",
        category: BrainCategory.VALIDATION,
        intensity: "low",
        color: chalk.gray,
      },
    ],
    [
      "🧠 Verifying...",
      {
        mode: "🧠 Verifying...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.green,
      },
    ],
    [
      "🧠 Inspecting...",
      {
        mode: "🧠 Inspecting...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.blue,
      },
    ],
    [
      "🧠 Auditing...",
      {
        mode: "🧠 Auditing...",
        category: BrainCategory.VALIDATION,
        intensity: "high",
        color: chalk.red.bold,
      },
    ],
    [
      "🧠 Examining...",
      {
        mode: "🧠 Examining...",
        category: BrainCategory.VALIDATION,
        intensity: "medium",
        color: chalk.magenta,
      },
    ],
    [
      "🧠 Troubleshooting...",
      {
        mode: "🧠 Troubleshooting...",
        category: BrainCategory.VALIDATION,
        intensity: "high",
        color: chalk.red.bold,
      },
    ],
    // Optimization brain modes
    [
      "🧠 Optimizing...",
      {
        mode: "🧠 Optimizing...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "high",
        color: chalk.yellowBright,
      },
    ],
    [
      "🧠 Refactoring...",
      {
        mode: "🧠 Refactoring...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "high",
        color: chalk.blue.bold,
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
        intensity: "medium",
        color: chalk.cyan,
      },
    ],
    [
      "🧠 Polishing...",
      {
        mode: "🧠 Polishing...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "low",
        color: chalk.white,
      },
    ],
    [
      "🧠 Tuning...",
      {
        mode: "🧠 Tuning...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "medium",
        color: chalk.yellow,
      },
    ],
    [
      "🧠 Perfecting...",
      {
        mode: "🧠 Perfecting...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "high",
        color: chalk.magenta.bold,
      },
    ],
    [
      "🧠 Documenting...",
      {
        mode: "🧠 Documenting...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "low",
        color: chalk.dim.white,
      },
    ],
    [
      "🧠 Planning...",
      {
        mode: "🧠 Planning...",
        category: BrainCategory.OPTIMIZATION,
        intensity: "medium",
        color: chalk.blue,
      },
    ],
    // Special brain modes
    [
      "🔬 DeepResearch...",
      {
        mode: "🔬 DeepResearch...",
        category: BrainCategory.REASONING,
        intensity: "maximum",
        color: chalk.blue.bold.underline,
      },
    ],
    [
      "🎯 PrecisionCoding...",
      {
        mode: "🎯 PrecisionCoding...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "maximum",
        color: chalk.green.bold.underline,
      },
    ],
    [
      "🌊 FlowState...",
      {
        mode: "🌊 FlowState...",
        category: BrainCategory.CREATIVE,
        intensity: "maximum",
        color: chalk.cyan.bold.underline,
      },
    ],
    [
      "🔮 Predictive...",
      {
        mode: "🔮 Predictive...",
        category: BrainCategory.REASONING,
        intensity: "maximum",
        color: chalk.magenta.bold.underline,
      },
    ],
    [
      "🎨 CreativeFlow...",
      {
        mode: "🎨 CreativeFlow...",
        category: BrainCategory.CREATIVE,
        intensity: "maximum",
        color: chalk.rainbow,
      },
    ],
    [
      "🏗️ Architectural...",
      {
        mode: "🏗️ Architectural...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "maximum",
        color: chalk.yellow.bold.underline,
      },
    ],
    [
      "🔍 Forensic...",
      {
        mode: "🔍 Forensic...",
        category: BrainCategory.VALIDATION,
        intensity: "maximum",
        color: chalk.red.bold.underline,
      },
    ],
    [
      "⚡ RapidPrototype...",
      {
        mode: "⚡ RapidPrototype...",
        category: BrainCategory.IMPLEMENTATION,
        intensity: "maximum",
        color: chalk.yellowBright.bold.underline,
      },
    ],
  ]);

  constructor() {
    this.initializeBrainTransitions();
  }

  private initializeBrainTransitions(): void {
    // Define logical brain mode transitions
    this.brainModeTransitions.set("🧠 Thinking...", [
      "🧠 Analyzing...",
      "🧠 Researching...",
      "🧠 Creating...",
    ]);
    this.brainModeTransitions.set("🧠 Analyzing...", [
      "🧠 Evaluating...",
      "🧠 Debugging...",
      "🧠 Optimizing...",
    ]);
    this.brainModeTransitions.set("🧠 Creating...", [
      "🧠 Designing...",
      "🧠 Implementing...",
      "🧠 Brainstorming...",
    ]);
    this.brainModeTransitions.set("🧠 Implementing...", [
      "🧠 Testing...",
      "🧠 Building...",
      "🧠 Debugging...",
    ]);
    this.brainModeTransitions.set("🧠 Testing...", [
      "🧠 Debugging...",
      "🧠 Validating...",
      "🧠 Optimizing...",
    ]);
    this.brainModeTransitions.set("🧠 Debugging...", [
      "🧠 Testing...",
      "🧠 Refactoring...",
      "🧠 Analyzing...",
    ]);
    this.brainModeTransitions.set("🧠 Optimizing...", [
      "🧠 Refactoring...",
      "🧠 Enhancing...",
      "🧠 Perfecting...",
    ]);
    this.brainModeTransitions.set("🧠 Brainstorming...", [
      "🧠 Creating...",
      "🧠 Ideating...",
      "🧠 Innovating...",
    ]);
    this.brainModeTransitions.set("🧠 Researching...", [
      "🧠 Analyzing...",
      "🔬 DeepResearch...",
      "🧠 Evaluating...",
    ]);
    this.brainModeTransitions.set("🧠 Coding...", [
      "🎯 PrecisionCoding...",
      "🧠 Testing...",
      "🧠 Debugging...",
    ]);
    this.brainModeTransitions.set("🧠 Designing...", [
      "🎨 CreativeFlow...",
      "🧠 Creating...",
      "🧠 Architecting...",
    ]);
    this.brainModeTransitions.set("🧠 Architecting...", [
      "🏗️ Architectural...",
      "🧠 Planning...",
      "🧠 Designing...",
    ]);

    // Add more transitions as needed...
  }

  getCurrentBrainMode(): InternalBrainMode {
    return this.currentBrainMode;
  }

  /**
   * Set the current brain mode
   */
  setCurrentBrainMode(mode: InternalBrainMode): void {
    if (this.isValidBrainMode(_mode)) {
      const _previousMode = this.currentBrainMode;
      this.currentBrainMode = _mode;
      this.brainModeHistory.push({ mode: _mode, timestamp: new Date() });

      // Keep _history limited to last 100 entries
      if (this.brainModeHistory.length > 100) {
        this.brainModeHistory = this.brainModeHistory.slice(-100);
      }

      this.notifyUpdate(_mode);
    }
  }

  private isValidBrainMode(mode: InternalBrainMode): boolean {
    return this.brainInfo.has(_mode);
  }

  render(): string {
    const _brainInfo = this._brainInfo.get(this.currentBrainMode);
    if (!_brainInfo) {
      return chalk.dim("🧠 Unknown brain mode...");
    }

    const _intensityIndicator = this.getIntensityIndicator(
      _brainInfo.intensity,
    );
    const _baseText = `${_brainInfo._mode}`;

    // Add animated _dots if loop animation is active
    const _dots = this.loopAnimationInterval
      ? ".".repeat((this.currentDots % 4) + 1)
      : "";
    const _animatedText = _baseText.slice(0, -3) + _dots;

    return _brainInfo.color(`${_intensityIndicator} ${_animatedText}`);
  }

  private getIntensityIndicator(
    intensity: "low" | "medium" | "high" | "maximum",
  ): string {
    switch (intensity) {
      case "low":
        return "▪";
      case "medium":
        return "▫";
      case "high":
        return "◆";
      case "maximum":
        return "◇";
      default:
        return "▪";
    }
  }

  /**
   * Animate transition between brain modes
   */
  async transitionTo(
    _newMode: InternalBrainMode,
    animate: boolean = true,
  ): Promise<void> {
    if (this.isAnimating) {
      return;
    }

    const _previousMode = this.currentBrainMode;

    // If same brain mode, no transition needed
    if (_previousMode === _newMode) {
      return;
    }

    if (animate) {
      await this.animateBrainTransition(_previousMode, _newMode);
    }

    this.setCurrentBrainMode(_newMode);
  }

  private async animateBrainTransition(
    _from: InternalBrainMode,
    to: InternalBrainMode,
  ): Promise<void> {
    this.isAnimating = true;

    const _fromInfo = this.brainInfo.get(_from);
    const _toInfo = this.brainInfo.get(to);

    if (!_fromInfo || !_toInfo) {
      this.isAnimating = false;
      return;
    }

    const _steps = 8;
    for (let i = 0; i <= _steps; i++) {
      const _progress = i / _steps;

      // Blend colors and create transition effect
      if (_progress < 0.5) {
        // Fade out current brain mode
        const _fadeText = `${_fromInfo._mode}`.slice(0, -3) + "...";
        process.stdout.write(`\r${_fromInfo.color.dim(_fadeText)}`);
      } else {
        // Fade in new brain mode
        const _fadeText = `${_toInfo._mode}`.slice(0, -3) + "...";
        if (_progress > 0.8) {
          process.stdout.write(`\r${_toInfo.color(_fadeText)}`);
        } else {
          process.stdout.write(`\r${_toInfo.color.dim(_fadeText)}`);
        }
      }

      await this.delay(60); // Slightly faster brain transitions
    }

    this.isAnimating = false;
  }

  display(inline: boolean = false): void {
    const _info = this.brainInfo.get(this.currentBrainMode);
    if (!_info) return;

    const _rendered = this.render();
    if (inline) {
      process.stdout.write(_rendered + " ");
    } else {
      console.log(_rendered);
    }
  }

  displayFloating(_x: number = 0, y: number = 0): void {
    const _info = this.brainInfo.get(this.currentBrainMode);
    if (!_info) return;

    const _rendered = this.render();

    // Move cursor to position and display
    process.stdout.write(`\u001b[${y};${_x}H${_rendered}`);

    // Return cursor to bottom
    process.stdout.write("\u001b[999;0H");
  }

  getBrainCategory(): BrainCategory {
    const _info = this.brainInfo.get(this.currentBrainMode);
    return _info?.category || BrainCategory.REASONING;
  }

  getBrainIntensity(): "low" | "medium" | "high" | "maximum" {
    const _info = this.brainInfo.get(this.currentBrainMode);
    return _info?.intensity || "medium";
  }

  getSuggestedNextBrainModes(): InternalBrainMode[] {
    return this.brainModeTransitions.get(this.currentBrainMode) || [];
  }

  getBrainHistory(): Array<{ _mode: InternalBrainMode; timestamp: Date }> {
    return [...this.brainModeHistory];
  }

  getBrainModeHistory(): Array<{ _mode: InternalBrainMode; timestamp: Date }> {
    return this.getBrainHistory();
  }

  getBrainStats(): {
    totalBrainModes: number;
    currentBrainMode: InternalBrainMode;
    brainModeChanges: number;
    averageBrainModeTime: number;
    mostUsedBrainModes: Array<{ _mode: InternalBrainMode; count: number }>;
    brainCategoryDistribution: Record<BrainCategory, number>;
  } {
    const _history = this.getBrainHistory();
    const _brainModeCount = new Map<InternalBrainMode, number>();
    const _brainCategoryCount = new Map<BrainCategory, number>();

    history.forEach((entry) => {
      _brainModeCount.set(
        entry._mode,
        (_brainModeCount.get(entry._mode) || 0) + 1,
      );
      const _info = this.brainInfo.get(entry._mode);
      if (_info) {
        _brainCategoryCount.set(
          _info.category,
          (_brainCategoryCount.get(_info.category) || 0) + 1,
        );
      }
    });

    const mostUsedBrainModes: Array<{
      _mode: InternalBrainMode;
      count: number;
    }> = [];
    let maxCount = 0;
    brainModeCount.forEach((count, mode) => {
      if (count > maxCount) {
        maxCount = count;
      }
      mostUsedBrainModes.push({ mode: _mode, count });
    });
    mostUsedBrainModes.sort((a, b) => b.count - a.count);

    const brainCategoryDistribution: Record<BrainCategory, number> = {
      [BrainCategory.REASONING]:
        _brainCategoryCount.get(BrainCategory.REASONING) || 0,
      [BrainCategory.CREATIVE]:
        _brainCategoryCount.get(BrainCategory.CREATIVE) || 0,
      [BrainCategory.IMPLEMENTATION]:
        _brainCategoryCount.get(BrainCategory.IMPLEMENTATION) || 0,
      [BrainCategory.VALIDATION]:
        _brainCategoryCount.get(BrainCategory.VALIDATION) || 0,
      [BrainCategory.OPTIMIZATION]:
        _brainCategoryCount.get(BrainCategory.OPTIMIZATION) || 0,
    };

    return {
      totalBrainModes: this.brainInfo.size,
      currentBrainMode: this.currentBrainMode,
      brainModeChanges: _history.length,
      averageBrainModeTime:
        _history.length > 1
          ? (Date.now() - _history[0].timestamp.getTime()) /
            (_history.length - 1)
          : 0,
      mostUsedBrainModes: mostUsedBrainModes.slice(0, 10),
      brainCategoryDistribution,
    };
  }

  getRecentBrainModes(count: number = 5): InternalBrainMode[] {
    return this.brainModeHistory.slice(-count).map((entry) => entry._mode);
  }

  onUpdate(_callback: (mode: InternalBrainMode) => void): void {
    this.updateCallbacks.push(_callback);
  }

  private notifyUpdate(mode: InternalBrainMode): void {
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(_mode);
      } catch (_error) {
        /* ignore callback errors */
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Start animated brain mode display
   */
  startLoopAnimation(): void {
    if (this.loopAnimationInterval) return;

    this.loopAnimationInterval = setInterval(() => {
      this.currentDots = (this.currentDots + 1) % 4;
      this.displayAnimatedBrainMode();
    }, 500);
  }

  stopLoopAnimation(): void {
    if (this.loopAnimationInterval) {
      clearInterval(this.loopAnimationInterval);
      this.loopAnimationInterval = null;
      this.currentDots = 0;
    }
  }

  private displayAnimatedBrainMode(): void {
    const _info = this.brainInfo.get(this.currentBrainMode);
    if (!_info) return;

    const _intensityIndicator = this.getIntensityIndicator(_info.intensity);
    const _baseText = _info._mode.slice(0, -3);
    const _dots = ".".repeat((this.currentDots % 4) + 1);
    const _animatedText = `${_baseText}${_dots}`;

    // Clear line and display animated brain mode
    process.stdout.write(
      `\r${_info.color(`${_intensityIndicator} ${_animatedText}`)}`,
    );
  }

  reset(): void {
    this.currentBrainMode = "🧠 Thinking...";
    this.brainModeHistory = [];
    this.isAnimating = false;
    this.updateCallbacks = [];
    this.stopLoopAnimation();
  }

  static getAllBrainModes(): InternalBrainMode[] {
    return [
      // Reasoning
      "🧠 Thinking...",
      "🧠 Ultra Thinking...",
      "🧠 Deep Thinking...",
      "🧠 Researching...",
      "🧠 Analyzing...",
      "🧠 Evaluating...",
      "🧠 Reasoning...",
      "🧠 Contemplating...",
      "🧠 Reflecting...",
      "🧠 Processing...",
      // Creative
      "🧠 Creating...",
      "🧠 Brainstorming...",
      "🧠 Inventing...",
      "🧠 Designing...",
      "🧠 Drafting...",
      "🧠 Imagining...",
      "🧠 Conceptualizing...",
      "🧠 Innovating...",
      "🧠 Ideating...",
      "🧠 Synthesizing...",
      // Implementation
      "🧠 Coding...",
      "🧠 Building...",
      "🧠 Implementing...",
      "🧠 Developing...",
      "🧠 Programming...",
      "🧠 Constructing...",
      "🧠 Architecting...",
      "🧠 Engineering...",
      "🧠 Assembling...",
      "🧠 Integrating...",
      // Validation
      "🧠 Testing...",
      "🧠 Debugging...",
      "🧠 Validating...",
      "🧠 Reviewing...",
      "🧠 Checking...",
      "🧠 Verifying...",
      "🧠 Inspecting...",
      "🧠 Auditing...",
      "🧠 Examining...",
      "🧠 Troubleshooting...",
      // Optimization
      "🧠 Optimizing...",
      "🧠 Refactoring...",
      "🧠 Improving...",
      "🧠 Enhancing...",
      "🧠 Streamlining...",
      "🧠 Polishing...",
      "🧠 Tuning...",
      "🧠 Perfecting...",
      "🧠 Documenting...",
      "🧠 Planning...",
      // Special
      "🔬 DeepResearch...",
      "🎯 PrecisionCoding...",
      "🌊 FlowState...",
      "🔮 Predictive...",
      "🎨 CreativeFlow...",
      "🏗️ Architectural...",
      "🔍 Forensic...",
      "⚡ RapidPrototype...",
    ];
  }
}

// Legacy compatibility - export _ModeIndicator as alias for BrainIndicator
export const _ModeIndicator = BrainIndicator;
export type InternalMode = InternalBrainMode;
