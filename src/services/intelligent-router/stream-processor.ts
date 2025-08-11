/**
 * Stream Processor
 * ストリーミングレスポンスとチャンク単位の処理を管理
 */

import { Transform, Readable, Writable } from 'stream';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { logger } from '../../utils/logger';

export interface StreamChunk {
  id: string;
  index: number;
  content: string;
  timestamp: Date;
  type: 'text' | 'code' | 'data' | 'error' | 'progress';
  metadata?: Record<string, any>;
}

export interface StreamProgress {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  eta?: number; // Estimated time remaining in ms
}

export class StreamProcessor extends EventEmitter {
  private chunks: StreamChunk[] = [];
  private currentStream: Readable | null = null;
  private outputBuffer: string[] = [];
  private isStreaming: boolean = false;
  private chunkIndex: number = 0;
  private progressTrackers: Map<string, StreamProgress> = new Map();
  private transformers: Transform[] = [];
  private backpressureThreshold: number;
  private pausedStreams: Set<string> = new Set();

  constructor(backpressureThreshold: number = 1000) {
    super();
    this.backpressureThreshold = backpressureThreshold;
  }

  /**
   * ストリーミング処理を開始
   */
  async startStreaming(
    source: Readable | AsyncGenerator<string>,
    options: {
      chunkSize?: number;
      encoding?: BufferEncoding;
      progressCallback?: (progress: StreamProgress) => void;
    } = {}
  ): Promise<void> {
    this.isStreaming = true;
    this.chunkIndex = 0;
    this.chunks = [];
    this.outputBuffer = [];

    try {
      if (source instanceof Readable) {
        await this.processReadableStream(source, options);
      } else {
        await this.processAsyncGenerator(source, options);
      }
    } finally {
      this.isStreaming = false;
      this.emit('stream:end');
    }
  }

  /**
   * Readableストリームを処理
   */
  private async processReadableStream(
    stream: Readable,
    options: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.currentStream = stream;
      let buffer = '';
      const chunkSize = options.chunkSize || 100;

      // エンコーディング設定
      if (options.encoding) {
        stream.setEncoding(options.encoding);
      }

      // データチャンクの処理
      stream.on('data', (chunk: string | Buffer) => {
        const text = chunk.toString();
        buffer += text;

        // バッファサイズチェック（バックプレッシャー制御）
        if (buffer.length > this.backpressureThreshold) {
          stream.pause();
          this.pausedStreams.add(stream.readableObjectMode ? 'object' : 'buffer');
          this.emit('backpressure:high', buffer.length);
          
          // バッファを処理してから再開
          setTimeout(() => {
            this.processBuffer(buffer, chunkSize);
            buffer = '';
            stream.resume();
            this.pausedStreams.delete(stream.readableObjectMode ? 'object' : 'buffer');
            this.emit('backpressure:normal');
          }, 10);
        } else if (buffer.length >= chunkSize) {
          // チャンクサイズに達したら処理
          const processLength = Math.floor(buffer.length / chunkSize) * chunkSize;
          const toProcess = buffer.slice(0, processLength);
          buffer = buffer.slice(processLength);
          this.processBuffer(toProcess, chunkSize);
        }
      });

      // エラー処理
      stream.on('error', (error) => {
        logger.error('Stream error:', error);
        this.emitChunk({
          type: 'error',
          content: error.message
        });
        reject(error);
      });

      // 終了処理
      stream.on('end', () => {
        // 残りのバッファを処理
        if (buffer.length > 0) {
          this.processBuffer(buffer, chunkSize);
        }
        resolve();
      });
    });
  }

  /**
   * AsyncGeneratorを処理
   */
  private async processAsyncGenerator(
    generator: AsyncGenerator<string>,
    options: any
  ): Promise<void> {
    const chunkSize = options.chunkSize || 100;
    let buffer = '';
    let totalProcessed = 0;
    let estimatedTotal = 0;

    try {
      for await (const chunk of generator) {
        buffer += chunk;
        totalProcessed += chunk.length;

        // プログレス更新
        if (options.progressCallback) {
          const progress: StreamProgress = {
            current: totalProcessed,
            total: estimatedTotal || totalProcessed * 2, // 推定
            percentage: estimatedTotal ? (totalProcessed / estimatedTotal) * 100 : 50,
            message: `Processing: ${totalProcessed} bytes`
          };
          options.progressCallback(progress);
          this.updateProgress('main', progress);
        }

        // チャンク処理
        if (buffer.length >= chunkSize) {
          const processLength = Math.floor(buffer.length / chunkSize) * chunkSize;
          const toProcess = buffer.slice(0, processLength);
          buffer = buffer.slice(processLength);
          await this.processBufferAsync(toProcess, chunkSize);
        }

        // バックプレッシャー制御
        if (this.outputBuffer.length > this.backpressureThreshold) {
          await this.waitForBufferDrain();
        }
      }

      // 残りのバッファを処理
      if (buffer.length > 0) {
        await this.processBufferAsync(buffer, chunkSize);
      }
    } catch (error) {
      logger.error('AsyncGenerator error:', error);
      this.emitChunk({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * バッファを処理
   */
  private processBuffer(buffer: string, chunkSize: number) {
    const chunks = this.splitIntoChunks(buffer, chunkSize);
    chunks.forEach(chunk => {
      this.emitChunk({
        type: 'text',
        content: chunk
      });
    });
  }

  /**
   * バッファを非同期で処理
   */
  private async processBufferAsync(buffer: string, chunkSize: number): Promise<void> {
    const chunks = this.splitIntoChunks(buffer, chunkSize);
    
    for (const chunk of chunks) {
      // トランスフォーマーを適用
      let processedChunk = chunk;
      for (const transformer of this.transformers) {
        processedChunk = await this.applyTransformer(transformer, processedChunk);
      }

      this.emitChunk({
        type: this.detectChunkType(processedChunk),
        content: processedChunk
      });

      // 少し遅延を入れて負荷を分散
      await this.delay(1);
    }
  }

  /**
   * チャンクタイプを検出
   */
  private detectChunkType(content: string): StreamChunk['type'] {
    // コードブロックの検出
    if (/^```[\s\S]*```$/.test(content.trim())) {
      return 'code';
    }
    
    // JSONデータの検出
    try {
      JSON.parse(content);
      return 'data';
    } catch {
      // JSONではない
    }

    // プログレス情報の検出
    if (/^\[[\d.]+%\]/.test(content)) {
      return 'progress';
    }

    return 'text';
  }

  /**
   * 文字列をチャンクに分割
   */
  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const lines = text.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * チャンクを出力
   */
  private emitChunk(options: {
    type: StreamChunk['type'];
    content: string;
    metadata?: Record<string, any>;
  }) {
    const chunk: StreamChunk = {
      id: this.generateChunkId(),
      index: this.chunkIndex++,
      content: options.content,
      timestamp: new Date(),
      type: options.type,
      metadata: options.metadata
    };

    this.chunks.push(chunk);
    this.outputBuffer.push(options.content);
    this.emit('chunk', chunk);

    // タイプ別のイベント
    this.emit(`chunk:${options.type}`, chunk);

    // 画面表示
    this.displayChunk(chunk);
  }

  /**
   * チャンクを画面に表示
   */
  private displayChunk(chunk: StreamChunk) {
    switch (chunk.type) {
      case 'code':
        process.stdout.write(chalk.cyan(chunk.content));
        break;
      case 'error':
        process.stdout.write(chalk.red(`\n❌ ${chunk.content}\n`));
        break;
      case 'progress':
        process.stdout.write(chalk.gray(`\r${chunk.content}`));
        break;
      case 'data':
        // JSONデータは整形して表示
        try {
          const data = JSON.parse(chunk.content);
          process.stdout.write(chalk.green(JSON.stringify(data, null, 2)));
        } catch {
          process.stdout.write(chunk.content);
        }
        break;
      default:
        process.stdout.write(chunk.content);
    }
  }

  /**
   * トランスフォーマーを追加
   */
  addTransformer(transformer: Transform) {
    this.transformers.push(transformer);
  }

  /**
   * トランスフォーマーを適用
   */
  private async applyTransformer(transformer: Transform, chunk: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let result = '';
      
      transformer.on('data', (data) => {
        result += data.toString();
      });

      transformer.on('end', () => {
        resolve(result);
      });

      transformer.on('error', reject);

      transformer.write(chunk);
      transformer.end();
    });
  }

  /**
   * プログレスを更新
   */
  updateProgress(id: string, progress: StreamProgress) {
    this.progressTrackers.set(id, progress);
    this.emit('progress', { id, ...progress });

    // プログレスバーを表示
    if (progress.message) {
      const bar = this.createProgressBar(progress.percentage);
      process.stdout.write(`\r${bar} ${progress.percentage.toFixed(1)}% - ${progress.message}`);
    }
  }

  /**
   * プログレスバーを作成
   */
  private createProgressBar(percentage: number): string {
    const width = 30;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    return `[${chalk.green('█'.repeat(filled))}${chalk.gray('░'.repeat(empty))}]`;
  }

  /**
   * バッファのドレインを待機
   */
  private async waitForBufferDrain(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.outputBuffer.length < this.backpressureThreshold / 2) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);
    });
  }

  /**
   * ストリーミングを一時停止
   */
  pause() {
    if (this.currentStream && !this.currentStream.isPaused()) {
      this.currentStream.pause();
      this.emit('stream:paused');
    }
  }

  /**
   * ストリーミングを再開
   */
  resume() {
    if (this.currentStream && this.currentStream.isPaused()) {
      this.currentStream.resume();
      this.emit('stream:resumed');
    }
  }

  /**
   * ストリーミングを中止
   */
  abort() {
    if (this.currentStream) {
      this.currentStream.destroy();
      this.currentStream = null;
    }
    this.isStreaming = false;
    this.emit('stream:aborted');
  }

  /**
   * 部分結果を取得
   */
  getPartialResult(): string {
    return this.outputBuffer.join('');
  }

  /**
   * チャンク履歴を取得
   */
  getChunks(type?: StreamChunk['type']): StreamChunk[] {
    if (type) {
      return this.chunks.filter(c => c.type === type);
    }
    return [...this.chunks];
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    const textChunks = this.chunks.filter(c => c.type === 'text').length;
    const codeChunks = this.chunks.filter(c => c.type === 'code').length;
    const errorChunks = this.chunks.filter(c => c.type === 'error').length;
    const totalBytes = this.outputBuffer.join('').length;

    return {
      totalChunks: this.chunks.length,
      textChunks,
      codeChunks,
      errorChunks,
      totalBytes,
      isStreaming: this.isStreaming,
      pausedStreams: this.pausedStreams.size,
      bufferSize: this.outputBuffer.length
    };
  }

  /**
   * パイプラインを作成
   */
  createPipeline(...transforms: Transform[]): Writable {
    let pipeline = this.currentStream as any;
    
    for (const transform of transforms) {
      if (pipeline) {
        pipeline = pipeline.pipe(transform);
      }
    }

    // 最終的な書き込みストリーム
    const writeStream = new Writable({
      write: (chunk, encoding, callback) => {
        this.emitChunk({
          type: 'text',
          content: chunk.toString()
        });
        callback();
      }
    });

    if (pipeline) {
      pipeline.pipe(writeStream);
    }

    return writeStream;
  }

  /**
   * チャンクIDを生成
   */
  private generateChunkId(): string {
    return `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 遅延を作成
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * バッファをクリア
   */
  clearBuffer() {
    this.outputBuffer = [];
    this.chunks = [];
    this.chunkIndex = 0;
  }

  /**
   * ストリーミング状態を確認
   */
  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }
}