/**
 * InputBoxAdapter - Bridge between InputBox and EnhancedCLIInput
 * Connects the UI input component with the intelligent input processing system
 *
 * @since v3.4.2
 */

import { EventEmitter } from "node:events";
import { InputBox } from "./InputBox";
import { ExpandableInput } from "./ExpandableInput";
import type { FileDropEvent } from "./FileDropHandler";

export interface InputAttachment {
  kind: "file" | "directory" | "url" | "image" | "error-log";
  path: string;
  content?: string;
  metadata?: {
    size?: number;
    mimeType?: string;
    isError?: boolean;
  };
}

export interface InputPayload {
  raw: string;
  attachments: InputAttachment[];
  meta: {
    pasteDetected: boolean;
    modeHint: "command" | "error" | "natural" | "code";
    multiline: boolean;
    timestamp: number;
    stats?: {
      characters: number;
      lines: number;
      words: number;
    };
  };
}

export interface InputBoxAdapterOptions {
  placeholder?: string;
  promptSymbol?: string;
  enableExpandable?: boolean;
  minLines?: number;
  maxLines?: number;
}

/**
 * Adapter class that bridges InputBox UI with intelligent processing
 */
export class InputBoxAdapter extends EventEmitter {
  private inputBox: InputBox;
  private expandableInput: ExpandableInput | null = null;
  private options: Required<InputBoxAdapterOptions>;

  constructor(options: InputBoxAdapterOptions = {}) {
    super();

    this.options = {
      placeholder:
        options.placeholder ??
        "Type message, Shift+Enter for newline, drop files to attach...",
      promptSymbol: options.promptSymbol ?? ">",
      enableExpandable: options.enableExpandable ?? true,
      minLines: options.minLines ?? 1,
      maxLines: options.maxLines ?? 8,
    };

    // Initialize InputBox
    this.inputBox = new InputBox({
      placeholder: this.options.placeholder,
      promptSymbol: this.options.promptSymbol,
    });

    // Initialize ExpandableInput if enabled
    if (this.options.enableExpandable) {
      this.expandableInput = new ExpandableInput({
        minLines: this.options.minLines,
        maxLines: this.options.maxLines,
        autoExpand: true,
      });
    }
  }

  /**
   * Start a single input session
   * Returns a promise that resolves with the input payload
   */
  async prompt(): Promise<InputPayload> {
    try {
      // Get input from the UI
      const result = await this.inputBox.activate();

      // Process the input into a payload
      const payload = this.createPayload(result);

      // Emit events for different input types
      this.emitInputEvents(payload);

      return payload;
    } catch (error) {
      // Handle cancellation or errors
      if (error instanceof Error && error.message === "Input cancelled") {
        return this.createEmptyPayload();
      }
      throw error;
    }
  }

  /**
   * Create a payload from input result
   */
  private createPayload(input: string | any): InputPayload {
    // Handle string input (legacy)
    if (typeof input === "string") {
      return {
        raw: input,
        attachments: [],
        meta: {
          pasteDetected: false,
          modeHint: this.detectMode(input),
          multiline: input.includes("\n"),
          timestamp: Date.now(),
          stats: this.calculateStats(input),
        },
      };
    }

    // Handle structured input (from enhanced InputBox)
    const text = input.text || input || "";
    const attachments = this.processAttachments(input.attachments || []);

    return {
      raw: text,
      attachments,
      meta: {
        pasteDetected: input.pasteDetected || false,
        modeHint: this.detectMode(text, attachments),
        multiline: text.includes("\n"),
        timestamp: Date.now(),
        stats: this.calculateStats(text),
      },
    };
  }

  /**
   * Process attachments from various formats
   */
  private processAttachments(attachments: any[]): InputAttachment[] {
    if (!Array.isArray(attachments)) {
      return [];
    }

    return attachments.map((att) => {
      // Handle FileDropEvent format
      if (att.type && att.path) {
        return {
          kind: this.mapAttachmentType(att.type),
          path: att.path,
          content: att.content,
          metadata: {
            size: att.size,
            mimeType: att.mimeType,
            isError: this.isErrorFile(att.path, att.content),
          },
        };
      }

      // Handle simple path strings
      if (typeof att === "string") {
        return {
          kind: this.detectFileKind(att),
          path: att,
        };
      }

      // Default format
      return {
        kind: att.kind || "file",
        path: att.path || "",
        content: att.content,
        metadata: att.metadata,
      };
    });
  }

  /**
   * Detect the input mode based on content and attachments
   */
  private detectMode(
    text: string,
    attachments: InputAttachment[] = [],
  ): "command" | "error" | "natural" | "code" {
    const trimmed = text.trim();

    // Command mode - starts with slash
    if (trimmed.startsWith("/")) {
      return "command";
    }

    // Error mode - contains error patterns or error attachments
    if (
      this.containsErrorPatterns(trimmed) ||
      attachments.some((a) => a.metadata?.isError)
    ) {
      return "error";
    }

    // Code mode - looks like code
    if (this.looksLikeCode(trimmed)) {
      return "code";
    }

    // Default to natural language
    return "natural";
  }

  /**
   * Check if text contains error patterns
   */
  private containsErrorPatterns(text: string): boolean {
    const errorPatterns = [
      /TS\d{3,5}:/, // TypeScript errors
      /error TS\d+:/i,
      /^Error:/m, // Node errors
      /^TypeError:/m,
      /^ReferenceError:/m,
      /^SyntaxError:/m,
      /at .+:\d+:\d+/, // Stack traces
      /^\s*✗\s+/m, // Test failures
      /FAIL\s+\S+/,
      /\d+\s+failed/i,
      /ESLint.*error/i, // ESLint
      /\[\w+\/[\w-]+\]/, // ESLint rules
    ];

    return errorPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Check if text looks like code
   */
  private looksLikeCode(text: string): boolean {
    const codePatterns = [
      /^(import|export|const|let|var|function|class|interface|type)\s+/m,
      /^(if|for|while|switch)\s*\(/m,
      /=>\s*[{(]/,
      /\{\s*$/m,
      /^\s*}\s*$/m,
      /;$/m,
    ];

    const codeScore = codePatterns.filter((p) => p.test(text)).length;
    return codeScore >= 2;
  }

  /**
   * Calculate text statistics
   */
  private calculateStats(text: string): {
    characters: number;
    lines: number;
    words: number;
  } {
    const lines = text.split(/\r?\n/).length;
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    return {
      characters: text.length,
      lines,
      words,
    };
  }

  /**
   * Map attachment types
   */
  private mapAttachmentType(type: string): InputAttachment["kind"] {
    const typeMap: Record<string, InputAttachment["kind"]> = {
      file: "file",
      directory: "directory",
      url: "url",
      image: "image",
      _url: "url",
    };

    return typeMap[type] || "file";
  }

  /**
   * Detect file kind from path
   */
  private detectFileKind(path: string): InputAttachment["kind"] {
    const lower = path.toLowerCase();

    if (lower.startsWith("http://") || lower.startsWith("https://")) {
      return "url";
    }

    const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
    if (imageExts.some((ext) => lower.endsWith(ext))) {
      return "image";
    }

    const errorLogPatterns = [
      "error",
      "errors",
      "lint",
      "eslint",
      "test",
      "vitest",
      "jest",
      "build",
      "compile",
    ];
    if (errorLogPatterns.some((pattern) => lower.includes(pattern))) {
      return "error-log";
    }

    return "file";
  }

  /**
   * Check if file contains errors
   */
  private isErrorFile(path: string, content?: string): boolean {
    // Check path
    if (this.detectFileKind(path) === "error-log") {
      return true;
    }

    // Check content if available
    if (content) {
      return this.containsErrorPatterns(content);
    }

    return false;
  }

  /**
   * Create an empty payload for cancelled input
   */
  private createEmptyPayload(): InputPayload {
    return {
      raw: "",
      attachments: [],
      meta: {
        pasteDetected: false,
        modeHint: "natural",
        multiline: false,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Emit events based on input type
   */
  private emitInputEvents(payload: InputPayload): void {
    // Emit general input event
    this.emit("input", payload);

    // Emit mode-specific events
    switch (payload.meta.modeHint) {
      case "command":
        this.emit("command", payload);
        break;
      case "error":
        this.emit("error", payload);
        break;
      case "code":
        this.emit("code", payload);
        break;
      case "natural":
        this.emit("natural", payload);
        break;
    }

    // Emit attachment events
    if (payload.attachments.length > 0) {
      this.emit("attachments", payload.attachments);

      // Specific attachment type events
      for (const attachment of payload.attachments) {
        this.emit(`attachment:${attachment.kind}`, attachment);
      }
    }

    // Emit paste event
    if (payload.meta.pasteDetected) {
      this.emit("paste", payload);
    }

    // Emit multiline event
    if (payload.meta.multiline) {
      this.emit("multiline", payload);
    }
  }

  /**
   * Connect to an event bus (like EnhancedCLIInput)
   */
  connectTo(eventBus: EventEmitter): void {
    this.on("input", (payload) => {
      eventBus.emit("input", payload);
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<InputBoxAdapterOptions>): void {
    Object.assign(this.options, config);

    // Update expandable input if it exists
    if (this.expandableInput) {
      this.expandableInput.updateConfig({
        minLines: this.options.minLines,
        maxLines: this.options.maxLines,
      });
    }
  }

  /**
   * Clear input state
   */
  clear(): void {
    this.inputBox.clear();
    if (this.expandableInput) {
      this.expandableInput.reset();
    }
  }

  /**
   * Get current value
   */
  getValue(): string {
    return this.inputBox.getValue();
  }

  /**
   * Set input value
   */
  setValue(value: string): void {
    this.inputBox.setValue(value);
    if (this.expandableInput) {
      this.expandableInput.setValue(value);
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.removeAllListeners();
    this.inputBox.deactivate();
  }
}

export default InputBoxAdapter;
