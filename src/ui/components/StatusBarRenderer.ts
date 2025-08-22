/**
 * Status Bar Renderer
 * 124文字幅に最適化されたステータスバー表示システム
 */

import chalk from 'chalk';
import { TEXT_HIERARCHY, UNIFIED_COLORS } from '../design-system/UnifiedColorPalette.js';
import { MINIMAL_ICONS } from '../design-system/MinimalIconRegistry.js';
import { DESIGN_CONSTANTS } from '../optimized-design-system.js';
import { LayoutManager } from '../design-system/LayoutManager.js';

/**
 * ステータスバーの設定
 */
export interface StatusBarConfig {
  width?: number;
  showTime?: boolean;
  showMemory?: boolean;
  showConnections?: boolean;
  theme?: 'light' | 'dark' | 'auto';
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
  static render(status: SystemStatus, config: StatusBarConfig = {}): void {
    const width = config.width || DESIGN_CONSTANTS.STATUS_BAR;

    // Clear previous line if updating
    if (this.currentStatus) {
      process.stdout.write('\x1b[2K\r');
    }

    // Store current status
    this.currentStatus = status;

    // Render separator
    console.log(UNIFIED_COLORS.MUTED('─'.repeat(width)));

    // Render main status line
    this.renderMainStatusLine(status, width, config);

    // Render metrics line if enabled
    if (config.showMemory || config.showConnections) {
      this.renderMetricsLine(status, width, config);
    }

    // Render bottom separator
    console.log(UNIFIED_COLORS.MUTED('─'.repeat(width)));
  }

  /**
   * メインステータスラインを描画
   */
  private static renderMainStatusLine(
    status: SystemStatus,
    width: number,
    config: StatusBarConfig,
  ): void {
    // Left section: Mode
    const modeIcon = this.getModeIcon(status.mode);
    const leftSection = `${modeIcon} ${TEXT_HIERARCHY.CAPTION('Mode:')} ${TEXT_HIERARCHY.BODY(status.mode)}`;

    // Center section: AI Provider & Model
    const centerSection = `${TEXT_HIERARCHY.SUBTITLE(status.aiProvider)} ${TEXT_HIERARCHY.CAPTION(`(${status.modelName})`)}`;

    // Right section: Time or Connections
    let rightSection = '';
    if (config.showTime) {
      const time = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      rightSection = TEXT_HIERARCHY.CAPTION(time);
    } else if (status.activeConnections !== undefined) {
      const connIcon =
        status.activeConnections > 0
          ? UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS)
          : UNIFIED_COLORS.MUTED('○');
      rightSection = `${connIcon} ${TEXT_HIERARCHY.CAPTION(`${status.activeConnections} active`)}`;
    }

    // Calculate positions
    const leftWidth = this.stripAnsi(leftSection).length;
    const centerWidth = this.stripAnsi(centerSection).length;
    const rightWidth = this.stripAnsi(rightSection).length;

    const centerPadding = Math.floor((width - centerWidth) / 2) - leftWidth;
    const rightPadding = width - leftWidth - centerPadding - centerWidth - rightWidth;

    // Render the line
    const statusLine =
      leftSection +
      ' '.repeat(Math.max(0, centerPadding)) +
      centerSection +
      ' '.repeat(Math.max(0, rightPadding)) +
      rightSection;

    console.log(statusLine);
  }

  /**
   * メトリクスラインを描画
   */
  private static renderMetricsLine(
    status: SystemStatus,
    width: number,
    config: StatusBarConfig,
  ): void {
    const metrics: string[] = [];

    // Memory usage
    if (config.showMemory && status.memoryUsage !== undefined) {
      const memColor = this.getUsageColor(status.memoryUsage);
      metrics.push(`${TEXT_HIERARCHY.CAPTION('Mem:')} ${memColor(`${status.memoryUsage}%`)}`);
    }

    // CPU usage
    if (status.cpuUsage !== undefined) {
      const cpuColor = this.getUsageColor(status.cpuUsage);
      metrics.push(`${TEXT_HIERARCHY.CAPTION('CPU:')} ${cpuColor(`${status.cpuUsage}%`)}`);
    }

    // Response time
    if (status.responseTime !== undefined) {
      const rtColor =
        status.responseTime < 200
          ? UNIFIED_COLORS.SUCCESS
          : status.responseTime < 500
            ? UNIFIED_COLORS.WARNING
            : UNIFIED_COLORS.ERROR;
      metrics.push(`${TEXT_HIERARCHY.CAPTION('RT:')} ${rtColor(`${status.responseTime}ms`)}`);
    }

    // Join metrics with separator
    const metricsLine = metrics.join(TEXT_HIERARCHY.CAPTION(' • '));

    // Center the metrics line
    const padding = Math.floor((width - this.stripAnsi(metricsLine).length) / 2);
    console.log(' '.repeat(Math.max(0, padding)) + metricsLine);
  }

  /**
   * コンパクトステータスバー
   */
  static renderCompact(status: SystemStatus): void {
    const modeIcon = this.getModeIcon(status.mode);
    const connIcon =
      status.activeConnections > 0 ? UNIFIED_COLORS.SUCCESS('●') : UNIFIED_COLORS.MUTED('○');

    const statusLine = [
      `${modeIcon} ${status.mode}`,
      TEXT_HIERARCHY.CAPTION('•'),
      `${status.aiProvider}`,
      TEXT_HIERARCHY.CAPTION('•'),
      `${connIcon} ${status.activeConnections}`,
    ].join(' ');

    console.log(statusLine);
  }

  /**
   * リアルタイム更新ステータスバー
   */
  static startLive(
    getStatus: () => SystemStatus | Promise<SystemStatus>,
    config: StatusBarConfig & { interval?: number } = {},
  ): void {
    const interval = config.interval || 1000;

    // Clear any existing interval
    this.stopLive();

    // Initial render
    const renderStatus = async () => {
      const status = await getStatus();
      // Move cursor up to overwrite previous status
      if (this.currentStatus) {
        const lines = config.showMemory || config.showConnections ? 4 : 3;
        process.stdout.write(`\x1b[${lines}A`);
      }
      this.render(status, config);
    };

    // Start interval
    renderStatus();
    this.updateInterval = setInterval(renderStatus, interval);
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
   * ミニステータスバー（1行）
   */
  static renderMini(status: SystemStatus): void {
    const elements = [
      this.getModeIcon(status.mode),
      status.mode.substring(0, 8),
      TEXT_HIERARCHY.CAPTION('|'),
      status.aiProvider.substring(0, 10),
      TEXT_HIERARCHY.CAPTION('|'),
      status.activeConnections > 0
        ? UNIFIED_COLORS.SUCCESS(`${status.activeConnections}↑`)
        : UNIFIED_COLORS.MUTED('0↑'),
    ];

    console.log(elements.join(' '));
  }

  /**
   * フローティングステータスバー（画面下部固定）
   */
  static renderFloating(status: SystemStatus, config: StatusBarConfig = {}): void {
    // Save cursor position
    process.stdout.write('\x1b[s');

    // Move to bottom of terminal
    const rows = process.stdout.rows || 24;
    process.stdout.write(`\x1b[${rows};0H`);

    // Clear line and render status
    process.stdout.write('\x1b[2K');
    this.renderCompact(status);

    // Restore cursor position
    process.stdout.write('\x1b[u');
  }

  /**
   * カスタムステータスバー
   */
  static renderCustom(
    leftContent: string,
    centerContent: string,
    rightContent: string,
    config: { width?: number; color?: (text: string) => string } = {},
  ): void {
    const width = config.width || DESIGN_CONSTANTS.STATUS_BAR;
    const color = config.color || TEXT_HIERARCHY.BODY;

    const leftWidth = this.stripAnsi(leftContent).length;
    const centerWidth = this.stripAnsi(centerContent).length;
    const rightWidth = this.stripAnsi(rightContent).length;

    const centerPadding = Math.floor((width - centerWidth) / 2) - leftWidth;
    const rightPadding = width - leftWidth - centerPadding - centerWidth - rightWidth;

    const line =
      color(leftContent) +
      ' '.repeat(Math.max(0, centerPadding)) +
      color(centerContent) +
      ' '.repeat(Math.max(0, rightPadding)) +
      color(rightContent);

    console.log(line);
  }

  /**
   * プログレス付きステータスバー
   */
  static renderWithProgress(
    status: SystemStatus,
    progress: number,
    label: string = 'Progress',
    config: StatusBarConfig = {},
  ): void {
    // Render main status
    this.render(status, config);

    // Render progress bar below
    const width = config.width || DESIGN_CONSTANTS.STATUS_BAR;
    const barWidth = Math.floor(width * 0.6);
    const filled = Math.floor((progress / 100) * barWidth);
    const empty = barWidth - filled;

    const progressBar =
      UNIFIED_COLORS.SUCCESS('█'.repeat(filled)) + UNIFIED_COLORS.MUTED('░'.repeat(empty));

    const progressLabel = `${TEXT_HIERARCHY.CAPTION(label)} ${progressBar} ${TEXT_HIERARCHY.BODY(`${progress}%`)}`;

    const padding = Math.floor((width - this.stripAnsi(progressLabel).length) / 2);
    console.log(' '.repeat(Math.max(0, padding)) + progressLabel);
    console.log(UNIFIED_COLORS.MUTED('─'.repeat(width)));
  }

  /**
   * モードに応じたアイコンを取得
   */
  private static getModeIcon(mode: string): string {
    const modeIcons: Record<string, string> = {
      interactive: UNIFIED_COLORS.SUCCESS('●'),
      processing: UNIFIED_COLORS.INFO('◯'),
      error: UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR),
      waiting: UNIFIED_COLORS.MUTED('◯'),
      thinking: UNIFIED_COLORS.INFO('◉'),
      debugging: UNIFIED_COLORS.WARNING('◐'),
      optimizing: UNIFIED_COLORS.SUCCESS('◉'),
      default: UNIFIED_COLORS.MUTED('○'),
    };

    return modeIcons[mode.toLowerCase()] || modeIcons.default;
  }

  /**
   * 使用率に応じた色を取得
   */
  private static getUsageColor(usage: number): (text: string) => string {
    if (usage < 50) {return UNIFIED_COLORS.SUCCESS;}
    if (usage < 75) {return UNIFIED_COLORS.WARNING;}
    return UNIFIED_COLORS.ERROR;
  }

  /**
   * ANSIエスケープコードを除去
   */
  private static stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }
}

export default StatusBarRenderer;
