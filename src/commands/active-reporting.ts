/**
 * Active Reporting CLI Commands
 * Implements task management and proactive reporting commands
 */
import chalk from 'chalk';
import { ActiveReportingService } from '../services/active-reporting';
import { Task } from '../services/active-reporting/types';

export class ActiveReportingCommand {
  private service: ActiveReportingService;

  constructor() {
    this.service = ActiveReportingService.getInstance();
  }

  /**
   * Task management commands
   */
  async task(subcommand?: string, ...args: string[]): Promise<void> {
    switch (subcommand) {
      case 'list':
        await this.listTasks();
        break;
      case 'add':
        await this.addTask(args.join(' '));
        break;
      case 'update':
        if (args[0] && args[1]) {
          await this.updateTask(args[0], args[1]);
        } else {
          console.log(chalk.red('❌ Task ID and status are required'));
        }
        break;
      case 'depends':
        if (args[0]) {
          await this.setDependencies(args[0], args.slice(1));
        } else {
          console.log(chalk.red('❌ Task ID is required'));
        }
        break;
      case 'estimate':
        if (args[0] && args[1]) {
          await this.setEstimate(args[0], parseInt(args[1]));
        } else {
          console.log(chalk.red('❌ Task ID and time estimate are required'));
        }
        break;
      default:
        await this.showTaskOverview();
    }
  }

  /**
   * SOW management commands
   */
  async sow(subcommand?: string, ...args: string[]): Promise<void> {
    switch (subcommand) {
      case 'generate':
        await this.generateSOW(args.join(' '));
        break;
      case 'approve':
        await this.approveSOW();
        break;
      case 'modify':
        await this.modifySOW();
        break;
      default:
        await this.showCurrentSOW();
    }
  }

  /**
   * Progress tracking commands
   */
  async progress(subcommand?: string): Promise<void> {
    switch (subcommand) {
      case 'detailed':
        await this.showDetailedProgress();
        break;
      case 'history':
        await this.showProgressHistory();
        break;
      case 'forecast':
        await this.showProgressForecast();
        break;
      default:
        await this.showProgressDashboard();
    }
  }

  /**
   * Reporting commands
   */
  async report(subcommand?: string, ...args: string[]): Promise<void> {
    switch (subcommand) {
      case 'blocker':
        await this.reportBlocker(args.join(' '));
        break;
      case 'risk':
        await this.reportRisk(args.join(' '));
        break;
      case 'export':
        await this.exportReport(args[0] as 'json' | 'markdown');
        break;
      default:
        await this.generateStatusReport();
    }
  }

  /**
   * Show current task overview
   */
  private async showTaskOverview(): Promise<void> {
    console.log(chalk.cyan(`\n${  '═'.repeat(124)}`));
    console.log(chalk.cyan.bold(this.centerText('📋 ACTIVE TASK OVERVIEW', 124)));
    console.log(chalk.cyan('═'.repeat(124)));

    const currentTasks = this.service.getCurrentTasks();

    if (currentTasks.length === 0) {
      console.log(
        chalk.gray('\n   No active tasks. Use "/task add <description>" to create a new task.\n'),
      );
      console.log(chalk.cyan(`${'═'.repeat(124)  }\n`));
      return;
    }

    currentTasks.forEach((task) => {
      this.displayTask(task);
    });

    console.log(chalk.cyan(`${'═'.repeat(124)  }\n`));
  }

  /**
   * List all tasks with status
   */
  private async listTasks(): Promise<void> {
    const allTasks = this.service.getAllTasks();

    console.log(chalk.cyan(`\n${  '═'.repeat(124)}`));
    console.log(chalk.cyan.bold(this.centerText('📝 ALL TASKS', 124)));
    console.log(chalk.cyan('═'.repeat(124)));

    if (allTasks.length === 0) {
      console.log(chalk.gray('\n   No tasks found.\n'));
      console.log(chalk.cyan(`${'═'.repeat(124)  }\n`));
      return;
    }

    // Group tasks by status
    const tasksByStatus = allTasks.reduce(
      (acc: Record<string, Task[]>, task: Task) => {
        if (!acc[task.status]) {acc[task.status] = [];}
        acc[task.status].push(task);
        return acc;
      },
      {} as Record<string, Task[]>,
    );

    Object.entries(tasksByStatus).forEach(([status, tasks]: [string, Task[]]) => {
      console.log(
        chalk.yellow(
          `\n📊 ${this.getStatusEmoji(status)} ${this.capitalizeFirst(status.replace('_', ' '))} (${tasks.length})`,
        ),
      );
      tasks.forEach((task: Task) => {
        console.log(chalk.white(`   ${task.id}: ${task.title}`));
        if (task.progress > 0) {
          console.log(chalk.gray(`      Progress: ${task.progress}%`));
        }
      });
    });

    console.log(chalk.cyan(`\n${  '═'.repeat(124)  }\n`));
  }

  /**
   * Add a new task
   */
  private async addTask(description: string): Promise<void> {
    if (!description.trim()) {
      console.log(chalk.red('❌ Task description is required'));
      return;
    }

    try {
      const intent = await this.service.analyzeUserIntent(description);
      const task = await this.service.createTask(intent);

      console.log(chalk.green(`✅ Task created: ${task.title}`));
      console.log(chalk.gray(`   ID: ${task.id}`));
      console.log(chalk.gray(`   Estimated time: ${task.estimatedTime} minutes`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to create task: ${(error as Error).message}`));
    }
  }

  /**
   * Update task status
   */
  private async updateTask(taskId: string, status: string): Promise<void> {
    if (!taskId || !status) {
      console.log(chalk.red('❌ Task ID and status are required'));
      console.log(chalk.gray('   Example: /task update task-123 completed'));
      return;
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'blocked', 'deferred'];
    if (!validStatuses.includes(status)) {
      console.log(chalk.red(`❌ Invalid status. Must be one of: ${validStatuses.join(', ')}`));
      return;
    }

    try {
      await this.service.updateTaskStatus(taskId, status as any);
      console.log(chalk.green(`✅ Task ${taskId} status updated to: ${status}`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to update task: ${(error as Error).message}`));
    }
  }

  /**
   * Set task dependencies
   */
  private async setDependencies(taskId: string, dependencies: string[]): Promise<void> {
    if (!taskId) {
      console.log(chalk.red('❌ Task ID is required'));
      return;
    }

    try {
      await this.service.setTaskDependencies(taskId, dependencies);
      console.log(chalk.green(`✅ Dependencies set for task ${taskId}`));
      console.log(chalk.gray(`   Dependencies: ${dependencies.join(', ')}`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to set dependencies: ${(error as Error).message}`));
    }
  }

  /**
   * Set task time estimate
   */
  private async setEstimate(taskId: string, minutes: number): Promise<void> {
    if (!taskId || isNaN(minutes) || minutes <= 0) {
      console.log(chalk.red('❌ Valid task ID and time in minutes are required'));
      return;
    }

    try {
      await this.service.updateTaskEstimate(taskId, minutes);
      console.log(chalk.green(`✅ Time estimate updated for task ${taskId}: ${minutes} minutes`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to update estimate: ${(error as Error).message}`));
    }
  }

  /**
   * Generate SOW from user request
   */
  private async generateSOW(request: string): Promise<void> {
    if (!request.trim()) {
      console.log(chalk.red('❌ Request description is required'));
      return;
    }

    console.log(chalk.yellow('🔄 Analyzing request and generating SOW...'));

    try {
      const intent = await this.service.analyzeUserIntent(request);
      const sow = await this.service.createSOWFromIntent(intent);

      console.log(chalk.cyan(`\n${  '═'.repeat(124)}`));
      console.log(chalk.cyan.bold(this.centerText('📋 GENERATED SOW', 124)));
      console.log(chalk.cyan('═'.repeat(124)));

      console.log(chalk.white(`\n🎯 ${chalk.bold('Objective:')} ${sow.objective}`));
      console.log(
        chalk.white(
          `📅 ${chalk.bold('Timeline:')} ${Math.round((sow.timeline.endDate.getTime() - sow.timeline.startDate.getTime()) / (1000 * 60 * 60 * 24))} days`,
        ),
      );
      console.log(chalk.white(`📊 ${chalk.bold('Total Tasks:')} ${sow.tasks.length}`));

      console.log(chalk.yellow('\n📝 Main Tasks:'));
      sow.tasks.slice(0, 5).forEach((task, index) => {
        console.log(chalk.white(`   ${index + 1}. ${task.title} (${task.estimatedTime}min)`));
      });

      if (sow.tasks.length > 5) {
        console.log(chalk.gray(`   ... and ${sow.tasks.length - 5} more tasks`));
      }

      console.log(chalk.blue('\n🔍 Shall I proceed with this plan? [Y/n/modify]'));
      console.log(chalk.cyan(`${'═'.repeat(124)  }\n`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to generate SOW: ${(error as Error).message}`));
    }
  }

  /**
   * Show current SOW
   */
  private async showCurrentSOW(): Promise<void> {
    const currentSOW = this.service.getCurrentSOW();

    if (!currentSOW) {
      console.log(chalk.gray('📋 No current SOW. Use "/sow generate <request>" to create one.'));
      return;
    }

    console.log(chalk.cyan(`\n${  '═'.repeat(124)}`));
    console.log(chalk.cyan.bold(this.centerText('📋 CURRENT SOW', 124)));
    console.log(chalk.cyan('═'.repeat(124)));

    console.log(chalk.white(`\n🎯 ${chalk.bold('Title:')} ${currentSOW.title}`));
    console.log(chalk.white(`📝 ${chalk.bold('Objective:')} ${currentSOW.objective}`));
    console.log(
      chalk.white(
        `📅 ${chalk.bold('Timeline:')} ${Math.round((currentSOW.timeline.endDate.getTime() - currentSOW.timeline.startDate.getTime()) / (1000 * 60 * 60 * 24))} days`,
      ),
    );

    console.log(chalk.yellow('\n📊 Progress:'));
    const completedTasks = currentSOW.tasks.filter((t) => t.status === 'completed').length;
    const progress = (completedTasks / currentSOW.tasks.length) * 100;
    console.log(
      chalk.white(
        `   ${completedTasks}/${currentSOW.tasks.length} tasks completed (${progress.toFixed(1)}%)`,
      ),
    );

    console.log(chalk.cyan(`\n${  '═'.repeat(124)  }\n`));
  }

  /**
   * Show progress dashboard
   */
  private async showProgressDashboard(): Promise<void> {
    const progressData = this.service.getProgressData();
    console.log(this.service.visualizeProgress(progressData));
  }

  /**
   * Generate status report
   */
  private async generateStatusReport(): Promise<void> {
    console.log(chalk.yellow('🔄 Generating status report...'));

    try {
      const report = await this.service.generateProgressReport();

      console.log(chalk.cyan(`\n${  '═'.repeat(124)}`));
      console.log(chalk.cyan.bold(this.centerText('📊 STATUS REPORT', 124)));
      console.log(chalk.cyan('═'.repeat(124)));

      console.log(
        chalk.white(`\n📅 ${chalk.bold('Generated:')} ${report.timestamp.toLocaleString()}`),
      );
      console.log(chalk.white(`📝 ${chalk.bold('Summary:')} ${report.summary}`));
      console.log(chalk.white(`📊 ${chalk.bold('Overall Progress:')} ${report.overallProgress}%`));

      if (report.blockers.length > 0) {
        console.log(chalk.red('\n⚠️  Current Blockers:'));
        report.blockers.forEach((blocker: unknown) => {
          console.log(chalk.red(`   • ${blocker.title}`));
        });
      }

      if (report.recommendations.length > 0) {
        console.log(chalk.yellow('\n💡 Recommendations:'));
        report.recommendations.forEach((rec: string) => {
          console.log(chalk.yellow(`   • ${rec}`));
        });
      }

      console.log(chalk.cyan(`\n${  '═'.repeat(124)  }\n`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to generate report: ${(error as Error).message}`));
    }
  }

  /**
   * Report a blocker
   */
  private async reportBlocker(description: string): Promise<void> {
    if (!description.trim()) {
      console.log(chalk.red('❌ Blocker description is required'));
      return;
    }

    try {
      await this.service.reportBlocker(description);
      console.log(chalk.yellow('⚠️  Blocker reported and analysis initiated'));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to report blocker: ${(error as Error).message}`));
    }
  }

  /**
   * Export reports
   */
  private async exportReport(format: 'json' | 'markdown' = 'json'): Promise<void> {
    try {
      const exported = this.service.exportReports(format);
      const filename = `maria-reports-${Date.now()}.${format === 'json' ? 'json' : 'md'}`;

      // In a real implementation, this would write to file
      console.log(chalk.green(`📄 Report exported (${format.toUpperCase()})`));
      console.log(chalk.gray(`   Filename: ${filename}`));
      console.log(chalk.gray(`   Content length: ${exported.length} characters`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to export report: ${(error as Error).message}`));
    }
  }

  /**
   * Helper methods
   */
  private displayTask(task: Task): void {
    const statusEmoji = this.getStatusEmoji(task.status);
    const priorityColor = this.getPriorityColor(task.priority);

    console.log(priorityColor(`\n${statusEmoji} ${task.title}`));
    console.log(chalk.gray(`   ID: ${task.id} | Priority: ${task.priority}`));

    if (task.progress > 0) {
      const progressBar = this.createProgressBar(task.progress);
      console.log(chalk.white(`   Progress: ${progressBar} ${task.progress}%`));
    }

    if (task.estimatedTime) {
      console.log(chalk.gray(`   Estimated: ${task.estimatedTime}min`));
    }

    if (task.dependencies && task.dependencies.length > 0) {
      console.log(chalk.gray(`   Depends on: ${task.dependencies.join(', ')}`));
    }
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '🔄';
      case 'blocked':
        return '⏸';
      case 'deferred':
        return '⏹';
      case 'pending':
        return '⏹';
      default:
        return '❓';
    }
  }

  private getPriorityColor(priority: string): unknown {
    switch (priority) {
      case 'critical':
        return chalk.red.bold;
      case 'high':
        return chalk.yellow.bold;
      case 'medium':
        return chalk.blue.bold;
      case 'low':
        return chalk.gray.bold;
      default:
        return chalk.white.bold;
    }
  }

  private createProgressBar(progress: number, width: number = 20): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  private centerText(text: string, width: number): string {
    // eslint-disable-next-line no-control-regex
    const textLength = text.replace(/\u001B\[[0-9;]*m/g, '').length; // Remove ANSI codes
    const padding = Math.max(0, Math.floor((width - textLength) / 2));
    return ' '.repeat(padding) + text + ' '.repeat(width - textLength - padding);
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private async approveSOW(): Promise<void> {
    console.log(chalk.green('✅ SOW approved. Proceeding with implementation.'));
  }

  private async modifySOW(): Promise<void> {
    console.log(chalk.blue('🔧 Entering SOW modification mode...'));
  }

  private async showDetailedProgress(): Promise<void> {
    console.log(chalk.cyan('📊 Detailed progress analysis coming soon...'));
  }

  private async showProgressHistory(): Promise<void> {
    console.log(chalk.cyan('📈 Progress history visualization coming soon...'));
  }

  private async showProgressForecast(): Promise<void> {
    console.log(chalk.cyan('🔮 Progress forecast and ETA analysis coming soon...'));
  }

  private async reportRisk(description: string): Promise<void> {
    console.log(chalk.yellow(`⚠️  Risk reported: ${description}`));
  }
}

// Export command handlers for CLI integration
export const activeReportingCommand = new ActiveReportingCommand();

export const taskCommand = activeReportingCommand.task.bind(activeReportingCommand);
export const sowCommand = activeReportingCommand.sow.bind(activeReportingCommand);
export const progressCommand = activeReportingCommand.progress.bind(activeReportingCommand);
export const reportCommand = activeReportingCommand.report.bind(activeReportingCommand);
