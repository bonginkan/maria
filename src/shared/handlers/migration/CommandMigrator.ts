/**
 * CommandMigrator
 * Helps migrate existing slash commands to the new V2 architecture
 */

import type { SlashCommandV2 } from "../SlashCommandHandler";
import type { CommandContext, CommandResult } from "../../types/context";
import type { HandlerDependencies } from "../SlashCommandHandler";

// Import existing services
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
 * Legacy command interface (existing commands)
 */
export interface LegacyCommand {
  name: string;
  aliases?: string[];
  description: string;
  category?: string;
  handler: (args: string[], options?: any) => Promise<any>;
}

/**
 * Migration configuration
 */
export interface MigrationConfig {
  providerManager?: AIProviderManager;
  memoryEngine?: DualMemoryEngine;
  contextService?: ChatContextService;
  uiModule?: typeof ui;
}

export class CommandMigrator {
  private deps: HandlerDependencies;

  constructor(config: MigrationConfig = {}) {
    // Create adapters from existing services
    this.deps = this.createDependencies(config);
  }

  /**
   * Create dependencies from existing services
   */
  private createDependencies(config: MigrationConfig): HandlerDependencies {
    // Use provided services or create defaults
    const providerManager = config.providerManager || new AIProviderManager();
    const memoryEngine = config.memoryEngine || new DualMemoryEngine();
    const contextService = config.contextService || new ChatContextService();
    const uiModule = config.uiModule || ui;

    return {
      provider: new AIProviderAdapter(providerManager),
      memory: new MemoryAdapter(memoryEngine),
      context: new ChatContextAdapter(contextService),
      ui: new CliUiAdapter(uiModule),
    };
  }

  /**
   * Migrate a legacy command to V2
   */
  migrateCommand(legacy: LegacyCommand): SlashCommandV2 {
    return {
      name: legacy.name,
      aliases: legacy.aliases,
      description: legacy.description,
      category: legacy.category || "general",
      execute: async (context: CommandContext): Promise<CommandResult> => {
        try {
          // Call legacy handler with backward compatibility
          const result = await legacy.handler(context.args, {
            ...context.options,
            // Pass adapted services for commands that need them
            providerManager: (this.deps.provider as any).manager,
            memoryEngine: (this.deps.memory as any).engine,
            contextService: (this.deps.context as any).service,
            ui: (this.deps.ui as any).ui,
          });

          // Convert legacy result to CommandResult
          return this.convertResult(result);
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Command failed",
            messages: [],
          };
        }
      },
    };
  }

  /**
   * Convert legacy result to CommandResult
   */
  private convertResult(legacyResult: any): CommandResult {
    // Handle different legacy result formats
    if (typeof legacyResult === "string") {
      return {
        success: true,
        messages: [
          {
            role: "assistant",
            content: legacyResult,
          },
        ],
      };
    }

    if (legacyResult && typeof legacyResult === "object") {
      // Check if it already looks like CommandResult
      if ("success" in legacyResult && "messages" in legacyResult) {
        return legacyResult as CommandResult;
      }

      // Convert other object formats
      return {
        success: !legacyResult.error,
        error: legacyResult.error,
        messages: legacyResult.messages || [
          {
            role: "assistant",
            content: legacyResult.content || JSON.stringify(legacyResult),
          },
        ],
      };
    }

    // Default case
    return {
      success: true,
      messages: [],
    };
  }

  /**
   * Batch migrate multiple commands
   */
  migrateCommands(commands: LegacyCommand[]): SlashCommandV2[] {
    return commands.map((cmd) => this.migrateCommand(cmd));
  }

  /**
   * Create a V2 command that wraps legacy behavior
   */
  wrapLegacyCommand(
    name: string,
    handler: (args: string[]) => Promise<string>,
  ): SlashCommandV2 {
    return {
      name,
      description: `Legacy command: ${name}`,
      category: "legacy",
      execute: async (context: CommandContext): Promise<CommandResult> => {
        try {
          const result = await handler(context.args);
          return {
            success: true,
            messages: [
              {
                role: "assistant",
                content: result,
              },
            ],
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Command failed",
            messages: [],
          };
        }
      },
    };
  }

  /**
   * Get the configured dependencies for custom commands
   */
  getDependencies(): HandlerDependencies {
    return this.deps;
  }
}

/**
 * Default migrator instance
 */
export const defaultMigrator = new CommandMigrator();

/**
 * Quick migration helper
 */
export function quickMigrate(legacy: LegacyCommand): SlashCommandV2 {
  return defaultMigrator.migrateCommand(legacy);
}
