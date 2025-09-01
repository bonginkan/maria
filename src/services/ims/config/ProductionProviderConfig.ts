/**
 * Production Provider Configuration for IMS v1.0
 * Real-world provider settings with API keys, rate limits, and monitoring
 * Phase 3 implementation
 */

import type { ProviderId } from '../../../providers/config';

export interface ProductionProviderConfig {
  providerId: ProviderId;
  enabled: boolean;
  apiConfig: {
    baseUrl: string;
    apiKeyEnvVar: string;
    timeout: number;
    retries: number;
    rateLimit: {
      requestsPerMinute: number;
      requestsPerHour: number;
      requestsPerDay: number;
    };
  };
  models: ProductionModelConfig[];
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    endpoint?: string;
    method: 'ping' | 'simple_prompt' | 'custom';
    customPrompt?: string;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      errorRate: number;
      latencyP95: number;
      availability: number;
    };
  };
  fallback: {
    enabled: boolean;
    cooldownMs: number;
    maxRetries: number;
  };
}

export interface ProductionModelConfig {
  modelId: string;
  displayName: string;
  enabled: boolean;
  capabilities: ModelCapability[];
  limits: {
    maxTokens: number;
    contextWindow: number;
    maxConcurrent: number;
  };
  pricing: {
    inputCostPer1k: number;
    outputCostPer1k: number;
    currency: 'USD';
  };
  performance: {
    avgLatencyMs: number;
    p95LatencyMs: number;
    avgTokensPerSecond: number;
  };
  priority: number; // 1-10, lower = higher priority
  tags: string[];
}

export type ModelCapability = 
  | 'text_generation'
  | 'code_generation'
  | 'vision'
  | 'multimodal'
  | 'function_calling'
  | 'streaming'
  | 'json_mode'
  | 'system_prompt';

/**
 * Production Provider Configurations
 * Real-world settings for each provider
 */
export const PRODUCTION_PROVIDER_CONFIGS: Record<ProviderId, ProductionProviderConfig> = {
  openai: {
    providerId: 'openai',
    enabled: true,
    apiConfig: {
      baseUrl: 'https://api.openai.com/v1',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      timeout: 60000,
      retries: 3,
      rateLimit: {
        requestsPerMinute: 500,
        requestsPerHour: 10000,
        requestsPerDay: 100000
      }
    },
    models: [
      {
        modelId: 'gpt-4-turbo',
        displayName: 'GPT-4 Turbo',
        enabled: true,
        capabilities: ['text_generation', 'code_generation', 'function_calling', 'streaming', 'json_mode', 'system_prompt'],
        limits: {
          maxTokens: 4096,
          contextWindow: 128000,
          maxConcurrent: 10
        },
        pricing: {
          inputCostPer1k: 0.01,
          outputCostPer1k: 0.03,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 2000,
          p95LatencyMs: 5000,
          avgTokensPerSecond: 50
        },
        priority: 1,
        tags: ['premium', 'high-quality', 'complex']
      },
      {
        modelId: 'gpt-4',
        displayName: 'GPT-4',
        enabled: true,
        capabilities: ['text_generation', 'code_generation', 'function_calling', 'streaming', 'json_mode', 'system_prompt'],
        limits: {
          maxTokens: 4096,
          contextWindow: 8192,
          maxConcurrent: 8
        },
        pricing: {
          inputCostPer1k: 0.03,
          outputCostPer1k: 0.06,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 3000,
          p95LatencyMs: 8000,
          avgTokensPerSecond: 30
        },
        priority: 2,
        tags: ['premium', 'high-quality', 'complex']
      },
      {
        modelId: 'gpt-3.5-turbo',
        displayName: 'GPT-3.5 Turbo',
        enabled: true,
        capabilities: ['text_generation', 'code_generation', 'function_calling', 'streaming', 'json_mode', 'system_prompt'],
        limits: {
          maxTokens: 4096,
          contextWindow: 16385,
          maxConcurrent: 20
        },
        pricing: {
          inputCostPer1k: 0.001,
          outputCostPer1k: 0.002,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 1500,
          p95LatencyMs: 3000,
          avgTokensPerSecond: 80
        },
        priority: 5,
        tags: ['cost-effective', 'fast', 'general']
      }
    ],
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      method: 'simple_prompt',
      customPrompt: 'Hello'
    },
    monitoring: {
      enabled: true,
      metricsInterval: 60000,
      alertThresholds: {
        errorRate: 0.05,
        latencyP95: 10000,
        availability: 0.99
      }
    },
    fallback: {
      enabled: true,
      cooldownMs: 300000,
      maxRetries: 3
    }
  },

  anthropic: {
    providerId: 'anthropic',
    enabled: true,
    apiConfig: {
      baseUrl: 'https://api.anthropic.com/v1',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      timeout: 60000,
      retries: 3,
      rateLimit: {
        requestsPerMinute: 300,
        requestsPerHour: 5000,
        requestsPerDay: 50000
      }
    },
    models: [
      {
        modelId: 'claude-3-opus-20240229',
        displayName: 'Claude 3 Opus',
        enabled: true,
        capabilities: ['text_generation', 'code_generation', 'vision', 'multimodal', 'streaming', 'system_prompt'],
        limits: {
          maxTokens: 4096,
          contextWindow: 200000,
          maxConcurrent: 5
        },
        pricing: {
          inputCostPer1k: 0.015,
          outputCostPer1k: 0.075,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 2500,
          p95LatencyMs: 6000,
          avgTokensPerSecond: 40
        },
        priority: 1,
        tags: ['premium', 'long-context', 'reasoning']
      },
      {
        modelId: 'claude-3-sonnet-20240229',
        displayName: 'Claude 3 Sonnet',
        enabled: true,
        capabilities: ['text_generation', 'code_generation', 'vision', 'multimodal', 'streaming', 'system_prompt'],
        limits: {
          maxTokens: 4096,
          contextWindow: 200000,
          maxConcurrent: 10
        },
        pricing: {
          inputCostPer1k: 0.003,
          outputCostPer1k: 0.015,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 2000,
          p95LatencyMs: 4500,
          avgTokensPerSecond: 55
        },
        priority: 3,
        tags: ['balanced', 'long-context', 'code']
      },
      {
        modelId: 'claude-3-haiku-20240307',
        displayName: 'Claude 3 Haiku',
        enabled: true,
        capabilities: ['text_generation', 'streaming', 'system_prompt'],
        limits: {
          maxTokens: 4096,
          contextWindow: 200000,
          maxConcurrent: 20
        },
        pricing: {
          inputCostPer1k: 0.00025,
          outputCostPer1k: 0.00125,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 1000,
          p95LatencyMs: 2000,
          avgTokensPerSecond: 100
        },
        priority: 6,
        tags: ['fast', 'cost-effective', 'simple']
      }
    ],
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      method: 'simple_prompt',
      customPrompt: 'Hi'
    },
    monitoring: {
      enabled: true,
      metricsInterval: 60000,
      alertThresholds: {
        errorRate: 0.03,
        latencyP95: 8000,
        availability: 0.98
      }
    },
    fallback: {
      enabled: true,
      cooldownMs: 300000,
      maxRetries: 3
    }
  },

  google: {
    providerId: 'google',
    enabled: true,
    apiConfig: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
      timeout: 60000,
      retries: 3,
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 15000
      }
    },
    models: [
      {
        modelId: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        enabled: true,
        capabilities: ['text_generation', 'code_generation', 'vision', 'multimodal', 'streaming', 'system_prompt'],
        limits: {
          maxTokens: 8192,
          contextWindow: 1048576, // 1M tokens
          maxConcurrent: 5
        },
        pricing: {
          inputCostPer1k: 0.0035,
          outputCostPer1k: 0.0105,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 3000,
          p95LatencyMs: 7000,
          avgTokensPerSecond: 35
        },
        priority: 2,
        tags: ['long-context', 'multimodal', 'reasoning']
      },
      {
        modelId: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        enabled: true,
        capabilities: ['text_generation', 'code_generation', 'vision', 'multimodal', 'streaming'],
        limits: {
          maxTokens: 8192,
          contextWindow: 1048576,
          maxConcurrent: 10
        },
        pricing: {
          inputCostPer1k: 0.00035,
          outputCostPer1k: 0.0014,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 1500,
          p95LatencyMs: 3500,
          avgTokensPerSecond: 70
        },
        priority: 4,
        tags: ['fast', 'multimodal', 'cost-effective']
      }
    ],
    healthCheck: {
      enabled: true,
      interval: 45000,
      timeout: 10000,
      method: 'simple_prompt',
      customPrompt: 'Test'
    },
    monitoring: {
      enabled: true,
      metricsInterval: 60000,
      alertThresholds: {
        errorRate: 0.05,
        latencyP95: 10000,
        availability: 0.97
      }
    },
    fallback: {
      enabled: true,
      cooldownMs: 600000,
      maxRetries: 2
    }
  },

  groq: {
    providerId: 'groq',
    enabled: true,
    apiConfig: {
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKeyEnvVar: 'GROQ_API_KEY',
      timeout: 30000,
      retries: 2,
      rateLimit: {
        requestsPerMinute: 30,
        requestsPerHour: 500,
        requestsPerDay: 5000
      }
    },
    models: [
      {
        modelId: 'mixtral-8x7b-32768',
        displayName: 'Mixtral 8x7B',
        enabled: true,
        capabilities: ['text_generation', 'code_generation', 'streaming'],
        limits: {
          maxTokens: 4096,
          contextWindow: 32768,
          maxConcurrent: 3
        },
        pricing: {
          inputCostPer1k: 0.0002,
          outputCostPer1k: 0.0002,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 500,
          p95LatencyMs: 1200,
          avgTokensPerSecond: 200
        },
        priority: 7,
        tags: ['ultra-fast', 'cost-effective', 'low-latency']
      },
      {
        modelId: 'llama3-70b-8192',
        displayName: 'Llama 3 70B',
        enabled: true,
        capabilities: ['text_generation', 'code_generation', 'streaming'],
        limits: {
          maxTokens: 4096,
          contextWindow: 8192,
          maxConcurrent: 2
        },
        pricing: {
          inputCostPer1k: 0.00059,
          outputCostPer1k: 0.00079,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 800,
          p95LatencyMs: 2000,
          avgTokensPerSecond: 150
        },
        priority: 8,
        tags: ['fast', 'open-source', 'cost-effective']
      }
    ],
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      method: 'simple_prompt',
      customPrompt: 'Hi'
    },
    monitoring: {
      enabled: true,
      metricsInterval: 30000,
      alertThresholds: {
        errorRate: 0.08,
        latencyP95: 3000,
        availability: 0.95
      }
    },
    fallback: {
      enabled: true,
      cooldownMs: 180000,
      maxRetries: 2
    }
  },

  grok: {
    providerId: 'grok',
    enabled: false, // Not generally available yet
    apiConfig: {
      baseUrl: 'https://api.x.ai/v1',
      apiKeyEnvVar: 'GROK_API_KEY',
      timeout: 60000,
      retries: 3,
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        requestsPerDay: 20000
      }
    },
    models: [
      {
        modelId: 'grok-beta',
        displayName: 'Grok Beta',
        enabled: false,
        capabilities: ['text_generation', 'streaming'],
        limits: {
          maxTokens: 4096,
          contextWindow: 16384,
          maxConcurrent: 5
        },
        pricing: {
          inputCostPer1k: 0.005,
          outputCostPer1k: 0.015,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 2500,
          p95LatencyMs: 6000,
          avgTokensPerSecond: 45
        },
        priority: 9,
        tags: ['experimental', 'beta']
      }
    ],
    healthCheck: {
      enabled: false,
      interval: 60000,
      timeout: 10000,
      method: 'ping'
    },
    monitoring: {
      enabled: false,
      metricsInterval: 60000,
      alertThresholds: {
        errorRate: 0.1,
        latencyP95: 10000,
        availability: 0.9
      }
    },
    fallback: {
      enabled: false,
      cooldownMs: 600000,
      maxRetries: 1
    }
  },

  ollama: {
    providerId: 'ollama',
    enabled: true,
    apiConfig: {
      baseUrl: 'http://localhost:11434/v1',
      apiKeyEnvVar: 'OLLAMA_API_KEY', // Optional for local
      timeout: 120000,
      retries: 2,
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        requestsPerDay: 50000
      }
    },
    models: [
      {
        modelId: 'llama3:8b',
        displayName: 'Llama 3 8B',
        enabled: true,
        capabilities: ['text_generation', 'streaming'],
        limits: {
          maxTokens: 4096,
          contextWindow: 8192,
          maxConcurrent: 2
        },
        pricing: {
          inputCostPer1k: 0, // Local model
          outputCostPer1k: 0,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 5000,
          p95LatencyMs: 12000,
          avgTokensPerSecond: 20
        },
        priority: 10,
        tags: ['local', 'privacy', 'free', 'open-source']
      },
      {
        modelId: 'codellama:13b',
        displayName: 'Code Llama 13B',
        enabled: true,
        capabilities: ['text_generation', 'code_generation', 'streaming'],
        limits: {
          maxTokens: 4096,
          contextWindow: 16384,
          maxConcurrent: 1
        },
        pricing: {
          inputCostPer1k: 0,
          outputCostPer1k: 0,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 8000,
          p95LatencyMs: 18000,
          avgTokensPerSecond: 15
        },
        priority: 11,
        tags: ['local', 'code', 'free', 'privacy']
      }
    ],
    healthCheck: {
      enabled: true,
      interval: 60000,
      timeout: 10000,
      method: 'ping',
      endpoint: '/api/tags'
    },
    monitoring: {
      enabled: true,
      metricsInterval: 120000,
      alertThresholds: {
        errorRate: 0.1,
        latencyP95: 20000,
        availability: 0.9
      }
    },
    fallback: {
      enabled: true,
      cooldownMs: 300000,
      maxRetries: 1
    }
  },

  lmstudio: {
    providerId: 'lmstudio',
    enabled: false, // Requires local setup
    apiConfig: {
      baseUrl: 'http://localhost:1234/v1',
      apiKeyEnvVar: 'LMSTUDIO_API_KEY',
      timeout: 120000,
      retries: 2,
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      }
    },
    models: [
      {
        modelId: 'local-model',
        displayName: 'LM Studio Local Model',
        enabled: false,
        capabilities: ['text_generation', 'streaming'],
        limits: {
          maxTokens: 4096,
          contextWindow: 8192,
          maxConcurrent: 1
        },
        pricing: {
          inputCostPer1k: 0,
          outputCostPer1k: 0,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 6000,
          p95LatencyMs: 15000,
          avgTokensPerSecond: 25
        },
        priority: 12,
        tags: ['local', 'gui', 'free']
      }
    ],
    healthCheck: {
      enabled: false,
      interval: 60000,
      timeout: 10000,
      method: 'ping'
    },
    monitoring: {
      enabled: false,
      metricsInterval: 120000,
      alertThresholds: {
        errorRate: 0.2,
        latencyP95: 20000,
        availability: 0.8
      }
    },
    fallback: {
      enabled: false,
      cooldownMs: 300000,
      maxRetries: 1
    }
  },

  vllm: {
    providerId: 'vllm',
    enabled: false, // Requires self-hosted setup
    apiConfig: {
      baseUrl: 'http://localhost:8000/v1',
      apiKeyEnvVar: 'VLLM_API_KEY',
      timeout: 120000,
      retries: 2,
      rateLimit: {
        requestsPerMinute: 200,
        requestsPerHour: 5000,
        requestsPerDay: 50000
      }
    },
    models: [
      {
        modelId: 'vllm-hosted',
        displayName: 'vLLM Self-Hosted Model',
        enabled: false,
        capabilities: ['text_generation', 'streaming'],
        limits: {
          maxTokens: 4096,
          contextWindow: 16384,
          maxConcurrent: 4
        },
        pricing: {
          inputCostPer1k: 0,
          outputCostPer1k: 0,
          currency: 'USD'
        },
        performance: {
          avgLatencyMs: 2000,
          p95LatencyMs: 5000,
          avgTokensPerSecond: 80
        },
        priority: 13,
        tags: ['self-hosted', 'fast', 'scalable']
      }
    ],
    healthCheck: {
      enabled: false,
      interval: 30000,
      timeout: 5000,
      method: 'ping'
    },
    monitoring: {
      enabled: false,
      metricsInterval: 60000,
      alertThresholds: {
        errorRate: 0.05,
        latencyP95: 8000,
        availability: 0.95
      }
    },
    fallback: {
      enabled: false,
      cooldownMs: 300000,
      maxRetries: 2
    }
  }
};

/**
 * Environment-specific configurations
 */
export const ENVIRONMENT_CONFIGS = {
  production: {
    healthCheckInterval: 30000,
    metricsInterval: 60000,
    enableFallback: true,
    enableMonitoring: true,
    maxConcurrentRequests: 100,
    globalTimeout: 60000
  },
  staging: {
    healthCheckInterval: 60000,
    metricsInterval: 120000,
    enableFallback: true,
    enableMonitoring: true,
    maxConcurrentRequests: 50,
    globalTimeout: 30000
  },
  development: {
    healthCheckInterval: 120000,
    metricsInterval: 300000,
    enableFallback: false,
    enableMonitoring: false,
    maxConcurrentRequests: 10,
    globalTimeout: 15000
  }
};

/**
 * Get provider configuration by ID
 */
export function getProviderConfig(providerId: ProviderId): ProductionProviderConfig | undefined {
  return PRODUCTION_PROVIDER_CONFIGS[providerId];
}

/**
 * Get all enabled provider configurations
 */
export function getEnabledProviders(): ProductionProviderConfig[] {
  return Object.values(PRODUCTION_PROVIDER_CONFIGS).filter(config => config.enabled);
}

/**
 * Get models for a specific provider
 */
export function getProviderModels(providerId: ProviderId): ProductionModelConfig[] {
  const config = getProviderConfig(providerId);
  return config?.models.filter(model => model.enabled) || [];
}

/**
 * Get all available models across all providers
 */
export function getAllAvailableModels(): Array<ProductionModelConfig & { providerId: ProviderId }> {
  const models: Array<ProductionModelConfig & { providerId: ProviderId }> = [];
  
  for (const config of getEnabledProviders()) {
    for (const model of config.models.filter(m => m.enabled)) {
      models.push({ ...model, providerId: config.providerId });
    }
  }
  
  return models.sort((a, b) => a.priority - b.priority);
}

/**
 * Get models by capability
 */
export function getModelsByCapability(capability: ModelCapability): Array<ProductionModelConfig & { providerId: ProviderId }> {
  return getAllAvailableModels().filter(model => 
    model.capabilities.includes(capability)
  );
}

/**
 * Get models by tag
 */
export function getModelsByTag(tag: string): Array<ProductionModelConfig & { providerId: ProviderId }> {
  return getAllAvailableModels().filter(model => 
    model.tags.includes(tag)
  );
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(config: ProductionProviderConfig): string[] {
  const errors: string[] = [];
  
  if (!config.providerId) {
    errors.push('Provider ID is required');
  }
  
  if (!config.apiConfig.baseUrl) {
    errors.push('Base URL is required');
  }
  
  if (!config.apiConfig.apiKeyEnvVar) {
    errors.push('API key environment variable is required');
  }
  
  if (config.models.length === 0) {
    errors.push('At least one model must be configured');
  }
  
  for (const model of config.models) {
    if (!model.modelId) {
      errors.push(`Model ID is required for model: ${model.displayName}`);
    }
    
    if (model.pricing.inputCostPer1k < 0 || model.pricing.outputCostPer1k < 0) {
      errors.push(`Invalid pricing for model: ${model.modelId}`);
    }
  }
  
  return errors;
}