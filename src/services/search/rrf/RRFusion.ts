/**
 * RRF (Reciprocal Rank Fusion) Implementation
 * Phase 4.1: Core fusion algorithm
 *
 * Based on: Cormack et al. "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods"
 * https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf
 */

import { createHash } from "node:crypto";
import { telemetry, _SystemEvent } from "../../base/TelemetryCollector";
import {
  SearchSource,
  Language,
  SourceResult,
  RRFConfig,
  RRFResult,
  RRFStatistics,
  RRFMetrics,
  CacheKeyOptions,
  DEFAULT_RRF_CONFIG,
} from "./types";

export class RRFusion {
  private config: RRFConfig;
  private statistics: RRFStatistics | null = null;

  constructor(config?: Partial<RRFConfig>) {
    this.config = {
      ...DEFAULT_RRF_CONFIG,
      ...config,
    };
  }

  /**
   * Fuse _results from multiple sources using RRF algorithm
   */
  async fuse(
    sourceResults: Map<SearchSource, SourceResult[]>,
    language: Language = "en",
  ): Promise<RRFResult[]> {
    const _startTime = Date.now();
    const _endTimer = telemetry.startTimer("search.rrf.fusion.start", {
      comp: "search",
      language,
    });

    try {
      // Step 1: Calculate RRF scores
      const _rrfScores = this.calculateRRFScores(sourceResults, language);

      // Step 2: Normalize scores if configured
      const _normalizedResults = this.config.normalizeScores
        ? this.normalizeScores(_rrfScores)
        : _rrfScores;

      // Step 3: Filter by minimum score (only after normalization)
      const _filteredResults = this.config.normalizeScores
        ? _normalizedResults.filter((r) => r.finalScore >= this.config.minScore)
        : _normalizedResults; // Don't filter if not normalizing

      // Step 4: Sort by final score
      const _sortedResults = _filteredResults.sort(
        (a, b) => b.finalScore - a.finalScore,
      );

      // Update statistics
      this.statistics = {
        totalCandidates: this.countTotalCandidates(sourceResults),
        uniqueResults: _sortedResults.length,
        sourceCounts: this.countSources(sourceResults),
        fusionTimeMs: Date.now() - _startTime,
        normalizationApplied: this.config.normalizeScores,
        languageUsed: language,
      };

      telemetry.emit({
        event: "search.rrf.fusion.complete",
        tags: { comp: "search", language },
        meta: {
          candidatesIn: this.statistics.totalCandidates,
          resultsOut: this.statistics.uniqueResults,
          timeMs: this.statistics.fusionTimeMs,
        },
      });

      return _sortedResults;
    } finally {
      _endTimer();
    }
  }

  /**
   * Calculate RRF scores for all _results
   */
  private calculateRRFScores(
    sourceResults: Map<SearchSource, SourceResult[]>,
    language: Language,
  ): RRFResult[] {
    const _rrfScoreMap = new Map<string, RRFResult>();
    const _weights = this.getLanguageWeights(language);

    // Process each source
    for (const [_source, _results] of sourceResults) {
      const _weight = _weights[_source];

      // Process each _result from this source
      _results.forEach((_result, index) => {
        const _rank = _result._rank || index + 1; // Use provided _rank or index+1
        const _rrfScore = this.calculateSingleRRFScore(_rank) * _weight;

        if (_rrfScoreMap.has(_result.id)) {
          // Result exists, update scores
          const _existing = _rrfScoreMap.get(_result.id)!;
          _existing._rrfScore += _rrfScore;
          _existing.sources._contributions[_source] = _rrfScore;
        } else {
          // New _result
          _rrfScoreMap.set(_result.id, {
            id: _result.id,
            finalScore: _rrfScore,
            _rrfScore: _rrfScore,
            normalizedScore: _rrfScore,
            sources: {
              primary: _source,
              _contributions: {
                [_source]: _rrfScore,
              },
            },
            content: _result.content,
            metadata: _result.metadata,
          });
        }
      });
    }

    // Update final scores and determine primary source
    for (const _result of _rrfScoreMap.values()) {
      _result.finalScore = _result.rrfScore;

      // Determine primary source (highest contribution)
      const _contributions = _result.sources._contributions;
      let _maxContrib = 0;
      let _primarySource: SearchSource = "bm25";

      for (const [_source, _contrib] of Object.entries(_contributions)) {
        if (_contrib! > _maxContrib) {
          _maxContrib = _contrib!;
          _primarySource = _source as SearchSource;
        }
      }

      _result.sources.primary = _primarySource;
    }

    return Array.from(_rrfScoreMap.values());
  }

  /**
   * Calculate single RRF score using formula: 1 / (k + _rank)
   */
  private calculateSingleRRFScore(_rank: number): number {
    return 1.0 / (this.config.k + _rank);
  }

  /**
   * Get language-specific _weights
   */
  private getLanguageWeights(language: Language): Record<SearchSource, number> {
    const _langWeights =
      language === "ja"
        ? this.config.languageWeights.ja
        : this.config.languageWeights.en;

    return {
      bm25: _langWeights.bm25,
      vector: _langWeights.vector,
      kg: _langWeights.kg,
    };
  }

  /**
   * Normalize scores to [0, 1] _range using min-max normalization
   */
  private normalizeScores(_results: RRFResult[]): RRFResult[] {
    if (results.length === 0) return _results;
    if (results.length === 1) {
      return [
        {
          ...results[0],
          normalizedScore: 1.0,
          finalScore: 1.0,
        },
      ];
    }

    // Find min and max scores
    let _minScore = Infinity;
    let _maxScore = -Infinity;

    for (const _result of _results) {
      if (_result.rrfScore < _minScore) _minScore = _result.rrfScore;
      if (_result.rrfScore > _maxScore) _maxScore = _result.rrfScore;
    }

    // Handle edge case where all scores are the same
    if (Math.abs(_maxScore - _minScore) < 1e-10) {
      return results.map((r) => ({
        ...r,
        normalizedScore: 0.5,
        finalScore: 0.5,
      }));
    }

    // Apply min-max normalization
    const _range = _maxScore - _minScore;
    return results.map((r) => {
      const _normalized = (r.rrfScore - _minScore) / _range;
      return {
        ...r,
        normalizedScore: _normalized,
        finalScore: _normalized,
      };
    });
  }

  /**
   * Generate cache key for RRF _results
   */
  generateCacheKey(options: CacheKeyOptions): string {
    const _keyData = {
      query: options.query.toLowerCase().trim(),
      topKIds: options.topKIds.slice(0, 50).sort(), // Top 50, sorted for consistency
      language: options.language,
      version: "rrf-v1",
    };

    const _hash = createHash("sha256");
    _hash.update(JSON.stringify(_keyData));
    return _hash.digest("hex");
  }

  /**
   * Get current statistics
   */
  getStatistics(): RRFStatistics | null {
    return this.statistics;
  }

  /**
   * Count _total candidates across all sources
   */
  private countTotalCandidates(
    sourceResults: Map<SearchSource, SourceResult[]>,
  ): number {
    let _total = 0;
    for (const _results of sourceResults.values()) {
      _total += _results.length;
    }
    return _total;
  }

  /**
   * Count _results per source
   */
  private countSources(
    sourceResults: Map<SearchSource, SourceResult[]>,
  ): Record<SearchSource, number> {
    return {
      bm25: sourceResults.get("bm25")?.length || 0,
      vector: sourceResults.get("vector")?.length || 0,
      kg: sourceResults.get("kg")?.length || 0,
    };
  }

  /**
   * Create metrics for monitoring
   */
  createMetrics(
    _results: RRFResult[],
    fusionTimeMs: number,
    cacheKey: string,
  ): RRFMetrics {
    return {
      fusionLatencyMs: fusionTimeMs,
      normalizationLatencyMs: this.config.normalizeScores
        ? fusionTimeMs * 0.1
        : 0,
      resultsBeforeFusion: this.statistics?.totalCandidates || 0,
      resultsAfterFusion: _results.length,
      cacheKey,
    };
  }
}
