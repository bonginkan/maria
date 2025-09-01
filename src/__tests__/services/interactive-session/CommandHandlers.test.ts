// src/services/interactive-session/__tests__/CommandHandlers.test.ts
// Integration tests for command handlers

import { describe, it, expect, beforeEach } from "vitest";
import { CommandRegistry } from "../services/CommandRegistry";
import { registerCoreHandlers } from "../handlers/CoreHandlers";
import { registerDevHandlers } from "../handlers/DevHandlers";
import { registerSystemHandlers } from "../handlers/SystemHandlers";
import { CommandContext } from "../ports/ICommandPort";

describe("Command Handlers Integration", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
    registerCoreHandlers(registry);
    registerDevHandlers(registry);
    registerSystemHandlers(registry);
  });

  describe("CommandRegistry", () => {
    it("should register all command clusters", () => {
      const commands = registry.getCommands();

      // Check core commands
      expect(commands).toContain("help");
      expect(commands).toContain("clear");
      expect(commands).toContain("exit");
      expect(commands).toContain("version");
      expect(commands).toContain("history");

      // Check dev commands
      expect(commands).toContain("code");
      expect(commands).toContain("test");
      expect(commands).toContain("review");
      expect(commands).toContain("bug");

      // Check system commands
      expect(commands).toContain("status");
      expect(commands).toContain("model");
      expect(commands).toContain("memory");
      expect(commands).toContain("health");
      expect(commands).toContain("doctor");
    });

    it("should handle command aliases", () => {
      expect(registry.exists("help")).toBe(true);
      expect(registry.exists("?")).toBe(true); // Alias for help

      expect(registry.exists("clear")).toBe(true);
      expect(registry.exists("cls")).toBe(true); // Alias for clear

      expect(registry.exists("exit")).toBe(true);
      expect(registry.exists("quit")).toBe(true); // Alias for exit
    });

    it("should get commands by category", () => {
      const coreCommands = registry.getCommandsByCategory("core");
      expect(coreCommands.length).toBe(5);

      const devCommands = registry.getCommandsByCategory("dev");
      expect(devCommands.length).toBe(4);

      const systemCommands = registry.getCommandsByCategory("system");
      expect(systemCommands.length).toBe(5);
    });

    it("should have appropriate deadlines for commands", () => {
      expect(registry.getDeadline("help")).toBe(5000); // Quick response
      expect(registry.getDeadline("code")).toBe(30000); // Longer for generation
      expect(registry.getDeadline("test")).toBe(60000); // Longest for test runs
    });
  });

  describe("Core Handlers", () => {
    const createContext = (args: string[] = []): CommandContext => ({
      turnId: "test-turn",
      input: `/test ${args.join(" ")}`,
      args,
    });

    it("should execute help command", async () => {
      const result = await registry.execute("/help", createContext());

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Available Commands");
      expect(result.message).toContain("CORE");
      expect(result.message).toContain("DEV");
      expect(result.message).toContain("SYSTEM");
    });

    it("should execute version command", async () => {
      const result = await registry.execute("/version", createContext());

      expect(result.ok).toBe(true);
      expect(result.message).toContain("MARIA");
      expect(result.message).toContain("3.5");
      expect(result.data).toHaveProperty("version");
    });

    it("should execute exit command", async () => {
      const result = await registry.execute("/exit", createContext());

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Goodbye");
      expect(result.data).toEqual({ action: "exit" });
    });

    it("should handle force exit", async () => {
      const result = await registry.execute(
        "/exit",
        createContext(["--force"]),
      );

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Force exit");
      expect(result.data).toEqual({ action: "force-exit" });
    });
  });

  describe("Dev Handlers", () => {
    const createContext = (args: string[] = []): CommandContext => ({
      turnId: "test-turn",
      input: `/test ${args.join(" ")}`,
      args,
    });

    it("should execute code command with prompt", async () => {
      const result = await registry.execute(
        "/code",
        createContext(["hello", "world", "function"]),
      );

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Code generated");
      expect(result.data).toHaveProperty("code");
      expect(result.data).toHaveProperty("prompt", "hello world function");
      expect(result.requiresInput).toBe(false); // Important for preventing re-dispatch
    });

    it("should fail code command without prompt", async () => {
      const result = await registry.execute("/code", createContext([]));

      expect(result.ok).toBe(false);
      expect(result.message).toContain("provide a code generation request");
    });

    it("should execute test generate subcommand", async () => {
      const result = await registry.execute(
        "/test",
        createContext(["generate", "MyClass"]),
      );

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Tests generated");
      expect(result.data).toHaveProperty("testCode");
      expect(result.data).toHaveProperty("target", "MyClass");
    });

    it("should execute bug report", async () => {
      const result = await registry.execute(
        "/bug",
        createContext(["report", "Memory", "leak", "found"]),
      );

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Bug reported");
      expect(result.data).toHaveProperty("bugId");
      expect(result.data).toHaveProperty("description", "Memory leak found");
    });
  });

  describe("System Handlers", () => {
    const createContext = (args: string[] = []): CommandContext => ({
      turnId: "test-turn",
      input: `/test ${args.join(" ")}`,
      args,
    });

    it("should execute status command", async () => {
      const result = await registry.execute("/status", createContext());

      expect(result.ok).toBe(true);
      expect(result.message).toContain("System Status");
      expect(result.message).toContain("Operational");
      expect(result.data).toHaveProperty("system", "operational");
    });

    it("should execute model list", async () => {
      const result = await registry.execute("/model", createContext());

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Available Models");
      expect(result.data).toHaveProperty("models");
      expect(Array.isArray(result.data.models)).toBe(true);
    });

    it("should execute memory status", async () => {
      const result = await registry.execute(
        "/memory",
        createContext(["status"]),
      );

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Memory Status");
      expect(result.message).toContain("System 1");
      expect(result.message).toContain("System 2");
      expect(result.data).toHaveProperty("system1");
      expect(result.data).toHaveProperty("system2");
    });

    it("should execute health check", async () => {
      const result = await registry.execute("/health", createContext());

      expect(result.ok).toBe(true);
      expect(result.message).toContain("Health Check");
      expect(result.data).toHaveProperty("checks");
      expect(result.data).toHaveProperty("healthy");
    });

    it("should execute doctor diagnostic", async () => {
      const result = await registry.execute("/doctor", createContext());

      expect(result.ok).toBe(true);
      expect(result.message).toContain("System Doctor");
      expect(result.data).toHaveProperty("issues");
    });
  });

  describe("Command Execution with Deadline", () => {
    it("should respect command deadlines", async () => {
      const context: CommandContext = {
        turnId: "test-turn",
        input: "/slow",
        args: [],
      };

      // Create a mock slow command that respects abort signal
      const slowHandler = {
        name: "/slow",
        category: "test",
        description: "Slow test command",
        execute: async (ctx: CommandContext) => {
          // Check if already aborted
          if (ctx.signal?.aborted) {
            throw new Error("Aborted");
          }

          // Wait and check signal
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 100);
            ctx.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new Error("Aborted"));
            });
          });

          return { ok: true, message: "Done" };
        },
      };

      // Register with short deadline
      registry.register("/slow", slowHandler, 50);

      // Should timeout
      try {
        await registry.execute("/slow", context);
        expect.fail("Should have timed out");
      } catch (error: any) {
        expect(error.message).toContain("Abort");
      }
    });
  });

  describe("Unknown Commands", () => {
    it("should handle unknown commands gracefully", async () => {
      const context: CommandContext = {
        turnId: "test-turn",
        input: "/unknown",
        args: [],
      };

      const result = await registry.execute("/unknown", context);

      expect(result.ok).toBe(false);
      expect(result.message).toContain("Unknown command");
    });
  });
});
