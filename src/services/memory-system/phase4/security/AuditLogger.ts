/**
 * Enterprise Audit Logging System
 * Phase 4.0 Security: Comprehensive audit trail for compliance and monitoring
 * Supports HIPAA, SOC2, PCI-DSS, GDPR compliance requirements
 */

import { EventEmitter } from "node:events";
import * as crypto from "crypto";
import { createWriteStream, WriteStream } from "fs";
import { mkdir } from "fs/promises";
import * as path from "path";

export interface AuditConfig {
  enabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error" | "critical";
  destinations: AuditDestination[];
  retention: {
    days: number;
    archiveEnabled: boolean;
    archiveLocation?: string;
  };
  encryption: {
    enabled: boolean;
    keyId?: string;
  };
  compliance: {
    mode: "HIPAA" | "SOC2" | "PCI-DSS" | "GDPR" | "none";
    includePersonalData: boolean;
    maskSensitiveData: boolean;
  };
  alerting: {
    enabled: boolean;
    criticalEvents: string[];
    destinations: AlertDestination[];
  };
  performance: {
    batchSize: number;
    flushInterval: number; // milliseconds
    maxQueueSize: number;
  };
}

export interface AuditDestination {
  type:
    | "file"
    | "database"
    | "siem"
    | "cloudwatch"
    | "splunk"
    | "elasticsearch";
  config: any;
  filter?: AuditFilter;
}

export interface AlertDestination {
  type: "email" | "slack" | "pagerduty" | "webhook";
  config: any;
  severity: ("warn" | "error" | "critical")[];
}

export interface AuditFilter {
  categories?: string[];
  severities?: string[];
  users?: string[];
  resources?: string[];
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  category: AuditCategory;
  action: string;
  severity: "debug" | "info" | "warn" | "error" | "critical";
  userId?: string;
  sessionId?: string;
  resourceId?: string;
  resourceType?: string;
  result: "success" | "failure" | "partial";
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  source: {
    ip?: string;
    userAgent?: string;
    hostname?: string;
    service?: string;
    version?: string;
  };
  compliance?: {
    regulation?: string;
    requirement?: string;
    controlId?: string;
  };
  performance?: {
    duration?: number;
    bytesProcessed?: number;
    recordsAffected?: number;
  };
  security?: {
    threatLevel?: "low" | "medium" | "high" | "critical";
    attackVector?: string;
    authenticated?: boolean;
    authorized?: boolean;
  };
}

export type AuditCategory =
  | "authentication"
  | "authorization"
  | "data_access"
  | "data_modification"
  | "data_deletion"
  | "configuration"
  | "encryption"
  | "key_management"
  | "system"
  | "network"
  | "compliance"
  | "security";

export interface AuditStatistics {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByResult: Record<string, number>;
  failureRate: number;
  averageResponseTime: number;
  topUsers: Array<{ userId: string; count: number }>;
  topResources: Array<{ resourceId: string; count: number }>;
  securityAlerts: number;
  complianceViolations: number;
}

export interface ComplianceReport {
  period: { start: Date; end: Date };
  regulation: string;
  totalEvents: number;
  violations: number;
  riskScore: number;
  details: ComplianceDetail[];
}

export interface ComplianceDetail {
  requirement: string;
  status: "compliant" | "non-compliant" | "partial";
  events: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Audit Logger
 * Enterprise-grade audit logging with compliance support
 */
export class AuditLogger extends EventEmitter {
  private config: AuditConfig;
  private eventQueue: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private fileStream: WriteStream | null = null;
  private statistics: AuditStatistics;
  private isInitialized = false;

  // Compliance mappings
  private complianceRequirements = {
    HIPAA: {
      categories: [
        "authentication",
        "authorization",
        "data_access",
        "data_modification",
      ],
      retention: 6 * 365, // 6 years
      encryption: true,
      fields: ["userId", "timestamp", "action", "resourceId", "result"],
    },
    "PCI-DSS": {
      categories: ["authentication", "authorization", "data_access", "network"],
      retention: 365, // 1 year
      encryption: true,
      fields: ["userId", "timestamp", "action", "source.ip", "result"],
    },
    SOC2: {
      categories: ["authentication", "authorization", "system", "security"],
      retention: 7 * 365, // 7 years
      encryption: false,
      fields: ["userId", "timestamp", "action", "result", "errorMessage"],
    },
    GDPR: {
      categories: [
        "data_access",
        "data_modification",
        "data_deletion",
        "compliance",
      ],
      retention: 3 * 365, // 3 years
      encryption: true,
      fields: [
        "userId",
        "timestamp",
        "action",
        "resourceId",
        "metadata.purpose",
      ],
    },
  };

  constructor(config: AuditConfig) {
    super();
    this.config = this.validateConfig(config);
    this.statistics = this.initializeStatistics();
  }

  /**
   * Initialize the audit logger
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize destinations
      for (const destination of this.config.destinations) {
        await this.initializeDestination(destination);
      }

      // Set up flush timer
      if (this.config.performance.flushInterval > 0) {
        this.flushTimer = setInterval(
          () => this.flush(),
          this.config.performance.flushInterval,
        );
      }

      this.isInitialized = true;
      this.emit("initialized");

      // Log initialization
      await this.log({
        category: "system",
        action: "audit_logger_initialized",
        severity: "info",
        result: "success",
        metadata: {
          compliance: this.config.compliance.mode,
          destinations: this.config.destinations.length,
        },
      });
    } catch (error) {
      this.emit("initialization_error", error);
      throw error;
    }
  }

  /**
   * Log an audit event
   */
  async log(event: Partial<AuditEvent>): Promise<void> {
    if (!this.config.enabled) return;

    // Create full event
    const fullEvent: AuditEvent = {
      id: event.id || crypto.randomUUID(),
      timestamp: event.timestamp || new Date(),
      category: event.category || "system",
      action: event.action || "unknown",
      severity: event.severity || "info",
      result: event.result || "success",
      source: event.source || {},
      ...event,
    };

    // Apply compliance rules
    if (this.config.compliance.mode !== "none") {
      fullEvent.compliance = {
        regulation: this.config.compliance.mode,
        ...event.compliance,
      };
    }

    // Mask sensitive data if required
    if (this.config.compliance.maskSensitiveData) {
      this.maskSensitiveData(fullEvent);
    }

    // Check severity level
    if (!this.shouldLog(fullEvent)) return;

    // Add to queue
    this.eventQueue.push(fullEvent);

    // Update statistics
    this.updateStatistics(fullEvent);

    // Check for critical events
    if (fullEvent.severity === "critical" || fullEvent.result === "failure") {
      await this.handleCriticalEvent(fullEvent);
    }

    // Flush if queue is full
    if (this.eventQueue.length >= this.config.performance.batchSize) {
      await this.flush();
    }

    this.emit("event_logged", fullEvent);
  }

  /**
   * Flush queued events to destinations
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Write to each destination
      const promises = this.config.destinations.map((destination) =>
        this.writeToDestination(destination, events),
      );

      await Promise.allSettled(promises);

      this.emit("events_flushed", { count: events.length });
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
      this.emit("flush_error", error);

      // Trim queue if it's too large
      if (this.eventQueue.length > this.config.performance.maxQueueSize) {
        const dropped = this.eventQueue.splice(
          this.config.performance.maxQueueSize,
        );
        this.emit("events_dropped", { count: dropped.length });
      }
    }
  }

  /**
   * Search audit logs
   */
  async search(criteria: {
    startDate?: Date;
    endDate?: Date;
    categories?: AuditCategory[];
    users?: string[];
    resources?: string[];
    severities?: string[];
    results?: string[];
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    // In production, this would search from persistent storage
    // For now, return empty array
    return [];
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    regulation: "HIPAA" | "SOC2" | "PCI-DSS" | "GDPR",
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceReport> {
    const requirements = this.complianceRequirements[regulation];

    // Search for relevant events
    const events = await this.search({
      startDate,
      endDate,
      categories: requirements.categories,
    });

    // Analyze compliance
    const violations = events.filter((e) => e.result === "failure").length;
    const riskScore = this.calculateRiskScore(events, regulation);

    // Generate details
    const details: ComplianceDetail[] = this.analyzeComplianceDetails(
      events,
      regulation,
    );

    return {
      period: { start: startDate, end: endDate },
      regulation,
      totalEvents: events.length,
      violations,
      riskScore,
      details,
    };
  }

  /**
   * Get audit statistics
   */
  getStatistics(): AuditStatistics {
    return { ...this.statistics };
  }

  /**
   * Archive old audit logs
   */
  async archive(beforeDate: Date): Promise<number> {
    // In production, move old logs to archive storage
    const archived = 0;

    this.emit("logs_archived", {
      beforeDate,
      count: archived,
    });

    return archived;
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    // In production, verify cryptographic signatures and checksums
    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Shutdown the audit logger
   */
  async shutdown(): Promise<void> {
    // Flush remaining events
    await this.flush();

    // Clear timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Close file stream
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }

    this.isInitialized = false;
    this.emit("shutdown");
  }

  /**
   * Private helper methods
   */
  private validateConfig(config: AuditConfig): AuditConfig {
    return {
      ...config,
      performance: {
        batchSize: config.performance?.batchSize || 100,
        flushInterval: config.performance?.flushInterval || 5000,
        maxQueueSize: config.performance?.maxQueueSize || 10000,
      },
      retention: {
        days: config.retention?.days || 90,
        archiveEnabled: config.retention?.archiveEnabled || false,
      },
    };
  }

  private initializeStatistics(): AuditStatistics {
    return {
      totalEvents: 0,
      eventsByCategory: {},
      eventsBySeverity: {},
      eventsByResult: {},
      failureRate: 0,
      averageResponseTime: 0,
      topUsers: [],
      topResources: [],
      securityAlerts: 0,
      complianceViolations: 0,
    };
  }

  private async initializeDestination(
    destination: AuditDestination,
  ): Promise<void> {
    switch (destination.type) {
      case "file":
        await this.initializeFileDestination(destination.config);
        break;
      case "database":
        // Initialize database connection
        break;
      case "cloudwatch":
        // Initialize CloudWatch client
        break;
      case "splunk":
        // Initialize Splunk forwarder
        break;
      case "elasticsearch":
        // Initialize Elasticsearch client
        break;
    }
  }

  private async initializeFileDestination(config: any): Promise<void> {
    const logDir = config.directory || "./audit-logs";
    await mkdir(logDir, { recursive: true });

    const logFile = path.join(logDir, `audit-${Date.now()}.log`);
    this.fileStream = createWriteStream(logFile, { flags: "a" });
  }

  private shouldLog(event: AuditEvent): boolean {
    const levels = ["debug", "info", "warn", "error", "critical"];
    const eventLevel = levels.indexOf(event.severity);
    const configLevel = levels.indexOf(this.config.logLevel);

    return eventLevel >= configLevel;
  }

  private maskSensitiveData(event: AuditEvent): void {
    // Mask PII and sensitive data
    if (event.metadata) {
      const sensitive = [
        "password",
        "token",
        "key",
        "secret",
        "ssn",
        "creditCard",
      ];

      for (const key of Object.keys(event.metadata)) {
        if (sensitive.some((s) => key.toLowerCase().includes(s))) {
          event.metadata[key] = "***MASKED***";
        }
      }
    }

    // Mask IP addresses if required by GDPR
    if (this.config.compliance.mode === "GDPR" && event.source.ip) {
      // Mask last octet of IPv4
      event.source.ip = event.source.ip.replace(/\.\d+$/, ".xxx");
    }
  }

  private updateStatistics(event: AuditEvent): void {
    this.statistics.totalEvents++;

    // Update category counts
    this.statistics.eventsByCategory[event.category] =
      (this.statistics.eventsByCategory[event.category] || 0) + 1;

    // Update severity counts
    this.statistics.eventsBySeverity[event.severity] =
      (this.statistics.eventsBySeverity[event.severity] || 0) + 1;

    // Update result counts
    this.statistics.eventsByResult[event.result] =
      (this.statistics.eventsByResult[event.result] || 0) + 1;

    // Update failure rate
    const failures = this.statistics.eventsByResult.failure || 0;
    this.statistics.failureRate = failures / this.statistics.totalEvents;

    // Update performance metrics
    if (event.performance?.duration) {
      const alpha = 0.1; // Exponential moving average factor
      this.statistics.averageResponseTime =
        this.statistics.averageResponseTime * (1 - alpha) +
        event.performance.duration * alpha;
    }

    // Update security alerts
    if (
      event.security?.threatLevel === "high" ||
      event.security?.threatLevel === "critical"
    ) {
      this.statistics.securityAlerts++;
    }

    // Update compliance violations
    if (event.result === "failure" && event.compliance) {
      this.statistics.complianceViolations++;
    }
  }

  private async handleCriticalEvent(event: AuditEvent): Promise<void> {
    if (!this.config.alerting.enabled) return;

    // Check if this event type should trigger alerts
    const shouldAlert = this.config.alerting.criticalEvents.some(
      (pattern) => event.action.includes(pattern) || event.category === pattern,
    );

    if (!shouldAlert) return;

    // Send alerts to configured destinations
    for (const destination of this.config.alerting.destinations) {
      if (destination.severity.includes(event.severity)) {
        await this.sendAlert(destination, event);
      }
    }

    this.emit("critical_event", event);
  }

  private async sendAlert(
    destination: AlertDestination,
    event: AuditEvent,
  ): Promise<void> {
    switch (destination.type) {
      case "email":
        // Send email alert
        break;
      case "slack":
        // Send Slack notification
        break;
      case "pagerduty":
        // Trigger PagerDuty incident
        break;
      case "webhook":
        // Call webhook
        break;
    }

    this.emit("alert_sent", {
      destination: destination.type,
      event: event.id,
    });
  }

  private async writeToDestination(
    destination: AuditDestination,
    events: AuditEvent[],
  ): Promise<void> {
    // Apply filters
    let filteredEvents = events;
    if (destination.filter) {
      filteredEvents = this.applyFilter(events, destination.filter);
    }

    if (filteredEvents.length === 0) return;

    // Encrypt if required
    let data: any = filteredEvents;
    if (this.config.encryption.enabled) {
      data = await this.encryptEvents(filteredEvents);
    }

    // Write to destination
    switch (destination.type) {
      case "file":
        await this.writeToFile(data);
        break;
      case "database":
        await this.writeToDatabase(data, destination.config);
        break;
      case "cloudwatch":
        await this.writeToCloudWatch(data, destination.config);
        break;
      case "splunk":
        await this.writeToSplunk(data, destination.config);
        break;
      case "elasticsearch":
        await this.writeToElasticsearch(data, destination.config);
        break;
    }
  }

  private applyFilter(events: AuditEvent[], filter: AuditFilter): AuditEvent[] {
    return events.filter((event) => {
      if (filter.categories && !filter.categories.includes(event.category)) {
        return false;
      }
      if (filter.severities && !filter.severities.includes(event.severity)) {
        return false;
      }
      if (
        filter.users &&
        event.userId &&
        !filter.users.includes(event.userId)
      ) {
        return false;
      }
      if (
        filter.resources &&
        event.resourceId &&
        !filter.resources.includes(event.resourceId)
      ) {
        return false;
      }
      return true;
    });
  }

  private async encryptEvents(events: AuditEvent[]): Promise<string> {
    // In production, use KMS to encrypt
    const data = JSON.stringify(events);
    const cipher = crypto.createCipher("aes-256-cbc", "encryption-key");
    return cipher.update(data, "utf8", "hex") + cipher.final("hex");
  }

  private async writeToFile(data: any): Promise<void> {
    if (!this.fileStream) return;

    const line = typeof data === "string" ? data : JSON.stringify(data);
    this.fileStream.write(line + "\n");
  }

  private async writeToDatabase(data: any, config: any): Promise<void> {
    // Write to database
  }

  private async writeToCloudWatch(data: any, config: any): Promise<void> {
    // Send to AWS CloudWatch
  }

  private async writeToSplunk(data: any, config: any): Promise<void> {
    // Send to Splunk
  }

  private async writeToElasticsearch(data: any, config: any): Promise<void> {
    // Send to Elasticsearch
  }

  private calculateRiskScore(events: AuditEvent[], regulation: string): number {
    let score = 0;

    // Calculate based on failures
    const failures = events.filter((e) => e.result === "failure").length;
    score += (failures / events.length) * 30;

    // Calculate based on severity
    const critical = events.filter((e) => e.severity === "critical").length;
    const errors = events.filter((e) => e.severity === "error").length;
    score += (critical / events.length) * 40;
    score += (errors / events.length) * 20;

    // Calculate based on security threats
    const threats = events.filter(
      (e) =>
        e.security?.threatLevel === "high" ||
        e.security?.threatLevel === "critical",
    ).length;
    score += (threats / events.length) * 10;

    return Math.min(100, Math.round(score));
  }

  private analyzeComplianceDetails(
    events: AuditEvent[],
    regulation: string,
  ): ComplianceDetail[] {
    // Analyze events for compliance requirements
    // This is simplified - real implementation would check specific requirements
    return [
      {
        requirement: "Access Control",
        status: events.some(
          (e) => e.category === "authorization" && e.result === "failure",
        )
          ? "partial"
          : "compliant",
        events: events.filter((e) => e.category === "authorization").length,
        issues: [],
        recommendations: [],
      },
      {
        requirement: "Audit Logging",
        status: "compliant",
        events: events.length,
        issues: [],
        recommendations: [],
      },
      {
        requirement: "Data Encryption",
        status: this.config.encryption.enabled ? "compliant" : "non-compliant",
        events: events.filter((e) => e.category === "encryption").length,
        issues: this.config.encryption.enabled
          ? []
          : ["Encryption not enabled"],
        recommendations: this.config.encryption.enabled
          ? []
          : ["Enable audit log encryption"],
      },
    ];
  }
}

/**
 * Factory function to create audit logger
 */
export function createAuditLogger(config: AuditConfig): AuditLogger {
  return new AuditLogger(config);
}
