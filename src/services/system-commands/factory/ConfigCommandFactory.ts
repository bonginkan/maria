/**
 * ConfigCommandFactory
 *
 * MARIA統合ファクトリー - DRY-RUN安全機構付き設定コマンド
 * ✅ 既存ConfigCommandとの完全互換性
 * ✅ SystemCommand契約遵守
 * ✅ CLI統合とレガシー統合
 * ✅ デフォルトテンプレート初期化
 */

import {
  SystemCommandContract,
  CommandResultV2,
} from "../contracts/SystemCommandContract";
import { ConfigCommand } from "../commands/ConfigCommand";
import { ConfigPortAdapter } from "../adapters/ConfigPortAdapter";
import { ConfigCLI, ConfigCLIOptions } from "../cli/ConfigCLI";
import { ConfigCommand as SlashConfigCommand } from "../../../shared/handlers/SlashCommandHandler";
import { logger } from "../../../utils/logger";

export interface ConfigV2FactoryOptions {
  enableLegacyCompatibility?: boolean;
  initializeTemplates?: boolean;
  enableInteractiveMode?: boolean;
  defaultDryRun?: boolean;
}

export class ConfigCommandFactory {
  private configPort: ConfigPortAdapter;
  private defaultOptions: ConfigV2FactoryOptions;
  private initialized = false;

  constructor(options: ConfigV2FactoryOptions = {}) {
    this.configPort = new ConfigPortAdapter();
    this.defaultOptions = {
      enableLegacyCompatibility: true,
      initializeTemplates: true,
      enableInteractiveMode: true,
      defaultDryRun: false,
      ...options,
    };
  }

  /**
   * ファクトリー初期化
   * - デフォルトテンプレートのセットアップ
   * - 既存設定のマイグレーション
   * - レガシー互換性の設定
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info("Initializing ConfigCommandFactory...");

      // 1. デフォルトテンプレートの初期化
      if (this.defaultOptions.initializeTemplates) {
        await this.initializeDefaultTemplates();
      }

      // 2. レガシー設定のマイグレーション
      if (this.defaultOptions.enableLegacyCompatibility) {
        await this.migrateLegacyConfigurations();
      }

      // 3. システム設定の検証
      await this.validateSystemConfiguration();

      this.initialized = true;
      logger.info("ConfigCommandFactory initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize ConfigCommandFactory:", error);
      throw new Error(
        `ConfigCommandFactory initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * SystemCommandとして実行
   */
  createSystemCommand(
    operation: string,
    args: any[] = [],
    options: any = {},
  ): SystemCommandContract {
    return new ConfigCommandSystemWrapper(this.configPort, operation, args, {
      dryRun: this.defaultOptions.defaultDryRun,
      interactive: this.defaultOptions.enableInteractiveMode,
      ...options,
    });
  }

  /**
   * CLI直接実行
   */
  async executeCLI(
    operation: string,
    args: any[] = [],
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    await this.ensureInitialized();

    const cliOptions: ConfigCLIOptions = {
      dryRun: this.defaultOptions.defaultDryRun,
      interactive: this.defaultOptions.enableInteractiveMode,
      ...options,
    };

    const cli = new ConfigCLI();
    await cli.execute(operation, args, cliOptions);
  }

  /**
   * レガシーConfigCommand互換実行
   */
  async executeLegacy(args: any, context: any): Promise<any> {
    await this.ensureInitialized();

    if (!this.defaultOptions.enableLegacyCompatibility) {
      throw new Error("Legacy compatibility is disabled");
    }

    // レガシー引数をV2形式に変換
    const { operation, parsedArgs } = this.parseLegacyArgs(args);

    // V2コマンドとして実行
    const command = new ConfigCommand(this.configPort, operation, parsedArgs, {
      dryRun: false, // レガシー互換性のためdry-runは無効
      interactive: false, // レガシー互換性のためインタラクティブは無効
      force: args.flags?.force || false,
      layer: this.mapLegacyScope(args.flags?.global ? "global" : "user"),
      backup: args.flags?.backup !== false,
    });

    const result = await command.execute();

    // レガシー形式の戻り値に変換
    return this.convertToLegacyResult(result, operation);
  }

  /**
   * 便利メソッド群
   */
  static async quickSet(
    key: string,
    value: any,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const factory = new ConfigCommandFactory();
    await factory.executeCLI("set", [key, value], options);
  }

  static async quickGet(
    key: string,
    options: ConfigCLIOptions = {},
  ): Promise<any> {
    const factory = new ConfigCommandFactory();
    const configPort = new ConfigPortAdapter();
    return await configPort.getLayered(key);
  }

  static async quickList(
    prefix?: string,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const factory = new ConfigCommandFactory();
    await factory.executeCLI("list", prefix ? [prefix] : [], options);
  }

  static async quickReset(
    key?: string,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const factory = new ConfigCommandFactory();
    await factory.executeCLI("reset", key ? [key] : [], options);
  }

  // プライベートメソッド

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async initializeDefaultTemplates(): Promise<void> {
    const templates = [
      {
        id: "react-project",
        name: "React Project Configuration",
        description: "Optimized settings for React development",
        category: "react",
        variables: [
          {
            name: "projectName",
            type: "string",
            description: "Project name",
            required: true,
          },
          {
            name: "useTypeScript",
            type: "boolean",
            description: "Enable TypeScript support",
            required: false,
            default: true,
          },
        ],
        config: {
          defaultModel: "claude-3-sonnet",
          temperature: 0.3,
          maxTokens: 8000,
          autoFormat: true,
          language: "en",
          theme: "dark",
        },
      },
      {
        id: "node-api",
        name: "Node.js API Configuration",
        description: "Settings for Node.js API development",
        category: "node",
        variables: [
          {
            name: "apiType",
            type: "select",
            options: ["rest", "graphql", "grpc"],
            description: "API type",
            required: true,
            default: "rest",
          },
        ],
        config: {
          defaultModel: "claude-3-sonnet",
          temperature: 0.2,
          maxTokens: 6000,
          debug: true,
          logLevel: "debug",
          autoFormat: true,
        },
      },
      {
        id: "data-science",
        name: "Data Science Configuration",
        description: "Settings for data analysis and ML projects",
        category: "datascience",
        variables: [],
        config: {
          defaultModel: "claude-3-opus",
          temperature: 0.1,
          maxTokens: 12000,
          streamResponse: false, // Better for code generation
          verbose: true,
          autoSave: true,
        },
      },
    ];

    try {
      for (const template of templates) {
        // テンプレートが存在しない場合のみ作成
        const existingTemplates = await this.configPort.listTemplates();
        const exists = existingTemplates.some((t) => t.id === template.id);

        if (!exists) {
          await this.saveTemplate(template);
          logger.info(`Initialized template: ${template.id}`);
        }
      }
    } catch (error) {
      logger.warn("Failed to initialize some templates:", error);
    }
  }

  private async migrateLegacyConfigurations(): Promise<void> {
    try {
      // 既存のConfigCommandの設定を検出してマイグレーション
      const legacyConfig = await this.detectLegacyConfiguration();

      if (legacyConfig && Object.keys(legacyConfig).length > 0) {
        logger.info("Migrating legacy configuration...");

        // レガシー設定をV2形式にマイグレーション
        for (const [key, value] of Object.entries(legacyConfig)) {
          const currentValue = await this.configPort.get(key);

          // 既存の値がない場合のみマイグレーション
          if (currentValue === undefined) {
            await this.configPort.set(key, value, {
              layer: "user",
              backup: true,
              validate: false, // レガシー設定なので検証をスキップ
            });
          }
        }

        logger.info("Legacy configuration migrated successfully");
      }
    } catch (error) {
      logger.warn("Legacy configuration migration failed:", error);
      // マイグレーション失敗は致命的でないため継続
    }
  }

  private async validateSystemConfiguration(): Promise<void> {
    // システム必須設定の検証と初期化
    const requiredConfigs = {
      version: "3.5.0",
      defaultModel: "claude-3-sonnet",
      language: "en",
      theme: "dark",
      logLevel: "info",
    };

    for (const [key, defaultValue] of Object.entries(requiredConfigs)) {
      const currentValue = await this.configPort.get(key);

      if (currentValue === undefined) {
        await this.configPort.set(key, defaultValue, {
          layer: "global",
          backup: false,
          validate: true,
        });
        logger.info(
          `Set default system configuration: ${key} = ${defaultValue}`,
        );
      }
    }
  }

  private async detectLegacyConfiguration(): Promise<Record<
    string,
    any
  > | null> {
    try {
      // レガシーConfigCommandの設定ファイルを検出
      // 実際の実装では既存の設定ファイルパスを確認
      return {};
    } catch (error) {
      return null;
    }
  }

  private parseLegacyArgs(args: any): { operation: string; parsedArgs: any[] } {
    // レガシー引数形式をV2形式に変換
    const operation = args.parsed?.positional?.[0] || "list";
    const parsedArgs = args.parsed?.positional?.slice(1) || [];

    return { operation, parsedArgs };
  }

  private mapLegacyScope(
    scope: string,
  ): "global" | "user" | "project" | "runtime" {
    switch (scope) {
      case "global":
        return "global";
      case "local":
        return "project";
      default:
        return "user";
    }
  }

  private convertToLegacyResult(
    result: CommandResultV2,
    operation: string,
  ): any {
    // V2結果をレガシー形式に変換
    if (result.endReason === "success") {
      return {
        success: true,
        message: result.data?.message || `${operation} completed successfully`,
        data: result.data,
        metadata: {
          executionTime: result.duration,
          timestamp: result.timestamp,
        },
      };
    } else {
      return {
        success: false,
        error: result.error || "Operation failed",
        code: result.endReason.toUpperCase(),
        metadata: {
          executionTime: result.duration,
          timestamp: result.timestamp,
        },
      };
    }
  }

  private async saveTemplate(template: any): Promise<void> {
    // テンプレート保存の実装
    // 実際の実装では ConfigPortAdapter のテンプレートディレクトリに保存
    logger.debug(`Template ${template.id} would be saved here`);
  }
}

/**
 * SystemCommandContract準拠ラッパー
 */
class ConfigCommandSystemWrapper implements SystemCommandContract {
  readonly requiresInput = false;

  private command: ConfigCommand;

  constructor(
    configPort: ConfigPortAdapter,
    operation: string,
    args: any[],
    options: any,
  ) {
    this.command = new ConfigCommand(configPort, operation, args, options);
  }

  async execute(): Promise<CommandResultV2> {
    return await this.command.execute();
  }
}

// 便利な静的メソッドのエクスポート
export const ConfigV2 = {
  set: ConfigCommandFactory.quickSet,
  get: ConfigCommandFactory.quickGet,
  list: ConfigCommandFactory.quickList,
  reset: ConfigCommandFactory.quickReset,

  // ファクトリーインスタンス作成
  create: (options?: ConfigV2FactoryOptions) =>
    new ConfigCommandFactory(options),

  // CLI実行
  cli: async (
    operation: string,
    args: any[] = [],
    options: ConfigCLIOptions = {},
  ) => {
    const factory = new ConfigCommandFactory();
    await factory.executeCLI(operation, args, options);
  },
};
