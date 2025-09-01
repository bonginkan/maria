/**
 * Context Optimizer - Phase 4.3 AI Integration Enhancement
 *
 * Implements 3-stage context optimization pipeline:
 * Stage 1: Cut - Remove non-essential _sections
 * Stage 2: Compress - Summarize repetitive _content
 * Stage 3: Abstract - Create high-level summaries
 */

import chalk from "chalk";
import { performance } from "node:perf_hooks";

export interface OptimizationConfig {
  maxTokens: number;
  preserveStructure: boolean; // Keep original structure vs aggressive compression
  qualityThreshold: number; // 0-1, higher = more conservative optimization
  compressionLevel: "light" | "medium" | "aggressive";
}

export interface ContentSection {
  type: "code" | "comment" | "documentation" | "metadata" | "boilerplate";
  _content: string;
  importance: number; // 0-1, higher = more important
  tokens: number;
  startIndex: number;
  endIndex: number;
}

export interface OptimizedContext {
  optimized: string;
  _originalTokens: number;
  _optimizedTokens: number;
  compressionRatio: number; // _originalTokens / _optimizedTokens
  tokenSavings: number; // _originalTokens - _optimizedTokens
  _qualityScore: number; // Estimated quality retention (0-1)
  _stages: {
    cut: { removed: number; tokensAfter: number };
    compress: { compressed: number; tokensAfter: number };
    abstract: { abstracted: number; tokensAfter: number };
  };
  preservedSections: ContentSection[];
  removedSections: ContentSection[];
}

export interface QualityMetrics {
  _structuralIntegrity: number; // 0-1, code structure preservation
  _informationDensity: number; // 0-1, information per token
  _contextRelevance: number; // 0-1, relevance to task
  overallQuality: number; // Combined score
}

export class ContextOptimizer {
  private readonly tokenEstimateRatio = 4; // ~4 characters per token (rough estimate)

  /**
   * Optimize context using 3-stage pipeline
   */
  optimize(
    context: string,
    maxTokens: number,
    config?: Partial<OptimizationConfig>,
  ): OptimizedContext {
    const _startTime = performance.now();
    const fullConfig: OptimizationConfig = {
      maxTokens,
      preserveStructure: true,
      qualityThreshold: 0.8,
      compressionLevel: "medium",
      ...config,
    };

    const _originalTokens = this.estimateTokens(context);

    console.debug(
      chalk.gray(
        `🔧 Optimizing context: ${_originalTokens} tokens → ${maxTokens} tokens (${fullConfig.compressionLevel})`,
      ),
    );

    if (_originalTokens <= maxTokens) {
      // No optimization needed
      return {
        optimized: context,
        _originalTokens: _originalTokens,
        _optimizedTokens: _originalTokens,
        compressionRatio: 1,
        tokenSavings: 0,
        _qualityScore: 1,
        _stages: {
          cut: { removed: 0, tokensAfter: _originalTokens },
          compress: { compressed: 0, tokensAfter: _originalTokens },
          abstract: { abstracted: 0, tokensAfter: _originalTokens },
        },
        preservedSections: [],
        removedSections: [],
      };
    }

    let currentContext = context;
    let _currentTokens = _originalTokens;
    const _stages = {
      cut: { removed: 0, tokensAfter: _originalTokens },
      compress: { compressed: 0, tokensAfter: _originalTokens },
      abstract: { abstracted: 0, tokensAfter: _originalTokens },
    };

    // Parse _content into _sections
    const _sections = this.parseContentSections(currentContext);
    let preservedSections: ContentSection[] = [];
    let removedSections: ContentSection[] = [];

    // Stage 1: Cut - Remove non-essential _sections
    if (_currentTokens > maxTokens) {
      const _cutResult = this.applyCutStage(_sections, maxTokens, fullConfig);
      currentContext = _cutResult.content;
      _currentTokens = this.estimateTokens(currentContext);
      _stages.cut = {
        removed: _cutResult.removedSections.length,
        tokensAfter: _currentTokens,
      };
      preservedSections = _cutResult.preservedSections;
      removedSections = _cutResult.removedSections;
    }

    // Stage 2: Compress - Summarize repetitive _content
    if (_currentTokens > maxTokens) {
      const _compressResult = this.applyCompressStage(
        currentContext,
        maxTokens,
        fullConfig,
      );
      currentContext = _compressResult.content;
      _currentTokens = this.estimateTokens(currentContext);
      _stages.compress = {
        compressed: _compressResult.compressedBlocks,
        tokensAfter: _currentTokens,
      };
    }

    // Stage 3: Abstract - Create high-level summaries
    if (_currentTokens > maxTokens) {
      const _abstractResult = this.applyAbstractStage(
        currentContext,
        maxTokens,
        fullConfig,
      );
      currentContext = _abstractResult.content;
      _currentTokens = this.estimateTokens(currentContext);
      _stages.abstract = {
        abstracted: _abstractResult.abstractedBlocks,
        tokensAfter: _currentTokens,
      };
    }

    const _qualityScore = this.assessQuality(
      context,
      currentContext,
      fullConfig,
    );
    const _optimizationTime = performance.now() - _startTime;

    console.debug(
      chalk.gray(
        `✅ Context optimized in ${_optimizationTime.toFixed(1)}ms: ` +
          `${_originalTokens}→${_currentTokens} tokens (${((1 - _currentTokens / _originalTokens) * 100).toFixed(1)}% reduction, ` +
          `quality: ${(_qualityScore * 100).toFixed(1)}%)`,
      ),
    );

    return {
      optimized: currentContext,
      _originalTokens: _originalTokens,
      _optimizedTokens: _currentTokens,
      compressionRatio: _originalTokens / _currentTokens,
      tokenSavings: _originalTokens - _currentTokens,
      _qualityScore: _qualityScore,
      _stages: _stages,
      preservedSections,
      removedSections,
    };
  }

  /**
   * Parse _content into typed _sections with importance scoring
   */
  private parseContentSections(_content: string): ContentSection[] {
    const _sections: ContentSection[] = [];
    const _lines = content.split("\n");
    let currentSection: Partial<ContentSection> = {};
    let lineIndex = 0;

    for (const line of _lines) {
      const _trimmed = line.trim();
      const _lineStart = content.indexOf(line, lineIndex);
      const _lineEnd = _lineStart + line.length;

      // Detect section type
      let sectionType: ContentSection["type"];
      let importance: number;

      if (this.isCodeLine(_trimmed)) {
        sectionType = "code";
        importance = this.scoreCodeImportance(_trimmed);
      } else if (this.isCommentLine(_trimmed)) {
        sectionType = "comment";
        importance = this.scoreCommentImportance(_trimmed);
      } else if (this.isDocumentationLine(_trimmed)) {
        sectionType = "documentation";
        importance = 0.7;
      } else if (this.isMetadataLine(_trimmed)) {
        sectionType = "metadata";
        importance = 0.3;
      } else {
        sectionType = "boilerplate";
        importance = 0.1;
      }

      // Group consecutive _lines of same type
      if (currentSection.type === sectionType) {
        currentSection.content += "\n" + line;
        currentSection.endIndex = _lineEnd;
      } else {
        // Finish previous section
        if (currentSection.type && currentSection.content) {
          _sections.push({
            type: currentSection.type,
            _content: currentSection.content,
            importance: currentSection.importance || 0.5,
            tokens: this.estimateTokens(currentSection.content),
            startIndex: currentSection.startIndex || 0,
            endIndex: currentSection.endIndex || 0,
          });
        }

        // Start new section
        currentSection = {
          type: sectionType,
          _content: line,
          importance,
          startIndex: _lineStart,
          endIndex: _lineEnd,
        };
      }

      lineIndex = _lineEnd + 1;
    }

    // Add final section
    if (currentSection.type && currentSection.content) {
      _sections.push({
        type: currentSection.type,
        _content: currentSection.content,
        importance: currentSection.importance || 0.5,
        tokens: this.estimateTokens(currentSection.content),
        startIndex: currentSection.startIndex || 0,
        endIndex: currentSection.endIndex || 0,
      });
    }

    return _sections;
  }

  /**
   * Stage 1: Cut - Remove non-essential _sections based on importance
   */
  private applyCutStage(
    _sections: ContentSection[],
    maxTokens: number,
    _config: OptimizationConfig,
  ): {
    _content: string;
    preservedSections: ContentSection[];
    removedSections: ContentSection[];
  } {
    // Sort by importance (preserve most important)
    const _sortedSections = [..._sections].sort(
      (a, b) => b.importance - a.importance,
    );

    const preservedSections: ContentSection[] = [];
    const removedSections: ContentSection[] = [];
    let _currentTokens = 0;

    for (const section of _sortedSections) {
      if (_currentTokens + section.tokens <= maxTokens * 1.2) {
        // Allow some buffer for Stage 2&3
        preservedSections.push(section);
        _currentTokens += section.tokens;
      } else {
        removedSections.push(section);
      }
    }

    // Reconstruct _content maintaining original order
    const _preservedByPosition = preservedSections.sort(
      (a, b) => a.startIndex - b.startIndex,
    );
    const _content = _preservedByPosition.map((s) => s._content).join("\n");

    return { _content, preservedSections, removedSections };
  }

  /**
   * Stage 2: Compress - Summarize repetitive and verbose _content
   */
  private applyCompressStage(
    _content: string,
    _maxTokens: number,
    _config: OptimizationConfig,
  ): { _content: string; compressedBlocks: number } {
    let compressed = _content;
    let compressedBlocks = 0;

    // Remove redundant whitespace
    compressed = compressed.replace(/\n\s*\n\s*\n/g, "\n\n");
    compressed = compressed.replace(/[ \t]+/g, " ");

    // Compress repetitive _patterns
    const _repetitivePatterns = [
      // Long import lists
      {
        pattern: /(import\s+[^;]+;\s*\n){5,}/g,
        replacement: (_match: string) => {
          const _imports = _match.trim().split("\n");
          return `// ${_imports.length} _imports...\n${_imports[0]}\n// ... ${_imports.length - 2} more _imports\n${_imports[_imports.length - 1]}\n`;
        },
      },
      // Long parameter lists
      {
        pattern: /\(([^)]{100,})\)/g,
        replacement: (_match: string, params: string) => {
          const _paramList = params.split(",").map((p) => p.trim());
          if (_paramList.length > 4) {
            return `(${_paramList.slice(0, 2).join(", ")}, /* ${_paramList.length - 4} more params */, ${_paramList.slice(-2).join(", ")})`;
          }
          return _match;
        },
      },
      // Long comment blocks
      {
        pattern: /\/\*[\s\S]{200,}\*\//g,
        replacement: (_match: string) => {
          const _lines = _match.split("\n");
          return _lines.length > 10
            ? `/* ${_lines[1]?.trim() || "Comment block"}... (${_lines.length} _lines) */`
            : _match;
        },
      },
    ];

    for (const { pattern, replacement } of _repetitivePatterns) {
      const _beforeLength = compressed.length;
      compressed = compressed.replace(pattern, replacement as any);
      if (compressed.length < _beforeLength) {
        compressedBlocks++;
      }
    }

    return { _content: compressed, compressedBlocks };
  }

  /**
   * Stage 3: Abstract - Create high-level summaries for remaining verbose _sections
   */
  private applyAbstractStage(
    _content: string,
    maxTokens: number,
    _config: OptimizationConfig,
  ): { _content: string; abstractedBlocks: number } {
    let abstracted = _content;
    let abstractedBlocks = 0;
    const _currentTokens = this.estimateTokens(_content);

    if (_currentTokens <= maxTokens) {
      return { _content: abstracted, abstractedBlocks: 0 };
    }

    // Abstract long function bodies
    abstracted = abstracted.replace(
      /(\w+\s*\([^)]*\)\s*\{)([^}]{500,})(\})/g,
      (_match, start, body, end) => {
        const _lines = body.split("\n").filter((line) => line.trim());
        const _summary = this.createFunctionSummary(body);
        abstractedBlocks++;
        return `${start}\n    /* Function body (${_lines.length} _lines): ${_summary} */\n${end}`;
      },
    );

    // Abstract long class definitions
    abstracted = abstracted.replace(
      /(class\s+\w+[^{]*\{)([^}]{1000,})(\})/g,
      (match, start, body, end) => {
        const _methods = (body.match(/\w+\s*\([^)]*\)\s*\{/g) || []).length;
        const _properties = (body.match(/\w+\s*[:=]/g) || []).length;
        abstractedBlocks++;
        return `${start}\n    /* Class body: ${_methods} _methods, ${_properties} _properties */\n${end}`;
      },
    );

    return { _content: abstracted, abstractedBlocks };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(_content: string): number {
    // Rough estimation: ~4 characters per token on average
    // More sophisticated tokenization could be added here
    return Math.ceil(_content.length / this.tokenEstimateRatio);
  }

  /**
   * Assess optimization quality
   */
  private assessQuality(
    _original: string,
    optimized: string,
    _config: OptimizationConfig,
  ): number {
    const _metrics = this.calculateQualityMetrics(_original, optimized);

    // Weighted quality score
    const _weights = {
      _structuralIntegrity: 0.4,
      _informationDensity: 0.3,
      _contextRelevance: 0.3,
    };

    return (
      _metrics.structuralIntegrity * _weights.structuralIntegrity +
      _metrics.informationDensity * _weights.informationDensity +
      metrics.contextRelevance * _weights.contextRelevance
    );
  }

  /**
   * Calculate detailed quality _metrics
   */
  private calculateQualityMetrics(
    _original: string,
    optimized: string,
  ): QualityMetrics {
    // Structural integrity: _preserved code structure
    const _originalStructure = this.extractStructuralElements(_original);
    const _optimizedStructure = this.extractStructuralElements(optimized);
    const _structuralIntegrity = this.compareStructures(
      _originalStructure,
      _optimizedStructure,
    );

    // Information density: information per token
    const _originalTokens = this.estimateTokens(_original);
    const _optimizedTokens = this.estimateTokens(optimized);
    const _informationDensity = Math.min(
      1,
      _optimizedTokens / (_originalTokens * 0.3),
    ); // Expect at least 30% compression

    // Context relevance: heuristic based on _preserved _content types
    const _contextRelevance = this.assessContextRelevance(optimized);

    return {
      _structuralIntegrity,
      _informationDensity,
      _contextRelevance,
      overallQuality:
        (_structuralIntegrity + _informationDensity + _contextRelevance) / 3,
    };
  }

  // Helper _methods for _content analysis
  private isCodeLine(line: string): boolean {
    return /^[\s]*(import|export|class|function|const|let|var|if|for|while|return|\w+\s*[=:({])/.test(
      line,
    );
  }

  private isCommentLine(line: string): boolean {
    return /^[\s]*(\/\/|\/\*|\*|#)/.test(line);
  }

  private isDocumentationLine(line: string): boolean {
    return /^[\s]*(@param|@return|@throws|@see|@example|\*\s+[A-Z])/.test(line);
  }

  private isMetadataLine(line: string): boolean {
    return /^[\s]*(package|import\s+type|interface|type\s+\w+\s*=)/.test(line);
  }

  private scoreCodeImportance(line: string): number {
    // Higher scores for key code elements
    if (/^[\s]*(export|public|async|function)/.test(line)) return 0.9;
    if (/^[\s]*(class|interface|type)/.test(line)) return 0.8;
    if (/^[\s]*(import|const|let|var)/.test(line)) return 0.6;
    if (/^[\s]*(if|for|while|try|catch)/.test(line)) return 0.7;
    return 0.5;
  }

  private scoreCommentImportance(line: string): number {
    if (/TODO|FIXME|BUG|IMPORTANT/i.test(line)) return 0.8;
    if (/^[\s]*\/\*\*/.test(line)) return 0.7; // JSDoc
    if (line.length > 50) return 0.4; // Longer comments often less critical
    return 0.3;
  }

  private createFunctionSummary(body: string): string {
    const _lines = body.split("\n").filter((line) => line.trim());
    const _keywords = ["return", "if", "for", "while", "try", "catch", "throw"];
    const _keywordCounts = _keywords
      .map((kw) => ({
        keyword: kw,
        count: (body.match(new RegExp(`\\b${kw}\\b`, "g")) || []).length,
      }))
      .filter((kc) => kc.count > 0);

    return (
      _keywordCounts.map((kc) => `${kc.count} ${kc.keyword}`).join(", ") ||
      "implementation details"
    );
  }

  private extractStructuralElements(_content: string): string[] {
    const elements: string[] = [];
    const _patterns = [
      /class\s+(\w+)/g,
      /function\s+(\w+)/g,
      /const\s+(\w+)/g,
      /interface\s+(\w+)/g,
      /type\s+(\w+)/g,
    ];

    for (const pattern of _patterns) {
      let match;
      while ((match = pattern.exec(_content)) !== null) {
        elements.push(match[1]);
      }
    }

    return elements;
  }

  private compareStructures(_original: string[], optimized: string[]): number {
    const _preserved = optimized.filter((el) => _original.includes(el)).length;
    return _original.length > 0 ? _preserved / _original.length : 1;
  }

  private assessContextRelevance(_content: string): number {
    // Heuristic: presence of key programming constructs
    const _relevantPatterns = [
      /\bfunction\b/g,
      /\bclass\b/g,
      /\bimport\b/g,
      /\bexport\b/g,
      /\breturn\b/g,
    ];

    let relevanceScore = 0;
    for (const pattern of _relevantPatterns) {
      const _matches = _content.match(pattern);
      relevanceScore += _matches ? Math.min(_matches.length / 10, 0.2) : 0;
    }

    return Math.min(relevanceScore, 1);
  }
}

// Singleton instance
let contextOptimizerInstance: ContextOptimizer | null = null;

export function getContextOptimizer(): ContextOptimizer {
  if (!contextOptimizerInstance) {
    contextOptimizerInstance = new ContextOptimizer();
  }
  return contextOptimizerInstance;
}
