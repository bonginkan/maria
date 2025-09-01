/**
 * Enterprise Deployment Manager - Public API
 *
 * Uses types-only exports for optimal tree-shaking
 * Follows the feedback guidance for safe deprecation and ESM optimization
 */

// Types-only exports for optimal tree-shaking
export type {
  DeploymentConfig,
  InfrastructureConfig,
  RegionConfig,
  EnvironmentConfig,
  ResourceAllocation,
  ResourceRequirements,
  IsolationLevel,
  CloudProvider,
  KubernetesConfig,
  ScalingConfig,
  HorizontalScalingConfig,
  VerticalScalingConfig,
  MonitoringConfig,
  DeploymentSecurityConfig,
  SecretsConfig,
  BackupConfig,
  NetworkingConfig,
  DeploymentResult,
  ScalingResult,
  UpdateResult,
  RollbackResult,
  DeploymentStatus,
  DeploymentStatusResponse,
  KubernetesManifest,
  DeploymentOptions,
  // Error types
  DeploymentError,
  ValidationError,
  ResourceQuotaError,
  SecurityPolicyError,
  HPAConfigError,
  InfrastructureError,
  NetworkingError,
  RollbackError,
  // Additional types
  DeploymentManagerConfig,
  DeprecationInfo,
  MetricsData,
} from "./types";

// Value exports (actual classes and functions)
export { EnterpriseDeploymentManager } from "./enterprise-deployment-manager";

// Utility exports
export {
  warnOnce,
  deprecated,
  isDeprecationDisabled,
} from "../utils/deprecation";
export {
  track as trackMetrics,
  getDeprecationStats,
} from "../monitoring/metrics-collector";

// Version and metadata
export const VERSION = process.env.npm_package_version || "1.0.0";
export const COMPONENT_NAME = "maria-enterprise-deployment-manager";

/**
 * Create deployment manager with safe defaults
 *
 * @deprecated Use EnterpriseDeploymentManager constructor directly
 */
export const createDeploymentManager = deprecated(
  (config: any) => {
    return new (require("./enterprise-deployment-manager").EnterpriseDeploymentManager)(
      config,
    );
  },
  "createDeploymentManager factory function is deprecated",
  "EnterpriseDeploymentManager constructor",
);

/**
 * Legacy API compatibility
 *
 * @deprecated This will be removed in v3.0.0
 */
export function deployLegacy(environment: string, config: any): Promise<any> {
  require("../utils/deprecation").warnOnce(
    "deployLegacy",
    "deployLegacy function is deprecated and will be removed in v3.0.0",
    "EnterpriseDeploymentManager.deploy()",
  );

  const manager =
    new (require("./enterprise-deployment-manager").EnterpriseDeploymentManager)(
      config,
    );
  return manager.deploy(environment);
}

// Re-export custom error classes for convenience
export {
  DeploymentError,
  ValidationError,
  ResourceQuotaError,
  SecurityPolicyError,
  HPAConfigError,
  InfrastructureError,
  NetworkingError,
  RollbackError,
} from "./enterprise-deployment-manager";
