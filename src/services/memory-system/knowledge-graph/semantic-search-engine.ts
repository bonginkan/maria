/**
 * Semantic Search Engine for Knowledge Graph
 *
 * Provides advanced search capabilities across the knowledge graph using:
 * - Vector similarity search
 * - Graph traversal algorithms
 * - Semantic ranking
 * - Multi-modal search (text, code, concepts)
 * - Real-time indexing and query optimization
 */

import { EventEmitter } from 'events';
import { CodeEntity, ConceptEntity, EntityType } from './entity-extractor';
import { KnowledgeGraph, GraphNode, Relationship, TraversalOptions } from './graph-builder';

export interface SearchQuery {
  text: string;
  type?: EntityType | 'any';
  domain?: string;
  file?: string;
  tags?: string[];
  filters?: SearchFilter[];
  options?: SearchOptions;
}

export interface SearchFilter {
  field: FilterField;
  operator: FilterOperator;
  value: Event;
}

export type FilterField =
  | 'name'
  | 'type'
  | 'domain'
  | 'filePath'
  | 'complexity'
  | 'importance'
  | 'lastAccessed'
  | 'accessCount';

export type FilterOperator =
  | 'equals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'in'
  | 'regex';

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
  | 'relevance'
  | 'importance'
  | 'recency'
  | 'complexity'
  | 'popularity'
  | 'hybrid';

export interface SearchResult {
  entity: CodeEntity | ConceptEntity;
  node: GraphNode;
  relevance: number;
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
  expandedTerms: string[];
  searchPath: string[];
  relatedConcepts: string[];
  domainContext: string[];
}

export interface SearchStatistics {
  totalQueries: number;
  averageResponseTime: number;
  cacheHitRate: number;
  popularQueries: Array<{ query: string; count: number }>;
  searchPatterns: Map<string, number>;
}

export interface VectorIndex {
  entityId: string;
  vector: number[];
  terms: string[];
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
  originalTerms: string[];
  expandedTerms: string[];
  synonyms: Map<string, string[]>;
  conceptRelated: Map<string, string[]>;
  domainSpecific: Map<string, string[]>;
}

export class SemanticSearchEngine extends EventEmitter {
  private graph: KnowledgeGraph;
  private vectorIndex: Map<string, VectorIndex>;
  private termIndex: Map<string, Set<string>>;
  private conceptIndex: Map<string, Set<string>>;
  private searchCache: Map<string, SearchResult[]>;
  private statistics: SearchStatistics;
  private synonyms: Map<string, string[]>;
  private stopWords: Set<string>;

  constructor(graph: KnowledgeGraph) {
    super();

    this.graph = graph;
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
    const startTime = Date.now();
    const cacheKey = this.createCacheKey(query);

    // Check cache first
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      this.updateStatistics(Date.now() - startTime, true);
      return cached;
    }

    this.emit('searchStarted', { query, timestamp: startTime });

    // Parse and expand query
    const expandedQuery = await this.expandQuery(query);

    // Execute search stages
    const candidates = await this.findCandidates(expandedQuery);
    const ranked = await this.rankResults(candidates, expandedQuery);
    const filtered = await this.applyFilters(ranked, query.filters || []);
    const enriched = await this.enrichResults(filtered, query.options);

    // Apply result limits
    const options = this.getDefaultOptions(query.options);
    const results = enriched
      .filter((result) => result.relevance >= options.minRelevance)
      .slice(0, options.maxResults);

    // Cache results
    this.searchCache.set(cacheKey, results);

    this.updateStatistics(Date.now() - startTime, false);
    this.emit('searchCompleted', {
      query,
      resultCount: results.length,
      duration: Date.now() - startTime,
    });

    return results;
  }

  async searchSimilar(
    entityId: string,
    options: Partial<SearchOptions> = {},
  ): Promise<SearchResult[]> {
    const node = this.graph.getNode(entityId);
    if (!node) return [];

    const opts = this.getDefaultOptions(options);
    const similar: SearchResult[] = [];

    // Vector similarity search
    const vectorSimilar = await this.findVectorSimilar(entityId, opts.maxResults);
    similar.push(...vectorSimilar);

    // Graph-based similarity (neighbors, paths)
    const graphSimilar = await this.findGraphSimilar(entityId, opts.searchDepth);
    similar.push(...graphSimilar);

    // Concept-based similarity
    const conceptSimilar = await this.findConceptSimilar(entityId);
    similar.push(...conceptSimilar);

    // Merge and rank results
    const merged = this.mergeAndDeduplicateResults(similar);
    const ranked = await this.rankResults(merged, {
      originalTerms: [node.entity.name],
      expandedTerms: [],
      synonyms: new Map(),
      conceptRelated: new Map(),
      domainSpecific: new Map(),
    });

    return ranked.slice(0, opts.maxResults);
  }

  async searchByPath(
    sourcePath: string[],
    options: Partial<SearchOptions> = {},
  ): Promise<SearchResult[]> {
    const opts = this.getDefaultOptions(options);
    const results: SearchResult[] = [];

    // Find nodes that match the path pattern
    for (const [nodeId, node] of this.graph.getAllNodes()) {
      const entityPath = node.entity.filePath.split('/');
      const pathMatch = this.calculatePathMatch(sourcePath, entityPath);

      if (pathMatch > 0.5) {
        results.push({
          entity: node.entity,
          node,
          relevance: pathMatch,
          matches: [
            {
              field: 'filePath',
              text: node.entity.filePath,
              highlight: node.entity.filePath,
              position: 0,
              score: pathMatch,
            },
          ],
          context: {
            queryTerms: sourcePath,
            expandedTerms: [],
            searchPath: entityPath,
            relatedConcepts: [],
            domainContext: [node.metadata.domain],
          },
        });
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance).slice(0, opts.maxResults);
  }

  async searchConcepts(
    conceptQuery: string,
    options: Partial<SearchOptions> = {},
  ): Promise<SearchResult[]> {
    const opts = this.getDefaultOptions(options);
    const terms = this.tokenizeQuery(conceptQuery);
    const results: SearchResult[] = [];

    // Search in concept index
    for (const term of terms) {
      const conceptEntityIds = this.conceptIndex.get(term.toLowerCase()) || new Set();

      for (const entityId of conceptEntityIds) {
        const node = this.graph.getNode(entityId);
        if (!node) continue;

        const relevance = this.calculateConceptRelevance(node, terms);
        if (relevance > opts.minRelevance) {
          results.push({
            entity: node.entity,
            node,
            relevance,
            matches: this.findMatches(node.entity, terms),
            context: {
              queryTerms: terms,
              expandedTerms: [],
              searchPath: [],
              relatedConcepts: node.metadata.tags,
              domainContext: [node.metadata.domain],
            },
          });
        }
      }
    }

    return this.deduplicateResults(results)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, opts.maxResults);
  }

  // ========== Query Processing ==========

  private async expandQuery(query: SearchQuery): Promise<QueryExpansion> {
    const originalTerms = this.tokenizeQuery(query.text);
    const expandedTerms = [...originalTerms];
    const synonyms = new Map<string, string[]>();
    const conceptRelated = new Map<string, string[]>();
    const domainSpecific = new Map<string, string[]>();

    // Add synonyms
    for (const term of originalTerms) {
      const termSynonyms = this.synonyms.get(term.toLowerCase()) || [];
      if (termSynonyms.length > 0) {
        synonyms.set(term, termSynonyms);
        expandedTerms.push(...termSynonyms);
      }
    }

    // Add concept-related terms
    for (const term of originalTerms) {
      const conceptEntityIds = this.conceptIndex.get(term.toLowerCase()) || new Set();
      const related: string[] = [];

      for (const entityId of conceptEntityIds) {
        const node = this.graph.getNode(entityId);
        if (node) {
          related.push(...node.metadata.tags);
        }
      }

      if (related.length > 0) {
        conceptRelated.set(term, [...new Set(related)]);
        expandedTerms.push(...related);
      }
    }

    // Add domain-specific terms
    if (query.domain) {
      const domainTerms = this.findDomainTerms(query.domain);
      domainSpecific.set(query.domain, domainTerms);
      expandedTerms.push(...domainTerms);
    }

    return {
      originalTerms,
      expandedTerms: [...new Set(expandedTerms)],
      synonyms,
      conceptRelated,
      domainSpecific,
    };
  }

  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 1 && !this.stopWords.has(term));
  }

  // ========== Candidate Finding ==========

  private async findCandidates(expansion: QueryExpansion): Promise<SearchResult[]> {
    const candidates: SearchResult[] = [];
    const processedEntityIds = new Set<string>();

    // Term-based search
    for (const term of expansion.expandedTerms) {
      const entityIds = this.termIndex.get(term.toLowerCase()) || new Set();

      for (const entityId of entityIds) {
        if (processedEntityIds.has(entityId)) continue;
        processedEntityIds.add(entityId);

        const node = this.graph.getNode(entityId);
        if (!node) continue;

        const result = this.createSearchResult(node, expansion);
        candidates.push(result);
      }
    }

    // Vector-based search
    const vectorCandidates = await this.findVectorCandidates(expansion);
    for (const candidate of vectorCandidates) {
      if (!processedEntityIds.has(candidate.entity.id)) {
        candidates.push(candidate);
        processedEntityIds.add(candidate.entity.id);
      }
    }

    return candidates;
  }

  private async findVectorCandidates(expansion: QueryExpansion): Promise<SearchResult[]> {
    const queryVector = this.createQueryVector(expansion.expandedTerms);
    const candidates: SearchResult[] = [];

    for (const [entityId, vectorIndex] of this.vectorIndex) {
      const similarity = this.calculateVectorSimilarity(queryVector, vectorIndex.vector);

      if (similarity > 0.3) {
        const node = this.graph.getNode(entityId);
        if (node) {
          candidates.push({
            entity: node.entity,
            node,
            relevance: similarity,
            matches: this.findMatches(node.entity, expansion.originalTerms),
            context: {
              queryTerms: expansion.originalTerms,
              expandedTerms: expansion.expandedTerms,
              searchPath: [],
              relatedConcepts: [],
              domainContext: [node.metadata.domain],
            },
          });
        }
      }
    }

    return candidates;
  }

  private async findVectorSimilar(entityId: string, maxResults: number): Promise<SearchResult[]> {
    const targetVector = this.vectorIndex.get(entityId);
    if (!targetVector) return [];

    const similar: Array<{ entityId: string; similarity: number }> = [];

    for (const [otherEntityId, vectorIndex] of this.vectorIndex) {
      if (otherEntityId === entityId) continue;

      const similarity = this.calculateVectorSimilarity(targetVector.vector, vectorIndex.vector);
      if (similarity > 0.4) {
        similar.push({ entityId: otherEntityId, similarity });
      }
    }

    similar.sort((a, b) => b.similarity - a.similarity);

    return similar.slice(0, maxResults).map(({ entityId, similarity }) => {
      const node = this.graph.getNode(entityId)!;
      return {
        entity: node.entity,
        node,
        relevance: similarity,
        matches: [],
        context: {
          queryTerms: [],
          expandedTerms: [],
          searchPath: [],
          relatedConcepts: [],
          domainContext: [node.metadata.domain],
        },
      };
    });
  }

  private async findGraphSimilar(entityId: string, depth: number): Promise<SearchResult[]> {
    const neighbors = this.graph.getNeighbors(entityId, {
      maxDepth: depth,
      relationshipTypes: [],
      weightThreshold: 0.1,
      includeBackward: true,
      sortBy: 'relevance',
    });

    return neighbors.map((neighbor) => ({
      entity: neighbor.entity,
      node: neighbor,
      relevance: neighbor.weights.semantic,
      matches: [],
      context: {
        queryTerms: [],
        expandedTerms: [],
        searchPath: [],
        relatedConcepts: [],
        domainContext: [neighbor.metadata.domain],
      },
    }));
  }

  private async findConceptSimilar(entityId: string): Promise<SearchResult[]> {
    const node = this.graph.getNode(entityId);
    if (!node) return [];

    const results: SearchResult[] = [];
    const nodeTags = new Set(node.metadata.tags);

    for (const [otherEntityId, otherNode] of this.graph.getAllNodes()) {
      if (otherEntityId === entityId) continue;

      const otherTags = new Set(otherNode.metadata.tags);
      const commonTags = [...nodeTags].filter((tag) => otherTags.has(tag));

      if (commonTags.length > 0) {
        const similarity = commonTags.length / Math.max(nodeTags.size, otherTags.size);

        results.push({
          entity: otherNode.entity,
          node: otherNode,
          relevance: similarity,
          matches: [],
          context: {
            queryTerms: [],
            expandedTerms: [],
            searchPath: [],
            relatedConcepts: commonTags,
            domainContext: [otherNode.metadata.domain],
          },
        });
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance);
  }

  // ========== Ranking ==========

  private async rankResults(
    candidates: SearchResult[],
    expansion: QueryExpansion,
  ): Promise<SearchResult[]> {
    return candidates
      .map((candidate) => {
        const scores = {
          textRelevance: this.calculateTextRelevance(candidate, expansion.originalTerms),
          importanceScore: candidate.node.metadata.importance,
          recencyScore: this.calculateRecencyScore(candidate.node),
          complexityScore: this.calculateComplexityScore(candidate.node),
          popularityScore: this.calculatePopularityScore(candidate.node),
        };

        // Hybrid ranking (weighted combination)
        const relevance =
          scores.textRelevance * 0.4 +
          scores.importanceScore * 0.2 +
          scores.recencyScore * 0.1 +
          scores.complexityScore * 0.1 +
          scores.popularityScore * 0.2;

        return {
          ...candidate,
          relevance,
        };
      })
      .sort((a, b) => b.relevance - a.relevance);
  }

  private calculateTextRelevance(result: SearchResult, queryTerms: string[]): number {
    let relevance = 0;
    const entity = result.entity;

    for (const term of queryTerms) {
      // Name match (highest weight)
      if (entity.name.toLowerCase().includes(term.toLowerCase())) {
        relevance += 1.0;
      }

      // Documentation match
      if (entity.documentation?.toLowerCase().includes(term.toLowerCase())) {
        relevance += 0.5;
      }

      // File path match
      if (entity.filePath.toLowerCase().includes(term.toLowerCase())) {
        relevance += 0.3;
      }
    }

    return Math.min(1.0, relevance / queryTerms.length);
  }

  private calculateRecencyScore(node: GraphNode): number {
    const daysSinceAccess =
      (Date.now() - node.metadata.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - daysSinceAccess / 365); // Decay over a year
  }

  private calculateComplexityScore(node: GraphNode): number {
    const complexity = node.metadata.complexity;
    return Math.min(1.0, complexity / 20); // Normalize to 0-1
  }

  private calculatePopularityScore(node: GraphNode): number {
    const accessCount = node.metadata.accessCount;
    return Math.min(1.0, Math.log(accessCount + 1) / 10);
  }

  private calculateConceptRelevance(node: GraphNode, queryTerms: string[]): number {
    const entity = node.entity;
    let relevance = 0;

    for (const term of queryTerms) {
      // Check in entity name
      if (entity.name.toLowerCase().includes(term.toLowerCase())) {
        relevance += 0.8;
      }

      // Check in tags
      if (node.metadata.tags.some((tag) => tag.toLowerCase().includes(term.toLowerCase()))) {
        relevance += 0.6;
      }

      // Check in domain
      if (node.metadata.domain.toLowerCase().includes(term.toLowerCase())) {
        relevance += 0.4;
      }
    }

    return Math.min(1.0, relevance / queryTerms.length);
  }

  // ========== Filtering ==========

  private async applyFilters(
    results: SearchResult[],
    filters: SearchFilter[],
  ): Promise<SearchResult[]> {
    if (filters.length === 0) return results;

    return results.filter((result) => {
      return filters.every((filter) => this.applyFilter(result, filter));
    });
  }

  private applyFilter(result: SearchResult, filter: SearchFilter): boolean {
    const value = this.getFilterValue(result, filter.field);

    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'startsWith':
        return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
      case 'endsWith':
        return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
      case 'greaterThan':
        return Number(value) > Number(filter.value);
      case 'lessThan':
        return Number(value) < Number(filter.value);
      case 'between':
        return Number(value) >= filter.value[0] && Number(value) <= filter.value[1];
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'regex':
        return new RegExp(filter.value).test(String(value));
      default:
        return true;
    }
  }

  private getFilterValue(result: SearchResult, field: FilterField): unknown {
    const { entity, node } = result;

    switch (field) {
      case 'name':
        return entity.name;
      case 'type':
        return entity.type;
      case 'domain':
        return node.metadata.domain;
      case 'filePath':
        return entity.filePath;
      case 'complexity':
        return node.metadata.complexity;
      case 'importance':
        return node.metadata.importance;
      case 'lastAccessed':
        return node.metadata.lastAccessed;
      case 'accessCount':
        return node.metadata.accessCount;
      default:
        return undefined;
    }
  }

  // ========== Result Enhancement ==========

  private async enrichResults(
    results: SearchResult[],
    options?: Partial<SearchOptions>,
  ): Promise<SearchResult[]> {
    const opts = this.getDefaultOptions(options);

    return results.map((result) => {
      const enriched = { ...result };

      // Add related nodes if requested
      if (opts.includeRelated) {
        enriched.relatedNodes = this.graph
          .getNeighbors(result.entity.id, {
            maxDepth: 1,
            relationshipTypes: [],
            weightThreshold: 0.3,
            includeBackward: true,
            sortBy: 'relevance',
          })
          .slice(0, 5);
      }

      return enriched;
    });
  }

  // ========== Utility Methods ==========

  private createSearchResult(node: GraphNode, expansion: QueryExpansion): SearchResult {
    return {
      entity: node.entity,
      node,
      relevance: 0.5, // Will be calculated during ranking
      matches: this.findMatches(node.entity, expansion.originalTerms),
      context: {
        queryTerms: expansion.originalTerms,
        expandedTerms: expansion.expandedTerms,
        searchPath: [],
        relatedConcepts: node.metadata.tags,
        domainContext: [node.metadata.domain],
      },
    };
  }

  private findMatches(entity: CodeEntity | ConceptEntity, queryTerms: string[]): SearchMatch[] {
    const matches: SearchMatch[] = [];

    for (const term of queryTerms) {
      const termLower = term.toLowerCase();

      // Name matches
      const nameIndex = entity.name.toLowerCase().indexOf(termLower);
      if (nameIndex >= 0) {
        matches.push({
          field: 'name',
          text: entity.name,
          highlight: this.highlightTerm(entity.name, term, nameIndex),
          position: nameIndex,
          score: 1.0,
        });
      }

      // Documentation matches
      if (entity.documentation) {
        const docIndex = entity.documentation.toLowerCase().indexOf(termLower);
        if (docIndex >= 0) {
          matches.push({
            field: 'documentation',
            text: entity.documentation,
            highlight: this.highlightTerm(entity.documentation, term, docIndex),
            position: docIndex,
            score: 0.7,
          });
        }
      }

      // File path matches
      const pathIndex = entity.filePath.toLowerCase().indexOf(termLower);
      if (pathIndex >= 0) {
        matches.push({
          field: 'filePath',
          text: entity.filePath,
          highlight: this.highlightTerm(entity.filePath, term, pathIndex),
          position: pathIndex,
          score: 0.5,
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  private highlightTerm(text: string, term: string, position: number): string {
    const before = text.substring(Math.max(0, position - 20), position);
    const highlighted = `**${text.substring(position, position + term.length)}**`;
    const after = text.substring(
      position + term.length,
      Math.min(text.length, position + term.length + 20),
    );

    return `${before}${highlighted}${after}`;
  }

  private createQueryVector(terms: string[]): number[] {
    const allTerms = Array.from(this.termIndex.keys());
    const vector = allTerms.map((term) => (terms.includes(term) ? 1 : 0));

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map((val) => val / magnitude) : vector;
  }

  private calculateVectorSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) return 0;

    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  private calculatePathMatch(queryPath: string[], entityPath: string[]): number {
    let matches = 0;
    const maxLength = Math.max(queryPath.length, entityPath.length);

    for (let i = 0; i < Math.min(queryPath.length, entityPath.length); i++) {
      if (queryPath[i] === entityPath[i]) {
        matches++;
      }
    }

    return matches / maxLength;
  }

  private mergeAndDeduplicateResults(results: SearchResult[]): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    for (const result of results) {
      const existing = merged.get(result.entity.id);
      if (!existing || result.relevance > existing.relevance) {
        merged.set(result.entity.id, result);
      }
    }

    return Array.from(merged.values());
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      if (seen.has(result.entity.id)) {
        return false;
      }
      seen.add(result.entity.id);
      return true;
    });
  }

  private findDomainTerms(domain: string): string[] {
    const terms: string[] = [];

    for (const [nodeId, node] of this.graph.getAllNodes()) {
      if (node.metadata.domain === domain) {
        terms.push(...this.tokenizeQuery(node.entity.name));
        terms.push(...node.metadata.tags);
      }
    }

    return [...new Set(terms)];
  }

  private getDefaultOptions(options?: Partial<SearchOptions>): SearchOptions {
    return {
      maxResults: 50,
      minRelevance: 0.1,
      includeRelated: false,
      searchDepth: 2,
      rankingMode: 'hybrid',
      highlightMatches: true,
      fuzzySearch: false,
      semanticExpansion: true,
      ...options,
    };
  }

  private createCacheKey(query: SearchQuery): string {
    return JSON.stringify(query);
  }

  // ========== Indexing ==========

  private buildInitialIndexes(): void {
    for (const [nodeId, node] of this.graph.getAllNodes()) {
      this.indexNode(node);
    }
  }

  private indexNode(node: GraphNode): void {
    const entity = node.entity;
    const terms = [
      ...this.tokenizeQuery(entity.name),
      ...this.tokenizeQuery(entity.documentation || ''),
      ...this.tokenizeQuery(entity.filePath),
      ...node.metadata.tags,
    ];

    // Build term index
    for (const term of terms) {
      const termLower = term.toLowerCase();
      if (!this.termIndex.has(termLower)) {
        this.termIndex.set(termLower, new Set());
      }
      this.termIndex.get(termLower)!.add(entity.id);
    }

    // Build concept index
    if ('conceptType' in entity) {
      const conceptTerms = [
        entity.name,
        entity.domain,
        ...entity.relatedEntities,
        ...entity.businessRules,
      ];

      for (const term of conceptTerms) {
        const termLower = term.toLowerCase();
        if (!this.conceptIndex.has(termLower)) {
          this.conceptIndex.set(termLower, new Set());
        }
        this.conceptIndex.get(termLower)!.add(entity.id);
      }
    }

    // Build vector index
    const vector = this.createEntityVector(entity, terms);
    this.vectorIndex.set(entity.id, {
      entityId: entity.id,
      vector,
      terms: [...new Set(terms)],
      weights: vector,
      metadata: {
        created: new Date(),
        lastUpdated: new Date(),
        version: 1,
        size: vector.length,
        checksum: this.calculateChecksum(vector),
      },
    });
  }

  private createEntityVector(entity: CodeEntity | ConceptEntity, terms: string[]): number[] {
    const allTerms = Array.from(this.termIndex.keys());
    const termCounts = new Map<string, number>();

    // Count term frequencies
    for (const term of terms) {
      const count = termCounts.get(term.toLowerCase()) || 0;
      termCounts.set(term.toLowerCase(), count + 1);
    }

    // Create TF-IDF vector
    const vector = allTerms.map((term) => {
      const tf = (termCounts.get(term) || 0) / terms.length;
      const df = this.termIndex.get(term)?.size || 1;
      const idf = Math.log(this.graph.getAllNodes().size / df);
      return tf * idf;
    });

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map((val) => val / magnitude) : vector;
  }

  private calculateChecksum(vector: number[]): string {
    return vector.reduce((checksum, val) => checksum + val.toString(), '').substring(0, 8);
  }

  private setupGraphListeners(): void {
    this.graph.on('nodeAdded', (node: GraphNode) => {
      this.indexNode(node);
      this.clearSearchCache();
    });

    this.graph.on('nodeRemoved', ({ nodeId }: { nodeId: string }) => {
      this.removeFromIndexes(nodeId);
      this.clearSearchCache();
    });

    this.graph.on('nodeUpdated', (node: GraphNode) => {
      this.removeFromIndexes(node.id);
      this.indexNode(node);
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

    // Remove from vector index
    this.vectorIndex.delete(nodeId);
  }

  private clearSearchCache(): void {
    this.searchCache.clear();
  }

  // ========== Statistics ==========

  private updateStatistics(responseTime: number, cacheHit: boolean): void {
    this.statistics.totalQueries++;

    // Update average response time
    const totalTime =
      this.statistics.averageResponseTime * (this.statistics.totalQueries - 1) + responseTime;
    this.statistics.averageResponseTime = totalTime / this.statistics.totalQueries;

    // Update cache hit rate
    if (cacheHit) {
      const totalHits = this.statistics.cacheHitRate * (this.statistics.totalQueries - 1) + 1;
      this.statistics.cacheHitRate = totalHits / this.statistics.totalQueries;
    } else {
      const totalHits = this.statistics.cacheHitRate * (this.statistics.totalQueries - 1);
      this.statistics.cacheHitRate = totalHits / this.statistics.totalQueries;
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
    const synonyms = new Map<string, string[]>();

    // Programming synonyms
    synonyms.set('function', ['method', 'procedure', 'routine']);
    synonyms.set('class', ['type', 'object', 'entity']);
    synonyms.set('interface', ['contract', 'protocol', 'api']);
    synonyms.set('service', ['provider', 'manager', 'handler']);
    synonyms.set('component', ['element', 'widget', 'module']);

    return synonyms;
  }

  private initializeStopWords(): Set<string> {
    return new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
      'it',
      'its',
      'he',
      'she',
      'they',
      'them',
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

  addSynonym(term: string, synonyms: string[]): void {
    this.synonyms.set(
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
