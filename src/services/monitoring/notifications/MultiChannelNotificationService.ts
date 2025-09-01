/**
 * MARIA v3.6.0 - Multi-Channel Notification Service
 * Unified notification system with intelligent routing and escalation
 * Supports Email, Slack, Teams, PagerDuty, Webhooks, and SMS
 */

import { EventEmitter } from "node:events";
import { performance } from "perf_hooks";

// Type definitions
interface NotificationChannel {
  id: string;
  type:
    | "email"
    | "slack"
    | "teams"
    | "pagerduty"
    | "webhook"
    | "sms"
    | "discord";
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  priority: number; // 1-10, higher = higher priority
  rateLimits: {
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
  };
  failureHandling: {
    retries: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
  };
}

interface NotificationTemplate {
  id: string;
  name: string;
  channels: string[]; // Channel IDs
  severity: "low" | "medium" | "high" | "critical";
  subject: string;
  body: string;
  formatting: {
    html?: string;
    markdown?: string;
    slack?: Record<string, any>;
    teams?: Record<string, any>;
  };
}

interface NotificationRequest {
  id: string;
  templateId: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: number;
  data: Record<string, any>;
  channels?: string[]; // Override default channels
  priority?: number;
  metadata?: Record<string, any>;
}

interface NotificationDelivery {
  id: string;
  requestId: string;
  channelId: string;
  status: "pending" | "sending" | "delivered" | "failed" | "retrying";
  attempts: number;
  error?: string;
  deliveredAt?: number;
  responseTime?: number;
}

interface NotificationStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  averageResponseTime: number;
  channelStats: Map<
    string,
    {
      sent: number;
      delivered: number;
      failed: number;
      avgResponseTime: number;
    }
  >;
}

interface EscalationRule {
  id: string;
  name: string;
  condition: {
    severity?: string[];
    failedChannels?: string[];
    timeoutMs?: number;
    retryCount?: number;
  };
  action: {
    type: "escalate" | "fallback" | "alert";
    channels: string[];
    template?: string;
    delay?: number;
  };
}

// Email notification adapter
class EmailAdapter {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async send(
    to: string[],
    subject: string,
    body: string,
    html?: string,
  ): Promise<boolean> {
    try {
      // Mock email sending - replace with actual SMTP/service
      console.log(`📧 Email sent to ${to.join(", ")}: ${subject}`);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate network delay
      return true;
    } catch (error) {
      console.error("❌ Email send failed:", error);
      return false;
    }
  }
}

// Slack notification adapter
class SlackAdapter {
  private webhookUrl: string;

  constructor(config: any) {
    this.webhookUrl = config.webhookUrl;
  }

  async send(message: string, blocks?: any[]): Promise<boolean> {
    try {
      const payload = {
        text: message,
        blocks: blocks || this.createDefaultBlocks(message),
      };

      // Mock Slack API call - replace with actual HTTP request
      console.log(`🔔 Slack message sent: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, 150)); // Simulate network delay
      return true;
    } catch (error) {
      console.error("❌ Slack send failed:", error);
      return false;
    }
  }

  private createDefaultBlocks(message: string): any[] {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: message,
        },
      },
    ];
  }
}

// Microsoft Teams adapter
class TeamsAdapter {
  private webhookUrl: string;

  constructor(config: any) {
    this.webhookUrl = config.webhookUrl;
  }

  async send(title: string, message: string, color?: string): Promise<boolean> {
    try {
      const payload = {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        summary: title,
        themeColor: color || "0078D4",
        sections: [
          {
            activityTitle: title,
            activityText: message,
            markdown: true,
          },
        ],
      };

      // Mock Teams API call - replace with actual HTTP request
      console.log(`📢 Teams message sent: ${title}`);
      await new Promise((resolve) => setTimeout(resolve, 120)); // Simulate network delay
      return true;
    } catch (error) {
      console.error("❌ Teams send failed:", error);
      return false;
    }
  }
}

// PagerDuty adapter
class PagerDutyAdapter {
  private routingKey: string;

  constructor(config: any) {
    this.routingKey = config.routingKey;
  }

  async send(
    severity: string,
    summary: string,
    source: string,
    details?: any,
  ): Promise<boolean> {
    try {
      const payload = {
        routing_key: this.routingKey,
        event_action: "trigger",
        payload: {
          summary,
          source,
          severity,
          custom_details: details,
        },
      };

      // Mock PagerDuty API call - replace with actual HTTP request
      console.log(`🚨 PagerDuty alert sent: ${summary}`);
      await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate network delay
      return true;
    } catch (error) {
      console.error("❌ PagerDuty send failed:", error);
      return false;
    }
  }
}

// Generic webhook adapter
class WebhookAdapter {
  private url: string;
  private headers: Record<string, string>;

  constructor(config: any) {
    this.url = config.url;
    this.headers = config.headers || {};
  }

  async send(payload: any): Promise<boolean> {
    try {
      // Mock webhook call - replace with actual HTTP request
      console.log(
        `🔗 Webhook sent to ${this.url}:`,
        JSON.stringify(payload, null, 2),
      );
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate network delay
      return true;
    } catch (error) {
      console.error("❌ Webhook send failed:", error);
      return false;
    }
  }
}

// Main multi-channel notification service
export class MultiChannelNotificationService extends EventEmitter {
  private channels: Map<string, NotificationChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private escalationRules: Map<string, EscalationRule> = new Map();
  private deliveries: Map<string, NotificationDelivery[]> = new Map();
  private stats: NotificationStats;
  private rateLimiters: Map<string, { count: number; resetTime: number }> =
    new Map();

  // Adapters
  private emailAdapter?: EmailAdapter;
  private slackAdapter?: SlackAdapter;
  private teamsAdapter?: TeamsAdapter;
  private pagerDutyAdapter?: PagerDutyAdapter;
  private webhookAdapters: Map<string, WebhookAdapter> = new Map();

  constructor() {
    super();

    this.stats = {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      averageResponseTime: 0,
      channelStats: new Map(),
    };

    this.initializeDefaultChannels();
    this.initializeDefaultTemplates();
    this.initializeDefaultEscalationRules();

    console.log("📢 MultiChannelNotificationService initialized");
  }

  private initializeDefaultChannels(): void {
    // Email channel
    this.addChannel({
      id: "email-primary",
      type: "email",
      name: "Primary Email",
      enabled: true,
      config: {
        smtp: {
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        },
        from: "maria-alerts@company.com",
        to: ["admin@company.com", "devops@company.com"],
      },
      priority: 8,
      rateLimits: {
        maxPerMinute: 10,
        maxPerHour: 100,
        maxPerDay: 500,
      },
      failureHandling: {
        retries: 3,
        backoffMultiplier: 2,
        maxBackoffMs: 60000,
      },
    });

    // Slack channel
    this.addChannel({
      id: "slack-alerts",
      type: "slack",
      name: "Alerts Channel",
      enabled: true,
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: "#alerts",
        username: "MARIA Bot",
      },
      priority: 9,
      rateLimits: {
        maxPerMinute: 20,
        maxPerHour: 200,
        maxPerDay: 1000,
      },
      failureHandling: {
        retries: 2,
        backoffMultiplier: 1.5,
        maxBackoffMs: 30000,
      },
    });

    // PagerDuty channel for critical alerts
    this.addChannel({
      id: "pagerduty-critical",
      type: "pagerduty",
      name: "Critical Alerts",
      enabled: true,
      config: {
        routingKey: process.env.PAGERDUTY_ROUTING_KEY,
        urgency: "high",
      },
      priority: 10,
      rateLimits: {
        maxPerMinute: 5,
        maxPerHour: 50,
        maxPerDay: 200,
      },
      failureHandling: {
        retries: 5,
        backoffMultiplier: 2,
        maxBackoffMs: 120000,
      },
    });
  }

  private initializeDefaultTemplates(): void {
    // System alert template
    this.addTemplate({
      id: "system-alert",
      name: "System Alert",
      channels: ["slack-alerts", "email-primary"],
      severity: "medium",
      subject: "🚨 MARIA System Alert: {{alertType}}",
      body: `Alert Details:
- Type: {{alertType}}
- Severity: {{severity}}
- Time: {{timestamp}}
- Message: {{message}}
- System: {{system}}

Please investigate immediately.`,
      formatting: {
        markdown:
          "**Alert**: {{alertType}}\n**Severity**: {{severity}}\n**Message**: {{message}}",
        slack: {
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🚨 System Alert",
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: "*Type:* {{alertType}}",
                },
                {
                  type: "mrkdwn",
                  text: "*Severity:* {{severity}}",
                },
              ],
            },
          ],
        },
      },
    });

    // Performance alert template
    this.addTemplate({
      id: "performance-alert",
      name: "Performance Alert",
      channels: ["slack-alerts"],
      severity: "low",
      subject: "📊 Performance Alert: {{metric}}",
      body: `Performance Issue Detected:
- Metric: {{metric}}
- Current Value: {{currentValue}}
- Threshold: {{threshold}}
- Duration: {{duration}}
- Impact: {{impact}}`,
      formatting: {
        slack: {
          color: "#ffaa00",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "📊 *Performance Alert*\n{{metric}} is {{currentValue}} (threshold: {{threshold}})",
              },
            },
          ],
        },
      },
    });

    // Critical system failure template
    this.addTemplate({
      id: "critical-failure",
      name: "Critical System Failure",
      channels: ["pagerduty-critical", "slack-alerts", "email-primary"],
      severity: "critical",
      subject: "🔴 CRITICAL: System Failure Detected",
      body: `CRITICAL SYSTEM FAILURE:
- System: {{system}}
- Error: {{error}}
- Time: {{timestamp}}
- Impact: {{impact}}
- Required Action: {{action}}

IMMEDIATE ATTENTION REQUIRED!`,
      formatting: {
        slack: {
          color: "#ff0000",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🔴 CRITICAL SYSTEM FAILURE",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*System:* {{system}}\n*Error:* {{error}}\n*Action Required:* {{action}}",
              },
            },
          ],
        },
      },
    });
  }

  private initializeDefaultEscalationRules(): void {
    // Critical alert escalation
    this.addEscalationRule({
      id: "critical-escalation",
      name: "Critical Alert Escalation",
      condition: {
        severity: ["critical"],
        failedChannels: ["slack-alerts"],
        timeoutMs: 300000, // 5 minutes
      },
      action: {
        type: "escalate",
        channels: ["pagerduty-critical", "email-primary"],
        template: "critical-failure",
        delay: 60000, // 1 minute delay
      },
    });

    // Failed delivery fallback
    this.addEscalationRule({
      id: "delivery-fallback",
      name: "Delivery Failure Fallback",
      condition: {
        failedChannels: ["slack-alerts", "email-primary"],
        retryCount: 3,
      },
      action: {
        type: "fallback",
        channels: ["webhook-fallback"],
        delay: 30000, // 30 seconds
      },
    });
  }

  // Add notification channel
  public addChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
    this.initializeAdapter(channel);
    this.initializeChannelStats(channel.id);
    console.log(
      `📢 Added notification channel: ${channel.name} (${channel.type})`,
    );
  }

  // Initialize adapters for channels
  private initializeAdapter(channel: NotificationChannel): void {
    switch (channel.type) {
      case "email":
        this.emailAdapter = new EmailAdapter(channel.config);
        break;
      case "slack":
        this.slackAdapter = new SlackAdapter(channel.config);
        break;
      case "teams":
        this.teamsAdapter = new TeamsAdapter(channel.config);
        break;
      case "pagerduty":
        this.pagerDutyAdapter = new PagerDutyAdapter(channel.config);
        break;
      case "webhook":
        this.webhookAdapters.set(
          channel.id,
          new WebhookAdapter(channel.config),
        );
        break;
    }
  }

  // Add notification template
  public addTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
    console.log(`📝 Added notification template: ${template.name}`);
  }

  // Add escalation rule
  public addEscalationRule(rule: EscalationRule): void {
    this.escalationRules.set(rule.id, rule);
    console.log(`⬆️ Added escalation rule: ${rule.name}`);
  }

  // Send notification
  public async sendNotification(
    request: NotificationRequest,
  ): Promise<string[]> {
    const startTime = performance.now();
    const template = this.templates.get(request.templateId);

    if (!template) {
      throw new Error(`Template not found: ${request.templateId}`);
    }

    const channels = request.channels || template.channels;
    const deliveryIds: string[] = [];

    // Create deliveries for each channel
    for (const channelId of channels) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) continue;

      // Check rate limits
      if (!this.checkRateLimit(channelId, channel.rateLimits)) {
        console.warn(`⚠️ Rate limit exceeded for channel: ${channelId}`);
        continue;
      }

      const deliveryId = `${request.id}-${channelId}-${Date.now()}`;
      const delivery: NotificationDelivery = {
        id: deliveryId,
        requestId: request.id,
        channelId,
        status: "pending",
        attempts: 0,
      };

      if (!this.deliveries.has(request.id)) {
        this.deliveries.set(request.id, []);
      }
      this.deliveries.get(request.id)!.push(delivery);
      deliveryIds.push(deliveryId);

      // Send notification asynchronously
      this.sendToChannel(delivery, template, request).catch((error) => {
        console.error(`❌ Failed to send notification to ${channelId}:`, error);
      });
    }

    this.stats.totalSent += deliveryIds.length;
    const responseTime = performance.now() - startTime;
    this.updateAverageResponseTime(responseTime);

    this.emit("notification-sent", {
      requestId: request.id,
      deliveryIds,
      channelCount: deliveryIds.length,
      responseTime,
    });

    return deliveryIds;
  }

  // Send to specific channel with retry logic
  private async sendToChannel(
    delivery: NotificationDelivery,
    template: NotificationTemplate,
    request: NotificationRequest,
  ): Promise<void> {
    const channel = this.channels.get(delivery.channelId)!;
    const maxAttempts = channel.failureHandling.retries + 1;

    while (delivery.attempts < maxAttempts) {
      delivery.attempts++;
      delivery.status = "sending";

      const sendStartTime = performance.now();
      let success = false;

      try {
        // Render template with data
        const renderedContent = this.renderTemplate(template, request.data);

        // Send based on channel type
        success = await this.executeChannelSend(
          channel,
          renderedContent,
          request,
        );

        if (success) {
          delivery.status = "delivered";
          delivery.deliveredAt = Date.now();
          delivery.responseTime = performance.now() - sendStartTime;

          this.updateChannelStats(
            delivery.channelId,
            "delivered",
            delivery.responseTime,
          );
          this.stats.totalDelivered++;

          this.emit("notification-delivered", delivery);
          return;
        }
      } catch (error) {
        delivery.error =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ Channel send error (${delivery.channelId}):`, error);
      }

      // Handle failure
      if (delivery.attempts >= maxAttempts) {
        delivery.status = "failed";
        this.updateChannelStats(delivery.channelId, "failed");
        this.stats.totalFailed++;
        this.emit("notification-failed", delivery);

        // Check escalation rules
        this.checkEscalation(request, delivery);
        return;
      } else {
        delivery.status = "retrying";
        const backoffMs = Math.min(
          1000 *
            Math.pow(
              channel.failureHandling.backoffMultiplier,
              delivery.attempts - 1,
            ),
          channel.failureHandling.maxBackoffMs,
        );

        console.log(
          `🔄 Retrying ${delivery.channelId} in ${backoffMs}ms (attempt ${delivery.attempts}/${maxAttempts})`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  // Execute channel-specific sending
  private async executeChannelSend(
    channel: NotificationChannel,
    content: any,
    request: NotificationRequest,
  ): Promise<boolean> {
    switch (channel.type) {
      case "email":
        if (!this.emailAdapter) return false;
        return await this.emailAdapter.send(
          channel.config.to,
          content.subject,
          content.body,
          content.html,
        );

      case "slack":
        if (!this.slackAdapter) return false;
        return await this.slackAdapter.send(
          content.body,
          content.formatting?.slack?.blocks,
        );

      case "teams":
        if (!this.teamsAdapter) return false;
        return await this.teamsAdapter.send(
          content.subject,
          content.body,
          this.getSeverityColor(request.severity),
        );

      case "pagerduty":
        if (!this.pagerDutyAdapter) return false;
        return await this.pagerDutyAdapter.send(
          request.severity,
          content.subject,
          "MARIA-v3.6.0",
          request.data,
        );

      case "webhook":
        const webhookAdapter = this.webhookAdapters.get(channel.id);
        if (!webhookAdapter) return false;
        return await webhookAdapter.send({
          subject: content.subject,
          body: content.body,
          severity: request.severity,
          data: request.data,
          timestamp: request.timestamp,
        });

      default:
        console.warn(`⚠️ Unsupported channel type: ${channel.type}`);
        return false;
    }
  }

  // Render template with data
  private renderTemplate(
    template: NotificationTemplate,
    data: Record<string, any>,
  ): any {
    const render = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] || match;
      });
    };

    return {
      subject: render(template.subject),
      body: render(template.body),
      html: template.formatting?.html
        ? render(template.formatting.html)
        : undefined,
      formatting: template.formatting,
    };
  }

  // Check rate limits
  private checkRateLimit(
    channelId: string,
    limits: NotificationChannel["rateLimits"],
  ): boolean {
    const now = Date.now();
    const limiter = this.rateLimiters.get(channelId) || {
      count: 0,
      resetTime: now,
    };

    // Reset counter if time window passed
    if (now >= limiter.resetTime) {
      limiter.count = 0;
      limiter.resetTime = now + 60000; // 1 minute window
    }

    // Check limit
    if (limiter.count >= limits.maxPerMinute) {
      return false;
    }

    limiter.count++;
    this.rateLimiters.set(channelId, limiter);
    return true;
  }

  // Check escalation rules
  private checkEscalation(
    request: NotificationRequest,
    failedDelivery: NotificationDelivery,
  ): void {
    for (const [_, rule] of this.escalationRules) {
      let shouldEscalate = false;

      // Check conditions
      if (
        rule.condition.severity &&
        !rule.condition.severity.includes(request.severity)
      ) {
        continue;
      }

      if (rule.condition.failedChannels?.includes(failedDelivery.channelId)) {
        shouldEscalate = true;
      }

      if (
        rule.condition.retryCount &&
        failedDelivery.attempts >= rule.condition.retryCount
      ) {
        shouldEscalate = true;
      }

      if (shouldEscalate) {
        console.log(`⬆️ Escalating notification using rule: ${rule.name}`);

        setTimeout(() => {
          this.sendNotification({
            ...request,
            id: `${request.id}-escalated-${Date.now()}`,
            channels: rule.action.channels,
            templateId: rule.action.template || request.templateId,
          });
        }, rule.action.delay || 0);
      }
    }
  }

  // Utility methods
  private getSeverityColor(severity: string): string {
    const colors = {
      low: "#36a64f",
      medium: "#ffaa00",
      high: "#ff6600",
      critical: "#ff0000",
    };
    return colors[severity as keyof typeof colors] || "#cccccc";
  }

  private initializeChannelStats(channelId: string): void {
    if (!this.stats.channelStats.has(channelId)) {
      this.stats.channelStats.set(channelId, {
        sent: 0,
        delivered: 0,
        failed: 0,
        avgResponseTime: 0,
      });
    }
  }

  private updateChannelStats(
    channelId: string,
    status: "delivered" | "failed",
    responseTime?: number,
  ): void {
    const stats = this.stats.channelStats.get(channelId);
    if (!stats) return;

    stats.sent++;
    if (status === "delivered") {
      stats.delivered++;
      if (responseTime) {
        stats.avgResponseTime =
          (stats.avgResponseTime * (stats.delivered - 1) + responseTime) /
          stats.delivered;
      }
    } else if (status === "failed") {
      stats.failed++;
    }
  }

  private updateAverageResponseTime(responseTime: number): void {
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (this.stats.totalSent - 1) +
        responseTime) /
      this.stats.totalSent;
  }

  // Get notification statistics
  public getStats(): NotificationStats {
    return {
      ...this.stats,
      channelStats: new Map(this.stats.channelStats),
    };
  }

  // Get delivery status
  public getDeliveryStatus(requestId: string): NotificationDelivery[] {
    return this.deliveries.get(requestId) || [];
  }

  // Update channel configuration
  public updateChannel(
    channelId: string,
    updates: Partial<NotificationChannel>,
  ): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      Object.assign(channel, updates);
      this.initializeAdapter(channel);
      console.log(`🔧 Updated channel: ${channelId}`);
    }
  }

  // Enable/disable channel
  public toggleChannel(channelId: string, enabled: boolean): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.enabled = enabled;
      console.log(
        `${enabled ? "✅" : "❌"} Channel ${channelId} ${enabled ? "enabled" : "disabled"}`,
      );
    }
  }
}
