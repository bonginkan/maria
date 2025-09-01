/**
 * Configuration Loader
 * Loads configuration from various sources with new defaults system
 */

import { ConfigManager } from "./index";
import { MariaAIConfig } from "../maria-ai";
import { CLIOptions } from "../cli";
import { DEFAULT_CONFIG } from "./defaults";
import { DefaultConfiguration } from "./config-types";

/**
 * Load complete configuration with defaults and overrides
 */
export function loadCompleteConfig(
  options: CLIOptions = {},
): DefaultConfiguration {
  // Start with default configuration
  const _config = { ...DEFAULT_CONFIG };

  // Override with environment variables
  if (process.env.OPENAI_API_KEY) {
    _config.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    _config.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.GOOGLE_AI_API_KEY) {
    _config.env.GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
  }

  // Override provider preferences from CLI options
  if (options.provider) {
    _config.provider.provider = options.provider;
  }
  if (options.model) {
    _config.provider.model = options.model;
  }
  if (options.offline) {
    _config.provider.offline = true;
  }

  return _config;
}

export async function loadConfig(
  options: CLIOptions = {},
): Promise<MariaAIConfig> {
  // Load environment variables first
  await loadEnvironmentConfig();

  // Get complete configuration with defaults
  const _completeConfig = loadCompleteConfig(options);

  // Start with saved configuration
  const _configManager = await ConfigManager.load(options._config);
  const _baseConfig = _configManager.getAll();

  // Override with CLI options
  const _config: MariaAIConfig = {
    priority:
      options.priority ||
      _completeConfig.provider.priority ||
      _baseConfig.priority,
    autoStart: !options.offline, // Disable auto-start in offline mode
    healthMonitoring: _baseConfig.healthMonitoring,
  };

  // Load API keys from environment with defaults
  _config["apiKeys"] = {
    OPENAIAPI_KEY: _completeConfig.env.OPENAI_API_KEY || "",
    ANTHROPICAPI_KEY: _completeConfig.env.ANTHROPIC_API_KEY || "",
    GOOGLEAPI_KEY:
      _completeConfig.env.GOOGLE_AI_API_KEY ||
      process.env["GOOGLE_API_KEY"] ||
      process.env["GEMINI_API_KEY"] ||
      "",
    GEMINIAPI_KEY:
      _completeConfig.env.GOOGLE_AI_API_KEY ||
      process.env["GEMINI_API_KEY"] ||
      "",
    GROQAPI_KEY: process.env["GROQ_API_KEY"] || "",
    GROKAPI_KEY:
      process.env["GROK_API_KEY"] || process.env["XAI_API_KEY"] || "",
  };

  // Local provider settings - enable if explicitly set to true in env
  _config["localProviders"] = {
    lmstudio: process.env["LMSTUDIO_ENABLED"] === "true",
    ollama: process.env["OLLAMA_ENABLED"] === "true",
    vllm: process.env["VLLM_ENABLED"] === "true",
  };

  // Handle offline mode
  if (options.offline) {
    // Only enable local providers in offline mode
    _config["apiKeys"] = {};
    _config["localProviders"] = {
      lmstudio: true,
      ollama: true,
      vllm: true,
    };
  }

  // Handle provider/model overrides
  if (options.provider) {
    _config["provider"] = options.provider;
    _config["enabledProviders"] = [options.provider];
  }

  if (options.model) {
    _config["model"] = options.model;
  }

  return _config;
}

let environmentLoaded = false; // Track if environment has been loaded

export async function loadEnvironmentConfig(): Promise<void> {
  // Prevent duplicate loading
  if (environmentLoaded) {
    return;
  }

  // Try to load .env file if available
  try {
    const { importNodeBuiltin, safeDynamicImport } = await import(
      "../utils/import-helper.js"
    );
    const fs = (await safeDynamicImport("fs-extra").catch(() =>
      importNodeBuiltin("fs"),
    )) as typeof import("fs-extra");
    const _path = (await importNodeBuiltin("path")) as typeof import("path");

    const _envPath = _path.join(process.cwd(), ".env.local");
    if (await fs.pathExists(_envPath)) {
      const _envContent = await fs.readFile(_envPath, "utf-8");

      // Log that we're loading env file (only once)
      console.log("Loading environment from:", _envPath);
      environmentLoaded = true;

      // Simple env parsing (no external dependency)
      const _lines = _envContent.split("\n");
      for (const line of _lines) {
        const _trimmed = line.trim();
        if (_trimmed && !_trimmed.startsWith("#")) {
          const _equalIndex = _trimmed.indexOf("=");
          if (_equalIndex > 0) {
            const _key = _trimmed.substring(0, _equalIndex).trim();
            const _value = _trimmed.substring(_equalIndex + 1).trim();
            if (_key && _value && !process.env[_key]) {
              // Remove quotes if present
              const _cleanValue = _value.replace(/^["']|["']$/g, "");
              process.env[_key] = _cleanValue;
            }
          }
        }
      }
    }
  } catch (_error: unknown) {
    // Ignore errors, environment loading is optional
  }
}
