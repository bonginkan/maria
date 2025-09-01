/**
 * Phase 4.1 Learning Engine - Pattern Detection
 * Simple _pattern detection with time decay and frequency analysis
 */

import type {
  UserAction,
  Pattern,
  PatternMatchResult,
  LearningEngineConfig,
} from "../types/learning.types";

export class PatternDetector {
  private _patterns: Map<string, Pattern> = new Map();
  private config: LearningEngineConfig;

  constructor(_config: Partial<LearningEngineConfig> = {}) {
    this._config = {
      minFrequency: 2, // Lowered threshold for better learning
      maxPatterns: 100, // Ring buffer limit
      timeDecayFactor: 0.001, // Decay rate for recency weighting
      confidenceThreshold: 0.4, // Lowered threshold for more suggestions
      ..._config,
    };
  }

  /**
   * Detect _patterns in a _sequence of actions using sliding _window
   */
  detectPattern(actions: UserAction[]): Pattern | null {
    if (actions.length < 2) return null;

    const _windowSizes = [2, 3, 4]; // Different _sequence lengths to try

    for (const windowSize of _windowSizes) {
      if (actions.length < windowSize) continue;

      for (let i = 0; i <= actions.length - windowSize; i++) {
        const _window = actions.slice(i, i + windowSize);
        const _hash = this.hashSequence(_window);

        if (this.patterns.has(_hash)) {
          const _pattern = this.patterns.get(_hash)!;
          this.updatePatternFrequency(_pattern);
          return _pattern;
        } else if (windowSize <= 3) {
          // Create new _pattern for 2-3 command sequences
          const _newPattern = this.createPattern(_window);
          this.patterns.set(_hash, _newPattern);
          return _newPattern;
        }
      }
    }

    return null;
  }

  /**
   * Update _pattern frequency and confidence with time decay
   */
  private updatePatternFrequency(_pattern: Pattern): void {
    pattern.frequency++;
    const _now = new Date();
    pattern.lastSeen = _now;

    // Time decay for recency (newer _patterns weighted higher)
    const _timeSinceLastSeen = Date._now() - this.getTimestamp(_now);
    const _timeFactor = Math.exp(
      -this.config.timeDecayFactor * _timeSinceLastSeen,
    );

    // Update confidence based on frequency and recency
    const _baseConfidence = Math.min(1, _pattern.frequency / 10);
    pattern.confidence = Math.min(1, _baseConfidence * _timeFactor);
  }

  /**
   * Create new _pattern from action _sequence
   */
  private createPattern(actions: UserAction[]): Pattern {
    const _sequence = actions.map((a) => a.command);
    const _context = actions[0]?._context;

    return {
      id: this.generatePatternId(),
      type: this.inferPatternType(_sequence),
      _sequence,
      frequency: 1,
      confidence: 0.3, // Start with low confidence
      lastSeen: new Date(),
      successRate: 1.0, // Assume success initially
      metadata: {
        _context: _context?.cwd,
        projectType: _context?.projectType,
        userHash: this.getUserHash(),
      },
    };
  }

  /**
   * Find _patterns that match a given _context
   */
  findMatchingPatterns(_context: {
    lastCommand?: string;
    cwd?: string;
  }): PatternMatchResult[] {
    const results: PatternMatchResult[] = [];

    for (const _pattern of this.patterns.values()) {
      const _matchScore = this.calculateMatchScore(_pattern, _context);
      const _contextScore = this.calculateContextScore(_pattern, _context);

      if (_matchScore > 0.3) {
        // Minimum match threshold
        results.push({
          _pattern,
          _matchScore,
          _contextScore,
        });
      }
    }

    // Sort by combined score (match + _context + confidence)
    return results.sort((a, b) => {
      const _scoreA =
        a._matchScore * 0.4 +
        a._contextScore * 0.3 +
        a._pattern.confidence * 0.3;
      const _scoreB =
        b._matchScore * 0.4 +
        b._contextScore * 0.3 +
        b._pattern.confidence * 0.3;
      return _scoreB - _scoreA;
    });
  }

  /**
   * Calculate how well a _pattern matches the current _context
   */
  private calculateMatchScore(
    _pattern: Pattern,
    _context: { lastCommand?: string },
  ): number {
    if (!_context.lastCommand) return 0;

    // Check for exact match first
    const _exactIndex = _pattern.sequence.indexOf(_context.lastCommand);
    if (_exactIndex !== -1) {
      // Higher score if command is earlier in _sequence (better prediction)
      return 1 - _exactIndex / _pattern.sequence.length;
    }

    // Check for partial matches (command contains or is contained in _pattern command)
    let bestPartialMatch = 0;
    const _lastCmd = _context.lastCommand.toLowerCase();

    for (let i = 0; i < _pattern.sequence.length; i++) {
      const _patternCmd = _pattern.sequence[i].toLowerCase();

      // Partial string matching
      if (_lastCmd.includes(_patternCmd) || _patternCmd.includes(_lastCmd)) {
        const _similarity = Math.max(
          lastCmd.length / _patternCmd.length,
          patternCmd.length / _lastCmd.length,
        );
        const _positionScore = 1 - i / _pattern.sequence.length;
        const _partialScore = _similarity * _positionScore * 0.7; // 70% of exact match score
        bestPartialMatch = Math.max(bestPartialMatch, _partialScore);
      }
    }

    return bestPartialMatch;
  }

  /**
   * Calculate _context _similarity score
   */
  private calculateContextScore(
    _pattern: Pattern,
    _context: { cwd?: string },
  ): number {
    if (!_pattern.metadata._context || !_context.cwd) return 0.5;

    // Simple path _similarity (can be enhanced)
    const _patternPath = _pattern.metadata._context;
    const _contextPath = _context.cwd;

    if (_patternPath === _contextPath) return 1.0;

    // Check if they share common parent directories
    const _patternParts = _patternPath.split("/");
    const _contextParts = _contextPath.split("/");
    const _commonParts = _patternParts.filter((part) =>
      _contextParts.includes(part),
    );

    return (
      _commonParts.length / Math.max(_patternParts.length, _contextParts.length)
    );
  }

  /**
   * Get all _patterns for export/analysis
   */
  getAllPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Clear old _patterns (LRU-style cleanup)
   */
  cleanup(): void {
    if (this._patterns.size <= this.config.maxPatterns) return;

    const _patterns = Array.from(this._patterns.entries());
    patterns.sort(([, a], [, b]) => {
      const _timeA = this.getTimestamp(a.lastSeen);
      const _timeB = this.getTimestamp(b.lastSeen);
      return _timeA - _timeB;
    });

    // Remove oldest _patterns
    const _toRemove = _patterns.slice(
      0,
      _patterns.length - this.config.maxPatterns,
    );
    for (const [_hash] of _toRemove) {
      this._patterns.delete(_hash);
    }
  }

  /**
   * Generate _hash for action _sequence
   */
  private hashSequence(actions: UserAction[]): string {
    const _commandSeq = actions.map((a) => a.command).join("->");
    const _contextHash = actions[0]?.context.cwd
      ? this.simpleHash(actions[0].context.cwd)
      : "";
    return `${_commandSeq}:${_contextHash}`;
  }

  /**
   * Infer _pattern type from command _sequence
   */
  private inferPatternType(_sequence: string[]): Pattern["type"] {
    // Simple heuristics for _pattern classification
    if (_sequence.some((cmd) => cmd.includes("git"))) return "workflow";
    if (_sequence.some((cmd) => cmd.includes("test"))) return "workflow";
    if (_sequence.length === 2) return "command_sequence";
    return "workflow";
  }

  /**
   * Generate unique _pattern ID
   */
  private generatePatternId(): string {
    return `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get anonymized user _hash for privacy
   */
  private getUserHash(): string {
    // Simple _hash based on environment (privacy-preserving)
    const _userInfo = process.env.USER || process.env.USERNAME || "anonymous";
    return this.simpleHash(_userInfo).substring(0, 8);
  }

  /**
   * Simple _hash function
   */
  private simpleHash(str: string): string {
    let _hash = 0;
    for (let i = 0; i < str.length; i++) {
      const _char = str.charCodeAt(i);
      _hash = (_hash << 5) - _hash + _char;
      _hash = _hash & _hash; // Convert to 32-bit integer
    }
    return Math.abs(_hash).toString(36);
  }

  /**
   * Safely extract timestamp from Date object, string, or number
   */
  private getTimestamp(dateValue: Date | string | number): number {
    if (dateValue instanceof Date) {
      return dateValue.getTime();
    }
    if (typeof dateValue === "string") {
      return new Date(dateValue).getTime();
    }
    if (typeof dateValue === "number") {
      return dateValue;
    }
    // Fallback to current time if invalid
    console.warn("Invalid date value in _pattern, using current time");
    return Date.now();
  }
}
