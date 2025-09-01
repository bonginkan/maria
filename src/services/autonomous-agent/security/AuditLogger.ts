/**
 * AuditLogger - Comprehensive audit logging with BigQuery integration
 * Provides complete operation tracking with UUID-based correlation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuid } from 'uuid';
import { OperationContext, ExecutionResult } from '../core/AutonomousExecutor';

export interface AuditEvent {
  // Core identification
  id: string;                          // Unique event ID
  operationId: string;                 // Links to operation
  planId: string;                      // Links to plan
  sessionId: string;                   // Links to session
  
  // Event information
  type: AuditEventType;
  timestamp: string;                   // ISO timestamp
  actor: 'agent' | 'user' | 'system';
  
  // Context
  mode: 'dry-run' | 'diff-only' | 'read-write';
  environment: 'development' | 'staging' | 'production';
  feature: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'blocked';
  
  // Event data
  data: Record<string, any>;
  
  // Security
  policyVersion: string;
  approvalRequired: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  elevationToken?: string;
  
  // Results
  success?: boolean;
  error?: string;
  duration?: number;
  
  // Metadata
  metadata: {
    hostname: string;
    userId?: string;
    userAgent?: string;
    ipAddress?: string;
    gitCommit?: string;
    buildVersion?: string;
  };
}

export type AuditEventType = 
  | 'operation_start'
  | 'operation_end' 
  | 'operation_error'
  | 'policy_check'
  | 'approval_request'
  | 'approval_response'
  | 'elevation_granted'
  | 'elevation_revoked'
  | 'rollback_start'
  | 'rollback_complete'
  | 'security_violation'
  | 'sandbox_created'
  | 'sandbox_destroyed'
  | 'file_created'
  | 'file_modified'
  | 'file_deleted'
  | 'command_executed'
  | 'network_request';

export interface AuditQuery {
  operationId?: string;
  planId?: string;
  sessionId?: string;
  type?: AuditEventType;
  actor?: string;
  mode?: string;
  riskLevel?: string;
  startTime?: string;
  endTime?: string;
  success?: boolean;
  limit?: number;
}

export interface AuditSummary {
  totalEvents: number;
  operationsCount: number;
  successRate: number;
  errorRate: number;
  riskDistribution: Record<string, number>;
  modeDistribution: Record<string, number>;
  averageDuration: number;
  topErrors: Array<{ error: string; count: number }>;
  timeRange: { start: string; end: string };
}

export class AuditLogger {
  private readonly auditDir: string;
  private readonly maxFileSize: number;
  private readonly maxFiles: number;
  private currentLogFile: string | null = null;
  private readonly hostname: string;

  constructor(options: {
    auditDir?: string;
    maxFileSize?: number;
    maxFiles?: number;
  } = {}) {
    this.auditDir = options.auditDir || path.join(os.homedir(), '.maria', 'audit-logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 100;
    this.hostname = os.hostname();
    
    this.ensureAuditDirectory();
  }

  /**
   * Log operation start
   */
  async logStart(context: OperationContext, intent?: string): Promise<void> {
    const event: AuditEvent = {
      id: uuid(),
      operationId: context.operationId,
      planId: context.planId,
      sessionId: context.sessionId,
      type: 'operation_start',
      timestamp: new Date().toISOString(),
      actor: context.actor,
      mode: context.mode,
      environment: context.tags.environment,
      feature: context.tags.feature,
      riskLevel: context.tags.risk,
      data: {
        intent,
        originalTimestamp: context.timestamp
      },
      policyVersion: context.policy?.version || 'unknown',
      approvalRequired: false,
      metadata: {
        hostname: this.hostname,
        gitCommit: context.gitCommit,
        buildVersion: process.env.MARIA_VERSION
      }
    };

    await this.writeEvent(event);
  }

  /**
   * Log operation success
   */
  async logSuccess(context: OperationContext, result: ExecutionResult): Promise<void> {
    const event: AuditEvent = {
      id: uuid(),
      operationId: context.operationId,
      planId: context.planId,
      sessionId: context.sessionId,
      type: 'operation_end',
      timestamp: new Date().toISOString(),
      actor: context.actor,
      mode: context.mode,
      environment: context.tags.environment,
      feature: context.tags.feature,
      riskLevel: context.tags.risk,
      data: {
        mode: result.mode,
        message: result.message,
        stepsExecuted: result.results?.length || 0,
        checkpointCreated: !!result.checkpoint,
        previewGenerated: !!result.preview,
        diffsGenerated: result.diffs?.length || 0
      },
      policyVersion: context.policy?.version || 'unknown',
      approvalRequired: false,
      success: result.success,
      duration: this.calculateDuration(context.timestamp),
      metadata: {
        hostname: this.hostname,
        gitCommit: context.gitCommit,
        buildVersion: process.env.MARIA_VERSION
      }
    };

    await this.writeEvent(event);
  }

  /**
   * Log operation error
   */
  async logError(context: OperationContext, error: Error): Promise<void> {
    const event: AuditEvent = {
      id: uuid(),
      operationId: context.operationId,
      planId: context.planId,
      sessionId: context.sessionId,
      type: 'operation_error',
      timestamp: new Date().toISOString(),
      actor: context.actor,
      mode: context.mode,
      environment: context.tags.environment,
      feature: context.tags.feature,
      riskLevel: context.tags.risk,
      data: {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      },
      policyVersion: context.policy?.version || 'unknown',
      approvalRequired: false,
      success: false,
      error: error.message,
      duration: this.calculateDuration(context.timestamp),
      metadata: {
        hostname: this.hostname,
        gitCommit: context.gitCommit,
        buildVersion: process.env.MARIA_VERSION
      }
    };

    await this.writeEvent(event);
  }

  /**
   * Log policy check
   */
  async logPolicyCheck(
    context: OperationContext,
    operation: any,
    policyResult: any
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuid(),
      operationId: context.operationId,
      planId: context.planId,
      sessionId: context.sessionId,
      type: 'policy_check',
      timestamp: new Date().toISOString(),
      actor: 'system',
      mode: context.mode,
      environment: context.tags.environment,
      feature: context.tags.feature,
      riskLevel: policyResult.risk || 'low',
      data: {
        operationType: operation.type,
        operationPath: operation.path,
        operationCommand: operation.command,
        policyDecision: policyResult.allow ? 'allow' : 'deny',
        policyReason: policyResult.reason,
        violations: policyResult.violations
      },
      policyVersion: context.policy?.version || 'unknown',
      approvalRequired: policyResult.requiresApproval,
      success: policyResult.allow,
      metadata: {
        hostname: this.hostname
      }
    };

    await this.writeEvent(event);
  }

  /**
   * Log approval request
   */
  async logApprovalRequest(
    context: OperationContext,
    plan: any
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuid(),
      operationId: context.operationId,
      planId: context.planId,
      sessionId: context.sessionId,
      type: 'approval_request',
      timestamp: new Date().toISOString(),
      actor: 'system',
      mode: context.mode,
      environment: context.tags.environment,
      feature: context.tags.feature,
      riskLevel: plan.risk?.level || 'medium',
      data: {
        planDescription: plan.description,
        stepsCount: plan.steps?.length || 0,
        estimatedDuration: plan.estimatedDuration,
        rationale: plan.rationale
      },
      policyVersion: context.policy?.version || 'unknown',
      approvalRequired: true,
      approvalStatus: 'pending',
      metadata: {
        hostname: this.hostname
      }
    };

    await this.writeEvent(event);
  }

  /**
   * Log approval response
   */
  async logApprovalResponse(
    context: OperationContext,
    approved: boolean,
    approvedBy: string,
    reason?: string
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuid(),
      operationId: context.operationId,
      planId: context.planId,
      sessionId: context.sessionId,
      type: 'approval_response',
      timestamp: new Date().toISOString(),
      actor: 'user',
      mode: context.mode,
      environment: context.tags.environment,
      feature: context.tags.feature,
      riskLevel: context.tags.risk,
      data: {
        approved,
        approvedBy,
        reason: reason || (approved ? 'User approved operation' : 'User rejected operation')
      },
      policyVersion: context.policy?.version || 'unknown',
      approvalRequired: false,
      approvalStatus: approved ? 'approved' : 'rejected',
      success: approved,
      metadata: {
        hostname: this.hostname,
        userId: approvedBy
      }
    };

    await this.writeEvent(event);
  }

  /**
   * Log elevation granted
   */
  async logElevationGranted(
    context: OperationContext,
    token: string,
    expiresAt: string
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuid(),
      operationId: context.operationId,
      planId: context.planId,
      sessionId: context.sessionId,
      type: 'elevation_granted',
      timestamp: new Date().toISOString(),
      actor: 'system',
      mode: context.mode,
      environment: context.tags.environment,
      feature: context.tags.feature,
      riskLevel: context.tags.risk,
      data: {
        tokenHash: this.hashToken(token),
        expiresAt,
        ttlSeconds: Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      },
      policyVersion: context.policy?.version || 'unknown',
      approvalRequired: false,
      elevationToken: this.hashToken(token),
      success: true,
      metadata: {
        hostname: this.hostname
      }
    };

    await this.writeEvent(event);
  }

  /**
   * Log elevation revoked
   */
  async logElevationRevoked(
    context: OperationContext,
    token: string,
    reason: string
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuid(),
      operationId: context.operationId,
      planId: context.planId,
      sessionId: context.sessionId,
      type: 'elevation_revoked',
      timestamp: new Date().toISOString(),
      actor: 'system',
      mode: context.mode,
      environment: context.tags.environment,
      feature: context.tags.feature,
      riskLevel: context.tags.risk,
      data: {
        tokenHash: this.hashToken(token),
        reason
      },
      policyVersion: context.policy?.version || 'unknown',
      approvalRequired: false,
      elevationToken: this.hashToken(token),
      success: true,
      metadata: {
        hostname: this.hostname
      }
    };

    await this.writeEvent(event);
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(
    context: OperationContext,
    violation: string,
    details: Record<string, any>
  ): Promise<void> {
    const event: AuditEvent = {
      id: uuid(),
      operationId: context.operationId,
      planId: context.planId,
      sessionId: context.sessionId,
      type: 'security_violation',
      timestamp: new Date().toISOString(),
      actor: context.actor,
      mode: context.mode,
      environment: context.tags.environment,
      feature: context.tags.feature,
      riskLevel: 'critical',
      data: {
        violation,
        ...details
      },
      policyVersion: context.policy?.version || 'unknown',
      approvalRequired: false,
      success: false,
      error: violation,
      metadata: {
        hostname: this.hostname
      }
    };

    await this.writeEvent(event);

    // Security violations should also be logged to system logs
    console.error(`SECURITY VIOLATION: ${violation}`, {
      operationId: context.operationId,
      details
    });
  }

  /**
   * Log operation end
   */
  async logEnd(context: OperationContext): Promise<void> {
    // This is called in the finally block of operations
    // We don't need to create an additional event here as success/error are already logged
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditQuery): Promise<AuditEvent[]> {
    const allEvents = await this.loadAllEvents();
    
    let filteredEvents = allEvents.filter(event => {
      if (query.operationId && event.operationId !== query.operationId) return false;
      if (query.planId && event.planId !== query.planId) return false;
      if (query.sessionId && event.sessionId !== query.sessionId) return false;
      if (query.type && event.type !== query.type) return false;
      if (query.actor && event.actor !== query.actor) return false;
      if (query.mode && event.mode !== query.mode) return false;
      if (query.riskLevel && event.riskLevel !== query.riskLevel) return false;
      if (query.success !== undefined && event.success !== query.success) return false;
      
      if (query.startTime && event.timestamp < query.startTime) return false;
      if (query.endTime && event.timestamp > query.endTime) return false;
      
      return true;
    });

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    if (query.limit) {
      filteredEvents = filteredEvents.slice(0, query.limit);
    }

    return filteredEvents;
  }

  /**
   * Generate audit summary
   */
  async generateSummary(timeRange?: { start: string; end: string }): Promise<AuditSummary> {
    const query: AuditQuery = {};
    if (timeRange) {
      query.startTime = timeRange.start;
      query.endTime = timeRange.end;
    }

    const events = await this.queryEvents(query);
    
    const operationEvents = events.filter(e => e.type === 'operation_end' || e.type === 'operation_error');
    const totalEvents = events.length;
    const operationsCount = operationEvents.length;
    
    const successfulOps = operationEvents.filter(e => e.success === true).length;
    const successRate = operationsCount > 0 ? successfulOps / operationsCount : 0;
    const errorRate = operationsCount > 0 ? (operationsCount - successfulOps) / operationsCount : 0;

    // Risk distribution
    const riskDistribution: Record<string, number> = {};
    events.forEach(e => {
      riskDistribution[e.riskLevel] = (riskDistribution[e.riskLevel] || 0) + 1;
    });

    // Mode distribution
    const modeDistribution: Record<string, number> = {};
    events.forEach(e => {
      modeDistribution[e.mode] = (modeDistribution[e.mode] || 0) + 1;
    });

    // Average duration
    const durationsMs = operationEvents
      .filter(e => e.duration !== undefined)
      .map(e => e.duration!);
    const averageDuration = durationsMs.length > 0 
      ? durationsMs.reduce((sum, d) => sum + d, 0) / durationsMs.length 
      : 0;

    // Top errors
    const errorCounts: Record<string, number> = {};
    events.filter(e => e.error).forEach(e => {
      const error = e.error!;
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    });
    
    const topErrors = Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Time range
    const timestamps = events.map(e => e.timestamp).sort();
    const actualTimeRange = {
      start: timestamps[0] || new Date().toISOString(),
      end: timestamps[timestamps.length - 1] || new Date().toISOString()
    };

    return {
      totalEvents,
      operationsCount,
      successRate,
      errorRate,
      riskDistribution,
      modeDistribution,
      averageDuration,
      topErrors,
      timeRange: actualTimeRange
    };
  }

  /**
   * Export audit data for external systems (BigQuery, etc.)
   */
  async exportData(format: 'json' | 'ndjson' | 'csv' = 'json'): Promise<string> {
    const events = await this.loadAllEvents();
    
    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);
      
      case 'ndjson':
        return events.map(event => JSON.stringify(event)).join('\n');
      
      case 'csv':
        return this.convertToCSV(events);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Write audit event to log file
   */
  private async writeEvent(event: AuditEvent): Promise<void> {
    const logFile = await this.getCurrentLogFile();
    const eventLine = JSON.stringify(event) + '\n';
    
    await fs.appendFile(logFile, eventLine);
    
    // Check if rotation is needed
    await this.rotateIfNeeded(logFile);
  }

  /**
   * Ensure audit directory exists
   */
  private async ensureAuditDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.auditDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Get current log file path
   */
  private async getCurrentLogFile(): Promise<string> {
    if (!this.currentLogFile) {
      const today = new Date().toISOString().split('T')[0];
      this.currentLogFile = path.join(this.auditDir, `audit-${today}.log`);
    }
    
    return this.currentLogFile;
  }

  /**
   * Rotate log file if needed
   */
  private async rotateIfNeeded(logFile: string): Promise<void> {
    try {
      const stats = await fs.stat(logFile);
      if (stats.size > this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = logFile.replace('.log', `-${timestamp}.log`);
        await fs.rename(logFile, rotatedFile);
        this.currentLogFile = null; // Force creation of new log file
        
        // Clean up old files
        await this.cleanupOldFiles();
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.auditDir);
      const logFiles = files
        .filter(f => f.startsWith('audit-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.auditDir, f),
          stat: null as any
        }));

      // Get file stats
      for (const file of logFiles) {
        try {
          file.stat = await fs.stat(file.path);
        } catch (error) {
          // Skip files that can't be stat'd
        }
      }

      // Sort by modification time (oldest first)
      logFiles
        .filter(f => f.stat)
        .sort((a, b) => a.stat.mtime.getTime() - b.stat.mtime.getTime());

      // Delete excess files
      const toDelete = logFiles.slice(0, -this.maxFiles);
      for (const file of toDelete) {
        try {
          await fs.unlink(file.path);
        } catch (error) {
          // Ignore deletion errors
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Load all events from log files
   */
  private async loadAllEvents(): Promise<AuditEvent[]> {
    const events: AuditEvent[] = [];
    
    try {
      const files = await fs.readdir(this.auditDir);
      const logFiles = files.filter(f => f.startsWith('audit-') && f.endsWith('.log'));
      
      for (const file of logFiles) {
        try {
          const content = await fs.readFile(path.join(this.auditDir, file), 'utf-8');
          const lines = content.trim().split('\n').filter(Boolean);
          
          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              events.push(event);
            } catch (error) {
              // Skip invalid JSON lines
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return events;
  }

  /**
   * Calculate duration from timestamp
   */
  private calculateDuration(startTimestamp: string): number {
    return Date.now() - new Date(startTimestamp).getTime();
  }

  /**
   * Hash token for logging (never log raw tokens)
   */
  private hashToken(token: string): string {
    // Simple hash for logging purposes (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `token-${Math.abs(hash).toString(16)}`;
  }

  /**
   * Convert events to CSV
   */
  private convertToCSV(events: AuditEvent[]): string {
    if (events.length === 0) return '';
    
    const headers = [
      'id', 'operationId', 'planId', 'sessionId', 'type', 'timestamp',
      'actor', 'mode', 'environment', 'feature', 'riskLevel',
      'success', 'error', 'duration', 'policyVersion'
    ];
    
    const csvLines = [headers.join(',')];
    
    for (const event of events) {
      const row = headers.map(header => {
        const value = event[header as keyof AuditEvent];
        const stringValue = value !== undefined ? String(value) : '';
        // Escape commas and quotes
        return `"${stringValue.replace(/"/g, '""')}"`;
      });
      csvLines.push(row.join(','));
    }
    
    return csvLines.join('\n');
  }
}