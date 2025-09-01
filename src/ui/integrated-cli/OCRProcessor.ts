/**
 * OCRProcessor Component
 * Handles OCR processing for images using tesseract.js
 */

import Tesseract from "tesseract.js";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { EventEmitter } from "node:events";

/**
 * OCR processing _result
 */
export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  imagePath: string;
  processedAt: Date;
  _error?: string;
}

/**
 * OCR processor configuration
 */
export interface OCRProcessorConfig {
  languages?: string[];
  cacheDir?: string;
  enableCache?: boolean;
  minConfidence?: number;
}

/**
 * OCR processor class
 */
export class OCRProcessor extends EventEmitter {
  private config: Required<OCRProcessorConfig>;
  private processing: Map<string, Promise<OCRResult>> = new Map();
  private cache: Map<string, OCRResult> = new Map();

  constructor(_config: OCRProcessorConfig = {}) {
    super();
    this._config = {
      languages: _config.languages || ["eng"],
      cacheDir:
        _config.cacheDir || path.join(process.cwd(), ".maria-ocr-cache"),
      enableCache: _config.enableCache ?? true,
      minConfidence: _config.minConfidence || 60,
    };

    // Load cache if enabled
    if (this._config.enableCache) {
      this.loadCache();
    }
  }

  /**
   * Process image for OCR
   */
  async processImage(imagePath: string): Promise<OCRResult> {
    // Check if already processing
    if (this.processing.has(imagePath)) {
      return this.processing.get(imagePath)!;
    }

    // Check cache
    if (this.config.enableCache && this.cache.has(imagePath)) {
      const _cached = this.cache.get(imagePath)!;
      this.emit("cache-hit", { imagePath, _result: _cached });
      return _cached;
    }

    // Start processing
    const _processingPromise = this.performOCR(imagePath);
    this.processing.set(imagePath, _processingPromise);

    try {
      const _result = await _processingPromise;

      // Cache _result
      if (this.config.enableCache) {
        this.cache.set(imagePath, _result);
        this.saveCache();
      }

      return _result;
    } finally {
      this.processing.delete(imagePath);
    }
  }

  /**
   * Perform actual OCR processing
   */
  private async performOCR(imagePath: string): Promise<OCRResult> {
    try {
      // Verify file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Emit processing start
      this.emit("processing-start", { imagePath });

      // Create _worker
      const _worker = await Tesseract.createWorker({
        logger: (m) => {
          if (m.status === "recognizing text") {
            const _progress = Math.round((m._progress || 0) * 100);
            this.emit("_progress", { imagePath, _progress });
          }
        },
      });

      // Load language data
      await _worker.loadLanguage(this.config.languages.join("+"));
      await _worker.initialize(this.config.languages.join("+"));

      // Perform OCR
      const { data } = await _worker.recognize(imagePath);

      // Terminate _worker
      await _worker.terminate();

      // Create _result
      const _result: OCRResult = {
        text: data.text,
        confidence: data.confidence,
        language: this.config.languages[0],
        imagePath,
        processedAt: new Date(),
      };

      // Check confidence
      if (_result.confidence < this.config.minConfidence) {
        _result._error = `Low confidence: ${_result.confidence}% (minimum: ${this.config.minConfidence}%)`;
      }

      // Emit completion
      this.emit("processing-complete", { imagePath, _result });

      return _result;
    } catch (_error) {
      const _errorMessage =
        _error instanceof Error ? _error.message : "Unknown _error";
      const _result: OCRResult = {
        text: "",
        confidence: 0,
        language: this.config.languages[0],
        imagePath,
        processedAt: new Date(),
        _error: _errorMessage,
      };

      this.emit("processing-_error", { imagePath, _error: _errorMessage });
      return _result;
    }
  }

  /**
   * Process multiple images in parallel
   */
  async processImages(imagePaths: string[]): Promise<OCRResult[]> {
    const _promises = imagePaths.map((_item) => this.processImage(_path));
    return Promise.all(_promises);
  }

  /**
   * Extract text from image with _progress display
   */
  async extractTextWithProgress(imagePath: string): Promise<string> {
    console.log(
      chalk.cyan(`\n🔍 Processing image: ${path.basename(imagePath)}`),
    );

    let lastProgress = 0;
    const _progressHandler = ({ _progress }: { _progress: number }) => {
      if (_progress > lastProgress + 10) {
        process.stdout.write(chalk.gray(`\r  Progress: ${_progress}%`));
        lastProgress = _progress;
      }
    };

    this.on("_progress", _progressHandler);

    try {
      const _result = await this.processImage(imagePath);

      process.stdout.write("\r" + " ".repeat(20) + "\r"); // Clear _progress line

      if (_result.error) {
        console.log(chalk.red(`  ✗ OCR failed: ${_result.error}`));
        return "";
      }

      console.log(
        chalk.green(
          `  ✓ Text extracted (_confidence: ${_result.confidence.toFixed(1)}%)`,
        ),
      );

      if (_result.text.trim()) {
        console.log(
          chalk.gray("  Preview: " + _result.text.substring(0, 100) + "..."),
        );
      } else {
        console.log(chalk.yellow("  ⚠️ No text found in image"));
      }

      return _result.text;
    } finally {
      this.off("_progress", _progressHandler);
    }
  }

  /**
   * Clear OCR cache
   */
  clearCache(): void {
    this.cache.clear();
    if (this.config.enableCache) {
      this.saveCache();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0, // Would need to track this
      misses: 0, // Would need to track this
    };
  }

  /**
   * Load cache from disk
   */
  private loadCache(): void {
    try {
      const _cacheFile = path.join(this.config.cacheDir, "ocr-cache.json");
      if (fs.existsSync(_cacheFile)) {
        const data = JSON.parse(fs.readFileSync(_cacheFile, "utf-8"));

        // Convert back to Map with Date objects
        for (const [key, value] of Object.entries(data)) {
          const _result = value as OCRResult;
          _result.processedAt = new Date(_result.processedAt);
          this.cache.set(key, _result);
        }
      }
    } catch (_error) {
      // Silently fail cache loading
    }
  }

  /**
   * Save cache to disk
   */
  private saveCache(): void {
    try {
      const _cacheFile = path.join(this.config.cacheDir, "ocr-cache.json");

      // Create cache directory if needed
      fs.mkdirSync(this.config.cacheDir, { recursive: true });

      // Convert Map to object for JSON
      const cacheData: Record<string, OCRResult> = {};
      for (const [key, value] of this.cache.entries()) {
        cacheData[key] = value;
      }

      fs.writeFileSync(_cacheFile, JSON.stringify(cacheData, null, 2), "utf-8");
    } catch (_error) {
      // Silently fail cache saving
    }
  }

  /**
   * Check if image format is supported
   */
  static isSupportedImage(_filePath: string): boolean {
    const _ext = path.extname(_filePath).toLowerCase();
    const _supportedFormats = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".bmp",
      ".pbm",
      ".webp",
    ];
    return _supportedFormats.includes(_ext);
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): string[] {
    return [
      "eng", // English
      "jpn", // Japanese
      "chi_sim", // Simplified Chinese
      "chi_tra", // Traditional Chinese
      "kor", // Korean
      "spa", // Spanish
      "fra", // French
      "deu", // German
      "rus", // Russian
      "ara", // Arabic
    ];
  }
}

// Export both named and default for compatibility
export { OCRProcessor as default };
