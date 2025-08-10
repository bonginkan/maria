import { BaseAIProvider, Message, CompletionOptions, CodeReviewResult } from './ai-provider.js';
import fetch from 'node-fetch';

interface VLLMConfig {
  apiBase?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  timeout?: number;
  stopSequences?: string[];
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export class VLLMProvider extends BaseAIProvider {
  readonly name = 'vLLM';
  readonly models = [
    'stabilityai/japanese-stablelm-2-instruct-1_6b',
    'mistralai/Mistral-7B-v0.1',
    'mistralai/Mistral-7B-Instruct-v0.1',
    'meta-llama/Llama-2-7b-hf',
    'meta-llama/Llama-2-7b-chat-hf',
    'meta-llama/Llama-2-13b-hf',
    'meta-llama/Llama-2-13b-chat-hf',
    'codellama/CodeLlama-7b-hf',
    'codellama/CodeLlama-13b-hf'
  ];

  private apiBase: string = 'http://localhost:8000/v1';
  private timeout: number = 120000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private isHealthy: boolean = false;
  private availableModels: string[] = [];
  private vllmConfig: VLLMConfig = {};

  async initialize(apiKey: string = 'vllm-local', config?: Record<string, any>): Promise<void> {
    await super.initialize(apiKey, config);
    
    this.vllmConfig = config as VLLMConfig || {};
    this.apiBase = this.vllmConfig.apiBase || process.env.VLLM_API_BASE || 'http://localhost:8000/v1';
    this.timeout = this.vllmConfig.timeout || parseInt(process.env.VLLM_TIMEOUT || '120000');

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
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: AbortSignal.timeout(5000)
      });

      this.isHealthy = response.ok;
      return this.isHealthy;
    } catch {
      console.warn('vLLM server not reachable');
      this.isHealthy = false;
      return false;
    }
  }

  private async fetchAvailableModels(): Promise<void> {
    try {
      const response = await fetch(`${this.apiBase}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json() as any;
        this.availableModels = data.data?.map((model: any) => model.id) || [];
      }
    } catch {
      console.warn('Failed to fetch available models');
    }
  }

  getModels(): string[] {
    // Return available models if we have them, otherwise return default list
    return this.availableModels.length > 0 ? this.availableModels : this.models;
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempts: number = this.retryAttempts
  ): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, i)));
      }
    }
    throw new Error('Max retry attempts reached');
  }

  async chat(messages: Message[], model?: string, options?: CompletionOptions): Promise<string> {
    this.ensureInitialized();
    const selectedModel = model || this.getDefaultModel();

    const payload = {
      model: selectedModel,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      max_tokens: options?.maxTokens || this.vllmConfig.maxTokens || 2048,
      temperature: options?.temperature || this.vllmConfig.temperature || 0.7,
      top_p: options?.topP || this.vllmConfig.topP || 0.95,
      top_k: this.vllmConfig.topK || 50,
      frequency_penalty: this.vllmConfig.frequencyPenalty || 0,
      presence_penalty: this.vllmConfig.presencePenalty || 0,
      stop: options?.stopSequences || this.vllmConfig.stopSequences,
      stream: false
    };

    const makeRequest = async () => {
      const response = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`vLLM API error: ${response.statusText} - ${errorData}`);
      }

      return response;
    };

    const response = await this.retryWithBackoff(makeRequest);
    const data = await response.json() as any;
    return data.choices[0]?.message?.content || '';
  }

  async *chatStream(messages: Message[], model?: string, options?: CompletionOptions): AsyncGenerator<string> {
    this.ensureInitialized();
    const selectedModel = model || this.getDefaultModel();

    const payload = {
      model: selectedModel,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      max_tokens: options?.maxTokens || this.vllmConfig.maxTokens || 2048,
      temperature: options?.temperature || this.vllmConfig.temperature || 0.7,
      top_p: options?.topP || this.vllmConfig.topP || 0.95,
      top_k: this.vllmConfig.topK || 50,
      frequency_penalty: this.vllmConfig.frequencyPenalty || 0,
      presence_penalty: this.vllmConfig.presencePenalty || 0,
      stop: options?.stopSequences || this.vllmConfig.stopSequences,
      stream: true
    };

    const makeRequest = async () => {
      const response = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: options?.streamOptions?.signal || AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`vLLM API error: ${response.statusText} - ${errorData}`);
      }

      return response;
    };

    const response = await this.retryWithBackoff(makeRequest);
    const nodeResponse = response as any; // Node.js fetch response
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
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
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

  async generateCode(prompt: string, language: string = 'typescript', model?: string): Promise<string> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    return this.chat(messages, model, { temperature: 0.2, maxTokens: 4096 });
  }

  async reviewCode(code: string, language: string = 'typescript', model?: string): Promise<CodeReviewResult> {
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
}`
      },
      {
        role: 'user',
        content: code
      }
    ];

    const response = await this.chat(messages, model, { temperature: 0.1, maxTokens: 4096 });

    try {
      return JSON.parse(response);
    } catch {
      // Fallback if JSON parsing fails
      return {
        issues: [],
        summary: response,
        improvements: []
      };
    }
  }

  // vLLM specific methods
  async isServerRunning(): Promise<boolean> {
    return await this.checkHealth();
  }

  async getAvailableModels(): Promise<string[]> {
    await this.fetchAvailableModels();
    return this.availableModels;
  }

  async selectModelForTask(task: 'japanese' | 'code' | 'general' | 'fast'): Promise<string> {
    const availableModels = await this.getAvailableModels();
    
    switch (task) {
      case 'japanese':
        // Prefer Japanese-specific models
        const japaneseModels = availableModels.filter(m => 
          m.includes('japanese') || m.includes('jp')
        );
        if (japaneseModels.length > 0 && japaneseModels[0]) {
          return japaneseModels[0];
        }
        break;
        
      case 'code':
        // Prefer code-optimized models
        const codeModels = availableModels.filter(m => 
          m.includes('code') || m.includes('instruct')
        );
        if (codeModels.length > 0 && codeModels[0]) {
          return codeModels[0];
        }
        break;
        
      case 'fast':
        // Prefer smaller models for speed
        const smallModels = availableModels.filter(m => 
          m.includes('1_6b') || m.includes('1.6b') || m.includes('7b')
        );
        if (smallModels.length > 0 && smallModels[0]) {
          return smallModels[0];
        }
        break;
    }
    
    // Default to first available model
    return availableModels[0] || this.getDefaultModel();
  }
}