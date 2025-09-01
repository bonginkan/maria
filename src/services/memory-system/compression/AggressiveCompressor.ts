/**
 * Aggressive Compressor
 * Maximum compression - keeps only essential information
 */

export interface AggressiveCompressedResult {
  head: any[];
  tail: any[];
  keywords: string[];
  messageCount: number;
  summary?: string;
}

export class AggressiveCompressor {
  private readonly headSize: number;
  private readonly tailSize: number;
  private readonly maxKeywords: number;

  constructor(options?: {
    headSize?: number;
    tailSize?: number;
    maxKeywords?: number;
  }) {
    this.headSize = options?.headSize || 5;
    this.tailSize = options?.tailSize || 5;
    this.maxKeywords = options?.maxKeywords || 64;
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text: string): string[] {
    // Extract all word-like tokens (including CJK)
    const tokens =
      text
        .toLowerCase()
        .match(
          /[a-z0-9]+|[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+/g,
        ) || [];

    // Count frequencies
    const freq = new Map<string, number>();
    for (const token of tokens) {
      if (token.length < 3) continue; // Skip very short words
      freq.set(token, (freq.get(token) || 0) + 1);
    }

    // Sort by frequency and return top N
    return Array.from(freq.entries())
      .filter(([word]) => !this.isCommonWord(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.maxKeywords)
      .map(([word]) => word);
  }

  /**
   * Aggressively compress messages
   */
  compress<T extends { content: string }>(
    msgs: T[],
  ): AggressiveCompressedResult {
    if (msgs.length === 0) {
      return {
        head: [],
        tail: [],
        keywords: [],
        messageCount: 0,
      };
    }

    // Keep first and last N messages
    const head = msgs.slice(0, this.headSize);
    const tail =
      msgs.length > this.headSize + this.tailSize
        ? msgs.slice(-this.tailSize)
        : [];

    // Extract keywords from all messages
    const allText = msgs.map((m) => m.content).join(" ");
    const keywords = this.extractKeywords(allText);

    // Generate ultra-compressed summary
    const summary = this.generateMinimalSummary(msgs);

    return {
      head,
      tail,
      keywords,
      messageCount: msgs.length,
      summary,
    };
  }

  /**
   * Generate a minimal summary
   */
  generateMinimalSummary<T extends { content: string }>(msgs: T[]): string {
    if (msgs.length === 0) return "";

    // Extract key statistics
    const stats = {
      messages: msgs.length,
      avgLength: Math.round(
        msgs.reduce((sum, m) => sum + m.content.length, 0) / msgs.length,
      ),
      hasCode: msgs.some((m) => this.containsCode(m.content)),
      hasError: msgs.some((m) => this.containsError(m.content)),
      hasQuestion: msgs.some((m) => this.isQuestion(m.content)),
    };

    // Build minimal summary
    const parts: string[] = [`${stats.messages} msgs`];

    if (stats.hasCode) parts.push("code");
    if (stats.hasError) parts.push("errors");
    if (stats.hasQuestion) parts.push("Q&A");

    // Add dominant topics
    const topics = this.extractTopics(msgs).slice(0, 3);
    if (topics.length > 0) {
      parts.push(`[${topics.join(", ")}]`);
    }

    return parts.join(" | ");
  }

  /**
   * Create a digest of messages for quick reference
   */
  createDigest<T extends { content: string; timestamp?: string | Date }>(
    msgs: T[],
  ): string {
    const lines: string[] = [];

    // Header
    lines.push(`=== Digest of ${msgs.length} messages ===`);

    // Time range if available
    const timestamps = msgs
      .filter((m) => m.timestamp)
      .map((m) => new Date(m.timestamp!));

    if (timestamps.length > 0) {
      timestamps.sort((a, b) => a.getTime() - b.getTime());
      const start = timestamps[0].toISOString().split("T")[0];
      const end = timestamps[timestamps.length - 1].toISOString().split("T")[0];
      lines.push(`Period: ${start} to ${end}`);
    }

    // Key points (first line of each important message)
    lines.push("\nKey points:");
    const important = this.selectImportantMessages(msgs);
    for (const msg of important.slice(0, 5)) {
      const firstLine = msg.content.split("\n")[0].substring(0, 80);
      lines.push(`• ${firstLine}${msg.content.length > 80 ? "..." : ""}`);
    }

    // Keywords
    const keywords = this.extractKeywords(msgs.map((m) => m.content).join(" "));
    lines.push(`\nKeywords: ${keywords.slice(0, 10).join(", ")}`);

    return lines.join("\n");
  }

  // Helper methods

  private isCommonWord(word: string): boolean {
    const common = new Set([
      "the",
      "be",
      "to",
      "of",
      "and",
      "a",
      "in",
      "that",
      "have",
      "i",
      "it",
      "for",
      "not",
      "on",
      "with",
      "he",
      "as",
      "you",
      "do",
      "at",
      "this",
      "but",
      "his",
      "by",
      "from",
      "they",
      "we",
      "say",
      "her",
      "she",
      "or",
      "an",
      "will",
      "my",
      "one",
      "all",
      "would",
      "there",
      "their",
      "what",
      "so",
      "up",
      "out",
      "if",
      "about",
      "who",
      "get",
      "which",
      "go",
      "me",
      "when",
      "make",
      "can",
      "like",
      "time",
      "no",
      "just",
      "him",
      "know",
      "take",
      "people",
      "into",
      "year",
      "your",
      "good",
      "some",
      "could",
      "them",
      "see",
      "other",
      "than",
      "then",
      "now",
      "look",
      "only",
      "come",
      "its",
      "over",
    ]);

    return common.has(word.toLowerCase());
  }

  private containsCode(text: string): boolean {
    const codePatterns = [
      /```[\s\S]*?```/, // Code blocks
      /^\s*(function|class|const|let|var|import|export)\b/m, // JS/TS keywords
      /^\s*(def|class|import|from)\b/m, // Python keywords
      /[{}[\]();]/, // Code punctuation
      /^\s*\/\//m, // Comments
    ];

    return codePatterns.some((pattern) => pattern.test(text));
  }

  private containsError(text: string): boolean {
    const errorPatterns = [
      /error|exception|fail|crash|bug/i,
      /stack trace/i,
      /^\s*at\s+\w+/m, // Stack trace lines
      /\b\d{3,4}\s+error\b/i, // HTTP error codes
    ];

    return errorPatterns.some((pattern) => pattern.test(text));
  }

  private isQuestion(text: string): boolean {
    return (
      /\?[\s]*$/.test(text.trim()) ||
      /^(what|where|when|why|how|who|is|are|can|could|would|should)\b/i.test(
        text.trim(),
      )
    );
  }

  private extractTopics<T extends { content: string }>(msgs: T[]): string[] {
    const allText = msgs.map((m) => m.content).join(" ");
    const keywords = this.extractKeywords(allText);

    // Group related keywords (simple clustering)
    const topics: string[] = [];
    const used = new Set<string>();

    for (const keyword of keywords.slice(0, 20)) {
      if (used.has(keyword)) continue;

      // Find related words
      const related = keywords.filter(
        (k) =>
          !used.has(k) &&
          (k.includes(keyword) ||
            keyword.includes(k) ||
            this.areRelated(keyword, k)),
      );

      if (related.length > 1) {
        topics.push(related[0]);
        related.forEach((r) => used.add(r));
      }
    }

    return topics;
  }

  private areRelated(word1: string, word2: string): boolean {
    // Simple relatedness check (can be improved with embeddings)
    const distance = this.levenshteinDistance(word1, word2);
    return distance <= Math.min(word1.length, word2.length) * 0.3;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private selectImportantMessages<T extends { content: string }>(
    msgs: T[],
  ): T[] {
    return msgs.filter((msg) => {
      const content = msg.content;

      // Important if contains error
      if (this.containsError(content)) return true;

      // Important if contains code
      if (this.containsCode(content)) return true;

      // Important if it's a question
      if (this.isQuestion(content)) return true;

      // Important if it's long (likely detailed)
      if (content.length > 500) return true;

      // Important if contains numbers (likely data/metrics)
      if (/\b\d+\.?\d*\b/.test(content)) return true;

      return false;
    });
  }
}
