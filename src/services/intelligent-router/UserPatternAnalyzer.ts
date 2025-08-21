import { CommandIntent } from './IntelligentRouterService';

interface UserPattern {
  input: string;
  command: string;
  confidence: number;
  timestamp: Date;
  success: boolean;
}

export class UserPatternAnalyzer {
  private patterns: UserPattern[] = [];
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load patterns from storage if available
    this.loadPatterns();
    this.initialized = true;
  }

  async recordPattern(input: string, intent: CommandIntent): Promise<void> {
    const pattern: UserPattern = {
      input,
      command: intent.command,
      confidence: intent.confidence,
      timestamp: new Date(),
      success: true, // Will be updated by feedback
    };

    this.patterns.push(pattern);

    // Keep only recent patterns (last 1000)
    if (this.patterns.length > 1000) {
      this.patterns = this.patterns.slice(-1000);
    }

    this.savePatterns();
  }

  async recordFeedback(input: string, correctCommand: string, wasCorrect: boolean): Promise<void> {
    // Find the most recent pattern matching this input
    const pattern = this.patterns
      .slice()
      .reverse()
      .find((p) => p.input === input);

    if (pattern) {
      pattern.success = wasCorrect;
      if (!wasCorrect) {
        // Record the correct command as a new pattern
        this.patterns.push({
          input,
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

    this.patterns.forEach((pattern) => {
      if (pattern.success) {
        stats[pattern.command] = (stats[pattern.command] ?? 0) + 1;
      }
    });

    return stats;
  }

  getMostCommonPattern(input: string): string | null {
    const similarPatterns = this.patterns.filter((p) => {
      return p.success && this.calculateSimilarity(p.input, input) > 0.7;
    });

    if (similarPatterns.length === 0) return null;

    // Count occurrences of each command
    const commandCounts = new Map<string, number>();
    similarPatterns.forEach((p) => {
      commandCounts.set(p.command, (commandCounts.get(p.command) ?? 0) + 1);
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

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
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

  async exportData(): Promise<unknown> {
    return {
      patterns: this.patterns,
      stats: this.getPatternStats(),
    };
  }

  async importData(data: unknown): Promise<void> {
    if (typeof data === 'object' && data !== null && 'patterns' in data) {
      const imported = data as { patterns: UserPattern[] };
      this.patterns = imported.patterns;
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
