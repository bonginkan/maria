/**
 * Thinking Mode Plugin
 * Primary _reasoning mode for logical _analysis and problem-solving
 */

import {
  BaseModePlugin,
  ModeContext,
  ModeDisplayConfig,
  ModeResult,
  ModeTransition,
  ModeTrigger,
} from "../BaseModePlugin";
import { Service } from "../../core";

@Service({
  id: "thinking-mode",
  name: "ThinkingMode",
  version: "1.0.0",
  description:
    "Primary _reasoning mode for logical _analysis and problem-solving",
})
export class ThinkingMode extends BaseModePlugin {
  id = "thinking-mode";
  version = "1.0.0";
  
  readonly pluginId = "thinking";
  readonly pluginName = "Thinking";
  readonly category = "reasoning" as const;
  readonly version = "1.0.0";

  readonly triggers: ModeTrigger[] = [
    {
      pattern:
        /think|consider|analyze|reason|logic|problem|solve|understand|figure/i,
      language: "english",
      weight: 0.8,
    },
    {
      pattern: /考え|思考|検討|分析|理解|解決|問題/,
      language: "japanese",
      weight: 0.8,
    },
    {
      pattern: /思考|考虑|分析|理解|解决|问题/,
      language: "chinese",
      weight: 0.8,
    },
    {
      pattern: /생각|사고|고려|분석|이해|해결|문제/,
      language: "korean",
      weight: 0.8,
    },
    {
      pattern: /suy nghĩ|phân tích|hiểu|giải quyết|vấn đề/,
      language: "vietnamese",
      weight: 0.8,
    },
  ];

  readonly transitions: ModeTransition[] = [
    {
      fromMode: "*",
      toMode: "thinking",
      condition: (context) => context.confidence > 0.7,
      priority: 10,
      description: "Default mode for analytical tasks",
    },
    {
      fromMode: "thinking",
      toMode: "analyzing",
      condition: (context) =>
        context.input.includes("detail") || context.input.includes("deep"),
      priority: 8,
      description: "Transition to deeper _analysis",
    },
    {
      fromMode: "thinking",
      toMode: "planning",
      condition: (context) =>
        /plan|strategy|approach|steps/.test(context.input),
      priority: 7,
      description: "Transition to planning mode",
    },
    {
      fromMode: "thinking",
      toMode: "brainstorming",
      condition: (context) =>
        /idea|creative|brainstorm|innovative/.test(context.input),
      priority: 6,
      description: "Transition to creative thinking",
    },
  ];

  getDisplayConfig(): ModeDisplayConfig {
    return {
      symbol: "✽",
      color: "#3B82F6", // Blue
      animation: "pulse",
      description:
        "Engaging logical _reasoning and analytical thinking processes",
      displayName: "Thinking",
      category: "_reasoning",
    };
  }

  async execute(context: ModeContext): Promise<ModeResult> {
    const _startTime = performance.now();

    try {
      // Thinking mode processing logic
      const _analysis = await this.performThinkingAnalysis(context);

      // Determine if we should suggest mode transitions
      const _nextMode = this.suggestNextMode(context, _analysis);

      const _executionTime = performance.now() - _startTime;

      return {
        success: true,
        output: this.formatThinkingOutput(_analysis, context.language),
        _nextMode,
        _confidence: _analysis.confidence,
        _executionTime,
        metadata: {
          analysisType: _analysis.type,
          _keyPoints: _analysis.keyPoints,
          _complexity: _analysis.complexity,
          _reasoning: _analysis.reasoning,
        },
      };
    } catch (_error) {
      const _executionTime = performance.now() - _startTime;

      return {
        success: false,
        _confidence: 0,
        _executionTime,
        metadata: {} as Record<string, any>,
        _error: _error.message,
      };
    }
  }

  /**
   * Perform thinking _analysis on the input
   */
  private async performThinkingAnalysis(context: ModeContext): Promise<{
    type: "problem_solving" | "conceptual" | "analytical" | "comparative";
    _keyPoints: string[];
    _complexity: "low" | "medium" | "high";
    _confidence: number;
    _reasoning: string[];
  }> {
    const { input, language } = context;
    const _normalizedInput = input.toLowerCase();

    // Determine _analysis type
    let type: "problem_solving" | "conceptual" | "analytical" | "comparative" =
      "conceptual";

    if (/problem|issue|solve|fix|debug/.test(_normalizedInput)) {
      type = "problem_solving";
    } else if (/compare|versus|vs|difference|similar/.test(_normalizedInput)) {
      type = "comparative";
    } else if (/analyze|examine|investigate|study/.test(_normalizedInput)) {
      type = "analytical";
    }

    // Extract key points for thinking
    const _keyPoints = this.extractKeyPoints(input, language);

    // Determine _complexity based on input characteristics
    const _complexity = this.assessComplexity(input);

    // Generate _reasoning steps
    const _reasoning = this.generateReasoningSteps(type, _keyPoints, language);

    // Calculate _confidence based on clarity and structure
    const _confidence = this.calculateThinkingConfidence(
      input,
      _keyPoints.length,
    );

    return {
      type,
      _keyPoints,
      _complexity,
      _confidence,
      _reasoning,
    };
  }

  /**
   * Extract key points from input for _analysis
   */
  private extractKeyPoints(_input: string, _language: string): string[] {
    const _sentences = _input.split(/[.!?]/).filter((s) => s.trim().length > 5);
    const _keyPoints: string[] = [];

    // Extract key concepts, questions, and important statements
    _sentences.forEach((sentence) => {
      const _trimmed = sentence.trim();
      if (_trimmed.length < 10) {
        return;
      }

      // Identify questions
      if (
        /[?？]/.test(_trimmed) ||
        /what|how|why|when|where|who/.test(_trimmed.toLowerCase())
      ) {
        _keyPoints.push(`Question: ${_trimmed}`);
      }
      // Identify problems or issues
      else if (
        /problem|issue|_error|bug|fail|wrong/.test(_trimmed.toLowerCase())
      ) {
        _keyPoints.push(`Problem: ${_trimmed}`);
      }
      // Identify goals or objectives
      else if (
        /want|need|should|must|goal|objective/.test(_trimmed.toLowerCase())
      ) {
        _keyPoints.push(`Objective: ${_trimmed}`);
      }
      // Other important statements
      else if (_trimmed.length > 20) {
        _keyPoints.push(`Context: ${_trimmed}`);
      }
    });

    return _keyPoints.slice(0, 5); // Limit to top 5 key points
  }

  /**
   * Assess _complexity of the thinking task
   */
  private assessComplexity(input: string): "low" | "medium" | "high" {
    let score = 0;

    // Length factor
    if (input.length > 200) {
      score += 2;
    } else if (input.length > 100) {
      score += 1;
    }

    // Question _complexity
    const _questionCount = (input.match(/[?？]/g) || []).length;
    score += Math.min(_questionCount, 3);

    // Technical terms
    if (
      /algorithm|function|class|variable|database|api|server/.test(
        input.toLowerCase(),
      )
    ) {
      score += 2;
    }

    // Multiple concepts
    const _conceptWords = input
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 6 &&
          !/^(the|and|but|for|with|that|this|from|they|have|will|been|would)$/.test(
            word,
          ),
      );
    score += Math.min(Math.floor(_conceptWords.length / 5), 2);

    if (score >= 5) {
      return "high";
    }
    if (score >= 3) {
      return "medium";
    }
    return "low";
  }

  /**
   * Generate _reasoning steps based on _analysis type
   */
  private generateReasoningSteps(
    _type: string,
    _keyPoints: string[],
    _language: string,
  ): string[] {
    const steps: string[] = [];

    switch (_type) {
      case "problem_solving":
        steps.push("Identifying the core problem");
        steps.push("Analyzing contributing factors");
        steps.push("Evaluating potential solutions");
        steps.push("Considering implementation approach");
        break;

      case "analytical":
        steps.push("Breaking down the subject into components");
        steps.push("Examining relationships and patterns");
        steps.push("Evaluating evidence and data");
        steps.push("Drawing logical conclusions");
        break;

      case "comparative":
        steps.push("Identifying comparison criteria");
        steps.push("Analyzing similarities and differences");
        steps.push("Weighing pros and cons");
        steps.push("Drawing comparative insights");
        break;

      default: // conceptual
        steps.push("Understanding the core concepts");
        steps.push("Exploring implications and connections");
        steps.push("Considering different perspectives");
        steps.push("Synthesizing understanding");
        break;
    }

    return steps;
  }

  /**
   * Calculate _confidence in thinking _analysis
   */
  private calculateThinkingConfidence(
    _input: string,
    keyPointCount: number,
  ): number {
    let _confidence = 0.5; // Base _confidence

    // Boost for clear structure
    if (keyPointCount > 2) {
      _confidence += 0.2;
    }
    if (keyPointCount > 4) {
      _confidence += 0.1;
    }

    // Boost for specific questions or problems
    if (/[?？]/.test(_input)) {
      _confidence += 0.15;
    }

    // Boost for technical content
    if (/code|program|function|algorithm|debug/.test(_input.toLowerCase())) {
      _confidence += 0.1;
    }

    // Penalty for very short or vague input
    if (_input.length < 50) {
      _confidence -= 0.2;
    }
    if (/just|maybe|perhaps|might/.test(_input.toLowerCase())) {
      _confidence -= 0.1;
    }

    return Math.min(Math.max(_confidence, 0.1), 0.95);
  }

  /**
   * Suggest next mode based on _analysis
   */
  private suggestNextMode(
    _context: ModeContext,
    _analysis: unknown,
  ): string | undefined {
    const { input } = _context;
    const _normalizedInput = input.toLowerCase();

    // Suggest specific modes based on content
    if (
      (_analysis as any).complexity === "high" &&
      /detail|deep|thorough/.test(_normalizedInput)
    ) {
      return "analyzing";
    }

    if (/plan|strategy|steps|approach|how to/.test(_normalizedInput)) {
      return "planning";
    }

    if (/creative|idea|innovative|brainstorm/.test(_normalizedInput)) {
      return "brainstorming";
    }

    if (/calculate|math|number|formula/.test(_normalizedInput)) {
      return "calculating";
    }

    return undefined; // Stay in thinking mode
  }

  /**
   * Format thinking output based on language
   */
  private formatThinkingOutput(_analysis: unknown, language: string): string {
    const { type, _keyPoints, _complexity, _reasoning } = _analysis as any;

    let output = "";

    // Add thinking indicator
    switch (language) {
      case "japanese":
        output += "考え中... ";
        break;
      case "chinese":
        output += "思考中... ";
        break;
      case "korean":
        output += "생각 중... ";
        break;
      case "vietnamese":
        output += "Đang suy nghĩ... ";
        break;
      default:
        output += "Thinking... ";
    }

    // Add _analysis type
    output += `[${type.replace("_", " ")} - ${_complexity} _complexity]\n\n`;

    // Add key points if any
    if (_keyPoints.length > 0) {
      output += "Key considerations:\n";
      _keyPoints.forEach((point, _index) => {
        output += `${_index + 1}. ${point}\n`;
      });
      output += "\n";
    }

    // Add _reasoning process
    output += "Reasoning process:\n";
    _reasoning.forEach((_step: string, _index: number) => {
      output += `• ${_step}\n`;
    });

    return output.trim();
  }
}
