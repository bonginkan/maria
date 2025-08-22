/**
 * ComfyUI Integration Service
 * Handles headless ComfyUI setup, workflow execution, and model management
 */

import { ChildProcess, exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import axios from 'axios';

const execAsync = promisify(exec);

export interface ComfyUIConfig {
  installPath?: string;
  port?: number;
  host?: string;
  timeout?: number;
  pythonPath?: string;
  cudaSupport?: boolean;
  mpsSupport?: boolean;
}

export interface WorkflowNode {
  id: number;
  class: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export interface ComfyUIWorkflow {
  nodes: WorkflowNode[];
  extra_data?: Record<string, unknown>;
  version?: string;
}

export interface GenerationParams {
  prompt: string;
  model: string;
  steps?: number;
  cfg?: number;
  seed?: number;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  inputImage?: string;
  outputPath: string;
}

export class ComfyUIService {
  private config: Required<ComfyUIConfig>;
  private serverProcess: ChildProcess | null = null;
  private static instance: ComfyUIService;

  constructor(config: ComfyUIConfig = {}) {
    this.config = {
      installPath: config.installPath || path.join(os.homedir(), '.maria', 'comfyui'),
      port: config.port || 8188,
      host: config.host || '127.0.0.1',
      timeout: config.timeout || 600000, // 10 minutes
      pythonPath: config.pythonPath || 'python3',
      cudaSupport: config.cudaSupport ?? true,
      mpsSupport: config.mpsSupport ?? true,
    };
  }

  static getInstance(config?: ComfyUIConfig): ComfyUIService {
    if (!ComfyUIService.instance) {
      ComfyUIService.instance = new ComfyUIService(config);
    }
    return ComfyUIService.instance;
  }

  /**
   * Check if ComfyUI is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      await fs.access(path.join(this.config.installPath, 'main.py'));
      return true;
    } catch {
      // Ignore error
      // Ignore error
      return false;
    }
  }

  /**
   * Install ComfyUI
   */
  async install(): Promise<void> {
    const installDir = this.config.installPath;

    try {
      // Create installation directory
      await fs.mkdir(installDir, { recursive: true });

      // Clone ComfyUI
      await execAsync(
        `git clone https://github.com/comfyanonymous/ComfyUI.git "${installDir}"`,
        { timeout: 300000 }, // 5 minutes
      );

      // Install dependencies
      await this.installDependencies();
    } catch (error: unknown) {
      throw new Error(
        `Failed to install ComfyUI: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Install Python dependencies
   */
  async installDependencies(): Promise<void> {
    const installDir = this.config.installPath;

    try {
      // Install base requirements
      await execAsync(
        `cd "${installDir}" && ${this.config.pythonPath} -m pip install -r requirements.txt`,
        { timeout: 600000 }, // 10 minutes
      );

      // Install PyTorch with appropriate backend
      if (this.config.cudaSupport) {
        await execAsync(
          `${this.config.pythonPath} -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118`,
          { timeout: 600000 },
        );
      } else if (this.config.mpsSupport && process.platform === 'darwin') {
        await execAsync(`${this.config.pythonPath} -m pip install torch torchvision torchaudio`, {
          timeout: 600000,
        });
      } else {
        await execAsync(
          `${this.config.pythonPath} -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu`,
          { timeout: 600000 },
        );
      }
    } catch (error: unknown) {
      throw new Error(
        `Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Setup ComfyUI (install if needed)
   */
  async setup(): Promise<void> {
    if (!(await this.isInstalled())) {
      await this.install();
    }
  }

  /**
   * Start ComfyUI server
   */
  async startServer(): Promise<void> {
    if (this.serverProcess) {
      return; // Already running
    }

    await this.setup();

    const args = [
      path.join(this.config.installPath, 'main.py'),
      '--listen',
      this.config.host,
      '--port',
      this.config.port.toString(),
      '--disable-safe-unpickle',
    ];

    this.serverProcess = spawn(this.config.pythonPath, args, {
      cwd: this.config.installPath,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Wait for server to start
    await this.waitForServer();
  }

  /**
   * Stop ComfyUI server
   */
  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  /**
   * Wait for server to be ready
   */
  private async waitForServer(maxAttempts = 30): Promise<void> {
    const baseUrl = `http://${this.config.host}:${this.config.port}`;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        await axios.get(`${baseUrl}/system_stats`, { timeout: 5000 });
        return; // Server is ready
      } catch {
        // Ignore error
        // Ignore error
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error('ComfyUI server failed to start');
  }

  /**
   * Check if server is running
   */
  async isServerRunning(): Promise<boolean> {
    try {
      const baseUrl = `http://${this.config.host}:${this.config.port}`;
      await axios.get(`${baseUrl}/system_stats`, { timeout: 5000 });
      return true;
    } catch {
      // Ignore error
      // Ignore error
      return false;
    }
  }

  /**
   * Create a video generation workflow
   */
  createVideoWorkflow(params: GenerationParams): ComfyUIWorkflow {
    return {
      nodes: [
        {
          id: 1,
          class: 'CheckpointLoaderSimple',
          inputs: {
            ckpt_name: params.model,
          },
        },
        {
          id: 2,
          class: 'CLIPTextEncode',
          inputs: {
            text: params.prompt,
            clip: [1, 1],
          },
        },
        {
          id: 3,
          class: 'CLIPTextEncode',
          inputs: {
            text: 'low quality, blurry, distorted',
            clip: [1, 1],
          },
        },
        {
          id: 4,
          class: 'VideoGenerate',
          inputs: {
            model: [1, 0],
            positive: [2, 0],
            negative: [3, 0],
            frames: params.frames || 33,
            fps: params.fps || 24,
            width: params.width || 1280,
            height: params.height || 720,
            steps: params.steps || 20,
            cfg: params.cfg || 7.5,
            seed: params.seed || Math.floor(Math.random() * 1000000),
          },
        },
        {
          id: 5,
          class: 'SaveVideo',
          inputs: {
            video: [4, 0],
            filename_prefix: path.basename(params.outputPath, path.extname(params.outputPath)),
          },
        },
      ],
    };
  }

  /**
   * Create an image generation workflow
   */
  createImageWorkflow(params: GenerationParams): ComfyUIWorkflow {
    return {
      nodes: [
        {
          id: 1,
          class: 'CheckpointLoaderSimple',
          inputs: {
            ckpt_name: params.model,
          },
        },
        {
          id: 2,
          class: 'CLIPTextEncode',
          inputs: {
            text: params.prompt,
            clip: [1, 1],
          },
        },
        {
          id: 3,
          class: 'CLIPTextEncode',
          inputs: {
            text: 'low quality, blurry, distorted',
            clip: [1, 1],
          },
        },
        {
          id: 4,
          class: 'KSampler',
          inputs: {
            model: [1, 0],
            positive: [2, 0],
            negative: [3, 0],
            latent_image: [6, 0],
            seed: params.seed || Math.floor(Math.random() * 1000000),
            steps: params.steps || 20,
            cfg: params.cfg || 7.5,
            sampler_name: 'euler',
            scheduler: 'normal',
            denoise: 1.0,
          },
        },
        {
          id: 5,
          class: 'VAEDecode',
          inputs: {
            samples: [4, 0],
            vae: [1, 2],
          },
        },
        {
          id: 6,
          class: 'EmptyLatentImage',
          inputs: {
            width: params.width || 1024,
            height: params.height || 1024,
            batch_size: 1,
          },
        },
        {
          id: 7,
          class: 'SaveImage',
          inputs: {
            images: [5, 0],
            filename_prefix: path.basename(params.outputPath, path.extname(params.outputPath)),
          },
        },
      ],
    };
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflow: ComfyUIWorkflow,
    onProgress?: (message: string) => void,
  ): Promise<{ success: boolean; outputs?: string[]; error?: string }> {
    try {
      // Start server if not running
      if (!(await this.isServerRunning())) {
        onProgress?.('Starting ComfyUI server...');
        await this.startServer();
      }

      const baseUrl = `http://${this.config.host}:${this.config.port}`;

      onProgress?.('Submitting workflow...');

      // Submit workflow
      const response = await axios.post(`${baseUrl}/prompt`, {
        prompt: workflow,
        client_id: 'maria-cli',
      });

      const promptId = response.data.prompt_id;

      onProgress?.('Executing workflow...');

      // Poll for completion
      const result = await this.pollForCompletion(promptId, onProgress);

      return result;
    } catch (error: unknown) {
      return {
        success: false,
        error: `Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Poll for workflow completion
   */
  private async pollForCompletion(
    promptId: string,
    onProgress?: (message: string) => void,
  ): Promise<{ success: boolean; outputs?: string[]; error?: string }> {
    const baseUrl = `http://${this.config.host}:${this.config.port}`;
    const maxAttempts = Math.floor(this.config.timeout / 5000); // Check every 5 seconds

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(`${baseUrl}/history/${promptId}`);
        const history = response.data[promptId];

        if (history && history.status) {
          if (history.status.completed) {
            onProgress?.('Workflow completed successfully');

            // Get output files
            const outputs = await this.getOutputFiles();

            return {
              success: true,
              outputs,
            };
          } else if (history.status.status_str === 'error') {
            return {
              success: false,
              error: `Workflow failed: ${history.status.messages?.[0] || 'Unknown error'}`,
            };
          }
        }

        // Still running
        onProgress?.(`Workflow running... (${i * 5}s)`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error: unknown) {
        return {
          success: false,
          error: `Polling failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return {
      success: false,
      error: 'Workflow execution timeout',
    };
  }

  /**
   * Get output files from completed workflow
   */
  private async getOutputFiles(): Promise<string[]> {
    const outputDir = path.join(this.config.installPath, 'output');
    const outputs: string[] = [];

    try {
      // Look for generated files in the output directory
      const files = await fs.readdir(outputDir);

      // Filter files by recent modification time
      const recentFiles = [];
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(outputDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() > fiveMinutesAgo) {
          recentFiles.push(filePath);
        }
      }

      outputs.push(...recentFiles);
    } catch (error: unknown) {
      console.warn(
        'Failed to get output files:',
        error instanceof Error ? error.message : String(error),
      );
    }

    return outputs;
  }

  /**
   * Generate video using ComfyUI
   */
  async generateVideo(
    params: GenerationParams,
    onProgress?: (message: string) => void,
  ): Promise<{ success: boolean; outputs?: string[]; error?: string }> {
    const workflow = this.createVideoWorkflow(params);
    return this.executeWorkflow(workflow, onProgress);
  }

  /**
   * Generate image using ComfyUI
   */
  async generateImage(
    params: GenerationParams,
    onProgress?: (message: string) => void,
  ): Promise<{ success: boolean; outputs?: string[]; error?: string }> {
    const workflow = this.createImageWorkflow(params);
    return this.executeWorkflow(workflow, onProgress);
  }

  /**
   * Install custom nodes
   */
  async installCustomNodes(nodeRepos: string[]): Promise<void> {
    const customNodesDir = path.join(this.config.installPath, 'custom_nodes');

    await fs.mkdir(customNodesDir, { recursive: true });

    for (const repo of nodeRepos) {
      try {
        const repoName = path.basename(repo, '.git');
        const targetDir = path.join(customNodesDir, repoName);

        // Check if already installed
        try {
          await fs.access(targetDir);
          continue; // Skip if already exists
        } catch {
          // Ignore error
          // Ignore error
        }

        // Clone repository
        await execAsync(`git clone ${repo} "${targetDir}"`);

        // Install requirements if present
        const requirementsFile = path.join(targetDir, 'requirements.txt');
        try {
          await fs.access(requirementsFile);
          await execAsync(
            `cd "${targetDir}" && ${this.config.pythonPath} -m pip install -r requirements.txt`,
          );
        } catch {
          // Ignore error
          // Ignore error
        }
      } catch (error: unknown) {
        console.warn(
          `Failed to install custom node ${repo}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<unknown> {
    if (!(await this.isServerRunning())) {
      return null;
    }

    try {
      const baseUrl = `http://${this.config.host}:${this.config.port}`;
      const response = await axios.get(`${baseUrl}/system_stats`);
      return response.data;
    } catch {
      // Ignore error
      // Ignore error
      return null;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): Required<ComfyUIConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ComfyUIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup (stop server and clean up resources)
   */
  async cleanup(): Promise<void> {
    await this.stopServer();
  }
}

// Export singleton instance
export const comfyUIService = ComfyUIService.getInstance();

// Cleanup on process exit
process.on('exit', () => {
  comfyUIService.cleanup();
});

process.on('SIGINT', () => {
  comfyUIService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  comfyUIService.cleanup();
  process.exit(0);
});
