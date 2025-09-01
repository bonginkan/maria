import Anthropic from "@anthropic-ai/sdk";
import {
  BaseAIProvider,
  CodeReviewResult,
  CompletionOptions,
  Message,
} from "./ai-provider.js";

export class AnthropicProvider extends BaseAIProvider {
  readonly name = "Anthropic";
  readonly models = [
    "claude-4.1",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ];

  private client?: Anthropic;

  override async initialize(
    _apiKey: string,
    config?: Record<string, unknown>,
  ): Promise<void> {
    await super.initialize(_apiKey, config);

    this.client = new Anthropic({
      _apiKey: this._apiKey,
      baseURL: config?.["baseURL"] as string | undefined,
      maxRetries: (config?.["maxRetries"] as number) || 3,
    });
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    // Extract system message if present (unused for now but kept for future use)
    const _systemMessage = messages.find((m) => m.role === "system");
    void _systemMessage; // Will be used in future implementation
    const _conversationMessages = messages.filter((m) => m.role !== "system");

    return _conversationMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      _content: m.content,
    }));
  }

  private getSystemMessage(messages: Message[]): string | undefined {
    const _systemMessage = messages.find((m) => m.role === "system");
    return _systemMessage?.content;
  }

  async chat(
    _messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): Promise<string> {
    this.ensureInitialized();
    const _selectedModel = this.validateModel(model);

    const _response = await this.client!._messages.create({
      model: _selectedModel,
      _messages: this.convertMessages(_messages),
      system: this.getSystemMessage(_messages),
      maxtokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      topp: options?.topP,
      stopsequences: options?.stopSequences,
    });

    // Handle different _content types
    const _content = _response._content[0];
    if (_content && _content.type === "_text" && "_text" in _content) {
      return _content.text;
    }

    return "";
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const _selectedModel = this.validateModel(model);

    const _stream = await this.client!.messages.create({
      model: _selectedModel,
      messages: this.convertMessages(messages),
      system: this.getSystemMessage(messages),
      maxtokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      topp: options?.topP,
      stopsequences: options?.stopSequences,
      _stream: true,
    });

    for await (const event of _stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const _text = event.delta._text;
        yield _text;

        if (options?.streamOptions?.onToken) {
          options.streamOptions.onToken(_text);
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
