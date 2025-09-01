/**
 * Organizing Mode Plugin - Structure and organization mode
 * Specialized for organizing information, creating hierarchies, and establishing order
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from "../BaseMode";

export default class OrganizingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: "organizing",
      name: "Organizing",
      category: "structural",
      symbol: "📊",
      color: "magenta",
      description: "整理・構造化モード - 情報の階層化と秩序の確立",
      keywords: [
        "organize",
        "structure",
        "arrange",
        "categorize",
        "classify",
        "sort",
        "group",
        "_hierarchy",
        "framework",
        "system",
      ],
      triggers: [
        "organize",
        "structure this",
        "arrange",
        "categorize",
        "sort by",
        "group together",
        "create _hierarchy",
        "framework",
      ],
      examples: [
        "Organize this information into _categories",
        "Create a structure for this project",
        "Arrange these _items by priority",
        "Categorize the different components",
        "Sort this data in a logical order",
      ],
      enabled: true,
      priority: 6,
      timeout: 90000, // 1.5 minutes
      maxConcurrentSessions: 10,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(
      `[${this.config.id}] Activating organizing mode for session ${context.sessionId}`,
    );

    this.emit("display:update", {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: "Organizing...",
      color: this.config.color,
      sessionId: context.sessionId,
    });

    this.emit("analytics:event", {
      type: "mode_activation",
      mode: this.config.id,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      metadata: {
        previousMode: context.previousMode,
        confidence: context.confidence,
      },
    });
  }

  protected async onDeactivate(sessionId: string): Promise<void> {
    console.log(
      `[${this.config.id}] Deactivating organizing mode for session ${sessionId}`,
    );

    this.emit("analytics:event", {
      type: "mode_deactivation",
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(
    _input: string,
    context: ModeContext,
  ): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing organization request: "${_input.substring(0, 50)}..."`,
    );

    // Organization process pipeline
    const _contentAnalysis = await this.analyzeContentStructure(
      _input,
      context,
    );
    const _organizationStrategy = await this.determineOrganizationStrategy(
      _input,
      _contentAnalysis,
    );
    const _hierarchy = await this.createHierarchy(
      _input,
      _organizationStrategy,
    );
    const _categories = await this.establishCategories(_input, _hierarchy);
    const _structuredOutput = await this.generateStructuredOutput(
      _input,
      _categories,
      _hierarchy,
    );

    const _suggestions = await this.generateOrganizationSuggestions(
      _input,
      _structuredOutput,
    );
    const _nextMode = await this.determineNextMode(_input, _structuredOutput);

    return {
      success: true,
      output: _structuredOutput,
      _suggestions,
      nextRecommendedMode: _nextMode,
      confidence: 0.87,
      metadata: {
        _contentAnalysis,
        _organizationStrategy,
        hierarchyDepth: this.calculateHierarchyDepth(_hierarchy),
        categoryCount: _categories.length,
        structuralComplexity: this.assessStructuralComplexity(_input),
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.3;

    const _inputLower = input.toLowerCase();

    // Direct organization keywords
    const _organizationKeywords = [
      "organize",
      "structure",
      "arrange",
      "categorize",
      "classify",
      "sort",
      "group",
      "_hierarchy",
      "framework",
      "order",
    ];

    const _orgMatches = _organizationKeywords.filter((keyword) =>
      _inputLower.includes(keyword),
    );
    if (_orgMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Organization keywords: ${_orgMatches.join(", ")}`);
    }

    // Organization phrases
    const _organizationPhrases = [
      "put in order",
      "make sense of",
      "break down",
      "divide into",
      "create structure",
      "establish _hierarchy",
      "sort by",
    ];

    const _phraseMatches = _organizationPhrases.filter((phrase) =>
      _inputLower.includes(phrase),
    );
    if (_phraseMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(`Organization phrases detected`);
    }

    // List or enumeration indicators
    const _listIndicators = [
      input.includes("\n-"),
      input.includes("\n*"),
      input.includes("\n1."),
      input.includes("first"),
      input.includes("second"),
      input.includes("third"),
    ];

    if (_listIndicators.some((_indicator) => _indicator)) {
      confidence += 0.2;
      reasoning.push("List structure detected - suggests organization need");
    }

    // Multiple _items or concepts
    const _conceptIndicators = [
      "_items",
      "elements",
      "components",
      "parts",
      "sections",
    ];
    const _conceptMatches = _conceptIndicators.filter((indicator) =>
      _inputLower.includes(indicator),
    );
    if (_conceptMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(
        `Multiple concept indicators: ${_conceptMatches.join(", ")}`,
      );
    }

    // Complexity suggests need for organization
    const _wordCount = input.split(/\s+/).length;
    if (_wordCount > 30) {
      confidence += 0.1;
      reasoning.push("Complex input suggests organization benefit");
    }

    // Context from previous modes
    if (context.previousMode === "researching") {
      confidence += 0.15;
      reasoning.push("Good follow-up to research - organizing findings");
    }

    if (context.previousMode === "brainstorming") {
      confidence += 0.2;
      reasoning.push("Natural progression from brainstorming to organization");
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze the structure of content to understand organization needs
   */
  private async analyzeContentStructure(
    _input: string,
    _context: ModeContext,
  ): Promise<unknown> {
    const _analysis = {
      contentType: this.identifyContentType(_input),
      _itemCount: this.countDistinctItems(_input),
      _complexity: this.assessContentComplexity(_input),
      existingStructure: this.detectExistingStructure(_input),
      relationships: this.identifyRelationships(_input),
      priority: this.detectPriorityIndicators(_input),
    };

    return _analysis;
  }

  /**
   * Determine the best organization strategy
   */
  private async determineOrganizationStrategy(
    _input: string,
    _analysis: unknown,
  ): Promise<string> {
    const _strategies = {
      hierarchical:
        "Create hierarchical structure with parent-child relationships",
      categorical: "Group _items into distinct _categories",
      chronological: "Organize by time or sequence",
      priority: "Arrange by importance or priority",
      alphabetical: "Sort alphabetically for easy reference",
      functional: "Group by function or purpose",
      _complexity: "Organize from simple to complex",
    };

    // Determine strategy based on content _analysis
    if (_analysis.priority.detected) {
      return "priority";
    }
    if (
      _analysis.contentType === "timeline" ||
      _input.toLowerCase().includes("time")
    ) {
      return "chronological";
    }
    if (_analysis.itemCount > 10) {
      return "categorical";
    }
    if (_analysis.complexity === "high") {
      return "hierarchical";
    }
    if (_input.toLowerCase().includes("alphabet")) {
      return "alphabetical";
    }

    return "categorical"; // Default strategy
  }

  /**
   * Create hierarchical structure
   */
  private async createHierarchy(
    _input: string,
    strategy: string,
  ): Promise<unknown> {
    const _hierarchy = {
      type: strategy,
      levels: this.determineLevels(_input, strategy),
      structure: this.buildHierarchicalStructure(_input, strategy),
    };

    return _hierarchy;
  }

  /**
   * Establish _categories for organization
   */
  private async establishCategories(
    _input: string,
    _hierarchy: unknown,
  ): Promise<unknown[]> {
    const _categories: unknown[] = [];

    // Extract _items from input
    const _items = this.extractItems(_input);

    // Create _categories based on strategy
    switch (_hierarchy.type) {
      case "priority":
        categories.push(
          {
            name: "High Priority",
            _items: _items.filter((_item) =>
              this.isPriorityItem(_item, "high"),
            ),
          },
          {
            name: "Medium Priority",
            _items: _items.filter((_item) =>
              this.isPriorityItem(_item, "medium"),
            ),
          },
          {
            name: "Low Priority",
            _items: _items.filter((_item) => this.isPriorityItem(_item, "low")),
          },
        );
        break;

      case "categorical":
        {
          const _detectedCategories = this.detectNaturalCategories(_items);
          categories.push(..._detectedCategories);
        }
        break;

      case "chronological":
        categories.push(
          {
            name: "Past",
            _items: _items.filter((_item) =>
              this.isTimeCategory(_item, "past"),
            ),
          },
          {
            name: "Present",
            _items: _items.filter((_item) =>
              this.isTimeCategory(_item, "present"),
            ),
          },
          {
            name: "Future",
            _items: _items.filter((_item) =>
              this.isTimeCategory(_item, "future"),
            ),
          },
        );
        break;

      default:
        categories.push({ name: "Items", _items });
    }

    return _categories.filter((cat) => cat._items.length > 0);
  }

  /**
   * Generate structured output
   */
  private async generateStructuredOutput(
    _input: string,
    _categories: unknown[],
    _hierarchy: unknown,
  ): Promise<string> {
    const output: string[] = [];

    output.push("Organization Structure");
    output.push("═".repeat(20));
    output.push("");
    output.push(
      `Strategy: ${_hierarchy.type.charAt(0).toUpperCase() + _hierarchy.type.slice(1)}`,
    );
    output.push(`Categories: ${categories.length}`);
    output.push("");

    // Generate categorized content
    for (const category of _categories) {
      output.push(`${category.name}:`);
      output.push("-".repeat(category.name.length + 1));

      category.items.forEach((_item: string, index: number) => {
        output.push(`${index + 1}. ${_item}`);
      });

      output.push("");
    }

    // Add organization metadata
    output.push("Organization Summary:");
    output.push(
      `• Total _items organized: ${categories.reduce((sum, cat) => sum + cat.items.length, 0)}`,
    );
    output.push(`• Categories created: ${categories.length}`);
    output.push(`• Structure type: ${_hierarchy.type}`);

    return output.join("\n");
  }

  /**
   * Generate organization-specific _suggestions
   */
  private async generateOrganizationSuggestions(
    input: string,
    _structuredOutput: string,
  ): Promise<string[]> {
    const _suggestions: string[] = [];

    suggestions.push("Review organization for logical consistency");

    if (this.hasComplexStructure(_structuredOutput)) {
      suggestions.push(
        "Consider creating sub-_categories for complex sections",
      );
    }

    if (this.hasPriorityItems(input)) {
      suggestions.push("Add priority levels or urgency indicators");
    }

    if (this.hasSequentialItems(input)) {
      suggestions.push("Consider adding sequence numbers or timeline");
    }

    return _suggestions.slice(0, 3);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(
    input: string,
    _structuredOutput: string,
  ): Promise<string | undefined> {
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("implement") || _inputLower.includes("execute")) {
      return "optimizing";
    }

    if (_inputLower.includes("analyze") || _inputLower.includes("review")) {
      return "analyzing";
    }

    if (_inputLower.includes("plan") || _inputLower.includes("strategy")) {
      return "planning";
    }

    return undefined;
  }

  // Helper methods
  private identifyContentType(input: string): string {
    const _inputLower = input.toLowerCase();

    if (_inputLower.includes("timeline") || _inputLower.includes("schedule")) {
      return "timeline";
    }
    if (_inputLower.includes("list") || _inputLower.includes("_items")) {
      return "list";
    }
    if (_inputLower.includes("project") || _inputLower.includes("task")) {
      return "project";
    }
    if (_inputLower.includes("data") || _inputLower.includes("information")) {
      return "data";
    }

    return "general";
  }

  private countDistinctItems(input: string): number {
    // Count distinct _items by looking for list patterns
    const _listPatterns = [
      input.match(/^\d+\./gm),
      input.match(/^[-*]/gm),
      input.split("\n").filter((line) => line.trim().length > 0),
    ];

    const _counts = _listPatterns.map((pattern) =>
      pattern ? pattern.length : 0,
    );
    return Math.max(..._counts, 1);
  }

  private assessContentComplexity(input: string): string {
    const _wordCount = input.split(/\s+/).length;
    const _lineCount = input.split("\n").length;

    if (_wordCount > 200 || _lineCount > 10) {
      return "high";
    }
    if (_wordCount > 100 || _lineCount > 5) {
      return "medium";
    }
    return "low";
  }

  private detectExistingStructure(input: string): unknown {
    return {
      hasNumberedList: /^\d+\./.test(input),
      hasBulletList: /^[-*]/.test(input),
      hasHeadings: /^#+/.test(input),
      hasParagraphs: input.includes("\n\n"),
    };
  }

  private identifyRelationships(input: string): string[] {
    const relationships: string[] = [];

    if (input.includes("depends on")) {
      relationships.push("dependency");
    }
    if (input.includes("related to")) {
      relationships.push("association");
    }
    if (input.includes("part of")) {
      relationships.push("composition");
    }
    if (input.includes("similar to")) {
      relationships.push("similarity");
    }

    return relationships;
  }

  private detectPriorityIndicators(input: string): unknown {
    const _inputLower = input.toLowerCase();

    return {
      detected: [
        "urgent",
        "important",
        "critical",
        "high",
        "low",
        "priority",
      ].some((word) => inputLower.includes(word)),
      indicators: ["urgent", "important", "critical"].filter((word) =>
        _inputLower.includes(word),
      ),
    };
  }

  private determineLevels(_input: string, strategy: string): number {
    const _complexity = this.assessContentComplexity(_input);

    if (strategy === "hierarchical") {
      if (_complexity === "high") {
        return 4;
      }
      if (_complexity === "medium") {
        return 3;
      }
      return 2;
    }

    return 2; // Default levels
  }

  private buildHierarchicalStructure(
    _input: string,
    _strategy: string,
  ): unknown {
    return {
      root: "Main Content",
      children: this.extractHierarchicalItems(_input),
    };
  }

  private extractHierarchicalItems(input: string): string[] {
    // Extract _items that could form a _hierarchy
    const _lines = input.split("\n").filter((line) => line.trim().length > 0);
    return _lines.slice(0, 10); // Limit for example
  }

  private extractItems(input: string): string[] {
    // Extract individual _items from various formats
    const _items: string[] = [];

    // Try numbered lists
    const _numberedMatches = input.match(/^\d+\.\s*(.+)$/gm);
    if (_numberedMatches) {
      items.push(
        ..._numberedMatches.map((match) => match.replace(/^\d+\.\s*/, "")),
      );
    }

    // Try bullet lists
    const _bulletMatches = input.match(/^[-*]\s*(.+)$/gm);
    if (_bulletMatches) {
      items.push(
        ..._bulletMatches.map((match) => match.replace(/^[-*]\s*/, "")),
      );
    }

    // If no lists found, split by _sentences
    if (_items.length === 0) {
      const _sentences = input
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 5);
      items.push(..._sentences.map((s) => s.trim()));
    }

    return _items.slice(0, 20); // Limit for processing
  }

  private isPriorityItem(_item: string, priority: string): boolean {
    const _itemLower = _item.toLowerCase();

    switch (priority) {
      case "high":
        return ["urgent", "critical", "important", "asap"].some((word) =>
          _itemLower.includes(word),
        );
      case "medium":
        return ["moderate", "normal", "standard"].some((word) =>
          _itemLower.includes(word),
        );
      case "low":
        return ["later", "optional", "nice to have"].some((word) =>
          _itemLower.includes(word),
        );
      default:
        return true; // Default to medium if no indicators
    }
  }

  private isTimeCategory(_item: string, timeCategory: string): boolean {
    const _itemLower = _item.toLowerCase();

    switch (timeCategory) {
      case "past":
        return ["was", "had", "completed", "finished"].some((word) =>
          _itemLower.includes(word),
        );
      case "present":
        return ["is", "are", "currently", "now"].some((word) =>
          _itemLower.includes(word),
        );
      case "future":
        return ["will", "plan", "future", "next", "upcoming"].some((word) =>
          itemLower.includes(word),
        );
      default:
        return true;
    }
  }

  private detectNaturalCategories(_items: string[]): unknown[] {
    // Simple category detection based on common patterns
    const _categories = [
      {
        name: "Technical",
        _items: items.filter((_item) => this.isTechnicalItem(_item)),
      },
      {
        name: "Business",
        _items: items.filter((_item) => this.isBusinessItem(_item)),
      },
      {
        name: "Process",
        _items: items.filter((_item) => this.isProcessItem(_item)),
      },
      {
        name: "General",
        _items: items.filter(
          (_item) =>
            !this.isTechnicalItem(_item) &&
            !this.isBusinessItem(_item) &&
            !this.isProcessItem(_item),
        ),
      },
    ];

    return _categories.filter((cat) => cat.items.length > 0);
  }

  private isTechnicalItem(_item: string): boolean {
    const _technicalTerms = [
      "code",
      "system",
      "api",
      "database",
      "server",
      "algorithm",
    ];
    return _technicalTerms.some((term) => _item.toLowerCase().includes(term));
  }

  private isBusinessItem(_item: string): boolean {
    const _businessTerms = [
      "revenue",
      "customer",
      "market",
      "strategy",
      "business",
      "sales",
    ];
    return _businessTerms.some((term) => _item.toLowerCase().includes(term));
  }

  private isProcessItem(_item: string): boolean {
    const _processTerms = [
      "process",
      "workflow",
      "procedure",
      "step",
      "method",
      "approach",
    ];
    return _processTerms.some((term) => _item.toLowerCase().includes(term));
  }

  private calculateHierarchyDepth(_hierarchy: unknown): number {
    return _hierarchy.levels || 2;
  }

  private assessStructuralComplexity(input: string): string {
    const _itemCount = this.countDistinctItems(input);

    if (_itemCount > 15) {
      return "high";
    }
    if (_itemCount > 8) {
      return "medium";
    }
    return "low";
  }

  private hasComplexStructure(output: string): boolean {
    return output.split("\n").length > 20;
  }

  private hasPriorityItems(input: string): boolean {
    return ["priority", "urgent", "important"].some((word) =>
      input.toLowerCase().includes(word),
    );
  }

  private hasSequentialItems(input: string): boolean {
    return ["step", "sequence", "order", "first", "second"].some((word) =>
      input.toLowerCase().includes(word),
    );
  }
}
