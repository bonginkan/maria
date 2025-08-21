/**
 * Optimized Table Component
 * 124文字幅に最適化されたテーブル表示システム
 */

import chalk from 'chalk';
import { UNIFIED_COLORS, TEXT_HIERARCHY } from '../design-system/UnifiedColorPalette.js';
import { DESIGN_CONSTANTS } from '../optimized-design-system.js';

/**
 * テーブル設定
 */
export interface TableConfig {
  maxWidth?: number;
  border?: 'none' | 'light' | 'heavy' | 'rounded';
  padding?: number;
  alignment?: 'left' | 'center' | 'right';
  columnAlignment?: Record<string, 'left' | 'center' | 'right'>;
  highlightHeader?: boolean;
  zebra?: boolean;
  compact?: boolean;
  responsive?: boolean;
}

/**
 * テーブルデータ型
 */
export type TableData = Record<string, unknown>;

/**
 * 最適化されたテーブルクラス
 */
export class OptimizedTable {
  /**
   * テーブルを描画
   */
  static render(data: TableData[], headers?: string[], config: TableConfig = {}): void {
    if (!data || data.length === 0) {
      console.log(TEXT_HIERARCHY.CAPTION('No data to display'));
      return;
    }

    // Extract headers if not provided
    const tableHeaders = headers || Object.keys(data[0]);

    // Calculate optimal column widths
    const columnWidths = this.calculateOptimalWidths(data, tableHeaders, config);

    // Render based on border style
    switch (config.border) {
      case 'heavy':
        this.renderHeavyBorder(data, tableHeaders, columnWidths, config);
        break;
      case 'rounded':
        this.renderRoundedBorder(data, tableHeaders, columnWidths, config);
        break;
      case 'none':
        this.renderNoBorder(data, tableHeaders, columnWidths, config);
        break;
      default:
        this.renderLightBorder(data, tableHeaders, columnWidths, config);
    }
  }

  /**
   * 軽量ボーダーでテーブルを描画
   */
  private static renderLightBorder(
    data: TableData[],
    headers: string[],
    columnWidths: number[],
    config: TableConfig,
  ): void {
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0) + (headers.length - 1) * 3;

    // Top border
    console.log(UNIFIED_COLORS.MUTED('┌' + '─'.repeat(totalWidth) + '┐'));

    // Headers
    this.renderHeaderRow(headers, columnWidths, config, '│');

    // Header separator
    console.log(UNIFIED_COLORS.MUTED('├' + '─'.repeat(totalWidth) + '┤'));

    // Data rows
    data.forEach((row, index) => {
      this.renderDataRow(row, headers, columnWidths, config, '│', index);
    });

    // Bottom border
    console.log(UNIFIED_COLORS.MUTED('└' + '─'.repeat(totalWidth) + '┘'));
  }

  /**
   * 重厚ボーダーでテーブルを描画
   */
  private static renderHeavyBorder(
    data: TableData[],
    headers: string[],
    columnWidths: number[],
    config: TableConfig,
  ): void {
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0) + (headers.length - 1) * 3;

    // Top border
    console.log(UNIFIED_COLORS.PRIMARY('╔' + '═'.repeat(totalWidth) + '╗'));

    // Headers
    this.renderHeaderRow(headers, columnWidths, config, '║');

    // Header separator
    console.log(UNIFIED_COLORS.PRIMARY('╠' + '═'.repeat(totalWidth) + '╣'));

    // Data rows
    data.forEach((row, index) => {
      this.renderDataRow(row, headers, columnWidths, config, '║', index);
    });

    // Bottom border
    console.log(UNIFIED_COLORS.PRIMARY('╚' + '═'.repeat(totalWidth) + '╝'));
  }

  /**
   * 丸角ボーダーでテーブルを描画
   */
  private static renderRoundedBorder(
    data: TableData[],
    headers: string[],
    columnWidths: number[],
    config: TableConfig,
  ): void {
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0) + (headers.length - 1) * 3;

    // Top border
    console.log(UNIFIED_COLORS.MUTED('╭' + '─'.repeat(totalWidth) + '╮'));

    // Headers
    this.renderHeaderRow(headers, columnWidths, config, '│');

    // Header separator
    console.log(UNIFIED_COLORS.MUTED('├' + '─'.repeat(totalWidth) + '┤'));

    // Data rows
    data.forEach((row, index) => {
      this.renderDataRow(row, headers, columnWidths, config, '│', index);
    });

    // Bottom border
    console.log(UNIFIED_COLORS.MUTED('╰' + '─'.repeat(totalWidth) + '╯'));
  }

  /**
   * ボーダーなしでテーブルを描画
   */
  private static renderNoBorder(
    data: TableData[],
    headers: string[],
    columnWidths: number[],
    config: TableConfig,
  ): void {
    // Headers
    this.renderHeaderRow(headers, columnWidths, config);

    // Header separator
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0) + (headers.length - 1) * 3;
    console.log(UNIFIED_COLORS.MUTED('─'.repeat(totalWidth)));

    // Data rows
    data.forEach((row, index) => {
      this.renderDataRow(row, headers, columnWidths, config, '', index);
    });
  }

  /**
   * ヘッダー行を描画
   */
  private static renderHeaderRow(
    headers: string[],
    columnWidths: number[],
    config: TableConfig,
    border: string = '',
  ): void {
    const cells = headers.map((header, i) => {
      const width = columnWidths[i];
      const aligned = this.alignText(
        header,
        width,
        config.columnAlignment?.[header] || config.alignment,
      );
      return config.highlightHeader !== false
        ? TEXT_HIERARCHY.SUBTITLE(aligned)
        : TEXT_HIERARCHY.BODY(aligned);
    });

    const row = cells.join(TEXT_HIERARCHY.CAPTION(' │ '));

    if (border) {
      console.log(UNIFIED_COLORS.MUTED(border) + ' ' + row + ' ' + UNIFIED_COLORS.MUTED(border));
    } else {
      console.log(row);
    }
  }

  /**
   * データ行を描画
   */
  private static renderDataRow(
    row: TableData,
    headers: string[],
    columnWidths: number[],
    config: TableConfig,
    border: string = '',
    rowIndex: number,
  ): void {
    const cells = headers.map((header, i) => {
      const value = String(row[header] ?? '');
      const width = columnWidths[i];
      const aligned = this.alignText(
        value,
        width,
        config.columnAlignment?.[header] || config.alignment,
      );

      // Apply zebra striping
      if (config.zebra && rowIndex % 2 === 1) {
        return chalk.dim(aligned);
      }

      return TEXT_HIERARCHY.BODY(aligned);
    });

    const rowStr = cells.join(TEXT_HIERARCHY.CAPTION(' │ '));

    if (border) {
      console.log(UNIFIED_COLORS.MUTED(border) + ' ' + rowStr + ' ' + UNIFIED_COLORS.MUTED(border));
    } else {
      console.log(rowStr);
    }
  }

  /**
   * 最適な列幅を計算
   */
  private static calculateOptimalWidths(
    data: TableData[],
    headers: string[],
    config: TableConfig,
  ): number[] {
    const maxWidth = config.maxWidth || DESIGN_CONSTANTS.CONTENT_WIDTH;
    const padding = config.padding || 1;
    const separatorWidth = (headers.length - 1) * 3; // ' │ ' separators
    const borderWidth = config.border && config.border !== 'none' ? 4 : 0; // '│ ' and ' │'
    const availableWidth = maxWidth - separatorWidth - borderWidth;

    if (config.responsive) {
      // Responsive: calculate based on content
      const contentWidths = headers.map((header, index) => {
        const headerWidth = header.length;
        const maxDataWidth = Math.max(...data.map((row) => String(row[header] ?? '').length));
        return Math.max(headerWidth, maxDataWidth) + padding * 2;
      });

      const totalContentWidth = contentWidths.reduce((sum, w) => sum + w, 0);

      if (totalContentWidth <= availableWidth) {
        return contentWidths;
      }

      // Scale down proportionally
      const scale = availableWidth / totalContentWidth;
      return contentWidths.map((w) => Math.max(5, Math.floor(w * scale)));
    } else {
      // Equal width distribution
      const columnWidth = Math.floor(availableWidth / headers.length);
      return headers.map(() => columnWidth);
    }
  }

  /**
   * テキストを整列
   */
  private static alignText(
    text: string,
    width: number,
    alignment: 'left' | 'center' | 'right' = 'left',
  ): string {
    const truncated = text.length > width ? text.substring(0, width - 1) + '…' : text;

    switch (alignment) {
      case 'center':
        const leftPad = Math.floor((width - truncated.length) / 2);
        const rightPad = width - truncated.length - leftPad;
        return ' '.repeat(leftPad) + truncated + ' '.repeat(rightPad);

      case 'right':
        return truncated.padStart(width);

      default:
        return truncated.padEnd(width);
    }
  }

  /**
   * コンパクトテーブル（1行表示）
   */
  static renderCompact(data: TableData[], headers?: string[], config: TableConfig = {}): void {
    if (!data || data.length === 0) return;

    const tableHeaders = headers || Object.keys(data[0]);
    const maxItems = 3; // Show only first 3 columns in compact mode
    const displayHeaders = tableHeaders.slice(0, maxItems);

    // Header
    const headerStr = displayHeaders.map((h) => TEXT_HIERARCHY.SUBTITLE(h)).join(' | ');
    console.log(headerStr);
    console.log(UNIFIED_COLORS.MUTED('─'.repeat(40)));

    // Data
    data.forEach((row) => {
      const rowStr = displayHeaders.map((h) => String(row[h] ?? '-').substring(0, 10)).join(' | ');
      console.log(TEXT_HIERARCHY.BODY(rowStr));
    });
  }

  /**
   * 縦型テーブル（キー・バリュー形式）
   */
  static renderVertical(data: TableData, config: TableConfig = {}): void {
    const keys = Object.keys(data);
    const maxKeyLength = Math.max(...keys.map((k) => k.length));

    keys.forEach((key) => {
      const paddedKey = key.padEnd(maxKeyLength);
      const value = String(data[key] ?? '');

      console.log(
        TEXT_HIERARCHY.SUBTITLE(paddedKey) +
          TEXT_HIERARCHY.CAPTION(' : ') +
          TEXT_HIERARCHY.BODY(value),
      );
    });
  }

  /**
   * グリッドレイアウト
   */
  static renderGrid(items: string[], columns: number = 3, config: TableConfig = {}): void {
    const width = config.maxWidth || DESIGN_CONSTANTS.CONTENT_WIDTH;
    const columnWidth = Math.floor(width / columns) - 2;

    for (let i = 0; i < items.length; i += columns) {
      const row = items
        .slice(i, i + columns)
        .map((item) => this.alignText(item, columnWidth, config.alignment))
        .join('  ');

      console.log(TEXT_HIERARCHY.BODY(row));
    }
  }
}

export default OptimizedTable;
