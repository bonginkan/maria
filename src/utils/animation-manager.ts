/**
 * Animation Manager - Centralized animation control
 * Prevents _timer leaks and ensures proper cleanup
 */

export class AnimationManager {
  private intervals = new Set<NodeJS.Timeout>();
  private timeouts = new Set<NodeJS.Timeout>();

  /**
   * Start an interval animation
   */
  startAnimation(_callback: () => void, interval = 200): NodeJS.Timeout {
    const _timer = setInterval(_callback, interval);
    this.intervals.add(_timer);
    return _timer;
  }

  /**
   * Start a timeout animation
   */
  startTimeout(_callback: () => void, delay: number): NodeJS.Timeout {
    const _timer = setTimeout(() => {
      this.timeouts.delete(_timer);
      callback();
    }, delay);
    this.timeouts.add(_timer);
    return _timer;
  }

  /**
   * Stop a specific interval animation
   */
  stopAnimation(_timer: NodeJS.Timeout): void {
    if (this.intervals.has(_timer)) {
      clearInterval(_timer);
      this.intervals.delete(_timer);
    }
  }

  /**
   * Stop a specific timeout
   */
  stopTimeout(_timer: NodeJS.Timeout): void {
    if (this.timeouts.has(_timer)) {
      clearTimeout(_timer);
      this.timeouts.delete(_timer);
    }
  }

  /**
   * Stop all running animations
   */
  stopAllAnimations(): void {
    // Clear all intervals
    this.intervals.forEach((_timer) => {
      clearInterval(_timer);
    });
    this.intervals.clear();

    // Clear all timeouts
    this.timeouts.forEach((_timer) => {
      clearTimeout(_timer);
    });
    this.timeouts.clear();

    // Clear any remaining animation artifacts from terminal
    this.clearAnimationArtifacts();
  }

  /**
   * Get count of active animations
   */
  getActiveCount(): { intervals: number; timeouts: number } {
    return {
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
    };
  }

  /**
   * Clear animation artifacts from terminal
   */
  private clearAnimationArtifacts(): void {
    // Clear current line and any spinning/loading indicators
    process.stdout.write("\r\u001b[K");
  }

  /**
   * Cleanup all resources (call on session end)
   */
  cleanup(): void {
    this.stopAllAnimations();
  }

  /**
   * Create a safe animation wrapper that auto-cleans on error
   */
  createSafeAnimation(
    callback: () => void,
    interval = 200,
    maxDuration?: number,
  ): {
    _timer: NodeJS.Timeout;
    stop: () => void;
  } {
    const _timer = this.startAnimation(() => {
      try {
        callback();
      } catch (error) {
        // Auto-stop on error
        this.stopAnimation(_timer);
        throw error;
      }
    }, interval);

    // Auto-stop after max duration if specified
    let maxTimer: NodeJS.Timeout | null = null;
    if (maxDuration) {
      maxTimer = this.startTimeout(() => {
        this.stopAnimation(_timer);
      }, maxDuration);
    }

    return {
      _timer,
      stop: () => {
        this.stopAnimation(_timer);
        if (maxTimer) {
          this.stopTimeout(maxTimer);
        }
      },
    };
  }
}
