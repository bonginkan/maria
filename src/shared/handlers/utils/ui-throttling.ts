/**
 * UI Rate Limiting and Throttling
 * Prevents TTY flooding and improves performance
 */

import type { UiPort, UiProgress, UiMessage } from "../../types/context";
import { safeAsync, isAborted } from "./abort-helpers";

export interface ThrottleOptions {
  debounceMs?: number; // Default: 100ms
  minProgressDelta?: number; // Default: 5%
  maxUpdatesPerSecond?: number; // Default: 10
  suppressAfterAbort?: boolean; // Default: true
}

export class ThrottledUiPort implements UiPort {
  private lastProgressUpdate = 0;
  private lastProgressPercentage = -1;
  private pendingProgressUpdate: NodeJS.Timeout | null = null;
  private updateQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  constructor(
    private innerUi: UiPort,
    private options: ThrottleOptions = {},
  ) {
    this.options = {
      debounceMs: 100,
      minProgressDelta: 5,
      maxUpdatesPerSecond: 10,
      suppressAfterAbort: true,
      ...options,
    };
  }

  /**
   * Throttled progress updates
   */
  async showProgress(
    progress: UiProgress,
    signal?: AbortSignal,
  ): Promise<void> {
    // Skip if aborted and suppression enabled
    if (this.options.suppressAfterAbort && isAborted(signal)) {
      return Promise.resolve();
    }

    const now = Date.now();
    const minInterval = 1000 / (this.options.maxUpdatesPerSecond || 10);
    const percentageDelta = Math.abs(
      (progress.percentage || 0) - this.lastProgressPercentage,
    );

    // Skip if too frequent and delta too small
    if (
      now - this.lastProgressUpdate < minInterval &&
      percentageDelta < (this.options.minProgressDelta || 5) &&
      progress.percentage !== 100 // Always show completion
    ) {
      this.debouncedProgressUpdate(progress, signal);
      return Promise.resolve();
    }

    // Clear any pending debounced update
    if (this.pendingProgressUpdate) {
      clearTimeout(this.pendingProgressUpdate);
      this.pendingProgressUpdate = null;
    }

    // Update immediately
    await safeAsync(() => this.innerUi.showProgress(progress), signal);

    this.lastProgressUpdate = now;
    this.lastProgressPercentage = progress.percentage || 0;
    return Promise.resolve();
  }

  /**
   * Debounced progress update for suppressed updates
   */
  private debouncedProgressUpdate(
    progress: UiProgress,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (this.pendingProgressUpdate) {
        clearTimeout(this.pendingProgressUpdate);
      }

      this.pendingProgressUpdate = setTimeout(async () => {
        this.pendingProgressUpdate = null;
        await safeAsync(() => this.innerUi.showProgress(progress), signal);
        this.lastProgressUpdate = Date.now();
        this.lastProgressPercentage = progress.percentage || 0;
        resolve();
      }, this.options.debounceMs);
    });
  }

  /**
   * Queued display updates to prevent flooding
   */
  async display(message: UiMessage, signal?: AbortSignal): Promise<void> {
    return this.queueUpdate(async () => {
      await this.innerUi.display(message);
    }, signal);
  }

  /**
   * Queue update to prevent concurrent UI operations
   */
  private async queueUpdate(
    updateFn: () => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.updateQueue.push(async () => {
        try {
          await safeAsync(updateFn, signal);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process queued updates sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.updateQueue.length > 0) {
      const update = this.updateQueue.shift();
      if (update) {
        try {
          await update();
        } catch (error) {
          // Log but continue processing
          console.warn("UI update failed:", error);
        }
      }
    }

    this.isProcessing = false;
  }

  // Pass-through methods with optional throttling
  async prompt(prompt: string, options?: any): Promise<string> {
    return this.innerUi.prompt(prompt, options);
  }

  async confirm(message: string, options?: any): Promise<boolean> {
    return this.innerUi.confirm(message, options);
  }

  async select(
    message: string,
    choices: string[],
    options?: any,
  ): Promise<string> {
    return this.innerUi.select(message, choices, options);
  }

  async showError(message: string, signal?: AbortSignal): Promise<void> {
    return this.queueUpdate(() => this.innerUi.showError(message), signal);
  }

  async showSuccess(message: string, signal?: AbortSignal): Promise<void> {
    return this.queueUpdate(() => this.innerUi.showSuccess(message), signal);
  }

  async showWarning(message: string, signal?: AbortSignal): Promise<void> {
    return this.queueUpdate(() => this.innerUi.showWarning(message), signal);
  }

  /**
   * Force flush all pending updates
   */
  async flush(): Promise<void> {
    if (this.pendingProgressUpdate) {
      clearTimeout(this.pendingProgressUpdate);
      this.pendingProgressUpdate = null;
    }

    await this.processQueue();
  }

  /**
   * Clear all pending updates (emergency)
   */
  clearPending(): void {
    if (this.pendingProgressUpdate) {
      clearTimeout(this.pendingProgressUpdate);
      this.pendingProgressUpdate = null;
    }
    this.updateQueue.length = 0;
    this.isProcessing = false;
  }
}

/**
 * Factory function to create throttled UI
 */
export function createThrottledUi(
  innerUi: UiPort,
  options?: ThrottleOptions,
): ThrottledUiPort {
  return new ThrottledUiPort(innerUi, options);
}

/**
 * Progress manager with automatic cleanup
 */
export class ProgressManager {
  private currentPercentage = 0;

  constructor(
    private ui: UiPort,
    private signal?: AbortSignal,
  ) {}

  async update(percentage: number, message?: string): Promise<void> {
    // Clamp percentage
    this.currentPercentage = Math.max(0, Math.min(100, percentage));

    await this.ui.showProgress(
      {
        percentage: this.currentPercentage,
        message,
      },
      this.signal,
    );
  }

  async increment(delta: number, message?: string): Promise<void> {
    await this.update(this.currentPercentage + delta, message);
  }

  async complete(message = "Done"): Promise<void> {
    await this.update(100, message);
  }

  async reset(message?: string): Promise<void> {
    this.currentPercentage = 0;
    await this.update(0, message);
  }

  getCurrentPercentage(): number {
    return this.currentPercentage;
  }
}
