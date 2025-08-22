/**
 * Interactive Help Service
 * インタラクティブヘルプサービス - /helpコマンドの対話型UI制御
 */

import { EventEmitter } from 'events';
import { CommandSearchEngine } from './CommandSearchEngine';
import { KeyboardNavigationHandler } from './KeyboardNavigationHandler';
import { CommandFrequencyTracker } from './CommandFrequencyTracker';

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

export interface HelpState {
  isActive: boolean;
  selectedIndex: number;
  selectedCategory: string;
  searchQuery: string;
  displayMode: 'list' | 'grid' | 'tree';
  filteredCommands: CommandInfo[];
  categories: string[];
  showDetails: boolean;
}

export interface NavigationAction {
  type: 'up' | 'down' | 'left' | 'right' | 'select' | 'exit' | 'search' | 'filter';
  payload?: unknown;
}

export class InteractiveHelpService extends EventEmitter {
  private state: HelpState;
  private searchEngine: CommandSearchEngine;
  private navigationHandler: KeyboardNavigationHandler;
  private frequencyTracker: CommandFrequencyTracker;
  private commands: CommandInfo[];
  private isInitialized = false;

  constructor() {
    super();

    this.state = {
      isActive: false,
      selectedIndex: 0,
      selectedCategory: 'all',
      searchQuery: '',
      displayMode: 'list',
      filteredCommands: [],
      categories: [],
      showDetails: false,
    };

    this.commands = [];
    this.searchEngine = new CommandSearchEngine();
    this.navigationHandler = new KeyboardNavigationHandler();
    this.frequencyTracker = new CommandFrequencyTracker();

    this.setupEventListeners();
  }

  /**
   * 初期化
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // コマンド一覧を取得
      this.commands = await this.loadAllCommands();

      // カテゴリ一覧を生成
      this.state.categories = this.extractCategories(this.commands);

      // 検索エンジン初期化
      await this.searchEngine.initialize(this.commands);

      // 使用頻度トラッカー初期化
      await this.frequencyTracker.initialize();

      // コマンドに使用頻度を追加
      this.commands = this.commands.map((cmd) => ({
        ...cmd,
        frequency: this.frequencyTracker.getCommandFrequency(cmd.name),
        lastUsed: this.frequencyTracker.getLastUsedDate(cmd.name),
      }));

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * インタラクティブヘルプを開始
   */
  public async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.state.isActive = true;
    this.state.selectedIndex = 0;
    this.state.searchQuery = '';
    this.state.selectedCategory = 'all';

    // 初期表示用のコマンド一覧を設定
    this.updateFilteredCommands();

    // キーボードナビゲーション開始
    this.navigationHandler.start();

    this.emit('started');
  }

  /**
   * インタラクティブヘルプを停止
   */
  public stop(): void {
    this.state.isActive = false;
    this.navigationHandler.stop();
    this.emit('stopped');
  }

  /**
   * ナビゲーションアクションを処理
   */
  public handleNavigation(action: NavigationAction): void {
    if (!this.state.isActive) return;

    switch (action.type) {
      case 'up':
        this.moveSelection(-1);
        break;

      case 'down':
        this.moveSelection(1);
        break;

      case 'left':
        this.previousCategory();
        break;

      case 'right':
        this.nextCategory();
        break;

      case 'select':
        this.selectCurrentCommand();
        break;

      case 'exit':
        this.stop();
        break;

      case 'search':
        this.enterSearchMode();
        break;

      case 'filter':
        this.toggleFilter(action.payload as string);
        break;
    }
  }

  /**
   * 検索クエリを更新
   */
  public updateSearch(query: string): void {
    this.state.searchQuery = query;
    this.updateFilteredCommands();
    this.state.selectedIndex = 0; // 検索結果の最初にリセット
    this.emit('searchUpdated', query);
  }

  /**
   * 現在の状態を取得
   */
  public getState(): HelpState {
    return { ...this.state };
  }

  /**
   * 表示用のコマンド情報を取得
   */
  public getDisplayInfo(): {
    commands: CommandInfo[];
    selectedCommand: CommandInfo | null;
    categories: string[];
    currentCategory: string;
  } {
    return {
      commands: this.state.filteredCommands,
      selectedCommand: this.state.filteredCommands[this.state.selectedIndex] || null,
      categories: this.state.categories,
      currentCategory: this.state.selectedCategory,
    };
  }

  /**
   * 全コマンドを読み込み
   */
  private async loadAllCommands(): Promise<CommandInfo[]> {
    // 実際の実装では、generated/commands から自動的に読み込む
    // 今回はサンプルデータで代用
    return [
      {
        name: 'code',
        description: 'Generate code with AI assistance',
        usage: '/code "description" [--file=path] [--template=name]',
        category: 'development',
        examples: ['/code "create REST API"', '/code "add validation"'],
        frequency: 95,
        aliases: ['c'],
      },
      {
        name: 'test',
        description: 'Generate and run tests',
        usage: '/test [file]',
        category: 'development',
        examples: ['/test', '/test src/auth.ts'],
        frequency: 80,
        aliases: ['t'],
      },
      {
        name: 'review',
        description: 'Review code for improvements',
        usage: '/review [file|pr]',
        category: 'development',
        examples: ['/review', '/review --pr=123'],
        frequency: 70,
        aliases: ['r'],
      },
      {
        name: 'init',
        description: 'Initialize project with AI guidance',
        usage: '/init [type]',
        category: 'project',
        examples: ['/init', '/init react'],
        frequency: 45,
        aliases: ['i'],
      },
      {
        name: 'config',
        description: 'Manage configuration settings',
        usage: '/config [get|set|list]',
        category: 'configuration',
        examples: ['/config list', '/config set theme dark'],
        frequency: 35,
        aliases: ['cfg'],
      },
      {
        name: 'settings',
        description: 'Advanced settings management',
        usage: '/settings [view|edit|reset]',
        category: 'configuration',
        examples: ['/settings view', '/settings edit general'],
        frequency: 25,
        aliases: ['set'],
      },
      {
        name: 'setup',
        description: 'Initial setup wizard',
        usage: '/setup [quick|advanced|team]',
        category: 'configuration',
        examples: ['/setup quick', '/setup advanced'],
        frequency: 15,
        aliases: ['s'],
      },
      {
        name: 'help',
        description: 'Show comprehensive help',
        usage: '/help [topic]',
        category: 'information',
        examples: ['/help', '/help code'],
        frequency: 60,
        aliases: ['h', '?'],
      },
      {
        name: 'model',
        description: 'Switch AI models',
        usage: '/model [list|<model-name>]',
        category: 'configuration',
        examples: ['/model gpt-4', '/model list'],
        frequency: 40,
        aliases: ['m'],
      },
      {
        name: 'clear',
        description: 'Clear conversation context',
        usage: '/clear',
        category: 'conversation',
        examples: ['/clear'],
        frequency: 55,
        aliases: ['cl'],
      },
      {
        name: 'image',
        description: 'Generate images with AI',
        usage: '/image "description"',
        category: 'media',
        examples: ['/image "sunset over mountains"'],
        frequency: 30,
        aliases: ['img'],
      },
      {
        name: 'video',
        description: 'Create videos with AI',
        usage: '/video "description"',
        category: 'media',
        examples: ['/video "product demo"'],
        frequency: 20,
        aliases: ['vid'],
      },
    ];
  }

  /**
   * カテゴリ一覧を抽出
   */
  private extractCategories(commands: CommandInfo[]): string[] {
    const categories = new Set<string>();
    categories.add('all');

    commands.forEach((cmd) => {
      categories.add(cmd.category);
    });

    return Array.from(categories).sort();
  }

  /**
   * フィルタ済みコマンド一覧を更新
   */
  private updateFilteredCommands(): void {
    let filtered = [...this.commands];

    // カテゴリフィルタ
    if (this.state.selectedCategory !== 'all') {
      filtered = filtered.filter((cmd) => cmd.category === this.state.selectedCategory);
    }

    // 検索フィルタ
    if (this.state.searchQuery) {
      filtered = this.searchEngine.search(this.state.searchQuery, filtered);
    }

    // 使用頻度でソート（デフォルト）
    filtered.sort((a, b) => b.frequency - a.frequency);

    this.state.filteredCommands = filtered;

    // 選択インデックスを調整
    if (this.state.selectedIndex >= filtered.length) {
      this.state.selectedIndex = Math.max(0, filtered.length - 1);
    }

    this.emit('commandsFiltered', filtered);
  }

  /**
   * 選択位置を移動
   */
  private moveSelection(delta: number): void {
    const newIndex = this.state.selectedIndex + delta;
    const maxIndex = this.state.filteredCommands.length - 1;

    if (newIndex < 0) {
      this.state.selectedIndex = maxIndex; // 循環: 最初から最後へ
    } else if (newIndex > maxIndex) {
      this.state.selectedIndex = 0; // 循環: 最後から最初へ
    } else {
      this.state.selectedIndex = newIndex;
    }

    this.emit('selectionChanged', this.state.selectedIndex);
  }

  /**
   * 前のカテゴリに移動
   */
  private previousCategory(): void {
    const currentIndex = this.state.categories.indexOf(this.state.selectedCategory);
    const newIndex = currentIndex > 0 ? currentIndex - 1 : this.state.categories.length - 1;

    this.state.selectedCategory = this.state.categories[newIndex] || 'all';
    this.updateFilteredCommands();
    this.state.selectedIndex = 0;

    this.emit('categoryChanged', this.state.selectedCategory);
  }

  /**
   * 次のカテゴリに移動
   */
  private nextCategory(): void {
    const currentIndex = this.state.categories.indexOf(this.state.selectedCategory);
    const newIndex = currentIndex < this.state.categories.length - 1 ? currentIndex + 1 : 0;

    this.state.selectedCategory = this.state.categories[newIndex] || 'all';
    this.updateFilteredCommands();
    this.state.selectedIndex = 0;

    this.emit('categoryChanged', this.state.selectedCategory);
  }

  /**
   * 現在選択中のコマンドを実行
   */
  private selectCurrentCommand(): void {
    const selectedCommand = this.state.filteredCommands[this.state.selectedIndex];
    if (!selectedCommand) return;

    // 使用頻度を更新
    this.frequencyTracker.recordUsage(selectedCommand.name);

    this.emit('commandSelected', selectedCommand);
    this.stop();
  }

  /**
   * 検索モードに入る
   */
  private enterSearchMode(): void {
    this.emit('searchModeEntered');
  }

  /**
   * フィルタを切り替え
   */
  private toggleFilter(filterType: string): void {
    // 今後の拡張用
    this.emit('filterToggled', filterType);
  }

  /**
   * イベントリスナーをセットアップ
   */
  private setupEventListeners(): void {
    // キーボードナビゲーションイベント
    this.navigationHandler.on('keyPressed', (key: string, modifiers: string[]) => {
      this.handleKeyPress(key, modifiers);
    });

    // 検索エンジンイベント
    this.searchEngine.on('searchCompleted', (results: CommandInfo[]) => {
      this.emit('searchResults', results);
    });

    // 頻度トラッカーイベント
    this.frequencyTracker.on('frequencyUpdated', (commandName: string, frequency: number) => {
      this.emit('frequencyUpdated', commandName, frequency);
    });
  }

  /**
   * キープレスを処理
   */
  private handleKeyPress(key: string, modifiers: string[]): void {
    if (!this.state.isActive) return;

    const hasCtrl = modifiers.includes('ctrl');
    const hasShift = modifiers.includes('shift');

    switch (key) {
      case 'ArrowUp':
      case 'k': // Vim binding
        this.handleNavigation({ type: 'up' });
        break;

      case 'ArrowDown':
      case 'j': // Vim binding
        this.handleNavigation({ type: 'down' });
        break;

      case 'ArrowLeft':
      case 'h': // Vim binding
        this.handleNavigation({ type: 'left' });
        break;

      case 'ArrowRight':
      case 'l': // Vim binding
        this.handleNavigation({ type: 'right' });
        break;

      case 'Enter':
        this.handleNavigation({ type: 'select' });
        break;

      case 'Escape':
      case 'q': // Vim binding
        this.handleNavigation({ type: 'exit' });
        break;

      case '/':
        if (!hasCtrl && !hasShift) {
          this.handleNavigation({ type: 'search' });
        }
        break;
    }
  }

  /**
   * リソースをクリーンアップ
   */
  public dispose(): void {
    this.stop();
    this.removeAllListeners();
    this.searchEngine.dispose();
    this.navigationHandler.dispose();
    this.frequencyTracker.dispose();
  }
}
