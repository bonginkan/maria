/**
 * GPU Management Command
 * Provides GPU status, benchmarking, and management capabilities
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../types";
import { logger } from "../../../utils/logger";
import os from "os";

interface GPUDevice {
  id: number;
  name: string;
  type: "metal" | "cuda" | "rocm" | "directml" | "cpu";
  memory: number;
  utilization?: number;
  temperature?: number;
  available: boolean;
}

interface GPUStatus {
  selectedDevice: GPUDevice | null;
  availableDevices: GPUDevice[];
  systemInfo: {
    platform: string;
    arch: string;
    cpuCount: number;
    totalMemory: number;
  };
  memoryStats?: {
    total: number;
    allocated: number;
    free: number;
    utilization: number;
  };
}

interface BenchmarkResult {
  device: GPUDevice;
  results: {
    batchSize: number;
    latency: number;
    throughput: number;
  }[];
  summary: {
    bestLatency: number;
    bestThroughput: number;
    optimalBatchSize: number;
  };
  timestamp: string;
}

export class GPUCommand extends BaseCommand {
  name = "gpu";
  category = "ai" as const;
  description = "🎮 GPU management and monitoring for AI acceleration";
  override aliases = ["/graphics", "/device"];
  override usage = "[status|benchmark|devices|memory] [options]";

  override examples: CommandExample[] = [
    {
      input: "/gpu",
      description: "Show current GPU status and utilization",
      output: "GPU device info, memory usage, and availability",
    },
    {
      input: "/gpu status --verbose",
      description: "Show detailed GPU status with all available devices",
      output:
        "Comprehensive GPU information including temperature and utilization",
    },
    {
      input: "/gpu benchmark",
      description: "Run GPU performance benchmark",
      output: "Benchmark results with latency and throughput metrics",
    },
    {
      input: "/gpu devices",
      description: "List all available GPU devices",
      output: "Complete device inventory with capabilities",
    },
    {
      input: "/gpu memory",
      description: "Show GPU memory allocation and usage",
      output: "Memory statistics and allocation breakdown",
    },
  ];

  override permissions = {
    requiresAuth: false,
    role: undefined,
  };

  override rateLimit = {
    requests: 20,
    window: "1m",
  };

  async execute(
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const { options, parsed } = args;
      const positional = (parsed["positional"] as string[]) || [];
      const command = positional[0] || "status";
      const verbose = options["verbose"] || options["v"] || false;

      logger.info(`Executing GPU command: ${command}`, {
        verbose,
        user: context.user?.id,
      });

      switch (command.toLowerCase()) {
        case "status":
        case "s":
          return await this.showGPUStatus(verbose);

        case "benchmark":
        case "bench":
        case "b":
          return await this.runGPUBenchmark(options);

        case "devices":
        case "list":
        case "ls":
          return await this.listGPUDevices(verbose);

        case "memory":
        case "mem":
        case "m":
          return await this.showMemoryStats();

        default:
          return this.error(
            `Unknown GPU command: ${command}`,
            "INVALID_COMMAND",
            `Valid commands: status, benchmark, devices, memory`,
          );
      }
    } catch (error) {
      logger.error("GPU command failed:", error);
      return this.error(
        "GPU command execution failed",
        "GPU_ERROR",
        error instanceof Error ? error.message : "Unknown error occurred",
      );
    }
  }

  /**
   * Show current GPU status
   */
  private async showGPUStatus(verbose: boolean): Promise<CommandResult> {
    const status = await this.getGPUStatus();
    const formatted = this.formatGPUStatus(status, verbose);

    return this.success(formatted, {
      hasGPU: status.selectedDevice !== null,
      deviceCount: status.availableDevices.length,
      selectedDevice: status.selectedDevice?.name,
      platform: status.systemInfo.platform,
      type: "gpu-status",
    });
  }

  /**
   * Run GPU benchmark
   */
  private async runGPUBenchmark(
    options: Record<string, any>,
  ): Promise<CommandResult> {
    const status = await this.getGPUStatus();

    if (!status.selectedDevice) {
      return this.error(
        "No GPU device available for benchmarking",
        "NO_GPU_DEVICE",
        "GPU acceleration is not available on this system",
      );
    }

    const iterations = parseInt(options["iterations"] || "5", 10);
    const maxBatchSize = parseInt(options["max-batch"] || "32", 10);

    logger.info("Starting GPU benchmark...", {
      device: status.selectedDevice.name,
      iterations,
      maxBatchSize,
    });

    const benchmarkResult = await this.performGPUBenchmark(
      status.selectedDevice,
      {
        iterations,
        maxBatchSize,
      },
    );

    const formatted = this.formatBenchmarkResults(benchmarkResult);

    return this.success(formatted, {
      device: status.selectedDevice.name,
      bestLatency: benchmarkResult.summary.bestLatency,
      bestThroughput: benchmarkResult.summary.bestThroughput,
      optimalBatchSize: benchmarkResult.summary.optimalBatchSize,
      type: "gpu-benchmark",
    });
  }

  /**
   * List all GPU devices
   */
  private async listGPUDevices(verbose: boolean): Promise<CommandResult> {
    const status = await this.getGPUStatus();
    const formatted = this.formatDeviceList(status.availableDevices, verbose);

    return this.success(formatted, {
      deviceCount: status.availableDevices.length,
      hasGPU: status.availableDevices.some((d) => d.type !== "cpu"),
      selectedDevice: status.selectedDevice?.id,
      type: "gpu-device-list",
    });
  }

  /**
   * Show GPU memory statistics
   */
  private async showMemoryStats(): Promise<CommandResult> {
    const status = await this.getGPUStatus();

    if (!status.selectedDevice || status.selectedDevice.type === "cpu") {
      return this.error(
        "No GPU device selected for memory statistics",
        "NO_GPU_MEMORY",
        "Memory statistics are only available for GPU devices",
      );
    }

    const formatted = this.formatMemoryStats(status);

    return this.success(formatted, {
      device: status.selectedDevice.name,
      totalMemory: status.memoryStats?.total,
      utilization: status.memoryStats?.utilization,
      type: "gpu-memory",
    });
  }

  /**
   * Get current GPU status (mock implementation)
   */
  private async getGPUStatus(): Promise<GPUStatus> {
    // Simulate system detection
    const platform = os.platform();
    const arch = os.arch();

    const systemInfo = {
      platform,
      arch,
      cpuCount: os.cpus().length,
      totalMemory: Math.floor(os.totalmem() / (1024 * 1024 * 1024)), // GB
    };

    // Mock GPU detection based on platform
    const availableDevices: GPUDevice[] = [];
    let selectedDevice: GPUDevice | null = null;

    // Add CPU fallback
    availableDevices.push({
      id: -1,
      name: `CPU (${systemInfo.cpuCount} cores)`,
      type: "cpu",
      memory: systemInfo.totalMemory * 1024, // MB
      available: true,
    });

    // Platform-specific GPU detection simulation
    if (platform === "darwin") {
      // macOS - Metal support
      if (arch === "arm64") {
        // Apple Silicon
        const appleGPU: GPUDevice = {
          id: 0,
          name: "Apple M2 Max GPU",
          type: "metal",
          memory: 32768, // 32GB unified memory
          utilization: Math.random() * 30 + 10, // 10-40%
          temperature: Math.random() * 20 + 45, // 45-65°C
          available: true,
        };
        availableDevices.push(appleGPU);
        selectedDevice = appleGPU;
      } else {
        // Intel Mac with possible discrete GPU
        const intelGPU: GPUDevice = {
          id: 0,
          name: "AMD Radeon Pro 5700 XT",
          type: "metal",
          memory: 16384, // 16GB VRAM
          utilization: Math.random() * 50 + 20,
          temperature: Math.random() * 25 + 60,
          available: true,
        };
        availableDevices.push(intelGPU);
        selectedDevice = intelGPU;
      }
    } else if (platform === "linux") {
      // Linux - CUDA/ROCm support
      const nvidiaGPU: GPUDevice = {
        id: 0,
        name: "NVIDIA RTX 4090",
        type: "cuda",
        memory: 24576, // 24GB VRAM
        utilization: Math.random() * 60 + 15,
        temperature: Math.random() * 30 + 50,
        available: true,
      };
      availableDevices.push(nvidiaGPU);
      selectedDevice = nvidiaGPU;
    } else {
      // Windows or other - CPU fallback
      selectedDevice = availableDevices[0] || null;
    }

    const memoryStats =
      selectedDevice && selectedDevice.type !== "cpu"
        ? {
            total: selectedDevice.memory,
            allocated: Math.floor(
              (selectedDevice.memory * (selectedDevice.utilization || 20)) /
                100,
            ),
            free: Math.floor(
              (selectedDevice.memory *
                (100 - (selectedDevice.utilization || 20))) /
                100,
            ),
            utilization: selectedDevice.utilization || 20,
          }
        : undefined;

    return {
      selectedDevice,
      availableDevices,
      systemInfo,
      memoryStats,
    };
  }

  /**
   * Perform GPU benchmark (mock implementation)
   */
  private async performGPUBenchmark(
    device: GPUDevice,
    options: {
      iterations: number;
      maxBatchSize: number;
    },
  ): Promise<BenchmarkResult> {
    const batchSizes = [1, 4, 8, 16, 32].filter(
      (size) => size <= options.maxBatchSize,
    );
    const results = [];

    // Simulate benchmarking
    for (const batchSize of batchSizes) {
      let totalLatency = 0;

      for (let i = 0; i < options.iterations; i++) {
        // Simulate GPU processing time based on device type and batch size
        const baseLatency = this.getBaseLatency(device.type);
        const batchEfficiency = Math.max(0.3, 1 - (batchSize - 1) * 0.05);
        const latency =
          baseLatency * batchSize * batchEfficiency + Math.random() * 10;

        totalLatency += latency;

        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      const avgLatency = totalLatency / options.iterations;
      const throughput = (batchSize / avgLatency) * 1000; // items per second

      results.push({
        batchSize,
        latency: parseFloat(avgLatency.toFixed(2)),
        throughput: parseFloat(throughput.toFixed(1)),
      });
    }

    // Calculate summary
    const latencies = results.map((r) => r.latency / r.batchSize); // per-item latency
    const throughputs = results.map((r) => r.throughput);

    const bestLatency = Math.min(...latencies);
    const bestThroughput = Math.max(...throughputs);
    const optimalBatchSize =
      results.find((r) => r.throughput === bestThroughput)?.batchSize || 1;

    return {
      device,
      results,
      summary: {
        bestLatency: parseFloat(bestLatency.toFixed(2)),
        bestThroughput: parseFloat(bestThroughput.toFixed(1)),
        optimalBatchSize,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get base latency for different device types
   */
  private getBaseLatency(deviceType: string): number {
    const latencies: Record<string, number> = {
      metal: 25, // Mac GPU - quite fast
      cuda: 20, // NVIDIA GPU - fastest
      rocm: 30, // AMD GPU - good
      directml: 40, // Windows GPU - decent
      cpu: 100, // CPU fallback - slower
    };
    return latencies[deviceType] || 100;
  }

  /**
   * Format GPU status for display
   */
  private formatGPUStatus(status: GPUStatus, verbose: boolean): string {
    const lines: string[] = [];

    // Header
    lines.push("");
    lines.push("🎮 GPU STATUS & ACCELERATION");
    lines.push("═".repeat(45));
    lines.push("");

    // System Info
    lines.push("**🖥️  System Information:**");
    lines.push(
      `   Platform: ${status.systemInfo.platform}/${status.systemInfo.arch}`,
    );
    lines.push(`   CPU Cores: ${status.systemInfo.cpuCount}`);
    lines.push(`   System Memory: ${status.systemInfo.totalMemory}GB`);
    lines.push("");

    // Selected Device
    if (status.selectedDevice) {
      const device = status.selectedDevice;
      const icon = device.type === "cpu" ? "💾" : "🎮";

      lines.push(`**${icon} Active Device:**`);
      lines.push(`   Name: ${device.name}`);
      lines.push(`   Type: ${device.type.toUpperCase()}`);
      lines.push(`   Memory: ${(device.memory / 1024).toFixed(1)}GB`);

      if (device.utilization !== undefined) {
        lines.push(`   Utilization: ${device.utilization.toFixed(1)}%`);
      }

      if (device.temperature !== undefined) {
        lines.push(`   Temperature: ${device.temperature.toFixed(1)}°C`);
      }

      lines.push(
        `   Status: ${device.available ? "✅ Available" : "❌ Unavailable"}`,
      );
      lines.push("");
    }

    // Memory Statistics
    if (status.memoryStats) {
      const mem = status.memoryStats;
      lines.push("**💾 GPU Memory:**");
      lines.push(`   Total: ${(mem.total / 1024).toFixed(1)}GB`);
      lines.push(`   Allocated: ${(mem.allocated / 1024).toFixed(1)}GB`);
      lines.push(`   Free: ${(mem.free / 1024).toFixed(1)}GB`);
      lines.push(`   Utilization: ${mem.utilization.toFixed(1)}%`);

      // Memory bar
      const barLength = 30;
      const usedBars = Math.floor((mem.utilization / 100) * barLength);
      const freeBars = barLength - usedBars;
      const memoryBar = "█".repeat(usedBars) + "░".repeat(freeBars);
      lines.push(`   Usage: [${memoryBar}] ${mem.utilization.toFixed(1)}%`);
      lines.push("");
    }

    // Available Devices (verbose mode)
    if (verbose && status.availableDevices.length > 1) {
      lines.push("**📋 All Available Devices:**");
      for (const device of status.availableDevices) {
        const selected =
          device.id === status.selectedDevice?.id ? " (SELECTED)" : "";
        const icon = device.type === "cpu" ? "💾" : "🎮";

        lines.push(
          `   ${icon} ${device.name} - ${device.type.toUpperCase()}${selected}`,
        );
        lines.push(
          `      Memory: ${(device.memory / 1024).toFixed(1)}GB, Available: ${device.available ? "Yes" : "No"}`,
        );
      }
      lines.push("");
    }

    // Performance Status
    const perfStatus =
      status.selectedDevice?.type === "cpu"
        ? "CPU Fallback"
        : status.selectedDevice?.type === "metal"
          ? "Metal Accelerated"
          : status.selectedDevice?.type === "cuda"
            ? "CUDA Accelerated"
            : "GPU Accelerated";

    lines.push("**⚡ Acceleration Status:**");
    lines.push(`   Mode: ${perfStatus}`);
    lines.push(`   Available Devices: ${status.availableDevices.length}`);
    lines.push(
      `   GPU Ready: ${status.selectedDevice?.type !== "cpu" ? "Yes" : "No"}`,
    );
    lines.push("");

    // Tips
    lines.push("**💡 Commands:**");
    lines.push("   /gpu benchmark    - Run performance test");
    lines.push("   /gpu devices      - List all devices");
    lines.push("   /gpu memory       - Show memory details");
    lines.push("   /gpu status -v    - Verbose status");

    return lines.join("\n");
  }

  /**
   * Format benchmark results for display
   */
  private formatBenchmarkResults(result: BenchmarkResult): string {
    const lines: string[] = [];

    // Header
    lines.push("");
    lines.push("🏃 GPU BENCHMARK RESULTS");
    lines.push("═".repeat(40));
    lines.push("");
    lines.push(`Device: ${result.device.name}`);
    lines.push(`Type: ${result.device.type.toUpperCase()}`);
    lines.push(`Timestamp: ${new Date(result.timestamp).toLocaleString()}`);
    lines.push("");

    // Results Table
    lines.push("**📊 Performance by Batch Size:**");
    lines.push("");
    lines.push("| Batch | Latency (ms) | Throughput (items/sec) |");
    lines.push("|-------|--------------|------------------------|");

    for (const r of result.results) {
      const latency = r.latency.toString().padStart(8);
      const throughput = r.throughput.toString().padStart(12);
      lines.push(
        `|   ${r.batchSize.toString().padStart(2)}  |    ${latency}  |         ${throughput}       |`,
      );
    }
    lines.push("");

    // Summary
    lines.push("**🏆 Performance Summary:**");
    lines.push(`   Best Latency: ${result.summary.bestLatency}ms per _item`);
    lines.push(
      `   Best Throughput: ${result.summary.bestThroughput} items/sec`,
    );
    lines.push(`   Optimal Batch Size: ${result.summary.optimalBatchSize}`);
    lines.push("");

    // Performance Classification
    const throughput = result.summary.bestThroughput;
    let classification = "";
    if (throughput > 1000) classification = "🚀 Excellent";
    else if (throughput > 500) classification = "⚡ Very Good";
    else if (throughput > 200) classification = "✅ Good";
    else if (throughput > 50) classification = "🔶 Fair";
    else classification = "🔴 Poor";

    lines.push(`**📈 Performance Rating:** ${classification}`);
    lines.push("");

    // Recommendations
    lines.push("**💡 Recommendations:**");
    if (result.summary.optimalBatchSize >= 16) {
      lines.push("   • Use batch processing for better throughput");
      lines.push(`   • Optimal batch size: ${result.summary.optimalBatchSize}`);
    }
    if (result.device.type === "cpu") {
      lines.push("   • Consider GPU acceleration for better performance");
    }
    if (throughput < 100) {
      lines.push("   • Performance may be limited by available resources");
    }

    return lines.join("\n");
  }

  /**
   * Format device list for display
   */
  private formatDeviceList(devices: GPUDevice[], verbose: boolean): string {
    const lines: string[] = [];

    // Header
    lines.push("");
    lines.push("📋 AVAILABLE GPU DEVICES");
    lines.push("═".repeat(35));
    lines.push("");

    if (devices.length === 0) {
      lines.push("❌ No devices found");
      return lines.join("\n");
    }

    for (const device of devices) {
      const icon = device.type === "cpu" ? "💾" : "🎮";
      const status = device.available ? "✅" : "❌";

      lines.push(`${icon} **Device ${device.id}: ${device.name}**`);
      lines.push(`   Type: ${device.type.toUpperCase()}`);
      lines.push(`   Memory: ${(device.memory / 1024).toFixed(1)}GB`);
      lines.push(
        `   Status: ${status} ${device.available ? "Available" : "Unavailable"}`,
      );

      if (verbose) {
        if (device.utilization !== undefined) {
          lines.push(`   Utilization: ${device.utilization.toFixed(1)}%`);
        }
        if (device.temperature !== undefined) {
          lines.push(`   Temperature: ${device.temperature.toFixed(1)}°C`);
        }
      }

      lines.push("");
    }

    // Summary
    const gpuCount = devices.filter((d) => d.type !== "cpu").length;
    lines.push("**📊 Summary:**");
    lines.push(`   Total Devices: ${devices.length}`);
    lines.push(`   GPU Devices: ${gpuCount}`);
    lines.push(`   Available: ${devices.filter((d) => d.available).length}`);

    return lines.join("\n");
  }

  /**
   * Format memory statistics for display
   */
  private formatMemoryStats(status: GPUStatus): string {
    const lines: string[] = [];
    const device = status.selectedDevice;
    const mem = status.memoryStats;

    if (!device || !mem) {
      lines.push("❌ No GPU memory information available");
      return lines.join("\n");
    }

    // Header
    lines.push("");
    lines.push("💾 GPU MEMORY STATISTICS");
    lines.push("═".repeat(35));
    lines.push("");
    lines.push(`Device: ${device.name}`);
    lines.push("");

    // Memory Information
    lines.push("**📊 Memory Allocation:**");
    lines.push(`   Total Memory: ${(mem.total / 1024).toFixed(2)}GB`);
    lines.push(`   Allocated: ${(mem.allocated / 1024).toFixed(2)}GB`);
    lines.push(`   Free: ${(mem.free / 1024).toFixed(2)}GB`);
    lines.push(`   Utilization: ${mem.utilization.toFixed(1)}%`);
    lines.push("");

    // Visual Memory Bar
    const barLength = 50;
    const usedBars = Math.floor((mem.utilization / 100) * barLength);
    const freeBars = barLength - usedBars;
    const memoryBar = "█".repeat(usedBars) + "░".repeat(freeBars);

    lines.push("**📈 Memory Usage Visualization:**");
    lines.push(`[${memoryBar}] ${mem.utilization.toFixed(1)}%`);
    lines.push("");

    // Memory Health
    let healthStatus = "";
    if (mem.utilization < 50) healthStatus = "✅ Healthy";
    else if (mem.utilization < 80) healthStatus = "🔶 Moderate";
    else if (mem.utilization < 95) healthStatus = "⚠️  High";
    else healthStatus = "🔴 Critical";

    lines.push(`**🏥 Memory Health:** ${healthStatus}`);
    lines.push("");

    // Recommendations
    lines.push("**💡 Recommendations:**");
    if (mem.utilization > 80) {
      lines.push("   • Consider reducing batch sizes");
      lines.push("   • Monitor memory usage during inference");
    } else if (mem.utilization < 30) {
      lines.push("   • Memory usage is low - can increase batch sizes");
      lines.push("   • Good capacity for additional workloads");
    } else {
      lines.push("   • Memory utilization is optimal");
    }

    return lines.join("\n");
  }

  /**
   * Command validation
   */
  override async validate(
    args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    const { parsed } = args;
    const positional = (parsed["positional"] as string[]) || [];
    const command = positional[0];

    if (
      command &&
      ![
        "status",
        "s",
        "benchmark",
        "bench",
        "b",
        "devices",
        "list",
        "ls",
        "memory",
        "mem",
        "m",
      ].includes(command.toLowerCase())
    ) {
      return {
        success: false,
        error: `Unknown command: ${command}. Valid commands: status, benchmark, devices, memory`,
      };
    }

    return { success: true };
  }
}

export const meta = {
  name: 'gpu',
  category: 'ai',
  description: 'GPU status, benchmarking, and management capabilities *GPU needed - Local LLM only (Pro+ members only)',
  aliases: [],
  usage: '/gpu [status|benchmark|devices|memory]',
  examples: [
    '/gpu status',
    '/gpu benchmark',
    '/gpu devices',
    '/gpu memory'
  ],
  deps: []
};

export default GPUCommand;
