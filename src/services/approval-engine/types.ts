/**
 * Human-in-the-Loop Approval System - Type Definitions
 * Core types for the approval engine and related components
 */

// Core approval categories
export type ApprovalCategory =
  | 'architecture'
  | 'implementation'
  | 'refactoring'
  | 'security'
  | 'performance';

// Risk levels for approval decisions
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Trust levels for progressive automation
export enum TrustLevel {
  NOVICE = 'novice', // All changes require approval
  LEARNING = 'learning', // Medium+ risk requires approval
  COLLABORATIVE = 'collaborative', // High+ risk requires approval
  TRUSTED = 'trusted', // Critical risk only requires approval
  AUTONOMOUS = 'autonomous', // Emergency cases only require approval
}

// Approval actions
export type ApprovalAction = 'approve' | 'reject' | 'review' | 'trust';

// Task context for approval analysis
export interface TaskContext {
  userInput: string;
  currentMode?: string;
  sessionHistory: string[];
  projectContext?: {
    type: string;
    complexity: number;
    criticalComponents: string[];
  };
  userTrustLevel: TrustLevel;
}

// Core approval theme definition
export interface ApprovalTheme {
  id: string;
  category: ApprovalCategory;
  title: string;
  description: string;
  impact: RiskLevel;
  suggestedApproach: string;
  alternatives?: string[];
  requiresConfirmation: boolean;
  estimatedTime?: string;
  securityConsiderations?: string[];
  dependencies?: string[];
}

// Proposed actions for approval
export interface ProposedAction {
  type: string;
  description: string;
  files: string[];
  riskLevel: RiskLevel;
  reversible: boolean;
}

// Main approval request structure
export interface ApprovalRequest {
  id: string;
  themeId: string;
  context: TaskContext;
  proposedActions: ProposedAction[];
  rationale: string;
  riskAssessment: RiskLevel;
  estimatedTime: string;
  dependencies: string[];
  securityImpact: boolean;
  automaticApproval: boolean;
  timestamp: Date;
}

// User response to approval request
export interface ApprovalResponse {
  requestId: string;
  action: ApprovalAction;
  approved: boolean;
  comments?: string;
  trustLevel?: TrustLevel;
  timestamp: Date;
  quickDecision: boolean; // true if used shortcut
}

// Quick approval options configuration
export interface QuickApprovalOptions {
  options: Array<{
    key: string;
    text: string;
    action: ApprovalAction;
    shortcut?: string;
  }>;
  shortcuts: Record<string, ApprovalAction>;
  timeout?: number; // Auto-approve timeout for low-risk items
}

// Risk assessment result
export interface RiskAssessmentResult {
  overallRisk: RiskLevel;
  factors: Array<{
    category: string;
    risk: RiskLevel;
    description: string;
    weight: number;
  }>;
  recommendations: string[];
  requiresApproval: boolean;
  autoApprovalEligible: boolean;
}

// Trust system settings
export interface TrustSettings {
  currentLevel: TrustLevel;
  autoApprovalCategories: ApprovalCategory[];
  requireApprovalFor: ApprovalCategory[];
  learningMetrics: {
    successfulTasks: number;
    userSatisfaction: number;
    errorsEncountered: number;
    totalApprovals: number;
    automaticApprovals: number;
  };
  preferences: {
    preferQuickApproval: boolean;
    verboseExplanations: boolean;
    showRiskDetails: boolean;
    defaultTimeout: number;
  };
}

// Approval point identification
export interface ApprovalPoint {
  id: string;
  category: ApprovalCategory;
  description: string;
  triggerConditions: string[];
  priority: number;
  mandatory: boolean;
}

// User pattern learning data
export interface UserPattern {
  userId: string;
  approvalFrequency: Record<ApprovalCategory, number>;
  shortcutUsage: Record<string, number>;
  averageDecisionTime: number;
  commonRejectionReasons: string[];
  preferredApproachTypes: string[];
  trustLevelHistory: Array<{
    level: TrustLevel;
    timestamp: Date;
    reason: string;
  }>;
}

// Approval audit trail entry
export interface ApprovalAuditEntry {
  id: string;
  requestId: string;
  userId: string;
  action: ApprovalAction;
  riskLevel: RiskLevel;
  category: ApprovalCategory;
  decisionTime: number; // milliseconds
  shortcutUsed?: string;
  outcome: 'success' | 'failure' | 'unknown';
  timestamp: Date;
}

// Approval engine configuration
export interface ApprovalEngineConfig {
  enabled: boolean;
  defaultTrustLevel: TrustLevel;
  riskThresholds: Record<RiskLevel, number>;
  autoApprovalTimeout: number;
  maxPendingApprovals: number;
  auditTrailEnabled: boolean;
  learningEnabled: boolean;
  shortcuts: Record<string, ApprovalAction>;
}

// Events for the approval system
export interface ApprovalEvents {
  'approval-requested': ApprovalRequest;
  'approval-responded': ApprovalResponse;
  'trust-level-changed': { oldLevel: TrustLevel; newLevel: TrustLevel; reason: string };
  'risk-assessment-completed': RiskAssessmentResult;
  'auto-approval-triggered': { requestId: string; reason: string };
  'approval-timeout': { requestId: string };
}
