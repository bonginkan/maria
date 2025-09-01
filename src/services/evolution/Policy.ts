/**
 * Evolution Policy Manager - Controls safety and optimization strategies
 */

import * as fs from "fs/promises";
import * as path from "path";
import { StateStore } from "./StateStore";

export interface EvolutionPolicy {
  version: string;
  profiles: {
    nightly?: ProfileConfig;
    canary?: ProfileConfig;
    aggressive?: ProfileConfig;
  };
  exploration: {
    method: "grid_search" | "random_search" | "bayesian_optimization";
    acquisition?:
      | "expected_improvement"
      | "probability_improvement"
      | "upper_confidence_bound";
    surrogate?: "gaussian_process" | "random_forest";
    initialSamples?: number;
    explorationRate?: number;
  };
  safety: {
    requireApprovalFor: string[];
    maxDailyExperiments: number;
    maxHourlyExperiments?: number;
    minExperimentInterval?: number;
    maxConcurrentExperiments?: number;
    maxConsecutiveFailures?: number;
    rollbackThreshold: {
      consecutive_failures?: number;
      quality_degradation?: number;
      latency_increase?: number;
      error_rate?: number;
    };
    blastRadius?: {
      nightly?: number;
      canary?: number;
      aggressive?: number;
    };
  };
  gpu?: {
    optimization?: {
      enableWhenAvailable?: boolean;
      quantization?: string[];
      dynamicBatching?: boolean;
      memoryThreshold?: number;
    };
    fallback?: {
      disableReranker?: boolean;
      reduceTopK?: number;
      increaseCacheTTL?: number;
    };
  };
  languages?: {
    optimizationEnabled?: boolean;
    individualThresholds?: boolean;
    crossLingualTransfer?: boolean;
  };
}

export interface ProfileConfig {
  schedule?: string;
  maxExperiments?: number;
  trafficPercentage?: number;
  explorationRate?: number;
}

export interface SearchEvolutionParams {
  rrf?: {
    bm25?: [number, number];
    vector?: [number, number];
    kg?: [number, number];
  };
  topK?: [number, number];
  kgBoost?: {
    alpha?: [number, number];
    beta?: [number, number];
    gamma?: [number, number];
  };
  crossEncoder?: {
    enabled?: boolean;
    batchSize?: [number, number];
    topN?: [number, number];
  };
}

export interface LanguageEvolutionParams {
  [lang: string]: {
    bm25: number;
    vector: number;
    kg: number;
  };
}

export class Policy {
  private configPath = path.join(
    process.cwd(),
    "config",
    "evolution-policy.json",
  );
  private cache: EvolutionPolicy | null = null;

  async load(): Promise<EvolutionPolicy> {
    if (this.cache) return this.cache;

    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      this.cache = JSON.parse(content);
      return this.cache!;
    } catch (error) {
      // Return default policy if file doesn't exist
      return this.getDefaultPolicy();
    }
  }

  async save(policy: EvolutionPolicy): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(policy, null, 2));
    this.cache = policy;
  }

  canRunMoreExperiments(store: StateStore, policy: EvolutionPolicy): boolean {
    const safety = policy.safety;
    const history = store.getHistory(1); // Last 24 hours

    // Check daily limit
    if (history.experiments.length >= safety.maxDailyExperiments) {
      return false;
    }

    // Check hourly limit
    if (safety.maxHourlyExperiments) {
      const lastHour = store.getHistory(0.042); // ~1 hour
      if (lastHour.experiments.length >= safety.maxHourlyExperiments) {
        return false;
      }
    }

    // Check minimum interval
    if (safety.minExperimentInterval) {
      const lastExperiment = store.getLastExperiment();
      if (lastExperiment) {
        const timeSince = Date.now() - lastExperiment.timestamp;
        if (timeSince < safety.minExperimentInterval * 1000) {
          return false;
        }
      }
    }

    return true;
  }

  passThreshold(metrics: any, policy: EvolutionPolicy): boolean {
    const threshold = policy.safety.rollbackThreshold;

    // Check quality degradation
    if (
      threshold.quality_degradation &&
      metrics.nDCG_drop > threshold.quality_degradation
    ) {
      return false;
    }

    // Check latency increase
    if (
      threshold.latency_increase &&
      metrics.latency_increase > threshold.latency_increase
    ) {
      return false;
    }

    // Check error rate
    if (threshold.error_rate && metrics.error_rate > threshold.error_rate) {
      return false;
    }

    return true;
  }

  requiresApproval(params: any, policy: EvolutionPolicy): boolean {
    const requireApprovalFor = policy.safety.requireApprovalFor || [];

    // Check if any parameter change requires approval
    if (
      params.analyzerChange &&
      requireApprovalFor.includes("analyzerChange")
    ) {
      return true;
    }

    if (
      params.indexSchemaChange &&
      requireApprovalFor.includes("indexSchemaChange")
    ) {
      return true;
    }

    if (params.modelUpdate && requireApprovalFor.includes("modelUpdate")) {
      return true;
    }

    // Check for major weight shifts (>20%)
    if (requireApprovalFor.includes("majorWeightShift")) {
      const weightChange = this.calculateWeightChange(params);
      if (weightChange > 0.2) {
        return true;
      }
    }

    return false;
  }

  private calculateWeightChange(params: any): number {
    // Calculate the maximum weight change
    let maxChange = 0;

    if (params.rrf) {
      if (params.rrf.bm25_delta)
        maxChange = Math.max(maxChange, Math.abs(params.rrf.bm25_delta));
      if (params.rrf.vector_delta)
        maxChange = Math.max(maxChange, Math.abs(params.rrf.vector_delta));
      if (params.rrf.kg_delta)
        maxChange = Math.max(maxChange, Math.abs(params.rrf.kg_delta));
    }

    return maxChange;
  }

  private getDefaultPolicy(): EvolutionPolicy {
    return {
      version: "1.0.0",
      profiles: {
        nightly: {
          schedule: "0 3 * * *",
          maxExperiments: 3,
          trafficPercentage: 5,
          explorationRate: 0.1,
        },
        canary: {
          schedule: "*/30 * * * *",
          maxExperiments: 5,
          trafficPercentage: 20,
          explorationRate: 0.15,
        },
        aggressive: {
          schedule: "*/10 * * * *",
          maxExperiments: 10,
          trafficPercentage: 100,
          explorationRate: 0.25,
        },
      },
      exploration: {
        method: "bayesian_optimization",
        acquisition: "expected_improvement",
        surrogate: "gaussian_process",
        initialSamples: 10,
        explorationRate: 0.15,
      },
      safety: {
        requireApprovalFor: [
          "analyzerChange",
          "indexSchemaChange",
          "modelUpdate",
          "majorWeightShift",
        ],
        maxDailyExperiments: 5,
        maxHourlyExperiments: 1,
        minExperimentInterval: 600,
        maxConcurrentExperiments: 1,
        maxConsecutiveFailures: 3,
        rollbackThreshold: {
          consecutive_failures: 3,
          quality_degradation: 0.02,
          latency_increase: 0.2,
          error_rate: 0.05,
        },
        blastRadius: {
          nightly: 0.05,
          canary: 0.2,
          aggressive: 1.0,
        },
      },
      gpu: {
        optimization: {
          enableWhenAvailable: true,
          quantization: ["fp16", "int8"],
          dynamicBatching: true,
          memoryThreshold: 0.85,
        },
        fallback: {
          disableReranker: true,
          reduceTopK: 0.5,
          increaseCacheTTL: 2.0,
        },
      },
      languages: {
        optimizationEnabled: true,
        individualThresholds: true,
        crossLingualTransfer: false,
      },
    };
  }
}
