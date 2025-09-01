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
  readonly category: CommandCategory = "development";

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