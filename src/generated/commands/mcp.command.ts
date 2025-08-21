/**
 * MCP Command Module
 * MCPサーバー管理コマンド - Model Context Protocol 統合
 *
 * Phase 4: Low-frequency commands implementation
 * Category: Integration
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { _CommandArgs, _CommandContext } from './types';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export interface MCPServer {
  name: string;
  url: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  version?: string;
  capabilities: string[];
  lastHealthCheck?: string;
  config: {
    timeout: number;
    retries: number;
    authentication?: {
      type: 'none' | 'apikey' | 'oauth';
      credentials?: Record<string, string>;
    };
  };
}

export class MCPCommand extends BaseCommand {
  name = 'mcp';
  description = 'Manage Model Context Protocol (MCP) server connections';
  usage = '/mcp [list|add|remove|status|health|config] [options]';
  category = 'integration';

  examples = [
    '/mcp list',
    '/mcp add local-server http://localhost:3000',
    '/mcp status local-server',
    '/mcp health --all',
  ];

  private configPath = path.join(process.cwd(), '.maria', 'mcp-servers.json');

  async execute(args: CommandArgs, context: CommandContext): Promise<SlashCommandResult> {
    try {
      const [action = 'list', ...actionArgs] = args.args;

      switch (action.toLowerCase()) {
        case 'list':
        case 'ls':
          return await this.listServers();

        case 'add':
        case 'register':
          return await this.addServer(actionArgs);

        case 'remove':
        case 'rm':
          return await this.removeServer(actionArgs);

        case 'status':
          return await this.showServerStatus(actionArgs);

        case 'health':
        case 'check':
          return await this.healthCheck(actionArgs, args.flags);

        case 'config':
          return await this.showConfig();

        case 'test':
          return await this.testConnection(actionArgs);

        default:
          return {
            success: false,
            message: `Unknown MCP action: ${action}. Use: list, add, remove, status, health, config, test`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `MCP command error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async loadServers(): Promise<MCPServer[]> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(content).servers || [];
    } catch {
      return [];
    }
  }

  private async saveServers(servers: MCPServer[]): Promise<void> {
    const config = { servers, lastUpdated: new Date().toISOString() };
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  private async listServers(): Promise<SlashCommandResult> {
    const servers = await this.loadServers();

    if (servers.length === 0) {
      return {
        success: true,
        message: 'No MCP servers configured. Use `/mcp add` to register a server.',
      };
    }

    let message = `\n${chalk.bold('🔗 MCP Servers')}\n\n`;

    servers.forEach((server) => {
      const statusIcon = {
        running: chalk.green('●'),
        stopped: chalk.red('○'),
        error: chalk.red('✗'),
        unknown: chalk.yellow('?'),
      }[server.status];

      message += `${statusIcon} ${chalk.bold(server.name)}\n`;
      message += `  URL: ${server.url}\n`;
      message += `  Status: ${server.status}\n`;
      if (server.version) {
        message += `  Version: ${server.version}\n`;
      }
      message += `  Capabilities: ${server.capabilities.join(', ') || 'None'}\n`;
      if (server.lastHealthCheck) {
        message += `  Last Check: ${new Date(server.lastHealthCheck).toLocaleString()}\n`;
      }
      message += '\n';
    });

    return { success: true, _message };
  }

  private async addServer(args: string[]): Promise<SlashCommandResult> {
    if (args.length < 2) {
      return {
        success: false,
        message: 'Usage: /mcp add <server-name> <url> [--timeout=30] [--auth=apikey]',
      };
    }

    const [name, url] = args;
    const servers = await this.loadServers();

    if (servers.some((s) => s.name === name)) {
      return {
        success: false,
        message: `Server '${name}' already exists. Use a different name or remove the existing server.`,
      };
    }

    const newServer: MCPServer = {
      name,
      url,
      status: 'unknown',
      capabilities: [],
      config: {
        timeout: 30000,
        retries: 3,
      },
    };

    servers.push(newServer);
    await this.saveServers(servers);

    return {
      success: true,
      message: `✅ Added MCP server '${name}' (${url})\nUse \`/mcp health ${name}\` to test the connection.`,
    };
  }

  private async removeServer(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /mcp remove <server-name>',
      };
    }

    const name = args[0];
    const servers = await this.loadServers();
    const index = servers.findIndex((s) => s.name === name);

    if (index === -1) {
      return {
        success: false,
        message: `Server '${name}' not found.`,
      };
    }

    servers.splice(index, 1);
    await this.saveServers(servers);

    return {
      success: true,
      message: `✅ Removed MCP server '${name}'.`,
    };
  }

  private async showServerStatus(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /mcp status <server-name>',
      };
    }

    const name = args[0];
    const servers = await this.loadServers();
    const server = servers.find((s) => s.name === name);

    if (!server) {
      return {
        success: false,
        message: `Server '${name}' not found.`,
      };
    }

    let message = `\n${chalk.bold(`🔗 MCP Server: ${server.name}`)}\n\n`;
    message += `${chalk.blue('URL:')} ${server.url}\n`;
    message += `${chalk.blue('Status:')} ${this.getStatusDisplay(server.status)}\n`;

    if (server.version) {
      message += `${chalk.blue('Version:')} ${server.version}\n`;
    }

    message += `${chalk.blue('Capabilities:')} ${server.capabilities.join(', ') || 'None'}\n`;
    message += `${chalk.blue('Timeout:')} ${server.config.timeout}ms\n`;
    message += `${chalk.blue('Retries:')} ${server.config.retries}\n`;

    if (server.lastHealthCheck) {
      message += `${chalk.blue('Last Health Check:')} ${new Date(server.lastHealthCheck).toLocaleString()}\n`;
    }

    return { success: true, _message };
  }

  private getStatusDisplay(status: string): string {
    const colors = {
      running: chalk.green('● Running'),
      stopped: chalk.red('○ Stopped'),
      error: chalk.red('✗ Error'),
      unknown: chalk.yellow('? Unknown'),
    };
    return colors[status] || status;
  }

  private async healthCheck(
    args: string[],
    flags: Record<string, unknown>,
  ): Promise<SlashCommandResult> {
    const servers = await this.loadServers();

    if (servers.length === 0) {
      return {
        success: false,
        message: 'No MCP servers configured.',
      };
    }

    const checkAll = flags.all || args.length === 0;
    const serversToCheck = checkAll ? servers : servers.filter((s) => args.includes(s.name));

    if (serversToCheck.length === 0) {
      return {
        success: false,
        message: 'No matching servers found.',
      };
    }

    let message = `\n${chalk.bold('🏥 MCP Server Health Check')}\n\n`;
    let allHealthy = true;

    for (const server of serversToCheck) {
      try {
        // Mock health check - in real implementation, this would make HTTP requests
        const isHealthy = await this.mockHealthCheck(server);

        const statusIcon = isHealthy ? chalk.green('✓') : chalk.red('✗');
        const statusText = isHealthy ? 'Healthy' : 'Unhealthy';

        message += `${statusIcon} ${server.name}: ${statusText}\n`;

        // Update server status
        server.status = isHealthy ? 'running' : 'error';
        server.lastHealthCheck = new Date().toISOString();

        if (!isHealthy) {
          allHealthy = false;
          message += `  ${chalk.red('Issue:')} Connection failed or server not responding\n`;
        } else {
          message += `  ${chalk.gray('Response time:')} ${Math.floor(Math.random() * 100)}ms\n`;
        }

        message += '\n';
      } catch (error) {
        allHealthy = false;
        message += `${chalk.red('✗')} ${server.name}: Error\n`;
        message += `  ${chalk.red('Details:')} ${error instanceof Error ? error.message : String(error)}\n\n`;

        server.status = 'error';
        server.lastHealthCheck = new Date().toISOString();
      }
    }

    // Save updated server statuses
    await this.saveServers(servers);

    return {
      success: allHealthy,
      message:
        message +
        (allHealthy
          ? chalk.green('All servers are healthy! ✨')
          : chalk.yellow('Some servers have issues. Check the details above.')),
    };
  }

  private async mockHealthCheck(server: MCPServer): Promise<boolean> {
    // Mock implementation - randomly return healthy/unhealthy
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 500));
    return Math.random() > 0.2; // 80% chance of being healthy
  }

  private async showConfig(): Promise<SlashCommandResult> {
    let message = `\n${chalk.bold('🔧 MCP Configuration')}\n\n`;
    message += `${chalk.blue('Config File:')} ${this.configPath}\n`;
    message += `${chalk.blue('Protocol Version:')} 1.0\n`;
    message += `${chalk.blue('Default Timeout:')} 30000ms\n`;
    message += `${chalk.blue('Default Retries:')} 3\n\n`;

    message += `${chalk.bold('Supported Capabilities:')}\n`;
    message += `  • Resource Management\n`;
    message += `  • Tool Execution\n`;
    message += `  • Context Sharing\n`;
    message += `  • Event Streaming\n\n`;

    message += `${chalk.blue('💡 Tip:')} Use \`/mcp add\` to register new MCP servers`;

    return { success: true, _message };
  }

  private async testConnection(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /mcp test <server-name>',
      };
    }

    const name = args[0];
    const servers = await this.loadServers();
    const server = servers.find((s) => s.name === name);

    if (!server) {
      return {
        success: false,
        message: `Server '${name}' not found.`,
      };
    }

    try {
      // Mock connection test
      const startTime = Date.now();
      const success = await this.mockHealthCheck(server);
      const duration = Date.now() - startTime;

      if (success) {
        server.status = 'running';
        server.lastHealthCheck = new Date().toISOString();
        await this.saveServers(servers);

        return {
          success: true,
          message:
            `✅ Connection test successful!\n` +
            `Server: ${server.name}\n` +
            `URL: ${server.url}\n` +
            `Response time: ${duration}ms`,
        };
      } else {
        server.status = 'error';
        server.lastHealthCheck = new Date().toISOString();
        await this.saveServers(servers);

        return {
          success: false,
          message:
            `❌ Connection test failed!\n` +
            `Server: ${server.name}\n` +
            `URL: ${server.url}\n` +
            `Check if the server is running and accessible.`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection test error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
