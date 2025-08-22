/**
 * Optimizing Mode Plugin - Performance optimization and improvement mode
 * Specialized for analyzing and improving efficiency, performance, and quality
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class OptimizingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'optimizing',
      name: 'Optimizing',
      category: 'reasoning',
      symbol: '⚡',
      color: 'yellow',
      description:
        '処理や出力の効率化・改善を行う - パフォーマンス最適化とクオリティ向上専門モード',
      keywords: [
        'optimize',
        'improve',
        'enhance',
        'performance',
        'efficiency',
        'speed',
        'faster',
        'better',
        'refactor',
        'streamline',
        'reduce',
        'minimize',
        'maximize',
        'quality',
        'upgrade',
      ],
      triggers: [
        'optimize',
        'improve',
        'make it faster',
        'make it better',
        'enhance',
        'performance',
        'efficiency',
        'speed up',
        'reduce time',
        'save memory',
        'less resources',
      ],
      examples: [
        'Optimize this code for better performance',
        'How can I improve the efficiency of this algorithm?',
        'Make this process faster',
        'Enhance the quality of this output',
        'Reduce the memory usage of this function',
      ],
      enabled: true,
      priority: 7,
      timeout: 90000, // 1.5 minutes for thorough optimization analysis
      maxConcurrentSessions: 8,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(
      `[${this.config.id}] Activating optimization mode for session ${context.sessionId}`,
    );

    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Optimizing...',
      color: this.config.color,
      sessionId: context.sessionId,
      animation: 'pulse',
    });

    this.emit('analytics:event', {
      type: 'mode_activation',
      mode: this.config.id,
      sessionId: context.sessionId,
      timestamp: context.timestamp,
      metadata: {
        previousMode: context.previousMode,
        optimizationTarget: this.identifyOptimizationTarget(context.input || ''),
      },
    });
  }

  protected async onDeactivate(sessionId: string): Promise<void> {
    console.log(`[${this.config.id}] Deactivating optimization mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(
      `[${this.config.id}] Processing optimization request: "${input.substring(0, 50)}..."`,
    );

    // Multi-phase optimization analysis
    const currentState = await this.analyzeCurrentState(input, context);
    const optimizationOpportunities = await this.identifyOptimizationOpportunities(
      input,
      currentState,
    );
    const optimizationPlan = await this.createOptimizationPlan(optimizationOpportunities);
    const recommendations = await this.generateRecommendations(optimizationPlan);

    // Calculate confidence based on analysis depth
    const confidence = this.calculateOptimizationConfidence(optimizationOpportunities, input);

    return {
      success: true,
      output: this.formatOptimizationReport(currentState, optimizationPlan, recommendations),
      suggestions: this.generateActionableSuggestions(optimizationPlan),
      nextRecommendedMode: this.determineNextMode(optimizationPlan),
      confidence,
      metadata: {
        currentState,
        opportunitiesFound: optimizationOpportunities.length,
        optimizationPlan,
        analysisDepth: this.calculateAnalysisDepth(input),
        processedAt: Date.now(),
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0;

    const inputLower = input.toLowerCase();

    // Strong optimization indicators
    const strongIndicators = [
      'optimize',
      'improve',
      'enhance',
      'performance',
      'faster',
      'efficient',
      'speed up',
      'make better',
      'reduce',
    ];

    const strongMatches = strongIndicators.filter((indicator) => inputLower.includes(indicator));
    if (strongMatches.length > 0) {
      confidence += Math.min(0.6, strongMatches.length * 0.2);
      reasoning.push(`Strong optimization indicators: ${strongMatches.join(', ')}`);
    }

    // Performance-related keywords
    const performanceKeywords = [
      'slow',
      'memory',
      'cpu',
      'resource',
      'bottleneck',
      'latency',
      'throughput',
      'scalability',
      'load',
      'cache',
      'database',
    ];

    const perfMatches = performanceKeywords.filter((keyword) => inputLower.includes(keyword));
    if (perfMatches.length > 0) {
      confidence += Math.min(0.3, perfMatches.length * 0.1);
      reasoning.push(`Performance keywords found: ${perfMatches.join(', ')}`);
    }

    // Quality improvement indicators
    const qualityIndicators = ['better', 'cleaner', 'refactor', 'restructure', 'quality'];
    const qualityMatches = qualityIndicators.filter((indicator) => inputLower.includes(indicator));
    if (qualityMatches.length > 0) {
      confidence += Math.min(0.2, qualityMatches.length * 0.1);
      reasoning.push(`Quality improvement indicators: ${qualityMatches.join(', ')}`);
    }

    // Code-related optimization
    if (this.containsCode(input)) {
      confidence += 0.15;
      reasoning.push('Code detected - optimization mode highly relevant');
    }

    // Numeric/metric mentions suggest measurable optimization
    if (this.containsMetrics(input)) {
      confidence += 0.1;
      reasoning.push('Metrics mentioned - quantifiable optimization possible');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Analyze current state for optimization opportunities
   */
  private async analyzeCurrentState(input: string, context: ModeContext): Promise<unknown> {
    const analysis = {
      type: this.classifyOptimizationType(input),
      complexity: this.assessComplexity(input),
      domain: this.identifyDomain(input),
      currentMetrics: this.extractCurrentMetrics(input),
      constraints: this.identifyConstraints(input),
      codePresent: this.containsCode(input),
      dataPresent: this.containsData(input),
    };

    return analysis;
  }

  /**
   * Identify optimization opportunities
   */
  private async identifyOptimizationOpportunities(
    input: string,
    currentState: unknown,
  ): Promise<unknown[]> {
    const opportunities: unknown[] = [];

    // Performance optimization opportunities
    if (currentState.type === 'performance') {
      opportunities.push({
        category: 'performance',
        type: 'algorithm_optimization',
        description: 'Optimize algorithms for better time complexity',
        impact: 'high',
        effort: 'medium',
      });

      opportunities.push({
        category: 'performance',
        type: 'memory_optimization',
        description: 'Reduce memory usage and improve garbage collection',
        impact: 'medium',
        effort: 'medium',
      });
    }

    // Code quality opportunities
    if (currentState.codePresent) {
      opportunities.push({
        category: 'quality',
        type: 'code_refactoring',
        description: 'Refactor code for better readability and maintainability',
        impact: 'medium',
        effort: 'low',
      });

      opportunities.push({
        category: 'quality',
        type: 'design_patterns',
        description: 'Apply design patterns for better architecture',
        impact: 'high',
        effort: 'high',
      });
    }

    // Process optimization opportunities
    if (currentState.type === 'process') {
      opportunities.push({
        category: 'process',
        type: 'workflow_streamlining',
        description: 'Streamline workflow to reduce unnecessary steps',
        impact: 'medium',
        effort: 'low',
      });
    }

    // Resource optimization opportunities
    opportunities.push({
      category: 'resource',
      type: 'resource_utilization',
      description: 'Optimize resource allocation and usage',
      impact: 'medium',
      effort: 'medium',
    });

    return opportunities;
  }

  /**
   * Create optimization plan
   */
  private async createOptimizationPlan(opportunities: unknown[]): Promise<unknown> {
    // Sort opportunities by impact/effort ratio
    const prioritizedOpportunities = opportunities
      .map((opp) => ({
        ...opp,
        priority: this.calculatePriority(opp.impact, opp.effort),
      }))
      .sort((a, b) => b.priority - a.priority);

    return {
      phase1: prioritizedOpportunities.slice(0, 2), // Quick wins
      phase2: prioritizedOpportunities.slice(2, 4), // Medium-term improvements
      phase3: prioritizedOpportunities.slice(4), // Long-term optimizations
      estimatedImpact: this.calculateOverallImpact(prioritizedOpportunities),
      timeline: this.estimateTimeline(prioritizedOpportunities),
    };
  }

  /**
   * Generate optimization recommendations
   */
  private async generateRecommendations(optimizationPlan: unknown): Promise<string[]> {
    const recommendations: string[] = [];

    // Phase 1 recommendations (immediate actions)
    if (optimizationPlan.phase1.length > 0) {
      recommendations.push('Immediate optimizations:');
      optimizationPlan.phase1.forEach((opp: unknown, index: number) => {
        recommendations.push(
          `${index + 1}. ${opp.description} (${opp.impact} impact, ${opp.effort} effort)`,
        );
      });
    }

    // Phase 2 recommendations (medium-term)
    if (optimizationPlan.phase2.length > 0) {
      recommendations.push('');
      recommendations.push('Medium-term improvements:');
      optimizationPlan.phase2.forEach((opp: unknown, index: number) => {
        recommendations.push(
          `${index + 1}. ${opp.description} (${opp.impact} impact, ${opp.effort} effort)`,
        );
      });
    }

    // General optimization principles
    recommendations.push('');
    recommendations.push('General optimization principles:');
    recommendations.push('• Measure before optimizing');
    recommendations.push('• Focus on bottlenecks first');
    recommendations.push('• Consider trade-offs between different metrics');
    recommendations.push('• Test optimizations thoroughly');

    return recommendations;
  }

  /**
   * Format optimization report
   */
  private formatOptimizationReport(
    currentState: unknown,
    optimizationPlan: unknown,
    recommendations: string[],
  ): string {
    const report = [
      '⚡ OPTIMIZATION ANALYSIS REPORT',
      '================================',
      '',
      `Analysis Type: ${currentState.type}`,
      `Domain: ${currentState.domain}`,
      `Complexity: ${currentState.complexity}`,
      '',
      `Optimization Opportunities Found: ${optimizationPlan.phase1.length + optimizationPlan.phase2.length + optimizationPlan.phase3.length}`,
      `Estimated Overall Impact: ${optimizationPlan.estimatedImpact}`,
      `Estimated Timeline: ${optimizationPlan.timeline}`,
      '',
      ...recommendations,
      '',
      'Remember: Optimization is an iterative process. Measure, optimize, and validate results.',
    ];

    return report.join('\n');
  }

  /**
   * Generate actionable suggestions
   */
  private generateActionableSuggestions(optimizationPlan: unknown): string[] {
    const suggestions: string[] = [];

    if (optimizationPlan.phase1.length > 0) {
      suggestions.push(`Start with ${optimizationPlan.phase1[0].description.toLowerCase()}`);
    }

    suggestions.push('Profile and measure current performance before optimizing');
    suggestions.push('Consider switching to debugging mode if issues are found');
    suggestions.push('Use researching mode to explore optimization techniques');

    return suggestions;
  }

  /**
   * Classify optimization type
   */
  private classifyOptimizationType(input: string): string {
    const inputLower = input.toLowerCase();

    if (
      inputLower.includes('performance') ||
      inputLower.includes('speed') ||
      inputLower.includes('fast')
    ) {
      return 'performance';
    }

    if (inputLower.includes('memory') || inputLower.includes('resource')) {
      return 'resource';
    }

    if (
      inputLower.includes('quality') ||
      inputLower.includes('clean') ||
      inputLower.includes('refactor')
    ) {
      return 'quality';
    }

    if (inputLower.includes('process') || inputLower.includes('workflow')) {
      return 'process';
    }

    return 'general';
  }

  /**
   * Assess optimization complexity
   */
  private assessComplexity(input: string): string {
    const indicators = {
      simple: ['variable', 'function', 'loop'],
      moderate: ['algorithm', 'database', 'api', 'structure'],
      complex: ['architecture', 'system', 'distributed', 'scalability'],
      advanced: ['microservices', 'cluster', 'optimization', 'performance tuning'],
    };

    const inputLower = input.toLowerCase();

    for (const [level, keywords] of Object.entries(indicators)) {
      if (keywords.some((keyword) => inputLower.includes(keyword))) {
        return level;
      }
    }

    return 'simple';
  }

  /**
   * Identify optimization domain
   */
  private identifyDomain(input: string): string {
    const domains = {
      code: ['function', 'algorithm', 'code', 'programming'],
      database: ['query', 'database', 'sql', 'index'],
      system: ['system', 'server', 'infrastructure'],
      process: ['process', 'workflow', 'procedure'],
      ui: ['interface', 'user experience', 'frontend'],
    };

    const inputLower = input.toLowerCase();

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some((keyword) => inputLower.includes(keyword))) {
        return domain;
      }
    }

    return 'general';
  }

  /**
   * Extract current metrics from input
   */
  private extractCurrentMetrics(input: string): unknown {
    const metrics: unknown = {};

    // Look for time-related metrics
    const timeMatch = input.match(/(\d+(?:\.\d+)?)\s*(ms|milliseconds|seconds|minutes)/i);
    if (timeMatch) {
      metrics.currentTime = timeMatch[0];
    }

    // Look for memory metrics
    const memoryMatch = input.match(/(\d+(?:\.\d+)?)\s*(mb|gb|kb|bytes)/i);
    if (memoryMatch) {
      metrics.currentMemory = memoryMatch[0];
    }

    // Look for percentage metrics
    const percentMatch = input.match(/(\d+(?:\.\d+)?)%/);
    if (percentMatch) {
      metrics.currentPercentage = percentMatch[0];
    }

    return metrics;
  }

  /**
   * Identify constraints
   */
  private identifyConstraints(input: string): string[] {
    const constraints: string[] = [];
    const inputLower = input.toLowerCase();

    if (inputLower.includes('budget') || inputLower.includes('cost')) {
      constraints.push('budget');
    }

    if (inputLower.includes('time') || inputLower.includes('deadline')) {
      constraints.push('time');
    }

    if (inputLower.includes('compatibility') || inputLower.includes('legacy')) {
      constraints.push('compatibility');
    }

    if (inputLower.includes('security')) {
      constraints.push('security');
    }

    return constraints;
  }

  /**
   * Check if input contains code
   */
  private containsCode(input: string): boolean {
    const codeIndicators = [
      'function',
      'class',
      'def',
      'var',
      'let',
      'const',
      '{',
      '}',
      '()',
      '=>',
      'return',
      'if',
      'for',
      'while',
    ];

    return codeIndicators.some((indicator) => input.includes(indicator));
  }

  /**
   * Check if input contains data/metrics
   */
  private containsData(input: string): boolean {
    return (
      /\d+/.test(input) &&
      (input.includes('%') ||
        input.includes('ms') ||
        input.includes('mb') ||
        input.includes('gb') ||
        input.includes('seconds'))
    );
  }

  /**
   * Check if input contains metrics
   */
  private containsMetrics(input: string): boolean {
    const metricKeywords = [
      'time',
      'speed',
      'memory',
      'cpu',
      'performance',
      'latency',
      'throughput',
      'response time',
    ];

    const inputLower = input.toLowerCase();
    return (
      metricKeywords.some((keyword) => inputLower.includes(keyword)) ||
      /\d+\s*(ms|mb|gb|%|seconds|minutes)/.test(input)
    );
  }

  /**
   * Calculate optimization priority
   */
  private calculatePriority(impact: string, effort: string): number {
    const impactScore = { high: 3, medium: 2, low: 1 }[impact] || 1;
    const effortScore = { low: 3, medium: 2, high: 1 }[effort] || 1;
    return impactScore * effortScore;
  }

  /**
   * Calculate overall optimization impact
   */
  private calculateOverallImpact(opportunities: unknown[]): string {
    const highImpactCount = opportunities.filter((opp) => opp.impact === 'high').length;
    const totalCount = opportunities.length;

    if (highImpactCount / totalCount > 0.6) {return 'High';}
    if (highImpactCount / totalCount > 0.3) {return 'Medium-High';}
    return 'Medium';
  }

  /**
   * Estimate implementation timeline
   */
  private estimateTimeline(opportunities: unknown[]): string {
    const effortCounts = {
      low: opportunities.filter((opp) => opp.effort === 'low').length,
      medium: opportunities.filter((opp) => opp.effort === 'medium').length,
      high: opportunities.filter((opp) => opp.effort === 'high').length,
    };

    const totalEffort = effortCounts.low * 1 + effortCounts.medium * 3 + effortCounts.high * 8;

    if (totalEffort <= 5) {return '1-2 weeks';}
    if (totalEffort <= 15) {return '2-4 weeks';}
    if (totalEffort <= 30) {return '1-2 months';}
    return '2+ months';
  }

  /**
   * Calculate optimization confidence
   */
  private calculateOptimizationConfidence(opportunities: unknown[], input: string): number {
    let confidence = 0.7; // Base confidence

    // More opportunities = higher confidence
    confidence += Math.min(0.2, opportunities.length * 0.05);

    // Presence of metrics increases confidence
    if (this.containsMetrics(input)) {
      confidence += 0.1;
    }

    // Code presence increases confidence for code optimization
    if (this.containsCode(input)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * Calculate analysis depth
   */
  private calculateAnalysisDepth(input: string): number {
    let depth = 1;

    if (this.containsCode(input)) {depth++;}
    if (this.containsMetrics(input)) {depth++;}
    if (input.length > 100) {depth++;}
    if (this.identifyConstraints(input).length > 0) {depth++;}

    return depth;
  }

  /**
   * Identify optimization target
   */
  private identifyOptimizationTarget(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('algorithm')) {return 'algorithm';}
    if (inputLower.includes('database')) {return 'database';}
    if (inputLower.includes('ui') || inputLower.includes('interface')) {return 'user_interface';}
    if (inputLower.includes('api')) {return 'api';}
    if (inputLower.includes('system')) {return 'system';}

    return 'general';
  }

  /**
   * Determine next recommended mode
   */
  private determineNextMode(optimizationPlan: unknown): string | undefined {
    // If many opportunities found, might need research
    if (optimizationPlan.phase1.length + optimizationPlan.phase2.length > 4) {
      return 'researching';
    }

    // If code refactoring needed, might switch to reviewing
    const hasCodeQuality = optimizationPlan.phase1.some(
      (opp: unknown) => opp.category === 'quality',
    );
    if (hasCodeQuality) {
      return 'reviewing';
    }

    return undefined;
  }
}
