/**
 * Provider Configuration v2.0
 * Unified configuration for legacy and modern provider systems
 */

export const USE_LEGACY_PROVIDERS = false; // Forced V2-only for clean architecture
export const DEFAULT_PROVIDER: ProviderId = "openai";
export const DEFAULT_MODEL = process.env.MARIA_DEFAULT_MODEL || "gpt-5-mini-2025-08-07";

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "grok"
  | "ollama"
  | "lmstudio"
  | "vllm";

export interface ProviderRequest {
  model?: string;
  stream?: boolean;
  headers?: Record<string, string>;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderResponseChunk {
  content: string;
  delta?: string;
  finishReason?: string;
}

export interface ProviderStream extends AsyncIterable<ProviderResponseChunk> {}

export interface ProviderResponse {
  content: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: "stop" | "length" | "tool_calls" | "content_filter";
}

export interface ProviderHealth {
  ok: boolean;
  latencyMs?: number;
  reason?: string;
  timestamp?: number;
}

export interface IUnifiedAIProvider {
  id: ProviderId;
  name: string;
  isAvailable(): Promise<boolean>;
  complete(prompt: string, req: ProviderRequest): Promise<ProviderResponse>;
  stream(prompt: string, req: ProviderRequest): Promise<ProviderStream>;
  health(): Promise<ProviderHealth>;
  getModels(): Promise<string[]>;
}

export interface ProviderManagerConfig {
  defaultProvider?: ProviderId;
  fallbackProvider?: ProviderId;
  healthCacheTtl?: number;
  retryAttempts?: number;
  timeout?: number;
}

// Legacy compatibility types (migrated from ai-response/providers/types.ts)
export interface LegacyAIProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LegacyAIProviderRequest {
  messages: LegacyAIProviderMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

export interface LegacyAIProviderResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: "stop" | "length" | "tool_calls" | "content_filter";
}

export interface LegacyAIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface LegacyAIProvider {
  name: string;
  initialize(config: LegacyAIProviderConfig): Promise<void>;
  generateCompletion(
    request: LegacyAIProviderRequest,
  ): Promise<LegacyAIProviderResponse>;
  streamCompletion?(
    request: LegacyAIProviderRequest,
    onChunk: (chunk: string) => void,
  ): Promise<LegacyAIProviderResponse>;
  isAvailable(): boolean;
  getAvailableModels(): string[];
}

export type LegacyProviderType =
  | "openai"
  | "anthropic"
  | "groq"
  | "ollama"
  | "template";

export interface LegacyProviderSelectionCriteria {
  preferredProvider?: LegacyProviderType;
  fallbackProviders?: LegacyProviderType[];
  modelPreference?: string;
  maxLatency?: number;
  maxCost?: number;
}
