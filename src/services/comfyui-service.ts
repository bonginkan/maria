/**
 * ComfyUI Integration Service
 * Handles headless ComfyUI setup, _workflow execution, and model management
 */

import { ChildProcess, exec, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";
import axios from "axios";

const _execAsync = promisify(exec);

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
  _outputs?: Record<string, unknown>;
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

  constructor(_config: ComfyUIConfig = {}) {
    this._config = {
      installPath:
        _config.installPath || path.join(os.homedir(), ".maria", "comfyui"),
      port: _config.port || 8188,
      host: _config.host || "127.0.0.1",
      timeout: _config.timeout || 600000, // 10 minutes
      pythonPath: _config.pythonPath || "python3",
      cudaSupport: _config.cudaSupport ?? true,
      mpsSupport: _config.mpsSupport ?? true,
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
      await fs.access(path.join(this.config.installPath, "main.py"));
      return true;
    } catch {
      // Ignore _error
      // Ignore _error
      return false;
    }
  }

  /**
   * Install ComfyUI
   */
  async install(): Promise<void> {
    const _installDir = this.config.installPath;

    try {
      // Create installation directory
      await fs.mkdir(_installDir, { recursive: true });

      // Clone ComfyUI
      await _execAsync(
        `git clone https://github.com/comfyanonymous/ComfyUI.git "${_installDir}"`,
        { timeout: 300000 }, // 5 minutes
      );

      // Install dependencies
      await this.installDependencies();
    } catch (_error: unknown) {
      throw new Error(
        `Failed to install ComfyUI: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
  }

  /**
   * Install Python dependencies
   */
  async installDependencies(): Promise<void> {
    const _installDir = this.config.installPath;

    try {
      // Install base requirements
      await _execAsync(
        `cd "${_installDir}" && ${this.config.pythonPath} -m pip install -r requirements.txt`,
        { timeout: 600000 }, // 10 minutes
      );

      // Install PyTorch with appropriate backend
      if (this.config.cudaSupport) {
        await _execAsync(
          `${this.config.pythonPath} -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118`,
          { timeout: 600000 },
        );
      } else if (this.config.mpsSupport && process.platform === "darwin") {
        await _execAsync(
          `${this.config.pythonPath} -m pip install torch torchvision torchaudio`,
          {
            timeout: 600000,
          },
        );
      } else {
        await _execAsync(
          `${this.config.pythonPath} -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu`,
          { timeout: 600000 },
        );
      }
    } catch (_error: unknown) {
      throw new Error(
        `Failed to install dependencies: ${_error instanceof Error ? _error.message : String(_error)}`,
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

    const _args = [
      path.join(this.config.installPath, "main.py"),
      "--listen",
      this.config.host,
      "--port",
      this.config.port.toString(),
      "--disable-safe-unpickle",
    ];

    this.serverProcess = spawn(this.config.pythonPath, _args, {
      cwd: this.config.installPath,
      stdio: ["ignore", "pipe", "pipe"],
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
  private async waitForServer(_maxAttempts = 30): Promise<void> {
    const _baseUrl = `http://${this.config.host}:${this.config.port}`;

    for (let i = 0; i < _maxAttempts; i++) {
      try {
        await axios.get(`${_baseUrl}/system_stats`, { timeout: 5000 });
        return; // Server is ready
      } catch {
        // Ignore _error
        // Ignore _error
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error("ComfyUI server failed to start");
  }

  /**
   * Check if server is running
   */
  async isServerRunning(): Promise<boolean> {
    try {
      const _baseUrl = `http://${this.config.host}:${this.config.port}`;
      await axios.get(`${_baseUrl}/system_stats`, { timeout: 5000 });
      return true;
    } catch {
      // Ignore _error
      // Ignore _error
      return false;
    }
  }

  /**
   * Create a video generation _workflow
   */
  createVideoWorkflow(params: GenerationParams): ComfyUIWorkflow {
    return {
      nodes: [
        {
          id: 1,
          class: "CheckpointLoaderSimple",
          inputs: {
            ckptname: params.model,
          },
        },
        {
          id: 2,
          class: "CLIPTextEncode",
          inputs: {
            text: params.prompt,
            clip: [1, 1],
          },
        },
        {
          id: 3,
          class: "CLIPTextEncode",
          inputs: {
            text: "low quality, blurry, distorted",
            clip: [1, 1],
          },
        },
        {
          id: 4,
          class: "VideoGenerate",
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
          class: "SaveVideo",
          inputs: {
            video: [4, 0],
            filenameprefix: path.basename(
              params.outputPath,
              path.extname(params.outputPath),
            ),
          },
        },
      ],
    };
  }

  /**
   * Create an image generation _workflow
   */
  createImageWorkflow(params: GenerationParams): ComfyUIWorkflow {
    return {
      nodes: [
        {
          id: 1,
          class: "CheckpointLoaderSimple",
          inputs: {
            ckptname: params.model,
          },
        },
        {
          id: 2,
          class: "CLIPTextEncode",
          inputs: {
            text: params.prompt,
            clip: [1, 1],
          },
        },
        {
          id: 3,
          class: "CLIPTextEncode",
          inputs: {
            text: "low quality, blurry, distorted",
            clip: [1, 1],
          },
        },
        {
          id: 4,
          class: "KSampler",
          inputs: {
            model: [1, 0],
            positive: [2, 0],
            negative: [3, 0],
            latentimage: [6, 0],
            seed: params.seed || Math.floor(Math.random() * 1000000),
            steps: params.steps || 20,
            cfg: params.cfg || 7.5,
            samplername: "euler",
            scheduler: "normal",
            denoise: 1.0,
          },
        },
        {
          id: 5,
          class: "VAEDecode",
          inputs: {
            samples: [4, 0],
            vae: [1, 2],
          },
        },
        {
          id: 6,
          class: "EmptyLatentImage",
          inputs: {
            width: params.width || 1024,
            height: params.height || 1024,
            batchsize: 1,
          },
        },
        {
          id: 7,
          class: "SaveImage",
          inputs: {
            images: [5, 0],
            filenameprefix: path.basename(
              params.outputPath,
              path.extname(params.outputPath),
            ),
          },
        },
      ],
    };
  }

  /**
   * Execute a _workflow
   */
  async executeWorkflow(
    _workflow: ComfyUIWorkflow,
    onProgress?: (_message: string) => void,
  ): Promise<{ success: boolean; _outputs?: string[]; _error?: string }> {
    try {
      // Start server if not running
      if (!(await this.isServerRunning())) {
        onProgress?.("Starting ComfyUI server...");
        await this.startServer();
      }

      const _baseUrl = `http://${this.config.host}:${this.config.port}`;

      onProgress?.("Submitting workflow...");

      // Submit _workflow
      const _response = await axios.post(`${_baseUrl}/prompt`, {
        prompt: _workflow,
        clientid: "maria-cli",
      });

      const _promptId = _response.data.prompt_id;

      onProgress?.("Executing workflow...");

      // Poll for completion
      const _result = await this.pollForCompletion(_promptId, onProgress);

      return _result;
    } catch (_error: unknown) {
      return {
        success: false,
        _error: `Workflow execution failed: ${_error instanceof Error ? _error._message : String(_error)}`,
      };
    }
  }

  /**
   * Poll for _workflow completion
   */
  private async pollForCompletion(
    _promptId: string,
    onProgress?: (_message: string) => void,
  ): Promise<{ success: boolean; _outputs?: string[]; _error?: string }> {
    const _baseUrl = `http://${this.config.host}:${this.config.port}`;
    const _maxAttempts = Math.floor(this.config.timeout / 5000); // Check every 5 seconds

    for (let i = 0; i < _maxAttempts; i++) {
      try {
        const _response = await axios.get(`${_baseUrl}/_history/${_promptId}`);
        const _history = _response.data[_promptId];

        if (_history && _history.status) {
          if (_history.status.completed) {
            onProgress?.("Workflow completed successfully");

            // Get output _files
            const _outputs = await this.getOutputFiles();

            return {
              success: true,
              _outputs,
            };
          } else if (_history.status.status_str === "_error") {
            return {
              success: false,
              _error: `Workflow failed: ${_history.status.messages?.[0] || "Unknown _error"}`,
            };
          }
        }

        // Still running
        onProgress?.(`Workflow running... (${i * 5}s)`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (_error: unknown) {
        return {
          success: false,
          _error: `Polling failed: ${_error instanceof Error ? _error._message : String(_error)}`,
        };
      }
    }

    return {
      success: false,
      _error: "Workflow execution timeout",
    };
  }

  /**
   * Get output _files from completed _workflow
   */
  private async getOutputFiles(): Promise<string[]> {
    const _outputDir = path.join(this.config.installPath, "output");
    const _outputs: string[] = [];

    try {
      // Look for generated _files in the output directory
      const _files = await fs.readdir(_outputDir);

      // Filter _files by recent modification time
      const _recentFiles = [];
      const _fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      for (const file of _files) {
        const _filePath = path.join(_outputDir, file);
        const _stats = await fs.stat(_filePath);

        if (_stats.mtime.getTime() > _fiveMinutesAgo) {
          recentFiles.push(_filePath);
        }
      }

      outputs.push(..._recentFiles);
    } catch (_error: unknown) {
      console.warn(
        "Failed to get output _files:",
        _error instanceof Error ? _error.message : String(_error),
      );
    }

    return _outputs;
  }

  /**
   * Generate video using ComfyUI
   */
  async generateVideo(
    _params: GenerationParams,
    onProgress?: (message: string) => void,
  ): Promise<{ success: boolean; _outputs?: string[]; _error?: string }> {
    const _workflow = this.createVideoWorkflow(_params);
    return this.executeWorkflow(_workflow, onProgress);
  }

  /**
   * Generate image using ComfyUI
   */
  async generateImage(
    _params: GenerationParams,
    onProgress?: (message: string) => void,
  ): Promise<{ success: boolean; _outputs?: string[]; _error?: string }> {
    const _workflow = this.createImageWorkflow(_params);
    return this.executeWorkflow(_workflow, onProgress);
  }

  /**
   * Install custom nodes
   */
  async installCustomNodes(nodeRepos: string[]): Promise<void> {
    const _customNodesDir = path.join(this.config.installPath, "custom_nodes");

    await fs.mkdir(_customNodesDir, { recursive: true });

    for (const repo of nodeRepos) {
      try {
        const _repoName = path.basename(repo, ".git");
        const _targetDir = path.join(_customNodesDir, _repoName);

        // Check if already installed
        try {
          await fs.access(_targetDir);
          continue; // Skip if already exists
        } catch {
          // Ignore _error
          // Ignore _error
        }

        // Clone repository
        await _execAsync(`git clone ${repo} "${_targetDir}"`);

        // Install requirements if present
        const _requirementsFile = path.join(_targetDir, "requirements.txt");
        try {
          await fs.access(_requirementsFile);
          await _execAsync(
            `cd "${_targetDir}" && ${this.config.pythonPath} -m pip install -r requirements.txt`,
          );
        } catch {
          // Ignore _error
          // Ignore _error
        }
      } catch (_error: unknown) {
        console.warn(
          `Failed to install custom node ${repo}:`,
          _error instanceof Error ? _error.message : String(_error),
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
      const _baseUrl = `http://${this.config.host}:${this.config.port}`;
      const _response = await axios.get(`${_baseUrl}/system_stats`);
      return _response.data;
    } catch {
      // Ignore _error
      // Ignore _error
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
export const _comfyUIService = ComfyUIService.getInstance();

// Cleanup on process exit
process.on("exit", () => {
  comfyUIService.cleanup();
});

process.on("SIGINT", () => {
  comfyUIService.cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  comfyUIService.cleanup();
  process.exit(0);
});
