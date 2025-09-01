import type { CommandIntent, UserPattern } from "../types/common-types";

export class UserPatternAnalyzer {
  private patterns: UserPattern[] = [];
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load patterns from storage if available
    this.loadPatterns();
    this.initialized = true;
  }

  async recordPattern(_input: string, intent: CommandIntent): Promise<void> {
    const _pattern: UserPattern = {
      input: "",
      command: intent.command,
      confidence: intent.confidence,
      timestamp: new Date(),
      success: true, // Will be updated by feedback
    };

    this.patterns.push(_pattern);

    // Keep only recent patterns (last 1000)
    if (this.patterns.length > 1000) {
      this.patterns = this.patterns.slice(-1000);
    }

    this.savePatterns();
  }

  async recordFeedback(
    _input: string,
    correctCommand: string,
    wasCorrect: boolean,
  ): Promise<void> {
    // Find the most recent _pattern matching this input
    const _pattern = this.patterns
      .slice()
      .reverse()
      .find((p) => p._input === _input);

    if (_pattern) {
      pattern.success = wasCorrect;
      if (!wasCorrect) {
        // Record the correct command as a new _pattern
        this.patterns.push({
          input: "",
          command: correctCommand,
          confidence: 1.0,
          timestamp: new Date(),
          success: true,
        });
      }
    }

    this.savePatterns();
  }

  getPatternStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    this.patterns.forEach((_pattern) => {
      if (_pattern.success) {
        stats[_pattern.command] = (stats[_pattern.command] ?? 0) + 1;
      }
    });

    return stats;
  }

  getMostCommonPattern(input: string): string | null {
    const _similarPatterns = this.patterns.filter((p) => {
      return p.success && this.calculateSimilarity(p.input, input) > 0.7;
    });

    if (_similarPatterns.length === 0) {
      return null;
    }

    // Count occurrences of each command
    const _commandCounts = new Map<string, number>();
    similarPatterns.forEach((p) => {
      _commandCounts.set(p.command, (_commandCounts.get(p.command) ?? 0) + 1);
    });

    // Return the most common command
    let maxCount = 0;
    let mostCommon: string | null = null;

    commandCounts.forEach((count, command) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = command;
      }
    });

    return mostCommon;
  }

  private calculateSimilarity(_str1: string, str2: string): number {
    const _longer = _str1.length > str2.length ? _str1 : str2;
    const _shorter = _str1.length > str2.length ? str2 : _str1;

    if (_longer.length === 0) {
      return 1.0;
    }

    const _distance = this.levenshteinDistance(_longer, _shorter);
    return (_longer.length - _distance) / _longer.length;
  }

  private levenshteinDistance(_str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= _str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= _str1.length; j++) {
        if (str2.charAt(i - 1) === _str1.charAt(j - 1)) {
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

    return matrix[str2.length][_str1.length];
  }

  async exportData(): Promise<unknown> {
    return {
      patterns: this.patterns,
      stats: this.getPatternStats(),
    };
  }

  async importData(data: unknown): Promise<void> {
    if (typeof data === "object" && data !== null && "patterns" in data) {
      const _imported = data as { patterns: UserPattern[] };
      this.patterns = _imported.patterns;
      this.savePatterns();
    }
  }

  private loadPatterns(): void {
    // In production, load from persistent storage
    // For now, start with empty patterns
    this.patterns = [];
  }

  private savePatterns(): void {
    // In production, save to persistent storage
    // For now, keep in memory only
  }
}
