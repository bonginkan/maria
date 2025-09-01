/**
 * Optimized Animations
 * 124文字幅に最適化されたアニメーションシステム
 */

import chalk from "chalk";
import {
  TEXT_HIERARCHY,
  UNIFIED_COLORS,
} from "../design-system/UnifiedColorPalette.js";
import { MINIMAL_ICONS } from "../design-system/MinimalIconRegistry.js";
import { DESIGN_CONSTANTS } from "../optimized-design-system.js";

/**
 * スピナーコントローラーインターフェース
 */
export interface SpinnerController {
  stop: (success?: boolean) => void;
  update: (_message: string) => void;
}

/**
 * アニメーション設定
 */
export interface AnimationConfig {
  _speed?: number;
  _color?: (_text: string) => string;
  _smooth?: boolean;
}

/**
 * 最適化されたアニメーションクラス
 */
export class OptimizedAnimations {
  /**
   * タイプライター効果でテキストを表示
   */
  static async typewriter(
    _text: string,
    config: AnimationConfig = {},
  ): Promise<void> {
    const _speed = config._speed || 30;
    const _color = config._color || UNIFIED_COLORS.PRIMARY;
    const _smooth = config._smooth !== false;

    // Smooth modeでは各文字を段階的に表示
    if (_smooth) {
      for (const char of _text) {
        process.stdout.write(_color(char));
        await this.delay(_speed);
      }
    } else {
      // Fast modeでは単語単位で表示
      const _words = _text.split(" ");
      for (let i = 0; i < _words.length; i++) {
        process.stdout.write(_color(_words[i]));
        if (i < _words.length - 1) {
          process.stdout.write(" ");
        }
        await this.delay(_speed * 2);
      }
    }
    console.log();
  }

  /**
   * スピナーアニメーション
   */
  static spinner(
    _message: string,
    config: AnimationConfig = {},
  ): SpinnerController {
    const _frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const _color = config._color || UNIFIED_COLORS.INFO;
    let frameIndex = 0;
    let currentMessage = message;

    const _interval = setInterval(() => {
      process.stdout.write(
        `\r${_color(_frames[frameIndex])} ${TEXT_HIERARCHY.BODY(currentMessage)}`,
      );
      frameIndex = (frameIndex + 1) % _frames.length;
    }, 80);

    return {
      stop: (success = true) => {
        clearInterval(_interval);
        const _icon = success
          ? UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS)
          : UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR);
        process.stdout.write(
          `\r${_icon} ${TEXT_HIERARCHY.BODY(currentMessage)}\n`,
        );
      },
      update: (_newMessage: string) => {
        currentMessage = _newMessage;
      },
    };
  }

  /**
   * プログレスバーアニメーション
   */
  static async progressBar(
    total: number,
    onProgress?: (_current: number) => string,
    config: AnimationConfig = {},
  ): Promise<void> {
    const _width = 90;
    const _speed = config._speed || 50;

    for (let _current = 0; _current <= total; _current++) {
      const _progress = Math.floor((_current / total) * 100);
      const _filled = Math.floor((_progress / 100) * _width);
      const _empty = _width - _filled;

      const _bar =
        UNIFIED_COLORS.SUCCESS("█".repeat(_filled)) +
        UNIFIED_COLORS.MUTED("░".repeat(_empty));

      const _percentage = TEXT_HIERARCHY.BODY(`${_progress}%`).padStart(5);
      const _label = onProgress ? onProgress(_current) : "";

      process.stdout.write(
        `\r${_bar} ${_percentage} ${TEXT_HIERARCHY.CAPTION(_label)}`,
      );

      if (_current < total) {
        await this.delay(_speed);
      }
    }
    console.log();
  }

  /**
   * パルスアニメーション(点滅効果)
   */
  static async pulse(
    _text: string,
    count: number = 3,
    config: AnimationConfig = {},
  ): Promise<void> {
    const _speed = config._speed || 300;
    const _color = config._color || UNIFIED_COLORS.ACCENT;

    for (let i = 0; i < count; i++) {
      process.stdout.write(`\r${_color(_text)}`);
      await this.delay(_speed);
      process.stdout.write(`\r${" ".repeat(_text.length)}`);
      await this.delay(_speed / 2);
    }
    process.stdout.write(`\r${_color(_text)}\n`);
  }

  /**
   * フェードイン効果
   */
  static async fadeIn(
    _lines: string[],
    config: AnimationConfig = {},
  ): Promise<void> {
    const _speed = config._speed || 100;
    const _color = config._color || TEXT_HIERARCHY.BODY;

    for (const line of _lines) {
      // 段階的に不透明度を上げる効果をシミュレート
      process.stdout.write(chalk.dim(_color(line)));
      await this.delay(_speed / 2);
      process.stdout.write(`\r${_color(line)}\n`);
      await this.delay(_speed);
    }
  }

  /**
   * ローディングドット
   */
  static loadingDots(
    _message: string,
    config: AnimationConfig = {},
  ): SpinnerController {
    const _maxDots = 3;
    let dots = 0;
    const _color = config._color || UNIFIED_COLORS.INFO;

    const _interval = setInterval(() => {
      const _dotsStr = ".".repeat(dots) + " ".repeat(_maxDots - dots);
      process.stdout.write(
        `\r${TEXT_HIERARCHY.BODY(_message)}${_color(_dotsStr)}`,
      );
      dots = (dots + 1) % (_maxDots + 1);
    }, 400);

    return {
      stop: (success = true) => {
        clearInterval(_interval);
        const _icon = success
          ? UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS)
          : UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR);
        process.stdout.write(`\r${_icon} ${TEXT_HIERARCHY.BODY(_message)}\n`);
      },
      update: (_newMessage: string) => {
        // Not supported for dots animation
      },
    };
  }

  /**
   * カウントダウンアニメーション
   */
  static async countdown(
    seconds: number,
    message: string = "Starting in",
    config: AnimationConfig = {},
  ): Promise<void> {
    const _color = config._color || UNIFIED_COLORS.WARNING;

    for (let i = seconds; i > 0; i--) {
      process.stdout.write(
        `\r${TEXT_HIERARCHY.BODY(_message)} ${_color(i.toString())}...`,
      );
      await this.delay(1000);
    }
    process.stdout.write(
      `\r${UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS)} ${TEXT_HIERARCHY.BODY("Ready!")}\n`,
    );
  }

  /**
   * スライドイン効果(右から左へ)
   */
  static async slideIn(
    _text: string,
    config: AnimationConfig = {},
  ): Promise<void> {
    const _speed = config._speed || 20;
    const _color = config._color || TEXT_HIERARCHY.BODY;
    const _maxWidth = DESIGN_CONSTANTS.CONTENT_WIDTH;
    const _textLength = _text.length;

    for (let pos = _maxWidth; pos >= 0; pos--) {
      const _spaces = " ".repeat(Math.max(0, pos));
      const _visibleText = _text.substring(
        0,
        Math.min(_textLength, _maxWidth - pos),
      );
      process.stdout.write(`\r${_spaces}${_color(_visibleText)}`);
      await this.delay(_speed);
    }
    console.log();
  }

  /**
   * 波形アニメーション
   */
  static waveAnimation(
    _message: string,
    config: AnimationConfig = {},
  ): SpinnerController {
    const _waves = [
      "▁",
      "▂",
      "▃",
      "▄",
      "▅",
      "▆",
      "▇",
      "█",
      "▇",
      "▆",
      "▅",
      "▄",
      "▃",
      "▂",
    ];
    const _color = config._color || UNIFIED_COLORS.INFO;
    let frameIndex = 0;

    const _interval = setInterval(() => {
      const _wave = _waves.slice(frameIndex, frameIndex + 5).join("");
      process.stdout.write(
        `\r${_color(_wave)} ${TEXT_HIERARCHY.BODY(_message)}`,
      );
      frameIndex = (frameIndex + 1) % (_waves.length - 4);
    }, 100);

    return {
      stop: (success = true) => {
        clearInterval(_interval);
        const _icon = success
          ? UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS)
          : UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR);
        process.stdout.write(`\r${_icon} ${TEXT_HIERARCHY.BODY(_message)}\n`);
      },
      update: (_newMessage: string) => {
        // Not supported for _wave animation
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
    const _speed = config._speed || 50;

    // Fade out
    for (let i = fromContent.length - 1; i >= 0; i--) {
      process.stdout.write("\u001b[1A\u001b[2K"); // Move up and clear line
      await this.delay(_speed);
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
    const _steps = 5;
    const _speed = config._speed || 100;
    const _color = config._color || TEXT_HIERARCHY.BODY;

    for (let i = 0; i <= _steps; i++) {
      const _opacity = i / _steps;
      // Simulate _opacity with chalk dim/bright
      const _text =
        _opacity < 0.5 ? chalk.dim(_color(oldText)) : _color(newText);

      process.stdout.write(`\r${_text}`);
      await this.delay(_speed);
    }
    console.log();
  }

  /**
   * スライド切り替え
   */
  static async slideTransition(
    lines: string[],
    direction: "up" | "down" = "up",
    config: AnimationConfig = {},
  ): Promise<void> {
    const _speed = config._speed || 30;
    const _color = config._color || TEXT_HIERARCHY.BODY;

    if (direction === "up") {
      for (const line of lines) {
        console.log(_color(line));
        await this.delay(_speed);
      }
    } else {
      for (let i = lines.length - 1; i >= 0; i--) {
        console.log(_color(lines[i]));
        await this.delay(_speed);
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
