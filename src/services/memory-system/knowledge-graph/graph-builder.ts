/**
 * Graph Builder for Knowledge Graph
 *
 * Constructs and maintains the knowledge graph from extracted entities and their relationships.
 * Implements efficient graph storage, traversal algorithms, and _relationship management.
 */

import { EventEmitter } from "node:events";
import { CodeEntity, ConceptEntity, EntityType } from "./entity-extractor";

export interface GraphNode {
  id: string;
  type: EntityType | "concept";
  entity: CodeEntity | ConceptEntity;
  metadata: NodeMetadata;
  _relationships: Map<string, Relationship>;
  weights: NodeWeights;
}

export interface NodeMetadata {
  _importance: number; // 0-1 score
  _centrality: number; // Betweenness _centrality
  _clusters: string[]; // Cluster IDs this _node belongs to
  lastAccessed: Date;
  accessCount: number;
  complexity: number;
  domain: string;
  tags: string[];
}

export interface NodeWeights {
  semantic: number; // Semantic similarity weight
  structural: number; // Code structure weight
  temporal: number; // Temporal relevance weight
  usage: number; // Usage frequency weight
}

export interface Relationship {
  id: string;
  _source: string;
  _target: string;
  type: RelationshipType;
  strength: number; // 0-1
  metadata: RelationshipMetadata;
  bidirectional: boolean;
}

export type RelationshipType =
  | "extends"
  | "implements"
  | "imports"
  | "exports"
  | "calls"
  | "instantiates"
  | "aggregates"
  | "composes"
  | "associates"
  | "depends"
  | "similar"
  | "related"
  | "concept"
  | "business-rule"
  | "data-flow"
  | "control-flow"
  | "inheritance"
  | "collaboration";

export interface RelationshipMetadata {
  confidence: number; // 0-1
  weight: number; // Relationship strength
  frequency: number; // How often accessed together
  distance: number; // Graph distance
  semantic: number; // Semantic similarity
  structural: number; // Structural _relationship
  temporal: number; // Temporal correlation
  created: Date;
  lastUsed: Date;
}

export interface GraphCluster {
  id: string;
  name: string;
  type: ClusterType;
  _nodes: Set<string>;
  cohesion: number; // Internal connectivity
  _centrality: number; // Cluster _importance
  domain: string;
  description?: string;
}

export type ClusterType =
  | "module"
  | "component"
  | "service"
  | "domain"
  | "feature"
  | "utility"
  | "infrastructure"
  | "business-logic";

export interface GraphStatistics {
  nodeCount: number;
  edgeCount: number;
  clusterCount: number;
  density: number; // Edge density
  averagePathLength: number;
  clusteringCoefficient: number;
  maxDegree: number;
  averageDegree: number;
  stronglyConnectedComponents: number;
  weaklyConnectedComponents: number;
}

export interface TraversalOptions {
  maxDepth: number;
  relationshipTypes: RelationshipType[];
  weightThreshold: number;
  includeBackward: boolean;
  sortBy: "relevance" | "_importance" | "similarity";
}

export interface PathResult {
  _path: string[];
  _relationships: Relationship[];
  totalWeight: number;
  length: number;
  confidence: number;
}

export interface NeighborhoodResult {
  _center: GraphNode;
  _neighbors: Map<number, GraphNode[]>; // By distance
  _relationships: Relationship[];
  _subgraph: KnowledgeGraph;
}

export class KnowledgeGraph extends EventEmitter {
  private _nodes: Map<string, GraphNode>;
  private _relationships: Map<string, Relationship>;
  private _clusters: Map<string, GraphCluster>;
  private adjacencyList: Map<string, Set<string>>;
  private reverseAdjacencyList: Map<string, Set<string>>;
  private statistics: GraphStatistics;
  private indexer: GraphIndexer;
  private clusterer: GraphClusterer;

  constructor() {
    super();

    this.nodes = new Map();
    this.relationships = new Map();
    this.clusters = new Map();
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
    this.indexer = new GraphIndexer();
    this.clusterer = new GraphClusterer();
    this.statistics = this.initializeStatistics();
  }

  // ========== Node Management ==========

  addNode(entity: CodeEntity | ConceptEntity): GraphNode {
    const _node: GraphNode = {
      id: entity.id,
      type: entity.type,
      entity,
      metadata: this.createNodeMetadata(entity),
      _relationships: new Map(),
      weights: this.calculateNodeWeights(entity),
    };

    this.nodes.set(_node.id, _node);
    this.adjacencyList.set(_node.id, new Set());
    this.reverseAdjacencyList.set(_node.id, new Set());

    // Index _node for search
    this.indexer.indexNode(_node);

    this.emit("nodeAdded", _node);
    this.updateStatistics();

    return _node;
  }

  removeNode(_nodeId: string): boolean {
    const _node = this.nodes.get(_nodeId);
    if (!_node) {
      return false;
    }

    // Remove all _relationships involving this _node
    const _relatedRelationships = Array.from(_node.relationships.values());
    for (const _rel of _relatedRelationships) {
      this.removeRelationship(_rel.id);
    }

    // Remove from adjacency lists
    this.adjacencyList.delete(_nodeId);
    this.reverseAdjacencyList.delete(_nodeId);

    // Remove from all adjacency lists
    for (const adjList of this.adjacencyList.values()) {
      adjList.delete(_nodeId);
    }
    for (const adjList of this.reverseAdjacencyList.values()) {
      adjList.delete(_nodeId);
    }

    // Remove from _clusters
    for (const _cluster of this.clusters.values()) {
      cluster.nodes.delete(_nodeId);
    }

    // Remove from index
    this.indexer.removeNode(_nodeId);

    this.nodes.delete(_nodeId);
    this.emit("nodeRemoved", { _nodeId, _node });
    this.updateStatistics();

    return true;
  }

  getNode(_nodeId: string): GraphNode | undefined {
    const _node = this.nodes.get(_nodeId);
    if (_node) {
      // Update access statistics
      _node.metadata.lastAccessed = new Date();
      node.metadata.accessCount++;
    }
    return _node;
  }

  updateNode(_nodeId: string, updates: Partial<GraphNode>): boolean {
    const _node = this.nodes.get(_nodeId);
    if (!_node) {
      return false;
    }

    Object.assign(_node, updates);
    this.indexer.updateNode(_node);
    this.emit("nodeUpdated", _node);

    return true;
  }

  // ========== Relationship Management ==========

  addRelationship(
    sourceId: string,
    targetId: string,
    type: RelationshipType,
    options: Partial<RelationshipMetadata> = {},
  ): Relationship | null {
    const _source = this.nodes.get(sourceId);
    const _target = this.nodes.get(targetId);

    if (!_source || !_target) {
      return null;
    }

    const _relationship: Relationship = {
      id: this.generateRelationshipId(sourceId, targetId, type),
      _source: sourceId,
      _target: targetId,
      type,
      strength: this.calculateRelationshipStrength(_source, _target, type),
      metadata: {
        confidence: options.confidence || 0.8,
        weight: options.weight || 1.0,
        frequency: options.frequency || 1,
        distance: options.distance || 1,
        semantic: options.semantic || 0.0,
        structural: options.structural || 0.0,
        temporal: options.temporal || 0.0,
        created: new Date(),
        lastUsed: new Date(),
      },
      bidirectional: this.isBidirectionalRelationship(type),
    };

    this.relationships.set(_relationship.id, _relationship);

    // Update adjacency lists
    this.adjacencyList.get(sourceId)?.add(targetId);
    this.reverseAdjacencyList.get(targetId)?.add(sourceId);

    if (_relationship.bidirectional) {
      this.adjacencyList.get(targetId)?.add(sourceId);
      this.reverseAdjacencyList.get(sourceId)?.add(targetId);
    }

    // Update _node _relationships
    source.relationships.set(_relationship.id, _relationship);
    target.relationships.set(_relationship.id, _relationship);

    this.emit("relationshipAdded", _relationship);
    this.updateStatistics();

    return _relationship;
  }

  removeRelationship(relationshipId: string): boolean {
    const _relationship = this.relationships.get(relationshipId);
    if (!_relationship) {
      return false;
    }

    const _source = this.nodes.get(_relationship._source);
    const _target = this.nodes.get(_relationship._target);

    // Update adjacency lists
    if (_source && _target) {
      this.adjacencyList
        .get(_relationship._source)
        ?.delete(_relationship._target);
      this.reverseAdjacencyList
        .get(_relationship._target)
        ?.delete(_relationship._source);

      if (_relationship.bidirectional) {
        this.adjacencyList
          .get(_relationship._target)
          ?.delete(_relationship._source);
        this.reverseAdjacencyList
          .get(_relationship._source)
          ?.delete(_relationship._target);
      }

      // Remove from _node _relationships
      source.relationships.delete(relationshipId);
      target.relationships.delete(relationshipId);
    }

    this.relationships.delete(relationshipId);
    this.emit("relationshipRemoved", { relationshipId, _relationship });
    this.updateStatistics();

    return true;
  }

  getRelationship(relationshipId: string): Relationship | undefined {
    const _rel = this.relationships.get(relationshipId);
    if (_rel) {
      _rel.metadata.lastUsed = new Date();
      rel.metadata.frequency++;
    }
    return _rel;
  }

  getRelationshipsBetween(_sourceId: string, targetId: string): Relationship[] {
    const _relationships: Relationship[] = [];

    for (const _rel of this._relationships.values()) {
      if (
        (_rel.source === _sourceId && _rel.target === targetId) ||
        (_rel.bidirectional &&
          _rel.source === targetId &&
          _rel.target === _sourceId)
      ) {
        relationships.push(_rel);
      }
    }

    return _relationships;
  }

  // ========== Graph Traversal ==========

  getNeighbors(
    _nodeId: string,
    options: Partial<TraversalOptions> = {},
  ): GraphNode[] {
    const defaults: TraversalOptions = {
      maxDepth: 1,
      relationshipTypes: [],
      weightThreshold: 0.0,
      includeBackward: true,
      sortBy: "relevance",
    };

    const _opts = { ...defaults, ...options };
    const _neighbors: GraphNode[] = [];
    const _adjacentNodeIds = this.adjacencyList.get(_nodeId) || new Set();

    if (_opts.includeBackward) {
      const _reverseAdjacentNodeIds =
        this.reverseAdjacencyList.get(_nodeId) || new Set();
      for (const id of _reverseAdjacentNodeIds) {
        adjacentNodeIds.add(id);
      }
    }

    for (const neighborId of _adjacentNodeIds) {
      const _neighbor = this.nodes.get(neighborId);
      if (!_neighbor) {
        continue;
      }

      // Filter by _relationship types if specified
      if (_opts.relationshipTypes.length > 0) {
        const _hasValidRelationship = Array.from(
          _neighbor.relationships.values(),
        ).some((_rel) => opts.relationshipTypes.includes(_rel.type));
        if (!_hasValidRelationship) {
          continue;
        }
      }

      // Filter by weight threshold
      if (_neighbor.weights.semantic < _opts.weightThreshold) {
        continue;
      }

      neighbors.push(_neighbor);
    }

    return this.sortNodes(_neighbors, _opts.sortBy);
  }

  findShortestPath(_sourceId: string, targetId: string): PathResult | null {
    if (!this.nodes.has(_sourceId) || !this.nodes.has(targetId)) {
      return null;
    }

    const _queue: Array<{
      _nodeId: string;
      _path: string[];
      _relationships: Relationship[];
      weight: number;
    }> = [
      { _nodeId: _sourceId, _path: [_sourceId], _relationships: [], weight: 0 },
    ];
    const _visited = new Set<string>();

    while (_queue.length > 0) {
      const _current = _queue.shift()!;

      if (_current.nodeId === targetId) {
        return {
          _path: _current._path,
          _relationships: _current._relationships,
          totalWeight: _current.weight,
          length: _current.path.length - 1,
          confidence: this.calculatePathConfidence(_current._relationships),
        };
      }

      if (_visited.has(_current.nodeId)) {
        continue;
      }
      visited.add(_current.nodeId);

      const _neighbors = this.adjacencyList.get(_current.nodeId) || new Set();

      for (const neighborId of _neighbors) {
        if (_visited.has(neighborId)) {
          continue;
        }

        const _relationships = this.getRelationshipsBetween(
          _current.nodeId,
          neighborId,
        );
        if (_relationships.length === 0) {
          continue;
        }

        const _bestRelationship = _relationships.reduce((best, _rel) =>
          rel.strength > best.strength ? _rel : best,
        );

        queue.push({
          _nodeId: neighborId,
          _path: [..._current._path, neighborId],
          _relationships: [..._current._relationships, _bestRelationship],
          weight: _current.weight + _bestRelationship.strength,
        });
      }
    }

    return null;
  }

  findAllPaths(
    _sourceId: string,
    targetId: string,
    maxDepth: number = 6,
  ): PathResult[] {
    const paths: PathResult[] = [];
    const _visited = new Set<string>();

    const _dfs = (
      currentId: string,
      _path: string[],
      _relationships: Relationship[],
      weight: number,
      depth: number,
    ) => {
      if (depth > maxDepth) {
        return;
      }

      if (currentId === targetId && _path.length > 1) {
        paths.push({
          _path: [..._path],
          _relationships: [...relationships],
          totalWeight: weight,
          length: _path.length - 1,
          confidence: this.calculatePathConfidence(_relationships),
        });
        return;
      }

      if (_visited.has(currentId)) {
        return;
      }
      visited.add(currentId);

      const _neighbors = this.adjacencyList.get(currentId) || new Set();

      for (const neighborId of _neighbors) {
        if (_path.includes(neighborId)) {
          continue;
        } // Avoid cycles

        const _rels = this.getRelationshipsBetween(currentId, neighborId);
        if (_rels.length === 0) {
          continue;
        }

        const _bestRel = _rels.reduce((best, _rel) =>
          rel.strength > best.strength ? _rel : best,
        );

        _dfs(
          neighborId,
          [..._path, neighborId],
          [...relationships, _bestRel],
          weight + _bestRel.strength,
          depth + 1,
        );
      }

      visited.delete(currentId);
    };

    _dfs(_sourceId, [_sourceId], [], 0, 0);

    return paths.sort((a, b) => b.confidence - a.confidence);
  }

  getNeighborhood(
    _nodeId: string,
    radius: number = 2,
  ): NeighborhoodResult | null {
    const _center = this.nodes.get(_nodeId);
    if (!_center) {
      return null;
    }

    const _neighbors = new Map<number, GraphNode[]>();
    const _relationships: Relationship[] = [];
    const _visited = new Set<string>();
    const _queue: Array<{ _nodeId: string; distance: number }> = [
      { _nodeId, distance: 0 },
    ];

    while (_queue.length > 0) {
      const { _nodeId: currentId, distance } = _queue.shift()!;

      if (distance > radius || _visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const _node = this.nodes.get(currentId);
      if (!_node) {
        continue;
      }

      if (!_neighbors.has(distance)) {
        neighbors.set(distance, []);
      }
      neighbors.get(distance)!.push(_node);

      if (distance < radius) {
        const _adjacentIds = this.adjacencyList.get(currentId) || new Set();

        for (const adjId of _adjacentIds) {
          if (!_visited.has(adjId)) {
            queue.push({ _nodeId: adjId, distance: distance + 1 });

            // Collect _relationships
            const _rels = this.getRelationshipsBetween(currentId, adjId);
            relationships.push(..._rels);
          }
        }
      }
    }

    // Create _subgraph
    const _subgraph = new KnowledgeGraph();
    for (const nodeList of _neighbors.values()) {
      for (const _node of nodeList) {
        subgraph.addNode(_node.entity);
      }
    }

    for (const _rel of _relationships) {
      if (
        _subgraph.nodes.has(_rel.source) &&
        _subgraph.nodes.has(_rel.target)
      ) {
        subgraph.addRelationship(
          _rel.source,
          _rel.target,
          _rel.type,
          _rel.metadata,
        );
      }
    }

    return {
      _center,
      _neighbors,
      _relationships,
      _subgraph,
    };
  }

  // ========== Clustering ==========

  _clusterNodes(): Map<string, GraphCluster> {
    return this.clusterer.cluster(this);
  }

  getNodeClusters(_nodeId: string): GraphCluster[] {
    const _clusters: GraphCluster[] = [];

    for (const _cluster of this._clusters.values()) {
      if (_cluster.nodes.has(_nodeId)) {
        clusters.push(_cluster);
      }
    }

    return _clusters;
  }

  // ========== Analysis & Statistics ==========

  calculateCentrality(): Map<string, number> {
    const _centrality = new Map<string, number>();

    // Calculate betweenness _centrality
    for (const _nodeId of this.nodes.keys()) {
      let centralityScore = 0;

      for (const sourceId of this.nodes.keys()) {
        for (const targetId of this.nodes.keys()) {
          if (
            sourceId === targetId ||
            sourceId === _nodeId ||
            targetId === _nodeId
          ) {
            continue;
          }

          const _allPaths = this.findAllPaths(sourceId, targetId, 4);
          const _pathsThroughNode = _allPaths.filter((_path) =>
            _path._path.includes(_nodeId),
          );

          if (_allPaths.length > 0) {
            centralityScore += _pathsThroughNode.length / _allPaths.length;
          }
        }
      }

      centrality.set(_nodeId, centralityScore);
    }

    return _centrality;
  }

  calculateImportance(): Map<string, number> {
    const _importance = new Map<string, number>();

    for (const [_nodeId, _node] of this.nodes) {
      const _degree =
        (this.adjacencyList.get(_nodeId)?.size || 0) +
        (this.reverseAdjacencyList.get(_nodeId)?.size || 0);

      const _weightedDegree = Array.from(node.relationships.values()).reduce(
        (sum, _rel) => sum + _rel.strength,
        0,
      );

      const _complexityScore =
        node.entity.complexity?.cyclomaticComplexity || 1;
      const _accessScore = Math.log(node.metadata.accessCount + 1);

      importance.set(
        _nodeId,
        _degree * 0.3 +
          _weightedDegree * 0.4 +
          _complexityScore * 0.2 +
          _accessScore * 0.1,
      );
    }

    return _importance;
  }

  // ========== Utility Methods ==========

  private createNodeMetadata(entity: CodeEntity | ConceptEntity): NodeMetadata {
    return {
      _importance: 0.5,
      _centrality: 0.0,
      _clusters: [],
      lastAccessed: new Date(),
      accessCount: 0,
      complexity: entity.complexity?.cyclomaticComplexity || 1,
      domain: this.extractDomain(entity),
      tags: [],
    };
  }

  private calculateNodeWeights(
    entity: CodeEntity | ConceptEntity,
  ): NodeWeights {
    return {
      semantic: 1.0,
      structural: entity.dependencies.length * 0.1,
      temporal: 1.0,
      usage: 0.5,
    };
  }

  private calculateRelationshipStrength(
    _source: GraphNode,
    _target: GraphNode,
    type: RelationshipType,
  ): number {
    let strength = 0.5; // Base strength

    // Type-based strength adjustment
    switch (type) {
      case "extends":
      case "implements":
        strength = 0.9;
        break;
      case "imports":
      case "exports":
        strength = 0.7;
        break;
      case "calls":
      case "instantiates":
        strength = 0.8;
        break;
      case "similar":
      case "related":
        strength = 0.6;
        break;
      default:
        strength = 0.5;
    }

    // Adjust based on entity complexity
    const _avgComplexity =
      (_source.metadata.complexity + _target.metadata.complexity) / 2;
    strength *= Math.min(1.0, 1.0 + (_avgComplexity - 5) * 0.1);

    return Math.max(0.1, Math.min(1.0, strength));
  }

  private isBidirectionalRelationship(type: RelationshipType): boolean {
    const bidirectionalTypes: RelationshipType[] = [
      "similar",
      "related",
      "associates",
      "collaboration",
    ];
    return bidirectionalTypes.includes(type);
  }

  private generateRelationshipId(
    sourceId: string,
    targetId: string,
    type: RelationshipType,
  ): string {
    return `${sourceId}__${type}__${targetId}`;
  }

  private calculatePathConfidence(_relationships: Relationship[]): number {
    if (_relationships.length === 0) {
      return 0;
    }

    return (
      _relationships.reduce((sum, _rel) => sum + _rel.metadata.confidence, 0) /
      _relationships.length
    );
  }

  private sortNodes(_nodes: GraphNode[], sortBy: string): GraphNode[] {
    switch (sortBy) {
      case "_importance":
        return _nodes.sort(
          (a, b) => b.metadata.importance - a.metadata.importance,
        );
      case "similarity":
        return _nodes.sort((a, b) => b.weights.semantic - a.weights.semantic);
      case "relevance":
      default:
        return _nodes.sort((a, b) => {
          const _scoreA =
            a.metadata.importance * 0.5 +
            a.weights.semantic * 0.3 +
            a.metadata.centrality * 0.2;
          const _scoreB =
            b.metadata.importance * 0.5 +
            b.weights.semantic * 0.3 +
            b.metadata.centrality * 0.2;
          return _scoreB - _scoreA;
        });
    }
  }

  private extractDomain(entity: CodeEntity | ConceptEntity): string {
    if ("domain" in entity) {
      return entity.domain;
    }

    // Extract domain from file _path or name
    const _parts = entity.filePath.split("/");
    return _parts[_parts.length - 2] || "unknown";
  }

  private updateStatistics(): void {
    this.statistics = {
      nodeCount: this.nodes.size,
      edgeCount: this.relationships.size,
      clusterCount: this.clusters.size,
      density: this.calculateDensity(),
      averagePathLength: this.calculateAveragePathLength(),
      clusteringCoefficient: this.calculateClusteringCoefficient(),
      maxDegree: this.calculateMaxDegree(),
      averageDegree: this.calculateAverageDegree(),
      stronglyConnectedComponents: 0, // TODO: Implement
      weaklyConnectedComponents: 0, // TODO: Implement
    };
  }

  private calculateDensity(): number {
    const n = this.nodes.size;
    if (n < 2) {
      return 0;
    }
    return (2 * this.relationships.size) / (n * (n - 1));
  }

  private calculateAveragePathLength(): number {
    let totalLength = 0;
    let pathCount = 0;

    const _nodeIds = Array.from(this.nodes.keys());

    for (let i = 0; i < _nodeIds.length; i++) {
      for (let j = i + 1; j < _nodeIds.length; j++) {
        const _path = this.findShortestPath(_nodeIds[i], _nodeIds[j]);
        if (_path) {
          totalLength += _path.length;
          pathCount++;
        }
      }
    }

    return pathCount > 0 ? totalLength / pathCount : 0;
  }

  private calculateClusteringCoefficient(): number {
    let totalCoefficient = 0;
    let nodeCount = 0;

    for (const [_nodeId, _node] of this.nodes) {
      const _neighbors = Array.from(this.adjacencyList.get(_nodeId) || []);
      if (_neighbors.length < 2) {
        continue;
      }

      let edgeCount = 0;
      for (let i = 0; i < _neighbors.length; i++) {
        for (let j = i + 1; j < _neighbors.length; j++) {
          if (this.adjacencyList.get(_neighbors[i])?.has(_neighbors[j])) {
            edgeCount++;
          }
        }
      }

      const _possibleEdges = (_neighbors.length * (_neighbors.length - 1)) / 2;
      const _coefficient = edgeCount / _possibleEdges;

      totalCoefficient += _coefficient;
      nodeCount++;
    }

    return nodeCount > 0 ? totalCoefficient / nodeCount : 0;
  }

  private calculateMaxDegree(): number {
    let maxDegree = 0;

    for (const adjacentNodes of this.adjacencyList.values()) {
      maxDegree = Math.max(maxDegree, adjacentNodes.size);
    }

    return maxDegree;
  }

  private calculateAverageDegree(): number {
    const _totalDegree = Array.from(this.adjacencyList.values()).reduce(
      (sum, adjacentNodes) => sum + adjacentNodes.size,
      0,
    );

    return this.nodes.size > 0 ? _totalDegree / this.nodes.size : 0;
  }

  private initializeStatistics(): GraphStatistics {
    return {
      nodeCount: 0,
      edgeCount: 0,
      clusterCount: 0,
      density: 0,
      averagePathLength: 0,
      clusteringCoefficient: 0,
      maxDegree: 0,
      averageDegree: 0,
      stronglyConnectedComponents: 0,
      weaklyConnectedComponents: 0,
    };
  }

  // ========== Public API ==========

  getStatistics(): GraphStatistics {
    return { ...this.statistics };
  }

  getAllNodes(): Map<string, GraphNode> {
    return new Map(this.nodes);
  }

  getAllRelationships(): Map<string, Relationship> {
    return new Map(this.relationships);
  }

  getAllClusters(): Map<string, GraphCluster> {
    return new Map(this.clusters);
  }

  clear(): void {
    this.nodes.clear();
    this.relationships.clear();
    this.clusters.clear();
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
    this.statistics = this.initializeStatistics();
    this.emit("graphCleared");
  }

  exportGraph(): unknown {
    return {
      _nodes: Array.from(this.nodes.values()),
      _relationships: Array.from(this.relationships.values()),
      _clusters: Array.from(this.clusters.values()),
      statistics: this.statistics,
    };
  }
}

// ========== Graph Indexer ==========

class GraphIndexer {
  private nodeIndex: Map<string, Set<string>>;
  private tagIndex: Map<string, Set<string>>;
  private typeIndex: Map<EntityType, Set<string>>;

  constructor() {
    this.nodeIndex = new Map();
    this.tagIndex = new Map();
    this.typeIndex = new Map();
  }

  indexNode(_node: GraphNode): void {
    // Index by name
    const _nameTokens = this.tokenize(_node.entity.name);
    for (const token of _nameTokens) {
      if (!this.nodeIndex.has(token)) {
        this.nodeIndex.set(token, new Set());
      }
      this.nodeIndex.get(token)!.add(_node.id);
    }

    // Index by type
    if (!this.typeIndex.has(_node.type as EntityType)) {
      this.typeIndex.set(_node.type as EntityType, new Set());
    }
    this.typeIndex.get(_node.type as EntityType)!.add(_node.id);

    // Index by tags
    for (const tag of _node.metadata.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(_node.id);
    }
  }

  removeNode(_nodeId: string): void {
    // Remove from all indexes
    for (const nodeSet of this.nodeIndex.values()) {
      nodeSet.delete(_nodeId);
    }
    for (const nodeSet of this.tagIndex.values()) {
      nodeSet.delete(_nodeId);
    }
    for (const nodeSet of this.typeIndex.values()) {
      nodeSet.delete(_nodeId);
    }
  }

  updateNode(_node: GraphNode): void {
    this.removeNode(node.id);
    this.indexNode(_node);
  }

  search(query: string): Set<string> {
    const _tokens = this.tokenize(query);
    let results = new Set<string>();

    for (const token of _tokens) {
      const _tokenResults = this.nodeIndex.get(token) || new Set();
      if (results.size === 0) {
        results = new Set(_tokenResults);
      } else {
        results = new Set([...results].filter((x) => _tokenResults.has(x)));
      }
    }

    return results;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }
}

// ========== Graph Clusterer ==========

class GraphClusterer {
  _cluster(graph: KnowledgeGraph): Map<string, GraphCluster> {
    const _clusters = new Map<string, GraphCluster>();
    const _nodes = graph.getAllNodes();
    const _visited = new Set<string>();

    // Simple connected components clustering
    for (const [_nodeId, _node] of _nodes) {
      if (_visited.has(_nodeId)) {
        continue;
      }

      const _cluster = this.expandCluster(graph, _nodeId, _visited);
      if (_cluster._nodes.size > 1) {
        clusters.set(_cluster.id, _cluster);
      }
    }

    return _clusters;
  }

  private expandCluster(
    graph: KnowledgeGraph,
    startNodeId: string,
    _visited: Set<string>,
  ): GraphCluster {
    const _clusterNodes = new Set<string>();
    const _queue = [startNodeId];

    while (_queue.length > 0) {
      const _nodeId = _queue.shift()!;
      if (_visited.has(_nodeId)) {
        continue;
      }

      visited.add(_nodeId);
      clusterNodes.add(_nodeId);

      const _neighbors = graph.getNeighbors(_nodeId, { maxDepth: 1 });
      for (const _neighbor of _neighbors) {
        if (!_visited.has(_neighbor.id)) {
          queue.push(_neighbor.id);
        }
      }
    }

    return {
      id: `cluster_${startNodeId}`,
      name: `Cluster ${startNodeId}`,
      type: "module",
      _nodes: _clusterNodes,
      cohesion: this.calculateCohesion(graph, _clusterNodes),
      _centrality: 0.5,
      domain: "unknown",
    };
  }

  private calculateCohesion(
    _graph: KnowledgeGraph,
    _nodes: Set<string>,
  ): number {
    if (nodes.size < 2) {
      return 1.0;
    }

    let internalEdges = 0;
    let _possibleEdges = 0;

    const _nodeArray = Array.from(_nodes);
    for (let i = 0; i < _nodeArray.length; i++) {
      for (let j = i + 1; j < _nodeArray.length; j++) {
        _possibleEdges++;
        const _relationships = _graph.getRelationshipsBetween(
          _nodeArray[i],
          _nodeArray[j],
        );
        if (_relationships.length > 0) {
          internalEdges++;
        }
      }
    }

    return _possibleEdges > 0 ? internalEdges / _possibleEdges : 0;
  }
}

export default KnowledgeGraph;
