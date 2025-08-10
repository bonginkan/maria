/**
 * Configuration Loader
 * Loads configuration from various sources
 */

import { ConfigManager } from './config-manager';
import { MariaAIConfig } from '../maria-ai';
import { CLIOptions } from '../cli';

export async function loadConfig(options: CLIOptions = {}): Promise<MariaAIConfig> {
  // Start with saved configuration
  const configManager = await ConfigManager.load(options.config);
  const baseConfig = configManager.getAll();

  // Override with CLI options
  const config: MariaAIConfig = {
    priority: options.priority || baseConfig.priority,
    autoStart: !options.offline, // Disable auto-start in offline mode
    healthMonitoring: baseConfig.healthMonitoring
  };

  // Load API keys from environment
  config.apiKeys = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    GROK_API_KEY: process.env.GROK_API_KEY || ''
  };

  // Local provider settings
  config.localProviders = {
    lmstudio: process.env.LMSTUDIO_ENABLED !== 'false' && !options.offline,
    ollama: process.env.OLLAMA_ENABLED !== 'false' && !options.offline,
    vllm: process.env.VLLM_ENABLED !== 'false' && !options.offline
  };

  // Handle offline mode
  if (options.offline) {
    // Only enable local providers in offline mode
    config.apiKeys = {};
    config.localProviders = {
      lmstudio: true,
      ollama: true,
      vllm: true
    };
  }

  // Handle provider/model overrides
  if (options.provider) {
    config.enabledProviders = [options.provider];
  }

  return config;
}

export async function loadEnvironmentConfig(): Promise<void> {
  // Try to load .env file if available
  try {
    const fs = await import('fs-extra');
    const path = await import('path');
    
    const envPath = path.join(process.cwd(), '.env.local');
    if (await fs.pathExists(envPath)) {
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      // Simple env parsing (no external dependency)
      const lines = envContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=');
          if (key && value && !process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors, environment loading is optional
  }
}