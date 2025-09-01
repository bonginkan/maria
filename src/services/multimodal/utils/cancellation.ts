/**
 * Unified cancellation utilities with priority management
 */

export interface CancellationOptions {
  signal?: AbortSignal;
  deadlineMs?: number;
  deadlineAt?: number;
  priority?: "deadline" | "abort" | "manual";
}

export interface CancellationResult<T> {
  value?: T;
  error?: Error;
  reason: "completed" | "deadline" | "abort" | "manual" | "error";
  duration: number;
  startTime: number;
  endTime: number;
}

/**
 * Custom error for cancellation with reason tracking
 */
export class CancellationError extends Error {
  constructor(
    public readonly reason: "deadline" | "abort" | "manual",
    message?: string,
  ) {
    super(message || `Operation cancelled: ${reason}`);
    this.name = "CancellationError";
  }
}

/**
 * Unified cancellation utility with priority: deadline > abort > manual
 * @param promise Promise to wrap with cancellation
 * @param options Cancellation options
 * @returns Promise that rejects on cancellation
 */
export async function withCancellation<T>(
  promise: Promise<T>,
  options: CancellationOptions = {},
): Promise<T> {
  const startTime = Date.now();
  const state = { settled: false };

  return new Promise<T>((resolve, reject) => {
    const cleanup = new Set<() => void>();

    // Helper to settle the promise once
    const settle = (settler: () => void) => {
      if (!state.settled) {
        state.settled = true;
        // Clean up all resources
        cleanup.forEach((fn) => {
          try {
            fn();
          } catch (e) {
            console.error("Cleanup error:", e);
          }
        });
        cleanup.clear();
        settler();
      }
    };

    // Priority 1: Deadline (highest priority)
    let deadlineTimer: NodeJS.Timeout | undefined;

    if (options.deadlineMs && options.deadlineMs > 0) {
      deadlineTimer = setTimeout(() => {
        settle(() =>
          reject(
            new CancellationError(
              "deadline",
              `Deadline exceeded: ${options.deadlineMs}ms`,
            ),
          ),
        );
      }, options.deadlineMs);

      // Node.js optimization
      if (typeof (deadlineTimer as any).unref === "function") {
        (deadlineTimer as any).unref();
      }

      cleanup.add(() => clearTimeout(deadlineTimer!));
    } else if (options.deadlineAt && options.deadlineAt > Date.now()) {
      const ms = Math.max(0, options.deadlineAt - Date.now());
      deadlineTimer = setTimeout(() => {
        settle(() =>
          reject(
            new CancellationError(
              "deadline",
              `Deadline reached: ${new Date(options.deadlineAt!).toISOString()}`,
            ),
          ),
        );
      }, ms);

      if (typeof (deadlineTimer as any).unref === "function") {
        (deadlineTimer as any).unref();
      }

      cleanup.add(() => clearTimeout(deadlineTimer!));
    }

    // Priority 2: Abort Signal
    if (options.signal) {
      // Check if already aborted
      if (options.signal.aborted) {
        settle(() =>
          reject(new CancellationError("abort", "Signal already aborted")),
        );
        return;
      }

      // Listen for abort
      const onAbort = () => {
        settle(() => reject(new CancellationError("abort", "Signal aborted")));
      };

      options.signal.addEventListener("abort", onAbort, { once: true });
      cleanup.add(() => options.signal!.removeEventListener("abort", onAbort));
    }

    // Handle promise resolution/rejection
    promise
      .then((value) => settle(() => resolve(value)))
      .catch((error) => settle(() => reject(error)));
  });
}

/**
 * Helper to run a function with cancellation and get detailed result
 * @param fn Function to run (receives a signal for cooperative cancellation)
 * @param options Cancellation options
 * @returns Detailed result with timing and reason
 */
export async function runWithCancellation<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: CancellationOptions = {},
): Promise<CancellationResult<T>> {
  const startTime = Date.now();
  const controller = new AbortController();

  // Chain signals if provided
  if (options.signal) {
    const onAbort = () => controller.abort();
    options.signal.addEventListener("abort", onAbort, { once: true });

    // Check if already aborted
    if (options.signal.aborted) {
      controller.abort();
    }
  }

  try {
    const value = await withCancellation(fn(controller.signal), {
      ...options,
      signal: controller.signal,
    });

    return {
      value,
      reason: "completed",
      duration: Date.now() - startTime,
      startTime,
      endTime: Date.now(),
    };
  } catch (error) {
    const endTime = Date.now();

    if (error instanceof CancellationError) {
      return {
        error,
        reason: error.reason,
        duration: endTime - startTime,
        startTime,
        endTime,
      };
    }

    return {
      error: error as Error,
      reason: "error",
      duration: endTime - startTime,
      startTime,
      endTime,
    };
  }
}

/**
 * Create a deadline-aware abort controller
 * @param deadlineMs Deadline in milliseconds
 * @returns AbortController that aborts at deadline
 */
export function createDeadlineController(deadlineMs: number): AbortController {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, deadlineMs);

  // Node.js optimization
  if (typeof (timer as any).unref === "function") {
    (timer as any).unref();
  }

  // Store timer reference for potential cleanup
  (controller as any)._deadlineTimer = timer;

  return controller;
}

/**
 * Combine multiple abort signals into one
 * @param signals Array of abort signals
 * @returns Combined abort controller
 */
export function combineSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortController {
  const controller = new AbortController();

  for (const signal of signals) {
    if (!signal) continue;

    if (signal.aborted) {
      controller.abort();
      return controller;
    }

    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return controller;
}

/**
 * Race multiple promises with individual timeouts
 * @param tasks Array of tasks with optional individual timeouts
 * @returns First successful result or all errors
 */
export async function raceWithTimeouts<T>(
  tasks: Array<{
    promise: Promise<T>;
    timeoutMs?: number;
    description?: string;
  }>,
): Promise<{ winner: T; index: number } | { errors: Error[] }> {
  const results = await Promise.allSettled(
    tasks.map(async (task, index) => {
      if (task.timeoutMs) {
        const result = await withCancellation(task.promise, {
          deadlineMs: task.timeoutMs,
        });
        return { value: result, index };
      }
      const result = await task.promise;
      return { value: result, index };
    }),
  );

  // Find first success
  for (const result of results) {
    if (result.status === "fulfilled") {
      return { winner: result.value.value, index: result.value.index };
    }
  }

  // All failed, return errors
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason);

  return { errors };
}

/**
 * Utility to check if an error is a cancellation
 */
export function isCancellationError(
  error: unknown,
): error is CancellationError {
  return error instanceof CancellationError;
}

/**
 * Utility to check if an error is due to deadline
 */
export function isDeadlineError(error: unknown): boolean {
  return isCancellationError(error) && error.reason === "deadline";
}

/**
 * Utility to check if an error is due to abort
 */
export function isAbortError(error: unknown): boolean {
  return isCancellationError(error) && error.reason === "abort";
}
