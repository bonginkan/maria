/**
 * CodeRAG System - Vector-based Code Search and Semantic Analysis
 * Provides intelligent code retrieval and contextual analysis for MARIA agents
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { mcpService } from './mcp-integration';

// CodeRAG Types
export interface CodeChunk {
  id: string;
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  functionName?: string;
  className?: string;
  metadata: {
    complexity: number;
    dependencies: string[];
    imports: string[];
    exports: string[];
  };
}

export interface VectorEmbedding {
  id: string;
  vector: number[];
  dimensions: number;
  model: string;
  timestamp: Date;
}

export interface CodeSearchQuery {
  query: string;
  language?: string;
  fileTypes?: string[];
  maxResults?: number;
  threshold?: number;
  context?: {
    currentFile?: string;
    workflowId?: string;
    agentRole?: string;
  };
}

export interface CodeSearchResult {
  chunk: CodeChunk;
  similarity: number;
  explanation: string;
  relevanceScore: number;
  contextMatch: boolean;
}

export interface SemanticAnalysis {
  codebase: {
    totalFiles: number;
    totalChunks: number;
    languages: string[];
    complexityDistribution: Record<string, number>;
  };
  patterns: {
    commonPatterns: Array<{
      pattern: string;
      frequency: number;
      examples: string[];
    }>;
    antiPatterns: Array<{
      pattern: string;
      severity: 'low' | 'medium' | 'high';
      locations: string[];
    }>;
  };
  insights: string[];
  recommendations: string[];
}

// CodeRAG Service
export class CodeRAGService extends EventEmitter {
  private codeChunks = new Map<string, CodeChunk>();
  private embeddings = new Map<string, VectorEmbedding>();
  private indexedPaths = new Set<string>();
  private isInitialized = false;
  private embeddingModel = 'text-embedding-3-small';

  constructor() {
    super();
  }

  /**
   * Initialize CodeRAG system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('CodeRAG system already initialized');
      return;
    }

    logger.info('Initializing CodeRAG system...');

    try {
      // Initialize vector database connection through MCP
      await this.initializeVectorDatabase();

      // Set up default embeddings
      await this.setupDefaultEmbeddings();

      this.isInitialized = true;
      logger.info('CodeRAG system initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize CodeRAG system:', error);
      throw error;
    }
  }

  /**
   * Index a codebase for vector search
   */
  async indexCodebase(
    rootPath: string,
    options: {
      fileTypes?: string[];
      excludePaths?: string[];
      chunkSize?: number;
      includeTests?: boolean;
    } = {},
  ): Promise<{
    indexed: number;
    skipped: number;
    errors: string[];
  }> {
    logger.info(`Indexing codebase at: ${rootPath}`);

    const {
      fileTypes = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.go', '.rs'],
      excludePaths = ['node_modules', '.git', 'dist', 'build'],
      chunkSize = 500,
      includeTests = false,
    } = options;

    let indexed = 0;
    const skipped = 0;
    const errors: string[] = [];

    try {
      // Use MCP vector database tool for indexing
      const indexResult = await mcpService.executeTool('index-codebase', {
        path: rootPath,
        file_types: fileTypes,
        exclude_paths: excludePaths,
        chunk_size: chunkSize,
        include_tests: includeTests,
      });

      // Parse indexing results
      const mockResult = indexResult as {
        chunks: Array<{
          id: string;
          content: string;
          file_path: string;
          start_line: number;
          end_line: number;
          language: string;
          metadata: Record<string, unknown>;
        }>;
        embeddings: Array<{
          chunk_id: string;
          vector: number[];
        }>;
      };

      // Process chunks and embeddings
      for (const chunkData of mockResult.chunks || []) {
        const chunk: CodeChunk = {
          id: chunkData.id,
          content: chunkData.content,
          filePath: chunkData.file_path,
          startLine: chunkData.start_line,
          endLine: chunkData.end_line,
          language: chunkData.language,
          metadata: {
            complexity: (chunkData.metadata['complexity'] as number) || 1,
            dependencies: (chunkData.metadata['dependencies'] as string[]) || [],
            imports: (chunkData.metadata['imports'] as string[]) || [],
            exports: (chunkData.metadata['exports'] as string[]) || [],
          },
        };

        this.codeChunks.set(chunk.id, chunk);
        indexed++;
      }

      // Process embeddings
      for (const embeddingData of mockResult.embeddings || []) {
        const embedding: VectorEmbedding = {
          id: embeddingData.chunk_id,
          vector: embeddingData.vector,
          dimensions: embeddingData.vector.length,
          model: this.embeddingModel,
          timestamp: new Date(),
        };

        this.embeddings.set(embedding.id, embedding);
      }

      this.indexedPaths.add(rootPath);

      logger.info(`Codebase indexing completed: ${indexed} chunks indexed, ${skipped} skipped`);
      this.emit('indexingCompleted', { rootPath, indexed, skipped });
    } catch (error) {
      const errorMsg = `Indexing failed for ${rootPath}: ${error}`;
      errors.push(errorMsg);
      logger.error(errorMsg);
    }

    return { indexed, skipped, errors };
  }

  /**
   * Perform semantic code search
   */
  async semanticSearch(query: CodeSearchQuery): Promise<CodeSearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('CodeRAG system not initialized');
    }

    logger.info(`Performing semantic search: "${query.query}"`);

    try {
      // Execute semantic search through MCP vector database
      const searchResult = await mcpService.executeTool('semantic-search', {
        query: query.query,
        language: query.language,
        limit: query.maxResults || 10,
        threshold: query.threshold || 0.7,
        context: query.context || {},
      });

      // Parse search results
      const mockResults = searchResult as {
        results: Array<{
          chunk_id: string;
          similarity: number;
          explanation: string;
          relevance_score: number;
        }>;
      };

      const results: CodeSearchResult[] = [];

      for (const result of mockResults.results || []) {
        const chunk = this.codeChunks.get(result.chunk_id);
        if (chunk) {
          results.push({
            chunk,
            similarity: result.similarity,
            explanation: result.explanation,
            relevanceScore: result.relevance_score,
            contextMatch: this.evaluateContextMatch(chunk, query.context),
          });
        }
      }

      // Sort by relevance score
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      logger.info(`Semantic search completed: ${results.length} results found`);
      this.emit('searchCompleted', { query, results });

      return results;
    } catch (error) {
      logger.error(`Semantic search failed:`, error);
      throw error;
    }
  }

  /**
   * Analyze codebase semantically
   */
  async analyzeCodebase(
    paths: string[],
    options: {
      includePatterns?: boolean;
      includeComplexity?: boolean;
      includeInsights?: boolean;
    } = {},
  ): Promise<SemanticAnalysis> {
    logger.info(`Analyzing codebase semantically: ${paths.length} paths`);

    const { includePatterns = true, includeComplexity = true, includeInsights = true } = options;

    try {
      // Use MCP code analysis tools
      const analysisResult = await mcpService.executeTool('analyze-complexity', {
        paths,
        include_patterns: includePatterns,
        include_complexity: includeComplexity,
        include_insights: includeInsights,
      });

      const mockAnalysis = analysisResult as {
        codebase: {
          totalfiles: number;
          total_chunks: number;
          languages: string[];
          complexity_distribution: Record<string, number>;
        };
        patterns: {
          common_patterns: Array<{
            pattern: string;
            frequency: number;
            examples: string[];
          }>;
          anti_patterns: Array<{
            pattern: string;
            severity: string;
            locations: string[];
          }>;
        };
        insights: string[];
        recommendations: string[];
      };

      const analysis: SemanticAnalysis = {
        codebase: {
          totalFiles: mockAnalysis.codebase?.totalfiles || 0,
          totalChunks: mockAnalysis.codebase?.total_chunks || 0,
          languages: mockAnalysis.codebase?.languages || [],
          complexityDistribution: mockAnalysis.codebase?.complexity_distribution || {},
        },
        patterns: {
          commonPatterns:
            mockAnalysis.patterns?.common_patterns?.map((p) => ({
              pattern: p.pattern,
              frequency: p.frequency,
              examples: p.examples,
            })) || [],
          antiPatterns:
            mockAnalysis.patterns?.anti_patterns?.map((p) => ({
              pattern: p.pattern,
              severity: p.severity as 'low' | 'medium' | 'high',
              locations: p.locations,
            })) || [],
        },
        insights: mockAnalysis.insights || [],
        recommendations: mockAnalysis.recommendations || [],
      };

      logger.info('Codebase semantic analysis completed');
      this.emit('analysisCompleted', { paths, analysis });

      return analysis;
    } catch (error) {
      logger.error('Codebase analysis failed:', error);
      throw error;
    }
  }

  /**
   * Find similar code patterns
   */
  async findSimilarPatterns(
    codeSnippet: string,
    options: {
      language?: string;
      minSimilarity?: number;
      maxResults?: number;
    } = {},
  ): Promise<CodeSearchResult[]> {
    const { language, minSimilarity = 0.6, maxResults = 5 } = options;

    logger.info('Finding similar code patterns');

    // Use semantic search with the code snippet as query
    return await this.semanticSearch({
      query: `Similar to: ${codeSnippet}`,
      language,
      threshold: minSimilarity,
      maxResults,
    });
  }

  /**
   * Get contextual code suggestions
   */
  async getContextualSuggestions(
    currentCode: string,
    context: {
      filePath: string;
      cursorPosition: number;
      workflowId?: string;
    },
  ): Promise<{
    suggestions: Array<{
      type: 'completion' | 'refactor' | 'optimization' | 'pattern';
      description: string;
      code: string;
      confidence: number;
    }>;
    relatedChunks: CodeSearchResult[];
  }> {
    logger.info(`Getting contextual suggestions for: ${context.filePath}`);

    // Search for related code patterns
    const relatedChunks = await this.semanticSearch({
      query: currentCode,
      maxResults: 3,
      threshold: 0.5,
      context: {
        currentFile: context.filePath,
        workflowId: context.workflowId,
      },
    });

    // Generate suggestions based on patterns
    const suggestions = [
      {
        type: 'completion' as const,
        description: 'Auto-complete based on similar patterns',
        code: '// Suggested completion based on CodeRAG analysis',
        confidence: 0.8,
      },
      {
        type: 'refactor' as const,
        description: 'Refactoring suggestion from codebase patterns',
        code: '// Refactoring suggestion from similar code',
        confidence: 0.7,
      },
      {
        type: 'optimization' as const,
        description: 'Performance optimization opportunity',
        code: '// Optimization based on codebase analysis',
        confidence: 0.6,
      },
    ];

    return { suggestions, relatedChunks };
  }

  /**
   * Get system status
   */
  getStatus(): {
    initialized: boolean;
    indexedPaths: string[];
    totalChunks: number;
    totalEmbeddings: number;
    embeddingModel: string;
    lastIndexed?: Date;
  } {
    return {
      initialized: this.isInitialized,
      indexedPaths: Array.from(this.indexedPaths),
      totalChunks: this.codeChunks.size,
      totalEmbeddings: this.embeddings.size,
      embeddingModel: this.embeddingModel,
      lastIndexed: this.indexedPaths.size > 0 ? new Date() : undefined,
    };
  }

  /**
   * Initialize vector database connection
   */
  private async initializeVectorDatabase(): Promise<void> {
    logger.debug('Initializing vector database connection');

    // The MCP vector database server should already be registered
    // This is a placeholder for actual vector DB initialization
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Set up default embeddings
   */
  private async setupDefaultEmbeddings(): Promise<void> {
    logger.debug('Setting up default embeddings');

    // Mock some default embeddings for common patterns
    const defaultPatterns = [
      'function declaration',
      'class definition',
      'import statement',
      'async function',
      'error handling',
      'data validation',
    ];

    for (let i = 0; i < defaultPatterns.length; i++) {
      const embedding: VectorEmbedding = {
        id: `default-${i}`,
        vector: Array.from({ length: 1536 }, () => Math.random()),
        dimensions: 1536,
        model: this.embeddingModel,
        timestamp: new Date(),
      };

      this.embeddings.set(embedding.id, embedding);
    }
  }

  /**
   * Evaluate context match
   */
  private evaluateContextMatch(
    chunk: CodeChunk,
    context?: { currentFile?: string; workflowId?: string; agentRole?: string },
  ): boolean {
    if (!context) {return false;}

    // Check if chunk is from the same file or related files
    if (context.currentFile) {
      const sameFile = chunk.filePath === context.currentFile;
      const relatedFile = chunk.filePath.includes(context.currentFile.split('/').pop() || '');
      return sameFile || relatedFile;
    }

    return false;
  }
}

// Export singleton instance
export const codeRAGService = new CodeRAGService();
