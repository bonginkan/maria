/**
 * Core Types for Multimodal Intelligence System v2.1
 * Enhanced architecture with streaming, security, and performance optimizations
 */

// Re-export from contract for consistency
export type {
  ModalityType,
  MultimodalInput,
  ProcessedOutput,
  InputMetadata,
  OutputMetadata,
  CrossModalAnalysis,
  CrossModalInsight,
  Evidence,
  ModalityCorrelation,
  CorrelationExample,
  SynthesizedOutput,
} from "../contracts/intelligence.contract";

// Enhanced processing modes for streaming fallback strategy
export type ProcessingMode = "streaming" | "chunked" | "batch";
export type ProcessingComplexity = "low" | "medium" | "high";

// Security and audit integration
export interface SecureProcessingContext {
  readonly correlationId: string;
  readonly userId?: string;
  readonly dataClassification:
    | "public"
    | "internal"
    | "confidential"
    | "restricted";
  readonly purpose: string;
  readonly retentionPolicy?: string;
}

/**
 * Enhanced queued task with streaming support and security context
 */
export interface QueuedTask {
  readonly id: string;
  readonly input: MultimodalInput;
  readonly enqueuedAt: number;
  readonly priority: number;
  readonly securityContext?: SecureProcessingContext;
  readonly processingMode: ProcessingMode;
  readonly complexity: ProcessingComplexity;
  readonly deadline?: number;
  readonly maxRetries: number;

  // Execution tracking
  dequeuedAt?: number;
  rr: number; // Round-robin counter
  retryCount: number;
  abortController?: AbortController;

  // Promise resolution
  resolve: (output: ProcessedOutput) => void;
  reject: (error: unknown) => void;
  settled?: boolean; // Prevents double resolution

  // Performance tracking
  memoryEstimate?: number;
  startTime?: number;
  endTime?: number;
}

/**
 * Safely settle a task (resolve or reject)
 * @param task Task to settle
 * @param settler Function to execute if not already settled
 * @returns true if settled, false if already settled
 */
export function settleTask(task: QueuedTask, settler: () => void): boolean {
  if (!task.settled) {
    task.settled = true;
    try {
      settler();
      return true;
    } catch (error) {
      console.error("Error settling task:", task.id, error);
      return false;
    }
  }
  return false;
}

/**
 * Safely resolve a task
 */
export function resolveTask(
  task: QueuedTask,
  output: ProcessedOutput,
): boolean {
  return settleTask(task, () => task.resolve(output));
}

/**
 * Safely reject a task
 */
export function rejectTask(task: QueuedTask, error: unknown): boolean {
  return settleTask(task, () => task.reject(error));
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
  totalProcessed: number;
  totalErrors: number;
  totalCancelled: number;
  averageProcessingTime: number;
  averageQueueTime: number;
  p50ProcessingTime: number;
  p95ProcessingTime: number;
  p99ProcessingTime: number;
  currentQueueSize: number;
  currentInFlight: number;
}

/**
 * Queue metrics for monitoring
 */
export interface QueueMetrics {
  size: number;
  capacity: number;
  utilization: number; // size / capacity
  enqueuedCount: number;
  dequeuedCount: number;
  evictedCount: number;
  cancelledCount: number;
  avgQueueTimeMs: number;
  p50QueueTimeMs: number;
  p95QueueTimeMs: number;
  p99QueueTimeMs: number;
  oldestTaskAgeMs: number;
}

/**
 * Enhanced processor interface with streaming and security support
 */
export interface ProcessorPort {
  readonly type: ModalityType;
  readonly supportedModes: ProcessingMode[];
  readonly memoryRequirement: number; // bytes
  readonly averageLatency: number; // milliseconds

  canHandle(input: MultimodalInput): boolean;
  canStream(input: MultimodalInput): boolean;

  process(
    input: MultimodalInput,
    options?: {
      signal?: AbortSignal;
      deadlineAt?: number;
      mode?: ProcessingMode;
      securityContext?: SecureProcessingContext;
      memoryLimit?: number;
    },
  ): Promise<ProcessedOutput>;

  // Streaming support
  processStream?(
    input: MultimodalInput,
    options?: {
      signal?: AbortSignal;
      chunkSize?: number;
      onProgress?: (progress: number) => void;
    },
  ): AsyncGenerator<Partial<ProcessedOutput>, ProcessedOutput>;

  // Health and capability
  getCapabilities(): ProcessingCapability[];
  getConfiguration(): ProcessorConfiguration;
  healthCheck(): Promise<ProcessorHealthStatus>;
}

/**
 * Processing capability description
 */
export interface ProcessingCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  confidence: number;
}

/**
 * Processor configuration
 */
export interface ProcessorConfiguration {
  model: string;
  version: string;
  parameters: Record<string, unknown>;
  requirements: SystemRequirement[];
}

/**
 * System requirement for a processor
 */
export interface SystemRequirement {
  type: "memory" | "cpu" | "gpu" | "network" | "storage";
  minimum: string;
  recommended: string;
}

/**
 * Converter interface for modality transformation
 */
export interface ConverterPort {
  fromModality: ModalityType;
  toModality: ModalityType;
  canConvert(input: MultimodalInput): boolean;
  convert(
    input: MultimodalInput,
    options?: {
      signal?: AbortSignal;
      quality?: "low" | "medium" | "high";
    },
  ): Promise<MultimodalInput>;
  getEstimatedTime(input: MultimodalInput): number;
}

/**
 * Storage port for persistence
 */
export interface StoragePort {
  readonly schemaVersion: number;
  load<T>(key: string): Promise<T | null>;
  save<T>(key: string, data: T): Promise<void>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
  migrate?(from: number, to: number, data: unknown): Promise<unknown>;
}

/**
 * Monitoring port for metrics collection
 */
export interface MonitoringPort {
  recordLatency(operation: string, ms: number): void;
  recordError(operation: string, error: Error): void;
  recordSuccess(operation: string): void;
  recordQueueSize(size: number): void;
  recordInFlight(count: number): void;
  getMetrics(operation?: string): OperationMetrics;
}

/**
 * Operation metrics with streaming and performance tracking
 */
export interface OperationMetrics {
  count: number;
  successCount: number;
  errorCount: number;
  streamingCount: number;
  fallbackCount: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  errorRate: number;
  streamingSuccessRate: number;
  avgMemoryUsage: number;
  peakMemoryUsage: number;
}

/**
 * Processor health status
 */
export interface ProcessorHealthStatus {
  readonly healthy: boolean;
  readonly latency: number;
  readonly errorRate: number;
  readonly memoryUsage: number;
  readonly queueDepth: number;
  readonly streamingCapable: boolean;
  readonly lastError?: string;
  readonly lastHealthCheck: Date;
}

/**
 * Streaming strategy interface for automatic fallback
 */
export interface StreamingStrategy {
  selectProcessingMode(
    dataSize: number,
    complexity: ProcessingComplexity,
    memoryAvailable: number,
  ): ProcessingMode;

  shouldFallback(
    currentMode: ProcessingMode,
    error: Error,
    attemptCount: number,
  ): ProcessingMode | null;

  getChunkSize(dataSize: number, mode: ProcessingMode): number;

  estimateMemoryUsage(input: MultimodalInput, mode: ProcessingMode): number;
}
