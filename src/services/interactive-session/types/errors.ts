// src/services/interactive-session/types/errors.ts
// Unified error taxonomy for consistent handling

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = false,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UserCancelError extends SessionError {
  constructor(message = "Operation canceled by user") {
    super(message, "USER_CANCEL", true);
  }
}

export class DeadlineError extends SessionError {
  constructor(
    message = "Operation exceeded deadline",
    public readonly deadlineMs: number,
  ) {
    super(message, "DEADLINE_EXCEEDED", true);
  }
}

export class ProviderError extends SessionError {
  constructor(
    message: string,
    public readonly provider?: string,
    public readonly originalError?: unknown,
  ) {
    super(message, "PROVIDER_ERROR", true);
  }
}

export class InternalError extends SessionError {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message, "INTERNAL_ERROR", false);
  }
}

export class ValidationError extends SessionError {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message, "VALIDATION_ERROR", true);
  }
}

export class NetworkError extends SessionError {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message, "NETWORK_ERROR", true);
  }
}

/**
 * Type guard to check if an error is a SessionError
 */
export function isSessionError(error: unknown): error is SessionError {
  return error instanceof SessionError;
}

/**
 * Type guard to check if an error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (isSessionError(error)) {
    return error.recoverable;
  }
  return false;
}

/**
 * Convert any error to a SessionError
 */
export function toSessionError(error: unknown): SessionError {
  if (isSessionError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes("cancel") || error.message.includes("abort")) {
      return new UserCancelError(error.message);
    }
    if (
      error.message.includes("timeout") ||
      error.message.includes("deadline")
    ) {
      return new DeadlineError(error.message, 15000);
    }
    if (error.message.includes("network") || error.message.includes("fetch")) {
      return new NetworkError(error.message);
    }

    return new InternalError(error.message, error);
  }

  return new InternalError(String(error), error);
}
