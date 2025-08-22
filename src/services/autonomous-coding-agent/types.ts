/**
 * Type definitions for MARIA Autonomous Coding Agent System v1.5.0
 */

// ============================================================================
// Core Types
// ============================================================================

export interface CodingMode {
  name: string;
  symbol: string;
  category: ModeCategory;
  description?: string;
  visual?: {
    color: string;
    animation?: string;
  };
}

export type ModeCategory =
  | 'file_system'
  | 'code_development'
  | 'version_control'
  | 'build_deployment'
  | 'automation'
  | 'analysis'
  | 'learning'
  | 'planning';

export interface ExecutionContext {
  projectPath: string;
  history: ExecutionHistory[];
  currentTask: Task | null;
  environment: Record<string, any>;
  metrics: ExecutionMetrics;
  currentMode?: CodingMode;
  isActive?: boolean;
}

export interface ExecutionHistory {
  mode: CodingMode;
  result: any;
  timestamp: number;
  duration?: number;
  success: boolean;
}

export interface ExecutionMetrics {
  startTime: number;
  operations: number;
  errors: number;
  successRate: number;
  linesOfCode?: number;
  filesCreated?: number;
  testsGenerated?: number;
  coverage?: number;
}

// ============================================================================
// Statement of Work (SOW) Types
// ============================================================================

export interface SOW {
  id: string;
  title: string;
  objective: string;
  scope: string[];
  deliverables: Deliverable[];
  timeline: Timeline;
  risks: Risk[];
  assumptions: string[];
  successCriteria: string[];
  tasks: Task[];
  estimatedTime: string;
  complexity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedTime: number; // minutes
  actualTime?: number;
  dependencies: string[]; // Task IDs
  blockers?: string[];
  subtasks?: Task[];
  assignee: 'ai' | 'user' | 'collaborative';
  progress: number; // 0-100
  type?: string; // Task type for learning
  requiredModes?: CodingMode[];
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    context?: any;
  };
}

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'deferred'
  | 'failed';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Deliverable {
  name: string;
  description: string;
  type: 'code' | 'documentation' | 'deployment' | 'test' | 'configuration';
  status: 'pending' | 'in_progress' | 'completed';
}

export interface Timeline {
  startDate: Date;
  endDate: Date;
  milestones: Milestone[];
}

export interface Milestone {
  name: string;
  date: Date;
  deliverables: string[];
  status: 'pending' | 'achieved' | 'missed';
}

export interface Risk {
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

// ============================================================================
// Active Reporting Types
// ============================================================================

export interface ProactiveReport {
  type: ReportType;
  title: string;
  summary: string;
  details?: {
    completed?: Achievement[];
    current?: CurrentWork[];
    upcoming?: PlannedWork[];
    blockers?: Blocker[];
    decisions?: DecisionRequired[];
    objective?: string;
    estimatedTime?: string;
    complexity?: string;
  };
  recommendations?: Recommendation[];
  visualRepresentation?: string;
  timestamp: Date;
}

export type ReportType =
  | 'milestone'
  | 'blocker'
  | 'decision'
  | 'progress'
  | 'context'
  | 'mode_switch'
  | 'error'
  | 'completion';

export interface Achievement {
  task: string;
  result: string;
  impact: string;
}

export interface CurrentWork {
  task: string;
  progress: number;
  eta: string;
}

export interface PlannedWork {
  task: string;
  priority: TaskPriority;
  dependencies: string[];
}

export interface Blocker {
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: string;
}

export interface DecisionRequired {
  question: string;
  options: string[];
  recommendation: string;
  deadline?: Date;
}

export interface Recommendation {
  type: 'performance' | 'quality' | 'security' | 'architecture';
  description: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ProgressReport {
  taskIndex: number;
  totalTasks: number;
  currentMode: CodingMode;
  progress: number;
  message?: string;
}

// ============================================================================
// Self-Evolution Types
// ============================================================================

export interface LearningPattern {
  context: string;
  task: Task;
  modes: CodingMode[];
  success: boolean;
  executionTime: number;
  userFeedback?: number; // 1-5 rating
  optimizationSuggestions?: string[];
  errorPatterns?: ErrorPattern[];
}

export interface ErrorPattern {
  error: string;
  frequency: number;
  resolution: string;
  preventionStrategy: string;
}

export interface OptimizationSuggestion {
  pattern: string;
  improvement: string;
  expectedGain: number; // percentage
  confidence: number; // 0-1
}

// ============================================================================
// Autonomous Decision Types
// ============================================================================

export interface AutonomousDecision {
  context: ExecutionContext;
  availableActions: Action[];
  selectedAction: Action;
  confidence: number;
  reasoning: string;
  fallbackPlan: Action[];
  risks?: Risk[];
}

export interface Action {
  name: string;
  mode: CodingMode;
  parameters: Record<string, any>;
  expectedOutcome: string;
  estimatedTime: number;
  priority: number;
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  actions: Action[];
  message: string;
}

// ============================================================================
// Mode Engine Types
// ============================================================================

export interface ModeEngine {
  category: ModeCategory;
  execute(mode: CodingMode, context: ExecutionContext): Promise<ModeExecutionResult>;
  validate(mode: CodingMode): boolean;
  getAvailableModes(): CodingMode[];
}

export interface ModeExecutionResult {
  success: boolean;
  output?: any;
  filesCreated?: string[];
  filesModified?: string[];
  linesOfCode?: number;
  testsGenerated?: number;
  errors?: string[];
  warnings?: string[];
  metrics?: Record<string, any>;
}

// ============================================================================
// Visual Display Types
// ============================================================================

export interface VisualConfig {
  level: 'minimal' | 'standard' | 'detailed';
  animations: boolean;
  colors: boolean;
  progressBars: boolean;
  dashboards: boolean;
}

export interface AnimationFrame {
  content: string;
  duration: number;
  color?: string;
}

export interface ProgressVisualization {
  type: 'bar' | 'circular' | 'steps' | 'tree';
  current: number;
  total: number;
  label: string;
  color?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AutonomousAgentConfig {
  enableVisualMode: boolean;
  activeReporting: boolean;
  selfEvolution: boolean;
  autonomyLevel: 'assisted' | 'collaborative' | 'autonomous';
  visualizationLevel: 'minimal' | 'standard' | 'detailed';
  reportingInterval: number; // minutes
  maxConcurrentOperations: number;
  errorRecoveryAttempts: number;
  learningEnabled: boolean;
  metricsCollection: boolean;
}

// ============================================================================
// File System Operation Types
// ============================================================================

export interface FileOperation {
  type: 'read' | 'write' | 'create' | 'delete' | 'move' | 'copy';
  path: string;
  content?: string;
  options?: {
    encoding?: string;
    mode?: number;
    recursive?: boolean;
    force?: boolean;
  };
}

export interface StreamOperation {
  type: 'pipe' | 'redirect' | 'append';
  source: string;
  destination: string;
  options?: Record<string, any>;
}

// ============================================================================
// Code Development Types
// ============================================================================

export interface CodeGenerationRequest {
  type: 'component' | 'function' | 'class' | 'module' | 'test';
  language: string;
  framework?: string;
  specifications: Record<string, any>;
  style?: CodeStyle;
}

export interface CodeStyle {
  indentation: 'tabs' | 'spaces';
  indentSize: number;
  quotes: 'single' | 'double';
  semicolons: boolean;
  trailingComma: boolean;
  lineLength: number;
}

export interface TestGenerationRequest {
  targetFile: string;
  testFramework: string;
  coverageTarget: number;
  testTypes: ('unit' | 'integration' | 'e2e')[];
}

// ============================================================================
// Version Control Types
// ============================================================================

export interface GitOperation {
  command: string;
  args: string[];
  options?: Record<string, any>;
}

export interface PullRequest {
  title: string;
  body: string;
  base: string;
  head: string;
  reviewers?: string[];
  labels?: string[];
}

// ============================================================================
// Build & Deployment Types
// ============================================================================

export interface BuildConfiguration {
  tool: 'webpack' | 'rollup' | 'vite' | 'esbuild' | 'tsc';
  entry: string;
  output: string;
  options: Record<string, any>;
}

export interface DeploymentTarget {
  platform: 'aws' | 'gcp' | 'azure' | 'vercel' | 'netlify' | 'heroku';
  environment: 'development' | 'staging' | 'production';
  configuration: Record<string, any>;
}

export interface DockerConfiguration {
  imageName: string;
  tag: string;
  dockerfile: string;
  buildArgs?: Record<string, string>;
  ports?: number[];
  volumes?: string[];
}

// ============================================================================
// Export all types
// ============================================================================

export * from './core/AutonomousCodingAgentService';
export * from './core/VisualModeDisplayEngine';

// Type guards
export const isTask = (obj: unknown): obj is Task => {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string';
};

export const isSOW = (obj: unknown): obj is SOW => {
  return obj && typeof obj.id === 'string' && Array.isArray(obj.tasks);
};

export const isCodingMode = (obj: unknown): obj is CodingMode => {
  return obj && typeof obj.name === 'string' && typeof obj.symbol === 'string';
};
