/**
 * Entity Extractor for Knowledge Graph
 *
 * Identifies and extracts code entities (functions, classes, modules, concepts)
 * from the codebase for knowledge graph construction.
 */

import { EventEmitter } from 'events';
import * as path from 'path';

export interface CodeEntity {
  id: string;
  type: EntityType;
  name: string;
  filePath: string;
  lineNumber: number;
  metadata: EntityMetadata;
  signature?: string;
  documentation?: string;
  complexity?: ComplexityMetrics;
  dependencies: string[];
  exports?: string[];
  imports?: string[];
}

export type EntityType =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'module'
  | 'component'
  | 'service'
  | 'constant'
  | 'enum'
  | 'namespace'
  | 'concept';

export interface EntityMetadata {
  visibility: 'public' | 'private' | 'protected' | 'internal';
  isAbstract?: boolean;
  isStatic?: boolean;
  isAsync?: boolean;
  isExported?: boolean;
  isDefault?: boolean;
  decorators?: string[];
  annotations?: string[];
  tags?: string[];
  version?: string;
  author?: string;
  lastModified?: Date;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  parameters: number;
  returns: number;
  nesting: number;
  dependencies: number;
}

export interface ExtractionContext {
  projectRoot: string;
  language: ProgrammingLanguage;
  framework?: string;
  includePatterns: string[];
  excludePatterns: string[];
  maxDepth: number;
  extractConcepts: boolean;
  extractRelationships: boolean;
}

export type ProgrammingLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'ruby'
  | 'php';

export interface ConceptEntity extends CodeEntity {
  type: 'concept';
  conceptType: ConceptType;
  domain: string;
  relatedEntities: string[];
  businessRules: BusinessRule[];
  invariants: string[];
}

export type ConceptType =
  | 'domain-entity'
  | 'value-object'
  | 'aggregate'
  | 'service'
  | 'repository'
  | 'factory'
  | 'event'
  | 'command'
  | 'query';

export interface BusinessRule {
  id: string;
  description: string;
  implementation?: string;
  validation?: string;
  priority: number;
}

export interface ConceptEntity {
  id: string;
  name: string;
  type: 'domain' | 'service' | 'utility';
  domain: string;
  relatedEntities: string[];
  businessRules: string[];
  invariants: string[];
}

export interface ExtractionResult {
  entities: Map<string, CodeEntity>;
  concepts: Map<string, ConceptEntity>;
  statistics: ExtractionStatistics;
  errors: ExtractionError[];
}

export interface ExtractionStatistics {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  totalEntities: number;
  entitiesByType: Map<EntityType, number>;
  extractionTime: number;
  averageComplexity: number;
}

export interface ExtractionError {
  file: string;
  error: string;
  line?: number;
  severity: 'warning' | 'error';
}

export interface EntityPattern {
  type: EntityType;
  pattern: RegExp;
  extractor: (match: RegExpMatchArray, context: FileContext) => CodeEntity | null;
}

export interface FileContext {
  filePath: string;
  content: string;
  language: ProgrammingLanguage;
  imports: ImportStatement[];
  exports: ExportStatement[];
}

export interface ImportStatement {
  module: string;
  imports: string[];
  isDefault?: boolean;
  isNamespace?: boolean;
  alias?: string;
}

export interface ExportStatement {
  name: string;
  isDefault?: boolean;
  isReExport?: boolean;
  source?: string;
}

export class EntityExtractor extends EventEmitter {
  private context: ExtractionContext;
  private patterns: Map<ProgrammingLanguage, EntityPattern[]>;
  private result: ExtractionResult;
  private conceptExtractor: ConceptExtractor;

  constructor(context: ExtractionContext) {
    super();

    this.context = context;
    this.patterns = this.initializePatterns();
    this.conceptExtractor = new ConceptExtractor();
    this.result = {
      entities: new Map(),
      concepts: new Map(),
      statistics: this.initializeStatistics(),
      errors: [],
    };
  }

  // ========== Main Extraction Methods ==========

  async extractFromFile(filePath: string, content: string): Promise<CodeEntity[]> {
    const startTime = Date.now();
    const entities: CodeEntity[] = [];

    try {
      // Determine language
      const language = this.detectLanguage(filePath);
      if (!language) {
        this.result.statistics.skippedFiles++;
        console.log(`Skipped file due to unknown language: ${filePath}`);
        return entities;
      }

      console.log(`Extracting entities from ${filePath} (language: ${language})`);

      // Create file context
      const fileContext = await this.createFileContext(filePath, content, language);

      // Extract entities based on language
      const extractedEntities = await this.extractEntities(fileContext);
      entities.push(...extractedEntities);

      console.log(`Extracted ${extractedEntities.length} entities from ${filePath}`);
      console.log(`Total entities to return: ${entities.length}`);
      console.log(
        `Entities array:`,
        entities.map((e) => `${e.name} (${e.type})`),
      );

      // Extract concepts if enabled
      if (this.context.extractConcepts) {
        const concepts = await this.extractConcepts(fileContext, extractedEntities);
        for (const concept of concepts) {
          this.result.concepts.set(concept.id, concept);
        }
      }

      // Store entities
      for (const entity of entities) {
        this.result.entities.set(entity.id, entity);
      }

      // Update statistics
      this.result.statistics.processedFiles++;
      this.result.statistics.totalEntities += entities.length;

      // Emit progress
      this.emit('fileProcessed', {
        filePath,
        entitiesCount: entities.length,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      console.log(`Error in extractFromFile:`, error);
      this.result.errors.push({
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
        severity: 'error',
      });

      this.emit('extractionError', { filePath, error });
    }

    console.log(`Final return: ${entities.length} entities`);
    return entities;
  }

  private async extractEntities(context: FileContext): Promise<CodeEntity[]> {
    const entities: CodeEntity[] = [];
    const patterns = this.patterns.get(context.language) || [];

    console.log(`Found ${patterns.length} patterns for language ${context.language}`);

    for (const pattern of patterns) {
      const matches = context.content.matchAll(pattern.pattern);
      let matchCount = 0;

      for (const match of matches) {
        matchCount++;
        console.log(`Found match for ${pattern.type}: ${match[1]}`);

        const entity = pattern.extractor(match, context);
        if (entity) {
          console.log(`Successfully extracted entity: ${entity.name} (${entity.type})`);

          // Calculate complexity if applicable
          if (this.isComplexEntity(entity)) {
            entity.complexity = this.calculateComplexity(entity, context);
          }

          // Extract dependencies
          entity.dependencies = this.extractDependencies(entity, context);

          entities.push(entity);
          console.log(`Pushed entity to array. Current array length: ${entities.length}`);
        } else {
          console.log(`Extractor returned null for ${pattern.type}`);
        }
      }

      if (matchCount === 0) {
        console.log(`No matches found for pattern type: ${pattern.type}`);
      }
    }

    console.log(`extractEntities returning ${entities.length} entities`);
    return entities;
  }

  private async extractConcepts(
    context: FileContext,
    entities: CodeEntity[],
  ): Promise<ConceptEntity[]> {
    return this.conceptExtractor.extract(context, entities);
  }

  // ========== Language-Specific Extractors ==========

  private initializePatterns(): Map<ProgrammingLanguage, EntityPattern[]> {
    const patterns = new Map<ProgrammingLanguage, EntityPattern[]>();

    // TypeScript/JavaScript patterns
    patterns.set('typescript', this.getTypeScriptPatterns());
    patterns.set('javascript', this.getJavaScriptPatterns());

    // Python patterns
    patterns.set('python', this.getPythonPatterns());

    // Add more languages as needed

    return patterns;
  }

  private getTypeScriptPatterns(): EntityPattern[] {
    return [
      // Class pattern
      {
        type: 'class',
        pattern:
          /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([^\s{]+))?(?:\s+implements\s+([^\s{]+))?\s*{/gm,
        extractor: (match, context) => this.extractTypeScriptClass(match, context),
      },
      // Interface pattern
      {
        type: 'interface',
        pattern: /(?:export\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([^\s{]+))?\s*{/gm,
        extractor: (match, context) => this.extractTypeScriptInterface(match, context),
      },
      // Function pattern
      {
        type: 'function',
        pattern:
          /(?:export\s+)?(?:async\s+)?function\s+(\w+)(?:<[^>]+>)?\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*{/gm,
        extractor: (match, context) => this.extractTypeScriptFunction(match, context),
      },
      // Arrow function pattern
      {
        type: 'function',
        pattern:
          /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)(?:\s*:\s*[^=]+)?\s*=>/gm,
        extractor: (match, context) => this.extractTypeScriptArrowFunction(match, context),
      },
      // Type alias pattern
      {
        type: 'type',
        pattern: /(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*([^;]+);/gm,
        extractor: (match, context) => this.extractTypeScriptType(match, context),
      },
      // Enum pattern
      {
        type: 'enum',
        pattern: /(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*{/gm,
        extractor: (match, context) => this.extractTypeScriptEnum(match, context),
      },
      // React component pattern
      {
        type: 'component',
        pattern:
          /(?:export\s+)?(?:const|function)\s+(\w+)(?:<[^>]+>)?\s*(?::\s*(?:React\.)?FC(?:<[^>]+>)?)?\s*=?\s*(?:\([^)]*\))?\s*(?:=>)?\s*(?:{[^}]*return\s*\(?\s*<)/gm,
        extractor: (match, context) => this.extractReactComponent(match, context),
      },
    ];
  }

  private getJavaScriptPatterns(): EntityPattern[] {
    // Similar to TypeScript but without type annotations
    return [
      // Class pattern
      {
        type: 'class',
        pattern: /(?:export\s+)?(?:default\s+)?class\s+(\w+)(?:\s+extends\s+([^\s{]+))?\s*{/gm,
        extractor: (match, context) => this.extractJavaScriptClass(match, context),
      },
      // Function pattern
      {
        type: 'function',
        pattern: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{/gm,
        extractor: (match, context) => this.extractJavaScriptFunction(match, context),
      },
      // Arrow function pattern
      {
        type: 'function',
        pattern: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/gm,
        extractor: (match, context) => this.extractJavaScriptArrowFunction(match, context),
      },
    ];
  }

  private getPythonPatterns(): EntityPattern[] {
    return [
      // Class pattern
      {
        type: 'class',
        pattern: /class\s+(\w+)(?:\([^)]*\))?\s*:/gm,
        extractor: (match, context) => this.extractPythonClass(match, context),
      },
      // Function pattern
      {
        type: 'function',
        pattern: /(?:async\s+)?def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?\s*:/gm,
        extractor: (match, context) => this.extractPythonFunction(match, context),
      },
    ];
  }

  // ========== TypeScript Extractors ==========

  private extractTypeScriptClass(match: RegExpMatchArray, context: FileContext): CodeEntity | null {
    const [fullMatch, className, extendsClass, implementsInterface] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'class', className),
      type: 'class',
      name: className,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: this.detectVisibility(fullMatch),
        isAbstract: fullMatch.includes('abstract'),
        isExported: fullMatch.includes('export'),
        isDefault: fullMatch.includes('export default'),
      },
      signature: fullMatch.split('{')[0].trim(),
      dependencies: this.extractClassDependencies(fullMatch, extendsClass, implementsInterface),
      imports: context.imports.map((i) => i.module),
    };
  }

  private extractTypeScriptInterface(
    match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, interfaceName, extendsInterface] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'interface', interfaceName),
      type: 'interface',
      name: interfaceName,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: 'public',
        isExported: fullMatch.includes('export'),
      },
      signature: fullMatch.split('{')[0].trim(),
      dependencies: extendsInterface ? [extendsInterface] : [],
    };
  }

  private extractTypeScriptFunction(
    match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, functionName] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'function', functionName),
      type: 'function',
      name: functionName,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: this.detectVisibility(fullMatch),
        isAsync: fullMatch.includes('async'),
        isExported: fullMatch.includes('export'),
      },
      signature: fullMatch.split('{')[0].trim(),
      dependencies: this.extractFunctionDependencies(fullMatch, context),
    };
  }

  private extractTypeScriptArrowFunction(
    match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, functionName] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'function', functionName),
      type: 'function',
      name: functionName,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: this.detectVisibility(fullMatch),
        isAsync: fullMatch.includes('async'),
        isExported: fullMatch.includes('export'),
      },
      signature: fullMatch,
      dependencies: this.extractFunctionDependencies(fullMatch, context),
    };
  }

  private extractTypeScriptType(match: RegExpMatchArray, context: FileContext): CodeEntity | null {
    const [fullMatch, typeName, typeDefinition] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'type', typeName),
      type: 'type',
      name: typeName,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: 'public',
        isExported: fullMatch.includes('export'),
      },
      signature: fullMatch,
      dependencies: this.extractTypeDependencies(typeDefinition),
    };
  }

  private extractTypeScriptEnum(match: RegExpMatchArray, context: FileContext): CodeEntity | null {
    const [fullMatch, enumName] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'enum', enumName),
      type: 'enum',
      name: enumName,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: 'public',
        isExported: fullMatch.includes('export'),
      },
      signature: fullMatch.split('{')[0].trim(),
      dependencies: [],
    };
  }

  private extractReactComponent(match: RegExpMatchArray, context: FileContext): CodeEntity | null {
    const [fullMatch, componentName] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'component', componentName),
      type: 'component',
      name: componentName,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: 'public',
        isExported: fullMatch.includes('export'),
      },
      signature: fullMatch.split('{')[0].trim(),
      dependencies: this.extractComponentDependencies(fullMatch, context),
    };
  }

  // ========== JavaScript Extractors ==========

  private extractJavaScriptClass(match: RegExpMatchArray, context: FileContext): CodeEntity | null {
    const [fullMatch, className, extendsClass] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'class', className),
      type: 'class',
      name: className,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: 'public',
        isExported: fullMatch.includes('export'),
        isDefault: fullMatch.includes('default'),
      },
      signature: fullMatch.split('{')[0].trim(),
      dependencies: extendsClass ? [extendsClass] : [],
    };
  }

  private extractJavaScriptFunction(
    match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, functionName] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'function', functionName),
      type: 'function',
      name: functionName,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: 'public',
        isAsync: fullMatch.includes('async'),
        isExported: fullMatch.includes('export'),
      },
      signature: fullMatch.split('{')[0].trim(),
      dependencies: [],
    };
  }

  private extractJavaScriptArrowFunction(
    match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    return this.extractTypeScriptArrowFunction(match, context);
  }

  // ========== Python Extractors ==========

  private extractPythonClass(match: RegExpMatchArray, context: FileContext): CodeEntity | null {
    const [fullMatch, className] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'class', className),
      type: 'class',
      name: className,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: className.startsWith('_') ? 'private' : 'public',
      },
      signature: fullMatch,
      dependencies: this.extractPythonClassDependencies(fullMatch),
    };
  }

  private extractPythonFunction(match: RegExpMatchArray, context: FileContext): CodeEntity | null {
    const [fullMatch, functionName] = match;
    const lineNumber = this.getLineNumber(context.content, match.index || 0);

    return {
      id: this.generateEntityId(context.filePath, 'function', functionName),
      type: 'function',
      name: functionName,
      filePath: context.filePath,
      lineNumber,
      metadata: {
        visibility: functionName.startsWith('_') ? 'private' : 'public',
        isAsync: fullMatch.includes('async'),
      },
      signature: fullMatch,
      dependencies: [],
    };
  }

  // ========== Utility Methods ==========

  private detectLanguage(filePath: string): ProgrammingLanguage | null {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
      case '.mjs':
        return 'javascript';
      case '.py':
        return 'python';
      case '.java':
        return 'java';
      case '.cs':
        return 'csharp';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      case '.cpp':
      case '.cc':
      case '.cxx':
        return 'cpp';
      case '.rb':
        return 'ruby';
      case '.php':
        return 'php';
      default:
        return null;
    }
  }

  private async createFileContext(
    filePath: string,
    content: string,
    language: ProgrammingLanguage,
  ): Promise<FileContext> {
    return {
      filePath,
      content,
      language,
      imports: this.extractImports(content, language),
      exports: this.extractExports(content, language),
    };
  }

  private extractImports(content: string, language: ProgrammingLanguage): ImportStatement[] {
    const imports: ImportStatement[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // ES6 imports
      const importRegex =
        /import\s+(?:(\*\s+as\s+\w+)|({[^}]+})|(\w+))?\s*(?:,\s*({[^}]+}))?\s*from\s+['"]([^'"]+)['"]/gm;
      let match;

      while ((match = importRegex.exec(content))) {
        const [, namespace, namedImports, defaultImport, additionalNamed, module] = match;

        imports.push({
          module,
          imports: this.parseImportNames(
            namedImports || additionalNamed || defaultImport || namespace || '',
          ),
          isDefault: !!defaultImport,
          isNamespace: !!namespace,
        });
      }
    } else if (language === 'python') {
      // Python imports
      const importRegex = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/gm;
      let match;

      while ((match = importRegex.exec(content))) {
        const [, fromModule, importNames] = match;

        imports.push({
          module: fromModule || importNames.trim(),
          imports: this.parsePythonImports(importNames),
        });
      }
    }

    return imports;
  }

  private extractExports(content: string, language: ProgrammingLanguage): ExportStatement[] {
    const exports: ExportStatement[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // Named exports
      const namedExportRegex =
        /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/gm;
      let match;

      while ((match = namedExportRegex.exec(content))) {
        exports.push({
          name: match[1],
          isDefault: false,
        });
      }

      // Default export
      const defaultExportRegex = /export\s+default\s+(?:(?:class|function)\s+)?(\w+)/gm;
      match = defaultExportRegex.exec(content);
      if (match) {
        exports.push({
          name: match[1] || 'default',
          isDefault: true,
        });
      }
    }

    return exports;
  }

  private parseImportNames(importString: string): string[] {
    if (!importString) {return [];}

    // Remove braces and split by comma
    const cleaned = importString.replace(/[{}]/g, '').trim();
    if (!cleaned) {return [];}

    return cleaned.split(',').map((name) => {
      // Handle renamed imports (e.g., "foo as bar")
      const parts = name.trim().split(/\s+as\s+/);
      return parts[parts.length - 1];
    });
  }

  private parsePythonImports(importString: string): string[] {
    return importString.split(',').map((s) => {
      // Handle renamed imports (e.g., "foo as bar")
      const parts = s.trim().split(/\s+as\s+/);
      return parts[parts.length - 1];
    });
  }

  private extractClassDependencies(
    classDefinition: string,
    extendsClass?: string,
    implementsInterface?: string,
  ): string[] {
    const deps: string[] = [];

    if (extendsClass) {
      deps.push(extendsClass);
    }

    if (implementsInterface) {
      // Handle multiple interfaces
      deps.push(...implementsInterface.split(',').map((i) => i.trim()));
    }

    return deps;
  }

  private extractFunctionDependencies(functionDefinition: string, context: FileContext): string[] {
    const deps: string[] = [];

    // Extract parameter types
    const paramRegex = /:\s*([A-Z]\w+)(?:<[^>]+>)?/g;
    let match;

    while ((match = paramRegex.exec(functionDefinition))) {
      if (!this.isBuiltinType(match[1])) {
        deps.push(match[1]);
      }
    }

    return [...new Set(deps)];
  }

  private extractTypeDependencies(typeDefinition: string): string[] {
    const deps: string[] = [];

    // Extract referenced types
    const typeRegex = /\b([A-Z]\w+)(?:<[^>]+>)?/g;
    let match;

    while ((match = typeRegex.exec(typeDefinition))) {
      if (!this.isBuiltinType(match[1])) {
        deps.push(match[1]);
      }
    }

    return [...new Set(deps)];
  }

  private extractComponentDependencies(
    componentDefinition: string,
    context: FileContext,
  ): string[] {
    const deps: string[] = [];

    // Extract prop types
    const propsRegex = /(?:Props|props):\s*({[^}]+}|\w+)/;
    const match = propsRegex.exec(componentDefinition);

    if (match && !match[1].startsWith('{')) {
      deps.push(match[1]);
    }

    // Add React as dependency
    deps.push('React');

    return deps;
  }

  private extractPythonClassDependencies(classDefinition: string): string[] {
    const deps: string[] = [];

    // Extract base classes
    const baseRegex = /class\s+\w+\(([^)]+)\)/;
    const match = baseRegex.exec(classDefinition);

    if (match) {
      deps.push(...match[1].split(',').map((s) => s.trim()));
    }

    return deps;
  }

  private isBuiltinType(typeName: string): boolean {
    const builtinTypes = new Set([
      'string',
      'number',
      'boolean',
      'any',
      'void',
      'never',
      'unknown',
      'null',
      'undefined',
      'object',
      'symbol',
      'bigint',
      'String',
      'Number',
      'Boolean',
      'Object',
      'Array',
      'Function',
      'Date',
      'RegExp',
      'Error',
      'Promise',
      'Map',
      'Set',
      'WeakMap',
      'WeakSet',
    ]);

    return builtinTypes.has(typeName);
  }

  private detectVisibility(definition: string): 'public' | 'private' | 'protected' | 'internal' {
    if (definition.includes('private')) {return 'private';}
    if (definition.includes('protected')) {return 'protected';}
    if (definition.includes('internal')) {return 'internal';}
    return 'public';
  }

  private isComplexEntity(entity: CodeEntity): boolean {
    return entity.type === 'function' || entity.type === 'class' || entity.type === 'component';
  }

  private calculateComplexity(entity: CodeEntity, context: FileContext): ComplexityMetrics {
    // Simplified complexity calculation
    // In production, would use proper AST analysis

    const entityContent = this.extractEntityContent(entity, context.content);

    return {
      cyclomaticComplexity: this.calculateCyclomaticComplexity(entityContent),
      cognitiveComplexity: this.calculateCognitiveComplexity(entityContent),
      linesOfCode: entityContent.split('\n').length,
      parameters: this.countParameters(entity.signature || ''),
      returns: this.countReturns(entityContent),
      nesting: this.calculateMaxNesting(entityContent),
      dependencies: entity.dependencies.length,
    };
  }

  private extractEntityContent(entity: CodeEntity, fileContent: string): string {
    // Extract the content of the entity from the file
    // This is simplified - in production would use proper parsing

    const lines = fileContent.split('\n');
    const startLine = entity.lineNumber - 1;

    let braceCount = 0;
    let inEntity = false;
    let endLine = startLine;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      if (!inEntity && line.includes('{')) {
        inEntity = true;
      }

      if (inEntity) {
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        if (braceCount === 0) {
          endLine = i;
          break;
        }
      }
    }

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private calculateCyclomaticComplexity(content: string): number {
    // Count decision points
    const decisionPoints = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\s*[^:]+:/g, // ternary operator
      /&&/g,
      /\|\|/g,
    ];

    let complexity = 1; // Base complexity

    for (const pattern of decisionPoints) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private calculateCognitiveComplexity(content: string): number {
    // Simplified cognitive complexity
    // Would need proper AST analysis for accurate calculation

    let complexity = 0;
    const lines = content.split('\n');
    let nestingLevel = 0;

    for (const line of lines) {
      // Track nesting
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;

      if (/\b(if|for|while|switch)\b/.test(line)) {
        complexity += 1 + nestingLevel;
      }

      nestingLevel += openBraces - closeBraces;
      nestingLevel = Math.max(0, nestingLevel);
    }

    return complexity;
  }

  private countParameters(signature: string): number {
    const paramMatch = signature.match(/\([^)]*\)/);
    if (!paramMatch) {return 0;}

    const params = paramMatch[0];
    if (params === '()') {return 0;}

    // Count commas + 1, but handle complex types
    let count = 1;
    let depth = 0;

    for (const char of params) {
      if (char === '<' || char === '(' || char === '{') {depth++;}
      else if (char === '>' || char === ')' || char === '}') {depth--;}
      else if (char === ',' && depth === 0) {count++;}
    }

    return count;
  }

  private countReturns(content: string): number {
    const returns = content.match(/\breturn\b/g);
    return returns ? returns.length : 0;
  }

  private calculateMaxNesting(content: string): number {
    let maxNesting = 0;
    let currentNesting = 0;

    for (const char of content) {
      if (char === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === '}') {
        currentNesting--;
      }
    }

    return maxNesting;
  }

  private getLineNumber(content: string, index: number): number {
    const substring = content.substring(0, index);
    return substring.split('\n').length;
  }

  private generateEntityId(filePath: string, type: string, name: string): string {
    const cleanPath = filePath.replace(/[^a-zA-Z0-9]/g, '_');
    return `${cleanPath}_${type}_${name}`;
  }

  private initializeStatistics(): ExtractionStatistics {
    return {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      totalEntities: 0,
      entitiesByType: new Map(),
      extractionTime: 0,
      averageComplexity: 0,
    };
  }

  // ========== Public API ==========

  async extractCodeEntities(filePath: string, content?: string): Promise<CodeEntity[]> {
    if (!content) {
      // In production, would read file content here
      throw new Error('File content reading not implemented in this context');
    }

    return this.extractFromFile(filePath, content);
  }

  async extractCodeEntitiesFromProject(
    projectPath: string,
    options?: Partial<ExtractionContext>,
  ): Promise<ExtractionResult> {
    // Merge with default context
    const context: ExtractionContext = {
      ...this.context,
      ...options,
      projectRoot: projectPath,
    };

    // Update context
    this.context = context;

    return this.extractFromProject(projectPath);
  }

  getResult(): ExtractionResult {
    // Calculate final statistics
    this.result.statistics.extractionTime = Date.now();

    // Count entities by type
    for (const entity of this.result.entities.values()) {
      const count = this.result.statistics.entitiesByType.get(entity.type) || 0;
      this.result.statistics.entitiesByType.set(entity.type, count + 1);
    }

    // Calculate average complexity
    let totalComplexity = 0;
    let complexEntityCount = 0;

    for (const entity of this.result.entities.values()) {
      if (entity.complexity) {
        totalComplexity += entity.complexity.cyclomaticComplexity;
        complexEntityCount++;
      }
    }

    if (complexEntityCount > 0) {
      this.result.statistics.averageComplexity = totalComplexity / complexEntityCount;
    }

    return this.result;
  }

  async extractFromProject(projectPath: string): Promise<ExtractionResult> {
    // This would recursively process all files in the project
    // Implementation depends on file system access

    this.emit('extractionStarted', { projectPath });

    // ... file traversal and extraction logic ...

    this.emit('extractionCompleted', this.result);

    return this.result;
  }

  // ========== Missing Utility Methods ==========

  private extractDependencies(entity: CodeEntity, context: FileContext): string[] {
    // Extract dependencies from the entity signature and body
    const deps = new Set<string>();

    // Add dependencies from imports that might be used
    for (const imp of context.imports) {
      if (entity.signature?.includes(imp.module) || entity.documentation?.includes(imp.module)) {
        deps.add(imp.module);
      }
    }

    // Add dependencies already found in entity
    if (entity.dependencies) {
      entity.dependencies.forEach((dep) => deps.add(dep));
    }

    return Array.from(deps);
  }

  private getLineNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    return beforeIndex.split('\n').length;
  }

  private generateEntityId(filePath: string, type: string, name: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `${normalizedPath}:${type}:${name}`;
  }
}

// ========== Concept Extractor ==========

class ConceptExtractor {
  extract(context: FileContext, entities: CodeEntity[]): ConceptEntity[] {
    const concepts: ConceptEntity[] = [];

    // Detect domain entities
    for (const entity of entities) {
      if (this.isDomainEntity(entity)) {
        concepts.push(this.createDomainConcept(entity));
      } else if (this.isValueObject(entity)) {
        concepts.push(this.createValueObjectConcept(entity));
      } else if (this.isService(entity)) {
        concepts.push(this.createServiceConcept(entity));
      }
    }

    return concepts;
  }

  private isDomainEntity(entity: CodeEntity): boolean {
    // Heuristics to detect domain entities
    return (
      entity.type === 'class' &&
      (entity.name.endsWith('Entity') ||
        entity.name.endsWith('Model') ||
        entity.name.endsWith('Aggregate'))
    );
  }

  private isValueObject(entity: CodeEntity): boolean {
    return (
      entity.type === 'class' &&
      (entity.name.endsWith('VO') ||
        entity.name.endsWith('ValueObject') ||
        entity.name.endsWith('Value'))
    );
  }

  private isService(entity: CodeEntity): boolean {
    return (
      entity.type === 'class' &&
      (entity.name.endsWith('Service') ||
        entity.name.endsWith('Manager') ||
        entity.name.endsWith('Handler'))
    );
  }

  private createDomainConcept(entity: CodeEntity): ConceptEntity {
    return {
      ...entity,
      type: 'concept',
      conceptType: 'domain-entity',
      domain: this.extractDomain(entity.name),
      relatedEntities: entity.dependencies,
      businessRules: [],
      invariants: [],
    };
  }

  private createValueObjectConcept(entity: CodeEntity): ConceptEntity {
    return {
      ...entity,
      type: 'concept',
      conceptType: 'value-object',
      domain: this.extractDomain(entity.name),
      relatedEntities: entity.dependencies,
      businessRules: [],
      invariants: [],
    };
  }

  private createServiceConcept(entity: CodeEntity): ConceptEntity {
    return {
      ...entity,
      type: 'concept',
      conceptType: 'service',
      domain: this.extractDomain(entity.name),
      relatedEntities: entity.dependencies,
      businessRules: [],
      invariants: [],
    };
  }

  private extractDomain(entityName: string): string {
    // Extract domain from entity name
    // E.g., "UserEntity" -> "User", "OrderService" -> "Order"

    const suffixes = [
      'Entity',
      'Model',
      'Aggregate',
      'VO',
      'ValueObject',
      'Value',
      'Service',
      'Manager',
      'Handler',
    ];

    for (const suffix of suffixes) {
      if (entityName.endsWith(suffix)) {
        return entityName.slice(0, -suffix.length);
      }
    }

    return entityName;
  }
}

export default EntityExtractor;
