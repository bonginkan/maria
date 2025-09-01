/**
 * CQRS Service - Main orchestrator for CQRS pattern
 * Provides high-level API for _command and _query operations
 */

import { EventEmitter } from "node:events";
import { Mediator, MediatorConfig } from "./mediator";
import {
  InMemoryReadModelStore,
  MemoryProjection,
  StatisticsProjection,
} from "./read-models";
import { CommandFactory } from "./commands";
import { QueryFactory } from "./queries";
import {
  StoreMemoryCommandHandler,
  CompressContextCommandHandler,
  PromoteMemoryCommandHandler,
  EvictMemoryCommandHandler,
  LearnPatternCommandHandler,
  UpdateKnowledgeGraphCommandHandler,
  CommandHandlerRegistry,
} from "./_command-handlers";
import {
  GetMemoryByIdQueryHandler,
  FindMemoriesByTypeQueryHandler,
  FindMemoriesByTierQueryHandler,
  SearchMemoriesQueryHandler,
  GetMostAccessedMemoriesQueryHandler,
  GetMemoryStatisticsQueryHandler,
  GetMemoryUsageByTierQueryHandler,
  GetMemoryAccessPatternsQueryHandler,
  GetKnowledgeGraphQueryHandler,
  GetCompressionStatisticsQueryHandler,
  GetMemoryHealthQueryHandler,
  GetEventHistoryQueryHandler,
  QueryHandlerRegistry,
} from "./_query-handlers";
import { Command, Query, CommandResult, QueryResult } from "./interfaces";
import { DomainEvent } from "../event-sourcing/domain-event";
import { _MemoryAggregate } from "../event-sourcing/aggregate-root";
import { _EventStore } from "../event-sourcing/event-store";

/**
 * CQRS Service configuration
 */
export interface CQRSServiceConfig {
  mediator?: MediatorConfig;
  enableProjections?: boolean;
  enableStatistics?: boolean;
  enableCaching?: boolean;
  cacheTimeoutMs?: number;
}

/**
 * CQRS Service metrics
 */
export interface CQRSServiceMetrics {
  commandsExecuted: number;
  queriesExecuted: number;
  commandFailures: number;
  queryFailures: number;
  averageCommandTime: number;
  averageQueryTime: number;
  cacheHitRatio: number;
  lastReset: Date;
}

/**
 * Main CQRS Service implementation
 * Orchestrates commands, queries, and read model projections
 */
export class CQRSService extends EventEmitter {
  private readonly mediator: Mediator;
  private readonly readModelStore: InMemoryReadModelStore;
  private readonly memoryProjection: MemoryProjection;
  private readonly statisticsProjection: StatisticsProjection;
  private readonly commandHandlerRegistry: CommandHandlerRegistry;
  private readonly queryHandlerRegistry: QueryHandlerRegistry;
  private readonly config: Required<CQRSServiceConfig>;

  private isInitialized = false;
  private metrics: CQRSServiceMetrics;

  constructor(
    private readonly eventStore: EventStore,
    private readonly memoryRepository: unknown, // MemoryRepository
    config: CQRSServiceConfig = {},
  ) {
    super();

    // Set default configuration
    this.config = {
      mediator: config.mediator || object,
      enableProjections: config.enableProjections ?? true,
      enableStatistics: config.enableStatistics ?? true,
      enableCaching: config.enableCaching ?? true,
      cacheTimeoutMs: config.cacheTimeoutMs || 300000, // 5 minutes
    };

    // Initialize read model store
    this.readModelStore = new InMemoryReadModelStore();

    // Initialize projections
    this.memoryProjection = new MemoryProjection(this.readModelStore);
    this.statisticsProjection = new StatisticsProjection(this.readModelStore);

    // Initialize registries
    this.commandHandlerRegistry = new CommandHandlerRegistry();
    this.queryHandlerRegistry = new QueryHandlerRegistry();

    // Initialize mediator
    this.mediator = new Mediator(
      this.commandHandlerRegistry,
      this.queryHandlerRegistry,
      this.config.mediator,
    );

    // Initialize metrics
    this.metrics = this.createInitialMetrics();

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Initialize the CQRS service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Register _command handlers
      await this.registerCommandHandlers();

      // Register _query handlers
      await this.registerQueryHandlers();

      // Initialize projections if enabled
      if (this.config.enableProjections) {
        await this.initializeProjections();
      }

      // Setup event subscription for projections
      if (this.config.enableProjections || this.config.enableStatistics) {
        await this.setupEventSubscriptions();
      }

      this.isInitialized = true;
      this.emit("initialized");
    } catch (_error) {
      this.emit("_error", _error);
      throw new Error(`Failed to initialize CQRS service: ${_error.message}`);
    }
  }

  /**
   * Execute a _command through the mediator
   */
  async executeCommand<TResult = any>(
    _command: Command,
  ): Promise<CommandResult<TResult>> {
    if (!this.isInitialized) {
      throw new Error("CQRS service not initialized");
    }

    const _startTime = Date.now();

    try {
      const _result = await this.mediator.send<TResult>(_command);

      // Update metrics
      this.updateCommandMetrics(Date.now() - _startTime, true);

      // Emit _command executed event
      this.emit("commandExecuted", {
        _command,
        _result,
        executionTime: Date.now() - _startTime,
      });

      return _result;
    } catch (_error) {
      this.updateCommandMetrics(Date.now() - _startTime, false);
      this.emit("commandFailed", {
        _command,
        _error,
        executionTime: Date.now() - _startTime,
      });
      throw _error;
    }
  }

  /**
   * Execute a _query through the mediator
   */
  async executeQuery<TResult = any>(
    _query: Query,
  ): Promise<QueryResult<TResult>> {
    if (!this.isInitialized) {
      throw new Error("CQRS service not initialized");
    }

    const _startTime = Date.now();

    try {
      const _result = await this.mediator.query<TResult>(_query);

      // Update metrics
      this.updateQueryMetrics(Date.now() - _startTime, true);

      // Emit _query executed event
      this.emit("queryExecuted", {
        _query,
        _result,
        executionTime: Date.now() - _startTime,
      });

      return _result;
    } catch (_error) {
      this.updateQueryMetrics(Date.now() - _startTime, false);
      this.emit("queryFailed", {
        _query,
        _error,
        executionTime: Date.now() - _startTime,
      });
      throw _error;
    }
  }

  /**
   * Convenience methods for common operations using factories
   */

  // Memory operations
  async storeMemory(
    _memoryId: string,
    memoryType: string,
    data: unknown,
    size: number,
    tags: string[] = [],
  ): Promise<CommandResult<{ _memoryId: string }>> {
    const _command = CommandFactory.createStoreMemoryCommand(
      _memoryId,
      memoryType,
      data,
      size,
      { tags },
    );
    return this.executeCommand(_command);
  }

  async getMemoryById(
    _memoryId: string,
    includeMeta = false,
  ): Promise<QueryResult<any>> {
    const _query = QueryFactory.createGetMemoryByIdQuery(_memoryId, {
      includeMeta,
    });
    return this.executeQuery(_query);
  }

  async searchMemories(
    _searchTerm: string,
    options: {
      searchFields?: string[];
      limit?: number;
      offset?: number;
      filters?: Record<string, any>;
    } = {},
  ): Promise<QueryResult<any[]>> {
    const _query = QueryFactory.createSearchMemoriesQuery(_searchTerm, options);
    return this.executeQuery(_query);
  }

  async getMemoryStatistics(
    includeDetails = false,
    timeRangeHours = 24,
  ): Promise<QueryResult<any>> {
    const _query = QueryFactory.createGetMemoryStatisticsQuery({
      includeDetails,
      timeRangeHours,
    });
    return this.executeQuery(_query);
  }

  async getMostAccessedMemories(
    limit = 10,
    timeRangeHours = 24,
  ): Promise<QueryResult<any[]>> {
    const _query = QueryFactory.createGetMostAccessedMemoriesQuery({
      limit,
      timeRangeHours,
    });
    return this.executeQuery(_query);
  }

  async findMemoriesByType(
    _memoryType: string,
    limit = 100,
    offset = 0,
  ): Promise<QueryResult<any[]>> {
    const _query = QueryFactory.createFindMemoriesByTypeQuery(_memoryType, {
      limit,
      offset,
    });
    return this.executeQuery(_query);
  }

  async compressContext(
    _memoryId: string,
    algorithm = "gzip",
    compressionLevel = 6,
  ): Promise<CommandResult<any>> {
    const _command = CommandFactory.createCompressContextCommand(
      _memoryId,
      algorithm,
      compressionLevel,
    );
    return this.executeCommand(_command);
  }

  async promoteMemory(
    _memoryId: string,
    toTier: string,
  ): Promise<CommandResult<any>> {
    const _command = CommandFactory.createPromoteMemoryCommand(
      _memoryId,
      toTier,
    );
    return this.executeCommand(_command);
  }

  /**
   * Get service metrics
   */
  getMetrics(): CQRSServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset service metrics
   */
  resetMetrics(): void {
    this.metrics = this.createInitialMetrics();
    this.emit("metricsReset");
  }

  /**
   * Get read model store for direct access (use cautiously)
   */
  getReadModelStore(): InMemoryReadModelStore {
    return this.readModelStore;
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Shutdown mediator
      if (this.mediator && typeof this.mediator.shutdown === "function") {
        await this.mediator.shutdown();
      }

      // Clear read model store
      await this.readModelStore.clear();

      // Remove all event listeners
      this.removeAllListeners();

      this.isInitialized = false;
      this.emit("shutdown");
    } catch (_error) {
      this.emit("_error", _error);
      throw _error;
    }
  }

  /**
   * Private helper methods
   */

  private async registerCommandHandlers(): Promise<void> {
    // Create and register _command handlers
    const _storeHandler = new StoreMemoryCommandHandler(
      this.memoryRepository,
      this.eventStore,
    );
    const _compressHandler = new CompressContextCommandHandler(
      this.memoryRepository,
      this.eventStore,
    );
    const _promoteHandler = new PromoteMemoryCommandHandler(
      this.memoryRepository,
      this.eventStore,
    );
    const _evictHandler = new EvictMemoryCommandHandler(
      this.memoryRepository,
      this.eventStore,
    );
    const _learnHandler = new LearnPatternCommandHandler(
      this.memoryRepository,
      this.eventStore,
    );
    const _updateKnowledgeHandler = new UpdateKnowledgeGraphCommandHandler(
      this.memoryRepository,
      this.eventStore,
    );

    this.commandHandlerRegistry.register(_storeHandler);
    this.commandHandlerRegistry.register(_compressHandler);
    this.commandHandlerRegistry.register(_promoteHandler);
    this.commandHandlerRegistry.register(_evictHandler);
    this.commandHandlerRegistry.register(_learnHandler);
    this.commandHandlerRegistry.register(_updateKnowledgeHandler);
  }

  private async registerQueryHandlers(): Promise<void> {
    const _cacheService = this.config.enableCaching
      ? {
          get: async (_key: string) => null,
          set: async (_key: string, _value: unknown, _ttl?: number) => {
            // Implementation pending
          },
          delete: async (_key: string) => {
            // Implementation pending
          },
          clear: async () => {
            // Implementation pending
          },
        }
      : undefined;

    // Create and register _query handlers
    const _getByIdHandler = new GetMemoryByIdQueryHandler(
      this.memoryRepository,
      _cacheService,
    );
    const _findByTypeHandler = new FindMemoriesByTypeQueryHandler(
      this.readModelStore,
      _cacheService,
    );
    const _findByTierHandler = new FindMemoriesByTierQueryHandler(
      this.readModelStore,
      _cacheService,
    );
    const _searchHandler = new SearchMemoriesQueryHandler(
      this.readModelStore,
      _cacheService,
    );
    const _mostAccessedHandler = new GetMostAccessedMemoriesQueryHandler(
      this.readModelStore,
      _cacheService,
    );
    const _statsHandler = new GetMemoryStatisticsQueryHandler(
      this.readModelStore,
      _cacheService,
    );
    const _usageHandler = new GetMemoryUsageByTierQueryHandler(
      this.readModelStore,
      _cacheService,
    );
    const _patternsHandler = new GetMemoryAccessPatternsQueryHandler(
      this.readModelStore,
      _cacheService,
    );
    const _knowledgeGraphHandler = new GetKnowledgeGraphQueryHandler(
      this.readModelStore,
      _cacheService,
    );
    const _compressionStatsHandler = new GetCompressionStatisticsQueryHandler(
      this.readModelStore,
      _cacheService,
    );
    const _healthHandler = new GetMemoryHealthQueryHandler(
      this.readModelStore,
      _cacheService,
    );
    const _eventHistoryHandler = new GetEventHistoryQueryHandler(
      this.eventStore,
      _cacheService,
    );

    this.queryHandlerRegistry.register(_getByIdHandler);
    this.queryHandlerRegistry.register(_findByTypeHandler);
    this.queryHandlerRegistry.register(_findByTierHandler);
    this.queryHandlerRegistry.register(_searchHandler);
    this.queryHandlerRegistry.register(_mostAccessedHandler);
    this.queryHandlerRegistry.register(_statsHandler);
    this.queryHandlerRegistry.register(_usageHandler);
    this.queryHandlerRegistry.register(_patternsHandler);
    this.queryHandlerRegistry.register(_knowledgeGraphHandler);
    this.queryHandlerRegistry.register(_compressionStatsHandler);
    this.queryHandlerRegistry.register(_healthHandler);
    this.queryHandlerRegistry.register(_eventHistoryHandler);
  }

  private async initializeProjections(): Promise<void> {
    // Reset projections to ensure clean state
    await this.memoryProjection.reset();

    if (this.config.enableStatistics) {
      await this.statisticsProjection.reset();
    }
  }

  private async setupEventSubscriptions(): Promise<void> {
    // Subscribe to events from the event store for projection updates
    if (this.eventStore && typeof this.eventStore.subscribe === "function") {
      this.eventStore.subscribe(async (event: DomainEvent) => {
        try {
          // Update memory projection
          if (this.memoryProjection.eventTypes.includes(event.eventType)) {
            await this.memoryProjection.project(event);
          }

          // Update statistics projection
          if (
            this.config.enableStatistics &&
            this.statisticsProjection.eventTypes.includes(event.eventType)
          ) {
            await this.statisticsProjection.project(event);
          }
        } catch (_error) {
          this.emit("projectionError", { event, _error });
        }
      });
    }
  }

  private setupEventListeners(): void {
    // Setup internal event listeners for metrics and monitoring
    this.mediator.on("commandExecuted", (context) => {
      this.emit("commandExecuted", context);
    });

    this.mediator.on("queryExecuted", (context) => {
      this.emit("queryExecuted", context);
    });

    this.mediator.on("_error", (_error) => {
      this.emit("_error", _error);
    });
  }

  private createInitialMetrics(): CQRSServiceMetrics {
    return {
      commandsExecuted: 0,
      queriesExecuted: 0,
      commandFailures: 0,
      queryFailures: 0,
      averageCommandTime: 0,
      averageQueryTime: 0,
      cacheHitRatio: 0,
      lastReset: new Date(),
    };
  }

  private updateCommandMetrics(_executionTime: number, success: boolean): void {
    this.metrics.commandsExecuted++;
    if (!success) {
      this.metrics.commandFailures++;
    }

    // Update running average
    const _totalCommands = this.metrics.commandsExecuted;
    this.metrics.averageCommandTime =
      (this.metrics.averageCommandTime * (_totalCommands - 1) +
        _executionTime) /
      _totalCommands;
  }

  private updateQueryMetrics(_executionTime: number, success: boolean): void {
    this.metrics.queriesExecuted++;
    if (!success) {
      this.metrics.queryFailures++;
    }

    // Update running average
    const _totalQueries = this.metrics.queriesExecuted;
    this.metrics.averageQueryTime =
      (this.metrics.averageQueryTime * (_totalQueries - 1) + _executionTime) /
      _totalQueries;
  }
}

/**
 * Factory for creating CQRS service instances
 */
export class CQRSServiceFactory {
  /**
   * Create a configured CQRS service instance
   */
  static create(
    eventStore: EventStore,
    memoryRepository: unknown,
    config: CQRSServiceConfig = {},
  ): CQRSService {
    return new CQRSService(eventStore, memoryRepository, config);
  }

  /**
   * Create a CQRS service with default configuration optimized for development
   */
  static createForDevelopment(
    eventStore: EventStore,
    memoryRepository: unknown,
  ): CQRSService {
    return new CQRSService(eventStore, memoryRepository, {
      enableProjections: true,
      enableStatistics: true,
      enableCaching: true,
      cacheTimeoutMs: 60000, // 1 minute cache for development
      mediator: {
        commandTimeoutMs: 30000, // 30 second timeout
        queryTimeoutMs: 10000, // 10 second timeout
        maxConcurrentCommands: 10,
        maxConcurrentQueries: 50,
        enableMetrics: true,
        enableLogging: true,
      },
    });
  }

  /**
   * Create a CQRS service with configuration optimized for production
   */
  static createForProduction(
    eventStore: EventStore,
    memoryRepository: unknown,
  ): CQRSService {
    return new CQRSService(eventStore, memoryRepository, {
      enableProjections: true,
      enableStatistics: true,
      enableCaching: true,
      cacheTimeoutMs: 300000, // 5 minute cache for production
      mediator: {
        commandTimeoutMs: 60000, // 1 minute timeout
        queryTimeoutMs: 30000, // 30 second timeout
        maxConcurrentCommands: 50,
        maxConcurrentQueries: 200,
        enableMetrics: true,
        enableLogging: false, // Disable detailed logging in production
      },
    });
  }
}
