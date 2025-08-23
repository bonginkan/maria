<<<<<<< HEAD
/**
 * MARIA CLI - Command Line Interface
=======
#!/usr/bin/env node

/**
 * MARIA CLI - Command Line Interface
 * OSS Version with core functionality
>>>>>>> 73f1a492c8b30ad4210f6a8d16116a915db9e914
 */

import { Command } from 'commander';
import chalk from 'chalk';
<<<<<<< HEAD
import { MariaAI, MariaAIConfig } from './maria-ai';
import { createInteractiveSession } from './services/interactive-session';
import { loadConfig } from './config/loader';
import { printStatus } from './utils/ui';
import { HealthStatus } from './types/common';
import registerSetupOllamaCommand from './commands/setup-ollama';
import registerSetupVllmCommand from './commands/setup-vllm';
import registerCodeRAGCommand from './commands/coderag';
import registerDocumentCommand from './commands/document';
import registerApprovalGitCommands from './commands/approval-git';
import packageJson from '../package.json';

export interface CLIOptions {
  config?: string;
  priority?: 'privacy-first' | 'performance' | 'cost-effective' | 'auto';
  provider?: string;
  model?: string;
  debug?: boolean;
  offline?: boolean;
=======

export interface CLIOptions {
  model?: string;
  debug?: boolean;
>>>>>>> 73f1a492c8b30ad4210f6a8d16116a915db9e914
}

export function createCLI(): Command {
  const program = new Command();

  program
    .name('maria')
<<<<<<< HEAD
    .description('MARIA - Intelligent CLI Assistant with Multi-Model AI Support')
    .version(packageJson.version);

  // Interactive chat mode (default)
  program
    .command('chat', { isDefault: true })
    .description('Start interactive chat session')
    .option(
      '--priority <mode>',
      'Set priority mode (privacy-first|performance|cost-effective|auto)',
    )
    .option('--provider <name>', 'Force specific provider')
    .option('--model <name>', 'Force specific model')
    .option('--offline', 'Use only local providers')
    .option('--debug', 'Enable debug output')
    .action(async (options: CLIOptions) => {
      const config = await loadConfig(options);
      await startInteractiveChat(config);
    });

  // One-shot commands
  program
    .command('ask <message>')
    .description('Ask a single question')
    .option('--priority <mode>', 'Set priority mode')
    .option('--provider <name>', 'Force specific provider')
    .option('--model <name>', 'Force specific model')
    .action(async (message: string, options: CLIOptions) => {
      const config = await loadConfig(options);
      await askSingle(message, config);
    });

  program
    .command('code <prompt>')
    .description('Generate code')
    .option('--language <lang>', 'Programming language')
    .option('--provider <name>', 'Force specific provider')
    .action(async (prompt: string, options: CLIOptions & { language?: string }) => {
      const config = await loadConfig(options);
      await generateCode(prompt, options.language, config);
    });

  program
    .command('vision <image> <prompt>')
    .description('Analyze image with text prompt')
    .option('--provider <name>', 'Force specific provider')
    .action(async (imagePath: string, prompt: string, options: CLIOptions) => {
      const config = await loadConfig(options);
      await processVision(imagePath, prompt, config);
    });

  // System commands
  program
    .command('status')
    .description('Show system status and health')
    .action(async () => {
      await showStatus();
    });

  program
    .command('models')
    .description('List available models')
    .option('--provider <name>', 'Filter by provider')
    .action(async (options: { provider?: string }) => {
      await listModels(options.provider);
    });

  program
    .command('setup')
    .description('Run setup wizard')
    .action(async () => {
      await runSetup();
    });

  program
    .command('health')
    .description('Check system health')
    .option('--json', 'Output as JSON')
    .option('--watch', 'Continuous monitoring')
    .action(async (options: { json?: boolean; watch?: boolean }) => {
      await checkHealth(options);
    });

  // Register setup commands
  registerSetupOllamaCommand(program);
  registerSetupVllmCommand(program);
  registerCodeRAGCommand(program);
  registerDocumentCommand(program);

  // Register approval system commands
  registerApprovalGitCommands(program);

  return program;
}

async function startInteractiveChat(config: MariaAIConfig): Promise<void> {
  // Import and initialize startup manager
  const { LLMStartupManager } = await import('./services/llm-startup-manager.js');
  const startupManager = new LLMStartupManager();

  // Display welcome and AI service initialization
  startupManager.displayWelcome();
  await startupManager.initializeServices();

  // Initialize MariaAI (cloud services are ready to use)
  const maria = new MariaAI(config);

  // Start interactive session
  const session = createInteractiveSession(maria);
  await session.start();
}

async function askSingle(message: string, config: MariaAIConfig): Promise<void> {
  const maria = new MariaAI(config);

  // Ensure Maria is initialized before using
  await maria.initialize();

  try {
    console.log(chalk.blue('🤖 Thinking...'));
    const response = await maria.chat(message);
    console.log('\n' + chalk.green(response.content));
  } catch (error: unknown) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  } finally {
    await maria.close();
  }
}

async function generateCode(
  prompt: string,
  language: string | undefined,
  config: MariaAIConfig,
): Promise<void> {
  const maria = new MariaAI(config);

  // Ensure Maria is initialized before using
  await maria.initialize();

  try {
    console.log(chalk.blue('🔧 Generating code...'));
    const response = await maria.generateCode(prompt, language);
    console.log('\n' + chalk.green(response.content));
  } catch (error: unknown) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  } finally {
    await maria.close();
  }
}

async function processVision(
  imagePath: string,
  prompt: string,
  config: MariaAIConfig,
): Promise<void> {
  const maria = new MariaAI(config);

  // Ensure Maria is initialized before using
  await maria.initialize();

  const fs = (await (async () => {
    try {
      return await import('fs-extra');
    } catch {
      const { importNodeBuiltin } = await import('./utils/import-helper.js');
      return importNodeBuiltin('fs');
    }
  })()) as typeof import('fs-extra');

  try {
    console.log(chalk.blue('👁️  Analyzing image...'));
    const imageBuffer = await fs.readFile(imagePath);
    const response = await maria.vision(imageBuffer, prompt);
    console.log('\n' + chalk.green(response.content));
  } catch (error: unknown) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  } finally {
    await maria.close();
  }
}

async function showStatus(): Promise<void> {
  const maria = new MariaAI({ autoStart: false });
  await maria
    .getHealth()
    .then((health) => {
      printStatus(health as HealthStatus);
    })
    .catch((error) => {
      console.error(chalk.red('❌ Failed to get status:'), error);
    });
  await maria.close();
}

async function listModels(provider?: string): Promise<void> {
  const maria = new MariaAI({ autoStart: false });

  try {
    const models = await maria.getModels();
    const filtered = provider ? models.filter((m) => m.provider === provider) : models;

    console.log(chalk.blue(`\n📋 Available Models (${filtered.length}):\n`));

    filtered.forEach((model) => {
      const status = model.available ? '✅' : '⚠️';
      const pricing = model.pricing ? ` ($${model.pricing.input}/${model.pricing.output})` : '';
      console.log(`${status} ${chalk.bold(model.name)} - ${model.provider}${pricing}`);
      console.log(`   ${chalk.gray(model.description)}`);
      if (model.capabilities) {
        console.log(`   ${chalk.cyan('Capabilities:')} ${model.capabilities.join(', ')}`);
      }
      console.log('');
    });
  } catch (error: unknown) {
    console.error(chalk.red('❌ Error listing models:'), error);
  } finally {
    await maria.close();
  }
}

async function runSetup(): Promise<void> {
  console.log(chalk.blue('🚀 Running MARIA setup wizard...'));

  const { spawn } = (await (async () => {
    const { importNodeBuiltin } = await import('./utils/import-helper.js');
    return importNodeBuiltin('child_process');
  })()) as typeof import('child_process');
  const setupProcess = spawn('./scripts/setup-wizard.sh', [], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  setupProcess.on('close', (code: number | null) => {
    if (code === 0) {
      console.log(chalk.green('✅ Setup completed successfully!'));
    } else {
      console.error(chalk.red('❌ Setup failed'));
      process.exit(1);
    }
  });
}

async function checkHealth(options: { json?: boolean; watch?: boolean }): Promise<void> {
  if (options.watch) {
    console.log(chalk.blue('🔄 Starting health monitoring... Press Ctrl+C to stop'));

    const { spawn } = (await (async () => {
      const { importNodeBuiltin } = await import('./utils/import-helper.js');
      return importNodeBuiltin('child_process');
    })()) as typeof import('child_process');
    const healthProcess = spawn('./scripts/health-monitor.sh', ['monitor'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    process.on('SIGINT', () => {
      healthProcess.kill('SIGINT');
      process.exit(0);
    });
  } else {
    const { spawn } = (await (async () => {
      const { importNodeBuiltin } = await import('./utils/import-helper.js');
      return importNodeBuiltin('child_process');
    })()) as typeof import('child_process');
    const args = options.json ? ['json'] : ['status'];
    const healthProcess = spawn('./scripts/health-monitor.sh', args, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    healthProcess.on('close', (code: number | null) => {
      process.exit(code || 0);
    });
  }
}
=======
    .description('MARIA - AI-Powered Development Platform')
    .version('1.0.7');

  // Chat command
  program
    .command('chat')
    .description('Start interactive chat mode')
    .action(() => {
      console.log(chalk.blue('🤖 MARIA AI-Powered Development Platform v1.0.7'));
      console.log(chalk.gray('Enterprise-Grade CLI with Advanced Intelligence'));
      console.log(chalk.yellow('\n💡 This is the OSS distribution of MARIA.'));
      console.log(chalk.yellow('   Full features available at: https://maria-code.vercel.app'));
      console.log(chalk.cyan('\n✨ Key Features:'));
      console.log(chalk.cyan('   • 22+ AI Models (GPT, Claude, Gemini, Local LLMs)'));
      console.log(chalk.cyan('   • Advanced Code Quality Systems'));
      console.log(chalk.cyan('   • Intelligent Dependency Management'));
      console.log(chalk.cyan('   • AI-Driven Project Analysis'));
      console.log(chalk.cyan('   • Automated Refactoring Engine'));
      console.log(chalk.cyan('   • Phase 5: Enterprise-Grade Infrastructure'));
    });

  // Version command
  program
    .command('version')
    .description('Show version information')
    .action(() => {
      console.log(chalk.bold('MARIA CLI v1.0.7'));
      console.log(chalk.gray('AI-Powered Development Platform'));
      console.log(chalk.gray('© 2025 Bonginkan Inc.'));
    });

  // Status command
  program
    .command('status')
    .description('Show system status')
    .action(() => {
      console.log(chalk.green('✅ MARIA OSS Distribution'));
      console.log(chalk.blue('📦 Version: 1.0.7'));
      console.log(chalk.yellow('🔗 Full Platform: https://maria-code.vercel.app'));
    });

  return program;
}

// CLI execution
if (require.main === module) {
  const cli = createCLI();
  cli.parse();
}
>>>>>>> 73f1a492c8b30ad4210f6a8d16116a915db9e914
