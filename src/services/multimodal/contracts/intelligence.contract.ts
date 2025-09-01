/**
 * Intelligence Facade Contract
 * This defines the stable public API that will remain unchanged
 * during the internal refactoring process.
 */

import { EventEmitter } from "node:events";

// Re-export existing types to maintain compatibility
export type ModalityType =
  | "text"
  | "code"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "structured"
  | "diagram"
  | "screenshot";

export interface MultimodalInput {
  id: string;
  type: ModalityType;
  data: unknown;
  metadata?: InputMetadata;
  timestamp: Date;
  priority: number;
  context?: string[];
}

export interface InputMetadata {
  format: string;
  size: number;
  encoding?: string;
  dimensions?: { width: number; height: number };
  duration?: number;
  language?: string;
  source: string;
  quality: number;
  tags: string[];
}

export interface ProcessedOutput {
  id: string;
  inputId: string;
  type: "analysis" | "extraction" | "generation" | "transformation" | "summary";
  data: unknown;
  confidence: number;
  processingTime: number;
  metadata?: OutputMetadata;
  timestamp: Date;
}

export interface OutputMetadata {
  processor: string;
  version: string;
  parameters: Record<string, unknown>;
  alternativeResults: unknown[];
  qualityScore: number;
}

export interface CrossModalAnalysis {
  id: string;
  inputs: MultimodalInput[];
  outputs: ProcessedOutput[];
  insights: CrossModalInsight[];
  correlations: ModalityCorrelation[];
  confidence: number;
  synthesizedOutput?: SynthesizedOutput;
  timestamp: Date;
}

export interface CrossModalInsight {
  type: string;
  description: string;
  confidence: number;
  evidence: Evidence[];
  relatedModalities: ModalityType[];
}

export interface Evidence {
  source: string;
  confidence: number;
  data: unknown;
}

export interface ModalityCorrelation {
  modality1: ModalityType;
  modality2: ModalityType;
  strength: number;
  type: "complementary" | "contradictory" | "reinforcing" | "independent";
  examples: CorrelationExample[];
}

export interface CorrelationExample {
  input1Id: string;
  input2Id: string;
  description: string;
}

export interface SynthesizedOutput {
  type: "unified" | "consensus" | "aggregated" | "transformed";
  data: unknown;
  confidence: number;
  sources: string[];
  methodology: string;
}

// Versioned Events with clear semantics
export interface VersionedMultimodalEvents {
  "processingStarted.v1": {
    inputId: string;
    modality: ModalityType;
    timestamp: number;
  };
  "processingCompleted.v1": {
    outputId: string;
    inputId: string;
    duration: number;
    timestamp: number;
  };
  "processingError.v1": {
    inputId: string;
    error: string;
    reason: ErrorReason;
    timestamp: number;
  };
  "queueStateChanged.v1": {
    size: number;
    inFlight: number;
    avgQueueTime: number;
    timestamp: number;
  };
}

export type ErrorReason =
  | "processor_error"
  | "converter_error"
  | "storage_error"
  | "deadline"
  | "abort"
  | "unknown";

// Observable stats for monitoring
export interface ObservableStats {
  totalProcessed: number;
  totalErrors: number;
  averageProcessingTime: number;
  queueSize: number;
  inFlightCount: number;
  successRate: number;
  errorsByReason: Record<ErrorReason, number>;
}

export interface ProcessingMetrics {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  count: number;
}

// Type-safe event emitter interfaces
export type TypedEmitterOn<T> = <K extends keyof T>(
  event: K,
  listener: (data: T[K]) => void,
) => void;

export type TypedEmitterOff<T> = <K extends keyof T>(
  event: K,
  listener: (data: T[K]) => void,
) => void;

// Main contract interface
export interface IntelligenceContract {
  // Core operations
  processInput(
    input: MultimodalInput,
    controller?: AbortController,
  ): Promise<ProcessedOutput>;

  processMultimodalInputs(
    inputs: MultimodalInput[],
  ): Promise<CrossModalAnalysis>;

  convertModality(
    input: MultimodalInput,
    targetModality: ModalityType,
  ): Promise<MultimodalInput>;

  // Event handling with versioned events
  on: TypedEmitterOn<VersionedMultimodalEvents>;
  off: TypedEmitterOff<VersionedMultimodalEvents>;

  // Observability
  getStats(): ObservableStats;
  getMetrics(): ProcessingMetrics;

  // Lifecycle
  stop(): Promise<void>;
}

// Factory function for creating instances
export interface IntelligenceOptions {
  maxConcurrent?: number;
  queueSize?: number;
  dataDir?: string;
  enablePersistence?: boolean;
  useMock?: boolean; // For testing
}

export type CreateIntelligence = (
  options?: IntelligenceOptions,
) => Promise<IntelligenceContract>;
