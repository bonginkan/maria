/**
 * LoggingMiddleware - Minimal logging for command execution
 * NOTE: In production, inject a proper logger via DI
 */
import type { Middleware, CommandContext } from "../router/CommandRouter";
import type { NormalizedResult } from "../adapters/ResultAdapter";

export interface Logger {
  info(message: string, data?: any): void;
  error(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  debug(message: string, data?: any): void;
}

export class LoggingMiddleware implements Middleware {
  private isDevelopment = process.env.NODE_ENV !== "production";
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || {
      info: (msg: string, data?: any) => console.log(msg, data),
      error: (msg: string, data?: any) => console.error(msg, data),
      warn: (msg: string, data?: any) => console.warn(msg, data),
      debug: (msg: string, data?: any) => console.debug(msg, data),
    };
  }

  async before(
    command: string,
    args: string[],
    context: CommandContext,
  ): Promise<CommandContext> {
    this.logger.info(`Executing command: ${command}`, {
      command,
      args,
      sessionId: (context as any)?.sessionId,
    });
    return context; // No modifications
  }

  async after(
    command: string,
    args: string[],
    _context: CommandContext,
    result: NormalizedResult,
  ): Promise<NormalizedResult> {
    const level = result.success ? "info" : "error";
    this.logger[level](`Command completed: ${command}`, {
      command,
      args,
      success: result.success,
      message: result.message,
    });
    return result;
  }
}
