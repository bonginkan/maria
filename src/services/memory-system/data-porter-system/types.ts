/**
 * Phase4 Enterprise Deployment Manager - Type Definitions
 * Circular dependency resolution: All shared types in one place
 *
 * Design Pattern: Dependency Inversion
 * - Types are the "North Star" (stable contracts)
 * - Implementations depend on these interfaces
 * - Communication flows back via JobContext/Events
 */

export type K8sManifest = Record<string, unknown>;

export interface DeploymentEvent {
  stage: string;
  details?: any;
  ts: number;
}

export interface JobContext {
  on(ev: DeploymentEvent): void;
}

// ============================================================================
// Service Interfaces - Dependency Inversion Pattern
// ============================================================================

/**
 * Parallel manifest application service
 * Handles concurrent Kubernetes manifest deployment
 */
export interface IManifestApplier {
  apply(manifests: K8sManifest[], ctx: JobContext): Promise<ApplyResult>;
}

export interface ApplyResult {
  success: boolean;
  appliedCount: number;
  failedCount: number;
  errors?: string[];
}

/**
 * Multi-cloud abstraction service
 * Handles provisioning across different cloud providers
 */
export interface ICloudDriver {
  provision(
    env: string,
    plan: ProvisioningPlan,
    ctx: JobContext,
  ): Promise<void>;
}

export interface ProvisioningPlan {
  provider: "aws" | "gcp" | "azure" | "kubernetes";
  resources: CloudResource[];
}

export interface CloudResource {
  type: string;
  name: string;
  config: Record<string, unknown>;
}

/**
 * Monitoring and observability service
 * Handles Prometheus/Grafana integration
 */
export interface IMonitor {
  publish(event: DeploymentEvent): Promise<void>;
  createDashboard?(deployment: DeploymentInfo): Promise<string>;
}

export interface DeploymentInfo {
  id: string;
  env: string;
  startTime: number;
  status: "pending" | "running" | "completed" | "failed";
}

/**
 * Idempotency management service
 * Handles deployment state and locking
 */
export interface IIdempotency {
  acquire(key: string): Promise<boolean>;
  release(key: string): Promise<void>;
  getState?(key: string): Promise<IdempotentState | null>;
}

export interface IdempotentState {
  key: string;
  hash: string;
  lastApplied: number;
  status: "pending" | "applied" | "failed";
}

/**
 * Cost optimization service
 * Handles resource cost analysis and optimization
 */
export interface ICostOptimizer {
  suggest(
    env: string,
    currentResources: CloudResource[],
  ): Promise<OptimizationPlan>;
}

export interface OptimizationPlan {
  estimatedSavings: number;
  recommendations: CostRecommendation[];
}

export interface CostRecommendation {
  type: "spot-instances" | "right-sizing" | "scheduling" | "reserved-instances";
  description: string;
  potentialSavings: number;
  confidence: number;
}
