/**
 * Multi-Agent System Types and Interfaces
 * Based on DeepCode architecture for MARIA integration
 */

// Agent capabilities and roles
export enum AgentRole {
  DOCUMENT_PARSER = 'document-parser',
  ALGORITHM_EXTRACTOR = 'algorithm-extractor',
  CODE_GENERATOR = 'code-generator',
  LITERATURE_REVIEWER = 'literature-reviewer',
  CONCEPT_ANALYZER = 'concept-analyzer',
  QUALITY_ASSURANCE = 'quality-assurance',
  CITATION_MANAGER = 'citation-manager',
}

// Agent status tracking
export enum AgentStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error',
  WAITING = 'waiting',
}

// Message types for inter-agent communication
export interface AgentMessage {
  id: string;
  from: AgentRole;
  to: AgentRole | 'orchestrator';
  type: 'request' | 'response' | 'notification' | 'error';
  payload: unknown;
  timestamp: Date;
  correlationId?: string;
}

// Agent task definition
export interface AgentTask {
  id: string;
  type: string;
  priority: number;
  input: unknown;
  requiredCapabilities: AgentRole[];
  deadline?: Date;
  dependencies?: string[];
  context?: Record<string, unknown>;
}

// Agent execution result
export interface AgentResult {
  taskId: string;
  agentRole: AgentRole;
  status: 'success' | 'failure' | 'partial';
  output?: unknown;
  error?: Error;
  duration: number;
  metadata?: Record<string, unknown>;
}

// Base agent interface
export interface IAgent {
  role: AgentRole;
  status: AgentStatus;
  capabilities: string[];

  // Core methods
  initialize(): Promise<void>;
  canHandle(task: AgentTask): boolean;
  execute(task: AgentTask): Promise<AgentResult>;
  shutdown(): Promise<void>;

  // Communication
  sendMessage(message: AgentMessage): Promise<void>;
  receiveMessage(message: AgentMessage): Promise<void>;

  // Monitoring
  getStatus(): AgentStatus;
  getMetrics(): AgentMetrics;

  // Event handling
  on(eventName: string, callback: (data: unknown) => void): void;
  emit(eventName: string, data: unknown): void;
  removeAllListeners(): void;
}

// Agent performance metrics
export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageResponseTime: number;
  currentLoad: number;
  lastActive: Date;
}

// Orchestrator configuration
export interface OrchestratorConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  loadBalancing: 'round-robin' | 'least-loaded' | 'capability-based';
}

// Task execution plan
export interface ExecutionPlan {
  id: string;
  tasks: TaskNode[];
  dependencies: Map<string, string[]>;
  estimatedDuration: number;
  requiredAgents: AgentRole[];
}

// Task node in execution plan
export interface TaskNode {
  id: string;
  task: AgentTask;
  assignedAgent?: AgentRole;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: AgentResult;
}

// Paper processing specific types
export interface PaperProcessingRequest {
  source: 'pdf' | 'arxiv' | 'url' | 'docx' | 'text';
  content: string | Buffer;
  options: {
    extractAlgorithms: boolean;
    generateTests: boolean;
    includeDocumentation: boolean;
    targetLanguage?: string;
    framework?: string;
  };
}

export interface AlgorithmExtraction {
  name: string;
  description: string;
  pseudocode?: string;
  complexity?: {
    time: string;
    space: string;
  };
  parameters: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  steps: string[];
}

export interface CodeGenerationOutput {
  files: Map<string, string>;
  tests: Map<string, string>;
  documentation: string;
  dependencies: string[];
  setupInstructions?: string;
}
