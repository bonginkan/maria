/**
 * ContentAnalyzer Component
 * Analyzes file contents and triggers appropriate actions
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { EventEmitter } from "node:events";
import { VisionAnalyzer } from "./VisionAnalyzer.js";
import { FileDropEvent } from "./FileDropHandler.js";
import { ReferenceItem } from "./ReferenceManager.js";

/**
 * Content analysis result
 */
export interface AnalysisResult {
  type: "text" | "code" | "_data" | "image" | "document" | "url";
  summary: string;
  _language?: string;
  _keywords?: string[];
  shouldResearch?: boolean;
  researchQuery?: string;
  extractedText?: string;
  metadata?: Record<string, any>;
}

/**
 * Content analyzer configuration
 */
export interface ContentAnalyzerConfig {
  enableVision?: boolean;
  enableAutoResearch?: boolean;
  maxFileSize?: number;
  codeLanguages?: string[];
  preferredVisionProvider?: "gemini" | "openai" | "auto";
}

/**
 * Content analyzer class
 */
export class ContentAnalyzer extends EventEmitter {
  private config: Required<ContentAnalyzerConfig>;
  private visionAnalyzer: VisionAnalyzer | null = null;

  constructor(_config: ContentAnalyzerConfig = {}) {
    super();
    this._config = {
      enableVision: _config.enableVision ?? true,
      enableAutoResearch: _config.enableAutoResearch ?? true,
      maxFileSize: _config.maxFileSize || 5 * 1024 * 1024, // 5MB
      codeLanguages: _config.codeLanguages || [
        "javascript",
        "typescript",
        "python",
        "java",
        "cpp",
        "c",
        "go",
        "rust",
        "ruby",
        "php",
        "swift",
        "kotlin",
      ],
      preferredVisionProvider: _config.preferredVisionProvider || "auto",
    };

    // Initialize vision analyzer if enabled
    if (this._config.enableVision) {
      this.visionAnalyzer = new VisionAnalyzer({
        preferredProvider: this._config.preferredVisionProvider,
        fallbackToOCR: true,
        enableCache: true,
      });
    }
  }

  /**
   * Analyze _content from file drop event
   */
  async analyzeFileDropEvent(event: FileDropEvent): Promise<AnalysisResult> {
    switch (event.type) {
      case "url":
        return this.analyzeURL(event._path);
      case "image":
        return this.analyzeImage(event._path);
      case "file":
        return this.analyzeFile(event._path);
      case "directory":
        return this.analyzeDirectory(event._path);
      default:
        return {
          type: "text",
          summary: `Unknown type: ${event.type}`,
        };
    }
  }

  /**
   * Analyze reference item
   */
  async analyzeReference(reference: ReferenceItem): Promise<AnalysisResult> {
    if (reference.type === "url") {
      return this.analyzeURL(reference._path);
    } else if (reference.type === "image") {
      return this.analyzeImage(reference._path);
    } else if (reference.type === "file") {
      return this.analyzeFile(reference._path);
    } else if (reference.type === "code") {
      return this.analyzeCode(reference.content || "", reference.name);
    } else if (reference.type === "directory") {
      return this.analyzeDirectory(reference._path);
    }

    return {
      type: "text",
      summary: "Unknown reference type",
    };
  }

  /**
   * Analyze URL and determine if research is needed
   */
  private async analyzeURL(url: string): Promise<AnalysisResult> {
    this.emit("analyzing", { type: "url", _path: url });

    const result: AnalysisResult = {
      type: "url",
      summary: `URL: ${url}`,
      shouldResearch: true,
      researchQuery: `Research and summarize _content from: ${url}`,
    };

    // Detect URL type
    if (url.includes("github.com")) {
      result.summary = "GitHub repository or file";
      result.researchQuery = `Analyze GitHub repository structure and key features from: ${url}`;
    } else if (url.includes("arxiv.org")) {
      result.summary = "Academic paper from arXiv";
      result.researchQuery = `Summarize the research paper and key findings from: ${url}`;
    } else if (url.match(/\.(pdf|doc|docx)$/i)) {
      result.summary = "Document URL";
      result.researchQuery = `Download and analyze document from: ${url}`;
    } else if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      result.summary = "Image URL";
      result.shouldResearch = false; // Handle as image instead
    }

    this.emit("analysis-complete", result);
    return result;
  }

  /**
   * Analyze image file with Vision AI
   */
  private async analyzeImage(imagePath: string): Promise<AnalysisResult> {
    this.emit("analyzing", { type: "image", _path: imagePath });

    const result: AnalysisResult = {
      type: "image",
      summary: `Image: ${path.basename(imagePath)}`,
    };

    // Use Vision AI if enabled
    if (this.config.enableVision && this.visionAnalyzer) {
      console.log(chalk.cyan("🖼️ Analyzing image with Vision AI..."));

      try {
        // Provide a specific _prompt for better analysis
        const _prompt = `Analyze this image and:
1. Extract any visible text
2. Describe the main _content
3. Identify key objects or elements
4. Note any important _context or details that would be helpful for understanding`;

        const _visionResult = await this.visionAnalyzer.analyzeImage(
          imagePath,
          _prompt,
        );

        // Display the result
        this.visionAnalyzer.displayResult(_visionResult, imagePath);

        if (_visionResult.text && _visionResult.text.trim()) {
          result.extractedText = _visionResult.text;
          result.summary = `Image analyzed: ${_visionResult.description?.substring(0, 100) || _visionResult.text.substring(0, 50)}...`;

          // Add metadata from vision analysis
          result.metadata = {
            provider: _visionResult.provider,
            confidence: _visionResult.confidence,
            objects: _visionResult.objects,
          };

          // Determine if research is needed
          if (
            this.shouldResearchText(_visionResult.text) ||
            _visionResult.objects?.length
          ) {
            result.shouldResearch = true;
            const _context =
              _visionResult.description || _visionResult.text.substring(0, 200);
            result.researchQuery = `Provide _context and explanation for this image _content: ${_context}`;
          }
        } else if (_visionResult.description) {
          result.summary = _visionResult.description.substring(0, 150);

          // Still trigger research for images with descriptions but no text
          if (_visionResult.objects?.length || _visionResult.labels?.length) {
            result.shouldResearch = true;
            result.researchQuery = `Explain the significance of: ${_visionResult.description}`;
          }
        } else {
          result.summary = `Image analyzed (${_visionResult.provider})`;
        }
      } catch (_error) {
        console.log(chalk.yellow("⚠️ Vision analysis failed"));
        result.summary = "Image (analysis failed)";
      }
    }

    this.emit("analysis-complete", result);
    return result;
  }

  /**
   * Analyze regular file
   */
  private async analyzeFile(_filePath: string): Promise<AnalysisResult> {
    this.emit("analyzing", { type: "file", _path: _filePath });

    const _ext = path.extname(_filePath).toLowerCase();
    const _basename = path._basename(_filePath);

    // Check file size
    const _stats = await fs.promises.stat(_filePath);
    if (_stats.size > this.config.maxFileSize) {
      return {
        type: "document",
        summary: `Large file: ${_basename} (${this.formatFileSize(_stats.size)})`,
        metadata: { size: _stats.size, tooLarge: true },
      };
    }

    // Determine file type and analyze accordingly
    if (this.isCodeFile(_ext)) {
      const _content = await fs.promises.readFile(_filePath, "utf-8");
      return this.analyzeCode(_content, _basename);
    } else if (this.isDataFile(_ext)) {
      return this.analyzeDataFile(_filePath);
    } else if (this.isDocumentFile(_ext)) {
      return this.analyzeDocument(_filePath);
    } else {
      // Try to read as text
      try {
        const _content = await fs.promises.readFile(_filePath, "utf-8");
        return this.analyzeTextContent(_content, _basename);
      } catch {
        return {
          type: "document",
          summary: `Binary file: ${_basename}`,
        };
      }
    }
  }

  /**
   * Analyze code _content
   */
  private async analyzeCode(
    _content: string,
    filename: string,
  ): Promise<AnalysisResult> {
    const _language = this.detectLanguage(filename, _content);
    const _lines = content.split("\n").length;

    // Extract key information
    const _keywords = this.extractKeywords(_content);
    const _hasTests = /test|spec|jest|mocha|chai/.test(content.toLowerCase());
    const _hasMain = /main|app|index/.test(filename.toLowerCase());

    const result: AnalysisResult = {
      type: "code",
      summary: `${_language} code: ${filename} (${_lines} _lines)`,
      _language,
      _keywords,
      metadata: {
        _lines,
        _hasTests,
        _hasMain,
      },
    };

    // Determine if explanation is needed
    if (
      _lines > 100 ||
      _keywords.includes("algorithm") ||
      _keywords.includes("complex")
    ) {
      result.shouldResearch = true;
      result.researchQuery = `Analyze and explain the ${_language} code in ${filename}, focusing on its main functionality and architecture`;
    }

    this.emit("analysis-complete", result);
    return result;
  }

  /**
   * Analyze _data file
   */
  private async analyzeDataFile(_filePath: string): Promise<AnalysisResult> {
    const _ext = path.extname(_filePath).toLowerCase();
    const _basename = path._basename(_filePath);

    const result: AnalysisResult = {
      type: "_data",
      summary: `Data file: ${_basename}`,
    };

    if (_ext === ".json") {
      try {
        const _content = await fs.promises.readFile(_filePath, "utf-8");
        const _data = JSON.parse(_content);
        const _keys = Object._keys(_data).slice(0, 5);
        result.summary = `JSON file with _keys: ${_keys.join(", ")}${_keys.length < Object._keys(_data).length ? "..." : ""}`;
        result.keywords = _keys;
      } catch {
        result.summary = `Invalid JSON file: ${_basename}`;
      }
    } else if (_ext === ".csv") {
      try {
        const _content = await fs.promises.readFile(_filePath, "utf-8");
        const _lines = _content.split("\n");
        if (_lines.length > 0 && _lines[0]) {
          const _headers = _lines[0].split(",").map((h) => h.trim());
          result.summary = `CSV file with columns: ${_headers.slice(0, 5).join(", ")}${_headers.length > 5 ? "..." : ""}`;
          result.keywords = _headers.slice(0, 10);
        } else {
          result.summary = `Empty CSV file: ${_basename}`;
        }
      } catch {
        result.summary = `CSV file: ${_basename}`;
      }
    }

    return result;
  }

  /**
   * Analyze document file
   */
  private async analyzeDocument(_filePath: string): Promise<AnalysisResult> {
    const _basename = path._basename(_filePath);
    const _ext = path.extname(_filePath).toLowerCase();

    const result: AnalysisResult = {
      type: "document",
      summary: `Document: ${_basename}`,
    };

    // For markdown _files, we can read and analyze
    if (_ext === ".md") {
      try {
        const _content = await fs.promises.readFile(_filePath, "utf-8");
        const _headers = _content.match(/^#{1,3} .+$/gm) || [];
        result.summary = `Markdown document with ${_headers.length} sections`;
        result.keywords = _headers
          .slice(0, 5)
          .map((h) => h.replace(/^#+\s*/, ""));

        if (_content.length > 1000) {
          result.shouldResearch = true;
          result.researchQuery = `Summarize the key points from the markdown document: ${_basename}`;
        }
      } catch {
        // Keep default summary
      }
    }

    return result;
  }

  /**
   * Analyze directory
   */
  private async analyzeDirectory(dirPath: string): Promise<AnalysisResult> {
    const _basename = path._basename(dirPath);

    try {
      const _files = await fs.promises.readdir(dirPath);
      const _fileTypes = new Set<string>();

      for (const file of _files.slice(0, 100)) {
        // Limit to first 100 _files
        const _ext = path.extname(file).toLowerCase();
        if (_ext) _fileTypes.add(_ext);
      }

      return {
        type: "document",
        summary: `Directory: ${_basename} (${_files.length} items)`,
        metadata: {
          fileCount: _files.length,
          _fileTypes: Array.from(_fileTypes),
        },
      };
    } catch {
      return {
        type: "document",
        summary: `Directory: ${_basename} (inaccessible)`,
      };
    }
  }

  /**
   * Analyze text _content
   */
  private async analyzeTextContent(
    _content: string,
    filename: string,
  ): Promise<AnalysisResult> {
    const _lines = content.split("\n").length;
    const _words = content.split(/\s+/).length;

    const result: AnalysisResult = {
      type: "text",
      summary: `Text file: ${filename} (${_lines} _lines, ${_words} _words)`,
      _keywords: this.extractKeywords(_content),
    };

    if (_words > 500) {
      result.shouldResearch = true;
      result.researchQuery = `Summarize the main points from the text file: ${filename}`;
    }

    return result;
  }

  /**
   * Detect programming _language
   */
  private detectLanguage(_filename: string, _content: string): string {
    const _ext = path.extname(_filename).toLowerCase();

    const extToLang: Record<string, string> = {
      ".js": "JavaScript",
      ".ts": "TypeScript",
      ".py": "Python",
      ".java": "Java",
      ".cpp": "C++",
      ".c": "C",
      ".go": "Go",
      ".rs": "Rust",
      ".rb": "Ruby",
      ".php": "PHP",
      ".swift": "Swift",
      ".kt": "Kotlin",
      ".cs": "C#",
      ".r": "R",
      ".m": "MATLAB",
    };

    return extToLang[_ext] || "Unknown";
  }

  /**
   * Check if file is code
   */
  private isCodeFile(_ext: string): boolean {
    const _codeExtensions = [
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".py",
      ".java",
      ".cpp",
      ".c",
      ".h",
      ".go",
      ".rs",
      ".rb",
      ".php",
      ".swift",
      ".kt",
      ".cs",
      ".r",
      ".m",
      ".sh",
      ".bash",
      ".zsh",
      ".ps1",
      ".vim",
      ".lua",
    ];
    return _codeExtensions.includes(_ext);
  }

  /**
   * Check if file is _data
   */
  private isDataFile(_ext: string): boolean {
    return [".json", ".csv", ".xml", ".yaml", ".yml", ".toml"].includes(_ext);
  }

  /**
   * Check if file is document
   */
  private isDocumentFile(_ext: string): boolean {
    return [".md", ".txt", ".pdf", ".doc", ".docx", ".rtf"].includes(_ext);
  }

  /**
   * Extract _keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - can be improved
    const _words = text.toLowerCase().split(/\W+/);
    const _stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
    ]);

    const _wordFreq = new Map<string, number>();
    for (const word of _words) {
      if (word.length > 3 && !_stopWords.has(word)) {
        _wordFreq.set(word, (_wordFreq.get(word) || 0) + 1);
      }
    }

    // Sort by frequency and return top _keywords
    return Array.from(_wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Determine if text should trigger research
   */
  private shouldResearchText(text: string): boolean {
    // Check for patterns that might need research
    const _researchPatterns = [
      /https?:\/\//i, // URLs
      /\b(API|SDK|framework|library)\b/i, // Technical terms
      /\b(_error|exception|bug|issue)\b/i, // Problems
      /\b(how|what|why|when|where)\b/i, // Questions
    ];

    return _researchPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    const _units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < _units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${_units[unitIndex]}`;
  }

  /**
   * Display analysis summary
   */
  displaySummary(result: AnalysisResult): void {
    console.log(chalk.cyan("\n📊 Content Analysis:"));
    console.log(`  Type: ${chalk.yellow(result.type)}`);
    console.log(`  Summary: ${chalk.white(result.summary)}`);

    if (result.language) {
      console.log(`  Language: ${chalk.blue(result.language)}`);
    }

    if (result.keywords && result.keywords.length > 0) {
      console.log(
        `  Keywords: ${chalk.gray(result.keywords.slice(0, 5).join(", "))}`,
      );
    }

    if (result.extractedText) {
      const _preview = result.extractedText.substring(0, 100);
      console.log(
        `  Extracted: ${chalk.gray(_preview)}${result.extractedText.length > 100 ? "..." : ""}`,
      );
    }

    if (result.shouldResearch) {
      console.log(`  ${chalk.green("🔍 Auto-research triggered")}`);
    }
  }
}

export default ContentAnalyzer;
