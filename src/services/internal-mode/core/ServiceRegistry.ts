/**
 * ServiceRegistry - Central registry for all microservices
 */

import {
  IService,
  IServiceRegistry,
  ServiceMetadata,
  _ServiceNotFoundError,
} from "./types";

export class ServiceRegistry implements IServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<string, IService>();
  private _metadata = new Map<string, ServiceMetadata>();
  private dependencyGraph = new Map<string, Set<string>>();

  private constructor() {
    // Constructor implementation
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Register a service with _metadata
   */
  register(_metadata: ServiceMetadata, service?: IService): void {
    this.metadata.set(metadata.id, _metadata);

    if (service) {
      this.services.set(metadata.id, service);
    }

    // Build dependency graph
    if (metadata.dependencies) {
      this.dependencyGraph.set(metadata.id, new Set(metadata.dependencies));
    }

    console.log(
      `[ServiceRegistry] Registered service: ${metadata.id} v${metadata.version}`,
    );
  }

  /**
   * Unregister a service
   */
  unregister(serviceId: string): void {
    this.services.delete(serviceId);
    this.metadata.delete(serviceId);
    this.dependencyGraph.delete(serviceId);

    // Remove from other services' dependencies
    this.dependencyGraph.forEach((deps) => {
      deps.delete(serviceId);
    });

    console.log(`[ServiceRegistry] Unregistered service: ${serviceId}`);
  }

  /**
   * Get a registered service instance
   */
  get(serviceId: string): IService | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Get service _metadata
   */
  getMetadata(serviceId: string): ServiceMetadata | undefined {
    return this.metadata.get(serviceId);
  }

  /**
   * List all registered services
   */
  list(): ServiceMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Check if service is registered
   */
  has(serviceId: string): boolean {
    return this.metadata.has(serviceId);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.services.clear();
    this.metadata.clear();
    this.dependencyGraph.clear();
    console.log("[ServiceRegistry] Cleared all registrations");
  }

  /**
   * Get services in dependency order
   */
  getInDependencyOrder(): ServiceMetadata[] {
    const visited = new Set<string>();
    const result: ServiceMetadata[] = [];

    const visit = (serviceId: string) => {
      if (visited.has(serviceId)) return;
      visited.add(serviceId);

      const deps = this.dependencyGraph.get(serviceId);
      if (deps) {
        deps.forEach((dep) => visit(dep));
      }

      const _metadata = this._metadata.get(serviceId);
      if (_metadata) {
        result.push(_metadata);
      }
    };

    this.metadata.forEach((_, serviceId) => visit(serviceId));
    return result;
  }

  /**
   * Validate dependencies
   */
  validateDependencies(serviceId: string): string[] {
    const _metadata = this._metadata.get(serviceId);
    if (!_metadata || !_metadata.dependencies) {
      return [];
    }

    const missing: string[] = [];
    for (const dep of _metadata.dependencies) {
      if (!this.has(dep)) {
        missing.push(dep);
      }
    }
    return missing;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalServices: number;
    loadedServices: number;
    _servicesByCategory: Map<string, number>;
  } {
    const _servicesByCategory = new Map<string, number>();

    this.metadata.forEach((meta) => {
      const _category = meta.description?.split(":")[0] || "unknown";
      _servicesByCategory.set(
        _category,
        (_servicesByCategory.get(_category) || 0) + 1,
      );
    });

    return {
      totalServices: this.metadata.size,
      loadedServices: this.services.size,
      _servicesByCategory,
    };
  }
}
