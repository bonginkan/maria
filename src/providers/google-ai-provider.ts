import {
  Content,
  GenerativeModel,
  GoogleGenerativeAI,
} from "@google/generative-ai";
import {
  BaseAIProvider,
  CodeReviewResult,
  CompletionOptions,
  Message,
} from "./ai-provider.js";

export class GoogleAIProvider extends BaseAIProvider {
  id = "google-aiprovider";
  version = "1.0.0";

  readonly name = "GoogleAI";
  readonly models = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash-image-preview",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro",
    "gemini-1.5-pro-002",
    "gemini-1.5-flash",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro",
  ];

  private client?: GoogleGenerativeAI;

  override async initialize(
    _apiKey: string,
    config?: Record<string, unknown>,
  ): Promise<void> {
    await super.initialize(_apiKey, config);

    this.client = new GoogleGenerativeAI(_apiKey);
  }

  private convertMessages(messages: Message[]): Content[] {
    // Extract system message to use as initial context
    const _systemMessage = messages.find((m) => m.role === "system");
    const _conversationMessages = messages.filter((m) => m.role !== "system");

    const _contents: Content[] = [];

    // Add system message as first user message if present
    if (_systemMessage) {
      _contents.push({
        role: "user",
        parts: [{ text: `System: ${_systemMessage.content}` }],
      });
      _contents.push({
        role: "model",
        parts: [{ text: "Understood. I will follow these instructions." }],
      });
    }

    // Add conversation messages
    _conversationMessages.forEach((msg) => {
      _contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    });

    return _contents;
  }

  private getModel(modelName: string): GenerativeModel {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    return this.client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        candidateCount: 1,
      },
    });
  }

  async chat(
    _messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): Promise<string> {
    this.ensureInitialized();
    const _selectedModel = this.validateModel(model);

    const _genModel = this.getModel(_selectedModel);
    const _contents = this.convertMessages(_messages);

    // Create _chat session with history
    const _chat = _genModel.startChat({
      history: _contents.slice(0, -1), // All messages except the last one
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxTokens,
        topP: options?.topP,
        stopSequences: options?.stopSequences,
      },
    });

    // Send the last message
    const _lastMessage = _contents[_contents.length - 1];
    if (!_lastMessage || !_lastMessage.parts || !_lastMessage.parts[0]) {
      throw new Error("Invalid message format");
    }
    const _result = await _chat.sendMessage((_lastMessage.parts[0] as any).text || "");
    const _response = await _result.response;

    return _response.text();
  }

  async *chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string> {
    this.ensureInitialized();
    const _selectedModel = this.validateModel(model);

    const _genModel = this.getModel(_selectedModel);
    const _contents = this.convertMessages(messages);

    // Create _chat session with history
    const _chat = _genModel.startChat({
      history: _contents.slice(0, -1),
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxTokens,
        topP: options?.topP,
        stopSequences: options?.stopSequences,
      },
    });

    // Send the last message with streaming
    const _lastMessage = _contents[_contents.length - 1];
    if (!_lastMessage || !_lastMessage.parts || !_lastMessage.parts[0]) {
      throw new Error("Invalid message format");
    }
    const _result = await _chat.sendMessageStream(
      (_lastMessage.parts[0] as any).text || "",
    );

    for await (const chunk of _result.stream) {
      const _text = chunk.text();
      if (_text) {
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
        content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your _response as JSON with the following structure:
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
