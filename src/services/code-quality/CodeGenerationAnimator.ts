/**
 * CodeGenerationAnimator - Dynamic animation system for /code command
 * Provides various animated status messages during code generation
 */

import chalk from "chalk";

interface AnimationStage {
  emoji: string;
  messages: string[];
  duration: number; // milliseconds per message
}

export class CodeGenerationAnimator {
  private stages: AnimationStage[] = [
    {
      emoji: "🎯",
      messages: [
        "Understanding your intent",
        "Parsing requirements",
        "Identifying code patterns",
        "Mapping solution space"
      ],
      duration: 800
    },
    {
      emoji: "🧠",
      messages: [
        "Analyzing code structure",
        "Planning implementation",
        "Designing architecture",
        "Optimizing approach"
      ],
      duration: 900
    },
    {
      emoji: "🔍",
      messages: [
        "Scanning best practices",
        "Checking code patterns",
        "Reviewing standards",
        "Validating approach"
      ],
      duration: 700
    },
    {
      emoji: "⚡",
      messages: [
        "Generating code blocks",
        "Writing functions",
        "Building structure",
        "Creating logic flow"
      ],
      duration: 600
    },
    {
      emoji: "🎨",
      messages: [
        "Applying formatting",
        "Adding syntax highlighting",
        "Structuring output",
        "Polishing code"
      ],
      duration: 500
    },
    {
      emoji: "✨",
      messages: [
        "Finalizing implementation",
        "Adding finishing touches",
        "Completing generation",
        "Ready to display"
      ],
      duration: 400
    }
  ];

  private spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private glowFrames = ["◐", "◓", "◑", "◒"];
  private pulseFrames = ["○", "◔", "◑", "◕", "●", "◕", "◑", "◔"];
  private waveFrames = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"];
  private dotFrames = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];
  
  private currentStage = 0;
  private currentMessageIndex = 0;
  private currentFrame = 0;
  private interval: NodeJS.Timeout | null = null;
  private stageInterval: NodeJS.Timeout | null = null;
  private messageInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private customMessage: string | null = null;
  private isPaused = false;
  private progressMode = false;
  private progressPercent = 0;

  // Special modes
  private turboMode = false;
  private rainbowMode = false;
  private matrixMode = false;

  constructor() {}

  start(mode: 'normal' | 'turbo' | 'rainbow' | 'matrix' = 'normal'): void {
    this.startTime = Date.now();
    this.currentStage = 0;
    this.currentMessageIndex = 0;
    this.currentFrame = 0;
    this.isPaused = false;
    
    // Set mode
    this.turboMode = mode === 'turbo';
    this.rainbowMode = mode === 'rainbow';
    this.matrixMode = mode === 'matrix';

    const frameDelay = this.turboMode ? 40 : 80;
    
    // Main animation loop
    this.interval = setInterval(() => {
      if (this.isPaused) return;
      
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      const stage = this.stages[this.currentStage];
      const message = this.customMessage || stage.messages[this.currentMessageIndex];
      
      // Choose spinner based on mode
      let spinner: string;
      if (this.matrixMode) {
        spinner = this.dotFrames[this.currentFrame % this.dotFrames.length];
      } else if (this.turboMode) {
        spinner = this.glowFrames[this.currentFrame % this.glowFrames.length];
      } else if (this.progressMode) {
        spinner = this.pulseFrames[this.currentFrame % this.pulseFrames.length];
      } else {
        spinner = this.spinnerFrames[this.currentFrame % this.spinnerFrames.length];
      }
      
      // Build status line
      let statusLine = `\r${this.getColoredSpinner(spinner)} ${stage.emoji} `;
      
      if (this.rainbowMode) {
        statusLine += this.getRainbowText(message);
      } else if (this.matrixMode) {
        statusLine += chalk.green(message);
      } else {
        statusLine += chalk.gray(message);
      }
      
      // Add progress indicator
      if (this.progressMode) {
        const progressBar = this.generateMiniProgressBar(this.progressPercent);
        statusLine += ` ${progressBar}`;
      }
      
      // Add elapsed time
      statusLine += chalk.dim(` [${elapsed}s]`);
      
      // Add wave animation
      if (this.turboMode) {
        const wave = this.waveFrames[this.currentFrame % this.waveFrames.length];
        statusLine += ` ${chalk.cyan(wave.repeat(3))}`;
      }
      
      process.stdout.write(statusLine);
      this.currentFrame++;
    }, frameDelay);
    
    // Message rotation
    this.messageInterval = setInterval(() => {
      if (this.isPaused || this.customMessage) return;
      
      const stage = this.stages[this.currentStage];
      this.currentMessageIndex = (this.currentMessageIndex + 1) % stage.messages.length;
    }, this.stages[this.currentStage].duration);
    
    // Stage progression
    this.stageInterval = setInterval(() => {
      if (this.isPaused) return;
      
      if (this.currentStage < this.stages.length - 1) {
        this.currentStage++;
        this.currentMessageIndex = 0;
        
        // Update message rotation speed
        if (this.messageInterval) {
          clearInterval(this.messageInterval);
          this.messageInterval = setInterval(() => {
            if (this.isPaused || this.customMessage) return;
            const stage = this.stages[this.currentStage];
            this.currentMessageIndex = (this.currentMessageIndex + 1) % stage.messages.length;
          }, this.stages[this.currentStage].duration);
        }
      }
    }, this.turboMode ? 2000 : 3500);
  }

  /**
   * Update with a custom message
   */
  updateMessage(message: string): void {
    this.customMessage = message;
  }

  /**
   * Clear custom message and return to stage messages
   */
  clearCustomMessage(): void {
    this.customMessage = null;
  }

  /**
   * Set specific stage
   */
  setStage(stageIndex: number): void {
    if (stageIndex >= 0 && stageIndex < this.stages.length) {
      this.currentStage = stageIndex;
      this.currentMessageIndex = 0;
    }
  }

  /**
   * Enable progress mode with percentage
   */
  showProgress(percent: number): void {
    this.progressMode = true;
    this.progressPercent = Math.min(100, Math.max(0, percent));
  }

  /**
   * Pause animation
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume animation
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Stop and clear animation
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.stageInterval) {
      clearInterval(this.stageInterval);
      this.stageInterval = null;
    }
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
    process.stdout.write("\r\x1b[K"); // Clear the line
  }

  /**
   * Generate mini progress bar
   */
  private generateMiniProgressBar(percent: number): string {
    const width = 10;
    const filled = Math.floor((percent / 100) * width);
    const empty = width - filled;
    
    const bar = chalk.green("█").repeat(filled) + chalk.gray("░").repeat(empty);
    return `[${bar}] ${percent}%`;
  }

  /**
   * Get colored spinner based on mode
   */
  private getColoredSpinner(spinner: string): string {
    if (this.rainbowMode) {
      const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta];
      const color = colors[this.currentFrame % colors.length];
      return color(spinner);
    } else if (this.matrixMode) {
      return chalk.green(spinner);
    } else if (this.turboMode) {
      return chalk.cyan.bold(spinner);
    } else {
      return chalk.cyan(spinner);
    }
  }

  /**
   * Generate rainbow text
   */
  private getRainbowText(text: string): string {
    const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta];
    return text.split('').map((char, i) => {
      const color = colors[(i + this.currentFrame) % colors.length];
      return color(char);
    }).join('');
  }

  /**
   * Show completion animation
   */
  async showCompletion(): Promise<void> {
    const completionFrames = ["✨", "🎉", "✅", "🚀", "🎊"];
    const messages = [
      "Code generation complete!",
      "Successfully generated!",
      "All done!",
      "Ready to use!",
      "Finished!"
    ];
    
    for (let i = 0; i < completionFrames.length; i++) {
      process.stdout.write(`\r${completionFrames[i]} ${chalk.green.bold(messages[i])}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    process.stdout.write("\r\x1b[K");
  }

  /**
   * Show error animation
   */
  async showError(errorMessage: string): Promise<void> {
    const errorFrames = ["❌", "⚠️", "🔴", "❗"];
    
    for (let i = 0; i < errorFrames.length; i++) {
      process.stdout.write(`\r${errorFrames[i]} ${chalk.red(errorMessage)}`);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write("\r\x1b[K");
  }
}

/**
 * Factory function to create pre-configured animators
 */
export function createCodeAnimator(type: 'simple' | 'advanced' | 'turbo' = 'advanced'): CodeGenerationAnimator {
  const animator = new CodeGenerationAnimator();
  
  switch (type) {
    case 'simple':
      return animator; // Default configuration
    case 'turbo':
      // Will start in turbo mode when start() is called
      return animator;
    case 'advanced':
    default:
      // Standard advanced mode
      return animator;
  }
}