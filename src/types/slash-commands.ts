/**
 * Slash commands type definitions
 */

export interface SlashCommandCategory {
  name: string;
  description: string;
  commands: SlashCommand[];
}

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  examples?: string[];
  category: string;
  handler: (args: string[]) => Promise<void> | void;
}

export interface SlashCommandRegistry {
  register(command: SlashCommand): void;
  unregister(name: string): void;
  get(name: string): SlashCommand | undefined;
  list(): SlashCommand[];
  getCategories(): SlashCommandCategory[];
}
