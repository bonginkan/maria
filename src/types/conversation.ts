import { z } from "zod";

// Base conversation types with Zod schemas
export const ConversationMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.coerce.date(),
  model: z.string().optional(),
  tokensUsed: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string;
  tokensUsed?: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationContext {
  id: string;
  messages: ConversationMessage[];
  sessionId: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  config: ConversationConfig;
  preferences?: UserPreferences;
  history?: ConversationHistory[];
  currentTask?: string;
  hasErrors?: boolean;
  isUrgent?: boolean;
  isInteractive?: boolean;
  metadata?: Record<string, unknown>;
}

// Enhanced ConversationHistory with union for type safety
export const ConversationHistorySchema = z.union([
  z.object({
    action: z.literal("save"),
    timestamp: z.coerce.date(),
    data: z.object({
      messageId: z.string(),
      saved: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("command"),
    timestamp: z.coerce.date(),
    data: z.object({
      command: z.string(),
      args: z.array(z.string()),
      success: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("mode_change"),
    timestamp: z.coerce.date(),
    data: z.object({
      from: z.string(),
      to: z.string(),
    }),
  }),
  // Fallback for unknown actions
  z.object({
    action: z.string(),
    timestamp: z.coerce.date(),
    data: z.record(z.unknown()).optional(),
  }),
]);

export interface ConversationHistory {
  timestamp: Date;
  action: string;
  data?: Record<string, unknown>;
}

export interface UserPreferences {
  mode?: "chat" | "research" | "command" | "creative";
  defaultModel?: string;
  temperature?: number;
  maxTokens?: number;
  autoSave?: boolean;
  language?: string;
  theme?: "light" | "dark" | "auto";
  verbosity?: "normal" | "verbose" | "quiet";
  autoMode?: boolean;
}

export interface ConversationConfig {
  model: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
  tools?: string[];
  safetySettings?: SafetySettings;
}

export const SafetySettingsSchema = z.object({
  enableContentFilter: z.boolean().default(true),
  restrictedTopics: z.array(z.string()).default([]),
  maxPromptLength: z.number().default(8000),
  allowFileAccess: z.boolean().default(false),
  allowNetworkAccess: z.boolean().default(false),
});

export interface SafetySettings {
  enableContentFilter: boolean;
  restrictedTopics: string[];
  maxPromptLength: number;
  allowFileAccess: boolean;
  allowNetworkAccess: boolean;
}

// RTF Structure types (re-exported from shared)
export const RTFTaskSchema = z.object({
  type: z.enum([
    "paper",
    "presentation",
    "project",
    "code",
    "analysis",
    "general",
  ]),
  intent: z.string(),
  description: z.string(),
  scope: z.enum(["single-action", "multi-step", "iterative", "collaborative"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  requirements: z.array(z.string()),
  constraints: z.array(z.string()),
  dependencies: z.array(z.string()),
  expectedOutcome: z.string(),
});

export const RTFStructureSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  extractedContent: z.string(),
  role: z.string(),
  task: RTFTaskSchema,
  format: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.unknown()),
});

// Execution Step types
export const ExecutionStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["research", "analysis", "creation", "review", "communication"]),
  estimatedTime: z.number(),
  prerequisites: z.array(z.string()),
  deliverables: z.array(z.string()),
  status: z.enum(["pending", "running", "completed", "failed", "blocked"]),
});

// SOW Document types
export const SOWDocumentSchema = z.object({
  projectName: z.string(),
  overview: z.string(),
  objectives: z.array(z.string()),
  deliverables: z.array(z.string()),
  timeline: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    milestones: z.array(
      z.object({
        name: z.string(),
        date: z.coerce.date(),
        deliverables: z.array(z.string()),
      }),
    ),
  }),
  estimatedCost: z.number(),
  resources: z.array(
    z.object({
      role: z.string(),
      allocation: z.number(),
      skills: z.array(z.string()),
    }),
  ),
});

// Task Plan types
export const TaskPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  rtfStructure: RTFStructureSchema,
  sowDocument: SOWDocumentSchema.optional(),
  executionPlan: z.array(ExecutionStepSchema),
  status: z.enum([
    "draft",
    "approved",
    "in-progress",
    "completed",
    "cancelled",
  ]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Type exports
export type RTFTask = z.infer<typeof RTFTaskSchema>;
export type RTFStructure = z.infer<typeof RTFStructureSchema>;
export type ExecutionStep = z.infer<typeof ExecutionStepSchema>;
export type SOWDocument = z.infer<typeof SOWDocumentSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;

// Task Step for progress tracking
export interface TaskStep {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "blocked";
  progress: number;
  estimatedTime: number;
  actualTime?: number;
  error?: string;
  output?: string;
}

// Command execution context (renamed to avoid collision with slash-commands)
export interface ExecutionContext {
  currentDirectory: string;
  environment: Record<string, string>;
  permissions: string[];
  userId?: string;
  sessionId: string;
}

// Error handling
export interface ConversationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  recoverable: boolean;
}

// I/O Conversion utilities for safe parsing
export const parseConversationMessage = (
  input: unknown,
): ConversationMessage | null => {
  const result = ConversationMessageSchema.safeParse(input);
  return result.success ? (result.data as ConversationMessage) : null;
};

export const parseTaskPlan = (input: unknown): TaskPlan | null => {
  const result = TaskPlanSchema.safeParse(input);
  return result.success ? result.data : null;
};

export const serializeTaskPlan = (
  taskPlan: TaskPlan,
): Record<string, unknown> => {
  return {
    ...taskPlan,
    createdAt: taskPlan.createdAt.toISOString(),
    updatedAt: taskPlan.updatedAt.toISOString(),
    rtfStructure: {
      ...taskPlan.rtfStructure,
      // Handle nested date serialization if needed
    },
    sowDocument: taskPlan.sowDocument
      ? {
          ...taskPlan.sowDocument,
          timeline: {
            ...taskPlan.sowDocument.timeline,
            startDate: taskPlan.sowDocument.timeline.startDate.toISOString(),
            endDate: taskPlan.sowDocument.timeline.endDate.toISOString(),
            milestones: taskPlan.sowDocument.timeline.milestones.map((m) => ({
              ...m,
              date: m.date.toISOString(),
            })),
          },
        }
      : undefined,
  };
};

// Enhanced SafetySettings factory with defaults
export const createSafetySettings = (
  overrides?: Partial<SafetySettings>,
): SafetySettings => {
  const result = SafetySettingsSchema.parse(overrides || object);
  return result as SafetySettings;
};
