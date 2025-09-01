/**
 * State Store - Manages evolution history and current state
 */

import * as fs from "fs/promises";
import * as path from "path";
import { EvolutionParams } from "./ParamSpace";
import { ExperimentResult } from "./ExperimentRunner";

export interface Experiment {
  id: string;
  timestamp: number;
  params: EvolutionParams;
  result: ExperimentResult;
  status: "success" | "failure" | "pending";
  approvalId?: string;
}

export interface EvolutionState {
  version: string;
  currentParams: EvolutionParams;
  lastStableVersion: string;
  experiments: Experiment[];
  consecutiveFailures: number;
  metrics: {
    current: any;
    baseline: any;
    history: Array<{ timestamp: number; metrics: any }>;
  };
}

export class StateStore {
  private statePath = path.join(
    process.cwd(),
    ".maria",
    "evolution",
    "state.json",
  );
  private state: EvolutionState | null = null;

  async load(): Promise<EvolutionState> {
    if (this.state) return this.state;

    try {
      const content = await fs.readFile(this.statePath, "utf-8");
      this.state = JSON.parse(content);
      return this.state!;
    } catch (error) {
      // Initialize default state
      this.state = this.getDefaultState();
      await this.save();
      return this.state;
    }
  }

  async save(): Promise<void> {
    if (!this.state) return;

    const dir = path.dirname(this.statePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
  }

  getCurrentParams(): EvolutionParams {
    if (!this.state) this.load();
    return this.state?.currentParams || this.getDefaultParams();
  }

  async getCurrentMetrics(): Promise<any> {
    await this.load();
    return this.state?.metrics.current || {};
  }

  getLastStableVersion(): string {
    return this.state?.lastStableVersion || "v1.0.0";
  }

  getCurrentVersion(): string {
    return this.state?.version || "v1.0.0";
  }

  getHistory(days: number): { experiments: Experiment[] } {
    if (!this.state) return { experiments: [] };

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const experiments = this.state.experiments.filter(
      (exp) => exp.timestamp >= cutoff,
    );

    return { experiments };
  }

  getLastExperiment(): Experiment | null {
    if (!this.state || this.state.experiments.length === 0) return null;
    return this.state.experiments[this.state.experiments.length - 1];
  }

  getConsecutiveFailures(): number {
    return this.state?.consecutiveFailures || 0;
  }

  async logSuccess(
    params: EvolutionParams,
    result: ExperimentResult,
  ): Promise<void> {
    await this.load();

    const experiment: Experiment = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      params,
      result,
      status: "success",
    };

    this.state!.experiments.push(experiment);
    this.state!.currentParams = params;
    this.state!.lastStableVersion = this.state!.version;
    this.state!.version = this.incrementVersion(this.state!.version);
    this.state!.consecutiveFailures = 0;
    this.state!.metrics.current = result.metrics;

    // Add to history
    this.state!.metrics.history.push({
      timestamp: Date.now(),
      metrics: result.metrics,
    });

    // Keep only last 30 days of history
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.state!.metrics.history = this.state!.metrics.history.filter(
      (h) => h.timestamp >= cutoff,
    );

    await this.save();
  }

  async logFailure(
    params: EvolutionParams,
    result: ExperimentResult,
  ): Promise<void> {
    await this.load();

    const experiment: Experiment = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      params,
      result,
      status: "failure",
    };

    this.state!.experiments.push(experiment);
    this.state!.consecutiveFailures++;

    await this.save();
  }

  async logPending(
    params: EvolutionParams,
    result: ExperimentResult,
    approvalId: string,
  ): Promise<void> {
    await this.load();

    const experiment: Experiment = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      params,
      result,
      status: "pending",
      approvalId,
    };

    this.state!.experiments.push(experiment);

    await this.save();
  }

  private incrementVersion(version: string): string {
    const parts = version.split(".");
    const patch = parseInt(parts[2] || "0") + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private getDefaultState(): EvolutionState {
    const defaultParams = this.getDefaultParams();

    return {
      version: "v1.0.0",
      currentParams: defaultParams,
      lastStableVersion: "v1.0.0",
      experiments: [],
      consecutiveFailures: 0,
      metrics: {
        current: {
          nDCG10: 0.7,
          MRR: 0.8,
          precision5: 0.75,
          recall10: 0.65,
          p95Latency: 250,
          cacheHitRate: 0.6,
          error_rate: 0.01,
        },
        baseline: {
          nDCG10: 0.7,
          MRR: 0.8,
          precision5: 0.75,
          recall10: 0.65,
          p95Latency: 250,
          cacheHitRate: 0.6,
          error_rate: 0.01,
        },
        history: [],
      },
    };
  }

  private getDefaultParams(): EvolutionParams {
    return {
      rrf: {
        bm25: 0.4,
        vector: 0.4,
        kg: 0.2,
      },
      topK: 50,
      kgBoost: {
        alpha: 0.2,
        beta: 0.4,
        gamma: 0.1,
      },
      cache: {
        ttl: 300,
        maxSize: 1000,
      },
    };
  }
}
