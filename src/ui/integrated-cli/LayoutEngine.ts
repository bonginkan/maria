/**
 * LayoutEngine Component
 * レイアウト管理とコンポーネント配置
 */

import chalk from 'chalk';
import { DESIGN_CONSTANTS } from '../optimized-design-system.js';

/**
 * レイアウト設定
 */
export interface LayoutConfig {
  width?: number;
  height?: number;
  padding?: number;
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
  INPUT = 'input',
  RESPONSE = 'response',
  MODE = 'mode',
  PROGRESS = 'progress',
  APPROVAL = 'approval',
  STATUS = 'status',
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

  constructor(config: LayoutConfig = {}) {
    this.terminalWidth = process.stdout.columns || 124;
    this.terminalHeight = process.stdout.rows || 40;

    this.config = {
      width: config.width || this.terminalWidth,
      height: config.height || this.terminalHeight,
      padding: config.padding || 2,
      margin: config.margin || 1,
      responsive: config.responsive !== false,
    };

    this.calculateZones();

    // Handle terminal resize
    if (this.config.responsive) {
      process.stdout.on('resize', () => {
        this.handleResize();
      });
    }
  }

  /**
   * ゾーンを計算
   */
  private calculateZones(): void {
    const { width, height, padding, margin } = this.config;

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
      y: margin + 6 + padding,
      width: width - margin * 2,
      height: 1,
    });

    // Response zone (main content area)
    this.zones.set(LayoutZone.RESPONSE, {
      x: margin,
      y: margin + 6 + padding + 1 + padding,
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
    const position = this.zones.get(zone);
    if (!position) {return;}

    // Save cursor position
    process.stdout.write('\x1b[s');

    // Clear the zone area
    for (let y = 0; y < position.height; y++) {
      process.stdout.write(`\x1b[${position.y + y};${position.x}H`);
      process.stdout.write(' '.repeat(position.width));
    }

    // Restore cursor position
    process.stdout.write('\x1b[u');
  }

  /**
   * カーソルを移動
   */
  moveCursor(x: number, y: number): void {
    process.stdout.write(`\x1b[${y};${x}H`);
  }

  /**
   * ゾーンにカーソルを移動
   */
  moveCursorToZone(zone: LayoutZone): void {
    const position = this.zones.get(zone);
    if (position) {
      this.moveCursor(position.x, position.y);
    }
  }

  /**
   * ゾーン内にコンテンツを配置
   */
  placeInZone(
    zone: LayoutZone,
    content: string[],
    align: 'left' | 'center' | 'right' = 'left',
  ): void {
    const position = this.zones.get(zone);
    if (!position) {return;}

    // Save cursor position
    process.stdout.write('\x1b[s');

    // Place content line by line
    content.slice(0, position.height).forEach((line, index) => {
      process.stdout.write(`\x1b[${position.y + index};${position.x}H`);

      const truncated = this.truncateText(line, position.width);
      const aligned = this.alignText(truncated, position.width, align);
      process.stdout.write(aligned);
    });

    // Restore cursor position
    process.stdout.write('\x1b[u');
  }

  /**
   * ボーダーを描画
   */
  drawBorder(zone: LayoutZone, style: 'single' | 'double' | 'rounded' = 'single'): void {
    const position = this.zones.get(zone);
    if (!position) {return;}

    const chars = this.getBorderChars(style);
    const color = chalk.white;

    // Save cursor position
    process.stdout.write('\x1b[s');

    // Top border
    process.stdout.write(`\x1b[${position.y};${position.x}H`);
    process.stdout.write(
      color(chars.topLeft + chars.horizontal.repeat(position.width - 2) + chars.topRight),
    );

    // Side borders
    for (let y = 1; y < position.height - 1; y++) {
      process.stdout.write(`\x1b[${position.y + y};${position.x}H`);
      process.stdout.write(color(chars.vertical));
      process.stdout.write(`\x1b[${position.y + y};${position.x + position.width - 1}H`);
      process.stdout.write(color(chars.vertical));
    }

    // Bottom border
    process.stdout.write(`\x1b[${position.y + position.height - 1};${position.x}H`);
    process.stdout.write(
      color(chars.bottomLeft + chars.horizontal.repeat(position.width - 2) + chars.bottomRight),
    );

    // Restore cursor position
    process.stdout.write('\x1b[u');
  }

  /**
   * ボーダー文字を取得
   */
  private getBorderChars(style: 'single' | 'double' | 'rounded') {
    const styles = {
      single: {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│',
      },
      double: {
        topLeft: '╔',
        topRight: '╗',
        bottomLeft: '╚',
        bottomRight: '╝',
        horizontal: '═',
        vertical: '║',
      },
      rounded: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
      },
    };

    return styles[style];
  }

  /**
   * テキストを切り詰め
   */
  private truncateText(text: string, maxWidth: number): string {
    const stripped = this.stripAnsi(text);
    if (stripped.length <= maxWidth) {
      return text;
    }

    // Find the position to truncate considering ANSI codes
    let visibleLength = 0;
    let actualPosition = 0;
    let inAnsi = false;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\x1b') {
        inAnsi = true;
      } else if (inAnsi && text[i] === 'm') {
        inAnsi = false;
      } else if (!inAnsi) {
        visibleLength++;
        if (visibleLength >= maxWidth - 3) {
          actualPosition = i;
          break;
        }
      }
    }

    return `${text.substring(0, actualPosition)  }...`;
  }

  /**
   * テキストを整列
   */
  private alignText(text: string, width: number, align: 'left' | 'center' | 'right'): string {
    const textLength = this.stripAnsi(text).length;
    const padding = width - textLength;

    if (padding <= 0) {return text;}

    switch (align) {
      case 'center':
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);

      case 'right':
        return ' '.repeat(padding) + text;

      default: // left
        return text + ' '.repeat(padding);
    }
  }

  /**
   * ANSIコードを削除
   */
  private stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * スクロール
   */
  scroll(lines: number): void {
    if (lines > 0) {
      // Scroll down
      process.stdout.write(`\x1b[${lines}S`);
    } else if (lines < 0) {
      // Scroll up
      process.stdout.write(`\x1b[${Math.abs(lines)}T`);
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
    console.log(chalk.gray('Layout Engine Debug:'));
    console.log(chalk.gray(`Terminal: ${this.terminalWidth}x${this.terminalHeight}`));
    console.log(chalk.gray(`Config: ${this.config.width}x${this.config.height}`));
    console.log(chalk.gray('Zones:'));

    this.zones.forEach((position, zone) => {
      console.log(
        chalk.gray(
          `  ${zone}: x=${position.x}, y=${position.y}, w=${position.width}, h=${position.height}`,
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

    output.push(chalk.cyan('Layout Engine Status:'));
    output.push(chalk.gray('─'.repeat(50)));
    output.push(`Terminal Size: ${this.terminalWidth}x${this.terminalHeight}`);
    output.push(`Layout Size: ${this.config.width}x${this.config.height}`);
    output.push(`Zones: ${this.zones.size}`);

    return output.join('\n');
  }
}

export default LayoutEngine;
