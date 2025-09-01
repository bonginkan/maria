/**
 * Keyboard Navigation Handler
 * キーボードナビゲーションハンドラー - キー入力制御とイベント管理
 */

import { EventEmitter } from "node:events";
import { ReadStream } from "tty";

export interface KeyEvent {
  _key: string;
  _modifiers: string[];
  _raw: string;
  _sequence: string;
}

export interface NavigationMode {
  name: "normal" | "search" | "completion" | "help";
  keyBindings: KeyBindingSet;
  description: string;
}

export interface KeyBindingSet {
  [_key: string]: {
    _action: string;
    description: string;
    _modifiers?: string[];
    vim?: boolean;
  };
}

export class KeyboardNavigationHandler extends EventEmitter {
  private isActive = false;
  private _currentMode: NavigationMode["name"] = "normal";
  private stdin: ReadStream | null = null;
  private originalTTY: {
    _raw: boolean;
    fd: number;
  } | null = null;

  private navigationModes: Record<string, NavigationMode> = {
    normal: {
      name: "normal",
      description: "Normal navigation mode",
      keyBindings: {
        ArrowUp: { _action: "moveUp", description: "Move selection up" },
        ArrowDown: { _action: "moveDown", description: "Move selection down" },
        ArrowLeft: { _action: "moveLeft", description: "Move category left" },
        ArrowRight: {
          _action: "moveRight",
          description: "Move category right",
        },
        Enter: { _action: "select", description: "Select current _item" },
        Escape: { _action: "exit", description: "Exit current mode" },
        Tab: { _action: "toggleMode", description: "Toggle display mode" },
        "/": { _action: "search", description: "Enter search mode" },
        "?": { _action: "help", description: "Show help" },
        q: { _action: "exit", description: "Quit", vim: true },
        k: { _action: "moveUp", description: "Move up (vim)", vim: true },
        j: { _action: "moveDown", description: "Move down (vim)", vim: true },
        h: { _action: "moveLeft", description: "Move left (vim)", vim: true },
        l: { _action: "moveRight", description: "Move right (vim)", vim: true },
        g: { _action: "goTop", description: "Go to top (vim)", vim: true },
        G: {
          _action: "goBottom",
          description: "Go to bottom (vim)",
          vim: true,
        },
      },
    },

    search: {
      name: "search",
      description: "Search input mode",
      keyBindings: {
        Enter: { _action: "submitSearch", description: "Submit search query" },
        Escape: { _action: "cancelSearch", description: "Cancel search" },
        ArrowUp: { _action: "searchHistory", description: "Previous search" },
        ArrowDown: { _action: "searchHistory", description: "Next search" },
        Backspace: { _action: "deleteChar", description: "Delete character" },
        Delete: { _action: "deleteChar", description: "Delete character" },
        Tab: { _action: "searchComplete", description: "Auto-complete search" },
      },
    },

    completion: {
      name: "completion",
      description: "Command completion mode",
      keyBindings: {
        ArrowUp: {
          _action: "completionUp",
          description: "Previous completion",
        },
        ArrowDown: {
          _action: "completionDown",
          description: "Next completion",
        },
        Enter: {
          _action: "selectCompletion",
          description: "Select completion",
        },
        Escape: {
          _action: "cancelCompletion",
          description: "Cancel completion",
        },
        Tab: { _action: "nextCompletion", description: "Next completion" },
        Shift: { _action: "cycleCompletion", description: "Cycle completions" },
      },
    },

    help: {
      name: "help",
      description: "Interactive help mode",
      keyBindings: {
        ArrowUp: { _action: "moveUp", description: "Move selection up" },
        ArrowDown: { _action: "moveDown", description: "Move selection down" },
        ArrowLeft: { _action: "moveLeft", description: "Previous category" },
        ArrowRight: { _action: "moveRight", description: "Next category" },
        Enter: { _action: "executeCommand", description: "Execute command" },
        Escape: { _action: "exitHelp", description: "Exit help" },
        "/": { _action: "searchCommands", description: "Search commands" },
        Space: { _action: "toggleDetails", description: "Toggle details" },
        f: { _action: "toggleFilter", description: "Toggle filters" },
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
    if (this.isActive) {
      return;
    }

    try {
      // 標準入力をRawモードに設定
      this.stdin = process.stdin as ReadStream;

      if (this.stdin.isTTY) {
        this.originalTTY = {
          _raw: this.stdin.isRaw,
          fd: (this.stdin as { fd: number }).fd,
        };

        this.stdin.setRawMode(true);
        this.stdin.resume();
        this.stdin.setEncoding("utf8");

        this.stdin.on("data", this.handleKeyInput.bind(this));
        this.stdin.on("_error", this.handleError.bind(this));
      }

      this.isActive = true;
      this.emit("navigationStarted");
    } catch (_error) {
      this.emit("_error", _error);
    }
  }

  /**
   * キーボードナビゲーションを停止
   */
  public stop(): void {
    if (!this.isActive) {
      return;
    }

    try {
      if (this.stdin && this.originalTTY) {
        this.stdin.removeAllListeners("data");
        this.stdin.removeAllListeners("_error");

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
      this.emit("navigationStopped");
    } catch (_error) {
      this.emit("_error", _error);
    }
  }

  /**
   * ナビゲーションモードを設定
   */
  public setMode(mode: NavigationMode["name"]): void {
    if (this.navigationModes[mode]) {
      this.currentMode = mode;
      this.emit("modeChanged", mode);
    }
  }

  /**
   * 現在のモードを取得
   */
  public getCurrentMode(): NavigationMode {
    return (
      this.navigationModes[this.currentMode] || this.navigationModes["normal"]
    );
  }

  /**
   * Vimモードの有効/無効を切り替え
   */
  public setVimMode(enabled: boolean): void {
    this.vimModeEnabled = enabled;
    this.emit("vimModeChanged", enabled);
  }

  /**
   * カスタムキーバインディングを追加
   */
  public addKeyBinding(
    _mode: string,
    _key: string,
    _binding: KeyBindingSet[string],
  ): void {
    const _navigationMode = this.navigationModes[_mode];
    if (_navigationMode) {
      navigationMode.keyBindings[_key] = _binding;
      this.emit("keyBindingAdded", _mode, _key, _binding);
    }
  }

  /**
   * キー入力を処理
   */
  private handleKeyInput(data: string): void {
    if (!this.isActive) {
      return;
    }

    const _keyEvent = this.parseKeyInput(data);

    // キーシーケンス処理
    this.handleKeySequence(_keyEvent);

    // 現在のモードに基づいてアクションを決定
    const _action = this.resolveKeyAction(_keyEvent);

    if (_action) {
      this.emit("keyPressed", _keyEvent._key, _keyEvent.modifiers);
      this.emit("actionTriggered", _action, _keyEvent);
    }

    this.emit("rawKeyInput", _keyEvent);
  }

  /**
   * キー入力を解析
   */
  private parseKeyInput(data: string): KeyEvent {
    const _key = data;
    const _modifiers: string[] = [];
    const _raw = data;
    const _sequence = data;

    // 修飾キーの検出
    if (data.charCodeAt(0) < 32) {
      // Control keys
      if (data.charCodeAt(0) === 27) {
        // Escape _sequence
        if (data.length > 1) {
          return this.parseEscapeSequence(data);
        }
        return { _key: "Escape", _modifiers: [], _raw, _sequence };
      }

      if (data.charCodeAt(0) <= 26) {
        modifiers.push("ctrl");
        return {
          _key: String.fromCharCode(data.charCodeAt(0) + 96), // a-z
          _modifiers,
          _raw,
          _sequence,
        };
      }
    }

    // 通常のキー
    return { _key, _modifiers, _raw, _sequence };
  }

  /**
   * Escapeシーケンスを解析
   */
  private parseEscapeSequence(data: string): KeyEvent {
    const _sequence = data;
    let _key = "";
    const _modifiers: string[] = [];

    // ANSI escape sequences
    if (data.startsWith("\u001b[")) {
      const _code = data.substring(2);

      switch (_code) {
        case "A":
          _key = "ArrowUp";
          break;
        case "B":
          _key = "ArrowDown";
          break;
        case "C":
          _key = "ArrowRight";
          break;
        case "D":
          _key = "ArrowLeft";
          break;
        case "H":
          _key = "Home";
          break;
        case "F":
          _key = "End";
          break;
        case "2~":
          _key = "Insert";
          break;
        case "3~":
          _key = "Delete";
          break;
        case "5~":
          _key = "PageUp";
          break;
        case "6~":
          _key = "PageDown";
          break;
        default:
          // Modified keys (Shift, Ctrl, Alt combinations)
          if (_code.includes(";")) {
            const [keyCode, modCode] = _code.split(";");
            if (!keyCode || !modCode) {
              return null;
            }
            const _mod = parseInt(modCode);

            if (_mod & 1) {
              _modifiers.push("shift");
            }
            if (_mod & 2) {
              _modifiers.push("alt");
            }
            if (_mod & 4) {
              _modifiers.push("ctrl");
            }

            switch (keyCode) {
              case "1":
                _key = this.getArrowKey(_code);
                break;
              default:
                _key = _code;
            }
          } else {
            _key = _code;
          }
      }
    } else if (data.startsWith("\u001b")) {
      // Alt + _key
      modifiers.push("alt");
      _key = data.substring(1);
    }

    return { _key: _key || data, _modifiers, _raw: data, _sequence };
  }

  /**
   * 矢印キーを取得
   */
  private getArrowKey(_code: string): string {
    const keyMap: Record<string, string> = {
      A: "ArrowUp",
      B: "ArrowDown",
      C: "ArrowRight",
      D: "ArrowLeft",
    };

    return keyMap[_code] || _code;
  }

  /**
   * キーシーケンス処理
   */
  private handleKeySequence(_keyEvent: KeyEvent): void {
    // シーケンスタイムアウトをリセット
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
    }

    // キーをシーケンスに追加
    this.keySequence.push(_keyEvent._key);

    // 複合キー検出 (例: "gg", "dd")
    if (this.vimModeEnabled && this.currentMode === "normal") {
      const _sequence = this.keySequence.join("");

      if (this.isCompleteSequence(_sequence)) {
        this.emit("sequenceCompleted", _sequence);
        this.keySequence = [];
        return;
      }
    }

    // シーケンスタイムアウト設定(1秒)
    this.sequenceTimeout = setTimeout(() => {
      this.keySequence = [];
      this.sequenceTimeout = null;
    }, 1000);
  }

  /**
   * 完了したシーケンスかチェック
   */
  private isCompleteSequence(_sequence: string): boolean {
    const _vimSequences = ["gg", "dd", "yy", "cc", "ZZ", "ZQ"];
    return _vimSequences.includes(_sequence);
  }

  /**
   * キーアクションを解決
   */
  private resolveKeyAction(_keyEvent: KeyEvent): string | null {
    const _currentMode = this.navigationModes[this._currentMode];
    if (!_currentMode) {
      return null;
    }
    const _currentBindings = _currentMode.keyBindings;

    // 完全一致チェック
    const _binding = _currentBindings[_keyEvent._key];
    if (_binding) {
      // Vimバインディングのチェック
      if (_binding.vim && !this.vimModeEnabled) {
        return null;
      }

      // 修飾キーのチェック
      if (_binding.modifiers) {
        const _hasAllModifiers = _binding.modifiers.every((_mod) =>
          _keyEvent.modifiers.includes(_mod),
        );
        if (!_hasAllModifiers) {
          return null;
        }
      }

      return _binding.action;
    }

    return null;
  }

  /**
   * デフォルトバインディングをセットアップ
   */
  private setupDefaultBindings(): void {
    // 全モード共通のバインディング
    const _globalBindings = {
      "Ctrl+c": {
        _action: "interrupt",
        description: "Interrupt current operation",
      },
      "Ctrl+d": { _action: "eof", description: "End of input" },
      "Ctrl+l": { _action: "clearScreen", description: "Clear screen" },
    };

    // 全モードにグローバルバインディングを追加
    Object.values(this.navigationModes).forEach((mode) => {
      Object.assign(mode.keyBindings, _globalBindings);
    });
  }

  /**
   * エラーハンドリング
   */
  private handleError(_error: Error): void {
    this.emit("_error", _error);
  }

  /**
   * キーバインディングヘルプを取得
   */
  public getKeyBindingsHelp(mode?: string): string {
    const _targetMode = mode || this.currentMode;
    const _modeConfig = this.navigationModes[_targetMode];

    if (!_modeConfig) {
      return "Unknown mode";
    }

    let help = `\n**${_modeConfig.description} - Key Bindings:**\n\n`;

    const _bindings = Object.entries(_modeConfig.keyBindings);
    const _normalBindings = _bindings.filter(([, _binding]) => !binding.vim);
    const _vimBindings = _bindings.filter(([, _binding]) => binding.vim);

    // 通常のキーバインディング
    help += "**Standard Keys:**\n";
    normalBindings.forEach(([_key, _binding]) => {
      const _modifiers = binding._modifiers?.join("+") || "";
      const _fullKey = _modifiers ? `${_modifiers}+${_key}` : _key;
      help += `  ${_fullKey.padEnd(12)} - ${binding.description}\n`;
    });

    // Vimキーバインディング
    if (_vimBindings.length > 0 && this.vimModeEnabled) {
      help += "\n**Vim Keys:**\n";
      vimBindings.forEach(([_key, _binding]) => {
        help += `  ${_key.padEnd(12)} - ${binding.description}\n`;
      });
    }

    return help;
  }

  /**
   * 現在の状態を取得
   */
  public getState(): {
    isActive: boolean;
    _currentMode: string;
    vimModeEnabled: boolean;
    keySequence: string[];
  } {
    return {
      isActive: this.isActive,
      _currentMode: this.currentMode,
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
