/**
 * RouterIntegrator
 * Seamlessly integrates V2 commands with the existing router system
 * Provides drop-in replacement and gradual migration capabilities
 */

import type {
  SlashCommandV2,
  HandlerDependencies,
} from "../SlashCommandHandler";
import {
  RouterBridge,
  V2CommandRegistry,
  RouterIntegration,
} from "../bridge/RouterBridge";
import { createHelpCommand } from "../commands/HelpCommandV2";
import { createClearCommand } from "../commands/ClearCommandV2";

// Import existing services for dependency creation
import { AIProviderManager } from "../../../services/ai-provider-manager.service";
import { DualMemoryEngine } from "../../../services/memory-system/dual-engine";
import { ChatContextService } from "../../../services/chat-context.service";
import * as ui from "../../../ui";

// Import adapters
import {
  AIProviderAdapter,
  MemoryAdapter,
  ChatContextAdapter,
  CliUiAdapter,
} from "../../adapters";

/**
 * Configuration for router integration
 */
export interface RouterIntegrationConfig {
  // Enable gradual rollout with percentage-based traffic splitting
  gradualRollout: {
    [commandName: string]: number; // 0.0 to 1.0 (0% to 100%)
  };

  // Fallback behavior when V2 commands fail
  fallbackToLegacy: boolean;

  // Enable comprehensive logging and metrics
  enableMetrics: boolean;

  // Custom dependency injection
  customDependencies?: Partial<HandlerDependencies>;
}

/**
 * Migration status tracking
 */
interface MigrationStatus {
  totalCommands: number;
  migratedCommands: number;
  activeCommands: string[];
  rolloutPercentages: Record<string, number>;
  healthMetrics: {
    successRate: number;
    fallbackRate: number;
    avgResponseTime: number;
    errorCount: number;
  };
}

/**
 * Main router integrator class
 */
export class RouterIntegrator {
  private registry: V2CommandRegistry;
  private bridge: RouterBridge;
  private config: RouterIntegrationConfig;
  private migrationStatus: MigrationStatus;
  private legacyCommandStore: Map<string, any> = new Map();

  constructor(
    config: RouterIntegrationConfig = {
      gradualRollout: {},
      fallbackToLegacy: true,
      enableMetrics: true,
    },
  ) {
    this.config = config;
    this.migrationStatus = this.initializeMigrationStatus();

    // Create dependencies from existing services
    const deps = this.createDependencies();

    this.registry = new V2CommandRegistry(deps);
    this.bridge = new RouterBridge(deps);
  }

  /**
   * Initialize migration status
   */
  private initializeMigrationStatus(): MigrationStatus {
    return {
      totalCommands: 0,
      migratedCommands: 0,
      activeCommands: [],
      rolloutPercentages: {},
      healthMetrics: {
        successRate: 1.0,
        fallbackRate: 0.0,
        avgResponseTime: 0,
        errorCount: 0,
      },
    };
  }

  /**
   * Create handler dependencies from existing services
   */
  private createDependencies(): HandlerDependencies {
    // Use custom dependencies if provided, otherwise create from existing services
    const baseDeps = {
      provider: new AIProviderAdapter(new AIProviderManager()),
      memory: new MemoryAdapter(new DualMemoryEngine()),
      context: new ChatContextAdapter(ChatContextService.getInstance()),
      ui: new CliUiAdapter(ui),
    };

    return {
      ...baseDeps,
      ...this.config.customDependencies,
    };
  }

  /**
   * Register initial V2 commands
   */
  async initializeV2Commands(): Promise<void> {
    // Register the migrated commands
    const commandsToRegister = [createHelpCommand(), createClearCommand()];

    for (const v2Command of commandsToRegister) {
      this.registerV2Command(v2Command);
    }

    this.migrationStatus.totalCommands = commandsToRegister.length;
    this.migrationStatus.migratedCommands = commandsToRegister.length;
  }

  /**
   * Register a V2 command with the system
   */
  registerV2Command(v2Command: SlashCommandV2): void {
    // Register with V2 registry
    const legacyCommand = this.registry.register(v2Command);

    // Store for potential fallback
    this.legacyCommandStore.set(v2Command.name, legacyCommand);

    // Add to active commands
    if (!this.migrationStatus.activeCommands.includes(v2Command.name)) {
      this.migrationStatus.activeCommands.push(v2Command.name);
    }

    // Set initial rollout percentage
    if (!this.config.gradualRollout[v2Command.name]) {
      this.config.gradualRollout[v2Command.name] = 0.1; // Start with 10%
    }

    console.log(
      `✅ Registered V2 command: ${v2Command.name} (${(this.config.gradualRollout[v2Command.name]! * 100).toFixed(1)}% rollout)`,
    );
  }

  /**
   * Create a smart command handler that supports gradual rollout
   */
  createSmartHandler(
    commandName: string,
  ): (args: string[], options?: any) => Promise<any> {
    return async (args: string[], options: any = {}) => {
      const rolloutPercentage = this.config.gradualRollout[commandName] || 0;
      const shouldUseV2 = Math.random() < rolloutPercentage;

      if (shouldUseV2 && this.registry.has(commandName)) {
        try {
          // Use V2 command
          const legacyCommand = this.legacyCommandStore.get(commandName);
          if (legacyCommand) {
            const result = await legacyCommand.handler(args, options);

            // Update metrics
            this.updateMetrics(commandName, true, false);

            return result;
          }
        } catch (error) {
          // Log V2 error
          console.warn(`V2 command ${commandName} failed:`, error);

          // Update metrics
          this.updateMetrics(commandName, false, true);

          // Fallback to legacy if enabled
          if (this.config.fallbackToLegacy) {
            return this.executeLegacyFallback(commandName, args, options);
          }

          throw error;
        }
      }

      // Use legacy command (either by choice or fallback)
      return this.executeLegacyFallback(commandName, args, options);
    };
  }

  /**
   * Execute legacy command as fallback
   */
  private async executeLegacyFallback(
    commandName: string,
    args: string[],
    options: any,
  ): Promise<any> {
    // This would integrate with the existing legacy command system
    // For now, return a placeholder
    console.log(`Executing legacy fallback for ${commandName}`);

    return {
      ok: true,
      message: `Legacy ${commandName} command executed`,
      requiresInput: false,
      endReason: "completed",
    };
  }

  /**
   * Update command execution metrics
   */
  private updateMetrics(
    commandName: string,
    success: boolean,
    usedFallback: boolean,
  ): void {
    if (!this.config.enableMetrics) return;

    const metrics = this.migrationStatus.healthMetrics;

    if (success) {
      metrics.successRate = (metrics.successRate + 1) / 2; // Simple moving average
    } else {
      metrics.errorCount += 1;
      metrics.successRate = metrics.successRate * 0.95; // Decay on error
    }

    if (usedFallback) {
      metrics.fallbackRate = (metrics.fallbackRate + 0.1) / 2;
    } else {
      metrics.fallbackRate = metrics.fallbackRate * 0.95;
    }

    // Log metrics periodically
    if (metrics.errorCount % 10 === 0) {
      console.log(`📊 Migration metrics for ${commandName}:`, {
        successRate: (metrics.successRate * 100).toFixed(1) + "%",
        fallbackRate: (metrics.fallbackRate * 100).toFixed(1) + "%",
        errorCount: metrics.errorCount,
      });
    }
  }

  /**
   * Gradually increase rollout percentage
   */
  increaseRollout(commandName: string, increment: number = 0.1): void {
    const current = this.config.gradualRollout[commandName] || 0;
    const newPercentage = Math.min(1.0, current + increment);

    this.config.gradualRollout[commandName] = newPercentage;
    this.migrationStatus.rolloutPercentages[commandName] = newPercentage;

    console.log(
      `📈 Increased rollout for ${commandName}: ${(newPercentage * 100).toFixed(1)}%`,
    );
  }

  /**
   * Decrease rollout percentage (in case of issues)
   */
  decreaseRollout(commandName: string, decrement: number = 0.1): void {
    const current = this.config.gradualRollout[commandName] || 0;
    const newPercentage = Math.max(0, current - decrement);

    this.config.gradualRollout[commandName] = newPercentage;
    this.migrationStatus.rolloutPercentages[commandName] = newPercentage;

    console.log(
      `📉 Decreased rollout for ${commandName}: ${(newPercentage * 100).toFixed(1)}%`,
    );
  }

  /**
   * Get current migration status
   */
  getMigrationStatus(): MigrationStatus {
    return { ...this.migrationStatus };
  }

  /**
   * Create integration for existing router systems
   */
  createRouterIntegration(): {
    registerCommand: (name: string, handler: any) => void;
    getCommand: (name: string) => any;
    listCommands: () => string[];
    getMigrationStatus: () => MigrationStatus;
  } {
    return {
      registerCommand: (name: string, handler: any) => {
        // This would integrate with existing router registration
        console.log(`Registering command ${name} with existing router`);
      },

      getCommand: (name: string) => {
        return this.createSmartHandler(name);
      },

      listCommands: () => {
        return this.migrationStatus.activeCommands;
      },

      getMigrationStatus: () => {
        return this.getMigrationStatus();
      },
    };
  }

  /**
   * Health check for migration
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  }> {
    const metrics = this.migrationStatus.healthMetrics;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (metrics.successRate < 0.95) {
      status = "degraded";
    }

    if (metrics.successRate < 0.8 || metrics.fallbackRate > 0.5) {
      status = "unhealthy";
    }

    return {
      status,
      details: {
        migrationStatus: this.migrationStatus,
        config: {
          rolloutPercentages: this.config.gradualRollout,
          fallbackEnabled: this.config.fallbackToLegacy,
        },
      },
    };
  }

  /**
   * Emergency rollback - disable all V2 commands
   */
  emergencyRollback(): void {
    console.warn("🚨 Emergency rollback triggered - disabling all V2 commands");

    for (const commandName of this.migrationStatus.activeCommands) {
      this.config.gradualRollout[commandName] = 0;
    }

    console.log("✅ All V2 commands disabled, using legacy fallbacks only");
  }

  /**
   * Complete migration for a command (100% rollout)
   */
  completeMigration(commandName: string): void {
    this.config.gradualRollout[commandName] = 1.0;
    this.migrationStatus.rolloutPercentages[commandName] = 1.0;

    console.log(`✅ Migration completed for ${commandName}: 100% rollout`);
  }
}

/**
 * Factory function for easy router integration
 */
export function createRouterIntegration(
  config?: Partial<RouterIntegrationConfig>,
): RouterIntegrator {
  const integrator = new RouterIntegrator({
    gradualRollout: {
      help: 0.1, // Start with 10% for help
      clear: 0.05, // Start with 5% for clear
      h: 0.1, // Help alias
      "?": 0.1, // Help alias
      cls: 0.05, // Clear alias
      reset: 0.05, // Clear alias
    },
    fallbackToLegacy: true,
    enableMetrics: true,
    ...config,
  });

  return integrator;
}

/**
 * Integration helper for existing router systems
 */
export async function integrateWithExistingRouter(
  existingRouter: any,
  config?: Partial<RouterIntegrationConfig>,
): Promise<RouterIntegrator> {
  const integrator = createRouterIntegration(config);

  // Initialize V2 commands
  await integrator.initializeV2Commands();

  // Create smart handlers for migrated commands
  const migratedCommands = ["help", "clear", "h", "?", "cls", "reset"];

  for (const commandName of migratedCommands) {
    const smartHandler = integrator.createSmartHandler(commandName);

    // Register with existing router (this would be customized per router)
    if (existingRouter && typeof existingRouter.register === "function") {
      existingRouter.register(commandName, smartHandler);
    }
  }

  console.log(
    `🔄 Integrated ${migratedCommands.length} commands with existing router`,
  );

  return integrator;
}
