#!/usr/bin/env node

/**
 * MARIA CLI - Command Line Interface
 * OSS Version with core functionality
 */

import { Command } from 'commander';
import chalk from 'chalk';

export interface CLIOptions {
  model?: string;
  debug?: boolean;
}

export function createCLI(): Command {
  const program = new Command();

  program
    .name('maria')
    .description('MARIA - Intelligent CLI Assistant with Multi-Model AI Support')
    .version('1.0.3');

  // Interactive chat mode (default)
  program
    .command('chat', { isDefault: true })
    .description('Start interactive chat session')
    .option('--model <name>', 'Specify AI model to use')
    .option('--debug', 'Enable debug output')
    .action(async (options: CLIOptions) => {
      console.log(chalk.blue.bold('🤖 MARIA CLI v1.0.3'));
      console.log(chalk.gray('Intelligent CLI Assistant with Multi-Model AI Support'));
      console.log('');
      
      if (options.debug) {
        console.log(chalk.yellow('Debug mode enabled'));
      }
      
      console.log(chalk.green('✨ Welcome to MARIA!'));
      console.log(chalk.gray('Type /help for available commands or start chatting...'));
      console.log('');
      
      // Start interactive session
      await startInteractiveSession(options);
    });

  // Help command
  program
    .command('help')
    .description('Show help information')
    .action(() => {
      console.log(chalk.blue.bold('🤖 MARIA CLI v1.0.3'));
      console.log(chalk.gray('Intelligent CLI Assistant with Multi-Model AI Support'));
      console.log('');
      console.log(chalk.green('Available Commands:'));
      console.log('  maria chat     Start interactive chat session (default)');
      console.log('  maria help     Show this help message');
      console.log('  maria version  Show version information');
      console.log('');
      console.log(chalk.yellow('Options:'));
      console.log('  --model <name>  Specify AI model to use');
      console.log('  --debug         Enable debug output');
      console.log('');
      console.log(chalk.blue('Visit: https://github.com/bonginkan/maria'));
    });

  // Version command
  program
    .command('version')
    .description('Show version information')
    .action(() => {
      console.log('1.0.2');
    });

  return program;
}

async function startInteractiveSession(options: CLIOptions): Promise<void> {
  console.log(chalk.cyan('🚀 Starting interactive session...'));
  
  if (options.debug) {
    console.log(chalk.yellow(`Debug: Options passed: ${JSON.stringify(options)}`));
  }
  
  // For now, show setup message
  console.log('');
  console.log(chalk.yellow.bold('⚙️  Setup Required'));
  console.log('');
  console.log('To use MARIA CLI, you need to:');
  console.log('1. Set up your AI provider API keys');
  console.log('2. Configure your preferred models');
  console.log('');
  console.log(chalk.blue('For full setup instructions, visit:'));
  console.log(chalk.underline('https://github.com/bonginkan/maria#setup'));
  console.log('');
  console.log(chalk.green('Coming soon: Full interactive chat functionality!'));
}

// CLI entry point
if (require.main === module) {
  const program = createCLI();
  program.parse();
}