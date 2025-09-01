/**
 * RBAC Command Guard
 * Role-Based Access Control system for slash commands
 * Provides hierarchical permission evaluation and policy enforcement
 */

import { EventEmitter } from "node:events";
import type {
  AuthenticatedUser,
  PermissionSet,
  SecurityPolicy,
  CommandPermission,
  PermissionCondition,
} from "./SecureSlashCommandAdapter";

export interface RBACConfig {
  organizationId: string;
  defaultDenyAll: boolean;
  inheritanceEnabled: boolean;
  auditFailures: boolean;
  cachePermissions: boolean;
  cacheTTL: number; // seconds
}

export interface Role {
  id: string;
  name: string;
  description: string;
  level: "system" | "organization" | "project" | "team" | "individual";
  priority: number;
  permissions: string[];
  inheritsFrom: string[];
  conditions: RoleCondition[];
  active: boolean;
}

export interface RoleCondition {
  type: "time" | "location" | "mfa" | "custom";
  requirement: any;
  enforced: boolean;
}

export interface AuthorizationRequest {
  user: AuthenticatedUser;
  command: string;
  args: string[];
  context: CommandExecutionContext;
  timestamp: Date;
}

export interface CommandExecutionContext {
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  dataInvolved: DataReference[];
  resourcesRequired: ResourceReference[];
}

export interface DataReference {
  type: "memory" | "file" | "export" | "import";
  classification: string;
  sensitivity: string;
  owner: string;
  scope: "personal" | "team" | "project" | "organization";
}

export interface ResourceReference {
  type: "system" | "storage" | "network" | "compute";
  id: string;
  permissions: string[];
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  conditions?: string[];
  auditRequired: boolean;
  mfaRequired: boolean;
  dataRestrictions?: DataRestriction[];
  timeLimit?: number; // seconds
  evaluationPath: string[];
}

export interface DataRestriction {
  field: string;
  action: "mask" | "redact" | "encrypt" | "exclude";
  reason: string;
}

/**
 * Permission cache entry
 */
interface PermissionCacheEntry {
  permissions: PermissionSet;
  computed: Date;
  expires: Date;
  version: string;
}

/**
 * RBAC Command Guard - Centralized authorization engine
 */
export class RBACCommandGuard extends EventEmitter {
  private config: RBACConfig;
  private roles: Map<string, Role> = new Map();
  private commandPolicies: Map<string, CommandPolicy> = new Map();
  private permissionCache: Map<string, PermissionCacheEntry> = new Map();
  private policyVersion: string = "1.0.0";

  constructor(config: RBACConfig) {
    super();
    this.config = config;
    this.initializeDefaultRoles();
    this.initializeCommandPolicies();
  }

  /**
   * Main authorization method
   */
  async authorizeCommand(
    request: AuthorizationRequest,
  ): Promise<AuthorizationResult> {
    const evaluationPath: string[] = [];

    try {
      // 1. Get user permissions (with caching)
      const permissions = await this.getUserPermissions(request.user);
      evaluationPath.push(`permissions_loaded:${permissions.commands.length}`);

      // 2. Find applicable command policy
      const policy = this.getCommandPolicy(request.command);
      evaluationPath.push(`policy:${policy.id}`);

      // 3. Check base command permission
      const basePermission = await this.checkBasePermission(
        request,
        permissions,
      );
      if (!basePermission.allowed) {
        evaluationPath.push(`base_permission:denied:${basePermission.reason}`);
        return {
          allowed: false,
          reason: basePermission.reason,
          auditRequired: true,
          mfaRequired: false,
          evaluationPath,
        };
      }
      evaluationPath.push("base_permission:allowed");

      // 4. Evaluate role conditions
      const roleConditions = await this.evaluateRoleConditions(request.user);
      if (!roleConditions.satisfied) {
        evaluationPath.push(
          `role_conditions:failed:${roleConditions.failedConditions.join(",")}`,
        );
        return {
          allowed: false,
          reason: `Role conditions not met: ${roleConditions.failedConditions.join(", ")}`,
          auditRequired: true,
          mfaRequired: roleConditions.mfaRequired,
          evaluationPath,
        };
      }
      evaluationPath.push("role_conditions:satisfied");

      // 5. Check data access permissions
      const dataAccess = await this.checkDataAccessPermissions(
        request,
        permissions,
      );
      if (!dataAccess.allowed) {
        evaluationPath.push(`data_access:denied:${dataAccess.reason}`);
        return {
          allowed: false,
          reason: dataAccess.reason,
          auditRequired: true,
          mfaRequired: false,
          evaluationPath,
        };
      }
      evaluationPath.push("data_access:allowed");

      // 6. Evaluate security policy rules
      const policyEvaluation = await this.evaluateSecurityPolicy(
        request,
        policy,
      );
      evaluationPath.push(`policy_evaluation:${policyEvaluation.result}`);

      // 7. Determine final result
      const result: AuthorizationResult = {
        allowed: policyEvaluation.allowed,
        reason: policyEvaluation.reason,
        conditions: policyEvaluation.conditions,
        auditRequired: policy.auditRequired || !policyEvaluation.allowed,
        mfaRequired: policyEvaluation.mfaRequired || roleConditions.mfaRequired,
        dataRestrictions: dataAccess.restrictions,
        timeLimit: policyEvaluation.timeLimit,
        evaluationPath,
      };

      // Emit authorization event for monitoring
      this.emit("authorization", {
        userId: request.user.id,
        command: request.command,
        allowed: result.allowed,
        reason: result.reason,
        timestamp: request.timestamp,
      });

      return result;
    } catch (error) {
      evaluationPath.push(
        `error:${error instanceof Error ? error.message : "unknown"}`,
      );

      return {
        allowed: false,
        reason: "Authorization system error",
        auditRequired: true,
        mfaRequired: false,
        evaluationPath,
      };
    }
  }

  /**
   * Get user permissions with caching
   */
  private async getUserPermissions(
    user: AuthenticatedUser,
  ): Promise<PermissionSet> {
    const cacheKey = `${user.id}:${user.roles.join(",")}:${this.policyVersion}`;

    if (this.config.cachePermissions) {
      const cached = this.permissionCache.get(cacheKey);
      if (cached && cached.expires > new Date()) {
        return cached.permissions;
      }
    }

    // Compute permissions from roles
    const permissions = await this.computePermissions(user);

    if (this.config.cachePermissions) {
      const expires = new Date();
      expires.setSeconds(expires.getSeconds() + this.config.cacheTTL);

      this.permissionCache.set(cacheKey, {
        permissions,
        computed: new Date(),
        expires,
        version: this.policyVersion,
      });
    }

    return permissions;
  }

  /**
   * Compute permissions from user roles
   */
  private async computePermissions(
    user: AuthenticatedUser,
  ): Promise<PermissionSet> {
    const commandPermissions: CommandPermission[] = [];
    const allPermissions = new Set<string>();

    // Process roles in priority order
    const userRoles = user.roles
      .map((roleId) => this.roles.get(roleId))
      .filter((role) => role && role.active)
      .sort((a, b) => (b?.priority || 0) - (a?.priority || 0));

    for (const role of userRoles) {
      if (!role) continue;

      // Add role permissions
      for (const permission of role.permissions) {
        allPermissions.add(permission);
      }

      // Handle inheritance
      if (this.config.inheritanceEnabled && role.inheritsFrom.length > 0) {
        for (const parentRoleId of role.inheritsFrom) {
          const parentRole = this.roles.get(parentRoleId);
          if (parentRole && parentRole.active) {
            for (const permission of parentRole.permissions) {
              allPermissions.add(permission);
            }
          }
        }
      }
    }

    // Convert permissions to command permissions
    for (const permission of allPermissions) {
      if (permission.startsWith("command:")) {
        const commandName = permission.replace("command:", "");
        commandPermissions.push({
          command: commandName,
          allowed: true,
          conditions: [],
          auditLevel: "basic",
        });
      }
    }

    return {
      commands: commandPermissions,
      data: [], // Would be populated based on data permissions
      operations: Array.from(allPermissions),
      restrictions: [],
    };
  }

  /**
   * Check base command permission
   */
  private async checkBasePermission(
    request: AuthorizationRequest,
    permissions: PermissionSet,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const commandPermission = permissions.commands.find(
      (p) => p.command === request.command || p.command === "*",
    );

    // Special handling for dangerous commands
    const dangerousCommands = [
      "delete-system",
      "drop-database",
      "format",
      "shutdown",
    ];
    const isDangerous = dangerousCommands.some((cmd) =>
      request.command.includes(cmd),
    );

    if (!commandPermission) {
      // For dangerous commands, deny by default regardless of defaultDenyAll setting
      if (isDangerous) {
        return {
          allowed: false,
          reason: "Dangerous command requires explicit permission",
        };
      }

      return {
        allowed: this.config.defaultDenyAll ? false : true,
        reason: this.config.defaultDenyAll
          ? "No explicit permission granted"
          : undefined,
      };
    }

    if (!commandPermission.allowed) {
      return {
        allowed: false,
        reason: "Command explicitly denied",
      };
    }

    return { allowed: true };
  }

  /**
   * Evaluate role conditions
   */
  private async evaluateRoleConditions(user: AuthenticatedUser): Promise<{
    satisfied: boolean;
    failedConditions: string[];
    mfaRequired: boolean;
  }> {
    const failedConditions: string[] = [];
    let mfaRequired = false;

    for (const roleId of user.roles) {
      const role = this.roles.get(roleId);
      if (!role) continue;

      for (const condition of role.conditions) {
        if (!condition.enforced) continue;

        switch (condition.type) {
          case "mfa":
            if (!user.mfaVerified) {
              mfaRequired = true;
              if (condition.requirement.required) {
                failedConditions.push(`MFA required for role ${role.name}`);
              }
            }
            break;

          case "time":
            if (!this.evaluateTimeCondition(condition.requirement)) {
              failedConditions.push(`Time restriction for role ${role.name}`);
            }
            break;

          // Add other condition types as needed
        }
      }
    }

    return {
      satisfied: failedConditions.length === 0,
      failedConditions,
      mfaRequired,
    };
  }

  /**
   * Check data access permissions
   */
  private async checkDataAccessPermissions(
    request: AuthorizationRequest,
    permissions: PermissionSet,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    restrictions?: DataRestriction[];
  }> {
    // This would implement data classification-based access control
    return { allowed: true };
  }

  /**
   * Initialize default roles
   */
  private initializeDefaultRoles(): void {
    const systemAdmin: Role = {
      id: "system_admin",
      name: "System Administrator",
      description: "Full system access",
      level: "system",
      priority: 1000,
      permissions: ["command:*", "data:*", "admin:*"],
      inheritsFrom: [],
      conditions: [
        { type: "mfa", requirement: { required: true }, enforced: true },
      ],
      active: true,
    };

    const projectManager: Role = {
      id: "project_manager",
      name: "Project Manager",
      description: "Project-level management access",
      level: "project",
      priority: 500,
      permissions: [
        "command:init",
        "command:status",
        "command:export",
        "data:project:*",
      ],
      inheritsFrom: ["user"],
      conditions: [],
      active: true,
    };

    const user: Role = {
      id: "user",
      name: "Regular User",
      description: "Standard user access",
      level: "individual",
      priority: 100,
      permissions: [
        "command:help",
        "command:code",
        "command:memory",
        "data:personal:*",
      ],
      inheritsFrom: [],
      conditions: [],
      active: true,
    };

    this.roles.set(systemAdmin.id, systemAdmin);
    this.roles.set(projectManager.id, projectManager);
    this.roles.set(user.id, user);
  }

  /**
   * Initialize command policies
   */
  private initializeCommandPolicies(): void {
    // This would be populated with command-specific security policies
  }

  /**
   * Helper methods
   */
  private getCommandPolicy(command: string): CommandPolicy {
    return this.commandPolicies.get(command) || this.getDefaultCommandPolicy();
  }

  private getDefaultCommandPolicy(): CommandPolicy {
    return {
      id: "default",
      auditRequired: true,
      mfaRequired: false,
      conditions: [],
      timeLimit: 300,
    };
  }

  private evaluateTimeCondition(requirement: any): boolean {
    // Implementation for time-based conditions
    return true;
  }

  private async evaluateSecurityPolicy(
    request: AuthorizationRequest,
    policy: CommandPolicy,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    conditions?: string[];
    mfaRequired: boolean;
    timeLimit?: number;
    result: string;
  }> {
    return {
      allowed: true,
      mfaRequired: policy.mfaRequired,
      timeLimit: policy.timeLimit,
      result: "allowed",
    };
  }
}

interface CommandPolicy {
  id: string;
  auditRequired: boolean;
  mfaRequired: boolean;
  conditions: string[];
  timeLimit?: number;
}
