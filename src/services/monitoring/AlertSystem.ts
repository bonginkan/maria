/**
 * Alert System
 * Phase 4.0 Week 2: Intelligent alerting with configurable thresholds and notifications
 * Features: Multi-channel notifications, escalation, correlation, ML-based anomaly detection
 */

import { EventEmitter } from "node:events";
import * as crypto from "crypto";

export interface AlertSystemConfig {
  enabled: boolean;
  evaluationInterval: number; // milliseconds
  channels: AlertChannel[];
  escalationPolicies: EscalationPolicy[];
  correlationWindow: number; // milliseconds
  anomalyDetection: {
    enabled: boolean;
    sensitivity: "low" | "medium" | "high";
    learningPeriod: number; // hours
  };
  rateLimiting: {
    enabled: boolean;
    maxAlertsPerMinute: number;
    burstLimit: number;
  };
}

export interface AlertChannel {
  id: string;
  type: "email" | "slack" | "teams" | "pagerduty" | "webhook" | "sms";
  config: any;
  enabled: boolean;
  priority: number;
  filters?: AlertFilter[];
}

export interface AlertFilter {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than" | "regex";
  value: any;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  triggers: EscalationTrigger[];
  steps: EscalationStep[];
  enabled: boolean;
}

export interface EscalationTrigger {
  condition: "no_acknowledgment" | "repeated_occurrence" | "severity_increase";
  threshold: number; // minutes for timeout, count for repetition
}

export interface EscalationStep {
  delay: number; // minutes
  channels: string[];
  message?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: AlertCondition;
  severity: "info" | "warning" | "error" | "critical";
  category: "system" | "security" | "performance" | "business";
  channels: string[];
  escalationPolicy?: string;
  tags?: { [key: string]: string };
  suppressionRules?: SuppressionRule[];
}

export interface AlertCondition {
  metric: string;
  operator: ">" | "<" | "=" | ">=" | "<=" | "!=";
  threshold: number;
  duration?: number; // milliseconds - condition must persist
  aggregation?: "avg" | "sum" | "max" | "min" | "count";
  groupBy?: string[];
  filters?: { [key: string]: string };
}

export interface SuppressionRule {
  type: "time_based" | "condition_based" | "dependency_based";
  config: any;
}

export interface Alert {
  id: string;
  ruleId: string;
  timestamp: Date;
  severity: "info" | "warning" | "error" | "critical";
  category: string;
  title: string;
  description: string;
  source: string;
  value: number;
  threshold: number;
  status: "open" | "acknowledged" | "resolved" | "suppressed";
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  escalationLevel: number;
  correlationId?: string;
  tags?: { [key: string]: string };
  metadata?: { [key: string]: any };
}

export interface AlertCorrelation {
  id: string;
  alerts: string[];
  pattern: string;
  confidence: number;
  rootCause?: string;
  created: Date;
}

export interface AnomalyDetection {
  metric: string;
  timestamp: Date;
  value: number;
  expectedValue: number;
  anomalyScore: number;
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * Alert System
 * Intelligent alerting with multi-channel notifications and anomaly detection
 */
export class AlertSystem extends EventEmitter {
  private config: AlertSystemConfig;
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private correlations: Map<string, AlertCorrelation> = new Map();
  private channels: Map<string, AlertChannel> = new Map();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();

  private evaluationTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Anomaly detection state
  private metricBaselines: Map<string, number[]> = new Map();
  private anomalyThresholds: Map<string, number> = new Map();

  // Rate limiting
  private alertCounts: Map<string, number[]> = new Map();

  // Escalation timers
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: AlertSystemConfig) {
    super();
    this.config = this.validateConfig(config);
    this.initializeChannels();
    this.initializeEscalationPolicies();
  }

  /**
   * Start the alert system
   */
  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) return;

    this.isRunning = true;

    // Start evaluation timer
    this.evaluationTimer = setInterval(
      () => this.evaluateRules(),
      this.config.evaluationInterval,
    );

    this.emit("alert_system_started", {
      rules: this.rules.size,
      channels: this.channels.size,
      evaluationInterval: this.config.evaluationInterval,
    });
  }

  /**
   * Stop the alert system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Stop evaluation timer
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }

    // Clear escalation timers
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();

    this.emit("alert_system_stopped");
  }

  /**
   * Add alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.emit("rule_added", rule);
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.emit("rule_removed", { ruleId });
  }

  /**
   * Update alert rule
   */
  updateRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.emit("rule_updated", rule);
  }

  /**
   * Process metric value and check for alerts
   */
  processMetric(
    metricName: string,
    value: number,
    tags?: { [key: string]: string },
  ): void {
    // Update anomaly detection baselines
    if (this.config.anomalyDetection.enabled) {
      this.updateBaseline(metricName, value);
      this.checkAnomaly(metricName, value, tags);
    }

    // Check alert rules
    this.checkMetricAgainstRules(metricName, value, tags);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || alert.status !== "open") return;

    alert.status = "acknowledged";
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    // Cancel escalation timer
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    this.emit("alert_acknowledged", alert);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    alert.status = "resolved";
    alert.resolvedAt = new Date();

    // Cancel escalation timer
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    this.emit("alert_resolved", alert);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(filters?: { severity?: string; category?: string }): Alert[] {
    let alerts = Array.from(this.activeAlerts.values());

    if (filters) {
      if (filters.severity) {
        alerts = alerts.filter((a) => a.severity === filters.severity);
      }
      if (filters.category) {
        alerts = alerts.filter((a) => a.category === filters.category);
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Get alert statistics
   */
  getStatistics(): {
    activeAlerts: number;
    totalAlerts: number;
    alertsByCategory: { [category: string]: number };
    alertsBySeverity: { [severity: string]: number };
    correlations: number;
    anomaliesDetected: number;
  } {
    const activeAlerts = this.activeAlerts.size;
    const alertsByCategory: { [category: string]: number } = {};
    const alertsBySeverity: { [severity: string]: number } = {};

    for (const alert of this.activeAlerts.values()) {
      alertsByCategory[alert.category] =
        (alertsByCategory[alert.category] || 0) + 1;
      alertsBySeverity[alert.severity] =
        (alertsBySeverity[alert.severity] || 0) + 1;
    }

    return {
      activeAlerts,
      totalAlerts: activeAlerts, // Would track historical in production
      alertsByCategory,
      alertsBySeverity,
      correlations: this.correlations.size,
      anomaliesDetected: 0, // Would track in production
    };
  }

  /**
   * Private methods
   */
  private initializeChannels(): void {
    for (const channel of this.config.channels) {
      this.channels.set(channel.id, channel);
    }
  }

  private initializeEscalationPolicies(): void {
    for (const policy of this.config.escalationPolicies) {
      this.escalationPolicies.set(policy.id, policy);
    }
  }

  private async evaluateRules(): Promise<void> {
    // This would typically be called with current metrics
    // For now, it's a placeholder for rule evaluation logic
    this.emit("rules_evaluated", {
      rulesCount: this.rules.size,
      timestamp: new Date(),
    });
  }

  private checkMetricAgainstRules(
    metricName: string,
    value: number,
    tags?: { [key: string]: string },
  ): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (rule.condition.metric !== metricName) continue;

      // Apply filters
      if (rule.condition.filters && tags) {
        let filtersMatch = true;
        for (const [filterKey, filterValue] of Object.entries(
          rule.condition.filters,
        )) {
          if (tags[filterKey] !== filterValue) {
            filtersMatch = false;
            break;
          }
        }
        if (!filtersMatch) continue;
      }

      // Check condition
      const conditionMet = this.evaluateCondition(rule.condition, value);

      if (conditionMet) {
        this.triggerAlert(rule, value, tags);
      }
    }
  }

  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case ">":
        return value > condition.threshold;
      case "<":
        return value < condition.threshold;
      case ">=":
        return value >= condition.threshold;
      case "<=":
        return value <= condition.threshold;
      case "=":
        return value === condition.threshold;
      case "!=":
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(
    rule: AlertRule,
    value: number,
    tags?: { [key: string]: string },
  ): Promise<void> {
    // Check rate limiting
    if (this.config.rateLimiting.enabled && this.isRateLimited(rule.id)) {
      return;
    }

    // Check suppression rules
    if (this.isSuppressed(rule)) {
      return;
    }

    const alertId = crypto.randomUUID();
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      timestamp: new Date(),
      severity: rule.severity,
      category: rule.category,
      title: rule.name,
      description: this.formatDescription(
        rule.description,
        value,
        rule.condition.threshold,
      ),
      source: "alert_system",
      value,
      threshold: rule.condition.threshold,
      status: "open",
      escalationLevel: 0,
      tags: { ...rule.tags, ...tags },
    };

    // Check for correlation
    const correlationId = await this.findCorrelation(alert);
    if (correlationId) {
      alert.correlationId = correlationId;
    }

    this.activeAlerts.set(alertId, alert);

    // Send notifications
    await this.sendNotifications(alert, rule.channels);

    // Set up escalation
    if (rule.escalationPolicy) {
      this.scheduleEscalation(alert, rule.escalationPolicy);
    }

    // Update rate limiting
    this.updateRateLimit(rule.id);

    this.emit("alert_triggered", alert);
  }

  private async sendNotifications(
    alert: Alert,
    channelIds: string[],
  ): Promise<void> {
    const notifications: Promise<void>[] = [];

    for (const channelId of channelIds) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) continue;

      // Check channel filters
      if (channel.filters && !this.passesFilters(alert, channel.filters)) {
        continue;
      }

      notifications.push(this.sendToChannel(alert, channel));
    }

    await Promise.allSettled(notifications);
  }

  private async sendToChannel(
    alert: Alert,
    channel: AlertChannel,
  ): Promise<void> {
    try {
      switch (channel.type) {
        case "email":
          await this.sendEmail(alert, channel.config);
          break;
        case "slack":
          await this.sendSlack(alert, channel.config);
          break;
        case "webhook":
          await this.sendWebhook(alert, channel.config);
          break;
        case "pagerduty":
          await this.sendPagerDuty(alert, channel.config);
          break;
        // Add other channel types as needed
      }

      this.emit("notification_sent", {
        alertId: alert.id,
        channelId: channel.id,
        channelType: channel.type,
      });
    } catch (error) {
      this.emit("notification_error", {
        alertId: alert.id,
        channelId: channel.id,
        error,
      });
    }
  }

  private scheduleEscalation(alert: Alert, policyId: string): void {
    const policy = this.escalationPolicies.get(policyId);
    if (!policy || !policy.enabled) return;

    // Schedule first escalation step
    if (policy.steps.length > 0) {
      const firstStep = policy.steps[0];
      const timer = setTimeout(
        () => {
          this.executeEscalation(alert, policy, 0);
        },
        firstStep.delay * 60 * 1000,
      );

      this.escalationTimers.set(alert.id, timer);
    }
  }

  private async executeEscalation(
    alert: Alert,
    policy: EscalationPolicy,
    stepIndex: number,
  ): Promise<void> {
    if (stepIndex >= policy.steps.length) return;
    if (alert.status !== "open") return; // Alert was acknowledged or resolved

    const step = policy.steps[stepIndex];
    alert.escalationLevel = stepIndex + 1;

    // Send escalated notifications
    await this.sendNotifications(alert, step.channels);

    // Schedule next escalation step
    if (stepIndex + 1 < policy.steps.length) {
      const nextStep = policy.steps[stepIndex + 1];
      const timer = setTimeout(
        () => {
          this.executeEscalation(alert, policy, stepIndex + 1);
        },
        nextStep.delay * 60 * 1000,
      );

      this.escalationTimers.set(alert.id, timer);
    }

    this.emit("alert_escalated", {
      alertId: alert.id,
      level: alert.escalationLevel,
      step: step,
    });
  }

  private async findCorrelation(alert: Alert): Promise<string | undefined> {
    const now = alert.timestamp.getTime();
    const windowStart = now - this.config.correlationWindow;

    // Simple correlation logic - find alerts in the same window
    const recentAlerts = Array.from(this.activeAlerts.values()).filter(
      (a) => a.timestamp.getTime() >= windowStart && a.id !== alert.id,
    );

    if (recentAlerts.length === 0) return undefined;

    // Group by category and severity
    const correlationId = crypto.randomUUID();
    const correlation: AlertCorrelation = {
      id: correlationId,
      alerts: [alert.id, ...recentAlerts.map((a) => a.id)],
      pattern: `${alert.category}_${alert.severity}`,
      confidence: this.calculateCorrelationConfidence(alert, recentAlerts),
      created: new Date(),
    };

    this.correlations.set(correlationId, correlation);

    return correlationId;
  }

  private calculateCorrelationConfidence(
    alert: Alert,
    recentAlerts: Alert[],
  ): number {
    let score = 0;

    for (const recentAlert of recentAlerts) {
      if (recentAlert.category === alert.category) score += 0.3;
      if (recentAlert.severity === alert.severity) score += 0.3;
      if (recentAlert.source === alert.source) score += 0.2;

      // Check tag similarity
      const commonTags = this.countCommonTags(
        alert.tags || {},
        recentAlert.tags || {},
      );
      score += Math.min(commonTags * 0.1, 0.2);
    }

    return Math.min(score, 1.0);
  }

  private countCommonTags(
    tags1: { [key: string]: string },
    tags2: { [key: string]: string },
  ): number {
    let common = 0;
    for (const [key, value] of Object.entries(tags1)) {
      if (tags2[key] === value) common++;
    }
    return common;
  }

  private updateBaseline(metricName: string, value: number): void {
    let baseline = this.metricBaselines.get(metricName);
    if (!baseline) {
      baseline = [];
      this.metricBaselines.set(metricName, baseline);
    }

    baseline.push(value);

    // Keep only recent values for baseline calculation
    const maxPoints = 1000;
    if (baseline.length > maxPoints) {
      baseline.splice(0, baseline.length - maxPoints);
    }

    // Calculate anomaly threshold
    if (baseline.length >= 10) {
      const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
      const variance =
        baseline.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
        baseline.length;
      const stdDev = Math.sqrt(variance);

      let multiplier = 2; // Default sensitivity
      switch (this.config.anomalyDetection.sensitivity) {
        case "low":
          multiplier = 3;
          break;
        case "medium":
          multiplier = 2;
          break;
        case "high":
          multiplier = 1.5;
          break;
      }

      this.anomalyThresholds.set(metricName, mean + stdDev * multiplier);
    }
  }

  private checkAnomaly(
    metricName: string,
    value: number,
    tags?: { [key: string]: string },
  ): void {
    const threshold = this.anomalyThresholds.get(metricName);
    if (!threshold) return;

    if (value > threshold) {
      const baseline = this.metricBaselines.get(metricName) || [];
      const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
      const anomalyScore = Math.abs(value - mean) / mean;

      let severity: "low" | "medium" | "high" | "critical" = "low";
      if (anomalyScore > 2) severity = "critical";
      else if (anomalyScore > 1.5) severity = "high";
      else if (anomalyScore > 1) severity = "medium";

      const anomaly: AnomalyDetection = {
        metric: metricName,
        timestamp: new Date(),
        value,
        expectedValue: mean,
        anomalyScore,
        severity,
      };

      this.emit("anomaly_detected", anomaly);

      // Create alert for high-severity anomalies
      if (severity === "high" || severity === "critical") {
        // Would create an alert rule dynamically
      }
    }
  }

  private isRateLimited(ruleId: string): boolean {
    if (!this.config.rateLimiting.enabled) return false;

    const now = Date.now();
    const minute = Math.floor(now / 60000);

    let counts = this.alertCounts.get(ruleId);
    if (!counts) {
      counts = [];
      this.alertCounts.set(ruleId, counts);
    }

    // Clean old counts
    this.alertCounts.set(
      ruleId,
      counts.filter((t) => t > now - 60000),
    );

    return counts.length >= this.config.rateLimiting.maxAlertsPerMinute;
  }

  private updateRateLimit(ruleId: string): void {
    if (!this.config.rateLimiting.enabled) return;

    let counts = this.alertCounts.get(ruleId);
    if (!counts) {
      counts = [];
      this.alertCounts.set(ruleId, counts);
    }

    counts.push(Date.now());
  }

  private isSuppressed(rule: AlertRule): boolean {
    // Simple suppression logic - could be extended
    return false;
  }

  private passesFilters(alert: Alert, filters: AlertFilter[]): boolean {
    for (const filter of filters) {
      if (!this.evaluateFilter(alert, filter)) {
        return false;
      }
    }
    return true;
  }

  private evaluateFilter(alert: Alert, filter: AlertFilter): boolean {
    let fieldValue: any;

    switch (filter.field) {
      case "severity":
        fieldValue = alert.severity;
        break;
      case "category":
        fieldValue = alert.category;
        break;
      default:
        fieldValue = alert.tags?.[filter.field];
    }

    if (fieldValue === undefined) return false;

    switch (filter.operator) {
      case "equals":
        return fieldValue === filter.value;
      case "contains":
        return String(fieldValue).includes(String(filter.value));
      case "greater_than":
        return Number(fieldValue) > Number(filter.value);
      case "less_than":
        return Number(fieldValue) < Number(filter.value);
      case "regex":
        return new RegExp(filter.value).test(String(fieldValue));
      default:
        return false;
    }
  }

  private formatDescription(
    template: string,
    value: number,
    threshold: number,
  ): string {
    return template
      .replace("{value}", value.toString())
      .replace("{threshold}", threshold.toString());
  }

  // Channel-specific notification methods (placeholders)
  private async sendEmail(alert: Alert, config: any): Promise<void> {
    // Would integrate with email service
    console.log(`Email notification for alert ${alert.id}`);
  }

  private async sendSlack(alert: Alert, config: any): Promise<void> {
    // Would integrate with Slack API
    console.log(`Slack notification for alert ${alert.id}`);
  }

  private async sendWebhook(alert: Alert, config: any): Promise<void> {
    // Would send HTTP POST to webhook URL
    console.log(`Webhook notification for alert ${alert.id}`);
  }

  private async sendPagerDuty(alert: Alert, config: any): Promise<void> {
    // Would integrate with PagerDuty API
    console.log(`PagerDuty notification for alert ${alert.id}`);
  }

  private validateConfig(config: AlertSystemConfig): AlertSystemConfig {
    return {
      ...config,
      evaluationInterval: Math.max(config.evaluationInterval, 1000), // Min 1 second
      correlationWindow: Math.max(config.correlationWindow, 60000), // Min 1 minute
      rateLimiting: {
        enabled: config.rateLimiting?.enabled || false,
        maxAlertsPerMinute: config.rateLimiting?.maxAlertsPerMinute || 10,
        burstLimit: config.rateLimiting?.burstLimit || 20,
      },
      anomalyDetection: {
        enabled: config.anomalyDetection?.enabled || false,
        sensitivity: config.anomalyDetection?.sensitivity || "medium",
        learningPeriod: config.anomalyDetection?.learningPeriod || 24,
      },
    };
  }
}

/**
 * Factory function to create alert system
 */
export function createAlertSystem(config: AlertSystemConfig): AlertSystem {
  return new AlertSystem(config);
}
