/**
 * Analyzing Mode Plugin
 * Deep analytical mode for detailed examination and systematic analysis
 */

import {
  BaseModePlugin,
  ModeContext,
  ModeResult,
  ModeDisplayConfig,
  ModeTrigger,
  ModeTransition,
} from '../BaseModePlugin';
import { Service } from '../../core';

@Service({
  id: 'analyzing-mode',
  name: 'AnalyzingMode',
  version: '1.0.0',
  description: 'Deep analytical mode for detailed examination and systematic analysis',
})
export class AnalyzingMode extends BaseModePlugin {
  readonly pluginId = 'analyzing';
  readonly pluginName = 'Analyzing';
  readonly category = 'analytical' as const;
  readonly version = '1.0.0';

  readonly triggers: ModeTrigger[] = [
    {
      pattern: /analyz|examine|investigate|study|detailed?|systematic|thorough|comprehensive/i,
      language: 'english',
      weight: 0.9,
    },
    {
      pattern: /分析|検査|調査|研究|詳細|体系的|徹底的|包括的/,
      language: 'japanese',
      weight: 0.9,
    },
    {
      pattern: /分析|检查|调查|研究|详细|系统|彻底|全面/,
      language: 'chinese',
      weight: 0.9,
    },
    {
      pattern: /분석|검사|조사|연구|상세|체계적|철저|포괄적/,
      language: 'korean',
      weight: 0.9,
    },
    {
      pattern: /phân tích|kiểm tra|điều tra|nghiên cứu|chi tiết|hệ thống|toàn diện/,
      language: 'vietnamese',
      weight: 0.9,
    },
  ];

  readonly transitions: ModeTransition[] = [
    {
      fromMode: 'thinking',
      toMode: 'analyzing',
      condition: (context) => /deep|detail|thorough|systematic/.test(context.input.toLowerCase()),
      priority: 9,
      description: 'Deep dive into analytical examination',
    },
    {
      fromMode: 'analyzing',
      toMode: 'evaluating',
      condition: (context) => /assess|evaluate|judge|rate|score/.test(context.input.toLowerCase()),
      priority: 8,
      description: 'Transition to evaluation mode',
    },
    {
      fromMode: 'analyzing',
      toMode: 'researching',
      condition: (context) => /research|find|lookup|search/.test(context.input.toLowerCase()),
      priority: 7,
      description: 'Need more research data',
    },
    {
      fromMode: 'analyzing',
      toMode: 'debugging',
      condition: (context) => /error|bug|problem|issue|fix/.test(context.input.toLowerCase()),
      priority: 8,
      description: 'Analytical debugging mode',
    },
  ];

  getDisplayConfig(): ModeDisplayConfig {
    return {
      symbol: '⚡',
      color: '#DC2626', // Red
      animation: 'pulse',
      description: 'Conducting deep systematic analysis and detailed examination',
      displayName: 'Analyzing',
      category: 'analytical',
    };
  }

  async execute(context: ModeContext): Promise<ModeResult> {
    const startTime = performance.now();

    try {
      // Perform analytical examination
      const analysis = await this.performDeepAnalysis(context);

      // Determine next analytical step
      const nextMode = this.suggestNextAnalyticalMode(context, analysis);

      const executionTime = performance.now() - startTime;

      return {
        success: true,
        output: this.formatAnalysisOutput(analysis, context.language),
        nextMode,
        confidence: analysis.confidence,
        executionTime,
        metadata: {
          analysisDepth: analysis.depth,
          components: analysis.components,
          patterns: analysis.patterns,
          insights: analysis.insights,
          methodology: analysis.methodology,
        },
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;

      return {
        success: false,
        confidence: 0,
        executionTime,
        metadata: {},
        error: error.message,
      };
    }
  }

  /**
   * Perform deep systematic analysis
   */
  private async performDeepAnalysis(context: ModeContext): Promise<{
    depth: 'surface' | 'intermediate' | 'deep';
    components: Array<{ name: string; type: string; significance: number }>;
    patterns: string[];
    insights: string[];
    methodology: string[];
    confidence: number;
  }> {
    const { input, language, metadata } = context;

    // Determine analysis depth
    const depth = this.determineAnalysisDepth(input, metadata);

    // Decompose into components
    const components = this.identifyComponents(input, language);

    // Identify patterns
    const patterns = this.identifyPatterns(input, components);

    // Generate insights
    const insights = this.generateAnalyticalInsights(input, components, patterns);

    // Define methodology
    const methodology = this.defineAnalyticalMethodology(depth, components.length);

    // Calculate confidence
    const confidence = this.calculateAnalysisConfidence(input, components, patterns, insights);

    return {
      depth,
      components,
      patterns,
      insights,
      methodology,
      confidence,
    };
  }

  /**
   * Determine the depth of analysis required
   */
  private determineAnalysisDepth(
    input: string,
    metadata: unknown,
  ): 'surface' | 'intermediate' | 'deep' {
    let score = 0;

    // Input length factor
    if (input.length > 500) score += 3;
    else if (input.length > 200) score += 2;
    else if (input.length > 100) score += 1;

    // Complexity indicators
    if (/systematic|comprehensive|thorough|detailed|exhaustive/.test(input.toLowerCase())) {
      score += 3;
    }
    if (/analyze|examine|investigate|study/.test(input.toLowerCase())) {
      score += 2;
    }

    // Technical content
    if (/algorithm|architecture|structure|pattern|framework/.test(input.toLowerCase())) {
      score += 2;
    }

    // Previous context
    if (metadata?.previousMode === 'thinking') {
      score += 1;
    }

    if (score >= 6) return 'deep';
    if (score >= 3) return 'intermediate';
    return 'surface';
  }

  /**
   * Identify key components for analysis
   */
  private identifyComponents(
    input: string,
    language: string,
  ): Array<{
    name: string;
    type: string;
    significance: number;
  }> {
    const components: Array<{ name: string; type: string; significance: number }> = [];

    // Extract technical entities
    const technicalTerms =
      input.match(
        /\b(function|class|method|algorithm|database|api|server|client|user|data|code|system|application|service|component|module|library|framework)\w*\b/gi,
      ) || [];
    technicalTerms.forEach((term) => {
      if (term.length > 3) {
        components.push({
          name: term,
          type: 'technical',
          significance: this.calculateTermSignificance(term, input),
        });
      }
    });

    // Extract business entities
    const businessTerms =
      input.match(
        /\b(requirement|feature|user\s+story|workflow|process|business|customer|market|product|service|goal|objective|strategy)\w*\b/gi,
      ) || [];
    businessTerms.forEach((term) => {
      components.push({
        name: term,
        type: 'business',
        significance: this.calculateTermSignificance(term, input),
      });
    });

    // Extract data entities
    const dataTerms =
      input.match(
        /\b(data|information|record|table|field|column|row|entity|attribute|relationship)\w*\b/gi,
      ) || [];
    dataTerms.forEach((term) => {
      components.push({
        name: term,
        type: 'data',
        significance: this.calculateTermSignificance(term, input),
      });
    });

    // Remove duplicates and sort by significance
    const uniqueComponents = Array.from(
      new Map(components.map((c) => [c.name.toLowerCase(), c])).values(),
    );

    return uniqueComponents.sort((a, b) => b.significance - a.significance).slice(0, 10); // Top 10 components
  }

  /**
   * Calculate significance of a term
   */
  private calculateTermSignificance(term: string, input: string): number {
    const termLower = term.toLowerCase();
    const inputLower = input.toLowerCase();

    // Count occurrences
    const occurrences = (inputLower.match(new RegExp(termLower, 'g')) || []).length;

    // Base significance from frequency
    let significance = Math.min(occurrences * 0.2, 1.0);

    // Boost for position (early terms are more significant)
    const position = inputLower.indexOf(termLower);
    if (position >= 0) {
      const positionFactor = 1.0 - position / input.length;
      significance += positionFactor * 0.3;
    }

    // Boost for term length (longer terms often more specific)
    significance += Math.min(term.length * 0.02, 0.3);

    return Math.min(significance, 1.0);
  }

  /**
   * Identify patterns in the input and components
   */
  private identifyPatterns(input: string, components: unknown[]): string[] {
    const patterns: string[] = [];

    // Structural patterns
    if (components.filter((c) => c.type === 'technical').length > 3) {
      patterns.push('Technical architecture focus detected');
    }

    if (components.filter((c) => c.type === 'business').length > 2) {
      patterns.push('Business process analysis required');
    }

    if (components.filter((c) => c.type === 'data').length > 2) {
      patterns.push('Data modeling and structure analysis needed');
    }

    // Complexity patterns
    const sentences = input.split(/[.!?]/).filter((s) => s.trim().length > 10);
    if (sentences.length > 5) {
      patterns.push('Multi-faceted analysis with multiple dimensions');
    }

    // Question patterns
    const questions = input.match(/[?？]/g);
    if (questions && questions.length > 2) {
      patterns.push('Multiple inquiry points requiring systematic examination');
    }

    // Conditional patterns
    if (/if|when|unless|provided|given that|assuming/.test(input.toLowerCase())) {
      patterns.push('Conditional analysis with dependency considerations');
    }

    return patterns;
  }

  /**
   * Generate analytical insights
   */
  private generateAnalyticalInsights(
    input: string,
    components: unknown[],
    patterns: string[],
  ): string[] {
    const insights: string[] = [];

    // Component-based insights
    const techComponents = components.filter((c) => c.type === 'technical');
    if (techComponents.length > 0) {
      const avgSignificance =
        techComponents.reduce((sum, c) => sum + c.significance, 0) / techComponents.length;
      if (avgSignificance > 0.6) {
        insights.push('High technical complexity requiring systematic decomposition');
      }
    }

    // Pattern-based insights
    if (patterns.length > 3) {
      insights.push('Multiple analytical dimensions identified - comprehensive approach required');
    }

    // Input structure insights
    if (input.includes('however') || input.includes('but') || input.includes('although')) {
      insights.push('Contradictory elements present - comparative analysis needed');
    }

    if (input.includes('because') || input.includes('due to') || input.includes('since')) {
      insights.push('Causal relationships identified - root cause analysis applicable');
    }

    // Scope insights
    if (input.length > 300) {
      insights.push('Extensive scope requiring structured analytical methodology');
    }

    return insights.slice(0, 5); // Top 5 insights
  }

  /**
   * Define analytical methodology
   */
  private defineAnalyticalMethodology(depth: string, componentCount: number): string[] {
    const methodology: string[] = [];

    switch (depth) {
      case 'deep':
        methodology.push('Systematic decomposition into core components');
        methodology.push('Multi-dimensional pattern analysis');
        methodology.push('Cross-component relationship mapping');
        methodology.push('Comprehensive impact assessment');
        methodology.push('Synthesis of findings with actionable insights');
        break;

      case 'intermediate':
        methodology.push('Component identification and categorization');
        methodology.push('Pattern recognition and significance assessment');
        methodology.push('Relationship analysis between key elements');
        methodology.push('Summary of findings and recommendations');
        break;

      default: // surface
        methodology.push('Initial component identification');
        methodology.push('Basic pattern recognition');
        methodology.push('High-level assessment and overview');
        break;
    }

    return methodology;
  }

  /**
   * Calculate confidence in analytical results
   */
  private calculateAnalysisConfidence(
    input: string,
    components: unknown[],
    patterns: string[],
    insights: string[],
  ): number {
    let confidence = 0.6; // Base confidence for analytical mode

    // Component quality factor
    if (components.length > 5) confidence += 0.15;
    if (components.length > 8) confidence += 0.1;

    // Pattern detection factor
    confidence += Math.min(patterns.length * 0.05, 0.15);

    // Insight generation factor
    confidence += Math.min(insights.length * 0.04, 0.12);

    // Input structure factor
    if (input.length > 200) confidence += 0.1;
    if (input.includes('analyze') || input.includes('examine')) confidence += 0.08;

    // High-significance components boost
    const highSigComponents = components.filter((c) => c.significance > 0.7);
    if (highSigComponents.length > 0) {
      confidence += Math.min(highSigComponents.length * 0.03, 0.1);
    }

    return Math.min(Math.max(confidence, 0.2), 0.95);
  }

  /**
   * Suggest next analytical mode
   */
  private suggestNextAnalyticalMode(context: ModeContext, analysis: unknown): string | undefined {
    const { input } = context;
    const normalizedInput = input.toLowerCase();

    // Suggest evaluation if assessment is needed
    if (/assess|evaluate|rate|score|judge|measure/.test(normalizedInput)) {
      return 'evaluating';
    }

    // Suggest comparison if multiple options are present
    if (/compare|versus|vs|alternative|option|choice/.test(normalizedInput)) {
      return 'comparing';
    }

    // Suggest research if more data is needed
    if (analysis.components.length < 3 || /research|find|lookup|search/.test(normalizedInput)) {
      return 'researching';
    }

    // Suggest debugging if errors are found
    if (/error|bug|problem|issue|fail|wrong/.test(normalizedInput)) {
      return 'debugging';
    }

    return undefined; // Continue analyzing
  }

  /**
   * Format analysis output
   */
  private formatAnalysisOutput(analysis: unknown, language: string): string {
    const { depth, components, patterns, insights, methodology } = analysis;

    let output = '';

    // Add analysis indicator
    switch (language) {
      case 'japanese':
        output += '分析中... ';
        break;
      case 'chinese':
        output += '分析中... ';
        break;
      case 'korean':
        output += '분석 중... ';
        break;
      case 'vietnamese':
        output += 'Đang phân tích... ';
        break;
      default:
        output += 'Analyzing... ';
    }

    output += `[${depth} analysis]\n\n`;

    // Components section
    if (components.length > 0) {
      output += 'Key Components Identified:\n';
      components.forEach((comp, index) => {
        output += `${index + 1}. ${comp.name} (${comp.type}) - Significance: ${(comp.significance * 100).toFixed(0)}%\n`;
      });
      output += '\n';
    }

    // Patterns section
    if (patterns.length > 0) {
      output += 'Patterns Detected:\n';
      patterns.forEach((pattern, index) => {
        output += `• ${pattern}\n`;
      });
      output += '\n';
    }

    // Insights section
    if (insights.length > 0) {
      output += 'Analytical Insights:\n';
      insights.forEach((insight, index) => {
        output += `→ ${insight}\n`;
      });
      output += '\n';
    }

    // Methodology section
    output += 'Analysis Methodology:\n';
    methodology.forEach((step, index) => {
      output += `${index + 1}. ${step}\n`;
    });

    return output.trim();
  }
}
