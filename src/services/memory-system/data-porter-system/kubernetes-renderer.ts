/**
 * Kubernetes Manifest Renderer
 * Responsible for generating Kubernetes manifests from configuration
 */

import * as yaml from "js-yaml";
import {
  DeploymentConfig,
  EnvironmentConfig,
  KubernetesConfig,
  ScalingConfig,
  NetworkingConfig,
} from "./enterprise-deployment-manager";
import {
  generatePSSLabels,
  EnvironmentPSSProfiles,
  generatePodSecurityContext,
  generateContainerSecurityContext,
} from "./pod-security-standards";
import { SecretsManagerFactory, SecretData } from "./secrets-manager";

export interface KubernetesManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: any;
  data?: any;
  [key: string]: any;
}

export interface RenderOptions {
  environment: string;
  dryRun?: boolean;
  includeSecrets?: boolean;
  includeMonitoring?: boolean;
  outputFormat?: "json" | "yaml";
}

export interface IKubernetesRenderer {
  renderNamespace(
    environment: string,
    config: EnvironmentConfig,
  ): KubernetesManifest;
  renderServiceAccounts(config: KubernetesConfig): KubernetesManifest[];
  renderRBAC(config: KubernetesConfig): KubernetesManifest[];
  renderConfigMaps(
    environment: string,
    config: DeploymentConfig,
  ): KubernetesManifest[];
  renderSecrets(
    environment: string,
    config: DeploymentConfig,
  ): KubernetesManifest[];
  renderDeployments(
    environment: string,
    config: DeploymentConfig,
  ): KubernetesManifest[];
  renderServices(
    environment: string,
    config: DeploymentConfig,
  ): KubernetesManifest[];
  renderIngress(
    environment: string,
    config: NetworkingConfig,
  ): KubernetesManifest[];
  renderHPA(environment: string, config: ScalingConfig): KubernetesManifest[];
  renderNetworkPolicies(
    environment: string,
    config: KubernetesConfig,
  ): KubernetesManifest[];
  renderStorage(config: KubernetesConfig): KubernetesManifest[];
  renderAll(
    environment: string,
    config: DeploymentConfig,
    options?: RenderOptions,
  ): KubernetesManifest[];
}

export class KubernetesRenderer implements IKubernetesRenderer {
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  /**
   * Render all manifests for an environment
   */
  renderAll(
    environment: string,
    config?: DeploymentConfig,
    options?: RenderOptions,
  ): KubernetesManifest[] {
    const deployConfig = config || this.config;
    const envConfig = this.getEnvironmentConfig(environment, deployConfig);
    const manifests: KubernetesManifest[] = [];

    // Core resources
    manifests.push(this.renderNamespace(environment, envConfig));
    manifests.push(...this.renderServiceAccounts(deployConfig.kubernetes));
    manifests.push(...this.renderRBAC(deployConfig.kubernetes));
    manifests.push(...this.renderConfigMaps(environment, deployConfig));

    // Secrets (optional in dry-run)
    if (options?.includeSecrets !== false) {
      manifests.push(...this.renderSecrets(environment, deployConfig));
    }

    // Workloads
    manifests.push(...this.renderDeployments(environment, deployConfig));
    manifests.push(...this.renderServices(environment, deployConfig));

    // Networking
    if (deployConfig.networking.ingress.tls?.enabled) {
      manifests.push(
        ...this.renderIngress(environment, deployConfig.networking),
      );
    }

    if (deployConfig.kubernetes.networkPolicy.enabled) {
      manifests.push(
        ...this.renderNetworkPolicies(environment, deployConfig.kubernetes),
      );
    }

    // Scaling
    if (deployConfig.scaling.horizontal.enabled) {
      manifests.push(...this.renderHPA(environment, deployConfig.scaling));
    }

    // Storage
    manifests.push(...this.renderStorage(deployConfig.kubernetes));

    // Monitoring (optional)
    if (
      options?.includeMonitoring &&
      deployConfig.monitoring.prometheus.enabled
    ) {
      manifests.push(...this.renderMonitoring(environment, deployConfig));
    }

    return manifests;
  }

  /**
   * Render namespace manifest
   */
  renderNamespace(
    environment: string,
    envConfig: EnvironmentConfig,
  ): KubernetesManifest {
    const pssConfig =
      this.config.kubernetes.podSecurityStandards ||
      EnvironmentPSSProfiles[envConfig.type];

    const pssLabels = generatePSSLabels(
      pssConfig,
      this.config.kubernetes.version,
    );

    return {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: `maria-${environment}`,
        labels: {
          ...pssLabels,
          "app.kubernetes.io/name": "maria",
          "app.kubernetes.io/instance": environment,
          "app.kubernetes.io/component": "namespace",
          "app.kubernetes.io/environment": environment,
          name: `maria-${environment}`,
        },
        annotations: {
          "maria.ai/environment": environment,
          "maria.ai/isolation": envConfig.isolation,
          "maria.ai/pss-profile": envConfig.type,
        },
      },
    };
  }

  /**
   * Render service accounts
   */
  renderServiceAccounts(config: KubernetesConfig): KubernetesManifest[] {
    if (!config.rbac.enabled) return [];

    return config.rbac.serviceAccounts.map((sa) => ({
      apiVersion: "v1",
      kind: "ServiceAccount",
      metadata: {
        name: sa.name,
        namespace: sa.namespace,
        annotations: sa.annotations,
      },
      automountServiceAccountToken: sa.automountServiceAccountToken,
    }));
  }

  /**
   * Render RBAC resources
   */
  renderRBAC(config: KubernetesConfig): KubernetesManifest[] {
    if (!config.rbac.enabled) return [];

    const manifests: KubernetesManifest[] = [];

    // Roles and ClusterRoles
    manifests.push(
      ...config.rbac.roles.map((role) => ({
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: role.namespace ? "Role" : "ClusterRole",
        metadata: {
          name: role.name,
          ...(role.namespace && { namespace: role.namespace }),
        },
        rules: role.rules,
      })),
    );

    // RoleBindings and ClusterRoleBindings
    manifests.push(
      ...config.rbac.bindings.map((binding) => ({
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: binding.namespace ? "RoleBinding" : "ClusterRoleBinding",
        metadata: {
          name: binding.name,
          ...(binding.namespace && { namespace: binding.namespace }),
        },
        roleRef: binding.roleRef,
        subjects: binding.subjects,
      })),
    );

    return manifests;
  }

  /**
   * Render ConfigMaps
   */
  renderConfigMaps(
    environment: string,
    config: DeploymentConfig,
  ): KubernetesManifest[] {
    return [
      {
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: {
          name: "maria-config",
          namespace: `maria-${environment}`,
          labels: {
            "app.kubernetes.io/name": "maria",
            "app.kubernetes.io/component": "config",
          },
        },
        data: {
          "config.yaml": yaml.dump({
            environment,
            memorySystem: {
              encryption: config.security.tls && !config.security.tls.insecure,
              monitoring: config.monitoring.prometheus.enabled,
            },
          }),
        },
      },
    ];
  }

  /**
   * Render Secrets
   */
  renderSecrets(
    environment: string,
    config: DeploymentConfig,
  ): KubernetesManifest[] {
    const secrets: KubernetesManifest[] = [];
    const namespace = `maria-${environment}`;
    const secretsManager = SecretsManagerFactory.create(
      config.security.secrets,
    );

    // Application secrets
    const appSecretData: SecretData[] = [
      { key: "DATABASE_URL", value: "${DATABASE_URL}", sensitive: true },
      { key: "REDIS_URL", value: "${REDIS_URL}", sensitive: true },
      { key: "API_KEY", value: "${API_KEY}", sensitive: true },
      { key: "JWT_SECRET", value: "${JWT_SECRET}", sensitive: true },
      { key: "ENCRYPTION_KEY", value: "${ENCRYPTION_KEY}", sensitive: true },
    ];

    if (config.security.secrets.provider === "kubernetes") {
      secrets.push(
        secretsManager.generateSecret(
          "maria-app-secrets",
          namespace,
          appSecretData,
        ),
      );
    } else {
      // External secrets
      const externalSecret = secretsManager.generateSecret(
        "maria-app-secrets",
        namespace,
        appSecretData.map((_item) => ({
          ..._item,
          valueFrom: {
            provider: config.security.secrets.provider,
            _path: `${environment}/maria/app`,
            key: _item.key,
          },
        })),
      );
      secrets.push(externalSecret);
    }

    return secrets;
  }

  /**
   * Render Deployments
   */
  renderDeployments(
    environment: string,
    config: DeploymentConfig,
  ): KubernetesManifest[] {
    const envConfig = this.getEnvironmentConfig(environment, config);
    const pssLevel =
      config.kubernetes.podSecurityStandards?.enforce ||
      EnvironmentPSSProfiles[envConfig.type].enforce;

    return [
      {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
          name: "maria-memory-system",
          namespace: `maria-${environment}`,
          labels: {
            "app.kubernetes.io/name": "maria",
            "app.kubernetes.io/component": "memory-system",
            "app.kubernetes.io/version": "1.0.0",
          },
        },
        spec: {
          replicas: config.scaling.horizontal.minReplicas,
          selector: {
            matchLabels: {
              "app.kubernetes.io/name": "maria",
              "app.kubernetes.io/component": "memory-system",
            },
          },
          template: {
            metadata: {
              labels: {
                "app.kubernetes.io/name": "maria",
                "app.kubernetes.io/component": "memory-system",
              },
              annotations: {
                "prometheus.io/scrape": "true",
                "prometheus.io/port": "8080",
              },
            },
            spec: {
              serviceAccountName: "maria-memory-system",
              securityContext: generatePodSecurityContext(pssLevel),
              containers: [
                {
                  name: "memory-system",
                  image: "maria/memory-system:latest",
                  imagePullPolicy: "IfNotPresent",
                  securityContext: generateContainerSecurityContext(pssLevel),
                  ports: [
                    {
                      name: "http",
                      containerPort: 8080,
                      protocol: "TCP",
                    },
                  ],
                  resources: {
                    requests: {
                      cpu: envConfig.resources.cpu.requests,
                      memory: envConfig.resources.memory.requests,
                    },
                    limits: {
                      cpu: envConfig.resources.cpu.limits,
                      memory: envConfig.resources.memory.limits,
                    },
                  },
                  env: [
                    {
                      name: "ENVIRONMENT",
                      value: environment,
                    },
                  ],
                  envFrom: [
                    {
                      secretRef: {
                        name: "maria-app-secrets",
                      },
                    },
                  ],
                  volumeMounts: [
                    {
                      name: "config",
                      mountPath: "/etc/maria/config",
                      readOnly: true,
                    },
                  ],
                  livenessProbe: {
                    httpGet: {
                      _path: "/health",
                      port: 8080,
                    },
                    initialDelaySeconds: 30,
                    periodSeconds: 10,
                  },
                  readinessProbe: {
                    httpGet: {
                      _path: "/ready",
                      port: 8080,
                    },
                    initialDelaySeconds: 5,
                    periodSeconds: 5,
                  },
                },
              ],
              volumes: [
                {
                  name: "config",
                  configMap: {
                    name: "maria-config",
                  },
                },
              ],
            },
          },
        },
      },
    ];
  }

  /**
   * Render Services
   */
  renderServices(
    environment: string,
    _config: DeploymentConfig,
  ): KubernetesManifest[] {
    return [
      {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          name: "maria-memory-system",
          namespace: `maria-${environment}`,
          labels: {
            "app.kubernetes.io/name": "maria",
            "app.kubernetes.io/component": "memory-system",
          },
        },
        spec: {
          type: "ClusterIP",
          ports: [
            {
              name: "http",
              port: 80,
              targetPort: 8080,
              protocol: "TCP",
            },
          ],
          selector: {
            "app.kubernetes.io/name": "maria",
            "app.kubernetes.io/component": "memory-system",
          },
        },
      },
    ];
  }

  /**
   * Render Ingress
   */
  renderIngress(
    environment: string,
    config: NetworkingConfig,
  ): KubernetesManifest[] {
    if (!config.ingress.tls?.enabled) return [];

    const hostname = `maria-${environment}.${config.ingress.tls.wildcard ? "*." : ""}example.com`;

    return [
      {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: {
          name: "maria-ingress",
          namespace: `maria-${environment}`,
          annotations: {
            "kubernetes.io/ingress.class": config.ingress.controller,
            ...(config.ingress.tls.provider === "cert_manager" && {
              "cert-manager.io/cluster-issuer": config.ingress.tls.issuer,
            }),
            ...(config.ingress.rateLimiting?.enabled && {
              "nginx.ingress.kubernetes.io/limit-rps": String(
                config.ingress.rateLimiting.global.requests,
              ),
            }),
          },
        },
        spec: {
          ...(config.ingress.tls.enabled && {
            tls: [
              {
                hosts: [hostname],
                secretName: "maria-tls",
              },
            ],
          }),
          rules: [
            {
              host: hostname,
              http: {
                paths: [
                  {
                    _path: "/",
                    pathType: "Prefix",
                    backend: {
                      service: {
                        name: "maria-memory-system",
                        port: {
                          number: 80,
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ];
  }

  /**
   * Render HPA
   */
  renderHPA(environment: string, config: ScalingConfig): KubernetesManifest[] {
    if (!config.horizontal.enabled) return [];

    const hpaConfig = config.horizontal;

    return [
      {
        apiVersion: "autoscaling/v2",
        kind: "HorizontalPodAutoscaler",
        metadata: {
          name: "maria-memory-system-hpa",
          namespace: `maria-${environment}`,
        },
        spec: {
          scaleTargetRef: {
            apiVersion: "apps/v1",
            kind: "Deployment",
            name: "maria-memory-system",
          },
          minReplicas: hpaConfig.minReplicas,
          maxReplicas: hpaConfig.maxReplicas,
          metrics: [
            {
              type: "Resource",
              resource: {
                name: "cpu",
                target: {
                  type: "Utilization",
                  averageUtilization: hpaConfig.targetCPUUtilization,
                },
              },
            },
            ...(hpaConfig.targetMemoryUtilization
              ? [
                  {
                    type: "Resource",
                    resource: {
                      name: "memory",
                      target: {
                        type: "Utilization",
                        averageUtilization: hpaConfig.targetMemoryUtilization,
                      },
                    },
                  },
                ]
              : []),
            ...(hpaConfig.customMetrics || []).map((metric) => ({
              type: "Pods",
              pods: {
                metric: {
                  name: metric.name,
                  selector: metric.selector,
                },
                target: metric.target,
              },
            })),
          ],
          ...(hpaConfig.behavior && { behavior: hpaConfig.behavior }),
        },
      },
    ];
  }

  /**
   * Render Network Policies
   */
  renderNetworkPolicies(
    environment: string,
    config: KubernetesConfig,
  ): KubernetesManifest[] {
    if (!config.networkPolicy.enabled) return [];

    const policies: KubernetesManifest[] = [];

    // Default deny if enabled
    if (config.networkPolicy.defaultDeny) {
      policies.push({
        apiVersion: "networking.k8s.io/v1",
        kind: "NetworkPolicy",
        metadata: {
          name: "default-deny-all",
          namespace: `maria-${environment}`,
        },
        spec: {
          podSelector: Record<string, any>,
          policyTypes: ["Ingress", "Egress"],
        },
      });

      // Allow internal communication
      policies.push({
        apiVersion: "networking.k8s.io/v1",
        kind: "NetworkPolicy",
        metadata: {
          name: "allow-maria-internal",
          namespace: `maria-${environment}`,
        },
        spec: {
          podSelector: {
            matchLabels: {
              "app.kubernetes.io/name": "maria",
            },
          },
          policyTypes: ["Ingress", "Egress"],
          ingress: [
            {
              from: [
                {
                  namespaceSelector: {
                    matchLabels: {
                      name: `maria-${environment}`,
                    },
                  },
                },
              ],
            },
          ],
          egress: [
            // Allow DNS
            {
              to: [
                {
                  namespaceSelector: {
                    matchLabels: {
                      name: "kube-system",
                    },
                  },
                },
              ],
              ports: [
                {
                  protocol: "UDP",
                  port: 53,
                },
              ],
            },
            // Allow internal
            {
              to: [
                {
                  podSelector: {
                    matchLabels: {
                      "app.kubernetes.io/name": "maria",
                    },
                  },
                },
              ],
            },
          ],
        },
      });
    }

    // Custom policies
    policies.push(
      ...config.networkPolicy.policies.map((policy) => ({
        apiVersion: "networking.k8s.io/v1",
        kind: "NetworkPolicy",
        metadata: {
          name: policy.name,
          namespace: policy.namespace || `maria-${environment}`,
        },
        spec: {
          podSelector: policy.selector,
          policyTypes: ["Ingress", "Egress"],
          ingress: policy.ingress,
          egress: policy.egress,
        },
      })),
    );

    return policies;
  }

  /**
   * Render Storage
   */
  renderStorage(config: KubernetesConfig): KubernetesManifest[] {
    return config.storage.classes.map((sc) => ({
      apiVersion: "storage.k8s.io/v1",
      kind: "StorageClass",
      metadata: {
        name: sc.name,
      },
      provisioner: sc.provisioner,
      parameters: sc.parameters,
      reclaimPolicy: sc.reclaimPolicy,
      allowVolumeExpansion: sc.allowVolumeExpansion,
      volumeBindingMode: sc.volumeBindingMode,
    }));
  }

  /**
   * Render Monitoring resources
   */
  private renderMonitoring(
    environment: string,
    config: DeploymentConfig,
  ): KubernetesManifest[] {
    const manifests: KubernetesManifest[] = [];

    if (config.monitoring.prometheus.enabled) {
      // ServiceMonitor for Prometheus
      manifests.push({
        apiVersion: "monitoring.coreos.com/v1",
        kind: "ServiceMonitor",
        metadata: {
          name: "maria-memory-system",
          namespace: `maria-${environment}`,
          labels: {
            "app.kubernetes.io/name": "maria",
            "app.kubernetes.io/component": "monitoring",
          },
        },
        spec: {
          selector: {
            matchLabels: {
              "app.kubernetes.io/name": "maria",
            },
          },
          endpoints: [
            {
              port: "http",
              interval: "30s",
              _path: "/metrics",
            },
          ],
        },
      });
    }

    return manifests;
  }

  /**
   * Get environment configuration
   */
  private getEnvironmentConfig(
    environment: string,
    config: DeploymentConfig,
  ): EnvironmentConfig {
    const envConfig = config.infrastructure.environments.find(
      (e) => e.name === environment,
    );
    if (!envConfig) {
      throw new Error(`Environment ${environment} not found in configuration`);
    }
    return envConfig;
  }
}

/**
 * Manifest validation utilities
 */
export class ManifestValidator {
  static validate(manifest: KubernetesManifest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!manifest.apiVersion) {
      errors.push("apiVersion is required");
    }

    if (!manifest.kind) {
      errors.push("kind is required");
    }

    if (!manifest.metadata?.name) {
      errors.push("metadata.name is required");
    }

    // Validate specific resource types
    switch (manifest.kind) {
      case "Deployment":
        this.validateDeployment(manifest, errors);
        break;
      case "Service":
        this.validateService(manifest, errors);
        break;
      case "Ingress":
        this.validateIngress(manifest, errors);
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  private static validateDeployment(
    manifest: KubernetesManifest,
    errors: string[],
  ): void {
    if (!manifest.spec?.selector) {
      errors.push("Deployment must have spec.selector");
    }
    if (!manifest.spec?.template) {
      errors.push("Deployment must have spec.template");
    }
  }

  private static validateService(
    manifest: KubernetesManifest,
    errors: string[],
  ): void {
    if (!manifest.spec?.selector) {
      errors.push("Service must have spec.selector");
    }
    if (!manifest.spec?.ports || manifest.spec.ports.length === 0) {
      errors.push("Service must have at least one port");
    }
  }

  private static validateIngress(
    manifest: KubernetesManifest,
    errors: string[],
  ): void {
    if (!manifest.spec?.rules || manifest.spec.rules.length === 0) {
      errors.push("Ingress must have at least one rule");
    }
  }
}

/**
 * Manifest output formatter
 */
export class ManifestFormatter {
  static format(
    manifests: KubernetesManifest[],
    format: "json" | "yaml" = "yaml",
  ): string {
    if (format === "json") {
      return JSON.stringify(manifests, null, 2);
    }

    return manifests.map((manifest) => yaml.dump(manifest)).join("---\n");
  }

  static formatSingle(
    manifest: KubernetesManifest,
    format: "json" | "yaml" = "yaml",
  ): string {
    if (format === "json") {
      return JSON.stringify(manifest, null, 2);
    }
    return yaml.dump(manifest);
  }
}
