export type SupportedLanguage = 'en' | 'ja' | 'cn' | 'ko' | 'vn';

interface LanguageScore {
  language: SupportedLanguage;
  score: number;
}

export class LanguageDetector {
  private languagePatterns: Map<SupportedLanguage, RegExp[]>;
  private characterRanges: Map<SupportedLanguage, RegExp[]>;

  constructor() {
    this.languagePatterns = new Map();
    this.characterRanges = new Map();
    this.initializePatterns();
  }

  async detect(text: string): Promise<SupportedLanguage> {
    const scores = this.calculateScores(text);

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // If the top score is significantly higher, use it
    if (scores.length > 0 && scores[0]?.score && scores[0].score > 0) {
      return scores[0].language;
    }

    // Default to English
    return 'en';
  }

  private calculateScores(text: string): LanguageScore[] {
    const scores: LanguageScore[] = [
      { language: 'en', score: 0 },
      { language: 'ja', score: 0 },
      { language: 'cn', score: 0 },
      { language: 'ko', score: 0 },
      { language: 'vn', score: 0 },
    ];

    // Character-based detection
    this.characterRanges.forEach((patterns, language) => {
      patterns.forEach((pattern) => {
        const matches = text.match(pattern);
        if (matches) {
          const score = scores.find((s) => s.language === language);
          if (score) {
            score.score += matches.length * 2;
          }
        }
      });
    });

    // Pattern-based detection for more accuracy
    this.languagePatterns.forEach((patterns, language) => {
      patterns.forEach((pattern) => {
        if (pattern.test(text)) {
          const score = scores.find((s) => s.language === language);
          if (score) {
            score.score += 3;
          }
        }
      });
    });

    // Check for English words (common programming terms)
    const englishTerms =
      /\b(function|class|const|let|var|if|else|for|while|return|import|export|async|await|create|make|generate|write|code|test|review)\b/i;
    if (englishTerms.test(text)) {
      const englishScore = scores.find((s) => s.language === 'en');
      if (englishScore) {
        englishScore.score += 5;
      }
    }

    // Normalize scores
    const totalChars = text.length;
    scores.forEach((score) => {
      if (totalChars > 0) {
        score.score = (score.score / totalChars) * 100;
      }
    });

    return scores;
  }

  private initializePatterns(): void {
    // Japanese patterns
    this.characterRanges.set('ja', [
      /[\u3040-\u309f]/g, // Hiragana
      /[\u30a0-\u30ff]/g, // Katakana
      /[\u4e00-\u9faf]/g, // Kanji (also used in Chinese)
    ]);

    this.languagePatterns.set('ja', [
      /[ぁ-ん]/, // Hiragana check
      /[ァ-ヴ]/, // Katakana check
      /です|ます|ください|して/, // Common endings
      /は|が|を|に|で|と|の|から|まで/, // Particles
    ]);

    // Chinese patterns
    this.characterRanges.set('cn', [
      /[\u4e00-\u9faf]/g, // Chinese characters
    ]);

    this.languagePatterns.set('cn', [
      /的|了|是|在|有|和|不|人|我|你|他|她/, // Common Chinese characters
      /这|那|什么|怎么|为什么/, // Common question words
      /吗|呢|吧|啊/, // Sentence particles
    ]);

    // Korean patterns
    this.characterRanges.set('ko', [
      /[\uac00-\ud7af]/g, // Hangul syllables
      /[\u1100-\u11ff]/g, // Hangul Jamo
      /[\u3130-\u318f]/g, // Hangul compatibility Jamo
    ]);

    this.languagePatterns.set('ko', [
      /[가-힣]/, // Hangul check
      /입니다|습니다|합니다/, // Formal endings
      /을|를|이|가|은|는|의/, // Particles
    ]);

    // Vietnamese patterns
    this.characterRanges.set('vn', [
      /[a-zA-Zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/g, // Vietnamese with tones
    ]);

    this.languagePatterns.set('vn', [
      /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/, // Vietnamese tones
      /và|của|là|có|được|trong|với|này|cho|để/, // Common Vietnamese words
      /không|nhưng|cũng|như|từ|đến|sau|trước/, // More common words
    ]);

    // English patterns
    this.characterRanges.set('en', [
      /[a-zA-Z]/g, // Latin alphabet
    ]);

    this.languagePatterns.set('en', [
      /\b(the|be|to|of|and|a|in|that|have|I|it|for|not|on|with|he|as|you|do|at)\b/i, // Common English words
      /\b(this|but|his|by|from|they|we|say|her|she|or|an|will|my|one|all|would|there|their)\b/i,
    ]);
  }

  getLanguageName(code: SupportedLanguage): string {
    const names: Record<SupportedLanguage, string> = {
      en: 'English',
      ja: 'Japanese',
      cn: 'Chinese',
      ko: 'Korean',
      vn: 'Vietnamese',
    };
    return names[code] || 'Unknown';
  }

  isSupported(languageCode: string): languageCode is SupportedLanguage {
    return ['en', 'ja', 'cn', 'ko', 'vn'].includes(languageCode);
  }
}
