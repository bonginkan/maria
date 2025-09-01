/**
 * AI Orchestration API Endpoint
 *
 * HTTPエンドポイントとして統合パイプラインを公開
 * Express/Fastify/Next.js等で使用可能
 */

import { Request, Response, NextFunction } from "express";
import {
  getDefaultPipeline,
  createPipelineWithShadow,
  OrchestrateRequest,
  OrchestrationError,
  AllFallbacksFailedError,
  GuardError,
} from "../services/ai-orchestration";
import { createMetricsIntegratedTelemetry } from "../services/ai-orchestration/telemetry/telemetry-adapter";
import { getMetricsCollector } from "../services/ai-orchestration/telemetry/metrics-collector";
import chalk from "chalk";

/**
 * API設定
 */
interface OrchestrationAPIConfig {
  enableShadow?: boolean;
  shadowRate?: number;
  enableMetrics?: boolean;
  enableDebug?: boolean;
  maxRequestSize?: number;
  timeout?: number;
  rateLimit?: {
    requestsPerMinute: number;
    burstLimit: number;
  };
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: OrchestrationAPIConfig = {
  enableShadow: false,
  shadowRate: 0.1,
  enableMetrics: true,
  enableDebug: process.env.NODE_ENV === "development",
  maxRequestSize: 1024 * 1024, // 1MB
  timeout: 30000, // 30秒
};

/**
 * パイプラインインスタンス(シングルトン)
 */
let pipelineInstance: ReturnType<typeof createPipelineWithShadow> | null = null;

/**
 * パイプライン初期化
 */
function initializePipeline(config: OrchestrationAPIConfig) {
  if (!pipelineInstance) {
    const telemetry = config.enableMetrics
      ? createMetricsIntegratedTelemetry({
          debug: config.enableDebug,
          logToConsole: config.enableDebug,
        })
      : undefined;

    if (config.enableShadow) {
      pipelineInstance = createPipelineWithShadow(
        config.shadowRate || 0.1,
        telemetry,
      );
    } else {
      pipelineInstance = getDefaultPipeline();
    }

    console.log(chalk.green("✅ AI Orchestration Pipeline initialized"));
    console.log(
      `  Shadow: ${config.enableShadow ? `enabled (${(config.shadowRate || 0.1) * 100}%)` : "disabled"}`,
    );
    console.log(`  Metrics: ${config.enableMetrics ? "enabled" : "disabled"}`);
  }

  return pipelineInstance;
}

/**
 * リクエスト検証
 */
function validateRequest(body: any): OrchestrateRequest {
  // 必須フィールドチェック
  if (!body.task) {
    throw new Error("Missing required field: task");
  }
  if (!body.size) {
    throw new Error("Missing required field: size");
  }
  if (!body.context?.messages || !Array.isArray(body.context.messages)) {
    throw new Error("Missing or invalid context.messages");
  }

  // タスクタイプ検証
  const validTasks = [
    "lint",
    "gen",
    "vision",
    "code",
    "review",
    "chat",
    "summarize",
    "test",
    "ultra",
    "deep",
  ];
  if (!validTasks.includes(body.task)) {
    throw new Error(
      `Invalid task: ${body.task}. Must be one of: ${validTasks.join(", ")}`,
    );
  }

  // サイズ検証
  const validSizes = ["small", "medium", "large"];
  if (!validSizes.includes(body.size)) {
    throw new Error(
      `Invalid size: ${body.size}. Must be one of: ${validSizes.join(", ")}`,
    );
  }

  // メッセージ検証
  for (const msg of body.context.messages) {
    if (!msg.role || !msg.content) {
      throw new Error("Each message must have role and content");
    }
    if (!["user", "assistant", "system"].includes(msg.role)) {
      throw new Error(`Invalid message role: ${msg.role}`);
    }
  }

  return {
    task: body.task,
    size: body.size,
    needsVision: body.needsVision || false,
    needsStreaming: body.needsStreaming || false,
    language: body.language || "auto",
    quality: body.quality || "production",
    urgency: body.urgency || "normal",
    mode: body.mode,
    context: {
      messages: body.context.messages,
      meta: {
        ...body.context.meta,
        requestId:
          body.context.meta?.requestId ||
          `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: "api",
      },
    },
  };
}

/**
 * メインハンドラー
 */
export async function orchestrateHandler(
  req: Request,
  res: Response,
  config: OrchestrationAPIConfig = DEFAULT_CONFIG,
): Promise<void> {
  const startTime = Date.now();
  const requestId =
    (req.headers["x-request-id"] as string) || `api-${Date.now()}`;

  try {
    // リクエストサイズチェック
    if (
      config.maxRequestSize &&
      JSON.stringify(req.body).length > config.maxRequestSize
    ) {
      res.status(413).json({
        error: "Request too large",
        maxSize: config.maxRequestSize,
      });
      return;
    }

    // リクエスト検証
    const orchestrateRequest = validateRequest(req.body);
    orchestrateRequest.context.meta!.requestId = requestId;

    // テナントID(認証から取得、ここではヘッダーから)
    const tenantId = (req.headers["x-tenant-id"] as string) || "default";
    orchestrateRequest.context.meta!.tenantId = tenantId;

    // パイプライン取得
    const pipeline = initializePipeline(config);

    // タイムアウト設定
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Request timeout")),
        config.timeout || 30000,
      );
    });

    // パイプライン実行
    const result = await Promise.race([
      pipeline.handle(orchestrateRequest),
      timeoutPromise,
    ]);

    const elapsed = Date.now() - startTime;

    // 成功レスポンス
    res.status(200).json({
      success: true,
      output: result.output,
      meta: {
        ...result.meta,
        requestId,
        processingTimeMs: elapsed,
      },
    });

    // ログ
    if (config.enableDebug) {
      console.log(
        chalk.green(
          `✅ Request ${requestId} completed in ${elapsed}ms`,
          `[${result.meta?.provider}:${result.meta?.model}]`,
        ),
      );
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;

    // エラータイプ別処理
    let statusCode = 500;
    let errorType = "internal_error";
    let errorMessage = "An error occurred processing your request";
    let errorDetails: any = {};

    if (error instanceof AllFallbacksFailedError) {
      statusCode = 503;
      errorType = "all_fallbacks_failed";
      errorMessage = "All model attempts failed";
      errorDetails = {
        attempts: error.details?.attempts,
        code: error.code,
      };
    } else if (error instanceof GuardError) {
      if (error.message.includes("Circuit breaker")) {
        statusCode = 503;
        errorType = "circuit_breaker_open";
        errorMessage = "Service temporarily unavailable";
      } else if (error.message.includes("Rate limit")) {
        statusCode = 429;
        errorType = "rate_limit_exceeded";
        errorMessage = "Too many requests";
      }
      errorDetails = {
        code: error.code,
        details: error.details,
      };
    } else if (error instanceof OrchestrationError) {
      statusCode = 500;
      errorType = error.code;
      errorMessage = error.message;
      errorDetails = error.details;
    } else if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        statusCode = 408;
        errorType = "timeout";
        errorMessage = "Request timeout";
      } else if (
        error.message.includes("Missing required") ||
        error.message.includes("Invalid")
      ) {
        statusCode = 400;
        errorType = "validation_error";
        errorMessage = error.message;
      } else {
        errorMessage = error.message;
      }
    }

    // エラーレスポンス
    res.status(statusCode).json({
      success: false,
      error: {
        type: errorType,
        message: errorMessage,
        details: errorDetails,
        requestId,
        processingTimeMs: elapsed,
      },
    });

    // エラーログ
    console.error(
      chalk.red(
        `❌ Request ${requestId} failed after ${elapsed}ms:`,
        errorType,
        errorMessage,
      ),
    );

    if (config.enableDebug && error instanceof Error) {
      console.error(error.stack);
    }
  }
}

/**
 * メトリクスエンドポイント
 */
export async function metricsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const collector = getMetricsCollector();

    // クエリパラメータでフィルタリング
    const filter: any = {};
    if (req.query.router) filter.routerVersion = req.query.router as string;
    if (req.query.task) filter.task = req.query.task as string;
    if (req.query.model) filter.model = req.query.model as string;
    if (req.query.from) filter.startTime = parseInt(req.query.from as string);
    if (req.query.to) filter.endTime = parseInt(req.query.to as string);

    const stats = collector.getStatistics(filter);

    res.status(200).json({
      success: true,
      statistics: stats,
    });
  } catch (innerError) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve metrics",
    });
  }
}

/**
 * ヘルスチェックエンドポイント
 */
export async function healthHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const pipeline = getDefaultPipeline();
    const stats = pipeline.getStatistics();

    res.status(200).json({
      status: "healthy",
      uptime: process.uptime(),
      statistics: {
        requests: stats.requests,
        successRate: stats.successRate,
        fallbackRate: stats.fallbackRate,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Express/Fastifyミドルウェア
 */
export function orchestrationMiddleware(config?: OrchestrationAPIConfig) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    // APIパスに基づくルーティング
    if (req._path === "/orchestrate" && req.method === "POST") {
      await orchestrateHandler(req, res, mergedConfig);
    } else if (req._path === "/metrics" && req.method === "GET") {
      await metricsHandler(req, res);
    } else if (req._path === "/health" && req.method === "GET") {
      await healthHandler(req, res);
    } else {
      next();
    }
  };
}

// ========================================
// Example Express App
// ========================================

// 使用例(Express)
/*
import express from 'express';
import { orchestrationMiddleware } from './orchestrate';

const app = express();

app.use(express.json({ limit: '1mb' }));

// AI Orchestrationミドルウェア
app.use('/api', orchestrationMiddleware({
  enableShadow: true,
  shadowRate: 0.1,
  enableMetrics: true,
  enableDebug: true
}));

// または個別エンドポイント
app.post('/api/orchestrate', (req, res) => orchestrateHandler(req, res));
app.get('/api/metrics', metricsHandler);
app.get('/api/health', healthHandler);

app.listen(3000, () => {
  console.log('AI Orchestration API running on http://localhost:3000');
});
*/
