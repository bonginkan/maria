/**
 * Slash Command Manager
 * Central manager for all command services with backward compatibility
 */

import { BaseCommandService } from "./shared/BaseCommandService";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandCategory,
} from "./types";
import { ConversationContext } from "../types/conversation";
import { SlashCommandResult } from "../services/slash-command-handler";
import { logger } from "../utils/logger";
import { getCommandInfo } from "../lib/command-groups";
import { withAuth, AUTH_EXEMPT_COMMANDS } from "../services/cli-auth";
import { isLegacyCommand, shieldLegacyCommand } from "./shared/legacy-shield";
import chalk from "chalk";

// Legacy handler interface for type safety
type LegacyHandler = {
  handleCommand: (
    command: string,
    args: string[],
    context: ConversationContext,
  ) => Promise<SlashCommandResult>;
};

// Migration configuration - controls which commands use new vs legacy system
const _MIGRATION_CONFIG = {
  "/clear": true, // ✅ Already migrated
  "/setup": true, // ✅ Already migrated
  "/help": true, // ✅ Phase 4 - Core commands migrated
  "/version": true, // ✅ Phase 4 - Core commands migrated
  "/exit": true, // ✅ Phase 4 - Core commands migrated
  "/status": true, // ✅ Phase 2 - V2 stub implemented
  "/doctor": true, // ✅ Phase 2 - V2 stub implemented
  "/config": true, // ✅ Configuration commands migrated
  "/model": true, // ✅ Model commands migrated
  // Phase 3 - Memory commands migration
  "/remember": true, // ✅ Memory commands migrated
  "/recall": true, // ✅ Memory commands migrated
  "/forget": true, // ✅ Memory commands migrated
  "/memory-status": true, // ✅ Memory commands migrated
  "/memory": true, // ✅ Memory alias migrated
  // Auth commands - Phase 7
  "/login": true, // ✅ Authentication commands migrated
  "/logout": true, // ✅ Authentication commands migrated
  "/auth": true, // ✅ Auth alias migrated
  "/signin": true, // ✅ SignIn alias migrated
  "/signout": true, // ✅ SignOut alias migrated
  // Multimodal commands
  "/image": true, // ✅ Multimodal commands migrated
  "/video": true, // ✅ Multimodal commands migrated  
  "/voice": true, // ✅ Multimodal commands migrated
  // ... will be updated as phases progress
};

export class SlashCommandManager {
  private services: Map<CommandCategory, BaseCommandService> = new Map();
  private migrationFlags: Map<string, boolean> = new Map();
  private legacyHandler?: LegacyHandler; // Reference to legacy SlashCommandHandler

  constructor() {
    this.initializeMigrationFlags();
    this.loadMigrationOverrides();
    this.initializeServices();
  }

  /**
   * Initialize migration flags from configuration
   */
  private initializeMigrationFlags(): void {
    for (const [command, migrated] of Object.entries(_MIGRATION_CONFIG)) {
      this.migrationFlags.set(command, migrated);
    }
  }

  /**
   * Load migration overrides from environment variables
   */
  private loadMigrationOverrides(): void {
    // Support MIGRATE_ALL=true for mass migration
    const migrateAll = process.env.MIGRATE_ALL === "true";
    if (migrateAll) {
      for (const key of this.migrationFlags.keys()) {
        this.migrationFlags.set(key, true);
      }
      logger.info("Migration enabled for all commands via MIGRATE_ALL");
    }

    // Support MIGRATE_ONLY=/help,/version for selective migration
    const migrateOnly =
      process.env.MIGRATE_ONLY?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    for (const command of migrateOnly) {
      this.migrationFlags.set(command, true);
      logger.info(`Migration enabled for ${command} via MIGRATE_ONLY`);
    }
  }

  /**
   * Initialize all command services
   */
  private initializeServices(): void {
    // Note: These services are not yet implemented in the new microservices architecture
    // They will be added as the migration progresses
    // For now, we'll comment them out to avoid runtime warnings
    
    // TODO: Implement CoreCommandService
    // import("./categories/core/CoreCommandService").then(({ CoreCommandService }) => {
    //   const coreService = new CoreCommandService();
    //   this.registerService("core", coreService);
    // }).catch(err => logger.warn("Failed to load CoreCommandService:", err));

    // TODO: Implement ConfigurationCommandService
    // import("./categories/configuration/ConfigurationCommandService").then(({ ConfigurationCommandService }) => {
    //   const configService = new ConfigurationCommandService();
    //   this.registerService("configuration", configService);
    //   logger.info("ConfigurationCommandService registered");
    // }).catch(err => logger.warn("Failed to load ConfigurationCommandService:", err));

    // Import and register development services (includes memory commands - Phase 3)
    import("./categories/memory/MemoryCommandService").then(({ MemoryCommandService }) => {
      const memoryService = new MemoryCommandService();
      this.registerService("development", memoryService);
      logger.info("MemoryCommandService registered under development category");
    }).catch(err => logger.warn("Failed to load MemoryCommandService:", err));

    // TODO: Implement MultimodalCommandService
    // import("./categories/multimodal/MultimodalCommandService").then(({ MultimodalCommandService }) => {
    //   const multimodalService = new MultimodalCommandService();
    //   this.registerService("multimodal", multimodalService);
    //   logger.info("MultimodalCommandService registered");
    // }).catch(err => logger.warn("Failed to load MultimodalCommandService:", err));

    // TODO: Implement AuthCommandService - Phase 7
    // import("./categories/auth/AuthCommandService").then(({ AuthCommandService }) => {
    //   const authService = new AuthCommandService();
    //   this.registerService("auth", authService);
    //   logger.info("AuthCommandService registered with Phase 7 features");
    // }).catch(err => logger.warn("Failed to load AuthCommandService:", err));

    logger.info("SlashCommandManager initialized");
  }

  /**
   * Register a command _service
   */
  registerService(
    _category: CommandCategory,
    _service: BaseCommandService,
  ): void {
    this.services.set(_category, _service);
    logger.info(`Registered command _service: ${_category}`);
  }

  /**
   * Set legacy handler for fallback
   */
  setLegacyHandler(handler: LegacyHandler): void {
    this.legacyHandler = handler;
    logger.info("Legacy handler registered for fallback");
  }

  /**
   * Main command execution method with backward compatibility
   */
  async handleCommand(
    command: string,
    args: string[],
    context: ConversationContext,
  ): Promise<SlashCommandResult> {
    const _commandName = command.startsWith("/") ? command : `/${command}`;

    // Check if command requires authentication
    if (this.requiresAuth(_commandName)) {
      // Wrap the entire execution with auth check
      const authenticatedExecution = withAuth(async () => {
        return this.executeCommandInternal(_commandName, args, context);
      });
      
      try {
        return await authenticatedExecution();
      } catch (error: any) {
        // Auth errors are already handled by withAuth and will exit the process
        // This catch is for non-auth errors that might bubble up
        return this.handleExecutionError(_commandName, error);
      }
    }

    // Execute without authentication (exempt commands)
    return this.executeCommandInternal(_commandName, args, context);
  }

  /**
   * Check if command requires authentication
   */
  private requiresAuth(command: string): boolean {
    const normalizedCommand = command.toLowerCase().replace(/^\/+/, '/');
    return !AUTH_EXEMPT_COMMANDS.some(exempt =>
      normalizedCommand === exempt ||
      normalizedCommand.startsWith(exempt + ' ')
    );
  }

  /**
   * Internal command execution logic
   */
  private async executeCommandInternal(
    _commandName: string,
    args: string[],
    context: ConversationContext,
  ): Promise<SlashCommandResult> {
    try {
      // Check if command is legacy and should be shielded
      if (isLegacyCommand(_commandName)) {
        return shieldLegacyCommand(_commandName);
      }

      // Check if command should use new system
      if (this.migrationFlags.get(_commandName)) {
        logger.debug(`Using new system for ${_commandName}`);
        return await this.executeInNewSystem(_commandName, args, context);
      }

      // Fallback to legacy system
      logger.debug(`Using legacy system for ${_commandName}`);
      return await this.executeInLegacySystem(_commandName, args, context);
    } catch (error) {
      return this.handleExecutionError(_commandName, error);
    }
  }

  /**
   * Handle execution errors
   */
  private handleExecutionError(_commandName: string, error: any): SlashCommandResult {
    // Handle specific error types with graceful degradation
    if (error && typeof error === "object" && "name" in error) {
      if (error.name === "RateLimitError") {
        return {
          success: false,
          message: error.message || "Rate limit exceeded",
          data: { retryAfter: (error as any).retryAfter },
        };
      }
    }

    // Fallback to legacy for NotImplemented errors only
    if (error instanceof Error && error.message.includes("NotImplemented")) {
      logger.warn(
        `Feature not implemented in new system, falling back: ${_commandName}`,
      );
      return this.executeInLegacySystem(_commandName, [], {
        history: [],
        sessionId: "fallback"
      } as ConversationContext);
    }

    logger.error(`Command execution failed: ${_commandName}`, error);

    return {
      success: false,
      message: `Command execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }

  /**
   * Execute command in new microservices system
   */
  private async executeInNewSystem(
    command: string,
    args: string[],
    context: ConversationContext,
  ): Promise<SlashCommandResult> {
    // Determine which _service handles this command
    const _category = this.getCommandCategory(command);
    const _service = this.services.get(_category);

    if (!_service) {
      // Service not yet implemented, fallback to legacy
      logger.warn(
        `Service ${_category} not implemented for ${command}, falling back to legacy`,
      );
      return await this.executeInLegacySystem(command, args, context);
    }

    // Convert context and args to new system format
    const _newContext = this.adaptContext(context);
    const _newArgs = this.parseArguments(args);

    // Execute in new system
    const _result = await _service.executeCommand(
      command,
      _newArgs,
      _newContext,
    );

    // Convert _result back to legacy format
    return this.adaptResult(_result);
  }

  /**
   * Execute command in legacy system
   */
  private async executeInLegacySystem(
    command: string,
    args: string[],
    context: ConversationContext,
  ): Promise<SlashCommandResult> {
    if (!this.legacyHandler) {
      throw new Error("Legacy handler not available");
    }

    return await this.legacyHandler.handleCommand(command, args, context);
  }

  /**
   * Determine which _service _category handles a command using single source of truth
   */
  private getCommandCategory(command: string): CommandCategory {
    // Use command-groups.ts as the single source of truth
    const commandInfo = getCommandInfo(command);

    if (commandInfo) {
      return commandInfo.category;
    }

    // Fallback for unknown commands
    logger.warn(
      `Command ${command} not found in command registry, defaulting to 'core'`,
    );
    return "core";
  }

  /**
   * Convert legacy context to new system format with memory safety
   */
  private adaptContext(legacyContext: ConversationContext): CommandContext {
    // Limit history to prevent OOM (keep only last 50 entries)
    const history = Array.isArray(legacyContext.history)
      ? legacyContext.history.slice(-50)
      : [];

    return {
      user: legacyContext.user
        ? {
            id: legacyContext.user.id,
            email: legacyContext.user.email,
            role: legacyContext.user.role || undefined,
          }
        : null,
      session: {
        id: legacyContext.sessionId || "unknown",
        commandHistory: [], // Could be extracted from legacyContext if needed
      },
      conversation: { history },
      environment: {
        cwd: process.cwd(),
      },
    };
  }

  /**
   * Parse string arguments to new system format
   */
  private parseArguments(args: string[]): CommandArgs {
    const parsed: CommandArgs = {
      raw: args,
      parsed: {} as Record<string, any>,
      flags: {} as Record<string, any>,
      options: {} as Record<string, any>,
    };

    const positional: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const token = args[i];
      if (!token) continue;

      if (token.startsWith("--")) {
        const key = token.slice(2);
        const peek = args[i + 1];

        if (peek && !peek.startsWith("-")) {
          parsed.options[key] = peek;
          i++;
        } else {
          parsed.flags[key] = true;
        }
      } else if (token.startsWith("-") && token.length === 2) {
        parsed.flags[token.slice(1)] = true;
      } else {
        positional.push(token);
      }
    }

    if (positional.length > 0) {
      parsed.parsed["_positional"] = positional;
    }

    return parsed;
  }

  /**
   * Convert new system _result to legacy format
   */
  private adaptResult(newResult: CommandResult): SlashCommandResult {
    return {
      success: newResult.success,
      message: newResult.message,
      data: newResult.data,
      component: newResult.component, // Preserve metadata
    };
  }

  /**
   * Enable migration for a command (used during phase rollouts)
   */
  enableMigration(command: string): void {
    this.migrationFlags.set(command, true);
    logger.info(`Enabled migration for command: ${command}`);
  }

  /**
   * Disable migration for a command (rollback if needed)
   */
  disableMigration(command: string): void {
    this.migrationFlags.set(command, false);
    logger.info(`Disabled migration for command: ${command}`);
  }

  /**
   * Get migration status
   */
  getMigrationStatus(): Record<string, boolean> {
    return Object.fromEntries(this.migrationFlags.entries());
  }

  /**
   * Get _service statistics with migration coverage
   */
  getServiceStats() {
    const migrationCount = { migrated: 0, legacy: 0 };
    for (const [, migrated] of this.migrationFlags) {
      if (migrated) {
        migrationCount.migrated++;
      } else {
        migrationCount.legacy++;
      }
    }

    const _stats = {
      totalServices: this.services.size,
      totalCommands: 0,
      serviceDetails: Record<string, any> as Record<string, any>,
      migrationCoverage: {
        ...migrationCount,
        percentage: Math.round(
          (migrationCount.migrated /
            (migrationCount.migrated + migrationCount.legacy)) *
            100,
        ),
      },
    };

    for (const [_category, svc] of this.services) {
      const info = svc.getServiceInfo?.() ?? { commandCount: 0 };
      _stats.totalCommands += info.commandCount ?? 0;
      _stats.serviceDetails[_category] = info;
    }

    return _stats;
  }
}
