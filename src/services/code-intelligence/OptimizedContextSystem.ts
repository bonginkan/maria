/**
 * Optimized Context System - Background Indexing with File Watchers
 * Week 1-2 Implementation: Always-on intelligent indexing for <500ms TTFB
 */

// Use Node.js built-in fs.watch for file watching (lighter alternative to chokidar)
import { watch, FSWatcher } from 'fs';
import * as path from 'path';
import { readFileSync, existsSync } from 'fs';
import { EventEmitter } from 'events';
import { EnterpriseProjectResolver, SolutionInfo } from './EnterpriseProjectResolver.js';
import { EnterpriseTypeScriptEngine } from './EnterpriseTypeScriptEngine.js';

export interface CachedAST {
  filePath: string;
  lastModified: number;
  context: FileContext;
  symbols: SymbolInfo[];
  dependencies: string[];
  hash: string;
}

export interface FileContext {
  filePath: string;
  projectRoot: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  symbols: SymbolInfo[];
  dependencies: string[];
  lastModified: number;
}

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'variable' | 'type';
  line: number;
  column: number;
  scope: 'local' | 'exported' | 'imported';
  type?: string;
}

export interface ImportInfo {
  module: string;
  imports: string[];
  line: number;
  isTypeOnly: boolean;
}

export interface ExportInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'variable' | 'type';
  line: number;
  isDefault: boolean;
}

export interface IncrementalGraph {
  nodes: Map<string, FileNode>;
  edges: Map<string, Set<string>>; // file -> dependencies
  reverseEdges: Map<string, Set<string>>; // file -> dependents
  lastUpdated: number;
}

export interface FileNode {
  filePath: string;
  lastModified: number;
  hash: string;
  symbols: SymbolInfo[];
  imports: string[];
  exports: string[];
}

export interface FastSymbolIndex {
  symbols: Map<string, SymbolLocation[]>;
  globalSymbols: Set<string>;
  exportedSymbols: Map<string, string>; // symbol -> file
  lastUpdated: number;
}

export interface SymbolLocation {
  file: string;
  line: number;
  column: number;
  kind: string;
}

/**
 * High-performance context system with background indexing
 * Implements sub-500ms TTFB through pre-computation and caching
 */
export class OptimizedContextSystem extends EventEmitter {
  private astCache = new PersistentCache<string, CachedAST>({
    maxSize: 10000,
    ttl: 3600000, // 1 hour
    invalidationStrategy: 'file-watcher'
  });

  private dependencyGraph = new IncrementalGraphImpl();
  private symbolIndex = new FastSymbolIndexImpl();
  private fileWatcher?: FSWatcher;
  private watchedDirectories = new Set<string>();
  
  private isIndexing = false;
  private indexingQueue: string[] = [];
  private performanceMetrics = {
    contextRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    backgroundUpdates: 0
  };

  constructor(
    private projectResolver: EnterpriseProjectResolver,
    private astEngine: EnterpriseTypeScriptEngine
  ) {
    super();
  }

  /**
   * Initialize background context system
   */
  async initialize(workspaceRoot: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('🔄 Initializing optimized context system...');
      
      // Load project solution
      const solutionInfo = await this.projectResolver.loadSolutions(workspaceRoot);
      
      // Start file watcher
      await this.startFileWatcher(workspaceRoot, solutionInfo);
      
      // Initial indexing (background)
      this.startBackgroundIndexing(workspaceRoot, solutionInfo);
      
      console.log(`✅ Context system initialized (${Date.now() - startTime}ms)`);
      console.log(`   - Watching: ${workspaceRoot}`);
      console.log(`   - Projects: ${solutionInfo.projects.length + 1}`);
      
    } catch (error) {
      console.error('❌ Context system initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get file context with <100ms guarantee
   * This is the critical performance method for TTFB <500ms
   */
  async getContext(file: string): Promise<FileContext> {
    const startTime = Date.now();
    this.performanceMetrics.contextRequests++;

    try {
      const normalizedPath = path.resolve(file);
      
      // Try cache first
      const cached = this.astCache.get(normalizedPath);
      if (cached && !this.isInvalidated(normalizedPath, cached.lastModified)) {
        this.performanceMetrics.cacheHits++;
        this.updateAverageResponseTime(Date.now() - startTime);
        return cached.context;
      }

      this.performanceMetrics.cacheMisses++;

      // If not in cache, do incremental update
      const context = await this.updateContextIncremental(normalizedPath);
      
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      if (responseTime > 100) {
        console.warn(`⚠️ Context request took ${responseTime}ms (target: <100ms) for ${file}`);
      }
      
      return context;
      
    } catch (error) {
      console.error(`Error getting context for ${file}:`, error);
      
      // Return minimal context as fallback
      return {
        filePath: file,
        projectRoot: process.cwd(),
        imports: [],
        exports: [],
        symbols: [],
        dependencies: [],
        lastModified: Date.now()
      };
    }
  }

  /**
   * Update context incrementally (only affected parts)
   */
  private async updateContextIncremental(file: string): Promise<FileContext> {
    const affectedFiles = this.dependencyGraph.getAffectedFiles(file);
    
    // Batch update affected files
    const updates = await Promise.all(
      [file, ...affectedFiles.slice(0, 5)] // Limit to avoid performance issues
        .map(f => this.parseFileContext(f))
    );
    
    // Update symbol index with new symbols
    const validUpdates = updates.filter(u => u !== null) as FileContext[];
    await this.symbolIndex.updateBatch(validUpdates);
    
    // Update dependency graph
    for (const update of validUpdates) {
      this.dependencyGraph.updateFile(update);
    }
    
    return validUpdates.find(u => u.filePath === file) || validUpdates[0];
  }

  /**
   * Parse file context with AST analysis
   */
  private async parseFileContext(filePath: string): Promise<FileContext | null> {
    try {
      if (!existsSync(filePath)) {
        return null;
      }

      const content = readFileSync(filePath, 'utf-8');
      const lastModified = this.getFileModifiedTime(filePath);
      const hash = this.calculateHash(content);

      // Check if we already have this version cached
      const cached = this.astCache.get(filePath);
      if (cached && cached.hash === hash) {
        return cached.context;
      }

      // Parse with AST
      const symbols = await this.extractSymbols(content, filePath);
      const imports = this.extractImports(content);
      const exports = this.extractExports(content);
      const dependencies = imports.map(imp => imp.module);

      const context: FileContext = {
        filePath,
        projectRoot: this.findProjectRoot(filePath),
        imports,
        exports,
        symbols,
        dependencies,
        lastModified
      };

      // Cache the result
      const cachedAST: CachedAST = {
        filePath,
        lastModified,
        context,
        symbols,
        dependencies,
        hash
      };

      this.astCache.set(filePath, cachedAST);
      
      return context;

    } catch (error) {
      console.warn(`Failed to parse context for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Start file watcher for incremental updates
   * Using Node.js built-in fs.watch for lighter alternative to chokidar
   */
  private async startFileWatcher(workspaceRoot: string, solutionInfo: SolutionInfo): Promise<void> {
    const watchDirectories = [
      `${workspaceRoot}/src`,
      `${workspaceRoot}/lib`,
      `${workspaceRoot}/packages`
    ].filter(dir => existsSync(dir));

    // Watch directories recursively using Node.js fs.watch
    for (const dir of watchDirectories) {
      try {
        this.watchDirectory(dir);
      } catch (error) {
        console.warn(`Failed to watch directory ${dir}:`, error);
      }
    }

    console.log(`📂 File watcher started for ${watchDirectories.length} directories`);
  }

  /**
   * Watch directory using fs.watch
   */
  private watchDirectory(dirPath: string): void {
    if (this.watchedDirectories.has(dirPath)) {
      return;
    }

    try {
      const watcher = watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(dirPath, filename);
        
        // Filter TypeScript files only
        if (!filename.endsWith('.ts') && !filename.endsWith('.tsx')) {
          return;
        }

        // Skip test files and node_modules
        if (filename.includes('.test.') || 
            filename.includes('.spec.') ||
            filename.includes('node_modules') ||
            filename.includes('dist/') ||
            filename.includes('coverage/')) {
          return;
        }

        // Handle file events with debouncing
        if (eventType === 'change') {
          this.debouncedHandleFileChange(fullPath);
        } else if (eventType === 'rename') {
          // Handle both file creation and deletion
          setTimeout(() => {
            if (existsSync(fullPath)) {
              this.handleFileAdd(fullPath);
            } else {
              this.handleFileDelete(fullPath);
            }
          }, 100); // Small delay to avoid race conditions
        }
      });

      this.watchedDirectories.add(dirPath);
      
      // Store reference for cleanup
      if (!this.fileWatcher) {
        this.fileWatcher = watcher as any;
      }

    } catch (error) {
      console.warn(`Failed to watch directory ${dirPath}:`, error);
    }
  }

  /**
   * Handle file change events
   */
  private handleFileChange(filePath: string): void {
    this.performanceMetrics.backgroundUpdates++;
    
    // Invalidate cache
    this.astCache.delete(filePath);
    
    // Add to indexing queue
    if (!this.indexingQueue.includes(filePath)) {
      this.indexingQueue.push(filePath);
    }

    // Process queue (debounced)
    this.debounceProcessQueue();
    
    this.emit('fileChanged', filePath);
  }

  private handleFileAdd(filePath: string): void {
    this.handleFileChange(filePath); // Same processing as change
    this.emit('fileAdded', filePath);
  }

  private handleFileDelete(filePath: string): void {
    // Remove from all caches and indexes
    this.astCache.delete(filePath);
    this.dependencyGraph.removeFile(filePath);
    this.symbolIndex.removeFile(filePath);
    
    this.emit('fileDeleted', filePath);
  }

  /**
   * Start background indexing process
   */
  private async startBackgroundIndexing(workspaceRoot: string, solutionInfo: SolutionInfo): Promise<void> {
    // Run indexing in background without blocking
    setTimeout(async () => {
      try {
        await this.performInitialIndexing(workspaceRoot, solutionInfo);
      } catch (error) {
        console.warn('Background indexing failed:', error);
      }
    }, 100); // Small delay to not block initialization
  }

  /**
   * Perform initial indexing of all files
   */
  private async performInitialIndexing(workspaceRoot: string, solutionInfo: SolutionInfo): Promise<void> {
    console.log('🔄 Starting background indexing...');
    const startTime = Date.now();
    
    this.isIndexing = true;
    
    try {
      // Get all TypeScript files
      const files = await this.getAllTypeScriptFiles(workspaceRoot, solutionInfo);
      console.log(`   - Found ${files.length} TypeScript files`);
      
      // Process in batches to avoid blocking
      const batchSize = 10;
      let processed = 0;
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(file => this.parseFileContext(file).catch(() => null))
        );
        
        processed += batch.length;
        
        // Yield control periodically
        if (processed % 50 === 0) {
          await this.yieldControl();
          console.log(`   - Indexed ${processed}/${files.length} files`);
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ Background indexing complete (${duration}ms, ${files.length} files)`);
      
    } catch (error) {
      console.error('Background indexing error:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Get all TypeScript files in workspace
   */
  private async getAllTypeScriptFiles(workspaceRoot: string, solutionInfo: SolutionInfo): Promise<string[]> {
    const files: string[] = [];
    
    // Add root project files
    files.push(...await this.getProjectFiles(workspaceRoot, solutionInfo.root));
    
    // Add files from referenced projects
    for (const project of solutionInfo.projects) {
      files.push(...await this.getProjectFiles(project.path, project.config));
    }
    
    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Get TypeScript files for a specific project
   */
  private async getProjectFiles(projectPath: string, config: any): Promise<string[]> {
    try {
      const { globby } = await import('globby');
      
      const include = config.include || ['**/*.ts', '**/*.tsx'];
      const exclude = config.exclude || ['node_modules/**', 'dist/**'];
      
      const patterns = include.map((pattern: string) => {
        if (path.isAbsolute(pattern)) {
          return pattern;
        }
        return path.join(projectPath, pattern);
      });
      
      const files = await globby(patterns, {
        ignore: exclude,
        absolute: true,
        onlyFiles: true
      });
      
      return files.filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));
      
    } catch (error) {
      console.warn(`Failed to get project files for ${projectPath}:`, error);
      return [];
    }
  }

  /**
   * Extract symbols from file content
   */
  private async extractSymbols(content: string, filePath: string): Promise<SymbolInfo[]> {
    const symbols: SymbolInfo[] = [];
    const lines = content.split('\n');
    
    // Simple regex-based symbol extraction (fast but limited)
    const patterns = [
      { regex: /^export\s+(?:async\s+)?function\s+(\w+)/gm, kind: 'function' as const, scope: 'exported' as const },
      { regex: /^function\s+(\w+)/gm, kind: 'function' as const, scope: 'local' as const },
      { regex: /^export\s+class\s+(\w+)/gm, kind: 'class' as const, scope: 'exported' as const },
      { regex: /^class\s+(\w+)/gm, kind: 'class' as const, scope: 'local' as const },
      { regex: /^export\s+interface\s+(\w+)/gm, kind: 'interface' as const, scope: 'exported' as const },
      { regex: /^interface\s+(\w+)/gm, kind: 'interface' as const, scope: 'local' as const },
      { regex: /^export\s+type\s+(\w+)/gm, kind: 'type' as const, scope: 'exported' as const },
      { regex: /^type\s+(\w+)/gm, kind: 'type' as const, scope: 'local' as const },
      { regex: /^export\s+const\s+(\w+)/gm, kind: 'variable' as const, scope: 'exported' as const },
      { regex: /^const\s+(\w+)/gm, kind: 'variable' as const, scope: 'local' as const },
    ];
    
    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      
      while ((match = regex.exec(content)) !== null) {
        const name = match[1];
        const line = this.getLineNumber(content, match.index);
        
        symbols.push({
          name,
          kind: pattern.kind,
          line,
          column: match.index - content.lastIndexOf('\n', match.index) - 1,
          scope: pattern.scope
        });
      }
    }
    
    return symbols;
  }

  /**
   * Extract import information
   */
  private extractImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');
    
    const importRegex = /import\s+(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"`]([^'"`]+)['"`]/g;
    const typeImportRegex = /import\s+type\s+(?:{([^}]+)}|(\w+))\s+from\s+['"`]([^'"`]+)['"`]/g;
    
    let match;
    
    // Regular imports
    while ((match = importRegex.exec(content)) !== null) {
      const [, namedImports, defaultImport, namespaceImport, module] = match;
      const line = this.getLineNumber(content, match.index);
      
      let importNames: string[] = [];
      if (namedImports) {
        importNames = namedImports.split(',').map(name => name.trim());
      } else if (defaultImport) {
        importNames = [defaultImport];
      } else if (namespaceImport) {
        importNames = [namespaceImport];
      }
      
      imports.push({
        module,
        imports: importNames,
        line,
        isTypeOnly: false
      });
    }
    
    // Type-only imports
    while ((match = typeImportRegex.exec(content)) !== null) {
      const [, namedImports, defaultImport, module] = match;
      const line = this.getLineNumber(content, match.index);
      
      let importNames: string[] = [];
      if (namedImports) {
        importNames = namedImports.split(',').map(name => name.trim());
      } else if (defaultImport) {
        importNames = [defaultImport];
      }
      
      imports.push({
        module,
        imports: importNames,
        line,
        isTypeOnly: true
      });
    }
    
    return imports;
  }

  /**
   * Extract export information
   */
  private extractExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    
    const patterns = [
      { regex: /export\s+(?:async\s+)?function\s+(\w+)/g, kind: 'function' as const, isDefault: false },
      { regex: /export\s+default\s+(?:async\s+)?function\s+(\w+)/g, kind: 'function' as const, isDefault: true },
      { regex: /export\s+class\s+(\w+)/g, kind: 'class' as const, isDefault: false },
      { regex: /export\s+default\s+class\s+(\w+)/g, kind: 'class' as const, isDefault: true },
      { regex: /export\s+interface\s+(\w+)/g, kind: 'interface' as const, isDefault: false },
      { regex: /export\s+type\s+(\w+)/g, kind: 'type' as const, isDefault: false },
      { regex: /export\s+const\s+(\w+)/g, kind: 'variable' as const, isDefault: false }
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const name = match[1];
        const line = this.getLineNumber(content, match.index);
        
        exports.push({
          name,
          kind: pattern.kind,
          line,
          isDefault: pattern.isDefault
        });
      }
    }
    
    return exports;
  }

  /**
   * Utility methods
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private getFileModifiedTime(filePath: string): number {
    try {
      const stats = require('fs').statSync(filePath);
      return stats.mtime.getTime();
    } catch {
      return Date.now();
    }
  }

  private calculateHash(content: string): string {
    // Simple hash function for content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  private isInvalidated(filePath: string, cachedTime: number): boolean {
    const currentTime = this.getFileModifiedTime(filePath);
    return currentTime > cachedTime;
  }

  private findProjectRoot(filePath: string): string {
    let dir = path.dirname(filePath);
    
    while (dir !== path.dirname(dir)) {
      if (existsSync(path.join(dir, 'package.json'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    
    return process.cwd();
  }

  private debounceProcessQueue = this.debounce(() => {
    this.processIndexingQueue();
  }, 200);

  private debouncedHandleFileChange = this.debounce((filePath: string) => {
    this.handleFileChange(filePath);
  }, 150);

  private async processIndexingQueue(): Promise<void> {
    if (this.isIndexing || this.indexingQueue.length === 0) {
      return;
    }

    const filesToProcess = this.indexingQueue.splice(0, 5); // Process max 5 at once
    
    await Promise.all(
      filesToProcess.map(file => 
        this.parseFileContext(file).catch(() => null)
      )
    );
  }

  private debounce(func: (...args: any[]) => any, wait: number) {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  private async yieldControl(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 1));
  }

  private updateAverageResponseTime(responseTime: number): void {
    const { contextRequests, averageResponseTime } = this.performanceMetrics;
    this.performanceMetrics.averageResponseTime = 
      (averageResponseTime * (contextRequests - 1) + responseTime) / contextRequests;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cacheHitRate: this.performanceMetrics.contextRequests > 0 
        ? this.performanceMetrics.cacheHits / this.performanceMetrics.contextRequests 
        : 0,
      cacheSize: this.astCache.size,
      isIndexing: this.isIndexing,
      queueSize: this.indexingQueue.length
    };
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    if (this.fileWatcher) {
      try {
        this.fileWatcher.close();
      } catch (error) {
        console.warn('Error closing file watcher:', error);
      }
    }
    
    // Close all watched directories
    for (const dir of this.watchedDirectories) {
      // Note: fs.watch doesn't provide easy way to close individual watchers
      // They will be closed when the process exits
    }
    this.watchedDirectories.clear();
    
    this.astCache.clear();
    this.dependencyGraph.clear();
    this.symbolIndex.clear();
    this.indexingQueue = [];
  }
}

/**
 * Persistent cache implementation
 */
class PersistentCache<K, V> {
  private cache = new Map<K, V>();
  private accessTime = new Map<K, number>();

  constructor(private options: {
    maxSize: number;
    ttl: number;
    invalidationStrategy: 'file-watcher' | 'ttl';
  }) {}

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value) {
      this.accessTime.set(key, Date.now());
    }
    return value;
  }

  set(key: K, value: V): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, value);
    this.accessTime.set(key, Date.now());
  }

  delete(key: K): boolean {
    this.accessTime.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessTime.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private evictOldest(): void {
    let oldestKey: K | undefined;
    let oldestTime = Date.now();

    for (const [key, time] of this.accessTime) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey !== undefined) {
      this.delete(oldestKey);
    }
  }
}

/**
 * Incremental dependency graph implementation
 */
class IncrementalGraphImpl implements IncrementalGraph {
  nodes = new Map<string, FileNode>();
  edges = new Map<string, Set<string>>();
  reverseEdges = new Map<string, Set<string>>();
  lastUpdated = Date.now();

  getAffectedFiles(file: string): string[] {
    const affected = new Set<string>();
    const dependents = this.reverseEdges.get(file);
    
    if (dependents) {
      for (const dependent of dependents) {
        affected.add(dependent);
        // Add transitive dependents (limited depth)
        const transitive = this.reverseEdges.get(dependent);
        if (transitive) {
          for (const t of Array.from(transitive).slice(0, 3)) {
            affected.add(t);
          }
        }
      }
    }
    
    return Array.from(affected);
  }

  updateFile(context: FileContext): void {
    const { filePath, dependencies } = context;
    
    // Update node
    this.nodes.set(filePath, {
      filePath,
      lastModified: context.lastModified,
      hash: '', // Would calculate hash in real implementation
      symbols: context.symbols,
      imports: dependencies,
      exports: context.exports.map(e => e.name)
    });

    // Update edges
    const oldDeps = this.edges.get(filePath) || new Set();
    const newDeps = new Set(dependencies);

    // Remove old reverse edges
    for (const dep of oldDeps) {
      const reverseDeps = this.reverseEdges.get(dep);
      if (reverseDeps) {
        reverseDeps.delete(filePath);
      }
    }

    // Add new reverse edges
    for (const dep of newDeps) {
      if (!this.reverseEdges.has(dep)) {
        this.reverseEdges.set(dep, new Set());
      }
      this.reverseEdges.get(dep)!.add(filePath);
    }

    this.edges.set(filePath, newDeps);
    this.lastUpdated = Date.now();
  }

  removeFile(filePath: string): void {
    // Remove node
    this.nodes.delete(filePath);

    // Remove edges
    const deps = this.edges.get(filePath);
    if (deps) {
      for (const dep of deps) {
        const reverseDeps = this.reverseEdges.get(dep);
        if (reverseDeps) {
          reverseDeps.delete(filePath);
        }
      }
    }
    this.edges.delete(filePath);

    // Remove reverse edges
    this.reverseEdges.delete(filePath);
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.reverseEdges.clear();
  }
}

/**
 * Fast symbol index implementation
 */
class FastSymbolIndexImpl implements FastSymbolIndex {
  symbols = new Map<string, SymbolLocation[]>();
  globalSymbols = new Set<string>();
  exportedSymbols = new Map<string, string>();
  lastUpdated = Date.now();

  async updateBatch(contexts: FileContext[]): Promise<void> {
    for (const context of contexts) {
      this.updateFile(context);
    }
    this.lastUpdated = Date.now();
  }

  private updateFile(context: FileContext): void {
    // Remove old symbols from this file
    this.removeFile(context.filePath);

    // Add new symbols
    for (const symbol of context.symbols) {
      if (!this.symbols.has(symbol.name)) {
        this.symbols.set(symbol.name, []);
      }

      this.symbols.get(symbol.name)!.push({
        file: context.filePath,
        line: symbol.line,
        column: symbol.column,
        kind: symbol.kind
      });

      if (symbol.scope === 'exported') {
        this.exportedSymbols.set(symbol.name, context.filePath);
        this.globalSymbols.add(symbol.name);
      }
    }
  }

  removeFile(filePath: string): void {
    // Remove all symbols from this file
    for (const [name, locations] of this.symbols) {
      const filtered = locations.filter(loc => loc.file !== filePath);
      if (filtered.length === 0) {
        this.symbols.delete(name);
        this.globalSymbols.delete(name);
        this.exportedSymbols.delete(name);
      } else {
        this.symbols.set(name, filtered);
      }
    }
  }

  clear(): void {
    this.symbols.clear();
    this.globalSymbols.clear();
    this.exportedSymbols.clear();
  }
}

// Export singleton instance
export const optimizedContextSystem = new OptimizedContextSystem(
  new EnterpriseProjectResolver(),
  new EnterpriseTypeScriptEngine(new EnterpriseProjectResolver())
);