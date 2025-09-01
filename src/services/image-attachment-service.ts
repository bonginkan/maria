import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
// import { createReadStream } from 'fs';

export interface ImageAttachment {
  _filename: string;
  filepath: string;
  _base64: string;
  _mimeType: string;
  size: number;
  _dimensions?: {
    _width: number;
    _height: number;
  };
}

export interface ImagePreview {
  _filename: string;
  size: string;
  _mimeType: string;
  _dimensions?: string;
  _base64Preview?: string; // First few chars for verification
}

export class ImageAttachmentService {
  private static instance: ImageAttachmentService;
  private supportedFormats = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".svg",
  ];
  private maxFileSize = 10 * 1024 * 1024; // 10MB limit

  public static getInstance(): ImageAttachmentService {
    if (!ImageAttachmentService.instance) {
      ImageAttachmentService.instance = new ImageAttachmentService();
    }
    return ImageAttachmentService.instance;
  }

  /**
   * Detect if input contains file paths (drag & drop or typed paths)
   */
  public detectFilePaths(input: string): string[] {
    const paths: string[] = [];

    // Common file path _patterns
    const _patterns = [
      // Absolute paths
      /(?:^|\s)([/~][^\s]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg))/gi,
      // Relative paths
      new RegExp(
        "(?:^|\\s)(\.?\\.?$2/[^\\s]+\\.(?:jpg|jpeg|png|gif|bmp|webp|svg))",
        "gi",
      ),
      // Windows paths
      new RegExp(
        "(?:^|\\s)([a-zA-Z]:[/\\\\][^\\s]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg))",
        "gi",
      ),
      // Just _filename if in current directory
      /(?:^|\s)([^\s/\\]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg))/gi,
    ];

    for (const pattern of _patterns) {
      const _matches = input.matchAll(pattern);
      for (const match of _matches) {
        if (match[1]) {
          paths.push(match[1].trim());
        }
      }
    }

    return [...new Set(paths)]; // Remove duplicates
  }

  /**
   * Validate if file exists and is a supported image format
   */
  public async validateImageFile(filepath: string): Promise<boolean> {
    try {
      const _stats = await fs.stat(filepath);
      if (!_stats.isFile()) {
        return false;
      }

      const _ext = path.extname(filepath).toLowerCase();
      if (!this.supportedFormats.includes(_ext)) {
        return false;
      }

      if (_stats.size > this.maxFileSize) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Process image file and convert to _base64
   */
  public async processImageFile(
    filepath: string,
  ): Promise<ImageAttachment | null> {
    try {
      const _isValid = await this.validateImageFile(filepath);
      if (!_isValid) {
        return null;
      }

      const _stats = await fs.stat(filepath);
      const _buffer = await fs.readFile(filepath);
      const _base64 = _buffer.toString("_base64");

      const _ext = path.extname(filepath).toLowerCase();
      const _mimeType = this.getMimeType(_ext);
      const _filename = path.basename(filepath);

      // Try to get image _dimensions (basic implementation)
      const _dimensions = await this.getImageDimensions(_buffer, _ext);

      return {
        _filename,
        filepath,
        _base64,
        _mimeType,
        size: _stats.size,
        _dimensions,
      };
    } catch (_error: unknown) {
      console._error(chalk.red(`Error processing image: ${_error}`));
      return null;
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(_ext: string): string {
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
    };

    return mimeTypes[_ext] || "image/jpeg";
  }

  /**
   * Basic image _dimensions detection (simplified)
   */
  private async getImageDimensions(
    _buffer: Buffer,
    _ext: string,
  ): Promise<{ _width: number; _height: number } | undefined> {
    try {
      // PNG signature and _dimensions
      if (_ext === ".png" && buffer.length > 24) {
        if (buffer.toString("hex", 0, 8) === "89504e470d0a1a0a") {
          const _width = buffer.readUInt32BE(16);
          const _height = buffer.readUInt32BE(20);
          return { _width, _height };
        }
      }

      // JPEG _dimensions (basic SOF0 parsing)
      if ((_ext === ".jpg" || _ext === ".jpeg") && buffer.length > 10) {
        for (let i = 0; i < buffer.length - 4; i++) {
          if (_buffer[i] === 0xff && _buffer[i + 1] === 0xc0) {
            const _height = buffer.readUInt16BE(i + 5);
            const _width = buffer.readUInt16BE(i + 7);
            return { _width, _height };
          }
        }
      }

      // For other formats, return undefined (_dimensions unknown)
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Format file size for display
   */
  public formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return "0 B";
    }

    const k = 1024;
    const _sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${_sizes[i]}`;
  }

  /**
   * Display image preview in terminal
   */
  public displayImagePreview(_attachment: ImageAttachment): void {
    console.log(`\n${chalk.cyan("🖼️  Image Attachment")}`);
    console.log(chalk.gray(`=${"=".repeat(40)}`));

    // Basic info
    console.log(chalk.white.bold(`📁 ${_attachment.filename}`));
    console.log(
      chalk.gray(`   Size: ${this.formatFileSize(_attachment.size)}`),
    );
    console.log(chalk.gray(`   Type: ${_attachment.mimeType}`));

    if (_attachment.dimensions) {
      console.log(
        chalk.gray(
          `   Dimensions: ${_attachment.dimensions.width}x${_attachment.dimensions.height}px`,
        ),
      );
    }

    console.log(chalk.gray(`   Path: ${_attachment.filepath}`));

    // Base64 info
    const _base64Length = _attachment.base64.length;
    const _base64Preview = `${_attachment.base64.substring(0, 50)}...`;
    console.log(
      chalk.gray(`   Base64: ${_base64Length} chars (${_base64Preview})`),
    );

    // Simple ASCII art representation
    this.displayAsciiPreview();

    console.log(chalk.green("✅ Image processed and ready for AI analysis"));
  }

  /**
   * Display a simple ASCII representation of the image
   */
  private displayAsciiPreview(): void {
    console.log(chalk.gray("\n   Preview:"));

    // Create a simple frame representation
    const _frameWidth = 20;
    const _frameHeight = 8;

    // Top border
    console.log(chalk.gray(`   ┌${"─".repeat(_frameWidth - 2)}┐`));

    // Content area with image icon
    for (let row = 0; row < _frameHeight - 2; row++) {
      if (row === Math.floor((_frameHeight - 2) / 2)) {
        // Center row with image icon
        const _padding = Math.floor((_frameWidth - 8) / 2);
        const _content = `${" ".repeat(_padding)}🖼️ IMG${" ".repeat(_frameWidth - _padding - 8)}`;
        console.log(
          chalk.gray("   │") + chalk.cyan(_content) + chalk.gray("│"),
        );
      } else {
        // Empty rows
        console.log(chalk.gray(`   │${" ".repeat(_frameWidth - 2)}│`));
      }
    }

    // Bottom border
    console.log(chalk.gray(`   └${"─".repeat(_frameWidth - 2)}┘`));
  }

  /**
   * Process multiple image files
   */
  public async processMultipleImages(
    filepaths: string[],
  ): Promise<ImageAttachment[]> {
    const attachments: ImageAttachment[] = [];

    console.log(
      chalk.cyan(`\n🔍 Processing ${filepaths.length} image file(s)...`),
    );

    for (const filepath of filepaths) {
      console.log(chalk.gray(`   Checking: ${filepath}`));

      const _attachment = await this.processImageFile(filepath);
      if (_attachment) {
        attachments.push(_attachment);
        console.log(chalk.green(`   ✅ Processed: ${_attachment.filename}`));
      } else {
        console.log(
          chalk.red(`   ❌ Failed: ${filepath} (invalid or too large)`),
        );
      }
    }

    return attachments;
  }

  /**
   * Create a summary of all attachments for AI context
   */
  public createAttachmentSummary(attachments: ImageAttachment[]): string {
    if (attachments.length === 0) {
      return "";
    }

    let summary = `\n[ATTACHED IMAGES: ${attachments.length}]\n`;

    attachments.forEach((_attachment, _index) => {
      summary += `Image ${_index + 1}: ${_attachment.filename}\n`;
      summary += `  Type: ${_attachment.mimeType}\n`;
      summary += `  Size: ${this.formatFileSize(_attachment.size)}\n`;
      if (_attachment.dimensions) {
        summary += `  Dimensions: ${_attachment.dimensions.width}x${_attachment.dimensions.height}px\n`;
      }
      summary += `  Base64: data:${_attachment.mimeType};_base64,${_attachment.base64}\n`;
      summary += "\n";
    });

    return summary;
  }

  /**
   * Check if input contains clipboard paste _patterns
   */
  public detectClipboardPaste(input: string): boolean {
    // Common clipboard paste indicators
    const _pastePatterns = [
      /\[Pasted\s+(?:text|image|_content)\s*#?\d*\s*\+?\d*\s*lines?\]/i,
      /\[Clipboard\s+_content\]/i,
      /\[Paste\]/i,
      // macOS/iOS paste _patterns
      /\[.*?\s+from\s+.*?\]/i,
    ];

    return _pastePatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Extract pasted _content information
   */
  public extractPasteInfo(
    input: string,
  ): { _lineCount: number; type: string } | null {
    const _pasteMatch = input.match(
      /\[Pasted\s+(?:text|image|_content)\s*#?(\d*)\s*\+?(\d*)\s*lines?\]/i,
    );

    if (_pasteMatch) {
      const _lineCount = parseInt(_pasteMatch[2] || _pasteMatch[1] || "0", 10);
      return {
        _lineCount,
        type: "text",
      };
    }

    return null;
  }
}
