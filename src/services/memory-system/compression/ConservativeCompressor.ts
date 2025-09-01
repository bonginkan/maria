/**
 * Conservative Compressor
 * Minimal compression - focuses on removing redundancy while preserving structure
 */

export interface CompressedResult<T> {
  messages: T[];
  metadata?: {
    originalCount: number;
    removedCount: number;
    compressionRatio: number;
  };
}

export class ConservativeCompressor {
  /**
   * Remove duplicate messages while preserving order
   */
  removeRedundancy<T extends { content: string }>(msgs: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];

    for (const m of msgs) {
      const normalized = this.normalizeContent(m.content);

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      out.push(m);
    }

    return out;
  }

  /**
   * Compress messages conservatively
   */
  compress<T extends { content: string }>(msgs: T[]): CompressedResult<T> {
    const original = msgs.length;
    const deduplicated = this.removeRedundancy(msgs);
    const compressed = this.removeNoise(deduplicated);

    return {
      messages: compressed,
      metadata: {
        originalCount: original,
        removedCount: original - compressed.length,
        compressionRatio: original > 0 ? compressed.length / original : 1,
      },
    };
  }

  /**
   * Build a full-text index for quick searching
   */
  buildIndex<T extends { content: string }>(msgs: T[]): Map<string, number[]> {
    const index = new Map<string, number[]>();

    msgs.forEach((msg, idx) => {
      const tokens = this.tokenize(msg.content);

      for (const token of tokens) {
        if (!index.has(token)) {
          index.set(token, []);
        }
        index.get(token)!.push(idx);
      }
    });

    return index;
  }

  /**
   * Extract metadata from messages
   */
  extractMetadata<T extends { content: string; timestamp?: string | Date }>(
    msgs: T[],
  ): {
    totalMessages: number;
    uniqueMessages: number;
    timeRange?: { start: Date; end: Date };
    averageLength: number;
    topics: string[];
  } {
    const unique = this.removeRedundancy(msgs);
    const lengths = msgs.map((m) => m.content.length);
    const avgLength =
      lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);

    // Extract time range if timestamps exist
    let timeRange;
    const timestamps = msgs
      .filter((m) => m.timestamp)
      .map((m) => new Date(m.timestamp!));

    if (timestamps.length > 0) {
      timestamps.sort((a, b) => a.getTime() - b.getTime());
      timeRange = {
        start: timestamps[0],
        end: timestamps[timestamps.length - 1],
      };
    }

    // Extract topics (simple keyword extraction)
    const topics = this.extractTopics(msgs);

    return {
      totalMessages: msgs.length,
      uniqueMessages: unique.length,
      timeRange,
      averageLength: Math.round(avgLength),
      topics,
    };
  }

  // Helper methods

  private normalizeContent(content: string): string {
    return content
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/[^\w\s]/g, ""); // Remove punctuation for comparison
  }

  private removeNoise<T extends { content: string }>(msgs: T[]): T[] {
    return msgs.filter((msg) => {
      const content = msg.content.trim();

      // Remove empty or very short messages
      if (content.length < 3) return false;

      // Remove messages that are just punctuation/whitespace
      if (!/\w/.test(content)) return false;

      // Keep everything else
      return true;
    });
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.replace(/[^\w]/g, ""))
      .filter((token) => token.length > 2); // Ignore very short tokens
  }

  private extractTopics<T extends { content: string }>(msgs: T[]): string[] {
    const wordFreq = new Map<string, number>();

    // Count word frequencies
    for (const msg of msgs) {
      const tokens = this.tokenize(msg.content);

      for (const token of tokens) {
        // Skip common stop words
        if (this.isStopWord(token)) continue;

        wordFreq.set(token, (wordFreq.get(token) || 0) + 1);
      }
    }

    // Get top 10 words as topics
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the",
      "is",
      "at",
      "which",
      "on",
      "a",
      "an",
      "as",
      "are",
      "was",
      "were",
      "be",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "what",
      "where",
      "when",
      "why",
      "how",
      "all",
      "each",
      "every",
      "both",
      "few",
      "more",
      "most",
      "other",
      "some",
      "such",
      "only",
      "own",
      "same",
      "so",
      "than",
      "too",
      "very",
      "just",
      "in",
      "out",
      "to",
      "from",
      "up",
      "down",
      "off",
      "over",
      "under",
      "again",
      "further",
      "then",
      "once",
      "and",
      "but",
      "or",
      "not",
    ]);

    return stopWords.has(word.toLowerCase());
  }
}
