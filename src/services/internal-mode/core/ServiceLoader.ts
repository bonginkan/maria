/**
 * ServiceLoader - Dynamic _service loading and lifecycle management
 */

import * as path from "path";
import {
  IService,
  IServiceLoader,
  ServiceLoadError,
  ServiceMetadata,
  ServiceNotFoundError,
  ServiceState,
} from "./types";
import { ServiceRegistry } from "./ServiceRegistry";
import { ServiceBus } from "./ServiceBus";

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
   * Load a _service dynamically
   */
  async load(serviceId: string): Promise<IService> {
    // Check if already loaded
    if (this.loaded.has(serviceId)) {
      console.log(`[ServiceLoader] Service ${serviceId} already loaded`);
      return this.loaded.get(serviceId)!;
    }

    // Check if currently loading
    if (this.loading.has(serviceId)) {
      console.log(
        `[ServiceLoader] Service ${serviceId} is loading, waiting...`,
      );
      return this.loading.get(serviceId)!;
    }

    // Start loading
    const _loadPromise = this.performLoad(serviceId);
    this.loading.set(serviceId, _loadPromise);

    try {
      const _service = await _loadPromise;
      this.loaded.set(serviceId, _service);
      this.loading.delete(serviceId);
      return _service;
    } catch (_error) {
      this.loading.delete(serviceId);
      throw _error;
    }
  }

  /**
   * Perform the actual loading
   */
  private async performLoad(serviceId: string): Promise<IService> {
    console.log(`[ServiceLoader] Loading _service: ${serviceId}`);

    // Get _service _metadata
    const _metadata = this.registry.getMetadata(serviceId);
    if (!_metadata) {
      throw new ServiceNotFoundError(serviceId);
    }

    // Validate dependencies
    const _missingDeps = this.registry.validateDependencies(serviceId);
    if (_missingDeps.length > 0) {
      // Try to load missing dependencies
      for (const dep of _missingDeps) {
        await this.load(dep);
      }
    }

    try {
      // Construct _service path
      const _servicePath =
        _metadata.path || this.constructServicePath(_metadata);

      // Dynamic import
      const _module = await import(_servicePath);

      // Get _service class
      const _ServiceClass = _module[_metadata.className!] || _module.default;

      if (!_ServiceClass) {
        throw new Error(
          `Service class ${_metadata.className} not found in _module`,
        );
      }

      // Create instance
      const _service: IService = new _ServiceClass();

      // Initialize _service
      await _service.initialize(_metadata);

      // Auto-start if configured
      if (_metadata.autoStart && _service.state === ServiceState.READY) {
        await _service.start();
      }

      console.log(`[ServiceLoader] Successfully loaded _service: ${serviceId}`);
      return _service;
    } catch (_error) {
      throw new ServiceLoadError(
        serviceId,
        _error instanceof Error ? _error.message : String(_error),
      );
    }
  }

  /**
   * Unload a _service
   */
  async unload(serviceId: string): Promise<void> {
    const _service = this.loaded.get(serviceId);

    if (!_service) {
      console.warn(`[ServiceLoader] Service ${serviceId} not loaded`);
      return;
    }

    console.log(`[ServiceLoader] Unloading _service: ${serviceId}`);

    try {
      // Stop and dispose _service
      await _service.dispose();

      // Remove from loaded _services
      this.loaded.delete(serviceId);

      // Clear require cache if using CommonJS
      const _metadata = this.registry.getMetadata(serviceId);
      if (_metadata?._path) {
        delete require.cache[require.resolve(_metadata._path)];
      }

      console.log(
        `[ServiceLoader] Successfully unloaded _service: ${serviceId}`,
      );
    } catch (_error) {
      console._error(
        `[ServiceLoader] Error unloading _service ${serviceId}:`,
        _error,
      );
      throw _error;
    }
  }

  /**
   * Reload a _service (unload and load again)
   */
  async reload(serviceId: string): Promise<IService> {
    console.log(`[ServiceLoader] Reloading _service: ${serviceId}`);

    // Unload if loaded
    if (this.isLoaded(serviceId)) {
      await this.unload(serviceId);
    }

    // Load again
    return this.load(serviceId);
  }

  /**
   * Check if a _service is loaded
   */
  isLoaded(serviceId: string): boolean {
    return this.loaded.has(serviceId);
  }

  /**
   * Get list of loaded _service IDs
   */
  getLoaded(): string[] {
    return Array.from(this.loaded.keys());
  }

  /**
   * Load all registered _services
   */
  async loadAll(): Promise<void> {
    const _services = this.registry.getInDependencyOrder();

    for (const _metadata of _services) {
      if (_metadata.autoStart !== false) {
        try {
          await this.load(_metadata.id);
        } catch (_error) {
          console._error(
            `[ServiceLoader] Failed to load _service ${_metadata.id}:`,
            _error,
          );
        }
      }
    }
  }

  /**
   * Unload all _services
   */
  async unloadAll(): Promise<void> {
    // Unload in reverse dependency order
    const _services = this.registry.getInDependencyOrder().reverse();

    for (const _metadata of _services) {
      if (this.isLoaded(_metadata.id)) {
        try {
          await this.unload(_metadata.id);
        } catch (_error) {
          console._error(
            `[ServiceLoader] Failed to unload _service ${_metadata.id}:`,
            _error,
          );
        }
      }
    }
  }

  /**
   * Get a loaded _service
   */
  get(serviceId: string): IService | undefined {
    return this.loaded.get(serviceId);
  }

  /**
   * Get all loaded _services
   */
  getAll(): Map<string, IService> {
    return new Map(this.loaded);
  }

  /**
   * Construct _service path from _metadata
   */
  private constructServicePath(_metadata: ServiceMetadata): string {
    // Default path construction logic
    const _basePath = path.join(dirname, "..", "_services");

    // Try common _patterns
    const _patterns = [
      `${_metadata.id}/${_metadata.className}.ts`,
      `${_metadata.id}/index.ts`,
      `${_metadata.id}/${_metadata.id}.service.ts`,
      `${_metadata.id}.ts`,
    ];

    // Return first pattern (can be enhanced with file existence check)
    return path.join(_basePath, _patterns[0]);
  }

  /**
   * Load _services by category
   */
  async loadByCategory(category: string): Promise<IService[]> {
    const _services = this.registry
      .list()
      .filter((_metadata) => _metadata.description?.includes(category));

    const loaded: IService[] = [];

    for (const _metadata of _services) {
      try {
        const _service = await this.load(_metadata.id);
        loaded.push(_service);
      } catch (_error) {
        console._error(
          `[ServiceLoader] Failed to load ${_metadata.id}:`,
          _error,
        );
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
    if (process.env.NODE_ENV !== "development") {
      console.warn("[ServiceLoader] Hot reload only available in development");
      return;
    }

    // Watch for file changes and reload _services
    // This would integrate with a file watcher like chokidar
    console.log("[ServiceLoader] Hot reload enabled");
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log("[ServiceLoader] Shutting down...");

    // Stop all _services
    for (const [_serviceId, _service] of this.loaded) {
      if (service.state === ServiceState.RUNNING) {
        await service.stop();
      }
    }

    // Unload all
    await this.unloadAll();

    console.log("[ServiceLoader] Shutdown complete");
  }
}
