/**
 * AI Provider type definitions
 */

export interface GenerateOptions {
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface GenerateResult {
  code?: string;
  text?: string;
  finishReason?: "stop" | "length" | "error" | "timeout";
  modelId?: string;
  providerId?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalCost?: number;
  };
}

export interface AIProvider {
  id: string;
  modelId: string;
  vendor:
    | "openai"
    | "anthropic"
    | "google"
    | "groq"
    | "xai"
    | "ollama"
    | "lmstudio"
    | "vllm"
    | "template";
  name?: string;

  available(): boolean;
  generate(prompt: string, opts?: GenerateOptions): Promise<GenerateResult>;
  estimateCost?(tokens: number): number;
}

export type IntentLike = {
  type?: string;
  text?: string;
  language?: string;
  framework?: string;
};
