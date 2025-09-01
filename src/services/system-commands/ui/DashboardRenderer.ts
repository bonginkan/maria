/**
 * DashboardRenderer - Differential Rendering Engine
 *
 * SOW Phase 3.3 v2.1 Week 4 Implementation:
 * - Frame budget management (25 FPS / 40ms)
 * - Differential rendering with delta calculation
 * - Monotonic time-based performance tracking
 * - Memory-efficient update batching
 * - Consistent metric naming (txKBps/rxKBps)
 */

import { logger } from "../../../utils/logger";
import chalk from "chalk";

export interface FrameData {
  readonly timestamp: number;
  readonly monotonicMs: number;
  readonly data: DashboardData;
  readonly hash: string;
}

export interface DashboardData {
  // System health with consistent naming
  system: {
    cpu: number; // 0-100
    memory: number; // 0-100
    uptime: number; // seconds
    load: [number, number, number]; // 1m, 5m, 15m
  };

  // Network metrics (consistent naming per SOW v2.1)
  network: {
    txKBps: number; // Transmit KB/s
    rxKBps: number; // Receive KB/s
    connections: number;
    packets: {
      txCount: number;
      rxCount: number;
      dropped: number;
    };
  };

  // Performance metrics with monotonic timing
  performance: {
    commandsPerSec: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    monotonicUptimeMs: number; // performance.now() based
    errorRate: number; // 0-1
  };

  // Memory system metrics
  memory: {
    l1Nodes: number;
    l2Traces: number;
    totalTokens: number;
    cacheHitRate: number; // 0-1
  };

  // Provider status
  providers: Array<{
    id: string;
    status: "healthy" | "degraded" | "offline";
    latencyMs: number;
    errorRate: number;
  }>;
}

export interface RenderUpdate {
  region: string;
  content: string;
  priority: "high" | "medium" | "low";
  estimatedMs: number;
}

export interface RenderStats {
  frameCount: number;
  avgFrameMs: number;
  droppedFrames: number;
  totalRenderMs: number;
  lastFrameMs: number;
}

export class DashboardRenderer {
  private readonly FRAME_BUDGET_MS = 40; // 25 FPS
  private readonly MAX_BATCH_SIZE = 10;
  private readonly HASH_CACHE_SIZE = 100;

  private lastFrame?: FrameData;
  private frameCount = 0;
  private droppedFrames = 0;
  private totalRenderMs = 0;
  private hashCache = new Map<string, string>();
  private updateQueue: RenderUpdate[] = [];

  constructor(
    private readonly outputPort: DashboardOutputPort = new ConsoleDashboardPort(),
  ) {}

  /**
   * Main render method with differential updates and frame budget
   */
  async render(data: DashboardData): Promise<void> {
    const startMono = performance.now();

    try {
      // Calculate frame data and hash
      const frameData = this.createFrameData(data);

      // Skip if no changes (hash optimization)
      if (this.lastFrame && frameData.hash === this.lastFrame.hash) {
        return;
      }

      // Calculate differential updates
      const updates = this.calculateDiff(this.lastFrame, frameData);

      if (updates.length === 0) {
        return;
      }

      // Apply updates within frame budget
      await this.applyUpdatesWithBudget(updates, startMono);

      // Update frame tracking
      this.lastFrame = frameData;
      this.frameCount++;
    } catch (error) {
      logger.error("Dashboard render failed:", error);
      this.droppedFrames++;
    } finally {
      const frameTime = performance.now() - startMono;
      this.totalRenderMs += frameTime;
    }
  }

  /**
   * Apply updates with frame budget management
   */
  private async applyUpdatesWithBudget(
    updates: RenderUpdate[],
    startMono: number,
  ): Promise<void> {
    // Sort by priority and estimated time
    const sortedUpdates = this.prioritizeUpdates(updates);

    for (const update of sortedUpdates) {
      const elapsed = performance.now() - startMono;

      // Check frame budget
      if (elapsed + update.estimatedMs > this.FRAME_BUDGET_MS) {
        // Defer remaining updates to next frame
        this.updateQueue.push(
          ...sortedUpdates.slice(sortedUpdates.indexOf(update)),
        );
        this.droppedFrames++;
        break;
      }

      await this.applyUpdate(update);
    }
  }

  /**
   * Calculate differential updates between frames
   */
  private calculateDiff(
    oldFrame: FrameData | undefined,
    newFrame: FrameData,
  ): RenderUpdate[] {
    const updates: RenderUpdate[] = [];

    if (!oldFrame) {
      // First render - full update
      updates.push(...this.createFullRender(newFrame.data));
      return updates;
    }

    const oldData = oldFrame.data;
    const newData = newFrame.data;

    // System metrics diff
    if (this.hasSystemChanges(oldData.system, newData.system)) {
      updates.push(this.createSystemUpdate(newData.system));
    }

    // Network metrics diff (with consistent naming)
    if (this.hasNetworkChanges(oldData.network, newData.network)) {
      updates.push(this.createNetworkUpdate(newData.network));
    }

    // Performance metrics diff
    if (this.hasPerformanceChanges(oldData.performance, newData.performance)) {
      updates.push(this.createPerformanceUpdate(newData.performance));
    }

    // Memory system diff
    if (this.hasMemoryChanges(oldData.memory, newData.memory)) {
      updates.push(this.createMemoryUpdate(newData.memory));
    }

    // Provider status diff
    if (this.hasProviderChanges(oldData.providers, newData.providers)) {
      updates.push(this.createProviderUpdate(newData.providers));
    }

    return updates;
  }

  /**
   * Create frame data with optimized hash calculation
   */
  private createFrameData(data: DashboardData): FrameData {
    const timestamp = Date.now();
    const monotonicMs = performance.now();

    // Create hash for change detection
    const hash = this.calculateHash(data);

    return Object.freeze({
      timestamp,
      monotonicMs,
      data: structuredClone(data), // Deep copy for immutability
      hash,
    });
  }

  /**
   * Optimized hash calculation with caching
   */
  private calculateHash(data: DashboardData): string {
    const key = JSON.stringify(data);

    if (this.hashCache.has(key)) {
      return this.hashCache.get(key)!;
    }

    // Simple but effective hash for change detection
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    const hashStr = hash.toString(16);

    // Maintain cache size
    if (this.hashCache.size >= this.HASH_CACHE_SIZE) {
      const firstKey = this.hashCache.keys().next().value;
      this.hashCache.delete(firstKey);
    }

    this.hashCache.set(key, hashStr);
    return hashStr;
  }

  /**
   * Prioritize updates by importance and render cost
   */
  private prioritizeUpdates(updates: RenderUpdate[]): RenderUpdate[] {
    return updates.sort((a, b) => {
      // Priority first
      const priorityScore = { high: 3, medium: 2, low: 1 };
      const priorityDiff =
        priorityScore[b.priority] - priorityScore[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by estimated render time (faster first)
      return a.estimatedMs - b.estimatedMs;
    });
  }

  /**
   * Apply individual update to output port
   */
  private async applyUpdate(update: RenderUpdate): Promise<void> {
    await this.outputPort.updateRegion(update.region, update.content);
  }

  /**
   * Create full render for initial display
   */
  private createFullRender(data: DashboardData): RenderUpdate[] {
    return [
      this.createSystemUpdate(data.system),
      this.createNetworkUpdate(data.network),
      this.createPerformanceUpdate(data.performance),
      this.createMemoryUpdate(data.memory),
      this.createProviderUpdate(data.providers),
    ];
  }

  // Change detection methods
  private hasSystemChanges(
    old: DashboardData["system"],
    new_: DashboardData["system"],
  ): boolean {
    return (
      old.cpu !== new_.cpu ||
      old.memory !== new_.memory ||
      JSON.stringify(old.load) !== JSON.stringify(new_.load)
    );
  }

  private hasNetworkChanges(
    old: DashboardData["network"],
    new_: DashboardData["network"],
  ): boolean {
    return (
      old.txKBps !== new_.txKBps ||
      old.rxKBps !== new_.rxKBps ||
      old.connections !== new_.connections
    );
  }

  private hasPerformanceChanges(
    old: DashboardData["performance"],
    new_: DashboardData["performance"],
  ): boolean {
    return (
      old.commandsPerSec !== new_.commandsPerSec ||
      old.avgLatencyMs !== new_.avgLatencyMs ||
      old.errorRate !== new_.errorRate
    );
  }

  private hasMemoryChanges(
    old: DashboardData["memory"],
    new_: DashboardData["memory"],
  ): boolean {
    return (
      old.l1Nodes !== new_.l1Nodes ||
      old.l2Traces !== new_.l2Traces ||
      old.totalTokens !== new_.totalTokens
    );
  }

  private hasProviderChanges(
    old: DashboardData["providers"],
    new_: DashboardData["providers"],
  ): boolean {
    return JSON.stringify(old) !== JSON.stringify(new_);
  }

  // Update creation methods
  private createSystemUpdate(system: DashboardData["system"]): RenderUpdate {
    const content = [
      chalk.cyan("System Health"),
      `CPU: ${this.formatPercentage(system.cpu)} ${this.getHealthBar(system.cpu)}`,
      `Memory: ${this.formatPercentage(system.memory)} ${this.getHealthBar(system.memory)}`,
      `Load: ${system.load.map((l) => l.toFixed(2)).join(", ")}`,
      `Uptime: ${this.formatUptime(system.uptime)}`,
    ].join("\n");

    return {
      region: "system",
      content,
      priority: "high",
      estimatedMs: 5,
    };
  }

  private createNetworkUpdate(network: DashboardData["network"]): RenderUpdate {
    const content = [
      chalk.cyan("Network"),
      `TX: ${this.formatThroughput(network.txKBps)} KB/s`, // Consistent naming
      `RX: ${this.formatThroughput(network.rxKBps)} KB/s`, // Consistent naming
      `Connections: ${network.connections}`,
      `Packets: TX ${network.packets.txCount} / RX ${network.packets.rxCount}`,
      `Dropped: ${network.packets.dropped}`,
    ].join("\n");

    return {
      region: "network",
      content,
      priority: "medium",
      estimatedMs: 3,
    };
  }

  private createPerformanceUpdate(
    performance: DashboardData["performance"],
  ): RenderUpdate {
    const content = [
      chalk.cyan("Performance"),
      `Commands/sec: ${performance.commandsPerSec.toFixed(1)}`,
      `Avg Latency: ${performance.avgLatencyMs.toFixed(1)}ms`,
      `P95 Latency: ${performance.p95LatencyMs.toFixed(1)}ms`,
      `Error Rate: ${this.formatPercentage(performance.errorRate)}`,
      `Uptime: ${this.formatMonotonicTime(performance.monotonicUptimeMs)}`,
    ].join("\n");

    return {
      region: "performance",
      content,
      priority: "high",
      estimatedMs: 4,
    };
  }

  private createMemoryUpdate(memory: DashboardData["memory"]): RenderUpdate {
    const content = [
      chalk.cyan("Memory System"),
      `L1 Nodes: ${memory.l1Nodes.toLocaleString()}`,
      `L2 Traces: ${memory.l2Traces.toLocaleString()}`,
      `Total Tokens: ${memory.totalTokens.toLocaleString()}`,
      `Cache Hit Rate: ${this.formatPercentage(memory.cacheHitRate)}`,
    ].join("\n");

    return {
      region: "memory",
      content,
      priority: "medium",
      estimatedMs: 3,
    };
  }

  private createProviderUpdate(
    providers: DashboardData["providers"],
  ): RenderUpdate {
    const content = [
      chalk.cyan("AI Providers"),
      ...providers.map((p) => {
        const statusColor =
          p.status === "healthy"
            ? chalk.green
            : p.status === "degraded"
              ? chalk.yellow
              : chalk.red;
        return `${p.id}: ${statusColor(p.status)} (${p.latencyMs}ms)`;
      }),
    ].join("\n");

    return {
      region: "providers",
      content,
      priority: "low",
      estimatedMs: 2,
    };
  }

  // Utility formatting methods
  private formatPercentage(value: number): string {
    const pct = (value * 100).toFixed(1);
    if (value > 0.8) return chalk.red(`${pct}%`);
    if (value > 0.6) return chalk.yellow(`${pct}%`);
    return chalk.green(`${pct}%`);
  }

  private formatThroughput(kbps: number): string {
    if (kbps > 1000) return `${(kbps / 1000).toFixed(1)}M`;
    return kbps.toFixed(1);
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  private formatMonotonicTime(ms: number): string {
    const seconds = ms / 1000;
    return this.formatUptime(seconds);
  }

  private getHealthBar(value: number): string {
    const width = 10;
    const filled = Math.round(value * width);
    const empty = width - filled;

    const bar = "█".repeat(filled) + "░".repeat(empty);

    if (value > 0.8) return chalk.red(bar);
    if (value > 0.6) return chalk.yellow(bar);
    return chalk.green(bar);
  }

  /**
   * Get rendering performance statistics
   */
  getStats(): RenderStats {
    return {
      frameCount: this.frameCount,
      avgFrameMs:
        this.frameCount > 0 ? this.totalRenderMs / this.frameCount : 0,
      droppedFrames: this.droppedFrames,
      totalRenderMs: this.totalRenderMs,
      lastFrameMs: this.lastFrame
        ? performance.now() - this.lastFrame.monotonicMs
        : 0,
    };
  }

  /**
   * Reset performance counters
   */
  reset(): void {
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.totalRenderMs = 0;
    this.lastFrame = undefined;
    this.hashCache.clear();
    this.updateQueue = [];
  }
}

/**
 * Output port interface for dashboard rendering
 */
export interface DashboardOutputPort {
  updateRegion(region: string, content: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Console-based dashboard output port
 */
export class ConsoleDashboardPort implements DashboardOutputPort {
  private regions = new Map<string, string>();

  async updateRegion(region: string, content: string): Promise<void> {
    this.regions.set(region, content);
    await this.redraw();
  }

  async clear(): Promise<void> {
    console.clear();
    this.regions.clear();
  }

  private async redraw(): Promise<void> {
    // Simple console redraw - in production would use more sophisticated TUI
    console.clear();
    console.log(chalk.bold("MARIA System Dashboard\n"));

    const regionOrder = [
      "system",
      "performance",
      "network",
      "memory",
      "providers",
    ];

    for (const region of regionOrder) {
      const content = this.regions.get(region);
      if (content) {
        console.log(content);
        console.log(); // Blank line
      }
    }

    console.log(chalk.gray(`Last update: ${new Date().toLocaleTimeString()}`));
  }
}
