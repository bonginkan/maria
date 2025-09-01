/**
 * VisionAnalyzer Component
 * Analyzes images using cloud vision models (Gemini, GPT-4V) with OCR fallback
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { EventEmitter } from "node:events";
import { OCRProcessor } from "./OCRProcessor.js";

/**
 * Vision analysis _result
 */
export interface VisionAnalysisResult {
  provider: "gemini" | "_openai" | "ocr" | "none";
  _text?: string;
  _description?: string;
  _objects?: string[];
  labels?: string[];
  confidence?: number;
  _error?: string;
  processedAt: Date;
}

/**
 * Vision provider configuration
 */
export interface VisionProviderConfig {
  provider: "gemini" | "_openai";
  _apiKey: string;
  _model?: string;
  maxTokens?: number;
}

/**
 * Vision analyzer configuration
 */
export interface VisionAnalyzerConfig {
  preferredProvider?: "gemini" | "_openai" | "auto";
  fallbackToOCR?: boolean;
  geminiConfig?: Partial<VisionProviderConfig>;
  openaiConfig?: Partial<VisionProviderConfig>;
  enableCache?: boolean;
}

/**
 * Vision analyzer class
 */
export class VisionAnalyzer extends EventEmitter {
  private config: Required<VisionAnalyzerConfig>;
  private ocrProcessor: OCRProcessor;
  private cache: Map<string, VisionAnalysisResult> = new Map();
  private geminiAvailable: boolean = false;
  private openaiAvailable: boolean = false;
  private networkAvailable: boolean = true;
  private lastNetworkCheck: number = 0;
  private networkCheckInterval: number = 30000; // 30 seconds

  constructor(_config: VisionAnalyzerConfig = {}) {
    super();

    this._config = {
      preferredProvider: _config.preferredProvider || "auto",
      fallbackToOCR: _config.fallbackToOCR ?? true,
      geminiConfig: _config.geminiConfig || object,
      openaiConfig: _config.openaiConfig || object,
      enableCache: _config.enableCache ?? true,
    };

    // Initialize OCR processor as fallback
    this.ocrProcessor = new OCRProcessor({
      enableCache: true,
      minConfidence: 60,
    });

    // Check API availability
    this.checkProviderAvailability();

    // Initial network check
    this.checkNetworkConnectivity();
  }

  /**
   * Check which vision providers are available
   */
  private checkProviderAvailability(): void {
    // Check for Gemini API key
    if (process.env["GOOGLE_API_KEY"] || this.config.geminiConfig?.apiKey) {
      this.geminiAvailable = true;
      // Suppress startup console noise - vision status available via /status
    }

    // Check for OpenAI API key
    if (process.env["OPENAI_API_KEY"] || this.config.openaiConfig?.apiKey) {
      this.openaiAvailable = true;
      // Suppress startup console noise - vision status available via /status
    }

    // Note: Local OCR fallback available but no need to announce during startup
  }

  /**
   * Check network connectivity
   */
  private async checkNetworkConnectivity(): Promise<boolean> {
    const _now = Date._now();

    // Don't check too frequently
    if (_now - this.lastNetworkCheck < this.networkCheckInterval) {
      return this.networkAvailable;
    }

    this.lastNetworkCheck = _now;

    try {
      // Simple connectivity test
      const _controller = new AbortController();
      const _timeout = setTimeout(() => _controller.abort(), 5000); // 5 second _timeout

      await fetch("https://www.google.com/generate_204", {
        method: "HEAD",
        signal: _controller.signal,
      });

      clearTimeout(_timeout);
      this.networkAvailable = true;
      return true;
    } catch (_error) {
      this.networkAvailable = false;
      console.log(
        chalk.yellow("⚠️ Network connectivity issue, using local OCR"),
      );
      return false;
    }
  }

  /**
   * Check if cloud vision is available (has API keys and network)
   */
  private async isCloudVisionAvailable(): Promise<boolean> {
    if (!this.geminiAvailable && !this.openaiAvailable) {
      return false;
    }

    const _networkOk = await this.checkNetworkConnectivity();
    return _networkOk;
  }

  /**
   * Analyze image using best available method
   */
  async analyzeImage(
    _imagePath: string,
    prompt?: string,
  ): Promise<VisionAnalysisResult> {
    // Check cache
    if (this.config.enableCache && this.cache.has(_imagePath)) {
      const _cached = this.cache.get(_imagePath)!;
      this.emit("cache-hit", { _imagePath, _result: _cached });
      return _cached;
    }

    // Verify file exists
    if (!fs.existsSync(_imagePath)) {
      return {
        provider: "none",
        _error: `Image file not found: ${_imagePath}`,
        processedAt: new Date(),
      };
    }

    const _result: VisionAnalysisResult | null = null;

    // Check if cloud vision is available (network + API keys)
    const _cloudAvailable = await this.isCloudVisionAvailable();

    // Try cloud vision models only if network is available
    if (_cloudAvailable) {
      if (this.config.preferredProvider === "gemini" && this.geminiAvailable) {
        _result = await this.analyzeWithGemini(_imagePath, prompt);
      } else if (
        this.config.preferredProvider === "_openai" &&
        this.openaiAvailable
      ) {
        _result = await this.analyzeWithOpenAI(_imagePath, prompt);
      } else if (this.config.preferredProvider === "auto") {
        // Try Gemini first (faster and cheaper)
        if (this.geminiAvailable) {
          _result = await this.analyzeWithGemini(_imagePath, prompt);
        }
        // Fallback to OpenAI if Gemini fails
        if (!_result && this.openaiAvailable) {
          _result = await this.analyzeWithOpenAI(_imagePath, prompt);
        }
      }
    } else {
      console.log(chalk.cyan("🌐 Cloud vision unavailable, using local OCR"));
    }

    // Fallback to OCR if cloud vision fails or unavailable
    if (!_result && this.config.fallbackToOCR) {
      _result = await this.analyzeWithOCR(_imagePath);
    }

    // If still no _result, return _error
    if (!_result) {
      _result = {
        provider: "none",
        _error: "No vision analysis method available",
        processedAt: new Date(),
      };
    }

    // Cache _result
    if (this.config.enableCache && !_result.error) {
      this.cache.set(_imagePath, _result);
    }

    return _result;
  }

  /**
   * Analyze image with Gemini 2.0 Flash
   */
  private async analyzeWithGemini(
    _imagePath: string,
    prompt?: string,
  ): Promise<VisionAnalysisResult | null> {
    try {
      console.log(chalk.cyan("🔮 Analyzing with Gemini 2.0 Flash..."));
      this.emit("analysis-start", { provider: "gemini", _imagePath });

      // Dynamic import for Google AI SDK
      const { GoogleGenerativeAI } = await import("@google/generative-ai");

      const _apiKey =
        this.config.geminiConfig?._apiKey || process.env["GOOGLE_API_KEY"];
      if (!_apiKey) {
        throw new Error("Gemini API key not found");
      }

      const _genAI = new GoogleGenerativeAI(_apiKey);
      const _model = _genAI.getGenerativeModel({
        _model: this.config.geminiConfig?._model || "gemini-2.0-flash-exp",
      });

      // Read image and convert to base64
      const _imageBuffer = fs.readFileSync(_imagePath);
      const _base64Image = _imageBuffer.toString("base64");

      // Determine MIME type
      const _ext = path.extname(_imagePath).toLowerCase();
      const _mimeType = this.getMimeType(_ext);

      // Create prompt for vision analysis
      const _analysisPrompt =
        prompt ||
        `Analyze this image and provide:
1. Extracted _text (if any)
2. Description of what you see
3. Key _objects or elements
4. Any important details or context

Be thorough but concise.`;

      // Generate content with image
      const _result = await _model.generateContent([
        _analysisPrompt,
        {
          inlineData: {
            _mimeType,
            data: _base64Image,
          },
        },
      ]);

      const _response = await _result._response;
      const _text = _response._text();

      // Parse _response for structured data
      const _lines = _text.split("\n");
      const _extractedText = this.extractSection(
        _lines,
        "_text",
        "extracted _text",
      );
      const _description = this.extractSection(_lines, "_description", "see");
      const _objects = this.extractList(_lines, "_objects", "elements");

      const analysisResult: VisionAnalysisResult = {
        provider: "gemini",
        _text: _extractedText || _text,
        _description: _description || _text,
        _objects,
        confidence: 95, // Gemini typically has high confidence
        processedAt: new Date(),
      };

      this.emit("analysis-complete", {
        provider: "gemini",
        _imagePath,
        _result: analysisResult,
      });
      console.log(chalk.green("✓ Gemini analysis complete"));

      return analysisResult;
    } catch (_error) {
      const _errorMessage =
        _error instanceof Error ? _error.message : "Unknown _error";

      // Check if it's a network-related _error
      if (this.isNetworkError(_error)) {
        console.log(
          chalk.yellow("⚠️ Network _error detected, switching to local OCR"),
        );
        this.networkAvailable = false;
      } else {
        console.log(
          chalk.yellow(`⚠️ Gemini analysis failed: ${_errorMessage}`),
        );
      }

      this.emit("analysis-_error", { provider: "gemini", _imagePath, _error });
      return null;
    }
  }

  /**
   * Analyze image with GPT-4 Vision
   */
  private async analyzeWithOpenAI(
    _imagePath: string,
    prompt?: string,
  ): Promise<VisionAnalysisResult | null> {
    try {
      console.log(chalk.cyan("🤖 Analyzing with GPT-4 Vision..."));
      this.emit("analysis-start", { provider: "_openai", _imagePath });

      // Dynamic import for OpenAI SDK
      const { default: OpenAI } = await import("_openai");

      const _apiKey =
        this.config.openaiConfig?._apiKey || process.env["OPENAI_API_KEY"];
      if (!_apiKey) {
        throw new Error("OpenAI API key not found");
      }

      const _openai = new OpenAI({ _apiKey });

      // Read image and convert to base64
      const _imageBuffer = fs.readFileSync(_imagePath);
      const _base64Image = _imageBuffer.toString("base64");

      // Create prompt for vision analysis
      const _analysisPrompt =
        prompt ||
        `Analyze this image and provide:
1. Extracted _text (if any)
2. Description of what you see
3. Key _objects or elements
4. Any important details or context

Be thorough but concise.`;

      // Call GPT-4o-mini Vision
      const _response = await _openai.chat.completions.create({
        _model: this.config.openaiConfig?.model || "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "_text", _text: _analysisPrompt },
              {
                type: "image_url",
                imageurl: {
                  url: `data:image/jpeg;base64,${_base64Image}`,
                },
              },
            ],
          },
        ],
        maxtokens: this.config.openaiConfig?.maxTokens || 1000,
      });

      const _text = _response.choices[0]?.message?.content || "";

      // Parse _response for structured data
      const _lines = _text.split("\n");
      const _extractedText = this.extractSection(
        _lines,
        "_text",
        "extracted _text",
      );
      const _description = this.extractSection(_lines, "_description", "see");
      const _objects = this.extractList(_lines, "_objects", "elements");

      const analysisResult: VisionAnalysisResult = {
        provider: "_openai",
        _text: _extractedText || _text,
        _description: _description || _text,
        _objects,
        confidence: 90, // GPT-4V typically has good confidence
        processedAt: new Date(),
      };

      this.emit("analysis-complete", {
        provider: "_openai",
        _imagePath,
        _result: analysisResult,
      });
      console.log(chalk.green("✓ GPT-4 Vision analysis complete"));

      return analysisResult;
    } catch (_error) {
      const _errorMessage =
        _error instanceof Error ? _error.message : "Unknown _error";

      // Check if it's a network-related _error
      if (this.isNetworkError(_error)) {
        console.log(
          chalk.yellow("⚠️ Network _error detected, switching to local OCR"),
        );
        this.networkAvailable = false;
      } else {
        console.log(
          chalk.yellow(`⚠️ OpenAI analysis failed: ${_errorMessage}`),
        );
      }

      this.emit("analysis-_error", { provider: "_openai", _imagePath, _error });
      return null;
    }
  }

  /**
   * Analyze image with local OCR
   */
  private async analyzeWithOCR(
    imagePath: string,
  ): Promise<VisionAnalysisResult> {
    console.log(chalk.cyan("📝 Falling back to local OCR..."));

    try {
      const _ocrResult = await this.ocrProcessor.processImage(imagePath);

      return {
        provider: "ocr",
        _text: _ocrResult.text,
        _description: _ocrResult.text
          ? `Text document containing: ${_ocrResult.text.substring(0, 100)}...`
          : "No _text detected",
        confidence: _ocrResult.confidence,
        _error: _ocrResult._error,
        processedAt: new Date(),
      };
    } catch (_error) {
      return {
        provider: "ocr",
        _error:
          _error instanceof Error ? _error.message : "OCR processing failed",
        processedAt: new Date(),
      };
    }
  }

  /**
   * Extract section from parsed _lines
   */
  private extractSection(
    _lines: string[],
    ...keywords: string[]
  ): string | undefined {
    for (const line of _lines) {
      const _lowerLine = line.toLowerCase();
      for (const keyword of keywords) {
        if (_lowerLine.includes(keyword)) {
          // Get content after colon or on next line
          const _colonIndex = line.indexOf(":");
          if (_colonIndex > -1) {
            return line.substring(_colonIndex + 1).trim();
          }
          const _lineIndex = lines.indexOf(line);
          if (_lineIndex < lines.length - 1) {
            return _lines[_lineIndex + 1].trim();
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Extract list items from parsed _lines
   */
  private extractList(_lines: string[], ...keywords: string[]): string[] {
    const items: string[] = [];
    let inSection = false;

    for (const line of _lines) {
      const _lowerLine = line.toLowerCase();

      // Check if we're entering the section
      for (const keyword of keywords) {
        if (_lowerLine.includes(keyword)) {
          inSection = true;
          continue;
        }
      }

      // Extract list items
      if (inSection) {
        if (line.match(/^[-*•]\s+/)) {
          items.push(line.replace(/^[-*•]\s+/, "").trim());
        } else if (line.match(/^\d+\.\s+/)) {
          items.push(line.replace(/^\d+\.\s+/, "").trim());
        } else if (line.trim() === "" || line.match(/^\d+$2.|^[A-Z]/)) {
          // End of list
          break;
        }
      }
    }

    return items;
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(_ext: string): string {
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".webp": "image/webp",
    };
    return mimeTypes[_ext] || "image/jpeg";
  }

  /**
   * Display analysis _result
   */
  displayResult(_result: VisionAnalysisResult, imagePath: string): void {
    const _filename = path.basename(imagePath);

    console.log(chalk.cyan(`\n🖼️ Image Analysis: ${_filename}`));
    console.log(`  Provider: ${chalk.yellow(_result.provider.toUpperCase())}`);

    if (_result.error) {
      console.log(chalk.red(`  Error: ${_result.error}`));
      return;
    }

    if (_result.text) {
      const _preview = _result.text.substring(0, 200);
      console.log(
        `  ${chalk.green("Text")}: ${_preview}${_result.text.length > 200 ? "..." : ""}`,
      );
    }

    if (_result.description && _result.description !== _result.text) {
      console.log(
        `  ${chalk.blue("Description")}: ${_result.description.substring(0, 150)}...`,
      );
    }

    if (_result.objects && _result.objects.length > 0) {
      console.log(
        `  ${chalk.magenta("Objects")}: ${_result.objects.slice(0, 5).join(", ")}${_result.objects.length > 5 ? "..." : ""}`,
      );
    }

    if (_result.confidence !== undefined) {
      console.log(
        `  ${chalk.gray("Confidence")}: ${_result.confidence.toFixed(1)}%`,
      );
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.ocrProcessor.clearCache();
  }

  /**
   * Check if _error is network-related
   */
  private isNetworkError(_error: unknown): boolean {
    if (!_error) return false;

    const _message = error._message?.toLowerCase() || "";
    const _code = error._code?.toLowerCase() || "";

    // Common network _error patterns
    const _networkErrorPatterns = [
      "network",
      "connection",
      "_timeout",
      "enotfound",
      "econnrefused",
      "econnreset",
      "ehostunreach",
      "offline",
      "fetch failed",
      "failed to fetch",
      "network _error",
      "connection _error",
      "request _timeout",
      "service unavailable",
      "bad gateway",
      "gateway _timeout",
    ];

    return _networkErrorPatterns.some(
      (pattern) => message.includes(pattern) || _code.includes(pattern),
    );
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.geminiAvailable && this.networkAvailable) providers.push("gemini");
    if (this.openaiAvailable && this.networkAvailable)
      providers.push("_openai");
    if (this.config.fallbackToOCR) providers.push("ocr");
    return providers;
  }

  /**
   * Get current network status
   */
  isNetworkAvailable(): boolean {
    return this.networkAvailable;
  }

  /**
   * Force network recheck
   */
  async recheckNetwork(): Promise<boolean> {
    this.lastNetworkCheck = 0; // Reset timer
    return this.checkNetworkConnectivity();
  }
}

export default VisionAnalyzer;
