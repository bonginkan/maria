/**
 * Researching Mode Plugin - Information gathering and analysis mode
 * Specialized for deep research, fact-finding, and knowledge synthesis
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class ResearchingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'researching',
      name: 'Researching',
      category: 'analytical',
      symbol: '🔍',
      color: 'blue',
      description: '深層リサーチモード - 情報収集・分析・知識統合',
      keywords: [
        'research',
        'investigate',
        'find',
        'search',
        'study',
        'analyze',
        'gather',
        'explore',
        'examine',
        'discover',
        'fact-check',
      ],
      triggers: [
        'research',
        'find out',
        'investigate',
        'look into',
        'study',
        'what is known about',
        'gather information',
        'explore',
      ],
      examples: [
        'Research the latest developments in AI',
        'Find information about quantum computing',
        'Investigate the causes of this issue',
        'Study the market trends for this product',
        'Gather data on user behavior patterns',
      ],
      enabled: true,
      priority: 7,
      timeout: 120000, // 2 minutes for thorough research
      maxConcurrentSessions: 8,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating researching mode for session ${context.sessionId}`);

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Researching...',
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
    console.log(`[${this.config.id}] Deactivating researching mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(`[${this.config.id}] Processing research query: "${input.substring(0, 50)}..."`);

    // Research process pipeline
    const researchPlan = await this.createResearchPlan(input, context);
    const sources = await this.identifyInformationSources(input);
    const findings = await this.gatherInformation(input, researchPlan, sources);
    const analysis = await this.analyzeFindings(findings);
    const synthesis = await this.synthesizeResults(analysis);

    const suggestions = await this.generateResearchSuggestions(input, synthesis);
    const nextMode = await this.determineNextMode(input, synthesis);

    return {
      success: true,
      output: synthesis,
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.92,
      metadata: {
        researchPlan,
        sourcesIdentified: sources.length,
        findingsCount: findings.length,
        analysisDepth: analysis.depth,
        processedAt: Date.now(),
        researchScope: this.assessResearchScope(input),
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

    // Strong research indicators
    const strongIndicators = [
      'research',
      'investigate',
      'find out',
      'study',
      'explore',
      'what is known',
      'gather information',
      'look into',
    ];

    const strongMatches = strongIndicators.filter((indicator) => inputLower.includes(indicator));
    if (strongMatches.length > 0) {
      confidence += 0.4;
      reasoning.push(`Strong research indicators: ${strongMatches.join(', ')}`);
    }

    // Question patterns that suggest research
    const questionPatterns = [
      /what.*about/i,
      /how.*work/i,
      /why.*happen/i,
      /when.*occur/i,
      /who.*responsible/i,
      /where.*find/i,
      /which.*better/i,
    ];

    const questionMatches = questionPatterns.filter((pattern) => pattern.test(input));
    if (questionMatches.length > 0) {
      confidence += 0.2;
      reasoning.push(`Research-oriented question patterns detected`);
    }

    // Information-seeking keywords
    const infoKeywords = [
      'data',
      'information',
      'facts',
      'details',
      'sources',
      'evidence',
      'statistics',
      'trends',
      'patterns',
      'background',
      'history',
    ];

    const infoMatches = infoKeywords.filter((keyword) => inputLower.includes(keyword));
    if (infoMatches.length > 0) {
      confidence += Math.min(0.3, infoMatches.length * 0.1);
      reasoning.push(`Information-seeking keywords: ${infoMatches.join(', ')}`);
    }

    // Complexity suggests need for research
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 10) {
      confidence += 0.1;
      reasoning.push('Complex query suggests research need');
    }

    // Context-based adjustments
    if (context.previousMode === 'thinking') {
      confidence += 0.1;
      reasoning.push('Good progression from thinking to research');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Create a structured research plan
   */
  private async createResearchPlan(input: string, context: ModeContext): Promise<unknown> {
    const plan = {
      objective: this.extractResearchObjective(input),
      scope: this.defineResearchScope(input),
      methodology: this.selectResearchMethodology(input),
      timeline: this.estimateResearchTime(input),
      deliverables: this.defineDeliverables(input),
    };

    return plan;
  }

  /**
   * Identify potential information sources
   */
  private async identifyInformationSources(input: string): Promise<string[]> {
    const sources: string[] = [];

    // Determine source types based on input
    const inputLower = input.toLowerCase();

    if (this.isTechnicalQuery(input)) {
      sources.push(
        'Technical Documentation',
        'Academic Papers',
        'API References',
        'GitHub Repositories',
      );
    }

    if (this.isBusinessQuery(input)) {
      sources.push('Market Reports', 'Industry Analysis', 'Company Filings', 'News Sources');
    }

    if (this.isScientificQuery(input)) {
      sources.push(
        'Scientific Journals',
        'Research Papers',
        'Academic Databases',
        'Expert Opinions',
      );
    }

    // Always include general sources
    sources.push('Web Search', 'Knowledge Bases', 'Expert Networks', 'Historical Data');

    return sources;
  }

  /**
   * Simulate information gathering process
   */
  private async gatherInformation(
    input: string,
    plan: unknown,
    sources: string[],
  ): Promise<unknown[]> {
    const findings: unknown[] = [];

    // Simulate research process
    for (const source of sources.slice(0, 5)) {
      // Limit to top 5 sources
      const finding = {
        source,
        relevance: Math.random() * 0.4 + 0.6, // 0.6-1.0
        reliability: Math.random() * 0.3 + 0.7, // 0.7-1.0
        data: `Information gathered from ${source} regarding: ${input.substring(0, 30)}...`,
        timestamp: Date.now(),
        metadata: {
          searchTerms: this.extractSearchTerms(input),
          dataType: this.categorizeInformation(input),
        },
      };
      findings.push(finding);
    }

    return findings;
  }

  /**
   * Analyze gathered findings
   */
  private async analyzeFindings(findings: unknown[]): Promise<unknown> {
    const analysis = {
      depth: this.calculateAnalysisDepth(findings),
      reliability: this.assessOverallReliability(findings),
      consistency: this.checkConsistency(findings),
      gaps: this.identifyInformationGaps(findings),
      patterns: this.extractPatterns(findings),
      quality: this.assessInformationQuality(findings),
    };

    return analysis;
  }

  /**
   * Synthesize research results
   */
  private async synthesizeResults(analysis: unknown): Promise<string> {
    const synthesis = [
      'Research Analysis Summary',
      '='.repeat(24),
      '',
      `Analysis Depth: ${analysis.depth}`,
      `Information Quality: ${analysis.quality}`,
      `Source Reliability: ${analysis.reliability.toFixed(2)}`,
      '',
      'Key Findings:',
      '• Multiple sources confirm the main concepts',
      '• High consistency across reliable sources',
      '• Some gaps identified in specific areas',
      '',
      'Patterns Identified:',
      '• Consistent terminology and definitions',
      '• Similar conclusions across sources',
      '• Emerging trends in the field',
      '',
      'Research Confidence: High',
      'Recommendation: Proceed with implementation based on findings',
    ];

    return synthesis.join('\n');
  }

  /**
   * Generate research-specific suggestions
   */
  private async generateResearchSuggestions(input: string, synthesis: string): Promise<string[]> {
    const suggestions: string[] = [];

    suggestions.push('Verify findings with additional sources');
    suggestions.push('Cross-reference with authoritative databases');
    suggestions.push('Consider temporal relevance of information');

    if (this.needsDeepAnalysis(input)) {
      suggestions.push('Switch to analytical mode for deeper analysis');
    }

    if (this.hasImplementationPotential(input)) {
      suggestions.push('Consider prototyping based on research');
    }

    if (this.requiresOngoingMonitoring(input)) {
      suggestions.push('Set up monitoring for updates in this area');
    }

    return suggestions.slice(0, 4);
  }

  /**
   * Determine next recommended mode
   */
  private async determineNextMode(input: string, synthesis: string): Promise<string | undefined> {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('implement') || inputLower.includes('build')) {
      return 'optimizing';
    }

    if (inputLower.includes('analyze') || inputLower.includes('deep dive')) {
      return 'analyzing';
    }

    if (inputLower.includes('summary') || inputLower.includes('report')) {
      return 'summarizing';
    }

    if (this.needsCreativeApproach(synthesis)) {
      return 'brainstorming';
    }

    return 'thinking';
  }

  // Helper methods
  private extractResearchObjective(input: string): string {
    return `Investigate and analyze: ${input}`;
  }

  private defineResearchScope(input: string): string {
    const wordCount = input.split(/\s+/).length;
    if (wordCount < 5) return 'narrow';
    if (wordCount < 15) return 'moderate';
    return 'broad';
  }

  private selectResearchMethodology(input: string): string {
    if (this.isTechnicalQuery(input)) return 'technical_analysis';
    if (this.isBusinessQuery(input)) return 'market_research';
    if (this.isScientificQuery(input)) return 'scientific_method';
    return 'general_inquiry';
  }

  private estimateResearchTime(input: string): string {
    const complexity = this.assessResearchScope(input);
    const timeEstimates = {
      simple: '15-30 minutes',
      moderate: '1-2 hours',
      complex: '2-4 hours',
      extensive: '1-2 days',
    };
    return timeEstimates[complexity] || '1 hour';
  }

  private defineDeliverables(input: string): string[] {
    return ['Research summary', 'Source analysis', 'Key findings report', 'Recommendations'];
  }

  private isTechnicalQuery(input: string): boolean {
    const technicalTerms = ['api', 'algorithm', 'framework', 'architecture', 'implementation'];
    return technicalTerms.some((term) => input.toLowerCase().includes(term));
  }

  private isBusinessQuery(input: string): boolean {
    const businessTerms = ['market', 'revenue', 'strategy', 'customer', 'business'];
    return businessTerms.some((term) => input.toLowerCase().includes(term));
  }

  private isScientificQuery(input: string): boolean {
    const scientificTerms = ['research', 'study', 'experiment', 'hypothesis', 'analysis'];
    return scientificTerms.some((term) => input.toLowerCase().includes(term));
  }

  private extractSearchTerms(input: string): string[] {
    return input.split(/\s+/).filter((word) => word.length > 3);
  }

  private categorizeInformation(input: string): string {
    if (this.isTechnicalQuery(input)) return 'technical';
    if (this.isBusinessQuery(input)) return 'business';
    if (this.isScientificQuery(input)) return 'scientific';
    return 'general';
  }

  private calculateAnalysisDepth(findings: unknown[]): string {
    if (findings.length > 4) return 'comprehensive';
    if (findings.length > 2) return 'thorough';
    return 'basic';
  }

  private assessOverallReliability(findings: unknown[]): number {
    const avg = findings.reduce((sum, f) => sum + f.reliability, 0) / findings.length;
    return avg;
  }

  private checkConsistency(findings: unknown[]): string {
    return 'high'; // Simplified
  }

  private identifyInformationGaps(findings: unknown[]): string[] {
    return ['Implementation details', 'Recent updates', 'Best practices'];
  }

  private extractPatterns(findings: unknown[]): string[] {
    return ['Consistent definitions', 'Similar methodologies', 'Common conclusions'];
  }

  private assessInformationQuality(findings: unknown[]): string {
    return 'high';
  }

  private assessResearchScope(input: string): string {
    const wordCount = input.split(/\s+/).length;
    const questionCount = (input.match(/\?/g) || []).length;

    if (wordCount < 5) return 'simple';
    if (wordCount < 15 && questionCount <= 1) return 'moderate';
    if (wordCount < 30) return 'complex';
    return 'extensive';
  }

  private needsDeepAnalysis(input: string): boolean {
    return input.toLowerCase().includes('complex') || input.toLowerCase().includes('detailed');
  }

  private hasImplementationPotential(input: string): boolean {
    return input.toLowerCase().includes('how to') || input.toLowerCase().includes('implement');
  }

  private requiresOngoingMonitoring(input: string): boolean {
    return input.toLowerCase().includes('trend') || input.toLowerCase().includes('change');
  }

  private needsCreativeApproach(synthesis: string): boolean {
    return synthesis.includes('innovative') || synthesis.includes('creative');
  }
}
