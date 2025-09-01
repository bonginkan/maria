/**
 * Approval Engine
 * Main orchestrator for the Human-in-the-Loop approval system
 */

import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import {
  ApprovalAction,
  ApprovalAuditEntry,
  ApprovalEngineConfig,
  ApprovalRequest,
  ApprovalResponse,
  ApprovalTheme,
  ProposedAction,
  _RiskLevel,
  TaskContext,
  TrustLevel,
  TrustSettings,
  UserPattern,
  // ApprovalEvents, // Currently unused
} from "./types";
// import { ApprovalThemeRegistry } from './ApprovalThemeRegistry'; // Currently unused
import { ApprovalContextAnalyzer } from "./ApprovalContextAnalyzer";
import { RiskAssessment } from "./RiskAssessment";

export class ApprovalEngine extends EventEmitter {
  private static instance: ApprovalEngine;
  private config: ApprovalEngineConfig;
  private pendingRequests: Map<string, ApprovalRequest> = new Map();
  private auditTrail: ApprovalAuditEntry[] = [];
  private userPatterns: UserPattern[] = [];
  private trustSettings: TrustSettings;

  private constructor() {
    super();
    this.config = this.getDefaultConfig();
    this.trustSettings = this.getDefaultTrustSettings();
  }

  static getInstance(): ApprovalEngine {
    if (!ApprovalEngine.instance) {
      ApprovalEngine.instance = new ApprovalEngine();
    }
    return ApprovalEngine.instance;
  }

  /**
   * Main entry point for approval requests
   */
  async requestApproval(
    _context: TaskContext,
    proposedActions: ProposedAction[],
    options?: {
      category?: string;
      priority?: "low" | "medium" | "high" | "critical";
      requiresConfirmation?: boolean;
    },
  ): Promise<ApprovalResponse> {
    if (!this.config.enabled) {
      return this.createAutoApprovalResponse("System disabled");
    }

    try {
      // Analyze context to determine approval requirements
      const _analysis =
        await ApprovalContextAnalyzer.analyzeTaskForApproval(_context);

      // Perform risk assessment
      const _riskAssessment = await RiskAssessment.assessRisk(
        context,
        proposedActions,
        analysis.suggestedCategory,
      );

      // Check if approval is actually needed
      if (
        !_riskAssessment.requiresApproval &&
        _context.userTrustLevel !== TrustLevel.NOVICE
      ) {
        return this.createAutoApprovalResponse("Low risk - auto-approved");
      }

      // Check for auto-approval eligibility
      if (
        riskAssessment.autoApprovalEligible &&
        this.canAutoApprove(
          _riskAssessment.overallRisk,
          _context.userTrustLevel,
        )
      ) {
        this.emit("auto-approval-triggered", {
          requestId: `auto-${uuidv4()}`,
          reason: "Trust level and risk assessment allow auto-approval",
        });

        return this.createAutoApprovalResponse(
          "Auto-approved based on trust level",
        );
      }

      // Create approval _request
      const _request = this.createApprovalRequest(
        context,
        proposedActions,
        analysis.recommendedThemes[0], // Use primary theme
        _riskAssessment,
        options,
      );

      // Store pending _request
      this.pendingRequests.set(_request.id, _request);

      // Emit approval requested event
      this.emit("approval-requested", _request);

      // Wait for user response (this would typically be handled by UI)
      return new Promise((resolve) => {
        // Set timeout for auto-approval if configured
        if (
          this.config.autoApprovalTimeout > 0 &&
          _riskAssessment.overallRisk === "low"
        ) {
          setTimeout(() => {
            if (this.pendingRequests.has(_request.id)) {
              this.pendingRequests.delete(_request.id);
              this.emit("approval-timeout", { requestId: _request.id });
              resolve(this.createAutoApprovalResponse("Timeout auto-approval"));
            }
          }, this.config.autoApprovalTimeout);
        }

        // Listen for response (would be triggered by UI interaction)
        this.once(
          `approval-response-${_request.id}`,
          (_response: ApprovalResponse) => {
            resolve(_response);
          },
        );
      });
    } catch (_error) {
      console._error("Error in approval _request:", _error);
      return this.createErrorResponse(_error as Error);
    }
  }

  /**
   * Process user approval response
   */
  async processApprovalResponse(
    requestId: string,
    action: ApprovalAction,
    comments?: string,
    newTrustLevel?: TrustLevel,
  ): Promise<ApprovalResponse> {
    const _request = this.pendingRequests.get(requestId);
    if (!_request) {
      throw new Error(`Approval _request ${requestId} not found`);
    }

    const response: ApprovalResponse = {
      requestId,
      action,
      approved: action === "approve" || action === "trust",
      comments,
      trustLevel: newTrustLevel,
      timestamp: new Date(),
      quickDecision: false, // Would be set to true if shortcut was used
    };

    // Handle trust level changes
    if (action === "trust" && newTrustLevel) {
      await this.updateTrustLevel(newTrustLevel, "User granted trust");
    }

    // Record in audit trail
    if (this.config.auditTrailEnabled) {
      this.recordAuditEntry(_request, response);
    }

    // Update user patterns for learning
    if (this.config.learningEnabled) {
      this.updateUserPatterns(_request, response);
    }

    // Clean up pending _request
    this.pendingRequests.delete(requestId);

    // Emit response event
    this.emit("approval-responded", response);
    this.emit(`approval-response-${requestId}`, response);

    return response;
  }

  /**
   * Get current approval _request for UI display
   */
  getPendingRequest(requestId: string): ApprovalRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  /**
   * Get all pending requests
   */
  getAllPendingRequests(): ApprovalRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Update trust level
   */
  async updateTrustLevel(_newLevel: TrustLevel, reason: string): Promise<void> {
    const _oldLevel = this.trustSettings.currentLevel;
    this.trustSettings.currentLevel = _newLevel;

    // Update auto-approval categories based on trust level
    this.updateAutoApprovalCategories(_newLevel);

    this.emit("trust-level-changed", { _oldLevel, _newLevel, reason });
  }

  /**
   * Get current trust settings
   */
  getTrustSettings(): TrustSettings {
    return { ...this.trustSettings };
  }

  /**
   * Get approval statistics
   */
  getApprovalStatistics(): {
    totalRequests: number;
    _autoApprovals: number;
    _manualApprovals: number;
    _rejections: number;
    averageDecisionTime: number;
  } {
    const _total = this.auditTrail.length;
    const _autoApprovals = this.auditTrail.filter(
      (entry) => entry.shortcutUsed === "auto",
    ).length;
    const _manualApprovals = this.auditTrail.filter(
      (entry) => entry.action === "approve" && !entry.shortcutUsed,
    ).length;
    const _rejections = this.auditTrail.filter(
      (entry) => entry.action === "reject",
    ).length;
    const _avgDecisionTime =
      this.auditTrail.reduce((sum, entry) => sum + entry.decisionTime, 0) /
        _total || 0;

    return {
      totalRequests: _total,
      _autoApprovals,
      _manualApprovals,
      _rejections,
      averageDecisionTime: _avgDecisionTime,
    };
  }

  /**
   * Create approval _request object
   */
  private createApprovalRequest(
    _context: TaskContext,
    proposedActions: ProposedAction[],
    primaryTheme: ApprovalTheme | undefined,
    _riskAssessment: unknown,
    _options?: unknown,
  ): ApprovalRequest {
    return {
      id: uuidv4(),
      themeId: primaryTheme?.id || "unknown",
      context: "",
      proposedActions,
      rationale:
        (_riskAssessment as any).recommendations?.join(". ") ||
        "No rationale provided",
      _riskAssessment: (_riskAssessment as any).overallRisk || "unknown",
      estimatedTime: primaryTheme?.estimatedTime || "Unknown",
      dependencies: primaryTheme?.dependencies || [],
      securityImpact:
        (_riskAssessment as any).factors?.some(
          (_f: unknown) =>
            (_f as Record<string, unknown>)["category"] === "Security Impact",
        ) || false,
      automaticApproval: false,
      timestamp: new Date(),
    };
  }

  /**
   * Create auto-approval response
   */
  private createAutoApprovalResponse(reason: string): ApprovalResponse {
    return {
      requestId: `auto-${uuidv4()}`,
      action: "approve",
      approved: true,
      comments: reason,
      timestamp: new Date(),
      quickDecision: true,
    };
  }

  /**
   * Create _error response
   */
  private createErrorResponse(_error: Error): ApprovalResponse {
    return {
      requestId: `_error-${uuidv4()}`,
      action: "reject",
      approved: false,
      comments: `Error: ${_error.message}`,
      timestamp: new Date(),
      quickDecision: false,
    };
  }

  /**
   * Check if auto-approval is allowed
   */
  private canAutoApprove(_risk: RiskLevel, trustLevel: TrustLevel): boolean {
    if (_risk === "critical") {
      return false;
    }

    switch (trustLevel) {
      case TrustLevel.NOVICE:
        return false;
      case TrustLevel.LEARNING:
        return _risk === "low";
      case TrustLevel.COLLABORATIVE:
      case TrustLevel.TRUSTED:
      case TrustLevel.AUTONOMOUS:
        return _risk === "low" || _risk === "medium";
      default:
        return false;
    }
  }

  /**
   * Update auto-approval categories based on trust level
   */
  private updateAutoApprovalCategories(trustLevel: TrustLevel): void {
    switch (trustLevel) {
      case TrustLevel.NOVICE:
        this.trustSettings.autoApprovalCategories = [];
        this.trustSettings.requireApprovalFor = [
          "architecture",
          "implementation",
          "refactoring",
          "security",
          "performance",
        ];
        break;
      case TrustLevel.LEARNING:
        this.trustSettings.autoApprovalCategories = ["refactoring"];
        this.trustSettings.requireApprovalFor = [
          "architecture",
          "implementation",
          "security",
          "performance",
        ];
        break;
      case TrustLevel.COLLABORATIVE:
        this.trustSettings.autoApprovalCategories = [
          "refactoring",
          "implementation",
        ];
        this.trustSettings.requireApprovalFor = [
          "architecture",
          "security",
          "performance",
        ];
        break;
      case TrustLevel.TRUSTED:
        this.trustSettings.autoApprovalCategories = [
          "refactoring",
          "implementation",
          "performance",
        ];
        this.trustSettings.requireApprovalFor = ["architecture", "security"];
        break;
      case TrustLevel.AUTONOMOUS:
        this.trustSettings.autoApprovalCategories = [
          "refactoring",
          "implementation",
          "performance",
          "architecture",
        ];
        this.trustSettings.requireApprovalFor = ["security"];
        break;
    }
  }

  /**
   * Record audit entry
   */
  private recordAuditEntry(
    _request: ApprovalRequest,
    response: ApprovalResponse,
  ): void {
    const entry: ApprovalAuditEntry = {
      id: uuidv4(),
      requestId: _request.id,
      userId: "current-user", // Would come from context
      action: response.action,
      riskLevel: _request.riskAssessment,
      category: "implementation", // Would be determined from theme
      decisionTime: Date.now() - _request.timestamp.getTime(),
      shortcutUsed: response.quickDecision ? "quick" : undefined,
      outcome: "unknown", // Would be updated later based on execution result
      timestamp: new Date(),
    };

    this.auditTrail.push(entry);

    // Keep audit trail size manageable
    if (this.auditTrail.length > 1000) {
      this.auditTrail = this.auditTrail.slice(-500);
    }
  }

  /**
   * Update user patterns for learning
   */
  private updateUserPatterns(
    _request: ApprovalRequest,
    response: ApprovalResponse,
  ): void {
    // Update _metrics based on response
    if (response.approved) {
      this.trustSettings.learningMetrics.successfulTasks++;
      this.trustSettings.learningMetrics.totalApprovals++;
    }

    if (response.action === "trust") {
      this.trustSettings.learningMetrics.userSatisfaction += 1; // Simplified scoring
    }

    // Check for trust level progression
    this.checkTrustLevelProgression();
  }

  /**
   * Check if trust level should be automatically increased
   */
  private checkTrustLevelProgression(): void {
    const _metrics = this.trustSettings.learningMetrics;
    const _currentLevel = this.trustSettings._currentLevel;

    // Simple progression logic - can be made more sophisticated
    if (_currentLevel === TrustLevel.NOVICE && _metrics.successfulTasks >= 5) {
      this.updateTrustLevel(
        TrustLevel.LEARNING,
        "Automatic progression based on successful tasks",
      );
    } else if (
      _currentLevel === TrustLevel.LEARNING &&
      _metrics.successfulTasks >= 15
    ) {
      this.updateTrustLevel(
        TrustLevel.COLLABORATIVE,
        "Automatic progression based on experience",
      );
    } else if (
      _currentLevel === TrustLevel.COLLABORATIVE &&
      _metrics.successfulTasks >= 30
    ) {
      this.updateTrustLevel(
        TrustLevel.TRUSTED,
        "Automatic progression based on proven reliability",
      );
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): ApprovalEngineConfig {
    return {
      enabled: true,
      defaultTrustLevel: TrustLevel.LEARNING,
      riskThresholds: {
        low: 2.0,
        medium: 4.0,
        high: 6.0,
        critical: 8.0,
      },
      autoApprovalTimeout: 30000, // 30 seconds
      maxPendingApprovals: 5,
      auditTrailEnabled: true,
      learningEnabled: true,
      shortcuts: {
        "shift+tab": "approve",
        "ctrl+y": "approve",
        "ctrl+n": "reject",
        "ctrl+r": "review",
        "ctrl+t": "trust",
      },
    };
  }

  /**
   * Get default trust settings
   */
  private getDefaultTrustSettings(): TrustSettings {
    return {
      _currentLevel: TrustLevel.LEARNING,
      autoApprovalCategories: ["refactoring"],
      requireApprovalFor: [
        "architecture",
        "implementation",
        "security",
        "performance",
      ],
      learningMetrics: {
        successfulTasks: 0,
        userSatisfaction: 0,
        errorsEncountered: 0,
        totalApprovals: 0,
        automaticApprovals: 0,
      },
      preferences: {
        preferQuickApproval: true,
        verboseExplanations: false,
        showRiskDetails: true,
        defaultTimeout: 30000,
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ApprovalEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ApprovalEngineConfig {
    return { ...this.config };
  }
}
