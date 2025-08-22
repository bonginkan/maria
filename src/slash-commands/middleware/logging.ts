/**
 * Logging Middleware
 * Handles command execution logging
 */

import { CommandArgs, CommandContext, CommandResult, IMiddleware, ISlashCommand } from '../types';
import { logger } from '../../utils/logger';

export class LoggingMiddleware implements IMiddleware {
  name = 'logging';
  priority = 0; // Run first

  async execute(
    command: ISlashCommand,
    args: CommandArgs,
    context: CommandContext,
    next: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // Log command start
    logger.info('Command execution started', {
      requestId,
      command: command.name,
      args: args.raw,
      user: context.user?.id || 'anonymous',
      session: context.session.id,
    });

    try {
      // Execute command
      const result = await next();

      // Log success
      const duration = Date.now() - startTime;
      logger.info('Command execution completed', {
        requestId,
        command: command.name,
        success: result.success,
        duration,
        user: context.user?.id || 'anonymous',
      });

      // Add metrics to result
      if (!result.metadata) {
        result.metadata = {
          executionTime: duration,
        };
      }
      (result.metadata as Record<string, unknown>)['requestId'] = requestId;
      (result.metadata as Record<string, unknown>)['duration'] = duration;

      return result;
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime;
      logger.error('Command execution failed', {
        requestId,
        command: command.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration,
        user: context.user?.id || 'anonymous',
      });

      // Re-throw the error
      throw error;
    }
  }

  private generateRequestId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const loggingMiddleware = new LoggingMiddleware();
