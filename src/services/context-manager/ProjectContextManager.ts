/**
 * Project Context Manager
 * Analyzes and manages comprehensive project context for intelligent code generation
 */

import * as fs from "fs/promises";
import * as path from "path";
import {
  IntentAnalysisContext,
  NamingConventions,
  ArchitecturePattern,
} from "../intent-engine/IntentAnalyzer";

export interface ProjectContext {
  rootPath: string;
  projectInfo: ProjectInfo;
  _dependencies: PackageDependencies;
  codeStyle: CodeStyleProfile;
  architecture: ArchitecturePattern;
  testingFramework: TestingSetup;
  buildSystem: BuildConfiguration;
  qualityMetrics: QualityMetrics;
  fileStructure: FileStructureAnalysis;
  gitInfo?: GitInformation;
}

export interface ProjectInfo {
  name: string;
  version: string;
  description?: string;
  _language: "typescript" | "javascript" | "mixed";
  type: "library" | "application" | "service" | "monorepo";
  framework: string[];
  nodeVersion?: string;
  _packageManager: "npm" | "yarn" | "pnpm";
}

export interface PackageDependencies {
  _dependencies: DependencyInfo[];
  _devDependencies: DependencyInfo[];
  _peerDependencies: DependencyInfo[];
  outdated: DependencyInfo[];
  security: SecurityVulnerability[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  latest?: string;
  type: "framework" | "library" | "tool" | "type-definition";
  purpose: string;
  size?: number;
  vulnerabilities?: number;
}

export interface SecurityVulnerability {
  package: string;
  severity: "low" | "moderate" | "high" | "critical";
  title: string;
  overview: string;
  recommendation: string;
}

export interface CodeStyleProfile {
  indentation: "spaces" | "tabs";
  indentSize: number;
  quotes: "single" | "double" | "mixed";
  semicolons: boolean;
  trailingComma: "none" | "es5" | "all";
  lineLength: number;
  namingConvention: NamingConventions;
  formatting: FormattingRules;
}

export interface FormattingRules {
  prettier: boolean;
  eslint: boolean;
  customRules: Record<string, any>;
}

export interface TestingSetup {
  framework: "jest" | "vitest" | "mocha" | "cypress" | "playwright" | "none";
  coverage: boolean;
  threshold: number;
  _testFiles: number;
  _testPatterns: string[];
  e2eFramework?: string;
}

export interface BuildConfiguration {
  bundler: "webpack" | "vite" | "rollup" | "esbuild" | "tsup" | "none";
  typescript: boolean;
  sourceMaps: boolean;
  minification: boolean;
  outputFormat: string[];
  targetEnvironments: string[];
}

export interface QualityMetrics {
  maintainabilityIndex: number;
  cyclomaticComplexity: number;
  linesOfCode: number;
  testCoverage: number;
  duplication: number;
  technicalDebt: number;
  codeSmells: CodeSmell[];
}

export interface CodeSmell {
  type:
    | "long-function"
    | "large-class"
    | "duplicate-code"
    | "complex-condition"
    | "dead-code";
  file: string;
  line: number;
  severity: "minor" | "major" | "critical";
  description: string;
  suggestion: string;
}

export interface FileStructureAnalysis {
  totalFiles: number;
  filesByType: Record<string, number>;
  _directoryStructure: DirectoryNode;
  _patterns: StructurePattern[];
  _inconsistencies: StructureInconsistency[];
}

export interface DirectoryNode {
  name: string;
  _path: string;
  type: "directory" | "file";
  children?: DirectoryNode[];
  size?: number;
  purpose?: string;
}

export interface StructurePattern {
  name: string;
  confidence: number;
  examples: string[];
  recommendation: string;
}

export interface StructureInconsistency {
  type: "naming" | "organization" | "duplication";
  description: string;
  _files: string[];
  suggestion: string;
}

export interface GitInformation {
  branch: string;
  lastCommit: string;
  uncommittedChanges: boolean;
  remoteUrl?: string;
  contributors: string[];
}

export class ProjectContextManager {
  private static instance: ProjectContextManager;
  private contextCache: Map<string, ProjectContext> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    // Constructor implementation
  }

  public static getInstance(): ProjectContextManager {
    if (!ProjectContextManager.instance) {
      ProjectContextManager.instance = new ProjectContextManager();
    }
    return ProjectContextManager.instance;
  }

  /**
   * Analyze and build comprehensive project context
   */
  public async analyzeProject(rootPath: string): Promise<ProjectContext> {
    // Check cache first
    const _cacheKey = path.resolve(rootPath);
    const _cached = this.contextCache.get(_cacheKey);
    if (_cached && this.isCacheValid(_cached)) {
      return _cached;
    }

    console.log("🔍 Analyzing project context...");

    const context: ProjectContext = {
      rootPath: _cacheKey,
      projectInfo: await this.analyzeProjectInfo(rootPath),
      _dependencies: await this.analyzeDependencies(rootPath),
      codeStyle: await this.analyzeCodeStyle(rootPath),
      architecture: await this.analyzeArchitecture(rootPath),
      testingFramework: await this.analyzeTestingSetup(rootPath),
      buildSystem: await this.analyzeBuildConfiguration(rootPath),
      qualityMetrics: await this.analyzeQualityMetrics(rootPath),
      fileStructure: await this.analyzeFileStructure(rootPath),
      gitInfo: await this.analyzeGitInfo(rootPath),
    };

    // Cache the result
    this.contextCache.set(_cacheKey, context);

    console.log("✅ Project analysis complete");
    return context;
  }

  /**
   * Convert to IntentAnalysisContext for compatibility
   */
  public toIntentAnalysisContext(
    context: ProjectContext,
  ): IntentAnalysisContext {
    return {
      _projectType: this.getProjectTypeString(context.projectInfo),
      existingFiles: this.extractFilePaths(
        context.fileStructure.directoryStructure,
      ),
      _dependencies: context.dependencies.dependencies.map((d) => d.name),
      _frameworks: context.projectInfo.framework,
      conventions: context.codeStyle.namingConvention,
      architecture: context.architecture,
    };
  }

  /**
   * Analyze project basic information
   */
  private async analyzeProjectInfo(rootPath: string): Promise<ProjectInfo> {
    const _packageJsonPath = path.join(rootPath, "package.json");

    try {
      const _packageJsonContent = await fs.readFile(_packageJsonPath, "utf-8");
      const _packageJson = JSON.parse(_packageJsonContent);

      const _hasTypeScript = await this.checkFileExists(
        path.join(rootPath, "tsconfig.json"),
      );
      const _language = _hasTypeScript
        ? "typescript"
        : (await this.hasTypeScriptFiles(rootPath))
          ? "mixed"
          : "javascript";

      const _frameworks = await this.detectFrameworks(_packageJson, rootPath);
      const _packageManager = await this.detectPackageManager(rootPath);
      const _projectType = this.determineProjectType(_packageJson, _frameworks);

      return {
        name: _packageJson.name || path.basename(rootPath),
        version: _packageJson.version || "0.0.0",
        description: _packageJson.description,
        _language,
        type: _projectType,
        framework: _frameworks,
        nodeVersion: _packageJson.engines?.node,
        _packageManager,
      };
    } catch (_error) {
      // No package.json, analyze as generic project
      return {
        name: path.basename(rootPath),
        version: "0.0.0",
        _language: (await this.hasTypeScriptFiles(rootPath))
          ? "typescript"
          : "javascript",
        type: "application",
        framework: [],
        _packageManager: "npm",
      };
    }
  }

  /**
   * Analyze project _dependencies
   */
  private async analyzeDependencies(
    rootPath: string,
  ): Promise<PackageDependencies> {
    const _packageJsonPath = path.join(rootPath, "package.json");

    try {
      const _packageJsonContent = await fs.readFile(_packageJsonPath, "utf-8");
      const _packageJson = JSON.parse(_packageJsonContent);

      const _dependencies = this.parseDependencies(
        _packageJson._dependencies || object,
        "production",
      );
      const _devDependencies = this.parseDependencies(
        _packageJson._devDependencies || object,
        "development",
      );
      const _peerDependencies = this.parseDependencies(
        _packageJson._peerDependencies || object,
        "peer",
      );

      return {
        _dependencies,
        _devDependencies,
        _peerDependencies,
        outdated: [], // Would need npm/yarn API call
        security: [], // Would need security audit
      };
    } catch (_error) {
      return {
        _dependencies: [],
        _devDependencies: [],
        _peerDependencies: [],
        outdated: [],
        security: [],
      };
    }
  }

  /**
   * Analyze code style _patterns
   */
  private async analyzeCodeStyle(rootPath: string): Promise<CodeStyleProfile> {
    const style: CodeStyleProfile = {
      indentation: "spaces",
      indentSize: 2,
      quotes: "single",
      semicolons: true,
      trailingComma: "es5",
      lineLength: 80,
      namingConvention: {
        caseStyle: "_camelCase",
        fileExtensions: ["ts", "js"],
        _directoryStructure: "nested",
      },
      formatting: {
        prettier: false,
        eslint: false,
        customRules: Record<string, any>,
      },
    };

    // Check for prettier _config
    const _prettierConfigFiles = [
      ".prettierrc",
      ".prettierrc.json",
      ".prettierrc.js",
      "prettier.config.js",
    ];
    for (const configFile of _prettierConfigFiles) {
      if (await this.checkFileExists(path.join(rootPath, configFile))) {
        style.formatting.prettier = true;
        const _config = await this.parsePrettierConfig(
          path.join(rootPath, configFile),
        );
        if (_config) {
          Object.assign(style, _config);
        }
        break;
      }
    }

    // Check for ESLint _config
    const _eslintConfigFiles = [
      ".eslintrc",
      ".eslintrc.json",
      ".eslintrc.js",
      "eslint.config.js",
    ];
    for (const configFile of _eslintConfigFiles) {
      if (await this.checkFileExists(path.join(rootPath, configFile))) {
        style.formatting.eslint = true;
        break;
      }
    }

    // Analyze actual code _files to detect _patterns
    await this.detectCodeStyleFromFiles(rootPath, style);

    return style;
  }

  /**
   * Analyze project architecture
   */
  private async analyzeArchitecture(
    rootPath: string,
  ): Promise<ArchitecturePattern> {
    const _structure = await this.getDirectoryStructure(rootPath);

    // Detect architecture pattern based on directory _structure
    const _directories = this.getAllDirectories(_structure);
    const _patterns = {
      mvc: this.detectMVCPattern(_directories),
      clean: this.detectCleanArchitecture(_directories),
      hexagonal: this.detectHexagonalArchitecture(_directories),
      layered: this.detectLayeredArchitecture(_directories),
      microservices: this.detectMicroservicesPattern(_directories),
    };

    // Find the pattern with highest confidence
    const _bestPattern = Object.entries(_patterns).sort(
      ([, a], [, b]) => b.confidence - a.confidence,
    )[0];

    return {
      type: _bestPattern[0] as ArchitecturePattern["type"],
      layers: _bestPattern[1].layers,
      conventions: _bestPattern[1].conventions,
    };
  }

  /**
   * Analyze testing setup
   */
  private async analyzeTestingSetup(rootPath: string): Promise<TestingSetup> {
    const _packageJsonPath = path.join(rootPath, "package.json");
    let testFramework: TestingSetup["framework"] = "none";
    let e2eFramework: string | undefined;

    try {
      const _packageJson = JSON.parse(
        await fs.readFile(_packageJsonPath, "utf-8"),
      );
      const _allDeps = {
        ..._packageJson.dependencies,
        ..._packageJson.devDependencies,
      };

      // Detect test framework
      if (_allDeps.jest) testFramework = "jest";
      else if (_allDeps.vitest) testFramework = "vitest";
      else if (_allDeps.mocha) testFramework = "mocha";

      // Detect E2E framework
      if (_allDeps.cypress) e2eFramework = "cypress";
      else if (_allDeps.playwright) e2eFramework = "playwright";
    } catch (_error) {
      // No package.json
    }

    // Count test _files
    const _testFiles = await this.countTestFiles(rootPath);
    const _testPatterns = this.getTestPatterns(testFramework);

    return {
      framework: testFramework,
      coverage:
        (await this.checkFileExists(path.join(rootPath, "jest.config.js"))) ||
        (await this.checkFileExists(path.join(rootPath, "vitest.config.ts"))),
      threshold: 80, // Default threshold
      _testFiles,
      _testPatterns,
      e2eFramework,
    };
  }

  /**
   * Analyze build configuration
   */
  private async analyzeBuildConfiguration(
    rootPath: string,
  ): Promise<BuildConfiguration> {
    const _config: BuildConfiguration = {
      bundler: "none",
      typescript: false,
      sourceMaps: false,
      minification: false,
      outputFormat: ["commonjs"],
      targetEnvironments: ["node"],
    };

    // Check for TypeScript
    config.typescript = await this.checkFileExists(
      path.join(rootPath, "tsconfig.json"),
    );

    // Detect bundler
    const _bundlerFiles = {
      "webpack.config.js": "webpack",
      "vite.config.ts": "vite",
      "vite.config.js": "vite",
      "rollup.config.js": "rollup",
      "tsup.config.ts": "tsup",
      "esbuild.config.js": "esbuild",
    };

    for (const [file, bundler] of Object.entries(_bundlerFiles)) {
      if (await this.checkFileExists(path.join(rootPath, file))) {
        config.bundler = bundler as any;
        break;
      }
    }

    // Analyze package.json for build info
    try {
      const _packageJson = JSON.parse(
        await fs.readFile(path.join(rootPath, "package.json"), "utf-8"),
      );
      if (_packageJson.type === "module") {
        config.outputFormat = ["esm"];
      }
      if (_packageJson.scripts?.build) {
        config.minification = _packageJson.scripts.build.includes("minify");
      }
    } catch (_error) {
      // No package.json
    }

    return _config;
  }

  /**
   * Analyze code quality metrics
   */
  private async analyzeQualityMetrics(
    rootPath: string,
  ): Promise<QualityMetrics> {
    const _sourceFiles = await this.getSourceFiles(rootPath);
    let totalLines = 0;
    const codeSmells: CodeSmell[] = [];

    for (const file of _sourceFiles) {
      try {
        const _content = await fs.readFile(file, "utf-8");
        const _lines = _content.split("\n");
        totalLines += _lines.length;

        // Detect code smells
        if (_lines.length > 300) {
          codeSmells.push({
            type: "large-class",
            file,
            line: 1,
            severity: "major",
            description: `File has ${_lines.length} _lines`,
            suggestion: "Consider breaking into smaller modules",
          });
        }

        // Check for long functions (simplified)
        const _functionMatches = _content.match(
          /function\s+\w+|const\s+\w+\s*=\s*\(/g,
        );
        if (_functionMatches && _functionMatches.length > 20) {
          codeSmells.push({
            type: "large-class",
            file,
            line: 1,
            severity: "minor",
            description: "Many functions in one file",
            suggestion: "Consider organizing into multiple _files",
          });
        }
      } catch (_error) {
        // Skip _files that can't be read
      }
    }

    return {
      maintainabilityIndex: Math.max(0, 100 - codeSmells.length * 5),
      cyclomaticComplexity: 3.2, // Would need proper AST analysis
      linesOfCode: totalLines,
      testCoverage: 0, // Would need test runner integration
      duplication: Math.min(
        20,
        codeSmells.filter((s) => s.type === "duplicate-code").length,
      ),
      technicalDebt: codeSmells.length * 10,
      codeSmells,
    };
  }

  /**
   * Analyze file _structure
   */
  private async analyzeFileStructure(
    rootPath: string,
  ): Promise<FileStructureAnalysis> {
    const _directoryStructure = await this.getDirectoryStructure(rootPath);
    const _allFiles = this.getAllFiles(_directoryStructure);

    const filesByType: Record<string, number> = {};
    allFiles.forEach((file) => {
      const _ext = path.extname(file).substring(1);
      filesByType[_ext] = (filesByType[_ext] || 0) + 1;
    });

    const _patterns = this.detectStructurePatterns(_directoryStructure);
    const _inconsistencies =
      this.detectStructureInconsistencies(_directoryStructure);

    return {
      totalFiles: _allFiles.length,
      filesByType,
      _directoryStructure,
      _patterns,
      _inconsistencies,
    };
  }

  /**
   * Analyze Git information
   */
  private async analyzeGitInfo(
    rootPath: string,
  ): Promise<GitInformation | undefined> {
    if (!(await this.checkFileExists(path.join(rootPath, ".git")))) {
      return undefined;
    }

    try {
      // This would typically use a Git library like simple-git
      // For now, return basic _structure
      return {
        branch: "main", // Would get from git command
        lastCommit: "abc123", // Would get from git log
        uncommittedChanges: false, // Would get from git status
        contributors: [], // Would get from git log
      };
    } catch (_error) {
      return undefined;
    }
  }

  // Helper methods
  private isCacheValid(_context: ProjectContext): boolean {
    // Simple time-based cache validation
    // In production, this would check file modification times
    return true;
  }

  private async checkFileExists(_filePath: string): Promise<boolean> {
    try {
      await fs.access(_filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async hasTypeScriptFiles(rootPath: string): Promise<boolean> {
    try {
      const _files = await fs.readdir(rootPath);
      return _files.some(
        (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
      );
    } catch {
      return false;
    }
  }

  private async detectFrameworks(
    _packageJson: unknown,
    _rootPath: string,
  ): Promise<string[]> {
    const _frameworks: string[] = [];
    const _allDeps = {
      ..._packageJson.dependencies,
      ..._packageJson.devDependencies,
    };

    if (_allDeps.react) _frameworks.push("react");
    if (_allDeps.vue) _frameworks.push("vue");
    if (_allDeps.angular) _frameworks.push("angular");
    if (_allDeps.express) _frameworks.push("express");
    if (_allDeps.fastify) _frameworks.push("fastify");
    if (_allDeps.next) _frameworks.push("nextjs");
    if (_allDeps.nuxt) _frameworks.push("nuxtjs");
    if (_allDeps["@nestjs/core"]) _frameworks.push("nestjs");

    return _frameworks;
  }

  private async detectPackageManager(
    rootPath: string,
  ): Promise<"npm" | "yarn" | "pnpm"> {
    if (await this.checkFileExists(path.join(rootPath, "pnpm-lock.yaml")))
      return "pnpm";
    if (await this.checkFileExists(path.join(rootPath, "yarn.lock")))
      return "yarn";
    return "npm";
  }

  private determineProjectType(
    _packageJson: unknown,
    _frameworks: string[],
  ): ProjectInfo["type"] {
    if (_packageJson.workspaces) return "monorepo";
    if (_frameworks.includes("express") || _frameworks.includes("fastify"))
      return "service";
    if (
      _packageJson.main &&
      !_frameworks.some((f) => ["react", "vue", "angular"].includes(f))
    )
      return "library";
    return "application";
  }

  private parseDependencies(
    _deps: Record<string, string>,
    _type: "production" | "development" | "peer",
  ): DependencyInfo[] {
    return Object.entries(_deps).map(([name, version]) => ({
      name,
      version,
      type: this.categorizeDependency(name),
      purpose: this.getDependencyPurpose(name),
    }));
  }

  private categorizeDependency(name: string): DependencyInfo["type"] {
    if (name.startsWith("@types/")) return "type-definition";
    if (["react", "vue", "angular", "express", "fastify"].includes(name))
      return "framework";
    if (["webpack", "vite", "eslint", "prettier", "jest"].includes(name))
      return "tool";
    return "library";
  }

  private getDependencyPurpose(name: string): string {
    const purposes: Record<string, string> = {
      react: "UI library",
      express: "Web framework",
      typescript: "Type checking",
      eslint: "Code linting",
      prettier: "Code formatting",
      jest: "Testing framework",
    };
    return purposes[name] || "Library dependency";
  }

  private async parsePrettierConfig(
    configPath: string,
  ): Promise<Partial<CodeStyleProfile> | null> {
    try {
      const _content = await fs.readFile(configPath, "utf-8");
      const _config = JSON.parse(_content);
      return {
        indentSize: _config.tabWidth || 2,
        quotes: _config.singleQuote ? "single" : "double",
        semicolons: _config.semi !== false,
        trailingComma: _config.trailingComma || "es5",
        lineLength: _config.printWidth || 80,
      };
    } catch {
      return null;
    }
  }

  private async detectCodeStyleFromFiles(
    _rootPath: string,
    style: CodeStyleProfile,
  ): Promise<void> {
    const _sourceFiles = await this.getSourceFiles(_rootPath);
    const _samples = _sourceFiles.slice(0, 5); // Sample first 5 _files

    for (const file of _samples) {
      try {
        const _content = await fs.readFile(file, "utf-8");

        // Detect indentation
        const _lines = _content.split("\n");
        for (const line of _lines) {
          if (line.startsWith("  ")) {
            style.indentation = "spaces";
            style.indentSize = 2;
            break;
          } else if (line.startsWith("    ")) {
            style.indentation = "spaces";
            style.indentSize = 4;
            break;
          } else if (line.startsWith("\t")) {
            style.indentation = "tabs";
            break;
          }
        }

        // Detect quotes (simplified)
        const _singleQuotes = (_content.match(/'/g) || []).length;
        const _doubleQuotes = (_content.match(/"/g) || []).length;
        if (_singleQuotes > _doubleQuotes) {
          style.quotes = "single";
        } else if (_doubleQuotes > _singleQuotes) {
          style.quotes = "double";
        }

        // Detect semicolons
        const _linesWithSemicolons = _lines.filter((line) =>
          line.trim().endsWith(";"),
        ).length;
        const _codeLines = _lines.filter(
          (line) => line.trim() && !line.trim().startsWith("//"),
        ).length;
        style.semicolons = _linesWithSemicolons > _codeLines * 0.5;
      } catch (_error) {
        // Skip _files that can't be read
      }
    }
  }

  private async getDirectoryStructure(
    rootPath: string,
  ): Promise<DirectoryNode> {
    const _stats = await fs.stat(rootPath);
    const node: DirectoryNode = {
      name: path.basename(rootPath),
      _path: rootPath,
      type: _stats.isDirectory() ? "directory" : "file",
      size: _stats.size,
    };

    if (_stats.isDirectory()) {
      try {
        const _entries = await fs.readdir(rootPath);
        node.children = [];

        for (const entry of _entries) {
          // Skip common ignore _patterns
          if (this.shouldIgnoreEntry(entry)) continue;

          const _entryPath = path.join(rootPath, entry);
          try {
            const _childNode = await this.getDirectoryStructure(_entryPath);
            node.children.push(_childNode);
          } catch (_error) {
            // Skip _entries that can't be accessed
          }
        }
      } catch (_error) {
        // Directory can't be read
      }
    }

    return node;
  }

  private shouldIgnoreEntry(entry: string): boolean {
    const _ignorePatterns = [
      "node_modules",
      ".git",
      "dist",
      "build",
      "coverage",
      ".DS_Store",
      ".env",
      "*.log",
    ];
    return _ignorePatterns.some(
      (pattern) => entry === pattern || entry.match(pattern.replace("*", ".*")),
    );
  }

  private getAllDirectories(node: DirectoryNode): string[] {
    const _directories: string[] = [];

    if (node.type === "directory") {
      directories.push(node.name);
      if (node.children) {
        for (const child of node.children) {
          directories.push(...this.getAllDirectories(child));
        }
      }
    }

    return _directories;
  }

  private getAllFiles(node: DirectoryNode): string[] {
    const _files: string[] = [];

    if (node.type === "file") {
      files.push(node._path);
    } else if (node.children) {
      for (const child of node.children) {
        files.push(...this.getAllFiles(child));
      }
    }

    return _files;
  }

  private async getSourceFiles(rootPath: string): Promise<string[]> {
    const _structure = await this.getDirectoryStructure(rootPath);
    const _allFiles = this.getAllFiles(_structure);

    return _allFiles.filter((file) => {
      const _ext = path.extname(file);
      return [".ts", ".tsx", ".js", ".jsx"].includes(_ext);
    });
  }

  private async countTestFiles(rootPath: string): Promise<number> {
    const _structure = await this.getDirectoryStructure(rootPath);
    const _allFiles = this.getAllFiles(_structure);

    return _allFiles.filter(
      (file) =>
        file.includes(".test.") ||
        file.includes(".spec.") ||
        file.includes("__tests__"),
    ).length;
  }

  private getTestPatterns(framework: TestingSetup["framework"]): string[] {
    const _patterns: Record<string, string[]> = {
      jest: [
        "**/*.test.{js,ts}",
        "**/*.spec.{js,ts}",
        "**/__tests__/**/*.{js,ts}",
      ],
      vitest: ["**/*.test.{js,ts}", "**/*.spec.{js,ts}"],
      mocha: ["test/**/*.js", "**/*.test.js"],
      cypress: ["cypress/**/*.spec.{js,ts}"],
      playwright: ["tests/**/*.spec.{js,ts}"],
      none: [],
    };
    return _patterns[framework] || [];
  }

  // Architecture detection methods
  private detectMVCPattern(_directories: string[]): {
    confidence: number;
    layers: string[];
    conventions: unknown;
  } {
    const _mvcDirs = ["controllers", "models", "views"];
    const _found = _mvcDirs.filter((dir) =>
      _directories.some((d) => d.toLowerCase().includes(dir)),
    );
    return {
      confidence: _found.length / _mvcDirs.length,
      layers: _found,
      conventions: { separation: "mvc" },
    };
  }

  private detectCleanArchitecture(_directories: string[]): {
    confidence: number;
    layers: string[];
    conventions: unknown;
  } {
    const _cleanDirs = [
      "domain",
      "application",
      "infrastructure",
      "presentation",
    ];
    const _found = _cleanDirs.filter((dir) =>
      _directories.some((d) => d.toLowerCase().includes(dir)),
    );
    return {
      confidence: _found.length / _cleanDirs.length,
      layers: _found,
      conventions: { separation: "clean" },
    };
  }

  private detectHexagonalArchitecture(_directories: string[]): {
    confidence: number;
    layers: string[];
    conventions: unknown;
  } {
    const _hexDirs = ["core", "ports", "adapters"];
    const _found = _hexDirs.filter((dir) =>
      _directories.some((d) => d.toLowerCase().includes(dir)),
    );
    return {
      confidence: _found.length / _hexDirs.length,
      layers: _found,
      conventions: { separation: "hexagonal" },
    };
  }

  private detectLayeredArchitecture(_directories: string[]): {
    confidence: number;
    layers: string[];
    conventions: unknown;
  } {
    const _layeredDirs = ["presentation", "business", "data", "services"];
    const _found = _layeredDirs.filter((dir) =>
      _directories.some((d) => d.toLowerCase().includes(dir)),
    );
    return {
      confidence: _found.length / _layeredDirs.length,
      layers: _found,
      conventions: { separation: "layered" },
    };
  }

  private detectMicroservicesPattern(_directories: string[]): {
    confidence: number;
    layers: string[];
    conventions: unknown;
  } {
    const _microDirs = ["services", "api", "gateway"];
    const _found = _microDirs.filter((dir) =>
      _directories.some((d) => d.toLowerCase().includes(dir)),
    );
    return {
      confidence: (_found.length / _microDirs.length) * 0.5, // Lower confidence as it's less definitive
      layers: _found,
      conventions: { separation: "microservices" },
    };
  }

  private detectStructurePatterns(
    _structure: DirectoryNode,
  ): StructurePattern[] {
    const _patterns: StructurePattern[] = [];

    // Feature-based pattern
    if (_structure.children?.some((child) => child.name === "features")) {
      patterns.push({
        name: "feature-based",
        confidence: 0.8,
        examples: ["features/auth", "features/user"],
        recommendation: "Continue using feature-based organization",
      });
    }

    // Component pattern
    if (_structure.children?.some((child) => child.name === "components")) {
      patterns.push({
        name: "component-driven",
        confidence: 0.9,
        examples: ["components/Button", "components/Modal"],
        recommendation: "Good component organization detected",
      });
    }

    return _patterns;
  }

  private detectStructureInconsistencies(
    _structure: DirectoryNode,
  ): StructureInconsistency[] {
    const _inconsistencies: StructureInconsistency[] = [];

    // Check for naming _inconsistencies
    const _allNodes = this.flattenStructure(_structure);
    const _fileNames = _allNodes
      .filter((n) => n.type === "file")
      .map((n) => n.name);

    const _camelCase = _fileNames.filter((name) =>
      /^[a-z][a-zA-Z0-9]*/.test(name),
    ).length;
    const _kebabCase = _fileNames.filter((name) =>
      /^[a-z][a-z0-9-]*$/.test(name),
    ).length;

    if (
      _camelCase > 0 &&
      _kebabCase > 0 &&
      Math.abs(_camelCase - _kebabCase) < _fileNames.length * 0.1
    ) {
      inconsistencies.push({
        type: "naming",
        description: "Mixed naming conventions detected",
        _files: _fileNames.slice(0, 5),
        suggestion:
          "Choose consistent naming convention (_camelCase or kebab-case)",
      });
    }

    return _inconsistencies;
  }

  private flattenStructure(node: DirectoryNode): DirectoryNode[] {
    const _nodes = [node];
    if (node.children) {
      for (const child of node.children) {
        nodes.push(...this.flattenStructure(child));
      }
    }
    return _nodes;
  }

  private getProjectTypeString(projectInfo: ProjectInfo): string {
    return `${projectInfo.language}-${projectInfo.type}${projectInfo.framework.length > 0 ? "-" + projectInfo.framework.join("-") : ""}`;
  }

  private extractFilePaths(_structure: DirectoryNode): string[] {
    const paths: string[] = [];

    if (_structure.type === "file") {
      paths.push(_structure._path);
    } else if (_structure.children) {
      for (const child of _structure.children) {
        paths.push(...this.extractFilePaths(child));
      }
    }

    return paths;
  }
}
