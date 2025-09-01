/**
 * Abort/Cancel helper utilities
 * Provides consistent abort handling across commands
 */

import { ErrorType, createTypedError } from "../adapters/ResultAdapter";

/**
 * Throw if signal is aborted
 * Use at key checkpoints to enable early return
 */
export function throwIfAborted(
  signal?: AbortSignal,
  message = "Operation aborted",
): void {
  if (signal?.aborted) {
    throw createTypedError(message, ErrorType.ABORT);
  }
}

/**
 * Check if aborted without throwing
 */
export function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted ?? false;
}

/**
 * Create abort controller with timeout
 */
export function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  // Clean up timeout on abort
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeoutId);
    },
    { once: true },
  );

  return controller;
}

/**
 * Merge multiple abort signals
 */
export function mergeSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (!signal) continue;

    // If any signal is already aborted, abort immediately
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }

    // Listen for abort on each signal
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return controller.signal;
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = "Operation timed out",
): Promise<T> {
  const controller = createTimeoutController(timeoutMs);

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(createTypedError(timeoutMessage, ErrorType.TIMEOUT));
      });
    }),
  ]);
}

/**
 * Safe async operation with abort check
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
  defaultValue?: T,
): Promise<T | undefined> {
  try {
    throwIfAborted(signal);
    return await fn();
  } catch (error) {
    if (isAborted(signal) || (error as any)?.code === ErrorType.ABORT) {
      return defaultValue;
    }
    throw error;
  }
}

/**
 * Retry with exponential backoff and abort support
 */
export async function retryWithAbort<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    signal?: AbortSignal;
    shouldRetry?: (error: any) => boolean;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
    signal,
    shouldRetry = () => true,
  } = options;

  let lastError: any;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfAborted(signal);

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on abort
      if ((error as any)?.code === ErrorType.ABORT) {
        throw error;
      }

      // Check if we should retry
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      // Wait before retry (with abort support)
      await sleep(Math.min(delayMs, maxDelayMs), signal);
      delayMs *= backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Sleep with abort support
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);

    const timeoutId = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeoutId);
          reject(createTypedError("Sleep aborted", ErrorType.ABORT));
        },
        { once: true },
      );
    }
  });
}
