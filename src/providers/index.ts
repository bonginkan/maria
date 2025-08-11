export * from './ai-provider.js';
export * from './openai-provider.js';
export * from './anthropic-provider.js';
export * from './google-ai-provider.js';
export * from './grok-provider.js';
export * from './lmstudio-provider.js';
export * from './vllm-provider.js';
export * from './ollama-provider.js';

import { AIProviderRegistry } from './ai-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GoogleAIProvider } from './google-ai-provider.js';
import { GrokProvider } from './grok-provider.js';
import { LMStudioProvider } from './lmstudio-provider.js';
import { VLLMProvider } from './vllm-provider.js';
import { OllamaProvider } from './ollama-provider.js';

// Register all providers
export function registerAllProviders(): void {
  // Cloud providers - always register
  AIProviderRegistry.register(new OpenAIProvider());
  AIProviderRegistry.register(new AnthropicProvider());
  AIProviderRegistry.register(new GoogleAIProvider());
  AIProviderRegistry.register(new GrokProvider());

  // Local providers - always register (they'll handle availability internally)
  AIProviderRegistry.register(new LMStudioProvider());
  AIProviderRegistry.register(new VLLMProvider());
  AIProviderRegistry.register(new OllamaProvider());
}

// Provider configuration interface
export interface AIProviderConfig {
  provider: string;
  apiKey: string;
  model?: string;
  config?: Record<string, any>;
}

// Provider initialization helper
export async function initializeProvider(config: AIProviderConfig): Promise<void> {
  const provider = AIProviderRegistry.get(config.provider);
  if (!provider) {
    throw new Error(
      `Provider ${config.provider} not found. Available providers: ${AIProviderRegistry.getAll()
        .map((p) => p.name)
        .join(', ')}`,
    );
  }

  await provider.initialize(config.apiKey, config.config);

  if (config.model && !provider.getModels().includes(config.model)) {
    throw new Error(
      `Model ${config.model} is not supported by ${provider.name}. Available models: ${provider.getModels().join(', ')}`,
    );
  }
}

// Helper to get provider from environment variables
export function getProviderConfigFromEnv(): AIProviderConfig | null {
  // Check for provider-specific API keys
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  const grokKey = process.env.GROK_API_KEY;
  const lmstudioEnabled = process.env.LMSTUDIO_ENABLED === 'true';
  const lmstudioKey = process.env.LMSTUDIO_API_KEY || 'lm-studio';
  const vllmEnabled = process.env.VLLM_ENABLED === 'true';
  const vllmKey = process.env.VLLM_API_KEY || 'vllm-local';
  const ollamaEnabled = process.env.OLLAMA_ENABLED === 'true';
  const ollamaKey = process.env.OLLAMA_API_KEY || 'ollama';

  // Check for preferred provider
  const preferredProvider = process.env.AI_PROVIDER || process.env.LLM_PROVIDER;
  const preferredModel = process.env.AI_MODEL || process.env.LLM_MODEL;

  // If preferred provider is specified, use it
  if (preferredProvider) {
    let apiKey: string | undefined;

    switch (preferredProvider.toLowerCase()) {
      case 'openai':
        apiKey = openaiKey;
        break;
      case 'anthropic':
        apiKey = anthropicKey;
        break;
      case 'google':
      case 'googleai':
      case 'gemini':
        apiKey = googleKey;
        break;
      case 'grok':
        apiKey = grokKey;
        break;
      case 'lmstudio':
      case 'lm-studio':
        apiKey = lmstudioKey;
        break;
      case 'vllm':
      case 'v-llm':
        apiKey = vllmKey;
        break;
      case 'ollama':
        apiKey = ollamaKey;
        break;
    }

    if (apiKey) {
      return {
        provider: preferredProvider,
        apiKey,
        model: preferredModel,
      };
    }
  }

  // Otherwise, use the first available provider
  // Priority order: Local models first (for privacy/speed), then cloud

  // Check vLLM first if enabled (highest performance local)
  if (vllmEnabled && vllmKey) {
    return {
      provider: 'vllm',
      apiKey: vllmKey,
      model:
        preferredModel ||
        process.env.VLLM_DEFAULT_MODEL ||
        'stabilityai/japanese-stablelm-2-instruct-1_6b',
    };
  }

  // Check LM Studio if enabled (local models)
  if (lmstudioEnabled && lmstudioKey) {
    return {
      provider: 'lmstudio',
      apiKey: lmstudioKey,
      model: preferredModel || process.env.LMSTUDIO_DEFAULT_MODEL || 'gpt-oss-20b',
    };
  }

  // Check Ollama if enabled (local models)
  if (ollamaEnabled && ollamaKey) {
    return {
      provider: 'ollama',
      apiKey: ollamaKey,
      model: preferredModel || process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2:3b',
    };
  }

  if (openaiKey) {
    return {
      provider: 'openai',
      apiKey: openaiKey,
      model: preferredModel || 'gpt-5-2025-08-07',
    };
  }

  if (anthropicKey) {
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: preferredModel || 'claude-opus-4.1',
    };
  }

  if (googleKey) {
    return {
      provider: 'googleai',
      apiKey: googleKey,
      model: preferredModel || 'gemini-2.5-pro',
    };
  }

  if (grokKey) {
    return {
      provider: 'grok',
      apiKey: grokKey,
      model: preferredModel || 'grok-4-0709',
    };
  }

  return null;
}
