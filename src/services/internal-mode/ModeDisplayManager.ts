/**
 * Mode Display Manager - CLI Visual Mode Display
 *
 * Handles the visual representation of internal modes in the CLI.
 * Shows "✽ ModeName…" with colors, animations, and customization.
 */

import chalk from 'chalk';
import { ModeConfig, ModeDefinition } from './types';

export class ModeDisplayManager {
  private config: ModeConfig;
  private initialized: boolean = false;
  private currentDisplayTimeout: NodeJS.Timeout | null = null;

  constructor(config: ModeConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {return;}
    this.initialized = true;
  }

  /**
   * Display a mode with its visual representation
   */
  async showMode(mode: ModeDefinition): Promise<void> {
    if (!this.config.showTransitions) {return;}

    const display = this.formatModeDisplay(mode);

    // Clear any existing timeout
    if (this.currentDisplayTimeout) {
      clearTimeout(this.currentDisplayTimeout);
    }

    // Show the mode
    this.outputModeDisplay(display);

    // Set auto-hide if duration is specified
    if (mode.display.duration > 0) {
      this.currentDisplayTimeout = setTimeout(() => {
        this.clearModeDisplay();
      }, mode.display.duration);
    }
  }

  /**
   * Show mode transition with before/after indication
   */
  async showModeTransition(newMode: ModeDefinition, previousMode?: ModeDefinition): Promise<void> {
    if (!this.config.showTransitions) {return;}

    // Show transition animation if enabled
    if (this.config.animationEnabled && newMode.display.animation) {
      await this.animateTransition(previousMode, newMode);
    } else {
      await this.showMode(newMode);
    }
  }

  /**
   * Clear the current mode display
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
   * Get formatted mode display string
   */
  getFormattedMode(mode: ModeDefinition, language?: string): string {
    const lang = language || this.config.defaultLanguage;
    const i18n = mode.i18n[lang] || mode.i18n.en;

    return this.formatModeDisplay(mode, i18n.name);
  }

  // Private methods

  private formatModeDisplay(mode: ModeDefinition, customName?: string): string {
    const name = customName || mode.name;
    const prefix = mode.display.prefix || '✽';
    const suffix = mode.display.suffix || '…';

    const displayText = `${prefix} ${mode.symbol} ${name}${suffix}`;

    if (!this.config.colorEnabled) {
      return displayText;
    }

    // Apply color based on mode configuration
    switch (mode.display.color) {
      case 'red':
        return chalk.red(displayText);
      case 'green':
        return chalk.green(displayText);
      case 'yellow':
        return chalk.yellow(displayText);
      case 'blue':
        return chalk.blue(displayText);
      case 'magenta':
        return chalk.magenta(displayText);
      case 'cyan':
        return chalk.cyan(displayText);
      case 'white':
        return chalk.white(displayText);
      case 'gray':
      case 'grey':
        return chalk.gray(displayText);
      default:
        return chalk.cyan(displayText); // Default color
    }
  }

  private outputModeDisplay(display: string): void {
    // In a real implementation, this would write to the CLI interface
    // For now, we'll use console.log with proper formatting
    console.log(`\r${display}`);
  }

  private async animateTransition(
    previousMode: ModeDefinition | undefined,
    newMode: ModeDefinition,
  ): Promise<void> {
    const animationFrames = this.createTransitionAnimation(previousMode, newMode);

    for (let i = 0; i < animationFrames.length; i++) {
      this.outputModeDisplay(animationFrames[i]);

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
      frames.push(chalk.dim('✽ …'));
    }

    // Show transition
    frames.push(chalk.dim('✽ ⚡ …'));

    // Fade in new mode
    frames.push(chalk.dim(this.formatModeDisplay(newMode)));
    frames.push(this.formatModeDisplay(newMode));

    return frames;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a status line display for current mode
   */
  createStatusLine(mode: ModeDefinition, additionalInfo?: string): string {
    const modeDisplay = this.formatModeDisplay(mode);
    const timestamp = new Date().toLocaleTimeString();

    let statusLine = `${modeDisplay}`;

    if (additionalInfo) {
      statusLine += ` ${chalk.gray('|')} ${chalk.dim(additionalInfo)}`;
    }

    statusLine += ` ${chalk.gray('|')} ${chalk.dim(timestamp)}`;

    return statusLine;
  }

  /**
   * Create a compact mode indicator
   */
  createCompactIndicator(mode: ModeDefinition): string {
    const symbol = mode.symbol;
    const color = mode.display.color;

    if (!this.config.colorEnabled) {
      return `[${symbol}]`;
    }

    const indicator = `[${symbol}]`;

    switch (color) {
      case 'red':
        return chalk.red(indicator);
      case 'green':
        return chalk.green(indicator);
      case 'yellow':
        return chalk.yellow(indicator);
      case 'blue':
        return chalk.blue(indicator);
      case 'magenta':
        return chalk.magenta(indicator);
      case 'cyan':
        return chalk.cyan(indicator);
      default:
        return chalk.cyan(indicator);
    }
  }

  /**
   * Create detailed mode information display
   */
  createDetailedDisplay(mode: ModeDefinition, language?: string): string[] {
    const lang = language || this.config.defaultLanguage;
    const i18n = mode.i18n[lang] || mode.i18n.en;

    const lines: string[] = [];

    // Header
    lines.push(chalk.bold(this.formatModeDisplay(mode, i18n.name)));
    lines.push('');

    // Description
    lines.push(chalk.white('Description:'));
    lines.push(`  ${chalk.gray(i18n.description)}`);
    lines.push('');

    // Purpose
    lines.push(chalk.white('Purpose:'));
    lines.push(`  ${chalk.gray(i18n.purpose)}`);
    lines.push('');

    // Use cases
    if (i18n.useCases.length > 0) {
      lines.push(chalk.white('Use Cases:'));
      i18n.useCases.forEach((useCase) => {
        lines.push(`  ${chalk.gray('•')} ${chalk.gray(useCase)}`);
      });
      lines.push('');
    }

    // Metadata
    lines.push(chalk.dim('Metadata:'));
    lines.push(chalk.dim(`  Category: ${mode.category}`));
    lines.push(chalk.dim(`  Intensity: ${mode.intensity}`));
    lines.push(chalk.dim(`  Version: ${mode.metadata.version}`));

    return lines;
  }

  /**
   * Create mode list display
   */
  createModeListDisplay(modes: ModeDefinition[], language?: string): string[] {
    const lang = language || this.config.defaultLanguage;
    const lines: string[] = [];

    // Group by category
    const categorized = new Map<string, ModeDefinition[]>();

    modes.forEach((mode) => {
      if (!categorized.has(mode.category)) {
        categorized.set(mode.category, []);
      }
      categorized.get(mode.category)!.push(mode);
    });

    // Display each category
    for (const [category, categoryModes] of categorized.entries()) {
      lines.push(chalk.bold.cyan(`${category.toUpperCase()} (${categoryModes.length})`));
      lines.push('');

      categoryModes.forEach((mode) => {
        const i18n = mode.i18n[lang] || mode.i18n.en;
        const indicator = this.createCompactIndicator(mode);
        const name = chalk.white(i18n.name);
        const description = chalk.gray(i18n.description);

        lines.push(`  ${indicator} ${name}`);
        lines.push(`    ${description}`);
        lines.push('');
      });
    }

    return lines;
  }

  /**
   * Create help display for mode commands
   */
  createHelpDisplay(): string[] {
    const lines: string[] = [];

    lines.push(chalk.bold.cyan('Internal Mode System'));
    lines.push('');
    lines.push("The internal mode system automatically adapts MARIA's thinking process");
    lines.push('based on your input and context. Modes are displayed as:');
    lines.push('');
    lines.push(`  ${chalk.cyan('✽ 🧠 Thinking…')} - Current internal mode`);
    lines.push('');
    lines.push(chalk.white('Commands:'));
    lines.push(`  ${chalk.green('/mode')}              - Show current mode`);
    lines.push(`  ${chalk.green('/mode list')}         - List all available modes`);
    lines.push(`  ${chalk.green('/mode <name>')}       - Switch to specific mode`);
    lines.push(`  ${chalk.green('/mode auto')}         - Enable automatic mode switching`);
    lines.push(`  ${chalk.green('/mode history')}      - Show mode usage history`);
    lines.push(`  ${chalk.green('/mode help')}         - Show this help`);
    lines.push('');
    lines.push(
      chalk.dim('Mode switching is automatic by default based on your input and context.'),
    );

    return lines;
  }
}
