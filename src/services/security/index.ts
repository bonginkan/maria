/**
 * Enterprise Security Module - Unified Export
 * Phase 4.0 Week 1: Complete enterprise security integration
 */

// Core Security Components
export {
  SecureSlashCommandAdapter,
  type SecureCommandContext,
  type AuthenticatedUser,
  type PermissionSet,
} from "./SecureSlashCommandAdapter";
export {
  RBACCommandGuard,
  type RBACConfig,
  type Role,
  type AuthorizationRequest,
  type AuthorizationResult,
} from "./RBACCommandGuard";
export {
  EnterpriseSecurityIntegration,
  type SecurityIntegrationConfig,
  type SecurityMetrics,
  type SecurityReport,
} from "./EnterpriseSecurityIntegration";

// Factory Functions
export { createEnterpriseSecurityIntegration } from "./EnterpriseSecurityIntegration";

// Re-export Phase 4 components for easy access
export { AccessControlManager } from "../memory-system/enterprise/access-control-manager";
export { EnterpriseAuthManager } from "../memory-system/data-porter-system/enterprise-auth-manager";
export { EnterpriseSecurityManager } from "../memory-system/data-porter-system/enterprise-security-manager";
export { EnterpriseAuditLogger } from "../memory-system/data-porter-system/enterprise-audit-logger";
