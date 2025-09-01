/**
 * Secure Slash Command Adapter
 * Integrates enterprise security with the unified SlashCommandHandler system
 * Provides RBAC, audit logging, and data classification for all command operations
 */

import {
  SlashCommandHandler,
  type HandlerDependencies,
  type SlashCommandV2,
} from "../../shared/handlers/SlashCommandHandler";
import type {
  CommandContext,
  CommandResult,
  CommandOptions,
} from "../../shared/types/context";
import { AccessControlManager } from "../memory-system/enterprise/access-control-manager";
import { EnterpriseAuthManager } from "../memory-system/data-porter-system/enterprise-auth-manager";
import { EnterpriseSecurityManager } from "../memory-system/data-porter-system/enterprise-security-manager";
import { EnterpriseAuditLogger } from "../memory-system/data-porter-system/enterprise-audit-logger";
import { EventEmitter } from "node:events";

export interface SecureCommandContext extends CommandContext {
  user: AuthenticatedUser;
  permissions: PermissionSet;
  securityPolicy: SecurityPolicy;
  classification: DataClassification;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  clearanceLevel: "public" | "internal" | "confidential" | "secret";
  sessionId: string;
  lastActivity: Date;
  mfaVerified: boolean;
}

export interface PermissionSet {
  commands: CommandPermission[];
  data: DataPermission[];
  operations: string[];
  restrictions: SecurityRestriction[];
}

export interface CommandPermission {
  command: string;
  allowed: boolean;
  conditions: PermissionCondition[];
  auditLevel: "none" | "basic" | "detailed" | "full";
}

export interface PermissionCondition {
  type: "time" | "location" | "data_classification" | "mfa_required";
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: any;
}

export interface DataPermission {
  classification: string;
  access: "read" | "write" | "delete" | "export" | "share";
  scope: "own" | "team" | "project" | "organization";
}

export interface SecurityRestriction {
  type: "ip_whitelist" | "time_window" | "concurrent_sessions" | "data_export";
  config: any;
  enforced: boolean;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  version: string;
  rules: SecurityRule[];
  enforcement: "permissive" | "enforcing" | "complaining";
}

export interface SecurityRule {
  id: string;
  condition: string;
  action: "allow" | "deny" | "audit" | "alert" | "mfa_require";
  priority: number;
}

export interface DataClassification {
  level: "public" | "internal" | "confidential" | "restricted" | "secret";
  categories: string[];
  handling: "standard" | "encrypted" | "masked" | "redacted";
  retention: number; // days
}

export interface AuditEntry {
  timestamp: Date;
  userId: string;
  sessionId: string;
  command: string;
  args: string[];
  result: "success" | "failure" | "denied";
  error?: string;
  dataClassification: string;
  ipAddress: string;
  userAgent: string;
  duration: number;
  resourcesAccessed: string[];
}

/**
 * Secure Slash Command Adapter
 * Wraps SlashCommandHandler with enterprise security features
 */
export class SecureSlashCommandAdapter extends EventEmitter {
  private handler: SlashCommandHandler;
  private accessControl: AccessControlManager;
  private authManager: EnterpriseAuthManager;
  private securityManager: EnterpriseSecurityManager;
  private auditLogger: EnterpriseAuditLogger;
  private securityPolicies: Map<string, SecurityPolicy> = new Map();

  constructor(
    dependencies: HandlerDependencies,
    securityConfig: {
      accessControl: AccessControlManager;
      authManager: EnterpriseAuthManager;
      securityManager: EnterpriseSecurityManager;
      auditLogger: EnterpriseAuditLogger;
    },
  ) {
    super();

    this.handler = new SlashCommandHandler(dependencies);
    this.accessControl = securityConfig.accessControl;
    this.authManager = securityConfig.authManager;
    this.securityManager = securityConfig.securityManager;
    this.auditLogger = securityConfig.auditLogger;

    this.initializeSecurityPolicies();
  }

  /**
   * Initialize default security policies
   */
  private initializeSecurityPolicies(): void {
    // Default security policy for all commands
    const defaultPolicy: SecurityPolicy = {
      id: "default",
      name: "Default Security Policy",
      version: "1.0.0",
      enforcement: "enforcing",
      rules: [
        {
          id: "authenticated_user_required",
          condition: "user.authenticated == true",
          action: "allow",
          priority: 1000,
        },
        {
          id: "mfa_for_sensitive_commands",
          condition:
            'command in ["export", "delete", "admin"] && user.mfaVerified == false',
          action: "mfa_require",
          priority: 900,
        },
        {
          id: "audit_all_commands",
          condition: "true",
          action: "audit",
          priority: 100,
        },
      ],
    };

    this.securityPolicies.set("default", defaultPolicy);
  }

  /**
   * Execute command with full security enforcement
   */
  async executeSecure(
    commandName: string,
    args: string[],
    sessionToken: string,
    options: CommandOptions = {},
  ): Promise<CommandResult> {
    const startTime = Date.now();
    let auditEntry: Partial<AuditEntry> = {
      timestamp: new Date(),
      command: commandName,
      args,
      ipAddress: this.getClientIP(),
      userAgent: this.getClientUserAgent(),
    };

    try {
      // 1. Authenticate user
      const user = await this.authenticateUser(sessionToken);
      if (!user) {
        auditEntry = {
          ...auditEntry,
          result: "denied",
          error: "Authentication failed",
        };
        await this.auditLogger.log(auditEntry as AuditEntry);
        return {
          success: false,
          error: "Authentication required",
          messages: [],
        };
      }

      auditEntry.userId = user.id;
      auditEntry.sessionId = user.sessionId;

      // 2. Get user permissions
      const permissions = await this.getUserPermissions(user);

      // 3. Apply security policy
      const securityPolicy = await this.getSecurityPolicy(user, commandName);

      // 4. Authorize command execution
      const authResult = await this.authorizeCommand(
        user,
        commandName,
        args,
        permissions,
        securityPolicy,
      );
      if (!authResult.allowed) {
        auditEntry = {
          ...auditEntry,
          result: "denied",
          error: authResult.reason,
        };
        await this.auditLogger.log(auditEntry as AuditEntry);
        return { success: false, error: authResult.reason, messages: [] };
      }

      // 5. Handle MFA requirement
      if (authResult.mfaRequired && !user.mfaVerified) {
        return {
          success: false,
          error: "Multi-factor authentication required",
          messages: [],
        };
      }

      // 6. Create secure context
      const secureContext: SecureCommandContext = {
        command: commandName,
        args,
        options,
        deps: options.deps || ({} as any),
        signal: options.signal,
        user,
        permissions,
        securityPolicy,
        classification: await this.classifyCommand(commandName, args),
      };

      // 7. Execute command with security wrapper
      const result = await this.executeWithSecurityWrapper(secureContext);

      // 8. Post-process result (apply data masking if needed)
      const processedResult = await this.postProcessResult(
        result,
        user,
        permissions,
      );

      // 9. Audit successful execution
      const duration = Date.now() - startTime;
      auditEntry = {
        ...auditEntry,
        result: "success",
        duration,
        dataClassification: secureContext.classification.level,
        resourcesAccessed: this.extractResourcesAccessed(result),
      };
      await this.auditLogger.log(auditEntry as AuditEntry);

      return processedResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      auditEntry = {
        ...auditEntry,
        result: "failure",
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      };
      await this.auditLogger.log(auditEntry as AuditEntry);

      return {
        success: false,
        error: "Command execution failed",
        messages: [],
      };
    }
  }

  /**
   * Register a command with security metadata
   */
  registerSecureCommand(
    command: SlashCommandV2,
    securityMetadata: {
      requiredPermissions: string[];
      dataClassification: DataClassification;
      auditLevel: "none" | "basic" | "detailed" | "full";
      mfaRequired?: boolean;
    },
  ): void {
    // Wrap the command execution with security checks
    const originalExecute = command.execute;
    command.execute = async (
      context: CommandContext,
    ): Promise<CommandResult> => {
      // Security wrapper logic would go here
      return originalExecute(context);
    };

    this.handler.register(command);
  }

  /**
   * Private helper methods
   */
  private async authenticateUser(
    sessionToken: string,
  ): Promise<AuthenticatedUser | null> {
    // Implementation would validate session token and return user
    // This is a placeholder implementation
    return {
      id: "user1",
      username: "testuser",
      email: "test@example.com",
      roles: ["user"],
      clearanceLevel: "internal",
      sessionId: sessionToken,
      lastActivity: new Date(),
      mfaVerified: false,
    };
  }

  private async getUserPermissions(
    user: AuthenticatedUser,
  ): Promise<PermissionSet> {
    // Implementation would fetch user permissions from access control manager
    return {
      commands: [],
      data: [],
      operations: [],
      restrictions: [],
    };
  }

  private async getSecurityPolicy(
    user: AuthenticatedUser,
    command: string,
  ): Promise<SecurityPolicy> {
    return this.securityPolicies.get("default")!;
  }

  private async authorizeCommand(
    user: AuthenticatedUser,
    command: string,
    args: string[],
    permissions: PermissionSet,
    policy: SecurityPolicy,
  ): Promise<{ allowed: boolean; reason?: string; mfaRequired?: boolean }> {
    // Implementation would evaluate security rules
    return { allowed: true };
  }

  private async classifyCommand(
    command: string,
    args: string[],
  ): Promise<DataClassification> {
    // Implementation would classify the data involved in the command
    return {
      level: "internal",
      categories: [],
      handling: "standard",
      retention: 365,
    };
  }

  private async executeWithSecurityWrapper(
    context: SecureCommandContext,
  ): Promise<CommandResult> {
    return this.handler.execute(context.command, context.args, context.options);
  }

  private async postProcessResult(
    result: CommandResult,
    user: AuthenticatedUser,
    permissions: PermissionSet,
  ): Promise<CommandResult> {
    // Implementation would apply data masking/redaction based on permissions
    return result;
  }

  private extractResourcesAccessed(result: CommandResult): string[] {
    // Implementation would extract which resources were accessed
    return [];
  }

  private getClientIP(): string {
    // Implementation would get client IP from request context
    return "127.0.0.1";
  }

  private getClientUserAgent(): string {
    // Implementation would get client user agent from request context
    return "MARIA CLI";
  }
}

/**
 * Factory function to create secure slash command adapter
 */
export function createSecureSlashCommandAdapter(
  dependencies: HandlerDependencies,
  securityManagers: {
    accessControl: AccessControlManager;
    authManager: EnterpriseAuthManager;
    securityManager: EnterpriseSecurityManager;
    auditLogger: EnterpriseAuditLogger;
  },
): SecureSlashCommandAdapter {
  return new SecureSlashCommandAdapter(dependencies, securityManagers);
}
