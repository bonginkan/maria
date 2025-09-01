/**
 * Multimodal Intelligence System
 * Advanced system for processing and understanding multiple types of data:
 * text, code, images, audio, video, documents, and structured data.
 * Provides unified intelligence across different modalities.
 */

import { EventEmitter } from "node:events";

// Type-safe EventEmitter - fallback to regular EventEmitter if typed version not available
class TypedEventEmitter<T extends Record<string, any>> extends EventEmitter {
  emit<K extends keyof T>(event: K, data: T[K]): boolean {
    return super.emit(event as string, data);
  }

  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): this {
    return super.on(event as string, listener);
  }

  once<K extends keyof T>(event: K, listener: (data: T[K]) => void): this {
    return super.once(event as string, listener);
  }

  removeListener<K extends keyof T>(
    event: K,
    listener: (data: T[K]) => void,
  ): this {
    return super.removeListener(event as string, listener);
  }
}
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { logger } from "../utils/logger.js";
import { _advancedPredictionEngine } from "./advanced-prediction-engine.js";

export type ModalityType =
  | "text"
  | "code"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "structured"
  | "diagram"
  | "screenshot";

export interface MultimodalInput {
  id: string;
  type: ModalityType;
  data: unknown;
  metadata: InputMetadata;
  timestamp: Date;
  priority: number;
  context: string[];
}

export interface InputMetadata {
  format: string;
  size: number;
  encoding?: string;
  dimensions?: { width: number; height: number };
  duration?: number; // for audio/video
  language?: string;
  source: string;
  quality: number; // 0-1 scale
  tags: string[];
}

export interface ProcessedOutput {
  id: string;
  inputId: string;
  type: "analysis" | "extraction" | "generation" | "transformation" | "summary";
  data: unknown;
  confidence: number;
  processingTime: number;
  metadata: OutputMetadata;
  timestamp: Date;
}

export interface OutputMetadata {
  processor: string;
  version: string;
  parameters: Record<string, unknown>;
  alternativeResults: unknown[];
  qualityScore: number;
}

export interface ModalityProcessor {
  type: ModalityType;
  process(input: MultimodalInput): Promise<ProcessedOutput>;
  canHandle(input: MultimodalInput): boolean;
  getCapabilities(): ProcessingCapability[];
  getConfiguration(): ProcessorConfiguration;
}

export interface ProcessingCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  confidence: number;
  computationCost: number;
}

export interface ProcessorConfiguration {
  model: string;
  version: string;
  parameters: Record<string, unknown>;
  requirements: SystemRequirement[];
}

export interface SystemRequirement {
  type: "memory" | "cpu" | "gpu" | "network" | "storage";
  minimum: number;
  recommended: number;
  unit: string;
}

export interface CrossModalAnalysis {
  id: string;
  inputs: string[]; // Input IDs
  modalities: ModalityType[];
  analysis: CrossModalInsight[];
  correlations: ModalityCorrelation[];
  synthesizedOutput: SynthesizedOutput;
  confidence: number;
  timestamp: Date;
}

export interface CrossModalInsight {
  type:
    | "alignment"
    | "contradiction"
    | "complementary"
    | "redundant"
    | "enhancement";
  description: string;
  evidence: Evidence[];
  confidence: number;
  impact: number;
}

export interface Evidence {
  modalityType: ModalityType;
  inputId: string;
  relevantSection: unknown;
  supportStrength: number;
}

export interface ModalityCorrelation {
  modality1: ModalityType;
  modality2: ModalityType;
  correlationType: "semantic" | "temporal" | "spatial" | "contextual";
  strength: number;
  examples: CorrelationExample[];
}

export interface CorrelationExample {
  input1Id: string;
  input2Id: string;
  alignmentScore: number;
  description: string;
}

export interface SynthesizedOutput {
  type:
    | "unified_understanding"
    | "comprehensive_analysis"
    | "actionable_insights"
    | "decision_support";
  content: unknown;
  sources: string[];
  confidence: number;
  recommendations: string[];
}

export interface IntelligentConversion {
  fromModality: ModalityType;
  toModality: ModalityType;
  converter: ModalityConverter;
  quality: number;
  preservedInformation: number; // 0-1 scale
}

export interface ModalityConverter {
  convert(
    input: MultimodalInput,
    targetModality: ModalityType,
  ): Promise<MultimodalInput>;
  getConversionQuality(fromType: ModalityType, toType: ModalityType): number;
  getSupportedConversions(): ConversionPath[];
}

export interface ConversionPath {
  from: ModalityType;
  to: ModalityType;
  quality: number;
  preservesSemantics: boolean;
  intermediateSteps: ModalityType[];
}

export interface SemanticUnderstanding {
  concept: string;
  modality: ModalityType;
  confidence: number;
  context: SemanticContext[];
  relationships: ConceptRelationship[];
  abstractRepresentation: unknown;
}

export interface SemanticContext {
  type: "temporal" | "spatial" | "causal" | "hierarchical" | "associative";
  description: string;
  strength: number;
}

export interface ConceptRelationship {
  targetConcept: string;
  relationship: string;
  strength: number;
  bidirectional: boolean;
}

export interface AdaptiveInterface {
  userId: string;
  preferredModalities: ModalityPreference[];
  adaptationHistory: InterfaceAdaptation[];
  currentContext: InterfaceContext;
  performanceMetrics: InterfaceMetrics;
}

export interface ModalityPreference {
  modality: ModalityType;
  preference: number; // -1 to 1
  contextDependency: Record<string, number>;
  reasoningType: "explicit" | "implicit" | "inferred";
}

export interface InterfaceAdaptation {
  timestamp: Date;
  trigger: string;
  adaptation: string;
  effectiveness: number;
  userFeedback?: string;
}

export interface InterfaceContext {
  currentTask: string;
  environment: "desktop" | "mobile" | "embedded" | "voice";
  urgency: number;
  complexity: number;
  availableModalities: ModalityType[];
}

export interface InterfaceMetrics {
  taskCompletionRate: number;
  userSatisfaction: number;
  cognitiveLoad: number;
  errorRate: number;
  preferenceStability: number;
}

export interface MultimodalIntelligenceOptions {
  processors?: Map<ModalityType, ModalityProcessor>;
  converters?: Map<string, ModalityConverter>;
  dataDir?: string;
  enablePriorityQueue?: boolean;
  maxQueueSize?: number;
  maxConcurrentProcessing?: number;
  confidenceCalculation?: ConfidenceCalculationConfig;
}

export interface ConfidenceCalculationConfig {
  outputWeight: number; // default: 0.7
  correlationWeight: number; // default: 0.3
  modalityWeights: Record<ModalityType, number>;
}

export interface QueuedTask {
  id: string;
  input: MultimodalInput;
  priority: number;
  timestamp: Date;
  abortController?: AbortController;
  resolve: (output: ProcessedOutput) => void;
  reject: (_error: Error) => void;
}

export interface ProcessingQueue {
  enqueue(task: QueuedTask): void;
  dequeue(): QueuedTask | undefined;
  size(): number;
  clear(): void;
}

/**
 * Type-safe event definitions for MultimodalIntelligence
 */
export interface MultimodalEvents {
  inputProcessed: { inputId: string; outputId: string; modality: ModalityType };
  crossModalAnalysisCompleted: {
    analysisId: string;
    modalityCount: number;
    confidence: number;
  };
  modalityConverted: {
    originalId: string;
    convertedId: string;
    fromType: ModalityType;
    toType: ModalityType;
  };
  processingError: { inputId: string; _error: string; modality: ModalityType };
  queueOverflow: { queueSize: number; droppedTask: QueuedTask };
  memoryWarning: { usage: number; threshold: number; component: string };
  maintenanceCompleted: {
    duration: number;
    cleanedOutputs: number;
    optimizedConcepts: number;
  };
  processingStatsUpdated: { stats: ProcessingStats };
}

export interface ProcessingStats {
  queueSize: number;
  currentlyProcessing: number;
  maxConcurrentProcessing: number;
  totalProcessed: number;
  averageProcessingTime: number;
  errorRate: number;
}

/**
 * Priority-based processing queue implementation
 */
class PriorityQueue implements ProcessingQueue {
  private tasks: QueuedTask[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  enqueue(task: QueuedTask): void {
    if (this.tasks.length >= this.maxSize) {
      throw new Error(`Queue is full (max size: ${this.maxSize})`);
    }

    // Insert task in priority order (higher priority first)
    let insertIndex = 0;
    for (let i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].priority < task.priority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    this.tasks.splice(insertIndex, 0, task);
  }

  dequeue(): QueuedTask | undefined {
    return this.tasks.shift();
  }

  size(): number {
    return this.tasks.length;
  }

  clear(): void {
    // Cancel any abort controllers
    this.tasks.forEach((task) => {
      if (task.abortController && !task.abortController.signal.aborted) {
        task.abortController.abort();
        task.reject(new Error("Task cancelled due to queue clear"));
      }
    });
    this.tasks = [];
  }
}

export class MultimodalIntelligence extends TypedEventEmitter<MultimodalEvents> {
  private static instance: MultimodalIntelligence;
  private processors: Map<ModalityType, ModalityProcessor> = new Map();
  private converters: Map<string, ModalityConverter> = new Map();
  private processedOutputs: Map<string, ProcessedOutput> = new Map();
  private crossModalAnalyses: Map<string, CrossModalAnalysis> = new Map();
  private adaptiveInterfaces: Map<string, AdaptiveInterface> = new Map();
  private semanticUnderstanding: Map<string, SemanticUnderstanding> = new Map();
  private dataDir: string;

  // Priority queue and resource management
  private processingQueue: ProcessingQueue;
  private currentlyProcessing: Set<string> = new Set();
  private maxConcurrentProcessing: number = 3;
  private enablePriorityQueue: boolean = true;
  private timer?: NodeJS.Timeout;
  private isShuttingDown: boolean = false;
  private confidenceConfig: ConfidenceCalculationConfig;

  // Enhanced memory management
  private memoryThresholds = {
    processedOutputsMax: 1000,
    semanticConceptsMax: 500,
    crossModalAnalysesMax: 100,
    adaptiveInterfacesMax: 50,
  };
  private totalErrors: number = 0;
  private startupTime: number = Date.now();

  private constructor(options: MultimodalIntelligenceOptions = {}) {
    super();
    this.dataDir = options.dataDir || join(homedir(), ".maria", "multimodal");
    this.enablePriorityQueue = options.enablePriorityQueue ?? true;
    this.maxConcurrentProcessing = options.maxConcurrentProcessing || 3;
    this.processingQueue = new PriorityQueue(options.maxQueueSize || 100);

    // Initialize confidence calculation config
    this.confidenceConfig = options.confidenceCalculation || {
      outputWeight: 0.7,
      correlationWeight: 0.3,
      modalityWeights: {
        text: 1.0,
        code: 0.9,
        image: 0.8,
        audio: 0.7,
        video: 0.6,
        document: 0.8,
        structured: 0.9,
        diagram: 0.7,
        screenshot: 0.8,
      },
    };

    // Initialize with provided processors/converters if any
    if (options.processors) {
      this.processors = new Map(options.processors);
    }
    if (options.converters) {
      this.converters = new Map(options.converters);
    }

    // Initialization is done asynchronously via initialize()
  }

  /**
   * Initialize the intelligence engine asynchronously
   */
  private async initialize(): Promise<void> {
    // Create data directory
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }

    // Only initialize default processors/converters if none were provided
    if (this.processors.size === 0) {
      this.initializeProcessors();
    }
    if (this.converters.size === 0) {
      this.initializeConverters();
    }

    this.startProcessingWorkers();
    await this.loadPersistedData();
    this.startIntelligenceEngine();
  }

  public static async getInstance(
    options?: MultimodalIntelligenceOptions,
  ): Promise<MultimodalIntelligence> {
    if (!MultimodalIntelligence.instance) {
      MultimodalIntelligence.instance = new MultimodalIntelligence(options);
      await MultimodalIntelligence.instance.initialize();
    }
    return MultimodalIntelligence.instance;
  }

  /**
   * Register a custom processor
   */
  registerProcessor(type: ModalityType, processor: ModalityProcessor): void {
    this.processors.set(type, processor);
    logger.info(`Registered processor for modality: ${type}`);
  }

  /**
   * Register a custom converter
   */
  registerConverter(key: string, converter: ModalityConverter): void {
    this.converters.set(key, converter);
    logger.info(`Registered converter: ${key}`);
  }

  /**
   * Unregister a processor
   */
  unregisterProcessor(type: ModalityType): boolean {
    const removed = this.processors.delete(type);
    if (removed) {
      logger.info(`Unregistered processor for modality: ${type}`);
    }
    return removed;
  }

  /**
   * Unregister a converter
   */
  unregisterConverter(key: string): boolean {
    const removed = this.converters.delete(key);
    if (removed) {
      logger.info(`Unregistered converter: ${key}`);
    }
    return removed;
  }

  /**
   * Initialize modality processors
   */
  private initializeProcessors(): void {
    this.processors.set("text", new TextProcessor());
    this.processors.set("code", new CodeProcessor());
    this.processors.set("image", new ImageProcessor());
    this.processors.set("audio", new AudioProcessor());
    this.processors.set("video", new VideoProcessor());
    this.processors.set("document", new DocumentProcessor());
    this.processors.set("structured", new StructuredDataProcessor());
    this.processors.set("diagram", new DiagramProcessor());
    this.processors.set("screenshot", new ScreenshotProcessor());

    logger.info(`Initialized ${this.processors.size} modality processors`);
  }

  /**
   * Initialize modality converters
   */
  private initializeConverters(): void {
    this.converters.set("text-to-audio", new TextToAudioConverter());
    this.converters.set("image-to-text", new ImageToTextConverter());
    this.converters.set("audio-to-text", new AudioToTextConverter());
    this.converters.set("code-to-diagram", new CodeToDiagramConverter());
    this.converters.set(
      "document-to-structured",
      new DocumentToStructuredConverter(),
    );
    this.converters.set("video-to-image", new VideoToImageConverter());
    this.converters.set("screenshot-to-code", new ScreenshotToCodeConverter());

    logger.info(`Initialized ${this.converters.size} modality converters`);
  }

  /**
   * Process multimodal input with priority queue support
   */
  async processInput(
    input: MultimodalInput,
    abortController?: AbortController,
  ): Promise<ProcessedOutput> {
    if (this.isShuttingDown) {
      throw new Error("Service is shutting down");
    }

    if (this.enablePriorityQueue) {
      return this.enqueueForProcessing(input, abortController);
    } else {
      return this.processInputDirect(input, abortController);
    }
  }

  /**
   * Enqueue input for priority-based processing
   */
  private enqueueForProcessing(
    input: MultimodalInput,
    abortController?: AbortController,
  ): Promise<ProcessedOutput> {
    return new Promise((resolvePromise, reject) => {
      const task: QueuedTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        input,
        priority: input.priority,
        timestamp: new Date(),
        abortController,
        resolve: "",
        reject,
      };

      try {
        this.processingQueue.enqueue(task);
        this.processNextInQueue();
      } catch (_error) {
        // Handle queue overflow gracefully
        if (
          _error instanceof Error &&
          _error.message.includes("Queue is full")
        ) {
          this.emit("queueOverflow", {
            queueSize: this.processingQueue.size(),
            droppedTask: task,
          });

          // Try to remove lowest priority task and retry
          if (this.tryEvictLowPriorityTask()) {
            try {
              this.processingQueue.enqueue(task);
              this.processNextInQueue();
              return;
            } catch (retryError) {
              reject(retryError);
              return;
            }
          }
        }
        reject(_error);
      }
    });
  }

  /**
   * Process input directly (bypass queue)
   */
  private async processInputDirect(
    input: MultimodalInput,
    abortController?: AbortController,
  ): Promise<ProcessedOutput> {
    try {
      // Check if aborted before processing
      if (abortController?.signal.aborted) {
        throw new Error("Processing aborted");
      }

      logger.info(`Processing ${input.type} input: ${input.id}`);

      const processor = this.processors.get(input.type);
      if (!processor) {
        throw new Error(`No processor available for modality: ${input.type}`);
      }

      if (!processor.canHandle(input)) {
        throw new Error(`Processor cannot handle input: ${input.id}`);
      }

      // Check abort signal again before expensive operation
      if (abortController?.signal.aborted) {
        throw new Error("Processing aborted");
      }

      const output = await processor.process(input);

      // Final check before storing results
      if (abortController?.signal.aborted) {
        throw new Error("Processing aborted");
      }

      // Check memory limits before storing
      this.enforceMemoryLimits();

      this.processedOutputs.set(output.id, output);

      // Update semantic understanding
      try {
        await this.updateSemanticUnderstanding(input, output);
      } catch (_error) {
        logger.warn(
          `Failed to update semantic understanding for ${input.id}:`,
          _error,
        );
      }

      this.emit("inputProcessed", {
        inputId: input.id,
        outputId: output.id,
        modality: input.type,
      });

      logger.info(
        `Successfully processed ${input.type} input: ${input.id} -> ${output.id}`,
      );
      return output;
    } catch (_error) {
      this.totalErrors++;
      const errorMessage =
        _error instanceof Error ? _error.message : String(_error);

      this.emit("processingError", {
        inputId: input.id,
        _error: errorMessage,
        modality: input.type,
      });

      logger.error(`Failed to process input ${input.id}:`, _error);
      throw _error;
    }
  }

  /**
   * Process next task in queue if capacity available
   */
  private async processNextInQueue(): Promise<void> {
    if (
      this.currentlyProcessing.size >= this.maxConcurrentProcessing ||
      this.processingQueue.size() === 0
    ) {
      return;
    }

    const task = this.processingQueue.dequeue();
    if (!task) {
      return;
    }

    // Check if task was aborted while waiting
    if (task.abortController?.signal.aborted) {
      task.reject(new Error("Task was aborted while waiting in queue"));
      this.processNextInQueue(); // Try next task
      return;
    }

    this.currentlyProcessing.add(task.id);

    try {
      const output = await this.processInputDirect(
        task.input,
        task.abortController,
      );
      task.resolve(output);
    } catch (_error) {
      task.reject(_error as Error);
    } finally {
      this.currentlyProcessing.delete(task.id);
      // Process next task if available
      setImmediate(() => this.processNextInQueue());
    }
  }

  /**
   * Start background processing workers
   */
  private startProcessingWorkers(): void {
    // Start multiple workers to process queue concurrently
    for (let i = 0; i < this.maxConcurrentProcessing; i++) {
      setImmediate(() => this.processNextInQueue());
    }
  }

  /**
   * Process multiple inputs with cross-modal analysis
   */
  async processMultimodalInputs(
    inputs: MultimodalInput[],
  ): Promise<CrossModalAnalysis> {
    try {
      logger.info(
        `Processing ${inputs.length} multimodal inputs for cross-modal analysis`,
      );

      // Process each input individually
      const processedOutputs = await Promise.all(
        inputs.map((input) => this.processInput(input)),
      );

      // Perform cross-modal analysis
      const crossModalAnalysis = await this.performCrossModalAnalysis(
        inputs,
        processedOutputs,
      );

      // Store the analysis
      this.crossModalAnalyses.set(crossModalAnalysis.id, crossModalAnalysis);

      this.emit("crossModalAnalysisCompleted", {
        analysisId: crossModalAnalysis.id,
        modalityCount: inputs.length,
        confidence: crossModalAnalysis.confidence,
      });

      logger.info(`Cross-modal analysis completed: ${crossModalAnalysis.id}`);
      return crossModalAnalysis;
    } catch (_error) {
      logger.error("Failed to process multimodal inputs:", _error);
      throw _error;
    }
  }

  /**
   * Perform cross-modal analysis
   */
  private async performCrossModalAnalysis(
    inputs: MultimodalInput[],
    outputs: ProcessedOutput[],
  ): Promise<CrossModalAnalysis> {
    const analysisId = this.generateAnalysisId();

    // Analyze correlations between different modalities
    const correlations = await this.analyzeModalityCorrelations(
      inputs,
      outputs,
    );

    // Generate insights from cross-modal patterns
    const insights = await this.generateCrossModalInsights(
      inputs,
      outputs,
      correlations,
    );

    // Synthesize unified understanding
    const synthesizedOutput = await this.synthesizeUnifiedOutput(
      inputs,
      outputs,
      insights,
    );

    // Calculate overall confidence
    const confidence = this.calculateCrossModalConfidence(
      outputs,
      correlations,
    );

    return {
      id: analysisId,
      inputs: inputs.map((i) => i.id),
      modalities: [...new Set(inputs.map((i) => i.type))],
      analysis: insights,
      correlations,
      synthesizedOutput,
      confidence,
      timestamp: new Date(),
    };
  }

  /**
   * Analyze _correlations between different modalities
   */
  private async analyzeModalityCorrelations(
    inputs: MultimodalInput[],
    outputs: ProcessedOutput[],
  ): Promise<ModalityCorrelation[]> {
    const correlations: ModalityCorrelation[] = [];

    // Compare each pair of modalities
    for (let i = 0; i < inputs.length; i++) {
      for (let j = i + 1; j < inputs.length; j++) {
        const input1 = inputs[i];
        const input2 = inputs[j];
        const output1 = outputs[i];
        const output2 = outputs[j];

        const correlation = await this.analyzeModalityPairCorrelation(
          input1,
          input2,
          output1,
          output2,
        );

        if (correlation.strength > 0.3) {
          correlations.push(correlation);
        }
      }
    }

    return correlations.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Analyze _correlation between a pair of modalities
   */
  private async analyzeModalityPairCorrelation(
    input1: MultimodalInput,
    input2: MultimodalInput,
    output1: ProcessedOutput,
    output2: ProcessedOutput,
  ): Promise<ModalityCorrelation> {
    // Determine correlation type and strength
    const correlationType = this.determineCorrelationType(input1, input2);
    const strength = await this.calculateCorrelationStrength(
      output1,
      output2,
      correlationType,
    );

    // Find correlation examples
    const examples = await this.findCorrelationExamples(
      input1,
      input2,
      output1,
      output2,
    );

    return {
      modality1: input1.type,
      modality2: input2.type,
      correlationType,
      strength,
      examples,
    };
  }

  /**
   * Determine the type of _correlation between two modalities
   */
  private determineCorrelationType(
    input1: MultimodalInput,
    input2: MultimodalInput,
  ): "semantic" | "temporal" | "spatial" | "contextual" {
    // Check temporal alignment
    const timeDiff = Math.abs(
      input1.timestamp.getTime() - input2.timestamp.getTime(),
    );
    if (timeDiff < 60000) {
      // Within 1 minute
      return "temporal";
    }

    // Check spatial relationships (for image/video/screenshot)
    const spatialModalities = ["image", "video", "screenshot", "diagram"];
    if (
      spatialModalities.includes(input1.type) &&
      spatialModalities.includes(input2.type)
    ) {
      return "spatial";
    }

    // Check contextual relationships
    const contextOverlap = input1.context.filter((c) =>
      input2.context.includes(c),
    ).length;
    if (contextOverlap > 0) {
      return "contextual";
    }

    // Default to semantic
    return "semantic";
  }

  /**
   * Calculate _correlation _strength between two outputs
   */
  private async calculateCorrelationStrength(
    output1: ProcessedOutput,
    output2: ProcessedOutput,
    correlationType: string,
  ): Promise<number> {
    // Simple correlation calculation based on confidence and output similarity
    const confidenceWeight = (output1.confidence + output2.confidence) / 2;
    const typeBonus = correlationType === "semantic" ? 0.2 : 0.1;

    // In a real implementation, this would involve deep semantic analysis
    return Math.min(confidenceWeight + typeBonus, 1.0);
  }

  /**
   * Find _examples of _correlation between inputs
   */
  private async findCorrelationExamples(
    input1: MultimodalInput,
    input2: MultimodalInput,
    output1: ProcessedOutput,
    output2: ProcessedOutput,
  ): Promise<CorrelationExample[]> {
    // Simple example generation
    return [
      {
        input1Id: input1.id,
        input2Id: input2.id,
        alignmentScore: (output1.confidence + output2.confidence) / 2,
        description: `${input1.type} and ${input2.type} show aligned understanding`,
      },
    ];
  }

  /**
   * Generate cross-modal _insights
   */
  private async generateCrossModalInsights(
    inputs: MultimodalInput[],
    outputs: ProcessedOutput[],
    correlations: ModalityCorrelation[],
  ): Promise<CrossModalInsight[]> {
    const insights: CrossModalInsight[] = [];

    // Identify complementary information
    const complementaryInsight = await this.identifyComplementaryInformation(
      inputs,
      outputs,
    );
    if (complementaryInsight) {
      insights.push(complementaryInsight);
    }

    // Identify contradictions
    const contradictionInsight = await this.identifyContradictions(
      outputs,
      correlations,
    );
    if (contradictionInsight) {
      insights.push(contradictionInsight);
    }

    // Identify information alignment
    const alignmentInsight =
      await this.identifyInformationAlignment(correlations);
    if (alignmentInsight) {
      insights.push(alignmentInsight);
    }

    // Identify enhancement opportunities
    const enhancementInsight = await this.identifyEnhancementOpportunities(
      inputs,
      outputs,
    );
    if (enhancementInsight) {
      insights.push(enhancementInsight);
    }

    return insights.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Identify complementary information across modalities
   */
  private async identifyComplementaryInformation(
    inputs: MultimodalInput[],
    outputs: ProcessedOutput[],
  ): Promise<CrossModalInsight | null> {
    if (inputs.length < 2) {
      return null;
    }

    const modalityTypes = [...new Set(inputs.map((i) => i.type))];
    if (modalityTypes.length < 2) {
      return null;
    }

    return {
      type: "complementary",
      description: `Multiple modalities (${modalityTypes.join(", ")}) provide complementary perspectives`,
      evidence: inputs.map((input, index) => ({
        modalityType: input.type,
        inputId: input.id,
        relevantSection: outputs[index].data,
        supportStrength: outputs[index].confidence,
      })),
      confidence: 0.8,
      impact: 0.9,
    };
  }

  /**
   * Identify contradictions between modalities
   */
  private async identifyContradictions(
    _outputs: ProcessedOutput[],
    correlations: ModalityCorrelation[],
  ): Promise<CrossModalInsight | null> {
    // Look for low correlation strengths that might indicate contradictions
    const lowCorrelations = correlations.filter((c) => c.strength < 0.3);

    if (lowCorrelations.length === 0) {
      return null;
    }

    return {
      type: "contradiction",
      description: "Some modalities show conflicting information",
      evidence: lowCorrelations.map((c) => ({
        modalityType: c.modality1,
        inputId: c.examples[0]?.input1Id || "",
        relevantSection: "Conflicting interpretation detected",
        supportStrength: 1 - c.strength,
      })),
      confidence: 0.7,
      impact: 0.8,
    };
  }

  /**
   * Identify information alignment
   */
  private async identifyInformationAlignment(
    correlations: ModalityCorrelation[],
  ): Promise<CrossModalInsight | null> {
    const strongCorrelations = correlations.filter((c) => c.strength > 0.7);

    if (strongCorrelations.length === 0) {
      return null;
    }

    return {
      type: "alignment",
      description: "Multiple modalities show strong alignment in understanding",
      evidence: strongCorrelations.map((c) => ({
        modalityType: c.modality1,
        inputId: c.examples[0]?.input1Id || "",
        relevantSection: "Strong semantic alignment detected",
        supportStrength: c.strength,
      })),
      confidence: 0.9,
      impact: 0.7,
    };
  }

  /**
   * Identify enhancement opportunities
   */
  private async identifyEnhancementOpportunities(
    inputs: MultimodalInput[],
    outputs: ProcessedOutput[],
  ): Promise<CrossModalInsight | null> {
    // Look for modalities that could enhance others
    const lowConfidenceOutputs = outputs.filter((o) => o.confidence < 0.6);
    const highConfidenceOutputs = outputs.filter((o) => o.confidence > 0.8);

    if (
      lowConfidenceOutputs.length === 0 ||
      highConfidenceOutputs.length === 0
    ) {
      return null;
    }

    return {
      type: "enhancement",
      description:
        "High-confidence modalities could enhance understanding of uncertain areas",
      evidence: [
        ...highConfidenceOutputs.map((o) => ({
          modalityType:
            inputs.find((i) => i.id === o.inputId)?.type ||
            ("unknown" as ModalityType),
          inputId: o.inputId,
          relevantSection: "High confidence source",
          supportStrength: o.confidence,
        })),
      ],
      confidence: 0.8,
      impact: 0.8,
    };
  }

  /**
   * Synthesize unified _output from multiple modalities
   */
  private async synthesizeUnifiedOutput(
    inputs: MultimodalInput[],
    outputs: ProcessedOutput[],
    insights: CrossModalInsight[],
  ): Promise<SynthesizedOutput> {
    const highConfidenceOutputs = outputs.filter((o) => o.confidence > 0.7);
    const modalityTypes = [...new Set(inputs.map((i) => i.type))];

    // Generate recommendations based on insights
    const recommendations: string[] = [];

    insights.forEach((insight) => {
      switch (insight.type) {
        case "complementary":
          recommendations.push(
            "Leverage complementary information from all modalities for comprehensive understanding",
          );
          break;
        case "contradiction":
          recommendations.push(
            "Resolve contradictions by examining source reliability and context",
          );
          break;
        case "alignment":
          recommendations.push(
            "High confidence due to strong cross-modal alignment",
          );
          break;
        case "enhancement":
          recommendations.push(
            "Use high-confidence modalities to validate and enhance uncertain areas",
          );
          break;
      }
    });

    return {
      type: "comprehensive_analysis",
      content: {
        summary: `Analyzed ${modalityTypes.length} different modalities with ${insights.length} key insights`,
        modalities: modalityTypes,
        keyFindings: insights.map((i) => i.description),
        confidenceDistribution: outputs.map((o) => ({
          inputId: o.inputId,
          confidence: o.confidence,
        })),
      },
      sources: inputs.map((i) => i.id),
      confidence:
        highConfidenceOutputs.reduce((sum, o) => sum + o.confidence, 0) /
        highConfidenceOutputs.length,
      recommendations,
    };
  }

  /**
   * Calculate overall cross-modal _confidence
   */
  private calculateCrossModalConfidence(
    outputs: ProcessedOutput[],
    correlations: ModalityCorrelation[],
  ): number {
    // Apply modality-specific weights to output confidence
    const weightedOutputs = outputs.map((output) => {
      // Find corresponding input to get modality type
      const modalityType = this.getModalityTypeForOutput(output);
      const weight = this.confidenceConfig.modalityWeights[modalityType] || 1.0;
      return output.confidence * weight;
    });

    const avgOutputConfidence =
      weightedOutputs.reduce((sum, confidence) => sum + confidence, 0) /
      weightedOutputs.length;
    const avgCorrelationStrength =
      correlations.length > 0
        ? correlations.reduce((sum, c) => sum + c.strength, 0) /
          correlations.length
        : 0;

    // Use configurable weights
    return (
      avgOutputConfidence * this.confidenceConfig.outputWeight +
      avgCorrelationStrength * this.confidenceConfig.correlationWeight
    );
  }

  /**
   * Helper to get modality type for processed output
   */
  private getModalityTypeForOutput(_output: ProcessedOutput): ModalityType {
    // This is a simplified lookup - in a real implementation,
    // we'd maintain a mapping of output IDs to input modalities
    return "text"; // Default fallback
  }

  /**
   * Convert between modalities
   */
  async convertModality(
    input: MultimodalInput,
    targetModality: ModalityType,
  ): Promise<MultimodalInput> {
    try {
      const conversionKey = `${input.type}-to-${targetModality}`;
      const converter = this.converters.get(conversionKey);

      if (!converter) {
        throw new Error(
          `No converter available for ${input.type} to ${targetModality}`,
        );
      }

      logger.info(`Converting ${input.type} to ${targetModality}: ${input.id}`);

      const convertedInput = await converter.convert(input, targetModality);

      this.emit("modalityConverted", {
        originalId: input.id,
        convertedId: convertedInput.id,
        fromType: input.type,
        toType: targetModality,
      });

      return convertedInput;
    } catch (_error) {
      logger.error(
        `Failed to convert modality from ${input.type} to ${targetModality}:`,
        _error,
      );
      throw _error;
    }
  }

  /**
   * Get adaptive interface recommendations
   */
  async getAdaptiveInterface(
    userId: string,
    context: InterfaceContext,
  ): Promise<{
    _recommendedModalities: ModalityType[];
    adaptiveInterface: AdaptiveInterface;
    _adaptations: string[];
  }> {
    let adaptiveInterface = this.adaptiveInterfaces.get(userId);

    if (!adaptiveInterface) {
      adaptiveInterface = this.createAdaptiveInterface(userId);
      this.adaptiveInterfaces.set(userId, adaptiveInterface);
    }

    // Update current context
    adaptiveInterface.currentContext = context;

    // Get modality recommendations based on user preferences and current context
    const recommendedModalities = await this.getModalityRecommendations(
      adaptiveInterface,
      context,
    );

    // Generate interface adaptations
    const adaptations = await this.generateInterfaceAdaptations(
      adaptiveInterface,
      context,
    );

    return {
      recommendedModalities,
      adaptiveInterface,
      adaptations,
    };
  }

  /**
   * Create new adaptive interface for user
   */
  private createAdaptiveInterface(userId: string): AdaptiveInterface {
    return {
      userId,
      preferredModalities: [
        {
          modality: "text",
          preference: 0.8,
          contextDependency: {} as Record<string, unknown>,
          reasoningType: "implicit",
        },
        {
          modality: "code",
          preference: 0.6,
          contextDependency: {} as Record<string, unknown>,
          reasoningType: "implicit",
        },
        {
          modality: "image",
          preference: 0.4,
          contextDependency: {} as Record<string, unknown>,
          reasoningType: "implicit",
        },
      ],
      adaptationHistory: [],
      currentContext: {
        currentTask: "",
        environment: "desktop",
        urgency: 0.5,
        complexity: 0.5,
        availableModalities: ["text", "code", "image"],
      },
      performanceMetrics: {
        taskCompletionRate: 0.8,
        userSatisfaction: 0.7,
        cognitiveLoad: 0.5,
        errorRate: 0.1,
        preferenceStability: 0.6,
      },
    };
  }

  /**
   * Get modality recommendations based on preferences and context
   */
  private async getModalityRecommendations(
    adaptiveInterface: AdaptiveInterface,
    context: InterfaceContext,
  ): Promise<ModalityType[]> {
    // Score modalities based on preferences and context suitability
    const scores: Array<{ modality: ModalityType; score: number }> = [];

    for (const pref of adaptiveInterface.preferredModalities) {
      if (context.availableModalities.includes(pref.modality)) {
        let score = pref.preference;

        // Adjust for context
        const contextDependency =
          pref.contextDependency[context.currentTask] || 0;
        score += contextDependency * 0.3;

        // Adjust for environment
        if (
          context.environment === "mobile" &&
          ["image", "audio"].includes(pref.modality)
        ) {
          score += 0.2;
        }

        // Adjust for urgency
        if (context.urgency > 0.7 && pref.modality === "text") {
          score += 0.1; // Text is usually fastest
        }

        scores.push({ modality: pref.modality, score });
      }
    }

    // Sort by score and return top recommendations
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.modality);
  }

  /**
   * Generate interface _adaptations
   */
  private async generateInterfaceAdaptations(
    adaptiveInterface: AdaptiveInterface,
    context: InterfaceContext,
  ): Promise<string[]> {
    const adaptations: string[] = [];

    // Adapt based on cognitive load
    if (adaptiveInterface.performanceMetrics.cognitiveLoad > 0.7) {
      adaptations.push("Reduce visual complexity");
      adaptations.push("Prioritize essential information");
    }

    // Adapt based on _error rate
    if (adaptiveInterface.performanceMetrics.errorRate > 0.2) {
      adaptations.push("Add confirmation steps");
      adaptations.push("Provide clearer feedback");
    }

    // Adapt based on urgency
    if (context.urgency > 0.8) {
      adaptations.push("Streamline interaction flow");
      adaptations.push("Highlight critical actions");
    }

    // Adapt based on complexity
    if (context.complexity > 0.7) {
      adaptations.push("Provide progressive disclosure");
      adaptations.push("Add contextual help");
    }

    return adaptations;
  }

  /**
   * Update semantic understanding from processed input/_output
   */
  private async updateSemanticUnderstanding(
    input: MultimodalInput,
    output: ProcessedOutput,
  ): Promise<void> {
    // Extract concepts from the processed output
    const concepts = await this.extractConcepts(input, output);

    for (const concept of concepts) {
      const existingUnderstanding = this.semanticUnderstanding.get(
        concept.concept,
      );

      if (existingUnderstanding) {
        // Update existing understanding
        this.mergeSemanticUnderstanding(existingUnderstanding, concept);
      } else {
        // Store new understanding
        this.semanticUnderstanding.set(concept.concept, concept);
      }
    }
  }

  /**
   * Extract _concepts from processed input/_output
   */
  private async extractConcepts(
    input: MultimodalInput,
    output: ProcessedOutput,
  ): Promise<SemanticUnderstanding[]> {
    // Simple concept extraction - would be enhanced with NLP/ML in real implementation
    const concepts: SemanticUnderstanding[] = [];

    // Extract based on modality type
    switch (input.type) {
      case "text":
        concepts.push(...this.extractTextConcepts(input, output));
        break;
      case "code":
        concepts.push(...this.extractCodeConcepts(input, output));
        break;
      case "image":
        concepts.push(...this.extractImageConcepts(input, output));
        break;
      // Add more modality-specific concept extraction
    }

    return concepts;
  }

  /**
   * Extract _concepts from text input
   */
  private extractTextConcepts(
    input: MultimodalInput,
    output: ProcessedOutput,
  ): SemanticUnderstanding[] {
    // Placeholder implementation
    return [
      {
        concept: "text-processing",
        modality: "text",
        confidence: output.confidence,
        context: [
          {
            type: "temporal",
            description: "Recent text analysis",
            strength: 0.8,
          },
        ],
        relationships: [],
        abstractRepresentation: { type: "text", content: input.data },
      },
    ];
  }

  /**
   * Extract _concepts from code input
   */
  private extractCodeConcepts(
    input: MultimodalInput,
    output: ProcessedOutput,
  ): SemanticUnderstanding[] {
    // Placeholder implementation
    return [
      {
        concept: "code-analysis",
        modality: "code",
        confidence: output.confidence,
        context: [
          {
            type: "hierarchical",
            description: "Code structure analysis",
            strength: 0.9,
          },
        ],
        relationships: [],
        abstractRepresentation: {
          type: "code",
          language: input.metadata.language,
          content: input.data,
        },
      },
    ];
  }

  /**
   * Extract _concepts from image input
   */
  private extractImageConcepts(
    input: MultimodalInput,
    output: ProcessedOutput,
  ): SemanticUnderstanding[] {
    // Placeholder implementation
    return [
      {
        concept: "visual-analysis",
        modality: "image",
        confidence: output.confidence,
        context: [
          {
            type: "spatial",
            description: "Visual content analysis",
            strength: 0.7,
          },
        ],
        relationships: [],
        abstractRepresentation: {
          type: "image",
          dimensions: input.metadata.dimensions,
        },
      },
    ];
  }

  /**
   * Merge semantic understanding
   */
  private mergeSemanticUnderstanding(
    existing: SemanticUnderstanding,
    newUnderstanding: SemanticUnderstanding,
  ): void {
    // Update confidence as weighted average
    const totalWeight = existing.confidence + newUnderstanding.confidence;
    existing.confidence =
      (existing.confidence * existing.confidence +
        newUnderstanding.confidence * newUnderstanding.confidence) /
      totalWeight;

    // Merge contexts
    newUnderstanding.context.forEach((newContext) => {
      const existingContext = existing.context.find(
        (c) => c.type === newContext.type,
      );
      if (existingContext) {
        existingContext.strength =
          (existingContext.strength + newContext.strength) / 2;
      } else {
        existing.context.push(newContext);
      }
    });

    // Merge relationships
    newUnderstanding.relationships.forEach((newRel) => {
      const existingRel = existing.relationships.find(
        (r) => r.targetConcept === newRel.targetConcept,
      );
      if (existingRel) {
        existingRel.strength = (existingRel.strength + newRel.strength) / 2;
      } else {
        existing.relationships.push(newRel);
      }
    });
  }

  /**
   * Get system analytics
   */
  getSystemAnalytics(): {
    processedInputsByModality: Record<ModalityType, number>;
    averageProcessingTime: number;
    crossModalAnalysesCount: number;
    semanticConceptsCount: number;
    adaptiveInterfacesCount: number;
    systemCapabilities: ProcessingCapability[];
  } {
    const processedInputsByModality = {} as Record<ModalityType, number>;
    let totalProcessingTime = 0;
    let totalProcessed = 0;

    Array.from(this.processedOutputs.values()).forEach((output) => {
      const _inputModality = Array.from(this.processedOutputs.keys()).find(
        (key) => this.processedOutputs.get(key)?.inputId === output.inputId,
      );
      // This is simplified - in real implementation, we'd track input modalities properly
      totalProcessingTime += output.processingTime;
      totalProcessed++;
    });

    const systemCapabilities: ProcessingCapability[] = [];
    this.processors.forEach((processor) => {
      systemCapabilities.push(...processor.getCapabilities());
    });

    return {
      processedInputsByModality,
      averageProcessingTime:
        totalProcessed > 0 ? totalProcessingTime / totalProcessed : 0,
      crossModalAnalysesCount: this.crossModalAnalyses.size,
      semanticConceptsCount: this.semanticUnderstanding.size,
      adaptiveInterfacesCount: this.adaptiveInterfaces.size,
      systemCapabilities,
    };
  }

  /**
   * Generate analysis ID
   */
  private generateAnalysisId(): string {
    return `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Start intelligence engine background processes
   */
  private startIntelligenceEngine(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    // Periodic maintenance every 30 minutes
    this.timer = setInterval(
      () => {
        this.performMaintenance();
      },
      30 * 60 * 1000,
    );

    // Use unref() to allow process to exit gracefully
    this.timer.unref?.();

    logger.info("Multimodal intelligence engine started");
  }

  /**
   * Stop the intelligence engine and clean up resources
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true;

    logger.info("Stopping multimodal intelligence engine...");

    // Clear the maintenance timer
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    // Clear processing queue
    this.processingQueue.clear();

    // Wait for currently processing tasks to complete (with timeout)
    const timeoutMs = 10000; // 10 seconds timeout
    const startTime = Date.now();

    while (
      this.currentlyProcessing.size > 0 &&
      Date.now() - startTime < timeoutMs
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.currentlyProcessing.size > 0) {
      logger.warn(
        `Force stopping with ${this.currentlyProcessing.size} tasks still processing`,
      );
    }

    // Persist final data
    try {
      await this.persistData();
    } catch (_error) {
      logger.error("Failed to persist data during shutdown:", _error);
    }

    logger.info("Multimodal intelligence engine stopped");
  }

  /**
   * Enforce memory limits to prevent excessive memory usage
   */
  private enforceMemoryLimits(): void {
    // Check and enforce processed outputs limit
    if (
      this.processedOutputs.size > this.memoryThresholds.processedOutputsMax
    ) {
      const excess =
        this.processedOutputs.size - this.memoryThresholds.processedOutputsMax;
      const oldestOutputs = Array.from(this.processedOutputs.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())
        .slice(0, excess);

      oldestOutputs.forEach(([id]) => this.processedOutputs.delete(id));

      this.emit("memoryWarning", {
        usage: this.processedOutputs.size,
        threshold: this.memoryThresholds.processedOutputsMax,
        component: "processedOutputs",
      });
    }

    // Check semantic understanding limit
    if (
      this.semanticUnderstanding.size >
      this.memoryThresholds.semanticConceptsMax
    ) {
      const excess =
        this.semanticUnderstanding.size -
        this.memoryThresholds.semanticConceptsMax;
      const lowConfidenceConcepts = Array.from(
        this.semanticUnderstanding.entries(),
      )
        .sort(([, a], [, b]) => a.confidence - b.confidence)
        .slice(0, excess);

      lowConfidenceConcepts.forEach(([concept]) =>
        this.semanticUnderstanding.delete(concept),
      );

      this.emit("memoryWarning", {
        usage: this.semanticUnderstanding.size,
        threshold: this.memoryThresholds.semanticConceptsMax,
        component: "semanticUnderstanding",
      });
    }

    // Check cross-modal analyses limit
    if (
      this.crossModalAnalyses.size > this.memoryThresholds.crossModalAnalysesMax
    ) {
      const excess =
        this.crossModalAnalyses.size -
        this.memoryThresholds.crossModalAnalysesMax;
      const oldestAnalyses = Array.from(this.crossModalAnalyses.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())
        .slice(0, excess);

      oldestAnalyses.forEach(([id]) => this.crossModalAnalyses.delete(id));

      this.emit("memoryWarning", {
        usage: this.crossModalAnalyses.size,
        threshold: this.memoryThresholds.crossModalAnalysesMax,
        component: "crossModalAnalyses",
      });
    }
  }

  /**
   * Try to evict lowest priority task from queue
   */
  private tryEvictLowPriorityTask(): boolean {
    // This is a simplified implementation - PriorityQueue would need
    // a method to remove lowest priority task in a real implementation
    return false;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    processedOutputs: { current: number; max: number; utilization: number };
    semanticConcepts: { current: number; max: number; utilization: number };
    crossModalAnalyses: { current: number; max: number; utilization: number };
    adaptiveInterfaces: { current: number; max: number; utilization: number };
  } {
    return {
      processedOutputs: {
        current: this.processedOutputs.size,
        max: this.memoryThresholds.processedOutputsMax,
        utilization:
          this.processedOutputs.size /
          this.memoryThresholds.processedOutputsMax,
      },
      semanticConcepts: {
        current: this.semanticUnderstanding.size,
        max: this.memoryThresholds.semanticConceptsMax,
        utilization:
          this.semanticUnderstanding.size /
          this.memoryThresholds.semanticConceptsMax,
      },
      crossModalAnalyses: {
        current: this.crossModalAnalyses.size,
        max: this.memoryThresholds.crossModalAnalysesMax,
        utilization:
          this.crossModalAnalyses.size /
          this.memoryThresholds.crossModalAnalysesMax,
      },
      adaptiveInterfaces: {
        current: this.adaptiveInterfaces.size,
        max: this.memoryThresholds.adaptiveInterfacesMax,
        utilization:
          this.adaptiveInterfaces.size /
          this.memoryThresholds.adaptiveInterfacesMax,
      },
    };
  }

  /**
   * Update memory thresholds
   */
  updateMemoryThresholds(
    thresholds: Partial<typeof this.memoryThresholds>,
  ): void {
    Object.assign(this.memoryThresholds, thresholds);
    logger.info("Updated memory thresholds:", this.memoryThresholds);
  }

  /**
   * Get current processing statistics
   */
  getProcessingStats(): ProcessingStats {
    const totalTime = Array.from(this.processedOutputs.values()).reduce(
      (sum, output) => sum + output.processingTime,
      0,
    );
    const avgTime =
      this.processedOutputs.size > 0
        ? totalTime / this.processedOutputs.size
        : 0;
    const uptime = Date.now() - this.startupTime;
    const errorRate = uptime > 0 ? (this.totalErrors * 1000) / uptime : 0; // errors per second * 1000

    const stats: ProcessingStats = {
      queueSize: this.processingQueue.size(),
      currentlyProcessing: this.currentlyProcessing.size,
      maxConcurrentProcessing: this.maxConcurrentProcessing,
      totalProcessed: this.processedOutputs.size,
      averageProcessingTime: avgTime,
      errorRate,
    };

    this.emit("processingStatsUpdated", { stats });
    return stats;
  }

  /**
   * Perform maintenance tasks
   */
  private async performMaintenance(): Promise<void> {
    const startTime = Date.now();
    let cleanedOutputs = 0;
    let optimizedConcepts = 0;

    try {
      // Clean up old processed outputs
      cleanedOutputs = this.cleanupOldOutputs();

      // Optimize semantic understanding
      optimizedConcepts = await this.optimizeSemanticUnderstanding();

      // Update adaptive interfaces
      await this.updateAdaptiveInterfaces();

      // Enforce memory limits
      this.enforceMemoryLimits();

      // Persist data
      await this.persistData();

      const duration = Date.now() - startTime;
      this.emit("maintenanceCompleted", {
        duration,
        cleanedOutputs,
        optimizedConcepts,
      });
    } catch (_error) {
      logger.error("Error in multimodal intelligence maintenance:", _error);
      throw _error;
    }
  }

  /**
   * Clean up old processed outputs
   */
  private cleanupOldOutputs(): number {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    let cleanedCount = 0;

    for (const [id, output] of this.processedOutputs) {
      if (output.timestamp.getTime() < cutoffTime) {
        this.processedOutputs.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} old processed outputs`);
    }

    return cleanedCount;
  }

  /**
   * Optimize semantic understanding
   */
  private async optimizeSemanticUnderstanding(): Promise<number> {
    let optimizedCount = 0;

    // Remove low-confidence concepts
    for (const [concept, understanding] of this.semanticUnderstanding) {
      if (understanding.confidence < 0.3) {
        this.semanticUnderstanding.delete(concept);
        optimizedCount++;
      }
    }

    // Strengthen relationships based on co-occurrence
    // This would be more sophisticated in a real implementation
    for (const [, understanding] of this.semanticUnderstanding) {
      understanding.relationships = understanding.relationships.filter(
        (rel) => rel.strength > 0.2,
      );
    }

    return optimizedCount;
  }

  /**
   * Update adaptive interfaces
   */
  private async updateAdaptiveInterfaces(): Promise<void> {
    for (const [_userId, adaptiveInterface] of this.adaptiveInterfaces) {
      // Update performance metrics based on recent interactions
      // This would involve actual usage tracking in a real implementation
      adaptiveInterface.performanceMetrics.preferenceStability = Math.min(
        adaptiveInterface.performanceMetrics.preferenceStability + 0.1,
        1.0,
      );
    }
  }

  /**
   * Persist data to storage
   */
  private async persistData(): Promise<void> {
    try {
      // Persist processed outputs
      const outputsData = Object.fromEntries(this.processedOutputs);
      await writeFile(
        join(this.dataDir, "processed-outputs.json"),
        JSON.stringify(outputsData, null, 2),
      );

      // Persist semantic understanding
      const semanticData = Object.fromEntries(this.semanticUnderstanding);
      await writeFile(
        join(this.dataDir, "semantic-understanding.json"),
        JSON.stringify(semanticData, null, 2),
      );

      // Persist adaptive interfaces
      const interfacesData = Object.fromEntries(this.adaptiveInterfaces);
      await writeFile(
        join(this.dataDir, "adaptive-interfaces.json"),
        JSON.stringify(interfacesData, null, 2),
      );

      // Persist cross-modal analyses
      const analysesData = Object.fromEntries(this.crossModalAnalyses);
      await writeFile(
        join(this.dataDir, "cross-modal-analyses.json"),
        JSON.stringify(analysesData, null, 2),
      );
    } catch (_error) {
      logger.error("Failed to persist multimodal intelligence data:", _error);
    }
  }

  /**
   * Load persisted data with proper type restoration
   */
  private async loadPersistedData(): Promise<void> {
    try {
      // Generic reviver utility for nested objects
      const revive = <T>(
        raw: any,
        revivers: Record<string, (v: any) => any> = {},
      ): T => {
        if (Array.isArray(raw)) {
          return raw.map((v) => revive(v, revivers)) as T;
        }
        if (raw && typeof raw === "object") {
          const out: any = {};
          for (const [k, v] of Object.entries(raw)) {
            out[k] = revivers[k] ? revivers[k](v) : revive(v, revivers);
          }
          return out as T;
        }
        return raw as T;
      };

      // Load processed outputs with Date restoration
      const outputsFile = join(this.dataDir, "processed-outputs.json");
      if (existsSync(outputsFile)) {
        const outputsData = JSON.parse(await readFile(outputsFile, "utf-8"));
        const revivedOutputs = Object.fromEntries(
          Object.entries(outputsData).map(([id, output]: [string, any]) => [
            id,
            revive<ProcessedOutput>(output, {
              timestamp: (v: string) => new Date(v),
            }),
          ]),
        );
        this.processedOutputs = new Map(Object.entries(revivedOutputs));
        logger.debug(
          `Restored ${this.processedOutputs.size} processed outputs`,
        );
      }

      // Load semantic understanding with Date restoration
      const semanticFile = join(this.dataDir, "semantic-understanding.json");
      if (existsSync(semanticFile)) {
        const semanticData = JSON.parse(await readFile(semanticFile, "utf-8"));
        const revivedSemantic = Object.fromEntries(
          Object.entries(semanticData).map(
            ([concept, understanding]: [string, any]) => [
              concept,
              revive<SemanticUnderstanding>(understanding, {}),
            ],
          ),
        );
        this.semanticUnderstanding = new Map(Object.entries(revivedSemantic));
        logger.debug(
          `Restored ${this.semanticUnderstanding.size} semantic concepts`,
        );
      }

      // Load adaptive interfaces with Date restoration
      const interfacesFile = join(this.dataDir, "adaptive-interfaces.json");
      if (existsSync(interfacesFile)) {
        const interfacesData = JSON.parse(
          await readFile(interfacesFile, "utf-8"),
        );
        const revivedInterfaces = Object.fromEntries(
          Object.entries(interfacesData).map(
            ([userId, adaptiveInterface]: [string, any]) => [
              userId,
              revive<AdaptiveInterface>(adaptiveInterface, {
                adaptationHistory: (history: any[]) =>
                  history.map((h) => ({
                    ...h,
                    timestamp: new Date(h.timestamp),
                  })),
              }),
            ],
          ),
        );
        this.adaptiveInterfaces = new Map(Object.entries(revivedInterfaces));
        logger.debug(
          `Restored ${this.adaptiveInterfaces.size} adaptive interfaces`,
        );
      }

      // Load cross-modal analyses with Date restoration
      const analysesFile = join(this.dataDir, "cross-modal-analyses.json");
      if (existsSync(analysesFile)) {
        const analysesData = JSON.parse(await readFile(analysesFile, "utf-8"));
        const revivedAnalyses = Object.fromEntries(
          Object.entries(analysesData).map(([id, analysis]: [string, any]) => [
            id,
            revive<CrossModalAnalysis>(analysis, {
              timestamp: (v: string) => new Date(v),
            }),
          ]),
        );
        this.crossModalAnalyses = new Map(Object.entries(revivedAnalyses));
        logger.debug(
          `Restored ${this.crossModalAnalyses.size} cross-modal analyses`,
        );
      }
    } catch (_error) {
      logger.error(
        "Failed to load persisted multimodal intelligence data:",
        _error,
      );
    }
  }
}

// Placeholder _processor implementations
class TextProcessor implements ModalityProcessor {
  type: ModalityType = "text";

  async process(input: MultimodalInput): Promise<ProcessedOutput> {
    const textData = input.data as string;
    return {
      id: `output-${Date.now()}`,
      inputId: input.id,
      type: "analysis",
      data: { analyzedText: textData, wordCount: textData.length },
      confidence: 0.9,
      processingTime: 100,
      metadata: {
        processor: "TextProcessor",
        version: "1.0.0",
        parameters: {} as Record<string, unknown>,
        alternativeResults: [],
        qualityScore: 0.85,
      },
      timestamp: new Date(),
    };
  }

  canHandle(input: MultimodalInput): boolean {
    return input.type === "text" && typeof input.data === "string";
  }

  getCapabilities(): ProcessingCapability[] {
    return [
      {
        name: "text-analysis",
        description: "Analyze text content for meaning and structure",
        inputTypes: ["text/plain"],
        outputTypes: ["application/json"],
        confidence: 0.9,
        computationCost: 1,
      },
    ];
  }

  getConfiguration(): ProcessorConfiguration {
    return {
      model: "text-analyzer-v1",
      version: "1.0.0",
      parameters: { maxLength: 10000 },
      requirements: [
        { type: "memory", minimum: 100, recommended: 200, unit: "MB" },
      ],
    };
  }
}

// Additional placeholder _processor classes
class CodeProcessor implements ModalityProcessor {
  type: ModalityType = "code";
  async process(input: MultimodalInput): Promise<ProcessedOutput> {
    return {
      id: `output-${Date.now()}`,
      inputId: input.id,
      type: "analysis",
      data: { codeAnalysis: "Analyzed", language: input.metadata.language },
      confidence: 0.85,
      processingTime: 200,
      metadata: {
        processor: "CodeProcessor",
        version: "1.0.0",
        parameters: {} as Record<string, unknown>,
        alternativeResults: [],
        qualityScore: 0.8,
      },
      timestamp: new Date(),
    };
  }
  canHandle(input: MultimodalInput): boolean {
    return input.type === "code";
  }
  getCapabilities(): ProcessingCapability[] {
    return [];
  }
  getConfiguration(): ProcessorConfiguration {
    return {
      model: "code-analyzer",
      version: "1.0.0",
      parameters: {} as Record<string, unknown>,
      requirements: [],
    };
  }
}

class ImageProcessor implements ModalityProcessor {
  type: ModalityType = "image";
  async process(input: MultimodalInput): Promise<ProcessedOutput> {
    return {
      id: `output-${Date.now()}`,
      inputId: input.id,
      type: "analysis",
      data: {
        imageAnalysis: "Processed",
        dimensions: input.metadata.dimensions,
      },
      confidence: 0.75,
      processingTime: 500,
      metadata: {
        processor: "ImageProcessor",
        version: "1.0.0",
        parameters: {} as Record<string, unknown>,
        alternativeResults: [],
        qualityScore: 0.7,
      },
      timestamp: new Date(),
    };
  }
  canHandle(input: MultimodalInput): boolean {
    return input.type === "image";
  }
  getCapabilities(): ProcessingCapability[] {
    return [];
  }
  getConfiguration(): ProcessorConfiguration {
    return {
      model: "image-analyzer",
      version: "1.0.0",
      parameters: {} as Record<string, unknown>,
      requirements: [],
    };
  }
}

class AudioProcessor implements ModalityProcessor {
  type: ModalityType = "audio";
  async process(input: MultimodalInput): Promise<ProcessedOutput> {
    return {
      id: `output-${Date.now()}`,
      inputId: input.id,
      type: "analysis",
      data: { audioAnalysis: "Processed", duration: input.metadata.duration },
      confidence: 0.8,
      processingTime: 800,
      metadata: {
        processor: "AudioProcessor",
        version: "1.0.0",
        parameters: {} as Record<string, unknown>,
        alternativeResults: [],
        qualityScore: 0.75,
      },
      timestamp: new Date(),
    };
  }
  canHandle(input: MultimodalInput): boolean {
    return input.type === "audio";
  }
  getCapabilities(): ProcessingCapability[] {
    return [];
  }
  getConfiguration(): ProcessorConfiguration {
    return {
      model: "audio-analyzer",
      version: "1.0.0",
      parameters: {} as Record<string, unknown>,
      requirements: [],
    };
  }
}

class VideoProcessor implements ModalityProcessor {
  type: ModalityType = "video";
  async process(input: MultimodalInput): Promise<ProcessedOutput> {
    return {
      id: `output-${Date.now()}`,
      inputId: input.id,
      type: "analysis",
      data: { videoAnalysis: "Processed", duration: input.metadata.duration },
      confidence: 0.7,
      processingTime: 2000,
      metadata: {
        processor: "VideoProcessor",
        version: "1.0.0",
        parameters: {} as Record<string, unknown>,
        alternativeResults: [],
        qualityScore: 0.7,
      },
      timestamp: new Date(),
    };
  }
  canHandle(input: MultimodalInput): boolean {
    return input.type === "video";
  }
  getCapabilities(): ProcessingCapability[] {
    return [];
  }
  getConfiguration(): ProcessorConfiguration {
    return {
      model: "video-analyzer",
      version: "1.0.0",
      parameters: {} as Record<string, unknown>,
      requirements: [],
    };
  }
}

class DocumentProcessor implements ModalityProcessor {
  type: ModalityType = "document";
  async process(input: MultimodalInput): Promise<ProcessedOutput> {
    return {
      id: `output-${Date.now()}`,
      inputId: input.id,
      type: "extraction",
      data: { documentContent: "Extracted", format: input.metadata.format },
      confidence: 0.85,
      processingTime: 300,
      metadata: {
        processor: "DocumentProcessor",
        version: "1.0.0",
        parameters: {} as Record<string, unknown>,
        alternativeResults: [],
        qualityScore: 0.8,
      },
      timestamp: new Date(),
    };
  }
  canHandle(input: MultimodalInput): boolean {
    return input.type === "document";
  }
  getCapabilities(): ProcessingCapability[] {
    return [];
  }
  getConfiguration(): ProcessorConfiguration {
    return {
      model: "document-processor",
      version: "1.0.0",
      parameters: {} as Record<string, unknown>,
      requirements: [],
    };
  }
}

class StructuredDataProcessor implements ModalityProcessor {
  type: ModalityType = "structured";
  async process(input: MultimodalInput): Promise<ProcessedOutput> {
    return {
      id: `output-${Date.now()}`,
      inputId: input.id,
      type: "analysis",
      data: { structureAnalysis: "Processed", schema: "inferred" },
      confidence: 0.9,
      processingTime: 150,
      metadata: {
        processor: "StructuredDataProcessor",
        version: "1.0.0",
        parameters: {} as Record<string, unknown>,
        alternativeResults: [],
        qualityScore: 0.85,
      },
      timestamp: new Date(),
    };
  }
  canHandle(input: MultimodalInput): boolean {
    return input.type === "structured";
  }
  getCapabilities(): ProcessingCapability[] {
    return [];
  }
  getConfiguration(): ProcessorConfiguration {
    return {
      model: "structured-analyzer",
      version: "1.0.0",
      parameters: {} as Record<string, unknown>,
      requirements: [],
    };
  }
}

class DiagramProcessor implements ModalityProcessor {
  type: ModalityType = "diagram";
  async process(input: MultimodalInput): Promise<ProcessedOutput> {
    return {
      id: `output-${Date.now()}`,
      inputId: input.id,
      type: "analysis",
      data: { diagramAnalysis: "Processed", elements: "extracted" },
      confidence: 0.75,
      processingTime: 600,
      metadata: {
        processor: "DiagramProcessor",
        version: "1.0.0",
        parameters: {} as Record<string, unknown>,
        alternativeResults: [],
        qualityScore: 0.7,
      },
      timestamp: new Date(),
    };
  }
  canHandle(input: MultimodalInput): boolean {
    return input.type === "diagram";
  }
  getCapabilities(): ProcessingCapability[] {
    return [];
  }
  getConfiguration(): ProcessorConfiguration {
    return {
      model: "diagram-analyzer",
      version: "1.0.0",
      parameters: {} as Record<string, unknown>,
      requirements: [],
    };
  }
}

class ScreenshotProcessor implements ModalityProcessor {
  type: ModalityType = "screenshot";
  async process(input: MultimodalInput): Promise<ProcessedOutput> {
    return {
      id: `output-${Date.now()}`,
      inputId: input.id,
      type: "analysis",
      data: { screenshotAnalysis: "Processed", uiElements: "detected" },
      confidence: 0.8,
      processingTime: 400,
      metadata: {
        processor: "ScreenshotProcessor",
        version: "1.0.0",
        parameters: {} as Record<string, unknown>,
        alternativeResults: [],
        qualityScore: 0.75,
      },
      timestamp: new Date(),
    };
  }
  canHandle(input: MultimodalInput): boolean {
    return input.type === "screenshot";
  }
  getCapabilities(): ProcessingCapability[] {
    return [];
  }
  getConfiguration(): ProcessorConfiguration {
    return {
      model: "screenshot-analyzer",
      version: "1.0.0",
      parameters: {} as Record<string, unknown>,
      requirements: [],
    };
  }
}

// Placeholder converter implementations
class TextToAudioConverter implements ModalityConverter {
  async convert(
    input: MultimodalInput,
    targetModality: ModalityType,
  ): Promise<MultimodalInput> {
    return { ...input, type: targetModality, id: `converted-${Date.now()}` };
  }
  getConversionQuality(_fromType: ModalityType, _toType: ModalityType): number {
    return 0.8;
  }
  getSupportedConversions(): ConversionPath[] {
    return [];
  }
}

class ImageToTextConverter implements ModalityConverter {
  async convert(
    input: MultimodalInput,
    targetModality: ModalityType,
  ): Promise<MultimodalInput> {
    return { ...input, type: targetModality, id: `converted-${Date.now()}` };
  }
  getConversionQuality(_fromType: ModalityType, _toType: ModalityType): number {
    return 0.7;
  }
  getSupportedConversions(): ConversionPath[] {
    return [];
  }
}

class AudioToTextConverter implements ModalityConverter {
  async convert(
    input: MultimodalInput,
    targetModality: ModalityType,
  ): Promise<MultimodalInput> {
    return { ...input, type: targetModality, id: `converted-${Date.now()}` };
  }
  getConversionQuality(_fromType: ModalityType, _toType: ModalityType): number {
    return 0.85;
  }
  getSupportedConversions(): ConversionPath[] {
    return [];
  }
}

class CodeToDiagramConverter implements ModalityConverter {
  async convert(
    input: MultimodalInput,
    targetModality: ModalityType,
  ): Promise<MultimodalInput> {
    return { ...input, type: targetModality, id: `converted-${Date.now()}` };
  }
  getConversionQuality(_fromType: ModalityType, _toType: ModalityType): number {
    return 0.75;
  }
  getSupportedConversions(): ConversionPath[] {
    return [];
  }
}

class DocumentToStructuredConverter implements ModalityConverter {
  async convert(
    input: MultimodalInput,
    targetModality: ModalityType,
  ): Promise<MultimodalInput> {
    return { ...input, type: targetModality, id: `converted-${Date.now()}` };
  }
  getConversionQuality(_fromType: ModalityType, _toType: ModalityType): number {
    return 0.8;
  }
  getSupportedConversions(): ConversionPath[] {
    return [];
  }
}

class VideoToImageConverter implements ModalityConverter {
  async convert(
    input: MultimodalInput,
    targetModality: ModalityType,
  ): Promise<MultimodalInput> {
    return { ...input, type: targetModality, id: `converted-${Date.now()}` };
  }
  getConversionQuality(_fromType: ModalityType, _toType: ModalityType): number {
    return 0.9;
  }
  getSupportedConversions(): ConversionPath[] {
    return [];
  }
}

class ScreenshotToCodeConverter implements ModalityConverter {
  async convert(
    input: MultimodalInput,
    targetModality: ModalityType,
  ): Promise<MultimodalInput> {
    return { ...input, type: targetModality, id: `converted-${Date.now()}` };
  }
  getConversionQuality(_fromType: ModalityType, _toType: ModalityType): number {
    return 0.6;
  }
  getSupportedConversions(): ConversionPath[] {
    return [];
  }
}

// Export a function to get the initialized instance
export const getMultimodalIntelligence = (
  options?: MultimodalIntelligenceOptions,
) => MultimodalIntelligence.getInstance(options);

// For backward compatibility, export a promise that resolves to the instance
export const multimodalIntelligence = MultimodalIntelligence.getInstance();
