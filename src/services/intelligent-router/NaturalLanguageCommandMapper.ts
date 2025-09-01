/**
 * Natural Language Command Mapper
 * Maps natural language inputs to MARIA commands without slash prefix requirement
 *
 * Features:
 * - Intent-to-command translation
 * - Multi-language support
 * - Context-aware parameter extraction
 * - Confidence-based suggestions
 * - Learning from user interactions
 *
 * @since v3.4.2
 */

import { EventEmitter } from "node:events";
import {
  EnhancedIntentRecognizer,
  EnhancedIntent,
  IntentContext,
} from "./analysis/EnhancedIntentRecognizer";
import { ProcessedInput } from "./infra/NaturalLanguageProcessor";
import type { RouterConfig } from "./types/common-types";

export interface CommandMapping {
  intent: string;
  command: string;
  parameters?: string[];
  confidence: number;
  explanation: string;
  requiresConfirmation: boolean;
  alternatives?: Array<{
    command: string;
    parameters?: string[];
    confidence: number;
  }>;
}

export interface MappingRule {
  id: string;
  patterns: Array<{
    language: string;
    regex: RegExp;
    examples: string[];
  }>;
  command: string;
  parameterExtractors?: Array<{
    name: string;
    pattern: RegExp;
    transformer?: (value: string) => string;
  }>;
  conditions?: Array<{
    field: keyof IntentContext;
    operator: "equals" | "contains" | "exists" | "gt" | "lt";
    value?: any;
  }>;
  priority: number;
  enabled: boolean;
}

export interface MappingConfig {
  enableLearning: boolean;
  minConfidenceThreshold: number;
  maxAlternatives: number;
  enableMultiLanguage: boolean;
  defaultLanguage: "en" | "ja" | "zh" | "ko";
  debugMode: boolean;
}

export class NaturalLanguageCommandMapper extends EventEmitter {
  private intentRecognizer: EnhancedIntentRecognizer;
  private mappingRules: Map<string, MappingRule> = new Map();
  private config: MappingConfig;
  private learningData: Array<{
    input: string;
    mappedCommand: string;
    actualCommand: string;
    confidence: number;
    timestamp: number;
  }> = [];

  // Performance metrics
  private metrics = {
    totalMappings: 0,
    successfulMappings: 0,
    averageConfidence: 0,
    topCommands: new Map<string, number>(),
    languageUsage: new Map<string, number>(),
  };

  constructor(
    routerConfig: Required<RouterConfig>,
    config?: Partial<MappingConfig>,
  ) {
    super();

    this.config = {
      enableLearning: config?.enableLearning ?? true,
      minConfidenceThreshold: config?.minConfidenceThreshold ?? 0.6,
      maxAlternatives: config?.maxAlternatives ?? 3,
      enableMultiLanguage: config?.enableMultiLanguage ?? true,
      defaultLanguage: config?.defaultLanguage ?? "en",
      debugMode: config?.debugMode ?? false,
    };

    this.intentRecognizer = new EnhancedIntentRecognizer(routerConfig);
    this.initializeDefaultMappingRules();
    this.setupEventListeners();
  }

  /**
   * Map natural language input to command
   */
  async mapToCommand(
    input: string | ProcessedInput,
    context?: Partial<IntentContext>,
  ): Promise<CommandMapping | null> {
    this.metrics.totalMappings++;

    try {
      // Convert string input to ProcessedInput if needed
      const processedInput =
        typeof input === "string"
          ? await this.processStringInput(input)
          : input;

      // Get intent from enhanced recognizer
      const intent = await this.intentRecognizer.recognizeIntent(
        processedInput,
        context,
      );

      if (!intent) {
        if (this.config.debugMode) {
          console.log(
            "[NLCM] No intent recognized for input:",
            processedInput.original,
          );
        }
        return null;
      }

      // Apply mapping rules
      const mapping = await this.applyMappingRules(
        intent,
        processedInput,
        context,
      );

      if (!mapping) {
        if (this.config.debugMode) {
          console.log(
            "[NLCM] No mapping rules matched for intent:",
            intent.command,
          );
        }
        return null;
      }

      // Update metrics and learning
      this.updateMetrics(
        mapping,
        processedInput.language || this.config.defaultLanguage,
      );

      if (this.config.enableLearning) {
        this.recordMappingForLearning(processedInput.original, mapping);
      }

      this.emit("command-mapped", {
        input: processedInput.original,
        mapping,
        intent,
      });

      return mapping;
    } catch (error) {
      console.error("[NLCM] Mapping failed:", error);
      return null;
    }
  }

  /**
   * Apply mapping rules to intent
   */
  private async applyMappingRules(
    intent: EnhancedIntent,
    input: ProcessedInput,
    context?: Partial<IntentContext>,
  ): Promise<CommandMapping | null> {
    // Check if intent confidence meets threshold
    if (intent.confidence < this.config.minConfidenceThreshold) {
      return null;
    }

    // Get applicable rules
    const applicableRules = Array.from(this.mappingRules.values())
      .filter((rule) => rule.enabled)
      .filter((rule) => this.evaluateRuleConditions(rule, context))
      .sort((a, b) => b.priority - a.priority);

    // Find matching rule
    let bestMatch: {
      rule: MappingRule;
      parameters: Record<string, string>;
    } | null = null;

    for (const rule of applicableRules) {
      const parameters = this.extractParameters(rule, input);

      // Check if rule patterns match
      const patternMatch = rule.patterns.some(
        (pattern) =>
          pattern.language === input.language &&
          pattern.regex.test(input.normalized),
      );

      if (patternMatch || rule.command === intent.command) {
        bestMatch = { rule, parameters };
        break;
      }
    }

    if (!bestMatch) {
      // Create default mapping from intent
      return this.createDefaultMapping(intent);
    }

    // Create mapping from rule
    return this.createMappingFromRule(
      bestMatch.rule,
      bestMatch.parameters,
      intent,
    );
  }

  /**
   * Create default mapping when no specific rule matches
   */
  private createDefaultMapping(intent: EnhancedIntent): CommandMapping {
    return {
      intent: intent.command,
      command: intent.command,
      parameters: intent.parameters || [],
      confidence: intent.confidence,
      explanation: intent.reasoning,
      requiresConfirmation: intent.suggestedExecution === "confirm",
      alternatives: intent.alternatives?.map((alt) => ({
        command: alt.command,
        parameters: alt.parameters,
        confidence: alt.confidence,
      })),
    };
  }

  /**
   * Create mapping from matching rule
   */
  private createMappingFromRule(
    rule: MappingRule,
    parameters: Record<string, string>,
    intent: EnhancedIntent,
  ): CommandMapping {
    const commandParams = Object.values(parameters).filter(Boolean);

    return {
      intent: intent.command,
      command: rule.command,
      parameters: commandParams.length > 0 ? commandParams : intent.parameters,
      confidence: Math.min(intent.confidence + 0.1, 1.0), // Slight boost for rule match
      explanation: `Matched rule: ${rule.id}`,
      requiresConfirmation: intent.confidence < 0.8,
      alternatives: intent.alternatives?.map((alt) => ({
        command: alt.command,
        parameters: alt.parameters,
        confidence: alt.confidence,
      })),
    };
  }

  /**
   * Extract parameters from input using rule extractors
   */
  private extractParameters(
    rule: MappingRule,
    input: ProcessedInput,
  ): Record<string, string> {
    const parameters: Record<string, string> = {};

    if (!rule.parameterExtractors) {
      return parameters;
    }

    for (const extractor of rule.parameterExtractors) {
      const match = input.original.match(extractor.pattern);
      if (match && match[1]) {
        const value = extractor.transformer
          ? extractor.transformer(match[1])
          : match[1];
        parameters[extractor.name] = value;
      }
    }

    return parameters;
  }

  /**
   * Evaluate rule conditions against context
   */
  private evaluateRuleConditions(
    rule: MappingRule,
    context?: Partial<IntentContext>,
  ): boolean {
    if (!rule.conditions || !context) {
      return true;
    }

    return rule.conditions.every((condition) => {
      const fieldValue = context[condition.field];

      switch (condition.operator) {
        case "equals":
          return fieldValue === condition.value;
        case "contains":
          return Array.isArray(fieldValue)
            ? fieldValue.includes(condition.value)
            : String(fieldValue).includes(condition.value);
        case "exists":
          return fieldValue !== undefined && fieldValue !== null;
        case "gt":
          return Number(fieldValue) > Number(condition.value);
        case "lt":
          return Number(fieldValue) < Number(condition.value);
        default:
          return true;
      }
    });
  }

  /**
   * Process string input into ProcessedInput format
   */
  private async processStringInput(input: string): Promise<ProcessedInput> {
    const language = this.detectLanguage(input);
    const normalized = input.toLowerCase().trim();
    const tokens = normalized.split(/\s+/);
    const keywords = this.extractKeywords(normalized);
    const entities = this.extractEntities(input);

    return {
      original: input,
      normalized,
      tokens,
      keywords,
      entities,
      language,
      confidence: 0.8,
    };
  }

  /**
   * Detect input language (simple heuristic)
   */
  private detectLanguage(input: string): string {
    if (!this.config.enableMultiLanguage) {
      return this.config.defaultLanguage;
    }

    // Simple language detection based on character patterns
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(input)) {
      return "ja";
    }

    if (/[\u4E00-\u9FFF]/.test(input)) {
      return "zh";
    }

    if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(input)) {
      return "ko";
    }

    return "en";
  }

  /**
   * Extract keywords from normalized text
   */
  private extractKeywords(normalized: string): string[] {
    const stopWords = new Set([
      "a",
      "an",
      "the",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "must",
      "shall",
      "ought",
      "to",
      "of",
      "in",
      "for",
      "on",
      "with",
      "by",
      "from",
      "up",
      "about",
      "into",
      "through",
      "during",
      "before",
      "after",
      "above",
      "below",
      "between",
      "among",
    ]);

    return normalized
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit keywords
  }

  /**
   * Extract entities from input (simple implementation)
   */
  private extractEntities(
    input: string,
  ): Array<{ type: string; value: string; confidence: number }> {
    const entities: Array<{ type: string; value: string; confidence: number }> =
      [];

    // File paths
    const pathMatch = input.match(
      /(?:\/[\w-]+(?:\/[\w.-]+)*|[A-Z]:\\[\w-]+(?:\\[\w.-]+)*|\.\w+)/g,
    );
    if (pathMatch) {
      pathMatch.forEach((match) => {
        entities.push({ type: "file", value: match, confidence: 0.8 });
      });
    }

    // URLs
    const urlMatch = input.match(/https?:\/\/[^\s]+/g);
    if (urlMatch) {
      urlMatch.forEach((match) => {
        entities.push({ type: "url", value: match, confidence: 0.9 });
      });
    }

    // Programming languages
    const languagePatterns = [
      {
        pattern:
          /\b(typescript|javascript|python|java|golang?|rust|c\+\+|c#|php|ruby)\b/gi,
        type: "language",
      },
      {
        pattern:
          /\b(react|vue|angular|express|django|flask|spring|laravel)\b/gi,
        type: "framework",
      },
    ];

    languagePatterns.forEach(({ pattern, type }) => {
      const matches = input.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          entities.push({ type, value: match.toLowerCase(), confidence: 0.7 });
        });
      }
    });

    // Numbers
    const numberMatch = input.match(/\b\d+(?:\.\d+)?\b/g);
    if (numberMatch) {
      numberMatch.forEach((match) => {
        entities.push({ type: "number", value: match, confidence: 0.6 });
      });
    }

    return entities;
  }

  /**
   * Initialize default mapping rules
   */
  private initializeDefaultMappingRules(): void {
    const defaultRules: MappingRule[] = [
      {
        id: "create-code",
        patterns: [
          {
            language: "en",
            regex:
              /create|write|make|build|implement|generate|code|function|component/i,
            examples: [
              "create a login function",
              "write a React component",
              "implement user authentication",
            ],
          },
          {
            language: "ja",
            regex: /作|作成|書|実装|生成|コード|関数|コンポーネント/,
            examples: ["ログイン機能を作って", "Reactコンポーネントを書いて"],
          },
        ],
        command: "/code",
        parameterExtractors: [
          {
            name: "description",
            pattern: /(?:create|write|make|build|implement)\s+(?:a\s+)?(.+)/i,
          },
        ],
        priority: 100,
        enabled: true,
      },

      {
        id: "fix-error",
        patterns: [
          {
            language: "en",
            regex: /fix|debug|solve|resolve|error|bug|issue|problem/i,
            examples: [
              "fix this error",
              "debug the issue",
              "solve this problem",
            ],
          },
          {
            language: "ja",
            regex: /修正|デバッグ|解決|エラー|バグ|問題/,
            examples: ["このエラーを修正して", "バグを直して"],
          },
        ],
        command: "/doctor",
        parameterExtractors: [
          {
            name: "issue",
            pattern: /(?:fix|debug|solve)\s+(.+)/i,
          },
        ],
        conditions: [{ field: "errorAnalysis", operator: "exists" }],
        priority: 150,
        enabled: true,
      },

      {
        id: "run-tests",
        patterns: [
          {
            language: "en",
            regex: /test|run\s+test|execute\s+test|check\s+test/i,
            examples: ["run tests", "execute test suite", "run unit tests"],
          },
          {
            language: "ja",
            regex: /テスト|試験|実行.*テスト/,
            examples: ["テストを実行して", "ユニットテストを走らせて"],
          },
        ],
        command: "/test",
        parameterExtractors: [
          {
            name: "testType",
            pattern: /(unit|integration|e2e)\s+test/i,
            transformer: (value) => `--${value.toLowerCase()}`,
          },
        ],
        priority: 90,
        enabled: true,
      },

      {
        id: "show-files",
        patterns: [
          {
            language: "en",
            regex: /show|list|display|view|see|files|directory|folder/i,
            examples: [
              "show me the files",
              "list directory contents",
              "display folder structure",
            ],
          },
          {
            language: "ja",
            regex: /表示|見|ファイル|ディレクトリ|フォルダ|一覧/,
            examples: ["ファイルを表示して", "ディレクトリの中身を見せて"],
          },
        ],
        command: "/shell",
        parameterExtractors: [
          {
            name: "path",
            pattern: /(?:show|list|in|of)\s+(.+)/i,
          },
        ],
        priority: 80,
        enabled: true,
      },

      {
        id: "calculate-math",
        patterns: [
          {
            language: "en",
            regex: /calculate|compute|solve|math|equation|expression/i,
            examples: [
              "calculate 2 + 2",
              "solve for x",
              "compute the derivative",
            ],
          },
          {
            language: "ja",
            regex: /計算|演算|解|数式|方程式/,
            examples: ["2 + 2を計算して", "xについて解いて"],
          },
        ],
        command: "/calc",
        parameterExtractors: [
          {
            name: "expression",
            pattern: /(?:calculate|compute|solve)\s+(.+)/i,
          },
        ],
        priority: 85,
        enabled: true,
      },

      {
        id: "create-image",
        patterns: [
          {
            language: "en",
            regex: /create|generate|make|draw|image|picture|illustration/i,
            examples: [
              "create an image of a cat",
              "generate a logo",
              "draw a sunset",
            ],
          },
          {
            language: "ja",
            regex: /作|生成|描|画像|絵|イラスト/,
            examples: ["猫の画像を作って", "ロゴを生成して"],
          },
        ],
        command: "/image",
        parameterExtractors: [
          {
            name: "description",
            pattern: /(?:image|picture|illustration)\s+of\s+(.+)/i,
          },
        ],
        priority: 75,
        enabled: true,
      },
    ];

    // Add rules to map
    defaultRules.forEach((rule) => {
      this.mappingRules.set(rule.id, rule);
    });
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(mapping: CommandMapping, language: string): void {
    this.metrics.successfulMappings++;

    // Update average confidence
    this.metrics.averageConfidence =
      (this.metrics.averageConfidence * (this.metrics.successfulMappings - 1) +
        mapping.confidence) /
      this.metrics.successfulMappings;

    // Update top commands
    const currentCount = this.metrics.topCommands.get(mapping.command) || 0;
    this.metrics.topCommands.set(mapping.command, currentCount + 1);

    // Update language usage
    const langCount = this.metrics.languageUsage.get(language) || 0;
    this.metrics.languageUsage.set(language, langCount + 1);
  }

  /**
   * Record mapping for learning
   */
  private recordMappingForLearning(
    input: string,
    mapping: CommandMapping,
  ): void {
    this.learningData.push({
      input,
      mappedCommand: mapping.command,
      actualCommand: mapping.command, // Will be updated with feedback
      confidence: mapping.confidence,
      timestamp: Date.now(),
    });

    // Keep learning data manageable
    if (this.learningData.length > 1000) {
      this.learningData = this.learningData.slice(-500);
    }
  }

  /**
   * Provide feedback for learning
   */
  async provideFeedback(
    input: string,
    mappedCommand: string,
    actualCommand: string,
    wasCorrect: boolean,
  ): Promise<void> {
    // Find the learning entry
    const entry = this.learningData.find(
      (e) => e.input === input && e.mappedCommand === mappedCommand,
    );

    if (entry) {
      entry.actualCommand = actualCommand;
    }

    // Update intent recognizer with feedback
    await this.intentRecognizer.learn(
      input,
      actualCommand,
      mappedCommand,
      wasCorrect,
    );

    this.emit("feedback-received", {
      input,
      mappedCommand,
      actualCommand,
      wasCorrect,
    });
  }

  /**
   * Add or update mapping rule
   */
  addMappingRule(rule: MappingRule): void {
    this.mappingRules.set(rule.id, rule);
    this.emit("rule-added", rule);
  }

  /**
   * Remove mapping rule
   */
  removeMappingRule(ruleId: string): boolean {
    const removed = this.mappingRules.delete(ruleId);
    if (removed) {
      this.emit("rule-removed", ruleId);
    }
    return removed;
  }

  /**
   * Get all mapping rules
   */
  getMappingRules(): MappingRule[] {
    return Array.from(this.mappingRules.values());
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    totalMappings: number;
    successfulMappings: number;
    successRate: number;
    averageConfidence: number;
    topCommands: Array<{ command: string; count: number }>;
    languageUsage: Array<{ language: string; count: number }>;
  } {
    const successRate =
      this.metrics.totalMappings > 0
        ? this.metrics.successfulMappings / this.metrics.totalMappings
        : 0;

    const topCommands = Array.from(this.metrics.topCommands.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const languageUsage = Array.from(this.metrics.languageUsage.entries())
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalMappings: this.metrics.totalMappings,
      successfulMappings: this.metrics.successfulMappings,
      successRate,
      averageConfidence: this.metrics.averageConfidence,
      topCommands,
      languageUsage,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MappingConfig>): void {
    Object.assign(this.config, config);
    this.emit("config-updated", this.config);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.intentRecognizer.on("intent-recognized", (intent: EnhancedIntent) => {
      this.emit("intent-recognized", intent);
    });

    this.intentRecognizer.on("security-alert", (issues) => {
      this.emit("security-alert", issues);
    });
  }

  /**
   * Get learning data for analysis
   */
  getLearningData(): typeof this.learningData {
    return [...this.learningData];
  }

  /**
   * Clear learning data
   */
  clearLearningData(): void {
    this.learningData = [];
    this.emit("learning-data-cleared");
  }

  /**
   * Export configuration and rules
   */
  exportConfig(): {
    config: MappingConfig;
    rules: MappingRule[];
    learningData: typeof this.learningData;
  } {
    return {
      config: { ...this.config },
      rules: this.getMappingRules(),
      learningData: [...this.learningData],
    };
  }

  /**
   * Import configuration and rules
   */
  importConfig(data: {
    config?: Partial<MappingConfig>;
    rules?: MappingRule[];
    learningData?: typeof this.learningData;
  }): void {
    if (data.config) {
      this.updateConfig(data.config);
    }

    if (data.rules) {
      this.mappingRules.clear();
      data.rules.forEach((rule) => {
        this.mappingRules.set(rule.id, rule);
      });
    }

    if (data.learningData) {
      this.learningData = [...data.learningData];
    }

    this.emit("config-imported", data);
  }
}

export default NaturalLanguageCommandMapper;
