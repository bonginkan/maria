/**
 * Stable Autocomplete Dropdown UI
 * Provides a consistent dropdown experience that always expands downward
 */

import * as readline from "readline";
import chalk from "chalk";

export interface SuggestionItem {
  name: string;
  description: string;
}

export class AutocompleteDropdown {
  private suggestions: SuggestionItem[] = [];
  private selectedIndex = 0;
  private isVisible = false;
  private maxVisible = 5; // Maximum visible items
  private dropdownStartLine = 0;

  /**
   * Show suggestions below the input line
   */
  show(suggestions: SuggestionItem[]): void {
    if (suggestions.length === 0) {
      this.hide();
      return;
    }

    this.suggestions = suggestions.slice(0, this.maxVisible);
    this.selectedIndex = 0;

    if (!this.isVisible) {
      // First time showing - reserve space
      this.reserveSpace();
      this.isVisible = true;
    }

    this.render();
  }

  /**
   * Hide the dropdown
   */
  hide(): void {
    if (this.isVisible) {
      this.clearDropdown();
      this.isVisible = false;
      this.suggestions = [];
      this.selectedIndex = 0;
    }
  }

  /**
   * Move selection up
   */
  selectPrevious(): void {
    if (this.suggestions.length === 0) return;
    this.selectedIndex =
      this.selectedIndex > 0
        ? this.selectedIndex - 1
        : this.suggestions.length - 1;
    this.render();
  }

  /**
   * Move selection down
   */
  selectNext(): void {
    if (this.suggestions.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
    this.render();
  }

  /**
   * Get currently selected suggestion
   */
  getSelected(): SuggestionItem | null {
    if (!this.isVisible || this.suggestions.length === 0) {
      return null;
    }
    return this.suggestions[this.selectedIndex];
  }

  /**
   * Reserve space for dropdown
   */
  private reserveSpace(): void {
    // Save cursor position
    process.stdout.write("\x1b[s");

    // Move down and reserve lines for dropdown
    process.stdout.write("\n");
    const linesToReserve =
      Math.min(this.suggestions.length, this.maxVisible) + 2; // +2 for borders

    for (let i = 0; i < linesToReserve; i++) {
      process.stdout.write("\x1b[K\n"); // Clear line and move down
    }

    // Move back up to saved position
    process.stdout.write("\x1b[u");
  }

  /**
   * Render the dropdown
   */
  private render(): void {
    if (!this.isVisible || this.suggestions.length === 0) return;

    // Save current cursor position
    process.stdout.write("\x1b[s");

    // Move to dropdown area (one line below input)
    process.stdout.write("\n");

    // Clear and draw top border
    process.stdout.write(
      "\x1b[K" +
        chalk.white(
          "┌─ Suggestions ─────────────────────────────────────────┐",
        ) +
        "\n",
    );

    // Render suggestions
    this.suggestions.forEach((suggestion, index) => {
      const isSelected = index === this.selectedIndex;
      const prefix = isSelected ? chalk.cyan("► ") : "  ";
      const nameStyle = isSelected ? chalk.inverse : (s: string) => s;

      const displayName = suggestion.name.padEnd(20);
      const displayDesc =
        suggestion.description.length > 30
          ? suggestion.description.substring(0, 27) + "..."
          : suggestion.description.padEnd(30);

      const line = `│${prefix}${nameStyle(chalk.white(displayName) + " " + chalk.gray(displayDesc))}  │`;
      process.stdout.write("\x1b[K" + line + "\n");
    });

    // Draw bottom border
    process.stdout.write(
      "\x1b[K" +
        chalk.white(
          "└───────────────────────────────────────────────────────┘",
        ) +
        "\n",
    );

    // Restore cursor position
    process.stdout.write("\x1b[u");
  }

  /**
   * Clear the dropdown display
   */
  private clearDropdown(): void {
    if (!this.isVisible) return;

    // Save cursor position
    process.stdout.write("\x1b[s");

    // Move to dropdown area and clear
    process.stdout.write("\n");
    const linesToClear = Math.min(this.suggestions.length, this.maxVisible) + 3; // +3 for borders and extra line

    for (let i = 0; i < linesToClear; i++) {
      process.stdout.write("\x1b[K"); // Clear line
      if (i < linesToClear - 1) {
        process.stdout.write("\n");
      }
    }

    // Move back up
    process.stdout.write(`\x1b[${linesToClear}A`);

    // Restore cursor position
    process.stdout.write("\x1b[u");
  }

  /**
   * Check if dropdown is visible
   */
  isShown(): boolean {
    return this.isVisible;
  }
}
