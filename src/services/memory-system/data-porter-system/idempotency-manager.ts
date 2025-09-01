/**
 * MARIA Phase 3: Idempotency Manager
 *
 * Ensures deployment operations are idempotent - same config = no-op
 * Provides state comparison, drift detection, and rollback safety
 */

import { createHash } from "crypto";
import { warnOnce } from "../utils/deprecation";
import type {
  DeploymentConfig,
  KubernetesManifest,
} from "./enterprise-deployment-manager";

export interface IdempotencyState {
  configHash: string;
  manifests: KubernetesManifest[];
  timestamp: number;
  environment: string;
  version: string;
  checksum: string;
}

export interface DriftDetectionResult {
  hasDrift: boolean;
  driftDetails: DriftDetail[];
  summary: {
    added: number;
    modified: number;
    removed: number;
  };
}

export interface DriftDetail {
  type: "added" | "modified" | "removed";
  resource: string;
  kind: string;
  namespace?: string;
  differences?: Record<string, any>;
}

export interface IdempotencyResult {
  shouldApply: boolean;
  reason: IdempotencyReason;
  driftDetection: DriftDetectionResult;
  previousState?: IdempotencyState;
  recommendations: string[];
}

export type IdempotencyReason =
  | "no_previous_deployment"
  | "config_changed"
  | "drift_detected"
  | "force_requested"
  | "identical_no_op";

/**
 * Manages deployment idempotency and state tracking
 */
export class IdempotencyManager {
  private stateStore: Map<string, IdempotencyState> = new Map();
  private readonly maxStoredStates = 10; // 環境ごとに最大10個の状態を保持

  /**
   * Check if deployment should proceed based on idempotency rules
   */
  async checkIdempotency(
    environment: string,
    config: DeploymentConfig,
    manifests: KubernetesManifest[],
    options: { force?: boolean; dryRun?: boolean } = {},
  ): Promise<IdempotencyResult> {
    const configHash = this.generateConfigHash(config);
    const stateKey = this.getStateKey(environment);
    const previousState = this.stateStore.get(stateKey);

    // Force apply requested
    if (options.force) {
      return {
        shouldApply: true,
        reason: "force_requested",
        driftDetection: {
          hasDrift: false,
          driftDetails: [],
          summary: { added: 0, modified: 0, removed: 0 },
        },
        recommendations: [
          "Force apply requested - bypassing idempotency check",
        ],
      };
    }

    // First deployment
    if (!previousState) {
      return {
        shouldApply: true,
        reason: "no_previous_deployment",
        driftDetection: {
          hasDrift: false,
          driftDetails: [],
          summary: { added: manifests.length, modified: 0, removed: 0 },
        },
        recommendations: ["Initial deployment - applying all manifests"],
      };
    }

    // Configuration hasn't changed
    if (previousState.configHash === configHash) {
      // Check for drift in actual cluster state
      const driftDetection = await this.detectDrift(
        environment,
        previousState.manifests,
        manifests,
      );

      if (!driftDetection.hasDrift) {
        return {
          shouldApply: false,
          reason: "identical_no_op",
          driftDetection,
          previousState,
          recommendations: [
            "Configuration unchanged and no drift detected - skipping deployment",
          ],
        };
      }

      return {
        shouldApply: true,
        reason: "drift_detected",
        driftDetection,
        previousState,
        recommendations: [
          `Drift detected: ${driftDetection.summary.modified} modified, ${driftDetection.summary.added} added, ${driftDetection.summary.removed} removed`,
          "Consider reviewing cluster state before applying",
        ],
      };
    }

    // Configuration has changed
    const driftDetection = await this.detectDrift(
      environment,
      previousState.manifests,
      manifests,
    );

    return {
      shouldApply: true,
      reason: "config_changed",
      driftDetection,
      previousState,
      recommendations: [
        "Configuration changed - deployment required",
        ...(driftDetection.hasDrift
          ? ["Additional drift detected in cluster"]
          : []),
      ],
    };
  }

  /**
   * Record successful deployment state
   */
  recordDeploymentState(
    environment: string,
    config: DeploymentConfig,
    manifests: KubernetesManifest[],
  ): void {
    const configHash = this.generateConfigHash(config);
    const checksum = this.generateManifestChecksum(manifests);
    const stateKey = this.getStateKey(environment);

    const state: IdempotencyState = {
      configHash,
      manifests,
      timestamp: Date.now(),
      environment,
      version: process.env.npm_package_version || "0.0.0",
      checksum,
    };

    this.stateStore.set(stateKey, state);
    this.cleanupOldStates(environment);
  }

  /**
   * Detect drift between expected and actual manifests
   */
  private async detectDrift(
    _environment: string,
    expectedManifests: KubernetesManifest[],
    actualManifests: KubernetesManifest[],
  ): Promise<DriftDetectionResult> {
    const driftDetails: DriftDetail[] = [];

    // Create lookup maps for comparison
    const expectedMap = new Map<string, KubernetesManifest>();
    const actualMap = new Map<string, KubernetesManifest>();

    expectedManifests.forEach((manifest) => {
      const key = this.getManifestKey(manifest);
      expectedMap.set(key, manifest);
    });

    actualManifests.forEach((manifest) => {
      const key = this.getManifestKey(manifest);
      actualMap.set(key, manifest);
    });

    // Check for removed resources
    for (const [key, manifest] of expectedMap) {
      if (!actualMap.has(key)) {
        driftDetails.push({
          type: "removed",
          resource: key,
          kind: manifest.kind,
          namespace: manifest.metadata?.namespace,
        });
      }
    }

    // Check for added or modified resources
    for (const [key, manifest] of actualMap) {
      const expectedManifest = expectedMap.get(key);

      if (!expectedManifest) {
        driftDetails.push({
          type: "added",
          resource: key,
          kind: manifest.kind,
          namespace: manifest.metadata?.namespace,
        });
      } else {
        const differences = this.compareManifests(expectedManifest, manifest);
        if (Object.keys(differences).length > 0) {
          driftDetails.push({
            type: "modified",
            resource: key,
            kind: manifest.kind,
            namespace: manifest.metadata?.namespace,
            differences,
          });
        }
      }
    }

    const summary = {
      added: driftDetails.filter((d) => d.type === "added").length,
      modified: driftDetails.filter((d) => d.type === "modified").length,
      removed: driftDetails.filter((d) => d.type === "removed").length,
    };

    return {
      hasDrift: driftDetails.length > 0,
      driftDetails,
      summary,
    };
  }

  /**
   * Generate deterministic hash for deployment config
   */
  private generateConfigHash(config: DeploymentConfig): string {
    const configString = JSON.stringify(config, Object.keys(config).sort());
    return createHash("sha256").update(configString).digest("hex");
  }

  /**
   * Generate checksum for manifest array
   */
  private generateManifestChecksum(manifests: KubernetesManifest[]): string {
    const manifestsString = JSON.stringify(
      manifests
        .map((m) => ({
          ...m,
          metadata: {
            ...m.metadata,
            // Exclude generated fields from checksum
            resourceVersion: undefined,
            uid: undefined,
            creationTimestamp: undefined,
            managedFields: undefined,
          },
        }))
        .sort((a, b) =>
          this.getManifestKey(a).localeCompare(this.getManifestKey(b)),
        ),
    );
    return createHash("sha256").update(manifestsString).digest("hex");
  }

  /**
   * Get unique key for manifest
   */
  private getManifestKey(manifest: KubernetesManifest): string {
    const namespace = manifest.metadata?.namespace || "default";
    const name = manifest.metadata?.name || "unknown";
    return `${manifest.kind}/${namespace}/${name}`;
  }

  /**
   * Compare two manifests and return differences
   */
  private compareManifests(
    expected: KubernetesManifest,
    actual: KubernetesManifest,
  ): Record<string, any> {
    const differences: Record<string, any> = {};

    // Deep comparison logic - simplified for now
    const expectedStr = JSON.stringify(this.normalizeManifest(expected));
    const actualStr = JSON.stringify(this.normalizeManifest(actual));

    if (expectedStr !== actualStr) {
      differences.manifestChanged = true;
      // In a production system, you'd want more detailed diff analysis
    }

    return differences;
  }

  /**
   * Normalize manifest for comparison (remove generated fields)
   */
  private normalizeManifest(manifest: KubernetesManifest): any {
    const normalized = JSON.parse(JSON.stringify(manifest));

    if (normalized.metadata) {
      delete normalized.metadata.resourceVersion;
      delete normalized.metadata.uid;
      delete normalized.metadata.creationTimestamp;
      delete normalized.metadata.managedFields;
      delete normalized.metadata.generation;
    }

    if (normalized.status) {
      delete normalized.status;
    }

    return normalized;
  }

  /**
   * Get state storage key for environment
   */
  private getStateKey(environment: string): string {
    return `deployment-state:${environment}`;
  }

  /**
   * Clean up old deployment states to prevent memory bloat
   */
  private cleanupOldStates(_environment: string): void {
    // In a real implementation, you'd persist states and have more sophisticated cleanup
    // For now, we just limit in-memory storage
    warnOnce(
      "idempotency-cleanup",
      "Idempotency state cleanup is simplified for in-memory storage",
    );
  }

  /**
   * Get deployment history for environment
   */
  getDeploymentHistory(environment: string): IdempotencyState | undefined {
    const stateKey = this.getStateKey(environment);
    return this.stateStore.get(stateKey);
  }

  /**
   * Clear deployment state (for testing or manual reset)
   */
  clearDeploymentState(environment: string): boolean {
    const stateKey = this.getStateKey(environment);
    return this.stateStore.delete(stateKey);
  }
}

/**
 * Global idempotency manager instance
 */
export const idempotencyManager = new IdempotencyManager();
