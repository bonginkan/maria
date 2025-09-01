/**
 * FastStreamingRenderer - High-performance real-time code streaming
 * Optimized for instant display and smooth animations
 */

import chalk from "chalk";
import { EventEmitter } from "node:events";

export interface StreamChunk {
  type: 'code' | 'text' | 'comment' | 'header';
  content: string;
  language?: string;
  delay?: number;
}

export class FastStreamingRenderer extends EventEmitter {
  private buffer: string = "";
  private outputStarted = false;
  private spinnerInterval: NodeJS.Timeout | null = null;
  private currentSpinnerFrame = 0;
  
  // Ultra-fast spinner frames for code generation
  private readonly spinners = {
    dots: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
    arrows: ["↖", "↗", "→", "↘", "↓", "↙", "←", "↖"],
    code: ["<", ">", "{", "}", "[", "]", "(", ")"],
    blocks: ["▰▱▱▱▱", "▱▰▱▱▱", "▱▱▰▱▱", "▱▱▱▰▱", "▱▱▱▱▰", "▱▱▱▰▱", "▱▱▰▱▱", "▱▰▱▱▱"],
    progress: ["█▁▁▁▁", "▁█▁▁▁", "▁▁█▁▁", "▁▁▁█▁", "▁▁▁▁█", "▁▁▁█▁", "▁▁█▁▁", "▁█▁▁▁"],
    pulse: ["⬤", "◯", "◉", "◎", "◉", "◯"],
    scan: ["▌", "▐", "▖", "▗", "▘", "▝", "▀", "▄"]
  };
  
  private readonly messages = [
    "Generating code",
    "Analyzing request",
    "Building structure",
    "Writing functions",
    "Optimizing output",
    "Formatting code"
  ];
  
  private messageIndex = 0;
  private startTime = Date.now();

  /**
   * Start the generation spinner with high refresh rate
   */
  startSpinner(message?: string): void {
    if (this.spinnerInterval) return;
    
    this.startTime = Date.now();
    let lastMessageChange = Date.now();
    
    // Ultra-fast refresh rate (30fps) for smooth animation
    this.spinnerInterval = setInterval(() => {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      const spinner = this.spinners.dots[this.currentSpinnerFrame % this.spinners.dots.length];
      
      // Change message every 800ms for dynamic feel
      if (Date.now() - lastMessageChange > 800) {
        this.messageIndex = (this.messageIndex + 1) % this.messages.length;
        lastMessageChange = Date.now();
      }
      
      const displayMessage = message || this.messages[this.messageIndex];
      
      // Build status line with colors
      const statusLine = `\r${chalk.cyan(spinner)} ${chalk.bold('⚡')} ${chalk.gray(displayMessage)} ${chalk.dim(`[${elapsed}s]`)}`;
      
      // Clear line and write status
      process.stdout.write('\x1b[2K' + statusLine);
      
      this.currentSpinnerFrame++;
    }, 33); // 30fps for smooth animation
  }

  /**
   * Stop spinner and clear line
   */
  stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
      process.stdout.write('\r\x1b[2K'); // Clear the line
    }
  }

  /**
   * Stream a chunk of content with minimal delay
   */
  async streamChunk(chunk: StreamChunk): Promise<void> {
    // Stop spinner on first real content
    if (!this.outputStarted && chunk.content.trim()) {
      this.stopSpinner();
      this.outputStarted = true;
      process.stdout.write('\n'); // New line after spinner
    }
    
    // Format based on type
    let formatted = chunk.content;
    
    switch (chunk.type) {
      case 'header':
        formatted = chalk.bold.blue(chunk.content);
        break;
      case 'comment':
        formatted = chalk.gray(chunk.content);
        break;
      case 'code':
        // No formatting for code - let syntax highlighting handle it
        if (chunk.language) {
          // Add language hint if starting code block
          if (chunk.content.includes('```')) {
            formatted = chunk.content;
          }
        }
        break;
    }
    
    // Stream character by character for ultra-fast appearance
    if (chunk.delay && chunk.delay > 0) {
      // Character streaming for dramatic effect
      for (const char of formatted) {
        process.stdout.write(char);
        await this.sleep(chunk.delay);
      }
    } else {
      // Instant output for maximum speed
      process.stdout.write(formatted);
    }
    
    this.emit('chunk', chunk);
  }

  /**
   * Stream text with word-by-word animation
   */
  async streamText(text: string, wordsPerSecond = 60): Promise<void> {
    const words = text.split(' ');
    const delayMs = 1000 / wordsPerSecond;
    
    for (const word of words) {
      process.stdout.write(word + ' ');
      await this.sleep(delayMs);
    }
  }

  /**
   * Stream code block with syntax highlighting hint
   */
  async streamCodeBlock(code: string, language = 'typescript'): Promise<void> {
    // Start code block
    await this.streamChunk({
      type: 'code',
      content: `\`\`\`${language}\n`,
      language
    });
    
    // Stream code lines quickly
    const lines = code.split('\n');
    for (const line of lines) {
      await this.streamChunk({
        type: 'code',
        content: line + '\n',
        language,
        delay: 0 // Instant display for code
      });
    }
    
    // End code block
    await this.streamChunk({
      type: 'code',
      content: '```\n',
      language
    });
  }

  /**
   * Show progress bar for long operations
   */
  async showProgress(total: number, message = "Processing"): Promise<void> {
    for (let i = 0; i <= total; i++) {
      const percent = Math.floor((i / total) * 100);
      const filled = Math.floor((i / total) * 20);
      const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
      
      process.stdout.write(`\r${chalk.cyan(bar)} ${percent}% ${chalk.gray(message)}`);
      
      await this.sleep(10);
    }
    process.stdout.write('\r\x1b[2K'); // Clear progress bar
  }

  /**
   * Helper sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear the current line
   */
  clearLine(): void {
    process.stdout.write('\r\x1b[2K');
  }

  /**
   * Move cursor up n lines
   */
  moveCursorUp(lines = 1): void {
    process.stdout.write(`\x1b[${lines}A`);
  }

  /**
   * Write a complete line with newline
   */
  writeLine(text: string): void {
    process.stdout.write(text + '\n');
  }
}