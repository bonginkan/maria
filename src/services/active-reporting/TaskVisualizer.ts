/**
 * Task Visualizer - Beautiful CLI visualization for tasks and progress
 * Implements the 124-character responsive design framework
 */

import chalk from 'chalk';
import {
  Task,
  SOW,
  ProgressMetrics,
  HourensouReport,
  ProgressReport,
  DecisionPoint,
} from './types';

export class TaskVisualizer {
  private readonly WIDTH = 124;
  private readonly BORDER_CHAR = '═';
  private readonly VERTICAL_CHAR = '║';
  private readonly CORNER_TL = '╔';
  private readonly CORNER_TR = '╗';
  private readonly CORNER_BL = '╚';
  private readonly CORNER_BR = '╝';

  // Status icons (no emoji for compatibility)
  private readonly ICONS = {
    completed: chalk.green('✓'),
    in_progress: chalk.yellow('⠋'),
    pending: chalk.gray('○'),
    blocked: chalk.red('✗'),
    deferred: chalk.gray('!'),
    arrow: chalk.cyan('→'),
    bullet: chalk.gray('•'),
  };

  /**
   * Visualize SOW
   */
  public visualizeSOW(_sow: SOW): string {
    const _lines: string[] = [];

    // Header
    lines.push(_this.createHeader('SOW: ' + sow.title));
    lines.push('');

    // Objective
    lines.push(chalk.cyan('Objective:'));
    lines.push(this.wrapText(sow.objective, 2));
    lines.push('');

    // Scope
    lines.push(chalk.cyan('Scope:'));
    sow.scope.forEach((_item) => {
      lines.push(`  ${this.ICONS.bullet} ${item}`);
    });
    lines.push('');

    // Timeline
    if (sow.timeline) {
      lines.push(chalk.cyan('Timeline:'));
      lines.push(`  Start: ${sow.timeline.startDate.toLocaleDateString()}`);
      lines.push(`  End: ${sow.timeline.endDate.toLocaleDateString()}`);
      const _duration =
        (sow.timeline.endDate.getTime() - sow.timeline.startDate.getTime()) / (1000 * 60 * 60);
      lines.push(`  Duration: ${duration.toFixed(1)} hours`);
      lines.push('');
    }

    // Tasks
    lines.push(chalk.cyan(`Tasks (${sow.tasks.length}):`));
    sow.tasks.slice(0, 10).forEach((task, _index) => {
      lines.push(this.formatTask(task, index + 1));
    });
    if (sow.tasks.length > 10) {
      lines.push(chalk.gray(`  ... and ${sow.tasks.length - 10} more tasks`));
    }
    lines.push('');

    // Risks
    if (sow.risks && sow.risks.length > 0) {
      lines.push(chalk.yellow('Risks:'));
      sow.risks.forEach((_risk) => {
        const _color =
          risk.impact === 'critical'
            ? chalk.red
            : risk.impact === 'high'
              ? chalk.yellow
              : chalk.gray;
        lines.push(`  ${color('!')} ${risk.description}`);
      });
      lines.push('');
    }

    // Footer
    lines.push(_this.createFooter(`Version: ${sow.version} | Status: ${sow.approvalStatus}`));

    return lines.join('\n');
  }

  /**
   * Visualize tasks with hierarchy
   */
  public visualizeTasks(_tasks: Task[]): string {
    const _lines: string[] = [];

    lines.push(this.createHeader('Task Breakdown'));
    lines.push('');

    // Group tasks by status
    const _grouped = this.groupTasksByStatus(tasks);

    // In Progress
    if (grouped.in_progress.length > 0) {
      lines.push(chalk.yellow('⏺ In Progress:'));
      grouped.in_progress.forEach((_task) => {
        lines.push(this.formatTaskWithProgress(task));
      });
      lines.push('');
    }

    // Pending
    if (grouped.pending.length > 0) {
      lines.push(chalk.cyan('⏹ Pending:'));
      grouped.pending.forEach((_task) => {
        lines.push(this.formatTaskSimple(task));
      });
      lines.push('');
    }

    // Blocked
    if (grouped.blocked.length > 0) {
      lines.push(chalk.red('⚠️ Blocked:'));
      grouped.blocked.forEach((_task) => {
        lines.push(this.formatTaskWithBlocker(task));
      });
      lines.push('');
    }

    // Completed
    if (grouped.completed.length > 0) {
      lines.push(chalk.green('✅ Completed:'));
      grouped.completed.slice(0, 5).forEach((_task) => {
        lines.push(this.formatTaskSimple(task));
      });
      if (grouped.completed.length > 5) {
        lines.push(chalk.gray(`  ... and ${grouped.completed.length - 5} more`));
      }
      lines.push('');
    }

    // Summary
    lines.push(this.createSummaryBar(tasks));

    return lines.join('\n');
  }

  /**
   * Visualize progress metrics
   */
  public visualizeProgress(_metrics: ProgressMetrics): string {
    const _lines: string[] = [];

    lines.push(this.createHeader('Progress Report'));
    lines.push('');

    // Progress bar
    lines.push(chalk.cyan('Overall Progress:'));
    lines.push(this.createProgressBar(metrics.progressPercentage));
    lines.push('');

    // Metrics grid
    lines.push(this.createMetricsGrid(metrics));
    lines.push('');

    // Velocity chart
    lines.push(chalk.cyan('Velocity:'));
    lines.push(this.createVelocityChart(metrics.velocity));
    lines.push('');

    // ETA
    lines.push(chalk.cyan('Estimated Completion:'));
    lines.push(`  ${metrics.eta.toLocaleString()}`);
    lines.push(`  Confidence: ${this.createConfidenceIndicator(metrics.confidenceLevel)}`);

    return lines.join('\n');
  }

  /**
   * Visualize Hourensou report
   */
  public visualizeHourensou(_report: HourensouReport): string {
    const _lines: string[] = [];

    lines.push(this.createHeader('ホウレンソウ (Hourensou) Report'));
    lines.push('');

    // Hou (報告 - Report)
    if (report.hou.length > 0) {
      lines.push(chalk.blue('📊 報告 (Hou - Report):'));
      lines.push(chalk.gray('─'.repeat(50)));
      report.hou.forEach((_item) => {
        const _icon =
          item.type === 'completion'
            ? this.ICONS.completed
            : item.type === 'progress'
              ? this.ICONS.in_progress
              : item.type === 'issue'
                ? this.ICONS.blocked
                : this.ICONS.bullet;
        lines.push(`${icon} ${item.title}`);
        lines.push(chalk.gray(`  ${item.details}`));
        if (item.impact) {
          lines.push(_chalk.yellow(`  Impact: ${item.impact}`));
        }
      });
      lines.push('');
    }

    // Ren (連絡 - Contact)
    if (report.ren.length > 0) {
      lines.push(chalk.yellow('📢 連絡 (Ren - Contact):'));
      lines.push(chalk.gray('─'.repeat(50)));
      report.ren.forEach((_item) => {
        const _urgencyColor =
          item.urgency === 'critical'
            ? chalk.red
            : item.urgency === 'high'
              ? chalk.yellow
              : item.urgency === 'normal'
                ? chalk.white
                : chalk.gray;
        lines.push(`${urgencyColor('!')} ${item.title}`);
        lines.push(chalk.gray(`  ${item.message}`));
      });
      lines.push('');
    }

    // Sou (相談 - Consult)
    if (report.sou.length > 0) {
      lines.push(chalk.magenta('💭 相談 (Sou - Consult):'));
      lines.push(chalk.gray('─'.repeat(50)));
      report.sou.forEach((_item) => {
        lines.push(`❓ ${item.question}`);
        lines.push(_chalk.gray(`  Context: ${item.context}`));
        if (item.recommendation) {
          lines.push(_chalk.green(`  Recommendation: ${item.recommendation}`));
        }
      });
      lines.push('');
    }

    lines.push(_this.createFooter(`Generated: ${report.timestamp.toLocaleString()}`));

    return lines.join('\n');
  }

  /**
   * Visualize decision point
   */
  public visualizeDecision(_decision: DecisionPoint): string {
    const _lines: string[] = [];

    lines.push(this.createHeader('Decision Required'));
    lines.push('');

    lines.push(chalk.yellow('❓ ' + decision.question));
    lines.push('');

    lines.push(chalk.gray('Context:'));
    lines.push(this.wrapText(decision.context, 2));
    lines.push('');

    if (decision.options && decision.options.length > 0) {
      lines.push(chalk.cyan('Options:'));
      decision.options.forEach((option, _index) => {
        const _letter = String.fromCharCode(97 + index); // a, _b, c...
        lines.push(`  ${chalk.bold(letter + ')')} ${option.label}`);
        lines.push(chalk.gray(`     ${option.description}`));

        if (option.pros && option.pros.length > 0) {
          lines.push(_chalk.green(`     Pros: ${option.pros.join(', ')}`));
        }

        if (option.cons && option.cons.length > 0) {
          lines.push(_chalk.red(`     Cons: ${option.cons.join(', ')}`));
        }

        if (option.estimatedTime) {
          lines.push(_chalk.gray(`     Time: ${option.estimatedTime} minutes`));
        }

        lines.push('');
      });
    }

    if (decision.recommendation) {
      lines.push(_chalk.green(`Recommendation: ${decision.recommendation}`));
    }

    if (decision.deadline) {
      lines.push(_chalk.yellow(`Deadline: ${decision.deadline.toLocaleString()}`));
    }

    return lines.join('\n');
  }

  /**
   * Create beautiful progress visualization
   */
  public createBeautifulProgress(_report: ProgressReport): string {
    const _lines: string[] = [];

    // Main header
    lines.push(this.createDoubleLineHeader('ACTIVE TASK MANAGEMENT'));
    lines.push('');

    // Current objective
    if (report.summary) {
      lines.push(`  ${chalk.cyan('🎯')} Current Objective: ${chalk.bold(report.summary)}`);
      lines.push(
        `  ${chalk.blue('📊')} Overall Progress: ${this.createInlineProgressBar(report.overallProgress)}`,
      );
      lines.push('');
    }

    // Task tree visualization
    lines.push('  ⏺ Update Todos');

    // Current tasks
    report.currentTasks.forEach((_task) => {
      const _icon =
        task.status === 'completed'
          ? chalk.green('✅')
          : task.status === 'in_progress'
            ? chalk.yellow('🔄')
            : task.status === 'blocked'
              ? chalk.red('⏸')
              : chalk.gray('⏹');

      const _progress =
        task.status === 'in_progress' && task.progress ? chalk.gray(` [${task.progress}%]`) : '';

      lines.push(`    ⎿  ${icon} ${task.title}${progress}`);
    });

    // Upcoming tasks
    report.upcomingTasks.slice(0, 5).forEach((_task) => {
      lines.push(`       ${chalk.gray('⏹')} ${chalk.gray(task.title)}`);
    });

    if (report.upcomingTasks.length > 5) {
      lines.push(`       ${chalk.gray(`... and ${report.upcomingTasks.length - 5} more`)}`);
    }

    lines.push('');

    // Statistics section
    const _completedCount = report.completedTasks.length;
    const _totalCount = completedCount + report.currentTasks.length + report.upcomingTasks.length;
    const _timeSpent = this.formatTime(
      report.completedTasks.reduce((sum, _t) => sum + (t.actualTime || 0), 0),
    );
    const _timeEstimated = this.formatTime(totalCount * 60); // Rough estimate

    lines.push(`  ${chalk.cyan('📈')} Statistics`);
    lines.push(
      `    ${this.ICONS.bullet} Completed: ${completedCount}/${totalCount} tasks (${Math.round((completedCount / totalCount) * 100)}%)`,
    );
    lines.push(`    ${this.ICONS.bullet} Time Spent: ${timeSpent} / Est: ${timeEstimated}`);
    lines.push(
      `    ${this.ICONS.bullet} Velocity: ${(completedCount / (parseInt(timeSpent) || 1)).toFixed(1)} tasks/hour`,
    );
    lines.push(
      `    ${this.ICONS.bullet} ETA: ${this.calculateETA(totalCount - completedCount, 1.5)}`,
    );
    lines.push('');

    // Blockers & Risks
    if (report.blockers && report.blockers.length > 0) {
      lines.push(`  ${chalk.yellow('⚠️')} Blockers & Risks`);
      report.blockers.forEach((_blocker) => {
        lines.push(`    ${this.ICONS.bullet} ${blocker.description}`);
      });
      lines.push('');
    }

    // AI Recommendations
    if (report.recommendations && report.recommendations.length > 0) {
      lines.push(`  ${chalk.blue('💡')} AI Recommendations`);
      report.recommendations.forEach((_rec) => {
        lines.push(`    ${this.ICONS.bullet} ${rec}`);
      });
      lines.push('');
    }

    // Footer
    lines.push(this.createDoubleLineFooter());

    return lines.join('\n');
  }

  // Helper methods

  private createHeader(_title: string): string {
    const _titleLength = title.length;
    const _totalPadding = this.WIDTH - titleLength - 4; // 4 for corners and spaces
    const _leftPadding = Math.floor(totalPadding / 2);
    const _rightPadding = totalPadding - leftPadding;

    const _top = this.CORNER_TL + this.BORDER_CHAR.repeat(this.WIDTH - 2) + this.CORNER_TR;
    const _middle =
      this.VERTICAL_CHAR +
      ' '.repeat(leftPadding) +
      chalk.bold(title) +
      ' '.repeat(rightPadding) +
      this.VERTICAL_CHAR;
    const _bottom = this.CORNER_BL + this.BORDER_CHAR.repeat(this.WIDTH - 2) + this.CORNER_BR;

    return `${top}\n${middle}\n${bottom}`;
  }

  private createDoubleLineHeader(_title: string): string {
    const _line = '═'.repeat(this.WIDTH);
    const _titleLine = this.centerText(title, this.WIDTH);

    return `╔${line.slice(2)}╗\n║${titleLine.slice(2)}║\n╠${line.slice(2)}╣`;
  }

  private createDoubleLineFooter(): string {
    const _line = '═'.repeat(this.WIDTH);
    return `╚${line.slice(2)}╝`;
  }

  private createFooter(_text: string): string {
    const _padding = this.WIDTH - text.length - 4;
    const _leftPad = Math.floor(padding / 2);
    const _rightPad = padding - leftPad;

    return (
      this.CORNER_BL +
      this.BORDER_CHAR +
      ' '.repeat(leftPad) +
      chalk.gray(text) +
      ' '.repeat(rightPad) +
      this.BORDER_CHAR +
      this.CORNER_BR
    );
  }

  private createProgressBar(_percentage: number): string {
    const _width = 50;
    const _filled = Math.round((percentage / 100) * width);
    const _empty = width - filled;

    const _bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const _percentText = `${percentage.toFixed(1)}%`.padStart(6);

    return `  ${bar} ${chalk.cyan(percentText)}`;
  }

  private createInlineProgressBar(_percentage: number): string {
    const _width = 30;
    const _filled = Math.round((percentage / 100) * width);
    const _empty = width - filled;

    const _bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `${bar} ${percentage}%`;
  }

  private createVelocityChart(_velocity: number): string {
    const _maxBars = 20;
    const _bars = Math.min(maxBars, Math.round(velocity * 5));
    const _chart = '▃'.repeat(bars);

    return `  ${chalk.cyan(chart)} ${velocity.toFixed(2)} tasks/hour`;
  }

  private createConfidenceIndicator(_confidence: number): string {
    const _stars = Math.round(confidence / 20);
    return '★'.repeat(stars) + '☆'.repeat(5 - stars) + ` (${confidence}%)`;
  }

  private createMetricsGrid(_metrics: ProgressMetrics): string {
    const _lines: string[] = [];

    lines.push('  ┌─────────────────────┬─────────────────────┐');
    lines.push(`  │ Tasks Completed     │ ${String(metrics.tasksCompleted).padStart(18)} │`);
    lines.push(`  │ Tasks Total         │ ${String(metrics.tasksTotal).padStart(18)} │`);
    lines.push('  ├─────────────────────┼─────────────────────┤');
    lines.push(`  │ Time Spent          │ ${(metrics.timeSpent + ' min').padStart(18)} │`);
    lines.push(`  │ Time Estimated      │ ${(metrics.timeEstimated + ' min').padStart(18)} │`);
    lines.push('  └─────────────────────┴─────────────────────┘');

    return lines.join('\n');
  }

  private createSummaryBar(_tasks: Task[]): string {
    const _total = tasks.length;
    const _completed = tasks.filter((_t) => t.status === 'completed').length;
    const _inProgress = tasks.filter((_t) => t.status === 'in_progress').length;
    const _blocked = tasks.filter((_t) => t.status === 'blocked').length;
    const _pending = tasks.filter((_t) => t.status === 'pending').length;

    return chalk.gray(
      `Summary: ${chalk.green(`✓ ${completed}`)} | ` +
        `${chalk.yellow(`⠋ ${inProgress}`)} | ` +
        `${chalk.red(`✗ ${blocked}`)} | ` +
        `${chalk.gray(`○ ${pending}`)} | ` +
        `Total: ${total}`,
    );
  }

  private formatTask(_task: Task, _index: number): string {
    const _icon = this.getStatusIcon(task.status);
    const _priority =
      task.priority === 'critical'
        ? chalk.red('[!]')
        : task.priority === 'high'
          ? chalk.yellow('[H]')
          : '';
    const _time = task.estimatedTime ? chalk.gray(` (${task.estimatedTime}m)`) : '';

    return `  ${index}. ${icon} ${priority} ${task.title}${time}`;
  }

  private formatTaskWithProgress(_task: Task): string {
    const _progress = task.progress || 0;
    const _progressBar = this.createMiniProgressBar(progress);
    const _time = task.actualTime
      ? chalk.gray(` (${task.actualTime.toFixed(0)}/${task.estimatedTime || '?'}m)`)
      : '';

    return `  ${this.ICONS.in_progress} ${task.title} ${progressBar}${time}`;
  }

  private formatTaskSimple(_task: Task): string {
    const _icon = this.getStatusIcon(task.status);
    return `  ${icon} ${task.title}`;
  }

  private formatTaskWithBlocker(_task: Task): string {
    const _blocker = task.blockers && task.blockers[0] ? chalk.red(` - ${task.blockers[0]}`) : '';
    return `  ${this.ICONS.blocked} ${task.title}${blocker}`;
  }

  private createMiniProgressBar(_percentage: number): string {
    const _width = 10;
    const _filled = Math.round((percentage / 100) * width);
    const _empty = width - filled;

    return (
      chalk.gray('[') +
      chalk.green('='.repeat(filled)) +
      chalk.gray('-'.repeat(empty)) +
      chalk.gray(']') +
      chalk.cyan(` ${percentage}%`)
    );
  }

  private getStatusIcon(_status: Task['status']): string {
    return this.ICONS[status] || this.ICONS.pending;
  }

  private groupTasksByStatus(_tasks: Task[]): Record<Task['status'], Task[]> {
    return {
      pending: tasks.filter((_t) => t.status === 'pending'),
      in_progress: tasks.filter((_t) => t.status === 'in_progress'),
      completed: tasks.filter((_t) => t.status === 'completed'),
      blocked: tasks.filter((_t) => t.status === 'blocked'),
      deferred: tasks.filter((_t) => t.status === 'deferred'),
    };
  }

  private wrapText(_text: string, _indent: number = 0): string {
    const _maxWidth = this.WIDTH - indent - 4;
    const _words = text.split(' ');
    const _lines: string[] = [];
    const _currentLine = '';

    words.forEach((_word) => {
      if ((currentLine + word).length > maxWidth) {
        lines.push(' '.repeat(indent) + currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });

    if (currentLine) {
      lines.push(' '.repeat(indent) + currentLine.trim());
    }

    return lines.join('\n');
  }

  private centerText(_text: string, _width: number): string {
    const _padding = width - text.length;
    const _leftPad = Math.floor(padding / 2);
    const _rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }

  private formatTime(_minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const _hours = Math.floor(minutes / 60);
    const _mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  }

  private calculateETA(_remainingTasks: number, _velocity: number): string {
    const _remainingHours = remainingTasks / velocity;
    const _eta = new Date(Date.now() + remainingHours * 3600000);
    return `${remainingHours.toFixed(1)}h remaining`;
  }

  /**
   * Render progress dashboard
   */
  public renderProgressDashboard(_progressData: ProgressMetrics): string {
    const _output: string[] = [];

    output.push(this.createBorder('top'));
    output.push(this.createLine(this.centerText('📊 PROGRESS DASHBOARD', this.WIDTH - 4)));
    output.push(this.createBorder('middle'));

    // Overall progress
    const _progressBar = this.renderProgressBar(progressData.overallProgress, 40);
    output.push(
      this.createLine(`📈 Overall Progress: ${progressBar} ${progressData.overallProgress}%`),
    );

    // Task summary
    output.push(_this.createLine(`✅ Completed: ${progressData.completedTasks || 0}`));
    output.push(_this.createLine(`🔄 In Progress: ${progressData.inProgressTasks || 0}`));
    output.push(_this.createLine(`⏸ Blocked: ${progressData.blockedTasks || 0}`));
    output.push(_this.createLine(`📊 Total: ${progressData.totalTasks || 0}`));

    output.push(this.createBorder('bottom'));

    return output.join('\n');
  }

  /**
   * Render task completion celebration
   */
  public renderTaskCompletion(_task: Task): string {
    const _output: string[] = [];

    output.push(this.createBorder('top'));
    output.push(this.createLine(this.centerText('🎉 TASK COMPLETED', this.WIDTH - 4)));
    output.push(this.createBorder('middle'));
    output.push(_this.createLine(`Task: ${task.title}`));
    output.push(_this.createLine(`Progress: 100% ✅`));
    output.push(this.createBorder('bottom'));

    return output.join('\n');
  }

  /**
   * Render blocker alert
   */
  public renderBlockerAlert(_blocker: unknown): string {
    const _output: string[] = [];

    output.push(this.createBorder('top'));
    output.push(this.createLine(this.centerText('🚨 BLOCKER DETECTED', this.WIDTH - 4)));
    output.push(this.createBorder('middle'));
    output.push(_this.createLine(`Issue: ${blocker.title}`));
    output.push(_this.createLine(`Severity: ${blocker.severity || 'HIGH'}`));
    output.push(this.createBorder('bottom'));

    return output.join('\n');
  }

  /**
   * Render decision point
   */
  public renderDecisionPoint(_decision: unknown): string {
    const _output: string[] = [];

    output.push(this.createBorder('top'));
    output.push(this.createLine(this.centerText('🤔 DECISION REQUIRED', this.WIDTH - 4)));
    output.push(this.createBorder('middle'));
    output.push(_this.createLine(`Question: ${decision.title}`));
    output.push(this.createBorder('bottom'));

    return output.join('\n');
  }

  /**
   * Visualize SOW
   */
  public visualizeSOW(_sow: SOW): string {
    const _output: string[] = [];

    output.push(this.createBorder('top'));
    output.push(this.createLine(this.centerText(`📋 ${sow.title}`, this.WIDTH - 4)));
    output.push(this.createBorder('middle'));
    output.push(_this.createLine(`Objective: ${sow.objective}`));
    output.push(_this.createLine(`Tasks: ${sow.tasks.length}`));
    output.push(this.createBorder('bottom'));

    return output.join('\n');
  }

  /**
   * Visualize tasks
   */
  public visualizeTasks(_tasks: Task[]): string {
    const _grouped = this.groupTasksByStatus(tasks);
    const _output: string[] = [];

    output.push(this.createBorder('top'));
    output.push(this.createLine(this.centerText('📝 TASK BREAKDOWN', this.WIDTH - 4)));
    output.push(this.createBorder('middle'));

    Object.entries(grouped).forEach(([status, statusTasks]) => {
      if (statusTasks.length > 0) {
        const _emoji = this.getStatusEmoji(status);
        output.push(
          this.createLine(`${emoji} ${status.toUpperCase()}: ${statusTasks.length} tasks`),
        );
      }
    });

    output.push(this.createBorder('bottom'));

    return output.join('\n');
  }

  /**
   * Visualize progress metrics
   */
  public visualizeProgress(_metrics: ProgressMetrics): string {
    return this.renderProgressDashboard(metrics);
  }

  /**
   * Visualize Hourensou report
   */
  public visualizeHourensou(_report: unknown): string {
    const _output: string[] = [];

    output.push(this.createBorder('top'));
    output.push(this.createLine(this.centerText('📊 HOURENSOU REPORT', this.WIDTH - 4)));
    output.push(this.createBorder('middle'));
    output.push(_this.createLine(`Context: ${report.context || 'Active Reporting'}`));
    output.push(this.createBorder('bottom'));

    return output.join('\n');
  }

  /**
   * Render menu options
   */
  public renderMenu(_title: string, _options: Array<{ value: string; label: string }>): string {
    const _output: string[] = [];

    output.push(this.createBorder('top'));
    output.push(this.createLine(this.centerText(title, this.WIDTH - 4)));
    output.push(this.createBorder('middle'));

    options.forEach((option, _index) => {
      const _prefix = String.fromCharCode(97 + index); // a, _b, c...
      output.push(this.createLine(`[${prefix}] ${option.label}`));
    });

    output.push(this.createBorder('bottom'));

    return output.join('\n');
  }

  /**
   * Render confirmation dialog
   */
  public renderConfirmation(_question: string, _details?: string): string {
    const _output: string[] = [];

    output.push(this.createBorder('top'));
    output.push(this.createLine(this.centerText('❓ CONFIRMATION', this.WIDTH - 4)));
    output.push(this.createBorder('middle'));
    output.push(this.createLine(question));

    if (details) {
      output.push(this.createLine(details));
    }

    output.push(this.createLine('[Y/n] '));
    output.push(this.createBorder('bottom'));

    return output.join('\n');
  }
}
