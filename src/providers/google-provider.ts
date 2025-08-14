/**
 * Google AI Provider Implementation
 */

import { BaseProvider } from './base-provider';
import { AIRequest, AIResponse, ModelInfo } from '../types';

export class GoogleProvider extends BaseProvider {
  name = 'google';
  private modelsCache?: ModelInfo[];

  constructor(apiKey?: string) {
    super({
      apiKey,
      apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey || this.apiKey.startsWith('your-gemini-')) {
      return false;
    }

    try {
      await this.makeRequest(`${this.apiBase}/models?key=${this.apiKey}`, {
        method: 'GET',
      });
      return true;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    if (this.modelsCache) return this.modelsCache;

    const models: ModelInfo[] = [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: this.name,
        description: 'Most capable Gemini model',
        contextLength: 128000,
        capabilities: ['text', 'vision', 'code', 'multimodal'],
        pricing: { input: 0.0025, output: 0.01 },
        available: await this.isAvailable(),
        recommendedFor: ['complex_tasks', 'multimodal', 'analysis'],
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: this.name,
        description: 'Fast and efficient Gemini model',
        contextLength: 32000,
        capabilities: ['text', 'vision', 'code'],
        pricing: { input: 0.0001, output: 0.0004 },
        available: await this.isAvailable(),
        recommendedFor: ['quick_tasks', 'cost_effective', 'general_use'],
      },
    ];

    this.modelsCache = models;
    return models;
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    if (!(await this.isAvailable())) {
      throw new Error('Google AI API not available');
    }

    const model = request.model || 'gemini-2.5-flash';
    const startTime = Date.now();

    const payload = {
      contents: [
        {
          parts: [{ text: request.messages.map((m) => `${m.role}: ${m.content}`).join('\n') }],
        },
      ],
      generationConfig: {
        temperature: request.temperature || 0.7,
        maxOutputTokens: request.maxTokens || 4000,
      },
    };

    const response = (await this.makeRequest(
      `${this.apiBase}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

    return {
      content: response.candidates?.[0]?.content?.parts?.[0]?.text || '',
      model,
      provider: this.name,
      responseTime: Date.now() - startTime,
    };
  }

  override estimateCost(tokens: number, model = 'gemini-2.5-flash'): number {
    const pricing = {
      'gemini-2.5-pro': { input: 0.0025, output: 0.01 },
      'gemini-2.5-flash': { input: 0.0001, output: 0.0004 },
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-1.5-flash': { input: 0.00005, output: 0.00015 },
    };

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['gemini-2.5-flash'];
    return tokens * 0.75 * modelPricing.input + tokens * 0.25 * modelPricing.output;
  }
}
