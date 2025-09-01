/**
 * IMS Provider Adapter v1.0
 * Bridges IMS routing decisions with existing provider system
 * Implements Phase 2 integration requirements
 */

import type { ProviderId, ProviderRequest, ProviderResponse, ProviderStream } from '../../../providers/config';
import type { IUnifiedAIProvider } from '../../../providers/config';
import type { RoutingDecision } from '../types/RoutingDecision';
import type { IMSRequest } from '../types/IMSRequest';
import { UnifiedAIProviderManager } from '../../../providers/manager';
import { CompleteDecisionLogger } from '../logging/CompleteDecisionLogger';
import { ModelPoolManager } from '../core/ModelPoolManager';

export interface AdapterConfig {
  providerManager: UnifiedAIProviderManager;
  decisionLogger: CompleteDecisionLogger;
  poolManager: ModelPoolManager;
  enableFallback?: boolean;
  maxRetries?: number;
}

export interface ExecutionResult {
  response?: ProviderResponse;
  stream?: ProviderStream;
  actualModel: string;
  actualProvider: ProviderId;
  latencyMs: number;
  retryCount: number;
  fallbackUsed: boolean;
  error?: Error;
}

export class IMSProviderAdapter {
  private readonly providerManager: UnifiedAIProviderManager;
  private readonly decisionLogger: CompleteDecisionLogger;
  private readonly poolManager: ModelPoolManager;
  private readonly enableFallback: boolean;
  private readonly maxRetries: number;

  constructor(config: AdapterConfig) {
    this.providerManager = config.providerManager;
    this.decisionLogger = config.decisionLogger;
    this.poolManager = config.poolManager;
    this.enableFallback = config.enableFallback ?? true;
    this.maxRetries = config.maxRetries ?? 3;
  }

  /**
   * Execute a routing decision through the provider system
   */
  async execute(
    decision: RoutingDecision,
    request: IMSRequest
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: Error | undefined;

    // Try primary model first
    const primaryResult = await this.tryExecuteWithProvider(
      decision.selectedModel,
      request,
      decision
    );

    if (primaryResult.success) {
      return {
        ...primaryResult.result!,
        actualModel: decision.selectedModel,
        actualProvider: this.extractProviderId(decision.selectedModel),
        latencyMs: Date.now() - startTime,
        retryCount: 0,
        fallbackUsed: false
      };
    }

    lastError = primaryResult.error;
    
    // If fallback is enabled and we have fallback models
    if (this.enableFallback && decision.fallbackModels.length > 0) {
      for (const fallbackModel of decision.fallbackModels) {
        retryCount++;
        
        if (retryCount > this.maxRetries) {
          break;
        }

        const fallbackResult = await this.tryExecuteWithProvider(
          fallbackModel,
          request,
          decision
        );

        if (fallbackResult.success) {
          // Log fallback usage
          await this.decisionLogger.logFallback({
            traceId: request.traceId,
            originalModel: decision.selectedModel,
            fallbackModel,
            reason: lastError?.message || 'Primary model failed',
            timestamp: Date.now()
          });

          return {
            ...fallbackResult.result!,
            actualModel: fallbackModel,
            actualProvider: this.extractProviderId(fallbackModel),
            latencyMs: Date.now() - startTime,
            retryCount,
            fallbackUsed: true
          };
        }

        lastError = fallbackResult.error;
      }
    }

    // All attempts failed
    return {
      actualModel: decision.selectedModel,
      actualProvider: this.extractProviderId(decision.selectedModel),
      latencyMs: Date.now() - startTime,
      retryCount,
      fallbackUsed: false,
      error: lastError || new Error('All model attempts failed')
    };
  }

  /**
   * Try to execute with a specific provider/model
   */
  private async tryExecuteWithProvider(
    modelName: string,
    request: IMSRequest,
    decision: RoutingDecision
  ): Promise<{
    success: boolean;
    result?: Partial<ExecutionResult>;
    error?: Error;
  }> {
    try {
      const providerId = this.extractProviderId(modelName);
      const provider = this.providerManager.getProvider(providerId);
      
      if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
      }

      // Check provider health first
      const health = await provider.health();
      if (!health.ok) {
        throw new Error(`Provider ${providerId} unhealthy: ${health.reason}`);
      }

      // Convert IMS request to provider request
      const providerRequest = this.convertToProviderRequest(request, modelName);

      // Execute based on streaming preference
      if (request.streaming) {
        const stream = await provider.stream(request.prompt, providerRequest);
        return {
          success: true,
          result: { stream }
        };
      } else {
        const response = await provider.complete(request.prompt, providerRequest);
        return {
          success: true,
          result: { response }
        };
      }
    } catch (error) {
      // Report failure to pool manager
      await this.poolManager.reportFailure(
        modelName,
        error instanceof Error ? error : new Error(String(error))
      );

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Convert IMS request to provider-specific request
   */
  private convertToProviderRequest(
    imsRequest: IMSRequest,
    modelName: string
  ): ProviderRequest {
    return {
      model: this.extractModelId(modelName),
      temperature: imsRequest.parameters?.temperature,
      maxTokens: imsRequest.parameters?.maxTokens,
      topP: imsRequest.parameters?.topP,
      topK: imsRequest.parameters?.topK,
      frequencyPenalty: imsRequest.parameters?.frequencyPenalty,
      presencePenalty: imsRequest.parameters?.presencePenalty,
      stream: imsRequest.streaming,
      systemPrompt: imsRequest.systemPrompt,
      // Pass through any provider-specific options
      ...imsRequest.providerOptions
    };
  }

  /**
   * Extract provider ID from model name
   * Format: "provider:model" or just "model" (defaults to openai)
   */
  private extractProviderId(modelName: string): ProviderId {
    if (modelName.includes(':')) {
      const [provider] = modelName.split(':');
      return provider as ProviderId;
    }
    
    // Default provider mapping based on model name patterns
    if (modelName.startsWith('gpt-')) return 'openai';
    if (modelName.startsWith('claude-')) return 'anthropic';
    if (modelName.startsWith('gemini-')) return 'google';
    if (modelName.startsWith('llama-')) return 'groq';
    if (modelName.startsWith('mixtral-')) return 'groq';
    
    return 'openai'; // Default fallback
  }

  /**
   * Extract model ID from full model name
   */
  private extractModelId(modelName: string): string {
    if (modelName.includes(':')) {
      const [, model] = modelName.split(':');
      return model;
    }
    return modelName;
  }

  /**
   * Get provider health status for monitoring
   */
  async getProviderHealth(providerId: ProviderId) {
    const provider = this.providerManager.getProvider(providerId);
    if (!provider) {
      return {
        ok: false,
        reason: 'Provider not found'
      };
    }
    return provider.health();
  }

  /**
   * Refresh provider availability
   */
  async refreshProviderAvailability(): Promise<void> {
    await this.providerManager.refreshAvailability();
  }
}