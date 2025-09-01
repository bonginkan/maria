import { z } from "zod";

/**
 * Runtime-validated command result schema
 */
export const CommandResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
  component: z.string().optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Type-safe command result
 */
export type CommandResult = z.infer<typeof CommandResultSchema>;

/**
 * Legacy result format (for backward compatibility)
 */
export const LegacyResultSchema = z.object({
  _success: z.boolean().optional(),
  _message: z.string().optional(),
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.any().optional(),
  _data: z.any().optional(),
  component: z.string().optional(),
});

export type LegacyResult = z.infer<typeof LegacyResultSchema>;

/**
 * Command context passed to all commands
 */
export interface CommandContext {
  preferences: {
    defaultModel: string;
    [key: string]: any;
  };
  sessionMemory: Array<{ role: string; content: string }>;
  stats: {
    totalTokens: number;
    totalCost: number;
    sessionStart: number;
  };
  lastResponse: any;
  env?: {
    isTTY?: boolean;
    isCI?: boolean;
  };
}

/**
 * Command arguments
 */
export interface CommandArgs {
  command: string;
  args: string[];
  flags: Record<string, boolean | string>;
  raw: string;
}

/**
 * Command handler function type
 */
export type CommandHandler = (
  args: CommandArgs,
  context: CommandContext,
) => Promise<CommandResult> | CommandResult;

/**
 * Command metadata for registration
 */
export interface CommandMetadata {
  name: string;
  aliases?: string[];
  description: string;
  category: string;
  usage?: string;
  examples?: string[];
  flags?: Record<string, string>;
}

/**
 * Standard error codes
 */
export enum ErrorCode {
  UNKNOWN_COMMAND = "UNKNOWN_COMMAND",
  INVALID_ARGS = "INVALID_ARGS",
  PROVIDER_ERROR = "PROVIDER_ERROR",
  FILE_ERROR = "FILE_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  PERMISSION_ERROR = "PERMISSION_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Standard error response
 */
export interface ErrorResult extends CommandResult {
  success: false;
  error: string;
  code?: ErrorCode;
  details?: any;
}
