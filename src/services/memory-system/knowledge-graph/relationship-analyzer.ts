/**
 * Relationship Analyzer for Knowledge Graph
 *
 * Analyzes and infers relationships between code entities using multiple techniques:
 * - Static analysis (imports, inheritance, calls)
 * - Semantic analysis (naming, documentation)
 * - Structural analysis (patterns, architectures)
 * - Behavioral analysis (usage, dependencies)
 */

import { EventEmitter } from 'events';
import { CodeEntity, ConceptEntity, EntityType } from './entity-extractor';
import { Relationship, RelationshipMetadata, RelationshipType } from './graph-builder';

export interface RelationshipAnalysisResult {
  relationships: Relationship[];
  confidence: number;
  analysisType: AnalysisType;
  metadata: AnalysisMetadata;
}

export type AnalysisType =
  | 'static'
  | 'semantic'
  | 'structural'
  | 'behavioral'
  | 'pattern'
  | 'temporal'
  | 'dependency'
  | 'similarity';

export interface AnalysisMetadata {
  technique: string;
  confidence: number;
  evidence: Evidence[];
  processing_time: number;
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
  | 'import_statement'
  | 'inheritance'
  | 'method_call'
  | 'instantiation'
  | 'type_reference'
  | 'naming_pattern'
  | 'documentation'
  | 'file_structure'
  | 'usage_pattern'
  | 'temporal_correlation'
  | 'semantic_similarity';

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
  confidence: number;
  evidenceType: EvidenceType;
}

export interface SemanticVector {
  entity_id: string;
  vector: number[];
  tokens: string[];
  weights: number[];
}

export class RelationshipAnalyzer extends EventEmitter {
  private patterns: Map<string, PatternRule[]>;
  private semanticVectors: Map<string, SemanticVector>;
  private analysisCache: Map<string, RelationshipAnalysisResult>;
  private options: AnalysisOptions;

  constructor(options: Partial<AnalysisOptions> = {}) {
    super();

    this.options = {
      includeStatic: true,
      includeSemantic: true,
      includeStructural: true,
      includeBehavioral: false,
      minConfidence: 0.3,
      maxRelationships: 1000,
      analysisDepth: 3,
      ...options,
    };

    this.patterns = this.initializePatterns();
    this.semanticVectors = new Map();
    this.analysisCache = new Map();
  }

  // ========== Main Analysis Methods ==========

  async analyzeRelationships(
    entities: (CodeEntity | ConceptEntity)[],
  ): Promise<RelationshipAnalysisResult[]> {
    const startTime = Date.now();
    const results: RelationshipAnalysisResult[] = [];

    this.emit('analysisStarted', { entityCount: entities.length });

    // Precompute semantic vectors if semantic analysis is enabled
    if (this.options.includeSemantic) {
      await this.computeSemanticVectors(entities);
    }

    // Analyze all entity pairs
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const source = entities[i];
        const target = entities[j];

        const analysisResult = await this.analyzeEntityPair(source, target);
        if (analysisResult.relationships.length > 0) {
          results.push(analysisResult);
        }

        // Emit progress
        if ((i * entities.length + j) % 100 === 0) {
          this.emit('analysisProgress', {
            processed: i * entities.length + j,
            total: (entities.length * (entities.length - 1)) / 2,
          });
        }
      }
    }

    this.emit('analysisCompleted', {
      duration: Date.now() - startTime,
      relationshipCount: results.reduce((sum, r) => sum + r.relationships.length, 0),
    });

    return results;
  }

  async analyzeEntityPair(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): Promise<RelationshipAnalysisResult> {
    const cacheKey = `${source.id}__${target.id}`;
    const cached = this.analysisCache.get(cacheKey);
    if (cached) {return cached;}

    const startTime = Date.now();
    const relationships: Relationship[] = [];
    const evidence: Evidence[] = [];

    // Static Analysis
    if (this.options.includeStatic) {
      const staticResults = await this.performStaticAnalysis(source, target);
      relationships.push(...staticResults.relationships);
      evidence.push(...staticResults.evidence);
    }

    // Semantic Analysis
    if (this.options.includeSemantic) {
      const semanticResults = await this.performSemanticAnalysis(source, target);
      relationships.push(...semanticResults.relationships);
      evidence.push(...semanticResults.evidence);
    }

    // Structural Analysis
    if (this.options.includeStructural) {
      const structuralResults = await this.performStructuralAnalysis(source, target);
      relationships.push(...structuralResults.relationships);
      evidence.push(...structuralResults.evidence);
    }

    // Pattern Matching
    const patternResults = await this.performPatternAnalysis(source, target);
    relationships.push(...patternResults.relationships);
    evidence.push(...patternResults.evidence);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(relationships, evidence);

    // Filter by confidence threshold
    const filteredRelationships = relationships.filter(
      (rel) => rel.metadata.confidence >= this.options.minConfidence,
    );

    const result: RelationshipAnalysisResult = {
      relationships: filteredRelationships.slice(0, this.options.maxRelationships),
      confidence,
      analysisType: 'structural',
      metadata: {
        technique: 'multi_analysis',
        confidence,
        evidence,
        processing_time: Date.now() - startTime,
        source_lines: [source.lineNumber],
        target_lines: [target.lineNumber],
      },
    };

    this.analysisCache.set(cacheKey, result);
    return result;
  }

  // ========== Static Analysis ==========

  private async performStaticAnalysis(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): Promise<{ relationships: Relationship[]; evidence: Evidence[] }> {
    const relationships: Relationship[] = [];
    const evidence: Evidence[] = [];

    // Import/Export Analysis
    const importResult = this.analyzeImportRelationship(source, target);
    if (importResult) {
      relationships.push(importResult.relationship);
      evidence.push(...importResult.evidence);
    }

    // Inheritance Analysis
    const inheritanceResult = this.analyzeInheritanceRelationship(source, target);
    if (inheritanceResult) {
      relationships.push(inheritanceResult.relationship);
      evidence.push(...inheritanceResult.evidence);
    }

    // Dependency Analysis
    const dependencyResult = this.analyzeDependencyRelationship(source, target);
    if (dependencyResult) {
      relationships.push(dependencyResult.relationship);
      evidence.push(...dependencyResult.evidence);
    }

    return { relationships, evidence };
  }

  private analyzeImportRelationship(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): { relationship: Relationship; evidence: Evidence[] } | null {
    // Check if source imports target
    if (source.imports && source.imports.includes(target.name)) {
      return {
        relationship: this.createRelationship(source.id, target.id, 'imports', {
          confidence: 0.95,
          structural: 1.0,
        }),
        evidence: [
          {
            type: 'import_statement',
            description: `${source.name} imports ${target.name}`,
            strength: 0.95,
            location: {
              file: source.filePath,
              line: source.lineNumber,
            },
          },
        ],
      };
    }

    // Check if target imports source
    if (target.imports && target.imports.includes(source.name)) {
      return {
        relationship: this.createRelationship(target.id, source.id, 'imports', {
          confidence: 0.95,
          structural: 1.0,
        }),
        evidence: [
          {
            type: 'import_statement',
            description: `${target.name} imports ${source.name}`,
            strength: 0.95,
            location: {
              file: target.filePath,
              line: target.lineNumber,
            },
          },
        ],
      };
    }

    return null;
  }

  private analyzeInheritanceRelationship(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): { relationship: Relationship; evidence: Evidence[] } | null {
    // Check if source extends target
    if (source.dependencies.includes(target.name)) {
      const isImplements = source.type === 'class' && target.type === 'interface';
      const isExtends = source.type === 'class' && target.type === 'class';

      if (isImplements || isExtends) {
        return {
          relationship: this.createRelationship(
            source.id,
            target.id,
            isImplements ? 'implements' : 'extends',
            {
              confidence: 0.9,
              structural: 1.0,
            },
          ),
          evidence: [
            {
              type: 'inheritance',
              description: `${source.name} ${isImplements ? 'implements' : 'extends'} ${target.name}`,
              strength: 0.9,
              location: {
                file: source.filePath,
                line: source.lineNumber,
              },
            },
          ],
        };
      }
    }

    return null;
  }

  private analyzeDependencyRelationship(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): { relationship: Relationship; evidence: Evidence[] } | null {
    // Check for type dependencies
    if (source.dependencies.includes(target.name)) {
      return {
        relationship: this.createRelationship(source.id, target.id, 'depends', {
          confidence: 0.7,
          structural: 0.8,
        }),
        evidence: [
          {
            type: 'type_reference',
            description: `${source.name} depends on ${target.name}`,
            strength: 0.7,
            location: {
              file: source.filePath,
              line: source.lineNumber,
            },
          },
        ],
      };
    }

    return null;
  }

  // ========== Semantic Analysis ==========

  private async performSemanticAnalysis(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): Promise<{ relationships: Relationship[]; evidence: Evidence[] }> {
    const relationships: Relationship[] = [];
    const evidence: Evidence[] = [];

    // Naming Similarity
    const namingSimilarity = this.calculateNamingSimilarity(source, target);
    if (namingSimilarity > 0.6) {
      relationships.push(
        this.createRelationship(source.id, target.id, 'similar', {
          confidence: namingSimilarity,
          semantic: namingSimilarity,
        }),
      );
      evidence.push({
        type: 'naming_pattern',
        description: `Similar naming: ${source.name} ~ ${target.name}`,
        strength: namingSimilarity,
      });
    }

    // Semantic Vector Similarity
    const vectorSimilarity = this.calculateVectorSimilarity(source.id, target.id);
    if (vectorSimilarity > 0.5) {
      relationships.push(
        this.createRelationship(source.id, target.id, 'related', {
          confidence: vectorSimilarity,
          semantic: vectorSimilarity,
        }),
      );
      evidence.push({
        type: 'semantic_similarity',
        description: `Semantic similarity: ${vectorSimilarity.toFixed(2)}`,
        strength: vectorSimilarity,
      });
    }

    // Documentation Analysis
    const docSimilarity = this.analyzeDocumentationSimilarity(source, target);
    if (docSimilarity > 0.4) {
      relationships.push(
        this.createRelationship(source.id, target.id, 'related', {
          confidence: docSimilarity,
          semantic: docSimilarity,
        }),
      );
      evidence.push({
        type: 'documentation',
        description: `Similar documentation themes`,
        strength: docSimilarity,
      });
    }

    return { relationships, evidence };
  }

  private calculateNamingSimilarity(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): number {
    const sourceTokens = this.tokenizeName(source.name);
    const targetTokens = this.tokenizeName(target.name);

    // Jaccard similarity
    const intersection = sourceTokens.filter((token) => targetTokens.includes(token));
    const union = [...new Set([...sourceTokens, ...targetTokens])];

    return intersection.length / union.length;
  }

  private calculateVectorSimilarity(sourceId: string, targetId: string): number {
    const sourceVector = this.semanticVectors.get(sourceId);
    const targetVector = this.semanticVectors.get(targetId);

    if (!sourceVector || !targetVector) {return 0;}

    // Cosine similarity
    const dotProduct = sourceVector.vector.reduce(
      (sum, val, i) => sum + val * targetVector.vector[i],
      0,
    );

    const sourceMagnitude = Math.sqrt(sourceVector.vector.reduce((sum, val) => sum + val * val, 0));

    const targetMagnitude = Math.sqrt(targetVector.vector.reduce((sum, val) => sum + val * val, 0));

    if (sourceMagnitude === 0 || targetMagnitude === 0) {return 0;}

    return dotProduct / (sourceMagnitude * targetMagnitude);
  }

  private analyzeDocumentationSimilarity(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): number {
    if (!source.documentation || !target.documentation) {return 0;}

    const sourceTokens = this.tokenizeText(source.documentation);
    const targetTokens = this.tokenizeText(target.documentation);

    // TF-IDF cosine similarity (simplified)
    const allTokens = [...new Set([...sourceTokens, ...targetTokens])];
    const sourceVector = allTokens.map((token) => sourceTokens.filter((t) => t === token).length);
    const targetVector = allTokens.map((token) => targetTokens.filter((t) => t === token).length);

    const dotProduct = sourceVector.reduce((sum, val, i) => sum + val * targetVector[i], 0);
    const sourceMagnitude = Math.sqrt(sourceVector.reduce((sum, val) => sum + val * val, 0));
    const targetMagnitude = Math.sqrt(targetVector.reduce((sum, val) => sum + val * val, 0));

    if (sourceMagnitude === 0 || targetMagnitude === 0) {return 0;}

    return dotProduct / (sourceMagnitude * targetMagnitude);
  }

  // ========== Structural Analysis ==========

  private async performStructuralAnalysis(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): Promise<{ relationships: Relationship[]; evidence: Evidence[] }> {
    const relationships: Relationship[] = [];
    const evidence: Evidence[] = [];

    // File Structure Analysis
    const fileStructure = this.analyzeFileStructure(source, target);
    if (fileStructure) {
      relationships.push(fileStructure.relationship);
      evidence.push(...fileStructure.evidence);
    }

    // Type Structure Analysis
    const typeStructure = this.analyzeTypeStructure(source, target);
    if (typeStructure) {
      relationships.push(typeStructure.relationship);
      evidence.push(...typeStructure.evidence);
    }

    return { relationships, evidence };
  }

  private analyzeFileStructure(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): { relationship: Relationship; evidence: Evidence[] } | null {
    const sourcePath = source.filePath.split('/');
    const targetPath = target.filePath.split('/');

    // Same directory
    if (sourcePath.slice(0, -1).join('/') === targetPath.slice(0, -1).join('/')) {
      return {
        relationship: this.createRelationship(source.id, target.id, 'associates', {
          confidence: 0.6,
          structural: 0.7,
        }),
        evidence: [
          {
            type: 'file_structure',
            description: `Same directory: ${sourcePath.slice(0, -1).join('/')}`,
            strength: 0.6,
          },
        ],
      };
    }

    // Parent-child directory relationship
    const commonPath = this.findCommonPath(sourcePath, targetPath);
    if (commonPath.length > 2) {
      return {
        relationship: this.createRelationship(source.id, target.id, 'related', {
          confidence: 0.4,
          structural: 0.5,
        }),
        evidence: [
          {
            type: 'file_structure',
            description: `Related directory structure: ${commonPath.join('/')}`,
            strength: 0.4,
          },
        ],
      };
    }

    return null;
  }

  private analyzeTypeStructure(
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): { relationship: Relationship; evidence: Evidence[] } | null {
    // Component-Props relationship
    if (source.type === 'component' && target.type === 'interface') {
      if (target.name.includes('Props') && `${source.name  }Props` === target.name) {
        return {
          relationship: this.createRelationship(source.id, target.id, 'depends', {
            confidence: 0.9,
            structural: 1.0,
          }),
          evidence: [
            {
              type: 'type_reference',
              description: `Component-Props relationship: ${source.name} uses ${target.name}`,
              strength: 0.9,
            },
          ],
        };
      }
    }

    // Service-Model relationship
    if (source.type === 'class' && target.type === 'class') {
      if (source.name.includes('Service') && target.name.includes('Model')) {
        return {
          relationship: this.createRelationship(source.id, target.id, 'depends', {
            confidence: 0.7,
            structural: 0.8,
          }),
          evidence: [
            {
              type: 'usage_pattern',
              description: `Service-Model pattern: ${source.name} may use ${target.name}`,
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
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): Promise<{ relationships: Relationship[]; evidence: Evidence[] }> {
    const relationships: Relationship[] = [];
    const evidence: Evidence[] = [];

    // Apply pattern rules
    for (const [patternType, rules] of this.patterns) {
      for (const rule of rules) {
        const matches = this.applyPattern(rule, source, target);
        if (matches.length > 0) {
          relationships.push(
            this.createRelationship(source.id, target.id, rule.relationshipType, {
              confidence: rule.confidence,
              structural: 0.8,
            }),
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
    source: CodeEntity | ConceptEntity,
    target: CodeEntity | ConceptEntity,
  ): string[] {
    const matches: string[] = [];

    // Test against source and target names
    const sourceMatch = rule.pattern.exec(source.name);
    const targetMatch = rule.pattern.exec(target.name);

    if (sourceMatch && targetMatch) {
      matches.push(`${source.name} ~ ${target.name}`);
    }

    return matches;
  }

  // ========== Semantic Vector Computation ==========

  private async computeSemanticVectors(entities: (CodeEntity | ConceptEntity)[]): Promise<void> {
    this.emit('vectorComputationStarted', { entityCount: entities.length });

    for (const entity of entities) {
      const vector = await this.computeEntityVector(entity);
      this.semanticVectors.set(entity.id, vector);
    }

    this.emit('vectorComputationCompleted', { vectorCount: this.semanticVectors.size });
  }

  private async computeEntityVector(entity: CodeEntity | ConceptEntity): Promise<SemanticVector> {
    // Extract tokens from entity name, documentation, and metadata
    const nameTokens = this.tokenizeName(entity.name);
    const docTokens = entity.documentation ? this.tokenizeText(entity.documentation) : [];
    const typeTokens = [entity.type];

    const allTokens = [...nameTokens, ...docTokens, ...typeTokens];
    const uniqueTokens = [...new Set(allTokens)];

    // Simple TF-IDF vector (in production would use pre-trained embeddings)
    const vector = uniqueTokens.map((token) => {
      const tf = allTokens.filter((t) => t === token).length / allTokens.length;
      const idf = Math.log(1000 / (uniqueTokens.length + 1)); // Simplified IDF
      return tf * idf;
    });

    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    const normalizedVector = magnitude > 0 ? vector.map((val) => val / magnitude) : vector;

    return {
      entity_id: entity.id,
      vector: normalizedVector,
      tokens: uniqueTokens,
      weights: normalizedVector,
    };
  }

  // ========== Pattern Initialization ==========

  private initializePatterns(): Map<string, PatternRule[]> {
    const patterns = new Map<string, PatternRule[]>();

    // Naming patterns
    patterns.set('naming', [
      {
        id: 'same_base_name',
        name: 'Same Base Name',
        description: 'Entities with similar base names',
        pattern: /^(.+?)(Service|Manager|Controller|Repository|Model|Entity|DTO|Props|Config)$/,
        relationshipType: 'related',
        confidence: 0.7,
        evidenceType: 'naming_pattern',
      },
      {
        id: 'test_relationship',
        name: 'Test Relationship',
        description: 'Test file relationship',
        pattern: /(.+)\.test$/,
        relationshipType: 'depends',
        confidence: 0.9,
        evidenceType: 'naming_pattern',
      },
    ]);

    // Architectural patterns
    patterns.set('architecture', [
      {
        id: 'mvc_pattern',
        name: 'MVC Pattern',
        description: 'Model-View-Controller relationship',
        pattern: /(Model|View|Controller)$/,
        relationshipType: 'collaboration',
        confidence: 0.8,
        evidenceType: 'usage_pattern',
      },
      {
        id: 'repository_pattern',
        name: 'Repository Pattern',
        description: 'Repository-Entity relationship',
        pattern: /(Repository|Entity)$/,
        relationshipType: 'depends',
        confidence: 0.8,
        evidenceType: 'usage_pattern',
      },
    ]);

    return patterns;
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
      source: sourceId,
      target: targetId,
      type,
      strength: metadata.confidence || 0.5,
      metadata: {
        confidence: 0.5,
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
      bidirectional: ['similar', 'related', 'associates', 'collaboration'].includes(type),
    };
  }

  private calculateOverallConfidence(relationships: Relationship[], evidence: Evidence[]): number {
    if (relationships.length === 0) {return 0;}

    const relationshipConfidence =
      relationships.reduce((sum, rel) => sum + rel.metadata.confidence, 0) / relationships.length;

    const evidenceConfidence =
      evidence.length > 0
        ? evidence.reduce((sum, ev) => sum + ev.strength, 0) / evidence.length
        : 0;

    return (relationshipConfidence + evidenceConfidence) / 2;
  }

  private tokenizeName(name: string): string[] {
    // Camel case and snake case tokenization
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 1);
  }

  private tokenizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  private findCommonPath(path1: string[], path2: string[]): string[] {
    const common: string[] = [];
    const minLength = Math.min(path1.length, path2.length);

    for (let i = 0; i < minLength; i++) {
      if (path1[i] === path2[i]) {
        common.push(path1[i]);
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
    const categoryPatterns = this.patterns.get('custom') || [];
    categoryPatterns.push(pattern);
    this.patterns.set('custom', categoryPatterns);
  }

  removeCustomPattern(patternId: string): boolean {
    const customPatterns = this.patterns.get('custom') || [];
    const index = customPatterns.findIndex((p) => p.id === patternId);

    if (index >= 0) {
      customPatterns.splice(index, 1);
      return true;
    }

    return false;
  }
}

export default RelationshipAnalyzer;
