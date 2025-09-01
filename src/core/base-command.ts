/**
 * Base Command Infrastructure for MARIA Phase 3
 * Microservices Foundation Layer
 */

import { EventEmitter } from "node:events";
import { Logger } from "../utils/logger";

// Core Interfaces
export interface ICommand<TOptions = any, TResult = any> {
  readonly name: string;
  readonly description: string;
  readonly category: CommandCategory;
  readonly version: string;

  execute(context: CommandContext<TOptions>): Promise<CommandResult<TResult>>;
  validate(options: TOptions): ValidationResult;
  getHelp(): CommandHelp;
  getMetadata(): CommandMetadata;
}

export interface CommandContext<TOptions = any> {
  options: TOptions;
  userId: string;
  traceId: string;
  timestamp: Date;
  environment: "development" | "production" | "test";
  session: SessionContext;
}

export interface CommandResult<TResult = any> {
  success: boolean;
  data?: TResult;
  error?: CommandError;
  metadata: ResultMetadata;
  suggestions?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface CommandHelp {
  usage: string;
  examples: string[];
  options: OptionHelp[];
  relatedCommands?: string[];
}

export interface CommandMetadata {
  tags: string[];
  aliases?: string[];
  dependencies: string[];
  runtimeRequirements: RuntimeRequirements;
  quality: QualityMetrics;
}

// Types
export type CommandCategory =
  | "core"
  | "generation"
  | "analysis"
  | "quality"
  | "development"
  | "workflow"
  | "configuration"
  | "auth"
  | "media"
  | "integration"
  | "system";

export interface CommandError {
  type: "_validation" | "execution" | "timeout" | "rate_limit" | "internal";
  message: string;
  code: string;
  details?: Record<string, any>;
  recoverable: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: "error" | "warning";
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ResultMetadata {
  executionTime: number;
  resourceUsage: ResourceUsage;
  qualityScore?: number;
  cacheHit?: boolean;
  providerUsed?: string;
}

export interface ResourceUsage {
  memoryDelta: number;
  cpuTime: number;
  networkRequests: number;
  diskOperations: number;
}

export interface QualityMetrics {
  testCoverage: number;
  complexity: number;
  maintainability: number;
  reliability: number;
  lastUpdated: Date;
}

export interface RuntimeRequirements {
  minNodeVersion: string;
  requiredServices: string[];
  optionalServices: string[];
  permissions: Permission[];
}

export interface Permission {
  name: string;
  required: boolean;
  description: string;
}

export interface OptionHelp {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "array";
  required: boolean;
  defaultValue?: any;
}

export interface SessionContext {
  id: string;
  _startTime: Date;
  lastActivity: Date;
  commandHistory: string[];
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: "dark" | "light";
  verbosity: "minimal" | "normal" | "detailed";
  confirmations: boolean;
  streamOutput: boolean;
}

// Abstract Base Command
export abstract class BaseCommand<TOptions = any, TResult = any>
  extends EventEmitter
  implements ICommand<TOptions, TResult>
{
  protected logger: Logger;
  protected _startTime: number = 0;
  protected metrics: Map<string, any> = new Map();

  public readonly name: string;
  public readonly description: string;
  public readonly category: CommandCategory;
  public readonly version: string;

  constructor(
    name: string,
    description: string,
    category: CommandCategory = "core",
    version: string = "1.0.0",
  ) {
    super();
    this.name = name;
    this.description = description;
    this.category = category;
    this.version = version;
    this.logger = new Logger(`Command:${name}`);
  }

  // Abstract methods to be implemented by concrete commands
  abstract execute(
    _context: CommandContext<TOptions>,
  ): Promise<CommandResult<TResult>>;
  abstract validate(_options: TOptions): ValidationResult;
  abstract getHelp(): CommandHelp;

  // Safe execution wrapper with error handling, metrics, and tracing
  async safeExecute(
    context: CommandContext<TOptions>,
  ): Promise<CommandResult<TResult>> {
    const _measurement = this.startMeasurement("execute");

    try {
      this.logger.info(`Executing command: ${this.name}`, {
        traceId: context.traceId,
        userId: context.userId,
      });

      this.emit("command:started", {
        command: this.name,
        traceId: context.traceId,
        timestamp: new Date(),
      });

      // 1. Validation
      const _validation = this.validate(context.options);
      if (!_validation.isValid) {
        throw new CommandValidationError(_validation.errors);
      }

      // 2. Pre-execution hooks
      await this.preExecute(context);

      // 3. Main execution
      const _result = await this.execute(context);

      // 4. Post-execution hooks
      await this.postExecute(context, _result);

      // 5. Success metrics
      const _executionMetadata = this.endMeasurement(_measurement);
      _result.metadata = { ..._result.metadata, ..._executionMetadata };

      this.emit("command:completed", {
        command: this.name,
        traceId: context.traceId,
        _result,
        executionTime: _executionMetadata.executionTime,
      });

      this.logger.info(`Command completed: ${this.name}`, {
        traceId: context.traceId,
        executionTime: _executionMetadata.executionTime,
        success: _result.success,
      });

      return _result;
    } catch (error) {
      const _executionMetadata = this.endMeasurement(_measurement);

      this.logger.error(`Command failed: ${this.name}`, {
        error: error.message,
        traceId: context.traceId,
        executionTime: _executionMetadata.executionTime,
      });

      this.emit("command:failed", {
        command: this.name,
        traceId: context.traceId,
        error,
        executionTime: _executionMetadata.executionTime,
      });

      return this.handleError(error, context, _executionMetadata);
    }
  }

  // Lifecycle hooks
  protected async preExecute(
    _context: CommandContext<TOptions>,
  ): Promise<void> {
    // Override in subclasses for pre-execution logic
  }

  protected async postExecute(
    _context: CommandContext<TOptions>,
    _result: CommandResult<TResult>,
  ): Promise<void> {
    // Override in subclasses for post-execution logic
  }

  // Default metadata implementation
  getMetadata(): CommandMetadata {
    return {
      tags: this.getTags(),
      aliases: this.getAliases(),
      dependencies: this.getDependencies(),
      runtimeRequirements: this.getRuntimeRequirements(),
      quality: this.getQualityMetrics(),
    };
  }

  // Override these in subclasses
  protected getTags(): string[] {
    return [this.category];
  }

  protected getAliases(): string[] {
    return [];
  }

  protected getDependencies(): string[] {
    return [];
  }

  protected getRuntimeRequirements(): RuntimeRequirements {
    return {
      minNodeVersion: "18.0.0",
      requiredServices: [],
      optionalServices: [],
      permissions: [],
    };
  }

  protected getQualityMetrics(): QualityMetrics {
    return {
      testCoverage: 0,
      complexity: 0,
      maintainability: 0,
      reliability: 0,
      lastUpdated: new Date(),
    };
  }

  // Performance _measurement
  private startMeasurement(operation: string): MeasurementHandle {
    const _startTime = performance.now();
    const _startMemory = process.memoryUsage();

    return {
      operation,
      _startTime,
      _startMemory,
    };
  }

  private endMeasurement(handle: MeasurementHandle): ResultMetadata {
    const _endTime = performance.now();
    const _endMemory = process.memoryUsage();

    return {
      executionTime: _endTime - handle.startTime,
      resourceUsage: {
        memoryDelta: _endMemory.heapUsed - handle.startMemory.heapUsed,
        cpuTime: _endTime - handle.startTime, // Approximation
        networkRequests: 0, // To be tracked by subclasses
        diskOperations: 0, // To be tracked by subclasses
      },
    };
  }

  // Error handling
  private handleError(
    error: unknown,
    _context: CommandContext<TOptions>,
    metadata: ResultMetadata,
  ): CommandResult<TResult> {
    let commandError: CommandError;

    if (error instanceof CommandValidationError) {
      commandError = {
        type: "_validation",
        message: error.message,
        code: "VALIDATION_FAILED",
        details: { errors: error.validationErrors },
        recoverable: true,
      };
    } else if (error instanceof CommandTimeoutError) {
      commandError = {
        type: "timeout",
        message: "Command execution timed out",
        code: "EXECUTION_TIMEOUT",
        recoverable: false,
      };
    } else if (error instanceof CommandRateLimitError) {
      commandError = {
        type: "rate_limit",
        message: "Rate limit exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        details: { retryAfter: error.retryAfter },
        recoverable: true,
      };
    } else {
      commandError = {
        type: "internal",
        message: error.message || "An unexpected error occurred",
        code: "INTERNAL_ERROR",
        details: { originalError: error.name },
        recoverable: false,
      };
    }

    return {
      success: false,
      error: commandError,
      metadata,
    };
  }
}

// Custom Error Classes
export class CommandValidationError extends Error {
  constructor(public validationErrors: ValidationError[]) {
    super(
      `Validation failed: ${validationErrors.map((e) => e.message).join(", ")}`,
    );
    this.name = "CommandValidationError";
  }
}

export class CommandTimeoutError extends Error {
  constructor(_timeout: number) {
    super(`Command timed out after ${_timeout}ms`);
    this.name = "CommandTimeoutError";
  }
}

export class CommandRateLimitError extends Error {
  constructor(public retryAfter: number) {
    super("Rate limit exceeded");
    this.name = "CommandRateLimitError";
  }
}

// Utility interfaces
interface MeasurementHandle {
  operation: string;
  _startTime: number;
  _startMemory: NodeJS.MemoryUsage;
}

// Export utility functions
export function createCommandContext<TOptions>(
  options: TOptions,
  userId: string = "anonymous",
  environment: "development" | "production" | "test" = "development",
): CommandContext<TOptions> {
  return {
    options,
    userId,
    traceId: generateTraceId(),
    timestamp: new Date(),
    environment,
    session: {
      id: generateSessionId(),
      _startTime: new Date(),
      lastActivity: new Date(),
      commandHistory: [],
      preferences: {
        theme: "dark",
        verbosity: "normal",
        confirmations: true,
        streamOutput: true,
      },
    },
  };
}

export function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Command Registry Interface
export interface ICommandRegistry {
  register<T extends BaseCommand>(command: T): void;
  unregister(name: string): void;
  get<T extends BaseCommand>(name: string): T | undefined;
  getAll(): BaseCommand[];
  getByCategory(category: CommandCategory): BaseCommand[];
  hasCommand(name: string): boolean;
  resolveAlias(alias: string): string | undefined;
}
