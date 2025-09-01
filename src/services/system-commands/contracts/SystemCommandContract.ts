/**
 * SystemCommand Contract
 *
 * 統一契約定義 - 全SystemCommandで必須遵守
 * 無限ループ根絶とタイムアウト管理の基盤
 */

export interface SystemCommandContract {
  // 必須フィールド(無限ループ根絶)
  readonly requiresInput: false; // 常にfalse(再ディスパッチ防止)

  // 実行メソッド
  execute(): Promise<CommandResultV2>;

  // 必須タイムアウト管理
  deadlineAt?: number;
  signal?: AbortSignal;
}

export interface CommandResultV2 {
  endReason: "success" | "timeout" | "error" | "cancel";
  data?: any;
  error?: string;
  duration: number;
  timestamp: number;
}

export interface ExecutionOptions {
  deadlineAt?: number;
  signal?: AbortSignal;
  level?: "fast" | "normal" | "deep";
}

export interface SystemMetrics {
  cpu: {
    usage: number; // 0-100
    cores: number;
    model: string;
  };
  memory: {
    usage: number; // 0-100
    used: number; // bytes
    total: number; // bytes
    available: number; // bytes
  };
  disk: {
    usage: number; // 0-100
    cwd: string;
    available?: number;
  };
  p95LatencyMs: number;
  errorRate: number; // 0-100
}

export interface SystemHealth {
  healthScore: number; // 0-100
  providers: ProviderHealth[];
  metrics: SystemMetrics;
  level: "fast" | "normal" | "deep";
  timestamp: number;
}

export interface ProviderHealth {
  id: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  status: "healthy" | "degraded" | "failed";
}

export interface ValidationResult {
  ok: boolean;
  errors?: string[];
  warnings?: string[];
  diff?: string;
  dryRun?: boolean;
}

export interface MigrationResult {
  ok: boolean;
  fromVersion: string;
  toVersion: string;
  changes: string[];
  rollbackData?: any;
}
