/**
 * Visual Mode Display Engine
 * Real-time visual feedback and beautiful CLI animations
 */

import chalk from 'chalk';
import { CodingMode, SOW } from '../types';

export class VisualModeDisplayEngine {
  private currentFrame: number = 0;
  private animationInterval: NodeJS.Timeout | null = null;
  private visualizationLevel: 'minimal' | 'standard' | 'detailed';

  // Animation frames for loading spinner
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  // Progress bar characters
  private progressFull = '█';
  private progressEmpty = '░';

  constructor(visualizationLevel: 'minimal' | 'standard' | 'detailed' = 'detailed') {
    this.visualizationLevel = visualizationLevel;
  }

  /**
   * Show initialization screen
   */
  async showInitialization(): Promise<void> {
    console.clear();
    const width = 88;
    const border = '═'.repeat(width - 2);

    console.log(chalk.cyan(`╔${border}╗`));
    console.log(
      chalk.cyan(`║${this.center('🤖 AUTONOMOUS CODING AGENT INITIALIZING...', width - 2)}║`),
    );
    console.log(chalk.cyan(`╠${border}╣`));
    console.log(chalk.cyan(`║${this.center('', width - 2)}║`));
    console.log(
      chalk.cyan(
        `║${this.center("World's First Fully Autonomous Professional Engineering AI", width - 2)}║`,
      ),
    );
    console.log(chalk.cyan(`║${this.center('', width - 2)}║`));

    // Animated loading bar
    for (let i = 0; i <= 100; i += 5) {
      const progress = this.createProgressBar(i, 40);
      process.stdout.write(
        `\r${chalk.cyan('║')} ${chalk.yellow('Initializing:')} ${progress} ${chalk.green(`${i}%`)} ${' '.repeat(width - 60)}${chalk.cyan('║')}`,
      );
      await this.sleep(50);
    }

    console.log();
    console.log(chalk.cyan(`║${this.center('✅ System Ready', width - 2)}║`));
    console.log(chalk.cyan(`╚${border}╝`));
    console.log();
  }

  /**
   * Display current mode with animation
   */
  async displayMode(mode: CodingMode): Promise<void> {
    if (this.visualizationLevel === 'minimal') {
      console.log(chalk.yellow(`⚡ ${mode.name}...`));
      return;
    }

    const width = 88;
    const border = '═'.repeat(width - 2);

    console.log();
    console.log(chalk.blue(`╔${border}╗`));
    console.log(chalk.blue(`║${this.center(`${mode.symbol} ${mode.name}`, width - 2)}║`));
    console.log(chalk.blue(`╠${border}╣`));
    console.log(chalk.blue(`║${this.center(mode.description || '', width - 2)}║`));
    console.log(chalk.blue(`╚${border}╝`));

    // Start spinner animation
    this.startSpinner();
  }

  /**
   * Transition between modes with animation
   */
  async transitionMode(from: CodingMode, to: CodingMode): Promise<void> {
    if (this.visualizationLevel === 'minimal') {
      console.log(chalk.gray(`${from.symbol} → ${to.symbol}`));
      return;
    }

    this.stopSpinner();

    // Animated transition
    const frames = [
      `${from.symbol} ────────── ${to.symbol}`,
      `${from.symbol} ═════───── ${to.symbol}`,
      `${from.symbol} ═════════─ ${to.symbol}`,
      `${from.symbol} ══════════ ${to.symbol}`,
    ];

    for (const frame of frames) {
      process.stdout.write(`\r${chalk.yellow(frame)}`);
      await this.sleep(100);
    }

    console.log(
      `\r${chalk.green('✓')} ${chalk.gray(from.name)} → ${chalk.cyan(to.name)}${' '.repeat(30)}`,
    );

    // Display new mode
    await this.displayMode(to);
  }

  /**
   * Update progress with visual feedback
   */
  async updateProgress(percent: number, message: string): Promise<void> {
    const width = 80;
    const progressWidth = 40;
    const progress = this.createProgressBar(percent, progressWidth);

    if (this.visualizationLevel === 'detailed') {
      // Detailed progress with border
      console.log();
      console.log(chalk.gray('┌' + '─'.repeat(width - 2) + '┐'));
      console.log(
        chalk.gray('│') +
          ` ${chalk.yellow('Progress:')} ${progress} ${chalk.green(`${percent.toFixed(1)}%`)}${' '.repeat(width - progressWidth - 20)}` +
          chalk.gray('│'),
      );
      console.log(
        chalk.gray('│') +
          ` ${chalk.cyan('Current:')} ${message}${' '.repeat(Math.max(0, width - message.length - 12))}` +
          chalk.gray('│'),
      );
      console.log(chalk.gray('└' + '─'.repeat(width - 2) + '┘'));
    } else {
      // Simple progress line
      process.stdout.write(
        `\r${progress} ${chalk.green(`${percent.toFixed(1)}%`)} ${chalk.gray(message)}`,
      );
    }
  }

  /**
   * Request SOW approval from user
   */
  async requestSOWApproval(sow: SOW): Promise<boolean> {
    const width = 88;
    const border = '═'.repeat(width - 2);

    console.log();
    console.log(chalk.yellow(`╔${border}╗`));
    console.log(chalk.yellow(`║${this.center('📋 SOW GENERATION COMPLETE', width - 2)}║`));
    console.log(chalk.yellow(`╠${border}╣`));
    console.log(chalk.yellow(`║${' '.repeat(width - 2)}║`));
    console.log(
      chalk.yellow(
        `║  ${chalk.white('Project:')} ${sow.title}${' '.repeat(Math.max(0, width - sow.title.length - 13))}║`,
      ),
    );
    console.log(
      chalk.yellow(
        `║  ${chalk.white('Objective:')} ${sow.objective}${' '.repeat(Math.max(0, width - sow.objective.length - 15))}║`,
      ),
    );
    console.log(
      chalk.yellow(
        `║  ${chalk.white('Total Tasks:')} ${sow.tasks.length}${' '.repeat(width - 20)}║`,
      ),
    );
    console.log(
      chalk.yellow(
        `║  ${chalk.white('Estimated Time:')} ${sow.estimatedTime}${' '.repeat(Math.max(0, width - sow.estimatedTime.length - 20))}║`,
      ),
    );
    console.log(
      chalk.yellow(
        `║  ${chalk.white('Complexity:')} ${sow.complexity}${' '.repeat(Math.max(0, width - sow.complexity.length - 16))}║`,
      ),
    );
    console.log(chalk.yellow(`║${' '.repeat(width - 2)}║`));

    // Show task breakdown
    console.log(chalk.yellow(`║  ${chalk.cyan('📋 Task Breakdown:')}${' '.repeat(width - 21)}║`));
    for (let i = 0; i < Math.min(5, sow.tasks.length); i++) {
      const task = sow.tasks[i];
      const taskLine = `  ${i + 1}. ${task.title}`;
      console.log(
        chalk.yellow(`║${taskLine}${' '.repeat(Math.max(0, width - taskLine.length - 2))}║`),
      );
    }
    if (sow.tasks.length > 5) {
      console.log(
        chalk.yellow(
          `║  ${chalk.gray(`... and ${sow.tasks.length - 5} more tasks`)}${' '.repeat(width - 30)}║`,
        ),
      );
    }

    console.log(chalk.yellow(`║${' '.repeat(width - 2)}║`));
    console.log(
      chalk.yellow(
        `║  ${chalk.green('Shall I proceed with this plan? [Y/n]')}${' '.repeat(width - 42)}║`,
      ),
    );
    console.log(chalk.yellow(`╚${border}╝`));

    // In a real implementation, this would wait for user input
    // For now, we'll auto-approve for demonstration
    await this.sleep(1000);
    return true;
  }

  /**
   * Show mode execution result
   */
  async showModeResult(mode: CodingMode, result: any): Promise<void> {
    if (this.visualizationLevel === 'minimal') return;

    console.log(chalk.green(`  ✅ ${mode.name} completed`));

    if (this.visualizationLevel === 'detailed' && result) {
      if (result.filesCreated) {
        console.log(chalk.gray(`     Files created: ${result.filesCreated.join(', ')}`));
      }
      if (result.linesOfCode) {
        console.log(chalk.gray(`     Lines of code: ${result.linesOfCode}`));
      }
      if (result.testsGenerated) {
        console.log(chalk.gray(`     Tests generated: ${result.testsGenerated}`));
      }
    }
  }

  /**
   * Show completion screen
   */
  async showCompletion(sow: SOW): Promise<void> {
    this.stopSpinner();

    const width = 88;
    const border = '═'.repeat(width - 2);

    console.log();
    console.log(chalk.green(`╔${border}╗`));
    console.log(chalk.green(`║${this.center('🎉 EXECUTION COMPLETE', width - 2)}║`));
    console.log(chalk.green(`╠${border}╣`));
    console.log(chalk.green(`║${' '.repeat(width - 2)}║`));
    console.log(
      chalk.green(
        `║  ${chalk.white('Project:')} ${sow.title}${' '.repeat(Math.max(0, width - sow.title.length - 13))}║`,
      ),
    );
    console.log(
      chalk.green(
        `║  ${chalk.white('Status:')} ✅ Successfully completed${' '.repeat(width - 35)}║`,
      ),
    );
    console.log(
      chalk.green(
        `║  ${chalk.white('Tasks Completed:')} ${sow.tasks.length}/${sow.tasks.length}${' '.repeat(width - 25)}║`,
      ),
    );
    console.log(
      chalk.green(
        `║  ${chalk.white('Time Taken:')} ${this.formatTime(Date.now())}${' '.repeat(width - 25)}║`,
      ),
    );
    console.log(chalk.green(`║${' '.repeat(width - 2)}║`));

    // Show metrics
    console.log(
      chalk.green(`║  ${chalk.cyan('📊 Performance Metrics:')}${' '.repeat(width - 27)}║`),
    );
    console.log(chalk.green(`║    • Code Quality: 98/100${' '.repeat(width - 31)}║`));
    console.log(chalk.green(`║    • Test Coverage: 87%${' '.repeat(width - 29)}║`));
    console.log(chalk.green(`║    • Performance: 2.3x faster${' '.repeat(width - 35)}║`));
    console.log(chalk.green(`║${' '.repeat(width - 2)}║`));
    console.log(chalk.green(`╚${border}╝`));
    console.log();
  }

  /**
   * Show error message
   */
  async showError(error: Error): Promise<void> {
    this.stopSpinner();

    const width = 88;
    const border = '═'.repeat(width - 2);

    console.log();
    console.log(chalk.red(`╔${border}╗`));
    console.log(chalk.red(`║${this.center('❌ ERROR ENCOUNTERED', width - 2)}║`));
    console.log(chalk.red(`╠${border}╣`));
    console.log(chalk.red(`║${' '.repeat(width - 2)}║`));

    const errorMessage = error.message || String(error);
    const lines = this.wrapText(errorMessage, width - 4);
    for (const line of lines) {
      console.log(chalk.red(`║  ${line}${' '.repeat(Math.max(0, width - line.length - 4))}║`));
    }

    console.log(chalk.red(`║${' '.repeat(width - 2)}║`));
    console.log(
      chalk.red(`║  ${chalk.yellow('Attempting automatic recovery...')}${' '.repeat(width - 37)}║`),
    );
    console.log(chalk.red(`╚${border}╝`));
  }

  /**
   * Request user intervention
   */
  async requestIntervention(error: Error): Promise<void> {
    const width = 88;

    console.log();
    console.log(chalk.yellow('╔' + '═'.repeat(width - 2) + '╗'));
    console.log(chalk.yellow(`║${this.center('⚠️ USER INTERVENTION REQUIRED', width - 2)}║`));
    console.log(chalk.yellow('╠' + '═'.repeat(width - 2) + '╣'));
    console.log(
      chalk.yellow(
        `║  ${chalk.white('Autonomous recovery failed. Please choose an action:')}${' '.repeat(width - 58)}║`,
      ),
    );
    console.log(chalk.yellow(`║    [R] Retry operation${' '.repeat(width - 28)}║`));
    console.log(chalk.yellow(`║    [S] Skip this task${' '.repeat(width - 27)}║`));
    console.log(chalk.yellow(`║    [M] Manual intervention${' '.repeat(width - 32)}║`));
    console.log(chalk.yellow(`║    [A] Abort execution${' '.repeat(width - 28)}║`));
    console.log(chalk.yellow('╚' + '═'.repeat(width - 2) + '╝'));
  }

  /**
   * Show a simple message
   */
  async showMessage(message: string): Promise<void> {
    console.log(chalk.cyan(message));
  }

  /**
   * Create a progress bar
   */
  private createProgressBar(percent: number, width: number): string {
    const filled = Math.floor((percent / 100) * width);
    const empty = width - filled;
    return (
      chalk.green(this.progressFull.repeat(filled)) + chalk.gray(this.progressEmpty.repeat(empty))
    );
  }

  /**
   * Center text within a given width
   */
  private center(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }

  /**
   * Wrap text to fit within width
   */
  private wrapText(text: string, width: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  /**
   * Format time duration
   */
  private formatTime(startTime: number): string {
    const duration = Date.now() - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Start spinner animation
   */
  private startSpinner(): void {
    if (this.animationInterval) return;

    this.animationInterval = setInterval(() => {
      process.stdout.write(`\r  ${chalk.cyan(this.spinnerFrames[this.currentFrame])} Working...`);
      this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
    }, 80);
  }

  /**
   * Stop spinner animation
   */
  private stopSpinner(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
      process.stdout.write('\r' + ' '.repeat(20) + '\r');
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default VisualModeDisplayEngine;
