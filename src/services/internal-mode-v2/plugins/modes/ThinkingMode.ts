/**
 * Thinking Mode Plugin
 * Primary reasoning mode for logical analysis and problem-solving
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
  id: 'thinking-mode',
  name: 'ThinkingMode',
  version: '1.0.0',
  description: 'Primary reasoning mode for logical analysis and problem-solving',
})
export class ThinkingMode extends BaseModePlugin {
  readonly pluginId = 'thinking';
  readonly pluginName = 'Thinking';
  readonly category = 'reasoning' as const;
  readonly version = '1.0.0';

  readonly triggers: ModeTrigger[] = [
    {
      pattern: /think|consider|analyze|reason|logic|problem|solve|understand|figure/i,
      language: 'english',
      weight: 0.8,
    },
    {
      pattern: /考え|思考|検討|分析|理解|解決|問題/,
      language: 'japanese',
      weight: 0.8,
    },
    {
      pattern: /思考|考虑|分析|理解|解决|问题/,
      language: 'chinese',
      weight: 0.8,
    },
    {
      pattern: /생각|사고|고려|분석|이해|해결|문제/,
      language: 'korean',
      weight: 0.8,
    },
    {
      pattern: /suy nghĩ|phân tích|hiểu|giải quyết|vấn đề/,
      language: 'vietnamese',
      weight: 0.8,
    },
  ];

  readonly transitions: ModeTransition[] = [
    {
      fromMode: '*',
      toMode: 'thinking',
      condition: (context) => context.confidence > 0.7,
      priority: 10,
      description: 'Default mode for analytical tasks',
    },
    {
      fromMode: 'thinking',
      toMode: 'analyzing',
      condition: (context) => context.input.includes('detail') || context.input.includes('deep'),
      priority: 8,
      description: 'Transition to deeper analysis',
    },
    {
      fromMode: 'thinking',
      toMode: 'planning',
      condition: (context) => /plan|strategy|approach|steps/.test(context.input),
      priority: 7,
      description: 'Transition to planning mode',
    },
    {
      fromMode: 'thinking',
      toMode: 'brainstorming',
      condition: (context) => /idea|creative|brainstorm|innovative/.test(context.input),
      priority: 6,
      description: 'Transition to creative thinking',
    },
  ];

  getDisplayConfig(): ModeDisplayConfig {
    return {
      symbol: '✽',
      color: '#3B82F6', // Blue
      animation: 'pulse',
      description: 'Engaging logical reasoning and analytical thinking processes',
      displayName: 'Thinking',
      category: 'reasoning',
    };
  }

  async execute(context: ModeContext): Promise<ModeResult> {
    const startTime = performance.now();

    try {
      // Thinking mode processing logic
      const analysis = await this.performThinkingAnalysis(context);

      // Determine if we should suggest mode transitions
      const nextMode = this.suggestNextMode(context, analysis);

      const executionTime = performance.now() - startTime;

      return {
        success: true,
        output: this.formatThinkingOutput(analysis, context.language),
        nextMode,
        confidence: analysis.confidence,
        executionTime,
        metadata: {
          analysisType: analysis.type,
          keyPoints: analysis.keyPoints,
          complexity: analysis.complexity,
          reasoning: analysis.reasoning,
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
   * Perform thinking analysis on the input
   */
  private async performThinkingAnalysis(context: ModeContext): Promise<{
    type: 'problem_solving' | 'conceptual' | 'analytical' | 'comparative';
    keyPoints: string[];
    complexity: 'low' | 'medium' | 'high';
    confidence: number;
    reasoning: string[];
  }> {
    const { input, language } = context;
    const normalizedInput = input.toLowerCase();

    // Determine analysis type
    let type: 'problem_solving' | 'conceptual' | 'analytical' | 'comparative' = 'conceptual';

    if (/problem|issue|solve|fix|debug/.test(normalizedInput)) {
      type = 'problem_solving';
    } else if (/compare|versus|vs|difference|similar/.test(normalizedInput)) {
      type = 'comparative';
    } else if (/analyze|examine|investigate|study/.test(normalizedInput)) {
      type = 'analytical';
    }

    // Extract key points for thinking
    const keyPoints = this.extractKeyPoints(input, language);

    // Determine complexity based on input characteristics
    const complexity = this.assessComplexity(input);

    // Generate reasoning steps
    const reasoning = this.generateReasoningSteps(type, keyPoints, language);

    // Calculate confidence based on clarity and structure
    const confidence = this.calculateThinkingConfidence(input, keyPoints.length);

    return {
      type,
      keyPoints,
      complexity,
      confidence,
      reasoning,
    };
  }

  /**
   * Extract key points from input for analysis
   */
  private extractKeyPoints(input: string, language: string): string[] {
    const sentences = input.split(/[.!?]/).filter((s) => s.trim().length > 5);
    const keyPoints: string[] = [];

    // Extract key concepts, questions, and important statements
    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();
      if (trimmed.length < 10) return;

      // Identify questions
      if (/[?？]/.test(trimmed) || /what|how|why|when|where|who/.test(trimmed.toLowerCase())) {
        keyPoints.push(`Question: ${trimmed}`);
      }
      // Identify problems or issues
      else if (/problem|issue|error|bug|fail|wrong/.test(trimmed.toLowerCase())) {
        keyPoints.push(`Problem: ${trimmed}`);
      }
      // Identify goals or objectives
      else if (/want|need|should|must|goal|objective/.test(trimmed.toLowerCase())) {
        keyPoints.push(`Objective: ${trimmed}`);
      }
      // Other important statements
      else if (trimmed.length > 20) {
        keyPoints.push(`Context: ${trimmed}`);
      }
    });

    return keyPoints.slice(0, 5); // Limit to top 5 key points
  }

  /**
   * Assess complexity of the thinking task
   */
  private assessComplexity(input: string): 'low' | 'medium' | 'high' {
    let score = 0;

    // Length factor
    if (input.length > 200) score += 2;
    else if (input.length > 100) score += 1;

    // Question complexity
    const questionCount = (input.match(/[?？]/g) || []).length;
    score += Math.min(questionCount, 3);

    // Technical terms
    if (/algorithm|function|class|variable|database|api|server/.test(input.toLowerCase())) {
      score += 2;
    }

    // Multiple concepts
    const conceptWords = input
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 6 &&
          !/^(the|and|but|for|with|that|this|from|they|have|will|been|would)$/.test(word),
      );
    score += Math.min(Math.floor(conceptWords.length / 5), 2);

    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * Generate reasoning steps based on analysis type
   */
  private generateReasoningSteps(type: string, keyPoints: string[], language: string): string[] {
    const steps: string[] = [];

    switch (type) {
      case 'problem_solving':
        steps.push('Identifying the core problem');
        steps.push('Analyzing contributing factors');
        steps.push('Evaluating potential solutions');
        steps.push('Considering implementation approach');
        break;

      case 'analytical':
        steps.push('Breaking down the subject into components');
        steps.push('Examining relationships and patterns');
        steps.push('Evaluating evidence and data');
        steps.push('Drawing logical conclusions');
        break;

      case 'comparative':
        steps.push('Identifying comparison criteria');
        steps.push('Analyzing similarities and differences');
        steps.push('Weighing pros and cons');
        steps.push('Drawing comparative insights');
        break;

      default: // conceptual
        steps.push('Understanding the core concepts');
        steps.push('Exploring implications and connections');
        steps.push('Considering different perspectives');
        steps.push('Synthesizing understanding');
        break;
    }

    return steps;
  }

  /**
   * Calculate confidence in thinking analysis
   */
  private calculateThinkingConfidence(input: string, keyPointCount: number): number {
    let confidence = 0.5; // Base confidence

    // Boost for clear structure
    if (keyPointCount > 2) confidence += 0.2;
    if (keyPointCount > 4) confidence += 0.1;

    // Boost for specific questions or problems
    if (/[?？]/.test(input)) confidence += 0.15;

    // Boost for technical content
    if (/code|program|function|algorithm|debug/.test(input.toLowerCase())) {
      confidence += 0.1;
    }

    // Penalty for very short or vague input
    if (input.length < 50) confidence -= 0.2;
    if (/just|maybe|perhaps|might/.test(input.toLowerCase())) confidence -= 0.1;

    return Math.min(Math.max(confidence, 0.1), 0.95);
  }

  /**
   * Suggest next mode based on analysis
   */
  private suggestNextMode(context: ModeContext, analysis: unknown): string | undefined {
    const { input } = context;
    const normalizedInput = input.toLowerCase();

    // Suggest specific modes based on content
    if (analysis.complexity === 'high' && /detail|deep|thorough/.test(normalizedInput)) {
      return 'analyzing';
    }

    if (/plan|strategy|steps|approach|how to/.test(normalizedInput)) {
      return 'planning';
    }

    if (/creative|idea|innovative|brainstorm/.test(normalizedInput)) {
      return 'brainstorming';
    }

    if (/calculate|math|number|formula/.test(normalizedInput)) {
      return 'calculating';
    }

    return undefined; // Stay in thinking mode
  }

  /**
   * Format thinking output based on language
   */
  private formatThinkingOutput(analysis: unknown, language: string): string {
    const { type, keyPoints, complexity, reasoning } = analysis;

    let output = '';

    // Add thinking indicator
    switch (language) {
      case 'japanese':
        output += '考え中... ';
        break;
      case 'chinese':
        output += '思考中... ';
        break;
      case 'korean':
        output += '생각 중... ';
        break;
      case 'vietnamese':
        output += 'Đang suy nghĩ... ';
        break;
      default:
        output += 'Thinking... ';
    }

    // Add analysis type
    output += `[${type.replace('_', ' ')} - ${complexity} complexity]\n\n`;

    // Add key points if any
    if (keyPoints.length > 0) {
      output += 'Key considerations:\n';
      keyPoints.forEach((point, index) => {
        output += `${index + 1}. ${point}\n`;
      });
      output += '\n';
    }

    // Add reasoning process
    output += 'Reasoning process:\n';
    reasoning.forEach((step: string, index: number) => {
      output += `• ${step}\n`;
    });

    return output.trim();
  }
}
