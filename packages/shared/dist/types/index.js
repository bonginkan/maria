// src/types/firestore.ts
import { z } from "zod";
var ProjectTypeSchema = z.enum(["PAPER", "SLIDE", "DEVOPS"]);
var ProjectStatusSchema = z.enum(["DRAFT", "BUILDING", "DONE"]);
var ProjectSchema = z.object({
  id: z.string(),
  type: ProjectTypeSchema,
  status: ProjectStatusSchema,
  ownerUid: z.string(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  settings: z.object({
    isPublic: z.boolean().default(false),
    collaborators: z.array(z.string()).default([]),
    autoSave: z.boolean().default(true)
  }).optional()
});
var UserProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  photoURL: z.string().url().optional(),
  role: z.enum(["user", "admin"]).default("user"),
  createdAt: z.date(),
  updatedAt: z.date(),
  preferences: z.object({
    theme: z.enum(["light", "dark", "system"]).default("system"),
    language: z.string().default("en"),
    notifications: z.object({
      email: z.boolean().default(true),
      push: z.boolean().default(true)
    })
  }).optional()
});
var ActivitySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  action: z.enum(["created", "updated", "deleted", "shared", "deployed"]),
  targetType: z.enum(["project", "file", "deployment"]),
  targetId: z.string(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.date()
});
var ChatSessionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    timestamp: z.date(),
    metadata: z.object({
      model: z.string().optional(),
      tokens: z.number().optional(),
      citations: z.array(z.string()).optional()
    }).optional()
  })),
  createdAt: z.date(),
  updatedAt: z.date()
});
var COLLECTIONS = {
  PROJECTS: "projects",
  USERS: "users",
  ACTIVITIES: "activities",
  CHAT_SESSIONS: "chat_sessions"
};

// src/types/conversation.ts
import { z as z2 } from "zod";
var RTFTaskSchema = z2.object({
  type: z2.enum(["paper", "presentation", "project", "code", "analysis", "general"]),
  intent: z2.string(),
  description: z2.string(),
  scope: z2.enum(["single-action", "multi-step", "iterative", "collaborative"]),
  priority: z2.enum(["low", "medium", "high", "urgent"]),
  requirements: z2.array(z2.string()),
  constraints: z2.array(z2.string()),
  dependencies: z2.array(z2.string()),
  expectedOutcome: z2.string()
});
var RTFStructureSchema = z2.object({
  id: z2.string(),
  fileName: z2.string(),
  extractedContent: z2.string(),
  role: z2.string(),
  task: RTFTaskSchema,
  format: z2.record(z2.any()),
  confidence: z2.number().min(0).max(1),
  metadata: z2.record(z2.any())
});
var ExecutionStepSchema = z2.object({
  id: z2.string(),
  name: z2.string(),
  description: z2.string(),
  type: z2.enum(["research", "analysis", "creation", "review", "communication"]),
  estimatedTime: z2.number(),
  prerequisites: z2.array(z2.string()),
  deliverables: z2.array(z2.string()),
  status: z2.enum(["pending", "running", "completed", "failed", "blocked"])
});
var SOWDocumentSchema = z2.object({
  projectName: z2.string(),
  overview: z2.string(),
  objectives: z2.array(z2.string()),
  deliverables: z2.array(z2.string()),
  timeline: z2.object({
    startDate: z2.string(),
    endDate: z2.string(),
    milestones: z2.array(z2.object({
      name: z2.string(),
      date: z2.string(),
      deliverables: z2.array(z2.string())
    }))
  }),
  estimatedCost: z2.number(),
  resources: z2.array(z2.object({
    role: z2.string(),
    allocation: z2.number(),
    skills: z2.array(z2.string())
  }))
});
var TaskPlanSchema = z2.object({
  id: z2.string(),
  title: z2.string(),
  description: z2.string(),
  rtfStructure: RTFStructureSchema,
  sowDocument: SOWDocumentSchema.optional(),
  executionPlan: z2.array(ExecutionStepSchema),
  status: z2.enum(["draft", "approved", "in-progress", "completed", "cancelled"]),
  createdAt: z2.date(),
  updatedAt: z2.date()
});
export {
  ActivitySchema,
  COLLECTIONS,
  ChatSessionSchema,
  ExecutionStepSchema,
  ProjectSchema,
  ProjectStatusSchema,
  ProjectTypeSchema,
  RTFStructureSchema,
  RTFTaskSchema,
  SOWDocumentSchema,
  TaskPlanSchema,
  UserProfileSchema
};
//# sourceMappingURL=index.js.map