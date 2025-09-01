/**
 * Intelligent Document Save Service
 * Autonomously determines file names, extensions, and directory organization
 * Integrates with FilenameInferenceService for intelligent naming
 */

import { writeFile, mkdir } from "fs/promises";
import * as path from "path";
import { FilenameInferenceService } from './code-intent/FilenameInferenceService.js';
import { 
  DocumentType,
  classifyDocument,
  formatAsMarkdown,
  autoSaveDocument as originalAutoSave,
  autoSaveMultipleDocuments as originalAutoSaveMultiple
} from './document-auto-save.js';
import { ProjectContext } from './code-intent/types/filename-inference.types.js';

/**
 * Enhanced save options with intelligent features
 */
export interface IntelligentSaveOptions {
  userIntent?: string;
  projectContext?: ProjectContext;
  autoOrganize?: boolean;
  trackRelationships?: boolean;
  learnFromUser?: boolean;
  suggestAlternatives?: boolean;
}

/**
 * Save result with additional metadata
 */
export interface IntelligentSaveResult {
  path: string;
  filename: string;
  directory: string;
  confidence: number;
  reasoning: string;
  alternatives?: string[];
  relationships?: string[];
}

/**
 * Intelligent Document Save Service
 */
export class IntelligentDocumentSaveService {
  private filenameInference: FilenameInferenceService;
  private projectContext: ProjectContext;

  constructor(projectContext?: ProjectContext) {
    this.filenameInference = new FilenameInferenceService({
      priority: 'contextual',
      confidenceThreshold: 0.6,
      fallbackStrategy: 'generic'
    });
    
    this.projectContext = projectContext || {
      root: process.cwd(),
      conventions: {
        fileNaming: 'kebab-case',
        directories: {
          components: 'src/components',
          pages: 'src/pages',
          utils: 'src/utils',
          services: 'src/services',
          styles: 'src/styles',
          tests: 'tests'
        },
        extensions: {
          react: '.tsx',
          typescript: '.ts',
          javascript: '.js',
          styles: '.css'
        }
      }
    };
  }

  /**
   * Intelligently save content with autonomous decision making
   */
  async save(
    content: string,
    options: IntelligentSaveOptions = {}
  ): Promise<IntelligentSaveResult> {
    // 1. Analyze content to understand what it is
    const contentAnalysis = await this.analyzeContent(content);
    
    // 2. Infer the best filename
    const filenameResult = await this.filenameInference.inferFilename(
      options.userIntent || contentAnalysis.summary,
      content,
      options.projectContext || this.projectContext
    );

    // 3. Determine optimal directory placement
    let directory = this.projectContext.root || process.cwd();
    if (options.autoOrganize !== false) {
      directory = await this.filenameInference.determineDirectory(
        filenameResult.filename,
        content,
        options.projectContext || this.projectContext
      );
    }

    // 4. Format content based on type
    let formattedContent = content;
    const docType = classifyDocument(content);
    if (docType && !this.isCodeFile(filenameResult.extension)) {
      formattedContent = formatAsMarkdown(content, docType);
    }

    // 5. Ensure directory exists
    await mkdir(directory, { recursive: true });

    // 6. Generate full path
    const fullPath = path.join(directory, filenameResult.filename);

    // 7. Save the file
    await writeFile(fullPath, formattedContent, 'utf8');

    // 8. Track relationships if requested
    const relationships: string[] = [];
    if (options.trackRelationships) {
      relationships.push(...await this.trackRelationships(fullPath, content));
    }

    // 9. Learn from user behavior if enabled
    if (options.learnFromUser) {
      await this.learnFromSave(filenameResult.filename, content, options.userIntent);
    }

    // 10. Return comprehensive result
    return {
      path: fullPath,
      filename: filenameResult.filename,
      directory,
      confidence: filenameResult.confidence,
      reasoning: filenameResult.reasoning,
      alternatives: options.suggestAlternatives ? filenameResult.alternatives : undefined,
      relationships: relationships.length > 0 ? relationships : undefined
    };
  }

  /**
   * Save multiple documents intelligently
   */
  async saveMultiple(
    documents: Array<{ content: string; hint?: string }>,
    options: IntelligentSaveOptions = {}
  ): Promise<IntelligentSaveResult[]> {
    const results: IntelligentSaveResult[] = [];
    
    for (const doc of documents) {
      const result = await this.save(doc.content, {
        ...options,
        userIntent: doc.hint || options.userIntent
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Analyze content to understand its nature
   */
  private async analyzeContent(content: string): Promise<{
    type: string;
    language?: string;
    framework?: string;
    summary: string;
    keywords: string[];
  }> {
    // Detect document type
    const docType = classifyDocument(content);
    
    // Extract key information
    const keywords = this.extractKeywords(content);
    const language = this.detectLanguage(content);
    const framework = this.detectFramework(content);
    
    // Generate summary
    const summary = this.generateSummary(content, keywords);

    return {
      type: docType || 'unknown',
      language,
      framework,
      summary,
      keywords
    };
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    const keywords: string[] = [];
    
    // Extract from headers
    const headers = content.match(/^#+\s+(.+)$/gm);
    if (headers) {
      keywords.push(...headers.map(h => h.replace(/^#+\s+/, '').toLowerCase()));
    }

    // Extract from class/function names
    const classNames = content.match(/(?:class|interface|type)\s+(\w+)/g);
    if (classNames) {
      keywords.push(...classNames.map(c => c.replace(/(?:class|interface|type)\s+/, '').toLowerCase()));
    }

    // Extract from important words
    const importantWords = ['api', 'component', 'service', 'model', 'controller', 'view', 
                           'test', 'spec', 'config', 'util', 'helper', 'manager'];
    for (const word of importantWords) {
      if (content.toLowerCase().includes(word)) {
        keywords.push(word);
      }
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Detect programming language
   */
  private detectLanguage(content: string): string | undefined {
    if (/import.*from ['"]react['"]/.test(content)) return 'typescript-react';
    if (/import.*React/.test(content)) return 'javascript-react';
    if (/interface\s+\w+/.test(content)) return 'typescript';
    if (/def\s+\w+\(/.test(content)) return 'python';
    if (/public\s+class/.test(content)) return 'java';
    if (/func\s+\w+/.test(content)) return 'go';
    if (/fn\s+\w+/.test(content)) return 'rust';
    if (/<\?php/.test(content)) return 'php';
    if (/function\s+\w+/.test(content)) return 'javascript';
    return undefined;
  }

  /**
   * Detect framework
   */
  private detectFramework(content: string): string | undefined {
    if (/import.*from ['"]react['"]/.test(content)) return 'react';
    if (/import.*from ['"]vue['"]/.test(content)) return 'vue';
    if (/import.*from ['"]@angular/.test(content)) return 'angular';
    if (/import.*from ['"]express['"]/.test(content)) return 'express';
    if (/import.*from ['"]fastify['"]/.test(content)) return 'fastify';
    if (/from django/.test(content)) return 'django';
    if (/from flask/.test(content)) return 'flask';
    if (/import org.springframework/.test(content)) return 'spring';
    return undefined;
  }

  /**
   * Generate content summary
   */
  private generateSummary(content: string, keywords: string[]): string {
    // Try to extract first meaningful line
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const firstLine = lines[0] || '';
    
    // Combine with keywords
    if (keywords.length > 0) {
      return `${keywords.slice(0, 3).join(' ')} ${firstLine.slice(0, 50)}`.trim();
    }
    
    return firstLine.slice(0, 100);
  }

  /**
   * Track file relationships
   */
  private async trackRelationships(filepath: string, content: string): Promise<string[]> {
    const relationships: string[] = [];
    
    // Extract imports
    const imports = this.extractImports(content);
    if (imports.length > 0) {
      await this.filenameInference.trackFileRelationship(filepath, imports, 'imports');
      relationships.push(...imports);
    }

    // Extract references to other files
    const fileRefs = content.match(/['"](\.\.?\/[^'"]+)['"]/g);
    if (fileRefs) {
      const refs = fileRefs.map(r => r.replace(/['"]/g, ''));
      await this.filenameInference.trackFileRelationship(filepath, refs, 'imports');
      relationships.push(...refs);
    }

    return relationships;
  }

  /**
   * Extract import statements
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    
    // JavaScript/TypeScript imports
    const jsImports = content.match(/(?:import|require)\s*\(?['"]([^'"]+)['"]/g);
    if (jsImports) {
      imports.push(...jsImports.map(i => i.replace(/.*['"]([^'"]+)['"].*/, '$1')));
    }
    
    // Python imports
    const pyImports = content.match(/(?:from|import)\s+(\S+)/g);
    if (pyImports) {
      imports.push(...pyImports.map(i => i.replace(/(?:from|import)\s+/, '')));
    }
    
    return imports;
  }

  /**
   * Learn from user save patterns
   */
  private async learnFromSave(
    filename: string,
    content: string,
    userIntent?: string
  ): Promise<void> {
    // Extract patterns from this save
    const pattern = {
      filename,
      extension: path.extname(filename),
      keywords: this.extractKeywords(content),
      intent: userIntent,
      timestamp: new Date().toISOString()
    };

    // Store in learning file (would be better in a database)
    const learningFile = path.join(process.cwd(), '.maria', 'save-patterns.json');
    let patterns: any[] = [];
    
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(learningFile, 'utf-8');
      patterns = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    patterns.push(pattern);
    
    // Keep only last 100 patterns
    if (patterns.length > 100) {
      patterns = patterns.slice(-100);
    }

    // Ensure directory exists
    await mkdir(path.dirname(learningFile), { recursive: true });
    const fs = await import('fs/promises');
    await fs.writeFile(learningFile, JSON.stringify(patterns, null, 2));
  }

  /**
   * Check if file extension indicates code file
   */
  private isCodeFile(extension: string): boolean {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs',
      '.php', '.rb', '.swift', '.kt', '.cs', '.cpp', '.c', '.h',
      '.sh', '.bash', '.sql', '.html', '.css', '.scss', '.sass'
    ];
    return codeExtensions.includes(extension.toLowerCase());
  }

  /**
   * Get suggestions for better organization
   */
  async getSuggestions(content: string): Promise<{
    filename: string;
    directory: string;
    reasoning: string;
  }[]> {
    const analysis = await this.analyzeContent(content);
    const suggestions: any[] = [];

    // Get primary suggestion
    const primary = await this.filenameInference.inferFilename(
      analysis.summary,
      content,
      this.projectContext
    );

    suggestions.push({
      filename: primary.filename,
      directory: await this.filenameInference.determineDirectory(
        primary.filename,
        content,
        this.projectContext
      ),
      reasoning: primary.reasoning
    });

    // Add alternatives
    if (primary.alternatives) {
      for (const alt of primary.alternatives.slice(0, 2)) {
        suggestions.push({
          filename: alt,
          directory: await this.filenameInference.determineDirectory(
            alt,
            content,
            this.projectContext
          ),
          reasoning: 'Alternative suggestion'
        });
      }
    }

    return suggestions;
  }
}

// Export singleton instance for convenience
export const intelligentSave = new IntelligentDocumentSaveService();

// Export enhanced auto-save functions
export async function autoSaveIntelligently(
  content: string,
  userHint?: string
): Promise<string | null> {
  try {
    const result = await intelligentSave.save(content, {
      userIntent: userHint,
      autoOrganize: true,
      trackRelationships: true
    });
    return result.path;
  } catch (error) {
    console.error('Intelligent auto-save failed:', error);
    // Fall back to original auto-save
    return originalAutoSave(content, userHint);
  }
}

export async function autoSaveMultipleIntelligently(
  content: string,
  baseHint?: string
): Promise<string[]> {
  try {
    // Split content into documents
    const documents = splitIntoDocuments(content);
    const results = await intelligentSave.saveMultiple(
      documents.map((doc, i) => ({
        content: doc,
        hint: baseHint ? `${baseHint}_${i + 1}` : undefined
      })),
      {
        autoOrganize: true,
        trackRelationships: true
      }
    );
    return results.map(r => r.path);
  } catch (error) {
    console.error('Intelligent multi-save failed:', error);
    // Fall back to original auto-save
    return originalAutoSaveMultiple(content, baseHint);
  }
}

/**
 * Split content into multiple documents
 */
function splitIntoDocuments(content: string): string[] {
  // Check for document type
  const docType = classifyDocument(content);
  
  // For code files, don't split
  if (docType && isCodeDocType(docType)) {
    return [content];
  }
  
  // Look for clear document boundaries
  const h1Matches = content.match(/^# (?:Statement of Work|SOW|Requirements|Technical Specification|Architecture|TODO|Project Plan|Design Document|User Stories)/gm);
  if (h1Matches && h1Matches.length > 1) {
    const sections = content.split(/^(?=# (?:Statement of Work|SOW|Requirements|Technical Specification|Architecture|TODO|Project Plan|Design Document|User Stories))/m);
    return sections.filter(s => s.trim());
  }
  
  // Check for explicit separators
  const separatorPattern = /^---\s*Document\s*\d+\s*---$/m;
  if (separatorPattern.test(content)) {
    return content.split(separatorPattern).filter(s => s.trim());
  }
  
  // Default: single document
  return [content];
}

/**
 * Check if document type is code
 */
function isCodeDocType(docType: DocumentType): boolean {
  const codeTypes = [
    DocumentType.TYPESCRIPT, DocumentType.JAVASCRIPT, DocumentType.HTML,
    DocumentType.CSS, DocumentType.SCSS, DocumentType.SASS, DocumentType.LESS,
    DocumentType.SQL, DocumentType.SHELL_SCRIPT, DocumentType.PYTHON,
    DocumentType.RUBY, DocumentType.GO, DocumentType.RUST, DocumentType.JAVA,
    DocumentType.CPP, DocumentType.C, DocumentType.CSHARP, DocumentType.PHP,
    DocumentType.SWIFT, DocumentType.KOTLIN
  ];
  return codeTypes.includes(docType);
}

export default IntelligentDocumentSaveService;