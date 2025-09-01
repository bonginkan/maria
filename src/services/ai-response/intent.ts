/**
 * Intent Analysis System - Multi-language Support (Japanese/English)
 * High-precision intent detection for AI response routing
 */

export type Intent =
  | { type: "TETRIS_REQUEST"; detail?: string; confidence: number }
  | { type: "CODE_REQUEST"; detail?: string; confidence: number }
  | { type: "QUESTION"; detail?: string; confidence: number }
  | { type: "CONTINUATION"; detail?: string; confidence: number }
  | { type: "SUMMARIZE"; detail?: string; confidence: number }
  | { type: "REFACTOR"; detail?: string; confidence: number }
  | { type: "GENERAL"; detail?: string; confidence: number };

// Japanese question starters
const jaQuestionStarts = [
  "何",
  "どう",
  "なぜ",
  "いつ",
  "どこ",
  "どれ",
  "誰",
  "できますか",
  "教えて",
  "ありますか",
  "でしょうか",
];

// Code-related hints for detection
const codeHints = [
  "```",
  "function ",
  "class ",
  "const ",
  "let ",
  "import ",
  "export ",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".py",
  ".java",
  ".go",
  ".rs",
  "HTML",
  "CSS",
  "SQL",
  "Dockerfile",
  "yaml",
  "yml",
];

// Japanese code-related terms
const jaCodeTerms = [
  "実装",
  "コード",
  "関数",
  "クラス",
  "ビルド",
  "型",
  "型定義",
  "テスト",
  "プログラム",
  "スクリプト",
  "アプリ",
  "開発",
];

// Continuation hints (Japanese and English)
const continuationHints = [
  "続き",
  "つづき",
  "続行",
  "先ほどの",
  "前回の",
  "さっきの",
  "complete",
  "continue",
  "start",
  "give me",
  "finish",
  "proceed",
  "next",
  "then",
  "whole code",
];

// Summary hints
const summaryHints = [
  "要約",
  "まとめ",
  "サマリー",
  "まとめて",
  "整理",
  "summarize",
  "summary",
  "recap",
  "overview",
];

/**
 * Analyze user intent with multi-language support
 * @param userInputRaw - Raw user input
 * @param recentText - Recent conversation context
 * @returns Detected intent with confidence score
 */
export function analyzeIntent(
  userInputRaw: string,
  recentText: string = "",
): Intent {
  const input = userInputRaw.trim();
  const low = input.toLowerCase();
  const combinedContext = (recentText + " " + input).toLowerCase();

  // 1) TETRIS REQUEST - Explicit keyword only
  if (low.includes("tetris") || input.includes("テトリス")) {
    return {
      type: "TETRIS_REQUEST",
      confidence: 0.95,
      detail: "User explicitly requested Tetris game",
    };
  }

  // 2) SUMMARY REQUEST
  if (summaryHints.some((hint) => low.includes(hint))) {
    return {
      type: "SUMMARIZE",
      confidence: 0.9,
      detail: "User wants a summary of the conversation",
    };
  }

  // 3) CONTINUATION - Check with context
  if (
    recentText &&
    continuationHints.some(
      (hint) => low.includes(hint) || recentText.toLowerCase().includes(hint),
    )
  ) {
    return {
      type: "CONTINUATION",
      confidence: 0.85,
      detail: "User wants to continue previous topic",
    };
  }

  // 4) QUESTION DETECTION - Japanese and English
  const isQuestion =
    low.endsWith("?") ||
    low.endsWith("？") ||
    jaQuestionStarts.some((w) => input.startsWith(w)) ||
    [
      "what",
      "how",
      "why",
      "when",
      "where",
      "which",
      "who",
      "can you",
      "could you",
      "would you",
      "is it",
      "are there",
    ].some((w) => low.startsWith(w));

  if (isQuestion) {
    return {
      type: "QUESTION",
      confidence: 0.8,
      detail: "User is asking a question",
    };
  }

  // 5) CODE REQUEST - Code snippets, file extensions, programming terms
  const hasCodeSnippet = input.includes("```") || input.includes("`");
  const hasCodeHint = codeHints.some((hint) => combinedContext.includes(hint));
  const hasJaCodeTerm = jaCodeTerms.some((term) => input.includes(term));
  const hasEnCodeTerms = [
    "implement",
    "create",
    "build",
    "write",
    "develop",
    "code",
    "function",
    "class",
    "method",
    "component",
  ].some((w) => low.includes(w));

  if (hasCodeSnippet || hasCodeHint || hasJaCodeTerm || hasEnCodeTerms) {
    return {
      type: "CODE_REQUEST",
      confidence: hasCodeSnippet ? 0.9 : 0.75,
      detail: "User wants code implementation or help",
    };
  }

  // 6) REFACTOR REQUEST
  if (
    ["refactor", "リファクタ", "改善", "最適化", "optimize", "improve"].some(
      (w) => low.includes(w),
    )
  ) {
    return {
      type: "REFACTOR",
      confidence: 0.7,
      detail: "User wants code refactoring or optimization",
    };
  }

  // 7) DEFAULT - GENERAL
  return {
    type: "GENERAL",
    confidence: 0.3,
    detail: "General conversation or unclear intent",
  };
}

/**
 * Detect language preference from input
 * @param input - User input text
 * @returns Language code ('ja' | 'en')
 */
export function detectLanguage(input: string): "ja" | "en" {
  // Check for Japanese characters (Hiragana, Katakana, Kanji)
  const hasJapanese = /[ぁ-んァ-ヶー一-龥]/.test(input);
  return hasJapanese ? "ja" : "en";
}

/**
 * Get intent statistics for telemetry
 * @param intent - Analyzed intent
 * @param language - Detected language
 * @returns Telemetry event data
 */
export function getIntentTelemetry(intent: Intent, language: "ja" | "en") {
  return {
    event: "intent_decided",
    type: intent.type,
    confidence: intent.confidence,
    language,
    timestamp: Date.now(),
  };
}
