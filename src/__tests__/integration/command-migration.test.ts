/**
 * Command Migration Integration Tests
 * Validates that V2 commands work correctly and maintain backward compatibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHelpCommand } from "../../shared/handlers/commands/HelpCommandV2";
import { createClearCommand } from "../../shared/handlers/commands/ClearCommandV2";
import {
  RouterBridge,
  V2CommandRegistry,
} from "../../shared/handlers/bridge/RouterBridge";
import type { HandlerDependencies } from "../../shared/handlers/SlashCommandHandler";
import type {
  ProviderPort,
  MemoryPort,
  ContextPort,
  UiPort,
  CommandContext,
  ModelInfo,
  // MemoryContent, // Not used in tests
  MemoryQuery,
  MemoryResult,
} from "../../shared/types/enhanced-context";

describe("Command Migration Integration Tests", () => {
  let mockDeps: HandlerDependencies;
  let registry: V2CommandRegistry;
  let bridge: RouterBridge;

  beforeEach(() => {
    // Create comprehensive mock dependencies
    mockDeps = {
      provider: {
        listModels: vi.fn().mockResolvedValue([
          {
            id: "gpt-4",
            name: "GPT-4",
            provider: "openai",
            capabilities: { streaming: true, functions: true, vision: false },
            status: "available",
          } as ModelInfo,
          {
            id: "claude-3",
            name: "Claude 3",
            provider: "anthropic",
            capabilities: { streaming: true, functions: false, vision: true },
            status: "available",
          } as ModelInfo,
        ]),
        switchModel: vi.fn().mockResolvedValue(undefined),
        getModelInfo: vi.fn().mockResolvedValue({
          id: "gpt-4",
          name: "GPT-4",
          provider: "openai",
          capabilities: { streaming: true, functions: true, vision: false },
          status: "available",
        } as ModelInfo),
      } as ProviderPort,

      memory: {
        store: vi.fn().mockResolvedValue("memory-id-123"),
        query: vi.fn().mockImplementation((query: MemoryQuery) => {
          // Mock memory query results based on query
          if (query.tags?.includes("important")) {
            return Promise.resolve([
              {
                id: "mem-1",
                content: { text: "Important information" },
                metadata: {
                  timestamp: new Date().toISOString(),
                  importance: 0.9,
                  type: "user.input",
                  tags: ["important"],
                },
                score: 0.95,
                source: "L2" as const,
              },
            ] as MemoryResult[]);
          }
          return Promise.resolve([]);
        }),
        clear: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockResolvedValue({
          total: 10,
          byType: { "user.input": 5, "command.result": 5 },
          avgImportance: 0.6,
          oldestTimestamp: new Date(Date.now() - 86400000).toISOString(),
          newestTimestamp: new Date().toISOString(),
          totalSize: 1024,
        }),
      } as MemoryPort,

      context: {
        addMessage: vi.fn().mockResolvedValue(undefined),
        getMessages: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        getTokenCount: vi.fn().mockResolvedValue(150),
        compress: vi.fn().mockResolvedValue(undefined),
      } as ContextPort,

      ui: {
        display: vi.fn().mockResolvedValue(undefined),
        prompt: vi.fn().mockResolvedValue("user response"),
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn().mockResolvedValue("option1"),
        showProgress: vi.fn().mockResolvedValue(undefined),
        showError: vi.fn().mockResolvedValue(undefined),
        showSuccess: vi.fn().mockResolvedValue(undefined),
        showWarning: vi.fn().mockResolvedValue(undefined),
      } as UiPort,
    };

    registry = new V2CommandRegistry(mockDeps);
    bridge = new RouterBridge(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("HelpCommandV2 Integration", () => {
    it("should execute help command successfully", async () => {
      const helpCommand = createHelpCommand();
      const context = createTestContext(["help"], mockDeps);

      const result = await helpCommand.execute(context);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.content).toContain("MARIA CODE");
      expect(result.data?.type).toBe("general-overview");
      expect(result.metrics?.duration).toBeGreaterThan(0);
    });

    it("should show specific command help", async () => {
      const helpCommand = createHelpCommand();
      const context = createTestContext(["clear"], mockDeps);

      const result = await helpCommand.execute(context);

      expect(result.success).toBe(true);
      expect(result.messages[0]?.content).toContain("CLEAR");
      expect(result.messages[0]?.content).toContain("conversation context");
      expect(result.data?.type).toBe("command-specific");
      expect(result.data?.command).toBe("clear");
    });

    it("should handle category filtering", async () => {
      const helpCommand = createHelpCommand();
      const context = createTestContext(["--category", "core"], mockDeps);

      const result = await helpCommand.execute(context);

      expect(result.success).toBe(true);
      expect(result.messages[0]?.content).toContain("CORE COMMANDS");
      expect(result.data?.type).toBe("category-specific");
      expect(result.data?.category).toBe("core");
    });

    it("should handle search functionality", async () => {
      const helpCommand = createHelpCommand();
      const context = createTestContext(["--search", "clear"], mockDeps);

      const result = await helpCommand.execute(context);

      expect(result.success).toBe(true);
      expect(result.messages[0]?.content).toContain("SEARCH RESULTS");
      expect(result.data?.type).toBe("search-results");
      expect(result.data?.searchTerm).toBe("clear");
    });

    it("should handle unknown commands gracefully", async () => {
      const helpCommand = createHelpCommand();
      const context = createTestContext(["nonexistent"], mockDeps);

      const result = await helpCommand.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Command not found");
      expect(result.messages[0]?.content).toContain("Did you mean");
    });

    it("should respect abort signal", async () => {
      const helpCommand = createHelpCommand();
      const controller = new AbortController();
      const context = createTestContext(["help"], mockDeps);
      context.signal = controller.signal;

      // Abort immediately
      controller.abort();

      const result = await helpCommand.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("abort");
    });
  });

  describe("ClearCommandV2 Integration", () => {
    it("should execute basic clear successfully", async () => {
      const clearCommand = createClearCommand();
      const context = createTestContext([], mockDeps);

      const result = await clearCommand.execute(context);

      expect(result.success).toBe(true);
      expect(result.messages[0]?.content).toContain("Conversation cleared");
      expect(result.data?.mode).toBe("session");
      expect(mockDeps.context.clear).toHaveBeenCalledWith({
        preserveImportant: false,
        signal: undefined,
      });
    });

    it("should handle display mode correctly", async () => {
      const clearCommand = createClearCommand();
      const context = createTestContext(["--mode", "display"], mockDeps);

      const result = await clearCommand.execute(context);

      expect(result.success).toBe(true);
      expect(result.messages[0]?.content).toContain("Display cleared");
      expect(result.data?.mode).toBe("display");
      expect(result.data?.preserved).toBe(true);
      expect(mockDeps.context.clear).toHaveBeenCalledWith({
        preserveImportant: true,
        signal: undefined,
      });
    });

    it("should preserve tagged memories", async () => {
      const clearCommand = createClearCommand();
      const context = createTestContext(
        ["--preserve", "important,project"],
        mockDeps,
      );

      const result = await clearCommand.execute(context);

      expect(result.success).toBe(true);
      expect(result.data?.preservedTags).toEqual(["important", "project"]);
      expect(result.data?.preservedCount).toBeGreaterThan(0);
      expect(mockDeps.memory.query).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ["important", "project"],
        }),
        expect.any(Object),
      );
    });

    it("should handle all mode with settings preservation", async () => {
      const clearCommand = createClearCommand();
      const context = createTestContext(["--all", "--keep-settings"], mockDeps);

      const result = await clearCommand.execute(context);

      // Should fail due to conflicting options
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Cannot use --all and --keep-settings together",
      );
    });

    it("should export memories when requested", async () => {
      const clearCommand = createClearCommand();
      const context = createTestContext(["--export"], mockDeps);

      const result = await clearCommand.execute(context);

      expect(result.success).toBe(true);
      expect(result.data?.exportedBeforeClearing).toBe(true);
      expect(result.messages[0]?.content).toContain("exported");
    });

    it("should handle abort during clear operation", async () => {
      const clearCommand = createClearCommand();
      const controller = new AbortController();
      const context = createTestContext(["--all"], mockDeps);
      context.signal = controller.signal;

      // Abort during execution
      setTimeout(() => controller.abort(), 10);

      const result = await clearCommand.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("abort");
    });
  });

  describe("Router Bridge Integration", () => {
    it("should bridge V2 commands to legacy router format", async () => {
      const helpCommand = createHelpCommand();
      const legacyCommand = bridge.wrapV2Command(helpCommand);

      expect(legacyCommand.name).toBe("help");
      expect(legacyCommand.aliases).toEqual(["h", "?"]);
      expect(legacyCommand.description).toBe(
        "📚 Display help information for commands and system usage",
      );

      // Test legacy handler
      const result = await legacyCommand.handler(["clear"], {});

      expect(result.ok).toBe(true);
      expect(result.requiresInput).toBe(false); // CRITICAL: Always false
      expect(result.message).toContain("CLEAR");
    });

    it("should ensure requiresInput is always false", async () => {
      const commands = [createHelpCommand(), createClearCommand()];

      for (const v2Command of commands) {
        const legacyCommand = bridge.wrapV2Command(v2Command);
        const result = await legacyCommand.handler([], {});

        expect(result.requiresInput).toBe(false);
        expect(result.ok).toBe(true);
      }
    });

    it("should handle V2 command errors in bridge", async () => {
      // Create a command that throws an error
      const errorCommand = {
        name: "error-test",
        description: "Test error handling",
        category: "test",
        execute: async () => {
          throw new Error("Test error");
        },
      };

      const legacyCommand = bridge.wrapV2Command(errorCommand);
      const result = await legacyCommand.handler([], {});

      expect(result.ok).toBe(false);
      expect(result.requiresInput).toBe(false);
      expect(result.error).toContain("Test error");
    });
  });

  describe("Command Registry Integration", () => {
    it("should register and retrieve V2 commands", () => {
      const helpCommand = createHelpCommand();
      const clearCommand = createClearCommand();

      registry.register(helpCommand);
      registry.register(clearCommand);

      expect(registry.has("help")).toBe(true);
      expect(registry.has("clear")).toBe(true);
      expect(registry.has("h")).toBe(true); // Alias
      expect(registry.has("cls")).toBe(true); // Alias

      const retrieved = registry.get("help");
      expect(retrieved).toBe(helpCommand);

      const commands = registry.list();
      expect(commands).toHaveLength(2);
      expect(commands).toContain(helpCommand);
      expect(commands).toContain(clearCommand);
    });

    it("should create legacy commands for all registered V2 commands", () => {
      const helpCommand = createHelpCommand();
      const clearCommand = createClearCommand();

      const legacyHelp = registry.register(helpCommand);
      const legacyClear = registry.register(clearCommand);

      expect(legacyHelp.name).toBe("help");
      expect(legacyClear.name).toBe("clear");

      // Both should be callable
      expect(typeof legacyHelp.handler).toBe("function");
      expect(typeof legacyClear.handler).toBe("function");
    });
  });

  describe("End-to-End Migration Scenarios", () => {
    it("should maintain backward compatibility for common workflows", async () => {
      // Register V2 commands
      const helpCommand = createHelpCommand();
      const clearCommand = createClearCommand();

      const legacyHelp = registry.register(helpCommand);
      const legacyClear = registry.register(clearCommand);

      // Test common workflow: help then clear
      const helpResult = await legacyHelp.handler(["clear"], {});
      expect(helpResult.ok).toBe(true);
      expect(helpResult.message).toContain("CLEAR");

      const clearResult = await legacyClear.handler(
        ["--preserve", "important"],
        {},
      );
      expect(clearResult.ok).toBe(true);
      expect(clearResult.message).toContain("cleared");
    });

    it("should handle complex clear scenarios", async () => {
      const clearCommand = createClearCommand();
      const legacyClear = registry.register(clearCommand);

      // Test complex clear with multiple options
      const result = await legacyClear.handler(
        ["--mode", "session", "--preserve", "important,project", "--export"],
        {},
      );

      expect(result.ok).toBe(true);
      expect(result.requiresInput).toBe(false);
      expect(result.message).toContain("cleared");
      expect(result.message).toContain("preserved");
      expect(result.message).toContain("exported");
    });

    it("should provide consistent error handling", async () => {
      const commands = [createHelpCommand(), createClearCommand()];

      for (const v2Command of commands) {
        const legacyCommand = registry.register(v2Command);

        // Test with abort signal
        const controller = new AbortController();
        controller.abort();

        const result = await legacyCommand.handler([], {
          signal: controller.signal,
        });

        expect(result.ok).toBe(false);
        expect(result.requiresInput).toBe(false);
        expect(result.endReason).toBe("cancelled");
      }
    });
  });

  // Helper function to create test context
  function createTestContext(
    args: string[],
    deps: HandlerDependencies,
  ): CommandContext {
    return {
      command: "test",
      args,
      options: {
        traceId: "test-trace-123",
      },
      deps,
      signal: undefined,
      traceId: "test-trace-123",
    };
  }
});
