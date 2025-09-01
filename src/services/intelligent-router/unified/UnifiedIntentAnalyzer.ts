/**
 * Unified Intent Analyzer
 * Integrates all MARIA _intent recognition systems
 */

import {
  UnifiedIntentMapping,
  UnifiedOperationIntent,
  CommandIntent,
  LinuxIntent,
  InternalModeIntent,
  TaskIntent,
  NLPEntities,
  _RiskLevel,
  _OperationType,
} from "./types";
import { IntelligentRouterService } from "../IntelligentRouterService";
import { IntentRecognizer } from "../IntentRecognizer";
import { NaturalLanguageProcessor } from "../NaturalLanguageProcessor";
import { LinuxIntelligenceEngine } from "../../linux-intelligence/LinuxIntelligenceEngine";
import { ModeRecognitionEngine } from "../../internal-mode/ModeRecognitionEngine";
import { IntentAnalyzer as ActiveReportingIntentAnalyzer } from "../../active-reporting/IntentAnalyzer";
import { CommandMappingService } from "../../internal-mode/services/CommandMappingService";

export class UnifiedIntentAnalyzer {
  private intelligentRouter: IntelligentRouterService;
  private intentRecognizer: IntentRecognizer;
  private nlpProcessor: NaturalLanguageProcessor;
  private linuxIntelligence: LinuxIntelligenceEngine;
  private modeRecognition: ModeRecognitionEngine;
  private activeReportingAnalyzer: ActiveReportingIntentAnalyzer;
  private commandMapping: CommandMappingService;

  constructor() {
    // Initialize all existing services
    this.intelligentRouter = new IntelligentRouterService();
    this.intentRecognizer = new IntentRecognizer();
    this.nlpProcessor = new NaturalLanguageProcessor();
    this.linuxIntelligence = new LinuxIntelligenceEngine();
    this.modeRecognition = new ModeRecognitionEngine();
    this.activeReportingAnalyzer = new ActiveReportingIntentAnalyzer();
    this.commandMapping = new CommandMappingService();
  }

  /**
   * Analyze user input using all available systems
   */
  async analyzeWithAllSystems(input: string): Promise<UnifiedIntentMapping> {
    // Parallel analysis using all systems
    const [commandIntent, linuxIntent, internalMode, nlpEntities, taskIntent] =
      await Promise.all([
        this.analyzeCommand(input),
        this.analyzeLinuxIntent(input),
        this.analyzeInternalMode(input),
        this.analyzeNLP(input),
        this.analyzeTask(input),
      ]);

    // Detect _operation type and action
    const _operation = this.detectOperation(input, {
      commandIntent,
      linuxIntent,
      nlpEntities,
      taskIntent,
    });

    // Calculate overall _confidence
    const _confidence = this.calculateOverallConfidence({
      commandIntent,
      linuxIntent,
      internalMode,
      taskIntent,
    });

    // Assess combined risk
    const _riskLevel = this.assessCombinedRisk({
      linuxIntent,
      _operation,
      taskIntent,
    });

    return {
      _operation,
      commandIntent,
      linuxIntent,
      internalMode,
      taskIntent,
      nlpEntities,
      _confidence,
      _riskLevel,
      timestamp: new Date(),
      originalInput: input,
    };
  }

  /**
   * Analyze command _intent using IntelligentRouterService
   */
  private async analyzeCommand(
    input: string,
  ): Promise<CommandIntent | undefined> {
    try {
      const _result = await this.intelligentRouter.route(input);
      if (_result) {
        return {
          command: _result.command,
          _confidence: _result.confidence,
          parameters: _result.parameters || object,
          originalInput: input,
          language: _result.language || "en",
          alternatives: _result.alternatives,
          reasoning: _result.reasoning,
        };
      }
    } catch (_error) {
      console.debug("Command analysis failed:", _error);
    }
    return undefined;
  }

  /**
   * Analyze Linux command _intent
   */
  private async analyzeLinuxIntent(
    input: string,
  ): Promise<LinuxIntent | undefined> {
    try {
      const _intent = await this.linuxIntelligence.analyzeIntent(input);
      if (_intent) {
        const _riskAssessment =
          await this.linuxIntelligence.assessRisk(_intent);
        return {
          action: _intent.action,
          target: _intent.target,
          category: _intent.category as any,
          _confidence: _intent.confidence,
          _riskLevel: _riskAssessment.level as RiskLevel,
          commands: _intent.suggestedCommands,
        };
      }
    } catch (_error) {
      console.debug("Linux _intent analysis failed:", _error);
    }
    return undefined;
  }

  /**
   * Analyze internal mode
   */
  private async analyzeInternalMode(
    input: string,
  ): Promise<InternalModeIntent | undefined> {
    try {
      const _result = await this.modeRecognition.recognizeMode(input);
      if (_result && _result.mode) {
        return {
          mode: _result.mode as any,
          _confidence: _result.confidence,
          triggeredBy: _result.triggeredBy || ["_intent"],
          reasoning: _result.reasoning,
        };
      }
    } catch (_error) {
      console.debug("Mode recognition failed:", _error);
    }
    return undefined;
  }

  /**
   * Analyze NLP entities
   */
  private async analyzeNLP(input: string): Promise<NLPEntities> {
    try {
      const _result = await this.nlpProcessor.process(input);
      return {
        language: _result.language,
        tokens: _result.tokens,
        keywords: _result.keywords || [],
        entities: {
          files: _result.entities?.files,
          urls: _result.entities?.urls,
          commands: _result.entities?.commands,
          codeBlocks: _result.entities?.codeBlocks,
          frameworks: _result.entities?.frameworks,
        },
        sentiment: _result.sentiment,
      };
    } catch (_error) {
      console.debug("NLP analysis failed:", _error);
      return {
        language: "en",
        tokens: input.split(/\s+/),
        keywords: [],
        entities: Record<string, any>,
      };
    }
  }

  /**
   * Analyze task _intent
   */
  private async analyzeTask(input: string): Promise<TaskIntent | undefined> {
    try {
      const _result = await this.activeReportingAnalyzer.analyze(input);
      if (_result) {
        return {
          primary: _result.primaryIntent,
          secondary: _result.secondaryIntents || [],
          complexity: _result.complexity as any,
          implicitRequirements: _result.implicitRequirements || [],
          capabilities: _result.requiredCapabilities,
          risks: _result.identifiedRisks,
        };
      }
    } catch (_error) {
      console.debug("Task analysis failed:", _error);
    }
    return undefined;
  }

  /**
   * Detect _operation type and action from analysis results
   */
  private detectOperation(
    input: string,
    analysis: {
      commandIntent?: CommandIntent;
      linuxIntent?: LinuxIntent;
      nlpEntities?: NLPEntities;
      taskIntent?: TaskIntent;
    },
  ): UnifiedOperationIntent {
    // Check for file operations
    if (this.isFileOperation(input, analysis)) {
      return this.createFileOperation(input, analysis);
    }

    // Check for Linux commands
    if (analysis.linuxIntent && analysis.linuxIntent.confidence > 0.6) {
      return {
        type: "linux",
        action: analysis.linuxIntent.action,
        target: analysis.linuxIntent.target,
        parameters: {
          category: analysis.linuxIntent.category,
          commands: analysis.linuxIntent.commands,
        },
      };
    }

    // Check for document operations
    if (this.isDocumentOperation(input, analysis)) {
      return this.createDocumentOperation(input, analysis);
    }

    // Check for MARIA-specific operations
    if (
      analysis.commandIntent &&
      analysis.commandIntent.command.startsWith("/")
    ) {
      return {
        type: "maria",
        action: analysis.commandIntent.command,
        parameters: analysis.commandIntent.parameters,
      };
    }

    // Default to code _operation
    return {
      type: "code",
      action: analysis.taskIntent?.primary || "analyze",
      parameters: Record<string, any>,
    };
  }

  /**
   * Check if input is a file _operation
   */
  private isFileOperation(_input: string, analysis: unknown): boolean {
    const _filePatterns = [
      /(?:create|make|save|write|output|作成|作って|保存)/i,
      /(?:read|show|display|open|view|見せて|表示)/i,
      /(?:edit|modify|update|change|編集|修正)/i,
      /(?:delete|remove|rm|削除|消して)/i,
      /\.\w+(?:\s|$)/, // File extension
    ];

    return (
      _filePatterns.some((pattern) => pattern.test(_input)) ||
      analysis.nlpEntities?.entities?.files?.length > 0
    );
  }

  /**
   * Create file _operation _intent
   */
  private createFileOperation(
    _input: string,
    analysis: unknown,
  ): UnifiedOperationIntent {
    let action = "create";
    let target = "";
    let implicitSave = false;

    // Detect action type
    if (
      /(?:read|show|display|open|view|見せて|表示|ドキュメントを見て)/i.test(
        _input,
      )
    ) {
      action = "read";
    } else if (/(?:edit|modify|update|change|編集|修正)/i.test(_input)) {
      action = "modify";
    } else if (/(?:delete|remove|rm|削除|消して)/i.test(_input)) {
      action = "delete";
    } else if (/(?:create|make|save|write|作成|作って|保存)/i.test(_input)) {
      action = "create";
      implicitSave = /(?:作って|つくって|保存|として)/.test(_input);
    }

    // Extract target file
    const _fileMatch = _input.match(/([^\s]+\.\w+)/);
    if (_fileMatch) {
      target = _fileMatch[1];
    } else if (analysis.nlpEntities?.entities?.files?.[0]) {
      target = analysis.nlpEntities.entities.files[0];
    }

    return {
      type: "file",
      action,
      target,
      parameters: Record<string, any>,
      implicitSave,
    };
  }

  /**
   * Check if input is a document _operation
   */
  private isDocumentOperation(_input: string, _analysis: unknown): boolean {
    const _docPatterns = [
      /(?:analyze|examine|inspect|調べて|分析)/i,
      /(?:extract|pull out|抽出|取り出す)/i,
      /(?:summarize|tldr|要約|まとめ)/i,
      /(?:ドキュメント|資料|document|docs)/i,
    ];

    return _docPatterns.some((pattern) => pattern.test(_input));
  }

  /**
   * Create document _operation _intent
   */
  private createDocumentOperation(
    _input: string,
    _analysis: unknown,
  ): UnifiedOperationIntent {
    let action = "analyze";

    if (/(?:extract|pull out|抽出|取り出す)/i.test(_input)) {
      action = "extract";
    } else if (/(?:summarize|tldr|要約|まとめ)/i.test(_input)) {
      action = "summarize";
    } else if (/(?:資料を見る|ドキュメントを見て)/i.test(_input)) {
      action = "read";
    }

    return {
      type: "document",
      action,
      parameters: Record<string, any>,
    };
  }

  /**
   * Calculate overall _confidence from all systems
   */
  private calculateOverallConfidence(analysis: unknown): number {
    const _weights = {
      command: 0.3,
      linux: 0.25,
      mode: 0.2,
      task: 0.25,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    if (analysis.commandIntent?._confidence) {
      weightedSum += analysis.commandIntent._confidence * _weights.command;
      totalWeight += _weights.command;
    }

    if (analysis.linuxIntent?._confidence) {
      weightedSum += analysis.linuxIntent._confidence * _weights.linux;
      totalWeight += _weights.linux;
    }

    if (analysis.internalMode?._confidence) {
      weightedSum += analysis.internalMode._confidence * _weights.mode;
      totalWeight += _weights.mode;
    }

    if (analysis.taskIntent) {
      // Estimate _confidence based on complexity
      const _complexityConfidence = {
        simple: 0.9,
        moderate: 0.75,
        complex: 0.6,
        very_complex: 0.5,
      };
      const _confidence =
        _complexityConfidence[analysis.taskIntent.complexity] || 0.7;
      weightedSum += _confidence * _weights.task;
      totalWeight += _weights.task;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  /**
   * Assess combined risk level
   */
  private assessCombinedRisk(analysis: unknown): RiskLevel {
    // If Linux _intent has risk assessment, use it as base
    if (analysis.linuxIntent?.riskLevel) {
      return analysis.linuxIntent.riskLevel;
    }

    // Assess based on _operation type
    const _operation = analysis._operation;
    if (!_operation) return "LOW";

    // File operations risk assessment
    if (_operation.type === "file") {
      if (_operation.action === "delete") return "MEDIUM";
      if (_operation.action === "modify") return "LOW";
      if (_operation.action === "create" && _operation.target?.startsWith("/"))
        return "MEDIUM";
      return "SAFE";
    }

    // Linux operations default to their risk level
    if (_operation.type === "linux") {
      return analysis.linuxIntent?.riskLevel || "MEDIUM";
    }

    // Document operations are generally safe
    if (_operation.type === "document") {
      return "SAFE";
    }

    // MARIA operations depend on the command
    if (_operation.type === "maria") {
      // System commands might be risky
      if (/system|config|setup/i.test(_operation.action)) return "MEDIUM";
      return "LOW";
    }

    return "LOW";
  }
}
