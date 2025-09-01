/**
 * Enhanced IntentRecognizer for Natural Language Processing
 * Phase 2 implementation - Advanced natural language to command mapping
 *
 * Features:
 * - Advanced natural language understanding
 * - Context-aware intent recognition
 * - Multi-language support
 * - Learning from user interactions
 * - Confidence scoring with error analysis integration
 *
 * @since v3.4.2
 */

import { EventEmitter } from "node:events";
import { ProcessedInput } from "../infra/NaturalLanguageProcessor";
import type { RouterConfig } from "../types/common-types";
import {
  ClipboardAnalyzer,
  ClipboardAnalysis,
} from "../../clipboard/ClipboardAnalyzer";
import {
  ErrorPatternDetector,
  DetectionResult,
} from "../../error-analyzer/ErrorPatternDetector";

export interface EnhancedIntent {
  command: string;
  parameters?: string[];
  confidence: number;
  alternatives?: Array<{
    command: string;
    parameters?: string[];
    confidence: number;
  }>;
  reasoning: string;
  context: {
    isError?: boolean;
    isCode?: boolean;
    hasAttachments?: boolean;
    language?: string;
    framework?: string;
  };
  suggestedExecution: "auto" | "confirm" | "manual";
}

export interface NaturalLanguageMapping {
  patterns: Array<{
    phrases: string[];
    command: string;
    parameters?: (match: RegExpMatchArray, context: IntentContext) => string[];
    confidence: number;
    weight: number;
    languages: string[];
  }>;
}

export interface IntentContext {
  previousCommands: string[];
  clipboardAnalysis?: ClipboardAnalysis;
  errorAnalysis?: DetectionResult;
  attachments?: Array<{ type: string; path: string }>;
  sessionData?: Record<string, any>;
  userPreferences?: UserPreferences;
}

export interface UserPreferences {
  preferredLanguage: "en" | "ja" | "zh" | "ko";
  autoExecuteThreshold: number;
  verboseOutput: boolean;
  favoriteCommands: string[];
  commandAliases: Record<string, string>;
}

export interface LearningData {
  input: string;
  expectedCommand: string;
  actualCommand?: string;
  confidence: number;
  wasCorrect: boolean;
  timestamp: number;
  context: IntentContext;
}

export class EnhancedIntentRecognizer extends EventEmitter {
  private config: Required<RouterConfig>;
  private clipboardAnalyzer: ClipboardAnalyzer;
  private errorDetector: ErrorPatternDetector;
  private naturalLanguageMappings: NaturalLanguageMapping;
  private learningHistory: LearningData[] = [];
  private userPreferences: UserPreferences;
  private contextWindow: IntentContext;

  // Performance metrics
  private metrics = {
    totalRequests: 0,
    successfulMappings: 0,
    averageConfidence: 0,
    averageResponseTime: 0,
    languageDetectionAccuracy: 0,
  };

  constructor(config: Required<RouterConfig>) {
    super();

    this.config = config;
    this.clipboardAnalyzer = new ClipboardAnalyzer();
    this.errorDetector = new ErrorPatternDetector();

    this.userPreferences = {
      preferredLanguage: "en",
      autoExecuteThreshold: 0.9,
      verboseOutput: false,
      favoriteCommands: [],
      commandAliases: {},
    };

    this.contextWindow = {
      previousCommands: [],
      sessionData: {},
    };

    this.initializeNaturalLanguageMappings();
    this.setupEventListeners();
  }

  /**
   * Enhanced intent recognition with natural language understanding
   */
  async recognizeIntent(
    input: ProcessedInput,
    context?: Partial<IntentContext>,
  ): Promise<EnhancedIntent | null> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Merge context
      const fullContext = this.mergeContext(context);

      // Multi-stage analysis
      const stageResults = await Promise.all([
        this.analyzeClipboardContent(input),
        this.analyzeErrorContext(input),
        this.analyzeNaturalLanguage(input, fullContext),
        this.analyzeContextualCues(input, fullContext),
      ]);

      // Combine results
      const combinedResult = this.combineAnalysisResults(
        stageResults,
        input,
        fullContext,
      );

      if (!combinedResult) {
        return null;
      }

      // Post-process and enhance
      const enhancedIntent = this.enhanceIntent(combinedResult, fullContext);

      // Update metrics and learning
      this.updateMetrics(enhancedIntent, Date.now() - startTime);
      this.updateContext(input, enhancedIntent);

      this.emit("intent-recognized", enhancedIntent);
      return enhancedIntent;
    } catch (error) {
      console.error("Intent recognition failed:", error);
      return null;
    }
  }

  /**
   * Analyze clipboard content for context
   */
  private async analyzeClipboardContent(input: ProcessedInput): Promise<{
    type: "clipboard";
    result: ClipboardAnalysis | null;
  }> {
    try {
      // Use input text as clipboard content for analysis
      const analysis = await this.clipboardAnalyzer.analyze(input.original);
      return { type: "clipboard", result: analysis };
    } catch {
      return { type: "clipboard", result: null };
    }
  }

  /**
   * Analyze error patterns in input
   */
  private async analyzeErrorContext(input: ProcessedInput): Promise<{
    type: "error";
    result: DetectionResult | null;
  }> {
    try {
      const detection = this.errorDetector.detectErrors(input.original);
      return { type: "error", result: detection.hasErrors ? detection : null };
    } catch {
      return { type: "error", result: null };
    }
  }

  /**
   * Advanced natural language analysis
   */
  private async analyzeNaturalLanguage(
    input: ProcessedInput,
    context: IntentContext,
  ): Promise<{
    type: "natural";
    result: Array<{
      command: string;
      parameters?: string[];
      confidence: number;
      reasoning: string;
    }>;
  }> {
    const candidates: Array<{
      command: string;
      parameters?: string[];
      confidence: number;
      reasoning: string;
    }> = [];

    // Language-specific pattern matching
    const language = input.language || this.userPreferences.preferredLanguage;
    const patterns = this.getLanguagePatterns(language);

    for (const pattern of patterns.patterns) {
      if (!pattern.languages.includes(language)) continue;

      for (const phrase of pattern.phrases) {
        const regex = this.createFlexibleRegex(phrase);
        const match = input.normalized.match(regex);

        if (match) {
          const parameters = pattern.parameters
            ? pattern.parameters(match, context)
            : [];
          const baseConfidence = pattern.confidence;

          // Adjust confidence based on context
          const adjustedConfidence = this.adjustConfidenceForContext(
            baseConfidence,
            context,
            pattern.command,
          );

          candidates.push({
            command: pattern.command,
            parameters,
            confidence: adjustedConfidence,
            reasoning: `Matched natural language pattern: "${phrase}"`,
          });
        }
      }
    }

    return { type: "natural", result: candidates };
  }

  /**
   * Analyze contextual cues
   */
  private async analyzeContextualCues(
    input: ProcessedInput,
    context: IntentContext,
  ): Promise<{
    type: "contextual";
    result: Array<{ command: string; confidence: number; reasoning: string }>;
  }> {
    const candidates: Array<{
      command: string;
      confidence: number;
      reasoning: string;
    }> = [];

    // Previous command context
    if (context.previousCommands.length > 0) {
      const lastCommand =
        context.previousCommands[context.previousCommands.length - 1];
      const followupCommands = this.getFollowupCommands(lastCommand);

      for (const cmd of followupCommands) {
        candidates.push({
          command: cmd.command,
          confidence: cmd.confidence * 0.7, // Contextual boost but not too high
          reasoning: `Follow-up command after ${lastCommand}`,
        });
      }
    }

    // Session pattern analysis
    if (context.sessionData) {
      const sessionPatterns = this.analyzeSessionPatterns(context.sessionData);
      candidates.push(...sessionPatterns);
    }

    return { type: "contextual", result: candidates };
  }

  /**
   * Combine all analysis results
   */
  private combineAnalysisResults(
    stageResults: any[],
    input: ProcessedInput,
    context: IntentContext,
  ): EnhancedIntent | null {
    const allCandidates: Array<{
      command: string;
      parameters?: string[];
      confidence: number;
      reasoning: string;
      source: string;
    }> = [];

    // Extract candidates from each stage
    for (const stage of stageResults) {
      if (stage.type === "clipboard" && stage.result) {
        const clipboardCommands = this.mapClipboardToCommands(stage.result);
        allCandidates.push(
          ...clipboardCommands.map((c) => ({ ...c, source: "clipboard" })),
        );
      }

      if (stage.type === "error" && stage.result) {
        const errorCommands = this.mapErrorsToCommands(stage.result);
        allCandidates.push(
          ...errorCommands.map((c) => ({ ...c, source: "error" })),
        );
      }

      if (stage.type === "natural") {
        allCandidates.push(
          ...stage.result.map((c: any) => ({ ...c, source: "natural" })),
        );
      }

      if (stage.type === "contextual") {
        allCandidates.push(
          ...stage.result.map((c: any) => ({ ...c, source: "contextual" })),
        );
      }
    }

    if (allCandidates.length === 0) {
      return null;
    }

    // Score and rank candidates
    const scoredCandidates = this.scoreAndRankCandidates(
      allCandidates,
      context,
    );
    const topCandidate = scoredCandidates[0];

    if (!topCandidate || topCandidate.confidence < 0.3) {
      return null;
    }

    return {
      command: topCandidate.command,
      parameters: topCandidate.parameters,
      confidence: topCandidate.confidence,
      alternatives: scoredCandidates.slice(1, 4),
      reasoning: topCandidate.reasoning,
      context: this.buildIntentContext(context, stageResults),
      suggestedExecution: this.determineSuggestedExecution(
        topCandidate.confidence,
        topCandidate.source,
      ),
    };
  }

  /**
   * Map clipboard analysis to commands
   */
  private mapClipboardToCommands(analysis: ClipboardAnalysis): Array<{
    command: string;
    parameters?: string[];
    confidence: number;
    reasoning: string;
  }> {
    const commands: Array<{
      command: string;
      parameters?: string[];
      confidence: number;
      reasoning: string;
    }> = [];

    // Direct command suggestions from clipboard analyzer
    for (const cmd of analysis.suggestedCommands) {
      commands.push({
        command: cmd.startsWith("/") ? cmd : `/${cmd}`,
        confidence: 0.8,
        reasoning: `Suggested for ${analysis.contentType} content`,
      });
    }

    // Content-type specific mappings
    switch (analysis.contentType) {
      case "error":
        commands.push({
          command: "/doctor",
          parameters: ["analyze", "--verbose"],
          confidence: 0.9,
          reasoning: "Error content detected",
        });
        break;

      case "code":
        commands.push({
          command: "/code",
          parameters: ["analyze", `--lang=${analysis.language}`],
          confidence: 0.8,
          reasoning: `${analysis.language} code detected`,
        });
        break;

      case "json":
        commands.push({
          command: "/validate",
          parameters: ["json"],
          confidence: 0.9,
          reasoning: "JSON content detected",
        });
        break;

      case "url":
        commands.push({
          command: "/research",
          parameters: ["url"],
          confidence: 0.7,
          reasoning: "URL content detected",
        });
        break;
    }

    return commands;
  }

  /**
   * Map error analysis to commands
   */
  private mapErrorsToCommands(detection: DetectionResult): Array<{
    command: string;
    parameters?: string[];
    confidence: number;
    reasoning: string;
  }> {
    const commands: Array<{
      command: string;
      parameters?: string[];
      confidence: number;
      reasoning: string;
    }> = [];

    // Source-specific command mapping
    if (detection.summary.bySource.tsc > 0) {
      commands.push({
        command: "/typecheck",
        parameters: ["analyze"],
        confidence: 0.9,
        reasoning: `${detection.summary.bySource.tsc} TypeScript errors detected`,
      });
    }

    if (detection.summary.bySource.eslint > 0) {
      commands.push({
        command: "/lint",
        parameters: ["fix"],
        confidence: 0.85,
        reasoning: `${detection.summary.bySource.eslint} ESLint errors detected`,
      });
    }

    if (detection.summary.bySource.vitest > 0) {
      commands.push({
        command: "/test",
        parameters: ["--failed"],
        confidence: 0.8,
        reasoning: `${detection.summary.bySource.vitest} test failures detected`,
      });
    }

    if (detection.summary.bySource.node > 0) {
      commands.push({
        command: "/doctor",
        parameters: ["runtime", "--trace"],
        confidence: 0.85,
        reasoning: `${detection.summary.bySource.node} runtime errors detected`,
      });
    }

    // General doctor for multiple error types
    if (
      Object.values(detection.summary.bySource).filter((count) => count > 0)
        .length > 1
    ) {
      commands.push({
        command: "/doctor",
        parameters: ["--verbose", "--all"],
        confidence: 0.8,
        reasoning: "Multiple error types detected",
      });
    }

    return commands;
  }

  /**
   * Initialize natural language mappings
   */
  private initializeNaturalLanguageMappings(): void {
    this.naturalLanguageMappings = {
      patterns: [
        // Code creation patterns
        {
          phrases: [
            "create a (.+) function",
            "write a (.+) component",
            "implement (.+) logic",
            "generate (.+) code",
            "build (.+) feature",
            "make (.+) work",
          ],
          command: "/code",
          parameters: (match) => [match[1]],
          confidence: 0.9,
          weight: 1.0,
          languages: ["en"],
        },

        // Error analysis patterns
        {
          phrases: [
            "fix this error",
            "help with this bug",
            "analyze this issue",
            "debug this problem",
            "resolve this error",
            "what's wrong with",
          ],
          command: "/doctor",
          parameters: () => ["analyze", "--verbose"],
          confidence: 0.95,
          weight: 1.2,
          languages: ["en"],
        },

        // Testing patterns
        {
          phrases: [
            "run tests",
            "test this code",
            "check if (.+) works",
            "validate (.+)",
            "run unit tests",
            "execute test suite",
          ],
          command: "/test",
          parameters: (match) => (match[1] ? [match[1]] : []),
          confidence: 0.85,
          weight: 1.0,
          languages: ["en"],
        },

        // File operations
        {
          phrases: [
            "show me (.+) file",
            "open (.+)",
            "read (.+) contents",
            "display (.+)",
            "list files in (.+)",
            "find files like (.+)",
          ],
          command: "/shell",
          parameters: (match) => ["cat", match[1]],
          confidence: 0.8,
          weight: 1.0,
          languages: ["en"],
        },

        // Japanese patterns
        {
          phrases: [
            "(.+)を作って",
            "(.+)のコードを書いて",
            "(.+)を実装して",
            "(.+)を生成して",
            "(.+)機能を作って",
          ],
          command: "/code",
          parameters: (match) => [match[1]],
          confidence: 0.9,
          weight: 1.0,
          languages: ["ja"],
        },

        {
          phrases: [
            "このエラーを修正して",
            "このバグを直して",
            "この問題を解析して",
            "デバッグして",
            "エラーを解決して",
            "何が悪いの",
          ],
          command: "/doctor",
          parameters: () => ["analyze", "--verbose"],
          confidence: 0.95,
          weight: 1.2,
          languages: ["ja"],
        },

        // Math/calculation patterns
        {
          phrases: [
            "calculate (.+)",
            "compute (.+)",
            "solve for (.+)",
            "what is (.+)",
            "find the value of (.+)",
            "evaluate (.+)",
          ],
          command: "/calc",
          parameters: (match) => [match[1]],
          confidence: 0.9,
          weight: 1.1,
          languages: ["en"],
        },

        // Image generation patterns
        {
          phrases: [
            "create an image of (.+)",
            "generate a picture of (.+)",
            "draw (.+)",
            "make an illustration of (.+)",
            "design (.+)",
          ],
          command: "/image",
          parameters: (match) => [match[1]],
          confidence: 0.85,
          weight: 1.0,
          languages: ["en"],
        },
      ],
    };
  }

  /**
   * Create flexible regex from phrase pattern
   */
  private createFlexibleRegex(phrase: string): RegExp {
    // Add word boundaries and make matching more flexible
    const escaped = phrase
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\(\\\.\\\+\\\)/g, "(.+)")
      .replace(/\s+/g, "\\s+");

    return new RegExp(`\\b${escaped}\\b`, "i");
  }

  /**
   * Adjust confidence based on context
   */
  private adjustConfidenceForContext(
    baseConfidence: number,
    context: IntentContext,
    command: string,
  ): number {
    let adjustment = 0;

    // Error context boost
    if (context.errorAnalysis?.hasErrors) {
      if (command === "/doctor" || command === "/fix") {
        adjustment += 0.2;
      }
    }

    // Clipboard context boost
    if (context.clipboardAnalysis) {
      if (context.clipboardAnalysis.containsCode && command === "/code") {
        adjustment += 0.15;
      }
      if (context.clipboardAnalysis.containsErrors && command === "/doctor") {
        adjustment += 0.25;
      }
    }

    // Previous command context
    if (context.previousCommands.includes(command)) {
      adjustment += 0.1; // Slight boost for recently used commands
    }

    // User preferences
    if (this.userPreferences.favoriteCommands.includes(command)) {
      adjustment += 0.05;
    }

    return Math.min(1.0, baseConfidence + adjustment);
  }

  /**
   * Score and rank candidates
   */
  private scoreAndRankCandidates(
    candidates: Array<{
      command: string;
      parameters?: string[];
      confidence: number;
      reasoning: string;
      source: string;
    }>,
    context: IntentContext,
  ): Array<{
    command: string;
    parameters?: string[];
    confidence: number;
    reasoning: string;
  }> {
    // Group by command and take highest confidence
    const commandMap = new Map<string, any>();

    for (const candidate of candidates) {
      const key = candidate.command;
      const existing = commandMap.get(key);

      if (!existing || candidate.confidence > existing.confidence) {
        commandMap.set(key, {
          ...candidate,
          confidence: this.adjustConfidenceForContext(
            candidate.confidence,
            context,
            candidate.command,
          ),
        });
      }
    }

    // Convert back to array and sort
    const scoredCandidates = Array.from(commandMap.values());
    scoredCandidates.sort((a, b) => b.confidence - a.confidence);

    return scoredCandidates;
  }

  /**
   * Build intent context from analysis results
   */
  private buildIntentContext(
    context: IntentContext,
    stageResults: any[],
  ): EnhancedIntent["context"] {
    const clipboardStage = stageResults.find((s) => s.type === "clipboard");
    const errorStage = stageResults.find((s) => s.type === "error");

    return {
      isError: errorStage?.result?.hasErrors || false,
      isCode: clipboardStage?.result?.containsCode || false,
      hasAttachments: (context.attachments?.length || 0) > 0,
      language: clipboardStage?.result?.language,
      framework: clipboardStage?.result?.framework,
    };
  }

  /**
   * Determine suggested execution mode
   */
  private determineSuggestedExecution(
    confidence: number,
    source: string,
  ): "auto" | "confirm" | "manual" {
    if (
      confidence >= this.userPreferences.autoExecuteThreshold &&
      source === "error"
    ) {
      return "auto"; // Auto-execute high-confidence error fixes
    }

    if (confidence >= 0.8) {
      return "confirm"; // Confirm high-confidence commands
    }

    return "manual"; // Manual execution for lower confidence
  }

  /**
   * Get language-specific patterns
   */
  private getLanguagePatterns(language: string): NaturalLanguageMapping {
    // Return filtered patterns for the specified language
    return {
      patterns: this.naturalLanguageMappings.patterns.filter(
        (p) => p.languages.includes(language) || p.languages.includes("en"),
      ),
    };
  }

  /**
   * Get follow-up commands based on previous command
   */
  private getFollowupCommands(
    lastCommand: string,
  ): Array<{ command: string; confidence: number }> {
    const followups: Record<
      string,
      Array<{ command: string; confidence: number }>
    > = {
      "/code": [
        { command: "/test", confidence: 0.7 },
        { command: "/review", confidence: 0.6 },
        { command: "/lint", confidence: 0.5 },
      ],
      "/test": [
        { command: "/code", confidence: 0.6 },
        { command: "/debug", confidence: 0.5 },
      ],
      "/doctor": [
        { command: "/fix", confidence: 0.8 },
        { command: "/lint", confidence: 0.6 },
        { command: "/test", confidence: 0.5 },
      ],
      "/lint": [
        { command: "/fix", confidence: 0.7 },
        { command: "/review", confidence: 0.5 },
      ],
    };

    return followups[lastCommand] || [];
  }

  /**
   * Analyze session patterns
   */
  private analyzeSessionPatterns(sessionData: Record<string, any>): Array<{
    command: string;
    confidence: number;
    reasoning: string;
  }> {
    const patterns: Array<{
      command: string;
      confidence: number;
      reasoning: string;
    }> = [];

    // Analyze command frequency
    if (sessionData.commandFrequency) {
      const sortedCommands = Object.entries(sessionData.commandFrequency)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3);

      for (const [command, frequency] of sortedCommands) {
        patterns.push({
          command: command as string,
          confidence: Math.min(0.4, (frequency as number) * 0.1),
          reasoning: `Frequently used command (${frequency} times)`,
        });
      }
    }

    return patterns;
  }

  /**
   * Update metrics
   */
  private updateMetrics(intent: EnhancedIntent, responseTime: number): void {
    this.metrics.successfulMappings++;
    this.metrics.averageConfidence =
      (this.metrics.averageConfidence * (this.metrics.successfulMappings - 1) +
        intent.confidence) /
      this.metrics.successfulMappings;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) +
        responseTime) /
      this.metrics.totalRequests;
  }

  /**
   * Update context window
   */
  private updateContext(input: ProcessedInput, intent: EnhancedIntent): void {
    this.contextWindow.previousCommands.push(intent.command);
    if (this.contextWindow.previousCommands.length > 10) {
      this.contextWindow.previousCommands.shift();
    }

    // Update session data
    if (!this.contextWindow.sessionData) {
      this.contextWindow.sessionData = {};
    }

    if (!this.contextWindow.sessionData.commandFrequency) {
      this.contextWindow.sessionData.commandFrequency = {};
    }

    const freq = this.contextWindow.sessionData.commandFrequency;
    freq[intent.command] = (freq[intent.command] || 0) + 1;
  }

  /**
   * Merge context with existing context window
   */
  private mergeContext(context?: Partial<IntentContext>): IntentContext {
    return {
      ...this.contextWindow,
      ...context,
    };
  }

  /**
   * Enhance intent with additional processing
   */
  private enhanceIntent(
    intent: EnhancedIntent,
    context: IntentContext,
  ): EnhancedIntent {
    // Apply user aliases
    if (this.userPreferences.commandAliases[intent.command]) {
      intent.command = this.userPreferences.commandAliases[intent.command];
    }

    // Add context-specific parameters
    if (context.attachments && intent.command === "/code") {
      const fileAttachments = context.attachments.filter(
        (a) => a.type === "file",
      );
      if (fileAttachments.length > 0 && !intent.parameters) {
        intent.parameters = [fileAttachments[0].path];
      }
    }

    return intent;
  }

  /**
   * Learn from user feedback
   */
  async learn(
    input: string,
    expectedCommand: string,
    actualCommand?: string,
    wasCorrect?: boolean,
  ): Promise<void> {
    const learningData: LearningData = {
      input,
      expectedCommand,
      actualCommand,
      confidence: 0.5, // Will be updated when we have the actual confidence
      wasCorrect: wasCorrect ?? expectedCommand === actualCommand,
      timestamp: Date.now(),
      context: { ...this.contextWindow },
    };

    this.learningHistory.push(learningData);

    // Keep learning history manageable
    if (this.learningHistory.length > 1000) {
      this.learningHistory = this.learningHistory.slice(-1000);
    }

    this.emit("learning-update", learningData);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: Partial<UserPreferences>): void {
    Object.assign(this.userPreferences, preferences);
    this.emit("preferences-updated", this.userPreferences);
  }

  /**
   * Get current context
   */
  getContext(): IntentContext {
    return { ...this.contextWindow };
  }

  /**
   * Reset context (for new session)
   */
  resetContext(): void {
    this.contextWindow = {
      previousCommands: [],
      sessionData: {},
    };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.clipboardAnalyzer.on("analysis", (analysis: ClipboardAnalysis) => {
      this.contextWindow.clipboardAnalysis = analysis;
    });

    this.clipboardAnalyzer.on("security-issue", (issues) => {
      this.emit("security-alert", issues);
    });
  }
}

export default EnhancedIntentRecognizer;
