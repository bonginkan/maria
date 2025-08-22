import { BaseAIProvider, Message, CompletionOptions, CodeReviewResult } from './ai-provider.js';
import fetch from 'node-fetch';

interface OllamaConfig {
  apiBase?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class OllamaProvider extends BaseAIProvider {
  readonly name = 'Ollama';
  readonly models = [
    'llama3.2:3b',
    'llama3.2:1b',
    'qwen2.5:7b',
    'qwen2.5:14b',
    'qwen2.5:32b',
    'qwen2.5-vl:7b',
    'codellama:7b',
    'codellama:13b',
    'codellama:34b',
    'deepseek-coder:6.7b',
    'deepseek-coder:33b',
    'phi3.5:3.8b',
    'phi3.5:14b',
    'mistral:7b',
    'mixtral:8x7b',
    'nomic-embed-text',
  ];

  private apiBase: string = 'http://localhost:11434';
  private timeout: number = 300000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private isHealthy: boolean = false;
  private availableModels: string[] = [];

  override async initialize(
    apiKey: string = 'ollama',
    config?: Record<string, unknown>,
  ): Promise<void> {
    await super.initialize(apiKey, config);

    const ollamaConfig = config as OllamaConfig;
    this.apiBase =
      ollamaConfig?.apiBase || process.env['OLLAMA_API_BASE'] || 'http://localhost:11434';
    this.timeout = ollamaConfig?.timeout || parseInt(process.env['OLLAMA_TIMEOUT'] || '300000');
    this.retryAttempts =
      ollamaConfig?.retryAttempts || parseInt(process.env['OLLAMA_RETRY_ATTEMPTS'] || '3');
    this.retryDelay =
      ollamaConfig?.retryDelay || parseInt(process.env['OLLAMA_RETRY_DELAY'] || '1000');

    // Check health and get available models
    await this.checkHealth();
    if (this.isHealthy) {
      await this.fetchAvailableModels();
    }
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      this.isHealthy = response.ok;
      return this.isHealthy;
    } catch {
      this.isHealthy = false;
      return false;
    }
  }

  private async fetchAvailableModels(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBase}/api/tags`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = (await response.json()) as { models?: Array<{ name: string }> };
        this.availableModels = data.models?.map((model) => model.name) || [];
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

    // Convert to Ollama format
    const prompt = this.messagesToPrompt(messages);

    const payload = {
      model: selectedModel,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options?.temperature || 0.7,
        top_p: options?.topP || 0.95,
        stop: options?.stopSequences,
        num_predict: options?.maxTokens || 4096,
      },
    };

    const makeRequest = async () => {
      const response = await fetch(`${this.apiBase}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Ollama API error: ${response.statusText} - ${errorData}`);
      }

      return response;
    };

    const response = await this.retryWithBackoff(makeRequest);
    const data = (await response.json()) as { response?: string };
    return data.response || '';
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const selectedModel = model || this.getDefaultModel();

    // Convert to Ollama format
    const prompt = this.messagesToPrompt(messages);

    const payload = {
      model: selectedModel,
      prompt: prompt,
      stream: true,
      options: {
        temperature: options?.temperature || 0.7,
        top_p: options?.topP || 0.95,
        stop: options?.stopSequences,
        num_predict: options?.maxTokens || 4096,
      },
    };

    const makeRequest = async () => {
      const response = await fetch(`${this.apiBase}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: options?.streamOptions?.signal || AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Ollama API error: ${response.statusText} - ${errorData}`);
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
      const running = true;
      while (running) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line) as Record<string, unknown>;
              const content = parsed['response'] as string;
              if (content) {
                yield content;
                if (options?.streamOptions?.onToken) {
                  options.streamOptions.onToken(content);
                }
              }
              if (parsed['done']) return;
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

  private messagesToPrompt(messages: Message[]): string {
    // Convert messages to a single prompt for Ollama
    let prompt = '';

    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `User: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }

    prompt += 'Assistant: ';
    return prompt;
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

  // IAIProvider interface method
  async validateConnection(): Promise<boolean> {
    return await this.checkHealth();
  }

  // Ollama specific methods
  async isServerRunning(): Promise<boolean> {
    return await this.checkHealth();
  }

  async getAvailableModels(): Promise<string[]> {
    await this.fetchAvailableModels();
    return this.availableModels;
  }

  async pullModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(600000), // 10 minutes for model download
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to pull model ${modelName}: ${errorData}`);
    }

    // Wait for pull completion (streaming response)
    const nodeResponse = response as unknown as {
      body?: { getReader(): ReadableStreamDefaultReader<Uint8Array> };
    };
    const reader = nodeResponse.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      const running = true;
      while (running) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line) as Record<string, unknown>;
              if (parsed['status'] === 'success') return;
              if (parsed['error']) {
                throw new Error(`Model pull failed: ${parsed['error']}`);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to delete model ${modelName}: ${errorData}`);
    }
  }
}
