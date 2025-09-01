/**
 * Memory Command Service
 * Handles all memory-related slash commands in the new system
 */

import { BaseCommandService } from "../../shared/BaseCommandService";
import { CommandCategory } from "../../types";
import { RememberCommand } from "./remember.command";
import { RecallCommand } from "./recall.command";
import { ForgetCommand } from "./forget.command";
import { MemoryStatusCommand } from "./memory-status.command";

export class MemoryCommandService extends BaseCommandService {
  readonly category: CommandCategory = "memory";

  registerHandlers(): void {
    // Register all memory commands
    this.handlers.set("/remember", new RememberCommand());
    this.handlers.set("/recall", new RecallCommand());
    this.handlers.set("/forget", new ForgetCommand());
    this.handlers.set("/memory-status", new MemoryStatusCommand());
    
    // Register memory-status command alias
    this.handlers.set("/memory", new MemoryStatusCommand());
  }
}

// Export metadata and execute for command registry
export const metadata = {
  name: 'memory-service',
  description: 'Memory command service handler',
  category: 'memory',
  version: '1.0.0',
  type: 'functional' as const,
  planRequired: 'free' as const,
  isPreview: false
};

export async function execute(context: any): Promise<any> {
  const service = new MemoryCommandService();
  service.registerHandlers();
  return {
    success: true,
    output: 'Memory command service initialized',
    requiresInput: false,
    endReason: 'success'
  };
}