/**
 * Display Service - Visual Mode Display and Animation Microservice
 * Handles CLI visualization, animations, and status rendering
 */

import { BaseService } from "../../core/BaseService";
import { ServiceEvent } from "../../core/types";
import { Service } from "../../core/decorators/service.decorator";
import { EventHandler } from "../../core/decorators/event.decorator";

export interface DisplayConfig {
  enableAnimations: boolean;
  enableColors: boolean;
  animationSpeed: number;
  showTimestamp: boolean;
  showConfidence: boolean;
  compactMode: boolean;
}

export interface ModeDisplay {
  modeId: string;
  symbol: string;
  color: string;
  _text: string;
  animation?: string;
  timestamp?: number;
  confidence?: number;
}

export interface AnimationFrame {
  content: string;
  duration: number;
  color?: string;
}

@Service({
  id: "_display-service",
  version: "1.0.0",
  description: "Visual mode _display and animation service",
  dependencies: [],
  startupOrder: 3,
})
export class DisplayService extends BaseService {
  public readonly id = "_display-service";
  public readonly version = "1.0.0";

  private config: DisplayConfig = {
    enableAnimations: true,
    enableColors: true,
    animationSpeed: 500,
    showTimestamp: false,
    showConfidence: false,
    compactMode: false,
  };

  private currentDisplay: ModeDisplay | null = null;
  private animationInterval: NodeJS.Timeout | null = null;
  private spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private frameIndex = 0;

  async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing Display Service...`);
    await this.loadDisplayConfig();
    console.log(`[${this.id}] Display Service initialized`);
  }

  async onStart(): Promise<void> {
    console.log(`[${this.id}] Starting Display Service...`);
    this.emitServiceEvent("_display:ready", {
      service: this.id,
      config: this.config,
    });
  }

  async onStop(): Promise<void> {
    console.log(`[${this.id}] Stopping Display Service...`);
    this.stopAnimation();
  }

  /**
   * Display a mode with optional animation
   */
  async displayMode(_display: ModeDisplay): Promise<void> {
    this.currentDisplay = _display;

    if (this.config.enableAnimations && display.animation) {
      await this.startAnimation(_display);
    } else {
      await this.renderStatic(_display);
    }

    this.emitServiceEvent("_display:mode_shown", { _display });
  }

  /**
   * Update _display configuration
   */
  async updateConfig(newConfig: Partial<DisplayConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.emitServiceEvent("_display:config_updated", { config: this.config });
  }

  /**
   * Show mode transition animation
   */
  async showTransition(
    _fromMode: string,
    toMode: string,
    _duration: number = 1000,
  ): Promise<void> {
    if (!this.config.enableAnimations) {
      return;
    }

    const frames: AnimationFrame[] = [
      { content: `✽ ${_fromMode}...`, _duration: 200, color: "gray" },
      { content: `⠋ Switching...`, _duration: 300, color: "yellow" },
      { content: `⠙ Switching...`, _duration: 300, color: "yellow" },
      { content: `⠹ Switching...`, _duration: 200, color: "yellow" },
      { content: `✽ ${toMode}...`, _duration: 0, color: "cyan" },
    ];

    await this.playAnimation(frames);
    this.emitServiceEvent("_display:transition_shown", { _fromMode, toMode });
  }

  /**
   * Show processing spinner
   */
  async showSpinner(_text: string = "Processing..."): Promise<void> {
    if (!this.config.enableAnimations) {
      console.log(`✽ ${_text}`);
      return;
    }

    this.stopAnimation();
    this.frameIndex = 0;

    this.animationInterval = setInterval(() => {
      const _frame = this.spinnerFrames[this.frameIndex];
      process.stdout.write(`\r${this.colorize(_frame, "cyan")} ${_text}`);
      this.frameIndex = (this.frameIndex + 1) % this.spinnerFrames.length;
    }, this.config.animationSpeed / 10);
  }

  /**
   * Hide spinner and clear line
   */
  async hideSpinner(): Promise<void> {
    this.stopAnimation();
    process.stdout.write("\r\u001b[K"); // Clear line
  }

  /**
   * Show success message
   */
  async showSuccess(message: string): Promise<void> {
    const _display = this.formatMessage("✓", message, "green");
    console.log(_display);
    this.emitServiceEvent("_display:success_shown", { message });
  }

  /**
   * Show error message
   */
  async showError(message: string): Promise<void> {
    const _display = this.formatMessage("✗", message, "red");
    console.log(_display);
    this.emitServiceEvent("_display:error_shown", { message });
  }

  /**
   * Show warning message
   */
  async showWarning(message: string): Promise<void> {
    const _display = this.formatMessage("!", message, "yellow");
    console.log(_display);
    this.emitServiceEvent("_display:warning_shown", { message });
  }

  /**
   * Show info message
   */
  async showInfo(message: string): Promise<void> {
    const _display = this.formatMessage("i", message, "blue");
    console.log(_display);
    this.emitServiceEvent("_display:info_shown", { message });
  }

  /**
   * Clear current _display
   */
  async clear(): Promise<void> {
    this.stopAnimation();
    this.currentDisplay = null;
    process.stdout.write("\u001b[2J\u001b[0f"); // Clear screen and move cursor to top
    this.emitServiceEvent("_display:cleared", {});
  }

  /**
   * Render static mode _display
   */
  private async renderStatic(_display: ModeDisplay): Promise<void> {
    let output = "";

    // Add symbol and _text
    if (this.config.enableColors) {
      output += this.colorize(_display.symbol, _display.color);
    } else {
      output += _display.symbol;
    }

    output += ` ${_display.text}`;

    // Add confidence if enabled
    if (this.config.showConfidence && _display.confidence !== undefined) {
      const _confidencePercent = Math.round(_display.confidence * 100);
      output += ` (${_confidencePercent}%)`;
    }

    // Add timestamp if enabled
    if (this.config.showTimestamp && _display.timestamp) {
      const _time = new Date(_display.timestamp).toLocaleTimeString();
      output += ` [${_time}]`;
    }

    console.log(output);
  }

  /**
   * Start mode animation
   */
  private async startAnimation(_display: ModeDisplay): Promise<void> {
    if (display.animation === "pulse") {
      await this.playPulseAnimation(_display);
    } else if (display.animation === "typewriter") {
      await this.playTypewriterAnimation(_display);
    } else if (display.animation === "fade") {
      await this.playFadeAnimation(_display);
    } else {
      await this.renderStatic(_display);
    }
  }

  /**
   * Play pulse animation
   */
  private async playPulseAnimation(_display: ModeDisplay): Promise<void> {
    const frames: AnimationFrame[] = [
      {
        content: `${_display.symbol} ${_display.text}`,
        duration: 300,
        color: _display.color,
      },
      {
        content: `${_display.symbol} ${_display.text}`,
        duration: 300,
        color: "gray",
      },
      {
        content: `${_display.symbol} ${_display.text}`,
        duration: 300,
        color: _display.color,
      },
      {
        content: `${_display.symbol} ${_display.text}`,
        duration: 0,
        color: _display.color,
      },
    ];

    await this.playAnimation(frames);
  }

  /**
   * Play typewriter animation
   */
  private async playTypewriterAnimation(_display: ModeDisplay): Promise<void> {
    const _text = `${_display.symbol} ${_display._text}`;
    let current = "";

    for (let i = 0; i <= _text.length; i++) {
      current = _text.substring(0, i);
      process.stdout.write(`\r${this.colorize(current, _display.color)}`);
      await this.delay(50);
    }

    console.log(); // New line
  }

  /**
   * Play fade animation
   */
  private async playFadeAnimation(_display: ModeDisplay): Promise<void> {
    const _text = `${_display.symbol} ${_display._text}`;
    const _colors = ["gray", "gray", _display.color];

    for (const color of _colors) {
      process.stdout.write(`\r${this.colorize(_text, color)}`);
      await this.delay(200);
    }

    console.log(); // New line
  }

  /**
   * Play animation sequence
   */
  private async playAnimation(frames: AnimationFrame[]): Promise<void> {
    for (const _frame of frames) {
      if (_frame.duration > 0) {
        process.stdout.write(
          `\r${this.colorize(_frame.content, _frame.color || "white")}`,
        );
        await this.delay(_frame.duration);
      } else {
        console.log(
          `\r${this.colorize(_frame.content, _frame.color || "white")}`,
        );
      }
    }
  }

  /**
   * Stop current animation
   */
  private stopAnimation(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  /**
   * Apply color to _text
   */
  private colorize(_text: string, color: string): string {
    if (!this.config.enableColors) {
      return _text;
    }

    const _colors: Record<string, string> = {
      red: "\u001b[31m",
      green: "\u001b[32m",
      yellow: "\u001b[33m",
      blue: "\u001b[34m",
      magenta: "\u001b[35m",
      cyan: "\u001b[36m",
      white: "\u001b[37m",
      gray: "\u001b[90m",
      reset: "\u001b[0m",
    };

    const _colorCode = _colors[color] || _colors.white;
    return `${_colorCode}${_text}${_colors.reset}`;
  }

  /**
   * Format message with symbol and color
   */
  private formatMessage(
    _symbol: string,
    message: string,
    color: string,
  ): string {
    let output = "";

    if (this.config.enableColors) {
      output = this.colorize(_symbol, color);
    } else {
      output = _symbol;
    }

    output += ` ${message}`;

    if (this.config.showTimestamp) {
      const _time = new Date().toLocaleTimeString();
      output += ` [${_time}]`;
    }

    return output;
  }

  /**
   * Delay utility for animations
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Load _display configuration
   */
  private async loadDisplayConfig(): Promise<void> {
    // Future: Load from user preferences or configuration file
    console.log(`[${this.id}] Loading default _display configuration`);
  }

  @EventHandler("mode:transition")
  async handleModeTransition(event: ServiceEvent): Promise<void> {
    const { transition, mode } = event.data;

    // Show transition animation
    await this.showTransition(transition.fromMode, transition.toMode);

    // Display new mode
    const _display: ModeDisplay = {
      modeId: mode.id,
      symbol: mode.symbol,
      color: mode.color,
      _text: `${mode.name}...`,
      animation: "pulse",
      timestamp: Date.now(),
      confidence: transition.confidence,
    };

    await this.displayMode(_display);
  }

  @EventHandler("recognition:complete")
  async handleRecognitionComplete(event: ServiceEvent): Promise<void> {
    const { result } = event.data;

    if (result.confidence < 0.85) {
      // Show low confidence warning
      await this.showWarning(
        `Mode suggestion: ${result.recommendedMode} (${Math.round(result.confidence * 100)}% confidence)`,
      );
    }
  }

  @EventHandler("error:occurred")
  async handleError(event: ServiceEvent): Promise<void> {
    const { error, _context } = event.data;
    await this.showError(`Error: ${error.message}`);
  }

  /**
   * Get current _display status
   */
  getCurrentDisplay(): ModeDisplay | null {
    return this.currentDisplay;
  }

  /**
   * Get _display statistics
   */
  async getStatistics(): Promise<unknown> {
    return {
      service: this.id,
      config: this.config,
      currentDisplay: this.currentDisplay,
      animationActive: this.animationInterval !== null,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}
