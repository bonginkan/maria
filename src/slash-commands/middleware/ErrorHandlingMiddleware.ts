/**
 * ErrorHandlingMiddleware - Standardize exceptions and convert to Result
 * - Catches all exceptions and normalizes to { success:false, message }
 * - Already failed results pass through unchanged
 */
import type { Middleware, CommandContext } from "../router/CommandRouter";
import {
  ResultAdapter,
  type NormalizedResult,
} from "../adapters/ResultAdapter";

export class ErrorHandlingMiddleware implements Middleware {
  async before(
    _command: string,
    _args: string[],
    context: CommandContext,
  ): Promise<CommandContext> {
    // No preprocessing needed, could add correlation ID here
    return context;
  }

  async after(
    _command: string,
    _args: string[],
    _context: CommandContext,
    result: NormalizedResult,
  ): Promise<NormalizedResult> {
    // Ensure result shape is guaranteed even if something went wrong
    try {
      const normalized = ResultAdapter.normalize(result);

      // If result indicates failure but no error field, add it
      if (!normalized.success && !normalized.error) {
        return {
          ...normalized,
          error: normalized.message || "Command failed",
        };
      }

      return normalized;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Unknown error";
      return {
        success: false,
        message: `[Middleware] Error normalizing result: ${message}`,
        error: message,
      };
    }
  }
}
