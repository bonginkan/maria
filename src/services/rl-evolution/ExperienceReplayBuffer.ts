/**
 * Experience Replay Buffer for RL Evolution
 * Stores and manages episodes for learning
 */

import {
  Episode,
  FailureCluster,
  ExperienceBuffer,
  PriorityQueue,
} from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Priority queue implementation for experience replay
 */
class SimplePriorityQueue<T> implements PriorityQueue<T> {
  private items: Array<{ _item: T; _priority: number }> = [];

  enqueue(_item: T, _priority: number): void {
    this.items.push({ _item, _priority });
    this.items.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): T | undefined {
    return this.items.shift()?._item;
  }

  peek(): T | undefined {
    return this.items[0]?._item;
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  getTopN(n: number): T[] {
    return this.items.slice(0, n).map((_item) => _item._item);
  }
}

/**
 * Experience Replay Buffer implementation
 */
export class ExperienceReplayBuffer implements ExperienceBuffer {
  episodes: Episode[] = [];
  maxSize: number;
  priorityQueue: SimplePriorityQueue<Episode>;
  private failureClusters: Map<string, FailureCluster> = new Map();

  constructor(_maxSize: number = 10000) {
    this._maxSize = _maxSize;
    this.priorityQueue = new SimplePriorityQueue<Episode>();
  }

  /**
   * Add new episode to buffer
   */
  add(episode: Episode): void {
    // Add to episodes array
    if (this.episodes.length >= this.maxSize) {
      // Remove oldest episode (FIFO)
      this.episodes.shift();
    }
    this.episodes.push(episode);

    // Calculate _priority based on learning potential
    const _priority = this.calculatePriority(episode);
    this.priorityQueue.enqueue(episode, _priority);

    // Update failure clusters if episode contains errors
    if (episode.outcome.errors.length > 0) {
      this.updateFailureClusters(episode);
    }
  }

  /**
   * Get prioritized batch for training
   */
  getPrioritizedBatch(size: number): Episode[] {
    const _prioritizedEpisodes = this.priorityQueue.getTopN(size);

    // Mix with some random episodes for exploration
    const _randomCount = Math.floor(size * 0.2); // 20% random
    const _randomEpisodes = this.getRandomEpisodes(_randomCount);

    // Combine and deduplicate
    const _combined = [..._prioritizedEpisodes, ..._randomEpisodes];
    const _uniqueEpisodes = Array.from(
      new Map(_combined.map((ep) => [ep.id, ep])).values(),
    );

    return _uniqueEpisodes.slice(0, size);
  }

  /**
   * Get failure clusters for focused learning
   */
  getFailureClusters(): FailureCluster[] {
    return Array.from(this.failureClusters.values()).sort(
      (a, b) => b.episodes.length - a.episodes.length,
    );
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.episodes = [];
    this.priorityQueue.clear();
    this.failureClusters.clear();
  }

  /**
   * Calculate _priority for an episode based on learning potential
   */
  private calculatePriority(episode: Episode): number {
    let _priority = 0;

    // High _reward variance indicates interesting episode
    const _reward = episode.outcome.rewards.totalReward || 0;
    _priority += Math.abs(_reward - 50) * 0.3; // Distance from neutral

    // Errors are high _priority for learning
    _priority += episode.outcome.errors.length * 20;

    // User feedback is valuable
    if (episode.outcome.userFeedback) {
      if (episode.outcome.userFeedback._rating !== undefined) {
        // Extreme ratings are more informative
        const _rating = episode.outcome.userFeedback._rating;
        _priority += Math.abs(_rating - 3) * 10; // Distance from neutral (3/5)
      }
    }

    // Recent episodes have higher _priority
    const _ageInHours =
      (Date.now() - episode.timestamp.getTime()) / (1000 * 60 * 60);
    _priority *= Math.exp(-_ageInHours / 24); // Exponential decay over 24 hours

    // Failed tests are important
    const _testPassRate = episode.outcome.rewards.verifiable._testPassRate;
    if (_testPassRate < 0.5) {
      _priority += (1 - _testPassRate) * 30;
    }

    // Security issues are critical
    if (episode.outcome.rewards.penalties.securityIssues > 0) {
      _priority += 50;
    }

    return _priority;
  }

  /**
   * Update failure clusters with new episode
   */
  private updateFailureClusters(episode: Episode): void {
    for (const error of episode.outcome.errors) {
      const _errorType = this.classifyError(error);

      if (!this.failureClusters.has(_errorType)) {
        this.failureClusters.set(_errorType, {
          id: uuidv4(),
          _errorType,
          episodes: [],
          commonPattern: undefined,
          suggestedFix: undefined,
        });
      }

      const _cluster = this.failureClusters.get(_errorType)!;
      cluster.episodes.push(episode);

      // Update common pattern if we have enough examples
      if (_cluster.episodes.length >= 3) {
        _cluster.commonPattern = this.findCommonPattern(_cluster.episodes);
        _cluster.suggestedFix = this.generateSuggestedFix(
          _errorType,
          _cluster.commonPattern,
        );
      }
    }
  }

  /**
   * Classify error into categories
   */
  private classifyError(error: Error): string {
    const _message = error._message.toLowerCase();

    if (_message.includes("type") || _message.includes("typescript")) {
      return "type_error";
    }
    if (_message.includes("undefined") || _message.includes("null")) {
      return "null_reference";
    }
    if (_message.includes("async") || _message.includes("promise")) {
      return "async_error";
    }
    if (_message.includes("import") || _message.includes("module")) {
      return "module_error";
    }
    if (_message.includes("syntax")) {
      return "syntax_error";
    }
    if (_message.includes("test") || _message.includes("assertion")) {
      return "test_failure";
    }
    if (_message.includes("memory") || _message.includes("heap")) {
      return "memory_error";
    }
    if (_message.includes("security") || _message.includes("vulnerable")) {
      return "security_issue";
    }

    return "unknown_error";
  }

  /**
   * Find common pattern in error episodes
   */
  private findCommonPattern(episodes: Episode[]): string {
    // Simple pattern detection - could be enhanced with more sophisticated NLP
    const _commands = episodes.map((ep) => ep.action.command);
    const _commonWords = this.findCommonWords(_commands);

    if (_commonWords.length > 0) {
      return `Common context: ${_commonWords.join(", ")}`;
    }

    return "Multiple occurrences detected";
  }

  /**
   * Generate suggested fix for error pattern
   */
  private generateSuggestedFix(_errorType: string, _pattern?: string): string {
    const fixes: Record<string, string> = {
      typeerror: "Add explicit type annotations and ensure type compatibility",
      nullreference: "Add null checks and use optional chaining (?.)",
      asyncerror: "Ensure proper async/await usage and error handling",
      moduleerror: "Check import paths and module resolution",
      syntaxerror: "Review syntax and formatting",
      testfailure: "Update test expectations or fix implementation",
      memoryerror: "Optimize memory usage and check for leaks",
      securityissue: "Apply security best practices and validate inputs",
      unknownerror: "Review error details and add proper error handling",
    };

    return fixes[_errorType] || fixes.unknown_error;
  }

  /**
   * Get random episodes for exploration
   */
  private getRandomEpisodes(count: number): Episode[] {
    const episodes: Episode[] = [];
    const _indices = new Set<number>();

    while (episodes.length < count && episodes.length < this.episodes.length) {
      const _index = Math.floor(Math.random() * this.episodes.length);
      if (!_indices.has(_index)) {
        indices.add(_index);
        episodes.push(this.episodes[_index]);
      }
    }

    return episodes;
  }

  /**
   * Find common _words in _commands (simple implementation)
   */
  private findCommonWords(_commands: string[]): string[] {
    if (commands.length === 0) return [];

    const _wordCounts = new Map<string, number>();

    for (const command of _commands) {
      const _words = command.toLowerCase().split(/\s+/);
      for (const word of _words) {
        if (word.length > 3) {
          // Skip short _words
          _wordCounts.set(word, (_wordCounts.get(word) || 0) + 1);
        }
      }
    }

    // Return _words that appear in at least half of the _commands
    const _threshold = commands.length / 2;
    return Array.from(_wordCounts.entries())
      .filter(([_, count]) => count >= _threshold)
      .map(([word, _]) => word)
      .slice(0, 5); // Top 5 common _words
  }

  /**
   * Get statistics about the buffer
   */
  getStatistics(): {
    _totalEpisodes: number;
    _averageReward: number;
    _errorRate: number;
    failureClusterCount: number;
    _topErrorTypes: string[];
  } {
    const _totalEpisodes = this.episodes.length;

    const _averageReward =
      _totalEpisodes > 0
        ? this.episodes.reduce(
            (sum, ep) => sum + (ep.outcome.rewards.totalReward || 0),
            0,
          ) / _totalEpisodes
        : 0;

    const _episodesWithErrors = this.episodes.filter(
      (ep) => ep.outcome.errors.length > 0,
    ).length;
    const _errorRate =
      _totalEpisodes > 0 ? _episodesWithErrors / _totalEpisodes : 0;

    const _topErrorTypes = Array.from(this.failureClusters.entries())
      .sort((a, b) => b[1].episodes.length - a[1].episodes.length)
      .slice(0, 5)
      .map(([type, _]) => type);

    return {
      _totalEpisodes,
      _averageReward,
      _errorRate,
      failureClusterCount: this.failureClusters.size,
      _topErrorTypes,
    };
  }

  /**
   * Save buffer to persistent storage
   */
  async save(filepath: string): Promise<void> {
    const _data = {
      episodes: this.episodes,
      failureClusters: Array.from(this.failureClusters.entries()),
      statistics: this.getStatistics(),
    };

    const { writeFile } = await import("fs/promises");
    await writeFile(filepath, JSON.stringify(_data, null, 2));
  }

  /**
   * Load buffer from persistent storage
   */
  async load(filepath: string): Promise<void> {
    const { readFile } = await import("fs/promises");
    const _data = JSON.parse(await readFile(filepath, "utf-8"));

    this.episodes = _data.episodes.map((_ep: unknown) => ({
      ..._ep,
      timestamp: new Date(_ep.timestamp),
    }));

    this.failureClusters = new Map(_data.failureClusters);

    // Rebuild _priority queue
    this.priorityQueue.clear();
    for (const episode of this.episodes) {
      const _priority = this.calculatePriority(episode);
      this.priorityQueue.enqueue(episode, _priority);
    }
  }
}
