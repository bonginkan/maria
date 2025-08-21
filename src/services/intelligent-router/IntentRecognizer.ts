import { ProcessedInput } from './NaturalLanguageProcessor';
import { RouterConfig } from './IntelligentRouterService';

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

export class IntentRecognizer {
  private config: Required<RouterConfig>;
  private intentPatterns: Map<string, IntentPattern[]>;
  private __contextClues: Map<string, ContextClue>;
  private commandHistory: string[] = [];
  private initialized: boolean = false;

  constructor(config: Required<RouterConfig>) {
    this.config = config;
    this.intentPatterns = new Map();
    this.__contextClues = new Map();
    this.initializePatterns();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize ML models or other async resources if needed
    this.initialized = true;
  }

  async recognize(input: ProcessedInput): Promise<RecognizedIntent | null> {
    const scores = new Map<string, number>();

    // 1. Pattern matching score
    this.calculatePatternScores(input, scores);

    // 2. Keyword matching score
    this.calculateKeywordScores(input, scores);

    // 3. Context-based scoring
    this.calculateContextScores(input, scores);

    // 4. Entity-based scoring
    this.calculateEntityScores(input, scores);

    // 5. Historical pattern scoring
    this.calculateHistoricalScores(input, scores);

    // Get top candidates
    const candidates = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxAlternatives + 1);

    if (candidates.length === 0) {
      return null;
    }

    // Normalize scores to confidence values (0-1)
    const maxScore = candidates[0]?.[1] ?? 1;
    const normalizedCandidates = candidates.map(([command, score]) => ({
      command,
      confidence: Math.min(score / maxScore, 1.0),
    }));

    const topCandidate = normalizedCandidates[0];
    if (!topCandidate) {
      throw new Error('No candidates found for intent recognition');
    }
    const alternatives = normalizedCandidates.slice(1);

    return {
      command: topCandidate.command,
      confidence: topCandidate.confidence,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
      reasoning: this.generateReasoning(input, topCandidate.command),
    };
  }

  private calculatePatternScores(input: ProcessedInput, scores: Map<string, number>): void {
    const patterns = this.intentPatterns.get(input.language) ?? this.intentPatterns.get('en') ?? [];

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

  private calculateKeywordScores(input: ProcessedInput, scores: Map<string, number>): void {
    const patterns = this.intentPatterns.get(input.language) ?? this.intentPatterns.get('en') ?? [];

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

  private calculateContextScores(_input: ProcessedInput, scores: Map<string, number>): void {
    // Use command history for context
    if (this.commandHistory.length > 0) {
      const lastCommand = this.commandHistory[this.commandHistory.length - 1];

      // Boost related commands
      const relatedCommands = this.getRelatedCommands(lastCommand ?? '');
      relatedCommands.forEach((command) => {
        const currentScore = scores.get(command) ?? 0;
        scores.set(command, currentScore + 0.5);
      });
    }
  }

  private calculateEntityScores(input: ProcessedInput, scores: Map<string, number>): void {
    input.entities.forEach((entity) => {
      switch (entity.type) {
        case 'code':
        case 'language':
        case 'framework':
          this.boostScore(scores, '/code', 2.0);
          this.boostScore(scores, '/test', 1.0);
          this.boostScore(scores, '/review', 1.0);
          break;
        case 'file':
          this.boostScore(scores, '/code', 0.5);
          this.boostScore(scores, '/review', 1.0);
          this.boostScore(scores, '/export', 0.5);
          break;
        case 'url':
          this.boostScore(scores, '/image', 0.5);
          this.boostScore(scores, '/video', 0.5);
          break;
      }
    });
  }

  private calculateHistoricalScores(_input: ProcessedInput, scores: Map<string, number>): void {
    // Boost frequently used commands slightly
    const frequencyBoost = 0.1;
    this.commandHistory.forEach((command) => {
      const currentScore = scores.get(command) ?? 0;
      scores.set(command, currentScore + frequencyBoost);
    });
  }

  private boostScore(scores: Map<string, number>, command: string, boost: number): void {
    const currentScore = scores.get(command) ?? 0;
    scores.set(command, currentScore + boost);
  }

  private getRelatedCommands(command: string): string[] {
    const relationships: Record<string, string[]> = {
      '/code': ['/test', '/review', '/commit'],
      '/test': ['/code', '/review'],
      '/review': ['/code', '/test', '/commit'],
      '/image': ['/video'],
      '/video': ['/image'],
      '/init': ['/add-dir', '/setup'],
      '/setup': ['/init', '/config'],
      '/config': ['/settings', '/setup'],
    };

    return relationships[command] ?? [];
  }

  private generateReasoning(input: ProcessedInput, _command: string): string {
    const reasons: string[] = [];

    if (input.keywords.length > 0) {
      reasons.push(`Keywords detected: ${input.keywords.slice(0, 3).join(', ')}`);
    }

    if (input.entities.length > 0) {
      const entityTypes = [...new Set(input.entities.map((e) => e.type))];
      reasons.push(`Entities found: ${entityTypes.join(', ')}`);
    }

    return reasons.join('; ');
  }

  async updateModel(input: string, correctCommand: string, _wasCorrect: boolean): Promise<void> {
    // Update command history
    this.commandHistory.push(correctCommand);
    if (this.commandHistory.length > 100) {
      this.commandHistory.shift();
    }

    // In a real implementation, this would update ML model weights
    // For now, we just track the feedback
  }

  private initializePatterns(): void {
    // English patterns
    const englishPatterns: IntentPattern[] = [
      {
        command: '/code',
        patterns: [
          /\b(write|create|generate|implement|build|code|program|develop|make)\b.*\b(code|function|class|component|script|program|app)\b/i,
          /\b(implement|create|write|build)\s+(?:a\s+)?(\w+)/i,
          /\bcode\s+(?:for|to)\b/i,
        ],
        keywords: [
          'write',
          'create',
          'generate',
          'implement',
          'build',
          'code',
          'program',
          'function',
          'class',
          'component',
        ],
        weight: 1.0,
      },
      {
        command: '/image',
        patterns: [
          /\b(create|generate|make|draw|design|produce)\b.*\b(image|picture|photo|illustration|graphic|visual|art)\b/i,
          /\b(image|picture|photo|illustration|graphic)\s+of\b/i,
          /\bdraw\s+(?:a\s+)?(\w+)/i,
        ],
        keywords: [
          'image',
          'picture',
          'photo',
          'draw',
          'illustration',
          'visual',
          'graphic',
          'art',
          'design',
        ],
        weight: 1.0,
      },
      {
        command: '/video',
        patterns: [
          /\b(create|generate|make|produce|render)\b.*\b(video|movie|animation|clip|film)\b/i,
          /\b(video|animation|movie)\s+of\b/i,
          /\banimate\s+(?:a\s+)?(\w+)/i,
        ],
        keywords: ['video', 'movie', 'animation', 'clip', 'film', 'animate', 'motion', 'render'],
        weight: 1.0,
      },
      {
        command: '/test',
        patterns: [
          /\b(write|create|generate)\b.*\b(test|tests|testing|unit test|integration test)\b/i,
          /\btest\s+(?:for|the)\b/i,
          /\b(unit|integration|e2e)\s+test/i,
        ],
        keywords: ['test', 'testing', 'unit', 'integration', 'e2e', 'coverage', 'spec'],
        weight: 1.0,
      },
      {
        command: '/review',
        patterns: [
          /\b(review|check|analyze|improve|refactor|optimize)\b.*\b(code|implementation|function)\b/i,
          /\bcode\s+review\b/i,
          /\b(improve|optimize|refactor)\s+this\b/i,
        ],
        keywords: ['review', 'check', 'analyze', 'improve', 'refactor', 'optimize', 'quality'],
        weight: 1.0,
      },
    ];

    // Japanese patterns
    const japanesePatterns: IntentPattern[] = [
      {
        command: '/code',
        patterns: [
          /(?:コード|プログラム|関数|クラス|メソッド).*(?:書|作|実装|生成)/,
          /(?:実装|開発|作成)(?:して|する)/,
          /プログラ(?:ム|ミング)/,
        ],
        keywords: ['コード', '実装', 'プログラム', '関数', 'クラス', '作成', '開発', '書く'],
        weight: 1.0,
      },
      {
        command: '/image',
        patterns: [
          /(?:画像|イメージ|絵|イラスト|ビジュアル).*(?:生成|作|描)/,
          /(?:描|作).*(?:画像|絵|イラスト)/,
          /画像を/,
        ],
        keywords: ['画像', 'イメージ', '絵', 'イラスト', 'ビジュアル', '描く', '生成'],
        weight: 1.0,
      },
      {
        command: '/video',
        patterns: [
          /(?:動画|ビデオ|アニメーション|ムービー).*(?:作|生成|出力)/,
          /(?:作|生成).*(?:動画|ビデオ|アニメーション)/,
          /動画を/,
        ],
        keywords: ['動画', 'ビデオ', 'アニメーション', 'ムービー', '映像', '作成'],
        weight: 1.0,
      },
      {
        command: '/test',
        patterns: [
          /(?:テスト|試験).*(?:作|書|生成)/,
          /(?:ユニット|統合|E2E).*テスト/,
          /テスト(?:コード|を)/,
        ],
        keywords: ['テスト', '試験', 'ユニット', '統合', 'カバレッジ'],
        weight: 1.0,
      },
      {
        command: '/review',
        patterns: [
          /(?:レビュー|確認|改善|リファクタ).*(?:して|する)/,
          /コード.*(?:レビュー|確認|改善)/,
          /(?:品質|最適化)/,
        ],
        keywords: ['レビュー', '確認', '改善', 'リファクタ', '最適化', '品質'],
        weight: 1.0,
      },
    ];

    // Chinese patterns
    const chinesePatterns: IntentPattern[] = [
      {
        command: '/code',
        patterns: [
          /(?:写|编写|创建|实现|生成).*(?:代码|程序|函数|类)/,
          /(?:代码|程序|函数).*(?:写|创建|实现)/,
          /编程/,
        ],
        keywords: ['代码', '编写', '实现', '程序', '函数', '类', '创建', '开发'],
        weight: 1.0,
      },
      {
        command: '/image',
        patterns: [
          /(?:生成|创建|制作|画).*(?:图像|图片|插图)/,
          /(?:图像|图片|插图).*(?:生成|创建)/,
          /画.*图/,
        ],
        keywords: ['图像', '图片', '插图', '画', '生成', '创建', '视觉'],
        weight: 1.0,
      },
      {
        command: '/video',
        patterns: [
          /(?:创建|生成|制作).*(?:视频|动画|影片)/,
          /(?:视频|动画).*(?:创建|生成)/,
          /动画/,
        ],
        keywords: ['视频', '动画', '影片', '创建', '生成', '制作'],
        weight: 1.0,
      },
    ];

    // Korean patterns
    const koreanPatterns: IntentPattern[] = [
      {
        command: '/code',
        patterns: [
          /(?:코드|프로그램|함수|클래스).*(?:작성|생성|구현)/,
          /(?:구현|개발|만들)/,
          /프로그래밍/,
        ],
        keywords: ['코드', '프로그램', '함수', '클래스', '구현', '개발', '작성'],
        weight: 1.0,
      },
      {
        command: '/image',
        patterns: [
          /(?:이미지|그림|일러스트).*(?:생성|만들|그리)/,
          /(?:그림|이미지).*그려/,
          /이미지/,
        ],
        keywords: ['이미지', '그림', '일러스트', '생성', '그리기'],
        weight: 1.0,
      },
      {
        command: '/video',
        patterns: [
          /(?:비디오|동영상|애니메이션).*(?:생성|만들|제작)/,
          /(?:동영상|비디오).*만들/,
          /애니메이션/,
        ],
        keywords: ['비디오', '동영상', '애니메이션', '생성', '제작'],
        weight: 1.0,
      },
    ];

    // Store patterns by language
    this.intentPatterns.set('en', englishPatterns);
    this.intentPatterns.set('ja', japanesePatterns);
    this.intentPatterns.set('cn', chinesePatterns);
    this.intentPatterns.set('ko', koreanPatterns);
  }
}
