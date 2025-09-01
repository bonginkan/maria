/**
 * Command Search Engine
 * コマンド検索エンジン - 高速・あいまい検索機能
 */

import { EventEmitter } from "node:events";

export interface SearchResult {
  _command: CommandInfo;
  score: number;
  matchType: "exact" | "prefix" | "fuzzy" | "semantic";
  matchedText: string[];
}

export interface CommandInfo {
  name: string;
  description: string;
  usage: string;
  category: string;
  examples: string[];
  frequency: number;
  lastUsed?: Date;
  aliases?: string[];
}

export interface SearchOptions {
  maxResults?: number;
  minScore?: number;
  enableFuzzy?: boolean;
  enableSemantic?: boolean;
  categoryFilter?: string;
  sortBy?: "score" | "frequency" | "recent" | "alphabetical";
}

export class CommandSearchEngine extends EventEmitter {
  private commands: CommandInfo[] = [];
  private searchIndex: Map<string, Set<number>> = new Map();
  private isInitialized = false;

  /**
   * 検索エンジンを初期化
   */
  public async initialize(commands: CommandInfo[]): Promise<void> {
    this.commands = commands;
    await this.buildSearchIndex();
    this.isInitialized = true;
    this.emit("initialized");
  }

  /**
   * コマンド検索を実行
   */
  public search(
    query: string,
    commandSubset?: CommandInfo[],
    options: SearchOptions = {},
  ): CommandInfo[] {
    if (!this.isInitialized || !query.trim()) {
      return commandSubset || this.commands;
    }

    const {
      maxResults = 10,
      minScore = 0.1,
      enableFuzzy = true,
      enableSemantic: _enableSemantic = false,
      categoryFilter,
      sortBy = "score",
    } = options;

    const _searchTarget = commandSubset || this.commands;
    const results: SearchResult[] = [];

    // 検索クエリを正規化
    const _normalizedQuery = query.toLowerCase().trim();

    for (let i = 0; i < _searchTarget.length; i++) {
      const _command = _searchTarget[i];
      if (!_command) {
        continue;
      }

      // カテゴリフィルタ適用
      if (categoryFilter && _command.category !== categoryFilter) {
        continue;
      }

      const _searchResult = this.scoreCommand(
        _command,
        _normalizedQuery,
        enableFuzzy,
      );

      if (_searchResult.score >= minScore) {
        results.push(_searchResult);
      }
    }

    // ソート
    this.sortResults(results, sortBy);

    // 最大件数で制限
    const _limitedResults = results.slice(0, maxResults);

    this.emit("searchCompleted", _limitedResults);

    return _limitedResults.map((r) => r._command);
  }

  /**
   * リアルタイム検索(インクリメンタル)
   */
  public searchIncremental(
    _query: string,
    options: SearchOptions = {},
  ): CommandInfo[] {
    // デバウンス処理は呼び出し側で実装
    return this.search(_query, undefined, options);
  }

  /**
   * コマンドの検索スコアを計算
   */
  private scoreCommand(
    _command: CommandInfo,
    query: string,
    enableFuzzy: boolean,
  ): SearchResult {
    let maxScore = 0;
    let matchType: SearchResult["matchType"] = "fuzzy";
    const matchedText: string[] = [];

    // 1. 完全一致検索 (最高スコア)
    const _exactScore = this.calculateExactMatch(_command, query);
    if (_exactScore.score > maxScore) {
      maxScore = _exactScore.score;
      matchType = "exact";
      matchedText.push(..._exactScore.matches);
    }

    // 2. 前方一致検索
    const _prefixScore = this.calculatePrefixMatch(_command, query);
    if (_prefixScore.score > maxScore) {
      maxScore = _prefixScore.score;
      matchType = "prefix";
      matchedText.push(..._prefixScore.matches);
    }

    // 3. あいまい検索 (Fuzzy matching)
    if (enableFuzzy) {
      const _fuzzyScore = this.calculateFuzzyMatch(_command, query);
      if (_fuzzyScore.score > maxScore) {
        maxScore = _fuzzyScore.score;
        matchType = "fuzzy";
        matchedText.push(..._fuzzyScore.matches);
      }
    }

    // 4. 使用頻度ボーナス (0-20点)
    const _frequencyBonus = Math.min(20, command.frequency / 5);

    // 5. 最近使用ボーナス (0-10点)
    const _recentBonus = this.calculateRecentBonus(command.lastUsed);

    const _finalScore = maxScore + _frequencyBonus + _recentBonus;

    return {
      _command,
      score: _finalScore,
      matchType,
      matchedText,
    };
  }

  /**
   * 完全一致スコアを計算
   */
  private calculateExactMatch(
    _command: CommandInfo,
    query: string,
  ): { score: number; matches: string[] } {
    const matches: string[] = [];
    let score = 0;

    // コマンド名の完全一致
    if (_command.name.toLowerCase() === query) {
      score = 100;
      matches.push(_command.name);
    }

    // エイリアスの完全一致
    if (_command.aliases) {
      for (const alias of _command.aliases) {
        if (alias.toLowerCase() === query) {
          score = Math.max(score, 95);
          matches.push(alias);
        }
      }
    }

    // 説明内の単語完全一致
    const _descWords = _command.description.toLowerCase().split(/\s+/);
    if (_descWords.includes(query)) {
      score = Math.max(score, 80);
      matches.push(query);
    }

    return { score, matches };
  }

  /**
   * 前方一致スコアを計算
   */
  private calculatePrefixMatch(
    _command: CommandInfo,
    query: string,
  ): { score: number; matches: string[] } {
    const matches: string[] = [];
    let score = 0;

    // コマンド名の前方一致
    if (_command.name.toLowerCase().startsWith(query)) {
      const _ratio = query.length / _command.name.length;
      score = 80 * _ratio;
      matches.push(_command.name);
    }

    // エイリアスの前方一致
    if (_command.aliases) {
      for (const alias of _command.aliases) {
        if (alias.toLowerCase().startsWith(query)) {
          const _ratio = query.length / alias.length;
          score = Math.max(score, 75 * _ratio);
          matches.push(alias);
        }
      }
    }

    // 説明内の単語前方一致
    const _descWords = _command.description.toLowerCase().split(/\s+/);
    for (const word of _descWords) {
      if (word.startsWith(query)) {
        const _ratio = query.length / word.length;
        score = Math.max(score, 60 * _ratio);
        matches.push(word);
      }
    }

    return { score, matches };
  }

  /**
   * あいまい検索スコアを計算(Levenshtein _distance based)
   */
  private calculateFuzzyMatch(
    _command: CommandInfo,
    query: string,
  ): { score: number; matches: string[] } {
    const matches: string[] = [];
    let maxScore = 0;

    // コマンド名のあいまい一致
    const _nameScore = this.calculateLevenshteinSimilarity(
      _command.name.toLowerCase(),
      query,
    );
    if (_nameScore > 0.3) {
      // 30%以上の類似度
      maxScore = _nameScore * 60;
      matches.push(_command.name);
    }

    // エイリアスのあいまい一致
    if (_command.aliases) {
      for (const alias of _command.aliases) {
        const _aliasScore = this.calculateLevenshteinSimilarity(
          alias.toLowerCase(),
          query,
        );
        if (_aliasScore > 0.3) {
          maxScore = Math.max(maxScore, _aliasScore * 55);
          matches.push(alias);
        }
      }
    }

    // 説明内の単語あいまい一致
    const _descWords = _command.description.toLowerCase().split(/\s+/);
    for (const word of _descWords) {
      if (word.length >= query.length * 0.5) {
        // 短すぎる単語は除外
        const _wordScore = this.calculateLevenshteinSimilarity(word, query);
        if (_wordScore > 0.4) {
          maxScore = Math.max(maxScore, _wordScore * 40);
          matches.push(word);
        }
      }
    }

    return { score: maxScore, matches };
  }

  /**
   * Levenshtein距離ベースの類似度を計算
   */
  private calculateLevenshteinSimilarity(_str1: string, str2: string): number {
    const _distance = this.levenshteinDistance(_str1, str2);
    const _maxLength = Math.max(_str1.length, str2.length);
    return _maxLength === 0 ? 1 : 1 - _distance / _maxLength;
  }

  /**
   * Levenshtein距離を計算
   */
  private levenshteinDistance(_str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= _str1.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= _str1.length; j++) {
        if (str2.charAt(i - 1) === _str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1, // insertion
            matrix[i - 1]![j]! + 1, // deletion
          );
        }
      }
    }

    return matrix[str2.length]![_str1.length]!;
  }

  /**
   * 最近使用ボーナスを計算
   */
  private calculateRecentBonus(lastUsed?: Date): number {
    if (!lastUsed) {
      return 0;
    }

    const _now = new Date();
    const _diffHours = (_now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60);

    if (_diffHours < 1) {
      return 10;
    } // 1時間以内
    if (_diffHours < 24) {
      return 8;
    } // 1日以内
    if (_diffHours < 168) {
      return 5;
    } // 1週間以内
    if (_diffHours < 720) {
      return 2;
    } // 1ヶ月以内

    return 0;
  }

  /**
   * 検索結果をソート
   */
  private sortResults(_results: SearchResult[], sortBy: string): void {
    switch (sortBy) {
      case "score":
        results.sort((a, b) => b.score - a.score);
        break;

      case "frequency":
        results.sort((a, b) => b.command.frequency - a.command.frequency);
        break;

      case "recent":
        results.sort((a, b) => {
          const _aTime = a.command.lastUsed?.getTime() || 0;
          const _bTime = b.command.lastUsed?.getTime() || 0;
          return _bTime - _aTime;
        });
        break;

      case "alphabetical":
        results.sort((a, b) => a.command.name.localeCompare(b.command.name));
        break;

      default:
        // スコア順(デフォルト)
        results.sort((a, b) => b.score - a.score);
    }
  }

  /**
   * 検索インデックスを構築
   */
  private async buildSearchIndex(): Promise<void> {
    this.searchIndex.clear();

    for (let i = 0; i < this.commands.length; i++) {
      const _command = this.commands[i];
      if (!_command) {
        continue;
      }

      // コマンド名をインデックスに追加
      this.addToIndex(_command.name.toLowerCase(), i);

      // エイリアスをインデックスに追加
      if (_command.aliases) {
        command.aliases.forEach((alias) => {
          this.addToIndex(alias.toLowerCase(), i);
        });
      }

      // 説明の単語をインデックスに追加
      const _descWords = _command.description.toLowerCase().split(/\s+/);
      descWords.forEach((word) => {
        if (word.length > 2) {
          // 短すぎる単語は除外
          this.addToIndex(word, i);
        }
      });

      // カテゴリをインデックスに追加
      this.addToIndex(_command.category.toLowerCase(), i);
    }
  }

  /**
   * 検索インデックスに追加
   */
  private addToIndex(_term: string, commandIndex: number): void {
    if (!this.searchIndex.has(_term)) {
      this.searchIndex.set(_term, new Set());
    }

    this.searchIndex.get(_term)!.add(commandIndex);
  }

  /**
   * 検索統計を取得
   */
  public getSearchStats(): {
    totalCommands: number;
    indexedTerms: number;
    averageTermsPerCommand: number;
  } {
    return {
      totalCommands: this.commands.length,
      indexedTerms: this.searchIndex.size,
      averageTermsPerCommand:
        this.commands.length > 0
          ? this.searchIndex.size / this.commands.length
          : 0,
    };
  }

  /**
   * 検索結果をハイライト
   */
  public highlightMatches(_text: string, query: string): string {
    if (!query) {
      return _text;
    }

    const _regex = new RegExp(`(${this.escapeRegex(query)})`, "gi");
    return _text.replace(_regex, "**$1**");
  }

  /**
   * 正規表現用にエスケープ
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "$&");
  }

  /**
   * リソースをクリーンアップ
   */
  public dispose(): void {
    this.removeAllListeners();
    this.commands = [];
    this.searchIndex.clear();
    this.isInitialized = false;
  }
}
