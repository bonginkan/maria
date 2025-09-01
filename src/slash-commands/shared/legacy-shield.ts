/**
 * Legacy Command Shield
 * Provides clean error handling for unmigrated commands
 */

import { CommandResult } from "../types";

/**
 * Commands that should be hidden from help and return shield message
 */
export const LEGACY_COMMANDS = new Set([
  '/battlecard',
  '/sales-dashboard',
  '/status',
  '/doctor'
]);

/**
 * Return shield message for legacy commands
 */
export function shieldLegacyCommand(name: string): CommandResult {
  return {
    success: false,
    message: '🔒 This command is not available in this build. Try /help',
    endReason: 'legacy_blocked'
  };
}

/**
 * Check if command is a legacy command that should be shielded
 */
export function isLegacyCommand(command: string): boolean {
  const normalizedCommand = command.startsWith('/') ? command : `/${command}`;
  return LEGACY_COMMANDS.has(normalizedCommand.toLowerCase());
}

/**
 * Filter out legacy commands from help display
 */
export function filterLegacyCommands<T extends { name: string }>(commands: T[]): T[] {
  return commands.filter(cmd => {
    const cmdName = cmd.name.startsWith('/') ? cmd.name : `/${cmd.name}`;
    return !LEGACY_COMMANDS.has(cmdName.toLowerCase());
  });
}