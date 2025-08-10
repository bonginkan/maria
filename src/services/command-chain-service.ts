/**
 * Command Chain Service
 * Enables sequential execution of related commands
 */

import { SlashCommandHandler, SlashCommandResult } from './slash-command-handler';
import { ConversationContext } from '../types/conversation';
// import.*from.*../lib/command-groups';
// import { logger } from '../utils/logger';
import chalk from 'chalk';

export interface ChainExecutionOptions {
  /** Whether to stop on first error */
  stopOnError?: boolean;
  /** Whether to prompt user before each command */
  interactive?: boolean;
  /** Custom parameters for specific commands */
  commandParams?: Record<string, string[]>;
}

export interface ChainExecutionResult {
  success: boolean;
  executedCommands: string[];
  results: SlashCommandResult[];
  errors: Array<{ command: string; error: string }>;
  summary: string;
}

export class CommandChainService {
  private static instance: CommandChainService;
  private commandHandler: SlashCommandHandler;
  private isExecutingChain = false;

  private constructor() {
    this.commandHandler = SlashCommandHandler.getInstance();
  }

  public static getInstance(): CommandChainService {
    if (!CommandChainService.instance) {
      CommandChainService.instance = new CommandChainService();
    }
    return CommandChainService.instance;
  }

  /**
   * Execute a predefined command chain
   */
  async executeChain(
    chainName: keyof typeof commandChains,
    context: ConversationContext,
    options: ChainExecutionOptions = {}
  ): Promise<ChainExecutionResult> {
    const chain = commandChains[chainName];
    if (!chain) {
      return {
        success: false,
        executedCommands: [],
        results: [],
        errors: [{ command: chainName, error: 'Chain not found' }],
        summary: `Command chain "${chainName}" not found`
      };
    }

    return this.executeCommandSequence(
      chain.commands,
      context,
      { ...options, chainName: chain.name, chainDescription: chain.description }
    );
  }

  /**
   * Execute a custom sequence of commands
   */
  async executeCommandSequence(
    commands: string[],
    context: ConversationContext,
    options: ChainExecutionOptions & { chainName?: string; chainDescription?: string } = {}
  ): Promise<ChainExecutionResult> {
    if (this.isExecutingChain) {
      return {
        success: false,
        executedCommands: [],
        results: [],
        errors: [{ command: 'chain', error: 'Another chain is already executing' }],
        summary: 'Cannot execute multiple chains simultaneously'
      };
    }

    this.isExecutingChain = true;
    const executedCommands: string[] = [];
    const results: SlashCommandResult[] = [];
    const errors: Array<{ command: string; error: string }> = [];

    console.log(chalk.blue(`\n🔗 Starting command chain${options.chainName ? `: ${options.chainName}` : ''}`));
    if (options.chainDescription) {
      console.log(chalk.gray(`   ${options.chainDescription}`));
    }
    console.log(chalk.gray(`   Commands: ${commands.join(' → ')}\n`));

    try {
      for (const command of commands) {
        // Check if we should continue
        if (options.stopOnError && errors.length > 0) {
          break;
        }

        // Interactive mode - prompt before execution
        if (options.interactive) {
          const shouldExecute = await this.promptForExecution();
          if (!shouldExecute) {
            console.log(chalk.yellow(`⏭️  Skipping ${command}`));
            continue;
          }
        }

        // Get custom parameters for this command
        const args = options.commandParams?.[command] || [];

        console.log(chalk.cyan(`\n▶️  Executing: ${command} ${args.join(' ')}`));

        try {
          const result = await this.commandHandler.handleCommand(command, args, context);
          executedCommands.push(command);
          results.push(result);

          if (result.success) {
            console.log(chalk.green(`✅ ${command} completed successfully`));
            if (result.message) {
              console.log(chalk.gray(this.truncateMessage(result.message)));
            }
          } else {
            console.log(chalk.red(`❌ ${command} failed`));
            console.log(chalk.red(result.message));
            errors.push({ command, error: result.message });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.log(chalk.red(`❌ ${command} threw an error: ${errorMessage}`));
          errors.push({ command, error: errorMessage });
        }

        // Add a small delay between commands for better visibility
        await this.delay(500);
      }

      const success = errors.length === 0;
      const summary = this.generateSummary(executedCommands, commands, errors, success);

      console.log(chalk.blue(`\n🏁 Chain execution completed`));
      console.log(summary);

      return {
        success,
        executedCommands,
        results,
        errors,
        summary
      };
    } finally {
      this.isExecutingChain = false;
    }
  }

  /**
   * Check if a command chain is currently executing
   */
  isChainExecuting(): boolean {
    return this.isExecutingChain;
  }

  /**
   * Prompt user for execution in interactive mode
   */
  private async promptForExecution(): Promise<boolean> {
    // In a real implementation, this would use Ink or another interactive prompt
    // For now, we'll auto-accept
    return true;
  }

  /**
   * Truncate long messages for display
   */
  private truncateMessage(message: string, maxLength = 100): string {
    const firstLine = message.split('\n')[0] || '';
    if (firstLine.length <= maxLength) {
      return firstLine;
    }
    return firstLine.substring(0, maxLength) + '...';
  }

  /**
   * Generate execution summary
   */
  private generateSummary(
    executed: string[],
    planned: string[],
    errors: Array<{ command: string; error: string }>,
    success: boolean
  ): string {
    let summary = '\n';
    
    if (success) {
      summary += chalk.green(`✨ All commands executed successfully!\n`);
    } else {
      summary += chalk.yellow(`⚠️  Chain completed with errors\n`);
    }

    summary += chalk.gray(`   Executed: ${executed.length}/${planned.length} commands\n`);
    
    if (executed.length < planned.length) {
      const skipped = planned.slice(executed.length);
      summary += chalk.gray(`   Skipped: ${skipped.join(', ')}\n`);
    }

    if (errors.length > 0) {
      summary += chalk.red(`   Errors: ${errors.length}\n`);
      errors.forEach(err => {
        summary += chalk.red(`     - ${err.command}: ${err.error}\n`);
      });
    }

    return summary;
  }

  /**
   * Helper to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get available command chains
   */
  getAvailableChains(): Array<{ name: string; description: string; commands: string[] }> {
    return Object.entries(commandChains).map(([key, chain]) => ({
      name: key,
      description: chain.description,
      commands: chain.commands
    }));
  }
}