/**
 * Version Command
 * Display MARIA version and build information
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import { logger } from "../../../utils/logger";
import chalk from "chalk";
import fs from "fs";
import path from "path";

export class VersionCommand extends BaseCommand {
  name = "version";
  description = "Display MARIA version and build information";
  category = "core";
  aliases = ["v", "--version"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    try {
      const versionInfo = await this.getVersionInfo();
      
      const output: string[] = [];
      
      output.push('');
      output.push(chalk.cyan.bold('🚀 MARIA - AI Development Platform'));
      output.push(chalk.gray('═'.repeat(50)));
      output.push('');
      
      output.push(chalk.white(`📦 Version: ${chalk.green(versionInfo.version)}`));
      output.push(chalk.white(`🏗️  Build: ${versionInfo.build}`));
      output.push(chalk.white(`📅 Release: ${versionInfo.releaseDate}`));
      output.push(chalk.white(`⚡ Node.js: ${process.version}`));
      output.push('');
      
      // Feature highlights
      output.push(chalk.white('🎯 Key Features:'));
      output.push('  • Natural Language Code Operations (/code)');
      output.push('  • Multimodal AI Generation (Image/Video/Voice)');
      output.push('  • Graph RAG Technology');
      output.push('  • Enterprise Memory System');
      output.push('  • Business Operations Suite');
      output.push('');
      
      output.push(chalk.gray('Learn more: https://maria-code.ai'));
      output.push(chalk.gray('Support: https://discord.gg/SMSmSGcEQy'));
      
      return {
        success: true,
        message: output.join('\n'),
        requiresInput: false,
        autoRetry: false,
      };
    } catch (error) {
      logger.error("Version command failed:", error);
      return {
        success: false,
        message: `Failed to get version information: ${error instanceof Error ? error.message : 'Unknown error'}`,
        requiresInput: false,
        autoRetry: false,
      };
    }
  }

  private async getVersionInfo() {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      return {
        version: packageJson.version || 'v3.8.0',
        build: process.env.BUILD_NUMBER || 'development',
        releaseDate: new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      return {
        version: 'v3.8.0',
        build: 'development',
        releaseDate: '2025-08-31'
      };
    }
  }

  async handleError(error: Error): Promise<CommandResult> {
    return {
      success: false,
      message: `Version command failed: ${error.message}`,
      requiresInput: false,
      autoRetry: false,
    };
  }
}

export const meta = {
  name: 'version',
  category: 'core',
  description: 'Display MARIA version and build information',
  aliases: ['v', '--version'],
  usage: '/version',
  examples: [
    '/version'
  ],
  deps: []
};