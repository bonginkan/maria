/**
 * Adaptive Compact for intelligent output folding
 */

import type { CompactState } from "../types.js";

export class AdaptiveCompact {
  private state: CompactState = {
    eventCount: 0,
    windowStart: Date.now(),
    totalOmitted: 0,
  };

  private readonly threshold: number;
  private readonly burstLimit: number;
  private readonly windowMs: number;

  constructor(
    threshold: number = Number(process.env.INIT_COMPACT_THRESHOLD || 100),
    burstLimit: number = 200,
    windowMs: number = 1000,
  ) {
    this.threshold = threshold;
    this.burstLimit = burstLimit;
    this.windowMs = windowMs;
  }

  /**
   * Check if we should compact based on event rate and count
   */
  shouldCompact(): boolean {
    this.state.eventCount++;

    const now = Date.now();
    const windowElapsed = now - this.state.windowStart;

    // Reset window if expired
    if (windowElapsed > this.windowMs) {
      this.state.eventCount = 1;
      this.state.windowStart = now;
      return false;
    }

    // Check burst limit (events per second)
    const eventsPerSecond = (this.state.eventCount / windowElapsed) * 1000;
    if (eventsPerSecond > this.burstLimit) {
      return true;
    }

    // Check absolute threshold
    return this.state.eventCount > this.threshold;
  }

  /**
   * Record that events were omitted
   */
  recordOmitted(count: number): void {
    this.state.totalOmitted += count;
  }

  /**
   * Reset compact state
   */
  reset(): void {
    this.state = {
      eventCount: 0,
      windowStart: Date.now(),
      totalOmitted: 0,
    };
  }

  /**
   * Get current state for debugging
   */
  getState(): Readonly<CompactState> {
    return { ...this.state };
  }

  /**
   * Get summary statistics
   */
  getStats(): Record<string, unknown> {
    const now = Date.now();
    const windowElapsed = now - this.state.windowStart;
    const eventsPerSecond =
      windowElapsed > 0
        ? Math.round((this.state.eventCount / windowElapsed) * 1000)
        : 0;

    return {
      eventCount: this.state.eventCount,
      totalOmitted: this.state.totalOmitted,
      eventsPerSecond,
      windowElapsedMs: windowElapsed,
    };
  }
}
