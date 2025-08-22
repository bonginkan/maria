/**
 * Event decorator for event handling
 */

import 'reflect-metadata';
import { METADATA_KEYS, ServiceEvent } from '../types';

interface EventHandlerMetadata {
  eventType: string;
  method: string;
  priority?: number;
  filter?: (event: ServiceEvent) => boolean;
}

/**
 * @EventHandler decorator - Marks a method as an event handler
 */
export function EventHandler(
  eventType: string,
  options?: {
    priority?: number;
    filter?: (event: ServiceEvent) => boolean;
  },
) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    // Get existing handlers or create new array
    const handlers: EventHandlerMetadata[] =
      Reflect.getMetadata(METADATA_KEYS.EVENT_HANDLER, target.constructor) || [];

    // Add this handler
    handlers.push({
      eventType,
      method: propertyKey,
      priority: options?.priority,
      filter: options?.filter,
    });

    // Sort by priority (higher priority first)
    handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Store updated handlers
    Reflect.defineMetadata(METADATA_KEYS.EVENT_HANDLER, handlers, target.constructor);

    console.log(`[Event Decorator] Registered handler for ${eventType} on ${propertyKey}`);

    return descriptor;
  };
}

/**
 * @On decorator - Shorthand for EventHandler
 */
export function On(eventType: string) {
  return EventHandler(eventType);
}

/**
 * @Once decorator - Handle event only once
 */
export function Once(eventType: string) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let handled = false;

    descriptor.value = async function (...args: unknown[]) {
      if (!handled) {
        handled = true;
        return originalMethod.apply(this, args);
      }
    };

    return EventHandler(eventType)(target, propertyKey, descriptor);
  };
}

/**
 * @Before decorator - Execute before main handler
 */
export function Before(eventType: string) {
  return EventHandler(eventType, { priority: 100 });
}

/**
 * @After decorator - Execute after main handler
 */
export function After(eventType: string) {
  return EventHandler(eventType, { priority: -100 });
}

/**
 * @Throttle decorator - Throttle event handling
 */
export function Throttle(ms: number) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let lastCall = 0;

    descriptor.value = async function (...args: unknown[]) {
      const now = Date.now();
      if (now - lastCall >= ms) {
        lastCall = now;
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * @Debounce decorator - Debounce event handling
 */
export function Debounce(ms: number) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let timeout: NodeJS.Timeout;

    descriptor.value = async function (...args: unknown[]) {
      clearTimeout(timeout);
      return new Promise((resolve) => {
        timeout = setTimeout(() => {
          resolve(originalMethod.apply(this, args));
        }, ms);
      });
    };

    return descriptor;
  };
}

/**
 * @Filter decorator - Filter events based on condition
 */
export function Filter(predicate: (event: ServiceEvent) => boolean) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (event: ServiceEvent, ...args: unknown[]) {
      if (predicate(event)) {
        return originalMethod.apply(this, [event, ...args]);
      }
    };

    return descriptor;
  };
}

/**
 * @Transform decorator - Transform event before handling
 */
export function Transform(transformer: (event: ServiceEvent) => ServiceEvent) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (event: ServiceEvent, ...args: unknown[]) {
      const transformedEvent = transformer(event);
      return originalMethod.apply(this, [transformedEvent, ...args]);
    };

    return descriptor;
  };
}

/**
 * @Retry decorator - Retry on failure
 */
export function Retry(attempts: number = 3, delay: number = 1000) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      let lastError: any;

      for (let i = 0; i < attempts; i++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          if (i < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
          }
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}

/**
 * Get event handlers for a service
 */
export function getEventHandlers(target: unknown): EventHandlerMetadata[] {
  return Reflect.getMetadata(METADATA_KEYS.EVENT_HANDLER, target.constructor) || [];
}

/**
 * Register event handlers automatically
 */
export function registerEventHandlers(service: unknown, bus: unknown): void {
  const handlers = getEventHandlers(service);

  handlers.forEach((handler) => {
    bus.subscribe(handler.eventType, async (event: ServiceEvent) => {
      if (!handler.filter || handler.filter(event)) {
        await service[handler.method](event);
      }
    });
  });
}
