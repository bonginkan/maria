/**
 * Groq Provider Implementation (Fast Inference)
 */

import { BaseProvider } from './base-provider';
import { AIRequest, AIResponse, ModelInfo } from '../types';

export class GroqProvider extends BaseProvider {
  name = 'groq';
  private modelsCache?: ModelInfo[];

  constructor(apiKey?: string) {
    super({ 
      apiKey, 
      apiBase: 'https://api.groq.com/openai/v1' 
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey || this.apiKey.startsWith('gsk_your-groq-')) {
      return false;
    }

    try {
      await this.makeRequest(`${this.apiBase}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
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
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        provider: this.name,
        description: 'Most capable Llama model with versatile performance',
        contextLength: 32768,
        capabilities: ['text', 'reasoning', 'code'],
        pricing: { input: 0.00059, output: 0.00079 },
        available: await this.isAvailable(),
        recommendedFor: ['complex_reasoning', 'coding', 'analysis']
      },
      {
        id: 'llama-3.2-90b-vision-preview',
        name: 'Llama 3.2 90B Vision',
        provider: this.name,
        description: 'Vision-capable Llama model for multimodal tasks',
        contextLength: 128000,
        capabilities: ['text', 'vision', 'reasoning'],
        pricing: { input: 0.0009, output: 0.0009 },
        available: await this.isAvailable(),
        recommendedFor: ['vision_tasks', 'multimodal', 'analysis']
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        provider: this.name,
        description: 'Mixture of experts model for balanced performance',
        contextLength: 32768,
        capabilities: ['text', 'reasoning', 'code'],
        pricing: { input: 0.00024, output: 0.00024 },
        available: await this.isAvailable(),
        recommendedFor: ['balanced_performance', 'multilingual']
      },
      {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        provider: this.name,
        description: 'Google\'s efficient open model',
        contextLength: 8192,
        capabilities: ['text', 'reasoning'],
        pricing: { input: 0.0002, output: 0.0002 },
        available: await this.isAvailable(),
        recommendedFor: ['quick_tasks', 'cost_effective']
      }
    ];

    this.modelsCache = models;
    return models;
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    if (!await this.isAvailable()) {
      throw new Error('Groq API not available');
    }

    const model = request.model || 'mixtral-8x7b-32768';
    const startTime = Date.now();

    const payload = {
      model,
      messages: request.messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 4000,
      stream: request.stream || false
    };

    if (request.stream) {
      const stream = await this.makeStreamRequest(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      return {
        stream,
        model,
        provider: this.name,
        responseTime: Date.now() - startTime
      };
    }

    const response = await this.makeRequest(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    return {
      content: response.choices[0]?.message?.content || '',
      model,
      provider: this.name,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      responseTime: Date.now() - startTime
    };
  }

  async vision(image: Buffer, prompt: string): Promise<AIResponse> {
    if (!await this.isAvailable()) {
      throw new Error('Groq API not available');
    }

    const base64Image = image.toString('base64');
    const startTime = Date.now();

    const payload = {
      model: 'llama-3.2-90b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 4000
    };

    const response = await this.makeRequest(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    return {
      content: response.choices[0]?.message?.content || '',
      model: 'llama-3.2-90b-vision-preview',
      provider: this.name,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      responseTime: Date.now() - startTime
    };
  }

  estimateCost(tokens: number, model = 'mixtral-8x7b-32768'): number {
    const pricing = {
      'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
      'llama-3.2-90b-vision-preview': { input: 0.0009, output: 0.0009 },
      'mixtral-8x7b-32768': { input: 0.00024, output: 0.00024 },
      'gemma2-9b-it': { input: 0.0002, output: 0.0002 }
    };

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['mixtral-8x7b-32768'];
    return tokens * 0.75 * modelPricing.input + tokens * 0.25 * modelPricing.output;
  }
}