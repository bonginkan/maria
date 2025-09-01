/**
 * Enhanced /init Command with Graph RAG
 * Full codebase analysis with knowledge graph construction
 */

import * as path from "path";
import * as fs from "fs/promises";
import _chalk from "chalk";
import { EnhancedScanner } from "./scanner";
import { DeltaDetector } from "./delta-detector";
import { OpenSearchClient, QdrantClient, Neo4jClient } from "./clients.safe";
import { Logger } from "./logging";
import type { KnowledgeGraphService } from "../knowledge-graph/KnowledgeGraphService";
import type { DualMemoryEngine } from "../memory-system/dual-memory-engine";

export interface InitOptions {
  root?: string;
  force?: boolean;
  json?: boolean;
  verbose?: boolean;
  skipDocs?: boolean;
  skipTests?: boolean;
  parallel?: number;
  maxDepth?: number;
  budgetMs?: number;
}

export interface InitResult {
  success: boolean;
  stats: {
    filesScanned: number;
    filesIndexed: number;
    nodesCreated: number;
    edgesCreated: number;
    timeMs: number;
  };
  artifacts: {
    mariaMd: string;
    depMapJson: any;
    stateJson: any;
  };
  warnings: string[];
}

/**
 * Main init command implementation
 */
export class InitCommand {
  private logger: Logger;
  private scanner: EnhancedScanner;
  private openSearch?: OpenSearchClient;
  private qdrant?: QdrantClient;
  private neo4j?: Neo4jClient;

  constructor(
    private knowledgeGraph?: KnowledgeGraphService,
    private memoryEngine?: DualMemoryEngine,
  ) {
    this.logger = new Logger({ json: false });
    this.scanner = new EnhancedScanner();
  }

  /**
   * Execute full codebase initialization
   */
  async execute(options: InitOptions = {}): Promise<InitResult> {
    const startTime = Date.now();
    const root = options.root || process.cwd();
    const stateDir = path.join(root, ".maria");
    const statePath = path.join(stateDir, "state.json");

    this.logger.header("MARIA /init - Enhanced Codebase Analysis");

    // Check existing state
    const hasExistingState = await this.fileExists(statePath);
    if (hasExistingState && !options.force) {
      this.logger.warn(
        "Existing state detected. Use --force to override or /update for incremental",
      );
      const deltaDetector = new DeltaDetector();
      const delta = await deltaDetector.detectDelta(root, { since: "state" });

      if (delta.files.length > 0) {
        this.logger.info(
          `Found ${delta.files.length} changed files since last scan`,
        );
        this.logger.info(
          'Run "/update" for incremental update or "/init --force" for full rescan',
        );
      }

      return {
        success: false,
        stats: {
          filesScanned: 0,
          filesIndexed: 0,
          nodesCreated: 0,
          edgesCreated: 0,
          timeMs: 0,
        },
        artifacts: { mariaMd: "", depMapJson: {}, stateJson: {} },
        warnings: ["Use /update for incremental updates"],
      };
    }

    try {
      // Phase 1: Scan codebase
      this.logger.section("Phase 1: Scanning Codebase");
      const scanResult = await this.scanCodebase(root, options);

      // Phase 2: Build knowledge graph
      this.logger.section("Phase 2: Building Knowledge Graph");
      const graphResult = await this.buildKnowledgeGraph(scanResult, options);

      // Phase 3: Index for search
      this.logger.section("Phase 3: Indexing for Search");
      const indexResult = await this.indexForSearch(scanResult, options);

      // Phase 4: Generate artifacts
      this.logger.section("Phase 4: Generating Artifacts");
      const artifacts = await this.generateArtifacts(
        root,
        scanResult,
        graphResult,
      );

      // Save state
      await this.saveState(stateDir, {
        version: "3.2.2",
        timestamp: new Date().toISOString(),
        root,
        stats: scanResult.stats,
        graph: graphResult,
        index: indexResult,
      });

      const timeMs = Date.now() - startTime;

      // Display summary
      this.logger.summary({
        "Files Scanned": scanResult.stats.totalFiles,
        "Files Indexed": indexResult.filesIndexed,
        "Knowledge Nodes": graphResult.nodesCreated,
        Relationships: graphResult.edgesCreated,
        "Total Time": `${(timeMs / 1000).toFixed(2)}s`,
      });

      this.logger.success(
        "Initialization complete! MARIA.md has been updated.",
      );

      return {
        success: true,
        stats: {
          filesScanned: scanResult.stats.totalFiles,
          filesIndexed: indexResult.filesIndexed,
          nodesCreated: graphResult.nodesCreated,
          edgesCreated: graphResult.edgesCreated,
          timeMs,
        },
        artifacts,
        warnings: scanResult.warnings || [],
      };
    } catch (error: any) {
      this.logger.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Phase 1: Scan codebase with AST parsing
   */
  private async scanCodebase(root: string, options: InitOptions) {
    this.logger.start("scan", "Scanning project structure...");

    const scanOptions = {
      root,
      skipDocs: options.skipDocs,
      skipTests: options.skipTests,
      maxDepth: options.maxDepth || 10,
      parallel: options.parallel || 4,
      budgetMs: options.budgetMs || 30000,
    };

    const result = await this.scanner.scanProject(scanOptions);

    this.logger.done("scan", `Scanned ${result.stats.totalFiles} files`);

    // Report key findings
    if (result.techStack.length > 0) {
      this.logger.info(`Detected tech stack: ${result.techStack.join(", ")}`);
    }

    if (result.circularDeps.length > 0) {
      this.logger.warn(
        `Found ${result.circularDeps.length} circular dependencies`,
      );
    }

    return result;
  }

  /**
   * Phase 2: Build knowledge graph
   */
  private async buildKnowledgeGraph(scanResult: any, options: InitOptions) {
    this.logger.start("graph", "Constructing knowledge graph...");

    // Initialize Neo4j if available
    if (process.env.NEO4J_URI) {
      this.neo4j = new Neo4jClient(
        process.env.NEO4J_URI,
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "password",
      );

      await this.neo4j.ensureSchema();
    }

    let nodesCreated = 0;
    let edgesCreated = 0;

    // Process files into nodes
    const nodes: any[] = [];
    const edges: any[] = [];

    for (const file of scanResult.files) {
      // Create file node
      nodes.push({
        id: file._path,
        type: "file",
        name: path.basename(file._path),
        language: file.language,
        size: file.size,
        complexity: file.complexity,
      });
      nodesCreated++;

      // Create dependency edges
      for (const dep of file.dependencies || []) {
        edges.push({
          from: file._path,
          to: dep._path,
          type: dep.type, // 'import' | 'require' | 'dynamic'
        });
        edgesCreated++;
      }

      // Create symbol nodes (classes, functions)
      for (const symbol of file.symbols || []) {
        nodes.push({
          id: `${file.path}#${symbol.name}`,
          type: symbol.type, // 'class' | 'function' | 'interface'
          name: symbol.name,
          file: file._path,
          exported: symbol.exported,
        });
        nodesCreated++;

        // File contains symbol
        edges.push({
          from: file._path,
          to: `${file.path}#${symbol.name}`,
          type: "contains",
        });
        edgesCreated++;
      }
    }

    // Apply to Neo4j if available
    if (this.neo4j) {
      const _graphDiff = {
        nodes: { upsert: nodes },
        edges: { upsert: edges },
      };

      await this.neo4j.applyDiff(nodes, undefined, edges);
    }

    // Apply to KnowledgeGraphService if available
    if (this.knowledgeGraph) {
      await this.knowledgeGraph.analyzeProject(scanResult.root);
    }

    this.logger.done(
      "graph",
      `Created ${nodesCreated} nodes, ${edgesCreated} edges`,
    );

    return { nodesCreated, edgesCreated, nodes, edges };
  }

  /**
   * Phase 3: Index for search
   */
  private async indexForSearch(scanResult: any, options: InitOptions) {
    this.logger.start("index", "Indexing for search...");

    let filesIndexed = 0;

    // Initialize OpenSearch if available
    if (process.env.OPENSEARCH_URI) {
      this.openSearch = new OpenSearchClient(process.env.OPENSEARCH_URI);
      await this.openSearch.ensureIndex("maria_code", {
        properties: {
          _path: { type: "keyword" },
          content: { type: "text" },
          language: { type: "keyword" },
          size: { type: "long" },
          complexity: { type: "float" },
          timestamp: { type: "date" },
        },
      });

      // Index files
      const docs = scanResult.files.map((file: any) => ({
        id: file._path,
        doc: {
          _path: file._path,
          content: file.content?.substring(0, 10000), // Limit content size
          language: file.language,
          size: file.size,
          complexity: file.complexity,
          timestamp: new Date().toISOString(),
        },
      }));

      const result = await this.openSearch.upsertDocs("maria_code", docs);
      filesIndexed = result.upserted;
    }

    // Initialize Qdrant if available
    if (process.env.QDRANT_URI) {
      this.qdrant = new QdrantClient(process.env.QDRANT_URI);
      await this.qdrant.ensureCollection("maria_code", 768);

      // Would generate embeddings and index here
      // Placeholder for now
    }

    // Update memory engine if available
    if (this.memoryEngine) {
      for (const file of scanResult.files.slice(0, 100)) {
        // Limit for memory
        await this.memoryEngine.store({
          id: file._path,
          content: `File: ${file.path}\n${file.summary || ""}`,
          metadata: {
            type: "code",
            language: file.language,
            timestamp: Date.now(),
          },
        });
      }
    }

    this.logger.done("index", `Indexed ${filesIndexed} files`);

    return { filesIndexed };
  }

  /**
   * Phase 4: Generate artifacts (MARIA.md, dependency map, etc.)
   */
  private async generateArtifacts(
    root: string,
    scanResult: any,
    graphResult: any,
  ) {
    this.logger.start("artifacts", "Generating artifacts...");

    // Generate MARIA.md
    const mariaMd = this.generateMariaMd(scanResult, graphResult);
    const mariaMdPath = path.join(root, "MARIA.md");
    await fs.writeFile(mariaMdPath, mariaMd, "utf-8");

    // Generate dependency map
    const depMapJson = {
      version: "3.2.2",
      timestamp: new Date().toISOString(),
      stats: scanResult.stats,
      techStack: scanResult.techStack,
      structure: {
        files: scanResult.files.length,
        dependencies: scanResult.dependencies,
        circularDeps: scanResult.circularDeps,
      },
      graph: {
        nodes: graphResult.nodesCreated,
        edges: graphResult.edgesCreated,
      },
    };

    const depMapPath = path.join(root, "DEPENDENCY_MAP.json");
    await fs.writeFile(
      depMapPath,
      JSON.stringify(depMapJson, null, 2),
      "utf-8",
    );

    // State for incremental updates
    const stateJson = {
      version: "3.2.2",
      lastScan: new Date().toISOString(),
      root,
      fileHashes: new Map(scanResult.files.map((f: any) => [f._path, f.hash])),
      stats: scanResult.stats,
    };

    this.logger.done("artifacts", "Generated MARIA.md and dependency map");

    return { mariaMd, depMapJson, stateJson };
  }

  /**
   * Generate MARIA.md content
   */
  private generateMariaMd(scanResult: any, graphResult: any): string {
    const date = new Date().toISOString().split("T")[0];

    return `# MARIA.md

*Generated by MARIA /init with Graph RAG - ${date}*

## Project Overview

This is an AI-enhanced development guide generated through deep codebase analysis.

### Tech Stack
${scanResult.techStack.map((t: string) => `- ${t}`).join("\n")}

### Project Structure
- **Total Files**: ${scanResult.stats.totalFiles}
- **Lines of Code**: ${scanResult.stats.totalLines}
- **Dependencies**: ${scanResult.dependencies.length}
- **Knowledge Graph**: ${graphResult.nodesCreated} nodes, ${graphResult.edgesCreated} relationships

## Architecture Insights

### Core Components
${this.identifyCoreComponents(scanResult)}

### Dependency Analysis
${
  scanResult.circularDeps.length > 0
    ? `
⚠️ **Circular Dependencies Detected**: ${scanResult.circularDeps.length} cycles found
${scanResult.circularDeps
  .slice(0, 5)
  .map((c: any) => `- ${c.join(" → ")}`)
  .join("\n")}
`
    : "✅ No circular dependencies detected"
}

### Entry Points
${scanResult.entryPoints.map((e: any) => `- \`${e.path}\`: ${e.description || "Entry point"}`).join("\n")}

## Development Guidelines

### Code Style
Based on analysis of ${scanResult.stats.totalFiles} files:
- **Naming Convention**: ${this.detectNamingConvention(scanResult)}
- **Module System**: ${scanResult.moduleSystem || "ES Modules"}
- **Average Complexity**: ${scanResult.stats.avgComplexity?.toFixed(2) || "N/A"}

### Best Practices
${this.generateBestPractices(scanResult)}

### Testing
${
  scanResult.testFiles
    ? `
- **Test Files**: ${scanResult.testFiles.length}
- **Test Framework**: ${scanResult.testFramework || "Unknown"}
- **Coverage**: Run tests to generate coverage report
`
    : "⚠️ No test files detected"
}

## Quick Start

\`\`\`bash
# Install dependencies
${scanResult.packageManager || "npm"} install

# Run development
${this.generateDevCommand(scanResult)}

# Run tests
${this.generateTestCommand(scanResult)}
\`\`\`

## MARIA Commands

### Incremental Updates
\`\`\`bash
# Update after git changes
maria /update --since git:HEAD~1

# Update files changed today
maria /update --since 2025-08-26

# Update based on saved state
maria /update --since state
\`\`\`

### Analysis Commands
\`\`\`bash
# Search codebase
maria search "authentication"

# Analyze dependencies
maria analyze --deps

# Generate documentation
maria docs --generate
\`\`\`

## AI Assistance Context

When working with MARIA AI:
1. This project uses **${scanResult.language || "TypeScript"}** as the primary language
2. Follow the existing patterns found in the codebase
3. Key files to reference:
${
  scanResult.importantFiles
    ?.slice(0, 5)
    .map((f: any) => `   - \`${f.path}\`: ${f.reason}`)
    .join("\n") || "   - See entry points above"
}

## Provenance

This document was generated by analyzing:
- ${scanResult.stats.totalFiles} source files
- ${scanResult.stats.totalLines} lines of code
- ${scanResult.dependencies.length} dependencies
- Build time: ${scanResult.stats.scanTimeMs}ms

Last updated: ${new Date().toISOString()}
`;
  }

  // Helper methods
  private identifyCoreComponents(scanResult: any): string {
    const components: string[] = [];

    // Identify by directory structure
    if (scanResult.directories) {
      const coreDirs = ["src", "lib", "services", "components", "api"].filter(
        (d) => scanResult.directories.includes(d),
      );

      if (coreDirs.length > 0) {
        components.push(
          ...coreDirs.map((d) => `- **/${d}**: Core ${d} directory`),
        );
      }
    }

    return components.join("\n") || "- Analyzing component structure...";
  }

  private detectNamingConvention(scanResult: any): string {
    // Simple heuristic based on file names
    const hasKebab = scanResult.files.some((f: any) => f.path.includes("-"));
    const hasCamel = scanResult.files.some((f: any) =>
      /[a-z][A-Z]/.test(f._path),
    );

    if (hasKebab && !hasCamel) return "kebab-case";
    if (hasCamel && !hasKebab) return "camelCase";
    return "Mixed";
  }

  private generateBestPractices(scanResult: any): string {
    const practices: string[] = [];

    if (scanResult.hasTypeScript) {
      practices.push("1. Use TypeScript strict mode for type safety");
    }

    if (scanResult.hasESLint) {
      practices.push("2. Follow ESLint rules for code consistency");
    }

    if (scanResult.testFiles?.length > 0) {
      practices.push("3. Write tests for new features");
    }

    practices.push("4. Follow existing patterns in the codebase");
    practices.push("5. Document complex logic with comments");

    return practices.join("\n");
  }

  private generateDevCommand(scanResult: any): string {
    if (scanResult.scripts?.dev)
      return `${scanResult.packageManager || "npm"} run dev`;
    if (scanResult.scripts?.start)
      return `${scanResult.packageManager || "npm"} start`;
    return `${scanResult.packageManager || "npm"} run dev`;
  }

  private generateTestCommand(scanResult: any): string {
    if (scanResult.scripts?.test)
      return `${scanResult.packageManager || "npm"} test`;
    return `${scanResult.packageManager || "npm"} test`;
  }

  private async saveState(stateDir: string, state: any): Promise<void> {
    await fs.mkdir(stateDir, { recursive: true });
    const statePath = path.join(stateDir, "state.json");
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
  }

  private async fileExists(_path: string): Promise<boolean> {
    try {
      await fs.access(_path);
      return true;
    } catch {
      return false;
    }
  }
}
