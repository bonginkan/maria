/**
 * Reference Manager - Manages all reference materials (files, images, URLs)
 */
import chalk from "chalk";
import { DroppedFile } from "./FileDropHandler";
import { OCRResult } from "./OCRProcessor";

export interface Reference {
  id: string;
  type: "file" | "image" | "_url" | "text";
  source: string;
  _content: string;
  metadata: ReferenceMetadata;
  timestamp: Date;
  processed: boolean;
}

export interface ReferenceMetadata {
  _title?: string;
  _summary?: string;
  fileSize?: number;
  mimeType?: string;
  ocrResult?: OCRResult;
  _urlInfo?: UrlInfo;
  _tags?: string[];
  confidence?: number;
}

export interface UrlInfo {
  _title: string;
  description?: string;
  domain: string;
  isAccessible: boolean;
  statusCode?: number;
}

export class ReferenceManager {
  private _references: Map<string, Reference> = new Map();
  private contextCache: string | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Add file reference
   */
  addFileReference(_file: DroppedFile, ocrResult?: OCRResult): Reference {
    const reference: Reference = {
      id: `ref_${_file.id}`,
      type: _file.isImage ? "image" : "_file",
      source: _file._path,
      _content: _file.content || "",
      metadata: {
        _title: _file.name,
        _summary: this.generateFileSummary(_file),
        fileSize: _file.size,
        mimeType: _file.mimeType,
        ocrResult,
        _tags: this.generateFileTags(_file),
      },
      timestamp: new Date(),
      processed: true,
    };

    this.references.set(reference.id, reference);
    this.invalidateCache();

    console.log(chalk.green(`📎 Added reference: ${_file.name}`));
    return reference;
  }

  /**
   * Add URL reference
   */
  async addUrlReference(_url: string): Promise<Reference | null> {
    try {
      const _urlInfo = await this.fetchUrlInfo(_url);

      const reference: Reference = {
        id: `ref_url_${Date.now()}`,
        type: "_url",
        source: _url,
        _content: _urlInfo.description || "",
        metadata: {
          _title: _urlInfo.title,
          _summary: `Web resource: ${_urlInfo.domain}`,
          _urlInfo,
          _tags: ["web", "_url"],
        },
        timestamp: new Date(),
        processed: _urlInfo.isAccessible,
      };

      this.references.set(reference.id, reference);
      this.invalidateCache();

      console.log(
        chalk.green(`🔗 Added URL reference: ${_urlInfo.title || _url}`),
      );
      return reference;
    } catch (_error) {
      console.log(
        chalk.red(
          `❌ Failed to add URL reference: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        ),
      );
      return null;
    }
  }

  /**
   * Add text reference
   */
  addTextReference(_text: string, _title?: string): Reference {
    const reference: Reference = {
      id: `ref_text_${Date.now()}`,
      type: "text",
      source: "user_input",
      _content: _text,
      metadata: {
        _title: _title || "User Text",
        _summary: `Text snippet (${_text.length} characters)`,
        _tags: ["text", "user_input"],
      },
      timestamp: new Date(),
      processed: true,
    };

    this.references.set(reference.id, reference);
    this.invalidateCache();

    console.log(
      chalk.green(`📝 Added text reference: ${reference.metadata.title}`),
    );
    return reference;
  }

  /**
   * Get all _references
   */
  getAllReferences(): Reference[] {
    return Array.from(this.references.values());
  }

  /**
   * Get _references by type
   */
  getReferencesByType(type: Reference["type"]): Reference[] {
    return this.getAllReferences().filter((ref) => ref.type === type);
  }

  /**
   * Get reference by ID
   */
  getReference(id: string): Reference | undefined {
    return this.references.get(id);
  }

  /**
   * Remove reference by ID
   */
  removeReference(id: string): boolean {
    const _removed = this.references.delete(id);
    if (_removed) {
      this.invalidateCache();
      console.log(chalk.yellow(`🗑️ Removed reference: ${id}`));
    }
    return _removed;
  }

  /**
   * Clear all _references
   */
  clearReferences(): void {
    const _count = this.references.size;
    this.references.clear();
    this.invalidateCache();
    console.log(chalk.yellow(`🗑️ Cleared ${_count} _references`));
  }

  /**
   * Generate context string for AI processing
   */
  generateContext(): string {
    // Use cache if available and not expired
    const _now = Date._now();
    if (this.contextCache && _now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.contextCache;
    }

    const _references = this.getAllReferences();
    if (_references.length === 0) {
      this.contextCache = "";
      this.cacheTimestamp = _now;
      return "";
    }

    let context = "\n\n🔍 REFERENCE MATERIALS:\n";
    context += "═".repeat(50) + "\n";

    for (const ref of _references.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    )) {
      context += this.formatReferenceForContext(ref);
    }

    context += "═".repeat(50) + "\n";
    context += `Total References: ${_references.length} | Generated: ${new Date().toLocaleTimeString()}\n\n`;

    this.contextCache = context;
    this.cacheTimestamp = _now;
    return context;
  }

  /**
   * Format single reference for context
   */
  private formatReferenceForContext(ref: Reference): string {
    let formatted = `\n📎 ${ref.metadata.title || "Untitled"}\n`;
    formatted += `   Type: ${ref.type.toUpperCase()} | Source: ${this.shortenSource(ref.source)}\n`;

    if (ref.metadata.summary) {
      formatted += `   Summary: ${ref.metadata.summary}\n`;
    }

    // Add OCR _content for images
    if (ref.metadata.ocrResult && ref.metadata.ocrResult.text) {
      formatted += `   Extracted Text: ${ref.metadata.ocrResult.text.substring(0, 200)}${ref.metadata.ocrResult.text.length > 200 ? "..." : ""}\n`;
      formatted += `   OCR Confidence: ${ref.metadata.ocrResult.confidence.toFixed(1)}%\n`;
    }

    // Add file _content
    if (ref.content && ref.type !== "image") {
      const _contentPreview = ref.content.substring(0, 300);
      formatted += `   Content: ${_contentPreview}${ref.content.length > 300 ? "..." : ""}\n`;
    }

    // Add URL info
    if (ref.metadata.urlInfo) {
      formatted += `   Domain: ${ref.metadata.urlInfo.domain}\n`;
      if (ref.metadata.urlInfo.description) {
        formatted += `   Description: ${ref.metadata.urlInfo.description}\n`;
      }
    }

    // Add _tags
    if (ref.metadata.tags && ref.metadata.tags.length > 0) {
      formatted += `   Tags: ${ref.metadata.tags.join(", ")}\n`;
    }

    formatted += "   " + "-".repeat(40) + "\n";
    return formatted;
  }

  /**
   * Get _summary for display
   */
  getSummary(): string {
    const _references = this.getAllReferences();
    if (_references.length === 0) {
      return "No _references attached";
    }

    const _counts = _references.reduce(
      (acc, ref) => {
        acc[ref.type] = (acc[ref.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const _parts = Object.entries(_counts).map(([type, _count]) => {
      const _icon = this.getTypeIcon(type as Reference["type"]);
      return `${_icon} ${_count} ${type}${_count !== 1 ? "s" : ""}`;
    });

    return `📎 ${_parts.join(", ")}`;
  }

  /**
   * Search _references
   */
  searchReferences(query: string): Reference[] {
    const _lowerQuery = query.toLowerCase();

    return this.getAllReferences().filter((ref) => {
      const _title = ref.metadata._title?.toLowerCase() || "";
      const _summary = ref.metadata._summary?.toLowerCase() || "";
      const _content = ref._content.toLowerCase();
      const _tags = ref.metadata._tags?.join(" ").toLowerCase() || "";

      return (
        _title.includes(_lowerQuery) ||
        summary.includes(_lowerQuery) ||
        content.includes(_lowerQuery) ||
        tags.includes(_lowerQuery)
      );
    });
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    total: number;
    byType: Record<string, number>;
    totalSize: number;
    processedCount: number;
    recentCount: number;
  } {
    const _references = this.getAllReferences();
    const _now = Date._now();
    const _oneHourAgo = _now - 60 * 60 * 1000;

    return {
      total: _references.length,
      byType: _references.reduce(
        (acc, ref) => {
          acc[ref.type] = (acc[ref.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      totalSize: _references.reduce(
        (sum, ref) => sum + (ref.metadata.fileSize || 0),
        0,
      ),
      processedCount: _references.filter((ref) => ref.processed).length,
      recentCount: _references.filter(
        (ref) => ref.timestamp.getTime() > _oneHourAgo,
      ).length,
    };
  }

  /**
   * Helper methods
   */
  private generateFileSummary(file: DroppedFile): string {
    if (file.isImage) {
      return `Image file (${this.formatFileSize(file.size)}) - OCR analysis available`;
    } else if (file.isText) {
      const _wordCount = file.content?.split(/\s+/).length || 0;
      return `Text file with ${_wordCount} words (${this.formatFileSize(file.size)})`;
    } else {
      return `${file.type.toUpperCase()} file (${this.formatFileSize(file.size)})`;
    }
  }

  private generateFileTags(file: DroppedFile): string[] {
    const _tags = [file.type.replace(".", "")];

    if (file.isImage) _tags.push("image", "visual");
    if (file.isText) _tags.push("text", "document");
    if (file.size > 1024 * 1024) _tags.push("large");

    return _tags;
  }

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

  private shortenSource(source: string): string {
    if (source.length <= 40) return source;
    if (source.startsWith("http")) {
      try {
        const _url = new URL(source);
        return `${_url.hostname}${_url.pathname}`;
      } catch {
        return source.substring(0, 40) + "...";
      }
    }
    return source.substring(0, 40) + "...";
  }

  private getTypeIcon(type: Reference["type"]): string {
    switch (type) {
      case "image":
        return "🖼️";
      case "file":
        return "📄";
      case "_url":
        return "🔗";
      case "text":
        return "📝";
      default:
        return "📎";
    }
  }

  private async fetchUrlInfo(_url: string): Promise<UrlInfo> {
    // Simplified URL info fetching - in a real implementation, this would fetch the actual page
    try {
      const _urlObj = new URL(_url);
      return {
        _title: `Resource from ${_urlObj.hostname}`,
        description: `Web _content from ${_url}`,
        domain: _urlObj.hostname,
        isAccessible: true,
        statusCode: 200,
      };
    } catch (_error) {
      return {
        _title: "Invalid URL",
        domain: "unknown",
        isAccessible: false,
      };
    }
  }

  private invalidateCache(): void {
    this.contextCache = null;
    this.cacheTimestamp = 0;
  }
}
