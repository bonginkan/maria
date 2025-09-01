/**
 * ResultAdapter
 * Normalizes command results between V2 and router formats
 * Ensures requiresInput=false to prevent re-dispatch loops
 */

import type { CommandResult } from "../../types/context";

/**
 * Router's expected result format
 */
export interface RouterResult {
  ok: boolean;
  message?: string;
  requiresInput: boolean; // CRITICAL: Must be false to prevent loops
  endReason?: "completed" | "cancelled" | "timeout" | "error";
  data?: any;
  error?: string;
}

/**
 * Error classifications for consistent handling
 */
export enum ErrorType {
  ABORT = "ABORT_ERR",
  TIMEOUT = "TIMEOUT_ERR",
  PROVIDER = "PROVIDER_ERR",
  VALIDATION = "VALIDATION_ERR",
  UNKNOWN = "UNKNOWN_ERR",
}

export class ResultAdapter {
  /**
   * Convert V2 CommandResult to Router format
   * ALWAYS sets requiresInput=false to prevent re-dispatch
   */
  static toRouterResult(v2Result: CommandResult): RouterResult {
    // Determine end reason
    let endReason: RouterResult["endReason"] = "completed";

    if (!v2Result.success) {
      if (this.isAbortError(v2Result.error)) {
        endReason = "cancelled";
      } else if (this.isTimeoutError(v2Result.error)) {
        endReason = "timeout";
      } else {
        endReason = "error";
      }
    }

    // Extract main message from messages array
    const mainMessage =
      v2Result.messages?.length > 0
        ? v2Result.messages.map((m) => m.content).join("\n")
        : v2Result.error || "Command executed";

    return {
      ok: v2Result.success,
      message: mainMessage,
      requiresInput: false, // CRITICAL: Always false for V2 commands
      endReason,
      error: v2Result.error,
      data: v2Result.data,
    };
  }

  /**
   * Convert Router result to V2 format (for compatibility)
   */
  static fromRouterResult(routerResult: RouterResult): CommandResult {
    return {
      success: routerResult.ok,
      error: routerResult.error,
      messages: routerResult.message
        ? [
            {
              role: "assistant",
              content: routerResult.message,
            },
          ]
        : [],
      data: routerResult.data,
    };
  }

  /**
   * Classify error type
   */
  static classifyError(error: any): ErrorType {
    if (!error) return ErrorType.UNKNOWN;

    const errorStr = String(error.message || error).toLowerCase();
    const errorName = error.name?.toLowerCase() || "";
    const errorCode = error.code?.toUpperCase() || "";

    // Abort/Cancel detection
    if (
      errorName === "aborterror" ||
      errorCode === ErrorType.ABORT ||
      errorStr.includes("abort") ||
      errorStr.includes("cancel")
    ) {
      return ErrorType.ABORT;
    }

    // Timeout detection
    if (
      errorStr.includes("timeout") ||
      errorStr.includes("timed out") ||
      errorCode === ErrorType.TIMEOUT
    ) {
      return ErrorType.TIMEOUT;
    }

    // Provider errors
    if (
      errorStr.includes("provider") ||
      errorStr.includes("model") ||
      errorStr.includes("api") ||
      errorCode === ErrorType.PROVIDER
    ) {
      return ErrorType.PROVIDER;
    }

    // Validation errors
    if (
      errorStr.includes("invalid") ||
      errorStr.includes("validation") ||
      errorStr.includes("required") ||
      errorCode === ErrorType.VALIDATION
    ) {
      return ErrorType.VALIDATION;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Create standardized error result
   */
  static errorResult(
    error: any,
    defaultMessage = "Command failed",
  ): CommandResult {
    const errorType = this.classifyError(error);

    // User-friendly messages based on error type
    const userMessage = {
      [ErrorType.ABORT]: "Command was cancelled",
      [ErrorType.TIMEOUT]: "Command timed out",
      [ErrorType.PROVIDER]: "AI provider error occurred",
      [ErrorType.VALIDATION]: "Invalid input provided",
      [ErrorType.UNKNOWN]: defaultMessage,
    }[errorType];

    // Detailed error for logging (not user-facing)
    const debugMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: userMessage,
      messages: [],
      data: {
        errorType,
        debugMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }

  /**
   * Check if error is abort-related
   */
  private static isAbortError(error?: string): boolean {
    if (!error) return false;
    const lower = error.toLowerCase();
    return (
      lower.includes("abort") ||
      lower.includes("cancel") ||
      lower.includes("timed out")
    );
  }

  /**
   * Check if error is timeout-related
   */
  private static isTimeoutError(error?: string): boolean {
    if (!error) return false;
    const lower = error.toLowerCase();
    return lower.includes("timeout") || lower.includes("timed out");
  }

  /**
   * Ensure result contract compliance
   */
  static validate(result: CommandResult): CommandResult {
    // Ensure required fields
    return {
      success: result.success ?? false,
      error: result.error,
      messages: Array.isArray(result.messages) ? result.messages : [],
      data: result.data,
    };
  }
}

/**
 * Create error with type
 */
export function createTypedError(
  message: string,
  type: ErrorType,
  originalError?: Error,
): Error {
  const error = new Error(message);
  error.name = type;
  (error as any).code = type;
  if (originalError) {
    (error as any).originalError = originalError;
  }
  return error;
}
