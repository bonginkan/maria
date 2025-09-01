import chalk from "chalk";
import { ConfigManager } from "../config/config-manager";
import { getProviderManager } from "../providers";

interface ProviderOption {
  name: string;
  value: string;
  type: "cloud" | "local";
  available: boolean;
  models?: string[];
}

export class ProviderSelector {
  private config: ConfigManager;
  private providerManager: ReturnType<typeof getProviderManager>;

  constructor(_config: ConfigManager) {
    this.config = _config;
    this.providerManager = getProviderManager();
  }

  async initialize(): Promise<void> {
    // V2.0 unified system only
    await this.providerManager.initialize();
  }

  async selectProvider(): Promise<{ provider: string; model: string }> {
    // Dynamic import for inquirer to handle bundling issues
    const inquirer = await import("inquirer");
    const prompt = inquirer.default?.prompt || inquirer.prompt;
    const providers = await this.getAvailableProviders();

    console.log(chalk.cyan("\nAvailable AI Providers:"));
    console.log(chalk.gray("─".repeat(50)));

    const _cloudProviders = providers.filter((p) => p.type === "cloud");
    const _localProviders = providers.filter((p) => p.type === "local");

    if (_cloudProviders.length > 0) {
      console.log(chalk.yellow("\n☁️  Cloud AI:"));
      _cloudProviders.forEach((p) => {
        if (p.available) {
          console.log(
            `   ${chalk.green("*")} ${chalk.white(p.name.split(" ")[0])}`,
          );
        } else {
          console.log(`     ${chalk.gray(p.name.split(" ")[0])}`);
        }
      });
    }

    if (_localProviders.length > 0) {
      console.log(chalk.cyan("\n💻 Local AI:"));
      _localProviders.forEach((p) => {
        if (p.available) {
          console.log(`   ${chalk.green("*")} ${chalk.white(p.name)}`);
        } else {
          console.log(`   ${chalk.green("*")} ${chalk.gray(p.name)}`);
        }
      });
    }

    // Include both available cloud providers and all local providers in choices
    const selectableProviders = providers.filter((p) => {
      // Include available cloud providers
      if (p.type === "cloud" && p.available) {
        return true;
      }
      // Always include local providers (even if not running)
      if (p.type === "local") {
        return true;
      }
      return false;
    });

    if (selectableProviders.length === 0) {
      console.log(
        chalk.yellow("\n⚠️  No AI providers are currently available."),
      );
      console.log(chalk.gray("\nTo use MARIA, you need to:"));
      console.log(
        chalk.gray(
          "1. Set up API keys for cloud providers (OpenAI, Anthropic, Google, etc.)",
        ),
      );
      console.log(chalk.gray("   Example: export OPENAI_API_KEY=your_api_key"));
      console.log(
        chalk.gray("2. Or start a local AI service (Ollama, LM Studio, vLLM)"),
      );
      console.log(chalk.gray("   Example: maria setup-ollama"));
      console.log(chalk.gray("\nFor more information, run: maria --help"));
      process.exit(1);
    }

    const choices = selectableProviders.map((p) => ({
      name: p.name.split(" ")[0], // Only show provider name without description
      value: p.value,
      short: p.name.split(" ")[0],
    }));

    const { selectedProvider } = await prompt([
      {
        type: "list",
        name: "selectedProvider",
        message: "Select AI provider:",
        choices: choices,
        pageSize: 10,
      },
    ]);

    const provider = providers.find((p) => p.value === selectedProvider);

    // Check if local provider was selected but not running
    if (provider && provider.type === "local" && !provider.available) {
      console.log(
        chalk.yellow(`\n⚠️  ${provider.name} is not currently running.`),
      );
      console.log(chalk.gray(`\nTo use ${provider.name}, you need to:`));

      if (selectedProvider === "ollama") {
        console.log(chalk.gray("1. Install Ollama: brew install ollama"));
        console.log(chalk.gray("2. Start Ollama: ollama serve"));
        console.log(chalk.gray("3. Pull a model: ollama pull llama3.2:3b"));
        console.log(
          chalk.gray("\nOr use the setup command: maria setup-ollama"),
        );
      } else if (selectedProvider === "lmstudio") {
        console.log(
          chalk.gray("1. Download LM Studio from https://lmstudio.ai"),
        );
        console.log(chalk.gray("2. Start LM Studio application"));
        console.log(chalk.gray("3. Load a model in LM Studio"));
        console.log(chalk.gray("4. Start the local server in LM Studio"));
      } else if (selectedProvider === "vllm") {
        console.log(chalk.gray("1. Install vLLM: pip install vllm"));
        console.log(chalk.gray("2. Start vLLM server with a model"));
        console.log(chalk.gray("\nOr use the setup command: maria setup-vllm"));
      }

      process.exit(1);
    }

    if (!provider || !provider.models || provider.models.length === 0) {
      return { provider: selectedProvider, model: "gpt-5-mini-2025-08-07" };
    }

    const modelChoices = provider.models.map((m) => ({
      name: m,
      value: m,
      short: m,
    }));

    const { selectedModel } = await prompt([
      {
        type: "list",
        name: "selectedModel",
        message: `Select model for ${provider.name.split(" ")[0]}:`,
        choices: modelChoices,
        pageSize: 10,
      },
    ]);

    return { provider: selectedProvider, model: selectedModel };
  }

  private async getAvailableProviders(): Promise<ProviderOption[]> {
    const providers: ProviderOption[] = [];
    const apiKeys =
      this.config.get("apiKeys", {} as Record<string, string>) || {};

    // Cloud AI Providers
    const _cloudProviders = [
      {
        name: "OpenAI (GPT-4o, GPT-5)",
        value: "openai",
        type: "cloud" as const,
        available: !!apiKeys["OPENAI_API_KEY"],
        models: [
          "gpt-5-mini",
          "gpt-5",
          "gpt-4o",
          "gpt-4o-mini",
          "o1-preview",
          "o1-mini",
        ],
      },
      {
        name: "Anthropic (Claude)",
        value: "anthropic",
        type: "cloud" as const,
        available: !!apiKeys["ANTHROPIC_API_KEY"],
        models: [
          "claude-4.1",
          "claude-3-5-sonnet-20241022",
          "claude-3-5-haiku-20241022",
          "claude-3-opus-20240229",
        ],
      },
      {
        name: "Google (Gemini)",
        value: "google",
        type: "cloud" as const,
        available: !!apiKeys["GOOGLE_API_KEY"] || !!apiKeys["GEMINI_API_KEY"],
        models: [
          "gemini-2.5-pro",
          "gemini-2.5-flash",
          "gemini-1.5-pro",
          "gemini-1.5-flash",
        ],
      },
      {
        name: "Groq (Mixtral, LLaMA)",
        value: "groq",
        type: "cloud" as const,
        available: !!apiKeys["GROQ_API_KEY"],
        models: [
          "mixtral-8x7b-32768",
          "llama-3.3-70b-versatile",
          "llama-3.1-8b-instant",
        ],
      },
      {
        name: "xAI (Grok)",
        value: "grok",
        type: "cloud" as const,
        available: !!apiKeys["GROK_API_KEY"],
        models: ["grok-4", "grok-beta", "grok-2"],
      },
    ];

    // Local AI Providers
    const _localProviders = [
      {
        name: "Ollama",
        value: "ollama",
        type: "local" as const,
        available: await this.checkLocalProvider("ollama"),
        models: await this.getOllamaModels(),
      },
      {
        name: "LM Studio",
        value: "lmstudio",
        type: "local" as const,
        available: await this.checkLocalProvider("lmstudio"),
        models: await this.getLMStudioModels(),
      },
      {
        name: "vLLM",
        value: "vllm",
        type: "local" as const,
        available: await this.checkLocalProvider("vllm"),
        models: await this.getVLLMModels(),
      },
    ];

    providers.push(..._cloudProviders, ..._localProviders);
    return providers;
  }

  private async checkLocalProvider(provider: string): Promise<boolean> {
    try {
      const { LLMHealthChecker } = await import("./llm-health-checker.js");
      const _healthChecker = new LLMHealthChecker();
      const _status = await _healthChecker.checkService(provider);
      return _status.isRunning;
    } catch {
      return false;
    }
  }

  private async getOllamaModels(): Promise<string[]> {
    try {
      const _response = await fetch("http://localhost:11434/api/tags");
      if (_response.ok) {
        const _data = await _response.json();
        return _data.models?.map((_m: unknown) => _m.name) || [];
      }
    } catch {
      // Intentionally empty
    }
    return [
      "llama3.3:latest",
      "qwen2.5:latest",
      "phi4:latest",
      "deepseek-coder-v2:latest",
    ];
  }

  private async getLMStudioModels(): Promise<string[]> {
    try {
      const _response = await fetch("http://localhost:1234/v1/models");
      if (_response.ok) {
        const _data = await _response.json();
        return _data._data?.map((_m: unknown) => _m.id) || [];
      }
    } catch {
      // Intentionally empty
    }
    return ["local-model"];
  }

  private async getVLLMModels(): Promise<string[]> {
    try {
      const _response = await fetch("http://localhost:8000/v1/models");
      if (_response.ok) {
        const _data = await _response.json();
        return _data._data?.map((_m: unknown) => _m.id) || [];
      }
    } catch {
      // Intentionally empty
    }
    return ["vllm-model"];
  }
}
