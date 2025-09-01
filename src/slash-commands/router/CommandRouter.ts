/**
 * CommandRouter - Simple command router
 * - Zero dependencies, low abstraction (prioritize reliable operation)
 * - Apply middleware in sequence
 * - Handler returns are normalized via ResultAdapter
 *
 * Usage:
 *   const router = new CommandRouter();
 *   router.register('/help', new HelpCommand());
 *   const res = await router.execute('/help', [], ctx);
 */

import {
  ResultAdapter,
  type NormalizedResult,
} from "../adapters/ResultAdapter";

export type CommandArgs = string[];

export type CommandContext = {
  // Minimal required fields, extensible for future needs
  sessionId?: string;
  user?: { id?: string; role?: string } | null;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  // Allow arbitrary extensions for existing handler compatibility
  [key: string]: unknown;
};

export interface CommandHandler {
  /** Exceptions will be caught by the router and normalized */
  execute(args: CommandArgs, context: CommandContext): Promise<unknown>;
  /** Optional: for help and meta information */
  getInfo?(): { name: string; description?: string; usage?: string };
}

export interface Middleware {
  /** Modify context before execution (return updated context) */
  before?(
    command: string,
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandContext>;
  /** Modify result after execution (for logging, metrics, etc.) */
  after?(
    command: string,
    args: CommandArgs,
    context: CommandContext,
    result: NormalizedResult,
  ): Promise<NormalizedResult>;
}

export class UnknownCommandError extends Error {
  constructor(public command: string) {
    super(`Unknown command: ${command}`);
    this.name = "UnknownCommandError";
  }
}

export class CommandRouter {
  private routes = new Map<string, CommandHandler>();
  private middleware: Middleware[] = [];

  register(command: string, handler: CommandHandler): void {
    if (!command.startsWith("/")) {
      throw new Error(`Command must start with '/': received "${command}"`);
    }
    this.routes.set(command, handler);
  }

  /** Check if command exists (to avoid overwriting) */
  has(command: string): boolean {
    return this.routes.has(command);
  }

  use(mw: Middleware): void {
    this.middleware.push(mw);
  }

  async execute(
    command: string,
    args: CommandArgs,
    context: CommandContext,
  ): Promise<NormalizedResult> {
    const handler = this.routes.get(command);
    if (!handler) {
      // Return normalized failure result instead of throwing
      // Can throw if needed to match legacy behavior
      return ResultAdapter.normalize({
        success: false,
        message: `Unknown command: ${command}`,
      });
    }

    // Apply middleware.before
    let ctx = context;
    for (const mw of this.middleware) {
      if (mw.before) {
        try {
          ctx = await mw.before(command, args, ctx);
        } catch (err: any) {
          // If middleware throws, convert to error result
          return ResultAdapter.normalize({
            success: false,
            message: err?.message ?? "Middleware error",
          });
        }
      }
    }

    // Execute handler (may return old/new format)
    let raw: unknown;
    try {
      raw = await handler.execute(args, ctx);
    } catch (err: any) {
      // Normalize exceptions (logger responsibility is separated)
      const errorResult = ResultAdapter.normalize({
        success: false,
        message: err?.message ?? "Command execution failed",
        error: err?.message ?? "Command execution failed",
      });

      // Apply middleware.after even for errors
      let normalized = errorResult;
      for (let i = this.middleware.length - 1; i >= 0; i--) {
        const mw = this.middleware[i];
        if (mw.after) {
          try {
            normalized = await mw.after(command, args, ctx, normalized);
          } catch (mwErr: any) {
            console.error(`After middleware error: ${mwErr?.message}`);
          }
        }
      }

      return normalized;
    }

    // Normalize result
    let normalized = ResultAdapter.normalize(raw);

    // Apply middleware.after in reverse order
    for (let i = this.middleware.length - 1; i >= 0; i--) {
      const mw = this.middleware[i];
      if (mw.after) {
        try {
          normalized = await mw.after(command, args, ctx, normalized);
        } catch (err: any) {
          // If after middleware fails, log but don't break the result
          console.error(`After middleware error: ${err?.message}`);
        }
      }
    }

    // CRITICAL: Prevent re-dispatch for /code command
    // Always return success to prevent infinite loops
    if (command === "/code") {
      return {
        ...normalized,
        success: true,
        requiresInput: false,
        message: normalized.message || "",
      } as NormalizedResult;
    }

    // Global safeguard: normalize defaults for all commands
    // Prevent value corruption that could cause re-dispatch
    const safeguarded: NormalizedResult = {
      ...normalized,
      success: normalized.success !== false, // Default to true
      message: normalized.message || "", // Never null/undefined
      requiresInput: false, // Never require input by default
    };

    return safeguarded;
  }

  /** List registered commands (for testing, help generation, etc.) */
  list(): Array<{
    command: string;
    info?: ReturnType<NonNullable<CommandHandler["getInfo"]>>;
  }> {
    return Array.from(this.routes.entries()).map(([cmd, h]) => ({
      command: cmd,
      info: h.getInfo?.(),
    }));
  }

  /** Clear all routes (useful for testing) */
  clear(): void {
    this.routes.clear();
  }

  /** Get handler for a command (for testing/inspection) */
  getHandler(command: string): CommandHandler | undefined {
    return this.routes.get(command);
  }
}
