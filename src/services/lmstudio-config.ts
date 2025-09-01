/**
 * LM Studio Configuration - 設定管理
 * Phase 1: 基礎検出システム
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import * as toml from "toml";

export interface LMStudioConfig {
  enabled: boolean;
  autostart: boolean;
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
  startupoptions: {
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
    this.configDir = configDir || join(homedir(), ".maria");
    this.configPath = join(this.configDir, ".maria-code.toml");

    this.defaultConfig = {
      enabled: true,
      autostart: true,
      startuptimeout: 30000,
      healthcheck_interval: 5000,
      contextlength: 32768,
      baseurl: "http://localhost:1234",
      paths: {
        mac: "/Applications/LM Studio.app/Contents/MacOS/LM Studio",
        windows: "C:\\Program Files\\LM Studio\\LM Studio.exe",
        linux: "/opt/lmstudio/lmstudio",
      },
      models: {
        preload: ["gpt-oss-20b"],
        maxconcurrent: 2,
      },
      startupoptions: {
        headless: true,
        port: 1234,
        host: "localhost",
      },
      retry: {
        maxattempts: 3,
        delayms: 1000,
        backoffmultiplier: 2,
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

      const _content = readFileSync(this.configPath, "utf-8");
      const _parsed = toml.parse(_content) as GlobalConfig;

      // デフォルト設定とマージ
      return this.mergeConfig(this.defaultConfig, _parsed.lmstudio || object);
    } catch (_error) {
      console.warn(`Failed to load LMStudio _config: ${_error}`);
      return this.defaultConfig;
    }
  }

  /**
   * 設定ファイルに保存
   */
  save(_config: Partial<LMStudioConfig>): void {
    try {
      // ディレクトリを作成
      if (!existsSync(this.configDir)) {
        mkdirSync(this.configDir, { recursive: true });
      }

      // 既存の設定をロード
      const _currentConfig = this.load();

      // 新しい設定をマージ
      const _mergedConfig = this.mergeConfig(_currentConfig, _config);

      // TOMLファイルとして保存
      const _tomlContent = this.configToToml({
        lmstudio: _mergedConfig,
      });

      writeFileSync(this.configPath, _tomlContent, "utf-8");
    } catch (_error) {
      console._error(`Failed to save LMStudio _config: ${_error}`);
      throw _error;
    }
  }

  /**
   * 環境変数からの設定オーバーライド
   */
  loadWithEnvironmentOverrides(): LMStudioConfig {
    const _config = this.load();

    // 環境変数による上書き
    if (process.env["LMSTUDIO_ENABLED"] !== undefined) {
      config.enabled = process.env["LMSTUDIO_ENABLED"] === "true";
    }

    if (process.env["LMSTUDIO_AUTO_START"] !== undefined) {
      config.auto_start = process.env["LMSTUDIO_AUTO_START"] === "true";
    }

    if (process.env["LMSTUDIO_BASE_URL"]) {
      config.base_url = process.env["LMSTUDIO_BASE_URL"];
    }

    if (process.env["LMSTUDIO_DEFAULT_MODEL"]) {
      config.default_model = process.env["LMSTUDIO_DEFAULT_MODEL"];
    }

    if (process.env["LMSTUDIO_STARTUP_TIMEOUT"]) {
      const _timeout = parseInt(process.env["LMSTUDIO_STARTUP_TIMEOUT"], 10);
      if (!isNaN(_timeout)) {
        config.startup_timeout = _timeout;
      }
    }

    if (process.env["LMSTUDIO_EXECUTABLE_PATH"]) {
      config.paths.custom = process.env["LMSTUDIO_EXECUTABLE_PATH"];
    }

    return _config;
  }

  /**
   * 設定の検証
   */
  validate(_config: LMStudioConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (_config.startup_timeout < 1000) {
      errors.push("startup_timeout must be at least 1000ms");
    }

    if (_config.health_check_interval < 1000) {
      errors.push("health_check_interval must be at least 1000ms");
    }

    if (_config.context_length < 1) {
      errors.push("context_length must be positive");
    }

    if (!_config.base_url.startsWith("http")) {
      errors.push("base_url must be a valid HTTP URL");
    }

    if (_config.models.max_concurrent < 1) {
      errors.push("max_concurrent must be at least 1");
    }

    if (_config.retry.max_attempts < 1) {
      errors.push("max_attempts must be at least 1");
    }

    if (_config.retry.delay_ms < 100) {
      errors.push("retry delay_ms must be at least 100ms");
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
  getExecutablePath(_config?: LMStudioConfig): string | undefined {
    const _cfg = _config || this.load();

    // カスタムパスが設定されている場合はそれを使用
    if (_cfg.paths.custom) {
      return _cfg.paths.custom;
    }

    // プラットフォーム別のデフォルトパス
    switch (process.platform) {
      case "darwin":
        return _cfg.paths.mac;
      case "win32":
        return _cfg.paths.windows;
      case "linux":
        return _cfg.paths.linux;
      default:
        return undefined;
    }
  }

  /**
   * 設定をマージ(深いマージ)
   */
  private mergeConfig(
    _base: LMStudioConfig,
    override: Partial<LMStudioConfig>,
  ): LMStudioConfig {
    return {
      ..._base,
      ...override,
      paths: {
        ..._base.paths,
        ...(override.paths || object),
      },
      models: {
        ..._base.models,
        ...(override.models || object),
      },
      startupoptions: {
        ..._base.startupoptions,
        ...(override.startupoptions || object),
      },
      retry: {
        ..._base.retry,
        ...(override.retry || object),
      },
    };
  }

  /**
   * 設定オブジェクトをTOML形式に変換
   */
  private configToToml(_config: GlobalConfig): string {
    const _lms = _config.lmstudio;

    return `# MARIA CODE - LM Studio Configuration

[lmstudio]
enabled = ${_lms.enabled}
auto_start = ${_lms.auto_start}
startup_timeout = ${_lms.startup_timeout}
health_check_interval = ${_lms.health_check_interval}
${_lms.default_model ? `default_model = "${_lms.default_model}"` : '# default_model = "gpt-oss-20b"'}
context_length = ${_lms.context_length}
base_url = "${_lms.base_url}"

[lmstudio.paths]
mac = "${_lms.paths.mac}"
windows = "${_lms.paths.windows}"
linux = "${_lms.paths.linux}"
${_lms.paths.custom ? `custom = "${_lms.paths.custom}"` : '# custom = "/path/to/lmstudio"'}

[lmstudio.models]
preload = ${JSON.stringify(_lms.models.preload)}
max_concurrent = ${_lms.models.max_concurrent}

[lmstudio.startupoptions]
headless = ${_lms.startupoptions.headless}
${_lms.startupoptions.port ? `port = ${_lms.startupoptions.port}` : "# port = 1234"}
${_lms.startupoptions.host ? `host = "${_lms.startupoptions.host}"` : '# host = "localhost"'}
${_lms.startupoptions.gpu_layers ? `gpu_layers = ${_lms.startupoptions.gpu_layers}` : "# gpu_layers = 32"}

[lmstudio.retry]
max_attempts = ${_lms.retry.max_attempts}
delay_ms = ${_lms.retry.delay_ms}
backoff_multiplier = ${_lms.retry.backoff_multiplier}
`;
  }
}
