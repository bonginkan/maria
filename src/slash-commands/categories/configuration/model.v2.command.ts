/**
 * /model command - V2 implementation with minimal stub
 * Phase 3: BROKEN → READY conversion
 */

import { modelStub } from '../../stubs/configuration-stubs.js';
import { Guards, type GuardContext } from '../../../services/guards/command-guards.js';

export interface ModelCommandMetadata {
  name: 'model';
  description: 'Manage AI models';
  category: 'configuration';
  aliases: ['mdl', 'llm', 'ai'];
  version: '2.0.0';
}

export class ModelCommandV2 {
  public readonly metadata: ModelCommandMetadata = {
    name: 'model',
    description: 'Manage AI models',
    category: 'configuration',
    aliases: ['mdl', 'llm', 'ai'],
    version: '2.0.0'
  };

  /**
   * Execute model command
   */
  async execute(args: string[], context?: any): Promise<any> {
    // Apply guards
    const guardContext: GuardContext = {
      command: 'model',
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
    const [action, modelId] = args;

    // Handle different actions
    switch (action) {
      case 'list':
      case 'ls':
        const listResult = await modelStub.list();
        return {
          success: listResult.success,
          output: listResult.models.map(m => 
            `${m.id === listResult.current ? '→' : ' '} ${m.id} (${m.provider}) - ${m.status}`
          ).join('\n'),
          data: listResult,
          requiresInput: false,
          endReason: 'success'
        };

      case 'switch':
      case 'use':
        if (!modelId) {
          return {
            success: false,
            error: 'Usage: /model switch <model-id>',
            requiresInput: false,
            endReason: 'error'
          };
        }
        const switchResult = await modelStub.switch(modelId);
        return {
          success: switchResult.success,
          output: switchResult.message,
          data: switchResult,
          requiresInput: false,
          endReason: 'success'
        };

      case 'info':
      case 'show':
        const infoResult = await modelStub.info(modelId);
        return {
          success: infoResult.success,
          output: JSON.stringify(infoResult.model, null, 2),
          data: infoResult,
          requiresInput: false,
          endReason: 'success'
        };

      default:
        // No action or unknown action - show current model info
        const currentInfo = await modelStub.info();
        return {
          success: currentInfo.success,
          output: `Current model: ${currentInfo.model.name} (${currentInfo.model.id})\nProvider: ${currentInfo.model.provider}`,
          data: currentInfo,
          requiresInput: false,
          endReason: 'success'
        };
    }
  }
}

// Export for legacy compatibility
export default ModelCommandV2;