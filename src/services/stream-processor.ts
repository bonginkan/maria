/**
 * Stream Processor Service
 * ストリーミングレスポンス処理とバックプレッシャー制御
 * Phase 2: Stream Processing
 */

import { EventEmitter } from 'events';
import { Transform, Readable, pipeline } from 'stream';
import { logger } from '../utils/logger';

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

  constructor(options: StreamOptions = {}) {
    super();
    this.options = {
      chunkSize: options.chunkSize || 1024,
      highWaterMark: options.highWaterMark || 16384,
      encoding: options.encoding || 'utf8',
      backpressureThreshold: options.backpressureThreshold || 0.8,
      enableMetrics: options.enableMetrics !== false,
    };
  }

  /**
   * Process streaming response
   */
  async processStream(
    inputStream: Readable,
    onChunk?: (chunk: string) => void | Promise<void>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.startProcessing();

      let fullResponse = '';
      const chunks: string[] = [];

      // Create transform stream for processing
      const processor = new Transform({
        highWaterMark: this.options.highWaterMark,
        encoding: this.options.encoding,

        transform: async function (chunk, encoding, callback) {
          try {
            const chunkStr = chunk.toString();
            chunks.push(chunkStr);

            // Update metrics
            if (this.options.enableMetrics) {
              this.updateMetrics(chunk);
            }

            // Check backpressure
            if (this.shouldApplyBackpressure()) {
              await this.handleBackpressure();
            }

            // Process chunk
            if (onChunk) {
              await onChunk(chunkStr);
            }

            // Emit progress
            this.emit('chunk:processed', {
              chunk: chunkStr,
              size: chunk.length,
              totalProcessed: this.metrics.bytesProcessed,
            });

            callback(null, chunk);
          } catch (error: unknown) {
            callback(error as Error);
          }
        }.bind(this),
      });

      // Handle stream events
      inputStream.on('error', (error) => {
        this.stopProcessing();
        this.emit('stream:error', error);
        reject(error);
      });

      processor.on('finish', () => {
        fullResponse = chunks.join('');
        this.stopProcessing();
        this.emit('stream:complete', {
          response: fullResponse,
          metrics: this.getMetrics(),
        });
        resolve(fullResponse);
      });

      // Create pipeline
      pipeline(inputStream, processor, (error) => {
        if (error) {
          this.stopProcessing();
          this.emit('stream:error', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Process chunks in batches
   */
  async processBatch(chunks: string[]): Promise<string[]> {
    const processed: string[] = [];
    const batchSize = Math.ceil(chunks.length / 4); // Process in 4 batches

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // Process batch in parallel
      const batchResults = await Promise.all(batch.map((chunk) => this.processChunk(chunk)));

      processed.push(...batchResults);

      // Emit batch progress
      this.emit('batch:processed', {
        batchIndex: Math.floor(i / batchSize),
        totalBatches: Math.ceil(chunks.length / batchSize),
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
      transform(chunk, encoding, callback) {
        totalBytes += chunk.length;
        const now = Date.now();

        // Update every 100ms
        if (now - lastUpdate > 100) {
          process.stdout.write(`\rProcessing: ${totalBytes} bytes`);
          lastUpdate = now;
        }

        callback(null, chunk);
      },

      flush(callback) {
        process.stdout.write('\n');
        callback();
      },
    });
  }

  /**
   * Handle partial results
   */
  async processPartialResults(
    stream: Readable,
    onPartial: (partial: string) => void,
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true });
      buffer += text;

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          onPartial(line);
          this.emit('partial:result', line);
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      onPartial(buffer);
      this.emit('partial:result', buffer);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(chunk: Buffer | string): void {
    const size = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);

    this.metrics.bytesProcessed += size;
    this.metrics.chunksProcessed++;
    this.metrics.averageChunkSize = this.metrics.bytesProcessed / this.metrics.chunksProcessed;

    if (this.startTime) {
      const elapsed = Date.now() - this.startTime.getTime();
      this.metrics.processingTime = elapsed;
      this.metrics.throughput = elapsed > 0 ? (this.metrics.bytesProcessed / elapsed) * 1000 : 0;
    }
  }

  /**
   * Check if backpressure should be applied
   */
  private shouldApplyBackpressure(): boolean {
    if (!this.options.highWaterMark) return false;

    const bufferSize = this.buffer.reduce((sum, buf) => sum + buf.length, 0);
    const threshold = this.options.highWaterMark * this.options.backpressureThreshold;

    return bufferSize > threshold;
  }

  /**
   * Handle backpressure
   */
  private async handleBackpressure(): Promise<void> {
    if (this.backpressureActive) return;

    this.backpressureActive = true;
    this.emit('backpressure:active');
    logger.debug('Backpressure active, pausing processing');

    // Wait for buffer to drain
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Clear some buffer
    const toClear = Math.floor(this.buffer.length / 2);
    this.buffer.splice(0, toClear);

    this.backpressureActive = false;
    this.emit('backpressure:released');
    logger.debug('Backpressure released, resuming processing');
  }

  /**
   * Start processing
   */
  private startProcessing(): void {
    this.isProcessing = true;
    this.startTime = new Date();
    this.resetMetrics();
    this.emit('processing:started');
  }

  /**
   * Stop processing
   */
  private stopProcessing(): void {
    this.isProcessing = false;

    if (this.startTime) {
      this.metrics.processingTime = Date.now() - this.startTime.getTime();
    }

    this.emit('processing:stopped', this.getMetrics());
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
          transform(chunk, encoding, callback) {
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
    const merged = new Readable({
      read() {
        // Implement merge logic
      },
    });

    let activeStreams = streams.length;

    streams.forEach((stream) => {
      stream.on('data', (chunk) => {
        merged.push(chunk);
      });

      stream.on('end', () => {
        activeStreams--;
        if (activeStreams === 0) {
          merged.push(null); // End the merged stream
        }
      });

      stream.on('error', (error) => {
        merged.destroy(error);
      });
    });

    return merged;
  }
}

// Export singleton instance
export const streamProcessor = new StreamProcessor();
