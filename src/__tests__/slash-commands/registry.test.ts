import { CommandRegistry } from "../registry";
import type { ISlashCommand, CommandContext } from "../types";

describe("CommandRegistry", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  test("register and execute minimal command", async () => {
    const mockCommand: ISlashCommand = {
      name: "ping",
      description: "Test ping command",
      category: "test",
      async execute() {
        return { success: true, message: "pong" };
      },
    };

    registry.register(mockCommand);

    const context: CommandContext = {
      user: { id: "test-user", role: "user" },
    } as CommandContext;

    const result = await registry.execute("ping", [], context);

    expect(result.success).toBe(true);
    expect(result.message).toBe("pong");
  });

  test("command not found returns suggestions", async () => {
    const mockCommand: ISlashCommand = {
      name: "help",
      description: "Help command",
      category: "test",
      async execute() {
        return { success: true, message: "help" };
      },
    };

    registry.register(mockCommand);

    const context: CommandContext = {
      user: { id: "test-user", role: "user" },
    } as CommandContext;

    const result = await registry.execute("halp", [], context);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Command not found");
    expect(result.data?.suggestions).toContain("/help");
  });

  test("unregister command works correctly", () => {
    const mockCommand: ISlashCommand = {
      name: "temp",
      description: "Temporary command",
      category: "test",
      async execute() {
        return { success: true, message: "temp" };
      },
    };

    registry.register(mockCommand);
    expect(registry.has("temp")).toBe(true);

    const unregistered = registry.unregister("temp");
    expect(unregistered).toBe(true);
    expect(registry.has("temp")).toBe(false);
  });

  test("getByCategory filters commands correctly", () => {
    const cmd1: ISlashCommand = {
      name: "cmd1",
      description: "Command 1",
      category: "category1",
      async execute() {
        return { success: true, message: "cmd1" };
      },
    };

    const cmd2: ISlashCommand = {
      name: "cmd2",
      description: "Command 2",
      category: "category2",
      async execute() {
        return { success: true, message: "cmd2" };
      },
    };

    registry.register(cmd1);
    registry.register(cmd2);

    const category1Commands = registry.getByCategory("category1");
    expect(category1Commands).toHaveLength(1);
    expect(category1Commands[0].name).toBe("cmd1");
  });
});
