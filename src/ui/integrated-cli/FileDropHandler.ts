/**
 * FileDropHandler Component
 * Handles file drag & drop detection and processing
 */

import { EventEmitter } from "node:events";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

/**
 * File drop _event data
 */
export interface FileDropEvent {
  type: "file" | "directory" | "_url" | "image";
  _path: string;
  name: string;
  size?: number;
  mimeType?: string;
  content?: string;
  _isImage?: boolean;
}

/**
 * File drop handler configuration
 */
export interface FileDropHandlerConfig {
  maxFileSize?: number; // Max file size in bytes
  allowedExtensions?: string[];
  autoReadContent?: boolean;
  enableUrlDetection?: boolean;
}

/**
 * File drop handler class
 */
export class FileDropHandler extends EventEmitter {
  private config: Required<FileDropHandlerConfig>;
  private droppedFiles: FileDropEvent[] = [];

  constructor(_config: FileDropHandlerConfig = {}) {
    super();
    this._config = {
      maxFileSize: _config.maxFileSize || 10 * 1024 * 1024, // 10MB default
      allowedExtensions: _config.allowedExtensions || [],
      autoReadContent: _config.autoReadContent || false,
      enableUrlDetection: _config.enableUrlDetection ?? true,
    };
  }

  /**
   * Process dropped or pasted input
   */
  async processInput(input: string): Promise<FileDropEvent[]> {
    const results: FileDropEvent[] = [];

    // Check if input is a URL
    if (this.config.enableUrlDetection && this.isUrl(input)) {
      const _urlEvent = this.createUrlEvent(input);
      results.push(_urlEvent);
      this.emit("_url", _urlEvent);
      return results;
    }

    // Check if input contains file _paths
    const _paths = this.extractFilePaths(input);

    for (const _filePath of _paths) {
      try {
        const _event = await this.processFilePath(_filePath);
        if (_event) {
          results.push(_event);
          this.droppedFiles.push(_event);
          this.emit("file", _event);
        }
      } catch (_error) {
        this.emit("_error", {
          _path: _filePath,
          _error: _error instanceof Error ? _error.message : "Unknown _error",
        });
      }
    }

    return results;
  }

  /**
   * Process a file path
   */
  private async processFilePath(
    _filePath: string,
  ): Promise<FileDropEvent | null> {
    // Expand home directory
    if (_filePath.startsWith("~")) {
      _filePath = path.join(process.env["HOME"] || "", _filePath.slice(1));
    }

    // Resolve absolute path
    const _absolutePath = path.resolve(_filePath);

    // Check if file exists
    if (!fs.existsSync(_absolutePath)) {
      return null;
    }

    const _stats = fs.statSync(_absolutePath);

    // Check if it's a directory
    if (_stats.isDirectory()) {
      return {
        type: "directory",
        _path: _absolutePath,
        name: path.basename(_absolutePath),
      };
    }

    // Check file size
    if (_stats.size > this.config.maxFileSize) {
      throw new Error(
        `File too large: ${this.formatFileSize(_stats.size)} (max: ${this.formatFileSize(this.config.maxFileSize)})`,
      );
    }

    // Check extension if restrictions are set
    const _ext = path.extname(_absolutePath).toLowerCase();
    if (
      this.config.allowedExtensions.length > 0 &&
      !this.config.allowedExtensions.includes(_ext)
    ) {
      throw new Error(`File type not allowed: ${_ext}`);
    }

    // Determine if it's an image
    const _isImage = this.isImageFile(_absolutePath);

    // Create file _event
    const _event: FileDropEvent = {
      type: _isImage ? "image" : "file",
      _path: _absolutePath,
      name: path.basename(_absolutePath),
      size: _stats.size,
      mimeType: this.getMimeType(_absolutePath),
      _isImage,
    };

    // Auto-read content if enabled and not too large
    if (this.config.autoReadContent && _stats.size < 1024 * 1024) {
      // 1MB limit for auto-read
      try {
        event.content = fs.readFileSync(_absolutePath, "utf-8");
      } catch {
        // If can't read as text, skip content
      }
    }

    return _event;
  }

  /**
   * Check if string is a URL
   */
  private isUrl(str: string): boolean {
    try {
      const _url = new URL(str);
      return _url.protocol === "http:" || _url.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Create URL _event
   */
  private createUrlEvent(_url: string): FileDropEvent {
    return {
      type: "_url",
      _path: _url,
      name: _url,
    };
  }

  /**
   * Extract file _paths from input text
   */
  private extractFilePaths(input: string): string[] {
    const _paths: string[] = [];

    // Match file _paths (Unix/Windows)
    const _pathPattern = /(?:^|\s)([~\/]?[\w\-./\\:]+(?:\.\w+)?)/g;
    const _matches = input.matchAll(_pathPattern);

    for (const match of _matches) {
      const _potentialPath = match[1];
      if (_potentialPath) {
        // Basic validation - must have at least one separator
        if (_potentialPath.includes("/") || _potentialPath.includes("\\")) {
          paths.push(_potentialPath);
        }
      }
    }

    // Also check for quoted _paths
    const _quotedPattern = /["']([^"']+)["']/g;
    const _quotedMatches = input.matchAll(_quotedPattern);

    for (const match of _quotedMatches) {
      const _potentialPath = match[1];
      if (_potentialPath) {
        if (_potentialPath.includes("/") || _potentialPath.includes("\\")) {
          paths.push(_potentialPath);
        }
      }
    }

    return [...new Set(_paths)]; // Remove duplicates
  }

  /**
   * Check if file is an image
   */
  private isImageFile(_filePath: string): boolean {
    const _ext = path.extname(_filePath).toLowerCase();
    const _imageExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".bmp",
      ".svg",
      ".webp",
      ".ico",
    ];
    return _imageExtensions.includes(_ext);
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(_filePath: string): string {
    const _ext = path.extname(_filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".txt": "text/plain",
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".ts": "application/typescript",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".md": "text/markdown",
    };

    return mimeTypes[_ext] || "application/octet-stream";
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const _units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < _units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${_units[unitIndex]}`;
  }

  /**
   * Get all dropped files
   */
  getDroppedFiles(): FileDropEvent[] {
    return [...this.droppedFiles];
  }

  /**
   * Clear dropped files history
   */
  clearDroppedFiles(): void {
    this.droppedFiles = [];
  }

  /**
   * Display dropped files summary
   */
  displaySummary(): void {
    if (this.droppedFiles.length === 0) {
      console.log(chalk.gray("No files attached"));
      return;
    }

    console.log(chalk.cyan("\n📎 Attached References:"));
    for (const file of this.droppedFiles) {
      const _icon = file.isImage
        ? "🖼️"
        : file.type === "directory"
          ? "📁"
          : file.type === "_url"
            ? "🔗"
            : "📄";
      const _sizeStr = file.size
        ? chalk.gray(` (${this.formatFileSize(file.size)})`)
        : "";
      console.log(`  ${_icon} ${chalk.white(file.name)}${_sizeStr}`);
    }
  }
}

export default FileDropHandler;
