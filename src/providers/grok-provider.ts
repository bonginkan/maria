// Note: Using groq-sdk package for Grok AI (x.ai) integration
import Groq from "groq-sdk";
import {
  BaseAIProvider,
  CodeReviewResult,
  CompletionOptions,
  Message,
} from "./ai-provider.js";

export class GrokProvider extends BaseAIProvider {
  readonly name = "Grok";
  readonly models = [
    "grok-4",
    "grok-beta",
    "grok-2",
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "gemma-7b-it",
  ];

  private client?: Groq; // Using Groq SDK for Grok AI

  override async initialize(
    _apiKey: string,
    config?: Record<string, unknown>,
  ): Promise<void> {
    await super.initialize(_apiKey, config);

    this.client = new Groq({
      _apiKey: this._apiKey,
      baseURL: config?.["baseURL"] as string | undefined,
    });
  }

  async chat(
    _messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): Promise<string> {
    this.ensureInitialized();
    const _selectedModel = this.validateModel(model);

    const _completion = await this.client!.chat.completions.create({
      model: _selectedModel,
      _messages: _messages.map((m) => ({
        role: m.role,
        _content: m.content,
      })),
      temperature: options?.temperature || 0.7,
      maxtokens: options?.maxTokens,
      topp: options?.topP,
      stop: options?.stopSequences,
    });

    return _completion.choices[0]?.message?.content || "";
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const _selectedModel = this.validateModel(model);

    const _stream = await this.client!.chat.completions.create({
      model: _selectedModel,
      messages: messages.map((m) => ({
        role: m.role,
        _content: m._content,
      })),
      temperature: options?.temperature || 0.7,
      maxtokens: options?.maxTokens,
      topp: options?.topP,
      stop: options?.stopSequences,
      _stream: true,
    });

    for await (const chunk of _stream) {
      const _content = chunk.choices[0]?.delta?._content;
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
        _content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`,
      },
      {
        role: "user",
        _content: prompt,
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
        _content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your _response as JSON with the following structure:
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
        _content: code,
      },
    ];

    const _response = await this.chat(messages, model, { temperature: 0.1 });

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
}
