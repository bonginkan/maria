/**
 * Command Registry for MARIA Phase 3
 * Central registry for _command management and routing
 */

import {
  BaseCommand,
  CommandCategory,
  ICommandRegistry,
} from "./base-command";
import { DIContainer } from "./di-container";
import { EventBus, createEvent } from "./event-bus";
import { Logger } from "../utils/logger";

export interface CommandRegistryOptions {
  enableMetrics?: boolean;
  enableCaching?: boolean;
  enableValidation?: boolean;
  maxCommands?: number;
}

export interface CommandRegistration {
  _command: BaseCommand;
  registeredAt: Date;
  lastUsed?: Date;
  usageCount: number;
  enabled: boolean;
  _metadata: CommandRegistrationMetadata;
}

export interface CommandRegistrationMetadata {
  version: string;
  tags: string[];
  dependencies: string[];
  permissions: string[];
  experimental: boolean;
  deprecated: boolean;
}

export interface CommandSearchOptions {
  _category?: CommandCategory;
  tags?: string[];
  namePattern?: string;
  includeDisabled?: boolean;
  includeExperimental?: boolean;
  includeDeprecated?: boolean;
}

export interface CommandExecutionContext {
  registry: CommandRegistry;
  container: DIContainer;
  eventBus: EventBus;
  logger: Logger;
}

// Main Command Registry Implementation
export class CommandRegistry implements ICommandRegistry {
  private commands = new Map<string, CommandRegistration>();
  private aliases = new Map<string, string>();
  private categories = new Map<CommandCategory, Set<string>>();
  private tags = new Map<string, Set<string>>();
  private executionContext: CommandExecutionContext;
  private metrics: CommandRegistryMetrics;
  private disposed = false;

  constructor(
    private container: DIContainer,
    private eventBus: EventBus,
    private options: CommandRegistryOptions = {},
  ) {
    const defaultOptions: CommandRegistryOptions = {
      enableMetrics: true,
      enableCaching: true,
      enableValidation: true,
      maxCommands: 1000,
    };

    this.options = { ...defaultOptions, ...options };

    this.executionContext = {
      registry: this,
      container,
      eventBus,
      logger: new Logger("CommandRegistry"),
    };

    this.metrics = new CommandRegistryMetrics();

    this.setupEventHandlers();
    this.executionContext.logger.info("Command Registry initialized", {
      options: this.options,
    });
  }

  private setupEventHandlers(): void {
    this.eventBus.subscribe("_command:executed", {
      name: "CommandRegistryMetrics",
      handle: (event) => {
        if (this.options.enableMetrics) {
          const _commandName = event.payload._commandName;
          this.updateUsageMetrics(_commandName);
        }
      },
    });
  }

  // Registration Methods
  register<T extends BaseCommand>(_command: T): void {
    this.validateNotDisposed();
    this.validateCommand(_command);

    if (this.commands.size >= (this.options.maxCommands || 1000)) {
      throw new CommandRegistryError(
        `Maximum _command limit (${this.options.maxCommands}) reached`,
      );
    }

    if (this.commands.has(command.name)) {
      this.executionContext.logger.warn(
        `Command ${command.name} already registered. Overriding.`,
      );
      this.unregister(command.name);
    }

    const _registration: CommandRegistration = {
      _command,
      registeredAt: new Date(),
      usageCount: 0,
      enabled: true,
      _metadata: this.extractCommandMetadata(_command),
    };

    // Register _command
    this.commands.set(command.name, _registration);

    // Register aliases
    const _commandMetadata = command.getMetadata();
    if (_commandMetadata.aliases) {
      for (const alias of _commandMetadata.aliases) {
        if (this.aliases.has(alias)) {
          this.executionContext.logger.warn(
            `Alias ${alias} already exists. Overriding.`,
          );
        }
        this.aliases.set(alias, command.name);
      }
    }

    // Update _category index
    const _category = command._category;
    if (!this.categories.has(_category)) {
      this.categories.set(_category, new Set());
    }
    this.categories.get(_category)!.add(command.name);

    // Update tag index
    for (const tag of _registration.metadata.tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag)!.add(command.name);
    }

    this.metrics.recordRegistration(command.name, _category);

    this.eventBus.publish(
      createEvent("_command:registered", "registry", {
        _commandName: command.name,
        _category,
        aliases: _commandMetadata.aliases || [],
        tags: _registration.metadata.tags,
      }),
    );

    this.executionContext.logger.info(`Registered _command: ${command.name}`, {
      _category,
      aliases: _commandMetadata.aliases,
      tags: _registration.metadata.tags,
      version: _registration.metadata.version,
    });
  }

  unregister(name: string): void {
    this.validateNotDisposed();

    const _registration = this.commands.get(name);
    if (!_registration) {
      this.executionContext.logger.warn(
        `Command ${name} not found for unregistration`,
      );
      return;
    }

    // Remove from commands
    this.commands.delete(name);

    // Remove aliases
    const _commandMetadata = _registration.command.getMetadata();
    if (_commandMetadata.aliases) {
      for (const alias of _commandMetadata.aliases) {
        this.aliases.delete(alias);
      }
    }

    // Update _category index
    const _category = _registration.command._category;
    const _categoryCommands = this.categories.get(_category);
    if (_categoryCommands) {
      categoryCommands.delete(name);
      if (_categoryCommands.size === 0) {
        this.categories.delete(_category);
      }
    }

    // Update tag index
    for (const tag of _registration.metadata.tags) {
      const _tagCommands = this.tags.get(tag);
      if (_tagCommands) {
        tagCommands.delete(name);
        if (_tagCommands.size === 0) {
          this.tags.delete(tag);
        }
      }
    }

    this.metrics.recordUnregistration(name, _category);

    this.eventBus.publish(
      createEvent("_command:unregistered", "registry", {
        _commandName: name,
        _category,
      }),
    );

    this.executionContext.logger.info(`Unregistered _command: ${name}`);
  }

  // Retrieval Methods
  get<T extends BaseCommand>(name: string): T | undefined {
    this.validateNotDisposed();

    // Resolve alias
    const _actualName = this.resolveAlias(name) || name;
    const _registration = this.commands.get(_actualName);

    if (!_registration) {
      return undefined;
    }

    if (!_registration.enabled) {
      this.executionContext.logger.warn(`Command ${_actualName} is disabled`);
      return undefined;
    }

    // Update usage metrics
    if (this.options.enableMetrics) {
      this.updateUsageMetrics(_actualName);
    }

    return _registration.command as T;
  }

  getAll(): BaseCommand[] {
    this.validateNotDisposed();

    return Array.from(this.commands.values())
      .filter((reg) => reg.enabled)
      .map((reg) => reg.command);
  }

  getByCategory(_category: CommandCategory): BaseCommand[] {
    this.validateNotDisposed();

    const _commandNames = this.categories.get(_category);
    if (!_commandNames) {
      return [];
    }

    return Array.from(_commandNames)
      .map((name) => this.commands.get(name))
      .filter(
        (reg): reg is CommandRegistration => reg !== undefined && reg.enabled,
      )
      .map((reg) => reg.command);
  }

  // Search Methods
  search(options: CommandSearchOptions): BaseCommand[] {
    this.validateNotDisposed();

    let results = Array.from(this.commands.values());

    // Filter by enabled status
    if (!options.includeDisabled) {
      results = results.filter((reg) => reg.enabled);
    }

    // Filter by experimental status
    if (!options.includeExperimental) {
      results = results.filter((reg) => !reg.metadata.experimental);
    }

    // Filter by deprecated status
    if (!options.includeDeprecated) {
      results = results.filter((reg) => !reg.metadata.deprecated);
    }

    // Filter by _category
    if (options.category) {
      results = results.filter(
        (reg) => reg.command.category === options.category,
      );
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter((reg) =>
        options.tags!.some((tag) => reg.metadata.tags.includes(tag)),
      );
    }

    // Filter by name _pattern
    if (options.namePattern) {
      const _pattern = new RegExp(options.namePattern, "i");
      results = results.filter(
        (reg) =>
          _pattern.test(reg.command.name) ||
          pattern.test(reg.command.description),
      );
    }

    return results.map((reg) => reg.command);
  }

  findSimilarCommands(_name: string, limit: number = 5): BaseCommand[] {
    this.validateNotDisposed();

    const _allCommands = this.getAll();
    const _similarities = _allCommands.map((_command) => ({
      _command,
      score: this.calculateSimilarity(_name, command._name),
    }));

    similarities.sort((a, b) => b.score - a.score);

    return _similarities
      .slice(0, limit)
      .filter((sim) => sim.score > 0.3) // Minimum similarity threshold
      .map((sim) => sim.command);
  }

  // Utility Methods
  hasCommand(name: string): boolean {
    this.validateNotDisposed();

    const _actualName = this.resolveAlias(name) || name;
    const _registration = this.commands.get(_actualName);

    return _registration !== undefined && _registration.enabled;
  }

  resolveAlias(alias: string): string | undefined {
    return this.aliases.get(alias);
  }

  enableCommand(name: string): void {
    this.validateNotDisposed();

    const _registration = this.commands.get(name);
    if (_registration) {
      registration.enabled = true;
      this.executionContext.logger.info(`Enabled _command: ${name}`);

      this.eventBus.publish(
        createEvent("_command:enabled", "registry", {
          _commandName: name,
        }),
      );
    }
  }

  disableCommand(name: string): void {
    this.validateNotDisposed();

    const _registration = this.commands.get(name);
    if (_registration) {
      registration.enabled = false;
      this.executionContext.logger.info(`Disabled _command: ${name}`);

      this.eventBus.publish(
        createEvent("_command:disabled", "registry", {
          _commandName: name,
        }),
      );
    }
  }

  // Command Execution
  async executeCommand<TOptions, TResult>(
    name: string,
    options: TOptions,
    userId: string = "anonymous",
  ): Promise<TResult> {
    this.validateNotDisposed();

    const _command = this.get<BaseCommand<TOptions, TResult>>(name);
    if (!_command) {
      throw new CommandNotFoundError(`Command not found: ${name}`);
    }

    const _context = {
      options,
      userId,
      traceId: this.generateTraceId(),
      timestamp: new Date(),
      environment:
        (process.env.NODE_ENV as "development" | "production" | "test") ||
        "development",
      session: {
        id: this.generateSessionId(),
        startTime: new Date(),
        lastActivity: new Date(),
        commandHistory: [],
        preferences: {
          theme: "dark" as const,
          verbosity: "normal" as const,
          confirmations: true,
          streamOutput: true,
        },
      },
    };

    const _result = await _command.safeExecute(_context);

    if (!_result.success) {
      throw new CommandExecutionError(
        `Command execution failed: ${_result.error?.message}`,
        _result.error,
      );
    }

    return _result.data as TResult;
  }

  // Metadata and Statistics
  getRegistrationInfo(name: string): CommandRegistration | undefined {
    return this.commands.get(name);
  }

  getCategories(): CommandCategory[] {
    return Array.from(this.categories.keys());
  }

  getTags(): string[] {
    return Array.from(this.tags.keys());
  }

  getAliases(): Record<string, string> {
    return Object.fromEntries(this.aliases);
  }

  getStatistics(): CommandRegistryStatistics {
    const _registrations = Array.from(this.commands.values());

    return {
      totalCommands: this.commands.size,
      enabledCommands: _registrations.filter((r) => r.enabled).length,
      disabledCommands: _registrations.filter((r) => !r.enabled).length,
      experimentalCommands: _registrations.filter(
        (r) => r.metadata.experimental,
      ).length,
      deprecatedCommands: _registrations.filter((r) => r.metadata.deprecated)
        .length,
      totalAliases: this.aliases.size,
      categoriesCount: this.categories.size,
      tagsCount: this.tags.size,
      averageUsageCount:
        _registrations.reduce((sum, r) => sum + r.usageCount, 0) /
        _registrations.length,
      mostUsedCommand: this.findMostUsedCommand(),
    };
  }

  getMetrics(): CommandRegistryMetricsData {
    return this.metrics.getMetrics();
  }

  // Private Helper Methods
  private extractCommandMetadata(
    _command: BaseCommand,
  ): CommandRegistrationMetadata {
    const _metadata = _command.getMetadata();

    return {
      version: _metadata.quality?.lastUpdated?.toISOString() || "1.0.0",
      tags: _metadata.tags,
      dependencies: _metadata.dependencies,
      permissions: _metadata.runtimeRequirements.permissions.map((p) => p.name),
      experimental: _metadata.tags.includes("experimental"),
      deprecated: _metadata.tags.includes("deprecated"),
    };
  }

  private validateNotDisposed(): void {
    if (this.disposed) {
      throw new CommandRegistryError("Command registry has been disposed");
    }
  }

  private validateCommand(_command: BaseCommand): void {
    if (!_command.name) {
      throw new CommandRegistryError("Command name is required");
    }

    if (!_command.description) {
      throw new CommandRegistryError("Command description is required");
    }

    if (this.options.enableValidation) {
      // Additional validation can be added here
      try {
        _command.getHelp();
        command.getMetadata();
      } catch (error) {
        throw new CommandRegistryError(
          `Command validation failed: ${error.message}`,
        );
      }
    }
  }

  private updateUsageMetrics(_commandName: string): void {
    const _registration = this.commands.get(_commandName);
    if (_registration) {
      _registration.usageCount++;
      registration.lastUsed = new Date();
      this.metrics.recordUsage(_commandName);
    }
  }

  private calculateSimilarity(_str1: string, str2: string): number {
    // Simple Levenshtein _distance-based similarity
    const _distance = this.levenshteinDistance(
      _str1.toLowerCase(),
      str2.toLowerCase(),
    );
    const _maxLength = Math.max(_str1.length, str2.length);
    return _maxLength === 0 ? 1 : (_maxLength - _distance) / _maxLength;
  }

  private levenshteinDistance(_str1: string, str2: string): number {
    const _matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(_str1.length + 1).fill(null));

    for (let i = 0; i <= _str1.length; i++) {
      _matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      _matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= _str1.length; i++) {
        const _indicator = _str1[i - 1] === str2[j - 1] ? 0 : 1;
        _matrix[j][i] = Math.min(
          _matrix[j][i - 1] + 1,
          _matrix[j - 1][i] + 1,
          _matrix[j - 1][i - 1] + _indicator,
        );
      }
    }

    return _matrix[str2.length][_str1.length];
  }

  private findMostUsedCommand(): string | undefined {
    let maxUsage = 0;
    let mostUsedCommand: string | undefined;

    for (const [name, _registration] of this.commands) {
      if (registration.usageCount > maxUsage) {
        maxUsage = registration.usageCount;
        mostUsedCommand = name;
      }
    }

    return mostUsedCommand;
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup
  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.executionContext.logger.info("Disposing Command Registry...");

    // Clear all data structures
    this.commands.clear();
    this.aliases.clear();
    this.categories.clear();
    this.tags.clear();

    this.disposed = true;
    this.executionContext.logger.info("Command Registry disposed successfully");
  }
}

// Metrics Collection
class CommandRegistryMetrics {
  private _registrations = new Map<string, Date>();
  private unregistrations = new Map<string, Date>();
  private usages = new Map<string, number>();
  private categories = new Map<CommandCategory, number>();

  recordRegistration(_commandName: string, _category: CommandCategory): void {
    this.registrations.set(_commandName, new Date());
    this.categories.set(_category, (this.categories.get(_category) || 0) + 1);
  }

  recordUnregistration(_commandName: string, _category: CommandCategory): void {
    this.unregistrations.set(_commandName, new Date());
    const _count = this.categories.get(_category) || 0;
    if (_count > 0) {
      this.categories.set(_category, _count - 1);
    }
  }

  recordUsage(_commandName: string): void {
    this.usages.set(_commandName, (this.usages.get(_commandName) || 0) + 1);
  }

  getMetrics(): CommandRegistryMetricsData {
    return {
      registrationsCount: this.registrations.size,
      unregistrationsCount: this.unregistrations.size,
      totalUsages: Array.from(this.usages.values()).reduce(
        (sum, _count) => sum + _count,
        0,
      ),
      usagesByCommand: Object.fromEntries(this.usages),
      commandsByCategory: Object.fromEntries(this.categories),
      mostUsedCommands: this.getMostUsedCommands(5),
    };
  }

  private getMostUsedCommands(
    limit: number,
  ): Array<{ _command: string; usages: number }> {
    return Array.from(this.usages.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([_command, usages]) => ({ _command, usages }));
  }
}

// Interfaces
export interface CommandRegistryStatistics {
  totalCommands: number;
  enabledCommands: number;
  disabledCommands: number;
  experimentalCommands: number;
  deprecatedCommands: number;
  totalAliases: number;
  categoriesCount: number;
  tagsCount: number;
  averageUsageCount: number;
  mostUsedCommand?: string;
}

export interface CommandRegistryMetricsData {
  registrationsCount: number;
  unregistrationsCount: number;
  totalUsages: number;
  usagesByCommand: Record<string, number>;
  commandsByCategory: Record<string, number>;
  mostUsedCommands: Array<{ _command: string; usages: number }>;
}

// Error Classes
export class CommandRegistryError extends Error {
  constructor(_message: string) {
    super(_message);
    this.name = "CommandRegistryError";
  }
}

export class CommandNotFoundError extends CommandRegistryError {
  constructor(_message: string) {
    super(_message);
    this.name = "CommandNotFoundError";
  }
}

export class CommandExecutionError extends CommandRegistryError {
  constructor(
    _message: string,
    public cause?: unknown,
  ) {
    super(_message);
    this.name = "CommandExecutionError";
  }
}

// Factory function
export function createCommandRegistry(
  _container: DIContainer,
  eventBus: EventBus,
  _options?: CommandRegistryOptions,
): CommandRegistry {
  return new CommandRegistry(_container, eventBus, _options);
}
