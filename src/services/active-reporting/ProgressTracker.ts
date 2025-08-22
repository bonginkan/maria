/**
 * Progress Tracker - Real-time task progress monitoring
 * Tracks and reports progress for systematic Horenso reporting
 */

import { EventEmitter } from 'events';
import { Task, ProgressMetrics } from './types';

export class ProgressTracker extends EventEmitter {
  private trackedTasks: Map<string, TrackedTask>;
  private startTimes: Map<string, Date>;
  private metrics: ProgressMetrics;
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
   * Start tracking tasks
   */
  public async startTracking(tasks: Task[]): Promise<void> {
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
    this.emit('tracking:started', tasks);
  }

  /**
   * Start a specific task
   */
  public startTask(taskId: string): void {
    const tracked = this.trackedTasks.get(taskId);
    if (!tracked) return;

    tracked.startTime = new Date();
    this.startTimes.set(taskId, tracked.startTime);
    tracked.task.status = 'in_progress';

    this.emit('task:started', tracked.task);
    this.updateMetrics();
  }

  /**
   * Update task progress
   */
  public updateTaskProgress(taskId: string, progress: number): void {
    const tracked = this.trackedTasks.get(taskId);
    if (!tracked) return;

    tracked.task.progress = Math.min(100, Math.max(0, progress));
    tracked.lastUpdate = new Date();

    if (tracked.startTime) {
      tracked.actualTime = (tracked.lastUpdate.getTime() - tracked.startTime.getTime()) / 60000; // minutes
    }

    this.emit('task:progressed', tracked.task, progress);

    if (progress >= 100) {
      this.completeTask(taskId);
    }

    this.updateMetrics();
  }

  /**
   * Complete a task
   */
  public completeTask(taskId: string): void {
    const tracked = this.trackedTasks.get(taskId);
    if (!tracked) return;

    tracked.endTime = new Date();
    tracked.task.status = 'completed';
    tracked.task.progress = 100;

    if (tracked.startTime) {
      tracked.actualTime = (tracked.endTime.getTime() - tracked.startTime.getTime()) / 60000;
      tracked.task.actualTime = tracked.actualTime;
    }

    this.emit('task:completed', tracked.task);
    this.updateMetrics();
  }

  /**
   * Block a task
   */
  public blockTask(taskId: string, reason?: string): void {
    const tracked = this.trackedTasks.get(taskId);
    if (!tracked) return;

    tracked.task.status = 'blocked';
    if (reason) {
      tracked.task.blockers = [reason];
    }

    this.emit('task:blocked', tracked.task);
    this.updateMetrics();
  }

  /**
   * Get current metrics
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
   * Get all tasks
   */
  public getAllTasks(): Task[] {
    return Array.from(this.trackedTasks.values()).map((t) => t.task);
  }

  /**
   * Get tasks by status
   */
  public getTasksByStatus(status: Task['status']): Task[] {
    return Array.from(this.trackedTasks.values())
      .filter((t) => t.task.status === status)
      .map((t) => t.task);
  }

  /**
   * Calculate velocity
   */
  public calculateVelocity(): number {
    const completedTasks = this.getTasksByStatus('completed');
    const totalTime = completedTasks.reduce((sum, task) => sum + (task.actualTime || 0), 0);

    if (totalTime === 0) return 0;

    return completedTasks.length / (totalTime / 60); // tasks per hour
  }

  /**
   * Estimate completion time
   */
  public estimateCompletionTime(): Date {
    const remainingTasks =
      this.getTasksByStatus('pending').length + this.getTasksByStatus('in_progress').length;
    const velocity = this.calculateVelocity();

    if (velocity === 0) {
      // Use estimated time if no velocity data
      const remainingTime = this.getTasksByStatus('pending').reduce(
        (sum, task) => sum + (task.estimatedTime || 0),
        0,
      );
      return new Date(Date.now() + remainingTime * 60000);
    }

    const hoursRemaining = remainingTasks / velocity;
    return new Date(Date.now() + hoursRemaining * 3600000);
  }

  /**
   * Get critical path status
   */
  public getCriticalPathStatus(): {
    onTrack: boolean;
    delay: number;
    criticalTasks: Task[];
  } {
    const criticalTasks = this.getTasksByStatus('in_progress').filter(
      (t) => t.priority === 'critical',
    );

    let totalDelay = 0;
    criticalTasks.forEach((task) => {
      if (task.actualTime && task.estimatedTime) {
        const delay = task.actualTime - task.estimatedTime;
        if (delay > 0) totalDelay += delay;
      }
    });

    return {
      onTrack: totalDelay === 0,
      delay: totalDelay,
      criticalTasks,
    };
  }

  /**
   * Update progress for all active tasks
   */
  private updateProgress(): void {
    const activeTasks = this.getTasksByStatus('in_progress');

    activeTasks.forEach((task) => {
      const tracked = this.trackedTasks.get(task.id);
      if (!tracked || !tracked.startTime) return;

      // Calculate progress based on time spent vs estimated
      if (task.estimatedTime) {
        const timeSpent = (new Date().getTime() - tracked.startTime.getTime()) / 60000;
        const estimatedProgress = Math.min(95, (timeSpent / task.estimatedTime) * 100);

        // Only update if progress hasn't been manually set recently
        const timeSinceLastUpdate = new Date().getTime() - tracked.lastUpdate.getTime();
        if (timeSinceLastUpdate > 10000) {
          // 10 seconds
          this.updateTaskProgress(task.id, estimatedProgress);
        }
      }
    });
  }

  /**
   * Update overall metrics
   */
  private updateMetrics(): void {
    const tasks = this.getAllTasks();
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
    const totalSpent = Array.from(this.trackedTasks.values()).reduce(
      (sum, t) => sum + (t.actualTime || 0),
      0,
    );

    this.metrics = {
      tasksCompleted: completedTasks.length,
      tasksTotal: tasks.length,
      progressPercentage: tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0,
      timeSpent: totalSpent,
      timeEstimated: totalEstimated,
      velocity: this.calculateVelocity(),
      eta: this.estimateCompletionTime(),
      confidenceLevel: this.calculateConfidenceLevel(),
    };

    this.emit('metrics:updated', this.metrics);
  }

  /**
   * Calculate confidence level based on accuracy of estimates
   */
  private calculateConfidenceLevel(): number {
    const completedTasks = this.getTasksByStatus('completed');
    if (completedTasks.length === 0) return 50; // Default confidence

    let totalAccuracy = 0;
    let validComparisons = 0;

    completedTasks.forEach((task) => {
      if (task.estimatedTime && task.actualTime) {
        const accuracy = 1 - Math.abs(task.estimatedTime - task.actualTime) / task.estimatedTime;
        totalAccuracy += Math.max(0, accuracy);
        validComparisons++;
      }
    });

    if (validComparisons === 0) return 50;

    return Math.round((totalAccuracy / validComparisons) * 100);
  }

  /**
   * Initialize default metrics
   */
  private initializeMetrics(): ProgressMetrics {
    return {
      tasksCompleted: 0,
      tasksTotal: 0,
      progressPercentage: 0,
      timeSpent: 0,
      timeEstimated: 0,
      velocity: 0,
      eta: new Date(),
      confidenceLevel: 50,
    };
  }

  /**
   * Generate progress report
   */
  public generateProgressReport(): string {
    const metrics = this.getMetrics();
    const activeTasks = this.getTasksByStatus('in_progress');
    const blockedTasks = this.getTasksByStatus('blocked');

    let report = `Progress Report\n`;
    report += `═══════════════\n\n`;

    report += `Overall Progress: ${metrics.progressPercentage.toFixed(1)}%\n`;
    report += `Tasks: ${metrics.tasksCompleted}/${metrics.tasksTotal} completed\n`;
    report += `Time: ${metrics.timeSpent.toFixed(0)}/${metrics.timeEstimated.toFixed(0)} minutes\n`;
    report += `Velocity: ${metrics.velocity.toFixed(2)} tasks/hour\n`;
    report += `ETA: ${metrics.eta.toLocaleString()}\n`;
    report += `Confidence: ${metrics.confidenceLevel}%\n\n`;

    if (activeTasks.length > 0) {
      report += `Active Tasks:\n`;
      activeTasks.forEach((task) => {
        report += `  • ${task.title} (${task.progress}%)\n`;
      });
      report += '\n';
    }

    if (blockedTasks.length > 0) {
      report += `⚠️ Blocked Tasks:\n`;
      blockedTasks.forEach((task) => {
        report += `  • ${task.title}`;
        if (task.blockers && task.blockers.length > 0) {
          report += ` - ${task.blockers[0]}`;
        }
        report += '\n';
      });
    }

    return report;
  }

  /**
   * Export metrics as JSON
   */
  public exportMetrics(): string {
    const data = {
      metrics: this.metrics,
      tasks: {
        completed: this.getTasksByStatus('completed'),
        inProgress: this.getTasksByStatus('in_progress'),
        pending: this.getTasksByStatus('pending'),
        blocked: this.getTasksByStatus('blocked'),
      },
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(data, null, 2);
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
