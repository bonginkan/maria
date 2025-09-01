/**
 * CQRS Interfaces and Types
 * Core abstractions for Command Query Responsibility Segregation
 */

import { DomainEvent } from "../event-sourcing/domain-event";

/**
 * Base command interface
 */
export interface Command {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly userId?: string;
  readonly correlationId?: string;
  readonly metadata: Record<string, any>;
  readonly parameters: Record<string, any>;
}

/**
 * Base query interface
 */
export interface Query {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly userId?: string;
  readonly correlationId?: string;
  readonly parameters: Record<string, any>;
}

/**
 * Command result
 */
export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  events: DomainEvent[];
  executionTime: number;
  metadata: Record<string, any>;
}

/**
 * Query result
 */
export interface QueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  executionTime: number;
  cacheHit: boolean;
  metadata: Record<string, any>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

/**
 * Command handler interface
 */
export interface ICommandHandler<TCommand extends Command, TResult = any> {
  readonly commandType: string;
  readonly name: string;
  readonly priority?: number;

  handle(command: TCommand): Promise<CommandResult<TResult>>;
  validate(command: TCommand): Promise<ValidationResult>;
}

/**
 * Query handler interface
 */
export interface IQueryHandler<TQuery extends Query, TResult = any> {
  readonly queryType: string;
  readonly name: string;
  readonly cacheable?: boolean;
  readonly cacheTimeoutMs?: number;

  handle(query: TQuery): Promise<QueryResult<TResult>>;
  validate?(query: TQuery): Promise<ValidationResult>;
}

/**
 * Mediator interface for routing commands and queries
 */
export interface IMediator {
  send<TResult = any>(command: Command): Promise<CommandResult<TResult>>;
  query<TResult = any>(query: Query): Promise<QueryResult<TResult>>;

  registerCommandHandler<TCommand extends Command>(
    commandType: string,
    handler: ICommandHandler<TCommand>,
  ): void;

  registerQueryHandler<TQuery extends Query>(
    queryType: string,
    handler: IQueryHandler<TQuery>,
  ): void;

  unregisterCommandHandler(commandType: string): void;
  unregisterQueryHandler(queryType: string): void;
}

/**
 * Cache service interface
 */
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(_key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(pattern?: string): Promise<number>;
  exists(key: string): Promise<boolean>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  commandsExecuted: number;
  queriesExecuted: number;
  averageCommandTime: number;
  averageQueryTime: number;
  cacheHitRate: number;
  errorRate: number;
  totalErrors: number;
}

/**
 * CQRS configuration
 */
export interface CQRSConfig {
  enableCache: boolean;
  defaultCacheTimeoutMs: number;
  enableValidation: boolean;
  enableMetrics: boolean;
  enableAuditLog: boolean;
  maxConcurrentCommands: number;
  maxConcurrentQueries: number;
  commandTimeoutMs: number;
  queryTimeoutMs: number;
}

/**
 * Command context for handlers
 */
export interface CommandContext {
  command: Command;
  userId?: string;
  correlationId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

/**
 * Query context for handlers
 */
export interface QueryContext {
  query: Query;
  userId?: string;
  correlationId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

/**
 * Middleware interface for command/query pipeline
 */
export interface ICQRSMiddleware {
  readonly name: string;
  readonly priority?: number;

  beforeCommand?(context: CommandContext): Promise<void>;
  afterCommand?(_context: CommandContext, result: CommandResult): Promise<void>;
  beforeQuery?(context: QueryContext): Promise<void>;
  afterQuery?(_context: QueryContext, result: QueryResult): Promise<void>;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  type: "command" | "query";
  operation: string;
  userId?: string;
  timestamp: Date;
  success: boolean;
  executionTime: number;
  error?: string;
  metadata: Record<string, any>;
}

/**
 * Read model interface
 */
export interface IReadModel {
  readonly name: string;
  readonly version: number;

  project(event: DomainEvent): Promise<void>;
  reset(): Promise<void>;
  getLastProcessedEventId(): Promise<string | null>;
  setLastProcessedEventId(eventId: string): Promise<void>;
}

/**
 * Event projection interface
 */
export interface IEventProjection<T = any> {
  readonly projectionName: string;
  readonly eventTypes: string[];

  when(event: DomainEvent): Promise<void>;
  getProjection(id: string): Promise<T | null>;
  getAllProjections(): Promise<T[]>;
  reset(): Promise<void>;
}
