/**
 * File Drop Handler - Manages drag & drop functionality for _files and images
 */
import * as fs from "fs-extra";
import * as path from "path";
import { fileTypeFromFile } from "file-type";
import chalk from "chalk";

export interface DroppedFile {
  id: string;
  _path: string;
  name: string;
  size: number;
  type: string;
  mimeType?: string;
  _isImage: boolean;
  _isText: boolean;
  _content?: string;
  imageBuffer?: Buffer;
  metadata?: any;
}

export interface FileDropConfig {
  maxFileSize: number; // in bytes
  supportedTypes: string[];
  enableOCR: boolean;
  enableImageAnalysis: boolean;
  maxFiles: number;
}

export class FileDropHandler {
  private config: FileDropConfig;
  private droppedFiles: Map<string, DroppedFile> = new Map();
  private dropZoneActive: boolean = false;

  constructor(_config: Partial<FileDropConfig> = {}) {
    this._config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportedTypes: [
        ".txt",
        ".md",
        ".js",
        ".ts",
        ".json",
        ".py",
        ".java",
        ".cpp",
        ".c",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".pdf",
      ],
      enableOCR: true,
      enableImageAnalysis: true,
      maxFiles: 10,
      ..._config,
    };
  }

  /**
   * Initialize file drop detection
   */
  async initialize(): Promise<void> {
    // Set up terminal event listeners for file drop detection
    this.setupDropZone();
  }

  /**
   * Set up drop zone detection (simplified for CLI)
   */
  private setupDropZone(): void {
    // In a real implementation, this would integrate with terminal capabilities
    // For now, we'll provide a method to manually add _files
    console.log(
      chalk.gray(
        "📎 File drop zone initialized. Use addFile() method to add files.",
      ),
    );
  }

  /**
   * Manually add a file (simulates drag & drop)
   */
  async addFile(_filePath: string): Promise<DroppedFile | null> {
    try {
      // Validate file exists
      const _stats = await fs.stat(_filePath);
      if (!_stats.isFile()) {
        throw new Error("Path is not a file");
      }

      // Check file size
      if (_stats.size > this.config.maxFileSize) {
        console.log(
          chalk.red(
            `❌ File too large: ${this.formatFileSize(_stats.size)} > ${this.formatFileSize(this.config.maxFileSize)}`,
          ),
        );
        return null;
      }

      // Check if we've reached max _files
      if (this.droppedFiles.size >= this.config.maxFiles) {
        console.log(
          chalk.red(
            `❌ Maximum _files limit reached (${this.config.maxFiles})`,
          ),
        );
        return null;
      }

      // Determine file type
      const _fileType = await fileTypeFromFile(_filePath);
      const _extension = path.extname(_filePath).toLowerCase();

      // Check if file type is supported
      if (
        !this.config.supportedTypes.includes(_extension) &&
        !_fileType?.mime.startsWith("image/")
      ) {
        console.log(chalk.yellow(`⚠️ Unsupported file type: ${_extension}`));
        return null;
      }

      // Create dropped file object
      const _fileId = this.generateFileId();
      const _fileName = path.basename(_filePath);
      const _isImage =
        _fileType?.mime?.startsWith("image/") ||
        [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"].includes(_extension);
      const _isText = [
        ".txt",
        ".md",
        ".js",
        ".ts",
        ".json",
        ".py",
        ".java",
        ".cpp",
        ".c",
        ".html",
        ".css",
        ".xml",
      ].includes(_extension);

      const droppedFile: DroppedFile = {
        id: _fileId,
        _path: _filePath,
        name: _fileName,
        size: _stats.size,
        type: _extension,
        mimeType: _fileType?.mime,
        _isImage,
        _isText,
      };

      // Process file _content
      await this.processFileContent(droppedFile);

      // Add to collection
      this.droppedFiles.set(_fileId, droppedFile);

      console.log(
        chalk.green(
          `✅ Added file: ${_fileName} (${this.formatFileSize(_stats.size)})`,
        ),
      );
      return droppedFile;
    } catch (_error) {
      console.log(
        chalk.red(
          `❌ Failed to add file: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        ),
      );
      return null;
    }
  }

  /**
   * Process file _content based on type
   */
  private async processFileContent(file: DroppedFile): Promise<void> {
    try {
      if (file.isImage) {
        // Load image buffer for analysis
        file.imageBuffer = await fs.readFile(file._path);

        if (this.config.enableOCR) {
          // OCR processing will be handled by OCRProcessor
          file.metadata = { requiresOCR: true };
        }
      } else if (file.isText) {
        // Read text _content
        const _content = await fs.readFile(file._path, "utf-8");
        file._content =
          _content.length > 10000
            ? _content.substring(0, 10000) + "..."
            : _content;
      } else if (file.type === ".pdf") {
        // PDF processing placeholder
        file.metadata = { requiresPDFExtraction: true };
      }
    } catch (_error) {
      console.log(
        chalk.yellow(
          `⚠️ Could not process _content for ${file.name}: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        ),
      );
    }
  }

  /**
   * Get all dropped _files
   */
  getDroppedFiles(): DroppedFile[] {
    return Array.from(this.droppedFiles.values());
  }

  /**
   * Get file by ID
   */
  getFile(_fileId: string): DroppedFile | undefined {
    return this.droppedFiles.get(_fileId);
  }

  /**
   * Remove file by ID
   */
  removeFile(_fileId: string): boolean {
    return this.droppedFiles.delete(_fileId);
  }

  /**
   * Clear all dropped _files
   */
  clearFiles(): void {
    this.droppedFiles.clear();
  }

  /**
   * Get _files _summary for display
   */
  getFilesSummary(): string {
    const _files = Array.from(this.droppedFiles.values());
    if (_files.length === 0) {
      return "No _files attached";
    }

    const _summary = _files.map((file) => {
      const _icon = file.isImage ? "🖼️" : "📄";
      return `${_icon} ${file.name} (${this.formatFileSize(file.size)})`;
    });

    return _summary.join(", ");
  }

  /**
   * Generate context string for AI processing
   */
  generateContextString(): string {
    const _files = Array.from(this.droppedFiles.values());
    if (_files.length === 0) {
      return "";
    }

    let context = "\n\n--- Attached Files ---\n";

    for (const file of _files) {
      context += `\nFile: ${file.name} (${this.formatFileSize(file.size)})\n`;
      context += `Type: ${file.mimeType || file.type}\n`;

      if (file.content) {
        context += `Content:\n${file.content}\n`;
      } else if (file.isImage) {
        context += `Image attached - OCR and analysis will be performed\n`;
      }

      context += "---\n";
    }

    return context;
  }

  /**
   * Get images for processing
   */
  getImagesForProcessing(): DroppedFile[] {
    return Array.from(this.droppedFiles.values()).filter(
      (file) => file.isImage && file.imageBuffer,
    );
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

    return `${size.toFixed(1)}${_units[unitIndex]}`;
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if drop zone is active
   */
  isDropZoneActive(): boolean {
    return this.dropZoneActive;
  }

  /**
   * Activate drop zone
   */
  activateDropZone(): void {
    this.dropZoneActive = true;
  }

  /**
   * Deactivate drop zone
   */
  deactivateDropZone(): void {
    this.dropZoneActive = false;
  }

  /**
   * Get supported file types
   */
  getSupportedTypes(): string[] {
    return this.config.supportedTypes;
  }

  /**
   * Validate file type
   */
  isFileTypeSupported(_filePath: string): boolean {
    const _extension = path.extname(_filePath).toLowerCase();
    return this.config.supportedTypes.includes(_extension);
  }
}
