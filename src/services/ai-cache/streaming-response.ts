/**
 * Streaming AI Response Handler
 * Phase 5: Real-time streaming for faster perceived performance
 */

import { Transform, Readable } from "stream";
import { EventEmitter } from "node:events";

export interface StreamChunk {
  content: string;
  index: number;
  timestamp: number;
  isComplete: boolean;
  metadata?: Record<string, any>;
}

export interface StreamingConfig {
  chunkSize: number;
  flushInterval: number;
  enablePartialCache: boolean;
  timeout: number;
}

/**
 * Transform stream for processing AI response chunks
 */
export class ChunkProcessor extends Transform {
  private buffer: string = "";
  private chunkIndex: number = 0;
  private startTime: number = Date.now();

  constructor(private config: StreamingConfig) {
    super({ objectMode: true });
  }

  _transform(
    chunk: any,
    encoding: string,
    callback: (error?: Error | null, data?: any) => void,
  ): void {
    try {
      // Handle different chunk formats
      const content = this.extractContent(chunk);
      this.buffer += content;

      // Check if we should emit a chunk
      if (this.shouldEmitChunk()) {
        this.emitChunk(false);
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback: (error?: Error | null) => void): void {
    // Emit any remaining content
    if (this.buffer.length > 0) {
      this.emitChunk(true);
    }
    callback();
  }

  private extractContent(chunk: any): string {
    if (typeof chunk === "string") {
      return chunk;
    } else if (Buffer.isBuffer(chunk)) {
      return chunk.toString("utf-8");
    } else if (chunk.choices?.[0]?.delta?.content) {
      // OpenAI format
      return chunk.choices[0].delta.content;
    } else if (chunk.completion) {
      // Anthropic format
      return chunk.completion;
    } else if (chunk.text) {
      // Generic text format
      return chunk.text;
    }
    return "";
  }

  private shouldEmitChunk(): boolean {
    return (
      this.buffer.length >= this.config.chunkSize ||
      this.buffer.includes("\n") ||
      this.buffer.includes(". ")
    );
  }

  private emitChunk(isComplete: boolean): void {
    const chunk: StreamChunk = {
      content: this.buffer,
      index: this.chunkIndex++,
      timestamp: Date.now() - this.startTime,
      isComplete,
      metadata: {
        size: this.buffer.length,
      },
    };

    this.push(chunk);
    this.buffer = "";
  }
}

/**
 * Streaming AI Service for real-time responses
 */
export class StreamingAIService extends EventEmitter {
  private activeStreams: Map<string, Readable> = new Map();
  private partialResponses: Map<string, string[]> = new Map();

  constructor(private config: StreamingConfig) {
    super();
  }

  /**
   * Create a streaming response
   */
  async createStream(
    promptId: string,
    provider: any,
    prompt: string,
    options?: Record<string, any>,
  ): Promise<Readable> {
    try {
      // Check if stream already exists
      if (this.activeStreams.has(promptId)) {
        throw new Error(`Stream ${promptId} already exists`);
      }

      // Create provider stream
      const providerStream = await this.createProviderStream(
        provider,
        prompt,
        options,
      );

      // Create chunk processor
      const processor = new ChunkProcessor(this.config);

      // Set up event handlers
      this.setupStreamHandlers(promptId, processor);

      // Connect streams
      const stream = providerStream.pipe(processor);

      // Store active stream
      this.activeStreams.set(promptId, stream);
      this.partialResponses.set(promptId, []);

      // Set timeout
      this.setStreamTimeout(promptId);

      return stream;
    } catch (error) {
      this.emit("stream:error", { promptId, error });
      throw error;
    }
  }

  /**
   * Create provider-specific stream
   */
  private async createProviderStream(
    provider: any,
    prompt: string,
    options?: Record<string, any>,
  ): Promise<Readable> {
    // This would be implemented based on the specific provider
    // For now, return a mock stream
    return new Readable({
      read() {
        // Provider-specific streaming implementation
      },
    });
  }

  /**
   * Set up event handlers for stream
   */
  private setupStreamHandlers(
    promptId: string,
    processor: ChunkProcessor,
  ): void {
    processor.on("data", (chunk: StreamChunk) => {
      // Store partial response
      const partials = this.partialResponses.get(promptId) || [];
      partials.push(chunk.content);
      this.partialResponses.set(promptId, partials);

      // Emit chunk event
      this.emit("stream:chunk", { promptId, chunk });

      // Cache partial if enabled
      if (this.config.enablePartialCache) {
        this.cachePartial(promptId, partials.join(""));
      }
    });

    processor.on("end", () => {
      const fullResponse = this.partialResponses.get(promptId)?.join("") || "";
      this.emit("stream:complete", { promptId, response: fullResponse });
      this.cleanupStream(promptId);
    });

    processor.on("error", (error: Error) => {
      this.emit("stream:error", { promptId, error });
      this.cleanupStream(promptId);
    });
  }

  /**
   * Set timeout for stream
   */
  private setStreamTimeout(promptId: string): void {
    setTimeout(() => {
      if (this.activeStreams.has(promptId)) {
        this.emit("stream:timeout", { promptId });
        this.abortStream(promptId);
      }
    }, this.config.timeout);
  }

  /**
   * Cache partial response
   */
  private cachePartial(promptId: string, partial: string): void {
    // Implementation would integrate with main cache service
    this.emit("cache:partial", { promptId, partial });
  }

  /**
   * Abort an active stream
   */
  abortStream(promptId: string): void {
    const stream = this.activeStreams.get(promptId);
    if (stream) {
      stream.destroy();
      this.cleanupStream(promptId);
      this.emit("stream:abort", { promptId });
    }
  }

  /**
   * Clean up stream resources
   */
  private cleanupStream(promptId: string): void {
    this.activeStreams.delete(promptId);
    this.partialResponses.delete(promptId);
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Check if stream is active
   */
  isStreamActive(promptId: string): boolean {
    return this.activeStreams.has(promptId);
  }

  /**
   * Get partial response
   */
  getPartialResponse(promptId: string): string | null {
    const partials = this.partialResponses.get(promptId);
    return partials ? partials.join("") : null;
  }
}

/**
 * Response aggregator for handling multiple streams
 */
export class ResponseAggregator extends EventEmitter {
  private responses: Map<string, string[]> = new Map();
  private completedStreams: Set<string> = new Set();

  constructor(private streamIds: string[]) {
    super();
  }

  /**
   * Add chunk to aggregator
   */
  addChunk(streamId: string, chunk: StreamChunk): void {
    if (!this.streamIds.includes(streamId)) {
      throw new Error(`Unknown stream ID: ${streamId}`);
    }

    const chunks = this.responses.get(streamId) || [];
    chunks.push(chunk.content);
    this.responses.set(streamId, chunks);

    if (chunk.isComplete) {
      this.completedStreams.add(streamId);
      this.checkCompletion();
    }

    this.emit("chunk", { streamId, chunk });
  }

  /**
   * Check if all streams are complete
   */
  private checkCompletion(): void {
    if (this.completedStreams.size === this.streamIds.length) {
      const aggregated = this.aggregate();
      this.emit("complete", aggregated);
    }
  }

  /**
   * Aggregate all responses
   */
  private aggregate(): Map<string, string> {
    const result = new Map<string, string>();

    for (const [streamId, chunks] of this.responses) {
      result.set(streamId, chunks.join(""));
    }

    return result;
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    return (this.completedStreams.size / this.streamIds.length) * 100;
  }

  /**
   * Abort aggregation
   */
  abort(): void {
    this.emit("abort");
    this.responses.clear();
    this.completedStreams.clear();
  }
}

/**
 * Stream manager singleton
 */
let streamManager: StreamingAIService | null = null;

/**
 * Initialize streaming service
 */
export function initializeStreaming(
  config?: Partial<StreamingConfig>,
): StreamingAIService {
  const defaultConfig: StreamingConfig = {
    chunkSize: 100,
    flushInterval: 100,
    enablePartialCache: true,
    timeout: 30000, // 30 seconds
    ...config,
  };

  streamManager = new StreamingAIService(defaultConfig);
  return streamManager;
}

/**
 * Get streaming service instance
 */
export function getStreamingService(): StreamingAIService {
  if (!streamManager) {
    return initializeStreaming();
  }
  return streamManager;
}
