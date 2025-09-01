/**
 * Command Knowledge Base
 * Stores and retrieves command patterns and knowledge
 */

export class CommandKnowledgeBase {
  private commands: Map<string, any> = new Map();

  constructor() {
    this.initializeKnowledgeBase();
  }

  private initializeKnowledgeBase(): void {
    // Common Linux commands
    this.commands.set("ls", {
      description: "List directory contents",
      category: "file",
      riskLevel: "SAFE",
    });

    this.commands.set("rm", {
      description: "Remove files or directories",
      category: "file",
      riskLevel: "MEDIUM",
    });

    this.commands.set("systemctl", {
      description: "Control systemd services",
      category: "service",
      riskLevel: "MEDIUM",
    });
  }

  getCommand(name: string): unknown {
    return this.commands.get(name);
  }

  addCommand(_name: string, info: unknown): void {
    this.commands.set(_name, info);
  }
}
