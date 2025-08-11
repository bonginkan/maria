/**
 * Base AI Provider Class
 */

import { AIProvider, AIRequest, AIResponse, ModelInfo } from '../types';

export abstract class BaseProvider implements AIProvider {
  abstract name: string;
  protected apiKey?: string;
  protected apiBase?: string;

  constructor(config: { apiKey?: string; apiBase?: string } = {}) {
    this.apiKey = config.apiKey;
    this.apiBase = config.apiBase;
  }

  abstract isAvailable(): Promise<boolean>;
  abstract getModels(): Promise<ModelInfo[]>;
  abstract chat(request: AIRequest): Promise<AIResponse>;

  // Optional methods with default implementations
  async vision(image: Buffer, prompt: string): Promise<AIResponse> {
    throw new Error(`${this.name} does not support vision tasks`);
  }

  async generateCode(prompt: string, language?: string): Promise<AIResponse> {
    const codePrompt = language
      ? `Generate ${language} code for: ${prompt}`
      : `Generate code for: ${prompt}`;

    return this.chat({
      messages: [{ role: 'user', content: codePrompt }],
      taskType: 'coding',
    });
  }

  estimateCost(tokens: number): number {
    return 0; // Free by default (local providers)
  }

  protected async makeRequest(url: string, options: any): Promise<any> {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  protected async makeStreamRequest(url: string, options: any): Promise<AsyncGenerator<string>> {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API error: ${response.status} ${error}`);
    }

    return this.parseStreamResponse(response);
  }

  private async *parseStreamResponse(response: any): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = this.extractStreamContent(parsed);
              if (content) yield content;
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  protected extractStreamContent(data: any): string | null {
    // Override in subclasses for provider-specific parsing
    return data?.choices?.[0]?.delta?.content || null;
  }

  protected createModelInfo(model: any): ModelInfo {
    return {
      id: model.id,
      name: model.name || model.id,
      provider: this.name,
      description: model.description || '',
      contextLength: model.context_length || 4096,
      capabilities: model.capabilities || ['text'],
      pricing: model.pricing,
      local: model.local || false,
      available: true,
      memoryRequired: model.memory_required,
      recommendedFor: model.recommended_for || ['general_purpose'],
    };
  }
}
