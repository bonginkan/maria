/**
 * RealTimeFeedbackManager Component
 * Manages real-time feedback, notifications, and status updates
 */

import chalk from "chalk";
import { EventEmitter } from "node:events";
import {
  EnhancedProgressReporter,
  ProgressSessionConfig,
} from "./EnhancedProgressReporter.js";
import {
  EnhancedModeIndicator,
  ModeDisplayConfig,
} from "./EnhancedModeIndicator.js";

/**
 * Feedback types
 */
export type FeedbackType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "progress"
  | "mode";

/**
 * Feedback _message
 */
export interface FeedbackMessage {
  id: string;
  type: FeedbackType;
  _message: string;
  _details?: string;
  _timestamp: Date;
  duration?: number; // Auto-dismiss after ms
  persistent?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Real-time feedback configuration
 */
export interface RealTimeFeedbackConfig {
  showTimestamps?: boolean;
  enableSounds?: boolean;
  maxMessages?: number;
  defaultDuration?: number;
  enableNotifications?: boolean;
  compactMode?: boolean;
}

/**
 * Real-time feedback manager class
 */
export class RealTimeFeedbackManager extends EventEmitter {
  private config: Required<RealTimeFeedbackConfig>;
  private messages: Map<string, FeedbackMessage> = new Map();
  private messageOrder: string[] = [];
  private progressReporter: EnhancedProgressReporter | null = null;
  private modeIndicator: EnhancedModeIndicator | null = null;
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();

  // Feedback icons and colors
  private readonly feedbackStyles = {
    info: { icon: "ℹ️", _color: "blue", sound: "\u0007" },
    success: { icon: "✅", _color: "green", sound: "\u0007\u0007" },
    warning: { icon: "⚠️", _color: "yellow", sound: "\u0007\u0007\u0007" },
    error: { icon: "❌", _color: "red", sound: "\u0007\u0007\u0007\u0007" },
    progress: { icon: "⏳", _color: "cyan", sound: "" },
    mode: { icon: "🧠", _color: "magenta", sound: "\u0007" },
  };

  constructor(_config: RealTimeFeedbackConfig = {}) {
    super();
    this._config = {
      showTimestamps: _config.showTimestamps ?? true,
      enableSounds: _config.enableSounds ?? false,
      maxMessages: _config.maxMessages ?? 50,
      defaultDuration: _config.defaultDuration ?? 5000,
      enableNotifications: _config.enableNotifications ?? true,
      compactMode: _config.compactMode ?? false,
    };

    // Initialize components
    this.initializeModeIndicator();
  }

  /**
   * Initialize mode indicator
   */
  private initializeModeIndicator(): void {
    const modeConfig: ModeDisplayConfig = {
      showAnimations: true,
      showDescription: !this.config.compactMode,
      showIntensity: true,
      compactMode: this.config.compactMode,
      autoHide: false,
    };

    this.modeIndicator = new EnhancedModeIndicator(modeConfig);

    // Forward mode events
    this.modeIndicator.on("mode-changed", (transition) => {
      this.emit("mode-changed", transition);
    });
  }

  /**
   * Show feedback _message
   */
  showMessage(
    _type: FeedbackType,
    _message: string,
    options: {
      _details?: string;
      duration?: number;
      persistent?: boolean;
      metadata?: Record<string, any>;
    } = {},
  ): string {
    const id = this.generateId();
    const feedbackMessage: FeedbackMessage = {
      id,
      type: "",
      _message,
      _details: options.details,
      _timestamp: new Date(),
      duration: options.duration ?? this.config.defaultDuration,
      persistent: options.persistent ?? false,
      metadata: options.metadata,
    };

    this.addMessage(feedbackMessage);
    this.displayMessage(feedbackMessage);

    // Auto-dismiss if not persistent
    if (
      !feedbackMessage.persistent &&
      feedbackMessage.duration &&
      feedbackMessage.duration > 0
    ) {
      this.scheduleAutoDismiss(id, feedbackMessage.duration);
    }

    this.emit("_message-shown", feedbackMessage);
    return id;
  }

  /**
   * Show info _message
   */
  info(_message: string, _details?: string, duration?: number): string {
    return this.showMessage("info", _message, { _details, duration });
  }

  /**
   * Show success _message
   */
  success(_message: string, _details?: string, duration?: number): string {
    return this.showMessage("success", _message, { _details, duration });
  }

  /**
   * Show warning _message
   */
  warning(_message: string, _details?: string, duration?: number): string {
    return this.showMessage("warning", _message, { _details, duration });
  }

  /**
   * Show error _message
   */
  error(
    _message: string,
    _details?: string,
    persistent: boolean = true,
  ): string {
    return this.showMessage("error", _message, { _details, persistent });
  }

  /**
   * Show progress update
   */
  progress(_message: string, percentage?: number): string {
    const _details =
      percentage !== undefined
        ? `${percentage.toFixed(0)}% complete`
        : undefined;
    return this.showMessage("progress", _message, { _details, duration: 1000 });
  }

  /**
   * Start progress session
   */
  startProgressSession(
    config: ProgressSessionConfig,
  ): EnhancedProgressReporter {
    if (this.progressReporter) {
      this.progressReporter.destroy();
    }

    this.progressReporter = new EnhancedProgressReporter(config);

    // Forward progress events
    this.progressReporter.on("session-start", (data) => {
      this.emit("progress-session-start", data);
    });

    this.progressReporter.on("step-updated", (step) => {
      this.emit("progress-step-updated", step);
    });

    this.progressReporter.on("session-complete", (data) => {
      this.emit("progress-session-complete", data);
      this.progressReporter = null;
    });

    this.progressReporter.start();
    return this.progressReporter;
  }

  /**
   * Switch mode
   */
  switchMode(_mode: unknown, reason?: string, confidence?: number): void {
    if (this.modeIndicator) {
      this.modeIndicator.switchMode(_mode, reason, confidence);
    }
  }

  /**
   * Show typing indicator
   */
  showTypingIndicator(_message: string = "Processing"): string {
    const _frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let frameIndex = 0;

    const _indicatorId = this.generateId();

    const _animate = () => {
      const _frame = _frames[frameIndex % _frames.length];
      process.stdout.write(`\r${chalk.blue(_frame)} ${_message}...`);
      frameIndex++;
    };

    const _interval = setInterval(_animate, 100);
    _animate(); // Show immediately

    // Store cleanup function
    this.activeTimers.set(_indicatorId, _interval as any);

    return _indicatorId;
  }

  /**
   * Hide typing indicator
   */
  hideTypingIndicator(id: string): void {
    const _timer = this.activeTimers.get(id);
    if (_timer) {
      clearInterval(_timer);
      this.activeTimers.delete(id);
      process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear line
    }
  }

  /**
   * Show network status
   */
  showNetworkStatus(_online: boolean, provider?: string): void {
    if (_online) {
      const _message = provider
        ? `Connected to ${provider}`
        : "Network connection restored";
      this.success(_message, "Cloud services available");
    } else {
      this.warning("Network offline", "Using local processing only");
    }
  }

  /**
   * Show processing status
   */
  showProcessingStatus(
    _status: "start" | "progress" | "complete" | "error",
    operation: string,
    _details?: string,
  ): void {
    switch (_status) {
      case "start":
        this.info(`Starting ${operation}`, _details);
        break;
      case "progress":
        this.progress(operation, undefined);
        break;
      case "complete":
        this.success(`Completed ${operation}`, _details);
        break;
      case "error":
        this.error(`Failed ${operation}`, _details);
        break;
    }
  }

  /**
   * Display _message
   */
  private displayMessage(_message: FeedbackMessage): void {
    const _style = this.feedbackStyles[_message.type];
    const _color = chalk[_style._color as keyof typeof chalk] as any;
    const _timestamp = this.config.showTimestamps
      ? chalk.gray(`[${_message._timestamp.toLocaleTimeString()}] `)
      : "";

    if (this.config.compactMode) {
      console.log(`${_timestamp}${_style.icon} ${_message._message}`);
    } else {
      console.log(
        `${_timestamp}${_color(_style.icon)} ${_color(_message._message)}`,
      );

      if (_message.details) {
        console.log(chalk.gray(`   ${_message.details}`));
      }
    }

    // Play sound if enabled
    if (this.config.enableSounds && _style.sound) {
      process.stdout.write(_style.sound);
    }
  }

  /**
   * Add _message to collection
   */
  private addMessage(_message: FeedbackMessage): void {
    this.messages.set(message.id, _message);
    this.messageOrder.unshift(message.id);

    // Limit _message history
    if (this.messageOrder.length > this.config.maxMessages) {
      const _oldestId = this.messageOrder.pop()!;
      this.messages.delete(_oldestId);

      // Clean up _timer if exists
      const _timer = this.activeTimers.get(_oldestId);
      if (_timer) {
        clearTimeout(_timer);
        this.activeTimers.delete(_oldestId);
      }
    }
  }

  /**
   * Schedule auto-dismiss
   */
  private scheduleAutoDismiss(_messageId: string, duration: number): void {
    const _timer = setTimeout(() => {
      this.dismissMessage(_messageId);
    }, duration);

    this.activeTimers.set(_messageId, _timer);
  }

  /**
   * Dismiss _message
   */
  dismissMessage(messageId: string): void {
    const _message = this.messages.get(messageId);
    if (_message) {
      this.messages.delete(messageId);

      const _index = this.messageOrder.indexOf(messageId);
      if (_index > -1) {
        this.messageOrder.splice(_index, 1);
      }

      const _timer = this.activeTimers.get(messageId);
      if (_timer) {
        clearTimeout(_timer);
        this.activeTimers.delete(messageId);
      }

      this.emit("_message-dismissed", _message);
    }
  }

  /**
   * Clear all messages
   */
  clearAll(): void {
    // Clear all timers
    for (const [, _timer] of this.activeTimers) {
      clearTimeout(_timer);
    }

    this.activeTimers.clear();
    this.messages.clear();
    this.messageOrder = [];

    this.emit("messages-cleared");
  }

  /**
   * Show _message history
   */
  showHistory(limit: number = 10): void {
    const _recentMessages = this.messageOrder.slice(0, limit);

    if (_recentMessages.length === 0) {
      console.log(chalk.gray("No recent messages"));
      return;
    }

    console.log(chalk.cyan("\n📋 Recent Messages:"));

    for (const id of _recentMessages) {
      const _message = this.messages.get(id);
      if (_message) {
        const _style = this.feedbackStyles[_message.type];
        const _color = chalk[_style._color as keyof typeof chalk] as any;
        const _timestamp = _message._timestamp.toLocaleTimeString();

        console.log(
          `  ${_color(_style.icon)} ${_message._message} ${chalk.gray(`(${_timestamp})`)}`,
        );

        if (_message.details) {
          console.log(chalk.gray(`     ${_message.details}`));
        }
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get progress reporter
   */
  getProgressReporter(): EnhancedProgressReporter | null {
    return this.progressReporter;
  }

  /**
   * Get mode indicator
   */
  getModeIndicator(): EnhancedModeIndicator | null {
    return this.modeIndicator;
  }

  /**
   * Get all messages
   */
  getMessages(): FeedbackMessage[] {
    return this.messageOrder
      .map((id) => this.messages.get(id)!)
      .filter(Boolean);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearAll();

    if (this.progressReporter) {
      this.progressReporter.destroy();
      this.progressReporter = null;
    }

    if (this.modeIndicator) {
      this.modeIndicator.destroy();
      this.modeIndicator = null;
    }

    this.removeAllListeners();
  }
}

export default RealTimeFeedbackManager;
