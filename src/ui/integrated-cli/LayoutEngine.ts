/**
 * LayoutEngine Component
 * レイアウト管理とコンポーネント配置
 */

import chalk from "chalk";
import { _DESIGN_CONSTANTS } from "../optimized-design-system.js";

/**
 * レイアウト設定
 */
export interface LayoutConfig {
  width?: number;
  height?: number;
  _padding?: number;
  margin?: number;
  responsive?: boolean;
}

/**
 * コンポーネント位置
 */
export interface ComponentPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * レイアウトゾーン
 */
export enum LayoutZone {
  INPUT = "input",
  RESPONSE = "response",
  MODE = "mode",
  PROGRESS = "progress",
  APPROVAL = "approval",
  STATUS = "status",
}

/**
 * レイアウトエンジンクラス
 */
export class LayoutEngine {
  private config: Required<LayoutConfig>;
  private zones: Map<LayoutZone, ComponentPosition> = new Map();
  private currentCursorY: number = 0;
  private terminalWidth: number;
  private terminalHeight: number;

  constructor(_config: LayoutConfig = {}) {
    this.terminalWidth = process.stdout.columns || 124;
    this.terminalHeight = process.stdout.rows || 40;

    this._config = {
      width: _config.width || this.terminalWidth,
      height: _config.height || this.terminalHeight,
      _padding: _config.padding || 2,
      margin: _config.margin || 1,
      responsive: _config.responsive !== false,
    };

    this.calculateZones();

    // Handle terminal resize
    if (this._config.responsive) {
      process.stdout.on("resize", () => {
        this.handleResize();
      });
    }
  }

  /**
   * ゾーンを計算
   */
  private calculateZones(): void {
    const { width, height, _padding, margin } = this.config;

    // Input zone (top)
    this.zones.set(LayoutZone.INPUT, {
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: 6, // Fixed height for input box
    });

    // Mode indicator zone (below input)
    this.zones.set(LayoutZone.MODE, {
      x: margin,
      y: margin + 6 + _padding,
      width: width - margin * 2,
      height: 1,
    });

    // Response zone (main content area)
    this.zones.set(LayoutZone.RESPONSE, {
      x: margin,
      y: margin + 6 + _padding + 1 + _padding,
      width: width - margin * 2,
      height: height - 20, // Leave space for other zones
    });

    // Progress zone (bottom area)
    this.zones.set(LayoutZone.PROGRESS, {
      x: margin,
      y: height - 8,
      width: width - margin * 2,
      height: 2,
    });

    // Approval zone (overlay when needed)
    this.zones.set(LayoutZone.APPROVAL, {
      x: Math.floor(width * 0.2), // 20% from left
      y: Math.floor(height * 0.3), // 30% from top
      width: Math.floor(width * 0.6), // 60% width
      height: 15, // Fixed height for approval prompt
    });

    // Status zone (bottom line)
    this.zones.set(LayoutZone.STATUS, {
      x: margin,
      y: height - 2,
      width: width - margin * 2,
      height: 1,
    });
  }

  /**
   * リサイズを処理
   */
  private handleResize(): void {
    this.terminalWidth = process.stdout.columns || 124;
    this.terminalHeight = process.stdout.rows || 40;

    if (this.config.responsive) {
      this.config.width = this.terminalWidth;
      this.config.height = this.terminalHeight;
      this.calculateZones();
      this.redraw();
    }
  }

  /**
   * 画面をクリア
   */
  clearScreen(): void {
    console.clear();
    this.currentCursorY = 0;
  }

  /**
   * 特定のゾーンをクリア
   */
  clearZone(zone: LayoutZone): void {
    const _position = this.zones.get(zone);
    if (!_position) {
      return;
    }

    // Save cursor _position
    process.stdout.write("\u001b[s");

    // Clear the zone area
    for (let y = 0; y < _position.height; y++) {
      process.stdout.write(`\u001b[${_position.y + y};${_position.x}H`);
      process.stdout.write(" ".repeat(_position.width));
    }

    // Restore cursor _position
    process.stdout.write("\u001b[u");
  }

  /**
   * カーソルを移動
   */
  moveCursor(_x: number, y: number): void {
    process.stdout.write(`\u001b[${y};${_x}H`);
  }

  /**
   * ゾーンにカーソルを移動
   */
  moveCursorToZone(zone: LayoutZone): void {
    const _position = this.zones.get(zone);
    if (_position) {
      this.moveCursor(_position.x, _position.y);
    }
  }

  /**
   * ゾーン内にコンテンツを配置
   */
  placeInZone(
    zone: LayoutZone,
    content: string[],
    align: "left" | "center" | "right" = "left",
  ): void {
    const _position = this.zones.get(zone);
    if (!_position) {
      return;
    }

    // Save cursor _position
    process.stdout.write("\u001b[s");

    // Place content line by line
    content.slice(0, _position.height).forEach((line, _index) => {
      process.stdout.write(`\u001b[${_position.y + _index};${_position.x}H`);

      const _truncated = this.truncateText(line, _position.width);
      const _aligned = this.alignText(_truncated, _position.width, align);
      process.stdout.write(_aligned);
    });

    // Restore cursor _position
    process.stdout.write("\u001b[u");
  }

  /**
   * ボーダーを描画
   */
  drawBorder(
    _zone: LayoutZone,
    style: "single" | "double" | "rounded" = "single",
  ): void {
    const _position = this.zones.get(_zone);
    if (!_position) {
      return;
    }

    const _chars = this.getBorderChars(style);
    const _color = chalk.white;

    // Save cursor _position
    process.stdout.write("\u001b[s");

    // Top border
    process.stdout.write(`\u001b[${_position.y};${_position.x}H`);
    process.stdout.write(
      _color(
        _chars.topLeft +
          _chars.horizontal.repeat(_position.width - 2) +
          _chars.topRight,
      ),
    );

    // Side borders
    for (let y = 1; y < _position.height - 1; y++) {
      process.stdout.write(`\u001b[${_position.y + y};${_position.x}H`);
      process.stdout.write(_color(_chars.vertical));
      process.stdout.write(
        `\u001b[${_position.y + y};${_position.x + _position.width - 1}H`,
      );
      process.stdout.write(_color(_chars.vertical));
    }

    // Bottom border
    process.stdout.write(
      `\u001b[${_position.y + _position.height - 1};${_position.x}H`,
    );
    process.stdout.write(
      _color(
        _chars.bottomLeft +
          _chars.horizontal.repeat(_position.width - 2) +
          _chars.bottomRight,
      ),
    );

    // Restore cursor _position
    process.stdout.write("\u001b[u");
  }

  /**
   * ボーダー文字を取得
   */
  private getBorderChars(_style: "single" | "double" | "rounded") {
    const _styles = {
      single: {
        topLeft: "┌",
        topRight: "┐",
        bottomLeft: "└",
        bottomRight: "┘",
        horizontal: "─",
        vertical: "│",
      },
      double: {
        topLeft: "╔",
        topRight: "╗",
        bottomLeft: "╚",
        bottomRight: "╝",
        horizontal: "═",
        vertical: "║",
      },
      rounded: {
        topLeft: "╭",
        topRight: "╮",
        bottomLeft: "╰",
        bottomRight: "╯",
        horizontal: "─",
        vertical: "│",
      },
    };

    return _styles[_style];
  }

  /**
   * テキストを切り詰め
   */
  private truncateText(_text: string, maxWidth: number): string {
    const _stripped = this.stripAnsi(_text);
    if (_stripped.length <= maxWidth) {
      return _text;
    }

    // Find the _position to truncate considering ANSI codes
    let visibleLength = 0;
    let actualPosition = 0;
    let inAnsi = false;

    for (let i = 0; i < _text.length; i++) {
      if (_text[i] === "\u001b") {
        inAnsi = true;
      } else if (inAnsi && _text[i] === "m") {
        inAnsi = false;
      } else if (!inAnsi) {
        visibleLength++;
        if (visibleLength >= maxWidth - 3) {
          actualPosition = i;
          break;
        }
      }
    }

    return `${_text.substring(0, actualPosition)}...`;
  }

  /**
   * テキストを整列
   */
  private alignText(
    _text: string,
    width: number,
    align: "left" | "center" | "right",
  ): string {
    const _textLength = this.stripAnsi(_text).length;
    const _padding = width - _textLength;

    if (_padding <= 0) {
      return _text;
    }

    switch (align) {
      case "center":
        {
          const _leftPad = Math.floor(_padding / 2);
          const _rightPad = _padding - _leftPad;
        }
        return " ".repeat(_leftPad) + _text + " ".repeat(_rightPad);

      case "right":
        return " ".repeat(_padding) + _text;

      default: // left
        return _text + " ".repeat(_padding);
    }
  }

  /**
   * ANSIコードを削除
   */
  private stripAnsi(str: string): string {
    return str.replace(/\u001b\[[0-9;]*m/g, "");
  }

  /**
   * スクロール
   */
  scroll(lines: number): void {
    if (lines > 0) {
      // Scroll down
      process.stdout.write(`\u001b[${lines}S`);
    } else if (lines < 0) {
      // Scroll up
      process.stdout.write(`\u001b[${Math.abs(lines)}T`);
    }
  }

  /**
   * 再描画
   */
  private redraw(): void {
    // This would trigger a full redraw of all components
    // Implementation depends on the components registered with the layout
    this.clearScreen();
  }

  /**
   * ゾーン位置を取得
   */
  getZonePosition(zone: LayoutZone): ComponentPosition | undefined {
    return this.zones.get(zone);
  }

  /**
   * 利用可能な幅を取得
   */
  getAvailableWidth(): number {
    return this.config.width - this.config.margin * 2;
  }

  /**
   * 利用可能な高さを取得
   */
  getAvailableHeight(): number {
    return this.config.height - this.config.margin * 2;
  }

  /**
   * レスポンシブモードかチェック
   */
  isResponsive(): boolean {
    return this.config.responsive;
  }

  /**
   * デバッグ情報を表示
   */
  debug(): void {
    console.log(chalk.gray("Layout Engine Debug:"));
    console.log(
      chalk.gray(`Terminal: ${this.terminalWidth}x${this.terminalHeight}`),
    );
    console.log(
      chalk.gray(`Config: ${this.config.width}x${this.config.height}`),
    );
    console.log(chalk.gray("Zones:"));

    this.zones.forEach((_position, zone) => {
      console.log(
        chalk.gray(
          `  ${zone}: x=${_position.x}, y=${_position.y}, w=${_position.width}, h=${_position.height}`,
        ),
      );
    });
  }

  /**
   * カスタムゾーンを追加
   */
  addZone(zone: LayoutZone): void {
    this.zones.set(zone, {
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
    });
  }

  /**
   * レンダリング
   */
  render(): string {
    const output: string[] = [];

    output.push(chalk.cyan("Layout Engine Status:"));
    output.push(chalk.gray("─".repeat(50)));
    output.push(`Terminal Size: ${this.terminalWidth}x${this.terminalHeight}`);
    output.push(`Layout Size: ${this.config.width}x${this.config.height}`);
    output.push(`Zones: ${this.zones.size}`);

    return output.join("\n");
  }
}

export default LayoutEngine;
