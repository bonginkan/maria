/**
 * Logging Middleware
 * Handles command execution logging
 */

import {
  CommandArgs,
  CommandContext,
  CommandResult,
  IMiddleware,
  ISlashCommand,
} from "../types";
import { logger } from "../../utils/logger";

export class LoggingMiddleware implements IMiddleware {
  name = "logging";
  priority = 0; // Run first

  async execute(
    command: ISlashCommand,
    args: CommandArgs,
    context: CommandContext,
    next: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const _startTime = Date.now();
    const _requestId = this.generateRequestId();

    // Log command start
    logger.info("Command execution started", {
      _requestId,
      command: command.name,
      args: args.raw,
      user: context.user?.id || "anonymous",
      session: context.session.id,
    });

    try {
      // Execute command
      const _result = await next();

      // Log success
      const _duration = Date.now() - _startTime;
      logger.info("Command execution completed", {
        _requestId,
        command: command.name,
        success: _result.success,
        _duration,
        user: context.user?.id || "anonymous",
      });

      // Add metrics to _result
      if (!_result.metadata) {
        result.metadata = {
          executionTime: _duration,
        };
      }
      (_result.metadata as Record<string, unknown>)["_requestId"] = _requestId;
      (_result.metadata as Record<string, unknown>)["_duration"] = _duration;

      return _result;
    } catch (error) {
      // Log error
      const _duration = Date.now() - _startTime;
      logger.error("Command execution failed", {
        _requestId,
        command: command.name,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        _duration,
        user: context.user?.id || "anonymous",
      });

      // Re-throw the error
      throw error;
    }
  }

  private generateRequestId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const _loggingMiddleware = new LoggingMiddleware();
