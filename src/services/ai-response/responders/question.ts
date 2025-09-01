/**
 * Question Response Builder
 * Structures Q&A responses with clear information hierarchy
 */

import {
  _generateFooter,
  createSectionHeader,
  formatList,
  cleanUserInput,
} from "./common";

export interface QuestionResponseOptions {
  question: string;
  isJapanese: boolean;
  topics?: string[];
  includeExample?: boolean;
}

/**
 * Build structured question response
 * @param options - Question response configuration
 * @returns Formatted question response
 */
export function buildQuestionResponse(
  options: QuestionResponseOptions,
): string {
  const { question, isJapanese, topics = [], includeExample = true } = options;
  const parts: string[] = [];

  // Check for PLAIN output mode
  if (process.env.MARIA_PLAIN_OUTPUT === '1' || process.env.MARIA_DISABLE_GUIDED_FLOW === '1') {
    // In PLAIN mode, don't return a template - let the LLM answer properly
    // This function should not be called in PLAIN mode
    // Return empty string to let the AI response service handle it
    return "";
  }

  // Acknowledgment
  const cleanQuestion = cleanUserInput(question);
  parts.push(
    isJapanese
      ? `ご質問ありがとうございます。「${cleanQuestion}」について説明します。`
      : `Great question about "${cleanQuestion}". Let me explain.`,
  );
  parts.push("");

  // Structure preview
  parts.push(
    createSectionHeader(isJapanese ? "回答の構成" : "Answer Structure", 3),
  );
  parts.push("");

  const structure = isJapanese
    ? [
        "背景と基本概念",
        "実装方法(最小例)",
        "ベストプラクティスと注意点",
        "実際の使用例",
      ]
    : [
        "Background & Concepts",
        "Implementation (minimal example)",
        "Best practices & pitfalls",
        "Real-world use cases",
      ];

  parts.push(formatList(structure, true));
  parts.push("");

  // Quick answer section
  parts.push(
    createSectionHeader(isJapanese ? "簡潔な回答" : "Quick Answer", 3),
  );
  parts.push("");
  parts.push(generateQuickAnswer(question, isJapanese, topics));
  parts.push("");

  // Example code if applicable
  if (includeExample && shouldIncludeCode(question)) {
    parts.push(
      createSectionHeader(isJapanese ? "コード例" : "Code Example", 3),
    );
    parts.push("");
    parts.push(generateExampleCode(topics));
    parts.push("");
  }

  // Next steps prompt
  parts.push(
    createSectionHeader(
      isJapanese ? "詳細を知りたい場合" : "Want to know more?",
      3,
    ),
  );
  parts.push("");

  const detailOptions = isJapanese
    ? [
        "詳細な実装例を見る",
        "関連する概念を学ぶ",
        "トラブルシューティング",
        "実際のプロジェクトへの適用",
      ]
    : [
        "See detailed implementation",
        "Learn related concepts",
        "Troubleshooting guide",
        "Apply to real project",
      ];

  parts.push(formatList(detailOptions, true));
  parts.push("");

  // Footer with action prompt
  parts.push(
    isJapanese
      ? "番号を選んで詳細を確認するか、追加の質問をしてください。"
      : "Choose a number for details or ask a follow-up question.",
  );

  return parts.join("\n");
}

/**
 * Generate a quick answer based on question type
 * @param question - Original question
 * @param isJapanese - Language preference
 * @param topics - Detected topics
 * @returns Quick answer text
 */
function generateQuickAnswer(
  question: string,
  isJapanese: boolean,
  topics: string[],
): string {
  const lowerQuestion = question.toLowerCase();

  // Check for common question patterns
  if (lowerQuestion.includes("difference") || lowerQuestion.includes("違い")) {
    return isJapanese
      ? "主な違いは、目的と使用場面にあります。それぞれの特徴を比較すると..."
      : "The main difference lies in their purpose and use cases. Comparing their features...";
  }

  if (lowerQuestion.includes("how to") || lowerQuestion.includes("方法")) {
    return isJapanese
      ? "実装するには、以下の手順に従います:1) 準備、2) 実装、3) テスト"
      : "To implement this, follow these steps: 1) Setup, 2) Implementation, 3) Testing";
  }

  if (lowerQuestion.includes("why") || lowerQuestion.includes("なぜ")) {
    return isJapanese
      ? "これには技術的な理由と実用的な理由があります。主な理由は..."
      : "There are both technical and practical reasons. The main reasons are...";
  }

  if (lowerQuestion.includes("when") || lowerQuestion.includes("いつ")) {
    return isJapanese
      ? "使用するタイミングは、特定の条件が揃った時です。具体的には..."
      : "Use this when specific conditions are met. Specifically...";
  }

  // Default response
  return isJapanese
    ? `${topics.length > 0 ? topics[0] + "に関して、" : ""}重要なポイントをまとめると...`
    : `${topics.length > 0 ? "Regarding " + topics[0] + ", " : ""}The key points are...`;
}

/**
 * Check if code example should be included
 * @param question - Original question
 * @returns Whether to include code
 */
function shouldIncludeCode(question: string): boolean {
  const codeIndicators = [
    "implement",
    "code",
    "example",
    "how to",
    "実装",
    "コード",
    "例",
    "方法",
    "サンプル",
  ];

  const lower = question.toLowerCase();
  return codeIndicators.some((indicator) => lower.includes(indicator));
}

/**
 * Generate example code based on topics
 * @param topics - Detected topics
 * @returns Code example
 */
function generateExampleCode(topics: string[]): string {
  // Simple example based on detected topics
  if (topics.includes("react")) {
    return `\`\`\`tsx
const MyComponent = ({ title }: { title: string }) => {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
    </div>
  );
};
\`\`\``;
  }

  if (topics.includes("api")) {
    return `\`\`\`typescript
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(404).json({ error: 'User not found' });
  }
});
\`\`\``;
  }

  // Generic example
  return `\`\`\`typescript
// Example implementation
function solution(input: string): string {
  // Process input
  const processed = input.trim().toLowerCase();
  
  // Apply logic
  const result = processData(processed);
  
  // Return result
  return result;
}
\`\`\``;
}

/**
 * Build a comprehensive Q&A response
 * @param question - User's question
 * @param detectedTopics - Topics from context
 * @param isJapanese - Language preference
 * @returns Complete Q&A response
 */
export function buildComprehensiveAnswer(
  question: string,
  detectedTopics: string[],
  isJapanese: boolean,
): string {
  return buildQuestionResponse({
    question,
    isJapanese,
    topics: detectedTopics,
    includeExample: true,
  });
}
