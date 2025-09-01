/**
 * AI Orchestration Unified Interfaces (Ports)
 *
 * 統一インターフェース定義により、既存4サービスを
 * 無改造で統合・活用可能にする
 */

// ============================================
// Common Types
// ============================================

/** タスク種別 */
export type OrchestrateTask =
  | "lint" // コードレビュー・静的解析
  | "gen" // コンテンツ生成
  | "vision" // 画像認識・マルチモーダル
  | "code" // コード生成・実装
  | "review" // コードレビュー・設計評価
  | "chat" // 対話・質問応答
  | "summarize" // 要約・圧縮
  | "test" // テスト生成・検証
  | "ultra" // Ultra-thinking(深い思考)
  | "deep"; // 深層分析

/** コンテンツサイズ */
export type OrchestrateSize = "small" | "medium" | "large";

/** 言語設定 */
export type OrchestrateLanguage = "ja" | "en" | "auto";

/** メッセージロール */
export type MessageRole = "user" | "assistant" | "system";

/** 会話メッセージ */
export interface Message {
  role: MessageRole;
  content: string;
}

/** オーケストレーションコンテキスト */
export interface OrchestrateContext {
  /** LLMに渡す直近文脈(optimize対象) */
  messages: Message[];

  /** 任意メタデータ */
  meta?: {
    tenantId?: string;
    requestId?: string;
    sessionId?: string;
    [key: string]: any;
  };
}

/** オーケストレーションリクエスト */
export interface OrchestrateRequest {
  /** タスク種別(必須) */
  task: OrchestrateTask;

  /** コンテンツサイズ(必須) */
  size: OrchestrateSize;

  /** ビジョン機能が必要か */
  needsVision?: boolean;

  /** ストリーミングが必要か */
  needsStreaming?: boolean;

  /** 言語設定 */
  language?: OrchestrateLanguage;

  /** 品質要求レベル */
  quality?: "draft" | "production" | "critical";

  /** 緊急度 */
  urgency?: "low" | "normal" | "high";

  /** コンテキスト(必須) */
  context: OrchestrateContext;

  /** モード指定(optional) */
  mode?: string;
}

// ============================================
// Provider & Routing Types
// ============================================

/** プロバイダ実行入力 */
export interface ProviderExecuteInput {
  /** 使用モデル */
  model: string;

  /** モデルパラメータ */
  params?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    [key: string]: any;
  };

  /** 実行コンテキスト */
  context: OrchestrateContext;
}

/** プロバイダ実行結果 */
export interface ProviderExecuteResult {
  /** 生成された出力 */
  output: string;

  /** メタデータ */
  meta?: {
    tokensIn?: number;
    tokensOut?: number;
    latencyMs?: number;
    cost?: number;
    [key: string]: any;
  };
}

/** プロバイダ実行器インターフェース */
export interface ProviderExecutor {
  /** 実行(実LLM呼び出し) */
  execute(input: ProviderExecuteInput): Promise<ProviderExecuteResult>;
}

/** ルーティング決定結果 */
export interface RouteDecision {
  /** プロバイダ名 */
  providerName: string;

  /** モデル名 */
  model: string;

  /** モデルパラメータ */
  params?: Record<string, any>;

  /** サーキット/レート制御キー */
  circuitKey: string;

  /** プロバイダ実行器 */
  provider: ProviderExecutor;

  /** フォールバック候補(コスト昇順) */
  fallbacks?: Array<Omit<RouteDecision, "fallbacks">>;

  /** ルーティングルール名(デバッグ用) */
  ruleName?: string;
}

// ============================================
// Port Interfaces (統一インターフェース)
// ============================================

/** モデルルーターポート */
export interface IModelRouter {
  /**
   * リクエストに基づいて最適なモデルを選択
   */
  route(req: OrchestrateRequest): Promise<RouteDecision>;

  /**
   * パフォーマンス統計取得(optional)
   */
  getStats?(): Record<string, any>;
}

/** コンテキスト最適化ポート */
export interface IContextOptimizer {
  /**
   * コンテキストを最適化(Cut/Compress/Abstract)
   */
  optimize(
    ctx: OrchestrateContext,
    opts?: {
      /** 目標トークン数 */
      budgetTokens?: number;
      /** 圧縮レベル */
      compressionLevel?: "light" | "medium" | "aggressive";
      /** 品質しきい値 */
      qualityThreshold?: number;
      /** 構造保持フラグ */
      preserveStructure?: boolean;
    },
  ): Promise<OrchestrateContext>;
}

/** リクエストガードポート */
export interface IRequestGuard {
  /**
   * サーキットブレーカー・リトライ・レート制限付き実行
   */
  run<T>(
    key: string,
    fn: () => Promise<T>,
    opts?: {
      /** 最大リトライ回数 */
      maxRetries?: number;
      /** バックオフ設定 */
      backoff?: {
        baseDelayMs?: number;
        maxDelayMs?: number;
        multiplier?: number;
      };
      /** レート制限スキップ */
      skipRateLimit?: boolean;
    },
  ): Promise<T>;

  /**
   * サーキット状態取得(optional)
   */
  getCircuitStates?(): Record<string, any>;

  /**
   * メトリクス取得(optional)
   */
  getMetrics?(): Record<string, any>;
}

// ============================================
// Telemetry Types
// ============================================

/** テレメトリイベント */
export interface TelemetryEvent {
  /** イベント名 */
  name: string;

  /** タイムスタンプ */
  at: number;

  /** リクエスト情報 */
  request?: Partial<OrchestrateRequest>;

  /** ルーティング決定 */
  decision?: Partial<RouteDecision>;

  /** 処理時間 */
  durationMs?: number;

  /** タグ */
  tags?: Record<string, string | number | boolean>;

  /** メトリクス */
  metrics?: {
    tokensIn?: number;
    tokensOut?: number;
    fallbackCount?: number;
    circuitState?: string;
    cost?: number;
  };
}

/** オーケストレーションテレメトリ */
export interface OrchestrationTelemetry {
  /**
   * イベント送信
   */
  emit(event: TelemetryEvent): void;

  /**
   * バッチ送信(optional)
   */
  flush?(): Promise<void>;
}

// ============================================
// Pipeline Types
// ============================================

/** パイプライン依存関係 */
export interface OrchestrationPipelineDeps {
  /** モデルルーター */
  router: IModelRouter;

  /** コンテキスト最適化 */
  optimizer: IContextOptimizer;

  /** リクエストガード */
  guard: IRequestGuard;

  /** テレメトリ(optional) */
  telemetry?: OrchestrationTelemetry;

  /** シャドー評価ルーター(optional) */
  shadowRouter?: IModelRouter;

  /** シャドー評価率(0.0-1.0) */
  shadowRate?: number;
}

/** パイプライン実行結果 */
export interface OrchestrationResult {
  /** 生成された出力 */
  output: string;

  /** メタデータ */
  meta?: {
    /** 使用されたモデル */
    model?: string;
    /** プロバイダ名 */
    provider?: string;
    /** トークン使用量 */
    tokensIn?: number;
    tokensOut?: number;
    /** 処理時間 */
    latencyMs?: number;
    /** 推定コスト */
    cost?: number;
    /** フォールバック使用回数 */
    fallbackCount?: number;
    /** シャドー評価結果 */
    shadow?: {
      model?: string;
      latencyMs?: number;
      matched?: boolean;
    };
  };
}

// ============================================
// Error Types
// ============================================

/** オーケストレーションエラー基底クラス */
export class OrchestrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = "OrchestrationError";
  }
}

/** ルーティングエラー */
export class RoutingError extends OrchestrationError {
  constructor(message: string, details?: any) {
    super(message, "ROUTING_ERROR", details);
    this.name = "RoutingError";
  }
}

/** 最適化エラー */
export class OptimizationError extends OrchestrationError {
  constructor(message: string, details?: any) {
    super(message, "OPTIMIZATION_ERROR", details);
    this.name = "OptimizationError";
  }
}

/** ガードエラー(サーキットオープン等) */
export class GuardError extends OrchestrationError {
  constructor(message: string, details?: any) {
    super(message, "GUARD_ERROR", details);
    this.name = "GuardError";
  }
}

/** 全フォールバック失敗 */
export class AllFallbacksFailedError extends OrchestrationError {
  constructor(attempts: number, models: string[], details?: any) {
    super(
      `All ${attempts} fallback attempts failed. Tried models: ${models.join(", ")}`,
      "ALL_FALLBACKS_FAILED",
      details,
    );
    this.name = "AllFallbacksFailedError";
  }
}

// ============================================
// Utility Types
// ============================================

/** パフォーマンス統計 */
export interface PerformanceStats {
  /** 平均値 */
  avg: number;
  /** P95値 */
  p95: number;
  /** P99値 */
  p99?: number;
  /** 最小値 */
  min?: number;
  /** 最大値 */
  max?: number;
  /** カウント */
  count: number;
}

/** モデル比較結果 */
export interface ModelComparison {
  /** プライマリモデル */
  primary: {
    model: string;
    latencyMs: number;
    tokensOut?: number;
    cost?: number;
  };
  /** シャドーモデル */
  shadow: {
    model: string;
    latencyMs: number;
    tokensOut?: number;
    cost?: number;
  };
  /** 出力一致率 */
  outputMatch?: number;
  /** レイテンシ差分 */
  latencyDiff?: number;
  /** コスト差分 */
  costDiff?: number;
}
