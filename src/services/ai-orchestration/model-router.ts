/**
 * Model Router v2 - Responses API Integration
 * ModeServiceと統合し、reasoning.effort / text.verbosity で制御
 * temperatureは使用しない
 */

import { ModeService } from "../internal-mode/services/ModeService";
import type { ModeSpec } from "../internal-mode/config/modes";
import chalk from "chalk";
import { performance } from "node:perf_hooks";

export interface ResponsesContext {
  task: string; // 'ultra', 'deep', 'code', 'review' など
  size: number; // Content size in characters/tokens
  mode?: string; // 明示的なモード指定(optional)
}

export interface ResponsesModelConfig {
  name: string; // 'openai_responses' 固定
  model: string; // GPT-5 mini など
  reasoning: { effort: "minimal" | "medium" | "high" };
  text: { verbosity: "low" | "medium" | "high" };
  max_output_tokens: number;
  allowedTools: ModeSpec["tools"];
  jsonOnly: boolean;
}

export class ModelRouterV2 {
  private performanceMetrics: Map<string, number[]> = new Map();

  /**
   * Responses API用のモデル選択
   * ModeServiceの現在モードに基づいてパラメータを決定
   */
  selectForResponses(ctx: ResponsesContext): ResponsesModelConfig {
    const startTime = performance.now();

    try {
      // 現在のモードを取得(明示的指定があればそれを使用)
      let mode: ModeSpec;
      if (ctx.mode) {
        mode = ModeService.getById(ctx.mode) || ModeService.current();
      } else {
        mode = ModeService.current();
      }

      // GPT-5 mini固定(環境変数でオーバーライド可能)
      const model = process.env.OPENAI_MODEL || "gpt-5-mini-2025-08-07";

      // 出力トークン数の決定
      const maxOutputTokens = this.calculateMaxTokens(mode, ctx);

      const config: ResponsesModelConfig = {
        name: "openai_responses",
        model,
        reasoning: mode.reasoning,
        text: mode.text,
        max_output_tokens: maxOutputTokens,
        allowedTools: mode.tools,
        jsonOnly: !!mode.safety?.jsonOnly,
      };

      const selectionTime = performance.now() - startTime;
      this.recordMetric(`selection_${mode.id}`, selectionTime);

      console.debug(
        chalk.gray(
          `🤖 Selected model for ${mode.id}: ${model} (effort: ${mode.reasoning.effort}, verbosity: ${mode.text.verbosity}, ${selectionTime.toFixed(1)}ms)`,
        ),
      );

      return config;
    } catch (error) {
      console.error(chalk.red("Model selection failed:"), error);
      // フォールバック設定
      return {
        name: "openai_responses",
        model: "gpt-5-mini-2025-08-07",
        reasoning: { effort: "minimal" },
        text: { verbosity: "low" },
        max_output_tokens: 2048,
        allowedTools: { allowed: [], mode: "auto" },
        jsonOnly: false,
      };
    }
  }

  /**
   * 最大出力トークン数を計算
   * モード設定 > 環境変数 > デフォルト値の優先順位
   */
  private calculateMaxTokens(mode: ModeSpec, ctx: ResponsesContext): number {
    // モード固有の設定が最優先
    if (mode.safety?.maxOutputTokens) {
      return mode.safety.maxOutputTokens;
    }

    // タスクに基づく推定
    const taskBasedTokens = this.estimateTokensByTask(ctx.task, ctx.size);

    // 環境変数のデフォルト
    const envDefault = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || 2048;

    // GPT-5 miniの最大値でキャップ
    const maxLimit = 128000;

    return Math.min(maxLimit, Math.max(taskBasedTokens, envDefault));
  }

  /**
   * タスクに基づくトークン数推定
   */
  private estimateTokensByTask(task: string, size: number): number {
    // タスク別の基本トークン数
    const taskTokens: Record<string, number> = {
      ultra: 4096,
      deep: 8192,
      code: 4096,
      review: 4096,
      gen: 2048,
      lint: 1024,
      test: 2048,
    };

    const base = taskTokens[task] || 2048;

    // サイズに基づく調整
    if (size > 32000) {
      return base * 2; // 大きな入力には多めの出力を許可
    } else if (size < 1000) {
      return Math.max(512, base / 2); // 小さな入力には少なめで十分
    }

    return base;
  }

  /**
   * パフォーマンスメトリクスの記録
   */
  private recordMetric(key: string, value: number): void {
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }

    const metrics = this.performanceMetrics.get(key)!;
    metrics.push(value);

    // 最新1000件のみ保持
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  /**
   * パフォーマンス統計の取得
   */
  getPerformanceStats(): Record<
    string,
    { avg: number; p95: number; count: number }
  > {
    const stats: Record<string, { avg: number; p95: number; count: number }> =
      {};

    for (const [key, values] of this.performanceMetrics) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const p95Index = Math.floor(values.length * 0.95);
      const p95 = sorted[p95Index] || sorted[sorted.length - 1];

      stats[key] = {
        avg: Math.round(avg * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        count: values.length,
      };
    }

    return stats;
  }

  /**
   * 特定モードに対する推奨設定を取得(デバッグ用)
   */
  getRecommendedSettings(modeId: string): ResponsesModelConfig | null {
    const mode = ModeService.getById(modeId);
    if (!mode) return null;

    return this.selectForResponses({
      task: modeId,
      size: 1000,
      mode: modeId,
    });
  }

  /**
   * メトリクスのクリア(テスト用)
   */
  clearMetrics(): void {
    this.performanceMetrics.clear();
  }
}

// シングルトンインスタンス
let modelRouterInstance: ModelRouterV2 | null = null;

export function getModelRouterV2(): ModelRouterV2 {
  if (!modelRouterInstance) {
    modelRouterInstance = new ModelRouterV2();
  }
  return modelRouterInstance;
}

export function resetModelRouterV2(): void {
  if (modelRouterInstance) {
    modelRouterInstance.clearMetrics();
    modelRouterInstance = null;
  }
}
