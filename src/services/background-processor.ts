/**
 * Background Processor Service
 * Manages long-running _tasks in the background while allowing continued interaction
 */

import { EventEmitter } from "node:events";
import { BackgroundTask, UIStateManager } from "./ui-state-manager.js";
import { logger } from "../utils/logger.js";
import chalk from "chalk";

export interface ProcessOptions {
  timeout?: number; // in milliseconds
  priority?: "low" | "normal" | "high";
  estimatedDuration?: number; // in milliseconds
  cancelOnError?: boolean;
}

export interface BackgroundProcess {
  id: string;
  command: string;
  args: string[];
  options: ProcessOptions;
  _task: BackgroundTask;
  _controller?: AbortController;
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
    this.uiStateManager.on("backgroundTaskRemoved", (event) => {
      const _processId = event.task.id;
      if (this.processes.has(_processId)) {
        this.cleanupProcess(_processId);
      }
    });
  }

  /**
   * Move a command to background processing
   */
  async moveToBackground(
    _sessionId: string,
    command: string,
    args: string[] = [],
    options: ProcessOptions = {},
  ): Promise<{ success: boolean; _processId?: string; message: string }> {
    try {
      // Check if we're at max concurrent processes
      const _runningCount = this.getRunningProcessCount();
      if (_runningCount >= this.maxConcurrentProcesses) {
        return {
          success: false,
          message: `Maximum concurrent processes reached (${this.maxConcurrentProcesses}). Please wait for one to complete.`,
        };
      }

      // Create background _task
      const _task = this.uiStateManager.addBackgroundTask(_sessionId, {
        command,
        args,
        status: "running",
        progress: 0,
        estimatedEndTime: options.estimatedDuration
          ? Date.now() + options.estimatedDuration
          : undefined,
      });

      // Create _process
      const _controller = new AbortController();
      const _process: BackgroundProcess = {
        id: _task.id,
        command,
        args,
        options,
        _task,
        _controller,
      };

      this.processes.set(_task.id, _process);

      // Start the background execution
      process.promise = this.executeInBackground(_sessionId, _process);

      this.emit("processStarted", { _sessionId, _process: _process._task });

      logger.info(
        `Started background _process ${_task.id}: ${command} ${args.join(" ")}`,
      );

      return {
        success: true,
        _processId: _task.id,
        message: `Task moved to background (${_task.id})`,
      };
    } catch (_error: unknown) {
      logger.error("Error moving _task to background:", _error);
      return {
        success: false,
        message: `Failed to move _task to background: ${_error}`,
      };
    }
  }

  /**
   * Execute command in background
   */
  private async executeInBackground(
    _sessionId: string,
    _process: BackgroundProcess,
  ): Promise<unknown> {
    const { _task, _controller, options } = _process;

    try {
      // Set timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          _controller?.abort();
          logger.warn(
            `Background _process ${task.id} timed out after ${options.timeout}ms`,
          );
        }, options.timeout);
      }

      // Simulate progress updates (in real implementation, this would be based on actual command execution)
      const _progressInterval = setInterval(() => {
        if (_controller?.signal.aborted) {
          clearInterval(_progressInterval);
          return;
        }

        // Simulate progress
        const _currentProgress = task.progress;
        const _newProgress = Math.min(
          _currentProgress + Math.random() * 20,
          95,
        );

        this.updateTaskProgress(_sessionId, task.id, _newProgress);
      }, 1000);

      // Execute the actual command (placeholder for real implementation)
      const _result = await this.simulateCommandExecution(_process);

      // Clean up
      clearInterval(_progressInterval);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Mark as completed
      this.updateTaskProgress(_sessionId, task.id, 100);
      this.uiStateManager.updateBackgroundTask(_sessionId, task.id, {
        status: "completed",
        _result,
      });

      this.emit("processCompleted", { _sessionId, _task, _result });

      logger.info(`Background _process ${task.id} completed successfully`);
      return _result;
    } catch (_error: unknown) {
      // Handle errors
      this.uiStateManager.updateBackgroundTask(_sessionId, task.id, {
        status: "_error",
        _error: String(_error),
      });

      this.emit("processError", { _sessionId, _task, _error });

      logger.error(`Background _process ${task.id} failed:`, _error);

      if (options.cancelOnError) {
        this.cancelProcess(task.id);
      }

      throw _error;
    } finally {
      // Clean up _process from memory after some time
      setTimeout(() => {
        this.cleanupProcess(task.id);
      }, 30000); // Keep for 30 _seconds for potential foreground restoration
    }
  }

  /**
   * Simulate command execution (placeholder for real implementation)
   */
  private async simulateCommandExecution(
    _process: BackgroundProcess,
  ): Promise<unknown> {
    const { command, args } = _process;

    // This is where actual command execution would happen
    // For _now, simulate based on command type
    const _executionTime = this.getEstimatedExecutionTime(command);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          command,
          args,
          output: `Simulated execution of ${command} completed`,
          exitCode: 0,
          _executionTime,
        });
      }, _executionTime);
    });
  }

  /**
   * Get estimated execution time for different commands
   */
  private getEstimatedExecutionTime(command: string): number {
    const timeMap: Record<string, number> = {
      "/code": 8000, // 8 _seconds
      "/test": 15000, // 15 _seconds
      "/review": 12000, // 12 _seconds
      "/image": 25000, // 25 _seconds
      "/video": 45000, // 45 _seconds
    };

    return timeMap[command] || 5000; // Default 5 _seconds
  }

  /**
   * Update _task progress
   */
  private updateTaskProgress(
    _sessionId: string,
    taskId: string,
    progress: number,
  ): void {
    this.uiStateManager.updateBackgroundTask(_sessionId, taskId, {
      progress: Math.min(progress, 100),
    });

    this.emit("progressUpdated", { _sessionId, taskId, progress });
  }

  /**
   * Bring a background _process to foreground
   */
  async bringToForeground(
    _sessionId: string,
    _processId: string,
  ): Promise<{ success: boolean; message: string; _result?: unknown }> {
    try {
      const _process = this.processes.get(_processId);
      if (!_process) {
        return {
          success: false,
          message: `Process ${_processId} not found`,
        };
      }

      const _task = this.uiStateManager
        .getBackgroundTasks(_sessionId)
        .find((t) => t.id === _processId);

      if (!_task) {
        return {
          success: false,
          message: `Task ${_processId} not found in session ${_sessionId}`,
        };
      }

      // Set as current _task
      this.uiStateManager.setCurrentTask(_sessionId, _task);

      // If _process is still running, wait for completion
      if (_task.status === "running" && _process.promise) {
        logger.info(
          `Bringing background _process ${_processId} to foreground, waiting for completion...`,
        );

        this.emit("processBroughtToForeground", { _sessionId, _task });

        try {
          const _result = await _process.promise;
          return {
            success: true,
            message: `Process completed: ${_task.command}`,
            _result,
          };
        } catch (_error: unknown) {
          return {
            success: false,
            message: `Process failed: ${_error}`,
          };
        }
      } else {
        // Process already completed
        return {
          success: true,
          message: `Process ${_task.status}: ${_task.command}`,
          _result: _task._result,
        };
      }
    } catch (_error: unknown) {
      logger.error("Error bringing _process to foreground:", _error);
      return {
        success: false,
        message: `Failed to bring _process to foreground: ${_error}`,
      };
    }
  }

  /**
   * Cancel a background _process
   */
  cancelProcess(_processId: string): { success: boolean; message: string } {
    try {
      const _process = this.processes.get(_processId);
      if (!_process) {
        return {
          success: false,
          message: `Process ${_processId} not found`,
        };
      }

      // Cancel the _process
      process.controller?.abort();

      // Update _task status
      const _sessionId = _process.task.id;
      this.uiStateManager.updateBackgroundTask(_sessionId, _processId, {
        status: "_error",
        _error: "Cancelled by user",
      });

      this.emit("processCancelled", { _processId, _task: _process.task });

      logger.info(`Cancelled background _process ${_processId}`);

      return {
        success: true,
        message: `Process ${_processId} cancelled`,
      };
    } catch (_error: unknown) {
      logger.error("Error cancelling _process:", _error);
      return {
        success: false,
        message: `Failed to cancel _process: ${_error}`,
      };
    }
  }

  /**
   * Get all active processes
   */
  getActiveProcesses(): BackgroundTask[] {
    const allTasks: BackgroundTask[] = [];

    // Collect _tasks from all sessions
    this.uiStateManager.getSessionIds().forEach((_sessionId) => {
      const _tasks = this.uiStateManager.getBackgroundTasks(_sessionId);
      allTasks.push(
        ..._tasks.filter(
          (t) => t.status === "running" || t.status === "paused",
        ),
      );
    });

    return allTasks;
  }

  /**
   * Get running _process count
   */
  getRunningProcessCount(): number {
    return this.getActiveProcesses().filter((t) => t.status === "running")
      .length;
  }

  /**
   * Get processes for specific session
   */
  getSessionProcesses(_sessionId: string): BackgroundTask[] {
    return this.uiStateManager.getBackgroundTasks(_sessionId);
  }

  /**
   * Clean up completed/_error processes
   */
  cleanupCompletedProcesses(): number {
    let cleanedCount = 0;

    this.processes.forEach((_process, _processId) => {
      if (
        _process.task.status === "completed" ||
        _process.task.status === "_error"
      ) {
        this.cleanupProcess(_processId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} completed background processes`);
    }

    return cleanedCount;
  }

  /**
   * Clean up a specific _process
   */
  private cleanupProcess(_processId: string): void {
    const _process = this.processes.get(_processId);
    if (_process) {
      // Cancel if still running
      if (_process.task.status === "running") {
        process.controller?.abort();
      }

      this.processes.delete(_processId);
      logger.debug(`Cleaned up _process ${_processId}`);
    }
  }

  /**
   * Get _process statistics
   */
  getStats() {
    const _allProcesses = Array.from(this.processes.values());
    const _byStatus = _allProcesses.reduce(
      (acc, p) => {
        acc[p.task.status] = (acc[p.task.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalProcesses: _allProcesses.length,
      runningProcesses: _byStatus["running"] || 0,
      completedProcesses: _byStatus["completed"] || 0,
      errorProcesses: _byStatus["_error"] || 0,
      pausedProcesses: _byStatus["paused"] || 0,
      maxConcurrentProcesses: this.maxConcurrentProcesses,
      memoryUsage: this.processes.size * 2000, // rough estimate
    };
  }

  /**
   * Set maximum concurrent processes
   */
  setMaxConcurrentProcesses(max: number): void {
    this.maxConcurrentProcesses = Math.max(1, Math.min(max, 10)); // Between 1 and 10
    logger.info(
      `Max concurrent processes set to ${this.maxConcurrentProcesses}`,
    );
  }

  /**
   * Format _process list for display
   */
  formatProcessList(_sessionId?: string): string {
    const _tasks = _sessionId
      ? this.getSessionProcesses(_sessionId)
      : this.getActiveProcesses();

    if (_tasks.length === 0) {
      return chalk.gray("No background _tasks running.");
    }

    let output = chalk.bold("\n🔄 Background Tasks:\n\n");

    tasks.forEach((_task, _index) => {
      const _statusIcon = this.getStatusIcon(task.status);
      const _progressBar = this.formatProgressBar(task.progress);
      const _timeInfo = this.formatTimeInfo(_task);

      output += `${_index + 1}. ${_statusIcon} ${chalk.cyan(task.command)} ${chalk.gray(task.args.join(" "))}\n`;
      output += `   ${_progressBar} ${chalk.gray(_timeInfo)}\n`;

      if (task.error) {
        output += `   ${chalk.red(`Error: ${task.error}`)}\n`;
      }

      output += "\n";
    });

    const _stats = this.getStats();
    output += chalk.gray(
      `Total: ${_stats.totalProcesses} processes | Running: ${_stats.runningProcesses} | Max: ${_stats.maxConcurrentProcesses}\n`,
    );

    return output;
  }

  /**
   * Get status icon for _task
   */
  private getStatusIcon(status: string): string {
    const _icons = {
      running: "🔄",
      completed: "✅",
      _error: "❌",
      paused: "⏸️",
    };
    return _icons[status as keyof typeof _icons] || "❓";
  }

  /**
   * Format progress _bar
   */
  private formatProgressBar(progress: number): string {
    const _width = 20;
    const _filled = Math.round((progress / 100) * _width);
    const _empty = _width - _filled;

    const _bar = "█".repeat(_filled) + "░".repeat(_empty);
    return `[${chalk.green(_bar)}] ${progress.toFixed(1)}%`;
  }

  /**
   * Format time information
   */
  private formatTimeInfo(_task: BackgroundTask): string {
    const _now = Date._now();
    const _elapsed = _now - _task.startTime;
    const _elapsedStr = this.formatDuration(_elapsed);

    if (_task.estimatedEndTime && _task.status === "running") {
      const _remaining = Math.max(0, _task.estimatedEndTime - _now);
      const _remainingStr = this.formatDuration(_remaining);
      return `${_elapsedStr} _elapsed, ~${_remainingStr} _remaining`;
    }

    return `${_elapsedStr} _elapsed`;
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(ms: number): string {
    const _seconds = Math.floor(ms / 1000);
    const _minutes = Math.floor(_seconds / 60);
    const _remainingSeconds = _seconds % 60;

    if (_minutes > 0) {
      return `${_minutes}m ${_remainingSeconds}s`;
    } else {
      return `${_remainingSeconds}s`;
    }
  }
}

export const _backgroundProcessor = BackgroundProcessor.getInstance();
