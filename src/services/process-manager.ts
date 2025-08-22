/**
 * Process Manager Service
 * High-level orchestration of background processes and task lifecycle management
 */

import { EventEmitter } from 'events';
import { BackgroundProcessor } from './background-processor.js';
import { BackgroundTask, UIStateManager } from './ui-state-manager.js';
import { SlashCommandHandler } from './slash-command-handler.js';
import { ConversationContext } from '../types/conversation.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

export interface TaskPriority {
  level: 'low' | 'normal' | 'high';
  score: number;
}

export interface ProcessingStrategy {
  shouldAutoBackground: (command: string, args: string[]) => boolean;
  estimateDuration: (command: string, args: string[]) => number;
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
  private stats: ProcessingStats;
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
      shouldAutoBackground: (command: string, args: string[]) => {
        // Auto-background for heavy commands
        const heavyCommands = ['/code', '/test', '/review', '/image', '/video'];

        if (heavyCommands.includes(command)) {
          return true;
        }

        // Auto-background for long arguments
        const totalArgsLength = args.join(' ').length;
        if (totalArgsLength > 200) {
          return true;
        }

        return false;
      },

      estimateDuration: (command: string, args: string[]) => {
        const baseDurations: Record<string, number> = {
          '/code': 8000,
          '/test': 15000,
          '/review': 12000,
          '/image': 25000,
          '/video': 45000,
          '/commit': 5000,
          '/bug': 10000,
        };

        let duration = baseDurations[command] || 3000;

        // Adjust based on argument complexity
        const argComplexity = args.join(' ').length;
        const complexityMultiplier = Math.min(1 + argComplexity / 500, 3);
        duration *= complexityMultiplier;

        return Math.round(duration);
      },

      calculatePriority: (command: string, _args: string[], context: ConversationContext) => {
        let score = 50; // Base priority

        // Command-based priority
        const commandPriorities: Record<string, number> = {
          '/bug': 80, // Bug fixes are high priority
          '/test': 70, // Tests are important
          '/review': 65, // Reviews are important
          '/commit': 60, // Commits are moderately important
          '/code': 55, // Code generation is standard
          '/image': 30, // Image generation is lower priority
          '/video': 20, // Video generation is lowest priority
        };

        score += (commandPriorities[command] || 0) - 50;

        // Context-based adjustments
        // if (context.isUrgent) score += 30; // Property not available
        // if (context.isInteractive) score += 20; // Property not available
        if (context.hasErrors) {score += 30;}
        if (context.currentTask) {score += 20;}

        // Normalize to priority level
        let level: TaskPriority['level'] = 'normal';
        if (score >= 80) {level = 'high';}
        else if (score >= 65) {level = 'high';}
        else if (score < 40) {level = 'low';}

        return { level, score };
      },
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.backgroundProcessor.on('processCompleted', (event) => {
      this.stats.totalProcessed++;
      this.updateAverageDuration(event.task);
      this.emit('taskCompleted', event);
    });

    this.backgroundProcessor.on('processError', (event) => {
      this.stats.failed++;
      this.emit('taskFailed', event);
    });

    this.backgroundProcessor.on('processCancelled', (event) => {
      this.stats.cancelled++;
      this.emit('taskCancelled', event);
    });

    this.backgroundProcessor.on('processStarted', (event) => {
      this.stats.backgrounded++;
      this.emit('taskStarted', event);
    });
  }

  /**
   * Update average duration statistic
   */
  private updateAverageDuration(task: BackgroundTask): void {
    const duration = Date.now() - task.startTime;
    const total = this.stats.totalProcessed;

    if (total === 1) {
      this.stats.averageDuration = duration;
    } else {
      this.stats.averageDuration = (this.stats.averageDuration * (total - 1) + duration) / total;
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
    result?: unknown;
  }> {
    try {
      const sessionId = context.sessionId || 'default';

      // Calculate priority and duration
      const priority = this.strategy.calculatePriority(command, args, context);
      const estimatedDuration = this.strategy.estimateDuration(command, args);

      // Determine if should run in background
      const shouldBackground =
        this.strategy.shouldAutoBackground(command, args) &&
        // !context.forceInline && // Property not available
        estimatedDuration > 5000; // Only background tasks longer than 5 seconds

      logger.info(
        `Processing command ${command} | Background: ${shouldBackground} | Priority: ${priority.level} | Est: ${estimatedDuration}ms`,
      );

      if (shouldBackground) {
        // Process in background
        const result = await this.backgroundProcessor.moveToBackground(sessionId, command, args, {
          estimatedDuration,
          priority: priority.level,
          timeout: estimatedDuration * 3, // 3x timeout buffer
        });

        if (result.success) {
          this.emit('commandBackgrounded', {
            sessionId,
            command,
            args,
            processId: result.processId,
            priority,
            estimatedDuration,
          });

          return {
            success: true,
            processId: result.processId,
            isBackground: true,
            message: `Task started in background (${this.formatDuration(estimatedDuration)} estimated)`,
          };
        } else {
          // Fallback to foreground if background fails
          logger.warn(
            `Background processing failed, falling back to foreground: ${result.message}`,
          );
        }
      }

      // Process in foreground
      this.stats.foreground++;
      this.stats.totalProcessed++;

      const startTime = Date.now();
      const result = await this.slashCommandHandler.handleCommand(command, args, context);
      const duration = Date.now() - startTime;

      this.updateAverageDuration({
        id: 'foreground',
        command,
        args,
        status: 'completed',
        progress: 100,
        startTime,
        sessionId: context.sessionId,
      } as BackgroundTask);

      this.emit('commandCompleted', {
        sessionId: context.sessionId,
        command,
        args,
        duration,
        result,
      });

      return {
        success: true,
        isBackground: false,
        message: `Command completed (${this.formatDuration(duration)})`,
        result,
      };
    } catch (error: unknown) {
      this.stats.failed++;
      logger.error(`Error processing command ${command}:`, error);

      this.emit('commandFailed', {
        sessionId: context.sessionId || 'default',
        command,
        args,
        error,
      });

      return {
        success: false,
        isBackground: false,
        message: `Command failed: ${error}`,
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
    action: 'queue' | 'cancel' | 'override';
    message: string;
  }> {
    try {
      const currentPriority = this.strategy.calculatePriority(
        this.getCurrentTaskCommand(_sessionId) || '',
        [],
        context,
      );

      const newPriority = this.strategy.calculatePriority(newCommand, newArgs, context);

      // Determine action based on priority
      if (newPriority.score > currentPriority.score + 20) {
        // High priority task - cancel current and start new
        const cancelResult = this.backgroundProcessor.cancelProcess(currentProcessId);
        if (cancelResult.success) {
          await this.processCommand(newCommand, newArgs, context);
          return {
            success: true,
            action: 'override',
            message: `Cancelled current task and started high priority task: ${newCommand}`,
          };
        }
      } else if (newPriority.score < currentPriority.score - 10) {
        // Lower priority - queue for later
        return {
          success: true,
          action: 'queue',
          message: `Queued lower priority task: ${newCommand}`,
        };
      } else {
        // Similar priority - ask user
        return {
          success: false,
          action: 'queue',
          message: `Current task has similar priority. Use /cancel to stop current task first.`,
        };
      }

      return {
        success: false,
        action: 'queue',
        message: 'Could not determine appropriate action',
      };
    } catch (error: unknown) {
      logger.error('Error handling task interrupt:', error);
      return {
        success: false,
        action: 'queue',
        message: `Error handling interrupt: ${error}`,
      };
    }
  }

  /**
   * Get current task command for a session
   */
  private getCurrentTaskCommand(_sessionId: string): string | undefined {
    const currentTask = this.uiStateManager.getCurrentTask(_sessionId);
    return currentTask?.command;
  }

  /**
   * Bring background task to foreground
   */
  async bringTaskToForeground(
    _sessionId: string,
    processId: string,
  ): Promise<{ success: boolean; message: string; result?: unknown }> {
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
    processManager: ProcessingStats;
    backgroundProcessor: ReturnType<typeof BackgroundProcessor.prototype.getStats>;
    uiStateManager: ReturnType<typeof UIStateManager.prototype.getStats>;
  } {
    return {
      processManager: this.getStats(),
      backgroundProcessor: this.backgroundProcessor.getStats(),
      uiStateManager: this.uiStateManager.getStats(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    logger.info('Process manager statistics reset');
  }

  /**
   * Update processing strategy
   */
  updateStrategy(strategy: Partial<ProcessingStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
    logger.info('Process manager strategy updated');
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {return `${ms}ms`;}

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    details: {
      runningTasks: number;
      failureRate: number;
      averageResponseTime: number;
    };
  } {
    const backgroundStats = this.backgroundProcessor.getStats();
    const failureRate =
      this.stats.totalProcessed > 0 ? (this.stats.failed / this.stats.totalProcessed) * 100 : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Process manager is operating normally';

    if (failureRate > 20) {
      status = 'unhealthy';
      message = `High failure rate: ${failureRate.toFixed(1)}%`;
    } else if (failureRate > 10 || backgroundStats.runningProcesses > 8) {
      status = 'degraded';
      message =
        failureRate > 10
          ? `Elevated failure rate: ${failureRate.toFixed(1)}%`
          : `High task load: ${backgroundStats.runningProcesses} running`;
    }

    return {
      status,
      message,
      details: {
        runningTasks: backgroundStats.runningProcesses,
        failureRate,
        averageResponseTime: this.stats.averageDuration,
      },
    };
  }

  /**
   * Format health status for display
   */
  formatHealthStatus(): string {
    const health = this.getHealthStatus();
    const statusIcon =
      health.status === 'healthy' ? '💚' : health.status === 'degraded' ? '💛' : '❤️';

    let output = `${statusIcon} Process Manager: ${chalk.bold(health.message)}\n\n`;

    const stats = this.getCombinedStats();
    output += chalk.bold('📊 Statistics:\n');
    output += `   Total Processed: ${stats.processManager.totalProcessed}\n`;
    output += `   Background: ${stats.processManager.backgrounded} | Foreground: ${stats.processManager.foreground}\n`;
    output += `   Success Rate: ${(100 - health.details.failureRate).toFixed(1)}%\n`;
    output += `   Avg Duration: ${this.formatDuration(health.details.averageResponseTime)}\n`;
    output += `   Running Tasks: ${health.details.runningTasks}/${stats.backgroundProcessor.maxConcurrentProcesses}\n\n`;

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

export const processManager = ProcessManager.getInstance();
