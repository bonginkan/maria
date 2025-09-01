/**
 * Ultra Thinking Output Schema
 * JSON Schema + Zod による型安全な構造化出力
 */

import { z } from "zod";

// Zod スキーマ定義
export const UltraOutZ = z.object({
  high_level: z.string().describe("高レベルの要約と洞察"),

  tech: z
    .object({
      design: z.string().describe("技術的な設計の詳細"),
      tradeoffs: z.array(z.string()).describe("トレードオフの分析"),
      complexity: z.string().optional().describe("複雑度の評価"),
    })
    .describe("技術的な分析"),

  exec: z
    .object({
      decision: z.string().describe("実行に関する意思決定"),
      roi: z.string().optional().describe("ROI(投資対効果)"),
      timeline: z.string().optional().describe("タイムライン見積もり"),
    })
    .describe("実行計画"),

  risks: z.array(z.string()).describe("リスクと懸念事項"),
  kpi: z.array(z.string()).describe("重要な成功指標"),
  next: z.array(z.string()).describe("次のステップの提案"),
});

// TypeScript型の導出
export type UltraOut = z.infer<typeof UltraOutZ>;

// JSON Schema定義(Responses API用)
export const UltraOutSchema = {
  name: "ultra_output",
  strict: true, // 厳密なスキーマ検証
  schema: {
    type: "object" as const,
    properties: {
      high_level: {
        type: "string" as const,
        description: "高レベルの要約と洞察",
      },
      tech: {
        type: "object" as const,
        properties: {
          design: {
            type: "string" as const,
            description: "技術的な設計の詳細",
          },
          tradeoffs: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "トレードオフの分析",
          },
          complexity: {
            type: "string" as const,
            description: "複雑度の評価",
          },
        },
        required: ["design", "tradeoffs"],
        additionalProperties: false,
      },
      exec: {
        type: "object" as const,
        properties: {
          decision: {
            type: "string" as const,
            description: "実行に関する意思決定",
          },
          roi: {
            type: "string" as const,
            description: "ROI(投資対効果)",
          },
          timeline: {
            type: "string" as const,
            description: "タイムライン見積もり",
          },
        },
        required: ["decision"],
        additionalProperties: false,
      },
      risks: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "リスクと懸念事項",
      },
      kpi: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "重要な成功指標",
      },
      next: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "次のステップの提案",
      },
    },
    required: ["high_level", "tech", "exec", "risks", "kpi", "next"],
    additionalProperties: false,
  },
} as const;

// Deep Thinking用のスキーマ(より詳細な分析)
export const DeepOutZ = z.object({
  summary: z.string().describe("包括的な要約"),

  analysis: z
    .object({
      assumptions: z.array(z.string()).describe("前提条件の分析"),
      implications: z.array(z.string()).describe("含意と影響"),
      alternatives: z.array(z.string()).describe("代替案の検討"),
      evidence: z.array(z.string()).describe("根拠と証拠"),
    })
    .describe("深層分析"),

  reasoning: z
    .object({
      logical_flow: z.array(z.string()).describe("論理的な流れ"),
      critical_points: z.array(z.string()).describe("重要なポイント"),
      counterarguments: z.array(z.string()).describe("反論と対処"),
    })
    .describe("推論過程"),

  conclusion: z.string().describe("結論"),
  confidence: z.number().min(0).max(1).describe("信頼度スコア"),
  limitations: z.array(z.string()).describe("制限事項と注意点"),
});

export type DeepOut = z.infer<typeof DeepOutZ>;

// Deep Thinking JSON Schema
export const DeepOutSchema = {
  name: "deep_output",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string" as const,
        description: "包括的な要約",
      },
      analysis: {
        type: "object" as const,
        properties: {
          assumptions: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "前提条件の分析",
          },
          implications: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "含意と影響",
          },
          alternatives: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "代替案の検討",
          },
          evidence: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "根拠と証拠",
          },
        },
        required: ["assumptions", "implications", "alternatives", "evidence"],
        additionalProperties: false,
      },
      reasoning: {
        type: "object" as const,
        properties: {
          logical_flow: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "論理的な流れ",
          },
          critical_points: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "重要なポイント",
          },
          counterarguments: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "反論と対処",
          },
        },
        required: ["logical_flow", "critical_points", "counterarguments"],
        additionalProperties: false,
      },
      conclusion: {
        type: "string" as const,
        description: "結論",
      },
      confidence: {
        type: "number" as const,
        minimum: 0,
        maximum: 1,
        description: "信頼度スコア",
      },
      limitations: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "制限事項と注意点",
      },
    },
    required: [
      "summary",
      "analysis",
      "reasoning",
      "conclusion",
      "confidence",
      "limitations",
    ],
    additionalProperties: false,
  },
} as const;

// ヘルパー関数:スキーマ検証
export function validateUltraOutput(data: unknown): UltraOut {
  return UltraOutZ.parse(data);
}

export function validateDeepOutput(data: unknown): DeepOut {
  return DeepOutZ.parse(data);
}

// 型ガード
export function isUltraOutput(data: unknown): data is UltraOut {
  try {
    UltraOutZ.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function isDeepOutput(data: unknown): data is DeepOut {
  try {
    DeepOutZ.parse(data);
    return true;
  } catch {
    return false;
  }
}
