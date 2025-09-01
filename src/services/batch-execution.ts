/**
 * Batch Execution Engine
 * Execute multiple commands with advanced control flow
 */

import type { ICommandHandler } from "../types/command-handler-interfaces";
import { ConversationContext } from "../types/conversation";
import chalk from "chalk";

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
  variables?: Record<string, unknown>;
  dryRun?: boolean;
}

export interface BatchExecutionResult {
  success: boolean;
  totalCommands: number;
  executed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  _duration: number;
  results: Array<{
    command: string;
    success: boolean;
    output?: string;
    _error?: string;
    _duration: number;
  }>;
  variables: Record<string, unknown>;
}

export class BatchExecutionEngine {
  private static instance: BatchExecutionEngine;
  private commandHandler: ICommandHandler | null = null;
  private variables: Record<string, unknown> = {};
  private isExecuting = false;

  private constructor() {
    // No direct dependencies - use injection
  }

  /**
   * Set command handler via dependency injection
   */
  setCommandHandler(handler: ICommandHandler): void {
    this.commandHandler = handler;
  }

  private getCommandHandler(): ICommandHandler {
    if (!this.commandHandler) {
      throw new Error(
        "CommandHandler not injected. Call setCommandHandler() first.",
      );
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
   * Parse _batch command string
   */
  parseBatchString(batchString: string): BatchCommand[] {
    const _lines = batchString
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("#"));
    const commands: BatchCommand[] = [];

    lines.forEach((line) => {
      // Parse special directives
      const _ifMatch = line.match(
        /^IF\s+(.+)\s+THEN\s+(.+)(?:\s+ELSE\s+(.+))?$/i,
      );
      if (_ifMatch) {
        const [, condition, thenCmd, elseCmd] = _ifMatch;
        if (condition && thenCmd) {
          commands.push({
            command: thenCmd.split(" ")[0] || "",
            args: thenCmd.split(" ").slice(1),
            condition,
          });
          if (elseCmd) {
            commands.push({
              command: elseCmd.split(" ")[0] || "",
              args: elseCmd.split(" ").slice(1),
              condition: `!${condition}`,
            });
          }
        }
        return;
      }

      // Parse parallel execution
      if (line.startsWith("PARALLEL:")) {
        const _parallelCommands = line
          .substring(9)
          .split("&&")
          .map((cmd) => cmd.trim());
        parallelCommands.forEach((cmd) => {
          const _parts = cmd.split(" ");
          if (_parts[0]) {
            commands.push({
              command: _parts[0],
              args: _parts.slice(1),
              parallel: true,
            });
          }
        });
        return;
      }

      // Parse regular command
      const _parts = line.split(" ");
      if (_parts[0]) {
        commands.push({
          command: _parts[0],
          args: _parts.slice(1),
        });
      }
    });

    return commands;
  }

  /**
   * Execute a _batch of commands
   */
  async executeBatch(
    commands: BatchCommand[],
    context: ConversationContext,
    options: BatchExecutionOptions = {},
  ): Promise<BatchExecutionResult> {
    if (this.isExecuting) {
      throw new Error("Batch execution already in progress");
    }

    this.isExecuting = true;
    const _startTime = Date.now();

    // Initialize variables
    this.variables = { ...options.variables };

    const result: BatchExecutionResult = {
      success: true,
      totalCommands: commands.length,
      executed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      _duration: 0,
      results: [],
      variables: this.variables,
    };

    console.log(chalk.blue("\n🚀 Starting _batch execution\n"));

    if (options.dryRun) {
      console.log(
        chalk.yellow("DRY RUN MODE - Commands will not be executed\n"),
      );
      commands.forEach((cmd, _i) => {
        console.log(
          chalk.gray(`${_i + 1}. ${cmd.command} ${cmd.args.join(" ")}`),
        );
        if (cmd.condition) {
          console.log(chalk.gray(`   IF: ${cmd.condition}`));
        }
      });

      this.isExecuting = false;
      return result;
    }

    try {
      // Group parallel commands
      const _commandGroups = this.groupCommands(commands);

      for (const group of _commandGroups) {
        if (options.stopOnError && result.failed > 0) {
          console.log(
            chalk.yellow("\n⏹️  Stopping due to _error (stopOnError=true)"),
          );
          break;
        }

        if (group.length === 1 && group[0]) {
          // Execute single command
          await this.executeSingleCommand(group[0], context, result);
        } else {
          // Execute parallel commands
          await this.executeParallelCommands(
            group,
            context,
            result,
            options.maxParallel || 3,
          );
        }
      }

      result.duration = Date.now() - _startTime;
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
      console.log(
        chalk.gray(`⏭️  Skipping ${cmd.command} (condition not met)`),
      );
      return;
    }

    console.log(
      chalk.cyan(`\n▶️  Executing: ${cmd.command} ${cmd.args.join(" ")}`),
    );

    const _startTime = Date.now();
    let attempts = 0;
    const _maxAttempts = cmd.retries ? cmd.retries + 1 : 1;

    while (attempts < _maxAttempts) {
      attempts++;

      try {
        const _cmdResult = await this.executeWithTimeout(
          () =>
            this.getCommandHandler().handleCommand(
              cmd.command,
              cmd.args,
              context,
            ),
          cmd.timeout || 30000,
        );

        const _duration = Date.now() - _startTime;
        result.executed++;

        if (_cmdResult.success) {
          result.succeeded++;
          console.log(chalk.green(`✅ Success (${_duration}ms)`));

          result.results.push({
            command: `${cmd.command} ${cmd.args.join(" ")}`,
            success: true,
            output: _cmdResult.message,
            _duration,
          });

          // Set variable if command sets one
          if (
            cmdResult.data &&
            typeof _cmdResult.data === "object" &&
            "variable" in _cmdResult.data &&
            "_value" in _cmdResult.data
          ) {
            const _resultData = _cmdResult.data as {
              variable: string;
              _value: unknown;
            };
            this.variables[_resultData.variable] = _resultData.value;
          }

          break;
        } else {
          if (attempts < _maxAttempts) {
            console.log(
              chalk.yellow(
                `⚠️  Failed, retrying (${attempts}/${_maxAttempts})...`,
              ),
            );
            await this.delay(1000);
          } else {
            result.failed++;
            console.log(chalk.red(`❌ Failed: ${_cmdResult.message}`));

            result.results.push({
              command: `${cmd.command} ${cmd.args.join(" ")}`,
              success: false,
              _error: _cmdResult.message,
              _duration,
            });
          }
        }
      } catch (_error: unknown) {
        const _duration = Date.now() - _startTime;

        if (attempts < _maxAttempts) {
          console.log(
            chalk.yellow(
              `⚠️  Error, retrying (${attempts}/${_maxAttempts})...`,
            ),
          );
          await this.delay(1000);
        } else {
          result.failed++;
          result.executed++;
          const _errorMsg =
            _error instanceof Error ? _error.message : "Unknown _error";
          console.log(chalk.red(`❌ Error: ${_errorMsg}`));

          result.results.push({
            command: `${cmd.command} ${cmd.args.join(" ")}`,
            success: false,
            _error: _errorMsg,
            _duration,
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
    console.log(
      chalk.cyan(`\n⚡ Executing ${commands.length} commands in parallel`),
    );

    const _promises = commands.map((cmd) =>
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
    for (let i = 0; i < _promises.length; i += maxParallel) {
      const _batch = _promises.slice(i, i + maxParallel);
      const _batchResults = await Promise.allSettled(_batch);

      // Update main result
      batchResults.forEach((batchResult) => {
        if (batchResult.status === "rejected") {
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

    if (condition.startsWith("!")) {
      return !this.evaluateCondition(condition.substring(1));
    }

    // Check variable existence
    if (condition.startsWith("$")) {
      const _varName = condition.substring(1);
      return this.variables[_varName] !== undefined;
    }

    // Check variable equality
    const _eqMatch = condition.match(/^\$(\w+)\s*==\s*(.+)$/);
    if (_eqMatch && _eqMatch[1] && _eqMatch[2] !== undefined) {
      const _varName = _eqMatch[1];
      const _value = _eqMatch[2];
      return String(this.variables[_varName] || "") === _value;
    }

    // Default conditions
    switch (condition) {
      case "hasErrors":
        return this.variables["hasErrors"] === true;
      case "testsPass":
        return this.variables["testsPass"] === true;
      default:
        return true;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Command timeout")), timeout),
      ),
    ]);
  }

  /**
   * Print execution summary
   */
  private printSummary(result: BatchExecutionResult): void {
    console.log(chalk.blue("\n📊 Batch Execution Summary\n"));

    const _successRate =
      result.executed > 0
        ? Math.round((result.succeeded / result.executed) * 100)
        : 0;

    console.log(`Total Commands: ${result.totalCommands}`);
    console.log(`Executed: ${result.executed}`);
    console.log(chalk.green(`Succeeded: ${result.succeeded}`));
    if (result.failed > 0) {
      console.log(chalk.red(`Failed: ${result.failed}`));
    }
    if (result.skipped > 0) {
      console.log(chalk.gray(`Skipped: ${result.skipped}`));
    }
    console.log(`Success Rate: ${_successRate}%`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);

    if (Object.keys(result.variables).length > 0) {
      console.log("\nVariables Set:");
      Object.entries(result.variables).forEach(([key, _value]) => {
        console.log(`  ${key} = ${JSON.stringify(_value)}`);
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
   * Check if _batch is executing
   */
  getExecutionStatus(): boolean {
    return this.isExecuting;
  }

  /**
   * Get current variables
   */
  getVariables(): Record<string, unknown> {
    return { ...this.variables };
  }
}
