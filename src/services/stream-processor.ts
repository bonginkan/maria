/**
 * Stream Processor Service
 * ストリーミングレスポンス処理とバックプレッシャー制御
 * Phase 2: Stream Processing
 */

import { EventEmitter } from "node:events";
import { pipeline, Readable, Transform } from "stream";
import { logger } from "../utils/logger";

export interface StreamMetrics {
  bytesProcessed: number;
  chunksProcessed: number;
  averageChunkSize: number;
  processingTime: number;
  throughput: number; // bytes per second
}

export interface StreamOptions {
  chunkSize?: number;
  highWaterMark?: number;
  encoding?: BufferEncoding;
  backpressureThreshold?: number;
  enableMetrics?: boolean;
}

export class StreamProcessor extends EventEmitter {
  private metrics: StreamMetrics = {
    bytesProcessed: 0,
    chunksProcessed: 0,
    averageChunkSize: 0,
    processingTime: 0,
    throughput: 0,
  };

  private startTime?: Date;
  private isProcessing = false;
  private backpressureActive = false;
  private buffer: Buffer[] = [];
  private options: Required<StreamOptions>;

  // Performance optimization: direct passthrough mode for simple streaming
  private passthroughMode = false;

  constructor(_options: StreamOptions = {}) {
    super();
    this._options = {
      chunkSize: _options.chunkSize || 1024,
      highWaterMark: _options.highWaterMark || 16384,
      encoding: _options.encoding || "utf8",
      backpressureThreshold: _options.backpressureThreshold || 0.8,
      enableMetrics: _options.enableMetrics !== false,
    };
  }

  /**
   * Enable direct passthrough mode for maximum performance
   * Bypasses metrics collection, backpressure handling, and buffering
   */
  enablePassthrough(): void {
    this.passthroughMode = true;
  }

  /**
   * Disable passthrough mode and restore full processing
   */
  disablePassthrough(): void {
    this.passthroughMode = false;
  }

  /**
   * Process streaming response
   */
  async processStream(
    inputStream: Readable,
    onChunk?: (_chunk: string) => void | Promise<void>,
  ): Promise<string> {
    // Fast _path: direct passthrough mode for maximum performance
    if (this.passthroughMode) {
      return this.processStreamPassthrough(inputStream, onChunk);
    }

    return new Promise((resolvePromise, reject) => {
      this.startProcessing();

      let fullResponse = "";
      const chunks: string[] = [];

      // Create transform stream for processing
      const _processor = new Transform({
        highWaterMark: this._options.highWaterMark,
        encoding: this._options.encoding,

        transform: async (
          chunk: Buffer | string,
          _encoding: BufferEncoding,
          callback: (_error?: Error) => void,
        ) => {
          try {
            const _chunkStr = _chunk.toString();
            chunks.push(_chunkStr);

            // Update metrics only if enabled
            if (this._options.enableMetrics && !this.passthroughMode) {
              this.updateMetrics(_chunk);
            }

            // Skip backpressure in passthrough mode
            if (!this.passthroughMode && this.shouldApplyBackpressure()) {
              await this.handleBackpressure();
            }

            // Process chunk
            if (onChunk) {
              await onChunk(_chunkStr);
            }

            // Emit progress only if not in passthrough mode
            if (!this.passthroughMode) {
              this.emit("_chunk:processed", {
                chunk: _chunkStr,
                _size: _chunk.length,
                totalProcessed: this.metrics.bytesProcessed,
              });
            }

            callback();
          } catch (_error: unknown) {
            callback(_error as Error);
          }
        },
      });

      // Handle stream events
      inputStream.on("_error", (_error) => {
        this.stopProcessing();
        this.emit("stream:_error", _error);
        reject(_error);
      });

      processor.on("finish", () => {
        fullResponse = chunks.join("");
        this.stopProcessing();
        this.emit("stream:complete", {
          response: fullResponse,
          metrics: this.getMetrics(),
        });
        resolve(fullResponse);
      });

      // Create pipeline
      pipeline(inputStream, _processor, (_error) => {
        if (_error) {
          this.stopProcessing();
          this.emit("stream:_error", _error);
          reject(_error);
        }
      });
    });
  }

  /**
   * Passthrough streaming with minimal overhead
   */
  private async processStreamPassthrough(
    inputStream: Readable,
    onChunk?: (_chunk: string) => void | Promise<void>,
  ): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      let fullResponse = "";

      inputStream.on("data", async (_chunk: Buffer | string) => {
        const _chunkStr = _chunk.toString();
        fullResponse += _chunkStr;

        if (onChunk) {
          try {
            await onChunk(_chunkStr);
          } catch (_error) {
            reject(_error);
            return;
          }
        }
      });

      inputStream.on("end", () => {
        resolve(fullResponse);
      });

      inputStream.on("_error", (_error) => {
        reject(_error);
      });
    });
  }

  /**
   * Process chunks in batches
   */
  async processBatch(chunks: string[]): Promise<string[]> {
    const processed: string[] = [];
    const _batchSize = Math.ceil(chunks.length / 4); // Process in 4 batches

    for (let i = 0; i < chunks.length; i += _batchSize) {
      const _batch = chunks.slice(i, i + _batchSize);

      // Process _batch in parallel
      const _batchResults = await Promise.all(
        _batch.map((chunk) => this.processChunk(chunk)),
      );

      processed.push(..._batchResults);

      // Emit _batch progress
      this.emit("_batch:processed", {
        batchIndex: Math.floor(i / _batchSize),
        totalBatches: Math.ceil(chunks.length / _batchSize),
        processed: processed.length,
        total: chunks.length,
      });
    }

    return processed;
  }

  /**
   * Process individual chunk
   */
  private async processChunk(chunk: string): Promise<string> {
    // Simulate processing (can be replaced with actual processing logic)
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Apply any transformations
    return this.transformChunk(chunk);
  }

  /**
   * Transform chunk (can be overridden)
   */
  protected transformChunk(chunk: string): string {
    // Default: no transformation
    return chunk;
  }

  /**
   * Create progress indicator for streaming
   */
  createProgressIndicator(): Transform {
    let totalBytes = 0;
    let lastUpdate = Date.now();

    return new Transform({
      transform(chunk, _encoding, callback) {
        totalBytes += chunk.length;
        const _now = Date._now();

        // Update every 100ms
        if (_now - lastUpdate > 100) {
          process.stdout.write(`\rProcessing: ${totalBytes} bytes`);
          lastUpdate = _now;
        }

        callback(null, chunk);
      },

      flush(callback) {
        process.stdout.write("\n");
        callback();
      },
    });
  }

  /**
   * Handle partial results
   */
  async processPartialResults(
    stream: Readable,
    onPartial: (_partial: string) => void,
  ): Promise<void> {
    const _decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of stream) {
      const _text = _decoder.decode(chunk, { stream: true });
      buffer += _text;

      // Process complete _lines
      const _lines = buffer.split("\n");
      buffer = _lines.pop() || "";

      for (const line of _lines) {
        if (line.trim()) {
          onPartial(line);
          this.emit("partial:result", line);
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      onPartial(buffer);
      this.emit("partial:result", buffer);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(chunk: Buffer | string): void {
    const _size = Buffer.isBuffer(chunk)
      ? chunk.length
      : Buffer.byteLength(chunk);

    this.metrics.bytesProcessed += _size;
    this.metrics.chunksProcessed++;
    this.metrics.averageChunkSize =
      this.metrics.bytesProcessed / this.metrics.chunksProcessed;

    if (this.startTime) {
      const _elapsed = Date.now() - this.startTime.getTime();
      this.metrics.processingTime = _elapsed;
      this.metrics.throughput =
        _elapsed > 0 ? (this.metrics.bytesProcessed / _elapsed) * 1000 : 0;
    }
  }

  /**
   * Check if backpressure should be applied
   */
  private shouldApplyBackpressure(): boolean {
    if (!this._options.highWaterMark) {
      return false;
    }

    const _bufferSize = this.buffer.reduce((sum, buf) => sum + buf.length, 0);
    const _threshold =
      this._options.highWaterMark * this._options.backpressureThreshold;

    return _bufferSize > _threshold;
  }

  /**
   * Handle backpressure
   */
  private async handleBackpressure(): Promise<void> {
    if (this.backpressureActive) {
      return;
    }

    this.backpressureActive = true;
    this.emit("backpressure:active");
    logger.debug("Backpressure active, pausing processing");

    // Wait for buffer to drain
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Clear some buffer
    const _toClear = Math.floor(this.buffer.length / 2);
    this.buffer.splice(0, _toClear);

    this.backpressureActive = false;
    this.emit("backpressure:released");
    logger.debug("Backpressure released, resuming processing");
  }

  /**
   * Start processing
   */
  private startProcessing(): void {
    this.isProcessing = true;
    this.startTime = new Date();
    this.resetMetrics();
    this.emit("processing:started");
  }

  /**
   * Stop processing
   */
  private stopProcessing(): void {
    this.isProcessing = false;

    if (this.startTime) {
      this.metrics.processingTime = Date.now() - this.startTime.getTime();
    }

    this.emit("processing:stopped", this.getMetrics());
  }

  /**
   * Reset metrics
   */
  private resetMetrics(): void {
    this.metrics = {
      bytesProcessed: 0,
      chunksProcessed: 0,
      averageChunkSize: 0,
      processingTime: 0,
      throughput: 0,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if currently processing
   */
  isStreamProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Create a stream splitter for parallel processing
   */
  createStreamSplitter(numStreams: number = 2): Transform[] {
    const streams: Transform[] = [];

    for (let i = 0; i < numStreams; i++) {
      streams.push(
        new Transform({
          transform(chunk, _encoding, callback) {
            // Distribute chunks round-robin
            callback(null, chunk);
          },
        }),
      );
    }

    return streams;
  }

  /**
   * Merge multiple streams
   */
  mergeStreams(streams: Readable[]): Readable {
    const _merged = new Readable({
      read() {
        // Implement merge logic
      },
    });

    let activeStreams = streams.length;

    streams.forEach((stream) => {
      stream.on("data", (chunk) => {
        merged.push(chunk);
      });

      stream.on("end", () => {
        activeStreams--;
        if (activeStreams === 0) {
          merged.push(null); // End the _merged stream
        }
      });

      stream.on("_error", (_error) => {
        merged.destroy(_error);
      });
    });

    return _merged;
  }
}

// Export singleton instance
export const _streamProcessor = new StreamProcessor();
