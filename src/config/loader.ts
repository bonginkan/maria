/**
 * Configuration Loader
 * Loads configuration from various sources
 */

import { ConfigManager } from './config-manager';
import { MariaAIConfig } from '../maria-ai';
import { CLIOptions } from '../cli';

export async function loadConfig(options: CLIOptions = {}): Promise<MariaAIConfig> {
  // Load environment variables first
  await loadEnvironmentConfig();

  // Start with saved configuration
  const configManager = await ConfigManager.load(options.config);
  const baseConfig = configManager.getAll();

  // Override with CLI options
  const config: MariaAIConfig = {
    priority: options.priority || baseConfig.priority,
    autoStart: !options.offline, // Disable auto-start in offline mode
    healthMonitoring: baseConfig.healthMonitoring,
  };

  // Load API keys from environment
  config['apiKeys'] = {
    OPENAI_API_KEY: process.env['OPENAI_API_KEY'] || '',
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] || '',
    GOOGLE_API_KEY: process.env['GOOGLE_AI_API_KEY'] || process.env['GEMINI_API_KEY'] || '',
    GEMINI_API_KEY: process.env['GEMINI_API_KEY'] || '',
    GROQ_API_KEY: process.env['GROQ_API_KEY'] || '',
    GROK_API_KEY: process.env['GROK_API_KEY'] || '',
  };

  // Local provider settings
  config['localProviders'] = {
    lmstudio: process.env['LMSTUDIO_ENABLED'] !== 'false' && !options.offline,
    ollama: process.env['OLLAMA_ENABLED'] !== 'false' && !options.offline,
    vllm: process.env['VLLM_ENABLED'] !== 'false' && !options.offline,
  };

  // Handle offline mode
  if (options.offline) {
    // Only enable local providers in offline mode
    config['apiKeys'] = {};
    config['localProviders'] = {
      lmstudio: true,
      ollama: true,
      vllm: true,
    };
  }

  // Handle provider/model overrides
  if (options.provider) {
    config['enabledProviders'] = [options.provider];
  }

  return config;
}

export async function loadEnvironmentConfig(): Promise<void> {
  // Try to load .env file if available
  try {
    const { importNodeBuiltin, safeDynamicImport } = await import('../utils/import-helper.js');
    const fs = await safeDynamicImport('fs-extra').catch(() => importNodeBuiltin('fs'));
    const path = await importNodeBuiltin('path');

    const envPath = path.join(process.cwd(), '.env.local');
    if (await fs.pathExists(envPath)) {
      const envContent = await fs.readFile(envPath, 'utf-8');

      // Debug: Log that we're loading env file
      if (process.env['DEBUG']) {
        console.log('Loading environment from:', envPath);
      }

      // Simple env parsing (no external dependency)
      const lines = envContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const equalIndex = trimmed.indexOf('=');
          if (equalIndex > 0) {
            const key = trimmed.substring(0, equalIndex).trim();
            const value = trimmed.substring(equalIndex + 1).trim();
            if (key && value && !process.env[key]) {
              // Remove quotes if present
              const cleanValue = value.replace(/^["']|["']$/g, '');
              process.env[key] = cleanValue;
            }
          }
        }
      }
    }
  } catch (error: unknown) {
    // Ignore errors, environment loading is optional
  }
}
