/**
 * ServiceLoader - Dynamic service loading and lifecycle management
 */

import * as path from 'path';
import {
  IService,
  IServiceLoader,
  ServiceLoadError,
  ServiceMetadata,
  ServiceNotFoundError,
  ServiceState,
} from './types';
import { ServiceRegistry } from './ServiceRegistry';
import { ServiceBus } from './ServiceBus';

export class ServiceLoader implements IServiceLoader {
  private static instance: ServiceLoader;
  private loaded = new Map<string, IService>();
  private loading = new Map<string, Promise<IService>>();
  private registry: ServiceRegistry;
  private bus: ServiceBus;

  private constructor() {
    this.registry = ServiceRegistry.getInstance();
    this.bus = ServiceBus.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceLoader {
    if (!ServiceLoader.instance) {
      ServiceLoader.instance = new ServiceLoader();
    }
    return ServiceLoader.instance;
  }

  /**
   * Load a service dynamically
   */
  async load(serviceId: string): Promise<IService> {
    // Check if already loaded
    if (this.loaded.has(serviceId)) {
      console.log(`[ServiceLoader] Service ${serviceId} already loaded`);
      return this.loaded.get(serviceId)!;
    }

    // Check if currently loading
    if (this.loading.has(serviceId)) {
      console.log(`[ServiceLoader] Service ${serviceId} is loading, waiting...`);
      return this.loading.get(serviceId)!;
    }

    // Start loading
    const loadPromise = this.performLoad(serviceId);
    this.loading.set(serviceId, loadPromise);

    try {
      const service = await loadPromise;
      this.loaded.set(serviceId, service);
      this.loading.delete(serviceId);
      return service;
    } catch (error) {
      this.loading.delete(serviceId);
      throw error;
    }
  }

  /**
   * Perform the actual loading
   */
  private async performLoad(serviceId: string): Promise<IService> {
    console.log(`[ServiceLoader] Loading service: ${serviceId}`);

    // Get service metadata
    const metadata = this.registry.getMetadata(serviceId);
    if (!metadata) {
      throw new ServiceNotFoundError(serviceId);
    }

    // Validate dependencies
    const missingDeps = this.registry.validateDependencies(serviceId);
    if (missingDeps.length > 0) {
      // Try to load missing dependencies
      for (const dep of missingDeps) {
        await this.load(dep);
      }
    }

    try {
      // Construct service path
      const servicePath = metadata.path || this.constructServicePath(metadata);

      // Dynamic import
      const module = await import(servicePath);

      // Get service class
      const ServiceClass = module[metadata.className!] || module.default;

      if (!ServiceClass) {
        throw new Error(`Service class ${metadata.className} not found in module`);
      }

      // Create instance
      const service: IService = new ServiceClass();

      // Initialize service
      await service.initialize(metadata);

      // Auto-start if configured
      if (metadata.autoStart && service.state === ServiceState.READY) {
        await service.start();
      }

      console.log(`[ServiceLoader] Successfully loaded service: ${serviceId}`);
      return service;
    } catch (error) {
      throw new ServiceLoadError(serviceId, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Unload a service
   */
  async unload(serviceId: string): Promise<void> {
    const service = this.loaded.get(serviceId);

    if (!service) {
      console.warn(`[ServiceLoader] Service ${serviceId} not loaded`);
      return;
    }

    console.log(`[ServiceLoader] Unloading service: ${serviceId}`);

    try {
      // Stop and dispose service
      await service.dispose();

      // Remove from loaded services
      this.loaded.delete(serviceId);

      // Clear require cache if using CommonJS
      const metadata = this.registry.getMetadata(serviceId);
      if (metadata?.path) {
        delete require.cache[require.resolve(metadata.path)];
      }

      console.log(`[ServiceLoader] Successfully unloaded service: ${serviceId}`);
    } catch (error) {
      console.error(`[ServiceLoader] Error unloading service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Reload a service (unload and load again)
   */
  async reload(serviceId: string): Promise<IService> {
    console.log(`[ServiceLoader] Reloading service: ${serviceId}`);

    // Unload if loaded
    if (this.isLoaded(serviceId)) {
      await this.unload(serviceId);
    }

    // Load again
    return this.load(serviceId);
  }

  /**
   * Check if a service is loaded
   */
  isLoaded(serviceId: string): boolean {
    return this.loaded.has(serviceId);
  }

  /**
   * Get list of loaded service IDs
   */
  getLoaded(): string[] {
    return Array.from(this.loaded.keys());
  }

  /**
   * Load all registered services
   */
  async loadAll(): Promise<void> {
    const services = this.registry.getInDependencyOrder();

    for (const metadata of services) {
      if (metadata.autoStart !== false) {
        try {
          await this.load(metadata.id);
        } catch (error) {
          console.error(`[ServiceLoader] Failed to load service ${metadata.id}:`, error);
        }
      }
    }
  }

  /**
   * Unload all services
   */
  async unloadAll(): Promise<void> {
    // Unload in reverse dependency order
    const services = this.registry.getInDependencyOrder().reverse();

    for (const metadata of services) {
      if (this.isLoaded(metadata.id)) {
        try {
          await this.unload(metadata.id);
        } catch (error) {
          console.error(`[ServiceLoader] Failed to unload service ${metadata.id}:`, error);
        }
      }
    }
  }

  /**
   * Get a loaded service
   */
  get(serviceId: string): IService | undefined {
    return this.loaded.get(serviceId);
  }

  /**
   * Get all loaded services
   */
  getAll(): Map<string, IService> {
    return new Map(this.loaded);
  }

  /**
   * Construct service path from metadata
   */
  private constructServicePath(metadata: ServiceMetadata): string {
    // Default path construction logic
    const basePath = path.join(__dirname, '..', 'services');

    // Try common patterns
    const patterns = [
      `${metadata.id}/${metadata.className}.ts`,
      `${metadata.id}/index.ts`,
      `${metadata.id}/${metadata.id}.service.ts`,
      `${metadata.id}.ts`,
    ];

    // Return first pattern (can be enhanced with file existence check)
    return path.join(basePath, patterns[0]);
  }

  /**
   * Load services by category
   */
  async loadByCategory(category: string): Promise<IService[]> {
    const services = this.registry
      .list()
      .filter((metadata) => metadata.description?.includes(category));

    const loaded: IService[] = [];

    for (const metadata of services) {
      try {
        const service = await this.load(metadata.id);
        loaded.push(service);
      } catch (error) {
        console.error(`[ServiceLoader] Failed to load ${metadata.id}:`, error);
      }
    }

    return loaded;
  }

  /**
   * Get loader statistics
   */
  getStats(): {
    loaded: number;
    loading: number;
    registered: number;
    memoryUsage: NodeJS.MemoryUsage;
  } {
    return {
      loaded: this.loaded.size,
      loading: this.loading.size,
      registered: this.registry.list().length,
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Hot reload support for development
   */
  async enableHotReload(): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('[ServiceLoader] Hot reload only available in development');
      return;
    }

    // Watch for file changes and reload services
    // This would integrate with a file watcher like chokidar
    console.log('[ServiceLoader] Hot reload enabled');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[ServiceLoader] Shutting down...');

    // Stop all services
    for (const [serviceId, service] of this.loaded) {
      if (service.state === ServiceState.RUNNING) {
        await service.stop();
      }
    }

    // Unload all
    await this.unloadAll();

    console.log('[ServiceLoader] Shutdown complete');
  }
}
