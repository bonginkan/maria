/**
 * Organizing Mode Plugin - Structure and organization mode
 * Specialized for organizing information, creating hierarchies, and establishing order
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class OrganizingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'organizing',
      name: 'Organizing',
      category: 'structural',
      symbol: '📊',
      color: 'magenta',
      description: '整理・構造化モード - 情報の階層化と秩序の確立',
      keywords: [
        'organize',
        'structure',
        'arrange',
        'categorize',
        'classify',
        'sort',
        'group',
        'hierarchy',
        'framework',
        'system',
      ],
      triggers: [
        'organize',
        'structure this',
        'arrange',
        'categorize',
        'sort by',
        'group together',
        'create hierarchy',
        'framework',
      ],
      examples: [
        'Organize this information into categories',
        'Create a structure for this project',
        'Arrange these items by priority',
        'Categorize the different components',
        'Sort this data in a logical order',
      ],
      enabled: true,
      priority: 6,
      timeout: 90000, // 1.5 minutes
      maxConcurrentSessions: 10,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating organizing mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Organizing...',
      color: this.config.color,
      sessionId: context.sessionId,
    });

    this.emit('analytics:event', {
      type: 'mode_activation',
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
    console.log(`[${this.config.id}] Deactivating organizing mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing organization request: "${input.substring(0, 50)}..."`,
    );

    // Organization process pipeline
    const contentAnalysis = await this.analyzeContentStructure(input, context);
    const organizationStrategy = await this.determineOrganizationStrategy(input, contentAnalysis);
    const hierarchy = await this.createHierarchy(input, organizationStrategy);
    const categories = await this.establishCategories(input, hierarchy);
    const structuredOutput = await this.generateStructuredOutput(input, categories, hierarchy);

    const suggestions = await this.generateOrganizationSuggestions(input, structuredOutput);
    const nextMode = await this.determineNextMode(input, structuredOutput);

    return {
      success: true,
      output: structuredOutput,
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.87,
      metadata: {
        contentAnalysis,
        organizationStrategy,
        hierarchyDepth: this.calculateHierarchyDepth(hierarchy),
        categoryCount: categories.length,
        structuralComplexity: this.assessStructuralComplexity(input),
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

    const inputLower = input.toLowerCase();

    // Direct organization keywords
    const organizationKeywords = [
      'organize',
      'structure',
      'arrange',
      'categorize',
      'classify',
      'sort',
      'group',
      'hierarchy',
      'framework',
      'order',
    ];

    const orgMatches = organizationKeywords.filter((keyword) => inputLower.includes(keyword));
    if (orgMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Organization keywords: ${orgMatches.join(', ')}`);
    }

    // Organization phrases
    const organizationPhrases = [
      'put in order',
      'make sense of',
      'break down',
      'divide into',
      'create structure',
      'establish hierarchy',
      'sort by',
    ];

    const phraseMatches = organizationPhrases.filter((phrase) => inputLower.includes(phrase));
    if (phraseMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(`Organization phrases detected`);
    }

    // List or enumeration indicators
    const listIndicators = [
      input.includes('\n-'),
      input.includes('\n*'),
      input.includes('\n1.'),
      input.includes('first'),
      input.includes('second'),
      input.includes('third'),
    ];

    if (listIndicators.some((indicator) => indicator)) {
      confidence += 0.2;
      reasoning.push('List structure detected - suggests organization need');
    }

    // Multiple items or concepts
    const conceptIndicators = ['items', 'elements', 'components', 'parts', 'sections'];
    const conceptMatches = conceptIndicators.filter((indicator) => inputLower.includes(indicator));
    if (conceptMatches.length > 0) {
      confidence += 0.15;
      reasoning.push(`Multiple concept indicators: ${conceptMatches.join(', ')}`);
    }

    // Complexity suggests need for organization
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 30) {
      confidence += 0.1;
      reasoning.push('Complex input suggests organization benefit');
    }

    // Context from previous modes
    if (context.previousMode === 'researching') {
      confidence += 0.15;
      reasoning.push('Good follow-up to research - organizing findings');
    }

    if (context.previousMode === 'brainstorming') {
      confidence += 0.2;
      reasoning.push('Natural progression from brainstorming to organization');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze the structure of content to understand organization needs
   */
  private async analyzeContentStructure(input: string, context: ModeContext): Promise<unknown> {
    const analysis = {
      contentType: this.identifyContentType(input),
      itemCount: this.countDistinctItems(input),
      complexity: this.assessContentComplexity(input),
      existingStructure: this.detectExistingStructure(input),
      relationships: this.identifyRelationships(input),
      priority: this.detectPriorityIndicators(input),
    };

    return analysis;
  }

  /**
   * Determine the best organization strategy
   */
  private async determineOrganizationStrategy(input: string, analysis: unknown): Promise<string> {
    const strategies = {
      hierarchical: 'Create hierarchical structure with parent-child relationships',
      categorical: 'Group items into distinct categories',
      chronological: 'Organize by time or sequence',
      priority: 'Arrange by importance or priority',
      alphabetical: 'Sort alphabetically for easy reference',
      functional: 'Group by function or purpose',
      complexity: 'Organize from simple to complex',
    };

    // Determine strategy based on content analysis
    if (analysis.priority.detected) {return 'priority';}
    if (analysis.contentType === 'timeline' || input.toLowerCase().includes('time'))
      {return 'chronological';}
    if (analysis.itemCount > 10) {return 'categorical';}
    if (analysis.complexity === 'high') {return 'hierarchical';}
    if (input.toLowerCase().includes('alphabet')) {return 'alphabetical';}

    return 'categorical'; // Default strategy
  }

  /**
   * Create hierarchical structure
   */
  private async createHierarchy(input: string, strategy: string): Promise<unknown> {
    const hierarchy = {
      type: strategy,
      levels: this.determineLevels(input, strategy),
      structure: this.buildHierarchicalStructure(input, strategy),
    };

    return hierarchy;
  }

  /**
   * Establish categories for organization
   */
  private async establishCategories(input: string, hierarchy: unknown): Promise<unknown[]> {
    const categories: unknown[] = [];

    // Extract items from input
    const items = this.extractItems(input);

    // Create categories based on strategy
    switch (hierarchy.type) {
      case 'priority':
        categories.push(
          {
            name: 'High Priority',
            items: items.filter((item) => this.isPriorityItem(item, 'high')),
          },
          {
            name: 'Medium Priority',
            items: items.filter((item) => this.isPriorityItem(item, 'medium')),
          },
          { name: 'Low Priority', items: items.filter((item) => this.isPriorityItem(item, 'low')) },
        );
        break;

      case 'categorical':
        const detectedCategories = this.detectNaturalCategories(items);
        categories.push(...detectedCategories);
        break;

      case 'chronological':
        categories.push(
          { name: 'Past', items: items.filter((item) => this.isTimeCategory(item, 'past')) },
          { name: 'Present', items: items.filter((item) => this.isTimeCategory(item, 'present')) },
          { name: 'Future', items: items.filter((item) => this.isTimeCategory(item, 'future')) },
        );
        break;

      default:
        categories.push({ name: 'Items', items });
    }

    return categories.filter((cat) => cat.items.length > 0);
  }

  /**
   * Generate structured output
   */
  private async generateStructuredOutput(
    input: string,
    categories: unknown[],
    hierarchy: unknown,
  ): Promise<string> {
    const output: string[] = [];

    output.push('Organization Structure');
    output.push('═'.repeat(20));
    output.push('');
    output.push(`Strategy: ${hierarchy.type.charAt(0).toUpperCase() + hierarchy.type.slice(1)}`);
    output.push(`Categories: ${categories.length}`);
    output.push('');

    // Generate categorized content
    for (const category of categories) {
      output.push(`${category.name}:`);
      output.push('-'.repeat(category.name.length + 1));

      category.items.forEach((item: string, index: number) => {
        output.push(`${index + 1}. ${item}`);
      });

      output.push('');
    }

    // Add organization metadata
    output.push('Organization Summary:');
    output.push(
      `• Total items organized: ${categories.reduce((sum, cat) => sum + cat.items.length, 0)}`,
    );
    output.push(`• Categories created: ${categories.length}`);
    output.push(`• Structure type: ${hierarchy.type}`);

    return output.join('\n');
  }

  /**
   * Generate organization-specific suggestions
   */
  private async generateOrganizationSuggestions(
    input: string,
    structuredOutput: string,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Review organization for logical consistency');

    if (this.hasComplexStructure(structuredOutput)) {
      suggestions.push('Consider creating sub-categories for complex sections');
    }

    if (this.hasPriorityItems(input)) {
      suggestions.push('Add priority levels or urgency indicators');
    }

    if (this.hasSequentialItems(input)) {
      suggestions.push('Consider adding sequence numbers or timeline');
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(
    input: string,
    structuredOutput: string,
  ): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('implement') || inputLower.includes('execute')) {
      return 'optimizing';
    }

    if (inputLower.includes('analyze') || inputLower.includes('review')) {
      return 'analyzing';
    }

    if (inputLower.includes('plan') || inputLower.includes('strategy')) {
      return 'planning';
    }

    return undefined;
  }

  // Helper methods
  private identifyContentType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('timeline') || inputLower.includes('schedule')) {return 'timeline';}
    if (inputLower.includes('list') || inputLower.includes('items')) {return 'list';}
    if (inputLower.includes('project') || inputLower.includes('task')) {return 'project';}
    if (inputLower.includes('data') || inputLower.includes('information')) {return 'data';}

    return 'general';
  }

  private countDistinctItems(input: string): number {
    // Count distinct items by looking for list patterns
    const listPatterns = [
      input.match(/^\d+\./gm),
      input.match(/^[-*]/gm),
      input.split('\n').filter((line) => line.trim().length > 0),
    ];

    const counts = listPatterns.map((pattern) => (pattern ? pattern.length : 0));
    return Math.max(...counts, 1);
  }

  private assessContentComplexity(input: string): string {
    const wordCount = input.split(/\s+/).length;
    const lineCount = input.split('\n').length;

    if (wordCount > 200 || lineCount > 10) {return 'high';}
    if (wordCount > 100 || lineCount > 5) {return 'medium';}
    return 'low';
  }

  private detectExistingStructure(input: string): unknown {
    return {
      hasNumberedList: /^\d+\./.test(input),
      hasBulletList: /^[-*]/.test(input),
      hasHeadings: /^#+/.test(input),
      hasParagraphs: input.includes('\n\n'),
    };
  }

  private identifyRelationships(input: string): string[] {
    const relationships: string[] = [];

    if (input.includes('depends on')) {relationships.push('dependency');}
    if (input.includes('related to')) {relationships.push('association');}
    if (input.includes('part of')) {relationships.push('composition');}
    if (input.includes('similar to')) {relationships.push('similarity');}

    return relationships;
  }

  private detectPriorityIndicators(input: string): unknown {
    const inputLower = input.toLowerCase();

    return {
      detected: ['urgent', 'important', 'critical', 'high', 'low', 'priority'].some((word) =>
        inputLower.includes(word),
      ),
      indicators: ['urgent', 'important', 'critical'].filter((word) => inputLower.includes(word)),
    };
  }

  private determineLevels(input: string, strategy: string): number {
    const complexity = this.assessContentComplexity(input);

    if (strategy === 'hierarchical') {
      if (complexity === 'high') {return 4;}
      if (complexity === 'medium') {return 3;}
      return 2;
    }

    return 2; // Default levels
  }

  private buildHierarchicalStructure(input: string, strategy: string): unknown {
    return {
      root: 'Main Content',
      children: this.extractHierarchicalItems(input),
    };
  }

  private extractHierarchicalItems(input: string): string[] {
    // Extract items that could form a hierarchy
    const lines = input.split('\n').filter((line) => line.trim().length > 0);
    return lines.slice(0, 10); // Limit for example
  }

  private extractItems(input: string): string[] {
    // Extract individual items from various formats
    const items: string[] = [];

    // Try numbered lists
    const numberedMatches = input.match(/^\d+\.\s*(.+)$/gm);
    if (numberedMatches) {
      items.push(...numberedMatches.map((match) => match.replace(/^\d+\.\s*/, '')));
    }

    // Try bullet lists
    const bulletMatches = input.match(/^[-*]\s*(.+)$/gm);
    if (bulletMatches) {
      items.push(...bulletMatches.map((match) => match.replace(/^[-*]\s*/, '')));
    }

    // If no lists found, split by sentences
    if (items.length === 0) {
      const sentences = input.split(/[.!?]+/).filter((s) => s.trim().length > 5);
      items.push(...sentences.map((s) => s.trim()));
    }

    return items.slice(0, 20); // Limit for processing
  }

  private isPriorityItem(item: string, priority: string): boolean {
    const itemLower = item.toLowerCase();

    switch (priority) {
      case 'high':
        return ['urgent', 'critical', 'important', 'asap'].some((word) => itemLower.includes(word));
      case 'medium':
        return ['moderate', 'normal', 'standard'].some((word) => itemLower.includes(word));
      case 'low':
        return ['later', 'optional', 'nice to have'].some((word) => itemLower.includes(word));
      default:
        return true; // Default to medium if no indicators
    }
  }

  private isTimeCategory(item: string, timeCategory: string): boolean {
    const itemLower = item.toLowerCase();

    switch (timeCategory) {
      case 'past':
        return ['was', 'had', 'completed', 'finished'].some((word) => itemLower.includes(word));
      case 'present':
        return ['is', 'are', 'currently', 'now'].some((word) => itemLower.includes(word));
      case 'future':
        return ['will', 'plan', 'future', 'next', 'upcoming'].some((word) =>
          itemLower.includes(word),
        );
      default:
        return true;
    }
  }

  private detectNaturalCategories(items: string[]): unknown[] {
    // Simple category detection based on common patterns
    const categories = [
      { name: 'Technical', items: items.filter((item) => this.isTechnicalItem(item)) },
      { name: 'Business', items: items.filter((item) => this.isBusinessItem(item)) },
      { name: 'Process', items: items.filter((item) => this.isProcessItem(item)) },
      {
        name: 'General',
        items: items.filter(
          (item) =>
            !this.isTechnicalItem(item) && !this.isBusinessItem(item) && !this.isProcessItem(item),
        ),
      },
    ];

    return categories.filter((cat) => cat.items.length > 0);
  }

  private isTechnicalItem(item: string): boolean {
    const technicalTerms = ['code', 'system', 'api', 'database', 'server', 'algorithm'];
    return technicalTerms.some((term) => item.toLowerCase().includes(term));
  }

  private isBusinessItem(item: string): boolean {
    const businessTerms = ['revenue', 'customer', 'market', 'strategy', 'business', 'sales'];
    return businessTerms.some((term) => item.toLowerCase().includes(term));
  }

  private isProcessItem(item: string): boolean {
    const processTerms = ['process', 'workflow', 'procedure', 'step', 'method', 'approach'];
    return processTerms.some((term) => item.toLowerCase().includes(term));
  }

  private calculateHierarchyDepth(hierarchy: unknown): number {
    return hierarchy.levels || 2;
  }

  private assessStructuralComplexity(input: string): string {
    const itemCount = this.countDistinctItems(input);

    if (itemCount > 15) {return 'high';}
    if (itemCount > 8) {return 'medium';}
    return 'low';
  }

  private hasComplexStructure(output: string): boolean {
    return output.split('\n').length > 20;
  }

  private hasPriorityItems(input: string): boolean {
    return ['priority', 'urgent', 'important'].some((word) => input.toLowerCase().includes(word));
  }

  private hasSequentialItems(input: string): boolean {
    return ['step', 'sequence', 'order', 'first', 'second'].some((word) =>
      input.toLowerCase().includes(word),
    );
  }
}
