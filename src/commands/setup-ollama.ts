import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export default function registerSetupOllamaCommand(program: Command): void {
  program
    .command('setup-ollama')
    .description('Install and configure Ollama for local AI models')
    .option('--skip-install', 'Skip Ollama installation (assumes already installed)')
    .option(
      '--models <models>',
      'Comma-separated list of models to download',
      'llama3.2:3b,mistral:7b,codellama:13b',
    )
    .action(async (options) => {
      console.log(chalk.blue.bold('\n🦙 MARIA Ollama Setup\n'));

      try {
        // Check if Ollama is already installed
        const isInstalled = await checkOllamaInstalled();

        if (!isInstalled && !options.skipInstall) {
          console.log(chalk.yellow('📦 Installing Ollama...'));
          await installOllama();
          console.log(chalk.green('✅ Ollama installed successfully'));
        } else if (isInstalled) {
          console.log(chalk.green('✅ Ollama is already installed'));
        }

        // Start Ollama service
        console.log(chalk.yellow('🚀 Starting Ollama service...'));
        await startOllamaService();

        // Wait for service to be ready
        await waitForOllamaReady();
        console.log(chalk.green('✅ Ollama service is ready'));

        // Download models
        const models = options.models.split(',').map((m: string) => m.trim());
        console.log(chalk.yellow(`📥 Downloading models: ${models.join(', ')}`));

        for (const model of models) {
          await downloadOllamaModel(model);
        }

        // Setup environment variables
        await setupEnvironmentVariables();

        // Test the setup
        await testOllamaSetup();

        console.log(chalk.green.bold('\n🎉 Ollama setup completed successfully!'));
        console.log(chalk.cyan('\nUsage:'));
        console.log(chalk.white('  maria'));
        console.log(chalk.white('  > /model'));
        console.log(chalk.white('  > /code "create a hello world function" --provider ollama'));
      } catch (error) {
        console.error(chalk.red('\n❌ Setup failed:'), error);
        process.exit(1);
      }
    });
}

async function checkOllamaInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('ollama', ['--version'], { stdio: 'pipe' });
    child.on('close', (code) => {
      resolve(code === 0);
    });
    child.on('error', () => {
      resolve(false);
    });
  });
}

async function installOllama(): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = os.platform();

    if (platform === 'darwin') {
      // Try Homebrew first, then curl
      const brewChild = spawn('brew', ['install', 'ollama'], { stdio: 'inherit' });
      brewChild.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Fallback to curl installation
          const curlChild = spawn('curl', ['-fsSL', 'https://ollama.ai/install.sh'], {
            stdio: ['pipe', 'pipe', 'inherit'],
          });
          const shChild = spawn('sh', [], { stdio: ['pipe', 'inherit', 'inherit'] });

          curlChild.stdout.pipe(shChild.stdin);

          shChild.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error('Failed to install Ollama via curl'));
            }
          });
        }
      });
    } else {
      // For Linux and other platforms, use curl
      const curlChild = spawn('curl', ['-fsSL', 'https://ollama.ai/install.sh'], {
        stdio: ['pipe', 'pipe', 'inherit'],
      });
      const shChild = spawn('sh', [], { stdio: ['pipe', 'inherit', 'inherit'] });

      curlChild.stdout.pipe(shChild.stdin);

      shChild.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Failed to install Ollama'));
        }
      });
    }
  });
}

async function startOllamaService(): Promise<void> {
  return new Promise((resolve, _reject) => {
    // Check if Ollama is already running
    const checkChild = spawn('pgrep', ['-f', 'ollama serve'], { stdio: 'pipe' });
    checkChild.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.yellow('⚠️ Ollama service is already running'));
        resolve();
      } else {
        // Start Ollama service
        const child = spawn('ollama', ['serve'], {
          stdio: 'pipe',
          detached: true,
        });

        child.unref();

        // Give it a moment to start
        setTimeout(() => {
          resolve();
        }, 3000);
      }
    });
  });
}

async function waitForOllamaReady(): Promise<void> {
  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Service not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  throw new Error('Ollama service did not become ready within 30 seconds');
}

async function downloadOllamaModel(model: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(chalk.cyan(`  Downloading ${model}...`));

    const child = spawn('ollama', ['pull', model], { stdio: 'inherit' });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`  ✅ ${model} downloaded successfully`));
        resolve();
      } else {
        reject(new Error(`Failed to download model: ${model}`));
      }
    });
  });
}

async function setupEnvironmentVariables(): Promise<void> {
  const homeDir = os.homedir();
  const shell = process.env['SHELL'] || '/bin/bash';
  let rcFile = '';

  if (shell.includes('zsh')) {
    rcFile = path.join(homeDir, '.zshrc');
  } else if (shell.includes('bash')) {
    rcFile = path.join(homeDir, '.bashrc');
  } else {
    rcFile = path.join(homeDir, '.profile');
  }

  const envVars = `
# MARIA Ollama Configuration
export OLLAMA_API_URL="http://localhost:11434"
export OLLAMA_DEFAULT_MODEL="llama3.2:3b"
export OLLAMA_NUM_PARALLEL=2
export OLLAMA_MAX_LOADED_MODELS=3
`;

  try {
    const currentContent = await fs.readFile(rcFile, 'utf8').catch(() => '');

    if (!currentContent.includes('MARIA Ollama Configuration')) {
      await fs.appendFile(rcFile, envVars);
      console.log(chalk.green(`✅ Environment variables added to ${rcFile}`));
      console.log(chalk.yellow(`ℹ️ Please restart your terminal or run: source ${  rcFile}`));
    } else {
      console.log(chalk.yellow('⚠️ Environment variables already configured'));
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️ Could not update shell configuration. Please add manually:'));
    console.log(chalk.white(envVars));
  }
}

async function testOllamaSetup(): Promise<void> {
  try {
    console.log(chalk.yellow('🧪 Testing Ollama setup...'));

    // Test API connection
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      throw new Error('API connection failed');
    }

    const data = (await response.json()) as { models?: unknown[] };
    const models = data.models || [];

    console.log(chalk.green(`✅ API test passed - ${models.length} models available`));

    if (models.length > 0) {
      console.log(chalk.cyan('Available models:'));
      (models as { name: string }[]).forEach((model) => {
        console.log(chalk.white(`  - ${model.name}`));
      });
    }
  } catch (error) {
    throw new Error(`Setup test failed: ${error}`);
  }
}
