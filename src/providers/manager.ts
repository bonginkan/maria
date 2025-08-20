/**
 * AI Provider Manager
 * Manages all AI providers and their availability
 */

import { IAIProvider } from './ai-provider';
import { PriorityMode, ModelInfo } from '../types/index';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GoogleAIProvider } from './google-ai-provider';
// import { GroqProvider } from './groq-provider'; // Uses BaseProvider, not IAIProvider
import { GrokProvider } from './grok-provider';
import { LMStudioProvider } from './lmstudio-provider';
import { OllamaProvider } from './ollama-provider';
import { VLLMProvider } from './vllm-provider';
import { ConfigManager } from '../config/config-manager';

export class AIProviderManager {
  private providers: Map<string, IAIProvider> = new Map();
  private availableProviders: Set<string> = new Set();
  private config: ConfigManager;

  constructor(config: ConfigManager) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize all providers based on configuration
    await this.initializeProviders();
    await this.checkAvailability();
  }

  private async initializeProviders(): Promise<void> {
    const apiKeys = this.config.get('apiKeys', {} as Record<string, string>) || {};
    const localProviders = this.config.get('localProviders', {} as Record<string, boolean>) || {};

    // Cloud providers
    if (apiKeys && apiKeys['OPENAI_API_KEY']) {
      const provider = new OpenAIProvider();
      await provider.initialize(apiKeys['OPENAI_API_KEY']);
      this.providers.set('openai', provider);
    }

    if (apiKeys && apiKeys['ANTHROPIC_API_KEY']) {
      const provider = new AnthropicProvider();
      await provider.initialize(apiKeys['ANTHROPIC_API_KEY']);
      this.providers.set('anthropic', provider);
    }

    if (apiKeys && (apiKeys['GOOGLE_API_KEY'] || apiKeys['GEMINI_API_KEY'])) {
      const provider = new GoogleAIProvider();
      await provider.initialize(apiKeys['GOOGLE_API_KEY'] || apiKeys['GEMINI_API_KEY'] || '');
      this.providers.set('google', provider);
    }

    // Note: GroqProvider uses BaseProvider, not IAIProvider
    // if (apiKeys['GROQ_API_KEY']) {
    //   const provider = new GroqProvider();
    //   await provider.initialize(apiKeys['GROQ_API_KEY']);
    //   this.providers.set('groq', provider);
    // }

    if (apiKeys && apiKeys['GROK_API_KEY']) {
      const provider = new GrokProvider();
      await provider.initialize(apiKeys['GROK_API_KEY']);
      this.providers.set('grok', provider);
    }

    // Local providers
    if (localProviders && localProviders['lmstudio'] !== false) {
      const provider = new LMStudioProvider();
      await provider.initialize('lmstudio');
      this.providers.set('lmstudio', provider);
    }

    if (localProviders && localProviders['ollama'] !== false) {
      const provider = new OllamaProvider();
      await provider.initialize('ollama');
      this.providers.set('ollama', provider);
    }

    if (localProviders && localProviders['vllm'] !== false) {
      const provider = new VLLMProvider();
      await provider.initialize('vllm');
      this.providers.set('vllm', provider);
    }
  }

  private async checkAvailability(): Promise<void> {
    this.availableProviders.clear();

    const checks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      try {
        const isAvailable = await (provider.validateConnection?.() ?? Promise.resolve(true));
        if (isAvailable) {
          this.availableProviders.add(name);
        }
      } catch (error: unknown) {
        // Provider not available
      }
    });

    await Promise.allSettled(checks);
  }

  getProvider(name: string): IAIProvider | undefined {
    return this.providers.get(name);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.availableProviders);
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];

    for (const providerName of this.availableProviders) {
      const provider = this.providers.get(providerName);
      if (provider) {
        try {
          const models = await provider.getModels();
          // Convert string array to ModelInfo array
          const modelInfos: ModelInfo[] = models.map((modelName) => ({
            id: `${providerName}-${modelName}`,
            name: modelName,
            provider: providerName,
            description: `${modelName} from ${providerName}`,
            contextLength: 8192, // Default value
            capabilities: ['text', 'code'], // Default capabilities
            available: true,
            recommendedFor: ['general'],
          }));
          allModels.push(...modelInfos);
        } catch (error: unknown) {
          // Skip provider with model loading issues
        }
      }
    }

    return allModels;
  }

  selectOptimalProvider(
    _taskType?: string,
    priorityMode: PriorityMode = 'auto',
  ): string | undefined {
    const available = this.getAvailableProviders();
    if (available.length === 0) return undefined;

    const priorityOrder = this.getPriorityOrder(priorityMode);

    // Debug logging
    if (process.env['DEBUG']) {
      console.log('Available providers:', available);
      console.log('Priority order:', priorityOrder);
    }

    // Find the first available provider in priority order
    for (const providerName of priorityOrder) {
      if (available.includes(providerName)) {
        if (process.env['DEBUG']) {
          console.log('Selected provider:', providerName);
        }
        return providerName;
      }
    }

    // Fallback to first available
    return available[0];
  }

  private getPriorityOrder(mode: PriorityMode): string[] {
    switch (mode) {
      case 'privacy-first':
        return ['lmstudio', 'ollama', 'vllm', 'anthropic', 'openai', 'google', 'groq', 'grok'];

      case 'performance':
        return ['groq', 'grok', 'openai', 'anthropic', 'google', 'ollama', 'lmstudio', 'vllm'];

      case 'cost-effective':
        return ['google', 'groq', 'openai', 'anthropic', 'grok', 'ollama', 'vllm', 'lmstudio'];

      case 'auto':
      default:
        // Cloud providers first for better reliability
        return ['openai', 'anthropic', 'google', 'groq', 'grok', 'lmstudio', 'ollama', 'vllm'];
    }
  }

  async refreshAvailability(): Promise<void> {
    await this.checkAvailability();
  }

  async close(): Promise<void> {
    // Clean up any connections if needed
    this.providers.clear();
    this.availableProviders.clear();
  }

  // Health check for monitoring
  async getProviderHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    const checks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      try {
        // Check if provider has health check capability
        if ('isAvailable' in provider && typeof provider.isAvailable === 'function') {
          health[name] = await (
            provider as unknown as { isAvailable(): Promise<boolean> }
          ).isAvailable();
        } else {
          // Fallback: consider provider healthy if it's initialized
          health[name] = true;
        }
      } catch {
        health[name] = false;
      }
    });

    await Promise.allSettled(checks);
    return health;
  }
}
