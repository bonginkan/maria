/**
 * Mock Unified Command Registry for testing
 */

export interface UnifiedCommandInfo {
  name: string;
  description: string;
  category: string;
  handler?: () => Promise<boolean>;
  aliases?: string[];
  usage?: string;
  examples?: string[];
  hidden?: boolean;
}

export class MockUnifiedCommandRegistry {
  private commands: UnifiedCommandInfo[] = [
    {
      name: "help",
      description: "Show help information and command list",
      category: "core",
      aliases: ["h", "?"],
      usage: "/help [command]",
      examples: ["/help", "/help init"],
      hidden: false,
    },
    {
      name: "status",
      description: "Show status information",
      category: "core",
      aliases: ["st"],
      usage: "/status",
      examples: ["/status"],
      hidden: false,
    },
    {
      name: "init",
      description: "Initialize a new project",
      category: "development",
      aliases: ["initialize"],
      usage: "/init [project-name]",
      examples: ["/init my-project"],
      hidden: false,
    },
    {
      name: "code",
      description: "Generate code snippets",
      category: "generation",
      aliases: ["c"],
      usage: "/code [description]",
      examples: ['/code "hello world function"'],
      hidden: false,
    },
    {
      name: "test",
      description: "Run tests or generate test code",
      category: "quality",
      aliases: ["t"],
      usage: "/test [test-name]",
      examples: ["/test unit", "/test integration"],
      hidden: false,
    },
    {
      name: "hidden-command",
      description: "A hidden command for testing",
      category: "system",
      hidden: true,
    },
  ];

  getCommands(): UnifiedCommandInfo[] {
    return this.commands;
  }

  has(command: string): boolean {
    const _cleanCommand = command.startsWith("/") ? command.slice(1) : command;
    return this.commands.some(
      (cmd) =>
        cmd.name === _cleanCommand ||
        (cmd.aliases && cmd.aliases.includes(_cleanCommand)),
    );
  }

  getCommandsByCategory(category: string): UnifiedCommandInfo[] {
    return this.commands.filter((cmd) => cmd.category === category);
  }
}

let mockRegistryInstance: MockUnifiedCommandRegistry | null = null;

export function getUnifiedCommandRegistry(): MockUnifiedCommandRegistry {
  if (!mockRegistryInstance) {
    mockRegistryInstance = new MockUnifiedCommandRegistry();
  }
  return mockRegistryInstance;
}
