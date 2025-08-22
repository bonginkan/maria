/**
 * Permissions Command Module
 * 権限管理コマンド - セキュリティとアクセス制御
 *
 * Phase 4: Low-frequency commands implementation
 * Category: Security
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'file' | 'network' | 'system' | 'ai' | 'data';
  risk: 'low' | 'medium' | 'high';
  granted: boolean;
  grantedAt?: Date;
  expiresAt?: Date;
}

interface PermissionConfig {
  version: string;
  permissions: Permission[];
  policies: {
    autoGrant: boolean;
    requireConfirmation: boolean;
    notifyOnGrant: boolean;
    auditLog: boolean;
  };
  trustedDomains: string[];
  blockedDomains: string[];
}

export class PermissionsCommand extends BaseCommand {
  name = 'permissions';
  category = 'security' as const;
  description = 'Manage MARIA access permissions and security settings';
  usage = '/permissions [list|grant|revoke|audit] [permission-id]';
  aliases = ['perms', 'security', 'access'];

  private configPath = path.join(os.homedir(), '.maria', 'permissions.json');

  private defaultPermissions: Permission[] = [
    {
      id: 'file_read',
      name: 'File System Read',
      description: 'Read files from your local file system',
      category: 'file',
      risk: 'low',
      granted: true,
    },
    {
      id: 'file_write',
      name: 'File System Write',
      description: 'Create and modify files on your system',
      category: 'file',
      risk: 'medium',
      granted: true,
    },
    {
      id: 'file_delete',
      name: 'File System Delete',
      description: 'Delete files and directories',
      category: 'file',
      risk: 'high',
      granted: false,
    },
    {
      id: 'network_request',
      name: 'Network Requests',
      description: 'Make HTTP/HTTPS requests to external services',
      category: 'network',
      risk: 'medium',
      granted: true,
    },
    {
      id: 'system_exec',
      name: 'System Command Execution',
      description: 'Execute system commands and scripts',
      category: 'system',
      risk: 'high',
      granted: false,
    },
    {
      id: 'ai_cloud',
      name: 'Cloud AI Access',
      description: 'Send data to cloud AI providers',
      category: 'ai',
      risk: 'medium',
      granted: true,
    },
    {
      id: 'ai_local',
      name: 'Local AI Access',
      description: 'Use local AI models (LM Studio, Ollama)',
      category: 'ai',
      risk: 'low',
      granted: true,
    },
    {
      id: 'data_telemetry',
      name: 'Usage Telemetry',
      description: 'Send anonymous usage statistics',
      category: 'data',
      risk: 'low',
      granted: false,
    },
    {
      id: 'data_sync',
      name: 'Cloud Sync',
      description: 'Sync settings and history to cloud',
      category: 'data',
      risk: 'medium',
      granted: false,
    },
    {
      id: 'clipboard_access',
      name: 'Clipboard Access',
      description: 'Read and write to system clipboard',
      category: 'system',
      risk: 'medium',
      granted: false,
    },
  ];

  async execute(args: string[]): Promise<SlashCommandResult> {
    try {
      const action = args[0]?.toLowerCase() || 'list';

      switch (action) {
        case 'list':
          return this.listPermissions();

        case 'grant':
          return this.grantPermission(args.slice(1));

        case 'revoke':
          return this.revokePermission(args.slice(1));

        case 'audit':
          return this.showAuditLog();

        case 'reset':
          return this.resetPermissions();

        case 'export':
          return this.exportPermissions();

        case 'policy':
          return this.managePolicies(args.slice(1));

        case 'domains':
          return this.manageDomains(args.slice(1));

        default:
          return this.showHelp();
      }
    } catch (error) {
      logger.error('Permissions command error:', error);
      return {
        success: false,
        message: `❌ Permission management failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async getConfig(): Promise<PermissionConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('Failed to read permissions config:', error);
    }

    // Return default config
    return {
      version: '1.0.0',
      permissions: this.defaultPermissions,
      policies: {
        autoGrant: false,
        requireConfirmation: true,
        notifyOnGrant: true,
        auditLog: true,
      },
      trustedDomains: ['github.com', 'googleapis.com', 'openai.com', 'anthropic.com'],
      blockedDomains: [],
    };
  }

  private async saveConfig(config: PermissionConfig): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save permissions config:', error);
      throw error;
    }
  }

  private async listPermissions(): Promise<SlashCommandResult> {
    const config = await this.getConfig();

    const categories = ['file', 'network', 'system', 'ai', 'data'];
    const riskEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
    };

    let message = '# 🔐 MARIA Permissions\n\n';

    for (const category of categories) {
      const perms = config.permissions.filter((p) => p.category === category);
      if (perms.length === 0) {continue;}

      message += `## ${this.getCategoryEmoji(category)} ${category.toUpperCase()}\n\n`;

      for (const perm of perms) {
        const status = perm.granted ? '✅' : '❌';
        const risk = riskEmoji[perm.risk];

        message += `**${status} ${perm.name}** ${risk}\n`;
        message += `   ID: \`${perm.id}\`\n`;
        message += `   ${perm.description}\n`;

        if (perm.expiresAt) {
          message += `   ⏰ Expires: ${new Date(perm.expiresAt).toLocaleString()}\n`;
        }

        message += '\n';
      }
    }

    message += `## 📋 Security Policies\n\n`;
    message += `• Auto-grant: ${config.policies.autoGrant ? '✅' : '❌'}\n`;
    message += `• Require confirmation: ${config.policies.requireConfirmation ? '✅' : '❌'}\n`;
    message += `• Notify on grant: ${config.policies.notifyOnGrant ? '✅' : '❌'}\n`;
    message += `• Audit logging: ${config.policies.auditLog ? '✅' : '❌'}\n`;

    message += `\n## 🌐 Domain Settings\n\n`;
    message += `**Trusted Domains:** ${config.trustedDomains.length}\n`;
    message += `**Blocked Domains:** ${config.blockedDomains.length}\n`;

    message += `\n---\n`;
    message += `*Use \`/permissions grant [id]\` to grant permission*\n`;
    message += `*Use \`/permissions revoke [id]\` to revoke permission*\n`;
    message += `*Use \`/permissions audit\` to view activity log*`;

    return {
      success: true,
      message,
    };
  }

  private async grantPermission(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: '❌ Please specify a permission ID to grant',
      };
    }

    const permissionId = args[0];
    const config = await this.getConfig();
    const permission = config.permissions.find((p) => p.id === permissionId);

    if (!permission) {
      return {
        success: false,
        message: `❌ Unknown permission ID: "${permissionId}"\n\nUse \`/permissions list\` to see available permissions`,
      };
    }

    if (permission.granted) {
      return {
        success: false,
        message: `⚠️ Permission "${permission.name}" is already granted`,
      };
    }

    // Update permission
    permission.granted = true;
    permission.grantedAt = new Date();

    // Add expiry if specified
    if (args.includes('--expire')) {
      const expireIndex = args.indexOf('--expire');
      if (args[expireIndex + 1]) {
        const hours = parseInt(args[expireIndex + 1]);
        permission.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      }
    }

    await this.saveConfig(config);

    // Log the action
    await this.logAction('grant', permission);

    const riskWarning =
      permission.risk === 'high'
        ? '\n\n⚠️ **Warning:** This is a high-risk permission. Please ensure you trust the operations that will use this permission.'
        : '';

    return {
      success: true,
      message: `✅ **Permission Granted**

**Permission:** ${permission.name}
**Category:** ${permission.category}
**Risk Level:** ${permission.risk}
**Description:** ${permission.description}${riskWarning}

The permission has been granted and is now active.`,
    };
  }

  private async revokePermission(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: '❌ Please specify a permission ID to revoke',
      };
    }

    const permissionId = args[0];
    const config = await this.getConfig();
    const permission = config.permissions.find((p) => p.id === permissionId);

    if (!permission) {
      return {
        success: false,
        message: `❌ Unknown permission ID: "${permissionId}"`,
      };
    }

    if (!permission.granted) {
      return {
        success: false,
        message: `⚠️ Permission "${permission.name}" is already revoked`,
      };
    }

    // Update permission
    permission.granted = false;
    delete permission.grantedAt;
    delete permission.expiresAt;

    await this.saveConfig(config);

    // Log the action
    await this.logAction('revoke', permission);

    return {
      success: true,
      message: `✅ **Permission Revoked**

**Permission:** ${permission.name}
**Category:** ${permission.category}

The permission has been revoked and is no longer active.`,
    };
  }

  private async showAuditLog(): Promise<SlashCommandResult> {
    const auditPath = path.join(os.homedir(), '.maria', 'audit.log');

    if (!fs.existsSync(auditPath)) {
      return {
        success: true,
        message: '📋 **Audit Log**\n\nNo audit entries found.',
      };
    }

    const log = fs.readFileSync(auditPath, 'utf-8');
    const entries = log
      .split('\n')
      .filter((line) => line)
      .slice(-20); // Last 20 entries

    return {
      success: true,
      message: `📋 **Permission Audit Log** (Last 20 entries)

\`\`\`
${entries.join('\n')}
\`\`\`

*Full log available at: ${auditPath}*`,
    };
  }

  private async resetPermissions(): Promise<SlashCommandResult> {
    const config = await this.getConfig();
    config.permissions = this.defaultPermissions;
    await this.saveConfig(config);

    return {
      success: true,
      message: `✅ **Permissions Reset**

All permissions have been reset to default values.

• High-risk permissions: Revoked
• Basic permissions: Granted
• Policies: Default settings

Use \`/permissions list\` to review current permissions.`,
    };
  }

  private async exportPermissions(): Promise<SlashCommandResult> {
    const config = await this.getConfig();
    const exportPath = path.join(os.homedir(), 'maria-permissions-export.json');

    fs.writeFileSync(exportPath, JSON.stringify(config, null, 2), 'utf-8');

    return {
      success: true,
      message: `✅ **Permissions Exported**

Your permission configuration has been exported to:
\`${exportPath}\`

This file contains:
• All permission settings
• Security policies
• Domain configurations
• Version information

You can import this file on another system or keep it as a backup.`,
    };
  }

  private async managePolicies(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      const config = await this.getConfig();

      return {
        success: true,
        message: `# 🛡️ Security Policies

**Current Settings:**
• Auto-grant permissions: ${config.policies.autoGrant ? '✅ Enabled' : '❌ Disabled'}
• Require confirmation: ${config.policies.requireConfirmation ? '✅ Enabled' : '❌ Disabled'}
• Notify on grant: ${config.policies.notifyOnGrant ? '✅ Enabled' : '❌ Disabled'}
• Audit logging: ${config.policies.auditLog ? '✅ Enabled' : '❌ Disabled'}

**Available Commands:**
• \`/permissions policy auto-grant [on/off]\`
• \`/permissions policy confirm [on/off]\`
• \`/permissions policy notify [on/off]\`
• \`/permissions policy audit [on/off]\``,
      };
    }

    const policy = args[0];
    const value = args[1] === 'on';

    const config = await this.getConfig();

    switch (policy) {
      case 'auto-grant':
        config.policies.autoGrant = value;
        break;
      case 'confirm':
        config.policies.requireConfirmation = value;
        break;
      case 'notify':
        config.policies.notifyOnGrant = value;
        break;
      case 'audit':
        config.policies.auditLog = value;
        break;
      default:
        return {
          success: false,
          message: `❌ Unknown policy: "${policy}"`,
        };
    }

    await this.saveConfig(config);

    return {
      success: true,
      message: `✅ Policy "${policy}" set to: ${value ? 'ON' : 'OFF'}`,
    };
  }

  private async manageDomains(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      const config = await this.getConfig();

      return {
        success: true,
        message: `# 🌐 Domain Management

**Trusted Domains (${config.trustedDomains.length}):**
${config.trustedDomains.map((d) => `• ${d}`).join('\n')}

**Blocked Domains (${config.blockedDomains.length}):**
${
  config.blockedDomains.length > 0
    ? config.blockedDomains.map((d) => `• ${d}`).join('\n')
    : '• None'
}

**Commands:**
• \`/permissions domains trust [domain]\`
• \`/permissions domains block [domain]\`
• \`/permissions domains remove [domain]\``,
      };
    }

    const action = args[0];
    const domain = args[1];

    if (!domain) {
      return {
        success: false,
        message: '❌ Please specify a domain',
      };
    }

    const config = await this.getConfig();

    switch (action) {
      case 'trust':
        if (!config.trustedDomains.includes(domain)) {
          config.trustedDomains.push(domain);
        }
        break;
      case 'block':
        if (!config.blockedDomains.includes(domain)) {
          config.blockedDomains.push(domain);
        }
        // Remove from trusted if present
        config.trustedDomains = config.trustedDomains.filter((d) => d !== domain);
        break;
      case 'remove':
        config.trustedDomains = config.trustedDomains.filter((d) => d !== domain);
        config.blockedDomains = config.blockedDomains.filter((d) => d !== domain);
        break;
      default:
        return {
          success: false,
          message: `❌ Unknown action: "${action}"`,
        };
    }

    await this.saveConfig(config);

    return {
      success: true,
      message: `✅ Domain "${domain}" ${action}ed successfully`,
    };
  }

  private showHelp(): SlashCommandResult {
    return {
      success: true,
      message: `# 🔐 Permissions Command Help

**Available Commands:**

\`/permissions list\` - Show all permissions
\`/permissions grant [id]\` - Grant a permission
\`/permissions revoke [id]\` - Revoke a permission
\`/permissions audit\` - View audit log
\`/permissions reset\` - Reset to defaults
\`/permissions export\` - Export configuration
\`/permissions policy\` - Manage security policies
\`/permissions domains\` - Manage trusted/blocked domains

**Examples:**
\`\`\`
/permissions grant file_delete
/permissions revoke system_exec
/permissions grant network_request --expire 24
/permissions policy auto-grant off
/permissions domains trust api.example.com
\`\`\`

**Risk Levels:**
🟢 Low - Safe operations
🟡 Medium - Requires caution
🔴 High - Potentially dangerous

*For more information, visit our security docs*`,
    };
  }

  private getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      file: '📁',
      network: '🌐',
      system: '⚙️',
      ai: '🤖',
      data: '💾',
    };

    return emojis[category] || '📋';
  }

  private async logAction(action: string, permission: Permission): Promise<void> {
    const auditPath = path.join(os.homedir(), '.maria', 'audit.log');
    const entry = `[${new Date().toISOString()}] ${action.toUpperCase()}: ${permission.id} (${permission.name})\n`;

    try {
      const dir = path.dirname(auditPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.appendFileSync(auditPath, entry);
    } catch (error) {
      logger.error('Failed to write audit log:', error);
    }
  }
}
