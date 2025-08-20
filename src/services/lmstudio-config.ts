/**
 * LM Studio Configuration - 設定管理
 * Phase 1: 基礎検出システム
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as toml from 'toml';

export interface LMStudioConfig {
  enabled: boolean;
  auto_start: boolean;
  startup_timeout: number;
  health_check_interval: number;
  default_model?: string;
  context_length: number;
  base_url: string;
  paths: {
    mac: string;
    windows: string;
    linux: string;
    custom?: string;
  };
  models: {
    preload: string[];
    max_concurrent: number;
  };
  startup_options: {
    headless: boolean;
    port?: number;
    host?: string;
    gpu_layers?: number;
  };
  retry: {
    max_attempts: number;
    delay_ms: number;
    backoff_multiplier: number;
  };
}

export interface GlobalConfig {
  lmstudio: LMStudioConfig;
}

export class LMStudioConfigManager {
  private readonly configDir: string;
  private readonly configPath: string;
  private readonly defaultConfig: LMStudioConfig;

  constructor(configDir?: string) {
    this.configDir = configDir || join(homedir(), '.maria');
    this.configPath = join(this.configDir, '.maria-code.toml');

    this.defaultConfig = {
      enabled: true,
      auto_start: true,
      startup_timeout: 30000,
      health_check_interval: 5000,
      context_length: 32768,
      base_url: 'http://localhost:1234',
      paths: {
        mac: '/Applications/LM Studio.app/Contents/MacOS/LM Studio',
        windows: 'C:\\Program Files\\LM Studio\\LM Studio.exe',
        linux: '/opt/lmstudio/lmstudio',
      },
      models: {
        preload: ['gpt-oss-20b'],
        max_concurrent: 2,
      },
      startup_options: {
        headless: true,
        port: 1234,
        host: 'localhost',
      },
      retry: {
        max_attempts: 3,
        delay_ms: 1000,
        backoff_multiplier: 2,
      },
    };
  }

  /**
   * 設定ファイルを読み込み
   */
  load(): LMStudioConfig {
    try {
      if (!existsSync(this.configPath)) {
        return this.defaultConfig;
      }

      const content = readFileSync(this.configPath, 'utf-8');
      const parsed = toml.parse(content) as GlobalConfig;

      // デフォルト設定とマージ
      return this.mergeConfig(this.defaultConfig, parsed.lmstudio || {});
    } catch (error) {
      console.warn(`Failed to load LMStudio config: ${error}`);
      return this.defaultConfig;
    }
  }

  /**
   * 設定ファイルに保存
   */
  save(config: Partial<LMStudioConfig>): void {
    try {
      // ディレクトリを作成
      if (!existsSync(this.configDir)) {
        mkdirSync(this.configDir, { recursive: true });
      }

      // 既存の設定をロード
      const currentConfig = this.load();

      // 新しい設定をマージ
      const mergedConfig = this.mergeConfig(currentConfig, config);

      // TOMLファイルとして保存
      const tomlContent = this.configToToml({
        lmstudio: mergedConfig,
      });

      writeFileSync(this.configPath, tomlContent, 'utf-8');
    } catch (error) {
      console.error(`Failed to save LMStudio config: ${error}`);
      throw error;
    }
  }

  /**
   * 環境変数からの設定オーバーライド
   */
  loadWithEnvironmentOverrides(): LMStudioConfig {
    const config = this.load();

    // 環境変数による上書き
    if (process.env['LMSTUDIO_ENABLED'] !== undefined) {
      config.enabled = process.env['LMSTUDIO_ENABLED'] === 'true';
    }

    if (process.env['LMSTUDIO_AUTO_START'] !== undefined) {
      config.auto_start = process.env['LMSTUDIO_AUTO_START'] === 'true';
    }

    if (process.env['LMSTUDIO_BASE_URL']) {
      config.base_url = process.env['LMSTUDIO_BASE_URL'];
    }

    if (process.env['LMSTUDIO_DEFAULT_MODEL']) {
      config.default_model = process.env['LMSTUDIO_DEFAULT_MODEL'];
    }

    if (process.env['LMSTUDIO_STARTUP_TIMEOUT']) {
      const timeout = parseInt(process.env['LMSTUDIO_STARTUP_TIMEOUT'], 10);
      if (!isNaN(timeout)) {
        config.startup_timeout = timeout;
      }
    }

    if (process.env['LMSTUDIO_EXECUTABLE_PATH']) {
      config.paths.custom = process.env['LMSTUDIO_EXECUTABLE_PATH'];
    }

    return config;
  }

  /**
   * 設定の検証
   */
  validate(config: LMStudioConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.startup_timeout < 1000) {
      errors.push('startup_timeout must be at least 1000ms');
    }

    if (config.health_check_interval < 1000) {
      errors.push('health_check_interval must be at least 1000ms');
    }

    if (config.context_length < 1) {
      errors.push('context_length must be positive');
    }

    if (!config.base_url.startsWith('http')) {
      errors.push('base_url must be a valid HTTP URL');
    }

    if (config.models.max_concurrent < 1) {
      errors.push('max_concurrent must be at least 1');
    }

    if (config.retry.max_attempts < 1) {
      errors.push('max_attempts must be at least 1');
    }

    if (config.retry.delay_ms < 100) {
      errors.push('retry delay_ms must be at least 100ms');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * デフォルト設定をリセット
   */
  reset(): void {
    this.save(this.defaultConfig);
  }

  /**
   * 現在の設定と利用可能な設定オプションを取得
   */
  getInfo(): {
    current: LMStudioConfig;
    configPath: string;
    exists: boolean;
  } {
    return {
      current: this.load(),
      configPath: this.configPath,
      exists: existsSync(this.configPath),
    };
  }

  /**
   * プラットフォーム固有の実行パスを取得
   */
  getExecutablePath(config?: LMStudioConfig): string | undefined {
    const cfg = config || this.load();

    // カスタムパスが設定されている場合はそれを使用
    if (cfg.paths.custom) {
      return cfg.paths.custom;
    }

    // プラットフォーム別のデフォルトパス
    switch (process.platform) {
      case 'darwin':
        return cfg.paths.mac;
      case 'win32':
        return cfg.paths.windows;
      case 'linux':
        return cfg.paths.linux;
      default:
        return undefined;
    }
  }

  /**
   * 設定をマージ（深いマージ）
   */
  private mergeConfig(base: LMStudioConfig, override: Partial<LMStudioConfig>): LMStudioConfig {
    return {
      ...base,
      ...override,
      paths: {
        ...base.paths,
        ...(override.paths || {}),
      },
      models: {
        ...base.models,
        ...(override.models || {}),
      },
      startup_options: {
        ...base.startup_options,
        ...(override.startup_options || {}),
      },
      retry: {
        ...base.retry,
        ...(override.retry || {}),
      },
    };
  }

  /**
   * 設定オブジェクトをTOML形式に変換
   */
  private configToToml(config: GlobalConfig): string {
    const lms = config.lmstudio;

    return `# MARIA CODE - LM Studio Configuration

[lmstudio]
enabled = ${lms.enabled}
auto_start = ${lms.auto_start}
startup_timeout = ${lms.startup_timeout}
health_check_interval = ${lms.health_check_interval}
${lms.default_model ? `default_model = "${lms.default_model}"` : '# default_model = "gpt-oss-20b"'}
context_length = ${lms.context_length}
base_url = "${lms.base_url}"

[lmstudio.paths]
mac = "${lms.paths.mac}"
windows = "${lms.paths.windows}"
linux = "${lms.paths.linux}"
${lms.paths.custom ? `custom = "${lms.paths.custom}"` : '# custom = "/path/to/lmstudio"'}

[lmstudio.models]
preload = ${JSON.stringify(lms.models.preload)}
max_concurrent = ${lms.models.max_concurrent}

[lmstudio.startup_options]
headless = ${lms.startup_options.headless}
${lms.startup_options.port ? `port = ${lms.startup_options.port}` : '# port = 1234'}
${lms.startup_options.host ? `host = "${lms.startup_options.host}"` : '# host = "localhost"'}
${lms.startup_options.gpu_layers ? `gpu_layers = ${lms.startup_options.gpu_layers}` : '# gpu_layers = 32'}

[lmstudio.retry]
max_attempts = ${lms.retry.max_attempts}
delay_ms = ${lms.retry.delay_ms}
backoff_multiplier = ${lms.retry.backoff_multiplier}
`;
  }
}
