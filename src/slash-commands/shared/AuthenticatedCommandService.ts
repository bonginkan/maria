/**
 * Authenticated Command Service Base
 * Base class for command services that require authentication
 */

import { BaseCommandService } from './BaseCommandService';
import { CommandContext, CommandResult, CommandArgs } from '../types';
import { withAuth, AUTH_EXEMPT_COMMANDS } from '../../services/cli-auth';
import { logger } from '../../utils/logger';

export abstract class AuthenticatedCommandService extends BaseCommandService {
  /**
   * Execute a command with authentication check
   */
  async executeCommand(
    command: string,
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    // Normalize command name
    const normalizedCommand = command.toLowerCase().replace(/^\/+/, '/');
    
    // Check if command is auth-exempt
    const isExempt = AUTH_EXEMPT_COMMANDS.some(exempt => 
      normalizedCommand === exempt || 
      normalizedCommand.startsWith(exempt + ' ')
    );
    
    if (isExempt) {
      // Execute without authentication
      logger.debug(`Executing ${command} without authentication (exempt)`);
      return super.executeCommand(command, args, context);
    }
    
    // Wrap with authentication
    logger.debug(`Executing ${command} with authentication check`);
    const authenticatedHandler = withAuth(
      async (_args: CommandArgs, _context: CommandContext) => {
        return super.executeCommand(command, _args, _context);
      }
    );
    
    return authenticatedHandler(args, context);
  }
  
  /**
   * Check if command requires authentication
   * @param command The command to check
   * @returns True if authentication is required
   */
  protected requiresAuth(command: string): boolean {
    const normalizedCommand = command.toLowerCase().replace(/^\/+/, '/');
    return !AUTH_EXEMPT_COMMANDS.some(exempt => 
      normalizedCommand === exempt || 
      normalizedCommand.startsWith(exempt + ' ')
    );
  }
}