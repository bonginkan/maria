import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider, CodeReviewResult, CompletionOptions, Message } from './ai-provider.js';

export class AnthropicProvider extends BaseAIProvider {
  readonly name = 'Anthropic';
  readonly models = [
    'claude-4.1',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ];

  private client?: Anthropic;

  override async initialize(apiKey: string, config?: Record<string, unknown>): Promise<void> {
    await super.initialize(apiKey, config);

    this.client = new Anthropic({
      apiKey: this.apiKey,
      baseURL: config?.['baseURL'] as string | undefined,
      maxRetries: (config?.['maxRetries'] as number) || 3,
    });
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    // Extract system message if present (unused for now but kept for future use)
    const _systemMessage = messages.find((m) => m.role === 'system');
    void _systemMessage; // Will be used in future implementation
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    return conversationMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  private getSystemMessage(messages: Message[]): string | undefined {
    const systemMessage = messages.find((m) => m.role === 'system');
    return systemMessage?.content;
  }

  async chat(messages: Message[], model?: string, options?: CompletionOptions): Promise<string> {
    this.ensureInitialized();
    const selectedModel = this.validateModel(model);

    const response = await this.client!.messages.create({
      model: selectedModel,
      messages: this.convertMessages(messages),
      system: this.getSystemMessage(messages),
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      top_p: options?.topP,
      stop_sequences: options?.stopSequences,
    });

    // Handle different content types
    const content = response.content[0];
    if (content && content.type === 'text' && 'text' in content) {
      return content.text;
    }

    return '';
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const selectedModel = this.validateModel(model);

    const stream = await this.client!.messages.create({
      model: selectedModel,
      messages: this.convertMessages(messages),
      system: this.getSystemMessage(messages),
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      top_p: options?.topP,
      stop_sequences: options?.stopSequences,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        yield text;

        if (options?.streamOptions?.onToken) {
          options.streamOptions.onToken(text);
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

    return this.chat(messages, model, { temperature: 0.2 });
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
