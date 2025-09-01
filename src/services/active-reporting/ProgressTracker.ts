/**
 * Progress Tracker - Real-time task progress monitoring
 * Tracks and reports progress for systematic Horenso reporting
 */

import { EventEmitter } from "node:events";
import { ProgressMetrics, Task } from "./types";

export class ProgressTracker extends EventEmitter {
  private trackedTasks: Map<string, TrackedTask>;
  private startTimes: Map<string, Date>;
  private _metrics: ProgressMetrics;
  private updateInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.trackedTasks = new Map();
    this.startTimes = new Map();
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize the tracker
   */
  public async initialize(): Promise<void> {
    // Set up periodic progress updates
    this.updateInterval = setInterval(() => {
      this.updateProgress();
    }, 5000); // Update every 5 seconds
  }

  /**
   * Start tracking _tasks
   */
  public async startTracking(_tasks: Task[]): Promise<void> {
    tasks.forEach((task) => {
      this.trackedTasks.set(task.id, {
        task,
        startTime: null,
        endTime: null,
        actualTime: 0,
        lastUpdate: new Date(),
      });
    });

    this.updateMetrics();
    this.emit("tracking:started", _tasks);
  }

  /**
   * Start a specific task
   */
  public startTask(taskId: string): void {
    const _tracked = this.trackedTasks.get(taskId);
    if (!_tracked) {
      return;
    }

    tracked.startTime = new Date();
    this.startTimes.set(taskId, _tracked.startTime);
    tracked.task.status = "in_progress";

    this.emit("task:started", _tracked.task);
    this.updateMetrics();
  }

  /**
   * Update task progress
   */
  public updateTaskProgress(_taskId: string, progress: number): void {
    const _tracked = this.trackedTasks.get(_taskId);
    if (!_tracked) {
      return;
    }

    _tracked.task.progress = Math.min(100, Math.max(0, progress));
    tracked.lastUpdate = new Date();

    if (_tracked.startTime) {
      _tracked.actualTime =
        (_tracked.lastUpdate.getTime() - _tracked.startTime.getTime()) / 60000; // minutes
    }

    this.emit("task:progressed", _tracked.task, progress);

    if (progress >= 100) {
      this.completeTask(_taskId);
    }

    this.updateMetrics();
  }

  /**
   * Complete a task
   */
  public completeTask(taskId: string): void {
    const _tracked = this.trackedTasks.get(taskId);
    if (!_tracked) {
      return;
    }

    _tracked.endTime = new Date();
    _tracked.task.status = "completed";
    tracked.task.progress = 100;

    if (_tracked.startTime) {
      _tracked.actualTime =
        (_tracked.endTime.getTime() - _tracked.startTime.getTime()) / 60000;
      _tracked.task.actualTime = _tracked.actualTime;
    }

    this.emit("task:completed", _tracked.task);
    this.updateMetrics();
  }

  /**
   * Block a task
   */
  public blockTask(_taskId: string, reason?: string): void {
    const _tracked = this.trackedTasks.get(_taskId);
    if (!_tracked) {
      return;
    }

    tracked.task.status = "blocked";
    if (reason) {
      tracked.task.blockers = [reason];
    }

    this.emit("task:blocked", _tracked.task);
    this.updateMetrics();
  }

  /**
   * Get current _metrics
   */
  public getMetrics(): ProgressMetrics {
    return { ...this.metrics };
  }

  /**
   * Get task by ID
   */
  public getTask(taskId: string): Task | undefined {
    return this.trackedTasks.get(taskId)?.task;
  }

  /**
   * Get all _tasks
   */
  public getAllTasks(): Task[] {
    return Array.from(this.trackedTasks.values()).map((t) => t.task);
  }

  /**
   * Get _tasks by status
   */
  public getTasksByStatus(status: Task["status"]): Task[] {
    return Array.from(this.trackedTasks.values())
      .filter((t) => t.task.status === status)
      .map((t) => t.task);
  }

  /**
   * Calculate _velocity
   */
  public calculateVelocity(): number {
    const _completedTasks = this.getTasksByStatus("completed");
    const _totalTime = _completedTasks.reduce(
      (sum, task) => sum + (task.actualTime || 0),
      0,
    );

    if (_totalTime === 0) {
      return 0;
    }

    return _completedTasks.length / (_totalTime / 60); // _tasks per hour
  }

  /**
   * Estimate completion time
   */
  public estimateCompletionTime(): Date {
    const _remainingTasks =
      this.getTasksByStatus("pending").length +
      this.getTasksByStatus("in_progress").length;
    const _velocity = this.calculateVelocity();

    if (_velocity === 0) {
      // Use estimated time if no _velocity _data
      const _remainingTime = this.getTasksByStatus("pending").reduce(
        (sum, task) => sum + (task.estimatedTime || 0),
        0,
      );
      return new Date(Date.now() + _remainingTime * 60000);
    }

    const _hoursRemaining = _remainingTasks / _velocity;
    return new Date(Date.now() + _hoursRemaining * 3600000);
  }

  /**
   * Get critical path status
   */
  public getCriticalPathStatus(): {
    onTrack: boolean;
    _delay: number;
    _criticalTasks: Task[];
  } {
    const _criticalTasks = this.getTasksByStatus("in_progress").filter(
      (t) => t.priority === "critical",
    );

    let totalDelay = 0;
    criticalTasks.forEach((task) => {
      if (task.actualTime && task.estimatedTime) {
        const _delay = task.actualTime - task.estimatedTime;
        if (_delay > 0) {
          totalDelay += _delay;
        }
      }
    });

    return {
      onTrack: totalDelay === 0,
      _delay: totalDelay,
      _criticalTasks,
    };
  }

  /**
   * Update progress for all active _tasks
   */
  private updateProgress(): void {
    const _activeTasks = this.getTasksByStatus("in_progress");

    activeTasks.forEach((task) => {
      const _tracked = this.trackedTasks.get(task.id);
      if (!_tracked || !_tracked.startTime) {
        return;
      }

      // Calculate progress based on time spent vs estimated
      if (task.estimatedTime) {
        const _timeSpent =
          (new Date().getTime() - _tracked.startTime.getTime()) / 60000;
        const _estimatedProgress = Math.min(
          95,
          (_timeSpent / task.estimatedTime) * 100,
        );

        // Only update if progress hasn't been manually set recently
        const _timeSinceLastUpdate =
          new Date().getTime() - _tracked.lastUpdate.getTime();
        if (_timeSinceLastUpdate > 10000) {
          // 10 seconds
          this.updateTaskProgress(task.id, _estimatedProgress);
        }
      }
    });
  }

  /**
   * Update overall _metrics
   */
  private updateMetrics(): void {
    const _tasks = this.getAllTasks();
    const _completedTasks = _tasks.filter((t) => t.status === "completed");
    const _totalEstimated = _tasks.reduce(
      (sum, t) => sum + (t.estimatedTime || 0),
      0,
    );
    const _totalSpent = Array.from(this.trackedTasks.values()).reduce(
      (sum, t) => sum + (t.actualTime || 0),
      0,
    );

    this.metrics = {
      tasksCompleted: _completedTasks.length,
      tasksTotal: _tasks.length,
      progressPercentage:
        _tasks.length > 0 ? (_completedTasks.length / _tasks.length) * 100 : 0,
      _timeSpent: _totalSpent,
      timeEstimated: _totalEstimated,
      _velocity: this.calculateVelocity(),
      eta: this.estimateCompletionTime(),
      confidenceLevel: this.calculateConfidenceLevel(),
    };

    this.emit("_metrics:updated", this.metrics);
  }

  /**
   * Calculate confidence level based on _accuracy of estimates
   */
  private calculateConfidenceLevel(): number {
    const _completedTasks = this.getTasksByStatus("completed");
    if (_completedTasks.length === 0) {
      return 50;
    } // Default confidence

    let totalAccuracy = 0;
    let validComparisons = 0;

    completedTasks.forEach((task) => {
      if (task.estimatedTime && task.actualTime) {
        const _accuracy =
          1 -
          Math.abs(task.estimatedTime - task.actualTime) / task.estimatedTime;
        totalAccuracy += Math.max(0, _accuracy);
        validComparisons++;
      }
    });

    if (validComparisons === 0) {
      return 50;
    }

    return Math.round((totalAccuracy / validComparisons) * 100);
  }

  /**
   * Initialize default _metrics
   */
  private initializeMetrics(): ProgressMetrics {
    return {
      tasksCompleted: 0,
      tasksTotal: 0,
      progressPercentage: 0,
      _timeSpent: 0,
      timeEstimated: 0,
      _velocity: 0,
      eta: new Date(),
      confidenceLevel: 50,
    };
  }

  /**
   * Generate progress report
   */
  public generateProgressReport(): string {
    const _metrics = this.getMetrics();
    const _activeTasks = this.getTasksByStatus("in_progress");
    const _blockedTasks = this.getTasksByStatus("blocked");

    let report = `Progress Report\n`;
    report += `═══════════════\n\n`;

    report += `Overall Progress: ${_metrics.progressPercentage.toFixed(1)}%\n`;
    report += `Tasks: ${_metrics.tasksCompleted}/${_metrics.tasksTotal} completed\n`;
    report += `Time: ${_metrics.timeSpent.toFixed(0)}/${_metrics.timeEstimated.toFixed(0)} minutes\n`;
    report += `Velocity: ${_metrics.velocity.toFixed(2)} _tasks/hour\n`;
    report += `ETA: ${_metrics.eta.toLocaleString()}\n`;
    report += `Confidence: ${_metrics.confidenceLevel}%\n\n`;

    if (_activeTasks.length > 0) {
      report += `Active Tasks:\n`;
      activeTasks.forEach((task) => {
        report += `  • ${task.title} (${task.progress}%)\n`;
      });
      report += "\n";
    }

    if (_blockedTasks.length > 0) {
      report += `⚠️ Blocked Tasks:\n`;
      blockedTasks.forEach((task) => {
        report += `  • ${task.title}`;
        if (task.blockers && task.blockers.length > 0) {
          report += ` - ${task.blockers[0]}`;
        }
        report += "\n";
      });
    }

    return report;
  }

  /**
   * Export _metrics as JSON
   */
  public exportMetrics(): string {
    const _data = {
      _metrics: this.metrics,
      _tasks: {
        completed: this.getTasksByStatus("completed"),
        inProgress: this.getTasksByStatus("in_progress"),
        pending: this.getTasksByStatus("pending"),
        blocked: this.getTasksByStatus("blocked"),
      },
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(_data, null, 2);
  }

  /**
   * Dispose the tracker
   */
  public async dispose(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.trackedTasks.clear();
    this.startTimes.clear();
    this.removeAllListeners();
  }
}

// Helper interface
interface TrackedTask {
  task: Task;
  startTime: Date | null;
  endTime: Date | null;
  actualTime: number;
  lastUpdate: Date;
}
