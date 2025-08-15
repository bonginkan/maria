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
  async vision(_image: Buffer, _prompt: string): Promise<AIResponse> {
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

  estimateCost(_tokens: number): number {
    return 0; // Free by default (local providers)
  }

  protected async makeRequest(url: string, options: unknown): Promise<unknown> {
    const fetch = (await import('node-fetch')).default;
    const typedOptions = options as Record<string, unknown>;

    const response = await fetch(url, {
      ...typedOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(typedOptions['headers'] as Record<string, string>),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  protected async makeStreamRequest(
    url: string,
    options: Record<string, unknown> & { headers?: Record<string, unknown> },
  ): Promise<AsyncGenerator<string>> {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, unknown>),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API error: ${response.status} ${error}`);
    }

    return this.parseStreamResponse(response);
  }

  private async *parseStreamResponse(response: unknown): AsyncGenerator<string> {
    const typedResponse = response as {
      body?: { getReader(): ReadableStreamDefaultReader<Uint8Array> };
    };
    const reader = typedResponse.body?.getReader();
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
              const parsed = JSON.parse(data) as Record<string, unknown>;
              const content = this.extractStreamContent(parsed);
              if (content) yield content;
            } catch (e: unknown) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  protected extractStreamContent(data: unknown): string | null {
    // Override in subclasses for provider-specific parsing
    const typedData = data as { choices?: Array<{ delta?: { content?: string } }> };
    return typedData?.choices?.[0]?.delta?.content || null;
  }

  protected createModelInfo(model: unknown): ModelInfo {
    const typedModel = model as Record<string, unknown>;
    return {
      id: typedModel['id'] as string,
      name: (typedModel['name'] as string) || (typedModel['id'] as string),
      provider: this.name,
      description: (typedModel['description'] as string) || '',
      contextLength: (typedModel['context_length'] as number) || 4096,
      capabilities: (typedModel['capabilities'] as string[]) || ['text'],
      pricing: typedModel['pricing'] as { input: number; output: number } | undefined,
      local: (typedModel['local'] as boolean) || false,
      available: true,
      memoryRequired: typedModel['memory_required'] as string | undefined,
      recommendedFor: (typedModel['recommended_for'] as string[]) || ['general_purpose'],
    };
  }
}
