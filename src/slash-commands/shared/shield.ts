/**
 * Professional shields for commands that need to be cleaned up
 * Provides consistent error handling without stack traces
 */

import chalk from 'chalk';

export interface ShieldResult {
  success: boolean;
  message: string;
  endReason: 'not-ready' | 'partial' | 'upgrade-required' | 'service-error';
}

export function shield(commandName: string, reason?: string): ShieldResult {
  return {
    success: false,
    message: `🔒 ${commandName} not available in this build · See /help`,
    endReason: 'not-ready'
  };
}

export function partialShield(commandName: string, limitation: string): ShieldResult {
  return {
    success: false,
    message: `🚧 ${commandName} partially available\n💡 Limitation: ${limitation}\n🔮 Full version coming soon`,
    endReason: 'partial'
  };
}

export function upgradeShield(commandName: string, plan: string = 'PRO'): ShieldResult {
  return {
    success: false,
    message: `💎 ${commandName} requires ${plan} plan\n✨ Upgrade: /upgrade`,
    endReason: 'upgrade-required'
  };
}

export function serviceErrorShield(commandName: string, error?: string): ShieldResult {
  return {
    success: false,
    message: `🔧 ${commandName} temporarily unavailable${error ? `\n💡 ${error}` : ''}\n⏰ Please try again in a moment`,
    endReason: 'service-error'
  };
}

/**
 * Professional command wrapper that catches errors and returns shields
 */
export function withShield<T extends any[]>(
  commandName: string,
  fn: (...args: T) => Promise<any>
) {
  return async (...args: T): Promise<ShieldResult | any> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Never expose stack traces or technical errors to users
      if (process.env.NODE_ENV === 'development') {
        console.error(`[${commandName}] Internal error:`, error);
      }
      
      return serviceErrorShield(commandName, 'Internal service error');
    }
  };
}