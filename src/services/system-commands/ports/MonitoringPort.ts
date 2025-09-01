/**
 * MonitoringPort
 *
 * システム監視の抽象化ポート
 * メトリクス収集・記録・分析の責務を分離
 */

export interface MonitoringPort {
  // メトリクス記録
  recordLatency(operation: string, ms: number): void;
  recordValue(
    metric: string,
    value: number,
    tags?: Record<string, string>,
  ): void;
  recordEvent(event: string, tags?: Record<string, any>): void;

  // システムメトリクス取得
  getSystemMetrics(timeoutMs?: number): Promise<SystemMetricsSnapshot>;
  getCPUUsage(): Promise<CPUMetrics>;
  getMemoryUsage(): Promise<MemoryMetrics>;
  getDiskUsage(): Promise<DiskMetrics>;

  // パフォーマンス分析
  getLatencyPercentiles(
    operation: string,
    windowMs?: number,
  ): Promise<LatencyPercentiles>;
  getErrorRate(windowMs?: number): Promise<number>;

  // ヘルスチェック
  isHealthy(): boolean;
  getHealthSummary(): HealthSummary;
}

export interface SystemMetricsSnapshot {
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  timestamp: number;
}

export interface CPUMetrics {
  usage: number; // 0-100
  cores: number;
  model: string;
  loadAverage: number[];
}

export interface MemoryMetrics {
  usage: number; // 0-100 percentage
  used: number; // bytes
  total: number; // bytes
  available: number; // bytes
  process: {
    used: number;
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
}

export interface DiskMetrics {
  usage: number; // 0-100
  cwd: string;
  available?: number; // bytes
  total?: number; // bytes
}

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  count: number;
  min: number;
  max: number;
}

export interface HealthSummary {
  overall: "healthy" | "degraded" | "critical";
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
}
