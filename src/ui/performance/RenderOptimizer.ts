/**
 * Render Optimizer
 * パフォーマンス最適化とバッチレンダリングシステム
 */

// import { DESIGN_CONSTANTS } from '../optimized-design-system.js'; // TODO: Remove if unused

/**
 * レンダリングキュー項目
 */
interface RenderQueueItem {
  id: string;
  content: string | (() => string);
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
  debounce?: number;
}

/**
 * パフォーマンスメトリクス
 */
export interface PerformanceMetrics {
  renderTime: number;
  frameRate: number;
  memoryUsage: number;
  queueSize: number;
  droppedFrames: number;
}

/**
 * レンダリング最適化クラス
 */
export class RenderOptimizer {
  private static instance: RenderOptimizer;
  private renderQueue: Map<string, RenderQueueItem> = new Map();
  private frameTimer: NodeJS.Timeout | null = null;
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    frameRate: 60,
    memoryUsage: 0,
    queueSize: 0,
    droppedFrames: 0,
  };
  private lastRenderTime: number = Date.now();
  private frameCount: number = 0;
  private isRendering: boolean = false;

  // Performance thresholds
  private readonly TARGET_FPS = 60;
  private readonly FRAME_TIME = 1000 / this.TARGET_FPS; // ~16.67ms
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly BATCH_SIZE = 10;

  private constructor() {
    this.startFrameLoop();
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): RenderOptimizer {
    if (!this.instance) {
      this.instance = new RenderOptimizer();
    }
    return this.instance;
  }

  /**
   * レンダリングをキューに追加
   */
  queue(
    id: string,
    content: string | (() => string),
    options: {
      priority?: 'high' | 'normal' | 'low';
      debounce?: number;
    } = {},
  ): void {
    const _item: RenderQueueItem = {
      id,
      content,
      priority: options.priority || 'normal',
      timestamp: Date.now(),
      debounce: options.debounce,
    };

    // Debounce if specified
    if (options.debounce) {
      const _existing = this.renderQueue.get(id);
      if (existing && Date.now() - existing.timestamp < options.debounce) {
        return; // Skip this update
      }
    }

    this.renderQueue.set(id, item);
    this.metrics.queueSize = this.renderQueue.size;

    // Immediate render for high priority
    if (options.priority === 'high') {
      this.processQueue();
    }
  }

  /**
   * バッチレンダリング
   */
  batchRender(_items: Array<string | (() => string)>): void {
    const _batchId = `batch_${Date.now()}`;
    const _batchContent = () => {
      return items.map((item) => (typeof item === 'function' ? item() : item)).join('\n');
    };

    this.queue(batchId, batchContent, _{ priority: 'high' });
  }

  /**
   * フレームループを開始
   */
  private startFrameLoop(): void {
    this.frameTimer = setInterval(() => {
      this.processQueue();
      this.updateMetrics();
    }, this.FRAME_TIME);
  }

  /**
   * キューを処理
   */
  private processQueue(): void {
    if (this.isRendering || this.renderQueue.size === 0) {
      return;
    }

    this.isRendering = true;
    const _startTime = performance.now();

    try {
      // Sort by priority and timestamp
      const _sortedItems = Array.from(this.renderQueue.values()).sort((a, b) => {
        const _priorityOrder = { high: 0, _normal: 1, _low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.timestamp - b.timestamp;
      });

      // Process batch
      const _batch = sortedItems.slice(0, this.BATCH_SIZE);
      const _output: string[] = [];

      for (const item of batch) {
        const _content = typeof item.content === 'function' ? item.content() : item.content;
        output.push(content);
        this.renderQueue.delete(item.id);
      }

      // Render batch
      if (output.length > 0) {
        process.stdout.write(output.join(''));
      }

      // Update metrics
      const _renderTime = performance.now() - startTime;
      this.metrics.renderTime = renderTime;

      // Check for frame drops
      if (renderTime > this.FRAME_TIME) {
        this.metrics.droppedFrames++;
      }
    } finally {
      this.isRendering = false;
      this.frameCount++;
    }
  }

  /**
   * メトリクスを更新
   */
  private updateMetrics(): void {
    const _now = Date.now();
    const _deltaTime = now - this.lastRenderTime;

    if (deltaTime >= 1000) {
      // Calculate FPS
      this.metrics.frameRate = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastRenderTime = now;

      // Estimate memory usage
      if (global.gc) {
        global.gc();
      }
      const _memUsage = process.memoryUsage();
      this.metrics.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);
    }

    this.metrics.queueSize = this.renderQueue.size;
  }

  /**
   * レンダリングを強制実行
   */
  flush(): void {
    while (this.renderQueue.size > 0) {
      this.processQueue();
    }
  }

  /**
   * キューをクリア
   */
  clear(): void {
    this.renderQueue.clear();
    this.metrics.queueSize = 0;
  }

  /**
   * メトリクスを取得
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 最適化を停止
   */
  stop(): void {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
    this.flush();
  }

  /**
   * スマートレンダリング（条件付き）
   */
  smartRender(
    content: string | (() => string),
    condition: () => boolean,
    options: {
      maxRetries?: number;
      retryDelay?: number;
    } = {},
  ): void {
    const _maxRetries = options.maxRetries || 3;
    const _retryDelay = options.retryDelay || 100;
    let _retries = 0;

    const _attempt = () => {
      if (condition()) {
        const _finalContent = typeof content === 'function' ? content() : content;
        process.stdout.write(finalContent);
      } else if (retries < maxRetries) {
        retries++;
        setTimeout(attempt, retryDelay);
      }
    };

    attempt();
  }
}

/**
 * ターミナルバッファ管理
 */
export class TerminalBuffer {
  private buffer: string[] = [];
  private maxLines: number;
  private currentLine: number = 0;

  constructor(_maxLines: number = 1000) {
    this.maxLines = maxLines;
  }

  /**
   * バッファに追加
   */
  write(_content: string): void {
    const _lines = content.split('\n');
    this.buffer.push(...lines);

    // Trim excess lines
    if (this.buffer.length > this.maxLines) {
      this.buffer = this.buffer.slice(-this.maxLines);
    }

    this.currentLine = this.buffer.length;
  }

  /**
   * バッファをクリア
   */
  clear(): void {
    this.buffer = [];
    this.currentLine = 0;
    process.stdout.write('\x1b[2J\x1b[H'); // Clear screen and move to top
  }

  /**
   * 特定の行を更新
   */
  updateLine(_lineNumber: number, _content: string): void {
    if (lineNumber < 0 || lineNumber >= this.buffer.length) {
      return;
    }

    this.buffer[lineNumber] = content;

    // Move cursor and update
    const _moveUp = this.currentLine - lineNumber;
    if (moveUp > 0) {
      process.stdout.write(`\x1b[${moveUp}A`); // Move up
      process.stdout.write('\x1b[2K'); // Clear line
      process.stdout.write('\r' + content); // Write new content
      process.stdout.write(`\x1b[${moveUp}B`); // Move back down
    }
  }

  /**
   * バッファの内容を取得
   */
  getBuffer(): string[] {
    return [...this.buffer];
  }

  /**
   * スクロール
   */
  scroll(_lines: number): void {
    if (lines > 0) {
      // Scroll down
      process.stdout.write(`\x1b[${lines}S`);
    } else if (lines < 0) {
      // Scroll up
      process.stdout.write(`\x1b[${Math.abs(lines)}T`);
    }
  }
}

/**
 * メモリ効率的な文字列ビルダー
 */
export class StringBuilder {
  private chunks: string[] = [];
  private length: number = 0;

  /**
   * 文字列を追加
   */
  append(_str: string): StringBuilder {
    this.chunks.push(str);
    this.length += str.length;
    return this;
  }

  /**
   * 改行を追加
   */
  appendLine(_str: string = ''): StringBuilder {
    return this.append(str + '\n');
  }

  /**
   * 条件付き追加
   */
  appendIf(_condition: boolean, _str: string): StringBuilder {
    if (condition) {
      this.append(str);
    }
    return this;
  }

  /**
   * 繰り返し追加
   */
  repeat(_str: string, _count: number): StringBuilder {
    return this.append(str.repeat(count));
  }

  /**
   * 文字列を構築
   */
  toString(): string {
    return this.chunks.join('');
  }

  /**
   * クリア
   */
  clear(): void {
    this.chunks = [];
    this.length = 0;
  }

  /**
   * 長さを取得
   */
  getLength(): number {
    return this.length;
  }
}

/**
 * レンダリングヘルパー関数
 */
export const _RenderHelpers = {
  /**
   * デバウンス付きレンダリング
   */
  debounceRender(_fn: () => void, _delay: number = 100): (...args: unknown[]) => void {
    let timeoutId: NodeJS.Timeout;

    return (...args: unknown[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * スロットル付きレンダリング
   */
  throttleRender(_fn: () => void, _limit: number = 16): (...args: unknown[]) => void {
    let _inThrottle = false;

    return (...args: unknown[]) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * 仮想スクロール
   */
  virtualScroll(_items: string[], _viewportHeight: number, _scrollPosition: number): string[] {
    const _startIndex = Math.floor(scrollPosition);
    const _endIndex = Math.min(startIndex + viewportHeight, items.length);
    return items.slice(startIndex, endIndex);
  },

  /**
   * プログレッシブレンダリング
   */
  async progressiveRender(
    items: string[],
    batchSize: number = 10,
    delay: number = 0,
  ): Promise<void> {
    for (let _i = 0; i < items.length; i += batchSize) {
      const _batch = items.slice(i, i + batchSize);
      process.stdout.write(batch.join(''));

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  },
};

export default RenderOptimizer;
