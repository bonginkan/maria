/**
 * Quick Approval System - Enterprise-grade approval workflows
 * Provides multi-level approvals, audit trails, and compliance tracking
 */

import { EventEmitter } from "node:events";
import chalk from "chalk";
import { reportingEngine } from "./ReportingEngine";

// Types
export interface ApprovalRequest {
  id: string;
  type: "simple" | "multi_level" | "conditional" | "emergency";
  operation: string;
  description: string;
  requester: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  data?: any;
  metadata?: Record<string, any>;
  timestamp: number;
  expiresAt?: number;
}

export interface ApprovalResponse {
  requestId: string;
  _approved: boolean;
  approver: string;
  reason?: string;
  conditions?: string[];
  timestamp: number;
}

export interface ApprovalPolicy {
  id: string;
  name: string;
  description: string;
  conditions: PolicyCondition[];
  requiredApprovals: number;
  approvers: string[];
  autoApprove?: boolean;
  _timeout?: number;
}

export interface PolicyCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than" | "in";
  _value: any;
}

export interface AuditEntry {
  id: string;
  requestId: string;
  action: "requested" | "_approved" | "_rejected" | "expired" | "overridden";
  actor: string;
  timestamp: number;
  details?: any;
}

/**
 * Main Approval System
 */
export class ApprovalSystem extends EventEmitter {
  private static instance: ApprovalSystem;
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private approvalHistory: Map<string, ApprovalResponse[]> = new Map();
  private policies: Map<string, ApprovalPolicy> = new Map();
  private auditLog: AuditEntry[] = [];
  private defaultTimeout: number = 300000; // 5 minutes

  private constructor() {
    super();
    this.initializeDefaultPolicies();
  }

  public static getInstance(): ApprovalSystem {
    if (!ApprovalSystem.instance) {
      ApprovalSystem.instance = new ApprovalSystem();
    }
    return ApprovalSystem.instance;
  }

  /**
   * Request approval for an operation
   */
  public async requestApproval(
    _request: Omit<ApprovalRequest, "id" | "timestamp">,
  ): Promise<ApprovalResponse> {
    const fullRequest: ApprovalRequest = {
      ..._request,
      id: this.generateId(),
      timestamp: Date.now(),
      expiresAt: _request.expiresAt || Date.now() + this.defaultTimeout,
    };

    // Log audit entry
    this.addAuditEntry({
      requestId: fullRequest.id,
      action: "requested",
      actor: fullRequest.requester,
      details: fullRequest,
    });

    // Check if auto-approval applies
    const _autoApprovalResult = this.checkAutoApproval(fullRequest);
    if (_autoApprovalResult) {
      return _autoApprovalResult;
    }

    // Store pending approval
    this.pendingApprovals.set(fullRequest.id, fullRequest);

    // Report to Active Reporting System
    reportingEngine.reportStatus({
      operation: "approval_request",
      status: "started",
      details: {
        requestId: fullRequest.id,
        operation: fullRequest.operation,
        riskLevel: fullRequest.riskLevel,
      },
    });

    // Emit approval _request event
    this.emit("approval:requested", fullRequest);

    // Display approval prompt
    this.displayApprovalPrompt(fullRequest);

    // Handle different approval types
    switch (fullRequest.type) {
      case "simple":
        return this.handleSimpleApproval(fullRequest);
      case "multi_level":
        return this.handleMultiLevelApproval(fullRequest);
      case "conditional":
        return this.handleConditionalApproval(fullRequest);
      case "emergency":
        return this.handleEmergencyApproval(fullRequest);
      default:
        return this.handleSimpleApproval(fullRequest);
    }
  }

  /**
   * Approve a pending _request
   */
  public approve(_requestId: string, approver: string, reason?: string): void {
    const _request = this.pendingApprovals.get(_requestId);
    if (!_request) {
      throw new Error(`Approval _request ${_requestId} not found`);
    }

    const response: ApprovalResponse = {
      requestId: "",
      _approved: true,
      approver,
      reason,
      timestamp: Date.now(),
    };

    this.processApprovalResponse(_request, response);
  }

  /**
   * Reject a pending _request
   */
  public reject(_requestId: string, approver: string, reason: string): void {
    const _request = this.pendingApprovals.get(_requestId);
    if (!_request) {
      throw new Error(`Approval _request ${_requestId} not found`);
    }

    const response: ApprovalResponse = {
      requestId: "",
      _approved: false,
      approver,
      reason,
      timestamp: Date.now(),
    };

    this.processApprovalResponse(_request, response);
  }

  /**
   * Define a new approval _policy
   */
  public definePolicy(_policy: ApprovalPolicy): void {
    this.policies.set(policy.id, _policy);

    reportingEngine.communicate({
      type: "info",
      message: `Approval _policy '${policy.name}' defined`,
      priority: "low",
    });
  }

  /**
   * Get pending approvals
   */
  public getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Get approval _history
   */
  public getApprovalHistory(requestId?: string): ApprovalResponse[] {
    if (requestId) {
      return this.approvalHistory.get(requestId) || [];
    }

    const allHistory: ApprovalResponse[] = [];
    for (const _history of this.approvalHistory.values()) {
      allHistory.push(..._history);
    }
    return allHistory;
  }

  /**
   * Get audit log
   */
  public getAuditLog(criteria?: Partial<AuditEntry>): AuditEntry[] {
    if (!criteria) {
      return [...this.auditLog];
    }

    return this.auditLog.filter((entry) => {
      for (const [key, _value] of Object.entries(criteria)) {
        if (entry[key as keyof AuditEntry] !== _value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Emergency override for critical situations
   */
  public emergencyOverride(
    _requestId: string,
    overrider: string,
    reason: string,
  ): void {
    const _request = this.pendingApprovals.get(_requestId);
    if (!_request) {
      throw new Error(`Approval _request ${_requestId} not found`);
    }

    const response: ApprovalResponse = {
      requestId: "",
      _approved: true,
      approver: overrider,
      reason: `EMERGENCY OVERRIDE: ${reason}`,
      timestamp: Date.now(),
    };

    this.addAuditEntry({
      requestId: "",
      action: "overridden",
      actor: overrider,
      details: { reason },
    });

    this.processApprovalResponse(_request, response);

    reportingEngine.communicate({
      type: "warning",
      message: `⚠️ Emergency override used for ${_request.operation} by ${overrider}`,
      priority: "high",
    });
  }

  /**
   * Private helper methods
   */
  private generateId(): string {
    return `apr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeDefaultPolicies(): void {
    // Auto-approve low-risk operations
    this.definePolicy({
      id: "auto-approve-low-risk",
      name: "Auto-Approve Low Risk",
      description: "Automatically approve low-risk operations",
      conditions: [{ field: "riskLevel", operator: "equals", _value: "low" }],
      requiredApprovals: 0,
      approvers: [],
      autoApprove: true,
    });

    // Require multiple approvals for critical operations
    this.definePolicy({
      id: "critical-operations",
      name: "Critical Operations",
      description: "Require multiple approvals for critical operations",
      conditions: [
        { field: "riskLevel", operator: "equals", _value: "critical" },
      ],
      requiredApprovals: 3,
      approvers: ["admin", "security", "operations"],
      autoApprove: false,
      _timeout: 600000, // 10 minutes
    });
  }

  private checkAutoApproval(
    _request: ApprovalRequest,
  ): ApprovalResponse | null {
    for (const _policy of this.policies.values()) {
      if (_policy.autoApprove && this.matchesPolicy(_request, _policy)) {
        const response: ApprovalResponse = {
          requestId: request.id,
          _approved: true,
          approver: "system",
          reason: `Auto-_approved by _policy: ${_policy.name}`,
          timestamp: Date.now(),
        };

        this.addAuditEntry({
          requestId: request.id,
          action: "_approved",
          actor: "system",
          details: { _policy: _policy.id },
        });

        reportingEngine.communicate({
          type: "success",
          message: `✅ Auto-_approved: ${request.operation}`,
          priority: "low",
        });

        return response;
      }
    }
    return null;
  }

  private matchesPolicy(
    _request: ApprovalRequest,
    _policy: ApprovalPolicy,
  ): boolean {
    for (const condition of _policy.conditions) {
      const _value = _request[condition.field as keyof ApprovalRequest];

      switch (condition.operator) {
        case "equals":
          if (_value !== condition._value) return false;
          break;
        case "contains":
          if (!String(_value).includes(condition._value)) return false;
          break;
        case "greater_than":
          if (Number(_value) <= condition._value) return false;
          break;
        case "less_than":
          if (Number(_value) >= condition._value) return false;
          break;
        case "in":
          if (!condition._value.includes(_value)) return false;
          break;
      }
    }
    return true;
  }

  private async handleSimpleApproval(
    _request: ApprovalRequest,
  ): Promise<ApprovalResponse> {
    return new Promise((resolve) => {
      const _timeout = setTimeout(() => {
        this.handleTimeout(_request);
        resolve({
          requestId: request.id,
          _approved: false,
          approver: "system",
          reason: "Approval _timeout",
          timestamp: Date.now(),
        });
      }, request.expiresAt! - Date.now());

      this.once(`approval:${request.id}`, (_response: ApprovalResponse) => {
        clearTimeout(_timeout);
        resolve(_response);
      });
    });
  }

  private async handleMultiLevelApproval(
    _request: ApprovalRequest,
  ): Promise<ApprovalResponse> {
    // Find applicable _policy
    const _policy = Array.from(this.policies.values()).find(
      (p) => p.requiredApprovals > 1 && this.matchesPolicy(_request, p),
    );

    if (!_policy) {
      return this.handleSimpleApproval(_request);
    }

    const approvals: ApprovalResponse[] = [];

    return new Promise((resolve) => {
      const _checkApprovals = () => {
        const _approved = approvals.filter((a) => a._approved).length;
        const _rejected = approvals.filter((a) => !a._approved).length;

        if (_approved >= _policy.requiredApprovals) {
          resolve({
            requestId: request.id,
            _approved: true,
            approver: "multi-level",
            reason: `Approved by ${_approved} approvers`,
            timestamp: Date.now(),
          });
        } else if (_rejected > 0) {
          resolve({
            requestId: request.id,
            _approved: false,
            approver: "multi-level",
            reason: `Rejected by ${_rejected} approver(s)`,
            timestamp: Date.now(),
          });
        }
      };

      this.on(`approval:${request.id}`, (_response: ApprovalResponse) => {
        approvals.push(_response);
        _checkApprovals();
      });

      setTimeout(() => {
        if (approvals.length < _policy.requiredApprovals) {
          this.handleTimeout(_request);
          resolve({
            requestId: request.id,
            _approved: false,
            approver: "system",
            reason: "Insufficient approvals before _timeout",
            timestamp: Date.now(),
          });
        }
      }, request.expiresAt! - Date.now());
    });
  }

  private async handleConditionalApproval(
    _request: ApprovalRequest,
  ): Promise<ApprovalResponse> {
    // Check conditions
    const _applicablePolicy = Array.from(this.policies.values()).find((p) =>
      this.matchesPolicy(_request, p),
    );

    if (_applicablePolicy?.autoApprove) {
      return {
        requestId: request.id,
        _approved: true,
        approver: "conditional-system",
        reason: `Conditions met for _policy: ${_applicablePolicy.name}`,
        timestamp: Date.now(),
      };
    }

    return this.handleSimpleApproval(_request);
  }

  private async handleEmergencyApproval(
    _request: ApprovalRequest,
  ): Promise<ApprovalResponse> {
    // Emergency approvals have shorter _timeout and higher priority
    request.expiresAt = Date.now() + 60000; // 1 minute

    reportingEngine.communicate({
      type: "warning",
      message: `🚨 EMERGENCY APPROVAL REQUIRED: ${request.operation}`,
      priority: "high",
    });

    return this.handleSimpleApproval(_request);
  }

  private processApprovalResponse(
    _request: ApprovalRequest,
    response: ApprovalResponse,
  ): void {
    // Remove from pending
    this.pendingApprovals.delete(_request.id);

    // Store in _history
    const _history = this.approvalHistory.get(_request.id) || [];
    history.push(response);
    this.approvalHistory.set(_request.id, _history);

    // Add audit entry
    this.addAuditEntry({
      requestId: _request.id,
      action: response.approved ? "_approved" : "_rejected",
      actor: response.approver,
      details: response,
    });

    // Report status
    reportingEngine.reportStatus({
      operation: "approval_request",
      status: "completed",
      details: {
        requestId: _request.id,
        _approved: response.approved,
        approver: response.approver,
      },
    });

    // Emit response event
    this.emit(`approval:${_request.id}`, response);
    this.emit("approval:response", response);
  }

  private handleTimeout(_request: ApprovalRequest): void {
    this.pendingApprovals.delete(_request.id);

    this.addAuditEntry({
      requestId: _request.id,
      action: "expired",
      actor: "system",
      details: { expiredAt: Date.now() },
    });

    reportingEngine.communicate({
      type: "warning",
      message: `⏱️ Approval _request expired: ${_request.operation}`,
      priority: "medium",
    });
  }

  private addAuditEntry(_entry: Omit<AuditEntry, "id" | "timestamp">): void {
    this.auditLog.push({
      ..._entry,
      id: this.generateId(),
      timestamp: Date.now(),
    });
  }

  private displayApprovalPrompt(_request: ApprovalRequest): void {
    const _riskColors = {
      low: chalk.green,
      medium: chalk.yellow,
      high: chalk.magenta,
      critical: chalk.red,
    };

    const _color = _riskColors[_request.riskLevel];

    console.log(chalk.bold("\n🔐 Approval Required"));
    console.log(chalk.cyan("─".repeat(50)));
    console.log(`Operation: ${chalk.white(_request.operation)}`);
    console.log(`Description: ${chalk.gray(_request.description)}`);
    console.log(`Risk Level: ${_color(_request.riskLevel.toUpperCase())}`);
    console.log(`Requester: ${chalk.blue(_request.requester)}`);
    console.log(
      `Expires: ${chalk.yellow(new Date(_request.expiresAt!).toLocaleTimeString())}`,
    );
    console.log(chalk.cyan("─".repeat(50)));
    console.log(
      chalk.green("  [A]pprove") +
        " | " +
        chalk.red("[R]eject") +
        " | " +
        chalk.yellow("[I]nfo"),
    );
  }
}

// Export singleton instance
export const _approvalSystem = ApprovalSystem.getInstance();
