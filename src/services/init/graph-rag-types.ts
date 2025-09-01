/**
 * Type definitions for Graph RAG enhanced /init and /update commands
 */

// Scanner Types
export interface ScanOptions {
  root: string;
  skipDocs?: boolean;
  skipTests?: boolean;
  maxDepth?: number;
  parallel?: number;
  budgetMs?: number;
  files?: string[]; // Specific files to scan
}

export interface FileInfo {
  _path: string;
  size: number;
  language?: string;
  hash?: string;
  content?: string;
  summary?: string;
  complexity?: number;
  dependencies?: Dependency[];
  symbols?: symbol[];
  lastModified?: number;
}

export interface Symbol {
  name: string;
  type: "class" | "function" | "interface" | "type" | "variable" | "enum";
  line?: number;
  exported?: boolean;
  dependencies?: string[];
}

export interface Dependency {
  _path: string;
  type: "import" | "require" | "dynamic" | "reference";
  line?: number;
  specifier?: string;
}

export interface CodeStructure {
  root: string;
  files: FileInfo[];
  dependencies: Dependency[];
  circularDeps: string[][];
  stats: ScanStats;
  techStack: string[];
  language?: string;
  moduleSystem?: string;
  packageManager?: string;
  hasTypeScript?: boolean;
  hasESLint?: boolean;
  testFiles?: FileInfo[];
  testFramework?: string;
  directories?: string[];
  entryPoints?: Array<{ _path: string; description?: string }>;
  importantFiles?: Array<{ _path: string; reason: string }>;
  scripts?: Record<string, string>;
  warnings?: string[];
}

export interface ScanStats {
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  avgComplexity?: number;
  scanTimeMs: number;
}

// Delta Detection Types
export interface DeltaOptions {
  since: string; // 'git:HEAD~1' | '2025-08-26' | 'state'
  state?: MariaState | null;
  verbose?: boolean;
}

export interface DeltaResult {
  files: Array<{
    _path: string;
    type: "added" | "modified" | "deleted";
    reason?: string;
    lastModified?: number;
    hash?: string;
  }>;
  unchanged?: number;
  root: string;
  since: string;
  timestamp: string;
}

// State Persistence Types
export interface MariaState {
  version: string;
  timestamp: string;
  root: string;
  lastScan?: string;
  lastUpdate?: {
    timestamp: string;
    delta: DeltaDiff;
    filesProcessed: number;
  };
  fileHashes: Record<string, string> | Map<string, string>;
  stats: {
    totalFiles?: number;
    totalLines?: number;
    totalNodes?: number;
    totalEdges?: number;
    lastAnalysisTime?: number;
  };
  services?: {
    neo4j?: boolean;
    openSearch?: boolean;
    qdrant?: boolean;
    knowledgeGraph?: boolean;
  };
  config?: {
    skipDocs?: boolean;
    skipTests?: boolean;
    maxDepth?: number;
    parallel?: number;
  };
}

export interface DeltaDiff {
  added: number;
  modified: number;
  deleted: number;
  unchanged: number;
}

// Service Client Types
export interface Doc {
  id: string;
  doc: Record<string, any>;
}

export interface Point {
  id: string;
  vector: number[];
  payload?: Record<string, any>;
}

export interface GraphNode {
  id: string;
  type: string;
  name: string;
  properties?: Record<string, any>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: string;
  properties?: Record<string, any>;
}

export interface GraphDiff {
  nodes?: {
    upsert?: GraphNode[];
    delete?: string[];
  };
  edges?: {
    upsert?: GraphEdge[];
    delete?: Array<{ from: string; to: string; type?: string }>;
  };
}

// Enhanced Scanner Types (AST-based)
export interface ASTParseResult {
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  variables: VariableInfo[];
}

export interface ImportInfo {
  source: string;
  specifiers: Array<{
    name: string;
    type: "default" | "named" | "namespace";
    alias?: string;
  }>;
  isDynamic?: boolean;
  line: number;
}

export interface ExportInfo {
  name: string;
  type: "default" | "named";
  line: number;
  isReExport?: boolean;
  source?: string;
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType?: string;
  isAsync?: boolean;
  isExported?: boolean;
  line: number;
  complexity?: number;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements?: string[];
  methods: string[];
  properties: string[];
  isExported?: boolean;
  line: number;
}

export interface InterfaceInfo {
  name: string;
  extends?: string[];
  properties: Array<{
    name: string;
    type?: string;
    optional?: boolean;
  }>;
  line: number;
}

export interface TypeInfo {
  name: string;
  definition: string;
  line: number;
}

export interface VariableInfo {
  name: string;
  type?: string;
  isConst?: boolean;
  isExported?: boolean;
  line: number;
}
