/**
 * Slash Commands Module
 * Export all command system components
 */

// Core exports
export * from './types';
export * from './base-command';
export * from './registry';
// export * from './decorators';

// Middleware exports
export * from './middleware/auth';
export * from './middleware/validation';
export * from './middleware/rate-limit';
export * from './middleware/logging';

// Command exports (will be added as commands are migrated)
export * from './categories/conversation/clear.command';

// Re-export registry singleton
import { commandRegistry } from './registry';
import { ISlashCommand } from './types';
export { commandRegistry };

// Initialize and auto-register commands

/**
 * Initialize the slash command system
 */
export async function initializeSlashCommands(): Promise<void> {
  // Register built-in middlewares
  const { authMiddleware } = await import('./middleware/auth');
  const { validationMiddleware } = await import('./middleware/validation');
  const { rateLimitMiddleware } = await import('./middleware/rate-limit');
  const { loggingMiddleware } = await import('./middleware/logging');

  commandRegistry.registerMiddleware(loggingMiddleware);
  commandRegistry.registerMiddleware(authMiddleware);
  commandRegistry.registerMiddleware(rateLimitMiddleware);
  commandRegistry.registerMiddleware(validationMiddleware);

  // Manually register known commands (for bundled environment)
  await registerBuiltInCommands();

  console.log(`✅ Initialized ${commandRegistry.getAll().length} slash commands`);
}

/**
 * Register built-in commands manually (for bundled environment)
 */
async function registerBuiltInCommands(): Promise<void> {
  try {
    // Register clear command
    const { ClearCommand } = await import('./categories/conversation/clear.command');
    const clearCommand = new ClearCommand();
    if (clearCommand.initialize) {
      await clearCommand.initialize();
    }
    commandRegistry.register(clearCommand);

    // Register setup command
    const setupCommandModule = await import('./categories/config/setup.command');
    const setupCommand = setupCommandModule.default;
    if (setupCommand) {
      if (setupCommand.initialize) {
        await setupCommand.initialize();
      }
      commandRegistry.register(setupCommand);
    }
  } catch (error) {
    console.error('Failed to register built-in commands:', error);
  }
}

/**
 * Get command suggestions for auto-complete
 */
export function getCommandSuggestions(input: string): string[] {
  const commands = commandRegistry.getAll();
  const suggestions: string[] = [];

  const cleanInput = input.replace('/', '').toLowerCase();

  for (const command of commands) {
    if (command.name.toLowerCase().startsWith(cleanInput)) {
      suggestions.push(`/${command.name}`);
    }

    // Check aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        if (alias.toLowerCase().startsWith(cleanInput)) {
          suggestions.push(`/${alias}`);
        }
      }
    }
  }

  return suggestions.slice(0, 10); // Limit to 10 suggestions
}

/**
 * Get all commands grouped by category
 */
export function getCommandsByCategory(): Record<string, ISlashCommand[]> {
  const commands = commandRegistry.getAll();
  const grouped: Record<string, ISlashCommand[]> = {};

  for (const command of commands) {
    if (!grouped[command.category]) {
      grouped[command.category] = [];
    }
    grouped[command.category]!.push(command);
  }

  return grouped;
}
