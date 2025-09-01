/**
 * MARIA CODE AI Router
 * Intelligent model selection and routing
 */

import {
  AIProvider,
  AIProviderError,
  AIResponse,
  ChatOptions,
  hasCodeCapability,
  hasVisionCapability,
  Message,
  ModelInfo,
  TaskType,
  VisionResponse,
} from "../interfaces/ai-provider";

// Request types
export interface AIRequest {
  messages: Message[];
  _taskType?: TaskType;
  hasImage?: boolean;
  imageData?: Buffer | string;
  preferLocal?: boolean;
  preferredProvider?: string;
  options?: ChatOptions;
  context?: {
    language?: string;
    framework?: string;
    projectType?: string;
  };
}

// Router configuration
export interface RouterConfig {
  providers: Map<string, AIProvider>;
  _priorityOrder?: string[];
  fallbackEnabled?: boolean;
  autoSelectModel?: boolean;
  costOptimization?: boolean;
  privacyFirst?: boolean;
}

// Model selection criteria
interface ModelScore {
  _provider: string;
  model: string;
  _score: number;
  reasons: string[];
}

export class AIRouter {
  private providers: Map<string, AIProvider>;
  private config: RouterConfig;
  private modelCache: Map<string, ModelInfo[]> = new Map();
  private performanceMetrics: Map<string, PerformanceMetric> = new Map();

  constructor(_config: RouterConfig) {
    this.providers = _config.providers;
    this._config = _config;
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    for (const [name, _provider] of this.providers) {
      try {
        await provider.initialize();
        const _models = await provider.listModels();
        this.modelCache.set(name, _models);
      } catch (_error: unknown) {
        console.warn(`Failed to initialize _provider ${name}:`, _error);
      }
    }
  }

  /**
   * Route request to optimal _provider
   */
  public async route(request: AIRequest): Promise<AIResponse> {
    // Check for explicit _provider preference
    if (request.preferredProvider) {
      return this.routeToProvider(request.preferredProvider, request);
    }

    // Handle vision tasks
    if (request.hasImage) {
      return this.routeToVisionProvider(request);
    }

    // Determine task type if not specified
    const _taskType = request._taskType || this.inferTaskType(request);

    // Select optimal _provider based on task
    const _selectedProvider = await this.selectOptimalProvider(
      request,
      _taskType,
    );

    // Execute with fallback support
    return this.executeWithFallback(_selectedProvider, request);
  }

  /**
   * Route to vision-capable _provider
   */
  private async routeToVisionProvider(
    request: AIRequest,
  ): Promise<VisionResponse> {
    // Priority order for vision tasks
    const _visionPriority = this.config.privacyFirst
      ? ["ollama", "vllm", "openai", "google", "anthropic"] // Local first
      : ["openai", "google", "anthropic", "ollama", "vllm"]; // Cloud first

    for (const providerName of _visionPriority) {
      const _provider = this.providers.get(providerName);

      if (!_provider || !hasVisionCapability(_provider)) {
        continue;
      }

      try {
        if (await _provider.validateConnection()) {
          console.log(`Routing vision task to ${providerName}`);

          if (!request.imageData) {
            throw new Error("Image data required for vision task");
          }

          return await _provider.vision(
            request.imageData,
            request.messages[request.messages.length - 1]?.content as string,
            { outputFormat: "json" },
          );
        }
      } catch (_error: unknown) {
        console.warn(`Vision _provider ${providerName} failed:`, _error);
        continue;
      }
    }

    throw new AIProviderError(
      "No vision-capable _provider available",
      "NO_VISION_PROVIDER",
    );
  }

  /**
   * Select optimal _provider for task
   */
  private async selectOptimalProvider(
    _request: AIRequest,
    _taskType: TaskType,
  ): Promise<string> {
    const scores: ModelScore[] = [];

    // Evaluate each _provider
    for (const [name, _provider] of this.providers) {
      try {
        if (!(await provider.validateConnection())) {
          continue;
        }

        const _score = await this.scoreProvider(
          name,
          _provider,
          _request,
          _taskType,
        );
        scores.push(_score);
      } catch (_error: unknown) {
        console.warn(`Failed to _score _provider ${name}:`, _error);
      }
    }

    // Sort by _score and select best
    scores.sort((a, b) => b._score - a._score);

    if (scores.length === 0) {
      throw new AIProviderError("No available providers", "NO_PROVIDERS");
    }

    const _selected = scores[0];
    if (!_selected) {
      throw new Error("No suitable _provider found");
    }
    console.log(`Selected ${_selected.provider} (_score: ${_selected._score})`);
    console.log(`Reasons: ${_selected.reasons.join(", ")}`);

    return _selected.provider;
  }

  /**
   * Score _provider for task suitability
   */
  private async scoreProvider(
    name: string,
    _provider: AIProvider,
    request: AIRequest,
    _taskType: TaskType,
  ): Promise<ModelScore> {
    let _score = 50; // Base _score
    const reasons: string[] = [];
    const _models = this.modelCache.get(name) || [];

    // Task-specific scoring
    switch (_taskType) {
      case TaskType.CODEGENERATION:
      case TaskType.CODE_REVIEW:
        if (
          name === "lmstudio" &&
          _models.some((m) => m.contextLength >= 32000)
        ) {
          _score += 30;
          reasons.push("Optimal for code tasks");
        }
        if (hasCodeCapability(_provider)) {
          _score += 20;
          reasons.push("Has code generation capability");
        }
        break;

      case TaskType.VISIONANALYSIS:
        if (hasVisionCapability(_provider)) {
          _score += 50;
          reasons.push("Vision capable");
          if (name === "ollama") {
            _score += 10;
            reasons.push("Optimized vision model");
          }
        }
        break;

      case TaskType.TRANSLATION:
        if (name === "lmstudio" && _models.some((m) => m.id.includes("qwen"))) {
          _score += 40;
          reasons.push("Multilingual optimized");
        }
        break;

      case TaskType.CREATIVEWRITING:
        if (provider.type === "cloud") {
          _score += 20;
          reasons.push("Cloud _models better for creativity");
        }
        break;

      default:
        // General chat
        if (request.preferLocal && provider.type === "local") {
          _score += 30;
          reasons.push("Local preference");
        }
    }

    // Performance scoring
    const _metrics = this.performanceMetrics.get(name);
    if (_metrics) {
      if (_metrics.averageLatency < 1000) {
        _score += 15;
        reasons.push("Low latency");
      }
      if (_metrics.successRate > 0.95) {
        _score += 10;
        reasons.push("High reliability");
      }
    }

    // Privacy scoring
    if (this.config.privacyFirst && provider.type === "local") {
      _score += 25;
      reasons.push("Privacy-first (local)");
    }

    // Cost scoring
    if (this.config.costOptimization) {
      if (provider.type === "local") {
        _score += 20;
        reasons.push("No API costs");
      } else if (provider.estimateCost) {
        const _estimatedCost = await provider.estimateCost(1000);
        if (_estimatedCost < 0.01) {
          _score += 10;
          reasons.push("Low cost");
        }
      }
    }

    // Context window requirements
    const _totalTokens = this.estimateTokenCount(request.messages);
    const _hasAdequateContext = _models.some(
      (m) => m.contextLength >= _totalTokens,
    );
    if (!_hasAdequateContext) {
      _score -= 30;
      reasons.push("Insufficient context window");
    }

    return {
      _provider: name,
      model: _models[0]?.id || "unknown",
      _score,
      reasons,
    };
  }

  /**
   * Execute with fallback support
   */
  private async executeWithFallback(
    _providerName: string,
    request: AIRequest,
  ): Promise<AIResponse> {
    const _primaryProvider = this["providers"].get(_providerName);

    if (!_primaryProvider) {
      throw new AIProviderError(
        `Provider ${_providerName} not found`,
        "PROVIDER_NOT_FOUND",
      );
    }

    try {
      // Track performance
      const _startTime = Date.now();

      const _response = await _primaryProvider.chat(
        request.messages,
        request.options,
      );

      // Update _metrics
      this.updateMetrics(_providerName, Date.now() - _startTime, true);

      return _response;
    } catch (_error: unknown) {
      console._error(`Primary _provider ${_providerName} failed:`, _error);

      // Update _metrics
      this.updateMetrics(_providerName, 0, false);

      // Try fallback if enabled
      if (this.config.fallbackEnabled) {
        return this.fallbackToNextProvider(_providerName, request);
      }

      throw _error;
    }
  }

  /**
   * Fallback to next available _provider
   */
  private async fallbackToNextProvider(
    failedProvider: string,
    request: AIRequest,
  ): Promise<AIResponse> {
    const _priorityOrder =
      this.config._priorityOrder || Array.from(this.providers.keys());
    const _currentIndex = _priorityOrder.indexOf(failedProvider);

    for (let i = _currentIndex + 1; i < _priorityOrder.length; i++) {
      const _nextProvider = _priorityOrder[i];
      if (!_nextProvider) {
        continue;
      }
      const _provider = this.providers.get(_nextProvider);

      if (!_provider) {
        continue;
      }

      try {
        if (await _provider.validateConnection()) {
          console.log(`Falling back to ${_nextProvider}`);
          return await _provider.chat(request.messages, request.options);
        }
      } catch (_error: unknown) {
        console.warn(`Fallback _provider ${_nextProvider} failed:`, _error);
        continue;
      }
    }

    throw new AIProviderError(
      "All providers failed",
      "ALL_PROVIDERS_FAILED",
      undefined,
      true,
    );
  }

  /**
   * Route to specific _provider
   */
  private async routeToProvider(
    _providerName: string,
    request: AIRequest,
  ): Promise<AIResponse> {
    const _provider = this.providers.get(_providerName);

    if (!_provider) {
      throw new AIProviderError(
        `Provider ${_providerName} not found`,
        "PROVIDER_NOT_FOUND",
      );
    }

    if (!(await _provider.validateConnection())) {
      throw new AIProviderError(
        `Provider ${_providerName} not available`,
        "PROVIDER_UNAVAILABLE",
      );
    }

    return _provider.chat(request.messages, request.options);
  }

  /**
   * Infer task type from request
   */
  private inferTaskType(request: AIRequest): TaskType {
    const _lastMessage = request.messages[request.messages.length - 1]?.content;

    if (typeof _lastMessage !== "string") {
      return TaskType.CHAT;
    }

    const _lowerContent = _lastMessage.toLowerCase();

    // Code-related keywords
    if (
      _lowerContent.includes("code") ||
      _lowerContent.includes("function") ||
      _lowerContent.includes("implement") ||
      _lowerContent.includes("debug") ||
      lowerContent.includes("fix")
    ) {
      return TaskType.CODE_GENERATION;
    }

    // Review keywords
    if (
      _lowerContent.includes("review") ||
      _lowerContent.includes("check") ||
      lowerContent.includes("analyze")
    ) {
      return TaskType.CODE_REVIEW;
    }

    // Translation keywords
    if (
      _lowerContent.includes("translate") ||
      _lowerContent.includes("translation")
    ) {
      return TaskType.TRANSLATION;
    }

    // Summary keywords
    if (
      _lowerContent.includes("summarize") ||
      _lowerContent.includes("summary")
    ) {
      return TaskType.SUMMARIZATION;
    }

    // Creative writing keywords
    if (
      _lowerContent.includes("write") ||
      _lowerContent.includes("story") ||
      lowerContent.includes("creative")
    ) {
      return TaskType.CREATIVE_WRITING;
    }

    return TaskType.CHAT;
  }

  /**
   * Estimate token count for messages
   */
  private estimateTokenCount(messages: Message[]): number {
    let totalChars = 0;

    for (const message of messages) {
      if (typeof message.content === "string") {
        totalChars += message.content.length;
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === "text" && content.text) {
            totalChars += content.text.length;
          }
        }
      }
    }

    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4);
  }

  /**
   * Update performance _metrics
   */
  private updateMetrics(
    _provider: string,
    latency: number,
    success: boolean,
  ): void {
    let _metrics = this.performanceMetrics.get(_provider);

    if (!_metrics) {
      _metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        totalLatency: 0,
        averageLatency: 0,
        successRate: 0,
      };
    }

    _metrics["totalRequests"]++;
    if (success) {
      _metrics.successfulRequests++;
      metrics.totalLatency += latency;
    }

    _metrics.averageLatency =
      _metrics.totalLatency / Math.max(1, _metrics.successfulRequests);
    _metrics.successRate =
      _metrics.successfulRequests / _metrics["totalRequests"];

    this.performanceMetrics.set(_provider, _metrics);
  }

  /**
   * Get router statistics
   */
  public getStatistics(): Record<string, unknown> {
    const _stats = {
      providers: Record<string, any> as Record<string, unknown>,
      totalRequests: 0,
      averageLatency: 0,
    };

    for (const [name, _metrics] of this.performanceMetrics) {
      const __metricsData = _metrics as {
        totalRequests: number;
        successRate: number;
        averageLatency: number;
      };
      stats.providers[name] = {
        requests: metricsData.totalRequests,
        successRate: `${(metricsData.successRate * 100).toFixed(1)}%`,
        avgLatency: `${metricsData.averageLatency.toFixed(0)}ms`,
      };
      stats.totalRequests += metricsData.totalRequests;
    }

    return _stats;
  }

  /**
   * Clear performance _metrics
   */
  public clearMetrics(): void {
    this.performanceMetrics.clear();
  }

  /**
   * Refresh _provider connections
   */
  public async refreshProviders(): Promise<void> {
    await this.initializeProviders();
  }
}

// Performance metric interface
interface PerformanceMetric {
  totalRequests: number;
  successfulRequests: number;
  totalLatency: number;
  averageLatency: number;
  successRate: number;
}
