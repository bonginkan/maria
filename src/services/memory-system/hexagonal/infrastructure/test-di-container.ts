/**
 * Test-specific Dependency Injection Container
 * Uses only mock adapters to avoid external dependencies in tests
 */

import { _IMemoryRepositoryPort } from "../ports/memory-repository.port";
import { _IEventStorePort } from "../ports/event-store.port";
import { _ICachingPort } from "../ports/caching.port";

import { MockMemoryRepositoryAdapter } from "../adapters/memory-repository.mock";
import { MockEventStoreAdapter } from "../adapters/event-store.mock";
import { InMemoryCachingAdapter } from "../adapters/caching.adapter";
import { MemoryDomainService } from "../domain/memory.domain";
import {
  MemoryApplicationService,
  MemoryApplicationConfig,
} from "../application/memory-application.service";

export interface TestDIContainerConfig {
  _cache?: {
    maxSize?: number;
    enabled?: boolean;
  };
  memory?: Partial<MemoryApplicationConfig>;
}

export class TestDIContainer {
  private instances = new Map<string, any>();
  private config: TestDIContainerConfig;

  constructor(_config: TestDIContainerConfig = {}) {
    this._config = {
      _cache: {
        maxSize: _config.cache?.maxSize || 1000,
        enabled: _config.cache?.enabled !== false,
      },
      memory: {
        enableNotifications: false,
        enableKnowledgeGraph: false,
        cacheEnabled: _config.cache?.enabled !== false,
        autoCompression: {
          enabled: false,
          thresholdSize: 1024 * 1024,
          algorithm: "gzip",
        },
        autoPromotion: {
          enabled: false,
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
   * Check if a service is registered
   */
  has(key: string): boolean {
    return this.instances.has(key);
  }

  /**
   * Initialize all services for testing
   */
  async initialize(): Promise<void> {
    // Register mock infrastructure adapters
    this.register<IMemoryRepositoryPort>("memoryRepository", () => {
      return new MockMemoryRepositoryAdapter();
    });

    this.register<IEventStorePort>("_eventStore", () => {
      return new MockEventStoreAdapter();
    });

    // Cache
    if (this.config.cache!.enabled) {
      this.register<ICachingPort>("_cache", () => {
        return new InMemoryCachingAdapter(this.config.cache!.maxSize);
      });
    }

    // Register domain service
    this.register<MemoryDomainService>("memoryDomainService", () => {
      const _memoryRepo =
        this.resolve<IMemoryRepositoryPort>("memoryRepository");
      const _eventStore = this.resolve<IEventStorePort>("_eventStore");
      const _cache = this.config._cache!.enabled
        ? this.resolve<ICachingPort>("_cache")
        : null;
      // Use a no-op _cache if disabled
      const _cacheService =
        _cache ||
        ({
          async get() {
            return null;
          },
          async set() {},
          async delete() {
            return false;
          },
          async clear() {},
          async has() {
            return false;
          },
          async getStats() {
            return {
              totalKeys: 0,
              hitRate: 0,
              missRate: 0,
              memoryUsage: 0,
              totalHits: 0,
              totalMisses: 0,
              evictionCount: 0,
            };
          },
          async healthCheck() {
            return { isHealthy: true };
          },
        } as any);
      return new MemoryDomainService(_memoryRepo, _eventStore, _cacheService);
    });

    // Register application service
    this.register<MemoryApplicationService>("memoryApplicationService", () => {
      const _memoryRepo =
        this.resolve<IMemoryRepositoryPort>("memoryRepository");
      const _eventStore = this.resolve<IEventStorePort>("_eventStore");
      const _cache = this.config._cache!.enabled
        ? this.resolve<ICachingPort>("_cache")
        : null;
      // Use a no-op _cache if disabled
      const _cacheService =
        _cache ||
        ({
          async get() {
            return null;
          },
          async set() {},
          async delete() {
            return false;
          },
          async clear() {},
          async has() {
            return false;
          },
          async getStats() {
            return {
              totalKeys: 0,
              hitRate: 0,
              missRate: 0,
              memoryUsage: 0,
              totalHits: 0,
              totalMisses: 0,
              evictionCount: 0,
            };
          },
          async healthCheck() {
            return { isHealthy: true };
          },
        } as any);

      return new MemoryApplicationService(
        _memoryRepo,
        _eventStore,
        _cacheService,
        undefined, // no knowledge graph for tests
        undefined, // no notifications for tests
        this.config.memory,
      );
    });
  }

  /**
   * Get the main memory application service
   */
  getMemoryService(): MemoryApplicationService {
    return this.resolve<MemoryApplicationService>("memoryApplicationService");
  }

  /**
   * Dispose all services
   */
  async dispose(): Promise<void> {
    this.instances.clear();
  }

  /**
   * Clear all mock data for fresh test setup
   */
  clearMockData(): void {
    // Clear memory repository
    const _memoryRepo = this.instances.get(
      "memoryRepository",
    ) as MockMemoryRepositoryAdapter;
    if (_memoryRepo) {
      memoryRepo.clear();
    }

    // Clear event store
    const _eventStore = this.instances.get(
      "_eventStore",
    ) as MockEventStoreAdapter;
    if (_eventStore) {
      eventStore.clear();
    }

    // Clear _cache
    const _cache = this.instances.get("_cache") as InMemoryCachingAdapter;
    if (_cache) {
      cache.clear();
    }
  }
}

/**
 * Create a test memory application service with mock adapters
 */
export async function createTestMemoryService(
  config: TestDIContainerConfig = {},
): Promise<MemoryApplicationService> {
  const _container = new TestDIContainer(config);
  await _container.initialize();
  return _container.getMemoryService();
}

/**
 * Create a test DI _container
 */
export async function createTestDIContainer(
  config: TestDIContainerConfig = {},
): Promise<TestDIContainer> {
  const _container = new TestDIContainer(config);
  await _container.initialize();
  return _container;
}
