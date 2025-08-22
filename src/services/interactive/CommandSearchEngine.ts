/**
 * Command Search Engine
 * コマンド検索エンジン - 高速・あいまい検索機能
 */

import { EventEmitter } from 'events';

export interface SearchResult {
  command: CommandInfo;
  score: number;
  matchType: 'exact' | 'prefix' | 'fuzzy' | 'semantic';
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
  sortBy?: 'score' | 'frequency' | 'recent' | 'alphabetical';
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
    this.emit('initialized');
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
      sortBy = 'score',
    } = options;

    const searchTarget = commandSubset || this.commands;
    const results: SearchResult[] = [];

    // 検索クエリを正規化
    const normalizedQuery = query.toLowerCase().trim();

    for (let i = 0; i < searchTarget.length; i++) {
      const command = searchTarget[i];
      if (!command) {continue;}

      // カテゴリフィルタ適用
      if (categoryFilter && command.category !== categoryFilter) {
        continue;
      }

      const searchResult = this.scoreCommand(command, normalizedQuery, enableFuzzy);

      if (searchResult.score >= minScore) {
        results.push(searchResult);
      }
    }

    // ソート
    this.sortResults(results, sortBy);

    // 最大件数で制限
    const limitedResults = results.slice(0, maxResults);

    this.emit('searchCompleted', limitedResults);

    return limitedResults.map((r) => r.command);
  }

  /**
   * リアルタイム検索（インクリメンタル）
   */
  public searchIncremental(query: string, options: SearchOptions = {}): CommandInfo[] {
    // デバウンス処理は呼び出し側で実装
    return this.search(query, undefined, options);
  }

  /**
   * コマンドの検索スコアを計算
   */
  private scoreCommand(command: CommandInfo, query: string, enableFuzzy: boolean): SearchResult {
    let maxScore = 0;
    let matchType: SearchResult['matchType'] = 'fuzzy';
    const matchedText: string[] = [];

    // 1. 完全一致検索 (最高スコア)
    const exactScore = this.calculateExactMatch(command, query);
    if (exactScore.score > maxScore) {
      maxScore = exactScore.score;
      matchType = 'exact';
      matchedText.push(...exactScore.matches);
    }

    // 2. 前方一致検索
    const prefixScore = this.calculatePrefixMatch(command, query);
    if (prefixScore.score > maxScore) {
      maxScore = prefixScore.score;
      matchType = 'prefix';
      matchedText.push(...prefixScore.matches);
    }

    // 3. あいまい検索 (Fuzzy matching)
    if (enableFuzzy) {
      const fuzzyScore = this.calculateFuzzyMatch(command, query);
      if (fuzzyScore.score > maxScore) {
        maxScore = fuzzyScore.score;
        matchType = 'fuzzy';
        matchedText.push(...fuzzyScore.matches);
      }
    }

    // 4. 使用頻度ボーナス (0-20点)
    const frequencyBonus = Math.min(20, command.frequency / 5);

    // 5. 最近使用ボーナス (0-10点)
    const recentBonus = this.calculateRecentBonus(command.lastUsed);

    const finalScore = maxScore + frequencyBonus + recentBonus;

    return {
      command,
      score: finalScore,
      matchType,
      matchedText,
    };
  }

  /**
   * 完全一致スコアを計算
   */
  private calculateExactMatch(
    command: CommandInfo,
    query: string,
  ): { score: number; matches: string[] } {
    const matches: string[] = [];
    let score = 0;

    // コマンド名の完全一致
    if (command.name.toLowerCase() === query) {
      score = 100;
      matches.push(command.name);
    }

    // エイリアスの完全一致
    if (command.aliases) {
      for (const alias of command.aliases) {
        if (alias.toLowerCase() === query) {
          score = Math.max(score, 95);
          matches.push(alias);
        }
      }
    }

    // 説明内の単語完全一致
    const descWords = command.description.toLowerCase().split(/\s+/);
    if (descWords.includes(query)) {
      score = Math.max(score, 80);
      matches.push(query);
    }

    return { score, matches };
  }

  /**
   * 前方一致スコアを計算
   */
  private calculatePrefixMatch(
    command: CommandInfo,
    query: string,
  ): { score: number; matches: string[] } {
    const matches: string[] = [];
    let score = 0;

    // コマンド名の前方一致
    if (command.name.toLowerCase().startsWith(query)) {
      const ratio = query.length / command.name.length;
      score = 80 * ratio;
      matches.push(command.name);
    }

    // エイリアスの前方一致
    if (command.aliases) {
      for (const alias of command.aliases) {
        if (alias.toLowerCase().startsWith(query)) {
          const ratio = query.length / alias.length;
          score = Math.max(score, 75 * ratio);
          matches.push(alias);
        }
      }
    }

    // 説明内の単語前方一致
    const descWords = command.description.toLowerCase().split(/\s+/);
    for (const word of descWords) {
      if (word.startsWith(query)) {
        const ratio = query.length / word.length;
        score = Math.max(score, 60 * ratio);
        matches.push(word);
      }
    }

    return { score, matches };
  }

  /**
   * あいまい検索スコアを計算（Levenshtein distance based）
   */
  private calculateFuzzyMatch(
    command: CommandInfo,
    query: string,
  ): { score: number; matches: string[] } {
    const matches: string[] = [];
    let maxScore = 0;

    // コマンド名のあいまい一致
    const nameScore = this.calculateLevenshteinSimilarity(command.name.toLowerCase(), query);
    if (nameScore > 0.3) {
      // 30%以上の類似度
      maxScore = nameScore * 60;
      matches.push(command.name);
    }

    // エイリアスのあいまい一致
    if (command.aliases) {
      for (const alias of command.aliases) {
        const aliasScore = this.calculateLevenshteinSimilarity(alias.toLowerCase(), query);
        if (aliasScore > 0.3) {
          maxScore = Math.max(maxScore, aliasScore * 55);
          matches.push(alias);
        }
      }
    }

    // 説明内の単語あいまい一致
    const descWords = command.description.toLowerCase().split(/\s+/);
    for (const word of descWords) {
      if (word.length >= query.length * 0.5) {
        // 短すぎる単語は除外
        const wordScore = this.calculateLevenshteinSimilarity(word, query);
        if (wordScore > 0.4) {
          maxScore = Math.max(maxScore, wordScore * 40);
          matches.push(word);
        }
      }
    }

    return { score: maxScore, matches };
  }

  /**
   * Levenshtein距離ベースの類似度を計算
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  /**
   * Levenshtein距離を計算
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
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

    return matrix[str2.length]![str1.length]!;
  }

  /**
   * 最近使用ボーナスを計算
   */
  private calculateRecentBonus(lastUsed?: Date): number {
    if (!lastUsed) {return 0;}

    const now = new Date();
    const diffHours = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) {return 10;} // 1時間以内
    if (diffHours < 24) {return 8;} // 1日以内
    if (diffHours < 168) {return 5;} // 1週間以内
    if (diffHours < 720) {return 2;} // 1ヶ月以内

    return 0;
  }

  /**
   * 検索結果をソート
   */
  private sortResults(results: SearchResult[], sortBy: string): void {
    switch (sortBy) {
      case 'score':
        results.sort((a, b) => b.score - a.score);
        break;

      case 'frequency':
        results.sort((a, b) => b.command.frequency - a.command.frequency);
        break;

      case 'recent':
        results.sort((a, b) => {
          const aTime = a.command.lastUsed?.getTime() || 0;
          const bTime = b.command.lastUsed?.getTime() || 0;
          return bTime - aTime;
        });
        break;

      case 'alphabetical':
        results.sort((a, b) => a.command.name.localeCompare(b.command.name));
        break;

      default:
        // スコア順（デフォルト）
        results.sort((a, b) => b.score - a.score);
    }
  }

  /**
   * 検索インデックスを構築
   */
  private async buildSearchIndex(): Promise<void> {
    this.searchIndex.clear();

    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i];
      if (!command) {continue;}

      // コマンド名をインデックスに追加
      this.addToIndex(command.name.toLowerCase(), i);

      // エイリアスをインデックスに追加
      if (command.aliases) {
        command.aliases.forEach((alias) => {
          this.addToIndex(alias.toLowerCase(), i);
        });
      }

      // 説明の単語をインデックスに追加
      const descWords = command.description.toLowerCase().split(/\s+/);
      descWords.forEach((word) => {
        if (word.length > 2) {
          // 短すぎる単語は除外
          this.addToIndex(word, i);
        }
      });

      // カテゴリをインデックスに追加
      this.addToIndex(command.category.toLowerCase(), i);
    }
  }

  /**
   * 検索インデックスに追加
   */
  private addToIndex(term: string, commandIndex: number): void {
    if (!this.searchIndex.has(term)) {
      this.searchIndex.set(term, new Set());
    }

    this.searchIndex.get(term)!.add(commandIndex);
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
        this.commands.length > 0 ? this.searchIndex.size / this.commands.length : 0,
    };
  }

  /**
   * 検索結果をハイライト
   */
  public highlightMatches(text: string, query: string): string {
    if (!query) {return text;}

    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return text.replace(regex, '**$1**');
  }

  /**
   * 正規表現用にエスケープ
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
