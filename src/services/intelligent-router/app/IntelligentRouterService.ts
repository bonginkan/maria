import { EventEmitter } from "node:events";
import { NaturalLanguageProcessor } from "../infra/NaturalLanguageProcessor";
import { IntentRecognizer } from "../analysis/IntentRecognizer";
import { ParameterExtractor } from "../analysis/ParameterExtractor";
import { MultilingualDictionary } from "../analysis/MultilingualDictionary";
import { LanguageDetector } from "../infra/LanguageDetector";
import { CommandMappings } from "./CommandMappings";
import { UserPatternAnalyzer } from "../analysis/UserPatternAnalyzer";
import type {
  CommandIntent,
  RouterConfig,
  RouterMetrics,
} from "../types/common-types";
import chalk from "chalk";

export class IntelligentRouterService extends EventEmitter {
  private nlpProcessor: NaturalLanguageProcessor;
  private intentRecognizer: IntentRecognizer;
  private parameterExtractor: ParameterExtractor;
  private dictionary: MultilingualDictionary;
  private languageDetector: LanguageDetector;
  private commandMappings: CommandMappings;
  private userPatternAnalyzer: UserPatternAnalyzer;

  private config: Required<RouterConfig>;
  private metrics: RouterMetrics;
  private isInitialized: boolean = false;

  constructor(_config: RouterConfig = {}) {
    super();

    this._config = {
      confidenceThreshold: _config.confidenceThreshold ?? 0.85,
      enableLearning: _config.enableLearning ?? true,
      supportedLanguages: _config.supportedLanguages ?? [
        "en",
        "ja",
        "cn",
        "ko",
        "vn",
      ],
      enableConfirmation: _config.enableConfirmation ?? true,
      maxAlternatives: _config.maxAlternatives ?? 3,
    };

    this.metrics = {
      totalRequests: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      averageConfidence: 0,
      averageResponseTime: 0,
      commandUsageStats: new Map(),
    };

    this.nlpProcessor = new NaturalLanguageProcessor();
    this.intentRecognizer = new IntentRecognizer(this._config);
    this.parameterExtractor = new ParameterExtractor();
    this.dictionary = new MultilingualDictionary();
    this.languageDetector = new LanguageDetector();
    this.commandMappings = new CommandMappings();
    this.userPatternAnalyzer = new UserPatternAnalyzer();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize silently

      // Initialize all components
      await Promise.all([
        this.dictionary.initialize(),
        this.commandMappings.initialize(),
        this.nlpProcessor.initialize(),
        this.intentRecognizer.initialize(),
        this.userPatternAnalyzer.initialize(),
      ]);

      this.isInitialized = true;
      this.emit("initialized");

      // Initialized successfully
    } catch (_error) {
      console._error(
        chalk.red("Failed to initialize Intelligent Router:"),
        _error,
      );
      throw _error;
    }
  }

  async route(input: string): Promise<CommandIntent | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const _startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Step 1: Detect _language
      const _language = await this.languageDetector.detect(input);

      if (!this.config.supportedLanguages.includes(_language)) {
        // Debug: Language fallback - commented out to prevent input field pollution
        // console.log(chalk.yellow(`Language '${_language}' not supported, falling back to English`));
      }

      // Step 2: Process natural _language
      const processedInput = await this.nlpProcessor.process(input, _language);

      // Step 3: Recognize intent
      const intent = await this.intentRecognizer.recognize(processedInput);

      if (!intent || intent.confidence < this.config.confidenceThreshold) {
        this.metrics.failedRoutes++;
        this.emit("route:failed", {
          input,
          _language,
          confidence: intent?.confidence ?? 0,
        });
        return null;
      }

      // Step 4: Extract _parameters
      const _parameters = await this.parameterExtractor.extract(
        input,
        intent.command,
        _language,
      );

      // Step 5: Build command intent
      const commandIntent: CommandIntent = {
        command: intent.command,
        confidence: intent.confidence,
        _parameters,
        originalInput: input,
        _language,
        alternatives: intent.alternatives,
      };

      // Step 6: Learn from pattern if enabled
      if (this.config.enableLearning) {
        await this.userPatternAnalyzer.recordPattern(input, commandIntent);
      }

      // Update metrics
      this.metrics.successfulRoutes++;
      this.updateMetrics(
        intent.confidence,
        Date.now() - _startTime,
        intent.command,
      );

      this.emit("route:success", commandIntent);

      return commandIntent;
    } catch (_error) {
      this.metrics.failedRoutes++;
      this.emit("route:_error", { input, _error });
      console._error(chalk.red("Routing _error:"), _error);
      return null;
    }
  }

  async suggestCommand(partialInput: string): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const _language = await this.languageDetector.detect(partialInput);
      const _suggestions = await this.commandMappings.getSuggestions(
        partialInput,
        _language,
        this.config.maxAlternatives,
      );

      return _suggestions;
    } catch (_error) {
      console._error("Failed to get _suggestions:", _error);
      return [];
    }
  }

  async getCommandExplanation(
    _command: string,
    _language: string = "en",
  ): Promise<string> {
    return this.dictionary.getExplanation(_command, _language);
  }

  async needsConfirmation(intent: CommandIntent): Promise<boolean> {
    if (!this.config.enableConfirmation) {
      return false;
    }

    // Need confirmation for low confidence or destructive commands
    const _destructiveCommands = ["/delete", "/reset", "/clear", "/exit"];
    const _isDestructive = _destructiveCommands.includes(intent.command);
    const _isLowConfidence = intent.confidence < 0.9;

    return _isDestructive || _isLowConfidence;
  }

  getMetrics(): RouterMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      averageConfidence: 0,
      averageResponseTime: 0,
      commandUsageStats: new Map(),
    };
  }

  private updateMetrics(
    _confidence: number,
    responseTime: number,
    command: string,
  ): void {
    // Update average confidence
    const _totalConfidence =
      this.metrics.averageConfidence * (this.metrics.successfulRoutes - 1);
    this.metrics.averageConfidence =
      (_totalConfidence + _confidence) / this.metrics.successfulRoutes;

    // Update average response time
    const _totalResponseTime =
      this.metrics.averageResponseTime * (this.metrics.successfulRoutes - 1);
    this.metrics.averageResponseTime =
      (_totalResponseTime + responseTime) / this.metrics.successfulRoutes;

    // Update command usage stats
    const _currentCount = this.metrics.commandUsageStats.get(command) ?? 0;
    this.metrics.commandUsageStats.set(command, _currentCount + 1);
  }

  async trainOnFeedback(
    _input: string,
    correctCommand: string,
    wasCorrect: boolean,
  ): Promise<void> {
    if (!this.config.enableLearning) {
      return;
    }

    try {
      await this.userPatternAnalyzer.recordFeedback(
        _input,
        correctCommand,
        wasCorrect,
      );
      await this.intentRecognizer.updateModel(
        _input,
        correctCommand,
        wasCorrect,
      );

      this.emit("training:complete", { _input, correctCommand, wasCorrect });
    } catch (_error) {
      console._error("Failed to train on feedback:", _error);
    }
  }

  getConfidenceThreshold(): number {
    return this.config.confidenceThreshold;
  }

  setConfidenceThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error("Confidence threshold must be between 0 and 1");
    }
    this.config.confidenceThreshold = threshold;
  }

  getSupportedLanguages(): string[] {
    return [...this.config.supportedLanguages];
  }

  isLanguageSupported(_language: string): boolean {
    return this.config.supportedLanguages.includes(_language);
  }

  async exportLearningData(): Promise<unknown> {
    return this.userPatternAnalyzer.exportData();
  }

  async importLearningData(data: unknown): Promise<void> {
    await this.userPatternAnalyzer.importData(data);
  }

  dispose(): void {
    this.removeAllListeners();
    this.isInitialized = false;
  }
}

// Singleton instance
let routerInstance: IntelligentRouterService | null = null;

export function getIntelligentRouter(
  config?: RouterConfig,
): IntelligentRouterService {
  if (!routerInstance) {
    routerInstance = new IntelligentRouterService(config);
  }
  return routerInstance;
}

export function resetIntelligentRouter(): void {
  if (routerInstance) {
    routerInstance.dispose();
    routerInstance = null;
  }
}
