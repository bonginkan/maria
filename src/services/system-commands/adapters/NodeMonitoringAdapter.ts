/**
 * NodeMonitoringAdapter
 *
 * MonitoringPortのNode.js実装
 * システムメトリクス収集・パフォーマンス測定の実装
 */

import * as os from "os";
import * as process from "process";
import {
  MonitoringPort,
  SystemMetricsSnapshot,
  CPUMetrics,
  MemoryMetrics,
  DiskMetrics,
  LatencyPercentiles,
  HealthSummary,
} from "../ports/MonitoringPort";

export class NodeMonitoringAdapter implements MonitoringPort {
  private metrics = new Map<string, number[]>();
  private events = new Map<
    string,
    Array<{ timestamp: number; tags?: Record<string, any> }>
  >();
  private latencies = new Map<string, number[]>();

  // メトリクス記録
  recordLatency(operation: string, ms: number): void {
    if (!this.latencies.has(operation)) {
      this.latencies.set(operation, []);
    }

    const latencies = this.latencies.get(operation)!;
    latencies.push(ms);

    // 直近1000件のみ保持(メモリ節約)
    if (latencies.length > 1000) {
      latencies.splice(0, latencies.length - 1000);
    }

    // 時系列データとしても記録
    this.recordValue(`${operation}.latency`, ms);
  }

  recordValue(
    metric: string,
    value: number,
    tags?: Record<string, string>,
  ): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }

    const values = this.metrics.get(metric)!;
    values.push(value);

    // 直近1000件のみ保持
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }
  }

  recordEvent(event: string, tags?: Record<string, any>): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    const events = this.events.get(event)!;
    events.push({ timestamp: Date.now(), tags });

    // 直近500件のみ保持
    if (events.length > 500) {
      events.splice(0, events.length - 500);
    }
  }

  // システムメトリクス取得
  async getSystemMetrics(timeoutMs?: number): Promise<SystemMetricsSnapshot> {
    const timeout = timeoutMs || 5000;

    return this.withTimeout(async () => {
      const [cpu, memory, disk] = await Promise.all([
        this.getCPUUsage(),
        this.getMemoryUsage(),
        this.getDiskUsage(),
      ]);

      return {
        cpu,
        memory,
        disk,
        timestamp: Date.now(),
      };
    }, timeout);
  }

  async getCPUUsage(): Promise<CPUMetrics> {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    // CPU使用率計算(簡易版)
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return {
      usage: Math.max(0, Math.min(100, usage)),
      cores: cpus.length,
      model: cpus[0]?.model || "Unknown",
      loadAverage: loadAvg,
    };
  }

  async getMemoryUsage(): Promise<MemoryMetrics> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();

    return {
      usage: (usedMem / totalMem) * 100,
      used: usedMem,
      total: totalMem,
      available: freeMem,
      process: {
        used: memUsage.rss,
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
      },
    };
  }

  async getDiskUsage(): Promise<DiskMetrics> {
    // Node.js標準ではディスク使用量取得が困難
    // 実装時は fs.statSync でファイルシステム情報を取得
    return {
      usage: 0, // TODO: 実装時に適切な値を設定
      cwd: process.cwd(),
      available: undefined,
      total: undefined,
    };
  }

  // パフォーマンス分析
  async getLatencyPercentiles(
    operation: string,
    windowMs?: number,
  ): Promise<LatencyPercentiles> {
    const latencies = this.latencies.get(operation) || [];

    if (latencies.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        count: 0,
        min: 0,
        max: 0,
      };
    }

    // 時間窓でフィルタリング(実装時はより効率的な方法を使用)
    let filteredLatencies = latencies;
    if (windowMs) {
      const cutoff = Date.now() - windowMs;
      // 簡易実装: 最新のデータのみ使用
      filteredLatencies = latencies.slice(
        -Math.max(1, Math.floor(latencies.length * 0.8)),
      );
    }

    const sorted = [...filteredLatencies].sort((a, b) => a - b);

    return {
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      count: sorted.length,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
    };
  }

  async getErrorRate(windowMs?: number): Promise<number> {
    const errorEvents = this.events.get("system.error") || [];
    const totalEvents = Array.from(this.events.values()).flat().length;

    if (totalEvents === 0) return 0;

    let relevantErrors = errorEvents;
    if (windowMs) {
      const cutoff = Date.now() - windowMs;
      relevantErrors = errorEvents.filter((e) => e.timestamp > cutoff);
    }

    return (relevantErrors.length / totalEvents) * 100;
  }

  // ヘルスチェック
  isHealthy(): boolean {
    // 簡易ヘルスチェック
    try {
      const memUsage = process.memoryUsage();
      const heapUsed = memUsage.heapUsed / memUsage.heapTotal;

      // ヒープ使用率が95%を超えたら不健康
      return heapUsed < 0.95;
    } catch {
      return false;
    }
  }

  getHealthSummary(): HealthSummary {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      // メモリチェック
      const memUsage = process.memoryUsage();
      const heapUsed = memUsage.heapUsed / memUsage.heapTotal;

      if (heapUsed > 0.9) {
        issues.push("High heap usage");
        recommendations.push(
          "Consider garbage collection or memory optimization",
        );
        score -= 20;
      } else if (heapUsed > 0.7) {
        issues.push("Moderate heap usage");
        score -= 10;
      }

      // CPU負荷チェック(簡易)
      const loadAvg = os.loadavg()[0]; // 1分平均
      const cpuCount = os.cpus().length;
      const loadRatio = loadAvg / cpuCount;

      if (loadRatio > 0.8) {
        issues.push("High CPU load");
        recommendations.push("Check for CPU-intensive operations");
        score -= 15;
      }
    } catch (error) {
      issues.push("Health check failed");
      score = 0;
    }

    const overall =
      score >= 80 ? "healthy" : score >= 60 ? "degraded" : "critical";

    return {
      overall,
      score: Math.max(0, score),
      issues,
      recommendations,
    };
  }

  // ユーティリティメソッド
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(resolve, reject)
        .finally(() => clearTimeout(timer));
    });
  }

  // デバッグ・監視用メソッド
  getMetricsSummary(): Record<string, any> {
    return {
      metrics: Array.from(this.metrics.keys()).map((key) => ({
        name: key,
        count: this.metrics.get(key)?.length || 0,
        latest: this.metrics.get(key)?.slice(-1)[0],
      })),
      events: Array.from(this.events.keys()).map((key) => ({
        name: key,
        count: this.events.get(key)?.length || 0,
        latest: this.events.get(key)?.slice(-1)[0]?.timestamp,
      })),
      latencies: Array.from(this.latencies.keys()).map((key) => {
        const values = this.latencies.get(key) || [];
        return {
          operation: key,
          count: values.length,
          avg:
            values.length > 0
              ? values.reduce((a, b) => a + b, 0) / values.length
              : 0,
          latest: values.slice(-1)[0],
        };
      }),
    };
  }

  clearMetrics(): void {
    this.metrics.clear();
    this.events.clear();
    this.latencies.clear();
  }
}
