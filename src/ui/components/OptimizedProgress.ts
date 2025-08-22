/**
 * Optimized Progress Display
 * 124文字幅に最適化された高効率プログレス表示システム
 */

import chalk from 'chalk';
import { UNIFIED_COLORS, TEXT_HIERARCHY } from '../design-system/UnifiedColorPalette.js';
import { MINIMAL_ICONS } from '../design-system/MinimalIconRegistry.js';
import { DESIGN_CONSTANTS } from '../optimized-design-system.js';

/**
 * プログレス表示設定
 */
export interface ProgressConfig {
  width?: number;
  showPercentage?: boolean;
  showTime?: boolean;
  showSpeed?: boolean;
  style?: 'bar' | 'dots' | 'steps' | 'circular';
  color?: (text: string) => string;
  label?: string;
  compact?: boolean;
}

/**
 * プログレストラッカー
 */
export interface ProgressTracker {
  update: (current: number, message?: string) => void;
  complete: (message?: string) => void;
  error: (message?: string) => void;
  setLabel: (label: string) => void;
}

/**
 * 最適化されたプログレス表示クラス
 */
export class OptimizedProgress {
  private static activeTrackers: Map<string, ProgressTracker> = new Map();

  /**
   * 標準プログレスバー
   */
  static renderBar(current: number, total: number, config: ProgressConfig = {}): void {
    const width = config.width || 60;
    const progress = Math.min(100, Math.floor((current / total) * 100));
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;

    // Build progress bar
    const bar = this.buildProgressBar(filled, empty, config);

    // Build output string
    let output = '';

    if (config.label) {
      output += TEXT_HIERARCHY.CAPTION(config.label) + ' ';
    }

    output += bar;

    if (config.showPercentage !== false) {
      output += ` ${TEXT_HIERARCHY.BODY(`${progress}%`).padStart(5)}`;
    }

    if (config.showTime) {
      const time = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      output += ` ${TEXT_HIERARCHY.CAPTION(`[${time}]`)}`;
    }

    if (config.showSpeed && current > 0) {
      const speed = this.calculateSpeed(current, total);
      output += ` ${TEXT_HIERARCHY.CAPTION(speed)}`;
    }

    process.stdout.write(`\r${output}`);

    if (progress === 100) {
      console.log();
    }
  }

  /**
   * ステップ進捗表示
   */
  static renderSteps(
    currentStep: number,
    totalSteps: number,
    stepLabels?: string[],
    config: ProgressConfig = {},
  ): void {
    const width = config.width || DESIGN_CONSTANTS.CONTENT_WIDTH;

    // Clear previous output
    process.stdout.write('\x1b[2K\r');

    // Build step indicators
    const steps: string[] = [];

    for (let i = 0; i < totalSteps; i++) {
      const stepNum = i + 1;
      const label = stepLabels?.[i] || `Step ${stepNum}`;

      let stepIndicator: string;
      if (stepNum < currentStep) {
        // Completed
        stepIndicator = UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS);
      } else if (stepNum === currentStep) {
        // Current
        stepIndicator = UNIFIED_COLORS.INFO('◉');
      } else {
        // Pending
        stepIndicator = UNIFIED_COLORS.MUTED('○');
      }

      const stepText =
        stepNum === currentStep ? TEXT_HIERARCHY.SUBTITLE(label) : TEXT_HIERARCHY.CAPTION(label);

      steps.push(`${stepIndicator} ${stepText}`);
    }

    // Display based on width
    if (config.compact) {
      // Compact: single line
      console.log(steps.join(' → '));
    } else {
      // Full: multi-line
      steps.forEach((step) => console.log(step));
    }
  }

  /**
   * ドット進捗表示
   */
  static renderDots(current: number, total: number, config: ProgressConfig = {}): void {
    const maxDots = 10;
    const progress = Math.floor((current / total) * maxDots);

    const dots = '●'.repeat(progress) + '○'.repeat(maxDots - progress);
    const colored =
      UNIFIED_COLORS.SUCCESS(dots.substring(0, progress)) +
      UNIFIED_COLORS.MUTED(dots.substring(progress));

    let output = colored;

    if (config.label) {
      output = TEXT_HIERARCHY.CAPTION(config.label) + ' ' + output;
    }

    if (config.showPercentage !== false) {
      const percentage = Math.floor((current / total) * 100);
      output += ` ${TEXT_HIERARCHY.BODY(`${percentage}%`)}`;
    }

    process.stdout.write(`\r${output}`);

    if (current >= total) {
      console.log();
    }
  }

  /**
   * 円形プログレス表示（ASCII）
   */
  static renderCircular(current: number, total: number, config: ProgressConfig = {}): void {
    const progress = Math.floor((current / total) * 100);
    const segments = ['◐', '◓', '◑', '◒'];
    const segmentIndex = Math.floor((progress / 100) * segments.length);

    const icon =
      progress === 100
        ? UNIFIED_COLORS.SUCCESS('◉')
        : UNIFIED_COLORS.INFO(segments[segmentIndex % segments.length]);

    let output = `${icon} ${TEXT_HIERARCHY.BODY(`${progress}%`)}`;

    if (config.label) {
      output += ` ${TEXT_HIERARCHY.CAPTION(config.label)}`;
    }

    process.stdout.write(`\r${output}`);

    if (progress === 100) {
      console.log();
    }
  }

  /**
   * マルチタスク進捗表示
   */
  static renderMultiTask(
    tasks: Array<{
      name: string;
      current: number;
      total: number;
      status?: 'pending' | 'running' | 'completed' | 'error';
    }>,
    config: ProgressConfig = {},
  ): void {
    // Clear screen area for tasks
    const lines = tasks.length + 2;
    process.stdout.write(`\x1b[${lines}A\x1b[J`);

    console.log(TEXT_HIERARCHY.SUBTITLE('Tasks Progress:'));
    console.log(UNIFIED_COLORS.MUTED('─'.repeat(config.width || 80)));

    tasks.forEach((task) => {
      const progress = Math.floor((task.current / task.total) * 100);
      const barWidth = 30;
      const filled = Math.floor((progress / 100) * barWidth);
      const empty = barWidth - filled;

      let statusIcon: string;
      switch (task.status) {
        case 'completed':
          statusIcon = UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS);
          break;
        case 'running':
          statusIcon = UNIFIED_COLORS.INFO('◉');
          break;
        case 'error':
          statusIcon = UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR);
          break;
        default:
          statusIcon = UNIFIED_COLORS.MUTED('○');
      }

      const bar =
        UNIFIED_COLORS.SUCCESS('█'.repeat(filled)) + UNIFIED_COLORS.MUTED('░'.repeat(empty));

      const taskName = task.name.padEnd(20).substring(0, 20);

      console.log(
        `${statusIcon} ${TEXT_HIERARCHY.BODY(taskName)} ${bar} ${TEXT_HIERARCHY.CAPTION(`${progress}%`)}`,
      );
    });
  }

  /**
   * 進捗トラッカーを作成
   */
  static createTracker(total: number, config: ProgressConfig = {}): ProgressTracker {
    const trackerId = Date.now().toString();
    let currentValue = 0;
    let label = config.label || '';

    const tracker: ProgressTracker = {
      update: (current: number, message?: string) => {
        currentValue = current;
        if (message) label = message;

        this.renderBar(currentValue, total, { ...config, label });
      },

      complete: (message?: string) => {
        currentValue = total;
        this.renderBar(total, total, { ...config, label: message || label });
        console.log();
        this.activeTrackers.delete(trackerId);
      },

      error: (message?: string) => {
        process.stdout.write('\r\x1b[2K');
        console.log(
          `${UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR)} ${TEXT_HIERARCHY.BODY(message || 'Error occurred')}`,
        );
        this.activeTrackers.delete(trackerId);
      },

      setLabel: (newLabel: string) => {
        label = newLabel;
      },
    };

    this.activeTrackers.set(trackerId, tracker);
    return tracker;
  }

  /**
   * インデターミネート進捗表示（終了時間不明）
   */
  static renderIndeterminate(message: string, config: ProgressConfig = {}): NodeJS.Timeout {
    const width = config.width || 40;
    const bounceWidth = 10;
    let position = 0;
    let direction = 1;

    const interval = setInterval(() => {
      const bar =
        ' '.repeat(position) +
        UNIFIED_COLORS.INFO('█'.repeat(bounceWidth)) +
        ' '.repeat(Math.max(0, width - position - bounceWidth));

      process.stdout.write(`\r${TEXT_HIERARCHY.BODY(message)} [${bar}]`);

      position += direction;
      if (position >= width - bounceWidth || position <= 0) {
        direction *= -1;
      }
    }, 50);

    return interval;
  }

  /**
   * スムーズプログレスバー（段階的更新）
   */
  static async renderSmooth(
    targetProgress: number,
    config: ProgressConfig & { duration?: number } = {},
  ): Promise<void> {
    const duration = config.duration || 1000;
    const steps = 50;
    const stepDelay = duration / steps;

    for (let i = 0; i <= steps; i++) {
      const current = Math.floor((i / steps) * targetProgress);
      this.renderBar(current, 100, config);
      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }

    console.log();
  }

  /**
   * プログレスバーを構築
   */
  private static buildProgressBar(filled: number, empty: number, config: ProgressConfig): string {
    const color = config.color || UNIFIED_COLORS.SUCCESS;

    switch (config.style) {
      case 'dots':
        return color('●'.repeat(filled)) + UNIFIED_COLORS.MUTED('○'.repeat(empty));

      case 'steps':
        return color('▰'.repeat(filled)) + UNIFIED_COLORS.MUTED('▱'.repeat(empty));

      case 'circular':
        const segments = Math.floor(filled / 10);
        return color('◉'.repeat(segments)) + UNIFIED_COLORS.MUTED('○'.repeat(10 - segments));

      default:
        return color('█'.repeat(filled)) + UNIFIED_COLORS.MUTED('░'.repeat(empty));
    }
  }

  /**
   * 速度を計算
   */
  private static calculateSpeed(current: number, total: number): string {
    const remaining = total - current;
    const estimatedTime = remaining * 0.1; // Simplified calculation

    if (estimatedTime < 60) {
      return `~${Math.floor(estimatedTime)}s`;
    } else if (estimatedTime < 3600) {
      return `~${Math.floor(estimatedTime / 60)}m`;
    } else {
      return `~${Math.floor(estimatedTime / 3600)}h`;
    }
  }

  /**
   * すべてのアクティブトラッカーをクリア
   */
  static clearAll(): void {
    this.activeTrackers.clear();
    process.stdout.write('\x1b[2K\r');
  }
}

export default OptimizedProgress;
