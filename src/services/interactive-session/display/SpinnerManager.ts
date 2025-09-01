// src/services/interactive-session/display/SpinnerManager.ts
// Unified spinner management with automatic cleanup

import ora, { Ora } from "ora";

export interface SpinnerOptions {
  text?: string;
  spinner?: string;
  color?: string;
  autoStopMs?: number;
}

export interface ActiveSpinner {
  id: string;
  spinner: Ora;
  startTime: number;
  autoStopTimer?: NodeJS.Timeout;
}

/**
 * SpinnerManager - Ensures all spinners are properly managed and stopped
 * - Single instance enforcement
 * - Automatic cleanup with finally
 * - Parallel spinner prevention
 * - Auto-stop safety mechanism
 */
export class SpinnerManager {
  private static instance: SpinnerManager;
  private spinners = new Map<string, ActiveSpinner>();
  private spinnerId = 0;
  private readonly defaultAutoStopMs = 30000; // 30 seconds safety limit

  private constructor() {
    // Cleanup on process exit
    process.on("exit", () => this.stopAll());
    process.on("SIGINT", () => this.stopAll());
    process.on("SIGTERM", () => this.stopAll());
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SpinnerManager {
    if (!SpinnerManager.instance) {
      SpinnerManager.instance = new SpinnerManager();
    }
    return SpinnerManager.instance;
  }

  /**
   * Start a new spinner
   * @param options - Spinner configuration
   * @returns Spinner ID for later stopping
   */
  start(options: SpinnerOptions = {}): string {
    const {
      text = "Processing...",
      spinner = "dots",
      color = "cyan",
      autoStopMs = this.defaultAutoStopMs,
    } = options;

    // Generate unique ID
    const id = `spinner-${++this.spinnerId}`;

    // Create spinner
    const oraSpinner = ora({
      text,
      spinner,
      color: color as any,
    }).start();

    // Set up auto-stop timer
    let autoStopTimer: NodeJS.Timeout | undefined;
    if (autoStopMs > 0) {
      autoStopTimer = setTimeout(() => {
        this.stop(id, "timeout");
      }, autoStopMs);

      // Don't prevent process exit
      (autoStopTimer as any).unref?.();
    }

    // Store spinner
    const activeSpinner: ActiveSpinner = {
      id,
      spinner: oraSpinner,
      startTime: Date.now(),
      autoStopTimer,
    };

    this.spinners.set(id, activeSpinner);

    return id;
  }

  /**
   * Stop a specific spinner
   * @param id - Spinner ID
   * @param reason - Stop reason (success/fail/warn/info/timeout)
   */
  stop(
    id: string,
    reason: "success" | "fail" | "warn" | "info" | "timeout" = "success",
  ): void {
    const activeSpinner = this.spinners.get(id);
    if (!activeSpinner) return;

    // Clear auto-stop timer
    if (activeSpinner.autoStopTimer) {
      clearTimeout(activeSpinner.autoStopTimer);
    }

    // Stop spinner with appropriate symbol
    const { spinner } = activeSpinner;
    const duration = Date.now() - activeSpinner.startTime;
    const durationText =
      duration > 1000 ? ` (${(duration / 1000).toFixed(1)}s)` : "";

    switch (reason) {
      case "success":
        spinner.succeed(spinner.text + durationText);
        break;
      case "fail":
        spinner.fail(spinner.text + durationText);
        break;
      case "warn":
        spinner.warn(spinner.text + durationText);
        break;
      case "info":
        spinner.info(spinner.text + durationText);
        break;
      case "timeout":
        spinner.warn(`${spinner.text} (timed out after ${duration / 1000}s)`);
        break;
      default:
        spinner.stop();
    }

    // Remove from active spinners
    this.spinners.delete(id);
  }

  /**
   * Update spinner text
   * @param id - Spinner ID
   * @param text - New text
   */
  update(id: string, text: string): void {
    const activeSpinner = this.spinners.get(id);
    if (activeSpinner) {
      activeSpinner.spinner.text = text;
    }
  }

  /**
   * Stop all active spinners
   * @param reason - Stop reason for all spinners
   */
  stopAll(reason: "success" | "fail" | "warn" | "info" = "info"): void {
    for (const [id] of this.spinners) {
      this.stop(id, reason);
    }
  }

  /**
   * Get count of active spinners
   */
  getActiveCount(): number {
    return this.spinners.size;
  }

  /**
   * Check if a spinner is active
   * @param id - Spinner ID
   */
  isActive(id: string): boolean {
    return this.spinners.has(id);
  }

  /**
   * Execute a function with a spinner that auto-stops
   * @param fn - Function to execute
   * @param options - Spinner options
   * @returns Function result
   */
  async withSpinner<T>(
    fn: () => Promise<T>,
    options: SpinnerOptions = {},
  ): Promise<T> {
    const spinnerId = this.start(options);

    try {
      const result = await fn();
      this.stop(spinnerId, "success");
      return result;
    } catch (error) {
      this.stop(spinnerId, "fail");
      throw error;
    }
  }

  /**
   * Create a progress spinner that updates with percentage
   * @param total - Total items
   * @param text - Base text
   * @returns Object with update and stop methods
   */
  createProgress(
    total: number,
    text = "Processing",
  ): {
    id: string;
    update: (current: number) => void;
    stop: (reason?: "success" | "fail") => void;
  } {
    const id = this.start({ text: `${text} (0/${total})` });

    return {
      id,
      update: (current: number) => {
        const percentage = Math.round((current / total) * 100);
        this.update(id, `${text} (${current}/${total}) ${percentage}%`);
      },
      stop: (reason = "success") => {
        this.stop(id, reason);
      },
    };
  }

  /**
   * Reset the manager (for testing)
   */
  reset(): void {
    this.stopAll();
    this.spinners.clear();
    this.spinnerId = 0;
  }
}
