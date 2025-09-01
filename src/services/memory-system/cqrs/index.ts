/**
 * CQRS Module Exports
 * Complete Command Query Responsibility Segregation implementation for Ultra Memory System
 */

// Core interfaces and types
export * from "./interfaces";

// Commands
export * from "./commands";

// Queries
export * from "./queries";

// Command handlers
export * from "./command-handlers";

// Query handlers
export * from "./query-handlers";

// Mediator pattern implementation
export * from "./mediator";

// Read models and projections
export * from "./read-models";

// Main CQRS service orchestrator
export * from "./cqrs-service";

// Re-export commonly used types for convenience
export type {
  Command,
  Query,
  CommandResult,
  QueryResult,
  ICommandHandler,
  IQueryHandler,
  IMediator,
  IReadModel,
  IEventProjection,
  ValidationResult,
} from "./interfaces";

export type {
  MemoryReadModel,
  MemoryStatisticsReadModel,
  KnowledgeGraphReadModel,
} from "./read-models";

export type { CQRSServiceConfig, CQRSServiceMetrics } from "./cqrs-service";

export type { MediatorConfig } from "./mediator";
