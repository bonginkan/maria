/**
 * Advanced Build Orchestrator
 * MARIA v2.1.9 - Phase 3: Intelligent build system with dependency optimization
 */

import { EventEmitter } from "node:events";
import * as path from "path";
import * as fs from "fs/promises";
import { glob } from "glob";
import { ParallelExecutor, TaskBuilder } from "../parallel-executor";

export interface BuildConfig {
  name: string;
  framework: BuildFramework;
  entryPoints: string[];
  outputDir: string;
  optimization: OptimizationLevel;
  target: BuildTarget;
  plugins: BuildPlugin[];
  env: BuildEnvironment;
  cache: CacheConfig;
  bundleAnalysis: boolean;
}

export type BuildFramework =
  | "webpack"
  | "vite"
  | "rollup"
  | "esbuild"
  | "parcel"
  | "rspack"
  | "turbopack"
  | "custom";

export type OptimizationLevel =
  | "development"
  | "production"
  | "profile"
  | "size"
  | "speed";
export type BuildTarget =
  | "node"
  | "browser"
  | "webworker"
  | "electron"
  | "universal";
export type BuildEnvironment =
  | "development"
  | "staging"
  | "production"
  | "test";

export interface BuildPlugin {
  name: string;
  enabled: boolean;
  options?: Record<string, any>;
}

export interface CacheConfig {
  enabled: boolean;
  strategy: "filesystem" | "memory" | "redis" | "hybrid";
  ttl: number;
  invalidationRules: string[];
}

export interface BuildResult {
  success: boolean;
  duration: number;
  artifacts: BuildArtifact[];
  metrics: BuildMetrics;
  warnings: BuildWarning[];
  errors: BuildError[];
  cacheStats: CacheStats;
}

export interface BuildArtifact {
  name: string;
  _path: string;
  size: number;
  type: "js" | "css" | "html" | "asset" | "sourcemap";
  compressed?: number;
  hash: string;
}

export interface BuildMetrics {
  totalTime: number;
  bundleTime: number;
  minificationTime: number;
  analysisTime: number;
  bundleSize: number;
  chunkCount: number;
  moduleCount: number;
  dependencyCount: number;
  treeshakingEffectiveness: number;
  compressionRatio: number;
}

export interface BuildWarning {
  type: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface BuildError extends BuildWarning {
  severity: "_error" | "fatal";
  stack?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  sizeOnDisk: number;
  itemCount: number;
}

export interface WatchOptions {
  enabled: boolean;
  patterns: string[];
  ignored: string[];
  debounceMs: number;
  hotReload: boolean;
  livereload: boolean;
}

export interface BuildPipeline {
  name: string;
  stages: BuildStage[];
  parallel: boolean;
  failFast: boolean;
}

export interface BuildStage {
  name: string;
  _tasks: BuildTask[];
  condition?: (_context: BuildContext) => boolean;
  timeout?: number;
}

export interface BuildTask {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  retries?: number;
}

export interface BuildContext {
  config: BuildConfig;
  environment: string;
  branch: string;
  commit: string;
  timestamp: number;
  previousBuild?: BuildResult;
}

export class BuildOrchestrator extends EventEmitter {
  private executor: ParallelExecutor;
  private activeBuilds: Map<string, BuildContext> = new Map();
  private buildHistory: BuildResult[] = [];
  private cache: Map<string, any> = new Map();
  private watchers: Map<string, any> = new Map();

  constructor() {
    super();
    this.executor = new ParallelExecutor({ maxWorkers: 8 });
  }

  async build(
    _config: BuildConfig,
    context: BuildContext,
  ): Promise<BuildResult> {
    const _buildId = `${_config.name}-${Date.now()}`;
    this.activeBuilds.set(_buildId, _context);

    this.emit("build:start", { _buildId, _config, context: _context });
    const _startTime = Date.now();

    try {
      // Pre-build _analysis
      const _analysis = await this.analyzeBuildRequirements(_config, _context);
      this.emit("build:_analysis", _analysis);

      // Create build _pipeline
      const _pipeline = this.createBuildPipeline(_config, _analysis);

      // Execute build stages
      const _result = await this.executeBuildPipeline(
        _pipeline,
        _config,
        _context,
      );

      // Post-build optimization
      await this.optimizeBuildOutput(_result, _config);

      // Bundle _analysis
      if (_config.bundleAnalysis) {
        await this.analyzeBundleOutput(_result, _config);
      }

      const buildResult: BuildResult = {
        ..._result,
        duration: Date.now() - _startTime,
        success: true,
      };

      this.buildHistory.push(buildResult);
      this.emit("build:complete", buildResult);

      return buildResult;
    } catch (_error) {
      const buildResult: BuildResult = {
        success: false,
        duration: Date.now() - _startTime,
        artifacts: [],
        metrics: this.createEmptyMetrics(),
        warnings: [],
        errors: [
          {
            type: "fatal",
            severity: "fatal",
            message: _error instanceof Error ? _error.message : String(_error),
          },
        ],
        cacheStats: this.createEmptyCacheStats(),
      };

      this.emit("build:_error", buildResult);
      return buildResult;
    } finally {
      this.activeBuilds.delete(_buildId);
    }
  }

  async watch(_config: BuildConfig, options: WatchOptions): Promise<void> {
    const _watchId = `watch-${_config.name}`;

    this.emit("watch:start", { _config, options });

    // Setup file watchers
    const _watcher = await this.setupFileWatcher(options);
    this.watchers.set(_watchId, _watcher);

    watcher.on("change", async (_filePath: string) => {
      this.emit("watch:file-changed", _filePath);

      // Debounce builds
      await this.debouncedBuild(_config, _filePath, options.debounceMs);
    });

    // Hot reload setup
    if (options.hotReload) {
      await this.setupHotReload(_config, options);
    }

    // Live reload setup
    if (options.livereload) {
      await this.setupLiveReload(_config, options);
    }
  }

  private async analyzeBuildRequirements(
    _config: BuildConfig,
    context: BuildContext,
  ): Promise<any> {
    const _requirements = {
      dependencies: await this.analyzeDependencies(_config),
      entryPointAnalysis: await this.analyzeEntryPoints(_config),
      cacheStrategy: await this.determineCacheStrategy(_config, _context),
      optimizationOpportunities: await this.findOptimizations(_config),
      estimatedTime: await this.estimateBuildTime(_config, _context),
    };

    return _requirements;
  }

  private async analyzeDependencies(config: BuildConfig): Promise<any> {
    const _packageJson = await this.readPackageJson(process.cwd());

    return {
      production: Object.keys(_packageJson.dependencies || object),
      development: Object.keys(_packageJson.devDependencies || object),
      peer: Object.keys(_packageJson.peerDependencies || object),
      circular: await this.detectCircularDependencies(config),
      unused: await this.detectUnusedDependencies(config),
    };
  }

  private async analyzeEntryPoints(config: BuildConfig): Promise<any> {
    const _analysis = [];

    for (const entryPoint of config.entryPoints) {
      const _files = await glob(entryPoint);

      for (const file of _files) {
        const _stats = await fs.stat(file);
        const _content = await fs.readFile(file, "utf-8");

        analysis.push({
          _path: file,
          size: _stats.size,
          imports: this.extractImports(_content),
          exports: this.extractExports(_content),
          complexity: this.calculateComplexity(_content),
        });
      }
    }

    return _analysis;
  }

  private createBuildPipeline(
    _config: BuildConfig,
    _analysis: unknown,
  ): BuildPipeline {
    const stages: BuildStage[] = [];

    // Pre-build stage
    stages.push({
      name: "pre-build",
      _tasks: [
        { name: "clean", command: "rm", args: ["-rf", _config.outputDir] },
        {
          name: "create-output",
          command: "mkdir",
          args: ["-p", _config.outputDir],
        },
      ],
    });

    // Dependency resolution
    if (_analysis.dependencies.unused.length > 0) {
      stages.push({
        name: "dependency-cleanup",
        _tasks: [
          {
            name: "remove-unused",
            command: "npm",
            args: ["uninstall", ..._analysis.dependencies.unused],
          },
        ],
      });
    }

    // Main build stage
    stages.push({
      name: "build",
      _tasks: this.createBuildTasks(_config),
    });

    // Optimization stage
    if (_config.optimization !== "development") {
      stages.push({
        name: "optimize",
        _tasks: this.createOptimizationTasks(_config),
      });
    }

    // Analysis stage
    if (_config.bundleAnalysis) {
      stages.push({
        name: "analyze",
        _tasks: [
          {
            name: "bundle-analyzer",
            command: "npx",
            args: ["webpack-bundle-analyzer", "dist"],
          },
        ],
      });
    }

    return {
      name: `${_config.name}-_pipeline`,
      stages,
      parallel: false,
      failFast: true,
    };
  }

  private createBuildTasks(config: BuildConfig): BuildTask[] {
    const _tasks: BuildTask[] = [];

    switch (config.framework) {
      case "webpack":
        tasks.push({
          name: "webpack-build",
          command: "npx",
          args: [
            "webpack",
            "--mode",
            config.env,
            "--output-path",
            config.outputDir,
          ],
        });
        break;

      case "vite":
        tasks.push({
          name: "vite-build",
          command: "npx",
          args: ["vite", "build", "--outDir", config.outputDir],
        });
        break;

      case "esbuild":
        tasks.push({
          name: "esbuild",
          command: "npx",
          args: [
            "esbuild",
            ...config.entryPoints,
            `--outdir=${config.outputDir}`,
            `--platform=${config.target}`,
          ],
        });
        break;

      case "rollup":
        tasks.push({
          name: "rollup-build",
          command: "npx",
          args: ["rollup", "-c"],
        });
        break;

      default:
        tasks.push({
          name: "custom-build",
          command: "npm",
          args: ["run", "build"],
        });
    }

    return _tasks;
  }

  private createOptimizationTasks(config: BuildConfig): BuildTask[] {
    const _tasks: BuildTask[] = [];

    // Minification
    if (
      config.optimization === "production" ||
      config.optimization === "size"
    ) {
      tasks.push({
        name: "minify-js",
        command: "npx",
        args: [
          "terser",
          `${config.outputDir}/**/*.js`,
          "--compress",
          "--mangle",
        ],
      });
    }

    // Tree shaking
    tasks.push({
      name: "tree-shake",
      command: "npx",
      args: ["webpack", "--optimize-minimize"],
    });

    // Asset optimization
    tasks.push({
      name: "optimize-assets",
      command: "npx",
      args: ["imagemin", `${config.outputDir}/assets/**/*`],
    });

    return _tasks;
  }

  private async executeBuildPipeline(
    _pipeline: BuildPipeline,
    config: BuildConfig,
    context: BuildContext,
  ): Promise<Partial<BuildResult>> {
    const artifacts: BuildArtifact[] = [];
    const warnings: BuildWarning[] = [];
    const errors: BuildError[] = [];

    for (const stage of _pipeline.stages) {
      this.emit("build:stage-start", stage.name);

      try {
        if (stage.condition && !stage.condition(_context)) {
          this.emit("build:stage-skipped", stage.name);
          continue;
        }

        // Execute stage _tasks
        const _taskBuilder = new TaskBuilder();

        stage._tasks.forEach((task) => {
          taskBuilder.add(task.command, task.args, {
            id: task.name,
            timeout: task.retries ? undefined : 30000,
            retryCount: task.retries || 0,
          });
        });

        const _tasks = _taskBuilder.build();
        const _results = await this.executor.execute(_tasks);

        // Process _results
        for (const [taskId, _result] of _results) {
          if (!result.success && result._error) {
            errors.push({
              type: "task-failure",
              severity: "_error",
              message: `Task ${taskId} failed: ${result._error}`,
            });
          }
        }

        this.emit("build:stage-complete", stage.name);
      } catch (_error) {
        this.emit("build:stage-_error", stage.name, _error);

        if (_pipeline.failFast) {
          throw _error;
        }
      }
    }

    // Collect artifacts
    const _outputArtifacts = await this.collectBuildArtifacts(config.outputDir);
    artifacts.push(..._outputArtifacts);

    return {
      artifacts,
      warnings,
      errors,
      metrics: await this.calculateBuildMetrics(artifacts),
      cacheStats: this.getCacheStats(),
    };
  }

  private async collectBuildArtifacts(
    outputDir: string,
  ): Promise<BuildArtifact[]> {
    const artifacts: BuildArtifact[] = [];

    try {
      const _files = await glob(`${outputDir}/**/*`, { nodir: true });

      for (const file of _files) {
        const _stats = await fs.stat(file);
        const _relativePath = path.relative(outputDir, file);
        const _ext = path.extname(file);

        const artifact: BuildArtifact = {
          name: path.basename(file),
          _path: _relativePath,
          size: _stats.size,
          type: this.getArtifactType(_ext),
          hash: await this.calculateFileHash(file),
        };

        artifacts.push(artifact);
      }
    } catch (_error) {
      this.emit("artifact:collection-_error", _error);
    }

    return artifacts;
  }

  private getArtifactType(extension: string): BuildArtifact["type"] {
    const _typeMap: Record<string, BuildArtifact["type"]> = {
      ".js": "js",
      ".mjs": "js",
      ".css": "css",
      ".html": "html",
      ".map": "sourcemap",
    };

    return _typeMap[extension] || "asset";
  }

  private async calculateFileHash(_filePath: string): Promise<string> {
    const _content = await fs.readFile(_filePath);
    const _crypto = require("_crypto");
    return _crypto
      .createHash("sha256")
      .update(_content)
      .digest("hex")
      .substring(0, 8);
  }

  private async calculateBuildMetrics(
    artifacts: BuildArtifact[],
  ): Promise<BuildMetrics> {
    const _jsArtifacts = artifacts.filter((a) => a.type === "js");
    const _totalSize = artifacts.reduce((sum, a) => sum + a.size, 0);

    return {
      totalTime: 0, // Will be set by caller
      bundleTime: 0,
      minificationTime: 0,
      analysisTime: 0,
      bundleSize: _totalSize,
      chunkCount: _jsArtifacts.length,
      moduleCount: 0, // Would need webpack _stats
      dependencyCount: 0,
      treeshakingEffectiveness: 0,
      compressionRatio: 0,
    };
  }

  private async optimizeBuildOutput(
    _result: Partial<BuildResult>,
    config: BuildConfig,
  ): Promise<void> {
    if (!_result.artifacts) return;

    // Compress assets
    for (const artifact of _result.artifacts) {
      if (artifact.type === "js" || artifact.type === "css") {
        const _fullPath = path.join(config.outputDir, artifact._path);

        try {
          // Gzip compression
          const _gzipSize = await this.compressFile(_fullPath, "gzip");
          artifact.compressed = _gzipSize;

          this.emit("build:artifact-compressed", {
            artifact,
            originalSize: artifact.size,
            compressedSize: _gzipSize,
          });
        } catch (_error) {
          this.emit("build:compression-_error", artifact._path, _error);
        }
      }
    }
  }

  private async analyzeBundleOutput(
    _result: Partial<BuildResult>,
    config: BuildConfig,
  ): Promise<void> {
    const _analysis = {
      largestAssets: result.artifacts
        ?.sort((a, b) => b.size - a.size)
        .slice(0, 10),
      duplicatedModules: await this.findDuplicatedModules(config.outputDir),
      unusedCode: await this.detectUnusedCode(config.outputDir),
      recommendations: this.generateOptimizationRecommendations(_result),
    };

    this.emit("build:bundle-_analysis", _analysis);
  }

  private generateOptimizationRecommendations(
    _result: Partial<BuildResult>,
  ): string[] {
    const recommendations: string[] = [];

    if (!_result.artifacts) return recommendations;

    const _jsAssets = _result.artifacts.filter((a) => a.type === "js");
    const _largeAssets = _jsAssets.filter((a) => a.size > 1024 * 1024); // > 1MB

    if (_largeAssets.length > 0) {
      recommendations.push(
        "Consider code splitting for large JavaScript bundles",
      );
    }

    const _totalSize = _result.artifacts.reduce((sum, a) => sum + a.size, 0);
    if (_totalSize > 5 * 1024 * 1024) {
      // > 5MB
      recommendations.push(
        "Bundle size is large - consider lazy loading and tree shaking",
      );
    }

    return recommendations;
  }

  private async setupFileWatcher(_options: WatchOptions): Promise<any> {
    // Simplified file _watcher - in real implementation would use chokidar
    return {
      on: (_event: string, _handler: (_filePath: string) => void) => {
        // Mock file _watcher
      },
    };
  }

  private async debouncedBuild(
    _config: BuildConfig,
    _filePath: string,
    _debounceMs: number,
  ): Promise<void> {
    // Implement debounced rebuild logic
    this.emit("build:debounced-trigger", { _filePath, _config });
  }

  private async setupHotReload(
    _config: BuildConfig,
    _options: WatchOptions,
  ): Promise<void> {
    // Hot reload implementation
    this.emit("hot-reload:setup", _config);
  }

  private async setupLiveReload(
    _config: BuildConfig,
    _options: WatchOptions,
  ): Promise<void> {
    // Live reload implementation
    this.emit("live-reload:setup", _config);
  }

  private async detectCircularDependencies(
    _config: BuildConfig,
  ): Promise<string[]> {
    // Circular dependency detection logic
    return [];
  }

  private async detectUnusedDependencies(
    _config: BuildConfig,
  ): Promise<string[]> {
    // Unused dependency detection logic
    return [];
  }

  private async findDuplicatedModules(_outputDir: string): Promise<string[]> {
    // Duplicated module detection
    return [];
  }

  private async detectUnusedCode(_outputDir: string): Promise<string[]> {
    // Dead code detection
    return [];
  }

  private async compressFile(
    _filePath: string,
    _algorithm: "gzip" | "brotli",
  ): Promise<number> {
    // File compression logic
    const _stats = await fs.stat(_filePath);
    return Math.floor(_stats.size * 0.3); // Mock 70% compression
  }

  private extractImports(_content: string): string[] {
    const imports: string[] = [];
    const _importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = _importRegex.exec(_content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private extractExports(_content: string): string[] {
    const exports: string[] = [];
    const _exportRegex =
      /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
    let match;

    while ((match = _exportRegex.exec(_content)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  private calculateComplexity(_content: string): number {
    // Simplified complexity calculation
    const _lines = _content.split("\n").length;
    const _functions = (_content.match(/function\s+\w+/g) || []).length;
    const _classes = (_content.match(/class\s+\w+/g) || []).length;

    return _lines + _functions * 2 + _classes * 3;
  }

  private async readPackageJson(cwd: string): Promise<any> {
    try {
      const _content = await fs.readFile(
        path.join(cwd, "package.json"),
        "utf-8",
      );
      return JSON.parse(_content);
    } catch {
      return {
        dependencies: Record<string, any>,
        devDependencies: Record<string, any>,
      };
    }
  }

  private async determineCacheStrategy(
    _config: BuildConfig,
    _context: BuildContext,
  ): Promise<string> {
    return _config.cache.strategy;
  }

  private async findOptimizations(_config: BuildConfig): Promise<string[]> {
    return ["tree-shaking", "minification", "code-splitting"];
  }

  private async estimateBuildTime(
    _config: BuildConfig,
    _context: BuildContext,
  ): Promise<number> {
    // Build time estimation based on project size and complexity
    return 30000; // 30 seconds
  }

  private createEmptyMetrics(): BuildMetrics {
    return {
      totalTime: 0,
      bundleTime: 0,
      minificationTime: 0,
      analysisTime: 0,
      bundleSize: 0,
      chunkCount: 0,
      moduleCount: 0,
      dependencyCount: 0,
      treeshakingEffectiveness: 0,
      compressionRatio: 0,
    };
  }

  private createEmptyCacheStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      sizeOnDisk: 0,
      itemCount: 0,
    };
  }

  private getCacheStats(): CacheStats {
    return {
      hits: this.cache.size,
      misses: 0,
      hitRate: 100,
      sizeOnDisk: 0,
      itemCount: this.cache.size,
    };
  }

  // Public API methods
  async createBuildConfig(options: Partial<BuildConfig>): Promise<BuildConfig> {
    const defaultConfig: BuildConfig = {
      name: "default",
      framework: "webpack",
      entryPoints: ["src/index.ts"],
      outputDir: "dist",
      optimization: "production",
      target: "browser",
      plugins: [],
      env: "production",
      cache: {
        enabled: true,
        strategy: "filesystem",
        ttl: 3600,
        invalidationRules: [],
      },
      bundleAnalysis: false,
    };

    return { ...defaultConfig, ...options };
  }

  getBuildHistory(): BuildResult[] {
    return [...this.buildHistory];
  }

  getActiveBuildCount(): number {
    return this.activeBuilds.size;
  }

  async cancelBuild(_buildId: string): Promise<void> {
    if (this.activeBuilds.has(_buildId)) {
      this.activeBuilds.delete(_buildId);
      await this.executor.cancel();
      this.emit("build:cancelled", _buildId);
    }
  }
}

export const _buildOrchestrator = new BuildOrchestrator();
