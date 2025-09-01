/**
 * Context Optimizer Adapter
 *
 * 3段階最適化(Cut/Compress/Abstract)を実装したcontext-optimizerを
 * IContextOptimizerインターフェースに適合
 */

import {
  IContextOptimizer,
  OrchestrateContext,
  OptimizationError,
} from "../ports";
import {
  ContextOptimizer,
  OptimizationConfig,
  OptimizedContext,
  getContextOptimizer,
} from "../context-optimizer";

/**
 * Context Optimizer Adapter
 * 既存のContextOptimizerをIContextOptimizerインターフェースに適合
 */
export class ContextOptimizerAdapter implements IContextOptimizer {
  private optimizer: ContextOptimizer;

  // デフォルト設定(安全側)
  private defaultConfig: Partial<OptimizationConfig> = {
    preserveStructure: true, // 構造を保持
    qualityThreshold: 0.8, // 品質しきい値80%
    compressionLevel: "medium", // 中程度の圧縮
  };

  constructor(optimizer?: ContextOptimizer) {
    this.optimizer = optimizer || getContextOptimizer();
  }

  /**
   * コンテキストを文字列に変換(最適化対象)
   */
  private contextToString(ctx: OrchestrateContext): string {
    return ctx.messages
      .map((msg) => `${msg.role.toUpperCase()}:\n${msg.content}`)
      .join("\n\n---\n\n");
  }

  /**
   * 最適化された文字列をコンテキストに再構築
   */
  private stringToContext(
    optimized: string,
    originalCtx: OrchestrateContext,
  ): OrchestrateContext {
    // 最適化後も基本的なメッセージ構造を維持
    // ただし、内容は圧縮・要約されている可能性がある

    // セパレータで分割を試みる
    const sections = optimized.split(/\n+---\n+/);

    if (sections.length === 1) {
      // 分割できない場合は、全体を要約されたシステムメッセージとして扱う
      return {
        messages: [
          {
            role: "system",
            content: `[Context optimized from ${originalCtx.messages.length} messages]\n\n${optimized}`,
          },
        ],
        meta: originalCtx.meta,
      };
    }

    // 各セクションをメッセージとして再構築
    const messages = sections
      .map((section) => {
        const lines = section.trim().split("\n");
        const firstLine = lines[0].toLowerCase();

        let role: OrchestrateContext["messages"][0]["role"] = "user";
        let content = section;

        if (firstLine.startsWith("system:")) {
          role = "system";
          content = lines.slice(1).join("\n").trim();
        } else if (firstLine.startsWith("assistant:")) {
          role = "assistant";
          content = lines.slice(1).join("\n").trim();
        } else if (firstLine.startsWith("user:")) {
          role = "user";
          content = lines.slice(1).join("\n").trim();
        }

        return { role, content };
      })
      .filter((msg) => msg.content.length > 0);

    // メッセージが空の場合は元のコンテキストを返す(安全側)
    if (messages.length === 0) {
      console.warn(
        "Context optimization resulted in empty messages, returning original",
      );
      return originalCtx;
    }

    return {
      messages,
      meta: originalCtx.meta,
    };
  }

  /**
   * 圧縮レベルの決定
   */
  private determineCompressionLevel(
    originalSize: number,
    targetSize: number,
  ): OptimizationConfig["compressionLevel"] {
    const ratio = targetSize / originalSize;

    if (ratio >= 0.7) {
      return "light"; // 30%以下の削減なら軽い圧縮
    } else if (ratio >= 0.4) {
      return "medium"; // 60%以下の削減なら中程度
    } else {
      return "aggressive"; // それ以上なら積極的圧縮
    }
  }

  /**
   * コンテキスト最適化の実行
   */
  async optimize(
    ctx: OrchestrateContext,
    opts?: {
      budgetTokens?: number;
      compressionLevel?: "light" | "medium" | "aggressive";
      qualityThreshold?: number;
      preserveStructure?: boolean;
    },
  ): Promise<OrchestrateContext> {
    try {
      // コンテキストを文字列に変換
      const contextString = this.contextToString(ctx);
      const originalSize = contextString.length;

      // 目標トークン数(デフォルト: 8000トークン = 約32000文字)
      const budgetTokens = opts?.budgetTokens || 8000;
      const targetSize = budgetTokens * 4; // 概算: 1トークン≒4文字

      // 最適化が不要な場合は元のコンテキストを返す
      if (originalSize <= targetSize) {
        console.debug(
          `Context already within budget: ${originalSize} <= ${targetSize} chars`,
        );
        return ctx;
      }

      // 圧縮レベルの自動決定
      const compressionLevel =
        opts?.compressionLevel ||
        this.determineCompressionLevel(originalSize, targetSize);

      // 最適化設定
      const config: Partial<OptimizationConfig> = {
        ...this.defaultConfig,
        compressionLevel,
        qualityThreshold:
          opts?.qualityThreshold || this.defaultConfig.qualityThreshold,
        preserveStructure:
          opts?.preserveStructure ?? this.defaultConfig.preserveStructure,
      };

      console.debug(
        `Optimizing context: ${originalSize} → ${targetSize} chars (${compressionLevel})`,
      );

      // 3段階最適化の実行
      const result: OptimizedContext = this.optimizer.optimize(
        contextString,
        budgetTokens,
        config,
      );

      // 品質チェック
      if (result.qualityScore < (config.qualityThreshold || 0.8)) {
        console.warn(
          `Optimization quality below threshold: ${result.qualityScore} < ${config.qualityThreshold}`,
          "Returning original context",
        );
        return ctx;
      }

      // 圧縮結果のログ
      console.debug(
        `Context optimized successfully:`,
        `${result.originalTokens} → ${result.optimizedTokens} tokens`,
        `(${(result.compressionRatio * 100).toFixed(1)}x compression,`,
        `quality: ${(result.qualityScore * 100).toFixed(1)}%)`,
      );
      console.debug(
        `Optimization stages:`,
        `Cut: ${result.stages.cut.removed} sections removed,`,
        `Compress: ${result.stages.compress.compressed} blocks compressed,`,
        `Abstract: ${result.stages.abstract.abstracted} blocks abstracted`,
      );

      // 最適化された文字列をコンテキストに再構築
      return this.stringToContext(result.optimized, ctx);
    } catch (error) {
      // エラー時は元のコンテキストを返す(安全側フォールバック)
      console.error("Context optimization failed, returning original:", error);

      // デバッグ情報を含むエラーをスロー(オプション)
      if (process.env.NODE_ENV === "development") {
        throw new OptimizationError(
          `Context optimization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          { context: ctx, options: opts, error },
        );
      }

      // 本番環境では静かに元のコンテキストを返す
      return ctx;
    }
  }
}

/**
 * ファクトリ関数
 */
export function createContextOptimizerAdapter(): ContextOptimizerAdapter {
  return new ContextOptimizerAdapter();
}
