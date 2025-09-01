/**
 * Hybrid Search Engine
 * Phase 4.3: Orchestrates RRF fusion and Cross-Encoder reranking
 *
 * Combines multiple search _sources (BM25, Vector, KG) using RRF,
 * then applies Cross-Encoder reranking for optimal result ordering.
 */

import { EventEmitter } from "node:events";
import { telemetry, _SystemEvent } from "../base/TelemetryCollector";
import { RRFusion } from "./rrf/RRFusion";
import { CrossEncoderReranker } from "./reranker/CrossEncoderReranker";
import type {
  SearchSource,
  Language,
  SourceResult,
  RRFResult,
} from "./rrf/types";
import type { RerankPair, RerankResult } from "./reranker/types";

/**
 * Search query interface
 */
export interface SearchQuery {
  _text: string;
  filters?: {
    _language?: Language;
    _sources?: SearchSource[];
    maxResults?: number;
    fileTypes?: string[];
    dateRange?: {
      start?: Date;
      end?: Date;
    };
  };
  options?: {
    skipReranking?: boolean;
    explainRanking?: boolean; // Phase 5
    debug?: boolean;
    _timeout?: number; // Milliseconds
  };
  context?: {
    previousQueries?: string[];
    currentFile?: string;
    userIntent?: string;
  };
}

/**
 * Search _response interface
 */
export interface SearchResponse {
  _results: SearchResult[];
  metadata: {
    totalFound: number;
    searchTimeMs: number;
    _sources: {
      bm25: { count: number; timeMs: number };
      vector: { count: number; timeMs: number };
      kg: { count: number; timeMs: number };
    };
    fusionTimeMs: number;
    rerankTimeMs: number;
    cacheHit: boolean;
    _language: Language;
    rerankingApplied: boolean;
    explanation: null; // Phase 4: No explanations
  };
  error?: {
    code: string;
    message: string;
    partialResults?: SearchResult[];
  };
}

/**
 * Individual search result
 */
export interface SearchResult {
  id: string;
  content: string;
  score: number;
  confidence: number;
  source: {
    primary: SearchSource;
    contributions: Partial<Record<SearchSource, number>>;
  };
  metadata?: {
    filePath?: string;
    lineNumbers?: [number, number];
    lastModified?: Date;
    author?: string;
    tags?: string[];
  };
  snippet?: {
    _text: string;
    highlights: Array<[number, number]>;
  };
}

/**
 * Search _provider interface (mock for Phase 4)
 */
interface SearchProvider {
  search(query: string, options?: any): Promise<SourceResult[]>;
}

/**
 * Hybrid search configuration
 */
interface HybridSearchConfig {
  maxResults: number;
  _timeout: number;
  _sources: {
    bm25: boolean;
    vector: boolean;
    kg: boolean;
  };
  reranking: {
    enabled: boolean;
    topK: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
  };
}

export class HybridSearchEngine extends EventEmitter {
  private rrfFusion: RRFusion;
  private reranker: CrossEncoderReranker;
  private config: HybridSearchConfig;
  private providers: Map<SearchSource, SearchProvider>;
  private initialized: boolean = false;

  constructor(config?: Partial<HybridSearchConfig>) {
    super();

    this.config = {
      maxResults: 10,
      _timeout: 1500, // 1.5s default
      _sources: {
        bm25: true,
        vector: true,
        kg: true,
      },
      reranking: {
        enabled: true,
        topK: 50,
      },
      cache: {
        enabled: true,
        ttl: 3600,
      },
      ...config,
    };

    this.rrfFusion = new RRFusion();
    this.reranker = new CrossEncoderReranker({
      topK: this.config.reranking.topK,
      cache: {
        enabled: this.config.cache.enabled,
        maxSize: 10000,
        ttl: this.config.cache.ttl,
      },
    });

    // Initialize mock providers
    this.providers = new Map();
    this.initializeMockProviders();
  }

  /**
   * Initialize the search engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const _endTimer = telemetry.startTimer("search.hybrid.init.start", {
      comp: "search",
    });

    try {
      // Initialize reranker model
      if (this.config.reranking.enabled) {
        await this.reranker.initialize();
      }

      // Warm up providers
      await this.warmupProviders();

      this.initialized = true;
      this.emit("initialized");

      telemetry.emit({
        event: "search.hybrid.init.complete",
        tags: { comp: "search" },
      });
    } finally {
      _endTimer();
    }
  }

  /**
   * Perform hybrid search
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const _startTime = Date.now();
    const _language = this.detectLanguage(query.text);
    const _timeout = query.options?._timeout || this.config._timeout;

    const _endTimer = telemetry.startTimer("search.hybrid.search.start", {
      comp: "search",
      _language: _language,
    });

    try {
      // Step 1: Execute parallel searches with _timeout
      const _searchResults = await this.executeSearches(
        query,
        _language,
        _timeout,
      );

      // Step 2: Apply RRF fusion
      const _fusionStart = Date.now();
      const _fusedResults = await this.rrfFusion.fuse(
        _searchResults,
        _language,
      );
      const _fusionTime = Date.now() - _fusionStart;

      // Step 3: Apply reranking (if enabled and not skipped)
      let _finalResults: SearchResult[];
      let _rerankTime = 0;

      if (this.config.reranking.enabled && !query.options?.skipReranking) {
        const _rerankStart = Date.now();
        _finalResults = await this.applyReranking(
          query.text,
          _fusedResults,
          _language,
        );
        _rerankTime = Date.now() - _rerankStart;
      } else {
        _finalResults = this.convertToSearchResults(_fusedResults);
      }

      // Step 4: Limit _results
      _finalResults = _finalResults.slice(
        0,
        query.filters?.maxResults || this.config.maxResults,
      );

      // Build _response
      const _response: SearchResponse = {
        _results: _finalResults,
        metadata: {
          totalFound: _fusedResults.length,
          searchTimeMs: Date.now() - _startTime,
          _sources: this.getSourceStats(_searchResults),
          fusionTimeMs: _fusionTime,
          rerankTimeMs: _rerankTime,
          cacheHit: false, // Will be implemented with full caching
          _language: _language,
          rerankingApplied: _rerankTime > 0,
          explanation: null,
        },
      };

      telemetry.emit({
        event: "search.hybrid.search.complete",
        tags: { comp: "search", _language: _language },
        meta: {
          resultsCount: _finalResults.length,
          totalTimeMs: _response.metadata.searchTimeMs,
        },
      });

      return _response;
    } catch (error) {
      const _errorResponse: SearchResponse = this.createErrorResponse(
        error,
        query,
      );
      return _errorResponse;
    } finally {
      _endTimer();
    }
  }

  /**
   * Execute searches across all enabled _sources
   */
  private async executeSearches(
    query: SearchQuery,
    _language: Language,
    _timeout: number,
  ): Promise<Map<SearchSource, SourceResult[]>> {
    const _results = new Map<SearchSource, SourceResult[]>();
    const _sources = this.getEnabledSources(query);

    // Create promise for each source
    const _searchPromises = _sources.map(async (source) => {
      try {
        const _provider = this.providers.get(source);
        if (!_provider) {
          _results.set(source, []);
          return;
        }

        // Add _timeout wrapper
        const _timeoutPromise = new Promise<SourceResult[]>((_, reject) => {
          setTimeout(() => reject(new Error("Search _timeout")), _timeout);
        });

        const _searchPromise = _provider.search(query.text, {
          _language,
          maxResults: 100, // Get more for fusion
        });

        const _sourceResults = await Promise.race([
          _searchPromise,
          _timeoutPromise,
        ]);
        _results.set(source, _sourceResults);
      } catch (innerError) {
        console.warn(`Search failed for source ${source}:`, error);
        _results.set(source, []);
      }
    });

    // Wait for all searches (with individual timeouts)
    await Promise.allSettled(_searchPromises);

    return _results;
  }

  /**
   * Apply Cross-Encoder reranking
   */
  private async applyReranking(
    query: string,
    _fusedResults: RRFResult[],
    _language: Language,
  ): Promise<SearchResult[]> {
    // Convert to rerank _pairs
    const _pairs: RerankPair[] = fusedResults.map((result) => ({
      id: result.id,
      query,
      document: result.content || "",
      metadata: result.metadata,
    }));

    // Apply reranking
    const _rerankedResults = await this.reranker.rerank(
      query,
      _pairs,
      _language,
    );

    // Merge reranking scores with RRF _results
    return this.mergeRerankingResults(_fusedResults, _rerankedResults);
  }

  /**
   * Merge reranking _results with RRF _results
   */
  private mergeRerankingResults(
    rrfResults: RRFResult[],
    rerankResults: RerankResult[],
  ): SearchResult[] {
    const _resultMap = new Map<string, RRFResult>();
    for (const result of rrfResults) {
      _resultMap.set(result.id, result);
    }

    return rerankResults.map((rerankResult): SearchResult => {
      const _rrfResult = _resultMap.get(rerankResult.id)!;

      return {
        id: rerankResult.id,
        content: _rrfResult.content || "",
        score: rerankResult.score,
        confidence: rerankResult.confidence,
        source: _rrfResult.sources,
        metadata: _rrfResult.metadata,
        snippet: this.generateSnippet(_rrfResult.content || ""),
      };
    });
  }

  /**
   * Convert RRF _results to search _results (without reranking)
   */
  private convertToSearchResults(rrfResults: RRFResult[]): SearchResult[] {
    return rrfResults.map(
      (result): SearchResult => ({
        id: result.id,
        content: result.content || "",
        score: result.finalScore,
        confidence: result.normalizedScore,
        source: result.sources,
        metadata: result.metadata,
        snippet: this.generateSnippet(result.content || ""),
      }),
    );
  }

  /**
   * Generate snippet from content
   */
  private generateSnippet(content: string): SearchResult["snippet"] {
    const _maxLength = 200;
    const _text =
      content.length > _maxLength
        ? content.substring(0, _maxLength) + "..."
        : content;

    return {
      _text: _text,
      highlights: [], // Highlighting would be implemented in production
    };
  }

  /**
   * Detect query _language
   */
  private detectLanguage(query: string): Language {
    // Simple heuristic: check for Japanese characters
    const _hasJapanese =
      /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(query);
    return _hasJapanese ? "ja" : "en";
  }

  /**
   * Get enabled _sources based on query and config
   */
  private getEnabledSources(query: SearchQuery): SearchSource[] {
    const _sources: SearchSource[] = [];

    const _requestedSources = query.filters?._sources || [
      "bm25",
      "vector",
      "kg",
    ];

    for (const source of _requestedSources) {
      if (this.config._sources[source]) {
        _sources.push(source);
      }
    }

    return _sources;
  }

  /**
   * Get source statistics
   */
  private getSourceStats(
    _searchResults: Map<SearchSource, SourceResult[]>,
  ): SearchResponse["metadata"]["_sources"] {
    return {
      bm25: {
        count: _searchResults.get("bm25")?.length || 0,
        timeMs: 10, // Mock timing
      },
      vector: {
        count: _searchResults.get("vector")?.length || 0,
        timeMs: 15, // Mock timing
      },
      kg: {
        count: _searchResults.get("kg")?.length || 0,
        timeMs: 8, // Mock timing
      },
    };
  }

  /**
   * Create error _response
   */
  private createErrorResponse(error: any, _query: SearchQuery): SearchResponse {
    const _isTimeout = error.message?.includes("_timeout");

    return {
      _results: [],
      metadata: {
        totalFound: 0,
        searchTimeMs: 0,
        _sources: {
          bm25: { count: 0, timeMs: 0 },
          vector: { count: 0, timeMs: 0 },
          kg: { count: 0, timeMs: 0 },
        },
        fusionTimeMs: 0,
        rerankTimeMs: 0,
        cacheHit: false,
        _language: "en",
        rerankingApplied: false,
        explanation: null,
      },
      error: {
        code: _isTimeout ? "TIMEOUT" : "SEARCH_ERROR",
        message: error.message || "Search failed",
      },
    };
  }

  /**
   * Initialize mock providers for development
   */
  private initializeMockProviders(): void {
    // Mock BM25 _provider
    this.providers.set("bm25", {
      search: async (query: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [
          {
            id: "bm25-1",
            source: "bm25",
            rank: 1,
            originalScore: 0.9,
            content: `BM25 result for: ${query}`,
          },
          {
            id: "bm25-2",
            source: "bm25",
            rank: 2,
            originalScore: 0.8,
            content: `Another BM25 match`,
          },
          {
            id: "common-1",
            source: "bm25",
            rank: 3,
            originalScore: 0.7,
            content: `Common document`,
          },
        ];
      },
    });

    // Mock Vector _provider
    this.providers.set("vector", {
      search: async (query: string) => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return [
          {
            id: "vec-1",
            source: "vector",
            rank: 1,
            originalScore: 0.85,
            content: `Vector result for: ${query}`,
          },
          {
            id: "common-1",
            source: "vector",
            rank: 2,
            originalScore: 0.75,
            content: `Common document`,
          },
          {
            id: "vec-3",
            source: "vector",
            rank: 3,
            originalScore: 0.65,
            content: `Semantic match`,
          },
        ];
      },
    });

    // Mock KG _provider
    this.providers.set("kg", {
      search: async (_query: string) => {
        await new Promise((resolve) => setTimeout(resolve, 8));
        return [
          {
            id: "kg-1",
            source: "kg",
            rank: 1,
            originalScore: 0.95,
            content: `Knowledge graph result`,
          },
          {
            id: "kg-2",
            source: "kg",
            rank: 2,
            originalScore: 0.85,
            content: `Related concept`,
          },
        ];
      },
    });
  }

  /**
   * Warmup providers
   */
  private async warmupProviders(): Promise<void> {
    const _warmupQuery = "test warmup query";

    for (const [_source, _provider] of this.providers) {
      try {
        await provider.search(_warmupQuery);
      } catch {
        // Ignore warmup errors
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return {
      rrf: this.rrfFusion.getStatistics(),
      reranker: this.reranker.getCacheStats(),
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.reranker.clearCache();
  }

  /**
   * Shutdown the search engine
   */
  async shutdown(): Promise<void> {
    this.clearCache();
    this.emit("shutdown");
  }
}
