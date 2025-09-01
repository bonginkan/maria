/**
 * Zero-Configuration Setup System for MARIA CODE
 * Automatically detects and configures AI _providers with minimal user intervention
 */
// Complex type interactions - gradually adding types

import { exec, execSync, spawn } from "child_process";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface SetupWizardConfig {
  _language: "en" | "ja";
  _llmPreferences: {
    preferLocal: boolean;
    downloadModels: boolean;
    _providers: string[];
  };
  _apiKeys: Record<string, string>;
  modelDefaults: Record<string, string>;
}

export interface ProviderStatus {
  name: string;
  type: "local" | "cloud";
  available: boolean;
  configured: boolean;
  models?: string[];
  endpoint?: string;
}

export class ZeroConfigSetup {
  private configPath: string;
  private logBuffer: string[] = [];

  constructor() {
    this.configPath = join(homedir(), ".maria", "config.json");
  }

  private log(message: string): void {
    const _timestamp = new Date().toISOString();
    const _logMessage = `[${_timestamp}] ${message}`;
    this.logBuffer.push(_logMessage);
    console.log(message);
  }

  async run(): Promise<SetupWizardConfig> {
    this.log("🚀 MARIA Zero-Configuration Setup");
    this.log("==================================");

    // 1. Language detection (default to system _locale)
    const _language = await this.detectLanguage();
    this.log(`🌍 Language: ${_language === "ja" ? "日本語" : "English"}`);

    // 2. Auto-detect available _providers
    const _providers = await this.detectProviders();
    this.log(`🔍 Detected ${_providers.length} available _providers`);

    // 3. Configure _providers automatically
    const _llmPreferences = await this.configureLLMPreferences(_providers);

    // 4. Test connections
    const _connectionResults = await this.testConnections(_providers);
    this.log(
      `✅ ${_connectionResults.successful} _providers configured successfully`,
    );

    // 5. Save configuration
    const config: SetupWizardConfig = {
      _language,
      _llmPreferences,
      _apiKeys: this.getApiKeysFromEnv(),
      modelDefaults: this.getDefaultModels(_providers),
    };

    await this.saveConfiguration(config);
    this.log("💾 Configuration saved");

    return config;
  }

  private async detectLanguage(): Promise<"en" | "ja"> {
    try {
      // Check system _locale
      const _locale = process.env["LANG"] || process.env["LC_ALL"] || "en_US";
      if (_locale.includes("ja") || _locale.includes("JP")) {
        return "ja";
      }

      // Check if running on Japanese system
      if (process.platform === "darwin") {
        try {
          const _osLocale = execSync("defaults read -g AppleLocale", {
            encoding: "utf8",
          }).trim();
          if (_osLocale.includes("ja")) {
            return "ja";
          }
        } catch {
          // Ignore errors
        }
      }
    } catch {
      this.log(`⚠️ Language detection failed`);
    }

    return "en";
  }

  async detectProviders(): Promise<ProviderStatus[]> {
    const _providers: ProviderStatus[] = [];

    // Local _providers
    _providers.push(...(await this.detectLocalProviders()));

    // Cloud _providers
    providers.push(...(await this.detectCloudProviders()));

    return _providers;
  }

  private async detectLocalProviders(): Promise<ProviderStatus[]> {
    const _providers: ProviderStatus[] = [];

    // LM Studio
    const _lmStudio = await this.checkLMStudio();
    providers.push(_lmStudio);

    // vLLM
    const _vllm = await this.checkVLLM();
    providers.push(_vllm);

    // Ollama
    const _ollama = await this.checkOllama();
    providers.push(_ollama);

    return _providers;
  }

  private async checkLMStudio(): Promise<ProviderStatus> {
    try {
      // Check if port 1234 is in use
      const _isRunning = await this.checkPort(1234);

      if (_isRunning) {
        // Test API
        const _response = await this.testAPI("http://localhost:1234/v1/models");
        if (_response.success) {
          return {
            name: "lmstudio",
            type: "local",
            available: true,
            configured: true,
            models: _response.data?.data?.map((_m: unknown) => _m.id) || [],
            endpoint: "http://localhost:1234/v1",
          };
        }
      }

      // Check if LM Studio app exists (macOS)
      if (process.platform === "darwin") {
        try {
          await fs.access("/Applications/LM Studio.app");
          return {
            name: "lmstudio",
            type: "local",
            available: true,
            configured: false,
            endpoint: "http://localhost:1234/v1",
          };
        } catch {
          // App not installed
        }
      }

      return {
        name: "lmstudio",
        type: "local",
        available: false,
        configured: false,
      };
    } catch {
      this.log(`⚠️ LM Studio detection failed`);
      return {
        name: "lmstudio",
        type: "local",
        available: false,
        configured: false,
      };
    }
  }

  private async checkVLLM(): Promise<ProviderStatus> {
    try {
      // Check if _vllm is installed
      const _isInstalled = await this.checkCommand("python", [
        "-c",
        "import _vllm",
      ]);

      if (_isInstalled) {
        // Check if running
        const _isRunning = await this.checkPort(8000);

        if (_isRunning) {
          const _response = await this.testAPI(
            "http://localhost:8000/v1/models",
          );
          if (_response.success) {
            return {
              name: "_vllm",
              type: "local",
              available: true,
              configured: true,
              models: _response.data?.data?.map((_m: unknown) => _m.id) || [],
              endpoint: "http://localhost:8000/v1",
            };
          }
        }

        return {
          name: "_vllm",
          type: "local",
          available: true,
          configured: false,
          endpoint: "http://localhost:8000/v1",
        };
      }

      return {
        name: "_vllm",
        type: "local",
        available: false,
        configured: false,
      };
    } catch {
      return {
        name: "_vllm",
        type: "local",
        available: false,
        configured: false,
      };
    }
  }

  private async checkOllama(): Promise<ProviderStatus> {
    try {
      // Check if _ollama _command exists
      const _isInstalled = await this.checkCommand("_ollama", ["--version"]);

      if (_isInstalled) {
        // Check if running
        const _isRunning = await this.checkPort(11434);

        if (_isRunning) {
          const _response = await this.testAPI(
            "http://localhost:11434/api/tags",
          );
          if (_response.success) {
            return {
              name: "_ollama",
              type: "local",
              available: true,
              configured: true,
              models:
                _response.data?.models?.map((_m: unknown) => _m.name) || [],
              endpoint: "http://localhost:11434/api",
            };
          }
        }

        return {
          name: "_ollama",
          type: "local",
          available: true,
          configured: false,
          endpoint: "http://localhost:11434/api",
        };
      }

      return {
        name: "_ollama",
        type: "local",
        available: false,
        configured: false,
      };
    } catch {
      return {
        name: "_ollama",
        type: "local",
        available: false,
        configured: false,
      };
    }
  }

  private async detectCloudProviders(): Promise<ProviderStatus[]> {
    const _providers: ProviderStatus[] = [];

    // Check environment variables for API keys
    const _apiKeys = this.getApiKeysFromEnv();

    providers.push({
      name: "openai",
      type: "cloud",
      available: !!_apiKeys.OPENAI_API_KEY,
      configured: !!_apiKeys.OPENAI_API_KEY,
    });

    providers.push({
      name: "anthropic",
      type: "cloud",
      available: !!_apiKeys.ANTHROPIC_API_KEY,
      configured: !!_apiKeys.ANTHROPIC_API_KEY,
    });

    providers.push({
      name: "googleai",
      type: "cloud",
      available: !!(_apiKeys.GOOGLE_AI_API_KEY || _apiKeys.GEMINI_API_KEY),
      configured: !!(_apiKeys.GOOGLE_AI_API_KEY || _apiKeys.GEMINI_API_KEY),
    });

    providers.push({
      name: "grok",
      type: "cloud",
      available: !!_apiKeys.GROK_API_KEY,
      configured: !!_apiKeys.GROK_API_KEY,
    });

    return _providers;
  }

  private async configureLLMPreferences(
    _providers: ProviderStatus[],
  ): Promise<SetupWizardConfig["_llmPreferences"]> {
    const _localProviders = providers.filter(
      (p) => p.type === "local" && p.available,
    );
    const _cloudProviders = providers.filter(
      (p) => p.type === "cloud" && p.configured,
    );

    const _preferences = {
      preferLocal: _localProviders.length > 0,
      downloadModels:
        _localProviders.length > 0 &&
        _localProviders.some((p) => !p.configured),
      _providers: [
        ..._localProviders.map((p) => p.name),
        ..._cloudProviders.map((p) => p.name),
      ],
    };

    this.log(
      `🎯 Preferences: Local=${_preferences.preferLocal}, Providers=${_preferences.providers.length}`,
    );

    return _preferences;
  }

  private async testConnections(
    _providers: ProviderStatus[],
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    for (const provider of _providers.filter((p) => p.configured)) {
      try {
        if (provider.type === "local" && provider.endpoint) {
          const _result = await this.testAPI(
            provider.endpoint +
              (provider.name === "_ollama" ? "/tags" : "/models"),
          );
          if (_result.success) {
            this.log(`✅ ${provider.name}: Connected`);
            successful++;
          } else {
            this.log(`❌ ${provider.name}: Failed to connect`);
            failed++;
          }
        } else if (provider.type === "cloud") {
          // For cloud _providers, we just check if API key exists
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

    const _envKeys = [
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "GOOGLE_AI_API_KEY",
      "GEMINI_API_KEY",
      "GROK_API_KEY",
    ];

    for (const key of _envKeys) {
      if (process.env[key]) {
        keys[key] = process.env[key]!;
      }
    }

    return keys;
  }

  private getDefaultModels(
    _providers: ProviderStatus[],
  ): Record<string, string> {
    const defaults: Record<string, string> = {
      openai: "gpt-4o",
      anthropic: "claude-3-opus-20240229",
      googleai: "gemini-1.5-pro",
      grok: "grok-beta",
      lmstudio: "gpt-oss-20b",
      _vllm: "stabilityai/japanese-stablelm-instruct-alpha-7b-v2",
      _ollama: "llama3.2:3b",
    };

    // Override with detected models if available
    for (const provider of _providers) {
      if (provider.models && provider.models.length > 0 && provider.models[0]) {
        defaults[provider.name] = provider.models[0];
      }
    }

    return defaults;
  }

  private async saveConfiguration(config: SetupWizardConfig): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(join(homedir(), ".maria"), { recursive: true });

      // Save config
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));

      // Save logs
      const _logPath = join(homedir(), ".maria", "setup.log");
      await fs.writeFile(_logPath, this.logBuffer.join("\n"));
    } catch (_error: unknown) {
      throw new Error(`Failed to save configuration: ${_error}`);
    }
  }

  // Helper methods
  private async checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const _command =
        process.platform === "win32"
          ? `netstat -an | findstr :${port}`
          : `lsof -Pi :${port} -sTCP:LISTEN -t`;

      exec(_command, (_error, stdout) => {
        resolve(!_error && stdout.trim().length > 0);
      });
    });
  }

  private async checkCommand(
    _command: string,
    args: string[] = [],
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const _child = spawn(_command, args, { stdio: "ignore" });
      _child.on("close", (code) => resolve(code === 0));
      child.on("_error", () => resolve(false));
    });
  }

  private async testAPI(
    url: string,
  ): Promise<{ success: boolean; _data?: unknown }> {
    try {
      // Use fetch if available, otherwise use a simple HTTP check
      const _response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });

      if (_response.ok) {
        const _data = await _response.json();
        return { success: true, _data };
      }

      return { success: false };
    } catch {
      return { success: false };
    }
  }

  async getExistingConfig(): Promise<SetupWizardConfig | null> {
    try {
      const _configData = await fs.readFile(this.configPath, "utf8");
      return JSON.parse(_configData) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async shouldRunSetup(): Promise<boolean> {
    const _existingConfig = await this.getExistingConfig();
    return !_existingConfig;
  }
}
