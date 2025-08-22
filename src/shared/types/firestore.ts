import { z } from 'zod';

// Project types
export const ProjectTypeSchema = z.enum(['PAPER', 'SLIDE', 'DEVOPS']);
export const ProjectStatusSchema = z.enum(['DRAFT', 'BUILDING', 'DONE']);

// Firestore document schemas
export const ProjectSchema = z.object({
  id: z.string(),
  type: ProjectTypeSchema,
  status: ProjectStatusSchema,
  ownerUid: z.string(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  settings: z
    .object({
      isPublic: z.boolean().default(false),
      collaborators: z.array(z.string()).default([]),
      autoSave: z.boolean().default(true),
    })
    .optional(),
});

export const UserProfileSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  photoURL: z.string().url().optional(),
  role: z.enum(['user', 'admin']).default('user'),
  createdAt: z.date(),
  updatedAt: z.date(),
  preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'system']).default('system'),
      language: z.string().default('en'),
      notifications: z.object({
        email: z.boolean().default(true),
        push: z.boolean().default(true),
      }),
    })
    .optional(),
});

export const ActivitySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  action: z.enum(['created', 'updated', 'deleted', 'shared', 'deployed']),
  targetType: z.enum(['project', 'file', 'deployment']),
  targetId: z.string(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.date(),
});

export const ChatSessionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.date(),
      metadata: z
        .object({
          model: z.string().optional(),
          tokens: z.number().optional(),
          citations: z.array(z.string()).optional(),
        })
        .optional(),
    }),
  ),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Type exports
export type ProjectType = z.infer<typeof ProjectTypeSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type ChatSession = z.infer<typeof ChatSessionSchema>;

// Collection names
export const COLLECTIONS = {
  PROJECTS: 'projects',
  USERS: 'users',
  ACTIVITIES: 'activities',
  CHAT_SESSIONS: 'chat_sessions',
} as const;
