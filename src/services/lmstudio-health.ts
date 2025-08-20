/**
 * LM Studio Health Check - ヘルスチェック機能
 * Phase 1: 基礎検出システム
 */

import axios, { AxiosError } from 'axios';

export interface HealthStatus {
  isRunning: boolean;
  isHealthy: boolean;
  responseTime?: number;
  modelsLoaded: string[];
  error?: string;
  lastChecked: Date;
}

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export class LMStudioHealthChecker {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl = 'http://localhost:1234', timeout = 5000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * LM Studioの基本ヘルスチェック
   */
  async checkHealth(): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      const response = await axios.get(`${this.baseUrl}/v1/models`, {
        timeout: this.timeout,
      });

      const responseTime = Date.now() - startTime;
      const models = response.data.data || [];
      const modelsLoaded = models.map((model: ModelInfo) => model.id);

      return {
        isRunning: true,
        isHealthy: response.status === 200,
        responseTime,
        modelsLoaded,
        lastChecked: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        isRunning: false,
        isHealthy: false,
        responseTime,
        modelsLoaded: [],
        error: this.formatError(error),
        lastChecked: new Date(),
      };
    }
  }

  /**
   * 単純な接続チェック（軽量）
   */
  async isRunning(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 1000,
      });
      return response.status === 200;
    } catch {
      // /healthがない場合は/v1/modelsで代替
      try {
        const response = await axios.get(`${this.baseUrl}/v1/models`, {
          timeout: 1000,
        });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  }

  /**
   * 指定されたタイムアウト期間までサーバーの起動を待機
   */
  async waitForReady(timeoutMs = 30000, intervalMs = 1000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (await this.isRunning()) {
        return true;
      }
      await this.sleep(intervalMs);
    }

    return false;
  }

  /**
   * 連続的なヘルスチェック（監視用）
   */
  async *monitorHealth(intervalMs = 5000): AsyncGenerator<HealthStatus> {
    while (true) {
      yield await this.checkHealth();
      await this.sleep(intervalMs);
    }
  }

  /**
   * 複数回の試行でより確実なチェック
   */
  async checkWithRetry(maxRetries = 3, retryDelayMs = 1000): Promise<HealthStatus> {
    let lastStatus: HealthStatus | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      lastStatus = await this.checkHealth();

      if (lastStatus.isHealthy) {
        return lastStatus;
      }

      if (attempt < maxRetries) {
        await this.sleep(retryDelayMs);
      }
    }

    return (
      lastStatus || {
        isRunning: false,
        isHealthy: false,
        modelsLoaded: [],
        error: `Failed after ${maxRetries} attempts`,
        lastChecked: new Date(),
      }
    );
  }

  /**
   * 特定のモデルが読み込まれているかチェック
   */
  async isModelLoaded(modelName: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/models`, {
        timeout: this.timeout,
      });

      const models = response.data.data || [];
      return models.some(
        (model: ModelInfo) => model.id === modelName || model.id.includes(modelName),
      );
    } catch {
      return false;
    }
  }

  /**
   * サーバーの詳細ステータス取得
   */
  async getDetailedStatus(): Promise<{
    server: HealthStatus;
    models: ModelInfo[];
    capabilities?: string[];
  }> {
    const serverStatus = await this.checkHealth();

    try {
      const modelsResponse = await axios.get(`${this.baseUrl}/v1/models`, {
        timeout: this.timeout,
      });

      const models = modelsResponse.data.data || [];

      // 可能な機能をチェック（オプション）
      const capabilities: string[] = [];
      try {
        // Chat completions
        const chatResponse = await axios.get(`${this.baseUrl}/v1/chat/completions`, {
          timeout: 1000,
          validateStatus: () => true, // すべてのステータスコードを受け入れ
        });
        if (chatResponse.status !== 404) {
          capabilities.push('chat');
        }

        // Completions
        const completionsResponse = await axios.get(`${this.baseUrl}/v1/completions`, {
          timeout: 1000,
          validateStatus: () => true,
        });
        if (completionsResponse.status !== 404) {
          capabilities.push('completions');
        }
      } catch {
        // Ignore capability detection errors
      }

      return {
        server: serverStatus,
        models,
        capabilities,
      };
    } catch (error) {
      return {
        server: serverStatus,
        models: [],
        capabilities: [],
      };
    }
  }

  /**
   * エラーのフォーマット
   */
  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.code === 'ECONNREFUSED') {
        return 'Connection refused - LM Studio not running';
      }
      if (axiosError.code === 'ETIMEDOUT') {
        return 'Request timeout - LM Studio not responding';
      }
      if (axiosError.response) {
        return `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`;
      }
      return axiosError.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  /**
   * 非同期待機用のスリープ関数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
