/**
 * Optimized Table Component
 * 124文字幅に最適化されたテーブル表示システム
 */

import chalk from "chalk";
import {
  TEXT_HIERARCHY,
  UNIFIED_COLORS,
} from "../design-system/UnifiedColorPalette.js";
import { DESIGN_CONSTANTS } from "../optimized-design-system.js";

/**
 * テーブル設定
 */
export interface TableConfig {
  _maxWidth?: number;
  border?: "none" | "light" | "heavy" | "rounded";
  _padding?: number;
  alignment?: "left" | "center" | "right";
  columnAlignment?: Record<string, "left" | "center" | "right">;
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
  static render(
    _data: TableData[],
    headers?: string[],
    config: TableConfig = {},
  ): void {
    if (!_data || _data.length === 0) {
      console.log(TEXT_HIERARCHY.CAPTION("No data to display"));
      return;
    }

    // Extract headers if not provided
    const _tableHeaders = headers || Object.keys(_data[0]);

    // Calculate optimal column widths
    const _columnWidths = this.calculateOptimalWidths(
      _data,
      _tableHeaders,
      config,
    );

    // Render based on border style
    switch (config.border) {
      case "heavy":
        this.renderHeavyBorder(_data, _tableHeaders, _columnWidths, config);
        break;
      case "rounded":
        this.renderRoundedBorder(_data, _tableHeaders, _columnWidths, config);
        break;
      case "none":
        this.renderNoBorder(_data, _tableHeaders, _columnWidths, config);
        break;
      default:
        this.renderLightBorder(_data, _tableHeaders, _columnWidths, config);
    }
  }

  /**
   * 軽量ボーダーでテーブルを描画
   */
  private static renderLightBorder(
    _data: TableData[],
    headers: string[],
    _columnWidths: number[],
    config: TableConfig,
  ): void {
    const _totalWidth =
      columnWidths.reduce((sum, w) => sum + w, 0) + (headers.length - 1) * 3;

    // Top border
    console.log(UNIFIED_COLORS.MUTED(`┌${"─".repeat(_totalWidth)}┐`));

    // Headers
    this.renderHeaderRow(headers, _columnWidths, config, "│");

    // Header separator
    console.log(UNIFIED_COLORS.MUTED(`├${"─".repeat(_totalWidth)}┤`));

    // Data rows
    data.forEach((_row, _index) => {
      this.renderDataRow(_row, headers, _columnWidths, config, "│", _index);
    });

    // Bottom border
    console.log(UNIFIED_COLORS.MUTED(`└${"─".repeat(_totalWidth)}┘`));
  }

  /**
   * 重厚ボーダーでテーブルを描画
   */
  private static renderHeavyBorder(
    _data: TableData[],
    headers: string[],
    _columnWidths: number[],
    config: TableConfig,
  ): void {
    const _totalWidth =
      columnWidths.reduce((sum, w) => sum + w, 0) + (headers.length - 1) * 3;

    // Top border
    console.log(UNIFIED_COLORS.PRIMARY(`╔${"═".repeat(_totalWidth)}╗`));

    // Headers
    this.renderHeaderRow(headers, _columnWidths, config, "║");

    // Header separator
    console.log(UNIFIED_COLORS.PRIMARY(`╠${"═".repeat(_totalWidth)}╣`));

    // Data rows
    data.forEach((_row, _index) => {
      this.renderDataRow(_row, headers, _columnWidths, config, "║", _index);
    });

    // Bottom border
    console.log(UNIFIED_COLORS.PRIMARY(`╚${"═".repeat(_totalWidth)}╝`));
  }

  /**
   * 丸角ボーダーでテーブルを描画
   */
  private static renderRoundedBorder(
    _data: TableData[],
    headers: string[],
    _columnWidths: number[],
    config: TableConfig,
  ): void {
    const _totalWidth =
      columnWidths.reduce((sum, w) => sum + w, 0) + (headers.length - 1) * 3;

    // Top border
    console.log(UNIFIED_COLORS.MUTED(`╭${"─".repeat(_totalWidth)}╮`));

    // Headers
    this.renderHeaderRow(headers, _columnWidths, config, "│");

    // Header separator
    console.log(UNIFIED_COLORS.MUTED(`├${"─".repeat(_totalWidth)}┤`));

    // Data rows
    data.forEach((_row, _index) => {
      this.renderDataRow(_row, headers, _columnWidths, config, "│", _index);
    });

    // Bottom border
    console.log(UNIFIED_COLORS.MUTED(`╰${"─".repeat(_totalWidth)}╯`));
  }

  /**
   * ボーダーなしでテーブルを描画
   */
  private static renderNoBorder(
    _data: TableData[],
    headers: string[],
    _columnWidths: number[],
    config: TableConfig,
  ): void {
    // Headers
    this.renderHeaderRow(headers, _columnWidths, config);

    // Header separator
    const _totalWidth =
      columnWidths.reduce((sum, w) => sum + w, 0) + (headers.length - 1) * 3;
    console.log(UNIFIED_COLORS.MUTED("─".repeat(_totalWidth)));

    // Data rows
    data.forEach((_row, _index) => {
      this.renderDataRow(_row, headers, _columnWidths, config, "", _index);
    });
  }

  /**
   * ヘッダー行を描画
   */
  private static renderHeaderRow(
    headers: string[],
    _columnWidths: number[],
    config: TableConfig,
    border: string = "",
  ): void {
    const _cells = headers.map((header, _i) => {
      const _width = _columnWidths[_i];
      const _aligned = this.alignText(
        header,
        _width,
        config.columnAlignment?.[header] || config.alignment,
      );
      return config.highlightHeader !== false
        ? TEXT_HIERARCHY.SUBTITLE(_aligned)
        : TEXT_HIERARCHY.BODY(_aligned);
    });

    const _row = _cells.join(TEXT_HIERARCHY.CAPTION(" │ "));

    if (border) {
      console.log(
        `${UNIFIED_COLORS.MUTED(border)} ${_row} ${UNIFIED_COLORS.MUTED(border)}`,
      );
    } else {
      console.log(_row);
    }
  }

  /**
   * データ行を描画
   */
  private static renderDataRow(
    _row: TableData,
    headers: string[],
    _columnWidths: number[],
    config: TableConfig,
    border: string = "",
    rowIndex: number,
  ): void {
    const _cells = headers.map((header, _i) => {
      const _value = String(_row[header] ?? "");
      const _width = _columnWidths[_i];
      const _aligned = this.alignText(
        _value,
        _width,
        config.columnAlignment?.[header] || config.alignment,
      );

      // Apply zebra striping
      if (config.zebra && rowIndex % 2 === 1) {
        return chalk.dim(_aligned);
      }

      return TEXT_HIERARCHY.BODY(_aligned);
    });

    const _rowStr = _cells.join(TEXT_HIERARCHY.CAPTION(" │ "));

    if (border) {
      console.log(
        `${UNIFIED_COLORS.MUTED(border)} ${_rowStr} ${UNIFIED_COLORS.MUTED(border)}`,
      );
    } else {
      console.log(_rowStr);
    }
  }

  /**
   * 最適な列幅を計算
   */
  private static calculateOptimalWidths(
    _data: TableData[],
    headers: string[],
    config: TableConfig,
  ): number[] {
    const _maxWidth = config._maxWidth || DESIGN_CONSTANTS.CONTENT_WIDTH;
    const _padding = config._padding || 1;
    const _separatorWidth = (headers.length - 1) * 3; // ' │ ' separators
    const _borderWidth = config.border && config.border !== "none" ? 4 : 0; // '│ ' and ' │'
    const _availableWidth = _maxWidth - _separatorWidth - _borderWidth;

    if (config.responsive) {
      // Responsive: calculate based on content
      const _contentWidths = headers.map((header, _index) => {
        const _headerWidth = header.length;
        const _maxDataWidth = Math.max(
          ..._data.map((_row) => String(_row[header] ?? "").length),
        );
        return Math.max(_headerWidth, _maxDataWidth) + _padding * 2;
      });

      const _totalContentWidth = _contentWidths.reduce((sum, w) => sum + w, 0);

      if (_totalContentWidth <= _availableWidth) {
        return _contentWidths;
      }

      // Scale down proportionally
      const _scale = _availableWidth / _totalContentWidth;
      return _contentWidths.map((w) => Math.max(5, Math.floor(w * _scale)));
    } else {
      // Equal _width distribution
      const _columnWidth = Math.floor(_availableWidth / headers.length);
      return headers.map(() => _columnWidth);
    }
  }

  /**
   * テキストを整列
   */
  private static alignText(
    text: string,
    _width: number,
    alignment: "left" | "center" | "right" = "left",
  ): string {
    const _truncated =
      text.length > _width ? `${text.substring(0, _width - 1)}…` : text;

    switch (alignment) {
      case "center":
        {
          const _leftPad = Math.floor((_width - _truncated.length) / 2);
          const _rightPad = _width - _truncated.length - _leftPad;
        }
        return " ".repeat(_leftPad) + _truncated + " ".repeat(_rightPad);

      case "right":
        return _truncated.padStart(_width);

      default:
        return _truncated.padEnd(_width);
    }
  }

  /**
   * コンパクトテーブル(1行表示)
   */
  static renderCompact(
    _data: TableData[],
    headers?: string[],
    _config: TableConfig = {},
  ): void {
    if (!_data || _data.length === 0) {
      return;
    }

    const _tableHeaders = headers || Object.keys(_data[0]);
    const _maxItems = 3; // Show only first 3 columns in compact mode
    const _displayHeaders = _tableHeaders.slice(0, _maxItems);

    // Header
    const _headerStr = _displayHeaders
      .map((h) => TEXT_HIERARCHY.SUBTITLE(h))
      .join(" | ");
    console.log(_headerStr);
    console.log(UNIFIED_COLORS.MUTED("─".repeat(40)));

    // Data
    data.forEach((_row) => {
      const _rowStr = _displayHeaders
        .map((h) => String(_row[h] ?? "-").substring(0, 10))
        .join(" | ");
      console.log(TEXT_HIERARCHY.BODY(_rowStr));
    });
  }

  /**
   * 縦型テーブル(キー・バリュー形式)
   */
  static renderVertical(_data: TableData, _config: TableConfig = {}): void {
    const _keys = Object._keys(_data);
    const _maxKeyLength = Math.max(..._keys.map((k) => k.length));

    keys.forEach((key) => {
      const _paddedKey = key.padEnd(_maxKeyLength);
      const _value = String(_data[key] ?? "");

      console.log(
        TEXT_HIERARCHY.SUBTITLE(_paddedKey) +
          TEXT_HIERARCHY.CAPTION(" : ") +
          TEXT_HIERARCHY.BODY(_value),
      );
    });
  }

  /**
   * グリッドレイアウト
   */
  static renderGrid(
    _items: string[],
    columns: number = 3,
    config: TableConfig = {},
  ): void {
    const _width = config.maxWidth || DESIGN_CONSTANTS.CONTENT_WIDTH;
    const _columnWidth = Math.floor(_width / columns) - 2;

    for (let i = 0; i < _items.length; i += columns) {
      const _row = _items
        .slice(i, i + columns)
        .map((_item) => this.alignText(_item, _columnWidth, config.alignment))
        .join("  ");

      console.log(TEXT_HIERARCHY.BODY(_row));
    }
  }
}

export default OptimizedTable;
