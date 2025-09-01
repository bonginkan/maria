import OpenAI from "openai";
import {
  BaseAIProvider,
  CodeReviewResult,
  CompletionOptions,
  Message,
} from "./ai-provider.js";

export class OpenAIProvider extends BaseAIProvider {
  readonly name = "OpenAI";
  readonly models = [
    "gpt-5-mini-2025-08-07",
    "gpt-5-mini",
    "gpt-5",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
    "o1-preview",
    "o1-mini",
  ];

  private client?: OpenAI;

  override async initialize(
    _apiKey: string,
    config?: Record<string, unknown>,
  ): Promise<void> {
    await super.initialize(_apiKey, config);

    this.client = new OpenAI({
      apiKey: this._apiKey,
      baseURL: config?.["baseURL"] as string | undefined,
      organization: config?.["organization"] as string | undefined,
      maxRetries: (config?.["maxRetries"] as number) || 3,
    });
  }

  async chat(
    _messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): Promise<string> {
    this.ensureInitialized();
    const _selectedModel = this.validateModel(model);

    // o1 and gpt-5 models only support temperature=1
    const _isRestrictedModel =
      _selectedModel.includes("o1") || _selectedModel.includes("gpt-5");
    const _temperature = _isRestrictedModel ? 1.0 : options?.temperature || 0.7;

    const completionParams: any = {
      model: _selectedModel,
      messages: _messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      top_p: options?.topP,
      stop: options?.stopSequences,
    };

    // GPT-5 models have special requirements
    if (_selectedModel.includes("gpt-5")) {
      // GPT-5 only supports temperature=1.0 (no need to send it)
      // Use max_completion_tokens instead of max_tokens
      completionParams.max_completion_tokens = options?.maxTokens || 32000;
    } else {
      // Non-GPT-5 models use standard parameters
      completionParams.temperature = _temperature;
      completionParams.max_tokens = options?.maxTokens;
    }

    const _completion = await this.client!.chat.completions.create(completionParams);

    return _completion.choices[0]?.message?.content || "";
  }

  // Add complete method for UnifiedAIProviderManager compatibility
  async complete(
    prompt: string,
    req: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<{ content: string }> {
    const messages: Message[] = [
      {
        role: "user",
        content: prompt,
      },
    ];

    const content = await this.chat(messages, req.model, {
      temperature: req.temperature,
      maxTokens: req.maxTokens,
    });

    return { content };
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const _selectedModel = this.validateModel(model);

    // o1 and gpt-5 models only support temperature=1
    const _isRestrictedModel =
      _selectedModel.includes("o1") || _selectedModel.includes("gpt-5");
    const _temperature = _isRestrictedModel ? 1.0 : options?.temperature || 0.7;

    const streamParams: any = {
      model: _selectedModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      top_p: options?.topP,
      stop: options?.stopSequences,
      stream: true,
    };

    // GPT-5 models have special requirements
    if (_selectedModel.includes("gpt-5")) {
      // GPT-5 only supports temperature=1.0 (no need to send it)
      // Use max_completion_tokens instead of max_tokens
      streamParams.max_completion_tokens = options?.maxTokens || 32000;
    } else {
      // Non-GPT-5 models use standard parameters
      streamParams.temperature = _temperature;
      streamParams.max_tokens = options?.maxTokens;
    }

    const _stream = await this.client!.chat.completions.create(streamParams);

    for await (const chunk of _stream) {
      const _content = chunk.choices[0]?.delta?.content;
      if (_content) {
        yield _content;
        if (options?.streamOptions?.onToken) {
          options.streamOptions.onToken(_content);
        }
      }

      // Check for abort signal
      if (options?.streamOptions?.signal?.aborted) {
        break;
      }
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
        content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    return this.chat(messages, model, { temperature: 0.2 });
  }

  async reviewCode(
    code: string,
    language: string = "typescript",
    model?: string,
  ): Promise<CodeReviewResult> {
    const messages: Message[] = [
      {
        role: "system",
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
        role: "user",
        content: code,
      },
    ];

    const response = await this.chat(messages, model, { temperature: 0.1 });

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
}
