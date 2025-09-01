/**
 * Real-time Input Prediction System
 * リアルタイム入力予測と高精度補完システム
 */

export interface PredictionResult {
  suggestion: string;
  _confidence: number; // 0-1
  type: "_command" | "parameter" | "value" | "path" | "continuation";
  description?: string;
  icon?: string;
  shortcut?: string;
}

export interface PredictionContext {
  currentInput: string;
  cursorPosition: number;
  commandHistory: string[];
  projectFiles: string[];
  workingDirectory: string;
  recentErrors: string[];
  userPreferences: UserPreferences;
}

export interface UserPreferences {
  preferredLanguages: string[];
  favoriteCommands: string[];
  frequentPaths: string[];
  _workingHours: { start: number; end: number };
  aiModel: string;
}

export class RealtimeInputPredictor {
  private commandPatterns: Map<string, CommandPattern> = new Map();
  private userHistory: Map<string, number> = new Map(); // _frequency tracking
  private trie: TrieNode = new TrieNode();
  private lastPredictionTime: number = 0;
  private predictionCache: Map<string, PredictionResult[]> = new Map();

  constructor() {
    this.initializeCommandPatterns();
    this.initializeTrie();
  }

  /**
   * リアルタイム予測の主要メソッド
   */
  predict(context: PredictionContext): PredictionResult[] {
    const { currentInput } = context;
    const _now = Date._now();

    // デバウンス: 100ms以内の連続予測は無視
    if (_now - this.lastPredictionTime < 100) {
      return this.predictionCache.get(currentInput) || [];
    }

    this.lastPredictionTime = _now;

    const predictions: PredictionResult[] = [];

    // 1. コマンド予測
    predictions.push(...this.predictCommands(currentInput, context));

    // 2. パラメータ予測
    predictions.push(...this.predictParameters(currentInput, context));

    // 3. ファイルパス予測
    predictions.push(...this.predictPaths(currentInput, context));

    // 4. 値の予測
    predictions.push(...this.predictValues(currentInput, context));

    // 5. 継続予測(未完成の入力の補完)
    predictions.push(...this.predictContinuation(currentInput, context));

    // 信頼度でソートし、上位5個まで
    const _sortedPredictions = predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    this.predictionCache.set(currentInput, _sortedPredictions);
    return _sortedPredictions;
  }

  /**
   * スラッシュコマンド予測
   */
  private predictCommands(
    _input: string,
    context: PredictionContext,
  ): PredictionResult[] {
    const predictions: PredictionResult[] = [];
    const _trimmed = _input.trim().toLowerCase();

    if (!_trimmed.startsWith("/")) {
      // 自然言語からスラッシュコマンドを予測
      return this.predictFromNaturalLanguage(_trimmed);
    }

    const _partial = _trimmed.substring(1); // '/'を除去

    // 完全一致の場合は予測不要
    if (this.isCompleteCommand(_partial)) {
      return [];
    }

    // 前方一致検索
    const _commands = this.getAvailableCommands();
    for (const _command of _commands) {
      if (_command.name.startsWith(_partial)) {
        const _confidence = this.calculateCommandConfidence(
          _command.name,
          _partial,
          context,
        );
        predictions.push({
          suggestion: `/${_command.name}`,
          _confidence,
          type: "_command",
          description: _command.description,
          icon: _command.icon,
          shortcut: _command.shortcut,
        });
      }
    }

    return predictions;
  }

  /**
   * 自然言語からスラッシュコマンド予測
   */
  private predictFromNaturalLanguage(input: string): PredictionResult[] {
    const predictions: PredictionResult[] = [];
    const _keywords = this.extractKeywords(input);

    const _commandMappings = {
      create: ["/code", "/init"],
      generate: ["/code", "/image", "/video"],
      make: ["/code", "/image"],
      build: ["/code"],
      test: ["/test"],
      review: ["/review"],
      fix: ["/bug", "/code"],
      debug: ["/bug"],
      image: ["/image"],
      picture: ["/image"],
      video: ["/video"],
      animation: ["/video"],
      commit: ["/commit"],
      config: ["/config"],
      help: ["/help"],
      clear: ["/clear"],
      model: ["/model"],
      init: ["/init"],
    };

    for (const keyword of _keywords) {
      const _commands = (_commandMappings as Record<string, string[]>)[keyword];
      if (_commands) {
        for (const _command of _commands) {
          predictions.push({
            suggestion: _command,
            _confidence: 0.8,
            type: "_command",
            description: `Convert "${input}" to ${_command}`,
            icon: this.getCommandIcon(_command),
          });
        }
      }
    }

    return predictions;
  }

  /**
   * パラメータ予測
   */
  private predictParameters(
    _input: string,
    _context: PredictionContext,
  ): PredictionResult[] {
    const predictions: PredictionResult[] = [];
    const _parts = _input.trim().split(/\s+/);

    if (_parts.length < 2) {
      return [];
    }

    const _command = _parts[0];
    const _currentParam = _parts[_parts.length - 1];

    const _pattern = this.commandPatterns.get(_command || "");
    if (!_pattern) {
      return [];
    }

    // パラメータの予測
    for (const param of _pattern.parameters) {
      if (
        _currentParam &&
        param.name.toLowerCase().includes(_currentParam.toLowerCase())
      ) {
        predictions.push({
          suggestion: `${param.prefix}${param.name}`,
          _confidence: 0.7,
          type: "parameter",
          description: param.description,
          icon: "⚙️",
        });
      }
    }

    return predictions;
  }

  /**
   * ファイルパス予測
   */
  private predictPaths(
    _input: string,
    context: PredictionContext,
  ): PredictionResult[] {
    const predictions: PredictionResult[] = [];
    const _words = _input.split(/\s+/);
    const _lastWord = _words[_words.length - 1];

    // ファイルパスっぽい文字列を検出
    if (
      _lastWord &&
      (_lastWord.includes("/") ||
        _lastWord.includes(".") ||
        _lastWord.startsWith("./"))
    ) {
      for (const file of context.projectFiles) {
        if (_lastWord && file.toLowerCase().includes(_lastWord.toLowerCase())) {
          predictions.push({
            suggestion: file,
            _confidence: 0.6,
            type: "path",
            description: `File: ${file}`,
            icon: "📁",
          });
        }
      }
    }

    return predictions;
  }

  /**
   * 値の予測
   */
  private predictValues(
    _input: string,
    _context: PredictionContext,
  ): PredictionResult[] {
    const predictions: PredictionResult[] = [];

    // AIモデル名の予測
    if (_input.includes("model") || _input.includes("/model")) {
      const _models = ["gpt-5", "claude-opus-4.1", "gemini-2.5-pro", "grok-4"];
      for (const model of _models) {
        predictions.push({
          suggestion: model,
          _confidence: 0.65,
          type: "value",
          description: `AI Model: ${model}`,
          icon: "🧠",
        });
      }
    }

    // プログラミング言語の予測
    if (_input.includes("language") || _input.includes("--lang")) {
      const _languages = ["typescript", "javascript", "python", "go", "rust"];
      for (const lang of _languages) {
        predictions.push({
          suggestion: lang,
          _confidence: 0.6,
          type: "value",
          description: `Language: ${lang}`,
          icon: "💻",
        });
      }
    }

    return predictions;
  }

  /**
   * 継続予測(未完成入力の補完)
   */
  private predictContinuation(
    _input: string,
    _context: PredictionContext,
  ): PredictionResult[] {
    const predictions: PredictionResult[] = [];

    // 履歴ベースの予測
    for (const [historical, _frequency] of this.userHistory) {
      if (historical.startsWith(_input) && historical !== _input) {
        const _confidence = Math.min(0.9, _frequency / 10); // 使用頻度に基づく信頼度
        predictions.push({
          suggestion: historical,
          _confidence,
          type: "continuation",
          description: `Based on your history (used ${_frequency} times)`,
          icon: "🔄",
        });
      }
    }

    return predictions;
  }

  /**
   * ユーザーの使用パターンを学習
   */
  learnFromInput(input: string): void {
    const _current = this.userHistory.get(input) || 0;
    this.userHistory.set(input, _current + 1);

    // トライ構造に追加
    this.addToTrie(input);
  }

  /**
   * コマンドの信頼度計算
   */
  private calculateCommandConfidence(
    _command: string,
    _partial: string,
    context: PredictionContext,
  ): number {
    let _confidence = 0.5; // ベース信頼度

    // 前方一致の完全性
    _confidence += (_partial.length / command.length) * 0.3;

    // 使用頻度
    const _frequency =
      context.userPreferences.favoriteCommands.indexOf(`/${_command}`) + 1;
    if (_frequency > 0) {
      _confidence += (_frequency / 10) * 0.2;
    }

    // 時間帯による調整
    const _hour = new Date().getHours();
    const _workingHours = context.userPreferences._workingHours;
    if (_hour >= _workingHours.start && _hour <= _workingHours.end) {
      _confidence += 0.1;
    }

    return Math.min(0.95, _confidence);
  }

  /**
   * 初期化メソッド
   */
  private initializeCommandPatterns(): void {
    // 主要コマンドのパターンを定義
    this.commandPatterns.set("/code", {
      name: "code",
      parameters: [
        {
          name: "language",
          prefix: "--lang=",
          description: "Programming language",
        },
        {
          name: "framework",
          prefix: "--framework=",
          description: "Framework to use",
        },
        {
          name: "test",
          prefix: "--include-tests",
          description: "Include tests",
        },
      ],
    });

    this.commandPatterns.set("/image", {
      name: "image",
      parameters: [
        { name: "style", prefix: "--style=", description: "Image style" },
        { name: "size", prefix: "--size=", description: "Image dimensions" },
        { name: "batch", prefix: "--batch=", description: "Number of images" },
      ],
    });

    // 他のコマンドパターンも追加...
  }

  private initializeTrie(): void {
    // 一般的なコマンドをトライに追加
    const _commonCommands = [
      "/code",
      "/test",
      "/review",
      "/image",
      "/video",
      "/commit",
      "/config",
      "/model",
      "/help",
      "/clear",
      "/init",
      "/bug",
    ];

    for (const _command of _commonCommands) {
      this.addToTrie(_command);
    }
  }

  private addToTrie(word: string): void {
    let _current = this.trie;
    for (const char of word) {
      if (!_current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      _current = _current.children.get(char)!;
    }
    current.isEnd = true;
  }

  private extractKeywords(input: string): string[] {
    const _words = input.toLowerCase().split(/\s+/);
    return _words.filter((word) => word.length > 2);
  }

  private isCompleteCommand(_command: string): boolean {
    const _commands = [
      "code",
      "test",
      "review",
      "image",
      "video",
      "commit",
      "config",
      "model",
      "help",
      "clear",
      "init",
      "bug",
    ];
    return _commands.includes(_command);
  }

  private getAvailableCommands(): Array<{
    name: string;
    description: string;
    icon: string;
    shortcut?: string;
  }> {
    return [
      {
        name: "code",
        description: "AI code generation",
        icon: "💻",
        shortcut: "Ctrl+C",
      },
      {
        name: "test",
        description: "Generate tests",
        icon: "🧪",
        shortcut: "Ctrl+T",
      },
      {
        name: "review",
        description: "Code review",
        icon: "👁️",
        shortcut: "Ctrl+R",
      },
      { name: "image", description: "Generate images", icon: "🎨" },
      { name: "video", description: "Generate videos", icon: "🎬" },
      { name: "commit", description: "AI commit message", icon: "💾" },
      { name: "config", description: "Configuration", icon: "⚙️" },
      { name: "model", description: "Select AI model", icon: "🧠" },
      { name: "help", description: "Show help", icon: "❓", shortcut: "F1" },
      { name: "clear", description: "Clear context", icon: "🧹" },
      { name: "init", description: "Initialize project", icon: "🚀" },
      { name: "bug", description: "Bug detection", icon: "🐛" },
    ];
  }

  private getCommandIcon(_command: string): string {
    const icons: Record<string, string> = {
      "/code": "💻",
      "/test": "🧪",
      "/review": "👁️",
      "/image": "🎨",
      "/video": "🎬",
      "/commit": "💾",
      "/config": "⚙️",
      "/model": "🧠",
      "/help": "❓",
      "/clear": "🧹",
      "/init": "🚀",
      "/bug": "🐛",
    };
    return icons[_command] || "⚡";
  }
}

// Helper interfaces and classes
interface CommandPattern {
  name: string;
  parameters: Array<{
    name: string;
    prefix: string;
    description: string;
  }>;
}

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEnd: boolean = false;
}
