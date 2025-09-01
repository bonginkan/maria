/**
 * ParallelGenerator - Multi-file code generation with dependency resolution
 * Optimizes generation by processing files in parallel based on dependency graph
 */

import { EventEmitter } from "node:events";

export interface FileSpec {
  path: string;
  content?: string;
  prompt?: string;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface MultiFileRequest {
  files: FileSpec[];
  options?: {
    maxConcurrency?: number;
    timeout?: number;
    errorHandling?: "continue" | "stop" | "skip";
  };
}

export interface GeneratedFile {
  path: string;
  content: string;
  dependencies: string[];
  generationTime: number;
  size: number;
  success: boolean;
  error?: string;
}

export interface DependencyGraph {
  nodes: Set<string>;
  edges: Map<string, Set<string>>;
  inDegree: Map<string, number>;
}

export interface ParallelGenerationMetrics {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  averageGenerationTime: number;
  parallelSpeedup: number;
  resourceUtilization: number;
  totalTime: number;
}

/**
 * Generates multiple files in parallel while respecting dependencies
 */
export class ParallelGenerator extends EventEmitter {
  private readonly maxConcurrency: number;
  private activeGenerations = 0;
  private completedFiles: Set<string> = new Set();
  private failedFiles: Set<string> = new Set();

  private metrics: ParallelGenerationMetrics = {
    totalFiles: 0,
    successfulFiles: 0,
    failedFiles: 0,
    averageGenerationTime: 0,
    parallelSpeedup: 0,
    resourceUtilization: 0,
    totalTime: 0,
  };

  constructor(
    private generator: (file: FileSpec) => Promise<string>,
    options: { maxConcurrency?: number } = {},
  ) {
    super();
    this.maxConcurrency = options.maxConcurrency || 3;
  }

  /**
   * Generate multiple files in parallel with dependency resolution
   */
  async generateMultiFile(
    request: MultiFileRequest,
    signal?: AbortSignal,
  ): Promise<GeneratedFile[]> {
    const startTime = Date.now();
    this.resetState();

    this.metrics.totalFiles = request.files.length;

    // Build dependency graph
    const graph = this.buildDependencyGraph(request.files);

    // Perform topological sort to determine execution layers
    const layers = this.topologicalSort(graph);

    this.emit("layers-computed", { layers: layers.length, graph });

    const results: GeneratedFile[] = [];
    const fileMap = new Map(request.files.map((f) => [f.path, f]));

    try {
      // Process each layer sequentially, but files within a layer in parallel
      for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        if (signal?.aborted) break;

        const layer = layers[layerIndex];
        this.emit("layer-start", {
          layer: layerIndex + 1,
          files: layer.length,
        });

        // Generate files in this layer in parallel
        const layerPromises = layer.map((filePath) =>
          this.generateSingleFile(fileMap.get(filePath)!, signal),
        );

        const layerResults = await Promise.allSettled(layerPromises);

        // Process results
        for (let i = 0; i < layerResults.length; i++) {
          const result = layerResults[i];
          const filePath = layer[i];

          if (result.status === "fulfilled") {
            results.push(result.value);
            this.completedFiles.add(filePath);
            this.metrics.successfulFiles++;

            this.emit("file-completed", result.value);
          } else {
            this.failedFiles.add(filePath);
            this.metrics.failedFiles++;

            const failedFile: GeneratedFile = {
              path: filePath,
              content: "",
              dependencies: graph.edges.get(filePath)
                ? Array.from(graph.edges.get(filePath)!)
                : [],
              generationTime: 0,
              size: 0,
              success: false,
              error: result.reason?.message || "Unknown error",
            };

            results.push(failedFile);

            this.emit("file-failed", { path: filePath, error: result.reason });

            // Handle error based on strategy
            if (request.options?.errorHandling === "stop") {
              throw new Error(
                `File generation failed for ${filePath}: ${result.reason?.message}`,
              );
            }
          }
        }

        this.emit("layer-completed", {
          layer: layerIndex + 1,
          successful: layerResults.filter((r) => r.status === "fulfilled")
            .length,
          failed: layerResults.filter((r) => r.status === "rejected").length,
        });
      }
    } catch (error) {
      this.emit("generation-error", error);
      throw error;
    } finally {
      // Calculate final metrics
      const totalTime = Date.now() - startTime;
      this.metrics.totalTime = totalTime;

      if (this.metrics.successfulFiles > 0) {
        this.metrics.averageGenerationTime =
          results
            .filter((r) => r.success)
            .reduce((sum, r) => sum + r.generationTime, 0) /
          this.metrics.successfulFiles;
      }

      // Calculate theoretical sequential time vs actual parallel time
      const sequentialTime = results
        .filter((r) => r.success)
        .reduce((sum, r) => sum + r.generationTime, 0);

      this.metrics.parallelSpeedup =
        sequentialTime > 0 ? sequentialTime / totalTime : 0;
      this.metrics.resourceUtilization =
        (this.metrics.successfulFiles / this.maxConcurrency) * 100;

      this.emit("generation-completed", this.metrics);
    }

    return results;
  }

  /**
   * Generate a single file with metrics tracking
   */
  private async generateSingleFile(
    file: FileSpec,
    signal?: AbortSignal,
  ): Promise<GeneratedFile> {
    const startTime = Date.now();
    this.activeGenerations++;

    this.emit("file-start", { path: file.path });

    try {
      if (signal?.aborted) {
        throw new Error("Generation aborted");
      }

      const content = await this.generator(file);
      const generationTime = Date.now() - startTime;

      const result: GeneratedFile = {
        path: file.path,
        content,
        dependencies: file.dependencies || [],
        generationTime,
        size: Buffer.byteLength(content, "utf8"),
        success: true,
      };

      return result;
    } catch (error) {
      const generationTime = Date.now() - startTime;

      const result: GeneratedFile = {
        path: file.path,
        content: "",
        dependencies: file.dependencies || [],
        generationTime,
        size: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      throw error;
    } finally {
      this.activeGenerations--;
    }
  }

  /**
   * Build dependency graph from file specifications
   */
  private buildDependencyGraph(files: FileSpec[]): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Set(),
      edges: new Map(),
      inDegree: new Map(),
    };

    // Initialize nodes
    for (const file of files) {
      graph.nodes.add(file.path);
      graph.edges.set(file.path, new Set());
      graph.inDegree.set(file.path, 0);
    }

    // Build edges based on explicit dependencies and content analysis
    for (const file of files) {
      const deps = new Set<string>();

      // Add explicit dependencies
      if (file.dependencies) {
        for (const dep of file.dependencies) {
          deps.add(dep);
        }
      }

      // Analyze content for implicit dependencies (imports)
      if (file.content || file.prompt) {
        const content = file.content || file.prompt || "";
        const detectedDeps = this.extractDependenciesFromContent(
          content,
          files,
        );
        for (const dep of detectedDeps) {
          deps.add(dep);
        }
      }

      // Update graph
      for (const dep of deps) {
        if (graph.nodes.has(dep)) {
          graph.edges.get(dep)!.add(file.path);
          graph.inDegree.set(
            file.path,
            (graph.inDegree.get(file.path) || 0) + 1,
          );
        }
      }
    }

    return graph;
  }

  /**
   * Extract dependencies from file content
   */
  private extractDependenciesFromContent(
    content: string,
    allFiles: FileSpec[],
  ): string[] {
    const dependencies: string[] = [];
    const filePaths = allFiles.map((f) => f.path);

    // Match import statements
    const importRegex = /(?:import|from|require).*?['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Check if it's a relative import that matches one of our files
      const possiblePaths = [
        importPath,
        `${importPath}.ts`,
        `${importPath}.js`,
        `${importPath}/index.ts`,
        `${importPath}/index.js`,
      ];

      for (const possiblePath of possiblePaths) {
        if (filePaths.includes(possiblePath)) {
          dependencies.push(possiblePath);
          break;
        }
      }
    }

    // Match file references in prompts
    const fileRefRegex =
      /(?:file|path|import).*?['"`]([^'"`]+\.(?:ts|js|tsx|jsx))['"`]/g;
    while ((match = fileRefRegex.exec(content)) !== null) {
      const filePath = match[1];
      if (filePaths.includes(filePath)) {
        dependencies.push(filePath);
      }
    }

    return dependencies;
  }

  /**
   * Perform topological sort using Kahn's algorithm
   */
  private topologicalSort(graph: DependencyGraph): string[][] {
    const layers: string[][] = [];
    const inDegree = new Map(graph.inDegree);
    const adjList = new Map(graph.edges);

    // Find initial nodes with no dependencies
    let currentLayer = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        currentLayer.push(node);
      }
    }

    while (currentLayer.length > 0) {
      layers.push([...currentLayer]);
      const nextLayer = [];

      // Process current layer
      for (const node of currentLayer) {
        inDegree.delete(node);

        // Update in-degrees of dependent nodes
        const dependents = adjList.get(node) || new Set();
        for (const dependent of dependents) {
          if (inDegree.has(dependent)) {
            const newDegree = inDegree.get(dependent)! - 1;
            inDegree.set(dependent, newDegree);

            if (newDegree === 0) {
              nextLayer.push(dependent);
            }
          }
        }
      }

      currentLayer = nextLayer;
    }

    // Check for cycles
    if (inDegree.size > 0) {
      const cyclicNodes = Array.from(inDegree.keys());
      throw new Error(
        `Circular dependencies detected: ${cyclicNodes.join(", ")}`,
      );
    }

    return layers;
  }

  /**
   * Get generation metrics
   */
  getMetrics(): ParallelGenerationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current active generation count
   */
  get activeCount(): number {
    return this.activeGenerations;
  }

  /**
   * Reset internal state
   */
  private resetState(): void {
    this.completedFiles.clear();
    this.failedFiles.clear();
    this.activeGenerations = 0;
    this.metrics = {
      totalFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      averageGenerationTime: 0,
      parallelSpeedup: 0,
      resourceUtilization: 0,
      totalTime: 0,
    };
  }
}
