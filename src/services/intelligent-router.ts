/**
 * Intelligent Router Service
 * Routes AI requests to optimal providers based on task type and priority
 */

import { AIRequest, AIResponse, PriorityMode, TaskType } from '../types';
import { AIProviderManager } from '../providers/manager';
import { ConfigManager } from '../config/config-manager';
import { getRecommendedModel } from '../config/models';

export class IntelligentRouter {
  private providerManager: AIProviderManager;
  private config: ConfigManager;

  constructor(providerManager: AIProviderManager, config: ConfigManager) {
    this.providerManager = providerManager;
    this.config = config;
  }

  async route(request: AIRequest): Promise<AIResponse> {
    // 1. Determine task type if not specified
    const taskType = request.taskType || this.detectTaskType(request);

    // 2. Get optimal provider and model
    const { providerName, modelId } = await this.selectOptimal(taskType, request);

    // 3. Get provider instance
    const provider = this.providerManager.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not available`);
    }

    // 4. Execute request
    let response: AIResponse | string;
    try {
      response = await provider.chat(request.messages);
    } catch {
      // Fallback for providers with different signatures
      response = await (
        provider as { chat: (messages: unknown, modelId: string) => Promise<string> }
      ).chat(request.messages, modelId);
    }
    if (typeof response === 'string') {
      return {
        content: response,
        model: modelId,
        provider: providerName,
      } as AIResponse;
    }
    return response;
  }

  async routeVision(image: Buffer, prompt: string): Promise<AIResponse> {
    const availableProviders = this.providerManager.getAvailableProviders();

    // Priority order for vision tasks
    const visionProviders = ['openai', 'anthropic', 'ollama', 'groq'];

    for (const providerName of visionProviders) {
      if (availableProviders.includes(providerName)) {
        const provider = this.providerManager.getProvider(providerName);
        if (provider?.vision) {
          try {
            const visionResponse = await provider.vision(image, prompt);
            return {
              content: visionResponse.description,
              model: 'vision-model',
              provider: providerName,
            } as AIResponse;
          } catch (error: unknown) {
            // Try next provider
            continue;
          }
        }
      }
    }

    throw new Error('No vision-capable providers available');
  }

  async routeCode(prompt: string, language?: string): Promise<AIResponse> {
    const request: AIRequest = {
      messages: [
        {
          role: 'user',
          content: language ? `Generate ${language} code: ${prompt}` : `Generate code: ${prompt}`,
        },
      ],
      taskType: 'coding',
    };

    return this.route(request);
  }

  private detectTaskType(request: AIRequest): TaskType {
    const content = request.messages
      .map((m) => m.content)
      .join(' ')
      .toLowerCase();

    // Simple keyword-based detection
    if (
      this.containsKeywords(content, [
        'code',
        'function',
        'class',
        'programming',
        'debug',
        'implement',
      ])
    ) {
      return 'coding';
    }

    if (
      this.containsKeywords(content, ['analyze', 'reason', 'solve', 'logic', 'problem', 'math'])
    ) {
      return 'reasoning';
    }

    if (this.containsKeywords(content, ['image', 'picture', 'visual', 'see', 'look', 'describe'])) {
      return 'vision';
    }

    if (this.containsKeywords(content, ['quick', 'fast', 'simple', 'brief'])) {
      return 'quick_tasks';
    }

    if (this.containsKeywords(content, ['cheap', 'cost', 'budget', 'affordable'])) {
      return 'cost_effective';
    }

    if (this.containsKeywords(content, ['private', 'local', 'offline', 'secure'])) {
      return 'privacy';
    }

    if (this.containsKeywords(content, ['japanese', 'chinese', 'korean', 'translate'])) {
      return 'multilingual';
    }

    if (this.containsKeywords(content, ['news', 'current', 'today', 'recent', 'latest'])) {
      return 'currentevents';
    }

    return 'chat';
  }

  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private async selectOptimal(
    taskType: TaskType,
    request: AIRequest,
  ): Promise<{ providerName: string; modelId: string }> {
    // 1. If provider/model specified, use that
    if (request.provider) {
      const availableProviders = this.providerManager.getAvailableProviders();
      if (!availableProviders.includes(request.provider)) {
        throw new Error(`Requested provider ${request.provider} not available`);
      }

      return {
        providerName: request.provider,
        modelId: request.model || (await this.getDefaultModelForProvider(request.provider)),
      };
    }

    // 2. Get priority mode
    const priorityMode = this.config.get('priority', 'auto') as PriorityMode;

    // 3. Select optimal provider
    const providerName = this.providerManager.selectOptimalProvider(taskType, priorityMode);
    if (!providerName) {
      throw new Error('No AI providers available');
    }

    // 4. Get recommended model for task
    const availableModels = await this.getModelsForProvider(providerName);
    const modelId =
      request.model || getRecommendedModel(taskType, availableModels) || availableModels[0];

    if (!modelId) {
      throw new Error(`No models available for provider ${providerName}`);
    }

    return { providerName, modelId };
  }

  private async getModelsForProvider(providerName: string): Promise<string[]> {
    const provider = this.providerManager.getProvider(providerName);
    if (!provider) {return [];}

    try {
      const models = await provider.getModels();
      // Handle both string[] and object[] responses
      if (typeof models[0] === 'string') {
        return models as string[];
      }
      return (models as unknown as Array<{ available: boolean; id: string }>)
        .filter((m) => m.available)
        .map((m) => m.id);
    } catch {
      return [];
    }
  }

  private async getDefaultModelForProvider(providerName: string): Promise<string> {
    const models = await this.getModelsForProvider(providerName);
    return models[0] || 'default';
  }

  updatePriorityMode(mode: PriorityMode): void {
    this.config.set('priority', mode);
  }
}
