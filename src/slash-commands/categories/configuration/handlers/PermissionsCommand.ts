/**
 * Permissions Command Handler v2.0
 * Manages MARIA access permissions and security settings with SSOT metadata
 */

import { BaseCommand } from "../../../base-command";
import type { CommandMeta } from '../../../shared/BaseCommand';
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  ValidationResult,
} from "../../../types";
import { logger } from "../../../../utils/logger";
import fs from "fs/promises";
import path from "path";
import os from "os";

interface Permission {
  id: string;
  name: string;
  description: string;
  category: "file" | "network" | "system" | "ai" | "data";
  risk: "low" | "medium" | "high";
  _granted: boolean;
  grantedAt?: Date;
  expiresAt?: Date;
  conditions?: string[];
}

interface PermissionPolicy {
  autoGrant: boolean;
  requireConfirmation: boolean;
  notifyOnGrant: boolean;
  auditLog: boolean;
  maxGrantDuration: number; // hours
  riskBasedApproval: boolean;
}

interface SecurityConfig {
  version: string;
  permissions: Permission[];
  policies: PermissionPolicy;
  trustedDomains: string[];
  blockedDomains: string[];
  trustedProcesses: string[];
  securityLevel: "strict" | "balanced" | "permissive";
}

// SSOT Metadata
export const meta: CommandMeta = {
  name: 'permissions',
  category: 'configuration',
  description: 'Manage MARIA access permissions and security settings',
  aliases: ['perms', 'security', 'access'],
  status: 'stable'
};

export class PermissionsCommand extends BaseCommand {
  readonly meta = meta;
  name = meta.name;
  category = meta.category;
  description = meta.description;
  aliases = meta.aliases || [];
  usage =
    "[list|grant|revoke|audit|reset|export|policy|domains] [_permission-id] [options]";

  examples = [
    {
      input: "/permissions list",
      description: "List all permissions and their status",
    },
    {
      input: "/permissions grant file_write",
      description: "Grant file write _permission",
    },
    {
      input: "/permissions revoke system_exec",
      description: "Revoke system execution _permission",
    },
    {
      input: "/permissions audit --_limit 20",
      description: "Show recent _permission activity",
    },
    {
      input: "/permissions policy --strict",
      description: "Set strict security policy",
    },
  ];

  metadata = {
    version: "2.1.0",
    author: "MARIA Team",
    since: "2.0.0",
  };

  permissions = {
    requiresAuth: true,
    role: "user",
  };

  private configPath = path.join(os.homedir(), ".maria", "security.json");
  private auditPath = path.join(os.homedir(), ".maria", "audit.log");

  private readonly defaultPermissions: Permission[] = [
    {
      id: "file_read",
      name: "File System Read",
      description: "Read files from your local file system",
      category: "file",
      risk: "low",
      _granted: true,
    },
    {
      id: "file_write",
      name: "File System Write",
      description: "Create and modify files on your system",
      category: "file",
      risk: "medium",
      _granted: true,
    },
    {
      id: "file_delete",
      name: "File System Delete",
      description: "Delete files and directories",
      category: "file",
      risk: "high",
      _granted: false,
    },
    {
      id: "file_execute",
      name: "File Execution",
      description: "Execute files and scripts",
      category: "file",
      risk: "high",
      _granted: false,
    },
    {
      id: "network_request",
      name: "Network Requests",
      description: "Make HTTP/HTTPS requests to external services",
      category: "network",
      risk: "medium",
      _granted: true,
    },
    {
      id: "network_server",
      name: "Network Server",
      description: "Start local network servers",
      category: "network",
      risk: "high",
      _granted: false,
    },
    {
      id: "system_exec",
      name: "System Command Execution",
      description: "Execute system commands and scripts",
      category: "system",
      risk: "high",
      _granted: false,
    },
    {
      id: "system_env",
      name: "Environment Variables",
      description: "Read and modify environment variables",
      category: "system",
      risk: "medium",
      _granted: false,
    },
    {
      id: "system_process",
      name: "Process Management",
      description: "Start, stop, and manage system processes",
      category: "system",
      risk: "high",
      _granted: false,
    },
    {
      id: "ai_cloud",
      name: "Cloud AI Access",
      description: "Send data to cloud AI providers",
      category: "ai",
      risk: "medium",
      _granted: true,
    },
    {
      id: "ai_local",
      name: "Local AI Access",
      description: "Use local AI models (LM Studio, Ollama)",
      category: "ai",
      risk: "low",
      _granted: true,
    },
    {
      id: "ai_training",
      name: "AI Model Training",
      description: "Train or fine-tune AI models",
      category: "ai",
      risk: "medium",
      _granted: false,
    },
    {
      id: "data_telemetry",
      name: "Usage Telemetry",
      description: "Send anonymous usage statistics",
      category: "data",
      risk: "low",
      _granted: false,
    },
    {
      id: "data_sync",
      name: "Cloud Sync",
      description: "Sync settings and history to cloud",
      category: "data",
      risk: "medium",
      _granted: false,
    },
    {
      id: "data_backup",
      name: "Data Backup",
      description: "Create and manage data backups",
      category: "data",
      risk: "low",
      _granted: true,
    },
    {
      id: "clipboard_access",
      name: "Clipboard Access",
      description: "Read and write to system clipboard",
      category: "system",
      risk: "medium",
      _granted: false,
    },
  ];

  async execute(
    _args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const _startTime = Date.now();
      const _action = (_args.parsed.positional?.[0] as string) || "list";

      let result: CommandResult;

      switch (_action.toLowerCase()) {
        case "list":
        case "ls":
          result = await this.listPermissions(_args);
          break;

        case "grant":
          result = await this.grantPermission(_args);
          break;

        case "revoke":
          result = await this.revokePermission(_args);
          break;

        case "audit":
          result = await this.showAuditLog(_args);
          break;

        case "reset":
          result = await this.resetPermissions(_args);
          break;

        case "export":
          result = await this.exportPermissions(_args);
          break;

        case "import":
          result = await this.importPermissions(_args);
          break;

        case "policy":
          result = await this.managePolicies(_args);
          break;

        case "domains":
          result = await this.manageDomains(_args);
          break;

        case "status":
          result = await this.showSecurityStatus(_args);
          break;

        case "help":
          result = this.success(this.formatHelp());
          break;

        default:
          result = this.error(
            `Unknown permissions _action: ${_action}. Use: list, grant, revoke, audit, reset, export, policy, domains, status`,
          );
      }

      result.metadata = {
        ...result.metadata,
        executionTime: Date.now() - _startTime,
      };

      this.logExecution(_args, context, result);
      return result;
    } catch (error) {
      logger.error("Permissions command execution failed:", error);
      return this.error(
        `Permissions command failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "PERMISSIONS_ERROR",
        error,
      );
    }
  }

  async validate(args: CommandArgs): Promise<ValidationResult> {
    const _action = args.parsed.positional?.[0] as string;

    if (!_action) {
      return { success: true }; // Default to list _action
    }

    const _validActions = [
      "list",
      "grant",
      "revoke",
      "audit",
      "reset",
      "export",
      "import",
      "policy",
      "domains",
      "status",
      "help",
    ];
    if (!_validActions.includes(_action.toLowerCase())) {
      return {
        success: false,
        error: `Invalid _action: ${_action}`,
        _suggestions: _validActions,
      };
    }

    // Validate specific _action requirements
    if (
      (_action === "grant" || _action === "revoke") &&
      !args.parsed.positional?.[1]
    ) {
      return {
        success: false,
        error: `Permission ID required for ${_action} _action`,
        _suggestions: ["Specify a _permission ID"],
      };
    }

    return { success: true };
  }

  private async listPermissions(args: CommandArgs): Promise<CommandResult> {
    const _config = await this.loadSecurityConfig();
    const _categoryFilter = args.options.category as string;
    const _riskFilter = args.options.risk as string;
    const _statusFilter = args.options.status as string;

    let permissions = _config.permissions;

    // Apply filters
    if (_categoryFilter) {
      permissions = permissions.filter((p) => p.category === _categoryFilter);
    }

    if (_riskFilter) {
      permissions = permissions.filter((p) => p.risk === _riskFilter);
    }

    if (_statusFilter) {
      const _granted = _statusFilter.toLowerCase() === "_granted";
      permissions = permissions.filter((p) => p._granted === _granted);
    }

    // Group by category
    const _categories = this.groupByCategory(permissions);

    let message = `# 🔐 MARIA Security Permissions\n\n`;
    message += `**Security Level**: ${_config.securityLevel.toUpperCase()}\n`;
    message += `**Total Permissions**: ${_config.permissions.length}\n`;
    message += `**Granted**: ${_config.permissions.filter((p) => p._granted).length}\n`;
    message += `**Revoked**: ${_config.permissions.filter((p) => !p._granted).length}\n\n`;

    for (const [category, categoryPermissions] of Object.entries(_categories)) {
      if (categoryPermissions.length === 0) {
        continue;
      }

      message += `## ${this.getCategoryEmoji(category)} ${category.toUpperCase()}\n\n`;

      for (const _permission of categoryPermissions) {
        const _statusIcon = _permission._granted ? "✅" : "❌";
        const _riskEmoji = this.getRiskEmoji(_permission.risk);

        message += `**${_statusIcon} ${_permission.name}** ${_riskEmoji}\n`;
        message += `   ID: \`${_permission.id}\`\n`;
        message += `   ${_permission.description}\n`;

        if (_permission._granted && _permission.grantedAt) {
          message += `   *Granted: ${new Date(_permission.grantedAt).toLocaleString()}*\n`;
        }

        if (_permission.expiresAt) {
          const _expires = new Date(_permission.expiresAt);
          const _isExpired = _expires < new Date();
          message += `   *${_isExpired ? "⚠️ Expired" : "⏰ Expires"}: ${_expires.toLocaleString()}*\n`;
        }

        if (_permission.conditions && _permission.conditions.length > 0) {
          message += `   *Conditions: ${_permission.conditions.join(", ")}*\n`;
        }

        message += "\n";
      }
    }

    message += `---\n`;
    message += `*Use \`/permissions grant <id>\` to grant _permission*\n`;
    message += `*Use \`/permissions revoke <id>\` to revoke _permission*\n`;
    message += `*Use \`/permissions audit\` to view activity log*`;

    return this.success(message, { permissions, _config });
  }

  private async grantPermission(args: CommandArgs): Promise<CommandResult> {
    const _permissionId = args.parsed.positional?.[1] as string;
    const _duration = args.options._duration
      ? parseInt(args.options._duration as string)
      : undefined;
    const _force = args.flags._force;

    const _config = await this.loadSecurityConfig();
    const _permission = _config.permissions.find((p) => p.id === _permissionId);

    if (!_permission) {
      const _suggestions = this.findSimilarPermissions(
        _permissionId,
        _config.permissions,
      );
      return this.error(
        `Permission not found: ${_permissionId}`,
        "PERMISSION_NOT_FOUND",
        { _suggestions },
      );
    }

    if (_permission.granted && !_force) {
      return this.error(
        `Permission "${_permission.name}" is already granted. Use --_force to override.`,
        "ALREADY_GRANTED",
      );
    }

    // Check security policy
    if (
      _config.policies.requireConfirmation &&
      _permission.risk === "high" &&
      !_force
    ) {
      return this.error(
        `High-risk _permission requires confirmation. Use --_force to override.`,
        "CONFIRMATION_REQUIRED",
      );
    }

    // Grant _permission
    _permission.granted = true;
    permission.grantedAt = new Date();

    // Set expiration if specified
    if (_duration) {
      permission.expiresAt = new Date(Date.now() + _duration * 60 * 60 * 1000);
    } else if (
      _config.policies.maxGrantDuration > 0 &&
      _permission.risk === "high"
    ) {
      permission.expiresAt = new Date(
        Date.now() + _config.policies.maxGrantDuration * 60 * 60 * 1000,
      );
    }

    await this.saveSecurityConfig(_config);
    await this.logAuditEvent("GRANT", _permission);

    let message = `✅ **Permission Granted**\n\n`;
    message += `**Permission**: ${_permission.name}\n`;
    message += `**ID**: ${_permission.id}\n`;
    message += `**Category**: ${_permission.category}\n`;
    message += `**Risk Level**: ${_permission.risk} ${this.getRiskEmoji(_permission.risk)}\n`;
    message += `**Description**: ${_permission.description}\n`;

    if (_permission.expiresAt) {
      message += `**Expires**: ${new Date(_permission.expiresAt).toLocaleString()}\n`;
    }

    if (_permission.risk === "high") {
      message += `\n⚠️ **High-Risk Permission**: This _permission allows potentially dangerous operations. Use with caution.`;
    }

    return this.success(message, { _permission });
  }

  private async revokePermission(args: CommandArgs): Promise<CommandResult> {
    const _permissionId = args.parsed.positional?.[1] as string;

    const _config = await this.loadSecurityConfig();
    const _permission = _config.permissions.find((p) => p.id === _permissionId);

    if (!_permission) {
      return this.error(
        `Permission not found: ${_permissionId}`,
        "PERMISSION_NOT_FOUND",
      );
    }

    if (!_permission.granted) {
      return this.error(
        `Permission "${_permission.name}" is already revoked`,
        "ALREADY_REVOKED",
      );
    }

    // Revoke _permission
    permission.granted = false;
    delete _permission.grantedAt;
    delete _permission.expiresAt;

    await this.saveSecurityConfig(_config);
    await this.logAuditEvent("REVOKE", _permission);

    let message = `✅ **Permission Revoked**\n\n`;
    message += `**Permission**: ${_permission.name}\n`;
    message += `**ID**: ${_permission.id}\n`;
    message += `**Category**: ${_permission.category}\n\n`;
    message += `The _permission has been revoked and is no longer active.`;

    return this.success(message, { _permission });
  }

  private async showAuditLog(args: CommandArgs): Promise<CommandResult> {
    const _limit = args.options._limit
      ? parseInt(args.options._limit as string)
      : 20;
    const _actionFilter = args.options.action as string;

    try {
      const _logContent = await fs.readFile(this.auditPath, "utf-8");
      const _entries = _logContent
        .split("\n")
        .filter((line) => line.trim())
        .slice(-_limit);

      let filteredEntries = _entries;
      if (_actionFilter) {
        filteredEntries = _entries.filter((_entry) =>
          _entry.includes(_actionFilter.toUpperCase()),
        );
      }

      let message = `# 📋 Security Audit Log\n\n`;

      if (filteredEntries.length === 0) {
        message += "No audit _entries found.\n";
      } else {
        message += `**Showing ${filteredEntries.length} _entries**\n\n`;
        message += "```\n";
        message += filteredEntries.join("\n");
        message += "\n```\n";
      }

      message += `\n*Full log: ${this.auditPath}*`;

      return this.success(message, {
        _entries: filteredEntries,
        total: _entries.length,
      });
    } catch (innerError) {
      return this.success(
        "# 📋 Security Audit Log\n\nNo audit _entries found.",
        { _entries: [], total: 0 },
      );
    }
  }

  private async resetPermissions(args: CommandArgs): Promise<CommandResult> {
    const _confirm = args.flags._confirm;

    if (!_confirm) {
      return this.error(
        "Reset requires confirmation. Use --_confirm flag.",
        "CONFIRMATION_REQUIRED",
      );
    }

    const _config = await this.loadSecurityConfig();
    config.permissions = this.defaultPermissions.map((p) => ({ ...p }));

    await this.saveSecurityConfig(_config);
    await this.logAuditEvent("RESET", null);

    let message = `✅ **Permissions Reset**\n\n`;
    message += `All permissions have been reset to default values.\n\n`;
    message += `• High-risk permissions: Revoked\n`;
    message += `• Basic permissions: Granted\n`;
    message += `• Security policies: Maintained\n\n`;
    message += `Use \`/permissions list\` to review current permissions.`;

    return this.success(message, { resetCount: _config.permissions.length });
  }

  private async exportPermissions(args: CommandArgs): Promise<CommandResult> {
    const _exportPath =
      (args.parsed.positional?.[1] as string) ||
      `maria-security-export-${Date.now()}.json`;
    const _config = await this.loadSecurityConfig();

    const _exportData = {
      version: this.metadata.version,
      _timestamp: new Date().toISOString(),
      security: _config,
    };

    await fs.writeFile(
      _exportPath,
      JSON.stringify(_exportData, null, 2),
      "utf-8",
    );

    return this.success(
      `✅ Security configuration exported to: ${_exportPath}`,
      {
        _path: _exportPath,
        permissionCount: _config.permissions.length,
      },
    );
  }

  private async importPermissions(args: CommandArgs): Promise<CommandResult> {
    const _importPath = args.parsed.positional?.[1] as string;

    if (!_importPath) {
      return this.error("Import file path required", "MISSING_PATH");
    }

    try {
      const _content = await fs.readFile(_importPath, "utf-8");
      const _importData = JSON.parse(_content);
      const _securityConfig = _importData.security || _importData;

      await this.saveSecurityConfig(_securityConfig);
      await this.logAuditEvent("IMPORT", null);

      return this.success(
        `✅ Security configuration imported from: ${_importPath}`,
        {
          _path: _importPath,
          permissionCount: _securityConfig.permissions?.length || 0,
        },
      );
    } catch (error) {
      return this.error(
        `Failed to import security configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
        "IMPORT_ERROR",
      );
    }
  }

  private async managePolicies(args: CommandArgs): Promise<CommandResult> {
    const _config = await this.loadSecurityConfig();

    if (args.flags.strict) {
      _config.securityLevel = "strict";
      _config.policies.requireConfirmation = true;
      _config.policies.riskBasedApproval = true;
      config.policies.maxGrantDuration = 24;
    } else if (args.flags.balanced) {
      _config.securityLevel = "balanced";
      _config.policies.requireConfirmation = true;
      _config.policies.riskBasedApproval = false;
      config.policies.maxGrantDuration = 168; // 7 days
    } else if (args.flags.permissive) {
      _config.securityLevel = "permissive";
      _config.policies.requireConfirmation = false;
      _config.policies.riskBasedApproval = false;
      config.policies.maxGrantDuration = 0; // No expiration
    }

    if (args.flags.strict || args.flags.balanced || args.flags.permissive) {
      await this.saveSecurityConfig(_config);
      await this.logAuditEvent("POLICY_UPDATE", null);
    }

    let message = `# 🛡️ Security Policies\n\n`;
    message += `**Security Level**: ${_config.securityLevel.toUpperCase()}\n\n`;
    message += `**Current Settings**:\n`;
    message += `• Auto-grant permissions: ${_config.policies.autoGrant ? "✅" : "❌"}\n`;
    message += `• Require confirmation: ${_config.policies.requireConfirmation ? "✅" : "❌"}\n`;
    message += `• Notify on grant: ${_config.policies.notifyOnGrant ? "✅" : "❌"}\n`;
    message += `• Audit logging: ${_config.policies.auditLog ? "✅" : "❌"}\n`;
    message += `• Risk-based approval: ${_config.policies.riskBasedApproval ? "✅" : "❌"}\n`;
    message += `• Max grant _duration: ${_config.policies.maxGrantDuration || "No _limit"} hours\n\n`;

    message += `**Available Commands**:\n`;
    message += `• \`/permissions policy --strict\` - Maximum security\n`;
    message += `• \`/permissions policy --balanced\` - Balanced security\n`;
    message += `• \`/permissions policy --permissive\` - Minimal restrictions`;

    return this.success(message, {
      policies: _config.policies,
      securityLevel: _config.securityLevel,
    });
  }

  private async manageDomains(args: CommandArgs): Promise<CommandResult> {
    const _config = await this.loadSecurityConfig();
    const _action = args.parsed.positional?.[1] as string;
    const _domain = args.parsed.positional?.[2] as string;

    if (!_action) {
      let message = `# 🌐 Domain Management\n\n`;
      message += `**Trusted Domains** (${_config.trustedDomains.length}):\n`;
      config.trustedDomains.forEach((d) => {
        message += `• ${d}\n`;
      });

      message += `\n**Blocked Domains** (${_config.blockedDomains.length}):\n`;
      if (_config.blockedDomains.length === 0) {
        message += "• None\n";
      } else {
        config.blockedDomains.forEach((d) => {
          message += `• ${d}\n`;
        });
      }

      message += `\n**Commands**:\n`;
      message += `• \`/permissions domains trust <_domain>\`\n`;
      message += `• \`/permissions domains block <_domain>\`\n`;
      message += `• \`/permissions domains remove <_domain>\``;

      return this.success(message, {
        trustedDomains: _config.trustedDomains,
        blockedDomains: _config.blockedDomains,
      });
    }

    if (!_domain) {
      return this.error(
        "Domain required for _domain management",
        "MISSING_DOMAIN",
      );
    }

    switch (_action.toLowerCase()) {
      case "trust":
        if (!_config.trustedDomains.includes(_domain)) {
          _config.trustedDomains.push(_domain);
          // Remove from blocked if present
          _config.blockedDomains = _config.blockedDomains.filter(
            (d) => d !== _domain,
          );
        }
        break;

      case "block":
        if (!_config.blockedDomains.includes(_domain)) {
          _config.blockedDomains.push(_domain);
          // Remove from trusted if present
          _config.trustedDomains = _config.trustedDomains.filter(
            (d) => d !== _domain,
          );
        }
        break;

      case "remove":
        _config.trustedDomains = _config.trustedDomains.filter(
          (d) => d !== _domain,
        );
        _config.blockedDomains = _config.blockedDomains.filter(
          (d) => d !== _domain,
        );
        break;

      default:
        return this.error(
          `Unknown _domain _action: ${_action}`,
          "UNKNOWN_ACTION",
        );
    }

    await this.saveSecurityConfig(_config);
    await this.logAuditEvent("DOMAIN_UPDATE", null);

    return this.success(`✅ Domain "${_domain}" ${_action}ed successfully`, {
      _domain,
      _action,
    });
  }

  private async showSecurityStatus(_args: CommandArgs): Promise<CommandResult> {
    const _config = await this.loadSecurityConfig();

    const _stats = {
      total: _config.permissions.length,
      _granted: _config.permissions.filter((p) => p.granted).length,
      revoked: _config.permissions.filter((p) => !p.granted).length,
      highRisk: _config.permissions.filter((p) => p.risk === "high").length,
      _highRiskGranted: _config.permissions.filter(
        (p) => p.risk === "high" && p.granted,
      ).length,
    };

    let message = `# 🔒 Security Status\n\n`;
    message += `**Security Level**: ${_config.securityLevel.toUpperCase()}\n`;
    message += `**Overall Status**: ${this.getSecurityScore(_config) >= 80 ? "🟢 Secure" : this.getSecurityScore(_config) >= 60 ? "🟡 Moderate" : "🔴 At Risk"}\n`;
    message += `**Security Score**: ${this.getSecurityScore(_config)}%\n\n`;

    message += `**Permissions**:\n`;
    message += `• Total: ${_stats.total}\n`;
    message += `• Granted: ${_stats.granted}\n`;
    message += `• Revoked: ${_stats.revoked}\n`;
    message += `• High-risk: ${_stats.highRisk}\n`;
    message += `• High-risk _granted: ${_stats.highRiskGranted}\n\n`;

    message += `**Domains**:\n`;
    message += `• Trusted: ${_config.trustedDomains.length}\n`;
    message += `• Blocked: ${_config.blockedDomains.length}\n\n`;

    message += `**Policies**:\n`;
    message += `• Confirmation required: ${_config.policies.requireConfirmation ? "✅" : "❌"}\n`;
    message += `• Audit logging: ${_config.policies.auditLog ? "✅" : "❌"}\n`;
    message += `• Risk-based approval: ${_config.policies.riskBasedApproval ? "✅" : "❌"}\n\n`;

    // Security _recommendations
    const _recommendations = this.getSecurityRecommendations(_config);
    if (_recommendations.length > 0) {
      message += `**Recommendations**:\n`;
      recommendations.forEach((rec) => {
        message += `• ${rec}\n`;
      });
    }

    return this.success(message, {
      _config,
      _stats,
      score: this.getSecurityScore(_config),
      _recommendations,
    });
  }

  // Helper methods

  private async loadSecurityConfig(): Promise<SecurityConfig> {
    const _cacheKey = "security-_config";
    const _cached = this.getCache<SecurityConfig>(_cacheKey);
    if (_cached) {
      return _cached;
    }

    try {
      const _content = await fs.readFile(this.configPath, "utf-8");
      const _config = JSON.parse(_content);
      this.setCache(_cacheKey, _config, 300); // Cache for 5 minutes
      return _config;
    } catch (innerError) {
      // Return default configuration
      const defaultConfig: SecurityConfig = {
        version: this.metadata.version,
        permissions: this.defaultPermissions.map((p) => ({ ...p })),
        policies: {
          autoGrant: false,
          requireConfirmation: true,
          notifyOnGrant: true,
          auditLog: true,
          maxGrantDuration: 168, // 7 days
          riskBasedApproval: true,
        },
        trustedDomains: [
          "github.com",
          "googleapis.com",
          "openai.com",
          "anthropic.com",
        ],
        blockedDomains: [],
        trustedProcesses: [],
        securityLevel: "balanced",
      };
      return defaultConfig;
    }
  }

  private async saveSecurityConfig(_config: SecurityConfig): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });

    // Save configuration
    await fs.writeFile(
      this.configPath,
      JSON.stringify(_config, null, 2),
      "utf-8",
    );

    // Update cache
    this.setCache("security-_config", _config, 300);
  }

  private async logAuditEvent(
    _action: string,
    _permission: Permission | null,
  ): Promise<void> {
    if (
      !_permission &&
      _action !== "RESET" &&
      _action !== "IMPORT" &&
      _action !== "POLICY_UPDATE" &&
      _action !== "DOMAIN_UPDATE"
    ) {
      return;
    }

    const _timestamp = new Date().toISOString();
    const _permissionId = _permission?.id || "N/A";
    const _permissionName = _permission?.name || "N/A";
    const _entry = `[${_timestamp}] ${_action}: ${_permissionId} (${_permissionName})`;

    try {
      await fs.mkdir(path.dirname(this.auditPath), { recursive: true });
      await fs.appendFile(this.auditPath, _entry + "\n");
    } catch (error) {
      logger.error("Failed to write audit log:", error);
    }
  }

  private groupByCategory(
    permissions: Permission[],
  ): Record<string, Permission[]> {
    return permissions.reduce(
      (acc, _permission) => {
        if (!acc[_permission.category]) {
          acc[_permission.category] = [];
        }
        acc[_permission.category].push(_permission);
        return acc;
      },
      {} as Record<string, Permission[]>,
    );
  }

  private getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      file: "📁",
      network: "🌐",
      system: "⚙️",
      ai: "🤖",
      data: "💾",
    };
    return emojis[category] || "📋";
  }

  private getRiskEmoji(risk: string): string {
    const emojis: Record<string, string> = {
      low: "🟢",
      medium: "🟡",
      high: "🔴",
    };
    return emojis[risk] || "⚪";
  }

  private findSimilarPermissions(
    _input: string,
    permissions: Permission[],
  ): string[] {
    return permissions
      .filter(
        (p) =>
          p.id.toLowerCase().includes(_input.toLowerCase()) ||
          p.name.toLowerCase().includes(_input.toLowerCase()),
      )
      .map((p) => p.id)
      .slice(0, 3);
  }

  private getSecurityScore(_config: SecurityConfig): number {
    let score = 100;

    // Deduct points for high-risk permissions that are _granted
    const _highRiskGranted = _config.permissions.filter(
      (p) => p.risk === "high" && p.granted,
    ).length;
    score -= _highRiskGranted * 15;

    // Add points for security policies
    if (_config.policies.requireConfirmation) {
      score += 10;
    }
    if (_config.policies.auditLog) {
      score += 10;
    }
    if (_config.policies.riskBasedApproval) {
      score += 10;
    }

    // Security level adjustments
    if (_config.securityLevel === "strict") {
      score += 20;
    } else if (_config.securityLevel === "permissive") {
      score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  private getSecurityRecommendations(_config: SecurityConfig): string[] {
    const _recommendations: string[] = [];

    const _highRiskGranted = _config.permissions.filter(
      (p) => p.risk === "high" && p.granted,
    );
    if (_highRiskGranted.length > 2) {
      recommendations.push("Consider revoking some high-risk permissions");
    }

    if (!_config.policies.requireConfirmation) {
      recommendations.push(
        "Enable confirmation requirement for better security",
      );
    }

    if (!_config.policies.auditLog) {
      recommendations.push("Enable audit logging to track _permission changes");
    }

    if (_config.securityLevel === "permissive") {
      recommendations.push("Consider using balanced or strict security level");
    }

    if (_config.blockedDomains.length === 0) {
      recommendations.push("Consider blocking known malicious domains");
    }

    return _recommendations;
  }
}
