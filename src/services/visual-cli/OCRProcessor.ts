/**
 * OCR Processor - Handles image text extraction and analysis using Tesseract.js
 */
import Tesseract, { Worker } from "tesseract.js";
import chalk from "chalk";
import { DroppedFile } from "./FileDropHandler";

export interface OCRResult {
  text: string;
  confidence: number;
  words: OCRWord[];
  summary: string;
  language: string;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface OCRConfig {
  languages: string[];
  engineMode: number;
  pageSegMode: number;
  enableProgress: boolean;
}

export class OCRProcessor {
  private worker: Worker | null = null;
  private config: OCRConfig;
  private isInitialized: boolean = false;

  constructor(_config: Partial<OCRConfig> = {}) {
    this._config = {
      languages: ["eng"],
      engineMode: 1, // OEM_LSTM_ONLY
      pageSegMode: 6, // PSM_UNIFORM_BLOCK
      enableProgress: true,
      ..._config,
    };
  }

  /**
   * Initialize Tesseract worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log(chalk.cyan("🔄 Initializing OCR processor..."));

      this.worker = await Tesseract.createWorker(this.config.languages, 1, {
        logger: this.config.enableProgress
          ? (m) => {
              if (m.status === "recognizing text") {
                process.stdout.write(
                  `\r${chalk.gray(`OCR Progress: ${Math.round(m.progress * 100)}%`)}`,
                );
              }
            }
          : undefined,
      });

      await this.worker.setParameters({
        tesseditocr_engine_mode: this.config.engineMode,
        tesseditpageseg_mode: this.config.pageSegMode,
      });

      this.isInitialized = true;
      console.log(chalk.green("✅ OCR processor initialized"));
    } catch (_error) {
      console.log(
        chalk.red(
          `❌ Failed to initialize OCR: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        ),
      );
      throw _error;
    }
  }

  /**
   * Process image and extract text using OCR
   */
  async processImage(file: DroppedFile): Promise<OCRResult | null> {
    if (!this.isInitialized || !this.worker) {
      await this.initialize();
    }

    if (!file.imageBuffer || !file.isImage) {
      console.log(chalk.red("❌ Invalid image file for OCR processing"));
      return null;
    }

    try {
      console.log(chalk.cyan(`🔍 Extracting text from ${file.name}...`));

      const { data } = await this.worker!.recognize(file.imageBuffer);

      // Clear progress line
      if (this.config.enableProgress) {
        process.stdout.write("\r" + " ".repeat(50) + "\r");
      }

      const _result: OCRResult = {
        text: data.text.trim(),
        confidence: data.confidence,
        words: data.words.map((word) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox,
        })),
        summary: this.generateTextSummary(data.text),
        language: this.detectLanguage(data.text),
      };

      if (_result.text.length > 0) {
        console.log(
          chalk.green(
            `✅ OCR completed: ${_result.text.length} characters extracted (${_result.confidence.toFixed(1)}% confidence)`,
          ),
        );
        console.log(
          chalk.gray(
            `Preview: ${_result.text.substring(0, 100)}${_result.text.length > 100 ? "..." : ""}`,
          ),
        );
      } else {
        console.log(chalk.yellow("⚠️ No text found in image"));
      }

      return _result;
    } catch (_error) {
      console.log(
        chalk.red(
          `❌ OCR processing failed: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        ),
      );
      return null;
    }
  }

  /**
   * Process multiple images
   */
  async processMultipleImages(
    files: DroppedFile[],
  ): Promise<Map<string, OCRResult>> {
    const _results = new Map<string, OCRResult>();

    for (const file of files) {
      if (file.isImage) {
        const _result = await this.processImage(file);
        if (_result) {
          results.set(file.id, _result);
        }
      }
    }

    return _results;
  }

  /**
   * Generate a summary of extracted text
   */
  private generateTextSummary(text: string): string {
    if (text.length === 0) {
      return "No text found";
    }

    const _sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const _wordCount = text.split(/\s+/).length;

    let summary = `Text contains ${_wordCount} words`;

    if (_sentences.length > 0) {
      summary += ` in ${_sentences.length} sentence${_sentences.length !== 1 ? "s" : ""}`;
    }

    // Try to identify content type
    const _contentType = this.identifyContentType(text);
    if (_contentType) {
      summary += `. Content appears to be: ${_contentType}`;
    }

    return summary;
  }

  /**
   * Detect the primary language of the text
   */
  private detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    const _hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    const _hasChinese = /[\u4E00-\u9FAF]/.test(text);
    const _hasKorean = /[\uAC00-\uD7AF]/.test(text);
    const _hasArabic = /[\u0600-\u06FF]/.test(text);
    const _hasCyrillic = /[\u0400-\u04FF]/.test(text);

    if (_hasJapanese) return "Japanese";
    if (_hasChinese) return "Chinese";
    if (_hasKorean) return "Korean";
    if (_hasArabic) return "Arabic";
    if (_hasCyrillic) return "Russian/Cyrillic";

    return "English";
  }

  /**
   * Identify content type based on text patterns
   */
  private identifyContentType(text: string): string | null {
    const _lowerText = text.toLowerCase();

    // Code patterns
    if (
      /(function|class|import|export|const|let|var|if|else|for|while)/.test(
        _lowerText,
      )
    ) {
      return "Code";
    }

    // Email patterns
    if (/(from:|to:|subject:|dear|sincerely|best regards)/.test(_lowerText)) {
      return "Email/Letter";
    }

    // Document patterns
    if (
      /(chapter|section|figure|table|references|abstract|introduction)/.test(
        _lowerText,
      )
    ) {
      return "Document/Article";
    }

    // Menu/List patterns
    if (/(menu|price|order|_item|available|\$\d+)/.test(_lowerText)) {
      return "Menu/Price List";
    }

    // Form patterns
    if (/(name:|address:|phone:|email:|date:|signature)/.test(_lowerText)) {
      return "Form";
    }

    return null;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
        console.log(chalk.gray("OCR processor cleaned up"));
      } catch (_error) {
        console.log(chalk.yellow("Warning: OCR cleanup failed"));
      }
      this.worker = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if OCR is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return [
      "eng",
      "jpn",
      "chi_sim",
      "chi_tra",
      "kor",
      "ara",
      "rus",
      "fra",
      "ger",
      "spa",
      "ita",
      "por",
      "dut",
      "dan",
      "fin",
      "nor",
      "swe",
      "pol",
      "cze",
      "hun",
    ];
  }

  /**
   * Add language support
   */
  async addLanguage(language: string): Promise<void> {
    if (!this.config.languages.includes(language)) {
      this.config.languages.push(language);
      // Reinitialize worker with new languages
      if (this.isInitialized) {
        await this.cleanup();
        await this.initialize();
      }
    }
  }

  /**
   * Get confidence _threshold for reliable text
   */
  getConfidenceThreshold(): number {
    return 60; // 60% confidence _threshold
  }

  /**
   * Filter words by confidence
   */
  getHighConfidenceWords(_result: OCRResult): OCRWord[] {
    const _threshold = this.getConfidenceThreshold();
    return _result.words.filter((word) => word.confidence >= _threshold);
  }
}
