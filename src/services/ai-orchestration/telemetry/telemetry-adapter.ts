/**
 * Telemetry Adapter
 *
 * メトリクスコレクターと統合されたテレメトリ実装
 * パイプラインからのイベントを統一メトリクスに変換
 */

import { OrchestrationTelemetry, TelemetryEvent } from "../ports";
import {
  getMetricsCollector,
  recordMetric,
  UnifiedMetric,
} from "./metrics-collector";
import chalk from "chalk";

/**
 * メトリクス収集統合テレメトリ
 */
export class MetricsIntegratedTelemetry implements OrchestrationTelemetry {
  private collector = getMetricsCollector();
  private requestContextMap = new Map<string, Partial<UnifiedMetric>>();
  private debug: boolean;

  constructor(options?: { debug?: boolean; logToConsole?: boolean }) {
    this.debug = options?.debug || process.env.DEBUG === "true";
  }

  /**
   * テレメトリイベントの処理
   */
  emit(event: TelemetryEvent): void {
    try {
      // デバッグログ
      if (this.debug) {
        this.logEvent(event);
      }

      // リクエストIDの抽出
      const requestId =
        event.request?.context?.meta?.requestId ||
        (event.tags?.requestId as string) ||
        `anonymous-${Date.now()}`;

      // イベントタイプによる処理
      switch (event.name) {
        case "orchestration.start":
          this.handleOrchestrationStart(event, requestId);
          break;

        case "context.optimize.success":
        case "context.optimize.error":
          this.handleOptimizationEvent(event, requestId);
          break;

        case "router.decision":
          this.handleRouterDecision(event, requestId);
          break;

        case "shadow.evaluation":
          this.handleShadowEvaluation(event, requestId);
          break;

        case "fallback.success":
          this.handleFallback(event, requestId);
          break;

        case "orchestration.success":
        case "orchestration.fail":
          this.handleOrchestrationComplete(event, requestId);
          break;

        default:
          // その他のイベントも記録
          this.updateRequestContext(requestId, event);
      }

      // メトリクス記録
      const context = this.requestContextMap.get(requestId);
      if (context) {
        recordMetric(event, context);
      }
    } catch (error) {
      console.error(chalk.red("Telemetry error:"), error);
    }
  }

  /**
   * バッチフラッシュ(将来の拡張用)
   */
  async flush(): Promise<void> {
    // 現在は即座に記録しているため何もしない
    // 将来的にバッチ送信を実装する場合はここで処理
  }

  /**
   * オーケストレーション開始イベント処理
   */
  private handleOrchestrationStart(
    event: TelemetryEvent,
    requestId: string,
  ): void {
    const context: Partial<UnifiedMetric> = {
      requestId,
      tenantId: event.request?.context?.meta?.tenantId,
      orchestration: {
        intent: event.request?.task || "unknown",
        size: event.request?.size || "unknown",
        language: event.request?.language,
        quality: event.request?.quality,
        urgency: event.request?.urgency,
      },
      router: {
        version: "v1", // デフォルト、後で更新される
        model: "pending",
        provider: "pending",
      },
      tokens: {
        in: 0,
        out: 0,
      },
      cost: {
        estimate: 0,
        model: "unknown",
      },
      reliability: {
        success: false,
        fallbackCount: 0,
        retryCount: 0,
      },
    };

    this.requestContextMap.set(requestId, context);
  }

  /**
   * 最適化イベント処理
   */
  private handleOptimizationEvent(
    event: TelemetryEvent,
    requestId: string,
  ): void {
    const context = this.requestContextMap.get(requestId) || object;

    if (!context.performance) {
      context.performance = {
        latencyMs: 0,
      };
    }

    context.performance.optimizationMs = event.durationMs;

    // 最適化によるメッセージ数の変化を記録
    if (event.tags?.originalMessages && event.tags?.optimizedMessages) {
      const _reduction =
        1 -
        (event.tags.optimizedMessages as number) /
          (event.tags.originalMessages as number);
      context.tokens = {
        ...context.tokens,
        in: Math.ceil((event.tags.optimizedMessages as number) * 100), // 推定
      };
    }

    this.requestContextMap.set(requestId, context);
  }

  /**
   * ルーター決定イベント処理
   */
  private handleRouterDecision(event: TelemetryEvent, requestId: string): void {
    const context = this.requestContextMap.get(requestId) || object;

    // ルーター情報の更新
    context.router = {
      version: this.detectRouterVersion(event),
      model: event.decision?.model || "unknown",
      provider: event.decision?.providerName || "unknown",
      rule: event.decision?.ruleName,
    };

    // パフォーマンス情報
    if (!context.performance) {
      context.performance = {
        latencyMs: 0,
      };
    }
    context.performance.routingMs = event.durationMs;

    // コスト推定(パラメータから取得)
    if (event.decision?.params?.estimatedCost) {
      context.cost = {
        estimate: event.decision.params.estimatedCost as number,
        model: event.decision.model || "unknown",
      };
    }

    this.requestContextMap.set(requestId, context);
  }

  /**
   * シャドー評価イベント処理
   */
  private handleShadowEvaluation(
    event: TelemetryEvent,
    requestId: string,
  ): void {
    const context = this.requestContextMap.get(requestId) || object;

    // A/Bテスト情報の追加
    context.abTest = {
      variant: "treatment", // シャドー実行されたものはtreatment
      shadowResult: {
        model: (event.tags?.shadowModel as string) || "unknown",
        latencyMs: event.durationMs || 0,
        tokensOut: event.tags?.shadowTokensOut as number,
        matched: (event.tags?.matched as boolean) || false,
      },
    };

    this.requestContextMap.set(requestId, context);
  }

  /**
   * フォールバックイベント処理
   */
  private handleFallback(event: TelemetryEvent, requestId: string): void {
    const context = this.requestContextMap.get(requestId) || object;

    if (!context.reliability) {
      context.reliability = {
        success: false,
        fallbackCount: 0,
        retryCount: 0,
      };
    }

    context.reliability.fallbackCount =
      (event.tags?.attemptNumber as number) || 1;

    // フォールバック後のモデル情報を更新
    if (event.tags?.model) {
      context.router = {
        ...context.router,
        model: event.tags.model as string,
        provider:
          (event.tags.provider as string) ||
          context.router?.provider ||
          "unknown",
      };
    }

    this.requestContextMap.set(requestId, context);
  }

  /**
   * オーケストレーション完了イベント処理
   */
  private handleOrchestrationComplete(
    event: TelemetryEvent,
    requestId: string,
  ): void {
    const context = this.requestContextMap.get(requestId) || object;

    // 最終的な成功/失敗状態
    context.reliability = {
      ...context.reliability,
      success: event.name === "orchestration.success",
      error: event.tags?.error as string,
    };

    // パフォーマンス情報
    if (!context.performance) {
      context.performance = {
        latencyMs: 0,
      };
    }
    context.performance.latencyMs = event.durationMs || 0;

    // トークン情報
    if (event.metrics) {
      context.tokens = {
        in: event.metrics.tokensIn || context.tokens?.in || 0,
        out: event.metrics.tokensOut || 0,
      };

      if (event.metrics.cost) {
        context.cost = {
          estimate: event.metrics.cost,
          model: context.router?.model || "unknown",
        };
      }

      if (event.metrics.fallbackCount) {
        context.reliability.fallbackCount = event.metrics.fallbackCount;
      }
    }

    // 最終メトリクスを記録
    this.requestContextMap.set(requestId, context);

    // 完了後はコンテキストをクリーンアップ(メモリリーク防止)
    setTimeout(() => {
      this.requestContextMap.delete(requestId);
    }, 60000); // 1分後に削除
  }

  /**
   * 汎用的なコンテキスト更新
   */
  private updateRequestContext(requestId: string, event: TelemetryEvent): void {
    const context = this.requestContextMap.get(requestId) || object;

    // イベントから有用な情報を抽出して更新
    if (event.metrics) {
      context.tokens = {
        in: event.metrics.tokensIn || context.tokens?.in || 0,
        out: event.metrics.tokensOut || context.tokens?.out || 0,
      };

      if (event.metrics.circuitState) {
        if (!context.reliability) {
          context.reliability = {
            success: false,
            fallbackCount: 0,
            retryCount: 0,
          };
        }
        context.reliability.circuitState = event.metrics.circuitState;
      }
    }

    this.requestContextMap.set(requestId, context);
  }

  /**
   * ルーターバージョンの検出
   */
  private detectRouterVersion(event: TelemetryEvent): "v1" | "v2" | "shadow" {
    if (event.name.includes("shadow")) return "shadow";
    if (event.decision?.providerName === "openai_responses") return "v2";
    if (event.decision?.ruleName?.includes("decision-table")) return "v1";
    return "v1";
  }

  /**
   * デバッグログ出力
   */
  private logEvent(event: TelemetryEvent): void {
    const timestamp = new Date(event.at).toISOString();
    const duration = event.durationMs ? `${event.durationMs}ms` : "";

    let color = chalk.gray;
    if (event.name.includes("success")) color = chalk.green;
    if (event.name.includes("error") || event.name.includes("fail"))
      color = chalk.red;
    if (event.name.includes("shadow")) color = chalk.blue;
    if (event.name.includes("fallback")) color = chalk.yellow;

    console.log(
      color(
        `[${timestamp}] ${event.name} ${duration}`,
        event.tags ? JSON.stringify(event.tags) : "",
      ),
    );
  }

  /**
   * 統計情報の取得
   */
  getStatistics(filter?: any) {
    return this.collector.getStatistics(filter);
  }

  /**
   * CSV形式でエクスポート
   */
  exportToCSV(): string {
    return this.collector.exportToCSV();
  }

  /**
   * メトリクスのクリア
   */
  clear(): void {
    this.collector.clear();
    this.requestContextMap.clear();
  }
}

/**
 * ファクトリ関数
 */
export function createMetricsIntegratedTelemetry(options?: {
  debug?: boolean;
  logToConsole?: boolean;
}): OrchestrationTelemetry {
  return new MetricsIntegratedTelemetry(options);
}
