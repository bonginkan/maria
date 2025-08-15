import {
  IAIProvider,
  Message as AIMessage,
  AIProviderRegistry,
  registerAllProviders,
  initializeProvider,
} from '../providers/index.js';
import { getAIProviderConfig, getProviderForModel } from '../providers/config.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ChatContext {
  sessionId: string;
  projectRoot: string;
  mode: 'chat' | 'research' | 'creative' | 'command';
  history: ChatMessage[];
}

export interface ChatResponse {
  message: ChatMessage;
  stream?: AsyncGenerator<string>;
}

export class AIChatServiceV2 {
  private provider: IAIProvider | null = null;
  private currentModel: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register all providers
    registerAllProviders();

    // Get configuration
    const config = await getAIProviderConfig();
    if (!config) {
      throw new Error(
        'No AI provider configuration found. Please set API keys in environment variables or config file.',
      );
    }

    // Initialize the provider
    await initializeProvider(config);

    // Set as default provider
    this.provider = AIProviderRegistry.get(config.provider) || null;
    this.currentModel = config.model || this.provider?.getDefaultModel() || null;

    if (!this.provider) {
      throw new Error('Failed to initialize AI provider');
    }

    this.initialized = true;
  }

  async switchProvider(providerName: string, model?: string): Promise<void> {
    const provider = AIProviderRegistry.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    if (!provider.isInitialized()) {
      // Try to get API key from environment
      const config = await getAIProviderConfig();
      if (!config || config.provider !== providerName) {
        throw new Error(`Provider ${providerName} is not configured. Please set the API key.`);
      }
      await initializeProvider(config);
    }

    this.provider = provider;
    this.currentModel = model || provider.getDefaultModel();
  }

  async switchModel(modelName: string): Promise<void> {
    // Check if model belongs to current provider
    if (this.provider && this.provider.getModels().includes(modelName)) {
      this.currentModel = modelName;
      return;
    }

    // Try to find provider for this model
    const providerInfo = getProviderForModel(modelName);
    if (providerInfo) {
      await this.switchProvider(providerInfo.provider, providerInfo.model);
    } else {
      throw new Error(`Model ${modelName} not found in any registered provider`);
    }
  }

  async processMessage(
    message: string,
    context: ChatContext,
    stream: boolean = false,
  ): Promise<ChatResponse> {
    await this.initialize();

    if (!this.provider) {
      throw new Error('No AI provider available');
    }

    try {
      // Determine which response type to generate
      const isSOWRequest = this.isSOWRequest(message);
      const isArchitectureRequest = this.isArchitectureRequest(message);
      const isCodeRequest = this.isCodeRequest(message);

      if (isSOWRequest) {
        return await this.generateSOWResponse(message, context, stream);
      } else if (isArchitectureRequest) {
        return await this.generateArchitectureResponse(message, context, stream);
      } else if (isCodeRequest) {
        return await this.generateCodeResponse(message, context, stream);
      } else {
        return await this.generateChatResponse(message, context, stream);
      }
    } catch (error: unknown) {
      console.error('Error processing message:', error);
      return {
        message: {
          role: 'assistant',
          content:
            'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.',
          timestamp: new Date(),
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      };
    }
  }

  private isSOWRequest(message: string): boolean {
    const sowKeywords = [
      'sow',
      'statement of work',
      'project plan',
      'proposal',
      'estimate',
      'timeline',
      'deliverables',
    ];
    const lowerMessage = message.toLowerCase();
    return sowKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  private isArchitectureRequest(message: string): boolean {
    const archKeywords = [
      'architecture',
      'design',
      'system design',
      'technical design',
      'implementation',
      'structure',
      'component',
      'diagram',
    ];
    const lowerMessage = message.toLowerCase();
    return archKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  private isCodeRequest(message: string): boolean {
    const codeKeywords = [
      'code',
      'implement',
      'function',
      'class',
      'method',
      'algorithm',
      'script',
      'program',
    ];
    const lowerMessage = message.toLowerCase();
    return codeKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  private async generateSOWResponse(
    message: string,
    context: ChatContext,
    stream: boolean,
  ): Promise<ChatResponse> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are an expert project manager and technical writer. 
        Generate detailed Statements of Work (SOW) with clear structure, realistic timelines, 
        resource requirements, deliverables, and success criteria.
        Format your response as a professional SOW document.`,
      },
      ...context.history.slice(-5).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    if (stream) {
      const streamGenerator = this.provider!.chatStream(messages, this.currentModel || undefined, {
        temperature: 0.7,
        maxTokens: 4000,
      });

      return {
        message: {
          role: 'assistant',
          content: '', // Will be filled by stream
          timestamp: new Date(),
          metadata: {
            type: 'sow',
            provider: this.provider!.name,
            model: this.currentModel,
            streaming: true,
          },
        },
        stream: streamGenerator,
      };
    } else {
      const response = await this.provider!.chat(messages, this.currentModel || undefined, {
        temperature: 0.7,
        maxTokens: 4000,
      });

      return {
        message: {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          metadata: {
            type: 'sow',
            provider: this.provider!.name,
            model: this.currentModel,
          },
        },
      };
    }
  }

  private async generateArchitectureResponse(
    message: string,
    context: ChatContext,
    stream: boolean,
  ): Promise<ChatResponse> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are an expert software architect and system designer. 
        Provide detailed technical designs, architecture diagrams (in text/ASCII art), 
        component breakdowns, technology recommendations, and implementation guidelines.
        Be specific about technologies, frameworks, and best practices.`,
      },
      ...context.history.slice(-5).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Use lower temperature for technical accuracy
    const options = {
      temperature: 0.5,
      maxTokens: 4000,
    };

    if (stream) {
      const streamGenerator = this.provider!.chatStream(
        messages,
        this.currentModel || undefined,
        options,
      );

      return {
        message: {
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          metadata: {
            type: 'architecture',
            provider: this.provider!.name,
            model: this.currentModel,
            streaming: true,
          },
        },
        stream: streamGenerator,
      };
    } else {
      const response = await this.provider!.chat(messages, this.currentModel || undefined, options);

      return {
        message: {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          metadata: {
            type: 'architecture',
            provider: this.provider!.name,
            model: this.currentModel,
          },
        },
      };
    }
  }

  private async generateCodeResponse(
    message: string,
    context: ChatContext,
    stream: boolean,
  ): Promise<ChatResponse> {
    // Extract language hint from message
    const languageMatch = message.match(
      /\b(javascript|typescript|python|java|go|rust|c\+\+|c#|ruby|php)\b/i,
    );
    const language = languageMatch?.[1]?.toLowerCase() || 'typescript';

    if (stream) {
      // For code generation, we'll use the chat method with code-specific prompting
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Include error handling and best practices.`,
        },
        ...context.history.slice(-3).map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: message },
      ];

      const streamGenerator = this.provider!.chatStream(messages, this.currentModel || undefined, {
        temperature: 0.2,
        maxTokens: 2000,
      });

      return {
        message: {
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          metadata: {
            type: 'code',
            language,
            provider: this.provider!.name,
            model: this.currentModel,
            streaming: true,
          },
        },
        stream: streamGenerator,
      };
    } else {
      const code = await this.provider!.generateCode(
        message,
        language,
        this.currentModel || undefined,
      );

      return {
        message: {
          role: 'assistant',
          content: code,
          timestamp: new Date(),
          metadata: {
            type: 'code',
            language,
            provider: this.provider!.name,
            model: this.currentModel,
          },
        },
      };
    }
  }

  private async generateChatResponse(
    message: string,
    context: ChatContext,
    stream: boolean,
  ): Promise<ChatResponse> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are MARIA CODE, an advanced AI development assistant. 
        You help with coding, debugging, architecture design, and software development tasks.
        Provide helpful, accurate, and detailed responses.
        When appropriate, include code examples, best practices, and step-by-step guidance.`,
      },
      ...context.history.slice(-10).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const temperature = context.mode === 'creative' ? 0.9 : context.mode === 'research' ? 0.5 : 0.7;

    const options = {
      temperature,
      maxTokens: 2000,
    };

    if (stream) {
      const streamGenerator = this.provider!.chatStream(
        messages,
        this.currentModel || undefined,
        options,
      );

      return {
        message: {
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          metadata: {
            provider: this.provider!.name,
            model: this.currentModel,
            mode: context.mode,
            streaming: true,
          },
        },
        stream: streamGenerator,
      };
    } else {
      const response = await this.provider!.chat(messages, this.currentModel || undefined, options);

      return {
        message: {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          metadata: {
            provider: this.provider!.name,
            model: this.currentModel,
            mode: context.mode,
          },
        },
      };
    }
  }

  getProviderInfo(): { provider: string; model: string; available: string[] } | null {
    if (!this.provider) return null;

    return {
      provider: this.provider.name,
      model: this.currentModel || this.provider.getDefaultModel(),
      available: AIProviderRegistry.getAll().map((p) => p.name),
    };
  }

  async reviewCode(code: string, language?: string): Promise<unknown> {
    await this.initialize();

    if (!this.provider) {
      throw new Error('No AI provider available');
    }

    return await this.provider.reviewCode(code, language, this.currentModel || undefined);
  }
}
