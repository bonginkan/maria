/**
 * CommandContext - Enhanced context management for command execution
 * - Provides rich context for command handlers
 * - Supports context inheritance and modification
 * - Thread-safe and immutable by default
 */

import type { ConversationContext } from "../../types/conversation";

export interface User {
  id?: string;
  role?: string;
  name?: string;
  email?: string;
  permissions?: string[];
}

export interface _Session {
  id: string;
  startedAt: Date;
  lastActivityAt: Date;
  commandHistory?: string[];
  metadata?: Record<string, unknown>;
}

export interface ExecutionMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: {
    before: NodeJS.MemoryUsage;
    after?: NodeJS.MemoryUsage;
  };
}

export interface CommandContextData {
  // Core context
  command: string;
  args: string[];
  rawInput?: string;

  // User and session
  user?: User | null;
  session?: Session;
  sessionId?: string;

  // Preferences and configuration
  preferences?: Record<string, unknown>;
  config?: Record<string, unknown>;

  // Execution metadata
  timestamp?: number;
  requestId?: string;
  parentCommand?: string;
  depth?: number;

  // Performance tracking
  metrics?: ExecutionMetrics;

  // Legacy compatibility
  conversationContext?: ConversationContext;
  metadata?: Record<string, unknown>;

  // Extensibility
  [key: string]: unknown;
}

export class CommandContext {
  private data: Readonly<CommandContextData>;

  constructor(data: CommandContextData) {
    this.data = Object.freeze({ ...data });
  }

  /**
   * Get the full context data
   */
  getData(): Readonly<CommandContextData> {
    return this.data;
  }

  /**
   * Get a specific context value
   */
  get<K extends keyof CommandContextData>(key: K): CommandContextData[K] {
    return this.data[key];
  }

  /**
   * Check if a context key exists
   */
  has(key: string): boolean {
    return key in this.data;
  }

  /**
   * Create a new context with additional data (immutable)
   */
  with(updates: Partial<CommandContextData>): CommandContext {
    return new CommandContext({
      ...this.data,
      ...updates,
    });
  }

  /**
   * Create a new context without specific keys
   */
  without(...keys: string[]): CommandContext {
    const newData = { ...this.data };
    for (const key of keys) {
      delete newData[key];
    }
    return new CommandContext(newData);
  }

  /**
   * Merge with another context (other context takes precedence)
   */
  merge(other: CommandContext | CommandContextData): CommandContext {
    const otherData = other instanceof CommandContext ? other.getData() : other;
    return new CommandContext({
      ...this.data,
      ...otherData,
    });
  }

  /**
   * Create a child context (for nested command execution)
   */
  createChild(command: string, args: string[]): CommandContext {
    return new CommandContext({
      ...this.data,
      parentCommand: this.data.command,
      command,
      args,
      depth: (this.data.depth ?? 0) + 1,
      metrics: {
        startTime: Date.now(),
      },
    });
  }

  /**
   * Start performance tracking
   */
  startMetrics(): CommandContext {
    return this.with({
      metrics: {
        startTime: Date.now(),
        memoryUsage: {
          before: process.memoryUsage(),
        },
      },
    });
  }

  /**
   * End performance tracking
   */
  endMetrics(): CommandContext {
    const metrics = this.data.metrics;
    if (!metrics) return this;

    const endTime = Date.now();
    return this.with({
      metrics: {
        ...metrics,
        endTime,
        duration: endTime - metrics.startTime,
        memoryUsage: metrics.memoryUsage
          ? {
              ...metrics.memoryUsage,
              after: process.memoryUsage(),
            }
          : undefined,
      },
    });
  }

  /**
   * Convert to plain object (for serialization)
   */
  toJSON(): CommandContextData {
    return { ...this.data };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data: CommandContextData): CommandContext {
    return new CommandContext(data);
  }

  /**
   * Create a minimal context
   */
  static create(
    command: string,
    args: string[] = [],
    extras: Partial<CommandContextData> = {},
  ): CommandContext {
    return new CommandContext({
      command,
      args,
      timestamp: Date.now(),
      requestId: generateRequestId(),
      ...extras,
    });
  }

  /**
   * Create from legacy format
   */
  static fromLegacy(data: {
    sessionId?: string;
    user?: { id?: string; role?: string } | null;
    preferences?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  }): CommandContext {
    return new CommandContext({
      command: "",
      args: [],
      ...data,
    } as CommandContextData);
  }

  /**
   * Convert to legacy format
   */
  toLegacy(): {
    sessionId?: string;
    user?: { id?: string; role?: string } | null;
    preferences?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  } {
    const { command, args, ...rest } = this.data;
    return rest;
  }
}

/**
 * Context builder for fluent API
 */
export class CommandContextBuilder {
  private data: Partial<CommandContextData> = {};

  command(command: string): this {
    this.data.command = command;
    return this;
  }

  args(args: string[]): this {
    this.data.args = args;
    return this;
  }

  user(user: User | null | undefined): this {
    this.data.user = user;
    return this;
  }

  session(session: Session): this {
    this.data.session = session;
    return this;
  }

  sessionId(id: string): this {
    this.data.sessionId = id;
    return this;
  }

  preferences(prefs: Record<string, unknown>): this {
    this.data.preferences = prefs;
    return this;
  }

  metadata(metadata: Record<string, unknown>): this {
    this.data.metadata = metadata;
    return this;
  }

  requestId(id: string): this {
    this.data.requestId = id;
    return this;
  }

  set(key: string, value: unknown): this {
    this.data[key] = value;
    return this;
  }

  build(): CommandContext {
    if (!this.data.command) {
      throw new Error("Command is required for CommandContext");
    }

    return new CommandContext({
      args: [],
      timestamp: Date.now(),
      requestId: generateRequestId(),
      ...this.data,
    } as CommandContextData);
  }
}

/**
 * Helper function to generate request IDs
 */
function generateRequestId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Export builder factory
 */
export function createContext(): CommandContextBuilder {
  return new CommandContextBuilder();
}
