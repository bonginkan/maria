/**
 * Port Interfaces for Dependency Injection
 * Replace "missing module" errors with clean interfaces
 */

// Plan Management Port
export interface Plan {
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  quotaLeft: number;
  features: string[];
  resetTime?: Date;
}

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  resetTime?: Date;
}

export interface PlanPort {
  getCurrentPlan(userId?: string): Promise<Plan>;
  checkQuota(command: string, userId?: string): Promise<QuotaResult>;
  upgradeUrl(): string;
}

// Memory System Port
export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MemoryPort {
  remember(key: string, value: any): Promise<void>;
  recall(key: string): Promise<any>;
  forget(key: string): Promise<void>;
  list(): Promise<MemoryEntry[]>;
}

// Provider Port (AI/LLM providers)
export interface ProviderResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ProviderPort {
  generate(prompt: string, options?: any): Promise<ProviderResponse>;
  listModels(): Promise<string[]>;
  getCurrentModel(): string;
  setModel(model: string): void;
}

// Telemetry Port
export interface TelemetryEvent {
  name: string;
  properties: Record<string, any>;
  timestamp: number;
}

export interface TelemetryPort {
  emit(eventName: string, properties: Record<string, any>): void;
  flush(): Promise<void>;
  getEvents(): TelemetryEvent[];
}

// Context Port
export interface UserContext {
  id: string;
  email?: string;
  plan?: string;
  preferences?: Record<string, any>;
}

export interface SessionContext {
  id: string;
  startTime: Date;
  commands: string[];
}

export interface ContextPort {
  getUser(): UserContext | null;
  getSession(): SessionContext;
  getWorkingDirectory(): string;
  getEnvironment(): Record<string, string>;
}

// UI Port
export interface UIMessage {
  type: 'info' | 'warning' | 'error' | 'success';
  content: string;
  timestamp?: Date;
}

export interface UIPort {
  display(message: UIMessage): void;
  prompt(question: string): Promise<string>;
  confirm(question: string): Promise<boolean>;
  showProgress(message: string, percent?: number): void;
  hideProgress(): void;
}

// File System Port
export interface FileInfo {
  path: string;
  size: number;
  modified: Date;
  isDirectory: boolean;
}

export interface FileSystemPort {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(directory: string): Promise<FileInfo[]>;
  delete(path: string): Promise<void>;
}

// Export all ports
export * from './stubs/index.js';