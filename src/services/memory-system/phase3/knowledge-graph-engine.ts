/**
 * MARIA Memory System - Phase 3: Knowledge Graph Engine
 * 
 * Advanced knowledge representation with entity extraction,
 * relationship analysis, and semantic search capabilities
 */

import { EventEmitter } from 'events';
import { 
  KnowledgeNode, 
  ConceptGraph, 
  ConceptEdge, 
  ConceptCluster,
  NodeMetadata,
  MemoryEvent 
} from '../types/memory-interfaces';

export interface EntityExtractionResult {
  entities: Entity[];
  relationships: Relationship[];
  confidence: number;
}

export interface Entity {
  id: string;
  text: string;
  type: EntityType;
  position: { start: number; end: number };
  attributes: Map<string, unknown>;
  embedding?: number[];
}

export type EntityType = 
  | 'code_function'
  | 'code_class'
  | 'code_variable'
  | 'technical_concept'
  | 'business_logic'
  | 'user_preference'
  | 'team_pattern';

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
  | 'implements'
  | 'extends'
  | 'uses'
  | 'depends_on'
  | 'similar_to'
  | 'contradicts'
  | 'improves'
  | 'replaces';

export interface SemanticSearchOptions {
  query: string;
  topK?: number;
  minSimilarity?: number;
  filters?: SearchFilter[];
  includeRelationships?: boolean;
}

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'in';
  value: unknown;
}

export interface SearchResult {
  node: KnowledgeNode;
  similarity: number;
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
      nodes: new Map(),
      edges: new Map(),
      clusters: []
    };
    this.entityIndex = new Map();
    this.relationshipIndex = new Map();
    this.embeddingCache = new Map();
  }

  /**
   * Extract entities and relationships from text
   */
  async extractEntities(text: string, context?: Record<string, unknown>): Promise<EntityExtractionResult> {
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];
    
    // Pattern-based extraction for code entities
    const functionPattern = /(?:function|const|let|var)\s+(\w+)\s*=?\s*(?:\([^)]*\)|async)/g;
    const classPattern = /class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
    const importPattern = /import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    
    // Extract functions
    let match;
    while ((match = functionPattern.exec(text)) !== null) {
      const entity: Entity = {
        id: this.generateId('entity'),
        text: match[1],
        type: 'code_function',
        position: { start: match.index, end: match.index + match[0].length },
        attributes: new Map([['source', 'pattern_extraction']])
      };
      entities.push(entity);
    }
    
    // Extract classes and inheritance relationships
    while ((match = classPattern.exec(text)) !== null) {
      const classEntity: Entity = {
        id: this.generateId('entity'),
        text: match[1],
        type: 'code_class',
        position: { start: match.index, end: match.index + match[0].length },
        attributes: new Map([['source', 'pattern_extraction']])
      };
      entities.push(classEntity);
      
      if (match[2]) {
        // Create inheritance relationship
        const parentEntity = entities.find(e => e.text === match[2]) || {
          id: this.generateId('entity'),
          text: match[2],
          type: 'code_class',
          position: { start: 0, end: 0 },
          attributes: new Map([['source', 'inferred']])
        };
        
        if (!entities.find(e => e.text === match[2])) {
          entities.push(parentEntity as Entity);
        }
        
        relationships.push({
          id: this.generateId('rel'),
          sourceEntityId: classEntity.id,
          targetEntityId: parentEntity.id,
          type: 'extends',
          confidence: 0.95,
          bidirectional: false
        });
      }
    }
    
    // Extract import dependencies
    while ((match = importPattern.exec(text)) !== null) {
      const moduleEntity: Entity = {
        id: this.generateId('entity'),
        text: match[1],
        type: 'technical_concept',
        position: { start: match.index, end: match.index + match[0].length },
        attributes: new Map([['type', 'module'], ['source', 'import']])
      };
      entities.push(moduleEntity);
    }
    
    // Calculate embeddings for entities
    for (const entity of entities) {
      entity.embedding = await this.generateEmbedding(entity.text);
    }
    
    // Detect similarity relationships based on embeddings
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const similarity = this.cosineSimilarity(
          entities[i].embedding!,
          entities[j].embedding!
        );
        
        if (similarity > 0.8 && entities[i].type === entities[j].type) {
          relationships.push({
            id: this.generateId('rel'),
            sourceEntityId: entities[i].id,
            targetEntityId: entities[j].id,
            type: 'similar_to',
            confidence: similarity,
            bidirectional: true,
            metadata: { similarity }
          });
        }
      }
    }
    
    return {
      entities,
      relationships,
      confidence: this.calculateExtractionConfidence(entities, relationships)
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
        embedding: entity.embedding || [],
        confidence: extraction.confidence,
        lastAccessed: new Date(),
        accessCount: 1,
        metadata: {
          complexity: this.assessComplexity(entity),
          quality: extraction.confidence,
          relevance: 1.0
        }
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
        confidence: relationship.confidence
      };
      
      this.graph.edges.set(edge.id, edge);
    }
    
    // Update clusters
    await this.updateClusters();
    
    // Emit graph update event
    this.emit('graphUpdated', {
      nodesAdded: extraction.entities.length,
      edgesAdded: extraction.relationships.length,
      totalNodes: this.graph.nodes.size,
      totalEdges: this.graph.edges.size
    });
  }

  /**
   * Semantic search in the knowledge graph
   */
  async search(options: SemanticSearchOptions): Promise<SearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(options.query);
    const results: SearchResult[] = [];
    
    // Calculate similarity for all nodes
    for (const [nodeId, node] of this.graph.nodes) {
      if (!node.embedding || node.embedding.length === 0) continue;
      
      const similarity = this.cosineSimilarity(queryEmbedding, node.embedding);
      
      if (similarity >= (options.minSimilarity || 0.5)) {
        // Apply filters
        if (options.filters && !this.passesFilters(node, options.filters)) {
          continue;
        }
        
        const result: SearchResult = {
          node,
          similarity
        };
        
        // Include relationships if requested
        if (options.includeRelationships) {
          result.relationships = this.getNodeRelationships(nodeId);
        }
        
        results.push(result);
      }
    }
    
    // Sort by similarity and limit results
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.slice(0, options.topK || 10);
  }

  /**
   * Find shortest path between two nodes
   */
  findPath(sourceId: string, targetId: string): KnowledgeNode[] | null {
    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[] }[] = [
      { nodeId: sourceId, path: [sourceId] }
    ];
    
    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      
      if (nodeId === targetId) {
        return path.map(id => this.graph.nodes.get(id)!);
      }
      
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      
      // Get connected nodes
      for (const [, edge] of this.graph.edges) {
        let nextNodeId: string | null = null;
        
        if (edge.sourceId === nodeId) {
          nextNodeId = edge.targetId;
        } else if (edge.targetId === nodeId && this.isBidirectional(edge)) {
          nextNodeId = edge.sourceId;
        }
        
        if (nextNodeId && !visited.has(nextNodeId)) {
          queue.push({
            nodeId: nextNodeId,
            path: [...path, nextNodeId]
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
    const nodeTypes = new Map<string, number>();
    const edgeTypes = new Map<string, number>();
    
    for (const node of this.graph.nodes.values()) {
      nodeTypes.set(node.type, (nodeTypes.get(node.type) || 0) + 1);
    }
    
    for (const edge of this.graph.edges.values()) {
      edgeTypes.set(edge.type, (edgeTypes.get(edge.type) || 0) + 1);
    }
    
    return {
      totalNodes: this.graph.nodes.size,
      totalEdges: this.graph.edges.size,
      totalClusters: this.graph.clusters.length,
      nodeTypes: Object.fromEntries(nodeTypes),
      edgeTypes: Object.fromEntries(edgeTypes),
      averageDegree: this.calculateAverageDegree(),
      density: this.calculateGraphDensity()
    };
  }

  /**
   * Export graph for visualization
   */
  exportForVisualization() {
    const nodes = Array.from(this.graph.nodes.values()).map(node => ({
      id: node.id,
      label: node.name,
      type: node.type,
      size: Math.log(node.accessCount + 1) * 10,
      color: this.getNodeColor(node.type)
    }));
    
    const edges = Array.from(this.graph.edges.values()).map(edge => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: edge.type,
      weight: edge.weight,
      color: this.getEdgeColor(edge.type)
    }));
    
    return { nodes, edges, clusters: this.graph.clusters };
  }

  // Private helper methods
  private async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    if (this.embeddingCache.has(text)) {
      return this.embeddingCache.get(text)!;
    }
    
    // Simple embedding generation (in production, use actual embedding model)
    const embedding = new Array(384).fill(0).map(() => Math.random());
    this.embeddingCache.set(text, embedding);
    
    return embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async updateClusters(): Promise<void> {
    // Simple clustering based on embeddings
    const nodes = Array.from(this.graph.nodes.values());
    const clusters: ConceptCluster[] = [];
    const assigned = new Set<string>();
    
    for (const node of nodes) {
      if (assigned.has(node.id)) continue;
      
      const cluster: ConceptCluster = {
        id: this.generateId('cluster'),
        name: `Cluster_${node.name}`,
        nodeIds: [node.id],
        centroid: [...node.embedding],
        coherence: 1.0
      };
      
      // Find similar nodes
      for (const otherNode of nodes) {
        if (otherNode.id === node.id || assigned.has(otherNode.id)) continue;
        
        const similarity = this.cosineSimilarity(node.embedding, otherNode.embedding);
        if (similarity > this.clusteringThreshold) {
          cluster.nodeIds.push(otherNode.id);
          assigned.add(otherNode.id);
        }
      }
      
      assigned.add(node.id);
      clusters.push(cluster);
    }
    
    this.graph.clusters = clusters;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapEntityTypeToNodeType(entityType: EntityType): KnowledgeNode['type'] {
    const mapping: Record<EntityType, KnowledgeNode['type']> = {
      'code_function': 'function',
      'code_class': 'class',
      'code_variable': 'pattern',
      'technical_concept': 'concept',
      'business_logic': 'concept',
      'user_preference': 'pattern',
      'team_pattern': 'pattern'
    };
    return mapping[entityType] || 'concept';
  }

  private assessComplexity(entity: Entity): 'low' | 'medium' | 'high' {
    const text = entity.text;
    if (text.length < 20) return 'low';
    if (text.length < 50) return 'medium';
    return 'high';
  }

  private calculateExtractionConfidence(entities: Entity[], relationships: Relationship[]): number {
    if (entities.length === 0) return 0;
    
    const avgRelationshipConfidence = relationships.length > 0
      ? relationships.reduce((sum, r) => sum + r.confidence, 0) / relationships.length
      : 0.5;
    
    return Math.min(0.95, 0.5 + (entities.length * 0.05) + (avgRelationshipConfidence * 0.3));
  }

  private passesFilters(node: KnowledgeNode, filters: SearchFilter[]): boolean {
    for (const filter of filters) {
      const value = (node as any)[filter.field] || node.metadata[filter.field as keyof NodeMetadata];
      
      switch (filter.operator) {
        case 'eq':
          if (value !== filter.value) return false;
          break;
        case 'neq':
          if (value === filter.value) return false;
          break;
        case 'gt':
          if (value <= filter.value) return false;
          break;
        case 'lt':
          if (value >= filter.value) return false;
          break;
        case 'contains':
          if (!String(value).includes(String(filter.value))) return false;
          break;
        case 'in':
          if (!Array.isArray(filter.value) || !filter.value.includes(value)) return false;
          break;
      }
    }
    
    return true;
  }

  private getNodeRelationships(nodeId: string): Relationship[] {
    const relationships: Relationship[] = [];
    
    for (const rel of this.relationshipIndex.values()) {
      if (rel.sourceEntityId === nodeId || rel.targetEntityId === nodeId) {
        relationships.push(rel);
      }
    }
    
    return relationships;
  }

  private isBidirectional(edge: ConceptEdge): boolean {
    const rel = this.relationshipIndex.get(edge.id);
    return rel?.bidirectional || false;
  }

  private calculateAverageDegree(): number {
    if (this.graph.nodes.size === 0) return 0;
    
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
    if (n < 2) return 0;
    
    const maxEdges = (n * (n - 1)) / 2;
    return this.graph.edges.size / maxEdges;
  }

  private getNodeColor(type: string): string {
    const colors: Record<string, string> = {
      'function': '#4CAF50',
      'class': '#2196F3',
      'module': '#FF9800',
      'concept': '#9C27B0',
      'pattern': '#00BCD4'
    };
    return colors[type] || '#757575';
  }

  private getEdgeColor(type: string): string {
    const colors: Record<string, string> = {
      'implements': '#4CAF50',
      'extends': '#2196F3',
      'uses': '#FF9800',
      'depends_on': '#F44336',
      'similar_to': '#9C27B0'
    };
    return colors[type] || '#9E9E9E';
  }
}