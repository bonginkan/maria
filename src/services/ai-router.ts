/**
 * MARIA CODE AI Router
 * Intelligent model selection and routing
 */

import {
  AIProvider,
  AIResponse,
  Message,
  ChatOptions,
  VisionResponse,
  TaskType,
  AIProviderError,
  hasVisionCapability,
  hasCodeCapability,
  ModelInfo,
} from '../interfaces/ai-provider';

// Request types
export interface AIRequest {
  messages: Message[];
  taskType?: TaskType;
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
  priorityOrder?: string[];
  fallbackEnabled?: boolean;
  autoSelectModel?: boolean;
  costOptimization?: boolean;
  privacyFirst?: boolean;
}

// Model selection criteria
interface ModelScore {
  provider: string;
  model: string;
  score: number;
  reasons: string[];
}

export class AIRouter {
  private providers: Map<string, AIProvider>;
  private config: RouterConfig;
  private modelCache: Map<string, ModelInfo[]> = new Map();
  private performanceMetrics: Map<string, PerformanceMetric> = new Map();

  constructor(config: RouterConfig) {
    this.providers = config.providers;
    this.config = config;
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    for (const [name, provider] of this.providers) {
      try {
        await provider.initialize();
        const models = await provider.listModels();
        this.modelCache.set(name, models);
      } catch (error: unknown) {
        console.warn(`Failed to initialize provider ${name}:`, error);
      }
    }
  }

  /**
   * Route request to optimal provider
   */
  public async route(request: AIRequest): Promise<AIResponse> {
    // Check for explicit provider preference
    if (request.preferredProvider) {
      return this.routeToProvider(request.preferredProvider, request);
    }

    // Handle vision tasks
    if (request.hasImage) {
      return this.routeToVisionProvider(request);
    }

    // Determine task type if not specified
    const taskType = request.taskType || this.inferTaskType(request);

    // Select optimal provider based on task
    const selectedProvider = await this.selectOptimalProvider(request, taskType);

    // Execute with fallback support
    return this.executeWithFallback(selectedProvider, request);
  }

  /**
   * Route to vision-capable provider
   */
  private async routeToVisionProvider(request: AIRequest): Promise<VisionResponse> {
    // Priority order for vision tasks
    const visionPriority = this.config.privacyFirst
      ? ['ollama', 'vllm', 'openai', 'google', 'anthropic'] // Local first
      : ['openai', 'google', 'anthropic', 'ollama', 'vllm']; // Cloud first

    for (const providerName of visionPriority) {
      const provider = this.providers.get(providerName);

      if (!provider || !hasVisionCapability(provider)) {
        continue;
      }

      try {
        if (await provider.validateConnection()) {
          console.log(`Routing vision task to ${providerName}`);

          if (!request.imageData) {
            throw new Error('Image data required for vision task');
          }

          return await provider.vision(
            request.imageData,
            request.messages[request.messages.length - 1]?.content as string,
            { outputFormat: 'json' },
          );
        }
      } catch (error: unknown) {
        console.warn(`Vision provider ${providerName} failed:`, error);
        continue;
      }
    }

    throw new AIProviderError('No vision-capable provider available', 'NO_VISION_PROVIDER');
  }

  /**
   * Select optimal provider for task
   */
  private async selectOptimalProvider(request: AIRequest, taskType: TaskType): Promise<string> {
    const scores: ModelScore[] = [];

    // Evaluate each provider
    for (const [name, provider] of this.providers) {
      try {
        if (!(await provider.validateConnection())) {
          continue;
        }

        const score = await this.scoreProvider(name, provider, request, taskType);
        scores.push(score);
      } catch (error: unknown) {
        console.warn(`Failed to score provider ${name}:`, error);
      }
    }

    // Sort by score and select best
    scores.sort((a, b) => b.score - a.score);

    if (scores.length === 0) {
      throw new AIProviderError('No available providers', 'NO_PROVIDERS');
    }

    const selected = scores[0];
    if (!selected) {
      throw new Error('No suitable provider found');
    }
    console.log(`Selected ${selected.provider} (score: ${selected.score})`);
    console.log(`Reasons: ${selected.reasons.join(', ')}`);

    return selected.provider;
  }

  /**
   * Score provider for task suitability
   */
  private async scoreProvider(
    name: string,
    provider: AIProvider,
    request: AIRequest,
    taskType: TaskType,
  ): Promise<ModelScore> {
    let score = 50; // Base score
    const reasons: string[] = [];
    const models = this.modelCache.get(name) || [];

    // Task-specific scoring
    switch (taskType) {
      case TaskType.CODE_GENERATION:
      case TaskType.CODE_REVIEW:
        if (name === 'lmstudio' && models.some((m) => m.contextLength >= 32000)) {
          score += 30;
          reasons.push('Optimal for code tasks');
        }
        if (hasCodeCapability(provider)) {
          score += 20;
          reasons.push('Has code generation capability');
        }
        break;

      case TaskType.VISION_ANALYSIS:
        if (hasVisionCapability(provider)) {
          score += 50;
          reasons.push('Vision capable');
          if (name === 'ollama') {
            score += 10;
            reasons.push('Optimized vision model');
          }
        }
        break;

      case TaskType.TRANSLATION:
        if (name === 'lmstudio' && models.some((m) => m.id.includes('qwen'))) {
          score += 40;
          reasons.push('Multilingual optimized');
        }
        break;

      case TaskType.CREATIVE_WRITING:
        if (provider.type === 'cloud') {
          score += 20;
          reasons.push('Cloud models better for creativity');
        }
        break;

      default:
        // General chat
        if (request.preferLocal && provider.type === 'local') {
          score += 30;
          reasons.push('Local preference');
        }
    }

    // Performance scoring
    const metrics = this.performanceMetrics.get(name);
    if (metrics) {
      if (metrics.averageLatency < 1000) {
        score += 15;
        reasons.push('Low latency');
      }
      if (metrics.successRate > 0.95) {
        score += 10;
        reasons.push('High reliability');
      }
    }

    // Privacy scoring
    if (this.config.privacyFirst && provider.type === 'local') {
      score += 25;
      reasons.push('Privacy-first (local)');
    }

    // Cost scoring
    if (this.config.costOptimization) {
      if (provider.type === 'local') {
        score += 20;
        reasons.push('No API costs');
      } else if (provider.estimateCost) {
        const estimatedCost = await provider.estimateCost(1000);
        if (estimatedCost < 0.01) {
          score += 10;
          reasons.push('Low cost');
        }
      }
    }

    // Context window requirements
    const totalTokens = this.estimateTokenCount(request.messages);
    const hasAdequateContext = models.some((m) => m.contextLength >= totalTokens);
    if (!hasAdequateContext) {
      score -= 30;
      reasons.push('Insufficient context window');
    }

    return {
      provider: name,
      model: models[0]?.id || 'unknown',
      score,
      reasons,
    };
  }

  /**
   * Execute with fallback support
   */
  private async executeWithFallback(providerName: string, request: AIRequest): Promise<AIResponse> {
    const primaryProvider = this['providers'].get(providerName);

    if (!primaryProvider) {
      throw new AIProviderError(`Provider ${providerName} not found`, 'PROVIDER_NOT_FOUND');
    }

    try {
      // Track performance
      const startTime = Date.now();

      const response = await primaryProvider.chat(request.messages, request.options);

      // Update metrics
      this.updateMetrics(providerName, Date.now() - startTime, true);

      return response;
    } catch (error: unknown) {
      console.error(`Primary provider ${providerName} failed:`, error);

      // Update metrics
      this.updateMetrics(providerName, 0, false);

      // Try fallback if enabled
      if (this.config.fallbackEnabled) {
        return this.fallbackToNextProvider(providerName, request);
      }

      throw error;
    }
  }

  /**
   * Fallback to next available provider
   */
  private async fallbackToNextProvider(
    failedProvider: string,
    request: AIRequest,
  ): Promise<AIResponse> {
    const priorityOrder = this.config.priorityOrder || Array.from(this.providers.keys());
    const currentIndex = priorityOrder.indexOf(failedProvider);

    for (let i = currentIndex + 1; i < priorityOrder.length; i++) {
      const nextProvider = priorityOrder[i];
      if (!nextProvider) continue;
      const provider = this.providers.get(nextProvider);

      if (!provider) continue;

      try {
        if (await provider.validateConnection()) {
          console.log(`Falling back to ${nextProvider}`);
          return await provider.chat(request.messages, request.options);
        }
      } catch (error: unknown) {
        console.warn(`Fallback provider ${nextProvider} failed:`, error);
        continue;
      }
    }

    throw new AIProviderError('All providers failed', 'ALL_PROVIDERS_FAILED', undefined, true);
  }

  /**
   * Route to specific provider
   */
  private async routeToProvider(providerName: string, request: AIRequest): Promise<AIResponse> {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new AIProviderError(`Provider ${providerName} not found`, 'PROVIDER_NOT_FOUND');
    }

    if (!(await provider.validateConnection())) {
      throw new AIProviderError(`Provider ${providerName} not available`, 'PROVIDER_UNAVAILABLE');
    }

    return provider.chat(request.messages, request.options);
  }

  /**
   * Infer task type from request
   */
  private inferTaskType(request: AIRequest): TaskType {
    const lastMessage = request.messages[request.messages.length - 1]?.content;

    if (typeof lastMessage !== 'string') {
      return TaskType.CHAT;
    }

    const lowerContent = lastMessage.toLowerCase();

    // Code-related keywords
    if (
      lowerContent.includes('code') ||
      lowerContent.includes('function') ||
      lowerContent.includes('implement') ||
      lowerContent.includes('debug') ||
      lowerContent.includes('fix')
    ) {
      return TaskType.CODE_GENERATION;
    }

    // Review keywords
    if (
      lowerContent.includes('review') ||
      lowerContent.includes('check') ||
      lowerContent.includes('analyze')
    ) {
      return TaskType.CODE_REVIEW;
    }

    // Translation keywords
    if (lowerContent.includes('translate') || lowerContent.includes('translation')) {
      return TaskType.TRANSLATION;
    }

    // Summary keywords
    if (lowerContent.includes('summarize') || lowerContent.includes('summary')) {
      return TaskType.SUMMARIZATION;
    }

    // Creative writing keywords
    if (
      lowerContent.includes('write') ||
      lowerContent.includes('story') ||
      lowerContent.includes('creative')
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
      if (typeof message.content === 'string') {
        totalChars += message.content.length;
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text' && content.text) {
            totalChars += content.text.length;
          }
        }
      }
    }

    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(provider: string, latency: number, success: boolean): void {
    let metrics = this.performanceMetrics.get(provider);

    if (!metrics) {
      metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        totalLatency: 0,
        averageLatency: 0,
        successRate: 0,
      };
    }

    metrics['totalRequests']++;
    if (success) {
      metrics.successfulRequests++;
      metrics.totalLatency += latency;
    }

    metrics.averageLatency = metrics.totalLatency / Math.max(1, metrics.successfulRequests);
    metrics.successRate = metrics.successfulRequests / metrics['totalRequests'];

    this.performanceMetrics.set(provider, metrics);
  }

  /**
   * Get router statistics
   */
  public getStatistics(): Record<string, unknown> {
    const stats: Record<string, unknown> = {
      providers: {},
      totalRequests: 0,
      averageLatency: 0,
    };

    for (const [name, metrics] of this.performanceMetrics) {
      stats['providers'][name] = {
        requests: metrics['totalRequests'],
        successRate: `${(metrics.successRate * 100).toFixed(1)}%`,
        avgLatency: `${metrics.averageLatency.toFixed(0)}ms`,
      };
      stats['totalRequests'] += metrics['totalRequests'];
    }

    return stats;
  }

  /**
   * Clear performance metrics
   */
  public clearMetrics(): void {
    this.performanceMetrics.clear();
  }

  /**
   * Refresh provider connections
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
