/**
 * Command Recommendation Configuration System
 * スラッシュコマンド推薦システム設定管理
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { logger } from "../utils/logger";

export interface CommandRecommendationConfig {
  // Core settings
  maxSuggestions: number;
  minInputLength: number;
  enableUsageTracking: boolean;
  enablePartialMatching: boolean;
  debounceDelay: number;
  cacheExpiry: number;

  // UI settings
  ui: {
    maxVisibleItems: number;
    showCategories: boolean;
    showScores: boolean;
    showUsage: boolean;
    compactMode: boolean;
    width: number;
    enableAnimations: boolean;
  };

  // Search algorithm settings
  search: {
    enableFuzzyMatching: boolean;
    fuzzyThreshold: number;
    contextualWeighting: boolean;
    timeBasedWeighting: boolean;
    sequenceAnalysis: boolean;
  };

  // Performance settings
  performance: {
    enableCaching: boolean;
    cacheSize: number;
    indexingParallel: boolean;
    lazyLoading: boolean;
    backgroundSave: boolean;
  };

  // Privacy settings
  privacy: {
    enableAnalytics: boolean;
    shareUsageStats: boolean;
    anonymizeData: boolean;
    retentionDays: number;
  };

  // Advanced features
  advanced: {
    enableAIRecommendations: boolean;
    learningRate: number;
    adaptiveSuggestions: boolean;
    contextualHelp: boolean;
    voiceActivation: boolean;
  };
}

export const DEFAULT_CONFIG: CommandRecommendationConfig = {
  // Core settings
  maxSuggestions: 10,
  minInputLength: 1,
  enableUsageTracking: true,
  enablePartialMatching: true,
  debounceDelay: 100,
  cacheExpiry: 300000, // 5 minutes

  // UI settings
  ui: {
    maxVisibleItems: 10,
    showCategories: true,
    showScores: false,
    showUsage: false,
    compactMode: false,
    width: 80,
    enableAnimations: true,
  },

  // Search algorithm settings
  search: {
    enableFuzzyMatching: true,
    fuzzyThreshold: 0.7,
    contextualWeighting: true,
    timeBasedWeighting: true,
    sequenceAnalysis: true,
  },

  // Performance settings
  performance: {
    enableCaching: true,
    cacheSize: 100,
    indexingParallel: true,
    lazyLoading: true,
    backgroundSave: true,
  },

  // Privacy settings
  privacy: {
    enableAnalytics: true,
    shareUsageStats: false,
    anonymizeData: true,
    retentionDays: 30,
  },

  // Advanced features
  advanced: {
    enableAIRecommendations: false,
    learningRate: 0.1,
    adaptiveSuggestions: true,
    contextualHelp: true,
    voiceActivation: false,
  },
};

export class CommandRecommendationConfigManager {
  private static instance: CommandRecommendationConfigManager;
  private _config: CommandRecommendationConfig;
  private configPath: string;
  private isLoaded: boolean = false;
  private listeners: Array<(_config: CommandRecommendationConfig) => void> = [];

  private constructor() {
    this._config = { ...DEFAULT_CONFIG };
    this.configPath = path.join(
      os.homedir(),
      ".maria",
      "command-recommendation.json",
    );
  }

  public static getInstance(): CommandRecommendationConfigManager {
    if (!CommandRecommendationConfigManager.instance) {
      CommandRecommendationConfigManager.instance =
        new CommandRecommendationConfigManager();
    }
    return CommandRecommendationConfigManager.instance;
  }

  /**
   * 設定を初期化
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      await this.loadConfig();
      this.isLoaded = true;
      logger.info("CommandRecommendationConfigManager initialized");
    } catch (error) {
      logger.error("Failed to initialize config manager:", error);
      this.isLoaded = false;
    }
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): CommandRecommendationConfig {
    return { ...this._config };
  }

  /**
   * 設定を更新
   */
  async updateConfig(
    updates: Partial<CommandRecommendationConfig>,
  ): Promise<void> {
    const previousConfig = { ...this._config };

    try {
      // Deep merge the configuration
      this._config = this.deepMerge(this._config, updates);

      // Validate configuration
      this.validateConfig(this._config);

      // Save to file
      await this.saveConfig();

      // Notify listeners
      this.notifyListeners(this._config);

      logger.info("Configuration updated successfully");
    } catch (innerError) {
      // Revert on error
      this._config = previousConfig;
      logger.error("Failed to update configuration:", error);
      throw error;
    }
  }

  /**
   * 設定をリセット
   */
  async resetConfig(): Promise<void> {
    this._config = { ...DEFAULT_CONFIG };
    await this.saveConfig();
    this.notifyListeners(this._config);
    logger.info("Configuration reset to defaults");
  }

  /**
   * 設定変更リスナーを追加
   */
  addConfigListener(
    listener: (config: CommandRecommendationConfig) => void,
  ): void {
    this.listeners.push(listener);
  }

  /**
   * 設定変更リスナーを削除
   */
  removeConfigListener(
    listener: (config: CommandRecommendationConfig) => void,
  ): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 設定をエクスポート
   */
  exportConfig(): string {
    return JSON.stringify(this._config, null, 2);
  }

  /**
   * 設定をインポート
   */
  async importConfig(configJson: string): Promise<void> {
    try {
      const importedConfig = JSON.parse(configJson);
      this.validateConfig(importedConfig);

      await this.updateConfig(importedConfig);
      logger.info("Configuration imported successfully");
    } catch (error) {
      logger.error("Failed to import configuration:", error);
      throw new Error("Invalid configuration format");
    }
  }

  /**
   * プリセット設定を適用
   */
  async applyPreset(
    presetName: "minimal" | "standard" | "advanced" | "power-user",
  ): Promise<void> {
    const presets = {
      minimal: {
        maxSuggestions: 5,
        ui: { maxVisibleItems: 5, compactMode: true, showCategories: false },
        search: { enableFuzzyMatching: false },
        performance: { cacheSize: 50 },
        advanced: {
          enableAIRecommendations: false,
          adaptiveSuggestions: false,
        },
      },
      standard: DEFAULT_CONFIG,
      advanced: {
        maxSuggestions: 15,
        ui: { maxVisibleItems: 15, showScores: true, showUsage: true },
        search: { enableFuzzyMatching: true, contextualWeighting: true },
        performance: { cacheSize: 200 },
        advanced: { enableAIRecommendations: true, adaptiveSuggestions: true },
      },
      "power-user": {
        maxSuggestions: 20,
        minInputLength: 0,
        ui: {
          maxVisibleItems: 20,
          showScores: true,
          showUsage: true,
          compactMode: false,
          enableAnimations: true,
        },
        search: {
          enableFuzzyMatching: true,
          fuzzyThreshold: 0.5,
          contextualWeighting: true,
          timeBasedWeighting: true,
          sequenceAnalysis: true,
        },
        performance: { cacheSize: 500, indexingParallel: true },
        advanced: {
          enableAIRecommendations: true,
          learningRate: 0.2,
          adaptiveSuggestions: true,
          contextualHelp: true,
        },
      },
    };

    await this.updateConfig(presets[presetName]);
    logger.info(`Applied preset: ${presetName}`);
  }

  /**
   * 設定の健全性チェック
   */
  validateConfig(config: unknown): void {
    const errors: string[] = [];

    // Basic validation
    if (
      typeof _config.maxSuggestions !== "number" ||
      _config.maxSuggestions < 1 ||
      _config.maxSuggestions > 50
    ) {
      errors.push("maxSuggestions must be between 1 and 50");
    }

    if (
      typeof _config.minInputLength !== "number" ||
      _config.minInputLength < 0 ||
      _config.minInputLength > 5
    ) {
      errors.push("minInputLength must be between 0 and 5");
    }

    if (
      typeof _config.debounceDelay !== "number" ||
      _config.debounceDelay < 0 ||
      _config.debounceDelay > 1000
    ) {
      errors.push("debounceDelay must be between 0 and 1000");
    }

    // UI validation
    if (_config.ui && typeof _config.ui.maxVisibleItems !== "number") {
      errors.push("ui.maxVisibleItems must be a number");
    }

    // Performance validation
    if (
      _config.performance &&
      typeof _config.performance.cacheSize !== "number"
    ) {
      errors.push("performance.cacheSize must be a number");
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(", ")}`);
    }
  }

  /**
   * 設定統計を取得
   */
  getConfigStats(): {
    isLoaded: boolean;
    configPath: string;
    lastModified?: Date;
    preset: string;
    customizations: number;
  } {
    const defaultKeys = this.flattenObject(DEFAULT_CONFIG);
    const currentKeys = this.flattenObject(this._config);

    let customizations = 0;
    for (const key in currentKeys) {
      if (
        JSON.stringify(defaultKeys[key]) !== JSON.stringify(currentKeys[key])
      ) {
        customizations++;
      }
    }

    const preset = this.detectPreset();

    return {
      isLoaded: this.isLoaded,
      configPath: this.configPath,
      preset,
      customizations,
    };
  }

  // ================================
  // PRIVATE METHODS
  // ================================

  /**
   * 設定ディレクトリを確保
   */
  private async ensureConfigDirectory(): Promise<void> {
    const configDir = path.dirname(this.configPath);
    try {
      await fs.access(configDir);
    } catch (innerError) {
      if ((error as any).code === "ENOENT") {
        // File doesn't exist, use defaults and save
        await this.saveConfig();
        logger.info("Created new configuration file with defaults");
      } else {
        logger.error("Failed to load configuration:", error);
        throw error;
      }
    }
  }

  /**
   * 設定を保存
   */
  private async saveConfig(): Promise<void> {
    try {
      const data = JSON.stringify(this._config, null, 2);
      await fs.writeFile(this.configPath, data, "utf-8");
      logger.debug("Configuration saved to file");
    } catch (error) {
      logger.error("Failed to save configuration:", error);
      throw error;
    }
  }

  /**
   * リスナーに通知
   */
  private notifyListeners(config: CommandRecommendationConfig): void {
    this.listeners.forEach((listener) => {
      try {
        listener(_config);
      } catch (innerError) {
        logger.error("Config listener error:", error);
      }
    });
  }

  /**
   * ディープマージ
   */
  private deepMerge(target: unknown, source: unknown): unknown {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || object, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * オブジェクトをフラット化
   */
  private flattenObject(obj: unknown, prefix = ""): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (
        obj[key] &&
        typeof obj[key] === "object" &&
        !Array.isArray(obj[key])
      ) {
        Object.assign(flattened, this.flattenObject(obj[key], fullKey));
      } else {
        flattened[fullKey] = obj[key];
      }
    }

    return flattened;
  }

  /**
   * プリセットを検出
   */
  private detectPreset(): string {
    const configString = JSON.stringify(this._config);
    const defaultString = JSON.stringify(DEFAULT_CONFIG);

    if (configString === defaultString) {
      return "standard";
    }

    // Simple heuristics for other presets
    if (this._config.maxSuggestions === 5 && this._config.ui.compactMode) {
      return "minimal";
    }

    if (
      this._config.maxSuggestions >= 15 &&
      this._config.advanced.enableAIRecommendations
    ) {
      return this._config.maxSuggestions >= 20 ? "power-user" : "advanced";
    }

    return "custom";
  }
}
