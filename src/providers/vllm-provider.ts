import {
  BaseAIProvider,
  CodeReviewResult,
  CompletionOptions,
  Message,
} from "./ai-provider.js";
import fetch from "node-fetch";

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
  readonly name = "vLLM";
  readonly models = [
    "stabilityai/japanese-stablelm-2-instruct-1_6b",
    "mistralai/Mistral-7B-v0.1",
    "mistralai/Mistral-7B-Instruct-v0.1",
    "meta-llama/Llama-2-7b-hf",
    "meta-llama/Llama-2-7b-chat-hf",
    "meta-llama/Llama-2-13b-hf",
    "meta-llama/Llama-2-13b-chat-hf",
    "codellama/CodeLlama-7b-hf",
    "codellama/CodeLlama-13b-hf",
  ];

  private apiBase: string = "http://localhost:8000/v1";
  private timeout: number = 120000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private isHealthy: boolean = false;
  private _availableModels: string[] = [];
  private vllmConfig: VLLMConfig = {};

  override async initialize(
    apiKey: string = "vllm-local",
    config?: Record<string, unknown>,
  ): Promise<void> {
    await super.initialize(apiKey, config);

    this.vllmConfig = (config as VLLMConfig) || {};
    this.apiBase =
      this.vllmConfig.apiBase ||
      process.env["VLLM_API_BASE"] ||
      "http://localhost:8000/v1";
    this.timeout =
      this.vllmConfig.timeout ||
      parseInt(process.env["VLLM_TIMEOUT"] || "120000");

    // Check health and get available models
    await this.checkHealth();
    if (this.isHealthy) {
      await this.fetchAvailableModels();
    }
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const _response = await fetch(`${this.apiBase}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
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
      const _response = await fetch(`${this.apiBase}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (_response.ok) {
        const _data = (await _response.json()) as {
          _data?: Array<{ id: string }>;
        };
        this.availableModels = _data._data?.map((model) => model.id) || [];
      }
    } catch {
      // Silently fail - vLLM might not be running
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

    const _payload = {
      model: _selectedModel,
      _messages: _messages.map((m) => ({
        role: m.role,
        _content: m.content,
      })),
      maxtokens: options?.maxTokens || this.vllmConfig.maxTokens || 2048,
      temperature: options?.temperature || this.vllmConfig.temperature || 0.7,
      topp: options?.topP || this.vllmConfig.topP || 0.95,
      topk: this.vllmConfig.topK || 50,
      frequencypenalty: this.vllmConfig.frequencyPenalty || 0,
      presencepenalty: this.vllmConfig.presencePenalty || 0,
      stop: options?.stopSequences || this.vllmConfig.stopSequences,
      stream: false,
    };

    const _makeRequest = async () => {
      const _response = await fetch(`${this.apiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(_payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!_response.ok) {
        const _errorData = await _response.text();
        throw new Error(
          `vLLM API _error: ${_response.statusText} - ${_errorData}`,
        );
      }

      return _response;
    };

    const _response = await this.retryWithBackoff(_makeRequest);
    const _data = (await _response.json()) as {
      choices?: Array<{ message?: { _content?: string } }>;
    };
    return _data.choices?.[0]?.message?.content || "";
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const _selectedModel = model || this.getDefaultModel();

    const _payload = {
      model: _selectedModel,
      messages: messages.map((m) => ({
        role: m.role,
        _content: m._content,
      })),
      maxtokens: options?.maxTokens || this.vllmConfig.maxTokens || 2048,
      temperature: options?.temperature || this.vllmConfig.temperature || 0.7,
      topp: options?.topP || this.vllmConfig.topP || 0.95,
      topk: this.vllmConfig.topK || 50,
      frequencypenalty: this.vllmConfig.frequencyPenalty || 0,
      presencepenalty: this.vllmConfig.presencePenalty || 0,
      stop: options?.stopSequences || this.vllmConfig.stopSequences,
      stream: true,
    };

    const _makeRequest = async () => {
      const _response = await fetch(`${this.apiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(_payload),
        signal:
          options?.streamOptions?.signal || AbortSignal.timeout(this.timeout),
      });

      if (!_response.ok) {
        const _errorData = await _response.text();
        throw new Error(
          `vLLM API _error: ${_response.statusText} - ${_errorData}`,
        );
      }

      return _response;
    };

    const _response = await this.retryWithBackoff(_makeRequest);
    const _nodeResponse = _response as unknown as {
      body?: { getReader(): ReadableStreamDefaultReader<Uint8Array> };
    };
    const _reader = _nodeResponse.body?.getReader();
    if (!_reader) {
      throw new Error("No _response body");
    }

    const _decoder = new TextDecoder();
    let buffer = "";

    try {
      // eslint-disable-next-line no-constant-condition

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await _reader.read();
        if (done) {
          break;
        }

        buffer += _decoder.decode(value, { stream: true });
        const _lines = buffer.split("\n");
        buffer = _lines.pop() || "";

        for (const line of _lines) {
          if (line.startsWith("_data: ")) {
            const _data = line.slice(6);
            if (_data === "[DONE]") {
              return;
            }

            try {
              const _parsed = JSON.parse(_data) as {
                choices?: Array<{ delta?: { _content?: string } }>;
              };
              const _content = _parsed.choices?.[0]?.delta?._content;
              if (_content) {
                yield _content;
                if (options?.streamOptions?.onToken) {
                  options.streamOptions.onToken(_content);
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
        _content: prompt,
      },
    ];

    return this.chat(messages, model, { temperature: 0.2, maxTokens: 4096 });
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

  // vLLM specific methods
  async isServerRunning(): Promise<boolean> {
    return await this.checkHealth();
  }

  async getAvailableModels(): Promise<string[]> {
    await this.fetchAvailableModels();
    return this.availableModels;
  }

  async selectModelForTask(
    task: "japanese" | "code" | "general" | "fast",
  ): Promise<string> {
    const _availableModels = await this.getAvailableModels();

    switch (task) {
      case "japanese": {
        // Prefer Japanese-specific models
        const _japaneseModels = _availableModels.filter(
          (m) => m.includes("japanese") || m.includes("jp"),
        );
        if (_japaneseModels.length > 0 && _japaneseModels[0]) {
          return _japaneseModels[0];
        }
        break;
      }

      case "code": {
        // Prefer code-optimized models
        const _codeModels = _availableModels.filter(
          (m) => m.includes("code") || m.includes("instruct"),
        );
        if (_codeModels.length > 0 && _codeModels[0]) {
          return _codeModels[0];
        }
        break;
      }

      case "fast": {
        // Prefer smaller models for speed
        const _smallModels = _availableModels.filter(
          (m) => m.includes("1_6b") || m.includes("1.6b") || m.includes("7b"),
        );
        if (_smallModels.length > 0 && _smallModels[0]) {
          return _smallModels[0];
        }
        break;
      }
    }

    // Default to first available model
    return _availableModels[0] || this.getDefaultModel();
  }
}
