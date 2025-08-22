/**
 * Approval Engine
 * Main orchestrator for the Human-in-the-Loop approval system
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  ApprovalAction,
  ApprovalAuditEntry,
  ApprovalEngineConfig,
  ApprovalRequest,
  ApprovalResponse,
  ApprovalTheme,
  ProposedAction,
  RiskLevel,
  TaskContext,
  TrustLevel,
  TrustSettings,
  UserPattern,
  // ApprovalEvents, // Currently unused
} from './types';
// import { ApprovalThemeRegistry } from './ApprovalThemeRegistry'; // Currently unused
import { ApprovalContextAnalyzer } from './ApprovalContextAnalyzer';
import { RiskAssessment } from './RiskAssessment';

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
    context: TaskContext,
    proposedActions: ProposedAction[],
    options?: {
      category?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      requiresConfirmation?: boolean;
    },
  ): Promise<ApprovalResponse> {
    if (!this.config.enabled) {
      return this.createAutoApprovalResponse('System disabled');
    }

    try {
      // Analyze context to determine approval requirements
      const analysis = await ApprovalContextAnalyzer.analyzeTaskForApproval(context);

      // Perform risk assessment
      const riskAssessment = await RiskAssessment.assessRisk(
        context,
        proposedActions,
        analysis.suggestedCategory,
      );

      // Check if approval is actually needed
      if (!riskAssessment.requiresApproval && context.userTrustLevel !== TrustLevel.NOVICE) {
        return this.createAutoApprovalResponse('Low risk - auto-approved');
      }

      // Check for auto-approval eligibility
      if (
        riskAssessment.autoApprovalEligible &&
        this.canAutoApprove(riskAssessment.overallRisk, context.userTrustLevel)
      ) {
        this.emit('auto-approval-triggered', {
          requestId: `auto-${  uuidv4()}`,
          reason: 'Trust level and risk assessment allow auto-approval',
        });

        return this.createAutoApprovalResponse('Auto-approved based on trust level');
      }

      // Create approval request
      const request = this.createApprovalRequest(
        context,
        proposedActions,
        analysis.recommendedThemes[0], // Use primary theme
        riskAssessment,
        options,
      );

      // Store pending request
      this.pendingRequests.set(request.id, request);

      // Emit approval requested event
      this.emit('approval-requested', request);

      // Wait for user response (this would typically be handled by UI)
      return new Promise((resolve) => {
        // Set timeout for auto-approval if configured
        if (this.config.autoApprovalTimeout > 0 && riskAssessment.overallRisk === 'low') {
          setTimeout(() => {
            if (this.pendingRequests.has(request.id)) {
              this.pendingRequests.delete(request.id);
              this.emit('approval-timeout', { requestId: request.id });
              resolve(this.createAutoApprovalResponse('Timeout auto-approval'));
            }
          }, this.config.autoApprovalTimeout);
        }

        // Listen for response (would be triggered by UI interaction)
        this.once(`approval-response-${request.id}`, (response: ApprovalResponse) => {
          resolve(response);
        });
      });
    } catch (error) {
      console.error('Error in approval request:', error);
      return this.createErrorResponse(error as Error);
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
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Approval request ${requestId} not found`);
    }

    const response: ApprovalResponse = {
      requestId,
      action,
      approved: action === 'approve' || action === 'trust',
      comments,
      trustLevel: newTrustLevel,
      timestamp: new Date(),
      quickDecision: false, // Would be set to true if shortcut was used
    };

    // Handle trust level changes
    if (action === 'trust' && newTrustLevel) {
      await this.updateTrustLevel(newTrustLevel, 'User granted trust');
    }

    // Record in audit trail
    if (this.config.auditTrailEnabled) {
      this.recordAuditEntry(request, response);
    }

    // Update user patterns for learning
    if (this.config.learningEnabled) {
      this.updateUserPatterns(request, response);
    }

    // Clean up pending request
    this.pendingRequests.delete(requestId);

    // Emit response event
    this.emit('approval-responded', response);
    this.emit(`approval-response-${requestId}`, response);

    return response;
  }

  /**
   * Get current approval request for UI display
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
  async updateTrustLevel(newLevel: TrustLevel, reason: string): Promise<void> {
    const oldLevel = this.trustSettings.currentLevel;
    this.trustSettings.currentLevel = newLevel;

    // Update auto-approval categories based on trust level
    this.updateAutoApprovalCategories(newLevel);

    this.emit('trust-level-changed', { oldLevel, newLevel, reason });
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
    autoApprovals: number;
    manualApprovals: number;
    rejections: number;
    averageDecisionTime: number;
  } {
    const total = this.auditTrail.length;
    const autoApprovals = this.auditTrail.filter((entry) => entry.shortcutUsed === 'auto').length;
    const manualApprovals = this.auditTrail.filter(
      (entry) => entry.action === 'approve' && !entry.shortcutUsed,
    ).length;
    const rejections = this.auditTrail.filter((entry) => entry.action === 'reject').length;
    const avgDecisionTime =
      this.auditTrail.reduce((sum, entry) => sum + entry.decisionTime, 0) / total || 0;

    return {
      totalRequests: total,
      autoApprovals,
      manualApprovals,
      rejections,
      averageDecisionTime: avgDecisionTime,
    };
  }

  /**
   * Create approval request object
   */
  private createApprovalRequest(
    context: TaskContext,
    proposedActions: ProposedAction[],
    primaryTheme: ApprovalTheme | undefined,
    riskAssessment: unknown,
    options?: unknown,
  ): ApprovalRequest {
    return {
      id: uuidv4(),
      themeId: primaryTheme?.id || 'unknown',
      context,
      proposedActions,
      rationale: (riskAssessment as any).recommendations?.join('. ') || 'No rationale provided',
      riskAssessment: (riskAssessment as any).overallRisk || 'unknown',
      estimatedTime: primaryTheme?.estimatedTime || 'Unknown',
      dependencies: primaryTheme?.dependencies || [],
      securityImpact:
        (riskAssessment as any).factors?.some(
          (f: unknown) => (f as Record<string, unknown>)['category'] === 'Security Impact',
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
      requestId: `auto-${  uuidv4()}`,
      action: 'approve',
      approved: true,
      comments: reason,
      timestamp: new Date(),
      quickDecision: true,
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: Error): ApprovalResponse {
    return {
      requestId: `error-${  uuidv4()}`,
      action: 'reject',
      approved: false,
      comments: `Error: ${error.message}`,
      timestamp: new Date(),
      quickDecision: false,
    };
  }

  /**
   * Check if auto-approval is allowed
   */
  private canAutoApprove(risk: RiskLevel, trustLevel: TrustLevel): boolean {
    if (risk === 'critical') {return false;}

    switch (trustLevel) {
      case TrustLevel.NOVICE:
        return false;
      case TrustLevel.LEARNING:
        return risk === 'low';
      case TrustLevel.COLLABORATIVE:
      case TrustLevel.TRUSTED:
      case TrustLevel.AUTONOMOUS:
        return risk === 'low' || risk === 'medium';
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
          'architecture',
          'implementation',
          'refactoring',
          'security',
          'performance',
        ];
        break;
      case TrustLevel.LEARNING:
        this.trustSettings.autoApprovalCategories = ['refactoring'];
        this.trustSettings.requireApprovalFor = [
          'architecture',
          'implementation',
          'security',
          'performance',
        ];
        break;
      case TrustLevel.COLLABORATIVE:
        this.trustSettings.autoApprovalCategories = ['refactoring', 'implementation'];
        this.trustSettings.requireApprovalFor = ['architecture', 'security', 'performance'];
        break;
      case TrustLevel.TRUSTED:
        this.trustSettings.autoApprovalCategories = [
          'refactoring',
          'implementation',
          'performance',
        ];
        this.trustSettings.requireApprovalFor = ['architecture', 'security'];
        break;
      case TrustLevel.AUTONOMOUS:
        this.trustSettings.autoApprovalCategories = [
          'refactoring',
          'implementation',
          'performance',
          'architecture',
        ];
        this.trustSettings.requireApprovalFor = ['security'];
        break;
    }
  }

  /**
   * Record audit entry
   */
  private recordAuditEntry(request: ApprovalRequest, response: ApprovalResponse): void {
    const entry: ApprovalAuditEntry = {
      id: uuidv4(),
      requestId: request.id,
      userId: 'current-user', // Would come from context
      action: response.action,
      riskLevel: request.riskAssessment,
      category: 'implementation', // Would be determined from theme
      decisionTime: Date.now() - request.timestamp.getTime(),
      shortcutUsed: response.quickDecision ? 'quick' : undefined,
      outcome: 'unknown', // Would be updated later based on execution result
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
  private updateUserPatterns(_request: ApprovalRequest, response: ApprovalResponse): void {
    // Update metrics based on response
    if (response.approved) {
      this.trustSettings.learningMetrics.successfulTasks++;
      this.trustSettings.learningMetrics.totalApprovals++;
    }

    if (response.action === 'trust') {
      this.trustSettings.learningMetrics.userSatisfaction += 1; // Simplified scoring
    }

    // Check for trust level progression
    this.checkTrustLevelProgression();
  }

  /**
   * Check if trust level should be automatically increased
   */
  private checkTrustLevelProgression(): void {
    const metrics = this.trustSettings.learningMetrics;
    const currentLevel = this.trustSettings.currentLevel;

    // Simple progression logic - can be made more sophisticated
    if (currentLevel === TrustLevel.NOVICE && metrics.successfulTasks >= 5) {
      this.updateTrustLevel(TrustLevel.LEARNING, 'Automatic progression based on successful tasks');
    } else if (currentLevel === TrustLevel.LEARNING && metrics.successfulTasks >= 15) {
      this.updateTrustLevel(TrustLevel.COLLABORATIVE, 'Automatic progression based on experience');
    } else if (currentLevel === TrustLevel.COLLABORATIVE && metrics.successfulTasks >= 30) {
      this.updateTrustLevel(
        TrustLevel.TRUSTED,
        'Automatic progression based on proven reliability',
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
        'shift+tab': 'approve',
        'ctrl+y': 'approve',
        'ctrl+n': 'reject',
        'ctrl+r': 'review',
        'ctrl+t': 'trust',
      },
    };
  }

  /**
   * Get default trust settings
   */
  private getDefaultTrustSettings(): TrustSettings {
    return {
      currentLevel: TrustLevel.LEARNING,
      autoApprovalCategories: ['refactoring'],
      requireApprovalFor: ['architecture', 'implementation', 'security', 'performance'],
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
