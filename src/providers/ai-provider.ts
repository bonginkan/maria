/**
 * Common AI Provider Interface
 * All AI providers must implement this interface
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  stream?: boolean;
  streamOptions?: StreamOptions;
}

export interface CodeReviewResult {
  issues: Array<{
    line: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }>;
  summary: string;
  improvements: string[];
}

export interface VisionResponse {
  description: string;
  objects?: Array<{
    name: string;
    confidence: number;
    location?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  text?: string;
  metadata?: Record<string, any>;
}

export interface ModelInfo {
  name: string;
  description?: string;
  contextWindow?: number;
  maxTokens?: number;
  pricing?: {
    input: number;
    output: number;
  };
  capabilities: {
    vision?: boolean;
    streaming?: boolean;
    codeGeneration?: boolean;
    embeddings?: boolean;
  };
}

export interface IAIProvider {
  readonly name: string;
  readonly models: string[];

  /**
   * Initialize the provider with API key and configuration
   */
  initialize(apiKey: string, config?: Record<string, any>): Promise<void>;

  /**
   * Chat completion
   */
  chat(messages: Message[], model?: string, options?: CompletionOptions): Promise<string>;

  /**
   * Streaming chat completion
   */
  chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string>;

  /**
   * Generate code based on prompt
   */
  generateCode(prompt: string, language?: string, model?: string): Promise<string>;

  /**
   * Review code and provide feedback
   */
  reviewCode(code: string, language?: string, model?: string): Promise<CodeReviewResult>;

  /**
   * Vision understanding (optional)
   */
  vision?(image: Buffer, prompt: string, model?: string): Promise<VisionResponse>;

  /**
   * Generate embeddings (optional)
   */
  embeddings?(text: string, model?: string): Promise<number[]>;

  /**
   * Validate connection to the provider
   */
  validateConnection?(): Promise<boolean>;

  /**
   * Get model information
   */
  getModelInfo?(model?: string): Promise<ModelInfo>;

  /**
   * Estimate cost for tokens
   */
  estimateCost?(tokens: number, model?: string): number;

  /**
   * Check if the provider is properly initialized
   */
  isInitialized(): boolean;

  /**
   * Get available models
   */
  getModels(): string[];

  /**
   * Get default model
   */
  getDefaultModel(): string;
}

/**
 * Base abstract class for AI providers
 */
export abstract class BaseAIProvider implements IAIProvider {
  protected apiKey: string = '';
  protected config: Record<string, any> = {};
  protected initialized: boolean = false;

  abstract readonly name: string;
  abstract readonly models: string[];

  async initialize(apiKey: string, config?: Record<string, any>): Promise<void> {
    this.apiKey = apiKey;
    this.config = config || {};
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getModels(): string[] {
    return this.models;
  }

  getDefaultModel(): string {
    if (this.models.length === 0) {
      throw new Error(`No models available for ${this.name} provider`);
    }
    const defaultModel = this.models[0];
    if (!defaultModel) {
      throw new Error(`Invalid default model for ${this.name} provider`);
    }
    return defaultModel;
  }

  protected validateModel(model?: string): string {
    const selectedModel = model || this.getDefaultModel();
    if (!this.models.includes(selectedModel)) {
      throw new Error(`Model ${selectedModel} is not supported by ${this.name} provider`);
    }
    return selectedModel;
  }

  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`${this.name} provider is not initialized. Call initialize() first.`);
    }
  }

  abstract chat(messages: Message[], model?: string, options?: CompletionOptions): Promise<string>;
  abstract chatStream(
    messages: Message[],
    model?: string,
    options?: CompletionOptions,
  ): AsyncGenerator<string>;
  abstract generateCode(prompt: string, language?: string, model?: string): Promise<string>;
  abstract reviewCode(code: string, language?: string, model?: string): Promise<CodeReviewResult>;
}

/**
 * Provider Registry
 */
export class AIProviderRegistry {
  private static providers = new Map<string, IAIProvider>();
  private static defaultProvider: string | null = null;

  static register(provider: IAIProvider): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }

  static get(name: string): IAIProvider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  static getAll(): IAIProvider[] {
    return Array.from(this.providers.values());
  }

  static setDefault(name: string): void {
    if (!this.providers.has(name.toLowerCase())) {
      throw new Error(`Provider ${name} is not registered`);
    }
    this.defaultProvider = name.toLowerCase();
  }

  static getDefault(): IAIProvider | undefined {
    if (!this.defaultProvider) {
      // Return the first registered provider as default
      const firstProvider = this.providers.values().next().value;
      return firstProvider;
    }
    return this.providers.get(this.defaultProvider);
  }

  static clear(): void {
    this.providers.clear();
    this.defaultProvider = null;
  }
}
