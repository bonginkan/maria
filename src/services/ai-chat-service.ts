import {
  Message as AIMessage,
  AIProviderRegistry,
  IAIProvider,
  initializeProvider,
  registerAllProviders,
} from "../providers/index.js";
import {
  getAIProviderConfig,
  getProviderForModel,
} from "../providers/config.js";
import { autoSaveDocument, autoSaveMultipleDocuments } from "./document-auto-save.js";
import * as path from "path";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  savedFilePath?: string; // Path to auto-saved document
}

export interface ChatContext {
  sessionId: string;
  projectRoot: string;
  mode: "chat" | "research" | "creative" | "command";
  history: ChatMessage[];
}

export interface ChatResponse {
  message: ChatMessage;
  stream?: AsyncGenerator<string>;
}

export class AIChatServiceV2 {
  private _provider: IAIProvider | null = null;
  private currentModel: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Register all providers
    registerAllProviders();

    // Get configuration
    const _config = await getAIProviderConfig();
    if (!_config) {
      throw new Error(
        "No AI _provider configuration found. Please set API keys in environment variables or _config file.",
      );
    }

    // Initialize the _provider
    await initializeProvider(_config);

    // Set as default _provider
    this.provider = AIProviderRegistry.get(_config.provider) || null;
    this.currentModel =
      _config.model || this.provider?.getDefaultModel() || null;

    if (!this.provider) {
      throw new Error("Failed to initialize AI _provider");
    }

    this.initialized = true;
  }

  async switchProvider(_providerName: string, model?: string): Promise<void> {
    const _provider = AIProviderRegistry.get(_providerName);
    if (!_provider) {
      throw new Error(`Provider ${_providerName} not found`);
    }

    if (!_provider.isInitialized()) {
      // Try to get API key from environment
      const _config = await getAIProviderConfig();
      if (!_config || _config._provider !== _providerName) {
        throw new Error(
          `Provider ${_providerName} is not configured. Please set the API key.`,
        );
      }
      await initializeProvider(_config);
    }

    this._provider = _provider;
    this.currentModel = model || _provider.getDefaultModel();
  }

  async switchModel(modelName: string): Promise<void> {
    // Check if model belongs to current _provider
    if (this.provider && this.provider.getModels().includes(modelName)) {
      this.currentModel = modelName;
      return;
    }

    // Try to find _provider for this model
    const _providerInfo = getProviderForModel(modelName);
    if (_providerInfo) {
      await this.switchProvider(_providerInfo.provider, _providerInfo.model);
    } else {
      throw new Error(
        `Model ${modelName} not found in any registered _provider`,
      );
    }
  }

  async processMessage(
    message: string,
    context: ChatContext,
    stream: boolean = false,
  ): Promise<ChatResponse> {
    await this.initialize();

    if (!this.provider) {
      throw new Error("No AI _provider available");
    }

    try {
      // Determine which _response type to generate
      const _isSOWRequest = this._isSOWRequest(message);
      const _isArchitectureRequest = this._isArchitectureRequest(message);
      const _isCodeRequest = this._isCodeRequest(message);
      const _isTodoRequest = this._isTodoRequest(message);
      const _isRequirementsRequest = this._isRequirementsRequest(message);
      const _isTechnicalSpecRequest = this._isTechnicalSpecRequest(message);

      if (_isSOWRequest) {
        return await this.generateSOWResponse(message, context, stream);
      } else if (_isArchitectureRequest) {
        return await this.generateArchitectureResponse(
          message,
          context,
          stream,
        );
      } else if (_isTodoRequest) {
        return await this.generateTodoResponse(message, context, stream);
      } else if (_isRequirementsRequest) {
        return await this.generateRequirementsResponse(message, context, stream);
      } else if (_isTechnicalSpecRequest) {
        return await this.generateTechnicalSpecResponse(message, context, stream);
      } else if (_isCodeRequest) {
        return await this.generateCodeResponse(message, context, stream);
      } else {
        return await this.generateChatResponse(message, context, stream);
      }
    } catch (_error: unknown) {
      console._error("Error processing message:", _error);
      return {
        message: {
          role: "assistant",
          content:
            "I apologize, but I encountered an _error processing your request. Please try again or rephrase your question.",
          timestamp: new Date(),
          metadata: {
            _error: _error instanceof Error ? _error.message : "Unknown _error",
          },
        },
      };
    }
  }

  private _isSOWRequest(message: string): boolean {
    const _sowKeywords = [
      "sow",
      "statement of work",
      "project plan",
      "proposal",
      "estimate",
      "timeline",
      "deliverables",
    ];
    const _lowerMessage = message.toLowerCase();
    return _sowKeywords.some((keyword) => _lowerMessage.includes(keyword));
  }

  private _isArchitectureRequest(message: string): boolean {
    const _archKeywords = [
      "architecture",
      "design",
      "system design",
      "technical design",
      "implementation",
      "structure",
      "component",
      "diagram",
    ];
    const _lowerMessage = message.toLowerCase();
    return _archKeywords.some((keyword) => _lowerMessage.includes(keyword));
  }

  private _isCodeRequest(message: string): boolean {
    const _codeKeywords = [
      "_code",
      "implement",
      "function",
      "class",
      "method",
      "algorithm",
      "script",
      "program",
    ];
    const _lowerMessage = message.toLowerCase();
    return _codeKeywords.some((keyword) => _lowerMessage.includes(keyword));
  }

  private _isTodoRequest(message: string): boolean {
    const _todoKeywords = [
      "todo",
      "task list",
      "action items",
      "checklist",
      "to-do",
      "tasks",
      "action plan",
      "work items",
      "backlog",
    ];
    const _lowerMessage = message.toLowerCase();
    return _todoKeywords.some((keyword) => _lowerMessage.includes(keyword));
  }

  private _isRequirementsRequest(message: string): boolean {
    const _reqKeywords = [
      "requirements",
      "specification",
      "spec",
      "functional requirements",
      "user requirements",
      "business requirements",
      "acceptance criteria",
      "user stories",
    ];
    const _lowerMessage = message.toLowerCase();
    return _reqKeywords.some((keyword) => _lowerMessage.includes(keyword));
  }

  private _isTechnicalSpecRequest(message: string): boolean {
    const _techSpecKeywords = [
      "technical specification",
      "tech spec",
      "implementation details",
      "technical design",
      "api documentation",
      "database schema",
      "system specification",
    ];
    const _lowerMessage = message.toLowerCase();
    return _techSpecKeywords.some((keyword) => _lowerMessage.includes(keyword));
  }

  private async generateSOWResponse(
    message: string,
    context: ChatContext,
    stream: boolean,
  ): Promise<ChatResponse> {
    const messages: AIMessage[] = [
      {
        role: "system",
        content: `You are an expert project manager and technical writer. 
        Generate detailed Statements of Work (SOW) with clear structure, realistic timelines, 
        resource requirements, deliverables, and success criteria.
        Format your _response as a professional SOW document.`,
      },
      ...context.history.slice(-5).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    if (stream) {
      const _streamGenerator = this.provider!.chatStream(
        messages,
        this.currentModel || undefined,
        {
          _temperature: 0.7,
          maxTokens: 4000,
        },
      );

      return {
        message: {
          role: "assistant",
          content: "", // Will be filled by stream
          timestamp: new Date(),
          metadata: {
            type: "sow",
            _provider: this.provider!.name,
            model: this.currentModel,
            streaming: true,
          },
        },
        stream: _streamGenerator,
      };
    } else {
      const _response = await this.provider!.chat(
        messages,
        this.currentModel || undefined,
        {
          _temperature: 0.7,
          maxTokens: 4000,
        },
      );

      let responseMessage: ChatMessage = {
        role: "assistant",
        content: _response,
        timestamp: new Date(),
        metadata: {
          type: "sow",
          _provider: this.provider!.name,
          model: this.currentModel,
        },
      };
      
      // Auto-save the SOW document
      responseMessage = await this.tryAutoSaveDocument(responseMessage, "statement_of_work");

      return {
        message: responseMessage,
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
        role: "system",
        content: `You are an expert software architect and system designer. 
        Provide detailed technical designs, architecture diagrams (in text/ASCII art), 
        component breakdowns, technology recommendations, and implementation guidelines.
        Be specific about technologies, frameworks, and best practices.`,
      },
      ...context.history.slice(-5).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    // Use lower _temperature for technical accuracy
    const _options = {
      _temperature: 0.5,
      maxTokens: 4000,
    };

    if (stream) {
      const _streamGenerator = this.provider!.chatStream(
        messages,
        this.currentModel || undefined,
        _options,
      );

      return {
        message: {
          role: "assistant",
          content: "",
          timestamp: new Date(),
          metadata: {
            type: "architecture",
            _provider: this.provider!.name,
            model: this.currentModel,
            streaming: true,
          },
        },
        stream: _streamGenerator,
      };
    } else {
      const _response = await this.provider!.chat(
        messages,
        this.currentModel || undefined,
        _options,
      );

      let responseMessage: ChatMessage = {
        role: "assistant",
        content: _response,
        timestamp: new Date(),
        metadata: {
          type: "architecture",
          _provider: this.provider!.name,
          model: this.currentModel,
        },
      };
      
      // Auto-save the architecture document
      responseMessage = await this.tryAutoSaveDocument(responseMessage, "architecture");

      return {
        message: responseMessage,
      };
    }
  }

  private async generateCodeResponse(
    message: string,
    context: ChatContext,
    stream: boolean,
  ): Promise<ChatResponse> {
    // Extract _language hint from message
    const _languageMatch = message.match(
      /\b(javascript|typescript|python|java|go|rust|c\+\+|c#|ruby|php)\b/i,
    );
    const _language = _languageMatch?.[1]?.toLowerCase() || "typescript";

    if (stream) {
      // For _code generation, we'll use the chat method with _code-specific prompting
      const messages: AIMessage[] = [
        {
          role: "system",
          content: `You are an expert ${_language} developer. Generate clean, well-commented _code based on the user's request. Include _error handling and best practices.`,
        },
        ...context.history.slice(-3).map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user", content: message },
      ];

      const _streamGenerator = this.provider!.chatStream(
        messages,
        this.currentModel || undefined,
        {
          _temperature: 0.2,
          maxTokens: 2000,
        },
      );

      return {
        message: {
          role: "assistant",
          content: "",
          timestamp: new Date(),
          metadata: {
            type: "_code",
            _language,
            _provider: this.provider!.name,
            model: this.currentModel,
            streaming: true,
          },
        },
        stream: _streamGenerator,
      };
    } else {
      const _code = await this.provider!.generateCode(
        message,
        _language,
        this.currentModel || undefined,
      );

      return {
        message: {
          role: "assistant",
          content: _code,
          timestamp: new Date(),
          metadata: {
            type: "_code",
            _language,
            _provider: this.provider!.name,
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
        role: "system",
        content: `You are MARIA CODE, an advanced AI development assistant. 
        You help with coding, debugging, architecture design, and software development tasks.
        Provide helpful, accurate, and detailed responses.
        When appropriate, include _code examples, best practices, and step-by-step guidance.`,
      },
      ...context.history.slice(-10).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const _temperature =
      context.mode === "creative"
        ? 0.9
        : context.mode === "research"
          ? 0.5
          : 0.7;

    const _options = {
      _temperature,
      maxTokens: 2000,
    };

    if (stream) {
      const _streamGenerator = this.provider!.chatStream(
        messages,
        this.currentModel || undefined,
        _options,
      );

      return {
        message: {
          role: "assistant",
          content: "",
          timestamp: new Date(),
          metadata: {
            _provider: this.provider!.name,
            model: this.currentModel,
            mode: context.mode,
            streaming: true,
          },
        },
        stream: _streamGenerator,
      };
    } else {
      const _response = await this.provider!.chat(
        messages,
        this.currentModel || undefined,
        _options,
      );

      let responseMessage: ChatMessage = {
        role: "assistant",
        content: _response,
        timestamp: new Date(),
        metadata: {
          _provider: this.provider!.name,
          model: this.currentModel,
          mode: context.mode,
        },
      };
      
      // Try auto-save for general chat (may detect document patterns)
      responseMessage = await this.tryAutoSaveDocument(responseMessage);

      return {
        message: responseMessage,
      };
    }
  }

  getProviderInfo(): {
    _provider: string;
    model: string;
    available: string[];
  } | null {
    if (!this.provider) {
      return null;
    }

    return {
      _provider: this.provider.name,
      model: this.currentModel || this.provider.getDefaultModel(),
      available: AIProviderRegistry.getAll().map((p) => p.name),
    };
  }

  async reviewCode(_code: string, _language?: string): Promise<unknown> {
    await this.initialize();

    if (!this.provider) {
      throw new Error("No AI _provider available");
    }

    return await this.provider.reviewCode(
      _code,
      _language,
      this.currentModel || undefined,
    );
  }

  private async generateTodoResponse(
    message: string,
    context: ChatContext,
    stream: boolean,
  ): Promise<ChatResponse> {
    const messages: AIMessage[] = [
      {
        role: "system",
        content: `You are an expert project manager and task organizer.
        Generate comprehensive TODO lists with clear priorities, estimates, and actionable items.
        Format your response as a structured markdown TODO list with checkboxes and priorities.`,
      },
      ...context.history.slice(-5).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const _options = {
      _temperature: 0.6,
      maxTokens: 3000,
    };

    const _response = await this.provider!.chat(
      messages,
      this.currentModel || undefined,
      _options,
    );

    let responseMessage: ChatMessage = {
      role: "assistant",
      content: _response,
      timestamp: new Date(),
      metadata: {
        type: "todo",
        _provider: this.provider!.name,
        model: this.currentModel,
      },
    };
    
    // Auto-save the TODO document
    responseMessage = await this.tryAutoSaveDocument(responseMessage, "todo_list");

    return {
      message: responseMessage,
    };
  }

  private async generateRequirementsResponse(
    message: string,
    context: ChatContext,
    stream: boolean,
  ): Promise<ChatResponse> {
    const messages: AIMessage[] = [
      {
        role: "system",
        content: `You are an expert business analyst and requirements engineer.
        Generate detailed requirements documents with functional and non-functional requirements,
        user stories, acceptance criteria, and validation methods.
        Format as a professional requirements specification document.`,
      },
      ...context.history.slice(-5).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const _options = {
      _temperature: 0.5,
      maxTokens: 4000,
    };

    const _response = await this.provider!.chat(
      messages,
      this.currentModel || undefined,
      _options,
    );

    let responseMessage: ChatMessage = {
      role: "assistant",
      content: _response,
      timestamp: new Date(),
      metadata: {
        type: "requirements",
        _provider: this.provider!.name,
        model: this.currentModel,
      },
    };
    
    // Auto-save the requirements document
    responseMessage = await this.tryAutoSaveDocument(responseMessage, "requirements");

    return {
      message: responseMessage,
    };
  }

  private async generateTechnicalSpecResponse(
    message: string,
    context: ChatContext,
    stream: boolean,
  ): Promise<ChatResponse> {
    const messages: AIMessage[] = [
      {
        role: "system",
        content: `You are an expert technical architect and documentation specialist.
        Generate detailed technical specifications with implementation details, API designs,
        database schemas, system interfaces, and technical constraints.
        Format as a comprehensive technical specification document.`,
      },
      ...context.history.slice(-5).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const _options = {
      _temperature: 0.4,
      maxTokens: 4000,
    };

    const _response = await this.provider!.chat(
      messages,
      this.currentModel || undefined,
      _options,
    );

    let responseMessage: ChatMessage = {
      role: "assistant",
      content: _response,
      timestamp: new Date(),
      metadata: {
        type: "technical_spec",
        _provider: this.provider!.name,
        model: this.currentModel,
      },
    };
    
    // Auto-save the technical specification document
    responseMessage = await this.tryAutoSaveDocument(responseMessage, "technical_specification");

    return {
      message: responseMessage,
    };
  }

  /**
   * Auto-save document if it matches document patterns
   * Returns the ChatMessage with savedFilePath if saved
   */
  private async tryAutoSaveDocument(
    message: ChatMessage,
    userHint?: string
  ): Promise<ChatMessage> {
    try {
      // Try to save multiple documents if detected
      const savedPaths = await autoSaveMultipleDocuments(message.content, userHint);
      
      if (savedPaths.length > 0) {
        // Update message with saved file information (compact)
        let fileInfo = '\n\nSaved:';
        for (const savedPath of savedPaths) {
          const relativePath = path.relative(process.cwd(), savedPath);
          fileInfo += `\n./${relativePath}`;
        }
        
        return {
          ...message,
          content: message.content + fileInfo,
          savedFilePath: savedPaths[0], // Keep first path for compatibility
          metadata: {
            ...message.metadata,
            autoSaved: true,
            savedFiles: savedPaths.map(p => path.basename(p)),
            savedFileCount: savedPaths.length,
            documentType: message.metadata?.type || 'auto-detected'
          }
        };
      }
      
      return message;
    } catch (error) {
      console.error('Error in auto-save:', error);
      return message; // Return original message if auto-save fails
    }
  }
}
