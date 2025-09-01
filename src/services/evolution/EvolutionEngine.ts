/**
 * Evolution Engine - Core autonomous optimization system for MARIA v3.2.3
 * Implements PDCA/OODA loop for continuous self-improvement
 */

import { EventEmitter } from "node:events";
import { Policy, EvolutionPolicy } from "./Policy";
import { ParamSpace, EvolutionParams } from "./ParamSpace";
import { ExperimentRunner, ExperimentResult } from "./ExperimentRunner";
import { Actuators } from "./Actuators";
import { Rollback } from "./Rollback";
import { StateStore } from "./StateStore";
import { GPUAdvisor } from "./GPUAdvisor";
import { ApprovalManager } from "./ApprovalManager";

export type EvolutionProfile = "nightly" | "canary" | "aggressive";

export interface EvolutionStatus {
  status: "improved" | "pending_approval" | "failed" | "noop";
  params?: EvolutionParams;
  result?: ExperimentResult;
  reason?: string;
}

export class EvolutionEngine extends EventEmitter {
  private policy: Policy;
  private store: StateStore;
  private experimentRunner: ExperimentRunner;
  private actuators: Actuators;
  private rollback: Rollback;
  private gpuAdvisor: GPUAdvisor;
  private approvalManager: ApprovalManager;
  private isRunning = false;
  private currentProfile: EvolutionProfile = "nightly";

  constructor() {
    super();
    this.policy = new Policy();
    this.store = new StateStore();
    this.experimentRunner = new ExperimentRunner();
    this.actuators = new Actuators();
    this.rollback = new Rollback(this.store);
    this.gpuAdvisor = new GPUAdvisor();
    this.approvalManager = new ApprovalManager();
  }

  /**
   * Main evolution loop tick - PDCA/OODA implementation
   */
  async tick(profile: EvolutionProfile = "nightly"): Promise<EvolutionStatus> {
    this.currentProfile = profile;

    try {
      // Observe: Collect current metrics and state
      const _currentMetrics = await this.store.getCurrentMetrics();
      const gpuInfo = await this.gpuAdvisor.detect();
      const baseParams = this.store.getCurrentParams();

      // Orient: Generate experiment candidates based on policy
      const policyConfig = await this.policy.load();
      const candidates = ParamSpace.suggestCandidates(
        baseParams,
        policyConfig,
        gpuInfo,
        profile,
      );

      // Check rate limits
      if (!this.policy.canRunMoreExperiments(this.store, policyConfig)) {
        return { status: "noop", reason: "Rate limit exceeded" };
      }

      // Decide & Act: Run experiments
      for (const params of candidates) {
        this.emit("experiment:start", params);

        // Apply parameters temporarily
        await this.actuators.applyParameters(params, { dryRun: true });

        // Run experiment
        const result = await this.experimentRunner.run(params, {
          gpu: gpuInfo,
          profile,
        });

        // Evaluate: Check thresholds
        const passed = this.policy.passThreshold(result.metrics, policyConfig);

        if (passed) {
          // Check if approval needed
          if (this.policy.requiresApproval(params, policyConfig)) {
            await this.handleApprovalRequired(params, result);
            return {
              status: "pending_approval",
              params,
              result,
              reason: "Approval required for changes",
            };
          }

          // Commit successful changes
          await this.commitChanges(params, result);
          return { status: "improved", params, result };
        } else {
          // Rollback failed experiment
          await this.handleFailure(params, result, policyConfig);
          return {
            status: "failed",
            params,
            result,
            reason: "Threshold check failed",
          };
        }
      }

      return { status: "noop", reason: "No candidates to test" };
    } catch (error) {
      this.emit("error", error);
      await this.emergencyRollback();
      throw error;
    }
  }

  /**
   * Start autonomous evolution loop
   */
  async start(profile: EvolutionProfile = "nightly"): Promise<void> {
    if (this.isRunning) {
      throw new Error("Evolution engine already running");
    }

    this.isRunning = true;
    this.currentProfile = profile;
    this.emit("start", profile);

    const policyConfig = await this.policy.load();
    const schedule = this.getSchedule(profile, policyConfig);

    // Run evolution loop based on schedule
    while (this.isRunning) {
      await this.tick(profile);
      await this.sleep(schedule.intervalMs);
    }
  }

  /**
   * Stop evolution loop
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.emit("stop");
  }

  /**
   * Get current evolution status
   */
  async getStatus(): Promise<any> {
    return {
      running: this.isRunning,
      profile: this.currentProfile,
      currentParams: this.store.getCurrentParams(),
      metrics: await this.store.getCurrentMetrics(),
      history: this.store.getHistory(7), // Last 7 days
      pendingApprovals: await this.approvalManager.getPending(),
      gpu: await this.gpuAdvisor.detect(),
    };
  }

  /**
   * Get planned experiments
   */
  async getPlan(): Promise<EvolutionParams[]> {
    const policyConfig = await this.policy.load();
    const gpuInfo = await this.gpuAdvisor.detect();
    const baseParams = this.store.getCurrentParams();

    return ParamSpace.suggestCandidates(
      baseParams,
      policyConfig,
      gpuInfo,
      this.currentProfile,
    );
  }

  /**
   * Revert to previous version
   */
  async revert(version?: string): Promise<void> {
    const targetVersion = version || this.store.getLastStableVersion();
    await this.rollback.revertTo(targetVersion);
    this.emit("revert", targetVersion);
  }

  private async commitChanges(
    params: EvolutionParams,
    result: ExperimentResult,
  ): Promise<void> {
    await this.actuators.commitParameters(params);
    this.store.logSuccess(params, result);
    this.emit("commit", { params, result });
  }

  private async handleFailure(
    params: EvolutionParams,
    result: ExperimentResult,
    policy: EvolutionPolicy,
  ): Promise<void> {
    await this.rollback.revertTo(this.store.getLastStableVersion());
    this.store.logFailure(params, result);
    this.emit("rollback", { params, result });

    // Check if we need to trigger emergency stop
    if (
      this.store.getConsecutiveFailures() >=
      (policy.safety?.maxConsecutiveFailures || 3)
    ) {
      await this.stop();
      this.emit("emergency:stop", "Too many consecutive failures");
    }
  }

  private async handleApprovalRequired(
    params: EvolutionParams,
    result: ExperimentResult,
  ): Promise<void> {
    const approval = await this.approvalManager.request({
      params,
      result,
      profile: this.currentProfile,
    });

    this.store.logPending(params, result, approval.id);
    this.emit("approval:required", approval);
  }

  private async emergencyRollback(): Promise<void> {
    await this.rollback.emergency();
    await this.stop();
    this.emit("emergency:rollback");
  }

  private getSchedule(profile: EvolutionProfile, policy: EvolutionPolicy): any {
    const profiles = policy.profiles || {};
    return (
      profiles[profile] || {
        intervalMs: 3600000, // Default 1 hour
      }
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
