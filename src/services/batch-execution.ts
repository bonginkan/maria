/**
 * Batch Execution Engine
 * Execute multiple commands with advanced control flow
 */

import { SlashCommandHandler } from './slash-command-handler';
import { ConversationContext } from '../types/conversation';
import chalk from 'chalk';

export interface BatchCommand {
  command: string;
  args: string[];
  condition?: string;
  onSuccess?: string[];
  onFailure?: string[];
  retries?: number;
  timeout?: number;
  parallel?: boolean;
}

export interface BatchExecutionOptions {
  stopOnError?: boolean;
  parallel?: boolean;
  maxParallel?: number;
  timeout?: number;
  variables?: Record<string, any>;
  dryRun?: boolean;
}

export interface BatchExecutionResult {
  success: boolean;
  totalCommands: number;
  executed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  duration: number;
  results: Array<{
    command: string;
    success: boolean;
    output?: string;
    error?: string;
    duration: number;
  }>;
  variables: Record<string, any>;
}

export class BatchExecutionEngine {
  private static instance: BatchExecutionEngine;
  private commandHandler: SlashCommandHandler | null = null;
  private variables: Record<string, any> = {};
  private isExecuting = false;

  private constructor() {
    // Initialize commandHandler lazily to avoid circular dependency
  }

  private getCommandHandler(): SlashCommandHandler {
    if (!this.commandHandler) {
      this.commandHandler = SlashCommandHandler.getInstance();
    }
    return this.commandHandler;
  }

  public static getInstance(): BatchExecutionEngine {
    if (!BatchExecutionEngine.instance) {
      BatchExecutionEngine.instance = new BatchExecutionEngine();
    }
    return BatchExecutionEngine.instance;
  }

  /**
   * Parse batch command string
   */
  parseBatchString(batchString: string): BatchCommand[] {
    const lines = batchString
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('#'));
    const commands: BatchCommand[] = [];

    lines.forEach((line) => {
      // Parse special directives
      const ifMatch = line.match(/^IF\s+(.+)\s+THEN\s+(.+)(?:\s+ELSE\s+(.+))?$/i);
      if (ifMatch) {
        const [, condition, thenCmd, elseCmd] = ifMatch;
        if (condition && thenCmd) {
          commands.push({
            command: thenCmd.split(' ')[0] || '',
            args: thenCmd.split(' ').slice(1),
            condition,
          });
          if (elseCmd) {
            commands.push({
              command: elseCmd.split(' ')[0] || '',
              args: elseCmd.split(' ').slice(1),
              condition: `!${condition}`,
            });
          }
        }
        return;
      }

      // Parse parallel execution
      if (line.startsWith('PARALLEL:')) {
        const parallelCommands = line
          .substring(9)
          .split('&&')
          .map((cmd) => cmd.trim());
        parallelCommands.forEach((cmd) => {
          const parts = cmd.split(' ');
          if (parts[0]) {
            commands.push({
              command: parts[0],
              args: parts.slice(1),
              parallel: true,
            });
          }
        });
        return;
      }

      // Parse regular command
      const parts = line.split(' ');
      if (parts[0]) {
        commands.push({
          command: parts[0],
          args: parts.slice(1),
        });
      }
    });

    return commands;
  }

  /**
   * Execute a batch of commands
   */
  async executeBatch(
    commands: BatchCommand[],
    context: ConversationContext,
    options: BatchExecutionOptions = {},
  ): Promise<BatchExecutionResult> {
    if (this.isExecuting) {
      throw new Error('Batch execution already in progress');
    }

    this.isExecuting = true;
    const startTime = Date.now();

    // Initialize variables
    this.variables = { ...options.variables };

    const result: BatchExecutionResult = {
      success: true,
      totalCommands: commands.length,
      executed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      results: [],
      variables: this.variables,
    };

    console.log(chalk.blue('\n🚀 Starting batch execution\n'));

    if (options.dryRun) {
      console.log(chalk.yellow('DRY RUN MODE - Commands will not be executed\n'));
      commands.forEach((cmd, i) => {
        console.log(chalk.gray(`${i + 1}. ${cmd.command} ${cmd.args.join(' ')}`));
        if (cmd.condition) console.log(chalk.gray(`   IF: ${cmd.condition}`));
      });

      this.isExecuting = false;
      return result;
    }

    try {
      // Group parallel commands
      const commandGroups = this.groupCommands(commands);

      for (const group of commandGroups) {
        if (options.stopOnError && result.failed > 0) {
          console.log(chalk.yellow('\n⏹️  Stopping due to error (stopOnError=true)'));
          break;
        }

        if (group.length === 1 && group[0]) {
          // Execute single command
          await this.executeSingleCommand(group[0], context, result);
        } else {
          // Execute parallel commands
          await this.executeParallelCommands(group, context, result, options.maxParallel || 3);
        }
      }

      result.duration = Date.now() - startTime;
      result.success = result.failed === 0;

      this.printSummary(result);
    } finally {
      this.isExecuting = false;
    }

    return result;
  }

  /**
   * Execute a single command
   */
  private async executeSingleCommand(
    cmd: BatchCommand,
    context: ConversationContext,
    result: BatchExecutionResult,
  ): Promise<void> {
    // Check condition
    if (cmd.condition && !this.evaluateCondition(cmd.condition)) {
      result.skipped++;
      console.log(chalk.gray(`⏭️  Skipping ${cmd.command} (condition not met)`));
      return;
    }

    console.log(chalk.cyan(`\n▶️  Executing: ${cmd.command} ${cmd.args.join(' ')}`));

    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = cmd.retries ? cmd.retries + 1 : 1;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const cmdResult = await this.executeWithTimeout(
          () => this.getCommandHandler().handleCommand(cmd.command, cmd.args, context),
          cmd.timeout || 30000,
        );

        const duration = Date.now() - startTime;
        result.executed++;

        if (cmdResult.success) {
          result.succeeded++;
          console.log(chalk.green(`✅ Success (${duration}ms)`));

          result.results.push({
            command: `${cmd.command} ${cmd.args.join(' ')}`,
            success: true,
            output: cmdResult.message,
            duration,
          });

          // Set variable if command sets one
          if (cmdResult.data?.variable) {
            this.variables[cmdResult.data.variable] = cmdResult.data.value;
          }

          break;
        } else {
          if (attempts < maxAttempts) {
            console.log(chalk.yellow(`⚠️  Failed, retrying (${attempts}/${maxAttempts})...`));
            await this.delay(1000);
          } else {
            result.failed++;
            console.log(chalk.red(`❌ Failed: ${cmdResult.message}`));

            result.results.push({
              command: `${cmd.command} ${cmd.args.join(' ')}`,
              success: false,
              error: cmdResult.message,
              duration,
            });
          }
        }
      } catch (error) {
        const duration = Date.now() - startTime;

        if (attempts < maxAttempts) {
          console.log(chalk.yellow(`⚠️  Error, retrying (${attempts}/${maxAttempts})...`));
          await this.delay(1000);
        } else {
          result.failed++;
          result.executed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.log(chalk.red(`❌ Error: ${errorMsg}`));

          result.results.push({
            command: `${cmd.command} ${cmd.args.join(' ')}`,
            success: false,
            error: errorMsg,
            duration,
          });
        }
      }
    }
  }

  /**
   * Execute commands in parallel
   */
  private async executeParallelCommands(
    commands: BatchCommand[],
    context: ConversationContext,
    result: BatchExecutionResult,
    maxParallel: number,
  ): Promise<void> {
    console.log(chalk.cyan(`\n⚡ Executing ${commands.length} commands in parallel`));

    const promises = commands.map((cmd) =>
      this.executeSingleCommand(cmd, context, {
        ...result,
        executed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        results: [],
      }),
    );

    // Execute in batches
    for (let i = 0; i < promises.length; i += maxParallel) {
      const batch = promises.slice(i, i + maxParallel);
      const batchResults = await Promise.allSettled(batch);

      // Update main result
      batchResults.forEach((batchResult) => {
        if (batchResult.status === 'rejected') {
          result.failed++;
          result.executed++;
        }
      });
    }
  }

  /**
   * Group commands for execution
   */
  private groupCommands(commands: BatchCommand[]): BatchCommand[][] {
    const groups: BatchCommand[][] = [];
    let currentGroup: BatchCommand[] = [];

    commands.forEach((cmd) => {
      if (cmd.parallel && currentGroup.length > 0) {
        currentGroup.push(cmd);
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [cmd];
      }
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(condition: string): boolean {
    // Simple condition evaluation
    // In a real implementation, this would be more sophisticated

    if (condition.startsWith('!')) {
      return !this.evaluateCondition(condition.substring(1));
    }

    // Check variable existence
    if (condition.startsWith('$')) {
      const varName = condition.substring(1);
      return this.variables[varName] !== undefined;
    }

    // Check variable equality
    const eqMatch = condition.match(/^\$(\w+)\s*==\s*(.+)$/);
    if (eqMatch && eqMatch[1] && eqMatch[2] !== undefined) {
      const varName = eqMatch[1];
      const value = eqMatch[2];
      return String(this.variables[varName] || '') === value;
    }

    // Default conditions
    switch (condition) {
      case 'hasErrors':
        return this.variables.hasErrors === true;
      case 'testsPass':
        return this.variables.testsPass === true;
      default:
        return true;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Command timeout')), timeout),
      ),
    ]);
  }

  /**
   * Print execution summary
   */
  private printSummary(result: BatchExecutionResult): void {
    console.log(chalk.blue('\n📊 Batch Execution Summary\n'));

    const successRate =
      result.executed > 0 ? Math.round((result.succeeded / result.executed) * 100) : 0;

    console.log(`Total Commands: ${result.totalCommands}`);
    console.log(`Executed: ${result.executed}`);
    console.log(chalk.green(`Succeeded: ${result.succeeded}`));
    if (result.failed > 0) {
      console.log(chalk.red(`Failed: ${result.failed}`));
    }
    if (result.skipped > 0) {
      console.log(chalk.gray(`Skipped: ${result.skipped}`));
    }
    console.log(`Success Rate: ${successRate}%`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);

    if (Object.keys(result.variables).length > 0) {
      console.log('\nVariables Set:');
      Object.entries(result.variables).forEach(([key, value]) => {
        console.log(`  ${key} = ${JSON.stringify(value)}`);
      });
    }
  }

  /**
   * Helper to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if batch is executing
   */
  getExecutionStatus(): boolean {
    return this.isExecuting;
  }

  /**
   * Get current variables
   */
  getVariables(): Record<string, any> {
    return { ...this.variables };
  }
}
