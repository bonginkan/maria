/**
 * Version Command v2.1
 * Display real version information with package.json + Git SHA
 */

import { BaseCommand } from '../../../base-command';
import { CommandArgs, CommandContext, CommandResult, CommandExample } from '../../../types';
import { trackCommand, withQuotaFooter } from '../../../shared/telemetry-helper.js';
import { getUserPlan } from '../../../../services/subscription/subscription-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

export class VersionCommand extends BaseCommand {
  name = 'version';
  category = 'core' as const;
  description = 'Show version information';
  override aliases = ['v'];
  override usage = '';

  override examples: CommandExample[] = [
    {
      input: '/version',
      description: 'Show version information',
      output: 'MARIA v3.9.15 (abc1234)',
    },
  ];

  async execute(args: CommandArgs, context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    try {
      // Get package.json version
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageData = JSON.parse(packageContent);
      const version = packageData.version || '0.0.0';
      
      // Get Git SHA (short)
      let gitSha = 'unknown';
      try {
        gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
      } catch {
        // Git not available or not a repo
        gitSha = 'release';
      }
      
      // Get API build ID if available
      let apiBuild = '';
      if (context.apiVersion) {
        apiBuild = ` · API: ${context.apiVersion}`;
      }
      
      // Format: MARIA v3.9.15 (abc1234) · Node: v20.10.0
      const output = `${chalk.bold('MARIA')} v${version} (${gitSha})${apiBuild} · Node: ${process.version}`;
      
      // Track successful operation
      await trackCommand({
        cmd: 'version',
        status: 'success',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });
      
      return this.success(withQuotaFooter(output, context.quotaLeft));
    } catch (error) {
      // Track failed operation
      await trackCommand({
        cmd: 'version',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });
      
      // Fallback to simple version
      return this.success(`${chalk.bold('MARIA')} v3.9.15`);
    }
  }
}

export const meta = {
  name: 'version',
  category: 'core',
  description: 'Show version information',
  aliases: ['v'],
  usage: '',
  examples: [
    '/version'
  ],
  deps: []
};