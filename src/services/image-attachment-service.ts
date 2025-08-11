import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
// import { createReadStream } from 'fs';

export interface ImageAttachment {
  filename: string;
  filepath: string;
  base64: string;
  mimeType: string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface ImagePreview {
  filename: string;
  size: string;
  mimeType: string;
  dimensions?: string;
  base64Preview?: string; // First few chars for verification
}

export class ImageAttachmentService {
  private static instance: ImageAttachmentService;
  private supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
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

    // Common file path patterns
    const patterns = [
      // Absolute paths
      /(?:^|\s)([\/~][^\s]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg))/gi,
      // Relative paths
      /(?:^|\s)(\.?\.?\/[^\s]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg))/gi,
      // Windows paths
      /(?:^|\s)([a-zA-Z]:[\\\/][^\s]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg))/gi,
      // Just filename if in current directory
      /(?:^|\s)([^\s\/\\]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg))/gi,
    ];

    for (const pattern of patterns) {
      const matches = input.matchAll(pattern);
      for (const match of matches) {
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
      const stats = await fs.stat(filepath);
      if (!stats.isFile()) return false;

      const ext = path.extname(filepath).toLowerCase();
      if (!this.supportedFormats.includes(ext)) return false;

      if (stats.size > this.maxFileSize) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Process image file and convert to base64
   */
  public async processImageFile(filepath: string): Promise<ImageAttachment | null> {
    try {
      const isValid = await this.validateImageFile(filepath);
      if (!isValid) return null;

      const stats = await fs.stat(filepath);
      const buffer = await fs.readFile(filepath);
      const base64 = buffer.toString('base64');

      const ext = path.extname(filepath).toLowerCase();
      const mimeType = this.getMimeType(ext);
      const filename = path.basename(filepath);

      // Try to get image dimensions (basic implementation)
      const dimensions = await this.getImageDimensions(buffer, ext);

      return {
        filename,
        filepath,
        base64,
        mimeType,
        size: stats.size,
        dimensions,
      };
    } catch (error) {
      console.error(chalk.red(`Error processing image: ${error}`));
      return null;
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Basic image dimensions detection (simplified)
   */
  private async getImageDimensions(
    buffer: Buffer,
    ext: string,
  ): Promise<{ width: number; height: number } | undefined> {
    try {
      // PNG signature and dimensions
      if (ext === '.png' && buffer.length > 24) {
        if (buffer.toString('hex', 0, 8) === '89504e470d0a1a0a') {
          const width = buffer.readUInt32BE(16);
          const height = buffer.readUInt32BE(20);
          return { width, height };
        }
      }

      // JPEG dimensions (basic SOF0 parsing)
      if ((ext === '.jpg' || ext === '.jpeg') && buffer.length > 10) {
        for (let i = 0; i < buffer.length - 4; i++) {
          if (buffer[i] === 0xff && buffer[i + 1] === 0xc0) {
            const height = buffer.readUInt16BE(i + 5);
            const width = buffer.readUInt16BE(i + 7);
            return { width, height };
          }
        }
      }

      // For other formats, return undefined (dimensions unknown)
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Format file size for display
   */
  public formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Display image preview in terminal
   */
  public displayImagePreview(attachment: ImageAttachment): void {
    console.log('\n' + chalk.cyan('🖼️  Image Attachment'));
    console.log(chalk.gray('=' + '='.repeat(40)));

    // Basic info
    console.log(chalk.white.bold(`📁 ${attachment.filename}`));
    console.log(chalk.gray(`   Size: ${this.formatFileSize(attachment.size)}`));
    console.log(chalk.gray(`   Type: ${attachment.mimeType}`));

    if (attachment.dimensions) {
      console.log(
        chalk.gray(
          `   Dimensions: ${attachment.dimensions.width}x${attachment.dimensions.height}px`,
        ),
      );
    }

    console.log(chalk.gray(`   Path: ${attachment.filepath}`));

    // Base64 info
    const base64Length = attachment.base64.length;
    const base64Preview = attachment.base64.substring(0, 50) + '...';
    console.log(chalk.gray(`   Base64: ${base64Length} chars (${base64Preview})`));

    // Simple ASCII art representation
    this.displayAsciiPreview();

    console.log(chalk.green('✅ Image processed and ready for AI analysis'));
  }

  /**
   * Display a simple ASCII representation of the image
   */
  private displayAsciiPreview(): void {
    console.log(chalk.gray('\n   Preview:'));

    // Create a simple frame representation
    const frameWidth = 20;
    const frameHeight = 8;

    // Top border
    console.log(chalk.gray('   ┌' + '─'.repeat(frameWidth - 2) + '┐'));

    // Content area with image icon
    for (let row = 0; row < frameHeight - 2; row++) {
      if (row === Math.floor((frameHeight - 2) / 2)) {
        // Center row with image icon
        const padding = Math.floor((frameWidth - 8) / 2);
        const content = ' '.repeat(padding) + '🖼️ IMG' + ' '.repeat(frameWidth - padding - 8);
        console.log(chalk.gray('   │') + chalk.cyan(content) + chalk.gray('│'));
      } else {
        // Empty rows
        console.log(chalk.gray('   │' + ' '.repeat(frameWidth - 2) + '│'));
      }
    }

    // Bottom border
    console.log(chalk.gray('   └' + '─'.repeat(frameWidth - 2) + '┘'));
  }

  /**
   * Process multiple image files
   */
  public async processMultipleImages(filepaths: string[]): Promise<ImageAttachment[]> {
    const attachments: ImageAttachment[] = [];

    console.log(chalk.cyan(`\n🔍 Processing ${filepaths.length} image file(s)...`));

    for (const filepath of filepaths) {
      console.log(chalk.gray(`   Checking: ${filepath}`));

      const attachment = await this.processImageFile(filepath);
      if (attachment) {
        attachments.push(attachment);
        console.log(chalk.green(`   ✅ Processed: ${attachment.filename}`));
      } else {
        console.log(chalk.red(`   ❌ Failed: ${filepath} (invalid or too large)`));
      }
    }

    return attachments;
  }

  /**
   * Create a summary of all attachments for AI context
   */
  public createAttachmentSummary(attachments: ImageAttachment[]): string {
    if (attachments.length === 0) return '';

    let summary = `\n[ATTACHED IMAGES: ${attachments.length}]\n`;

    attachments.forEach((attachment, index) => {
      summary += `Image ${index + 1}: ${attachment.filename}\n`;
      summary += `  Type: ${attachment.mimeType}\n`;
      summary += `  Size: ${this.formatFileSize(attachment.size)}\n`;
      if (attachment.dimensions) {
        summary += `  Dimensions: ${attachment.dimensions.width}x${attachment.dimensions.height}px\n`;
      }
      summary += `  Base64: data:${attachment.mimeType};base64,${attachment.base64}\n`;
      summary += '\n';
    });

    return summary;
  }

  /**
   * Check if input contains clipboard paste patterns
   */
  public detectClipboardPaste(input: string): boolean {
    // Common clipboard paste indicators
    const pastePatterns = [
      /\[Pasted\s+(?:text|image|content)\s*#?\d*\s*\+?\d*\s*lines?\]/i,
      /\[Clipboard\s+content\]/i,
      /\[Paste\]/i,
      // macOS/iOS paste patterns
      /\[.*?\s+from\s+.*?\]/i,
    ];

    return pastePatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Extract pasted content information
   */
  public extractPasteInfo(input: string): { lineCount: number; type: string } | null {
    const pasteMatch = input.match(
      /\[Pasted\s+(?:text|image|content)\s*#?(\d*)\s*\+?(\d*)\s*lines?\]/i,
    );

    if (pasteMatch) {
      const lineCount = parseInt(pasteMatch[2] || pasteMatch[1] || '0', 10);
      return {
        lineCount,
        type: 'text',
      };
    }

    return null;
  }
}
