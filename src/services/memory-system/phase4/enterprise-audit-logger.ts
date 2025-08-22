/**
 * MARIA Memory System - Phase 4: Enterprise Audit Logger
 *
 * Comprehensive audit logging for compliance and security
 * with tamper-proof event recording and regulatory compliance
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { MemoryEvent } from '../types/memory-interfaces';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  userId: string;
  sessionId: string;
  action: string;
  resource: string;
  result: 'success' | 'failure' | 'partial';
  metadata: AuditMetadata;
  signature: string;
  previousHash?: string;
  hash: string;
}

export type AuditEventType =
  | 'data_access'
  | 'data_modification'
  | 'data_deletion'
  | 'permission_change'
  | 'authentication'
  | 'configuration_change'
  | 'export_operation'
  | 'import_operation'
  | 'compliance_check'
  | 'security_event';

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  deviceId?: string;
  correlationId?: string;
  riskScore?: number;
  complianceFlags?: string[];
  dataClassification?: DataClassification;
  tags?: string[];
}

export type DataClassification =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'pii'
  | 'phi'
  | 'financial';

export interface ComplianceRequirement {
  id: string;
  name: string;
  type: ComplianceType;
  requirements: string[];
  retentionDays: number;
  encryptionRequired: boolean;
  geographicRestrictions?: string[];
}

export type ComplianceType = 'GDPR' | 'HIPAA' | 'SOC2' | 'ISO27001' | 'PCI_DSS' | 'CCPA' | 'CUSTOM';

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  eventTypes?: AuditEventType[];
  resources?: string[];
  resultTypes?: string[];
  complianceFlags?: string[];
  minRiskScore?: number;
  limit?: number;
  offset?: number;
}

export interface AuditReport {
  reportId: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: AuditSummary;
  events: AuditEvent[];
  compliance: ComplianceStatus[];
  recommendations: string[];
}

export interface AuditSummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  uniqueUsers: number;
  riskEvents: number;
  complianceViolations: number;
  eventsByType: Map<AuditEventType, number>;
  topResources: Array<{ resource: string; count: number }>;
}

export interface ComplianceStatus {
  requirement: ComplianceRequirement;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
  violations: string[];
  lastChecked: Date;
}

export class EnterpriseAuditLogger extends EventEmitter {
  private auditLog: Map<string, AuditEvent>;
  private hashChain: string[];
  private complianceRequirements: Map<string, ComplianceRequirement>;
  private encryptionKey: Buffer;
  private retentionPolicies: Map<DataClassification, number>;
  private immutableStorage: ImmutableAuditStorage;
  private realTimeMonitors: Set<(event: AuditEvent) => void>;

  constructor(encryptionKey?: string) {
    super();
    this.auditLog = new Map();
    this.hashChain = [];
    this.complianceRequirements = new Map();
    this.realTimeMonitors = new Set();

    // Initialize encryption key
    this.encryptionKey = encryptionKey ? Buffer.from(encryptionKey, 'hex') : crypto.randomBytes(32);

    // Initialize immutable storage
    this.immutableStorage = new ImmutableAuditStorage();

    // Set default retention policies (days)
    this.retentionPolicies = new Map([
      ['public', 90],
      ['internal', 180],
      ['confidential', 365],
      ['restricted', 2555], // 7 years
      ['pii', 2555],
      ['phi', 2555],
      ['financial', 2555],
    ]);

    this.initializeComplianceRequirements();
    this.startRetentionManager();
  }

  /**
   * Log an audit event
   */
  async logEvent(
    eventType: AuditEventType,
    userId: string,
    action: string,
    resource: string,
    result: 'success' | 'failure' | 'partial',
    metadata?: Partial<AuditMetadata>,
  ): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      eventType,
      userId,
      sessionId: metadata?.correlationId || this.generateSessionId(),
      action,
      resource,
      result,
      metadata: this.enrichMetadata(metadata),
      signature: '',
      previousHash: this.hashChain[this.hashChain.length - 1],
      hash: '',
    };

    // Sign the event
    event.signature = this.signEvent(event);

    // Calculate hash for chain integrity
    event.hash = this.calculateHash(event);

    // Store in audit log
    this.auditLog.set(event.id, event);
    this.hashChain.push(event.hash);

    // Store in immutable storage
    await this.immutableStorage.store(event);

    // Check compliance
    await this.checkCompliance(event);

    // Notify real-time monitors
    this.notifyMonitors(event);

    // Emit event for external systems
    this.emit('auditEvent', event);

    // Check for security alerts
    if (this.isSecurityAlert(event)) {
      this.emit('securityAlert', event);
    }

    return event;
  }

  /**
   * Query audit events
   */
  async query(query: AuditQuery): Promise<AuditEvent[]> {
    let events = Array.from(this.auditLog.values());

    // Apply filters
    if (query.startDate) {
      events = events.filter((e) => e.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      events = events.filter((e) => e.timestamp <= query.endDate!);
    }

    if (query.userId) {
      events = events.filter((e) => e.userId === query.userId);
    }

    if (query.eventTypes && query.eventTypes.length > 0) {
      events = events.filter((e) => query.eventTypes!.includes(e.eventType));
    }

    if (query.resources && query.resources.length > 0) {
      events = events.filter((e) => query.resources!.includes(e.resource));
    }

    if (query.resultTypes && query.resultTypes.length > 0) {
      events = events.filter((e) => query.resultTypes!.includes(e.result));
    }

    if (query.complianceFlags && query.complianceFlags.length > 0) {
      events = events.filter((e) =>
        e.metadata.complianceFlags?.some((f) => query.complianceFlags!.includes(f)),
      );
    }

    if (query.minRiskScore !== undefined) {
      events = events.filter((e) => (e.metadata.riskScore || 0) >= query.minRiskScore!);
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    return events.slice(offset, offset + limit);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    complianceTypes?: ComplianceType[],
  ): Promise<AuditReport> {
    const events = await this.query({ startDate, endDate });
    const summary = this.calculateSummary(events);
    const compliance = await this.assessCompliance(events, complianceTypes);
    const recommendations = this.generateRecommendations(summary, compliance);

    const report: AuditReport = {
      reportId: this.generateReportId(),
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary,
      events: events.slice(0, 1000), // Limit events in report
      compliance,
      recommendations,
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
      const hash = this.hashChain[i];
      const event = Array.from(this.auditLog.values()).find((e) => e.hash === hash);

      if (!event) {
        errors.push(`Missing event for hash at position ${i}`);
        break;
      }

      // Verify signature
      if (!this.verifySignature(event)) {
        errors.push(`Invalid signature for event ${event.id}`);
        break;
      }

      // Verify hash chain
      if (i > 0 && event.previousHash !== this.hashChain[i - 1]) {
        errors.push(`Broken hash chain at event ${event.id}`);
        break;
      }

      // Verify hash calculation
      const calculatedHash = this.calculateHash(event);
      if (calculatedHash !== event.hash) {
        errors.push(`Hash mismatch for event ${event.id}`);
        break;
      }

      lastValidEvent = event.id;
    }

    return {
      valid: errors.length === 0,
      errors,
      lastValidEvent,
    };
  }

  /**
   * Export audit logs for compliance
   */
  async exportForCompliance(format: 'json' | 'csv' | 'siem', query?: AuditQuery): Promise<string> {
    const events = query ? await this.query(query) : Array.from(this.auditLog.values());

    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);

      case 'csv':
        return this.exportToCSV(events);

      case 'siem':
        return this.exportToSIEM(events);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Register compliance requirement
   */
  registerComplianceRequirement(requirement: ComplianceRequirement): void {
    this.complianceRequirements.set(requirement.id, requirement);
    this.emit('complianceRequirementAdded', requirement);
  }

  /**
   * Add real-time monitor
   */
  addRealTimeMonitor(monitor: (event: AuditEvent) => void): void {
    this.realTimeMonitors.add(monitor);
  }

  /**
   * Remove real-time monitor
   */
  removeRealTimeMonitor(monitor: (event: AuditEvent) => void): void {
    this.realTimeMonitors.delete(monitor);
  }

  // Private methods

  private initializeComplianceRequirements(): void {
    // GDPR
    this.registerComplianceRequirement({
      id: 'gdpr',
      name: 'General Data Protection Regulation',
      type: 'GDPR',
      requirements: [
        'Right to erasure',
        'Data portability',
        'Consent tracking',
        'Breach notification',
      ],
      retentionDays: 1095, // 3 years
      encryptionRequired: true,
      geographicRestrictions: ['EU'],
    });

    // HIPAA
    this.registerComplianceRequirement({
      id: 'hipaa',
      name: 'Health Insurance Portability and Accountability Act',
      type: 'HIPAA',
      requirements: [
        'Access controls',
        'Audit controls',
        'Integrity controls',
        'Transmission security',
      ],
      retentionDays: 2190, // 6 years
      encryptionRequired: true,
    });

    // SOC2
    this.registerComplianceRequirement({
      id: 'soc2',
      name: 'Service Organization Control 2',
      type: 'SOC2',
      requirements: [
        'Security monitoring',
        'Access management',
        'Change management',
        'Risk assessment',
      ],
      retentionDays: 2555, // 7 years
      encryptionRequired: true,
    });
  }

  private enrichMetadata(metadata?: Partial<AuditMetadata>): AuditMetadata {
    return {
      ipAddress: metadata?.ipAddress || this.getClientIP(),
      userAgent: metadata?.userAgent || this.getUserAgent(),
      location: metadata?.location || this.getLocation(),
      deviceId: metadata?.deviceId || this.getDeviceId(),
      correlationId: metadata?.correlationId || this.generateCorrelationId(),
      riskScore: metadata?.riskScore || this.calculateRiskScore(metadata),
      complianceFlags: metadata?.complianceFlags || [],
      dataClassification: metadata?.dataClassification || 'internal',
      tags: metadata?.tags || [],
    };
  }

  private signEvent(event: AuditEvent): string {
    const data = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp,
      eventType: event.eventType,
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      result: event.result,
    });

    const hmac = crypto.createHmac('sha256', this.encryptionKey);
    hmac.update(data);
    return hmac.digest('hex');
  }

  private verifySignature(event: AuditEvent): boolean {
    const originalSignature = event.signature;
    const calculatedSignature = this.signEvent(event);
    return originalSignature === calculatedSignature;
  }

  private calculateHash(event: AuditEvent): string {
    const data = JSON.stringify({
      ...event,
      hash: undefined,
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async checkCompliance(event: AuditEvent): Promise<void> {
    for (const requirement of Array.from(this.complianceRequirements.values())) {
      const violations = this.checkRequirementViolations(event, requirement);

      if (violations.length > 0) {
        this.emit('complianceViolation', {
          event,
          requirement,
          violations,
        });
      }
    }
  }

  private checkRequirementViolations(
    event: AuditEvent,
    requirement: ComplianceRequirement,
  ): string[] {
    const violations: string[] = [];

    // Check encryption requirement
    if (requirement.encryptionRequired && !this.isEventEncrypted(event)) {
      violations.push('Event not properly encrypted');
    }

    // Check geographic restrictions
    if (requirement.geographicRestrictions) {
      const location = event.metadata.location;
      if (location && !this.isLocationAllowed(location, requirement.geographicRestrictions)) {
        violations.push(`Location ${location} not allowed`);
      }
    }

    // Check data classification
    if (event.metadata.dataClassification === 'pii' && requirement.type === 'GDPR') {
      if (!event.metadata.complianceFlags?.includes('consent_obtained')) {
        violations.push('PII processed without consent');
      }
    }

    return violations;
  }

  private isSecurityAlert(event: AuditEvent): boolean {
    // Check for suspicious patterns
    if (event.result === 'failure' && event.eventType === 'authentication') {
      return true;
    }

    if (event.metadata.riskScore && event.metadata.riskScore > 0.8) {
      return true;
    }

    if (event.eventType === 'security_event') {
      return true;
    }

    if (event.eventType === 'permission_change' && event.resource.includes('admin')) {
      return true;
    }

    return false;
  }

  private calculateSummary(events: AuditEvent[]): AuditSummary {
    const eventsByType = new Map<AuditEventType, number>();
    const resourceCounts = new Map<string, number>();
    const uniqueUsers = new Set<string>();

    let successfulEvents = 0;
    let failedEvents = 0;
    let riskEvents = 0;
    let complianceViolations = 0;

    for (const event of events) {
      // Count by type
      eventsByType.set(event.eventType, (eventsByType.get(event.eventType) || 0) + 1);

      // Count by resource
      resourceCounts.set(event.resource, (resourceCounts.get(event.resource) || 0) + 1);

      // Track unique users
      uniqueUsers.add(event.userId);

      // Count results
      if (event.result === 'success') {successfulEvents++;}
      if (event.result === 'failure') {failedEvents++;}

      // Count risk events
      if ((event.metadata.riskScore || 0) > 0.7) {riskEvents++;}

      // Count compliance violations
      if (event.metadata.complianceFlags?.includes('violation')) {
        complianceViolations++;
      }
    }

    // Get top resources
    const topResources = Array.from(resourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([resource, count]) => ({ resource, count }));

    return {
      totalEvents: events.length,
      successfulEvents,
      failedEvents,
      uniqueUsers: uniqueUsers.size,
      riskEvents,
      complianceViolations,
      eventsByType,
      topResources,
    };
  }

  private async assessCompliance(
    events: AuditEvent[],
    complianceTypes?: ComplianceType[],
  ): Promise<ComplianceStatus[]> {
    const statuses: ComplianceStatus[] = [];

    for (const requirement of Array.from(this.complianceRequirements.values())) {
      if (complianceTypes && !complianceTypes.includes(requirement.type)) {
        continue;
      }

      const violations: string[] = [];

      // Check retention compliance
      const oldestEvent = events.reduce(
        (oldest, event) => (event.timestamp < oldest.timestamp ? event : oldest),
        events[0],
      );

      if (oldestEvent) {
        const daysSinceOldest = Math.floor(
          (Date.now() - oldestEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceOldest > requirement.retentionDays) {
          violations.push(`Events older than ${requirement.retentionDays} days found`);
        }
      }

      // Check encryption compliance
      if (requirement.encryptionRequired) {
        const unencryptedEvents = events.filter((e) => !this.isEventEncrypted(e));
        if (unencryptedEvents.length > 0) {
          violations.push(`${unencryptedEvents.length} unencrypted events found`);
        }
      }

      statuses.push({
        requirement,
        status: violations.length === 0 ? 'compliant' : 'non_compliant',
        violations,
        lastChecked: new Date(),
      });
    }

    return statuses;
  }

  private generateRecommendations(summary: AuditSummary, compliance: ComplianceStatus[]): string[] {
    const recommendations: string[] = [];

    // Security recommendations
    if (summary.failedEvents > summary.successfulEvents * 0.1) {
      recommendations.push(
        'High failure rate detected. Review access controls and authentication mechanisms.',
      );
    }

    if (summary.riskEvents > 0) {
      recommendations.push(
        `${summary.riskEvents} high-risk events detected. Investigate and implement additional controls.`,
      );
    }

    // Compliance recommendations
    for (const status of compliance) {
      if (status.status === 'non_compliant') {
        recommendations.push(
          `Address ${status.requirement.name} violations: ${status.violations.join(', ')}`,
        );
      }
    }

    // Usage recommendations
    if (summary.uniqueUsers < 5) {
      recommendations.push('Low user diversity. Consider implementing segregation of duties.');
    }

    const topResource = summary.topResources[0];
    if (topResource && topResource.count > summary.totalEvents * 0.5) {
      recommendations.push(
        `Resource "${topResource.resource}" accounts for >50% of activity. Consider access review.`,
      );
    }

    return recommendations;
  }

  private async storeReport(report: AuditReport): Promise<void> {
    // Store report in immutable storage
    await this.immutableStorage.storeReport(report);

    // Emit event
    this.emit('reportGenerated', report);
  }

  private exportToCSV(events: AuditEvent[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'Event Type',
      'User ID',
      'Action',
      'Resource',
      'Result',
      'Risk Score',
      'IP Address',
    ];

    const rows = events.map((e) => [
      e.id,
      e.timestamp.toISOString(),
      e.eventType,
      e.userId,
      e.action,
      e.resource,
      e.result,
      e.metadata.riskScore || '',
      e.metadata.ipAddress || '',
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  private exportToSIEM(events: AuditEvent[]): string {
    // Format for common SIEM systems (CEF format)
    return events
      .map((e) => {
        const severity = this.calculateSeverity(e);
        return (
          `CEF:0|MARIA|MemorySystem|1.0|${e.eventType}|${e.action}|${severity}|` +
          `src=${e.metadata.ipAddress} ` +
          `suser=${e.userId} ` +
          `outcome=${e.result} ` +
          `msg=${e.action} on ${e.resource}`
        );
      })
      .join('\n');
  }

  private calculateSeverity(event: AuditEvent): number {
    if (event.result === 'failure') {return 7;}
    if (event.metadata.riskScore && event.metadata.riskScore > 0.8) {return 8;}
    if (event.eventType === 'security_event') {return 9;}
    if (event.eventType === 'data_deletion') {return 6;}
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
    const now = Date.now();
    const eventsToRemove: string[] = [];

    for (const [id, event] of Array.from(this.auditLog)) {
      const classification = event.metadata.dataClassification || 'internal';
      const retentionDays = this.retentionPolicies.get(classification) || 365;
      const eventAge = (now - event.timestamp.getTime()) / (1000 * 60 * 60 * 24);

      if (eventAge > retentionDays) {
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

      this.emit('retentionEnforced', { removed: eventsToRemove.length });
    }
  }

  private async archiveEvents(eventIds: string[]): Promise<void> {
    const events = eventIds.map((id) => this.auditLog.get(id)).filter(Boolean) as AuditEvent[];
    await this.immutableStorage.archive(events);
  }

  private notifyMonitors(event: AuditEvent): void {
    for (const monitor of Array.from(this.realTimeMonitors)) {
      try {
        monitor(event);
      } catch (error) {
        console.error('Monitor error:', error);
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
    // In production, extract from request headers
    return '127.0.0.1';
  }

  private getUserAgent(): string {
    // In production, extract from request headers
    return 'MARIA-CLI/1.0';
  }

  private getLocation(): string {
    // In production, use IP geolocation
    return 'US';
  }

  private getDeviceId(): string {
    // In production, use device fingerprinting
    return `device_${  crypto.randomBytes(8).toString('hex')}`;
  }

  private calculateRiskScore(metadata?: Partial<AuditMetadata>): number {
    let score = 0.1; // Base risk

    // Increase risk for certain conditions
    if (metadata?.dataClassification === 'restricted') {score += 0.3;}
    if (metadata?.dataClassification === 'pii') {score += 0.2;}
    if (metadata?.dataClassification === 'phi') {score += 0.3;}

    // Location-based risk
    if (metadata?.location && !['US', 'EU'].includes(metadata.location)) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  private isEventEncrypted(event: AuditEvent): boolean {
    // Check if event has valid signature
    return !!event.signature && this.verifySignature(event);
  }

  private isLocationAllowed(location: string, restrictions: string[]): boolean {
    return restrictions.includes(location);
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

  async store(event: AuditEvent): Promise<void> {
    // In production, use blockchain or append-only database
    this.storage.set(event.id, Object.freeze(event));
  }

  async storeReport(report: AuditReport): Promise<void> {
    this.storage.set(report.reportId, Object.freeze(report));
  }

  async archive(events: AuditEvent[]): Promise<void> {
    // In production, move to cold storage
    for (const event of events) {
      this.storage.set(`archive_${event.id}`, Object.freeze(event));
    }
  }
}
