/**
 * Model Command Handler
 * Manages AI model configuration and selection
 */

import { BaseCommand } from "../../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  ValidationResult,
} from "../../../types";
import { logger } from "../../../../utils/logger";
import { getProviderManager } from "../../../../providers/index";
import { ConfigManager } from "../../../../config/config-manager";
import { ModelSelectorUI } from "../../../../services/model-selector-ui";

// V2 Progressive Enhancement (disabled for now to fix runtime issues)
// import { isModelSelectorV2Enabled } from "../../../../services/model-selector/feature-flags";

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutput?: number;
  costPerToken?: number;
  isLocal: boolean;
  categories: string[];
  languages?: string[];
  description?: string;
  bestFor?: string[];
  limitations?: string[];
  version?: string;
}

interface ModelProvider {
  name: string;
  apiKey?: string;
  endpoint?: string;
  available: boolean;
  models: ModelInfo[];
}

export class ModelCommand extends BaseCommand {
  name = "model";
  category = "configuration" as const;
  description = "Unified AI model management (with v2 enhancements when enabled)";
  aliases = ["m", "models", "llm", "m2"];
  usage = "[list|set|info|test|benchmark|cost|current|recommend|ui|session|stats] [model-id] [options]";

  private providerManager: ReturnType<typeof getProviderManager>;
  private configManager: ConfigManager;
  
  // V2 Progressive Enhancement Properties
  private isV2Enabled: boolean = false;
  private advancedFeatures?: {
    engine?: any;
    registry?: any;
    recommendations?: any;
    ui?: any;
    session?: any;
  };

  examples = [
    // Core V1 functionality
    {
      input: "/model list",
      description: "List all available models",
    },
    {
      input: "/model set claude-3-sonnet",
      description: "Set default model",
    },
    {
      input: "/model info gpt-4",
      description: "Show model information",
    },
    {
      input: "/model test claude-3-haiku",
      description: "Test model connectivity",
    },
    {
      input: "/model list --provider openai",
      description: "List models from specific provider",
    },
    // V2 Enhanced functionality (when enabled)
    {
      input: "/model recommend --task code",
      description: "AI-powered model recommendations (v2)",
    },
    {
      input: "/model ui",
      description: "Interactive model selection UI (v2)",
    },
    {
      input: "/model session",
      description: "Manage model selection sessions (v2)",
    },
    {
      input: "/model stats",
      description: "Performance and usage statistics (v2)",
    },
  ];

  metadata = {
    version: "2.1.0",
    author: "MARIA Team",
    since: "2.0.0",
  };

  constructor() {
    super();
    this.configManager = new ConfigManager();
    this.providerManager = getProviderManager();
    
    // Initialize V2 feature detection asynchronously (don't block constructor)
    this.initializeV2Features().catch(error => {
      logger.warn("V2 features initialization failed:", error);
    });
  }
  
  /**
   * Initialize V2 features if enabled via feature flags (disabled for now)
   */
  private async initializeV2Features(): Promise<void> {
    try {
      // V2 features temporarily disabled to avoid runtime issues
      this.isV2Enabled = false;
      logger.debug("📦 ModelCommand running in V1 compatibility mode (V2 disabled)");
    } catch (error) {
      logger.warn("⚠️ V2 feature initialization failed, falling back to V1", error);
      this.isV2Enabled = false;
    }
  }
  
  /**
   * Dynamically load V2 modules (disabled for now)
   */
  private async loadAdvancedFeatures(): Promise<void> {
    // V2 features disabled to avoid runtime issues
    logger.debug("V2 features disabled, skipping advanced feature loading");
    this.isV2Enabled = false;
    this.advancedFeatures = undefined;
  }

  private readonly providers: Record<string, ModelProvider> = {
    anthropic: {
      name: "Anthropic",
      available: true,
      models: [
        {
          id: "claude-opus-4-1-20250805",
          name: "Claude Opus 4.1",
          provider: "anthropic",
          contextWindow: 200000,
          maxOutput: 32000,
          costPerToken: 0.015,
          isLocal: false,
          categories: ["chat", "code", "reasoning", "creative"],
          description: "Most powerful Claude - Deep reasoning",
          bestFor: ["Complex reasoning", "Math", "Science", "Creative writing"],
        },
        {
          id: "claude-opus-4-20250514",
          name: "Claude Opus 4",
          provider: "anthropic",
          contextWindow: 200000,
          maxOutput: 32000,
          costPerToken: 0.012,
          isLocal: false,
          categories: ["chat", "code", "reasoning", "creative"],
          description: "Advanced reasoning and creativity",
          bestFor: ["Complex tasks", "Research", "Creative projects"],
        },
        {
          id: "claude-sonnet-4-20250514",
          name: "Claude Sonnet 4",
          provider: "anthropic",
          contextWindow: 200000,
          maxOutput: 32000,
          costPerToken: 0.003,
          isLocal: false,
          categories: ["chat", "code", "reasoning"],
          description: "Fast & smart - Best value",
          bestFor: ["Code generation", "Analysis", "General tasks"],
        },
      ],
    },
    openai: {
      name: "OpenAI",
      available: true,
      models: [
        {
          id: "gpt-5",
          name: "GPT-5",
          provider: "openai",
          contextWindow: 512000,
          maxOutput: 64000,
          costPerToken: 0.005,
          isLocal: false,
          categories: ["chat", "code", "reasoning", "vision", "multimodal"],
          description: "Latest GPT-5 - Revolutionary AI model",
          bestFor: ["Complex reasoning", "Advanced coding", "Research", "Creative tasks"],
        },
        {
          id: "gpt-5-mini",
          name: "GPT-5 Mini",
          provider: "openai",
          contextWindow: 256000,
          maxOutput: 32000,
          costPerToken: 0.001,
          isLocal: false,
          categories: ["chat", "code", "reasoning"],
          description: "Cost-effective GPT-5 - Fast and efficient",
          bestFor: ["General tasks", "Quick responses", "Budget-conscious usage"],
        },
        {
          id: "gpt-5-mini-2025-08-07",
          name: "GPT-5 Mini (2025-08-07)",
          provider: "openai",
          contextWindow: 256000,
          maxOutput: 32000,
          costPerToken: 0.002,
          isLocal: false,
          categories: ["chat", "code", "reasoning", "vision"],
          description: "GPT-5 Mini with improved capabilities",
          bestFor: ["Complex tasks", "Code", "Analysis"],
        },
        {
          id: "gpt-4o",
          name: "GPT-4o",
          provider: "openai",
          contextWindow: 128000,
          maxOutput: 16384,
          costPerToken: 0.005,
          isLocal: false,
          categories: ["chat", "code", "vision"],
          description: "Multimodal model",
          bestFor: ["General tasks", "Vision"],
        },
      ],
    },
    google: {
      name: "Google",
      available: true,
      models: [
        {
          id: "gemini-2.5-pro",
          name: "Gemini 2.5 Pro",
          provider: "google",
          contextWindow: 2097152,
          maxOutput: 32000,
          costPerToken: 0.00125,
          isLocal: false,
          categories: ["chat", "reasoning", "vision", "multimodal"],
          description: "Best multimodal - 2M context",
          bestFor: ["Long documents", "Vision", "Analysis"],
        },
        {
          id: "gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          provider: "google",
          contextWindow: 1048576,
          maxOutput: 32000,
          costPerToken: 0.00007,
          isLocal: false,
          categories: ["chat", "code", "vision"],
          description: "20x cheaper than Claude",
          bestFor: ["Fast responses", "Budget tasks"],
        },
        {
          id: "gemini-2.5-flash-image-preview",
          name: "Gemini 2.5 Flash Image Preview",
          provider: "google",
          contextWindow: 1048576,
          maxOutput: 32000,
          costPerToken: 0.00007,
          isLocal: false,
          categories: ["vision", "multimodal", "chat"],
          description: "Optimized for image understanding",
          bestFor: ["Image analysis", "Visual tasks", "Screenshots"],
        },
        {
          id: "gemini-2.5-flash-lite",
          name: "Gemini 2.5 Flash Lite",
          provider: "google",
          contextWindow: 1048576,
          maxOutput: 8192,
          costPerToken: 0.00003,
          isLocal: false,
          categories: ["chat", "code"],
          description: "Ultra-fast lightweight model",
          bestFor: ["Simple tasks", "High-speed responses", "Cost optimization"],
        },
      ],
    },
    xai: {
      name: "xAI",
      available: true,
      models: [
        {
          id: "grok-4",
          name: "Grok 4",
          provider: "xai",
          contextWindow: 131072,
          maxOutput: 32000,
          costPerToken: 0.008,
          isLocal: false,
          categories: ["chat", "reasoning", "code"],
          description: "Truth-seeking AI - 200K GPUs",
          bestFor: ["Reasoning", "Analysis", "Code"],
        },
        {
          id: "grok-3",
          name: "Grok 3",
          provider: "xai",
          contextWindow: 131072,
          maxOutput: 32000,
          costPerToken: 0.005,
          isLocal: false,
          categories: ["chat", "reasoning"],
          description: "Previous generation",
          bestFor: ["General tasks"],
        },
      ],
    },
    ollama: {
      name: "Ollama",
      available: true,
      models: [
        {
          id: "llama3.2",
          name: "Llama 3.2",
          provider: "ollama",
          contextWindow: 128000,
          maxOutput: 8192,
          isLocal: true,
          categories: ["chat", "code", "reasoning"],
          description: "Latest Llama model - Fast and capable",
          bestFor: ["General tasks", "Code", "Conversations"],
        },
        {
          id: "mistral",
          name: "Mistral 7B",
          provider: "ollama",
          contextWindow: 32768,
          maxOutput: 4096,
          isLocal: true,
          categories: ["chat", "code"],
          description: "Efficient 7B model",
          bestFor: ["Fast responses", "Code generation"],
        },
        {
          id: "codellama",
          name: "Code Llama",
          provider: "ollama",
          contextWindow: 16384,
          maxOutput: 4096,
          isLocal: true,
          categories: ["code"],
          description: "Specialized for programming",
          bestFor: ["Code generation", "Code analysis"],
        },
        {
          id: "phi3",
          name: "Phi 3",
          provider: "ollama",
          contextWindow: 128000,
          maxOutput: 4096,
          isLocal: true,
          categories: ["chat", "reasoning"],
          description: "Microsoft's small but powerful model",
          bestFor: ["Reasoning", "Math", "General tasks"],
        },
        {
          id: "gemma2",
          name: "Gemma 2",
          provider: "ollama",
          contextWindow: 8192,
          maxOutput: 2048,
          isLocal: true,
          categories: ["chat"],
          description: "Google's efficient local model",
          bestFor: ["Conversations", "Simple tasks"],
        },
      ],
    },
    lmstudio: {
      name: "LM Studio",
      available: true,
      models: [
        {
          id: "qwen3-30b",
          name: "Qwen3 30B A3B",
          provider: "lmstudio",
          contextWindow: 32000,
          maxOutput: 8192,
          isLocal: true,
          categories: ["chat", "code", "reasoning"],
          description: "Powerful 30B model - Q4_K_M GGUF (17.28 GB)",
          bestFor: ["Complex reasoning", "Code generation", "Advanced tasks"],
        },
        {
          id: "mistral-7b-instruct-v0.3",
          name: "Mistral 7B Instruct v0.3",
          provider: "lmstudio",
          contextWindow: 32768,
          maxOutput: 4096,
          isLocal: true,
          categories: ["chat", "code"],
          description: "Efficient instruction-tuned model - Q4_K_M GGUF (4.07 GB)",
          bestFor: ["Fast responses", "General tasks", "Code assistance"],
        },
        {
          id: "gpt-oss-120b",
          name: "OpenAI's gpt-oss 120B",
          provider: "lmstudio",
          contextWindow: 32000,
          maxOutput: 4096,
          isLocal: true,
          categories: ["chat", "code", "reasoning"],
          description: "Massive 120B model - MXFP4 GGUF (59.03 GB)",
          bestFor: ["Highest quality output", "Complex reasoning", "Research"],
        },
        {
          id: "gpt-oss-20b",
          name: "OpenAI's gpt-oss 20B",
          provider: "lmstudio",
          contextWindow: 32000,
          maxOutput: 4096,
          isLocal: true,
          categories: ["chat", "code"],
          description: "Balanced 20B model - MXFP4 GGUF (11.28 GB)",
          bestFor: ["Quality vs speed balance", "General development", "Chat"],
        },
      ],
    },
    vllm: {
      name: "vLLM",
      available: true,
      models: [
        {
          id: "vllm-model",
          name: "vLLM Model",
          provider: "vllm",
          contextWindow: 32768,
          maxOutput: 8192,
          isLocal: true,
          categories: ["chat", "code"],
          description: "High-performance inference server",
          bestFor: ["High throughput", "Production workloads"],
        },
      ],
    },
  };

  async execute(
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const startTime = Date.now();
      const action = (args.parsed.positional?.[0] as string) || "ui"; // Default to interactive UI

      // Check if V2 advanced features are requested
      if (this.shouldUseAdvanced(action, args)) {
        return await this.executeAdvanced(action, args, context);
      }

      let result: CommandResult;

      switch (action.toLowerCase()) {
        case "list":
        case "ls":
          result = await this.listModels(args);
          break;
        
        case "ui":
        case "interactive":
        case "select":
          result = await this.showInteractiveUI(args);
          break;

        case "set":
          result = await this.setDefaultModel(args);
          break;

        case "info":
        case "show":
          result = await this.showModelInfo(args);
          break;

        case "test":
          result = await this.testModel(args);
          break;

        case "benchmark":
          result = await this.benchmarkModels(args);
          break;

        case "cost":
          result = await this.analyzeCosts(args);
          break;

        case "current":
        case "status":
          result = await this.showCurrentModel(args);
          break;

        case "providers":
          result = await this.listProviders(args);
          break;

        case "help":
          result = this.success(this.formatHelp());
          break;

        default:
          // If no action provided, show interactive UI
          if (action === "current" && !args.parsed.positional?.[0]) {
            result = await this.showInteractiveUI(args);
          } else {
            result = this.error(
              `Unknown model action: ${action}. Use: list, set, info, test, benchmark, cost, current, providers, ui${
                this.isV2Enabled ? ', recommend, session, stats' : ''
              }`,
            );
          }
      }

      result.metadata = {
        ...result.metadata,
        executionTime: Date.now() - startTime,
      };

      this.logExecution(args, context, result);
      return result;
    } catch (error) {
      logger.error("Model command execution failed:", error);
      return this.error(
        `Model command failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "MODEL_ERROR",
        error,
      );
    }
  }

  // ========================================
  // V2 Progressive Enhancement Methods
  // ========================================

  /**
   * Determine if advanced V2 features should be used
   */
  private shouldUseAdvanced(action: string, args: CommandArgs): boolean {
    if (!this.isV2Enabled) return false;
    
    // V2-specific actions
    const v2Actions = ['recommend', 'ui', 'session', 'stats'];
    if (v2Actions.includes(action.toLowerCase())) return true;
    
    // V2 flag explicitly requested
    if (args.flags.v2 || args.flags['use-v2']) return true;
    
    return false;
  }

  /**
   * Execute advanced V2 features
   */
  private async executeAdvanced(
    action: string,
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    if (!this.advancedFeatures) {
      return this.error(
        "V2 features are enabled but not available. Please check your installation.",
        "V2_UNAVAILABLE"
      );
    }

    try {
      switch (action.toLowerCase()) {
        case 'recommend':
          return await this.executeRecommendations(args, context);
        case 'ui':
          return await this.executeInteractiveUI(args, context);
        case 'session':
          return await this.executeSessionManagement(args, context);
        case 'stats':
          return await this.executeStatistics(args, context);
        default:
          return this.error(`Unknown V2 action: ${action}`);
      }
    } catch (error) {
      logger.error("V2 feature execution failed:", error);
      return this.error(
        `V2 feature failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "V2_EXECUTION_ERROR",
        error
      );
    }
  }

  /**
   * Execute AI-powered model recommendations
   */
  private async executeRecommendations(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    if (!this.advancedFeatures?.recommendations) {
      return this.error("Recommendation engine not available");
    }

    const task = args.flags.task as string || args.parsed.positional?.[1] as string;
    const requirements = {
      task: task || 'general',
      budget: args.flags.budget as number,
      latency: args.flags.latency as string,
      privacy: args.flags.privacy as boolean,
    };

    try {
      const recommendations = await this.advancedFeatures.recommendations.getRecommendations(requirements);
      
      return this.success({
        message: "🤖 AI-Powered Model Recommendations",
        data: {
          recommendations,
          criteria: requirements,
          generated: new Date().toISOString()
        }
      });
    } catch (error) {
      return this.error("Failed to generate recommendations", "RECOMMENDATION_ERROR", error);
    }
  }

  /**
   * Execute interactive UI mode
   */
  private async executeInteractiveUI(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    if (!this.advancedFeatures?.ui) {
      return this.error("Interactive UI not available");
    }

    try {
      await this.advancedFeatures.ui.start({
        mode: args.flags.mode as string || 'selection',
        theme: args.flags.theme as string || 'default'
      });
      
      return this.success({
        message: "🎨 Interactive model selection UI launched",
        data: { status: 'active', mode: 'interactive' }
      });
    } catch (error) {
      return this.error("Failed to launch interactive UI", "UI_ERROR", error);
    }
  }

  /**
   * Execute session management
   */
  private async executeSessionManagement(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    if (!this.advancedFeatures?.session) {
      return this.error("Session management not available");
    }

    const subAction = args.parsed.positional?.[1] as string || 'status';
    
    try {
      switch (subAction.toLowerCase()) {
        case 'status':
          const status = await this.advancedFeatures.session.getStatus();
          return this.success({
            message: "📊 Session Status",
            data: status
          });
        case 'history':
          const history = await this.advancedFeatures.session.getHistory();
          return this.success({
            message: "📜 Selection History", 
            data: history
          });
        case 'clear':
          await this.advancedFeatures.session.clear();
          return this.success({ message: "🗑️ Session cleared" });
        default:
          return this.error(`Unknown session action: ${subAction}`);
      }
    } catch (error) {
      return this.error("Session management failed", "SESSION_ERROR", error);
    }
  }

  /**
   * Execute performance statistics
   */
  private async executeStatistics(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    if (!this.advancedFeatures?.engine) {
      return this.error("Statistics engine not available");
    }

    try {
      const stats = await this.advancedFeatures.engine.getPerformanceStats();
      
      return this.success({
        message: "📈 Model Performance Statistics",
        data: {
          stats,
          timestamp: new Date().toISOString(),
          v2Features: true
        }
      });
    } catch (error) {
      return this.error("Failed to retrieve statistics", "STATS_ERROR", error);
    }
  }

  async validate(args: CommandArgs): Promise<ValidationResult> {
    const action = args.parsed.positional?.[0] as string;

    if (!action) {
      return { success: true }; // Default to current action
    }

    const validActions = [
      "list",
      "set",
      "info",
      "test",
      "benchmark",
      "cost",
      "current",
      "providers",
      "help",
    ];
    if (!validActions.includes(action.toLowerCase())) {
      return {
        success: false,
        error: `Invalid action: ${action}`,
        suggestions: validActions,
      };
    }

    // Validate specific action requirements
    if (
      (action === "set" || action === "info" || action === "test") &&
      !args.parsed.positional?.[1]
    ) {
      return {
        success: false,
        error: `Model ID required for ${action} action`,
        suggestions: ["Specify a model ID"],
      };
    }

    return { success: true };
  }

  private async listModels(args: CommandArgs): Promise<CommandResult> {
    const providerFilter = args.options.provider as string;
    const categoryFilter = args.options.category as string;
    const localOnly = args.flags.local;
    const cloudOnly = args.flags.cloud;

    // Get actual models from provider manager
    await this.providerManager.initialize();
    
    // Use the mock data from providers property for now
    // TODO: Replace with actual provider data when available
    const availableModels = await this.getAllModels();

    let models = availableModels;

    // Apply filters
    if (providerFilter) {
      models = models.filter(
        (m) => m.provider.toLowerCase() === providerFilter.toLowerCase(),
      );
    }

    if (categoryFilter) {
      models = models.filter((m) =>
        m.categories.includes(categoryFilter.toLowerCase()),
      );
    }

    if (localOnly && !cloudOnly) {
      models = models.filter((m) => m.isLocal);
    } else if (cloudOnly && !localOnly) {
      models = models.filter((m) => !m.isLocal);
    }

    // Group by provider
    const grouped: Record<string, any[]> = {};
    for (const model of models) {
      const providerName =
        (model as any).provider || (model as any)._provider || "unknown";
      if (!grouped[providerName]) {
        grouped[providerName] = [];
      }
      grouped[providerName].push(model);
    }

    let message = `# 🤖 Available AI Models\n\n`;

    for (const [provider, providerModels] of Object.entries(grouped)) {
      if (providerModels.length === 0) {
        continue;
      }

      message += `## ${this.getProviderEmoji(provider)} ${provider.toUpperCase()}\n\n`;

      for (const model of providerModels) {
        const statusIcon = model.available ? "✅" : "❌";
        const contextInfo = model.contextLength
          ? ` [${this.formatTokens(model.contextLength)}]`
          : "";
        const isLocal = ["ollama", "lmstudio", "vllm"].includes(
          provider.toLowerCase(),
        );
        const typeInfo = isLocal ? " 🏠" : " ☁️";

        message += `**${statusIcon} ${model.name}**${typeInfo}${contextInfo}\n`;
        message += `   ${model.description || "No description"}\n`;

        if (model.recommendedFor && model.recommendedFor.length > 0) {
          message += `   *Recommended for: ${model.recommendedFor.join(", ")}*\n`;
        }

        message += "\n";
      }
    }

    message += `---\n`;
    message += `Total: ${models.length} models\n`;
    message += `*Use \`/model set <model-id>\` to set default model*\n`;
    message += `*Use \`/model info <model-id>\` for detailed information*`;

    return this.success(message, { models, total: models.length });
  }

  private async setDefaultModel(args: CommandArgs): Promise<CommandResult> {
    const modelId = args.parsed.positional?.[1] as string;
    const model = await this.findModel(modelId);

    if (!model) {
      const suggestions = await this.findSimilarModels(modelId);
      return this.error(`Model not found: ${modelId}`, "MODEL_NOT_FOUND", {
        suggestions,
      });
    }

    // Test connectivity (mock for now)
    const testResult = await this.performModelTest(model);

    // Save to configuration and update provider manager
    this.setCache("default-model", modelId, 86400); // Cache for 24 hours
    
    // Determine the provider for this model
    const modelProvider = model.provider || model._provider || "unknown";
    
    try {
      // Update config manager with new default model
      this.configManager.update({
        model: modelId,
        provider: modelProvider
      }, "user");
      
      // Update provider manager to use new provider
      if (this.providerManager.setCurrentProvider) {
        this.providerManager.setCurrentProvider(modelProvider as any);
      }
      
      // Reinitialize provider manager to pick up new configuration
      await this.providerManager.initialize();
      
      logger.debug(`Model switched to ${modelId} (${modelProvider}), provider manager updated`);
    } catch (error) {
      logger.warn(`Failed to update provider manager after model switch: ${error.message}`);
      // Continue anyway - the cache update should still work
    }

    let message = `✅ **Default Model Updated**\n\n`;
    message += `**Model**: ${model.name} (${model.id || model.name})\n`;
    message += `**Provider**: ${modelProvider}\n`;
    message += `**Context Window**: ${this.formatTokens(model.contextLength || model.contextWindow || 8192)}\n`;

    if (model.costPerToken) {
      message += `**Cost**: $${model.costPerToken}/1K tokens\n`;
    }

    const setIsLocal = ["ollama", "lmstudio", "vllm"].includes(
      modelProvider.toLowerCase(),
    );
    message += `**Type**: ${setIsLocal ? "Local" : "Cloud"}\n`;
    message += `**Status**: ${testResult.available ? "✅ Available" : "❌ Unavailable"}\n`;

    if (testResult.latency) {
      message += `**Latency**: ${testResult.latency}ms\n`;
    }

    if (!testResult.available) {
      message += `\n⚠️ **Warning**: Model is not currently available but has been set as default.`;
    }

    return this.success(message, { model, testResult });
  }

  private async showModelInfo(args: CommandArgs): Promise<CommandResult> {
    const modelId = args.parsed.positional?.[1] as string;
    const model = await this.findModel(modelId);

    if (!model) {
      const suggestions = await this.findSimilarModels(modelId);
      return this.error(`Model not found: ${modelId}`, "MODEL_NOT_FOUND", {
        suggestions,
      });
    }

    let message = `# 📊 Model Information: ${model.name}\n\n`;

    const provider = model.provider || model._provider || "unknown";
    const isLocal = ["ollama", "lmstudio", "vllm"].includes(
      provider.toLowerCase(),
    );

    const info = [
      ["ID", model.id || model.name],
      ["Provider", provider],
      ["Version", model.version || "Latest"],
      [
        "Context Window",
        this.formatTokens(model.contextLength || model.contextWindow || 8192),
      ],
      [
        "Max Output",
        model.maxOutput ? this.formatTokens(model.maxOutput) : "N/A",
      ],
      [
        "Cost",
        model.costPerToken
          ? `$${model.costPerToken}/1K tokens`
          : "Free/Unknown",
      ],
      ["Type", isLocal ? "Local 🏠" : "Cloud ☁️"],
      ["Capabilities", (model.capabilities || ["text", "code"]).join(", ")],
      ["Languages", model.languages?.join(", ") || "All"],
    ];

    const maxLabelLength = Math.max(...info.map(([label]) => label.length));

    info.forEach(([label, value]) => {
      message += `**${label.padEnd(maxLabelLength)}**: ${value}\n`;
    });

    if (model.description) {
      message += `\n**Description**:\n${model.description}\n`;
    }

    if (model.bestFor && model.bestFor.length > 0) {
      message += `\n**Best For**:\n`;
      model.bestFor.forEach((use) => {
        message += `• ${use}\n`;
      });
    }

    if (model.limitations && model.limitations.length > 0) {
      message += `\n**Limitations**:\n`;
      model.limitations.forEach((limitation) => {
        message += `• ${limitation}\n`;
      });
    }

    // Check availability
    const testResult = await this.performModelTest(model);
    message += `\n**Status**: ${testResult.available ? "✅ Available" : "❌ Unavailable"}\n`;

    if (testResult.latency) {
      message += `**Latency**: ${testResult.latency}ms\n`;
    }

    return this.success(message, { model, testResult });
  }

  private async testModel(args: CommandArgs): Promise<CommandResult> {
    const modelId = args.parsed.positional?.[1] as string;
    const model = await this.findModel(modelId);

    if (!model) {
      return this.error(`Model not found: ${modelId}`, "MODEL_NOT_FOUND");
    }

    let message = `# 🧪 Testing Model: ${model.name}\n\n`;

    const tests = [
      { name: "Connectivity", test: () => this.performModelTest(model) },
      {
        name: "Simple Generation",
        test: () => this.testGeneration(model, 'Hello, respond with "OK"'),
      },
      {
        name: "Code Generation",
        test: () => this.testGeneration(model, "Write a hello world in Python"),
      },
      {
        name: "Reasoning",
        test: () => this.testGeneration(model, "What is 25 * 4?"),
      },
    ];

    const results = [];

    for (const { name, test } of tests) {
      message += `**${name}**: `;

      try {
        const startTime = Date.now();
        const result = await test();
        const duration = Date.now() - startTime;

        message += `✅ Passed (${duration}ms)\n`;
        results.push({ name, success: true, duration, result });
      } catch (innerError) {
        message += `❌ Failed - ${innerError instanceof Error ? innerError.message : "Unknown error"}\n`;
        results.push({
          name,
          success: false,
          error:
            innerError instanceof Error ? innerError.message : "Unknown error",
        });
      }
    }

    // Summary
    const successCount = results.filter((r) => r.success).length;
    const avgDuration =
      results
        .filter((r) => r.success && r.duration)
        .reduce((sum, r) => sum + (r.duration || 0), 0) / successCount || 0;

    message += `\n**Summary**:\n`;
    message += `• Tests passed: ${successCount}/${results.length}\n`;

    if (avgDuration > 0) {
      message += `• Average response time: ${avgDuration.toFixed(0)}ms\n`;
    }

    const overallSuccess = successCount === results.length;
    message += `• Overall status: ${overallSuccess ? "✅ All tests passed" : "❌ Some tests failed"}\n`;

    return this.success(message, {
      model,
      results,
      summary: {
        passed: successCount,
        total: results.length,
        avgResponseTime: avgDuration,
      },
    });
  }

  private async benchmarkModels(args: CommandArgs): Promise<CommandResult> {
    const allModels = await this.getAllModels();
    const availableModels = allModels.filter((m) => m.available !== false);

    if (availableModels.length === 0) {
      return this.error("No available models to benchmark", "NO_MODELS");
    }

    let message = `# ⚡ Model Benchmark Results\n\n`;

    const prompts = [
      { type: "simple", text: "What is 2+2?" },
      { type: "code", text: "Write a fibonacci function in Python" },
      {
        type: "reasoning",
        text: "Explain why the sky is blue in one sentence",
      },
      { type: "creative", text: "Write a haiku about programming" },
    ];

    const results = [];

    for (const model of availableModels.slice(0, 5)) {
      // Limit to 5 models for demo
      const modelResults = {
        model: model.id,
        provider: model.provider,
        scores: Record<string, any> as Record<string, number>,
        avgLatency: 0,
        estimatedCost: 0,
      };

      let totalLatency = 0;
      let successCount = 0;

      for (const prompt of prompts) {
        try {
          const startTime = Date.now();
          await this.testGeneration(model, prompt.text);
          const latency = Date.now() - startTime;

          modelResults.scores[prompt.type] = latency;
          totalLatency += latency;
          successCount++;
        } catch (innerError) {
          modelResults.scores[prompt.type] = -1; // Failed
        }
      }

      if (successCount > 0) {
        modelResults.avgLatency = totalLatency / successCount;

        if (model.costPerToken) {
          // Estimate cost (assuming ~50 tokens per test)
          modelResults.estimatedCost =
            (50 * prompts.length * model.costPerToken) / 1000;
        }
      }

      results.push(modelResults);
    }

    // Sort by average latency
    results.sort((a, b) => a.avgLatency - b.avgLatency);

    // Display results
    results.forEach((result, index) => {
      const medal =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";

      message += `${medal} **${result.model}**\n`;
      message += `   Provider: ${result.provider}\n`;
      message += `   Avg Latency: ${result.avgLatency.toFixed(0)}ms\n`;

      if (result.estimatedCost > 0) {
        message += `   Est. Cost: $${result.estimatedCost.toFixed(4)}\n`;
      }

      // Show individual scores
      Object.entries(result.scores).forEach(([type, latency]) => {
        const status = latency === -1 ? "❌ Failed" : `✅ ${latency}ms`;
        message += `   ${type}: ${status}\n`;
      });

      message += "\n";
    });

    return this.success(message, { results, winner: results[0]?.model });
  }

  private async analyzeCosts(args: CommandArgs): Promise<CommandResult> {
    const allModels = await this.getAllModels();
    const models = allModels.filter((m) => m.costPerToken);

    if (models.length === 0) {
      return this.error("No pricing information available", "NO_PRICING");
    }

    // Sort by cost
    models.sort((a, b) => (a.costPerToken || 0) - (b.costPerToken || 0));

    let message = `# 💰 Model Cost Analysis\n\n`;
    message += `*Based on 1 million tokens*\n\n`;

    // Cost table
    message += `| Model | Provider | $/1K | $/1M | Context |\n`;
    message += `|-------|----------|------|------|----------|\n`;

    models.forEach((model) => {
      const costPer1K = `$${(model.costPerToken || 0).toFixed(3)}`;
      const costPer1M = `$${((model.costPerToken || 0) * 1000).toFixed(2)}`;
      const context = this.formatTokens(model.contextWindow);

      message += `| ${model.id} | ${model.provider} | ${costPer1K} | ${costPer1M} | ${context} |\n`;
    });

    // Usage estimates
    message += `\n## 📈 Monthly Usage Estimates\n\n`;

    const scenarios = [
      { name: "Light Usage (10K tokens/day)", tokensPerMonth: 300000 },
      { name: "Medium Usage (100K tokens/day)", tokensPerMonth: 3000000 },
      { name: "Heavy Usage (1M tokens/day)", tokensPerMonth: 30000000 },
    ];

    scenarios.forEach((scenario) => {
      message += `**${scenario.name}**:\n`;

      models.slice(0, 3).forEach((model) => {
        const monthlyCost =
          ((model.costPerToken || 0) * scenario.tokensPerMonth) / 1000;
        message += `• ${model.id}: $${monthlyCost.toFixed(2)}/month\n`;
      });

      message += "\n";
    });

    return this.success(message, {
      models: models.map((m) => ({
        id: m.id,
        provider: m.provider,
        costPer1K: m.costPerToken,
        costPer1M: (m.costPerToken || 0) * 1000,
      })),
      cheapest: models[0]?.id,
      mostExpensive: models[models.length - 1]?.id,
    });
  }

  private async showCurrentModel(args: CommandArgs): Promise<CommandResult> {
    const currentModelId =
      this.getCache<string>("default-model") || "claude-3-sonnet";
    const model = await this.findModel(currentModelId);

    let message = `# 🤖 Current Model Configuration\n\n`;
    message += `**Default Model**: ${model ? model.name : currentModelId}\n`;

    if (model) {
      message += `**ID**: ${model.id}\n`;
      const provider = model.provider || model._provider || "unknown";
      message += `**Provider**: ${provider}\n`;
      message += `**Context Window**: ${this.formatTokens(model.contextLength || model.contextWindow || 8192)}\n`;

      if (model.costPerToken) {
        message += `**Cost**: $${model.costPerToken}/1K tokens\n`;
      }

      message += `**Type**: ${model.isLocal ? "Local 🏠" : "Cloud ☁️"}\n`;

      // Check status
      const testResult = await this.performModelTest(model);
      message += `**Status**: ${testResult.available ? "✅ Available" : "❌ Unavailable"}\n`;

      if (testResult.latency) {
        message += `**Latency**: ${testResult.latency}ms\n`;
      }
    }

    message += `\n---\n`;
    message += `*Use \`/model list\` to see all available models*\n`;
    message += `*Use \`/model set <model-id>\` to change the default model*`;

    return this.success(message, { current: currentModelId, model });
  }

  private async listProviders(args: CommandArgs): Promise<CommandResult> {
    let message = `# 🏢 AI Model Providers\n\n`;

    for (const [providerId, provider] of Object.entries(this.providers)) {
      const statusIcon = provider.available ? "✅" : "❌";
      const modelCount = provider.models.length;

      message += `## ${statusIcon} ${provider.name}\n`;
      message += `**Models**: ${modelCount}\n`;
      message += `**Status**: ${provider.available ? "Available" : "Unavailable"}\n`;

      if (provider.apiKey) {
        message += `**API Key**: Configured\n`;
      }

      if (provider.endpoint) {
        message += `**Endpoint**: ${provider.endpoint}\n`;
      }

      message += "\n";
    }

    return this.success(message, { providers: this.providers });
  }

  // Helper methods

  private async getAllModels(): Promise<any[]> {
    await this.providerManager.initialize();
    
    try {
      // Use the correct method name and format the data appropriately
      const modelsRecord = await this.providerManager.getAvailableModelsAsync();
      
      // Convert provider-based record to array format expected by ModelCommand
      const models = [];
      
      for (const [providerId, modelNames] of Object.entries(modelsRecord)) {
        for (const modelName of modelNames) {
          models.push({
            id: modelName,
            name: modelName,
            provider: providerId,
            _provider: providerId,
            available: true,
            description: `${modelName} model from ${providerId}`,
            contextWindow: 8192, // Default context window
            contextLength: 8192,
            capabilities: ["text", "code"],
            recommendedFor: ["General use"],
            isLocal: ["ollama", "lmstudio", "vllm"].includes(providerId.toLowerCase()),
          });
        }
      }
      
      // If no models from provider manager, fallback to static definitions
      if (models.length === 0) {
        return this.getFallbackModels();
      }
      
      return models;
    } catch (error) {
      console.warn("Failed to get models from provider manager, using fallback:", error);
      return this.getFallbackModels();
    }
  }
  
  private getFallbackModels(): any[] {
    const fallbackModels = [];
    
    // Add models from the static providers definition
    for (const [providerId, provider] of Object.entries(this.providers)) {
      for (const model of provider.models) {
        fallbackModels.push({
          ...model,
          provider: providerId,
          _provider: providerId,
          available: true,
        });
      }
    }
    
    return fallbackModels;
  }

  private async findModel(modelId: string): Promise<any | null> {
    const models = await this.getAllModels();
    return (
      models.find(
        (m) =>
          m.id?.toLowerCase() === modelId.toLowerCase() ||
          m.name?.toLowerCase() === modelId.toLowerCase(),
      ) || null
    );
  }

  private async findSimilarModels(input: string): Promise<string[]> {
    const models = await this.getAllModels();
    return models
      .filter(
        (m) =>
          m.id?.toLowerCase().includes(input.toLowerCase()) ||
          m.name?.toLowerCase().includes(input.toLowerCase()),
      )
      .map((m) => m.id || m.name)
      .slice(0, 3);
  }

  private groupModelsByProvider(models: any[]): Record<string, any[]> {
    return models.reduce(
      (acc, model) => {
        const provider = model.provider || model._provider || "unknown";
        if (!acc[provider]) {
          acc[provider] = [];
        }
        acc[provider].push(model);
        return acc;
      },
      {} as Record<string, any[]>,
    );
  }

  private getProviderEmoji(provider: string): string {
    const emojis: Record<string, string> = {
      anthropic: "🎭",
      openai: "🤖",
      google: "🌈",
      local: "🏠",
    };
    return emojis[provider.toLowerCase()] || "🔮";
  }

  private formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  }

  private async performModelTest(
    model: any,
  ): Promise<{ available: boolean; latency?: number }> {
    // Mock test - in real implementation, this would test actual connectivity
    const latency = Math.random() * 1000 + 100; // Random latency between 100-1100ms
    const provider = model.provider || model._provider || "unknown";
    const available = model.available !== false && Math.random() > 0.1; // 90% success rate

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ available, latency: available ? latency : undefined });
      }, 100);
    });
  }

  private async testGeneration(model: any, prompt: string): Promise<string> {
    // Mock generation test - in real implementation, this would call the actual model
    if (model.available === false) {
      throw new Error("Provider not available");
    }

    return new Promise((resolve, reject) => {
      setTimeout(
        () => {
          if (Math.random() > 0.15) {
            // 85% success rate
            resolve(`Mock response for: ${prompt}`);
          } else {
            reject(new Error("Generation failed"));
          }
        },
        Math.random() * 2000 + 500,
      ); // Random delay 500-2500ms
    });
  }


  /**
   * Show interactive model selection UI
   */
  private async showInteractiveUI(args: CommandArgs): Promise<CommandResult> {
    try {
      // Get all available models
      await this.providerManager.initialize();
      const availableModels = await this.getAllModels();
      
      // Prepare model choices for UI
      const modelChoices = availableModels.map(model => {
        const provider = model.provider || model._provider || "unknown";
        const isLocal = ["ollama", "lmstudio", "vllm"].includes(provider.toLowerCase());
        const typeEmoji = isLocal ? "🏠" : "☁️";
        const statusEmoji = model.available !== false ? "✅" : "❌";
        
        return {
          name: `${statusEmoji} ${typeEmoji} ${model.name} (${provider}) - ${model.description || 'No description'}`,
          value: model.id || model.name,
          group: provider
        };
      });

      // Group models by provider for better organization
      const cloudModels = modelChoices.filter(m => m.name.includes("☁️"));
      const localModels = modelChoices.filter(m => m.name.includes("🏠"));
      
      // Combine with cloud models first, then local
      const sortedChoices = [...cloudModels, ...localModels];
      
      if (sortedChoices.length === 0) {
        return this.error("No models available for selection", "NO_MODELS");
      }

      // Create and show UI
      const ui = new ModelSelectorUI(sortedChoices);
      const selectedModel = await ui.show();
      
      if (!selectedModel) {
        return this.success("Model selection cancelled", { cancelled: true });
      }

      // Set the selected model
      const setArgs = { ...args };
      setArgs.parsed.positional = ["set", selectedModel];
      return await this.setDefaultModel(setArgs);
      
    } catch (error) {
      logger.error("Interactive UI failed:", error);
      return this.error(
        `Interactive UI failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "UI_ERROR",
        error
      );
    }
  }
}

export const meta = {
  name: 'model',
  category: 'configuration',
  description: 'Manages AI model configuration and selection',
  aliases: ['models', 'ai-model', 'llm'],
  usage: '/model [list|set|get|ui] [model-id]',
  examples: [
    '/model list',
    '/model set gpt-4',
    '/model get',
    '/model ui'
  ],
  deps: []
};
