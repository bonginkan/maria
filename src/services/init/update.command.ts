/**
 * Enhanced /update Command with Graph RAG
 * Incremental codebase updates with delta detection
 */

import * as path from "path";
import * as fs from "fs/promises";
import chalk from "chalk";
import { EnhancedScanner } from "./scanner";
import { DeltaDetector } from "./delta-detector";
import { OpenSearchClient, QdrantClient, Neo4jClient } from "./clients.safe";
import { Logger } from "./logging";
import type { KnowledgeGraphService } from "../knowledge-graph/KnowledgeGraphService";
import type { DualMemoryEngine } from "../memory-system/dual-memory-engine";
import { createReporter, type NarrativeReporter } from "../narrative/index.js";
import { RunIdGenerator } from "../narrative/utils/RunIdGenerator.js";

export interface UpdateOptions {
  root?: string;
  since?: string; // 'git:HEAD~1' | '2025-08-26' | 'state'
  json?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  parallel?: number;
  budgetMs?: number;
}

export interface UpdateResult {
  success: boolean;
  delta: {
    added: number;
    modified: number;
    deleted: number;
    unchanged: number;
  };
  stats: {
    filesProcessed: number;
    nodesUpdated: number;
    edgesUpdated: number;
    timeMs: number;
  };
  changes: Array<{
    _path: string;
    type: "added" | "modified" | "deleted";
    reason?: string;
  }>;
  warnings: string[];
}

/**
 * Main update command implementation
 */
export class UpdateCommand {
  private logger: Logger;
  private scanner: EnhancedScanner;
  private deltaDetector: DeltaDetector;
  private openSearch?: OpenSearchClient;
  private qdrant?: QdrantClient;
  private neo4j?: Neo4jClient;
  private reporter: NarrativeReporter;

  constructor(
    private knowledgeGraph?: KnowledgeGraphService,
    private memoryEngine?: DualMemoryEngine,
  ) {
    this.logger = new Logger({ json: false });
    this.scanner = new EnhancedScanner();
    this.deltaDetector = new DeltaDetector();

    // Initialize narrative reporter
    const runId = RunIdGenerator.getInstance().generate("update");
    this.reporter = createReporter({
      mode:
        process.env.UPDATE_JSON === "1"
          ? "json"
          : process.env.UPDATE_QUIET === "1"
            ? "null"
            : "tty",
      runId,
      verbose: process.env.UPDATE_VERBOSE === "1",
    });
  }

  /**
   * Execute incremental update
   */
  async execute(options: UpdateOptions = {}): Promise<UpdateResult> {
    const startTime = Date.now();
    const root = options.root || process.cwd();
    const stateDir = path.join(root, ".maria");
    const statePath = path.join(stateDir, "state.json");

    // Show thinking phase
    this.reporter
      .thinking(`Performing incremental update to detect and process changes.
This will:
- Detect file changes since last update
- Process modified files
- Update knowledge graph
- Refresh documentation`);

    this.logger.header("MARIA /update - Incremental Update");

    // Check for existing state
    const hasState = await this.fileExists(statePath);
    if (!hasState && (!options.since || options.since === "state")) {
      this.logger.error(
        'No previous state found. Run "/init" first to establish baseline.',
      );
      return {
        success: false,
        delta: { added: 0, modified: 0, deleted: 0, unchanged: 0 },
        stats: {
          filesProcessed: 0,
          nodesUpdated: 0,
          edgesUpdated: 0,
          timeMs: 0,
        },
        changes: [],
        warnings: ["No state found - run /init first"],
      };
    }

    try {
      // Load previous state
      const previousState = hasState ? await this.loadState(statePath) : null;

      // Phase 1: Detect changes
      this.reporter.step(
        "Phase 1: Detecting Changes",
        "Scanning for file modifications",
        "phase1.scan",
      );
      this.logger.section("Phase 1: Detecting Changes");
      const deltaResult = await this.detectChanges(
        root,
        options,
        previousState,
      );

      if (deltaResult.files.length === 0) {
        this.logger.success("No changes detected since last update");
        return {
          success: true,
          delta: {
            added: 0,
            modified: 0,
            deleted: 0,
            unchanged: deltaResult.unchanged || 0,
          },
          stats: {
            filesProcessed: 0,
            nodesUpdated: 0,
            edgesUpdated: 0,
            timeMs: Date.now() - startTime,
          },
          changes: [],
          warnings: [],
        };
      }

      this.logger.info(`Found ${deltaResult.files.length} changed files`);

      if (options.dryRun) {
        this.logger.section("Dry Run Results");
        this.displayChanges(deltaResult);
        return {
          success: true,
          delta: this.categorizeDelta(deltaResult),
          stats: {
            filesProcessed: 0,
            nodesUpdated: 0,
            edgesUpdated: 0,
            timeMs: Date.now() - startTime,
          },
          changes: deltaResult.files,
          warnings: ["Dry run - no changes applied"],
        };
      }

      // Phase 2: Process changes
      this.reporter.step(
        "Phase 2: Processing Changes",
        "Analyzing modified files",
        "phase2.graph",
      );
      this.logger.section("Phase 2: Processing Changes");
      const processResult = await this.processChanges(deltaResult, options);

      // Phase 3: Update graph
      this.reporter.step(
        "Phase 3: Updating Knowledge Graph",
        "Updating relationships",
        "phase3.index",
      );
      this.logger.section("Phase 3: Updating Knowledge Graph");
      const graphResult = await this.updateKnowledgeGraph(
        deltaResult,
        processResult,
      );

      // Phase 4: Update search index
      this.reporter.step(
        "Phase 4: Updating Search Index",
        "Rebuilding search index",
        "phase4.artifacts",
      );
      this.logger.section("Phase 4: Updating Search Index");
      const _indexResult = await this.updateSearchIndex(
        deltaResult,
        processResult,
      );

      // Phase 5: Update artifacts
      this.reporter.step(
        "Phase 5: Updating Artifacts",
        "Regenerating documentation",
      );
      this.logger.section("Phase 5: Updating Artifacts");
      await this.updateArtifacts(root, deltaResult, processResult);

      // Save new state
      await this.saveState(statePath, {
        version: "3.2.2",
        timestamp: new Date().toISOString(),
        root,
        lastUpdate: {
          timestamp: new Date().toISOString(),
          delta: this.categorizeDelta(deltaResult),
          filesProcessed: processResult.files.length,
        },
        fileHashes: processResult.fileHashes,
        stats: processResult.stats,
      });

      const timeMs = Date.now() - startTime;

      // Display summary
      const delta = this.categorizeDelta(deltaResult);

      // Report to narrative
      this.reporter.summary({
        "Files Added": delta.added,
        "Files Modified": delta.modified,
        "Files Deleted": delta.deleted,
        "Nodes Updated": graphResult.nodesUpdated,
        "Edges Updated": graphResult.edgesUpdated,
        "Total Time": `${(timeMs / 1000).toFixed(2)}s`,
      });

      this.logger.summary({
        "Files Added": delta.added,
        "Files Modified": delta.modified,
        "Files Deleted": delta.deleted,
        "Nodes Updated": graphResult.nodesUpdated,
        "Edges Updated": graphResult.edgesUpdated,
        "Total Time": `${(timeMs / 1000).toFixed(2)}s`,
      });

      this.logger.success("Update complete! MARIA.md has been refreshed.");

      return {
        success: true,
        delta,
        stats: {
          filesProcessed: processResult.files.length,
          nodesUpdated: graphResult.nodesUpdated,
          edgesUpdated: graphResult.edgesUpdated,
          timeMs,
        },
        changes: deltaResult.files,
        warnings: processResult.warnings || [],
      };
    } catch (error: any) {
      this.logger.error(`Update failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Phase 1: Detect changes using delta detector
   */
  private async detectChanges(
    root: string,
    options: UpdateOptions,
    previousState: any,
  ): Promise<any> {
    this.logger.start("detect", "Detecting changes...");

    // Report search operation
    this.reporter.search("git diff --name-status", root);

    const deltaOptions = {
      since: options.since || "state",
      state: previousState,
      verbose: options.verbose,
    };

    const result = await this.deltaDetector.detectDelta(root, deltaOptions);

    // Convert DeltaResult to expected format
    const files = [
      ...result.changed.map((path: string) => ({
        _path: path,
        type: previousState?.fileHashes?.[path] ? "modified" : "added",
      })),
      ...result.deleted.map((path: string) => ({
        _path: path,
        type: "deleted",
      })),
    ];

    // Categorize changes
    const added = files.filter((f: any) => f.type === "added").length;
    const modified = files.filter((f: any) => f.type === "modified").length;
    const deleted = files.filter((f: any) => f.type === "deleted").length;

    // Report delta summary
    this.reporter.update(
      `Found ${added} added, ${modified} modified, ${deleted} deleted files`,
    );

    this.logger.done(
      "detect",
      `Found: +${added} ~${modified} -${deleted} files`,
    );

    return {
      ...result,
      files,
      root,
      unchanged:
        result.stats.totalFiles -
        result.stats.changedFiles -
        result.stats.deletedFiles,
    };
  }

  /**
   * Phase 2: Process changed files
   */
  private async processChanges(deltaResult: any, options: UpdateOptions) {
    const total = deltaResult.files.length;
    let processed = 0;

    this.logger.start("process", `Processing ${total} files...`);

    // Show top 5 changes, compact the rest
    const topChanges = deltaResult.files.slice(0, 5);
    const remainingCount = deltaResult.files.length - 5;

    topChanges.forEach((file: any) => {
      if (file.type === "added") {
        this.reporter.write(file._path);
      } else if (file.type === "modified") {
        this.reporter.update(`Modified: ${file._path}`);
      } else if (file.type === "deleted") {
        this.reporter.update(`Deleted: ${file._path}`, "warn");
      }
    });

    if (remainingCount > 0) {
      this.reporter.compact(`${remainingCount} more files`, remainingCount);
    }

    const _scanOptions = {
      root: deltaResult.root,
      files: deltaResult.files
        .filter((f: any) => f.type !== "deleted")
        .map((f: any) => f._path),
      parallel: options.parallel || 4,
      budgetMs: options.budgetMs || 10000,
    };

    const processedFiles = [];
    const fileHashes = new Map();
    const warnings = [];

    // Process in batches
    const batchSize = options.parallel || 4;
    for (let i = 0; i < deltaResult.files.length; i += batchSize) {
      const batch = deltaResult.files.slice(
        i,
        Math.min(i + batchSize, deltaResult.files.length),
      );

      const batchResults = await Promise.all(
        batch.map(async (file: any) => {
          try {
            if (file.type === "deleted") {
              return { ...file, processed: true };
            }

            // Scan file with AST
            const scanResult = await this.scanner.scanFile(file._path);
            fileHashes.set(file._path, scanResult.hash);

            processed++;
            this.logger.progress("process", processed, total);

            return {
              ...file,
              ...scanResult,
              processed: true,
            };
          } catch (error: any) {
            warnings.push(`Failed to process ${file.path}: ${error.message}`);
            return { ...file, processed: false, error: error.message };
          }
        }),
      );

      processedFiles.push(...batchResults);
    }

    this.logger.done("process", `Processed ${processed} files`);

    return {
      files: processedFiles,
      fileHashes,
      stats: {
        totalProcessed: processed,
        failures: processedFiles.filter((f) => !f.processed).length,
      },
      warnings,
    };
  }

  /**
   * Phase 3: Update knowledge graph with changes
   */
  private async updateKnowledgeGraph(deltaResult: any, processResult: any) {
    this.logger.start("graph", "Updating knowledge graph...");

    let nodesUpdated = 0;
    let edgesUpdated = 0;

    // Initialize Neo4j if available
    if (process.env.NEO4J_URI) {
      this.neo4j = new Neo4jClient(
        process.env.NEO4J_URI,
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "password",
      );
    }

    // Process updates
    const nodeUpdates = [];
    const edgeUpdates = [];
    const deletions = [];

    for (const file of processResult.files) {
      if (file.type === "deleted") {
        deletions.push(file._path);
        continue;
      }

      if (!file.processed) continue;

      // Update file node
      nodeUpdates.push({
        id: file._path,
        type: "file",
        name: path.basename(file._path),
        language: file.language,
        size: file.size,
        complexity: file.complexity,
        lastModified: new Date().toISOString(),
      });
      nodesUpdated++;

      // Update dependencies
      if (file.dependencies) {
        for (const dep of file.dependencies) {
          edgeUpdates.push({
            from: file._path,
            to: dep._path,
            type: dep.type,
          });
          edgesUpdated++;
        }
      }

      // Update symbols
      if (file.symbols) {
        for (const symbol of file.symbols) {
          nodeUpdates.push({
            id: `${file.path}#${symbol.name}`,
            type: symbol.type,
            name: symbol.name,
            file: file._path,
            exported: symbol.exported,
          });
          nodesUpdated++;
        }
      }
    }

    // Apply updates to Neo4j
    if (this.neo4j && nodeUpdates.length > 0) {
      await this.neo4j.applyDiff(
        nodeUpdates,
        deletions.length > 0 ? { nodeIds: deletions } : undefined,
        edgeUpdates,
      );
    }

    // Update KnowledgeGraphService
    if (this.knowledgeGraph) {
      // The service handles incremental updates internally
      await this.knowledgeGraph.analyzeProject(deltaResult.root);
    }

    this.logger.done(
      "graph",
      `Updated ${nodesUpdated} nodes, ${edgesUpdated} edges`,
    );

    return { nodesUpdated, edgesUpdated };
  }

  /**
   * Phase 4: Update search index
   */
  private async updateSearchIndex(deltaResult: any, processResult: any) {
    this.logger.start("index", "Updating search index...");

    let filesIndexed = 0;

    // Initialize OpenSearch if available
    if (process.env.OPENSEARCH_URI) {
      this.openSearch = new OpenSearchClient(process.env.OPENSEARCH_URI);

      // Process updates
      const updates = processResult.files
        .filter((f: any) => f.processed && f.type !== "deleted")
        .map((file: any) => ({
          id: file._path,
          doc: {
            _path: file._path,
            content: file.content?.substring(0, 10000),
            language: file.language,
            size: file.size,
            complexity: file.complexity,
            lastModified: new Date().toISOString(),
          },
        }));

      if (updates.length > 0) {
        const result = await this.openSearch.upsertDocs("maria_code", updates);
        filesIndexed = result.upserted;
      }

      // Handle deletions
      const deletions = processResult.files
        .filter((f: any) => f.type === "deleted")
        .map((f: any) => f._path);

      if (deletions.length > 0) {
        await this.openSearch.bulkDelete("maria_code", deletions);
      }
    }

    // Update memory engine
    if (this.memoryEngine) {
      for (const file of processResult.files.filter((f: any) => f.processed)) {
        if (file.type === "deleted") {
          // Memory engine might not support deletion, so we skip
          continue;
        }

        await this.memoryEngine.store({
          id: file._path,
          content: `File: ${file.path}\n${file.summary || ""}`,
          metadata: {
            type: "code",
            language: file.language,
            timestamp: Date.now(),
            updated: true,
          },
        });
      }
    }

    this.logger.done("index", `Updated ${filesIndexed} documents`);

    return { filesIndexed };
  }

  /**
   * Phase 5: Update artifacts (MARIA.md, etc.)
   */
  private async updateArtifacts(
    root: string,
    deltaResult: any,
    processResult: any,
  ) {
    this.logger.start("artifacts", "Updating artifacts...");

    // Read existing MARIA.md
    const mariaMdPath = path.join(root, "MARIA.md");
    let existingContent = "";

    try {
      existingContent = await fs.readFile(mariaMdPath, "utf-8");
      this.reporter.read("MARIA.md", existingContent.split("\n").length);
    } catch {
      // File doesn't exist, will create new
    }

    // Update MARIA.md with change summary
    const updatedMariaMd = this.updateMariaMd(
      existingContent,
      deltaResult,
      processResult,
    );
    await fs.writeFile(mariaMdPath, updatedMariaMd, "utf-8");
    this.reporter.write("MARIA.md", updatedMariaMd.length);

    // Update dependency map
    const depMapPath = path.join(root, "DEPENDENCY_MAP.json");
    try {
      const existingDepMap = JSON.parse(await fs.readFile(depMapPath, "utf-8"));
      this.reporter.read(
        "DEPENDENCY_MAP.json",
        JSON.stringify(existingDepMap).split("\n").length,
      );

      existingDepMap.lastUpdate = {
        timestamp: new Date().toISOString(),
        delta: this.categorizeDelta(deltaResult),
        filesProcessed: processResult.files.length,
      };
      const updatedDepMapContent = JSON.stringify(existingDepMap, null, 2);
      await fs.writeFile(depMapPath, updatedDepMapContent, "utf-8");
      this.reporter.write("DEPENDENCY_MAP.json", updatedDepMapContent.length);
    } catch {
      // Skip if file doesn't exist
    }

    this.logger.done("artifacts", "Updated MARIA.md and dependency map");
  }

  /**
   * Update MARIA.md content with changes
   */
  private updateMariaMd(
    existing: string,
    deltaResult: any,
    processResult: any,
  ): string {
    const date = new Date().toISOString();
    const delta = this.categorizeDelta(deltaResult);

    // If file doesn't exist, create minimal version
    if (!existing) {
      return `# MARIA.md

*Last updated by MARIA /update - ${date}*

## Recent Changes

### ${date.split("T")[0]} Update
- **Files Added**: ${delta.added}
- **Files Modified**: ${delta.modified}
- **Files Deleted**: ${delta.deleted}

Run \`maria /init\` for full analysis.
`;
    }

    // Find the update section or create it
    const updateSection = `
## Recent Updates

### ${date.split("T")[0]} - Incremental Update
- **Files Added**: ${delta.added}
- **Files Modified**: ${delta.modified}
- **Files Deleted**: ${delta.deleted}
- **Processing Time**: ${processResult.stats?.totalProcessed || 0} files

${
  delta.added > 0
    ? `
#### New Files
${deltaResult.files
  .filter((f: any) => f.type === "added")
  .slice(0, 5)
  .map((f: any) => `- \`${f.path}\``)
  .join("\n")}
${delta.added > 5 ? `... and ${delta.added - 5} more` : ""}
`
    : ""
}

${
  delta.modified > 0
    ? `
#### Modified Files
${deltaResult.files
  .filter((f: any) => f.type === "modified")
  .slice(0, 5)
  .map((f: any) => `- \`${f.path}\``)
  .join("\n")}
${delta.modified > 5 ? `... and ${delta.modified - 5} more` : ""}
`
    : ""
}

---
`;

    // Insert update section after header or at beginning
    const lines = existing.split("\n");
    const headerEnd = lines.findIndex((line) => line.startsWith("##"));

    if (headerEnd > 0) {
      // Insert after main header
      lines.splice(headerEnd, 0, updateSection);
    } else {
      // Prepend to content
      return updateSection + "\n" + existing;
    }

    // Update the timestamp in header
    const updatedContent = lines
      .join("\n")
      .replace(/\*.*updated.*\*/i, `*Last updated by MARIA /update - ${date}*`);

    return updatedContent;
  }

  /**
   * Display changes for dry run
   */
  private displayChanges(deltaResult: any): void {
    const delta = this.categorizeDelta(deltaResult);

    if (delta.added > 0) {
      this.logger.info(`Added files (${delta.added}):`);
      deltaResult.files
        .filter((f: any) => f.type === "added")
        .slice(0, 10)
        .forEach((f: any) => console.log(chalk.green(`  + ${f.path}`)));
      if (delta.added > 10) {
        console.log(chalk.gray(`  ... and ${delta.added - 10} more`));
      }
    }

    if (delta.modified > 0) {
      this.logger.info(`Modified files (${delta.modified}):`);
      deltaResult.files
        .filter((f: any) => f.type === "modified")
        .slice(0, 10)
        .forEach((f: any) => console.log(chalk.yellow(`  ~ ${f.path}`)));
      if (delta.modified > 10) {
        console.log(chalk.gray(`  ... and ${delta.modified - 10} more`));
      }
    }

    if (delta.deleted > 0) {
      this.logger.info(`Deleted files (${delta.deleted}):`);
      deltaResult.files
        .filter((f: any) => f.type === "deleted")
        .slice(0, 10)
        .forEach((f: any) => console.log(chalk.red(`  - ${f.path}`)));
      if (delta.deleted > 10) {
        console.log(chalk.gray(`  ... and ${delta.deleted - 10} more`));
      }
    }
  }

  // Helper methods
  private categorizeDelta(deltaResult: any) {
    const files = deltaResult.files || [];
    return {
      added: files.filter((f: any) => f.type === "added").length,
      modified: files.filter((f: any) => f.type === "modified").length,
      deleted: files.filter((f: any) => f.type === "deleted").length,
      unchanged: deltaResult.unchanged || 0,
    };
  }

  private async loadState(statePath: string): Promise<any> {
    try {
      const content = await fs.readFile(statePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async saveState(statePath: string, state: any): Promise<void> {
    const dir = path.dirname(statePath);
    await fs.mkdir(dir, { recursive: true });

    // Convert Map to object for JSON serialization
    if (state.fileHashes instanceof Map) {
      state.fileHashes = Object.fromEntries(state.fileHashes);
    }

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
