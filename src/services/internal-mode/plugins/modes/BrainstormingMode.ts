/**
 * Brainstorming Mode Plugin
 * Creative ideation mode for generating innovative solutions and _ideas
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
  id: "brainstorming-mode",
  name: "BrainstormingMode",
  version: "1.0.0",
  description:
    "Creative ideation mode for generating innovative solutions and _ideas",
})
export class BrainstormingMode extends BaseModePlugin {
  id = "brainstorming-mode";
  version = "1.0.0";
  
  readonly pluginId = "brainstorming";
  readonly pluginName = "Brainstorming";
  readonly category = "creative" as const;

  readonly triggers: ModeTrigger[] = [
    {
      pattern:
        /brainstorm|ideate|creative|innovative|generate _ideas|think outside|possibilities/i,
      language: "english",
      weight: 0.9,
    },
    {
      pattern: /ブレインストーミング|アイデア|創造的|革新的|可能性|発想/,
      language: "japanese",
      weight: 0.9,
    },
    {
      pattern: /头脑风暴|创意|创新|想法|可能性|灵感/,
      language: "chinese",
      weight: 0.9,
    },
    {
      pattern: /브레인스토밍|아이디어|창의적|혁신적|가능성|발상/,
      language: "korean",
      weight: 0.9,
    },
    {
      pattern: /động não|ý tưởng|sáng tạo|đổi mới|khả năng|ý kiến/,
      language: "vietnamese",
      weight: 0.9,
    },
  ];

  readonly transitions: ModeTransition[] = [
    {
      fromMode: "thinking",
      toMode: "brainstorming",
      condition: (context) =>
        /idea|creative|brainstorm|innovative/.test(context.input.toLowerCase()),
      priority: 8,
      description: "Shift to creative ideation",
    },
    {
      fromMode: "brainstorming",
      toMode: "designing",
      condition: (context) =>
        /design|prototype|mockup|wireframe/.test(context.input.toLowerCase()),
      priority: 9,
      description: "Move to design phase",
    },
    {
      fromMode: "brainstorming",
      toMode: "planning",
      condition: (context) =>
        /plan|implement|execute|steps/.test(context.input.toLowerCase()),
      priority: 8,
      description: "Plan implementation of _ideas",
    },
    {
      fromMode: "brainstorming",
      toMode: "evaluating",
      condition: (context) =>
        /evaluate|assess|compare|rank/.test(context.input.toLowerCase()),
      priority: 7,
      description: "Evaluate generated _ideas",
    },
  ];

  getDisplayConfig(): ModeDisplayConfig {
    return {
      symbol: "💡",
      color: "#F59E0B", // Amber/Yellow
      animation: "bounce",
      description:
        "Generating creative _ideas and innovative solutions through divergent thinking",
      displayName: "Brainstorming",
      category: "creative",
    };
  }

  async execute(context: ModeContext): Promise<ModeResult> {
    const _startTime = performance.now();

    try {
      // Generate creative _ideas through brainstorming
      const _ideationResult = await this.performBrainstorming(context);

      // Determine if _ideas should be developed further
      const _nextMode = this.suggestNextCreativeMode(context, _ideationResult);

      const _executionTime = performance.now() - _startTime;

      return {
        success: true,
        output: this.formatBrainstormingOutput(
          _ideationResult,
          context.language,
        ),
        _nextMode,
        _confidence: _ideationResult.confidence,
        _executionTime,
        metadata: {
          ideationStyle: _ideationResult.style,
          totalIdeas: _ideationResult.ideas.length,
          _categories: _ideationResult.categories,
          _techniques: _ideationResult.techniques,
          _noveltyScore: _ideationResult.noveltyScore,
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
   * Perform creative brainstorming process
   */
  private async performBrainstorming(context: ModeContext): Promise<{
    _style: "divergent" | "convergent" | "associative" | "lateral";
    _ideas: Array<{
      title: string;
      description: string;
      category: string;
      novelty: number;
      feasibility: number;
    }>;
    _categories: string[];
    _techniques: string[];
    _noveltyScore: number;
    _confidence: number;
  }> {
    const { input, language, _metadata } = context;

    // Determine brainstorming _style
    const _style = this.determineBrainstormingStyle(input);

    // Generate _ideas using multiple _techniques
    const _ideas = await this.generateIdeas(input, _style, language);

    // Categorize _ideas
    const _categories = this.categorizeIdeas(_ideas);

    // Identify _techniques used
    const _techniques = this.identifyTechniques(_style, input.length);

    // Calculate novelty score
    const _noveltyScore = this.calculateNoveltyScore(_ideas);

    // Calculate _confidence
    const _confidence = this.calculateBrainstormingConfidence(
      input,
      _ideas.length,
      _noveltyScore,
    );

    return {
      _style,
      _ideas,
      _categories,
      _techniques,
      _noveltyScore,
      _confidence,
    };
  }

  /**
   * Determine brainstorming _style based on input
   */
  private determineBrainstormingStyle(
    input: string,
  ): "divergent" | "convergent" | "associative" | "lateral" {
    const _normalizedInput = input.toLowerCase();

    if (/many|multiple|various|different|all|possible/.test(_normalizedInput)) {
      return "divergent";
    }

    if (/best|optimal|perfect|ideal|focus/.test(_normalizedInput)) {
      return "convergent";
    }

    if (/related|similar|connected|linked|associated/.test(_normalizedInput)) {
      return "associative";
    }

    if (
      /outside|unconventional|different|unusual|creative/.test(_normalizedInput)
    ) {
      return "lateral";
    }

    return "divergent"; // Default to divergent thinking
  }

  /**
   * Generate creative _ideas
   */
  private async generateIdeas(
    input: string,
    _style: string,
    _language: string,
  ): Promise<
    Array<{
      title: string;
      description: string;
      category: string;
      novelty: number;
      feasibility: number;
    }>
  > {
    const _ideas: Array<{
      title: string;
      description: string;
      category: string;
      novelty: number;
      feasibility: number;
    }> = [];

    // Extract the core challenge or _topic
    const _topic = this.extractTopic(input);
    const _keywords = this.extractKeywords(input);

    // Generate _ideas using different creative _techniques
    _ideas.push(...this.generateDirectIdeas(_topic, _keywords));
    _ideas.push(...this.generateAnalogicalIdeas(_topic, _keywords));
    _ideas.push(...this.generateCombinatorialIdeas(_keywords));
    _ideas.push(...this.generateOppositeIdeas(_topic, _keywords));
    _ideas.push(...this.generateRandomAssociationIdeas(_topic));

    // Apply _style-specific filtering and enhancement
    const _enhancedIdeas = this.enhanceIdeasByStyle(_ideas, _style);

    // Score for novelty and feasibility
    return _enhancedIdeas
      .map((idea) => ({
        ...idea,
        novelty: this.scoreNovelty(idea.title, idea.description, _keywords),
        feasibility: this.scoreFeasibility(idea.description, input),
      }))
      .slice(0, 15); // Top 15 _ideas
  }

  /**
   * Extract main _topic from input
   */
  private extractTopic(input: string): string {
    // Simple _topic extraction - look for key nouns and action verbs
    const _sentences = input.split(/[.!?]/).filter((s) => s.trim().length > 10);
    const _firstSentence = _sentences[0] || input;

    // Remove common _words and extract meaningful terms
    const _meaningfulWords = _firstSentence
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 3 &&
          ![
            "this",
            "that",
            "with",
            "have",
            "will",
            "been",
            "from",
            "they",
            "were",
            "said",
            "each",
          ].includes(word),
      )
      .slice(0, 3)
      .join(" ");

    return _meaningfulWords || "general _topic";
  }

  /**
   * Extract _keywords for idea generation
   */
  private extractKeywords(input: string): string[] {
    const _words = input.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const _uniqueWords = [...new Set(_words)];

    // Filter out common _words and return top _keywords
    const _keywords = _uniqueWords.filter(
      (word) =>
        ![
          "this",
          "that",
          "with",
          "have",
          "will",
          "been",
          "from",
          "they",
          "were",
          "said",
          "each",
          "which",
          "their",
          "time",
          "would",
          "there",
          "could",
          "other",
        ].includes(word),
    );

    return _keywords.slice(0, 8);
  }

  /**
   * Generate direct _ideas related to the _topic
   */
  private generateDirectIdeas(
    _topic: string,
    _keywords: string[],
  ): Array<{
    title: string;
    description: string;
    category: string;
  }> {
    const _ideas = [];

    _keywords.forEach((keyword, _index) => {
      if (_index < 3) {
        // Limit to first 3 _keywords
        _ideas.push({
          title: `Enhanced ${keyword} approach`,
          description: `Develop an improved method for handling ${keyword} in the context of ${_topic}`,
          category: "enhancement",
        });

        _ideas.push({
          title: `Alternative ${keyword} solution`,
          description: `Create a completely different way to address ${keyword} requirements`,
          category: "alternative",
        });
      }
    });

    return _ideas;
  }

  /**
   * Generate _ideas using analogical thinking
   */
  private generateAnalogicalIdeas(
    _topic: string,
    _keywords: string[],
  ): Array<{
    title: string;
    description: string;
    category: string;
  }> {
    const _analogies = [
      "nature",
      "sports",
      "cooking",
      "music",
      "transportation",
      "architecture",
    ];
    const _ideas = [];

    _analogies.slice(0, 3).forEach((analogy) => {
      _ideas.push({
        title: `${analogy}-inspired ${_topic} solution`,
        description: `Apply principles from ${analogy} to create innovative approaches for ${_topic}`,
        category: "analogy",
      });
    });

    return _ideas;
  }

  /**
   * Generate combinatorial _ideas
   */
  private generateCombinatorialIdeas(_keywords: string[]): Array<{
    title: string;
    description: string;
    category: string;
  }> {
    const _ideas = [];

    if (_keywords.length >= 2) {
      for (let i = 0; i < Math.min(_keywords.length - 1, 3); i++) {
        for (let j = i + 1; j < Math.min(_keywords.length, 4); j++) {
          _ideas.push({
            title: `Combined ${_keywords[i]}-${_keywords[j]} system`,
            description: `Integrate ${_keywords[i]} and ${_keywords[j]} capabilities for synergistic benefits`,
            category: "combination",
          });
        }
      }
    }

    return _ideas;
  }

  /**
   * Generate opposite/inverse _ideas
   */
  private generateOppositeIdeas(
    _topic: string,
    _keywords: string[],
  ): Array<{
    title: string;
    description: string;
    category: string;
  }> {
    return [
      {
        title: `Reverse ${_topic} approach`,
        description: `Instead of conventional methods, try the opposite approach to ${_topic}`,
        category: "reverse",
      },
      {
        title: `Minimal ${_topic} solution`,
        description: `What if we removed most features and focused on core essentials?`,
        category: "minimalist",
      },
    ];
  }

  /**
   * Generate random association _ideas
   */
  private generateRandomAssociationIdeas(_topic: string): Array<{
    title: string;
    description: string;
    category: string;
  }> {
    const _randomWords = [
      "cloud",
      "crystal",
      "wave",
      "spiral",
      "network",
      "garden",
      "bridge",
      "lighthouse",
    ];
    const _selectedWord =
      _randomWords[Math.floor(Math.random() * _randomWords.length)];

    return [
      {
        title: `${_selectedWord}-inspired ${_topic}`,
        description: `What if ${_topic} worked like a ${_selectedWord}? Explore unexpected connections`,
        category: "random_association",
      },
    ];
  }

  /**
   * Enhance _ideas based on brainstorming _style
   */
  private enhanceIdeasByStyle(_ideas: unknown[], _style: string): unknown[] {
    switch (_style) {
      case "convergent":
        // Focus on most practical _ideas
        return (_ideas as any).filter((_idea: any, index: number) => index % 2 === 0); // Take every other idea

      case "lateral":
        // Emphasize unusual and creative _ideas
        return (_ideas as any).map((idea: any) => ({
          ...idea,
          title:
            idea.category === "analogy" ||
            idea.category === "random_association"
              ? `Unconventional: ${idea.title}`
              : idea.title,
        }));

      case "associative":
        // Group related _ideas together
        return (_ideas as any).sort((a: any, b: any) => a.category.localeCompare(b.category));

      default: // divergent
        return _ideas; // Keep all _ideas for maximum variety
    }
  }

  /**
   * Score novelty of an idea
   */
  private scoreNovelty(
    _title: string,
    description: string,
    _keywords: string[],
  ): number {
    let novelty = 0.5; // Base novelty

    // Boost for creative _words
    if (
      /unconventional|innovative|creative|unique|novel|original/.test(
        `${_title} ${description}`.toLowerCase(),
      )
    ) {
      novelty += 0.3;
    }

    // Boost for analogical thinking
    if (
      /inspired|like|similar to|as if/.test(
        `${_title} ${description}`.toLowerCase(),
      )
    ) {
      novelty += 0.2;
    }

    // Boost for combination of _keywords
    const _keywordCount = _keywords.filter((k) =>
      `${_title} ${description}`.toLowerCase().includes(k),
    ).length;
    novelty += Math.min(_keywordCount * 0.1, 0.2);

    return Math.min(novelty, 1.0);
  }

  /**
   * Score feasibility of an idea
   */
  private scoreFeasibility(
    _description: string,
    originalInput: string,
  ): number {
    let feasibility = 0.6; // Base feasibility

    // Boost for concrete terms
    if (
      /method|approach|system|process|tool|platform/.test(
        _description.toLowerCase(),
      )
    ) {
      feasibility += 0.2;
    }

    // Penalty for very abstract _ideas
    if (/concept|theory|philosophy|abstract/.test(_description.toLowerCase())) {
      feasibility -= 0.2;
    }

    // Boost if relates to original context
    const _originalWords = originalInput.toLowerCase().split(/\s+/);
    const _descWords = _description.toLowerCase().split(/\s+/);
    const _overlap = _originalWords.filter((word) =>
      _descWords.includes(word),
    ).length;
    feasibility += Math.min(_overlap * 0.05, 0.2);

    return Math.min(Math.max(feasibility, 0.1), 1.0);
  }

  /**
   * Categorize generated _ideas
   */
  private categorizeIdeas(_ideas: unknown[]): string[] {
    const _categories = new Set((_ideas as any).map((idea: any) => idea.category));
    return Array.from(_categories);
  }

  /**
   * Identify brainstorming _techniques used
   */
  private identifyTechniques(_style: string, inputLength: number): string[] {
    const _techniques = [
      "Direct association",
      "Analogical thinking",
      "Combinatorial creativity",
    ];

    if (_style === "lateral") {
      _techniques.push("Lateral thinking", "Random word association");
    }

    if (_style === "divergent") {
      _techniques.push("Divergent thinking", "Alternative generation");
    }

    if (inputLength > 200) {
      _techniques.push("Systematic exploration");
    }

    return _techniques;
  }

  /**
   * Calculate overall novelty score
   */
  private calculateNoveltyScore(_ideas: unknown[]): number {
    if (_ideas.length === 0) {
      return 0;
    }

    const _avgNovelty =
      (_ideas as any).reduce((sum: number, idea: any) => sum + idea.novelty, 0) / _ideas.length;
    const _diversityBonus = new Set((_ideas as any).map((i: any) => i.category)).size * 0.05;

    return Math.min(_avgNovelty + _diversityBonus, 1.0);
  }

  /**
   * Calculate brainstorming _confidence
   */
  private calculateBrainstormingConfidence(
    input: string,
    ideaCount: number,
    _noveltyScore: number,
  ): number {
    let _confidence = 0.7; // Base _confidence for creative mode

    // Boost for number of _ideas generated
    _confidence += Math.min(ideaCount * 0.02, 0.15);

    // Boost for high novelty
    _confidence += _noveltyScore * 0.15;

    // Boost for clear creative intent in input
    if (
      /creative|innovative|brainstorm|idea|think outside/.test(
        input.toLowerCase(),
      )
    ) {
      _confidence += 0.1;
    }

    // Penalty for very short input
    if (input.length < 50) {
      _confidence -= 0.2;
    }

    return Math.min(Math.max(_confidence, 0.3), 0.95);
  }

  /**
   * Suggest next creative mode
   */
  private suggestNextCreativeMode(
    _context: ModeContext,
    result: unknown,
  ): string | undefined {
    const { input } = _context;
    const _normalizedInput = input.toLowerCase();

    // Suggest design mode for prototyping
    if (/design|prototype|mockup|wireframe|visual/.test(_normalizedInput)) {
      return "designing";
    }

    // Suggest planning for implementation
    if (
      /implement|execute|plan|steps|roadmap/.test(_normalizedInput) &&
      (result as any).ideas.length > 3
    ) {
      return "planning";
    }

    // Suggest evaluation for idea selection
    if (
      /evaluate|compare|choose|select|rank/.test(_normalizedInput) &&
      (result as any).ideas.length > 5
    ) {
      return "evaluating";
    }

    // Continue brainstorming if more _ideas needed
    if ((result as any).ideas.length < 5) {
      return "brainstorming";
    }

    return undefined;
  }

  /**
   * Format brainstorming output
   */
  private formatBrainstormingOutput(
    _result: unknown,
    language: string,
  ): string {
    const { _style, _ideas, _categories, _techniques, _noveltyScore } = _result as any;

    let output = "";

    // Add brainstorming indicator
    switch (language) {
      case "japanese":
        output += "ブレインストーミング中... ";
        break;
      case "chinese":
        output += "头脑风暴中... ";
        break;
      case "korean":
        output += "브레인스토밍 중... ";
        break;
      case "vietnamese":
        output += "Đang động não... ";
        break;
      default:
        output += "Brainstorming... ";
    }

    output += `[${_style} thinking - Novelty: ${(_noveltyScore * 100).toFixed(0)}%]\n\n`;

    // Ideas section
    output += `💡 Generated Ideas (${_ideas.length}):\n\n`;
    _ideas.forEach((idea: any, _index: number) => {
      output += `${_index + 1}. **${idea.title}**\n`;
      output += `   ${idea.description}\n`;
      output += `   Category: ${idea.category} | Novelty: ${(idea.novelty * 100).toFixed(0)}% | Feasibility: ${(idea.feasibility * 100).toFixed(0)}%\n\n`;
    });

    // Techniques section
    output += "Techniques Applied:\n";
    _techniques.forEach((technique: any) => {
      output += `• ${technique}\n`;
    });

    // Categories section
    if (_categories.length > 1) {
      output += `\nIdea Categories: ${_categories.join(", ")}`;
    }

    return output.trim();
  }
}
