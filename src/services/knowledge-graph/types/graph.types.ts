/**
 * Phase 4.2 Knowledge Graph - Type Definitions
 * Lightweight graph engine for code understanding and dependency analysis
 */

export interface CodeNode {
  id: string;
  type: "file" | "function" | "class" | "module";
  name: string;
  _path: string;
  metadata: {
    size: number;
    complexity?: number;
    lastModified: Date;
    language: string;
    patternHints?: string[]; // Maps to Phase 4.1 pattern IDs
    usage?: number;
    lastAccessed?: Date;
  };
}

export interface Edge {
  from: string;
  to: string;
  type: EdgeType;
  weight: number; // 0-1, importance/frequency
  metadata?: {
    count?: number;
    lastSeen?: Date;
  };
}

export interface EdgeType {
  type: "imports" | "calls" | "extends" | "uses";
  weight: number;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  averageDegree: number;
  maxDepth: number;
  memoryUsage: number;
  indexSize: number;
  queryPerformance: {
    averageTime: number;
    lastQueryTime: number;
  };
}

export interface Dependencies {
  imports: ImportInfo[];
  exports: ExportInfo[];
  calls: string[];
  fileMetadata: {
    _path: string;
    language: string;
    size: number;
    lastModified: Date;
  };
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isDefault?: boolean;
  isNamespace?: boolean;
}

export interface _ExportInfo {
  name: string;
  type: "function" | "class" | "variable" | "type" | "default";
  isDefault?: boolean;
}

export interface GraphContext {
  nodes: CodeNode[];
  edges: Edge[];
  depth: number;
  traversalTime: number;
}

export interface AugmentedContext {
  query: string;
  patterns: any[]; // From Phase 4.1
  graphNodes: CodeNode[];
  relationships: Edge[];
  suggestions: Suggestion[];
  confidence: number;
}

export interface Suggestion {
  type: "file" | "function" | "pattern";
  content: string;
  confidence: number;
  source: "graph" | "pattern" | "hybrid";
  reasoning: string;
}

export interface GraphEngineConfig {
  maxNodes: number;
  maxEdgesPerNode: number;
  enableIndexing: boolean;
  persistenceEnabled: boolean;
  queryTimeout: number;
}

export interface QueryOptions {
  maxDepth?: number;
  maxResults?: number;
  timeout?: number;
  includeMetadata?: boolean;
}
