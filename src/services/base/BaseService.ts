/**
 * Base Service Class for Resource Management
 * All services should extend this for proper timer/listener cleanup
 */

export interface ServiceConfig {
  name: string;
  enableTelemetry?: boolean;
  jitterPercent?: number; // 0-100, default 10
}

export abstract class BaseService {
  protected readonly serviceName: string;
  protected timers: NodeJS.Timeout[] = [];
  protected listeners: Array<() => void> = [];
  protected destroyed = false;
  protected telemetryEnabled: boolean;
  protected jitterPercent: number;

  constructor(config: ServiceConfig) {
    this.serviceName = config.name;
    this.telemetryEnabled = config.enableTelemetry ?? false;
    this.jitterPercent = config.jitterPercent ?? 10;
  }

  /**
   * Register a timer with automatic cleanup and jitter
   */
  protected registerTimer(
    fn: () => void | Promise<void>,
    interval: number,
    options?: {
      immediate?: boolean;
      jitter?: boolean;
    },
  ): void {
    if (this.destroyed) {
      console.warn(
        `[${this.serviceName}] Cannot register timer - service is destroyed`,
      );
      return;
    }

    // Add jitter to prevent thundering herd
    let actualInterval = interval;
    if (options?.jitter !== false) {
      const jitterAmount = interval * (this.jitterPercent / 100);
      actualInterval = interval + (Math.random() - 0.5) * 2 * jitterAmount;
    }

    // Wrap async functions safely
    const safeFn = () => {
      try {
        const result = fn();
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`[${this.serviceName}] Timer error:`, error);
          });
        }
      } catch (error) {
        console.error(`[${this.serviceName}] Timer error:`, error);
      }
    };

    // Execute immediately if requested
    if (options?.immediate) {
      safeFn();
    }

    const timer = setInterval(safeFn, actualInterval);
    this.timers.push(timer);

    // Don't keep process alive
    (timer as any).unref?.();

    if (this.telemetryEnabled) {
      this.logTelemetry("timer.registered", { interval: actualInterval });
    }
  }

  /**
   * Register a cleanup listener
   */
  protected registerListener(cleanup: () => void | Promise<void>): void {
    if (this.destroyed) {
      console.warn(
        `[${this.serviceName}] Cannot register listener - service is destroyed`,
      );
      return;
    }

    // Wrap async cleanup safely
    const safeCleanup = () => {
      try {
        const result = cleanup();
        if (result instanceof Promise) {
          result.catch((innerError) => {
            console.error(`[${this.serviceName}] Cleanup error:`, innerError);
          });
        }
      } catch (error) {
        console.error(`[${this.serviceName}] Cleanup failed:`, error);
      }
    };

    this.listeners.push(safeCleanup);
  }

  /**
   * Register a delayed task
   */
  protected registerDelay(
    fn: () => void | Promise<void>,
    delay: number,
  ): NodeJS.Timeout {
    if (this.destroyed) {
      throw new Error(
        `[${this.serviceName}] Cannot register delay - service is destroyed`,
      );
    }

    const timer = setTimeout(() => {
      try {
        const result = fn();
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`[${this.serviceName}] Delayed task error:`, error);
          });
        }
      } catch (error) {
        console.error(`[${this.serviceName}] Delayed task error:`, error);
      }

      // Remove from timers array after execution
      const index = this.timers.indexOf(timer);
      if (index > -1) {
        this.timers.splice(index, 1);
      }
    }, delay);

    this.timers.push(timer);
    (timer as any).unref?.();

    return timer;
  }

  /**
   * Cancel a specific timer
   */
  protected cancelTimer(timer: NodeJS.Timeout): boolean {
    const index = this.timers.indexOf(timer);
    if (index > -1) {
      clearTimeout(timer);
      this.timers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get service health status
   */
  getHealth(): ServiceHealth {
    return {
      service: this.serviceName,
      status: this.destroyed ? "destroyed" : "healthy",
      timers: this.timers.length,
      listeners: this.listeners.length,
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed / 1024 / 1024, // MB
    };
  }

  /**
   * Log telemetry event
   */
  protected logTelemetry(event: string, metadata?: Record<string, any>): void {
    if (!this.telemetryEnabled) return;

    const telemetryEvent = {
      service: this.serviceName,
      event,
      timestamp: Date.now(),
      metadata,
    };

    // In production, this would emit to a telemetry collector
    if (process.env.DEBUG_TELEMETRY) {
      console.log("[TELEMETRY]", JSON.stringify(telemetryEvent));
    }
  }

  /**
   * Destroy the service and cleanup all resources
   */
  destroy(): void {
    if (this.destroyed) {
      console.warn(`[${this.serviceName}] Already destroyed`);
      return;
    }

    console.log(`[${this.serviceName}] Destroying service...`);

    // Clear all timers
    for (const timer of this.timers) {
      clearInterval(timer);
      clearTimeout(timer);
    }
    this.timers = [];

    // Run all cleanup listeners
    for (const cleanup of this.listeners) {
      try {
        cleanup();
      } catch (innerError) {
        console.error(`[${this.serviceName}] Cleanup error:`, error);
      }
    }
    this.listeners = [];

    this.destroyed = true;
    this.logTelemetry("service.destroyed");

    console.log(`[${this.serviceName}] Service destroyed`);
  }

  /**
   * Check if service is destroyed
   */
  isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Abstract method - services should implement their initialization
   */
  abstract initialize(): Promise<void>;
}

export interface ServiceHealth {
  service: string;
  status: "healthy" | "unhealthy" | "destroyed";
  timers: number;
  listeners: number;
  uptime: number;
  memory: number;
}
