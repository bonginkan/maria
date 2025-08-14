// Note: Using groq-sdk package for Grok AI (x.ai) integration
import Groq from 'groq-sdk';
import { BaseAIProvider, Message, CompletionOptions, CodeReviewResult } from './ai-provider.js';

export class GrokProvider extends BaseAIProvider {
  readonly name = 'Grok';
  readonly models = [
    'grok-4-0709',
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'gemma-7b-it',
  ];

  private client?: Groq; // Using Groq SDK for Grok AI

  async initialize(apiKey: string, config?: Record<string, unknown>): Promise<void> {
    await super.initialize(apiKey, config);

    this.client = new Groq({
      apiKey: this.apiKey,
      baseURL: config?.['baseURL'] as string | undefined,
    });
  }

  async chat(messages: Message[], model?: string, options?: CompletionOptions): Promise<string> {
    this.ensureInitialized();
    const selectedModel = this.validateModel(model);

    const completion = await this.client!.chat.completions.create({
      model: selectedModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      stop: options?.stopSequences,
    });

    return completion.choices[0]?.message?.content || '';
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const selectedModel = this.validateModel(model);

    const stream = await this.client!.chat.completions.create({
      model: selectedModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      stop: options?.stopSequences,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
        if (options?.streamOptions?.onToken) {
          options.streamOptions.onToken(content);
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
      return JSON.parse(response) as Record<string, unknown>;
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
