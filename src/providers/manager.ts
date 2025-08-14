/**
 * AI Provider Manager
 * Manages all AI providers and their availability
 */

import { AIProvider, ModelInfo, PriorityMode } from '../types';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GoogleProvider } from './google-provider';
import { GroqProvider } from './groq-provider';
import { GrokProvider } from './grok-provider';
import { LMStudioProvider } from './lmstudio-provider';
import { OllamaProvider } from './ollama-provider';
import { VLLMProvider } from './vllm-provider';
import { ConfigManager } from '../config/config-manager';

export class AIProviderManager {
  private providers: Map<string, AIProvider> = new Map();
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
    const apiKeys = this.config.get('apiKeys', {} as Record<string, string>);
    const localProviders = this.config.get('localProviders', {} as Record<string, boolean>);

    // Cloud providers
    if (apiKeys['OPENAI_API_KEY']) {
      this.providers.set('openai', new OpenAIProvider(apiKeys['OPENAI_API_KEY']));
    }

    if (apiKeys['ANTHROPIC_API_KEY']) {
      this.providers.set('anthropic', new AnthropicProvider(apiKeys['ANTHROPIC_API_KEY']));
    }

    if (apiKeys['GOOGLE_API_KEY'] || apiKeys['GEMINI_API_KEY']) {
      this.providers.set(
        'google',
        new GoogleProvider(apiKeys['GOOGLE_API_KEY'] || apiKeys['GEMINI_API_KEY']),
      );
    }

    if (apiKeys['GROQ_API_KEY']) {
      this.providers.set('groq', new GroqProvider(apiKeys['GROQ_API_KEY']));
    }

    if (apiKeys['GROK_API_KEY']) {
      this.providers.set('grok', new GrokProvider(apiKeys['GROK_API_KEY']));
    }

    // Local providers
    if (localProviders['lmstudio'] !== false) {
      this.providers.set('lmstudio', new LMStudioProvider());
    }

    if (localProviders['ollama'] !== false) {
      this.providers.set('ollama', new OllamaProvider());
    }

    if (localProviders['vllm'] !== false) {
      this.providers.set('vllm', new VLLMProvider());
    }
  }

  private async checkAvailability(): Promise<void> {
    this.availableProviders.clear();

    const checks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      try {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          this.availableProviders.add(name);
        }
      } catch (error: unknown) {
        // Provider not available
      }
    });

    await Promise.allSettled(checks);
  }

  getProvider(name: string): AIProvider | undefined {
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
          allModels.push(...models);
        } catch (error: unknown) {
          // Skip provider with model loading issues
        }
      }
    }

    return allModels;
  }

  selectOptimalProvider(
    taskType?: string,
    priorityMode: PriorityMode = 'auto',
  ): string | undefined {
    const available = this.getAvailableProviders();
    if (available.length === 0) return undefined;

    const priorityOrder = this.getPriorityOrder(priorityMode);

    // Find the first available provider in priority order
    for (const providerName of priorityOrder) {
      if (available.includes(providerName)) {
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
        return ['groq', 'grok', 'ollama', 'lmstudio', 'google', 'openai', 'anthropic', 'vllm'];

      case 'cost-effective':
        return ['ollama', 'vllm', 'google', 'groq', 'openai', 'anthropic', 'grok', 'lmstudio'];

      case 'auto':
      default:
        return ['lmstudio', 'ollama', 'google', 'groq', 'openai', 'anthropic', 'grok', 'vllm'];
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
        health[name] = await provider.isAvailable();
      } catch {
        health[name] = false;
      }
    });

    await Promise.allSettled(checks);
    return health;
  }
}
