/**
 * Command Handler Interfaces
 * Circular dependency resolution
 */

import { ConversationContext } from "../types/conversation";

export interface SlashCommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

export interface ICommandHandler {
  handleCommand(
    command: string,
    args: string[],
    context: ConversationContext,
  ): Promise<SlashCommandResult>;
}

export interface IBatchExecutionEngine {
  executeBatch(
    commands: string[],
    context: ConversationContext,
  ): Promise<SlashCommandResult[]>;
}
