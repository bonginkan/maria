/**
 * Real-time Input Prediction System
 * リアルタイム入力予測と高精度補完システム
 */

export interface PredictionResult {
  suggestion: string;
  confidence: number; // 0-1
  type: 'command' | 'parameter' | 'value' | 'path' | 'continuation';
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
  workingHours: { start: number; end: number };
  aiModel: string;
}

export class RealtimeInputPredictor {
  private commandPatterns: Map<string, CommandPattern> = new Map();
  private userHistory: Map<string, number> = new Map(); // frequency tracking
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
    const now = Date.now();

    // デバウンス: 100ms以内の連続予測は無視
    if (now - this.lastPredictionTime < 100) {
      return this.predictionCache.get(currentInput) || [];
    }

    this.lastPredictionTime = now;

    const predictions: PredictionResult[] = [];

    // 1. コマンド予測
    predictions.push(...this.predictCommands(currentInput, context));

    // 2. パラメータ予測
    predictions.push(...this.predictParameters(currentInput, context));

    // 3. ファイルパス予測
    predictions.push(...this.predictPaths(currentInput, context));

    // 4. 値の予測
    predictions.push(...this.predictValues(currentInput, context));

    // 5. 継続予測（未完成の入力の補完）
    predictions.push(...this.predictContinuation(currentInput, context));

    // 信頼度でソートし、上位5個まで
    const sortedPredictions = predictions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);

    this.predictionCache.set(currentInput, sortedPredictions);
    return sortedPredictions;
  }

  /**
   * スラッシュコマンド予測
   */
  private predictCommands(input: string, context: PredictionContext): PredictionResult[] {
    const predictions: PredictionResult[] = [];
    const trimmed = input.trim().toLowerCase();

    if (!trimmed.startsWith('/')) {
      // 自然言語からスラッシュコマンドを予測
      return this.predictFromNaturalLanguage(trimmed);
    }

    const partial = trimmed.substring(1); // '/'を除去

    // 完全一致の場合は予測不要
    if (this.isCompleteCommand(partial)) {
      return [];
    }

    // 前方一致検索
    const commands = this.getAvailableCommands();
    for (const command of commands) {
      if (command.name.startsWith(partial)) {
        const confidence = this.calculateCommandConfidence(command.name, partial, context);
        predictions.push({
          suggestion: `/${command.name}`,
          confidence,
          type: 'command',
          description: command.description,
          icon: command.icon,
          shortcut: command.shortcut,
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
    const keywords = this.extractKeywords(input);

    const commandMappings = {
      create: ['/code', '/init'],
      generate: ['/code', '/image', '/video'],
      make: ['/code', '/image'],
      build: ['/code'],
      test: ['/test'],
      review: ['/review'],
      fix: ['/bug', '/code'],
      debug: ['/bug'],
      image: ['/image'],
      picture: ['/image'],
      video: ['/video'],
      animation: ['/video'],
      commit: ['/commit'],
      config: ['/config'],
      help: ['/help'],
      clear: ['/clear'],
      model: ['/model'],
      init: ['/init'],
    };

    for (const keyword of keywords) {
      const commands = commandMappings[keyword];
      if (commands) {
        for (const command of commands) {
          predictions.push({
            suggestion: command,
            confidence: 0.8,
            type: 'command',
            description: `Convert "${input}" to ${command}`,
            icon: this.getCommandIcon(command),
          });
        }
      }
    }

    return predictions;
  }

  /**
   * パラメータ予測
   */
  private predictParameters(input: string, _context: PredictionContext): PredictionResult[] {
    const predictions: PredictionResult[] = [];
    const parts = input.trim().split(/\s+/);

    if (parts.length < 2) return [];

    const command = parts[0];
    const currentParam = parts[parts.length - 1];

    const pattern = this.commandPatterns.get(command);
    if (!pattern) return [];

    // パラメータの予測
    for (const param of pattern.parameters) {
      if (param.name.toLowerCase().includes(currentParam.toLowerCase())) {
        predictions.push({
          suggestion: `${param.prefix}${param.name}`,
          confidence: 0.7,
          type: 'parameter',
          description: param.description,
          icon: '⚙️',
        });
      }
    }

    return predictions;
  }

  /**
   * ファイルパス予測
   */
  private predictPaths(input: string, _context: PredictionContext): PredictionResult[] {
    const predictions: PredictionResult[] = [];
    const words = input.split(/\s+/);
    const lastWord = words[words.length - 1];

    // ファイルパスっぽい文字列を検出
    if (lastWord.includes('/') || lastWord.includes('.') || lastWord.startsWith('./')) {
      for (const file of context.projectFiles) {
        if (file.toLowerCase().includes(lastWord.toLowerCase())) {
          predictions.push({
            suggestion: file,
            confidence: 0.6,
            type: 'path',
            description: `File: ${file}`,
            icon: '📁',
          });
        }
      }
    }

    return predictions;
  }

  /**
   * 値の予測
   */
  private predictValues(input: string, _context: PredictionContext): PredictionResult[] {
    const predictions: PredictionResult[] = [];

    // AIモデル名の予測
    if (input.includes('model') || input.includes('/model')) {
      const models = ['gpt-5', 'claude-opus-4.1', 'gemini-2.5-pro', 'grok-4'];
      for (const model of models) {
        predictions.push({
          suggestion: model,
          confidence: 0.65,
          type: 'value',
          description: `AI Model: ${model}`,
          icon: '🧠',
        });
      }
    }

    // プログラミング言語の予測
    if (input.includes('language') || input.includes('--lang')) {
      const languages = ['typescript', 'javascript', 'python', 'go', 'rust'];
      for (const lang of languages) {
        predictions.push({
          suggestion: lang,
          confidence: 0.6,
          type: 'value',
          description: `Language: ${lang}`,
          icon: '💻',
        });
      }
    }

    return predictions;
  }

  /**
   * 継続予測（未完成入力の補完）
   */
  private predictContinuation(input: string, _context: PredictionContext): PredictionResult[] {
    const predictions: PredictionResult[] = [];

    // 履歴ベースの予測
    for (const [historical, frequency] of this.userHistory) {
      if (historical.startsWith(input) && historical !== input) {
        const confidence = Math.min(0.9, frequency / 10); // 使用頻度に基づく信頼度
        predictions.push({
          suggestion: historical,
          confidence,
          type: 'continuation',
          description: `Based on your history (used ${frequency} times)`,
          icon: '🔄',
        });
      }
    }

    return predictions;
  }

  /**
   * ユーザーの使用パターンを学習
   */
  learnFromInput(input: string): void {
    const current = this.userHistory.get(input) || 0;
    this.userHistory.set(input, current + 1);

    // トライ構造に追加
    this.addToTrie(input);
  }

  /**
   * コマンドの信頼度計算
   */
  private calculateCommandConfidence(
    command: string,
    partial: string,
    context: PredictionContext,
  ): number {
    let confidence = 0.5; // ベース信頼度

    // 前方一致の完全性
    confidence += (partial.length / command.length) * 0.3;

    // 使用頻度
    const frequency = context.userPreferences.favoriteCommands.indexOf(`/${command}`) + 1;
    if (frequency > 0) {
      confidence += (frequency / 10) * 0.2;
    }

    // 時間帯による調整
    const hour = new Date().getHours();
    const workingHours = context.userPreferences.workingHours;
    if (hour >= workingHours.start && hour <= workingHours.end) {
      confidence += 0.1;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * 初期化メソッド
   */
  private initializeCommandPatterns(): void {
    // 主要コマンドのパターンを定義
    this.commandPatterns.set('/code', {
      name: 'code',
      parameters: [
        { name: 'language', prefix: '--lang=', description: 'Programming language' },
        { name: 'framework', prefix: '--framework=', description: 'Framework to use' },
        { name: 'test', prefix: '--include-tests', description: 'Include tests' },
      ],
    });

    this.commandPatterns.set('/image', {
      name: 'image',
      parameters: [
        { name: 'style', prefix: '--style=', description: 'Image style' },
        { name: 'size', prefix: '--size=', description: 'Image dimensions' },
        { name: 'batch', prefix: '--batch=', description: 'Number of images' },
      ],
    });

    // 他のコマンドパターンも追加...
  }

  private initializeTrie(): void {
    // 一般的なコマンドをトライに追加
    const commonCommands = [
      '/code',
      '/test',
      '/review',
      '/image',
      '/video',
      '/commit',
      '/config',
      '/model',
      '/help',
      '/clear',
      '/init',
      '/bug',
    ];

    for (const command of commonCommands) {
      this.addToTrie(command);
    }
  }

  private addToTrie(word: string): void {
    let current = this.trie;
    for (const char of word) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }
    current.isEnd = true;
  }

  private extractKeywords(input: string): string[] {
    const words = input.toLowerCase().split(/\s+/);
    return words.filter((word) => word.length > 2);
  }

  private isCompleteCommand(command: string): boolean {
    const commands = [
      'code',
      'test',
      'review',
      'image',
      'video',
      'commit',
      'config',
      'model',
      'help',
      'clear',
      'init',
      'bug',
    ];
    return commands.includes(command);
  }

  private getAvailableCommands(): Array<{
    name: string;
    description: string;
    icon: string;
    shortcut?: string;
  }> {
    return [
      { name: 'code', description: 'AI code generation', icon: '💻', shortcut: 'Ctrl+C' },
      { name: 'test', description: 'Generate tests', icon: '🧪', shortcut: 'Ctrl+T' },
      { name: 'review', description: 'Code review', icon: '👁️', shortcut: 'Ctrl+R' },
      { name: 'image', description: 'Generate images', icon: '🎨' },
      { name: 'video', description: 'Generate videos', icon: '🎬' },
      { name: 'commit', description: 'AI commit message', icon: '💾' },
      { name: 'config', description: 'Configuration', icon: '⚙️' },
      { name: 'model', description: 'Select AI model', icon: '🧠' },
      { name: 'help', description: 'Show help', icon: '❓', shortcut: 'F1' },
      { name: 'clear', description: 'Clear context', icon: '🧹' },
      { name: 'init', description: 'Initialize project', icon: '🚀' },
      { name: 'bug', description: 'Bug detection', icon: '🐛' },
    ];
  }

  private getCommandIcon(command: string): string {
    const icons: Record<string, string> = {
      '/code': '💻',
      '/test': '🧪',
      '/review': '👁️',
      '/image': '🎨',
      '/video': '🎬',
      '/commit': '💾',
      '/config': '⚙️',
      '/model': '🧠',
      '/help': '❓',
      '/clear': '🧹',
      '/init': '🚀',
      '/bug': '🐛',
    };
    return icons[command] || '⚡';
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
