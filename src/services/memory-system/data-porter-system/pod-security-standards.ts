/**
 * Pod Security Standards (PSS) Configuration
 * Replaces deprecated PodSecurityPolicy (PSP) with modern security standards
 */

export type PSSLevel = "privileged" | "baseline" | "restricted";
export type PSSMode = "enforce" | "audit" | "warn";

export interface PodSecurityStandardsConfig {
  enforce: PSSLevel;
  audit: PSSLevel;
  warn: PSSLevel;
  version?: string; // Kubernetes version for PSS (e.g., 'v1.28')
  exemptions?: PSSExemption[];
}

export interface PSSExemption {
  usernames?: string[];
  runtimeClasses?: string[];
  namespaces?: string[];
}

export interface NamespacePSSLabels {
  "pod-security.kubernetes.io/enforce": PSSLevel;
  "pod-security.kubernetes.io/enforce-version"?: string;
  "pod-security.kubernetes.io/audit": PSSLevel;
  "pod-security.kubernetes.io/audit-version"?: string;
  "pod-security.kubernetes.io/warn": PSSLevel;
  "pod-security.kubernetes.io/warn-version"?: string;
}

/**
 * PSS Level Definitions
 */
export const PSSLevels = {
  privileged: {
    description:
      "Unrestricted policy, providing the widest possible level of permissions",
    useCase:
      "System and infrastructure workloads managed by privileged, trusted users",
    restrictions: [],
  },
  baseline: {
    description:
      "Minimally restrictive policy which prevents known privilege escalations",
    useCase:
      "Common containerized workloads while preventing known privilege escalations",
    restrictions: [
      "hostNetwork",
      "hostPID",
      "hostIPC",
      "hostPorts",
      "allowedCapabilities (except NET_BIND_SERVICE)",
      "privileged containers",
      "procMount",
      "allowedProcMountTypes",
      "allowedUnsafeSysctls",
    ],
  },
  restricted: {
    description:
      "Heavily restricted policy, following Pod hardening best practices",
    useCase: "Security-critical applications and multi-tenant environments",
    restrictions: [
      ...PSSLevels.baseline.restrictions,
      "volume types (limited to configMap, downwardAPI, emptyDir, persistentVolumeClaim, projected, secret)",
      "runAsNonRoot",
      "runAsUser (non-zero)",
      "seccompProfile",
      "capabilities (all must be dropped)",
      "readOnlyRootFilesystem",
    ],
  },
};

/**
 * Environment-specific PSS configurations
 */
export const EnvironmentPSSProfiles = {
  development: {
    enforce: "baseline" as PSSLevel,
    audit: "restricted" as PSSLevel,
    warn: "restricted" as PSSLevel,
  },
  staging: {
    enforce: "baseline" as PSSLevel,
    audit: "restricted" as PSSLevel,
    warn: "restricted" as PSSLevel,
  },
  production: {
    enforce: "restricted" as PSSLevel,
    audit: "restricted" as PSSLevel,
    warn: "restricted" as PSSLevel,
  },
  disaster_recovery: {
    enforce: "restricted" as PSSLevel,
    audit: "restricted" as PSSLevel,
    warn: "restricted" as PSSLevel,
  },
};

/**
 * Generate namespace labels for Pod Security Standards
 */
export function generatePSSLabels(
  config: PodSecurityStandardsConfig,
  kubernetesVersion?: string,
): NamespacePSSLabels {
  const labels: NamespacePSSLabels = {
    "pod-security.kubernetes.io/enforce": config.enforce,
    "pod-security.kubernetes.io/audit": config.audit,
    "pod-security.kubernetes.io/warn": config.warn,
  };

  if (kubernetesVersion || config.version) {
    const version = kubernetesVersion || config.version;
    labels["pod-security.kubernetes.io/enforce-version"] = version;
    labels["pod-security.kubernetes.io/audit-version"] = version;
    labels["pod-security.kubernetes.io/warn-version"] = version;
  }

  return labels;
}

/**
 * Validate PSS configuration for environment
 */
export function validatePSSConfig(
  config: PodSecurityStandardsConfig,
  environment: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate levels
  const validLevels: PSSLevel[] = ["privileged", "baseline", "restricted"];
  if (!validLevels.includes(config.enforce)) {
    errors.push(`Invalid enforce level: ${config.enforce}`);
  }
  if (!validLevels.includes(config.audit)) {
    errors.push(`Invalid audit level: ${config.audit}`);
  }
  if (!validLevels.includes(config.warn)) {
    errors.push(`Invalid warn level: ${config.warn}`);
  }

  // Ensure enforce is not less restrictive than audit/warn
  const levelOrder = { privileged: 0, baseline: 1, restricted: 2 };
  if (levelOrder[config.enforce] < levelOrder[config.audit]) {
    errors.push(
      `Enforce level (${config.enforce}) cannot be less restrictive than audit level (${config.audit})`,
    );
  }
  if (levelOrder[config.enforce] < levelOrder[config.warn]) {
    errors.push(
      `Enforce level (${config.enforce}) cannot be less restrictive than warn level (${config.warn})`,
    );
  }

  // Production should use restricted level
  if (environment === "production" && config.enforce !== "restricted") {
    errors.push(
      `Production environment should enforce 'restricted' level, got '${config.enforce}'`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Migration helper from PSP to PSS
 */
export interface PSPMigrationResult {
  recommendedLevel: PSSLevel;
  violations: string[];
  suggestions: string[];
}

export function analyzePSPForMigration(pspConfig: any): PSPMigrationResult {
  const violations: string[] = [];
  const suggestions: string[] = [];
  let recommendedLevel: PSSLevel = "restricted";

  // Check for privileged containers
  if (pspConfig.privileged === true) {
    recommendedLevel = "privileged";
    violations.push("Allows privileged containers");
    suggestions.push("Consider removing privileged access if not required");
  }

  // Check for host namespaces
  if (pspConfig.hostNetwork || pspConfig.hostPID || pspConfig.hostIPC) {
    if (recommendedLevel === "restricted") {
      recommendedLevel = "baseline";
    }
    violations.push("Uses host namespaces");
    suggestions.push("Isolate workloads from host namespaces when possible");
  }

  // Check for host ports
  if (pspConfig.hostPorts && pspConfig.hostPorts.length > 0) {
    if (recommendedLevel === "restricted") {
      recommendedLevel = "baseline";
    }
    violations.push("Uses host ports");
    suggestions.push("Use Service objects instead of host ports");
  }

  // Check for volume types
  const restrictedVolumes = [
    "configMap",
    "downwardAPI",
    "emptyDir",
    "persistentVolumeClaim",
    "projected",
    "secret",
  ];
  if (pspConfig.volumes) {
    const nonRestrictedVolumes = pspConfig.volumes.filter(
      (v: string) => !restrictedVolumes.includes(v),
    );
    if (nonRestrictedVolumes.length > 0 && recommendedLevel === "restricted") {
      recommendedLevel = "baseline";
      violations.push(
        `Uses non-restricted volume types: ${nonRestrictedVolumes.join(", ")}`,
      );
      suggestions.push(
        "Limit volume types to standard persistent storage options",
      );
    }
  }

  // Check for runAsUser
  if (pspConfig.runAsUser?.rule !== "MustRunAsNonRoot") {
    if (recommendedLevel === "restricted") {
      recommendedLevel = "baseline";
    }
    violations.push("Does not enforce non-root user");
    suggestions.push("Configure containers to run as non-root user");
  }

  // Check for capabilities
  if (
    pspConfig.allowedCapabilities &&
    pspConfig.allowedCapabilities.length > 0
  ) {
    if (recommendedLevel === "restricted") {
      recommendedLevel = "baseline";
    }
    violations.push(
      `Allows additional capabilities: ${pspConfig.allowedCapabilities.join(", ")}`,
    );
    suggestions.push(
      "Drop all capabilities and add only those absolutely necessary",
    );
  }

  // Check for seccomp
  if (!pspConfig.seccompProfile || pspConfig.seccompProfile === "Unconfined") {
    violations.push("No seccomp profile enforced");
    suggestions.push("Use RuntimeDefault or a custom seccomp profile");
  }

  return {
    recommendedLevel,
    violations,
    suggestions,
  };
}

/**
 * Generate pod security context based on PSS level
 */
export function generatePodSecurityContext(level: PSSLevel): any {
  switch (level) {
    case "restricted":
      return {
        runAsNonRoot: true,
        runAsUser: 1000,
        runAsGroup: 3000,
        fsGroup: 2000,
        seccompProfile: {
          type: "RuntimeDefault",
        },
      };
    case "baseline":
      return {
        runAsNonRoot: true,
        fsGroup: 2000,
      };
    case "privileged":
      return {};
    default:
      return {
        runAsNonRoot: true,
        fsGroup: 2000,
      };
  }
}

/**
 * Generate container security context based on PSS level
 */
export function generateContainerSecurityContext(level: PSSLevel): any {
  switch (level) {
    case "restricted":
      return {
        allowPrivilegeEscalation: false,
        readOnlyRootFilesystem: true,
        runAsNonRoot: true,
        runAsUser: 1000,
        capabilities: {
          drop: ["ALL"],
        },
        seccompProfile: {
          type: "RuntimeDefault",
        },
      };
    case "baseline":
      return {
        allowPrivilegeEscalation: false,
        runAsNonRoot: true,
        capabilities: {
          drop: ["ALL"],
          add: ["NET_BIND_SERVICE"],
        },
      };
    case "privileged":
      return {};
    default:
      return {
        allowPrivilegeEscalation: false,
        runAsNonRoot: true,
        capabilities: {
          drop: ["ALL"],
        },
      };
  }
}

/**
 * Validate workload against PSS level
 */
export interface WorkloadValidationResult {
  compliant: boolean;
  level: PSSLevel;
  violations: string[];
  fixes: string[];
}

export function validateWorkloadCompliance(
  workload: any,
  requiredLevel: PSSLevel,
): WorkloadValidationResult {
  const violations: string[] = [];
  const fixes: string[] = [];
  let compliant = true;

  if (requiredLevel === "restricted" || requiredLevel === "baseline") {
    // Check for privileged containers
    if (workload.spec?.template?.spec?.containers) {
      for (const container of workload.spec.template.spec.containers) {
        if (container.securityContext?.privileged === true) {
          compliant = false;
          violations.push(`Container ${container.name} is privileged`);
          fixes.push(
            `Remove privileged: true from container ${container.name}`,
          );
        }

        // Check for privilege escalation
        if (
          requiredLevel === "restricted" &&
          container.securityContext?.allowPrivilegeEscalation !== false
        ) {
          compliant = false;
          violations.push(
            `Container ${container.name} allows privilege escalation`,
          );
          fixes.push(
            `Set allowPrivilegeEscalation: false for container ${container.name}`,
          );
        }

        // Check for root filesystem
        if (
          requiredLevel === "restricted" &&
          container.securityContext?.readOnlyRootFilesystem !== true
        ) {
          compliant = false;
          violations.push(
            `Container ${container.name} has writable root filesystem`,
          );
          fixes.push(
            `Set readOnlyRootFilesystem: true for container ${container.name}`,
          );
        }

        // Check capabilities
        if (requiredLevel === "restricted") {
          const caps = container.securityContext?.capabilities;
          if (!caps || !caps.drop || !caps.drop.includes("ALL")) {
            compliant = false;
            violations.push(
              `Container ${container.name} does not drop ALL capabilities`,
            );
            fixes.push(
              `Add capabilities.drop: ['ALL'] to container ${container.name}`,
            );
          }
          if (caps?.add && caps.add.length > 0) {
            compliant = false;
            violations.push(
              `Container ${container.name} adds capabilities: ${caps.add.join(", ")}`,
            );
            fixes.push(
              `Remove capability additions from container ${container.name}`,
            );
          }
        }
      }
    }

    // Check pod security context
    const podSecurityContext = workload.spec?.template?.spec?.securityContext;
    if (requiredLevel === "restricted" || requiredLevel === "baseline") {
      if (podSecurityContext?.runAsNonRoot !== true) {
        compliant = false;
        violations.push("Pod does not enforce runAsNonRoot");
        fixes.push("Set runAsNonRoot: true in pod security context");
      }
    }

    // Check for host namespaces
    const podSpec = workload.spec?.template?.spec;
    if (podSpec?.hostNetwork === true) {
      compliant = false;
      violations.push("Pod uses host network");
      fixes.push("Remove hostNetwork: true");
    }
    if (podSpec?.hostPID === true) {
      compliant = false;
      violations.push("Pod uses host PID namespace");
      fixes.push("Remove hostPID: true");
    }
    if (podSpec?.hostIPC === true) {
      compliant = false;
      violations.push("Pod uses host IPC namespace");
      fixes.push("Remove hostIPC: true");
    }

    // Check volumes for restricted level
    if (requiredLevel === "restricted" && podSpec?.volumes) {
      const allowedVolumeTypes = [
        "configMap",
        "downwardAPI",
        "emptyDir",
        "persistentVolumeClaim",
        "projected",
        "secret",
      ];
      for (const volume of podSpec.volumes) {
        const volumeType = Object.keys(volume).find((k) => k !== "name");
        if (volumeType && !allowedVolumeTypes.includes(volumeType)) {
          compliant = false;
          violations.push(
            `Volume ${volume.name} uses restricted type: ${volumeType}`,
          );
          fixes.push(`Replace volume ${volume.name} with an allowed type`);
        }
      }
    }
  }

  return {
    compliant,
    level: requiredLevel,
    violations,
    fixes,
  };
}
