/**
 * Relationship Analyzer for Knowledge Graph
 *
 * Analyzes and infers relationships between code entities using multiple techniques:
 * - Static analysis (imports, inheritance, calls)
 * - Semantic analysis (naming, documentation)
 * - Structural analysis (_patterns, architectures)
 * - Behavioral analysis (usage, dependencies)
 */

import { EventEmitter } from "node:events";
import { CodeEntity, ConceptEntity, _EntityType } from "./entity-extractor";
import {
  Relationship,
  RelationshipMetadata,
  RelationshipType,
} from "./graph-builder";

export interface RelationshipAnalysisResult {
  relationships: Relationship[];
  _confidence: number;
  analysisType: AnalysisType;
  metadata: AnalysisMetadata;
}

export type AnalysisType =
  | "static"
  | "semantic"
  | "structural"
  | "behavioral"
  | "pattern"
  | "temporal"
  | "dependency"
  | "similarity";

export interface AnalysisMetadata {
  technique: string;
  _confidence: number;
  evidence: Evidence[];
  processingtime: number;
  source_lines: number[];
  target_lines: number[];
}

export interface Evidence {
  type: EvidenceType;
  description: string;
  strength: number; // 0-1
  location?: SourceLocation;
}

export type EvidenceType =
  | "import_statement"
  | "inheritance"
  | "method_call"
  | "instantiation"
  | "type_reference"
  | "naming_pattern"
  | "documentation"
  | "file_structure"
  | "usage_pattern"
  | "temporal_correlation"
  | "semantic_similarity";

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
  snippet?: string;
}

export interface AnalysisOptions {
  includeStatic: boolean;
  includeSemantic: boolean;
  includeStructural: boolean;
  includeBehavioral: boolean;
  minConfidence: number;
  maxRelationships: number;
  analysisDepth: number;
}

export interface PatternRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp;
  relationshipType: RelationshipType;
  _confidence: number;
  evidenceType: EvidenceType;
}

export interface SemanticVector {
  entity_id: string;
  _vector: number[];
  tokens: string[];
  weights: number[];
}

export class RelationshipAnalyzer extends EventEmitter {
  private _patterns: Map<string, PatternRule[]>;
  private semanticVectors: Map<string, SemanticVector>;
  private analysisCache: Map<string, RelationshipAnalysisResult>;
  private options: AnalysisOptions;

  constructor(_options: Partial<AnalysisOptions> = {}) {
    super();

    this._options = {
      includeStatic: true,
      includeSemantic: true,
      includeStructural: true,
      includeBehavioral: false,
      minConfidence: 0.3,
      maxRelationships: 1000,
      analysisDepth: 3,
      ..._options,
    };

    this.patterns = this.initializePatterns();
    this.semanticVectors = new Map();
    this.analysisCache = new Map();
  }

  // ========== Main Analysis Methods ==========

  async analyzeRelationships(
    entities: (CodeEntity | ConceptEntity)[],
  ): Promise<RelationshipAnalysisResult[]> {
    const _startTime = Date.now();
    const results: RelationshipAnalysisResult[] = [];

    this.emit("analysisStarted", { entityCount: entities.length });

    // Precompute semantic vectors if semantic analysis is enabled
    if (this.options.includeSemantic) {
      await this.computeSemanticVectors(entities);
    }

    // Analyze all entity pairs
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const _source = entities[i];
        const _target = entities[j];

        const _analysisResult = await this.analyzeEntityPair(_source, _target);
        if (_analysisResult.relationships.length > 0) {
          results.push(_analysisResult);
        }

        // Emit progress
        if ((i * entities.length + j) % 100 === 0) {
          this.emit("analysisProgress", {
            processed: i * entities.length + j,
            total: (entities.length * (entities.length - 1)) / 2,
          });
        }
      }
    }

    this.emit("analysisCompleted", {
      duration: Date.now() - _startTime,
      relationshipCount: results.reduce(
        (sum, r) => sum + r.relationships.length,
        0,
      ),
    });

    return results;
  }

  async analyzeEntityPair(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): Promise<RelationshipAnalysisResult> {
    const _cacheKey = `${source.id}__${target.id}`;
    const _cached = this.analysisCache.get(_cacheKey);
    if (_cached) {
      return _cached;
    }

    const _startTime = Date.now();
    const relationships: Relationship[] = [];
    const evidence: Evidence[] = [];

    // Static Analysis
    if (this.options.includeStatic) {
      const _staticResults = await this.performStaticAnalysis(_source, _target);
      relationships.push(..._staticResults.relationships);
      evidence.push(..._staticResults.evidence);
    }

    // Semantic Analysis
    if (this.options.includeSemantic) {
      const _semanticResults = await this.performSemanticAnalysis(
        _source,
        _target,
      );
      relationships.push(..._semanticResults.relationships);
      evidence.push(..._semanticResults.evidence);
    }

    // Structural Analysis
    if (this.options.includeStructural) {
      const _structuralResults = await this.performStructuralAnalysis(
        _source,
        _target,
      );
      relationships.push(..._structuralResults.relationships);
      evidence.push(..._structuralResults.evidence);
    }

    // Pattern Matching
    const _patternResults = await this.performPatternAnalysis(_source, _target);
    relationships.push(..._patternResults.relationships);
    evidence.push(..._patternResults.evidence);

    // Calculate overall _confidence
    const _confidence = this.calculateOverallConfidence(
      relationships,
      evidence,
    );

    // Filter by _confidence threshold
    const _filteredRelationships = relationships.filter(
      (rel) => rel.metadata._confidence >= this.options.minConfidence,
    );

    const result: RelationshipAnalysisResult = {
      relationships: _filteredRelationships.slice(
        0,
        this.options.maxRelationships,
      ),
      _confidence,
      analysisType: "structural",
      metadata: {
        technique: "multi_analysis",
        _confidence,
        evidence,
        processingtime: Date.now() - _startTime,
        sourcelines: [source.lineNumber],
        targetlines: [target.lineNumber],
      },
    };

    this.analysisCache.set(_cacheKey, result);
    return result;
  }

  // ========== Static Analysis ==========

  private async performStaticAnalysis(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): Promise<{ relationships: Relationship[]; evidence: Evidence[] }> {
    const relationships: Relationship[] = [];
    const evidence: Evidence[] = [];

    // Import/Export Analysis
    const _importResult = this.analyzeImportRelationship(_source, _target);
    if (_importResult) {
      relationships.push(_importResult.relationship);
      evidence.push(..._importResult.evidence);
    }

    // Inheritance Analysis
    const _inheritanceResult = this.analyzeInheritanceRelationship(
      _source,
      _target,
    );
    if (_inheritanceResult) {
      relationships.push(_inheritanceResult.relationship);
      evidence.push(..._inheritanceResult.evidence);
    }

    // Dependency Analysis
    const _dependencyResult = this.analyzeDependencyRelationship(
      _source,
      _target,
    );
    if (_dependencyResult) {
      relationships.push(_dependencyResult.relationship);
      evidence.push(..._dependencyResult.evidence);
    }

    return { relationships, evidence };
  }

  private analyzeImportRelationship(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): { relationship: Relationship; evidence: Evidence[] } | null {
    // Check if _source imports _target
    if (_source.imports && _source.imports.includes(_target.name)) {
      return {
        relationship: this.createRelationship(
          _source.id,
          _target.id,
          "imports",
          {
            _confidence: 0.95,
            structural: 1.0,
          },
        ),
        evidence: [
          {
            type: "import_statement",
            description: `${_source.name} imports ${_target.name}`,
            strength: 0.95,
            location: {
              file: _source.filePath,
              line: _source.lineNumber,
            },
          },
        ],
      };
    }

    // Check if _target imports _source
    if (_target.imports && _target.imports.includes(_source.name)) {
      return {
        relationship: this.createRelationship(
          _target.id,
          _source.id,
          "imports",
          {
            _confidence: 0.95,
            structural: 1.0,
          },
        ),
        evidence: [
          {
            type: "import_statement",
            description: `${_target.name} imports ${_source.name}`,
            strength: 0.95,
            location: {
              file: _target.filePath,
              line: _target.lineNumber,
            },
          },
        ],
      };
    }

    return null;
  }

  private analyzeInheritanceRelationship(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): { relationship: Relationship; evidence: Evidence[] } | null {
    // Check if _source extends _target
    if (_source.dependencies.includes(_target.name)) {
      const _isImplements =
        _source.type === "class" && _target.type === "interface";
      const _isExtends = _source.type === "class" && _target.type === "class";

      if (_isImplements || _isExtends) {
        return {
          relationship: this.createRelationship(
            source.id,
            target.id,
            _isImplements ? "implements" : "extends",
            {
              _confidence: 0.9,
              structural: 1.0,
            },
          ),
          evidence: [
            {
              type: "inheritance",
              description: `${_source.name} ${_isImplements ? "implements" : "extends"} ${_target.name}`,
              strength: 0.9,
              location: {
                file: _source.filePath,
                line: _source.lineNumber,
              },
            },
          ],
        };
      }
    }

    return null;
  }

  private analyzeDependencyRelationship(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): { relationship: Relationship; evidence: Evidence[] } | null {
    // Check for type dependencies
    if (_source.dependencies.includes(_target.name)) {
      return {
        relationship: this.createRelationship(
          _source.id,
          _target.id,
          "depends",
          {
            _confidence: 0.7,
            structural: 0.8,
          },
        ),
        evidence: [
          {
            type: "type_reference",
            description: `${_source.name} depends on ${_target.name}`,
            strength: 0.7,
            location: {
              file: _source.filePath,
              line: _source.lineNumber,
            },
          },
        ],
      };
    }

    return null;
  }

  // ========== Semantic Analysis ==========

  private async performSemanticAnalysis(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): Promise<{ relationships: Relationship[]; evidence: Evidence[] }> {
    const relationships: Relationship[] = [];
    const evidence: Evidence[] = [];

    // Naming Similarity
    const _namingSimilarity = this.calculateNamingSimilarity(_source, _target);
    if (_namingSimilarity > 0.6) {
      relationships.push(
        this.createRelationship(source.id, target.id, "similar", {
          _confidence: _namingSimilarity,
          semantic: _namingSimilarity,
        }),
      );
      evidence.push({
        type: "naming_pattern",
        description: `Similar naming: ${source.name} ~ ${target.name}`,
        strength: _namingSimilarity,
      });
    }

    // Semantic Vector Similarity
    const _vectorSimilarity = this.calculateVectorSimilarity(
      source.id,
      target.id,
    );
    if (_vectorSimilarity > 0.5) {
      relationships.push(
        this.createRelationship(source.id, target.id, "related", {
          _confidence: _vectorSimilarity,
          semantic: _vectorSimilarity,
        }),
      );
      evidence.push({
        type: "semantic_similarity",
        description: `Semantic similarity: ${_vectorSimilarity.toFixed(2)}`,
        strength: _vectorSimilarity,
      });
    }

    // Documentation Analysis
    const _docSimilarity = this.analyzeDocumentationSimilarity(
      _source,
      _target,
    );
    if (_docSimilarity > 0.4) {
      relationships.push(
        this.createRelationship(source.id, target.id, "related", {
          _confidence: _docSimilarity,
          semantic: _docSimilarity,
        }),
      );
      evidence.push({
        type: "documentation",
        description: `Similar documentation themes`,
        strength: _docSimilarity,
      });
    }

    return { relationships, evidence };
  }

  private calculateNamingSimilarity(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): number {
    const _sourceTokens = this.tokenizeName(_source.name);
    const _targetTokens = this.tokenizeName(_target.name);

    // Jaccard similarity
    const _intersection = _sourceTokens.filter((token) =>
      _targetTokens.includes(token),
    );
    const _union = [...new Set([..._sourceTokens, ..._targetTokens])];

    return _intersection.length / _union.length;
  }

  private calculateVectorSimilarity(
    _sourceId: string,
    targetId: string,
  ): number {
    const _sourceVector = this.semanticVectors.get(_sourceId);
    const _targetVector = this.semanticVectors.get(targetId);

    if (!_sourceVector || !_targetVector) {
      return 0;
    }

    // Cosine similarity
    const _dotProduct = _sourceVector.vector.reduce(
      (sum, val, i) => sum + val * _targetVector.vector[i],
      0,
    );

    const _sourceMagnitude = Math.sqrt(
      _sourceVector.vector.reduce((sum, val) => sum + val * val, 0),
    );

    const _targetMagnitude = Math.sqrt(
      _targetVector.vector.reduce((sum, val) => sum + val * val, 0),
    );

    if (_sourceMagnitude === 0 || _targetMagnitude === 0) {
      return 0;
    }

    return _dotProduct / (_sourceMagnitude * _targetMagnitude);
  }

  private analyzeDocumentationSimilarity(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): number {
    if (!_source.documentation || !_target.documentation) {
      return 0;
    }

    const _sourceTokens = this.tokenizeText(_source.documentation);
    const _targetTokens = this.tokenizeText(_target.documentation);

    // TF-IDF cosine similarity (simplified)
    const _allTokens = [...new Set([..._sourceTokens, ..._targetTokens])];
    const _sourceVector = _allTokens.map(
      (token) => _sourceTokens.filter((t) => t === token).length,
    );
    const _targetVector = _allTokens.map(
      (token) => _targetTokens.filter((t) => t === token).length,
    );

    const _dotProduct = _sourceVector.reduce(
      (sum, val, i) => sum + val * _targetVector[i],
      0,
    );
    const _sourceMagnitude = Math.sqrt(
      _sourceVector.reduce((sum, val) => sum + val * val, 0),
    );
    const _targetMagnitude = Math.sqrt(
      _targetVector.reduce((sum, val) => sum + val * val, 0),
    );

    if (_sourceMagnitude === 0 || _targetMagnitude === 0) {
      return 0;
    }

    return _dotProduct / (_sourceMagnitude * _targetMagnitude);
  }

  // ========== Structural Analysis ==========

  private async performStructuralAnalysis(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): Promise<{ relationships: Relationship[]; evidence: Evidence[] }> {
    const relationships: Relationship[] = [];
    const evidence: Evidence[] = [];

    // File Structure Analysis
    const _fileStructure = this.analyzeFileStructure(_source, _target);
    if (_fileStructure) {
      relationships.push(_fileStructure.relationship);
      evidence.push(..._fileStructure.evidence);
    }

    // Type Structure Analysis
    const _typeStructure = this.analyzeTypeStructure(_source, _target);
    if (_typeStructure) {
      relationships.push(_typeStructure.relationship);
      evidence.push(..._typeStructure.evidence);
    }

    return { relationships, evidence };
  }

  private analyzeFileStructure(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): { relationship: Relationship; evidence: Evidence[] } | null {
    const _sourcePath = _source.filePath.split("/");
    const _targetPath = _target.filePath.split("/");

    // Same directory
    if (
      _sourcePath.slice(0, -1).join("/") === _targetPath.slice(0, -1).join("/")
    ) {
      return {
        relationship: this.createRelationship(
          _source.id,
          _target.id,
          "associates",
          {
            _confidence: 0.6,
            structural: 0.7,
          },
        ),
        evidence: [
          {
            type: "file_structure",
            description: `Same directory: ${_sourcePath.slice(0, -1).join("/")}`,
            strength: 0.6,
          },
        ],
      };
    }

    // Parent-child directory relationship
    const _commonPath = this.findCommonPath(_sourcePath, _targetPath);
    if (_commonPath.length > 2) {
      return {
        relationship: this.createRelationship(
          _source.id,
          _target.id,
          "related",
          {
            _confidence: 0.4,
            structural: 0.5,
          },
        ),
        evidence: [
          {
            type: "file_structure",
            description: `Related directory structure: ${_commonPath.join("/")}`,
            strength: 0.4,
          },
        ],
      };
    }

    return null;
  }

  private analyzeTypeStructure(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): { relationship: Relationship; evidence: Evidence[] } | null {
    // Component-Props relationship
    if (_source.type === "component" && _target.type === "interface") {
      if (
        _target.name.includes("Props") &&
        `${_source.name}Props` === _target.name
      ) {
        return {
          relationship: this.createRelationship(
            _source.id,
            _target.id,
            "depends",
            {
              _confidence: 0.9,
              structural: 1.0,
            },
          ),
          evidence: [
            {
              type: "type_reference",
              description: `Component-Props relationship: ${_source.name} uses ${_target.name}`,
              strength: 0.9,
            },
          ],
        };
      }
    }

    // Service-Model relationship
    if (_source.type === "class" && _target.type === "class") {
      if (_source.name.includes("Service") && _target.name.includes("Model")) {
        return {
          relationship: this.createRelationship(
            _source.id,
            _target.id,
            "depends",
            {
              _confidence: 0.7,
              structural: 0.8,
            },
          ),
          evidence: [
            {
              type: "usage_pattern",
              description: `Service-Model pattern: ${_source.name} may use ${_target.name}`,
              strength: 0.7,
            },
          ],
        };
      }
    }

    return null;
  }

  // ========== Pattern Analysis ==========

  private async performPatternAnalysis(
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): Promise<{ relationships: Relationship[]; evidence: Evidence[] }> {
    const relationships: Relationship[] = [];
    const evidence: Evidence[] = [];

    // Apply pattern rules
    for (const [_patternType, rules] of this.patterns) {
      for (const rule of rules) {
        const _matches = this.applyPattern(rule, _source, _target);
        if (_matches.length > 0) {
          relationships.push(
            this.createRelationship(
              source.id,
              target.id,
              rule.relationshipType,
              {
                _confidence: rule.confidence,
                structural: 0.8,
              },
            ),
          );

          evidence.push({
            type: rule.evidenceType,
            description: `Pattern match: ${rule.name} - ${rule.description}`,
            strength: rule.confidence,
          });
        }
      }
    }

    return { relationships, evidence };
  }

  private applyPattern(
    rule: PatternRule,
    _source: CodeEntity | ConceptEntity,
    _target: CodeEntity | ConceptEntity,
  ): string[] {
    const _matches: string[] = [];

    // Test against _source and _target names
    const _sourceMatch = rule.pattern.exec(_source.name);
    const _targetMatch = rule.pattern.exec(_target.name);

    if (_sourceMatch && _targetMatch) {
      matches.push(`${_source.name} ~ ${_target.name}`);
    }

    return _matches;
  }

  // ========== Semantic Vector Computation ==========

  private async computeSemanticVectors(
    entities: (CodeEntity | ConceptEntity)[],
  ): Promise<void> {
    this.emit("vectorComputationStarted", { entityCount: entities.length });

    for (const entity of entities) {
      const _vector = await this.computeEntityVector(entity);
      this.semanticVectors.set(entity.id, _vector);
    }

    this.emit("vectorComputationCompleted", {
      vectorCount: this.semanticVectors.size,
    });
  }

  private async computeEntityVector(
    entity: CodeEntity | ConceptEntity,
  ): Promise<SemanticVector> {
    // Extract tokens from entity name, documentation, and metadata
    const _nameTokens = this.tokenizeName(entity.name);
    const _docTokens = entity.documentation
      ? this.tokenizeText(entity.documentation)
      : [];
    const _typeTokens = [entity.type];

    const _allTokens = [..._nameTokens, ..._docTokens, ..._typeTokens];
    const _uniqueTokens = [...new Set(_allTokens)];

    // Simple TF-IDF _vector (in production would use pre-trained embeddings)
    const _vector = _uniqueTokens.map((token) => {
      const tf =
        _allTokens.filter((t) => t === token).length / _allTokens.length;
      const _idf = Math.log(1000 / (_uniqueTokens.length + 1)); // Simplified IDF
      return tf * _idf;
    });

    // Normalize _vector
    const _magnitude = Math.sqrt(
      _vector.reduce((sum, val) => sum + val * val, 0),
    );
    const _normalizedVector =
      _magnitude > 0 ? _vector.map((val) => val / _magnitude) : _vector;

    return {
      entityid: entity.id,
      _vector: _normalizedVector,
      tokens: _uniqueTokens,
      weights: _normalizedVector,
    };
  }

  // ========== Pattern Initialization ==========

  private initializePatterns(): Map<string, PatternRule[]> {
    const _patterns = new Map<string, PatternRule[]>();

    // Naming _patterns
    patterns.set("naming", [
      {
        id: "same_base_name",
        name: "Same Base Name",
        description: "Entities with similar base names",
        pattern:
          /^(.+?)(Service|Manager|Controller|Repository|Model|Entity|DTO|Props|Config)$/,
        relationshipType: "related",
        _confidence: 0.7,
        evidenceType: "naming_pattern",
      },
      {
        id: "test_relationship",
        name: "Test Relationship",
        description: "Test file relationship",
        pattern: /(.+)\.test$/,
        relationshipType: "depends",
        _confidence: 0.9,
        evidenceType: "naming_pattern",
      },
    ]);

    // Architectural _patterns
    patterns.set("architecture", [
      {
        id: "mvc_pattern",
        name: "MVC Pattern",
        description: "Model-View-Controller relationship",
        pattern: /(Model|View|Controller)$/,
        relationshipType: "collaboration",
        _confidence: 0.8,
        evidenceType: "usage_pattern",
      },
      {
        id: "repository_pattern",
        name: "Repository Pattern",
        description: "Repository-Entity relationship",
        pattern: /(Repository|Entity)$/,
        relationshipType: "depends",
        _confidence: 0.8,
        evidenceType: "usage_pattern",
      },
    ]);

    return _patterns;
  }

  // ========== Utility Methods ==========

  private createRelationship(
    sourceId: string,
    targetId: string,
    type: RelationshipType,
    metadata: Partial<RelationshipMetadata>,
  ): Relationship {
    return {
      id: `${sourceId}__${type}__${targetId}`,
      _source: sourceId,
      _target: targetId,
      type,
      strength: metadata.confidence || 0.5,
      metadata: {
        _confidence: 0.5,
        weight: 1.0,
        frequency: 1,
        distance: 1,
        semantic: 0.0,
        structural: 0.0,
        temporal: 0.0,
        created: new Date(),
        lastUsed: new Date(),
        ...metadata,
      },
      bidirectional: [
        "similar",
        "related",
        "associates",
        "collaboration",
      ].includes(type),
    };
  }

  private calculateOverallConfidence(
    _relationships: Relationship[],
    evidence: Evidence[],
  ): number {
    if (_relationships.length === 0) {
      return 0;
    }

    const _relationshipConfidence =
      _relationships.reduce((sum, rel) => sum + rel.metadata.confidence, 0) /
      _relationships.length;

    const _evidenceConfidence =
      evidence.length > 0
        ? evidence.reduce((sum, ev) => sum + ev.strength, 0) / evidence.length
        : 0;

    return (_relationshipConfidence + _evidenceConfidence) / 2;
  }

  private tokenizeName(name: string): string[] {
    // Camel case and snake case tokenization
    return name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 1);
  }

  private tokenizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  private findCommonPath(_path1: string[], path2: string[]): string[] {
    const common: string[] = [];
    const _minLength = Math.min(_path1.length, path2.length);

    for (let i = 0; i < _minLength; i++) {
      if (_path1[i] === path2[i]) {
        common.push(_path1[i]);
      } else {
        break;
      }
    }

    return common;
  }

  // ========== Public API ==========

  clearCache(): void {
    this.analysisCache.clear();
  }

  getCacheSize(): number {
    return this.analysisCache.size;
  }

  getSemanticVectors(): Map<string, SemanticVector> {
    return new Map(this.semanticVectors);
  }

  addCustomPattern(pattern: PatternRule): void {
    const _categoryPatterns = this.patterns.get("custom") || [];
    categoryPatterns.push(pattern);
    this.patterns.set("custom", _categoryPatterns);
  }

  removeCustomPattern(patternId: string): boolean {
    const _customPatterns = this.patterns.get("custom") || [];
    const _index = _customPatterns.findIndex((p) => p.id === patternId);

    if (_index >= 0) {
      customPatterns.splice(_index, 1);
      return true;
    }

    return false;
  }
}

export default RelationshipAnalyzer;
