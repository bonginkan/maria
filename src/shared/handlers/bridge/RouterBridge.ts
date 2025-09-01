/**
 * Router Bridge
 * Bridges V2 commands with the existing router system
 * Ensures requiresInput=false and proper result normalization
 */

import type {
  SlashCommandV2,
  HandlerDependencies,
} from "../SlashCommandHandler";
import type { CommandResult } from "../../types/enhanced-context";
import { ResultAdapter, type RouterResult } from "../adapters/ResultAdapter";
import { CommandTracer, globalMetrics } from "../utils/tracing";
import { createThrottledUi } from "../utils/ui-throttling";

/**
 * Legacy router command interface (existing system)
 */
export interface LegacyRouterCommand {
  name: string;
  aliases?: string[];
  description: string;
  category?: string;
  handler: (args: string[], options?: any) => Promise<RouterResult>;
}

/**
 * Bridge that wraps V2 commands for the router
 */
export class RouterBridge {
  constructor(private deps: HandlerDependencies) {}

  /**
   * Convert V2 command to router-compatible format
   * CRITICAL: Always sets requiresInput=false to prevent loops
   */
  wrapV2Command(v2Command: SlashCommandV2): LegacyRouterCommand {
    return {
      name: v2Command.name,
      aliases: v2Command.aliases,
      description: v2Command.description,
      category: v2Command.category,
      handler: async (
        args: string[],
        options: any = {},
      ): Promise<RouterResult> => {
        // Create enhanced dependencies with throttling
        const throttledDeps = {
          ...this.deps,
          ui: createThrottledUi(this.deps.ui, {
            debounceMs: 100,
            minProgressDelta: 5,
            maxUpdatesPerSecond: 10,
            suppressAfterAbort: true,
          }),
        };

        // Create command context
        const context = {
          command: v2Command.name,
          args,
          options: {
            ...options,
            traceId: this.generateTraceId(),
            userId: options.userId || "anonymous",
          },
          deps: throttledDeps,
          signal: options.signal,
          traceId: options.traceId || this.generateTraceId(),
        };

        let result: CommandResult;

        try {
          // Execute V2 command
          result = await v2Command.execute(context);

          // Record metrics
          if (context.traceId) {
            const trace = {
              traceId: context.traceId,
              spans: [],
              startTime: Date.now(),
              endTime: Date.now(),
              command: v2Command.name,
            };
            globalMetrics.recordCommand(trace);
          }
        } catch (error) {
          // Convert error to standardized result
          result = ResultAdapter.errorResult(
            error,
            `${v2Command.name} command failed`,
          );
        }

        // Convert to router format with CRITICAL requiresInput=false
        const routerResult = ResultAdapter.toRouterResult(result);

        // Double-check: ALWAYS ensure requiresInput is false for V2 commands
        routerResult.requiresInput = false;

        return routerResult;
      },
    };
  }

  /**
   * Batch wrap multiple V2 commands
   */
  wrapV2Commands(v2Commands: SlashCommandV2[]): LegacyRouterCommand[] {
    return v2Commands.map((cmd) => this.wrapV2Command(cmd));
  }

  /**
   * Create router bridge for specific dependencies
   */
  static create(deps: HandlerDependencies): RouterBridge {
    return new RouterBridge(deps);
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}

/**
 * Helper to register V2 commands with existing router
 */
export class V2CommandRegistry {
  private registeredCommands = new Map<string, SlashCommandV2>();
  private bridge: RouterBridge;

  constructor(deps: HandlerDependencies) {
    this.bridge = new RouterBridge(deps);
  }

  /**
   * Register a V2 command
   */
  register(command: SlashCommandV2): LegacyRouterCommand {
    this.registeredCommands.set(command.name, command);

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.registeredCommands.set(alias, command);
      }
    }

    return this.bridge.wrapV2Command(command);
  }

  /**
   * Register multiple commands
   */
  registerAll(commands: SlashCommandV2[]): LegacyRouterCommand[] {
    return commands.map((cmd) => this.register(cmd));
  }

  /**
   * Get registered command
   */
  get(name: string): SlashCommandV2 | undefined {
    return this.registeredCommands.get(name);
  }

  /**
   * List all registered commands
   */
  list(): SlashCommandV2[] {
    return Array.from(new Set(this.registeredCommands.values()));
  }

  /**
   * Check if command is registered
   */
  has(name: string): boolean {
    return this.registeredCommands.has(name);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.registeredCommands.clear();
  }
}

/**
 * Integration helper for existing router systems
 */
export class RouterIntegration {
  /**
   * Create a drop-in replacement command that bridges to V2
   */
  static createBridgeCommand(
    v2Command: SlashCommandV2,
    deps: HandlerDependencies,
  ): LegacyRouterCommand {
    const bridge = new RouterBridge(deps);
    return bridge.wrapV2Command(v2Command);
  }

  /**
   * Wrap existing router command to use V2 infrastructure
   */
  static wrapLegacyCommand(
    legacyHandler: (args: string[], options?: any) => Promise<any>,
    commandName: string,
    deps: HandlerDependencies,
  ): SlashCommandV2 {
    return {
      name: commandName,
      description: `Legacy command: ${commandName}`,
      category: "legacy",
      execute: async (context) => {
        try {
          const result = await legacyHandler(context.args, {
            ...context.options,
            signal: context.signal,
          });

          return {
            success: true,
            messages: [
              {
                role: "assistant",
                content:
                  typeof result === "string" ? result : JSON.stringify(result),
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
   * Validate router result compliance
   */
  static validateRouterResult(result: RouterResult): RouterResult {
    // Ensure critical fields are set correctly
    return {
      ok: result.ok ?? false,
      message: result.message,
      requiresInput: false, // ALWAYS false for V2 commands
      endReason: result.endReason || (result.ok ? "completed" : "error"),
      error: result.error,
      data: result.data,
    };
  }
}
