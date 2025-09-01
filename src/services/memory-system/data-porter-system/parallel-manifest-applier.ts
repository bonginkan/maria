/**
 * MARIA Phase 3: Parallel Manifest Applier
 *
 * Optimizes manifest application through:
 * - Resource dependency analysis
 * - Intelligent batch processing
 * - Parallel execution with proper ordering
 */

import { EventEmitter } from "node:events";
import { warnOnce } from "../utils/deprecation";
import type {
  IManifestApplier,
  JobContext,
  K8sManifest,
  ApplyResult,
} from "./types";

export interface ApplyOptions {
  dryRun: boolean;
  force: boolean;
  waitForReady: boolean;
  timeout: number;
  maxConcurrency: number;
  batchSize: number;
}

export interface LocalApplyResult {
  success: boolean;
  appliedManifests: AppliedManifest[];
  duration: number;
  batchSummary: BatchSummary;
  errors: ApplyError[];
}

export interface AppliedManifest {
  manifest: KubernetesManifest;
  status: "success" | "failed" | "skipped";
  duration: number;
  batchIndex: number;
  error?: string;
}

export interface BatchSummary {
  totalBatches: number;
  parallelBatches: number;
  totalDuration: number;
  averageBatchDuration: number;
  concurrencyUtilization: number;
}

export interface ApplyError {
  manifest: KubernetesManifest;
  error: string;
  retryable: boolean;
}

export interface ResourceDependency {
  resource: string;
  dependsOn: string[];
  dependents: string[];
  priority: number;
  batchIndex: number;
}

/**
 * Resource dependency analyzer and batch optimizer
 */
class DependencyAnalyzer {
  private readonly dependencyRules: Map<string, string[]> = new Map([
    // Core resources first
    ["Namespace", []],
    ["CustomResourceDefinition", []],
    ["StorageClass", []],

    // RBAC resources
    ["ServiceAccount", ["Namespace"]],
    ["ClusterRole", []],
    ["ClusterRoleBinding", ["ServiceAccount", "ClusterRole"]],
    ["Role", ["Namespace"]],
    ["RoleBinding", ["ServiceAccount", "Role"]],

    // Configuration resources
    ["ConfigMap", ["Namespace"]],
    ["Secret", ["Namespace"]],

    // Storage resources
    ["PersistentVolume", ["StorageClass"]],
    ["PersistentVolumeClaim", ["Namespace", "PersistentVolume"]],

    // Core workload resources
    [
      "Deployment",
      [
        "Namespace",
        "ConfigMap",
        "Secret",
        "ServiceAccount",
        "PersistentVolumeClaim",
      ],
    ],
    ["Service", ["Namespace"]],
    ["DaemonSet", ["Namespace", "ConfigMap", "Secret", "ServiceAccount"]],
    [
      "StatefulSet",
      [
        "Namespace",
        "ConfigMap",
        "Secret",
        "ServiceAccount",
        "PersistentVolumeClaim",
      ],
    ],
    ["Job", ["Namespace", "ConfigMap", "Secret", "ServiceAccount"]],
    ["CronJob", ["Namespace", "ConfigMap", "Secret", "ServiceAccount"]],

    // Network resources
    ["NetworkPolicy", ["Namespace"]],
    ["Ingress", ["Service"]],

    // Autoscaling
    ["HorizontalPodAutoscaler", ["Deployment", "StatefulSet"]],
    ["VerticalPodAutoscaler", ["Deployment", "StatefulSet"]],

    // Monitoring
    ["ServiceMonitor", ["Service"]],
    ["PodMonitor", ["Deployment", "DaemonSet", "StatefulSet"]],
  ]);

  /**
   * Analyze manifest dependencies and create batches
   */
  analyzeDependencies(manifests: KubernetesManifest[]): ResourceDependency[] {
    const resources: ResourceDependency[] = [];
    const resourceMap = new Map<string, KubernetesManifest>();

    // Create resource lookup map
    manifests.forEach((manifest) => {
      const key = this.getResourceKey(manifest);
      resourceMap.set(key, manifest);
    });

    // Build dependency graph
    manifests.forEach((manifest) => {
      const key = this.getResourceKey(manifest);
      const dependsOn = this.resolveDependencies(manifest, resourceMap);

      resources.push({
        resource: key,
        dependsOn,
        dependents: [], // Will be populated in second pass
        priority: this.calculatePriority(manifest),
        batchIndex: 0, // Will be calculated later
      });
    });

    // Populate dependents (reverse dependencies)
    resources.forEach((resource) => {
      resource.dependsOn.forEach((depKey) => {
        const dependency = resources.find((r) => r.resource === depKey);
        if (dependency) {
          dependency.dependents.push(resource.resource);
        }
      });
    });

    return resources;
  }

  /**
   * Create execution batches based on dependencies
   */
  createBatches(dependencies: ResourceDependency[]): ResourceDependency[][] {
    const batches: ResourceDependency[][] = [];
    const processed = new Set<string>();
    let currentBatch = 0;

    while (processed.size < dependencies.length) {
      const batch: ResourceDependency[] = [];

      // Find resources with no unprocessed dependencies
      dependencies.forEach((resource) => {
        if (processed.has(resource.resource)) return;

        const unmetDependencies = resource.dependsOn.filter(
          (dep) =>
            !processed.has(dep) && dependencies.some((d) => d.resource === dep),
        );

        if (unmetDependencies.length === 0) {
          resource.batchIndex = currentBatch;
          batch.push(resource);
          processed.add(resource.resource);
        }
      });

      if (batch.length === 0) {
        // Circular dependency or other issue - break the cycle
        const remaining = dependencies.filter(
          (d) => !processed.has(d.resource),
        );
        remaining.forEach((resource) => {
          resource.batchIndex = currentBatch;
          batch.push(resource);
          processed.add(resource.resource);
        });

        warnOnce(
          "circular-dependency",
          `Potential circular dependency detected, forced batch processing for ${batch.length} resources`,
        );
      }

      batches.push(batch);
      currentBatch++;
    }

    return batches;
  }

  private getResourceKey(manifest: KubernetesManifest): string {
    const namespace = manifest.metadata?.namespace || "cluster";
    const name = manifest.metadata?.name || "unknown";
    return `${manifest.kind}/${namespace}/${name}`;
  }

  private resolveDependencies(
    manifest: KubernetesManifest,
    resourceMap: Map<string, KubernetesManifest>,
  ): string[] {
    const dependencies: string[] = [];
    const manifestKind = manifest.kind;

    // Get kind-based dependencies
    const kindDependencies = this.dependencyRules.get(manifestKind) || [];

    kindDependencies.forEach((depKind) => {
      // Find actual resources of this kind
      resourceMap.forEach((depManifest, key) => {
        if (depManifest.kind === depKind) {
          // Check if this dependency applies to our resource
          if (this.isDependencyApplicable(manifest, depManifest)) {
            dependencies.push(key);
          }
        }
      });
    });

    // Add explicit references (volumes, configMapRefs, etc.)
    const explicitDeps = this.findExplicitDependencies(manifest, resourceMap);
    dependencies.push(...explicitDeps);

    return dependencies;
  }

  private isDependencyApplicable(
    manifest: KubernetesManifest,
    dependency: KubernetesManifest,
  ): boolean {
    // For namespace-scoped resources, dependency must be in same namespace or cluster-scoped
    if (manifest.metadata?.namespace && dependency.metadata?.namespace) {
      return manifest.metadata.namespace === dependency.metadata.namespace;
    }

    // Cluster-scoped resources can depend on any cluster-scoped resource
    return true;
  }

  private findExplicitDependencies(
    manifest: KubernetesManifest,
    resourceMap: Map<string, KubernetesManifest>,
  ): string[] {
    const dependencies: string[] = [];

    // Check for ConfigMap and Secret references
    const manifestStr = JSON.stringify(manifest);

    // Find ConfigMap references
    const configMapMatches = manifestStr.match(
      /configMap[^"]*Name["']?\s*:\s*["']([^"']+)["']/g,
    );
    if (configMapMatches) {
      configMapMatches.forEach((match) => {
        const nameMatch = match.match(/["']([^"']+)["']$/);
        if (nameMatch) {
          const name = nameMatch[1];
          const namespace = manifest.metadata?.namespace || "default";
          const key = `ConfigMap/${namespace}/${name}`;
          if (resourceMap.has(key)) {
            dependencies.push(key);
          }
        }
      });
    }

    // Find Secret references
    const secretMatches = manifestStr.match(
      /secret[^"]*Name["']?\s*:\s*["']([^"']+)["']/g,
    );
    if (secretMatches) {
      secretMatches.forEach((match) => {
        const nameMatch = match.match(/["']([^"']+)["']$/);
        if (nameMatch) {
          const name = nameMatch[1];
          const namespace = manifest.metadata?.namespace || "default";
          const key = `Secret/${namespace}/${name}`;
          if (resourceMap.has(key)) {
            dependencies.push(key);
          }
        }
      });
    }

    // Find PVC references
    const pvcMatches = manifestStr.match(
      /claimName["']?\s*:\s*["']([^"']+)["']/g,
    );
    if (pvcMatches) {
      pvcMatches.forEach((match) => {
        const nameMatch = match.match(/["']([^"']+)["']$/);
        if (nameMatch) {
          const name = nameMatch[1];
          const namespace = manifest.metadata?.namespace || "default";
          const key = `PersistentVolumeClaim/${namespace}/${name}`;
          if (resourceMap.has(key)) {
            dependencies.push(key);
          }
        }
      });
    }

    return dependencies;
  }

  private calculatePriority(manifest: KubernetesManifest): number {
    // Higher priority = applied first
    const priorityMap: Record<string, number> = {
      Namespace: 1000,
      CustomResourceDefinition: 900,
      StorageClass: 850,
      ClusterRole: 800,
      ServiceAccount: 750,
      Role: 740,
      ClusterRoleBinding: 730,
      RoleBinding: 720,
      ConfigMap: 700,
      Secret: 690,
      PersistentVolume: 600,
      PersistentVolumeClaim: 590,
      Service: 500,
      Deployment: 400,
      DaemonSet: 390,
      StatefulSet: 380,
      Job: 370,
      CronJob: 360,
      NetworkPolicy: 300,
      Ingress: 200,
      HorizontalPodAutoscaler: 100,
      ServiceMonitor: 50,
    };

    return priorityMap[manifest.kind] || 0;
  }
}

/**
 * Parallel manifest applier with intelligent batching
 */
export class ParallelManifestApplier
  extends EventEmitter
  implements IManifestApplier
{
  private dependencyAnalyzer: DependencyAnalyzer;

  constructor() {
    super();
    this.dependencyAnalyzer = new DependencyAnalyzer();
  }

  /**
   * Apply manifests with parallel processing and dependency resolution
   * Interface implementation for IManifestApplier
   */
  async apply(manifests: K8sManifest[], ctx: JobContext): Promise<ApplyResult> {
    return this.applyWithOptions(
      manifests,
      {
        dryRun: false,
        force: false,
        waitForReady: true,
        timeout: 300000,
        maxConcurrency: 5,
        batchSize: 10,
      },
      ctx,
    );
  }

  /**
   * Legacy method with options - internal implementation
   */
  private async applyWithOptions(
    manifests: K8sManifest[],
    options: ApplyOptions,
    ctx?: JobContext,
  ): Promise<ApplyResult> {
    const startTime = Date.now();
    const appliedManifests: AppliedManifest[] = [];
    const errors: ApplyError[] = [];

    try {
      // Notify start via JobContext
      ctx?.on({
        stage: "apply:start",
        ts: Date.now(),
        details: { manifestCount: manifests.length },
      });

      // Analyze dependencies and create batches
      const dependencies =
        this.dependencyAnalyzer.analyzeDependencies(manifests);
      const batches = this.dependencyAnalyzer.createBatches(dependencies);

      ctx?.on({
        stage: "apply:batching_complete",
        ts: Date.now(),
        details: { batches: batches.length },
      });

      this.emit("batching:completed", {
        totalManifests: manifests.length,
        totalBatches: batches.length,
        dependencies: dependencies.length,
      });

      // Process batches sequentially, but process items within each batch in parallel
      let parallelBatches = 0;
      const batchDurations: number[] = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartTime = Date.now();

        this.emit("batch:started", {
          batchIndex,
          batchSize: batch.length,
          totalBatches: batches.length,
        });

        // Process batch items in parallel with concurrency limit
        const batchResults = await this.processBatch(
          batch,
          manifests,
          options,
          batchIndex,
        );

        appliedManifests.push(...batchResults.applied);
        errors.push(...batchResults.errors);

        const batchDuration = Date.now() - batchStartTime;
        batchDurations.push(batchDuration);

        if (batch.length > 1) {
          parallelBatches++;
        }

        this.emit("batch:completed", {
          batchIndex,
          duration: batchDuration,
          applied: batchResults.applied.length,
          errors: batchResults.errors.length,
        });

        // Stop processing if there are critical errors and not in force mode
        if (!options.force && batchResults.errors.some((e) => !e.retryable)) {
          this.emit("apply:stopped", {
            reason: "critical_error",
            batch: batchIndex,
            remainingBatches: batches.length - batchIndex - 1,
          });
          break;
        }
      }

      const duration = Date.now() - startTime;
      const batchSummary: BatchSummary = {
        totalBatches: batches.length,
        parallelBatches,
        totalDuration: duration,
        averageBatchDuration:
          batchDurations.reduce((a, b) => a + b, 0) / batchDurations.length ||
          0,
        concurrencyUtilization: parallelBatches / batches.length,
      };

      this.emit("apply:completed", {
        duration,
        totalManifests: manifests.length,
        appliedCount: appliedManifests.filter((m) => m.status === "success")
          .length,
        errorCount: errors.length,
        batchSummary,
      });

      return {
        success:
          errors.length === 0 ||
          (options.force &&
            appliedManifests.some((m) => m.status === "success")),
        appliedManifests,
        duration,
        batchSummary,
        errors,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.emit("apply:failed", {
        error: error.message,
        duration,
        appliedCount: appliedManifests.length,
      });

      return {
        success: false,
        appliedManifests,
        duration,
        batchSummary: {
          totalBatches: 0,
          parallelBatches: 0,
          totalDuration: duration,
          averageBatchDuration: 0,
          concurrencyUtilization: 0,
        },
        errors: [
          {
            manifest: manifests[0] || (object as KubernetesManifest),
            error: error.message,
            retryable: false,
          },
        ],
      };
    }
  }

  /**
   * Process a batch of resources in parallel
   */
  private async processBatch(
    batch: ResourceDependency[],
    manifests: KubernetesManifest[],
    options: ApplyOptions,
    batchIndex: number,
  ): Promise<{ applied: AppliedManifest[]; errors: ApplyError[] }> {
    const applied: AppliedManifest[] = [];
    const errors: ApplyError[] = [];

    // Create semaphore for concurrency control
    const semaphore = new Array(
      Math.min(options.maxConcurrency, batch.length),
    ).fill(null);

    const processingPromises = batch.map(async (dependency) => {
      // Wait for available semaphore slot
      await new Promise<void>((resolve) => {
        const checkSlot = () => {
          const freeSlotIndex = semaphore.findIndex((slot) => slot === null);
          if (freeSlotIndex !== -1) {
            semaphore[freeSlotIndex] = dependency.resource;
            resolve();
          } else {
            setTimeout(checkSlot, 10);
          }
        };
        checkSlot();
      });

      try {
        // Find the actual manifest
        const manifest = manifests.find(
          (m) => this.getManifestKey(m) === dependency.resource,
        );

        if (!manifest) {
          throw new Error(`Manifest not found for ${dependency.resource}`);
        }

        const startTime = Date.now();

        // Apply the manifest (mock implementation)
        await this.applyManifest(manifest, options);

        const duration = Date.now() - startTime;

        applied.push({
          manifest,
          status: "success",
          duration,
          batchIndex,
        });

        this.emit("manifest:applied", {
          resource: dependency.resource,
          duration,
          batchIndex,
        });
      } catch (innerError) {
        const manifest =
          manifests.find(
            (m) => this.getManifestKey(m) === dependency.resource,
          ) || (object as KubernetesManifest);

        applied.push({
          manifest,
          status: "failed",
          duration: 0,
          batchIndex,
          error: error.message,
        });

        errors.push({
          manifest,
          error: error.message,
          retryable: this.isRetryableError(error),
        });

        this.emit("manifest:failed", {
          resource: dependency.resource,
          error: error.message,
          batchIndex,
        });
      } finally {
        // Release semaphore slot
        const slotIndex = semaphore.findIndex(
          (slot) => slot === dependency.resource,
        );
        if (slotIndex !== -1) {
          semaphore[slotIndex] = null;
        }
      }
    });

    await Promise.all(processingPromises);

    return { applied, errors };
  }

  /**
   * Apply individual manifest (mock implementation - replace with actual kubectl/API calls)
   */
  private async applyManifest(
    manifest: KubernetesManifest,
    options: ApplyOptions,
  ): Promise<void> {
    // Simulate network delay and processing time
    const delay = Math.random() * 100 + 50; // 50-150ms
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (options.dryRun) {
      // Just validate the manifest
      return;
    }

    // Mock implementation - in real use, this would call kubectl or Kubernetes API
    warnOnce(
      "mock-apply",
      "Using mock manifest application - replace with actual kubectl/API calls",
    );

    // Simulate occasional failures for testing
    if (Math.random() < 0.05) {
      // 5% failure rate
      throw new Error(
        `Simulated apply failure for ${manifest.kind}/${manifest.metadata?.name}`,
      );
    }
  }

  private isRetryableError(error: any): boolean {
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /temporary/i,
      /rate limit/i,
      /too many requests/i,
    ];

    return retryablePatterns.some((pattern) =>
      pattern.test(error.message || ""),
    );
  }

  private getManifestKey(manifest: KubernetesManifest): string {
    const namespace = manifest.metadata?.namespace || "cluster";
    const name = manifest.metadata?.name || "unknown";
    return `${manifest.kind}/${namespace}/${name}`;
  }
}

/**
 * Global parallel manifest applier instance
 */
export const parallelManifestApplier = new ParallelManifestApplier();
