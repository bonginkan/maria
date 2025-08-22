/**
 * Validation Middleware
 * Handles input validation for commands
 */

import { IMiddleware, CommandArgs, CommandContext, CommandResult, ISlashCommand } from '../types';
import { logger } from '../../utils/logger';

export class ValidationMiddleware implements IMiddleware {
  name = 'validation';
  priority = 20; // Run after auth

  async execute(
    command: ISlashCommand,
    args: CommandArgs,
    _context: CommandContext,
    next: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    // Perform basic validation
    const validationResult = await this.validateArgs(command, args);

    if (!validationResult.success) {
      return validationResult;
    }

    // Continue to next middleware or command
    return next();
  }

  private async validateArgs(command: ISlashCommand, args: CommandArgs): Promise<CommandResult> {
    // Check for help flag
    if (args.flags['help'] || args.flags['h']) {
      return {
        success: true,
        message: this.formatHelp(command),
        component: 'help-dialog',
      };
    }

    // Check for required positional arguments
    if (command.usage) {
      const requiredArgs = this.parseRequiredArgs(command.usage);
      const positional = (args.parsed['positional'] as string[]) || [];

      if (requiredArgs.length > positional.length) {
        return {
          success: false,
          message: `Missing required arguments\n\nUsage: /${command.name} ${command.usage}`,
          data: {
            missing: requiredArgs.slice(positional.length),
            examples: command.examples,
          },
        };
      }
    }

    // Validate flags and options
    const validationErrors: string[] = [];

    // Check for unknown flags
    const knownFlags = this.extractKnownFlags(command.usage);
    for (const flag of Object.keys(args.flags)) {
      if (!knownFlags.includes(flag) && flag !== 'help' && flag !== 'h') {
        validationErrors.push(`Unknown flag: --${flag}`);
      }
    }

    if (validationErrors.length > 0) {
      logger.warn(`Validation errors for command ${command.name}:`, validationErrors);

      return {
        success: false,
        message: validationErrors.join('\n'),
        data: {
          suggestions: [`Run /${command.name} --help for usage information`],
        },
      };
    }

    return { success: true, message: '' };
  }

  private parseRequiredArgs(usage: string): string[] {
    const required: string[] = [];
    const regex = /<([^>]+)>/g;
    let match;

    while ((match = regex.exec(usage)) !== null) {
      if (match[1]) {
        required.push(match[1]);
      }
    }

    return required;
  }

  private extractKnownFlags(usage: string): string[] {
    const flags: string[] = [];
    const regex = /--([a-z-]+)/g;
    let match;

    while ((match = regex.exec(usage)) !== null) {
      if (match[1]) {
        flags.push(match[1]);
      }
    }

    return flags;
  }

  private formatHelp(command: ISlashCommand): string {
    const lines: string[] = [];

    lines.push(`📘 **${command.name.toUpperCase()}**`);
    lines.push('─'.repeat(40));
    lines.push('');
    lines.push(command.description);
    lines.push('');

    if (command.usage) {
      lines.push('**Usage:**');
      lines.push(`  /${command.name} ${command.usage}`);
      lines.push('');
    }

    if (command.aliases && command.aliases.length > 0) {
      lines.push('**Aliases:**');
      lines.push(`  ${command.aliases.map((a) => `/${a}`).join(', ')}`);
      lines.push('');
    }

    if (command.examples && command.examples.length > 0) {
      lines.push('**Examples:**');
      command.examples.forEach((ex) => {
        lines.push(`  ${ex.input}`);
        lines.push(`    ${ex.description}`);
        if (ex.output) {
          lines.push(`    → ${ex.output}`);
        }
      });
      lines.push('');
    }

    if (command.metadata.experimental) {
      lines.push('⚠️  **Experimental Feature**');
    }

    if (command.metadata.deprecated) {
      lines.push(
        `⚠️  **Deprecated** - Use ${command.metadata.replacedBy || 'alternative'} instead`,
      );
    }

    return lines.join('\n');
  }
}

export const validationMiddleware = new ValidationMiddleware();
