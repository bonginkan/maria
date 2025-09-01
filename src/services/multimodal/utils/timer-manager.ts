/**
 * Timer manager for safe cleanup and tracking of timers/intervals
 */

export interface TimerMetrics {
  activeTimers: number;
  activeIntervals: number;
  totalCreated: number;
  totalCleared: number;
  totalExecuted: number;
  totalErrors: number;
}

/**
 * Manages timers and intervals with automatic cleanup and safety features
 */
export class TimerManager {
  private timers = new Map<
    symbol,
    {
      timer: NodeJS.Timeout;
      createdAt: number;
      description?: string;
    }
  >();

  private intervals = new Map<
    symbol,
    {
      interval: NodeJS.Timeout;
      createdAt: number;
      description?: string;
    }
  >();

  // Metrics
  private totalCreated = 0;
  private totalCleared = 0;
  private totalExecuted = 0;
  private totalErrors = 0;

  /**
   * Create a managed timeout
   * @param fn Function to execute
   * @param ms Delay in milliseconds
   * @param description Optional description for debugging
   * @returns Symbol handle for clearing
   */
  setTimeout(fn: () => void, ms: number, description?: string): symbol {
    const handle = Symbol("timer");
    this.totalCreated++;

    const timer = setTimeout(() => {
      this.timers.delete(handle);
      this.totalExecuted++;

      try {
        fn();
      } catch (error) {
        this.totalErrors++;
        console.error(
          `Timer error${description ? ` (${description})` : ""}:`,
          error,
        );
      }
    }, ms);

    // Node.js optimization: prevent timer from keeping process alive
    if (typeof (timer as any).unref === "function") {
      (timer as any).unref();
    }

    this.timers.set(handle, {
      timer,
      createdAt: Date.now(),
      description,
    });

    return handle;
  }

  /**
   * Create a managed interval
   * @param fn Function to execute repeatedly
   * @param ms Interval in milliseconds
   * @param description Optional description for debugging
   * @returns Symbol handle for clearing
   */
  setInterval(fn: () => void, ms: number, description?: string): symbol {
    const handle = Symbol("interval");
    this.totalCreated++;

    const interval = setInterval(() => {
      this.totalExecuted++;

      try {
        fn();
      } catch (error) {
        this.totalErrors++;
        console.error(
          `Interval error${description ? ` (${description})` : ""}:`,
          error,
        );

        // Optionally stop interval on error
        if (this.shouldStopOnError()) {
          this.clearInterval(handle);
        }
      }
    }, ms);

    // Node.js optimization
    if (typeof (interval as any).unref === "function") {
      (interval as any).unref();
    }

    this.intervals.set(handle, {
      interval,
      createdAt: Date.now(),
      description,
    });

    return handle;
  }

  /**
   * Create a timeout that returns a promise
   * @param ms Delay in milliseconds
   * @param description Optional description
   * @returns Promise that resolves after timeout
   */
  delay(ms: number, description?: string): Promise<void> {
    return new Promise((resolve) => {
      this.setTimeout(resolve, ms, description);
    });
  }

  /**
   * Create a timeout that can be cancelled via AbortSignal
   * @param fn Function to execute
   * @param ms Delay in milliseconds
   * @param signal Abort signal for cancellation
   * @param description Optional description
   * @returns Symbol handle or null if aborted
   */
  setTimeoutWithSignal(
    fn: () => void,
    ms: number,
    signal: AbortSignal,
    description?: string,
  ): symbol | null {
    if (signal.aborted) {
      return null;
    }

    const handle = this.setTimeout(fn, ms, description);

    const onAbort = () => {
      this.clearTimeout(handle);
    };

    signal.addEventListener("abort", onAbort, { once: true });

    // Clean up listener when timer fires
    const originalTimer = this.timers.get(handle);
    if (originalTimer) {
      const originalFn = fn;
      this.clearTimeout(handle);
      this.setTimeout(
        () => {
          signal.removeEventListener("abort", onAbort);
          originalFn();
        },
        ms,
        description,
      );
    }

    return handle;
  }

  /**
   * Clear a timeout by handle
   */
  clearTimeout(handle: symbol): boolean {
    const entry = this.timers.get(handle);
    if (entry) {
      clearTimeout(entry.timer);
      this.timers.delete(handle);
      this.totalCleared++;
      return true;
    }
    return false;
  }

  /**
   * Clear an interval by handle
   */
  clearInterval(handle: symbol): boolean {
    const entry = this.intervals.get(handle);
    if (entry) {
      clearInterval(entry.interval);
      this.intervals.delete(handle);
      this.totalCleared++;
      return true;
    }
    return false;
  }

  /**
   * Clear all timers and intervals
   */
  clearAll(): { timersCleared: number; intervalsCleared: number } {
    const timersCleared = this.timers.size;
    const intervalsCleared = this.intervals.size;

    // Clear all timers
    for (const [handle, entry] of this.timers) {
      clearTimeout(entry.timer);
      this.timers.delete(handle);
    }

    // Clear all intervals
    for (const [handle, entry] of this.intervals) {
      clearInterval(entry.interval);
      this.intervals.delete(handle);
    }

    this.totalCleared += timersCleared + intervalsCleared;

    return { timersCleared, intervalsCleared };
  }

  /**
   * Get active timer/interval count
   */
  getActiveCount(): { timers: number; intervals: number; total: number } {
    return {
      timers: this.timers.size,
      intervals: this.intervals.size,
      total: this.timers.size + this.intervals.size,
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): TimerMetrics {
    return {
      activeTimers: this.timers.size,
      activeIntervals: this.intervals.size,
      totalCreated: this.totalCreated,
      totalCleared: this.totalCleared,
      totalExecuted: this.totalExecuted,
      totalErrors: this.totalErrors,
    };
  }

  /**
   * Get list of active timers/intervals for debugging
   */
  getActiveList(): {
    timers: Array<{ description?: string; age: number }>;
    intervals: Array<{ description?: string; age: number }>;
  } {
    const now = Date.now();

    return {
      timers: Array.from(this.timers.values()).map((entry) => ({
        description: entry.description,
        age: now - entry.createdAt,
      })),
      intervals: Array.from(this.intervals.values()).map((entry) => ({
        description: entry.description,
        age: now - entry.createdAt,
      })),
    };
  }

  /**
   * Check if should stop interval on error (configurable)
   */
  private shouldStopOnError(): boolean {
    // Could be made configurable
    return false;
  }

  /**
   * Cleanup all resources
   */
  dispose(): void {
    this.clearAll();
  }
}

/**
 * Global timer manager instance
 */
export const globalTimerManager = new TimerManager();
