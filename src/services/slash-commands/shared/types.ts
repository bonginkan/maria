/**
 * Shared types for Slash Command system
 */

import { ConversationContext } from "../../../types/conversation";

export type CommandCategory =
  | "core" // CoreCommandService
  | "generation" // GenerationCommandService
  | "analysis" // AnalysisCommandService
  | "configuration" // ConfigurationCommandService
  | "development" // DevelopmentCommandService
  | "media" // MediaCommandService
  | "system"; // SystemCommandService

export interface SlashCommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  requiresInput?: boolean;
  component?:
    | "config-panel"
    | "auth-flow"
    | "help-dialog"
    | "status-display"
    | "system-diagnostics"
    | "cost-display"
    | "agents-display"
    | "mcp-display"
    | "model-selector"
    | "image-generator"
    | "video-generator"
    | "avatar-interface";
  suggestions?: string;
}

export type { ConversationContext };
