/**
 * Local Graph Service - OSS-ready replacement for Neo4j
 * In-memory graph database with persistence
 */

import { EventEmitter } from 'events';
import { LocalStorageService } from './local-storage.service';

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  properties: Record<string, any>;
  createdAt: string;
}

export interface GraphQuery {
  nodeLabels?: string[];
  edgeTypes?: string[];
  properties?: Record<string, any>;
  limit?: number;
  depth?: number;
}

export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  length: number;
}

export class LocalGraphService extends EventEmitter {
  private static instance: LocalGraphService;
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private nodesByLabel: Map<string, Set<string>> = new Map();
  private edgesByType: Map<string, Set<string>> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();
  private storage: LocalStorageService;
  private isInitialized = false;

  private constructor() {
    super();
    this.storage = LocalStorageService.getInstance();
  }

  static getInstance(): LocalGraphService {
    if (!LocalGraphService.instance) {
      LocalGraphService.instance = new LocalGraphService();
    }
    return LocalGraphService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.storage.initialize();
    await this.loadGraph();
    this.isInitialized = true;
    this.emit('initialized');
  }

  private async loadGraph(): Promise<void> {
    try {
      // Load nodes
      const nodeItems = await this.storage.query({ type: 'memory' });
      const graphData = nodeItems.find((item) => item.content.type === 'graph');

      if (graphData) {
        const { nodes, edges } = graphData.content.data;

        // Rebuild nodes
        for (const node of nodes) {
          this.nodes.set(node.id, node);
          for (const label of node.labels) {
            if (!this.nodesByLabel.has(label)) {
              this.nodesByLabel.set(label, new Set());
            }
            this.nodesByLabel.get(label)!.add(node.id);
          }
        }

        // Rebuild edges
        for (const edge of edges) {
          this.edges.set(edge.id, edge);
          if (!this.edgesByType.has(edge.type)) {
            this.edgesByType.set(edge.type, new Set());
          }
          this.edgesByType.get(edge.type)!.add(edge.id);

          // Build adjacency list
          if (!this.adjacencyList.has(edge.fromId)) {
            this.adjacencyList.set(edge.fromId, new Set());
          }
          this.adjacencyList.get(edge.fromId)!.add(edge.toId);
        }
      }
    } catch (error) {
      console.log('No existing graph data found, starting fresh');
    }
  }

  private async saveGraph(): Promise<void> {
    const graphData = {
      type: 'graph',
      data: {
        nodes: Array.from(this.nodes.values()),
        edges: Array.from(this.edges.values()),
      },
      stats: {
        nodeCount: this.nodes.size,
        edgeCount: this.edges.size,
        labels: Array.from(this.nodesByLabel.keys()),
        edgeTypes: Array.from(this.edgesByType.keys()),
      },
    };

    // Check if graph data exists
    const existing = await this.storage.query({ type: 'memory' });
    const graphItem = existing.find((item) => item.content.type === 'graph');

    if (graphItem) {
      await this.storage.update(graphItem.id, graphData);
    } else {
      await this.storage.create('memory', graphData);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Node operations
  async createNode(labels: string[], properties: Record<string, any> = {}): Promise<GraphNode> {
    await this.initialize();

    const node: GraphNode = {
      id: this.generateId(),
      labels,
      properties,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.nodes.set(node.id, node);

    // Update label index
    for (const label of labels) {
      if (!this.nodesByLabel.has(label)) {
        this.nodesByLabel.set(label, new Set());
      }
      this.nodesByLabel.get(label)!.add(node.id);
    }

    await this.saveGraph();
    this.emit('node-created', node);
    return node;
  }

  async updateNode(nodeId: string, properties: Record<string, any>): Promise<GraphNode | null> {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    node.properties = { ...node.properties, ...properties };
    node.updatedAt = new Date().toISOString();

    await this.saveGraph();
    this.emit('node-updated', node);
    return node;
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove from label index
    for (const label of node.labels) {
      this.nodesByLabel.get(label)?.delete(nodeId);
    }

    // Delete connected edges
    const edgesToDelete: string[] = [];
    for (const [edgeId, edge] of this.edges) {
      if (edge.fromId === nodeId || edge.toId === nodeId) {
        edgesToDelete.push(edgeId);
      }
    }

    for (const edgeId of edgesToDelete) {
      await this.deleteEdge(edgeId);
    }

    // Delete node
    this.nodes.delete(nodeId);
    this.adjacencyList.delete(nodeId);

    await this.saveGraph();
    this.emit('node-deleted', node);
    return true;
  }

  getNode(nodeId: string): GraphNode | null {
    return this.nodes.get(nodeId) || null;
  }

  getNodesByLabel(label: string): GraphNode[] {
    const nodeIds = this.nodesByLabel.get(label);
    if (!nodeIds) return [];
    return Array.from(nodeIds)
      .map((id) => this.nodes.get(id)!)
      .filter(Boolean);
  }

  // Edge operations
  async createEdge(
    type: string,
    fromId: string,
    toId: string,
    properties: Record<string, any> = {},
  ): Promise<GraphEdge | null> {
    await this.initialize();

    // Verify nodes exist
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return null;
    }

    const edge: GraphEdge = {
      id: this.generateId(),
      type,
      fromId,
      toId,
      properties,
      createdAt: new Date().toISOString(),
    };

    this.edges.set(edge.id, edge);

    // Update type index
    if (!this.edgesByType.has(type)) {
      this.edgesByType.set(type, new Set());
    }
    this.edgesByType.get(type)!.add(edge.id);

    // Update adjacency list
    if (!this.adjacencyList.has(fromId)) {
      this.adjacencyList.set(fromId, new Set());
    }
    this.adjacencyList.get(fromId)!.add(toId);

    await this.saveGraph();
    this.emit('edge-created', edge);
    return edge;
  }

  async deleteEdge(edgeId: string): Promise<boolean> {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;

    // Remove from type index
    this.edgesByType.get(edge.type)?.delete(edgeId);

    // Update adjacency list
    this.adjacencyList.get(edge.fromId)?.delete(edge.toId);

    // Delete edge
    this.edges.delete(edgeId);

    await this.saveGraph();
    this.emit('edge-deleted', edge);
    return true;
  }

  getEdge(edgeId: string): GraphEdge | null {
    return this.edges.get(edgeId) || null;
  }

  getEdgesByType(type: string): GraphEdge[] {
    const edgeIds = this.edgesByType.get(type);
    if (!edgeIds) return [];
    return Array.from(edgeIds)
      .map((id) => this.edges.get(id)!)
      .filter(Boolean);
  }

  // Query operations
  async query(query: GraphQuery): Promise<GraphNode[]> {
    await this.initialize();

    let results: GraphNode[] = [];

    // Start with nodes by label
    if (query.nodeLabels && query.nodeLabels.length > 0) {
      for (const label of query.nodeLabels) {
        results.push(...this.getNodesByLabel(label));
      }
    } else {
      results = Array.from(this.nodes.values());
    }

    // Filter by properties
    if (query.properties) {
      results = results.filter((node) => {
        for (const [key, value] of Object.entries(query.properties!)) {
          if (node.properties[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  // Path finding
  async findPath(fromId: string, toId: string, maxDepth: number = 5): Promise<GraphPath | null> {
    await this.initialize();

    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return null;
    }

    // BFS to find shortest path
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[]; edges: string[] }> = [
      { nodeId: fromId, path: [fromId], edges: [] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.path.length > maxDepth + 1) {
        continue;
      }

      if (current.nodeId === toId) {
        // Found path
        const nodes = current.path.map((id) => this.nodes.get(id)!);
        const edges: GraphEdge[] = [];

        for (let i = 0; i < current.path.length - 1; i++) {
          const fromNode = current.path[i];
          const toNode = current.path[i + 1];

          // Find edge
          for (const edge of this.edges.values()) {
            if (edge.fromId === fromNode && edge.toId === toNode) {
              edges.push(edge);
              break;
            }
          }
        }

        return {
          nodes,
          edges,
          length: current.path.length - 1,
        };
      }

      if (visited.has(current.nodeId)) {
        continue;
      }
      visited.add(current.nodeId);

      // Add neighbors
      const neighbors = this.adjacencyList.get(current.nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!current.path.includes(neighbor)) {
            queue.push({
              nodeId: neighbor,
              path: [...current.path, neighbor],
              edges: [...current.edges],
            });
          }
        }
      }
    }

    return null;
  }

  // Traversal
  async traverse(
    startId: string,
    depth: number = 2,
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    await this.initialize();

    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const nodesToVisit: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

    while (nodesToVisit.length > 0) {
      const current = nodesToVisit.shift()!;

      if (current.depth >= depth) {
        continue;
      }

      if (visitedNodes.has(current.id)) {
        continue;
      }
      visitedNodes.add(current.id);

      // Get connected nodes
      const neighbors = this.adjacencyList.get(current.id);
      if (neighbors) {
        for (const neighbor of neighbors) {
          // Find edge
          for (const edge of this.edges.values()) {
            if (edge.fromId === current.id && edge.toId === neighbor) {
              visitedEdges.add(edge.id);
              if (!visitedNodes.has(neighbor)) {
                nodesToVisit.push({ id: neighbor, depth: current.depth + 1 });
              }
              break;
            }
          }
        }
      }

      // Also check incoming edges
      for (const edge of this.edges.values()) {
        if (edge.toId === current.id && !visitedEdges.has(edge.id)) {
          visitedEdges.add(edge.id);
          if (!visitedNodes.has(edge.fromId)) {
            nodesToVisit.push({ id: edge.fromId, depth: current.depth + 1 });
          }
        }
      }
    }

    return {
      nodes: Array.from(visitedNodes)
        .map((id) => this.nodes.get(id)!)
        .filter(Boolean),
      edges: Array.from(visitedEdges)
        .map((id) => this.edges.get(id)!)
        .filter(Boolean),
    };
  }

  // Statistics
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    labels: string[];
    edgeTypes: string[];
    avgDegree: number;
  } {
    const totalDegree = Array.from(this.adjacencyList.values()).reduce(
      (sum, neighbors) => sum + neighbors.size,
      0,
    );

    const avgDegree = this.nodes.size > 0 ? totalDegree / this.nodes.size : 0;

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      labels: Array.from(this.nodesByLabel.keys()),
      edgeTypes: Array.from(this.edgesByType.keys()),
      avgDegree,
    };
  }

  // Clear graph
  async clear(): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
    this.nodesByLabel.clear();
    this.edgesByType.clear();
    this.adjacencyList.clear();

    await this.saveGraph();
    this.emit('graph-cleared');
  }

  // Export/Import
  exportGraph(): {
    nodes: GraphNode[];
    edges: GraphEdge[];
  } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  async importGraph(data: { nodes: GraphNode[]; edges: GraphEdge[] }): Promise<void> {
    await this.clear();

    for (const node of data.nodes) {
      this.nodes.set(node.id, node);
      for (const label of node.labels) {
        if (!this.nodesByLabel.has(label)) {
          this.nodesByLabel.set(label, new Set());
        }
        this.nodesByLabel.get(label)!.add(node.id);
      }
    }

    for (const edge of data.edges) {
      this.edges.set(edge.id, edge);
      if (!this.edgesByType.has(edge.type)) {
        this.edgesByType.set(edge.type, new Set());
      }
      this.edgesByType.get(edge.type)!.add(edge.id);

      if (!this.adjacencyList.has(edge.fromId)) {
        this.adjacencyList.set(edge.fromId, new Set());
      }
      this.adjacencyList.get(edge.fromId)!.add(edge.toId);
    }

    await this.saveGraph();
    this.emit('graph-imported', data);
  }
}

export const localGraph = LocalGraphService.getInstance();
