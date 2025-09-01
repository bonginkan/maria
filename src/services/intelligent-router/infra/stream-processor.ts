/**
 * Stream Processor
 * ストリーミングレスポンスとチャンク単位の処理を管理
 */

import { Readable, Transform, Writable } from "stream";
import { EventEmitter } from "node:events";
import chalk from "chalk";
import { logger } from "../../utils/logger";

export interface StreamChunk {
  id: string;
  index: number;
  content: string;
  timestamp: Date;
  type: "_text" | "code" | "_data" | "_error" | "progress";
  metadata?: Record<string, unknown>;
}

export interface StreamProgress {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  eta?: number; // Estimated time remaining in ms
}

export class StreamProcessor extends EventEmitter {
  private _chunks: StreamChunk[] = [];
  private currentStream: Readable | null = null;
  private outputBuffer: string[] = [];
  private isStreaming: boolean = false;
  private chunkIndex: number = 0;
  private progressTrackers: Map<string, StreamProgress> = new Map();
  private transformers: Transform[] = [];
  private backpressureThreshold: number;
  private pausedStreams: Set<string> = new Set();

  constructor(_backpressureThreshold: number = 1000) {
    super();
    this._backpressureThreshold = _backpressureThreshold;
  }

  /**
   * ストリーミング処理を開始
   */
  async startStreaming(
    source: Readable | AsyncGenerator<string>,
    options: {
      _chunkSize?: number;
      encoding?: BufferEncoding;
      progressCallback?: (_progress: StreamProgress) => void;
    } = {},
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
      this.emit("stream:end");
    }
  }

  /**
   * Readableストリームを処理
   */
  private async processReadableStream(
    _stream: Readable,
    options: unknown,
  ): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      this.currentStream = _stream;
      let buffer = "";
      const _typedOptions = options as {
        _chunkSize?: number;
        encoding?: string;
      };
      const _chunkSize = _typedOptions._chunkSize || 100;

      // エンコーディング設定
      if (_typedOptions.encoding) {
        stream.setEncoding(_typedOptions.encoding as BufferEncoding);
      }

      // データチャンクの処理
      stream.on("_data", (_chunk: string | Buffer) => {
        const _text = _chunk.toString();
        buffer += _text;

        // バッファサイズチェック(バックプレッシャー制御)
        if (buffer.length > this.backpressureThreshold) {
          stream.pause();
          this.pausedStreams.add(
            _stream.readableObjectMode ? "object" : "buffer",
          );
          this.emit("backpressure:high", buffer.length);

          // バッファを処理してから再開
          setTimeout(() => {
            this.processBuffer(buffer, _chunkSize);
            buffer = "";
            stream.resume();
            this.pausedStreams.delete(
              _stream.readableObjectMode ? "object" : "buffer",
            );
            this.emit("backpressure:normal");
          }, 10);
        } else if (buffer.length >= _chunkSize) {
          // チャンクサイズに達したら処理
          const _processLength =
            Math.floor(buffer.length / _chunkSize) * _chunkSize;
          const _toProcess = buffer.slice(0, _processLength);
          buffer = buffer.slice(_processLength);
          this.processBuffer(_toProcess, _chunkSize);
        }
      });

      // エラー処理
      stream.on("_error", (_error) => {
        logger.error("Stream _error:", _error);
        this.emitChunk({
          type: "_error",
          content: error.message,
        });
        reject(_error);
      });

      // 終了処理
      stream.on("end", () => {
        // 残りのバッファを処理
        if (buffer.length > 0) {
          this.processBuffer(buffer, _chunkSize);
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
    options: unknown,
  ): Promise<void> {
    const _typedOptions = options as {
      _chunkSize?: number;
      progressCallback?: (_progress: number) => void;
    };
    const _chunkSize = _typedOptions._chunkSize || 100;
    let buffer = "";
    let totalProcessed = 0;
    const _estimatedTotal = 0;

    try {
      for await (const chunk of generator) {
        buffer += chunk;
        totalProcessed += chunk.length;

        // プログレス更新
        if (_typedOptions.progressCallback) {
          const progress: StreamProgress = {
            current: totalProcessed,
            total: _estimatedTotal || totalProcessed * 2, // 推定
            percentage: _estimatedTotal
              ? (totalProcessed / _estimatedTotal) * 100
              : 50,
            message: `Processing: ${totalProcessed} bytes`,
          };
          typedOptions.progressCallback(_progress.percentage);
          this.updateProgress("main", _progress);
        }

        // チャンク処理
        if (buffer.length >= _chunkSize) {
          const _processLength =
            Math.floor(buffer.length / _chunkSize) * _chunkSize;
          const _toProcess = buffer.slice(0, _processLength);
          buffer = buffer.slice(_processLength);
          await this.processBufferAsync(_toProcess, _chunkSize);
        }

        // バックプレッシャー制御
        if (this.outputBuffer.length > this.backpressureThreshold) {
          await this.waitForBufferDrain();
        }
      }

      // 残りのバッファを処理
      if (buffer.length > 0) {
        await this.processBufferAsync(buffer, _chunkSize);
      }
    } catch (_error: unknown) {
      logger.error("AsyncGenerator _error:", _error);
      this.emitChunk({
        type: "_error",
        content: _error instanceof Error ? _error.message : "Unknown _error",
      });
      throw _error;
    }
  }

  /**
   * バッファを処理
   */
  private processBuffer(_buffer: string, _chunkSize: number) {
    const _chunks = this.splitIntoChunks(_buffer, _chunkSize);
    chunks.forEach((chunk) => {
      this.emitChunk({
        type: "_text",
        content: chunk,
      });
    });
  }

  /**
   * バッファを非同期で処理
   */
  private async processBufferAsync(
    _buffer: string,
    _chunkSize: number,
  ): Promise<void> {
    const _chunks = this.splitIntoChunks(_buffer, _chunkSize);

    for (const chunk of _chunks) {
      // トランスフォーマーを適用
      let processedChunk = chunk;
      for (const transformer of this.transformers) {
        processedChunk = await this.applyTransformer(
          transformer,
          processedChunk,
        );
      }

      this.emitChunk({
        type: this.detectChunkType(processedChunk),
        content: processedChunk,
      });

      // 少し遅延を入れて負荷を分散
      await this.delay(1);
    }
  }

  /**
   * チャンクタイプを検出
   */
  private detectChunkType(content: string): StreamChunk["type"] {
    // コードブロックの検出
    if (/^```[\s\S]*```$/.test(content.trim())) {
      return "code";
    }

    // JSONデータの検出
    try {
      JSON.parse(content) as Record<string, unknown>;
      return "_data";
    } catch {
      // JSONではない
    }

    // プログレス情報の検出
    if (/^\[[\d.]+%\]/.test(content)) {
      return "progress";
    }

    return "_text";
  }

  /**
   * 文字列をチャンクに分割
   */
  private splitIntoChunks(_text: string, _chunkSize: number): string[] {
    const _chunks: string[] = [];
    const _lines = _text.split("\n");
    let currentChunk = "";

    for (const line of _lines) {
      if (
        currentChunk.length + line.length + 1 > _chunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return _chunks;
  }

  /**
   * チャンクを出力
   */
  private emitChunk(_options: {
    type: StreamChunk["type"];
    content: string;
    metadata?: Record<string, unknown>;
  }) {
    const chunk: StreamChunk = {
      id: this.generateChunkId(),
      index: this.chunkIndex++,
      content: _options.content,
      timestamp: new Date(),
      type: _options.type,
      metadata: _options.metadata,
    };

    this.chunks.push(chunk);
    this.outputBuffer.push(_options.content);
    this.emit("chunk", chunk);

    // タイプ別のイベント
    this.emit(`chunk:${_options.type}`, chunk);

    // 画面表示
    this.displayChunk(chunk);
  }

  /**
   * チャンクを画面に表示
   */
  private displayChunk(_chunk: StreamChunk) {
    switch (_chunk.type) {
      case "code":
        process.stdout.write(chalk.cyan(_chunk.content));
        break;
      case "_error":
        process.stdout.write(chalk.red(`\n❌ ${_chunk.content}\n`));
        break;
      case "progress":
        process.stdout.write(chalk.gray(`\r${_chunk.content}`));
        break;
      case "_data":
        // JSONデータは整形して表示
        try {
          const _data = JSON.parse(_chunk.content) as Record<string, unknown>;
          process.stdout.write(chalk.green(JSON.stringify(_data, null, 2)));
        } catch {
          process.stdout.write(_chunk.content);
        }
        break;
      default:
        process.stdout.write(_chunk.content);
    }
  }

  /**
   * トランスフォーマーを追加
   */
  addTransformer(_transformer: Transform) {
    this.transformers.push(_transformer);
  }

  /**
   * トランスフォーマーを適用
   */
  private async applyTransformer(
    _transformer: Transform,
    chunk: string,
  ): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      let result = "";

      transformer.on("_data", (_data) => {
        result += _data.toString();
      });

      transformer.on("end", () => {
        resolve(result);
      });

      _transformer.on("_error", reject);

      _transformer.write(chunk);
      transformer.end();
    });
  }

  /**
   * プログレスを更新
   */
  updateProgress(_id: string, progress: StreamProgress) {
    this.progressTrackers.set(_id, progress);
    this.emit("progress", { _id, ...progress });

    // プログレスバーを表示
    if (progress.message) {
      const _bar = this.createProgressBar(progress.percentage);
      process.stdout.write(
        `\r${_bar} ${progress.percentage.toFixed(1)}% - ${progress.message}`,
      );
    }
  }

  /**
   * プログレスバーを作成
   */
  private createProgressBar(percentage: number): string {
    const _width = 30;
    const _filled = Math.floor((percentage / 100) * _width);
    const _empty = _width - _filled;
    return `[${chalk.green("█".repeat(_filled))}${chalk.gray("░".repeat(_empty))}]`;
  }

  /**
   * バッファのドレインを待機
   */
  private async waitForBufferDrain(): Promise<void> {
    return new Promise((resolve) => {
      const _checkInterval = setInterval(() => {
        if (this.outputBuffer.length < this.backpressureThreshold / 2) {
          clearInterval(_checkInterval);
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
      this.emit("stream:paused");
    }
  }

  /**
   * ストリーミングを再開
   */
  resume() {
    if (this.currentStream && this.currentStream.isPaused()) {
      this.currentStream.resume();
      this.emit("stream:resumed");
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
    this.emit("stream:aborted");
  }

  /**
   * 部分結果を取得
   */
  getPartialResult(): string {
    return this.outputBuffer.join("");
  }

  /**
   * チャンク履歴を取得
   */
  getChunks(type?: StreamChunk["type"]): StreamChunk[] {
    if (type) {
      return this.chunks.filter((c) => c.type === type);
    }
    return [...this.chunks];
  }

  /**
   * 統計情報を取得
   */
  getStatistics() {
    const _textChunks = this.chunks.filter((c) => c.type === "_text").length;
    const _codeChunks = this.chunks.filter((c) => c.type === "code").length;
    const _errorChunks = this.chunks.filter((c) => c.type === "_error").length;
    const _totalBytes = this.outputBuffer.join("").length;

    return {
      totalChunks: this.chunks.length,
      _textChunks,
      _codeChunks,
      _errorChunks,
      _totalBytes,
      isStreaming: this.isStreaming,
      pausedStreams: this.pausedStreams.size,
      bufferSize: this.outputBuffer.length,
    };
  }

  /**
   * パイプラインを作成
   */
  createPipeline(...transforms: Transform[]): Writable {
    let pipeline = this.currentStream as Transform | Writable | undefined;

    for (const transform of transforms) {
      if (pipeline && pipeline.pipe) {
        pipeline = pipeline.pipe(transform);
      }
    }

    // 最終的な書き込みストリーム
    const _writeStream = new Writable({
      write: (chunk, _encoding, callback) => {
        this.emitChunk({
          type: "_text",
          content: chunk.toString(),
        });
        callback();
      },
    });

    if (pipeline && pipeline.pipe) {
      pipeline.pipe(_writeStream);
    }

    return _writeStream;
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
    return new Promise((resolve) => setTimeout(resolve, ms));
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
