/**
 * Graph Builder for Knowledge Graph
 *
 * Constructs and maintains the knowledge graph from extracted entities and their relationships.
 * Implements efficient graph storage, traversal algorithms, and relationship management.
 */

import { EventEmitter } from 'events';
import { CodeEntity, ConceptEntity, EntityType } from './entity-extractor';

export interface GraphNode {
  id: string;
  type: EntityType | 'concept';
  entity: CodeEntity | ConceptEntity;
  metadata: NodeMetadata;
  relationships: Map<string, Relationship>;
  weights: NodeWeights;
}

export interface NodeMetadata {
  importance: number; // 0-1 score
  centrality: number; // Betweenness centrality
  clusters: string[]; // Cluster IDs this node belongs to
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
  source: string;
  target: string;
  type: RelationshipType;
  strength: number; // 0-1
  metadata: RelationshipMetadata;
  bidirectional: boolean;
}

export type RelationshipType =
  | 'extends'
  | 'implements'
  | 'imports'
  | 'exports'
  | 'calls'
  | 'instantiates'
  | 'aggregates'
  | 'composes'
  | 'associates'
  | 'depends'
  | 'similar'
  | 'related'
  | 'concept'
  | 'business-rule'
  | 'data-flow'
  | 'control-flow'
  | 'inheritance'
  | 'collaboration';

export interface RelationshipMetadata {
  confidence: number; // 0-1
  weight: number; // Relationship strength
  frequency: number; // How often accessed together
  distance: number; // Graph distance
  semantic: number; // Semantic similarity
  structural: number; // Structural relationship
  temporal: number; // Temporal correlation
  created: Date;
  lastUsed: Date;
}

export interface GraphCluster {
  id: string;
  name: string;
  type: ClusterType;
  nodes: Set<string>;
  cohesion: number; // Internal connectivity
  centrality: number; // Cluster importance
  domain: string;
  description?: string;
}

export type ClusterType =
  | 'module'
  | 'component'
  | 'service'
  | 'domain'
  | 'feature'
  | 'utility'
  | 'infrastructure'
  | 'business-logic';

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
  sortBy: 'relevance' | 'importance' | 'similarity';
}

export interface PathResult {
  path: string[];
  relationships: Relationship[];
  totalWeight: number;
  length: number;
  confidence: number;
}

export interface NeighborhoodResult {
  center: GraphNode;
  neighbors: Map<number, GraphNode[]>; // By distance
  relationships: Relationship[];
  subgraph: KnowledgeGraph;
}

export class KnowledgeGraph extends EventEmitter {
  private nodes: Map<string, GraphNode>;
  private relationships: Map<string, Relationship>;
  private clusters: Map<string, GraphCluster>;
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
    const node: GraphNode = {
      id: entity.id,
      type: entity.type,
      entity,
      metadata: this.createNodeMetadata(entity),
      relationships: new Map(),
      weights: this.calculateNodeWeights(entity),
    };

    this.nodes.set(node.id, node);
    this.adjacencyList.set(node.id, new Set());
    this.reverseAdjacencyList.set(node.id, new Set());

    // Index node for search
    this.indexer.indexNode(node);

    this.emit('nodeAdded', node);
    this.updateStatistics();

    return node;
  }

  removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove all relationships involving this node
    const relatedRelationships = Array.from(node.relationships.values());
    for (const rel of relatedRelationships) {
      this.removeRelationship(rel.id);
    }

    // Remove from adjacency lists
    this.adjacencyList.delete(nodeId);
    this.reverseAdjacencyList.delete(nodeId);

    // Remove from all adjacency lists
    for (const adjList of this.adjacencyList.values()) {
      adjList.delete(nodeId);
    }
    for (const adjList of this.reverseAdjacencyList.values()) {
      adjList.delete(nodeId);
    }

    // Remove from clusters
    for (const cluster of this.clusters.values()) {
      cluster.nodes.delete(nodeId);
    }

    // Remove from index
    this.indexer.removeNode(nodeId);

    this.nodes.delete(nodeId);
    this.emit('nodeRemoved', { nodeId, node });
    this.updateStatistics();

    return true;
  }

  getNode(nodeId: string): GraphNode | undefined {
    const node = this.nodes.get(nodeId);
    if (node) {
      // Update access statistics
      node.metadata.lastAccessed = new Date();
      node.metadata.accessCount++;
    }
    return node;
  }

  updateNode(nodeId: string, updates: Partial<GraphNode>): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    Object.assign(node, updates);
    this.indexer.updateNode(node);
    this.emit('nodeUpdated', node);

    return true;
  }

  // ========== Relationship Management ==========

  addRelationship(
    sourceId: string,
    targetId: string,
    type: RelationshipType,
    options: Partial<RelationshipMetadata> = {},
  ): Relationship | null {
    const source = this.nodes.get(sourceId);
    const target = this.nodes.get(targetId);

    if (!source || !target) return null;

    const relationship: Relationship = {
      id: this.generateRelationshipId(sourceId, targetId, type),
      source: sourceId,
      target: targetId,
      type,
      strength: this.calculateRelationshipStrength(source, target, type),
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

    this.relationships.set(relationship.id, relationship);

    // Update adjacency lists
    this.adjacencyList.get(sourceId)?.add(targetId);
    this.reverseAdjacencyList.get(targetId)?.add(sourceId);

    if (relationship.bidirectional) {
      this.adjacencyList.get(targetId)?.add(sourceId);
      this.reverseAdjacencyList.get(sourceId)?.add(targetId);
    }

    // Update node relationships
    source.relationships.set(relationship.id, relationship);
    target.relationships.set(relationship.id, relationship);

    this.emit('relationshipAdded', relationship);
    this.updateStatistics();

    return relationship;
  }

  removeRelationship(relationshipId: string): boolean {
    const relationship = this.relationships.get(relationshipId);
    if (!relationship) return false;

    const source = this.nodes.get(relationship.source);
    const target = this.nodes.get(relationship.target);

    // Update adjacency lists
    if (source && target) {
      this.adjacencyList.get(relationship.source)?.delete(relationship.target);
      this.reverseAdjacencyList.get(relationship.target)?.delete(relationship.source);

      if (relationship.bidirectional) {
        this.adjacencyList.get(relationship.target)?.delete(relationship.source);
        this.reverseAdjacencyList.get(relationship.source)?.delete(relationship.target);
      }

      // Remove from node relationships
      source.relationships.delete(relationshipId);
      target.relationships.delete(relationshipId);
    }

    this.relationships.delete(relationshipId);
    this.emit('relationshipRemoved', { relationshipId, relationship });
    this.updateStatistics();

    return true;
  }

  getRelationship(relationshipId: string): Relationship | undefined {
    const rel = this.relationships.get(relationshipId);
    if (rel) {
      rel.metadata.lastUsed = new Date();
      rel.metadata.frequency++;
    }
    return rel;
  }

  getRelationshipsBetween(sourceId: string, targetId: string): Relationship[] {
    const relationships: Relationship[] = [];

    for (const rel of this.relationships.values()) {
      if (
        (rel.source === sourceId && rel.target === targetId) ||
        (rel.bidirectional && rel.source === targetId && rel.target === sourceId)
      ) {
        relationships.push(rel);
      }
    }

    return relationships;
  }

  // ========== Graph Traversal ==========

  getNeighbors(nodeId: string, options: Partial<TraversalOptions> = {}): GraphNode[] {
    const defaults: TraversalOptions = {
      maxDepth: 1,
      relationshipTypes: [],
      weightThreshold: 0.0,
      includeBackward: true,
      sortBy: 'relevance',
    };

    const opts = { ...defaults, ...options };
    const neighbors: GraphNode[] = [];
    const adjacentNodeIds = this.adjacencyList.get(nodeId) || new Set();

    if (opts.includeBackward) {
      const reverseAdjacentNodeIds = this.reverseAdjacencyList.get(nodeId) || new Set();
      for (const id of reverseAdjacentNodeIds) {
        adjacentNodeIds.add(id);
      }
    }

    for (const neighborId of adjacentNodeIds) {
      const neighbor = this.nodes.get(neighborId);
      if (!neighbor) continue;

      // Filter by relationship types if specified
      if (opts.relationshipTypes.length > 0) {
        const hasValidRelationship = Array.from(neighbor.relationships.values()).some((rel) =>
          opts.relationshipTypes.includes(rel.type),
        );
        if (!hasValidRelationship) continue;
      }

      // Filter by weight threshold
      if (neighbor.weights.semantic < opts.weightThreshold) continue;

      neighbors.push(neighbor);
    }

    return this.sortNodes(neighbors, opts.sortBy);
  }

  findShortestPath(sourceId: string, targetId: string): PathResult | null {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      return null;
    }

    const queue: Array<{
      nodeId: string;
      path: string[];
      relationships: Relationship[];
      weight: number;
    }> = [{ nodeId: sourceId, path: [sourceId], relationships: [], weight: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.nodeId === targetId) {
        return {
          path: current.path,
          relationships: current.relationships,
          totalWeight: current.weight,
          length: current.path.length - 1,
          confidence: this.calculatePathConfidence(current.relationships),
        };
      }

      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);

      const neighbors = this.adjacencyList.get(current.nodeId) || new Set();

      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;

        const relationships = this.getRelationshipsBetween(current.nodeId, neighborId);
        if (relationships.length === 0) continue;

        const bestRelationship = relationships.reduce((best, rel) =>
          rel.strength > best.strength ? rel : best,
        );

        queue.push({
          nodeId: neighborId,
          path: [...current.path, neighborId],
          relationships: [...current.relationships, bestRelationship],
          weight: current.weight + bestRelationship.strength,
        });
      }
    }

    return null;
  }

  findAllPaths(sourceId: string, targetId: string, maxDepth: number = 6): PathResult[] {
    const paths: PathResult[] = [];
    const visited = new Set<string>();

    const dfs = (
      currentId: string,
      path: string[],
      relationships: Relationship[],
      weight: number,
      depth: number,
    ) => {
      if (depth > maxDepth) return;

      if (currentId === targetId && path.length > 1) {
        paths.push({
          path: [...path],
          relationships: [...relationships],
          totalWeight: weight,
          length: path.length - 1,
          confidence: this.calculatePathConfidence(relationships),
        });
        return;
      }

      if (visited.has(currentId)) return;
      visited.add(currentId);

      const neighbors = this.adjacencyList.get(currentId) || new Set();

      for (const neighborId of neighbors) {
        if (path.includes(neighborId)) continue; // Avoid cycles

        const rels = this.getRelationshipsBetween(currentId, neighborId);
        if (rels.length === 0) continue;

        const bestRel = rels.reduce((best, rel) => (rel.strength > best.strength ? rel : best));

        dfs(
          neighborId,
          [...path, neighborId],
          [...relationships, bestRel],
          weight + bestRel.strength,
          depth + 1,
        );
      }

      visited.delete(currentId);
    };

    dfs(sourceId, [sourceId], [], 0, 0);

    return paths.sort((a, b) => b.confidence - a.confidence);
  }

  getNeighborhood(nodeId: string, radius: number = 2): NeighborhoodResult | null {
    const center = this.nodes.get(nodeId);
    if (!center) return null;

    const neighbors = new Map<number, GraphNode[]>();
    const relationships: Relationship[] = [];
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; distance: number }> = [{ nodeId, distance: 0 }];

    while (queue.length > 0) {
      const { nodeId: currentId, distance } = queue.shift()!;

      if (distance > radius || visited.has(currentId)) continue;
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (!node) continue;

      if (!neighbors.has(distance)) {
        neighbors.set(distance, []);
      }
      neighbors.get(distance)!.push(node);

      if (distance < radius) {
        const adjacentIds = this.adjacencyList.get(currentId) || new Set();

        for (const adjId of adjacentIds) {
          if (!visited.has(adjId)) {
            queue.push({ nodeId: adjId, distance: distance + 1 });

            // Collect relationships
            const rels = this.getRelationshipsBetween(currentId, adjId);
            relationships.push(...rels);
          }
        }
      }
    }

    // Create subgraph
    const subgraph = new KnowledgeGraph();
    for (const nodeList of neighbors.values()) {
      for (const node of nodeList) {
        subgraph.addNode(node.entity);
      }
    }

    for (const rel of relationships) {
      if (subgraph.nodes.has(rel.source) && subgraph.nodes.has(rel.target)) {
        subgraph.addRelationship(rel.source, rel.target, rel.type, rel.metadata);
      }
    }

    return {
      center,
      neighbors,
      relationships,
      subgraph,
    };
  }

  // ========== Clustering ==========

  clusterNodes(): Map<string, GraphCluster> {
    return this.clusterer.cluster(this);
  }

  getNodeClusters(nodeId: string): GraphCluster[] {
    const clusters: GraphCluster[] = [];

    for (const cluster of this.clusters.values()) {
      if (cluster.nodes.has(nodeId)) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  // ========== Analysis & Statistics ==========

  calculateCentrality(): Map<string, number> {
    const centrality = new Map<string, number>();

    // Calculate betweenness centrality
    for (const nodeId of this.nodes.keys()) {
      let centralityScore = 0;

      for (const sourceId of this.nodes.keys()) {
        for (const targetId of this.nodes.keys()) {
          if (sourceId === targetId || sourceId === nodeId || targetId === nodeId) {
            continue;
          }

          const allPaths = this.findAllPaths(sourceId, targetId, 4);
          const pathsThroughNode = allPaths.filter((path) => path.path.includes(nodeId));

          if (allPaths.length > 0) {
            centralityScore += pathsThroughNode.length / allPaths.length;
          }
        }
      }

      centrality.set(nodeId, centralityScore);
    }

    return centrality;
  }

  calculateImportance(): Map<string, number> {
    const importance = new Map<string, number>();

    for (const [nodeId, node] of this.nodes) {
      const degree =
        (this.adjacencyList.get(nodeId)?.size || 0) +
        (this.reverseAdjacencyList.get(nodeId)?.size || 0);

      const weightedDegree = Array.from(node.relationships.values()).reduce(
        (sum, rel) => sum + rel.strength,
        0,
      );

      const complexityScore = node.entity.complexity?.cyclomaticComplexity || 1;
      const accessScore = Math.log(node.metadata.accessCount + 1);

      importance.set(
        nodeId,
        degree * 0.3 + weightedDegree * 0.4 + complexityScore * 0.2 + accessScore * 0.1,
      );
    }

    return importance;
  }

  // ========== Utility Methods ==========

  private createNodeMetadata(entity: CodeEntity | ConceptEntity): NodeMetadata {
    return {
      importance: 0.5,
      centrality: 0.0,
      clusters: [],
      lastAccessed: new Date(),
      accessCount: 0,
      complexity: entity.complexity?.cyclomaticComplexity || 1,
      domain: this.extractDomain(entity),
      tags: [],
    };
  }

  private calculateNodeWeights(entity: CodeEntity | ConceptEntity): NodeWeights {
    return {
      semantic: 1.0,
      structural: entity.dependencies.length * 0.1,
      temporal: 1.0,
      usage: 0.5,
    };
  }

  private calculateRelationshipStrength(
    source: GraphNode,
    target: GraphNode,
    type: RelationshipType,
  ): number {
    let strength = 0.5; // Base strength

    // Type-based strength adjustment
    switch (type) {
      case 'extends':
      case 'implements':
        strength = 0.9;
        break;
      case 'imports':
      case 'exports':
        strength = 0.7;
        break;
      case 'calls':
      case 'instantiates':
        strength = 0.8;
        break;
      case 'similar':
      case 'related':
        strength = 0.6;
        break;
      default:
        strength = 0.5;
    }

    // Adjust based on entity complexity
    const avgComplexity = (source.metadata.complexity + target.metadata.complexity) / 2;
    strength *= Math.min(1.0, 1.0 + (avgComplexity - 5) * 0.1);

    return Math.max(0.1, Math.min(1.0, strength));
  }

  private isBidirectionalRelationship(type: RelationshipType): boolean {
    const bidirectionalTypes: RelationshipType[] = [
      'similar',
      'related',
      'associates',
      'collaboration',
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

  private calculatePathConfidence(relationships: Relationship[]): number {
    if (relationships.length === 0) return 0;

    return (
      relationships.reduce((sum, rel) => sum + rel.metadata.confidence, 0) / relationships.length
    );
  }

  private sortNodes(nodes: GraphNode[], sortBy: string): GraphNode[] {
    switch (sortBy) {
      case 'importance':
        return nodes.sort((a, b) => b.metadata.importance - a.metadata.importance);
      case 'similarity':
        return nodes.sort((a, b) => b.weights.semantic - a.weights.semantic);
      case 'relevance':
      default:
        return nodes.sort((a, b) => {
          const scoreA =
            a.metadata.importance * 0.5 + a.weights.semantic * 0.3 + a.metadata.centrality * 0.2;
          const scoreB =
            b.metadata.importance * 0.5 + b.weights.semantic * 0.3 + b.metadata.centrality * 0.2;
          return scoreB - scoreA;
        });
    }
  }

  private extractDomain(entity: CodeEntity | ConceptEntity): string {
    if ('domain' in entity) {
      return entity.domain;
    }

    // Extract domain from file path or name
    const parts = entity.filePath.split('/');
    return parts[parts.length - 2] || 'unknown';
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
    if (n < 2) return 0;
    return (2 * this.relationships.size) / (n * (n - 1));
  }

  private calculateAveragePathLength(): number {
    let totalLength = 0;
    let pathCount = 0;

    const nodeIds = Array.from(this.nodes.keys());

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const path = this.findShortestPath(nodeIds[i], nodeIds[j]);
        if (path) {
          totalLength += path.length;
          pathCount++;
        }
      }
    }

    return pathCount > 0 ? totalLength / pathCount : 0;
  }

  private calculateClusteringCoefficient(): number {
    let totalCoefficient = 0;
    let nodeCount = 0;

    for (const [nodeId, node] of this.nodes) {
      const neighbors = Array.from(this.adjacencyList.get(nodeId) || []);
      if (neighbors.length < 2) continue;

      let edgeCount = 0;
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          if (this.adjacencyList.get(neighbors[i])?.has(neighbors[j])) {
            edgeCount++;
          }
        }
      }

      const possibleEdges = (neighbors.length * (neighbors.length - 1)) / 2;
      const coefficient = edgeCount / possibleEdges;

      totalCoefficient += coefficient;
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
    const totalDegree = Array.from(this.adjacencyList.values()).reduce(
      (sum, adjacentNodes) => sum + adjacentNodes.size,
      0,
    );

    return this.nodes.size > 0 ? totalDegree / this.nodes.size : 0;
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
    this.emit('graphCleared');
  }

  exportGraph(): unknown {
    return {
      nodes: Array.from(this.nodes.values()),
      relationships: Array.from(this.relationships.values()),
      clusters: Array.from(this.clusters.values()),
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

  indexNode(node: GraphNode): void {
    // Index by name
    const nameTokens = this.tokenize(node.entity.name);
    for (const token of nameTokens) {
      if (!this.nodeIndex.has(token)) {
        this.nodeIndex.set(token, new Set());
      }
      this.nodeIndex.get(token)!.add(node.id);
    }

    // Index by type
    if (!this.typeIndex.has(node.type as EntityType)) {
      this.typeIndex.set(node.type as EntityType, new Set());
    }
    this.typeIndex.get(node.type as EntityType)!.add(node.id);

    // Index by tags
    for (const tag of node.metadata.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(node.id);
    }
  }

  removeNode(nodeId: string): void {
    // Remove from all indexes
    for (const nodeSet of this.nodeIndex.values()) {
      nodeSet.delete(nodeId);
    }
    for (const nodeSet of this.tagIndex.values()) {
      nodeSet.delete(nodeId);
    }
    for (const nodeSet of this.typeIndex.values()) {
      nodeSet.delete(nodeId);
    }
  }

  updateNode(node: GraphNode): void {
    this.removeNode(node.id);
    this.indexNode(node);
  }

  search(query: string): Set<string> {
    const tokens = this.tokenize(query);
    let results = new Set<string>();

    for (const token of tokens) {
      const tokenResults = this.nodeIndex.get(token) || new Set();
      if (results.size === 0) {
        results = new Set(tokenResults);
      } else {
        results = new Set([...results].filter((x) => tokenResults.has(x)));
      }
    }

    return results;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }
}

// ========== Graph Clusterer ==========

class GraphClusterer {
  cluster(graph: KnowledgeGraph): Map<string, GraphCluster> {
    const clusters = new Map<string, GraphCluster>();
    const nodes = graph.getAllNodes();
    const visited = new Set<string>();

    // Simple connected components clustering
    for (const [nodeId, node] of nodes) {
      if (visited.has(nodeId)) continue;

      const cluster = this.expandCluster(graph, nodeId, visited);
      if (cluster.nodes.size > 1) {
        clusters.set(cluster.id, cluster);
      }
    }

    return clusters;
  }

  private expandCluster(
    graph: KnowledgeGraph,
    startNodeId: string,
    visited: Set<string>,
  ): GraphCluster {
    const clusterNodes = new Set<string>();
    const queue = [startNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);
      clusterNodes.add(nodeId);

      const neighbors = graph.getNeighbors(nodeId, { maxDepth: 1 });
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          queue.push(neighbor.id);
        }
      }
    }

    return {
      id: `cluster_${startNodeId}`,
      name: `Cluster ${startNodeId}`,
      type: 'module',
      nodes: clusterNodes,
      cohesion: this.calculateCohesion(graph, clusterNodes),
      centrality: 0.5,
      domain: 'unknown',
    };
  }

  private calculateCohesion(graph: KnowledgeGraph, nodes: Set<string>): number {
    if (nodes.size < 2) return 1.0;

    let internalEdges = 0;
    let possibleEdges = 0;

    const nodeArray = Array.from(nodes);
    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < nodeArray.length; j++) {
        possibleEdges++;
        const relationships = graph.getRelationshipsBetween(nodeArray[i], nodeArray[j]);
        if (relationships.length > 0) {
          internalEdges++;
        }
      }
    }

    return possibleEdges > 0 ? internalEdges / possibleEdges : 0;
  }
}

export default KnowledgeGraph;
