/**
 * MARIA CODE Unified AI Provider Interface
 * Supports both cloud APIs and local models
 */

// Core message types
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | MessageContent[];
  name?: string;
  function_call?: FunctionCall;
}

export interface MessageContent {
  type: 'text' | 'image_url' | 'image';
  text?: string;
  image_url?: {
    url: string; // Can be URL or base64 data:image/...
    detail?: 'low' | 'high' | 'auto';
  };
  image?: Buffer; // For binary image data
}

export interface FunctionCall {
  name: string;
  arguments: string; // JSON string
}

// Provider capabilities
export interface AICapabilities {
  chat: boolean;
  vision: boolean;
  code: boolean;
  streaming: boolean;
  embeddings: boolean;
  functionCalling: boolean;
  maxTokens: number;
  contextWindow: number;
  multiModal: boolean;
  languages: string[]; // Supported languages
}

// Model information
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  version?: string;
  contextLength: number;
  tokenLimit: number;
  capabilities: string[];
  performance?: {
    tokensPerSecond?: number;
    latencyMs?: number;
    throughput?: number;
  };
  requirements?: {
    vram?: number; // in GB
    ram?: number; // in GB
    diskSpace?: number; // in GB
  };
  pricing?: {
    inputTokens: number; // per 1K tokens
    outputTokens: number; // per 1K tokens
    imageAnalysis?: number; // per image
  };
}

// Chat options
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  responseFormat?: 'text' | 'json' | 'markdown';
  seed?: number;
  tools?: Tool[];
}

// Stream options
export interface StreamOptions extends ChatOptions {
  onToken?: (token: string) => void;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

// Tool/Function definitions
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

// Vision-specific options
export interface VisionOptions {
  maxImageSize?: number; // Max dimension in pixels
  imageQuality?: 'low' | 'medium' | 'high';
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
  outputFormat?: 'text' | 'json' | 'structured';
}

// Code generation options
export interface CodeOptions {
  language?: string;
  framework?: string;
  style?: 'concise' | 'verbose' | 'documented';
  includeTests?: boolean;
  includeComments?: boolean;
  followConventions?: boolean;
}

// Embedding options
export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  normalize?: boolean;
}

// Response types
export interface AIResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
  metadata?: {
    finishReason?: 'stop' | 'length' | 'function_call' | 'error';
    processingTime?: number;
    cacheHit?: boolean;
  };
  functionCalls?: FunctionCall[];
}

export interface VisionResponse extends AIResponse {
  detectedObjects?: Array<{
    label: string;
    confidence: number;
    boundingBox?: [number, number, number, number];
  }>;
  imageDescription?: string;
  extractedText?: string;
}

export interface CodeResponse extends AIResponse {
  code: string;
  language: string;
  explanation?: string;
  dependencies?: string[];
  testCode?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimensions: number;
  usage?: {
    totalTokens: number;
  };
}

// Main AI Provider Interface
export interface AIProvider {
  // Provider metadata
  readonly name: string;
  readonly type: 'cloud' | 'local';
  readonly version: string;
  readonly capabilities: AICapabilities;

  // Initialization
  initialize(config?: ProviderConfig): Promise<void>;
  validateConnection(): Promise<boolean>;

  // Core chat functionality
  chat(messages: Message[], options?: ChatOptions): Promise<AIResponse>;
  stream(messages: Message[], options?: StreamOptions): AsyncGenerator<string, void, void>;

  // Specialized features (optional)
  vision?(image: Buffer | string, prompt: string, options?: VisionOptions): Promise<VisionResponse>;
  generateCode?(prompt: string, options?: CodeOptions): Promise<CodeResponse>;
  embeddings?(
    text: string | string[],
    options?: EmbeddingOptions,
  ): Promise<EmbeddingResponse | EmbeddingResponse[]>;

  // Model management
  listModels(): Promise<ModelInfo[]>;
  getModelInfo(modelId?: string): Promise<ModelInfo>;
  loadModel?(modelId: string): Promise<void>;
  unloadModel?(modelId: string): Promise<void>;

  // Cost and usage
  estimateCost?(tokens: number, operation?: 'input' | 'output'): number;
  getUsage?(): Promise<UsageStats>;

  // Cleanup
  dispose(): Promise<void>;
}

// Provider configuration
export interface ProviderConfig {
  apiKey?: string;
  apiBase?: string;
  organization?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  proxy?: {
    host: string;
    port: number;
    auth?: {
      username: string;
      password: string;
    };
  };
  customHeaders?: Record<string, string>;
  // Local model specific
  modelPath?: string;
  gpuLayers?: number;
  contextLength?: number;
  batchSize?: number;
}

// Usage statistics
export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost?: number;
  averageLatency: number;
  successRate: number;
  periodStart: Date;
  periodEnd: Date;
  breakdown?: {
    byModel?: Record<string, number>;
    byOperation?: Record<string, number>;
  };
}

// Provider factory
export interface AIProviderFactory {
  create(type: string, config?: ProviderConfig): AIProvider;
  register(type: string, providerClass: new (config?: ProviderConfig) => AIProvider): void;
  getAvailable(): string[];
  getRecommended(task: TaskType): string;
}

// Task types for routing
export enum TaskType {
  CHAT = 'chat',
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  VISION_ANALYSIS = 'vision_analysis',
  TRANSLATION = 'translation',
  SUMMARIZATION = 'summarization',
  QUESTION_ANSWERING = 'question_answering',
  CREATIVE_WRITING = 'creative_writing',
  DATA_EXTRACTION = 'data_extraction',
  EMBEDDING = 'embedding',
}

// Error types
export class AIProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class ModelNotFoundError extends AIProviderError {
  constructor(modelId: string, provider?: string) {
    super(`Model ${modelId} not found`, 'MODEL_NOT_FOUND', provider, false);
  }
}

export class RateLimitError extends AIProviderError {
  constructor(provider: string, retryAfter?: number) {
    super(
      `Rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      'RATE_LIMIT',
      provider,
      true,
    );
  }
}

export class AuthenticationError extends AIProviderError {
  constructor(provider: string) {
    super('Authentication failed', 'AUTH_FAILED', provider, false);
  }
}

// Helper type guards
export function hasVisionCapability(
  provider: AIProvider,
): provider is AIProvider & Required<Pick<AIProvider, 'vision'>> {
  return provider.capabilities.vision && typeof provider.vision === 'function';
}

export function hasCodeCapability(
  provider: AIProvider,
): provider is AIProvider & Required<Pick<AIProvider, 'generateCode'>> {
  return provider.capabilities.code && typeof provider.generateCode === 'function';
}

export function hasEmbeddingCapability(
  provider: AIProvider,
): provider is AIProvider & Required<Pick<AIProvider, 'embeddings'>> {
  return provider.capabilities.embeddings && typeof provider.embeddings === 'function';
}

// Base implementation class (optional, for extending)
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly type: 'cloud' | 'local';
  abstract readonly version: string;
  abstract readonly capabilities: AICapabilities;

  protected config: ProviderConfig;
  protected initialized: boolean = false;

  constructor(config?: ProviderConfig) {
    this.config = config || {};
  }

  async initialize(config?: ProviderConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.initialized = true;
  }

  abstract validateConnection(): Promise<boolean>;
  abstract chat(messages: Message[], options?: ChatOptions): Promise<AIResponse>;
  abstract stream(messages: Message[], options?: StreamOptions): AsyncGenerator<string, void, void>;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract getModelInfo(modelId?: string): Promise<ModelInfo>;

  async dispose(): Promise<void> {
    this.initialized = false;
  }

  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new AIProviderError('Provider not initialized', 'NOT_INITIALIZED', this.name);
    }
  }
}
