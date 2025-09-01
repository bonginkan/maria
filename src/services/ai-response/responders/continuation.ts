/**
 * Continuation Response Builder
 * Handles conversation continuation with clear action choices
 */

import { _generateFooter, truncateText, _createSectionHeader } from "./common";

/**
 * Build continuation prompt with context preview and choices
 * @param contextPreview - Recent conversation context
 * @param isJapanese - Language preference
 * @param customOptions - Custom continuation options
 * @returns Formatted continuation response
 */
export function buildContinuationPrompt(
  contextPreview: string,
  isJapanese: boolean,
  customOptions?: string[],
): string {
  // Check for PLAIN output mode
  if (process.env.MARIA_PLAIN_OUTPUT === '1' || process.env.MARIA_DISABLE_GUIDED_FLOW === '1') {
    // In PLAIN mode, return empty to let LLM handle naturally
    return "";
  }

  const parts: string[] = [];

  // Header
  parts.push(
    isJapanese
      ? "続きですね。直近の流れを確認しました。"
      : "I see you want to continue. Here's the recent context.",
  );
  parts.push("");

  // Context preview
  if (contextPreview) {
    parts.push(isJapanese ? "**直近の内容:**" : "**Recent context:**");
    parts.push(`> ${truncateText(contextPreview, 300)}`);
    parts.push("");
  }

  // Default or custom options
  const defaultOptions = isJapanese
    ? [
        "エラー処理の追加(try/catch・具体的メッセージ)",
        "モジュール分割(関心の分離)",
        "テスト追加(単体テスト・統合テスト)",
        "パフォーマンス改善(最適化・キャッシュ)",
        "ドキュメント作成(README・API仕様)",
      ]
    : [
        "Add error handling (try/catch with specific messages)",
        "Split into modules (separation of concerns)",
        "Add tests (unit and integration)",
        "Improve performance (optimization & caching)",
        "Create documentation (README & API specs)",
      ];

  const options =
    customOptions && customOptions.length > 0 ? customOptions : defaultOptions;

  parts.push(
    isJapanese
      ? "**次のステップを選んでください:**"
      : "**Choose your next step:**",
  );
  parts.push("");

  // Numbered options
  options.forEach((option, i) => {
    parts.push(`${i + 1}) ${option}`);
  });
  parts.push("");

  // Recommendation
  parts.push(
    isJapanese
      ? "💡 推奨: 迷う場合は 2→1→3 の順がおすすめです。"
      : "💡 Tip: If unsure, try 2→1→3 in that order.",
  );

  // Footer
  parts.push(
    isJapanese
      ? "\n番号で指示してください(1-5)。詳細な説明を追加しても構いません。"
      : "\nReply with a number (1-5). You can add details to your choice.",
  );

  return parts.join("\n");
}

/**
 * Generate context-aware continuation based on detected topics
 * @param topics - Detected topics from context
 * @param isJapanese - Language preference
 * @returns Topic-specific continuation options
 */
export function generateTopicBasedContinuation(
  topics: string[],
  isJapanese: boolean,
): string[] {
  const options: string[] = [];

  // React/Frontend specific
  if (topics.some((t) => ["react", "vue", "angular", "frontend"].includes(t))) {
    options.push(
      isJapanese
        ? "コンポーネントの分割とprops設計"
        : "Component splitting and props design",
    );
    options.push(
      isJapanese
        ? "状態管理の実装(Context/Redux/Zustand)"
        : "State management (Context/Redux/Zustand)",
    );
  }

  // Backend/API specific
  if (
    topics.some((t) => ["api", "backend", "express", "fastapi"].includes(t))
  ) {
    options.push(isJapanese ? "APIエンドポイントの追加" : "Add API endpoints");
    options.push(
      isJapanese
        ? "認証・認可の実装"
        : "Implement authentication & authorization",
    );
  }

  // Database specific
  if (
    topics.some((t) => ["database", "sql", "mongodb", "postgres"].includes(t))
  ) {
    options.push(
      isJapanese ? "データベーススキーマの設計" : "Design database schema",
    );
    options.push(
      isJapanese
        ? "マイグレーションとシード作成"
        : "Create migrations and seeds",
    );
  }

  // Testing specific
  if (topics.some((t) => ["test", "testing", "jest", "vitest"].includes(t))) {
    options.push(isJapanese ? "ユニットテストの追加" : "Add unit tests");
    options.push(isJapanese ? "E2Eテストの実装" : "Implement E2E tests");
  }

  // Default fallback options if no specific topics detected
  if (options.length === 0) {
    options.push(
      isJapanese ? "コードの詳細な実装" : "Detailed code implementation",
    );
    options.push(isJapanese ? "設計パターンの適用" : "Apply design patterns");
  }

  return options;
}

/**
 * Build a smart continuation response based on conversation state
 * @param context - Conversation context
 * @param detectedTopics - Topics detected in conversation
 * @param isJapanese - Language preference
 * @returns Smart continuation response
 */
export function buildSmartContinuation(
  context: string,
  detectedTopics: string[],
  isJapanese: boolean,
): string {
  // Check for PLAIN output mode
  if (process.env.MARIA_PLAIN_OUTPUT === '1' || process.env.MARIA_DISABLE_GUIDED_FLOW === '1') {
    return isJapanese ? "続けます。" : "Continuing.";
  }

  // Generate topic-based options
  const topicOptions = generateTopicBasedContinuation(
    detectedTopics,
    isJapanese,
  );

  // Add general improvement options
  const generalOptions = isJapanese
    ? ["既存コードのリファクタリング", "新機能の追加"]
    : ["Refactor existing code", "Add new features"];

  // Combine options (limit to 5)
  const allOptions = [...topicOptions, ...generalOptions].slice(0, 5);

  return buildContinuationPrompt(context, isJapanese, allOptions);
}
