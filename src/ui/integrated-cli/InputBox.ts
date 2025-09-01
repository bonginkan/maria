/**
 * InputBox Component - Clean Production Version
 * 完全にクリーンな実装 - デバッグ汚染なし
 *
 * This is the CANONICAL InputBox implementation for the entire application.
 * All other input box implementations should delegate to this class.
 *
 * @since v2.2.5 - Established as single source of truth
 */

import chalk from "chalk";
// import * as fs from 'fs';      // Commented out - unused after commenting out file drop methods
// import * as path from 'path';  // Commented out - unused after commenting out file drop methods
import { DESIGN_CONSTANTS } from "../optimized-design-system.js";
import {
  ResponsiveLayoutManager,
  truncateToWidth,
  padToWidth,
  visibleWidth,
  drawBoxLines,
} from "./responsive-width.js";
import {
  CommandAutocompleteUI,
  AutocompleteUIConfig,
} from "./CommandAutocompleteUI";

// Export for compatibility
export { CommandAutocompleteUI };
export type { AutocompleteUIConfig };

const _CHALK_BOX_CHARS = {
  TOP_LEFT: "┌",
  TOP_RIGHT: "┐",
  BOTTOM_LEFT: "└",
  BOTTOM_RIGHT: "┘",
  HORIZONTAL: "─",
  VERTICAL: "│",
  PROMPT: ">",
} as const;

// Remove global flag - we'll handle this per-instance

export interface InputBoxConfig {
  _width?: number;
  promptSymbol?: string;
  promptColor?: typeof chalk;
  borderColor?: typeof chalk;
  textColor?: typeof chalk;
  placeholder?: string;
  enablePasteDetection?: boolean;
  enableFileDrop?: boolean;
}

export class InputBox {
  private config: Required<
    InputBoxConfig & { enablePasteDetection: boolean; enableFileDrop: boolean }
  >;
  private currentInput: string = "";
  private isActive: boolean = false;
  private attachedFiles: string[] = [];
  private layoutManager: ResponsiveLayoutManager;
  private unsubscribe?: () => void;
  private currentWidth: number = 80;

  constructor(_config: InputBoxConfig = {}) {
    // Initialize layout manager for responsive width
    this.layoutManager = new ResponsiveLayoutManager({
      marginLeft: DESIGN_CONSTANTS.MARGIN_LEFT,
      marginRight: DESIGN_CONSTANTS.MARGIN_RIGHT,
      minWidth: DESIGN_CONSTANTS.CONTENT_MIN,
      maxWidth: DESIGN_CONSTANTS.CONTENT_MAX,
    });
    
    // Subscribe to width changes
    this.unsubscribe = this.layoutManager.subscribe((width) => {
      if (width !== this.currentWidth) {
        this.currentWidth = width;
        if (this.isActive) {
          this.clearBox();
          this.render(this.currentInput);
        }
      }
    });
    
    this.config = {
      _width: _config._width || this.currentWidth,
      promptSymbol: _config.promptSymbol || _CHALK_BOX_CHARS.PROMPT,
      promptColor: _config.promptColor || chalk.cyan,
      borderColor: _config.borderColor || chalk.white,
      textColor: _config.textColor || chalk.white,
      placeholder:
        _config.placeholder || "Type your command or question here...",
      enablePasteDetection: _config.enablePasteDetection ?? true,
      enableFileDrop: _config.enableFileDrop ?? true,
    };
  }

  render(value: string = ""): void {
    // Use responsive width if no fixed width specified
    const _width = this.config._width && this.config._width > 0 ? this.config._width : this.currentWidth;
    const _border = this.config.borderColor;
    const _prompt = this.config.promptColor;
    const _text = this.config.textColor;

    // Only clear the box area if already active (not on first render)
    if (this.isActive) {
      this.clearBox();
    }

    // Prepare input line content
    const _promptStr = ` ${this.config.promptSymbol} `;
    const _inputValue = value || this.currentInput;
    const _displayText = _inputValue || chalk.gray(this.config.placeholder);
    
    // Calculate available width for text (accounting for prompt and borders)
    const _innerWidth = Math.max(1, _width - 2);
    const _promptWidth = visibleWidth(_promptStr);
    const _maxTextWidth = Math.max(1, _innerWidth - _promptWidth - 1);
    
    // Truncate text using fullwidth-aware function
    const _truncatedText = truncateToWidth(_displayText, _maxTextWidth);
    
    // Build content lines
    const contentLines = [
      "",  // Empty line for padding
      _prompt(_promptStr) + _text(_truncatedText),  // Input line
      ""   // Empty line for padding
    ];
    
    // Pad each line to full width
    const paddedLines = contentLines.map(line => {
      const lineWidth = visibleWidth(line);
      const padding = Math.max(0, _innerWidth - lineWidth);
      return line + " ".repeat(padding);
    });
    
    // Draw the box
    const boxOutput = drawBoxLines(_width, paddedLines);
    
    process.stdout.write(boxOutput + "\n");
    this.isActive = true;
  }

  async activate(): Promise<string> {
    return new Promise((resolve) => {
      this.currentInput = "";
      this.render("");

      // Position cursor inside the box
      // Move cursor up 3 lines and to column 4 (after the _prompt symbol)
      process.stdout.write("\u001b[3A\u001b[4G");

      // Set up paste detection if enabled
      if (this.config.enablePasteDetection) {
        this.setupPasteDetection();
      }

      // Handle key input for visual feedback
      let buffer = "";
      const _keypressHandler = (_chunk: unknown, key: unknown) => {
        if (!key) return;

        if (key.name === "return" || key.name === "enter") {
          // Submit the input
          this.currentInput = buffer;
          this.finishInput();
          // Clean up
          process.stdin.removeListener("keypress", _keypressHandler);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          resolve(this.currentInput);
        } else if (key.name === "backspace") {
          // Remove last character
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            // Clear current character and move back
            process.stdout.write("\b \b");
          }
        } else if (key.ctrl && key.name === "c") {
          // Handle Ctrl+C - exit the application
          console.log("\n\n👋 Goodbye!");
          process.exit(0);
        } else if (
          key.sequence &&
          key.sequence.length === 1 &&
          !key.ctrl &&
          !key.meta
        ) {
          // Regular character input
          buffer += key.sequence;
          process.stdout.write(key.sequence);
        }
      };

      // Enable keypress events with proper cleanup to prevent duplication
      if (process.stdin.isTTY) {
        // CRITICAL: Remove ALL existing listeners to prevent input duplication
        process.stdin.removeAllListeners("keypress");
        process.stdin.removeAllListeners("data");

        // Set raw mode for direct key handling
        process.stdin.setRawMode(true);

        // Always setup keypress events - they need to be initialized for each session
        require("readline").emitKeypressEvents(process.stdin);
      }

      // Add our handler directly (no once/re-add pattern to avoid issues)
      process.stdin.on("keypress", _keypressHandler);
    });
  }

  deactivate(): void {
    if (!this.isActive) return;

    // Restore terminal mode
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    // Remove all keypress listeners
    process.stdin.removeAllListeners("keypress");
    
    // Unsubscribe from layout manager
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    this.isActive = false;
    this.currentInput = "";
    process.stdout.write("\n");
  }

  private clearBox(): void {
    for (let i = 0; i < 5; i++) {
      process.stdout.write("\u001b[1A\u001b[2K\r");
    }
  }

  private stripAnsi(str: string): string {
    // Use the more robust stripAnsi from responsive-width module
    return str.replace(/\u001b\[[0-9;]*m/g, "");
  }

  private finishInput(): void {
    process.stdout.write("\u001b[2B\u001b[1G\n");
    this.deactivate();
  }

  getValue(): string {
    return this.currentInput;
  }

  clear(): void {
    this.currentInput = "";
    if (this.isActive) {
      this.render("");
    }
  }

  setValue(value: string): void {
    this.currentInput = value;
    if (this.isActive) {
      this.render(value);
    }
  }

  getContextWithReferences(): string {
    // Return attached files and images as context
    if (this.attachedFiles.length > 0) {
      return `\n\nAttached files:\n${this.attachedFiles.map((f) => `- ${f}`).join("\n")}`;
    }
    return "";
  }

  /**
   * Get attached files list
   */
  getAttachedFiles(): string[] {
    return this.attachedFiles;
  }

  /**
   * Clear attached files
   */
  clearAttachedFiles(): void {
    this.attachedFiles = [];
  }

  /**
   * Set up paste detection mechanism
   */
  private setupPasteDetection(): void {
    // Currently not used - kept for future implementation
  }

  /**
   * Detect and process files immediately when pasted
   * @internal Currently not used but kept for future file drop support
   */
  /* // Commented out to fix TypeScript build - uncomment when needed
  private async _detectAndProcessFiles(input: string): Promise<void> {
    if (!this.config.enableFileDrop) return;
    
    const _trimmedInput = _input.trim();
    
    // Check if entire input looks like a file path
    if (this.looksLikeFilePath(trimmedInput)) {
      // Validate and process the file
      const _resolvedPath = this.resolveFilePath(trimmedInput);
      if (fs.existsSync(resolvedPath)) {
        const _stats = fs.statSync(resolvedPath);
        const _fileName = path.basename(resolvedPath);
        const _isImage = this.isImageFile(resolvedPath);
        
        // Add to attached files
        if (!this.attachedFiles.includes(resolvedPath)) {
          this.attachedFiles.push(resolvedPath);
        }
        
        // Clear current line and show indicator
        process.stdout.write('\r\u001b[K'); // Clear current line
        
        // Show appropriate indicator
        if (isImage) {
          const _sizeKB = Math.round(stats.size / 1024);
          console.log(chalk.green(`\n🖼️  Image attached: ${fileName} (${sizeKB}KB)`));
          console.log(chalk.gray(`Path: ${resolvedPath}`));
        } else {
          const _sizeKB = Math.round(stats.size / 1024);
          console.log(chalk.blue(`\n📎 File attached: ${fileName} (${sizeKB}KB)`));
          console.log(chalk.gray(`Path: ${resolvedPath}`));
        }
        
        // Update current input to include the file path
        this.currentInput = resolvedPath;
      } else {
        // File doesn't exist, just use the input as is
        this.currentInput = trimmedInput;
      }
    }
  }
  */

  // Commented out to fix TypeScript build - uncomment when needed for file drop support
  /*
  private looksLikeFilePath(input: string): boolean {
    // Remove quotes if present
    const _cleaned = input.replace(/["']/g, '').trim();
    
    // Check for common path patterns
    return (
      cleaned.startsWith('/') || // Unix absolute path
      cleaned.startsWith('~/') || // Home directory
      cleaned.startsWith('./') || // Relative path
      cleaned.startsWith('../') || // Parent directory
      /^[A-Za-z]:[/\\]/.test(cleaned) || // Windows path
      // Check for file extensions
      /\.[a-zA-Z0-9]{1,5}$/.test(cleaned)
    );
  }
  
  private resolveFilePath(_filePath: string): string {
    // Remove quotes
    let resolved = filePath.replace(/["']/g, '').trim();
    
    // Expand home directory
    if (resolved.startsWith('~')) {
      resolved = path.join(process.env['HOME'] || '', resolved.slice(1));
    }
    
    // Resolve to absolute path
    if (!path.isAbsolute(resolved)) {
      resolved = path.resolve(resolved);
    }
    
    return resolved;
  }
  
  private isImageFile(_filePath: string): boolean {
    const _ext = path.extname(_filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'].includes(ext);
  }
  */

  /**
   * Process pasted content and format it
   * @internal Currently not used but kept for future paste support
   */
  /* // Commented out to fix TypeScript build - uncomment when needed
  private _processPastedContent(content: string): string {
    const _lines = _content.split('\n').filter(line => line.trim());
    
    if (lines.length > 1) {
      // For multiline paste, join with preserved newlines
      return lines.join('\n');
    }
    
    return _content.trim();
  }
  */
}

export default InputBox;
