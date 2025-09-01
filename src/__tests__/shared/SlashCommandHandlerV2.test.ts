/**
 * Tests for SlashCommandHandler
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SlashCommandHandler,
  createSlashCommandHandler,
} from "../../shared/handlers/SlashCommandHandler";
import { createSampleCommand } from "../../shared/handlers/commands/SampleCommandV2";
import type { HandlerDependencies } from "../../shared/handlers/SlashCommandHandler";
import type {
  ProviderPort,
  MemoryPort,
  ContextPort,
  UiPort,
} from "../../shared/types/context";

describe("SlashCommandHandler", () => {
  let handler: SlashCommandHandler;
  let mockDeps: HandlerDependencies;

  beforeEach(() => {
    // Create mock dependencies
    mockDeps = {
      provider: {
        listModels: vi.fn().mockResolvedValue(["gpt-4", "claude-3"]),
        switchModel: vi.fn().mockResolvedValue(undefined),
        getModelInfo: vi.fn().mockResolvedValue({
          id: "gpt-4",
          name: "GPT-4",
          provider: "openai",
          capabilities: {
            streaming: true,
            functions: true,
            vision: false,
          },
        }),
      } as ProviderPort,

      memory: {
        store: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
      } as MemoryPort,

      context: {
        addMessage: vi.fn().mockResolvedValue(undefined),
        getMessages: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        getTokenCount: vi.fn().mockResolvedValue(0),
        compress: vi.fn().mockResolvedValue(undefined),
      } as ContextPort,

      ui: {
        display: vi.fn().mockResolvedValue(undefined),
        prompt: vi.fn().mockResolvedValue("user input"),
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn().mockResolvedValue("option1"),
        showProgress: vi.fn().mockResolvedValue(undefined),
        showError: vi.fn().mockResolvedValue(undefined),
        showSuccess: vi.fn().mockResolvedValue(undefined),
        showWarning: vi.fn().mockResolvedValue(undefined),
      } as UiPort,
    };

    // Create handler with mock dependencies
    handler = createSlashCommandHandler(mockDeps);
  });

  describe("Command Registration", () => {
    it("should register a command", () => {
      const command = createSampleCommand();
      handler.register(command);

      const registered = handler.getCommand("sample");
      expect(registered).toBeDefined();
      expect(registered?.name).toBe("sample");
    });

    it("should register command aliases", () => {
      const command = createSampleCommand();
      handler.register(command);

      // Check aliases work
      const byAlias1 = handler.getCommand("test");
      const byAlias2 = handler.getCommand("demo");

      expect(byAlias1).toBeDefined();
      expect(byAlias2).toBeDefined();
      expect(byAlias1?.name).toBe("sample");
      expect(byAlias2?.name).toBe("sample");
    });

    it("should list all commands", () => {
      const command = createSampleCommand();
      handler.register(command);

      const commands = handler.listCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe("sample");
    });
  });

  describe("Command Execution", () => {
    it("should execute a registered command", async () => {
      const command = createSampleCommand();
      handler.register(command);

      const result = await handler.execute("sample", ["arg1", "arg2"]);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(mockDeps.provider.listModels).toHaveBeenCalled();
      expect(mockDeps.memory.store).toHaveBeenCalled();
      expect(mockDeps.ui.display).toHaveBeenCalled();
    });

    it("should handle unknown commands", async () => {
      const result = await handler.execute("unknown", []);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown command");
    });

    it("should execute command with timeout", async () => {
      const command = createSampleCommand();
      handler.register(command);

      // Make the command take longer than timeout
      mockDeps.provider.listModels = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 1000)),
        );

      const result = await handler.execute("sample", [], { timeout: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
    });

    it("should pass abort signal to dependencies", async () => {
      const command = createSampleCommand();
      handler.register(command);

      const controller = new AbortController();
      await handler.execute("sample", [], { signal: controller.signal });

      // Check that signal was passed to dependencies
      expect(mockDeps.provider.listModels).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
      );
    });
  });

  describe("Command Search", () => {
    beforeEach(() => {
      // Register multiple commands for testing
      handler.register({
        name: "help",
        description: "Show help information",
        category: "general",
        execute: async () => ({ success: true, messages: [] }),
      });

      handler.register({
        name: "memory",
        description: "Manage memory system",
        category: "system",
        execute: async () => ({ success: true, messages: [] }),
      });

      handler.register({
        name: "clear",
        description: "Clear the conversation",
        category: "general",
        execute: async () => ({ success: true, messages: [] }),
      });
    });

    it("should search commands by name pattern", () => {
      const results = handler.searchCommands("mem");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("memory");
    });

    it("should search commands by description pattern", () => {
      const results = handler.searchCommands("information");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("help");
    });

    it("should get commands by category", () => {
      const generalCommands = handler.getCommandsByCategory("general");
      expect(generalCommands).toHaveLength(2);

      const systemCommands = handler.getCommandsByCategory("system");
      expect(systemCommands).toHaveLength(1);
    });

    it("should get all categories", () => {
      const categories = handler.getCategories();
      expect(categories).toContain("general");
      expect(categories).toContain("system");
      expect(categories).toHaveLength(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle command execution errors", async () => {
      handler.register({
        name: "error-command",
        description: "Command that throws an error",
        category: "test",
        execute: async () => {
          throw new Error("Command failed");
        },
      });

      const result = await handler.execute("error-command", []);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Command failed");
    });

    it("should handle abort errors specially", async () => {
      handler.register({
        name: "abort-command",
        description: "Command that gets aborted",
        category: "test",
        execute: async () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          throw error;
        },
      });

      const result = await handler.execute("abort-command", []);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Command execution timed out");
    });
  });

  describe("Test Helpers", () => {
    it("should create test context", () => {
      const context = SlashCommandHandler.createTestContext(mockDeps, {
        command: "test-cmd",
        args: ["arg1"],
      });

      expect(context.command).toBe("test-cmd");
      expect(context.args).toEqual(["arg1"]);
      expect(context.deps).toBe(mockDeps);
    });
  });
});
