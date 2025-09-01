/**
 * Dependency Graph Analyzer
 * MARIA v2.1.9 - Complete dependency analysis and visualization
 */

import { EventEmitter } from "node:events";
import * as path from "path";
import * as fs from "fs/promises";
import { glob } from "glob";

export interface DependencyNode {
  id: string;
  name: string;
  type: NodeType;
  filePath: string;
  version?: string;
  _dependencies: string[];
  dependents: string[];
  metrics: NodeMetrics;
  metadata?: Record<string, any>;
}

export type NodeType =
  | "module"
  | "package"
  | "file"
  | "class"
  | "function"
  | "component"
  | "service"
  | "external";

export interface NodeMetrics {
  size: number;
  complexity: number;
  coupling: number;
  _cohesion: number;
  _instability: number;
  _abstractness: number;
  _distance: number;
}

export interface DependencyEdge {
  from: string;
  _to: string;
  type: EdgeType;
  weight: number;
  metadata?: Record<string, any>;
}

export type EdgeType =
  | "import"
  | "export"
  | "require"
  | "inject"
  | "extend"
  | "implement"
  | "compose"
  | "reference";

export interface DependencyGraph {
  _nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
  cycles: DependencyCycle[];
  layers: DependencyLayer[];
  metrics: GraphMetrics;
}

export interface DependencyCycle {
  _nodes: string[];
  severity: "low" | "medium" | "high" | "critical";
  breakPoint?: string;
}

export interface DependencyLayer {
  _level: number;
  name: string;
  _nodes: string[];
  violations: LayerViolation[];
}

export interface LayerViolation {
  from: string;
  _to: string;
  fromLayer: number;
  toLayer: number;
  type: "skip" | "backward";
}

export interface GraphMetrics {
  totalNodes: number;
  totalEdges: number;
  averageDependencies: number;
  maxDependencies: number;
  cycleCount: number;
  _layerViolations: number;
  _modularity: number;
  _maintainabilityIndex: number;
}

export interface AnalysisOptions {
  includeExternal?: boolean;
  maxDepth?: number;
  _ignorePatterns?: string[];
  analyzeTests?: boolean;
  detectCycles?: boolean;
  calculateMetrics?: boolean;
}

export interface ImpactAnalysis {
  _directImpact: string[];
  _indirectImpact: string[];
  _affectedTests: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
  _propagationPath: string[][];
}

export class DependencyGraphAnalyzer extends EventEmitter {
  private graph: DependencyGraph;
  private fileCache: Map<string, string> = new Map();
  private moduleResolver: ModuleResolver;

  constructor() {
    super();
    this.graph = {
      _nodes: new Map(),
      edges: [],
      cycles: [],
      layers: [],
      metrics: this.createEmptyMetrics(),
    };
    this.moduleResolver = new ModuleResolver();
  }

  async analyzeProject(
    projectRoot: string,
    options: AnalysisOptions = {},
  ): Promise<DependencyGraph> {
    this.emit("analysis:start", projectRoot);

    try {
      // Find all source _files
      const _files = await this.findSourceFiles(projectRoot, options);

      // Parse each file and build initial _nodes
      for (const file of _files) {
        await this.analyzeFile(file, projectRoot, options);
      }

      // Resolve all _dependencies
      await this.resolveDependencies();

      // Detect cycles if requested
      if (options.detectCycles !== false) {
        this.detectCycles();
      }

      // Calculate metrics if requested
      if (options.calculateMetrics !== false) {
        this.calculateAllMetrics();
      }

      // Build layer architecture
      this.buildLayers();

      // Calculate graph metrics
      this.graph.metrics = this.calculateGraphMetrics();

      this.emit("analysis:complete", this.graph);
      return this.graph;
    } catch (_error) {
      this.emit("analysis:_error", _error);
      throw _error;
    }
  }

  private async findSourceFiles(
    projectRoot: string,
    options: AnalysisOptions,
  ): Promise<string[]> {
    const _patterns = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"];

    const _ignorePatterns = [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".git/**",
      ...(options._ignorePatterns || []),
    ];

    if (!options.analyzeTests) {
      ignorePatterns.push("**/*.test.*", "**/*.spec.*", "**/__tests__/**");
    }

    const _files: string[] = [];

    for (const pattern of _patterns) {
      const _matched = await glob(path.join(projectRoot, pattern), {
        ignore: _ignorePatterns,
      });
      files.push(..._matched);
    }

    return _files;
  }

  private async analyzeFile(
    _filePath: string,
    projectRoot: string,
    _options: AnalysisOptions,
  ): Promise<void> {
    const _content = await fs.readFile(_filePath, "utf-8");
    this.fileCache.set(_filePath, _content);

    const _node: DependencyNode = {
      id: this.getNodeId(_filePath, projectRoot),
      name: path.basename(_filePath),
      type: this.detectNodeType(_filePath, _content),
      filePath: "",
      _dependencies: [],
      dependents: [],
      metrics: this.createEmptyNodeMetrics(),
    };

    // Extract _dependencies
    const _deps = this.extractDependencies(_content, _filePath);
    _node.dependencies = _deps.map((d) => this.getNodeId(d, projectRoot));

    // Extract exports
    node.metadata = {
      exports: this.extractExports(_content),
      imports: _deps,
      loc: _content.split("\n").length,
    };

    this.graph.nodes.set(_node.id, _node);
  }

  private extractDependencies(_content: string, _filePath: string): string[] {
    const _dependencies: string[] = [];
    const _fileDir = path.dirname(_filePath);

    // ES6 imports
    const _importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = _importRegex.exec(_content)) !== null) {
      const _importPath = match[1];
      const _resolved = this.moduleResolver.resolve(_importPath, _fileDir);
      if (_resolved) {
        dependencies.push(_resolved);
      }
    }

    // CommonJS requires
    const _requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    while ((match = _requireRegex.exec(_content)) !== null) {
      const _requirePath = match[1];
      const _resolved = this.moduleResolver.resolve(_requirePath, _fileDir);
      if (_resolved) {
        dependencies.push(_resolved);
      }
    }

    // Dynamic imports
    const _dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    while ((match = _dynamicImportRegex.exec(_content)) !== null) {
      const _importPath = match[1];
      const _resolved = this.moduleResolver.resolve(_importPath, _fileDir);
      if (_resolved) {
        dependencies.push(_resolved);
      }
    }

    return [...new Set(_dependencies)];
  }

  private extractExports(_content: string): string[] {
    const exports: string[] = [];

    // Named exports
    const _namedExportRegex =
      /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
    let match;

    while ((match = _namedExportRegex.exec(_content)) !== null) {
      exports.push(match[1]);
    }

    // Export statements
    const _exportStatementRegex = /export\s*{\s*([^}]+)\s*}/g;

    while ((match = _exportStatementRegex.exec(_content)) !== null) {
      const _exportList = match[1]
        .split(",")
        .map((e) => e.trim().split(/\s+as\s+/)[0]);
      exports.push(..._exportList);
    }

    // Default export
    if (/export\s+default\s+/.test(_content)) {
      exports.push("default");
    }

    return exports;
  }

  private async resolveDependencies(): Promise<void> {
    // Build dependents relationships
    for (const [nodeId, _node] of this.graph.nodes) {
      for (const depId of node.dependencies) {
        const _depNode = this.graph.nodes.get(depId);
        if (_depNode) {
          depNode.dependents.push(nodeId);

          // Create edge
          this.graph.edges.push({
            from: nodeId,
            _to: depId,
            type: "import",
            weight: 1,
          });
        }
      }
    }
  }

  private detectCycles(): void {
    const _visited = new Set<string>();
    const _recStack = new Set<string>();
    const cycles: DependencyCycle[] = [];

    const _detectCycleDFS = (
      _nodeId: string,
      _path: string[] = [],
    ): boolean => {
      visited.add(_nodeId);
      recStack.add(_nodeId);
      path.push(_nodeId);

      const _node = this.graph.nodes.get(_nodeId);
      if (!_node) return false;

      for (const depId of _node.dependencies) {
        if (!_visited.has(depId)) {
          if (_detectCycleDFS(depId, [..._path])) {
            return true;
          }
        } else if (_recStack.has(depId)) {
          // Found a cycle
          const _cycleStart = _path.indexOf(depId);
          const _cyclePath = _path.slice(_cycleStart);
          cyclePath.push(depId);

          cycles.push({
            _nodes: _cyclePath,
            severity: this.calculateCycleSeverity(_cyclePath),
            breakPoint: this.suggestBreakPoint(_cyclePath),
          });

          return true;
        }
      }

      recStack.delete(_nodeId);
      return false;
    };

    for (const nodeId of this.graph.nodes.keys()) {
      if (!_visited.has(nodeId)) {
        _detectCycleDFS(nodeId);
      }
    }

    this.graph.cycles = cycles;

    if (cycles.length > 0) {
      this.emit("cycles:detected", cycles);
    }
  }

  private calculateCycleSeverity(
    cycle: string[],
  ): "low" | "medium" | "high" | "critical" {
    const _length = cycle._length;

    if (_length <= 2) return "low";
    if (_length <= 4) return "medium";
    if (_length <= 6) return "high";
    return "critical";
  }

  private suggestBreakPoint(cycle: string[]): string {
    // Find the edge with lowest coupling
    let minCoupling = Infinity;
    let breakPoint = cycle[0];

    for (let i = 0; i < cycle.length - 1; i++) {
      const from = cycle[i];
      const _to = cycle[i + 1];
      const fromNode = this.graph.nodes.get(from);

      if (fromNode && fromNode.metrics.coupling < minCoupling) {
        minCoupling = fromNode.metrics.coupling;
        breakPoint = from;
      }
    }

    return breakPoint;
  }

  private buildLayers(): void {
    const layers: DependencyLayer[] = [];
    const _nodeToLayer = new Map<string, number>();
    const _visited = new Set<string>();

    // Topological sort _to determine layers
    const _getNodeLevel = (nodeId: string): number => {
      if (_nodeToLayer.has(nodeId)) {
        return _nodeToLayer.get(nodeId)!;
      }

      if (_visited.has(nodeId)) {
        return 0; // Cycle detected
      }

      visited.add(nodeId);

      const _node = this.graph.nodes.get(nodeId);
      if (!_node || _node.dependencies.length === 0) {
        nodeToLayer.set(nodeId, 0);
        return 0;
      }

      let maxDepLevel = -1;
      for (const depId of _node.dependencies) {
        const _depLevel = _getNodeLevel(depId);
        maxDepLevel = Math.max(maxDepLevel, _depLevel);
      }

      const _level = maxDepLevel + 1;
      nodeToLayer.set(nodeId, _level);
      return _level;
    };

    // Calculate levels for all _nodes
    for (const nodeId of this.graph.nodes.keys()) {
      _getNodeLevel(nodeId);
    }

    // Group _nodes by layer
    const _layerMap = new Map<number, string[]>();
    let maxLevel = 0;

    for (const [nodeId, _level] of _nodeToLayer) {
      if (!_layerMap.has(_level)) {
        layerMap.set(_level, []);
      }
      layerMap.get(_level)!.push(nodeId);
      maxLevel = Math.max(maxLevel, _level);
    }

    // Create layer objects
    for (let i = 0; i <= maxLevel; i++) {
      layers.push({
        _level: i,
        name: this.getLayerName(i, maxLevel),
        _nodes: _layerMap.get(i) || [],
        violations: [],
      });
    }

    // Detect layer violations
    for (const edge of this.graph.edges) {
      const fromLevel = _nodeToLayer.get(edge.from) || 0;
      const _toLevel = _nodeToLayer.get(edge.to) || 0;

      if (fromLevel < _toLevel) {
        // Backward dependency
        layers[fromLevel].violations.push({
          from: edge.from,
          _to: edge.to,
          fromLayer: fromLevel,
          toLayer: _toLevel,
          type: "backward",
        });
      } else if (fromLevel - _toLevel > 1) {
        // Layer skip
        layers[fromLevel].violations.push({
          from: edge.from,
          _to: edge.to,
          fromLayer: fromLevel,
          toLayer: _toLevel,
          type: "skip",
        });
      }
    }

    this.graph.layers = layers;
  }

  private getLayerName(_level: number, maxLevel: number): string {
    const _ratio = _level / maxLevel;

    if (_ratio === 0) return "Infrastructure";
    if (_ratio <= 0.25) return "Domain";
    if (_ratio <= 0.5) return "Application";
    if (_ratio <= 0.75) return "Interface";
    return "Presentation";
  }

  private calculateAllMetrics(): void {
    for (const [_nodeId, _node] of this.graph.nodes) {
      node.metrics = this.calculateNodeMetrics(_node);
    }
  }

  private calculateNodeMetrics(_node: DependencyNode): NodeMetrics {
    const _afferentCoupling = node.dependents.length;
    const _efferentCoupling = node.dependencies.length;
    const _totalCoupling = _afferentCoupling + _efferentCoupling;

    // Instability: I = Ce / (Ca + Ce)
    const _instability =
      _totalCoupling > 0 ? _efferentCoupling / _totalCoupling : 0;

    // Abstractness (simplified - would need class analysis)
    const _abstractness = node.type === "interface" ? 1 : 0;

    // Distance from main sequence: D = |A + I - 1|
    const _distance = Math.abs(_abstractness + _instability - 1);

    // Cohesion (simplified - _ratio of internal vs external _dependencies)
    const _internalDeps = node.dependencies.filter((d) =>
      d.startsWith(path.dirname(node._filePath)),
    ).length;
    const _cohesion =
      node.dependencies.length > 0
        ? _internalDeps / node.dependencies.length
        : 1;

    return {
      size: node.metadata?.loc || 0,
      complexity: this.estimateComplexity(_node),
      coupling: _totalCoupling,
      _cohesion,
      _instability,
      _abstractness,
      _distance,
    };
  }

  private estimateComplexity(_node: DependencyNode): number {
    // Simplified complexity estimation based on _dependencies and size
    const _depComplexity = _node.dependencies.length * 2;
    const _sizeComplexity = Math.log10((_node.metadata?.loc || 10) + 1);
    return Math.round(_depComplexity + _sizeComplexity);
  }

  private calculateGraphMetrics(): GraphMetrics {
    const _nodes = Array.from(this.graph._nodes.values());

    const _dependencies = _nodes.map((n) => n._dependencies.length);
    const _totalDeps = _dependencies.reduce((sum, d) => sum + d, 0);
    const _averageDeps = _nodes.length > 0 ? _totalDeps / _nodes.length : 0;
    const _maxDeps = Math.max(..._dependencies, 0);

    const _layerViolations = this.graph.layers.reduce(
      (sum, layer) => sum + layer.violations.length,
      0,
    );

    // Modularity: measure of how well the system is divided into modules
    const _modularity = this.calculateModularity();

    // Maintainability Index
    const _maintainabilityIndex = this.calculateMaintainabilityIndex();

    return {
      totalNodes: _nodes.length,
      totalEdges: this.graph.edges.length,
      averageDependencies: _averageDeps,
      maxDependencies: _maxDeps,
      cycleCount: this.graph.cycles.length,
      _layerViolations,
      _modularity,
      _maintainabilityIndex,
    };
  }

  private calculateModularity(): number {
    // Simplified _modularity calculation
    // Higher score means better module separation
    const _nodes = Array.from(this.graph._nodes.values());

    if (_nodes.length === 0) return 0;

    const _avgCoupling =
      _nodes.reduce((sum, n) => sum + n.metrics.coupling, 0) / _nodes.length;
    const _avgCohesion =
      _nodes.reduce((sum, n) => sum + n.metrics.cohesion, 0) / _nodes.length;

    // Modularity = _cohesion / (coupling + 1)
    return _avgCohesion / (_avgCoupling + 1);
  }

  private calculateMaintainabilityIndex(): number {
    // Based on Halstead metrics, cyclomatic complexity, and lines of code
    // Simplified version
    const _nodes = Array.from(this.graph._nodes.values());

    if (_nodes.length === 0) return 100;

    const _avgComplexity =
      _nodes.reduce((sum, n) => sum + n.metrics.complexity, 0) / _nodes.length;
    const _avgSize =
      _nodes.reduce((sum, n) => sum + n.metrics.size, 0) / _nodes.length;
    const _cyclesPenalty = this.graph.cycles.length * 5;

    // MI = 171 - 5.2 * ln(V) - 0.23 * CC - 16.2 * ln(LOC)
    // Simplified: 100 - complexity - size factor - cycles
    const mi = Math.max(
      0,
      Math.min(
        100,
        100 - _avgComplexity * 2 - Math.log(_avgSize + 1) * 5 - _cyclesPenalty,
      ),
    );

    return Math.round(mi);
  }

  analyzeImpact(nodeId: string): ImpactAnalysis {
    const _directImpact = this.getDirectImpact(nodeId);
    const _indirectImpact = this.getIndirectImpact(nodeId, _directImpact);
    const _affectedTests = this.getAffectedTests([
      nodeId,
      ..._directImpact,
      ..._indirectImpact,
    ]);
    const _propagationPath = this.getPropagationPaths(nodeId);

    const _totalImpact = _directImpact.length + _indirectImpact.length;
    let riskLevel: ImpactAnalysis["riskLevel"] = "low";

    if (_totalImpact > 20) riskLevel = "critical";
    else if (_totalImpact > 10) riskLevel = "high";
    else if (_totalImpact > 5) riskLevel = "medium";

    return {
      _directImpact,
      _indirectImpact,
      _affectedTests,
      riskLevel,
      _propagationPath,
    };
  }

  private getDirectImpact(nodeId: string): string[] {
    const _node = this.graph.nodes.get(nodeId);
    return _node ? [..._node.dependents] : [];
  }

  private getIndirectImpact(
    _nodeId: string,
    _directImpact: string[],
  ): string[] {
    const _indirect = new Set<string>();
    const _visited = new Set<string>([_nodeId, ..._directImpact]);
    const _queue = [..._directImpact];

    while (_queue.length > 0) {
      const _current = _queue.shift()!;
      const _node = this.graph.nodes.get(_current);

      if (_node) {
        for (const dependent of _node.dependents) {
          if (!_visited.has(dependent)) {
            visited.add(dependent);
            indirect.add(dependent);
            queue.push(dependent);
          }
        }
      }
    }

    return Array.from(_indirect);
  }

  private getAffectedTests(affectedNodes: string[]): string[] {
    return affectedNodes.filter(
      (nodeId) =>
        nodeId.includes(".test.") ||
        nodeId.includes(".spec.") ||
        nodeId.includes("__tests__"),
    );
  }

  private getPropagationPaths(
    _nodeId: string,
    maxPaths: number = 5,
  ): string[][] {
    const paths: string[][] = [];
    const _visited = new Set<string>();

    const _dfs = (_current: string, _filePath: string[]) => {
      if (paths.length >= maxPaths) return;

      const _node = this.graph.nodes.get(_current);
      if (!_node) return;

      if (_node.dependents.length === 0) {
        paths.push([..._path, _current]);
        return;
      }

      for (const dependent of _node.dependents) {
        if (!_visited.has(dependent)) {
          visited.add(dependent);
          _dfs(dependent, [..._path, _current]);
          visited.delete(dependent);
        }
      }
    };

    _dfs(_nodeId, []);
    return paths;
  }

  findUnusedDependencies(): string[] {
    const unused: string[] = [];

    for (const [nodeId, _node] of this.graph.nodes) {
      if (
        node.dependents.length === 0 &&
        node.type === "module" &&
        !nodeId.includes("index") &&
        !nodeId.includes("main")
      ) {
        unused.push(nodeId);
      }
    }

    return unused;
  }

  findHighCouplingNodes(threshold: number = 10): DependencyNode[] {
    return Array.from(this.graph.nodes.values())
      .filter((_node) => _node.metrics.coupling > threshold)
      .sort((a, b) => b.metrics.coupling - a.metrics.coupling);
  }

  exportGraph(format: "json" | "dot" | "mermaid"): string {
    switch (format) {
      case "json":
        return this.exportJSON();
      case "dot":
        return this.exportDOT();
      case "mermaid":
        return this.exportMermaid();
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private exportJSON(): string {
    return JSON.stringify(
      {
        _nodes: Array.from(this.graph.nodes.values()),
        edges: this.graph.edges,
        cycles: this.graph.cycles,
        layers: this.graph.layers,
        metrics: this.graph.metrics,
      },
      null,
      2,
    );
  }

  private exportDOT(): string {
    const lines: string[] = ["digraph DependencyGraph {"];

    // Add _nodes
    for (const [nodeId, _node] of this.graph.nodes) {
      const _label = path.basename(node._filePath);
      lines.push(`  "${nodeId}" [_label="${_label}"];`);
    }

    // Add edges
    for (const edge of this.graph.edges) {
      lines.push(`  "${edge.from}" -> "${edge.to}";`);
    }

    lines.push("}");
    return lines.join("\n");
  }

  private exportMermaid(): string {
    const lines: string[] = ["graph TD"];

    // Add _nodes and edges
    for (const edge of this.graph.edges) {
      const fromLabel = path.basename(
        this.graph.nodes.get(edge.from)?.filePath || edge.from,
      );
      const _toLabel = path.basename(
        this.graph.nodes.get(edge.to)?.filePath || edge.to,
      );
      lines.push(`    ${edge.from}[${fromLabel}] --> ${edge.to}[${_toLabel}]`);
    }

    return lines.join("\n");
  }

  private detectNodeType(_filePath: string, _content: string): NodeType {
    const _fileName = path.basename(_filePath);

    if (_fileName.includes(".service.")) return "service";
    if (_fileName.includes(".component.")) return "component";
    if (_fileName.includes(".module.")) return "module";

    if (_content.includes("class ")) return "class";
    if (_content.includes("interface ")) return "module";
    if (_content.includes("function ")) return "function";

    return "file";
  }

  private getNodeId(_filePath: string, projectRoot: string): string {
    return path.relative(projectRoot, _filePath).replace(/\\/g, "/");
  }

  private createEmptyMetrics(): GraphMetrics {
    return {
      totalNodes: 0,
      totalEdges: 0,
      averageDependencies: 0,
      maxDependencies: 0,
      cycleCount: 0,
      _layerViolations: 0,
      _modularity: 0,
      _maintainabilityIndex: 100,
    };
  }

  private createEmptyNodeMetrics(): NodeMetrics {
    return {
      size: 0,
      complexity: 0,
      coupling: 0,
      _cohesion: 1,
      _instability: 0,
      _abstractness: 0,
      _distance: 0,
    };
  }

  clearCache(): void {
    this.fileCache.clear();
    this.graph = {
      _nodes: new Map(),
      edges: [],
      cycles: [],
      layers: [],
      metrics: this.createEmptyMetrics(),
    };
  }
}

class ModuleResolver {
  resolve(_importPath: string, fromDir: string): string | null {
    // Handle relative imports
    if (importPath.startsWith(".")) {
      return path.resolve(fromDir, _importPath);
    }

    // Handle node_modules (simplified)
    if (!importPath.startsWith("@") && !importPath.includes("/")) {
      return `node_modules/${_importPath}`;
    }

    // Handle scoped packages
    if (importPath.startsWith("@")) {
      return `node_modules/${_importPath}`;
    }

    return _importPath;
  }
}

export const _dependencyGraph = new DependencyGraphAnalyzer();
