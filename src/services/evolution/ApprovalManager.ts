/**
 * Approval Manager - Handles human-in-the-loop approvals
 */

import * as fs from "fs/promises";
import * as path from "path";
import { EvolutionParams } from "./ParamSpace";
import { ExperimentResult } from "./ExperimentRunner";

export interface ApprovalRequest {
  id: string;
  timestamp: number;
  params: EvolutionParams;
  result: ExperimentResult;
  profile: string;
  status: "pending" | "approved" | "rejected";
  approver?: string;
  approvalTime?: number;
  reason?: string;
}

export class ApprovalManager {
  private approvalsPath = path.join(
    process.cwd(),
    ".maria",
    "evolution",
    "approvals.json",
  );
  private approvals: Map<string, ApprovalRequest> = new Map();

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.approvalsPath, "utf-8");
      const data = JSON.parse(content);
      this.approvals = new Map(Object.entries(data));
    } catch (error) {
      // Start with empty approvals
      this.approvals = new Map();
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.approvalsPath);
    await fs.mkdir(dir, { recursive: true });

    const data = Object.fromEntries(this.approvals);
    await fs.writeFile(this.approvalsPath, JSON.stringify(data, null, 2));
  }

  /**
   * Request approval for a change
   */
  async request(options: {
    params: EvolutionParams;
    result: ExperimentResult;
    profile: string;
  }): Promise<ApprovalRequest> {
    await this.load();

    const request: ApprovalRequest = {
      id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      params: options.params,
      result: options.result,
      profile: options.profile,
      status: "pending",
    };

    this.approvals.set(request.id, request);
    await this.save();

    // Trigger notification (Slack, GitHub, etc.)
    await this.notify(request);

    return request;
  }

  /**
   * Approve a pending request
   */
  async approve(id: string, approver: string): Promise<void> {
    await this.load();

    const request = this.approvals.get(id);
    if (!request) {
      throw new Error(`Approval request ${id} not found`);
    }

    if (request.status !== "pending") {
      throw new Error(`Approval request ${id} is not pending`);
    }

    request.status = "approved";
    request.approver = approver;
    request.approvalTime = Date.now();

    await this.save();
  }

  /**
   * Reject a pending request
   */
  async reject(id: string, approver: string, reason?: string): Promise<void> {
    await this.load();

    const request = this.approvals.get(id);
    if (!request) {
      throw new Error(`Approval request ${id} not found`);
    }

    if (request.status !== "pending") {
      throw new Error(`Approval request ${id} is not pending`);
    }

    request.status = "rejected";
    request.approver = approver;
    request.approvalTime = Date.now();
    request.reason = reason;

    await this.save();
  }

  /**
   * Get all pending approvals
   */
  async getPending(): Promise<ApprovalRequest[]> {
    await this.load();

    return Array.from(this.approvals.values())
      .filter((req) => req.status === "pending")
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get approval by ID
   */
  async get(id: string): Promise<ApprovalRequest | undefined> {
    await this.load();
    return this.approvals.get(id);
  }

  /**
   * Check if an approval is approved
   */
  async isApproved(id: string): Promise<boolean> {
    const request = await this.get(id);
    return request?.status === "approved";
  }

  /**
   * Clean old approvals (> 30 days)
   */
  async cleanup(): Promise<void> {
    await this.load();

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const toDelete: string[] = [];

    for (const [id, request] of this.approvals) {
      if (request.timestamp < cutoff && request.status !== "pending") {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.approvals.delete(id);
    }

    await this.save();
  }

  private async notify(request: ApprovalRequest): Promise<void> {
    // Format approval message
    const message = this.formatApprovalMessage(request);

    // Try multiple notification channels
    await Promise.allSettled([
      this.notifySlack(message),
      this.notifyGitHub(message),
      this.notifyEmail(message),
    ]);
  }

  private formatApprovalMessage(request: ApprovalRequest): string {
    const metrics = request.result.metrics;

    return `
🔔 **Evolution Approval Required**

**ID**: ${request.id}
**Profile**: ${request.profile}
**Timestamp**: ${new Date(request.timestamp).toISOString()}

**Proposed Changes**:
- RRF Weights: BM25=${request.params.rrf.bm25}, Vector=${request.params.rrf.vector}, KG=${request.params.rrf.kg}
- TopK: ${request.params.topK}
- KG Boost: α=${request.params.kgBoost.alpha}, β=${request.params.kgBoost.beta}, γ=${request.params.kgBoost.gamma}
${request.params.crossEncoder?.enabled ? `- Cross-Encoder: Enabled (batch=${request.params.crossEncoder.batchSize})` : "- Cross-Encoder: Disabled"}

**Performance Metrics**:
- nDCG@10: ${metrics.nDCG10.toFixed(3)} (${metrics.nDCG_drop ? (metrics.nDCG_drop > 0 ? "-" : "+") + Math.abs(metrics.nDCG_drop).toFixed(3) : "baseline"})
- MRR: ${metrics.MRR.toFixed(3)} (${metrics.MRR_drop ? (metrics.MRR_drop > 0 ? "-" : "+") + Math.abs(metrics.MRR_drop).toFixed(3) : "baseline"})
- P95 Latency: ${metrics.p95Latency}ms (${metrics.latency_increase ? (metrics.latency_increase > 0 ? "+" : "") + (metrics.latency_increase * 100).toFixed(1) + "%" : "baseline"})
- Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%

**To Approve**: Run \`maria evolve approve ${request.id}\`
**To Reject**: Run \`maria evolve reject ${request.id}\`
`.trim();
  }

  private async notifySlack(message: string): Promise<void> {
    // TODO: Implement Slack notification
    // For now, just log to console
    console.log("\n📢 Slack Notification:\n", message);
  }

  private async notifyGitHub(message: string): Promise<void> {
    // TODO: Implement GitHub issue/PR creation
    // For now, just log to console
    console.log("\n📝 GitHub Notification:\n", message);
  }

  private async notifyEmail(message: string): Promise<void> {
    // TODO: Implement email notification
    // For now, just log to console
    console.log("\n📧 Email Notification:\n", message);
  }
}
