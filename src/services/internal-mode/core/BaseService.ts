/**
 * BaseService - Abstract base class for all microservices
 */

import { EventEmitter } from "node:events";
import {
  HealthStatus,
  IService,
  ServiceConfig,
  ServiceError,
  ServiceEvent,
  ServiceMetadata,
  ServiceState,
} from "./types";
import { ServiceBus } from "./ServiceBus";
import { ServiceRegistry } from "./ServiceRegistry";

export abstract class BaseService extends EventEmitter implements IService {
  abstract id: string;
  abstract version: string;

  state: ServiceState = ServiceState.INITIALIZING;
  metadata?: ServiceMetadata;

  protected config: ServiceConfig = {};
  protected bus: ServiceBus;
  protected registry: ServiceRegistry;
  protected startTime: Date;
  protected lastHealthCheck?: Date;
  private healthCheckInterval?: NodeJS.Timer;

  // Simple logger implementation
  protected logger = {
    info: (_message: string, ...args: unknown[]) =>
      console.log(`[${this.id || "SERVICE"}] ${_message}`, ...args),
    warn: (_message: string, ...args: unknown[]) =>
      console.warn(`[${this.id || "SERVICE"}] ${_message}`, ...args),
    _error: (_message: string, ...args: unknown[]) =>
      console.error(`[${this.id || "SERVICE"}] ${_message}`, ...args),
    debug: (_message: string, ...args: unknown[]) =>
      console.debug(`[${this.id || "SERVICE"}] ${_message}`, ...args),
  };

  constructor() {
    super();
    this.bus = ServiceBus.getInstance();
    this.registry = ServiceRegistry.getInstance();
    this.startTime = new Date();
  }

  /**
   * Initialize the service
   */
  async initialize(config?: ServiceConfig): Promise<void> {
    try {
      this.state = ServiceState.INITIALIZING;
      this.config = { ...this.config, ...config };

      // Register with bus and registry
      this.bus.register(this);
      if (this.metadata) {
        this.registry.register(this.metadata, this);
      }

      // Service-specific initialization
      await this.onInitialize();

      this.state = ServiceState.READY;
      this.emitStateChange(ServiceState.READY);

      console.log(`[${this.id}] Service initialized`);
    } catch (_error) {
      this.state = ServiceState.ERROR;
      this.emitError(_error);
      throw new ServiceError(
        this.id,
        `Failed to initialize service: ${_error instanceof Error ? _error.message : String(_error)}`,
        "INIT_ERROR",
        _error,
      );
    }
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    if (
      this.state !== ServiceState.READY &&
      this.state !== ServiceState.STOPPED
    ) {
      throw new ServiceError(
        this.id,
        `Cannot start service in state: ${this.state}`,
        "INVALID_STATE",
      );
    }

    try {
      this.state = ServiceState.STARTING;
      this.emitStateChange(ServiceState.STARTING);

      // Start _health check monitoring
      this.startHealthMonitoring();

      // Service-specific startup
      await this.onStart();

      this.state = ServiceState.RUNNING;
      this.emitStateChange(ServiceState.RUNNING);

      console.log(`[${this.id}] Service started`);
    } catch (_error) {
      this.state = ServiceState.ERROR;
      this.emitError(_error);
      throw new ServiceError(
        this.id,
        `Failed to start service: ${_error instanceof Error ? _error.message : String(_error)}`,
        "START_ERROR",
        _error,
      );
    }
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (this.state !== ServiceState.RUNNING) {
      console.warn(
        `[${this.id}] Service not running, current state: ${this.state}`,
      );
      return;
    }

    try {
      this.state = ServiceState.STOPPING;
      this.emitStateChange(ServiceState.STOPPING);

      // Stop _health monitoring
      this.stopHealthMonitoring();

      // Service-specific shutdown
      await this.onStop();

      this.state = ServiceState.STOPPED;
      this.emitStateChange(ServiceState.STOPPED);

      console.log(`[${this.id}] Service stopped`);
    } catch (_error) {
      this.state = ServiceState.ERROR;
      this.emitError(_error);
      throw new ServiceError(
        this.id,
        `Failed to stop service: ${_error instanceof Error ? _error.message : String(_error)}`,
        "STOP_ERROR",
        _error,
      );
    }
  }

  /**
   * Dispose of the service
   */
  async dispose(): Promise<void> {
    try {
      // Stop if running
      if (this.state === ServiceState.RUNNING) {
        await this.stop();
      }

      // Cleanup
      this.stopHealthMonitoring();
      this.bus.unregister(this.id);
      this.registry.unregister(this.id);

      // Service-specific disposal
      await this.onDispose();

      this.state = ServiceState.DISPOSED;
      this.removeAllListeners();

      console.log(`[${this.id}] Service disposed`);
    } catch (_error) {
      console._error(`[${this.id}] Error during disposal:`, _error);
    }
  }

  /**
   * Get service _health status
   */
  async _health(): Promise<HealthStatus> {
    const baseHealth: HealthStatus = {
      service: this.id,
      status: this.getHealthStatus(),
      uptime: Date.now() - this.startTime.getTime(),
      memory: process.memoryUsage(),
      lastCheck: this.lastHealthCheck,
      details: {
        state: this.state,
        version: this.version,
        config: this.config,
      },
    };

    // Get service-specific _health details
    const _customHealth = await this.getCustomHealth();

    return {
      ...baseHealth,
      details: {
        ...baseHealth.details,
        ..._customHealth,
      },
    };
  }

  /**
   * Handle incoming events
   */
  async handleEvent?(event: ServiceEvent): Promise<void> {
    try {
      // Log event reception
      if (this.config.logEvents) {
        console.log(`[${this.id}] Received event:`, event.type);
      }

      // Service-specific event handling
      await this.onEvent(event);
    } catch (_error) {
      console._error(`[${this.id}] Error handling event:`, _error);
      this.emitError(_error);
    }
  }

  // Protected lifecycle hooks for subclasses
  protected async onInitialize(): Promise<void> {
    // Method implementation pending
  }
  protected async onStart(): Promise<void> {
    // Method implementation pending
  }
  protected async onStop(): Promise<void> {
    // Method implementation pending
  }
  protected async onDispose(): Promise<void> {
    // Method implementation pending
  }
  protected async onEvent(_event: ServiceEvent): Promise<void> {
    // Method implementation pending
  }
  protected async getCustomHealth(): Promise<Record<string, any>> {
    return {};
  }

  /**
   * Emit a service event
   */
  protected emitServiceEvent(_type: string, data?: unknown): void {
    const event: ServiceEvent = {
      type: "",
      source: this.id,
      data,
      timestamp: new Date(),
    };

    this.emit("*", event);
    this.bus.emit(event);
  }

  /**
   * Call another service
   */
  protected async callService<T = any>(
    serviceId: string,
    method: string,
    ...args: unknown[]
  ): Promise<T> {
    return this.bus.call<T>(serviceId, method, ...args);
  }

  /**
   * Subscribe to events
   */
  protected subscribeToEvent(
    _eventType: string,
    handler: (event: ServiceEvent) => void,
  ): void {
    this.bus.subscribe(_eventType, handler);
  }

  /**
   * Start _health monitoring
   */
  private startHealthMonitoring(): void {
    const _interval = this.config.healthCheckInterval || 30000; // Default 30s

    this.healthCheckInterval = setInterval(async () => {
      try {
        const _health = await this._health();
        this.lastHealthCheck = new Date();

        this.emitServiceEvent("service:_health", _health);
      } catch (_error) {
        console._error(`[${this.id}] Health check failed:`, _error);
      }
    }, _interval);
  }

  /**
   * Stop _health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Emit state change event
   */
  private emitStateChange(newState: ServiceState): void {
    this.emitServiceEvent("service:state", {
      previous: this.state,
      current: newState,
    });
  }

  /**
   * Emit _error event
   */
  private emitError(_error: unknown): void {
    this.emitServiceEvent("service:_error", {
      _error:
        _error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : _error,
    });
  }

  /**
   * Get _health status based on state
   */
  private getHealthStatus(): "healthy" | "unhealthy" | "degraded" {
    switch (this.state) {
      case ServiceState.RUNNING:
        return "healthy";
      case ServiceState.ERROR:
        return "unhealthy";
      case ServiceState.STARTING:
      case ServiceState.STOPPING:
        return "degraded";
      default:
        return "degraded";
    }
  }

  /**
   * Helper to delay execution
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper to retry operations
   */
  protected async retry<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    let lastError: any;

    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (_error) {
        lastError = _error;
        if (i < retries - 1) {
          await this.delay(delay * Math.pow(2, i)); // Exponential backoff
        }
      }
    }

    throw lastError;
  }
}
