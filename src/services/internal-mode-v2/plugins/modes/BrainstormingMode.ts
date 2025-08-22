/**
 * Brainstorming Mode Plugin
 * Creative ideation mode for generating innovative solutions and ideas
 */

import {
  BaseModePlugin,
  ModeContext,
  ModeDisplayConfig,
  ModeResult,
  ModeTransition,
  ModeTrigger,
} from '../BaseModePlugin';
import { Service } from '../../core';

@Service({
  id: 'brainstorming-mode',
  name: 'BrainstormingMode',
  version: '1.0.0',
  description: 'Creative ideation mode for generating innovative solutions and ideas',
})
export class BrainstormingMode extends BaseModePlugin {
  readonly pluginId = 'brainstorming';
  readonly pluginName = 'Brainstorming';
  readonly category = 'creative' as const;
  readonly version = '1.0.0';

  readonly triggers: ModeTrigger[] = [
    {
      pattern: /brainstorm|ideate|creative|innovative|generate ideas|think outside|possibilities/i,
      language: 'english',
      weight: 0.9,
    },
    {
      pattern: /ブレインストーミング|アイデア|創造的|革新的|可能性|発想/,
      language: 'japanese',
      weight: 0.9,
    },
    {
      pattern: /头脑风暴|创意|创新|想法|可能性|灵感/,
      language: 'chinese',
      weight: 0.9,
    },
    {
      pattern: /브레인스토밍|아이디어|창의적|혁신적|가능성|발상/,
      language: 'korean',
      weight: 0.9,
    },
    {
      pattern: /động não|ý tưởng|sáng tạo|đổi mới|khả năng|ý kiến/,
      language: 'vietnamese',
      weight: 0.9,
    },
  ];

  readonly transitions: ModeTransition[] = [
    {
      fromMode: 'thinking',
      toMode: 'brainstorming',
      condition: (context) =>
        /idea|creative|brainstorm|innovative/.test(context.input.toLowerCase()),
      priority: 8,
      description: 'Shift to creative ideation',
    },
    {
      fromMode: 'brainstorming',
      toMode: 'designing',
      condition: (context) => /design|prototype|mockup|wireframe/.test(context.input.toLowerCase()),
      priority: 9,
      description: 'Move to design phase',
    },
    {
      fromMode: 'brainstorming',
      toMode: 'planning',
      condition: (context) => /plan|implement|execute|steps/.test(context.input.toLowerCase()),
      priority: 8,
      description: 'Plan implementation of ideas',
    },
    {
      fromMode: 'brainstorming',
      toMode: 'evaluating',
      condition: (context) => /evaluate|assess|compare|rank/.test(context.input.toLowerCase()),
      priority: 7,
      description: 'Evaluate generated ideas',
    },
  ];

  getDisplayConfig(): ModeDisplayConfig {
    return {
      symbol: '💡',
      color: '#F59E0B', // Amber/Yellow
      animation: 'bounce',
      description: 'Generating creative ideas and innovative solutions through divergent thinking',
      displayName: 'Brainstorming',
      category: 'creative',
    };
  }

  async execute(context: ModeContext): Promise<ModeResult> {
    const startTime = performance.now();

    try {
      // Generate creative ideas through brainstorming
      const ideationResult = await this.performBrainstorming(context);

      // Determine if ideas should be developed further
      const nextMode = this.suggestNextCreativeMode(context, ideationResult);

      const executionTime = performance.now() - startTime;

      return {
        success: true,
        output: this.formatBrainstormingOutput(ideationResult, context.language),
        nextMode,
        confidence: ideationResult.confidence,
        executionTime,
        metadata: {
          ideationStyle: ideationResult.style,
          totalIdeas: ideationResult.ideas.length,
          categories: ideationResult.categories,
          techniques: ideationResult.techniques,
          noveltyScore: ideationResult.noveltyScore,
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
   * Perform creative brainstorming process
   */
  private async performBrainstorming(context: ModeContext): Promise<{
    style: 'divergent' | 'convergent' | 'associative' | 'lateral';
    ideas: Array<{
      title: string;
      description: string;
      category: string;
      novelty: number;
      feasibility: number;
    }>;
    categories: string[];
    techniques: string[];
    noveltyScore: number;
    confidence: number;
  }> {
    const { input, language, metadata } = context;

    // Determine brainstorming style
    const style = this.determineBrainstormingStyle(input);

    // Generate ideas using multiple techniques
    const ideas = await this.generateIdeas(input, style, language);

    // Categorize ideas
    const categories = this.categorizeIdeas(ideas);

    // Identify techniques used
    const techniques = this.identifyTechniques(style, input.length);

    // Calculate novelty score
    const noveltyScore = this.calculateNoveltyScore(ideas);

    // Calculate confidence
    const confidence = this.calculateBrainstormingConfidence(input, ideas.length, noveltyScore);

    return {
      style,
      ideas,
      categories,
      techniques,
      noveltyScore,
      confidence,
    };
  }

  /**
   * Determine brainstorming style based on input
   */
  private determineBrainstormingStyle(
    input: string,
  ): 'divergent' | 'convergent' | 'associative' | 'lateral' {
    const normalizedInput = input.toLowerCase();

    if (/many|multiple|various|different|all|possible/.test(normalizedInput)) {
      return 'divergent';
    }

    if (/best|optimal|perfect|ideal|focus/.test(normalizedInput)) {
      return 'convergent';
    }

    if (/related|similar|connected|linked|associated/.test(normalizedInput)) {
      return 'associative';
    }

    if (/outside|unconventional|different|unusual|creative/.test(normalizedInput)) {
      return 'lateral';
    }

    return 'divergent'; // Default to divergent thinking
  }

  /**
   * Generate creative ideas
   */
  private async generateIdeas(
    input: string,
    style: string,
    language: string,
  ): Promise<
    Array<{
      title: string;
      description: string;
      category: string;
      novelty: number;
      feasibility: number;
    }>
  > {
    const ideas: Array<{
      title: string;
      description: string;
      category: string;
      novelty: number;
      feasibility: number;
    }> = [];

    // Extract the core challenge or topic
    const topic = this.extractTopic(input);
    const keywords = this.extractKeywords(input);

    // Generate ideas using different creative techniques
    ideas.push(...this.generateDirectIdeas(topic, keywords));
    ideas.push(...this.generateAnalogicalIdeas(topic, keywords));
    ideas.push(...this.generateCombinatorialIdeas(keywords));
    ideas.push(...this.generateOppositeIdeas(topic, keywords));
    ideas.push(...this.generateRandomAssociationIdeas(topic));

    // Apply style-specific filtering and enhancement
    const enhancedIdeas = this.enhanceIdeasByStyle(ideas, style);

    // Score for novelty and feasibility
    return enhancedIdeas
      .map((idea) => ({
        ...idea,
        novelty: this.scoreNovelty(idea.title, idea.description, keywords),
        feasibility: this.scoreFeasibility(idea.description, input),
      }))
      .slice(0, 15); // Top 15 ideas
  }

  /**
   * Extract main topic from input
   */
  private extractTopic(input: string): string {
    // Simple topic extraction - look for key nouns and action verbs
    const sentences = input.split(/[.!?]/).filter((s) => s.trim().length > 10);
    const firstSentence = sentences[0] || input;

    // Remove common words and extract meaningful terms
    const meaningfulWords = firstSentence
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 3 &&
          ![
            'this',
            'that',
            'with',
            'have',
            'will',
            'been',
            'from',
            'they',
            'were',
            'said',
            'each',
          ].includes(word),
      )
      .slice(0, 3)
      .join(' ');

    return meaningfulWords || 'general topic';
  }

  /**
   * Extract keywords for idea generation
   */
  private extractKeywords(input: string): string[] {
    const words = input.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const uniqueWords = [...new Set(words)];

    // Filter out common words and return top keywords
    const keywords = uniqueWords.filter(
      (word) =>
        ![
          'this',
          'that',
          'with',
          'have',
          'will',
          'been',
          'from',
          'they',
          'were',
          'said',
          'each',
          'which',
          'their',
          'time',
          'would',
          'there',
          'could',
          'other',
        ].includes(word),
    );

    return keywords.slice(0, 8);
  }

  /**
   * Generate direct ideas related to the topic
   */
  private generateDirectIdeas(
    topic: string,
    keywords: string[],
  ): Array<{
    title: string;
    description: string;
    category: string;
  }> {
    const ideas = [];

    keywords.forEach((keyword, index) => {
      if (index < 3) {
        // Limit to first 3 keywords
        ideas.push({
          title: `Enhanced ${keyword} approach`,
          description: `Develop an improved method for handling ${keyword} in the context of ${topic}`,
          category: 'enhancement',
        });

        ideas.push({
          title: `Alternative ${keyword} solution`,
          description: `Create a completely different way to address ${keyword} requirements`,
          category: 'alternative',
        });
      }
    });

    return ideas;
  }

  /**
   * Generate ideas using analogical thinking
   */
  private generateAnalogicalIdeas(
    topic: string,
    keywords: string[],
  ): Array<{
    title: string;
    description: string;
    category: string;
  }> {
    const analogies = ['nature', 'sports', 'cooking', 'music', 'transportation', 'architecture'];
    const ideas = [];

    analogies.slice(0, 3).forEach((analogy) => {
      ideas.push({
        title: `${analogy}-inspired ${topic} solution`,
        description: `Apply principles from ${analogy} to create innovative approaches for ${topic}`,
        category: 'analogy',
      });
    });

    return ideas;
  }

  /**
   * Generate combinatorial ideas
   */
  private generateCombinatorialIdeas(keywords: string[]): Array<{
    title: string;
    description: string;
    category: string;
  }> {
    const ideas = [];

    if (keywords.length >= 2) {
      for (let i = 0; i < Math.min(keywords.length - 1, 3); i++) {
        for (let j = i + 1; j < Math.min(keywords.length, 4); j++) {
          ideas.push({
            title: `Combined ${keywords[i]}-${keywords[j]} system`,
            description: `Integrate ${keywords[i]} and ${keywords[j]} capabilities for synergistic benefits`,
            category: 'combination',
          });
        }
      }
    }

    return ideas;
  }

  /**
   * Generate opposite/inverse ideas
   */
  private generateOppositeIdeas(
    topic: string,
    keywords: string[],
  ): Array<{
    title: string;
    description: string;
    category: string;
  }> {
    return [
      {
        title: `Reverse ${topic} approach`,
        description: `Instead of conventional methods, try the opposite approach to ${topic}`,
        category: 'reverse',
      },
      {
        title: `Minimal ${topic} solution`,
        description: `What if we removed most features and focused on core essentials?`,
        category: 'minimalist',
      },
    ];
  }

  /**
   * Generate random association ideas
   */
  private generateRandomAssociationIdeas(topic: string): Array<{
    title: string;
    description: string;
    category: string;
  }> {
    const randomWords = [
      'cloud',
      'crystal',
      'wave',
      'spiral',
      'network',
      'garden',
      'bridge',
      'lighthouse',
    ];
    const selectedWord = randomWords[Math.floor(Math.random() * randomWords.length)];

    return [
      {
        title: `${selectedWord}-inspired ${topic}`,
        description: `What if ${topic} worked like a ${selectedWord}? Explore unexpected connections`,
        category: 'random_association',
      },
    ];
  }

  /**
   * Enhance ideas based on brainstorming style
   */
  private enhanceIdeasByStyle(ideas: unknown[], style: string): unknown[] {
    switch (style) {
      case 'convergent':
        // Focus on most practical ideas
        return ideas.filter((_, index) => index % 2 === 0); // Take every other idea

      case 'lateral':
        // Emphasize unusual and creative ideas
        return ideas.map((idea) => ({
          ...idea,
          title:
            idea.category === 'analogy' || idea.category === 'random_association'
              ? `Unconventional: ${idea.title}`
              : idea.title,
        }));

      case 'associative':
        // Group related ideas together
        return ideas.sort((a, b) => a.category.localeCompare(b.category));

      default: // divergent
        return ideas; // Keep all ideas for maximum variety
    }
  }

  /**
   * Score novelty of an idea
   */
  private scoreNovelty(title: string, description: string, keywords: string[]): number {
    let novelty = 0.5; // Base novelty

    // Boost for creative words
    if (
      /unconventional|innovative|creative|unique|novel|original/.test(
        (`${title  } ${  description}`).toLowerCase(),
      )
    ) {
      novelty += 0.3;
    }

    // Boost for analogical thinking
    if (/inspired|like|similar to|as if/.test((`${title  } ${  description}`).toLowerCase())) {
      novelty += 0.2;
    }

    // Boost for combination of keywords
    const keywordCount = keywords.filter((k) =>
      (`${title  } ${  description}`).toLowerCase().includes(k),
    ).length;
    novelty += Math.min(keywordCount * 0.1, 0.2);

    return Math.min(novelty, 1.0);
  }

  /**
   * Score feasibility of an idea
   */
  private scoreFeasibility(description: string, originalInput: string): number {
    let feasibility = 0.6; // Base feasibility

    // Boost for concrete terms
    if (/method|approach|system|process|tool|platform/.test(description.toLowerCase())) {
      feasibility += 0.2;
    }

    // Penalty for very abstract ideas
    if (/concept|theory|philosophy|abstract/.test(description.toLowerCase())) {
      feasibility -= 0.2;
    }

    // Boost if relates to original context
    const originalWords = originalInput.toLowerCase().split(/\s+/);
    const descWords = description.toLowerCase().split(/\s+/);
    const overlap = originalWords.filter((word) => descWords.includes(word)).length;
    feasibility += Math.min(overlap * 0.05, 0.2);

    return Math.min(Math.max(feasibility, 0.1), 1.0);
  }

  /**
   * Categorize generated ideas
   */
  private categorizeIdeas(ideas: unknown[]): string[] {
    const categories = new Set(ideas.map((idea) => idea.category));
    return Array.from(categories);
  }

  /**
   * Identify brainstorming techniques used
   */
  private identifyTechniques(style: string, inputLength: number): string[] {
    const techniques = ['Direct association', 'Analogical thinking', 'Combinatorial creativity'];

    if (style === 'lateral') {
      techniques.push('Lateral thinking', 'Random word association');
    }

    if (style === 'divergent') {
      techniques.push('Divergent thinking', 'Alternative generation');
    }

    if (inputLength > 200) {
      techniques.push('Systematic exploration');
    }

    return techniques;
  }

  /**
   * Calculate overall novelty score
   */
  private calculateNoveltyScore(ideas: unknown[]): number {
    if (ideas.length === 0) {return 0;}

    const avgNovelty = ideas.reduce((sum, idea) => sum + idea.novelty, 0) / ideas.length;
    const diversityBonus = new Set(ideas.map((i) => i.category)).size * 0.05;

    return Math.min(avgNovelty + diversityBonus, 1.0);
  }

  /**
   * Calculate brainstorming confidence
   */
  private calculateBrainstormingConfidence(
    input: string,
    ideaCount: number,
    noveltyScore: number,
  ): number {
    let confidence = 0.7; // Base confidence for creative mode

    // Boost for number of ideas generated
    confidence += Math.min(ideaCount * 0.02, 0.15);

    // Boost for high novelty
    confidence += noveltyScore * 0.15;

    // Boost for clear creative intent in input
    if (/creative|innovative|brainstorm|idea|think outside/.test(input.toLowerCase())) {
      confidence += 0.1;
    }

    // Penalty for very short input
    if (input.length < 50) {confidence -= 0.2;}

    return Math.min(Math.max(confidence, 0.3), 0.95);
  }

  /**
   * Suggest next creative mode
   */
  private suggestNextCreativeMode(context: ModeContext, result: unknown): string | undefined {
    const { input } = context;
    const normalizedInput = input.toLowerCase();

    // Suggest design mode for prototyping
    if (/design|prototype|mockup|wireframe|visual/.test(normalizedInput)) {
      return 'designing';
    }

    // Suggest planning for implementation
    if (/implement|execute|plan|steps|roadmap/.test(normalizedInput) && result.ideas.length > 3) {
      return 'planning';
    }

    // Suggest evaluation for idea selection
    if (/evaluate|compare|choose|select|rank/.test(normalizedInput) && result.ideas.length > 5) {
      return 'evaluating';
    }

    // Continue brainstorming if more ideas needed
    if (result.ideas.length < 5) {
      return 'brainstorming';
    }

    return undefined;
  }

  /**
   * Format brainstorming output
   */
  private formatBrainstormingOutput(result: unknown, language: string): string {
    const { style, ideas, categories, techniques, noveltyScore } = result;

    let output = '';

    // Add brainstorming indicator
    switch (language) {
      case 'japanese':
        output += 'ブレインストーミング中... ';
        break;
      case 'chinese':
        output += '头脑风暴中... ';
        break;
      case 'korean':
        output += '브레인스토밍 중... ';
        break;
      case 'vietnamese':
        output += 'Đang động não... ';
        break;
      default:
        output += 'Brainstorming... ';
    }

    output += `[${style} thinking - Novelty: ${(noveltyScore * 100).toFixed(0)}%]\n\n`;

    // Ideas section
    output += `💡 Generated Ideas (${ideas.length}):\n\n`;
    ideas.forEach((idea, index) => {
      output += `${index + 1}. **${idea.title}**\n`;
      output += `   ${idea.description}\n`;
      output += `   Category: ${idea.category} | Novelty: ${(idea.novelty * 100).toFixed(0)}% | Feasibility: ${(idea.feasibility * 100).toFixed(0)}%\n\n`;
    });

    // Techniques section
    output += 'Techniques Applied:\n';
    techniques.forEach((technique) => {
      output += `• ${technique}\n`;
    });

    // Categories section
    if (categories.length > 1) {
      output += `\nIdea Categories: ${categories.join(', ')}`;
    }

    return output.trim();
  }
}
