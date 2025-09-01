/**
 * CommandAutocompleteUI
 * スラッシュコマンドの自動補完UI表示
 */

import chalk from "chalk";
import { CommandRecommendation } from "../../services/command-recommendation/types";
import { CommandCategory } from "../../lib/command-groups";

export interface AutocompleteUIConfig {
  maxVisibleItems?: number;
  showCategories?: boolean;
  showScores?: boolean;
  showUsage?: boolean;
  compactMode?: boolean;
  width?: number;
}

export interface AutocompletePosition {
  x: number;
  y: number;
}

export class CommandAutocompleteUI {
  private suggestions: CommandRecommendation[] = [];
  private selectedIndex: number = 0;
  private isVisible: boolean = false;
  private config: Required<AutocompleteUIConfig>;

  // カテゴリー色分けマッピング - 白色統一
  private readonly categoryColors: Record<CommandCategory, typeof chalk> = {
    core: chalk.white,
    generation: chalk.white,
    analysis: chalk.white,
    quality: chalk.white,
    development: chalk.white,
    workflow: chalk.white,
    configuration: chalk.white,
    auth: chalk.white,
    media: chalk.white,
    integration: chalk.white,
    system: chalk.white,
    optimization: chalk.white,
    creative: chalk.white,
    implementation: chalk.white,
    evolution: chalk.white,
    monitoring: chalk.white,
    file: chalk.white,
    "coding-agent": chalk.white,
  };

  constructor(_config: AutocompleteUIConfig = {}) {
    this._config = {
      maxVisibleItems: _config.maxVisibleItems || 10,
      showCategories: _config.showCategories ?? true,
      showScores: _config.showScores ?? false,
      showUsage: _config.showUsage ?? false,
      compactMode: _config.compactMode ?? false,
      width: _config.width || 80,
    };
  }

  /**
   * 候補を表示
   */
  show(suggestions: CommandRecommendation[]): void {
    this.suggestions = suggestions;
    this.selectedIndex = 0;
    this.isVisible = true;
  }

  /**
   * 候補を非表示
   */
  hide(): void {
    this.isVisible = false;
    this.suggestions = [];
    this.selectedIndex = 0;
  }

  /**
   * 次の項目を選択
   */
  selectNext(): void {
    if (this.suggestions.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
  }

  /**
   * 前の項目を選択
   */
  selectPrevious(): void {
    if (this.suggestions.length === 0) return;
    this.selectedIndex =
      this.selectedIndex === 0
        ? this.suggestions.length - 1
        : this.selectedIndex - 1;
  }

  /**
   * 現在選択中の項目を取得
   */
  getCurrentSelection(): CommandRecommendation | null {
    if (!this.isVisible || this.suggestions.length === 0) {
      return null;
    }
    return this.suggestions[this.selectedIndex] || null;
  }

  /**
   * 表示状態を確認
   */
  isShown(): boolean {
    return this.isVisible && this.suggestions.length > 0;
  }

  /**
   * 候補数を取得
   */
  getItemCount(): number {
    return this.suggestions.length;
  }

  /**
   * 選択インデックスを取得
   */
  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /**
   * 候補リストを更新
   */
  updateSuggestions(suggestions: CommandRecommendation[]): void {
    this.suggestions = suggestions;
    // 選択インデックスを有効範囲に調整
    if (this.selectedIndex >= suggestions.length) {
      this.selectedIndex = Math.max(0, suggestions.length - 1);
    }
  }

  /**
   * UI表示用の文字列を生成
   */
  render(): string {
    if (!this.isVisible || this.suggestions.length === 0) {
      return "";
    }

    const _visibleItems = this.suggestions.slice(
      0,
      this.config.maxVisibleItems,
    );
    const lines: string[] = [];

    // ヘッダー行
    if (!this.config.compactMode) {
      const _header = this.formatHeader();
      lines.push(_header);
      lines.push(this.formatSeparator());
    }

    // 候補項目
    _visibleItems.forEach((suggestion, _index) => {
      const _isSelected = _index === this.selectedIndex;
      const _line = this.formatSuggestionLine(suggestion, _isSelected, _index);
      lines.push(_line);
    });

    // フッター(省略表示)
    if (this.suggestions.length > this.config.maxVisibleItems) {
      const _remaining = this.suggestions.length - this.config.maxVisibleItems;
      const _footer = chalk.dim(`... and ${_remaining} more commands`);
      lines.push(_footer);
    }

    return lines.join("\n");
  }

  /**
   * コンパクトモード用のレンダリング
   */
  renderCompact(): string {
    if (!this.isVisible || this.suggestions.length === 0) {
      return "";
    }

    const _currentSelection = this.getCurrentSelection();
    if (!_currentSelection) {
      return "";
    }

    const _colorFn =
      this.categoryColors[_currentSelection.category] || chalk.white;
    return _colorFn(
      `${_currentSelection.command} - ${_currentSelection.description}`,
    );
  }

  /**
   * インライン表示用(入力行の隣に表示)
   */
  renderInline(): string {
    if (!this.isVisible || this.suggestions.length === 0) {
      return "";
    }

    const _currentSelection = this.getCurrentSelection();
    if (!_currentSelection) {
      return "";
    }

    const _colorFn =
      this.categoryColors[_currentSelection.category] || chalk.gray;
    return _colorFn.dim(`  ${_currentSelection.command}`);
  }

  /**
   * ヘッダーを整形
   */
  private formatHeader(): string {
    const _title = "Command Suggestions";
    const _info = `${this.suggestions.length} found`;
    const _padding = " ".repeat(
      Math.max(0, this.config.width - _title.length - _info.length - 2),
    );
    return chalk.white(_title) + _padding + chalk.dim(_info);
  }

  /**
   * セパレーター行を整形
   */
  private formatSeparator(): string {
    return chalk.white("─".repeat(this.config.width));
  }

  /**
   * 候補行を整形
   */
  private formatSuggestionLine(
    _suggestion: CommandRecommendation,
    _isSelected: boolean,
    _index: number,
  ): string {
    const _colorFn = this.categoryColors[_suggestion.category] || chalk.white;

    // 選択状態のスタイリング
    const _selectedStyle = _isSelected ? chalk.inverse : (_x: string) => _x;
    const _prefix = _isSelected ? "► " : "  ";

    let _line = `${_prefix}${_colorFn(_suggestion.command)}`;

    // 説明文
    const _description = this.truncateText(_suggestion._description, 40);
    _line += chalk.dim(` - ${_description}`);

    // カテゴリー表示
    if (this.config.showCategories) {
      const _categoryText = `[${_suggestion.category}]`;
      _line += " " + chalk.dim.italic(_categoryText);
    }

    // スコア表示(デバッグ用)
    if (this.config.showScores) {
      const _score = `(${_suggestion.combinedScore.toFixed(2)})`;
      _line += " " + chalk.dim.yellow(_score);
    }

    // 使用法表示
    if (this.config.showUsage && _suggestion.usage) {
      _line += "\n    " + chalk.dim.italic(`Usage: ${_suggestion.usage}`);
    }

    return _selectedStyle(_line);
  }

  /**
   * テキストを指定長で切り詰める
   */
  private truncateText(_text: string, maxLength: number): string {
    if (_text.length <= maxLength) {
      return _text;
    }
    return _text.substring(0, maxLength - 3) + "...";
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<AutocompleteUIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 詳細情報を取得(選択中のコマンドの)
   */
  getDetailedInfo(): string {
    const _selection = this.getCurrentSelection();
    if (!_selection) {
      return "";
    }

    const lines: string[] = [];
    const _colorFn = this.categoryColors[_selection.category] || chalk.white;

    // コマンド名
    lines.push(_colorFn.bold(_selection.command));

    // 説明
    lines.push(chalk.white(_selection.description));

    // カテゴリー
    lines.push(chalk.dim(`Category: ${_selection.category}`));

    // 使用法
    if (_selection.usage) {
      lines.push(chalk.dim(`Usage: ${_selection.usage}`));
    }

    // エイリアス
    if (_selection.aliases.length > 0) {
      lines.push(chalk.dim(`Aliases: ${_selection.aliases.join(", ")}`));
    }

    // 例
    if (_selection.examples.length > 0 && _selection.examples.length <= 2) {
      lines.push(chalk.dim("Examples:"));
      _selection.examples.forEach((example) => {
        lines.push(chalk.dim(`  ${example}`));
      });
    }

    return lines.join("\n");
  }

  /**
   * キーボードショートカットのヘルプ
   */
  getKeyboardHelp(): string {
    if (!this.isVisible) {
      return "";
    }

    return chalk.dim("↑/↓: Navigate • Enter: Select • Esc: Cancel");
  }

  /**
   * 現在の状態情報
   */
  getStatusInfo(): { visible: boolean; count: number; selected: number } {
    return {
      visible: this.isVisible,
      count: this.suggestions.length,
      selected: this.selectedIndex,
    };
  }
}
