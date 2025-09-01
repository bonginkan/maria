/**
 * Language Detection and Processing Command
 * Provides access to the Phase 5 multilingual engine capabilities
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../types";
import { logger } from "../../../utils/logger";

// Import multilingual components (would be actual imports in production)
interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
  alternativeCandidates: Array<{
    language: string;
    confidence: number;
  }>;
  textLength: number;
  features: {
    hasUnicode: boolean;
    hasLatinScript: boolean;
    hasCJKScript: boolean;
    hasArabicScript: boolean;
  };
}

interface LanguageWeights {
  language: string;
  searchWeights: {
    bm25: number;
    vector: number;
    kg: number;
  };
  optimizations: {
    tokenization: string;
    stemming: boolean;
    stopWords: boolean;
    characterNormalization: boolean;
  };
  models: {
    embedding: string;
    reranking: string;
    tokenizer: string;
  };
}

interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  status: "fully-supported" | "experimental" | "planned";
  capabilities: {
    detection: boolean;
    tokenization: boolean;
    embedding: boolean;
    reranking: boolean;
    stemming: boolean;
    stopWords: boolean;
  };
  models: string[];
  lastUpdated: string;
}

export class LanguageCommand extends BaseCommand {
  name = "language";
  category = "multilingual" as const;
  description =
    "🌍 Language detection, weights configuration, and multilingual processing";
  override aliases = ["lang", "detect", "ml"];
  override usage =
    "[detect|weights|supported|optimize] [<text>] [--lang <code>] [--verbose] [--format <format>]";

  override examples: CommandExample[] = [
    {
      input: '/language detect "Hello world"',
      description: "Detect language of English text",
      output: "Detected: English (en) with 98.5% confidence",
    },
    {
      input: '/language detect "こんにちは世界"',
      description: "Detect language of Japanese text",
      output: "Detected: Japanese (ja) with 99.2% confidence",
    },
    {
      input: "/language weights --lang ja",
      description: "Show search weights optimized for Japanese",
      output: "BM25: 0.5, Vector: 0.3, KG: 0.2 with Japanese tokenization",
    },
    {
      input: "/language supported --format table",
      description: "List all supported languages with capabilities",
      output: "Table of 7 supported languages with status and features",
    },
  ];

  override permissions = {
    requiresAuth: false,
    role: undefined,
  };

  override rateLimit = {
    requests: 50,
    window: "1m",
  };

  // Supported languages based on Phase 5 implementation
  private readonly SUPPORTED_LANGUAGES: SupportedLanguage[] = [
    {
      code: "en",
      name: "English",
      nativeName: "English",
      status: "fully-supported",
      capabilities: {
        detection: true,
        tokenization: true,
        embedding: true,
        reranking: true,
        stemming: true,
        stopWords: true,
      },
      models: ["bge-m3", "minilm", "cross-encoder-en"],
      lastUpdated: "2025-08-25",
    },
    {
      code: "ja",
      name: "Japanese",
      nativeName: "日本語",
      status: "fully-supported",
      capabilities: {
        detection: true,
        tokenization: true,
        embedding: true,
        reranking: true,
        stemming: false,
        stopWords: true,
      },
      models: ["bge-m3", "sonoisa/sentence-bert-base-ja-mean-tokens"],
      lastUpdated: "2025-08-25",
    },
    {
      code: "zh",
      name: "Chinese",
      nativeName: "中文",
      status: "fully-supported",
      capabilities: {
        detection: true,
        tokenization: true,
        embedding: true,
        reranking: true,
        stemming: false,
        stopWords: true,
      },
      models: ["bge-m3", "shibing624/text2vec-base-chinese"],
      lastUpdated: "2025-08-25",
    },
    {
      code: "ko",
      name: "Korean",
      nativeName: "한국어",
      status: "fully-supported",
      capabilities: {
        detection: true,
        tokenization: true,
        embedding: true,
        reranking: true,
        stemming: false,
        stopWords: true,
      },
      models: ["bge-m3", "jhgan/ko-sroberta-multitask"],
      lastUpdated: "2025-08-25",
    },
    {
      code: "es",
      name: "Spanish",
      nativeName: "Español",
      status: "fully-supported",
      capabilities: {
        detection: true,
        tokenization: true,
        embedding: true,
        reranking: true,
        stemming: true,
        stopWords: true,
      },
      models: ["bge-m3", "hiiamsid/sentence_similarity_spanish_es"],
      lastUpdated: "2025-08-25",
    },
    {
      code: "fr",
      name: "French",
      nativeName: "Français",
      status: "fully-supported",
      capabilities: {
        detection: true,
        tokenization: true,
        embedding: true,
        reranking: true,
        stemming: true,
        stopWords: true,
      },
      models: ["bge-m3", "dangvantuan/sentence-camembert-base"],
      lastUpdated: "2025-08-25",
    },
    {
      code: "de",
      name: "German",
      nativeName: "Deutsch",
      status: "fully-supported",
      capabilities: {
        detection: true,
        tokenization: true,
        embedding: true,
        reranking: true,
        stemming: true,
        stopWords: true,
      },
      models: [
        "bge-m3",
        "T-Systems-onsite/german-roberta-sentence-transformer-v2",
      ],
      lastUpdated: "2025-08-25",
    },
  ];

  async execute(
    args: CommandArgs,
    _context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const { options, parsed } = args;
      const positional = (parsed["positional"] as string[]) || [];

      const subcommand = positional[0] || "detect";
      const text = positional.slice(1).join(" ");

      switch (subcommand.toLowerCase()) {
        case "detect":
          return await this.detectLanguage(text, options);
        case "weights":
          return await this.getLanguageWeights(options);
        case "supported":
          return await this.getSupportedLanguages(options);
        case "optimize":
          return await this.optimizeForLanguage(options);
        default:
          return this.error(
            `Unknown subcommand: ${subcommand}`,
            "INVALID_SUBCOMMAND",
            "Available subcommands: detect, weights, supported, optimize",
          );
      }
    } catch (error) {
      logger.error("Language command failed:", error);
      return this.error(
        "Language processing failed",
        "LANGUAGE_ERROR",
        error instanceof Error ? error.message : "Unknown error occurred",
      );
    }
  }

  /**
   * Detect language of text
   */
  private async detectLanguage(
    text: string,
    options: Record<string, any>,
  ): Promise<CommandResult> {
    if (!text || text.trim().length === 0) {
      return this.error(
        "Text is required for language detection",
        "MISSING_TEXT",
        'Usage: /language detect "your text here"',
      );
    }

    if (text.length > 10000) {
      return this.error(
        "Text is too long for detection (max 10,000 characters)",
        "TEXT_TOO_LONG",
      );
    }

    logger.info("Detecting language", {
      textLength: text.length,
      preview: text.substring(0, 100),
    });

    const detectionResult = await this.performLanguageDetection(text);
    const formattedOutput = this.formatDetectionResult(
      detectionResult,
      text,
      options,
    );

    return this.success(formattedOutput, {
      detectedLanguage: detectionResult.detectedLanguage,
      confidence: detectionResult.confidence,
      textLength: detectionResult.textLength,
      type: "language-detection",
    });
  }

  /**
   * Get language-specific search weights
   */
  private async getLanguageWeights(
    options: Record<string, any>,
  ): Promise<CommandResult> {
    const languageCode = options["lang"] || options["language"];

    if (!languageCode) {
      return this.error(
        "Language code is required",
        "MISSING_LANGUAGE",
        "Usage: /language weights --lang <code> (e.g., --lang ja)",
      );
    }

    if (!this.isLanguageSupported(languageCode)) {
      return this.error(
        `Unsupported language: ${languageCode}`,
        "UNSUPPORTED_LANGUAGE",
        `Supported languages: ${this.SUPPORTED_LANGUAGES.map((l) => l.code).join(", ")}`,
      );
    }

    const weights = await this.getWeightsForLanguage(languageCode);
    const formattedOutput = this.formatWeights(weights, options);

    return this.success(formattedOutput, {
      language: languageCode,
      weights: weights.searchWeights,
      type: "language-weights",
    });
  }

  /**
   * Get supported languages
   */
  private async getSupportedLanguages(
    options: Record<string, any>,
  ): Promise<CommandResult> {
    const format = (options["format"] as string) || "table";
    const formattedOutput = this.formatSupportedLanguages(format, options);

    return this.success(formattedOutput, {
      languageCount: this.SUPPORTED_LANGUAGES.length,
      format,
      type: "supported-languages",
    });
  }

  /**
   * Optimize configuration for specific language
   */
  private async optimizeForLanguage(
    options: Record<string, any>,
  ): Promise<CommandResult> {
    const languageCode = options["lang"] || options["language"];

    if (!languageCode) {
      return this.error(
        "Language code is required",
        "MISSING_LANGUAGE",
        "Usage: /language optimize --lang <code>",
      );
    }

    const optimization =
      await this.generateOptimizationSuggestions(languageCode);
    const formattedOutput = this.formatOptimizationSuggestions(optimization);

    return this.success(formattedOutput, {
      language: languageCode,
      type: "language-optimization",
    });
  }

  /**
   * Perform language detection (mock implementation)
   */
  private async performLanguageDetection(
    text: string,
  ): Promise<LanguageDetectionResult> {
    // Simple heuristic-based detection for demonstration
    const features = {
      hasUnicode: /[^\u0000-\u007F]/.test(text),
      hasLatinScript: /[A-Za-z]/.test(text),
      hasCJKScript:
        /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]/.test(text),
      hasArabicScript: /[\u0600-\u06FF]/.test(text),
    };

    let detectedLanguage = "en";
    let confidence = 0.85;
    const alternatives: Array<{ language: string; confidence: number }> = [];

    // Japanese detection
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
      detectedLanguage = "ja";
      confidence = 0.92;
      alternatives.push({ language: "zh", confidence: 0.15 });
    }
    // Chinese detection
    else if (/[\u4E00-\u9FAF]/.test(text)) {
      detectedLanguage = "zh";
      confidence = 0.88;
      alternatives.push({ language: "ja", confidence: 0.2 });
    }
    // Korean detection
    else if (/[\uAC00-\uD7AF]/.test(text)) {
      detectedLanguage = "ko";
      confidence = 0.95;
    }
    // European languages (simple keyword detection)
    else if (/\b(der|die|das|und|mit|von)\b/i.test(text)) {
      detectedLanguage = "de";
      confidence = 0.78;
      alternatives.push({ language: "en", confidence: 0.35 });
    } else if (/\b(le|la|les|et|avec|pour)\b/i.test(text)) {
      detectedLanguage = "fr";
      confidence = 0.76;
      alternatives.push({ language: "en", confidence: 0.4 });
    } else if (/\b(el|la|los|las|y|con|para)\b/i.test(text)) {
      detectedLanguage = "es";
      confidence = 0.81;
      alternatives.push({ language: "en", confidence: 0.3 });
    } else {
      // Default to English
      alternatives.push({ language: "de", confidence: 0.15 });
      alternatives.push({ language: "fr", confidence: 0.12 });
    }

    // Adjust confidence based on text length
    if (text.length < 10) {
      confidence *= 0.7;
    } else if (text.length < 50) {
      confidence *= 0.85;
    }

    // Simulate processing time
    await new Promise((resolve) =>
      setTimeout(resolve, 50 + Math.random() * 100),
    );

    return {
      detectedLanguage,
      confidence: Math.min(confidence, 0.99),
      alternativeCandidates: alternatives,
      textLength: text.length,
      features,
    };
  }

  /**
   * Get search weights for specific language
   */
  private async getWeightsForLanguage(
    languageCode: string,
  ): Promise<LanguageWeights> {
    const baseWeights: Record<string, LanguageWeights> = {
      en: {
        language: "en",
        searchWeights: { bm25: 0.4, vector: 0.4, kg: 0.2 },
        optimizations: {
          tokenization: "standard",
          stemming: true,
          stopWords: true,
          characterNormalization: false,
        },
        models: {
          embedding: "bge-m3",
          reranking: "cross-encoder-en",
          tokenizer: "standard",
        },
      },
      ja: {
        language: "ja",
        searchWeights: { bm25: 0.5, vector: 0.3, kg: 0.2 },
        optimizations: {
          tokenization: "mecab",
          stemming: false,
          stopWords: true,
          characterNormalization: true,
        },
        models: {
          embedding: "bge-m3",
          reranking: "cross-encoder-ja",
          tokenizer: "mecab",
        },
      },
      zh: {
        language: "zh",
        searchWeights: { bm25: 0.45, vector: 0.35, kg: 0.2 },
        optimizations: {
          tokenization: "jieba",
          stemming: false,
          stopWords: true,
          characterNormalization: true,
        },
        models: {
          embedding: "bge-m3",
          reranking: "cross-encoder-zh",
          tokenizer: "jieba",
        },
      },
      ko: {
        language: "ko",
        searchWeights: { bm25: 0.45, vector: 0.35, kg: 0.2 },
        optimizations: {
          tokenization: "komoran",
          stemming: false,
          stopWords: true,
          characterNormalization: true,
        },
        models: {
          embedding: "bge-m3",
          reranking: "cross-encoder-ko",
          tokenizer: "komoran",
        },
      },
    };

    return baseWeights[languageCode] || baseWeights["en"];
  }

  /**
   * Check if language is supported
   */
  private isLanguageSupported(languageCode: string): boolean {
    return this.SUPPORTED_LANGUAGES.some((lang) => lang.code === languageCode);
  }

  /**
   * Generate optimization suggestions
   */
  private async generateOptimizationSuggestions(
    languageCode: string,
  ): Promise<any> {
    const language = this.SUPPORTED_LANGUAGES.find(
      (l) => l.code === languageCode,
    );
    if (!language) {
      throw new Error(`Unsupported language: ${languageCode}`);
    }

    return {
      language,
      suggestions: [
        {
          category: "Search Weights",
          recommendation: `Optimize BM25 weight to ${language.code === "ja" ? "0.5" : "0.4"} for better lexical matching`,
          impact: "High",
          implementation: "Update search configuration",
        },
        {
          category: "Tokenization",
          recommendation: language.capabilities.tokenization
            ? `Use language-specific tokenizer for ${language.name}`
            : "Use standard tokenization",
          impact: "Medium",
          implementation: "Configure tokenizer in preprocessing",
        },
        {
          category: "Models",
          recommendation: `Use ${language.models[0]} for optimal embedding quality`,
          impact: "High",
          implementation: "Update model configuration",
        },
      ],
    };
  }

  /**
   * Format detection result
   */
  private formatDetectionResult(
    result: LanguageDetectionResult,
    originalText: string,
    options: Record<string, any>,
  ): string {
    const lines: string[] = [];
    const verbose = options["verbose"] || false;

    lines.push("");
    lines.push("🌍 LANGUAGE DETECTION RESULT");
    lines.push("═".repeat(40));
    lines.push("");

    const language = this.SUPPORTED_LANGUAGES.find(
      (l) => l.code === result.detectedLanguage,
    );
    const languageName = language
      ? `${language.name} (${language.nativeName})`
      : result.detectedLanguage.toUpperCase();

    lines.push(`**Detected Language:** ${languageName}`);
    lines.push(`**Language Code:** ${result.detectedLanguage}`);
    lines.push(`**Confidence:** ${(result.confidence * 100).toFixed(1)}%`);
    lines.push(`**Text Length:** ${result.textLength} characters`);
    lines.push("");

    if (result.alternativeCandidates.length > 0) {
      lines.push("🔄 **Alternative Candidates:**");
      for (const alt of result.alternativeCandidates) {
        const altLang = this.SUPPORTED_LANGUAGES.find(
          (l) => l.code === alt.language,
        );
        const altName = altLang ? altLang.name : alt.language.toUpperCase();
        lines.push(`  • ${altName}: ${(alt.confidence * 100).toFixed(1)}%`);
      }
      lines.push("");
    }

    if (verbose) {
      lines.push("🔍 **Text Analysis:**");
      lines.push(
        `  Unicode Characters: ${result.features.hasUnicode ? "✓" : "✗"}`,
      );
      lines.push(
        `  Latin Script: ${result.features.hasLatinScript ? "✓" : "✗"}`,
      );
      lines.push(`  CJK Script: ${result.features.hasCJKScript ? "✓" : "✗"}`);
      lines.push(
        `  Arabic Script: ${result.features.hasArabicScript ? "✓" : "✗"}`,
      );
      lines.push("");

      lines.push(
        `**Text Preview:** "${originalText.substring(0, 100)}${originalText.length > 100 ? "..." : ""}"`,
      );
      lines.push("");
    }

    if (language) {
      lines.push("⚡ **Language Support:**");
      lines.push(
        `  Status: ${language.status.replace("-", " ").toUpperCase()}`,
      );
      lines.push(
        `  Capabilities: ${Object.entries(language.capabilities)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(", ")}`,
      );
      lines.push(`  Models: ${language.models.slice(0, 2).join(", ")}`);
    }

    return lines.join("\n");
  }

  /**
   * Format language weights
   */
  private formatWeights(
    weights: LanguageWeights,
    options: Record<string, any>,
  ): string {
    const lines: string[] = [];
    const verbose = options["verbose"] || false;

    const language = this.SUPPORTED_LANGUAGES.find(
      (l) => l.code === weights.language,
    );
    const languageName = language
      ? `${language.name} (${language.nativeName})`
      : weights.language.toUpperCase();

    lines.push("");
    lines.push(`⚖️ SEARCH WEIGHTS - ${languageName}`);
    lines.push("═".repeat(40));
    lines.push("");

    lines.push("📊 **Search Component Weights:**");
    lines.push(
      `  BM25 (Lexical):     ${weights.searchWeights.bm25.toFixed(2)}`,
    );
    lines.push(
      `  Vector (Semantic):  ${weights.searchWeights.vector.toFixed(2)}`,
    );
    lines.push(`  Knowledge Graph:    ${weights.searchWeights.kg.toFixed(2)}`);
    lines.push("");

    lines.push("🔧 **Language Optimizations:**");
    lines.push(`  Tokenization: ${weights.optimizations.tokenization}`);
    lines.push(
      `  Stemming: ${weights.optimizations.stemming ? "Enabled" : "Disabled"}`,
    );
    lines.push(
      `  Stop Words: ${weights.optimizations.stopWords ? "Enabled" : "Disabled"}`,
    );
    lines.push(
      `  Character Normalization: ${weights.optimizations.characterNormalization ? "Enabled" : "Disabled"}`,
    );
    lines.push("");

    if (verbose) {
      lines.push("🤖 **Model Configuration:**");
      lines.push(`  Embedding Model: ${weights.models.embedding}`);
      lines.push(`  Reranking Model: ${weights.models.reranking}`);
      lines.push(`  Tokenizer: ${weights.models.tokenizer}`);
      lines.push("");

      lines.push("💡 **Optimization Notes:**");
      if (weights.language === "ja") {
        lines.push("  • Higher BM25 weight for better kanji/hiragana matching");
        lines.push("  • MeCab tokenization for proper word segmentation");
        lines.push("  • Character normalization for variant forms");
      } else if (weights.language === "zh") {
        lines.push("  • Jieba tokenization for Chinese word segmentation");
        lines.push("  • Character normalization for traditional/simplified");
      } else if (weights.language === "en") {
        lines.push("  • Balanced weights for optimal English performance");
        lines.push("  • Porter stemming for morphological variations");
      }
    }

    return lines.join("\n");
  }

  /**
   * Format supported languages
   */
  private formatSupportedLanguages(
    format: string,
    options: Record<string, any>,
  ): string {
    if (format === "json") {
      return JSON.stringify(this.SUPPORTED_LANGUAGES, null, 2);
    }

    if (format === "csv") {
      const headers = [
        "Code",
        "Name",
        "Native Name",
        "Status",
        "Detection",
        "Tokenization",
        "Embedding",
      ];
      const rows = this.SUPPORTED_LANGUAGES.map((lang) => [
        lang.code,
        lang.name,
        lang.nativeName,
        lang.status,
        lang.capabilities.detection ? "Yes" : "No",
        lang.capabilities.tokenization ? "Yes" : "No",
        lang.capabilities.embedding ? "Yes" : "No",
      ]);
      return [headers.join(","), ...rows.map((row) => row.join(","))].join(
        "\n",
      );
    }

    // Table format (default)
    const lines: string[] = [];
    const verbose = options["verbose"] || false;

    lines.push("");
    lines.push("🌍 SUPPORTED LANGUAGES");
    lines.push("═".repeat(60));
    lines.push("");
    lines.push(
      `Total: ${this.SUPPORTED_LANGUAGES.length} languages fully supported`,
    );
    lines.push("");

    for (const lang of this.SUPPORTED_LANGUAGES) {
      const statusIcon = lang.status === "fully-supported" ? "✅" : "🧪";
      lines.push(
        `${statusIcon} **${lang.name}** (${lang.nativeName}) - \`${lang.code}\``,
      );
      lines.push(`   Status: ${lang.status.replace("-", " ").toUpperCase()}`);

      if (verbose) {
        const capabilities = Object.entries(lang.capabilities)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(", ");
        lines.push(`   Capabilities: ${capabilities}`);
        lines.push(`   Models: ${lang.models.slice(0, 2).join(", ")}`);
        lines.push(`   Last Updated: ${lang.lastUpdated}`);
      }

      lines.push("");
    }

    lines.push("💡 **Usage Examples:**");
    lines.push('  `/language detect "Hello world"` - Detect English');
    lines.push('  `/language detect "こんにちは"` - Detect Japanese');
    lines.push("  `/language weights --lang ja` - Get Japanese weights");
    lines.push(
      "  `/language optimize --lang zh` - Get Chinese optimization tips",
    );

    return lines.join("\n");
  }

  /**
   * Format optimization suggestions
   */
  private formatOptimizationSuggestions(optimization: any): string {
    const lines: string[] = [];
    const lang = optimization.language;

    lines.push("");
    lines.push(`⚡ OPTIMIZATION SUGGESTIONS - ${lang.name}`);
    lines.push("═".repeat(50));
    lines.push("");

    lines.push(
      `**Language:** ${lang.name} (${lang.nativeName}) - ${lang.code}`,
    );
    lines.push(`**Status:** ${lang.status.replace("-", " ").toUpperCase()}`);
    lines.push("");

    lines.push("🎯 **Optimization Recommendations:**");
    lines.push("");

    for (const suggestion of optimization.suggestions) {
      lines.push(`**${suggestion.category}** (${suggestion.impact} Impact)`);
      lines.push(`  📋 ${suggestion.recommendation}`);
      lines.push(`  🛠️ Implementation: ${suggestion.implementation}`);
      lines.push("");
    }

    lines.push("📊 **Current Capabilities:**");
    const capabilities = Object.entries(lang.capabilities)
      .map(([key, value]) => `${key}: ${value ? "✅" : "❌"}`)
      .join("  |  ");
    lines.push(`  ${capabilities}`);
    lines.push("");

    lines.push("🤖 **Recommended Models:**");
    for (const model of lang.models.slice(0, 3)) {
      lines.push(`  • ${model}`);
    }

    return lines.join("\n");
  }

  /**
   * Command validation
   */
  override async validate(
    args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    const { parsed, options } = args;
    const positional = (parsed["positional"] as string[]) || [];
    const subcommand = positional[0];

    if (
      subcommand &&
      !["detect", "weights", "supported", "optimize"].includes(
        subcommand.toLowerCase(),
      )
    ) {
      return {
        success: false,
        error:
          "Invalid subcommand. Available: detect, weights, supported, optimize",
      };
    }

    // Validate language code if provided
    const langCode = options["lang"] || options["language"];
    if (langCode && !this.isLanguageSupported(langCode)) {
      return {
        success: false,
        error: `Unsupported language: ${langCode}. Supported: ${this.SUPPORTED_LANGUAGES.map((l) => l.code).join(", ")}`,
      };
    }

    // Validate format
    const format = options["format"];
    if (format && !["table", "json", "csv"].includes(format)) {
      return {
        success: false,
        error: "Invalid format. Available: table, json, csv",
      };
    }

    return { success: true };
  }
}

// Command metadata for manifest generation
export const meta = {
  name: 'language',
  category: 'multilingual',
  description: '🌍 Language detection, weights configuration, and multilingual processing',
  aliases: ['lang', 'detect', 'ml'],
  usage: '[detect|weights|supported|optimize] [<text>] [--lang <code>] [--verbose] [--format <format>]',
  examples: [
    '/language detect "Hello world"',
    '/language detect "こんにちは世界"', 
    '/language weights --lang ja',
    '/language supported --format table'
  ],
  deps: [],
  status: 'stable' as const
};

// Export both as default and named export for flexibility
export default LanguageCommand;
