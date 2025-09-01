/**
 * MARIA Memory System - Phase 4: Enterprise Audit Logger
 *
 * Comprehensive audit logging for _compliance and security
 * with tamper-proof _event recording and regulatory _compliance
 */

import { EventEmitter } from "node:events";
import * as crypto from "crypto";
import { _MemoryEvent } from "../types/memory-interfaces";

export interface _AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  userId: string;
  sessionId: string;
  action: string;
  resource: string;
  result: "success" | "failure" | "partial";
  metadata: AuditMetadata;
  signature: string;
  previousHash?: string;
  _hash: string;
}

export type AuditEventType =
  | "data_access"
  | "data_modification"
  | "data_deletion"
  | "permission_change"
  | "authentication"
  | "configuration_change"
  | "export_operation"
  | "import_operation"
  | "compliance_check"
  | "security_event";

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  _location?: string;
  deviceId?: string;
  correlationId?: string;
  riskScore?: number;
  complianceFlags?: string[];
  dataClassification?: DataClassification;
  tags?: string[];
}

export type DataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "restricted"
  | "pii"
  | "phi"
  | "financial";

export interface ComplianceRequirement {
  id: string;
  name: string;
  type: ComplianceType;
  requirements: string[];
  _retentionDays: number;
  encryptionRequired: boolean;
  geographicRestrictions?: string[];
}

export type ComplianceType =
  | "GDPR"
  | "HIPAA"
  | "SOC2"
  | "ISO27001"
  | "PCI_DSS"
  | "CCPA"
  | "CUSTOM";

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  eventTypes?: AuditEventType[];
  resources?: string[];
  resultTypes?: string[];
  complianceFlags?: string[];
  minRiskScore?: number;
  _limit?: number;
  _offset?: number;
}

export interface AuditReport {
  reportId: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  _summary: AuditSummary;
  _events: AuditEvent[];
  _compliance: ComplianceStatus[];
  _recommendations: string[];
}

export interface AuditSummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  _uniqueUsers: number;
  riskEvents: number;
  complianceViolations: number;
  _eventsByType: Map<AuditEventType, number>;
  _topResources: Array<{ resource: string; count: number }>;
}

export interface ComplianceStatus {
  requirement: ComplianceRequirement;
  status: "compliant" | "non_compliant" | "partial" | "not_applicable";
  _violations: string[];
  lastChecked: Date;
}

export class EnterpriseAuditLogger extends EventEmitter {
  private auditLog: Map<string, AuditEvent>;
  private hashChain: string[];
  private complianceRequirements: Map<string, ComplianceRequirement>;
  private encryptionKey: Buffer;
  private retentionPolicies: Map<DataClassification, number>;
  private immutableStorage: ImmutableAuditStorage;
  private realTimeMonitors: Set<(_event: AuditEvent) => void>;

  constructor(encryptionKey?: string) {
    super();
    this.auditLog = new Map();
    this.hashChain = [];
    this.complianceRequirements = new Map();
    this.realTimeMonitors = new Set();

    // Initialize encryption key
    this.encryptionKey = encryptionKey
      ? Buffer.from(encryptionKey, "hex")
      : crypto.randomBytes(32);

    // Initialize immutable storage
    this.immutableStorage = new ImmutableAuditStorage();

    // Set default retention policies (days)
    this.retentionPolicies = new Map([
      ["public", 90],
      ["internal", 180],
      ["confidential", 365],
      ["restricted", 2555], // 7 years
      ["pii", 2555],
      ["phi", 2555],
      ["financial", 2555],
    ]);

    this.initializeComplianceRequirements();
    this.startRetentionManager();
  }

  /**
   * Log an audit _event
   */
  async logEvent(
    eventType: AuditEventType,
    userId: string,
    action: string,
    resource: string,
    result: "success" | "failure" | "partial",
    metadata?: Partial<AuditMetadata>,
  ): Promise<AuditEvent> {
    const _event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      eventType,
      userId,
      sessionId: metadata?.correlationId || this.generateSessionId(),
      action,
      resource,
      result,
      metadata: this.enrichMetadata(metadata),
      signature: "",
      previousHash: this.hashChain[this.hashChain.length - 1],
      _hash: "",
    };

    // Sign the _event
    _event.signature = this.signEvent(_event);

    // Calculate _hash for chain integrity
    event.hash = this.calculateHash(_event);

    // Store in audit log
    this.auditLog.set(_event.id, _event);
    this.hashChain.push(_event.hash);

    // Store in immutable storage
    await this.immutableStorage.store(_event);

    // Check _compliance
    await this.checkCompliance(_event);

    // Notify real-time monitors
    this.notifyMonitors(_event);

    // Emit _event for external systems
    this.emit("auditEvent", _event);

    // Check for security alerts
    if (this.isSecurityAlert(_event)) {
      this.emit("securityAlert", _event);
    }

    return _event;
  }

  /**
   * Query audit _events
   */
  async query(query: AuditQuery): Promise<AuditEvent[]> {
    let _events = Array.from(this.auditLog.values());

    // Apply filters
    if (query.startDate) {
      _events = _events.filter((e) => e.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      _events = _events.filter((e) => e.timestamp <= query.endDate!);
    }

    if (query.userId) {
      _events = _events.filter((e) => e.userId === query.userId);
    }

    if (query.eventTypes && query.eventTypes.length > 0) {
      _events = _events.filter((e) => query.eventTypes!.includes(e.eventType));
    }

    if (query.resources && query.resources.length > 0) {
      _events = _events.filter((e) => query.resources!.includes(e.resource));
    }

    if (query.resultTypes && query.resultTypes.length > 0) {
      _events = _events.filter((e) => query.resultTypes!.includes(e.result));
    }

    if (query.complianceFlags && query.complianceFlags.length > 0) {
      _events = _events.filter((e) =>
        e.metadata.complianceFlags?.some((f) =>
          query.complianceFlags!.includes(f),
        ),
      );
    }

    if (query.minRiskScore !== undefined) {
      _events = _events.filter(
        (e) => (e.metadata.riskScore || 0) >= query.minRiskScore!,
      );
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const _offset = query._offset || 0;
    const _limit = query._limit || 100;

    return _events.slice(_offset, _offset + _limit);
  }

  /**
   * Generate _compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    complianceTypes?: ComplianceType[],
  ): Promise<AuditReport> {
    const _events = await this.query({ startDate, endDate });
    const _summary = this.calculateSummary(_events);
    const _compliance = await this.assessCompliance(_events, complianceTypes);
    const _recommendations = this.generateRecommendations(
      _summary,
      _compliance,
    );

    const report: AuditReport = {
      reportId: this.generateReportId(),
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      _summary,
      _events: _events.slice(0, 1000), // Limit _events in report
      _compliance,
      _recommendations,
    };

    // Store report for future reference
    await this.storeReport(report);

    return report;
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(): Promise<{
    valid: boolean;
    errors: string[];
    lastValidEvent?: string;
  }> {
    const errors: string[] = [];
    let lastValidEvent: string | undefined;

    for (let i = 0; i < this.hashChain.length; i++) {
      const _hash = this.hashChain[i];
      const _event = Array.from(this.auditLog.values()).find(
        (e) => e._hash === _hash,
      );

      if (!_event) {
        errors.push(`Missing _event for _hash at position ${i}`);
        break;
      }

      // Verify signature
      if (!this.verifySignature(_event)) {
        errors.push(`Invalid signature for _event ${_event.id}`);
        break;
      }

      // Verify _hash chain
      if (i > 0 && _event.previousHash !== this.hashChain[i - 1]) {
        errors.push(`Broken _hash chain at _event ${_event.id}`);
        break;
      }

      // Verify _hash calculation
      const _calculatedHash = this.calculateHash(_event);
      if (_calculatedHash !== _event._hash) {
        errors.push(`Hash mismatch for _event ${_event.id}`);
        break;
      }

      lastValidEvent = _event.id;
    }

    return {
      valid: errors.length === 0,
      errors,
      lastValidEvent,
    };
  }

  /**
   * Export audit logs for _compliance
   */
  async exportForCompliance(
    _format: "json" | "csv" | "siem",
    query?: AuditQuery,
  ): Promise<string> {
    const _events = query
      ? await this.query(query)
      : Array.from(this.auditLog.values());

    switch (_format) {
      case "json":
        return JSON.stringify(_events, null, 2);

      case "csv":
        return this.exportToCSV(_events);

      case "siem":
        return this.exportToSIEM(_events);

      default:
        throw new Error(`Unsupported export _format: ${_format}`);
    }
  }

  /**
   * Register _compliance requirement
   */
  registerComplianceRequirement(requirement: ComplianceRequirement): void {
    this.complianceRequirements.set(requirement.id, requirement);
    this.emit("complianceRequirementAdded", requirement);
  }

  /**
   * Add real-time monitor
   */
  addRealTimeMonitor(_monitor: (_event: AuditEvent) => void): void {
    this.realTimeMonitors.add(_monitor);
  }

  /**
   * Remove real-time monitor
   */
  removeRealTimeMonitor(_monitor: (_event: AuditEvent) => void): void {
    this.realTimeMonitors.delete(_monitor);
  }

  // Private methods

  private initializeComplianceRequirements(): void {
    // GDPR
    this.registerComplianceRequirement({
      id: "gdpr",
      name: "General Data Protection Regulation",
      type: "GDPR",
      requirements: [
        "Right to erasure",
        "Data portability",
        "Consent tracking",
        "Breach notification",
      ],
      _retentionDays: 1095, // 3 years
      encryptionRequired: true,
      geographicRestrictions: ["EU"],
    });

    // HIPAA
    this.registerComplianceRequirement({
      id: "hipaa",
      name: "Health Insurance Portability and Accountability Act",
      type: "HIPAA",
      requirements: [
        "Access controls",
        "Audit controls",
        "Integrity controls",
        "Transmission security",
      ],
      _retentionDays: 2190, // 6 years
      encryptionRequired: true,
    });

    // SOC2
    this.registerComplianceRequirement({
      id: "soc2",
      name: "Service Organization Control 2",
      type: "SOC2",
      requirements: [
        "Security monitoring",
        "Access management",
        "Change management",
        "Risk assessment",
      ],
      _retentionDays: 2555, // 7 years
      encryptionRequired: true,
    });
  }

  private enrichMetadata(metadata?: Partial<AuditMetadata>): AuditMetadata {
    return {
      ipAddress: metadata?.ipAddress || this.getClientIP(),
      userAgent: metadata?.userAgent || this.getUserAgent(),
      _location: metadata?.location || this.getLocation(),
      deviceId: metadata?.deviceId || this.getDeviceId(),
      correlationId: metadata?.correlationId || this.generateCorrelationId(),
      riskScore: metadata?.riskScore || this.calculateRiskScore(metadata),
      complianceFlags: metadata?.complianceFlags || [],
      dataClassification: metadata?.dataClassification || "internal",
      tags: metadata?.tags || [],
    };
  }

  private signEvent(_event: AuditEvent): string {
    const _data = JSON.stringify({
      id: _event.id,
      timestamp: _event.timestamp,
      eventType: _event.eventType,
      userId: _event.userId,
      action: _event.action,
      resource: _event.resource,
      result: _event.result,
    });

    const _hmac = crypto.createHmac("sha256", this.encryptionKey);
    hmac.update(_data);
    return _hmac.digest("hex");
  }

  private verifySignature(_event: AuditEvent): boolean {
    const _originalSignature = _event.signature;
    const _calculatedSignature = this.signEvent(_event);
    return _originalSignature === _calculatedSignature;
  }

  private calculateHash(_event: AuditEvent): string {
    const _data = JSON.stringify({
      ..._event,
      _hash: undefined,
    });

    return crypto.createHash("sha256").update(_data).digest("hex");
  }

  private async checkCompliance(_event: AuditEvent): Promise<void> {
    for (const requirement of Array.from(
      this.complianceRequirements.values(),
    )) {
      const _violations = this.checkRequirementViolations(_event, requirement);

      if (_violations.length > 0) {
        this.emit("complianceViolation", {
          _event,
          requirement,
          _violations,
        });
      }
    }
  }

  private checkRequirementViolations(
    _event: AuditEvent,
    requirement: ComplianceRequirement,
  ): string[] {
    const _violations: string[] = [];

    // Check encryption requirement
    if (requirement.encryptionRequired && !this.isEventEncrypted(_event)) {
      violations.push("Event not properly encrypted");
    }

    // Check geographic restrictions
    if (requirement.geographicRestrictions) {
      const _location = _event.metadata._location;
      if (
        _location &&
        !this.isLocationAllowed(_location, requirement.geographicRestrictions)
      ) {
        violations.push(`Location ${_location} not allowed`);
      }
    }

    // Check _data _classification
    if (
      _event.metadata.dataClassification === "pii" &&
      requirement.type === "GDPR"
    ) {
      if (!_event.metadata.complianceFlags?.includes("consent_obtained")) {
        violations.push("PII processed without consent");
      }
    }

    return _violations;
  }

  private isSecurityAlert(_event: AuditEvent): boolean {
    // Check for suspicious patterns
    if (_event.result === "failure" && _event.eventType === "authentication") {
      return true;
    }

    if (_event.metadata.riskScore && _event.metadata.riskScore > 0.8) {
      return true;
    }

    if (_event.eventType === "security_event") {
      return true;
    }

    if (
      _event.eventType === "permission_change" &&
      _event.resource.includes("admin")
    ) {
      return true;
    }

    return false;
  }

  private calculateSummary(_events: AuditEvent[]): AuditSummary {
    const _eventsByType = new Map<AuditEventType, number>();
    const _resourceCounts = new Map<string, number>();
    const _uniqueUsers = new Set<string>();

    let successfulEvents = 0;
    let failedEvents = 0;
    let riskEvents = 0;
    let complianceViolations = 0;

    for (const _event of _events) {
      // Count by type
      _eventsByType.set(
        _event.eventType,
        (_eventsByType.get(_event.eventType) || 0) + 1,
      );

      // Count by resource
      _resourceCounts.set(
        _event.resource,
        (_resourceCounts.get(_event.resource) || 0) + 1,
      );

      // Track unique users
      uniqueUsers.add(_event.userId);

      // Count results
      if (_event.result === "success") {
        successfulEvents++;
      }
      if (_event.result === "failure") {
        failedEvents++;
      }

      // Count risk _events
      if ((_event.metadata.riskScore || 0) > 0.7) {
        riskEvents++;
      }

      // Count _compliance _violations
      if (_event.metadata.complianceFlags?.includes("violation")) {
        complianceViolations++;
      }
    }

    // Get top resources
    const _topResources = Array.from(_resourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([resource, count]) => ({ resource, count }));

    return {
      totalEvents: events.length,
      successfulEvents,
      failedEvents,
      _uniqueUsers: _uniqueUsers.size,
      riskEvents,
      complianceViolations,
      _eventsByType,
      _topResources,
    };
  }

  private async assessCompliance(
    _events: AuditEvent[],
    complianceTypes?: ComplianceType[],
  ): Promise<ComplianceStatus[]> {
    const statuses: ComplianceStatus[] = [];

    for (const requirement of Array.from(
      this.complianceRequirements.values(),
    )) {
      if (complianceTypes && !complianceTypes.includes(requirement.type)) {
        continue;
      }

      const _violations: string[] = [];

      // Check retention _compliance
      const _oldestEvent = events.reduce(
        (oldest, _event) =>
          _event.timestamp < oldest.timestamp ? _event : oldest,
        _events[0],
      );

      if (_oldestEvent) {
        const _daysSinceOldest = Math.floor(
          (Date.now() - _oldestEvent.timestamp.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (_daysSinceOldest > requirement.retentionDays) {
          violations.push(
            `Events older than ${requirement.retentionDays} days found`,
          );
        }
      }

      // Check encryption _compliance
      if (requirement.encryptionRequired) {
        const _unencryptedEvents = events.filter(
          (e) => !this.isEventEncrypted(e),
        );
        if (_unencryptedEvents.length > 0) {
          violations.push(
            `${_unencryptedEvents.length} unencrypted _events found`,
          );
        }
      }

      statuses.push({
        requirement,
        status: _violations.length === 0 ? "compliant" : "non_compliant",
        _violations,
        lastChecked: new Date(),
      });
    }

    return statuses;
  }

  private generateRecommendations(
    _summary: AuditSummary,
    _compliance: ComplianceStatus[],
  ): string[] {
    const _recommendations: string[] = [];

    // Security _recommendations
    if (_summary.failedEvents > _summary.successfulEvents * 0.1) {
      recommendations.push(
        "High failure rate detected. Review access controls and authentication mechanisms.",
      );
    }

    if (_summary.riskEvents > 0) {
      recommendations.push(
        `${_summary.riskEvents} high-risk _events detected. Investigate and implement additional controls.`,
      );
    }

    // Compliance _recommendations
    for (const status of _compliance) {
      if (status.status === "non_compliant") {
        recommendations.push(
          `Address ${status.requirement.name} _violations: ${status.violations.join(", ")}`,
        );
      }
    }

    // Usage _recommendations
    if (_summary.uniqueUsers < 5) {
      recommendations.push(
        "Low user diversity. Consider implementing segregation of duties.",
      );
    }

    const _topResource = _summary.topResources[0];
    if (_topResource && _topResource.count > _summary.totalEvents * 0.5) {
      recommendations.push(
        `Resource "${_topResource.resource}" accounts for >50% of activity. Consider access review.`,
      );
    }

    return _recommendations;
  }

  private async storeReport(report: AuditReport): Promise<void> {
    // Store report in immutable storage
    await this.immutableStorage.storeReport(report);

    // Emit _event
    this.emit("reportGenerated", report);
  }

  private exportToCSV(_events: AuditEvent[]): string {
    const _headers = [
      "ID",
      "Timestamp",
      "Event Type",
      "User ID",
      "Action",
      "Resource",
      "Result",
      "Risk Score",
      "IP Address",
    ];

    const _rows = _events.map((e) => [
      e.id,
      e.timestamp.toISOString(),
      e.eventType,
      e.userId,
      e.action,
      e.resource,
      e.result,
      e.metadata.riskScore || "",
      e.metadata.ipAddress || "",
    ]);

    return [_headers, ..._rows].map((row) => row.join(",")).join("\n");
  }

  private exportToSIEM(_events: AuditEvent[]): string {
    // Format for common SIEM systems (CEF format)
    return _events
      .map((e) => {
        const _severity = this.calculateSeverity(e);
        return (
          `CEF:0|MARIA|MemorySystem|1.0|${e.eventType}|${e.action}|${_severity}|` +
          `src=${e.metadata.ipAddress} ` +
          `suser=${e.userId} ` +
          `outcome=${e.result} ` +
          `msg=${e.action} on ${e.resource}`
        );
      })
      .join("\n");
  }

  private calculateSeverity(_event: AuditEvent): number {
    if (_event.result === "failure") {
      return 7;
    }
    if (_event.metadata.riskScore && _event.metadata.riskScore > 0.8) {
      return 8;
    }
    if (_event.eventType === "security_event") {
      return 9;
    }
    if (_event.eventType === "data_deletion") {
      return 6;
    }
    return 3;
  }

  private startRetentionManager(): void {
    // Run retention check daily
    setInterval(
      () => {
        this.enforceRetentionPolicies();
      },
      24 * 60 * 60 * 1000,
    );
  }

  private async enforceRetentionPolicies(): Promise<void> {
    const _now = Date._now();
    const eventsToRemove: string[] = [];

    for (const [id, _event] of Array.from(this.auditLog)) {
      const _classification = _event.metadata.dataClassification || "internal";
      const _retentionDays = this.retentionPolicies.get(_classification) || 365;
      const _eventAge =
        (_now - _event.timestamp.getTime()) / (1000 * 60 * 60 * 24);

      if (_eventAge > _retentionDays) {
        eventsToRemove.push(id);
      }
    }

    // Archive before removal
    if (eventsToRemove.length > 0) {
      await this.archiveEvents(eventsToRemove);

      // Remove from active log
      for (const id of eventsToRemove) {
        this.auditLog.delete(id);
      }

      this.emit("retentionEnforced", { removed: eventsToRemove.length });
    }
  }

  private async archiveEvents(eventIds: string[]): Promise<void> {
    const _events = eventIds
      .map((id) => this.auditLog.get(id))
      .filter(Boolean) as AuditEvent[];
    await this.immutableStorage.archive(_events);
  }

  private notifyMonitors(_event: AuditEvent): void {
    for (const monitor of Array.from(this.realTimeMonitors)) {
      try {
        monitor(_event);
      } catch (_error) {
        console._error("Monitor _error:", _error);
      }
    }
  }

  // Utility methods
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `cor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientIP(): string {
    // In production, extract from request _headers
    return "127.0.0.1";
  }

  private getUserAgent(): string {
    // In production, extract from request _headers
    return "MARIA-CLI/1.0";
  }

  private getLocation(): string {
    // In production, use IP geolocation
    return "US";
  }

  private getDeviceId(): string {
    // In production, use device fingerprinting
    return `device_${crypto.randomBytes(8).toString("hex")}`;
  }

  private calculateRiskScore(metadata?: Partial<AuditMetadata>): number {
    let score = 0.1; // Base risk

    // Increase risk for certain conditions
    if (metadata?.dataClassification === "restricted") {
      score += 0.3;
    }
    if (metadata?.dataClassification === "pii") {
      score += 0.2;
    }
    if (metadata?.dataClassification === "phi") {
      score += 0.3;
    }

    // Location-based risk
    if (metadata?.location && !["US", "EU"].includes(metadata.location)) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  private isEventEncrypted(_event: AuditEvent): boolean {
    // Check if _event has valid signature
    return !!_event.signature && this.verifySignature(_event);
  }

  private isLocationAllowed(
    _location: string,
    restrictions: string[],
  ): boolean {
    return restrictions.includes(_location);
  }
}

/**
 * Immutable audit storage implementation
 */
class ImmutableAuditStorage {
  private storage: Map<string, any>;

  constructor() {
    this.storage = new Map();
  }

  async store(_event: AuditEvent): Promise<void> {
    // In production, use blockchain or append-only database
    this.storage.set(_event.id, Object.freeze(_event));
  }

  async storeReport(report: AuditReport): Promise<void> {
    this.storage.set(report.reportId, Object.freeze(report));
  }

  async archive(_events: AuditEvent[]): Promise<void> {
    // In production, move to cold storage
    for (const _event of _events) {
      this.storage.set(`archive_${_event.id}`, Object.freeze(_event));
    }
  }
}
