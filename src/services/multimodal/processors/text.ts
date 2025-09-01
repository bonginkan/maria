/**
 * Text Modality Processor
 * Specialized processor for text content analysis and generation
 *
 * Features:
 * - Natural language understanding and generation
 * - Sentiment analysis and entity extraction
 * - Language detection and translation
 * - Text summarization and classification
 * - Streaming support for large documents
 */

import {
  ModalityType,
  MultimodalInput,
  ProcessedOutput,
  ProcessorPort,
  ProcessingCapability,
  ProcessorConfiguration,
  ProcessorHealthStatus,
  ProcessingMode,
  SecureProcessingContext,
} from "../core/types.js";

export interface TextProcessorOptions {
  readonly maxTextLength: number;
  readonly enableSentimentAnalysis: boolean;
  readonly enableEntityExtraction: boolean;
  readonly enableLanguageDetection: boolean;
  readonly enableSummarization: boolean;
  readonly chunkSize: number; // for streaming
  readonly overlapSize: number; // overlap between chunks
}

export interface TextAnalysisResult {
  readonly sentiment?: {
    score: number; // -1 to 1
    confidence: number;
    label: "positive" | "negative" | "neutral";
  };
  readonly entities?: Array<{
    text: string;
    type: string;
    confidence: number;
    startIndex: number;
    endIndex: number;
  }>;
  readonly language?: {
    code: string;
    name: string;
    confidence: number;
  };
  readonly summary?: {
    text: string;
    keyPoints: string[];
    compressionRatio: number;
  };
  readonly classification?: {
    category: string;
    confidence: number;
    subcategories?: string[];
  };
  readonly readability?: {
    score: number;
    level: string;
    avgSentenceLength: number;
    avgWordsPerSentence: number;
  };
}

export class TextProcessor implements ProcessorPort {
  readonly type: ModalityType = "text";
  modalityType: ModalityType = "text"; // Allow override for testing
  readonly supportedModes: ProcessingMode[] = ["streaming", "chunked", "batch"];
  readonly memoryRequirement: number = 256 * 1024 * 1024; // 256MB
  readonly averageLatency: number = 500; // 500ms

  private readonly options: TextProcessorOptions;
  private readonly processingStats = {
    totalProcessed: 0,
    totalErrors: 0,
    totalTime: 0,
    streamingProcessed: 0,
  };

  private static readonly DEFAULT_OPTIONS: TextProcessorOptions = {
    maxTextLength: 10 * 1024 * 1024, // 10MB
    enableSentimentAnalysis: true,
    enableEntityExtraction: true,
    enableLanguageDetection: true,
    enableSummarization: true,
    chunkSize: 64 * 1024, // 64KB chunks
    overlapSize: 1024, // 1KB overlap
  };

  constructor(options?: Partial<TextProcessorOptions>) {
    this.options = { ...TextProcessor.DEFAULT_OPTIONS, ...options };
  }

  canHandle(input: MultimodalInput): boolean {
    if (input.type !== "text") return false;

    // Check data format
    if (typeof input.data !== "string") return false;

    // Check size limits
    const textLength = input.data.length;
    if (textLength > this.options.maxTextLength) return false;

    // Check format support
    const supportedFormats = ["plain", "markdown", "html", "xml"];
    return supportedFormats.includes(input.metadata.format);
  }

  canStream(input: MultimodalInput): boolean {
    if (!this.canHandle(input)) return false;

    // Streaming is beneficial for large texts
    const textLength = (input.data as string).length;
    return textLength > this.options.chunkSize * 2;
  }

  async process(
    input: MultimodalInput,
    options?: {
      signal?: AbortSignal;
      deadlineAt?: number;
      mode?: ProcessingMode;
      securityContext?: SecureProcessingContext;
      memoryLimit?: number;
    },
  ): Promise<ProcessedOutput> {
    const startTime = Date.now();

    try {
      this.validateInput(input);

      const text = input.data as string;
      const processingMode = this.selectProcessingMode(text, options?.mode);

      let analysisResult: TextAnalysisResult;

      switch (processingMode) {
        case "streaming":
          analysisResult = await this.processStreaming(text, options?.signal);
          break;
        case "chunked":
          analysisResult = await this.processChunked(text, options?.signal);
          break;
        case "batch":
          analysisResult = await this.processBatch(text, options?.signal);
          break;
        default:
          throw new Error(`Unsupported processing mode: ${processingMode}`);
      }

      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, true);

      return {
        id: this.generateOutputId(),
        inputId: input.id,
        type: "analysis",
        data: analysisResult,
        confidence: this.calculateOverallConfidence(analysisResult),
        processingTime,
        metadata: {
          processor: "TextProcessor",
          version: "2.1.0",
          parameters: {
            mode: processingMode,
            enabledFeatures: this.getEnabledFeatures(),
            textLength: text.length,
            ...(options?.securityContext && {
              securityContext: options.securityContext,
            }),
          },
          alternativeResults: [],
          qualityScore: this.calculateQualityScore(analysisResult),
          processingMode,
          memoryUsed: this.estimateMemoryUsage(text),
          cacheHit: false,
        },
        timestamp: new Date(),
        correlationId: options?.securityContext?.correlationId,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, false);
      throw error;
    }
  }

  async *processStream(
    input: MultimodalInput,
    options?: {
      signal?: AbortSignal;
      chunkSize?: number;
      onProgress?: (progress: number) => void;
    },
  ): AsyncGenerator<Partial<ProcessedOutput>, ProcessedOutput> {
    const text = input.data as string;
    const chunkSize = options?.chunkSize || this.options.chunkSize;
    const totalChunks = Math.ceil(text.length / chunkSize);

    const processedResults: TextAnalysisResult[] = [];

    for (let i = 0; i < totalChunks; i++) {
      if (options?.signal?.aborted) {
        throw new Error("Processing aborted");
      }

      const start = i * chunkSize;
      const end = Math.min(
        start + chunkSize + this.options.overlapSize,
        text.length,
      );
      const chunk = text.slice(start, end);

      // Process chunk
      const chunkResult = await this.processBatch(chunk);
      processedResults.push(chunkResult);

      // Yield partial result
      const progress = (i + 1) / totalChunks;
      options?.onProgress?.(progress);

      yield {
        id: this.generateOutputId(),
        inputId: input.id,
        type: "analysis",
        data: this.mergePartialResults(processedResults),
        confidence: this.calculateProgressiveConfidence(processedResults),
        metadata: {
          processor: "TextProcessor",
          version: "2.1.0",
          parameters: {
            mode: "streaming",
            progress,
            chunksProcessed: i + 1,
            totalChunks,
          },
          alternativeResults: [],
          qualityScore: 0.8,
          processingMode: "streaming",
          memoryUsed: this.estimateMemoryUsage(chunk),
          cacheHit: false,
        },
      } as Partial<ProcessedOutput>;
    }

    // Return final result
    const finalResult = this.mergeResults(processedResults);

    return {
      id: this.generateOutputId(),
      inputId: input.id,
      type: "analysis",
      data: finalResult,
      confidence: this.calculateOverallConfidence(finalResult),
      processingTime: Date.now() - Date.now(), // This would be tracked properly
      metadata: {
        processor: "TextProcessor",
        version: "2.1.0",
        parameters: {
          mode: "streaming",
          chunksProcessed: totalChunks,
          enabledFeatures: this.getEnabledFeatures(),
        },
        alternativeResults: [],
        qualityScore: this.calculateQualityScore(finalResult),
        processingMode: "streaming",
        memoryUsed: this.estimateMemoryUsage(text),
        cacheHit: false,
      },
      timestamp: new Date(),
    };
  }

  getCapabilities(): ProcessingCapability[] {
    return [
      {
        name: "sentiment_analysis",
        description: "Analyze emotional tone and sentiment",
        inputTypes: ["text/plain", "text/markdown"],
        outputTypes: ["application/json"],
        confidence: 0.85,
        supportedModes: ["streaming", "chunked", "batch"],
        averageLatency: 200,
        memoryRequirement: 64 * 1024 * 1024,
      },
      {
        name: "entity_extraction",
        description: "Extract named entities (persons, places, organizations)",
        inputTypes: ["text/plain", "text/markdown"],
        outputTypes: ["application/json"],
        confidence: 0.8,
        supportedModes: ["streaming", "chunked", "batch"],
        averageLatency: 300,
        memoryRequirement: 128 * 1024 * 1024,
      },
      {
        name: "language_detection",
        description: "Detect language and encoding",
        inputTypes: ["text/plain"],
        outputTypes: ["application/json"],
        confidence: 0.95,
        supportedModes: ["batch"],
        averageLatency: 50,
        memoryRequirement: 16 * 1024 * 1024,
      },
      {
        name: "text_summarization",
        description: "Generate extractive and abstractive summaries",
        inputTypes: ["text/plain", "text/markdown"],
        outputTypes: ["text/plain", "application/json"],
        confidence: 0.75,
        supportedModes: ["chunked", "batch"],
        averageLatency: 1000,
        memoryRequirement: 256 * 1024 * 1024,
      },
    ];
  }

  getConfiguration(): ProcessorConfiguration {
    return {
      model: "text-analyzer-v2.1",
      version: "2.1.0",
      parameters: {
        maxTextLength: this.options.maxTextLength,
        chunkSize: this.options.chunkSize,
        enabledFeatures: this.getEnabledFeatures(),
      },
      requirements: [
        { type: "memory", minimum: "256MB", recommended: "512MB" },
        { type: "cpu", minimum: "2 cores", recommended: "4 cores" },
      ],
    };
  }

  async healthCheck(): Promise<ProcessorHealthStatus> {
    const startTime = Date.now();

    try {
      // Simple health check with sample text
      const sampleInput: MultimodalInput = {
        id: "health-check",
        type: "text",
        data: "This is a sample text for health checking.",
        metadata: {
          format: "plain",
          size: 41,
          source: "health-check",
          quality: 1.0,
          tags: ["health-check"],
        },
        timestamp: new Date(),
        priority: 0,
        context: [],
      };

      await this.process(sampleInput);

      const latency = Date.now() - startTime;
      const errorRate =
        this.processingStats.totalErrors /
        Math.max(this.processingStats.totalProcessed, 1);

      return {
        healthy: true,
        latency,
        errorRate,
        memoryUsage: process.memoryUsage().heapUsed,
        queueDepth: 0, // This would be tracked by the queue
        streamingCapable: true,
        lastHealthCheck: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        errorRate: 1.0,
        memoryUsage: process.memoryUsage().heapUsed,
        queueDepth: 0,
        streamingCapable: false,
        lastError:
          error instanceof Error ? error.message : "Health check failed",
        lastHealthCheck: new Date(),
      };
    }
  }

  // Private methods

  private validateInput(input: MultimodalInput): void {
    if (!this.canHandle(input)) {
      throw new Error("Input validation failed");
    }

    const text = input.data as string;
    if (text.length === 0) {
      throw new Error("Empty text input");
    }
  }

  private selectProcessingMode(
    text: string,
    preferredMode?: ProcessingMode,
  ): ProcessingMode {
    if (preferredMode && this.supportedModes.includes(preferredMode)) {
      return preferredMode;
    }

    const textLength = text.length;

    if (textLength > 1024 * 1024) {
      // > 1MB
      return "streaming";
    } else if (textLength > 64 * 1024) {
      // > 64KB
      return "chunked";
    } else {
      return "batch";
    }
  }

  private async processStreaming(
    text: string,
    signal?: AbortSignal,
  ): Promise<TextAnalysisResult> {
    // Implementation would use streaming processing
    return this.processBatch(text, signal);
  }

  private async processChunked(
    text: string,
    signal?: AbortSignal,
  ): Promise<TextAnalysisResult> {
    const chunkSize = this.options.chunkSize;
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    const results = await Promise.all(
      chunks.map((chunk) => this.processBatch(chunk, signal)),
    );

    return this.mergeResults(results);
  }

  private async processBatch(
    text: string,
    signal?: AbortSignal,
  ): Promise<TextAnalysisResult> {
    if (signal?.aborted) {
      throw new Error("Processing aborted");
    }

    const result: TextAnalysisResult = {};

    // Sentiment analysis
    if (this.options.enableSentimentAnalysis) {
      result.sentiment = await this.analyzeSentiment(text);
    }

    // Entity extraction
    if (this.options.enableEntityExtraction) {
      result.entities = await this.extractEntities(text);
    }

    // Language detection
    if (this.options.enableLanguageDetection) {
      result.language = await this.detectLanguage(text);
    }

    // Summarization
    if (this.options.enableSummarization && text.length > 1000) {
      result.summary = await this.summarizeText(text);
    }

    // Classification
    result.classification = await this.classifyText(text);

    // Readability analysis
    result.readability = await this.analyzeReadability(text);

    return result;
  }

  private async analyzeSentiment(
    text: string,
  ): Promise<TextAnalysisResult["sentiment"]> {
    // Mock implementation - would use actual NLP library
    const words = text.toLowerCase().split(/\s+/);
    const positiveWords = [
      "good",
      "great",
      "excellent",
      "amazing",
      "wonderful",
    ];
    const negativeWords = ["bad", "terrible", "awful", "horrible", "poor"];

    const positiveScore = words.filter((word) =>
      positiveWords.includes(word),
    ).length;
    const negativeScore = words.filter((word) =>
      negativeWords.includes(word),
    ).length;
    const totalScore = positiveScore - negativeScore;

    const normalizedScore = Math.max(
      -1,
      Math.min(1, (totalScore / words.length) * 10),
    );

    let label: "positive" | "negative" | "neutral" = "neutral";
    if (normalizedScore > 0.1) label = "positive";
    else if (normalizedScore < -0.1) label = "negative";

    return {
      score: normalizedScore,
      confidence: Math.min(0.9, 0.5 + Math.abs(normalizedScore)),
      label,
    };
  }

  private async extractEntities(
    text: string,
  ): Promise<TextAnalysisResult["entities"]> {
    // Mock implementation
    const entities: NonNullable<TextAnalysisResult["entities"]> = [];

    // Simple regex-based entity extraction (would use proper NER in production)
    const patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      url: /https?:\/\/[^\s]+/g,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type,
          confidence: 0.8,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    return entities;
  }

  private async detectLanguage(
    text: string,
  ): Promise<TextAnalysisResult["language"]> {
    // Mock implementation - would use proper language detection
    const sample = text.slice(0, 1000).toLowerCase();

    // Simple frequency-based detection
    const englishWords = [
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
    ];
    const matches = englishWords.filter((word) => sample.includes(word)).length;

    if (matches > 3) {
      return {
        code: "en",
        name: "English",
        confidence: Math.min(0.95, matches / englishWords.length + 0.5),
      };
    }

    return {
      code: "unknown",
      name: "Unknown",
      confidence: 0.1,
    };
  }

  private async summarizeText(
    text: string,
  ): Promise<TextAnalysisResult["summary"]> {
    // Mock implementation - would use proper summarization
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    if (sentences.length <= 3) {
      return {
        text: text.slice(0, 200) + "...",
        keyPoints: sentences.slice(0, 3),
        compressionRatio: 1.0,
      };
    }

    // Simple extractive summarization
    const summary =
      sentences.slice(0, Math.ceil(sentences.length / 3)).join(". ") + ".";

    return {
      text: summary,
      keyPoints: sentences.slice(0, 5),
      compressionRatio: summary.length / text.length,
    };
  }

  private async classifyText(
    text: string,
  ): Promise<TextAnalysisResult["classification"]> {
    // Mock implementation
    const length = text.length;

    let category = "general";
    let confidence = 0.6;

    if (
      text.includes("function") ||
      text.includes("class") ||
      text.includes("import")
    ) {
      category = "code";
      confidence = 0.8;
    } else if (text.includes("Dear") || text.includes("Sincerely")) {
      category = "correspondence";
      confidence = 0.7;
    } else if (length > 10000) {
      category = "document";
      confidence = 0.65;
    }

    return { category, confidence };
  }

  private async analyzeReadability(
    text: string,
  ): Promise<TextAnalysisResult["readability"]> {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const words = text.split(/\s+/).filter((w) => w.trim().length > 0);

    const avgSentenceLength =
      sentences.length > 0 ? words.length / sentences.length : 0;
    const avgWordsPerSentence = avgSentenceLength;

    // Simple readability score (mock implementation)
    const score = Math.max(
      0,
      Math.min(100, 206.835 - 1.015 * avgWordsPerSentence - 84.6 * 1.5),
    );

    let level = "Graduate";
    if (score > 90) level = "Elementary";
    else if (score > 80) level = "Middle School";
    else if (score > 70) level = "High School";
    else if (score > 60) level = "College";

    return {
      score,
      level,
      avgSentenceLength,
      avgWordsPerSentence,
    };
  }

  private mergeResults(results: TextAnalysisResult[]): TextAnalysisResult {
    if (results.length === 0) return {};
    if (results.length === 1) return results[0];

    // Merge logic would be more sophisticated in production
    const merged: TextAnalysisResult = {};

    // Average sentiment scores
    const sentiments = results.filter((r) => r.sentiment);
    if (sentiments.length > 0) {
      const avgScore =
        sentiments.reduce((sum, r) => sum + r.sentiment!.score, 0) /
        sentiments.length;
      const avgConfidence =
        sentiments.reduce((sum, r) => sum + r.sentiment!.confidence, 0) /
        sentiments.length;

      merged.sentiment = {
        score: avgScore,
        confidence: avgConfidence,
        label:
          avgScore > 0.1
            ? "positive"
            : avgScore < -0.1
              ? "negative"
              : "neutral",
      };
    }

    // Combine entities
    const allEntities = results.flatMap((r) => r.entities || []);
    if (allEntities.length > 0) {
      merged.entities = allEntities;
    }

    // Use first language detection
    merged.language = results.find((r) => r.language)?.language;

    return merged;
  }

  private mergePartialResults(
    results: TextAnalysisResult[],
  ): TextAnalysisResult {
    // Similar to mergeResults but for progressive streaming
    return this.mergeResults(results);
  }

  private calculateOverallConfidence(result: TextAnalysisResult): number {
    const confidences: number[] = [];

    if (result.sentiment) confidences.push(result.sentiment.confidence);
    if (result.language) confidences.push(result.language.confidence);
    if (result.classification)
      confidences.push(result.classification.confidence);

    return confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0.5;
  }

  private calculateProgressiveConfidence(
    results: TextAnalysisResult[],
  ): number {
    if (results.length === 0) return 0;
    return (
      this.calculateOverallConfidence(this.mergeResults(results)) *
      Math.min(1.0, results.length / 3)
    ); // Confidence grows with more chunks
  }

  private calculateQualityScore(result: TextAnalysisResult): number {
    let score = 0.5; // Base score

    // Boost score based on available analysis
    if (result.sentiment) score += 0.1;
    if (result.entities && result.entities.length > 0) score += 0.1;
    if (result.language && result.language.confidence > 0.8) score += 0.1;
    if (result.summary) score += 0.1;
    if (result.classification) score += 0.1;

    return Math.min(1.0, score);
  }

  private estimateMemoryUsage(text: string): number {
    // Rough estimation: text size + processing overhead
    return text.length * 2 + 64 * 1024 * 1024; // 64MB base overhead
  }

  private getEnabledFeatures(): string[] {
    const features: string[] = [];

    if (this.options.enableSentimentAnalysis) features.push("sentiment");
    if (this.options.enableEntityExtraction) features.push("entities");
    if (this.options.enableLanguageDetection) features.push("language");
    if (this.options.enableSummarization) features.push("summarization");

    return features;
  }

  private generateOutputId(): string {
    return `text_output_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateStats(processingTime: number, success: boolean): void {
    this.processingStats.totalProcessed++;
    this.processingStats.totalTime += processingTime;

    if (!success) {
      this.processingStats.totalErrors++;
    }
  }
}
