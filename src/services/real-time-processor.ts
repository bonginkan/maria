/**
 * Real-time Processing Display System
 * リアルタイムな内部モード表示と作業進捗報告システム
 */

import chalk from "chalk";
import { EventEmitter } from "node:events";

export interface ProcessingStep {
  id: string;
  name: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "error";
  mode?: string;
  symbol?: string;
  _progress?: number;
}

export class RealTimeProcessor extends EventEmitter {
  private steps: ProcessingStep[] = [];
  private currentStep: ProcessingStep | null = null;
  private previousMode: string | null = null;
  private animationInterval: NodeJS.Timeout | null = null;
  private effectInterval: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private effectIndex = 0;
  private animationFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private effectFrames = [
    "+*+*+*",
    "*+*+*+",
    "+*+*+*",
    "*+*+*+",
    ".,.,.,",
    ",.,.,,",
    ".,.,.,",
    ",.,.,,",
    "..,...",
    ".,....",
    "..,...",
    ".,....",
  ];

  constructor() {
    super();
  }

  /**
   * Start processing with steps
   */
  startProcessing(userInput: string): void {
    this.steps = this.generateProcessingSteps(userInput);
    this.executeStepsSequentially();
  }

  /**
   * Generate processing steps based on input
   */
  private generateProcessingSteps(input: string): ProcessingStep[] {
    const steps: ProcessingStep[] = [];

    // 1. Input analysis - always first
    steps.push({
      id: "input-analysis",
      name: "Input Analysis",
      description: "Analyzing user input and intent",
      status: "pending",
      mode: "Analyzing",
      symbol: "🔍",
    });

    // 2. Context gathering for questions or complex queries
    if (
      input.includes("?") ||
      input.toLowerCase().includes("what") ||
      input.toLowerCase().includes("how") ||
      input.toLowerCase().includes("why") ||
      input.toLowerCase().includes("explain")
    ) {
      steps.push({
        id: "context-gathering",
        name: "Knowledge Retrieval",
        description: "Gathering relevant information",
        status: "pending",
        mode: "Researching",
        symbol: "📚",
      });
    }

    // 3. Different processing modes based on input type
    if (
      input.toLowerCase().includes("code") ||
      input.toLowerCase().includes("program")
    ) {
      steps.push({
        id: "code-processing",
        name: "Code Processing",
        description: "Processing code-related request",
        status: "pending",
        mode: "Coding",
        symbol: "💻",
      });
    } else if (
      input.toLowerCase().includes("debug") ||
      input.toLowerCase().includes("error") ||
      input.toLowerCase().includes("fix")
    ) {
      steps.push({
        id: "debugging",
        name: "Problem Analysis",
        description: "Analyzing and debugging issue",
        status: "pending",
        mode: "Debugging",
        symbol: "🐛",
      });
    } else {
      steps.push({
        id: "thinking",
        name: "Deep Analysis",
        description: "Processing and reasoning",
        status: "pending",
        mode: "Thinking",
        symbol: "🧠",
      });
    }

    // 4. Response generation
    steps.push({
      id: "response-generation",
      name: "Response Generation",
      description: "Generating comprehensive response",
      status: "pending",
      mode: "Creating",
      symbol: "✍️",
    });

    return steps;
  }

  /**
   * Execute steps sequentially with visual feedback
   */
  private async executeStepsSequentially(): Promise<void> {
    for (const step of this.steps) {
      this.currentStep = step;
      step.status = "in_progress";

      // Only display new mode if it's different from previous
      const _currentMode = step.mode || "Processing";
      const _shouldShowMode =
        !this.previousMode || this.previousMode !== _currentMode;

      if (_shouldShowMode) {
        this.displayNewMode(step);
        this.previousMode = _currentMode;
      }

      this.startContinuousAnimation(step);

      // Simulate processing time
      await this.delay(this.getProcessingTime(step));

      this.stopAnimation();
      step.status = "completed";

      this.emit("step:completed", step);
    }

    this.emit("processing:completed");
  }

  /**
   * Display new mode when switching
   */
  private displayNewMode(step: ProcessingStep): void {
    const _modeDisplay =
      step.mode && step.symbol
        ? chalk.cyan(`✽ ${step.symbol} ${step.mode}...`)
        : chalk.cyan("✽ 🧠 Processing...");

    // Clear previous line and show new mode
    process.stdout.write("\r\u001b[K"); // Clear line
    process.stdout.write(_modeDisplay);
  }

  /**
   * Start continuous animation for current mode
   */
  private startContinuousAnimation(step: ProcessingStep): void {
    this.frameIndex = 0;
    this.effectIndex = 0;

    const _modeDisplay =
      step.mode && step.symbol
        ? `✽ ${step.symbol} ${step.mode}`
        : "✽ 🧠 Processing";

    this.animationInterval = setInterval(() => {
      const _spinner = this.animationFrames[this.frameIndex];
      const _effect = this.effectFrames[this.effectIndex];

      // Clear line and redraw with animation
      process.stdout.write("\r\u001b[K");
      process.stdout.write(chalk.cyan(_spinner + " " + _modeDisplay));
      process.stdout.write(chalk.dim(` ${_effect}`));

      this.frameIndex = (this.frameIndex + 1) % this.animationFrames.length;
      this.effectIndex = (this.effectIndex + 1) % this.effectFrames.length;
    }, 120); // Slightly slower for better readability
  }

  /**
   * Stop current animation
   */
  private stopAnimation(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
    if (this.effectInterval) {
      clearInterval(this.effectInterval);
      this.effectInterval = null;
    }
  }

  /**
   * Get processing time for different step types
   */
  private getProcessingTime(step: ProcessingStep): number {
    const _baseTimes = {
      "input-analysis": 600,
      "context-gathering": 900,
      "code-processing": 1200,
      debugging: 1100,
      thinking: 800,
      "response-generation": 1000,
    };

    return _baseTimes[step.id as keyof typeof _baseTimes] || 700;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current processing status
   */
  getCurrentStatus(): { step: ProcessingStep | null; _progress: number } {
    const _completedSteps = this.steps.filter(
      (s) => s.status === "completed",
    ).length;
    const _progress =
      this.steps.length > 0 ? (_completedSteps / this.steps.length) * 100 : 0;

    return {
      step: this.currentStep,
      _progress,
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopAnimation();
    this.steps = [];
    this.currentStep = null;
    this.previousMode = null;
    // Clear the current line
    process.stdout.write("\r\u001b[K");
  }

  /**
   * Show processing completed status
   */
  showCompleted(): void {
    this.stopAnimation();
    process.stdout.write("\r\u001b[K");
    console.log(chalk.green("✓ Processing completed"));
  }
}
