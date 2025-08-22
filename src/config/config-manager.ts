/**
 * Configuration Manager
 * Manages MARIA configuration settings
 */

import { Config, PriorityMode } from '../types';
import { MariaAIConfig } from '../maria-ai';

export class ConfigManager {
  private config: Partial<Config>;

  constructor(initialConfig: MariaAIConfig = {}) {
    this.config = this.loadDefaultConfig();
    this.mergeConfig(initialConfig);
  }

  private loadDefaultConfig(): Partial<Config> {
    return {
      priority: 'privacy-first',
      providers: {},
      autoStart: true,
      healthMonitoring: true,
      language: 'auto',
      offlineMode: false,
      model: 'gpt-5-mini',
      provider: 'openai',
    };
  }

  private mergeConfig(newConfig: MariaAIConfig): void {
    if (newConfig.priority) {
      this.config['priority'] = newConfig.priority;
    }

    if (newConfig.apiKeys) {
      // Store API keys for provider initialization
      this.set('apiKeys', newConfig.apiKeys);
    }

    if (newConfig.localProviders) {
      this.set('localProviders', newConfig.localProviders);
    }

    if (newConfig.autoStart !== undefined) {
      this.config['autoStart'] = newConfig.autoStart;
    }

    if (newConfig.healthMonitoring !== undefined) {
      this.config['healthMonitoring'] = newConfig.healthMonitoring;
    }

    if (newConfig.enabledProviders) {
      this.set('enabledProviders', newConfig.enabledProviders);
    }
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    const value = (this.config as Record<string, unknown>)[key] as T;
    return value !== undefined ? value : defaultValue;
  }

  set(key: string, value: unknown): void {
    (this.config as Record<string, unknown>)[key] = value;
  }

  getAll(): Partial<Config> {
    return { ...this.config };
  }

  // Load configuration from environment variables
  static fromEnvironment(): ConfigManager {
    const config: MariaAIConfig = {
      priority: (process.env['MARIA_PRIORITY'] as PriorityMode) || 'privacy-first',
      apiKeys: {
        OPENAI_API_KEY: process.env['OPENAI_API_KEY'] || '',
        ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] || '',
        GOOGLE_API_KEY: process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY'] || '',
        GROQ_API_KEY: process.env['GROQ_API_KEY'] || '',
        GROK_API_KEY: process.env['GROK_API_KEY'] || '',
      },
      localProviders: {
        lmstudio: process.env['LMSTUDIO_ENABLED'] !== 'false',
        ollama: process.env['OLLAMA_ENABLED'] !== 'false',
        vllm: process.env['VLLM_ENABLED'] !== 'false',
      },
      autoStart: process.env['AUTO_START_LLMS'] !== 'false',
      healthMonitoring: process.env['HEALTH_MONITORING'] !== 'false',
    };

    return new ConfigManager(config);
  }

  // Save configuration to file (for CLI usage)
  async save(configPath?: string): Promise<void> {
    const { importNodeBuiltin, safeDynamicImport } = await import('../utils/import-helper.js');
    const fs = (await safeDynamicImport('fs-extra').catch(() =>
      importNodeBuiltin('fs'),
    )) as typeof import('fs-extra');
    const path = (await importNodeBuiltin('path')) as typeof import('path');
    const os = (await importNodeBuiltin('os')) as typeof import('os');

    const targetPath = configPath || path.join(os.homedir(), '.maria', 'config.json');

    // Ensure directory exists
    await fs.ensureDir(path.dirname(targetPath));

    // Save configuration
    await fs.writeJson(targetPath, this.config, { spaces: 2 });
  }

  // Load configuration from file
  static async load(configPath?: string): Promise<ConfigManager> {
    const { importNodeBuiltin, safeDynamicImport } = await import('../utils/import-helper.js');
    const fs = (await safeDynamicImport('fs-extra').catch(() =>
      importNodeBuiltin('fs'),
    )) as typeof import('fs-extra');
    const path = (await importNodeBuiltin('path')) as typeof import('path');
    const os = (await importNodeBuiltin('os')) as typeof import('os');

    const targetPath = configPath || path.join(os.homedir(), '.maria', 'config.json');

    if (await fs.pathExists(targetPath)) {
      try {
        const savedConfig = await fs.readJson(targetPath);
        return new ConfigManager(savedConfig);
      } catch (error: unknown) {
        console.warn('Failed to load config file, using defaults:', error);
      }
    }

    // Fallback to environment-based config
    return ConfigManager.fromEnvironment();
  }
}
