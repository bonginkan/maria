/**
 * Kubernetes Manifest Applier
 * Responsible for applying, diffing, and managing Kubernetes manifests
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as yaml from "js-yaml";
import { KubernetesManifest } from "./kubernetes-renderer";

const execAsync = promisify(exec);

export interface ApplyOptions {
  dryRun?: boolean;
  force?: boolean;
  namespace?: string;
  prune?: boolean;
  serverSideApply?: boolean;
  fieldManager?: string;
  wait?: boolean;
  timeout?: string;
}

export interface ApplyResult {
  success: boolean;
  applied: string[];
  failed: string[];
  messages: string[];
  duration: number;
}

export interface DiffResult {
  hasChanges: boolean;
  additions: ManifestChange[];
  modifications: ManifestChange[];
  deletions: ManifestChange[];
  unchanged: string[];
}

export interface ManifestChange {
  kind: string;
  name: string;
  namespace?: string;
  change: string;
  details?: string;
}

export interface PlanResult {
  operations: PlannedOperation[];
  riskLevel: "low" | "medium" | "high";
  estimatedDuration: number;
  warnings: string[];
}

export interface PlannedOperation {
  order: number;
  operation: "create" | "update" | "delete" | "replace";
  resource: {
    kind: string;
    name: string;
    namespace?: string;
  };
  dependencies: string[];
  risk: "low" | "medium" | "high";
}

export interface IKubernetesApplier {
  apply(
    manifests: KubernetesManifest[],
    options?: ApplyOptions,
  ): Promise<ApplyResult>;
  plan(manifests: KubernetesManifest[]): Promise<PlanResult>;
  diff(
    current: KubernetesManifest[],
    desired: KubernetesManifest[],
  ): DiffResult;
  delete(
    manifests: KubernetesManifest[],
    options?: ApplyOptions,
  ): Promise<ApplyResult>;
  validate(
    manifests: KubernetesManifest[],
  ): Promise<{ valid: boolean; errors: string[] }>;
}

export class KubernetesApplier implements IKubernetesApplier {
  private kubectlPath: string;
  private context?: string;

  constructor(kubectlPath: string = "kubectl", context?: string) {
    this.kubectlPath = kubectlPath;
    this.context = context;
  }

  /**
   * Apply manifests to Kubernetes cluster
   */
  async apply(
    manifests: KubernetesManifest[],
    options: ApplyOptions = {},
  ): Promise<ApplyResult> {
    const startTime = Date.now();
    const applied: string[] = [];
    const failed: string[] = [];
    const messages: string[] = [];

    // Sort manifests by dependency order
    const sortedManifests = this.sortByDependency(manifests);

    for (const manifest of sortedManifests) {
      const resourceName = `${manifest.kind}/${manifest.metadata.name}`;

      try {
        const manifestYaml = yaml.dump(manifest);
        const applyCmd = this.buildApplyCommand(options);

        const { stdout, stderr } = await this.executeKubectl(
          `${applyCmd} -f -`,
          manifestYaml,
        );

        applied.push(resourceName);
        messages.push(stdout);

        if (stderr) {
          messages.push(`Warning for ${resourceName}: ${stderr}`);
        }

        // Wait for resource to be ready if specified
        if (options.wait) {
          await this.waitForResource(manifest, options.timeout);
        }
      } catch (error: any) {
        failed.push(resourceName);
        messages.push(`Failed to apply ${resourceName}: ${error.message}`);

        if (!options.force) {
          // Stop on first failure unless force is specified
          break;
        }
      }
    }

    return {
      success: failed.length === 0,
      applied,
      failed,
      messages,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Plan deployment operations
   */
  async plan(manifests: KubernetesManifest[]): Promise<PlanResult> {
    const operations: PlannedOperation[] = [];
    const warnings: string[] = [];
    let maxRisk: "low" | "medium" | "high" = "low";

    // Get current state
    const currentResources = await this.getCurrentResources(manifests);

    // Sort by dependency order
    const sortedManifests = this.sortByDependency(manifests);

    sortedManifests.forEach((manifest, index) => {
      const resourceKey = this.getResourceKey(manifest);
      const exists = currentResources.has(resourceKey);

      const operation: PlannedOperation = {
        order: index + 1,
        operation: exists ? "update" : "create",
        resource: {
          kind: manifest.kind,
          name: manifest.metadata.name,
          namespace: manifest.metadata.namespace,
        },
        dependencies: this.getDependencies(manifest, sortedManifests),
        risk: this.assessRisk(manifest, exists),
      };

      operations.push(operation);

      // Track highest risk
      if (
        operation.risk === "high" ||
        (operation.risk === "medium" && maxRisk === "low")
      ) {
        maxRisk = operation.risk;
      }

      // Add warnings for risky operations
      if (operation.risk === "high") {
        warnings.push(
          `High-risk operation: ${operation.operation} ${operation.resource.kind}/${operation.resource.name}`,
        );
      }
    });

    // Check for deletions
    currentResources.forEach((resource, key) => {
      const stillExists = manifests.some((m) => this.getResourceKey(m) === key);
      if (!stillExists) {
        operations.push({
          order: operations.length + 1,
          operation: "delete",
          resource: {
            kind: resource.kind,
            name: resource.name,
            namespace: resource.namespace,
          },
          dependencies: [],
          risk: "medium",
        });
        warnings.push(
          `Resource will be deleted: ${resource.kind}/${resource.name}`,
        );
      }
    });

    return {
      operations,
      riskLevel: maxRisk,
      estimatedDuration: operations.length * 5000, // 5 seconds per operation estimate
      warnings,
    };
  }

  /**
   * Diff current and desired state
   */
  diff(
    current: KubernetesManifest[],
    desired: KubernetesManifest[],
  ): DiffResult {
    const currentMap = new Map(current.map((m) => [this.getResourceKey(m), m]));
    const desiredMap = new Map(desired.map((m) => [this.getResourceKey(m), m]));

    const additions: ManifestChange[] = [];
    const modifications: ManifestChange[] = [];
    const deletions: ManifestChange[] = [];
    const unchanged: string[] = [];

    // Check for additions and modifications
    desiredMap.forEach((desiredManifest, key) => {
      const currentManifest = currentMap.get(key);

      if (!currentManifest) {
        additions.push({
          kind: desiredManifest.kind,
          name: desiredManifest.metadata.name,
          namespace: desiredManifest.metadata.namespace,
          change: "added",
        });
      } else {
        const diff = this.compareManifests(currentManifest, desiredManifest);
        if (diff) {
          modifications.push({
            kind: desiredManifest.kind,
            name: desiredManifest.metadata.name,
            namespace: desiredManifest.metadata.namespace,
            change: "modified",
            details: diff,
          });
        } else {
          unchanged.push(key);
        }
      }
    });

    // Check for deletions
    currentMap.forEach((currentManifest, key) => {
      if (!desiredMap.has(key)) {
        deletions.push({
          kind: currentManifest.kind,
          name: currentManifest.metadata.name,
          namespace: currentManifest.metadata.namespace,
          change: "deleted",
        });
      }
    });

    return {
      hasChanges:
        additions.length > 0 ||
        modifications.length > 0 ||
        deletions.length > 0,
      additions,
      modifications,
      deletions,
      unchanged,
    };
  }

  /**
   * Delete resources
   */
  async delete(
    manifests: KubernetesManifest[],
    options: ApplyOptions = {},
  ): Promise<ApplyResult> {
    const startTime = Date.now();
    const applied: string[] = [];
    const failed: string[] = [];
    const messages: string[] = [];

    // Delete in reverse dependency order
    const sortedManifests = this.sortByDependency(manifests).reverse();

    for (const manifest of sortedManifests) {
      const resourceName = `${manifest.kind}/${manifest.metadata.name}`;

      try {
        const deleteCmd = this.buildDeleteCommand(options);
        const { stdout, stderr } = await this.executeKubectl(
          `${deleteCmd} ${manifest.kind} ${manifest.metadata.name}` +
            (manifest.metadata.namespace
              ? ` -n ${manifest.metadata.namespace}`
              : ""),
        );

        applied.push(resourceName);
        messages.push(stdout);

        if (stderr) {
          messages.push(`Warning for ${resourceName}: ${stderr}`);
        }
      } catch (error: any) {
        failed.push(resourceName);
        messages.push(`Failed to delete ${resourceName}: ${error.message}`);
      }
    }

    return {
      success: failed.length === 0,
      applied,
      failed,
      messages,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate manifests
   */
  async validate(
    manifests: KubernetesManifest[],
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const manifest of manifests) {
      try {
        const manifestYaml = yaml.dump(manifest);
        await this.executeKubectl(
          "apply --dry-run=client --validate=true -f -",
          manifestYaml,
        );
      } catch (error: any) {
        errors.push(
          `Validation failed for ${manifest.kind}/${manifest.metadata.name}: ${error.message}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sort manifests by dependency order
   */
  private sortByDependency(
    manifests: KubernetesManifest[],
  ): KubernetesManifest[] {
    const order: Record<string, number> = {
      Namespace: 1,
      ResourceQuota: 2,
      LimitRange: 3,
      ServiceAccount: 4,
      Secret: 5,
      ConfigMap: 6,
      StorageClass: 7,
      PersistentVolume: 8,
      PersistentVolumeClaim: 9,
      CustomResourceDefinition: 10,
      ClusterRole: 11,
      ClusterRoleBinding: 12,
      Role: 13,
      RoleBinding: 14,
      Service: 15,
      DaemonSet: 16,
      Deployment: 17,
      ReplicaSet: 18,
      StatefulSet: 19,
      Job: 20,
      CronJob: 21,
      Ingress: 22,
      NetworkPolicy: 23,
      PodDisruptionBudget: 24,
      HorizontalPodAutoscaler: 25,
      VerticalPodAutoscaler: 26,
    };

    return manifests.sort((a, b) => {
      const orderA = order[a.kind] || 99;
      const orderB = order[b.kind] || 99;
      return orderA - orderB;
    });
  }

  /**
   * Execute kubectl command
   */
  private async executeKubectl(
    command: string,
    stdin?: string,
  ): Promise<{ stdout: string; stderr: string }> {
    const fullCommand = `${this.kubectlPath} ${this.context ? `--context=${this.context}` : ""} ${command}`;

    if (stdin) {
      // Use echo and pipe for stdin
      const { stdout, stderr } = await execAsync(
        `echo '${stdin}' | ${fullCommand}`,
      );
      return { stdout, stderr };
    }

    const { stdout, stderr } = await execAsync(fullCommand);
    return { stdout, stderr };
  }

  /**
   * Build apply command with options
   */
  private buildApplyCommand(options: ApplyOptions): string {
    const parts = ["apply"];

    if (options.dryRun) {
      parts.push("--dry-run=server");
    }

    if (options.serverSideApply) {
      parts.push("--server-side");
      if (options.fieldManager) {
        parts.push(`--field-manager=${options.fieldManager}`);
      }
    }

    if (options.force) {
      parts.push("--force");
    }

    if (options.prune) {
      parts.push("--prune");
    }

    return parts.join(" ");
  }

  /**
   * Build delete command with options
   */
  private buildDeleteCommand(options: ApplyOptions): string {
    const parts = ["delete"];

    if (options.dryRun) {
      parts.push("--dry-run=server");
    }

    if (options.force) {
      parts.push("--force");
    }

    return parts.join(" ");
  }

  /**
   * Wait for resource to be ready
   */
  private async waitForResource(
    manifest: KubernetesManifest,
    timeout: string = "60s",
  ): Promise<void> {
    const waitCmd =
      `wait --for=condition=Ready ${manifest.kind}/${manifest.metadata.name}` +
      (manifest.metadata.namespace
        ? ` -n ${manifest.metadata.namespace}`
        : "") +
      ` --timeout=${timeout}`;

    try {
      await this.executeKubectl(waitCmd);
    } catch (error) {
      // Some resources don't support wait, ignore errors
      console.warn(
        `Wait not supported for ${manifest.kind}/${manifest.metadata.name}`,
      );
    }
  }

  /**
   * Get current resources from cluster
   */
  private async getCurrentResources(
    manifests: KubernetesManifest[],
  ): Promise<Map<string, any>> {
    const resources = new Map<string, any>();

    for (const manifest of manifests) {
      try {
        const getCmd =
          `get ${manifest.kind} ${manifest.metadata.name}` +
          (manifest.metadata.namespace
            ? ` -n ${manifest.metadata.namespace}`
            : "") +
          " -o yaml";

        const { stdout } = await this.executeKubectl(getCmd);
        const current = yaml.load(stdout) as any;
        resources.set(this.getResourceKey(manifest), current);
      } catch {
        // Resource doesn't exist
      }
    }

    return resources;
  }

  /**
   * Get unique key for resource
   */
  private getResourceKey(manifest: KubernetesManifest): string {
    return `${manifest.kind}:${manifest.metadata.namespace || "default"}:${manifest.metadata.name}`;
  }

  /**
   * Compare two manifests for differences
   */
  private compareManifests(
    current: KubernetesManifest,
    desired: KubernetesManifest,
  ): string | null {
    // Remove server-managed fields for comparison
    const cleanCurrent = this.cleanManifest(current);
    const cleanDesired = this.cleanManifest(desired);

    const currentStr = JSON.stringify(cleanCurrent, null, 2);
    const desiredStr = JSON.stringify(cleanDesired, null, 2);

    if (currentStr === desiredStr) {
      return null;
    }

    // Return a simple diff description
    return "spec or metadata changes detected";
  }

  /**
   * Clean manifest for comparison
   */
  private cleanManifest(manifest: KubernetesManifest): any {
    const cleaned = JSON.parse(JSON.stringify(manifest));

    // Remove server-managed fields
    delete cleaned.metadata.uid;
    delete cleaned.metadata.resourceVersion;
    delete cleaned.metadata.generation;
    delete cleaned.metadata.creationTimestamp;
    delete cleaned.metadata.managedFields;
    delete cleaned.metadata.selfLink;
    delete cleaned.status;

    return cleaned;
  }

  /**
   * Get dependencies for a manifest
   */
  private getDependencies(
    manifest: KubernetesManifest,
    allManifests: KubernetesManifest[],
  ): string[] {
    const dependencies: string[] = [];

    // Services depend on deployments
    if (manifest.kind === "Service") {
      const selector = manifest.spec?.selector;
      if (selector) {
        allManifests
          .filter((m) => m.kind === "Deployment" || m.kind === "StatefulSet")
          .forEach((m) => {
            if (
              this.labelsMatch(m.spec?.template?.metadata?.labels, selector)
            ) {
              dependencies.push(`${m.kind}/${m.metadata.name}`);
            }
          });
      }
    }

    // Ingress depends on services
    if (manifest.kind === "Ingress") {
      manifest.spec?.rules?.forEach((rule: any) => {
        rule.http?.paths?.forEach((_path: any) => {
          const serviceName = _path.backend?.service?.name;
          if (serviceName) {
            dependencies.push(`Service/${serviceName}`);
          }
        });
      });
    }

    return dependencies;
  }

  /**
   * Check if labels match selector
   */
  private labelsMatch(
    labels: Record<string, string>,
    selector: Record<string, string>,
  ): boolean {
    if (!labels || !selector) return false;

    return Object.entries(selector).every(
      ([key, value]) => labels[key] === value,
    );
  }

  /**
   * Assess risk level of operation
   */
  private assessRisk(
    manifest: KubernetesManifest,
    exists: boolean,
  ): "low" | "medium" | "high" {
    // New resources are generally low risk
    if (!exists) {
      return manifest.kind === "Namespace" ||
        manifest.kind === "CustomResourceDefinition"
        ? "medium"
        : "low";
    }

    // Updates to critical resources are high risk
    const criticalKinds = [
      "Deployment",
      "StatefulSet",
      "DaemonSet",
      "Service",
      "Ingress",
    ];
    if (criticalKinds.includes(manifest.kind)) {
      return "high";
    }

    // RBAC changes are medium risk
    const rbacKinds = [
      "ClusterRole",
      "ClusterRoleBinding",
      "Role",
      "RoleBinding",
    ];
    if (rbacKinds.includes(manifest.kind)) {
      return "medium";
    }

    return "low";
  }
}

/**
 * Mock implementation for testing
 */
export class MockKubernetesApplier implements IKubernetesApplier {
  async apply(
    manifests: KubernetesManifest[],
    _options?: ApplyOptions,
  ): Promise<ApplyResult> {
    return {
      success: true,
      applied: manifests.map((m) => `${m.kind}/${m.metadata.name}`),
      failed: [],
      messages: ["Mock apply successful"],
      duration: 100,
    };
  }

  async plan(manifests: KubernetesManifest[]): Promise<PlanResult> {
    return {
      operations: manifests.map((m, i) => ({
        order: i + 1,
        operation: "create" as const,
        resource: {
          kind: m.kind,
          name: m.metadata.name,
          namespace: m.metadata.namespace,
        },
        dependencies: [],
        risk: "low" as const,
      })),
      riskLevel: "low",
      estimatedDuration: manifests.length * 1000,
      warnings: [],
    };
  }

  diff(
    _current: KubernetesManifest[],
    desired: KubernetesManifest[],
  ): DiffResult {
    return {
      hasChanges: desired.length > 0,
      additions: desired.map((m) => ({
        kind: m.kind,
        name: m.metadata.name,
        namespace: m.metadata.namespace,
        change: "added",
      })),
      modifications: [],
      deletions: [],
      unchanged: [],
    };
  }

  async delete(
    manifests: KubernetesManifest[],
    _options?: ApplyOptions,
  ): Promise<ApplyResult> {
    return {
      success: true,
      applied: manifests.map((m) => `${m.kind}/${m.metadata.name}`),
      failed: [],
      messages: ["Mock delete successful"],
      duration: 100,
    };
  }

  async validate(
    _manifests: KubernetesManifest[],
  ): Promise<{ valid: boolean; errors: string[] }> {
    return {
      valid: true,
      errors: [],
    };
  }
}
