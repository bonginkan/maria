/**
 * Thinking Mode Plugin - Standard reasoning and analysis mode
 * The default cognitive mode for general problem-solving and analysis
 */

import { BaseMode, ModeConfig, ModeContext, ModeResult } from '../BaseMode.js';

export default class ThinkingMode extends BaseMode {
  constructor() {
    const config: ModeConfig = {
      id: 'thinking',
      name: 'Thinking',
      category: 'reasoning',
      symbol: '✽',
      color: 'cyan',
      description: '通常の推論プロセス - 標準的な思考・分析モード',
      keywords: [
        'think',
        'analyze',
        'consider',
        'examine',
        'evaluate',
        'assess',
        'reason',
        'logic',
        'understand',
        'explain',
      ],
      triggers: [
        'what is',
        'how does',
        'why',
        'explain',
        'tell me about',
        'help me understand',
        'can you',
        'please',
        'default',
      ],
      examples: [
        'What is the meaning of this code?',
        'How does this algorithm work?',
        'Explain the concept behind this',
        'Help me understand this problem',
        'Can you analyze this situation?',
      ],
      enabled: true,
      priority: 1, // Highest priority as default mode
      timeout: 60000, // 1 minute
      maxConcurrentSessions: 20,
    };

    super(config);
  }

  protected async onActivate(context: ModeContext): Promise<void> {
    console.log(`[${this.config.id}] Activating thinking mode for session ${context.sessionId}`);

    // Set up thinking mode context
    this.emit('display:update', {
      mode: this.config.id,
      symbol: this.config.symbol,
      text: 'Thinking...',
      color: this.config.color,
      sessionId: context.sessionId,
    });

    // Log activation
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
    console.log(`[${this.config.id}] Deactivating thinking mode for session ${sessionId}`);

    this.emit('analytics:event', {
      type: 'mode_deactivation',
      mode: this.config.id,
      sessionId,
      timestamp: Date.now(),
    });
  }

  protected async onProcess(input: string, context: ModeContext): Promise<ModeResult> {
    console.log(`[${this.config.id}] Processing input: "${input.substring(0, 50)}..."`);

    // Thinking mode processing steps
    const analysisSteps = await this.performAnalysis(input, context);
    const reasoning = await this.generateReasoning(input, analysisSteps);
    const suggestions = await this.generateSuggestions(input, reasoning);

    // Determine next recommended mode based on analysis
    const nextMode = await this.determineNextMode(input, reasoning);

    return {
      success: true,
      output: reasoning,
      suggestions,
      nextRecommendedMode: nextMode,
      confidence: 0.85,
      metadata: {
        analysisSteps,
        processedAt: Date.now(),
        inputLength: input.length,
        reasoningLength: reasoning.length,
      },
    };
  }

  protected async onCanHandle(
    input: string,
    context: ModeContext,
  ): Promise<{ confidence: number; reasoning: string[] }> {
    const reasoning: string[] = [];
    let confidence = 0.5; // Base confidence for default mode

    // Thinking mode can handle almost anything as the default
    reasoning.push('Default thinking mode - can handle general queries');

    // Check for explicit thinking indicators
    const thinkingIndicators = [
      'think',
      'analyze',
      'consider',
      'understand',
      'explain',
      'what',
      'how',
      'why',
      'when',
      'where',
    ];

    const inputLower = input.toLowerCase();
    const matches = thinkingIndicators.filter((indicator) => inputLower.includes(indicator));

    if (matches.length > 0) {
      confidence += Math.min(0.3, matches.length * 0.1);
      reasoning.push(`Thinking indicators found: ${matches.join(', ')}`);
    }

    // Boost confidence if no other specific mode patterns detected
    if (!this.hasSpecificModePatterns(input)) {
      confidence += 0.2;
      reasoning.push('No specific mode patterns detected - default to thinking');
    }

    // Context-based adjustments
    if (context.previousMode && context.previousMode !== 'thinking') {
      confidence += 0.1;
      reasoning.push('Good transition from specialized mode back to thinking');
    }

    return { confidence: Math.min(confidence, 1.0), reasoning };
  }

  /**
   * Perform multi-step analysis of the input
   */
  private async performAnalysis(input: string, context: ModeContext): Promise<string[]> {
    const steps: string[] = [];

    // Step 1: Input categorization
    const category = this.categorizeInput(input);
    steps.push(`Input categorized as: ${category}`);

    // Step 2: Complexity assessment
    const complexity = this.assessComplexity(input);
    steps.push(`Complexity level: ${complexity}`);

    // Step 3: Context integration
    if (context.metadata?.previousInputs) {
      steps.push('Integrated with previous context');
    }

    // Step 4: Knowledge domain identification
    const domain = this.identifyDomain(input);
    steps.push(`Knowledge domain: ${domain}`);

    return steps;
  }

  /**
   * Generate reasoning based on analysis
   */
  private async generateReasoning(input: string, analysisSteps: string[]): Promise<string> {
    // This is a simplified reasoning generation
    // In a real implementation, this would involve more sophisticated NLP

    const reasoning = [
      `Analysis of the input: "${input}"`,
      '',
      'Processing steps:',
      ...analysisSteps.map((step) => `• ${step}`),
      '',
      'Based on this analysis, I can provide insights and help you understand the topic.',
      'The thinking process involves breaking down the problem, examining different aspects,',
      'and synthesizing information to provide a comprehensive response.',
    ];

    return reasoning.join('\n');
  }

  /**
   * Generate helpful suggestions
   */
  private async generateSuggestions(input: string, reasoning: string): Promise<string[]> {
    const suggestions: string[] = [];

    // General thinking suggestions
    suggestions.push('Consider asking for more specific details');
    suggestions.push('Think about related concepts or examples');
    suggestions.push('Break the problem into smaller parts');

    // Input-specific suggestions
    if (input.includes('?')) {
      suggestions.push('Try rephrasing the question differently');
    }

    if (input.length < 10) {
      suggestions.push('Provide more context for better analysis');
    }

    if (this.containsTechnicalTerms(input)) {
      suggestions.push('Consider switching to research mode for deeper technical analysis');
    }

    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  }

  /**
   * Determine the next recommended mode
   */
  private async determineNextMode(input: string, reasoning: string): Promise<string | undefined> {
    // Check if input suggests a specific mode would be better
    const inputLower = input.toLowerCase();

    if (inputLower.includes('error') || inputLower.includes('bug') || inputLower.includes('fix')) {
      return 'debugging';
    }

    if (
      inputLower.includes('optimize') ||
      inputLower.includes('improve') ||
      inputLower.includes('performance')
    ) {
      return 'optimizing';
    }

    if (
      inputLower.includes('idea') ||
      inputLower.includes('brainstorm') ||
      inputLower.includes('creative')
    ) {
      return 'brainstorming';
    }

    if (
      inputLower.includes('research') ||
      inputLower.includes('find') ||
      inputLower.includes('search')
    ) {
      return 'researching';
    }

    if (
      inputLower.includes('summary') ||
      inputLower.includes('summarize') ||
      inputLower.includes('brief')
    ) {
      return 'summarizing';
    }

    // Stay in thinking mode for general queries
    return undefined;
  }

  /**
   * Categorize the input type
   */
  private categorizeInput(input: string): string {
    const inputLower = input.toLowerCase();

    if (inputLower.includes('?')) return 'question';
    if (inputLower.includes('explain') || inputLower.includes('describe'))
      return 'explanation_request';
    if (inputLower.includes('help') || inputLower.includes('assist')) return 'assistance_request';
    if (inputLower.includes('what') || inputLower.includes('how') || inputLower.includes('why'))
      return 'inquiry';
    if (input.length > 100) return 'complex_statement';

    return 'general';
  }

  /**
   * Assess input complexity
   */
  private assessComplexity(input: string): string {
    const wordCount = input.split(/\s+/).length;
    const hasQuestions = (input.match(/\?/g) || []).length;
    const hasTechnicalTerms = this.containsTechnicalTerms(input);

    if (wordCount < 5) return 'simple';
    if (wordCount < 15 && hasQuestions <= 1 && !hasTechnicalTerms) return 'moderate';
    if (wordCount < 30 && (hasQuestions <= 2 || hasTechnicalTerms)) return 'complex';

    return 'very_complex';
  }

  /**
   * Identify knowledge domain
   */
  private identifyDomain(input: string): string {
    const inputLower = input.toLowerCase();

    const domains = {
      programming: ['code', 'function', 'variable', 'algorithm', 'programming', 'software', 'api'],
      mathematics: ['calculate', 'equation', 'formula', 'math', 'number', 'statistics'],
      science: ['experiment', 'hypothesis', 'research', 'study', 'analysis', 'data'],
      business: ['strategy', 'market', 'business', 'revenue', 'customer', 'sales'],
      general: [],
    };

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some((keyword) => inputLower.includes(keyword))) {
        return domain;
      }
    }

    return 'general';
  }

  /**
   * Check if input contains technical terms
   */
  private containsTechnicalTerms(input: string): boolean {
    const technicalTerms = [
      'algorithm',
      'function',
      'variable',
      'database',
      'server',
      'api',
      'framework',
      'library',
      'protocol',
      'architecture',
      'implementation',
      'optimization',
      'performance',
      'scalability',
      'security',
    ];

    const inputLower = input.toLowerCase();
    return technicalTerms.some((term) => inputLower.includes(term));
  }

  /**
   * Check if input has patterns that suggest other specific modes
   */
  private hasSpecificModePatterns(input: string): boolean {
    const inputLower = input.toLowerCase();

    const patterns = [
      // Debugging patterns
      /error|bug|fix|debug|broken|crash|fail|exception/i,
      // Optimization patterns
      /optimize|improve|performance|speed|faster|efficient/i,
      // Creative patterns
      /idea|brainstorm|creative|innovative|concept|design/i,
      // Research patterns
      /research|find|search|investigate|study|explore/i,
      // Summary patterns
      /summary|summarize|brief|overview|main points/i,
    ];

    return patterns.some((pattern) => pattern.test(inputLower));
  }
}
