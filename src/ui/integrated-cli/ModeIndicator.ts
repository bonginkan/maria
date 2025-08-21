/**
 * ModeIndicator Component
 * 50種類の内部モード管理と表示
 */

import chalk from 'chalk';

/**
 * 内部モード型定義
 */
export type InternalMode =
  // 基本推論系 (10)
  | '✽ Thinking...'
  | '✽ Ultra Thinking...'
  | '✽ Deep Thinking...'
  | '✽ Researching...'
  | '✽ Analyzing...'
  | '✽ Evaluating...'
  | '✽ Reasoning...'
  | '✽ Contemplating...'
  | '✽ Reflecting...'
  | '✽ Processing...'
  // 創造系 (10)
  | '✽ Creating...'
  | '✽ Brainstorming...'
  | '✽ Inventing...'
  | '✽ Designing...'
  | '✽ Drafting...'
  | '✽ Imagining...'
  | '✽ Conceptualizing...'
  | '✽ Innovating...'
  | '✽ Ideating...'
  | '✽ Synthesizing...'
  // 実装系 (10)
  | '✽ Coding...'
  | '✽ Building...'
  | '✽ Implementing...'
  | '✽ Developing...'
  | '✽ Programming...'
  | '✽ Constructing...'
  | '✽ Architecting...'
  | '✽ Engineering...'
  | '✽ Assembling...'
  | '✽ Integrating...'
  // 検証系 (10)
  | '✽ Testing...'
  | '✽ Debugging...'
  | '✽ Validating...'
  | '✽ Reviewing...'
  | '✽ Checking...'
  | '✽ Verifying...'
  | '✽ Inspecting...'
  | '✽ Auditing...'
  | '✽ Examining...'
  | '✽ Troubleshooting...'
  // 最適化系 (10)
  | '✽ Optimizing...'
  | '✽ Refactoring...'
  | '✽ Improving...'
  | '✽ Enhancing...'
  | '✽ Streamlining...'
  | '✽ Polishing...'
  | '✽ Tuning...'
  | '✽ Perfecting...'
  | '✽ Documenting...'
  | '✽ Planning...';

/**
 * モードカテゴリー
 */
export enum ModeCategory {
  REASONING = 'reasoning',
  CREATIVE = 'creative',
  IMPLEMENTATION = 'implementation',
  VALIDATION = 'validation',
  OPTIMIZATION = 'optimization',
}

/**
 * モード情報
 */
interface ModeInfo {
  mode: InternalMode;
  category: ModeCategory;
  intensity: 'low' | 'medium' | 'high';
  color: typeof chalk;
}

/**
 * モードインジケータークラス
 */
export class ModeIndicator {
  private currentMode: InternalMode = '✽ Thinking...';
  private modeHistory: Array<{ mode: InternalMode; timestamp: Date }> = [];
  private modeTransitions: Map<InternalMode, InternalMode[]> = new Map();
  private isAnimating: boolean = false;
  private updateCallbacks: Array<(mode: InternalMode) => void> = [];

  // モード情報マッピング
  private modeInfo: Map<InternalMode, ModeInfo> = new Map([
    // Reasoning modes
    [
      '✽ Thinking...',
      {
        mode: '✽ Thinking...',
        category: ModeCategory.REASONING,
        intensity: 'medium',
        color: chalk.yellow,
      },
    ],
    [
      '✽ Ultra Thinking...',
      {
        mode: '✽ Ultra Thinking...',
        category: ModeCategory.REASONING,
        intensity: 'high',
        color: chalk.yellowBright,
      },
    ],
    [
      '✽ Deep Thinking...',
      {
        mode: '✽ Deep Thinking...',
        category: ModeCategory.REASONING,
        intensity: 'high',
        color: chalk.yellow.bold,
      },
    ],
    [
      '✽ Researching...',
      {
        mode: '✽ Researching...',
        category: ModeCategory.REASONING,
        intensity: 'medium',
        color: chalk.blue,
      },
    ],
    [
      '✽ Analyzing...',
      {
        mode: '✽ Analyzing...',
        category: ModeCategory.REASONING,
        intensity: 'medium',
        color: chalk.blueBright,
      },
    ],
    [
      '✽ Evaluating...',
      {
        mode: '✽ Evaluating...',
        category: ModeCategory.REASONING,
        intensity: 'medium',
        color: chalk.cyan,
      },
    ],
    [
      '✽ Reasoning...',
      {
        mode: '✽ Reasoning...',
        category: ModeCategory.REASONING,
        intensity: 'medium',
        color: chalk.yellow,
      },
    ],
    [
      '✽ Contemplating...',
      {
        mode: '✽ Contemplating...',
        category: ModeCategory.REASONING,
        intensity: 'low',
        color: chalk.gray,
      },
    ],
    [
      '✽ Reflecting...',
      {
        mode: '✽ Reflecting...',
        category: ModeCategory.REASONING,
        intensity: 'low',
        color: chalk.dim.yellow,
      },
    ],
    [
      '✽ Processing...',
      {
        mode: '✽ Processing...',
        category: ModeCategory.REASONING,
        intensity: 'medium',
        color: chalk.white,
      },
    ],

    // Creative modes
    [
      '✽ Creating...',
      {
        mode: '✽ Creating...',
        category: ModeCategory.CREATIVE,
        intensity: 'high',
        color: chalk.magenta,
      },
    ],
    [
      '✽ Brainstorming...',
      {
        mode: '✽ Brainstorming...',
        category: ModeCategory.CREATIVE,
        intensity: 'high',
        color: chalk.magentaBright,
      },
    ],
    [
      '✽ Inventing...',
      {
        mode: '✽ Inventing...',
        category: ModeCategory.CREATIVE,
        intensity: 'high',
        color: chalk.magenta.bold,
      },
    ],
    [
      '✽ Designing...',
      {
        mode: '✽ Designing...',
        category: ModeCategory.CREATIVE,
        intensity: 'medium',
        color: chalk.magenta,
      },
    ],
    [
      '✽ Drafting...',
      {
        mode: '✽ Drafting...',
        category: ModeCategory.CREATIVE,
        intensity: 'low',
        color: chalk.dim.magenta,
      },
    ],
    [
      '✽ Imagining...',
      {
        mode: '✽ Imagining...',
        category: ModeCategory.CREATIVE,
        intensity: 'medium',
        color: chalk.magenta,
      },
    ],
    [
      '✽ Conceptualizing...',
      {
        mode: '✽ Conceptualizing...',
        category: ModeCategory.CREATIVE,
        intensity: 'high',
        color: chalk.magentaBright,
      },
    ],
    [
      '✽ Innovating...',
      {
        mode: '✽ Innovating...',
        category: ModeCategory.CREATIVE,
        intensity: 'high',
        color: chalk.magenta.bold,
      },
    ],
    [
      '✽ Ideating...',
      {
        mode: '✽ Ideating...',
        category: ModeCategory.CREATIVE,
        intensity: 'medium',
        color: chalk.magenta,
      },
    ],
    [
      '✽ Synthesizing...',
      {
        mode: '✽ Synthesizing...',
        category: ModeCategory.CREATIVE,
        intensity: 'high',
        color: chalk.magentaBright,
      },
    ],

    // Implementation modes
    [
      '✽ Coding...',
      {
        mode: '✽ Coding...',
        category: ModeCategory.IMPLEMENTATION,
        intensity: 'high',
        color: chalk.cyan,
      },
    ],
    [
      '✽ Building...',
      {
        mode: '✽ Building...',
        category: ModeCategory.IMPLEMENTATION,
        intensity: 'high',
        color: chalk.cyanBright,
      },
    ],
    [
      '✽ Implementing...',
      {
        mode: '✽ Implementing...',
        category: ModeCategory.IMPLEMENTATION,
        intensity: 'high',
        color: chalk.cyan.bold,
      },
    ],
    [
      '✽ Developing...',
      {
        mode: '✽ Developing...',
        category: ModeCategory.IMPLEMENTATION,
        intensity: 'medium',
        color: chalk.cyan,
      },
    ],
    [
      '✽ Programming...',
      {
        mode: '✽ Programming...',
        category: ModeCategory.IMPLEMENTATION,
        intensity: 'high',
        color: chalk.cyanBright,
      },
    ],
    [
      '✽ Constructing...',
      {
        mode: '✽ Constructing...',
        category: ModeCategory.IMPLEMENTATION,
        intensity: 'medium',
        color: chalk.cyan,
      },
    ],
    [
      '✽ Architecting...',
      {
        mode: '✽ Architecting...',
        category: ModeCategory.IMPLEMENTATION,
        intensity: 'high',
        color: chalk.cyan.bold,
      },
    ],
    [
      '✽ Engineering...',
      {
        mode: '✽ Engineering...',
        category: ModeCategory.IMPLEMENTATION,
        intensity: 'high',
        color: chalk.cyanBright,
      },
    ],
    [
      '✽ Assembling...',
      {
        mode: '✽ Assembling...',
        category: ModeCategory.IMPLEMENTATION,
        intensity: 'medium',
        color: chalk.cyan,
      },
    ],
    [
      '✽ Integrating...',
      {
        mode: '✽ Integrating...',
        category: ModeCategory.IMPLEMENTATION,
        intensity: 'medium',
        color: chalk.cyan,
      },
    ],

    // Validation modes
    [
      '✽ Testing...',
      {
        mode: '✽ Testing...',
        category: ModeCategory.VALIDATION,
        intensity: 'medium',
        color: chalk.green,
      },
    ],
    [
      '✽ Debugging...',
      {
        mode: '✽ Debugging...',
        category: ModeCategory.VALIDATION,
        intensity: 'high',
        color: chalk.red,
      },
    ],
    [
      '✽ Validating...',
      {
        mode: '✽ Validating...',
        category: ModeCategory.VALIDATION,
        intensity: 'medium',
        color: chalk.green,
      },
    ],
    [
      '✽ Reviewing...',
      {
        mode: '✽ Reviewing...',
        category: ModeCategory.VALIDATION,
        intensity: 'medium',
        color: chalk.greenBright,
      },
    ],
    [
      '✽ Checking...',
      {
        mode: '✽ Checking...',
        category: ModeCategory.VALIDATION,
        intensity: 'low',
        color: chalk.green,
      },
    ],
    [
      '✽ Verifying...',
      {
        mode: '✽ Verifying...',
        category: ModeCategory.VALIDATION,
        intensity: 'medium',
        color: chalk.greenBright,
      },
    ],
    [
      '✽ Inspecting...',
      {
        mode: '✽ Inspecting...',
        category: ModeCategory.VALIDATION,
        intensity: 'medium',
        color: chalk.green,
      },
    ],
    [
      '✽ Auditing...',
      {
        mode: '✽ Auditing...',
        category: ModeCategory.VALIDATION,
        intensity: 'high',
        color: chalk.green.bold,
      },
    ],
    [
      '✽ Examining...',
      {
        mode: '✽ Examining...',
        category: ModeCategory.VALIDATION,
        intensity: 'medium',
        color: chalk.green,
      },
    ],
    [
      '✽ Troubleshooting...',
      {
        mode: '✽ Troubleshooting...',
        category: ModeCategory.VALIDATION,
        intensity: 'high',
        color: chalk.redBright,
      },
    ],

    // Optimization modes
    [
      '✽ Optimizing...',
      {
        mode: '✽ Optimizing...',
        category: ModeCategory.OPTIMIZATION,
        intensity: 'high',
        color: chalk.greenBright,
      },
    ],
    [
      '✽ Refactoring...',
      {
        mode: '✽ Refactoring...',
        category: ModeCategory.OPTIMIZATION,
        intensity: 'high',
        color: chalk.green.bold,
      },
    ],
    [
      '✽ Improving...',
      {
        mode: '✽ Improving...',
        category: ModeCategory.OPTIMIZATION,
        intensity: 'medium',
        color: chalk.green,
      },
    ],
    [
      '✽ Enhancing...',
      {
        mode: '✽ Enhancing...',
        category: ModeCategory.OPTIMIZATION,
        intensity: 'medium',
        color: chalk.greenBright,
      },
    ],
    [
      '✽ Streamlining...',
      {
        mode: '✽ Streamlining...',
        category: ModeCategory.OPTIMIZATION,
        intensity: 'high',
        color: chalk.green.bold,
      },
    ],
    [
      '✽ Polishing...',
      {
        mode: '✽ Polishing...',
        category: ModeCategory.OPTIMIZATION,
        intensity: 'low',
        color: chalk.green,
      },
    ],
    [
      '✽ Tuning...',
      {
        mode: '✽ Tuning...',
        category: ModeCategory.OPTIMIZATION,
        intensity: 'medium',
        color: chalk.greenBright,
      },
    ],
    [
      '✽ Perfecting...',
      {
        mode: '✽ Perfecting...',
        category: ModeCategory.OPTIMIZATION,
        intensity: 'high',
        color: chalk.green.bold,
      },
    ],
    [
      '✽ Documenting...',
      {
        mode: '✽ Documenting...',
        category: ModeCategory.OPTIMIZATION,
        intensity: 'low',
        color: chalk.gray,
      },
    ],
    [
      '✽ Planning...',
      {
        mode: '✽ Planning...',
        category: ModeCategory.OPTIMIZATION,
        intensity: 'medium',
        color: chalk.magenta,
      },
    ],
  ]);

  constructor() {
    this.initializeTransitions();
  }

  /**
   * モード遷移を初期化
   */
  private initializeTransitions(): void {
    // Define natural transitions between modes
    this.modeTransitions.set('✽ Thinking...', [
      '✽ Ultra Thinking...',
      '✽ Researching...',
      '✽ Planning...',
    ]);
    this.modeTransitions.set('✽ Planning...', [
      '✽ Designing...',
      '✽ Architecting...',
      '✽ Coding...',
    ]);
    this.modeTransitions.set('✽ Coding...', ['✽ Testing...', '✽ Debugging...', '✽ Optimizing...']);
    this.modeTransitions.set('✽ Debugging...', [
      '✽ Troubleshooting...',
      '✽ Analyzing...',
      '✽ Coding...',
    ]);
    this.modeTransitions.set('✽ Testing...', [
      '✽ Validating...',
      '✽ Reviewing...',
      '✽ Documenting...',
    ]);
  }

  /**
   * 現在のモードを取得
   */
  getCurrentMode(): InternalMode {
    return this.currentMode;
  }

  /**
   * 現在のモードを設定（同期版）
   */
  setCurrentMode(mode: InternalMode): void {
    if (this.isValidMode(mode)) {
      this.currentMode = mode;
      this.modeHistory.push({
        mode: mode,
        timestamp: new Date(),
      });
      this.notifyUpdate(mode);
    }
  }

  /**
   * 有効なモードかチェック
   */
  private isValidMode(mode: InternalMode): boolean {
    return this.modeInfo.has(mode);
  }

  /**
   * モードインジケーターをレンダリング
   */
  render(): string {
    const modeInfo = this.modeInfo.get(this.currentMode);

    if (!modeInfo) {
      return chalk.gray(`[${this.currentMode}]`);
    }

    const coloredMode = modeInfo.color(`[${modeInfo.mode}]`);
    const intensityIndicator = this.getIntensityIndicator(modeInfo.intensity);

    return `${coloredMode} ${intensityIndicator}`;
  }

  /**
   * 強度インジケーターを取得
   */
  private getIntensityIndicator(intensity: 'low' | 'medium' | 'high'): string {
    switch (intensity) {
      case 'low':
        return chalk.dim('●');
      case 'medium':
        return chalk.yellow('●●');
      case 'high':
        return chalk.red('●●●');
      default:
        return '';
    }
  }

  /**
   * モードを遷移
   */
  async transitionTo(newMode: InternalMode, animate: boolean = true): Promise<void> {
    if (this.isAnimating) return;

    const oldMode = this.currentMode;

    // Add to history
    this.modeHistory.push({
      mode: newMode,
      timestamp: new Date(),
    });

    // Animate transition if requested
    if (animate) {
      await this.animateTransition(oldMode, newMode);
    }

    // Update current mode
    this.currentMode = newMode;

    // Notify callbacks
    this.notifyUpdate(newMode);
  }

  /**
   * モード遷移をアニメーション
   */
  private async animateTransition(from: InternalMode, to: InternalMode): Promise<void> {
    this.isAnimating = true;

    const fromInfo = this.modeInfo.get(from);
    const toInfo = this.modeInfo.get(to);

    if (!fromInfo || !toInfo) {
      this.isAnimating = false;
      return;
    }

    // Smooth transition with color fade
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;

      // Clear line and redraw
      process.stdout.write('\r' + ' '.repeat(80) + '\r');

      if (progress < 0.5) {
        // Fade out old mode
        process.stdout.write(chalk.dim(fromInfo.color(`[${from}]`)));
      } else {
        // Fade in new mode
        process.stdout.write(toInfo.color(`[${to}]`));
      }

      await this.delay(50);
    }

    // Clear the animation line
    process.stdout.write('\r' + ' '.repeat(80) + '\r');

    this.isAnimating = false;
  }

  /**
   * モードを表示
   */
  display(inline: boolean = false): void {
    const info = this.modeInfo.get(this.currentMode);
    if (!info) return;

    const modeDisplay = info.color(`[${this.currentMode}]`);

    if (inline) {
      process.stdout.write(modeDisplay + ' ');
    } else {
      console.log(modeDisplay);
    }
  }

  /**
   * フローティング表示
   */
  displayFloating(x: number = 0, y: number = 0): void {
    const info = this.modeInfo.get(this.currentMode);
    if (!info) return;

    // Save cursor position
    process.stdout.write('\x1b[s');

    // Move to position
    process.stdout.write(`\x1b[${y};${x}H`);

    // Display mode
    process.stdout.write(info.color(`[${this.currentMode}]`));

    // Restore cursor position
    process.stdout.write('\x1b[u');
  }

  /**
   * モードカテゴリーを取得
   */
  getCategory(): ModeCategory {
    const info = this.modeInfo.get(this.currentMode);
    return info ? info.category : ModeCategory.REASONING;
  }

  /**
   * モード強度を取得
   */
  getIntensity(): 'low' | 'medium' | 'high' {
    const info = this.modeInfo.get(this.currentMode);
    return info ? info.intensity : 'medium';
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
  getHistory(): Array<{ mode: InternalMode; timestamp: Date }> {
    return [...this.modeHistory];
  }

  /**
   * モード履歴を取得（別名）
   */
  getModeHistory(): Array<{ mode: InternalMode; timestamp: Date }> {
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
    const history = this.modeHistory;
    const modeCount = new Map<InternalMode, number>();
    const categoriesSet = new Set<string>();

    // Count mode usage
    history.forEach((entry) => {
      const count = modeCount.get(entry.mode) || 0;
      modeCount.set(entry.mode, count + 1);

      const info = this.modeInfo.get(entry.mode);
      if (info) {
        categoriesSet.add(info.category);
      }
    });

    // Find most used mode
    let mostUsedMode: InternalMode = this.currentMode;
    let maxCount = 0;
    modeCount.forEach((count, mode) => {
      if (count > maxCount) {
        maxCount = count;
        mostUsedMode = mode;
      }
    });

    return {
      currentMode: this.currentMode,
      totalTransitions: history.length,
      activeSince: history.length > 0 ? history[0].timestamp : undefined,
      categoriesUsed: Array.from(categoriesSet),
      mostUsedMode,
    };
  }

  /**
   * 最近のモードを取得
   */
  getRecentModes(count: number = 5): InternalMode[] {
    return this.modeHistory.slice(-count).map((entry) => entry.mode);
  }

  /**
   * 更新コールバックを登録
   */
  onUpdate(callback: (mode: InternalMode) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * 更新を通知
   */
  private notifyUpdate(mode: InternalMode): void {
    this.updateCallbacks.forEach((callback) => callback(mode));
  }

  /**
   * 遅延ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * モードをリセット
   */
  reset(): void {
    this.currentMode = '✽ Thinking...';
    this.modeHistory = [];
    this.isAnimating = false;
  }

  /**
   * 全モードリストを取得
   */
  static getAllModes(): InternalMode[] {
    return [
      // Reasoning
      '✽ Thinking...',
      '✽ Ultra Thinking...',
      '✽ Deep Thinking...',
      '✽ Researching...',
      '✽ Analyzing...',
      '✽ Evaluating...',
      '✽ Reasoning...',
      '✽ Contemplating...',
      '✽ Reflecting...',
      '✽ Processing...',
      // Creative
      '✽ Creating...',
      '✽ Brainstorming...',
      '✽ Inventing...',
      '✽ Designing...',
      '✽ Drafting...',
      '✽ Imagining...',
      '✽ Conceptualizing...',
      '✽ Innovating...',
      '✽ Ideating...',
      '✽ Synthesizing...',
      // Implementation
      '✽ Coding...',
      '✽ Building...',
      '✽ Implementing...',
      '✽ Developing...',
      '✽ Programming...',
      '✽ Constructing...',
      '✽ Architecting...',
      '✽ Engineering...',
      '✽ Assembling...',
      '✽ Integrating...',
      // Validation
      '✽ Testing...',
      '✽ Debugging...',
      '✽ Validating...',
      '✽ Reviewing...',
      '✽ Checking...',
      '✽ Verifying...',
      '✽ Inspecting...',
      '✽ Auditing...',
      '✽ Examining...',
      '✽ Troubleshooting...',
      // Optimization
      '✽ Optimizing...',
      '✽ Refactoring...',
      '✽ Improving...',
      '✽ Enhancing...',
      '✽ Streamlining...',
      '✽ Polishing...',
      '✽ Tuning...',
      '✽ Perfecting...',
      '✽ Documenting...',
      '✽ Planning...',
    ];
  }
}

export default ModeIndicator;
