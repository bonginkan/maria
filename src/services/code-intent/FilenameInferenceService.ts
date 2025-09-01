/**
 * Filename Inference Service
 * Intelligently infers appropriate filenames from user intent and code content
 */

import { BaseService } from '../internal-mode/core/BaseService';
import { ExplicitFilenameAnalyzer } from './analyzers/ExplicitFilenameAnalyzer.js';
import { ContextualAnalyzer } from './analyzers/ContextualAnalyzer.js';
import { SemanticAnalyzer } from './analyzers/SemanticAnalyzer.js';
import { ExtensionDetector } from './analyzers/ExtensionDetector.js';
import { filenameInferenceTelemetry } from './telemetry/FilenameInferenceTelemetry.js';
import {
  FilenameResult,
  FilenameCandidate,
  ProjectContext,
  InferenceConfig,
  FilenameInferenceOptions
} from './types/filename-inference.types.js';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Main service for intelligent filename inference
 */
export class FilenameInferenceService extends BaseService {
  id = "filename-inference-service";
  version = "1.0.0";

  private explicitAnalyzer: ExplicitFilenameAnalyzer;
  private contextualAnalyzer: ContextualAnalyzer;
  private semanticAnalyzer: SemanticAnalyzer;
  private extensionDetector: ExtensionDetector;
  private config: InferenceConfig;

  constructor(options?: FilenameInferenceOptions) {
    super({ name: 'FilenameInferenceService' });
    this.explicitAnalyzer = new ExplicitFilenameAnalyzer();
    this.contextualAnalyzer = new ContextualAnalyzer();
    this.semanticAnalyzer = new SemanticAnalyzer();
    this.extensionDetector = new ExtensionDetector();
    
    this.config = {
      priority: options?.priority || 'explicit',
      fallbackStrategy: options?.fallbackStrategy || 'timestamp',
      projectConventions: options?.projectConventions,
      confidenceThreshold: options?.confidenceThreshold || 0.7
    };
  }

  /**
   * Infer the best filename based on user input and generated code
   */
  async inferFilename(
    userInput: string,
    generatedCode: string,
    projectContext?: ProjectContext
  ): Promise<FilenameResult> {
    // Start telemetry timing
    const endTiming = filenameInferenceTelemetry.startInference(userInput, projectContext);
    const startTime = Date.now();
    
    try {
      const candidates: FilenameCandidate[] = [];

      // 1. Check for explicit filename specification
      const explicitStart = Date.now();
      const explicit = await this.explicitAnalyzer.analyze(userInput);
      filenameInferenceTelemetry.recordAnalyzerComplete('explicit', [explicit], Date.now() - explicitStart);
      
      if (explicit.confidence > 0.8) {
        const result = this.createResult(explicit, 'explicit');
        filenameInferenceTelemetry.recordInferenceComplete(result, Date.now() - startTime);
        return result;
      }
      candidates.push(explicit);

      // 2. Analyze context from user input
      const contextualStart = Date.now();
      const contextual = await this.contextualAnalyzer.analyze(userInput, projectContext);
      filenameInferenceTelemetry.recordAnalyzerComplete('contextual', [contextual], Date.now() - contextualStart);
      candidates.push(contextual);

      // 3. Analyze code semantics
      const semanticStart = Date.now();
      const semantic = await this.semanticAnalyzer.analyze(generatedCode, userInput);
      filenameInferenceTelemetry.recordAnalyzerComplete('semantic', [semantic], Date.now() - semanticStart);
      candidates.push(semantic);

      // 4. Select best candidate
      const bestCandidate = this.selectBestCandidate(candidates);
      
      // 5. Apply project conventions if available
      if (projectContext?.conventions) {
        bestCandidate.filename = this.applyConventions(
          bestCandidate.filename,
          projectContext.conventions
        );
      }

      // 6. Ensure unique filename
      const finalFilename = await this.ensureUniqueFilename(
        bestCandidate.filename,
        projectContext?.directory || process.cwd()
      );

      const result = this.createResult({
        ...bestCandidate,
        filename: finalFilename
      }, bestCandidate.source || 'combined');
      
      // Record completion telemetry
      filenameInferenceTelemetry.recordInferenceComplete(result, Date.now() - startTime);
      
      return result;
    } finally {
      endTiming();
    }
  }

  /**
   * Intelligently organize file into appropriate directory
   */
  async determineDirectory(
    filename: string,
    code: string,
    projectContext?: ProjectContext
  ): Promise<string> {
    // Detect file type from extension
    const ext = path.extname(filename).toLowerCase();
    const basename = path.basename(filename, ext);
    
    // Default directory structure
    const directoryMap: Record<string, string[]> = {
      'components': ['.tsx', '.jsx', '.vue'],
      'pages': ['page.tsx', 'page.jsx', '.html'],
      'styles': ['.css', '.scss', '.sass', '.less'],
      'utils': ['util.ts', 'util.js', 'helper.ts', 'helper.js'],
      'services': ['service.ts', 'service.js', 'api.ts', 'api.js'],
      'config': ['config.json', 'config.js', 'config.ts', '.env'],
      'tests': ['.test.ts', '.test.js', '.spec.ts', '.spec.js'],
      'docs': ['.md', '.txt', '.doc'],
      'scripts': ['.sh', '.py', '.rb'],
      'data': ['.json', '.csv', '.sql', '.xml']
    };

    // Check if project has custom directory structure
    if (projectContext?.directories) {
      for (const [dir, patterns] of Object.entries(projectContext.directories)) {
        if (patterns.some(pattern => filename.includes(pattern))) {
          return path.join(projectContext.root || '.', dir);
        }
      }
    }

    // Apply default directory mapping
    for (const [dir, extensions] of Object.entries(directoryMap)) {
      if (extensions.some(ext => filename.endsWith(ext))) {
        const targetDir = path.join(projectContext?.root || '.', 'src', dir);
        await this.ensureDirectoryExists(targetDir);
        return targetDir;
      }
    }

    // Analyze code content for better placement
    if (code.includes('export default') || code.includes('module.exports')) {
      if (code.includes('React') || code.includes('useState')) {
        return path.join(projectContext?.root || '.', 'src', 'components');
      }
      if (code.includes('express') || code.includes('router')) {
        return path.join(projectContext?.root || '.', 'src', 'routes');
      }
    }

    // Default to src directory
    return path.join(projectContext?.root || '.', 'src');
  }

  /**
   * Track relationships between files
   */
  async trackFileRelationship(
    newFile: string,
    relatedFiles: string[],
    relationship: 'imports' | 'exports' | 'tests' | 'styles' | 'documentation'
  ): Promise<void> {
    const relationshipFile = path.join(process.cwd(), '.maria', 'file-relationships.json');
    
    let relationships: Record<string, any> = {};
    try {
      const content = await fs.readFile(relationshipFile, 'utf-8');
      relationships = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    if (!relationships[newFile]) {
      relationships[newFile] = {
        created: new Date().toISOString(),
        relationships: {}
      };
    }

    relationships[newFile].relationships[relationship] = relatedFiles;
    relationships[newFile].lastModified = new Date().toISOString();

    // Ensure .maria directory exists
    await this.ensureDirectoryExists(path.dirname(relationshipFile));
    await fs.writeFile(relationshipFile, JSON.stringify(relationships, null, 2));
  }

  /**
   * Select the best candidate from multiple options
   */
  private selectBestCandidate(candidates: FilenameCandidate[]): FilenameCandidate {
    // Sort by confidence
    const sorted = candidates.sort((a, b) => b.confidence - a.confidence);
    
    // If top candidate has high confidence, use it
    if (sorted[0].confidence >= this.config.confidenceThreshold) {
      return sorted[0];
    }

    // Otherwise, combine insights from multiple candidates
    const combined: FilenameCandidate = {
      filename: sorted[0].filename,
      extension: sorted[0].extension,
      confidence: sorted[0].confidence,
      reasoning: 'Combined from multiple sources',
      source: 'combined',
      alternatives: []
    };

    // Merge alternatives from all candidates
    for (const candidate of sorted.slice(1, 3)) {
      if (candidate.alternatives) {
        combined.alternatives!.push(...candidate.alternatives);
      }
    }

    return combined;
  }

  /**
   * Apply project naming conventions
   */
  private applyConventions(filename: string, conventions: any): string {
    const ext = path.extname(filename);
    let basename = path.basename(filename, ext);

    // Apply naming convention
    switch (conventions.fileNaming) {
      case 'kebab-case':
        basename = this.toKebabCase(basename);
        break;
      case 'camelCase':
        basename = this.toCamelCase(basename);
        break;
      case 'PascalCase':
        basename = this.toPascalCase(basename);
        break;
    }

    return basename + ext;
  }

  /**
   * Ensure filename is unique in target directory
   */
  private async ensureUniqueFilename(filename: string, directory: string): Promise<string> {
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    let finalName = filename;
    let counter = 1;

    while (await this.fileExists(path.join(directory, finalName))) {
      finalName = `${basename}_${counter}${ext}`;
      counter++;
    }

    return finalName;
  }

  /**
   * Check if file exists
   */
  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // Directory already exists
    }
  }

  /**
   * Create result object
   */
  private createResult(candidate: FilenameCandidate, source: string): FilenameResult {
    return {
      filename: candidate.filename,
      extension: candidate.extension,
      confidence: candidate.confidence,
      reasoning: candidate.reasoning,
      source,
      alternatives: candidate.alternatives || [],
      directory: candidate.directory
    };
  }

  // String conversion utilities
  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[-_\s](.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, (_, char) => char.toLowerCase());
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s](.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, (_, char) => char.toUpperCase());
  }

  /**
   * Learn from user corrections
   */
  async learnFromCorrection(
    originalFilename: string,
    correctedFilename: string,
    context: string
  ): Promise<void> {
    const learningFile = path.join(process.cwd(), '.maria', 'filename-learning.json');
    
    let learnings: any[] = [];
    try {
      const content = await fs.readFile(learningFile, 'utf-8');
      learnings = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    learnings.push({
      timestamp: new Date().toISOString(),
      original: originalFilename,
      corrected: correctedFilename,
      context,
      pattern: this.extractPattern(originalFilename, correctedFilename)
    });

    // Keep only last 100 learnings
    if (learnings.length > 100) {
      learnings = learnings.slice(-100);
    }

    await this.ensureDirectoryExists(path.dirname(learningFile));
    await fs.writeFile(learningFile, JSON.stringify(learnings, null, 2));
  }

  /**
   * Extract learning pattern from correction
   */
  private extractPattern(original: string, corrected: string): string {
    const origExt = path.extname(original);
    const corrExt = path.extname(corrected);
    
    if (origExt !== corrExt) {
      return `extension_change:${origExt}->${corrExt}`;
    }

    const origBase = path.basename(original, origExt);
    const corrBase = path.basename(corrected, corrExt);
    
    if (origBase !== corrBase) {
      return `naming_change:${this.detectNamingPattern(origBase, corrBase)}`;
    }

    return 'unknown';
  }

  /**
   * Detect naming pattern change
   */
  private detectNamingPattern(original: string, corrected: string): string {
    if (original.includes('-') && !corrected.includes('-')) {
      return 'kebab_to_camel';
    }
    if (!original.includes('-') && corrected.includes('-')) {
      return 'camel_to_kebab';
    }
    if (original[0].toLowerCase() === original[0] && corrected[0].toUpperCase() === corrected[0]) {
      return 'to_pascal';
    }
    return 'custom';
  }
}

export default FilenameInferenceService;