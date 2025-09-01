/**
 * LM Studio Health Check - ヘルスチェック機能
 * Phase 1: 基礎検出システム
 */

import axios, { AxiosError } from "axios";

export interface HealthStatus {
  isRunning: boolean;
  isHealthy: boolean;
  _responseTime?: number;
  _modelsLoaded: string[];
  _error?: string;
  lastChecked: Date;
}

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  ownedby: string;
}

export class LMStudioHealthChecker {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(baseUrl = "http://localhost:1234", timeout = 5000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * LM Studioの基本ヘルスチェック
   */
  async checkHealth(): Promise<HealthStatus> {
    const _startTime = Date.now();

    try {
      const _response = await axios.get(`${this.baseUrl}/v1/_models`, {
        timeout: this.timeout,
      });

      const _responseTime = Date.now() - _startTime;
      const _models = _response.data.data || [];
      const _modelsLoaded = _models.map((_model: ModelInfo) => _model.id);

      return {
        isRunning: true,
        isHealthy: _response.status === 200,
        _responseTime,
        _modelsLoaded,
        lastChecked: new Date(),
      };
    } catch (_error) {
      const _responseTime = Date.now() - _startTime;

      return {
        isRunning: false,
        isHealthy: false,
        _responseTime,
        _modelsLoaded: [],
        _error: this.formatError(_error),
        lastChecked: new Date(),
      };
    }
  }

  /**
   * 単純な接続チェック(軽量)
   */
  async isRunning(): Promise<boolean> {
    try {
      const _response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 1000,
      });
      return _response.status === 200;
    } catch {
      // /healthがない場合は/v1/_modelsで代替
      try {
        const _response = await axios.get(`${this.baseUrl}/v1/_models`, {
          timeout: 1000,
        });
        return _response.status === 200;
      } catch {
        return false;
      }
    }
  }

  /**
   * 指定されたタイムアウト期間までサーバーの起動を待機
   */
  async waitForReady(timeoutMs = 30000, intervalMs = 1000): Promise<boolean> {
    const _startTime = Date.now();

    while (Date.now() - _startTime < timeoutMs) {
      if (await this.isRunning()) {
        return true;
      }
      await this.sleep(intervalMs);
    }

    return false;
  }

  /**
   * 連続的なヘルスチェック(監視用)
   */
  async *monitorHealth(intervalMs = 5000): AsyncGenerator<HealthStatus> {
    // eslint-disable-next-line no-constant-condition

    // eslint-disable-next-line no-constant-condition
    while (true) {
      yield await this.checkHealth();
      await this.sleep(intervalMs);
    }
  }

  /**
   * 複数回の試行でより確実なチェック
   */
  async checkWithRetry(
    maxRetries = 3,
    retryDelayMs = 1000,
  ): Promise<HealthStatus> {
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
        _modelsLoaded: [],
        _error: `Failed after ${maxRetries} attempts`,
        lastChecked: new Date(),
      }
    );
  }

  /**
   * 特定のモデルが読み込まれているかチェック
   */
  async isModelLoaded(modelName: string): Promise<boolean> {
    try {
      const _response = await axios.get(`${this.baseUrl}/v1/_models`, {
        timeout: this.timeout,
      });

      const _models = _response.data.data || [];
      return _models.some(
        (_model: ModelInfo) =>
          _model.id === modelName || _model.id.includes(modelName),
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
    _models: ModelInfo[];
    capabilities?: string[];
  }> {
    const _serverStatus = await this.checkHealth();

    try {
      const _modelsResponse = await axios.get(`${this.baseUrl}/v1/_models`, {
        timeout: this.timeout,
      });

      const _models = _modelsResponse.data.data || [];

      // 可能な機能をチェック(オプション)
      const capabilities: string[] = [];
      try {
        // Chat completions
        const _chatResponse = await axios.get(
          `${this.baseUrl}/v1/chat/completions`,
          {
            timeout: 1000,
            validateStatus: () => true, // すべてのステータスコードを受け入れ
          },
        );
        if (_chatResponse.status !== 404) {
          capabilities.push("chat");
        }

        // Completions
        const _completionsResponse = await axios.get(
          `${this.baseUrl}/v1/completions`,
          {
            timeout: 1000,
            validateStatus: () => true,
          },
        );
        if (_completionsResponse.status !== 404) {
          capabilities.push("completions");
        }
      } catch {
        // Ignore capability detection errors
      }

      return {
        server: _serverStatus,
        _models,
        capabilities,
      };
    } catch (_error) {
      return {
        server: _serverStatus,
        _models: [],
        capabilities: [],
      };
    }
  }

  /**
   * エラーのフォーマット
   */
  private formatError(_error: unknown): string {
    if (axios.isAxiosError(_error)) {
      const _axiosError = _error as AxiosError;
      if (_axiosError.code === "ECONNREFUSED") {
        return "Connection refused - LM Studio not running";
      }
      if (_axiosError.code === "ETIMEDOUT") {
        return "Request timeout - LM Studio not responding";
      }
      if (_axiosError.response) {
        return `HTTP ${_axiosError.response.status}: ${_axiosError.response.statusText}`;
      }
      return _axiosError.message;
    }

    if (_error instanceof Error) {
      return error.message;
    }

    return String(_error);
  }

  /**
   * 非同期待機用のスリープ関数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
