/**
 * AI Orchestration Pipeline - 使用例
 *
 * パイプラインの基本的な使い方とテスト例
 */

import {
  createDefaultPipeline,
  createPipelineWithShadow,
  OrchestrateRequest,
  OrchestrationResult,
  OrchestrationError,
} from "./index";
import chalk from "chalk";

/**
 * 基本的な使用例
 */
async function basicExample() {
  console.log(chalk.cyan("\n=== Basic Pipeline Example ===\n"));

  // デフォルトパイプラインの作成
  const pipeline = createDefaultPipeline();

  // リクエストの準備
  const request: OrchestrateRequest = {
    task: "gen",
    size: "medium",
    language: "ja",
    context: {
      messages: [
        {
          role: "user",
          content:
            "Next.jsのApp RouterでAPIルートを実装する最小サンプルを教えてください。",
        },
      ],
      meta: {
        requestId: "example-001",
        tenantId: "demo",
      },
    },
  };

  try {
    // パイプライン実行
    const _result: OrchestrationResult = await pipeline.handle(request);

    console.log(chalk.green("✅ Success!"));
    console.log("Output:", _result.output);
    console.log("Meta:", _result.meta);
    console.log("Statistics:", pipeline.getStatistics());
  } catch (error) {
    console.error(chalk.red("❌ Error:"), error);
  }
}

/**
 * ビジョンタスクの例
 */
async function visionExample() {
  console.log(chalk.cyan("\n=== Vision Task Example ===\n"));

  const pipeline = createDefaultPipeline();

  const request: OrchestrateRequest = {
    task: "vision",
    size: "medium",
    needsVision: true,
    language: "ja",
    context: {
      messages: [
        {
          role: "user",
          content:
            "この画像のUIデザインの改善点を3つ提案してください。[画像URL]",
        },
      ],
    },
  };

  try {
    const _result = await pipeline.handle(request);
    console.log(chalk.green("✅ Vision task completed"));
    console.log("Model used:", _result.meta?.model);
  } catch (innerError) {
    console.error(chalk.red("❌ Vision task failed:"), error);
  }
}

/**
 * 大規模コンテキストの最適化例
 */
async function largeContextExample() {
  console.log(chalk.cyan("\n=== Large Context Optimization Example ===\n"));

  const pipeline = createDefaultPipeline();

  // 大量のメッセージ履歴を含むリクエスト
  const messages = [];
  for (let i = 0; i < 50; i++) {
    messages.push(
      {
        role: "user" as const,
        content: `Question ${i}: How to implement feature ${i}?`,
      },
      {
        role: "assistant" as const,
        content: `Answer ${i}: Here's how to implement feature ${i}...`.repeat(
          10,
        ),
      },
    );
  }

  const request: OrchestrateRequest = {
    task: "code",
    size: "large",
    quality: "production",
    context: {
      messages,
      meta: {
        requestId: "large-context-001",
      },
    },
  };

  try {
    console.log(`Original context: ${messages.length} messages`);
    const _result = await pipeline.handle(request);
    console.log(chalk.green("✅ Large context handled"));
    console.log("Optimized successfully");
    console.log("Statistics:", pipeline.getStatistics());
  } catch (error) {
    console.error(chalk.red("❌ Large context failed:"), error);
  }
}

/**
 * シャドー評価の例
 */
async function shadowEvaluationExample() {
  console.log(chalk.cyan("\n=== Shadow Evaluation Example ===\n"));

  // 50%の確率でシャドー評価を実行
  const pipeline = createPipelineWithShadow(0.5);

  // 複数リクエストを送信してシャドー評価を観察
  for (let i = 0; i < 5; i++) {
    const request: OrchestrateRequest = {
      task: "gen",
      size: "small",
      context: {
        messages: [
          {
            role: "user",
            content: `Generate a haiku about ${["spring", "summer", "autumn", "winter", "rain"][i]}`,
          },
        ],
        meta: {
          requestId: `shadow-${i}`,
        },
      },
    };

    try {
      console.log(`\nRequest ${i + 1}:`);
      const _result = await pipeline.handle(request);
      console.log(chalk.green("✓"), `Model: ${_result.meta?.model}`);
    } catch (innerError) {
      console.error(chalk.red("✗"), error);
    }
  }

  console.log("\nFinal Statistics:", pipeline.getStatistics());
}

/**
 * エラーハンドリングとフォールバック例
 */
async function fallbackExample() {
  console.log(chalk.cyan("\n=== Fallback Handling Example ===\n"));

  const pipeline = createDefaultPipeline();

  // 高負荷/エラーを誘発するリクエスト
  const request: OrchestrateRequest = {
    task: "ultra", // 高度なタスク
    size: "large",
    quality: "critical",
    urgency: "high",
    context: {
      messages: [
        {
          role: "user",
          content:
            "Implement a distributed system with fault tolerance and consensus algorithm",
        },
      ],
    },
  };

  try {
    const _result = await pipeline.handle(request);
    console.log(chalk.green("✅ Completed with fallbacks"));
    console.log("Fallback count:", _result.meta?.fallbackCount || 0);
    console.log("Final model:", _result.meta?.model);
  } catch (error) {
    if (error instanceof OrchestrationError) {
      console.error(chalk.red("Orchestration Error:"));
      console.error("Code:", error.code);
      console.error("Details:", error.details);
    } else {
      console.error(chalk.red("Unknown Error:"), error);
    }
  }
}

/**
 * パフォーマンステスト
 */
async function performanceTest() {
  console.log(chalk.cyan("\n=== Performance Test ===\n"));

  const pipeline = createDefaultPipeline();
  const requestCount = 10;
  const results: number[] = [];

  for (let i = 0; i < requestCount; i++) {
    const request: OrchestrateRequest = {
      task: ["lint", "gen", "code"][i % 3] as any,
      size: ["small", "medium", "large"][i % 3] as any,
      context: {
        messages: [{ role: "user", content: `Test request ${i}` }],
      },
    };

    const startTime = performance.now();
    try {
      await pipeline.handle(request);
      const elapsed = performance.now() - startTime;
      results.push(elapsed);
      console.log(`Request ${i + 1}: ${elapsed.toFixed(1)}ms`);
    } catch (innerError) {
      console.error(`Request ${i + 1}: Failed`);
    }
  }

  // 統計計算
  if (results.length > 0) {
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const sorted = [...results].sort((a, b) => a - b);
    const p95 =
      sorted[Math.floor(results.length * 0.95)] || sorted[sorted.length - 1];

    console.log(chalk.yellow("\nPerformance Summary:"));
    console.log(`Average: ${avg.toFixed(1)}ms`);
    console.log(`P95: ${p95.toFixed(1)}ms`);
    console.log(`Min: ${Math.min(...results).toFixed(1)}ms`);
    console.log(`Max: ${Math.max(...results).toFixed(1)}ms`);
  }

  console.log("\nPipeline Statistics:", pipeline.getStatistics());
}

/**
 * メイン実行
 */
async function main() {
  console.log(chalk.bold.magenta("\n🚀 AI Orchestration Pipeline Examples\n"));

  // 各例を順番に実行
  await basicExample();
  await visionExample();
  await largeContextExample();
  await shadowEvaluationExample();
  await fallbackExample();
  await performanceTest();

  console.log(chalk.bold.magenta("\n✨ All examples completed!\n"));
}

// 直接実行された場合
if (require.main === module) {
  main().catch(console.error);
}

// エクスポート
export {
  basicExample,
  visionExample,
  largeContextExample,
  shadowEvaluationExample,
  fallbackExample,
  performanceTest,
};
