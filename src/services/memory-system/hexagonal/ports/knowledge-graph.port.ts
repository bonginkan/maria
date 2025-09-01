/**
 * Knowledge Graph Port
 * Defines the contract for knowledge graph operations
 */

export interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, any>;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight?: number;
  properties: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalWeight: number;
  length: number;
}

export interface GraphQuery {
  startNodeId?: string;
  nodeTypes?: string[];
  edgeTypes?: string[];
  maxDepth?: number;
  minWeight?: number;
  maxWeight?: number;
  properties?: Record<string, any>;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  averageConnectivity: number;
  connectedComponents: number;
  density: number;
}

export interface GraphUpdate {
  addNodes?: Omit<GraphNode, "id" | "createdAt" | "updatedAt">[];
  updateNodes?: Array<{ _id: string; updates: Partial<GraphNode> }>;
  removeNodes?: string[];
  addEdges?: Omit<GraphEdge, "id" | "createdAt" | "updatedAt">[];
  updateEdges?: Array<{ _id: string; updates: Partial<GraphEdge> }>;
  removeEdges?: string[];
}

/**
 * Primary port for knowledge graph operations
 */
export interface IKnowledgeGraphPort {
  /**
   * Add a node to the graph
   */
  addNode(
    _node: Omit<GraphNode, "id" | "createdAt" | "updatedAt">,
  ): Promise<GraphNode>;

  /**
   * Get node by ID
   */
  getNode(id: string): Promise<GraphNode | null>;

  /**
   * Update node
   */
  updateNode(
    _id: string,
    updates: Partial<GraphNode>,
  ): Promise<GraphNode | null>;

  /**
   * Remove node and its edges
   */
  removeNode(id: string): Promise<boolean>;

  /**
   * Add an edge between nodes
   */
  addEdge(
    _edge: Omit<GraphEdge, "id" | "createdAt" | "updatedAt">,
  ): Promise<GraphEdge>;

  /**
   * Get edge by ID
   */
  getEdge(id: string): Promise<GraphEdge | null>;

  /**
   * Update edge
   */
  updateEdge(
    _id: string,
    updates: Partial<GraphEdge>,
  ): Promise<GraphEdge | null>;

  /**
   * Remove edge
   */
  removeEdge(id: string): Promise<boolean>;

  /**
   * Find nodes by criteria
   */
  findNodes(
    _query: GraphQuery,
    limit?: number,
    offset?: number,
  ): Promise<GraphNode[]>;

  /**
   * Find edges by criteria
   */
  findEdges(
    _query: GraphQuery,
    limit?: number,
    offset?: number,
  ): Promise<GraphEdge[]>;

  /**
   * Get neighbors of a node
   */
  getNeighbors(
    nodeId: string,
    direction?: "incoming" | "outgoing" | "both",
    edgeTypes?: string[],
    depth?: number,
  ): Promise<GraphNode[]>;

  /**
   * Get connected edges for a node
   */
  getConnectedEdges(
    nodeId: string,
    direction?: "incoming" | "outgoing" | "both",
    edgeTypes?: string[],
  ): Promise<GraphEdge[]>;

  /**
   * Find shortest path between two nodes
   */
  findShortestPath(
    sourceId: string,
    targetId: string,
    maxDepth?: number,
    edgeTypes?: string[],
  ): Promise<GraphPath | null>;

  /**
   * Find all paths between two nodes
   */
  findPaths(
    sourceId: string,
    targetId: string,
    maxDepth?: number,
    maxPaths?: number,
    edgeTypes?: string[],
  ): Promise<GraphPath[]>;

  /**
   * Get subgraph around a node
   */
  getSubgraph(
    centerNodeId: string,
    radius: number,
    nodeTypes?: string[],
    edgeTypes?: string[],
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;

  /**
   * Search nodes by text
   */
  searchNodes(
    query: string,
    searchFields?: string[],
    nodeTypes?: string[],
    limit?: number,
  ): Promise<GraphNode[]>;

  /**
   * Get graph statistics
   */
  getStats(nodeTypes?: string[], edgeTypes?: string[]): Promise<GraphStats>;

  /**
   * Batch update operations
   */
  batchUpdate(update: GraphUpdate): Promise<{
    addedNodes: GraphNode[];
    updatedNodes: GraphNode[];
    removedNodes: string[];
    addedEdges: GraphEdge[];
    updatedEdges: GraphEdge[];
    removedEdges: string[];
  }>;

  /**
   * Export graph data
   */
  exportGraph(format: "json" | "csv" | "gml" | "graphml"): Promise<string>;

  /**
   * Import graph data
   */
  importGraph(
    _data: string,
    format: "json" | "csv" | "gml" | "graphml",
  ): Promise<{
    nodesImported: number;
    edgesImported: number;
  }>;

  /**
   * Validate graph integrity
   */
  validateGraph(): Promise<{
    isValid: boolean;
    issues: Array<{
      type: string;
      description: string;
      nodeId?: string;
      edgeId?: string;
    }>;
  }>;

  /**
   * Transaction support
   */
  transaction<T>(
    _operation: (graph: IKnowledgeGraphPort) => Promise<T>,
  ): Promise<T>;

  /**
   * Health check
   */
  healthCheck(): Promise<{ isHealthy: boolean; details?: Record<string, any> }>;
}
