/**
 * WhoAmI Command
 * Display current user and session information
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";
import os from "os";

export class WhoAmICommand extends BaseCommand {
  name = "whoami";
  description = "Display current user and session information";
  category = "core";
  aliases = ["who", "me"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const userInfo = this.getUserInfo();
    
    const output: string[] = [];
    output.push('');
    output.push(chalk.cyan.bold('👤 User Information'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white(`User: ${chalk.green(userInfo.username)}`));
    output.push(chalk.white(`Platform: ${chalk.green(userInfo.platform)}`));
    output.push(chalk.white(`Home: ${chalk.green(userInfo.homeDir)}`));
    output.push(chalk.white(`Shell: ${chalk.green(userInfo.shell)}`));
    output.push(chalk.white(`Session: ${chalk.green(userInfo.sessionId)}`));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private getUserInfo() {
    return {
      username: os.userInfo().username,
      platform: `${os.platform()} ${os.arch()}`,
      homeDir: os.homedir(),
      shell: process.env.SHELL || 'unknown',
      sessionId: `maria-${Date.now().toString(36)}`
    };
  }
}

export const meta = {
  name: 'whoami',
  category: 'core',
  description: 'Display current user and session information',
  aliases: ['who', 'me'],
  usage: '/whoami',
  examples: [
    '/whoami'
  ],
  deps: []
};