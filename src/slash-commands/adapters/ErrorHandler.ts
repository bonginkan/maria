import { CommandResult, ErrorCode } from "../types/command.types";
import { ResultAdapter } from "./ResultAdapter";

/**
 * Standardized error handling for all commands
 * Separates user-facing messages from developer logs
 */
export class ErrorHandler {
  private static isDevelopment = process.env.NODE_ENV !== "production";

  /**
   * Handle command execution with proper error catching
   */
  static async execute<T>(
    operation: () => Promise<T>,
    context: {
      command: string;
      userMessage?: string;
      logger?: any;
    },
  ): Promise<CommandResult> {
    try {
      const result = await operation();

      // If result is already a CommandResult, normalize it
      if (
        result &&
        typeof result === "object" &&
        ("success" in result || "_success" in result)
      ) {
        return ResultAdapter.normalize(result);
      }

      // Otherwise, treat as success with data
      return ResultAdapter.createSuccess(
        context.userMessage || `Command ${context.command} completed`,
        result,
      );
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  /**
   * Handle errors with proper separation of concerns
   */
  static handleError(
    error: unknown,
    context: {
      command: string;
      userMessage?: string;
      logger?: any;
    },
  ): CommandResult {
    const errorInfo = this.extractErrorInfo(error);

    // Log to developer console (never expose sensitive data)
    if (context.logger) {
      context.logger.error(`Command ${context.command} failed:`, {
        message: errorInfo.message,
        code: errorInfo.code,
        ...(this.isDevelopment && { stack: errorInfo.stack }),
      });
    } else if (this.isDevelopment) {
      console.error(`[${context.command}]`, errorInfo.message);
      if (errorInfo.stack) {
        console.error(errorInfo.stack);
      }
    }

    // Return user-friendly message
    const userMessage =
      context.userMessage ||
      this.getUserMessage(errorInfo.code) ||
      `Failed to execute ${context.command}`;

    return ResultAdapter.createErrorResult(
      userMessage,
      errorInfo.code,
      this.isDevelopment
        ? {
            originalError: errorInfo.message,
          }
        : undefined,
    );
  }

  /**
   * Extract error information safely
   */
  private static extractErrorInfo(error: unknown): {
    message: string;
    code: ErrorCode;
    stack?: string;
  } {
    if (error instanceof Error) {
      const code = this.inferErrorCode(error);
      return {
        message: this.sanitizeErrorMessage(error.message),
        code,
        stack: error.stack,
      };
    }

    if (typeof error === "string") {
      return {
        message: this.sanitizeErrorMessage(error),
        code: ErrorCode.INTERNAL_ERROR,
      };
    }

    return {
      message: "An unexpected error occurred",
      code: ErrorCode.INTERNAL_ERROR,
    };
  }

  /**
   * Infer error code from error type or message
   */
  private static inferErrorCode(error: Error): ErrorCode {
    const message = error.message.toLowerCase();

    // File system errors
    if (message.includes("enoent") || message.includes("no such file")) {
      return ErrorCode.FILE_ERROR;
    }
    if (message.includes("eacces") || message.includes("permission")) {
      return ErrorCode.PERMISSION_ERROR;
    }

    // Network errors
    if (
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("econnrefused")
    ) {
      return ErrorCode.NETWORK_ERROR;
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("timed out")) {
      return ErrorCode.TIMEOUT_ERROR;
    }

    // Provider errors
    if (message.includes("provider") || message.includes("api")) {
      return ErrorCode.PROVIDER_ERROR;
    }

    // Validation errors
    if (message.includes("invalid") || message.includes("validation")) {
      return ErrorCode.VALIDATION_ERROR;
    }

    return ErrorCode.INTERNAL_ERROR;
  }

  /**
   * Get user-friendly message for error code
   */
  private static getUserMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.UNKNOWN_COMMAND]:
        "Unknown command. Type /help for available commands.",
      [ErrorCode.INVALID_ARGS]:
        "Invalid arguments provided. Check the command usage.",
      [ErrorCode.PROVIDER_ERROR]: "Failed to communicate with the AI provider.",
      [ErrorCode.FILE_ERROR]:
        "File operation failed. Check the file path and permissions.",
      [ErrorCode.NETWORK_ERROR]: "Network error. Please check your connection.",
      [ErrorCode.VALIDATION_ERROR]:
        "Invalid input. Please check your arguments.",
      [ErrorCode.PERMISSION_ERROR]:
        "Permission denied. Check file/directory permissions.",
      [ErrorCode.TIMEOUT_ERROR]: "Operation timed out. Please try again.",
      [ErrorCode.INTERNAL_ERROR]:
        "An internal error occurred. Please try again.",
    };

    return messages[code] || messages[ErrorCode.INTERNAL_ERROR];
  }

  /**
   * Sanitize error messages to remove sensitive information
   */
  private static sanitizeErrorMessage(message: string): string {
    // Remove potential API keys (common patterns)
    let sanitized = message.replace(/([A-Za-z0-9]{32,})/g, "[REDACTED]");

    // Remove potential file paths with user directories
    sanitized = sanitized.replace(/\/(?:home|Users)\/[^\/\s]+/g, "/[USER]");

    // Remove potential URLs with credentials
    sanitized = sanitized.replace(
      /https?:\/\/[^:]+:[^@]+@[^\s]+/g,
      "https://[REDACTED]@[URL]",
    );

    // Remove potential email addresses
    sanitized = sanitized.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "[EMAIL]",
    );

    return sanitized;
  }

  /**
   * Create a retry wrapper for flaky operations
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      backoff?: number;
      shouldRetry?: (error: any) => boolean;
    } = {},
  ): Promise<T> {
    const maxAttempts = options.maxAttempts || 3;
    const backoff = options.backoff || 1000;
    const shouldRetry =
      options.shouldRetry ||
      ((error) => {
        const code = this.inferErrorCode(error);
        return (
          code === ErrorCode.NETWORK_ERROR || code === ErrorCode.TIMEOUT_ERROR
        );
      });

    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (innerError) {
        lastError = error;

        if (attempt < maxAttempts && shouldRetry(error)) {
          // Exponential backoff
          const delay = backoff * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Wrap async operations with timeout
   */
  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 30000,
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }
}
