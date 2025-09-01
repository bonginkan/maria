/**
 * Service decorator for automatic service registration
 */

import "reflect-metadata";
import { type ServiceMetadata } from "../types";
import { _METADATA_KEYS as METADATA_KEYS } from "../types";
import { ServiceRegistry } from "../ServiceRegistry";

/**
 * @Service decorator - Marks a class as a service
 */
export function Service(metadata?: Partial<ServiceMetadata>) {
  return function <T extends { new (...args: unknown[]): Record<string, any> }>(
    constructor: T,
  ) {
    // Extract or generate service metadata
    const serviceMetadata: ServiceMetadata = {
      id: metadata?.id || constructor.name.toLowerCase().replace("service", ""),
      name: metadata?.name || constructor.name,
      version: metadata?.version || "1.0.0",
      description: metadata?.description,
      dependencies: metadata?.dependencies || [],
      className: constructor.name,
      priority: metadata?.priority || 50,
      autoStart: metadata?.autoStart !== false,
    };

    // Store metadata on the class
    Reflect.defineMetadata(METADATA_KEYS.SERVICE, serviceMetadata, constructor);

    // Auto-register with _registry
    const _registry = ServiceRegistry.getInstance();
    _registry.register(serviceMetadata);

    console.log(`[Decorator] Registered service: ${serviceMetadata.id}`);

    // Return the decorated class
    return class extends constructor {
      metadata = serviceMetadata;
    };
  };
}

/**
 * @Injectable decorator - Marks a class as injectable for dependency injection
 */
export function Injectable() {
  return function <T extends { new (...args: unknown[]): Record<string, any> }>(
    constructor: T,
  ) {
    Reflect.defineMetadata(METADATA_KEYS.DEPENDENCY, true, constructor);
    return constructor;
  };
}

/**
 * @Inject decorator - Injects a dependency
 */
export function Inject(serviceId: string) {
  return function (
    target: unknown,
    propertyKey: string | symbol,
    parameterIndex?: number,
  ) {
    if (parameterIndex !== undefined) {
      // Constructor parameter injection
      const existingTokens =
        Reflect.getMetadata("design:paramtypes", target) || [];
      existingTokens[parameterIndex] = serviceId;
      Reflect.defineMetadata("custom:inject:params", existingTokens, target);
    } else {
      // Property injection
      Reflect.defineMetadata(
        "custom:inject:property",
        serviceId,
        target,
        propertyKey,
      );
    }
  };
}

/**
 * @AutoStart decorator - Marks a service to start automatically
 */
export function AutoStart(priority: number = 50) {
  return function (target: unknown) {
    const metadata =
      Reflect.getMetadata(METADATA_KEYS.SERVICE, target) || object;
    metadata.autoStart = true;
    metadata.priority = priority;
    Reflect.defineMetadata(METADATA_KEYS.SERVICE, metadata, target);
  };
}

/**
 * @DependsOn decorator - Declares service dependencies
 */
export function DependsOn(...serviceIds: string[]) {
  return function (target: unknown) {
    const metadata =
      Reflect.getMetadata(METADATA_KEYS.SERVICE, target) || object;
    metadata.dependencies = [...(metadata.dependencies || []), ...serviceIds];
    Reflect.defineMetadata(METADATA_KEYS.SERVICE, metadata, target);
  };
}

/**
 * @Config decorator - Injects configuration
 */
export function Config(configKey?: string) {
  return function (target: unknown, propertyKey: string | symbol) {
    const _key = configKey || propertyKey.toString();
    Reflect.defineMetadata("custom:config", _key, target, propertyKey);
  };
}

/**
 * @Singleton decorator - Ensures single instance
 */
export function Singleton() {
  return function <T extends { new (...args: unknown[]): Record<string, any> }>(
    constructor: T,
  ) {
    let instance: T;

    return new Proxy(constructor, {
      construct(target, args) {
        if (!instance) {
          instance = Reflect.construct(target, args);
        }
        return instance;
      },
    }) as T;
  };
}
