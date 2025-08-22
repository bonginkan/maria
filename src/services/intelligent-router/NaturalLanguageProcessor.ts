export interface ProcessedInput {
  original: string;
  normalized: string;
  tokens: string[];
  stems: string[];
  entities: Entity[];
  language: string;
  sentiment?: number;
  keywords: string[];
}

export interface Entity {
  text: string;
  type: 'code' | 'file' | 'url' | 'number' | 'command' | 'language' | 'framework';
  value: unknown;
  position: number;
}

export class NaturalLanguageProcessor {
  private stopWords: Map<string, Set<string>>;
  private contractionMap: Map<string, string>;
  private initialized: boolean = false;

  constructor() {
    this.stopWords = new Map();
    this.contractionMap = new Map();
    this.initializeStopWords();
    this.initializeContractions();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {return;}

    // Initialize any async resources if needed
    this.initialized = true;
  }

  async process(input: string, language: string = 'en'): Promise<ProcessedInput> {
    const normalized = this.normalize(input, language);
    const tokens = this.tokenize(normalized, language);
    const stems = this.stem(tokens, language);
    const entities = this.extractEntities(input);
    const keywords = this.extractKeywords(tokens, language);

    return {
      original: input,
      normalized,
      tokens,
      stems,
      entities,
      language,
      keywords,
    };
  }

  private normalize(text: string, language: string): string {
    let normalized = text.toLowerCase().trim();

    // Expand contractions for English
    if (language === 'en') {
      this.contractionMap.forEach((expanded, contraction) => {
        const regex = new RegExp(`\\b${contraction}\\b`, 'gi');
        normalized = normalized.replace(regex, expanded);
      });
    }

    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ');

    // Language-specific normalization
    switch (language) {
      case 'ja':
        // Japanese specific normalization
        normalized = this.normalizeJapanese(normalized);
        break;
      case 'cn':
        // Chinese specific normalization
        normalized = this.normalizeChinese(normalized);
        break;
      case 'ko':
        // Korean specific normalization
        normalized = this.normalizeKorean(normalized);
        break;
      case 'vn':
        // Vietnamese specific normalization
        normalized = this.normalizeVietnamese(normalized);
        break;
    }

    return normalized;
  }

  private tokenize(text: string, language: string): string[] {
    switch (language) {
      case 'ja':
        return this.tokenizeJapanese(text);
      case 'cn':
        return this.tokenizeChinese(text);
      case 'ko':
        return this.tokenizeKorean(text);
      case 'vn':
        return this.tokenizeVietnamese(text);
      default:
        return this.tokenizeEnglish(text);
    }
  }

  private tokenizeEnglish(text: string): string[] {
    // Simple word boundary tokenization for English
    return text.split(/\s+/).filter((token) => token.length > 0);
  }

  private tokenizeJapanese(text: string): string[] {
    // Simplified Japanese tokenization
    // In production, use a proper tokenizer like kuromoji
    const tokens: string[] = [];
    const patterns = [
      /[\u4e00-\u9faf]+/g, // Kanji
      /[\u3040-\u309f]+/g, // Hiragana
      /[\u30a0-\u30ff]+/g, // Katakana
      /[a-zA-Z]+/g, // English
      /\d+/g, // Numbers
    ];

    patterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {tokens.push(...matches);}
    });

    return tokens;
  }

  private tokenizeChinese(text: string): string[] {
    // Simplified Chinese tokenization
    // In production, use a proper tokenizer like jieba
    const tokens: string[] = [];

    // Character-based tokenization for Chinese
    for (const char of text) {
      if (/[\u4e00-\u9faf]/.test(char)) {
        tokens.push(char);
      } else if (/[a-zA-Z0-9]+/.test(char)) {
        tokens.push(char);
      }
    }

    return tokens;
  }

  private tokenizeKorean(text: string): string[] {
    // Simplified Korean tokenization
    const tokens: string[] = [];
    const patterns = [
      /[\uac00-\ud7af]+/g, // Hangul
      /[a-zA-Z]+/g, // English
      /\d+/g, // Numbers
    ];

    patterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {tokens.push(...matches);}
    });

    return tokens;
  }

  private stem(tokens: string[], language: string): string[] {
    // Simple stemming - in production, use proper stemming libraries
    if (language !== 'en') {
      return tokens; // Skip stemming for non-English
    }

    return tokens.map((token) => {
      // Very basic English stemming rules
      let stem = token;

      // Remove common suffixes
      if (stem.endsWith('ing')) {stem = stem.slice(0, -3);}
      else if (stem.endsWith('ed')) {stem = stem.slice(0, -2);}
      else if (stem.endsWith('ly')) {stem = stem.slice(0, -2);}
      else if (stem.endsWith('es')) {stem = stem.slice(0, -2);}
      else if (stem.endsWith('s') && stem.length > 3) {stem = stem.slice(0, -1);}

      return stem;
    });
  }

  private extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];

    // Extract file paths
    const filePattern = /(?:\/[\w.-]+)+(?:\.\w+)?|(?:[a-zA-Z]:[\\/][\w\\/.-]+)/g;
    const fileMatches = text.match(filePattern);
    if (fileMatches) {
      fileMatches.forEach((match) => {
        entities.push({
          text: match,
          type: 'file',
          value: match,
          position: text.indexOf(match),
        });
      });
    }

    // Extract URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urlMatches = text.match(urlPattern);
    if (urlMatches) {
      urlMatches.forEach((match) => {
        entities.push({
          text: match,
          type: 'url',
          value: match,
          position: text.indexOf(match),
        });
      });
    }

    // Extract programming languages
    const languages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'rust',
      'go',
      'c++',
      'c#',
      'ruby',
      'php',
    ];
    languages.forEach((lang) => {
      const regex = new RegExp(`\\b${lang}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        matches.forEach((match) => {
          entities.push({
            text: match,
            type: 'language',
            value: lang,
            position: text.indexOf(match),
          });
        });
      }
    });

    // Extract frameworks
    const frameworks = [
      'react',
      'vue',
      'angular',
      'next.js',
      'express',
      'django',
      'flask',
      'rails',
      'spring',
    ];
    frameworks.forEach((framework) => {
      const regex = new RegExp(`\\b${framework}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        matches.forEach((match) => {
          entities.push({
            text: match,
            type: 'framework',
            value: framework,
            position: text.indexOf(match),
          });
        });
      }
    });

    return entities;
  }

  private extractKeywords(tokens: string[], language: string): string[] {
    const stopWords = this.stopWords.get(language) ?? new Set();

    // Filter out stop words and short tokens
    const keywords = tokens.filter((token) => {
      return token.length > 2 && !stopWords.has(token.toLowerCase());
    });

    // Sort by frequency
    const frequency = new Map<string, number>();
    keywords.forEach((keyword) => {
      frequency.set(keyword, (frequency.get(keyword) ?? 0) + 1);
    });

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);
  }

  private normalizeJapanese(text: string): string {
    // Convert full-width characters to half-width
    return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => {
      return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
    });
  }

  private normalizeChinese(text: string): string {
    // Convert traditional to simplified (simplified implementation)
    // In production, use a proper conversion library
    return text;
  }

  private normalizeKorean(text: string): string {
    // Korean normalization
    return text;
  }

  private normalizeVietnamese(text: string): string {
    // Vietnamese normalization - lowercase only, keep tones
    return text.toLowerCase();
  }

  private tokenizeVietnamese(text: string): string[] {
    // Vietnamese tokenization - word-based similar to English
    return text.split(/\s+/).filter((token) => token.length > 0);
  }

  private initializeStopWords(): void {
    // English stop words
    this.stopWords.set(
      'en',
      new Set([
        'a',
        'an',
        'and',
        'are',
        'as',
        'at',
        'be',
        'by',
        'for',
        'from',
        'has',
        'he',
        'in',
        'is',
        'it',
        'its',
        'of',
        'on',
        'that',
        'the',
        'to',
        'was',
        'will',
        'with',
        'the',
        'this',
        'these',
        'those',
        'i',
        'you',
        'we',
        'they',
        'what',
        'which',
        'who',
        'when',
        'where',
        'how',
        'can',
        'could',
        'should',
        'would',
        'may',
        'might',
        'must',
        'do',
        'does',
        'did',
        'have',
        'had',
        'get',
        'got',
        'make',
        'made',
      ]),
    );

    // Japanese particles and common words
    this.stopWords.set(
      'ja',
      new Set([
        'の',
        'を',
        'に',
        'は',
        'が',
        'と',
        'で',
        'て',
        'も',
        'から',
        'まで',
        'より',
        'へ',
        'や',
        'など',
        'です',
        'ます',
        'する',
        'した',
        'これ',
        'それ',
        'あれ',
        'この',
        'その',
        'あの',
      ]),
    );

    // Chinese common words
    this.stopWords.set(
      'cn',
      new Set([
        '的',
        '了',
        '在',
        '是',
        '我',
        '有',
        '和',
        '就',
        '不',
        '人',
        '都',
        '一',
        '一个',
        '上',
        '也',
        '很',
        '到',
        '说',
        '要',
        '去',
        '你',
        '会',
        '着',
        '没有',
        '看',
        '好',
        '自己',
        '这',
        '那',
      ]),
    );

    // Korean particles and common words
    this.stopWords.set(
      'ko',
      new Set([
        '의',
        '를',
        '을',
        '에',
        '가',
        '이',
        '은',
        '는',
        '와',
        '과',
        '에서',
        '으로',
        '로',
        '부터',
        '까지',
        '입니다',
        '합니다',
        '이다',
        '하다',
      ]),
    );

    // Vietnamese common words
    this.stopWords.set(
      'vn',
      new Set([
        'và',
        'của',
        'là',
        'có',
        'được',
        'trong',
        'với',
        'này',
        'cho',
        'để',
        'không',
        'nhưng',
        'cũng',
        'như',
        'từ',
        'đến',
        'sau',
        'trước',
        'một',
        'các',
        'bị',
        'đã',
        'sẽ',
        'khi',
        'nếu',
        'thì',
        'vì',
        'hoặc',
        'hay',
        'rất',
      ]),
    );
  }

  private initializeContractions(): void {
    // Common English contractions
    this.contractionMap.set("don't", 'do not');
    this.contractionMap.set("won't", 'will not');
    this.contractionMap.set("can't", 'cannot');
    this.contractionMap.set("n't", ' not');
    this.contractionMap.set("'re", ' are');
    this.contractionMap.set("'ve", ' have');
    this.contractionMap.set("'ll", ' will');
    this.contractionMap.set("'d", ' would');
    this.contractionMap.set("'m", ' am');
    this.contractionMap.set("let's", 'let us');
    this.contractionMap.set("it's", 'it is');
    this.contractionMap.set("that's", 'that is');
    this.contractionMap.set("what's", 'what is');
    this.contractionMap.set("there's", 'there is');
    this.contractionMap.set("here's", 'here is');
  }

  async detectIntent(processedInput: ProcessedInput): Promise<string[]> {
    // Extract potential intents based on keywords
    const intents: string[] = [];
    const keywords = `${processedInput.keywords.join(' ')  } ${  processedInput.normalized}`;

    // Code-related intents
    if (/\b(write|create|generate|implement|build|code|program|develop)\b/i.test(keywords)) {
      intents.push('code_generation');
    }

    // Image-related intents
    if (/\b(image|picture|photo|draw|illustrate|visual|graphic)\b/i.test(keywords)) {
      intents.push('image_generation');
    }

    // Video-related intents
    if (/\b(video|movie|animation|clip|film)\b/i.test(keywords)) {
      intents.push('video_generation');
    }

    // Test-related intents
    if (/\b(test|testing|unit test|integration test|e2e)\b/i.test(keywords)) {
      intents.push('test_generation');
    }

    // Review-related intents
    if (/\b(review|check|analyze|improve|refactor|optimize)\b/i.test(keywords)) {
      intents.push('code_review');
    }

    return intents;
  }
}
