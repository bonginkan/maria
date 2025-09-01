/**
 * Fixed Model Selector UI with proper navigation and cleanup
 * Fixes cursor movement bug and freeze after selection
 * Now supports v2 engine via feature flag
 */

import * as readline from "readline";
import chalk from "chalk";
import {
  isModelSelectorV2Enabled,
  ModelSelectorV2Facade,
} from "./model-selector/index";

interface ModelChoice {
  name: string;
  value: string;
  group: string;
}

export class ModelSelectorUI {
  private models: ModelChoice[] = [];
  private selectedIndex = 0;
  private topIndex = 0;
  private pageSize = 8;
  private rl: readline.Interface | null = null;
  private cleanupFn?: () => void;
  private isDestroyed = false;
  private contentStartRow = 0;

  constructor(models: ModelChoice[]) {
    this.models = models;
  }

  /**
   * Display the model selection UI
   */
  async show(): Promise<string | null> {
    return new Promise((resolve) => {
      if (this.isDestroyed) {
        resolve(null);
        return;
      }

      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      // Initial display - Matrix theme
      console.log(chalk.green(
        "┌─[ MODEL MATRIX ]───────────────────────────────────────────────────────────┐",
      ));
      
      // Save the cursor position after header
      process.stdout.write("\x1b7"); // Save cursor position
      this.render();

      // Enable raw mode for key handling
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      // Handle keyboard input
      const handleKeypress = (chunk: Buffer) => {
        if (this.isDestroyed) return;

        const input = chunk.toString();

        // Handle different key combinations
        if (input === "\x03") {
          // Ctrl+C
          this.cleanup();
          resolve(null);
          return;
        }

        if (input === "\x1b") {
          // ESC key
          this.cleanup();
          resolve(null);
          return;
        }

        if (input === "\r" || input === "\n") {
          // Enter key
          const selectedModel = this.models[this.selectedIndex];
          this.cleanup();
          resolve(selectedModel ? selectedModel.value : null);
          return;
        }

        // Handle arrow keys
        if (input === "\x1b[A") {
          // Up arrow
          this.moveUp();
          this.redraw();
        } else if (input === "\x1b[B") {
          // Down arrow
          this.moveDown();
          this.redraw();
        }
      };

      process.stdin.on("data", handleKeypress);

      // Store cleanup function
      this.cleanupFn = () => {
        process.stdin.removeListener("data", handleKeypress);
      };
    });
  }

  private moveUp() {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
    } else {
      // Wrap to bottom when at top
      this.selectedIndex = this.models.length - 1;
    }
  }

  private moveDown() {
    if (this.selectedIndex < this.models.length - 1) {
      this.selectedIndex++;
    } else {
      // Wrap to top when reaching bottom
      this.selectedIndex = 0;
    }
  }

  private redraw() {
    if (this.isDestroyed) return;

    // Restore cursor to saved position (after header)
    process.stdout.write("\x1b8"); // Restore cursor position
    
    // Clear from current position to end of screen
    process.stdout.write("\x1b[0J");

    // Re-render from the saved position
    this.renderFromSavedPosition();
  }

  private render() {
    if (this.isDestroyed) return;
    this.renderFromSavedPosition();
  }

  private renderFromSavedPosition() {
    if (this.isDestroyed) return;

    // Display header - Matrix style
    console.log(chalk.green(
      "│ " + chalk.greenBright("SELECT MODEL:") + " ".repeat(62) + "│",
    ));

    this.renderContent();

    // Show navigation help - Matrix style
    const scrollInfo = `[${this.selectedIndex + 1}/${this.models.length}]`;
    const helpText = `↓:NEXT  ↑:PREV  ENTER:EXEC  ESC:ABORT ${scrollInfo}`;
    console.log(chalk.green("│ ") + chalk.dim.green(helpText.padEnd(76)) + chalk.green(" │"));
    console.log(chalk.green(
      "└────────────────────────────────────────────────────────────────────────────┘",
    ));
  }

  private renderContent() {
    if (this.isDestroyed) return;

    // Create flat list of items to display (groups + models)
    const displayItems: Array<{
      type: "group" | "model";
      content: string;
      modelIndex?: number;
    }> = [];
    const groups = new Map<string, ModelChoice[]>();

    // Group models by provider
    for (const model of this.models) {
      if (!groups.has(model.group)) {
        groups.set(model.group, []);
      }
      groups.get(model.group)!.push(model);
    }

    // Build flat display list
    let modelIndex = 0;
    for (const [group, groupModels] of groups) {
      displayItems.push({
        type: "group",
        content: `├ ${group} ${"─".repeat(78 - group.length - 3)}┤`,
      });

      for (const model of groupModels) {
        displayItems.push({
          type: "model",
          content: model.name,
          modelIndex: modelIndex,
        });
        modelIndex++;
      }
    }

    // Display visible items based on current top index and selection
    let visibleCount = 0;
    let displayStartIndex = 0;
    
    // Find the range of items to display based on selection
    for (let i = 0; i < displayItems.length; i++) {
      if (displayItems[i].type === "model" && displayItems[i].modelIndex === this.selectedIndex) {
        // Found the selected item, calculate display window
        displayStartIndex = Math.max(0, i - Math.floor(this.pageSize / 2));
        break;
      }
    }

    for (
      let i = displayStartIndex;
      i < displayItems.length && visibleCount < this.pageSize;
      i++
    ) {
      const item = displayItems[i];

      if (item.type === "group") {
        console.log(chalk.green("│") + 
          chalk.dim.green("  ━━━ ") + 
          chalk.greenBright(item.content.substring(2, item.content.indexOf(" ─"))) + 
          chalk.dim.green(" " + "━".repeat(71 - item.content.indexOf(" ─"))) + 
          chalk.green("│")
        );
      } else {
        const isSelected = item.modelIndex === this.selectedIndex;
        const prefix = isSelected ? chalk.greenBright("▶ ") : "  ";
        const modelText = item.content;
        
        // Matrix-style model display
        if (isSelected) {
          console.log(
            chalk.green("│") + 
            prefix + 
            chalk.black.bgGreen(modelText.padEnd(75)) + 
            chalk.green("│")
          );
        } else {
          console.log(
            chalk.green("│") + 
            prefix + 
            chalk.green(modelText.substring(0, 75).padEnd(75)) + 
            chalk.green("│")
          );
        }
      }

      visibleCount++;
    }

    // Fill remaining space
    while (visibleCount < this.pageSize) {
      console.log("│" + " ".repeat(78) + "│");
      visibleCount++;
    }
  }

  private clearCurrentSelection() {
    if (this.isDestroyed) return;

    // Move cursor up to the content area (skip header and move to start of content)
    process.stdout.write("\x1b[1A"); // Move up to help line
    process.stdout.write("\x1b[1A"); // Move up to footer
    
    // Clear content area lines (pageSize lines)
    for (let i = 0; i < this.pageSize; i++) {
      process.stdout.write("\x1b[1A\x1b[2K"); // Move up one line and clear it
    }
  }

  private clearDisplay() {
    if (this.isDestroyed) return;

    // Calculate lines to clear: header + content + navigation + borders
    const linesToClear = this.pageSize + 4;

    for (let i = 0; i < linesToClear; i++) {
      process.stdout.write("\x1b[1A\x1b[2K"); // Move up one line and clear it
    }
  }

  private cleanup() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    try {
      // Restore terminal mode
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }

      // Remove event listener
      if (this.cleanupFn) {
        this.cleanupFn();
        this.cleanupFn = undefined;
      }

      // Close readline interface
      if (this.rl) {
        this.rl.close();
        this.rl = null;
      }

      // Resume stdin
      process.stdin.pause();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Enhanced model selector with v2 engine support
 * Automatically switches between v1 and v2 based on feature flag
 */
export async function showModelSelectorUI(
  models: ModelChoice[],
  options: {
    task?: string;
    userId?: string;
    filters?: Record<string, any>;
  } = {},
): Promise<string | null> {
  // Check if v2 is enabled
  if (isModelSelectorV2Enabled({ userId: options.userId })) {
    try {
      // Use v2 facade for seamless migration
      const facade = new ModelSelectorV2Facade();

      const result = await facade.show(models);

      // Log v2 usage for analytics
      console.log("[ModelSelector] Using v2 engine");

      return result;
    } catch (error) {
      console.warn(
        "[ModelSelector] v2 failed, falling back to v1:",
        error.message,
      );
      // Fall through to v1 implementation
    }
  }

  // Use v1 implementation (existing)
  console.log("[ModelSelector] Using v1 engine");
  const ui = new ModelSelectorUI(models);
  return ui.show();
}

/**
 * Simplified interface for backward compatibility
 */
export async function selectModel(options: {
  models?: ModelChoice[];
  task?: string;
  userId?: string;
  filters?: Record<string, any>;
}): Promise<string | null> {
  const models = options.models || [
    { name: "GPT-4", value: "openai:gpt-4", group: "OpenAI" },
    {
      name: "Claude 3.5 Sonnet",
      value: "anthropic:claude-3.5-sonnet",
      group: "Anthropic",
    },
    { name: "Gemini Pro", value: "google:gemini-pro", group: "Google" },
  ];

  return showModelSelectorUI(models, options);
}
