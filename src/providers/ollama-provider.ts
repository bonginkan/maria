import {
  BaseAIProvider,
  CodeReviewResult,
  CompletionOptions,
  Message,
} from "./ai-provider.js";
import fetch from "node-fetch";

interface OllamaConfig {
  apiBase?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class OllamaProvider extends BaseAIProvider {
  readonly name = "Ollama";
  readonly models = [
    "llama3.2:3b",
    "llama3.2:1b",
    "qwen2.5:7b",
    "qwen2.5:14b",
    "qwen2.5:32b",
    "qwen2.5-vl:7b",
    "codellama:7b",
    "codellama:13b",
    "codellama:34b",
    "deepseek-coder:6.7b",
    "deepseek-coder:33b",
    "phi3.5:3.8b",
    "phi3.5:14b",
    "mistral:7b",
    "mixtral:8x7b",
    "nomic-embed-text",
  ];

  private apiBase: string = "http://localhost:11434";
  private timeout: number = 300000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private isHealthy: boolean = false;
  private availableModels: string[] = [];

  override async initialize(
    apiKey: string = "ollama",
    config?: Record<string, unknown>,
  ): Promise<void> {
    await super.initialize(apiKey, config);

    const _ollamaConfig = config as OllamaConfig;
    this.apiBase =
      _ollamaConfig?.apiBase ||
      process.env["OLLAMA_API_BASE"] ||
      "http://localhost:11434";
    this.timeout =
      _ollamaConfig?.timeout ||
      parseInt(process.env["OLLAMA_TIMEOUT"] || "300000");
    this.retryAttempts =
      _ollamaConfig?.retryAttempts ||
      parseInt(process.env["OLLAMA_RETRY_ATTEMPTS"] || "3");
    this.retryDelay =
      _ollamaConfig?.retryDelay ||
      parseInt(process.env["OLLAMA_RETRY_DELAY"] || "1000");

    // Check health and get available models
    await this.checkHealth();
    if (this.isHealthy) {
      await this.fetchAvailableModels();
    }
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const _response = await fetch(`${this.apiBase}/api/version`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      this.isHealthy = _response.ok;
      return this.isHealthy;
    } catch {
      this.isHealthy = false;
      return false;
    }
  }

  private async fetchAvailableModels(): Promise<void> {
    try {
      const _response = await fetch(`${this.apiBase}/api/tags`, {
        method: "GET",
      });

      if (_response.ok) {
        const _data = (await _response.json()) as {
          models?: Array<{ name: string }>;
        };
        this.availableModels = _data.models?.map((model) => model.name) || [];
      }
    } catch {
      // Silently fail - Ollama might not be _running
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
      } catch (_error: unknown) {
        if (i === attempts - 1) {
          throw _error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * Math.pow(2, i)),
        );
      }
    }
    throw new Error("Max retry attempts reached");
  }

  async chat(
    _messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): Promise<string> {
    this.ensureInitialized();
    const _selectedModel = model || this.getDefaultModel();

    // Convert to Ollama format
    const _prompt = this.messagesToPrompt(_messages);

    const _payload = {
      model: _selectedModel,
      _prompt,
      stream: false,
      options: {
        temperature: options?.temperature || 0.7,
        topp: options?.topP || 0.95,
        stop: options?.stopSequences,
        numpredict: options?.maxTokens || 4096,
      },
    };

    const _makeRequest = async () => {
      const _response = await fetch(`${this.apiBase}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(_payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!_response.ok) {
        const _errorData = await _response.text();
        throw new Error(
          `Ollama API _error: ${_response.statusText} - ${_errorData}`,
        );
      }

      return _response;
    };

    const _response = await this.retryWithBackoff(_makeRequest);
    const _data = (await _response.json()) as { _response?: string };
    return _data._response || "";
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const _selectedModel = model || this.getDefaultModel();

    // Convert to Ollama format
    const _prompt = this.messagesToPrompt(messages);

    const _payload = {
      model: _selectedModel,
      _prompt,
      stream: true,
      options: {
        temperature: options?.temperature || 0.7,
        topp: options?.topP || 0.95,
        stop: options?.stopSequences,
        numpredict: options?.maxTokens || 4096,
      },
    };

    const _makeRequest = async () => {
      const _response = await fetch(`${this.apiBase}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(_payload),
        signal:
          options?.streamOptions?.signal || AbortSignal.timeout(this.timeout),
      });

      if (!_response.ok) {
        const _errorData = await _response.text();
        throw new Error(
          `Ollama API _error: ${_response.statusText} - ${_errorData}`,
        );
      }

      return _response;
    };

    const _response = await this.retryWithBackoff(_makeRequest);
    const _nodeResponse = _response as unknown as {
      body?: { getReader(): ReadableStreamDefaultReader<Uint8Array> };
    }; // Node.js fetch _response
    const _reader = _nodeResponse.body?.getReader();
    if (!_reader) {
      throw new Error("No _response body");
    }

    const _decoder = new TextDecoder();
    let buffer = "";

    try {
      const _running = true;
      while (_running) {
        const { done, value } = await _reader.read();
        if (done) {
          break;
        }

        buffer += _decoder.decode(value, { stream: true });
        const _lines = buffer.split("\n");
        buffer = _lines.pop() || "";

        for (const line of _lines) {
          if (line.trim()) {
            try {
              const _parsed = JSON.parse(line) as Record<string, unknown>;
              const _content = _parsed["_response"] as string;
              if (_content) {
                yield _content;
                if (options?.streamOptions?.onToken) {
                  options.streamOptions.onToken(_content);
                }
              }
              if (_parsed["done"]) {
                return;
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

  private messagesToPrompt(messages: Message[]): string {
    // Convert messages to a single _prompt for Ollama
    let _prompt = "";

    for (const message of messages) {
      if (message.role === "system") {
        _prompt += `System: ${message.content}\n\n`;
      } else if (message.role === "user") {
        _prompt += `User: ${message.content}\n\n`;
      } else if (message.role === "assistant") {
        _prompt += `Assistant: ${message.content}\n\n`;
      }
    }

    _prompt += "Assistant: ";
    return _prompt;
  }

  async generateCode(
    _prompt: string,
    language: string = "typescript",
    model?: string,
  ): Promise<string> {
    const messages: Message[] = [
      {
        role: "system",
        _content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`,
      },
      {
        role: "user",
        _content: _prompt,
      },
    ];

    return this.chat(messages, model, { temperature: 0.2, maxTokens: 8192 });
  }

  async reviewCode(
    code: string,
    language: string = "typescript",
    model?: string,
  ): Promise<CodeReviewResult> {
    const messages: Message[] = [
      {
        role: "system",
        _content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your _response as JSON with the following structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "_error" | "warning" | "info",
      "message": "<issue description>",
      "suggestion": "<optional fix suggestion>"
    }
  ],
  "summary": "<overall code quality summary>",
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>", ...]
}`,
      },
      {
        role: "user",
        _content: code,
      },
    ];

    const _response = await this.chat(messages, model, {
      temperature: 0.1,
      maxTokens: 4096,
    });

    try {
      return JSON.parse(_response) as CodeReviewResult;
    } catch {
      // Fallback if JSON parsing fails
      return {
        issues: [],
        summary: _response,
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
    const _response = await fetch(`${this.apiBase}/api/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(600000), // 10 minutes for model download
    });

    if (!_response.ok) {
      const _errorData = await _response.text();
      throw new Error(`Failed to pull model ${modelName}: ${_errorData}`);
    }

    // Wait for pull completion (streaming _response)
    const _nodeResponse = _response as unknown as {
      body?: { getReader(): ReadableStreamDefaultReader<Uint8Array> };
    };
    const _reader = _nodeResponse.body?.getReader();
    if (!_reader) {
      return;
    }

    const _decoder = new TextDecoder();
    let buffer = "";

    try {
      const _running = true;
      while (_running) {
        const { done, value } = await _reader.read();
        if (done) {
          break;
        }

        buffer += _decoder.decode(value, { stream: true });
        const _lines = buffer.split("\n");
        buffer = _lines.pop() || "";

        for (const line of _lines) {
          if (line.trim()) {
            try {
              const _parsed = JSON.parse(line) as Record<string, unknown>;
              if (_parsed["status"] === "success") {
                return;
              }
              if (_parsed["_error"]) {
                throw new Error(`Model pull failed: ${_parsed["_error"]}`);
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
    const _response = await fetch(`${this.apiBase}/api/delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: modelName }),
    });

    if (!_response.ok) {
      const _errorData = await _response.text();
      throw new Error(`Failed to delete model ${modelName}: ${_errorData}`);
    }
  }
}
