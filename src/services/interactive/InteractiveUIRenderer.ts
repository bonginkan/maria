/**
 * Interactive UI Renderer
 * インタラクティブUI描画サービス - ターミナル表示制御
 */

import chalk from 'chalk';
import { CommandInfo } from './CommandSearchEngine';
import { CompletionSuggestion } from './SlashCompletionService';

export interface RenderOptions {
  width?: number;
  height?: number;
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
  top: number;
  visible: number;
  total: number;
}

export class InteractiveUIRenderer {
  private options: Required<RenderOptions>;
  private theme: DisplayTheme;
  private terminalWidth: number;
  private terminalHeight: number;

  constructor(options: RenderOptions = {}) {
    this.terminalWidth = process.stdout.columns || 80;
    this.terminalHeight = process.stdout.rows || 24;

    this.options = {
      width: options.width || this.terminalWidth,
      height: options.height || Math.min(20, this.terminalHeight - 4),
      showLineNumbers: options.showLineNumbers || false,
      showScrollbar: options.showScrollbar || true,
      enableColors: options.enableColors !== false,
      compactMode: options.compactMode || false,
    };

    this.theme = {
      primary: '#3b82f6', // blue-500
      secondary: '#6b7280', // gray-500
      accent: '#f59e0b', // amber-500
      success: '#10b981', // emerald-500
      warning: '#f59e0b', // amber-500
      error: '#ef4444', // red-500
      muted: '#9ca3af', // gray-400
      background: '#1f2937', // gray-800
      border: '#374151', // gray-700
    };
  }

  /**
   * インタラクティブヘルプパネルを描画
   */
  public renderHelpPanel(
    commands: CommandInfo[],
    selectedIndex: number,
    currentCategory: string,
    categories: string[],
    searchQuery: string = '',
    scrollState?: ScrollState,
  ): string {
    const lines: string[] = [];

    // ヘッダー
    lines.push(this.renderHeader('MARIA Interactive Command Helper', 'ESC: Exit'));

    // カテゴリバー
    lines.push(this.renderCategoryBar(categories, currentCategory));

    // 検索バー（クエリがある場合）
    if (searchQuery) {
      lines.push(this.renderSearchBar(searchQuery, commands.length));
    }

    // コマンドリスト
    const listLines = this.renderCommandList(commands, selectedIndex, scrollState);
    lines.push(...listLines);

    // 選択中のコマンド詳細
    const selectedCommand = commands[selectedIndex];
    if (selectedCommand) {
      lines.push(this.renderCommandDetails(selectedCommand));
    }

    // フッター（キーバインド）
    lines.push(
      this.renderFooter([
        'Arrow Keys: Navigate',
        'Enter: Execute',
        '/: Search',
        'Tab: Toggle Mode',
      ]),
    );

    return this.assemblePanel(lines);
  }

  /**
   * スラッシュ補完ポップアップを描画
   */
  public renderCompletionPopup(
    suggestions: CompletionSuggestion[],
    selectedIndex: number,
    query: string,
    position: { x: number; y: number } = { x: 0, y: 0 },
  ): string {
    if (suggestions.length === 0) return '';

    const lines: string[] = [];
    const maxWidth = Math.min(50, this.terminalWidth - position.x - 2);

    // ヘッダー
    const header = query ? `Completions for "/${query}"` : 'Available Commands';
    lines.push(this.renderBoxHeader(header, `[${selectedIndex + 1}/${suggestions.length}]`));

    // 補完候補リスト
    suggestions.slice(0, 7).forEach((suggestion, index) => {
      const isSelected = index === selectedIndex;
      const line = this.renderCompletionItem(suggestion, isSelected, maxWidth - 4);
      lines.push(line);
    });

    // フッター
    lines.push(this.renderBoxFooter(['Shift: Cycle', 'Enter: Select', 'Esc: Cancel']));

    return this.assemblePopup(lines, position);
  }

  /**
   * プログレスバーを描画
   */
  public renderProgressBar(
    current: number,
    total: number,
    label: string = '',
    width: number = 40,
  ): string {
    const percentage = total > 0 ? current / total : 0;
    const filled = Math.round(width * percentage);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percent = Math.round(percentage * 100);

    if (this.options.enableColors) {
      const coloredBar =
        chalk.hex(this.theme.success)(bar.substring(0, filled)) +
        chalk.hex(this.theme.muted)(bar.substring(filled));
      return `${label} ${coloredBar} ${percent}%`;
    }

    return `${label} [${bar}] ${percent}%`;
  }

  /**
   * ステータスラインを描画
   */
  public renderStatusLine(mode: string, commandCount: number, selectedCommand?: string): string {
    const left = `Mode: ${mode} | Commands: ${commandCount}`;
    const right = selectedCommand ? `Selected: ${selectedCommand}` : '';

    return this.renderHorizontalLayout(left, right, this.options.width);
  }

  /**
   * エラーメッセージを描画
   */
  public renderError(message: string, details?: string): string {
    const lines: string[] = [];

    if (this.options.enableColors) {
      lines.push(chalk.hex(this.theme.error).bold('✗ Error'));
      lines.push(chalk.hex(this.theme.error)(message));
      if (details) {
        lines.push(chalk.hex(this.theme.muted)(details));
      }
    } else {
      lines.push(`[!] Error: ${message}`);
      if (details) {
        lines.push(`    ${details}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 成功メッセージを描画
   */
  public renderSuccess(message: string, details?: string): string {
    const lines: string[] = [];

    if (this.options.enableColors) {
      lines.push(chalk.hex(this.theme.success).bold('✓ Success'));
      lines.push(chalk.hex(this.theme.success)(message));
      if (details) {
        lines.push(chalk.hex(this.theme.muted)(details));
      }
    } else {
      lines.push(`[✓] ${message}`);
      if (details) {
        lines.push(`    ${details}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * ヘッダーを描画
   */
  private renderHeader(title: string, rightText: string = ''): string {
    const padding = this.options.width - title.length - rightText.length;
    const line = `${title}${' '.repeat(Math.max(0, padding))}${rightText}`;

    if (this.options.enableColors) {
      return chalk.hex(this.theme.primary).bold(this.wrapInBorder(line));
    }

    return this.wrapInBorder(line);
  }

  /**
   * カテゴリバーを描画
   */
  private renderCategoryBar(categories: string[], currentCategory: string): string {
    const items = categories.map((cat) => {
      const isSelected = cat === currentCategory;
      const display = `[${cat}]`;

      if (this.options.enableColors) {
        return isSelected
          ? chalk.hex(this.theme.accent).bold(display)
          : chalk.hex(this.theme.muted)(display);
      }

      return isSelected ? `*${display}*` : display;
    });

    const content = `Categories: ${items.join(' ')}`;
    return this.wrapInBorder(content);
  }

  /**
   * 検索バーを描画
   */
  private renderSearchBar(query: string, resultCount: number): string {
    const content = `Search: "${query}" (${resultCount} results)`;

    if (this.options.enableColors) {
      return this.wrapInBorder(
        chalk.hex(this.theme.accent)('🔍 ') + chalk.hex(this.theme.primary)(content),
      );
    }

    return this.wrapInBorder(`Search: ${content}`);
  }

  /**
   * コマンドリストを描画
   */
  private renderCommandList(
    commands: CommandInfo[],
    selectedIndex: number,
    scrollState?: ScrollState,
  ): string[] {
    const lines: string[] = [];
    const visibleStart = scrollState?.top || 0;
    const visibleEnd = Math.min(visibleStart + (this.options.height - 6), commands.length);

    for (let i = visibleStart; i < visibleEnd; i++) {
      const command = commands[i];
      if (!command) continue;
      const isSelected = i === selectedIndex;
      const line = this.renderCommandItem(command, isSelected, i);
      lines.push(line);
    }

    return lines;
  }

  /**
   * コマンドアイテムを描画
   */
  private renderCommandItem(command: CommandInfo, isSelected: boolean, index: number): string {
    const prefix = isSelected ? '>' : ' ';
    const number = this.options.showLineNumbers ? `${index + 1}.`.padStart(3) : '';

    // 使用頻度バー（簡易版）
    const frequency = Math.min(5, Math.floor(command.frequency / 10));
    const freqBar = '█'.repeat(frequency).padEnd(5, '░');

    const nameWidth = 12;
    const descWidth = this.options.width - nameWidth - 15;

    const name = `/${command.name}`.padEnd(nameWidth);
    const desc = command.description.substring(0, descWidth).padEnd(descWidth);

    const content = `${number}${prefix} ${name} ${desc} ${freqBar}`;

    if (this.options.enableColors && isSelected) {
      return this.wrapInBorder(chalk.hex(this.theme.accent).bold(content));
    } else if (this.options.enableColors) {
      return this.wrapInBorder(
        chalk.hex(this.theme.primary)(name) +
          ' ' +
          chalk.hex(this.theme.secondary)(desc) +
          ' ' +
          chalk.hex(this.theme.muted)(freqBar),
      );
    }

    return this.wrapInBorder(content);
  }

  /**
   * コマンド詳細を描画
   */
  private renderCommandDetails(command: CommandInfo): string {
    const lines: string[] = [];

    lines.push(`/${command.name} - ${command.description}`);
    lines.push(`Usage: ${command.usage}`);

    if (command.examples && command.examples.length > 0) {
      lines.push(`Examples: ${command.examples.join(', ')}`);
    }

    const content = lines.join('\n');

    if (this.options.enableColors) {
      return this.wrapInBorder(chalk.hex(this.theme.secondary)(content));
    }

    return this.wrapInBorder(content);
  }

  /**
   * 補完アイテムを描画
   */
  private renderCompletionItem(
    suggestion: CompletionSuggestion,
    isSelected: boolean,
    maxWidth: number,
  ): string {
    const prefix = isSelected ? '>' : ' ';
    const name = `/${suggestion.command.name}`;
    const desc = suggestion.command.description.substring(0, maxWidth - name.length - 4);
    const content = `${prefix} ${name.padEnd(15)} ${desc}`;

    if (this.options.enableColors && isSelected) {
      return this.wrapInBorder(chalk.hex(this.theme.accent).bold(content));
    } else if (this.options.enableColors) {
      return this.wrapInBorder(
        chalk.hex(this.theme.primary)(name) + ' ' + chalk.hex(this.theme.secondary)(desc),
      );
    }

    return this.wrapInBorder(content);
  }

  /**
   * フッターを描画
   */
  private renderFooter(shortcuts: string[]): string {
    const content = shortcuts.join(' | ');

    if (this.options.enableColors) {
      return this.wrapInBorder(chalk.hex(this.theme.muted)(content));
    }

    return this.wrapInBorder(content);
  }

  /**
   * ボックスヘッダーを描画
   */
  private renderBoxHeader(title: string, rightText: string = ''): string {
    const padding = Math.max(0, 40 - title.length - rightText.length);
    const content = `${title}${' '.repeat(padding)}${rightText}`;
    return `┌${'─'.repeat(content.length + 2)}┐\n│ ${content} │`;
  }

  /**
   * ボックスフッターを描画
   */
  private renderBoxFooter(shortcuts: string[]): string {
    const content = shortcuts.join(' | ');
    return `│ ${content.padEnd(content.length)} │\n└${'─'.repeat(content.length + 2)}┘`;
  }

  /**
   * 水平レイアウトを描画
   */
  private renderHorizontalLayout(left: string, right: string, width: number): string {
    const padding = Math.max(0, width - left.length - right.length);
    return `${left}${' '.repeat(padding)}${right}`;
  }

  /**
   * 枠線でラップ
   */
  private wrapInBorder(content: string): string {
    return `│ ${content.padEnd(this.options.width - 4)} │`;
  }

  /**
   * パネルを組み立て
   */
  private assemblePanel(lines: string[]): string {
    const topBorder = `┌${'─'.repeat(this.options.width - 2)}┐`;
    const bottomBorder = `└${'─'.repeat(this.options.width - 2)}┘`;

    return [topBorder, ...lines, bottomBorder].join('\n');
  }

  /**
   * ポップアップを組み立て
   */
  private assemblePopup(lines: string[], _position: { x: number; y: number }): string {
    // 簡易実装：位置指定は今後の拡張で実装
    return lines.join('\n');
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
  public updateTerminalSize(width: number, height: number): void {
    this.terminalWidth = width;
    this.terminalHeight = height;
    this.options.width = Math.min(this.options.width, width);
    this.options.height = Math.min(this.options.height, height - 4);
  }

  /**
   * 画面をクリア
   */
  public clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[0f');
  }

  /**
   * カーソル位置を移動
   */
  public moveCursor(x: number, y: number): void {
    process.stdout.write(`\x1b[${y};${x}H`);
  }

  /**
   * カーソルを隠す/表示
   */
  public setCursorVisible(visible: boolean): void {
    process.stdout.write(visible ? '\x1b[?25h' : '\x1b[?25l');
  }
}
