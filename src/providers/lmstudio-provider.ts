import {
  BaseAIProvider,
  CodeReviewResult,
  CompletionOptions,
  Message,
} from "./ai-provider.js";
import fetch from "node-fetch";

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
  readonly name = "LMStudio";
  readonly models = [
    "gpt-oss-120b",
    "gpt-oss-20b",
    "qwen3-30b",
    "llama-3-70b",
    "mistral-7b",
    "codellama-34b",
  ];

  private apiBase: string = "http://localhost:1234/v1";
  private timeout: number = 300000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private isHealthy: boolean = false;
  private availableModels: string[] = [];

  override async initialize(
    apiKey: string = "lm-studio",
    config?: Record<string, unknown>,
  ): Promise<void> {
    await super.initialize(apiKey, config);

    const _lmConfig = config as LMStudioConfig;
    this.apiBase =
      _lmConfig?.apiBase ||
      process.env["LMSTUDIO_API_BASE"] ||
      "http://localhost:1234/v1";
    this.timeout =
      _lmConfig?.timeout ||
      parseInt(process.env["LMSTUDIO_TIMEOUT"] || "300000");
    this.retryAttempts =
      _lmConfig?.retryAttempts ||
      parseInt(process.env["LMSTUDIO_RETRY_ATTEMPTS"] || "3");
    this.retryDelay =
      _lmConfig?.retryDelay ||
      parseInt(process.env["LMSTUDIO_RETRY_DELAY"] || "1000");

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
          _data: Array<{ id: string }>;
        };
        this.availableModels = _data._data.map((model) => model.id);
      }
    } catch {
      // Silently fail - LM Studio might not be running
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
      maxtokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      topp: options?.topP || 0.95,
      stop: options?.stopSequences,
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
          `LM Studio API _error: ${_response.statusText} - ${_errorData}`,
        );
      }

      return _response;
    };

    const _response = await this.retryWithBackoff(_makeRequest);
    const _data = (await _response.json()) as {
      _choices: Array<{ message?: { _content?: string } }>;
    };
    return _data.choices[0]?.message?.content || "";
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
      maxtokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      topp: options?.topP || 0.95,
      stop: options?.stopSequences,
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
          `LM Studio API _error: ${_response.statusText} - ${_errorData}`,
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
              const _parsed = JSON.parse(_data) as Record<string, unknown>;
              const _choices = _parsed["_choices"] as Array<{
                delta?: { _content?: string };
              }>;
              const _content = _choices?.[0]?.delta?._content;
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

  // LM Studio specific methods
  async isServerRunning(): Promise<boolean> {
    return await this.checkHealth();
  }

  async getAvailableModels(): Promise<string[]> {
    await this.fetchAvailableModels();
    return this.availableModels;
  }

  async switchModel(modelType: "120b" | "20b"): Promise<void> {
    if (modelType === "120b") {
      this.config["model"] = "gpt-oss-120b";
    } else {
      this.config["model"] = "gpt-oss-20b";
    }
  }
}
