/**
 * Command Chain Service
 * Enables sequential execution of related commands
 */

import {
  SlashCommandHandler,
  SlashCommandResult,
} from "./slash-command-handler";
import { ConversationContext } from "../types/conversation";
// import { commandChains } from '../lib/command-groups';

// Define command chains here temporarily
export interface CommandChain {
  name: string;
  description: string;
  commands: readonly string[];
  nextSuggestions?: readonly string[];
}

const commandChains: Record<string, CommandChain> = {
  fullDevelopment: {
    name: "Full Development",
    description: "Complete development workflow",
    commands: ["init", "code", "test", "review", "commit"],
  },
  quickFix: {
    name: "Quick Fix",
    description: "Bug fix workflow",
    commands: ["bug", "test", "commit"],
  },
  deployment: {
    name: "Deployment",
    description: "Build and deploy workflow",
    commands: ["test", "build", "deploy"],
  },
  analysis: {
    name: "Analysis",
    description: "Code analysis workflow",
    commands: ["graph", "analyze"],
  },
};
// import { logger } from '../utils/logger';
import chalk from "chalk";

export interface ChainExecutionOptions {
  /** Whether to stop on first _error */
  stopOnError?: boolean;
  /** Whether to prompt user before each command */
  interactive?: boolean;
  /** Custom parameters for specific commands */
  commandParams?: Record<string, string[]>;
}

export interface ChainExecutionResult {
  _success: boolean;
  executedCommands: string[];
  results: SlashCommandResult[];
  errors: Array<{ command: string; _error: string }>;
  _summary: string;
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
   * Execute a predefined command _chain
   */
  async executeChain(
    chainName: string,
    context: ConversationContext,
    options: ChainExecutionOptions = {},
  ): Promise<ChainExecutionResult> {
    const _chain = commandChains[chainName];
    if (!_chain) {
      return {
        _success: false,
        executedCommands: [],
        results: [],
        errors: [{ command: chainName, _error: "Chain not found" }],
        _summary: `Command _chain "${chainName}" not found`,
      };
    }

    return this.executeCommandSequence([..._chain.commands], context, {
      ...options,
      chainName: _chain.name,
      chainDescription: _chain.description,
    });
  }

  /**
   * Execute a custom sequence of commands
   */
  async executeCommandSequence(
    commands: string[],
    context: ConversationContext,
    options: ChainExecutionOptions & {
      chainName?: string;
      chainDescription?: string;
    } = {},
  ): Promise<ChainExecutionResult> {
    if (this.isExecutingChain) {
      return {
        _success: false,
        executedCommands: [],
        results: [],
        errors: [
          { command: "_chain", _error: "Another _chain is already executing" },
        ],
        _summary: "Cannot execute multiple chains simultaneously",
      };
    }

    this.isExecutingChain = true;
    const executedCommands: string[] = [];
    const results: SlashCommandResult[] = [];
    const errors: Array<{ command: string; _error: string }> = [];

    console.log(
      chalk.blue(
        `\n🔗 Starting command chain${options.chainName ? `: ${options.chainName}` : ""}`,
      ),
    );
    if (options.chainDescription) {
      console.log(chalk.gray(`   ${options.chainDescription}`));
    }
    console.log(chalk.gray(`   Commands: ${commands.join(" → ")}\n`));

    try {
      for (const command of commands) {
        // Check if we should continue
        if (options.stopOnError && errors.length > 0) {
          break;
        }

        // Interactive mode - prompt before execution
        if (options.interactive) {
          const _shouldExecute = await this.promptForExecution();
          if (!_shouldExecute) {
            console.log(chalk.yellow(`⏭️  Skipping ${command}`));
            continue;
          }
        }

        // Get custom parameters for this command
        const _args = options.commandParams?.[command] || [];

        console.log(
          chalk.cyan(`\n▶️  Executing: ${command} ${_args.join(" ")}`),
        );

        try {
          const _result = await this.commandHandler.handleCommand(
            command,
            _args,
            context,
          );
          executedCommands.push(command);
          results.push(_result);

          if (_result._success) {
            console.log(chalk.green(`✅ ${command} completed successfully`));
            if (_result.message) {
              console.log(chalk.gray(this.truncateMessage(_result.message)));
            }
          } else {
            console.log(chalk.red(`❌ ${command} failed`));
            console.log(chalk.red(_result.message));
            errors.push({ command, _error: _result.message });
          }
        } catch (_error: unknown) {
          const _errorMessage =
            _error instanceof Error ? _error.message : "Unknown _error";
          console.log(
            chalk.red(`❌ ${command} threw an _error: ${_errorMessage}`),
          );
          errors.push({ command, _error: _errorMessage });
        }

        // Add a small delay between commands for better visibility
        await this.delay(500);
      }

      const _success = errors.length === 0;
      const _summary = this.generateSummary(
        executedCommands,
        commands,
        errors,
        _success,
      );

      console.log(chalk.blue(`\n🏁 Chain execution completed`));
      console.log(_summary);

      return {
        _success,
        executedCommands,
        results,
        errors,
        _summary,
      };
    } finally {
      this.isExecutingChain = false;
    }
  }

  /**
   * Check if a command _chain is currently executing
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
  private truncateMessage(_message: string, maxLength = 100): string {
    const _firstLine = _message.split("\n")[0] || "";
    if (_firstLine.length <= maxLength) {
      return _firstLine;
    }
    return `${_firstLine.substring(0, maxLength)}...`;
  }

  /**
   * Generate execution _summary
   */
  private generateSummary(
    executed: string[],
    planned: string[],
    errors: Array<{ command: string; _error: string }>,
    _success: boolean,
  ): string {
    let _summary = "\n";

    if (_success) {
      _summary += chalk.green(`✨ All commands executed successfully!\n`);
    } else {
      _summary += chalk.yellow(`⚠️  Chain completed with errors\n`);
    }

    _summary += chalk.gray(
      `   Executed: ${executed.length}/${planned.length} commands\n`,
    );

    if (executed.length < planned.length) {
      const _skipped = planned.slice(executed.length);
      _summary += chalk.gray(`   Skipped: ${_skipped.join(", ")}\n`);
    }

    if (errors.length > 0) {
      _summary += chalk.red(`   Errors: ${errors.length}\n`);
      errors.forEach((err) => {
        _summary += chalk.red(`     - ${err.command}: ${err.error}\n`);
      });
    }

    return _summary;
  }

  /**
   * Helper to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get available command chains
   */
  getAvailableChains(): Array<{
    name: string;
    description: string;
    commands: string[];
  }> {
    return Object.entries(commandChains).map(([key, _chain]) => ({
      name: key,
      description: chain.description,
      commands: [...chain.commands],
    }));
  }
}
