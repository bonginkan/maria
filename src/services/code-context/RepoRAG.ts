/**
 * Repository RAG (Retrieval-Augmented Generation)
 * Automatically collects relevant code snippets using ripgrep for context enhancement
 */

import * as fs from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";
import type { GrepSnippet, RepoContext } from "../code-quality/types";

export interface RAGOptions {
  patterns: string[]; // Search patterns
  cwd?: string; // Working directory
  maxFiles?: number; // Maximum files to search
  maxSnippets?: number; // Maximum snippets to return
  contextLines?: number; // Lines of context around matches
  fileTypes?: string[]; // File extensions to include
  excludeDirs?: string[]; // Directories to exclude
  timeoutMs?: number; // Search timeout
  useCache?: boolean; // Enable result caching
}

export interface RipgrepMatch {
  file: string;
  line: number;
  column?: number;
  text: string;
  matchText?: string;
  beforeContext?: string[];
  afterContext?: string[];
}

/**
 * Repository RAG service for code context collection
 */
export class RepoRAG {
  private cache = new Map<string, RepoContext>();
  private readonly DEFAULT_EXCLUDES = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".turbo",
    ".cache",
    "coverage",
    ".next",
    ".nuxt",
    "out",
    "tmp",
    "vendor",
  ];

  private readonly DEFAULT_EXTENSIONS = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".java",
    ".go",
    ".rs",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".cs",
    ".rb",
    ".php",
    ".swift",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".md",
    ".mdx",
    ".txt",
  ];

  /**
   * Collect code snippets relevant to the patterns
   */
  async collectContext(options: RAGOptions): Promise<RepoContext> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.getCacheKey(options);
    if (options.useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return { ...cached, cacheHit: true };
    }

    // Check for ripgrep availability
    const hasRg = await this.checkRipgrep();

    let snippets: GrepSnippet[];
    let searchMethod: RepoContext["searchMethod"];

    if (hasRg) {
      // Use ripgrep for fast searching
      snippets = await this.searchWithRipgrep(options);
      searchMethod = "ripgrep";
    } else {
      // Fallback to native search
      snippets = await this.searchNative(options);
      searchMethod = "native";
    }

    // Score and rank snippets
    snippets = this.rankSnippets(snippets, options.patterns);

    // Limit results
    if (options.maxSnippets) {
      snippets = snippets.slice(0, options.maxSnippets);
    }

    const context: RepoContext = {
      snippets,
      totalHits: snippets.length,
      searchMethod,
      searchTimeMs: Date.now() - startTime,
      cacheHit: false,
    };

    // Cache results
    if (options.useCache) {
      this.cache.set(cacheKey, context);
      // Clear old cache entries if too many
      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }

    return context;
  }

  /**
   * Check if ripgrep is available
   */
  private async checkRipgrep(): Promise<boolean> {
    try {
      const result = await this.exec("rg", ["--version"], { timeoutMs: 2000 });
      return result.code === 0;
    } catch {
      return false;
    }
  }

  /**
   * Search using ripgrep
   */
  private async searchWithRipgrep(options: RAGOptions): Promise<GrepSnippet[]> {
    const args: string[] = [
      "--json", // JSON output for parsing
      "--line-number", // Include line numbers
      "--column", // Include column numbers
      "--no-heading", // Don't group by file
      "--max-count",
      "20", // Max matches per file
      "--max-filesize",
      "1M", // Skip huge files
      "--smart-case", // Smart case sensitivity
    ];

    // Add context lines
    if (options.contextLines) {
      args.push("-C", String(options.contextLines));
    }

    // Add file type filters
    if (options.fileTypes && options.fileTypes.length > 0) {
      options.fileTypes.forEach((ext) => {
        args.push("-g", `*${ext}`);
      });
    }

    // Add exclude patterns
    const excludes = options.excludeDirs || this.DEFAULT_EXCLUDES;
    excludes.forEach((dir) => {
      args.push("-g", `!${dir}/**`);
    });

    // Build search pattern (OR search)
    const pattern = options.patterns.map((p) => this.escapeRegex(p)).join("|");
    args.push(pattern);

    // Add search path
    args.push(options.cwd || ".");

    try {
      const result = await this.exec("rg", args, {
        cwd: options.cwd,
        timeoutMs: options.timeoutMs || 10000,
      });

      if (result.code !== 0 && !result.stdout) {
        return [];
      }

      return this.parseRipgrepJson(result.stdout);
    } catch (error) {
      console.warn(
        "Ripgrep search failed, falling back to native search:",
        error,
      );
      return [];
    }
  }

  /**
   * Parse ripgrep JSON output
   */
  private parseRipgrepJson(output: string): GrepSnippet[] {
    const snippets: GrepSnippet[] = [];
    const lines = output.split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (entry.type === "match") {
          const data = entry.data;
          snippets.push({
            file: data.path?.text || "",
            line: data.line_number || 0,
            text: data.lines?.text?.trimEnd() || "",
            match: data.submatches?.[0]?.match?.text,
            contextBefore: [],
            contextAfter: [],
            score: 1.0,
          });
        } else if (entry.type === "context") {
          // Add context to the last snippet
          const lastSnippet = snippets[snippets.length - 1];
          if (lastSnippet) {
            const contextLine = entry.data.lines?.text?.trimEnd();
            if (contextLine) {
              if (entry.data.line_number < lastSnippet.line) {
                lastSnippet.contextBefore?.push(contextLine);
              } else {
                lastSnippet.contextAfter?.push(contextLine);
              }
            }
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return snippets;
  }

  /**
   * Native search fallback (without ripgrep)
   */
  private async searchNative(options: RAGOptions): Promise<GrepSnippet[]> {
    const snippets: GrepSnippet[] = [];
    const cwd = options.cwd || process.cwd();
    const files = await this.findFiles(cwd, options);

    const searchLimit = Math.min(files.length, options.maxFiles || 100);

    for (let i = 0; i < searchLimit; i++) {
      const file = files[i];
      try {
        const content = await fs.readFile(file, "utf8");
        const lines = content.split("\n");

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];

          // Check if line matches any pattern
          for (const pattern of options.patterns) {
            if (this.matchesPattern(line, pattern)) {
              const contextLines = options.contextLines || 2;

              snippets.push({
                file: path.relative(cwd, file),
                line: lineNum + 1,
                text: line,
                match: pattern,
                contextBefore: lines.slice(
                  Math.max(0, lineNum - contextLines),
                  lineNum,
                ),
                contextAfter: lines.slice(
                  lineNum + 1,
                  lineNum + 1 + contextLines,
                ),
                score: 0.8, // Lower score for native search
              });

              if (snippets.length >= (options.maxSnippets || 50)) {
                return snippets;
              }

              break; // Only match once per line
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return snippets;
  }

  /**
   * Find files to search
   */
  private async findFiles(
    rootDir: string,
    options: RAGOptions,
  ): Promise<string[]> {
    const files: string[] = [];
    const excludeDirs = new Set(options.excludeDirs || this.DEFAULT_EXCLUDES);
    const extensions = new Set(options.fileTypes || this.DEFAULT_EXTENSIONS);

    async function walk(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!excludeDirs.has(entry.name)) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.has(ext)) {
              files.push(fullPath);
              if (files.length >= 1000) return; // Limit search
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    await walk(rootDir);
    return files;
  }

  /**
   * Check if text matches pattern
   */
  private matchesPattern(text: string, pattern: string): boolean {
    // Simple case-insensitive includes for now
    return text.toLowerCase().includes(pattern.toLowerCase());
  }

  /**
   * Rank snippets by relevance
   */
  private rankSnippets(
    snippets: GrepSnippet[],
    patterns: string[],
  ): GrepSnippet[] {
    return snippets
      .map((snippet) => {
        let score = snippet.score || 0.5;

        // Boost score for exact matches
        const lowerText = snippet.text.toLowerCase();
        for (const pattern of patterns) {
          if (lowerText.includes(pattern.toLowerCase())) {
            score += 0.2;
          }
          // Extra boost for word boundary matches
          const wordPattern = new RegExp(
            `\\b${this.escapeRegex(pattern)}\\b`,
            "i",
          );
          if (wordPattern.test(snippet.text)) {
            score += 0.3;
          }
        }

        // Boost for certain file types
        const ext = path.extname(snippet.file);
        if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
          score += 0.1;
        }

        // Penalty for test files
        if (snippet.file.includes("test") || snippet.file.includes("spec")) {
          score -= 0.2;
        }

        // Penalty for very long lines
        if (snippet.text.length > 200) {
          score -= 0.1;
        }

        return { ...snippet, score: Math.min(1, Math.max(0, score)) };
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Execute command with timeout
   */
  private async exec(
    cmd: string,
    args: string[],
    options: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
  ): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        shell: process.platform === "win32",
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timeout = options.timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            proc.kill("SIGTERM");
          }, options.timeoutMs)
        : null;

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("error", (error) => {
        if (timeout) clearTimeout(timeout);
        reject(error);
      });

      proc.on("close", (code) => {
        if (timeout) clearTimeout(timeout);
        if (timedOut) {
          reject(new Error("Command timed out"));
        } else {
          resolve({ code, stdout, stderr });
        }
      });
    });
  }

  /**
   * Generate cache key for options
   */
  private getCacheKey(options: RAGOptions): string {
    return JSON.stringify({
      patterns: options.patterns.sort(),
      cwd: options.cwd,
      fileTypes: options.fileTypes?.sort(),
      excludeDirs: options.excludeDirs?.sort(),
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get context based on intent (method expected by code command)
   * OPTIMIZED: 50ms timeout for fast operations to prevent blocking
   */
  async getContextForIntent(
    intent: any,
    options: {
      file?: string;
      signal?: AbortSignal;
      maxFiles?: number;
      includeTests?: boolean;
    } = {},
  ): Promise<{
    relatedFiles: Array<{ path: string; relevance?: number }>;
    symbols?: Array<{ name: string; type: string; path: string }>;
    dependencies?: string[];
  }> {
    // FAST PATH: Return empty context immediately if no intent
    const searchText =
      typeof intent === "string"
        ? intent
        : intent.text || intent.description || "";

    if (!searchText) {
      return { relatedFiles: [], symbols: [], dependencies: [] };
    }

    // Convert intent to search patterns
    const patterns = searchText
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .slice(0, 3); // Reduced from 5 to 3 for speed

    if (patterns.length === 0) {
      return { relatedFiles: [], symbols: [], dependencies: [] };
    }

    try {
      // CRITICAL: 50ms timeout for fast operation
      const MAX_LATENCY = 50; // 50ms max as per SOW

      // Create empty context as fallback
      const emptyContext = { relatedFiles: [], symbols: [], dependencies: [] };

      // Race between context collection and timeout
      const contextPromise = this.collectContext({
        patterns,
        cwd: options.file ? path.dirname(options.file) : process.cwd(),
        maxFiles: 5, // Reduced from 10 for speed
        maxSnippets: 10, // Reduced from 20 for speed
        contextLines: 1, // Reduced from 2 for speed
        excludeDirs: ["node_modules", ".git", "dist", "build", "test", "tests"],
        timeoutMs: MAX_LATENCY - 10, // Leave 10ms buffer
        useCache: true,
      });

      // Race with aggressive timeout
      const context = await Promise.race([
        contextPromise,
        new Promise<typeof emptyContext>((resolve) => {
          setTimeout(() => {
            console.debug(
              `⚡ RAG timeout reached (${MAX_LATENCY}ms), returning empty context`,
            );
            resolve(emptyContext);
          }, MAX_LATENCY);
        }),
      ]);

      // Fast path: if timeout hit, return empty
      if (!context || !("snippets" in context)) {
        return emptyContext;
      }

      // Convert snippets to related files (fast processing)
      const fileMap = new Map<string, number>();
      const snippets = context.snippets || [];

      // Process only first 10 snippets for speed
      for (let i = 0; i < Math.min(10, snippets.length); i++) {
        const snippet = snippets[i];
        const count = fileMap.get(snippet.file) || 0;
        fileMap.set(snippet.file, count + 1);
      }

      const relatedFiles = Array.from(fileMap.entries())
        .map(([file, count]) => ({
          path: file,
          relevance: Math.min(1, count / 5), // Faster normalization
        }))
        .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
        .slice(0, 5); // Max 5 files for speed

      return {
        relatedFiles,
        symbols: [], // Skipped for speed
        dependencies: [], // Skipped for speed
      };
    } catch (error) {
      // On any error, immediately return empty context (no retry)
      console.debug("RAG fast-failed:", error);
      return { relatedFiles: [], symbols: [], dependencies: [] };
    }
  }
}

/**
 * Create a singleton instance
 */
export const repoRAG = new RepoRAG();
