/**
 * Decision Table for AI Model Selection
 *
 * 決定表によるルールベースのモデル選択
 * コスト昇順のフォールバック戦略を実装
 */

import { OrchestrateRequest } from "./ports";

/**
 * モデルコスト定義(1Kトークンあたりのコスト、USD)
 */
export const _MODEL_COSTS = {
  // OpenAI Models
  "gpt-5-mini": 0.00015, // 最安値(仮定)
  "gpt-4o-mini": 0.00015, // $0.15 per 1M input
  "gpt-4o": 0.005, // $5 per 1M input
  "gpt-4-turbo": 0.01, // $10 per 1M input
  "gpt-4": 0.03, // $30 per 1M input

  // Anthropic Models
  "claude-3-haiku": 0.00025, // $0.25 per 1M input
  "claude-3-sonnet": 0.003, // $3 per 1M input
  "claude-3.5-sonnet": 0.003, // $3 per 1M input
  "claude-3-opus": 0.015, // $15 per 1M input

  // Google Models
  "gemini-1.5-flash": 0.00035, // $0.35 per 1M input
  "gemini-1.5-pro": 0.00125, // $1.25 per 1M input

  // Groq Models (very fast, competitive pricing)
  "groq-mixtral-8x7b": 0.00027, // $0.27 per 1M input
  "groq-llama3-70b": 0.00059, // $0.59 per 1M input

  // Local Models (only infrastructure cost)
  "ollama-llama3": 0.0001, // Local inference
  "ollama-mistral": 0.0001, // Local inference
  "vllm-local": 0.0001, // Local inference
} as const;

/**
 * モデル能力マトリクス
 */
export interface ModelCapabilities {
  vision: boolean;
  streaming: boolean;
  contextWindow: number; // トークン数
  speed: "slow" | "medium" | "fast" | "ultra-fast";
  quality: "draft" | "good" | "excellent";
  languages: string[]; // サポート言語
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // OpenAI
  "gpt-5-mini": {
    vision: false,
    streaming: true,
    contextWindow: 128000,
    speed: "ultra-fast",
    quality: "good",
    languages: ["en", "ja", "zh", "es", "fr", "de", "ru", "ar"],
  },
  "gpt-4o-mini": {
    vision: true,
    streaming: true,
    contextWindow: 128000,
    speed: "fast",
    quality: "good",
    languages: ["en", "ja", "zh", "es", "fr", "de", "ru", "ar"],
  },
  "gpt-4o": {
    vision: true,
    streaming: true,
    contextWindow: 128000,
    speed: "medium",
    quality: "excellent",
    languages: ["en", "ja", "zh", "es", "fr", "de", "ru", "ar"],
  },

  // Anthropic
  "claude-3-haiku": {
    vision: false,
    streaming: true,
    contextWindow: 200000,
    speed: "fast",
    quality: "good",
    languages: ["en", "ja", "es", "fr", "de"],
  },
  "claude-3.5-sonnet": {
    vision: true,
    streaming: true,
    contextWindow: 200000,
    speed: "medium",
    quality: "excellent",
    languages: ["en", "ja", "es", "fr", "de"],
  },

  // Google
  "gemini-1.5-flash": {
    vision: true,
    streaming: true,
    contextWindow: 1000000,
    speed: "fast",
    quality: "good",
    languages: ["en", "ja", "zh", "es", "fr", "de", "ko", "hi"],
  },
  "gemini-1.5-pro": {
    vision: true,
    streaming: true,
    contextWindow: 1000000,
    speed: "medium",
    quality: "excellent",
    languages: ["en", "ja", "zh", "es", "fr", "de", "ko", "hi"],
  },

  // Groq
  "groq-mixtral-8x7b": {
    vision: false,
    streaming: true,
    contextWindow: 32000,
    speed: "ultra-fast",
    quality: "good",
    languages: ["en", "ja", "es", "fr", "de"],
  },

  // Local
  "ollama-llama3": {
    vision: false,
    streaming: true,
    contextWindow: 8000,
    speed: "slow",
    quality: "draft",
    languages: ["en"],
  },
};

/**
 * 決定表エントリ
 */
export interface DecisionTableEntry {
  // 条件
  condition: {
    task: OrchestrateRequest["task"] | "*";
    size: OrchestrateRequest["size"] | "*";
    vision?: boolean;
    streaming?: boolean;
    quality?: OrchestrateRequest["quality"] | "*";
    urgency?: OrchestrateRequest["urgency"] | "*";
    language?: string | "*";
  };

  // 推奨モデル(コスト昇順)
  models: string[];

  // パラメータ調整
  params?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };

  // 優先度(高い方が優先)
  priority: number;
}

/**
 * 決定表本体
 * 優先度順・詳細度順に配置
 */
export const DECISION_TABLE: DecisionTableEntry[] = [
  // ==========================================
  // Vision Tasks (最優先)
  // ==========================================
  {
    condition: {
      task: "vision",
      size: "*",
      vision: true,
    },
    models: [
      "gpt-4o-mini", // $0.15/1M - 最安値でvision対応
      "gemini-1.5-flash", // $0.35/1M
      "gpt-4o", // $5/1M
      "gemini-1.5-pro", // $1.25/1M
      "claude-3.5-sonnet", // $3/1M - 高品質fallback
    ],
    params: {
      temperature: 0.1,
      maxTokens: 4096,
    },
    priority: 100,
  },

  // ==========================================
  // Ultra/Deep Tasks (高度な思考が必要)
  // ==========================================
  {
    condition: {
      task: "ultra",
      size: "*",
      quality: "critical",
    },
    models: [
      "claude-3.5-sonnet", // $3/1M - 深い思考に最適
      "gpt-4o", // $5/1M
      "gemini-1.5-pro", // $1.25/1M
      "claude-3-opus", // $15/1M - 最高品質fallback
    ],
    params: {
      temperature: 0,
      maxTokens: 8192,
    },
    priority: 95,
  },
  {
    condition: {
      task: "deep",
      size: "*",
    },
    models: [
      "gpt-4o", // $5/1M
      "claude-3.5-sonnet", // $3/1M
      "gemini-1.5-pro", // $1.25/1M
    ],
    params: {
      temperature: 0.2,
      maxTokens: 8192,
    },
    priority: 94,
  },

  // ==========================================
  // High Urgency (速度優先)
  // ==========================================
  {
    condition: {
      task: "*",
      size: "*",
      urgency: "high",
    },
    models: [
      "groq-mixtral-8x7b", // $0.27/1M - 超高速
      "gpt-5-mini", // $0.15/1M - 高速
      "gpt-4o-mini", // $0.15/1M
      "gemini-1.5-flash", // $0.35/1M
    ],
    params: {
      temperature: 0.1,
      maxTokens: 2048,
    },
    priority: 90,
  },

  // ==========================================
  // Lint/Review Tasks (コード品質チェック)
  // ==========================================
  {
    condition: {
      task: "lint",
      size: "small",
    },
    models: [
      "gpt-5-mini", // $0.15/1M
      "gpt-4o-mini", // $0.15/1M
      "groq-mixtral-8x7b", // $0.27/1M
      "claude-3-haiku", // $0.25/1M
    ],
    params: {
      temperature: 0,
      maxTokens: 2048,
    },
    priority: 80,
  },
  {
    condition: {
      task: "review",
      size: "medium",
    },
    models: [
      "gpt-4o-mini", // $0.15/1M
      "claude-3-haiku", // $0.25/1M
      "gpt-4o", // $5/1M - 高品質レビュー
      "claude-3.5-sonnet", // $3/1M
    ],
    params: {
      temperature: 0,
      maxTokens: 4096,
    },
    priority: 80,
  },
  {
    condition: {
      task: "review",
      size: "large",
      quality: "production",
    },
    models: [
      "claude-3.5-sonnet", // $3/1M - 大規模コードレビューに最適
      "gpt-4o", // $5/1M
      "gemini-1.5-pro", // $1.25/1M - 大コンテキスト対応
    ],
    params: {
      temperature: 0,
      maxTokens: 8192,
    },
    priority: 85,
  },

  // ==========================================
  // Code Generation Tasks
  // ==========================================
  {
    condition: {
      task: "code",
      size: "small",
    },
    models: [
      "gpt-5-mini", // $0.15/1M
      "gpt-4o-mini", // $0.15/1M
      "claude-3-haiku", // $0.25/1M
      "groq-mixtral-8x7b", // $0.27/1M
    ],
    params: {
      temperature: 0.2,
      maxTokens: 4096,
    },
    priority: 75,
  },
  {
    condition: {
      task: "code",
      size: "medium",
    },
    models: [
      "gpt-4o-mini", // $0.15/1M
      "claude-3-haiku", // $0.25/1M
      "gpt-4o", // $5/1M
      "claude-3.5-sonnet", // $3/1M
    ],
    params: {
      temperature: 0.1,
      maxTokens: 4096,
    },
    priority: 75,
  },
  {
    condition: {
      task: "code",
      size: "large",
    },
    models: [
      "claude-3.5-sonnet", // $3/1M - 大規模コード生成に最適
      "gpt-4o", // $5/1M
      "gemini-1.5-pro", // $1.25/1M
    ],
    params: {
      temperature: 0.1,
      maxTokens: 8192,
    },
    priority: 75,
  },

  // ==========================================
  // General Generation Tasks
  // ==========================================
  {
    condition: {
      task: "gen",
      size: "small",
      streaming: true,
    },
    models: [
      "gpt-5-mini", // $0.15/1M
      "gpt-4o-mini", // $0.15/1M
      "groq-mixtral-8x7b", // $0.27/1M
      "gemini-1.5-flash", // $0.35/1M
    ],
    params: {
      temperature: 0.7,
      maxTokens: 2048,
    },
    priority: 70,
  },
  {
    condition: {
      task: "gen",
      size: "medium",
    },
    models: [
      "gpt-4o-mini", // $0.15/1M
      "claude-3-haiku", // $0.25/1M
      "gemini-1.5-flash", // $0.35/1M
      "gpt-4o", // $5/1M
    ],
    params: {
      temperature: 0.5,
      maxTokens: 4096,
    },
    priority: 70,
  },
  {
    condition: {
      task: "gen",
      size: "large",
    },
    models: [
      "claude-3.5-sonnet", // $3/1M - 大規模生成
      "gemini-1.5-pro", // $1.25/1M - 超大コンテキスト
      "gpt-4o", // $5/1M
    ],
    params: {
      temperature: 0.5,
      maxTokens: 8192,
    },
    priority: 70,
  },

  // ==========================================
  // Chat/Conversation Tasks
  // ==========================================
  {
    condition: {
      task: "chat",
      size: "*",
      streaming: true,
    },
    models: [
      "gpt-5-mini", // $0.15/1M - 高速応答
      "gpt-4o-mini", // $0.15/1M
      "claude-3-haiku", // $0.25/1M
      "groq-mixtral-8x7b", // $0.27/1M
    ],
    params: {
      temperature: 0.8,
      maxTokens: 2048,
    },
    priority: 65,
  },

  // ==========================================
  // Summarization Tasks
  // ==========================================
  {
    condition: {
      task: "summarize",
      size: "*",
    },
    models: [
      "gpt-4o-mini", // $0.15/1M
      "claude-3-haiku", // $0.25/1M
      "gemini-1.5-flash", // $0.35/1M
      "gpt-4o", // $5/1M
    ],
    params: {
      temperature: 0,
      maxTokens: 2048,
    },
    priority: 65,
  },

  // ==========================================
  // Test Generation
  // ==========================================
  {
    condition: {
      task: "test",
      size: "*",
    },
    models: [
      "gpt-4o-mini", // $0.15/1M
      "claude-3-haiku", // $0.25/1M
      "gpt-4o", // $5/1M
      "claude-3.5-sonnet", // $3/1M
    ],
    params: {
      temperature: 0.1,
      maxTokens: 4096,
    },
    priority: 60,
  },

  // ==========================================
  // Japanese-specific (日本語最適化)
  // ==========================================
  {
    condition: {
      task: "*",
      size: "*",
      language: "ja",
    },
    models: [
      "gpt-4o-mini", // $0.15/1M - 日本語良好
      "claude-3-haiku", // $0.25/1M - 日本語良好
      "gemini-1.5-flash", // $0.35/1M - 日本語良好
      "gpt-4o", // $5/1M
      "claude-3.5-sonnet", // $3/1M - 日本語優秀
    ],
    params: {
      temperature: 0.3,
    },
    priority: 50,
  },

  // ==========================================
  // Draft Quality (ローカル/低コスト)
  // ==========================================
  {
    condition: {
      task: "*",
      size: "*",
      quality: "draft",
    },
    models: [
      "ollama-llama3", // $0.0001/1M - ローカル
      "gpt-5-mini", // $0.15/1M
      "gpt-4o-mini", // $0.15/1M
      "groq-mixtral-8x7b", // $0.27/1M
    ],
    params: {
      temperature: 0.5,
      maxTokens: 2048,
    },
    priority: 40,
  },

  // ==========================================
  // Default Fallback (全条件に一致)
  // ==========================================
  {
    condition: {
      task: "*",
      size: "*",
    },
    models: [
      "gpt-5-mini", // $0.15/1M - デフォルト最安値
      "gpt-4o-mini", // $0.15/1M
      "claude-3-haiku", // $0.25/1M
      "groq-mixtral-8x7b", // $0.27/1M
      "gemini-1.5-flash", // $0.35/1M
      "gpt-4o", // $5/1M
      "claude-3.5-sonnet", // $3/1M
      "ollama-llama3", // $0.0001/1M - 最終fallback
    ],
    params: {
      temperature: 0.5,
      maxTokens: 4096,
    },
    priority: 1,
  },
];

/**
 * 決定表からモデルを選択
 */
export function selectModelsFromTable(request: OrchestrateRequest): {
  primary: string;
  fallbacks: string[];
  params: any;
  matchedRule: string;
} {
  // 条件に一致するエントリを優先度順に検索
  const sortedEntries = [...DECISION_TABLE].sort(
    (a, b) => b.priority - a.priority,
  );

  for (const entry of sortedEntries) {
    if (matchesCondition(request, entry.condition)) {
      // 機能要件でフィルタリング
      const filteredModels = filterModelsByCapabilities(entry.models, request);

      if (filteredModels.length === 0) {
        continue; // 次のエントリを試す
      }

      // コスト昇順でソート(すでにソート済みの場合が多いが念のため)
      const sortedModels = sortModelsByCost(filteredModels);

      return {
        primary: sortedModels[0],
        fallbacks: sortedModels.slice(1),
        params: entry.params || object,
        matchedRule: describeCondition(entry.condition),
      };
    }
  }

  // デフォルトフォールバック(ここには到達しないはず)
  return {
    primary: "gpt-4o-mini",
    fallbacks: ["gpt-4o", "claude-3.5-sonnet"],
    params: Record<string, any>,
    matchedRule: "emergency-fallback",
  };
}

/**
 * 条件マッチング
 */
function matchesCondition(
  request: OrchestrateRequest,
  condition: DecisionTableEntry["condition"],
): boolean {
  if (condition.task !== "*" && condition.task !== request.task) {
    return false;
  }

  if (condition.size !== "*" && condition.size !== request.size) {
    return false;
  }

  if (
    condition.vision !== undefined &&
    condition.vision !== request.needsVision
  ) {
    return false;
  }

  if (
    condition.streaming !== undefined &&
    condition.streaming !== request.needsStreaming
  ) {
    return false;
  }

  if (
    condition.quality &&
    condition.quality !== "*" &&
    condition.quality !== request.quality
  ) {
    return false;
  }

  if (
    condition.urgency &&
    condition.urgency !== "*" &&
    condition.urgency !== request.urgency
  ) {
    return false;
  }

  if (
    condition.language &&
    condition.language !== "*" &&
    condition.language !== request.language
  ) {
    return false;
  }

  return true;
}

/**
 * 機能要件によるフィルタリング
 */
function filterModelsByCapabilities(
  models: string[],
  request: OrchestrateRequest,
): string[] {
  return models.filter((model) => {
    const capabilities = MODEL_CAPABILITIES[model];
    if (!capabilities) {
      return true; // 能力情報がない場合は含める
    }

    // Vision要件
    if (request.needsVision && !capabilities.vision) {
      return false;
    }

    // Streaming要件
    if (request.needsStreaming && !capabilities.streaming) {
      return false;
    }

    // Context size要件
    const requiredContext =
      request.size === "large"
        ? 32000
        : request.size === "medium"
          ? 8000
          : 2000;
    if (capabilities.contextWindow < requiredContext) {
      return false;
    }

    // 言語要件
    if (request.language && request.language !== "auto") {
      if (!capabilities.languages.includes(request.language)) {
        return false;
      }
    }

    // Quality要件
    if (request.quality === "critical" && capabilities.quality === "draft") {
      return false;
    }

    return true;
  });
}

/**
 * コスト昇順でソート
 */
function sortModelsByCost(models: string[]): string[] {
  return [...models].sort((a, b) => {
    const costA = _MODEL_COSTS[a as keyof typeof _MODEL_COSTS] || 999;
    const costB = _MODEL_COSTS[b as keyof typeof _MODEL_COSTS] || 999;
    return costA - costB;
  });
}

/**
 * 条件の説明文生成
 */
function describeCondition(condition: DecisionTableEntry["condition"]): string {
  const parts: string[] = [];

  if (condition.task !== "*") parts.push(`task=${condition.task}`);
  if (condition.size !== "*") parts.push(`size=${condition.size}`);
  if (condition.vision !== undefined) parts.push(`vision=${condition.vision}`);
  if (condition.streaming !== undefined)
    parts.push(`streaming=${condition.streaming}`);
  if (condition.quality && condition.quality !== "*")
    parts.push(`quality=${condition.quality}`);
  if (condition.urgency && condition.urgency !== "*")
    parts.push(`urgency=${condition.urgency}`);
  if (condition.language && condition.language !== "*")
    parts.push(`lang=${condition.language}`);

  return parts.join(",") || "default";
}

/**
 * コスト見積もり(トークン数ベース)
 */
export function estimateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const costPerK = _MODEL_COSTS[model as keyof typeof _MODEL_COSTS] || 0.01;

  // 入力と出力で異なるレートの場合があるが、簡略化のため同じレートを使用
  // 実際は出力の方が高い(約2-3倍)
  const inputCost = (tokensIn / 1000) * costPerK;
  const outputCost = (tokensOut / 1000) * costPerK * 2; // 出力は2倍と仮定

  return Math.round((inputCost + outputCost) * 10000) / 10000; // 小数点4桁
}
