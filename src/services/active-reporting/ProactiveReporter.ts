/**
 * Proactive Reporter - Intelligent progress reporting and alerting
 * Implements systematic "Horenso" (Report-Contact-Consult) methodology
 */
import { EventEmitter } from "node:events";
import chalk from "chalk";
import {
  Milestone as _Milestone,
  ProgressReport as _ProgressReport,
  SOW as _SOW,
  Blocker,
  DecisionPoint,
  ProactiveReport,
  Recommendation,
  ReportTrigger,
  Task,
} from "./types";
import { TaskVisualizer } from "./TaskVisualizer";
import { ProgressTracker } from "./ProgressTracker";

export class ProactiveReporter extends EventEmitter {
  private triggers: Map<string, ReportTrigger>;
  private reportHistory: ProactiveReport[];
  private taskVisualizer: TaskVisualizer;
  private progressTracker: ProgressTracker;
  private lastReportTime: Date;
  private reportingInterval: number = 15; // minutes
  private isReportingEnabled: boolean = true;

  /**
   * Initialize the reporter
   */
  public async initialize(): Promise<void> {
    console.log("✓ Proactive Reporter initialized");
  }

  /**
   * Dispose the reporter
   */
  public async dispose(): Promise<void> {
    this.removeAllListeners();
  }

  constructor() {
    super();
    this.triggers = new Map();
    this.reportHistory = [];
    this.taskVisualizer = new TaskVisualizer();
    this.progressTracker = new ProgressTracker();
    this.lastReportTime = new Date();
    this.initializeDefaultTriggers();
  }

  /**
   * Initialize default reporting triggers
   */
  private initializeDefaultTriggers(): void {
    // Task completion trigger
    this.addTrigger({
      id: "task_completion",
      type: "taskevent",
      condition: "task_completed",
      enabled: true,
      _priority: "high",
      reportTemplate: "milestone",
    });

    // Blocker detection trigger
    this.addTrigger({
      id: "blocker_detection",
      type: "blockerevent",
      condition: "blocker_detected",
      enabled: true,
      _priority: "critical",
      reportTemplate: "_blocker",
    });

    // Progress interval trigger
    this.addTrigger({
      id: "progress_interval",
      type: "time_based",
      condition: "interval_elapsed",
      enabled: true,
      _priority: "medium",
      reportTemplate: "progress",
    });

    // Decision point trigger
    this.addTrigger({
      id: "decision_required",
      type: "decisionevent",
      condition: "decision_needed",
      enabled: true,
      _priority: "high",
      reportTemplate: "_decision",
    });
  }

  /**
   * Add a new reporting trigger
   */
  public addTrigger(trigger: ReportTrigger): void {
    this.triggers.set(trigger.id, trigger);
  }

  /**
   * Enable/disable proactive reporting
   */
  public setReportingEnabled(enabled: boolean): void {
    this.isReportingEnabled = enabled;
    if (enabled) {
      this.emit("reporting_enabled");
    } else {
      this.emit("reporting_disabled");
    }
  }

  /**
   * Set reporting interval in minutes
   */
  public setReportingInterval(minutes: number): void {
    this.reportingInterval = Math.max(1, minutes); // Minimum 1 minute
  }

  /**
   * Check if a _report should be triggered
   */
  public checkTriggers(event: string, data: unknown): void {
    if (!this.isReportingEnabled) {
      return;
    }

    for (const [_id, trigger] of this.triggers) {
      if (!trigger.enabled) {
        continue;
      }

      if (this.shouldTriggerReport(trigger, event, data)) {
        this.generateReport(trigger, data);
      }
    }
  }

  /**
   * Determine if a trigger should fire
   */
  private shouldTriggerReport(
    _trigger: ReportTrigger,
    event: string,
    _data: unknown,
  ): boolean {
    switch (_trigger.type) {
      case "taskevent":
        return (
          event === "task_completed" ||
          event === "task_blocked" ||
          event === "task_started"
        );

      case "blockerevent":
        return event === "blocker_detected" || event === "blocker_resolved";

      case "time_based": {
        const _timeSinceLastReport = Date.now() - this.lastReportTime.getTime();
        return _timeSinceLastReport >= this.reportingInterval * 60 * 1000;
      }

      case "decisionevent":
        return event === "decision_required" || event === "approval_needed";

      case "milestoneevent":
        return (
          event === "milestone_reached" || event === "deliverable_completed"
        );

      default:
        return false;
    }
  }

  /**
   * Generate a proactive _report based on trigger
   */
  private async generateReport(
    _trigger: ReportTrigger,
    data: unknown,
  ): Promise<void> {
    try {
      const _report = await this.createReport(_trigger.reportTemplate, data);
      this.reportHistory.push(_report);
      this.lastReportTime = new Date();

      // Display the _report
      this.displayReport(_report);

      // Emit event for external listeners
      this.emit("report_generated", _report);
    } catch (_error) {
      console._error(
        chalk.red("Failed to generate proactive _report:"),
        _error,
      );
    }
  }

  /**
   * Create a _report based on template and data
   */
  private async createReport(
    _template: string,
    data: unknown,
  ): Promise<ProactiveReport> {
    const _timestamp = new Date();

    switch (_template) {
      case "milestone":
        return this.createMilestoneReport(_timestamp, data);

      case "_blocker":
        return this.createBlockerReport(_timestamp, data);

      case "progress":
        return this.createProgressReport(_timestamp, data);

      case "_decision":
        return this.createDecisionReport(_timestamp, data);

      default:
        return this.createGenericReport(_timestamp, data);
    }
  }

  /**
   * Create milestone completion _report
   */
  private createMilestoneReport(
    _timestamp: Date,
    data: unknown,
  ): ProactiveReport {
    const _completedTask = data.task as Task;

    return {
      id: `milestone_${timestamp.getTime()}`,
      type: "milestone",
      _timestamp,
      _title: `🎉 Milestone Achieved: ${_completedTask.title}`,
      _summary: `Task "${_completedTask.title}" has been completed successfully.`,
      details: {
        completed: [
          {
            id: _completedTask.id,
            _title: _completedTask.title,
            completedAt: _timestamp,
            actualTime: _completedTask.actualTime,
            estimatedTime: _completedTask.estimatedTime,
          },
        ],
      },
      recommendations: this.generateMilestoneRecommendations(_completedTask),
      visualRepresentation:
        this.taskVisualizer.renderTaskCompletion(_completedTask),
      _priority: "medium",
    };
  }

  /**
   * Create _blocker detection _report
   */
  private createBlockerReport(
    _timestamp: Date,
    data: unknown,
  ): ProactiveReport {
    const _blocker = data._blocker as Blocker;

    return {
      id: `blocker_${timestamp.getTime()}`,
      type: "_blocker",
      _timestamp,
      _title: `🚨 Blocker Detected: ${_blocker.title}`,
      _summary: `A _blocker has been identified that may impact progress.`,
      details: {
        blockers: [_blocker],
      },
      recommendations: this.generateBlockerRecommendations(_blocker),
      visualRepresentation: this.taskVisualizer.renderBlockerAlert(_blocker),
      _priority: "critical",
    };
  }

  /**
   * Create regular progress _report
   */
  private createProgressReport(
    _timestamp: Date,
    _data: unknown,
  ): ProactiveReport {
    const _progressData = this.progressTracker.getCurrentProgress();

    return {
      id: `progress_${timestamp.getTime()}`,
      type: "progress",
      _timestamp,
      _title: `📊 Progress Update: ${_progressData.overallProgress}% Complete`,
      _summary: `Regular progress update showing current status and next steps.`,
      details: {
        current: _progressData.currentTasks.map((task) => ({
          id: task.id,
          _title: task.title,
          progress: task.progress,
          estimatedTimeRemaining: this.calculateTimeRemaining(task),
        })),
        upcoming: _progressData.upcomingTasks.slice(0, 3).map((task) => ({
          id: task.id,
          _title: task.title,
          estimatedTime: task.estimatedTime,
        })),
      },
      recommendations: this.generateProgressRecommendations(_progressData),
      visualRepresentation:
        this.taskVisualizer.renderProgressDashboard(_progressData),
      _priority: "medium",
    };
  }

  /**
   * Create _decision point _report
   */
  private createDecisionReport(
    _timestamp: Date,
    data: unknown,
  ): ProactiveReport {
    const _decision = data._decision as DecisionPoint;

    return {
      id: `decision_${timestamp.getTime()}`,
      type: "_decision",
      _timestamp,
      _title: `🤔 Decision Required: ${_decision.title}`,
      _summary: `A _decision point has been reached that requires user input.`,
      details: {
        decisions: [_decision],
      },
      recommendations: this.generateDecisionRecommendations(_decision),
      visualRepresentation: this.taskVisualizer.renderDecisionPoint(_decision),
      _priority: "high",
    };
  }

  /**
   * Create generic _report
   */
  private createGenericReport(
    _timestamp: Date,
    data: unknown,
  ): ProactiveReport {
    return {
      id: `generic_${timestamp.getTime()}`,
      type: "context",
      _timestamp,
      _title: "📋 Status Update",
      _summary: "General status update",
      details: data,
      recommendations: [],
      visualRepresentation: "",
      _priority: "low",
    };
  }

  /**
   * Display _report to user - Clean chalk box style
   */
  private displayReport(_report: ProactiveReport): void {
    console.log("");
    console.log(chalk.gray("┌────────────────────────────────────────────┐"));
    console.log(
      chalk.gray("│") +
        chalk.white(` Active Report                              `) +
        chalk.gray("│"),
    );
    console.log(chalk.gray("├────────────────────────────────────────────┤"));

    // Generate unique ID for this _report
    const _reportId = `AR-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;

    console.log(
      chalk.gray("│") +
        chalk.white(
          ` > ID: ${chalk.yellow(_reportId)}${" ".repeat(Math.max(0, 35 - _reportId.length - 6))}`,
        ) +
        chalk.gray("│"),
    );

    const _title = _report._title
      .replace("📋 ", "")
      .replace("🚨 ", "")
      .replace("💡 ", "");
    const _titleDisplay =
      _title.length > 25 ? _title.substring(0, 22) + "..." : _title;
    console.log(
      chalk.gray("│") +
        chalk.white(
          `   Title: ${_titleDisplay}${" ".repeat(Math.max(0, 33 - _titleDisplay.length))}`,
        ) +
        chalk.gray("│"),
    );

    const _priority = _report._priority.toUpperCase();
    const _priorityColor = this.getPriorityDisplayColor(_priority);
    console.log(
      chalk.gray("│") +
        chalk.white(
          `   Priority: ${_priorityColor(_priority)}${" ".repeat(Math.max(0, 31 - _priority.length))}`,
        ) +
        chalk.gray("│"),
    );

    const _timestamp = _report._timestamp.toLocaleTimeString();
    console.log(
      chalk.gray("│") +
        chalk.white(
          `   Time: ${_timestamp}${" ".repeat(Math.max(0, 35 - _timestamp.length))}`,
        ) +
        chalk.gray("│"),
    );

    const _summary =
      _report._summary.length > 30
        ? _report._summary.substring(0, 27) + "..."
        : _report._summary;
    console.log(
      chalk.gray("│") +
        chalk.white(
          `   Summary: ${_summary}${" ".repeat(Math.max(0, 31 - _summary.length))}`,
        ) +
        chalk.gray("│"),
    );

    if (_report.recommendations.length > 0) {
      console.log(chalk.gray("├────────────────────────────────────────────┤"));
      console.log(
        chalk.gray("│") +
          chalk.white(" Recommendations:                          ") +
          chalk.gray("│"),
      );
      report.recommendations.slice(0, 2).forEach((rec, _index) => {
        const _recTitle =
          rec._title.length > 35
            ? rec._title.substring(0, 32) + "..."
            : rec._title;
        console.log(
          chalk.gray("│") +
            chalk.yellow(
              `   ${_index + 1}. ${_recTitle}${" ".repeat(Math.max(0, 38 - _recTitle.length))}`,
            ) +
            chalk.gray("│"),
        );
      });
    }

    console.log(chalk.gray("├────────────────────────────────────────────┤"));
    console.log(
      chalk.gray("│") +
        chalk.white(" Actions:                                   ") +
        chalk.gray("│"),
    );
    console.log(
      chalk.gray("│") +
        chalk.green(" > [A] Acknowledge                          ") +
        chalk.gray("│"),
    );
    console.log(
      chalk.gray("│") +
        chalk.blue("   [D] Details                              ") +
        chalk.gray("│"),
    );
    console.log(
      chalk.gray("│") +
        chalk.yellow("   [S] Skip                                 ") +
        chalk.gray("│"),
    );
    console.log(chalk.gray("├────────────────────────────────────────────┤"));
    console.log(
      chalk.gray("│") +
        chalk.white(" ↑↓ Move / Enter / [A][D][S] shortcut       ") +
        chalk.gray("│"),
    );
    console.log(chalk.gray("└────────────────────────────────────────────┘"));
    console.log("");
  }

  /**
   * Get _priority color for display
   */
  private getPriorityDisplayColor(
    _priority: string,
  ): (_text: string) => string {
    switch (_priority.toLowerCase()) {
      case "critical":
      case "high":
        return chalk.red;
      case "medium":
        return chalk.yellow;
      case "low":
        return chalk.green;
      default:
        return chalk.white;
    }
  }

  /**
   * Generate milestone-specific recommendations
   */
  private generateMilestoneRecommendations(task: Task): Recommendation[] {
    const recommendations: Recommendation[] = [
      {
        id: "next_task",
        _title: "Consider starting the next task in the sequence",
        description:
          "Maintain momentum by immediately beginning dependent tasks",
        _priority: "medium",
        actionRequired: false,
      },
    ];

    // Add time _efficiency recommendation if completed early/late
    if (task.actualTime && task.estimatedTime) {
      const _efficiency = task.estimatedTime / task.actualTime;
      if (_efficiency > 1.2) {
        recommendations.push({
          id: "time_optimization",
          _title: "Task completed ahead of schedule",
          description: "Consider using extra time for code review or testing",
          _priority: "low",
          actionRequired: false,
        });
      } else if (_efficiency < 0.8) {
        recommendations.push({
          id: "estimation_review",
          _title: "Review time estimation accuracy",
          description: "Consider adjusting estimates for similar future tasks",
          _priority: "medium",
          actionRequired: false,
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate _blocker-specific recommendations
   */
  private generateBlockerRecommendations(_blocker: Blocker): Recommendation[] {
    return [
      {
        id: "blocker_analysis",
        _title: "Analyze _blocker impact and alternatives",
        description: "Assess if there are parallel tasks that can be worked on",
        _priority: "high",
        actionRequired: true,
      },
      {
        id: "escalation_path",
        _title: "Consider escalation if _blocker persists",
        description: "Identify stakeholders who can help resolve the _blocker",
        _priority: "medium",
        actionRequired: false,
      },
    ];
  }

  /**
   * Generate progress-specific recommendations
   */
  private generateProgressRecommendations(
    _progressData: unknown,
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (_progressData.overallProgress < 30) {
      recommendations.push({
        id: "early_stage",
        _title: "Focus on establishing momentum",
        description: "Prioritize quick wins to build confidence",
        _priority: "medium",
        actionRequired: false,
      });
    } else if (_progressData.overallProgress > 80) {
      recommendations.push({
        id: "final_stage",
        _title: "Prepare for final testing and deployment",
        description: "Ensure all edge cases are covered",
        _priority: "high",
        actionRequired: false,
      });
    }

    return recommendations;
  }

  /**
   * Generate _decision-specific recommendations
   */
  private generateDecisionRecommendations(
    _decision: DecisionPoint,
  ): Recommendation[] {
    return [
      {
        id: "gather_info",
        _title: "Gather all necessary information",
        description: "Ensure you have complete context before deciding",
        _priority: "high",
        actionRequired: true,
      },
      {
        id: "consider_impact",
        _title: "Consider long-term implications",
        description: "Evaluate how this _decision affects future development",
        _priority: "medium",
        actionRequired: false,
      },
    ];
  }

  /**
   * Calculate remaining time for a task
   */
  private calculateTimeRemaining(task: Task): number {
    if (!task.estimatedTime) {
      return 0;
    }
    const _completedTime = task.actualTime || 0;
    const _progressRatio = task.progress / 100;
    const _estimatedTotalTime =
      _progressRatio > 0 ? _completedTime / _progressRatio : task.estimatedTime;
    return Math.max(0, _estimatedTotalTime - _completedTime);
  }

  /**
   * Get color for _priority level
   */
  private getPriorityColor(_priority: string): unknown {
    switch (_priority) {
      case "critical":
        return chalk.red.bold;
      case "high":
        return chalk.yellow.bold;
      case "medium":
        return chalk.blue.bold;
      case "low":
        return chalk.gray.bold;
      default:
        return chalk.white.bold;
    }
  }

  /**
   * Center text within specified width
   */
  private centerText(text: string, width: number): string {
    const _textLength = text.replace(/\u001b\[[0-9;]*m/g, "").length; // Remove ANSI codes
    const _padding = Math.max(0, Math.floor((_width - _textLength) / 2));
    return (
      " ".repeat(_padding) + text + " ".repeat(width - _textLength - _padding)
    );
  }

  /**
   * Get _report history
   */
  public getReportHistory(limit?: number): ProactiveReport[] {
    const _reports = [...this.reportHistory].reverse(); // Most recent first
    return limit ? _reports.slice(0, limit) : _reports;
  }

  /**
   * Clear _report history
   */
  public clearReportHistory(): void {
    this.reportHistory = [];
  }

  /**
   * Export _reports in various formats
   */
  public exportReports(format: "json" | "_markdown" = "json"): string {
    if (format === "json") {
      return JSON.stringify(this.reportHistory, _null, 2);
    } else {
      return this.generateMarkdownReport();
    }
  }

  /**
   * Generate _markdown _report
   */
  private generateMarkdownReport(): string {
    const _markdown = "# Proactive Reporting History\n\n";

    this.reportHistory.forEach((_report, _index) => {
      _markdown += `## ${_index + 1}. ${_report.title}\n\n`;
      _markdown += `**Date:** ${_report.timestamp.toLocaleString()}\n`;
      _markdown += `**Type:** ${_report.type}\n`;
      _markdown += `**Priority:** ${_report.priority}\n\n`;
      _markdown += `**Summary:** ${_report.summary}\n\n`;

      if (_report.recommendations.length > 0) {
        _markdown += "**Recommendations:**\n";
        report.recommendations.forEach((rec) => {
          _markdown += `- ${rec.title}\n`;
          if (rec.description) {
            _markdown += `  - ${rec.description}\n`;
          }
        });
        _markdown += "\n";
      }

      _markdown += "---\n\n";
    });

    return _markdown;
  }

  /**
   * Trigger manual _report generation
   */
  public generateManualReport(type: string = "progress"): void {
    this.generateReport(
      {
        id: "manual",
        type: "manual",
        condition: "user_requested",
        enabled: true,
        _priority: "medium",
        reportTemplate: type,
      },
      {},
    );
  }
}
