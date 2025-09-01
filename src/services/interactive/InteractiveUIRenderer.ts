/**
 * Interactive UI Renderer
 * インタラクティブUI描画サービス - ターミナル表示制御
 */

import chalk from "chalk";
import { CommandInfo } from "./CommandSearchEngine";
import { CompletionSuggestion } from "./SlashCompletionService";

export interface RenderOptions {
  width?: _number;
  height?: _number;
  showLineNumbers?: boolean;
  showScrollbar?: boolean;
  enableColors?: boolean;
  compactMode?: boolean;
}

export interface DisplayTheme {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  muted: string;
  background: string;
  border: string;
}

export interface ScrollState {
  top: _number;
  visible: _number;
  total: _number;
}

export class InteractiveUIRenderer {
  private options: Required<RenderOptions>;
  private theme: DisplayTheme;
  private terminalWidth: _number;
  private terminalHeight: _number;

  constructor(_options: RenderOptions = {}) {
    this.terminalWidth = process.stdout.columns || 80;
    this.terminalHeight = process.stdout.rows || 24;

    this._options = {
      width: _options.width || this.terminalWidth,
      height: _options.height || Math.min(20, this.terminalHeight - 4),
      showLineNumbers: _options.showLineNumbers || false,
      showScrollbar: _options.showScrollbar || true,
      enableColors: _options.enableColors !== false,
      compactMode: _options.compactMode || false,
    };

    this.theme = {
      primary: "#3b82f6", // blue-500
      secondary: "#6b7280", // gray-500
      accent: "#f59e0b", // amber-500
      success: "#10b981", // emerald-500
      warning: "#f59e0b", // amber-500
      error: "#ef4444", // red-500
      muted: "#9ca3af", // gray-400
      background: "#1f2937", // gray-800
      border: "#374151", // gray-700
    };
  }

  /**
   * インタラクティブヘルプパネルを描画
   */
  public renderHelpPanel(
    commands: CommandInfo[],
    selectedIndex: _number,
    currentCategory: string,
    categories: string[],
    searchQuery: string = "",
    scrollState?: ScrollState,
  ): string {
    const lines: string[] = [];

    // ヘッダー
    lines.push(
      this.renderHeader("MARIA Interactive Command Helper", "ESC: Exit"),
    );

    // カテゴリバー
    lines.push(this.renderCategoryBar(categories, currentCategory));

    // 検索バー(クエリがある場合)
    if (searchQuery) {
      lines.push(this.renderSearchBar(searchQuery, commands.length));
    }

    // コマンドリスト
    const _listLines = this.renderCommandList(
      commands,
      selectedIndex,
      scrollState,
    );
    lines.push(..._listLines);

    // 選択中のコマンド詳細
    const _selectedCommand = commands[selectedIndex];
    if (_selectedCommand) {
      lines.push(this.renderCommandDetails(_selectedCommand));
    }

    // フッター(キーバインド)
    lines.push(
      this.renderFooter([
        "Arrow Keys: Navigate",
        "Enter: Execute",
        "/: Search",
        "Tab: Toggle Mode",
      ]),
    );

    return this.assemblePanel(lines);
  }

  /**
   * スラッシュ補完ポップアップを描画
   */
  public renderCompletionPopup(
    suggestions: CompletionSuggestion[],
    selectedIndex: _number,
    query: string,
    position: { x: _number; y: _number } = { x: 0, y: 0 },
  ): string {
    if (suggestions.length === 0) {
      return "";
    }

    const lines: string[] = [];
    const _maxWidth = Math.min(50, this.terminalWidth - position.x - 2);

    // ヘッダー
    const _header = query
      ? `Completions for "/${query}"`
      : "Available Commands";
    lines.push(
      this.renderBoxHeader(
        _header,
        `[${selectedIndex + 1}/${suggestions.length}]`,
      ),
    );

    // 補完候補リスト
    suggestions.slice(0, 7).forEach((suggestion, _index) => {
      const _isSelected = _index === selectedIndex;
      const _line = this.renderCompletionItem(
        suggestion,
        _isSelected,
        _maxWidth - 4,
      );
      lines.push(_line);
    });

    // フッター
    lines.push(
      this.renderBoxFooter(["Shift: Cycle", "Enter: Select", "Esc: Cancel"]),
    );

    return this.assemblePopup(lines, position);
  }

  /**
   * プログレスバーを描画
   */
  public renderProgressBar(
    current: _number,
    total: _number,
    label: string = "",
    width: _number = 40,
  ): string {
    const _percentage = total > 0 ? current / total : 0;
    const _filled = Math.round(width * _percentage);
    const _empty = width - _filled;

    const _bar = "█".repeat(_filled) + "░".repeat(_empty);
    const _percent = Math.round(_percentage * 100);

    if (this.options.enableColors) {
      const _coloredBar =
        chalk.hex(this.theme.success)(_bar.substring(0, _filled)) +
        chalk.hex(this.theme.muted)(_bar.substring(_filled));
      return `${label} ${_coloredBar} ${_percent}%`;
    }

    return `${label} [${_bar}] ${_percent}%`;
  }

  /**
   * ステータスラインを描画
   */
  public renderStatusLine(
    _mode: string,
    commandCount: _number,
    _selectedCommand?: string,
  ): string {
    const _left = `Mode: ${_mode} | Commands: ${commandCount}`;
    const _right = _selectedCommand ? `Selected: ${_selectedCommand}` : "";

    return this.renderHorizontalLayout(_left, _right, this.options.width);
  }

  /**
   * エラーメッセージを描画
   */
  public renderError(_message: string, details?: string): string {
    const lines: string[] = [];

    if (this.options.enableColors) {
      lines.push(chalk.hex(this.theme.error).bold("✗ Error"));
      lines.push(chalk.hex(this.theme.error)(_message));
      if (details) {
        lines.push(chalk.hex(this.theme.muted)(details));
      }
    } else {
      lines.push(`[!] Error: ${_message}`);
      if (details) {
        lines.push(`    ${details}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * 成功メッセージを描画
   */
  public renderSuccess(_message: string, details?: string): string {
    const lines: string[] = [];

    if (this.options.enableColors) {
      lines.push(chalk.hex(this.theme.success).bold("✓ Success"));
      lines.push(chalk.hex(this.theme.success)(_message));
      if (details) {
        lines.push(chalk.hex(this.theme.muted)(details));
      }
    } else {
      lines.push(`[✓] ${_message}`);
      if (details) {
        lines.push(`    ${details}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * ヘッダーを描画
   */
  private renderHeader(_title: string, rightText: string = ""): string {
    const _padding = this.options.width - _title.length - rightText.length;
    const _line = `${_title}${" ".repeat(Math.max(0, _padding))}${rightText}`;

    if (this.options.enableColors) {
      return chalk.hex(this.theme.primary).bold(this.wrapInBorder(_line));
    }

    return this.wrapInBorder(_line);
  }

  /**
   * カテゴリバーを描画
   */
  private renderCategoryBar(
    _categories: string[],
    currentCategory: string,
  ): string {
    const _items = _categories.map((cat) => {
      const _isSelected = cat === currentCategory;
      const _display = `[${cat}]`;

      if (this.options.enableColors) {
        return _isSelected
          ? chalk.hex(this.theme.accent).bold(_display)
          : chalk.hex(this.theme.muted)(_display);
      }

      return _isSelected ? `*${_display}*` : _display;
    });

    const _content = `Categories: ${_items.join(" ")}`;
    return this.wrapInBorder(_content);
  }

  /**
   * 検索バーを描画
   */
  private renderSearchBar(_query: string, resultCount: _number): string {
    const _content = `Search: "${_query}" (${resultCount} results)`;

    if (this.options.enableColors) {
      return this.wrapInBorder(
        chalk.hex(this.theme.accent)("🔍 ") +
          chalk.hex(this.theme.primary)(_content),
      );
    }

    return this.wrapInBorder(`Search: ${_content}`);
  }

  /**
   * コマンドリストを描画
   */
  private renderCommandList(
    commands: CommandInfo[],
    selectedIndex: _number,
    scrollState?: ScrollState,
  ): string[] {
    const lines: string[] = [];
    const _visibleStart = scrollState?.top || 0;
    const _visibleEnd = Math.min(
      _visibleStart + (this.options.height - 6),
      commands.length,
    );

    for (let i = _visibleStart; i < _visibleEnd; i++) {
      const _command = commands[i];
      if (!_command) {
        continue;
      }
      const _isSelected = i === selectedIndex;
      const _line = this.renderCommandItem(_command, _isSelected, i);
      lines.push(_line);
    }

    return lines;
  }

  /**
   * コマンドアイテムを描画
   */
  private renderCommandItem(
    _command: CommandInfo,
    _isSelected: boolean,
    index: _number,
  ): string {
    const _prefix = _isSelected ? ">" : " ";
    const _number = this.options.showLineNumbers
      ? `${index + 1}.`.padStart(3)
      : "";

    // 使用頻度バー(簡易版)
    const _frequency = Math.min(5, Math.floor(_command._frequency / 10));
    const _freqBar = "█".repeat(_frequency).padEnd(5, "░");

    const _nameWidth = 12;
    const _descWidth = this.options.width - _nameWidth - 15;

    const _name = `/${_command._name}`.padEnd(_nameWidth);
    const _desc = _command.description
      .substring(0, _descWidth)
      .padEnd(_descWidth);

    const _content = `${_number}${_prefix} ${_name} ${_desc} ${_freqBar}`;

    if (this.options.enableColors && _isSelected) {
      return this.wrapInBorder(chalk.hex(this.theme.accent).bold(_content));
    } else if (this.options.enableColors) {
      return this.wrapInBorder(
        `${chalk.hex(this.theme.primary)(_name)} ${chalk.hex(
          this.theme.secondary,
        )(_desc)} ${chalk.hex(this.theme.muted)(_freqBar)}`,
      );
    }

    return this.wrapInBorder(_content);
  }

  /**
   * コマンド詳細を描画
   */
  private renderCommandDetails(_command: CommandInfo): string {
    const lines: string[] = [];

    lines.push(`/${_command.name} - ${_command.description}`);
    lines.push(`Usage: ${_command.usage}`);

    if (_command.examples && _command.examples.length > 0) {
      lines.push(`Examples: ${_command.examples.join(", ")}`);
    }

    const _content = lines.join("\n");

    if (this.options.enableColors) {
      return this.wrapInBorder(chalk.hex(this.theme.secondary)(_content));
    }

    return this.wrapInBorder(_content);
  }

  /**
   * 補完アイテムを描画
   */
  private renderCompletionItem(
    suggestion: CompletionSuggestion,
    _isSelected: boolean,
    _maxWidth: _number,
  ): string {
    const _prefix = _isSelected ? ">" : " ";
    const _name = `/${suggestion.command._name}`;
    const _desc = suggestion.command.description.substring(
      0,
      _maxWidth - _name.length - 4,
    );
    const _content = `${_prefix} ${_name.padEnd(15)} ${_desc}`;

    if (this.options.enableColors && _isSelected) {
      return this.wrapInBorder(chalk.hex(this.theme.accent).bold(_content));
    } else if (this.options.enableColors) {
      return this.wrapInBorder(
        `${chalk.hex(this.theme.primary)(_name)} ${chalk.hex(this.theme.secondary)(_desc)}`,
      );
    }

    return this.wrapInBorder(_content);
  }

  /**
   * フッターを描画
   */
  private renderFooter(shortcuts: string[]): string {
    const _content = shortcuts.join(" | ");

    if (this.options.enableColors) {
      return this.wrapInBorder(chalk.hex(this.theme.muted)(_content));
    }

    return this.wrapInBorder(_content);
  }

  /**
   * ボックスヘッダーを描画
   */
  private renderBoxHeader(_title: string, rightText: string = ""): string {
    const _padding = Math.max(0, 40 - _title.length - rightText.length);
    const _content = `${_title}${" ".repeat(_padding)}${rightText}`;
    return `┌${"─".repeat(_content.length + 2)}┐\n│ ${_content} │`;
  }

  /**
   * ボックスフッターを描画
   */
  private renderBoxFooter(shortcuts: string[]): string {
    const _content = shortcuts.join(" | ");
    return `│ ${_content.padEnd(_content.length)} │\n└${"─".repeat(_content.length + 2)}┘`;
  }

  /**
   * 水平レイアウトを描画
   */
  private renderHorizontalLayout(
    _left: string,
    _right: string,
    width: _number,
  ): string {
    const _padding = Math.max(0, width - left.length - right.length);
    return `${_left}${" ".repeat(_padding)}${_right}`;
  }

  /**
   * 枠線でラップ
   */
  private wrapInBorder(_content: string): string {
    return `│ ${_content.padEnd(this.options.width - 4)} │`;
  }

  /**
   * パネルを組み立て
   */
  private assemblePanel(lines: string[]): string {
    const _topBorder = `┌${"─".repeat(this.options.width - 2)}┐`;
    const _bottomBorder = `└${"─".repeat(this.options.width - 2)}┘`;

    return [_topBorder, ...lines, _bottomBorder].join("\n");
  }

  /**
   * ポップアップを組み立て
   */
  private assemblePopup(
    _lines: string[],
    _position: { x: _number; y: _number },
  ): string {
    // 簡易実装:位置指定は今後の拡張で実装
    return _lines.join("\n");
  }

  /**
   * テーマを更新
   */
  public updateTheme(newTheme: Partial<DisplayTheme>): void {
    Object.assign(this.theme, newTheme);
  }

  /**
   * レンダリングオプションを更新
   */
  public updateOptions(newOptions: Partial<RenderOptions>): void {
    Object.assign(this.options, newOptions);
  }

  /**
   * ターミナルサイズを更新
   */
  public updateTerminalSize(_width: _number, height: _number): void {
    this.terminalWidth = _width;
    this.terminalHeight = height;
    this.options._width = Math.min(this.options._width, _width);
    this.options.height = Math.min(this.options.height, height - 4);
  }

  /**
   * 画面をクリア
   */
  public clearScreen(): void {
    process.stdout.write("\u001b[2J\u001b[0f");
  }

  /**
   * カーソル位置を移動
   */
  public moveCursor(_x: _number, y: _number): void {
    process.stdout.write(`\u001b[${y};${_x}H`);
  }

  /**
   * カーソルを隠す/表示
   */
  public setCursorVisible(visible: boolean): void {
    process.stdout.write(visible ? "\u001b[?25h" : "\u001b[?25l");
  }
}
