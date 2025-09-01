/**
 * TimeSeriesPort
 *
 * 時系列データ管理の抽象化ポート
 * メトリクス履歴・トレンド分析・アラートの責務を分離
 */

export interface TimeSeriesPort {
  // データ保存
  record(
    metric: string,
    value: number,
    timestamp?: number,
    tags?: Record<string, string>,
  ): Promise<void>;
  recordBatch(entries: TimeSeriesEntry[]): Promise<void>;

  // データ取得
  query(metric: string, options?: QueryOptions): Promise<TimeSeriesData>;
  queryMultiple(
    metrics: string[],
    options?: QueryOptions,
  ): Promise<Record<string, TimeSeriesData>>;

  // 集約・分析
  aggregate(
    metric: string,
    aggregation: AggregationType,
    options?: QueryOptions,
  ): Promise<AggregatedData>;
  getTrends(metric: string, windowMs: number): Promise<TrendAnalysis>;

  // アラート
  checkThresholds(metric: string): Promise<AlertResult[]>;
  setThreshold(metric: string, threshold: ThresholdConfig): Promise<void>;

  // メンテナンス
  cleanup(olderThanMs: number): Promise<number>; // 削除された件数を返す
  getStorageMetrics(): Promise<StorageMetrics>;
}

export interface TimeSeriesEntry {
  metric: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface QueryOptions {
  startTime?: number; // Unix timestamp
  endTime?: number; // Unix timestamp
  limit?: number; // 最大取得数
  tags?: Record<string, string>; // フィルタ条件
  downsample?: DownsampleOptions; // ダウンサンプリング
}

export interface DownsampleOptions {
  interval: number; // ms
  aggregation: AggregationType;
}

export type AggregationType =
  | "avg"
  | "sum"
  | "min"
  | "max"
  | "count"
  | "p50"
  | "p95"
  | "p99";

export interface TimeSeriesData {
  metric: string;
  dataPoints: DataPoint[];
  metadata: {
    count: number;
    startTime: number;
    endTime: number;
    interval?: number; // ダウンサンプリング間隔
  };
}

export interface DataPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

export interface AggregatedData {
  metric: string;
  aggregation: AggregationType;
  value: number;
  count: number;
  startTime: number;
  endTime: number;
}

export interface TrendAnalysis {
  metric: string;
  trend: "increasing" | "decreasing" | "stable" | "volatile";
  slope: number; // 変化率 (value/ms)
  confidence: number; // 0-1 信頼度
  r2: number; // 決定係数
  forecast: DataPoint[]; // 予測データポイント
  windowMs: number;
}

export interface ThresholdConfig {
  metric: string;
  warning: number;
  critical: number;
  comparison: "gt" | "lt" | "eq"; // greater than, less than, equal
  windowMs?: number; // チェック対象期間
  suppressionMs?: number; // アラート抑制時間
}

export interface AlertResult {
  metric: string;
  level: "warning" | "critical";
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: number;
  suppressed: boolean;
}

export interface StorageMetrics {
  totalMetrics: number;
  totalDataPoints: number;
  diskUsageBytes: number;
  memoryUsageBytes: number;
  oldestDataPoint: number; // timestamp
  newestDataPoint: number; // timestamp
  indexSize: number; // インデックスサイズ
}
