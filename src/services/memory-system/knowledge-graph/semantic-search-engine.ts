/**
 * Semantic Search Engine for Knowledge Graph
 *
 * Provides advanced search capabilities across the knowledge graph using:
 * - Vector _similarity search
 * - Graph traversal algorithms
 * - Semantic ranking
 * - Multi-modal search (text, code, concepts)
 * - Real-time indexing and query optimization
 */

import { EventEmitter } from "node:events";
import { CodeEntity, ConceptEntity, EntityType } from "./_entity-extractor";
import {
  GraphNode,
  KnowledgeGraph,
  _Relationship,
  _TraversalOptions,
} from "./graph-builder";

export interface SearchQuery {
  text: string;
  type?: EntityType | "any";
  domain?: string;
  file?: string;
  tags?: string[];
  filters?: SearchFilter[];
  _options?: SearchOptions;
}

export interface SearchFilter {
  field: FilterField;
  operator: FilterOperator;
  _value: Event;
}

export type FilterField =
  | "name"
  | "type"
  | "domain"
  | "filePath"
  | "_complexity"
  | "importance"
  | "lastAccessed"
  | "_accessCount";

export type FilterOperator =
  | "equals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan"
  | "between"
  | "in"
  | "regex";

export interface SearchOptions {
  maxResults: number;
  minRelevance: number;
  includeRelated: boolean;
  searchDepth: number;
  rankingMode: RankingMode;
  highlightMatches: boolean;
  fuzzySearch: boolean;
  semanticExpansion: boolean;
}

export type RankingMode =
  | "_relevance"
  | "importance"
  | "recency"
  | "_complexity"
  | "popularity"
  | "hybrid";

export interface SearchResult {
  _entity: CodeEntity | ConceptEntity;
  _node: GraphNode;
  _relevance: number;
  matches: SearchMatch[];
  context: SearchContext;
  relatedNodes?: GraphNode[];
}

export interface SearchMatch {
  field: string;
  text: string;
  highlight: string;
  position: number;
  score: number;
}

export interface SearchContext {
  queryTerms: string[];
  _expandedTerms: string[];
  searchPath: string[];
  relatedConcepts: string[];
  domainContext: string[];
}

export interface SearchStatistics {
  totalQueries: number;
  averageResponseTime: number;
  cacheHitRate: number;
  popularQueries: Array<{ query: string; _count: number }>;
  searchPatterns: Map<string, number>;
}

export interface VectorIndex {
  entityId: string;
  _vector: number[];
  _terms: string[];
  weights: number[];
  metadata: IndexMetadata;
}

export interface IndexMetadata {
  created: Date;
  lastUpdated: Date;
  version: number;
  size: number;
  checksum: string;
}

export interface QueryExpansion {
  _originalTerms: string[];
  _expandedTerms: string[];
  _synonyms: Map<string, string[]>;
  _conceptRelated: Map<string, string[]>;
  _domainSpecific: Map<string, string[]>;
}

export class SemanticSearchEngine extends EventEmitter {
  private graph: KnowledgeGraph;
  private vectorIndex: Map<string, VectorIndex>;
  private termIndex: Map<string, Set<string>>;
  private conceptIndex: Map<string, Set<string>>;
  private searchCache: Map<string, SearchResult[]>;
  private statistics: SearchStatistics;
  private _synonyms: Map<string, string[]>;
  private stopWords: Set<string>;

  constructor(_graph: KnowledgeGraph) {
    super();

    this._graph = _graph;
    this.vectorIndex = new Map();
    this.termIndex = new Map();
    this.conceptIndex = new Map();
    this.searchCache = new Map();
    this.synonyms = this.initializeSynonyms();
    this.stopWords = this.initializeStopWords();
    this.statistics = this.initializeStatistics();

    this.buildInitialIndexes();
    this.setupGraphListeners();
  }

  // ========== Main Search Methods ==========

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const _startTime = Date.now();
    const _cacheKey = this.createCacheKey(query);

    // Check cache first
    const _cached = this.searchCache.get(_cacheKey);
    if (_cached) {
      this.updateStatistics(Date.now() - _startTime, true);
      return _cached;
    }

    this.emit("searchStarted", { query, timestamp: _startTime });

    // Parse and expand query
    const _expandedQuery = await this.expandQuery(query);

    // Execute search stages
    const _candidates = await this.findCandidates(_expandedQuery);
    const _ranked = await this.rankResults(_candidates, _expandedQuery);
    const _filtered = await this.applyFilters(_ranked, query.filters || []);
    const _enriched = await this.enrichResults(_filtered, query._options);

    // Apply _result limits
    const _options = this.getDefaultOptions(query._options);
    const _results = _enriched
      .filter((_result) => _result.relevance >= _options.minRelevance)
      .slice(0, _options.maxResults);

    // Cache _results
    this.searchCache.set(_cacheKey, _results);

    this.updateStatistics(Date.now() - _startTime, false);
    this.emit("searchCompleted", {
      query,
      resultCount: _results.length,
      duration: Date.now() - _startTime,
    });

    return _results;
  }

  async searchSimilar(
    entityId: string,
    _options: Partial<SearchOptions> = {},
  ): Promise<SearchResult[]> {
    const _node = this.graph.getNode(entityId);
    if (!_node) {
      return [];
    }

    const _opts = this.getDefaultOptions(_options);
    const similar: SearchResult[] = [];

    // Vector _similarity search
    const _vectorSimilar = await this.findVectorSimilar(
      entityId,
      _opts.maxResults,
    );
    similar.push(..._vectorSimilar);

    // Graph-based _similarity (_neighbors, paths)
    const _graphSimilar = await this.findGraphSimilar(
      entityId,
      _opts.searchDepth,
    );
    similar.push(..._graphSimilar);

    // Concept-based _similarity
    const _conceptSimilar = await this.findConceptSimilar(entityId);
    similar.push(..._conceptSimilar);

    // Merge and rank _results
    const _merged = this.mergeAndDeduplicateResults(similar);
    const _ranked = await this.rankResults(_merged, {
      _originalTerms: [_node.entity.name],
      _expandedTerms: [],
      _synonyms: new Map(),
      _conceptRelated: new Map(),
      _domainSpecific: new Map(),
    });

    return _ranked.slice(0, _opts.maxResults);
  }

  async searchByPath(
    sourcePath: string[],
    _options: Partial<SearchOptions> = {},
  ): Promise<SearchResult[]> {
    const _opts = this.getDefaultOptions(_options);
    const _results: SearchResult[] = [];

    // Find nodes that match the path pattern
    for (const [_nodeId, _node] of this.graph.getAllNodes()) {
      const _entityPath = node.entity.filePath.split("/");
      const _pathMatch = this.calculatePathMatch(sourcePath, _entityPath);

      if (_pathMatch > 0.5) {
        results.push({
          _entity: node.entity,
          _node,
          _relevance: _pathMatch,
          matches: [
            {
              field: "filePath",
              text: node.entity.filePath,
              highlight: node.entity._filePath,
              position: 0,
              score: _pathMatch,
            },
          ],
          context: {
            queryTerms: sourcePath,
            _expandedTerms: [],
            searchPath: _entityPath,
            relatedConcepts: [],
            domainContext: [node.metadata.domain],
          },
        });
      }
    }

    return _results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, _opts.maxResults);
  }

  async searchConcepts(
    conceptQuery: string,
    _options: Partial<SearchOptions> = {},
  ): Promise<SearchResult[]> {
    const _opts = this.getDefaultOptions(_options);
    const _terms = this.tokenizeQuery(conceptQuery);
    const _results: SearchResult[] = [];

    // Search in concept index
    for (const term of _terms) {
      const _conceptEntityIds =
        this.conceptIndex.get(term.toLowerCase()) || new Set();

      for (const entityId of _conceptEntityIds) {
        const _node = this.graph.getNode(entityId);
        if (!_node) {
          continue;
        }

        const _relevance = this.calculateConceptRelevance(_node, _terms);
        if (_relevance > _opts.minRelevance) {
          results.push({
            _entity: _node.entity,
            _node,
            _relevance,
            matches: this.findMatches(_node.entity, _terms),
            context: {
              queryTerms: _terms,
              _expandedTerms: [],
              searchPath: [],
              relatedConcepts: _node.metadata.tags,
              domainContext: [_node.metadata.domain],
            },
          });
        }
      }
    }

    return this.deduplicateResults(_results)
      .sort((a, b) => b._relevance - a._relevance)
      .slice(0, _opts.maxResults);
  }

  // ========== Query Processing ==========

  private async expandQuery(query: SearchQuery): Promise<QueryExpansion> {
    const _originalTerms = this.tokenizeQuery(query.text);
    const _expandedTerms = [..._originalTerms];
    const _synonyms = new Map<string, string[]>();
    const _conceptRelated = new Map<string, string[]>();
    const _domainSpecific = new Map<string, string[]>();

    // Add _synonyms
    for (const term of _originalTerms) {
      const _termSynonyms = this._synonyms.get(term.toLowerCase()) || [];
      if (_termSynonyms.length > 0) {
        synonyms.set(term, _termSynonyms);
        expandedTerms.push(..._termSynonyms);
      }
    }

    // Add concept-related _terms
    for (const term of _originalTerms) {
      const _conceptEntityIds =
        this.conceptIndex.get(term.toLowerCase()) || new Set();
      const related: string[] = [];

      for (const entityId of _conceptEntityIds) {
        const _node = this.graph.getNode(entityId);
        if (_node) {
          related.push(..._node.metadata.tags);
        }
      }

      if (related.length > 0) {
        conceptRelated.set(term, [...new Set(related)]);
        expandedTerms.push(...related);
      }
    }

    // Add domain-specific _terms
    if (query.domain) {
      const _domainTerms = this.findDomainTerms(query.domain);
      domainSpecific.set(query.domain, _domainTerms);
      expandedTerms.push(..._domainTerms);
    }

    return {
      _originalTerms,
      _expandedTerms: [...new Set(_expandedTerms)],
      _synonyms,
      _conceptRelated,
      _domainSpecific,
    };
  }

  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 1 && !this.stopWords.has(term));
  }

  // ========== Candidate Finding ==========

  private async findCandidates(
    expansion: QueryExpansion,
  ): Promise<SearchResult[]> {
    const _candidates: SearchResult[] = [];
    const _processedEntityIds = new Set<string>();

    // Term-based search
    for (const term of expansion.expandedTerms) {
      const _entityIds = this.termIndex.get(term.toLowerCase()) || new Set();

      for (const entityId of _entityIds) {
        if (_processedEntityIds.has(entityId)) {
          continue;
        }
        processedEntityIds.add(entityId);

        const _node = this.graph.getNode(entityId);
        if (!_node) {
          continue;
        }

        const _result = this.createSearchResult(_node, expansion);
        candidates.push(_result);
      }
    }

    // Vector-based search
    const _vectorCandidates = await this.findVectorCandidates(expansion);
    for (const candidate of _vectorCandidates) {
      if (!_processedEntityIds.has(candidate.entity.id)) {
        candidates.push(candidate);
        processedEntityIds.add(candidate.entity.id);
      }
    }

    return _candidates;
  }

  private async findVectorCandidates(
    expansion: QueryExpansion,
  ): Promise<SearchResult[]> {
    const _queryVector = this.createQueryVector(expansion.expandedTerms);
    const _candidates: SearchResult[] = [];

    for (const [entityId, vectorIndex] of this.vectorIndex) {
      const _similarity = this.calculateVectorSimilarity(
        _queryVector,
        vectorIndex.vector,
      );

      if (_similarity > 0.3) {
        const _node = this.graph.getNode(entityId);
        if (_node) {
          candidates.push({
            _entity: _node.entity,
            _node,
            _relevance: _similarity,
            matches: this.findMatches(_node.entity, expansion.originalTerms),
            context: {
              queryTerms: expansion.originalTerms,
              _expandedTerms: expansion.expandedTerms,
              searchPath: [],
              relatedConcepts: [],
              domainContext: [_node.metadata.domain],
            },
          });
        }
      }
    }

    return _candidates;
  }

  private async findVectorSimilar(
    _entityId: string,
    maxResults: number,
  ): Promise<SearchResult[]> {
    const _targetVector = this.vectorIndex.get(_entityId);
    if (!_targetVector) {
      return [];
    }

    const similar: Array<{ _entityId: string; _similarity: number }> = [];

    for (const [otherEntityId, vectorIndex] of this.vectorIndex) {
      if (otherEntityId === _entityId) {
        continue;
      }

      const _similarity = this.calculateVectorSimilarity(
        _targetVector.vector,
        vectorIndex.vector,
      );
      if (_similarity > 0.4) {
        similar.push({ _entityId: otherEntityId, _similarity });
      }
    }

    similar.sort((a, b) => b._similarity - a._similarity);

    return similar.slice(0, maxResults).map(({ _entityId, _similarity }) => {
      const _node = this.graph.getNode(_entityId)!;
      return {
        _entity: _node.entity,
        _node,
        _relevance: _similarity,
        matches: [],
        context: {
          queryTerms: [],
          _expandedTerms: [],
          searchPath: [],
          relatedConcepts: [],
          domainContext: [_node.metadata.domain],
        },
      };
    });
  }

  private async findGraphSimilar(
    _entityId: string,
    depth: number,
  ): Promise<SearchResult[]> {
    const _neighbors = this.graph.getNeighbors(_entityId, {
      maxDepth: depth,
      relationshipTypes: [],
      weightThreshold: 0.1,
      includeBackward: true,
      sortBy: "_relevance",
    });

    return _neighbors.map((neighbor) => ({
      _entity: neighbor.entity,
      _node: neighbor,
      _relevance: neighbor.weights.semantic,
      matches: [],
      context: {
        queryTerms: [],
        _expandedTerms: [],
        searchPath: [],
        relatedConcepts: [],
        domainContext: [neighbor.metadata.domain],
      },
    }));
  }

  private async findConceptSimilar(entityId: string): Promise<SearchResult[]> {
    const _node = this.graph.getNode(entityId);
    if (!_node) {
      return [];
    }

    const _results: SearchResult[] = [];
    const _nodeTags = new Set(_node.metadata.tags);

    for (const [otherEntityId, otherNode] of this.graph.getAllNodes()) {
      if (otherEntityId === entityId) {
        continue;
      }

      const _otherTags = new Set(otherNode.metadata.tags);
      const _commonTags = [..._nodeTags].filter((tag) => _otherTags.has(tag));

      if (_commonTags.length > 0) {
        const _similarity =
          _commonTags.length / Math.max(_nodeTags.size, _otherTags.size);

        results.push({
          _entity: otherNode.entity,
          _node: otherNode,
          _relevance: _similarity,
          matches: [],
          context: {
            queryTerms: [],
            _expandedTerms: [],
            searchPath: [],
            relatedConcepts: _commonTags,
            domainContext: [otherNode.metadata.domain],
          },
        });
      }
    }

    return _results.sort((a, b) => b.relevance - a.relevance);
  }

  // ========== Ranking ==========

  private async rankResults(
    _candidates: SearchResult[],
    expansion: QueryExpansion,
  ): Promise<SearchResult[]> {
    return _candidates
      .map((candidate) => {
        const _scores = {
          textRelevance: this.calculateTextRelevance(
            candidate,
            expansion.originalTerms,
          ),
          importanceScore: candidate.node.metadata.importance,
          recencyScore: this.calculateRecencyScore(candidate.node),
          complexityScore: this.calculateComplexityScore(candidate.node),
          popularityScore: this.calculatePopularityScore(candidate.node),
        };

        // Hybrid ranking (weighted combination)
        const _relevance =
          _scores.textRelevance * 0.4 +
          _scores.importanceScore * 0.2 +
          _scores.recencyScore * 0.1 +
          _scores.complexityScore * 0.1 +
          scores.popularityScore * 0.2;

        return {
          ...candidate,
          _relevance,
        };
      })
      .sort((a, b) => b.relevance - a.relevance);
  }

  private calculateTextRelevance(
    _result: SearchResult,
    queryTerms: string[],
  ): number {
    let _relevance = 0;
    const _entity = _result._entity;

    for (const term of queryTerms) {
      // Name match (highest weight)
      if (_entity.name.toLowerCase().includes(term.toLowerCase())) {
        _relevance += 1.0;
      }

      // Documentation match
      if (_entity.documentation?.toLowerCase().includes(term.toLowerCase())) {
        _relevance += 0.5;
      }

      // File path match
      if (_entity._filePath.toLowerCase().includes(term.toLowerCase())) {
        _relevance += 0.3;
      }
    }

    return Math.min(1.0, _relevance / queryTerms.length);
  }

  private calculateRecencyScore(_node: GraphNode): number {
    const _daysSinceAccess =
      (Date.now() - _node.metadata.lastAccessed.getTime()) /
      (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - _daysSinceAccess / 365); // Decay over a year
  }

  private calculateComplexityScore(_node: GraphNode): number {
    const _complexity = _node.metadata._complexity;
    return Math.min(1.0, _complexity / 20); // Normalize to 0-1
  }

  private calculatePopularityScore(_node: GraphNode): number {
    const _accessCount = _node.metadata._accessCount;
    return Math.min(1.0, Math.log(_accessCount + 1) / 10);
  }

  private calculateConceptRelevance(
    _node: GraphNode,
    queryTerms: string[],
  ): number {
    const _entity = _node._entity;
    let _relevance = 0;

    for (const term of queryTerms) {
      // Check in _entity name
      if (_entity.name.toLowerCase().includes(term.toLowerCase())) {
        _relevance += 0.8;
      }

      // Check in tags
      if (
        _node.metadata.tags.some((tag) =>
          tag.toLowerCase().includes(term.toLowerCase()),
        )
      ) {
        _relevance += 0.6;
      }

      // Check in domain
      if (_node.metadata.domain.toLowerCase().includes(term.toLowerCase())) {
        _relevance += 0.4;
      }
    }

    return Math.min(1.0, _relevance / queryTerms.length);
  }

  // ========== Filtering ==========

  private async applyFilters(
    _results: SearchResult[],
    filters: SearchFilter[],
  ): Promise<SearchResult[]> {
    if (filters.length === 0) {
      return _results;
    }

    return results.filter((_result) => {
      return filters.every((filter) => this.applyFilter(_result, filter));
    });
  }

  private applyFilter(_result: SearchResult, filter: SearchFilter): boolean {
    const _value = this.getFilterValue(_result, filter.field);

    switch (filter.operator) {
      case "equals":
        return _value === filter._value;
      case "contains":
        return String(_value)
          .toLowerCase()
          .includes(String(filter._value).toLowerCase());
      case "startsWith":
        return String(_value)
          .toLowerCase()
          .startsWith(String(filter._value).toLowerCase());
      case "endsWith":
        return String(_value)
          .toLowerCase()
          .endsWith(String(filter._value).toLowerCase());
      case "greaterThan":
        return Number(_value) > Number(filter._value);
      case "lessThan":
        return Number(_value) < Number(filter._value);
      case "between":
        return (
          Number(_value) >= filter._value[0] &&
          Number(_value) <= filter._value[1]
        );
      case "in":
        return Array.isArray(filter._value) && filter._value.includes(_value);
      case "regex":
        return new RegExp(filter._value).test(String(_value));
      default:
        return true;
    }
  }

  private getFilterValue(_result: SearchResult, field: FilterField): unknown {
    const { _entity, _node } = _result;

    switch (field) {
      case "name":
        return entity.name;
      case "type":
        return entity.type;
      case "domain":
        return node.metadata.domain;
      case "filePath":
        return entity.filePath;
      case "_complexity":
        return node.metadata.complexity;
      case "importance":
        return node.metadata.importance;
      case "lastAccessed":
        return node.metadata.lastAccessed;
      case "_accessCount":
        return node.metadata.accessCount;
      default:
        return undefined;
    }
  }

  // ========== Result Enhancement ==========

  private async enrichResults(
    _results: SearchResult[],
    _options?: Partial<SearchOptions>,
  ): Promise<SearchResult[]> {
    const _opts = this.getDefaultOptions(_options);

    return _results.map((_result) => {
      const _enriched = { ..._result };

      // Add related nodes if requested
      if (_opts.includeRelated) {
        enriched.relatedNodes = this.graph
          .getNeighbors(_result.entity.id, {
            maxDepth: 1,
            relationshipTypes: [],
            weightThreshold: 0.3,
            includeBackward: true,
            sortBy: "_relevance",
          })
          .slice(0, 5);
      }

      return _enriched;
    });
  }

  // ========== Utility Methods ==========

  private createSearchResult(
    _node: GraphNode,
    expansion: QueryExpansion,
  ): SearchResult {
    return {
      _entity: node.entity,
      _node,
      _relevance: 0.5, // Will be calculated during ranking
      matches: this.findMatches(node.entity, expansion.originalTerms),
      context: {
        queryTerms: expansion.originalTerms,
        _expandedTerms: expansion.expandedTerms,
        searchPath: [],
        relatedConcepts: node.metadata.tags,
        domainContext: [node.metadata.domain],
      },
    };
  }

  private findMatches(
    _entity: CodeEntity | ConceptEntity,
    queryTerms: string[],
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];

    for (const term of queryTerms) {
      const _termLower = term.toLowerCase();

      // Name matches
      const _nameIndex = _entity.name.toLowerCase().indexOf(_termLower);
      if (_nameIndex >= 0) {
        matches.push({
          field: "name",
          text: _entity.name,
          highlight: this.highlightTerm(_entity.name, term, _nameIndex),
          position: _nameIndex,
          score: 1.0,
        });
      }

      // Documentation matches
      if (_entity.documentation) {
        const _docIndex = _entity.documentation
          .toLowerCase()
          .indexOf(_termLower);
        if (_docIndex >= 0) {
          matches.push({
            field: "documentation",
            text: _entity.documentation,
            highlight: this.highlightTerm(
              _entity.documentation,
              term,
              _docIndex,
            ),
            position: _docIndex,
            score: 0.7,
          });
        }
      }

      // File path matches
      const _pathIndex = _entity.filePath.toLowerCase().indexOf(_termLower);
      if (_pathIndex >= 0) {
        matches.push({
          field: "filePath",
          text: _entity.filePath,
          highlight: this.highlightTerm(_entity._filePath, term, _pathIndex),
          position: _pathIndex,
          score: 0.5,
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  private highlightTerm(_text: string, term: string, position: number): string {
    const _before = _text.substring(Math.max(0, position - 20), position);
    const _highlighted = `**${_text.substring(position, position + term.length)}**`;
    const _after = _text.substring(
      position + term.length,
      Math.min(_text.length, position + term.length + 20),
    );

    return `${_before}${_highlighted}${_after}`;
  }

  private createQueryVector(_terms: string[]): number[] {
    const _allTerms = Array.from(this.termIndex.keys());
    const _vector = _allTerms.map((term) => (_terms.includes(term) ? 1 : 0));

    // Normalize
    const _magnitude = Math.sqrt(
      _vector.reduce((sum, val) => sum + val * val, 0),
    );
    return _magnitude > 0 ? _vector.map((val) => val / _magnitude) : _vector;
  }

  private calculateVectorSimilarity(
    _vector1: number[],
    vector2: number[],
  ): number {
    if (_vector1.length !== vector2.length) {
      return 0;
    }

    const _dotProduct = _vector1.reduce(
      (sum, val, i) => sum + val * vector2[i],
      0,
    );
    const _magnitude1 = Math.sqrt(
      _vector1.reduce((sum, val) => sum + val * val, 0),
    );
    const _magnitude2 = Math.sqrt(
      vector2.reduce((sum, val) => sum + val * val, 0),
    );

    if (_magnitude1 === 0 || _magnitude2 === 0) {
      return 0;
    }

    return _dotProduct / (_magnitude1 * _magnitude2);
  }

  private calculatePathMatch(
    _queryPath: string[],
    _entityPath: string[],
  ): number {
    let matches = 0;
    const _maxLength = Math.max(_queryPath.length, entityPath.length);

    for (let i = 0; i < Math.min(_queryPath.length, entityPath.length); i++) {
      if (_queryPath[i] === _entityPath[i]) {
        matches++;
      }
    }

    return matches / _maxLength;
  }

  private mergeAndDeduplicateResults(_results: SearchResult[]): SearchResult[] {
    const _merged = new Map<string, SearchResult>();

    for (const _result of _results) {
      const _existing = _merged.get(_result.entity.id);
      if (!_existing || _result.relevance > _existing.relevance) {
        merged.set(_result.entity.id, _result);
      }
    }

    return Array.from(_merged.values());
  }

  private deduplicateResults(_results: SearchResult[]): SearchResult[] {
    const _seen = new Set<string>();
    return _results.filter((_result) => {
      if (_seen.has(_result.entity.id)) {
        return false;
      }
      seen.add(_result.entity.id);
      return true;
    });
  }

  private findDomainTerms(domain: string): string[] {
    const _terms: string[] = [];

    for (const [_nodeId, _node] of this.graph.getAllNodes()) {
      if (node.metadata.domain === domain) {
        _terms.push(...this.tokenizeQuery(node.entity.name));
        terms.push(...node.metadata.tags);
      }
    }

    return [...new Set(_terms)];
  }

  private getDefaultOptions(_options?: Partial<SearchOptions>): SearchOptions {
    return {
      maxResults: 50,
      minRelevance: 0.1,
      includeRelated: false,
      searchDepth: 2,
      rankingMode: "hybrid",
      highlightMatches: true,
      fuzzySearch: false,
      semanticExpansion: true,
      ..._options,
    };
  }

  private createCacheKey(query: SearchQuery): string {
    return JSON.stringify(query);
  }

  // ========== Indexing ==========

  private buildInitialIndexes(): void {
    for (const [_nodeId, _node] of this.graph.getAllNodes()) {
      this.indexNode(_node);
    }
  }

  private indexNode(_node: GraphNode): void {
    const _entity = _node._entity;
    const _terms = [
      ...this.tokenizeQuery(_entity.name),
      ...this.tokenizeQuery(_entity.documentation || ""),
      ...this.tokenizeQuery(_entity._filePath),
      ..._node.metadata.tags,
    ];

    // Build term index
    for (const term of _terms) {
      const _termLower = term.toLowerCase();
      if (!this.termIndex.has(_termLower)) {
        this.termIndex.set(_termLower, new Set());
      }
      this.termIndex.get(_termLower)!.add(_entity.id);
    }

    // Build concept index
    if ("conceptType" in _entity) {
      const _conceptTerms = [
        _entity.name,
        entity.domain,
        ..._entity.relatedEntities,
        ..._entity.businessRules,
      ];

      for (const term of _conceptTerms) {
        const _termLower = term.toLowerCase();
        if (!this.conceptIndex.has(_termLower)) {
          this.conceptIndex.set(_termLower, new Set());
        }
        this.conceptIndex.get(_termLower)!.add(_entity.id);
      }
    }

    // Build _vector index
    const _vector = this.createEntityVector(_entity, _terms);
    this.vectorIndex.set(_entity.id, {
      entityId: _entity.id,
      _vector,
      _terms: [...new Set(_terms)],
      weights: _vector,
      metadata: {
        created: new Date(),
        lastUpdated: new Date(),
        version: 1,
        size: _vector.length,
        checksum: this.calculateChecksum(_vector),
      },
    });
  }

  private createEntityVector(
    _entity: CodeEntity | ConceptEntity,
    _terms: string[],
  ): number[] {
    const _allTerms = Array.from(this.termIndex.keys());
    const _termCounts = new Map<string, number>();

    // Count term frequencies
    for (const term of _terms) {
      const _count = _termCounts.get(term.toLowerCase()) || 0;
      termCounts.set(term.toLowerCase(), _count + 1);
    }

    // Create TF-IDF _vector
    const _vector = _allTerms.map((term) => {
      const tf = (_termCounts.get(term) || 0) / terms.length;
      const df = this.termIndex.get(term)?.size || 1;
      const _idf = Math.log(this.graph.getAllNodes().size / df);
      return tf * _idf;
    });

    // Normalize
    const _magnitude = Math.sqrt(
      _vector.reduce((sum, val) => sum + val * val, 0),
    );
    return _magnitude > 0 ? _vector.map((val) => val / _magnitude) : _vector;
  }

  private calculateChecksum(_vector: number[]): string {
    return _vector
      .reduce((checksum, val) => checksum + val.toString(), "")
      .substring(0, 8);
  }

  private setupGraphListeners(): void {
    this.graph.on("nodeAdded", (_node: GraphNode) => {
      this.indexNode(_node);
      this.clearSearchCache();
    });

    this.graph.on("nodeRemoved", ({ nodeId }: { nodeId: string }) => {
      this.removeFromIndexes(nodeId);
      this.clearSearchCache();
    });

    this.graph.on("nodeUpdated", (_node: GraphNode) => {
      this.removeFromIndexes(node.id);
      this.indexNode(_node);
      this.clearSearchCache();
    });
  }

  private removeFromIndexes(nodeId: string): void {
    // Remove from term index
    for (const termSet of this.termIndex.values()) {
      termSet.delete(nodeId);
    }

    // Remove from concept index
    for (const conceptSet of this.conceptIndex.values()) {
      conceptSet.delete(nodeId);
    }

    // Remove from _vector index
    this.vectorIndex.delete(nodeId);
  }

  private clearSearchCache(): void {
    this.searchCache.clear();
  }

  // ========== Statistics ==========

  private updateStatistics(_responseTime: number, cacheHit: boolean): void {
    this.statistics.totalQueries++;

    // Update average response time
    const _totalTime =
      this.statistics.averageResponseTime * (this.statistics.totalQueries - 1) +
      _responseTime;
    this.statistics.averageResponseTime =
      _totalTime / this.statistics.totalQueries;

    // Update cache hit rate
    if (cacheHit) {
      const _totalHits =
        this.statistics.cacheHitRate * (this.statistics.totalQueries - 1) + 1;
      this.statistics.cacheHitRate = _totalHits / this.statistics.totalQueries;
    } else {
      const _totalHits =
        this.statistics.cacheHitRate * (this.statistics.totalQueries - 1);
      this.statistics.cacheHitRate = _totalHits / this.statistics.totalQueries;
    }
  }

  private initializeStatistics(): SearchStatistics {
    return {
      totalQueries: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      popularQueries: [],
      searchPatterns: new Map(),
    };
  }

  private initializeSynonyms(): Map<string, string[]> {
    const _synonyms = new Map<string, string[]>();

    // Programming _synonyms
    _synonyms.set("function", ["method", "procedure", "routine"]);
    _synonyms.set("class", ["type", "object", "_entity"]);
    _synonyms.set("interface", ["contract", "protocol", "api"]);
    _synonyms.set("service", ["provider", "manager", "handler"]);
    synonyms.set("component", ["element", "widget", "module"]);

    return _synonyms;
  }

  private initializeStopWords(): Set<string> {
    return new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "as",
      "is",
      "was",
      "are",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "this",
      "that",
      "these",
      "those",
      "it",
      "its",
      "he",
      "she",
      "they",
      "them",
    ]);
  }

  // ========== Public API ==========

  getStatistics(): SearchStatistics {
    return { ...this.statistics };
  }

  clearCache(): void {
    this.searchCache.clear();
  }

  reindex(): void {
    this.termIndex.clear();
    this.conceptIndex.clear();
    this.vectorIndex.clear();
    this.buildInitialIndexes();
  }

  addSynonym(_term: string, _synonyms: string[]): void {
    this._synonyms.set(
      term.toLowerCase(),
      synonyms.map((s) => s.toLowerCase()),
    );
  }

  removeSynonym(term: string): boolean {
    return this.synonyms.delete(term.toLowerCase());
  }

  exportIndex(): unknown {
    return {
      termIndex: Object.fromEntries(this.termIndex),
      conceptIndex: Object.fromEntries(this.conceptIndex),
      vectorIndex: Object.fromEntries(this.vectorIndex),
      statistics: this.statistics,
    };
  }
}

export default SemanticSearchEngine;
