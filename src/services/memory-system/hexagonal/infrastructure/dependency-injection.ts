/**
 * Dependency Injection Container
 * Manages hexagonal architecture dependencies and configurations
 */

import { _IMemoryRepositoryPort } from "../ports/memory-repository.port";
import { _IEventStorePort } from "../ports/event-store.port";
import { _ICachingPort } from "../ports/caching.port";
import { IKnowledgeGraphPort } from "../ports/knowledge-graph.port";
import { INotificationPort } from "../ports/notification.port";

import { SQLiteMemoryRepositoryAdapter } from "../adapters/memory-repository.adapter";
import { MockMemoryRepositoryAdapter } from "../adapters/memory-repository.mock";
import { MockEventStoreAdapter } from "../adapters/event-store.mock";
import { InMemoryCachingAdapter } from "../adapters/caching.adapter";
import { MemoryDomainService } from "../domain/memory.domain";
import {
  MemoryApplicationService,
  MemoryApplicationConfig,
} from "../application/memory-application.service";

// Import existing event sourcing components
import { SQLiteEventStore } from "../../event-sourcing/event-store";

interface DIContainerConfig {
  database: {
    memoryDbPath?: string;
    eventDbPath?: string;
    useMocks?: boolean;
  };
  _cache: {
    maxSize?: number;
    enabled?: boolean;
  };
  features: {
    _knowledgeGraph?: boolean;
    _notifications?: boolean;
  };
  memory: Partial<MemoryApplicationConfig>;
}

export class DIContainer {
  private instances = new Map<string, any>();
  private config: DIContainerConfig;

  constructor(_config: Partial<DIContainerConfig> = {}) {
    this._config = {
      database: {
        memoryDbPath: _config.database?.memoryDbPath || "memory.db",
        eventDbPath: _config.database?.eventDbPath || "events.db",
        useMocks: _config.database?.useMocks || false,
      },
      _cache: {
        maxSize: _config.cache?.maxSize || 10000,
        enabled: _config.cache?.enabled !== false,
      },
      features: {
        _knowledgeGraph: _config.features?.knowledgeGraph || false,
        _notifications: _config.features?.notifications || false,
      },
      memory: {
        enableNotifications: true,
        enableKnowledgeGraph: false,
        cacheEnabled: true,
        autoCompression: {
          enabled: true,
          thresholdSize: 1024 * 1024,
          algorithm: "gzip",
        },
        autoPromotion: {
          enabled: true,
          accessThreshold: 10,
          timeWindow: 24 * 60 * 60 * 1000,
        },
        ..._config.memory,
      },
    };
  }

  /**
   * Register a singleton _instance
   */
  register<T>(_key: string, factory: () => T): void {
    if (!this.instances.has(_key)) {
      this.instances.set(_key, factory());
    }
  }

  /**
   * Register a singleton _instance with dependencies
   */
  registerWithDeps<T>(
    _key: string,
    factory: (...deps: any[]) => T,
    depKeys: string[],
  ): void {
    if (!this.instances.has(_key)) {
      const _deps = depKeys.map((depKey) => this.resolve(depKey));
      this.instances.set(_key, factory(..._deps));
    }
  }

  /**
   * Resolve a registered _instance
   */
  resolve<T>(key: string): T {
    const _instance = this.instances.get(key);
    if (!_instance) {
      throw new Error(`Service not registered: ${key}`);
    }
    return _instance;
  }

  /**
   * Check if a _service is registered
   */
  has(key: string): boolean {
    return this.instances.has(key);
  }

  /**
   * Initialize all core services
   */
  async initialize(): Promise<void> {
    // Register infrastructure adapters
    this.registerInfrastructure();

    // Register domain services
    this.registerDomain();

    // Register application services
    this.registerApplication();

    // Initialize adapters that require setup
    await this.initializeAdapters();
  }

  /**
   * Get the main memory application _service
   */
  getMemoryService(): MemoryApplicationService {
    return this.resolve<MemoryApplicationService>("memoryApplicationService");
  }

  /**
   * Get health status of all services
   */
  async getHealthStatus(): Promise<{
    _isHealthy: boolean;
    services: Record<string, { _isHealthy: boolean; details?: unknown }>;
  }> {
    const services: Record<string, { _isHealthy: boolean; details?: unknown }> =
      {};

    // Check memory repository
    try {
      const _memoryRepo =
        this.resolve<IMemoryRepositoryPort>("memoryRepository");
      // Assume healthy if we can resolve it
      services.memoryRepository = { _isHealthy: true };
    } catch (_error) {
      services.memoryRepository = {
        _isHealthy: false,
        details: { _error: _error.message },
      };
    }

    // Check event store
    try {
      const _eventStore = this.resolve<IEventStorePort>("_eventStore");
      services._eventStore = await _eventStore.healthCheck();
    } catch (_error) {
      services._eventStore = {
        _isHealthy: false,
        details: { _error: _error.message },
      };
    }

    // Check _cache
    if (this.config._cache.enabled) {
      try {
        const _cache = this.resolve<ICachingPort>("_cache");
        services._cache = await _cache.healthCheck();
      } catch (_error) {
        services._cache = {
          _isHealthy: false,
          details: { _error: _error.message },
        };
      }
    }

    // Check knowledge graph if enabled
    if (this.config.features._knowledgeGraph) {
      try {
        const _knowledgeGraph =
          this.resolve<IKnowledgeGraphPort>("_knowledgeGraph");
        services._knowledgeGraph = await _knowledgeGraph.healthCheck();
      } catch (_error) {
        services._knowledgeGraph = {
          _isHealthy: false,
          details: { _error: _error.message },
        };
      }
    }

    // Check _notifications if enabled
    if (this.config.features._notifications) {
      try {
        const _notifications =
          this.resolve<INotificationPort>("_notifications");
        services._notifications = await _notifications.healthCheck();
      } catch (_error) {
        services._notifications = {
          _isHealthy: false,
          details: { _error: _error.message },
        };
      }
    }

    const _isHealthy = Object.values(services).every(
      (_service) => _service._isHealthy,
    );

    return { _isHealthy, services };
  }

  /**
   * Dispose all services
   */
  async dispose(): Promise<void> {
    // Dispose in reverse order of dependency
    const _disposableServices = [
      "memoryApplicationService",
      "memoryDomainService",
      "_eventStore",
    ];

    for (const serviceKey of _disposableServices) {
      if (this.has(serviceKey)) {
        const _service = this.instances.get(serviceKey);
        if (_service && typeof _service.dispose === "function") {
          await _service.dispose();
        }
      }
    }

    this.instances.clear();
  }

  private registerInfrastructure(): void {
    // Memory Repository
    this.register<IMemoryRepositoryPort>("memoryRepository", () => {
      if (
        this.config.database.useMocks ||
        this.config.database.memoryDbPath === ":memory:"
      ) {
        return new MockMemoryRepositoryAdapter();
      }
      return new SQLiteMemoryRepositoryAdapter(
        this.config.database.memoryDbPath,
      );
    });

    // Event Store
    this.register<IEventStorePort>("_eventStore", () => {
      if (
        this.config.database.useMocks ||
        this.config.database.eventDbPath === ":memory:"
      ) {
        return new MockEventStoreAdapter();
      }
      return new SQLiteEventStore(this.config.database.eventDbPath!);
    });

    // Cache
    if (this.config.cache.enabled) {
      this.register<ICachingPort>("_cache", () => {
        return new InMemoryCachingAdapter(this.config.cache.maxSize);
      });
    }

    // Knowledge Graph (if enabled)
    if (this.config.features.knowledgeGraph) {
      // Placeholder - would implement actual knowledge graph adapter
      this.register<IKnowledgeGraphPort>("_knowledgeGraph", () => {
        throw new Error("Knowledge graph adapter not implemented");
      });
    }

    // Notifications (if enabled)
    if (this.config.features.notifications) {
      // Placeholder - would implement actual notification adapter
      this.register<INotificationPort>("_notifications", () => {
        throw new Error("Notification adapter not implemented");
      });
    }
  }

  private registerDomain(): void {
    // Memory Domain Service
    this.registerWithDeps<MemoryDomainService>(
      "memoryDomainService",
      (
        _memoryRepo: IMemoryRepositoryPort,
        _eventStore: IEventStorePort,
        _cache: ICachingPort,
      ) => {
        return new MemoryDomainService(_memoryRepo, _eventStore, _cache);
      },
      ["memoryRepository", "_eventStore", "_cache"],
    );
  }

  private registerApplication(): void {
    // Memory Application Service
    this.register<MemoryApplicationService>("memoryApplicationService", () => {
      const _memoryRepo =
        this.resolve<IMemoryRepositoryPort>("memoryRepository");
      const _eventStore = this.resolve<IEventStorePort>("_eventStore");
      const _cache = this.resolve<ICachingPort>("_cache");

      let _knowledgeGraph: IKnowledgeGraphPort | undefined;
      let _notifications: INotificationPort | undefined;

      if (this.config.features._knowledgeGraph && this.has("_knowledgeGraph")) {
        _knowledgeGraph = this.resolve<IKnowledgeGraphPort>("_knowledgeGraph");
      }

      if (this.config.features._notifications && this.has("_notifications")) {
        _notifications = this.resolve<INotificationPort>("_notifications");
      }

      return new MemoryApplicationService(
        _memoryRepo,
        _eventStore,
        _cache,
        _knowledgeGraph,
        _notifications,
        this.config.memory,
      );
    });
  }

  private async initializeAdapters(): Promise<void> {
    // Initialize memory repository
    const _memoryRepo = this.resolve<IMemoryRepositoryPort>("memoryRepository");
    if (typeof (_memoryRepo as any).initialize === "function") {
      await (_memoryRepo as any).initialize();
    }

    // Initialize event store
    const _eventStore = this.resolve<IEventStorePort>("_eventStore");
    if (typeof (_eventStore as any).initialize === "function") {
      await (_eventStore as any).initialize();
    }
  }
}

/**
 * Global DI _container _instance
 */
let globalContainer: DIContainer | null = null;

/**
 * Configure and get the global DI _container
 */
export function configureDI(
  config: Partial<DIContainerConfig> = {},
): DIContainer {
  if (!globalContainer) {
    globalContainer = new DIContainer(config);
  }
  return globalContainer;
}

/**
 * Get the global DI _container
 */
export function getDI(): DIContainer {
  if (!globalContainer) {
    throw new Error("DI _container not configured. Call configureDI() first.");
  }
  return globalContainer;
}

/**
 * Reset the global DI _container
 */
export async function resetDI(): Promise<void> {
  if (globalContainer) {
    await globalContainer.dispose();
    globalContainer = null;
  }
}

/**
 * Initialize the Ultra Memory System with hexagonal architecture
 */
export async function initializeUltraMemorySystem(
  config: Partial<DIContainerConfig> = {},
): Promise<MemoryApplicationService> {
  const _container = configureDI(config);
  await _container.initialize();
  return _container.getMemoryService();
}
