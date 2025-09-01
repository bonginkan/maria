/**
 * Stub Implementations for Ports
 * Immediate BROKEN → PARTIAL upgrade without backend dependencies
 */

import type {
  PlanPort, Plan, QuotaResult,
  MemoryPort, MemoryEntry,
  ProviderPort, ProviderResponse,
  TelemetryPort, TelemetryEvent,
  ContextPort, UserContext, SessionContext,
  UIPort, UIMessage,
  FileSystemPort, FileInfo
} from '../index.js';

/**
 * Stub Plan Port - Returns free tier defaults
 */
export class StubPlanPort implements PlanPort {
  async getCurrentPlan(userId?: string): Promise<Plan> {
    return {
      tier: 'free',
      quotaLeft: 100,
      features: ['basic', 'help', 'version'],
      resetTime: new Date(Date.now() + 86400000) // 24 hours from now
    };
  }

  async checkQuota(command: string, userId?: string): Promise<QuotaResult> {
    return {
      allowed: true,
      remaining: 100,
      resetTime: new Date(Date.now() + 86400000)
    };
  }

  upgradeUrl(): string {
    return 'https://maria-code.ai/upgrade';
  }
}

/**
 * Stub Memory Port - In-memory storage
 */
export class StubMemoryPort implements MemoryPort {
  private memory = new Map<string, any>();

  async remember(key: string, value: any): Promise<void> {
    this.memory.set(key, {
      id: key,
      content: value,
      timestamp: new Date(),
      metadata: {}
    });
  }

  async recall(key: string): Promise<any> {
    const entry = this.memory.get(key);
    return entry?.content || null;
  }

  async forget(key: string): Promise<void> {
    this.memory.delete(key);
  }

  async list(): Promise<MemoryEntry[]> {
    return Array.from(this.memory.values());
  }
}

/**
 * Stub Provider Port - Returns mock responses
 */
export class StubProviderPort implements ProviderPort {
  private currentModel = 'stub-model-1.0';

  async generate(prompt: string, options?: any): Promise<ProviderResponse> {
    return {
      content: `[Stub Response] This is a placeholder response for: "${prompt.slice(0, 50)}..."`,
      model: this.currentModel,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      }
    };
  }

  async listModels(): Promise<string[]> {
    return ['stub-model-1.0', 'stub-model-2.0'];
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  setModel(model: string): void {
    this.currentModel = model;
  }
}

/**
 * Stub Telemetry Port - Collects events in memory
 */
export class StubTelemetryPort implements TelemetryPort {
  private events: TelemetryEvent[] = [];

  emit(eventName: string, properties: Record<string, any>): void {
    this.events.push({
      name: eventName,
      properties,
      timestamp: Date.now()
    });
  }

  async flush(): Promise<void> {
    // In production, would send to telemetry service
    console.debug(`[Telemetry] Flushing ${this.events.length} events`);
    this.events = [];
  }

  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }
}

/**
 * Stub Context Port - Returns default context
 */
export class StubContextPort implements ContextPort {
  getUser(): UserContext | null {
    return {
      id: 'stub-user-123',
      email: 'user@example.com',
      plan: 'free',
      preferences: {}
    };
  }

  getSession(): SessionContext {
    return {
      id: 'stub-session-456',
      startTime: new Date(),
      commands: []
    };
  }

  getWorkingDirectory(): string {
    return process.cwd();
  }

  getEnvironment(): Record<string, string> {
    return {
      NODE_ENV: 'development',
      STUB_MODE: 'true'
    };
  }
}

/**
 * Stub UI Port - Console-based UI
 */
export class StubUIPort implements UIPort {
  display(message: UIMessage): void {
    const prefix = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅'
    }[message.type];
    
    console.log(`${prefix} ${message.content}`);
  }

  async prompt(question: string): Promise<string> {
    console.log(`❓ ${question}`);
    return 'stub-answer';
  }

  async confirm(question: string): Promise<boolean> {
    console.log(`❓ ${question} (y/n)`);
    return true; // Always confirm in stub mode
  }

  showProgress(message: string, percent?: number): void {
    if (percent !== undefined) {
      console.log(`⏳ ${message} (${percent}%)`);
    } else {
      console.log(`⏳ ${message}...`);
    }
  }

  hideProgress(): void {
    // No-op in console mode
  }
}

/**
 * Stub File System Port - Mock file operations
 */
export class StubFileSystemPort implements FileSystemPort {
  private files = new Map<string, string>();

  async read(path: string): Promise<string> {
    return this.files.get(path) || `[Stub Content for ${path}]`;
  }

  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async list(directory: string): Promise<FileInfo[]> {
    return [
      {
        path: `${directory}/stub-file-1.txt`,
        size: 1024,
        modified: new Date(),
        isDirectory: false
      },
      {
        path: `${directory}/stub-dir`,
        size: 0,
        modified: new Date(),
        isDirectory: true
      }
    ];
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }
}

/**
 * Create all stub ports at once
 */
export function createStubPorts() {
  return {
    plan: new StubPlanPort(),
    memory: new StubMemoryPort(),
    provider: new StubProviderPort(),
    telemetry: new StubTelemetryPort(),
    context: new StubContextPort(),
    ui: new StubUIPort(),
    fileSystem: new StubFileSystemPort()
  };
}