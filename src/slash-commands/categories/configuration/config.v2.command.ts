/**
 * /config command - V2 implementation with minimal stub
 * Phase 3: BROKEN → READY conversion
 */

import { configStub } from '../../stubs/configuration-stubs.js';
import { Guards, type GuardContext } from '../../../services/guards/command-guards.js';

export interface ConfigCommandMetadata {
  name: 'config';
  description: 'Manage application configuration';
  category: 'configuration';
  aliases: ['cfg', 'settings', 'conf'];
  version: '2.0.0';
}

export class ConfigCommandV2 {
  public readonly metadata: ConfigCommandMetadata = {
    name: 'config',
    description: 'Manage application configuration',
    category: 'configuration',
    aliases: ['cfg', 'settings', 'conf'],
    version: '2.0.0'
  };

  /**
   * Execute config command
   */
  async execute(args: string[], context?: any): Promise<any> {
    // Apply guards
    const guardContext: GuardContext = {
      command: 'config',
      args,
      context
    };
    
    const guardResult = await Guards.public(guardContext);
    if (!guardResult.allowed) {
      return {
        success: false,
        error: guardResult.reason || 'Command not allowed'
      };
    }

    // Parse command arguments
    const [action, key, ...valueParts] = args;
    const value = valueParts.join(' ');

    // Handle different actions
    switch (action) {
      case 'get':
        const getResult = await configStub.get(key);
        return {
          success: getResult.success,
          output: key ? 
            `${key}: ${getResult.value}` : 
            JSON.stringify(getResult.config, null, 2),
          data: getResult,
          requiresInput: false,
          endReason: 'success'
        };

      case 'set':
        if (!key || !value) {
          return {
            success: false,
            error: 'Usage: /config set <key> <value>',
            requiresInput: false,
            endReason: 'error'
          };
        }
        const setResult = await configStub.set(key, value);
        return {
          success: setResult.success,
          output: setResult.message,
          data: setResult,
          requiresInput: false,
          endReason: 'success'
        };

      case 'reset':
        const resetResult = await configStub.reset();
        return {
          success: resetResult.success,
          output: resetResult.message,
          data: resetResult,
          requiresInput: false,
          endReason: 'success'
        };

      default:
        // No action specified, show all config
        const allConfig = await configStub.get();
        return {
          success: allConfig.success,
          output: JSON.stringify(allConfig.config, null, 2),
          data: allConfig,
          requiresInput: false,
          endReason: 'success'
        };
    }
  }
}

// Export for legacy compatibility
export default ConfigCommandV2;