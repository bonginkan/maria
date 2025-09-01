/**
 * Legacy Slash Command Adapter
 * Provides a bridge between legacy SlashCommandHandler calls and the new SlashCommandHandler
 */

import {
  SlashCommandHandler,
  type HandlerDependencies,
} from "../handlers/SlashCommandHandler";
import type { CommandResult } from "../types/result";
// Import through facade to avoid direct slash-commands imports

/**
 * Legacy adapter that provides the old getInstance() API
 * while using the new SlashCommandHandler internally
 */
export class LegacySlashCommandAdapter {
  private static instance: LegacySlashCommandAdapter | null = null;
  private handler: SlashCommandHandler;

  private constructor() {
    // Initialize with placeholder dependencies
    // In a full implementation, these should be properly injected
    const deps: HandlerDependencies = {
      provider: null as any,
      memory: null as any,
      context: null as any,
      ui: null as any,
    };

    this.handler = new SlashCommandHandler(deps);
    
    // Register essential commands
    this.registerEssentialCommands();
  }

  /**
   * Legacy getInstance method for backward compatibility
   */
  static getInstance(): LegacySlashCommandAdapter {
    if (!LegacySlashCommandAdapter.instance) {
      LegacySlashCommandAdapter.instance = new LegacySlashCommandAdapter();
    }
    return LegacySlashCommandAdapter.instance;
  }

  /**
   * Legacy handleCommand method that maps to the new execute method
   */
  async handleCommand(
    command: string,
    args: string[] = [],
    options: any = {},
  ): Promise<any> {
    try {
      const result = await this.handler.execute(command, args, {
        timeout: options.timeout,
        signal: options.signal,
      });

      // Transform result to legacy format if needed
      return {
        success: result.success,
        data: result.messages?.[0]?.content || "",
        error: result.error,
        messages: result.messages || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        messages: [],
      };
    }
  }

  /**
   * Register a command with the new handler
   */
  registerCommand(name: string, handler: any): void {
    // Convert legacy command format to new format
    const newCommand = {
      name,
      description: handler.description || `Command: ${name}`,
      category: handler.category || "general",
      execute: async (context: any) => {
        try {
          const result = await handler.execute(context.args, context);
          return {
            success: true,
            messages: [{ role: "assistant", content: result }],
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Command execution failed",
            messages: [],
          };
        }
      },
    };

    this.handler.register(newCommand);
  }

  /**
   * Register essential commands that should be available in legacy sessions
   */
  private registerEssentialCommands(): void {
    try {
      // Register help command
      // Create a simple help command without direct imports
      const helpCommandV2 = {
        name: "help",
        aliases: ["h", "?"],
        description: "Show available commands",
        category: "core",
        execute: async (context: any) => {
          try {
            // Delegate to the handler's built-in help functionality
            const result = await this.handler.execute("help", context.args || [], context);
            
            return {
              success: result.success,
              messages: [{ role: "assistant", content: result.message || result.data || "" }],
              error: result.error,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : "Help command failed",
              messages: [],
            };
          }
        },
      };
      
      this.handler.register(helpCommandV2);
    } catch (error) {
      console.warn("Failed to register essential commands:", error);
    }
  }

  /**
   * Get the underlying SlashCommandHandler instance
   */
  getV2Handler(): SlashCommandHandler {
    return this.handler;
  }
}

/**
 * Legacy export for backward compatibility
 */
export { LegacySlashCommandAdapter as SlashCommandHandler };
