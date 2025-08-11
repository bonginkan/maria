import { loadConfig, saveConfig } from '../utils/config.js';
import { AIProviderConfig, getProviderConfigFromEnv } from './index.js';

/**
 * Get AI provider configuration from multiple sources
 * Priority: Environment Variables > Config File > Defaults
 */
export async function getAIProviderConfig(): Promise<AIProviderConfig | null> {
  // First, check environment variables
  const envConfig = getProviderConfigFromEnv();
  if (envConfig) {
    return envConfig;
  }

  // Then, check config file
  const config = await loadConfig();

  if (config.ai?.provider && config.ai?.apiKey) {
    return {
      provider: config.ai.provider,
      apiKey: config.ai.apiKey,
      model: config.ai.preferredModel || config.ai.defaultModel,
      config: config.ai.providerConfig,
    };
  }

  // Legacy support for defaultModel
  if (config.defaultModel) {
    // Try to infer provider from model name
    const modelLower = config.defaultModel.toLowerCase();

    if (modelLower.includes('gpt') || modelLower.includes('o1')) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        return {
          provider: 'openai',
          apiKey,
          model: config.defaultModel,
        };
      }
    } else if (modelLower.includes('claude')) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        return {
          provider: 'anthropic',
          apiKey,
          model: config.defaultModel,
        };
      }
    } else if (modelLower.includes('gemini')) {
      const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (apiKey) {
        return {
          provider: 'googleai',
          apiKey,
          model: config.defaultModel,
        };
      }
    } else if (
      modelLower.includes('grok') ||
      modelLower.includes('llama') ||
      modelLower.includes('mixtral')
    ) {
      const apiKey = process.env.GROK_API_KEY;
      if (apiKey) {
        return {
          provider: 'grok',
          apiKey,
          model: config.defaultModel,
        };
      }
    }
  }

  return null;
}

/**
 * Save AI provider configuration to config file
 */
export async function saveAIProviderConfig(providerConfig: AIProviderConfig): Promise<void> {
  const config = await loadConfig();

  // Update AI configuration
  config.ai = {
    ...config.ai,
    provider: providerConfig.provider,
    apiKey: providerConfig.apiKey,
    preferredModel: providerConfig.model,
    providerConfig: providerConfig.config,
  };

  // Also update defaultModel for backward compatibility
  if (providerConfig.model) {
    config.defaultModel = providerConfig.model;
  }

  await saveConfig(config);
}

/**
 * Model name mappings for backward compatibility
 */
export const MODEL_MAPPINGS: Record<string, { provider: string; model: string }> = {
  // Legacy Gemini models
  'gemini-2.5-pro': { provider: 'googleai', model: 'gemini-2.5-pro' },
  'gemini-1.5-pro': { provider: 'googleai', model: 'gemini-1.5-pro' },
  'gemini-pro': { provider: 'googleai', model: 'gemini-1.0-pro' },

  // Grok models (x.ai)
  'grok-4': { provider: 'grok', model: 'grok-4-0709' },
  'llama3-70b': { provider: 'grok', model: 'llama-3.1-70b-versatile' },
  'mixtral-8x7b': { provider: 'grok', model: 'mixtral-8x7b-32768' },

  // OpenAI models
  'gpt-4': { provider: 'openai', model: 'gpt-4' },
  'gpt-4-turbo': { provider: 'openai', model: 'gpt-4-turbo' },
  'gpt-3.5-turbo': { provider: 'openai', model: 'gpt-3.5-turbo' },

  // Anthropic models
  'claude-3-opus': { provider: 'anthropic', model: 'claude-3-opus-20240229' },
  'claude-3-sonnet': { provider: 'anthropic', model: 'claude-3-sonnet-20240229' },
  'claude-3-haiku': { provider: 'anthropic', model: 'claude-3-haiku-20240307' },
};

/**
 * Get provider and model from a model name (with backward compatibility)
 */
export function getProviderForModel(modelName: string): { provider: string; model: string } | null {
  // Check if it's in the mapping
  const mapping = MODEL_MAPPINGS[modelName];
  if (mapping) {
    return mapping;
  }

  // Try to infer from model name
  const modelLower = modelName.toLowerCase();

  if (modelLower.includes('gpt') || modelLower.includes('o1')) {
    return { provider: 'openai', model: modelName };
  } else if (modelLower.includes('claude') || modelLower.includes('opus')) {
    return { provider: 'anthropic', model: modelName };
  } else if (modelLower.includes('gemini')) {
    return { provider: 'googleai', model: modelName };
  } else if (
    modelLower.includes('grok') ||
    modelLower.includes('llama') ||
    modelLower.includes('mixtral')
  ) {
    return { provider: 'grok', model: modelName };
  }

  return null;
}
