/**
 * Orchestration Pipeline
 *
 * 4つのサービス(Router, Optimizer, Guard, Telemetry)を統合し、
 * 単一のエントリーポイントを提供する中核実装
 */

import {
  IModelRouter,
  IContextOptimizer,
  IRequestGuard,
  OrchestrationTelemetry,
  OrchestrateRequest,
  OrchestrationResult,
  OrchestrationPipelineDeps,
  RouteDecision,
  TelemetryEvent,
  AllFallbacksFailedError,
  OrchestrationError,
} from "./ports";
import chalk from "chalk";

/**
 * パフォーマンス計測ユーティリティ
 */
const now = () => performance.now?.() ?? Date.now();
const elapsed = (startTime: number) =>
  Math.round((now() - startTime) * 100) / 100;

/**
 * リクエストのPII除去(テレメトリ用)
 */
function scrubRequest(req: OrchestrateRequest): Partial<OrchestrateRequest> {
  return {
    task: req.task,
    size: req.size,
    needsVision: req.needsVision,
    needsStreaming: req.needsStreaming,
    language: req.language,
    quality: req.quality,
    urgency: req.urgency,
    mode: req.mode,
    // context.messagesは含めない(PII保護)
  };
}

/**
 * トークン数推定(サイズベース)
 */
function estimateTokenBudget(size: OrchestrateRequest["size"]): number {
  switch (size) {
    case "small":
      return 2000; // ~8KB
    case "medium":
      return 8000; // ~32KB
    case "large":
      return 24000; // ~96KB
    default:
      return 8000;
  }
}

/**
 * Orchestration Pipeline
 * 統合実行パイプライン
 */
export class OrchestrationPipeline {
  private router: IModelRouter;
  private optimizer: IContextOptimizer;
  private guard: IRequestGuard;
  private telemetry?: OrchestrationTelemetry;
  private shadowRouter?: IModelRouter;
  private shadowRate: number;

  // メトリクス収集
  private requestCount = 0;
  private successCount = 0;
  private fallbackCount = 0;
  private optimizationCount = 0;
  private shadowMatchCount = 0;

  constructor(deps: OrchestrationPipelineDeps) {
    this.router = deps.router;
    this.optimizer = deps.optimizer;
    this.guard = deps.guard;
    this.telemetry = deps.telemetry;
    this.shadowRouter = deps.shadowRouter;
    this.shadowRate = deps.shadowRate ?? 0.1; // デフォルト10%シャドー
  }

  /**
   * メインエントリーポイント
   * 最適化 → ルーティング → ガード付き実行 → フォールバック
   */
  async handle(req: OrchestrateRequest): Promise<OrchestrationResult> {
    const startTime = now();
    this.requestCount++;

    // テレメトリ:開始イベント
    this.emitTelemetry({
      name: "orchestration.start",
      at: startTime,
      request: scrubRequest(req),
      tags: { requestId: req.context.meta?.requestId },
    });

    try {
      // ========================================
      // Step 1: コンテキスト最適化
      // ========================================
      const optimizedContext = await this.optimizeContext(req, startTime);

      // ========================================
      // Step 2: モデルルーティング
      // ========================================
      const decision = await this.routeRequest(
        { ...req, context: optimizedContext },
        startTime,
      );

      // ========================================
      // Step 3: シャドー評価(非同期実行)
      // ========================================
      if (this.shadowRouter && this.shouldRunShadow()) {
        this.runShadowEvaluation(
          req,
          optimizedContext,
          decision,
          startTime,
        ).catch((err) => {
          console.warn("Shadow evaluation failed:", err);
          // シャドー失敗は無視(メイン処理には影響しない)
        });
      }

      // ========================================
      // Step 4: ガード付き実行(フォールバック含む)
      // ========================================
      const result = await this.executeWithFallbacks(
        decision,
        optimizedContext,
        startTime,
      );

      // 成功メトリクス
      this.successCount++;
      const totalTime = elapsed(startTime);

      // テレメトリ:成功イベント
      this.emitTelemetry({
        name: "orchestration.success",
        at: now(),
        request: scrubRequest(req),
        decision: {
          providerName: result.meta?.provider,
          model: result.meta?.model,
        },
        durationMs: totalTime,
        metrics: {
          tokensIn: result.meta?.tokensIn,
          tokensOut: result.meta?.tokensOut,
          fallbackCount: result.meta?.fallbackCount || 0,
          cost: result.meta?.cost,
        },
      });

      console.log(
        chalk.green(
          `✅ Orchestration completed in ${totalTime}ms`,
          `[${result.meta?.provider}:${result.meta?.model}]`,
        ),
      );

      return result;
    } catch (error) {
      const totalTime = elapsed(startTime);

      // テレメトリ:失敗イベント
      this.emitTelemetry({
        name: "orchestration.fail",
        at: now(),
        request: scrubRequest(req),
        durationMs: totalTime,
        tags: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      console.error(
        chalk.red(`❌ Orchestration failed after ${totalTime}ms:`, error),
      );

      throw error;
    }
  }

  /**
   * Step 1: コンテキスト最適化
   */
  private async optimizeContext(
    req: OrchestrateRequest,
    _startTime: number,
  ): Promise<OrchestrateRequest["context"]> {
    const optimizeStart = now();

    try {
      // トークンバジェットの決定
      const budgetTokens = estimateTokenBudget(req.size);

      console.debug(
        chalk.gray(
          `🔧 Optimizing context for ${req.size} (budget: ${budgetTokens} tokens)`,
        ),
      );

      const optimized = await this.optimizer.optimize(req.context, {
        budgetTokens,
        compressionLevel: req.urgency === "high" ? "aggressive" : "medium",
        qualityThreshold: req.quality === "critical" ? 0.9 : 0.8,
        preserveStructure: req.task === "code" || req.task === "review",
      });

      this.optimizationCount++;
      const optimizeTime = elapsed(optimizeStart);

      // テレメトリ:最適化成功
      this.emitTelemetry({
        name: "context.optimize.success",
        at: now(),
        durationMs: optimizeTime,
        tags: {
          originalMessages: req.context.messages.length,
          optimizedMessages: optimized.messages.length,
        },
      });

      console.debug(
        chalk.gray(
          `✅ Context optimized in ${optimizeTime}ms`,
          `(${req.context.messages.length} → ${optimized.messages.length} messages)`,
        ),
      );

      return optimized;
    } catch (innerError) {
      const optimizeTime = elapsed(optimizeStart);

      // テレメトリ:最適化失敗(原文使用)
      this.emitTelemetry({
        name: "context.optimize.error",
        at: now(),
        durationMs: optimizeTime,
        tags: {
          error: error instanceof Error ? error.message : "Unknown error",
          fallbackToOriginal: true,
        },
      });

      console.warn(
        chalk.yellow(
          `⚠️ Context optimization failed after ${optimizeTime}ms, using original`,
        ),
      );

      // 失敗時は原文を使用(安全側フォールバック)
      return req.context;
    }
  }

  /**
   * Step 2: モデルルーティング
   */
  private async routeRequest(
    req: OrchestrateRequest,
    _startTime: number,
  ): Promise<RouteDecision> {
    const routeStart = now();

    try {
      const decision = await this.router.route(req);
      const routeTime = elapsed(routeStart);

      // テレメトリ:ルーティング決定
      this.emitTelemetry({
        name: "router.decision",
        at: now(),
        request: scrubRequest(req),
        decision: {
          providerName: decision.providerName,
          model: decision.model,
          ruleName: decision.ruleName,
        },
        durationMs: routeTime,
        tags: {
          fallbackCount: decision.fallbacks?.length || 0,
        },
      });

      console.debug(
        chalk.gray(
          `🎯 Routed to ${decision.providerName}:${decision.model}`,
          `in ${routeTime}ms`,
          decision.fallbacks?.length
            ? `(+${decision.fallbacks.length} fallbacks)`
            : "",
        ),
      );

      return decision;
    } catch (error) {
      const routeTime = elapsed(routeStart);

      this.emitTelemetry({
        name: "router.error",
        at: now(),
        durationMs: routeTime,
        tags: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      throw new OrchestrationError("Routing failed", "ROUTING_FAILED", {
        request: req,
        error,
      });
    }
  }

  /**
   * Step 3: シャドー評価(非同期)
   */
  private async runShadowEvaluation(
    req: OrchestrateRequest,
    optimizedContext: OrchestrateRequest["context"],
    primaryDecision: RouteDecision,
    _startTime: number,
  ): Promise<void> {
    if (!this.shadowRouter) return;

    const shadowStart = now();

    try {
      // シャドールーターで別の決定を取得
      const shadowDecision = await this.shadowRouter.route({
        ...req,
        context: optimizedContext,
      });

      // シャドー実行(結果は破棄)
      const shadowResult = await this.guard.run(
        shadowDecision.circuitKey,
        () =>
          shadowDecision.provider.execute({
            model: shadowDecision.model,
            params: shadowDecision.params,
            context: optimizedContext,
          }),
        { skipRateLimit: true }, // シャドーはレート制限スキップ
      );

      const shadowTime = elapsed(shadowStart);

      // 結果比較
      const matched = primaryDecision.model === shadowDecision.model;
      if (matched) this.shadowMatchCount++;

      // テレメトリ:シャドー評価結果
      this.emitTelemetry({
        name: "shadow.evaluation",
        at: now(),
        durationMs: shadowTime,
        tags: {
          primaryModel: primaryDecision.model,
          shadowModel: shadowDecision.model,
          matched,
          shadowTokensOut: shadowResult.meta?.tokensOut,
        },
      });

      console.debug(
        chalk.gray(
          `👥 Shadow evaluation:`,
          shadowDecision.model,
          `(${shadowTime}ms)`,
          matched ? "✓ matched" : "✗ different",
        ),
      );
    } catch (innerError) {
      // シャドー失敗は静かに記録
      this.emitTelemetry({
        name: "shadow.error",
        at: now(),
        tags: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  /**
   * Step 4: ガード付き実行(フォールバック含む)
   */
  private async executeWithFallbacks(
    decision: RouteDecision,
    optimizedContext: OrchestrateRequest["context"],
    startTime: number,
  ): Promise<OrchestrationResult> {
    const attempts: Array<{
      model: string;
      provider: string;
      success: boolean;
      error?: string;
      latencyMs?: number;
    }> = [];

    // プライマリ試行
    try {
      const execStart = now();
      const result = await this.guard.run(decision.circuitKey, () =>
        decision.provider.execute({
          model: decision.model,
          params: decision.params,
          context: optimizedContext,
        }),
      );

      const execTime = elapsed(execStart);
      attempts.push({
        model: decision.model,
        provider: decision.providerName,
        success: true,
        latencyMs: execTime,
      });

      return {
        output: result.output,
        meta: {
          ...result.meta,
          model: decision.model,
          provider: decision.providerName,
          latencyMs: elapsed(startTime),
          fallbackCount: 0,
        },
      };
    } catch (primaryError) {
      attempts.push({
        model: decision.model,
        provider: decision.providerName,
        success: false,
        error:
          primaryError instanceof Error
            ? primaryError.message
            : "Unknown error",
      });

      console.warn(
        chalk.yellow(
          `⚠️ Primary model failed: ${decision.model}`,
          primaryError instanceof Error ? primaryError.message : "",
        ),
      );
    }

    // フォールバック試行
    if (decision.fallbacks && decision.fallbacks.length > 0) {
      for (const [index, fallback] of decision.fallbacks.entries()) {
        try {
          console.log(
            chalk.blue(
              `🔄 Trying fallback ${index + 1}/${decision.fallbacks.length}:`,
              `${fallback.providerName}:${fallback.model}`,
            ),
          );

          const execStart = now();
          const result = await this.guard.run(fallback.circuitKey, () =>
            fallback.provider.execute({
              model: fallback.model,
              params: fallback.params,
              context: optimizedContext,
            }),
          );

          const execTime = elapsed(execStart);
          attempts.push({
            model: fallback.model,
            provider: fallback.providerName,
            success: true,
            latencyMs: execTime,
          });

          this.fallbackCount++;

          // テレメトリ:フォールバック成功
          this.emitTelemetry({
            name: "fallback.success",
            at: now(),
            tags: {
              attemptNumber: index + 2, // 1-indexed, primary was 1
              model: fallback.model,
              provider: fallback.providerName,
            },
          });

          return {
            output: result.output,
            meta: {
              ...result.meta,
              model: fallback.model,
              provider: fallback.providerName,
              latencyMs: elapsed(startTime),
              fallbackCount: index + 1,
            },
          };
        } catch (fallbackError) {
          attempts.push({
            model: fallback.model,
            provider: fallback.providerName,
            success: false,
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : "Unknown error",
          });

          console.warn(
            chalk.yellow(
              `⚠️ Fallback ${index + 1} failed:`,
              fallback.model,
              fallbackError instanceof Error ? fallbackError.message : "",
            ),
          );

          // 最後のフォールバックでない場合は続行
          if (index < decision.fallbacks.length - 1) {
            continue;
          }
        }
      }
    }

    // 全て失敗
    const failedModels = attempts.map((a) => a.model);
    throw new AllFallbacksFailedError(attempts.length, failedModels, {
      attempts,
    });
  }

  /**
   * シャドー実行判定(確率ベース)
   */
  private shouldRunShadow(): boolean {
    return Math.random() < this.shadowRate;
  }

  /**
   * テレメトリイベント送信
   */
  private emitTelemetry(event: TelemetryEvent): void {
    if (!this.telemetry) return;

    try {
      this.telemetry.emit(event);
    } catch (error) {
      // テレメトリ失敗はログのみ
      console.warn("Telemetry emit failed:", error);
    }
  }

  /**
   * パイプライン統計取得
   */
  getStatistics(): {
    requests: number;
    success: number;
    successRate: number;
    optimizations: number;
    fallbacks: number;
    fallbackRate: number;
    shadowMatches: number;
    shadowMatchRate: number;
  } {
    const successRate =
      this.requestCount > 0 ? (this.successCount / this.requestCount) * 100 : 0;
    const fallbackRate =
      this.successCount > 0
        ? (this.fallbackCount / this.successCount) * 100
        : 0;
    const shadowMatchRate =
      this.shadowRouter && this.requestCount > 0
        ? (this.shadowMatchCount / (this.requestCount * this.shadowRate)) * 100
        : 0;

    return {
      requests: this.requestCount,
      success: this.successCount,
      successRate: Math.round(successRate * 100) / 100,
      optimizations: this.optimizationCount,
      fallbacks: this.fallbackCount,
      fallbackRate: Math.round(fallbackRate * 100) / 100,
      shadowMatches: this.shadowMatchCount,
      shadowMatchRate: Math.round(shadowMatchRate * 100) / 100,
    };
  }

  /**
   * 統計リセット
   */
  resetStatistics(): void {
    this.requestCount = 0;
    this.successCount = 0;
    this.fallbackCount = 0;
    this.optimizationCount = 0;
    this.shadowMatchCount = 0;
  }
}

/**
 * パイプラインビルダー(ファクトリ)
 */
export class OrchestrationPipelineBuilder {
  private deps: Partial<OrchestrationPipelineDeps> = {};

  withRouter(router: IModelRouter): this {
    this.deps.router = router;
    return this;
  }

  withOptimizer(optimizer: IContextOptimizer): this {
    this.deps.optimizer = optimizer;
    return this;
  }

  withGuard(guard: IRequestGuard): this {
    this.deps.guard = guard;
    return this;
  }

  withTelemetry(telemetry: OrchestrationTelemetry): this {
    this.deps.telemetry = telemetry;
    return this;
  }

  withShadowRouter(router: IModelRouter, rate = 0.1): this {
    this.deps.shadowRouter = router;
    this.deps.shadowRate = rate;
    return this;
  }

  build(): OrchestrationPipeline {
    if (!this.deps.router) {
      throw new Error("Router is required for pipeline");
    }
    if (!this.deps.optimizer) {
      throw new Error("Optimizer is required for pipeline");
    }
    if (!this.deps.guard) {
      throw new Error("Guard is required for pipeline");
    }

    return new OrchestrationPipeline(this.deps as OrchestrationPipelineDeps);
  }
}
