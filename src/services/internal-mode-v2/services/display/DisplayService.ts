/**
 * Display Service - Visual Mode Display and Animation Microservice
 * Handles CLI visualization, animations, and status rendering
 */

import { BaseService } from '../../core/BaseService.js';
import { ServiceEvent } from '../../core/types.js';
import { Service } from '../../core/decorators/service.decorator.js';
import { EventHandler } from '../../core/decorators/event.decorator.js';

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
  text: string;
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
  id: 'display-service',
  version: '1.0.0',
  description: 'Visual mode display and animation service',
  dependencies: [],
  startupOrder: 3,
})
export class DisplayService extends BaseService {
  public readonly id = 'display-service';
  public readonly version = '1.0.0';

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
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;

  async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing Display Service...`);
    await this.loadDisplayConfig();
    console.log(`[${this.id}] Display Service initialized`);
  }

  async onStart(): Promise<void> {
    console.log(`[${this.id}] Starting Display Service...`);
    this.emitServiceEvent('display:ready', {
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
  async displayMode(display: ModeDisplay): Promise<void> {
    this.currentDisplay = display;

    if (this.config.enableAnimations && display.animation) {
      await this.startAnimation(display);
    } else {
      await this.renderStatic(display);
    }

    this.emitServiceEvent('display:mode_shown', { display });
  }

  /**
   * Update display configuration
   */
  async updateConfig(newConfig: Partial<DisplayConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.emitServiceEvent('display:config_updated', { config: this.config });
  }

  /**
   * Show mode transition animation
   */
  async showTransition(fromMode: string, toMode: string, duration: number = 1000): Promise<void> {
    if (!this.config.enableAnimations) {
      return;
    }

    const frames: AnimationFrame[] = [
      { content: `✽ ${fromMode}...`, duration: 200, color: 'gray' },
      { content: `⠋ Switching...`, duration: 300, color: 'yellow' },
      { content: `⠙ Switching...`, duration: 300, color: 'yellow' },
      { content: `⠹ Switching...`, duration: 200, color: 'yellow' },
      { content: `✽ ${toMode}...`, duration: 0, color: 'cyan' },
    ];

    await this.playAnimation(frames);
    this.emitServiceEvent('display:transition_shown', { fromMode, toMode });
  }

  /**
   * Show processing spinner
   */
  async showSpinner(text: string = 'Processing...'): Promise<void> {
    if (!this.config.enableAnimations) {
      console.log(`✽ ${text}`);
      return;
    }

    this.stopAnimation();
    this.frameIndex = 0;

    this.animationInterval = setInterval(() => {
      const frame = this.spinnerFrames[this.frameIndex];
      process.stdout.write(`\r${this.colorize(frame, 'cyan')} ${text}`);
      this.frameIndex = (this.frameIndex + 1) % this.spinnerFrames.length;
    }, this.config.animationSpeed / 10);
  }

  /**
   * Hide spinner and clear line
   */
  async hideSpinner(): Promise<void> {
    this.stopAnimation();
    process.stdout.write('\r\x1b[K'); // Clear line
  }

  /**
   * Show success message
   */
  async showSuccess(message: string): Promise<void> {
    const display = this.formatMessage('✓', message, 'green');
    console.log(display);
    this.emitServiceEvent('display:success_shown', { message });
  }

  /**
   * Show error message
   */
  async showError(message: string): Promise<void> {
    const display = this.formatMessage('✗', message, 'red');
    console.log(display);
    this.emitServiceEvent('display:error_shown', { message });
  }

  /**
   * Show warning message
   */
  async showWarning(message: string): Promise<void> {
    const display = this.formatMessage('!', message, 'yellow');
    console.log(display);
    this.emitServiceEvent('display:warning_shown', { message });
  }

  /**
   * Show info message
   */
  async showInfo(message: string): Promise<void> {
    const display = this.formatMessage('i', message, 'blue');
    console.log(display);
    this.emitServiceEvent('display:info_shown', { message });
  }

  /**
   * Clear current display
   */
  async clear(): Promise<void> {
    this.stopAnimation();
    this.currentDisplay = null;
    process.stdout.write('\x1b[2J\x1b[0f'); // Clear screen and move cursor to top
    this.emitServiceEvent('display:cleared', {});
  }

  /**
   * Render static mode display
   */
  private async renderStatic(display: ModeDisplay): Promise<void> {
    let output = '';

    // Add symbol and text
    if (this.config.enableColors) {
      output += this.colorize(display.symbol, display.color);
    } else {
      output += display.symbol;
    }

    output += ` ${display.text}`;

    // Add confidence if enabled
    if (this.config.showConfidence && display.confidence !== undefined) {
      const confidencePercent = Math.round(display.confidence * 100);
      output += ` (${confidencePercent}%)`;
    }

    // Add timestamp if enabled
    if (this.config.showTimestamp && display.timestamp) {
      const time = new Date(display.timestamp).toLocaleTimeString();
      output += ` [${time}]`;
    }

    console.log(output);
  }

  /**
   * Start mode animation
   */
  private async startAnimation(display: ModeDisplay): Promise<void> {
    if (display.animation === 'pulse') {
      await this.playPulseAnimation(display);
    } else if (display.animation === 'typewriter') {
      await this.playTypewriterAnimation(display);
    } else if (display.animation === 'fade') {
      await this.playFadeAnimation(display);
    } else {
      await this.renderStatic(display);
    }
  }

  /**
   * Play pulse animation
   */
  private async playPulseAnimation(display: ModeDisplay): Promise<void> {
    const frames: AnimationFrame[] = [
      { content: `${display.symbol} ${display.text}`, duration: 300, color: display.color },
      { content: `${display.symbol} ${display.text}`, duration: 300, color: 'gray' },
      { content: `${display.symbol} ${display.text}`, duration: 300, color: display.color },
      { content: `${display.symbol} ${display.text}`, duration: 0, color: display.color },
    ];

    await this.playAnimation(frames);
  }

  /**
   * Play typewriter animation
   */
  private async playTypewriterAnimation(display: ModeDisplay): Promise<void> {
    const text = `${display.symbol} ${display.text}`;
    let current = '';

    for (let i = 0; i <= text.length; i++) {
      current = text.substring(0, i);
      process.stdout.write(`\r${this.colorize(current, display.color)}`);
      await this.delay(50);
    }

    console.log(); // New line
  }

  /**
   * Play fade animation
   */
  private async playFadeAnimation(display: ModeDisplay): Promise<void> {
    const text = `${display.symbol} ${display.text}`;
    const colors = ['gray', 'gray', display.color];

    for (const color of colors) {
      process.stdout.write(`\r${this.colorize(text, color)}`);
      await this.delay(200);
    }

    console.log(); // New line
  }

  /**
   * Play animation sequence
   */
  private async playAnimation(frames: AnimationFrame[]): Promise<void> {
    for (const frame of frames) {
      if (frame.duration > 0) {
        process.stdout.write(`\r${this.colorize(frame.content, frame.color || 'white')}`);
        await this.delay(frame.duration);
      } else {
        console.log(`\r${this.colorize(frame.content, frame.color || 'white')}`);
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
   * Apply color to text
   */
  private colorize(text: string, color: string): string {
    if (!this.config.enableColors) {
      return text;
    }

    const colors: Record<string, string> = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      gray: '\x1b[90m',
      reset: '\x1b[0m',
    };

    const colorCode = colors[color] || colors.white;
    return `${colorCode}${text}${colors.reset}`;
  }

  /**
   * Format message with symbol and color
   */
  private formatMessage(symbol: string, message: string, color: string): string {
    let output = '';

    if (this.config.enableColors) {
      output = this.colorize(symbol, color);
    } else {
      output = symbol;
    }

    output += ` ${message}`;

    if (this.config.showTimestamp) {
      const time = new Date().toLocaleTimeString();
      output += ` [${time}]`;
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
   * Load display configuration
   */
  private async loadDisplayConfig(): Promise<void> {
    // Future: Load from user preferences or configuration file
    console.log(`[${this.id}] Loading default display configuration`);
  }

  @EventHandler('mode:transition')
  async handleModeTransition(event: ServiceEvent): Promise<void> {
    const { transition, mode } = event.data;

    // Show transition animation
    await this.showTransition(transition.fromMode, transition.toMode);

    // Display new mode
    const display: ModeDisplay = {
      modeId: mode.id,
      symbol: mode.symbol,
      color: mode.color,
      text: `${mode.name}...`,
      animation: 'pulse',
      timestamp: Date.now(),
      confidence: transition.confidence,
    };

    await this.displayMode(display);
  }

  @EventHandler('recognition:complete')
  async handleRecognitionComplete(event: ServiceEvent): Promise<void> {
    const { result } = event.data;

    if (result.confidence < 0.85) {
      // Show low confidence warning
      await this.showWarning(
        `Mode suggestion: ${result.recommendedMode} (${Math.round(result.confidence * 100)}% confidence)`,
      );
    }
  }

  @EventHandler('error:occurred')
  async handleError(event: ServiceEvent): Promise<void> {
    const { error, context } = event.data;
    await this.showError(`Error: ${error.message}`);
  }

  /**
   * Get current display status
   */
  getCurrentDisplay(): ModeDisplay | null {
    return this.currentDisplay;
  }

  /**
   * Get display statistics
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
