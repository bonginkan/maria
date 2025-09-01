/**
 * Client-side throttle for Free plan commands
 * Prevents thundering herds and provides consistent UX
 */

export class ClientThrottle {
  private static lastCallTime = 0;
  private static readonly GAP_MS = 3000; // 3s for Free plan

  /**
   * Enforce soft throttle for Free plan commands
   */
  static check(plan: string): void {
    if (plan !== 'free') return;

    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    const remaining = this.GAP_MS - elapsed;

    if (remaining > 0) {
      throw new ThrottleError(`⏱ Wait ${Math.ceil(remaining / 1000)}s`);
    }

    this.lastCallTime = now;
  }

  /**
   * Universal throttle for any Free command - prevents rate limits
   */
  static enforceSoftThrottle(plan: string, gapMs = 3000): void {
    if (plan !== 'free') return;
    
    const now = Date.now();
    const lastCommandTime = (globalThis as any).__lastCmdTs || 0;
    const left = gapMs - (now - lastCommandTime);
    
    if (left > 0) {
      throw new Error(`⏱ Wait ${Math.ceil(left / 1000)}s`);
    }
    
    (globalThis as any).__lastCmdTs = now;
  }
}

export class ThrottleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThrottleError';
  }
}