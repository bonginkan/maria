/**
 * Dependency Injection Container for MARIA Phase 3
 * Advanced DI system with lifecycle management, circular dependency detection,
 * and decorator-based registration
 */

import { EventEmitter } from "node:events";
import { Logger } from "../utils/logger";

// Core Interfaces
export interface ServiceDefinition<T = any> {
  token: string;
  implementation: ServiceFactory<T> | ServiceClass<T>;
  lifecycle: ServiceLifecycle;
  _dependencies: string[];
  metadata: ServiceMetadata;
}

export interface ServiceMetadata {
  description?: string;
  tags: string[];
  version: string;
  singleton?: boolean;
  lazy?: boolean;
  conditional?: ConditionalConfig;
}

export interface ConditionalConfig {
  condition: () => boolean;
  _fallback?: string;
}

export type ServiceFactory<T> = (_container: IDIContainer) => T | Promise<T>;
export type ServiceClass<T> = new (...args: any[]) => T;
export type ServiceLifecycle = "singleton" | "transient" | "scoped" | "request";

export interface ServiceScope {
  id: string;
  services: Map<string, any>;
  parent?: ServiceScope;
  created: Date;
  disposed: boolean;
}

export interface IDIContainer {
  register<T>(_definition: ServiceDefinition<T>): void;
  registerSingleton<T>(
    _token: string,
    implementation: ServiceFactory<T> | ServiceClass<T>,
  ): void;
  registerTransient<T>(
    _token: string,
    implementation: ServiceFactory<T> | ServiceClass<T>,
  ): void;
  registerScoped<T>(
    _token: string,
    implementation: ServiceFactory<T> | ServiceClass<T>,
  ): void;

  resolve<T>(token: string): T;
  resolveAsync<T>(token: string): Promise<T>;
  resolveAll<T>(tag: string): T[];

  createScope(): ServiceScope;
  disposeScope(scope: ServiceScope): void;

  isRegistered(token: string): boolean;
  getRegistration(token: string): ServiceDefinition | undefined;
  getAllRegistrations(): ServiceDefinition[];

  dispose(): Promise<void>;
}

// Main DI Container Implementation
export class DIContainer extends EventEmitter implements IDIContainer {
  private services = new Map<string, ServiceDefinition>();
  private singletonInstances = new Map<string, any>();
  private scopedInstances = new Map<string, Map<string, any>>();
  private resolutionStack: string[] = [];
  private currentScope?: ServiceScope;
  private disposed = false;
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger("DIContainer");

    // Register self
    this.registerSingleton("DIContainer", () => this);
    this.registerSingleton("Logger", () => this.logger);
  }

  // Registration methods
  register<T>(_definition: ServiceDefinition<T>): void {
    this.validateNotDisposed();
    this.validateDefinition(_definition);

    if (this.services.has(_definition._token)) {
      this.logger.warn(
        `Service already registered: ${_definition._token}. Overriding.`,
      );
    }

    this.services.set(_definition._token, _definition);

    this.emit("_service:registered", {
      _token: _definition._token,
      lifecycle: _definition.lifecycle,
      metadata: _definition.metadata,
    });

    this.logger.debug(`Registered _service: ${_definition._token}`, {
      lifecycle: _definition.lifecycle,
      _dependencies: _definition.dependencies,
      tags: _definition.metadata.tags,
    });
  }

  registerSingleton<T>(
    token: string,
    implementation: ServiceFactory<T> | ServiceClass<T>,
    _dependencies: string[] = [],
  ): void {
    this.register({
      token,
      implementation,
      lifecycle: "singleton",
      _dependencies,
      metadata: {
        tags: ["singleton"],
        version: "1.0.0",
      },
    });
  }

  registerTransient<T>(
    token: string,
    implementation: ServiceFactory<T> | ServiceClass<T>,
    _dependencies: string[] = [],
  ): void {
    this.register({
      token,
      implementation,
      lifecycle: "transient",
      _dependencies,
      metadata: {
        tags: ["transient"],
        version: "1.0.0",
      },
    });
  }

  registerScoped<T>(
    token: string,
    implementation: ServiceFactory<T> | ServiceClass<T>,
    _dependencies: string[] = [],
  ): void {
    this.register({
      token,
      implementation,
      lifecycle: "scoped",
      _dependencies,
      metadata: {
        tags: ["scoped"],
        version: "1.0.0",
      },
    });
  }

  // Resolution methods
  resolve<T>(token: string): T {
    this.validateNotDisposed();

    // Check for circular dependency
    if (this.resolutionStack.includes(_token)) {
      const _cycle = [...this.resolutionStack, _token].join(" -> ");
      throw new CircularDependencyError(
        `Circular dependency detected: ${_cycle}`,
      );
    }

    this.resolutionStack.push(_token);

    try {
      const _service = this.resolveInternal<T>(_token);

      this.emit("_service:resolved", {
        token,
        resolutionPath: [...this.resolutionStack],
        timestamp: new Date(),
      });

      return _service;
    } finally {
      this.resolutionStack.pop();
    }
  }

  async resolveAsync<T>(token: string): Promise<T> {
    // For now, delegate to synchronous resolve
    // Can be extended for async factories
    return Promise.resolve(this.resolve<T>(_token));
  }

  resolveAll<T>(tag: string): T[] {
    const _definitions = Array.from(this.services.values()).filter((def) =>
      def.metadata.tags.includes(tag),
    );

    return _definitions.map((def) => this.resolve<T>(def._token));
  }

  // Private resolution logic
  private resolveInternal<T>(token: string): T {
    const _definition = this.services.get(_token);

    if (!_definition) {
      throw new ServiceNotFoundError(`Service not found: ${_token}`);
    }

    // Check conditional registration
    if (_definition.metadata.conditional?.condition) {
      if (!_definition.metadata.conditional.condition()) {
        const _fallback = _definition.metadata.conditional._fallback;
        if (_fallback) {
          return this.resolve<T>(_fallback);
        }
        throw new ConditionalServiceError(
          `Conditional _service not available: ${_token}`,
        );
      }
    }

    // Handle different lifecycles
    switch (_definition.lifecycle) {
      case "singleton":
        return this.resolveSingleton<T>(_definition);

      case "scoped":
        return this.resolveScoped<T>(_definition);

      case "request":
        return this.resolveRequest<T>(_definition);

      case "transient":
      default:
        return this.createInstance<T>(_definition);
    }
  }

  private resolveSingleton<T>(_definition: ServiceDefinition<T>): T {
    if (this.singletonInstances.has(_definition._token)) {
      return this.singletonInstances.get(_definition._token);
    }

    const _instance = this.createInstance<T>(_definition);
    this.singletonInstances.set(_definition._token, _instance);

    this.logger.debug(`Created singleton _instance: ${_definition._token}`);
    return _instance;
  }

  private resolveScoped<T>(_definition: ServiceDefinition<T>): T {
    if (!this.currentScope) {
      throw new ScopeError("No active scope for scoped _service resolution");
    }

    const _scopeId = this.currentScope.id;

    if (!this.scopedInstances.has(_scopeId)) {
      this.scopedInstances.set(_scopeId, new Map());
    }

    const _scopeServices = this.scopedInstances.get(_scopeId)!;

    if (_scopeServices.has(_definition._token)) {
      return _scopeServices.get(_definition._token);
    }

    const _instance = this.createInstance<T>(_definition);
    scopeServices.set(_definition._token, _instance);

    this.logger.debug(
      `Created scoped _instance: ${_definition._token} in scope: ${_scopeId}`,
    );
    return _instance;
  }

  private resolveRequest<T>(_definition: ServiceDefinition<T>): T {
    // For now, treat as transient
    // Can be extended for request-specific caching
    return this.createInstance<T>(_definition);
  }

  private createInstance<T>(_definition: ServiceDefinition<T>): T {
    const _startTime = performance.now();

    try {
      // Resolve _dependencies
      const _dependencies = _definition._dependencies.map((dep) =>
        this.resolve(dep),
      );

      let _instance: T;

      if (typeof _definition.implementation === "function") {
        if (_definition.implementation.prototype) {
          // _Constructor function
          const _Constructor = _definition.implementation as ServiceClass<T>;
          _instance = new _Constructor(..._dependencies);
        } else {
          // Factory function
          const _factory = _definition.implementation as ServiceFactory<T>;
          const _result = _factory(this);
          _instance =
            _result instanceof Promise
              ? (() => {
                  throw new Error(
                    "Async factories not supported in sync resolution",
                  );
                })()
              : _result;
        }
      } else {
        throw new InvalidImplementationError(
          `Invalid implementation for ${_definition._token}`,
        );
      }

      // Initialize if implements IInitializable
      if (_instance && typeof (_instance as any).initialize === "function") {
        (_instance as any).initialize();
      }

      const _creationTime = performance.now() - _startTime;

      this.emit("_service:created", {
        _token: _definition._token,
        lifecycle: _definition.lifecycle,
        _creationTime,
        _dependencies: _definition._dependencies,
      });

      this.logger.debug(`Created _instance: ${_definition._token}`, {
        _creationTime: Math.round(_creationTime * 100) / 100,
        _dependencies: _definition._dependencies.length,
      });

      return _instance;
    } catch (error) {
      this.emit("_service:creation_failed", {
        _token: _definition._token,
        error: error.message,
        resolutionStack: [...this.resolutionStack],
      });

      throw new ServiceCreationError(
        `Failed to create _service ${_definition._token}: ${error.message}`,
        error,
      );
    }
  }

  // Scope management
  createScope(): ServiceScope {
    const scope: ServiceScope = {
      id: `scope_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      services: new Map(),
      parent: this.currentScope,
      created: new Date(),
      disposed: false,
    };

    this.currentScope = scope;

    this.emit("scope:created", { _scopeId: scope.id });
    this.logger.debug(`Created new scope: ${scope.id}`);

    return scope;
  }

  disposeScope(scope: ServiceScope): void {
    if (scope.disposed) return;

    // Dispose all services in scope
    for (const [_token, _instance] of scope.services) {
      if (_instance && typeof instance.dispose === "function") {
        try {
          instance.dispose();
        } catch (innerError) {
          this.logger.error(`Error disposing _service ${_token}:`, error);
        }
      }
    }

    scope.services.clear();
    scope.disposed = true;

    // Clean up scoped instances
    this.scopedInstances.delete(scope.id);

    // Restore parent scope
    this.currentScope = scope.parent;

    this.emit("scope:disposed", { _scopeId: scope.id });
    this.logger.debug(`Disposed scope: ${scope.id}`);
  }

  // Utility methods
  isRegistered(token: string): boolean {
    return this.services.has(_token);
  }

  getRegistration(token: string): ServiceDefinition | undefined {
    return this.services.get(_token);
  }

  getAllRegistrations(): ServiceDefinition[] {
    return Array.from(this.services.values());
  }

  // Container lifecycle
  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.logger.info("Disposing DI Container...");

    // Dispose all scoped instances
    for (const scope of this.scopedInstances.keys()) {
      const _scopeServices = this.scopedInstances.get(scope);
      if (_scopeServices) {
        for (const _instance of _scopeServices.values()) {
          if (_instance && typeof _instance.dispose === "function") {
            await Promise.resolve(_instance.dispose()).catch((err) => {
              this.logger.error("Error disposing scoped _service:", err);
            });
          }
        }
      }
    }

    // Dispose singleton instances
    for (const [_token, _instance] of this.singletonInstances) {
      if (_instance && typeof _instance.dispose === "function") {
        try {
          await Promise.resolve(_instance.dispose());
        } catch (error) {
          this.logger.error(`Error disposing singleton ${_token}:`, error);
        }
      }
    }

    // Clear all collections
    this.services.clear();
    this.singletonInstances.clear();
    this.scopedInstances.clear();
    this.resolutionStack = [];
    this.currentScope = undefined;
    this.disposed = true;

    this.emit("container:disposed");
    this.logger.info("DI Container disposed successfully");
  }

  // Validation methods
  private validateNotDisposed(): void {
    if (this.disposed) {
      throw new ContainerDisposedError("Container has been disposed");
    }
  }

  private validateDefinition<T>(_definition: ServiceDefinition<T>): void {
    if (!_definition._token) {
      throw new InvalidServiceDefinitionError("Service token is required");
    }

    if (!_definition.implementation) {
      throw new InvalidServiceDefinitionError(
        "Service implementation is required",
      );
    }

    if (
      !["singleton", "transient", "scoped", "request"].includes(
        _definition.lifecycle,
      )
    ) {
      throw new InvalidServiceDefinitionError(
        `Invalid lifecycle: ${_definition.lifecycle}`,
      );
    }
  }

  // Debug methods
  getDiagnostics(): ContainerDiagnostics {
    return {
      servicesCount: this.services.size,
      singletonInstancesCount: this.singletonInstances.size,
      scopedInstancesCount: Array.from(this.scopedInstances.values()).reduce(
        (sum, scope) => sum + scope.size,
        0,
      ),
      currentScopeId: this.currentScope?.id,
      disposed: this.disposed,
      registeredServices: Array.from(this.services.keys()),
      resolutionStackDepth: this.resolutionStack.length,
    };
  }
}

// Error Classes
export class DIContainerError extends Error {
  constructor(
    _message: string,
    public cause?: Error,
  ) {
    super(_message);
    this.name = "DIContainerError";
  }
}

export class ServiceNotFoundError extends DIContainerError {
  constructor(_message: string) {
    super(_message);
    this.name = "ServiceNotFoundError";
  }
}

export class CircularDependencyError extends DIContainerError {
  constructor(_message: string) {
    super(_message);
    this.name = "CircularDependencyError";
  }
}

export class ServiceCreationError extends DIContainerError {
  constructor(_message: string, cause?: Error) {
    super(_message, cause);
    this.name = "ServiceCreationError";
  }
}

export class ScopeError extends DIContainerError {
  constructor(_message: string) {
    super(_message);
    this.name = "ScopeError";
  }
}

export class ContainerDisposedError extends DIContainerError {
  constructor(_message: string) {
    super(_message);
    this.name = "ContainerDisposedError";
  }
}

export class InvalidServiceDefinitionError extends DIContainerError {
  constructor(_message: string) {
    super(_message);
    this.name = "InvalidServiceDefinitionError";
  }
}

export class InvalidImplementationError extends DIContainerError {
  constructor(_message: string) {
    super(_message);
    this.name = "InvalidImplementationError";
  }
}

export class ConditionalServiceError extends DIContainerError {
  constructor(_message: string) {
    super(_message);
    this.name = "ConditionalServiceError";
  }
}

// Diagnostic interface
export interface ContainerDiagnostics {
  servicesCount: number;
  singletonInstancesCount: number;
  scopedInstancesCount: number;
  currentScopeId?: string;
  disposed: boolean;
  registeredServices: string[];
  resolutionStackDepth: number;
}

// Service interfaces
export interface IInitializable {
  initialize(): void | Promise<void>;
}

export interface IDisposable {
  dispose(): void | Promise<void>;
}

// Decorator factories for future use
export function Injectable(token?: string) {
  return function <
    T extends new (...args: any[]) => {
      // Implementation pending
    },
  >(constructor: T) {
    // Mark class as injectable
    Reflect.defineMetadata("injectable", true, constructor);
    if (_token) {
      Reflect.defineMetadata("_token", _token, constructor);
    }
    return constructor;
  };
}

export function Inject(token: string) {
  return function (
    target: unknown,
    _propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) {
    const existingTokens = Reflect.getMetadata("inject:tokens", target) || [];
    existingTokens[parameterIndex] = _token;
    Reflect.defineMetadata("inject:tokens", existingTokens, target);
  };
}

// Factory function for creating container
export function createContainer(): DIContainer {
  return new DIContainer();
}
