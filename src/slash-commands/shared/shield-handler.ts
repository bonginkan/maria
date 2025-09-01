/**
 * Shield Handler for Non-Ready Commands
 * Provides consistent UX for commands not yet ready for production
 */

import type { CommandResult } from '../types';

export interface ShieldOptions {
  message?: string;
  showWaitlist?: boolean;
  exitCode?: number;
}

/**
 * Shield handler for non-ready commands
 * Returns a consistent error message and prevents execution
 */
export const shield = (options: ShieldOptions = {}): CommandResult => {
  const {
    message = '🔒 Not available in this build',
    showWaitlist = false,
    exitCode = 1
  } = options;

  const fullMessage = showWaitlist 
    ? `${message} · Join waitlist`
    : `${message} · See /help`;

  return {
    success: false,
    message: fullMessage,
    endReason: 'not_available',
    exitCode,
    requiresInput: false
  };
};

/**
 * Coming Soon shield for partial commands
 */
export const comingSoon = (): CommandResult => 
  shield({ 
    message: '🔒 Coming soon',
    showWaitlist: true
  });

/**
 * Plan restriction shield
 */
export const planRestricted = (requiredPlan: string): CommandResult =>
  shield({
    message: `🔒 Requires ${requiredPlan} plan`,
    showWaitlist: false,
    exitCode: 4
  });

/**
 * Quota exceeded shield
 */
export const quotaExceeded = (): CommandResult => ({
  success: false,
  message: '⚠️ Quota exceeded · See /billing',
  endReason: 'quota_exceeded',
  exitCode: 3,
  requiresInput: false
});

/**
 * Authentication required shield
 */
export const authRequired = (): CommandResult => ({
  success: false,
  message: '🔐 Authentication required · Run: /login',
  endReason: 'auth_required',
  exitCode: 2,
  requiresInput: false
});

/**
 * Rate limited shield
 */
export const rateLimited = (waitSeconds: number): CommandResult => ({
  success: false,
  message: `⏱ Wait ${waitSeconds}s`,
  endReason: 'rate_limited',
  exitCode: 5,
  requiresInput: false
});

/**
 * Check if command should be shielded based on manifest
 */
export async function checkShield(
  commandName: string,
  userPlan: string = 'free'
): Promise<CommandResult | null> {
  try {
    // Load manifest (in production, this would be cached)
    const manifest = await loadManifest();
    const command = manifest.commands.find(c => c.name === commandName);
    
    if (!command) {
      return shield({ message: '❓ Unknown command' });
    }
    
    // Check if command is shippable
    if (!command.shippable) {
      if (command.status === 'hidden') {
        return shield();
      }
      if (command.status === 'partial') {
        return comingSoon();
      }
    }
    
    // Check plan restrictions
    if (!command.plans.includes(userPlan)) {
      const requiredPlan = command.plans[0];
      return planRestricted(requiredPlan);
    }
    
    // Command is ready to execute
    return null;
  } catch (error) {
    // If manifest can't be loaded, shield by default
    return shield();
  }
}

/**
 * Load command manifest
 * In production, this would use Firestore or cached JSON
 */
async function loadManifest() {
  try {
    // For now, use local file
    const fs = await import('fs');
    const path = await import('path');
    const manifestPath = path.join(
      __dirname,
      '../command-manifest-v2.1.json'
    );
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Fallback to empty manifest
    return { commands: [] };
  }
}