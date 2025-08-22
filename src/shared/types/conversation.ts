import { z } from 'zod';

// RTF Structure types
export const RTFTaskSchema = z.object({
  type: z.enum(['paper', 'presentation', 'project', 'code', 'analysis', 'general']),
  intent: z.string(),
  description: z.string(),
  scope: z.enum(['single-action', 'multi-step', 'iterative', 'collaborative']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
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
  format: z.record(z.any()),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.any()),
});

// Execution Step types
export const ExecutionStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['research', 'analysis', 'creation', 'review', 'communication']),
  estimatedTime: z.number(),
  prerequisites: z.array(z.string()),
  deliverables: z.array(z.string()),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'blocked']),
});

// SOW Document types
export const SOWDocumentSchema = z.object({
  projectName: z.string(),
  overview: z.string(),
  objectives: z.array(z.string()),
  deliverables: z.array(z.string()),
  timeline: z.object({
    startDate: z.string(),
    endDate: z.string(),
    milestones: z.array(
      z.object({
        name: z.string(),
        date: z.string(),
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
  status: z.enum(['draft', 'approved', 'in-progress', 'completed', 'cancelled']),
  createdAt: z.date(),
  updatedAt: z.date(),
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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  progress: number;
  estimatedTime: number;
  actualTime?: number;
  error?: string;
  output?: string;
}
