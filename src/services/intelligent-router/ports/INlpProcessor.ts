/**
 * Port interface for Natural Language Processing
 * Allows for different NLP implementations (OpenAI, local, etc.)
 */

export interface INlpProcessor {
  tokenize(text: string): string[];
  detectLanguage(text: string): Promise<Language>;
  classifyIntent(text: string): Promise<Intent>;
  extractEntities(text: string): Promise<Entity[]>;
}

export interface Language {
  code: "en" | "ja" | "zh" | "ko" | "es" | "fr" | "de" | "other";
  confidence: number;
  detected: boolean;
}

export interface Intent {
  type: string;
  confidence: number;
  parameters?: Record<string, any>;
}

export interface Entity {
  type: string;
  value: string;
  position: [number, number];
  confidence: number;
}
