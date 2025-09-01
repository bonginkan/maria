/**
 * Enhanced Context Types for V2 Commands
 * Improved type definitions with strict schemas
 */

// Base types
export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  id?: string;
}

export interface CommandOptions {
  timeout?: number;
  signal?: AbortSignal;
  traceId?: string;
  userId?: string;
  [key: string]: any;
}

// Provider types (improved)
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: {
    streaming: boolean;
    functions: boolean;
    vision: boolean;
    maxTokens?: number;
    contextWindow?: number;
  };
  status: "available" | "unavailable" | "deprecated";
}

export interface ProviderPort {
  listModels(options?: { signal?: AbortSignal }): Promise<ModelInfo[]>;
  switchModel(
    modelId: string,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  getModelInfo(
    modelId?: string,
    options?: { signal?: AbortSignal },
  ): Promise<ModelInfo>;
}

// Memory types (schema-enforced)
export interface MemoryMetadata {
  timestamp: string; // ISO string - required
  importance: number; // 0-1 range - required
  type: string; // Required for categorization
  tags?: string[];
  userId?: string;
  sessionId?: string;
  traceId?: string;
  expiresAt?: string;
  [key: string]: any;
}

export interface MemoryContent {
  type: string; // Schema identifier - required
  content: any; // The actual data
  metadata: MemoryMetadata; // Required metadata
}

export interface MemoryQuery {
  query?: string;
  type?: string;
  tags?: string[];
  limit?: number;
  minImportance?: number;
  maxAge?: number;
  userId?: string;
}

export interface MemoryResult {
  id: string;
  content: any;
  metadata: MemoryMetadata;
  score?: number; // Relevance score
  source: "L1" | "L2" | "L3" | "vector" | "graph" | "keyword";
}

export interface MemoryPort {
  store(
    content: MemoryContent,
    options?: { signal?: AbortSignal },
  ): Promise<string>;
  query(
    query: MemoryQuery,
    options?: { signal?: AbortSignal },
  ): Promise<MemoryResult[]>;
  clear(
    filter?: MemoryQuery,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  getStats(options?: { signal?: AbortSignal }): Promise<MemoryStats>;
}

export interface MemoryStats {
  total: number;
  byType: Record<string, number>;
  avgImportance: number;
  oldestTimestamp: string;
  newestTimestamp: string;
  totalSize: number;
}

// Context types
export interface ContextOptions {
  maxMessages?: number;
  maxTokens?: number;
  preserveImportant?: boolean;
}

export interface ContextPort {
  addMessage(
    message: Message,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  getMessages(
    filter?: { limit?: number; since?: string },
    options?: { signal?: AbortSignal },
  ): Promise<Message[]>;
  clear(options?: {
    preserveImportant?: boolean;
    signal?: AbortSignal;
  }): Promise<void>;
  getTokenCount(options?: { signal?: AbortSignal }): Promise<number>;
  compress(options?: { signal?: AbortSignal }): Promise<void>;
}

// UI types (enhanced)
export interface UiMessage {
  content: string;
  type: "info" | "success" | "warning" | "error" | "debug";
  timestamp?: string;
  category?: string;
}

export interface UiPrompt {
  message: string;
  type?: "text" | "password" | "confirm";
  defaultValue?: string;
  validation?: (input: string) => boolean | string;
}

export interface UiProgress {
  message?: string;
  percentage?: number; // 0-100
  stage?: string;
  eta?: number; // seconds remaining
}

export interface UiPort {
  display(
    message: UiMessage,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  prompt(prompt: UiPrompt, options?: { signal?: AbortSignal }): Promise<string>;
  confirm(
    message: string,
    options?: { signal?: AbortSignal },
  ): Promise<boolean>;
  select(
    message: string,
    choices: string[],
    options?: { signal?: AbortSignal },
  ): Promise<string>;
  showProgress(
    progress: UiProgress,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  showError(message: string, options?: { signal?: AbortSignal }): Promise<void>;
  showSuccess(
    message: string,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  showWarning(
    message: string,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
}

// Command types
export interface HandlerDependencies {
  provider: ProviderPort;
  memory: MemoryPort;
  context: ContextPort;
  ui: UiPort;
}

export interface CommandContext {
  command: string;
  args: string[];
  options: CommandOptions;
  deps: HandlerDependencies;
  signal?: AbortSignal;
  traceId?: string;
}

export interface CommandResult {
  success: boolean;
  error?: string;
  messages: Message[];
  data?: any;
  metrics?: {
    startTime: number;
    endTime: number;
    duration: number;
    memoryAccess: number;
    providerCalls: number;
  };
}

// Tracing types
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "pending" | "success" | "error";
  error?: string;
  metadata?: Record<string, any>;
}

export interface TraceContext {
  traceId: string;
  spans: TraceSpan[];
  startTime: number;
  endTime?: number;
  userId?: string;
  command?: string;
}

// Validation helpers
export function validateMemoryContent(content: MemoryContent): MemoryContent {
  // Ensure required fields
  if (!content.type) {
    throw new Error("Memory content must have a type");
  }

  if (!content.metadata.timestamp) {
    content.metadata.timestamp = new Date().toISOString();
  }

  if (
    content.metadata.importance === undefined ||
    content.metadata.importance === null
  ) {
    content.metadata.importance = 0.5;
  }

  // Clamp importance to 0-1 range
  content.metadata.importance = Math.max(
    0,
    Math.min(1, content.metadata.importance),
  );

  if (!content.metadata.type) {
    content.metadata.type = content.type;
  }

  return content;
}

export function validateModelInfo(model: any): ModelInfo {
  return {
    id: model.id || model.name || "unknown",
    name: model.name || model.id || "Unknown Model",
    provider: model.provider || "unknown",
    capabilities: {
      streaming: Boolean(model.capabilities?.streaming),
      functions: Boolean(model.capabilities?.functions),
      vision: Boolean(model.capabilities?.vision),
      maxTokens: model.capabilities?.maxTokens,
      contextWindow: model.capabilities?.contextWindow,
    },
    status: ["available", "unavailable", "deprecated"].includes(model.status)
      ? model.status
      : "available",
  };
}

// Error types for better classification
export interface TypedError extends Error {
  code: string;
  type: string;
  originalError?: Error;
  context?: Record<string, any>;
}
