/**
 * SystemCommandBase
 *
 * 全SystemCommandの基底クラス
 * 契約遵守・Port注入・エラーハンドリングの統一実装
 */

import {
  SystemCommandContract,
  CommandResultV2,
  ExecutionOptions,
} from "../contracts/SystemCommandContract";
import { MonitoringPort } from "../ports/MonitoringPort";
import { ProviderHealthPort } from "../ports/ProviderHealthPort";
import { ConfigPort } from "../ports/ConfigPort";
import { TimeSeriesPort } from "../ports/TimeSeriesPort";

export interface SystemCommandDependencies {
  monitoringPort: MonitoringPort;
  providerHealthPort: ProviderHealthPort;
  configPort: ConfigPort;
  timeSeriesPort: TimeSeriesPort;
}

export abstract class SystemCommandBase implements SystemCommandContract {
  // 契約固定化(無限ループ根絶)
  readonly requiresInput = false as const;

  // Port注入(責務分離・テスト容易性)
  protected readonly monitoringPort: MonitoringPort;
  protected readonly providerHealthPort: ProviderHealthPort;
  protected readonly configPort: ConfigPort;
  protected readonly timeSeriesPort: TimeSeriesPort;

  // タイムアウト管理
  public deadlineAt?: number;
  public signal?: AbortSignal;

  // コマンド情報(子クラスで設定)
  public abstract readonly name: string;
  public abstract readonly category: string;
  public abstract readonly description: string;

  constructor(dependencies: SystemCommandDependencies) {
    this.monitoringPort = dependencies.monitoringPort;
    this.providerHealthPort = dependencies.providerHealthPort;
    this.configPort = dependencies.configPort;
    this.timeSeriesPort = dependencies.timeSeriesPort;
  }

  /**
   * 契約遵守のexecute実装
   * 全子クラス共通のエラーハンドリング・メトリクス記録
   */
  async execute(): Promise<CommandResultV2> {
    const startTime = Date.now();
    const operationName = `system.${this.name}.execute`;

    try {
      // デッドライン・シグナルチェック
      this.checkCancellation();

      // 開始メトリクス記録
      this.monitoringPort.recordEvent(`${operationName}.start`, {
        command: this.name,
        deadline: this.deadlineAt,
        hasSignal: !!this.signal,
      });

      // 子クラスの実装を呼び出し
      const result = await this.executeInternal({
        deadlineAt: this.deadlineAt,
        signal: this.signal,
      });

      const duration = Date.now() - startTime;

      // 成功メトリクス記録
      this.monitoringPort.recordLatency(operationName, duration);
      this.monitoringPort.recordEvent(`${operationName}.success`, {
        command: this.name,
        duration,
      });

      return {
        endReason: "success",
        data: result,
        duration,
        timestamp: Date.now(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const endReason = this.determineEndReason(error);

      // エラーメトリクス記録
      this.monitoringPort.recordLatency(`${operationName}.error`, duration);
      this.monitoringPort.recordEvent(`${operationName}.error`, {
        command: this.name,
        endReason,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        endReason,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 子クラスが実装する内部処理
   * タイムアウト・キャンセレーションを考慮した実装が必要
   */
  protected abstract executeInternal(options: ExecutionOptions): Promise<any>;

  /**
   * キャンセレーション状態チェック
   */
  protected checkCancellation(): void {
    // デッドライン超過チェック
    if (this.deadlineAt && Date.now() > this.deadlineAt) {
      throw new Error("TIMEOUT_ERROR");
    }

    // AbortSignalチェック
    if (this.signal?.aborted) {
      throw new Error("ABORT_ERROR");
    }
  }

  /**
   * タイムアウト付きPromise実行
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("TIMEOUT_ERROR"));
      }, timeoutMs);

      // Node.js環境でのunref(ブラウザ互換性維持)
      if (typeof (timer as any).unref === "function") {
        (timer as any).unref();
      }
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * キャンセレーション対応Promise実行
   */
  protected async withCancellation<T>(promise: Promise<T>): Promise<T> {
    if (!this.signal) return promise;

    return new Promise<T>((resolve, reject) => {
      // AbortSignal監視
      const abortHandler = () => {
        reject(new Error("ABORT_ERROR"));
      };

      if (this.signal!.aborted) {
        reject(new Error("ABORT_ERROR"));
        return;
      }

      this.signal!.addEventListener("abort", abortHandler, { once: true });

      promise.then(resolve, reject).finally(() => {
        this.signal!.removeEventListener("abort", abortHandler);
      });
    });
  }

  /**
   * エラーからendReasonを決定
   */
  private determineEndReason(error: any): "timeout" | "cancel" | "error" {
    if (error instanceof Error) {
      if (error.message === "TIMEOUT_ERROR") return "timeout";
      if (error.message === "ABORT_ERROR") return "cancel";
      if (error.name === "TimeoutError") return "timeout";
      if (error.name === "AbortError") return "cancel";
    }
    return "error";
  }

  /**
   * 設定値取得ヘルパー
   */
  protected async getConfig<T>(key: string, defaultValue?: T): Promise<T> {
    const value = await this.configPort.get<T>(key);
    return value !== undefined ? value : (defaultValue as T);
  }

  /**
   * システムメトリクス取得ヘルパー
   */
  protected async getSystemMetrics(timeoutMs = 5000) {
    return this.withTimeout(
      this.monitoringPort.getSystemMetrics(timeoutMs),
      timeoutMs,
    );
  }

  /**
   * プロバイダヘルス取得ヘルパー
   */
  protected async getProviderHealth(
    level: "fast" | "normal" | "deep" = "normal",
  ) {
    const timeouts = { fast: 50, normal: 400, deep: 3000 };
    return this.withTimeout(
      this.providerHealthPort.probeAll({ level, timeoutMs: timeouts[level] }),
      timeouts[level] + 100, // 少し余裕を持たせる
    );
  }
}

/**
 * エラークラス定義
 */
export class SystemCommandError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly command: string,
  ) {
    super(message);
    this.name = "SystemCommandError";
  }
}

export class SystemCommandTimeoutError extends SystemCommandError {
  constructor(command: string, timeoutMs: number) {
    super(
      `Command '${command}' timed out after ${timeoutMs}ms`,
      "TIMEOUT",
      command,
    );
    this.name = "SystemCommandTimeoutError";
  }
}

export class SystemCommandCancelledError extends SystemCommandError {
  constructor(command: string) {
    super(`Command '${command}' was cancelled`, "CANCELLED", command);
    this.name = "SystemCommandCancelledError";
  }
}
