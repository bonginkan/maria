/**
 * MARIA Type Definitions
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: Message[];
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  image?: Buffer;
  taskType?: TaskType;
}

export interface AIResponse {
  content?: string;
  stream?: AsyncGenerator<string>;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  responseTime?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextLength: number;
  capabilities: string[];
  pricing?: {
    input: number;
    output: number;
  };
  local?: boolean;
  available: boolean;
  memoryRequired?: string;
  recommendedFor: string[];
}

export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;
  apiBase?: string;
  models: Record<string, ModelInfo>;
}

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  getModels(): Promise<ModelInfo[]>;
  chat(request: AIRequest): Promise<AIResponse>;
  vision?(image: Buffer, prompt: string): Promise<AIResponse>;
  generateCode?(prompt: string, language?: string): Promise<AIResponse>;
  estimateCost?(tokens: number): number;
}

export type TaskType =
  | 'chat'
  | 'coding'
  | 'reasoning'
  | 'vision'
  | 'quick_tasks'
  | 'cost_effective'
  | 'privacy'
  | 'multilingual'
  | 'current_events';

export type PriorityMode = 'privacy-first' | 'performance' | 'cost-effective' | 'auto';

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  system: {
    cpu: number;
    memory: number;
    disk: number;
  };
  services: {
    lmstudio: ServiceStatus;
    ollama: ServiceStatus;
    vllm: ServiceStatus;
  };
  cloudAPIs: {
    openai: ServiceStatus;
    anthropic: ServiceStatus;
    google: ServiceStatus;
    groq: ServiceStatus;
    grok: ServiceStatus;
  };
  recommendations: string[];
}

export interface ServiceStatus {
  status: 'running' | 'stopped' | 'error' | 'available' | 'unavailable';
  responseTime?: number;
  lastCheck: string;
  details?: unknown;
}

export interface Config {
  priority: PriorityMode;
  providers: Record<string, ProviderConfig>;
  autoStart: boolean;
  healthMonitoring: boolean;
  language: string;
  offlineMode: boolean;
}
