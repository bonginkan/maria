/**
 * Slash Completion Service
 * スラッシュコマンド補完サービス - リアルタイム補完とShiftキー循環
 */

import { EventEmitter } from 'events';
import { CommandInfo, CommandSearchEngine } from './CommandSearchEngine';
import { CommandFrequencyTracker } from './CommandFrequencyTracker';

export interface CompletionOptions {
  maxSuggestions?: number;
  enableFuzzy?: boolean;
  enableFrequencyBoost?: boolean;
  enableContextAware?: boolean;
  minQueryLength?: number;
}

export interface CompletionSuggestion {
  command: CommandInfo;
  matchedText: string;
  score: number;
  highlightedName: string;
  reason: 'exact' | 'prefix' | 'fuzzy' | 'frequent' | 'recent';
}

export interface CompletionState {
  isActive: boolean;
  query: string;
  suggestions: CompletionSuggestion[];
  selectedIndex: number;
  cycleIndex: number;
  isShiftCycling: boolean;
  context: string;
}

export class SlashCompletionService extends EventEmitter {
  private searchEngine: CommandSearchEngine;
  private frequencyTracker: CommandFrequencyTracker;
  private state: CompletionState;
  private commands: CommandInfo[] = [];
  private options: Required<CompletionOptions>;
  private isInitialized = false;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(options: CompletionOptions = {}) {
    super();

    this.options = {
      maxSuggestions: options.maxSuggestions || 7,
      enableFuzzy: options.enableFuzzy !== false,
      enableFrequencyBoost: options.enableFrequencyBoost !== false,
      enableContextAware: options.enableContextAware !== false,
      minQueryLength: options.minQueryLength || 1,
    };

    this.state = {
      isActive: false,
      query: '',
      suggestions: [],
      selectedIndex: 0,
      cycleIndex: 0,
      isShiftCycling: false,
      context: 'general',
    };

    this.searchEngine = new CommandSearchEngine();
    this.frequencyTracker = new CommandFrequencyTracker();
  }

  /**
   * 初期化
   */
  public async initialize(commands: CommandInfo[]): Promise<void> {
    if (this.isInitialized) {return;}

    try {
      this.commands = commands;
      await this.searchEngine.initialize(commands);
      await this.frequencyTracker.initialize();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 補完を開始
   */
  public startCompletion(query: string, context: string = 'general'): void {
    if (!this.isInitialized) {return;}

    this.state.isActive = true;
    this.state.context = context;
    this.state.isShiftCycling = false;
    this.state.cycleIndex = 0;

    this.updateQuery(query);
  }

  /**
   * 補完を停止
   */
  public stopCompletion(): void {
    this.state.isActive = false;
    this.state.query = '';
    this.state.suggestions = [];
    this.state.selectedIndex = 0;
    this.state.cycleIndex = 0;
    this.state.isShiftCycling = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.emit('completionStopped');
  }

  /**
   * クエリを更新（リアルタイム補完）
   */
  public updateQuery(query: string): void {
    if (!this.state.isActive) {return;}

    // 先頭の/を除去
    const cleanQuery = query.startsWith('/') ? query.slice(1) : query;

    if (cleanQuery === this.state.query) {return;}

    this.state.query = cleanQuery;
    this.state.selectedIndex = 0;
    this.state.isShiftCycling = false;

    // デバウンス処理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.generateSuggestions();
      this.debounceTimer = null;
    }, 50); // 50ms デバウンス
  }

  /**
   * 次の候補を選択（上下キー）
   */
  public selectNext(): void {
    if (!this.state.isActive || this.state.suggestions.length === 0) {return;}

    this.state.selectedIndex = (this.state.selectedIndex + 1) % this.state.suggestions.length;
    this.emit('selectionChanged', this.state.selectedIndex);
  }

  /**
   * 前の候補を選択（上下キー）
   */
  public selectPrevious(): void {
    if (!this.state.isActive || this.state.suggestions.length === 0) {return;}

    this.state.selectedIndex =
      this.state.selectedIndex > 0
        ? this.state.selectedIndex - 1
        : this.state.suggestions.length - 1;

    this.emit('selectionChanged', this.state.selectedIndex);
  }

  /**
   * Shiftキーで候補を循環
   */
  public cycleWithShift(): void {
    if (!this.state.isActive || this.state.suggestions.length === 0) {return;}

    this.state.isShiftCycling = true;
    this.state.cycleIndex = (this.state.cycleIndex + 1) % this.state.suggestions.length;
    this.state.selectedIndex = this.state.cycleIndex;

    this.emit('shiftCycled', this.state.cycleIndex);
    this.emit('selectionChanged', this.state.selectedIndex);
  }

  /**
   * 現在選択中の候補を取得
   */
  public getSelectedSuggestion(): CompletionSuggestion | null {
    if (!this.state.isActive || this.state.suggestions.length === 0) {
      return null;
    }

    return this.state.suggestions[this.state.selectedIndex] || null;
  }

  /**
   * 選択中の候補を実行
   */
  public executeSelected(): CompletionSuggestion | null {
    const selected = this.getSelectedSuggestion();
    if (!selected) {return null;}

    // 使用頻度を記録
    this.frequencyTracker.recordUsage(selected.command.name, this.state.context);

    this.emit('commandSelected', selected.command);
    this.stopCompletion();

    return selected;
  }

  /**
   * 自動補完（Tabキー）
   */
  public autoComplete(): string | null {
    const selected = this.getSelectedSuggestion();
    if (!selected) {return null;}

    const completion = selected.command.name;
    this.state.query = completion;

    this.emit('autoCompleted', completion);
    return completion;
  }

  /**
   * 現在の状態を取得
   */
  public getState(): CompletionState {
    return { ...this.state };
  }

  /**
   * 候補一覧を取得
   */
  public getSuggestions(): CompletionSuggestion[] {
    return [...this.state.suggestions];
  }

  /**
   * 補完候補を生成
   */
  private generateSuggestions(): void {
    if (this.state.query.length < this.options.minQueryLength) {
      this.state.suggestions = [];
      this.emit('suggestionsUpdated', []);
      return;
    }

    // 検索実行
    const searchResults = this.searchEngine.search(this.state.query, undefined, {
      maxResults: this.options.maxSuggestions * 2, // 多めに取得してフィルタ
      enableFuzzy: this.options.enableFuzzy,
      sortBy: 'score',
    });

    // 補完候補に変換
    const suggestions: CompletionSuggestion[] = [];

    for (const command of searchResults) {
      if (suggestions.length >= this.options.maxSuggestions) {break;}

      const suggestion = this.createCompletionSuggestion(command);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // 使用頻度による並び替え（オプション）
    if (this.options.enableFrequencyBoost) {
      suggestions.sort((a, b) => {
        const aFreq = this.frequencyTracker.getCommandFrequency(a.command.name);
        const bFreq = this.frequencyTracker.getCommandFrequency(b.command.name);

        // スコアと頻度を組み合わせて並び替え
        return b.score + bFreq * 0.1 - (a.score + aFreq * 0.1);
      });
    }

    this.state.suggestions = suggestions;
    this.emit('suggestionsUpdated', suggestions);
  }

  /**
   * 補完候補を作成
   */
  private createCompletionSuggestion(command: CommandInfo): CompletionSuggestion | null {
    const query = this.state.query.toLowerCase();
    const name = command.name.toLowerCase();

    // マッチタイプとスコアを決定
    let score = 0;
    let reason: CompletionSuggestion['reason'] = 'fuzzy';
    let matchedText = '';

    // 1. 完全一致
    if (name === query) {
      score = 100;
      reason = 'exact';
      matchedText = command.name;
    }
    // 2. 前方一致
    else if (name.startsWith(query)) {
      score = 80 * (query.length / name.length);
      reason = 'prefix';
      matchedText = command.name.substring(0, query.length);
    }
    // 3. 含有検索
    else if (name.includes(query)) {
      score = 60 * (query.length / name.length);
      reason = 'fuzzy';
      matchedText = query;
    }
    // 4. エイリアス検索
    else if (command.aliases?.some((alias) => alias.toLowerCase().startsWith(query))) {
      score = 70;
      reason = 'prefix';
      const matchingAlias = command.aliases.find((alias) => alias.toLowerCase().startsWith(query));
      matchedText = matchingAlias?.substring(0, query.length) || '';
    }

    // スコアが低すぎる場合は除外
    if (score < 10) {return null;}

    // 使用頻度ボーナス
    if (this.options.enableFrequencyBoost) {
      const frequency = this.frequencyTracker.getCommandFrequency(command.name);
      score += Math.min(20, frequency / 5);

      if (frequency > 50) {reason = 'frequent';}
    }

    // 最近使用ボーナス
    const lastUsed = this.frequencyTracker.getLastUsedDate(command.name);
    if (lastUsed) {
      const hoursSinceUsed = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUsed < 24) {
        score += 10;
        if (hoursSinceUsed < 1) {reason = 'recent';}
      }
    }

    // ハイライト表示用のテキストを生成
    const highlightedName = this.highlightMatch(command.name, query);

    return {
      command,
      matchedText,
      score,
      highlightedName,
      reason,
    };
  }

  /**
   * マッチした部分をハイライト
   */
  private highlightMatch(text: string, query: string): string {
    if (!query) {return text;}

    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return text.replace(regex, '**$1**');
  }

  /**
   * 正規表現エスケープ
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * コンテキストを設定
   */
  public setContext(context: string): void {
    this.state.context = context;
  }

  /**
   * オプションを更新
   */
  public updateOptions(newOptions: Partial<CompletionOptions>): void {
    Object.assign(this.options, newOptions);
  }

  /**
   * 統計情報を取得
   */
  public getCompletionStats(): {
    totalCompletions: number;
    averageQueryLength: number;
    mostCompletedCommand: string;
    completionAccuracy: number;
  } {
    // 簡単な実装（実際はより詳細な統計を追跡）
    return {
      totalCompletions: 0,
      averageQueryLength: 0,
      mostCompletedCommand: '',
      completionAccuracy: 0,
    };
  }

  /**
   * デバッグ情報を取得
   */
  public getDebugInfo(): {
    state: CompletionState;
    options: Required<CompletionOptions>;
    commandCount: number;
    searchEngineStats: { totalSearches: number; averageSearchTime: number };
  } {
    return {
      state: this.state,
      options: this.options,
      commandCount: this.commands.length,
      searchEngineStats: this.searchEngine.getSearchStats(),
    };
  }

  /**
   * リソースをクリーンアップ
   */
  public dispose(): void {
    this.stopCompletion();
    this.removeAllListeners();
    this.searchEngine.dispose();
    this.frequencyTracker.dispose();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.commands = [];
    this.isInitialized = false;
  }
}
