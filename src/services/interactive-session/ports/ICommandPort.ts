// src/services/interactive-session/ports/ICommandPort.ts
// Command execution port interface with cancellation support

export interface CommandResult {
  ok: boolean;
  message: string;
  data?: unknown;
  requiresInput?: boolean;
  component?: string;
}

export interface CommandContext {
  turnId: string;
  input: string;
  args: string[];
  signal?: AbortSignal;
  meta?: Record<string, unknown>;
}

export interface ICommandPort {
  /**
   * Execute a command with context
   * @param command - The command name
   * @param context - Execution context including signal for cancellation
   * @returns Command execution result
   */
  execute(command: string, context: CommandContext): Promise<CommandResult>;

  /**
   * Check if a command exists
   * @param command - The command name to check
   * @returns true if command exists
   */
  exists(command: string): boolean;

  /**
   * Get available commands
   * @returns List of available command names
   */
  getAvailableCommands(): string[];

  /**
   * Get command help/description
   * @param command - The command name
   * @returns Help text for the command
   */
  getHelp(command: string): string | null;
}
