import { BaseAIProvider, Message, CompletionOptions, CodeReviewResult } from './ai-provider.js';
import fetch from 'node-fetch';

interface LMStudioConfig {
  apiBase?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class LMStudioProvider extends BaseAIProvider {
  readonly name = 'LMStudio';
  readonly models = [
    'gpt-oss-120b',
    'gpt-oss-20b',
    'qwen3-30b',
    'llama-3-70b',
    'mistral-7b',
    'codellama-34b',
  ];

  private apiBase: string = 'http://localhost:1234/v1';
  private timeout: number = 300000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private isHealthy: boolean = false;
  private availableModels: string[] = [];

  override async initialize(
    apiKey: string = 'lm-studio',
    config?: Record<string, unknown>,
  ): Promise<void> {
    await super.initialize(apiKey, config);

    const lmConfig = config as LMStudioConfig;
    this.apiBase =
      lmConfig?.apiBase || process.env['LMSTUDIO_API_BASE'] || 'http://localhost:1234/v1';
    this.timeout = lmConfig?.timeout || parseInt(process.env['LMSTUDIO_TIMEOUT'] || '300000');
    this.retryAttempts =
      lmConfig?.retryAttempts || parseInt(process.env['LMSTUDIO_RETRY_ATTEMPTS'] || '3');
    this.retryDelay =
      lmConfig?.retryDelay || parseInt(process.env['LMSTUDIO_RETRY_DELAY'] || '1000');

    // Check health and get available models
    await this.checkHealth();
    if (this.isHealthy) {
      await this.fetchAvailableModels();
    }
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      this.isHealthy = response.ok;
      return this.isHealthy;
    } catch {
      console.warn('LM Studio server not reachable');
      this.isHealthy = false;
      return false;
    }
  }

  private async fetchAvailableModels(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBase}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { data: Array<{ id: string }> };
        this.availableModels = data.data.map((model) => model.id);
      }
    } catch {
      console.warn('Failed to fetch available models');
    }
  }

  override getModels(): string[] {
    // Return available models if we have them, otherwise return default list
    return this.availableModels.length > 0 ? this.availableModels : this.models;
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempts: number = this.retryAttempts,
  ): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error: unknown) {
        if (i === attempts - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay * Math.pow(2, i)));
      }
    }
    throw new Error('Max retry attempts reached');
  }

  async chat(messages: Message[], model?: string, options?: CompletionOptions): Promise<string> {
    this.ensureInitialized();
    const selectedModel = model || this.getDefaultModel();

    const payload = {
      model: selectedModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      top_p: options?.topP || 0.95,
      stop: options?.stopSequences,
      stream: false,
    };

    const makeRequest = async () => {
      const response = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`LM Studio API error: ${response.statusText} - ${errorData}`);
      }

      return response;
    };

    const response = await this.retryWithBackoff(makeRequest);
    const data = (await response.json()) as { choices: Array<{ message?: { content?: string } }> };
    return data.choices[0]?.message?.content || '';
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const selectedModel = model || this.getDefaultModel();

    const payload = {
      model: selectedModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      top_p: options?.topP || 0.95,
      stop: options?.stopSequences,
      stream: true,
    };

    const makeRequest = async () => {
      const response = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: options?.streamOptions?.signal || AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`LM Studio API error: ${response.statusText} - ${errorData}`);
      }

      return response;
    };

    const response = await this.retryWithBackoff(makeRequest);
    const nodeResponse = response as unknown as {
      body?: { getReader(): ReadableStreamDefaultReader<Uint8Array> };
    }; // Node.js fetch response
    const reader = nodeResponse.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;
              const choices = parsed['choices'] as Array<{ delta?: { content?: string } }>;
              const content = choices?.[0]?.delta?.content;
              if (content) {
                yield content;
                if (options?.streamOptions?.onToken) {
                  options.streamOptions.onToken(content);
                }
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }

        // Check for abort signal
        if (options?.streamOptions?.signal?.aborted) {
          break;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async generateCode(
    prompt: string,
    language: string = 'typescript',
    model?: string,
  ): Promise<string> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    return this.chat(messages, model, { temperature: 0.2, maxTokens: 8192 });
  }

  async reviewCode(
    code: string,
    language: string = 'typescript',
    model?: string,
  ): Promise<CodeReviewResult> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your response as JSON with the following structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description>",
      "suggestion": "<optional fix suggestion>"
    }
  ],
  "summary": "<overall code quality summary>",
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>", ...]
}`,
      },
      {
        role: 'user',
        content: code,
      },
    ];

    const response = await this.chat(messages, model, { temperature: 0.1, maxTokens: 4096 });

    try {
      return JSON.parse(response) as CodeReviewResult;
    } catch {
      // Fallback if JSON parsing fails
      return {
        issues: [],
        summary: response,
        improvements: [],
      };
    }
  }

  // LM Studio specific methods
  async isServerRunning(): Promise<boolean> {
    return await this.checkHealth();
  }

  async getAvailableModels(): Promise<string[]> {
    await this.fetchAvailableModels();
    return this.availableModels;
  }

  async switchModel(modelType: '120b' | '20b'): Promise<void> {
    if (modelType === '120b') {
      this.config['model'] = 'gpt-oss-120b';
    } else {
      this.config['model'] = 'gpt-oss-20b';
    }
  }
}
