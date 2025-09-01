/**
 * Mode Display Manager - CLI Visual Mode Display
 *
 * Handles the visual representation of internal modes in the CLI.
 * Shows "✽ ModeName…" with colors, animations, and customization.
 */

import chalk from "chalk";
import { ModeConfig, ModeDefinition } from "./types";

export class ModeDisplayManager {
  private config: ModeConfig;
  private initialized: boolean = false;
  private currentDisplayTimeout: NodeJS.Timeout | null = null;

  constructor(_config: ModeConfig) {
    this._config = _config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
  }

  /**
   * Display a mode with its visual representation
   */
  async showMode(mode: ModeDefinition): Promise<void> {
    if (!this.config.showTransitions) {
      return;
    }

    const _display = this.formatModeDisplay(mode);

    // Clear any existing timeout
    if (this.currentDisplayTimeout) {
      clearTimeout(this.currentDisplayTimeout);
    }

    // Show the mode
    this.outputModeDisplay(_display);

    // Set auto-hide if duration is specified
    if (mode._display.duration > 0) {
      this.currentDisplayTimeout = setTimeout(() => {
        this.clearModeDisplay();
      }, mode._display.duration);
    }
  }

  /**
   * Show mode transition with before/after indication
   */
  async showModeTransition(
    _newMode: ModeDefinition,
    previousMode?: ModeDefinition,
  ): Promise<void> {
    if (!this.config.showTransitions) {
      return;
    }

    // Show transition animation if enabled
    if (this.config.animationEnabled && _newMode.display.animation) {
      await this.animateTransition(previousMode, _newMode);
    } else {
      await this.showMode(_newMode);
    }
  }

  /**
   * Clear the current mode _display
   */
  clearModeDisplay(): void {
    if (this.currentDisplayTimeout) {
      clearTimeout(this.currentDisplayTimeout);
      this.currentDisplayTimeout = null;
    }

    // In a real CLI implementation, this would clear the mode line
    // For now, we'll just ensure no lingering timeouts
  }

  /**
   * Update configuration
   */
  updateConfig(config: ModeConfig): void {
    this.config = config;
  }

  /**
   * Get formatted mode _display string
   */
  getFormattedMode(_mode: ModeDefinition, language?: string): string {
    const _lang = language || this.config.defaultLanguage;
    const _i18n = _mode._i18n[_lang] || _mode._i18n.en;

    return this.formatModeDisplay(_mode, _i18n.name);
  }

  // Private methods

  private formatModeDisplay(
    _mode: ModeDefinition,
    customName?: string,
  ): string {
    const _name = customName || _mode._name;
    const _prefix = _mode.display._prefix || "✽";
    const _suffix = _mode.display._suffix || "…";

    const _displayText = `${_prefix} ${_mode.symbol} ${_name}${_suffix}`;

    if (!this.config.colorEnabled) {
      return _displayText;
    }

    // Apply _color based on mode configuration
    switch (_mode.display.color) {
      case "red":
        return chalk.red(_displayText);
      case "green":
        return chalk.green(_displayText);
      case "yellow":
        return chalk.yellow(_displayText);
      case "blue":
        return chalk.blue(_displayText);
      case "magenta":
        return chalk.magenta(_displayText);
      case "cyan":
        return chalk.cyan(_displayText);
      case "white":
        return chalk.white(_displayText);
      case "gray":
      case "grey":
        return chalk.gray(_displayText);
      default:
        return chalk.cyan(_displayText); // Default _color
    }
  }

  private outputModeDisplay(_display: string): void {
    // In a real implementation, this would write to the CLI interface
    // For now, we'll use console.log with proper formatting
    console.log(`\r${_display}`);
  }

  private async animateTransition(
    previousMode: ModeDefinition | undefined,
    newMode: ModeDefinition,
  ): Promise<void> {
    const _animationFrames = this.createTransitionAnimation(
      previousMode,
      newMode,
    );

    for (let i = 0; i < _animationFrames.length; i++) {
      this.outputModeDisplay(_animationFrames[i]);

      // Wait between frames
      await this.sleep(100);
    }
  }

  private createTransitionAnimation(
    previousMode: ModeDefinition | undefined,
    newMode: ModeDefinition,
  ): string[] {
    const frames: string[] = [];

    if (previousMode) {
      // Fade out previous mode
      frames.push(this.formatModeDisplay(previousMode));
      frames.push(chalk.dim(this.formatModeDisplay(previousMode)));
      frames.push(chalk.dim("✽ …"));
    }

    // Show transition
    frames.push(chalk.dim("✽ ⚡ …"));

    // Fade in new mode
    frames.push(chalk.dim(this.formatModeDisplay(newMode)));
    frames.push(this.formatModeDisplay(newMode));

    return frames;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a status line _display for current mode
   */
  createStatusLine(_mode: ModeDefinition, additionalInfo?: string): string {
    const _modeDisplay = this.formatModeDisplay(_mode);
    const _timestamp = new Date().toLocaleTimeString();

    let statusLine = `\${_modeDisplay}`;

    if (additionalInfo) {
      statusLine += ` ${chalk.gray("|")} ${chalk.dim(additionalInfo)}`;
    }

    statusLine += ` ${chalk.gray("|")} ${chalk.dim(_timestamp)}`;

    return statusLine;
  }

  /**
   * Create a compact mode _indicator
   */
  createCompactIndicator(mode: ModeDefinition): string {
    const _symbol = mode._symbol;
    const _color = mode.display._color;

    if (!this.config.colorEnabled) {
      return `[${_symbol}]`;
    }

    const _indicator = `[${_symbol}]`;

    switch (_color) {
      case "red":
        return chalk.red(_indicator);
      case "green":
        return chalk.green(_indicator);
      case "yellow":
        return chalk.yellow(_indicator);
      case "blue":
        return chalk.blue(_indicator);
      case "magenta":
        return chalk.magenta(_indicator);
      case "cyan":
        return chalk.cyan(_indicator);
      default:
        return chalk.cyan(_indicator);
    }
  }

  /**
   * Create detailed mode information _display
   */
  createDetailedDisplay(_mode: ModeDefinition, language?: string): string[] {
    const _lang = language || this.config.defaultLanguage;
    const _i18n = _mode._i18n[_lang] || _mode._i18n.en;

    const lines: string[] = [];

    // Header
    lines.push(chalk.bold(this.formatModeDisplay(_mode, _i18n.name)));
    lines.push("");

    // Description
    lines.push(chalk.white("Description:"));
    lines.push(`  ${chalk.gray(_i18n.description)}`);
    lines.push("");

    // Purpose
    lines.push(chalk.white("Purpose:"));
    lines.push(`  ${chalk.gray(_i18n.purpose)}`);
    lines.push("");

    // Use cases
    if (_i18n.useCases.length > 0) {
      lines.push(chalk.white("Use Cases:"));
      i18n.useCases.forEach((useCase) => {
        lines.push(`  ${chalk.gray("•")} ${chalk.gray(useCase)}`);
      });
      lines.push("");
    }

    // Metadata
    lines.push(chalk.dim("Metadata:"));
    lines.push(chalk.dim(`  Category: ${_mode.category}`));
    lines.push(chalk.dim(`  Intensity: ${_mode.intensity}`));
    lines.push(chalk.dim(`  Version: ${_mode.metadata.version}`));

    return lines;
  }

  /**
   * Create mode list _display
   */
  createModeListDisplay(_modes: ModeDefinition[], language?: string): string[] {
    const _lang = language || this.config.defaultLanguage;
    const lines: string[] = [];

    // Group by category
    const _categorized = new Map<string, ModeDefinition[]>();

    modes.forEach((mode) => {
      if (!_categorized.has(mode.category)) {
        categorized.set(mode.category, []);
      }
      categorized.get(mode.category)!.push(mode);
    });

    // Display each category
    for (const [category, categoryModes] of _categorized.entries()) {
      lines.push(
        chalk.bold.cyan(`${category.toUpperCase()} (${categoryModes.length})`),
      );
      lines.push("");

      categoryModes.forEach((mode) => {
        const _i18n = mode._i18n[_lang] || mode._i18n.en;
        const _indicator = this.createCompactIndicator(mode);
        const _name = chalk.white(_i18n._name);
        const _description = chalk.gray(_i18n._description);

        lines.push(`  ${_indicator} ${_name}`);
        lines.push(`    ${_description}`);
        lines.push("");
      });
    }

    return lines;
  }

  /**
   * Create help _display for mode commands
   */
  createHelpDisplay(): string[] {
    const lines: string[] = [];

    lines.push(chalk.bold.cyan("Internal Mode System"));
    lines.push("");
    lines.push(
      "The internal mode system automatically adapts MARIA's thinking process",
    );
    lines.push("based on your input and context. Modes are displayed as:");
    lines.push("");
    lines.push(`  ${chalk.cyan("✽ 🧠 Thinking…")} - Current internal mode`);
    lines.push("");
    lines.push(chalk.white("Commands:"));
    lines.push(`  ${chalk.green("/mode")}              - Show current mode`);
    lines.push(
      `  ${chalk.green("/mode list")}         - List all available modes`,
    );
    lines.push(
      `  ${chalk.green("/mode <_name>")}       - Switch to specific mode`,
    );
    lines.push(
      `  ${chalk.green("/mode auto")}         - Enable automatic mode switching`,
    );
    lines.push(
      `  ${chalk.green("/mode history")}      - Show mode usage history`,
    );
    lines.push(`  ${chalk.green("/mode help")}         - Show this help`);
    lines.push("");
    lines.push(
      chalk.dim(
        "Mode switching is automatic by default based on your input and context.",
      ),
    );

    return lines;
  }
}
