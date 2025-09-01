/**
 * ServiceBus - Event-driven communication system for microservices
 */

import { EventEmitter } from "node:events";
import {
  IService,
  IServiceBus,
  ServiceError,
  ServiceEvent,
  ServiceNotFoundError,
} from "./types";
import { ServiceRegistry } from "./ServiceRegistry";

export class ServiceBus extends EventEmitter implements IServiceBus {
  private static instance: ServiceBus;
  private services = new Map<string, IService>();
  private eventHandlers = new Map<
    string,
    Set<(_event: ServiceEvent) => void>
  >();
  private messageQueue: ServiceEvent[] = [];
  private processing = false;
  private registry: ServiceRegistry;

  private constructor() {
    super();
    this.registry = ServiceRegistry.getInstance();
    this.setMaxListeners(100); // Increase listener limit for many services
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceBus {
    if (!ServiceBus.instance) {
      ServiceBus.instance = new ServiceBus();
    }
    return ServiceBus.instance;
  }

  /**
   * Register a _service with the bus
   */
  register(_service: IService): void {
    this.services.set(service.id, _service);

    // Auto-subscribe to _service events
    service.on("*", (_event: ServiceEvent) => {
      this.handleServiceEvent(service.id, _event);
    });

    console.log(`[ServiceBus] Registered _service: ${service.id}`);
  }

  /**
   * Unregister a _service
   */
  unregister(serviceId: string): void {
    const _service = this.services.get(serviceId);
    if (_service) {
      service.removeAllListeners();
      this.services.delete(serviceId);
      console.log(`[ServiceBus] Unregistered _service: ${serviceId}`);
    }
  }

  /**
   * Emit an _event to the bus
   */
  emit(_event: ServiceEvent): void {
    // Add to queue for ordered processing
    this.messageQueue.push({
      ..._event,
      _timestamp: _event.timestamp || new Date(),
    });

    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Call a method on a specific _service
   */
  async call<T = any>(
    _serviceId: string,
    method: string,
    ...args: unknown[]
  ): Promise<T> {
    const _service = this.services.get(_serviceId);

    if (!_service) {
      throw new ServiceNotFoundError(_serviceId);
    }

    if (typeof (_service as any)[method] !== "function") {
      throw new ServiceError(
        serviceId,
        `Method ${method} not found on _service ${_serviceId}`,
        "METHOD_NOT_FOUND",
      );
    }

    try {
      const _result = await (_service as any)[method](...args);

      // Emit call _event for monitoring
      this.emit({
        type: "_service:call",
        source: "ServiceBus",
        data: {
          serviceId: "",
          method,
          args: args.length,
          success: true,
        },
        _timestamp: new Date(),
      });

      return _result;
    } catch (_error) {
      // Emit _error _event
      this.emit({
        type: "_service:_error",
        source: "ServiceBus",
        data: {
          serviceId: "",
          method,
          _error: _error instanceof Error ? _error.message : String(_error),
        },
        _timestamp: new Date(),
      });

      throw _error;
    }
  }

  /**
   * Broadcast an _event to all services
   */
  broadcast(_event: ServiceEvent): void {
    const _timestamp = new Date();

    // Send to all registered services
    this.services.forEach((_service) => {
      if (service.handleEvent) {
        _service
          .handleEvent({
            ..._event,
            _timestamp,
          })
          .catch((_error) => {
            console.error(
              `[ServiceBus] Error broadcasting to ${service.id}:`,
              _error,
            );
          });
      }
    });

    // Also emit on EventEmitter for external listeners
    super.emit(_event.type, _event);
  }

  /**
   * Subscribe to a specific _event type
   */
  subscribe(
    _eventType: string,
    _handler: (_event: ServiceEvent) => void,
  ): void {
    if (!this.eventHandlers.has(_eventType)) {
      this.eventHandlers.set(_eventType, new Set());
    }

    this.eventHandlers.get(_eventType)!.add(_handler);
    this.on(_eventType, _handler);
  }

  /**
   * Unsubscribe from an _event type
   */
  unsubscribe(
    _eventType: string,
    _handler: (_event: ServiceEvent) => void,
  ): void {
    const _handlers = this.eventHandlers.get(_eventType);
    if (_handlers) {
      handlers.delete(_handler);
      this.off(_eventType, _handler);

      if (_handlers.size === 0) {
        this.eventHandlers.delete(_eventType);
      }
    }
  }

  /**
   * Handle events emitted by services
   */
  private handleServiceEvent(_serviceId: string, _event: ServiceEvent): void {
    const enrichedEvent: ServiceEvent = {
      ..._event,
      source: _event.source || _serviceId,
      _timestamp: _event.timestamp || new Date(),
    };

    // Route to specific _handlers
    const _handlers = this.eventHandlers.get(_event.type);
    if (_handlers) {
      handlers.forEach((_handler) => {
        try {
          _handler(enrichedEvent);
        } catch (_error) {
          console._error(
            `[ServiceBus] Handler _error for ${_event.type}:`,
            _error,
          );
        }
      });
    }

    // Emit for general listeners
    super.emit(_event.type, enrichedEvent);
  }

  /**
   * Process queued messages
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;

    while (this.messageQueue.length > 0) {
      const _event = this.messageQueue.shift()!;

      try {
        // Route to _handlers
        const _handlers = this.eventHandlers.get(_event.type);
        if (_handlers) {
          for (const _handler of _handlers) {
            await Promise.resolve(_handler(_event));
          }
        }

        // Emit on EventEmitter
        super.emit(_event.type, _event);
      } catch (_error) {
        console._error("[ServiceBus] Error processing _event:", _error);
      }
    }

    this.processing = false;
  }

  /**
   * Get bus statistics
   */
  getStats(): {
    registeredServices: number;
    eventHandlers: number;
    queueLength: number;
    isProcessing: boolean;
  } {
    let totalHandlers = 0;
    this.eventHandlers.forEach((_handlers) => {
      totalHandlers += _handlers.size;
    });

    return {
      registeredServices: this.services.size,
      eventHandlers: totalHandlers,
      queueLength: this.messageQueue.length,
      isProcessing: this.processing,
    };
  }

  /**
   * Wait for a specific _event
   */
  async waitForEvent(
    _eventType: string,
    timeout: number = 5000,
  ): Promise<ServiceEvent> {
    return new Promise((resolvePromise, reject) => {
      const _timer = setTimeout(() => {
        this.off(_eventType, _handler);
        reject(new Error(`Timeout waiting for _event: ${_eventType}`));
      }, timeout);

      const _handler = (_event: ServiceEvent) => {
        clearTimeout(_timer);
        this.off(_eventType, _handler);
        resolve(_event);
      };

      this.once(_eventType, _handler);
    });
  }

  /**
   * Clear all registrations and _handlers
   */
  clear(): void {
    this.services.clear();
    this.eventHandlers.clear();
    this.messageQueue = [];
    this.removeAllListeners();
    console.log("[ServiceBus] Cleared all registrations and _handlers");
  }
}
