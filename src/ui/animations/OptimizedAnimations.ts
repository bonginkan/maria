/**
 * Optimized Animations
 * 124文字幅に最適化されたアニメーションシステム
 */

import chalk from 'chalk';
import { TEXT_HIERARCHY, UNIFIED_COLORS } from '../design-system/UnifiedColorPalette.js';
import { MINIMAL_ICONS } from '../design-system/MinimalIconRegistry.js';
import { DESIGN_CONSTANTS } from '../optimized-design-system.js';

/**
 * スピナーコントローラーインターフェース
 */
export interface SpinnerController {
  stop: (success?: boolean) => void;
  update: (message: string) => void;
}

/**
 * アニメーション設定
 */
export interface AnimationConfig {
  speed?: number;
  color?: (text: string) => string;
  smooth?: boolean;
}

/**
 * 最適化されたアニメーションクラス
 */
export class OptimizedAnimations {
  /**
   * タイプライター効果でテキストを表示
   */
  static async typewriter(text: string, config: AnimationConfig = {}): Promise<void> {
    const speed = config.speed || 30;
    const color = config.color || UNIFIED_COLORS.PRIMARY;
    const smooth = config.smooth !== false;

    // Smooth modeでは各文字を段階的に表示
    if (smooth) {
      for (const char of text) {
        process.stdout.write(color(char));
        await this.delay(speed);
      }
    } else {
      // Fast modeでは単語単位で表示
      const words = text.split(' ');
      for (let i = 0; i < words.length; i++) {
        process.stdout.write(color(words[i]));
        if (i < words.length - 1) {
          process.stdout.write(' ');
        }
        await this.delay(speed * 2);
      }
    }
    console.log();
  }

  /**
   * スピナーアニメーション
   */
  static spinner(message: string, config: AnimationConfig = {}): SpinnerController {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const color = config.color || UNIFIED_COLORS.INFO;
    let frameIndex = 0;
    let currentMessage = message;

    const interval = setInterval(() => {
      process.stdout.write(`\r${color(frames[frameIndex])} ${TEXT_HIERARCHY.BODY(currentMessage)}`);
      frameIndex = (frameIndex + 1) % frames.length;
    }, 80);

    return {
      stop: (success = true) => {
        clearInterval(interval);
        const icon = success
          ? UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS)
          : UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR);
        process.stdout.write(`\r${icon} ${TEXT_HIERARCHY.BODY(currentMessage)}\n`);
      },
      update: (newMessage: string) => {
        currentMessage = newMessage;
      },
    };
  }

  /**
   * プログレスバーアニメーション
   */
  static async progressBar(
    total: number,
    onProgress?: (current: number) => string,
    config: AnimationConfig = {},
  ): Promise<void> {
    const width = 60;
    const speed = config.speed || 50;

    for (let current = 0; current <= total; current++) {
      const progress = Math.floor((current / total) * 100);
      const filled = Math.floor((progress / 100) * width);
      const empty = width - filled;

      const bar =
        UNIFIED_COLORS.SUCCESS('█'.repeat(filled)) + UNIFIED_COLORS.MUTED('░'.repeat(empty));

      const percentage = TEXT_HIERARCHY.BODY(`${progress}%`).padStart(5);
      const label = onProgress ? onProgress(current) : '';

      process.stdout.write(`\r${bar} ${percentage} ${TEXT_HIERARCHY.CAPTION(label)}`);

      if (current < total) {
        await this.delay(speed);
      }
    }
    console.log();
  }

  /**
   * パルスアニメーション（点滅効果）
   */
  static async pulse(text: string, count: number = 3, config: AnimationConfig = {}): Promise<void> {
    const speed = config.speed || 300;
    const color = config.color || UNIFIED_COLORS.ACCENT;

    for (let i = 0; i < count; i++) {
      process.stdout.write(`\r${color(text)}`);
      await this.delay(speed);
      process.stdout.write(`\r${' '.repeat(text.length)}`);
      await this.delay(speed / 2);
    }
    process.stdout.write(`\r${color(text)}\n`);
  }

  /**
   * フェードイン効果
   */
  static async fadeIn(lines: string[], config: AnimationConfig = {}): Promise<void> {
    const speed = config.speed || 100;
    const color = config.color || TEXT_HIERARCHY.BODY;

    for (const line of lines) {
      // 段階的に不透明度を上げる効果をシミュレート
      process.stdout.write(chalk.dim(color(line)));
      await this.delay(speed / 2);
      process.stdout.write(`\r${color(line)}\n`);
      await this.delay(speed);
    }
  }

  /**
   * ローディングドット
   */
  static loadingDots(message: string, config: AnimationConfig = {}): SpinnerController {
    const maxDots = 3;
    let dots = 0;
    const color = config.color || UNIFIED_COLORS.INFO;

    const interval = setInterval(() => {
      const dotsStr = '.'.repeat(dots) + ' '.repeat(maxDots - dots);
      process.stdout.write(`\r${TEXT_HIERARCHY.BODY(message)}${color(dotsStr)}`);
      dots = (dots + 1) % (maxDots + 1);
    }, 400);

    return {
      stop: (success = true) => {
        clearInterval(interval);
        const icon = success
          ? UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS)
          : UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR);
        process.stdout.write(`\r${icon} ${TEXT_HIERARCHY.BODY(message)}\n`);
      },
      update: (newMessage: string) => {
        // Not supported for dots animation
      },
    };
  }

  /**
   * カウントダウンアニメーション
   */
  static async countdown(
    seconds: number,
    message: string = 'Starting in',
    config: AnimationConfig = {},
  ): Promise<void> {
    const color = config.color || UNIFIED_COLORS.WARNING;

    for (let i = seconds; i > 0; i--) {
      process.stdout.write(`\r${TEXT_HIERARCHY.BODY(message)} ${color(i.toString())}...`);
      await this.delay(1000);
    }
    process.stdout.write(
      `\r${UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS)} ${TEXT_HIERARCHY.BODY('Ready!')}\n`,
    );
  }

  /**
   * スライドイン効果（右から左へ）
   */
  static async slideIn(text: string, config: AnimationConfig = {}): Promise<void> {
    const speed = config.speed || 20;
    const color = config.color || TEXT_HIERARCHY.BODY;
    const maxWidth = DESIGN_CONSTANTS.CONTENT_WIDTH;
    const textLength = text.length;

    for (let pos = maxWidth; pos >= 0; pos--) {
      const spaces = ' '.repeat(Math.max(0, pos));
      const visibleText = text.substring(0, Math.min(textLength, maxWidth - pos));
      process.stdout.write(`\r${spaces}${color(visibleText)}`);
      await this.delay(speed);
    }
    console.log();
  }

  /**
   * 波形アニメーション
   */
  static waveAnimation(message: string, config: AnimationConfig = {}): SpinnerController {
    const waves = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'];
    const color = config.color || UNIFIED_COLORS.INFO;
    let frameIndex = 0;

    const interval = setInterval(() => {
      const wave = waves.slice(frameIndex, frameIndex + 5).join('');
      process.stdout.write(`\r${color(wave)} ${TEXT_HIERARCHY.BODY(message)}`);
      frameIndex = (frameIndex + 1) % (waves.length - 4);
    }, 100);

    return {
      stop: (success = true) => {
        clearInterval(interval);
        const icon = success
          ? UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS)
          : UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR);
        process.stdout.write(`\r${icon} ${TEXT_HIERARCHY.BODY(message)}\n`);
      },
      update: (newMessage: string) => {
        // Not supported for wave animation
      },
    };
  }

  /**
   * 遅延ユーティリティ
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * トランジション効果クラス
 */
export class TransitionEffects {
  /**
   * スムーズなシーン切り替え
   */
  static async smoothTransition(
    fromContent: string[],
    toContent: string[],
    config: AnimationConfig = {},
  ): Promise<void> {
    const speed = config.speed || 50;

    // Fade out
    for (let i = fromContent.length - 1; i >= 0; i--) {
      process.stdout.write('\x1b[1A\x1b[2K'); // Move up and clear line
      await this.delay(speed);
    }

    // Fade in
    await OptimizedAnimations.fadeIn(toContent, config);
  }

  /**
   * クロスフェード効果
   */
  static async crossFade(
    oldText: string,
    newText: string,
    config: AnimationConfig = {},
  ): Promise<void> {
    const steps = 5;
    const speed = config.speed || 100;
    const color = config.color || TEXT_HIERARCHY.BODY;

    for (let i = 0; i <= steps; i++) {
      const opacity = i / steps;
      // Simulate opacity with chalk dim/bright
      const text = opacity < 0.5 ? chalk.dim(color(oldText)) : color(newText);

      process.stdout.write(`\r${text}`);
      await this.delay(speed);
    }
    console.log();
  }

  /**
   * スライド切り替え
   */
  static async slideTransition(
    lines: string[],
    direction: 'up' | 'down' = 'up',
    config: AnimationConfig = {},
  ): Promise<void> {
    const speed = config.speed || 30;
    const color = config.color || TEXT_HIERARCHY.BODY;

    if (direction === 'up') {
      for (const line of lines) {
        console.log(color(line));
        await this.delay(speed);
      }
    } else {
      for (let i = lines.length - 1; i >= 0; i--) {
        console.log(color(lines[i]));
        await this.delay(speed);
      }
    }
  }

  /**
   * 遅延ユーティリティ
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default OptimizedAnimations;
