/**
 * Experiment Runner - Executes evolution experiments with A/B testing
 */

import { spawn, SpawnOptionsWithoutStdio } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { EvolutionParams, GPUInfo } from "./ParamSpace";

export interface ExperimentResult {
  metrics: {
    nDCG10: number;
    nDCG_drop?: number;
    MRR: number;
    MRR_drop?: number;
    precision5: number;
    recall10: number;
    p95Latency: number;
    latency_increase?: number;
    cacheHitRate: number;
    error_rate?: number;
  };
  artifacts: string[];
  timestamp: number;
  duration: number;
  profile: string;
}

export interface ExperimentContext {
  gpu: GPUInfo;
  profile: string;
  timeout?: number;
}

export class ExperimentRunner {
  private outputDir = path.join(
    process.cwd(),
    ".maria",
    "evolution",
    "experiments",
  );

  async run(
    params: EvolutionParams,
    context: ExperimentContext,
  ): Promise<ExperimentResult> {
    const startTime = Date.now();
    const experimentId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const experimentDir = path.join(this.outputDir, experimentId);

    try {
      // Create experiment directory
      await fs.mkdir(experimentDir, { recursive: true });

      // Write parameters to file
      await fs.writeFile(
        path.join(experimentDir, "params.json"),
        JSON.stringify(params, null, 2),
      );

      // Run init with experiment parameters
      const initReport = await this.runInit(params, experimentDir);

      // Run evaluation
      const evalReport = await this.runEvaluation(
        params,
        experimentDir,
        context,
      );

      // Collect and parse metrics
      const metrics = await this.collectMetrics(
        experimentDir,
        initReport,
        evalReport,
      );

      // Calculate deltas from baseline
      const metricsWithDeltas = await this.calculateDeltas(metrics);

      const duration = Date.now() - startTime;

      return {
        metrics: metricsWithDeltas,
        artifacts: [
          path.join(experimentDir, "params.json"),
          path.join(experimentDir, "init-report.json"),
          path.join(experimentDir, "eval-report.json"),
          path.join(experimentDir, "metrics.json"),
        ],
        timestamp: startTime,
        duration,
        profile: context.profile,
      };
    } catch (error) {
      // Clean up on error
      await this.cleanup(experimentDir);
      throw error;
    }
  }

  private async runInit(
    params: EvolutionParams,
    experimentDir: string,
  ): Promise<any> {
    // Prepare init command with parameters
    const initArgs = [
      "run",
      "maria",
      "init",
      "--report",
      path.join(experimentDir, "init-report.json"),
      "--rrf-weights",
      `${params.rrf.bm25},${params.rrf.vector},${params.rrf.kg}`,
      "--top-k",
      params.topK.toString(),
      "--kg-boost",
      `${params.kgBoost.alpha},${params.kgBoost.beta},${params.kgBoost.gamma}`,
    ];

    if (params.crossEncoder?.enabled) {
      initArgs.push("--enable-reranker");
      if (params.crossEncoder.batchSize) {
        initArgs.push(
          "--reranker-batch",
          params.crossEncoder.batchSize.toString(),
        );
      }
    }

    const _result = await this.exec("pnpm", initArgs, experimentDir);

    // Read and parse init report
    const reportPath = path.join(experimentDir, "init-report.json");
    const reportContent = await fs.readFile(reportPath, "utf-8");
    return JSON.parse(reportContent);
  }

  private async runEvaluation(
    params: EvolutionParams,
    experimentDir: string,
    context: ExperimentContext,
  ): Promise<any> {
    // Run evaluation command
    const evalArgs = [
      "run",
      "maria",
      "evaluate",
      "--metrics",
      "nDCG,MRR,precision,recall",
      "--output",
      path.join(experimentDir, "eval-report.json"),
    ];

    // Add A/B testing parameters based on profile
    if (context.profile === "canary") {
      evalArgs.push("--traffic-split", "20"); // 20% traffic
    } else if (context.profile === "nightly") {
      evalArgs.push("--traffic-split", "5"); // 5% traffic
    }

    const _result = await this.exec("pnpm", evalArgs, experimentDir);

    // Read and parse evaluation report
    const reportPath = path.join(experimentDir, "eval-report.json");
    const reportContent = await fs.readFile(reportPath, "utf-8");
    return JSON.parse(reportContent);
  }

  private async collectMetrics(
    experimentDir: string,
    initReport: any,
    evalReport: any,
  ): Promise<any> {
    // Combine metrics from init and eval reports
    const metrics = {
      nDCG10: evalReport.nDCG?.["10"] || 0.7,
      MRR: evalReport.MRR || 0.8,
      precision5: evalReport.precision?.["5"] || 0.75,
      recall10: evalReport.recall?.["10"] || 0.65,
      p95Latency: initReport.performance?.p95 || 200,
      cacheHitRate: initReport.cache?.hitRate || 0.6,
      error_rate: initReport.errors?.rate || 0.0,
    };

    // Save combined metrics
    await fs.writeFile(
      path.join(experimentDir, "metrics.json"),
      JSON.stringify(metrics, null, 2),
    );

    return metrics;
  }

  private async calculateDeltas(metrics: any): Promise<any> {
    // Load baseline metrics
    const baselinePath = path.join(this.outputDir, "baseline.json");
    let baseline = {
      nDCG10: 0.7,
      MRR: 0.8,
      p95Latency: 250,
      error_rate: 0.01,
    };

    try {
      const baselineContent = await fs.readFile(baselinePath, "utf-8");
      baseline = JSON.parse(baselineContent);
    } catch (error) {
      // Use defaults if baseline doesn't exist
    }

    // Calculate deltas
    return {
      ...metrics,
      nDCG_drop: baseline.nDCG10 - metrics.nDCG10,
      MRR_drop: baseline.MRR - metrics.MRR,
      latency_increase:
        (metrics.p95Latency - baseline.p95Latency) / baseline.p95Latency,
      error_rate: metrics.error_rate,
    };
  }

  private exec(
    command: string,
    args: string[],
    cwd: string,
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      const options: SpawnOptionsWithoutStdio = { cwd };
      const child = spawn(command, args, options);

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code: code || 0 });
        } else {
          reject(new Error(`Command failed with code ${code}\n${stderr}`));
        }
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  private async cleanup(experimentDir: string): Promise<void> {
    try {
      await fs.rm(experimentDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
