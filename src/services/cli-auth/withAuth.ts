/**
 * Authentication Gate Wrapper
 * Enforces authentication for all protected commands
 */

import { CommandResult } from '../../types/command.types';
import { authManager } from './AuthenticationManager';
import chalk from 'chalk';

// Error codes for authentication failures
export const AUTH_EXIT_CODES = {
  AUTH_REQUIRED: 2,
  REAUTH_REQUIRED: 2,
  QUOTA_EXCEEDED: 3,
  PLAN_RESTRICTED: 4,
  NETWORK_ERROR: 1,
  RATE_LIMITED: 1
} as const;

// Commands that don't require authentication
export const AUTH_EXEMPT_COMMANDS = [
  '/help',
  '/login',
  '/logout',
  '/version',
  '/status'
];

/**
 * Wrap a command handler with authentication check
 * @param fn The command handler function
 * @returns Wrapped command handler that enforces authentication
 */
export function withAuth<T extends any[]>(
  fn: (...args: T) => Promise<CommandResult>
) {
  return async (...args: T): Promise<CommandResult> => {
    try {
      // Check if user is authenticated and get valid token
      const tokens = await authManager.getValidTokens();
      
      if (!tokens) {
        console.log(chalk.red('🔐 Authentication required · Run: maria /login'));
        process.exit(AUTH_EXIT_CODES.AUTH_REQUIRED);
      }
      
      // Inject token into global context for API calls
      (global as any).MARIA_ID_TOKEN = tokens.idToken;
      (global as any).MARIA_ACCESS_TOKEN = tokens.accessToken;
      (global as any).MARIA_SESSION_ID = tokens.sessionId;
      
      // Execute the wrapped command
      return await fn(...args);
      
    } catch (error: any) {
      // Handle authentication errors
      if (error.code === 'AUTH_REQUIRED') {
        console.log(chalk.red('🔐 Authentication required · Run: maria /login'));
        process.exit(AUTH_EXIT_CODES.AUTH_REQUIRED);
      }
      
      if (error.code === 'REAUTH_REQUIRED' || error.code === 'TOKEN_EXPIRED') {
        console.log(chalk.yellow('🔄 Please re-authenticate · Run: maria /login'));
        process.exit(AUTH_EXIT_CODES.REAUTH_REQUIRED);
      }
      
      if (error.code === 'QUOTA_EXCEEDED') {
        console.log(chalk.yellow('⚠ Quota exceeded · Run: maria /billing'));
        process.exit(AUTH_EXIT_CODES.QUOTA_EXCEEDED);
      }
      
      if (error.code === 'PLAN_RESTRICTED') {
        console.log(chalk.yellow('🔒 Not available in current plan'));
        process.exit(AUTH_EXIT_CODES.PLAN_RESTRICTED);
      }
      
      if (error.code === 'RATE_LIMITED') {
        const retryAfter = error.retryAfter || 5;
        console.log(chalk.yellow(`⏱️ Rate limit: wait ${retryAfter}s`));
        process.exit(AUTH_EXIT_CODES.RATE_LIMITED);
      }
      
      if (error.code === 'NETWORK_ERROR') {
        console.log(chalk.red('🌐 Network error, check connection'));
        process.exit(AUTH_EXIT_CODES.NETWORK_ERROR);
      }
      
      // Re-throw other errors to be handled by command
      throw error;
    }
  };
}

/**
 * Check if a command requires authentication
 * @param commandName The command name to check
 * @returns True if command requires authentication
 */
export function requiresAuth(commandName: string): boolean {
  // Normalize command name
  const normalizedName = commandName.toLowerCase().replace(/^\/+/, '/');
  
  // Check if command is in the exempt list
  return !AUTH_EXEMPT_COMMANDS.some(exempt => 
    normalizedName === exempt || normalizedName.startsWith(exempt + ' ')
  );
}

/**
 * Display authentication-aware usage footer after command execution
 * @param showUsage Whether to show usage info
 */
export async function displayUsageFooter(showUsage: boolean = true): Promise<void> {
  if (!showUsage) return;
  
  try {
    const user = await authManager.getCurrentUser();
    const requestsLeft = user.usage.requestLimit - user.usage.requests;
    
    // Color code based on remaining requests
    let color = chalk.green;
    if (requestsLeft <= 5) color = chalk.red;
    else if (requestsLeft <= 20) color = chalk.yellow;
    
    console.log(chalk.gray(`ⓘ ${color(`${requestsLeft} req left`)} · Reset: ${user.usage.resetDate} · Models: ${user.models?.length || 0}`));
  } catch {
    // Silent fail - don't show footer if we can't get user info
  }
}