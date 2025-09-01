/**
 * Cross-Encoder Reranker Type Definitions
 * Phase 4.2: Reranking types and interfaces
 */

import type { Language } from "../rrf/types";

/**
 * Supported reranking models
 */
export type RerankModel = "ms-marco-MiniLM-L-12-v2" | "future-model";

/**
 * Reranking runtime
 */
export type RerankRuntime = "onnxruntime-node" | "transformers-js";

/**
 * Document-query pair for reranking
 */
export interface RerankPair {
  id: string;
  query: string;
  document: string;
  metadata?: Record<string, any>;
}

/**
 * Cross-encoder configuration
 */
export interface CrossEncoderConfig {
  /** Model to use for reranking */
  model: RerankModel;

  /** Runtime for inference */
  runtime: RerankRuntime;

  /** Device to run on */
  device: "cpu" | "gpu";

  /** Maximum sequence length */
  maxSequenceLength: number;

  /** Batch size for inference */
  batchSize: number;

  /** Maximum documents to rerank */
  topK: number;

  /** Cache configuration */
  cache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };

  /** Performance settings */
  performance: {
    numThreads?: number;
    useParallelProcessing?: boolean;
    warmupRuns?: number;
  };
}

/**
 * Default configuration for Phase 4 (CPU-only)
 */
export const DEFAULT_CROSSENCODER_CONFIG: CrossEncoderConfig = {
  model: "ms-marco-MiniLM-L-12-v2",
  runtime: "onnxruntime-node",
  device: "cpu",
  maxSequenceLength: 256, // Reduced for CPU performance
  batchSize: 16, // CPU-optimized batch size
  topK: 50, // Maximum for Phase 4
  cache: {
    enabled: true,
    maxSize: 10000,
    ttl: 3600, // 1 hour
  },
  performance: {
    numThreads: 4,
    useParallelProcessing: true,
    warmupRuns: 3,
  },
};

/**
 * Reranking result
 */
export interface RerankResult {
  id: string;
  score: number;
  confidence: number;
  originalRank?: number;
  newRank: number;
  metadata?: Record<string, any>;
}

/**
 * Reranking statistics
 */
export interface RerankStatistics {
  totalCandidates: number;
  rerankedCount: number;
  inferenceTimeMs: number;
  tokenizationTimeMs: number;
  postprocessingTimeMs: number;
  cacheHits: number;
  cacheMisses: number;
  modelLoadTimeMs?: number;
  language: Language;
}

/**
 * Model status
 */
export interface ModelStatus {
  loaded: boolean;
  modelPath?: string;
  modelSize?: number;
  loadTimeMs?: number;
  lastUsed?: number;
  warmupComplete: boolean;
}

/**
 * Cache entry for reranking results
 */
export interface RerankCacheEntry {
  key: string;
  query: string;
  documentId: string;
  score: number;
  timestamp: number;
  hits: number;
}

/**
 * Batch processing options
 */
export interface BatchOptions {
  maxBatchSize: number;
  timeout: number;
  failureStrategy: "skip" | "abort" | "retry";
  retryAttempts?: number;
}

/**
 * Performance metrics for monitoring
 */
export interface RerankMetrics {
  inferenceLatency: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    documentsPerSecond: number;
    batchesPerMinute: number;
  };
  cache: {
    hitRate: number;
    evictions: number;
    memoryUsageMB: number;
  };
  errors: {
    timeouts: number;
    failures: number;
    retries: number;
  };
}
