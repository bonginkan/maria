/**
 * AIProviderHealthAdapter
 *
 * ProviderHealthPortの既存AIProviderManager統合実装
 * 8プロバイダの軽量プローブ・ヘルス監視を実現
 */

import {
  ProviderHealthPort,
  ProbeOptions,
  OverallProviderHealth,
  CacheMetrics,
  ProviderConfig,
} from "../ports/ProviderHealthPort";
import { ProviderHealth } from "../contracts/SystemCommandContract";
import { ProviderProbeCache } from "../core/ProviderProbeCache";
import { AIProviderManager } from "../../../providers/manager";
import { ConfigManager } from "../../../config/config-manager";

export class AIProviderHealthAdapter implements ProviderHealthPort {
  private providerManager: AIProviderManager;
  private probeCache: ProviderProbeCache;
  private configManager: ConfigManager;

  // ヘルススコア計算用キャッシュ
  private healthScoreCache: { value: number; timestamp: number } | null = null;
  private readonly HEALTH_SCORE_TTL = 30000; // 30秒

  constructor(
    providerManager: AIProviderManager,
    configManager: ConfigManager,
  ) {
    this.providerManager = providerManager;
    this.configManager = configManager;

    // ProviderProbeCacheに必要なプロバイダリストを作成
    const providers = this.createProviderList();
    this.probeCache = new ProviderProbeCache(providers);
  }

  /**
   * 全プロバイダプローブ(軽量プローブ設計)
   */
  async probeAll(options: ProbeOptions = {}): Promise<ProviderHealth[]> {
    const {
      timeoutMs = 400,
      hedgeMs = 120,
      level = "normal",
      skipCache = false,
    } = options;

    try {
      // ProviderProbeCacheを使用した軽量プローブ実行
      return await this.probeCache.probeAll({
        timeoutMs,
        hedgeMs,
        level,
        skipCache,
      });
    } catch (error) {
      console.error("Provider probe failed:", error);

      // フォールバック: 既存のgetProviderHealthを使用
      return this.getFallbackProviderHealth();
    }
  }

  /**
   * 単一プロバイダプローブ
   */
  async probeOne(
    providerId: string,
    options: ProbeOptions = {},
  ): Promise<ProviderHealth> {
    const { timeoutMs = 400 } = options;
    const startTime = Date.now();

    try {
      const provider = this.providerManager.getProvider(providerId);
      if (!provider) {
        return {
          id: providerId,
          ok: false,
          latencyMs: 0,
          status: "failed",
          error: "Provider not found",
        };
      }

      // タイムアウト付きヘルスチェック
      const healthCheck = this.withTimeout(
        this.checkProviderHealth(provider, providerId),
        timeoutMs,
      );

      const isHealthy = await healthCheck;
      const latency = Date.now() - startTime;

      return {
        id: providerId,
        ok: isHealthy,
        latencyMs: latency,
        status: this.determineHealthStatus(isHealthy, latency, timeoutMs),
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      return {
        id: providerId,
        ok: false,
        latencyMs: latency,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 総合ヘルススコア取得
   */
  async getHealthScore(): Promise<number> {
    // キャッシュチェック
    const now = Date.now();
    if (
      this.healthScoreCache &&
      now - this.healthScoreCache.timestamp < this.HEALTH_SCORE_TTL
    ) {
      return this.healthScoreCache.value;
    }

    try {
      const providers = await this.probeAll({ level: "fast", timeoutMs: 200 });
      const score = this.calculateHealthScore(providers);

      // キャッシュ更新
      this.healthScoreCache = { value: score, timestamp: now };

      return score;
    } catch (error) {
      console.error("Health score calculation failed:", error);
      return 0;
    }
  }

  /**
   * 総合プロバイダヘルス取得
   */
  async getOverallHealth(): Promise<OverallProviderHealth> {
    const providers = await this.probeAll({ level: "normal" });

    const healthy = providers.filter((p) => p.status === "healthy").length;
    const degraded = providers.filter((p) => p.status === "degraded").length;
    const failed = providers.filter((p) => p.status === "failed").length;
    const total = providers.length;

    const latencies = providers.filter((p) => p.ok).map((p) => p.latencyMs);
    const averageLatency =
      latencies.length > 0
        ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
        : 0;
    const worstLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    return {
      healthy,
      degraded,
      failed,
      total,
      healthScore: await this.getHealthScore(),
      averageLatency: Math.round(averageLatency),
      worstLatency,
      timestamp: Date.now(),
    };
  }

  /**
   * キャッシュクリア
   */
  clearCache(): void {
    this.probeCache.clear();
    this.healthScoreCache = null;
  }

  /**
   * キャッシュメトリクス取得
   */
  getCacheMetrics(): CacheMetrics {
    return this.probeCache.getCacheMetrics();
  }

  /**
   * ヘルススコア計算(重み付きスコアリング)
   */
  private calculateHealthScore(providers: ProviderHealth[]): number {
    if (providers.length === 0) return 0;

    const weights = this.getProviderWeights();
    let totalWeight = 0;
    let weightedScore = 0;

    for (const provider of providers) {
      const weight = weights[provider.id] || 1.0;
      const providerScore = this.getProviderScore(provider);

      weightedScore += providerScore * weight;
      totalWeight += weight;
    }

    const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    return Math.round(finalScore * 100) / 100;
  }

  /**
   * プロバイダ別重み取得(設定可能)
   */
  private getProviderWeights(): Record<string, number> {
    const defaultWeights = {
      openai: 1.2,
      anthropic: 1.2,
      google: 1.0,
      groq: 0.8,
      grok: 0.8,
      ollama: 0.6,
      lmstudio: 0.6,
      vllm: 0.6,
    };

    try {
      const configWeights = this.configManager.get(
        "system.provider.weights",
        {},
      );
      return { ...defaultWeights, ...configWeights };
    } catch {
      return defaultWeights;
    }
  }

  /**
   * 個別プロバイダスコア算出
   */
  private getProviderScore(provider: ProviderHealth): number {
    if (!provider.ok) return 0;

    // レイテンシベーススコア (0-100)
    const latencyScore = Math.max(0, 100 - provider.latencyMs / 10); // 1秒 = 90点

    // ステータス補正
    const statusMultiplier =
      {
        healthy: 1.0,
        degraded: 0.7,
        failed: 0.0,
      }[provider.status] || 0.5;

    return latencyScore * statusMultiplier;
  }

  /**
   * ヘルスステータス判定
   */
  private determineHealthStatus(
    ok: boolean,
    latencyMs: number,
    timeoutMs: number,
  ): "healthy" | "degraded" | "failed" {
    if (!ok) return "failed";
    if (latencyMs > timeoutMs * 0.8) return "degraded";
    return "healthy";
  }

  /**
   * 既存のプロバイダからプローブキャッシュ用リストを作成
   */
  private createProviderList(): AIProviderForCache[] {
    const providerNames = [
      "openai",
      "anthropic",
      "google",
      "groq",
      "grok",
      "ollama",
      "lmstudio",
      "vllm",
    ];

    return providerNames.map((name) => ({
      id: name,
      ping: async (options: { timeout: number }) => {
        const provider = this.providerManager.getProvider(name);
        if (!provider) {
          throw new Error(`Provider ${name} not found`);
        }

        const isHealthy = await this.checkProviderHealth(provider, name);
        return { ok: isHealthy };
      },
    }));
  }

  /**
   * プロバイダヘルスチェック実装
   */
  private async checkProviderHealth(
    provider: any,
    providerId: string,
  ): Promise<boolean> {
    try {
      // validateConnection メソッドがある場合はそれを使用
      if (typeof provider.validateConnection === "function") {
        return await provider.validateConnection();
      }

      // isAvailable メソッドがある場合はそれを使用
      if (typeof provider.isAvailable === "function") {
        return await provider.isAvailable();
      }

      // getModels を呼び出してヘルスチェック
      if (typeof provider.getModels === "function") {
        const models = await provider.getModels();
        return Array.isArray(models) && models.length > 0;
      }

      // フォールバック: プロバイダが存在することを健康とみなす
      return true;
    } catch (error) {
      console.debug(`Provider ${providerId} health check failed:`, error);
      return false;
    }
  }

  /**
   * フォールバックプロバイダヘルス取得
   */
  private async getFallbackProviderHealth(): Promise<ProviderHealth[]> {
    try {
      const healthMap = await this.providerManager.getProviderHealth();

      return Object.entries(healthMap).map(([id, ok]) => ({
        id,
        ok,
        latencyMs: 0,
        status: ok ? "healthy" : ("failed" as const),
        ...(ok ? {} : { error: "Provider unavailable" }),
      }));
    } catch (error) {
      console.error("Fallback provider health failed:", error);

      // 最終フォールバック: 空のリスト
      return [];
    }
  }

  /**
   * タイムアウト付きPromise実行
   */
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
 * ProviderProbeCacheで使用するAIProvider interface
 */
interface AIProviderForCache {
  id: string;
  ping(options: { timeout: number }): Promise<{ ok: boolean }>;
}
