/**
 * ConfigService - 設定管理サービス
 *
 * セッション設定の読み込み、検証、保存を管理
 * ユーザー設定とシステム設定の統合
 */

import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";

// 設定スキーマ定義
const SessionConfigSchema = z.object({
  ui: z
    .object({
      theme: z
        .enum(["default", "dark", "light", "solarized"])
        .default("default"),
      colors: z
        .object({
          primary: z.string().default("#00A8E8"),
          success: z.string().default("#00C851"),
          warning: z.string().default("#FFB300"),
          error: z.string().default("#FF3547"),
          info: z.string().default("#33B5E5"),
        })
        .default({}),
      spinner: z
        .object({
          style: z.enum(["dots", "line", "star", "square"]).default("dots"),
          color: z.string().default("cyan"),
        })
        .default({}),
      showTimestamps: z.boolean().default(false),
      showDebugInfo: z.boolean().default(false),
    })
    .default({}),

  behavior: z
    .object({
      autoApproval: z.boolean().default(false),
      confirmBeforeExit: z.boolean().default(true),
      historySize: z.number().min(0).max(10000).default(1000),
      commandTimeout: z.number().min(0).default(30000), // 30秒
      retryAttempts: z.number().min(0).max(10).default(3),
      streamingEnabled: z.boolean().default(true),
    })
    .default({}),

  memory: z
    .object({
      enablePersistence: z.boolean().default(false),
      maxMemoryUsage: z.number().min(0).default(512), // MB
      cacheSize: z.number().min(0).default(100), // MB
      gcInterval: z.number().min(0).default(300000), // 5分
    })
    .default({}),

  shortcuts: z.record(z.string()).default({
    clear: "cls",
    quit: "exit",
    h: "help",
    s: "status",
    m: "models",
  }),

  advanced: z
    .object({
      debugMode: z.boolean().default(false),
      verboseLogging: z.boolean().default(false),
      experimentalFeatures: z.boolean().default(false),
      telemetryEnabled: z.boolean().default(false),
    })
    .default({}),
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

export interface ConfigChangeEvent {
  path: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

export class ConfigService {
  private _config: SessionConfig;
  private _configPath: string;
  private _userConfigPath: string;
  private _listeners: Map<string, ((event: ConfigChangeEvent) => void)[]> =
    new Map();
  private _saveDebounceTimer: NodeJS.Timeout | null = null;
  private _isDirty = false;

  constructor(configDir: string = process.env.MARIA_CONFIG_DIR || "~/.maria") {
    this._configPath = path.join(
      this.expandHome(configDir),
      "session.config.json",
    );
    this._userConfigPath = path.join(
      this.expandHome(configDir),
      "user.config.json",
    );
    this._config = SessionConfigSchema.parse({});
  }

  /**
   * 設定の初期化と読み込み
   */
  async initialize(): Promise<void> {
    // システム設定の読み込み
    const systemConfig = await this.loadSystemConfig();

    // ユーザー設定の読み込み
    const userConfig = await this.loadUserConfig();

    // 設定のマージ(ユーザー設定を優先)
    this._config = this.mergeConfigs(systemConfig, userConfig);

    // 設定の検証
    this.validateConfig();

    // 自動保存の設定
    this.setupAutoSave();
  }

  /**
   * システム設定の読み込み
   */
  private async loadSystemConfig(): Promise<Partial<SessionConfig>> {
    try {
      const configFile = await fs.readFile(this._configPath, "utf-8");
      return JSON.parse(configFile);
    } catch (error) {
      // ファイルが存在しない場合はデフォルト値を使用
      return {};
    }
  }

  /**
   * ユーザー設定の読み込み
   */
  private async loadUserConfig(): Promise<Partial<SessionConfig>> {
    try {
      const configFile = await fs.readFile(this._userConfigPath, "utf-8");
      return JSON.parse(configFile);
    } catch (error) {
      // ファイルが存在しない場合はデフォルト値を使用
      return {};
    }
  }

  /**
   * 設定のマージ
   */
  private mergeConfigs(
    system: Partial<SessionConfig>,
    user: Partial<SessionConfig>,
  ): SessionConfig {
    const merged = {
      ...system,
      ...user,
      ui: { ...system.ui, ...user.ui },
      behavior: { ...system.behavior, ...user.behavior },
      memory: { ...system.memory, ...user.memory },
      shortcuts: { ...system.shortcuts, ...user.shortcuts },
      advanced: { ...system.advanced, ...user.advanced },
    };

    return SessionConfigSchema.parse(merged);
  }

  /**
   * 設定の検証
   */
  private validateConfig(): void {
    try {
      SessionConfigSchema.parse(this._config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Configuration validation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 設定値の取得
   */
  get<K extends keyof SessionConfig>(key: K): SessionConfig[K] {
    return this._config[key];
  }

  /**
   * ネストされた設定値の取得
   */
  getNestedValue(path: string): any {
    const keys = path.split(".");
    let value: any = this._config;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 設定値の更新
   */
  async set<K extends keyof SessionConfig>(
    key: K,
    value: SessionConfig[K],
  ): Promise<void> {
    const oldValue = this._config[key];
    this._config[key] = value;

    // 検証
    this.validateConfig();

    // 変更イベントの発火
    this.emitChange({
      path: key,
      oldValue,
      newValue: value,
      timestamp: new Date(),
    });

    // 保存フラグ
    this._isDirty = true;
    this.scheduleSave();
  }

  /**
   * ネストされた設定値の更新
   */
  async setNestedValue(path: string, value: any): Promise<void> {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    let target: any = this._config;

    for (const key of keys) {
      if (!(key in target)) {
        target[key] = {};
      }
      target = target[key];
    }

    const oldValue = target[lastKey];
    target[lastKey] = value;

    // 検証
    this.validateConfig();

    // 変更イベントの発火
    this.emitChange({
      path,
      oldValue,
      newValue: value,
      timestamp: new Date(),
    });

    this._isDirty = true;
    this.scheduleSave();
  }

  /**
   * 設定の保存
   */
  async save(): Promise<void> {
    if (!this._isDirty) return;

    try {
      // ディレクトリの作成
      const configDir = path.dirname(this._userConfigPath);
      await fs.mkdir(configDir, { recursive: true });

      // 設定の保存
      await fs.writeFile(
        this._userConfigPath,
        JSON.stringify(this._config, null, 2),
        "utf-8",
      );

      this._isDirty = false;
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * 自動保存のスケジューリング
   */
  private scheduleSave(): void {
    if (this._saveDebounceTimer) {
      clearTimeout(this._saveDebounceTimer);
    }

    this._saveDebounceTimer = setTimeout(() => {
      this.save().catch((error) => {
        console.error("Auto-save failed:", error);
      });
    }, 5000); // 5秒後に保存
  }

  /**
   * 自動保存の設定
   */
  private setupAutoSave(): void {
    // プロセス終了時の保存
    process.on("exit", () => {
      if (this._isDirty) {
        // 同期的に保存(exitイベントでは非同期処理不可)
        const fs = require("fs");
        fs.writeFileSync(
          this._userConfigPath,
          JSON.stringify(this._config, null, 2),
          "utf-8",
        );
      }
    });
  }

  /**
   * 変更リスナーの登録
   */
  onChange(
    path: string,
    listener: (event: ConfigChangeEvent) => void,
  ): () => void {
    if (!this._listeners.has(path)) {
      this._listeners.set(path, []);
    }

    this._listeners.get(path)!.push(listener);

    // アンサブスクライブ関数を返す
    return () => {
      const listeners = this._listeners.get(path);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * 変更イベントの発火
   */
  private emitChange(event: ConfigChangeEvent): void {
    // 完全一致のリスナー
    const exactListeners = this._listeners.get(event.path) || [];
    exactListeners.forEach((listener) => listener(event));

    // ワイルドカードリスナー
    const wildcardListeners = this._listeners.get("*") || [];
    wildcardListeners.forEach((listener) => listener(event));
  }

  /**
   * 設定のリセット
   */
  async reset(): Promise<void> {
    this._config = SessionConfigSchema.parse({});
    this._isDirty = true;
    await this.save();
  }

  /**
   * 設定のエクスポート
   */
  async export(filePath: string): Promise<void> {
    await fs.writeFile(
      filePath,
      JSON.stringify(this._config, null, 2),
      "utf-8",
    );
  }

  /**
   * 設定のインポート
   */
  async import(filePath: string): Promise<void> {
    const configFile = await fs.readFile(filePath, "utf-8");
    const importedConfig = JSON.parse(configFile);

    // 検証
    this._config = SessionConfigSchema.parse(importedConfig);
    this._isDirty = true;
    await this.save();
  }

  /**
   * ホームディレクトリの展開
   */
  private expandHome(filePath: string): string {
    if (filePath.startsWith("~/")) {
      return path.join(process.env.HOME || "", filePath.slice(2));
    }
    return filePath;
  }

  /**
   * 現在の設定を取得
   */
  get config(): SessionConfig {
    return { ...this._config };
  }
}
