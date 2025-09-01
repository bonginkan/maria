/**
 * Notification Service - Slack/Email通知サービス
 * ビジネスダッシュボード結果やアラートを各チャンネルに配信
 */

import * as https from "https";
import * as fs from "fs/promises";
import * as path from "path";
import { SlackConfig, SlackNotification, IntegrationResult } from "./types";
import { SalesMetrics } from "./types";
import { Logger } from "../../utils/logger";

export interface NotificationTemplate {
  id: string;
  name: string;
  type:
    | "sales_dashboard"
    | "battlecard_generated"
    | "metrics_alert"
    | "system_alert";
  channel: string;
  format: "blocks" | "attachments" | "text";
  template: any;
}

export interface NotificationContext {
  recipientType: "sales" | "marketing" | "executive" | "system";
  urgency: "low" | "medium" | "high" | "critical";
  data: Record<string, any>;
  metadata?: {
    userId?: string;
    command?: string;
    timestamp?: Date;
  };
}

export class NotificationService {
  private static instance: NotificationService;
  private slackConfig: SlackConfig;
  private templates: Map<string, NotificationTemplate> = new Map();
  private rateLimitTracker: Map<string, number[]> = new Map();
  private configPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), ".maria", "notifications");
    this.initializeService();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async initializeService(): Promise<void> {
    try {
      await fs.mkdir(this.configPath, { recursive: true });
      await this.loadConfig();
      await this.initializeTemplates();

      Logger.info("Notification service initialized", {
        slackEnabled: this.slackConfig?.enabled,
        templateCount: this.templates.size,
      });
    } catch (error) {
      Logger.error("Failed to initialize notification service", error);
    }
  }

  /**
   * 営業ダッシュボードの自動通知
   */
  public async notifySalesDashboard(
    salesMetrics: SalesMetrics,
    context: {
      channelId?: string;
      recipientType: "sales" | "sales_manager" | "executive";
      timeRange: string;
    },
  ): Promise<IntegrationResult<boolean>> {
    try {
      const template = this.getTemplate(
        "sales_dashboard",
        context.recipientType,
      );
      if (!template) {
        return this.createErrorResult(
          "TEMPLATE_NOT_FOUND",
          "Sales dashboard template not found",
        );
      }

      const notification = this.buildSalesDashboardNotification(
        salesMetrics,
        context,
        template,
      );

      return await this.sendSlackNotification(notification, context.channelId);
    } catch (error) {
      Logger.error("Failed to send sales dashboard notification", error);
      return this.createErrorResult("NOTIFICATION_FAILED", error.message);
    }
  }

  /**
   * バトルカード生成完了通知
   */
  public async notifyBattlecardGenerated(
    battlecardData: {
      competitor: string;
      customerName?: string;
      pdfPath: string;
      generatedBy: string;
    },
    context: NotificationContext,
  ): Promise<IntegrationResult<boolean>> {
    try {
      const notification: SlackNotification = {
        channel: this.getChannelForRecipientType(context.recipientType),
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "⚔️ バトルカード生成完了",
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*競合:* ${battlecardData.competitor}`,
              },
              {
                type: "mrkdwn",
                text: `*生成者:* ${battlecardData.generatedBy}`,
              },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: battlecardData.customerName
                ? `${battlecardData.customerName} 向けの競合対策資料が生成されました。`
                : `${battlecardData.competitor} 対策の汎用資料が生成されました。`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "📄 PDF をダウンロード",
                },
                url: `file://${battlecardData.pdfPath}`, // 実際は適切なURLに変更
                style: "primary",
              },
            ],
          },
        ],
      };

      return await this.sendSlackNotification(notification);
    } catch (error) {
      Logger.error("Failed to send battlecard notification", error);
      return this.createErrorResult("NOTIFICATION_FAILED", error.message);
    }
  }

  /**
   * システムアラート通知
   */
  public async notifySystemAlert(
    alert: {
      type: "security" | "performance" | "data_quality" | "integration";
      severity: "low" | "medium" | "high" | "critical";
      message: string;
      details?: Record<string, any>;
      affectedUsers?: string[];
    },
    context: NotificationContext,
  ): Promise<IntegrationResult<boolean>> {
    try {
      const emoji = this.getSeverityEmoji(alert.severity);
      const color = this.getSeverityColor(alert.severity);

      const notification: SlackNotification = {
        channel: this.getChannelForRecipientType("system"),
        attachments: [
          {
            color: color,
            title: `${emoji} システムアラート - ${alert.type.toUpperCase()}`,
            text: alert.message,
            fields: [
              {
                title: "Severity",
                value: alert.severity.toUpperCase(),
                short: true,
              },
              {
                title: "Timestamp",
                value: new Date().toISOString(),
                short: true,
              },
            ],
            timestamp: Math.floor(Date.now() / 1000),
          },
        ],
      };

      if (alert.details) {
        notification.attachments![0].fields!.push({
          title: "Details",
          value: JSON.stringify(alert.details, null, 2),
          short: false,
        });
      }

      if (alert.affectedUsers && alert.affectedUsers.length > 0) {
        notification.attachments![0].fields!.push({
          title: "Affected Users",
          value: alert.affectedUsers.join(", "),
          short: false,
        });
      }

      // 重要度がhigh以上の場合は専用チャンネルにも送信
      if (alert.severity === "high" || alert.severity === "critical") {
        await this.sendSlackNotification(
          notification,
          "#maria-alerts-critical",
        );
      }

      return await this.sendSlackNotification(notification);
    } catch (error) {
      Logger.error("Failed to send system alert notification", error);
      return this.createErrorResult("NOTIFICATION_FAILED", error.message);
    }
  }

  /**
   * 営業成果サマリー通知(定期実行用)
   */
  public async notifyWeeklySalesSummary(weeklyData: {
    totalOpportunities: number;
    newOpportunities: number;
    closedWon: number;
    totalWonValue: number;
    winRateChange: number;
    topPerformers: { name: string; deals: number; value: number }[];
    alerts: string[];
  }): Promise<IntegrationResult<boolean>> {
    try {
      const notification: SlackNotification = {
        channel: this.getChannelForRecipientType("sales"),
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "📊 週次営業サマリー",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `今週の営業活動結果をお知らせします。`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*新規商談:* ${weeklyData.newOpportunities}件`,
              },
              {
                type: "mrkdwn",
                text: `*成約:* ${weeklyData.closedWon}件`,
              },
              {
                type: "mrkdwn",
                text: `*成約金額:* ¥${weeklyData.totalWonValue.toLocaleString()}`,
              },
              {
                type: "mrkdwn",
                text: `*勝率変化:* ${weeklyData.winRateChange > 0 ? "+" : ""}${weeklyData.winRateChange.toFixed(1)}%`,
              },
            ],
          },
          {
            type: "divider",
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*🏆 今週のトップパフォーマー*",
            },
          },
        ],
      };

      // トップパフォーマーを追加
      weeklyData.topPerformers.slice(0, 3).forEach((performer, index) => {
        const medal = ["🥇", "🥈", "🥉"][index] || "🏅";
        notification.blocks!.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${medal} *${performer.name}*\n${performer.deals}件成約 (¥${performer.value.toLocaleString()})`,
          },
        });
      });

      // アラートがある場合は追加
      if (weeklyData.alerts.length > 0) {
        notification.blocks!.push(
          { type: "divider" },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*⚠️ 注意事項*\n${weeklyData.alerts.join("\n")}`,
            },
          },
        );
      }

      return await this.sendSlackNotification(notification);
    } catch (error) {
      Logger.error("Failed to send weekly sales summary", error);
      return this.createErrorResult("NOTIFICATION_FAILED", error.message);
    }
  }

  // プライベートメソッド群

  private async loadConfig(): Promise<void> {
    try {
      const configFile = path.join(this.configPath, "slack-config.json");
      const content = await fs.readFile(configFile, "utf8");
      this.slackConfig = JSON.parse(content);
    } catch {
      // デフォルト設定
      this.slackConfig = {
        enabled: false,
        username: "MARIA Bot",
        iconEmoji: ":robot_face:",
      };

      // 環境変数から設定を読み取り
      if (process.env.SLACK_WEBHOOK_URL) {
        this.slackConfig.webhookUrl = process.env.SLACK_WEBHOOK_URL;
        this.slackConfig.enabled = true;
      }
      if (process.env.SLACK_BOT_TOKEN) {
        this.slackConfig.botToken = process.env.SLACK_BOT_TOKEN;
        this.slackConfig.enabled = true;
      }
    }
  }

  private async initializeTemplates(): Promise<void> {
    const salesDashboardTemplate: NotificationTemplate = {
      id: "sales_dashboard_sales",
      name: "Sales Dashboard - Sales Team",
      type: "sales_dashboard",
      channel: "#sales-daily",
      format: "blocks",
      template: {
        header: "📊 営業ダッシュボード",
        fields: ["totalOpportunities", "winRate", "pipelineValue", "topDeals"],
      },
    };

    const execDashboardTemplate: NotificationTemplate = {
      id: "sales_dashboard_exec",
      name: "Sales Dashboard - Executive",
      type: "sales_dashboard",
      channel: "#executive-summary",
      format: "attachments",
      template: {
        header: "📈 Executive Sales Summary",
        fields: ["totalValue", "winRate", "forecastAccuracy", "trends"],
      },
    };

    this.templates.set("sales_dashboard_sales", salesDashboardTemplate);
    this.templates.set("sales_dashboard_executive", execDashboardTemplate);
  }

  private getTemplate(
    templateType: string,
    recipientType: string,
  ): NotificationTemplate | null {
    return this.templates.get(`${templateType}_${recipientType}`) || null;
  }

  private buildSalesDashboardNotification(
    salesMetrics: SalesMetrics,
    context: any,
    template: NotificationTemplate,
  ): SlackNotification {
    const winRatePercent = (salesMetrics.winRate * 100).toFixed(1);
    const conversionPercent = (salesMetrics.conversionRate * 100).toFixed(1);

    return {
      channel: context.channelId || template.channel,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: template.template.header,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${context.timeRange}の営業実績をお知らせします。`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*総商談数:* ${salesMetrics.totalOpportunities}件`,
            },
            {
              type: "mrkdwn",
              text: `*総金額:* ¥${salesMetrics.totalValue.toLocaleString()}`,
            },
            {
              type: "mrkdwn",
              text: `*勝率:* ${winRatePercent}%`,
            },
            {
              type: "mrkdwn",
              text: `*コンバージョン率:* ${conversionPercent}%`,
            },
            {
              type: "mrkdwn",
              text: `*平均案件金額:* ¥${salesMetrics.averageDealSize.toLocaleString()}`,
            },
            {
              type: "mrkdwn",
              text: `*営業サイクル:* ${salesMetrics.averageSalesCycle}日`,
            },
          ],
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*ステージ別状況*",
          },
        },
      ],
    };
  }

  private async sendSlackNotification(
    notification: SlackNotification,
    overrideChannel?: string,
  ): Promise<IntegrationResult<boolean>> {
    if (!this.slackConfig.enabled) {
      Logger.info("Slack notifications disabled, skipping");
      return {
        success: true,
        data: true,
        metadata: { executionTimeMs: 0, fromCache: false },
      };
    }

    // レート制限チェック
    if (!this.checkSlackRateLimit()) {
      return this.createErrorResult(
        "RATE_LIMIT_EXCEEDED",
        "Slack rate limit exceeded",
      );
    }

    const channel =
      overrideChannel || notification.channel || this.slackConfig.channelId;
    const payload = {
      channel,
      username: this.slackConfig.username,
      icon_emoji: this.slackConfig.iconEmoji,
      ...notification,
    };

    return new Promise((resolve) => {
      const startTime = Date.now();
      const postData = JSON.stringify(payload);

      const options = this.slackConfig.webhookUrl
        ? this.getWebhookOptions(postData)
        : this.getBotAPIOptions(postData);

      const req = https.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          const executionTimeMs = Date.now() - startTime;

          if (res.statusCode === 200 || res.statusCode === 201) {
            Logger.info("Slack notification sent successfully", {
              channel,
              statusCode: res.statusCode,
              executionTimeMs,
            });

            resolve({
              success: true,
              data: true,
              metadata: { executionTimeMs, fromCache: false },
            });
          } else {
            Logger.error("Slack notification failed", {
              statusCode: res.statusCode,
              response: responseData,
            });

            resolve(
              this.createErrorResult(
                "SLACK_API_ERROR",
                `HTTP ${res.statusCode}: ${responseData}`,
              ),
            );
          }
        });
      });

      req.on("error", (error) => {
        Logger.error("Slack request failed", error);
        resolve(this.createErrorResult("SLACK_REQUEST_ERROR", error.message));
      });

      req.write(postData);
      req.end();
    });
  }

  private getWebhookOptions(postData: string): https.RequestOptions {
    const url = new URL(this.slackConfig.webhookUrl!);
    return {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };
  }

  private getBotAPIOptions(postData: string): https.RequestOptions {
    return {
      hostname: "slack.com",
      port: 443,
      path: "/api/chat.postMessage",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        Authorization: `Bearer ${this.slackConfig.botToken}`,
      },
    };
  }

  private checkSlackRateLimit(): boolean {
    const now = Date.now();
    const window = 60 * 1000; // 1分
    const limit = 100; // 1分間に100メッセージ

    const requests = this.rateLimitTracker.get("slack") || [];
    const recentRequests = requests.filter((time) => now - time < window);

    if (recentRequests.length >= limit) {
      return false;
    }

    recentRequests.push(now);
    this.rateLimitTracker.set("slack", recentRequests);

    return true;
  }

  private getChannelForRecipientType(recipientType: string): string {
    const channelMapping: Record<string, string> = {
      sales: "#sales-daily",
      marketing: "#marketing-updates",
      executive: "#executive-summary",
      system: "#maria-system-alerts",
    };

    return channelMapping[recipientType] || "#general";
  }

  private getSeverityEmoji(severity: string): string {
    const emojiMapping: Record<string, string> = {
      low: "🔵",
      medium: "🟡",
      high: "🟠",
      critical: "🔴",
    };

    return emojiMapping[severity] || "⚪";
  }

  private getSeverityColor(severity: string): string {
    const colorMapping: Record<string, string> = {
      low: "good",
      medium: "warning",
      high: "danger",
      critical: "#FF0000",
    };

    return colorMapping[severity] || "good";
  }

  private createErrorResult(
    code: string,
    message: string,
  ): IntegrationResult<boolean> {
    return {
      success: false,
      data: false,
      error: {
        code,
        message,
        source: "NotificationService",
        retryable: true,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Slack設定の更新
   */
  public async updateSlackConfig(
    config: Partial<SlackConfig>,
  ): Promise<boolean> {
    try {
      this.slackConfig = { ...this.slackConfig, ...config };

      const configFile = path.join(this.configPath, "slack-config.json");
      await fs.writeFile(
        configFile,
        JSON.stringify(this.slackConfig, null, 2),
        "utf8",
      );

      Logger.info("Slack configuration updated", {
        enabled: this.slackConfig.enabled,
      });

      return true;
    } catch (error) {
      Logger.error("Failed to update Slack configuration", error);
      return false;
    }
  }

  /**
   * 通知テスト
   */
  public async testNotification(
    channelId?: string,
  ): Promise<IntegrationResult<boolean>> {
    const testNotification: SlackNotification = {
      channel: channelId || "#general",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "🤖 *MARIA Notification Test*\n\nThis is a test notification from MARIA CLI Business Dashboard.",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `_Timestamp: ${new Date().toISOString()}_`,
          },
        },
      ],
    };

    return await this.sendSlackNotification(testNotification, channelId);
  }

  /**
   * 現在の設定状況を取得
   */
  public getStatus(): {
    enabled: boolean;
    configured: boolean;
    templateCount: number;
    lastNotificationSent?: Date;
  } {
    return {
      enabled: this.slackConfig.enabled,
      configured: !!(this.slackConfig.webhookUrl || this.slackConfig.botToken),
      templateCount: this.templates.size,
    };
  }
}
