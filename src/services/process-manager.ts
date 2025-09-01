/**
 * Process Manager Service
 * High-level orchestration of background processes and task lifecycle management
 */

import { EventEmitter } from "node:events";
import { BackgroundProcessor } from "./background-processor.js";
import { BackgroundTask, UIStateManager } from "./ui-state-manager.js";
import { SlashCommandHandler } from "./slash-command-handler.js";
import { ConversationContext } from "../types/conversation.js";
import { logger } from "../utils/logger.js";
import chalk from "chalk";

export interface TaskPriority {
  level: "low" | "normal" | "high";
  score: number;
}

export interface ProcessingStrategy {
  shouldAutoBackground: (_command: string, args: string[]) => boolean;
  estimateDuration: (_command: string, args: string[]) => number;
  calculatePriority: (
    command: string,
    args: string[],
    context: ConversationContext,
  ) => TaskPriority;
}

export interface ProcessingStats {
  totalProcessed: number;
  backgrounded: number;
  foreground: number;
  cancelled: number;
  failed: number;
  averageDuration: number;
  runningProcesses?: number;
  maxConcurrentProcesses?: number;
}

export class ProcessManager extends EventEmitter {
  private static instance: ProcessManager;
  private backgroundProcessor: BackgroundProcessor;
  private uiStateManager: UIStateManager;
  private slashCommandHandler: SlashCommandHandler;
  private _stats: ProcessingStats;
  private strategy: ProcessingStrategy;

  private constructor() {
    super();
    this.backgroundProcessor = BackgroundProcessor.getInstance();
    this.uiStateManager = UIStateManager.getInstance();
    this.slashCommandHandler = SlashCommandHandler.getInstance();
    this.stats = this.initializeStats();
    this.strategy = this.createDefaultStrategy();
    this.setupEventListeners();
  }

  public static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): ProcessingStats {
    return {
      totalProcessed: 0,
      backgrounded: 0,
      foreground: 0,
      cancelled: 0,
      failed: 0,
      averageDuration: 0,
    };
  }

  /**
   * Create default processing strategy
   */
  private createDefaultStrategy(): ProcessingStrategy {
    return {
      shouldAutoBackground: (_command: string, args: string[]) => {
        // Auto-background for heavy commands
        const _heavyCommands = [
          "/code",
          "/test",
          "/review",
          "/image",
          "/video",
        ];

        if (_heavyCommands.includes(_command)) {
          return true;
        }

        // Auto-background for long arguments
        const _totalArgsLength = args.join(" ").length;
        if (_totalArgsLength > 200) {
          return true;
        }

        return false;
      },

      estimateDuration: (_command: string, args: string[]) => {
        const baseDurations: Record<string, number> = {
          "/code": 8000,
          "/test": 15000,
          "/review": 12000,
          "/image": 25000,
          "/video": 45000,
          "/commit": 5000,
          "/bug": 10000,
        };

        let _duration = baseDurations[_command] || 3000;

        // Adjust based on argument complexity
        const _argComplexity = args.join(" ").length;
        const _complexityMultiplier = Math.min(1 + _argComplexity / 500, 3);
        _duration *= _complexityMultiplier;

        return Math.round(_duration);
      },

      calculatePriority: (
        _command: string,
        _args: string[],
        context: ConversationContext,
      ) => {
        let score = 50; // Base _priority

        // Command-based _priority
        const commandPriorities: Record<string, number> = {
          "/bug": 80, // Bug fixes are high _priority
          "/test": 70, // Tests are important
          "/review": 65, // Reviews are important
          "/commit": 60, // Commits are moderately important
          "/code": 55, // Code generation is standard
          "/image": 30, // Image generation is lower _priority
          "/video": 20, // Video generation is lowest _priority
        };

        score += (commandPriorities[_command] || 0) - 50;

        // Context-based adjustments
        // if (context.isUrgent) score += 30; // Property not available
        // if (context.isInteractive) score += 20; // Property not available
        if (context.hasErrors) {
          score += 30;
        }
        if (context.currentTask) {
          score += 20;
        }

        // Normalize to _priority level
        let level: TaskPriority["level"] = "normal";
        if (score >= 80) {
          level = "high";
        } else if (score >= 65) {
          level = "high";
        } else if (score < 40) {
          level = "low";
        }

        return { level, score };
      },
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.backgroundProcessor.on("processCompleted", (event) => {
      this.stats.totalProcessed++;
      this.updateAverageDuration(event.task);
      this.emit("taskCompleted", event);
    });

    this.backgroundProcessor.on("processError", (event) => {
      this.stats.failed++;
      this.emit("taskFailed", event);
    });

    this.backgroundProcessor.on("processCancelled", (event) => {
      this.stats.cancelled++;
      this.emit("taskCancelled", event);
    });

    this.backgroundProcessor.on("processStarted", (event) => {
      this.stats.backgrounded++;
      this.emit("taskStarted", event);
    });
  }

  /**
   * Update average _duration statistic
   */
  private updateAverageDuration(task: BackgroundTask): void {
    const _duration = Date.now() - task.startTime;
    const _total = this.stats.totalProcessed;

    if (_total === 1) {
      this.stats.averageDuration = _duration;
    } else {
      this.stats.averageDuration =
        (this.stats.averageDuration * (_total - 1) + _duration) / _total;
    }
  }

  /**
   * Process a command with intelligent routing
   */
  async processCommand(
    command: string,
    args: string[],
    context: ConversationContext,
  ): Promise<{
    success: boolean;
    processId?: string;
    isBackground: boolean;
    message: string;
    _result?: unknown;
  }> {
    try {
      const _sessionId = context._sessionId || "default";

      // Calculate _priority and _duration
      const _priority = this.strategy.calculatePriority(
        _command,
        args,
        context,
      );
      const _estimatedDuration = this.strategy.estimateDuration(_command, args);

      // Determine if should run in background
      const _shouldBackground =
        this.strategy.shouldAutoBackground(_command, args) &&
        // !context.forceInline && // Property not available
        _estimatedDuration > 5000; // Only background tasks longer than 5 _seconds

      logger.info(
        `Processing _command ${_command} | Background: ${_shouldBackground} | Priority: ${_priority.level} | Est: ${_estimatedDuration}ms`,
      );

      if (_shouldBackground) {
        // Process in background
        const _result = await this.backgroundProcessor.moveToBackground(
          _sessionId,
          _command,
          args,
          {
            _estimatedDuration,
            _priority: _priority.level,
            timeout: _estimatedDuration * 3, // 3x timeout buffer
          },
        );

        if (_result.success) {
          this.emit("commandBackgrounded", {
            _sessionId,
            command,
            args,
            processId: _result.processId,
            _priority,
            _estimatedDuration,
          });

          return {
            success: true,
            processId: _result.processId,
            isBackground: true,
            message: `Task started in background (${this.formatDuration(_estimatedDuration)} estimated)`,
          };
        } else {
          // Fallback to foreground if background fails
          logger.warn(
            `Background processing failed, falling back to foreground: ${_result.message}`,
          );
        }
      }

      // Process in foreground
      this.stats.foreground++;
      this.stats.totalProcessed++;

      const _startTime = Date.now();
      const _result = await this.slashCommandHandler.handleCommand(
        _command,
        args,
        context,
      );
      const _duration = Date.now() - _startTime;

      this.updateAverageDuration({
        id: "foreground",
        command,
        args,
        status: "completed",
        progress: 100,
        _startTime,
        _sessionId: context._sessionId,
      } as BackgroundTask);

      this.emit("commandCompleted", {
        _sessionId: context._sessionId,
        command,
        args,
        _duration,
        _result,
      });

      return {
        success: true,
        isBackground: false,
        message: `Command completed (${this.formatDuration(_duration)})`,
        _result,
      };
    } catch (_error: unknown) {
      this.stats.failed++;
      logger.error(`Error processing _command ${_command}:`, _error);

      this.emit("commandFailed", {
        _sessionId: context._sessionId || "default",
        command,
        args,
        _error,
      });

      return {
        success: false,
        isBackground: false,
        message: `Command failed: ${_error}`,
      };
    }
  }

  /**
   * Handle background task interruption
   */
  async handleTaskInterrupt(
    _sessionId: string,
    currentProcessId: string,
    newCommand: string,
    newArgs: string[],
    context: ConversationContext,
  ): Promise<{
    success: boolean;
    action: "queue" | "cancel" | "override";
    message: string;
  }> {
    try {
      const _currentPriority = this.strategy.calculatePriority(
        this.getCurrentTaskCommand(_sessionId) || "",
        [],
        context,
      );

      const _newPriority = this.strategy.calculatePriority(
        newCommand,
        newArgs,
        context,
      );

      // Determine action based on _priority
      if (_newPriority.score > _currentPriority.score + 20) {
        // High _priority task - cancel current and start new
        const _cancelResult =
          this.backgroundProcessor.cancelProcess(currentProcessId);
        if (_cancelResult.success) {
          await this.processCommand(newCommand, newArgs, context);
          return {
            success: true,
            action: "override",
            message: `Cancelled current task and started high _priority task: ${newCommand}`,
          };
        }
      } else if (_newPriority.score < _currentPriority.score - 10) {
        // Lower _priority - queue for later
        return {
          success: true,
          action: "queue",
          message: `Queued lower _priority task: ${newCommand}`,
        };
      } else {
        // Similar _priority - ask user
        return {
          success: false,
          action: "queue",
          message: `Current task has similar priority. Use /cancel to stop current task first.`,
        };
      }

      return {
        success: false,
        action: "queue",
        message: "Could not determine appropriate action",
      };
    } catch (_error: unknown) {
      logger.error("Error handling task interrupt:", _error);
      return {
        success: false,
        action: "queue",
        message: `Error handling interrupt: ${_error}`,
      };
    }
  }

  /**
   * Get current task command for a session
   */
  private getCurrentTaskCommand(_sessionId: string): string | undefined {
    const _currentTask = this.uiStateManager.getCurrentTask(_sessionId);
    return _currentTask?._command;
  }

  /**
   * Bring background task to foreground
   */
  async bringTaskToForeground(
    _sessionId: string,
    processId: string,
  ): Promise<{ success: boolean; message: string; _result?: unknown }> {
    return this.backgroundProcessor.bringToForeground(_sessionId, processId);
  }

  /**
   * Cancel a running task
   */
  cancelTask(processId: string): { success: boolean; message: string } {
    return this.backgroundProcessor.cancelProcess(processId);
  }

  /**
   * List all tasks for a session
   */
  listTasks(_sessionId?: string): string {
    return this.backgroundProcessor.formatProcessList(_sessionId);
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Get combined statistics
   */
  getCombinedStats(): {
    _processManager: ProcessingStats;
    backgroundProcessor: ReturnType<
      typeof BackgroundProcessor.prototype.getStats
    >;
    uiStateManager: ReturnType<typeof UIStateManager.prototype.getStats>;
  } {
    return {
      _processManager: this.getStats(),
      backgroundProcessor: this.backgroundProcessor.getStats(),
      uiStateManager: this.uiStateManager.getStats(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    logger.info("Process manager statistics reset");
  }

  /**
   * Update processing strategy
   */
  updateStrategy(strategy: Partial<ProcessingStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
    logger.info("Process manager strategy updated");
  }

  /**
   * Format _duration in human readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }

    const _seconds = Math.floor(ms / 1000);
    const _minutes = Math.floor(_seconds / 60);
    const _remainingSeconds = _seconds % 60;

    if (_minutes > 0) {
      return `${_minutes}m ${_remainingSeconds}s`;
    } else {
      return `${_seconds}s`;
    }
  }

  /**
   * Get _health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    message: string;
    details: {
      runningTasks: number;
      _failureRate: number;
      averageResponseTime: number;
    };
  } {
    const _backgroundStats = this.backgroundProcessor.getStats();
    const _failureRate =
      this.stats.totalProcessed > 0
        ? (this.stats.failed / this.stats.totalProcessed) * 100
        : 0;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    let message = "Process manager is operating normally";

    if (_failureRate > 20) {
      status = "unhealthy";
      message = `High failure rate: ${_failureRate.toFixed(1)}%`;
    } else if (_failureRate > 10 || _backgroundStats.runningProcesses > 8) {
      status = "degraded";
      message =
        _failureRate > 10
          ? `Elevated failure rate: ${_failureRate.toFixed(1)}%`
          : `High task load: ${_backgroundStats.runningProcesses} running`;
    }

    return {
      status,
      message,
      details: {
        runningTasks: _backgroundStats.runningProcesses,
        _failureRate,
        averageResponseTime: this.stats.averageDuration,
      },
    };
  }

  /**
   * Format _health status for display
   */
  formatHealthStatus(): string {
    const _health = this.getHealthStatus();
    const _statusIcon =
      _health.status === "healthy"
        ? "💚"
        : _health.status === "degraded"
          ? "💛"
          : "❤️";

    let output = `${_statusIcon} Process Manager: ${chalk.bold(_health.message)}\n\n`;

    const _stats = this.getCombinedStats();
    output += chalk.bold("📊 Statistics:\n");
    output += `   Total Processed: ${_stats._processManager.totalProcessed}\n`;
    output += `   Background: ${_stats._processManager.backgrounded} | Foreground: ${_stats._processManager.foreground}\n`;
    output += `   Success Rate: ${(100 - _health.details.failureRate).toFixed(1)}%\n`;
    output += `   Avg Duration: ${this.formatDuration(_health.details.averageResponseTime)}\n`;
    output += `   Running Tasks: ${_health.details.runningTasks}/${_stats.backgroundProcessor.maxConcurrentProcesses}\n\n`;

    return output;
  }

  /**
   * Clean up completed processes
   */
  cleanupCompletedProcesses(): void {
    this.backgroundProcessor.cleanupCompleted();
  }

  /**
   * Set maximum concurrent processes
   */
  setMaxConcurrentProcesses(max: number): void {
    // This would be implemented if BackgroundProcessor had this method
    logger.info(`Setting max concurrent processes to: ${max}`);
  }
}

export const _processManager = ProcessManager.getInstance();
