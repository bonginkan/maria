/**
 * GPU Advisor - Hardware detection and optimization recommendations
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as _os from "os";

const execAsync = promisify(exec);

export interface GPUInfo {
  available: boolean;
  type?: "metal" | "cuda" | "rocm";
  name?: string;
  vram?: number; // in GB
  compute?: number;
  utilization?: number;
}

export interface GPURecommendations {
  enableReranker: boolean;
  batchSize: number;
  topK: number;
  quantization: string;
  cacheStrategy: "aggressive" | "moderate" | "conservative";
}

export class GPUAdvisor {
  private cache: GPUInfo | null = null;
  private cacheTime = 0;
  private cacheTTL = 60000; // 1 minute

  /**
   * Detect GPU capabilities
   */
  async detect(): Promise<GPUInfo> {
    // Return cached result if still fresh
    if (this.cache && Date.now() - this.cacheTime < this.cacheTTL) {
      return this.cache;
    }

    let gpuInfo: GPUInfo = { available: false };

    try {
      if (process.platform === "darwin") {
        gpuInfo = await this.detectMetalGPU();
      } else if (process.platform === "linux" || process.platform === "win32") {
        gpuInfo = (await this.detectNvidiaGPU()) ||
          (await this.detectAMDGPU()) || { available: false };
      }
    } catch (error) {
      // Default to no GPU on error
    }

    this.cache = gpuInfo;
    this.cacheTime = Date.now();
    return gpuInfo;
  }

  /**
   * Get optimization recommendations based on GPU
   */
  async getRecommendations(): Promise<GPURecommendations> {
    const gpu = await this.detect();

    if (!gpu.available) {
      // CPU-only recommendations
      return {
        enableReranker: false,
        batchSize: 1,
        topK: 50,
        quantization: "none",
        cacheStrategy: "aggressive",
      };
    }

    const vram = gpu.vram || 8;

    if (gpu.type === "metal") {
      // Apple Silicon recommendations
      if (vram >= 32) {
        return {
          enableReranker: true,
          batchSize: 128,
          topK: 100,
          quantization: "fp16",
          cacheStrategy: "moderate",
        };
      } else if (vram >= 16) {
        return {
          enableReranker: true,
          batchSize: 64,
          topK: 80,
          quantization: "int8",
          cacheStrategy: "moderate",
        };
      } else {
        return {
          enableReranker: true,
          batchSize: 32,
          topK: 60,
          quantization: "int8",
          cacheStrategy: "aggressive",
        };
      }
    } else {
      // NVIDIA/AMD recommendations
      if (vram >= 24) {
        return {
          enableReranker: true,
          batchSize: 128,
          topK: 120,
          quantization: "fp16",
          cacheStrategy: "conservative",
        };
      } else if (vram >= 16) {
        return {
          enableReranker: true,
          batchSize: 64,
          topK: 100,
          quantization: "int8",
          cacheStrategy: "moderate",
        };
      } else if (vram >= 8) {
        return {
          enableReranker: true,
          batchSize: 32,
          topK: 80,
          quantization: "int8",
          cacheStrategy: "moderate",
        };
      } else {
        return {
          enableReranker: false,
          batchSize: 16,
          topK: 50,
          quantization: "int8",
          cacheStrategy: "aggressive",
        };
      }
    }
  }

  private async detectMetalGPU(): Promise<GPUInfo> {
    try {
      // Check for Metal support on macOS
      const { stdout } = await execAsync(
        "system_profiler SPDisplaysDataType -json",
      );
      const data = JSON.parse(stdout);
      const displays = data.SPDisplaysDataType?.[0];

      if (displays?.sppci_model) {
        const model = displays.sppci_model;
        let vram = 8; // Default

        // Estimate VRAM based on Mac model
        if (model.includes("Pro Max")) vram = 48;
        else if (model.includes("Pro")) vram = 36;
        else if (model.includes("Max")) vram = 32;
        else if (model.includes("M3")) vram = 24;
        else if (model.includes("M2")) vram = 16;
        else if (model.includes("M1")) vram = 16;

        return {
          available: true,
          type: "metal",
          name: model,
          vram,
          compute: 2, // Metal Performance Shaders 2
        };
      }

      // Check for any GPU chipset
      const chipset = displays?.sppci_chipset_model;
      if (chipset) {
        return {
          available: true,
          type: "metal",
          name: chipset,
          vram: 8, // Conservative estimate
          compute: 1,
        };
      }
    } catch (error) {
      // Fall through to return no GPU
    }

    return { available: false };
  }

  private async detectNvidiaGPU(): Promise<GPUInfo | null> {
    try {
      // Use nvidia-smi to detect NVIDIA GPUs
      const { stdout } = await execAsync(
        "nvidia-smi --query-gpu=name,memory.total,utilization.gpu --format=csv,noheader,nounits",
      );

      const lines = stdout.trim().split("\n");
      if (lines.length > 0 && lines[0]) {
        const [name, vramMB, utilization] = lines[0].split(", ");

        return {
          available: true,
          type: "cuda",
          name: name.trim(),
          vram: Math.floor(parseInt(vramMB) / 1024), // Convert MB to GB
          compute: this.getCUDACompute(name),
          utilization: parseInt(utilization),
        };
      }
    } catch (error) {
      // NVIDIA GPU not available or nvidia-smi not installed
    }

    return null;
  }

  private async detectAMDGPU(): Promise<GPUInfo | null> {
    try {
      // Use rocm-smi to detect AMD GPUs
      const { stdout } = await execAsync("rocm-smi --showmeminfo vram --csv");

      const lines = stdout.trim().split("\n");
      // Parse CSV output from rocm-smi
      if (lines.length > 1) {
        const vramLine = lines[1].split(",");
        const vramMB = parseInt(vramLine[1]);

        return {
          available: true,
          type: "rocm",
          name: "AMD GPU",
          vram: Math.floor(vramMB / 1024), // Convert MB to GB
          compute: 1,
        };
      }
    } catch (error) {
      // AMD GPU not available or rocm-smi not installed
    }

    return null;
  }

  private getCUDACompute(gpuName: string): number {
    // Map GPU names to compute capability
    if (gpuName.includes("H100") || gpuName.includes("H200")) return 9;
    if (gpuName.includes("A100") || gpuName.includes("A6000")) return 8;
    if (gpuName.includes("V100")) return 7;
    if (gpuName.includes("RTX 40")) return 8;
    if (gpuName.includes("RTX 30")) return 8;
    if (gpuName.includes("RTX 20")) return 7;
    if (gpuName.includes("GTX 16")) return 7;
    return 6; // Default for older GPUs
  }
}
