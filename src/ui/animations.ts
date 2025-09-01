/**
 * Rich Animation Library for AI Response Visualization
 * 多様なAI応答可視化のためのリッチアニメーションライブラリ
 */

import chalk from "chalk";
import ora, { Ora } from "ora";

/**
 * Animation types for different contexts
 */
export enum AnimationType {
  SIMPLE = "simple",
  PROCESS = "process",
  CREATIVE = "creative",
  ANALYTICAL = "analytical",
  RESEARCH = "research",
  CODING = "coding",
  LOADING = "loading",
  ERROR_FIXING = "error_fixing",
  OPTIMIZATION = "optimization"
}

/**
 * Animation configuration
 */
interface AnimationConfig {
  type: AnimationType;
  message?: string;
  showTimer?: boolean;
  showPhases?: boolean;
  customFrames?: string[];
  customMessages?: string[];
}

/**
 * Base animation class
 */
abstract class BaseAnimation {
  protected spinner: Ora;
  protected startTime: number;
  protected currentPhase = 0;
  protected phaseInterval?: NodeJS.Timeout;
  
  constructor(protected config: AnimationConfig) {
    this.spinner = ora({
      text: this.getInitialText(),
      spinner: this.getSpinnerConfig(),
      color: this.getColor()
    });
    this.startTime = Date.now();
  }
  
  abstract getInitialText(): string;
  abstract getSpinnerConfig(): any;
  abstract getColor(): string;
  
  protected getElapsedTime(): string {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    return `[${elapsed}s]`;
  }
  
  start(): void {
    this.spinner.start();
    if (this.config.showPhases) {
      this.startPhaseAnimation();
    }
  }
  
  stop(): void {
    if (this.phaseInterval) {
      clearInterval(this.phaseInterval);
    }
    this.spinner.stop();
  }
  
  succeed(text?: string): void {
    this.stop();
    this.spinner.succeed(text);
  }
  
  fail(text?: string): void {
    this.stop();
    this.spinner.fail(text);
  }
  
  protected startPhaseAnimation(): void {
    // Override in subclasses
  }
}

/**
 * Simple thinking animation
 */
class SimpleAnimation extends BaseAnimation {
  getInitialText(): string {
    return this.config.message || "Thinking...";
  }
  
  getSpinnerConfig() {
    return {
      frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
      interval: 80
    };
  }
  
  getColor(): string {
    return "cyan";
  }
}

/**
 * Process animation with phases
 */
class ProcessAnimation extends BaseAnimation {
  private phases = [
    "🧠 Understanding your request",
    "🔍 Analyzing context",
    "💭 Reasoning through the problem",
    "✨ Generating response",
    "📝 Formatting output"
  ];
  
  getInitialText(): string {
    return `${this.phases[0]}...`;
  }
  
  getSpinnerConfig() {
    return {
      frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
      interval: 80
    };
  }
  
  getColor(): string {
    return "cyan";
  }
  
  protected startPhaseAnimation(): void {
    this.phaseInterval = setInterval(() => {
      this.currentPhase = (this.currentPhase + 1) % this.phases.length;
      const timer = this.config.showTimer ? ` ${this.getElapsedTime()}` : "";
      this.spinner.text = `${this.phases[this.currentPhase]}...${timer}`;
    }, 3000);
  }
}

/**
 * Creative thinking animation with emojis
 */
class CreativeAnimation extends BaseAnimation {
  private phases = [
    "🎨 Imagining possibilities",
    "💡 Generating ideas",
    "🌟 Exploring creative solutions",
    "🎭 Crafting unique approach",
    "✨ Bringing ideas to life"
  ];
  
  private emojiFrames = ["🎨", "💡", "🌟", "🎭", "✨", "🎪", "🎯", "🚀"];
  
  getInitialText(): string {
    return `${this.phases[0]}...`;
  }
  
  getSpinnerConfig() {
    return {
      frames: this.emojiFrames,
      interval: 200
    };
  }
  
  getColor(): string {
    return "magenta";
  }
  
  protected startPhaseAnimation(): void {
    this.phaseInterval = setInterval(() => {
      this.currentPhase = (this.currentPhase + 1) % this.phases.length;
      const timer = this.config.showTimer ? ` ${this.getElapsedTime()}` : "";
      this.spinner.text = `${this.phases[this.currentPhase]}...${timer}`;
    }, 2500);
  }
}

/**
 * Analytical animation for data/research
 */
class AnalyticalAnimation extends BaseAnimation {
  private phases = [
    "📊 Gathering data",
    "📈 Analyzing patterns",
    "🔬 Examining evidence",
    "📉 Processing metrics",
    "📋 Compiling results"
  ];
  
  getInitialText(): string {
    return `${this.phases[0]}...`;
  }
  
  getSpinnerConfig() {
    return {
      frames: ["◐", "◓", "◑", "◒"],
      interval: 120
    };
  }
  
  getColor(): string {
    return "blue";
  }
  
  protected startPhaseAnimation(): void {
    this.phaseInterval = setInterval(() => {
      this.currentPhase = (this.currentPhase + 1) % this.phases.length;
      const timer = this.config.showTimer ? ` ${this.getElapsedTime()}` : "";
      this.spinner.text = `${this.phases[this.currentPhase]}...${timer}`;
    }, 2800);
  }
}

/**
 * Research animation
 */
class ResearchAnimation extends BaseAnimation {
  private phases = [
    "🔎 Searching knowledge base",
    "📚 Reading documentation",
    "🗂️ Organizing information",
    "🔗 Connecting concepts",
    "📖 Preparing explanation"
  ];
  
  getInitialText(): string {
    return `${this.phases[0]}...`;
  }
  
  getSpinnerConfig() {
    return {
      frames: ["🔍", "🔎", "📚", "📖", "🗂️", "📋"],
      interval: 300
    };
  }
  
  getColor(): string {
    return "yellow";
  }
  
  protected startPhaseAnimation(): void {
    this.phaseInterval = setInterval(() => {
      this.currentPhase = (this.currentPhase + 1) % this.phases.length;
      const timer = this.config.showTimer ? ` ${this.getElapsedTime()}` : "";
      this.spinner.text = `${this.phases[this.currentPhase]}...${timer}`;
    }, 3200);
  }
}

/**
 * Coding animation
 */
class CodingAnimation extends BaseAnimation {
  private phases = [
    "💻 Setting up environment",
    "⚙️ Analyzing requirements",
    "🔧 Writing code",
    "🐛 Testing implementation",
    "✅ Finalizing solution"
  ];
  
  private codeFrames = [
    "{ }",
    "{ . }",
    "{ .. }",
    "{ ... }",
    "{ .... }",
    "{ ..... }",
    "{ ...... }",
    "{ ....... }",
    "{ ........ }",
    "{ ......... }",
    "{ .......... }",
    "{ ........... }",
    "{ ............ }",
    "{ ............. }",
    "{ .............. }",
    "{ ............... }",
    "{ ................ }",
    "{ ................. }",
    "{ .................. }",
    "{ ................... }",
    "{ .................... }"
  ];
  
  getInitialText(): string {
    return `${this.phases[0]}...`;
  }
  
  getSpinnerConfig() {
    return {
      frames: this.codeFrames,
      interval: 50
    };
  }
  
  getColor(): string {
    return "green";
  }
  
  protected startPhaseAnimation(): void {
    this.phaseInterval = setInterval(() => {
      this.currentPhase = (this.currentPhase + 1) % this.phases.length;
      const timer = this.config.showTimer ? ` ${this.getElapsedTime()}` : "";
      this.spinner.text = `${this.phases[this.currentPhase]}...${timer}`;
    }, 4000);
  }
}

/**
 * Error fixing animation
 */
class ErrorFixingAnimation extends BaseAnimation {
  private phases = [
    "🔴 Detecting errors",
    "🟡 Analyzing issues",
    "🔧 Applying fixes",
    "🟢 Validating solution",
    "✅ Errors resolved"
  ];
  
  private errorFrames = ["🔴", "🟡", "🟠", "🟢"];
  
  getInitialText(): string {
    return `${this.phases[0]}...`;
  }
  
  getSpinnerConfig() {
    return {
      frames: this.errorFrames,
      interval: 250
    };
  }
  
  getColor(): string {
    return "red";
  }
  
  protected startPhaseAnimation(): void {
    this.phaseInterval = setInterval(() => {
      this.currentPhase = (this.currentPhase + 1) % this.phases.length;
      const timer = this.config.showTimer ? ` ${this.getElapsedTime()}` : "";
      this.spinner.text = `${this.phases[this.currentPhase]}...${timer}`;
      
      // Change color based on phase
      if (this.currentPhase === 0) this.spinner.color = "red";
      else if (this.currentPhase === 1) this.spinner.color = "yellow";
      else if (this.currentPhase >= 3) this.spinner.color = "green";
    }, 2500);
  }
}

/**
 * Optimization animation
 */
class OptimizationAnimation extends BaseAnimation {
  private phases = [
    "⚡ Analyzing performance",
    "📊 Measuring metrics",
    "🔄 Optimizing algorithms",
    "🚀 Enhancing efficiency",
    "💎 Finalizing improvements"
  ];
  
  private speedFrames = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"];
  
  getInitialText(): string {
    return `${this.phases[0]}...`;
  }
  
  getSpinnerConfig() {
    return {
      frames: this.speedFrames,
      interval: 60
    };
  }
  
  getColor(): string {
    return "cyan";
  }
  
  protected startPhaseAnimation(): void {
    this.phaseInterval = setInterval(() => {
      this.currentPhase = (this.currentPhase + 1) % this.phases.length;
      const timer = this.config.showTimer ? ` ${this.getElapsedTime()}` : "";
      this.spinner.text = `${this.phases[this.currentPhase]}...${timer}`;
    }, 3500);
  }
}

/**
 * Loading dots animation
 */
class LoadingAnimation extends BaseAnimation {
  getInitialText(): string {
    return this.config.message || "Loading";
  }
  
  getSpinnerConfig() {
    return "dots";
  }
  
  getColor(): string {
    return "gray";
  }
}

/**
 * Animation factory
 */
export class AnimationFactory {
  /**
   * Create animation based on context
   */
  static create(config: AnimationConfig): BaseAnimation {
    switch (config.type) {
      case AnimationType.SIMPLE:
        return new SimpleAnimation(config);
      case AnimationType.PROCESS:
        return new ProcessAnimation(config);
      case AnimationType.CREATIVE:
        return new CreativeAnimation(config);
      case AnimationType.ANALYTICAL:
        return new AnalyticalAnimation(config);
      case AnimationType.RESEARCH:
        return new ResearchAnimation(config);
      case AnimationType.CODING:
        return new CodingAnimation(config);
      case AnimationType.ERROR_FIXING:
        return new ErrorFixingAnimation(config);
      case AnimationType.OPTIMIZATION:
        return new OptimizationAnimation(config);
      case AnimationType.LOADING:
        return new LoadingAnimation(config);
      default:
        return new SimpleAnimation(config);
    }
  }
  
  /**
   * Detect animation type from question content
   */
  static detectType(question: string): AnimationType {
    const lower = question.toLowerCase();
    
    // Error fixing
    if (lower.includes("error") || lower.includes("fix") || lower.includes("bug") || 
        lower.includes("issue") || lower.includes("problem")) {
      return AnimationType.ERROR_FIXING;
    }
    
    // Coding
    if (lower.includes("code") || lower.includes("implement") || lower.includes("function") ||
        lower.includes("class") || lower.includes("api") || lower.includes("develop")) {
      return AnimationType.CODING;
    }
    
    // Creative
    if (lower.includes("create") || lower.includes("design") || lower.includes("imagine") ||
        lower.includes("innovative") || lower.includes("creative")) {
      return AnimationType.CREATIVE;
    }
    
    // Research
    if (lower.includes("research") || lower.includes("documentation") || lower.includes("explain") ||
        lower.includes("tutorial") || lower.includes("guide") || lower.includes("learn")) {
      return AnimationType.RESEARCH;
    }
    
    // Analytical
    if (lower.includes("analyze") || lower.includes("compare") || lower.includes("data") ||
        lower.includes("statistics") || lower.includes("metrics") || lower.includes("performance")) {
      return AnimationType.ANALYTICAL;
    }
    
    // Optimization
    if (lower.includes("optimize") || lower.includes("improve") || lower.includes("enhance") ||
        lower.includes("speed") || lower.includes("efficient")) {
      return AnimationType.OPTIMIZATION;
    }
    
    // Complex questions (long or with multiple keywords)
    if (question.length > 100 || 
        (lower.includes("how") && lower.includes("why")) ||
        lower.includes("detail") || lower.includes("comprehensive")) {
      return AnimationType.PROCESS;
    }
    
    // Default to simple
    return AnimationType.SIMPLE;
  }
}

/**
 * Smart animation manager with context awareness
 */
export class SmartAnimationManager {
  private currentAnimation?: BaseAnimation;
  private questionHistory: string[] = [];
  
  /**
   * Start animation based on question
   */
  startAnimation(question: string, customType?: AnimationType): BaseAnimation {
    // Stop any existing animation
    this.stopAnimation();
    
    // Detect type or use custom
    const type = customType || AnimationFactory.detectType(question);
    
    // Determine if we should show timer/phases based on complexity
    const isComplex = question.length > 50 || 
                     type !== AnimationType.SIMPLE;
    
    // Create and start animation
    this.currentAnimation = AnimationFactory.create({
      type,
      showTimer: isComplex,
      showPhases: type !== AnimationType.SIMPLE && type !== AnimationType.LOADING
    });
    
    this.currentAnimation.start();
    this.questionHistory.push(question);
    
    return this.currentAnimation;
  }
  
  /**
   * Stop current animation
   */
  stopAnimation(success = true, message?: string): void {
    if (this.currentAnimation) {
      if (success) {
        this.currentAnimation.succeed(message || "✅ Complete!");
      } else {
        this.currentAnimation.fail(message || "❌ Failed");
      }
      this.currentAnimation = undefined;
    }
  }
  
  /**
   * Get animation statistics
   */
  getStats() {
    return {
      totalQuestions: this.questionHistory.length,
      averageLength: this.questionHistory.reduce((sum, q) => sum + q.length, 0) / this.questionHistory.length || 0
    };
  }
}

// Export singleton instance
export const animationManager = new SmartAnimationManager();

// Export CodeGenerationAnimator for /code command
export { CodeGenerationAnimator } from '../services/code-quality/CodeGenerationAnimator';