/**
 * MARIA Memory System - Phase 3: Knowledge Graph Engine
 *
 * Advanced knowledge representation with entity extraction,
 * relationship analysis, and semantic search capabilities
 */

import { EventEmitter } from "node:events";
import {
  ConceptCluster,
  ConceptEdge,
  ConceptGraph,
  KnowledgeNode,
  _MemoryEvent,
  NodeMetadata,
} from "../types/memory-interfaces";

export interface EntityExtractionResult {
  entities: Entity[];
  relationships: Relationship[];
  confidence: number;
}

export interface Entity {
  id: string;
  _text: string;
  type: EntityType;
  position: { start: number; end: number };
  attributes: Map<string, unknown>;
  _embedding?: number[];
}

export type EntityType =
  | "code_function"
  | "code_class"
  | "code_variable"
  | "technical_concept"
  | "business_logic"
  | "user_preference"
  | "team_pattern";

export interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  confidence: number;
  bidirectional: boolean;
  metadata?: Record<string, unknown>;
}

export type RelationshipType =
  | "implements"
  | "extends"
  | "uses"
  | "depends_on"
  | "similar_to"
  | "contradicts"
  | "improves"
  | "replaces";

export interface SemanticSearchOptions {
  query: string;
  topK?: number;
  minSimilarity?: number;
  filters?: SearchFilter[];
  includeRelationships?: boolean;
}

export interface SearchFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "contains" | "in";
  _value: unknown;
}

export interface SearchResult {
  node: KnowledgeNode;
  _similarity: number;
  path?: KnowledgeNode[];
  relationships?: Relationship[];
}

export class KnowledgeGraphEngine extends EventEmitter {
  private graph: ConceptGraph;
  private entityIndex: Map<string, Entity>;
  private relationshipIndex: Map<string, Relationship>;
  private embeddingCache: Map<string, number[]>;
  private clusteringThreshold = 0.7;

  constructor() {
    super();
    this.graph = {
      _nodes: new Map(),
      _edges: new Map(),
      clusters: [],
    };
    this.entityIndex = new Map();
    this.relationshipIndex = new Map();
    this.embeddingCache = new Map();
  }

  /**
   * Add entity to the knowledge graph
   */
  addEntity(entity: Entity): void {
    this.entityIndex.set(entity.id, entity);

    // Create corresponding knowledge node
    const node: KnowledgeNode = {
      id: entity.id,
      type: this.mapEntityTypeToNodeType(entity.type),
      name: entity.text,
      content: entity.text,
      _embedding: entity.embedding || [],
      confidence: 0.8,
      lastAccessed: new Date(),
      accessCount: 1,
      metadata: {
        complexity: "medium",
        quality: 0.8,
        relevance: 0.8,
      },
    };

    this.graph.nodes.set(entity.id, node);
  }

  /**
   * Add relationship to the knowledge graph
   */
  addRelationship(relationship: Relationship): void {
    this.relationshipIndex.set(relationship.id, relationship);

    // Create corresponding concept edge
    const edge: ConceptEdge = {
      id: relationship.id,
      sourceId: relationship.sourceEntityId,
      targetId: relationship.targetEntityId,
      type: this.mapRelationshipTypeToEdgeType(relationship.type),
      weight: relationship.confidence,
      confidence: relationship.confidence,
    };

    this.graph.edges.set(relationship.id, edge);
  }

  private mapEntityTypeToNodeType(
    entityType: EntityType,
  ): "function" | "class" | "module" | "concept" | "pattern" {
    switch (entityType) {
      case "code_function":
        return "function";
      case "code_class":
        return "class";
      case "code_variable":
        return "module";
      case "technical_concept":
        return "concept";
      case "business_logic":
        return "pattern";
      case "user_preference":
        return "concept";
      case "team_pattern":
        return "pattern";
      default:
        return "concept";
    }
  }

  private mapRelationshipTypeToEdgeType(
    relType: RelationshipType,
  ): "depends_on" | "implements" | "uses" | "similar_to" | "extends" {
    switch (relType) {
      case "implements":
        return "implements";
      case "extends":
        return "extends";
      case "uses":
        return "uses";
      case "depends_on":
        return "depends_on";
      case "similar_to":
        return "similar_to";
      default:
        return "uses";
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract entities and relationships from _text
   */
  async extractEntities(
    _text: string,
    _context?: Record<string, unknown>,
  ): Promise<EntityExtractionResult> {
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];

    // Pattern-based extraction for code entities
    const _functionPattern =
      /(?:function|const|let|var)\s+(\w+)\s*=?\s*(?:\([^)]*\)|async)/g;
    const _classPattern = /class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
    const _importPattern =
      /import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g;

    // Extract functions
    let match;
    while ((match = _functionPattern.exec(_text)) !== null) {
      const entity: Entity = {
        id: this.generateId("entity"),
        _text: match[1],
        type: "code_function",
        position: { start: match.index, end: match.index + match[0].length },
        attributes: new Map([["source", "pattern_extraction"]]),
      };
      entities.push(entity);
    }

    // Extract classes and inheritance relationships
    while ((match = _classPattern.exec(_text)) !== null) {
      const classEntity: Entity = {
        id: this.generateId("entity"),
        _text: match[1],
        type: "code_class",
        position: { start: match.index, end: match.index + match[0].length },
        attributes: new Map([["source", "pattern_extraction"]]),
      };
      entities.push(classEntity);

      if (match[2]) {
        // Create inheritance relationship
        const _parentEntity = entities.find((e) => e.text === match[2]) || {
          id: this.generateId("entity"),
          _text: match[2],
          type: "code_class",
          position: { start: 0, end: 0 },
          attributes: new Map([["source", "inferred"]]),
        };

        if (!entities.find((e) => e.text === match[2])) {
          entities.push(_parentEntity as Entity);
        }

        relationships.push({
          id: this.generateId("_rel"),
          sourceEntityId: classEntity.id,
          targetEntityId: _parentEntity.id,
          type: "extends",
          confidence: 0.95,
          bidirectional: false,
        });
      }
    }

    // Extract import dependencies
    while ((match = _importPattern.exec(_text)) !== null) {
      const moduleEntity: Entity = {
        id: this.generateId("entity"),
        _text: match[1],
        type: "technical_concept",
        position: { start: match.index, end: match.index + match[0].length },
        attributes: new Map([
          ["type", "module"],
          ["source", "import"],
        ]),
      };
      entities.push(moduleEntity);
    }

    // Calculate embeddings for entities
    for (const entity of entities) {
      entity.embedding = await this.generateEmbedding(entity.text);
    }

    // Detect _similarity relationships based on embeddings
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const _similarity = this.cosineSimilarity(
          entities[i].embedding!,
          entities[j].embedding!,
        );

        if (_similarity > 0.8 && entities[i].type === entities[j].type) {
          relationships.push({
            id: this.generateId("_rel"),
            sourceEntityId: entities[i].id,
            targetEntityId: entities[j].id,
            type: "similar_to",
            confidence: _similarity,
            bidirectional: true,
            metadata: { _similarity },
          });
        }
      }
    }

    return {
      entities,
      relationships,
      confidence: this.calculateExtractionConfidence(entities, relationships),
    };
  }

  /**
   * Add extracted entities to the knowledge graph
   */
  async addToGraph(extraction: EntityExtractionResult): Promise<void> {
    for (const entity of extraction.entities) {
      // Store entity in index
      this.entityIndex.set(entity.id, entity);

      // Create knowledge node
      const node: KnowledgeNode = {
        id: entity.id,
        type: this.mapEntityTypeToNodeType(entity.type),
        name: entity.text,
        content: entity.text,
        _embedding: entity.embedding || [],
        confidence: extraction.confidence,
        lastAccessed: new Date(),
        accessCount: 1,
        metadata: {
          complexity: this.assessComplexity(entity),
          quality: extraction.confidence,
          relevance: 1.0,
        },
      };

      this.graph.nodes.set(node.id, node);
    }

    for (const relationship of extraction.relationships) {
      // Store relationship in index
      this.relationshipIndex.set(relationship.id, relationship);

      // Create graph edge
      const edge: ConceptEdge = {
        id: relationship.id,
        sourceId: relationship.sourceEntityId,
        targetId: relationship.targetEntityId,
        type: relationship.type as any,
        weight: relationship.confidence,
        confidence: relationship.confidence,
      };

      this.graph.edges.set(edge.id, edge);
    }

    // Update clusters
    await this.updateClusters();

    // Emit graph update event
    this.emit("graphUpdated", {
      nodesAdded: extraction.entities.length,
      edgesAdded: extraction.relationships.length,
      totalNodes: this.graph.nodes.size,
      totalEdges: this.graph.edges.size,
    });
  }

  /**
   * Semantic search in the knowledge graph
   */
  async search(options: SemanticSearchOptions): Promise<SearchResult[]> {
    const _queryEmbedding = await this.generateEmbedding(options.query);
    const results: SearchResult[] = [];

    // Calculate _similarity for all _nodes
    for (const [nodeId, node] of this.graph.nodes) {
      if (!node.embedding || node.embedding.length === 0) {
        continue;
      }

      const _similarity = this.cosineSimilarity(
        _queryEmbedding,
        node.embedding,
      );

      if (_similarity >= (options.minSimilarity || 0.5)) {
        // Apply filters
        if (options.filters && !this.passesFilters(node, options.filters)) {
          continue;
        }

        const result: SearchResult = {
          node,
          _similarity,
        };

        // Include relationships if requested
        if (options.includeRelationships) {
          result.relationships = this.getNodeRelationships(nodeId);
        }

        results.push(result);
      }
    }

    // Sort by _similarity and limit results
    results.sort((a, b) => b._similarity - a._similarity);

    return results.slice(0, options.topK || 10);
  }

  /**
   * Find shortest path between two _nodes
   */
  findPath(_sourceId: string, targetId: string): KnowledgeNode[] | null {
    const _visited = new Set<string>();
    const queue: { nodeId: string; _path: string[] }[] = [
      { nodeId: _sourceId, _path: [_sourceId] },
    ];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === targetId) {
        return path.map((id) => this.graph.nodes.get(id)!);
      }

      if (_visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);

      // Get connected _nodes
      for (const [, edge] of this.graph.edges) {
        let nextNodeId: string | null = null;

        if (edge._sourceId === nodeId) {
          nextNodeId = edge.targetId;
        } else if (edge.targetId === nodeId && this.isBidirectional(edge)) {
          nextNodeId = edge._sourceId;
        }

        if (nextNodeId && !_visited.has(nextNodeId)) {
          queue.push({
            nodeId: nextNodeId,
            _path: [..._path, nextNodeId],
          });
        }
      }
    }

    return null;
  }

  /**
   * Get graph statistics
   */
  getStatistics() {
    const _nodeTypes = new Map<string, number>();
    const _edgeTypes = new Map<string, number>();

    for (const node of this.graph.nodes.values()) {
      _nodeTypes.set(node.type, (_nodeTypes.get(node.type) || 0) + 1);
    }

    for (const edge of this.graph.edges.values()) {
      _edgeTypes.set(edge.type, (_edgeTypes.get(edge.type) || 0) + 1);
    }

    return {
      totalNodes: this.graph.nodes.size,
      totalEdges: this.graph.edges.size,
      totalClusters: this.graph.clusters.length,
      _nodeTypes: Object.fromEntries(_nodeTypes),
      _edgeTypes: Object.fromEntries(_edgeTypes),
      averageDegree: this.calculateAverageDegree(),
      density: this.calculateGraphDensity(),
    };
  }

  /**
   * Export graph for visualization
   */
  exportForVisualization() {
    const _nodes = Array.from(this.graph._nodes.values()).map((node) => ({
      id: node.id,
      label: node.name,
      type: node.type,
      size: Math.log(node.accessCount + 1) * 10,
      color: this.getNodeColor(node.type),
    }));

    const _edges = Array.from(this.graph._edges.values()).map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: edge.type,
      weight: edge.weight,
      color: this.getEdgeColor(edge.type),
    }));

    return { _nodes, _edges, clusters: this.graph.clusters };
  }

  // Private helper methods
  private async generateEmbedding(_text: string): Promise<number[]> {
    // Check cache first
    if (this.embeddingCache.has(_text)) {
      return this.embeddingCache.get(_text)!;
    }

    // Simple _embedding generation (in production, use actual _embedding model)
    const _embedding = new Array(384).fill(0).map(() => Math.random());
    this.embeddingCache.set(_text, _embedding);

    return _embedding;
  }

  private cosineSimilarity(_a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < _a.length; i++) {
      dotProduct += _a[i] * b[i];
      normA += _a[i] * _a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async updateClusters(): Promise<void> {
    // Simple clustering based on embeddings
    const _nodes = Array.from(this.graph._nodes.values());
    const clusters: ConceptCluster[] = [];
    const _assigned = new Set<string>();

    for (const node of _nodes) {
      if (_assigned.has(node.id)) {
        continue;
      }

      const cluster: ConceptCluster = {
        id: this.generateId("cluster"),
        name: `Cluster_${node.name}`,
        nodeIds: [node.id],
        centroid: [...node.embedding],
        coherence: 1.0,
      };

      // Find similar _nodes
      for (const otherNode of _nodes) {
        if (otherNode.id === node.id || _assigned.has(otherNode.id)) {
          continue;
        }

        const _similarity = this.cosineSimilarity(
          node.embedding,
          otherNode.embedding,
        );
        if (_similarity > this.clusteringThreshold) {
          cluster.nodeIds.push(otherNode.id);
          assigned.add(otherNode.id);
        }
      }

      assigned.add(node.id);
      clusters.push(cluster);
    }

    this.graph.clusters = clusters;
  }

  private assessComplexity(entity: Entity): "low" | "medium" | "high" {
    const _text = entity._text;
    if (_text.length < 20) {
      return "low";
    }
    if (_text.length < 50) {
      return "medium";
    }
    return "high";
  }

  private calculateExtractionConfidence(
    _entities: Entity[],
    relationships: Relationship[],
  ): number {
    if (_entities.length === 0) {
      return 0;
    }

    const _avgRelationshipConfidence =
      relationships.length > 0
        ? relationships.reduce((sum, r) => sum + r.confidence, 0) /
          relationships.length
        : 0.5;

    return Math.min(
      0.95,
      0.5 + _entities.length * 0.05 + _avgRelationshipConfidence * 0.3,
    );
  }

  private passesFilters(
    _node: KnowledgeNode,
    filters: SearchFilter[],
  ): boolean {
    for (const filter of filters) {
      const _value =
        (_node as any)[filter.field] ||
        _node.metadata[filter.field as keyof NodeMetadata];

      switch (filter.operator) {
        case "eq":
          if (_value !== filter._value) {
            return false;
          }
          break;
        case "neq":
          if (_value === filter._value) {
            return false;
          }
          break;
        case "gt":
          if (_value <= filter._value) {
            return false;
          }
          break;
        case "lt":
          if (_value >= filter._value) {
            return false;
          }
          break;
        case "contains":
          if (!String(_value).includes(String(filter._value))) {
            return false;
          }
          break;
        case "in":
          if (
            !Array.isArray(filter._value) ||
            !filter._value.includes(_value)
          ) {
            return false;
          }
          break;
      }
    }

    return true;
  }

  private getNodeRelationships(nodeId: string): Relationship[] {
    const relationships: Relationship[] = [];

    for (const _rel of this.relationshipIndex.values()) {
      if (_rel.sourceEntityId === nodeId || _rel.targetEntityId === nodeId) {
        relationships.push(_rel);
      }
    }

    return relationships;
  }

  private isBidirectional(edge: ConceptEdge): boolean {
    const _rel = this.relationshipIndex.get(edge.id);
    return _rel?.bidirectional || false;
  }

  private calculateAverageDegree(): number {
    if (this.graph.nodes.size === 0) {
      return 0;
    }

    let totalDegree = 0;
    for (const nodeId of this.graph.nodes.keys()) {
      let degree = 0;
      for (const edge of this.graph.edges.values()) {
        if (edge.sourceId === nodeId || edge.targetId === nodeId) {
          degree++;
        }
      }
      totalDegree += degree;
    }

    return totalDegree / this.graph.nodes.size;
  }

  private calculateGraphDensity(): number {
    const n = this.graph.nodes.size;
    if (n < 2) {
      return 0;
    }

    const _maxEdges = (n * (n - 1)) / 2;
    return this.graph.edges.size / _maxEdges;
  }

  private getNodeColor(type: string): string {
    const colors: Record<string, string> = {
      function: "#4CAF50",
      class: "#2196F3",
      module: "#FF9800",
      concept: "#9C27B0",
      pattern: "#00BCD4",
    };
    return colors[type] || "#757575";
  }

  private getEdgeColor(type: string): string {
    const colors: Record<string, string> = {
      implements: "#4CAF50",
      extends: "#2196F3",
      uses: "#FF9800",
      dependson: "#F44336",
      similarto: "#9C27B0",
    };
    return colors[type] || "#9E9E9E";
  }
}
