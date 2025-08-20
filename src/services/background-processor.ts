/**
 * Background Processor Service
 * Manages long-running tasks in the background while allowing continued interaction
 */

import { EventEmitter } from 'events';
import { UIStateManager, BackgroundTask } from './ui-state-manager.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

export interface ProcessOptions {
  timeout?: number; // in milliseconds
  priority?: 'low' | 'normal' | 'high';
  estimatedDuration?: number; // in milliseconds
  cancelOnError?: boolean;
}

export interface BackgroundProcess {
  id: string;
  command: string;
  args: string[];
  options: ProcessOptions;
  task: BackgroundTask;
  controller?: AbortController;
  promise?: Promise<unknown>;
}

export class BackgroundProcessor extends EventEmitter {
  private static instance: BackgroundProcessor;
  private processes = new Map<string, BackgroundProcess>();
  private uiStateManager: UIStateManager;
  private maxConcurrentProcesses = 3;

  private constructor() {
    super();
    this.uiStateManager = UIStateManager.getInstance();
    this.setupEventListeners();
  }

  public static getInstance(): BackgroundProcessor {
    if (!BackgroundProcessor.instance) {
      BackgroundProcessor.instance = new BackgroundProcessor();
    }
    return BackgroundProcessor.instance;
  }

  /**
   * Set up event listeners for UI state changes
   */
  private setupEventListeners(): void {
    this.uiStateManager.on('backgroundTaskRemoved', (event) => {
      const processId = event.task.id;
      if (this.processes.has(processId)) {
        this.cleanupProcess(processId);
      }
    });
  }

  /**
   * Move a command to background processing
   */
  async moveToBackground(
    sessionId: string,
    command: string,
    args: string[] = [],
    options: ProcessOptions = {},
  ): Promise<{ success: boolean; processId?: string; message: string }> {
    try {
      // Check if we're at max concurrent processes
      const runningCount = this.getRunningProcessCount();
      if (runningCount >= this.maxConcurrentProcesses) {
        return {
          success: false,
          message: `Maximum concurrent processes reached (${this.maxConcurrentProcesses}). Please wait for one to complete.`,
        };
      }

      // Create background task
      const task = this.uiStateManager.addBackgroundTask(sessionId, {
        command,
        args,
        status: 'running',
        progress: 0,
        estimatedEndTime: options.estimatedDuration
          ? Date.now() + options.estimatedDuration
          : undefined,
      });

      // Create process
      const controller = new AbortController();
      const process: BackgroundProcess = {
        id: task.id,
        command,
        args,
        options,
        task,
        controller,
      };

      this.processes.set(task.id, process);

      // Start the background execution
      process.promise = this.executeInBackground(sessionId, process);

      this.emit('processStarted', { sessionId, process: process.task });

      logger.info(`Started background process ${task.id}: ${command} ${args.join(' ')}`);

      return {
        success: true,
        processId: task.id,
        message: `Task moved to background (${task.id})`,
      };
    } catch (error: unknown) {
      logger.error('Error moving task to background:', error);
      return {
        success: false,
        message: `Failed to move task to background: ${error}`,
      };
    }
  }

  /**
   * Execute command in background
   */
  private async executeInBackground(
    sessionId: string,
    process: BackgroundProcess,
  ): Promise<unknown> {
    const { task, controller, options } = process;

    try {
      // Set timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          controller?.abort();
          logger.warn(`Background process ${task.id} timed out after ${options.timeout}ms`);
        }, options.timeout);
      }

      // Simulate progress updates (in real implementation, this would be based on actual command execution)
      const progressInterval = setInterval(() => {
        if (controller?.signal.aborted) {
          clearInterval(progressInterval);
          return;
        }

        // Simulate progress
        const currentProgress = task.progress;
        const newProgress = Math.min(currentProgress + Math.random() * 20, 95);

        this.updateTaskProgress(sessionId, task.id, newProgress);
      }, 1000);

      // Execute the actual command (placeholder for real implementation)
      const result = await this.simulateCommandExecution(process);

      // Clean up
      clearInterval(progressInterval);
      if (timeoutId) clearTimeout(timeoutId);

      // Mark as completed
      this.updateTaskProgress(sessionId, task.id, 100);
      this.uiStateManager.updateBackgroundTask(sessionId, task.id, {
        status: 'completed',
        result,
      });

      this.emit('processCompleted', { sessionId, task, result });

      logger.info(`Background process ${task.id} completed successfully`);
      return result;
    } catch (error: unknown) {
      // Handle errors
      this.uiStateManager.updateBackgroundTask(sessionId, task.id, {
        status: 'error',
        error: String(error),
      });

      this.emit('processError', { sessionId, task, error });

      logger.error(`Background process ${task.id} failed:`, error);

      if (options.cancelOnError) {
        this.cancelProcess(task.id);
      }

      throw error;
    } finally {
      // Clean up process from memory after some time
      setTimeout(() => {
        this.cleanupProcess(task.id);
      }, 30000); // Keep for 30 seconds for potential foreground restoration
    }
  }

  /**
   * Simulate command execution (placeholder for real implementation)
   */
  private async simulateCommandExecution(process: BackgroundProcess): Promise<unknown> {
    const { command, args } = process;

    // This is where actual command execution would happen
    // For now, simulate based on command type
    const executionTime = this.getEstimatedExecutionTime(command);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          command,
          args,
          output: `Simulated execution of ${command} completed`,
          exitCode: 0,
          executionTime,
        });
      }, executionTime);
    });
  }

  /**
   * Get estimated execution time for different commands
   */
  private getEstimatedExecutionTime(command: string): number {
    const timeMap: Record<string, number> = {
      '/code': 8000, // 8 seconds
      '/test': 15000, // 15 seconds
      '/review': 12000, // 12 seconds
      '/image': 25000, // 25 seconds
      '/video': 45000, // 45 seconds
    };

    return timeMap[command] || 5000; // Default 5 seconds
  }

  /**
   * Update task progress
   */
  private updateTaskProgress(sessionId: string, taskId: string, progress: number): void {
    this.uiStateManager.updateBackgroundTask(sessionId, taskId, {
      progress: Math.min(progress, 100),
    });

    this.emit('progressUpdated', { sessionId, taskId, progress });
  }

  /**
   * Bring a background process to foreground
   */
  async bringToForeground(
    sessionId: string,
    processId: string,
  ): Promise<{ success: boolean; message: string; result?: unknown }> {
    try {
      const process = this.processes.get(processId);
      if (!process) {
        return {
          success: false,
          message: `Process ${processId} not found`,
        };
      }

      const task = this.uiStateManager
        .getBackgroundTasks(sessionId)
        .find((t) => t.id === processId);

      if (!task) {
        return {
          success: false,
          message: `Task ${processId} not found in session ${sessionId}`,
        };
      }

      // Set as current task
      this.uiStateManager.setCurrentTask(sessionId, task);

      // If process is still running, wait for completion
      if (task.status === 'running' && process.promise) {
        logger.info(
          `Bringing background process ${processId} to foreground, waiting for completion...`,
        );

        this.emit('processBroughtToForeground', { sessionId, task });

        try {
          const result = await process.promise;
          return {
            success: true,
            message: `Process completed: ${task.command}`,
            result,
          };
        } catch (error: unknown) {
          return {
            success: false,
            message: `Process failed: ${error}`,
          };
        }
      } else {
        // Process already completed
        return {
          success: true,
          message: `Process ${task.status}: ${task.command}`,
          result: task.result,
        };
      }
    } catch (error: unknown) {
      logger.error('Error bringing process to foreground:', error);
      return {
        success: false,
        message: `Failed to bring process to foreground: ${error}`,
      };
    }
  }

  /**
   * Cancel a background process
   */
  cancelProcess(processId: string): { success: boolean; message: string } {
    try {
      const process = this.processes.get(processId);
      if (!process) {
        return {
          success: false,
          message: `Process ${processId} not found`,
        };
      }

      // Cancel the process
      process.controller?.abort();

      // Update task status
      const sessionId = process.task.sessionId;
      this.uiStateManager.updateBackgroundTask(sessionId, processId, {
        status: 'error',
        error: 'Cancelled by user',
      });

      this.emit('processCancelled', { processId, task: process.task });

      logger.info(`Cancelled background process ${processId}`);

      return {
        success: true,
        message: `Process ${processId} cancelled`,
      };
    } catch (error: unknown) {
      logger.error('Error cancelling process:', error);
      return {
        success: false,
        message: `Failed to cancel process: ${error}`,
      };
    }
  }

  /**
   * Get all active processes
   */
  getActiveProcesses(): BackgroundTask[] {
    const allTasks: BackgroundTask[] = [];

    // Collect tasks from all sessions
    this.uiStateManager.getSessionIds().forEach((sessionId) => {
      const tasks = this.uiStateManager.getBackgroundTasks(sessionId);
      allTasks.push(...tasks.filter((t) => t.status === 'running' || t.status === 'paused'));
    });

    return allTasks;
  }

  /**
   * Get running process count
   */
  getRunningProcessCount(): number {
    return this.getActiveProcesses().filter((t) => t.status === 'running').length;
  }

  /**
   * Get processes for specific session
   */
  getSessionProcesses(sessionId: string): BackgroundTask[] {
    return this.uiStateManager.getBackgroundTasks(sessionId);
  }

  /**
   * Clean up completed/error processes
   */
  cleanupCompletedProcesses(): number {
    let cleanedCount = 0;

    this.processes.forEach((process, processId) => {
      if (process.task.status === 'completed' || process.task.status === 'error') {
        this.cleanupProcess(processId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} completed background processes`);
    }

    return cleanedCount;
  }

  /**
   * Clean up a specific process
   */
  private cleanupProcess(processId: string): void {
    const process = this.processes.get(processId);
    if (process) {
      // Cancel if still running
      if (process.task.status === 'running') {
        process.controller?.abort();
      }

      this.processes.delete(processId);
      logger.debug(`Cleaned up process ${processId}`);
    }
  }

  /**
   * Get process statistics
   */
  getStats() {
    const allProcesses = Array.from(this.processes.values());
    const byStatus = allProcesses.reduce(
      (acc, p) => {
        acc[p.task.status] = (acc[p.task.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalProcesses: allProcesses.length,
      runningProcesses: byStatus.running || 0,
      completedProcesses: byStatus.completed || 0,
      errorProcesses: byStatus.error || 0,
      pausedProcesses: byStatus.paused || 0,
      maxConcurrentProcesses: this.maxConcurrentProcesses,
      memoryUsage: this.processes.size * 2000, // rough estimate
    };
  }

  /**
   * Set maximum concurrent processes
   */
  setMaxConcurrentProcesses(max: number): void {
    this.maxConcurrentProcesses = Math.max(1, Math.min(max, 10)); // Between 1 and 10
    logger.info(`Max concurrent processes set to ${this.maxConcurrentProcesses}`);
  }

  /**
   * Format process list for display
   */
  formatProcessList(sessionId?: string): string {
    const tasks = sessionId ? this.getSessionProcesses(sessionId) : this.getActiveProcesses();

    if (tasks.length === 0) {
      return chalk.gray('No background tasks running.');
    }

    let output = chalk.bold('\n🔄 Background Tasks:\n\n');

    tasks.forEach((task, index) => {
      const statusIcon = this.getStatusIcon(task.status);
      const progressBar = this.formatProgressBar(task.progress);
      const timeInfo = this.formatTimeInfo(task);

      output += `${index + 1}. ${statusIcon} ${chalk.cyan(task.command)} ${chalk.gray(task.args.join(' '))}\n`;
      output += `   ${progressBar} ${chalk.gray(timeInfo)}\n`;

      if (task.error) {
        output += `   ${chalk.red(`Error: ${task.error}`)}\n`;
      }

      output += '\n';
    });

    const stats = this.getStats();
    output += chalk.gray(
      `Total: ${stats.totalProcesses} processes | Running: ${stats.runningProcesses} | Max: ${stats.maxConcurrentProcesses}\n`,
    );

    return output;
  }

  /**
   * Get status icon for task
   */
  private getStatusIcon(status: string): string {
    const icons = {
      running: '🔄',
      completed: '✅',
      error: '❌',
      paused: '⏸️',
    };
    return icons[status as keyof typeof icons] || '❓';
  }

  /**
   * Format progress bar
   */
  private formatProgressBar(progress: number): string {
    const width = 20;
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${chalk.green(bar)}] ${progress.toFixed(1)}%`;
  }

  /**
   * Format time information
   */
  private formatTimeInfo(task: BackgroundTask): string {
    const now = Date.now();
    const elapsed = now - task.startTime;
    const elapsedStr = this.formatDuration(elapsed);

    if (task.estimatedEndTime && task.status === 'running') {
      const remaining = Math.max(0, task.estimatedEndTime - now);
      const remainingStr = this.formatDuration(remaining);
      return `${elapsedStr} elapsed, ~${remainingStr} remaining`;
    }

    return `${elapsedStr} elapsed`;
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }
}

export const backgroundProcessor = BackgroundProcessor.getInstance();
