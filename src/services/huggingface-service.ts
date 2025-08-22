/**
 * Hugging Face Integration Service
 * Handles model downloads, authentication, and API interactions
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execAsync = promisify(exec);

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
  type: 'text' | 'image' | 'video' | 'audio';
  size?: string;
  vram?: string;
  localPath?: string;
  downloaded?: boolean;
}

export class HuggingFaceService {
  private config: Required<HuggingFaceConfig>;
  private static instance: HuggingFaceService;

  constructor(config: HuggingFaceConfig = {}) {
    this.config = {
      token: config.token || process.env['HF_TOKEN'] || '',
      modelDir:
        config.modelDir ||
        process.env['HF_MODEL_DIR'] ||
        path.join(os.homedir(), '.maria', 'huggingface', 'models'),
      cacheDir:
        config.cacheDir ||
        process.env['HF_CACHE_DIR'] ||
        path.join(os.homedir(), '.cache', 'huggingface'),
      timeout: config.timeout || 600000, // 10 minutes
    };
  }

  static getInstance(config?: HuggingFaceConfig): HuggingFaceService {
    if (!HuggingFaceService.instance) {
      HuggingFaceService.instance = new HuggingFaceService(config);
    }
    return HuggingFaceService.instance;
  }

  /**
   * Check if Hugging Face CLI is installed and authenticated
   */
  async checkSetup(): Promise<{ installed: boolean; authenticated: boolean; version?: string }> {
    try {
      // Check if CLI is installed
      await execAsync('which huggingface-cli');

      // Get version
      const { stdout: versionOut } = await execAsync('huggingface-cli --version');
      const version = versionOut.trim();

      // Check authentication
      try {
        const { stdout: whoamiOut } = await execAsync('huggingface-cli whoami');
        const authenticated = !whoamiOut.includes('Not logged in');

        return { installed: true, authenticated, version };
      } catch {
        // Ignore error
        // Ignore error
        return { installed: true, authenticated: false, version };
      }
    } catch {
      // Ignore error
      // Ignore error
      return { installed: false, authenticated: false };
    }
  }

  /**
   * Install Hugging Face CLI
   */
  async installCLI(): Promise<void> {
    try {
      await execAsync('pip3 install --upgrade huggingface_hub[cli]', {
        timeout: this.config.timeout,
      });
    } catch (error: unknown) {
      throw new Error(
        `Failed to install Hugging Face CLI: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Authenticate with Hugging Face
   */
  async authenticate(token?: string): Promise<void> {
    const authToken = token || this.config.token;

    if (!authToken) {
      throw new Error('No Hugging Face token provided');
    }

    try {
      await execAsync(`huggingface-cli login --token ${authToken}`, { timeout: 30000 });
    } catch (error: unknown) {
      throw new Error(
        `Failed to authenticate with Hugging Face: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Setup Hugging Face CLI and authentication
   */
  async setup(token?: string): Promise<void> {
    const status = await this.checkSetup();

    if (!status.installed) {
      await this.installCLI();
    }

    if (!status.authenticated) {
      await this.authenticate(token);
    }
  }

  /**
   * Check if a model is downloaded locally
   */
  async isModelDownloaded(modelId: string): Promise<boolean> {
    const modelPath = path.join(this.config.modelDir, modelId);

    try {
      await fs.access(modelPath);
      // Check if directory has content
      const files = await fs.readdir(modelPath);
      return files.length > 0;
    } catch {
      // Ignore error
      // Ignore error
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
    onProgress?: (message: string) => void,
  ): Promise<string> {
    const modelPath = this.getModelPath(localModelId);

    // Check if already downloaded
    if (await this.isModelDownloaded(localModelId)) {
      onProgress?.('Model already downloaded');
      return modelPath;
    }

    onProgress?.(`Downloading ${huggingfaceId}...`);

    try {
      // Ensure setup
      await this.setup();

      // Create model directory
      await fs.mkdir(modelPath, { recursive: true });

      // Download model
      await execAsync(`huggingface-cli download ${huggingfaceId} --local-dir "${modelPath}"`, {
        timeout: this.config.timeout,
      });

      onProgress?.(`Model downloaded to ${modelPath}`);
      return modelPath;
    } catch (error: unknown) {
      // Clean up partial download
      try {
        await fs.rm(modelPath, { recursive: true, force: true });
      } catch {
        // Ignore error
        // Ignore error
      }

      throw new Error(
        `Failed to download model ${huggingfaceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List downloaded models
   */
  async listDownloadedModels(): Promise<string[]> {
    try {
      await fs.access(this.config.modelDir);
      const entries = await fs.readdir(this.config.modelDir, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      // Ignore error
      // Ignore error
      return [];
    }
  }

  /**
   * Get model information from Hugging Face
   */
  async getModelInfo(huggingfaceId: string): Promise<unknown> {
    try {
      const { stdout } = await execAsync(`huggingface-cli repo info ${huggingfaceId} --json`);
      return JSON.parse(stdout) as Record<string, unknown>;
    } catch (error: unknown) {
      throw new Error(
        `Failed to get model info for ${huggingfaceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Search models on Hugging Face
   */
  async searchModels(query: string, limit = 10): Promise<unknown[]> {
    try {
      const { stdout } = await execAsync(`huggingface-cli search ${query} --limit ${limit} --json`);
      return JSON.parse(stdout) as unknown[];
    } catch (error: unknown) {
      throw new Error(
        `Failed to search models: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete a downloaded model
   */
  async deleteModel(localModelId: string): Promise<void> {
    const modelPath = this.getModelPath(localModelId);

    try {
      await fs.rm(modelPath, { recursive: true, force: true });
    } catch (error: unknown) {
      throw new Error(
        `Failed to delete model ${localModelId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get disk usage of downloaded models
   */
  async getModelsSize(): Promise<{ [modelId: string]: number }> {
    const models = await this.listDownloadedModels();
    const sizes: { [modelId: string]: number } = {};

    for (const modelId of models) {
      try {
        const modelPath = this.getModelPath(modelId);
        const { stdout } = await execAsync(`du -sb "${modelPath}"`);
        const sizeString = stdout.split('\t')[0];
        const size = sizeString ? parseInt(sizeString) : 0;
        sizes[modelId] = size;
      } catch {
        // Ignore error
        // Ignore error
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
    } catch (error: unknown) {
      throw new Error(
        `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`,
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
      await execAsync('huggingface-cli whoami', { timeout: 10000 });
      return true;
    } catch {
      // Ignore error
      // Ignore error
      return false;
    }
  }

  /**
   * Get current user information
   */
  async getUserInfo(): Promise<unknown> {
    try {
      const { stdout } = await execAsync('huggingface-cli whoami --json');
      return JSON.parse(stdout) as Record<string, unknown>;
    } catch (error: unknown) {
      throw new Error(
        `Failed to get user info: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

// Predefined model configurations
export const PREDEFINED_MODELS: { [key: string]: ModelInfo } = {
  // Video models
  'wan-2.2-t2v-a14b': {
    id: 'wan-2.2-t2v-a14b',
    name: 'Wan 2.2 T2V A14B',
    description: 'High-quality text to video, 14B parameters',
    huggingfaceId: 'Wan-AI/Wan2.2-T2V-A14B-Diffusers',
    type: 'video',
    size: '~28GB',
    vram: '~16GB',
  },
  'wan-2.2-ti2v-5b': {
    id: 'wan-2.2-ti2v-5b',
    name: 'Wan 2.2 TI2V 5B',
    description: 'Fast text/image to video, 5B parameters',
    huggingfaceId: 'Wan-AI/Wan2.2-TI2V-5B',
    type: 'video',
    size: '~10GB',
    vram: '~8GB',
  },
  'wan-2.2-i2v-a14b': {
    id: 'wan-2.2-i2v-a14b',
    name: 'Wan 2.2 I2V A14B',
    description: 'Image to video transformation, 14B parameters',
    huggingfaceId: 'Wan-AI/Wan2.2-I2V-A14B',
    type: 'video',
    size: '~28GB',
    vram: '~16GB',
  },

  // Image models
  'qwen-image': {
    id: 'qwen-image',
    name: 'Qwen-Image',
    description: 'Advanced text-to-image generation',
    huggingfaceId: 'Qwen/Qwen-Image',
    type: 'image',
    size: '~16GB',
    vram: '~8GB',
  },
  'stable-diffusion-xl': {
    id: 'stable-diffusion-xl',
    name: 'Stable Diffusion XL',
    description: 'High-quality artistic image generation',
    huggingfaceId: 'stabilityai/stable-diffusion-xl-base-1.0',
    type: 'image',
    size: '~12GB',
    vram: '~10GB',
  },
  'flux-dev': {
    id: 'flux-dev',
    name: 'FLUX.1-dev',
    description: 'Fast, high-quality text-to-image',
    huggingfaceId: 'black-forest-labs/FLUX.1-dev',
    type: 'image',
    size: '~24GB',
    vram: '~12GB',
  },
  'dall-e-3-xl': {
    id: 'dall-e-3-xl',
    name: 'DALL-E 3 XL',
    description: 'Creative and detailed image generation',
    huggingfaceId: 'openskyml/dalle-3-xl',
    type: 'image',
    size: '~32GB',
    vram: '~16GB',
  },
};

// Export singleton instance
export const huggingFaceService = HuggingFaceService.getInstance();
