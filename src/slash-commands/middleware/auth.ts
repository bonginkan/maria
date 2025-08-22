/**
 * Authentication Middleware
 * Handles authentication checks for commands
 */

import { CommandContext, CommandResult, IMiddleware } from '../types';
import { logger } from '../../utils/logger';

export class AuthMiddleware implements IMiddleware {
  name = 'auth';
  priority = 10; // Run early in the chain

  async execute(
    command: unknown,
    _args: unknown,
    context: CommandContext,
    next: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    // Check if command requires authentication
    const cmd = command as { permissions?: { requiresAuth?: boolean } };

    if (!cmd.permissions?.requiresAuth) {
      // Command doesn't require auth, continue
      return next();
    }

    // Check if user is authenticated
    if (!context.user) {
      logger.warn(
        `Unauthenticated access attempt for command: ${(command as { name: string }).name}`,
      );

      return {
        success: false,
        message: '🔒 Authentication required',
        data: {
          suggestions: ['Run /login to authenticate', 'Or use /help login for more information'],
        },
        component: 'auth-flow',
      };
    }

    // User is authenticated, continue
    logger.debug(`Authenticated user ${context.user.id} executing command`);
    return next();
  }
}

export const authMiddleware = new AuthMiddleware();
