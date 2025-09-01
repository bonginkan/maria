/**
 * RRF (Reciprocal Rank Fusion) Type Definitions
 * Phase 4.1: Core types and interfaces
 */

/**
 * Supported search sources
 */
export type SearchSource = "bm25" | "vector" | "kg";

/**
 * Supported languages for query processing
 */
export type Language = "en" | "ja" | "auto";

/**
 * Individual search result from a source
 */
export interface SourceResult {
  id: string;
  source: SearchSource;
  rank: number;
  originalScore: number;
  content?: string;
  metadata?: Record<string, any>;
}

/**
 * RRF configuration
 */
export interface RRFConfig {
  /** Fixed k parameter for rank smoothing */
  k: number;

  /** Source-specific weights */
  weights: {
    bm25: number;
    vector: number;
    kg: number;
  };

  /** Enable score normalization */
  normalizeScores: boolean;

  /** Minimum score threshold */
  minScore: number;

  /** Language-specific weight adjustments */
  languageWeights: {
    en: {
      bm25: number;
      vector: number;
      kg: number;
    };
    ja: {
      bm25: number;
      vector: number;
      kg: number;
    };
  };
}

/**
 * Default RRF configuration for Phase 4
 */
export const DEFAULT_RRF_CONFIG: RRFConfig = {
  k: 60,
  weights: {
    bm25: 0.4,
    vector: 0.4,
    kg: 0.2,
  },
  normalizeScores: true,
  minScore: 0.001, // Lower threshold to avoid filtering out valid results
  languageWeights: {
    en: {
      bm25: 0.4,
      vector: 0.4,
      kg: 0.2,
    },
    ja: {
      bm25: 0.5, // Higher weight for BM25 in Japanese
      vector: 0.3, // Lower weight for vector (English-optimized embeddings)
      kg: 0.2,
    },
  },
};

/**
 * Result after RRF fusion
 */
export interface RRFResult {
  id: string;
  finalScore: number;
  rrfScore: number;
  normalizedScore: number;
  sources: {
    primary: SearchSource;
    contributions: {
      bm25?: number;
      vector?: number;
      kg?: number;
    };
  };
  content?: string;
  metadata?: Record<string, any>;
}

/**
 * RRF fusion statistics
 */
export interface RRFStatistics {
  totalCandidates: number;
  uniqueResults: number;
  sourceCounts: {
    bm25: number;
    vector: number;
    kg: number;
  };
  fusionTimeMs: number;
  normalizationApplied: boolean;
  languageUsed: Language;
}

/**
 * Cache key generation options
 */
export interface CacheKeyOptions {
  query: string;
  topKIds: string[];
  language: Language;
  includeFilters?: boolean;
}

/**
 * Performance metrics for RRF
 */
export interface RRFMetrics {
  fusionLatencyMs: number;
  normalizationLatencyMs: number;
  resultsBeforeFusion: number;
  resultsAfterFusion: number;
  cacheKey: string;
}
