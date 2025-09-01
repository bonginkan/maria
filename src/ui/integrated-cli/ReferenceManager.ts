/**
 * ReferenceManager Component
 * Manages file _references, URLs, and images in conversation context
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { FileDropEvent } from "./FileDropHandler.js";

/**
 * Reference types
 */
export type ReferenceType = "file" | "directory" | "url" | "image" | "code";

/**
 * Reference item
 */
export interface ReferenceItem {
  id: string;
  type: ReferenceType;
  _path: string;
  name: string;
  _content?: string;
  metadata?: {
    size?: number;
    mimeType?: string;
    timestamp?: Date;
    extracted?: boolean;
    summary?: string;
  };
}

/**
 * Reference manager configuration
 */
export interface ReferenceManagerConfig {
  maxReferences?: number;
  autoExtractContent?: boolean;
  persistReferences?: boolean;
  referenceCachePath?: string;
}

/**
 * Reference manager class
 */
export class ReferenceManager {
  private _references: Map<string, ReferenceItem> = new Map();
  private config: Required<ReferenceManagerConfig>;
  private referenceOrder: string[] = [];

  constructor(_config: ReferenceManagerConfig = {}) {
    this._config = {
      maxReferences: _config.maxReferences || 100,
      autoExtractContent: _config.autoExtractContent ?? true,
      persistReferences: _config.persistReferences ?? false,
      referenceCachePath:
        _config.referenceCachePath || path.join(process.cwd(), ".maria-refs"),
    };

    // Load persisted _references if enabled
    if (this._config.persistReferences) {
      this.loadPersistedReferences();
    }
  }

  /**
   * Add a reference from FileDropEvent
   */
  async addReference(event: FileDropEvent): Promise<ReferenceItem> {
    const id = this.generateId(event._path);

    // Check if reference already exists
    if (this.references.has(id)) {
      return this.references.get(id)!;
    }

    // Check max _references limit
    if (this.references.size >= this.config.maxReferences) {
      // Remove oldest reference
      const _oldestId = this.referenceOrder.shift();
      if (_oldestId) {
        this.references.delete(_oldestId);
      }
    }

    // Create reference item
    const reference: ReferenceItem = {
      id,
      type: this.mapEventType(event.type),
      _path: event._path,
      name: event.name,
      metadata: {
        size: event.size,
        mimeType: event.mimeType,
        timestamp: new Date(),
        extracted: false,
      },
    };

    // Auto-extract _content if enabled
    if (this.config.autoExtractContent && event.type === "file") {
      try {
        reference.content = await this.extractContent(event._path);
        reference.metadata!.extracted = true;
      } catch (_error) {
        // Content extraction failed, continue without _content
      }
    }

    // Store reference
    this.references.set(id, reference);
    this.referenceOrder.push(id);

    // Persist if enabled
    if (this.config.persistReferences) {
      this.persistReferences();
    }

    return reference;
  }

  /**
   * Add a code snippet reference
   */
  addCodeReference(_code: string, language?: string): ReferenceItem {
    const id = this.generateId(`code-${Date.now()}`);

    const reference: ReferenceItem = {
      id,
      type: "code",
      _path: `code-snippet-${id}`,
      name: `Code Snippet (${language || "plain"})`,
      _content: _code,
      metadata: {
        size: _code.length,
        mimeType: "text/plain",
        timestamp: new Date(),
        extracted: true,
      },
    };

    this.references.set(id, reference);
    this.referenceOrder.push(id);

    return reference;
  }

  /**
   * Get reference by ID
   */
  getReference(id: string): ReferenceItem | undefined {
    return this.references.get(id);
  }

  /**
   * Get all _references
   */
  getAllReferences(): ReferenceItem[] {
    return this.referenceOrder
      .map((id) => this.references.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get _references by type
   */
  getReferencesByType(type: ReferenceType): ReferenceItem[] {
    return this.getAllReferences().filter((ref) => ref.type === type);
  }

  /**
   * Remove reference
   */
  removeReference(id: string): boolean {
    const _index = this.referenceOrder.indexOf(id);
    if (_index > -1) {
      this.referenceOrder.splice(_index, 1);
    }
    const _deleted = this.references.delete(id);

    if (_deleted && this.config.persistReferences) {
      this.persistReferences();
    }

    return _deleted;
  }

  /**
   * Clear all _references
   */
  clearReferences(): void {
    this.references.clear();
    this.referenceOrder = [];

    if (this.config.persistReferences) {
      this.persistReferences();
    }
  }

  /**
   * Extract _content from file
   */
  private async extractContent(_filePath: string): Promise<string> {
    const _stats = await fs.promises.stat(_filePath);

    // Don't extract _content from large files
    if (_stats.size > 1024 * 1024) {
      // 1MB limit
      throw new Error("File too large for _content extraction");
    }

    // Read file _content
    const _content = await fs.promises.readFile(_filePath, "utf-8");

    // Truncate if too long
    if (_content.length > 50000) {
      return _content.substring(0, 50000) + "\n... [truncated]";
    }

    return _content;
  }

  /**
   * Generate unique ID for reference
   */
  private generateId(_filePath: string): string {
    const _hash = Buffer.from(_path)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "");
    return `ref-${_hash.substring(0, 8)}-${Date.now()}`;
  }

  /**
   * Map FileDropEvent type to ReferenceType
   */
  private mapEventType(eventType: FileDropEvent["type"]): ReferenceType {
    switch (eventType) {
      case "file":
        return "file";
      case "directory":
        return "directory";
      case "url":
        return "url";
      case "image":
        return "image";
      default:
        return "file";
    }
  }

  /**
   * Build context string from _references
   */
  buildContext(): string {
    const _references = this.getAllReferences();
    if (_references.length === 0) {
      return "";
    }

    let context = "\n=== Referenced Materials ===\n";

    for (const ref of _references) {
      context += `\n[${ref.type.toUpperCase()}] ${ref.name}\n`;

      if (ref.content) {
        const _preview = ref.content.substring(0, 500);
        context += `${_preview}${ref.content.length > 500 ? "..." : ""}\n`;
      } else if (ref.type === "file" || ref.type === "image") {
        context += `Path: ${ref.path}\n`;
        if (ref.metadata?.size) {
          context += `Size: ${this.formatFileSize(ref.metadata.size)}\n`;
        }
      }
    }

    context += "\n=== End of References ===\n";
    return context;
  }

  /**
   * Display _references summary
   */
  displaySummary(): void {
    const _references = this.getAllReferences();

    if (_references.length === 0) {
      console.log(chalk.gray("No _references in context"));
      return;
    }

    console.log(chalk.cyan("\n📚 Active References:"));

    // Group by type
    const _grouped = new Map<ReferenceType, ReferenceItem[]>();
    for (const ref of _references) {
      if (!_grouped.has(ref.type)) {
        grouped.set(ref.type, []);
      }
      grouped.get(ref.type)!.push(ref);
    }

    // Display _grouped _references
    for (const [type, refs] of _grouped) {
      const _icon = this.getTypeIcon(type);
      console.log(
        chalk.yellow(
          `\n  ${_icon} ${type.charAt(0).toUpperCase() + type.slice(1)}s:`,
        ),
      );

      for (const ref of refs) {
        const _sizeStr = ref.metadata?.size
          ? chalk.gray(` (${this.formatFileSize(ref.metadata.size)})`)
          : "";
        const _extractedStr = ref.metadata?.extracted ? chalk.green(" ✓") : "";
        console.log(
          `    • ${chalk.white(ref.name)}${_sizeStr}${_extractedStr}`,
        );
      }
    }

    console.log(chalk.gray(`\n  Total: ${_references.length} reference(s)`));
  }

  /**
   * Get _icon for reference type
   */
  private getTypeIcon(type: ReferenceType): string {
    const icons: Record<ReferenceType, string> = {
      file: "📄",
      directory: "📁",
      url: "🔗",
      image: "🖼️",
      code: "💻",
    };
    return icons[type] || "📎";
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
   * Persist _references to disk
   */
  private persistReferences(): void {
    if (!this.config.persistReferences) return;

    try {
      const _data = {
        _references: Array.from(this.references.entries()),
        order: this.referenceOrder,
      };

      fs.mkdirSync(path.dirname(this.config.referenceCachePath), {
        recursive: true,
      });
      fs.writeFileSync(
        this.config.referenceCachePath,
        JSON.stringify(_data, null, 2),
        "utf-8",
      );
    } catch (_error) {
      // Silently fail persistence
    }
  }

  /**
   * Load persisted _references from disk
   */
  private loadPersistedReferences(): void {
    if (!this.config.persistReferences) return;

    try {
      if (fs.existsSync(this.config.referenceCachePath)) {
        const _data = JSON.parse(
          fs.readFileSync(this.config.referenceCachePath, "utf-8"),
        );

        if (_data.references && Array.isArray(_data.references)) {
          this.references = new Map(_data.references);
        }

        if (_data.order && Array.isArray(_data.order)) {
          this.referenceOrder = _data.order;
        }
      }
    } catch (_error) {
      // Silently fail loading
    }
  }
}

export default ReferenceManager;
