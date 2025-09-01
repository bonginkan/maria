/**
 * ExpandableInput Component - Multi-line Input with Auto-expansion
 * Phase 1a Implementation for Enhanced Input Interface
 *
 * Features:
 * - Auto-expand based on content (1-8 lines)
 * - Line wrapping calculation
 * - Performance-optimized rendering
 *
 * @since v3.4.2
 */

export interface ExpandableInputConfig {
  minLines?: number; // Default: 1
  maxLines?: number; // Default: 8
  autoExpand?: boolean; // Default: true
  wrapAt?: number; // Default: terminal width - 4

  // Performance settings (Phase 3 enhancement)
  syntaxHighlight?: boolean; // Default: false (Phase 3)
  syntaxDebounceMs?: number; // Default: 150ms
  maxSyntaxChars?: number; // Default: 2000
  syntaxOnTyping?: boolean; // Default: false

  // Visual settings
  showLineNumbers?: boolean; // Default: false
  wrapLongLines?: boolean; // Default: true
}

export interface ExpandableMeasure {
  visibleLines: number; // Actual lines to display
  totalVisualLines: number; // Total lines including wrapping
  rows: string[]; // Wrapped text for display
  requiresScroll: boolean; // Whether scrolling is needed
}

export class ExpandableInput {
  private config: Required<ExpandableInputConfig>;
  private value: string = "";
  private cursorPosition: number = 0;
  private scrollOffset: number = 0;

  constructor(config: ExpandableInputConfig = {}) {
    const termWidth = process.stdout.columns || 80;
    const defaultWrapAt = Math.max(20, termWidth - 4);

    this.config = {
      minLines: config.minLines ?? 1,
      maxLines: config.maxLines ?? 8,
      autoExpand: config.autoExpand ?? true,
      wrapAt: config.wrapAt ?? defaultWrapAt,
      syntaxHighlight: config.syntaxHighlight ?? false,
      syntaxDebounceMs: config.syntaxDebounceMs ?? 150,
      maxSyntaxChars: config.maxSyntaxChars ?? 2000,
      syntaxOnTyping: config.syntaxOnTyping ?? false,
      showLineNumbers: config.showLineNumbers ?? false,
      wrapLongLines: config.wrapLongLines ?? true,
    };
  }

  /**
   * Set the input value
   */
  setValue(value: string): void {
    this.value = value ?? "";
  }

  /**
   * Get the current value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Append text to the current value
   */
  append(text: string): void {
    this.value += text;
  }

  /**
   * Insert text at cursor position
   */
  insertAtCursor(text: string): void {
    const before = this.value.slice(0, this.cursorPosition);
    const after = this.value.slice(this.cursorPosition);
    this.value = before + text + after;
    this.cursorPosition += text.length;
  }

  /**
   * Delete character at cursor (backspace)
   */
  deleteAtCursor(): void {
    if (this.cursorPosition > 0) {
      const before = this.value.slice(0, this.cursorPosition - 1);
      const after = this.value.slice(this.cursorPosition);
      this.value = before + after;
      this.cursorPosition--;
    }
  }

  /**
   * Delete character forward (delete key)
   */
  deleteForward(): void {
    if (this.cursorPosition < this.value.length) {
      const before = this.value.slice(0, this.cursorPosition);
      const after = this.value.slice(this.cursorPosition + 1);
      this.value = before + after;
    }
  }

  /**
   * Move cursor
   */
  moveCursor(position: number): void {
    this.cursorPosition = Math.max(0, Math.min(this.value.length, position));
  }

  /**
   * Move cursor relative to current position
   */
  moveCursorRelative(offset: number): void {
    this.moveCursor(this.cursorPosition + offset);
  }

  /**
   * Get cursor position
   */
  getCursorPosition(): number {
    return this.cursorPosition;
  }

  /**
   * Calculate display metrics with line wrapping
   */
  measure(): ExpandableMeasure {
    const hardLines = this.value.split(/\r?\n/);
    const rows: string[] = [];
    const wrapAt = Math.max(8, this.config.wrapAt);

    // Process each hard line break
    for (const line of hardLines) {
      if (line.length === 0) {
        rows.push("");
        continue;
      }

      if (this.config.wrapLongLines) {
        // Wrap long lines at terminal width
        for (let i = 0; i < line.length; i += wrapAt) {
          rows.push(line.slice(i, i + wrapAt));
        }
      } else {
        // Truncate long lines
        rows.push(line.slice(0, wrapAt));
      }
    }

    const totalLines = Math.max(1, rows.length);

    // Calculate visible lines based on auto-expand setting
    let visibleLines: number;
    if (this.config.autoExpand) {
      // Auto-expand between min and max
      visibleLines = Math.min(
        this.config.maxLines,
        Math.max(this.config.minLines, totalLines),
      );
    } else {
      // Fixed height
      visibleLines = this.config.minLines;
    }

    const requiresScroll = totalLines > visibleLines;

    return {
      visibleLines,
      totalVisualLines: totalLines,
      rows,
      requiresScroll,
    };
  }

  /**
   * Get visible rows for display (with scrolling support)
   */
  getVisibleRows(measure?: ExpandableMeasure): string[] {
    const m = measure || this.measure();

    if (!m.requiresScroll) {
      return m.rows.slice(0, m.visibleLines);
    }

    // Calculate scroll position based on cursor
    const cursorLine = this.getCursorLine();

    // Auto-scroll to keep cursor visible
    if (cursorLine < this.scrollOffset) {
      this.scrollOffset = cursorLine;
    } else if (cursorLine >= this.scrollOffset + m.visibleLines) {
      this.scrollOffset = cursorLine - m.visibleLines + 1;
    }

    return m.rows.slice(this.scrollOffset, this.scrollOffset + m.visibleLines);
  }

  /**
   * Get the line number where the cursor is
   */
  private getCursorLine(): number {
    const textBeforeCursor = this.value.slice(0, this.cursorPosition);
    const lines = textBeforeCursor.split(/\r?\n/);
    return lines.length - 1;
  }

  /**
   * Reset the input state
   */
  reset(): void {
    this.value = "";
    this.cursorPosition = 0;
    this.scrollOffset = 0;
  }

  /**
   * Check if input is empty
   */
  isEmpty(): boolean {
    return this.value.trim().length === 0;
  }

  /**
   * Get input statistics
   */
  getStats(): {
    characters: number;
    lines: number;
    words: number;
  } {
    const lines = this.value.split(/\r?\n/).length;
    const words = this.value
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    return {
      characters: this.value.length,
      lines,
      words,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ExpandableInputConfig>): void {
    Object.assign(this.config, config);

    // Recalculate wrap width if terminal resized
    if (config.wrapAt === undefined) {
      const termWidth = process.stdout.columns || 80;
      this.config.wrapAt = Math.max(20, termWidth - 4);
    }
  }

  /**
   * Check if syntax highlighting should be enabled
   * Based on performance settings
   */
  shouldHighlight(): boolean {
    if (!this.config.syntaxHighlight) {
      return false;
    }

    // Check character limit
    if (this.value.length > this.config.maxSyntaxChars) {
      return false;
    }

    return true;
  }

  /**
   * Format text with line numbers (if enabled)
   */
  formatWithLineNumbers(rows: string[]): string[] {
    if (!this.config.showLineNumbers) {
      return rows;
    }

    const maxLineNum = rows.length;
    const numWidth = String(maxLineNum).length;

    return rows.map((row, i) => {
      const lineNum = String(i + 1).padStart(numWidth, " ");
      return `${lineNum} │ ${row}`;
    });
  }

  /**
   * Export current state for persistence
   */
  export(): {
    value: string;
    cursorPosition: number;
    scrollOffset: number;
  } {
    return {
      value: this.value,
      cursorPosition: this.cursorPosition,
      scrollOffset: this.scrollOffset,
    };
  }

  /**
   * Import saved state
   */
  import(state: {
    value: string;
    cursorPosition?: number;
    scrollOffset?: number;
  }): void {
    this.value = state.value || "";
    this.cursorPosition = state.cursorPosition || 0;
    this.scrollOffset = state.scrollOffset || 0;
  }
}

export default ExpandableInput;
