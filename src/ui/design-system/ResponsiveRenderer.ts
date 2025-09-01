/**
 * Responsive Renderer
 * レスポンシブ対応表示システム - 80-200文字幅対応
 * Ultra Think設計による完璧な画面サイズ適応
 */

import {
  type LayoutConfig,
  LayoutManager,
  type LayoutMode,
} from "./LayoutManager.js";
import { OptimizedBox } from "./OptimizedBox.js";
import { SEMANTIC_COLORS, TEXT_HIERARCHY } from "./UnifiedColorPalette.js";
import { CORE_ICONS, IconRegistry } from "./MinimalIconRegistry.js";

// レンダリング可能コンテンツ型
export interface RenderableContent {
  type: ContentType;
  data: unknown;
  priority: number;
  responsive: boolean;
}

export type ContentType =
  | "header"
  | "status"
  | "navigation"
  | "content"
  | "sidebar"
  | "footer"
  | "dialog"
  | "table"
  | "list"
  | "progress";

// レスポンシブ設定
export interface ResponsiveConfig {
  enableAdaptiveLayout: boolean;
  enableContentScaling: boolean;
  enableAutomaticWrapping: boolean;
  enableProgressiveDisplay: boolean;
  minContentWidth: number;
  maxContentWidth: number;
  breakpoints: {
    compact: number;
    standard: number;
    wide: number;
  };
}

// 表示コンテキスト
export interface RenderContext {
  _layout: LayoutConfig;
  config: ResponsiveConfig;
  _terminalWidth: number;
  _terminalHeight: number;
  mode: LayoutMode;
}

/**
 * レスポンシブレンダラークラス
 */
export class ResponsiveRenderer {
  private static context: RenderContext;
  private static config: ResponsiveConfig = {
    enableAdaptiveLayout: true,
    enableContentScaling: true,
    enableAutomaticWrapping: true,
    enableProgressiveDisplay: true,
    minContentWidth: 80,
    maxContentWidth: 200,
    breakpoints: {
      compact: 100,
      standard: 124,
      wide: 140,
    },
  };

  /**
   * 初期化と画面サイズ検出
   */
  static initialize(customConfig?: Partial<ResponsiveConfig>): void {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    this.updateContext();

    // 画面サイズ変更イベントをリッスン(Node.js環境)
    if (process.stdout.isTTY) {
      process.stdout.on("resize", () => {
        this.updateContext();
      });
    }
  }

  /**
   * コンテキスト更新
   */
  private static updateContext(): void {
    const _terminalWidth =
      process.stdout.columns || this.config.breakpoints.standard;
    const _terminalHeight = process.stdout.rows || 24;
    const _layout = LayoutManager.getOptimalLayout(_terminalWidth);

    this.context = {
      _layout,
      config: this.config,
      _terminalWidth,
      _terminalHeight,
      mode: _layout.mode,
    };
  }

  /**
   * レスポンシブコンテンツ描画
   */
  static render(content: RenderableContent | RenderableContent[]): void {
    if (!this.context) {
      this.initialize();
    }

    const _contents = Array.isArray(content) ? content : [content];

    // 優先度順ソート
    const _sortedContents = _contents.sort((a, b) => b.priority - a.priority);

    // プログレッシブ表示
    if (this.config.enableProgressiveDisplay) {
      this.renderProgressive(_sortedContents);
    } else {
      this.renderDirect(_sortedContents);
    }
  }

  /**
   * プログレッシブ描画
   */
  private static renderProgressive(_contents: RenderableContent[]): void {
    const _availableHeight = this.context.terminalHeight - 10; // ヘッダー・フッター分
    let usedHeight = 0;

    for (const content of _contents) {
      if (usedHeight >= _availableHeight && this.context.mode === "compact") {
        // コンパクトモードでは省略表示
        this.renderTruncationNotice(
          contents.length - contents.indexOf(content),
        );
        break;
      }

      const _estimatedHeight = this.estimateContentHeight(content);

      if (
        _estimatedHeight <= _availableHeight - usedHeight ||
        content.priority >= 9
      ) {
        this.renderContent(content);
        usedHeight += _estimatedHeight;
      }
    }
  }

  /**
   * 直接描画
   */
  private static renderDirect(_contents: RenderableContent[]): void {
    contents.forEach((content) => this.renderContent(content));
  }

  /**
   * コンテンツ描画
   */
  private static renderContent(content: RenderableContent): void {
    switch (content.type) {
      case "header":
        this.renderHeader(content.data as HeaderData);
        break;
      case "status":
        this.renderStatus(content.data as StatusData);
        break;
      case "navigation":
        this.renderNavigation(content.data as NavigationData);
        break;
      case "content":
        this.renderContentBlock(content.data as ContentData);
        break;
      case "sidebar":
        this.renderSidebar(content.data as SidebarData);
        break;
      case "table":
        this.renderTable(content.data as TableData);
        break;
      case "list":
        this.renderList(content.data as ListData);
        break;
      case "progress":
        this.renderProgress(content.data as ProgressData);
        break;
      case "dialog":
        this.renderDialog(content.data as DialogData);
        break;
      default:
        console.warn(`Unknown content type: ${content.type}`);
    }
  }

  /**
   * ヘッダー描画
   */
  private static renderHeader(data: HeaderData): void {
    const _width = this.context.layout.contentWidth;

    if (this.context.mode === "compact") {
      // コンパクト版ヘッダー
      console.log(TEXT_HIERARCHY.TITLE(data.title));
      if (data.subtitle) {
        console.log(TEXT_HIERARCHY.CAPTION(data.subtitle));
      }
    } else {
      // フル版ヘッダー(MARIA CODEロゴベース)
      OptimizedBox.brand(
        [
          LayoutManager.alignText(data.title, _width - 4, "center"),
          data.subtitle
            ? LayoutManager.alignText(data.subtitle, _width - 4, "center")
            : "",
          data.copyright
            ? LayoutManager.alignText(data.copyright, _width - 4, "center")
            : "",
        ].filter(Boolean),
        {
          _width,
          padding: "large",
          titleAlignment: "center",
        },
      );
    }

    console.log(); // 空行
  }

  /**
   * ステータス描画
   */
  private static renderStatus(data: StatusData): void {
    const _icon = IconRegistry.get(
      data.status === "healthy"
        ? "SUCCESS"
        : data.status === "degraded"
          ? "WARNING"
          : "ERROR",
    );
    const _color = ColorPalette.status(
      data.status === "healthy"
        ? "success"
        : data.status === "degraded"
          ? "warning"
          : "error",
    );

    const _statusLine = `${_color(_icon)} ${TEXT_HIERARCHY.BODY(data.message)}`;

    if (this.context.mode !== "compact" && data.details) {
      OptimizedBox.simple(
        [
          _statusLine,
          ...data.details.map(
            (detail) => `  ${TEXT_HIERARCHY.CAPTION(detail)}`,
          ),
        ],
        {
          theme:
            data.status === "healthy"
              ? "success"
              : data.status === "degraded"
                ? "warning"
                : "error",
          padding: "small",
        },
      );
    } else {
      console.log(_statusLine);
    }
  }

  /**
   * ナビゲーション描画
   */
  private static renderNavigation(data: NavigationData): void {
    if (this.context.mode === "compact") {
      // コンパクト:インライン表示
      const _items = data._items
        .slice(0, 3)
        .map((_item) => TEXT_HIERARCHY.BODY(_item.label))
        .join(TEXT_HIERARCHY.CAPTION(" • "));
      console.log(_items);
    } else {
      // 標準:グリッド表示
      const _grid = LayoutManager.createGrid(
        data._items.map(
          (_item) => `${_item.icon || CORE_ICONS.ARROW.symbol} ${_item.label}`,
        ),
        this.context.mode === "wide" ? 4 : 2,
      );
      grid.forEach((line) => console.log(line));
    }

    console.log();
  }

  /**
   * テーブル描画
   */
  private static renderTable(data: TableData): void {
    const _maxWidth = this.context.layout.contentWidth;
    const _columnCount = data.headers.length;
    const _columnWidth = Math.floor(
      (_maxWidth - (_columnCount - 1) * 2) / _columnCount,
    );

    // ヘッダー
    const _headerRow = data.headers
      .map((header) =>
        TEXT_HIERARCHY.SUBTITLE(LayoutManager.alignText(header, _columnWidth)),
      )
      .join("  ");
    console.log(_headerRow);

    // 区切り線
    console.log(SEMANTIC_COLORS.MUTED("─".repeat(_maxWidth)));

    // データ行
    data.rows.forEach((row) => {
      const _dataRow = data.headers
        .map((header) =>
          TEXT_HIERARCHY.BODY(
            LayoutManager.alignText(String(row[header] || ""), _columnWidth),
          ),
        )
        .join("  ");
      console.log(_dataRow);
    });

    console.log();
  }

  /**
   * プログレス描画
   */
  private static renderProgress(data: ProgressData): void {
    const _width = Math.min(90, this.context.layout.contentWidth - 20);
    const _filled = Math.floor((data.value / data.max) * _width);
    const _empty = _width - _filled;

    const _bar =
      SEMANTIC_COLORS.SUCCESS("█".repeat(_filled)) +
      SEMANTIC_COLORS.MUTED("░".repeat(_empty));

    const _percentage = Math.round((data.value / data.max) * 100);
    const _label = data._label ? `${data._label}: ` : "";

    console.log(`${_label}${_bar} ${_percentage}%`);
  }

  /**
   * コンテンツ高さ推定
   */
  private static estimateContentHeight(content: RenderableContent): number {
    switch (content.type) {
      case "header":
        return this.context.mode === "compact" ? 3 : 8;
      case "status":
        return 2;
      case "navigation":
        return this.context.mode === "compact" ? 2 : 4;
      case "table":
        {
          const _tableData = content.data as TableData;
        }
        return _tableData.rows.length + 3; // ヘッダー + 区切り + データ
      default:
        return 3; // デフォルト推定値
    }
  }

  /**
   * 省略通知表示
   */
  private static renderTruncationNotice(remainingCount: number): void {
    const _message = `${IconRegistry.get("INFO")} ${remainingCount} more _items (use wider terminal)`;
    console.log(TEXT_HIERARCHY.CAPTION(_message));
  }

  /**
   * レスポンシブ情報表示
   */
  static showResponsiveInfo(): void {
    console.log(TEXT_HIERARCHY.TITLE("Responsive Renderer Info"));
    console.log(SEMANTIC_COLORS.MUTED("─".repeat(40)));
    console.log(`Mode: ${this.context.mode}`);
    console.log(
      `Terminal: ${this.context.terminalWidth}x${this.context.terminalHeight}`,
    );
    console.log(`Layout Width: ${this.context.layout.width}`);
    console.log(`Content Width: ${this.context.layout.contentWidth}`);
    console.log(
      `Adaptive Layout: ${this.config.enableAdaptiveLayout ? "ON" : "OFF"}`,
    );
    console.log(
      `Content Scaling: ${this.config.enableContentScaling ? "ON" : "OFF"}`,
    );
  }

  // その他のrender*メソッドは簡略化のため省略
  private static renderContentBlock(_data: ContentData): void {
    /* 実装 */
  }
  private static renderSidebar(_data: SidebarData): void {
    /* 実装 */
  }
  private static renderList(_data: ListData): void {
    /* 実装 */
  }
  private static renderDialog(_data: DialogData): void {
    /* 実装 */
  }
}

// データ型定義
interface HeaderData {
  title: string;
  subtitle?: string;
  copyright?: string;
}

interface StatusData {
  status: "healthy" | "degraded" | "error";
  _message: string;
  details?: string[];
}

interface NavigationData {
  _items: Array<{
    _label: string;
    _icon?: string;
    action?: () => void;
  }>;
}

interface TableData {
  headers: string[];
  rows: Record<string, unknown>[];
}

interface ProgressData {
  _label?: string;
  value: number;
  max: number;
}

interface ContentData {
  title?: string;
  body: string[];
}

interface SidebarData {
  title: string;
  _items: string[];
}

interface ListData {
  _items: string[];
  ordered?: boolean;
}

interface DialogData {
  title: string;
  _message: string;
  type: "info" | "warning" | "error";
}

// 便利な関数
export const _renderResponsive = ResponsiveRenderer.render;
export const _initResponsive = ResponsiveRenderer.initialize;

export default ResponsiveRenderer;
