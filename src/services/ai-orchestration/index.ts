/**
 * AI Orchestration Unified API
 *
 * 統合されたAIオーケストレーションサービスの公開API
 * これが唯一の外部向けエントリーポイント
 */

// ========================================
// Core Exports
// ========================================

export {
  // Pipeline (Main Entry Point)
  OrchestrationPipeline,
  OrchestrationPipelineBuilder,
} from "./pipeline";

// ========================================
// Port Interfaces
// ========================================

// Export error classes (these are values, not types)
export {
  OrchestrationError,
  RoutingError,
  OptimizationError,
  GuardError,
  AllFallbacksFailedError,
} from "./ports";

// Export types separately
export type {
  // Request/Response Types
  OrchestrateRequest,
  OrchestrateTask,
  OrchestrateSize,
  OrchestrateLanguage,
  OrchestrateContext,
  OrchestrationResult,

  // Core Interfaces
  IModelRouter,
  IContextOptimizer,
  IRequestGuard,
  OrchestrationTelemetry,
  OrchestrationPipelineDeps,

  // Provider Types
  ProviderExecutor,
  ProviderExecuteInput,
  ProviderExecuteResult,
  RouteDecision,

  // Telemetry Types
  TelemetryEvent,

  // Utility Types
  Message,
  MessageRole,
  PerformanceStats,
  ModelComparison,
} from "./ports";

// ========================================
// Adapter Factories
// ========================================

export {
  createModelRouterAdapter,
  ModelRouterAdapter,
} from "./adapters/model-router.adapter";

export {
  createModelRouterAdapter as createModelRouterV2Adapter,
  ModelRouterAdapter as ModelRouterV2Adapter,
} from "./adapters/model-router.adapter";

export {
  createContextOptimizerAdapter,
  ContextOptimizerAdapter,
} from "./adapters/context-optimizer.adapter";

export {
  createRequestGuardAdapter,
  RequestGuardAdapter,
} from "./adapters/request-guard.adapter";

// ========================================
// Convenience Functions
// ========================================

import { OrchestrationPipelineBuilder } from "./pipeline";
import { createModelRouterAdapter } from "./adapters/model-router.adapter";
import { createModelRouterAdapter as createModelRouterV2Adapter } from "./adapters/model-router.adapter";
import { createContextOptimizerAdapter } from "./adapters/context-optimizer.adapter";
import { createRequestGuardAdapter } from "./adapters/request-guard.adapter";
import type { OrchestrationTelemetry } from "./ports";

/**
 * デフォルトパイプラインの作成(v1ルーター使用)
 */
export function createDefaultPipeline(
  telemetry?: OrchestrationTelemetry,
): OrchestrationPipeline {
  return new OrchestrationPipelineBuilder()
    .withRouter(createModelRouterAdapter())
    .withOptimizer(createContextOptimizerAdapter())
    .withGuard(createRequestGuardAdapter())
    .withTelemetry(telemetry || createDefaultTelemetry())
    .build();
}

/**
 * v2パイプラインの作成(Responses API使用)
 */
export function createV2Pipeline(
  telemetry?: OrchestrationTelemetry,
): OrchestrationPipeline {
  return new OrchestrationPipelineBuilder()
    .withRouter(createModelRouterV2Adapter())
    .withOptimizer(createContextOptimizerAdapter())
    .withGuard(createRequestGuardAdapter())
    .withTelemetry(telemetry || createDefaultTelemetry())
    .build();
}

/**
 * シャドー評価付きパイプラインの作成
 * v1をメインに、v2をシャドーで評価
 */
export function createPipelineWithShadow(
  shadowRate = 0.1,
  telemetry?: OrchestrationTelemetry,
): OrchestrationPipeline {
  return new OrchestrationPipelineBuilder()
    .withRouter(createModelRouterAdapter())
    .withOptimizer(createContextOptimizerAdapter())
    .withGuard(createRequestGuardAdapter())
    .withShadowRouter(createModelRouterV2Adapter(), shadowRate)
    .withTelemetry(telemetry || createDefaultTelemetry())
    .build();
}

/**
 * デフォルトテレメトリ実装(コンソール出力)
 */
function createDefaultTelemetry(): OrchestrationTelemetry {
  return {
    emit: (event: TelemetryEvent) => {
      if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
        console.log(
          "[Telemetry]",
          JSON.stringify({
            name: event.name,
            at: new Date(event.at).toISOString(),
            ...event.tags,
            metrics: event.metrics,
          }),
        );
      }
    },
  };
}

// ========================================
// Singleton Instances
// ========================================

let defaultPipelineInstance: OrchestrationPipeline | null = null;

/**
 * シングルトンのデフォルトパイプラインを取得
 */
export function getDefaultPipeline(): OrchestrationPipeline {
  if (!defaultPipelineInstance) {
    defaultPipelineInstance = createDefaultPipeline();
  }
  return defaultPipelineInstance;
}

/**
 * パイプラインインスタンスをリセット(テスト用)
 */
export function resetPipeline(): void {
  if (defaultPipelineInstance) {
    defaultPipelineInstance.resetStatistics();
    defaultPipelineInstance = null;
  }
}
