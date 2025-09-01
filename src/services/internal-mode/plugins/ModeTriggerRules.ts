/**
 * Mode Trigger Rules - 宣言的なモード自動切り替えルール
 * UIから分離し、ModeRecognitionEngineで使用
 */

import type { ModeId } from "../config/modes";

export interface TriggerRule {
  target: ModeId;
  keywords: RegExp[];
  confidence: number;
  priority?: number; // 優先度(高い方が優先)
  description?: string;
}

/**
 * モード自動トリガールール定義
 * 信頼度85%以上で自動切り替え
 */
export const ModeTriggerRules: TriggerRule[] = [
  // ========== Thinking系 ==========
  {
    target: "thinking",
    keywords: [
      /what is|how does|why|explain|tell me/i,
      /について教えて|説明して|なぜ|どうして/i, // 日本語対応
      /can you|could you|please|help me/i,
      /^(what|how|why|when|where|who)\s/i,
    ],
    confidence: 0.85,
    priority: 1,
    description: "基本的な質問や説明要求",
  },

  {
    target: "ultrathinking",
    keywords: [
      /analyze|evaluate|assess|consider|tradeoff|roadmap/i,
      /comprehensive|thorough|detailed analysis/i,
      /分析|評価|検討|トレードオフ|ロードマップ/i, // 日本語
      /pros and cons|advantages|disadvantages/i,
      /strategic|tactical|decision/i,
    ],
    confidence: 0.9,
    priority: 5,
    description: "深い分析や戦略的判断",
  },

  {
    target: "deepthinking",
    keywords: [
      /prove|rigorous|formal|assumption|hypothesis/i,
      /critical thinking|deep dive|exhaustive/i,
      /証明|厳密|仮定|仮説|徹底的/i, // 日本語
      /fundamental|principle|theory|philosophical/i,
      /root cause|systematic|methodology/i,
    ],
    confidence: 0.9,
    priority: 6,
    description: "徹底的な推論と証明",
  },

  // ========== Research系 ==========
  {
    target: "researching",
    keywords: [
      /research|investigate|explore|find out|look up/i,
      /調査|調べ|探索|検索/i, // 日本語
      /literature|papers|studies|references/i,
      /state of the art|latest|recent developments/i,
    ],
    confidence: 0.88,
    priority: 4,
    description: "調査と研究",
  },

  {
    target: "analyzing",
    keywords: [
      /analyze data|statistical|metrics|performance/i,
      /データ分析|統計|メトリクス|パフォーマンス/i, // 日本語
      /benchmark|comparison|correlation/i,
      /patterns|trends|insights/i,
    ],
    confidence: 0.87,
    priority: 3,
    description: "データと統計の分析",
  },

  // ========== Creative系 ==========
  {
    target: "brainstorming",
    keywords: [
      /brainstorm|ideas|creative|innovative/i,
      /ブレインストーミング|アイデア|創造的|革新的/i, // 日本語
      /think outside|novel|unique|original/i,
      /possibilities|alternatives|options/i,
    ],
    confidence: 0.86,
    priority: 4,
    description: "アイデア出しと創造的思考",
  },

  {
    target: "designing",
    keywords: [
      /design|architect|blueprint|schema|layout/i,
      /設計|アーキテクチャ|ブループリント|スキーマ/i, // 日本語
      /user experience|interface|mockup/i,
      /system design|component|module/i,
    ],
    confidence: 0.87,
    priority: 4,
    description: "設計とアーキテクチャ",
  },

  // ========== Implementation系 ==========
  {
    target: "coding",
    keywords: [
      /write code|implement|function|class|method/i,
      /コード|実装|関数|クラス|メソッド/i, // 日本語
      /algorithm|data structure|api/i,
      /programming|development|coding/i,
    ],
    confidence: 0.88,
    priority: 5,
    description: "コード実装",
  },

  {
    target: "building",
    keywords: [
      /build|construct|create|develop|make/i,
      /構築|作成|開発|作る/i, // 日本語
      /application|system|service|product/i,
      /prototype|mvp|poc/i,
    ],
    confidence: 0.85,
    priority: 3,
    description: "システム構築",
  },

  // ========== Validation系 ==========
  {
    target: "testing",
    keywords: [
      /test|unit test|integration|e2e/i,
      /テスト|単体テスト|統合テスト/i, // 日本語
      /test case|test suite|coverage/i,
      /qa|quality assurance|validation/i,
    ],
    confidence: 0.87,
    priority: 4,
    description: "テストと品質保証",
  },

  {
    target: "debugging",
    keywords: [
      /debug|fix|error|bug|issue|problem/i,
      /デバッグ|修正|エラー|バグ|問題/i, // 日本語
      /troubleshoot|diagnose|resolve/i,
      /stack trace|exception|failure/i,
    ],
    confidence: 0.9,
    priority: 7,
    description: "デバッグとトラブルシューティング",
  },

  {
    target: "reviewing",
    keywords: [
      /review|code review|peer review|feedback/i,
      /レビュー|コードレビュー|フィードバック/i, // 日本語
      /comment|suggestion|improvement/i,
      /best practice|convention|standard/i,
    ],
    confidence: 0.86,
    priority: 3,
    description: "レビューとフィードバック",
  },

  // ========== Optimization系 ==========
  {
    target: "optimizing",
    keywords: [
      /optimize|performance|speed|efficiency/i,
      /最適化|パフォーマンス|速度|効率/i, // 日本語
      /bottleneck|profiling|benchmark/i,
      /reduce|minimize|improve|enhance/i,
    ],
    confidence: 0.88,
    priority: 5,
    description: "最適化とパフォーマンス改善",
  },

  {
    target: "refactoring",
    keywords: [
      /refactor|restructure|reorganize|clean/i,
      /リファクタリング|再構築|整理|クリーン/i, // 日本語
      /technical debt|code smell|maintainability/i,
      /simplify|consolidate|modularize/i,
    ],
    confidence: 0.87,
    priority: 4,
    description: "リファクタリングとコード改善",
  },

  {
    target: "planning",
    keywords: [
      /plan|roadmap|timeline|schedule|milestone/i,
      /計画|ロードマップ|タイムライン|スケジュール/i, // 日本語
      /sprint|iteration|phase|stage/i,
      /priority|backlog|task|story/i,
    ],
    confidence: 0.85,
    priority: 2,
    description: "計画とスケジューリング",
  },
];

/**
 * 入力テキストに最も適したモードを判定
 */
export function findBestMode(input: string): {
  mode: ModeId | null;
  confidence: number;
  matchedRules: TriggerRule[];
} {
  const inputLower = input.toLowerCase();
  const matches: Array<{ rule: TriggerRule; score: number }> = [];

  for (const rule of ModeTriggerRules) {
    let score = 0;
    let matchCount = 0;

    for (const pattern of rule.keywords) {
      if (pattern.test(inputLower)) {
        matchCount++;
        score += rule.confidence;
      }
    }

    if (matchCount > 0) {
      // 複数のキーワードがマッチした場合はスコアを上げる
      const adjustedScore = score * (1 + matchCount * 0.1);
      matches.push({
        rule,
        score: Math.min(adjustedScore, 1.0),
      });
    }
  }

  if (matches.length === 0) {
    return { mode: null, confidence: 0, matchedRules: [] };
  }

  // 優先度とスコアでソート
  matches.sort((a, b) => {
    const priorityDiff = (b.rule.priority || 0) - (a.rule.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return b.score - a.score;
  });

  const bestMatch = matches[0];
  return {
    mode: bestMatch.rule.target,
    confidence: bestMatch.score,
    matchedRules: matches.map((m) => m.rule),
  };
}

/**
 * 信頼度閾値を超えているかチェック
 */
export function shouldAutoSwitch(
  confidence: number,
  threshold: number = 0.85,
): boolean {
  return confidence >= threshold;
}

/**
 * モード間の遷移が自然かチェック
 */
export function isNaturalTransition(from: ModeId, to: ModeId): boolean {
  // 同じカテゴリ内の遷移は自然
  const categories: Record<string, ModeId[]> = {
    reasoning: [
      "thinking",
      "ultrathinking",
      "deepthinking",
      "researching",
      "analyzing",
    ],
    creative: ["creating", "brainstorming", "designing"],
    implementation: ["coding", "implementing", "building"],
    validation: ["testing", "debugging", "validating", "reviewing"],
    optimization: ["optimizing", "refactoring", "planning"],
  };

  for (const modeList of Object.values(categories)) {
    if (modeList.includes(from) && modeList.includes(to)) {
      return true;
    }
  }

  // 特定の遷移パターンを許可
  const allowedTransitions: Record<ModeId, ModeId[]> = {
    thinking: ["ultrathinking", "researching", "planning"],
    ultrathinking: ["deepthinking", "researching", "analyzing"],
    planning: ["implementing", "designing"],
    designing: ["implementing", "coding"],
    coding: ["testing", "debugging"],
    debugging: ["testing", "analyzing"],
    testing: ["validating", "reviewing"],
  };

  return allowedTransitions[from]?.includes(to) || false;
}

/**
 * デバッグ用:ルールの統計情報
 */
export function getRuleStats(): {
  totalRules: number;
  byTarget: Record<ModeId, number>;
  byPriority: Record<number, number>;
  averageConfidence: number;
} {
  const byTarget: Record<string, number> = {};
  const byPriority: Record<number, number> = {};
  let totalConfidence = 0;

  for (const rule of ModeTriggerRules) {
    // ターゲット別カウント
    byTarget[rule.target] = (byTarget[rule.target] || 0) + 1;

    // 優先度別カウント
    const priority = rule.priority || 0;
    byPriority[priority] = (byPriority[priority] || 0) + 1;

    // 信頼度合計
    totalConfidence += rule.confidence;
  }

  return {
    totalRules: ModeTriggerRules.length,
    byTarget: byTarget as Record<ModeId, number>,
    byPriority,
    averageConfidence: totalConfidence / ModeTriggerRules.length,
  };
}
