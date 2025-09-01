/**
 * Optimized Progress Display
 * 124文字幅に最適化された高効率プログレス表示システム
 */

import _chalk from "chalk";
import {
  TEXT_HIERARCHY,
  UNIFIED_COLORS,
} from "../design-system/UnifiedColorPalette.js";
import { MINIMAL_ICONS } from "../design-system/MinimalIconRegistry.js";
import { DESIGN_CONSTANTS } from "../optimized-design-system.js";

/**
 * プログレス表示設定
 */
export interface ProgressConfig {
  _width?: number;
  showPercentage?: boolean;
  showTime?: boolean;
  showSpeed?: boolean;
  style?: "_bar" | "_dots" | "_steps" | "circular";
  _color?: (_text: string) => string;
  _label?: string;
  compact?: boolean;
}

/**
 * プログレストラッカー
 */
export interface ProgressTracker {
  update: (_current: number, message?: string) => void;
  complete: (message?: string) => void;
  error: (message?: string) => void;
  setLabel: (_label: string) => void;
}

/**
 * 最適化されたプログレス表示クラス
 */
export class OptimizedProgress {
  private static activeTrackers: Map<string, ProgressTracker> = new Map();

  /**
   * 標準プログレスバー
   */
  static renderBar(
    _current: number,
    total: number,
    config: ProgressConfig = {},
  ): void {
    const _width = config._width || 90;
    const _progress = Math.min(100, Math.floor((_current / total) * 100));
    const _filled = Math.floor((_progress / 100) * _width);
    const _empty = _width - _filled;

    // Build _progress _bar
    const _bar = this.buildProgressBar(_filled, _empty, config);

    // Build output string
    let output = "";

    if (config._label) {
      output += `${TEXT_HIERARCHY.CAPTION(config._label)} `;
    }

    output += _bar;

    if (config.showPercentage !== false) {
      output += ` ${TEXT_HIERARCHY.BODY(`${_progress}%`).padStart(5)}`;
    }

    if (config.showTime) {
      const _time = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      output += ` ${TEXT_HIERARCHY.CAPTION(`[${_time}]`)}`;
    }

    if (config.showSpeed && _current > 0) {
      const _speed = this.calculateSpeed(_current, total);
      output += ` ${TEXT_HIERARCHY.CAPTION(_speed)}`;
    }

    process.stdout.write(`\r${output}`);

    if (_progress === 100) {
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
    const _width = config._width || DESIGN_CONSTANTS.CONTENT_WIDTH;

    // Clear previous output
    process.stdout.write("\u001b[2K\r");

    // Build step indicators
    const _steps: string[] = [];

    for (let i = 0; i < totalSteps; i++) {
      const _stepNum = i + 1;
      const _label = stepLabels?.[i] || `Step ${_stepNum}`;

      let stepIndicator: string;
      if (_stepNum < currentStep) {
        // Completed
        stepIndicator = UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS);
      } else if (_stepNum === currentStep) {
        // Current
        stepIndicator = UNIFIED_COLORS.INFO("◉");
      } else {
        // Pending
        stepIndicator = UNIFIED_COLORS.MUTED("○");
      }

      const _stepText =
        _stepNum === currentStep
          ? TEXT_HIERARCHY.SUBTITLE(_label)
          : TEXT_HIERARCHY.CAPTION(_label);

      steps.push(`${stepIndicator} ${_stepText}`);
    }

    // Display based on _width
    if (config.compact) {
      // Compact: single line
      console.log(_steps.join(" → "));
    } else {
      // Full: multi-line
      steps.forEach((step) => console.log(step));
    }
  }

  /**
   * ドット進捗表示
   */
  static renderDots(
    _current: number,
    total: number,
    config: ProgressConfig = {},
  ): void {
    const _maxDots = 10;
    const _progress = Math.floor((_current / total) * _maxDots);

    const _dots = "●".repeat(_progress) + "○".repeat(_maxDots - _progress);
    const _colored =
      UNIFIED_COLORS.SUCCESS(_dots.substring(0, _progress)) +
      UNIFIED_COLORS.MUTED(_dots.substring(_progress));

    let output = _colored;

    if (config._label) {
      output = `${TEXT_HIERARCHY.CAPTION(config._label)} ${output}`;
    }

    if (config.showPercentage !== false) {
      const _percentage = Math.floor((_current / total) * 100);
      output += ` ${TEXT_HIERARCHY.BODY(`${_percentage}%`)}`;
    }

    process.stdout.write(`\r${output}`);

    if (_current >= total) {
      console.log();
    }
  }

  /**
   * 円形プログレス表示(ASCII)
   */
  static renderCircular(
    _current: number,
    total: number,
    config: ProgressConfig = {},
  ): void {
    const _progress = Math.floor((_current / total) * 100);
    const _segments = ["◐", "◓", "◑", "◒"];
    const _segmentIndex = Math.floor((_progress / 100) * _segments.length);

    const _icon =
      _progress === 100
        ? UNIFIED_COLORS.SUCCESS("◉")
        : UNIFIED_COLORS.INFO(_segments[_segmentIndex % _segments.length]);

    let output = `${_icon} ${TEXT_HIERARCHY.BODY(`${_progress}%`)}`;

    if (config._label) {
      output += ` ${TEXT_HIERARCHY.CAPTION(config._label)}`;
    }

    process.stdout.write(`\r${output}`);

    if (_progress === 100) {
      console.log();
    }
  }

  /**
   * マルチタスク進捗表示
   */
  static renderMultiTask(
    tasks: Array<{
      name: string;
      _current: number;
      total: number;
      status?: "pending" | "running" | "completed" | "error";
    }>,
    config: ProgressConfig = {},
  ): void {
    // Clear screen area for tasks
    const _lines = tasks.length + 2;
    process.stdout.write(`\u001b[${_lines}A\u001b[J`);

    console.log(TEXT_HIERARCHY.SUBTITLE("Tasks Progress:"));
    console.log(UNIFIED_COLORS.MUTED("─".repeat(config.width || 80)));

    tasks.forEach((task) => {
      const _progress = Math.floor((task._current / task.total) * 100);
      const _barWidth = 30;
      const _filled = Math.floor((_progress / 100) * _barWidth);
      const _empty = _barWidth - _filled;

      let statusIcon: string;
      switch (task.status) {
        case "completed":
          statusIcon = UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS);
          break;
        case "running":
          statusIcon = UNIFIED_COLORS.INFO("◉");
          break;
        case "error":
          statusIcon = UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR);
          break;
        default:
          statusIcon = UNIFIED_COLORS.MUTED("○");
      }

      const _bar =
        UNIFIED_COLORS.SUCCESS("█".repeat(_filled)) +
        UNIFIED_COLORS.MUTED("░".repeat(_empty));

      const _taskName = task.name.padEnd(20).substring(0, 20);

      console.log(
        `${statusIcon} ${TEXT_HIERARCHY.BODY(_taskName)} ${_bar} ${TEXT_HIERARCHY.CAPTION(`${_progress}%`)}`,
      );
    });
  }

  /**
   * 進捗トラッカーを作成
   */
  static createTracker(
    _total: number,
    config: ProgressConfig = {},
  ): ProgressTracker {
    const _trackerId = Date.now().toString();
    let currentValue = 0;
    let _label = config._label || "";

    const tracker: ProgressTracker = {
      update: (_current: number, message?: string) => {
        currentValue = _current;
        if (message) {
          _label = message;
        }

        this.renderBar(currentValue, _total, { ...config, _label });
      },

      complete: (message?: string) => {
        currentValue = _total;
        this.renderBar(_total, _total, {
          ...config,
          _label: message || _label,
        });
        console.log();
        this.activeTrackers.delete(_trackerId);
      },

      error: (message?: string) => {
        process.stdout.write("\r\u001b[2K");
        console.log(
          `${UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR)} ${TEXT_HIERARCHY.BODY(message || "Error occurred")}`,
        );
        this.activeTrackers.delete(_trackerId);
      },

      setLabel: (_newLabel: string) => {
        _label = _newLabel;
      },
    };

    this.activeTrackers.set(_trackerId, tracker);
    return tracker;
  }

  /**
   * インデターミネート進捗表示(終了時間不明)
   */
  static renderIndeterminate(
    _message: string,
    config: ProgressConfig = {},
  ): NodeJS.Timeout {
    const _width = config._width || 40;
    const _bounceWidth = 10;
    let position = 0;
    let direction = 1;

    const _interval = setInterval(() => {
      const _bar =
        " ".repeat(position) +
        UNIFIED_COLORS.INFO("█".repeat(_bounceWidth)) +
        " ".repeat(Math.max(0, _width - position - _bounceWidth));

      process.stdout.write(`\r${TEXT_HIERARCHY.BODY(_message)} [${_bar}]`);

      position += direction;
      if (position >= _width - _bounceWidth || position <= 0) {
        direction *= -1;
      }
    }, 50);

    return _interval;
  }

  /**
   * スムーズプログレスバー(段階的更新)
   */
  static async renderSmooth(
    targetProgress: number,
    config: ProgressConfig & { _duration?: number } = {},
  ): Promise<void> {
    const _duration = config._duration || 1000;
    const _steps = 50;
    const _stepDelay = _duration / _steps;

    for (let i = 0; i <= _steps; i++) {
      const _current = Math.floor((i / _steps) * targetProgress);
      this.renderBar(_current, 100, config);
      await new Promise((resolve) => setTimeout(resolve, _stepDelay));
    }

    console.log();
  }

  /**
   * プログレスバーを構築
   */
  private static buildProgressBar(
    _filled: number,
    _empty: number,
    config: ProgressConfig,
  ): string {
    const _color = config._color || UNIFIED_COLORS.SUCCESS;

    switch (config.style) {
      case "_dots":
        return (
          _color("●".repeat(_filled)) + UNIFIED_COLORS.MUTED("○".repeat(_empty))
        );

      case "_steps":
        return (
          _color("▰".repeat(_filled)) + UNIFIED_COLORS.MUTED("▱".repeat(_empty))
        );

      case "circular":
        {
          const _segments = Math.floor(_filled / 10);
        }
        return (
          _color("◉".repeat(_segments)) +
          UNIFIED_COLORS.MUTED("○".repeat(10 - _segments))
        );

      default:
        return (
          _color("█".repeat(_filled)) + UNIFIED_COLORS.MUTED("░".repeat(_empty))
        );
    }
  }

  /**
   * 速度を計算
   */
  private static calculateSpeed(_current: number, total: number): string {
    const _remaining = total - _current;
    const _estimatedTime = _remaining * 0.1; // Simplified calculation

    if (_estimatedTime < 60) {
      return `~${Math.floor(_estimatedTime)}s`;
    } else if (_estimatedTime < 3600) {
      return `~${Math.floor(_estimatedTime / 60)}m`;
    } else {
      return `~${Math.floor(_estimatedTime / 3600)}h`;
    }
  }

  /**
   * すべてのアクティブトラッカーをクリア
   */
  static clearAll(): void {
    this.activeTrackers.clear();
    process.stdout.write("\u001b[2K\r");
  }
}

export default OptimizedProgress;
