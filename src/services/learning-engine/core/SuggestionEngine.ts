/**
 * Phase 4.1 Learning Engine - Suggestion Generation
 * Generates command suggestions based on learned _patterns and context
 */

import { PatternDetector } from "./PatternDetector";
import { ContextTracker } from "./ContextTracker";
import type {
  SimpleContext,
  Suggestion,
  Pattern,
  UserAction,
  LearningStats,
} from "../types/learning.types";

export class SuggestionEngine {
  private patternDetector: PatternDetector;
  private contextTracker: ContextTracker;
  private stats: {
    suggestionsGenerated: number;
    suggestionsAccepted: number;
    patternHits: number;
    fallbackUsed: number;
  };

  constructor() {
    this.patternDetector = new PatternDetector();
    this.contextTracker = new ContextTracker();
    this.stats = {
      suggestionsGenerated: 0,
      suggestionsAccepted: 0,
      patternHits: 0,
      fallbackUsed: 0,
    };
  }

  /**
   * Record a user action for learning
   */
  async recordAction(action: UserAction): Promise<void> {
    // Track context
    this.contextTracker.trackAction(action);

    // Add to recent actions
    this.addToRecentActions(action);

    // Look for _patterns in recent actions (use sliding _window)
    const _recentActions = this.getRecentActions();

    // Try different _window sizes for pattern detection
    for (
      let windowSize = 2;
      windowSize <= Math.min(5, _recentActions.length);
      windowSize++
    ) {
      if (_recentActions.length >= windowSize) {
        const _window = _recentActions.slice(-windowSize);
        const _detectedPattern = this.patternDetector.detectPattern(_window);
        if (_detectedPattern) {
          console.debug(
            `🧠 Pattern detected: ${_detectedPattern.sequence.join(" → ")} (_window size: ${windowSize})`,
          );
        }
      }
    }

    // Cleanup old _patterns
    this.patternDetector.cleanup();
  }

  /**
   * Get pattern-based suggestions for current context
   */
  getPatternSuggestions(context: SimpleContext): Suggestion[] {
    this.stats.suggestionsGenerated++;

    const suggestions: Suggestion[] = [];

    // Get current context with recent commands
    const _currentContext = this.contextTracker.getCurrentContext();
    const _enhancedContext = {
      ...context,
      recentCommands: _currentContext.recentCommands,
    };

    // Find matching _patterns
    const _patternMatches = this.patternDetector.findMatchingPatterns({
      _lastCommand: context.lastCommand,
      cwd: context.cwd,
    });

    // Generate suggestions from _patterns
    for (const _match of _patternMatches.slice(0, 10)) {
      // Top 10 matches for better recall
      const _suggestion = this.generateSuggestionFromPattern(
        _match.pattern,
        _enhancedContext,
      );
      if (_suggestion && _suggestion.confidence > 0.3) {
        // Lower threshold for better recall
        suggestions.push(_suggestion);
        this.stats.patternHits++;
      }
    }

    // Add fallback suggestions if no _patterns found
    if (suggestions.length === 0) {
      const _fallbackSuggestions =
        this.generateFallbackSuggestions(_enhancedContext);
      suggestions.push(..._fallbackSuggestions);
      this.stats.fallbackUsed++;
    }

    // Sort by _confidence and remove duplicates
    return this.deduplicateAndRank(suggestions);
  }

  /**
   * Generate _suggestion from a matched pattern
   */
  private generateSuggestionFromPattern(
    _pattern: Pattern,
    context: SimpleContext,
  ): Suggestion | null {
    if (!context.lastCommand) return null;

    const _commandIndex = _pattern.sequence.indexOf(context.lastCommand);
    if (_commandIndex === -1 || _commandIndex >= _pattern.sequence.length - 1)
      return null;

    const _nextCommand = _pattern.sequence[_commandIndex + 1];
    const _contextScore = this.contextTracker.getContextSimilarity({
      cwd: _pattern.metadata.context,
      command: context.lastCommand,
    });

    // More aggressive _confidence calculation for better suggestions
    const _frequencyBonus = Math.min(0.3, _pattern.frequency / 10); // Up to 30% bonus for frequency
    const _recencyBonus = this.calculateRecencyBonus(_pattern.lastSeen); // Bonus for recent _patterns
    const _baseConfidence = Math.min(
      1,
      _pattern._confidence + _frequencyBonus + _recencyBonus,
    );
    const _contextAdjustment = 0.8 + _contextScore * 0.2; // 0.8-1.0 range
    const _confidence = Math.min(1, _baseConfidence * _contextAdjustment);

    return {
      command: _nextCommand,
      _confidence,
      _source: "pattern",
      reasoning: `Based on _pattern: ${_pattern.sequence.join(" → ")} (used ${_pattern.frequency} times)`,
    };
  }

  /**
   * Calculate recency bonus for _patterns
   */
  private calculateRecencyBonus(lastSeen: Date): number {
    const _ageMs = Date.now() - lastSeen.getTime();
    const _ageHours = _ageMs / (1000 * 60 * 60);

    // Give bonus for recent _patterns (last 24 hours)
    if (_ageHours < 1) return 0.2; // 20% bonus for _patterns used in last hour
    if (_ageHours < 6) return 0.1; // 10% bonus for _patterns used in last 6 hours
    if (_ageHours < 24) return 0.05; // 5% bonus for _patterns used in last day
    return 0;
  }

  /**
   * Generate fallback suggestions when no _patterns _match
   */
  private generateFallbackSuggestions(context: SimpleContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const _lastCommand = context._lastCommand?.toLowerCase() || "";

    // Common command sequences
    const commonSequences: Record<
      string,
      { next: string; _confidence: number }
    > = {
      "git add": { next: "git commit", _confidence: 0.8 },
      "git commit": { next: "git push", _confidence: 0.7 },
      "npm install": { next: "npm start", _confidence: 0.6 },
      "npm test": { next: "npm run build", _confidence: 0.6 },
      "pnpm install": { next: "pnpm dev", _confidence: 0.6 },
      "yarn install": { next: "yarn start", _confidence: 0.6 },
      "npm run build": { next: "npm test", _confidence: 0.5 },
      "pnpm build": { next: "pnpm test", _confidence: 0.5 },
    };

    // Check for exact matches
    if (commonSequences[_lastCommand]) {
      const _match = commonSequences[_lastCommand];
      suggestions.push({
        command: _match.next,
        _confidence: _match.confidence,
        _source: "fallback",
        reasoning: "Common command sequence",
      });
    }

    // Check for partial matches
    for (const [key, value] of Object.entries(commonSequences)) {
      if (key.includes(_lastCommand) && key !== _lastCommand) {
        suggestions.push({
          command: value.next,
          _confidence: value.confidence * 0.7, // Lower _confidence for partial matches
          _source: "fallback",
          reasoning: `Similar to: ${key}`,
        });
      }
    }

    // Context-based suggestions
    if (context.cwd?.includes("test")) {
      suggestions.push({
        command: "npm test",
        _confidence: 0.5,
        _source: "context",
        reasoning: "In test directory",
      });
    }

    return suggestions.slice(0, 3); // Limit fallback suggestions
  }

  /**
   * Remove duplicate suggestions and rank by _confidence
   */
  private deduplicateAndRank(suggestions: Suggestion[]): Suggestion[] {
    const _seen = new Set<string>();
    const unique: Suggestion[] = [];

    for (const _suggestion of suggestions) {
      if (!_seen.has(_suggestion.command)) {
        seen.add(_suggestion.command);
        unique.push(_suggestion);
      }
    }

    return unique.sort((a, b) => b.confidence - a.confidence).slice(0, 5); // Top 5 suggestions
  }

  /**
   * Report _suggestion acceptance for learning
   */
  reportSuggestionUsed(_command: string, wasAccepted: boolean): void {
    if (wasAccepted) {
      this.stats.suggestionsAccepted++;
    }

    // Update pattern success rates (simplified)
    const _patterns = this.patternDetector.getAllPatterns();
    for (const pattern of _patterns) {
      if (pattern.sequence.includes(_command)) {
        pattern.successRate = wasAccepted
          ? Math.min(1, pattern.successRate * 1.05)
          : Math.max(0.1, pattern.successRate * 0.95);
      }
    }
  }

  /**
   * Get learning statistics
   */
  getStats(): LearningStats {
    const _patterns = this.patternDetector.getAllPatterns();
    const _totalPatterns = _patterns.length;
    const _averageConfidence =
      _totalPatterns > 0
        ? _patterns.reduce((sum, p) => sum + p.confidence, 0) / _totalPatterns
        : 0;

    const _patternHitRate =
      this.stats.suggestionsGenerated > 0
        ? this.stats.patternHits / this.stats.suggestionsGenerated
        : 0;

    return {
      _totalPatterns,
      _averageConfidence: Math.round(_averageConfidence * 1000) / 1000,
      suggestionsGenerated: this.stats.suggestionsGenerated,
      _patternHitRate: Math.round(_patternHitRate * 1000) / 1000,
    };
  }

  /**
   * Get recent actions for pattern detection
   */
  private _recentActions: UserAction[] = [];
  private readonly MAX_RECENT_ACTIONS = 50;

  private getRecentActions(): UserAction[] {
    return this.recentActions;
  }

  /**
   * Add action to recent actions buffer
   */
  private addToRecentActions(action: UserAction): void {
    this.recentActions.push(action);
    // Keep only recent actions
    if (this.recentActions.length > this.MAX_RECENT_ACTIONS) {
      this.recentActions = this.recentActions.slice(-this.MAX_RECENT_ACTIONS);
    }
  }

  /**
   * Clear all learned data (for testing/reset)
   */
  clearHistory(): void {
    this.patternDetector = new PatternDetector();
    this.contextTracker = new ContextTracker();
    this.stats = {
      suggestionsGenerated: 0,
      suggestionsAccepted: 0,
      patternHits: 0,
      fallbackUsed: 0,
    };
  }

  /**
   * Export learned _patterns for analysis
   */
  exportPatterns(): Pattern[] {
    return this.patternDetector.getAllPatterns();
  }

  /**
   * CLI integration helper - format suggestions for display
   */
  formatSuggestionsForCLI(suggestions: Suggestion[]): string {
    if (suggestions.length === 0) {
      return "💡 No suggestions available yet. Keep using commands to build _patterns!";
    }

    let output = "💡 Suggested next commands:\n";
    suggestions.forEach((_suggestion, index) => {
      const _confidence = Math.round(_suggestion._confidence * 100);
      const _source =
        _suggestion._source === "pattern"
          ? "🧩"
          : suggestion._source === "context"
            ? "📁"
            : "🔄";

      output += `  ${index + 1}. ${_suggestion.command} ${_source} (${_confidence}%)\n`;

      if (_suggestion.reasoning && _confidence > 60) {
        output += `     ${_suggestion.reasoning}\n`;
      }
    });

    return output.trim();
  }
}
