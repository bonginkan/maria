/**
 * Summarizing Mode Plugin - Information synthesis and condensation mode
 * Specialized for creating concise, structured summaries from complex information
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class SummarizingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'summarizing',
      name: 'Summarizing',
      category: 'analytical',
      symbol: '📋',
      color: 'cyan',
      description: '要約・統合モード - 複雑な情報を簡潔に構造化',
      keywords: [
        'summarize',
        'summary',
        'brief',
        'overview',
        'main points',
        'key findings',
        'digest',
        'abstract',
        'condensed',
        'synopsis',
      ],
      triggers: [
        'summarize',
        'give me a summary',
        'main points',
        'overview',
        'brief explanation',
        'key takeaways',
        'digest',
        'in summary',
      ],
      examples: [
        'Summarize this document for me',
        'Give me the main points of this discussion',
        'Create a brief overview of the findings',
        'What are the key takeaways?',
        'Provide a condensed version of this information',
      ],
      enabled: true,
      priority: 8,
      timeout: 90000, // 1.5 minutes
      maxConcurrentSessions: 12,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating summarizing mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Summarizing...',
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
    console.log(`[${this.config.id}] Deactivating summarizing mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing summarization request: "${input.substring(0, 50)}..."`,
    );

    // Summarization process pipeline
    const contentAnalysis = await this.analyzeContent(input, context);
    const keyPoints = await this.extractKeyPoints(input, contentAnalysis);
    const structure = await this.determineSummaryStructure(input, keyPoints);
    const summary = await this.generateSummary(input, keyPoints, structure);
    const metadata = await this.generateSummaryMetadata(input, summary);

    const suggestions = await this.generateSummarySuggestions(input, summary);
    const nextMode = await this.determineNextMode(input, summary);

    return {
      success: true,
      output: summary,
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.88,
      metadata: {
        contentAnalysis,
        keyPointsCount: keyPoints.length,
        summaryStructure: structure,
        compressionRatio: this.calculateCompressionRatio(input, summary),
        readabilityScore: this.calculateReadabilityScore(summary),
        processedAt: Date.now(),
        ...metadata,
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.2;

    const inputLower = input.toLowerCase();

    // Direct summarization requests
    const summaryKeywords = [
      'summarize',
      'summary',
      'brief',
      'overview',
      'main points',
      'key takeaways',
      'digest',
      'abstract',
      'condensed',
      'synopsis',
    ];

    const summaryMatches = summaryKeywords.filter((keyword) => inputLower.includes(keyword));
    if (summaryMatches.length > 0) {
      confidence += 0.5;
      reasoning.push(`Direct summarization keywords: ${summaryMatches.join(', ')}`);
    }

    // Phrases that suggest summarization
    const summaryPhrases = [
      'give me the main',
      'what are the key',
      'in a nutshell',
      'bottom line',
      'to sum up',
      'in summary',
      'key findings',
    ];

    const phraseMatches = summaryPhrases.filter((phrase) => inputLower.includes(phrase));
    if (phraseMatches.length > 0) {
      confidence += 0.3;
      reasoning.push(`Summarization phrases detected: ${phraseMatches.length} matches`);
    }

    // Long input suggests need for summary
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 50) {
      confidence += 0.2;
      reasoning.push('Long input suggests summarization need');
    }

    // Multiple sentences/paragraphs
    const sentenceCount = input.split(/[.!?]+/).length;
    if (sentenceCount > 3) {
      confidence += 0.15;
      reasoning.push('Multiple sentences suggest summary opportunity');
    }

    // Context from previous modes
    if (context.previousMode === 'researching') {
      confidence += 0.2;
      reasoning.push('Good follow-up to research mode');
    }

    if (context.previousMode === 'analyzing') {
      confidence += 0.15;
      reasoning.push('Natural progression from analysis');
    }

    // Information density indicators
    const densityIndicators = ['data', 'results', 'findings', 'report', 'document'];
    const densityMatches = densityIndicators.filter((indicator) => inputLower.includes(indicator));
    if (densityMatches.length > 0) {
      confidence += Math.min(0.2, densityMatches.length * 0.1);
      reasoning.push(`Information density indicators: ${densityMatches.join(', ')}`);
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze content structure and complexity
   */
  private async analyzeContent(input: string, context: ModeContext): Promise<unknown> {
    const analysis = {
      length: input.length,
      wordCount: input.split(/\s+/).length,
      sentenceCount: input.split(/[.!?]+/).filter((s) => s.trim().length > 0).length,
      paragraphCount: input.split(/\n\s*\n/).length,
      complexity: this.assessContentComplexity(input),
      topic: this.identifyMainTopic(input),
      contentType: this.classifyContentType(input),
      structuralElements: this.identifyStructuralElements(input),
    };

    return analysis;
  }

  /**
   * Extract key points from content
   */
  private async extractKeyPoints(input: string, analysis: unknown): Promise<string[]> {
    const keyPoints: string[] = [];

    // Extract sentences that likely contain key information
    const sentences = input.split(/[.!?]+/).filter((s) => s.trim().length > 10);

    for (const sentence of sentences) {
      const importance = this.calculateSentenceImportance(sentence.trim(), input);
      if (importance > 0.6) {
        keyPoints.push(sentence.trim());
      }
    }

    // Ensure we have at least a few key points
    if (keyPoints.length < 3 && sentences.length >= 3) {
      const topSentences = sentences
        .map((s) => ({
          text: s.trim(),
          importance: this.calculateSentenceImportance(s.trim(), input),
        }))
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 3)
        .map((s) => s.text);

      keyPoints.push(...topSentences.filter((s) => !keyPoints.includes(s)));
    }

    return keyPoints;
  }

  /**
   * Determine the best structure for the summary
   */
  private async determineSummaryStructure(input: string, keyPoints: string[]): Promise<string> {
    const wordCount = input.split(/\s+/).length;

    if (wordCount < 50) {return 'brief';}
    if (wordCount < 200) {return 'structured';}
    if (wordCount < 500) {return 'detailed';}
    return 'comprehensive';
  }

  /**
   * Generate the actual summary
   */
  private async generateSummary(
    input: string,
    keyPoints: string[],
    structure: string,
  ): Promise<string> {
    const topic = this.identifyMainTopic(input);
    const wordCount = input.split(/\s+/).length;

    let summary: string[] = [];

    switch (structure) {
      case 'brief':
        summary = this.generateBriefSummary(input, keyPoints, topic);
        break;
      case 'structured':
        summary = this.generateStructuredSummary(input, keyPoints, topic);
        break;
      case 'detailed':
        summary = this.generateDetailedSummary(input, keyPoints, topic);
        break;
      case 'comprehensive':
        summary = this.generateComprehensiveSummary(input, keyPoints, topic);
        break;
    }

    return summary.join('\n');
  }

  /**
   * Generate brief summary (1-2 sentences)
   */
  private generateBriefSummary(input: string, keyPoints: string[], topic: string): string[] {
    return [`Summary: ${topic}`, '', `${keyPoints[0] || 'Main point extracted from the content.'}`];
  }

  /**
   * Generate structured summary (bullet points)
   */
  private generateStructuredSummary(input: string, keyPoints: string[], topic: string): string[] {
    const summary = [`Summary: ${topic}`, '='.repeat(20), '', 'Key Points:'];

    keyPoints.slice(0, 5).forEach((point, index) => {
      summary.push(`${index + 1}. ${point}`);
    });

    return summary;
  }

  /**
   * Generate detailed summary (paragraphs with sections)
   */
  private generateDetailedSummary(input: string, keyPoints: string[], topic: string): string[] {
    const summary = [
      `Detailed Summary: ${topic}`,
      '='.repeat(30),
      '',
      'Overview:',
      this.generateOverview(input, keyPoints),
      '',
      'Key Findings:',
      ...keyPoints.slice(0, 4).map((point, index) => `• ${point}`),
      '',
      'Conclusion:',
      this.generateConclusion(input, keyPoints),
    ];

    return summary;
  }

  /**
   * Generate comprehensive summary (full structure)
   */
  private generateComprehensiveSummary(
    input: string,
    keyPoints: string[],
    topic: string,
  ): string[] {
    const summary = [
      `Comprehensive Summary: ${topic}`,
      '='.repeat(40),
      '',
      'Executive Summary:',
      this.generateExecutiveSummary(input, keyPoints),
      '',
      'Main Points:',
      ...keyPoints.slice(0, 6).map((point, index) => `${index + 1}. ${point}`),
      '',
      'Analysis:',
      this.generateAnalysis(input, keyPoints),
      '',
      'Implications:',
      this.generateImplications(input, keyPoints),
      '',
      'Recommendations:',
      ...this.generateRecommendations(input, keyPoints),
    ];

    return summary;
  }

  /**
   * Generate summary-specific suggestions
   */
  private async generateSummarySuggestions(input: string, summary: string): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Review summary for accuracy and completeness');

    if (this.isLongContent(input)) {
      suggestions.push('Consider creating different summary lengths');
    }

    if (this.hasTechnicalContent(input)) {
      suggestions.push('Verify technical accuracy of summary');
    }

    if (this.hasActionableItems(input)) {
      suggestions.push('Extract action items for follow-up');
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(input: string, summary: string): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('action') || inputLower.includes('implement')) {
      return 'optimizing';
    }

    if (inputLower.includes('detail') || inputLower.includes('analyze')) {
      return 'analyzing';
    }

    if (inputLower.includes('question') || inputLower.includes('unclear')) {
      return 'thinking';
    }

    return undefined;
  }

  // Helper methods
  private assessContentComplexity(input: string): string {
    const avgWordsPerSentence = input.split(/\s+/).length / input.split(/[.!?]+/).length;

    if (avgWordsPerSentence < 10) {return 'simple';}
    if (avgWordsPerSentence < 20) {return 'moderate';}
    return 'complex';
  }

  private identifyMainTopic(input: string): string {
    // Simple topic extraction - in a real implementation, this would be more sophisticated
    const words = input.toLowerCase().split(/\s+/);
    const commonWords = new Set([
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
    ]);
    const significantWords = words.filter((word) => word.length > 3 && !commonWords.has(word));

    return significantWords.slice(0, 3).join(' ') || 'General Topic';
  }

  private classifyContentType(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('research') || inputLower.includes('study')) {return 'research';}
    if (inputLower.includes('report') || inputLower.includes('analysis')) {return 'report';}
    if (inputLower.includes('discussion') || inputLower.includes('meeting')) {return 'discussion';}
    if (inputLower.includes('document') || inputLower.includes('article')) {return 'document';}

    return 'general';
  }

  private identifyStructuralElements(input: string): string[] {
    const elements: string[] = [];

    if (input.includes('\n\n')) {elements.push('paragraphs');}
    if (input.match(/^\d+\./m)) {elements.push('numbered_list');}
    if (input.match(/^[-*]/m)) {elements.push('bullet_list');}
    if (input.match(/^#+/m)) {elements.push('headings');}

    return elements;
  }

  private calculateSentenceImportance(sentence: string, fullText: string): number {
    let importance = 0.5; // Base importance

    // Length factor
    const words = sentence.split(/\s+/).length;
    if (words > 5 && words < 25) {importance += 0.1;}

    // Position factor (first and last sentences are often important)
    const sentences = fullText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const position = sentences.findIndex((s) => s.trim() === sentence);
    if (position === 0 || position === sentences.length - 1) {importance += 0.2;}

    // Keyword density
    const keywordIndicators = ['important', 'key', 'main', 'significant', 'crucial', 'essential'];
    const hasKeywords = keywordIndicators.some((keyword) =>
      sentence.toLowerCase().includes(keyword),
    );
    if (hasKeywords) {importance += 0.2;}

    return Math.min(importance, 1.0);
  }

  private calculateCompressionRatio(original: string, summary: string): number {
    return summary.length / original.length;
  }

  private calculateReadabilityScore(text: string): number {
    // Simplified readability calculation
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    const avgWordsPerSentence = words / sentences;

    // Lower numbers = more readable
    if (avgWordsPerSentence < 15) {return 0.9;}
    if (avgWordsPerSentence < 25) {return 0.7;}
    return 0.5;
  }

  private generateSummaryMetadata(input: string, summary: string): unknown {
    return {
      originalLength: input.length,
      summaryLength: summary.length,
      compressionRatio: this.calculateCompressionRatio(input, summary),
      summaryType: this.classifyContentType(input),
      structuralComplexity: this.assessContentComplexity(input),
    };
  }

  private generateOverview(input: string, keyPoints: string[]): string {
    return `This content covers ${this.identifyMainTopic(input)} with ${keyPoints.length} key points identified.`;
  }

  private generateConclusion(input: string, keyPoints: string[]): string {
    return 'The analysis provides comprehensive insights that can inform decision-making and next steps.';
  }

  private generateExecutiveSummary(input: string, keyPoints: string[]): string {
    return `Executive overview of ${this.identifyMainTopic(input)} highlighting critical findings and implications.`;
  }

  private generateAnalysis(input: string, keyPoints: string[]): string {
    return 'Detailed analysis reveals patterns and relationships that support the main conclusions.';
  }

  private generateImplications(input: string, keyPoints: string[]): string {
    return 'The findings have significant implications for strategy, implementation, and future planning.';
  }

  private generateRecommendations(input: string, keyPoints: string[]): string[] {
    return [
      '• Review and validate key findings',
      '• Develop action plan based on insights',
      '• Monitor progress and outcomes',
      '• Consider additional research if needed',
    ];
  }

  private isLongContent(input: string): boolean {
    return input.split(/\s+/).length > 200;
  }

  private hasTechnicalContent(input: string): boolean {
    const technicalTerms = ['algorithm', 'implementation', 'architecture', 'framework', 'api'];
    return technicalTerms.some((term) => input.toLowerCase().includes(term));
  }

  private hasActionableItems(input: string): boolean {
    const actionWords = ['should', 'must', 'recommend', 'suggest', 'action', 'implement'];
    return actionWords.some((word) => input.toLowerCase().includes(word));
  }
}
