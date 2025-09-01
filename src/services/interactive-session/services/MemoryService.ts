/**
 * MemoryService - メモリシステム統合サービス
 *
 * DualMemoryEngineの初期化と管理を担当
 * System1(短期記憶)とSystem2(長期記憶)の統合制御
 */

import { DualMemoryEngine } from "../../../index.js";
import type { IMaria } from "@/types/maria.types";

export interface MemoryConfig {
  system1: {
    maxKnowledgeNodes?: number;
    maxContextSize?: number;
    ttl?: number;
  };
  system2: {
    maxReasoningTraces?: number;
    maxLongTermMemory?: number;
    persistenceEnabled?: boolean;
  };
}

export interface MemoryStatus {
  initialized: boolean;
  system1: {
    knowledgeNodes: number;
    contextSize: number;
    activeSessions: number;
  };
  system2: {
    reasoningTraces: number;
    longTermMemories: number;
    lastPersisted?: Date;
  };
  totalMemoryUsage: number;
}

export class MemoryService {
  private _engine: DualMemoryEngine | null = null;
  private _initializationPromise: Promise<void> | null = null;
  private _initialized = false;
  private _config: MemoryConfig;

  constructor(config?: Partial<MemoryConfig>) {
    this._config = this.mergeWithDefaults(config);
  }

  /**
   * メモリシステムの非同期初期化
   * 複数回呼ばれても単一のPromiseを返す
   */
  async initialize(maria: IMaria): Promise<void> {
    if (this._initialized) {
      return Promise.resolve();
    }

    if (this._initializationPromise) {
      return this._initializationPromise;
    }

    this._initializationPromise = this.performInitialization(maria);
    await this._initializationPromise;
    this._initialized = true;
    return Promise.resolve();
  }

  /**
   * メモリシステムの初期化実行
   */
  private async performInitialization(_maria: IMaria): Promise<void> {
    try {
      // DualMemoryEngineの初期化
      this._engine = new DualMemoryEngine({
        system1: {
          maxKnowledgeNodes: this._config.system1.maxKnowledgeNodes,
          maxContextSize: this._config.system1.maxContextSize,
          ttl: this._config.system1.ttl,
        },
        system2: {
          maxReasoningTraces: this._config.system2.maxReasoningTraces,
          maxLongTermMemory: this._config.system2.maxLongTermMemory,
          persistenceEnabled: this._config.system2.persistenceEnabled,
        },
      });

      // バックグラウンドでのウォームアップ
      this.warmupInBackground();
    } catch (error) {
      this._initialized = false;
      this._initializationPromise = null;
      throw new Error(`Memory system initialization failed: ${error}`);
    }
  }

  /**
   * バックグラウンドでのメモリウォームアップ
   */
  private warmupInBackground(): void {
    if (!this._engine) return;

    // 非ブロッキングでウォームアップ処理
    setImmediate(() => {
      try {
        // 初期コンテキストのロード
        this._engine?.loadInitialContext();

        // キャッシュのプリロード
        this._engine?.preloadCache();
      } catch (error) {
        // ウォームアップのエラーは警告のみ
        console.warn("Memory warmup warning:", error);
      }
    });
  }

  /**
   * 知識ノードの追加
   */
  async addKnowledge(
    key: string,
    value: any,
    metadata?: Record<string, any>,
  ): Promise<void> {
    if (!this._engine) {
      throw new Error("Memory system not initialized");
    }

    await this._engine.addKnowledge(key, value, metadata);
  }

  /**
   * コンテキストの更新
   */
  async updateContext(context: Record<string, any>): Promise<void> {
    if (!this._engine) {
      throw new Error("Memory system not initialized");
    }

    await this._engine.updateContext(context);
  }

  /**
   * 推論トレースの記録
   */
  async recordReasoning(trace: {
    input: string;
    reasoning: string[];
    output: string;
    confidence: number;
  }): Promise<void> {
    if (!this._engine) {
      throw new Error("Memory system not initialized");
    }

    await this._engine.recordReasoning(trace);
  }

  /**
   * メモリステータスの取得
   */
  getStatus(): MemoryStatus {
    if (!this._engine) {
      return {
        initialized: false,
        system1: {
          knowledgeNodes: 0,
          contextSize: 0,
          activeSessions: 0,
        },
        system2: {
          reasoningTraces: 0,
          longTermMemories: 0,
        },
        totalMemoryUsage: 0,
      };
    }

    const stats = this._engine.getStatistics();

    return {
      initialized: this._initialized,
      system1: {
        knowledgeNodes: stats.system1.knowledgeNodes,
        contextSize: stats.system1.contextSize,
        activeSessions: stats.system1.activeSessions,
      },
      system2: {
        reasoningTraces: stats.system2.reasoningTraces,
        longTermMemories: stats.system2.longTermMemories,
        lastPersisted: stats.system2.lastPersisted,
      },
      totalMemoryUsage: process.memoryUsage().heapUsed,
    };
  }

  /**
   * メモリのクリア
   */
  async clear(): Promise<void> {
    if (!this._engine) return;

    await this._engine.clear();
  }

  /**
   * メモリシステムのシャットダウン
   */
  async shutdown(): Promise<void> {
    if (!this._engine) return;

    // 永続化が有効な場合は保存
    if (this._config.system2.persistenceEnabled) {
      await this._engine.persist();
    }

    await this._engine.shutdown();
    this._engine = null;
    this._initialized = false;
    this._initializationPromise = null;
  }

  /**
   * デフォルト設定とのマージ
   */
  private mergeWithDefaults(config?: Partial<MemoryConfig>): MemoryConfig {
    return {
      system1: {
        maxKnowledgeNodes: 1000,
        maxContextSize: 100,
        ttl: 3600,
        ...config?.system1,
      },
      system2: {
        maxReasoningTraces: 100,
        maxLongTermMemory: 10000,
        persistenceEnabled: false,
        ...config?.system2,
      },
    };
  }

  /**
   * エンジンの取得(テスト用)
   */
  get engine(): DualMemoryEngine | null {
    return this._engine;
  }

  /**
   * 初期化状態の確認
   */
  get isInitialized(): boolean {
    return this._initialized;
  }
}
