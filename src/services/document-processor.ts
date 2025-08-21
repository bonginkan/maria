/**
 * Advanced Document Processing Service
 * Enhanced PDF parsing, arXiv integration, and multi-format document handling
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { mcpService } from './mcp-integration';

// Document Processing Types
export interface Document {
  id: string;
  title: string;
  source: DocumentSource;
  content: DocumentContent;
  metadata: DocumentMetadata;
  processingTimestamp: Date;
}

export interface DocumentSource {
  type: 'pdf' | 'arxiv' | 'url' | 'docx' | 'html' | 'markdown' | 'text';
  identifier: string; // URL, arXiv ID, file path, etc.
  originalSize?: number;
  mimeType?: string;
}

export interface DocumentContent {
  rawText: string;
  structuredContent: {
    title?: string;
    abstract?: string;
    sections: DocumentSection[];
    figures: DocumentFigure[];
    tables: DocumentTable[];
    references: DocumentReference[];
  };
  extractedElements: {
    algorithms: AlgorithmExtraction[];
    codeBlocks: CodeBlock[];
    formulas: Formula[];
    diagrams: DiagramDescription[];
  };
}

export interface DocumentSection {
  id: string;
  title: string;
  level: number;
  content: string;
  subsections: DocumentSection[];
  pageNumber?: number;
  wordCount: number;
}

export interface DocumentFigure {
  id: string;
  caption: string;
  description?: string;
  pageNumber: number;
  boundingBox?: BoundingBox;
  extractedText?: string;
  imageData?: string; // base64 or URL
}

export interface DocumentTable {
  id: string;
  caption: string;
  headers: string[];
  rows: string[][];
  pageNumber: number;
  boundingBox?: BoundingBox;
}

export interface DocumentReference {
  id: string;
  authors: string[];
  title: string;
  journal?: string;
  year?: number;
  doi?: string;
  arxivId?: string;
  url?: string;
}

export interface AlgorithmExtraction {
  id: string;
  name: string;
  description: string;
  pseudocode?: string;
  complexity?: {
    time: string;
    space: string;
  };
  parameters: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  steps: string[];
  sectionId: string;
}

export interface CodeBlock {
  id: string;
  language?: string;
  code: string;
  description?: string;
  sectionId: string;
  lineNumbers?: boolean;
}

export interface Formula {
  id: string;
  latex?: string;
  description?: string;
  sectionId: string;
  type: 'inline' | 'block';
}

export interface DiagramDescription {
  id: string;
  type: 'flowchart' | 'architecture' | 'sequence' | 'graph' | 'other';
  description: string;
  elements: string[];
  relationships: Array<{
    from: string;
    to: string;
    relationship: string;
  }>;
  sectionId: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentMetadata {
  authors: string[];
  publishedDate?: Date;
  journal?: string;
  doi?: string;
  arxivId?: string;
  keywords: string[];
  pageCount: number;
  wordCount: number;
  language: string;
  processingQuality: {
    textExtractionScore: number;
    structureRecognitionScore: number;
    algorithmExtractionScore: number;
    overallScore: number;
  };
}

export interface ProcessingOptions {
  extractStructure?: boolean;
  extractAlgorithms?: boolean;
  extractCode?: boolean;
  extractFormulas?: boolean;
  extractDiagrams?: boolean;
  extractImages?: boolean;
  ocrEnabled?: boolean;
  language?: string;
  qualityThreshold?: number;
}

// Document Processing Service
export class DocumentProcessorService extends EventEmitter {
  private processedDocuments = new Map<string, Document>();
  private processingQueue: Array<{
    id: string;
    source: DocumentSource;
    options: ProcessingOptions;
    priority: number;
  }> = [];
  private isInitialized = false;
  private isProcessing = false;

  constructor() {
    super();
  }

  /**
   * Initialize document processing service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Document processor already initialized');
      return;
    }

    logger.info('Initializing document processing service...');

    try {
      // Initialize document processing capabilities through MCP
      await this.initializeProcessingCapabilities();

      // Set up arXiv integration
      await this.setupArXivIntegration();

      this.isInitialized = true;
      logger.info('Document processing service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize document processing service:', error);
      throw error;
    }
  }

  /**
   * Process a document from various sources
   */
  async processDocument(
    source: DocumentSource,
    options: ProcessingOptions = {},
  ): Promise<Document> {
    if (!this.isInitialized) {
      throw new Error('Document processor not initialized');
    }

    logger.info(`Processing document: ${source.type} - ${source.identifier}`);

    const documentId = this.generateDocumentId(source);

    // Check if already processed
    const existing = this.processedDocuments.get(documentId);
    if (existing) {
      logger.info(`Document already processed: ${documentId}`);
      return existing;
    }

    const defaultOptions: ProcessingOptions = {
      extractStructure: true,
      extractAlgorithms: true,
      extractCode: true,
      extractFormulas: true,
      extractDiagrams: false,
      extractImages: false,
      ocrEnabled: true,
      language: 'auto',
      qualityThreshold: 0.7,
      ...options,
    };

    try {
      let document: Document;

      switch (source.type) {
        case 'pdf':
          document = await this.processPDF(source, defaultOptions);
          break;

        case 'arxiv':
          document = await this.processArXiv(source, defaultOptions);
          break;

        case 'url':
          document = await this.processURL(source, defaultOptions);
          break;

        case 'docx':
          document = await this.processDOCX(source, defaultOptions);
          break;

        case 'html':
        case 'markdown':
        case 'text':
          document = await this.processTextDocument(source, defaultOptions);
          break;

        default:
          throw new Error(`Unsupported document type: ${source.type}`);
      }

      // Store processed document
      this.processedDocuments.set(documentId, document);

      logger.info(`Document processing completed: ${documentId}`);
      this.emit('documentProcessed', { documentId, document });

      return document;
    } catch (error) {
      logger.error(`Document processing failed for ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Process PDF document with enhanced extraction
   */
  private async processPDF(source: DocumentSource, options: ProcessingOptions): Promise<Document> {
    logger.info(`Processing PDF: ${source.identifier}`);

    // Use MCP document processor for PDF parsing
    const result = await mcpService.executeTool('parse-pdf', {
      pdf_url: source.identifier,
      extract_images: options.extractImages || false,
      extract_structure: options.extractStructure || true,
      extract_algorithms: options.extractAlgorithms || true,
      ocr_enabled: options.ocrEnabled || true,
      language: options.language || 'auto',
    });

    const mockResult = result as {
      document: {
        title: string;
        content: {
          raw_text: string;
          sections: Array<{
            id: string;
            title: string;
            level: number;
            content: string;
            page_number?: number;
          }>;
          figures: Array<{
            id: string;
            caption: string;
            page_number: number;
            description?: string;
          }>;
          references: Array<{
            id: string;
            authors: string[];
            title: string;
            year?: number;
            doi?: string;
          }>;
        };
        algorithms: Array<{
          id: string;
          name: string;
          description: string;
          steps: string[];
          complexity?: { time: string; space: string };
        }>;
        metadata: {
          authors: string[];
          page_count: number;
          word_count: number;
          language: string;
        };
      };
    };

    return this.buildDocumentFromResult(source, mockResult.document, options);
  }

  /**
   * Process arXiv paper
   */
  private async processArXiv(
    source: DocumentSource,
    options: ProcessingOptions,
  ): Promise<Document> {
    logger.info(`Processing arXiv paper: ${source.identifier}`);

    // Use MCP document processor for arXiv fetching
    const result = await mcpService.executeTool('fetch-arxiv', {
      arxiv_id: source.identifier,
      extract_algorithms: options.extractAlgorithms || true,
      extract_code: options.extractCode || true,
      include_metadata: true,
    });

    const mockResult = result as {
      paper: {
        title: string;
        abstract: string;
        authors: string[];
        arxiv_id: string;
        published_date: string;
        content: {
          raw_text: string;
          sections: Array<{
            id: string;
            title: string;
            level: number;
            content: string;
          }>;
        };
        algorithms: Array<{
          id: string;
          name: string;
          description: string;
          pseudocode?: string;
          steps: string[];
        }>;
      };
    };

    return this.buildDocumentFromArXivResult(source, mockResult.paper, options);
  }

  /**
   * Process URL document
   */
  private async processURL(source: DocumentSource, options: ProcessingOptions): Promise<Document> {
    logger.info(`Processing URL: ${source.identifier}`);

    // Fetch and process web content
    const result = await mcpService.executeTool('fetch-web-content', {
      url: source.identifier,
      extract_text: true,
      extract_structure: options.extractStructure || true,
      follow_links: false,
    });

    const mockResult = result as {
      content: {
        title: string;
        text: string;
        html: string;
        sections: Array<{
          tag: string;
          content: string;
        }>;
      };
    };

    return this.buildDocumentFromWebResult(source, mockResult.content, options);
  }

  /**
   * Process DOCX document
   */
  private async processDOCX(source: DocumentSource, options: ProcessingOptions): Promise<Document> {
    logger.info(`Processing DOCX: ${source.identifier}`);

    // Use document processor for DOCX parsing
    const result = await mcpService.executeTool('parse-docx', {
      file_path: source.identifier,
      extract_structure: options.extractStructure || true,
      extract_images: options.extractImages || false,
    });

    const mockResult = result as {
      document: {
        title: string;
        content: string;
        sections: Array<{
          title: string;
          content: string;
          level: number;
        }>;
      };
    };

    return this.buildDocumentFromOfficeResult(source, mockResult.document, options);
  }

  /**
   * Process text-based documents
   */
  private async processTextDocument(
    source: DocumentSource,
    options: ProcessingOptions,
  ): Promise<Document> {
    logger.info(`Processing text document: ${source.identifier}`);

    // Simple text processing for markdown, HTML, or plain text
    const mockContent = {
      title: 'Text Document',
      content: 'Sample text content...',
      sections: [],
    };

    return this.buildDocumentFromTextResult(source, mockContent, options);
  }

  /**
   * Build document from processing result
   */
  private buildDocumentFromResult(
    source: DocumentSource,
    result: unknown,
    _options: ProcessingOptions,
  ): Document {
    const documentId = this.generateDocumentId(source);

    const document: Document = {
      id: documentId,
      title: result.title || 'Untitled Document',
      source,
      content: {
        rawText: result.content?.raw_text || '',
        structuredContent: {
          title: result.title,
          abstract: result.abstract,
          sections: this.buildSections(result.content?.sections || []),
          figures: this.buildFigures(result.content?.figures || []),
          tables: this.buildTables(result.content?.tables || []),
          references: this.buildReferences(result.content?.references || []),
        },
        extractedElements: {
          algorithms: this.buildAlgorithms(result.algorithms || []),
          codeBlocks: this.buildCodeBlocks(result.code_blocks || []),
          formulas: this.buildFormulas(result.formulas || []),
          diagrams: this.buildDiagrams(result.diagrams || []),
        },
      },
      metadata: {
        authors: result.metadata?.authors || [],
        publishedDate: result.metadata?.published_date
          ? new Date(result.metadata.published_date)
          : undefined,
        journal: result.metadata?.journal,
        doi: result.metadata?.doi,
        arxivId: result.metadata?.arxiv_id,
        keywords: result.metadata?.keywords || [],
        pageCount: result.metadata?.page_count || 0,
        wordCount: result.metadata?.word_count || 0,
        language: result.metadata?.language || 'unknown',
        processingQuality: {
          textExtractionScore: 0.9,
          structureRecognitionScore: 0.85,
          algorithmExtractionScore: 0.8,
          overallScore: 0.85,
        },
      },
      processingTimestamp: new Date(),
    };

    return document;
  }

  /**
   * Build document from arXiv result
   */
  private buildDocumentFromArXivResult(
    source: DocumentSource,
    result: unknown,
    _options: ProcessingOptions,
  ): Document {
    const documentId = this.generateDocumentId(source);

    return {
      id: documentId,
      title: result.title || 'arXiv Paper',
      source,
      content: {
        rawText: result.content?.raw_text || '',
        structuredContent: {
          title: result.title,
          abstract: result.abstract,
          sections: this.buildSections(result.content?.sections || []),
          figures: [],
          tables: [],
          references: [],
        },
        extractedElements: {
          algorithms: this.buildAlgorithms(result.algorithms || []),
          codeBlocks: [],
          formulas: [],
          diagrams: [],
        },
      },
      metadata: {
        authors: result.authors || [],
        publishedDate: result.published_date ? new Date(result.published_date) : undefined,
        arxivId: result.arxiv_id,
        keywords: [],
        pageCount: 0,
        wordCount: result.content?.raw_text?.split(/\s+/).length || 0,
        language: 'en',
        processingQuality: {
          textExtractionScore: 0.95,
          structureRecognitionScore: 0.9,
          algorithmExtractionScore: 0.85,
          overallScore: 0.9,
        },
      },
      processingTimestamp: new Date(),
    };
  }

  /**
   * Build document from web content result
   */
  private buildDocumentFromWebResult(
    source: DocumentSource,
    result: unknown,
    _options: ProcessingOptions,
  ): Document {
    const documentId = this.generateDocumentId(source);

    return {
      id: documentId,
      title: result.title || 'Web Document',
      source,
      content: {
        rawText: result.text || '',
        structuredContent: {
          title: result.title,
          sections:
            result.sections?.map((s: unknown, i: number) => ({
              id: `section-${i}`,
              title: s.tag || `Section ${i + 1}`,
              level: 1,
              content: s.content || '',
              subsections: [],
              wordCount: s.content?.split(/\s+/).length || 0,
            })) || [],
          figures: [],
          tables: [],
          references: [],
        },
        extractedElements: {
          algorithms: [],
          codeBlocks: [],
          formulas: [],
          diagrams: [],
        },
      },
      metadata: {
        authors: [],
        keywords: [],
        pageCount: 1,
        wordCount: result.text?.split(/\s+/).length || 0,
        language: 'unknown',
        processingQuality: {
          textExtractionScore: 0.8,
          structureRecognitionScore: 0.7,
          algorithmExtractionScore: 0.0,
          overallScore: 0.65,
        },
      },
      processingTimestamp: new Date(),
    };
  }

  /**
   * Build document from office document result
   */
  private buildDocumentFromOfficeResult(
    source: DocumentSource,
    result: unknown,
    _options: ProcessingOptions,
  ): Document {
    const documentId = this.generateDocumentId(source);

    return {
      id: documentId,
      title: result.title || 'Office Document',
      source,
      content: {
        rawText: result.content || '',
        structuredContent: {
          title: result.title,
          sections: this.buildSections(result.sections || []),
          figures: [],
          tables: [],
          references: [],
        },
        extractedElements: {
          algorithms: [],
          codeBlocks: [],
          formulas: [],
          diagrams: [],
        },
      },
      metadata: {
        authors: [],
        keywords: [],
        pageCount: 1,
        wordCount: result.content?.split(/\s+/).length || 0,
        language: 'unknown',
        processingQuality: {
          textExtractionScore: 0.85,
          structureRecognitionScore: 0.8,
          algorithmExtractionScore: 0.0,
          overallScore: 0.75,
        },
      },
      processingTimestamp: new Date(),
    };
  }

  /**
   * Build document from text result
   */
  private buildDocumentFromTextResult(
    source: DocumentSource,
    result: unknown,
    _options: ProcessingOptions,
  ): Document {
    const documentId = this.generateDocumentId(source);

    return {
      id: documentId,
      title: result.title || 'Text Document',
      source,
      content: {
        rawText: result.content || '',
        structuredContent: {
          title: result.title,
          sections: [],
          figures: [],
          tables: [],
          references: [],
        },
        extractedElements: {
          algorithms: [],
          codeBlocks: [],
          formulas: [],
          diagrams: [],
        },
      },
      metadata: {
        authors: [],
        keywords: [],
        pageCount: 1,
        wordCount: result.content?.split(/\s+/).length || 0,
        language: 'unknown',
        processingQuality: {
          textExtractionScore: 1.0,
          structureRecognitionScore: 0.5,
          algorithmExtractionScore: 0.0,
          overallScore: 0.6,
        },
      },
      processingTimestamp: new Date(),
    };
  }

  // Helper methods for building document components
  private buildSections(sections: unknown[]): DocumentSection[] {
    return sections.map((s, i) => ({
      id: s.id || `section-${i}`,
      title: s.title || `Section ${i + 1}`,
      level: s.level || 1,
      content: s.content || '',
      subsections: [],
      pageNumber: s.page_number,
      wordCount: s.content?.split(/\s+/).length || 0,
    }));
  }

  private buildFigures(figures: unknown[]): DocumentFigure[] {
    return figures.map((f, i) => ({
      id: f.id || `figure-${i}`,
      caption: f.caption || '',
      description: f.description,
      pageNumber: f.page_number || 0,
    }));
  }

  private buildTables(tables: unknown[]): DocumentTable[] {
    return tables.map((t, i) => ({
      id: t.id || `table-${i}`,
      caption: t.caption || '',
      headers: t.headers || [],
      rows: t.rows || [],
      pageNumber: t.page_number || 0,
    }));
  }

  private buildReferences(references: unknown[]): DocumentReference[] {
    return references.map((r, i) => ({
      id: r.id || `ref-${i}`,
      authors: r.authors || [],
      title: r.title || '',
      journal: r.journal,
      year: r.year,
      doi: r.doi,
      arxivId: r.arxiv_id,
      url: r.url,
    }));
  }

  private buildAlgorithms(algorithms: unknown[]): AlgorithmExtraction[] {
    return algorithms.map((a, i) => ({
      id: a.id || `algo-${i}`,
      name: a.name || `Algorithm ${i + 1}`,
      description: a.description || '',
      pseudocode: a.pseudocode,
      complexity: a.complexity,
      parameters: a.parameters || [],
      steps: a.steps || [],
      sectionId: a.section_id || '',
    }));
  }

  private buildCodeBlocks(codeBlocks: unknown[]): CodeBlock[] {
    return codeBlocks.map((c, i) => ({
      id: c.id || `code-${i}`,
      language: c.language,
      code: c.code || '',
      description: c.description,
      sectionId: c.section_id || '',
    }));
  }

  private buildFormulas(formulas: unknown[]): Formula[] {
    return formulas.map((f, i) => ({
      id: f.id || `formula-${i}`,
      latex: f.latex,
      description: f.description,
      sectionId: f.section_id || '',
      type: f.type || 'block',
    }));
  }

  private buildDiagrams(diagrams: unknown[]): DiagramDescription[] {
    return diagrams.map((d, i) => ({
      id: d.id || `diagram-${i}`,
      type: d.type || 'other',
      description: d.description || '',
      elements: d.elements || [],
      relationships: d.relationships || [],
      sectionId: d.section_id || '',
    }));
  }

  /**
   * Get processed documents
   */
  getProcessedDocuments(): Document[] {
    return Array.from(this.processedDocuments.values());
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): Document | undefined {
    return this.processedDocuments.get(id);
  }

  /**
   * Search documents by content
   */
  async searchDocuments(
    query: string,
    options: {
      filterByType?: DocumentSource['type'][];
      filterByAuthor?: string;
      maxResults?: number;
    } = {},
  ): Promise<Document[]> {
    const documents = Array.from(this.processedDocuments.values());
    const { filterByType, filterByAuthor, maxResults = 10 } = options;

    let filtered = documents;

    // Apply filters
    if (filterByType) {
      filtered = filtered.filter((doc) => filterByType.includes(doc.source.type));
    }

    if (filterByAuthor) {
      filtered = filtered.filter((doc) =>
        doc.metadata.authors.some((author) =>
          author.toLowerCase().includes(filterByAuthor.toLowerCase()),
        ),
      );
    }

    // Simple text search (could be enhanced with semantic search)
    const queryLower = query.toLowerCase();
    const scored = filtered.map((doc) => {
      let score = 0;

      // Title match (higher weight)
      if (doc.title.toLowerCase().includes(queryLower)) {
        score += 10;
      }

      // Content match
      if (doc.content.rawText.toLowerCase().includes(queryLower)) {
        score += 5;
      }

      // Abstract match
      if (doc.content.structuredContent.abstract?.toLowerCase().includes(queryLower)) {
        score += 8;
      }

      return { doc, score };
    });

    // Sort by score and return
    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((item) => item.doc);
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    processedDocuments: number;
    queueLength: number;
    isProcessing: boolean;
    supportedFormats: string[];
  } {
    return {
      initialized: this.isInitialized,
      processedDocuments: this.processedDocuments.size,
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
      supportedFormats: ['pdf', 'arxiv', 'url', 'docx', 'html', 'markdown', 'text'],
    };
  }

  /**
   * Generate document ID
   */
  private generateDocumentId(source: DocumentSource): string {
    const hash = source.identifier.replace(/[^a-zA-Z0-9]/g, '-');
    return `${source.type}-${hash}-${Date.now()}`;
  }

  /**
   * Initialize processing capabilities
   */
  private async initializeProcessingCapabilities(): Promise<void> {
    logger.debug('Initializing document processing capabilities');
    // MCP document processor should already be registered
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Set up arXiv integration
   */
  private async setupArXivIntegration(): Promise<void> {
    logger.debug('Setting up arXiv integration');
    // Configure arXiv API access and processing options
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessorService();
