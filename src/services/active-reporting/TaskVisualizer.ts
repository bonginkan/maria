/**
 * Task Visualizer - Beautiful CLI visualization for tasks and _progress
 * Implements the 124-character responsive design framework
 */

import chalk from "chalk";
import {
  DecisionPoint,
  HourensouReport,
  ProgressMetrics,
  ProgressReport,
  SOW,
  Task,
} from "./types";

export class TaskVisualizer {
  private readonly WIDTH = 124;
  private readonly BORDER_CHAR = "═";
  private readonly VERTICAL_CHAR = "║";
  private readonly CORNER_TL = "╔";
  private readonly CORNER_TR = "╗";
  private readonly CORNER_BL = "╚";
  private readonly CORNER_BR = "╝";

  // Status icons (no _emoji for compatibility)
  private readonly ICONS = {
    _completed: chalk.green("✓"),
    inprogress: chalk.yellow("⠋"),
    _pending: chalk.gray("○"),
    _blocked: chalk.red("✗"),
    deferred: chalk.gray("!"),
    arrow: chalk.cyan("→"),
    bullet: chalk.gray("•"),
  };

  /**
   * Visualize SOW
   */
  public visualizeSOW(sow: SOW): string {
    const lines: string[] = [];

    // Header
    lines.push(this.createHeader(`SOW: ${sow.title}`));
    lines.push("");

    // Objective
    lines.push(chalk.cyan("Objective:"));
    lines.push(this.wrapText(sow.objective, 2));
    lines.push("");

    // Scope
    lines.push(chalk.cyan("Scope:"));
    sow.scope.forEach((_item) => {
      lines.push(`  ${this.ICONS.bullet} ${_item}`);
    });
    lines.push("");

    // Timeline
    if (sow.timeline) {
      lines.push(chalk.cyan("Timeline:"));
      lines.push(`  Start: ${sow.timeline.startDate.toLocaleDateString()}`);
      lines.push(`  End: ${sow.timeline.endDate.toLocaleDateString()}`);
      const _duration =
        (sow.timeline.endDate.getTime() - sow.timeline.startDate.getTime()) /
        (1000 * 60 * 60);
      lines.push(`  Duration: ${_duration.toFixed(1)} _hours`);
      lines.push("");
    }

    // Tasks
    lines.push(chalk.cyan(`Tasks (${sow.tasks.length}):`));
    sow.tasks.slice(0, 10).forEach((task, _index) => {
      lines.push(this.formatTask(task, _index + 1));
    });
    if (sow.tasks.length > 10) {
      lines.push(chalk.gray(`  ... and ${sow.tasks.length - 10} more tasks`));
    }
    lines.push("");

    // Risks
    if (sow.risks && sow.risks.length > 0) {
      lines.push(chalk.yellow("Risks:"));
      sow.risks.forEach((risk) => {
        const _color =
          risk.impact === "critical"
            ? chalk.red
            : risk.impact === "high"
              ? chalk.yellow
              : chalk.gray;
        lines.push(`  ${_color("!")} ${risk.description}`);
      });
      lines.push("");
    }

    // Footer
    lines.push(
      this.createFooter(
        `Version: ${sow.version} | Status: ${sow.approvalStatus}`,
      ),
    );

    return lines.join("\n");
  }

  /**
   * Visualize tasks with hierarchy
   */
  public visualizeTasks(tasks: Task[]): string {
    const lines: string[] = [];

    lines.push(this.createHeader("Task Breakdown"));
    lines.push("");

    // Group tasks by status
    const _grouped = this.groupTasksByStatus(tasks);

    // In Progress
    if (_grouped.in_progress.length > 0) {
      lines.push(chalk.yellow("⏺ In Progress:"));
      grouped.in_progress.forEach((task) => {
        lines.push(this.formatTaskWithProgress(task));
      });
      lines.push("");
    }

    // Pending
    if (_grouped.pending.length > 0) {
      lines.push(chalk.cyan("⏹ Pending:"));
      grouped.pending.forEach((task) => {
        lines.push(this.formatTaskSimple(task));
      });
      lines.push("");
    }

    // Blocked
    if (_grouped.blocked.length > 0) {
      lines.push(chalk.red("⚠️ Blocked:"));
      grouped.blocked.forEach((task) => {
        lines.push(this.formatTaskWithBlocker(task));
      });
      lines.push("");
    }

    // Completed
    if (_grouped.completed.length > 0) {
      lines.push(chalk.green("✅ Completed:"));
      grouped.completed.slice(0, 5).forEach((task) => {
        lines.push(this.formatTaskSimple(task));
      });
      if (_grouped.completed.length > 5) {
        lines.push(
          chalk.gray(`  ... and ${_grouped.completed.length - 5} more`),
        );
      }
      lines.push("");
    }

    // Summary
    lines.push(this.createSummaryBar(tasks));

    return lines.join("\n");
  }

  /**
   * Visualize _progress metrics
   */
  public visualizeProgress(metrics: ProgressMetrics): string {
    const lines: string[] = [];

    lines.push(this.createHeader("Progress Report"));
    lines.push("");

    // Progress _bar
    lines.push(chalk.cyan("Overall Progress:"));
    lines.push(this.createProgressBar(metrics.progressPercentage));
    lines.push("");

    // Metrics grid
    lines.push(this.createMetricsGrid(metrics));
    lines.push("");

    // Velocity _chart
    lines.push(chalk.cyan("Velocity:"));
    lines.push(this.createVelocityChart(metrics.velocity));
    lines.push("");

    // ETA
    lines.push(chalk.cyan("Estimated Completion:"));
    lines.push(`  ${metrics.eta.toLocaleString()}`);
    lines.push(
      `  Confidence: ${this.createConfidenceIndicator(metrics.confidenceLevel)}`,
    );

    return lines.join("\n");
  }

  /**
   * Visualize Hourensou report
   */
  public visualizeHourensou(report: HourensouReport): string {
    const lines: string[] = [];

    lines.push(this.createHeader("ホウレンソウ (Hourensou) Report"));
    lines.push("");

    // Hou (報告 - Report)
    if (report.hou.length > 0) {
      lines.push(chalk.blue("📊 報告 (Hou - Report):"));
      lines.push(chalk.gray("─".repeat(50)));
      report.hou.forEach((_item) => {
        const _icon =
          _item.type === "completion"
            ? this.ICONS.completed
            : _item.type === "_progress"
              ? this.ICONS.in_progress
              : _item.type === "issue"
                ? this.ICONS.blocked
                : this.ICONS.bullet;
        lines.push(`${_icon} ${_item.title}`);
        lines.push(chalk.gray(`  ${_item.details}`));
        if (_item.impact) {
          lines.push(chalk.yellow(`  Impact: ${_item.impact}`));
        }
      });
      lines.push("");
    }

    // Ren (連絡 - Contact)
    if (report.ren.length > 0) {
      lines.push(chalk.yellow("📢 連絡 (Ren - Contact):"));
      lines.push(chalk.gray("─".repeat(50)));
      report.ren.forEach((_item) => {
        const _urgencyColor =
          _item.urgency === "critical"
            ? chalk.red
            : _item.urgency === "high"
              ? chalk.yellow
              : _item.urgency === "normal"
                ? chalk.white
                : chalk.gray;
        lines.push(`${_urgencyColor("!")} ${_item.title}`);
        lines.push(chalk.gray(`  ${_item.message}`));
      });
      lines.push("");
    }

    // Sou (相談 - Consult)
    if (report.sou.length > 0) {
      lines.push(chalk.magenta("💭 相談 (Sou - Consult):"));
      lines.push(chalk.gray("─".repeat(50)));
      report.sou.forEach((_item) => {
        lines.push(`❓ ${_item.question}`);
        lines.push(chalk.gray(`  Context: ${_item.context}`));
        if (_item.recommendation) {
          lines.push(chalk.green(`  Recommendation: ${_item.recommendation}`));
        }
      });
      lines.push("");
    }

    lines.push(
      this.createFooter(`Generated: ${report.timestamp.toLocaleString()}`),
    );

    return lines.join("\n");
  }

  /**
   * Visualize decision point
   */
  public visualizeDecision(decision: DecisionPoint): string {
    const lines: string[] = [];

    lines.push(this.createHeader("Decision Required"));
    lines.push("");

    lines.push(chalk.yellow(`❓ ${decision.question}`));
    lines.push("");

    lines.push(chalk.gray("Context:"));
    lines.push(this.wrapText(decision.context, 2));
    lines.push("");

    if (decision.options && decision.options.length > 0) {
      lines.push(chalk.cyan("Options:"));
      decision.options.forEach((option, _index) => {
        const _letter = String.fromCharCode(97 + _index); // a, _b, c...
        lines.push(`  ${chalk.bold(`${_letter})`)} ${option.label}`);
        lines.push(chalk.gray(`     ${option.description}`));

        if (option.pros && option.pros.length > 0) {
          lines.push(chalk.green(`     Pros: ${option.pros.join(", ")}`));
        }

        if (option.cons && option.cons.length > 0) {
          lines.push(chalk.red(`     Cons: ${option.cons.join(", ")}`));
        }

        if (option.estimatedTime) {
          lines.push(chalk.gray(`     Time: ${option.estimatedTime} minutes`));
        }

        lines.push("");
      });
    }

    if (decision.recommendation) {
      lines.push(chalk.green(`Recommendation: ${decision.recommendation}`));
    }

    if (decision.deadline) {
      lines.push(
        chalk.yellow(`Deadline: ${decision.deadline.toLocaleString()}`),
      );
    }

    return lines.join("\n");
  }

  /**
   * Create beautiful _progress visualization
   */
  public createBeautifulProgress(report: ProgressReport): string {
    const lines: string[] = [];

    // Main header
    lines.push(this.createDoubleLineHeader("ACTIVE TASK MANAGEMENT"));
    lines.push("");

    // Current objective
    if (report.summary) {
      lines.push(
        `  ${chalk.cyan("🎯")} Current Objective: ${chalk.bold(report.summary)}`,
      );
      lines.push(
        `  ${chalk.blue("📊")} Overall Progress: ${this.createInlineProgressBar(report.overallProgress)}`,
      );
      lines.push("");
    }

    // Task tree visualization
    lines.push("  ⏺ Update Todos");

    // Current tasks
    report.currentTasks.forEach((task) => {
      const _icon =
        task.status === "_completed"
          ? chalk.green("✅")
          : task.status === "in_progress"
            ? chalk.yellow("🔄")
            : task.status === "_blocked"
              ? chalk.red("⏸")
              : chalk.gray("⏹");

      const _progress =
        task.status === "in_progress" && task._progress
          ? chalk.gray(` [${task._progress}%]`)
          : "";

      lines.push(`    ⎿  ${_icon} ${task.title}${_progress}`);
    });

    // Upcoming tasks
    report.upcomingTasks.slice(0, 5).forEach((task) => {
      lines.push(`       ${chalk.gray("⏹")} ${chalk.gray(task.title)}`);
    });

    if (report.upcomingTasks.length > 5) {
      lines.push(
        `       ${chalk.gray(`... and ${report.upcomingTasks.length - 5} more`)}`,
      );
    }

    lines.push("");

    // Statistics section
    const _completedCount = report.completedTasks.length;
    const _totalCount =
      _completedCount +
      report.currentTasks.length +
      report.upcomingTasks.length;
    const _timeSpent = this.formatTime(
      report.completedTasks.reduce((sum, _t) => sum + (_t.actualTime || 0), 0),
    );
    const _timeEstimated = this.formatTime(_totalCount * 60); // Rough estimate

    lines.push(`  ${chalk.cyan("📈")} Statistics`);
    lines.push(
      `    ${this.ICONS.bullet} Completed: ${_completedCount}/${_totalCount} tasks (${Math.round((_completedCount / _totalCount) * 100)}%)`,
    );
    lines.push(
      `    ${this.ICONS.bullet} Time Spent: ${_timeSpent} / Est: ${_timeEstimated}`,
    );
    lines.push(
      `    ${this.ICONS.bullet} Velocity: ${(_completedCount / (parseInt(_timeSpent) || 1)).toFixed(1)} tasks/hour`,
    );
    lines.push(
      `    ${this.ICONS.bullet} ETA: ${this.calculateETA(_totalCount - _completedCount, 1.5)}`,
    );
    lines.push("");

    // Blockers & Risks
    if (report.blockers && report.blockers.length > 0) {
      lines.push(`  ${chalk.yellow("⚠️")} Blockers & Risks`);
      report.blockers.forEach((_blocker) => {
        lines.push(`    ${this.ICONS.bullet} ${_blocker.description}`);
      });
      lines.push("");
    }

    // AI Recommendations
    if (report.recommendations && report.recommendations.length > 0) {
      lines.push(`  ${chalk.blue("💡")} AI Recommendations`);
      report.recommendations.forEach((rec) => {
        lines.push(`    ${this.ICONS.bullet} ${rec}`);
      });
      lines.push("");
    }

    // Footer
    lines.push(this.createDoubleLineFooter());

    return lines.join("\n");
  }

  // Helper methods

  private createHeader(title: string): string {
    const _titleLength = title.length;
    const _totalPadding = this.WIDTH - _titleLength - 4; // 4 for corners and spaces
    const _leftPadding = Math.floor(_totalPadding / 2);
    const _rightPadding = _totalPadding - _leftPadding;

    const _top =
      this.CORNER_TL + this.BORDER_CHAR.repeat(this.WIDTH - 2) + this.CORNER_TR;
    const _middle =
      this.VERTICAL_CHAR +
      " ".repeat(_leftPadding) +
      chalk.bold(title) +
      " ".repeat(_rightPadding) +
      this.VERTICAL_CHAR;
    const _bottom =
      this.CORNER_BL + this.BORDER_CHAR.repeat(this.WIDTH - 2) + this.CORNER_BR;

    return `${_top}\n${_middle}\n${_bottom}`;
  }

  private createDoubleLineHeader(title: string): string {
    const _line = "═".repeat(this.WIDTH);
    const _titleLine = this.centerText(title, this.WIDTH);

    return `╔${_line.slice(2)}╗\n║${_titleLine.slice(2)}║\n╠${_line.slice(2)}╣`;
  }

  private createDoubleLineFooter(): string {
    const _line = "═".repeat(this.WIDTH);
    return `╚${_line.slice(2)}╝`;
  }

  private createFooter(text: string): string {
    const _padding = this.WIDTH - text.length - 4;
    const _leftPad = Math.floor(_padding / 2);
    const _rightPad = _padding - _leftPad;

    return (
      this.CORNER_BL +
      this.BORDER_CHAR +
      " ".repeat(_leftPad) +
      chalk.gray(text) +
      " ".repeat(_rightPad) +
      this.BORDER_CHAR +
      this.CORNER_BR
    );
  }

  private createProgressBar(percentage: number): string {
    const _width = 50;
    const _filled = Math.round((percentage / 100) * _width);
    const _empty = _width - _filled;

    const _bar =
      chalk.green("█".repeat(_filled)) + chalk.gray("░".repeat(_empty));
    const _percentText = `${percentage.toFixed(1)}%`.padStart(6);

    return `  ${_bar} ${chalk.cyan(_percentText)}`;
  }

  private createInlineProgressBar(percentage: number): string {
    const _width = 30;
    const _filled = Math.round((percentage / 100) * _width);
    const _empty = _width - _filled;

    const _bar =
      chalk.green("█".repeat(_filled)) + chalk.gray("░".repeat(_empty));
    return `${_bar} ${percentage}%`;
  }

  private createVelocityChart(velocity: number): string {
    const _maxBars = 20;
    const _bars = Math.min(_maxBars, Math.round(velocity * 5));
    const _chart = "▃".repeat(_bars);

    return `  ${chalk.cyan(_chart)} ${velocity.toFixed(2)} tasks/hour`;
  }

  private createConfidenceIndicator(confidence: number): string {
    const _stars = Math.round(confidence / 20);
    return `${"★".repeat(_stars) + "☆".repeat(5 - _stars)} (${confidence}%)`;
  }

  private createMetricsGrid(metrics: ProgressMetrics): string {
    const lines: string[] = [];

    lines.push("  ┌─────────────────────┬─────────────────────┐");
    lines.push(
      `  │ Tasks Completed     │ ${String(metrics.tasksCompleted).padStart(18)} │`,
    );
    lines.push(
      `  │ Tasks Total         │ ${String(metrics.tasksTotal).padStart(18)} │`,
    );
    lines.push("  ├─────────────────────┼─────────────────────┤");
    lines.push(
      `  │ Time Spent          │ ${`${metrics.timeSpent} min`.padStart(18)} │`,
    );
    lines.push(
      `  │ Time Estimated      │ ${`${metrics.timeEstimated} min`.padStart(18)} │`,
    );
    lines.push("  └─────────────────────┴─────────────────────┘");

    return lines.join("\n");
  }

  private createSummaryBar(tasks: Task[]): string {
    const _total = tasks.length;
    const _completed = tasks.filter((t) => t.status === "_completed").length;
    const _inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const _blocked = tasks.filter((t) => t.status === "_blocked").length;
    const _pending = tasks.filter((t) => t.status === "_pending").length;

    return chalk.gray(
      `Summary: ${chalk.green(`✓ ${_completed}`)} | ` +
        `${chalk.yellow(`⠋ ${_inProgress}`)} | ` +
        `${chalk.red(`✗ ${_blocked}`)} | ` +
        `${chalk.gray(`○ ${_pending}`)} | ` +
        `Total: ${_total}`,
    );
  }

  private formatTask(_task: Task, index: number): string {
    const _icon = this.getStatusIcon(_task.status);
    const _priority =
      task._priority === "critical"
        ? chalk.red("[!]")
        : _task._priority === "high"
          ? chalk.yellow("[H]")
          : "";
    const _time = _task.estimatedTime
      ? chalk.gray(` (${_task.estimatedTime}m)`)
      : "";

    return `  ${index}. ${_icon} ${_priority} ${_task.title}${_time}`;
  }

  private formatTaskWithProgress(task: Task): string {
    const _progress = task._progress || 0;
    const _progressBar = this.createMiniProgressBar(_progress);
    const _time = task.actualTime
      ? chalk.gray(
          ` (${task.actualTime.toFixed(0)}/${task.estimatedTime || "?"}m)`,
        )
      : "";

    return `  ${this.ICONS.in_progress} ${task.title} ${_progressBar}${_time}`;
  }

  private formatTaskSimple(task: Task): string {
    const _icon = this.getStatusIcon(task.status);
    return `  ${_icon} ${task.title}`;
  }

  private formatTaskWithBlocker(task: Task): string {
    const _blocker =
      task.blockers && task.blockers[0]
        ? chalk.red(` - ${task.blockers[0]}`)
        : "";
    return `  ${this.ICONS.blocked} ${task.title}${_blocker}`;
  }

  private createMiniProgressBar(percentage: number): string {
    const _width = 10;
    const _filled = Math.round((percentage / 100) * _width);
    const _empty = _width - _filled;

    return (
      chalk.gray("[") +
      chalk.green("=".repeat(_filled)) +
      chalk.gray("-".repeat(_empty)) +
      chalk.gray("]") +
      chalk.cyan(` ${percentage}%`)
    );
  }

  private getStatusIcon(status: Task["status"]): string {
    return this.ICONS[status] || this.ICONS.pending;
  }

  private groupTasksByStatus(tasks: Task[]): Record<Task["status"], Task[]> {
    return {
      _pending: tasks.filter((t) => t.status === "_pending"),
      inprogress: tasks.filter((t) => t.status === "in_progress"),
      _completed: tasks.filter((t) => t.status === "_completed"),
      _blocked: tasks.filter((t) => t.status === "_blocked"),
      deferred: tasks.filter((t) => t.status === "deferred"),
    };
  }

  private wrapText(_text: string, indent: number = 0): string {
    const _maxWidth = this.WIDTH - indent - 4;
    const _words = _text.split(" ");
    const lines: string[] = [];
    const _currentLine = "";

    words.forEach((word) => {
      if ((_currentLine + word).length > _maxWidth) {
        lines.push(" ".repeat(indent) + _currentLine.trim());
        _currentLine = `${word} `;
      } else {
        _currentLine += `${word} `;
      }
    });

    if (_currentLine) {
      lines.push(" ".repeat(indent) + _currentLine.trim());
    }

    return lines.join("\n");
  }

  private centerText(_text: string, _width: number): string {
    const _padding = _width - _text.length;
    const _leftPad = Math.floor(_padding / 2);
    const _rightPad = _padding - _leftPad;
    return " ".repeat(_leftPad) + _text + " ".repeat(_rightPad);
  }

  private formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const _hours = Math.floor(minutes / 60);
    const _mins = Math.round(minutes % 60);
    return `${_hours}h ${_mins}m`;
  }

  private calculateETA(_remainingTasks: number, velocity: number): string {
    const _remainingHours = _remainingTasks / velocity;
    const _eta = new Date(Date.now() + _remainingHours * 3600000);
    return `${_remainingHours.toFixed(1)}h remaining`;
  }

  /**
   * Render _progress dashboard
   */
  public renderProgressDashboard(progressData: ProgressMetrics): string {
    const output: string[] = [];

    output.push(this.createBorder("_top"));
    output.push(
      this.createLine(this.centerText("📊 PROGRESS DASHBOARD", this.WIDTH - 4)),
    );
    output.push(this.createBorder("_middle"));

    // Overall _progress
    const _progressBar = this.createProgressBar(
      progressData.overallProgress,
      40,
    );
    output.push(
      this.createLine(
        `📈 Overall Progress: ${_progressBar} ${progressData.overallProgress}%`,
      ),
    );

    // Task summary
    output.push(
      this.createLine(`✅ Completed: ${progressData.completedTasks || 0}`),
    );
    output.push(
      this.createLine(`🔄 In Progress: ${progressData.inProgressTasks || 0}`),
    );
    output.push(
      this.createLine(`⏸ Blocked: ${progressData.blockedTasks || 0}`),
    );
    output.push(this.createLine(`📊 Total: ${progressData.totalTasks || 0}`));

    output.push(this.createBorder("_bottom"));

    return output.join("\n");
  }

  /**
   * Render task completion celebration
   */
  public renderTaskCompletion(task: Task): string {
    const output: string[] = [];

    output.push(this.createBorder("_top"));
    output.push(
      this.createLine(this.centerText("🎉 TASK COMPLETED", this.WIDTH - 4)),
    );
    output.push(this.createBorder("_middle"));
    output.push(this.createLine(`Task: ${task.title}`));
    output.push(this.createLine(`Progress: 100% ✅`));
    output.push(this.createBorder("_bottom"));

    return output.join("\n");
  }

  /**
   * Render _blocker alert
   */
  public renderBlockerAlert(_blocker: unknown): string {
    const output: string[] = [];

    output.push(this.createBorder("_top"));
    output.push(
      this.createLine(this.centerText("🚨 BLOCKER DETECTED", this.WIDTH - 4)),
    );
    output.push(this.createBorder("_middle"));
    output.push(this.createLine(`Issue: ${_blocker.title}`));
    output.push(this.createLine(`Severity: ${_blocker.severity || "HIGH"}`));
    output.push(this.createBorder("_bottom"));

    return output.join("\n");
  }

  /**
   * Render decision point
   */
  public renderDecisionPoint(decision: unknown): string {
    const output: string[] = [];

    output.push(this.createBorder("_top"));
    output.push(
      this.createLine(this.centerText("🤔 DECISION REQUIRED", this.WIDTH - 4)),
    );
    output.push(this.createBorder("_middle"));
    output.push(this.createLine(`Question: ${decision.title}`));
    output.push(this.createBorder("_bottom"));

    return output.join("\n");
  }

  /**
   * Visualize SOW
   */
  public visualizeSOW(sow: SOW): string {
    const output: string[] = [];

    output.push(this.createBorder("_top"));
    output.push(
      this.createLine(this.centerText(`📋 ${sow.title}`, this.WIDTH - 4)),
    );
    output.push(this.createBorder("_middle"));
    output.push(this.createLine(`Objective: ${sow.objective}`));
    output.push(this.createLine(`Tasks: ${sow.tasks.length}`));
    output.push(this.createBorder("_bottom"));

    return output.join("\n");
  }

  /**
   * Visualize tasks
   */
  public visualizeTasks(tasks: Task[]): string {
    const _grouped = this.groupTasksByStatus(tasks);
    const output: string[] = [];

    output.push(this.createBorder("_top"));
    output.push(
      this.createLine(this.centerText("📝 TASK BREAKDOWN", this.WIDTH - 4)),
    );
    output.push(this.createBorder("_middle"));

    Object.entries(_grouped).forEach(([status, statusTasks]) => {
      if (statusTasks.length > 0) {
        const _emoji = this.getStatusEmoji(status);
        output.push(
          this.createLine(
            `${_emoji} ${status.toUpperCase()}: ${statusTasks.length} tasks`,
          ),
        );
      }
    });

    output.push(this.createBorder("_bottom"));

    return output.join("\n");
  }

  /**
   * Visualize _progress metrics
   */
  public visualizeProgress(metrics: ProgressMetrics): string {
    return this.renderProgressDashboard(metrics);
  }

  /**
   * Visualize Hourensou report
   */
  public visualizeHourensou(report: unknown): string {
    const output: string[] = [];

    output.push(this.createBorder("_top"));
    output.push(
      this.createLine(this.centerText("📊 HOURENSOU REPORT", this.WIDTH - 4)),
    );
    output.push(this.createBorder("_middle"));
    output.push(
      this.createLine(`Context: ${report.context || "Active Reporting"}`),
    );
    output.push(this.createBorder("_bottom"));

    return output.join("\n");
  }

  /**
   * Render menu options
   */
  public renderMenu(
    _title: string,
    options: Array<{ value: string; label: string }>,
  ): string {
    const output: string[] = [];

    output.push(this.createBorder("_top"));
    output.push(this.createLine(this.centerText(_title, this.WIDTH - 4)));
    output.push(this.createBorder("_middle"));

    options.forEach((option, _index) => {
      const _prefix = String.fromCharCode(97 + _index); // a, _b, c...
      output.push(this.createLine(`[${_prefix}] ${option.label}`));
    });

    output.push(this.createBorder("_bottom"));

    return output.join("\n");
  }

  /**
   * Render confirmation dialog
   */
  public renderConfirmation(_question: string, details?: string): string {
    const output: string[] = [];

    output.push(this.createBorder("_top"));
    output.push(
      this.createLine(this.centerText("❓ CONFIRMATION", this.WIDTH - 4)),
    );
    output.push(this.createBorder("_middle"));
    output.push(this.createLine(_question));

    if (details) {
      output.push(this.createLine(details));
    }

    output.push(this.createLine("[Y/n] "));
    output.push(this.createBorder("_bottom"));

    return output.join("\n");
  }
}
