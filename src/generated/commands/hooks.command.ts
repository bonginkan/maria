/**
 * Hooks Command Module
 * フック管理コマンド - 開発ワークフローとイベント処理
 *
 * Phase 4: Low-frequency commands implementation
 * Category: Configuration
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { _CommandArgs, _CommandContext } from './types';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export interface Hook {
  id: string;
  name: string;
  event: HookEvent;
  command: string;
  enabled: boolean;
  description?: string;
  conditions?: HookCondition[];
  timeout?: number;
  retries?: number;
}

export type HookEvent =
  | 'pre-commit'
  | 'post-commit'
  | 'pre-push'
  | 'post-push'
  | 'pre-build'
  | 'post-build'
  | 'pre-test'
  | 'post-test'
  | 'on-error'
  | 'on-success'
  | 'file-change'
  | 'startup'
  | 'shutdown';

export interface HookCondition {
  type: 'file-pattern' | 'branch' | 'environment' | 'time';
  value: string;
  operator: 'equals' | 'contains' | 'matches' | 'not' | 'before' | 'after';
}

export interface HooksConfig {
  hooks: Hook[];
  globalEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxConcurrentHooks: number;
}

export class HooksCommand extends BaseCommand {
  name = 'hooks';
  description = 'Manage development workflow hooks and automation';
  usage = '/hooks [list|add|remove|edit|enable|disable|test|logs] [options]';
  category = 'configuration';

  examples = [
    '/hooks list',
    '/hooks add pre-commit "pnpm lint && pnpm type-check"',
    '/hooks enable pre-commit-lint',
    '/hooks test pre-commit',
    '/hooks logs --event pre-commit --limit 10',
  ];

  private configPath = path.join(process.cwd(), '.maria', 'hooks.json');
  private logsPath = path.join(process.cwd(), '.maria', 'hooks.log');

  async execute(args: CommandArgs, context: CommandContext): Promise<SlashCommandResult> {
    try {
      const [action = 'list', ...actionArgs] = args.args;

      await this.ensureConfigDir();

      switch (action.toLowerCase()) {
        case 'list':
        case 'ls':
          return await this.listHooks(actionArgs);

        case 'add':
        case 'create':
          return await this.addHook(actionArgs);

        case 'remove':
        case 'rm':
        case 'delete':
          return await this.removeHook(actionArgs);

        case 'edit':
          return await this.editHook(actionArgs);

        case 'enable':
          return await this.enableHook(actionArgs);

        case 'disable':
          return await this.disableHook(actionArgs);

        case 'test':
        case 'run':
          return await this.testHook(actionArgs);

        case 'logs':
          return await this.showLogs(actionArgs);

        case 'status':
          return await this.showStatus();

        case 'init':
          return await this.initializeHooks();

        case 'export':
          return await this.exportHooks(actionArgs);

        case 'import':
          return await this.importHooks(actionArgs);

        default:
          return {
            success: false,
            message: `Unknown hooks action: ${action}. Use: list, add, remove, edit, enable, disable, test, logs, status, init, export, import`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Hooks command error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async ensureConfigDir(): Promise<void> {
    const configDir = path.dirname(this.configPath);
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
    }
  }

  private async loadConfig(): Promise<HooksConfig> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        hooks: [],
        globalEnabled: true,
        logLevel: 'info',
        maxConcurrentHooks: 5,
      };
    }
  }

  private async saveConfig(config: HooksConfig): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  private async listHooks(args: string[]): Promise<SlashCommandResult> {
    const config = await this.loadConfig();

    if (config.hooks.length === 0) {
      return {
        success: true,
        message: 'No hooks configured. Use `/hooks add` to create your first hook.',
      };
    }

    const filterEvent = args.find((arg) => arg.startsWith('--event='))?.split('=')[1];
    const showDisabled = args.includes('--all') || args.includes('--disabled');

    let hooks = config.hooks;
    if (filterEvent) {
      hooks = hooks.filter((h) => h.event === filterEvent);
    }
    if (!showDisabled) {
      hooks = hooks.filter((h) => h.enabled);
    }

    const formatHook = (hook: Hook) => {
      const status = hook.enabled ? chalk.green('✓') : chalk.red('✗');
      const event = chalk.blue(hook.event);
      const name = chalk.bold(hook.name);
      const cmd = chalk.gray(
        hook.command.substring(0, 50) + (hook.command.length > 50 ? '...' : ''),
      );

      return `  ${status} ${event.padEnd(12)} ${name.padEnd(20)} ${cmd}`;
    };

    const header =
      `\n${chalk.bold('Development Hooks Configuration')}\n` +
      `Global Status: ${config.globalEnabled ? chalk.green('Enabled') : chalk.red('Disabled')}\n` +
      `Active Hooks: ${hooks.filter((h) => h.enabled).length}/${config.hooks.length}\n\n` +
      `${chalk.gray('Status Event        Name                 Command')}\n` +
      `${chalk.gray('────────────────────────────────────────────────────────────────────')}`;

    const hooksList = hooks.map(formatHook).join('\n');

    const footer =
      hooks.length > 0
        ? `\n\nUse \`/hooks test <hook-name>\` to test a hook\nUse \`/hooks edit <hook-name>\` to modify a hook`
        : '\nNo hooks match the specified filters.';

    return {
      success: true,
      message: `${header  }\n${  hooksList  }${footer}`,
    };
  }

  private async addHook(args: string[]): Promise<SlashCommandResult> {
    if (args.length < 2) {
      return {
        success: false,
        message:
          'Usage: /hooks add <event> "<command>" [--name="hook-name"] [--description="desc"]',
      };
    }

    const [event, command] = args;
    const nameArg = args.find((arg) => arg.startsWith('--name='))?.split('=')[1];
    const descArg = args.find((arg) => arg.startsWith('--description='))?.split('=')[1];

    const validEvents: HookEvent[] = [
      'pre-commit',
      'post-commit',
      'pre-push',
      'post-push',
      'pre-build',
      'post-build',
      'pre-test',
      'post-test',
      'on-error',
      'on-success',
      'file-change',
      'startup',
      'shutdown',
    ];

    if (!validEvents.includes(event as HookEvent)) {
      return {
        success: false,
        message: `Invalid event: ${event}. Valid events: ${validEvents.join(', ')}`,
      };
    }

    const config = await this.loadConfig();

    const hookId = `${event}-${Date.now()}`;
    const hookName = nameArg || `${event}-hook`;

    // Check for duplicate names
    if (config.hooks.some((h) => h.name === hookName)) {
      return {
        success: false,
        message: `Hook with name '${hookName}' already exists. Use --name to specify a different name.`,
      };
    }

    const newHook: Hook = {
      id: hookId,
      name: hookName,
      event: event as HookEvent,
      command: command.replace(/^["']|["']$/g, ''), // Remove quotes
      enabled: true,
      description: descArg,
      timeout: 30000,
      retries: 1,
    };

    config.hooks.push(newHook);
    await this.saveConfig(config);

    return {
      success: true,
      message:
        `✅ Hook '${hookName}' added successfully!\n` +
        `Event: ${event}\n` +
        `Command: ${newHook.command}\n` +
        `Status: Enabled\n\n` +
        `Use \`/hooks test ${hookName}\` to test this hook.`,
    };
  }

  private async removeHook(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /hooks remove <hook-name-or-id>',
      };
    }

    const identifier = args[0];
    const config = await this.loadConfig();

    const hookIndex = config.hooks.findIndex((h) => h.name === identifier || h.id === identifier);

    if (hookIndex === -1) {
      return {
        success: false,
        message: `Hook '${identifier}' not found. Use \`/hooks list\` to see available hooks.`,
      };
    }

    const hook = config.hooks[hookIndex];
    config.hooks.splice(hookIndex, 1);
    await this.saveConfig(config);

    return {
      success: true,
      message: `✅ Hook '${hook.name}' removed successfully!`,
    };
  }

  private async enableHook(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /hooks enable <hook-name-or-id>',
      };
    }

    return await this.toggleHook(args[0], true);
  }

  private async disableHook(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /hooks disable <hook-name-or-id>',
      };
    }

    return await this.toggleHook(args[0], false);
  }

  private async toggleHook(identifier: string, enabled: boolean): Promise<SlashCommandResult> {
    const config = await this.loadConfig();

    const hook = config.hooks.find((h) => h.name === identifier || h.id === identifier);

    if (!hook) {
      return {
        success: false,
        message: `Hook '${identifier}' not found.`,
      };
    }

    hook.enabled = enabled;
    await this.saveConfig(config);

    const status = enabled ? 'enabled' : 'disabled';
    const emoji = enabled ? '✅' : '❌';

    return {
      success: true,
      message: `${emoji} Hook '${hook.name}' ${status} successfully!`,
    };
  }

  private async testHook(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /hooks test <hook-name-or-id>',
      };
    }

    const identifier = args[0];
    const config = await this.loadConfig();

    const hook = config.hooks.find((h) => h.name === identifier || h.id === identifier);

    if (!hook) {
      return {
        success: false,
        message: `Hook '${identifier}' not found.`,
      };
    }

    try {
      const { execSync } = require('child_process');
      const startTime = Date.now();

      // Execute the hook command
      const output = execSync(hook.command, {
        encoding: 'utf-8',
        timeout: hook.timeout || 30000,
        cwd: process.cwd(),
      });

      const duration = Date.now() - startTime;

      // Log the execution
      await this.logHookExecution(hook, 'success', duration, output);

      return {
        success: true,
        message:
          `✅ Hook '${hook.name}' executed successfully!\n` +
          `Duration: ${duration}ms\n` +
          `Output:\n${output || '(no output)'}`,
      };
    } catch (error: unknown) {
      const duration = Date.now() - Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log the failure
      await this.logHookExecution(hook, 'failure', duration, errorMessage);

      return {
        success: false,
        message: `❌ Hook '${hook.name}' failed to execute!\n` + `Error: ${errorMessage}`,
      };
    }
  }

  private async logHookExecution(
    hook: Hook,
    status: 'success' | 'failure',
    duration: number,
    output: string,
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      hookId: hook.id,
      hookName: hook.name,
      event: hook.event,
      command: hook.command,
      status,
      duration,
      output: output.substring(0, 1000), // Limit output size
    };

    try {
      const logLine = `${JSON.stringify(logEntry)  }\n`;
      await fs.appendFile(this.logsPath, logLine);
    } catch (error) {
      // Ignore logging errors to avoid infinite loops
    }
  }

  private async showLogs(args: string[]): Promise<SlashCommandResult> {
    try {
      const content = await fs.readFile(this.logsPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      const limit = parseInt(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '10');
      const eventFilter = args.find((arg) => arg.startsWith('--event='))?.split('=')[1];
      const statusFilter = args.find((arg) => arg.startsWith('--status='))?.split('=')[1];

      let logs = lines.map((line) => JSON.parse(line));

      if (eventFilter) {
        logs = logs.filter((log) => log.event === eventFilter);
      }

      if (statusFilter) {
        logs = logs.filter((log) => log.status === statusFilter);
      }

      logs = logs.slice(-limit);

      if (logs.length === 0) {
        return {
          success: true,
          message: 'No hook execution logs found.',
        };
      }

      const formatLog = (log: {
        timestamp: string;
        hookName: string;
        event: string;
        status: string;
        duration: number;
        output: string;
      }) => {
        const time = new Date(log.timestamp).toLocaleString();
        const status = log.status === 'success' ? chalk.green('✓') : chalk.red('✗');
        const duration = chalk.gray(`${log.duration}ms`);
        const output = log.output ? `\n    ${chalk.gray(log.output.split('\n')[0])}` : '';

        return `  ${status} ${time} ${log.hookName} (${log.event}) ${duration}${output}`;
      };

      const header =
        chalk.bold('\nHooks Execution Logs\n') +
        chalk.gray('Status Time                Hook Name       Event       Duration Output');

      const logsList = logs.map(formatLog).join('\n');

      return {
        success: true,
        message: `${header  }\n${  chalk.gray('─'.repeat(80))  }\n${  logsList}`,
      };
    } catch (error) {
      return {
        success: true,
        message: 'No hook execution logs found.',
      };
    }
  }

  private async showStatus(): Promise<SlashCommandResult> {
    const config = await this.loadConfig();

    const totalHooks = config.hooks.length;
    const enabledHooks = config.hooks.filter((h) => h.enabled).length;
    const disabledHooks = totalHooks - enabledHooks;

    const eventCounts = config.hooks.reduce(
      (acc, hook) => {
        acc[hook.event] = (acc[hook.event] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const status = config.globalEnabled ? chalk.green('Enabled') : chalk.red('Disabled');

    let message =
      `\n${chalk.bold('Hooks System Status')}\n` +
      `Global Status: ${status}\n` +
      `Total Hooks: ${totalHooks}\n` +
      `Enabled: ${chalk.green(enabledHooks)}\n` +
      `Disabled: ${chalk.red(disabledHooks)}\n\n`;

    if (Object.keys(eventCounts).length > 0) {
      message += `${chalk.bold('Hooks by Event:')}\n`;
      for (const [event, count] of Object.entries(eventCounts)) {
        message += `  ${event}: ${count}\n`;
      }
    }

    message += `\nConfiguration: ${this.configPath}\n`;
    message += `Logs: ${this.logsPath}`;

    return {
      success: true,
      message,
    };
  }

  private async initializeHooks(): Promise<SlashCommandResult> {
    const defaultHooks: Hook[] = [
      {
        id: 'pre-commit-lint',
        name: 'pre-commit-lint',
        event: 'pre-commit',
        command: 'pnpm lint --max-warnings 0',
        enabled: true,
        description: 'Run linting before commits',
      },
      {
        id: 'pre-commit-types',
        name: 'pre-commit-types',
        event: 'pre-commit',
        command: 'pnpm type-check',
        enabled: true,
        description: 'Check TypeScript types before commits',
      },
      {
        id: 'pre-push-test',
        name: 'pre-push-test',
        event: 'pre-push',
        command: 'pnpm test',
        enabled: true,
        description: 'Run tests before pushing',
      },
    ];

    const config: HooksConfig = {
      hooks: defaultHooks,
      globalEnabled: true,
      logLevel: 'info',
      maxConcurrentHooks: 5,
    };

    await this.saveConfig(config);

    return {
      success: true,
      message:
        `✅ Hooks system initialized with ${defaultHooks.length} default hooks!\n` +
        `Use \`/hooks list\` to see all configured hooks.\n` +
        `Use \`/hooks test <hook-name>\` to test individual hooks.`,
    };
  }

  private async editHook(args: string[]): Promise<SlashCommandResult> {
    return {
      success: false,
      message: 'Hook editing is not yet implemented. Use remove + add to modify hooks.',
    };
  }

  private async exportHooks(args: string[]): Promise<SlashCommandResult> {
    const config = await this.loadConfig();
    const exportPath = args[0] || 'hooks-export.json';

    await fs.writeFile(exportPath, JSON.stringify(config, null, 2));

    return {
      success: true,
      message: `✅ Hooks configuration exported to ${exportPath}`,
    };
  }

  private async importHooks(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /hooks import <file-path>',
      };
    }

    try {
      const content = await fs.readFile(args[0], 'utf-8');
      const importedConfig: HooksConfig = JSON.parse(content);

      await this.saveConfig(importedConfig);

      return {
        success: true,
        message:
          `✅ Hooks configuration imported from ${args[0]}\n` +
          `Imported ${importedConfig.hooks.length} hooks.`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to import hooks: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
