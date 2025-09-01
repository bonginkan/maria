/**
 * CommandRecommendationEngine
 * スラッシュコマンドの推薦エンジン
 */

import { CommandIndexer } from "./CommandIndexer";
import { CommandUsageTracker } from "./CommandUsageTracker";
import {
  CommandRecommendation,
  SearchResult,
  RecommendationEngineConfig,
  SearchOptions,
} from "./types";
import { logger } from "../../utils/logger";

const _DEFAULTCONFIG: RecommendationEngineConfig = {
  maxSuggestions: 10,
  minInputLength: 1,
  enableUsageTracking: true,
  enablePartialMatching: true,
  debounceDelay: 100,
  cacheExpiry: 300000, // 5分
};

export class CommandRecommendationEngine {
  private static instance: CommandRecommendationEngine;
  private indexer: CommandIndexer;
  private usageTracker: CommandUsageTracker;
  private config: RecommendationEngineConfig;
  private searchCache: Map<
    string,
    { result: SearchResult; timestamp: number }
  > = new Map();
  private lastCommand: string | null = null;

  private constructor(_config: Partial<RecommendationEngineConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ..._config };
    this.indexer = new CommandIndexer();
    this.usageTracker = CommandUsageTracker.getInstance();
    this.initialize();
  }

  public static getInstance(
    config?: Partial<RecommendationEngineConfig>,
  ): CommandRecommendationEngine {
    if (!CommandRecommendationEngine.instance) {
      CommandRecommendationEngine.instance = new CommandRecommendationEngine(
        config,
      );
    }
    return CommandRecommendationEngine.instance;
  }

  /**
   * 初期化処理
   */
  private async initialize(): Promise<void> {
    try {
      this.indexer.buildIndex();
      await this.usageTracker.initialize();
      // 初期化ログを無効化 - UIをクリーンに保つ
      // logger.info('CommandRecommendationEngine initialized successfully');
    } catch (_error) {
      logger.error("Failed to initialize CommandRecommendationEngine:", _error);
    }
  }

  /**
   * コマンド推薦のメイン機能
   */
  public async searchCommands(input: string): Promise<SearchResult> {
    const _startTime = Date.now();

    // 入力検証
    if (!input || input.length < this.config.minInputLength) {
      return {
        _recommendations: [],
        totalMatches: 0,
        searchTime: Date.now() - _startTime,
      };
    }

    // キャッシュチェック
    const _cacheKey = this.generateCacheKey(input);
    const _cached = this.getCachedResult(_cacheKey);
    if (_cached) {
      return _cached;
    }

    try {
      // 検索実行
      const _searchOptions: SearchOptions = {
        maxResults: this.config.maxSuggestions,
        enablePartialMatch: this.config.enablePartialMatching,
        sortBy: "relevance",
      };

      const _indexedCommands = this.indexer.search(input, _searchOptions);

      // 推薦オブジェクトに変換
      const _recommendations = _indexedCommands.map((cmd) =>
        this.createRecommendation(cmd, input),
      );

      // 使用頻度とマッチスコアで並び替え
      recommendations.sort((a, b) => {
        if (Math.abs(a.combinedScore - b.combinedScore) < 0.01) {
          return a.command.localeCompare(b.command); // アルファベット順
        }
        return b.combinedScore - a.combinedScore; // スコア順(降順)
      });

      const result: SearchResult = {
        _recommendations,
        totalMatches: _indexedCommands.length,
        searchTime: Date.now() - _startTime,
      };

      // キャッシュに保存
      this.setCachedResult(_cacheKey, result);

      return result;
    } catch (_error) {
      logger.error("Search command failed:", _error);
      return {
        _recommendations: [],
        totalMatches: 0,
        searchTime: Date.now() - _startTime,
      };
    }
  }

  /**
   * 入力に対する推薦を取得(簡易版)
   */
  public getRecommendationsForInput(input: string): CommandRecommendation[] {
    // 同期版の簡易実装
    if (!input || input.length < this.config.minInputLength) {
      return [];
    }

    const _searchOptions: SearchOptions = {
      maxResults: this.config.maxSuggestions,
      enablePartialMatch: this.config.enablePartialMatching,
    };

    const _indexedCommands = this.indexer.search(input, _searchOptions);

    const _recommendations = _indexedCommands.map((cmd) =>
      this.createRecommendation(cmd, input),
    );

    // スコア順でソート
    recommendations.sort((a, b) => {
      if (Math.abs(a.combinedScore - b.combinedScore) < 0.01) {
        return a.command.localeCompare(b.command);
      }
      return b.combinedScore - a.combinedScore;
    });

    return _recommendations;
  }

  /**
   * コマンド使用履歴の更新
   */
  public updateCommandUsage(
    _commandName: string,
    context?: string,
    success: boolean = true,
  ): void {
    // Track command sequence if there was a previous command
    if (this.lastCommand) {
      this.usageTracker.trackCommandSequence(this.lastCommand, _commandName);
    }

    // Track usage with advanced analytics
    this.usageTracker.trackUsage(_commandName, context, success);

    // Update last command for sequence tracking
    this.lastCommand = _commandName;

    // キャッシュクリア
    this.clearCache();
  }

  /**
   * 使用統計を取得
   */
  public getUsageStats(): Map<string, { count: number; lastUsed: Date }> {
    return this.usageTracker.getAllUsageStats();
  }

  /**
   * 高度な使用統計を取得
   */
  public getAdvancedUsageStats(_commandName: string) {
    return this.usageTracker.getAdvancedStats(_commandName);
  }

  /**
   * トップコマンドを取得
   */
  public getTopCommands(_limit: number = 10) {
    return this.usageTracker.getTopCommands(_limit);
  }

  /**
   * おすすめコマンドを取得
   */
  public getSuggestedCommands(
    _baseCommand: string,
    limit: number = 5,
  ): string[] {
    return this.usageTracker.getSuggestedCommands(_baseCommand, limit);
  }

  /**
   * セッション統計を取得
   */
  public getSessionStats() {
    return this.usageTracker.getSessionStats();
  }

  /**
   * 設定を更新
   */
  public updateConfig(newConfig: Partial<RecommendationEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.clearCache(); // 設定変更時はキャッシュクリア
  }

  /**
   * インデックス統計を取得
   */
  public getIndexStats() {
    return this.indexer.getIndexStats();
  }

  /**
   * CommandRecommendation オブジェクトを作成
   */
  private createRecommendation(
    _indexedCommand: unknown,
    input: string,
  ): CommandRecommendation {
    const _matchScore = this.calculateMatchScore(_indexedCommand, input);
    const _frequencyScore = this.calculateFrequencyScore(_indexedCommand.name);
    const _combinedScore = this.calculateCombinedScore(
      _matchScore,
      _frequencyScore,
    );

    return {
      command: _indexedCommand.name,
      description: _indexedCommand.description,
      category: _indexedCommand.category,
      aliases: _indexedCommand.aliases,
      usage: _indexedCommand.usage,
      examples: _indexedCommand.examples,
      _matchScore,
      _frequencyScore,
      _combinedScore,
    };
  }

  /**
   * マッチスコアを計算
   */
  private calculateMatchScore(_indexedCommand: unknown, input: string): number {
    const _normalizedInput = input.toLowerCase().replace(/^\/+/, "");
    const _normalizedCommand = _indexedCommand.normalizedName;

    // 完全一致は最高スコア
    if (_normalizedCommand === _normalizedInput) {
      return 1.0;
    }

    // プレフィックス一致
    if (_normalizedCommand.startsWith(_normalizedInput)) {
      return 0.8 + (_normalizedInput.length / _normalizedCommand.length) * 0.2;
    }

    // 部分一致
    if (_normalizedCommand.includes(_normalizedInput)) {
      return 0.3 + (_normalizedInput.length / _normalizedCommand.length) * 0.3;
    }

    // エイリアス一致
    for (const alias of _indexedCommand.aliases) {
      const _normalizedAlias = alias.toLowerCase().replace(/^\/+/, "");
      if (_normalizedAlias.startsWith(_normalizedInput)) {
        return 0.6 + (_normalizedInput.length / _normalizedAlias.length) * 0.2;
      }
    }

    return 0.1; // 最小スコア
  }

  /**
   * 使用頻度スコアを計算(高度版)
   */
  private calculateFrequencyScore(commandName: string): number {
    return this.usageTracker.getFrequencyScore(commandName);
  }

  /**
   * 統合スコアを計算
   */
  private calculateCombinedScore(
    _matchScore: number,
    _frequencyScore: number,
  ): number {
    // マッチスコア70%、使用頻度30%の重み付け
    return _matchScore * 0.7 + _frequencyScore * 0.3;
  }

  /**
   * キャッシュキーを生成
   */
  private generateCacheKey(input: string): string {
    return `${input.toLowerCase()}_${this.config.maxSuggestions}_${this.config.enablePartialMatching}`;
  }

  /**
   * キャッシュから結果を取得
   */
  private getCachedResult(_cacheKey: string): SearchResult | null {
    const _cached = this.searchCache.get(_cacheKey);
    if (!_cached) {
      return null;
    }

    // 期限切れチェック
    if (Date.now() - _cached.timestamp > this.config.cacheExpiry) {
      this.searchCache.delete(_cacheKey);
      return null;
    }

    return _cached.result;
  }

  /**
   * 結果をキャッシュに保存
   */
  private setCachedResult(_cacheKey: string, result: SearchResult): void {
    this.searchCache.set(_cacheKey, {
      result,
      timestamp: Date.now(),
    });

    // キャッシュサイズ制限(100エントリー)
    if (this.searchCache.size > 100) {
      const _oldestKey = this.searchCache.keys().next().value;
      this.searchCache.delete(_oldestKey);
    }
  }

  /**
   * キャッシュクリア
   */
  private clearCache(): void {
    this.searchCache.clear();
  }

  /**
   * コンテキストベースの推薦を取得
   */
  public getContextBasedRecommendations(
    _context: string,
    limit: number = 5,
  ): CommandRecommendation[] {
    // コンテキストに基づいた高度な推薦
    const _searchOptions: SearchOptions = {
      maxResults: limit * 2, // 多めに取得してフィルタリング
      enablePartialMatch: true,
    };

    // コンテキストに関連するキーワードで検索
    const _contextKeywords = this.extractContextKeywords(_context);
    const _recommendations = new Map<string, CommandRecommendation>();

    for (const keyword of _contextKeywords) {
      const _commands = this.indexer.searchByPartialMatch(keyword);
      commands.forEach((cmd) => {
        if (!_recommendations.has(cmd.name)) {
          const _rec = this.createRecommendation(cmd, keyword);
          recommendations.set(cmd.name, _rec);
        }
      });
    }

    // スコア順でソートして上位を返す
    return Array.from(_recommendations.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);
  }

  /**
   * コンテキストからキーワードを抽出
   */
  private extractContextKeywords(context: string): string[] {
    // シンプルなキーワード抽出
    const _words = context
      .toLowerCase()
      .split(/[\s\-_,.!?]+/)
      .filter((word) => word.length > 2)
      .slice(0, 5); // 最大5キーワード

    return [...new Set(_words)]; // 重複除去
  }

  /**
   * 使用データをエクスポート
   */
  public exportUsageData(): object {
    return this.usageTracker.exportUsageData();
  }

  /**
   * 使用データをクリア
   */
  public async clearUsageData(): Promise<void> {
    await this.usageTracker.clearUsageData();
    this.clearCache();
  }

  /**
   * エンジン統計を取得
   */
  public getEngineStats(): {
    indexStats: any;
    sessionStats: any;
    cacheStats: { size: number; maxSize: number };
    configStats: RecommendationEngineConfig;
  } {
    return {
      indexStats: this.getIndexStats(),
      sessionStats: this.getSessionStats(),
      cacheStats: {
        size: this.searchCache.size,
        maxSize: 100,
      },
      configStats: { ...this.config },
    };
  }
}
