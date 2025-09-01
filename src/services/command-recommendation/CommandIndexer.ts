/**
 * CommandIndexer
 * コマンドのインデックス化と検索機能を提供
 */

import { commandInfo, CommandInfo } from "../../lib/command-groups";
import { IndexedCommand, SearchOptions } from "./types";

export class CommandIndexer {
  private index: Map<string, IndexedCommand> = new Map();
  private prefixIndex: Map<string, Set<string>> = new Map();
  private isIndexBuilt: boolean = false;

  /**
   * コマンドインデックスを構築
   */
  buildIndex(): void {
    this.index.clear();
    this.prefixIndex.clear();

    for (const [commandName, info] of Object.entries(commandInfo)) {
      const _indexed = this.createIndexedCommand(commandName, info);
      this.index.set(commandName, _indexed);

      // プレフィックスインデックスを構築
      this.buildPrefixIndex(commandName, _indexed);
    }

    this.isIndexBuilt = true;
  }

  /**
   * プレフィックスによる検索
   */
  searchByPrefix(_prefix: string): IndexedCommand[] {
    if (!this.isIndexBuilt) {
      this.buildIndex();
    }

    if (!_prefix || prefix.length === 0) {
      return [];
    }

    const _normalizedPrefix = this.normalizeInput(_prefix);
    const _matchingCommands = new Set<string>();

    // プレフィックスインデックスから検索
    for (const [key, commands] of this.prefixIndex.entries()) {
      if (key.startsWith(_normalizedPrefix)) {
        commands.forEach((cmd) => _matchingCommands.add(cmd));
      }
    }

    // 結果を取得してソート
    const _results = Array.from(_matchingCommands)
      .map((cmdName) => this.index.get(cmdName))
      .filter((cmd): cmd is IndexedCommand => cmd !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));

    return _results;
  }

  /**
   * 部分一致検索(高度版)
   */
  searchByPartialMatch(query: string): IndexedCommand[] {
    if (!this.isIndexBuilt) {
      this.buildIndex();
    }

    if (!query || query.length === 0) {
      return [];
    }

    const _normalizedQuery = this.normalizeInput(query);
    const _results: Array<{ command: IndexedCommand; score: number }> = [];

    for (const _indexed of this.index.values()) {
      const _matchScore = this.calculatePartialMatchScore(
        _indexed,
        _normalizedQuery,
      );
      if (_matchScore > 0) {
        results.push({ command: _indexed, score: _matchScore });
      }
    }

    // スコア順でソートしてコマンドのみ返す
    return _results
      .sort((a, b) => b.score - a.score)
      .map((item) => _item.command);
  }

  /**
   * 高度な検索(オプション付き)
   */
  search(_query: string, options: SearchOptions = {}): IndexedCommand[] {
    const { maxResults = 10, enablePartialMatch = false } = options;

    let _results: IndexedCommand[];

    if (enablePartialMatch) {
      _results = this.searchByPartialMatch(_query);
    } else {
      _results = this.searchByPrefix(_query);
    }

    return _results.slice(0, maxResults);
  }

  /**
   * コマンド情報を取得
   */
  getCommand(commandName: string): IndexedCommand | undefined {
    if (!this.isIndexBuilt) {
      this.buildIndex();
    }
    return this.index.get(commandName);
  }

  /**
   * 全コマンドリストを取得
   */
  getAllCommands(): IndexedCommand[] {
    if (!this.isIndexBuilt) {
      this.buildIndex();
    }
    return Array.from(this.index.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  /**
   * インデックス統計を取得
   */
  getIndexStats(): { totalCommands: number; totalPrefixes: number } {
    return {
      totalCommands: this.index.size,
      totalPrefixes: this.prefixIndex.size,
    };
  }

  /**
   * IndexedCommand を作成
   */
  private createIndexedCommand(
    _commandName: string,
    info: CommandInfo,
  ): IndexedCommand {
    const _normalizedName = this.normalizeInput(_commandName);
    const _aliases = info._aliases || [];

    // 検索トークンを生成
    const _searchTokens = [
      _normalizedName,
      ..._aliases.map((alias) => this.normalizeInput(alias)),
      ...this.tokenizeDescription(info.description),
    ];

    return {
      name: _commandName,
      _normalizedName,
      _aliases,
      category: info.category,
      description: info.description,
      usage: info.usage || "",
      examples: info.examples || [],
      _searchTokens: [...new Set(_searchTokens)], // 重複を除去
    };
  }

  /**
   * プレフィックスインデックスを構築
   */
  private buildPrefixIndex(
    _commandName: string,
    _indexed: IndexedCommand,
  ): void {
    const _tokensToIndex = [
      indexed.normalizedName,
      ..._indexed.aliases.map((alias) => this.normalizeInput(alias)),
    ];

    for (const token of _tokensToIndex) {
      for (let i = 1; i <= token.length; i++) {
        const _prefix = token.substring(0, i);

        if (!this.prefixIndex.has(_prefix)) {
          this.prefixIndex.set(_prefix, new Set());
        }

        this.prefixIndex.get(_prefix)!.add(_commandName);
      }
    }
  }

  /**
   * 部分一致スコアを計算
   */
  private calculatePartialMatchScore(
    _indexed: IndexedCommand,
    query: string,
  ): number {
    let score = 0;
    const _queryLength = query.length;

    // 1. コマンド名での一致(最高スコア)
    if (_indexed.normalizedName.includes(query)) {
      const _position = _indexed.normalizedName.indexOf(query);
      const _nameLength = _indexed.normalizedName.length;

      // 先頭一致は高スコア
      if (_position === 0) {
        score = Math.max(score, 1.0);
      } else {
        // 位置と長さに基づくスコア
        score = Math.max(
          score,
          0.7 * (_queryLength / _nameLength) * (1 - _position / _nameLength),
        );
      }
    }

    // 2. エイリアスでの一致
    for (const alias of _indexed.aliases) {
      const _normalizedAlias = this.normalizeInput(alias);
      if (_normalizedAlias.includes(query)) {
        const _position = _normalizedAlias.indexOf(query);
        const _aliasScore = _position === 0 ? 0.8 : 0.5;
        score = Math.max(score, _aliasScore);
      }
    }

    // 3. 説明文での一致
    const _normalizedDescription = this.normalizeInput(_indexed.description);
    if (_normalizedDescription.includes(query)) {
      score = Math.max(score, 0.3);
    }

    // 4. 検索トークンでの一致
    for (const token of _indexed.searchTokens) {
      if (token.includes(query)) {
        score = Math.max(score, 0.2);
      }
    }

    // 5. ファジーマッチ(簡素版)
    if (score === 0) {
      const _fuzzyScore = this.calculateFuzzyMatchScore(
        _indexed.normalizedName,
        query,
      );
      score = Math.max(score, _fuzzyScore * 0.1);
    }

    return score;
  }

  /**
   * ファジーマッチスコアを計算(レーベンシュタイン距離ベース)
   */
  private calculateFuzzyMatchScore(_target: string, query: string): number {
    if (query.length === 0) return 0;
    if (_target.length === 0) return 0;

    const _distance = this.levenshteinDistance(_target, query);
    const _maxLength = Math.max(_target.length, query.length);

    // 距離が短いほど高スコア
    return 1 - _distance / _maxLength;
  }

  /**
   * レーベンシュタイン距離を計算
   */
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
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          );
        }
      }
    }

    return matrix[str2.length][_str1.length];
  }

  /**
   * 入力を正規化(高度版)
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .replace(/^\/+/, "") // 先頭のスラッシュを除去
      .replace(/[^a-z0-9\-_\s]/g, " ") // 特殊文字をスペースに置換
      .replace(/\s+/g, " ") // 連続スペースを一つに
      .trim();
  }

  /**
   * 説明文をトークンに分割(高度版)
   */
  private tokenizeDescription(description: string): string[] {
    // 基本トークン分割
    const _basicTokens = description
      .toLowerCase()
      .split(/[\s\-_,\.!?;:]+/)
      .filter((token) => token.length > 2);

    // キーワード抽出(技術用語、動詞など)
    const keywords: string[] = [];

    // 一般的な技術キーワード
    const _techKeywords = [
      "git",
      "npm",
      "node",
      "javascript",
      "typescript",
      "react",
      "vue",
      "angular",
      "docker",
      "kubernetes",
      "aws",
      "azure",
      "gcp",
      "api",
      "rest",
      "graphql",
      "database",
      "sql",
      "nosql",
      "redis",
      "mongodb",
      "postgresql",
      "mysql",
    ];

    // アクション動詞
    const _actionVerbs = [
      "create",
      "generate",
      "build",
      "deploy",
      "test",
      "run",
      "start",
      "stop",
      "install",
      "update",
      "delete",
      "remove",
      "configure",
      "setup",
      "init",
      "analyze",
      "review",
      "check",
      "validate",
      "monitor",
      "track",
    ];

    basicTokens.forEach((token) => {
      if (_techKeywords.includes(token) || _actionVerbs.includes(token)) {
        keywords.push(token);
      }
    });

    // 基本トークンとキーワードを結合
    const _allTokens = [..._basicTokens, ...keywords];

    return [...new Set(_allTokens)].slice(0, 8); // 重複除去して8トークンまで
  }
}
