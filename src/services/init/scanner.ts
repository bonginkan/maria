/**
 * Enhanced Scanner Module v2
 * AST-based deep code analysis with dependency extraction
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { parse as parseTypeScript } from "@typescript-eslint/parser";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { globby } from "globby";
import type { _Node } from "@babel/types";

export interface CodeStructure {
  files: FileInfo[];
  dependencies: DependencyGraph;
  techStack: TechStack;
  complexity: ComplexityMetrics;
}

export interface FileInfo {
  _path: string;
  language: string;
  size: number;
  hash: string;
  lastModified: Date;
  ast?: ASTInfo;
  imports: string[];
  exports: string[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
}

export interface ASTInfo {
  nodeCount: number;
  depth: number;
  complexity: number;
}

export interface ClassInfo {
  name: string;
  methods: string[];
  properties: string[];
  extends?: string;
  implements?: string[];
  lineCount: number;
}

export interface FunctionInfo {
  name: string;
  params: string[];
  returnType?: string;
  async: boolean;
  complexity: number;
  lineCount: number;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: string[][];
}

export interface DependencyNode {
  id: string;
  type: "file" | "module" | "package";
  name: string;
  path?: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "import" | "export" | "require";
  count: number;
}

export interface TechStack {
  languages: string[];
  frameworks: string[];
  tools: string[];
  _packageManager?: string;
}

export interface ComplexityMetrics {
  totalFiles: number;
  totalLines: number;
  avgComplexity: number;
  maxComplexity: number;
  testCoverage?: number;
}

export interface ScanOptions {
  root: string;
  include?: string[];
  exclude?: string[];
  maxFiles?: number;
  budgetMs?: number;
  parallel?: boolean;
  detectCycles?: boolean;
}

export class EnhancedScanner {
  private fileCache = new Map<string, FileInfo>();
  private startTime = 0;
  private processedCount = 0;

  /**
   * Scan project and analyze code structure
   */
  async scanProject(options: ScanOptions): Promise<CodeStructure> {
    this.startTime = Date.now();

    // Discover files
    const files = await this.discoverFiles(options);

    // Analyze each file with AST parsing
    const fileInfos: FileInfo[] = [];
    for (const _filePath of files) {
      if (this.isTimeBudgetExceeded(options.budgetMs)) {
        break;
      }

      const info = await this.analyzeFile(_filePath, options.root);
      if (info) {
        fileInfos.push(info);
        this.fileCache.set(_filePath, info);
      }

      this.processedCount++;
      if (options.maxFiles && this.processedCount >= options.maxFiles) {
        break;
      }
    }

    // Build dependency graph
    const dependencies = this.buildDependencyGraph(fileInfos);

    // Detect circular dependencies if requested
    if (options.detectCycles) {
      dependencies.cycles = this.detectCycles(dependencies);
    }

    // Detect technology stack
    const techStack = this.detectTechStack(fileInfos, options.root);

    // Calculate complexity metrics
    const complexity = this.calculateComplexity(fileInfos);

    return {
      files: fileInfos,
      dependencies,
      techStack,
      complexity,
    };
  }

  /**
   * Discover files in project
   */
  private async discoverFiles(options: ScanOptions): Promise<string[]> {
    const patterns = options.include || ["**/*.{ts,tsx,js,jsx,mjs,cjs}"];
    const ignore = [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      ...(options.exclude || []),
    ];

    const files = await globby(patterns, {
      cwd: options.root,
      absolute: true,
      ignore,
      gitignore: true,
    });

    return files.sort();
  }

  /**
   * Analyze a single file with AST parsing
   */
  private async analyzeFile(
    _filePath: string,
    root: string,
  ): Promise<FileInfo | null> {
    try {
      const content = await fs.readFile(_filePath, "utf-8");
      const stat = await fs.stat(_filePath);
      const ext = path.extname(_filePath).toLowerCase();
      const language = this.detectLanguage(ext);

      // Calculate file hash
      const hash = crypto.createHash("sha256").update(content).digest("hex");

      // Parse AST based on language
      let ast: any = null;
      let imports: string[] = [];
      let exports: string[] = [];
      let classes: ClassInfo[] = [];
      let functions: FunctionInfo[] = [];

      if (language === "typescript" || language === "javascript") {
        const parsed = await this.parseJavaScriptFile(content, _filePath);
        ast = parsed.ast;
        imports = parsed.imports;
        exports = parsed.exports;
        classes = parsed.classes;
        functions = parsed.functions;
      }

      return {
        _path: path.relative(root, _filePath),
        language,
        size: stat.size,
        hash,
        lastModified: stat.mtime,
        ast: ast
          ? {
              nodeCount: this.countNodes(ast),
              depth: this.calculateDepth(ast),
              complexity: this.calculateCyclomaticComplexity(ast),
            }
          : undefined,
        imports,
        exports,
        classes,
        functions,
      };
    } catch (error) {
      console.warn(`Failed to analyze ${_filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse JavaScript/TypeScript file
   */
  private async parseJavaScriptFile(content: string, _filePath: string) {
    const isTypeScript =
      _filePath.endsWith(".ts") || _filePath.endsWith(".tsx");

    let ast: any;
    const imports: string[] = [];
    const exports: string[] = [];
    const classes: ClassInfo[] = [];
    const functions: FunctionInfo[] = [];

    try {
      if (isTypeScript) {
        // Use TypeScript parser
        ast = parseTypeScript(content, {
          sourceType: "module",
          ecmaVersion: 2022,
          ecmaFeatures: {
            jsx: _filePath.endsWith(".tsx"),
          },
        });
      } else {
        // Use Babel parser for JavaScript
        ast = parser.parse(content, {
          sourceType: "module",
          plugins: ["jsx", "typescript", "decorators-legacy"],
        });
      }

      // Extract imports, exports, classes, and functions
      traverse(ast, {
        ImportDeclaration(_path) {
          if (_path.node.source?.value) {
            imports.push(_path.node.source.value as string);
          }
        },
        ExportNamedDeclaration(_path) {
          if (_path.node.source?.value) {
            exports.push(_path.node.source.value as string);
          } else if (_path.node.declaration) {
            // Local export
            exports.push("local");
          }
        },
        ExportDefaultDeclaration() {
          exports.push("default");
        },
        ClassDeclaration(_path) {
          const node = _path.node;
          const className = node.id?.name || "Anonymous";
          const methods: string[] = [];
          const properties: string[] = [];

          // Extract class details
          node.body.body.forEach((member: any) => {
            if (
              member.type === "ClassMethod" ||
              member.type === "MethodDefinition"
            ) {
              methods.push(member.key?.name || "anonymous");
            } else if (
              member.type === "ClassProperty" ||
              member.type === "PropertyDefinition"
            ) {
              properties.push(member.key?.name || "anonymous");
            }
          });

          classes.push({
            name: className,
            methods,
            properties,
            extends: node.superClass ? "BaseClass" : undefined,
            lineCount:
              (node.loc?.end?.line || 0) - (node.loc?.start?.line || 0),
          });
        },
        FunctionDeclaration(_path) {
          const node = _path.node;
          functions.push({
            name: node.id?.name || "anonymous",
            params: node.params.map((p: any) => p.name || "param"),
            async: node.async || false,
            complexity: 1, // Will be calculated properly later
            lineCount:
              (node.loc?.end?.line || 0) - (node.loc?.start?.line || 0),
          });
        },
        ArrowFunctionExpression(_path) {
          const node = _path.node;
          const parent = _path.parent as any;
          const name = parent.id?.name || "arrow";

          functions.push({
            name,
            params: node.params.map((p: any) => p.name || "param"),
            async: node.async || false,
            complexity: 1,
            lineCount:
              (node.loc?.end?.line || 0) - (node.loc?.start?.line || 0),
          });
        },
      });
    } catch (error) {
      // Fallback to basic parsing
      console.warn(`AST parsing failed for ${_filePath}, using fallback`);
    }

    return { ast, imports, exports, classes, functions };
  }

  /**
   * Build dependency graph from file information
   */
  private buildDependencyGraph(files: FileInfo[]): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const edgeMap = new Map<string, DependencyEdge>();

    // Create nodes for each file
    files.forEach((file) => {
      nodes.push({
        id: file._path,
        type: "file",
        name: path.basename(file._path),
        _path: file.path,
      });
    });

    // Create edges for imports
    files.forEach((file) => {
      file.imports.forEach((importPath) => {
        const edgeKey = `${file.path}->${importPath}`;
        const existing = edgeMap.get(edgeKey);

        if (existing) {
          existing.count++;
        } else {
          const edge: DependencyEdge = {
            from: file._path,
            to: importPath,
            type: "import",
            count: 1,
          };
          edges.push(edge);
          edgeMap.set(edgeKey, edge);
        }
      });
    });

    return {
      nodes,
      edges,
      cycles: [],
    };
  }

  /**
   * Detect circular dependencies
   */
  private detectCycles(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, _path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const edges = graph.edges.filter((e) => e.from === node);
      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          dfs(edge.to, [..._path]);
        } else if (recursionStack.has(edge.to)) {
          // Found a cycle
          const cycleStart = _path.indexOf(edge.to);
          if (cycleStart !== -1) {
            cycles.push(_path.slice(cycleStart));
          }
        }
      }

      recursionStack.delete(node);
    };

    // Run DFS from each unvisited node
    graph.nodes.forEach((node) => {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    });

    return cycles;
  }

  /**
   * Detect technology stack
   */
  private detectTechStack(files: FileInfo[], root: string): TechStack {
    const languages = new Set<string>();
    const frameworks = new Set<string>();
    const tools = new Set<string>();
    let _packageManager: string | undefined;

    // Detect languages from files
    files.forEach((file) => {
      if (file.language) {
        languages.add(file.language);
      }
    });

    // Check for package.json
    try {
      const packageJsonPath = path.join(root, "package.json");
      const packageJson = require(packageJsonPath);

      // Detect frameworks from dependencies
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (deps.react) frameworks.add("react");
      if (deps.vue) frameworks.add("vue");
      if (deps.angular) frameworks.add("angular");
      if (deps.express) frameworks.add("express");
      if (deps.next) frameworks.add("nextjs");
      if (deps.nest) frameworks.add("nestjs");

      // Detect tools
      if (deps.typescript) tools.add("typescript");
      if (deps.webpack) tools.add("webpack");
      if (deps.vite) tools.add("vite");
      if (deps.jest) tools.add("jest");
      if (deps.vitest) tools.add("vitest");
      if (deps.eslint) tools.add("eslint");
      if (deps.prettier) tools.add("prettier");
    } catch {
      // No package.json or error reading it
    }

    // Detect package manager
    const hasYarnLock = files.some((f) => f.path.includes("yarn.lock"));
    const hasPnpmLock = files.some((f) => f.path.includes("pnpm-lock.yaml"));

    if (hasPnpmLock) {
      _packageManager = "pnpm";
    } else if (hasYarnLock) {
      _packageManager = "yarn";
    } else {
      _packageManager = "npm";
    }

    return {
      languages: Array.from(languages),
      frameworks: Array.from(frameworks),
      tools: Array.from(tools),
      _packageManager,
    };
  }

  /**
   * Calculate complexity metrics
   */
  private calculateComplexity(files: FileInfo[]): ComplexityMetrics {
    let totalLines = 0;
    let totalComplexity = 0;
    let maxComplexity = 0;
    let complexityCount = 0;

    files.forEach((file) => {
      // Estimate lines from file size (rough approximation)
      const estimatedLines = Math.floor(file.size / 50); // ~50 bytes per line
      totalLines += estimatedLines;

      if (file.ast?.complexity) {
        totalComplexity += file.ast.complexity;
        maxComplexity = Math.max(maxComplexity, file.ast.complexity);
        complexityCount++;
      }
    });

    return {
      totalFiles: files.length,
      totalLines,
      avgComplexity:
        complexityCount > 0 ? totalComplexity / complexityCount : 0,
      maxComplexity,
    };
  }

  /**
   * Helper: Detect language from file extension
   */
  private detectLanguage(ext: string): string {
    const languageMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".mjs": "javascript",
      ".cjs": "javascript",
      ".py": "python",
      ".java": "java",
      ".go": "go",
      ".rs": "rust",
      ".cpp": "cpp",
      ".c": "c",
      ".cs": "csharp",
      ".rb": "ruby",
      ".php": "php",
      ".swift": "swift",
      ".kt": "kotlin",
    };

    return languageMap[ext] || "unknown";
  }

  /**
   * Helper: Count AST nodes
   */
  private countNodes(ast: any): number {
    let count = 0;

    const visit = (node: any) => {
      if (!node || typeof node !== "object") return;
      count++;

      for (const key in node) {
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(visit);
        } else if (typeof value === "object") {
          visit(value);
        }
      }
    };

    visit(ast);
    return count;
  }

  /**
   * Helper: Calculate AST depth
   */
  private calculateDepth(ast: any): number {
    let maxDepth = 0;

    const visit = (node: any, depth: number) => {
      if (!node || typeof node !== "object") return;
      maxDepth = Math.max(maxDepth, depth);

      for (const key in node) {
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach((v) => visit(v, depth + 1));
        } else if (typeof value === "object") {
          visit(value, depth + 1);
        }
      }
    };

    visit(ast, 0);
    return maxDepth;
  }

  /**
   * Helper: Calculate cyclomatic complexity
   */
  private calculateCyclomaticComplexity(ast: any): number {
    let complexity = 1; // Base complexity

    const visit = (node: any) => {
      if (!node || typeof node !== "object") return;

      // Increment complexity for control flow statements
      if (
        node.type === "IfStatement" ||
        node.type === "ConditionalExpression"
      ) {
        complexity++;
      } else if (node.type === "SwitchCase") {
        complexity++;
      } else if (
        node.type === "ForStatement" ||
        node.type === "WhileStatement" ||
        node.type === "DoWhileStatement"
      ) {
        complexity++;
      } else if (node.type === "CatchClause") {
        complexity++;
      } else if (
        node.type === "LogicalExpression" &&
        (node.operator === "&&" || node.operator === "||")
      ) {
        complexity++;
      }

      for (const key in node) {
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(visit);
        } else if (typeof value === "object") {
          visit(value);
        }
      }
    };

    visit(ast);
    return complexity;
  }

  /**
   * Helper: Check if time budget exceeded
   */
  private isTimeBudgetExceeded(budgetMs?: number): boolean {
    if (!budgetMs) return false;
    return Date.now() - this.startTime > budgetMs;
  }
}

// Export singleton instance
export const scanner = new EnhancedScanner();
