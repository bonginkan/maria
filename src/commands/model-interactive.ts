/**
 * Interactive Model Selection Command
 * Auto-detects and starts LM Studio, provides arrow key navigation
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { loadEnvironmentVariables } from '../utils/env-loader.js';

const execAsync = promisify(exec);

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  type: 'local' | 'cloud';
  context: string;
  vram?: string;
  available: boolean;
  apiKeySet?: boolean;
  description: string;
}

export class InteractiveModelSelector {
  private models: ModelOption[] = [];
  private selectedIndex = 0;
  private rl: readline.Interface;
  private lmStudioStatus: 'checking' | 'not-installed' | 'not-running' | 'running' = 'checking';

  constructor() {
    // Ensure environment is loaded
    loadEnvironmentVariables();
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    // Enable raw mode for arrow key detection
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, this.rl);
  }

  async initialize(): Promise<void> {
    console.log(chalk.cyan('🔍 Checking available AI models...\n'));
    
    // Check LM Studio
    await this.checkLMStudio();
    
    // Build model list
    this.models = [
      // Local models
      {
        id: 'gpt-oss-120b',
        name: 'GPT-OSS 120B',
        provider: 'LM Studio',
        type: 'local' as const,
        context: '128K',
        vram: '~64GB',
        available: this.lmStudioStatus === 'running',
        description: 'Complex reasoning, large documents'
      },
      {
        id: 'gpt-oss-20b',
        name: 'GPT-OSS 20B',
        provider: 'LM Studio',
        type: 'local' as const,
        context: '32K',
        vram: '~12GB',
        available: this.lmStudioStatus === 'running',
        description: 'Balanced performance'
      },
      // Cloud models
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        type: 'cloud' as const,
        context: '128K',
        available: !!process.env.OPENAI_API_KEY,
        apiKeySet: !!process.env.OPENAI_API_KEY,
        description: 'High accuracy, multimodal'
      },
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'Anthropic',
        type: 'cloud' as const,
        context: '200K',
        available: !!process.env.ANTHROPIC_API_KEY,
        apiKeySet: !!process.env.ANTHROPIC_API_KEY,
        description: 'Long text, complex tasks'
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'Google',
        type: 'cloud' as const,
        context: '128K',
        available: !!process.env.GEMINI_API_KEY,
        apiKeySet: !!process.env.GEMINI_API_KEY,
        description: 'Research, analysis, vision'
      },
      {
        id: 'groq-mixtral',
        name: 'Mixtral 8x7B',
        provider: 'Groq',
        type: 'cloud' as const,
        context: '32K',
        available: !!process.env.GROK_API_KEY,
        apiKeySet: !!process.env.GROK_API_KEY,
        description: 'Fast inference'
      }
    ];

    // Auto-start LM Studio if not running
    if (this.lmStudioStatus === 'not-running') {
      console.log(chalk.yellow('⚠️  LM Studio is not running. Starting it now...\n'));
      await this.startLMStudio();
    }
  }

  private async checkLMStudio(): Promise<void> {
    try {
      // Check if LM Studio is installed
      const lmsPath = '/Users/bongin_max/.lmstudio/bin/lms';
      if (!fs.existsSync(lmsPath)) {
        this.lmStudioStatus = 'not-installed';
        return;
      }

      // Check if server is running
      try {
        const response = await fetch('http://localhost:1234/v1/models', {
          headers: { 'Authorization': 'Bearer lm-studio' },
          signal: AbortSignal.timeout(2000)
        });
        
        if (response.ok) {
          this.lmStudioStatus = 'running';
        } else {
          this.lmStudioStatus = 'not-running';
        }
      } catch {
        this.lmStudioStatus = 'not-running';
      }
    } catch (error) {
      console.error(chalk.red('Error checking LM Studio:'), error);
      this.lmStudioStatus = 'not-installed';
    }
  }

  private async startLMStudio(): Promise<boolean> {
    try {
      console.log(chalk.cyan('🚀 Starting LM Studio server...'));
      
      // Stop any existing server
      await execAsync('/Users/bongin_max/.lmstudio/bin/lms server stop 2>/dev/null || true');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start server
      await execAsync('/Users/bongin_max/.lmstudio/bin/lms server start');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verify it's running
      await this.checkLMStudio();
      
      if (this.lmStudioStatus === 'running') {
        console.log(chalk.green('✅ LM Studio server started successfully!\n'));
        
        // Update model availability
        this.models.forEach(model => {
          if (model.provider === 'LM Studio') {
            model.available = true;
          }
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(chalk.red('Failed to start LM Studio:'), error);
      return false;
    }
  }

  async selectModel(): Promise<string | null> {
    return new Promise((resolve) => {
      this.render();
      
      process.stdin.on('keypress', async (_, key) => {
        if (key.name === 'up') {
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.render();
        } else if (key.name === 'down') {
          this.selectedIndex = Math.min(this.models.length - 1, this.selectedIndex + 1);
          this.render();
        } else if (key.name === 'return') {
          const selected = this.models[this.selectedIndex];
          
          if (!selected) {
            this.cleanup();
            resolve(null);
            return;
          }
          
          // If selecting a local model that's not available, try to start LM Studio
          if (selected.type === 'local' && !selected.available) {
            if (this.lmStudioStatus === 'not-running') {
              console.log(chalk.yellow('\n⏳ Starting LM Studio for local model...'));
              const started = await this.startLMStudio();
              if (!started) {
                console.log(chalk.red('❌ Failed to start LM Studio'));
                this.cleanup();
                resolve(null);
                return;
              }
            }
          }
          
          // Load the model if it's local
          if (selected.type === 'local' && selected.available) {
            await this.loadLocalModel(selected.id);
          }
          
          // Update environment
          await this.updateEnvironment(selected);
          console.log(chalk.green(`\n✅ Selected: ${selected.name}`));
          this.cleanup();
          resolve(selected.id);
        } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
          this.cleanup();
          resolve(null);
        }
      });
    });
  }

  private render(): void {
    console.clear();
    console.log(chalk.bold.cyan('🤖 Select AI Model'));
    console.log(chalk.gray('Use ↑↓ arrows to navigate, Enter to select, ESC to cancel\n'));
    
    // Group by type
    const localModels = this.models.filter(m => m.type === 'local');
    const cloudModels = this.models.filter(m => m.type === 'cloud');
    
    let currentIndex = 0;
    
    // Local models
    if (localModels.length > 0) {
      console.log(chalk.bold.green('💻 Local Models (Offline)'));
      localModels.forEach(model => {
        const isSelected = currentIndex === this.selectedIndex;
        const prefix = isSelected ? chalk.cyan('▶ ') : '  ';
        const status = model.available ? chalk.green('✓') : chalk.red('✗');
        const line = `${prefix}${status} ${chalk.bold(model.name)} ${chalk.gray(`(${model.context}, ${model.vram})`)} - ${chalk.dim(model.description)}`;
        console.log(line);
        currentIndex++;
      });
      console.log();
    }
    
    // Cloud models
    if (cloudModels.length > 0) {
      console.log(chalk.bold.blue('☁️  Cloud Models'));
      cloudModels.forEach(model => {
        const isSelected = currentIndex === this.selectedIndex;
        const prefix = isSelected ? chalk.cyan('▶ ') : '  ';
        const status = model.available ? chalk.green('✓') : chalk.red('✗');
        const apiStatus = model.apiKeySet ? '' : chalk.yellow(' (No API key)');
        const line = `${prefix}${status} ${chalk.bold(model.name)} ${chalk.gray(`(${model.context})`)} - ${chalk.dim(model.description)}${apiStatus}`;
        console.log(line);
        currentIndex++;
      });
    }
    
    // Status bar
    console.log(chalk.gray('\n─'.repeat(60)));
    console.log(chalk.cyan('Current model: ') + chalk.yellow(process.env.LMSTUDIO_DEFAULT_MODEL || process.env.AI_MODEL || 'None'));
    
    if (this.lmStudioStatus === 'running') {
      console.log(chalk.green('LM Studio: Running at http://localhost:1234'));
    } else if (this.lmStudioStatus === 'not-running') {
      console.log(chalk.yellow('LM Studio: Not running (will start automatically)'));
    } else if (this.lmStudioStatus === 'not-installed') {
      console.log(chalk.red('LM Studio: Not installed'));
    }
  }

  private async loadLocalModel(modelId: string): Promise<void> {
    try {
      console.log(chalk.cyan(`\n⏳ Loading ${modelId}...`));
      await execAsync(`/Users/bongin_max/.lmstudio/bin/lms load ${modelId}`);
      console.log(chalk.green(`✅ Model ${modelId} loaded successfully`));
    } catch (error) {
      console.error(chalk.red(`Failed to load model: ${error}`));
    }
  }

  private async updateEnvironment(model: ModelOption): Promise<void> {
    const envPath = path.join(process.cwd(), '.env.local');
    
    if (model.type === 'local') {
      process.env.AI_PROVIDER = 'lmstudio';
      process.env.LMSTUDIO_DEFAULT_MODEL = model.id;
      process.env.OFFLINE_MODE = 'true';
    } else {
      process.env.AI_PROVIDER = model.provider.toLowerCase();
      process.env.AI_MODEL = model.id;
      process.env.OFFLINE_MODE = 'false';
    }
    
    // Update .env.local file
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf-8');
      
      if (model.type === 'local') {
        content = content.replace(/LMSTUDIO_DEFAULT_MODEL=.*/g, `LMSTUDIO_DEFAULT_MODEL=${model.id}`);
        content = content.replace(/AI_PROVIDER=.*/g, 'AI_PROVIDER=lmstudio');
        content = content.replace(/OFFLINE_MODE=.*/g, 'OFFLINE_MODE=true');
      }
      
      fs.writeFileSync(envPath, content);
    }
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners('keypress');
    this.rl.close();
  }
}

// Export function for use in slash command handler
export async function runInteractiveModelSelector(): Promise<string | null> {
  const selector = new InteractiveModelSelector();
  await selector.initialize();
  return await selector.selectModel();
}