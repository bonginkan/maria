/**
 * CQRS Mediator Pattern Implementation
 * Centralized routing for _commands and _queries
 */

import {
  IMediator,
  ICommandHandler,
  IQueryHandler,
  Command,
  Query,
  CommandResult,
  QueryResult,
  ICQRSMiddleware,
  CommandContext,
  QueryContext,
  PerformanceMetrics,
  CQRSConfig,
} from "./interfaces";
import { EventEmitter } from "node:events";

/**
 * Default CQRS configuration
 */
export const DEFAULTCQRS_CONFIG: CQRSConfig = {
  enableCache: true,
  defaultCacheTimeoutMs: 300000, // 5 minutes
  enableValidation: true,
  enableMetrics: true,
  enableAuditLog: true,
  maxConcurrentCommands: 10,
  maxConcurrentQueries: 50,
  commandTimeoutMs: 30000, // 30 seconds
  queryTimeoutMs: 10000, // 10 seconds
};

/**
 * CQRS Mediator implementation
 */
export class Mediator extends EventEmitter implements IMediator {
  private commandHandlers = new Map<string, ICommandHandler<any>>();
  private queryHandlers = new Map<string, IQueryHandler<any>>();
  private _middleware: ICQRSMiddleware[] = [];
  private commandSemaphore: Semaphore;
  private querySemaphore: Semaphore;
  private _metrics: MediatorMetrics;

  constructor(private readonly config: CQRSConfig = DEFAULT_CQRS_CONFIG) {
    super();
    this.commandSemaphore = new Semaphore(config.maxConcurrentCommands);
    this.querySemaphore = new Semaphore(config.maxConcurrentQueries);
    this.metrics = new MediatorMetrics();

    // Setup cleanup
    process.on("SIGINT", () => this.dispose());
    process.on("SIGTERM", () => this.dispose());
  }

  /**
   * Send a command through the mediator
   */
  async send<TResult = any>(command: Command): Promise<CommandResult<TResult>> {
    const _startTime = performance.now();
    const context: CommandContext = {
      command,
      userId: command.userId,
      correlationId: command.correlationId,
      timestamp: command.timestamp,
      metadata: command.metadata,
    };

    try {
      // Acquire semaphore
      await this.commandSemaphore.acquire();

      // Apply _middleware (before)
      await this.applyMiddlewareBeforeCommand(context);

      // Get _handler
      const _handler = this.commandHandlers.get(command.type);
      if (!_handler) {
        throw new Error(`No _handler registered for command: ${command.type}`);
      }

      // Validate command if _validation is enabled
      if (this.config.enableValidation) {
        const _validation = await _handler.validate(command);
        if (!_validation.isValid) {
          throw new Error(
            `Command _validation failed: ${_validation.errors.map((e) => e.message).join(", ")}`,
          );
        }
      }

      // Execute command with timeout
      const _result = await this.executeWithTimeout(
        () => _handler.handle(command),
        this.config.commandTimeoutMs,
        `Command ${command.type} timed out`,
      );

      // Apply _middleware (after)
      await this.applyMiddlewareAfterCommand(context, _result);

      // Update _metrics
      const _executionTime = performance.now() - _startTime;
      this.metrics.recordCommand(command.type, _executionTime, _result.success);

      // Emit events
      this.emit("command:executed", { command, _result, _executionTime });

      if (_result.success) {
        this.emit("command:success", { command, _result });
      } else {
        this.emit("command:failure", { command, _result });
      }

      return _result;
    } catch (_error) {
      const _executionTime = performance.now() - _startTime;
      const errorResult: CommandResult<TResult> = {
        success: false,
        _error: _error as Error,
        events: [],
        _executionTime,
        metadata: { command: command.type, _error: (_error as Error).message },
      };

      // Apply _middleware (after) with _error
      await this.applyMiddlewareAfterCommand(context, errorResult);

      // Update _metrics
      this.metrics.recordCommand(command.type, _executionTime, false);

      // Emit _error event
      this.emit("command:_error", { command, _error, _executionTime });

      return errorResult;
    } finally {
      this.commandSemaphore.release();
    }
  }

  /**
   * Send a query through the mediator
   */
  async query<TResult = any>(query: Query): Promise<QueryResult<TResult>> {
    const _startTime = performance.now();
    const context: QueryContext = {
      query,
      userId: query.userId,
      correlationId: query.correlationId,
      timestamp: query.timestamp,
      metadata: { queryType: query.type, parameters: query.parameters },
    };

    try {
      // Acquire semaphore
      await this.querySemaphore.acquire();

      // Apply _middleware (before)
      await this.applyMiddlewareBeforeQuery(context);

      // Get _handler
      const _handler = this.queryHandlers.get(query.type);
      if (!_handler) {
        throw new Error(`No _handler registered for query: ${query.type}`);
      }

      // Validate query if _validation is enabled and _handler supports it
      if (this.config.enableValidation && _handler.validate) {
        const _validation = await _handler.validate(query);
        if (!_validation.isValid) {
          throw new Error(
            `Query _validation failed: ${_validation.errors.map((e) => e.message).join(", ")}`,
          );
        }
      }

      // Execute query with timeout
      const _result = await this.executeWithTimeout(
        () => _handler.handle(query),
        this.config.queryTimeoutMs,
        `Query ${query.type} timed out`,
      );

      // Apply _middleware (after)
      await this.applyMiddlewareAfterQuery(context, _result);

      // Update _metrics
      const _executionTime = performance.now() - _startTime;
      this.metrics.recordQuery(
        query.type,
        _executionTime,
        _result.success,
        _result.cacheHit,
      );

      // Emit events
      this.emit("query:executed", { query, _result, _executionTime });

      if (_result.success) {
        this.emit("query:success", { query, _result });
      } else {
        this.emit("query:failure", { query, _result });
      }

      return _result;
    } catch (_error) {
      const _executionTime = performance.now() - _startTime;
      const errorResult: QueryResult<TResult> = {
        success: false,
        _error: _error as Error,
        _executionTime,
        cacheHit: false,
        metadata: { query: query.type, _error: (_error as Error).message },
      };

      // Apply _middleware (after) with _error
      await this.applyMiddlewareAfterQuery(context, errorResult);

      // Update _metrics
      this.metrics.recordQuery(query.type, _executionTime, false, false);

      // Emit _error event
      this.emit("query:_error", { query, _error, _executionTime });

      return errorResult;
    } finally {
      this.querySemaphore.release();
    }
  }

  /**
   * Register a command _handler
   */
  registerCommandHandler<TCommand extends Command>(
    commandType: string,
    _handler: ICommandHandler<TCommand>,
  ): void {
    if (this.commandHandlers.has(commandType)) {
      throw new Error(
        `Handler for command ${commandType} is already registered`,
      );
    }

    this.commandHandlers.set(commandType, _handler);
    this.emit("_handler:registered", {
      type: "command",
      handlerType: commandType,
      _handler: handler.name,
    });
  }

  /**
   * Register a query _handler
   */
  registerQueryHandler<TQuery extends Query>(
    queryType: string,
    _handler: IQueryHandler<TQuery>,
  ): void {
    if (this.queryHandlers.has(queryType)) {
      throw new Error(`Handler for query ${queryType} is already registered`);
    }

    this.queryHandlers.set(queryType, _handler);
    this.emit("_handler:registered", {
      type: "query",
      handlerType: queryType,
      _handler: handler.name,
    });
  }

  /**
   * Unregister a command _handler
   */
  unregisterCommandHandler(commandType: string): void {
    const _removed = this.commandHandlers.delete(commandType);
    if (_removed) {
      this.emit("_handler:unregistered", {
        type: "command",
        handlerType: commandType,
      });
    }
  }

  /**
   * Unregister a query _handler
   */
  unregisterQueryHandler(queryType: string): void {
    const _removed = this.queryHandlers.delete(queryType);
    if (_removed) {
      this.emit("_handler:unregistered", {
        type: "query",
        handlerType: queryType,
      });
    }
  }

  /**
   * Add _middleware to the pipeline
   */
  addMiddleware(_middleware: ICQRSMiddleware): void {
    this.middleware.push(_middleware);

    // Sort _middleware by priority
    this.middleware.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    this.emit("_middleware:added", { _middleware: middleware.name });
  }

  /**
   * Remove _middleware from the pipeline
   */
  removeMiddleware(middlewareName: string): void {
    const _index = this.middleware.findIndex((m) => m.name === middlewareName);
    if (_index >= 0) {
      this.middleware.splice(_index, 1);
      this.emit("_middleware:_removed", { _middleware: middlewareName });
    }
  }

  /**
   * Get performance _metrics
   */
  getMetrics(): PerformanceMetrics {
    return this.metrics.getMetrics();
  }

  /**
   * Get registered handlers info
   */
  getHandlersInfo(): {
    _commands: Array<{ type: string; name: string; priority: number }>;
    _queries: Array<{ type: string; name: string; cacheable: boolean }>;
    _middleware: Array<{ name: string; priority: number }>;
  } {
    const _commands = Array.from(this.commandHandlers.entries()).map(
      ([type, _handler]) => ({
        type,
        name: handler.name,
        priority: handler.priority || 0,
      }),
    );

    const _queries = Array.from(this.queryHandlers.entries()).map(
      ([type, _handler]) => ({
        type,
        name: handler.name,
        cacheable: handler.cacheable || false,
      }),
    );

    const _middleware = this._middleware.map((m) => ({
      name: m.name,
      priority: m.priority || 0,
    }));

    return { _commands, _queries, _middleware };
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    errorMessage: string,
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
      ),
    ]);
  }

  /**
   * Apply _middleware before command execution
   */
  private async applyMiddlewareBeforeCommand(
    context: CommandContext,
  ): Promise<void> {
    for (const _middleware of this._middleware) {
      if (_middleware.beforeCommand) {
        await _middleware.beforeCommand(context);
      }
    }
  }

  /**
   * Apply _middleware after command execution
   */
  private async applyMiddlewareAfterCommand(
    _context: CommandContext,
    _result: CommandResult,
  ): Promise<void> {
    // Apply in reverse order for after hooks
    for (let i = this._middleware.length - 1; i >= 0; i--) {
      const _middleware = this._middleware[i];
      if (_middleware.afterCommand) {
        await _middleware.afterCommand(_context, _result);
      }
    }
  }

  /**
   * Apply _middleware before query execution
   */
  private async applyMiddlewareBeforeQuery(
    context: QueryContext,
  ): Promise<void> {
    for (const _middleware of this._middleware) {
      if (_middleware.beforeQuery) {
        await _middleware.beforeQuery(context);
      }
    }
  }

  /**
   * Apply _middleware after query execution
   */
  private async applyMiddlewareAfterQuery(
    _context: QueryContext,
    _result: QueryResult,
  ): Promise<void> {
    // Apply in reverse order for after hooks
    for (let i = this._middleware.length - 1; i >= 0; i--) {
      const _middleware = this._middleware[i];
      if (_middleware.afterQuery) {
        await _middleware.afterQuery(_context, _result);
      }
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.removeAllListeners();
    this.commandHandlers.clear();
    this.queryHandlers.clear();
    this.middleware = [];
  }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(_permits: number) {
    this._permits = _permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  release(): void {
    this.permits++;
    const _next = this.waiting.shift();
    if (_next) {
      this.permits--;
      _next();
    }
  }
}

/**
 * Metrics collection for the mediator
 */
class MediatorMetrics {
  private commandMetrics = new Map<
    string,
    { count: number; totalTime: number; successCount: number }
  >();
  private queryMetrics = new Map<
    string,
    {
      count: number;
      totalTime: number;
      successCount: number;
      _cacheHits: number;
    }
  >();
  private _startTime = Date.now();

  recordCommand(
    _commandType: string,
    _executionTime: number,
    success: boolean,
  ): void {
    const _metrics = this.commandMetrics.get(_commandType) || {
      count: 0,
      totalTime: 0,
      successCount: 0,
    };
    _metrics.count++;
    metrics.totalTime += _executionTime;
    if (success) {
      metrics.successCount++;
    }
    this.commandMetrics.set(_commandType, _metrics);
  }

  recordQuery(
    _queryType: string,
    _executionTime: number,
    success: boolean,
    cacheHit: boolean,
  ): void {
    const _metrics = this.queryMetrics.get(_queryType) || {
      count: 0,
      totalTime: 0,
      successCount: 0,
      _cacheHits: 0,
    };
    _metrics.count++;
    metrics.totalTime += _executionTime;
    if (success) {
      metrics.successCount++;
    }
    if (cacheHit) {
      metrics.cacheHits++;
    }
    this.queryMetrics.set(_queryType, _metrics);
  }

  getMetrics(): PerformanceMetrics {
    const _commandsExecuted = Array.from(this.commandMetrics.values()).reduce(
      (sum, m) => sum + m.count,
      0,
    );
    const _queriesExecuted = Array.from(this.queryMetrics.values()).reduce(
      (sum, m) => sum + m.count,
      0,
    );
    const _commandTime = Array.from(this.commandMetrics.values()).reduce(
      (sum, m) => sum + m.totalTime,
      0,
    );
    const _queryTime = Array.from(this.queryMetrics.values()).reduce(
      (sum, m) => sum + m.totalTime,
      0,
    );
    const _commandSuccesses = Array.from(this.commandMetrics.values()).reduce(
      (sum, m) => sum + m.successCount,
      0,
    );
    const _querySuccesses = Array.from(this.queryMetrics.values()).reduce(
      (sum, m) => sum + m.successCount,
      0,
    );
    const _cacheHits = Array.from(this.queryMetrics.values()).reduce(
      (sum, m) => sum + m._cacheHits,
      0,
    );

    return {
      _commandsExecuted,
      _queriesExecuted,
      averageCommandTime:
        _commandsExecuted > 0 ? _commandTime / _commandsExecuted : 0,
      averageQueryTime:
        _queriesExecuted > 0 ? _queryTime / _queriesExecuted : 0,
      cacheHitRate: _queriesExecuted > 0 ? _cacheHits / _queriesExecuted : 0,
      errorRate:
        _commandsExecuted + _queriesExecuted > 0
          ? 1 -
            (_commandSuccesses + _querySuccesses) /
              (_commandsExecuted + _queriesExecuted)
          : 0,
      totalErrors:
        _commandsExecuted +
        _queriesExecuted -
        (_commandSuccesses + _querySuccesses),
    };
  }
}

/**
 * Built-in _middleware implementations
 */

/**
 * Logging _middleware
 */
export class LoggingMiddleware implements ICQRSMiddleware {
  readonly name = "LoggingMiddleware";
  readonly priority = 1000; // Run last

  async beforeCommand(context: CommandContext): Promise<void> {
    console.log(`[CQRS] Executing command: ${context.command.type}`, {
      commandId: context.command.id,
      userId: context.userId,
      correlationId: context.correlationId,
    });
  }

  async afterCommand(
    _context: CommandContext,
    _result: CommandResult,
  ): Promise<void> {
    const _level = _result.success ? "info" : "_error";
    console[_level](
      `[CQRS] Command ${_context.command.type} ${_result.success ? "succeeded" : "failed"}`,
      {
        commandId: _context.command.id,
        _executionTime: _result.executionTime,
        _error: _result.error?.message,
      },
    );
  }

  async beforeQuery(context: QueryContext): Promise<void> {
    console.log(`[CQRS] Executing query: ${context.query.type}`, {
      queryId: context.query.id,
      userId: context.userId,
      correlationId: context.correlationId,
    });
  }

  async afterQuery(
    _context: QueryContext,
    _result: QueryResult,
  ): Promise<void> {
    const _level = _result.success ? "info" : "_error";
    console[_level](
      `[CQRS] Query ${_context.query.type} ${_result.success ? "succeeded" : "failed"}`,
      {
        queryId: _context.query.id,
        _executionTime: _result.executionTime,
        cacheHit: _result.cacheHit,
        _error: _result.error?.message,
      },
    );
  }
}

/**
 * Validation _middleware
 */
export class ValidationMiddleware implements ICQRSMiddleware {
  readonly name = "ValidationMiddleware";
  readonly priority = 10; // Run early

  async beforeCommand(context: CommandContext): Promise<void> {
    // Basic command _validation
    if (!context.command.id) {
      throw new Error("Command ID is required");
    }
    if (!context.command.type) {
      throw new Error("Command type is required");
    }
    if (!context.command.timestamp) {
      throw new Error("Command timestamp is required");
    }
  }

  async beforeQuery(context: QueryContext): Promise<void> {
    // Basic query _validation
    if (!context.query.id) {
      throw new Error("Query ID is required");
    }
    if (!context.query.type) {
      throw new Error("Query type is required");
    }
    if (!context.query.timestamp) {
      throw new Error("Query timestamp is required");
    }
  }
}

/**
 * Performance monitoring _middleware
 */
export class PerformanceMiddleware implements ICQRSMiddleware {
  readonly name = "PerformanceMiddleware";
  readonly priority = 5;

  private readonly slowCommandThreshold = 5000; // 5 seconds
  private readonly slowQueryThreshold = 1000; // 1 second

  async afterCommand(
    _context: CommandContext,
    _result: CommandResult,
  ): Promise<void> {
    if (_result.executionTime > this.slowCommandThreshold) {
      console.warn(`[CQRS] Slow command detected: ${_context.command.type}`, {
        commandId: _context.command.id,
        _executionTime: _result.executionTime,
        threshold: this.slowCommandThreshold,
      });
    }
  }

  async afterQuery(
    _context: QueryContext,
    _result: QueryResult,
  ): Promise<void> {
    if (_result.executionTime > this.slowQueryThreshold) {
      console.warn(`[CQRS] Slow query detected: ${_context.query.type}`, {
        queryId: _context.query.id,
        _executionTime: _result.executionTime,
        threshold: this.slowQueryThreshold,
        cacheHit: _result.cacheHit,
      });
    }
  }
}
