/**
 * Port interface for Language Detection
 */

export interface ILanguageDetector {
  detect(text: string): LanguageResult;
  detectBatch(texts: string[]): LanguageResult[];
  getSupportedLanguages(): string[];
}

export interface LanguageResult {
  language: string;
  confidence: number;
  script?: string;
  isReliable: boolean;
}
