/**
 * StepRunner - Unified step execution with spinner management and AbortSignal support
 * Prevents spinner double-activation and ensures cleanup
 * FIXED: Single instance management + finally stop guarantee
 */

// Global active flag to prevent nested spinners
let ACTIVE = false;

export interface StepRunnerOptions {
  timeoutMs?: number;
  ui?: {
    spinner: (on: boolean, label?: string) => void;
    displayInfo?: (message: string) => void;
  };
  signal?: AbortSignal;
}

/**
 * Helper for timeout handling
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Run a step with timeout, spinner management, and abort support
 * TTY-aware: Uses spinner for TTY, logs for non-TTY environments
 * FIXED: Prevents double spinner activation
 */
export async function runStep<T>(
  label: string,
  fn: (signal: AbortSignal) => Promise<T>,
  options: StepRunnerOptions = {},
): Promise<T> {
  const { timeoutMs = 3000, ui, signal } = options;

  // Create child abort controller
  const child = new AbortController();
  const onAbort = () => child.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort);

  // Check if already active (nested call)
  if (ACTIVE) {
    // Nested call - execute without spinner to prevent double activation
    try {
      return await withTimeout(fn(child.signal), timeoutMs);
    } finally {
      signal?.removeEventListener("abort", onAbort);
      child.abort();
    }
  }

  // Mark as active
  ACTIVE = true;

  // TTY detection: disable spinner for non-TTY
  const canSpin = process.stdout.isTTY && ui?.spinner;

  // Start spinner or log
  let spinnerStarted = false;
  if (canSpin) {
    try {
      ui!.spinner(true, label);
      spinnerStarted = true;
    } catch (e) {
      // Spinner failed, fall back to console
      console.log(`[MARIA] ${label}`);
    }
  } else if (!process.stdout.isTTY) {
    console.log(`[MARIA] ${label}`);
  } else if (ui?.displayInfo) {
    ui.displayInfo(label);
  }

  const startTime = Date.now();

  try {
    // Execute with timeout
    const result = await withTimeout(fn(child.signal), timeoutMs);

    // Log success in non-TTY
    if (!process.stdout.isTTY) {
      console.log(
        `[MARIA] ${label} - completed in ${Date.now() - startTime}ms`,
      );
    }

    return result;
  } catch (error) {
    // Log error in non-TTY
    if (!process.stdout.isTTY) {
      console.error(`[MARIA] ${label} - failed: ${error}`);
    }
    throw error;
  } finally {
    // CRITICAL: Always cleanup
    if (spinnerStarted && canSpin) {
      try {
        ui!.spinner(false);
      } catch (e) {
        // Ignore spinner stop errors
      }
    }

    // Clean up event listener
    signal?.removeEventListener("abort", onAbort);

    // Abort child controller
    child.abort();

    // Reset active flag
    ACTIVE = false;
  }
}

/**
 * Run multiple steps in sequence with shared abort signal
 */
export async function runSequence<T>(
  steps: Array<{
    label: string;
    fn: (signal: AbortSignal) => Promise<any>;
    timeoutMs?: number;
  }>,
  options: StepRunnerOptions = {},
): Promise<T[]> {
  const results: T[] = [];

  for (const step of steps) {
    if (options.signal?.aborted) {
      throw new Error("Aborted");
    }

    const result = await runStep(step.label, step.fn, {
      ...options,
      timeoutMs: step.timeoutMs || options.timeoutMs,
    });

    results.push(result);
  }

  return results;
}
