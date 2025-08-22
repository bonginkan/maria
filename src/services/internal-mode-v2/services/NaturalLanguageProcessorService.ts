/**
 * Natural Language Processor Service
 * Handles language detection, intent extraction, and NLP operations
 */

import { BaseService, Service, Inject } from '../core';

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  alternatives: Array<{ language: string; confidence: number }>;
}

export interface IntentExtractionRequest {
  text: string;
  language: string;
  context?: Record<string, any>;
}

export interface IntentExtractionResult {
  command: string;
  confidence: number;
  parameters: Record<string, any>;
  language: string;
  originalInput: string;
  matchedPhrases: string[];
}

@Service({
  id: 'nlp-processor',
  name: 'NaturalLanguageProcessorService',
  version: '1.0.0',
  description: 'Natural language processing engine for intent recognition',
  dependencies: ['command-mapping'],
})
export class NaturalLanguageProcessorService extends BaseService {
  id = 'nlp-processor';
  version = '1.0.0';

  // Language detection patterns
  private languagePatterns = {
    japanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,
    chinese: /[\u4E00-\u9FFF]/,
    korean: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
    vietnamese: /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/,
    english: /^[a-zA-Z\s.,!?;:'"()-0-9]+$/,
  };

  // Common command keywords by language
  private commandKeywords = {
    japanese: {
      code: [
        'コード',
        '実装',
        'プログラム',
        '関数',
        'クラス',
        'メソッド',
        '書いて',
        '作って',
        '生成',
      ],
      image: ['画像', 'イメージ', '絵', 'ビジュアル', '図', 'イラスト', '描いて', '作成'],
      video: ['動画', 'ビデオ', 'アニメーション', 'ムービー', '映像'],
      document: ['ドキュメント', '文書', '資料', '説明', 'マークダウン'],
      slides: ['スライド', 'プレゼン', '発表'],
      bug: ['バグ', 'エラー', '不具合', '修正', 'デバッグ'],
      lint: ['リント', 'チェック', '品質', 'コード検査'],
      test: ['テスト', 'ユニット', '検証'],
    },
    english: {
      code: [
        'code',
        'implement',
        'program',
        'function',
        'class',
        'method',
        'write',
        'create',
        'generate',
        'build',
      ],
      image: [
        'image',
        'picture',
        'visual',
        'illustration',
        'graphic',
        'draw',
        'create',
        'generate',
      ],
      video: ['video', 'animation', 'movie', 'clip', 'render', 'create'],
      document: ['document', 'docs', 'documentation', 'markdown', 'write'],
      slides: ['slides', 'presentation', 'deck', 'slideshow'],
      bug: ['bug', 'error', 'issue', 'fix', 'debug', 'problem'],
      lint: ['lint', 'check', 'quality', 'analyze', 'review'],
      test: ['test', 'unit', 'spec', 'verify', 'validate'],
    },
    chinese: {
      code: ['代码', '编程', '函数', '类', '方法', '实现', '创建', '生成'],
      image: ['图像', '图片', '插图', '绘制', '创建'],
      video: ['视频', '动画', '影片', '制作'],
      document: ['文档', '文件', '说明', '资料'],
      slides: ['幻灯片', '演示', '展示'],
      bug: ['错误', '缺陷', '修复', '调试'],
      lint: ['检查', '质量', '分析'],
      test: ['测试', '验证', '检验'],
    },
    korean: {
      code: ['코드', '프로그램', '함수', '클래스', '메소드', '구현', '작성', '생성'],
      image: ['이미지', '그림', '일러스트', '그려', '만들어'],
      video: ['비디오', '동영상', '애니메이션', '제작'],
      document: ['문서', '도큐먼트', '설명서'],
      slides: ['슬라이드', '프레젠테이션', '발표'],
      bug: ['버그', '오류', '수정', '디버그'],
      lint: ['린트', '검사', '품질'],
      test: ['테스트', '검증', '확인'],
    },
    vietnamese: {
      code: ['mã', 'lập trình', 'hàm', 'lớp', 'phương thức', 'thực hiện', 'tạo'],
      image: ['hình ảnh', 'ảnh', 'minh họa', 'vẽ', 'tạo'],
      video: ['video', 'phim', 'hoạt hình', 'tạo'],
      document: ['tài liệu', 'văn bản', 'giải thích'],
      slides: ['slide', 'trình bày', 'thuyết trình'],
      bug: ['lỗi', 'bug', 'sửa', 'debug'],
      lint: ['kiểm tra', 'chất lượng', 'phân tích'],
      test: ['test', 'kiểm tra', 'xác thực'],
    },
  };

  async onInitialize(): Promise<void> {
    this.logger.info('Initializing Natural Language Processor Service...');
  }

  async onStart(): Promise<void> {
    this.logger.info('Starting Natural Language Processor Service...');
    this.emitServiceEvent('nlp:started', { service: this.id });
  }

  /**
   * Detect language of input text
   */
  async detectLanguage(options: { text: string }): Promise<string> {
    const { text } = options;
    const normalized = text.toLowerCase().trim();

    // Check for specific language patterns
    if (this.languagePatterns.japanese.test(text)) {
      return 'japanese';
    }
    if (this.languagePatterns.korean.test(text)) {
      return 'korean';
    }
    if (this.languagePatterns.vietnamese.test(text)) {
      return 'vietnamese';
    }
    if (this.languagePatterns.chinese.test(text)) {
      return 'chinese';
    }

    // Default to English if no specific patterns found
    return 'english';
  }

  /**
   * Extract intent from natural language input
   */
  async extractIntent(request: IntentExtractionRequest): Promise<IntentExtractionResult | null> {
    const { text, language, context } = request;
    const normalized = text.toLowerCase().trim();

    // Get command mappings for the detected language
    const commandMappings = await this.callService<Record<string, string[]>>(
      'command-mapping',
      'getMappingsForLanguage',
      { language },
    );

    if (!commandMappings) {
      return null;
    }

    // Calculate scores for each command
    const commandScores: Array<{
      command: string;
      score: number;
      matchedPhrases: string[];
    }> = [];

    for (const [command, phrases] of Object.entries(commandMappings)) {
      const result = this.calculateCommandScore(normalized, phrases);
      if (result.score > 0) {
        commandScores.push({
          command,
          score: result.score,
          matchedPhrases: result.matchedPhrases,
        });
      }
    }

    // Sort by score and get the best match
    commandScores.sort((a, b) => b.score - a.score);

    if (commandScores.length === 0 || commandScores[0].score < 0.3) {
      return null;
    }

    const bestMatch = commandScores[0];

    // Apply contextual boost
    const contextualScore = this.applyContextualBoost(bestMatch.command, bestMatch.score, context);

    return {
      command: bestMatch.command,
      confidence: Math.min(contextualScore, 1.0),
      parameters: {},
      language,
      originalInput: text,
      matchedPhrases: bestMatch.matchedPhrases,
    };
  }

  /**
   * Get detailed language analysis
   */
  async analyzeLanguage(options: { text: string }): Promise<LanguageDetectionResult> {
    const { text } = options;
    const scores: Array<{ language: string; confidence: number }> = [];

    // Test against each language pattern
    for (const [lang, pattern] of Object.entries(this.languagePatterns)) {
      if (lang === 'english') continue; // Handle English separately

      const matches = text.match(pattern);
      if (matches) {
        const confidence = Math.min((matches.length / text.length) * 2, 1.0);
        scores.push({ language: lang, confidence });
      }
    }

    // Check for English (lack of other language patterns)
    const hasNonEnglish = scores.some((s) => s.confidence > 0.1);
    if (!hasNonEnglish && this.languagePatterns.english.test(text)) {
      scores.push({ language: 'english', confidence: 0.8 });
    }

    // Sort by confidence
    scores.sort((a, b) => b.confidence - a.confidence);

    const primaryLanguage = scores[0]?.language || 'english';
    const primaryConfidence = scores[0]?.confidence || 0.5;

    return {
      language: primaryLanguage,
      confidence: primaryConfidence,
      alternatives: scores.slice(1, 3), // Top 2 alternatives
    };
  }

  /**
   * Calculate command matching score
   */
  private calculateCommandScore(
    input: string,
    phrases: string[],
  ): { score: number; matchedPhrases: string[] } {
    let totalScore = 0;
    const matchedPhrases: string[] = [];

    for (const phrase of phrases) {
      const normalizedPhrase = phrase.toLowerCase();

      // Exact match gets highest score
      if (input.includes(normalizedPhrase)) {
        totalScore += 1.0;
        matchedPhrases.push(phrase);
        continue;
      }

      // Word-level matching
      const inputWords = input.split(/\s+/);
      const phraseWords = normalizedPhrase.split(/\s+/);

      let wordMatches = 0;
      for (const phraseWord of phraseWords) {
        if (
          inputWords.some(
            (inputWord) => inputWord.includes(phraseWord) || phraseWord.includes(inputWord),
          )
        ) {
          wordMatches++;
        }
      }

      if (wordMatches > 0) {
        const wordScore = (wordMatches / phraseWords.length) * 0.7;
        totalScore += wordScore;
        if (wordScore > 0.3) {
          matchedPhrases.push(phrase);
        }
      }
    }

    return {
      score: Math.min(totalScore / phrases.length, 1.0),
      matchedPhrases,
    };
  }

  /**
   * Apply contextual scoring boost
   */
  private applyContextualBoost(
    command: string,
    baseScore: number,
    context?: Record<string, any>,
  ): number {
    if (!context) return baseScore;

    let boost = 0;

    // Recent command history
    if (context.recentCommands && Array.isArray(context.recentCommands)) {
      const recentSame = context.recentCommands.filter((cmd) => cmd === command).length;
      boost += recentSame * 0.1;
    }

    // Current working directory context
    if (context.workingDirectory) {
      const isCodeProject = /\.(js|ts|py|java|cpp|c|go|rust|php)$/.test(context.workingDirectory);
      if (isCodeProject && command === '/code') {
        boost += 0.15;
      }
    }

    return Math.min(baseScore + boost, 1.0);
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      supportedLanguages: Object.keys(this.languagePatterns),
      commandKeywords: Object.keys(this.commandKeywords),
      averageProcessingTime: 0, // TODO: Implement metrics tracking
    };
  }
}
