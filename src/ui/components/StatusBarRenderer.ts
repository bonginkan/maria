/**
 * Status Bar Renderer
 * 124文字幅に最適化されたステータスバー表示システム
 */

import _chalk from "chalk";
import {
  TEXT_HIERARCHY,
  UNIFIED_COLORS,
} from "../design-system/UnifiedColorPalette.js";
import { MINIMAL_ICONS } from "../design-system/MinimalIconRegistry.js";
import { DESIGN_CONSTANTS } from "../optimized-design-system.js";
import { _LayoutManager } from "../design-system/LayoutManager.js";

/**
 * ステータスバーの設定
 */
export interface StatusBarConfig {
  _width?: number;
  showTime?: boolean;
  showMemory?: boolean;
  showConnections?: boolean;
  theme?: "light" | "dark" | "auto";
}

/**
 * システムステータス情報
 */
export interface SystemStatus {
  mode: string;
  aiProvider: string;
  modelName: string;
  activeConnections: number;
  memoryUsage?: number;
  cpuUsage?: number;
  responseTime?: number;
  timestamp?: Date;
}

/**
 * ステータスバーレンダラークラス
 */
export class StatusBarRenderer {
  private static currentStatus: SystemStatus | null = null;
  private static updateInterval: NodeJS.Timeout | null = null;

  /**
   * ステータスバーを描画
   */
  static render(_status: SystemStatus, config: StatusBarConfig = {}): void {
    const _width = config._width || DESIGN_CONSTANTS.STATUS_BAR;

    // Clear previous _line if updating
    if (this.currentStatus) {
      process.stdout.write("\u001b[2K\r");
    }

    // Store current _status
    this.currentStatus = _status;

    // Render separator
    console.log(UNIFIED_COLORS.MUTED("─".repeat(_width)));

    // Render main _status _line
    this.renderMainStatusLine(_status, _width, config);

    // Render metrics _line if enabled
    if (config.showMemory || config.showConnections) {
      this.renderMetricsLine(_status, _width, config);
    }

    // Render bottom separator
    console.log(UNIFIED_COLORS.MUTED("─".repeat(_width)));
  }

  /**
   * メインステータスラインを描画
   */
  private static renderMainStatusLine(
    _status: SystemStatus,
    _width: number,
    config: StatusBarConfig,
  ): void {
    // Left section: Mode
    const _modeIcon = this.getModeIcon(_status.mode);
    const _leftSection = `${_modeIcon} ${TEXT_HIERARCHY.CAPTION("Mode:")} ${TEXT_HIERARCHY.BODY(_status.mode)}`;

    // Center section: AI Provider & Model
    const _centerSection = `${TEXT_HIERARCHY.SUBTITLE(_status.aiProvider)} ${TEXT_HIERARCHY.CAPTION(`(${_status.modelName})`)}`;

    // Right section: Time or Connections
    let rightSection = "";
    if (config.showTime) {
      const _time = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      rightSection = TEXT_HIERARCHY.CAPTION(_time);
    } else if (_status.activeConnections !== undefined) {
      const _connIcon =
        status.activeConnections > 0
          ? UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS)
          : UNIFIED_COLORS.MUTED("○");
      rightSection = `${_connIcon} ${TEXT_HIERARCHY.CAPTION(`${_status.activeConnections} active`)}`;
    }

    // Calculate positions
    const _leftWidth = this.stripAnsi(_leftSection).length;
    const _centerWidth = this.stripAnsi(_centerSection).length;
    const _rightWidth = this.stripAnsi(rightSection).length;

    const _centerPadding = Math.floor((_width - _centerWidth) / 2) - _leftWidth;
    const _rightPadding =
      _width - _leftWidth - _centerPadding - _centerWidth - _rightWidth;

    // Render the _line
    const _statusLine =
      _leftSection +
      " ".repeat(Math.max(0, _centerPadding)) +
      _centerSection +
      " ".repeat(Math.max(0, _rightPadding)) +
      rightSection;

    console.log(_statusLine);
  }

  /**
   * メトリクスラインを描画
   */
  private static renderMetricsLine(
    _status: SystemStatus,
    _width: number,
    config: StatusBarConfig,
  ): void {
    const metrics: string[] = [];

    // Memory usage
    if (config.showMemory && _status.memoryUsage !== undefined) {
      const _memColor = this.getUsageColor(_status.memoryUsage);
      metrics.push(
        `${TEXT_HIERARCHY.CAPTION("Mem:")} ${_memColor(`${_status.memoryUsage}%`)}`,
      );
    }

    // CPU usage
    if (_status.cpuUsage !== undefined) {
      const _cpuColor = this.getUsageColor(_status.cpuUsage);
      metrics.push(
        `${TEXT_HIERARCHY.CAPTION("CPU:")} ${_cpuColor(`${_status.cpuUsage}%`)}`,
      );
    }

    // Response _time
    if (_status.responseTime !== undefined) {
      const _rtColor =
        status.responseTime < 200
          ? UNIFIED_COLORS.SUCCESS
          : _status.responseTime < 500
            ? UNIFIED_COLORS.WARNING
            : UNIFIED_COLORS.ERROR;
      metrics.push(
        `${TEXT_HIERARCHY.CAPTION("RT:")} ${_rtColor(`${_status.responseTime}ms`)}`,
      );
    }

    // Join metrics with separator
    const _metricsLine = metrics.join(TEXT_HIERARCHY.CAPTION(" • "));

    // Center the metrics _line
    const _padding = Math.floor(
      (_width - this.stripAnsi(_metricsLine).length) / 2,
    );
    console.log(" ".repeat(Math.max(0, _padding)) + _metricsLine);
  }

  /**
   * コンパクトステータスバー
   */
  static renderCompact(_status: SystemStatus): void {
    const _modeIcon = this.getModeIcon(_status.mode);
    const _connIcon =
      status.activeConnections > 0
        ? UNIFIED_COLORS.SUCCESS("●")
        : UNIFIED_COLORS.MUTED("○");

    const _statusLine = [
      `${_modeIcon} ${_status.mode}`,
      TEXT_HIERARCHY.CAPTION("•"),
      `${_status.aiProvider}`,
      TEXT_HIERARCHY.CAPTION("•"),
      `${_connIcon} ${_status.activeConnections}`,
    ].join(" ");

    console.log(_statusLine);
  }

  /**
   * リアルタイム更新ステータスバー
   */
  static startLive(
    getStatus: () => SystemStatus | Promise<SystemStatus>,
    config: StatusBarConfig & { _interval?: number } = {},
  ): void {
    const _interval = config._interval || 1000;

    // Clear any existing _interval
    this.stopLive();

    // Initial render
    const _renderStatus = async () => {
      const _status = await getStatus();
      // Move cursor up to overwrite previous _status
      if (this.currentStatus) {
        const _lines = config.showMemory || config.showConnections ? 4 : 3;
        process.stdout.write(`\u001b[${_lines}A`);
      }
      this.render(_status, config);
    };

    // Start _interval
    _renderStatus();
    this.updateInterval = setInterval(_renderStatus, _interval);
  }

  /**
   * リアルタイム更新を停止
   */
  static stopLive(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * ミニステータスバー(1行)
   */
  static renderMini(_status: SystemStatus): void {
    const _elements = [
      this.getModeIcon(_status.mode),
      status.mode.substring(0, 8),
      TEXT_HIERARCHY.CAPTION("|"),
      status.aiProvider.substring(0, 10),
      TEXT_HIERARCHY.CAPTION("|"),
      status.activeConnections > 0
        ? UNIFIED_COLORS.SUCCESS(`${_status.activeConnections}↑`)
        : UNIFIED_COLORS.MUTED("0↑"),
    ];

    console.log(_elements.join(" "));
  }

  /**
   * フローティングステータスバー(画面下部固定)
   */
  static renderFloating(
    _status: SystemStatus,
    _config: StatusBarConfig = {},
  ): void {
    // Save cursor position
    process.stdout.write("\u001b[s");

    // Move to bottom of terminal
    const _rows = process.stdout._rows || 24;
    process.stdout.write(`\u001b[${_rows};0H`);

    // Clear _line and render _status
    process.stdout.write("\u001b[2K");
    this.renderCompact(_status);

    // Restore cursor position
    process.stdout.write("\u001b[u");
  }

  /**
   * カスタムステータスバー
   */
  static renderCustom(
    leftContent: string,
    centerContent: string,
    rightContent: string,
    config: { _width?: number; _color?: (_text: string) => string } = {},
  ): void {
    const _width = config._width || DESIGN_CONSTANTS.STATUS_BAR;
    const _color = config._color || TEXT_HIERARCHY.BODY;

    const _leftWidth = this.stripAnsi(leftContent).length;
    const _centerWidth = this.stripAnsi(centerContent).length;
    const _rightWidth = this.stripAnsi(rightContent).length;

    const _centerPadding = Math.floor((_width - _centerWidth) / 2) - _leftWidth;
    const _rightPadding =
      _width - _leftWidth - _centerPadding - _centerWidth - _rightWidth;

    const _line =
      _color(leftContent) +
      " ".repeat(Math.max(0, _centerPadding)) +
      _color(centerContent) +
      " ".repeat(Math.max(0, _rightPadding)) +
      _color(rightContent);

    console.log(_line);
  }

  /**
   * プログレス付きステータスバー
   */
  static renderWithProgress(
    _status: SystemStatus,
    progress: number,
    label: string = "Progress",
    config: StatusBarConfig = {},
  ): void {
    // Render main _status
    this.render(_status, config);

    // Render progress bar below
    const _width = config._width || DESIGN_CONSTANTS.STATUS_BAR;
    const _barWidth = Math.floor(_width * 0.6);
    const _filled = Math.floor((progress / 100) * _barWidth);
    const _empty = _barWidth - _filled;

    const _progressBar =
      UNIFIED_COLORS.SUCCESS("█".repeat(_filled)) +
      UNIFIED_COLORS.MUTED("░".repeat(_empty));

    const _progressLabel = `${TEXT_HIERARCHY.CAPTION(label)} ${_progressBar} ${TEXT_HIERARCHY.BODY(`${progress}%`)}`;

    const _padding = Math.floor(
      (_width - this.stripAnsi(_progressLabel).length) / 2,
    );
    console.log(" ".repeat(Math.max(0, _padding)) + _progressLabel);
    console.log(UNIFIED_COLORS.MUTED("─".repeat(_width)));
  }

  /**
   * モードに応じたアイコンを取得
   */
  private static getModeIcon(mode: string): string {
    const modeIcons: Record<string, string> = {
      interactive: UNIFIED_COLORS.SUCCESS("●"),
      processing: UNIFIED_COLORS.INFO("◯"),
      error: UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR),
      waiting: UNIFIED_COLORS.MUTED("◯"),
      thinking: UNIFIED_COLORS.INFO("◉"),
      debugging: UNIFIED_COLORS.WARNING("◐"),
      optimizing: UNIFIED_COLORS.SUCCESS("◉"),
      default: UNIFIED_COLORS.MUTED("○"),
    };

    return modeIcons[mode.toLowerCase()] || modeIcons.default;
  }

  /**
   * 使用率に応じた色を取得
   */
  private static getUsageColor(usage: number): (_text: string) => string {
    if (usage < 50) {
      return UNIFIED_COLORS.SUCCESS;
    }
    if (usage < 75) {
      return UNIFIED_COLORS.WARNING;
    }
    return UNIFIED_COLORS.ERROR;
  }

  /**
   * ANSIエスケープコードを除去
   */
  private static stripAnsi(str: string): string {
    return str.replace(/\u001b\[[0-9;]*m/g, "");
  }
}

export default StatusBarRenderer;
