/**
 * Common Response Utilities
 * Shared utilities for all responders including footer generation
 */

/**
 * Generate common footer with next action choices
 * @param isJapanese - Whether to use Japanese language
 * @param customOptions - Custom options to display
 * @returns Footer text with numbered choices
 */
export function generateFooter(
  isJapanese: boolean,
  customOptions?: string[],
): string {
  if (customOptions && customOptions.length > 0) {
    const numbered = customOptions
      .map((opt, i) => `${i + 1}) ${opt}`)
      .join("  ");
    return isJapanese
      ? `\n---\n次のステップ: ${numbered}\n番号で指示してください。`
      : `\n---\nNext steps: ${numbered}\nReply with a number.`;
  }

  // Default footer options
  return isJapanese
    ? "\n---\n次に進める項目: 1) 最小で動かす  2) 設計を固める  3) 既存コードに適用\n番号で指示してください。"
    : "\n---\nNext: 1) Run minimal  2) Lock design  3) Apply to existing\nReply with a number.";
}

/**
 * Format file block for code display
 * @param path - File path
 * @param lang - Language identifier for syntax highlighting
 * @param content - File content
 * @returns Formatted markdown code block
 */
export function formatFileBlock(
  _path: string,
  lang: string,
  content: string,
): string {
  return `**${_path}**\n\`\`\`${lang}\n${content}\n\`\`\``;
}

/**
 * Generate satisfaction feedback prompt
 * @param isJapanese - Whether to use Japanese language
 * @returns Feedback prompt with emoji buttons
 */
export function generateFeedbackPrompt(isJapanese: boolean): string {
  return isJapanese
    ? "\n\n役に立ちましたか？ 👍 良い | 👎 改善が必要 | 💭 期待と違う"
    : "\n\nWas this helpful? 👍 Good | 👎 Needs improvement | 💭 Not what I expected";
}

/**
 * Create section header with consistent formatting
 * @param title - Section title
 * @param level - Header level (1-3)
 * @returns Formatted header
 */
export function createSectionHeader(
  title: string,
  level: 1 | 2 | 3 = 2,
): string {
  const prefix = "#".repeat(level);
  return `${prefix} ${title}`;
}

/**
 * Format bullet list with consistent style
 * @param items - List items
 * @param ordered - Whether to use ordered list
 * @returns Formatted list
 */
export function formatList(items: string[], ordered: boolean = false): string {
  return items
    .map((_item, i) => (ordered ? `${i + 1}. ${_item}` : `• ${_item}`))
    .join("\n");
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Clean and format user input for display
 * @param input - Raw user input
 * @returns Cleaned input
 */
export function cleanUserInput(input: string): string {
  return input.trim().replace(/\s+/g, " ").substring(0, 100);
}
