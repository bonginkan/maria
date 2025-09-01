/**
 * Intelligent Referential Detection System
 * Resolves references like "これ", "それ", "save this", "上記" with high accuracy
 */

import { ConversationContext, ReferenceTarget } from "./TurnManager";

export interface ResolvedReference {
  type:
    | "referential"
    | "save_action"
    | "content_specific"
    | "context_continuation";
  _target: ReferenceTarget;
  confidence: number;
  reasoning?: string;
}

export interface ReferencePattern {
  pattern: RegExp;
  type: ResolvedReference["type"];
  confidence: number;
  extractor?: (
    _input: string,
    context: ConversationContext,
  ) => ReferenceTarget | null;
}

export class ReferentialResolver {
  private static instance: ReferentialResolver;
  private referencePatterns: ReferencePattern[];

  private constructor() {
    this.initializePatterns();
  }

  public static getInstance(): ReferentialResolver {
    if (!ReferentialResolver.instance) {
      ReferentialResolver.instance = new ReferentialResolver();
    }
    return ReferentialResolver.instance;
  }

  /**
   * Detect and resolve references in user input
   */
  public detectReferences(
    _input: string,
    context: ConversationContext,
  ): ResolvedReference[] {
    const references: ResolvedReference[] = [];

    // Pattern-based detection
    for (const pattern of this.referencePatterns) {
      if (pattern.pattern.test(_input)) {
        const _target = pattern.extractor
          ? pattern.extractor(_input, context)
          : this.findMostRecentTarget(context);

        if (_target) {
          references.push({
            type: pattern.type,
            _target,
            confidence: pattern.confidence,
            reasoning: this.explainReference(_input, pattern.type, _target),
          });
        }
      }
    }

    // Context-based detection (fallback)
    if (references.length === 0) {
      const _contextRef = this.detectContextualReferences(_input, context);
      if (_contextRef) {
        references.push(_contextRef);
      }
    }

    // Remove duplicates and sort by confidence
    return this.deduplicateReferences(references).sort(
      (a, b) => b.confidence - a.confidence,
    );
  }

  /**
   * Extract save targets from user input with intelligent _filename detection
   */
  public extractSaveTarget(
    _input: string,
    context: ConversationContext,
  ): {
    _target: ReferenceTarget | null;
    _filename?: string;
    confidence: number;
  } {
    const _savePatterns = [
      /(保存|save|store|write|export)(して|ください|it|this|that)/i,
      /ファイルに(書き|保存|出力)/i,
      /ルートに保存/i,
      /(として|as|called|named)\s+([^\s]+(?:\.[^\s]+)?)/i,
    ];

    const _isSaveRequest = _savePatterns.some((pattern) =>
      pattern.test(_input),
    );
    if (!_isSaveRequest) {
      return { _target: null, confidence: 0 };
    }

    // Extract _filename if specified
    const _filename = this.extractFilename(_input);

    // Find _target _content
    let _target: ReferenceTarget | null = null;
    let confidence = 0.8;

    // Priority 1: Last generated _content
    if (context.lastGeneratedContent) {
      _target = {
        id: "last_generated_content",
        type: "generated_content",
        _content: context.lastGeneratedContent.content,
        metadata: {
          contentType: context.lastGeneratedContent.type,
          suggestedFilename:
            _filename || context.lastGeneratedContent.suggestedFilename,
          fileExtension: this.inferFileExtension(
            context.lastGeneratedContent.content,
          ),
          createdAt: Date.now(),
        },
      };
      confidence = 0.95;
    }
    // Priority 2: Most recent AI output
    else if (context.referenceTargets.length > 0) {
      const _mostRecent = context.referenceTargets
        .filter((ref) => ref.type === "ai_output")
        .sort((a, b) => b.metadata.createdAt - a.metadata.createdAt)[0];

      if (_mostRecent) {
        _target = {
          ..._mostRecent,
          metadata: {
            ..._mostRecent.metadata,
            suggestedFilename:
              _filename ||
              _mostRecent.metadata.suggestedFilename ||
              this.suggestFilename(_mostRecent.content),
          },
        };
        confidence = 0.85;
      }
    }

    return { _target, _filename, confidence };
  }

  /**
   * Resolve "continuation" type references (続き, more, etc.)
   */
  public detectContinuation(
    _input: string,
    context: ConversationContext,
  ): ResolvedReference | null {
    const _continuationPatterns = [
      /(続き|continue|more|詳しく|detail|expand)/i,
      /(もっと|further|additional)/i,
      /(完成|complete|finish)/i,
    ];

    if (!_continuationPatterns.some((pattern) => pattern.test(_input))) {
      return null;
    }

    // Find the most recent incomplete or expandable _content
    const _target = this.findContinuationTarget(context);
    if (!_target) return null;

    return {
      type: "context_continuation",
      _target,
      confidence: 0.9,
      reasoning: "User requested continuation of previous _content",
    };
  }

  /**
   * Initialize reference detection patterns
   */
  private initializePatterns(): void {
    this.referencePatterns = [
      // Direct referential words (highest confidence)
      {
        pattern: /^(これ|それ|上記|the above|that|this|it)を?/i,
        type: "referential",
        confidence: 0.95,
      },

      // Temporal references
      {
        pattern: /(先ほどの|前の|直前の|last|previous|earlier|さっき)/i,
        type: "referential",
        confidence: 0.9,
      },

      // Save action patterns
      {
        pattern: /(保存|save|store|write|export)(して|ください|it|this|that)/i,
        type: "save_action",
        confidence: 0.95,
        extractor: (_input, context) =>
          this.extractSaveTarget(_input, context).target,
      },

      // File operation patterns
      {
        pattern: /ファイルに(書き|保存|出力)|ルートに保存/i,
        type: "save_action",
        confidence: 0.9,
        extractor: (_input, context) =>
          this.extractSaveTarget(_input, context).target,
      },

      // Generated _content references
      {
        pattern:
          /(生成した|作った|created|generated|made)(もの|コード|ファイル)/i,
        type: "content_specific",
        confidence: 0.85,
        extractor: (_input, context) =>
          context.lastGeneratedContent
            ? {
                id: "last_generated_content",
                type: "generated_content",
                _content: context.lastGeneratedContent.content,
                metadata: {
                  contentType: context.lastGeneratedContent.type,
                  suggestedFilename:
                    context.lastGeneratedContent.suggestedFilename,
                  createdAt: Date.now(),
                },
              }
            : null,
      },

      // Modification requests
      {
        pattern: /(修正|変更|update|modify|change)(して|ください)/i,
        type: "referential",
        confidence: 0.8,
      },

      // Content-specific patterns
      {
        pattern: /(コード|code|HTML|JavaScript|TypeScript|テトリス|tetris)/i,
        type: "content_specific",
        confidence: 0.7,
        extractor: (_input, context) =>
          this.findContentSpecificTarget(_input, context),
      },
    ];
  }

  /**
   * Find most recent _target in context
   */
  private findMostRecentTarget(
    context: ConversationContext,
  ): ReferenceTarget | null {
    if (context.lastGeneratedContent) {
      return {
        id: "last_generated_content",
        type: "generated_content",
        _content: context.lastGeneratedContent.content,
        metadata: {
          contentType: context.lastGeneratedContent.type,
          suggestedFilename: context.lastGeneratedContent.suggestedFilename,
          fileExtension: this.inferFileExtension(
            context.lastGeneratedContent.content,
          ),
          createdAt: Date.now(),
        },
      };
    }

    if (context.referenceTargets.length > 0) {
      return context.referenceTargets.sort(
        (a, b) => b.metadata.createdAt - a.metadata.createdAt,
      )[0];
    }

    return null;
  }

  /**
   * Detect contextual references when patterns don't match
   */
  private detectContextualReferences(
    _input: string,
    context: ConversationContext,
  ): ResolvedReference | null {
    // Short requests often reference previous context
    if (_input.length < 50 && context.lastGeneratedContent) {
      const _actionVerbs =
        /(して|ください|please|can you|デプロイ|deploy|実行|run)/i;
      if (_actionVerbs.test(_input)) {
        return {
          type: "referential",
          _target: {
            id: "contextual_reference",
            type: "generated_content",
            _content: context.lastGeneratedContent.content,
            metadata: {
              contentType: context.lastGeneratedContent.type,
              suggestedFilename: context.lastGeneratedContent.suggestedFilename,
              createdAt: Date.now(),
            },
          },
          confidence: 0.7,
          reasoning: "Short action request following _content generation",
        };
      }
    }

    return null;
  }

  /**
   * Find continuation _target (incomplete or expandable _content)
   */
  private findContinuationTarget(
    context: ConversationContext,
  ): ReferenceTarget | null {
    if (context.lastGeneratedContent) {
      const _content = context.lastGeneratedContent._content;

      // Check if _content appears incomplete
      const _isIncomplete =
        _content.includes("...") ||
        _content.includes("TODO") ||
        _content.includes("// More implementation needed") ||
        content.length < 500; // Very short _content might need expansion

      if (_isIncomplete) {
        return {
          id: "continuation_target",
          type: "generated_content",
          _content,
          metadata: {
            contentType: context.lastGeneratedContent.type,
            suggestedFilename: context.lastGeneratedContent.suggestedFilename,
            createdAt: Date.now(),
          },
        };
      }
    }

    return null;
  }

  /**
   * Find _content-specific targets based on _keywords
   */
  private findContentSpecificTarget(
    _input: string,
    context: ConversationContext,
  ): ReferenceTarget | null {
    const _keywords = _input.toLowerCase();

    // Look for matching _content in reference targets
    for (const _target of context.referenceTargets) {
      const _targetContent = _target._content.toLowerCase();

      if (_keywords.includes("html") && _targetContent.includes("html"))
        return _target;
      if (
        _keywords.includes("javascript") &&
        _targetContent.includes("javascript")
      )
        return _target;
      if (
        _keywords.includes("typescript") &&
        _targetContent.includes("typescript")
      )
        return _target;
      if (_keywords.includes("テトリス") && _targetContent.includes("tetris"))
        return _target;
      if (_keywords.includes("tetris") && _targetContent.includes("tetris"))
        return _target;
    }

    // Check last generated _content
    if (context.lastGeneratedContent) {
      const _content = context.lastGeneratedContent._content.toLowerCase();

      if (
        (_keywords.includes("html") && _content.includes("html")) ||
        (_keywords.includes("code") &&
          context.lastGeneratedContent.type === "code") ||
        (_keywords.includes("テトリス") && _content.includes("tetris"))
      ) {
        return {
          id: "content_specific_match",
          type: "generated_content",
          _content: context.lastGeneratedContent._content,
          metadata: {
            contentType: context.lastGeneratedContent.type,
            suggestedFilename: context.lastGeneratedContent.suggestedFilename,
            createdAt: Date.now(),
          },
        };
      }
    }

    return null;
  }

  /**
   * Extract _filename from user input
   */
  private extractFilename(input: string): string | undefined {
    // Pattern 1: として/as pattern
    const _asPattern = _input.match(
      /(?:として|as|called|named)\s+([^\s]+(?:\.[^\s]+)?)/i,
    );
    if (_asPattern) {
      return _asPattern[1];
    }

    // Pattern 2: Quoted _filename
    const _quotedPattern = _input.match(/[「"'](.*?)[」"']/);
    if (_quotedPattern) {
      return _quotedPattern[1];
    }

    // Pattern 3: Direct _filename mention
    const _filenamePattern = _input.match(/\b([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)\b/);
    if (_filenamePattern) {
      return _filenamePattern[1];
    }

    return undefined;
  }

  /**
   * Infer file extension from _content
   */
  private inferFileExtension(_content: string): string {
    if (_content.includes("<!DOCTYPE html") || _content.includes("<html"))
      return ".html";
    if (_content.includes("```typescript") || _content.includes("interface "))
      return ".ts";
    if (_content.includes("```javascript") || _content.includes("function "))
      return ".js";
    if (_content.includes("```markdown") || _content.startsWith("#"))
      return ".md";
    if (_content.includes("SELECT ") || _content.includes("CREATE TABLE"))
      return ".sql";
    if (_content.includes("```python") || _content.includes("def "))
      return ".py";
    if (_content.includes("Statement of Work") || _content.includes("SOW"))
      return ".md";
    return ".txt";
  }

  /**
   * Suggest _filename based on _content
   */
  private suggestFilename(_content: string): string {
    if (_content.includes("<!DOCTYPE html") || _content.includes("<html")) {
      return _content.toLowerCase().includes("tetris")
        ? "tetris.html"
        : "index.html";
    }

    if (_content.includes("Statement of Work") || _content.includes("SOW")) {
      return "project_sow.md";
    }

    if (_content.includes("```typescript")) return "component.ts";
    if (_content.includes("```javascript")) return "script.js";
    if (_content.includes("```markdown")) return "README.md";

    return "output.txt";
  }

  /**
   * Remove duplicate references
   */
  private deduplicateReferences(
    references: ResolvedReference[],
  ): ResolvedReference[] {
    const _seen = new Set<string>();
    return references.filter((ref) => {
      const _key = `${ref.type}_${ref.target.id}`;
      if (_seen.has(_key)) {
        return false;
      }
      seen.add(_key);
      return true;
    });
  }

  /**
   * Generate explanation for why a reference was detected
   */
  private explainReference(
    _input: string,
    type: ResolvedReference["type"],
    _target: ReferenceTarget,
  ): string {
    switch (type) {
      case "referential":
        return "Direct referential expression detected (これ、それ、this, that, etc.)";
      case "save_action":
        return "Save action detected with reference to generated _content";
      case "content_specific":
        return "Content-specific keyword match found";
      case "context_continuation":
        return "Continuation request for previous _content";
      default:
        return "Reference detected based on conversational context";
    }
  }

  /**
   * Public utility methods
   */
  public _isSaveRequest(input: string): boolean {
    const _savePatterns = [
      /(保存|save|store|write|export)(して|ください|it|this|that)/i,
      /ファイルに(書き|保存|出力)/i,
      /ルートに保存/i,
    ];
    return _savePatterns.some((pattern) => pattern.test(_input));
  }

  public isModificationRequest(input: string): boolean {
    const _modificationPatterns = [
      /(修正|変更|update|modify|change)(して|ください)/i,
      /(追加|add|include)(して|ください)/i,
      /(削除|remove|delete)(して|ください)/i,
    ];
    return _modificationPatterns.some((pattern) => pattern.test(_input));
  }

  public isContinuationRequest(input: string): boolean {
    const _continuationPatterns = [
      /(続き|continue|more|詳しく|detail|expand)/i,
      /(もっと|further|additional)/i,
      /(完成|complete|finish)/i,
    ];
    return _continuationPatterns.some((pattern) => pattern.test(_input));
  }
}
