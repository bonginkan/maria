/**
 * Internal Mode System - Type Definitions
 *
 * Comprehensive type system for MARIA CODE's internal mode functionality.
 * Integrates with existing Intelligent Router Service for real-time mode switching.
 */

export type ModeCategory =
  | 'reasoning' // 基本推論系モード
  | 'creative' // 創出・生成系モード
  | 'analytical' // 分析・要約系モード
  | 'structural' // ビジュアル・構造化系モード
  | 'validation' // 精査・検証系モード
  | 'contemplative' // 内省・熟成系モード
  | 'intensive' // 苦労・試行錯誤系モード
  | 'learning' // 学習・探索系モード
  | 'collaborative'; // 協調・対話系モード

export type ModeIntensity = 'light' | 'normal' | 'deep' | 'ultra';

export type ModeTriggerType =
  | 'intent' // 意図ベース
  | 'context' // コンテキストベース
  | 'situation' // 状況ベース
  | 'pattern' // パターンベース
  | 'manual'; // 手動指定

export interface ModeDefinition {
  id: string;
  name: string;
  symbol: string; // ✽ の後に表示される記号
  category: ModeCategory;
  intensity: ModeIntensity;
  description: string;
  purpose: string;
  useCases: string[];

  // トリガー条件
  triggers: ModeTrigger[];

  // 表示・動作設定
  display: ModeDisplay;

  // 多言語対応
  i18n: Record<string, ModeI18n>;

  // メタデータ
  metadata: ModeMetadata;
}

export interface ModeTrigger {
  type: ModeTriggerType;
  conditions: TriggerCondition[];
  weight: number; // 0.0 - 1.0
  confidence: number; // 必要な信頼度閾値
}

export interface TriggerCondition {
  field: string; // 'intent', 'context', 'keywords', 'entities', etc.
  operator: 'contains' | 'equals' | 'matches' | 'startsWith' | 'endsWith';
  value: string | string[] | RegExp;
  weight: number;
}

export interface ModeDisplay {
  color: string; // chalk color
  animation: boolean; // アニメーション有効
  duration: number; // 表示時間 (ms)
  prefix: string; // "✽" のカスタマイズ
  suffix: string; // "…" のカスタマイズ
}

export interface ModeI18n {
  name: string;
  description: string;
  purpose: string;
  useCases: string[];
}

export interface ModeMetadata {
  version: string;
  author: string;
  created: Date;
  updated: Date;
  tags: string[];
  experimental: boolean;
  deprecated: boolean;
}

export interface ModeRecognitionResult {
  mode: ModeDefinition;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  alternatives: Array<{
    mode: ModeDefinition;
    confidence: number;
  }>;
  triggers: Array<{
    type: ModeTriggerType;
    score: number;
    details: string;
  }>;
}

export interface ModeContext {
  // 現在の状況
  currentMode?: ModeDefinition;
  previousModes: ModeHistoryEntry[];

  // ユーザー入力
  userInput: string;
  language: string;

  // システム状態
  commandHistory: string[];
  projectContext?: ProjectContext;
  errorState?: ErrorContext;

  // 学習データ
  userPatterns: UserPattern[];

  // タイムスタンプ
  timestamp: Date;
}

export interface ModeHistoryEntry {
  mode: ModeDefinition;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  trigger: ModeTriggerType;
  userFeedback?: 'positive' | 'negative' | 'neutral';
}

export interface ProjectContext {
  type: 'code' | 'documentation' | 'configuration' | 'media' | 'other';
  files: string[];
  languages: string[];
  frameworks: string[];
  hasErrors: boolean;
  hasTests: boolean;
}

export interface ErrorContext {
  type: 'syntax' | 'runtime' | 'build' | 'lint' | 'test' | 'network';
  message: string;
  location?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface UserPattern {
  sequence: string[]; // モード遷移パターン
  frequency: number;
  lastUsed: Date;
  success: number; // 成功率 (0.0 - 1.0)
}

export interface ModeTransition {
  from: string; // モードID
  to: string; // モードID
  trigger: ModeTriggerType;
  confidence: number;
  automatic: boolean;
  userConfirmed?: boolean;
  timestamp: Date;
}

export interface ModeConfig {
  // 認識設定
  confidenceThreshold: number; // 0.85
  autoSwitchEnabled: boolean; // true
  confirmationRequired: boolean; // false for high confidence

  // 表示設定
  showTransitions: boolean; // true
  animationEnabled: boolean; // true
  colorEnabled: boolean; // true

  // 学習設定
  learningEnabled: boolean; // true
  patternTrackingEnabled: boolean; // true
  feedbackEnabled: boolean; // true

  // 多言語設定
  defaultLanguage: string; // 'en'
  supportedLanguages: string[]; // ['en', 'ja', 'cn', 'ko', 'vn']

  // パフォーマンス設定
  maxHistoryEntries: number; // 1000
  maxPatterns: number; // 500
  recognitionTimeout: number; // 200ms
}

export interface ModeServiceEvents {
  'mode:changed': (transition: ModeTransition) => void;
  'mode:suggested': (suggestion: ModeRecognitionResult) => void;
  'mode:error': (error: Error) => void;
  'recognition:completed': (result: ModeRecognitionResult) => void;
  'learning:updated': (patterns: UserPattern[]) => void;
}

// Export default mode categories with their descriptions
export const MODE_CATEGORIES: Record<ModeCategory, { description: string; icon: string }> = {
  reasoning: { description: '基本推論・思考プロセス', icon: '🧠' },
  creative: { description: '創造・生成・アイデア出し', icon: '💡' },
  analytical: { description: '分析・要約・整理', icon: '📊' },
  structural: { description: 'ビジュアル・構造化', icon: '📐' },
  validation: { description: '精査・検証・デバッグ', icon: '🔍' },
  contemplative: { description: '内省・熟考・深層思考', icon: '🤔' },
  intensive: { description: '集中・努力・試行錯誤', icon: '💪' },
  learning: { description: '学習・探索・発見', icon: '📚' },
  collaborative: { description: '協調・対話・支援', icon: '🤝' },
};

// Export default trigger weights
export const DEFAULT_TRIGGER_WEIGHTS: Record<ModeTriggerType, number> = {
  intent: 0.4, // 40% - ユーザー意図が最重要
  context: 0.3, // 30% - コンテキスト
  situation: 0.2, // 20% - 現在の状況
  pattern: 0.1, // 10% - 学習パターン
  manual: 1.0, // 100% - 手動指定は絶対
};
