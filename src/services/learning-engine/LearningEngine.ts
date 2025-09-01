/**
 * Phase 4.1 Learning Engine - Main Entry Point
 * Orchestrates pattern detection, context tracking, and suggestion generation
 */

import { SuggestionEngine } from "./core/SuggestionEngine";
import { PatternStore } from "./storage/PatternStore";
import type {
  UserAction,
  SimpleContext,
  Suggestion,
  LearningStats,
  Pattern,
} from "./types/learning.types";

export class LearningEngine {
  private suggestionEngine: SuggestionEngine;
  private patternStore: PatternStore;
  private isInitialized = false;

  constructor() {
    this.suggestionEngine = new SuggestionEngine();
    this.patternStore = new PatternStore();
  }

  /**
   * Initialize the learning engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.patternStore.initialize();
    this.isInitialized = true;

    console.debug("🧠 Learning Engine initialized");
  }

  /**
   * Record a user action for learning
   */
  async recordAction(action: UserAction): Promise<void> {
    await this.ensureInitialized();

    // Record with suggestion engine (handles pattern detection and context tracking)
    await this.suggestionEngine.recordAction(action);

    // Get any new _patterns and store them
    const _patterns = this.suggestionEngine.exportPatterns();
    for (const pattern of _patterns) {
      await this.patternStore.storePattern(pattern);
    }
  }

  /**
   * Get pattern-based _suggestions for current context
   */
  getPatternSuggestions(context: SimpleContext): Suggestion[] {
    if (!this.isInitialized) {
      console.warn(
        "Learning engine not initialized, using fallback _suggestions",
      );
      return this.getFallbackSuggestions(context);
    }

    return this.suggestionEngine.getPatternSuggestions(context);
  }

  /**
   * Report whether a suggestion was used (for learning feedback)
   */
  reportSuggestionUsed(command: string, wasAccepted: boolean): void {
    this.suggestionEngine.reportSuggestionUsed(command, wasAccepted);
  }

  /**
   * Get learning statistics
   */
  getStats(): LearningStats {
    if (!this.isInitialized) {
      return {
        totalPatterns: 0,
        averageConfidence: 0,
        suggestionsGenerated: 0,
        patternHitRate: 0,
      };
    }

    return this.suggestionEngine.getStats();
  }

  /**
   * Clear all learned data
   */
  async clearHistory(): Promise<void> {
    await this.ensureInitialized();

    this.suggestionEngine.clearHistory();
    await this.patternStore.clearAll();
  }

  /**
   * Export learned _patterns for analysis
   */
  async exportPatterns(): Promise<Pattern[]> {
    await this.ensureInitialized();
    return await this.patternStore.getAllPatterns();
  }

  /**
   * Get _patterns matching specific criteria
   */
  async findPatterns(criteria: {
    command?: string;
    minConfidence?: number;
    maxAge?: number;
  }): Promise<Pattern[]> {
    await this.ensureInitialized();
    return await this.patternStore.findPatterns(criteria);
  }

  /**
   * CLI helper - format _suggestions for display
   */
  formatSuggestionsForCLI(context: SimpleContext): string {
    const _suggestions = this.getPatternSuggestions(context);
    return this.suggestionEngine.formatSuggestionsForCLI(_suggestions);
  }

  /**
   * CLI integration - suggest commands after a given command
   */
  async suggestAfter(
    _command: string,
    cwd: string = process.cwd(),
  ): Promise<string> {
    const context: SimpleContext = {
      _lastCommand: _command,
      cwd,
      recentCommands: [_command],
    };

    const _suggestions = this.getPatternSuggestions(context);

    if (_suggestions.length === 0) {
      return `💡 No _patterns found for "${_command}" yet. Keep using commands to build learning data!`;
    }

    let output = `💡 After "${_command}", you usually run:\n`;
    suggestions.slice(0, 3).forEach((suggestion, index) => {
      const _confidence = Math.round(suggestion._confidence * 100);
      const _icon =
        suggestion.source === "pattern"
          ? "🧩"
          : suggestion.source === "context"
            ? "📁"
            : "🔄";

      output += `  ${index + 1}. ${suggestion._command} ${_icon} (${_confidence}%)\n`;
    });

    return output.trim();
  }

  /**
   * Get storage and performance statistics
   */
  async getDetailedStats() {
    await this.ensureInitialized();

    const _learningStats = this.getStats();
    const _storageStats = await this.patternStore.getStats();

    return {
      learning: _learningStats,
      storage: {
        totalPatterns: _storageStats.totalPatterns,
        storageSize: _storageStats.storageSize,
        averageConfidence:
          Math.round(_storageStats.averageConfidence * 1000) / 1000,
        isDirty: _storageStats.isDirty,
      },
      system: {
        initialized: this.isInitialized,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      },
    };
  }

  /**
   * Ensure learning engine is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Fallback _suggestions when engine is not initialized
   */
  private getFallbackSuggestions(context: SimpleContext): Suggestion[] {
    const _lastCommand = context._lastCommand?.toLowerCase() || "";

    const fallbackMap: Record<string, string> = {
      "git add": "git commit",
      "git commit": "git push",
      "npm install": "npm start",
      "npm test": "npm run build",
      "pnpm install": "pnpm dev",
      "yarn install": "yarn start",
    };

    const _nextCommand = fallbackMap[_lastCommand];
    if (_nextCommand) {
      return [
        {
          command: _nextCommand,
          _confidence: 0.6,
          source: "fallback",
          reasoning: "Common command sequence",
        },
      ];
    }

    return [];
  }
}

// Export types for external use
export type {
  UserAction,
  SimpleContext,
  Suggestion,
  LearningStats,
  Pattern,
} from "./types/learning.types";
