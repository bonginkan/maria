/**
 * Context Management System - Token Budget and Conversation Summary
 * Manages conversation history with efficient token/character budgeting
 */

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number | Date;
}

export interface SlimContext {
  recentMessages: Message[];
  rollingSummary?: string;
  totalChars: number;
  messageCount: number;
}

export interface ContextOptions {
  budgetChars?: number; // Character budget (default: 8000)
  maxMessages?: number; // Max messages to keep (default: 20)
  summaryThreshold?: number; // Messages before summarizing (default: 6)
}

/**
 * Build optimized context for AI provider with token budget management
 * @param sessionMemory - Full conversation history
 * @param options - Context building options
 * @returns Optimized context within budget
 */
export function buildContextForAI(
  sessionMemory: Message[],
  options: ContextOptions = {},
): SlimContext {
  const {
    budgetChars = 8000,
    maxMessages = 20,
    summaryThreshold = 6,
  } = options;

  // Start from most recent messages and work backwards
  const reversed = [...sessionMemory].reverse();
  const recentMessages: Message[] = [];
  let totalChars = 0;
  let messageCount = 0;

  // Build recent messages within budget
  for (const msg of reversed) {
    const content = msg.content || "";
    const msgLength = content.length;

    // Stop if adding this message would exceed budget or max messages
    if (totalChars + msgLength > budgetChars || messageCount >= maxMessages) {
      break;
    }

    recentMessages.push({
      role: msg.role,
      content: content,
      timestamp: msg.timestamp,
    });
    totalChars += msgLength;
    messageCount++;
  }

  // Reverse to restore chronological order
  recentMessages.reverse();

  // Create rolling summary for older messages if needed
  let rollingSummary: string | undefined;

  if (
    sessionMemory.length > summaryThreshold &&
    recentMessages.length < sessionMemory.length
  ) {
    // Get messages that didn't fit in recent context
    const olderMessages = sessionMemory.slice(
      0,
      sessionMemory.length - recentMessages.length,
    );
    rollingSummary = createRollingSummary(olderMessages, 1200); // 1200 chars for summary
  }

  return {
    recentMessages,
    rollingSummary,
    totalChars,
    messageCount,
  };
}

/**
 * Create a compressed summary of older messages
 * @param messages - Messages to summarize
 * @param maxChars - Maximum characters for summary
 * @returns Compressed summary string
 */
function createRollingSummary(messages: Message[], maxChars: number): string {
  const summaryParts: string[] = [];
  let currentLength = 0;

  // Create brief summaries of each message
  for (const msg of messages) {
    const role = msg.role === "user" ? "U" : "A";
    const preview = msg.content.substring(0, 100).replace(/\n/g, " ");
    const summary = `${role}: ${preview}${msg.content.length > 100 ? "..." : ""}`;

    if (currentLength + summary.length > maxChars) {
      break;
    }

    summaryParts.push(summary);
    currentLength += summary.length + 1; // +1 for newline
  }

  return summaryParts.join("\n");
}

/**
 * Extract key topics from conversation context
 * @param context - Slim context
 * @returns Array of key topics/themes
 */
export function extractKeyTopics(context: SlimContext): string[] {
  const topics = new Set<string>();
  const allText = context.recentMessages
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  // Programming language detection
  const languages = [
    "typescript",
    "javascript",
    "python",
    "java",
    "go",
    "rust",
    "react",
    "vue",
    "angular",
  ];
  languages.forEach((lang) => {
    if (allText.includes(lang)) topics.add(lang);
  });

  // Framework/tool detection
  const tools = [
    "next.js",
    "nextjs",
    "express",
    "fastapi",
    "django",
    "spring",
    "docker",
    "kubernetes",
  ];
  tools.forEach((tool) => {
    if (allText.includes(tool)) topics.add(tool);
  });

  // Common programming concepts
  const concepts = [
    "api",
    "database",
    "authentication",
    "testing",
    "deployment",
    "frontend",
    "backend",
  ];
  concepts.forEach((concept) => {
    if (allText.includes(concept)) topics.add(concept);
  });

  return Array.from(topics);
}

/**
 * Calculate context statistics for telemetry
 * @param context - Slim context
 * @returns Context statistics
 */
export function getContextStats(context: SlimContext) {
  return {
    messageCount: context.messageCount,
    totalChars: context.totalChars,
    hasSummary: !!context.rollingSummary,
    avgMessageLength: context.totalChars / (context.messageCount || 1),
    topics: extractKeyTopics(context),
  };
}

/**
 * Format context for display or debugging
 * @param context - Slim context
 * @returns Formatted string representation
 */
export function formatContext(context: SlimContext): string {
  const parts: string[] = [];

  if (context.rollingSummary) {
    parts.push("=== Previous Summary ===");
    parts.push(context.rollingSummary);
    parts.push("");
  }

  parts.push("=== Recent Messages ===");
  context.recentMessages.forEach((msg) => {
    parts.push(`${msg.role.toUpperCase()}: ${msg.content}`);
    parts.push("");
  });

  parts.push(
    `=== Stats: ${context.messageCount} messages, ${context.totalChars} chars ===`,
  );

  return parts.join("\n");
}
