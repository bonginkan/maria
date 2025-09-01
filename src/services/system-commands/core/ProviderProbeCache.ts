/**
 * ProviderProbeCache
 *
 * 軽量プローブ設計の核心実装
 * - in-flight merge: 同一秒内の重複プローブ防止
 * - ヘッジング: primary失敗時のbackup経路
 * - 段階化: fast/normal/deep レベル対応
 * - フェイルソフト: エラー時は過去データ使用
 */

import {
  ProbeOptions,
  OverallProviderHealth,
  CacheMetrics,
} from "../ports/ProviderHealthPort";
import { ProviderHealth } from "../contracts/SystemCommandContract";

interface CacheEntry {
  data: ProviderHealth[];
  timestamp: number;
  ttl: number; // ms
  level: "fast" | "normal" | "deep";
}

interface InFlightProbe {
  promise: Promise<ProviderHealth[]>;
  timestamp: number;
  level: "fast" | "normal" | "deep";
}

export class ProviderProbeCache {
  private cache = new Map<string, CacheEntry>();
  private inFlightProbes = new Map<string, InFlightProbe>();
  private fallbackData: ProviderHealth[] | null = null;
  private providers: AIProvider[] = [];

  // 統計情報
  private stats = {
    requests: 0,
    hits: 0,
    misses: 0,
    errors: 0,
    inFlightMerges: 0,
  };

  constructor(providers: AIProvider[]) {
    this.providers = providers;

    // 定期的なクリーンアップ(5分間隔)
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * 全プロバイダのプローブ実行
   * in-flight merge による重複防止
   */
  async probeAll(options: ProbeOptions = {}): Promise<ProviderHealth[]> {
    this.stats.requests++;

    const {
      timeoutMs = 400,
      hedgeMs = 120,
      level = "normal",
      skipCache = false,
    } = options;

    // キャッシュキー生成(同一秒・同一レベルで統一)
    const cacheKey = this.generateCacheKey(level, timeoutMs);

    // in-flight プローブがあるかチェック
    const inFlight = this.inFlightProbes.get(cacheKey);
    if (inFlight) {
      this.stats.inFlightMerges++;
      try {
        return await inFlight.promise;
      } catch (error) {
        // in-flight プローブが失敗した場合はフォールバック
        return this.getFallbackData();
      }
    }

    // キャッシュチェック
    if (!skipCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.stats.hits++;
        return cached;
      }
    }

    this.stats.misses++;

    // プローブ実行
    const probePromise = this.executeProbe(timeoutMs, hedgeMs, level);
    this.inFlightProbes.set(cacheKey, {
      promise: probePromise,
      timestamp: Date.now(),
      level,
    });

    try {
      const results = await probePromise;

      // キャッシュに保存(レベル別TTL)
      this.saveToCache(cacheKey, results, level);

      // フォールバックデータ更新
      this.updateFallbackData(results);

      return results;
    } catch (error) {
      this.stats.errors++;
      console.error("Provider probe failed:", error);

      // フェイルソフト: キャッシュまたはフォールバックデータを返す
      const fallback = this.getFromCache(cacheKey) || this.getFallbackData();
      return fallback;
    } finally {
      // in-flight プローブを削除
      this.inFlightProbes.delete(cacheKey);
    }
  }

  /**
   * プローブ実行(ヘッジング付き)
   */
  private async executeProbe(
    timeoutMs: number,
    hedgeMs: number,
    level: "fast" | "normal" | "deep",
  ): Promise<ProviderHealth[]> {
    // 並列プローブ with ヘッジング
    const probeResults = await Promise.allSettled(
      this.providers.map((provider) =>
        this.probeWithHedging(provider, timeoutMs, hedgeMs),
      ),
    );

    return probeResults.map((result, index) => {
      const provider = this.providers[index];

      if (result.status === "fulfilled") {
        return result.value;
      } else {
        // エラー時のデフォルト応答
        return {
          id: provider.id,
          ok: false,
          latencyMs: timeoutMs + hedgeMs,
          error: result.reason?.message || "Probe failed",
          status: "failed" as const,
        };
      }
    });
  }

  /**
   * ヘッジング実装
   * primary失敗時にbackup経路でプローブ
   */
  private async probeWithHedging(
    provider: AIProvider,
    timeoutMs: number,
    hedgeMs: number,
  ): Promise<ProviderHealth> {
    const primaryProbe = this.singleProbe(provider, timeoutMs);

    // hedgeMs 後にバックアップ経路開始
    const hedgeProbe = this.delay(hedgeMs).then(
      () => this.singleProbe(provider, timeoutMs, true), // isHedge=true
    );

    try {
      // 最初に成功した方を採用 (Promise.any のポリフィル)
      const result = await Promise.race(
        [primaryProbe, hedgeProbe].map((p) =>
          p.catch((err) => Promise.reject(err)),
        ),
      );
      return result;
    } catch (error) {
      // 両方失敗時のフォールバック
      return {
        id: provider.id,
        ok: false,
        latencyMs: timeoutMs + hedgeMs,
        error: "All probe attempts failed",
        status: "failed",
      };
    }
  }

  /**
   * 単一プロバイダプローブ
   */
  private async singleProbe(
    provider: AIProvider,
    timeoutMs: number,
    isHedge = false,
  ): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      // プロバイダの ping メソッドを呼び出し
      const result = await this.withTimeout(
        provider.ping({ timeout: timeoutMs }),
        timeoutMs,
      );

      const latency = Date.now() - startTime;

      return {
        id: provider.id,
        ok: result.ok,
        latencyMs: latency,
        status: this.determineHealthStatus(result.ok, latency, timeoutMs),
        ...(isHedge && { hedged: true }),
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        id: provider.id,
        ok: false,
        latencyMs: latency,
        error: error instanceof Error ? error.message : "Unknown error",
        status: "failed",
        ...(isHedge && { hedged: true }),
      };
    }
  }

  /**
   * ヘルス状態判定
   */
  private determineHealthStatus(
    ok: boolean,
    latencyMs: number,
    timeoutMs: number,
  ): "healthy" | "degraded" | "failed" {
    if (!ok) return "failed";
    if (latencyMs > timeoutMs * 0.8) return "degraded"; // タイムアウトの80%以上
    return "healthy";
  }

  /**
   * キャッシュキー生成
   */
  private generateCacheKey(level: string, timeoutMs: number): string {
    const timeWindow = Math.floor(Date.now() / 1000); // 1秒単位
    return `${level}:${timeoutMs}:${timeWindow}`;
  }

  /**
   * キャッシュから取得
   */
  private getFromCache(key: string): ProviderHealth[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // TTL チェック
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * キャッシュに保存
   */
  private saveToCache(
    key: string,
    data: ProviderHealth[],
    level: "fast" | "normal" | "deep",
  ): void {
    // レベル別TTL設定
    const ttls = {
      fast: 2000, // 2秒
      normal: 5000, // 5秒
      deep: 30000, // 30秒
    };

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttls[level],
      level,
    });
  }

  /**
   * フォールバックデータ取得
   */
  private getFallbackData(): ProviderHealth[] {
    if (this.fallbackData) {
      return this.fallbackData.map((p) => ({
        ...p,
        fallback: true,
        timestamp: Date.now(),
      }));
    }

    // 最終手段: 全プロバイダを unknown 状態で返す
    return this.providers.map((provider) => ({
      id: provider.id,
      ok: false,
      latencyMs: 0,
      status: "failed" as const,
      error: "No data available",
      fallback: true,
    }));
  }

  /**
   * フォールバックデータ更新
   */
  private updateFallbackData(data: ProviderHealth[]): void {
    // 正常なデータのみフォールバック用に保存
    const healthyData = data.filter((p) => p.ok);
    if (healthyData.length > 0) {
      this.fallbackData = data;
    }
  }

  /**
   * キャッシュクリーンアップ
   */
  private cleanup(): void {
    const now = Date.now();
    const expired = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.timestamp + entry.ttl) {
        expired.push(key);
      }
    });

    expired.forEach((key) => this.cache.delete(key));

    // 古い in-flight プローブも削除(5分以上)
    this.inFlightProbes.forEach((probe, key) => {
      if (now > probe.timestamp + 5 * 60 * 1000) {
        this.inFlightProbes.delete(key);
      }
    });
  }

  /**
   * キャッシュメトリクス取得
   */
  getCacheMetrics(): CacheMetrics {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map((e) => e.timestamp);

    return {
      hitRate:
        this.stats.requests > 0 ? this.stats.hits / this.stats.requests : 0,
      entries: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }

  /**
   * メモリ使用量推定
   */
  private estimateMemoryUsage(): number {
    // 概算値(キー + データのJSON文字列長)
    let size = 0;
    this.cache.forEach((entry, key) => {
      size += key.length * 2; // UTF-16
      size += JSON.stringify(entry).length * 2;
    });
    return size;
  }

  /**
   * 統計情報取得
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * キャッシュクリア
   */
  clear(): void {
    this.cache.clear();
    this.inFlightProbes.clear();
    this.stats = {
      requests: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      inFlightMerges: 0,
    };
  }

  /**
   * ユーティリティ
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout")), timeoutMs);

      // Node.js環境でのunref
      if (typeof (timer as any).unref === "function") {
        (timer as any).unref();
      }
    });

    return Promise.race([promise, timeoutPromise]);
  }
}

/**
 * AIProvider interface (既存のプロバイダ実装に合わせて調整)
 */
interface AIProvider {
  id: string;
  ping(options: {
    timeout: number;
  }): Promise<{ ok: boolean; [key: string]: any }>;
}
