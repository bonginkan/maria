import { EventEmitter } from 'events';
import { NaturalLanguageProcessor } from './NaturalLanguageProcessor';
import { IntentRecognizer } from './IntentRecognizer';
import { ParameterExtractor } from './ParameterExtractor';
import { MultilingualDictionary } from './MultilingualDictionary';
import { LanguageDetector } from './LanguageDetector';
import { CommandMappings } from './CommandMappings';
import { UserPatternAnalyzer } from './UserPatternAnalyzer';
import chalk from 'chalk';

export interface CommandIntent {
  command: string;
  confidence: number;
  parameters: Record<string, unknown>;
  originalInput: string;
  language: string;
  alternatives?: Array<{ command: string; confidence: number }>;
}

export interface RouterConfig {
  confidenceThreshold?: number;
  enableLearning?: boolean;
  supportedLanguages?: string[];
  enableConfirmation?: boolean;
  maxAlternatives?: number;
}

export interface RouterMetrics {
  totalRequests: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageConfidence: number;
  averageResponseTime: number;
  commandUsageStats: Map<string, number>;
}

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

  constructor(config: RouterConfig = {}) {
    super();

    this.config = {
      confidenceThreshold: config.confidenceThreshold ?? 0.85,
      enableLearning: config.enableLearning ?? true,
      supportedLanguages: config.supportedLanguages ?? ['en', 'ja', 'cn', 'ko', 'vn'],
      enableConfirmation: config.enableConfirmation ?? true,
      maxAlternatives: config.maxAlternatives ?? 3,
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
    this.intentRecognizer = new IntentRecognizer(this.config);
    this.parameterExtractor = new ParameterExtractor();
    this.dictionary = new MultilingualDictionary();
    this.languageDetector = new LanguageDetector();
    this.commandMappings = new CommandMappings();
    this.userPatternAnalyzer = new UserPatternAnalyzer();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log(chalk.cyan('🧠 Initializing Intelligent Router...'));

      // Initialize all components
      await Promise.all([
        this.dictionary.initialize(),
        this.commandMappings.initialize(),
        this.nlpProcessor.initialize(),
        this.intentRecognizer.initialize(),
        this.userPatternAnalyzer.initialize(),
      ]);

      this.isInitialized = true;
      this.emit('initialized');

      console.log(chalk.green('✅ Intelligent Router initialized successfully'));
    } catch (error) {
      console.error(chalk.red('Failed to initialize Intelligent Router:'), error);
      throw error;
    }
  }

  async route(input: string): Promise<CommandIntent | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Step 1: Detect language
      const language = await this.languageDetector.detect(input);

      if (!this.config.supportedLanguages.includes(language)) {
        console.log(chalk.yellow(`Language '${language}' not supported, falling back to English`));
      }

      // Step 2: Process natural language
      const processedInput = await this.nlpProcessor.process(input, language);

      // Step 3: Recognize intent
      const intent = await this.intentRecognizer.recognize(processedInput);

      if (!intent || intent.confidence < this.config.confidenceThreshold) {
        this.metrics.failedRoutes++;
        this.emit('route:failed', { input, language, confidence: intent?.confidence ?? 0 });
        return null;
      }

      // Step 4: Extract parameters
      const parameters = await this.parameterExtractor.extract(input, intent.command, language);

      // Step 5: Build command intent
      const commandIntent: CommandIntent = {
        command: intent.command,
        confidence: intent.confidence,
        parameters,
        originalInput: input,
        language,
        alternatives: intent.alternatives,
      };

      // Step 6: Learn from pattern if enabled
      if (this.config.enableLearning) {
        await this.userPatternAnalyzer.recordPattern(input, commandIntent);
      }

      // Update metrics
      this.metrics.successfulRoutes++;
      this.updateMetrics(intent.confidence, Date.now() - startTime, intent.command);

      this.emit('route:success', commandIntent);

      return commandIntent;
    } catch (error) {
      this.metrics.failedRoutes++;
      this.emit('route:error', { input, error });
      console.error(chalk.red('Routing error:'), error);
      return null;
    }
  }

  async suggestCommand(partialInput: string): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const language = await this.languageDetector.detect(partialInput);
      const suggestions = await this.commandMappings.getSuggestions(
        partialInput,
        language,
        this.config.maxAlternatives,
      );

      return suggestions;
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  async getCommandExplanation(command: string, language: string = 'en'): Promise<string> {
    return this.dictionary.getExplanation(command, language);
  }

  async needsConfirmation(intent: CommandIntent): Promise<boolean> {
    if (!this.config.enableConfirmation) return false;

    // Need confirmation for low confidence or destructive commands
    const destructiveCommands = ['/delete', '/reset', '/clear', '/exit'];
    const isDestructive = destructiveCommands.includes(intent.command);
    const isLowConfidence = intent.confidence < 0.9;

    return isDestructive || isLowConfidence;
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

  private updateMetrics(confidence: number, responseTime: number, command: string): void {
    // Update average confidence
    const totalConfidence = this.metrics.averageConfidence * (this.metrics.successfulRoutes - 1);
    this.metrics.averageConfidence = (totalConfidence + confidence) / this.metrics.successfulRoutes;

    // Update average response time
    const totalResponseTime =
      this.metrics.averageResponseTime * (this.metrics.successfulRoutes - 1);
    this.metrics.averageResponseTime =
      (totalResponseTime + responseTime) / this.metrics.successfulRoutes;

    // Update command usage stats
    const currentCount = this.metrics.commandUsageStats.get(command) ?? 0;
    this.metrics.commandUsageStats.set(command, currentCount + 1);
  }

  async trainOnFeedback(input: string, correctCommand: string, wasCorrect: boolean): Promise<void> {
    if (!this.config.enableLearning) return;

    try {
      await this.userPatternAnalyzer.recordFeedback(input, correctCommand, wasCorrect);
      await this.intentRecognizer.updateModel(input, correctCommand, wasCorrect);

      this.emit('training:complete', { input, correctCommand, wasCorrect });
    } catch (error) {
      console.error('Failed to train on feedback:', error);
    }
  }

  getConfidenceThreshold(): number {
    return this.config.confidenceThreshold;
  }

  setConfidenceThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    this.config.confidenceThreshold = threshold;
  }

  getSupportedLanguages(): string[] {
    return [...this.config.supportedLanguages];
  }

  isLanguageSupported(language: string): boolean {
    return this.config.supportedLanguages.includes(language);
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

export function getIntelligentRouter(config?: RouterConfig): IntelligentRouterService {
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
