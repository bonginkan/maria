/**
 * Entity Extractor for Knowledge Graph
 *
 * Identifies and extracts code entities (functions, classes, modules, _concepts)
 * from the codebase for knowledge graph construction.
 */

import { EventEmitter } from "node:events";
import * as path from "path";

export interface CodeEntity {
  id: string;
  type: EntityType;
  name: string;
  filePath: string;
  _lineNumber: number;
  metadata: EntityMetadata;
  signature?: string;
  documentation?: string;
  complexity?: ComplexityMetrics;
  dependencies: string[];
  exports?: string[];
  imports?: string[];
}

export type EntityType =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "module"
  | "component"
  | "service"
  | "constant"
  | "enum"
  | "namespace"
  | "concept";

export interface EntityMetadata {
  visibility: "public" | "private" | "protected" | "internal";
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
  _returns: number;
  nesting: number;
  dependencies: number;
}

export interface ExtractionContext {
  projectRoot: string;
  _language: ProgrammingLanguage;
  framework?: string;
  includePatterns: string[];
  excludePatterns: string[];
  maxDepth: number;
  extractConcepts: boolean;
  extractRelationships: boolean;
}

export type ProgrammingLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "java"
  | "csharp"
  | "go"
  | "rust"
  | "cpp"
  | "ruby"
  | "php";

export interface ConceptEntity extends CodeEntity {
  type: "concept";
  conceptType: ConceptType;
  domain: string;
  relatedEntities: string[];
  businessRules: BusinessRule[];
  invariants: string[];
}

export type ConceptType =
  | "domain-_entity"
  | "value-object"
  | "aggregate"
  | "service"
  | "repository"
  | "factory"
  | "event"
  | "command"
  | "query";

export interface BusinessRule {
  id: string;
  description: string;
  implementation?: string;
  validation?: string;
  priority: number;
}

export interface DomainConceptEntity {
  id: string;
  name: string;
  type: "domain" | "service" | "utility";
  domain: string;
  relatedEntities: string[];
  businessRules: string[];
  invariants: string[];
}

export interface ExtractionResult {
  entities: Map<string, CodeEntity>;
  _concepts: Map<string, DomainConceptEntity>;
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
  _error: string;
  _line?: number;
  severity: "warning" | "_error";
}

export interface EntityPattern {
  type: EntityType;
  pattern: RegExp;
  extractor: (
    _match: RegExpMatchArray,
    context: FileContext,
  ) => CodeEntity | null;
}

export interface FileContext {
  filePath: string;
  content: string;
  _language: ProgrammingLanguage;
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
  private _patterns: Map<ProgrammingLanguage, EntityPattern[]>;
  private result: ExtractionResult;
  private conceptExtractor: ConceptExtractor;

  constructor(_context: ExtractionContext) {
    super();

    this._context = _context;
    this.patterns = this.initializePatterns();
    this.conceptExtractor = new ConceptExtractor();
    this.result = {
      entities: new Map(),
      _concepts: new Map(),
      statistics: this.initializeStatistics(),
      errors: [],
    };
  }

  // ========== Main Extraction Methods ==========

  async extractFromFile(
    _filePath: string,
    content: string,
  ): Promise<CodeEntity[]> {
    const _startTime = Date.now();
    const entities: CodeEntity[] = [];

    try {
      // Determine _language
      const _language = this.detectLanguage(_filePath);
      if (!_language) {
        this.result.statistics.skippedFiles++;
        console.log(`Skipped file due to unknown _language: ${_filePath}`);
        return entities;
      }

      console.log(
        `Extracting entities from ${_filePath} (_language: ${_language})`,
      );

      // Create file context
      const _fileContext = await this.createFileContext(
        _filePath,
        content,
        _language,
      );

      // Extract entities based on _language
      const _extractedEntities = await this.extractEntities(_fileContext);
      entities.push(..._extractedEntities);

      console.log(
        `Extracted ${_extractedEntities.length} entities from ${_filePath}`,
      );
      console.log(`Total entities to return: ${entities.length}`);
      console.log(
        `Entities array:`,
        entities.map((e) => `${e.name} (${e.type})`),
      );

      // Extract _concepts if enabled
      if (this.context.extractConcepts) {
        const _concepts = await this.extractConcepts(
          _fileContext,
          _extractedEntities,
        );
        for (const concept of _concepts) {
          this.result._concepts.set(concept.id, concept);
        }
      }

      // Store entities
      for (const _entity of entities) {
        this.result.entities.set(_entity.id, _entity);
      }

      // Update statistics
      this.result.statistics.processedFiles++;
      this.result.statistics.totalEntities += entities.length;

      // Emit progress
      this.emit("fileProcessed", {
        _filePath,
        entitiesCount: entities.length,
        duration: Date.now() - _startTime,
      });
    } catch (_error) {
      console.log(`Error in extractFromFile:`, _error);
      this.result.errors.push({
        file: _filePath,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: "_error",
      });

      this.emit("extractionError", { _filePath, _error });
    }

    console.log(`Final return: ${entities.length} entities`);
    return entities;
  }

  private async extractEntities(context: FileContext): Promise<CodeEntity[]> {
    const entities: CodeEntity[] = [];
    const _patterns = this._patterns.get(context.language) || [];

    console.log(
      `Found ${_patterns.length} _patterns for _language ${context.language}`,
    );

    for (const pattern of _patterns) {
      const _matches = context.content.matchAll(pattern.pattern);
      let matchCount = 0;

      for (const _match of _matches) {
        matchCount++;
        console.log(`Found _match for ${pattern.type}: ${_match[1]}`);

        const _entity = pattern.extractor(_match, context);
        if (_entity) {
          console.log(
            `Successfully extracted _entity: ${_entity.name} (${_entity.type})`,
          );

          // Calculate complexity if applicable
          if (this.isComplexEntity(_entity)) {
            entity.complexity = this.calculateComplexity(_entity, context);
          }

          // Extract dependencies
          entity.dependencies = this.extractDependencies(_entity, context);

          entities.push(_entity);
          console.log(
            `Pushed _entity to array. Current array length: ${entities.length}`,
          );
        } else {
          console.log(`Extractor returned null for ${pattern.type}`);
        }
      }

      if (matchCount === 0) {
        console.log(`No _matches found for pattern type: ${pattern.type}`);
      }
    }

    console.log(`extractEntities returning ${entities.length} entities`);
    return entities;
  }

  private async extractConcepts(
    _context: FileContext,
    entities: CodeEntity[],
  ): Promise<DomainConceptEntity[]> {
    return this.conceptExtractor.extract(_context, entities);
  }

  // ========== Language-Specific Extractors ==========

  private initializePatterns(): Map<ProgrammingLanguage, EntityPattern[]> {
    const _patterns = new Map<ProgrammingLanguage, EntityPattern[]>();

    // TypeScript/JavaScript _patterns
    _patterns.set("typescript", this.getTypeScriptPatterns());
    _patterns.set("javascript", this.getJavaScriptPatterns());

    // Python _patterns
    patterns.set("python", this.getPythonPatterns());

    // Add more languages as needed

    return _patterns;
  }

  private getTypeScriptPatterns(): EntityPattern[] {
    return [
      // Class pattern
      {
        type: "class",
        pattern:
          /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([^\s{]+))?(?:\s+implements\s+([^\s{]+))?\s*{/gm,
        extractor: (_match, context) =>
          this.extractTypeScriptClass(_match, context),
      },
      // Interface pattern
      {
        type: "interface",
        pattern:
          /(?:export\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([^\s{]+))?\s*{/gm,
        extractor: (_match, context) =>
          this.extractTypeScriptInterface(_match, context),
      },
      // Function pattern
      {
        type: "function",
        pattern:
          /(?:export\s+)?(?:async\s+)?function\s+(\w+)(?:<[^>]+>)?\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*{/gm,
        extractor: (_match, context) =>
          this.extractTypeScriptFunction(_match, context),
      },
      // Arrow function pattern
      {
        type: "function",
        pattern:
          /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)(?:\s*:\s*[^=]+)?\s*=>/gm,
        extractor: (_match, context) =>
          this.extractTypeScriptArrowFunction(_match, context),
      },
      // Type alias pattern
      {
        type: "type",
        pattern: /(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*([^;]+);/gm,
        extractor: (_match, context) =>
          this.extractTypeScriptType(_match, context),
      },
      // Enum pattern
      {
        type: "enum",
        pattern: /(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*{/gm,
        extractor: (_match, context) =>
          this.extractTypeScriptEnum(_match, context),
      },
      // React component pattern
      {
        type: "component",
        pattern:
          /(?:export\s+)?(?:const|function)\s+(\w+)(?:<[^>]+>)?\s*(?::\s*(?:React\.)?FC(?:<[^>]+>)?)?\s*=?\s*(?:\([^)]*\))?\s*(?:=>)?\s*(?:{[^}]*return\s*\(?\s*<)/gm,
        extractor: (_match, context) =>
          this.extractReactComponent(_match, context),
      },
    ];
  }

  private getJavaScriptPatterns(): EntityPattern[] {
    // Similar to TypeScript but without type annotations
    return [
      // Class pattern
      {
        type: "class",
        pattern:
          /(?:export\s+)?(?:default\s+)?class\s+(\w+)(?:\s+extends\s+([^\s{]+))?\s*{/gm,
        extractor: (_match, context) =>
          this.extractJavaScriptClass(_match, context),
      },
      // Function pattern
      {
        type: "function",
        pattern:
          /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{/gm,
        extractor: (_match, context) =>
          this.extractJavaScriptFunction(_match, context),
      },
      // Arrow function pattern
      {
        type: "function",
        pattern:
          /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/gm,
        extractor: (_match, context) =>
          this.extractJavaScriptArrowFunction(_match, context),
      },
    ];
  }

  private getPythonPatterns(): EntityPattern[] {
    return [
      // Class pattern
      {
        type: "class",
        pattern: /class\s+(\w+)(?:\([^)]*\))?\s*:/gm,
        extractor: (_match, context) =>
          this.extractPythonClass(_match, context),
      },
      // Function pattern
      {
        type: "function",
        pattern: /(?:async\s+)?def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?\s*:/gm,
        extractor: (_match, context) =>
          this.extractPythonFunction(_match, context),
      },
    ];
  }

  // ========== TypeScript Extractors ==========

  private extractTypeScriptClass(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, className, extendsClass, implementsInterface] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "class", className),
      type: "class",
      name: className,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: this.detectVisibility(fullMatch),
        isAbstract: fullMatch.includes("abstract"),
        isExported: fullMatch.includes("export"),
        isDefault: fullMatch.includes("export default"),
      },
      signature: fullMatch.split("{")[0].trim(),
      dependencies: this.extractClassDependencies(
        fullMatch,
        extendsClass,
        implementsInterface,
      ),
      imports: context.imports.map((i) => i.module),
    };
  }

  private extractTypeScriptInterface(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, interfaceName, extendsInterface] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "interface", interfaceName),
      type: "interface",
      name: interfaceName,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: "public",
        isExported: fullMatch.includes("export"),
      },
      signature: fullMatch.split("{")[0].trim(),
      dependencies: extendsInterface ? [extendsInterface] : [],
    };
  }

  private extractTypeScriptFunction(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, functionName] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "function", functionName),
      type: "function",
      name: functionName,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: this.detectVisibility(fullMatch),
        isAsync: fullMatch.includes("async"),
        isExported: fullMatch.includes("export"),
      },
      signature: fullMatch.split("{")[0].trim(),
      dependencies: this.extractFunctionDependencies(fullMatch, context),
    };
  }

  private extractTypeScriptArrowFunction(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, functionName] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "function", functionName),
      type: "function",
      name: functionName,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: this.detectVisibility(fullMatch),
        isAsync: fullMatch.includes("async"),
        isExported: fullMatch.includes("export"),
      },
      signature: fullMatch,
      dependencies: this.extractFunctionDependencies(fullMatch, context),
    };
  }

  private extractTypeScriptType(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, typeName, typeDefinition] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "type", typeName),
      type: "type",
      name: typeName,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: "public",
        isExported: fullMatch.includes("export"),
      },
      signature: fullMatch,
      dependencies: this.extractTypeDependencies(typeDefinition),
    };
  }

  private extractTypeScriptEnum(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, enumName] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "enum", enumName),
      type: "enum",
      name: enumName,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: "public",
        isExported: fullMatch.includes("export"),
      },
      signature: fullMatch.split("{")[0].trim(),
      dependencies: [],
    };
  }

  private extractReactComponent(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, componentName] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "component", componentName),
      type: "component",
      name: componentName,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: "public",
        isExported: fullMatch.includes("export"),
      },
      signature: fullMatch.split("{")[0].trim(),
      dependencies: this.extractComponentDependencies(fullMatch, context),
    };
  }

  // ========== JavaScript Extractors ==========

  private extractJavaScriptClass(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, className, extendsClass] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "class", className),
      type: "class",
      name: className,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: "public",
        isExported: fullMatch.includes("export"),
        isDefault: fullMatch.includes("default"),
      },
      signature: fullMatch.split("{")[0].trim(),
      dependencies: extendsClass ? [extendsClass] : [],
    };
  }

  private extractJavaScriptFunction(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, functionName] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "function", functionName),
      type: "function",
      name: functionName,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: "public",
        isAsync: fullMatch.includes("async"),
        isExported: fullMatch.includes("export"),
      },
      signature: fullMatch.split("{")[0].trim(),
      dependencies: [],
    };
  }

  private extractJavaScriptArrowFunction(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    return this.extractTypeScriptArrowFunction(_match, context);
  }

  // ========== Python Extractors ==========

  private extractPythonClass(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, className] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "class", className),
      type: "class",
      name: className,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: className.startsWith("_") ? "private" : "public",
      },
      signature: fullMatch,
      dependencies: this.extractPythonClassDependencies(fullMatch),
    };
  }

  private extractPythonFunction(
    _match: RegExpMatchArray,
    context: FileContext,
  ): CodeEntity | null {
    const [fullMatch, functionName] = _match;
    const _lineNumber = this.getLineNumber(context.content, _match.index || 0);

    return {
      id: this.generateEntityId(context._filePath, "function", functionName),
      type: "function",
      name: functionName,
      filePath: context.filePath,
      _lineNumber,
      metadata: {
        visibility: functionName.startsWith("_") ? "private" : "public",
        isAsync: fullMatch.includes("async"),
      },
      signature: fullMatch,
      dependencies: [],
    };
  }

  // ========== Utility Methods ==========

  private detectLanguage(_filePath: string): ProgrammingLanguage | null {
    const _ext = path.extname(_filePath).toLowerCase();

    switch (_ext) {
      case ".ts":
      case ".tsx":
        return "typescript";
      case ".js":
      case ".jsx":
      case ".mjs":
        return "javascript";
      case ".py":
        return "python";
      case ".java":
        return "java";
      case ".cs":
        return "csharp";
      case ".go":
        return "go";
      case ".rs":
        return "rust";
      case ".cpp":
      case ".cc":
      case ".cxx":
        return "cpp";
      case ".rb":
        return "ruby";
      case ".php":
        return "php";
      default:
        return null;
    }
  }

  private async createFileContext(
    _filePath: string,
    content: string,
    _language: ProgrammingLanguage,
  ): Promise<FileContext> {
    return {
      filePath: "",
      content,
      _language,
      imports: this.extractImports(content, _language),
      exports: this.extractExports(content, _language),
    };
  }

  private extractImports(
    _content: string,
    _language: ProgrammingLanguage,
  ): ImportStatement[] {
    const imports: ImportStatement[] = [];

    if (_language === "typescript" || _language === "javascript") {
      // ES6 imports
      const _importRegex =
        /import\s+(?:(\*\s+as\s+\w+)|({[^}]+})|(\w+))?\s*(?:,\s*({[^}]+}))?\s*from\s+['"]([^'"]+)['"]/gm;
      let _match;

      while ((_match = _importRegex.exec(_content))) {
        const [
          ,
          namespace,
          namedImports,
          defaultImport,
          additionalNamed,
          module,
        ] = _match;

        imports.push({
          module,
          imports: this.parseImportNames(
            namedImports || additionalNamed || defaultImport || namespace || "",
          ),
          isDefault: !!defaultImport,
          isNamespace: !!namespace,
        });
      }
    } else if (_language === "python") {
      // Python imports
      const _importRegex = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/gm;
      let _match;

      while ((_match = _importRegex.exec(_content))) {
        const [, fromModule, importNames] = _match;

        imports.push({
          module: fromModule || importNames.trim(),
          imports: this.parsePythonImports(importNames),
        });
      }
    }

    return imports;
  }

  private extractExports(
    _content: string,
    _language: ProgrammingLanguage,
  ): ExportStatement[] {
    const exports: ExportStatement[] = [];

    if (_language === "typescript" || _language === "javascript") {
      // Named exports
      const _namedExportRegex =
        /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/gm;
      let _match;

      while ((_match = _namedExportRegex.exec(_content))) {
        exports.push({
          name: _match[1],
          isDefault: false,
        });
      }

      // Default export
      const _defaultExportRegex =
        /export\s+default\s+(?:(?:class|function)\s+)?(\w+)/gm;
      _match = _defaultExportRegex.exec(_content);
      if (_match) {
        exports.push({
          name: _match[1] || "default",
          isDefault: true,
        });
      }
    }

    return exports;
  }

  private parseImportNames(importString: string): string[] {
    if (!importString) {
      return [];
    }

    // Remove braces and split by comma
    const _cleaned = importString.replace(/[{}]/g, "").trim();
    if (!_cleaned) {
      return [];
    }

    return _cleaned.split(",").map((name) => {
      // Handle renamed imports (e.g., "foo as bar")
      const _parts = name.trim().split(/\s+as\s+/);
      return _parts[_parts.length - 1];
    });
  }

  private parsePythonImports(importString: string): string[] {
    return importString.split(",").map((s) => {
      // Handle renamed imports (e.g., "foo as bar")
      const _parts = s.trim().split(/\s+as\s+/);
      return _parts[_parts.length - 1];
    });
  }

  private extractClassDependencies(
    _classDefinition: string,
    extendsClass?: string,
    implementsInterface?: string,
  ): string[] {
    const _deps: string[] = [];

    if (extendsClass) {
      deps.push(extendsClass);
    }

    if (implementsInterface) {
      // Handle multiple interfaces
      deps.push(...implementsInterface.split(",").map((i) => i.trim()));
    }

    return _deps;
  }

  private extractFunctionDependencies(
    _functionDefinition: string,
    _context: FileContext,
  ): string[] {
    const _deps: string[] = [];

    // Extract parameter types
    const _paramRegex = /:\s*([A-Z]\w+)(?:<[^>]+>)?/g;
    let _match;

    while ((_match = _paramRegex.exec(_functionDefinition))) {
      if (!this.isBuiltinType(_match[1])) {
        deps.push(_match[1]);
      }
    }

    return [...new Set(_deps)];
  }

  private extractTypeDependencies(typeDefinition: string): string[] {
    const _deps: string[] = [];

    // Extract referenced types
    const _typeRegex = /\b([A-Z]\w+)(?:<[^>]+>)?/g;
    let _match;

    while ((_match = _typeRegex.exec(typeDefinition))) {
      if (!this.isBuiltinType(_match[1])) {
        deps.push(_match[1]);
      }
    }

    return [...new Set(_deps)];
  }

  private extractComponentDependencies(
    componentDefinition: string,
    _context: FileContext,
  ): string[] {
    const _deps: string[] = [];

    // Extract prop types
    const _propsRegex = /(?:Props|props):\s*({[^}]+}|\w+)/;
    const _match = _propsRegex.exec(componentDefinition);

    if (_match && !_match[1].startsWith("{")) {
      deps.push(_match[1]);
    }

    // Add React as dependency
    deps.push("React");

    return _deps;
  }

  private extractPythonClassDependencies(classDefinition: string): string[] {
    const _deps: string[] = [];

    // Extract base classes
    const _baseRegex = /class\s+\w+\(([^)]+)\)/;
    const _match = _baseRegex.exec(classDefinition);

    if (_match) {
      deps.push(..._match[1].split(",").map((s) => s.trim()));
    }

    return _deps;
  }

  private isBuiltinType(typeName: string): boolean {
    const _builtinTypes = new Set([
      "string",
      "number",
      "boolean",
      "any",
      "void",
      "never",
      "unknown",
      "null",
      "undefined",
      "object",
      "symbol",
      "bigint",
      "String",
      "Number",
      "Boolean",
      "Object",
      "Array",
      "Function",
      "Date",
      "RegExp",
      "Error",
      "Promise",
      "Map",
      "Set",
      "WeakMap",
      "WeakSet",
    ]);

    return _builtinTypes.has(typeName);
  }

  private detectVisibility(
    definition: string,
  ): "public" | "private" | "protected" | "internal" {
    if (definition.includes("private")) {
      return "private";
    }
    if (definition.includes("protected")) {
      return "protected";
    }
    if (definition.includes("internal")) {
      return "internal";
    }
    return "public";
  }

  private isComplexEntity(_entity: CodeEntity): boolean {
    return (
      _entity.type === "function" ||
      _entity.type === "class" ||
      _entity.type === "component"
    );
  }

  private calculateComplexity(
    _entity: CodeEntity,
    context: FileContext,
  ): ComplexityMetrics {
    // Simplified complexity calculation
    // In production, would use proper AST analysis

    const _entityContent = this.extractEntityContent(_entity, context.content);

    return {
      cyclomaticComplexity: this.calculateCyclomaticComplexity(_entityContent),
      cognitiveComplexity: this.calculateCognitiveComplexity(_entityContent),
      linesOfCode: _entityContent.split("\n").length,
      parameters: this.countParameters(entity.signature || ""),
      _returns: this.countReturns(_entityContent),
      nesting: this.calculateMaxNesting(_entityContent),
      dependencies: entity.dependencies.length,
    };
  }

  private extractEntityContent(
    _entity: CodeEntity,
    fileContent: string,
  ): string {
    // Extract the content of the _entity from the file
    // This is simplified - in production would use proper parsing

    const _lines = fileContent.split("\n");
    const _startLine = _entity.lineNumber - 1;

    let braceCount = 0;
    let inEntity = false;
    let endLine = _startLine;

    for (let i = _startLine; i < _lines.length; i++) {
      const _line = _lines[i];

      if (!inEntity && _line.includes("{")) {
        inEntity = true;
      }

      if (inEntity) {
        braceCount += (_line._match(/{/g) || []).length;
        braceCount -= (_line._match(/}/g) || []).length;

        if (braceCount === 0) {
          endLine = i;
          break;
        }
      }
    }

    return _lines.slice(_startLine, endLine + 1).join("\n");
  }

  private calculateCyclomaticComplexity(content: string): number {
    // Count decision points
    const _decisionPoints = [
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

    for (const pattern of _decisionPoints) {
      const _matches = content._match(pattern);
      if (_matches) {
        complexity += _matches.length;
      }
    }

    return complexity;
  }

  private calculateCognitiveComplexity(content: string): number {
    // Simplified cognitive complexity
    // Would need proper AST analysis for accurate calculation

    let complexity = 0;
    const _lines = content.split("\n");
    let nestingLevel = 0;

    for (const _line of _lines) {
      // Track nesting
      const _openBraces = (_line._match(/{/g) || []).length;
      const _closeBraces = (_line._match(/}/g) || []).length;

      if (/\b(if|for|while|switch)\b/.test(_line)) {
        complexity += 1 + nestingLevel;
      }

      nestingLevel += _openBraces - _closeBraces;
      nestingLevel = Math.max(0, nestingLevel);
    }

    return complexity;
  }

  private countParameters(signature: string): number {
    const _paramMatch = signature._match(/\([^)]*\)/);
    if (!_paramMatch) {
      return 0;
    }

    const _params = _paramMatch[0];
    if (_params === "()") {
      return 0;
    }

    // Count commas + 1, but handle complex types
    let _count = 1;
    let depth = 0;

    for (const char of _params) {
      if (char === "<" || char === "(" || char === "{") {
        depth++;
      } else if (char === ">" || char === ")" || char === "}") {
        depth--;
      } else if (char === "," && depth === 0) {
        _count++;
      }
    }

    return _count;
  }

  private countReturns(content: string): number {
    const _returns = content._match(/\breturn\b/g);
    return _returns ? _returns.length : 0;
  }

  private calculateMaxNesting(content: string): number {
    let maxNesting = 0;
    let currentNesting = 0;

    for (const char of content) {
      if (char === "{") {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === "}") {
        currentNesting--;
      }
    }

    return maxNesting;
  }

  private getLineNumber(_content: string, index: number): number {
    const _substring = _content._substring(0, index);
    return _substring.split("\n").length;
  }

  private generateEntityId(
    _filePath: string,
    type: string,
    name: string,
  ): string {
    const _cleanPath = _filePath.replace(/[^a-zA-Z0-9]/g, "_");
    return `${_cleanPath}_${type}_${name}`;
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

  async extractCodeEntities(
    _filePath: string,
    content?: string,
  ): Promise<CodeEntity[]> {
    if (!content) {
      // In production, would read file content here
      throw new Error("File content reading not implemented in this context");
    }

    return this.extractFromFile(_filePath, content);
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
    for (const _entity of this.result.entities.values()) {
      const _count =
        this.result.statistics.entitiesByType.get(_entity.type) || 0;
      this.result.statistics.entitiesByType.set(_entity.type, _count + 1);
    }

    // Calculate average complexity
    let totalComplexity = 0;
    let complexEntityCount = 0;

    for (const _entity of this.result.entities.values()) {
      if (_entity.complexity) {
        totalComplexity += _entity.complexity.cyclomaticComplexity;
        complexEntityCount++;
      }
    }

    if (complexEntityCount > 0) {
      this.result.statistics.averageComplexity =
        totalComplexity / complexEntityCount;
    }

    return this.result;
  }

  async extractFromProject(projectPath: string): Promise<ExtractionResult> {
    // This would recursively process all files in the project
    // Implementation depends on file system access

    this.emit("extractionStarted", { projectPath });

    // ... file traversal and extraction logic ...

    this.emit("extractionCompleted", this.result);

    return this.result;
  }

  // ========== Missing Utility Methods ==========

  private extractDependencies(
    _entity: CodeEntity,
    context: FileContext,
  ): string[] {
    // Extract dependencies from the _entity signature and body
    const _deps = new Set<string>();

    // Add dependencies from imports that might be used
    for (const imp of context.imports) {
      if (
        _entity.signature?.includes(imp.module) ||
        _entity.documentation?.includes(imp.module)
      ) {
        deps.add(imp.module);
      }
    }

    // Add dependencies already found in _entity
    if (_entity.dependencies) {
      entity.dependencies.forEach((dep) => _deps.add(dep));
    }

    return Array.from(_deps);
  }

  private getLineNumber(_content: string, index: number): number {
    const _beforeIndex = _content.substring(0, index);
    return _beforeIndex.split("\n").length;
  }

  private generateEntityId(
    _filePath: string,
    type: string,
    name: string,
  ): string {
    const _normalizedPath = _filePath.replace(/\\/g, "/");
    return `${_normalizedPath}:${type}:${name}`;
  }
}

// ========== Concept Extractor ==========

class ConceptExtractor {
  extract(_context: FileContext, entities: CodeEntity[]): DomainConceptEntity[] {
    const _concepts: DomainConceptEntity[] = [];

    // Detect domain entities
    for (const _entity of entities) {
      if (this.isDomainEntity(_entity)) {
        concepts.push(this.createDomainConcept(_entity));
      } else if (this.isValueObject(_entity)) {
        concepts.push(this.createValueObjectConcept(_entity));
      } else if (this.isService(_entity)) {
        concepts.push(this.createServiceConcept(_entity));
      }
    }

    return _concepts;
  }

  private isDomainEntity(_entity: CodeEntity): boolean {
    // Heuristics to detect domain entities
    return (
      entity.type === "class" &&
      (_entity.name.endsWith("Entity") ||
        _entity.name.endsWith("Model") ||
        entity.name.endsWith("Aggregate"))
    );
  }

  private isValueObject(_entity: CodeEntity): boolean {
    return (
      entity.type === "class" &&
      (_entity.name.endsWith("VO") ||
        _entity.name.endsWith("ValueObject") ||
        entity.name.endsWith("Value"))
    );
  }

  private isService(_entity: CodeEntity): boolean {
    return (
      entity.type === "class" &&
      (_entity.name.endsWith("Service") ||
        _entity.name.endsWith("Manager") ||
        entity.name.endsWith("Handler"))
    );
  }

  private createDomainConcept(_entity: CodeEntity): DomainConceptEntity {
    return {
      ..._entity,
      type: "concept",
      conceptType: "domain-_entity",
      domain: this.extractDomain(_entity.name),
      relatedEntities: _entity.dependencies,
      businessRules: [],
      invariants: [],
    };
  }

  private createValueObjectConcept(_entity: CodeEntity): DomainConceptEntity {
    return {
      ..._entity,
      type: "concept",
      conceptType: "value-object",
      domain: this.extractDomain(_entity.name),
      relatedEntities: _entity.dependencies,
      businessRules: [],
      invariants: [],
    };
  }

  private createServiceConcept(_entity: CodeEntity): DomainConceptEntity {
    return {
      ..._entity,
      type: "concept",
      conceptType: "service",
      domain: this.extractDomain(_entity.name),
      relatedEntities: _entity.dependencies,
      businessRules: [],
      invariants: [],
    };
  }

  private extractDomain(entityName: string): string {
    // Extract domain from _entity name
    // E.g., "UserEntity" -> "User", "OrderService" -> "Order"

    const _suffixes = [
      "Entity",
      "Model",
      "Aggregate",
      "VO",
      "ValueObject",
      "Value",
      "Service",
      "Manager",
      "Handler",
    ];

    for (const suffix of _suffixes) {
      if (entityName.endsWith(suffix)) {
        return entityName.slice(0, -suffix.length);
      }
    }

    return entityName;
  }
}

export default EntityExtractor;
