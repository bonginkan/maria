/**
 * Model Router Adapter
 *
 * 既存のmodel-router.tsをIModelRouterインターフェースに適合させるアダプタ
 * 既存実装を無改造で活用
 */

import {
  IModelRouter,
  OrchestrateRequest,
  RouteDecision,
  ProviderExecutor,
  ProviderExecuteInput,
  ProviderExecuteResult,
  RoutingError,
} from "../ports";
import {
  ModelRouter,
  RequestContext,
  ModelSelection,
  getModelRouter,
} from "../model-router";
import {
  selectModelsFromTable,
  estimateCost,
  _MODEL_COSTS,
} from "../decision-table";

/**
 * プロバイダ実行器の実装
 * 実際のLLM呼び出しはここでは模擬実装(実際はproviders/配下の実装を使用)
 */
class DefaultProviderExecutor implements ProviderExecutor {
  constructor() {
    // Constructor implementation
  }

  async execute(input: ProviderExecuteInput): Promise<ProviderExecuteResult> {
    // TODO: 実際のプロバイダ実装をここで呼び出す
    // 現在は模擬実装
    console.log(
      `[${this.providerName}] Executing ${this.model} with context:`,
      input.context.messages.length,
      "messages",
    );

    // 実際の実装では、providers/配下の適切なプロバイダを呼び出す
    // 例:
    // switch(this.providerName) {
    //   case 'openai': return await OpenAIProvider.execute(input);
    //   case 'anthropic': return await AnthropicProvider.execute(input);
    //   ...
    // }

    return {
      output: `[Mock response from ${this.model}]`,
      meta: {
        tokensIn: 100,
        tokensOut: 50,
        latencyMs: 1000,
        cost: 0.001,
      },
    };
  }
}

/**
 * Model Router Adapter
 * 既存のModelRouterをIModelRouterインターフェースに適合
 * 決定表によるモデル選択を統合
 */
export class ModelRouterAdapter implements IModelRouter {
  private router: ModelRouter;
  private useDecisionTable: boolean;

  constructor(router?: ModelRouter, useDecisionTable = true) {
    this.router = router || getModelRouter();
    this.useDecisionTable = useDecisionTable;
  }

  /**
   * OrchestrateRequestをRequestContextに変換
   */
  private toRequestContext(req: OrchestrateRequest): RequestContext {
    // タスクマッピング
    let task = req.task;
    if (task === "ultra" || task === "deep") {
      task = "code"; // ultra/deepは高度なコードタスクとして扱う
    } else if (task === "chat" || task === "summarize") {
      task = "gen"; // chat/summarizeは生成タスクとして扱う
    } else if (task === "test") {
      task = "code"; // testはコードタスクとして扱う
    }

    // サイズをトークン数に変換(概算)
    const sizeMap = {
      small: 2000,
      medium: 8000,
      large: 32000,
    };

    // 複雑度の推定
    let complexity: RequestContext["complexity"] = "medium";
    if (req.size === "small" && !req.needsVision) {
      complexity = "simple";
    } else if (
      req.size === "large" ||
      req.task === "ultra" ||
      req.task === "deep"
    ) {
      complexity = "complex";
    }

    return {
      task: task as RequestContext["task"],
      size: sizeMap[req.size],
      complexity,
      urgency: req.urgency || "normal",
      quality: req.quality || "production",
      multimodal: req.needsVision || false,
      streaming: req.needsStreaming || false,
    };
  }

  /**
   * ModelSelectionをRouteDecisionに変換
   */
  private toRouteDecision(
    selection: ModelSelection,
    req: OrchestrateRequest,
  ): RouteDecision {
    const { selectedModel, fallbackChain, rule } = selection;

    // テナントIDを含むcircuitKey生成
    const tenantId = req.context.meta?.tenantId || "default";
    const circuitKey = `${selectedModel.provider}:${selectedModel.model}:${tenantId}`;

    // フォールバックチェーンの構築(コスト昇順)
    const fallbacks = fallbackChain?.map((modelName) => {
      const [provider, _model] = this.parseModelString(modelName);
      return {
        providerName: provider,
        model: modelName,
        params: {
          maxTokens: selectedModel.maxTokens,
          temperature: selectedModel.temperature,
        },
        circuitKey: `${provider}:${modelName}:${tenantId}`,
        provider: new DefaultProviderExecutor(provider, modelName),
        ruleName: rule,
      };
    });

    return {
      providerName: selectedModel.provider as string,
      model: selectedModel.model,
      params: {
        maxTokens: selectedModel.maxTokens,
        temperature: selectedModel.temperature,
        timeout: selectedModel.timeout,
      },
      circuitKey,
      provider: new DefaultProviderExecutor(
        selectedModel.provider as string,
        selectedModel.model,
      ),
      fallbacks,
      ruleName: rule,
    };
  }

  /**
   * モデル文字列からプロバイダを推定
   */
  private parseModelString(modelString: string): [string, string] {
    if (modelString.startsWith("gpt-")) {
      return ["openai", modelString];
    }
    if (modelString.startsWith("claude-")) {
      return ["anthropic", modelString];
    }
    if (modelString.startsWith("gemini-")) {
      return ["google", modelString];
    }
    if (modelString.startsWith("groq-")) {
      return ["groq", modelString];
    }
    if (modelString.startsWith("ollama-")) {
      return ["ollama", modelString];
    }
    if (modelString.startsWith("vllm-")) {
      return ["vllm", modelString];
    }
    return ["openai", modelString]; // デフォルト
  }

  /**
   * ルーティング実行
   */
  async route(req: OrchestrateRequest): Promise<RouteDecision> {
    try {
      // 決定表を使用する場合
      if (this.useDecisionTable) {
        return this.routeWithDecisionTable(req);
      }

      // 既存のModelRouter使用
      const context = this.toRequestContext(req);
      const selection = await this.router.selectModel(context);
      return this.toRouteDecision(selection, req);
    } catch (error) {
      throw new RoutingError(
        `Failed to route request: ${error instanceof Error ? error.message : "Unknown error"}`,
        { request: req, error },
      );
    }
  }

  /**
   * 決定表によるルーティング
   */
  private async routeWithDecisionTable(
    req: OrchestrateRequest,
  ): Promise<RouteDecision> {
    // 決定表からモデル選択
    const decision = selectModelsFromTable(req);

    // テナントIDを含むcircuitKey生成
    const tenantId = req.context.meta?.tenantId || "default";

    // プライマリモデルの設定
    const [primaryProvider, _primaryModel] = this.parseModelString(
      decision.primary,
    );
    const primaryCircuitKey = `${primaryProvider}:${decision.primary}:${tenantId}`;

    // フォールバックチェーンの構築(既にコスト昇順)
    const fallbacks = decision.fallbacks.map((modelName) => {
      const [provider, _model] = this.parseModelString(modelName);
      return {
        providerName: provider,
        model: modelName,
        params: decision.params,
        circuitKey: `${provider}:${modelName}:${tenantId}`,
        provider: new DefaultProviderExecutor(provider, modelName),
        ruleName: decision.matchedRule,
      };
    });

    // コスト推定
    const estimatedInputTokens = this.estimateInputTokens(req);
    const estimatedOutputTokens = this.estimateOutputTokens(req);
    const cost = estimateCost(
      decision.primary,
      estimatedInputTokens,
      estimatedOutputTokens,
    );

    return {
      providerName: primaryProvider,
      model: decision.primary,
      params: {
        ...decision.params,
        estimatedCost: cost,
      },
      circuitKey: primaryCircuitKey,
      provider: new DefaultProviderExecutor(primaryProvider, decision.primary),
      fallbacks,
      ruleName: `decision-table:${decision.matchedRule}`,
    };
  }

  /**
   * 入力トークン数の推定
   */
  private estimateInputTokens(req: OrchestrateRequest): number {
    const messageLength = req.context.messages
      .map((m) => m.content.length)
      .reduce((a, b) => a + b, 0);
    return Math.ceil(messageLength / 4); // 約4文字/トークン
  }

  /**
   * 出力トークン数の推定
   */
  private estimateOutputTokens(req: OrchestrateRequest): number {
    // タスクとサイズに基づく推定
    const baseTokens = {
      small: 500,
      medium: 1500,
      large: 3000,
    };

    const taskMultiplier = {
      lint: 0.5,
      chat: 0.7,
      gen: 1.0,
      code: 1.2,
      review: 1.3,
      test: 1.0,
      summarize: 0.6,
      ultra: 2.0,
      deep: 1.8,
      vision: 1.0,
    };

    const base = baseTokens[req.size] || 1500;
    const multiplier = taskMultiplier[req.task] || 1.0;

    return Math.ceil(base * multiplier);
  }

  /**
   * パフォーマンス統計取得
   */
  getStats(): Record<string, any> {
    return this.router.getPerformanceAnalytics();
  }
}

/**
 * ファクトリ関数:既存のシングルトンインスタンスを使用
 */
export function createModelRouterAdapter(): ModelRouterAdapter {
  return new ModelRouterAdapter();
}
