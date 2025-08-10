/**
 * LocalGraphService - In-memory graph database replacing Neo4j
 */
import * as fs from 'fs-extra';
import * as path from 'path';

interface Node {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

interface Relationship {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, any>;
}

interface GraphOptions {
  persistPath?: string;
  maxNodes?: number;
  maxRelationships?: number;
}

export class LocalGraphService {
  private nodes: Map<string, Node> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private nodesByLabel: Map<string, Set<string>> = new Map();
  private relationshipsByType: Map<string, Set<string>> = new Map();
  private persistPath: string;
  private maxNodes: number;
  private maxRelationships: number;

  constructor(options: GraphOptions = {}) {
    this.persistPath = options.persistPath || path.join(process.env.HOME || '', '.maria', 'graph');
    this.maxNodes = options.maxNodes || 100000;
    this.maxRelationships = options.maxRelationships || 500000;
    
    // Ensure persist directory exists
    fs.ensureDirSync(this.persistPath);
    
    // Load existing graph
    this.load();
  }

  async createNode(labels: string[], properties: Record<string, any> = {}): Promise<Node> {
    if (this.nodes.size >= this.maxNodes) {
      throw new Error(`Maximum node limit (${this.maxNodes}) reached`);
    }

    const id = this.generateId();
    const node: Node = { id, labels, properties };
    
    this.nodes.set(id, node);
    
    // Index by labels
    for (const label of labels) {
      if (!this.nodesByLabel.has(label)) {
        this.nodesByLabel.set(label, new Set());
      }
      this.nodesByLabel.get(label)!.add(id);
    }
    
    await this.persist();
    return node;
  }

  async createRelationship(
    startNodeId: string,
    endNodeId: string,
    type: string,
    properties: Record<string, any> = {}
  ): Promise<Relationship> {
    if (this.relationships.size >= this.maxRelationships) {
      throw new Error(`Maximum relationship limit (${this.maxRelationships}) reached`);
    }

    if (!this.nodes.has(startNodeId) || !this.nodes.has(endNodeId)) {
      throw new Error('Start or end node not found');
    }

    const id = this.generateId();
    const relationship: Relationship = {
      id,
      type,
      startNode: startNodeId,
      endNode: endNodeId,
      properties
    };
    
    this.relationships.set(id, relationship);
    
    // Index by type
    if (!this.relationshipsByType.has(type)) {
      this.relationshipsByType.set(type, new Set());
    }
    this.relationshipsByType.get(type)!.add(id);
    
    await this.persist();
    return relationship;
  }

  async findNodes(label?: string, properties?: Record<string, any>): Promise<Node[]> {
    let nodes: Node[] = [];
    
    if (label) {
      const nodeIds = this.nodesByLabel.get(label);
      if (nodeIds) {
        nodes = Array.from(nodeIds).map(id => this.nodes.get(id)!);
      }
    } else {
      nodes = Array.from(this.nodes.values());
    }
    
    // Filter by properties if provided
    if (properties) {
      nodes = nodes.filter(node => 
        Object.entries(properties).every(([key, value]) => 
          node.properties[key] === value
        )
      );
    }
    
    return nodes;
  }

  async findRelationships(type?: string, startNodeId?: string, endNodeId?: string): Promise<Relationship[]> {
    let relationships: Relationship[] = [];
    
    if (type) {
      const relIds = this.relationshipsByType.get(type);
      if (relIds) {
        relationships = Array.from(relIds).map(id => this.relationships.get(id)!);
      }
    } else {
      relationships = Array.from(this.relationships.values());
    }
    
    // Filter by start/end nodes
    if (startNodeId) {
      relationships = relationships.filter(r => r.startNode === startNodeId);
    }
    if (endNodeId) {
      relationships = relationships.filter(r => r.endNode === endNodeId);
    }
    
    return relationships;
  }

  async traverse(
    startNodeId: string,
    relationshipType?: string,
    direction: 'out' | 'in' | 'both' = 'out',
    maxDepth: number = 3
  ): Promise<Node[]> {
    const visited = new Set<string>();
    const result: Node[] = [];
    
    const queue: { nodeId: string; depth: number }[] = [{ nodeId: startNodeId, depth: 0 }];
    
    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;
      
      if (visited.has(nodeId) || depth > maxDepth) {
        continue;
      }
      
      visited.add(nodeId);
      const node = this.nodes.get(nodeId);
      
      if (node) {
        result.push(node);
        
        // Find connected nodes
        const relationships = await this.findRelationships(relationshipType);
        
        for (const rel of relationships) {
          if (direction === 'out' || direction === 'both') {
            if (rel.startNode === nodeId && !visited.has(rel.endNode)) {
              queue.push({ nodeId: rel.endNode, depth: depth + 1 });
            }
          }
          
          if (direction === 'in' || direction === 'both') {
            if (rel.endNode === nodeId && !visited.has(rel.startNode)) {
              queue.push({ nodeId: rel.startNode, depth: depth + 1 });
            }
          }
        }
      }
    }
    
    return result;
  }

  async shortestPath(startNodeId: string, endNodeId: string): Promise<Node[] | null> {
    if (!this.nodes.has(startNodeId) || !this.nodes.has(endNodeId)) {
      return null;
    }
    
    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const queue = [startNodeId];
    
    visited.add(startNodeId);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current === endNodeId) {
        // Reconstruct path
        const path: Node[] = [];
        let node = endNodeId;
        
        while (node) {
          path.unshift(this.nodes.get(node)!);
          node = parent.get(node)!;
          if (node === startNodeId) {
            path.unshift(this.nodes.get(startNodeId)!);
            break;
          }
        }
        
        return path;
      }
      
      // Find neighbors
      const relationships = await this.findRelationships(undefined, current);
      
      for (const rel of relationships) {
        const neighbor = rel.endNode;
        
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }
    
    return null;
  }

  async deleteNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }
    
    // Remove node
    this.nodes.delete(nodeId);
    
    // Remove from label index
    for (const label of node.labels) {
      const labelNodes = this.nodesByLabel.get(label);
      if (labelNodes) {
        labelNodes.delete(nodeId);
      }
    }
    
    // Remove related relationships
    const toDelete: string[] = [];
    for (const [id, rel] of this.relationships) {
      if (rel.startNode === nodeId || rel.endNode === nodeId) {
        toDelete.push(id);
      }
    }
    
    for (const id of toDelete) {
      await this.deleteRelationship(id);
    }
    
    await this.persist();
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    const rel = this.relationships.get(relationshipId);
    if (!rel) {
      return;
    }
    
    // Remove relationship
    this.relationships.delete(relationshipId);
    
    // Remove from type index
    const typeRels = this.relationshipsByType.get(rel.type);
    if (typeRels) {
      typeRels.delete(relationshipId);
    }
    
    await this.persist();
  }

  async clear(): Promise<void> {
    this.nodes.clear();
    this.relationships.clear();
    this.nodesByLabel.clear();
    this.relationshipsByType.clear();
    await this.persist();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async persist(): Promise<void> {
    const data = {
      nodes: Array.from(this.nodes.entries()),
      relationships: Array.from(this.relationships.entries()),
      nodesByLabel: Array.from(this.nodesByLabel.entries()).map(([label, ids]) => [label, Array.from(ids)]),
      relationshipsByType: Array.from(this.relationshipsByType.entries()).map(([type, ids]) => [type, Array.from(ids)])
    };
    
    const dataPath = path.join(this.persistPath, 'graph.json');
    await fs.writeJson(dataPath, data, { spaces: 2 });
  }

  private load(): void {
    const dataPath = path.join(this.persistPath, 'graph.json');
    
    if (!fs.existsSync(dataPath)) {
      return;
    }
    
    try {
      const data = fs.readJsonSync(dataPath);
      
      this.nodes = new Map(data.nodes);
      this.relationships = new Map(data.relationships);
      this.nodesByLabel = new Map(data.nodesByLabel.map(([label, ids]: [string, string[]]) => [label, new Set(ids)]));
      this.relationshipsByType = new Map(data.relationshipsByType.map(([type, ids]: [string, string[]]) => [type, new Set(ids)]));
    } catch (error) {
      console.error('Failed to load graph data:', error);
    }
  }

  // Statistics
  getStatistics() {
    return {
      nodeCount: this.nodes.size,
      relationshipCount: this.relationships.size,
      labelCount: this.nodesByLabel.size,
      typeCount: this.relationshipsByType.size,
      maxNodes: this.maxNodes,
      maxRelationships: this.maxRelationships
    };
  }
}