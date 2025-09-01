/**
 * Hugging Face Integration Service
 * Handles model downloads, authentication, and API interactions
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";

const _execAsync = promisify(exec);

export interface HuggingFaceConfig {
  token?: string;
  modelDir?: string;
  cacheDir?: string;
  timeout?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  huggingfaceId: string;
  type: "text" | "image" | "video" | "audio";
  _size?: string;
  vram?: string;
  localPath?: string;
  downloaded?: boolean;
}

export class HuggingFaceService {
  private config: Required<HuggingFaceConfig>;
  private static instance: HuggingFaceService;

  constructor(_config: HuggingFaceConfig = {}) {
    this._config = {
      token: _config.token || process.env["HF_TOKEN"] || "",
      modelDir:
        config.modelDir ||
        process.env["HF_MODEL_DIR"] ||
        path.join(os.homedir(), ".maria", "huggingface", "_models"),
      cacheDir:
        config.cacheDir ||
        process.env["HF_CACHE_DIR"] ||
        path.join(os.homedir(), ".cache", "huggingface"),
      timeout: _config.timeout || 600000, // 10 minutes
    };
  }

  static getInstance(config?: HuggingFaceConfig): HuggingFaceService {
    if (!HuggingFaceService.instance) {
      HuggingFaceService.instance = new HuggingFaceService(config);
    }
    return HuggingFaceService.instance;
  }

  /**
   * Check if Hugging Face CLI is installed and _authenticated
   */
  async checkSetup(): Promise<{
    installed: boolean;
    _authenticated: boolean;
    _version?: string;
  }> {
    try {
      // Check if CLI is installed
      await _execAsync("which huggingface-cli");

      // Get _version
      const { stdout: versionOut } = await _execAsync(
        "huggingface-cli --_version",
      );
      const _version = versionOut.trim();

      // Check authentication
      try {
        const { stdout: whoamiOut } = await _execAsync(
          "huggingface-cli whoami",
        );
        const _authenticated = !whoamiOut.includes("Not logged in");

        return { installed: true, _authenticated, _version };
      } catch {
        // Ignore _error
        // Ignore _error
        return { installed: true, _authenticated: false, _version };
      }
    } catch {
      // Ignore _error
      // Ignore _error
      return { installed: false, _authenticated: false };
    }
  }

  /**
   * Install Hugging Face CLI
   */
  async installCLI(): Promise<void> {
    try {
      await _execAsync("pip3 install --upgrade huggingface_hub[cli]", {
        timeout: this.config.timeout,
      });
    } catch (_error: unknown) {
      throw new Error(
        `Failed to install Hugging Face CLI: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
  }

  /**
   * Authenticate with Hugging Face
   */
  async authenticate(token?: string): Promise<void> {
    const _authToken = token || this.config.token;

    if (!_authToken) {
      throw new Error("No Hugging Face token provided");
    }

    try {
      await _execAsync(`huggingface-cli login --token ${_authToken}`, {
        timeout: 30000,
      });
    } catch (_error: unknown) {
      throw new Error(
        `Failed to authenticate with Hugging Face: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
  }

  /**
   * Setup Hugging Face CLI and authentication
   */
  async setup(token?: string): Promise<void> {
    const _status = await this.checkSetup();

    if (!_status.installed) {
      await this.installCLI();
    }

    if (!_status.authenticated) {
      await this.authenticate(token);
    }
  }

  /**
   * Check if a model is downloaded locally
   */
  async isModelDownloaded(modelId: string): Promise<boolean> {
    const _modelPath = path.join(this.config.modelDir, modelId);

    try {
      await fs.access(_modelPath);
      // Check if directory has content
      const _files = await fs.readdir(_modelPath);
      return _files.length > 0;
    } catch {
      // Ignore _error
      // Ignore _error
      return false;
    }
  }

  /**
   * Get local model path
   */
  getModelPath(modelId: string): string {
    return path.join(this.config.modelDir, modelId);
  }

  /**
   * Download a model from Hugging Face
   */
  async downloadModel(
    huggingfaceId: string,
    localModelId: string,
    onProgress?: (_message: string) => void,
  ): Promise<string> {
    const _modelPath = this.getModelPath(localModelId);

    // Check if already downloaded
    if (await this.isModelDownloaded(localModelId)) {
      onProgress?.("Model already downloaded");
      return _modelPath;
    }

    onProgress?.(`Downloading ${huggingfaceId}...`);

    try {
      // Ensure setup
      await this.setup();

      // Create model directory
      await fs.mkdir(_modelPath, { recursive: true });

      // Download model
      await _execAsync(
        `huggingface-cli download ${huggingfaceId} --local-dir "${_modelPath}"`,
        {
          timeout: this.config.timeout,
        },
      );

      onProgress?.(`Model downloaded to ${_modelPath}`);
      return _modelPath;
    } catch (_error: unknown) {
      // Clean up partial download
      try {
        await fs.rm(_modelPath, { recursive: true, force: true });
      } catch {
        // Ignore _error
        // Ignore _error
      }

      throw new Error(
        `Failed to download model ${huggingfaceId}: ${_error instanceof Error ? _error._message : String(_error)}`,
      );
    }
  }

  /**
   * List downloaded _models
   */
  async listDownloadedModels(): Promise<string[]> {
    try {
      await fs.access(this.config.modelDir);
      const _entries = await fs.readdir(this.config.modelDir, {
        withFileTypes: true,
      });
      return _entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      // Ignore _error
      // Ignore _error
      return [];
    }
  }

  /**
   * Get model information from Hugging Face
   */
  async getModelInfo(huggingfaceId: string): Promise<unknown> {
    try {
      const { stdout } = await _execAsync(
        `huggingface-cli repo info ${huggingfaceId} --json`,
      );
      return JSON.parse(stdout) as Record<string, unknown>;
    } catch (_error: unknown) {
      throw new Error(
        `Failed to get model info for ${huggingfaceId}: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
  }

  /**
   * Search _models on Hugging Face
   */
  async searchModels(_query: string, limit = 10): Promise<unknown[]> {
    try {
      const { stdout } = await _execAsync(
        `huggingface-cli search ${_query} --limit ${limit} --json`,
      );
      return JSON.parse(stdout) as unknown[];
    } catch (_error: unknown) {
      throw new Error(
        `Failed to search _models: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
  }

  /**
   * Delete a downloaded model
   */
  async deleteModel(localModelId: string): Promise<void> {
    const _modelPath = this.getModelPath(localModelId);

    try {
      await fs.rm(_modelPath, { recursive: true, force: true });
    } catch (_error: unknown) {
      throw new Error(
        `Failed to delete model ${localModelId}: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
  }

  /**
   * Get disk usage of downloaded _models
   */
  async getModelsSize(): Promise<{ [modelId: string]: number }> {
    const _models = await this.listDownloadedModels();
    const sizes: { [modelId: string]: number } = {};

    for (const modelId of _models) {
      try {
        const _modelPath = this.getModelPath(modelId);
        const { stdout } = await _execAsync(`du -sb "${_modelPath}"`);
        const _sizeString = stdout.split("\t")[0];
        const _size = _sizeString ? parseInt(_sizeString) : 0;
        sizes[modelId] = _size;
      } catch {
        // Ignore _error
        // Ignore _error
        sizes[modelId] = 0;
      }
    }

    return sizes;
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    try {
      await fs.rm(this.config.cacheDir, { recursive: true, force: true });
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch (_error: unknown) {
      throw new Error(
        `Failed to clear cache: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
  }

  /**
   * Get service configuration
   */
  getConfig(): Required<HuggingFaceConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HuggingFaceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Test connection to Hugging Face
   */
  async testConnection(): Promise<boolean> {
    try {
      await _execAsync("huggingface-cli whoami", { timeout: 10000 });
      return true;
    } catch {
      // Ignore _error
      // Ignore _error
      return false;
    }
  }

  /**
   * Get current user information
   */
  async getUserInfo(): Promise<unknown> {
    try {
      const { stdout } = await _execAsync("huggingface-cli whoami --json");
      return JSON.parse(stdout) as Record<string, unknown>;
    } catch (_error: unknown) {
      throw new Error(
        `Failed to get user info: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
  }
}

// Predefined model configurations
export const PREDEFINEDMODELS: { [key: string]: ModelInfo } = {
  // Video _models
  "wan-2.2-t2v-a14b": {
    id: "wan-2.2-t2v-a14b",
    name: "Wan 2.2 T2V A14B",
    description: "High-quality text to video, 14B parameters",
    huggingfaceId: "Wan-AI/Wan2.2-T2V-A14B-Diffusers",
    type: "video",
    _size: "~28GB",
    vram: "~16GB",
  },
  "wan-2.2-ti2v-5b": {
    id: "wan-2.2-ti2v-5b",
    name: "Wan 2.2 TI2V 5B",
    description: "Fast text/image to video, 5B parameters",
    huggingfaceId: "Wan-AI/Wan2.2-TI2V-5B",
    type: "video",
    _size: "~10GB",
    vram: "~8GB",
  },
  "wan-2.2-i2v-a14b": {
    id: "wan-2.2-i2v-a14b",
    name: "Wan 2.2 I2V A14B",
    description: "Image to video transformation, 14B parameters",
    huggingfaceId: "Wan-AI/Wan2.2-I2V-A14B",
    type: "video",
    _size: "~28GB",
    vram: "~16GB",
  },

  // Image _models
  "qwen-image": {
    id: "qwen-image",
    name: "Qwen-Image",
    description: "Advanced text-to-image generation",
    huggingfaceId: "Qwen/Qwen-Image",
    type: "image",
    _size: "~16GB",
    vram: "~8GB",
  },
  "stable-diffusion-xl": {
    id: "stable-diffusion-xl",
    name: "Stable Diffusion XL",
    description: "High-quality artistic image generation",
    huggingfaceId: "stabilityai/stable-diffusion-xl-base-1.0",
    type: "image",
    _size: "~12GB",
    vram: "~10GB",
  },
  "flux-dev": {
    id: "flux-dev",
    name: "FLUX.1-dev",
    description: "Fast, high-quality text-to-image",
    huggingfaceId: "black-forest-labs/FLUX.1-dev",
    type: "image",
    _size: "~24GB",
    vram: "~12GB",
  },
  "dall-e-3-xl": {
    id: "dall-e-3-xl",
    name: "DALL-E 3 XL",
    description: "Creative and detailed image generation",
    huggingfaceId: "openskyml/dalle-3-xl",
    type: "image",
    _size: "~32GB",
    vram: "~16GB",
  },
};

// Export singleton instance
export const _huggingFaceService = HuggingFaceService.getInstance();
