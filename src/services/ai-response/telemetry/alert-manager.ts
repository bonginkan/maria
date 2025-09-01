/**
 * Alert Manager
 * Manages alerts and notifications for the telemetry system
 */

import type { Alert, AlertType } from "./telemetry-types";

export interface AlertConfig {
  type: AlertType;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  metadata?: Record<string, any>;
}

export class AlertManager {
  private static instance: AlertManager;
  private alerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private notificationHandlers: Array<(alert: Alert) => void> = [];

  private constructor() {
    // Constructor implementation
  }

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  /**
   * Create a new alert
   */
  createAlert(config: AlertConfig): Alert {
    const alertId = this.generateAlertId(config.type);

    // Check if similar alert already exists
    const existingAlert = this.findSimilarAlert(config.type, config.message);
    if (existingAlert && !existingAlert.resolved) {
      // Update existing alert timestamp
      existingAlert.timestamp = Date.now();
      return existingAlert;
    }

    const alert: Alert = {
      id: alertId,
      severity: config.severity,
      type: config.type,
      message: config.message,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.set(alertId, alert);
    this.alertHistory.push(alert);

    // Notify handlers
    this.notifyHandlers(alert);

    // Auto-resolve info alerts after 5 minutes
    if (config.severity === "info") {
      setTimeout(() => {
        this.resolveAlert(alertId);
      }, 300000);
    }

    console.log(
      `[Alert] Created: ${config.severity.toUpperCase()} - ${config.message}`,
    );

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      this.alerts.delete(alertId);
      console.log(`[Alert] Resolved: ${alert.message}`);
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter((a) => !a.resolved)
      .sort((a, b) => {
        // Sort by severity then timestamp
        const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
        const severityDiff =
          severityOrder[a.severity] - severityOrder[b.severity];
        return severityDiff !== 0 ? severityDiff : b.timestamp - a.timestamp;
      });
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Check if alert of type exists
   */
  hasActiveAlert(type: AlertType): boolean {
    return Array.from(this.alerts.values()).some(
      (a) => a.type === type && !a.resolved,
    );
  }

  /**
   * Register notification handler
   */
  onAlert(handler: (alert: Alert) => void): void {
    this.notificationHandlers.push(handler);
  }

  /**
   * Remove notification handler
   */
  removeHandler(handler: (alert: Alert) => void): void {
    const index = this.notificationHandlers.indexOf(handler);
    if (index > -1) {
      this.notificationHandlers.splice(index, 1);
    }
  }

  /**
   * Notify all handlers
   */
  private notifyHandlers(alert: Alert): void {
    this.notificationHandlers.forEach((handler) => {
      try {
        handler(alert);
      } catch (error) {
        console.error("[Alert] Handler error:", error);
      }
    });

    // Send to external services if configured
    this.sendToExternalServices(alert);
  }

  /**
   * Send alert to external services
   */
  private async sendToExternalServices(alert: Alert): Promise<void> {
    // Slack notification for critical/error alerts
    if (alert.severity === "critical" || alert.severity === "error") {
      await this.sendToSlack(alert);
    }

    // Log to telemetry endpoint
    if (process.env.TELEMETRY_ENDPOINT) {
      await this.sendToTelemetry(alert);
    }
  }

  /**
   * Send alert to Slack
   */
  private async sendToSlack(alert: Alert): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    const emoji =
      alert.severity === "critical"
        ? "🚨"
        : alert.severity === "error"
          ? "❌"
          : alert.severity === "warning"
            ? "⚠️"
            : "ℹ️";

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${emoji} *AI Response Alert*`,
          attachments: [
            {
              color:
                alert.severity === "critical"
                  ? "danger"
                  : alert.severity === "error"
                    ? "warning"
                    : "good",
              fields: [
                {
                  title: "Severity",
                  value: alert.severity.toUpperCase(),
                  short: true,
                },
                { title: "Type", value: alert.type, short: true },
                { title: "Message", value: alert.message, short: false },
                {
                  title: "Time",
                  value: new Date(alert.timestamp).toISOString(),
                  short: false,
                },
              ],
            },
          ],
        }),
      });
    } catch (innerError) {
      console.error("[Alert] Failed to send to Slack:", error);
    }
  }

  /**
   * Send alert to telemetry
   */
  private async sendToTelemetry(alert: Alert): Promise<void> {
    const endpoint = process.env.TELEMETRY_ENDPOINT;
    if (!endpoint) return;

    try {
      await fetch(`${endpoint}/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.TELEMETRY_API_KEY && {
            Authorization: `Bearer ${process.env.TELEMETRY_API_KEY}`,
          }),
        },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      console.error("[Alert] Failed to send to telemetry:", error);
    }
  }

  /**
   * Find similar alert
   */
  private findSimilarAlert(
    type: AlertType,
    message: string,
  ): Alert | undefined {
    return Array.from(this.alerts.values()).find(
      (a) => a.type === type && a.message === message,
    );
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(type: AlertType): string {
    return `alert_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts.clear();
    console.log("[Alert] All alerts cleared");
  }

  /**
   * Get alert statistics
   */
  getStatistics(): Record<string, any> {
    const stats = {
      active: this.alerts.size,
      total: this.alertHistory.length,
      bySeverity: Record<string, any> as Record<string, number>,
      byType: Record<string, any> as Record<string, number>,
    };

    this.alertHistory.forEach((alert) => {
      stats.bySeverity[alert.severity] =
        (stats.bySeverity[alert.severity] || 0) + 1;
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    });

    return stats;
  }
}
