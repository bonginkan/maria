/**
 * /brain command - V2 implementation with minimal stub
 * Phase 3: BROKEN → READY conversion
 */

import { brainStub } from '../../stubs/configuration-stubs.js';
import { Guards, type GuardContext } from '../../../services/guards/command-guards.js';

export interface BrainCommandMetadata {
  name: 'brain';
  description: 'Manage AI brain and memory systems';
  category: 'configuration';
  aliases: ['memory', 'mind', 'cognitive'];
  version: '2.0.0';
}

export class BrainCommandV2 {
  public readonly metadata: BrainCommandMetadata = {
    name: 'brain',
    description: 'Manage AI brain and memory systems',
    category: 'configuration',
    aliases: ['memory', 'mind', 'cognitive'],
    version: '2.0.0'
  };

  /**
   * Execute brain command
   */
  async execute(args: string[], context?: any): Promise<any> {
    // Apply guards
    const guardContext: GuardContext = {
      command: 'brain',
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
    const [action, type] = args;

    // Handle different actions
    switch (action) {
      case 'status':
      case 'info':
        const statusResult = await brainStub.status();
        return {
          success: statusResult.success,
          output: this.formatStatus(statusResult),
          data: statusResult,
          requiresInput: false,
          endReason: 'success'
        };

      case 'clear':
      case 'reset':
        const clearResult = await brainStub.clear(type);
        return {
          success: clearResult.success,
          output: clearResult.message,
          data: clearResult,
          requiresInput: false,
          endReason: 'success'
        };

      case 'optimize':
      case 'opt':
        const optimizeResult = await brainStub.optimize();
        return {
          success: optimizeResult.success,
          output: `${optimizeResult.message}\n${this.formatImprovements(optimizeResult.improvements)}`,
          data: optimizeResult,
          requiresInput: false,
          endReason: 'success'
        };

      default:
        // No action - show status
        const defaultStatus = await brainStub.status();
        return {
          success: defaultStatus.success,
          output: this.formatStatus(defaultStatus),
          data: defaultStatus,
          requiresInput: false,
          endReason: 'success'
        };
    }
  }

  private formatStatus(result: any): string {
    return `🧠 Brain Status
    
Memory:
  • Short-term: ${result.memory.shortTerm.items} items (${result.memory.shortTerm.capacity} used)
  • Long-term: ${result.memory.longTerm.items} items (${result.memory.longTerm.capacity} used)
  • Working: ${result.memory.working.items} items (${result.memory.working.capacity} used)

Reasoning:
  • Active: ${result.reasoning.active ? '✅' : '❌'}
  • Chains: ${result.reasoning.chains}
  • Depth: ${result.reasoning.depth}

Learning:
  • Enabled: ${result.learning.enabled ? '✅' : '❌'}
  • Rate: ${result.learning.rate}
  • Episodes: ${result.learning.episodes}`;
  }

  private formatImprovements(improvements: any): string {
    return Object.entries(improvements)
      .map(([key, value]) => `  • ${key}: ${value}`)
      .join('\n');
  }
}

// Export for legacy compatibility
export default BrainCommandV2;