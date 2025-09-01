/**
 * Phase 4.2 Knowledge Graph - Dependency Analyzer
 * AST-based analysis for TypeScript/JavaScript code _dependencies
 */

import fs from "fs/promises";
import path from "path";
import { parse } from "@typescript-eslint/typescript-estree";
import type { TSESTree } from "@typescript-eslint/typescript-estree";
import type {
  CodeNode,
  _Edge,
  Dependencies,
  _ImportInfo,
  _ExportInfo,
} from "../types/graph.types.js";
import { _GraphEngine } from "../core/GraphEngine.js";

export class DependencyAnalyzer {
  private readonly MAX_EDGES_PER_NODE = 100;
  private readonly SUPPORTED_EXTENSIONS = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
  ];

  constructor() {
    // Constructor implementation
  }

  /**
   * Analyze a single file for _dependencies
   */
  async analyzeFile(_filePath: string): Promise<Dependencies> {
    try {
      const _content = await fs.readFile(_filePath, "utf-8");
      const _ast = await this.parseWithTsEslint(_content, _filePath);

      const _dependencies: Dependencies = {
        imports: [],
        exports: [],
        calls: [],
        fileMetadata: {
          _path: _filePath,
          language: this.detectLanguage(_filePath),
          size: _content.length,
          lastModified: await this.getLastModified(_filePath),
        },
      };

      // Extract _dependencies using AST visitor pattern
      this.visitAST(_ast, _dependencies);

      return _dependencies;
    } catch (error) {
      console.warn(`Failed to analyze file ${_filePath}:`, error);
      return this.createEmptyDependencies(_filePath);
    }
  }

  /**
   * Build dependency _graph from a root directory
   */
  async buildDependencyGraph(rootDir: string): Promise<GraphEngine> {
    console.log(`🔍 Building dependency _graph from: ${rootDir}`);

    const _sourceFiles = await this.findSourceFiles(rootDir);
    const _limitedFiles = _sourceFiles.slice(0, this.maxFiles);

    console.log(
      `📁 Found ${_sourceFiles.length} files, processing ${_limitedFiles.length}`,
    );

    const _graph = new GraphEngine({
      maxNodes: this.maxFiles + 1000, // Extra room for functions/classes
      maxEdgesPerNode: this.MAX_EDGES_PER_NODE,
      enableIndexing: true,
    });

    // Phase 1: Add file nodes
    const fileNodes: Map<string, CodeNode> = new Map();

    for (const _filePath of _limitedFiles) {
      const _node = await this.createFileNode(_filePath);
      if (_node) {
        graph.addNode(_node);
        fileNodes.set(_filePath, _node);
      }
    }

    console.log(`📦 Added ${fileNodes.size} file nodes`);

    // Phase 2: Analyze _dependencies and add edges
    let edgeCount = 0;

    for (const [_filePath, _node] of fileNodes.entries()) {
      try {
        const _dependencies = await this.analyzeFile(_filePath);

        // Add import edges
        for (const importInfo of _dependencies.imports) {
          const _targetPath = this.resolveImportPath(
            importInfo.source,
            _filePath,
            rootDir,
          );
          const _targetNode = fileNodes.get(_targetPath);

          if (_targetNode && _targetPath !== _filePath) {
            const _success = _graph.addEdge(_node.id, _targetNode.id, {
              type: "imports",
              weight: 0.8,
            });

            if (_success) edgeCount++;
          }
        }

        // Add function/class nodes and call edges
        await this.addDetailedNodes(_filePath, _dependencies, _graph, _node.id);
      } catch (innerError) {
        console.warn(
          `Failed to process _dependencies for ${_filePath}:`,
          error,
        );
      }
    }

    console.log(`🔗 Added ${edgeCount} dependency edges`);
    console.log(`📊 Graph _stats:`, _graph.getStats());

    return _graph;
  }

  /**
   * Resolve import paths to absolute file paths
   */
  private resolveImportPath(
    _importSource: string,
    fromFile: string,
    rootDir: string,
  ): string {
    // Handle relative imports
    if (_importSource.startsWith("./") || _importSource.startsWith("../")) {
      const _fromDir = path.dirname(fromFile);
      const _resolved = path.resolve(_fromDir, _importSource);

      // Try different extensions
      for (const _ext of this.SUPPORTED_EXTENSIONS) {
        if (_resolved.endsWith(_ext)) {
          return _resolved;
        }

        const _withExt = _resolved + _ext;
        try {
          require.resolve(_withExt);
          return _withExt;
        } catch {
          // Try index files
          const _indexFile = path.join(_resolved, `index${_ext}`);
          try {
            require.resolve(_indexFile);
            return _indexFile;
          } catch {
            continue;
          }
        }
      }

      return _resolved;
    }

    // Handle absolute imports from project root
    if (
      !_importSource.startsWith("@") &&
      !_importSource.includes("node_modules")
    ) {
      const _resolved = path.resolve(rootDir, _importSource);

      for (const _ext of this.SUPPORTED_EXTENSIONS) {
        const _withExt = _resolved + _ext;
        try {
          require.resolve(_withExt);
          return _withExt;
        } catch {
          continue;
        }
      }

      return _resolved;
    }

    // External packages - return as-is for now
    return _importSource;
  }

  /**
   * Find all source files in directory
   */
  private async findSourceFiles(rootDir: string): Promise<string[]> {
    const files: string[] = [];

    async function traverse(dir: string): Promise<void> {
      try {
        const _entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of _entries) {
          const _fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip common directories to ignore
            if (
              !["node_modules", ".git", "dist", "build", ".next"].includes(
                entry.name,
              )
            ) {
              await traverse(_fullPath);
            }
          } else if (entry.isFile()) {
            const _ext = path.extname(entry.name);
            if ([".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(_ext)) {
              files.push(_fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to read directory ${dir}:`, error);
      }
    }

    await traverse(rootDir);
    return files;
  }

  /**
   * Parse TypeScript/JavaScript with AST
   */
  private async parseWithTsEslint(
    _content: string,
    _filePath: string,
  ): Promise<TSESTree.Program> {
    const _isTypeScript =
      _filePath.endsWith(".ts") || _filePath.endsWith(".tsx");

    return parse(_content, {
      loc: true,
      range: true,
      comment: false,
      tokens: false,
      jsx: _filePath.endsWith(".tsx") || _filePath.endsWith(".jsx"),
      useJSXTextNode: true,
      ecmaVersion: 2022,
      sourceType: "module",
      ecmaFeatures: {
        jsx: true,
        globalReturn: false,
      },
      ...(_isTypeScript && {
        project: undefined, // Skip type checking for speed
        tsconfigRootDir: process.cwd(),
      }),
    });
  }

  /**
   * Visit AST nodes and extract _dependencies
   */
  private visitAST(_ast: TSESTree.Program, _dependencies: Dependencies): void {
    const _visit = (_node: TSESTree.Node): void => {
      switch (node.type) {
        case "ImportDeclaration":
          this.handleImportDeclaration(_node, _dependencies);
          break;

        case "ExportNamedDeclaration":
        case "ExportDefaultDeclaration":
        case "ExportAllDeclaration":
          this.handleExportDeclaration(_node, _dependencies);
          break;

        case "CallExpression":
          this.handleCallExpression(_node, _dependencies);
          break;
      }

      // Recursively _visit child nodes
      for (const [_key, value] of Object.entries(_node)) {
        if (value && typeof value === "object") {
          if (Array.isArray(value)) {
            value.forEach((_item) => {
              if (_item && typeof _item.type === "string") {
                _visit(_item);
              }
            });
          } else if (typeof value.type === "string") {
            _visit(value);
          }
        }
      }
    };

    _visit(_ast);
  }

  private handleImportDeclaration(
    _node: TSESTree.ImportDeclaration,
    deps: Dependencies,
  ): void {
    if (
      _node.source.type === "Literal" &&
      typeof _node.source.value === "string"
    ) {
      const specifiers: string[] = [];
      let isDefault = false;
      let isNamespace = false;

      for (const spec of _node.specifiers) {
        switch (spec.type) {
          case "ImportDefaultSpecifier":
            specifiers.push(spec.local.name);
            isDefault = true;
            break;
          case "ImportNamespaceSpecifier":
            specifiers.push(spec.local.name);
            isNamespace = true;
            break;
          case "ImportSpecifier":
            specifiers.push(spec.local.name);
            break;
        }
      }

      deps.imports.push({
        source: _node.source.value,
        specifiers,
        isDefault,
        isNamespace,
      });
    }
  }

  private handleExportDeclaration(
    _node:
      | TSESTree.ExportNamedDeclaration
      | TSESTree.ExportDefaultDeclaration
      | TSESTree.ExportAllDeclaration,
    deps: Dependencies,
  ): void {
    if (_node.type === "ExportDefaultDeclaration") {
      deps.exports.push({
        name: "default",
        type: "default",
        isDefault: true,
      });
    } else if (_node.type === "ExportNamedDeclaration") {
      if (_node.declaration) {
        // Handle declared exports (export const _foo = ...)
        if (_node.declaration.type === "VariableDeclaration") {
          for (const decl of _node.declaration.declarations) {
            if (decl.id.type === "Identifier") {
              deps.exports.push({
                name: decl.id.name,
                type: "variable",
              });
            }
          }
        } else if (
          _node.declaration.type === "FunctionDeclaration" &&
          _node.declaration.id
        ) {
          deps.exports.push({
            name: _node.declaration.id.name,
            type: "function",
          });
        } else if (
          _node.declaration.type === "ClassDeclaration" &&
          _node.declaration.id
        ) {
          deps.exports.push({
            name: _node.declaration.id.name,
            type: "class",
          });
        }
      }

      // Handle specifier exports (export { foo, bar })
      for (const spec of _node.specifiers || []) {
        if (spec.type === "ExportSpecifier") {
          deps.exports.push({
            name:
              spec.exported.type === "Identifier"
                ? spec.exported.name
                : "unknown",
            type: "variable",
          });
        }
      }
    }
  }

  private handleCallExpression(
    _node: TSESTree.CallExpression,
    deps: Dependencies,
  ): void {
    if (_node.callee.type === "Identifier") {
      deps.calls.push(_node.callee.name);
    } else if (
      _node.callee.type === "MemberExpression" &&
      node.callee.property.type === "Identifier"
    ) {
      deps.calls.push(_node.callee.property.name);
    }
  }

  /**
   * Create a file _node from file path
   */
  private async createFileNode(_filePath: string): Promise<CodeNode | null> {
    try {
      const _stats = await fs.stat(_filePath);

      return {
        id: this.generateNodeId(_filePath),
        type: "file",
        name: path.basename(_filePath),
        _path: _filePath,
        metadata: {
          size: _stats.size,
          lastModified: _stats.mtime,
          language: this.detectLanguage(_filePath),
          lastAccessed: new Date(),
        },
      };
    } catch (innerError) {
      console.warn(`Failed to create _node for ${_filePath}:`, error);
      return null;
    }
  }

  /**
   * Add detailed nodes for functions and classes
   */
  private async addDetailedNodes(
    _filePath: string,
    _dependencies: Dependencies,
    _graph: GraphEngine,
    fileNodeId: string,
  ): Promise<void> {
    // For now, just add export nodes as child nodes of the file
    for (const exportInfo of _dependencies.exports) {
      const _nodeId = `${fileNodeId}:${exportInfo.name}`;

      const _node: CodeNode = {
        id: _nodeId,
        type:
          exportInfo.type === "function"
            ? "function"
            : exportInfo.type === "class"
              ? "class"
              : "module",
        name: exportInfo.name,
        _path: `${_filePath}#${exportInfo.name}`,
        metadata: {
          size: 0,
          lastModified: new Date(),
          language: this.detectLanguage(_filePath),
          lastAccessed: new Date(),
        },
      };

      _graph.addNode(_node);

      // Add edge from file to its exports
      graph.addEdge(fileNodeId, _nodeId, {
        type: "uses",
        weight: 1.0,
      });
    }
  }

  private detectLanguage(_filePath: string): string {
    const _ext = path.extname(_filePath);
    switch (_ext) {
      case ".ts":
      case ".tsx":
        return "typescript";
      case ".js":
      case ".jsx":
      case ".mjs":
        return "javascript";
      default:
        return "unknown";
    }
  }

  private async getLastModified(_filePath: string): Promise<Date> {
    try {
      const _stats = await fs.stat(_filePath);
      return _stats.mtime;
    } catch {
      return new Date();
    }
  }

  private generateNodeId(_filePath: string): string {
    // Simple hash-based ID generation
    let hash = 0;
    for (let i = 0; i < _filePath.length; i++) {
      const _char = _filePath.charCodeAt(i);
      hash = (hash << 5) - hash + _char;
      hash = hash & hash;
    }
    return `file_${Math.abs(hash).toString(36)}`;
  }

  private createEmptyDependencies(_filePath: string): Dependencies {
    return {
      imports: [],
      exports: [],
      calls: [],
      fileMetadata: {
        _path: _filePath,
        language: this.detectLanguage(_filePath),
        size: 0,
        lastModified: new Date(),
      },
    };
  }
}
