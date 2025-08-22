/**
 * Common Type Definitions
 * Shared types across the application
 */

import type { CSSProperties, ReactNode } from 'react';

export interface CommandOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  verbose?: boolean;
  output?: string;
  format?: 'json' | 'text' | 'markdown';
}

export interface AnalysisResult {
  metrics: Record<string, number>;
  communities: Array<{
    id: string;
    name: string;
    nodes: string[];
    size: number;
  }>;
  paths: Array<{
    nodes: string[];
    cost: number;
    type: string;
  }>;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface WorkflowStep {
  id: string;
  type: string;
  params: Record<string, unknown>;
  result?: unknown;
}

// Approval workflow types
export interface ApprovalWorkflow {
  workflow_id: string;
  suggestion_id: string;
  priority_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  description?: string;
}

// Performance metrics types
export interface PerformanceMetrics {
  // Core metrics
  total_suggestions_generated: number;
  suggestions_accepted: number;
  suggestions_rejected: number;
  suggestions_generated_total: number;
  success_rate: number;
  average_implementation_time_ms: number;
  response_time_ms: number;

  // System metrics
  cpu_usage: number;
  memory_usage: number;
  memory_usage_mb?: number;
  cpu_usage_percent?: number;
  error_count?: number;
  uptime_seconds?: number;

  // Quality metrics
  rollback_rate: number;
  impact_distribution: {
    low: number;
    medium: number;
    high: number;
  };

  // Safety metrics
  safety_violations_total: number;
  violations_detected: number;
  current_safety_score: number;
  manual_reviews_required: number;
  total_checks_performed: number;

  // User metrics
  user_satisfaction_score: number;
  automation_rate: number;
  time_to_approval_avg_hours: number;
}

// GitHub API types
export interface GitHubComment {
  id: number;
  body: string;
  createdAt: string;
  author: {
    login: string;
  };
  url?: string;
}

export interface GitHubReview {
  id: number;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'PENDING' | 'COMMENTED' | 'DISMISSED';
  body: string;
  createdAt: string;
  author: {
    login: string;
  };
  url?: string;
}

export interface GitHubPRData {
  comments: GitHubComment[];
  reviews: GitHubReview[];
}

export type GitHubFeedbackItem =
  | (GitHubComment & { type: 'comment' })
  | (GitHubReview & { type: 'review' });

// SOW (Statement of Work) types
export interface SOWTask {
  id?: string;
  name: string;
  description?: string;
  timeEstimate?: string;
  dependencies?: string[];
  assignee?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'pending' | 'in_progress' | 'completed';
}

export interface SOWDeliverable {
  name: string;
  description?: string;
  dueDate?: string;
  format?: string;
}

export interface SOWData {
  title: string;
  description?: string;
  objective?: string;
  scope?: string[];
  tasks: SOWTask[];
  deliverables?: SOWDeliverable[];
  timeline?: string;
  budget?: string;
  assumptions?: string[];
  constraints?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
  startLabel?: string;
  endLabel?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Community {
  id: string;
  name: string;
  nodes: string[];
  size: number;
  metrics?: Record<string, number>;
}

export interface PathResult {
  nodes: string[];
  cost: number;
  type: string;
  distance?: number;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  system: {
    cpu: number;
    memory: number;
    disk: number;
  };
  services: {
    lmstudio: ServiceStatus;
    ollama: ServiceStatus;
    vllm: ServiceStatus;
  };
  cloudAPIs: {
    openai: ServiceStatus;
    anthropic: ServiceStatus;
    google: ServiceStatus;
    groq: ServiceStatus;
    grok: ServiceStatus;
  };
  recommendations: string[];
}

export interface ServiceStatus {
  status: 'running' | 'stopped' | 'error' | 'available' | 'unavailable';
  responseTime?: number;
  lastCheck: string;
  details?: unknown;
}

export interface Dictionary {
  [key: string]: unknown;
}

export interface Metric {
  id: string;
  name: string;
  value: number;
  unit?: string;
  timestamp?: Date;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  impact?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

export interface SuccessResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

// Additional common types
export interface CommandParameter {
  name: string;
  value: string | number | boolean | unknown[] | Record<string, unknown>;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

export interface ErrorDetails {
  message: string;
  code?: string;
  stack?: string;
}

export interface ConfigValue {
  key: string;
  value: string | number | boolean | Record<string, unknown>;
}

export type UnknownRecord = Record<string, unknown>;
export type UnknownArray = unknown[];
export type AnyFunction = (...args: unknown[]) => unknown;
export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>;

// Type guards
export function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null && 'error' in value && 'message' in value;
}

export function isSuccessResponse<T>(value: unknown): value is SuccessResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as SuccessResponse).success === true
  );
}

export function isDictionary(value: unknown): value is Dictionary {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isMetric(value: unknown): value is Metric {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'value' in value &&
    typeof (value as Metric).value === 'number'
  );
}

export function isCommunity(value: unknown): value is Community {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'nodes' in value &&
    Array.isArray((value as Community).nodes)
  );
}

export function isPathResult(value: unknown): value is PathResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    'cost' in value &&
    Array.isArray((value as PathResult).nodes)
  );
}

export function isRecommendation(value: unknown): value is Recommendation {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'description' in value
  );
}

// Enhanced error handling utilities
export function getErrorMessage(error: unknown): string {
  if (isErrorResponse(error)) {return error.message;}
  if (typeof error === 'string') {return error;}
  if (error instanceof Error) {return error.message;}
  if (isDictionary(error) && typeof error['message'] === 'string') {
    return error['message'] as string;
  }
  return 'Unknown error occurred';
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isDictionary(obj) && key in obj;
}

// Type assertion helpers
export function assertDefined<T>(
  value: T | undefined | null,
  message?: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message || 'Value is undefined or null');
  }
}

export function assertString(value: unknown, message?: string): asserts value is string {
  if (!isString(value)) {
    throw new Error(message || 'Value is not a string');
  }
}

export function assertNumber(value: unknown, message?: string): asserts value is number {
  if (!isNumber(value)) {
    throw new Error(message || 'Value is not a number');
  }
}

export function assertArray(value: unknown, message?: string): asserts value is unknown[] {
  if (!isArray(value)) {
    throw new Error(message || 'Value is not an array');
  }
}

// Safe JSON parsing
export function safeJsonParse<T = unknown>(json: string, fallback?: T): T | undefined {
  try {
    return JSON.parse(json) as Record<string, unknown> as T;
  } catch {
    return fallback;
  }
}

// Result type for better error handling
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export function createSuccess<T>(data: T): Result<T> {
  return { success: true, data };
}

export function createError<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

// Index signature helper types for fixing TS4111 errors
export type FlexibleRecord<K extends string | number | symbol = string, V = unknown> = {
  [key in K]: V;
} & Record<string, unknown>;

export type StrictRecord<K extends string, V> = {
  [key in K]: V;
};

// Utility types for better type safety
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// AI Provider types
export interface AIProvider {
  name: string;
  endpoint: string;
  apiKey?: string;
  models: string[];
  defaultModel?: string;
  capabilities?: string[];
}

export interface AIResponse {
  content: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

// Chat and conversation types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  context?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Project and configuration types
export interface ProjectConfig {
  name: string;
  type: ProjectType;
  description?: string;
  id?: string;
  packageManager?: string;
  language?: string;
  framework?: string;
  aiModels?: {
    default?: string;
    code?: string;
    chat?: string;
    vision?: string;
  };
  features?: string[];
  paths?: {
    src?: string;
    tests?: string;
    docs?: string;
    build?: string;
  };
  user?: {
    email?: string;
  };
  neo4j?: {
    instanceId?: string;
    database?: string;
  };
  ai?: {
    preferredModel?: string;
  };
  logging?: {
    level?: string;
  };
}

export type ProjectType =
  | 'web'
  | 'cli'
  | 'api'
  | 'mobile'
  | 'desktop'
  | 'library'
  | 'monorepo'
  | 'other';

// Component prop types
export interface BaseComponentProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export interface CommandComponentProps extends BaseComponentProps {
  onExecute?: (result: unknown) => void;
  onError?: (error: Error) => void;
  options?: CommandOptions;
}

// Service response types
export interface ServiceResponse<T = unknown> {
  data?: T;
  error?: Error | string;
  status: 'success' | 'error' | 'pending';
  metadata?: Record<string, unknown>;
}

// Router types for intelligent routing
export interface RouteIntent {
  command: string;
  confidence: number;
  params?: Record<string, unknown>;
  context?: string[];
}

export interface RouterContext {
  history: ChatMessage[];
  currentCommand?: string;
  projectType?: ProjectType;
  userPreferences?: Record<string, unknown>;
}

// Media generation types
export interface MediaGenerationOptions {
  prompt: string;
  model?: string;
  outputPath?: string;
  format?: string;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  duration?: number; // for video
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface MediaGenerationResult {
  path: string;
  format: string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number; // for video
  metadata?: Record<string, unknown>;
}
