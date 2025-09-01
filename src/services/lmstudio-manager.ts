/**
 * LM Studio Manager - メイン管理クラス
 * Phase 1: 基礎検出システム + 自動起動システム
 */

import { ChildProcess, spawn } from "child_process";
import { existsSync } from "fs";
import axios from "axios";
import { LMStudioDetector } from "./lmstudio-detector";
import { HealthStatus, LMStudioHealthChecker } from "./lmstudio-_health";
import { LMStudioConfig, LMStudioConfigManager } from "./lmstudio-config";

export interface LMStudioStatus {
  _isRunning: boolean;
  isHealthy: boolean;
  processId?: number;
  startTime?: Date;
  _health?: HealthStatus;
  config: LMStudioConfig;
}

export interface StartupOptions {
  force?: boolean;
  verbose?: boolean;
  skipModelLoad?: boolean;
  _timeout?: number;
}

export class LMStudioManager {
  private process: ChildProcess | null = null;
  private detector: LMStudioDetector;
  private healthChecker: LMStudioHealthChecker;
  private configManager: LMStudioConfigManager;
  private config: LMStudioConfig;
  private startTime: Date | null = null;

  constructor(configDir?: string) {
    this.detector = new LMStudioDetector();
    this.configManager = new LMStudioConfigManager(configDir);
    this.config = this.configManager.loadWithEnvironmentOverrides();
    this.healthChecker = new LMStudioHealthChecker(
      this.config.base_url,
      this.config.health_check_interval,
    );
  }

  /**
   * LM Studioを起動(メイン機能)
   */
  async start(options: StartupOptions = {}): Promise<boolean> {
    try {
      // 設定が無効化されている場合はスキップ
      if (!this.config.enabled || !this.config.auto_start) {
        if (options.verbose) {
          console.log("🔒 LM Studio auto-start is disabled in configuration");
        }
        return false;
      }

      // 既に動作中かチェック
      if (!options.force && (await this.isRunning())) {
        if (options.verbose) {
          console.log("✅ LM Studio is already running");
        }
        return true;
      }

      // 実行ファイルを検出
      const _execPath = await this.findExecutable();
      if (!_execPath) {
        throw new Error(
          "LM Studio executable not found. Please install LM Studio or configure the path.",
        );
      }

      if (options.verbose) {
        console.log(`🔍 Found LM Studio at: ${_execPath}`);
        console.log("🚀 Starting LM Studio...");
      }

      // プロセスを起動
      await this.spawnProcess(_execPath);

      // 起動完了を待機
      const _timeout = options._timeout || this.config.startup_timeout;
      const _ready = await this.healthChecker.waitForReady(_timeout, 1000);

      if (!_ready) {
        throw new Error(`LM Studio failed to start within ${_timeout}ms`);
      }

      if (options.verbose) {
        console.log("✨ LM Studio is _ready!");
      }

      // デフォルトモデルを読み込み(オプション)
      if (!options.skipModelLoad && this.config.default_model) {
        await this.loadDefaultModel(options.verbose);
      }

      return true;
    } catch (_error) {
      if (options.verbose) {
        console._error(
          "❌ Failed to start LM Studio:",
          _error instanceof Error ? _error.message : _error,
        );
      }
      throw _error;
    }
  }

  /**
   * LM Studioを停止
   */
  async stop(): Promise<boolean> {
    try {
      if (this.process && !this.process.killed) {
        this.process.kill("SIGTERM");

        // プロセスの終了を待つ
        await new Promise<void>((resolve) => {
          if (!this.process) {
            resolve();
            return;
          }

          this.process.on("exit", () => {
            this.process = null;
            this.startTime = null;
            resolve();
          });

          // 5秒後に強制終了
          setTimeout(() => {
            if (this.process && !this.process.killed) {
              this.process.kill("SIGKILL");
            }
            resolve();
          }, 5000);
        });

        return true;
      }

      return false;
    } catch (_error) {
      console._error("Failed to stop LM Studio:", _error);
      return false;
    }
  }

  /**
   * LM Studioが実行中かチェック
   */
  async _isRunning(): Promise<boolean> {
    return await this.healthChecker.isRunning();
  }

  /**
   * 詳細なステータスを取得
   */
  async getStatus(): Promise<LMStudioStatus> {
    const _isRunning = await this._isRunning();
    let _health: HealthStatus | undefined;

    if (_isRunning) {
      try {
        _health = await this.healthChecker.checkHealth();
      } catch (_error) {
        // ヘルスチェックが失敗してもエラーにはしない
      }
    }

    return {
      _isRunning,
      isHealthy: _health?.isHealthy || false,
      processId: this.process?.pid,
      startTime: this.startTime ?? undefined,
      _health,
      config: this.config,
    };
  }

  /**
   * モデルを読み込み
   */
  async loadModel(
    _modelName: string,
    contextLength?: number,
  ): Promise<boolean> {
    try {
      if (!(await this.isRunning())) {
        throw new Error("LM Studio is not running");
      }

      const _response = await axios.post(
        `${this.config.base_url}/v1/models/load`,
        {
          model: _modelName,
          contextlength: contextLength || this.config.context_length,
        },
        {
          _timeout: 30000, // モデル読み込みは時間がかかる可能性がある
        },
      );

      return _response.status === 200;
    } catch (_error) {
      console._error(
        `Failed to load model ${_modelName}:`,
        _error instanceof Error ? _error.message : _error,
      );
      return false;
    }
  }

  /**
   * 読み込まれているモデル一覧を取得
   */
  async getLoadedModels(): Promise<string[]> {
    try {
      const _health = await this.healthChecker.checkHealth();
      return _health.modelsLoaded;
    } catch (_error) {
      return [];
    }
  }

  /**
   * 設定を再読み込み
   */
  reloadConfig(): void {
    this.config = this.configManager.loadWithEnvironmentOverrides();
    this.healthChecker = new LMStudioHealthChecker(
      this.config.base_url,
      this.config.health_check_interval,
    );
  }

  /**
   * 実行ファイルを検出
   */
  private async findExecutable(): Promise<string | null> {
    // 1. 設定で指定されたパスをチェック
    const _configPath = this.configManager.getExecutablePath(this.config);
    if (_configPath && existsSync(_configPath)) {
      return _configPath;
    }

    // 2. 自動検出を試行
    const _detection = await this.detector.detect();
    if (_detection.found && _detection._path) {
      return _detection.path;
    }

    return null;
  }

  /**
   * プロセスを起動
   */
  private async spawnProcess(_execPath: string): Promise<void> {
    const _args = [];

    // 起動オプションを構築
    if (this.config.startupoptions.headless) {
      args.push("--headless");
    }

    if (
      this.config.startupoptions.port &&
      this.config.startupoptions.port !== 1234
    ) {
      args.push("--port", this.config.startupoptions.port.toString());
    }

    if (
      this.config.startupoptions.host &&
      this.config.startupoptions.host !== "localhost"
    ) {
      args.push("--host", this.config.startupoptions.host);
    }

    if (this.config.startupoptions.gpu_layers) {
      args.push(
        "--gpu-layers",
        this.config.startupoptions.gpu_layers.toString(),
      );
    }

    // プロセスを起動
    this.process = spawn(_execPath, _args, {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.startTime = new Date();

    // エラーハンドリング
    this.process.on("_error", (_error) => {
      console.error("LM Studio process _error:", _error);
    });

    this.process.on("exit", (code, _signal) => {
      if (code !== 0 && code !== null) {
        console.error(`LM Studio exited with code ${code}`);
      }
      this.process = null;
      this.startTime = null;
    });

    // stdoutとstderrを監視(デバッグ用)
    if (this.process.stdout) {
      this.process.stdout.on("data", (_data) => {
        // 必要に応じてログ出力
        // console.log('LM Studio stdout:', data.toString());
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on("data", (data) => {
        // エラーログを出力
        console.error("LM Studio stderr:", data.toString());
      });
    }
  }

  /**
   * デフォルトモデルを読み込み
   */
  private async loadDefaultModel(verbose = false): Promise<void> {
    if (!this.config.default_model) {
      return;
    }

    try {
      if (verbose) {
        console.log(
          `⏳ Loading default model: ${this.config.default_model}...`,
        );
      }

      const _success = await this.loadModel(this.config.default_model);

      if (_success && verbose) {
        console.log(`✅ Model loaded: ${this.config.default_model}`);
      } else if (!_success && verbose) {
        console.warn(
          `⚠️ Failed to load default model: ${this.config.default_model}`,
        );
      }
    } catch (_error) {
      if (verbose) {
        console.warn(
          `⚠️ Failed to load default model: ${_error instanceof Error ? _error.message : _error}`,
        );
      }
    }
  }
}
