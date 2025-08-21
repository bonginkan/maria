/**
 * Integrated CLI Type Definitions
 * 統合CLIシステムの型定義
 */

import { InternalMode } from './ModeIndicator.js';

/**
 * チョークスタイル
 */
export type ChalkStyle =
  | 'white'
  | 'gray'
  | 'cyan'
  | 'green'
  | 'yellow'
  | 'red'
  | 'magenta'
  | 'blue';

/**
 * タスクステータス
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

/**
 * 承認決定
 */
export type ApprovalDecision = 'approve' | 'modify' | 'reject' | 'skip' | 'quick_approve';

/**
 * リスクレベル
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * タスクコンテキスト
 */
export interface TaskContext {
  id: string;
  name: string;
  description?: string;
  parentTask?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 提案されたアクション
 */
export interface ProposedAction {
  id: string;
  type: 'create' | 'modify' | 'delete' | 'execute';
  target: string;
  description: string;
  impact?: string;
  reversible?: boolean;
}

/**
 * 承認テーマ
 */
export interface ApprovalTheme {
  id: string;
  category: 'architecture' | 'implementation' | 'refactoring' | 'security' | 'performance';
  title: string;
  description: string;
  impact: RiskLevel;
  suggestedApproach: string;
  alternatives?: string[];
  requiresConfirmation: boolean;
}

/**
 * 承認リクエスト
 */
export interface ApprovalRequest {
  themeId: string;
  context: TaskContext;
  proposedActions: ProposedAction[];
  rationale: string;
  riskAssessment: RiskLevel;
  estimatedTime: string;
  dependencies?: string[];
}

/**
 * タスク
 */
export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  progress?: number;
  estimatedTime?: string;
  actualTime?: string;
  subtasks?: Task[];
  mode?: InternalMode;
}

/**
 * タスク結果
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  summary: string;
  changes?: string[];
  errors?: string[];
  warnings?: string[];
  duration?: number;
}

/**
 * アクティブレポート
 */
export interface ActiveReport {
  id: string;
  type: 'task' | 'progress' | 'completion' | 'error' | 'warning';
  mode: InternalMode;
  content: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * コマンド
 */
export interface Command {
  input: string;
  timestamp: Date;
  mode?: InternalMode;
  result?: TaskResult;
}

/**
 * セッション
 */
export interface Session {
  id: string;
  startTime: Date;
  endTime?: Date;
  commands: Command[];
  modeHistory: Array<{ mode: InternalMode; timestamp: Date }>;
  reports: ActiveReport[];
  approvals: ApprovalRequest[];
}

/**
 * ユーザー設定
 */
export interface UserPreferences {
  theme?: ChalkStyle;
  animationSpeed?: number;
  showTimestamps?: boolean;
  showModes?: boolean;
  showProgress?: boolean;
  autoApprove?: boolean;
  quickApprovePatterns?: string[];
  language?: 'en' | 'ja' | 'zh' | 'ko' | 'vi';
}

/**
 * システム状態
 */
export interface SystemState {
  mode: InternalMode;
  activeTask?: Task;
  pendingApprovals: ApprovalRequest[];
  sessionActive: boolean;
  lastActivity: Date;
  metrics: {
    commandsProcessed: number;
    tasksCompleted: number;
    approvalsHandled: number;
    errors: number;
  };
}

/**
 * モード遷移
 */
export interface ModeTransition {
  from: InternalMode;
  to: InternalMode;
  reason?: string;
  timestamp: Date;
}

/**
 * プログレスアップデート
 */
export interface ProgressUpdate {
  taskId: string;
  current: number;
  total: number;
  percentage: number;
  detail?: string;
  estimatedRemaining?: string;
}

/**
 * エラー情報
 */
export interface ErrorInfo {
  code: string;
  message: string;
  details?: string;
  stack?: string;
  recoverable?: boolean;
  suggestions?: string[];
}

/**
 * CLIレスポンス
 */
export interface CLIResponse {
  mode: InternalMode;
  content: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  code?: string;
  data?: Record<string, unknown>;
}

/**
 * インタラクティブプロンプト
 */
export interface InteractivePrompt {
  type: 'text' | 'confirm' | 'select' | 'multiselect';
  message: string;
  choices?: Array<{ value: string; label: string }>;
  default?: string | boolean | string[];
  validation?: (input: string) => boolean | string;
}

/**
 * ショートカットキー
 */
export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  action: string;
  description: string;
}

/**
 * 統合CLI設定スキーマ
 */
export interface IntegratedCLIConfigSchema {
  input: {
    promptSymbol: string;
    chalkBoxStyle: ChalkStyle;
    maxLineLength: number;
    multilineMode: boolean;
    historySize: number;
  };
  response: {
    showInternalMode: boolean;
    showProgressBar: boolean;
    showApprovalPrompts: boolean;
    animationSpeed: number;
    maxResponseLength: number;
  };
  modeDisplay: {
    position: 'prefix' | 'suffix' | 'floating';
    format: string;
    updateInterval: number;
    colorByCategory: boolean;
  };
  layout: {
    width: number;
    height: number;
    responsive: boolean;
    padding: number;
    margin: number;
  };
  approval: {
    autoApprove: boolean;
    quickApproveEnabled: boolean;
    requireConfirmation: boolean;
    timeout: number;
  };
  reporting: {
    enabled: boolean;
    verbosity: 'minimal' | 'normal' | 'detailed';
    showTaskBreakdown: boolean;
    showTimings: boolean;
  };
  shortcuts: KeyboardShortcut[];
  preferences: UserPreferences;
}

export default IntegratedCLIConfigSchema;
