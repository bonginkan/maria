/**
 * Agent Mode Service
 * Provides autonomous file creation, task execution, and real-time reporting
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

import { logger } from '../../utils/logger';

export interface FileOperation {
  type: 'file' | 'directory';
  path: string;
  content?: string;
  description?: string;
}

export interface TaskResult {
  task: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  createdFiles?: string[];
  error?: string;
}

export interface AgentModeOptions {
  dryRun?: boolean;
  parallel?: boolean;
  reportProgress?: boolean;
  requireApproval?: boolean;
}

export interface InternalMode {
  mode: string;
  symbol: string;
  description: string;
}

export class AgentModeService {
  private static instance: AgentModeService;
  private currentMode: InternalMode;
  private isProcessing: boolean = false;
  private createdItems: string[] = [];

  // Internal Modes for visualization
  private readonly internalModes: Record<string, InternalMode> = {
    thinking: { mode: 'Thinking', symbol: '✽', description: '思考中...' },
    planning: { mode: 'Planning', symbol: '✽', description: 'タスクを計画中...' },
    analyzing: { mode: 'Analyzing', symbol: '✽', description: 'コードを分析中...' },
    creating: { mode: 'Creating', symbol: '✽', description: 'ファイルを作成中...' },
    optimizing: { mode: 'Optimizing', symbol: '✽', description: '最適化中...' },
    reviewing: { mode: 'Reviewing', symbol: '✽', description: 'レビュー中...' },
    testing: { mode: 'Testing', symbol: '✽', description: 'テスト中...' },
    documenting: { mode: 'Documenting', symbol: '✽', description: 'ドキュメント作成中...' },
    organizing: { mode: 'Organizing', symbol: '✽', description: '整理中...' },
    debugging: { mode: 'Debugging', symbol: '🐛', description: 'デバッグ中...' },
  };

  private constructor() {
    this.currentMode = this.internalModes.thinking;
  }

  public static getInstance(): AgentModeService {
    if (!AgentModeService.instance) {
      AgentModeService.instance = new AgentModeService();
    }
    return AgentModeService.instance;
  }

  /**
   * Execute agent mode with file creation and reporting
   */
  public async executeAgentMode(
    taskDescription: string,
    operations: FileOperation[],
    options: AgentModeOptions = {},
  ): Promise<TaskResult[]> {
    this.isProcessing = true;
    this.createdItems = [];
    const results: TaskResult[] = [];

    try {
      // 1. Planning Phase
      await this.setMode('planning');
      this.reportPlan(taskDescription, operations);

      // 2. Approval Phase (if required)
      if (options.requireApproval && !options.dryRun) {
        const approved = await this.requestApproval(operations);
        if (!approved) {
          return [
            {
              task: taskDescription,
              status: 'skipped',
              message: 'User rejected the operation',
            },
          ];
        }
      }

      // 3. Creation Phase
      await this.setMode('creating');

      if (options.parallel) {
        // Parallel execution
        const promises = operations.map((op) => this.executeOperation(op, options));
        const opResults = await Promise.allSettled(promises);

        opResults.forEach((result, index) => {
          const op = operations[index];
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              task: `Create ${op.type}: ${op.path}`,
              status: 'failed',
              error: result.reason?.message || 'Unknown error',
            });
          }
        });
      } else {
        // Sequential execution
        for (const op of operations) {
          const result = await this.executeOperation(op, options);
          results.push(result);

          if (options.reportProgress) {
            this.reportProgress(operations.indexOf(op) + 1, operations.length);
          }
        }
      }

      // 4. Review Phase
      await this.setMode('reviewing');
      this.reportCompletion(results);

      return results;
    } finally {
      this.isProcessing = false;
      await this.setMode('thinking');
    }
  }

  /**
   * Execute a single file operation
   */
  private async executeOperation(
    operation: FileOperation,
    options: AgentModeOptions,
  ): Promise<TaskResult> {
    const taskName = `Create ${operation.type}: ${operation.path}`;

    try {
      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would create ${operation.type}: ${operation.path}`));
        return {
          task: taskName,
          status: 'success',
          message: 'Dry run - no files created',
        };
      }

      if (operation.type === 'directory') {
        await this.createDirectory(operation.path);
      } else {
        await this.createFile(operation.path, operation.content || '');
      }

      this.createdItems.push(operation.path);

      return {
        task: taskName,
        status: 'success',
        createdFiles: [operation.path],
      };
    } catch (error: unknown) {
      logger.error(`Failed to create ${operation.type}: ${operation.path}`, error);
      return {
        task: taskName,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a directory with parent directories
   */
  private async createDirectory(dirPath: string): Promise<void> {
    const fullPath = path.resolve(dirPath);
    await fs.mkdir(fullPath, { recursive: true });
    console.log(chalk.green(`✓ Created directory: ${dirPath}`));
  }

  /**
   * Create a file with content
   */
  private async createFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.resolve(filePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');
    console.log(chalk.green(`✓ Created file: ${filePath}`));
  }

  /**
   * Set internal mode and display it
   */
  private async setMode(modeName: string): Promise<void> {
    const mode = this.internalModes[modeName] || this.internalModes.thinking;
    this.currentMode = mode;
    this.displayMode();

    // Small delay for visual effect
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Display current internal mode
   */
  private displayMode(): void {
    const width = 60;
    const modeText = `${this.currentMode.symbol} ${this.currentMode.mode}...`;
    const padding = Math.max(0, width - modeText.length - 4);

    console.log('');
    console.log(chalk.cyan(`┌${  '─'.repeat(width - 2)  }┐`));
    console.log(
      `${chalk.cyan('│')  } ${  chalk.yellow(modeText)  }${' '.repeat(padding)  } ${  chalk.cyan('│')}`,
    );
    console.log(chalk.cyan(`└${  '─'.repeat(width - 2)  }┘`));
  }

  /**
   * Report the planned operations
   */
  private reportPlan(description: string, operations: FileOperation[]): void {
    const width = 80;
    console.log('');
    console.log(chalk.blue('═'.repeat(width)));
    console.log(chalk.blue.bold('📋 Agent Mode - Execution Plan'));
    console.log(chalk.blue('═'.repeat(width)));
    console.log('');
    console.log(chalk.yellow('Task:'), description);
    console.log('');
    console.log(chalk.cyan('Planned Operations:'));
    console.log(chalk.gray('─'.repeat(width)));

    // Group operations by type
    const directories = operations.filter((op) => op.type === 'directory');
    const files = operations.filter((op) => op.type === 'file');

    if (directories.length > 0) {
      console.log(chalk.magenta('\n📁 Directories to create:'));
      directories.forEach((dir) => {
        console.log(`  • ${dir.path}`);
      });
    }

    if (files.length > 0) {
      console.log(chalk.green('\n📄 Files to create:'));
      files.forEach((file) => {
        console.log(`  • ${file.path}`);
        if (file.description) {
          console.log(chalk.gray(`    └─ ${file.description}`));
        }
      });
    }

    console.log('');
    console.log(chalk.gray('─'.repeat(width)));
    console.log(chalk.yellow(`Total: ${operations.length} operations`));
    console.log('');
  }

  /**
   * Report progress during execution
   */
  private reportProgress(current: number, total: number): void {
    const percentage = Math.round((current / total) * 100);
    const width = 50;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    const progressBar = '█'.repeat(filled) + '░'.repeat(empty);

    process.stdout.write(`\r[${progressBar}] ${percentage}% (${current}/${total})`);

    if (current === total) {
      console.log(''); // New line when complete
    }
  }

  /**
   * Report completion with summary
   */
  private reportCompletion(results: TaskResult[]): void {
    const width = 80;
    const successful = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    console.log('');
    console.log(chalk.blue('═'.repeat(width)));
    console.log(chalk.blue.bold('📊 Execution Summary'));
    console.log(chalk.blue('═'.repeat(width)));
    console.log('');

    // Statistics
    console.log(chalk.green(`✅ Successful: ${successful}`));
    if (failed > 0) {
      console.log(chalk.red(`❌ Failed: ${failed}`));
    }
    if (skipped > 0) {
      console.log(chalk.yellow(`⏭️  Skipped: ${skipped}`));
    }

    // Created items list
    if (this.createdItems.length > 0) {
      console.log('');
      console.log(chalk.cyan('Created items:'));
      console.log(chalk.gray('─'.repeat(width)));
      this.createdItems.forEach((item) => {
        console.log(`  ✓ ${item}`);
      });
    }

    // Failed operations
    const failedOps = results.filter((r) => r.status === 'failed');
    if (failedOps.length > 0) {
      console.log('');
      console.log(chalk.red('Failed operations:'));
      console.log(chalk.gray('─'.repeat(width)));
      failedOps.forEach((op) => {
        console.log(`  ✗ ${op.task}`);
        if (op.error) {
          console.log(chalk.gray(`    └─ ${op.error}`));
        }
      });
    }

    console.log('');
    console.log(chalk.blue('═'.repeat(width)));
  }

  /**
   * Request user approval for operations
   */
  private async requestApproval(operations: FileOperation[]): Promise<boolean> {
    console.log('');
    console.log(chalk.yellow('⚠️  Approval Required'));
    console.log(chalk.gray('The following operations will be performed:'));
    console.log('');

    operations.forEach((op, index) => {
      console.log(`${_index + 1}. Create ${op.type}: ${op.path}`);
    });

    console.log('');
    console.log(chalk.cyan('Press Shift+Tab to approve, Ctrl+N to reject'));
    console.log(chalk.gray('(For now, returning auto-approval)'));

    // TODO: Implement actual keyboard shortcut handling
    return true;
  }

  /**
   * Get current processing status
   */
  public isAgentProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current internal mode
   */
  public getCurrentMode(): InternalMode {
    return this.currentMode;
  }
}
