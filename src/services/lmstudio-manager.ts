/**
 * LM Studio Manager - メイン管理クラス
 * Phase 1: 基礎検出システム + 自動起動システム
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import axios from 'axios';
import { LMStudioDetector } from './lmstudio-detector';
import { LMStudioHealthChecker, HealthStatus } from './lmstudio-health';
import { LMStudioConfigManager, LMStudioConfig } from './lmstudio-config';

export interface LMStudioStatus {
  isRunning: boolean;
  isHealthy: boolean;
  processId?: number;
  startTime?: Date;
  health?: HealthStatus;
  config: LMStudioConfig;
}

export interface StartupOptions {
  force?: boolean;
  verbose?: boolean;
  skipModelLoad?: boolean;
  timeout?: number;
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
   * LM Studioを起動（メイン機能）
   */
  async start(options: StartupOptions = {}): Promise<boolean> {
    try {
      // 設定が無効化されている場合はスキップ
      if (!this.config.enabled || !this.config.auto_start) {
        if (options.verbose) {
          console.log('🔒 LM Studio auto-start is disabled in configuration');
        }
        return false;
      }

      // 既に動作中かチェック
      if (!options.force && (await this.isRunning())) {
        if (options.verbose) {
          console.log('✅ LM Studio is already running');
        }
        return true;
      }

      // 実行ファイルを検出
      const execPath = await this.findExecutable();
      if (!execPath) {
        throw new Error(
          'LM Studio executable not found. Please install LM Studio or configure the path.',
        );
      }

      if (options.verbose) {
        console.log(`🔍 Found LM Studio at: ${execPath}`);
        console.log('🚀 Starting LM Studio...');
      }

      // プロセスを起動
      await this.spawnProcess(execPath);

      // 起動完了を待機
      const timeout = options.timeout || this.config.startup_timeout;
      const ready = await this.healthChecker.waitForReady(timeout, 1000);

      if (!ready) {
        throw new Error(`LM Studio failed to start within ${timeout}ms`);
      }

      if (options.verbose) {
        console.log('✨ LM Studio is ready!');
      }

      // デフォルトモデルを読み込み（オプション）
      if (!options.skipModelLoad && this.config.default_model) {
        await this.loadDefaultModel(options.verbose);
      }

      return true;
    } catch (error) {
      if (options.verbose) {
        console.error(
          '❌ Failed to start LM Studio:',
          error instanceof Error ? error.message : error,
        );
      }
      throw error;
    }
  }

  /**
   * LM Studioを停止
   */
  async stop(): Promise<boolean> {
    try {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGTERM');

        // プロセスの終了を待つ
        await new Promise<void>((resolve) => {
          if (!this.process) {
            resolve();
            return;
          }

          this.process.on('exit', () => {
            this.process = null;
            this.startTime = null;
            resolve();
          });

          // 5秒後に強制終了
          setTimeout(() => {
            if (this.process && !this.process.killed) {
              this.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to stop LM Studio:', error);
      return false;
    }
  }

  /**
   * LM Studioが実行中かチェック
   */
  async isRunning(): Promise<boolean> {
    return await this.healthChecker.isRunning();
  }

  /**
   * 詳細なステータスを取得
   */
  async getStatus(): Promise<LMStudioStatus> {
    const isRunning = await this.isRunning();
    let health: HealthStatus | undefined;

    if (isRunning) {
      try {
        health = await this.healthChecker.checkHealth();
      } catch (error) {
        // ヘルスチェックが失敗してもエラーにはしない
      }
    }

    return {
      isRunning,
      isHealthy: health?.isHealthy || false,
      processId: this.process?.pid,
      startTime: this.startTime ?? undefined,
      health,
      config: this.config,
    };
  }

  /**
   * モデルを読み込み
   */
  async loadModel(modelName: string, contextLength?: number): Promise<boolean> {
    try {
      if (!(await this.isRunning())) {
        throw new Error('LM Studio is not running');
      }

      const response = await axios.post(
        `${this.config.base_url}/v1/models/load`,
        {
          model: modelName,
          context_length: contextLength || this.config.context_length,
        },
        {
          timeout: 30000, // モデル読み込みは時間がかかる可能性がある
        },
      );

      return response.status === 200;
    } catch (error) {
      console.error(
        `Failed to load model ${modelName}:`,
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  }

  /**
   * 読み込まれているモデル一覧を取得
   */
  async getLoadedModels(): Promise<string[]> {
    try {
      const health = await this.healthChecker.checkHealth();
      return health.modelsLoaded;
    } catch (error) {
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
    const configPath = this.configManager.getExecutablePath(this.config);
    if (configPath && existsSync(configPath)) {
      return configPath;
    }

    // 2. 自動検出を試行
    const detection = await this.detector.detect();
    if (detection.found && detection.path) {
      return detection.path;
    }

    return null;
  }

  /**
   * プロセスを起動
   */
  private async spawnProcess(execPath: string): Promise<void> {
    const args = [];

    // 起動オプションを構築
    if (this.config.startup_options.headless) {
      args.push('--headless');
    }

    if (this.config.startup_options.port && this.config.startup_options.port !== 1234) {
      args.push('--port', this.config.startup_options.port.toString());
    }

    if (this.config.startup_options.host && this.config.startup_options.host !== 'localhost') {
      args.push('--host', this.config.startup_options.host);
    }

    if (this.config.startup_options.gpu_layers) {
      args.push('--gpu-layers', this.config.startup_options.gpu_layers.toString());
    }

    // プロセスを起動
    this.process = spawn(execPath, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.startTime = new Date();

    // エラーハンドリング
    this.process.on('error', (error) => {
      console.error('LM Studio process error:', error);
    });

    this.process.on('exit', (code, _signal) => {
      if (code !== 0 && code !== null) {
        console.error(`LM Studio exited with code ${code}`);
      }
      this.process = null;
      this.startTime = null;
    });

    // stdoutとstderrを監視（デバッグ用）
    if (this.process.stdout) {
      this.process.stdout.on('data', (_data) => {
        // 必要に応じてログ出力
        // console.log('LM Studio stdout:', data.toString());
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        // エラーログを出力
        console.error('LM Studio stderr:', data.toString());
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
        console.log(`⏳ Loading default model: ${this.config.default_model}...`);
      }

      const success = await this.loadModel(this.config.default_model);

      if (success && verbose) {
        console.log(`✅ Model loaded: ${this.config.default_model}`);
      } else if (!success && verbose) {
        console.warn(`⚠️ Failed to load default model: ${this.config.default_model}`);
      }
    } catch (error) {
      if (verbose) {
        console.warn(
          `⚠️ Failed to load default model: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
