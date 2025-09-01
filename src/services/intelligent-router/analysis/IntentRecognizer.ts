import { ProcessedInput } from "../infra/NaturalLanguageProcessor";
import type { _CommandIntent, RouterConfig } from "../types/common-types";

export interface RecognizedIntent {
  command: string;
  confidence: number;
  alternatives?: Array<{ command: string; confidence: number }>;
  reasoning?: string;
}

interface IntentPattern {
  command: string;
  patterns: RegExp[];
  keywords: string[];
  weight: number;
}

interface ContextClue {
  before: string[];
  after: string[];
  weight: number;
}

export interface IntentRecognizerDependencies {
  knownCommands: string[];
}

export class IntentRecognizer {
  private config: Required<RouterConfig>;
  private intentPatterns: Map<string, IntentPattern[]>;
  private contextClues: Map<string, ContextClue>;
  private commandHistory: string[] = [];
  private initialized: boolean = false;
  private dependencies: IntentRecognizerDependencies;
  private metrics = {
    totalCalls: 0,
    nullReturns: 0,
    fuzzyOnlyBlocked: 0,
    responseTimes: [] as number[],
  };

  constructor(
    config: Required<RouterConfig>,
    dependencies: IntentRecognizerDependencies,
  ) {
    this.config = config;
    this.dependencies = dependencies;
    this.intentPatterns = new Map();
    this.contextClues = new Map();
    this.initializePatterns();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize ML models or other async resources if needed
    this.initialized = true;
  }

  async recognize(input: ProcessedInput): Promise<RecognizedIntent | null> {
    const startTime = performance.now();
    this.metrics.totalCalls++;

    // Input length limit (ReDoS protection)
    if ((input.normalized?.length ?? 0) > 8192) {
      this.metrics.nullReturns++;
      return null;
    }

    const scores = new Map<string, number>();

    // Calculate scores in specific order (fuzzy last)
    // 1. Pattern matching score
    this.calculatePatternScores(input, scores);

    // 2. Keyword matching score
    this.calculateKeywordScores(input, scores);

    // 3. Context-based scoring
    this.calculateContextScores(input, scores);

    // 4. Entity-based scoring (with adjusted weights)
    this.calculateEntityScores(input, scores);

    // 5. Historical pattern scoring
    this.calculateHistoricalScores(input, scores);

    // 6. Fuzzy command matching LAST (to avoid overriding)
    this.calculateFuzzyCommandScores(input, scores);

    // Early rejection for fuzzy-only matches
    if (scores.size === 1 && (scores.values().next().value ?? 0) <= 5.0) {
      this.metrics.nullReturns++;
      this.metrics.fuzzyOnlyBlocked++;
      return null;
    }

    // Get top candidates
    const candidates = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxAlternatives + 1);

    if (candidates.length === 0) {
      this.metrics.nullReturns++;
      const elapsed = performance.now() - startTime;
      this.metrics.responseTimes.push(elapsed);
      return null;
    }

    // Normalize scores to confidence values with cap
    const maxScore = Math.max(candidates[0]?.[1] ?? 1, 1e-9);
    const normalizedCandidates = candidates.map(([command, score]) => {
      const rawConfidence = score / maxScore;
      // Apply cap to prevent fuzzy-only high confidence
      const confidence = Math.min(rawConfidence, 0.7);
      return { command, confidence };
    });

    // Minimum confidence threshold
    const minConfidence = 0.35;
    if (normalizedCandidates[0]?.confidence < minConfidence) {
      this.metrics.nullReturns++;
      const elapsed = performance.now() - startTime;
      this.metrics.responseTimes.push(elapsed);
      return null;
    }

    const topCandidate = normalizedCandidates[0];
    if (!topCandidate) {
      throw new Error("No candidates found for intent recognition");
    }
    const alternatives = normalizedCandidates.slice(1);

    const elapsed = performance.now() - startTime;
    this.metrics.responseTimes.push(elapsed);

    return {
      command: topCandidate.command,
      confidence: topCandidate.confidence,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
      reasoning: this.generateReasoning(input, topCandidate.command),
    };
  }

  private calculatePatternScores(
    input: ProcessedInput,
    scores: Map<string, number>,
  ): void {
    const patterns =
      this.intentPatterns.get(input.language) ??
      this.intentPatterns.get("en") ??
      [];

    patterns.forEach((pattern) => {
      let score = 0;

      // Check regex patterns
      pattern.patterns.forEach((regex) => {
        if (regex.test(input.normalized)) {
          score += pattern.weight;
        }
        if (regex.test(input.original)) {
          score += pattern.weight * 0.5;
        }
      });

      if (score > 0) {
        const currentScore = scores.get(pattern.command) ?? 0;
        scores.set(pattern.command, currentScore + score);
      }
    });
  }

  private calculateKeywordScores(
    input: ProcessedInput,
    scores: Map<string, number>,
  ): void {
    const patterns =
      this.intentPatterns.get(input.language) ??
      this.intentPatterns.get("en") ??
      [];

    patterns.forEach((pattern) => {
      let matchCount = 0;

      pattern.keywords.forEach((keyword) => {
        if (input.keywords.includes(keyword.toLowerCase())) {
          matchCount++;
        }
        if (input.tokens.includes(keyword.toLowerCase())) {
          matchCount += 0.5;
        }
      });

      if (matchCount > 0) {
        const score = matchCount * pattern.weight * 0.8;
        const currentScore = scores.get(pattern.command) ?? 0;
        scores.set(pattern.command, currentScore + score);
      }
    });
  }

  private calculateContextScores(
    _input: ProcessedInput,
    scores: Map<string, number>,
  ): void {
    // Use command history for context
    if (this.commandHistory.length > 0) {
      const lastCommand = this.commandHistory[this.commandHistory.length - 1];

      // Boost related commands
      const relatedCommands = this.getRelatedCommands(lastCommand ?? "");
      relatedCommands.forEach((command) => {
        const currentScore = scores.get(command) ?? 0;
        scores.set(command, currentScore + 0.5);
      });
    }
  }

  private calculateEntityScores(
    input: ProcessedInput,
    scores: Map<string, number>,
  ): void {
    // Adjusted entity weights (0.2-0.3 range)
    const entityWeights = {
      code: 0.25, // Reduced to prevent /code bias
      language: 0.25,
      framework: 0.25,
      file: 0.3,
      url: 0.3,
      number: 0.2,
      default: 0.2,
    };

    input.entities.forEach((entity) => {
      const weight =
        entityWeights[entity.type as keyof typeof entityWeights] ??
        entityWeights.default;

      switch (entity.type) {
        case "code":
        case "language":
        case "framework":
          this.boostScore(scores, "/code", weight * 2);
          this.boostScore(scores, "/test", weight);
          this.boostScore(scores, "/review", weight);
          break;
        case "file":
          this.boostScore(scores, "/code", weight * 0.5);
          this.boostScore(scores, "/review", weight);
          this.boostScore(scores, "/export", weight * 0.5);
          break;
        case "url":
          this.boostScore(scores, "/image", weight);
          this.boostScore(scores, "/video", weight);
          break;
      }
    });
  }

  private calculateHistoricalScores(
    _input: ProcessedInput,
    scores: Map<string, number>,
  ): void {
    // Skip if no history
    if (this.commandHistory.length === 0) {
      return;
    }

    const recent = this.commandHistory.slice(-10); // Last 10 commands
    const base = 0.2;

    for (let i = 0; i < recent.length; i++) {
      // Skip consecutive duplicates to prevent over-boosting
      if (i > 0 && recent[i] === recent[i - 1]) continue;

      // Exponential decay based on recency
      const weight = base * Math.exp(-(recent.length - 1 - i) * 0.1);
      const cmd = recent[i];
      scores.set(cmd, (scores.get(cmd) ?? 0) + weight);
    }

    // Maintain history size limit
    if (this.commandHistory.length > 100) {
      this.commandHistory = this.commandHistory.slice(-100);
    }
  }

  private boostScore(
    scores: Map<string, number>,
    command: string,
    boost: number,
  ): void {
    const currentScore = scores.get(command) ?? 0;
    scores.set(command, currentScore + boost);
  }

  private getRelatedCommands(command: string): string[] {
    const relationships: Record<string, string[]> = {
      "/code": ["/test", "/review", "/commit"],
      "/test": ["/code", "/review"],
      "/review": ["/code", "/test", "/commit"],
      "/image": ["/video"],
      "/video": ["/image"],
      "/init": ["/add-dir", "/setup"],
      "/setup": ["/init", "/config"],
      "/config": ["/settings", "/setup"],
    };

    return relationships[command] ?? [];
  }

  private generateReasoning(input: ProcessedInput, _command: string): string {
    const reasons: string[] = [];

    if (input.keywords.length > 0) {
      reasons.push(
        `Keywords detected: ${input.keywords.slice(0, 3).join(", ")}`,
      );
    }

    if (input.entities.length > 0) {
      const entityTypes = [...new Set(input.entities.map((e) => e.type))];
      reasons.push(`Entities found: ${entityTypes.join(", ")}`);
    }

    return reasons.join("; ");
  }

  async updateModel(
    _input: string,
    correctCommand: string,
    _wasCorrect: boolean,
  ): Promise<void> {
    // Update command history
    this.commandHistory.push(correctCommand);
    if (this.commandHistory.length > 100) {
      this.commandHistory.shift();
    }

    // In a real implementation, this would update ML model weights
    // For now, we just track the feedback
  }

  // Get performance metrics
  getMetrics() {
    const times = this.metrics.responseTimes.slice(-10000); // Last 10k
    if (times.length === 0) {
      return {
        p95_ms: 0,
        avg_ms: 0,
        total: 0,
        null_rate: 0,
        fuzzy_only_blocked: 0,
      };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      p95_ms: sorted[p95Index] ?? 0,
      avg_ms: times.reduce((a, b) => a + b, 0) / times.length,
      total: this.metrics.totalCalls,
      null_rate:
        this.metrics.totalCalls > 0
          ? this.metrics.nullReturns / this.metrics.totalCalls
          : 0,
      fuzzy_only_blocked: this.metrics.fuzzyOnlyBlocked,
    };
  }

  private initializePatterns(): void {
    // English patterns
    const englishPatterns: IntentPattern[] = [
      // Direct command patterns (highest priority)
      {
        command: "/help",
        patterns: [
          /^\/help$/i,
          /^help$/i,
          /\b(help|assistance|guide|usage)\b/i,
          /how\s+to\s+use/i,
          /\bshow\s+(me\s+)?(commands|options)\b/i,
        ],
        keywords: [
          "help",
          "assistance",
          "guide",
          "usage",
          "commands",
          "options",
        ],
        weight: 10.0, // Highest priority
      },
      {
        command: "/status",
        patterns: [
          /^\/status$/i,
          /^status$/i,
          /\b(status|state|condition|health)\b/i,
          /check\s+(status|health|state)/i,
          /\bhow.*doing\b/i,
        ],
        keywords: ["status", "state", "condition", "health", "check"],
        weight: 10.0,
      },
      {
        command: "/version",
        patterns: [
          /^\/version$/i,
          /^version$/i,
          /\b(version|ver|build|release)\b/i,
          /what\s+(version|ver)/i,
          /\bshow\s+(version|ver)\b/i,
        ],
        keywords: ["version", "ver", "build", "release"],
        weight: 10.0,
      },
      {
        command: "/test",
        patterns: [
          /^\/test$/i,
          /^test$/i,
          /\b(test|testing|spec|unit.*test|integration.*test)\b/i,
          /\b(run|execute|start).*test/i,
          /\btest.*(?:suite|case|file)/i,
        ],
        keywords: [
          "test",
          "testing",
          "spec",
          "unit",
          "integration",
          "jest",
          "mocha",
        ],
        weight: 9.0,
      },
      {
        command: "/brain",
        patterns: [
          /^\/brain$/i,
          /^brain$/i,
          /\b(brain|mode|thinking|cognitive)\b/i,
          /\bchange.*mode/i,
          /\b(switch|activate).*brain/i,
        ],
        keywords: ["brain", "mode", "thinking", "cognitive", "switch"],
        weight: 9.0,
      },
      {
        command: "/code",
        patterns: [
          /\b(write|create|generate|implement|build|code|program|develop|make)\b.*\b(code|function|class|component|script|program|app)\b/i,
          /\b(implement|create|write|build)\s+(?:a\s+)?(\w+)/i,
          /\bcode\s+(?:for|to)\b/i,
        ],
        keywords: [
          "write",
          "create",
          "generate",
          "implement",
          "build",
          "code",
          "program",
          "function",
          "class",
          "component",
        ],
        weight: 1.0,
      },
      {
        command: "/image",
        patterns: [
          /\b(create|generate|make|draw|design|produce)\b.*\b(image|picture|photo|illustration|graphic|visual|art)\b/i,
          /\b(image|picture|photo|illustration|graphic)\s+of\b/i,
          /\bdraw\s+(?:a\s+)?(\w+)/i,
        ],
        keywords: [
          "image",
          "picture",
          "photo",
          "draw",
          "illustration",
          "visual",
          "graphic",
          "art",
          "design",
        ],
        weight: 1.0,
      },
      {
        command: "/video",
        patterns: [
          /\b(create|generate|make|produce|render)\b.*\b(video|movie|animation|clip|film)\b/i,
          /\b(video|animation|movie)\s+of\b/i,
          /\banimate\s+(?:a\s+)?(\w+)/i,
        ],
        keywords: [
          "video",
          "movie",
          "animation",
          "clip",
          "film",
          "animate",
          "motion",
          "render",
        ],
        weight: 1.0,
      },
      {
        command: "/test",
        patterns: [
          /\b(write|create|generate)\b.*\b(test|tests|testing|unit test|integration test)\b/i,
          /\btest\s+(?:for|the)\b/i,
          /\b(unit|integration|e2e)\s+test/i,
        ],
        keywords: [
          "test",
          "testing",
          "unit",
          "integration",
          "e2e",
          "coverage",
          "spec",
        ],
        weight: 1.0,
      },
      {
        command: "/review",
        patterns: [
          /\b(review|check|analyze|improve|refactor|optimize)\b.*\b(code|implementation|function)\b/i,
          /\bcode\s+review\b/i,
          /\b(improve|optimize|refactor)\s+this\b/i,
        ],
        keywords: [
          "review",
          "check",
          "analyze",
          "improve",
          "refactor",
          "optimize",
          "quality",
        ],
        weight: 1.0,
      },
      // Math commands
      {
        command: "/calc",
        patterns: [
          /\b(calculate|compute|calc|evaluate|solve)\b.*\b(expression|equation|formula|math)\b/i,
          /\b(what\s+is|compute|calculate)\s+\d+\s*[\+\-\*\/\^]\s*\d+/i,
          /\b(sin|cos|tan|sqrt|log|exp|pow|abs)\s*\(/i,
          /^\d+\s*[\+\-\*\/\^]\s*\d+/,
          /\b(math|mathematical)\s+(expression|calculation)/i,
        ],
        keywords: [
          "calculate",
          "compute",
          "calc",
          "math",
          "evaluate",
          "expression",
          "formula",
          "sin",
          "cos",
          "sqrt",
        ],
        weight: 1.5,
      },
      {
        command: "/solve",
        patterns: [
          /\b(solve|find|resolve)\b.*\b(equation|system|root|solution|variable)\b/i,
          /\bsolve\s+for\s+[a-z]/i,
          /\b(equation|equations)\s+(system|solving)/i,
          /\bfind\s+(root|solution|value)\s+of\b/i,
          /[a-z]\s*[\^]\s*\d+\s*[\+\-]\s*\d+\s*=\s*\d+/i,
        ],
        keywords: [
          "solve",
          "equation",
          "system",
          "root",
          "solution",
          "find",
          "variable",
          "unknown",
        ],
        weight: 1.5,
      },
      {
        command: "/plot",
        patterns: [
          /\b(plot|graph|draw|visualize|chart)\b.*\b(function|equation|data|curve)\b/i,
          /\b(draw|create|make)\s+(graph|plot|chart)\s+of\b/i,
          /\bplot\s+[a-z]\s*=\s*/i,
          /\b(visualize|show|display)\s+(function|graph)/i,
          /\b(sin|cos|tan|polynomial|quadratic|linear)\s+(graph|plot)/i,
        ],
        keywords: [
          "plot",
          "graph",
          "draw",
          "visualize",
          "chart",
          "curve",
          "function",
          "diagram",
        ],
        weight: 1.5,
      },
      // Shell command
      {
        command: "/shell",
        patterns: [
          /\b(show|display|read|cat|view)\s+(file|contents?|text)\b/i,
          /\b(list|ls|dir|show)\s+(files?|directories?|folders?)\b/i,
          /\b(search|find|grep|look)\s+(for|in)\s+/i,
          /\b(what|which)\s+files?\s+(are|exist)/i,
          /\b(open|read|check|examine|inspect)\s+\w+\.\w+/i,
          /\b(navigate|cd|go)\s+to\s+/i,
          /\bshow\s+me\s+(the\s+)?(contents?|files?|folders?)/i,
          /\bfind\s+all\s+\w+\s+files?\b/i,
        ],
        keywords: [
          "show",
          "list",
          "search",
          "find",
          "file",
          "directory",
          "folder",
          "contents",
          "read",
          "grep",
          "ls",
        ],
        weight: 1.5,
      },
    ];

    // Japanese patterns
    const japanesePatterns: IntentPattern[] = [
      // Direct command patterns (highest priority)
      {
        command: "/help",
        patterns: [
          /^\/help$/i,
          /^ヘルプ$/,
          /(?:ヘルプ|使い方|使用方法|操作方法)/,
          /どう(?:やって|使う)/,
          /(?:コマンド|方法).*(?:教えて|見せて)/,
        ],
        keywords: ["ヘルプ", "使い方", "使用方法", "コマンド", "操作方法"],
        weight: 10.0,
      },
      {
        command: "/status",
        patterns: [
          /^\/status$/i,
          /^ステータス$/,
          /(?:ステータス|状態|状況)/,
          /(?:状態|調子).*(?:確認|チェック)/,
          /どう(?:なって|いる)/,
        ],
        keywords: ["ステータス", "状態", "状況", "確認", "チェック"],
        weight: 10.0,
      },
      {
        command: "/version",
        patterns: [
          /^\/version$/i,
          /^バージョン$/,
          /(?:バージョン|版|ver)/,
          /(?:バージョン|版).*(?:確認|教えて)/,
        ],
        keywords: ["バージョン", "版", "ver"],
        weight: 10.0,
      },
      {
        command: "/test",
        patterns: [
          /^\/test$/i,
          /^テスト$/,
          /(?:テスト|試験|検証)/,
          /(?:テスト|試験).*(?:実行|開始)/,
        ],
        keywords: ["テスト", "試験", "検証", "実行"],
        weight: 9.0,
      },
      {
        command: "/brain",
        patterns: [
          /^\/brain$/i,
          /^ブレイン$/,
          /(?:ブレイン|脳|モード)/,
          /(?:モード|思考).*(?:変更|切り替え)/,
        ],
        keywords: ["ブレイン", "脳", "モード", "思考"],
        weight: 9.0,
      },
      {
        command: "/code",
        patterns: [
          /(?:コード|プログラム|関数|クラス|メソッド).*(?:書|作|実装|生成)/,
          /(?:実装|開発|作成)(?:して|する)/,
          /プログラ(?:ム|ミング)/,
        ],
        keywords: [
          "コード",
          "実装",
          "プログラム",
          "関数",
          "クラス",
          "作成",
          "開発",
          "書く",
        ],
        weight: 1.0,
      },
      {
        command: "/image",
        patterns: [
          /(?:画像|イメージ|絵|イラスト|ビジュアル).*(?:生成|作|描)/,
          /(?:描|作).*(?:画像|絵|イラスト)/,
          /画像を/,
        ],
        keywords: [
          "画像",
          "イメージ",
          "絵",
          "イラスト",
          "ビジュアル",
          "描く",
          "生成",
        ],
        weight: 1.0,
      },
      {
        command: "/video",
        patterns: [
          /(?:動画|ビデオ|アニメーション|ムービー).*(?:作|生成|出力)/,
          /(?:作|生成).*(?:動画|ビデオ|アニメーション)/,
          /動画を/,
        ],
        keywords: [
          "動画",
          "ビデオ",
          "アニメーション",
          "ムービー",
          "映像",
          "作成",
        ],
        weight: 1.0,
      },
      {
        command: "/test",
        patterns: [
          /(?:テスト|試験).*(?:作|書|生成)/,
          /(?:ユニット|統合|E2E).*テスト/,
          /テスト(?:コード|を)/,
        ],
        keywords: ["テスト", "試験", "ユニット", "統合", "カバレッジ"],
        weight: 1.0,
      },
      {
        command: "/review",
        patterns: [
          /(?:レビュー|確認|改善|リファクタ).*(?:して|する)/,
          /コード.*(?:レビュー|確認|改善)/,
          /(?:品質|最適化)/,
        ],
        keywords: ["レビュー", "確認", "改善", "リファクタ", "最適化", "品質"],
        weight: 1.0,
      },
      // Math commands in Japanese
      {
        command: "/calc",
        patterns: [
          /(?:計算|演算|算出).*(?:して|する)/,
          /\d+\s*[\+\-\*\/\^]\s*\d+/,
          /(?:何|いくつ|いくら).*(?:になる|です)/,
          /(?:sin|cos|tan|sqrt|ルート|平方根)/,
          /(?:数式|式|計算式).*(?:計算|演算)/,
        ],
        keywords: [
          "計算",
          "演算",
          "算出",
          "数式",
          "式",
          "数学",
          "ルート",
          "平方根",
        ],
        weight: 1.5,
      },
      {
        command: "/solve",
        patterns: [
          /(?:方程式|連立方程式|等式).*(?:解|求|計算)/,
          /(?:解|根|値).*(?:求|探|計算)/,
          /[a-z]\s*について.*(?:解|求)/,
          /(?:変数|未知数).*(?:求|計算)/,
        ],
        keywords: ["方程式", "連立", "解", "根", "変数", "未知数", "求める"],
        weight: 1.5,
      },
      {
        command: "/plot",
        patterns: [
          /(?:グラフ|図|チャート).*(?:描|作|表示)/,
          /(?:関数|曲線).*(?:描画|プロット|可視化)/,
          /(?:可視化|表示|描画).*(?:して|する)/,
          /(?:sin|cos|二次|一次|多項式).*グラフ/,
        ],
        keywords: [
          "グラフ",
          "図",
          "チャート",
          "描画",
          "プロット",
          "可視化",
          "曲線",
          "関数",
        ],
        weight: 1.5,
      },
      // Shell command in Japanese
      {
        command: "/shell",
        patterns: [
          /(?:ファイル|フォルダ|ディレクトリ).*(?:表示|見|確認|リスト)/,
          /(?:内容|中身|テキスト).*(?:表示|見|確認)/,
          /(?:検索|探|grep|サーチ).*(?:して|する)/,
          /(?:何|どんな).*ファイル.*(?:ある|存在)/,
          /\w+\.\w+.*(?:開|読|確認)/,
          /(?:移動|cd|ナビゲート).*(?:して|する)/,
        ],
        keywords: [
          "ファイル",
          "フォルダ",
          "ディレクトリ",
          "表示",
          "検索",
          "内容",
          "中身",
          "リスト",
        ],
        weight: 1.5,
      },
    ];

    // Chinese patterns
    const chinesePatterns: IntentPattern[] = [
      {
        command: "/code",
        patterns: [
          /(?:写|编写|创建|实现|生成).*(?:代码|程序|函数|类)/,
          /(?:代码|程序|函数).*(?:写|创建|实现)/,
          /编程/,
        ],
        keywords: [
          "代码",
          "编写",
          "实现",
          "程序",
          "函数",
          "类",
          "创建",
          "开发",
        ],
        weight: 1.0,
      },
      {
        command: "/image",
        patterns: [
          /(?:生成|创建|制作|画).*(?:图像|图片|插图)/,
          /(?:图像|图片|插图).*(?:生成|创建)/,
          /画.*图/,
        ],
        keywords: ["图像", "图片", "插图", "画", "生成", "创建", "视觉"],
        weight: 1.0,
      },
      {
        command: "/video",
        patterns: [
          /(?:创建|生成|制作).*(?:视频|动画|影片)/,
          /(?:视频|动画).*(?:创建|生成)/,
          /动画/,
        ],
        keywords: ["视频", "动画", "影片", "创建", "生成", "制作"],
        weight: 1.0,
      },
    ];

    // Korean patterns
    const koreanPatterns: IntentPattern[] = [
      {
        command: "/code",
        patterns: [
          /(?:코드|프로그램|함수|클래스).*(?:작성|생성|구현)/,
          /(?:구현|개발|만들)/,
          /프로그래밍/,
        ],
        keywords: [
          "코드",
          "프로그램",
          "함수",
          "클래스",
          "구현",
          "개발",
          "작성",
        ],
        weight: 1.0,
      },
      {
        command: "/image",
        patterns: [
          /(?:이미지|그림|일러스트).*(?:생성|만들|그리)/,
          /(?:그림|이미지).*그려/,
          /이미지/,
        ],
        keywords: ["이미지", "그림", "일러스트", "생성", "그리기"],
        weight: 1.0,
      },
      {
        command: "/video",
        patterns: [
          /(?:비디오|동영상|애니메이션).*(?:생성|만들|제작)/,
          /(?:동영상|비디오).*만들/,
          /애니메이션/,
        ],
        keywords: ["비디오", "동영상", "애니메이션", "생성", "제작"],
        weight: 1.0,
      },
    ];

    // Store patterns by language
    this.intentPatterns.set("en", englishPatterns);
    this.intentPatterns.set("ja", japanesePatterns);
    this.intentPatterns.set("cn", chinesePatterns);
    this.intentPatterns.set("ko", koreanPatterns);
  }

  private calculateFuzzyCommandScores(
    input: ProcessedInput,
    scores: Map<string, number>,
  ): void {
    // Use injected known commands (SSOT)
    const knownCommands = this.dependencies.knownCommands;

    const inputText = input.normalized.trim();

    // Direct fuzzy matching for commands
    knownCommands.forEach((command) => {
      const distance = this.calculateEditDistance(inputText, command);
      const commandWithoutSlash = command.substring(1);
      const distanceWithoutSlash = this.calculateEditDistance(
        inputText,
        commandWithoutSlash,
      );

      // Use the better distance
      const bestDistance = Math.min(distance, distanceWithoutSlash);

      // Only consider edit distance of 1 (stricter matching)
      if (bestDistance <= 1) {
        const fuzzyScore = 5.0; // Fixed low score for fuzzy matches
        const currentScore = scores.get(command) ?? 0;
        scores.set(command, Math.max(currentScore, fuzzyScore));
      }
    });
  }

  private calculateEditDistance(s1: string, s2: string): number {
    // Levenshtein distance implementation
    const len1 = s1.length;
    const len2 = s2.length;

    // Create matrix
    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1, // deletion
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j - 1] + 1, // substitution
          );
        }
      }
    }

    return matrix[len1][len2];
  }
}
