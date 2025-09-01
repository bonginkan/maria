/**
 * Ultra Thinking 説明機能
 * Responses APIとJSON Schemaを使用した構造化出力
 */

import { createOpenAIResponses } from "../../providers/openai-responses";
import { getModelRouterV2 } from "../../ai-orchestration/model-router";
import { ModeService } from "../services/ModeService";
import {
  UltraOutZ,
  UltraOutSchema,
  DeepOutZ,
  DeepOutSchema,
  type UltraOut,
  type DeepOut,
} from "../types/ultra.schema";
import chalk from "chalk";

export interface ExplainOptions {
  _mode?: "ultrathinking" | "deepthinking";
  streaming?: boolean;
  previousResponseId?: string; // CoT継続用
}

/**
 * Ultra Thinking説明を実行
 */
export async function explainUltra(
  payload: any,
  options: ExplainOptions = {},
): Promise<UltraOut | DeepOut> {
  const _mode = options._mode || "ultrathinking";

  // モードを一時的に設定
  const previousMode = ModeService.current();
  ModeService.setById(_mode);

  try {
    // ModelRouterから設定を取得
    const router = getModelRouterV2();
    const config = router.selectForResponses({
      task: _mode === "ultrathinking" ? "ultra" : "deep",
      size: JSON.stringify(payload).length,
      _mode,
    });

    // OpenAI Responsesクライアント作成
    const client = createOpenAIResponses();

    // スキーマ選択
    const schema = _mode === "ultrathinking" ? UltraOutSchema : DeepOutSchema;

    // システムプロンプト作成
    const systemPrompt = createSystemPrompt(_mode);

    // Responses API呼び出し
    console.log(
      chalk.cyan(
        `🧠 ${_mode === "ultrathinking" ? "Ultra" : "Deep"} Thinking...`,
      ),
    );

    const response = await client.create({
      model: config.model,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: formatPayload(payload) },
      ],
      reasoning: config.reasoning,
      text: config.text,
      max_output_tokens: config.max_output_tokens,
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
      tools: config.allowedTools.allowed,
      tool_choice:
        config.allowedTools._mode === "required"
          ? { type: "required", tools: config.allowedTools.allowed }
          : { type: "auto" },
      previous_response_id: options.previousResponseId,
    });

    // 使用量の記録
    logUsage(response.usage, _mode);

    // JSONパース
    const parsedOutput = JSON.parse(response.output_text);

    // Zod検証
    const validated =
      _mode === "ultrathinking"
        ? UltraOutZ.parse(parsedOutput)
        : DeepOutZ.parse(parsedOutput);

    // 結果表示
    displayResult(validated, _mode);

    return validated;
  } catch (error) {
    console.error(chalk.red(`${_mode} failed:`), error);
    throw error;
  } finally {
    // モードを元に戻す
    ModeService.setById(previousMode.id);
  }
}

/**
 * ストリーミング版のUltra説明
 */
export async function* explainUltraStream(
  payload: any,
  options: ExplainOptions = {},
): AsyncGenerator<string, UltraOut | DeepOut> {
  const _mode = options._mode || "ultrathinking";

  // 現時点ではストリーミングは部分実装
  // 将来的にはResponses APIのストリーミング対応を待つ
  console.log(chalk.yellow("⚠️ Streaming _mode is experimental"));

  const result = await explainUltra(payload, options);

  // 結果を段階的に返す(シミュレーション)
  if ("high_level" in result) {
    yield `## High Level\n${result.high_level}\n\n`;
    yield `## Technical Analysis\n${result.tech.design}\n\n`;
    yield `## Execution Plan\n${result.exec.decision}\n\n`;
  } else {
    yield `## Summary\n${result.summary}\n\n`;
    yield `## Analysis\n${JSON.stringify(result.analysis, null, 2)}\n\n`;
    yield `## Conclusion\n${result.conclusion}\n\n`;
  }

  return result;
}

/**
 * システムプロンプトの作成
 */
function createSystemPrompt(_mode: "ultrathinking" | "deepthinking"): string {
  if (_mode === "ultrathinking") {
    return `You are UltraThinking, an advanced reasoning system optimized for rapid, comprehensive analysis.
Your responses must be in JSON format matching the specified schema.

Focus on:
1. High-level strategic insights
2. Technical design and tradeoffs
3. Executable decisions with clear ROI
4. Risk identification and mitigation
5. Measurable KPIs and next steps

Be concise yet thorough. Prioritize actionable insights.`;
  } else {
    return `You are DeepThinking, a rigorous analytical system designed for thorough, evidence-based reasoning.
Your responses must be in JSON format matching the specified schema.

Focus on:
1. Comprehensive analysis with clear assumptions
2. Logical reasoning with step-by-step flow
3. Critical evaluation with counterarguments
4. Evidence-based conclusions with confidence levels
5. Clear limitations and caveats

Be exhaustive in your analysis. Leave no stone unturned.`;
  }
}

/**
 * ペイロードのフォーマット
 */
function formatPayload(payload: any): string {
  if (typeof payload === "string") {
    return payload;
  }

  // オブジェクトの場合は構造化して表示
  return JSON.stringify(payload, null, 2);
}

/**
 * 使用量のログ
 */
function logUsage(
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  },
  _mode: string,
): void {
  const cost = estimateCost(usage);
  console.log(
    chalk.gray(
      `📊 ${_mode} usage: ${usage.prompt_tokens} in / ${usage.completion_tokens} out / $${cost.toFixed(4)}`,
    ),
  );
}

/**
 * コスト推定(GPT-5 mini想定)
 */
function estimateCost(usage: {
  prompt_tokens: number;
  completion_tokens: number;
}): number {
  // GPT-5 mini の仮想価格(実際の価格に要更新)
  const inputPrice = 0.00015 / 1000; // $0.00015 per 1K tokens
  const outputPrice = 0.0006 / 1000; // $0.0006 per 1K tokens

  return (
    usage.prompt_tokens * inputPrice + usage.completion_tokens * outputPrice
  );
}

/**
 * 結果の表示
 */
function displayResult(result: UltraOut | DeepOut, _mode: string): void {
  console.log(
    chalk.green(
      `\n✅ ${_mode === "ultrathinking" ? "Ultra" : "Deep"} Thinking Complete\n`,
    ),
  );

  if ("high_level" in result) {
    // Ultra出力
    console.log(chalk.bold("📌 High Level:"));
    console.log(result.high_level);
    console.log();

    console.log(chalk.bold("🔧 Technical:"));
    console.log(`Design: ${result.tech.design}`);
    console.log(`Tradeoffs: ${result.tech.tradeoffs.join(", ")}`);
    if (result.tech.complexity) {
      console.log(`Complexity: ${result.tech.complexity}`);
    }
    console.log();

    console.log(chalk.bold("🎯 Next Steps:"));
    result.next.forEach((step, i) => {
      console.log(`${i + 1}. ${step}`);
    });
  } else {
    // Deep出力
    console.log(chalk.bold("📝 Summary:"));
    console.log(result.summary);
    console.log();

    console.log(chalk.bold("🔍 Key Points:"));
    result.reasoning.critical_points.forEach((point, i) => {
      console.log(`${i + 1}. ${point}`);
    });
    console.log();

    console.log(chalk.bold("✨ Conclusion:"));
    console.log(result.conclusion);
    console.log(
      chalk.gray(`Confidence: ${(result.confidence * 100).toFixed(1)}%`),
    );
  }
}

// エクスポート:便利関数
export { validateUltraOutput, validateDeepOutput } from "../types/ultra.schema";
