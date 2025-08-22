import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export default function registerSetupVllmCommand(program: Command): void {
  program
    .command('setup-vllm')
    .description('Install and configure vLLM for local AI model serving')
    .option('--skip-python-check', 'Skip Python version check')
    .option(
      '--models <models>',
      'Comma-separated list of Hugging Face models to download',
      'microsoft/DialoGPT-medium',
    )
    .option('--venv-path <path>', 'Custom path for Python virtual environment', '~/vllm-env')
    .option('--model-dir <dir>', 'Directory to store downloaded models', '~/vllm-models')
    .action(async (options) => {
      console.log(chalk.blue.bold('\n🚀 MARIA vLLM Setup\n'));

      try {
        // Check Python version
        if (!options.skipPythonCheck) {
          await checkPythonVersion();
        }

        // Setup paths
        const venvPath = options.venvPath.replace('~', os.homedir());
        const modelDir = options.modelDir.replace('~', os.homedir());

        // Create virtual environment
        console.log(chalk.yellow('🐍 Creating Python virtual environment...'));
        await createVirtualEnvironment(venvPath);

        // Install vLLM
        console.log(chalk.yellow('📦 Installing vLLM and dependencies...'));
        await installVllm(venvPath);

        // Create model directory
        console.log(chalk.yellow('📁 Creating model directory...'));
        await fs.mkdir(modelDir, { recursive: true });

        // Download models
        const models = options.models.split(',').map((m: string) => m.trim());
        console.log(chalk.yellow(`📥 Downloading models: ${models.join(', ')}`));

        for (const model of models) {
          await downloadModel(venvPath, model, modelDir);
        }

        // Create startup script
        await createStartupScript(venvPath, modelDir, models[0]);

        // Setup environment variables
        await setupEnvironmentVariables();

        // Test the setup
        await testVllmSetup(venvPath, modelDir, models[0]);

        console.log(chalk.green.bold('\n🎉 vLLM setup completed successfully!'));
        console.log(chalk.cyan('\nUsage:'));
        console.log(chalk.white('  # Start vLLM server:'));
        console.log(chalk.white('  ./scripts/start-vllm.sh'));
        console.log(chalk.white(''));
        console.log(chalk.white('  # Use in MARIA:'));
        console.log(chalk.white('  maria'));
        console.log(chalk.white('  > /model'));
        console.log(chalk.white('  > /code "create a hello world function" --provider vllm'));
      } catch (error) {
        console.error(chalk.red('\n❌ Setup failed:'), error);
        process.exit(1);
      }
    });
}

async function checkPythonVersion(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['--version'], { stdio: 'pipe' });
    let output = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('Python 3 is not installed. Please install Python 3.8+ first.'));
        return;
      }

      const versionMatch = output.match(/Python (\d+)\.(\d+)\.(\d+)/);
      if (!versionMatch) {
        reject(new Error('Could not determine Python version'));
        return;
      }

      const [, major, minor] = versionMatch;
      const majorNum = parseInt(major || '0', 10);
      const minorNum = parseInt(minor || '0', 10);

      if (majorNum < 3 || (majorNum === 3 && minorNum < 8)) {
        reject(new Error(`Python 3.8+ is required. Current version: ${  output.trim()}`));
        return;
      }

      console.log(chalk.green(`✅ Python version check passed: ${  output.trim()}`));
      resolve();
    });

    child.on('error', () => {
      reject(new Error('Python 3 is not installed. Please install Python 3.8+ first.'));
    });
  });
}

async function createVirtualEnvironment(venvPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-m', 'venv', venvPath], { stdio: 'inherit' });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ Virtual environment created at: ${  venvPath}`));
        resolve();
      } else {
        reject(new Error('Failed to create virtual environment'));
      }
    });
  });
}

async function installVllm(venvPath: string): Promise<void> {
  const pipPath = path.join(venvPath, 'bin', 'pip');

  return new Promise((resolve, reject) => {
    // First upgrade pip
    const upgradeChild = spawn(pipPath, ['install', '--upgrade', 'pip'], { stdio: 'inherit' });

    upgradeChild.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('Failed to upgrade pip'));
        return;
      }

      // Install vLLM and dependencies
      const packages = ['vllm', 'torch', 'torchvision', 'torchaudio', 'huggingface_hub'];

      console.log(chalk.cyan(`Installing packages: ${  packages.join(', ')}`));

      const installChild = spawn(pipPath, ['install', ...packages], { stdio: 'inherit' });

      installChild.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('✅ vLLM and dependencies installed successfully'));
          resolve();
        } else {
          reject(new Error('Failed to install vLLM packages'));
        }
      });
    });
  });
}

async function downloadModel(venvPath: string, modelName: string, modelDir: string): Promise<void> {
  const pythonPath = path.join(venvPath, 'bin', 'python');
  const modelPath = path.join(modelDir, modelName.replace('/', '_'));

  return new Promise((resolve, reject) => {
    console.log(chalk.cyan(`  Downloading ${modelName}...`));

    // Use huggingface-cli to download the model
    const downloadScript = `
import os
from huggingface_hub import snapshot_download

try:
    snapshot_download(
        repo_id="${modelName}",
        local_dir="${modelPath}",
        local_dir_use_symlinks=False
    )
    print("✅ Model downloaded successfully")
except Exception as e:
    print(f"❌ Download failed: {e}")
    exit(1)
`;

    const child = spawn(pythonPath, ['-c', downloadScript], { stdio: 'inherit' });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`  ✅ ${modelName} downloaded successfully`));
        resolve();
      } else {
        reject(new Error(`Failed to download model: ${modelName}`));
      }
    });
  });
}

async function createStartupScript(
  venvPath: string,
  modelDir: string,
  defaultModel: string,
): Promise<void> {
  const scriptsDir = path.join(process.cwd(), 'scripts');
  const scriptPath = path.join(scriptsDir, 'start-vllm.sh');
  const modelPath = path.join(modelDir, defaultModel.replace('/', '_'));

  const scriptContent = `#!/bin/bash

# MARIA vLLM Startup Script
# Generated by setup-vllm command

set -e

VENV_PATH="${venvPath}"
MODEL_PATH="${modelPath}"
HOST="0.0.0.0"
PORT="8000"

echo "🚀 Starting vLLM API Server..."

# Check if vLLM is already running
if pgrep -f "vllm.entrypoints" > /dev/null; then
    echo "⚠️ vLLM is already running on port $PORT"
    exit 0
fi

# Activate virtual environment
source "$VENV_PATH/bin/activate"

# Start vLLM API server
echo "📡 Starting OpenAI-compatible API server..."
echo "Model: $MODEL_PATH"
echo "Host: $HOST:$PORT"

python -m vllm.entrypoints.openai.api_server \\
    --model "$MODEL_PATH" \\
    --host "$HOST" \\
    --port "$PORT" \\
    --served-model-name "${defaultModel}" \\
    &

echo "✅ vLLM server started"
echo "🌐 API available at: http://localhost:$PORT"
echo "📋 Models endpoint: http://localhost:$PORT/v1/models"

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:$PORT/v1/models > /dev/null; then
        echo "✅ vLLM server is ready!"
        break
    fi
    sleep 2
done
`;

  try {
    await fs.mkdir(scriptsDir, { recursive: true });
    await fs.writeFile(scriptPath, scriptContent);
    await fs.chmod(scriptPath, 0o755);

    console.log(chalk.green(`✅ Startup script created: ${  scriptPath}`));
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Could not create startup script: ${  error}`));
  }
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
# MARIA vLLM Configuration
export VLLM_API_URL="http://localhost:8000"
export VLLM_DEFAULT_MODEL="DialoGPT-medium"
`;

  try {
    const currentContent = await fs.readFile(rcFile, 'utf8').catch(() => '');

    if (!currentContent.includes('MARIA vLLM Configuration')) {
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

async function testVllmSetup(
  venvPath: string,
  modelDir: string,
  defaultModel: string,
): Promise<void> {
  console.log(chalk.yellow('🧪 Testing vLLM setup...'));

  // Check if virtual environment exists
  const pythonPath = path.join(venvPath, 'bin', 'python');
  try {
    await fs.access(pythonPath);
    console.log(chalk.green('✅ Virtual environment test passed'));
  } catch (error) {
    throw new Error('Virtual environment not found');
  }

  // Check if model directory exists
  const modelPath = path.join(modelDir, defaultModel.replace('/', '_'));
  try {
    await fs.access(modelPath);
    console.log(chalk.green('✅ Model directory test passed'));
  } catch (error) {
    throw new Error('Model directory not found');
  }

  // Test vLLM import
  return new Promise((resolve, reject) => {
    const testScript = 'import vllm; print("vLLM version:", vllm.__version__)';
    const child = spawn(pythonPath, ['-c', testScript], { stdio: 'pipe' });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✅ vLLM import test passed: ${  output.trim()}`));
        resolve();
      } else {
        reject(new Error('vLLM import test failed'));
      }
    });
  });
}
