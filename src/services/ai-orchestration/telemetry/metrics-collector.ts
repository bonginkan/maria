/**
 * Unified Metrics Collector
 *
 * 統一されたメトリクス収集とA/Bテスト評価
 * シャドー評価結果の記録と比較分析
 */

import { TelemetryEvent, ModelComparison, PerformanceStats } from "../ports";

/**
 * メトリクス定義(統一スキーマ)
 */
export interface UnifiedMetric {
  // 基本情報
  timestamp: number;
  requestId?: string;
  tenantId?: string;

  // オーケストレーション情報
  orchestration: {
    intent: string; // task種別
    size: string;
    language?: string;
    quality?: string;
    urgency?: string;
  };

  // ルーター情報
  router: {
    version: "v1" | "v2" | "shadow";
    rule?: string; // マッチしたルール名
    model: string;
    provider: string;
  };

  // モード情報(v2ルーター用)
  mode?: {
    name: string;
    reasoning?: { effort: string };
    text?: { verbosity: string };
  };

  // パフォーマンスメトリクス
  performance: {
    latencyMs: number; // 総処理時間
    routingMs?: number; // ルーティング時間
    optimizationMs?: number; // 最適化時間
    executionMs?: number; // 実行時間
  };

  // トークン使用量
  tokens: {
    in: number;
    out: number;
  };

  // コスト推定
  cost: {
    estimate: number; // USD
    model: string;
  };

  // エラー・リトライ情報
  reliability: {
    success: boolean;
    fallbackCount: number;
    retryCount: number;
    circuitState?: string;
    error?: string;
  };

  // A/Bテスト情報
  abTest?: {
    variant: "control" | "treatment";
    shadowResult?: {
      model: string;
      latencyMs: number;
      tokensOut?: number;
      matched: boolean;
    };
  };
}

/**
 * メトリクス収集器
 */
export class MetricsCollector {
  private metrics: UnifiedMetric[] = [];
  private shadowComparisons: ModelComparison[] = [];
  private readonly maxMetrics = 10000; // メモリ制限

  /**
   * メトリクスの記録
   */
  record(metric: UnifiedMetric): void {
    this.metrics.push(metric);

    // メモリ制限
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // A/Bテスト比較の記録
    if (metric.abTest?.shadowResult) {
      this.recordShadowComparison(metric);
    }
  }

  /**
   * テレメトリイベントからメトリクス生成
   */
  fromTelemetryEvent(
    event: TelemetryEvent,
    context: Partial<UnifiedMetric> = {},
  ): UnifiedMetric {
    return {
      timestamp: event.at,
      requestId: context.requestId,
      tenantId: context.tenantId,

      orchestration: {
        intent:
          event.request?.task || context.orchestration?.intent || "unknown",
        size: event.request?.size || context.orchestration?.size || "unknown",
        language: event.request?.language || context.orchestration?.language,
        quality: event.request?.quality || context.orchestration?.quality,
        urgency: event.request?.urgency || context.orchestration?.urgency,
      },

      router: {
        version: this.detectRouterVersion(event),
        rule: event.decision?.ruleName,
        model: event.decision?.model || context.router?.model || "unknown",
        provider:
          event.decision?.providerName || context.router?.provider || "unknown",
      },

      mode: context.mode,

      performance: {
        latencyMs: event.durationMs || 0,
        routingMs:
          event.name === "router.decision" ? event.durationMs : undefined,
        optimizationMs:
          event.name === "context.optimize.success"
            ? event.durationMs
            : undefined,
        executionMs:
          event.name === "provider.execute" ? event.durationMs : undefined,
      },

      tokens: {
        in: event.metrics?.tokensIn || context.tokens?.in || 0,
        out: event.metrics?.tokensOut || context.tokens?.out || 0,
      },

      cost: {
        estimate: event.metrics?.cost || context.cost?.estimate || 0,
        model: event.decision?.model || context.cost?.model || "unknown",
      },

      reliability: {
        success: event.name.includes("success"),
        fallbackCount: event.metrics?.fallbackCount || 0,
        retryCount: (event.tags?.retryCount as number) || 0,
        circuitState: event.metrics?.circuitState,
        error: event.tags?.error as string,
      },

      abTest: context.abTest,
    };
  }

  /**
   * ルーターバージョンの検出
   */
  private detectRouterVersion(event: TelemetryEvent): "v1" | "v2" | "shadow" {
    if (event.name.includes("shadow")) return "shadow";
    if (event.decision?.providerName === "openai_responses") return "v2";
    return "v1";
  }

  /**
   * シャドー比較の記録
   */
  private recordShadowComparison(metric: UnifiedMetric): void {
    if (!metric.abTest?.shadowResult) return;

    const comparison: ModelComparison = {
      primary: {
        model: metric.router.model,
        latencyMs: metric.performance.latencyMs,
        tokensOut: metric.tokens.out,
        cost: metric.cost.estimate,
      },
      shadow: {
        model: metric.abTest.shadowResult.model,
        latencyMs: metric.abTest.shadowResult.latencyMs,
        tokensOut: metric.abTest.shadowResult.tokensOut || 0,
        cost: 0, // シャドーのコストは実際には発生しない
      },
      outputMatch: metric.abTest.shadowResult.matched ? 1 : 0,
      latencyDiff:
        metric.abTest.shadowResult.latencyMs - metric.performance.latencyMs,
      costDiff: 0,
    };

    this.shadowComparisons.push(comparison);

    // メモリ制限
    if (this.shadowComparisons.length > 1000) {
      this.shadowComparisons = this.shadowComparisons.slice(-1000);
    }
  }

  /**
   * 統計分析
   */
  getStatistics(filter?: {
    startTime?: number;
    endTime?: number;
    routerVersion?: "v1" | "v2" | "shadow";
    task?: string;
    model?: string;
  }): {
    summary: {
      totalRequests: number;
      successRate: number;
      avgLatencyMs: number;
      p95LatencyMs: number;
      p99LatencyMs: number;
      totalCost: number;
      avgTokensIn: number;
      avgTokensOut: number;
    };
    byRouter: Record<string, PerformanceStats>;
    byModel: Record<string, PerformanceStats>;
    byTask: Record<string, PerformanceStats>;
    fallbackAnalysis: {
      totalFallbacks: number;
      fallbackRate: number;
      avgFallbacksPerRequest: number;
      modelFallbackCounts: Record<string, number>;
    };
    circuitBreaker: {
      trips: number;
      openRate: number;
      modelTrips: Record<string, number>;
    };
    abTest?: {
      shadowExecutions: number;
      shadowMatchRate: number;
      avgLatencyDiff: number;
      modelComparisons: ModelComparison[];
    };
  } {
    // フィルタリング
    let filteredMetrics = this.metrics;
    if (filter) {
      filteredMetrics = this.metrics.filter((m) => {
        if (filter.startTime && m.timestamp < filter.startTime) return false;
        if (filter.endTime && m.timestamp > filter.endTime) return false;
        if (filter.routerVersion && m.router.version !== filter.routerVersion)
          return false;
        if (filter.task && m.orchestration.intent !== filter.task) return false;
        if (filter.model && m.router.model !== filter.model) return false;
        return true;
      });
    }

    if (filteredMetrics.length === 0) {
      return this.emptyStatistics();
    }

    // 基本統計
    const totalRequests = filteredMetrics.length;
    const successfulRequests = filteredMetrics.filter(
      (m) => m.reliability.success,
    ).length;
    const successRate = (successfulRequests / totalRequests) * 100;

    const latencies = filteredMetrics
      .map((m) => m.performance.latencyMs)
      .sort((a, b) => a - b);
    const avgLatencyMs =
      latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99LatencyMs = latencies[Math.floor(latencies.length * 0.99)] || 0;

    const totalCost = filteredMetrics.reduce(
      (sum, m) => sum + m.cost.estimate,
      0,
    );
    const avgTokensIn =
      filteredMetrics.reduce((sum, m) => sum + m.tokens.in, 0) / totalRequests;
    const avgTokensOut =
      filteredMetrics.reduce((sum, m) => sum + m.tokens.out, 0) / totalRequests;

    // ルーター別統計
    const byRouter = this.groupByStats(
      filteredMetrics,
      (m) => m.router.version,
    );

    // モデル別統計
    const byModel = this.groupByStats(filteredMetrics, (m) => m.router.model);

    // タスク別統計
    const byTask = this.groupByStats(
      filteredMetrics,
      (m) => m.orchestration.intent,
    );

    // フォールバック分析
    const totalFallbacks = filteredMetrics.reduce(
      (sum, m) => sum + m.reliability.fallbackCount,
      0,
    );
    const fallbackRate =
      (filteredMetrics.filter((m) => m.reliability.fallbackCount > 0).length /
        totalRequests) *
      100;
    const avgFallbacksPerRequest = totalFallbacks / totalRequests;
    const modelFallbackCounts = this.countByField(
      filteredMetrics.filter((m) => m.reliability.fallbackCount > 0),
      (m) => m.router.model,
    );

    // サーキットブレーカー分析
    const trippedMetrics = filteredMetrics.filter(
      (m) => m.reliability.circuitState === "open",
    );
    const trips = trippedMetrics.length;
    const openRate = (trips / totalRequests) * 100;
    const modelTrips = this.countByField(trippedMetrics, (m) => m.router.model);

    // A/Bテスト分析(シャドー評価がある場合)
    const shadowMetrics = filteredMetrics.filter((m) => m.abTest?.shadowResult);
    let abTest;
    if (shadowMetrics.length > 0) {
      const shadowExecutions = shadowMetrics.length;
      const shadowMatches = shadowMetrics.filter(
        (m) => m.abTest!.shadowResult!.matched,
      ).length;
      const shadowMatchRate = (shadowMatches / shadowExecutions) * 100;
      const avgLatencyDiff =
        shadowMetrics.reduce(
          (sum, m) =>
            sum + (m.abTest!.shadowResult!.latencyMs - m.performance.latencyMs),
          0,
        ) / shadowExecutions;

      abTest = {
        shadowExecutions,
        shadowMatchRate,
        avgLatencyDiff,
        modelComparisons: this.shadowComparisons.slice(-10), // 最新10件
      };
    }

    return {
      summary: {
        totalRequests,
        successRate: Math.round(successRate * 100) / 100,
        avgLatencyMs: Math.round(avgLatencyMs),
        p95LatencyMs: Math.round(p95LatencyMs),
        p99LatencyMs: Math.round(p99LatencyMs),
        totalCost: Math.round(totalCost * 10000) / 10000,
        avgTokensIn: Math.round(avgTokensIn),
        avgTokensOut: Math.round(avgTokensOut),
      },
      byRouter,
      byModel,
      byTask,
      fallbackAnalysis: {
        totalFallbacks,
        fallbackRate: Math.round(fallbackRate * 100) / 100,
        avgFallbacksPerRequest: Math.round(avgFallbacksPerRequest * 100) / 100,
        modelFallbackCounts,
      },
      circuitBreaker: {
        trips,
        openRate: Math.round(openRate * 100) / 100,
        modelTrips,
      },
      abTest,
    };
  }

  /**
   * グループ別統計
   */
  private groupByStats(
    metrics: UnifiedMetric[],
    keyFn: (m: UnifiedMetric) => string,
  ): Record<string, PerformanceStats> {
    const groups = new Map<string, UnifiedMetric[]>();

    for (const metric of metrics) {
      const key = keyFn(metric);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(metric);
    }

    const stats: Record<string, PerformanceStats> = {};

    for (const [key, groupMetrics] of groups) {
      const latencies = groupMetrics
        .map((m) => m.performance.latencyMs)
        .sort((a, b) => a - b);
      stats[key] = {
        avg: Math.round(
          latencies.reduce((a, b) => a + b, 0) / latencies.length,
        ),
        p95: Math.round(latencies[Math.floor(latencies.length * 0.95)] || 0),
        p99: Math.round(latencies[Math.floor(latencies.length * 0.99)] || 0),
        min: Math.round(Math.min(...latencies)),
        max: Math.round(Math.max(...latencies)),
        count: groupMetrics.length,
      };
    }

    return stats;
  }

  /**
   * フィールド別カウント
   */
  private countByField(
    metrics: UnifiedMetric[],
    fieldFn: (m: UnifiedMetric) => string,
  ): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const metric of metrics) {
      const key = fieldFn(metric);
      counts[key] = (counts[key] || 0) + 1;
    }

    return counts;
  }

  /**
   * 空の統計オブジェクト
   */
  private emptyStatistics() {
    return {
      summary: {
        totalRequests: 0,
        successRate: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        totalCost: 0,
        avgTokensIn: 0,
        avgTokensOut: 0,
      },
      byRouter: Record<string, any>,
      byModel: Record<string, any>,
      byTask: Record<string, any>,
      fallbackAnalysis: {
        totalFallbacks: 0,
        fallbackRate: 0,
        avgFallbacksPerRequest: 0,
        modelFallbackCounts: Record<string, any>,
      },
      circuitBreaker: {
        trips: 0,
        openRate: 0,
        modelTrips: Record<string, any>,
      },
    };
  }

  /**
   * メトリクスのエクスポート(CSV形式)
   */
  exportToCSV(): string {
    const headers = [
      "timestamp",
      "requestId",
      "task",
      "size",
      "routerVersion",
      "model",
      "provider",
      "latencyMs",
      "tokensIn",
      "tokensOut",
      "cost",
      "success",
      "fallbackCount",
      "circuitState",
    ];

    const rows = this.metrics.map((m) => [
      new Date(m.timestamp).toISOString(),
      m.requestId || "",
      m.orchestration.intent,
      m.orchestration.size,
      m.router.version,
      m.router.model,
      m.router.provider,
      m.performance.latencyMs,
      m.tokens.in,
      m.tokens.out,
      m.cost.estimate,
      m.reliability.success,
      m.reliability.fallbackCount,
      m.reliability.circuitState || "",
    ]);

    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  }

  /**
   * メトリクスクリア
   */
  clear(): void {
    this.metrics = [];
    this.shadowComparisons = [];
  }
}

// シングルトンインスタンス
let metricsCollectorInstance: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollectorInstance) {
    metricsCollectorInstance = new MetricsCollector();
  }
  return metricsCollectorInstance;
}

/**
 * 統一メトリクス記録用ヘルパー関数
 */
export function recordMetric(
  event: TelemetryEvent,
  additionalContext?: Partial<UnifiedMetric>,
): void {
  const collector = getMetricsCollector();
  const metric = collector.fromTelemetryEvent(event, additionalContext);
  collector.record(metric);
}
