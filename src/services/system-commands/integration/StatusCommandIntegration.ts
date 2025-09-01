/**
 * StatusCommandV2Integration
 *
 * StatusCommandV2を既存のMARIA slash commandシステムに統合
 * 段階的ロールアウト・フィーチャーフラグ対応
 */

import { BaseCommand, CommandArgs, CommandContext, CommandResult, CommandExample, StatusCommandV2 } from "../../../shared/handlers/SlashCommandHandler";
import { SystemCommandFactory } from "../factory/SystemCommandFactory";
import { logger } from "../../../utils/logger";

// 既存システムからのインポート
import { AIProviderManager } from "../../../providers/manager";
import { ConfigManager } from "../../../config/config-manager";

/**
 * Feature Flag設定
 */
interface FeatureFlags {
  "system.status.v2.enabled": { percentage: number; fallbackEnabled: boolean };
}

export class StatusCommandV2Integration extends BaseCommand {
  name = "status";
  category = "system" as const;
  description = "📊 Display comprehensive system status and health information";
  override aliases = ["st", "info", "sys"];
  override usage =
    "[--detailed] [--json] [--refresh] [--services] [--resources] [--level=fast|normal|deep] [--v2]";

  override examples: CommandExample[] = [
    {
      input: "/status",
      description: "Show basic system status overview",
      output: "System health summary with key metrics",
    },
    {
      input: "/status --detailed",
      description: "Show detailed system information",
      output: "Comprehensive system report with all metrics",
    },
    {
      input: "/status --v2",
      description: "Force V2 architecture with provider probing",
      output: "Enhanced status with AI provider health monitoring",
    },
    {
      input: "/status --level=deep",
      description: "Deep system probing (V2 only)",
      output: "Thorough health check with 3-second timeout",
    },
  ];

  private v2Factory: SystemCommandFactory;
  private configManager: ConfigManager;
  private providerManager: AIProviderManager | null = null;

  // Feature flags
  private featureFlags: FeatureFlags = {
    "system.status.v2.enabled": { percentage: 25, fallbackEnabled: true }, // Phase 3.3.1: 25%トラフィック
  };

  constructor(
    configManager?: ConfigManager,
    providerManager?: AIProviderManager,
  ) {
    super();
    this.configManager = configManager || new ConfigManager();
    this.providerManager = providerManager;

    this.v2Factory = SystemCommandFactory.getInstance();

    // 既存システムコンポーネントを設定
    if (this.providerManager) {
      this.v2Factory.setSystemComponents(
        this.providerManager,
        this.configManager,
      );
    }
  }

  async execute(
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const { flags } = args;

      // V2使用判定(フィーチャーフラグ + 明示的指定)
      const shouldUseV2 = this.shouldUseV2(flags, context);

      logger.info("Status command executed", {
        user: context.user?.id,
        session: context.session.id,
        version: shouldUseV2 ? "v2" : "v1",
        flags,
      });

      if (shouldUseV2) {
        return await this.executeV2(args, context);
      } else {
        return await this.executeV1(args, context);
      }
    } catch (error) {
      logger.error("Status command failed:", error);

      // V2失敗時は自動的にV1フォールバック
      if (this.featureFlags["system.status.v2.enabled"].fallbackEnabled) {
        logger.warn("V2 failed, falling back to V1");
        return await this.executeV1(args, context);
      }

      return this.error(
        "Failed to retrieve system status",
        "STATUS_ERROR",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * V2実行(StatusCommandV2使用)
   */
  private async executeV2(
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      // V2デフォルト設定初期化
      await this.v2Factory.initializeDefaultConfig();

      // StatusCommandV2インスタンス作成・実行
      const statusV2 = this.v2Factory.createStatusCommandV2();

      //引数解析・設定
      this.configureV2Command(statusV2, args);

      // V2実行
      const result = await statusV2.execute();

      // 成功メトリクス記録
      this.recordV2Metrics("success", result.duration);

      if (result.endReason === "success") {
        return this.success(
          result.data.output || "System status retrieved successfully",
          {
            ...result.data,
            version: "v2",
            executionTime: result.duration,
            timestamp: result.timestamp,
          },
        );
      } else {
        throw new Error(result.error || "V2 execution failed");
      }
    } catch (error) {
      this.recordV2Metrics("error", 0);
      throw error;
    }
  }

  /**
   * V1実行(既存StatusCommand互換)
   */
  private async executeV1(
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    // 既存StatusCommandの実装をここに移植
    // 今回は簡易版実装

    const status = {
      system: {
        platform: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
        uptime: Math.floor(process.uptime()),
        hostname: require("os").hostname(),
      },
      timestamp: Date.now(),
      version: "v1",
    };

    const { flags } = args;

    if (flags["json"]) {
      return this.success("System status (JSON format)", status);
    }

    const lines = [
      "",
      "📊 **MARIA SYSTEM STATUS V1**",
      "═".repeat(40),
      "",
      `**Platform:** ${status.system.platform}`,
      `**Architecture:** ${status.system.architecture}`,
      `**Node.js:** ${status.system.nodeVersion}`,
      `**Uptime:** ${status.system.uptime}s`,
      `**Hostname:** ${status.system.hostname}`,
      "",
      "💡 Use `--v2` for enhanced AI provider monitoring",
      "",
    ].join("\n");

    return this.success(lines, status);
  }

  /**
   * V2使用判定ロジック
   */
  private shouldUseV2(
    flags: Record<string, any>,
    context: CommandContext,
  ): boolean {
    // 明示的V2指定
    if (flags["v2"] === true) {
      return true;
    }

    // V2専用フラグ(level指定)
    if (flags["level"] && ["fast", "normal", "deep"].includes(flags["level"])) {
      return true;
    }

    // フィーチャーフラグによる段階的ロールアウト
    const flagConfig = this.featureFlags["system.status.v2.enabled"];

    if (flagConfig.percentage >= 100) {
      return true;
    }

    if (flagConfig.percentage <= 0) {
      return false;
    }

    // セッションIDベースの安定したパーセンテージ判定
    const sessionHash = this.hashSessionId(context.session.id);
    return sessionHash % 100 < flagConfig.percentage;
  }

  /**
   * V2コマンド設定
   */
  private configureV2Command(
    statusV2: StatusCommandV2,
    args: CommandArgs,
  ): void {
    const { flags } = args;

    // 実行レベル設定
    if (flags["level"]) {
      // StatusCommandV2の内部で使用されるため、グローバル設定として保存
      // 実装時は適切なプロパティ設定方式を使用
    }

    // その他のフラグ設定
    // detailed, json, services, resources, refresh 等
  }

  /**
   * セッションIDハッシュ化(安定したパーセンテージ判定用)
   */
  private hashSessionId(sessionId: string): number {
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      const char = sessionId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash);
  }

  /**
   * V2メトリクス記録
   */
  private recordV2Metrics(type: "success" | "error", duration: number): void {
    logger.info("StatusV2 metrics", {
      type,
      duration,
      timestamp: Date.now(),
    });

    // 実装時は適切なメトリクス記録システムに送信
  }

  /**
   * フィーチャーフラグ更新(運用時の動的制御用)
   */
  updateFeatureFlags(flags: Partial<FeatureFlags>): void {
    this.featureFlags = { ...this.featureFlags, ...flags };

    logger.info("Feature flags updated", {
      newFlags: this.featureFlags,
      timestamp: Date.now(),
    });
  }

  /**
   * V2ヘルス状態取得(監視用)
   */
  async getV2Health(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const statusV2 = this.v2Factory.createStatusCommandV2();
      const result = await statusV2.execute();

      return {
        healthy: result.endReason === "success",
        ...(result.endReason !== "success" && { error: result.error }),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * バリデーション
   */
  override async validate(
    args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    const { parsed } = args;
    const positional = (parsed["_positional"] as string[]) || [];

    // Status command doesn't accept positional arguments
    if (positional.length > 0) {
      return {
        success: false,
        error: `Unexpected arguments: ${positional.join(", ")}. Use flags like --detailed instead.`,
      };
    }

    // level フラグの値検証
    const level = parsed["level"];
    if (level && !["fast", "normal", "deep"].includes(level)) {
      return {
        success: false,
        error: `Invalid level '${level}'. Use: fast, normal, or deep.`,
      };
    }

    return { success: true };
  }
}
