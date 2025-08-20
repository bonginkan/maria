/**
 * Slash Command Type Definitions
 * Core types for the microservice-based command architecture
 */

import { ConversationContext } from '../types/conversation';

export type CommandCategory =
  | 'auth'
  | 'config'
  | 'project'
  | 'development'
  | 'media'
  | 'conversation'
  | 'advanced'
  | 'system';

export interface CommandArgs {
  raw: string[];
  parsed: Record<string, unknown>;
  flags: Record<string, boolean>;
  options: Record<string, string>;
}

export interface CommandContext {
  conversation: ConversationContext;
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
  session: {
    id: string;
    startTime: Date;
    commandHistory: string[];
  };
  environment: {
    cwd: string;
    platform: string;
    nodeVersion: string;
  };
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  component?: ComponentType;
  requiresInput?: boolean;
  metadata?: {
    executionTime: number;
    memoryUsed?: number;
    commandVersion?: string;
  };
}

export type ComponentType =
  | 'config-panel'
  | 'auth-flow'
  | 'help-dialog'
  | 'status-display'
  | 'system-diagnostics'
  | 'cost-display'
  | 'agents-display'
  | 'mcp-display'
  | 'model-selector'
  | 'image-generator'
  | 'video-generator'
  | 'avatar-generator'
  | 'voice-assistant';

export interface ValidationResult {
  success: boolean;
  error?: string;
  suggestions?: string[];
}

export interface CommandMetadata {
  version: string;
  author: string;
  deprecated?: boolean;
  experimental?: boolean;
  since?: string;
  replacedBy?: string;
}

export interface CommandPermission {
  role?: string;
  scope?: string[];
  requiresAuth?: boolean;
  requiresPremium?: boolean;
}

export interface CommandExample {
  input: string;
  description: string;
  output?: string;
}

export interface ISlashCommand {
  // Identity
  name: string;
  aliases?: string[];
  category: CommandCategory;

  // Documentation
  description: string;
  usage: string;
  examples: CommandExample[];

  // Configuration
  permissions?: CommandPermission;
  middleware?: string[]; // Middleware names to apply
  rateLimit?: {
    requests: number;
    window: string; // e.g., '1m', '1h'
  };

  // Lifecycle methods
  initialize?(): Promise<void>;
  validate?(args: CommandArgs): Promise<ValidationResult>;
  execute(args: CommandArgs, context: CommandContext): Promise<CommandResult>;
  cleanup?(): Promise<void>;
  rollback?(context: CommandContext, error: Error): Promise<void>;

  // Metadata
  metadata: CommandMetadata;
}

// Middleware types
export type MiddlewareNext = () => Promise<CommandResult>;

export interface IMiddleware {
  name: string;
  priority?: number;
  execute(
    command: ISlashCommand,
    args: CommandArgs,
    context: CommandContext,
    next: MiddlewareNext,
  ): Promise<CommandResult>;
}

// Decorator metadata types
export interface CommandConfig {
  name: string;
  category: CommandCategory;
  description: string;
  aliases?: string[];
  usage?: string;
  examples?: CommandExample[];
  permissions?: CommandPermission;
  middleware?: string[];
  rateLimit?: {
    requests: number;
    window: string;
  };
  metadata?: Partial<CommandMetadata>;
}

// Error types
export class CommandError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

export class ValidationError extends CommandError {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends CommandError {
  constructor(
    message: string,
    public requiredRole?: string,
  ) {
    super(message, 'PERMISSION_ERROR', 403);
    this.name = 'PermissionError';
  }
}

export class RateLimitError extends CommandError {
  constructor(
    message: string,
    public retryAfter?: number,
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}
