import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { BaseAIProvider, Message, CompletionOptions, CodeReviewResult } from './ai-provider.js';

export class GoogleAIProvider extends BaseAIProvider {
  readonly name = 'GoogleAI';
  readonly models = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-pro-002',
    'gemini-1.5-flash',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-8b',
    'gemini-1.0-pro',
  ];

  private client?: GoogleGenerativeAI;

  async initialize(apiKey: string, config?: Record<string, any>): Promise<void> {
    await super.initialize(apiKey, config);

    this.client = new GoogleGenerativeAI(apiKey);
  }

  private convertMessages(messages: Message[]): Content[] {
    // Extract system message to use as initial context
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const contents: Content[] = [];

    // Add system message as first user message if present
    if (systemMessage) {
      contents.push({
        role: 'user',
        parts: [{ text: `System: ${systemMessage.content}` }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions.' }],
      });
    }

    // Add conversation messages
    conversationMessages.forEach((msg) => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    });

    return contents;
  }

  private getModel(modelName: string): GenerativeModel {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    return this.client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        candidateCount: 1,
      },
    });
  }

  async chat(messages: Message[], model?: string, options?: CompletionOptions): Promise<string> {
    this.ensureInitialized();
    const selectedModel = this.validateModel(model);

    const genModel = this.getModel(selectedModel);
    const contents = this.convertMessages(messages);

    // Create chat session with history
    const chat = genModel.startChat({
      history: contents.slice(0, -1), // All messages except the last one
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxTokens,
        topP: options?.topP,
        stopSequences: options?.stopSequences,
      },
    });

    // Send the last message
    const lastMessage = contents[contents.length - 1];
    if (!lastMessage || !lastMessage.parts || !lastMessage.parts[0]) {
      throw new Error('Invalid message format');
    }
    const result = await chat.sendMessage(lastMessage.parts[0].text || '');
    const response = await result.response;

    return response.text();
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const selectedModel = this.validateModel(model);

    const genModel = this.getModel(selectedModel);
    const contents = this.convertMessages(messages);

    // Create chat session with history
    const chat = genModel.startChat({
      history: contents.slice(0, -1),
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxTokens,
        topP: options?.topP,
        stopSequences: options?.stopSequences,
      },
    });

    // Send the last message with streaming
    const lastMessage = contents[contents.length - 1];
    if (!lastMessage || !lastMessage.parts || !lastMessage.parts[0]) {
      throw new Error('Invalid message format');
    }
    const result = await chat.sendMessageStream(lastMessage.parts[0].text || '');

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
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
      return JSON.parse(response);
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
