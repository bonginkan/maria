/**
 * Status Command Module
 * システム状態表示コマンド - 包括的なステータス情報
 *
 * Phase 4: Low-frequency commands implementation
 * Category: System
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SystemStatus {
  user: {
    isAuthenticated: boolean;
    userId?: string;
    email?: string;
    plan: string;
    credits: number;
    usage: {
      daily: number;
      monthly: number;
      limit: number;
    };
  };
  system: {
    version: string;
    node: string;
    platform: string;
    arch: string;
    uptime: number;
    memory: {
      total: number;
      free: number;
      used: number;
      percentage: number;
    };
    cpu: {
      model: string;
      cores: number;
      usage: number;
    };
  };
  ai: {
    currentModel: string;
    availableModels: string[];
    providerStatus: Record<string, boolean>;
    activeConnections: number;
    requestsToday: number;
    tokensUsed: number;
    costToday: number;
  };
  project: {
    name: string;
    path: string;
    type: string;
    files: number;
    size: string;
    git: {
      branch: string;
      status: string;
      uncommitted: number;
    };
  };
  services: {
    lmstudio: boolean;
    ollama: boolean;
    comfyui: boolean;
    docker: boolean;
    firebase: boolean;
    neo4j: boolean;
  };
}

export class StatusCommand extends BaseCommand {
  name = 'status';
  category = 'system' as const;
  description = 'Display comprehensive system and account status';
  usage = '/status [--detailed] [--json]';
  aliases = ['info', 'stats', 'whoami'];

  private configPath = path.join(os.homedir(), '.maria');

  async execute(args: string[]): Promise<SlashCommandResult> {
    try {
      const detailed = args.includes('--detailed');
      const jsonOutput = args.includes('--json');

      // Gather all status information
      const status = await this.gatherStatus(detailed);

      if (jsonOutput) {
        return {
          success: true,
          message: `\`\`\`json\n${  JSON.stringify(status, null, 2)  }\n\`\`\``,
          data: status,
        };
      }

      return this.formatStatusDisplay(status, detailed);
    } catch (error) {
      logger.error('Status command error:', error);
      return {
        success: false,
        message: `❌ Failed to retrieve status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async gatherStatus(detailed: boolean): Promise<SystemStatus> {
    const [userStatus, systemStatus, aiStatus, projectStatus, servicesStatus] = await Promise.all([
      this.getUserStatus(),
      this.getSystemStatus(),
      this.getAIStatus(),
      this.getProjectStatus(),
      this.getServicesStatus(detailed),
    ]);

    return {
      user: userStatus,
      system: systemStatus,
      ai: aiStatus,
      project: projectStatus,
      services: servicesStatus,
    };
  }

  private async getUserStatus(): Promise<SystemStatus['user']> {
    try {
      const authPath = path.join(this.configPath, 'auth.json');

      if (!fs.existsSync(authPath)) {
        return {
          isAuthenticated: false,
          plan: 'free',
          credits: 100,
          usage: {
            daily: 0,
            monthly: 0,
            limit: 100,
          },
        };
      }

      const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));

      // Get usage data
      const usagePath = path.join(this.configPath, 'usage.json');
      let usage = { daily: 0, monthly: 0, limit: 100 };

      if (fs.existsSync(usagePath)) {
        const usageData = JSON.parse(fs.readFileSync(usagePath, 'utf-8'));
        usage = usageData;
      }

      return {
        isAuthenticated: true,
        userId: authData.userId,
        email: authData.email,
        plan: authData.plan || 'free',
        credits: authData.credits || 100,
        usage,
      };
    } catch (error) {
      logger.error('Failed to get user status:', error);
      return {
        isAuthenticated: false,
        plan: 'free',
        credits: 100,
        usage: { daily: 0, monthly: 0, limit: 100 },
      };
    }
  }

  private async getSystemStatus(): Promise<SystemStatus['system']> {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Get Node version
    const nodeVersion = process.version;

    // Get MARIA version
    let mariaVersion = 'unknown';
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        mariaVersion = pkg.version;
      }
    } catch (error) {
      logger.error('Failed to get MARIA version:', error);
    }

    return {
      version: mariaVersion,
      node: nodeVersion,
      platform: os.platform(),
      arch: os.arch(),
      uptime: os.uptime(),
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        percentage: Math.round((usedMem / totalMem) * 100),
      },
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        usage: 0, // Would need more complex calculation
      },
    };
  }

  private async getAIStatus(): Promise<SystemStatus['ai']> {
    // Mock AI status - in production, this would check actual providers
    return {
      currentModel: 'gpt-4-turbo-preview',
      availableModels: ['gpt-4-turbo-preview', 'gpt-5', 'claude-opus-4.1', 'gemini-2.5-pro'],
      providerStatus: {
        openai: true,
        anthropic: true,
        google: true,
        groq: false,
        lmstudio: false,
      },
      activeConnections: 1,
      requestsToday: 42,
      tokensUsed: 125000,
      costToday: 2.5,
    };
  }

  private async getProjectStatus(): Promise<SystemStatus['project']> {
    const projectPath = process.cwd();
    const projectName = path.basename(projectPath);

    let gitInfo = {
      branch: 'unknown',
      status: 'unknown',
      uncommitted: 0,
    };

    try {
      // Check git status
      const { stdout: branch } = await execAsync('git branch --show-current', { cwd: projectPath });
      const { stdout: status } = await execAsync('git status --porcelain', { cwd: projectPath });

      gitInfo = {
        branch: branch.trim() || 'main',
        status: status ? 'modified' : 'clean',
        uncommitted: status ? status.split('\n').filter((line) => line).length : 0,
      };
    } catch (error) {
      // Not a git repo or git not available
    }

    // Get project size and file count
    let fileCount = 0;
    let totalSize = 0;

    try {
      const countFiles = (dir: string): void => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);

          if (stat.isFile()) {
            fileCount++;
            totalSize += stat.size;
          } else if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            countFiles(filePath);
          }
        }
      };

      countFiles(projectPath);
    } catch (error) {
      logger.error('Failed to count project files:', error);
    }

    return {
      name: projectName,
      path: projectPath,
      type: this.detectProjectType(projectPath),
      files: fileCount,
      size: this.formatBytes(totalSize),
      git: gitInfo,
    };
  }

  private detectProjectType(projectPath: string): string {
    if (fs.existsSync(path.join(projectPath, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));

      if (pkg.dependencies?.next || pkg.devDependencies?.next) {return 'Next.js';}
      if (pkg.dependencies?.react || pkg.devDependencies?.react) {return 'React';}
      if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {return 'Vue';}
      if (pkg.dependencies?.express) {return 'Express';}

      return 'Node.js';
    }

    if (fs.existsSync(path.join(projectPath, 'requirements.txt'))) {return 'Python';}
    if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {return 'Rust';}
    if (fs.existsSync(path.join(projectPath, 'go.mod'))) {return 'Go';}

    return 'Unknown';
  }

  private async getServicesStatus(detailed: boolean): Promise<SystemStatus['services']> {
    const services: SystemStatus['services'] = {
      lmstudio: false,
      ollama: false,
      comfyui: false,
      docker: false,
      firebase: false,
      neo4j: false,
    };

    // Check each service
    await Promise.all([
      this.checkService('lmstudio', 'http://localhost:1234/v1/models').then(
        (status) => (services.lmstudio = status),
      ),
      this.checkService('ollama', 'http://localhost:11434/api/tags').then(
        (status) => (services.ollama = status),
      ),
      this.checkService('comfyui', 'http://localhost:8188').then(
        (status) => (services.comfyui = status),
      ),
      this.checkCommand('docker', 'docker --version').then((status) => (services.docker = status)),
    ]);

    return services;
  }

  private async checkService(name: string, url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkCommand(name: string, command: string): Promise<boolean> {
    try {
      await execAsync(command);
      return true;
    } catch {
      return false;
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) {return `${days}d ${hours}h`;}
    if (hours > 0) {return `${hours}h ${mins}m`;}
    return `${mins}m`;
  }

  private formatStatusDisplay(status: SystemStatus, detailed: boolean): SlashCommandResult {
    const planEmoji = {
      free: '🆓',
      pro: '⭐',
      max: '🚀',
    };

    const serviceStatus = (active: boolean) => (active ? '🟢' : '🔴');

    let message = `# 📊 MARIA System Status

## 👤 User Account
${status.user.isAuthenticated ? '✅ **Authenticated**' : '❌ **Not Authenticated**'}
${status.user.userId ? `• User ID: \`${status.user.userId}\`` : ''}
${status.user.email ? `• Email: ${status.user.email}` : ''}
• Plan: ${planEmoji[status.user.plan as keyof typeof planEmoji] || '🆓'} **${status.user.plan.toUpperCase()}**
• Credits: **${status.user.credits.toLocaleString()}**
• Usage: ${status.user.usage.daily}/${status.user.usage.limit} today

## 🖥️ System Information
• MARIA Version: **v${status.system.version}**
• Node.js: ${status.system.node}
• Platform: ${status.system.platform} (${status.system.arch})
• Uptime: ${this.formatUptime(status.system.uptime)}
• Memory: ${status.system.memory.percentage}% used (${this.formatBytes(status.system.memory.used)} / ${this.formatBytes(status.system.memory.total)})
• CPU: ${status.system.cpu.cores} cores (${status.system.cpu.model})

## 🤖 AI Services
• Current Model: **${status.ai.currentModel}**
• Available Models: ${status.ai.availableModels.length}
• Active Providers: ${Object.entries(status.ai.providerStatus).filter(([_, active]) => active).length}/${Object.keys(status.ai.providerStatus).length}
• Requests Today: ${status.ai.requestsToday}
• Tokens Used: ${status.ai.tokensUsed.toLocaleString()}
• Cost Today: $${status.ai.costToday.toFixed(2)}

## 📁 Project
• Name: **${status.project.name}**
• Type: ${status.project.type}
• Files: ${status.project.files}
• Size: ${status.project.size}
• Git: ${status.project.git.branch} (${status.project.git.status}${status.project.git.uncommitted > 0 ? `, ${status.project.git.uncommitted} uncommitted` : ''})

## 🔧 Services
• LM Studio: ${serviceStatus(status.services.lmstudio)}
• Ollama: ${serviceStatus(status.services.ollama)}
• ComfyUI: ${serviceStatus(status.services.comfyui)}
• Docker: ${serviceStatus(status.services.docker)}`;

    if (detailed) {
      message += `\n\n## 📈 Detailed Metrics
• Firebase: ${serviceStatus(status.services.firebase)}
• Neo4j: ${serviceStatus(status.services.neo4j)}
• Provider Status:
${Object.entries(status.ai.providerStatus)
  .map(([provider, active]) => `  - ${provider}: ${serviceStatus(active)}`)
  .join('\n')}`;
    }

    message += `\n\n---
*Use \`/status --detailed\` for more information*
*Use \`/status --json\` for JSON output*`;

    return {
      success: true,
      message,
      data: status,
      component: 'status-display',
    };
  }
}
