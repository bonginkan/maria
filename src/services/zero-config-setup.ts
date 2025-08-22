/**
 * Zero-Configuration Setup System for MARIA CODE
 * Automatically detects and configures AI providers with minimal user intervention
 */
// @ts-nocheck - Complex type interactions requiring gradual type migration

import { exec, execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface SetupWizardConfig {
  language: 'en' | 'ja';
  llmPreferences: {
    preferLocal: boolean;
    downloadModels: boolean;
    providers: string[];
  };
  apiKeys: Record<string, string>;
  modelDefaults: Record<string, string>;
}

export interface ProviderStatus {
  name: string;
  type: 'local' | 'cloud';
  available: boolean;
  configured: boolean;
  models?: string[];
  endpoint?: string;
}

export class ZeroConfigSetup {
  private configPath: string;
  private logBuffer: string[] = [];

  constructor() {
    this.configPath = join(homedir(), '.maria', 'config.json');
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logBuffer.push(logMessage);
    console.log(message);
  }

  async run(): Promise<SetupWizardConfig> {
    this.log('🚀 MARIA Zero-Configuration Setup');
    this.log('==================================');

    // 1. Language detection (default to system locale)
    const language = await this.detectLanguage();
    this.log(`🌍 Language: ${language === 'ja' ? '日本語' : 'English'}`);

    // 2. Auto-detect available providers
    const providers = await this.detectProviders();
    this.log(`🔍 Detected ${providers.length} available providers`);

    // 3. Configure providers automatically
    const llmPreferences = await this.configureLLMPreferences(providers);

    // 4. Test connections
    const connectionResults = await this.testConnections(providers);
    this.log(`✅ ${connectionResults.successful} providers configured successfully`);

    // 5. Save configuration
    const config: SetupWizardConfig = {
      language,
      llmPreferences,
      apiKeys: this.getApiKeysFromEnv(),
      modelDefaults: this.getDefaultModels(providers),
    };

    await this.saveConfiguration(config);
    this.log('💾 Configuration saved');

    return config;
  }

  private async detectLanguage(): Promise<'en' | 'ja'> {
    try {
      // Check system locale
      const locale = process.env['LANG'] || process.env['LC_ALL'] || 'en_US';
      if (locale.includes('ja') || locale.includes('JP')) {
        return 'ja';
      }

      // Check if running on Japanese system
      if (process.platform === 'darwin') {
        try {
          const osLocale = execSync('defaults read -g AppleLocale', { encoding: 'utf8' }).trim();
          if (osLocale.includes('ja')) {
            return 'ja';
          }
        } catch {
          // Ignore errors
        }
      }
    } catch {
      this.log(`⚠️ Language detection failed`);
    }

    return 'en';
  }

  async detectProviders(): Promise<ProviderStatus[]> {
    const providers: ProviderStatus[] = [];

    // Local providers
    providers.push(...(await this.detectLocalProviders()));

    // Cloud providers
    providers.push(...(await this.detectCloudProviders()));

    return providers;
  }

  private async detectLocalProviders(): Promise<ProviderStatus[]> {
    const providers: ProviderStatus[] = [];

    // LM Studio
    const lmStudio = await this.checkLMStudio();
    providers.push(lmStudio);

    // vLLM
    const vllm = await this.checkVLLM();
    providers.push(vllm);

    // Ollama
    const ollama = await this.checkOllama();
    providers.push(ollama);

    return providers;
  }

  private async checkLMStudio(): Promise<ProviderStatus> {
    try {
      // Check if port 1234 is in use
      const isRunning = await this.checkPort(1234);

      if (isRunning) {
        // Test API
        const response = await this.testAPI('http://localhost:1234/v1/models');
        if (response.success) {
          return {
            name: 'lmstudio',
            type: 'local',
            available: true,
            configured: true,
            models: response.data?.data?.map((m: unknown) => m.id) || [],
            endpoint: 'http://localhost:1234/v1',
          };
        }
      }

      // Check if LM Studio app exists (macOS)
      if (process.platform === 'darwin') {
        try {
          await fs.access('/Applications/LM Studio.app');
          return {
            name: 'lmstudio',
            type: 'local',
            available: true,
            configured: false,
            endpoint: 'http://localhost:1234/v1',
          };
        } catch {
          // App not installed
        }
      }

      return {
        name: 'lmstudio',
        type: 'local',
        available: false,
        configured: false,
      };
    } catch {
      this.log(`⚠️ LM Studio detection failed`);
      return {
        name: 'lmstudio',
        type: 'local',
        available: false,
        configured: false,
      };
    }
  }

  private async checkVLLM(): Promise<ProviderStatus> {
    try {
      // Check if vllm is installed
      const isInstalled = await this.checkCommand('python', ['-c', 'import vllm']);

      if (isInstalled) {
        // Check if running
        const isRunning = await this.checkPort(8000);

        if (isRunning) {
          const response = await this.testAPI('http://localhost:8000/v1/models');
          if (response.success) {
            return {
              name: 'vllm',
              type: 'local',
              available: true,
              configured: true,
              models: response.data?.data?.map((m: unknown) => m.id) || [],
              endpoint: 'http://localhost:8000/v1',
            };
          }
        }

        return {
          name: 'vllm',
          type: 'local',
          available: true,
          configured: false,
          endpoint: 'http://localhost:8000/v1',
        };
      }

      return {
        name: 'vllm',
        type: 'local',
        available: false,
        configured: false,
      };
    } catch {
      return {
        name: 'vllm',
        type: 'local',
        available: false,
        configured: false,
      };
    }
  }

  private async checkOllama(): Promise<ProviderStatus> {
    try {
      // Check if ollama command exists
      const isInstalled = await this.checkCommand('ollama', ['--version']);

      if (isInstalled) {
        // Check if running
        const isRunning = await this.checkPort(11434);

        if (isRunning) {
          const response = await this.testAPI('http://localhost:11434/api/tags');
          if (response.success) {
            return {
              name: 'ollama',
              type: 'local',
              available: true,
              configured: true,
              models: response.data?.models?.map((m: unknown) => m.name) || [],
              endpoint: 'http://localhost:11434/api',
            };
          }
        }

        return {
          name: 'ollama',
          type: 'local',
          available: true,
          configured: false,
          endpoint: 'http://localhost:11434/api',
        };
      }

      return {
        name: 'ollama',
        type: 'local',
        available: false,
        configured: false,
      };
    } catch {
      return {
        name: 'ollama',
        type: 'local',
        available: false,
        configured: false,
      };
    }
  }

  private async detectCloudProviders(): Promise<ProviderStatus[]> {
    const providers: ProviderStatus[] = [];

    // Check environment variables for API keys
    const apiKeys = this.getApiKeysFromEnv();

    providers.push({
      name: 'openai',
      type: 'cloud',
      available: !!apiKeys.OPENAI_API_KEY,
      configured: !!apiKeys.OPENAI_API_KEY,
    });

    providers.push({
      name: 'anthropic',
      type: 'cloud',
      available: !!apiKeys.ANTHROPIC_API_KEY,
      configured: !!apiKeys.ANTHROPIC_API_KEY,
    });

    providers.push({
      name: 'googleai',
      type: 'cloud',
      available: !!(apiKeys.GOOGLE_AI_API_KEY || apiKeys.GEMINI_API_KEY),
      configured: !!(apiKeys.GOOGLE_AI_API_KEY || apiKeys.GEMINI_API_KEY),
    });

    providers.push({
      name: 'grok',
      type: 'cloud',
      available: !!apiKeys.GROK_API_KEY,
      configured: !!apiKeys.GROK_API_KEY,
    });

    return providers;
  }

  private async configureLLMPreferences(
    providers: ProviderStatus[],
  ): Promise<SetupWizardConfig['llmPreferences']> {
    const localProviders = providers.filter((p) => p.type === 'local' && p.available);
    const cloudProviders = providers.filter((p) => p.type === 'cloud' && p.configured);

    const preferences = {
      preferLocal: localProviders.length > 0,
      downloadModels: localProviders.length > 0 && localProviders.some((p) => !p.configured),
      providers: [...localProviders.map((p) => p.name), ...cloudProviders.map((p) => p.name)],
    };

    this.log(
      `🎯 Preferences: Local=${preferences.preferLocal}, Providers=${preferences.providers.length}`,
    );

    return preferences;
  }

  private async testConnections(
    providers: ProviderStatus[],
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    for (const provider of providers.filter((p) => p.configured)) {
      try {
        if (provider.type === 'local' && provider.endpoint) {
          const result = await this.testAPI(
            provider.endpoint + (provider.name === 'ollama' ? '/tags' : '/models'),
          );
          if (result.success) {
            this.log(`✅ ${provider.name}: Connected`);
            successful++;
          } else {
            this.log(`❌ ${provider.name}: Failed to connect`);
            failed++;
          }
        } else if (provider.type === 'cloud') {
          // For cloud providers, we just check if API key exists
          this.log(`✅ ${provider.name}: API key configured`);
          successful++;
        }
      } catch {
        this.log(`❌ ${provider.name}: Connection failed`);
        failed++;
      }
    }

    return { successful, failed };
  }

  private getApiKeysFromEnv(): Record<string, string> {
    const keys: Record<string, string> = {};

    const envKeys = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GOOGLE_AI_API_KEY',
      'GEMINI_API_KEY',
      'GROK_API_KEY',
    ];

    for (const key of envKeys) {
      if (process.env[key]) {
        keys[key] = process.env[key]!;
      }
    }

    return keys;
  }

  private getDefaultModels(providers: ProviderStatus[]): Record<string, string> {
    const defaults: Record<string, string> = {
      openai: 'gpt-4o',
      anthropic: 'claude-3-opus-20240229',
      googleai: 'gemini-1.5-pro',
      grok: 'grok-beta',
      lmstudio: 'gpt-oss-20b',
      vllm: 'stabilityai/japanese-stablelm-instruct-alpha-7b-v2',
      ollama: 'llama3.2:3b',
    };

    // Override with detected models if available
    for (const provider of providers) {
      if (provider.models && provider.models.length > 0 && provider.models[0]) {
        defaults[provider.name] = provider.models[0];
      }
    }

    return defaults;
  }

  private async saveConfiguration(config: SetupWizardConfig): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(join(homedir(), '.maria'), { recursive: true });

      // Save config
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));

      // Save logs
      const logPath = join(homedir(), '.maria', 'setup.log');
      await fs.writeFile(logPath, this.logBuffer.join('\n'));
    } catch (error: unknown) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  // Helper methods
  private async checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const command =
        process.platform === 'win32'
          ? `netstat -an | findstr :${port}`
          : `lsof -Pi :${port} -sTCP:LISTEN -t`;

      exec(command, (error, stdout) => {
        resolve(!error && stdout.trim().length > 0);
      });
    });
  }

  private async checkCommand(command: string, args: string[] = []): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { stdio: 'ignore' });
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  }

  private async testAPI(url: string): Promise<{ success: boolean; data?: unknown }> {
    try {
      // Use fetch if available, otherwise use a simple HTTP check
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }

      return { success: false };
    } catch {
      return { success: false };
    }
  }

  async getExistingConfig(): Promise<SetupWizardConfig | null> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(configData) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async shouldRunSetup(): Promise<boolean> {
    const existingConfig = await this.getExistingConfig();
    return !existingConfig;
  }
}
