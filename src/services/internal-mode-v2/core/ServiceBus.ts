/**
 * ServiceBus - Event-driven communication system for microservices
 */

import { EventEmitter } from 'events';
import { IService, IServiceBus, ServiceEvent, ServiceNotFoundError, ServiceError } from './types';
import { ServiceRegistry } from './ServiceRegistry';

export class ServiceBus extends EventEmitter implements IServiceBus {
  private static instance: ServiceBus;
  private services = new Map<string, IService>();
  private eventHandlers = new Map<string, Set<(event: ServiceEvent) => void>>();
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
   * Register a service with the bus
   */
  register(service: IService): void {
    this.services.set(service.id, service);

    // Auto-subscribe to service events
    service.on('*', (event: ServiceEvent) => {
      this.handleServiceEvent(service.id, event);
    });

    console.log(`[ServiceBus] Registered service: ${service.id}`);
  }

  /**
   * Unregister a service
   */
  unregister(serviceId: string): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.removeAllListeners();
      this.services.delete(serviceId);
      console.log(`[ServiceBus] Unregistered service: ${serviceId}`);
    }
  }

  /**
   * Emit an event to the bus
   */
  emit(event: ServiceEvent): void {
    // Add to queue for ordered processing
    this.messageQueue.push({
      ...event,
      timestamp: event.timestamp || new Date(),
    });

    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Call a method on a specific service
   */
  async call<T = any>(serviceId: string, method: string, ...args: unknown[]): Promise<T> {
    const service = this.services.get(serviceId);

    if (!service) {
      throw new ServiceNotFoundError(serviceId);
    }

    if (typeof (service as any)[method] !== 'function') {
      throw new ServiceError(
        serviceId,
        `Method ${method} not found on service ${serviceId}`,
        'METHOD_NOT_FOUND',
      );
    }

    try {
      const result = await (service as any)[method](...args);

      // Emit call event for monitoring
      this.emit({
        type: 'service:call',
        source: 'ServiceBus',
        data: {
          serviceId,
          method,
          args: args.length,
          success: true,
        },
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      // Emit error event
      this.emit({
        type: 'service:error',
        source: 'ServiceBus',
        data: {
          serviceId,
          method,
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Broadcast an event to all services
   */
  broadcast(event: ServiceEvent): void {
    const timestamp = new Date();

    // Send to all registered services
    this.services.forEach((service) => {
      if (service.handleEvent) {
        service
          .handleEvent({
            ...event,
            timestamp,
          })
          .catch((error) => {
            console.error(`[ServiceBus] Error broadcasting to ${service.id}:`, error);
          });
      }
    });

    // Also emit on EventEmitter for external listeners
    super.emit(event.type, event);
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe(eventType: string, handler: (event: ServiceEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)!.add(handler);
    this.on(eventType, handler);
  }

  /**
   * Unsubscribe from an event type
   */
  unsubscribe(eventType: string, handler: (event: ServiceEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      this.off(eventType, handler);

      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
  }

  /**
   * Handle events emitted by services
   */
  private handleServiceEvent(serviceId: string, event: ServiceEvent): void {
    const enrichedEvent: ServiceEvent = {
      ...event,
      source: event.source || serviceId,
      timestamp: event.timestamp || new Date(),
    };

    // Route to specific handlers
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(enrichedEvent);
        } catch (error) {
          console.error(`[ServiceBus] Handler error for ${event.type}:`, error);
        }
      });
    }

    // Emit for general listeners
    super.emit(event.type, enrichedEvent);
  }

  /**
   * Process queued messages
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.messageQueue.length > 0) {
      const event = this.messageQueue.shift()!;

      try {
        // Route to handlers
        const handlers = this.eventHandlers.get(event.type);
        if (handlers) {
          for (const handler of handlers) {
            await Promise.resolve(handler(event));
          }
        }

        // Emit on EventEmitter
        super.emit(event.type, event);
      } catch (error) {
        console.error('[ServiceBus] Error processing event:', error);
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
    this.eventHandlers.forEach((handlers) => {
      totalHandlers += handlers.size;
    });

    return {
      registeredServices: this.services.size,
      eventHandlers: totalHandlers,
      queueLength: this.messageQueue.length,
      isProcessing: this.processing,
    };
  }

  /**
   * Wait for a specific event
   */
  async waitForEvent(eventType: string, timeout: number = 5000): Promise<ServiceEvent> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(eventType, handler);
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);

      const handler = (event: ServiceEvent) => {
        clearTimeout(timer);
        this.off(eventType, handler);
        resolve(event);
      };

      this.once(eventType, handler);
    });
  }

  /**
   * Clear all registrations and handlers
   */
  clear(): void {
    this.services.clear();
    this.eventHandlers.clear();
    this.messageQueue = [];
    this.removeAllListeners();
    console.log('[ServiceBus] Cleared all registrations and handlers');
  }
}
