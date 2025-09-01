/**
 * ProviderHealthPort
 *
 * AIプロバイダヘルス監視の抽象化ポート
 * 軽量プローブ・キャッシュ・ヘッジングの責務を分離
 */

import { ProviderHealth } from "../contracts/SystemCommandContract";

export interface ProviderHealthPort {
  // プロバイダプローブ
  probeAll(options?: ProbeOptions): Promise<ProviderHealth[]>;
  probeOne(providerId: string, options?: ProbeOptions): Promise<ProviderHealth>;

  // ヘルススコア
  getHealthScore(): Promise<number>;
  getOverallHealth(): Promise<OverallProviderHealth>;

  // キャッシュ管理
  clearCache(): void;
  getCacheMetrics(): CacheMetrics;
}

export interface ProbeOptions {
  timeoutMs?: number; // デフォルト: 400ms
  hedgeMs?: number; // デフォルト: 120ms (ヘッジング開始時間)
  level?: "fast" | "normal" | "deep"; // fast=50ms, normal=500ms, deep=3s
  skipCache?: boolean; // キャッシュをスキップ
}

export interface OverallProviderHealth {
  healthy: number; // 正常なプロバイダ数
  degraded: number; // 劣化状態のプロバイダ数
  failed: number; // 失敗状態のプロバイダ数
  total: number; // 総プロバイダ数
  healthScore: number; // 0-100
  averageLatency: number; // ms
  worstLatency: number; // ms
  timestamp: number;
}

export interface CacheMetrics {
  hitRate: number; // 0-1 キャッシュヒット率
  entries: number; // キャッシュエントリ数
  memoryUsage: number; // bytes
  oldestEntry: number; // timestamp
  newestEntry: number; // timestamp
}

export interface ProviderConfig {
  id: string;
  name: string;
  endpoint: string;
  enabled: boolean;
  priority: number; // 1-10 (10が最高優先度)
  timeout: number; // ms
  retryAttempts: number;
  hedgingEnabled: boolean;
}
