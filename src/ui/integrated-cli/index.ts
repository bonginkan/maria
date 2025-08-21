/**
 * Integrated CLI System - Main Export
 * 統合CLIシステムのメインエクスポート
 */

// Core Components
export { InputBox } from './InputBox.js';
export type { InputBoxConfig } from './InputBox.js';

export { ResponseRenderer } from './ResponseRenderer.js';
export type { ResponseConfig, TaskProgress } from './ResponseRenderer.js';

export { ModeIndicator, ModeCategory } from './ModeIndicator.js';
export type { InternalMode } from './ModeIndicator.js';

export { LayoutEngine, LayoutZone } from './LayoutEngine.js';
export type { LayoutConfig, ComponentPosition } from './LayoutEngine.js';

// Active Reporting System
export { ActiveReporter } from './ActiveReporter.js';
export type { Task, TaskStatus, Project, ReportConfig } from './ActiveReporter.js';

export { ProgressTracker } from './ProgressTracker.js';
export type {
  ProgressEvent,
  SubTask,
  ExtendedTask,
  ProgressStats,
  VisualizationConfig,
} from './ProgressTracker.js';

export { TaskBreakdownDisplay } from './TaskBreakdownDisplay.js';
export type { TaskHierarchy, DisplayConfig, FilterConfig } from './TaskBreakdownDisplay.js';

// Approval System
export { ApprovalPrompt } from './ApprovalPrompt.js';
export type { ApprovalOption, ApprovalConfig, ApprovalResult } from './ApprovalPrompt.js';

export { KeyboardShortcutHandler, ShortcutCategory } from './KeyboardShortcutHandler.js';
export type { KeyboardShortcut } from './KeyboardShortcutHandler.js';

// Integrated CLI Manager (after all dependencies)
export { IntegratedCLIManager } from './IntegratedCLIManager.js';
export type {
  IntegratedCLIConfig,
  CLIEvent,
  InputConfig,
  ResponseConfig as CLIResponseConfig,
  LayoutConfig as CLILayoutConfig,
} from './IntegratedCLIManager.js';

// Type Definitions
export type { CLIEvent as IntegratedCLIEvent } from './types.js';

/**
 * 統合CLIシステムのファクトリー関数
 */
export async function createIntegratedCLI(config?: Partial<IntegratedCLIConfig>) {
  const { IntegratedCLIManager } = await import('./IntegratedCLIManager.js');
  return new IntegratedCLIManager(config);
}

/**
 * バージョン情報
 */
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

/**
 * デフォルト設定
 */
export const DEFAULT_CONFIG: IntegratedCLIConfig = {
  layout: {
    width: 124,
    responsive: true,
  },
  input: {
    promptSymbol: '>',
    multilineMode: false,
  },
  response: {
    showInternalMode: true,
    showTimestamp: true,
    showProgressBar: true,
    animateText: false,
  },
};

/**
 * ユーティリティ関数
 */
export const Utils = {
  /**
   * カラーテーマ
   */
  colors: {
    primary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    accent: 'magenta',
  },

  /**
   * アイコン
   */
  icons: {
    success: '✓',
    error: '✗',
    warning: '!',
    info: 'i',
    loading: '⠋',
    arrow: '→',
  },

  /**
   * サイズ定数
   */
  sizes: {
    maxWidth: 124,
    minWidth: 80,
    standardHeight: 40,
    compactHeight: 20,
  },
};
