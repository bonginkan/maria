/**
 * Keyboard Navigation Handler
 * キーボードナビゲーションハンドラー - キー入力制御とイベント管理
 */

import { EventEmitter } from 'events';
import { ReadStream } from 'tty';

export interface KeyEvent {
  key: string;
  modifiers: string[];
  raw: string;
  sequence: string;
}

export interface NavigationMode {
  name: 'normal' | 'search' | 'completion' | 'help';
  keyBindings: KeyBindingSet;
  description: string;
}

export interface KeyBindingSet {
  [key: string]: {
    action: string;
    description: string;
    modifiers?: string[];
    vim?: boolean;
  };
}

export class KeyboardNavigationHandler extends EventEmitter {
  private isActive = false;
  private currentMode: NavigationMode['name'] = 'normal';
  private stdin: ReadStream | null = null;
  private originalTTY: {
    raw: boolean;
    fd: number;
  } | null = null;

  private navigationModes: Record<string, NavigationMode> = {
    normal: {
      name: 'normal',
      description: 'Normal navigation mode',
      keyBindings: {
        ArrowUp: { action: 'moveUp', description: 'Move selection up' },
        ArrowDown: { action: 'moveDown', description: 'Move selection down' },
        ArrowLeft: { action: 'moveLeft', description: 'Move category left' },
        ArrowRight: { action: 'moveRight', description: 'Move category right' },
        Enter: { action: 'select', description: 'Select current item' },
        Escape: { action: 'exit', description: 'Exit current mode' },
        Tab: { action: 'toggleMode', description: 'Toggle display mode' },
        '/': { action: 'search', description: 'Enter search mode' },
        '?': { action: 'help', description: 'Show help' },
        q: { action: 'exit', description: 'Quit', vim: true },
        k: { action: 'moveUp', description: 'Move up (vim)', vim: true },
        j: { action: 'moveDown', description: 'Move down (vim)', vim: true },
        h: { action: 'moveLeft', description: 'Move left (vim)', vim: true },
        l: { action: 'moveRight', description: 'Move right (vim)', vim: true },
        g: { action: 'goTop', description: 'Go to top (vim)', vim: true },
        G: { action: 'goBottom', description: 'Go to bottom (vim)', vim: true },
      },
    },

    search: {
      name: 'search',
      description: 'Search input mode',
      keyBindings: {
        Enter: { action: 'submitSearch', description: 'Submit search query' },
        Escape: { action: 'cancelSearch', description: 'Cancel search' },
        ArrowUp: { action: 'searchHistory', description: 'Previous search' },
        ArrowDown: { action: 'searchHistory', description: 'Next search' },
        Backspace: { action: 'deleteChar', description: 'Delete character' },
        Delete: { action: 'deleteChar', description: 'Delete character' },
        Tab: { action: 'searchComplete', description: 'Auto-complete search' },
      },
    },

    completion: {
      name: 'completion',
      description: 'Command completion mode',
      keyBindings: {
        ArrowUp: { action: 'completionUp', description: 'Previous completion' },
        ArrowDown: { action: 'completionDown', description: 'Next completion' },
        Enter: { action: 'selectCompletion', description: 'Select completion' },
        Escape: { action: 'cancelCompletion', description: 'Cancel completion' },
        Tab: { action: 'nextCompletion', description: 'Next completion' },
        Shift: { action: 'cycleCompletion', description: 'Cycle completions' },
      },
    },

    help: {
      name: 'help',
      description: 'Interactive help mode',
      keyBindings: {
        ArrowUp: { action: 'moveUp', description: 'Move selection up' },
        ArrowDown: { action: 'moveDown', description: 'Move selection down' },
        ArrowLeft: { action: 'moveLeft', description: 'Previous category' },
        ArrowRight: { action: 'moveRight', description: 'Next category' },
        Enter: { action: 'executeCommand', description: 'Execute command' },
        Escape: { action: 'exitHelp', description: 'Exit help' },
        '/': { action: 'searchCommands', description: 'Search commands' },
        Space: { action: 'toggleDetails', description: 'Toggle details' },
        f: { action: 'toggleFilter', description: 'Toggle filters' },
      },
    },
  };

  private keySequence: string[] = [];
  private sequenceTimeout: NodeJS.Timeout | null = null;
  private vimModeEnabled = false;

  constructor(vimMode = false) {
    super();
    this.vimModeEnabled = vimMode;
    this.setupDefaultBindings();
  }

  /**
   * キーボードナビゲーションを開始
   */
  public start(): void {
    if (this.isActive) return;

    try {
      // 標準入力をRawモードに設定
      this.stdin = process.stdin as ReadStream;

      if (this.stdin.isTTY) {
        this.originalTTY = {
          raw: this.stdin.isRaw,
          fd: (this.stdin as { fd: number }).fd,
        };

        this.stdin.setRawMode(true);
        this.stdin.resume();
        this.stdin.setEncoding('utf8');

        this.stdin.on('data', this.handleKeyInput.bind(this));
        this.stdin.on('error', this.handleError.bind(this));
      }

      this.isActive = true;
      this.emit('navigationStarted');
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * キーボードナビゲーションを停止
   */
  public stop(): void {
    if (!this.isActive) return;

    try {
      if (this.stdin && this.originalTTY) {
        this.stdin.removeAllListeners('data');
        this.stdin.removeAllListeners('error');

        if (this.stdin.isTTY) {
          this.stdin.setRawMode(this.originalTTY.raw);
          if (!this.originalTTY.raw) {
            this.stdin.pause();
          }
        }
      }

      if (this.sequenceTimeout) {
        clearTimeout(this.sequenceTimeout);
        this.sequenceTimeout = null;
      }

      this.isActive = false;
      this.keySequence = [];
      this.emit('navigationStopped');
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * ナビゲーションモードを設定
   */
  public setMode(mode: NavigationMode['name']): void {
    if (this.navigationModes[mode]) {
      this.currentMode = mode;
      this.emit('modeChanged', mode);
    }
  }

  /**
   * 現在のモードを取得
   */
  public getCurrentMode(): NavigationMode {
    return this.navigationModes[this.currentMode] || this.navigationModes['normal'];
  }

  /**
   * Vimモードの有効/無効を切り替え
   */
  public setVimMode(enabled: boolean): void {
    this.vimModeEnabled = enabled;
    this.emit('vimModeChanged', enabled);
  }

  /**
   * カスタムキーバインディングを追加
   */
  public addKeyBinding(mode: string, key: string, binding: KeyBindingSet[string]): void {
    const navigationMode = this.navigationModes[mode];
    if (navigationMode) {
      navigationMode.keyBindings[key] = binding;
      this.emit('keyBindingAdded', mode, key, binding);
    }
  }

  /**
   * キー入力を処理
   */
  private handleKeyInput(data: string): void {
    if (!this.isActive) return;

    const keyEvent = this.parseKeyInput(data);

    // キーシーケンス処理
    this.handleKeySequence(keyEvent);

    // 現在のモードに基づいてアクションを決定
    const action = this.resolveKeyAction(keyEvent);

    if (action) {
      this.emit('keyPressed', keyEvent.key, keyEvent.modifiers);
      this.emit('actionTriggered', action, keyEvent);
    }

    this.emit('rawKeyInput', keyEvent);
  }

  /**
   * キー入力を解析
   */
  private parseKeyInput(data: string): KeyEvent {
    const key = data;
    const modifiers: string[] = [];
    const raw = data;
    const sequence = data;

    // 修飾キーの検出
    if (data.charCodeAt(0) < 32) {
      // Control keys
      if (data.charCodeAt(0) === 27) {
        // Escape sequence
        if (data.length > 1) {
          return this.parseEscapeSequence(data);
        }
        return { key: 'Escape', modifiers: [], raw, sequence };
      }

      if (data.charCodeAt(0) <= 26) {
        modifiers.push('ctrl');
        return {
          key: String.fromCharCode(data.charCodeAt(0) + 96), // a-z
          modifiers,
          raw,
          sequence,
        };
      }
    }

    // 通常のキー
    return { key, modifiers, raw, sequence };
  }

  /**
   * Escapeシーケンスを解析
   */
  private parseEscapeSequence(data: string): KeyEvent {
    const sequence = data;
    let key = '';
    const modifiers: string[] = [];

    // ANSI escape sequences
    if (data.startsWith('\x1b[')) {
      const code = data.substring(2);

      switch (code) {
        case 'A':
          key = 'ArrowUp';
          break;
        case 'B':
          key = 'ArrowDown';
          break;
        case 'C':
          key = 'ArrowRight';
          break;
        case 'D':
          key = 'ArrowLeft';
          break;
        case 'H':
          key = 'Home';
          break;
        case 'F':
          key = 'End';
          break;
        case '2~':
          key = 'Insert';
          break;
        case '3~':
          key = 'Delete';
          break;
        case '5~':
          key = 'PageUp';
          break;
        case '6~':
          key = 'PageDown';
          break;
        default:
          // Modified keys (Shift, Ctrl, Alt combinations)
          if (code.includes(';')) {
            const [keyCode, modCode] = code.split(';');
            if (!keyCode || !modCode) return null;
            const mod = parseInt(modCode);

            if (mod & 1) modifiers.push('shift');
            if (mod & 2) modifiers.push('alt');
            if (mod & 4) modifiers.push('ctrl');

            switch (keyCode) {
              case '1':
                key = this.getArrowKey(code);
                break;
              default:
                key = code;
            }
          } else {
            key = code;
          }
      }
    } else if (data.startsWith('\x1b')) {
      // Alt + key
      modifiers.push('alt');
      key = data.substring(1);
    }

    return { key: key || data, modifiers, raw: data, sequence };
  }

  /**
   * 矢印キーを取得
   */
  private getArrowKey(code: string): string {
    const keyMap: Record<string, string> = {
      A: 'ArrowUp',
      B: 'ArrowDown',
      C: 'ArrowRight',
      D: 'ArrowLeft',
    };

    return keyMap[code] || code;
  }

  /**
   * キーシーケンス処理
   */
  private handleKeySequence(keyEvent: KeyEvent): void {
    // シーケンスタイムアウトをリセット
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
    }

    // キーをシーケンスに追加
    this.keySequence.push(keyEvent.key);

    // 複合キー検出 (例: "gg", "dd")
    if (this.vimModeEnabled && this.currentMode === 'normal') {
      const sequence = this.keySequence.join('');

      if (this.isCompleteSequence(sequence)) {
        this.emit('sequenceCompleted', sequence);
        this.keySequence = [];
        return;
      }
    }

    // シーケンスタイムアウト設定（1秒）
    this.sequenceTimeout = setTimeout(() => {
      this.keySequence = [];
      this.sequenceTimeout = null;
    }, 1000);
  }

  /**
   * 完了したシーケンスかチェック
   */
  private isCompleteSequence(sequence: string): boolean {
    const vimSequences = ['gg', 'dd', 'yy', 'cc', 'ZZ', 'ZQ'];
    return vimSequences.includes(sequence);
  }

  /**
   * キーアクションを解決
   */
  private resolveKeyAction(keyEvent: KeyEvent): string | null {
    const currentMode = this.navigationModes[this.currentMode];
    if (!currentMode) return null;
    const currentBindings = currentMode.keyBindings;

    // 完全一致チェック
    const binding = currentBindings[keyEvent.key];
    if (binding) {
      // Vimバインディングのチェック
      if (binding.vim && !this.vimModeEnabled) {
        return null;
      }

      // 修飾キーのチェック
      if (binding.modifiers) {
        const hasAllModifiers = binding.modifiers.every((mod) => keyEvent.modifiers.includes(mod));
        if (!hasAllModifiers) {
          return null;
        }
      }

      return binding.action;
    }

    return null;
  }

  /**
   * デフォルトバインディングをセットアップ
   */
  private setupDefaultBindings(): void {
    // 全モード共通のバインディング
    const globalBindings = {
      'Ctrl+c': { action: 'interrupt', description: 'Interrupt current operation' },
      'Ctrl+d': { action: 'eof', description: 'End of input' },
      'Ctrl+l': { action: 'clearScreen', description: 'Clear screen' },
    };

    // 全モードにグローバルバインディングを追加
    Object.values(this.navigationModes).forEach((mode) => {
      Object.assign(mode.keyBindings, globalBindings);
    });
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: Error): void {
    this.emit('error', error);
  }

  /**
   * キーバインディングヘルプを取得
   */
  public getKeyBindingsHelp(mode?: string): string {
    const targetMode = mode || this.currentMode;
    const modeConfig = this.navigationModes[targetMode];

    if (!modeConfig) {
      return 'Unknown mode';
    }

    let help = `\n**${modeConfig.description} - Key Bindings:**\n\n`;

    const bindings = Object.entries(modeConfig.keyBindings);
    const normalBindings = bindings.filter(([, binding]) => !binding.vim);
    const vimBindings = bindings.filter(([, binding]) => binding.vim);

    // 通常のキーバインディング
    help += '**Standard Keys:**\n';
    normalBindings.forEach(([key, binding]) => {
      const modifiers = binding.modifiers?.join('+') || '';
      const fullKey = modifiers ? `${modifiers}+${key}` : key;
      help += `  ${fullKey.padEnd(12)} - ${binding.description}\n`;
    });

    // Vimキーバインディング
    if (vimBindings.length > 0 && this.vimModeEnabled) {
      help += '\n**Vim Keys:**\n';
      vimBindings.forEach(([key, binding]) => {
        help += `  ${key.padEnd(12)} - ${binding.description}\n`;
      });
    }

    return help;
  }

  /**
   * 現在の状態を取得
   */
  public getState(): {
    isActive: boolean;
    currentMode: string;
    vimModeEnabled: boolean;
    keySequence: string[];
  } {
    return {
      isActive: this.isActive,
      currentMode: this.currentMode,
      vimModeEnabled: this.vimModeEnabled,
      keySequence: [...this.keySequence],
    };
  }

  /**
   * リソースをクリーンアップ
   */
  public dispose(): void {
    this.stop();
    this.removeAllListeners();

    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
    }
  }
}
