/**
 * Interactive CLI with real-time autocomplete
 * リアルタイム自動補完機能付きインタラクティブCLI
 */

import * as readline from "node:readline";
import chalk from "chalk";
import { commandInfo } from "../lib/command-groups";
import { AutocompleteDropdown } from "./autocomplete-dropdown";
import { DEFAULT_UI_CONFIG } from "../config/defaults";
import fs from "fs/promises";
import path from "path";
import os from "os";

export interface AutocompleteOptions {
  maxSuggestions?: number;
  minQueryLength?: number;
}

export class InteractiveCLI {
  private rl: readline.Interface;
  private currentInput = "";
  private cursorPosition = 0;
  private suggestions: Array<{ name: string; description: string }> = [];
  private selectedIndex = 0;
  private isShowingSuggestions = false;
  private previousSuggestionsCount = 0;
  private options: Required<AutocompleteOptions>;
  private dropdown: AutocompleteDropdown;
  private overlaysSuspended = false; // Added: suspend overlays during /code execution
  private isWaitingForInput = false; // Added: prevent duplicate enter handling

  constructor(options: AutocompleteOptions = {}) {
    this.options = {
      maxSuggestions: options.maxSuggestions || 5, // Reduced for cleaner display
      minQueryLength: options.minQueryLength || 2,
    };

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    this.dropdown = new AutocompleteDropdown();

    // Enable keypress events
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, this.rl);

    this.setupKeyHandlers();
  }

  /**
   * Get all available slash commands dynamically
   */
  private getAllCommands(): Array<{ name: string; description: string }> {
    return Object.values(commandInfo).map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
    }));
  }

  /**
   * Suspend all UI overlays (for clean output during /code execution)
   */
  public suspendOverlays(): void {
    this.overlaysSuspended = true;
    this.dropdown.hide();
    this.isShowingSuggestions = false;
    this.suggestions = [];
  }

  /**
   * Resume UI overlays after clean output
   */
  public resumeOverlays(): void {
    this.overlaysSuspended = false;
  }

  /**
   * Execute a function with suspended overlays
   */
  public async withSuspendedOverlays<T>(fn: () => Promise<T>): Promise<T> {
    this.suspendOverlays();
    try {
      return await fn();
    } finally {
      this.resumeOverlays();
    }
  }

  /**
   * Get current slash command suggestions setting
   */
  private async getSuggestionsSetting(): Promise<boolean> {
    try {
      const config = await this.loadConfiguration();
      return config.enableSlashCommandSuggestions !== false;
    } catch {
      return DEFAULT_UI_CONFIG.enableSlashCommandSuggestions;
    }
  }

  /**
   * Load user configuration
   */
  private async loadConfiguration(): Promise<any> {
    try {
      const configPath = path.join(os.homedir(), '.maria', 'config.json');
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /**
   * Get autocomplete suggestions for current input
   * スラッシュ(/)のみの場合は候補を表示しない(2文字以上必要)
   */
  private async getAutocompleteSuggestions(
    input: string,
  ): Promise<Array<{ name: string; description: string }>> {
    // Don't show suggestions if overlays are suspended or suggestions are disabled
    if (this.overlaysSuspended || !(await this.getSuggestionsSetting())) {
      return [];
    }
    
    // スラッシュで始まり、かつ2文字以上の場合のみ候補を返す
    if (!input.startsWith("/") || input.length < this.options.minQueryLength) {
      return [];
    }

    const query = input.toLowerCase();
    return this.getAllCommands()
      .filter((cmd) => cmd.name.toLowerCase().startsWith(query))
      .sort((a, b) => a.name.localeCompare(b.name)) // アルファベット順にソート
      .slice(0, this.options.maxSuggestions);
  }

  /**
   * Setup keyboard event handlers
   */
  private setupKeyHandlers(): void {
    process.stdin.on("keypress", (str: string, key: readline.Key) => {
      if (key && key.ctrl && key.name === "c") {
        this.cleanup();
        process.exit(0);
      }

      if (key && key.name === "return") {
        // Skip handling if we're waiting for input (prevent duplicate processing)
        if (!this.isWaitingForInput) {
          this.handleEnter();
        }
        return;
      }

      if (key && key.name === "tab") {
        this.handleTab();
        return;
      }

      if (key && key.name === "escape") {
        this.handleEscape();
        return;
      }

      if (key && key.name === "up") {
        this.handleUp();
        return;
      }

      if (key && key.name === "down") {
        this.handleDown();
        return;
      }

      if (key && key.name === "backspace") {
        this.handleBackspace();
        return;
      }

      if (key && key.name === "left") {
        this.moveCursorLeft();
        return;
      }

      if (key && key.name === "right") {
        this.moveCursorRight();
        return;
      }

      // Handle regular character input
      if (str && !key.ctrl && !key.meta) {
        this.handleCharacter(str);
      }
    });
  }

  /**
   * Handle character input
   */
  private handleCharacter(char: string): void {
    this.currentInput =
      this.currentInput.slice(0, this.cursorPosition) +
      char +
      this.currentInput.slice(this.cursorPosition);
    this.cursorPosition++;
    void this.updateSuggestions();
    this.render();
  }

  /**
   * Handle backspace key
   */
  private handleBackspace(): void {
    if (this.cursorPosition > 0) {
      this.currentInput =
        this.currentInput.slice(0, this.cursorPosition - 1) +
        this.currentInput.slice(this.cursorPosition);
      this.cursorPosition--;
      void this.updateSuggestions();
      this.render();
    }
  }

  /**
   * Handle enter key
   */
  private handleEnter(): void {
    if (this.dropdown.isShown()) {
      // Apply selected suggestion
      const selected = this.dropdown.getSelected();
      if (selected) {
        this.currentInput = selected.name + " ";
        this.cursorPosition = this.currentInput.length;
        this.dropdown.hide();
        this.isShowingSuggestions = false;
        this.suggestions = [];
        this.render();
      }
    } else {
      // Submit input
      this.submitInput();
    }
  }

  /**
   * Handle tab key for autocomplete
   */
  private handleTab(): void {
    if (this.dropdown.isShown()) {
      const selected = this.dropdown.getSelected();
      if (selected) {
        this.currentInput = selected.name + " ";
        this.cursorPosition = this.currentInput.length;
        this.dropdown.hide();
        this.isShowingSuggestions = false;
        this.suggestions = [];
        this.render();
      }
    } else if (this.currentInput.startsWith("/")) {
      // Try to show suggestions
      void this.updateSuggestions();
    }
  }

  /**
   * Handle escape key
   */
  private handleEscape(): void {
    if (this.dropdown.isShown()) {
      this.dropdown.hide();
      this.isShowingSuggestions = false;
      this.suggestions = [];
      // Just update cursor position without re-rendering
      const promptLength = 2; // "> " is 2 characters
      readline.cursorTo(process.stdout, this.cursorPosition + promptLength);
    } else {
      // Clear input
      this.currentInput = "";
      this.cursorPosition = 0;
      this.render();
    }
  }

  /**
   * Handle up arrow key
   */
  private handleUp(): void {
    if (this.dropdown.isShown()) {
      this.dropdown.selectPrevious();
    }
  }

  /**
   * Handle down arrow key
   */
  private handleDown(): void {
    if (this.dropdown.isShown()) {
      this.dropdown.selectNext();
    }
  }

  /**
   * Move cursor left
   */
  private moveCursorLeft(): void {
    if (this.cursorPosition > 0) {
      this.cursorPosition--;
      this.render();
    }
  }

  /**
   * Move cursor right
   */
  private moveCursorRight(): void {
    if (this.cursorPosition < this.currentInput.length) {
      this.cursorPosition++;
      this.render();
    }
  }

  /**
   * Update autocomplete suggestions
   */
  private async updateSuggestions(): Promise<void> {
    // Don't update suggestions if overlays are suspended
    if (this.overlaysSuspended) {
      this.dropdown.hide();
      this.isShowingSuggestions = false;
      this.suggestions = [];
      return;
    }
    
    if (this.currentInput.startsWith("/")) {
      this.suggestions = await this.getAutocompleteSuggestions(this.currentInput);
      if (this.suggestions.length > 0) {
        this.dropdown.show(this.suggestions);
        this.isShowingSuggestions = true;
      } else {
        this.dropdown.hide();
        this.isShowingSuggestions = false;
      }
    } else {
      this.dropdown.hide();
      this.isShowingSuggestions = false;
      this.suggestions = [];
    }
  }

  /**
   * Render the current state
   */
  private render(): void {
    // Don't render if overlays are suspended
    if (this.overlaysSuspended) {
      return;
    }
    
    // Clear current input line
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);

    // Render prompt and input
    const prompt = chalk.cyan("> ");
    const displayInput = this.currentInput;
    process.stdout.write(prompt + displayInput);

    // Position cursor at the correct position in input line
    // The cursor position should be calculated based on the actual displayed characters
    const promptLength = 2; // "> " is 2 characters (without ANSI color codes)
    const actualCursorPos = promptLength + this.cursorPosition;
    readline.cursorTo(process.stdout, actualCursorPos);

    // Update suggestions (dropdown handles its own rendering)
    void this.updateSuggestions();
  }

  /**
   * Update only the selection indicator without redrawing the entire box
   */
  private updateSelectionOnly(): void {
    if (!this.isShowingSuggestions || this.suggestions.length === 0) {
      return;
    }

    const promptLength = 2; // "> " is 2 characters
    const savedX = this.cursorPosition + promptLength;

    // Move cursor down to the suggestion list area (skip input line and box header)
    readline.moveCursor(process.stdout, 0, 2); // Move past input line and box top border

    // Update each suggestion line
    this.suggestions.forEach((suggestion, index) => {
      const isSelected = index === this.selectedIndex;
      const prefix = isSelected ? chalk.cyan("► ") : "  ";
      const nameStyle = isSelected ? chalk.inverse.white : chalk.white;
      const descStyle = isSelected ? chalk.inverse.gray : chalk.gray;

      const name = suggestion.name.padEnd(15);
      const desc =
        suggestion.description.length > 40
          ? suggestion.description.substring(0, 37) + "..."
          : suggestion.description;

      // Clear current line and redraw
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
      process.stdout.write(`${prefix}${nameStyle(name)} ${descStyle(desc)}`);

      // Move to next line if not at the last suggestion
      if (index < this.suggestions.length - 1) {
        readline.moveCursor(process.stdout, 0, 1);
      }
    });

    // Move cursor back to input line position
    const linesToMoveUp = this.suggestions.length + 1; // +1 because we're at the last suggestion line
    readline.moveCursor(process.stdout, 0, -linesToMoveUp);
    readline.cursorTo(process.stdout, savedX);
  }

  /**
   * Render autocomplete suggestions - downward only
   */
  private renderSuggestionsDownward(): void {
    // Save cursor position to restore later
    const promptLength = 2; // "> " is 2 characters
    const savedX = this.cursorPosition + promptLength;

    // Move to next line below input
    process.stdout.write("\n");

    // Draw top border of suggestions box
    process.stdout.write(chalk.white("╭──── Command Suggestions ────╮\n"));

    // Render each suggestion
    this.suggestions.forEach((suggestion, index) => {
      const isSelected = index === this.selectedIndex;
      const prefix = isSelected ? chalk.cyan("► ") : "  ";
      const nameStyle = isSelected ? chalk.inverse.white : chalk.white;
      const descStyle = isSelected ? chalk.inverse.gray : chalk.gray;

      const name = suggestion.name.padEnd(15);
      const desc =
        suggestion.description.length > 40
          ? suggestion.description.substring(0, 37) + "..."
          : suggestion.description;

      process.stdout.write(`${prefix}${nameStyle(name)} ${descStyle(desc)}\n`);
    });

    // Draw bottom border
    process.stdout.write(chalk.white("╰─────────────────────────────╯\n"));

    // Add help text
    process.stdout.write(
      chalk.dim("↑/↓: Navigate • Tab/Enter: Select • Esc: Cancel"),
    );

    // Move cursor back to input line
    const totalLines = this.suggestions.length + 4; // +4 for borders and help text
    readline.moveCursor(process.stdout, 0, -totalLines);
    readline.cursorTo(process.stdout, savedX);
  }

  /**
   * Render autocomplete suggestions (legacy method - redirects to downward)
   */
  private renderSuggestions(): void {
    this.renderSuggestionsDownward();
  }

  /**
   * Submit the current input
   */
  private submitInput(): void {
    const input = this.currentInput.trim();

    // Hide dropdown if showing
    if (this.dropdown.isShown()) {
      this.dropdown.hide();
    }

    // Move to new line
    process.stdout.write("\n");

    // Emit input event
    this.rl.emit("line", input);

    // Reset state
    this.currentInput = "";
    this.cursorPosition = 0;
    this.isShowingSuggestions = false;
    this.suggestions = [];
    this.selectedIndex = 0;
    this.previousSuggestionsCount = 0;

    // Clear the input display after submission
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
  }

  /**
   * Get user input with autocomplete
   */
  public async question(prompt: string): Promise<string> {
    // Reset state before getting new input
    this.currentInput = "";
    this.cursorPosition = 0;
    this.suggestions = [];
    this.selectedIndex = 0;
    this.isShowingSuggestions = false;
    this.isWaitingForInput = true; // Set flag to prevent duplicate handling

    // Display initial prompt
    process.stdout.write(prompt);

    return new Promise((resolve) => {
      const handler = (input: string) => {
        this.rl.removeListener("line", handler);
        this.isWaitingForInput = false; // Clear flag
        resolve(input);
      };

      this.rl.on("line", handler);
    });
  }

  /**
   * Display prompt
   */
  public prompt(): void {
    // Ensure clean state before rendering prompt
    this.currentInput = "";
    this.cursorPosition = 0;
    this.render();
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // Hide dropdown if showing
    if (this.dropdown && this.dropdown.isShown()) {
      this.dropdown.hide();
    }

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    this.rl.close();
  }

  /**
   * Get readline interface
   */
  public getInterface(): readline.Interface {
    return this.rl;
  }
}
