/**
 * SystemCommandFactory
 *
 * SystemCommandの依存関係注入・インスタンス化ファクトリ
 * 既存のMAIRA v3.5.0システムとの統合を管理
 */

import {
  SystemCommandBase,
  SystemCommandDependencies,
} from "../base/SystemCommandBase";
import { StatusCommandV2 } from "../../../shared/handlers/SlashCommandHandler";
import { NodeMonitoringAdapter } from "../adapters/NodeMonitoringAdapter";
import { AIProviderHealthAdapter } from "../adapters/AIProviderHealthAdapter";
import { ConfigPort } from "../ports/ConfigPort";
import { TimeSeriesPort } from "../ports/TimeSeriesPort";
import { ConfigCommandFactory } from "./ConfigCommandFactory";
import { ConfigPortAdapter } from "../adapters/ConfigPortAdapter";

// 既存システムからのインポート
import { AIProviderManager } from "../../../providers/manager";
import { ConfigManager } from "../../../config/config-manager";

/**
 * In-Memory Config Adapter(開発・テスト用)
 */
export class InMemoryConfigAdapter implements ConfigPort {
  private config = new Map<string, any>();
  private history: any[] = [];

  async get<T = any>(key: string): Promise<T | undefined> {
    return this.config.get(key);
  }

  async set(key: string, value: any, options: any = {}): Promise<void> {
    const oldValue = this.config.get(key);
    this.config.set(key, value);

    // 履歴記録
    this.history.push({
      timestamp: Date.now(),
      key,
      action: "set",
      oldValue,
      newValue: value,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.config.delete(key);
  }

  async list(prefix?: string): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const [key, value] of this.config) {
      if (!prefix || key.startsWith(prefix)) {
        result[key] = value;
      }
    }

    return result;
  }

  // その他のメソッドは基本実装
  async getLayered<T = any>(key: string): Promise<any> {
    return {
      value: await this.get(key),
      layers: {},
      source: "runtime" as const,
      merged: false,
    };
  }

  async setLayer(layer: any, key: string, value: any): Promise<void> {
    await this.set(`${layer}.${key}`, value);
  }

  async validate(config: any, schema?: string): Promise<any> {
    return { ok: true }; // 基本実装
  }

  async migrate(
    fromVersion: string,
    toVersion: string,
    dryRun?: boolean,
  ): Promise<any> {
    return { ok: true, fromVersion, toVersion, changes: [] };
  }

  async applyTemplate(templateId: string, options?: any): Promise<void> {
    // 基本実装
  }

  async listTemplates(): Promise<any[]> {
    return [];
  }

  async getHistory(key?: string, limit?: number): Promise<any[]> {
    let filtered = this.history;

    if (key) {
      filtered = filtered.filter((h) => h.key === key);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  async rollback(entryId: string): Promise<void> {
    // 基本実装
  }

  async getSchema(key: string): Promise<any> {
    return undefined;
  }

  async getVersion(): Promise<string> {
    return "1.0.0";
  }
}

/**
 * In-Memory TimeSeries Adapter(開発・テスト用)
 */
export class InMemoryTimeSeriesAdapter implements TimeSeriesPort {
  private data = new Map<
    string,
    Array<{ value: number; timestamp: number; tags?: Record<string, string> }>
  >();

  async record(
    metric: string,
    value: number,
    timestamp?: number,
    tags?: Record<string, string>,
  ): Promise<void> {
    if (!this.data.has(metric)) {
      this.data.set(metric, []);
    }

    this.data.get(metric)!.push({
      value,
      timestamp: timestamp || Date.now(),
      tags,
    });

    // 最新1000件のみ保持(メモリ節約)
    const entries = this.data.get(metric)!;
    if (entries.length > 1000) {
      entries.splice(0, entries.length - 1000);
    }
  }

  async recordBatch(entries: any[]): Promise<void> {
    for (const entry of entries) {
      await this.record(entry.metric, entry.value, entry.timestamp, entry.tags);
    }
  }

  async query(metric: string, options: any = {}): Promise<any> {
    const entries = this.data.get(metric) || [];
    return {
      metric,
      dataPoints: entries,
      metadata: {
        count: entries.length,
        startTime: entries[0]?.timestamp || 0,
        endTime: entries[entries.length - 1]?.timestamp || 0,
      },
    };
  }

  async queryMultiple(
    metrics: string[],
    options: any = {},
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const metric of metrics) {
      result[metric] = await this.query(metric, options);
    }

    return result;
  }

  async aggregate(
    metric: string,
    aggregation: any,
    options: any = {},
  ): Promise<any> {
    const entries = this.data.get(metric) || [];
    const values = entries.map((e) => e.value);

    let value = 0;
    switch (aggregation) {
      case "avg":
        value =
          values.length > 0
            ? values.reduce((sum, v) => sum + v, 0) / values.length
            : 0;
        break;
      case "sum":
        value = values.reduce((sum, v) => sum + v, 0);
        break;
      case "min":
        value = values.length > 0 ? Math.min(...values) : 0;
        break;
      case "max":
        value = values.length > 0 ? Math.max(...values) : 0;
        break;
      default:
        value = 0;
    }

    return {
      metric,
      aggregation,
      value,
      count: values.length,
      startTime: options.startTime || 0,
      endTime: options.endTime || Date.now(),
    };
  }

  async getTrends(metric: string, windowMs: number): Promise<any> {
    return {
      metric,
      trend: "stable" as const,
      slope: 0,
      confidence: 0.5,
      r2: 0.5,
      forecast: [],
      windowMs,
    };
  }

  async checkThresholds(metric: string): Promise<any[]> {
    return [];
  }

  async setThreshold(metric: string, threshold: any): Promise<void> {
    // 基本実装
  }

  async cleanup(olderThanMs: number): Promise<number> {
    let cleaned = 0;
    const cutoff = Date.now() - olderThanMs;

    for (const [metric, entries] of this.data) {
      const originalLength = entries.length;
      const filtered = entries.filter((e) => e.timestamp >= cutoff);

      this.data.set(metric, filtered);
      cleaned += originalLength - filtered.length;
    }

    return cleaned;
  }

  async getStorageMetrics(): Promise<any> {
    let totalDataPoints = 0;

    for (const entries of this.data.values()) {
      totalDataPoints += entries.length;
    }

    return {
      totalMetrics: this.data.size,
      totalDataPoints,
      diskUsageBytes: 0,
      memoryUsageBytes: totalDataPoints * 100, // 概算
      oldestDataPoint: 0,
      newestDataPoint: Date.now(),
      indexSize: 0,
    };
  }
}

/**
 * SystemCommandファクトリクラス
 */
export class SystemCommandFactory {
  private static instance: SystemCommandFactory | null = null;

  private providerManager: AIProviderManager | null = null;
  private configManager: ConfigManager | null = null;
  private dependencies: SystemCommandDependencies | null = null;
  private configCommandV2Factory: ConfigCommandFactory | null = null;

  /**
   * シングルトンインスタンス取得
   */
  static getInstance(): SystemCommandFactory {
    if (!SystemCommandFactory.instance) {
      SystemCommandFactory.instance = new SystemCommandFactory();
    }
    return SystemCommandFactory.instance;
  }

  /**
   * 既存システムコンポーネントを設定
   */
  setSystemComponents(
    providerManager: AIProviderManager,
    configManager: ConfigManager,
  ): void {
    this.providerManager = providerManager;
    this.configManager = configManager;

    // 依存関係を再構築
    this.buildDependencies();
  }

  /**
   * StatusCommandV2インスタンス作成
   */
  createStatusCommandV2(): StatusCommandV2 {
    const deps = this.getDependencies();
    return new StatusCommandV2(deps);
  }

  /**
   * ConfigCommandFactory取得
   */
  getConfigCommandFactory(): ConfigCommandFactory {
    if (!this.configCommandV2Factory) {
      this.configCommandV2Factory = new ConfigCommandFactory({
        enableLegacyCompatibility: true,
        initializeTemplates: true,
        enableInteractiveMode: true,
        defaultDryRun: false,
      });
    }
    return this.configCommandV2Factory;
  }

  /**
   * 依存関係構築
   */
  private buildDependencies(): void {
    // フォールバック用のデフォルト実装
    const defaultProviderManager =
      this.providerManager || new AIProviderManager();
    const defaultConfigManager = this.configManager || new ConfigManager();

    this.dependencies = {
      monitoringPort: new NodeMonitoringAdapter(),
      providerHealthPort: new AIProviderHealthAdapter(
        defaultProviderManager,
        defaultConfigManager,
      ),
      configPort: new ConfigPortAdapter(), // Use real ConfigPortAdapter instead of in-memory
      timeSeriesPort: new InMemoryTimeSeriesAdapter(),
    };
  }

  /**
   * 依存関係取得
   */
  private getDependencies(): SystemCommandDependencies {
    if (!this.dependencies) {
      this.buildDependencies();
    }
    return this.dependencies!;
  }

  /**
   * デフォルトシステム重み設定
   */
  async initializeDefaultConfig(): Promise<void> {
    const configPort = this.getDependencies().configPort;

    // ヘルススコア重み設定
    await configPort.set("system.health.weights", {
      cpu: 0.25,
      memory: 0.3,
      responseTime: 0.25,
      errorRate: 0.15,
      disk: 0.05,
    });

    // プロバイダ重み設定
    await configPort.set("system.provider.weights", {
      openai: 1.2,
      anthropic: 1.2,
      google: 1.0,
      groq: 0.8,
      grok: 0.8,
      ollama: 0.6,
      lmstudio: 0.6,
      vllm: 0.6,
    });
  }

  /**
   * ファクトリリセット(テスト用)
   */
  static resetInstance(): void {
    SystemCommandFactory.instance = null;
  }
}
