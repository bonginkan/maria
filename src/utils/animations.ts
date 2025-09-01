/**
 * Animation utilities for CLI output
 */

import chalk from "chalk";

export class ThinkingAnimation {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private currentFrame = 0;
  private interval: NodeJS.Timeout | null = null;
  private message: string;

  constructor(message: string = "Thinking") {
    this.message = message;
  }

  start(): void {
    this.interval = setInterval(() => {
      process.stdout.write(
        `\r${chalk.cyan(this.frames[this.currentFrame])} ${chalk.gray(this.message)}...`,
      );
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write("\r\x1b[K"); // Clear the line
    }
  }

  updateMessage(message: string): void {
    this.message = message;
  }
}

export class ProcessAnimation {
  private stages = [
    { icon: "🧠", message: "Understanding your request" },
    { icon: "🔍", message: "Analyzing context" },
    { icon: "💭", message: "Reasoning through the problem" },
    { icon: "✨", message: "Generating response" },
    { icon: "📝", message: "Formatting output" },
  ];
  
  private spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private currentStage = 0;
  private currentFrame = 0;
  private interval: NodeJS.Timeout | null = null;
  private stageInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;

  start(): void {
    this.startTime = Date.now();
    this.currentStage = 0;
    this.currentFrame = 0;
    
    // Update spinner animation
    this.interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const stage = this.stages[this.currentStage];
      
      process.stdout.write(
        `\r${chalk.cyan(this.spinnerFrames[this.currentFrame])} ${stage.icon} ${chalk.gray(stage.message)}... ${chalk.dim(`[${elapsed}s]`)}`,
      );
      
      this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
    }, 80);
    
    // Change stage every few seconds
    this.stageInterval = setInterval(() => {
      if (this.currentStage < this.stages.length - 1) {
        this.currentStage++;
      }
    }, 3000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.stageInterval) {
      clearInterval(this.stageInterval);
      this.stageInterval = null;
    }
    process.stdout.write("\r\x1b[K"); // Clear the line
  }

  setStage(stageIndex: number): void {
    if (stageIndex >= 0 && stageIndex < this.stages.length) {
      this.currentStage = stageIndex;
    }
  }
}

/**
 * Progressive code generation animation with multiple stages
 */
export class CodeGenerationAnimation {
  private spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private currentFrame = 0;
  private currentStage = 0;
  private interval: NodeJS.Timeout | null = null;
  private stageInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private isComplex: boolean = false;
  
  // Simple stages for quick generation
  private simpleStages = [
    "Generating code",
  ];
  
  // Complex stages for detailed generation
  private complexStages = [
    "Understanding request",
    "Analyzing requirements", 
    "Planning structure",
    "Designing solution",
    "Writing implementation",
    "Optimizing code",
    "Finalizing output",
  ];

  constructor(isComplex: boolean = false) {
    this.isComplex = isComplex;
  }

  start(): void {
    this.startTime = Date.now();
    this.currentStage = 0;
    this.currentFrame = 0;
    
    const stages = this.isComplex ? this.complexStages : this.simpleStages;
    
    // Update spinner animation
    this.interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const stage = stages[this.currentStage];
      
      if (this.isComplex) {
        // Complex multi-stage display
        process.stdout.write(
          `\r${chalk.cyan(this.spinnerFrames[this.currentFrame])} ${stage} ${chalk.dim(`[${elapsed}s]`)}`,
        );
      } else {
        // Simple display
        process.stdout.write(
          `\r${chalk.cyan(this.spinnerFrames[this.currentFrame])} ${chalk.gray(stage)}...`,
        );
      }
      
      this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
    }, 80);
    
    // Change stage for complex animations
    if (this.isComplex) {
      this.stageInterval = setInterval(() => {
        if (this.currentStage < stages.length - 1) {
          this.currentStage++;
        }
      }, 2000); // Change stage every 2 seconds
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.stageInterval) {
      clearInterval(this.stageInterval);
      this.stageInterval = null;
    }
    process.stdout.write("\r\x1b[K"); // Clear the line
  }
  
  // Manually advance to next stage
  nextStage(): void {
    const stages = this.isComplex ? this.complexStages : this.simpleStages;
    if (this.currentStage < stages.length - 1) {
      this.currentStage++;
    }
  }
}

export class LoadingDots {
  private dots = ["   ", ".  ", ".. ", "..."];
  private currentDot = 0;
  private interval: NodeJS.Timeout | null = null;
  private message: string;

  constructor(message: string = "Loading") {
    this.message = message;
  }

  start(): void {
    this.interval = setInterval(() => {
      process.stdout.write(
        `\r${chalk.cyan(this.message)}${this.dots[this.currentDot]}`,
      );
      this.currentDot = (this.currentDot + 1) % this.dots.length;
    }, 300);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write("\r\x1b[K");
    }
  }
}

export class BrainAnimation {
  private frames = ["🧠", "🔮", "💫", "✨", "🌟"];
  private messages = [
    "Neural processing",
    "Pattern recognition",
    "Deep thinking",
    "Synthesizing",
    "Finalizing"
  ];
  private currentFrame = 0;
  private interval: NodeJS.Timeout | null = null;

  start(): void {
    this.interval = setInterval(() => {
      const frame = this.frames[this.currentFrame];
      const message = this.messages[this.currentFrame];
      process.stdout.write(
        `\r${frame} ${chalk.cyan(message)}...`,
      );
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write("\r\x1b[K");
    }
  }
}

export class ProgressBar {
  private width: number;
  private current: number = 0;
  private total: number;
  private label: string;

  constructor(total: number, width: number = 40, label: string = "Progress") {
    this.total = total;
    this.width = width;
    this.label = label;
  }

  update(current: number): void {
    this.current = Math.min(current, this.total);
    const percentage = Math.floor((this.current / this.total) * 100);
    const filled = Math.floor((this.current / this.total) * this.width);
    const empty = this.width - filled;

    const bar = chalk.green("█").repeat(filled) + chalk.gray("░").repeat(empty);
    process.stdout.write(`\r${this.label}: [${bar}] ${percentage}%`);

    if (this.current >= this.total) {
      process.stdout.write("\n");
    }
  }

  complete(): void {
    this.update(this.total);
  }
}

export class StreamingOutput {
  private buffer: string = "";
  private lineBuffer: string = "";
  private chunkSize: number;
  private delay: number;

  constructor(chunkSize: number = 3, delay: number = 10) {
    this.chunkSize = chunkSize;
    this.delay = delay;
  }

  async stream(text: string, prefix: string = ""): Promise<void> {
    const lines = text.split("\n");

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (prefix && lineIndex === 0) {
        process.stdout.write(prefix);
      }

      // Stream characters
      for (let i = 0; i < line.length; i += this.chunkSize) {
        const chunk = line.slice(i, i + this.chunkSize);
        process.stdout.write(chunk);
        await this.sleep(this.delay);
      }

      // Add newline except for the last line if it was originally empty
      if (lineIndex < lines.length - 1 || line.length > 0) {
        process.stdout.write("\n");
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function showCodeGenerationAnimation(): ThinkingAnimation {
  const messages = [
    "Analyzing requirements",
    "Designing architecture",
    "Writing code",
    "Adding documentation",
    "Optimizing performance",
    "Final review",
  ];

  const animation = new ThinkingAnimation(messages[0]);
  animation.start();

  let messageIndex = 0;
  const messageInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % messages.length;
    animation.updateMessage(messages[messageIndex]);
  }, 2000);

  // Store the interval ID so we can clear it when stopping
  (animation as any).messageInterval = messageInterval;

  // Override the stop method to also clear the message interval
  const originalStop = animation.stop.bind(animation);
  animation.stop = () => {
    clearInterval(messageInterval);
    originalStop();
  };

  return animation;
}
